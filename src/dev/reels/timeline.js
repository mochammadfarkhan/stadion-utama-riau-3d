/**
 * Timeline reels (murni, tanpa three): keyframe angka/array dengan easing, teks berjangka dengan fade, dan daftar
 * waktu frame. Dipakai src/dev/reelsStudio.js; waktu SELALU dari nomor frame (t = i / fps) agar render deterministik.
 */
export const EASE = Object.freeze({
  linear: (u) => u,
  in: (u) => u * u * u,
  out: (u) => 1 - (1 - u) ** 3,
  inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  /** Tahan lalu lompat (potongan kamera / cut). */
  step: (u) => (u < 1 ? 0 : 1),
});

const clamp01 = (u) => Math.min(1, Math.max(0, u));
const lerp = (a, b, u) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * u) : a + (b - a) * u);

/**
 * Keyframe → fungsi f(t). `ease` milik keyframe TUJUAN (cara bergerak menuju nilai itu); default inOut.
 * Sebelum key pertama / sesudah key terakhir nilai ditahan.
 * @param {{t:number, v:number|number[], ease?:keyof EASE}[]} keys
 */
export function keyframes(keys) {
  if (!Array.isArray(keys) || keys.length === 0) throw new TypeError('keyframes: minimal satu key');
  const list = [...keys].sort((a, b) => a.t - b.t);
  return (t) => {
    if (t <= list[0].t) return list[0].v;
    const last = list[list.length - 1];
    if (t >= last.t) return last.v;
    const i = list.findIndex((k) => k.t > t);
    const a = list[i - 1];
    const b = list[i];
    const ease = EASE[b.ease ?? 'inOut'] ?? EASE.inOut;
    return lerp(a.v, b.v, ease(clamp01((t - a.t) / (b.t - a.t))));
  };
}

/**
 * Item berjangka (teks/subtitle) yang aktif pada t, dengan alpha fade masuk/keluar.
 * @param {{dari:number, sampai:number, fade?:number}[]} items
 * @returns {{item:object, alpha:number}[]}
 */
export function activeAt(items, t, defaultFade = 0.25) {
  return items
    .filter((it) => t >= it.dari && t < it.sampai)
    .map((item) => {
      const fade = Math.max(1e-6, item.fade ?? defaultFade);
      const alpha = Math.min(clamp01((t - item.dari) / fade), clamp01((item.sampai - t) / fade));
      return { item, alpha };
    });
}

/** Jumlah frame untuk durasi (detik) pada fps; frame terakhir < durasi. */
export function frameCount(duration, fps) {
  if (!(duration > 0) || !(fps > 0)) throw new RangeError('frameCount: durasi & fps harus positif');
  return Math.round(duration * fps);
}
