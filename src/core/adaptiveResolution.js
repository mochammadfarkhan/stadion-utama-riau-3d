/**
 * Resolusi render adaptif: menjaga waktu frame mendekati target dengan menurunkan pixel ratio
 * saat lambat dan menaikkannya pelan-pelan saat longgar. Murni (tanpa THREE/DOM) agar mudah dites.
 *
 * Penurunan resolusi hanya membantu bila GPU/fill-rate yang menjadi kendala. Bila setelah satu
 * langkah turun waktu frame tidak membaik (CPU-bound), langkah itu dibatalkan dan adaptasi turun
 * dikunci agar tidak merusak kualitas gambar tanpa manfaat.
 */
const CHECK_SEC = 1;            // panjang jendela pengukuran
const COOLDOWN_SEC = 2;         // jeda setelah perubahan (naik: 2x lebih lama)
const SLOW_FACTOR = 1.2;        // lebih lambat dari target × ini → turun
const FAST_FACTOR = 0.8;        // lebih cepat dari target × ini → boleh naik
const NO_GAIN = 0.93;           // setelah turun, harus ≥7% lebih cepat agar dianggap berguna
const LOCK_SEC = 45;            // kunci turun setelah gagal membantu
const MAX_SAMPLE_SEC = 0.5;     // dt lebih besar dianggap lonjakan tunggal (tab di-background, loading)
const SPIKE_STREAK = 3;         // ...kecuali berturut-turut: itu mesin yang memang sangat lambat
const CLAMP_SEC = 1;            // batas atas dt yang dihitung
const STEP_DOWN = 0.1;
const GRID = 0.05;

const snap = (v) => Math.round(v / GRID) * GRID;

/**
 * @param {{ceiling:number, floor?:number, targetMs?:number}} opts
 * @returns {{readonly ratio:number, sample(dtSec:number):number|null, setCeiling(r:number):void}}
 */
export function createAdaptiveResolution({ ceiling, floor = 0.6, targetMs = 20 }) {
  let top = ceiling;
  let ratio = ceiling;
  let acc = 0;
  let frames = 0;
  let cooldown = 0;
  let lock = 0;
  let pendingGainCheck = false;
  let prevAvg = 0;
  let spikes = 0;

  const change = (next, cool) => {
    ratio = Math.min(top, Math.max(floor, snap(next)));
    cooldown = cool;
    return ratio;
  };

  return {
    get ratio() { return ratio; },

    setCeiling(r) {
      top = r;
      if (ratio > top) ratio = top;
    },

    /** @returns {number|null} rasio baru bila berubah pada sampel ini, selain itu null */
    sample(dt) {
      if (!(dt > 0)) return null;
      if (dt > MAX_SAMPLE_SEC) {
        spikes += 1;
        if (spikes < SPIKE_STREAK) return null;
        dt = Math.min(dt, CLAMP_SEC);
      } else {
        spikes = 0;
      }
      acc += dt;
      frames += 1;
      cooldown -= dt;
      lock -= dt;
      if (acc < CHECK_SEC) return null;

      const avg = (acc / frames) * 1000;
      acc = 0;
      frames = 0;

      if (pendingGainCheck) {
        pendingGainCheck = false;
        if (avg >= prevAvg * NO_GAIN) { // tidak membantu → CPU-bound: batalkan dan kunci
          lock = LOCK_SEC;
          return change(ratio + STEP_DOWN, COOLDOWN_SEC);
        }
      }
      if (cooldown > 0) return null;

      if (avg > targetMs * SLOW_FACTOR && ratio > floor && lock <= 0) {
        prevAvg = avg;
        pendingGainCheck = true;
        return change(ratio - STEP_DOWN, COOLDOWN_SEC);
      }
      if (avg < targetMs * FAST_FACTOR && ratio < top) return change(ratio + STEP_DOWN / 2, COOLDOWN_SEC * 2);
      return null;
    },
  };
}
