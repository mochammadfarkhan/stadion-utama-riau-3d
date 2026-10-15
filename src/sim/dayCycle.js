/**
 * Siklus waktu murni (tanpa THREE): jam, posisi matahari, dan preset pencahayaan.
 * Semua fungsi mengembalikan objek baru (immutable).
 */
import { DAY, COLORS } from '../config/constants.js';

const HOURS = 24;

export const PRESETS = Object.freeze(['siang', 'sore', 'magrib', 'malam']);
export const PRESET_HOURS = Object.freeze({ siang: 12, sore: 16.5, magrib: 18.1, malam: 20 });

/** Keyframe pencahayaan per jam (diinterpolasi linear, wrap 24 → 0). */
const KEYFRAMES = Object.freeze([
  { hour: 0, sunIntensity: 0.35, sunColor: 0x8899cc, hemiIntensity: 0.45, hemiSky: 0x33406a, hemiGround: 0x1a1c24,
    fogColor: 0x0a1020, fogNear: 120, fogFar: 700, exposure: 0.75, skyTurbidity: 8, skyRayleigh: 0.2 },
  { hour: 5, sunIntensity: 0.3, sunColor: 0xc9b8ff, hemiIntensity: 0.35, hemiSky: 0x5a6a9a, hemiGround: 0x3a3530,
    fogColor: 0x56608a, fogNear: 150, fogFar: 800, exposure: 0.8, skyTurbidity: 6, skyRayleigh: 1.0 },
  { hour: 7, sunIntensity: 3.0, sunColor: 0xffe3c0, hemiIntensity: 0.9, hemiSky: COLORS.shadowTint, hemiGround: 0xd8d2ad,
    fogColor: 0xe0e6f0, fogNear: 220, fogFar: 1100, exposure: 0.9, skyTurbidity: 3, skyRayleigh: 2.0 },
  { hour: 12, sunIntensity: 5.0, sunColor: 0xffffff, hemiIntensity: 1.1, hemiSky: COLORS.shadowTint, hemiGround: 0xd8d2ad,
    fogColor: COLORS.fog, fogNear: 220, fogFar: 1100, exposure: 0.9, skyTurbidity: 2.5, skyRayleigh: 1.6 },
  { hour: 16.5, sunIntensity: 4.5, sunColor: 0xfff1dc, hemiIntensity: 1.0, hemiSky: COLORS.shadowTint, hemiGround: 0xd8d2ad,
    fogColor: COLORS.fog, fogNear: 220, fogFar: 1100, exposure: 0.9, skyTurbidity: 2.5, skyRayleigh: 1.6 },
  { hour: 18, sunIntensity: 1.6, sunColor: 0xff9a4a, hemiIntensity: 0.55, hemiSky: 0x8a7aa8, hemiGround: 0x6b5040,
    fogColor: 0xe8a070, fogNear: 180, fogFar: 900, exposure: 0.85, skyTurbidity: 6, skyRayleigh: 3.0 },
  { hour: 19.5, sunIntensity: 0.4, sunColor: 0x8899cc, hemiIntensity: 0.5, hemiSky: 0x3a4878, hemiGround: 0x1c1e28,
    fogColor: 0x101a30, fogNear: 130, fogFar: 720, exposure: 0.75, skyTurbidity: 8, skyRayleigh: 0.3 },
]);
const COLOR_KEYS = Object.freeze(['sunColor', 'hemiSky', 'hemiGround', 'fogColor']);
const NUMBER_KEYS = Object.freeze(['sunIntensity', 'hemiIntensity', 'fogNear', 'fogFar', 'exposure', 'skyTurbidity', 'skyRayleigh']);

const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
const wrapHour = (h) => ((num(h) % HOURS) + HOURS) % HOURS;
const lerp = (a, b, t) => a + (b - a) * t;

/** State jam: { hour, speed } (speed = jam per detik nyata). */
export function createDayState({ hour = DAY.startHour, speed = 0 } = {}) {
  return Object.freeze({ hour: wrapHour(hour), speed: num(speed) });
}

/** Majukan jam sebanyak speed·dt; wrap 24 → 0. dt tidak valid dianggap 0. */
export function stepDay(state, dt) {
  const d = Math.max(0, num(dt));
  return Object.freeze({ ...state, hour: wrapHour(state.hour + state.speed * d) });
}

