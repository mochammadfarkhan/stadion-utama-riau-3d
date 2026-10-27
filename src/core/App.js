import * as THREE from 'three';
import { createAdaptiveResolution } from './adaptiveResolution.js';
import { frameInterval, shouldRenderFrame } from '../engine/frameCap.js';
import { flipRowsInPlace } from '../shared/minimapMath.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { RENDER, RENDER_LAYERS } from '../config/constants.js';
import { DepthRenderPass, OutlinePass } from './postprocessing/OutlinePass.js';
import { createSystemRunner } from '../engine/SystemRunner.js';
import { gateSystem } from '../engine/systemGate.js';
import { GradingShader, tintVector } from './postprocessing/gradingShader.js';
import { BloomLitePass, TiltShiftPass } from './postprocessing/efekLayar.js';
import { BLOOM, TILT_SHIFT } from '../config/lowpoly.js';

const MAX_DT = 0.05;
const MAX_PIXEL_RATIO = RENDER.pixelRatio;
const SHADOW_INTERVAL = 2;         // peta bayangan dirender ulang tiap N frame (pass shadow ±25% biaya frame)
const ADAPTIVE_MIN_RATIO = 0.6;   // resolusi adaptif tidak turun di bawah ini
const ADAPTIVE_TARGET_MS = 20;    // target waktu frame (50 fps)
const WARMUP_POLL_MS = 16;        // jeda cek program selesai di-link (warmup)
/** Jenis objek yang memengaruhi kunci program (instancing/warna instans/batching). */
const proxyKind = (o) => (o.isBatchedMesh ? (o._colorsTexture ? 'batchC' : 'batch')
  : o.isInstancedMesh ? (o.instanceColor ? 'instC' : 'inst') : 'mesh');

/** Mesh tiruan berjenis sama dengan `o` (geometri dibagikan) memakai `material` — hanya untuk kompilasi program. */
function proxyOf(o, material) {
  if (o.isBatchedMesh) {
    // Kunci program memuat atribut geometri yang ADA (normal → vertexNormals, dst.): tiru daftar atribut batch asli
    // pada satu segitiga; warna per instans = varian 'batchingColor'.
    const p = new THREE.BatchedMesh(1, 3, 3, material);
    const g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(o.geometry.attributes)) {
      g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(3 * a.itemSize), a.itemSize, a.normalized));
    }
    if (o.geometry.index) g.setIndex([0, 1, 2]);
    const inst = p.addInstance(p.addGeometry(g));
    if (o._colorsTexture) p.setColorAt(inst, new THREE.Color());
    g.dispose();
    return p;
  }
  if (o.isInstancedMesh) {
    const p = new THREE.InstancedMesh(o.geometry, material, 1);
    if (o.instanceColor) p.setColorAt(0, new THREE.Color());
    return p;
  }
  return new THREE.Mesh(o.geometry, material);
}

