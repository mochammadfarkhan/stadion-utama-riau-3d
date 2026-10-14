import { describe, it, expect } from 'vitest';
import { createSettingsStore } from '../src/settings/store.js';
import { bindSky, hourDelta } from '../src/ui/bindings/bindSky.js';
import { bindWeather } from '../src/ui/bindings/bindWeather.js';
import { bindGraphics, applyShadowQuality, SHADOW_MAP_SIZES } from '../src/ui/bindings/bindGraphics.js';
import { bindCamera } from '../src/ui/bindings/bindCamera.js';
import { bindAudio } from '../src/ui/bindings/bindAudio.js';
import { bindPerformance } from '../src/ui/bindings/bindPerformance.js';
import { bindAll } from '../src/ui/bindings/index.js';
import { createAudioBus } from '../src/core/AudioBus.js';
import { screenshotFilename } from '../src/ui/Screenshot.js';

/** App palsu: hanya daftar updatable + setter yang dicatat. */
function fakeApp() {
  const calls = [];
  const app = {
    updatables: [],
    minimapVisible: true,
    scene: {},
    camera: { fov: 60, updateProjectionMatrix: () => calls.push('proj') },
    addUpdatable(u) { app.updatables = [...app.updatables, u]; },
    removeUpdatable(u) { app.updatables = app.updatables.filter((x) => x !== u); },
    setExposure: (v) => calls.push(['exposure', v]),
    setPixelRatio: (v) => calls.push(['pr', v]),
    setAO: (v) => calls.push(['ao', v]),
    setVignette: (v) => calls.push(['vig', v]),
    tick(dt = 0.1) { for (const u of app.updatables) u.update(dt, {}); },
  };
  return { app, calls };
}

function fakeTime(hour = 16.5) {
  const t = {
    hour, speed: 0, over: {},
    setHour(h) { t.hour = h; },
    setSpeed(v) { t.speed = v; },
    setAzimuthOffset(v) { t.over = { ...t.over, az: v }; },
    setCloudCover(v) { t.over = { ...t.over, cc: v }; },
    setHaze(v) { t.over = { ...t.over, haze: v }; },
    setFogDistance(v) { t.over = { ...t.over, fog: v }; },
  };
  return t;
}

describe('bindSky', () => {
  it('store.hour -> time.setHour, dan abaikan delta kecil (anti loop)', () => {
    const store = createSettingsStore();
    const time = fakeTime(16.5);
    const { app } = fakeApp();
    const off = bindSky(store, { time, app });
    store.set('sky.hour', 20);
    expect(time.hour).toBe(20);
    time.hour = 20.004; // < 1/120 jam dari store
    store.set('sky.hour', 20.0033);
    expect(time.hour).toBe(20.004);
    off();
    store.set('sky.hour', 5);
    expect(time.hour).toBe(20.004);
    expect(app.updatables.length).toBe(0);
  });
  it('tulis-balik jam ke store tiap <=250 ms hanya saat advanceTime', () => {
    const store = createSettingsStore();
    const time = fakeTime(10);
    const { app } = fakeApp();
    bindSky(store, { time, app });
    time.hour = 11;
    app.tick(0.3);
    expect(store.get('sky.hour')).toBe(16.5); // jam berhenti: tidak ditulis
    store.set('sky.advanceTime', true);
    expect(time.speed).toBe(store.get('sky.timeSpeed'));
    app.tick(0.3);
    expect(store.get('sky.hour')).toBe(11);
    store.set('sky.timeSpeed', 1);
    expect(time.speed).toBe(1);
    store.set('sky.advanceTime', false);
    expect(time.speed).toBe(0);
  });
  it('override atmosfer & exposure diteruskan', () => {
    const store = createSettingsStore();
    const time = fakeTime();
    const { app, calls } = fakeApp();
    bindSky(store, { time, app });
    store.set('sky.azimuthOffset', 90);
    store.set('sky.cloudCover', 0.8);
    store.set('sky.haze', 6);
    store.set('sky.fogDistance', 500);
    store.set('sky.exposure', 1.2);
    expect(time.over).toEqual({ az: 90, cc: 0.8, haze: 6, fog: 500 });
    expect(calls.at(-1)).toEqual(['exposure', 1.2]);
  });
  it('hourDelta wrap 24', () => {
    expect(hourDelta(23.99, 0.01)).toBeCloseTo(0.02);
    expect(hourDelta(5, 7)).toBe(2);
  });
});