/** Set jam secara langsung (wrap). */
export function setDayHour(state, hour) {
  return Object.freeze({ ...state, hour: wrapHour(hour) });
}

/**
 * Posisi matahari dari jam: terbit 06.00 di timur (azimut 90°), terbenam 18.3 di barat (270°).
 * Elevasi positif siang (puncak maxElevationDeg), negatif malam (sinus, minimum -nightDepthDeg).
 */
export function sunFromHour(hour) {
  const h = wrapHour(hour);
  const dayLen = DAY.sunsetHour - DAY.sunriseHour;
  const nightLen = HOURS - dayLen;
  if (h >= DAY.sunriseHour && h <= DAY.sunsetHour) {
    const t = (h - DAY.sunriseHour) / dayLen;
    return { elevationDeg: DAY.maxElevationDeg * Math.sin(Math.PI * t), azimuthDeg: 90 + 180 * t };
  }
  const sinceSet = h > DAY.sunsetHour ? h - DAY.sunsetHour : h + HOURS - DAY.sunsetHour;
  const t = sinceSet / nightLen;
  return { elevationDeg: -DAY.nightDepthDeg * Math.sin(Math.PI * t), azimuthDeg: (270 + 180 * t) % 360 };
}

const BLEND_BAND_DEG = 6;

/** Bobot matahari terhadap bulan sebagai sumber cahaya arah: 0 (malam) → 1 (siang), smoothstep di sekitar horizon. */
export function sunMoonWeight(elevationDeg, band = BLEND_BAND_DEG) {
  const t = Math.min(1, Math.max(0, (elevationDeg + band) / (2 * band)));
  return t * t * (3 - 2 * t);
}

/** Apakah lampu PJU menyala pada jam ini. */
export function lampsOnAt(hour) {
  const h = wrapHour(hour);
  return h >= DAY.lampsOnHour || h < DAY.lampsOffHour;
}

/** Pasangan keyframe (a, b, t) yang mengapit jam; keyframe terakhir menyambung ke pertama + 24. */
function bracket(hour) {
  const h = wrapHour(hour);
  for (let i = 0; i < KEYFRAMES.length; i += 1) {
    const a = KEYFRAMES[i];
    const b = KEYFRAMES[(i + 1) % KEYFRAMES.length];
    const bHour = b.hour <= a.hour ? b.hour + HOURS : b.hour;
    if (h >= a.hour && h < bHour) return { a, b, t: (h - a.hour) / (bHour - a.hour) };
  }
  return { a: KEYFRAMES[0], b: KEYFRAMES[0], t: 0 };
}

/** Pecah warna hex ke kanal [r, g, b] 0..1. */
export function hexToRgb(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

function lerpHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const ch = ca.map((v, i) => Math.round(lerp(v, cb[i], t) * 255));
  return (ch[0] << 16) | (ch[1] << 8) | ch[2];
}

/**
 * Preset pencahayaan pada jam tertentu (interpolasi linear antar keyframe).
 * @returns {{sunIntensity:number,sunColor:number,hemiIntensity:number,hemiSky:number,hemiGround:number,
 *   fogColor:number,fogNear:number,fogFar:number,exposure:number,lampsOn:boolean,skyTurbidity:number,skyRayleigh:number}}
 */
export function lightingPreset(hour) {
  const { a, b, t } = bracket(hour);
  const out = { lampsOn: lampsOnAt(hour) };
  for (const k of NUMBER_KEYS) out[k] = lerp(a[k], b[k], t);
  for (const k of COLOR_KEYS) out[k] = lerpHex(a[k], b[k], t);
  return Object.freeze(out);
}

/** Nama suasana untuk HUD berdasarkan jam. */
export function presetNameForHour(hour) {
  const h = wrapHour(hour);
  if (h < 4.5 || h >= 18.8) return 'malam';
  if (h < 6.5) return 'subuh';
  if (h < 10) return 'pagi';
  if (h < 15) return 'siang';
  if (h < 17.7) return 'sore';
  return 'magrib';
}

/** Preset berikutnya setelah jam saat ini (urutan PRESETS, siklik). */
export function nextPresetAfter(hour) {
  const h = wrapHour(hour);
  const found = PRESETS.find((name) => PRESET_HOURS[name] > h + 0.01);
  return found ?? PRESETS[0];
}

/** Format "16:30" dari jam desimal. */
export function formatHour(hour) {
  const h = wrapHour(hour);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
