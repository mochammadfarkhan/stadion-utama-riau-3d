/**
 * Bel sepeda sintetis via Web Audio: dua nada "kring-kring" cepat.
 * AudioContext dibuat malas (lazy) saat ring() pertama dari gesture pengguna
 * (tombol Space) dan di-resume bila tersuspensi. Tanpa AudioContext → no-op.
 */

const TONES = [
  { freq: 2600, at: 0.0, dur: 0.09 },
  { freq: 3100, at: 0.11, dur: 0.12 },
];
const GAIN = 0.12;
const MIN_INTERVAL_S = 0.18;

function getAudioCtor() {
  if (typeof globalThis === 'undefined') return null;
  return globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;
}

/** Satu nada sinus pendek dengan decay eksponensial. */
function playTone(ctx, { freq, at, dur }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + at;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(GAIN, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/**
 * @returns {{ring: () => boolean, dispose: () => void}} ring() mengembalikan
 *   true bila suara benar-benar dimainkan.
 */
export function createBell() {
  const Ctor = getAudioCtor();
  let ctx = null;
  let lastRing = -Infinity;

  const ring = () => {
    if (!Ctor) return false;
    try {
      ctx ??= new Ctor();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (ctx.currentTime - lastRing < MIN_INTERVAL_S) return false;
      lastRing = ctx.currentTime;
      for (const tone of TONES) playTone(ctx, tone);
      return true;
    } catch {
      return false; // audio tidak tersedia (mis. kebijakan autoplay); abaikan diam-diam
    }
  };

  const dispose = () => { ctx?.close?.(); ctx = null; };
  return { ring, dispose };
}
