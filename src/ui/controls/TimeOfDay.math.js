/**
 * Matematika murni untuk widget Waktu (busur matahari) — tanpa DOM.
 * Geometri dial: elips atas (siang, ry = up) dan elips bawah (malam, ry = down)
 * berbagi pusat (cx, cy) dan radius x (rx). Jam 06 di horizon kiri, 12 di puncak,
 * 18 di horizon kanan, 00 di titik terbawah.
 */

const HOURS = 24;
const HALF_DAY = 12;
const SUNRISE = 6;
const SUNSET = 18;
const MINUTES_PER_HOUR = 60;
const GRADIENT_STOPS = 25;

/** Dimensi viewBox dial & parameter elips (unit SVG). */
export const TOD = Object.freeze({ w: 300, h: 148, cx: 150, cy: 100, rx: 118, up: 74, down: 32 });

/** Nama fase; urutan = urutan ambang di PHASE_BOUNDS. */
export const PHASES = Object.freeze([
  'Malam', 'Subuh', 'Matahari terbit', 'Pagi', 'Siang', 'Sore', 'Jam emas', 'Magrib', 'Senja',
]);

/** [ambangAtasEksklusif, fase] — berurutan menaik; sisanya 'Malam'. */
const PHASE_BOUNDS = Object.freeze([
  [4.5, 'Malam'],
  [6, 'Subuh'],
  [6.75, 'Matahari terbit'],
  [10, 'Pagi'],
  [15, 'Siang'],
  [17, 'Sore'],
  [17.7, 'Jam emas'],
  [18.8, 'Magrib'],
  [19.5, 'Senja'],
]);

/**
 * 12 keyframe warna langit {hour, zenith, horizon, sea} (hex string),
 * diinterpolasi smoothstep dan siklik (22 → 24/0).
 */
export const SKY_KEYFRAMES = Object.freeze([
  { hour: 0, zenith: '#060b1e', horizon: '#111a3a', sea: '#0a1226' }, // tengah malam
  { hour: 4, zenith: '#0a1130', horizon: '#1c2452', sea: '#0d1530' }, // dini hari
  { hour: 5, zenith: '#2a2458', horizon: '#6a4a8c', sea: '#1e2244' }, // subuh ungu
  { hour: 6, zenith: '#4a5aa0', horizon: '#ff8a5c', sea: '#3a4470' }, // terbit oranye-pink
  { hour: 7.5, zenith: '#5f9ee6', horizon: '#bfe0ff', sea: '#3f7fb8' }, // pagi biru muda
  { hour: 10, zenith: '#2f7fe0', horizon: '#9fd2ff', sea: '#2a6fb0' }, // siang biru
  { hour: 15, zenith: '#3d86dc', horizon: '#aad6f6', sea: '#2d6ea8' }, // sore awal
  { hour: 17, zenith: '#5b7fc0', horizon: '#ffc46a', sea: '#4a6a90' }, // sore keemasan
  { hour: 18, zenith: '#3e3f7a', horizon: '#ff6a3d', sea: '#2d2f58' }, // magrib oranye-merah
  { hour: 19, zenith: '#1e1c4e', horizon: '#7a4a9c', sea: '#181a3c' }, // senja ungu
  { hour: 20, zenith: '#0b1134', horizon: '#232c5c', sea: '#0e1530' }, // malam awal
  { hour: 22, zenith: '#070c22', horizon: '#141c40', sea: '#0b1228' }, // malam
]);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
const wrapHour = (h) => ((num(h) % HOURS) + HOURS) % HOURS;
const smoothstep = (t) => t * t * (3 - 2 * t);

/** Posisi matahari pada dial untuk jam tertentu. elev ∈ [-1, 1] (1 = puncak, -1 = nadir). */
export function todPoint(hours) {
  const h = wrapHour(hours);
  const { cx, cy, rx, up, down } = TOD;
  if (h >= SUNRISE && h <= SUNSET) {
    const theta = Math.PI * (1 - (h - SUNRISE) / HALF_DAY); // π di kiri → 0 di kanan
    const s = Math.sin(theta);
    return { x: cx + rx * Math.cos(theta), y: cy - up * s, elev: s };
  }
  const sinceSet = h > SUNSET ? h - SUNSET : h + HOURS - SUNSET;
  const theta = Math.PI * (sinceSet / HALF_DAY); // 0 di kanan → π di kiri (lewat bawah)
  const s = Math.sin(theta);
  return { x: cx + rx * Math.cos(theta), y: cy + down * s, elev: -s };
}

