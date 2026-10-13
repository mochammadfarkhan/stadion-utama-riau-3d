import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

const MAX_DT = 0.05;
const MAX_PIXEL_RATIO = 1.5;
const MINIMAP_SIZE = 200;
const MINIMAP_MARGIN = 12;
const MINIMAP_HALF_EXTENT = 160;

/**
 * App: renderer, scene, kamera utama, minimap, loop waktu.
 * Modul lain mendaftar lewat addUpdatable({ update(dt, ctx) }).
 */
export class App {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 2500);
    this.renderer = createRenderer();
    this.labelRenderer = createLabelRenderer();
    this.minimapCamera = createMinimapCamera();
    this.timer = new THREE.Timer();
    this.updatables = [];
    this.minimapVisible = true;
    this.elapsed = 0;

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
    };
    this.renderer.setAnimationLoop(loop);
  }

  render(ctx) {
    const r = this.renderer;
    const w = window.innerWidth;
    const h = window.innerHeight;
    r.autoClear = false;
    r.clear();
    r.setViewport(0, 0, w, h);
    r.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    if (this.minimapVisible) this.renderMinimap(ctx, w);
  }

  renderMinimap(ctx, w) {
    const r = this.renderer;
    const focus = ctx?.bikePos ?? new THREE.Vector3();
    const x = w - MINIMAP_SIZE - MINIMAP_MARGIN;
    r.setScissorTest(true);
    r.setViewport(x, MINIMAP_MARGIN, MINIMAP_SIZE, MINIMAP_SIZE);
    r.setScissor(x, MINIMAP_MARGIN, MINIMAP_SIZE, MINIMAP_SIZE);
    r.clearDepth();
    this.minimapCamera.position.set(focus.x, 400, focus.z);
    this.minimapCamera.lookAt(focus.x, 0, focus.z);
    r.render(this.scene, this.minimapCamera);
    r.setScissorTest(false);
  }
}

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
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
  return cam;
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
