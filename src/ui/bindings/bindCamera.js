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
    if (typeof rig.setBaseFov === 'function') rig.setBaseFov(fov); // dipulihkan setelah POV
    else {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  on('camera.angledLockYaw', (v) => { rig.angledLockYaw = Boolean(v); });
  on('camera.angledDistance', (v) => { if (Math.abs((rig.angledDistance ?? v) - v) > 1e-6) rig.setAngledDistance?.(v); });
  on('camera.sensitivity', (v) => { rig.sensitivity = v; });
  on('camera.followSmoothing', (v) => { rig.followSmoothing = v; });

  const sync = {
    update() {
      if (rig.mode !== store.get('camera.mode')) store.set('camera.mode', rig.mode);
      // Roda mouse mengubah jarak di rig: tulis balik ke pengaturan (dibulatkan skema) bila bergeser cukup jauh.
      if (rig.angledDistance !== undefined && Math.abs(rig.angledDistance - store.get('camera.angledDistance')) > 0.3) {
        const stored = store.get('camera.angledDistance');
        if (store.set('camera.angledDistance', rig.angledDistance) === false) rig.angledDistance = stored;
      }
    },
  };
  app?.addUpdatable?.(sync);

  return () => {
    for (const u of unsubs) u();
    app?.removeUpdatable?.(sync);
  };
}
