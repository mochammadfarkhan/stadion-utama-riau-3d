/**
 * Keputusan tier kualitas otomatis (MURNI): tebakan awal dari nama GPU (WEBGL_debug_renderer_info) lalu koreksi dari uji
 * kinerja beberapa detik (p95 waktu frame). Hanya TURUN (tidak naik) agar tidak berayun; data tidak dipercaya → 'sedang'.
 */

export const TIERS = Object.freeze(['rendah', 'sedang', 'tinggi']);

/** p95 waktu frame (ms) maksimum yang masih diterima per tier; di atasnya turun satu tingkat. */
export const TIER_BUDGET_MS = Object.freeze({ tinggi: 25, sedang: 28, rendah: Infinity });

const SOFTWARE = /swiftshader|llvmpipe|softpipe|basic render|microsoft basic|software/i;
const MOBILE_GPU = /mali|adreno|powervr|apple gpu|videocore/i;
const WEAK_DISCRETE = /\bmx ?\d{3}\b|gt ?\d{3,4}\b|gtx ?(7|9)\d{2}\b/i;

/**
 * @param {string|null|undefined} renderer nama GPU (mis. "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 ...)")
 * @param {{mobile?:boolean}} [hints] mobile = perangkat sentuh/ponsel
 * @returns {'rendah'|'sedang'|'tinggi'}
 */
export function guessTierFromGpu(renderer, { mobile = false } = {}) {
  const s = String(renderer ?? '');
  if (SOFTWARE.test(s) || MOBILE_GPU.test(s) || mobile) return 'rendah';
  if (/nvidia|geforce/i.test(s)) {
    if (WEAK_DISCRETE.test(s)) return 'rendah';
    return /rtx|gtx ?1[0-9]{3}|gtx ?16/i.test(s) ? (/rtx/i.test(s) ? 'tinggi' : 'sedang') : 'sedang';
  }
  if (/radeon|amd/i.test(s)) {
    if (/\brx ?\d{3,4}/i.test(s)) return 'tinggi';                 // diskret RX
    if (/\b(6[5-9]0|7[4-9]0|8[0-9]0)m\b/i.test(s)) return 'sedang'; // iGPU RDNA 2/3 (680M, 780M, 890M)
    return 'rendah';                                                // Vega / "Radeon(TM) Graphics" terintegrasi
  }
  if (/intel/i.test(s)) return /arc/i.test(s) ? 'sedang' : 'rendah'; // UHD/Iris (Xe) terintegrasi; Arc diskret
  if (/apple m\d/i.test(s)) return 'sedang';
  return 'sedang';
}

/** Persentil p (0..1) dari sampel (tidak mengubah array masukan); kosong → NaN. */
export function percentile(samples, p) {
  const xs = samples.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return NaN;
  return xs[Math.min(xs.length - 1, Math.max(0, Math.ceil(p * xs.length) - 1))];
}

/**
 * Hasil uji: tier berikutnya (turun satu tingkat bila p95 melebihi anggaran tier saat ini), atau tier yang sama.
 * @param {'rendah'|'sedang'|'tinggi'} tier
 * @param {number} p95Ms
 */
export function tierAfterBenchmark(tier, p95Ms) {
  const i = TIERS.indexOf(tier);
  if (i <= 0 || !Number.isFinite(p95Ms)) return i < 0 ? 'sedang' : tier;
  return p95Ms > TIER_BUDGET_MS[tier] ? TIERS[i - 1] : tier;
}
