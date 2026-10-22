import * as THREE from 'three';
import { createAdaptiveResolution } from './adaptiveResolution.js';
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
const AO_SAMPLES = 12;            // sampel GTAO per piksel (default 16; lebih ringan)
const AO_DISTANCE_FALLOFF = 1.0;
const MINIMAP_BAKE_PX = 1536;      // resolusi peta dasar (±0,6 m/piksel untuk area region ±461 m)
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
    this.adaptive = createAdaptiveResolution({ ceiling: r, floor: ADAPTIVE_MIN_RATIO, targetMs: ADAPTIVE_TARGET_MS });
    this.#applyPixelRatio(r);
  }

  /** Aktifkan/nonaktifkan resolusi adaptif; saat nonaktif kembali ke batas atas dari pengaturan. */
  setAdaptiveResolution(on) {
    this.adaptiveOn = Boolean(on);
    if (!this.adaptiveOn && this.pixelCeiling && this.pixelRatio !== this.pixelCeiling) {
      this.adaptive = createAdaptiveResolution({ ceiling: this.pixelCeiling, floor: ADAPTIVE_MIN_RATIO, targetMs: ADAPTIVE_TARGET_MS });
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
    try {
      return r.compileAsync(this.view.scene, this.view.camera).then(() => {});
    } finally {
      r.setRenderTarget(prev);
    }
  }

  /** Mulai loop. makeContext(dt) mengembalikan ctx untuk semua updatable. */
  start(makeContext) {
    const loop = () => {
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
      const buf = new Uint8ClampedArray(px * px * 4);
      r.readRenderTargetPixels(target, 0, 0, px, px, buf);
      flipRowsInPlace(buf, px, px);
      const canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = px;
      canvas.getContext('2d').putImageData(new ImageData(buf, px, px), 0, 0);
      return canvas;
    } finally {
      r.setRenderTarget(null);
      r.setClearColor(clear, clearAlpha);
      this.scene.remove(light);
      this.scene.environment = keep.env;
      this.scene.fog = keep.fog;
      this.scene.background = keep.bg;
      target.dispose();
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
