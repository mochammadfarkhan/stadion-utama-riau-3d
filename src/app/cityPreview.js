/**
 * Pratinjau kota (POV 'kota', tombol K): kamera helikopter isometrik di atas kota. Selama aktif, isi berat diganti
 * bentuk dasar murah: region streaming dilepas (tinggal proxy-nya), stadion persistent disembunyikan dan diganti
 * proxy satu mesh, entitas (sepeda, penonton, pelari) disembunyikan. Kabut dilonggarkan dan near/far kamera
 * mengikuti jarak agar kota tidak tertutup kabut/terpotong. Semua dipulihkan saat keluar.
 * Sistem 'cityPreview' (fase camera) mengikuti `rig.povId`, jadi tombol K, menu panel, dan Digit0/V semuanya bekerja.
 */
import { CITY } from '../core/cameraPresets.js';
import { nightFactor } from '../city/facade.js';
import { applyPlacement } from './mountRegion.js';
import { buildStadionProxy } from '../regions/stadion/proxy.js';
import { createCityLabels } from '../ui/CityLabels.js';
import { captureScreenshot, screenshotFilename } from '../ui/Screenshot.js';
import { createCityControls } from '../ui/CityControls.js';
import { TOUR, tourRoute, createTour, advanceHour } from './cityTour.js';

const FOG_PREVIEW = 9000;      // m: jarak kabut selama pratinjau (setelan "Jarak kabut" hanya sampai 2000)
const FOG_PER_DISTANCE = 14;     // fogDistance ≈ 14 × jarak kamera → awal kabut ≈ 1,8 × jarak: hanya cakrawala yang berkabut
const MAX_PREVIEW_PIXEL_RATIO = 1.5;
const SHADOW_EXTENT_RANGE = Object.freeze([200, 700]); // setengah lebar frustum bayangan (m): ikut jarak kamera agar bangunan di layar bersayangan
const LABEL_ZOOM = 0.4;       // zoom saat terbang ke landmark
const NEAR_RANGE = Object.freeze([0.3, 120]);
/** Gaya maket sore emas (pilihan user 2026-11-13): jam, tilt-shift kuat (pita tajam di tengah), bloom. */
const MAKET = Object.freeze({ hour: 16.75, band: 0.17, falloff: 0.3, radiusScale: 1.6 });
const AUDIO_STEP_S = 0.25;         // jeda pembaruan volume suara (setLevel memakai rampa, tak perlu tiap frame)
const PHOTO_SCALE = 2;          // foto Kota: resolusi ×2 (label & bar disembunyikan lewat body.is-photo)
const INTRO_ZOOM = 9;          // intro terbang: mulai dari ketinggian ini lalu menukik ke stadion
const INTRO_END_ZOOM = 0.9;
const HINT = 'Kota isometrik: WASD/seret geser · Q/Z putar · roda zoom (jauhkan untuk seluruh peta) · K keluar';

/**
 * @param {{app: object, rig: object, regions: object, time: object, store: object, hud: {toast: Function},
 *   city?: {setPreview(on: boolean): void}|null, lighting?: {userData: object}|null,
 *   landmarks?: Array<{id: string, label: string, x: number, z: number}>, stadionId: string, stadionPlacement: object, hide: Array<{visible: boolean}>}} opts
 *   hide: objek yang disembunyikan selama pratinjau (entitas dunia & entitas region)
 */
