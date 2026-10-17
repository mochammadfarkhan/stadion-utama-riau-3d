/**
 * Siklus waktu: menerapkan preset pencahayaan (sim/dayCycle.js) ke matahari,
 * hemisphere, kabut, Sky, exposure, env map, bintang, dan lampu malam tiap frame.
 * Nilai ditulis absolut setiap frame sehingga modul Weather (dijalankan sesudahnya)
 * boleh mengalikannya tanpa akumulasi.
 *
 * Override dari settings (diterapkan SETELAH preset, tiap frame):
 * - haze          -> turbidity = preset.skyTurbidity + (haze - HAZE_DEFAULT), min 1 (offset)
 * - cloudCover    -> cloudCoverage dasar (Weather melerapkannya ke nilai hujan)
 * - fogDistance   -> fog.far = preset.fogFar * (fogDistance / FOG_DEFAULT), near proporsional (pengali)
 * - exposure      -> App.baseExposure = preset.exposure; pengali disimpan lewat App.setExposure
 * - azimuthOffset -> arah matahari diputar pada sumbu Y (derajat) sebelum dipakai
 */
import * as THREE from 'three';
import { DAY, WEATHER } from '../config/constants.js';
import {
  createDayState, stepDay, setDayHour, sunFromHour, lightingPreset,
  presetNameForHour, nextPresetAfter, sunMoonWeight, PRESET_HOURS,
} from '../sim/dayCycle.js';
import { directionFromAngles } from './Lighting.js';
import { createNightLights } from './TimeOfDay.lights.js';
import { createCelestialBodies, celestialLook } from './CelestialBodies.js';
import { disposeTree } from '../engine/disposeTree.js';

const MOON_ELEVATION_DEG = 48;
const MOON_AZIMUTH_DEG = 120;
const MOON_SHADOW_STRENGTH = 0.45;  // kekuatan bayangan saat sumber cahaya = bulan (matahari = 1)
const MOON_MAX_INTENSITY = 0.6;    // intensitas cahaya bulan (cahaya arah saat matahari di bawah horizon)
const HORIZON_FADE_DEG = 6;        // matahari memudar menjelang terbenam (hindari bayangan datar ekstrem)
const ENV_MIN_FACTOR = 0.15;       // environmentIntensity malam ≈ 0.12 × 0.15 ≈ 0.02
const STAR_RADIUS = 1800;
const STAR_MIN_Y = 0.06;
const STAR_SIZE = 2.2;
const STAR_CLOUD_DIM = 0.9;        // cloudCover 1 → bintang tinggal 10%
const STAR_FADE_DEG = 8;           // bintang penuh saat matahari ≥ 8° di bawah horizon
const HAZE_DEFAULT = 2.5;          // nilai haze settings yang berarti "sama dengan preset"
const FOG_DEFAULT = 1100;          // nilai fogDistance settings yang berarti "sama dengan preset"
const TURBIDITY_MIN = 1;

const _sunDir = new THREE.Vector3();
const _lightDir = new THREE.Vector3();
const _moonDir = directionFromAngles(MOON_ELEVATION_DEG, MOON_AZIMUTH_DEG);

/**
 * Jarak kabut efektif: far dibatasi `limit` (radius muat tile kota) agar batas muat tidak terlihat;
 * near diskalakan dengan rasio yang sama sehingga gradasi kabut tetap proporsional. Murni.
 */
export function fogRange(near, far, limit = Infinity) {
  if (!(far > limit)) return { near, far };
  const k = limit / far;
  return { near: near * k, far: limit };
}