/** Sisi depth pass bayangan non-VSM (WebGLShadowMap): Front→Back, Back→Front, Double→Double. */
const SHADOW_SIDE_FLIP = Object.freeze({ [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide });
const AO_SAMPLES = 12;            // sampel GTAO per piksel (default 16; lebih ringan)
const AO_DISTANCE_FALLOFF = 1.0;
const MINIMAP_BAKE_PX = 1024;      // resolusi peta dasar (±1 m/piksel untuk area region ±461 m ≈ resolusi minimap 200 px/320 m pada DPR 2;
                                   // 1536 → 1024: salinan GPU→CPU + GC bake region 9,4 → 4,2 MB)
const MINIMAP_BAKE_HEIGHT = 400;
const MINIMAP_BAKE_AMBIENT = 3;    // ambient ≈ albedo ×0,95 (tanpa IBL/kabut/matahari)

/**
 * App: renderer, scene, kamera utama, post-processing, minimap, loop waktu.
 * Modul lain mendaftar lewat addSystem({ id, phase, update(dt, ctx) }) (engine/SystemRunner);
 * addUpdatable({ update }) tetap ada sebagai adaptor fase 'ui' untuk binding settings.
 * Render utama lewat EffectComposer (RenderPass -> GTAO -> Outline -> Vignette -> OutputPass;
 * tone mapping + sRGB hanya di OutputPass), lalu label CSS2D, lalu minimap.
 * Minimap = peta dasar 2D yang di-bake sekali (bakeMinimap) dari objek di RENDER_LAYERS.minimap;
 * penggambaran per frame ada di ui/Minimap2D.js (tanpa render 3D tambahan).
 */
export class App {
  #legacy = new Map(); // updatable lama -> id sistem adaptor
  #legacySeq = 0;
  #disposed = false;
  #frameGate = { next: 0 }; // jadwal frame berikutnya untuk batas FPS (engine/frameCap)
  #depthVariants = new Map(); // material depth tiruan pass bayangan (warmup)
  #readyKeys = new Set();     // material + jenis objek yang programnya sudah siap (materialReadyFor)
  #shadowScene = new THREE.Scene(); // scene kosong: kompilasi proxy depth tanpa lampu (= pass bayangan)
  #onResize = () => this.resize();
  #aoWanted = RENDER.ao;
  #aoLoading = false;
  #gate = null; // (id) => boolean; null = semua sistem jalan (lihat setSystemGate)

  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    // Matriks dunia dihitung SEKALI per frame di render() (bukan oleh composer, label, dan minimap sendiri-sendiri).
    this.scene.matrixWorldAutoUpdate = false;
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 2500);
    this.renderer = createRenderer();
    this.labelRenderer = createLabelRenderer();
    this.post = createComposer(this.renderer, this.scene, this.camera);
    /** Scene & kamera yang sedang dirender (setView); default = scene/kamera utama (eksterior). */
    this.view = { scene: this.scene, camera: this.camera, aoRadius: RENDER.aoRadius };
    this.timer = new THREE.Timer();
    this.systems = createSystemRunner();
    this.minimapVisible = true;
    this.elapsed = 0;
    this.frame = 0;
    /** true: loop tetap menjalankan sistem (streaming memuat) tanpa render — dipakai saat layar muat. */
    this.holdRender = false;
    this.frameIntervalMs = 0; // batas FPS (setFrameCap); 0 = ikut refresh layar
    // `?nowarm`: matikan pemanasan shader (warmup/proxy bayangan/penundaan pbrSwap) — pembanding ukur performa
    this.warmEnabled = typeof location === 'undefined' || !new URLSearchParams(location.search).has('nowarm');
    this.adaptiveTargetMs = ADAPTIVE_TARGET_MS;
    this.lastCtx = null;              // ctx frame terakhir (dipakai renderFrame untuk screenshot)
    this.baseExposure = RENDER.exposure; // dari preset TimeOfDay (ditulis tiap frame)
    this.exposureScale = 1;           // pengali dari settings (sky.exposure / RENDER.exposure)

    container.appendChild(this.renderer.domElement);
    document.body.appendChild(this.labelRenderer.domElement);
    window.addEventListener('resize', this.#onResize);
    this.resize();
  }

  /** Daftarkan sistem berfase (lihat engine/SystemRunner); dibungkus gerbang (setSystemGate). */
  addSystem(system) {
    this.systems.add(gateSystem(system, (id) => this.#gate === null || this.#gate(id)));
    return system;
  }

  removeSystem(id) {
    return this.systems.remove(id);
  }

  /** Adaptor API lama: objek { update(dt, ctx) } menjadi sistem fase `phase` (default 'ui'). */
  addUpdatable(obj, phase = 'ui') {
    if (!obj || typeof obj.update !== 'function') return obj;
    this.#legacySeq += 1;
    const id = `updatable-${this.#legacySeq}`;
    this.#legacy.set(obj, id);
    this.addSystem({ id, phase, update: (dt, ctx) => obj.update(dt, ctx) });
    return obj;
  }

  /** Hapus updatable yang didaftarkan lewat addUpdatable. */
  removeUpdatable(obj) {
    const id = this.#legacy.get(obj);
    if (!id) return;
    this.systems.remove(id);
    this.#legacy.delete(obj);
  }

  /**
   * Gerbang sistem: `fn(id)` → true = sistem jalan frame ini. null = semua jalan. Dipakai portal interior untuk
   * menjeda sistem eksterior (tidak dilepas, urutan tetap).
   * @param {((id:string) => boolean)|null} fn
   */
  setSystemGate(fn) {
    this.#gate = typeof fn === 'function' ? fn : null;
  }

  /**
   * Ganti scene & kamera yang dirender (loop, RenderPass, GTAO, outline, label CSS2D). null = kembali ke
   * scene/kamera utama. `aoRadius` (m, opsional) dipakai GTAO selama view aktif. Kamera view ikut resize.
   * @param {{scene: THREE.Scene, camera: THREE.Camera, aoRadius?: number}|null} view
   */
  setView(view = null) {
    const next = view
      ? { scene: view.scene, camera: view.camera, aoRadius: Number.isFinite(view.aoRadius) ? view.aoRadius : RENDER.aoRadius }
      : { scene: this.scene, camera: this.camera, aoRadius: RENDER.aoRadius };
    if (!next.scene?.isScene || !next.camera?.isCamera) throw new TypeError('App.setView: butuh {scene, camera}');
    this.view = next;
    this.#bindViewToPasses();
    // Label CSS2D eksterior (pedagang, NPC cerita) tidak boleh tertinggal melayang di atas scene lain.
    this.labelRenderer.domElement.style.display = next.scene === this.scene ? '' : 'none';
    this.resize();
    return next;
  }

  #bindViewToPasses() {
    const { scene, camera, aoRadius } = this.view;
    this.post.scenePass.scene = scene;
    this.post.scenePass.camera = camera;
    this.post.outlinePass.camera = camera;
    const ao = this.post.gtaoPass;
    if (ao) {
      ao.scene = scene;
      ao.camera = camera;
      ao.updateGtaoMaterial({ radius: aoRadius });
    }
  }

  /** Aktif/nonaktifkan ambient occlusion saat runtime (mis. bila FPS rendah). */
  setAO(enabled) {
    this.#aoWanted = Boolean(enabled);
    if (this.post.gtaoPass) this.post.gtaoPass.enabled = this.#aoWanted;
    else if (this.#aoWanted) this.#loadGtao();
    return this.#aoWanted;
  }

  get aoEnabled() {
    return this.#aoWanted;
  }

  /**
   * GTAO dibuat malas: pass (beberapa render target resolusi penuh) dan kodenya baru dimuat saat AO
   * pertama kali dinyalakan. Default AO mati, jadi sebagian besar sesi tidak pernah membayarnya.
   */
  async #loadGtao() {
    if (this.#aoLoading) return;
    this.#aoLoading = true;
    try {
      const { GTAOPass } = await import('three/addons/postprocessing/GTAOPass.js');
      const pass = createGtaoPass(GTAOPass, this.view.scene, this.view.camera);
      pass.enabled = this.#aoWanted;
      this.post.composer.insertPass(pass, 1); // tepat setelah render scene, sebelum outline
      this.post.gtaoPass = pass;
      this.#bindViewToPasses();
      this.resize(); // ukuran AO (RENDER.aoScale)
    } catch (err) {
      console.error('Ambient occlusion gagal dimuat, dinonaktifkan:', err);
      this.#aoWanted = false;
    } finally {
      this.#aoLoading = false;
    }
  }

  /** Aktif/nonaktifkan pass vignette. */
  setVignette(enabled) {
    this.post.vignettePass.enabled = Boolean(enabled);
    return this.post.vignettePass.enabled;
  }

  get vignetteEnabled() {
    return this.post.vignettePass.enabled;
  }

  /**
   * Color grading gaya kartun/facet; null = mati (pass dilewati, biaya nol).
   * @param {{saturation:number, contrast:number, strength:number, highlight:number, shadow:number,
   *   satKnee?:number, satCeil?:number, vignette?:number}|null} g
   */
  setGrading(g) {
    const pass = this.post.gradingPass;
    pass.enabled = Boolean(g);
    if (!g) return;
    const u = pass.uniforms;
    u.saturation.value = g.saturation;
    u.contrast.value = g.contrast;
    u.strength.value = g.strength;
    u.satKnee.value = g.satKnee ?? 1;
    u.satCeil.value = g.satCeil ?? 1;
    u.vignette.value = g.vignette ?? 0;
    tintVector(g.highlight, u.highlight.value);
    tintVector(g.shadow, u.shadow.value);
  }

  /** Bloom halus (hanya efektif bila grading aktif: komposit ada di pass grading). */
  setBloom(enabled) {
    const on = Boolean(enabled);
    this.post.bloomPass.enabled = on;
    this.post.gradingPass.uniforms.bloomIntensity.value = on ? BLOOM.intensity : 0;
    return on;
  }

  /** Efek maket (tilt-shift). */
  setTiltShift(enabled) {
    this.post.tiltPass.enabled = Boolean(enabled);
    return this.post.tiltPass.enabled;
  }

  /** Batas atas pixel ratio dari gaya grafis (Infinity = tanpa batas); pengaturan resolusi tetap dihormati di bawah batas ini. */
  setPixelCap(cap) {
    this.pixelCap = cap;
    if (this.pixelWanted) this.setPixelRatio(this.pixelWanted);
  }

  /** Aktif/nonaktifkan garis tepi tipis (outline screen-space). */
  setOutline(enabled) {
    this.post.outlinePass.enabled = Boolean(enabled);
    return this.post.outlinePass.enabled;
  }

  get outlineEnabled() {
    return this.post.outlinePass.enabled;
  }

  /**
   * Exposure = baseExposure (preset TimeOfDay) × exposureScale (settings).
   * setExposure(v) menerima nilai absolut dari settings; pengali = v / RENDER.exposure,
   * sehingga nilai default settings (0.9) berarti "tanpa perubahan" terhadap preset.
   */
  setExposure(value) {
    const v = Number(value);
    this.exposureScale = Number.isFinite(v) && v > 0 ? v / RENDER.exposure : 1;
    this.applyExposure();
  }

  /** Dipanggil TimeOfDay tiap frame dengan exposure preset; Weather boleh mengalikan sesudahnya. */
  setBaseExposure(base) {
    this.baseExposure = base;
    this.applyExposure();
  }

  applyExposure() {
    this.renderer.toneMappingExposure = this.baseExposure * this.exposureScale;
  }

  /** Ubah pixel ratio render (resolusi internal) lalu sesuaikan semua target. */
  setPixelRatio(ratio) {
    const wanted = Number(ratio);
    if (!Number.isFinite(wanted) || wanted <= 0) return;
    this.pixelWanted = wanted;
    const r = Math.min(wanted, this.pixelCap ?? Infinity);
    // Nilai dari pengaturan = batas atas; kontroler adaptif mulai ulang dari sini.
    this.pixelCeiling = r;
    this.adaptive = createAdaptiveResolution({ ceiling: r, floor: ADAPTIVE_MIN_RATIO, targetMs: this.adaptiveTargetMs });
    this.#applyPixelRatio(r);
  }

  /**
   * Batas FPS (0 = tanpa batas): loop melewati vsync sampai jadwal frame berikutnya (engine/frameCap). Target resolusi
   * adaptif dilonggarkan ke interval batas, agar frame 33 ms di batas 30 tidak dianggap "lambat" dan menurunkan resolusi.
   */
  setFrameCap(fps) {
    this.frameIntervalMs = frameInterval(fps);
    this.#frameGate.next = 0;
    this.adaptiveTargetMs = Math.max(ADAPTIVE_TARGET_MS, this.frameIntervalMs * 1.05);
    if (this.pixelCeiling) {
      this.adaptive = createAdaptiveResolution({ ceiling: this.pixelCeiling, floor: ADAPTIVE_MIN_RATIO, targetMs: this.adaptiveTargetMs });
    }
  }

  /** Aktifkan/nonaktifkan resolusi adaptif; saat nonaktif kembali ke batas atas dari pengaturan. */
  setAdaptiveResolution(on) {
    this.adaptiveOn = Boolean(on);
    if (!this.adaptiveOn && this.pixelCeiling && this.pixelRatio !== this.pixelCeiling) {
      this.adaptive = createAdaptiveResolution({ ceiling: this.pixelCeiling, floor: ADAPTIVE_MIN_RATIO, targetMs: this.adaptiveTargetMs });
      this.#applyPixelRatio(this.pixelCeiling);
    }
  }

  /**
   * Jalankan `fn` sementara dengan pixel ratio `r` lalu kembalikan ke rasio semula, TANPA mengubah
   * batas atas pengaturan maupun kontroler adaptif (dipakai screenshot).
   */
  withPixelRatio(r, fn) {
    const prev = this.pixelRatio;
    if (r !== prev) this.#applyPixelRatio(r);
    try {
      return fn();
    } finally {
      if (r !== prev) this.#applyPixelRatio(prev);
    }
  }

  #applyPixelRatio(r) {
    this.renderer.setPixelRatio(r);
    this.post.composer.setPixelRatio(r); // resize() di bawah memakai rasio baru
    this.resize();
  }

  get pixelRatio() {
    return this.renderer.getPixelRatio();
  }

  resize() {
    // min 1 px: jendela tersembunyi (0×0) tidak boleh membuat target/depthTexture berukuran nol
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    for (const cam of new Set([this.camera, this.view.camera])) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    this.renderer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.post.outlinePass.setPixelRatio(pr);
    this.post.composer.setSize(w, h); // ukuran efektif (+ depthTexture) ke semua target & pass // GTAO dihitung pada resolusi lebih rendah (RENDER.aoScale)
    this.post.gtaoPass?.setSize(Math.round(w * pr * RENDER.aoScale), Math.round(h * pr * RENDER.aoScale));
    this.labelRenderer.setSize(w, h);
  }

  /**
   * Kompilasi shader scene SEBELUM frame pertama tanpa memblokir thread (KHR_parallel_shader_compile).
   * Tanpa ini render pertama menunggu link ~90 program secara sinkron (belasan detik di ANGLE/D3D11).
   * Render target diarahkan ke buffer composer: kunci program memuat toneMapping/outputColorSpace target,
   * jadi kompilasi ke kanvas (target null) menghasilkan varian yang tidak pernah dipakai RenderPass.
   * Bagian kompilasi compileAsync sinkron; target dikembalikan SEBELUM menunggu link (loop bisa render di sela).
   * @returns {Promise<void>}
   */
  precompile() {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.post.composer.readBuffer);
    const proxies = this.warmEnabled ? this.#shadowProxies(this.view.scene) : new THREE.Group(); // varian depth bayangan
    try {
      return Promise.all([
        r.compileAsync(this.view.scene, this.view.camera),
        proxies.children.length ? r.compileAsync(proxies, this.view.camera, this.#shadowScene) : null,
      ]).then(() => {}).finally(() => proxies.children.forEach((o) => o.isBatchedMesh && o.dispose()));
    } finally {
      r.setRenderTarget(prev);
    }
  }

  /**
   * Hangatkan shader sebuah subpohon SEBELUM ditampilkan (rencana performa Fase 2): #prepare memulai kompilasi varian
   * PERSIS milik objek-objeknya (termasuk varian depth pass bayangan) secara paralel (KHR_parallel_shader_compile), lalu
   * menunggu sampai semua program selesai di-link — frame pertama yang menggambarnya tidak membeku menunggu kompilasi.
   * @param {THREE.Object3D} root boleh belum ada di scene / tersembunyi (compile menelusuri semua mesh)
   * @returns {Promise<void>}
   */
  warmup(root) {
    if (!this.warmEnabled) return Promise.resolve();
    const keys = this.#variantKeys(root);
    if (keys.every((k) => this.#readyKeys.has(k))) return Promise.resolve(); // jalur cepat: varian sudah terbukti siap
    const pending = this.#prepare(root).filter((p) => !p.isReady());
    const done = () => { for (const k of keys) this.#readyKeys.add(k); };
    if (!pending.length) {
      done();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const poll = () => {
        for (let i = pending.length - 1; i >= 0; i -= 1) if (pending[i].isReady()) pending.splice(i, 1);
        if (pending.length) setTimeout(poll, WARMUP_POLL_MS);
        else {
          done();
          resolve();
        }
      };
      poll();
    });
  }

  /**
   * true bila subpohon akan membeku saat pertama digambar: ada program (utama atau bayangan) untuk variannya yang belum
   * selesai di-link. Sekaligus MEMULAI kompilasinya, jadi warmup() sesudahnya tinggal menunggu.
   * @param {THREE.Object3D} root
   */
  needsWarmup(root) {
    if (!this.warmEnabled) return false;
    const keys = this.#variantKeys(root);
    if (keys.every((k) => this.#readyKeys.has(k))) return false; // jalur cepat: tanpa compile()
    const need = this.#prepare(root).some((p) => !p.isReady());
    if (!need) for (const k of keys) this.#readyKeys.add(k);
    return need;
  }

  /** Kunci varian per (material + versinya, jenis objek, ikut pass bayangan) di subpohon — untuk jalur cepat. */
  #variantKeys(root) {
    const vsm = this.renderer.shadowMap.type === THREE.VSMShadowMap;
    const keys = new Set();
    root.traverse((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
      const shadow = o.castShadow || (vsm && o.receiveShadow) ? 's' : '';
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m) keys.add(`${m.uuid}|${m.version}|${proxyKind(o)}|${shadow}`);
      }
    });
    return [...keys];
  }

  /**
   * true bila program `material` untuk varian objek `object` (biasa/instanced/batched, termasuk depth bayangan bila
   * memancarkan bayangan) sudah siap; bila belum, kompilasinya DIMULAI (non-blok). Dipakai styleManager untuk menunda
   * penukaran material (pbrSwap) sampai shader barunya siap. Hasil siap di-cache per material + jenis objek.
   */
  materialReadyFor(object, material) {
    if (!this.warmEnabled) return true;
    const inShadow = object.castShadow || (this.renderer.shadowMap.type === THREE.VSMShadowMap && object.receiveShadow);
    const key = `${material.uuid}|${material.version}|${proxyKind(object)}|${inShadow ? 's' : ''}`;
    if (this.#readyKeys.has(key)) return true;
    const root = new THREE.Group();
    root.add(proxyOf(object, material));
    const ready = this.#prepare(root, inShadow ? [object] : []).every((p) => p.isReady());
    for (const o of root.children) if (o.isBatchedMesh) o.dispose();
    if (ready) this.#readyKeys.add(key);
    return ready;
  }

  /** Kompilasi (non-blok) varian program utama + depth bayangan subpohon; kembalikan program-programnya. */
  #prepare(root, shadowCasters = null) {
    const r = this.renderer;
    const { scene, camera } = this.view;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.post.composer.readBuffer); // varian target composer (linear, tanpa tone mapping) = pass utama
    const proxies = this.#shadowProxies(root, shadowCasters);
    try {
      const mats = [...r.compile(root, camera, scene)];
      // pass bayangan three.js menyusun program depth TANPA lampu → kompilasi proxy terhadap scene kosong
      if (proxies.children.length) mats.push(...r.compile(proxies, camera, this.#shadowScene));
      // SEMUA program material (satu material bisa punya varian biasa/instanced/batched; currentProgram = varian terakhir)
      return mats.flatMap((m) => [...(r.properties.get(m).programs?.values() ?? [])]).filter((p) => p?.isReady);
    } finally {
      r.setRenderTarget(prev);
      for (const o of proxies.children) if (o.isBatchedMesh) o.dispose();
    }
  }

  /**
   * Mesh tiruan berjenis sama (biasa/instanced/batched) dengan material depth yang dipakai pass bayangan untuk tiap
   * objek yang digambar pass bayangan di subpohon (pemancar; pada VSM juga penerima) (meniru WebGLShadowMap.getDepthMaterial: custom depth, varian alpha/map/displacement,
   * sisi VSM = shadowSide ?? side, selain VSM dibalik). compileAsync three.js tidak menyentuh varian ini.
   */
  #shadowProxies(root, casters = null) {
    const group = new THREE.Group();
    const r = this.renderer;
    if (!r.shadowMap.enabled) return group;
    const vsm = r.shadowMap.type === THREE.VSMShadowMap;
    const seen = new Set(); // satu proxy per (jenis objek, material depth): ribuan pemancar → beberapa proxy
    const visit = (o, material = null) => {
      // pass bayangan menggambar pemancar, dan pada VSM juga PENERIMA (WebGLShadowMap.renderObject)
      if (!(o.castShadow || (vsm && o.receiveShadow)) || !o.isMesh || o.isSkinnedMesh) return;
      const src = material ?? (Array.isArray(o.material) ? o.material[0] : o.material);
      if (!src) return;
      const side = src.shadowSide ?? (vsm ? src.side : SHADOW_SIDE_FLIP[src.side]);
      const depth = o.customDepthMaterial ?? this.#depthVariant(src, side);
      const key = `${proxyKind(o)}|${depth.uuid}`;
      if (seen.has(key)) return;
      seen.add(key);
      group.add(proxyOf(o, depth));
    };
    if (casters) for (const o of casters) visit(o, root.children[0]?.material);
    else root.traverse((o) => visit(o));
    return group;
  }

  /**
   * Material depth per kombinasi yang memengaruhi kunci program, meniru WebGLShadowMap.getDepthMaterial: material depth
   * bersama SELALU menyalin map/alphaMap/alphaTest/displacement dari material sumber (bukan hanya kasus klon unik).
   * Program-nya tetap hidup di cache selama material tiruan ini hidup.
   */
  #depthVariant(src, side) {
    const alphaTest = src.alphaToCoverage === true ? 0.5 : src.alphaTest;
    const disp = src.displacementMap && src.displacementScale !== 0 ? src.displacementMap : null;
    const key = [side, alphaTest > 0 ? 1 : 0, src.map ? `m${src.map.channel}` : '', src.alphaMap ? `a${src.alphaMap.channel}` : '',
      disp ? `d${disp.channel}` : ''].join('|');
    let m = this.#depthVariants.get(key);
    if (!m) {
      m = new THREE.MeshDepthMaterial({ side, alphaTest, map: src.map, alphaMap: src.alphaMap });
      if (disp) {
        m.displacementMap = disp;
        m.displacementScale = src.displacementScale;
      }
      this.#depthVariants.set(key, m);
    }
    return m;
  }

  /** Mulai loop. makeContext(dt) mengembalikan ctx untuk semua updatable. */
  start(makeContext) {
    const loop = () => {
      if (!shouldRenderFrame(this.#frameGate, performance.now(), this.frameIntervalMs)) return; // batas FPS
      this.timer.update();
      const rawDt = this.timer.getDelta();
      const dt = Math.min(rawDt, MAX_DT);
      this.elapsed += dt;
      const ctx = makeContext(dt, this.elapsed, rawDt);
      ctx.shadowFrame = this.frame % SHADOW_INTERVAL === 0;
      if (this.adaptiveOn && !this.holdRender) { // frame tanpa render terlalu cepat: jangan dijadikan sampel resolusi
        const next = this.adaptive?.sample(rawDt);
        if (next != null) this.#applyPixelRatio(next);
      }
      this.lastCtx = ctx;
      this.systems.update(dt, ctx);
      if (!this.holdRender) this.render(ctx);
      this.frame += 1;
    };
    this.renderer.setAnimationLoop(loop);
  }

  /** Render satu frame tanpa memajukan simulasi (screenshot). */
  renderFrame() {
    this.render({ ...this.lastCtx, shadowFrame: true });
  }

  /**
   * Bongkar aplikasi: hentikan loop, lepas listener resize, dispose sistem, pass, render target,
   * renderer, dan elemen DOM-nya. Idempoten. (Tidak dapat dites di Node: butuh WebGL.)
   */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.#onResize);
    this.systems.dispose();
    for (const pass of this.post.composer.passes) pass.dispose?.();
    this.post.composer.dispose();
    this.labelRenderer.domElement.remove();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  render(ctx) {
    const r = this.renderer;
    const w = window.innerWidth;
    const h = window.innerHeight;
    r.autoClear = false;
    r.info.reset(); // info.render dihitung per frame (semua pass), bukan per pass
    r.shadowMap.needsUpdate = ctx?.shadowFrame !== false; // shadow pass tiap SHADOW_INTERVAL frame (hanya kamera utama)
    r.setViewport(0, 0, w, h);
    const { scene, camera } = this.view;
    scene.updateMatrixWorld();
    this.post.composer.render(); // pass pertama membersihkan buffer; OutputPass menulis ke layar
    this.labelRenderer.render(scene, camera);
  }

  /**
   * Bake peta dasar minimap SEKALI: tampak atas area region dari kamera ortografis, hanya objek
   * di RENDER_LAYERS.minimap, diterangi ambient merata (tanpa IBL, kabut, matahari) lalu disalin
   * ke canvas 2D. Latar TRANSPARAN: di luar tanah region (mask) layer tile kota di bawahnya tampak.
   * Dipakai oleh ui/Minimap2D; tidak ada render 3D minimap per frame.
   * @param {number} worldHalf setengah sisi area bake (m)
   * @param {{x:number, z:number}} [center] pusat area bake di frame dunia (placement region); utara tetap di atas
   * @returns {HTMLCanvasElement}
   */
  bakeMinimap(worldHalf, center = { x: 0, z: 0 }) {
    const { target, px } = this.#renderMinimap(worldHalf, center);
    try {
      const buf = new Uint8ClampedArray(px * px * 4);
      this.renderer.readRenderTargetPixels(target, 0, 0, px, px, buf);
      flipRowsInPlace(buf, px, px);
      const canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = px;
      canvas.getContext('2d').putImageData(new ImageData(buf, px, px), 0, 0);
      return canvas;
    } finally {
      target.dispose();
    }
  }

  /**
   * Seperti bakeMinimap, tetapi tanpa membekukan thread (rencana performa Fase 2): piksel dibaca asinkron (PBO + fence
   * WebGL2, readRenderTargetPixelsAsync) dan dibalik + diubah menjadi ImageBitmap oleh browser (createImageBitmap flipY),
   * bukan readPixels sinkron + loop JS + putImageData 9 MB di thread utama.
   * @returns {Promise<ImageBitmap>}
   */
  async bakeMinimapAsync(worldHalf, center = { x: 0, z: 0 }) {
    const { target, px } = this.#renderMinimap(worldHalf, center);
    try {
      const buf = new Uint8ClampedArray(px * px * 4);
      await this.renderer.readRenderTargetPixelsAsync(target, 0, 0, px, px, buf);
      return await createImageBitmap(new ImageData(buf, px, px), { imageOrientation: 'flipY' });
    } finally {
      target.dispose();
    }
  }

  /** Render tampak atas layer minimap ke target baru; keadaan scene dipulihkan SEBELUM kembali. Pemanggil membuang target. */
  #renderMinimap(worldHalf, center) {
    const r = this.renderer;
    const px = MINIMAP_BAKE_PX;
    const cam = new THREE.OrthographicCamera(-worldHalf, worldHalf, worldHalf, -worldHalf, 1, MINIMAP_BAKE_HEIGHT * 2);
    cam.up.set(0, 0, -1); // utara (−z) di atas layar
    cam.layers.set(RENDER_LAYERS.minimap);
    cam.position.set(center.x, MINIMAP_BAKE_HEIGHT, center.z);
    cam.lookAt(center.x, 0, center.z);
    cam.updateMatrixWorld();
    const target = new THREE.WebGLRenderTarget(px, px, { type: THREE.UnsignedByteType, stencilBuffer: false });
    target.texture.colorSpace = THREE.SRGBColorSpace; // shader menulis sRGB; target bukan layar → tanpa tone mapping
    const light = new THREE.AmbientLight(0xffffff, MINIMAP_BAKE_AMBIENT);
    light.layers.set(RENDER_LAYERS.minimap);
    const keep = { env: this.scene.environment, fog: this.scene.fog, bg: this.scene.background };
    const clear = r.getClearColor(new THREE.Color());
    const clearAlpha = r.getClearAlpha();
    this.scene.add(light);
    this.scene.environment = null;
    this.scene.fog = null;
    this.scene.background = null;
    this.scene.updateMatrixWorld();
    try {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 0);
      r.clear();
      r.render(this.scene, cam);
      return { target, px };
    } catch (err) {
      target.dispose();
      throw err;
    } finally {
      r.setRenderTarget(null);
      r.setClearColor(clear, clearAlpha);
      this.scene.remove(light);
      this.scene.environment = keep.env;
      this.scene.fog = keep.fog;
      this.scene.background = keep.bg;
    }
  }
}

function createRenderer() {
  // antialias:false — scene dirender ke target composer (tanpa MSAA); backbuffer MSAA hanya menerima quad layar penuh.
  // Penghalusan tepi datang dari supersampling (pixelRatio) + garis tepi.
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;     // tipe (VSM) diatur di world/Lighting.js
  renderer.shadowMap.autoUpdate = false; // dipicu manual lewat needsUpdate sekali per frame
  renderer.info.autoReset = false;       // di-reset manual di App.render agar statistik per frame
  // Tone mapping dieksekusi sekali oleh OutputPass (render ke target tidak di-tone-map).
  // AgX dipilih karena menjaga warna pastel (ACES menaikkan saturasi hijau/merah).
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = RENDER.exposure;
  return renderer;
}

/**
 * Rantai post-processing: RenderPass -> GTAOPass (AO halus) -> Outline -> Vignette -> OutputPass.
 * Target composer memakai DepthTexture agar OutlinePass dapat membaca kedalaman adegan.
 * @returns {{composer: EffectComposer, gtaoPass: object|null, scenePass: DepthRenderPass, outlinePass: OutlinePass, vignettePass: ShaderPass}}
 */
function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer, createComposerTarget(renderer));
  const scenePass = new DepthRenderPass(scene, camera);
  composer.addPass(scenePass);
  const outlinePass = createOutlinePass(camera, scenePass, renderer.getPixelRatio());
  composer.addPass(outlinePass);
  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.uniforms.offset.value = RENDER.vignetteOffset;
  vignettePass.uniforms.darkness.value = RENDER.vignetteDarkness;
  vignettePass.enabled = RENDER.vignette;
  composer.addPass(vignettePass);
  const tiltPass = new TiltShiftPass(TILT_SHIFT);
  tiltPass.enabled = false; // opsional (Efek maket)
  composer.addPass(tiltPass);
  const bloomPass = new BloomLitePass(BLOOM);
  bloomPass.enabled = false; // aktif hanya pada gaya kartun/facet
  composer.addPass(bloomPass);
  const gradingPass = new ShaderPass(GradingShader);
  gradingPass.enabled = false; // aktif hanya pada gaya kartun/facet
  gradingPass.uniforms.tBloom.value = bloomPass.texture;
  composer.addPass(gradingPass);
  composer.addPass(new OutputPass());
  return { composer, gtaoPass: null, scenePass, outlinePass, vignettePass, tiltPass, bloomPass, gradingPass }; // gtaoPass dibuat malas (App.setAO)
}

