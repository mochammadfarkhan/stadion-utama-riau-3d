/**
 * Binding grup "camera" (store -> CameraRig/kamera). camera.mode dua arah:
 * store -> rig.setMode, dan bila rig.mode berubah di luar store (toggleMode),
 * disamakan ke store tiap frame.
 */

/**
 * @param {object} store
 * @param {{ rig: object, camera: object, hud?: object, app?: object }} ctx
 * @returns {() => void} unsubscribe
 */
export function bindCamera(store, { rig, camera, hud = null, app = null }) {
  const unsubs = [];
  const on = (key, fn) => unsubs.push(store.bind(key, fn));

  on('camera.mode', (mode) => {
    if (rig.mode !== mode) rig.setMode(mode);
    hud?.setCameraMode?.(rig.mode);
  });
  on('camera.fov', (fov) => {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  });
  on('camera.sensitivity', (v) => { rig.sensitivity = v; });
  on('camera.followSmoothing', (v) => { rig.followSmoothing = v; });

  const sync = {
    update() {
      if (rig.mode !== store.get('camera.mode')) store.set('camera.mode', rig.mode);
    },
  };
  app?.addUpdatable?.(sync);

  return () => {
    for (const u of unsubs) u();
    app?.removeUpdatable?.(sync);
  };
}