export function createCityPreview({ app, rig, regions, time, store, hud, city = null, lighting = null, audioBus = null, landmarks = [], stadionId, stadionPlacement, hide }) {
  const camera = app.camera;
  const base = { near: camera.near, far: camera.far };
  let active = false;
  let projected = false;
  let proxy = null;
  let saved = null;
  let fogSet = FOG_PREVIEW;
  let styleCap = Infinity; // batas pixel ratio gaya grafis sebelum pratinjau
  let shadowSaved = null;
  let maketSaved = null;       // keadaan sebelum gaya maket (jam, tilt-shift, bloom)
  let sound = null;            // { hum, wind } loop suara ambient
  let audioClock = 0;
  const light = lighting?.userData ?? {};
  const labels = createCityLabels(document.body, {
    landmarks, onSelect: (l) => rig.director.flyTo(l.x, l.z, LABEL_ZOOM),
  });

  let tour = null;     // pewaktu tur landmark (null = mati)
  let lapse = false;   // time-lapse: jam berjalan cepat
  const controls = createCityControls(document.body, {
    onHour: (h) => time.setHour(h),
    onTour: (on) => { tour = on ? createTour(tourRoute(landmarks)) : null; },
    onLapse: (on) => { lapse = on; },
    onPhoto: () => { captureScreenshot(app, { scale: PHOTO_SCALE, filename: screenshotFilename() }); },
  });

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

  /** Gaya maket: jam sore emas, tilt-shift kuat, bloom; keadaan lama disimpan untuk dipulihkan. */
  const applyMaket = () => {
    const tilt = app.post?.tiltPass;
    if (!tilt) return;
    const u = tilt.mix.material.uniforms;
    maketSaved = { hour: time.hour, tilt: tilt.enabled, band: u.band.value, falloff: u.falloff.value, radius: tilt.radius, bloom: app.post.bloomPass?.enabled ?? false };
    time.setHour(MAKET.hour);
    u.band.value = MAKET.band;
    u.falloff.value = MAKET.falloff;
    tilt.radius = maketSaved.radius * MAKET.radiusScale;
    app.setTiltShift?.(true);
    app.setBloom?.(true);
  };

  const restoreMaket = () => {
    if (!maketSaved) return;
    const tilt = app.post.tiltPass;
    const u = tilt.mix.material.uniforms;
    u.band.value = maketSaved.band;
    u.falloff.value = maketSaved.falloff;
    tilt.radius = maketSaved.radius;
    app.setTiltShift?.(maketSaved.tilt);
    app.setBloom?.(maketSaved.bloom);
    time.setHour(maketSaved.hour);
    maketSaved = null;
  };

  const startSound = () => {
    sound = { hum: audioBus.startCityHum?.({ channel: 'ambience', level: 0 }), wind: audioBus.startWind?.({ channel: 'ambience', level: 0 }) };
  };

  const stopSound = () => {
    sound?.hum?.stop();
    sound?.wind?.stop();
    sound = null;
  };

  /** Volume menurut ketinggian: dekat = dengung kota, tinggi = angin; malam lebih sepi. */
  const updateSound = (dist, dt) => {
    audioClock += dt;
    if (!sound || audioClock < AUDIO_STEP_S) return;
    audioClock = 0;
    const high = Math.min(1, Math.max(0, (dist - 200) / 9000));
    const night = nightFactor(time.hour);
    sound.hum?.setLevel((0.62 * (1 - 0.85 * high) + 0.04) * (1 - 0.45 * night), 0.5);
    sound.wind?.setLevel(0.1 + 0.55 * high, 0.5);
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
    if (store.get('camera.kotaMaket')) applyMaket();
    if (store.get('camera.kotaSuara') && audioBus) startSound();
    document.body.classList.add('is-city-preview');
    labels.setVisible(true);
    controls.setVisible(true);
    shadowSaved = light.getShadowExtent?.() ?? null;
    if (light.clouds) light.clouds.visible = false; // kubah awan (±2,2 km) menutupi kota di luar radiusnya dengan kerudung putih
    hud.toast(HINT, true);
    const home = landmarks.find((l) => l.id === stadionId) ?? landmarks[0];
    if (home && store.get('camera.kotaIntro')) {
      rig.director.zoom = INTRO_ZOOM;
      rig.director.flyTo(home.x, home.z, INTRO_END_ZOOM);
    }
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
    document.body.classList.remove('is-city-preview');
    restoreMaket();
    stopSound();
    labels.setVisible(false);
    controls.setVisible(false);
    controls.reset();
    tour = null;
    lapse = false;
    if (light.clouds) light.clouds.visible = true;
    if (shadowSaved != null) { light.setShadowExtent?.(shadowSaved); shadowSaved = null; }
    app.setPixelCap?.(styleCap);
    app.setPixelRatio?.(store.get('graphics.pixelRatio'));
    app.setAdaptiveResolution?.(Boolean(store.get('graphics.adaptiveResolution')));
  };

  /** near/far mengikuti jarak ke titik pandang selama pratinjau & transisinya; default dipulihkan setelah itu. */
  const updateProjection = (dt) => {
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
      const extent = Math.min(SHADOW_EXTENT_RANGE[1], Math.max(SHADOW_EXTENT_RANGE[0], dist * 0.55));
      if (Math.abs(extent - (light.getShadowExtent?.() ?? extent)) / extent > 0.1) light.setShadowExtent?.(extent);
      labels.update(camera, dist);
      updateSound(dist, dt);
      proxy?.setNight(nightFactor(time.hour)); // lampu sorot proxy stadion menyala malam
      if (lapse) time.setHour(advanceHour(time.hour, dt));
      controls.setHour(time.hour);
      const stop = tour?.step(dt);
      if (stop) rig.director.flyTo(stop.x, stop.z, TOUR.zoom);
    }
  };

  app.addSystem({
    id: 'cityPreview',
    phase: 'camera',
    update: (dt) => {
      const on = rig.povId === CITY.id;
      if (on !== active) (on ? enter : exit)();
      updateProjection(dt);
    },
  });

  return {
    get active() { return active; },
    dispose() {
      if (active) exit();
      app.removeSystem('cityPreview');
      labels.dispose();
      controls.dispose();
      stopSound();
      if (proxy) {
        proxy.group.removeFromParent();
        proxy.dispose();
        proxy = null;
      }
    },
  };
}
