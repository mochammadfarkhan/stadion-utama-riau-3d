/**
 * Siklus waktu: menerapkan preset pencahayaan (sim/dayCycle.js) ke matahari,
 * hemisphere, kabut, Sky, exposure, env map, bintang, dan lampu malam tiap frame.
 * Nilai ditulis absolut setiap frame sehingga modul Weather (dijalankan sesudahnya)
 * boleh mengalikannya tanpa akumulasi.
 */
import * as THREE from 'three';
import { DAY } from '../config/constants.js';
import {
  createDayState, stepDay, setDayHour, sunFromHour, lightingPreset,
  presetNameForHour, nextPresetAfter, PRESET_HOURS,
} from '../sim/dayCycle.js';
import { directionFromAngles } from './Lighting.js';
import { createNightLights } from './TimeOfDay.lights.js';

const MOON_ELEVATION_DEG = 48;
const MOON_AZIMUTH_DEG = 120;
const MOON_MAX_INTENSITY = 0.15;   // batas intensitas cahaya arah saat matahari di bawah horizon
const HORIZON_FADE_DEG = 6;        // matahari memudar menjelang terbenam (hindari bayangan datar ekstrem)
const ENV_MIN_FACTOR = 0.15;       // environmentIntensity malam ≈ 0.12 × 0.15 ≈ 0.02
const STAR_RADIUS = 1800;
const STAR_MIN_Y = 0.06;
const STAR_SIZE = 2.2;
const STAR_FADE_DEG = 8;           // bintang penuh saat matahari ≥ 8° di bawah horizon

const _sunDir = new THREE.Vector3();
const _moonDir = directionFromAngles(MOON_ELEVATION_DEG, MOON_AZIMUTH_DEG);

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
 * @returns {{update(dt, ctx, bikeState?):void, setHour(h):void, nextPreset():string, toggleSpeed():boolean,
 *   hour:number, presetName:string, speed:number, preset:object}}
 */
export function createTimeOfDay(lightingGroup, scene, renderer, app) {
  const L = lightingGroup.userData;
  let state = createDayState();
  let preset = lightingPreset(state.hour);
  let lastDirHour = NaN;
  let envBucket = -1;
  let envTimer = DAY.envRebuildInterval;
  const stars = createStars(DAY.starCount);
  scene.add(stars);
  const night = createNightLights(scene);

  /** Arah cahaya: matahari di atas horizon, bulan tetap saat malam; Sky selalu ikut matahari. */
  const applyDirection = (sun) => {
    if (state.hour === lastDirHour) return;
    lastDirHour = state.hour;
    directionFromAngles(sun.elevationDeg, sun.azimuthDeg, _sunDir);
    L.setSunDirection(sun.elevationDeg > 0 ? _sunDir : _moonDir);
    L.setSkyDirection(_sunDir);
  };

  const applyPreset = (p, sun) => {
    const fade = THREE.MathUtils.clamp(sun.elevationDeg / HORIZON_FADE_DEG, 0, 1);
    L.sun.intensity = sun.elevationDeg > 0 ? p.sunIntensity * fade : Math.min(p.sunIntensity, MOON_MAX_INTENSITY);
    L.sun.color.setHex(p.sunColor);
    L.hemi.intensity = p.hemiIntensity;
    L.hemi.color.setHex(p.hemiSky);
    L.hemi.groundColor.setHex(p.hemiGround);
    scene.fog.color.setHex(p.fogColor);
    scene.fog.near = p.fogNear;
    scene.fog.far = p.fogFar;
    scene.background.setHex(p.fogColor);
    renderer.toneMappingExposure = p.exposure;
    L.skyUniforms.turbidity.value = p.skyTurbidity;
    L.skyUniforms.rayleigh.value = p.skyRayleigh;
    scene.environmentIntensity = L.defaults.envIntensity * Math.max(ENV_MIN_FACTOR, Math.min(1, p.hemiIntensity));
  };

  const applyStars = (sun) => {
    const opacity = THREE.MathUtils.clamp(-sun.elevationDeg / STAR_FADE_DEG, 0, 1);
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
    u.turbidity.value = p.skyTurbidity;
    u.rayleigh.value = p.skyRayleigh;
    if (u.cloudCoverage) u.cloudCoverage.value = L.skyUniforms.cloudCoverage.value;
    L.rebuildEnvironment();
  };

  return {
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
    update(dt, ctx, bikeState) {
      state = stepDay(state, dt);
      preset = lightingPreset(state.hour);
      const sun = sunFromHour(state.hour);
      applyDirection(sun);
      maybeRebuildEnv(dt, preset); // sebelum applyPreset: rebuild mereset environmentIntensity
      applyPreset(preset, sun);
      applyStars(sun);
      night.setLampsOn(preset.lampsOn);
      night.update(dt, ctx.bikePos, bikeState?.yaw ?? 0);
    },
  };
}
