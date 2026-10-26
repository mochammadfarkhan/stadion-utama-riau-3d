import { FPS_CAP } from '../../config/quality.js';

/**
 * Binding grup "performance" (store -> HUD/App/VendorGroup). fpsCap → App.setFrameCap (30 / 60 / tanpa batas).
 * performance.minimap dua arah: tombol M lama (app.minimapVisible) disamakan ke store tiap frame.
 */

/**
 * @param {object} store
 * @param {{ app: object, hud?: object, vendors?: object }} ctx
 * @returns {() => void} unsubscribe
 */
export function bindPerformance(store, { app, hud = null, vendors = null }) {
  const unsubs = [
    store.bind('performance.showStats', (v) => hud?.setStatsVisible?.(v)),
    store.bind('performance.minimap', (v) => { app.minimapVisible = Boolean(v); }),
    store.bind('performance.labels', (v) => vendors?.setLabelsEnabled?.(v)),
    store.bind('performance.fpsCap', (v) => app.setFrameCap?.(FPS_CAP[v] ?? 60)),
  ];
  const sync = {
    update() {
      if (app.minimapVisible !== store.get('performance.minimap')) store.set('performance.minimap', app.minimapVisible);
    },
  };
  app.addUpdatable?.(sync);
  return () => {
    for (const u of unsubs) u();
    app.removeUpdatable?.(sync);
  };
}
