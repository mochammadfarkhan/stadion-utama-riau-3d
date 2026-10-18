import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { appViewPort } from '../../src/app/appView.js';

function fakeApp(extra = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 2, 0.3, 2500);
  const scenePass = { scene, camera };
  return {
    scene, camera, scenePass,
    post: { composer: { passes: [scenePass, {}] }, outlinePass: { camera }, gtaoPass: null },
    labelRenderer: { domElement: { style: { visibility: '' } } },
    ...extra,
  };
}

describe('appViewPort', () => {
  it('tanpa App.setView: pass adegan & outline memakai scene/kamera interior lalu pulih', () => {
    const app = fakeApp();
    const view = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(70, 1, 0.05, 50) };
    const port = appViewPort(app);
    port.setView(view);
    expect(app.scenePass.scene).toBe(view.scene);
    expect(app.scenePass.camera).toBe(view.camera);
    expect(app.post.outlinePass.camera).toBe(view.camera);
    expect(view.camera.aspect).toBe(2);
    expect(app.labelRenderer.domElement.style.visibility).toBe('hidden');
    port.setView(null);
    expect(app.scenePass.scene).toBe(app.scene);
    expect(app.scenePass.camera).toBe(app.camera);
    expect(app.post.outlinePass.camera).toBe(app.camera);
    expect(app.labelRenderer.domElement.style.visibility).toBe('');
  });

  it('dengan App.setView (M5): diteruskan apa adanya', () => {
    const setView = vi.fn();
    const app = fakeApp({ setView });
    const view = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() };
    appViewPort(app).setView(view);
    expect(setView).toHaveBeenCalledWith(view);
    expect(app.scenePass.scene).toBe(app.scene);
  });
});
