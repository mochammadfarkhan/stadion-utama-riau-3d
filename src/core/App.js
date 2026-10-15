import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { RENDER, RENDER_LAYERS } from '../config/constants.js';
import { DepthRenderPass, OutlinePass } from './postprocessing/OutlinePass.js';

const MAX_DT = 0.05;
const MAX_PIXEL_RATIO = RENDER.pixelRatio;
const AO_SAMPLES = 12;            // sampel GTAO per piksel (default 16; lebih ringan)
const AO_DISTANCE_FALLOFF = 1.0;
const MINIMAP_SIZE = 200;
const MINIMAP_MARGIN = 12;
const MINIMAP_HALF_EXTENT = 160;
const MINIMAP_HEIGHT = 400;
const MINIMAP_INTERVAL = 2;        // minimap dirender ulang tiap N frame
const MINIMAP_MARKER_RADIUS = 4;   // meter (lingkaran merah posisi sepeda)
const MINIMAP_MARKER_Y = 150;      // di atas atap stadion
const MINIMAP_MARKER_COLOR = 0xe53935;

/**
 * App: renderer, scene, kamera utama, post-processing, minimap, loop waktu.
 * Modul lain mendaftar lewat addUpdatable({ update(dt, ctx) }).
 * Render utama lewat EffectComposer (RenderPass -> GTAO -> Outline -> Vignette -> OutputPass;
 * tone mapping + sRGB hanya di OutputPass), lalu label CSS2D, lalu minimap.
 * Minimap hanya merender objek di RENDER_LAYERS.minimap, ke render target
 * tiap MINIMAP_INTERVAL frame, lalu di-blit ke pojok layar setiap frame.
 */
export class App {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 2500);
    this.renderer = createRenderer();
    this.labelRenderer = createLabelRenderer();
    this.minimapCamera = createMinimapCamera();
    this.minimapMarker = createMinimapMarker();
    this.minimapTarget = createMinimapTarget(this.renderer.getPixelRatio());
    this.minimapBlit = createBlit(this.minimapTarget.texture);
    this.post = createComposer(this.renderer, this.scene, this.camera);
    this.timer = new THREE.Timer();
    this.updatables = [];
    this.minimapVisible = true;
    this.elapsed = 0;
    this.frame = 0;
    this.lastCtx = null;              // ctx frame terakhir (dipakai renderFrame untuk screenshot)
    this.baseExposure = RENDER.exposure; // dari preset TimeOfDay (ditulis tiap frame)
    this.exposureScale = 1;           // pengali dari settings (sky.exposure / RENDER.exposure)

    this.scene.add(this.minimapMarker);
    container.appendChild(this.renderer.domElement);
    document.body.appendChild(this.labelRenderer.domElement);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  addUpdatable(obj) {
    if (obj && typeof obj.update === 'function') this.updatables.push(obj);
    return obj;
  }

  /** Hapus updatable yang didaftarkan lewat addUpdatable (salinan baru, tanpa mutasi array). */
  removeUpdatable(obj) {
    this.updatables = this.updatables.filter((u) => u !== obj);
  }

  /** Aktif/nonaktifkan ambient occlusion saat runtime (mis. bila FPS rendah). */
  setAO(enabled) {
    this.post.gtaoPass.enabled = Boolean(enabled);
    return this.post.gtaoPass.enabled;
  }

  get aoEnabled() {
    return this.post.gtaoPass.enabled;
  }

  /** Aktif/nonaktifkan pass vignette. */
  setVignette(enabled) {
    this.post.vignettePass.enabled = Boolean(enabled);
    return this.post.vignettePass.enabled;
  }

  get vignetteEnabled() {
    return this.post.vignettePass.enabled;
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
    const r = Number(ratio);
    if (!Number.isFinite(r) || r <= 0) return;
    this.renderer.setPixelRatio(r);
    this.post.composer.setPixelRatio(r); // resize() di bawah memakai rasio baru
    this.minimapTarget.setSize(Math.round(MINIMAP_SIZE * r), Math.round(MINIMAP_SIZE * r));
    this.resize();
  }

  get pixelRatio() {
    return this.renderer.getPixelRatio();
  }

  resize() {
    // min 1 px: jendela tersembunyi (0×0) tidak boleh membuat target/depthTexture berukuran nol
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.post.outlinePass.setPixelRatio(pr);
    this.post.composer.setSize(w, h); // ukuran efektif (+ depthTexture) ke semua target & pass // GTAO dihitung pada resolusi lebih rendah (RENDER.aoScale)
    this.post.gtaoPass.setSize(Math.round(w * pr * RENDER.aoScale), Math.round(h * pr * RENDER.aoScale));
    this.labelRenderer.setSize(w, h);
  }

  /** Satu updatable yang melempar tidak boleh menghentikan updatable lain maupun render. */
  #safeUpdate(u, dt, ctx) {
    try {
      u.update(dt, ctx);
    } catch (err) {
      console.error('Updatable dinonaktifkan karena error:', err);
      this.removeUpdatable(u);
    }
  }

  /** Mulai loop. makeContext(dt) mengembalikan ctx untuk semua updatable. */
  start(makeContext) {
    const loop = () => {
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), MAX_DT);
      this.elapsed += dt;
      const ctx = makeContext(dt, this.elapsed);
      this.lastCtx = ctx;
      for (const u of this.updatables) this.#safeUpdate(u, dt, ctx);
      this.render(ctx);
      this.frame += 1;
    };
    this.renderer.setAnimationLoop(loop);
  }

  /** Render satu frame tanpa memajukan simulasi (screenshot). */
  renderFrame() {
    this.render(this.lastCtx);
  }

  render(ctx) {
    const r = this.renderer;
    const w = window.innerWidth;
    const h = window.innerHeight;
    r.autoClear = false;
    r.info.reset(); // info.render dihitung per frame (semua pass), bukan per pass
    r.shadowMap.needsUpdate = true; // satu shadow pass per frame (hanya untuk kamera utama)
    r.setViewport(0, 0, w, h);
    this.post.composer.render(); // pass pertama membersihkan buffer; OutputPass menulis ke layar
    this.labelRenderer.render(this.scene, this.camera);
    if (this.minimapVisible) this.renderMinimap(ctx, w);
  }

  renderMinimap(ctx, w) {
    const r = this.renderer;
    const focus = ctx?.bikePos ?? new THREE.Vector3();
    this.minimapMarker.position.set(focus.x, MINIMAP_MARKER_Y, focus.z);
    if (this.frame % MINIMAP_INTERVAL === 0) this.renderMinimapToTarget(focus);
    const x = w - MINIMAP_SIZE - MINIMAP_MARGIN;
    r.setScissorTest(true);
    r.setViewport(x, MINIMAP_MARGIN, MINIMAP_SIZE, MINIMAP_SIZE);
    r.setScissor(x, MINIMAP_MARGIN, MINIMAP_SIZE, MINIMAP_SIZE);
    r.clearDepth();
    r.render(this.minimapBlit.scene, this.minimapBlit.camera);
    r.setScissorTest(false);
  }

  /** Render tampak atas (layer minimap saja) ke render target. */
  renderMinimapToTarget(focus) {
    const r = this.renderer;
    this.minimapCamera.position.set(focus.x, MINIMAP_HEIGHT, focus.z);
    this.minimapCamera.lookAt(focus.x, 0, focus.z);
    const fog = this.scene.fog; // tanpa kabut agar peta tidak pudar
    this.scene.fog = null;
    r.setRenderTarget(this.minimapTarget);
    r.clear();
    r.render(this.scene, this.minimapCamera);
    r.setRenderTarget(null);
    this.scene.fog = fog;
  }
}

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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
 * @returns {{composer: EffectComposer, gtaoPass: GTAOPass, outlinePass: OutlinePass, vignettePass: ShaderPass}}
 */