/** Kubah bintang sederhana (Points) yang mengikuti kamera; hanya tampak malam. */
function createStars(count) {
  const pos = new Float32Array(count * 3);
  let seed = 1234;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i += 1) {
    const y = STAR_MIN_Y + (1 - STAR_MIN_Y) * rnd();
    const r = Math.sqrt(1 - y * y);
    const th = rnd() * Math.PI * 2;
    pos.set([r * Math.cos(th) * STAR_RADIUS, y * STAR_RADIUS, r * Math.sin(th) * STAR_RADIUS], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xe8efff, size: STAR_SIZE, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(geo, mat);
  stars.name = 'bintang';
  stars.frustumCulled = false;
  stars.visible = false;
  return stars;
}

/**
 * @param {THREE.Group} lightingGroup hasil createLighting (userData: sun, hemi, sky, ...)
 * Lampu milik region (PJU, floodlight, lensa) didaftarkan lewat registerLamps() (koordinat dunia).
 * @returns {{group: THREE.Group, update(dt, ctx, bikeState?):void, registerLamps(opts):() => boolean, registerEmissive(root):() => boolean,
 *   unregisterEmissive(root):boolean, setHour(h):void, nextPreset():string, toggleSpeed():boolean,
 *   setSpeed(v):void, setAzimuthOffset(deg):void, setCloudCover(v):void, setHaze(v):void, setFogDistance(m):void, setFogLimit(m):void, fogLimit:number,
 *   dispose():void, hour:number, presetName:string, speed:number, preset:object, overrides:object}}
 */
export function createTimeOfDay(lightingGroup, scene, renderer, app) {
  const L = lightingGroup.userData;
  let state = createDayState();
  let preset = lightingPreset(state.hour);
  let lastDirHour = NaN;
  let envBucket = -1;
  let envTimer = DAY.envRebuildInterval;
  let fogLimit = Infinity; // radius muat kota (setFogLimit); Infinity = tanpa batas
  // Semua objek siklus waktu di grup sendiri (pemanggil menambahkannya ke scene), bukan langsung ke scene.
  const group = new THREE.Group();
  group.name = 'siklusWaktu';
  const stars = createStars(DAY.starCount);
  group.add(stars);
  const bodies = createCelestialBodies();
  group.add(bodies.group);
  const night = createNightLights(group);
  // Override settings (lihat komentar modul); objek baru tiap perubahan (immutable).
  let over = Object.freeze({ azimuthOffset: 0, cloudCover: L.defaults.cloudCoverage, haze: HAZE_DEFAULT, fogDistance: FOG_DEFAULT });
  const setOverride = (patch) => {
    over = Object.freeze({ ...over, ...patch });
    lastDirHour = NaN; // paksa hitung ulang arah (azimut) pada frame berikutnya
  };

  /** Arah cahaya: matahari di atas horizon, bulan tetap saat malam; Sky selalu ikut matahari. */
  const applyDirection = (sun) => {
    if (state.hour === lastDirHour) return;
    lastDirHour = state.hour;
    directionFromAngles(sun.elevationDeg, sun.azimuthDeg + over.azimuthOffset, _sunDir);
    // Cahaya arah beralih matahari → bulan bertahap di sekitar horizon (tanpa loncatan arah/bayangan).
    const w = sunMoonWeight(sun.elevationDeg);
    _lightDir.copy(_moonDir).lerp(_sunDir, w);
    L.setSunDirection(_lightDir.lengthSq() > 1e-6 ? _lightDir : _sunDir);
    L.setSkyDirection(_sunDir);
  };

  const applyPreset = (p, sun) => {
    const fade = THREE.MathUtils.clamp(sun.elevationDeg / HORIZON_FADE_DEG, 0, 1);
    const w = sunMoonWeight(sun.elevationDeg);
    L.sun.intensity = p.sunIntensity * fade * w + MOON_MAX_INTENSITY * (1 - w);
    L.sun.shadow.intensity = MOON_SHADOW_STRENGTH + (1 - MOON_SHADOW_STRENGTH) * w; // bayangan bulan lebih lembut
    L.sun.color.setHex(p.sunColor);
    L.hemi.intensity = p.hemiIntensity;
    L.hemi.color.setHex(p.hemiSky);
    L.hemi.groundColor.setHex(p.hemiGround);
    const fogScale = over.fogDistance / FOG_DEFAULT;
    const fog = fogRange(p.fogNear * fogScale, p.fogFar * fogScale, fogLimit);
    scene.fog.color.setHex(p.fogColor);
    scene.fog.near = fog.near;
    scene.fog.far = fog.far;
    scene.background.setHex(p.fogColor);
    if (app.setBaseExposure) app.setBaseExposure(p.exposure);
    else renderer.toneMappingExposure = p.exposure;
    L.skyUniforms.turbidity.value = Math.max(TURBIDITY_MIN, p.skyTurbidity + (over.haze - HAZE_DEFAULT));
    L.skyUniforms.rayleigh.value = p.skyRayleigh;
    if (L.skyUniforms.cloudCoverage) L.skyUniforms.cloudCoverage.value = over.cloudCover;
    L.clouds?.userData.setLook(p.sunColor, sun.elevationDeg, p.fogColor);
    scene.environmentIntensity = L.defaults.envIntensity * Math.max(ENV_MIN_FACTOR, Math.min(1, p.hemiIntensity));
  };

  /** Awan efektif: setelan pengguna, bergerak ke awan badai sesuai intensitas hujan (ditulis Weather). */
  const effectiveCloudCover = () => THREE.MathUtils.clamp(
    THREE.MathUtils.lerp(over.cloudCover, WEATHER.cloudCoverage, L.rainIntensity ?? 0), 0, 1);

  const applyStars = (sun) => {
    // Bintang tertutup awan: makin berawan (pengaturan), makin redup.
    const clear = 1 - effectiveCloudCover() * STAR_CLOUD_DIM;
    const opacity = THREE.MathUtils.clamp(-sun.elevationDeg / STAR_FADE_DEG, 0, 1) * clear;
    stars.material.opacity = opacity;
    stars.visible = opacity > 0.01;
    stars.position.copy(app.camera.position);
  };

  /** Regenerasi env map maksimal sekali per detik, hanya saat jam (bulat) berubah. */
  const maybeRebuildEnv = (dt, p) => {
    envTimer += dt;
    const bucket = Math.floor(state.hour);
    if (bucket === envBucket || envTimer < DAY.envRebuildInterval) return;
    envBucket = bucket;
    envTimer = 0;
    const u = L.envSky.material.uniforms;
    u.sunPosition.value.copy(L.skyUniforms.sunPosition.value);
    u.turbidity.value = L.skyUniforms.turbidity.value;
    u.rayleigh.value = p.skyRayleigh;
    if (u.cloudCoverage) u.cloudCoverage.value = L.skyUniforms.cloudCoverage.value;
    L.rebuildEnvironment();
  };

  return {
    group,
    /** Daftarkan PJU/floodlight/lensa milik region (koordinat dunia); kembalikan pencabut. */
    registerLamps: (opts) => night.registerLamps(opts),
    /** Daftarkan material emissive di bawah root (region/entitas/GLB); kembalikan fungsi unregister. */
    registerEmissive: (root) => night.registerEmissive(root),
    unregisterEmissive: (root) => night.unregisterEmissive(root),
    get hour() { return state.hour; },
    get speed() { return state.speed; },
    get presetName() { return presetNameForHour(state.hour); },
    get preset() { return preset; },
    setHour(h) { state = setDayHour(state, h); },
    nextPreset() {
      const name = nextPresetAfter(state.hour);
      state = setDayHour(state, PRESET_HOURS[name]);
      return name;
    },
    toggleSpeed() {
      state = createDayState({ hour: state.hour, speed: state.speed > 0 ? 0 : DAY.timeSpeed });
      return state.speed > 0;
    },
    /** Kecepatan jam (jam per detik nyata); 0 = berhenti. */
    setSpeed(speed) {
      state = createDayState({ hour: state.hour, speed: Math.max(0, Number(speed) || 0) });
    },
    /** Putar arah matahari pada sumbu Y (derajat) - override settings sky.azimuthOffset. */
    setAzimuthOffset(deg) { setOverride({ azimuthOffset: Number(deg) || 0 }); },
    setCloudCover(v) { setOverride({ cloudCover: THREE.MathUtils.clamp(Number(v) || 0, 0, 1) }); },
    setHaze(v) { setOverride({ haze: Number.isFinite(Number(v)) ? Number(v) : HAZE_DEFAULT }); },
    setFogDistance(m) { setOverride({ fogDistance: Number(m) > 0 ? Number(m) : FOG_DEFAULT }); },
    /** Batas atas fog.far (m), mis. radius muat tile kota; nilai ≤ 0/tak valid = tanpa batas. */
    setFogLimit(m) { fogLimit = Number(m) > 0 ? Number(m) : Infinity; },
    get fogLimit() { return fogLimit; },
    get overrides() { return over; },
    update(dt, ctx, bikeState) {
      state = stepDay(state, dt);
      preset = lightingPreset(state.hour);
      const sun = sunFromHour(state.hour);
      applyDirection(sun);
      maybeRebuildEnv(dt, preset); // sebelum applyPreset: rebuild mereset environmentIntensity
      applyPreset(preset, sun);
      applyStars(sun);
      bodies.update(app.camera, _sunDir, _moonDir, celestialLook({ elevationDeg: sun.elevationDeg, cloudCover: effectiveCloudCover() }), preset.sunColor);
      night.setLampsOn(preset.lampsOn);
      night.update(dt, ctx.bikePos, bikeState?.yaw ?? 0, ctx.focus ?? ctx.bikePos);
    },
    /** Bongkar: registrasi emissive dilepas (nilai siang dipulihkan), grup siklus waktu dilepas. */
    dispose() {
      night.dispose();
      group.removeFromParent();
      disposeTree(group);
    },
  };
}