/** Render target HDR composer + DepthTexture (ukuran fisik; diperbarui composer.setSize). */
function createComposerTarget(renderer) {
  const pr = renderer.getPixelRatio();
  const w = Math.max(1, Math.round(window.innerWidth * pr));
  const h = Math.max(1, Math.round(window.innerHeight * pr));
  const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(w, h) });
  target.texture.name = 'EffectComposer.rt1';
  return target;
}

/** Garis tepi tipis gelap (parameter dari RENDER). */
function createOutlinePass(camera, scenePass, pixelRatio) {
  const pass = new OutlinePass(camera, scenePass, {
    color: RENDER.outlineColor,
    intensity: RENDER.outlineIntensity,
    thickness: RENDER.outlineThickness,
    fadeStart: RENDER.outlineFadeStart,
    fadeEnd: RENDER.outlineFadeEnd,
    threshold: RENDER.outlineThreshold,
    softness: RENDER.outlineSoftness,
  });
  pass.setPixelRatio(pixelRatio);
  pass.enabled = RENDER.outline;
  return pass;
}

/** GTAO dengan radius skala dunia (meter) dan blend lembut. */
function createGtaoPass(GTAOPass, scene, camera) {
  const size = { w: window.innerWidth, h: window.innerHeight };
  const aoParams = {
    radius: RENDER.aoRadius,
    distanceFallOff: AO_DISTANCE_FALLOFF,
    samples: AO_SAMPLES,
    screenSpaceRadius: false,
  };
  const pass = new GTAOPass(scene, camera, size.w, size.h, undefined, aoParams);
  pass.output = GTAOPass.OUTPUT.Default;
  pass.blendIntensity = RENDER.aoBlend;
  return pass;
}

function createLabelRenderer() {
  const lr = new CSS2DRenderer();
  lr.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
  return lr;
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
