/**
 * Pratinjau kota (POV 'kota', tombol K): kamera helikopter isometrik di atas kota. Selama aktif, isi berat diganti
 * bentuk dasar murah: region streaming dilepas (tinggal proxy-nya), stadion persistent disembunyikan dan diganti
 * proxy satu mesh, entitas (sepeda, penonton, pelari) disembunyikan. Kabut dilonggarkan dan near/far kamera
 * mengikuti jarak agar kota tidak tertutup kabut/terpotong. Semua dipulihkan saat keluar.
 * Sistem 'cityPreview' (fase camera) mengikuti `rig.povId`, jadi tombol K, menu panel, dan Digit0/V semuanya bekerja.
 */
import { CITY } from '../core/cameraPresets.js';
import { applyPlacement } from './mountRegion.js';
import { buildStadionProxy } from '../regions/stadion/proxy.js';

const FOG_PREVIEW = 9000;      // m: jarak kabut selama pratinjau (setelan "Jarak kabut" hanya sampai 2000)
const FOG_PER_DISTANCE = 9;      // fogDistance ≈ 9 × jarak kamera → awal kabut (0,16 × fogDistance) di belakang titik pandang
const MAX_PREVIEW_PIXEL_RATIO = 1.5;
const NEAR_RANGE = Object.freeze([0.3, 120]);
const HINT = 'Kota isometrik: WASD/seret geser · Q/Z putar · roda zoom (jauhkan untuk seluruh peta) · K keluar';

/**
 * @param {{app: object, rig: object, regions: object, time: object, store: object, hud: {toast: Function},
 *   city?: {setPreview(on: boolean): void}|null, stadionId: string, stadionPlacement: object, hide: Array<{visible: boolean}>}} opts
 *   hide: objek yang disembunyikan selama pratinjau (entitas dunia & entitas region)
 */
export function createCityPreview({ app, rig, regions, time, store, hud, city = null, stadionId, stadionPlacement, hide }) {
  const camera = app.camera;
  const base = { near: camera.near, far: camera.far };
  let active = false;
  let projected = false;
  let proxy = null;
  let saved = null;
  let fogSet = FOG_PREVIEW;
  let styleCap = Infinity; // batas pixel ratio gaya grafis sebelum pratinjau

  const stadionGroup = () => regions.handleOf(stadionId)?.region?.group ?? null;

  const ensureProxy = () => {
    if (proxy) return proxy;
    try {
      proxy = buildStadionProxy();
      applyPlacement(proxy.group, stadionPlacement);
      app.scene.add(proxy.group);
    } catch (err) {
      console.error('Proxy stadion gagal dibuat (stadion asli disembunyikan saja):', err);
      proxy = null;
    }
    return proxy;
  };

  const enter = () => {
    active = true;
    regions.setHold(true);
    const g = stadionGroup();
    if (g) g.visible = false;
    const p = ensureProxy();
    if (p) p.group.visible = true;
    styleCap = app.pixelCap ?? Infinity;
    saved = { hidden: hide.map((o) => o.visible), fogLimit: time.fogLimit, fogDistance: store.get('sky.fogDistance') };
    for (const o of hide) o.visible = false;
    time.setFogLimit(Infinity);
    time.setFogDistance(FOG_PREVIEW);
    fogSet = FOG_PREVIEW;
    city?.setPreview(true); // semua tile peta dimuat (LOD0), tanah dasar diperluas
    // Resolusi penuh: adegan pratinjau ringan, dan skala render < 1 membuat atap/jalan buram & bergerigi dari atas.
    app.setPixelCap?.(Infinity);
    app.setPixelRatio?.(Math.min(window.devicePixelRatio || 1, MAX_PREVIEW_PIXEL_RATIO));
    app.setAdaptiveResolution?.(false);
    hud.toast(HINT, true);
  };

  const exit = () => {
    active = false;
    regions.setHold(false);
    const g = stadionGroup();
    if (g) g.visible = true;
    if (proxy) proxy.group.visible = false;
    if (saved) {
      hide.forEach((o, i) => { o.visible = saved.hidden[i]; });
      time.setFogLimit(saved.fogLimit);
      time.setFogDistance(saved.fogDistance);
      saved = null;
    }
    city?.setPreview(false);
    app.setPixelCap?.(styleCap);
    app.setPixelRatio?.(store.get('graphics.pixelRatio'));
    app.setAdaptiveResolution?.(Boolean(store.get('graphics.adaptiveResolution')));
  };

  /** near/far mengikuti jarak ke titik pandang selama pratinjau & transisinya; default dipulihkan setelah itu. */
  const updateProjection = () => {
    const engaged = active || (projected && rig.director.transitioning);
    if (!engaged) {
      if (projected) {
        camera.near = base.near; camera.far = base.far; camera.updateProjectionMatrix();
        projected = false;
      }
      return;
    }
    const dist = camera.position.distanceTo(rig.focus);
    const near = Math.min(NEAR_RANGE[1], Math.max(NEAR_RANGE[0], dist * 0.04));
    const far = Math.max(base.far, dist * 3.2);
    if (Math.abs(near - camera.near) / camera.near > 0.02 || Math.abs(far - camera.far) / camera.far > 0.02) {
      camera.near = near; camera.far = far; camera.updateProjectionMatrix();
    }
    projected = true;
    if (active) { // kabut ikut jarak: zoom jauh (seluruh peta) tidak boleh tenggelam dalam kabut
      const fog = Math.max(FOG_PREVIEW, dist * FOG_PER_DISTANCE);
      if (Math.abs(fog - fogSet) / fogSet > 0.05) { fogSet = fog; time.setFogDistance(fog); }
    }
  };

  app.addSystem({
    id: 'cityPreview',
    phase: 'camera',
    update: () => {
      const on = rig.povId === CITY.id;
      if (on !== active) (on ? enter : exit)();
      updateProjection();
    },
  });

  return {
    get active() { return active; },
    dispose() {
      if (active) exit();
      app.removeSystem('cityPreview');
      if (proxy) {
        proxy.group.removeFromParent();
        proxy.dispose();
        proxy = null;
      }
    },
  };
}