describe('bindWeather', () => {
  it('dua arah raining + parameter', () => {
    const store = createSettingsStore();
    const w = { isRaining: false, p: {}, setRaining(v) { w.isRaining = v; }, toggleRain() { w.isRaining = !w.isRaining; },
      setIntensity: (v) => { w.p = { ...w.p, i: v }; }, setWetness: (v) => { w.p = { ...w.p, w: v }; },
      setWind: (v) => { w.p = { ...w.p, wind: v }; }, setSoundEnabled: (v) => { w.p = { ...w.p, s: v }; } };
    const { app } = fakeApp();
    bindWeather(store, { weather: w, app });
    store.set('weather.raining', true);
    expect(w.isRaining).toBe(true);
    w.toggleRain();
    app.tick();
    expect(store.get('weather.raining')).toBe(false);
    store.set('weather.intensity', 0.5);
    store.set('weather.sound', false);
    expect(w.p).toMatchObject({ i: 0.5, s: false, w: 1, wind: 0.3 });
  });
});

describe('bindGraphics', () => {
  it('kualitas bayangan -> mapSize & dispose', () => {
    let disposed = 0;
    const sun = { castShadow: true, shadow: { mapSize: { set(w, h) { this.w = w; this.h = h; } }, map: { dispose: () => { disposed += 1; } } } };
    applyShadowQuality(sun, 'tinggi');
    expect(sun.shadow.mapSize.w).toBe(4096);
    expect(sun.shadow.map).toBeNull();
    expect(disposed).toBe(1);
    applyShadowQuality(sun, 'mati');
    expect(sun.castShadow).toBe(false);
    expect(SHADOW_MAP_SIZES.rendah).toBe(1024);
  });
  it('meneruskan ke App & Crowd', () => {
    const store = createSettingsStore();
    const { app, calls } = fakeApp();
    const crowd = { density: 1, setDensity(v) { crowd.density = v; } };
    bindGraphics(store, { app, lighting: { userData: { sun: null } }, crowd });
    store.set('graphics.pixelRatio', 1);
    store.set('graphics.ao', true);
    store.set('graphics.vignette', false);
    store.set('graphics.crowdDensity', 0.25);
    expect(calls).toContainEqual(['pr', 1]);
    expect(calls).toContainEqual(['ao', true]);
    expect(calls).toContainEqual(['vig', false]);
    expect(crowd.density).toBe(0.25);
  });
});

describe('bindCamera', () => {
  it('mode dua arah, fov, sensitivitas', () => {
    const store = createSettingsStore();
    const { app, calls } = fakeApp();
    const rig = { mode: 'third', sensitivity: 1, followSmoothing: 6, setMode(m) { rig.mode = m; } };
    const hud = { mode: null, setCameraMode(m) { hud.mode = m; } };
    bindCamera(store, { rig, camera: app.camera, hud, app });
    store.set('camera.mode', 'first');
    expect(rig.mode).toBe('first');
    expect(hud.mode).toBe('first');
    rig.mode = 'third';
    app.tick();
    expect(store.get('camera.mode')).toBe('third');
    store.set('camera.fov', 85);
    expect(app.camera.fov).toBe(85);
    expect(calls).toContain('proj');
    store.set('camera.sensitivity', 2);
    store.set('camera.followSmoothing', 10);
    expect(rig.sensitivity).toBe(2);
    expect(rig.followSmoothing).toBe(10);
  });
});

describe('bindAudio + AudioBus (tanpa AudioContext)', () => {
  it('no-op aman dan menyimpan level', () => {
    const bus = createAudioBus({ target: null });
    expect(bus.ensure()).toBeNull();
    expect(bus.channel('bell')).toBeNull();
    const store = createSettingsStore();
    bindAudio(store, { audioBus: bus });
    store.set('audio.master', 0.3);
    expect(bus.master).toBe(0.3);
    expect(bindAudio(store, { audioBus: null })).toBeTypeOf('function');
    bus.dispose();
  });
});

describe('bindPerformance', () => {
  it('stats/minimap/labels, minimap dua arah', () => {
    const store = createSettingsStore();
    const { app } = fakeApp();
    const hud = { stats: true, setStatsVisible(v) { hud.stats = v; } };
    const vendors = { labels: true, setLabelsEnabled(v) { vendors.labels = v; } };
    bindPerformance(store, { app, hud, vendors });
    store.set('performance.showStats', false);
    store.set('performance.labels', false);
    store.set('performance.minimap', false);
    expect(hud.stats).toBe(false);
    expect(vendors.labels).toBe(false);
    expect(app.minimapVisible).toBe(false);
    app.minimapVisible = true; // tombol M lama
    app.tick();
    expect(store.get('performance.minimap')).toBe(true);
  });
});

describe('bindAll', () => {
  it('bekerja dengan ctx minimal dan dispose membersihkan updatable', () => {
    const store = createSettingsStore();
    const { app } = fakeApp();
    const dispose = bindAll(store, { app, time: fakeTime() });
    expect(app.updatables.length).toBeGreaterThan(0);
    dispose();
    expect(app.updatables.length).toBe(0);
  });
});

describe('screenshotFilename', () => {
  it('format YYYYMMDD-HHMM', () => {
    expect(screenshotFilename(new Date(2026, 9, 13, 7, 5))).toBe('stadion-utama-riau-20261013-0705.png');
  });
});