/** Invers todPoint: titik (x, y) dalam unit viewBox → jam [0, 24). Dipakai saat drag. */
export function todHours(x, y) {
  const { cx, cy, rx, up, down } = TOD;
  const dx = (num(x, cx) - cx) / rx;
  const dyRaw = num(y, cy) - cy;
  const dy = dyRaw <= 0 ? -dyRaw / up : -dyRaw / down; // normalisasi, positif ke atas
  const theta = Math.atan2(dy, dx); // (-π, π]
  if (theta >= 0) return wrapHour(SUNSET - (HALF_DAY * theta) / Math.PI);
  return wrapHour(SUNSET + (HALF_DAY * -theta) / Math.PI);
}

/** Nama fase hari untuk jam tertentu. */
export function phaseAt(hours) {
  const h = wrapHour(hours);
  const found = PHASE_BOUNDS.find(([limit]) => h < limit);
  return found ? found[1] : 'Malam';
}

/** Pecah '#rrggbb' → [r, g, b] 0..255. */
function hexToRgb(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Gabung [r, g, b] → '#rrggbb'. */
function rgbToHex([r, g, b]) {
  const to2 = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

/** Pasangan keyframe yang mengapit jam, siklik ke keyframe pertama + 24. */
function skyBracket(h) {
  const n = SKY_KEYFRAMES.length;
  for (let i = 0; i < n; i += 1) {
    const a = SKY_KEYFRAMES[i];
    const b = SKY_KEYFRAMES[(i + 1) % n];
    const bHour = b.hour <= a.hour ? b.hour + HOURS : b.hour;
    if (h >= a.hour && h < bHour) return { a, b, t: (h - a.hour) / (bHour - a.hour) };
  }
  return { a: SKY_KEYFRAMES[0], b: SKY_KEYFRAMES[0], t: 0 };
}

/** Warna langit pada jam tertentu: {zenith, horizon, sea} hex string. */
export function skyColorsAt(hours) {
  const { a, b, t } = skyBracket(wrapHour(hours));
  const s = smoothstep(clamp(t, 0, 1));
  return Object.freeze({
    zenith: mixHex(a.zenith, b.zenith, s),
    horizon: mixHex(a.horizon, b.horizon, s),
    sea: mixHex(a.sea, b.sea, s),
  });
}

/** Format "HH:MM" dari jam desimal (dibulatkan ke menit; 24 → 00:00). */
export function fmtClock(hours) {
  const total = Math.round(clamp(num(hours), 0, HOURS) * MINUTES_PER_HOUR);
  const hh = Math.floor(total / MINUTES_PER_HOUR) % HOURS;
  const mm = total % MINUTES_PER_HOUR;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Parse teks jam: '14:30' | '14.5' | '14,5' | '9' → jam desimal [0, 24], atau null jika tak valid.
 */
export function parseClock(text) {
  const s = String(text ?? '').trim();
  const hm = s.match(/^(\d{1,2})(?::([0-5]?\d))?$/);
  if (hm) {
    const h = Number(hm[1]) + Number(hm[2] ?? 0) / MINUTES_PER_HOUR;
    return h <= HOURS ? h : null;
  }
  const dec = s.match(/^(\d{1,2})[.,](\d+)$/);
  if (!dec) return null;
  const h = Number(`${dec[1]}.${dec[2]}`);
  return Number.isFinite(h) && h <= HOURS ? h : null;
}

/** CSS linear-gradient horizontal 25 stop (tiap 1 jam) dari warna horizon. */
export function trackGradientCss() {
  const stops = Array.from({ length: GRADIENT_STOPS }, (_, i) => {
    const pct = ((i / (GRADIENT_STOPS - 1)) * 100).toFixed(2);
    return `${skyColorsAt(i % HOURS).horizon} ${pct}%`;
  });
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