function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer, createComposerTarget(renderer));
  const scenePass = new DepthRenderPass(scene, camera);
  composer.addPass(scenePass);
  const gtaoPass = createGtaoPass(scene, camera);
  composer.addPass(gtaoPass);
  const outlinePass = createOutlinePass(camera, scenePass, renderer.getPixelRatio());
  composer.addPass(outlinePass);
  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.uniforms.offset.value = RENDER.vignetteOffset;
  vignettePass.uniforms.darkness.value = RENDER.vignetteDarkness;
  vignettePass.enabled = RENDER.vignette;
  composer.addPass(vignettePass);
  composer.addPass(new OutputPass());
  return { composer, gtaoPass, outlinePass, vignettePass };
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
function createGtaoPass(scene, camera) {
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
  pass.enabled = RENDER.ao;
  return pass;
}

function createLabelRenderer() {
  const lr = new CSS2DRenderer();
  lr.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
  return lr;
}

function createMinimapCamera() {
  const e = MINIMAP_HALF_EXTENT;
  const cam = new THREE.OrthographicCamera(-e, e, e, -e, 1, 800);
  cam.up.set(0, 0, -1);
  cam.layers.set(RENDER_LAYERS.minimap);
  return cam;
}

/** Lingkaran merah penanda sepeda; hanya tampil di minimap (layer minimap). */
function createMinimapMarker() {
  const geo = new THREE.CircleGeometry(MINIMAP_MARKER_RADIUS, 16).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: MINIMAP_MARKER_COLOR, depthTest: false, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'minimapMarker';
  mesh.renderOrder = 999;
  mesh.frustumCulled = false;
  mesh.layers.set(RENDER_LAYERS.minimap);
  return mesh;
}

/** Render target HDR untuk minimap (tone mapping diterapkan saat blit). */
function createMinimapTarget(pixelRatio) {
  const size = Math.round(MINIMAP_SIZE * pixelRatio);
  return new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, stencilBuffer: false });
}

/** Scene kecil berisi quad layar penuh untuk menyalin tekstur minimap ke viewport. */
function createBlit(texture) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture, fog: false })));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { scene, camera };
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
