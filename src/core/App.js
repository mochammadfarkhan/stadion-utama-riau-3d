import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RENDER_LAYERS } from '../config/constants.js';

const MAX_DT = 0.05;
const MAX_PIXEL_RATIO = 1.25;
const MINIMAP_SIZE = 200;
const MINIMAP_MARGIN = 12;
const MINIMAP_HALF_EXTENT = 160;
const MINIMAP_HEIGHT = 400;
const MINIMAP_INTERVAL = 2;        // minimap dirender ulang tiap N frame
const MINIMAP_MARKER_RADIUS = 4;   // meter (lingkaran merah posisi sepeda)
const MINIMAP_MARKER_Y = 150;      // di atas atap stadion
const MINIMAP_MARKER_COLOR = 0xe53935;

/**
 * App: renderer, scene, kamera utama, minimap, loop waktu.
 * Modul lain mendaftar lewat addUpdatable({ update(dt, ctx) }).
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
    this.timer = new THREE.Timer();
    this.updatables = [];
    this.minimapVisible = true;
    this.elapsed = 0;
    this.frame = 0;

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

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  /** Mulai loop. makeContext(dt) mengembalikan ctx untuk semua updatable. */
  start(makeContext) {
    const loop = () => {
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), MAX_DT);
      this.elapsed += dt;
      const ctx = makeContext(dt, this.elapsed);
      for (const u of this.updatables) u.update(dt, ctx);
      this.render(ctx);
      this.frame += 1;
    };
    this.renderer.setAnimationLoop(loop);
  }

  render(ctx) {
    const r = this.renderer;
    const w = window.innerWidth;
    const h = window.innerHeight;
    r.autoClear = false;
    r.info.reset(); // info.render dihitung per frame (semua pass), bukan per pass
    r.shadowMap.needsUpdate = true; // satu shadow pass per frame (hanya untuk kamera utama)
    r.clear();
    r.setViewport(0, 0, w, h);
    r.render(this.scene, this.camera);
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
    r.setRenderTarget(this.minimapTarget);
    r.clear();
    r.render(this.scene, this.minimapCamera);
    r.setRenderTarget(null);
  }
}

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // dipicu manual lewat needsUpdate sekali per frame
  renderer.info.autoReset = false;       // di-reset manual di App.render agar statistik per frame
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.75;
  return renderer;
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
