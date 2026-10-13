/**
 * Cuaca: toggle hujan dengan transisi WEATHER.transitionSeconds. Saat hujan:
 * kabut lebih rapat, matahari/hemisphere turun, awan Sky lebih tebal & gelap,
 * exposure turun sedikit, permukaan basah + genangan, partikel hujan, suara hujan.
 * Harus di-update SETELAH TimeOfDay (nilainya dikalikan, bukan diakumulasi).
 */
import * as THREE from 'three';
import { WEATHER } from '../config/constants.js';
import { createRain } from './Weather.rain.js';
import { createWetSurfaces } from './Weather.wet.js';

const RAIN_TURBIDITY_ADD = 4;      // langit lebih kabur saat hujan
const AUDIO_GAIN = 0.18;
const AUDIO_FILTER_HZ = 1400;
const AUDIO_BUFFER_SECONDS = 2;

/** Suara hujan dari derau terfilter (Web Audio); dibuat setelah gesture pengguna. */
function createRainAudio() {
  let ctx = null;
  let gain = null;
  const start = () => {
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (ctx || !Ctor) return;
    ctx = new Ctor();
    const frames = ctx.sampleRate * AUDIO_BUFFER_SECONDS;
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < frames; i += 1) { // derau "pink-ish": white noise dihaluskan
      const white = Math.random() * 2 - 1;
      last = (last + 0.04 * white) / 1.04;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = AUDIO_FILTER_HZ;
    gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  };
  const onGesture = () => start();
  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('keydown', onGesture, { passive: true });
  let resuming = false;
  return {
    setLevel(level) {
      if (!gain) return;
      if (level > 0 && ctx.state === 'suspended' && !resuming) {
        resuming = true;
        ctx.resume().catch(() => {}).finally(() => { resuming = false; });
      }
      gain.gain.value = AUDIO_GAIN * level;
    },
  };
}

/**
 * @param {THREE.Scene} scene
 * @param {import('../core/App.js').App} app
 * @param {THREE.Group} lighting hasil createLighting
 * @returns {{update(dt, ctx):void, toggleRain():boolean, isRaining:boolean, intensity:number, weatherName:string}}
 */
export function createWeather(scene, app, lighting) {
  const L = lighting.userData;
  const rain = createRain(scene);
  const wet = createWetSurfaces(scene);
  const audio = createRainAudio();
  let target = 0;
  let intensity = 0;

  /** Kalikan nilai pencahayaan yang sudah ditulis TimeOfDay frame ini. */
  const applyAtmosphere = (k) => {
    const lightScale = 1 - (1 - WEATHER.lightScale) * k;
    const fogScale = 1 - (1 - WEATHER.fogScale) * k;
    L.sun.intensity *= lightScale;
    L.hemi.intensity *= lightScale;
    scene.fog.near *= fogScale;
    scene.fog.far *= fogScale;
    scene.environmentIntensity *= lightScale;
    app.renderer.toneMappingExposure *= 1 - (1 - WEATHER.exposureScale) * k;
    const u = L.skyUniforms;
    u.turbidity.value += RAIN_TURBIDITY_ADD * k;
    if (u.cloudCoverage) u.cloudCoverage.value = THREE.MathUtils.lerp(L.defaults.cloudCoverage, WEATHER.cloudCoverage, k);
    if (u.cloudDensity) u.cloudDensity.value = THREE.MathUtils.lerp(L.defaults.cloudDensity, WEATHER.cloudDensity, k);
  };

  return {
    get isRaining() { return target > 0; },
    get intensity() { return intensity; },
    get weatherName() { return target > 0 ? 'Hujan' : 'Cerah'; },
    toggleRain() {
      target = target > 0 ? 0 : 1;
      return target > 0;
    },
    update(dt, ctx) {
      const step = dt / WEATHER.transitionSeconds;
      intensity = THREE.MathUtils.clamp(intensity + Math.sign(target - intensity) * step, 0, 1);
      if (Math.abs(target - intensity) < step) intensity = target;
      applyAtmosphere(intensity);
      rain.update(dt, intensity, app.camera, ctx.bikePos);
      wet.update(dt, intensity);
      audio.setLevel(intensity);
    },
  };
}
