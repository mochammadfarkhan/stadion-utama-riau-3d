/**
 * Cuaca: toggle hujan dengan transisi WEATHER.transitionSeconds. Saat hujan:
 * kabut lebih rapat, matahari/hemisphere turun, awan Sky lebih tebal & gelap,
 * exposure turun sedikit, permukaan basah + genangan, partikel hujan, suara hujan.
 * Harus di-update SETELAH TimeOfDay (nilainya dikalikan, bukan diakumulasi).
 */
import * as THREE from 'three';
import { WEATHER } from '../config/constants.js';
import { lightingPreset } from '../sim/dayCycle.js';
import { createRain } from './Weather.rain.js';
import { createWetSurfaces } from './Weather.wet.js';

const RAIN_TURBIDITY_ADD = 4;      // langit lebih kabur saat hujan
const AUDIO_GAIN = 0.18;
const AUDIO_FILTER_HZ = 1400;
const AUDIO_BUFFER_SECONDS = 2;
const WIND_DEFAULT = 0.3;          // nilai settings weather.wind yang berarti angin = WEATHER.wind

/**
 * Suara hujan dari derau terfilter (Web Audio); dibuat setelah gesture pengguna.
 * Bila audioBus ada, memakai konteks bersama dan kanal 'ambience' (volume dari settings).
 */
function createRainAudio(audioBus) {
  let ctx = null;
  let gain = null;
  const start = () => {
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (ctx) return;
    ctx = audioBus?.ensure?.() ?? (Ctor ? new Ctor() : null);
    if (!ctx) return;
    const out = audioBus?.channel?.('ambience') ?? ctx.destination;
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
    src.connect(filter).connect(gain).connect(out);
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
 * @param {{audioBus?: object}} opts
 * @returns {{update(dt, ctx):void, toggleRain():boolean, setRaining(b):void, setIntensity(v):void,
 *   setWetness(v):void, setWind(v):void, setSoundEnabled(b):void,
 *   isRaining:boolean, intensity:number, weatherName:string}}
 */
const DAY_HEMI_INTENSITY = lightingPreset(12).hemiIntensity; // acuan "siang terang"
const MIN_RAIN_BRIGHTNESS = 0.15;                              // hujan malam tetap samar terlihat

export function createWeather(scene, app, lighting, { audioBus = null } = {}) {
  const L = lighting.userData;
  const rain = createRain(scene);
  const wet = createWetSurfaces(scene);
  const audio = createRainAudio(audioBus);
  let raining = false;
  // Parameter settings (immutable; objek baru tiap perubahan).
  let params = Object.freeze({ maxIntensity: 0.7, wetness: 1, soundEnabled: true });
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
    // cloudCoverage dasar sudah ditulis TimeOfDay frame ini (override settings) -> lerap dari nilai itu
    if (u.cloudCoverage) u.cloudCoverage.value = THREE.MathUtils.lerp(u.cloudCoverage.value, WEATHER.cloudCoverage, k);
    if (u.cloudDensity) u.cloudDensity.value = THREE.MathUtils.lerp(L.defaults.cloudDensity, WEATHER.cloudDensity, k);
  };

  const setParams = (patch) => { params = Object.freeze({ ...params, ...patch }); };

  return {
    get isRaining() { return raining; },
    get intensity() { return intensity; },
    get weatherName() { return raining ? 'Hujan' : 'Cerah'; },
    toggleRain() {
      raining = !raining;
      return raining;
    },
    setRaining(on) { raining = Boolean(on); },
    /** Intensitas maksimum hujan 0..1 (settings weather.intensity). */
    setIntensity(v) { setParams({ maxIntensity: THREE.MathUtils.clamp(Number(v) || 0, 0, 1) }); },
    /** Skala efek permukaan basah 0..1 (settings weather.wetness). */
    setWetness(v) { setParams({ wetness: THREE.MathUtils.clamp(Number(v) || 0, 0, 1) }); },
    /** Angin 0..1; WIND_DEFAULT = angin konstanta WEATHER.wind. */
    setWind(v) { rain.setWind(THREE.MathUtils.clamp(Number(v) || 0, 0, 1) / WIND_DEFAULT); },
    setSoundEnabled(on) { setParams({ soundEnabled: Boolean(on) }); },
    update(dt, ctx) {
      const target = raining ? params.maxIntensity : 0;
      const step = dt / WEATHER.transitionSeconds;
      intensity = THREE.MathUtils.clamp(intensity + Math.sign(target - intensity) * step, 0, 1);
      if (Math.abs(target - intensity) < step) intensity = target;
      // Terang lingkungan (sebelum redaman hujan) menentukan seberapa terlihat goresan aditif.
      const brightness = THREE.MathUtils.clamp(L.hemi.intensity / DAY_HEMI_INTENSITY, MIN_RAIN_BRIGHTNESS, 1);
      applyAtmosphere(intensity);
      rain.update(dt, intensity, app.camera, ctx.focus ?? ctx.bikePos, brightness);
      wet.update(dt, intensity * params.wetness);
      audio.setLevel(params.soundEnabled ? intensity : 0);
    },
  };
}
