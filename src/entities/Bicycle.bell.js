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

/** Satu nada sinus pendek dengan decay eksponensial; output ke node tujuan (bus atau destination). */
function playTone(ctx, out, { freq, at, dur }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + at;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(GAIN, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/**
 * @param {{audioBus?: import('../core/AudioBus.js').AudioBus}} opts bila ada, bel memakai
 *   AudioContext bersama dan kanal 'bell' dari bus (volume diatur settings audio).
 * @returns {{ring: () => boolean, dispose: () => void, setAudioBus: (bus) => void}}
 *   ring() mengembalikan true bila suara benar-benar dimainkan.
 */
export function createBell({ audioBus = null } = {}) {
  const Ctor = getAudioCtor();
  let bus = audioBus;
  let ownCtx = null;
  let lastRing = -Infinity;

  /** Konteks + node keluaran: dari bus bila tersedia, bila tidak buat sendiri. */
  const resolveOutput = () => {
    const busCtx = bus?.ensure?.();
    if (busCtx) return { ctx: busCtx, out: bus.channel('bell') ?? busCtx.destination };
    if (!Ctor) return null;
    ownCtx ??= new Ctor();
    return { ctx: ownCtx, out: ownCtx.destination };
  };

  const ring = () => {
    try {
      const target = resolveOutput();
      if (!target) return false;
      const { ctx, out } = target;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (ctx.currentTime - lastRing < MIN_INTERVAL_S) return false;
      lastRing = ctx.currentTime;
      for (const tone of TONES) playTone(ctx, out, tone);
      return true;
    } catch {
      return false; // audio tidak tersedia (mis. kebijakan autoplay); abaikan diam-diam
    }
  };

  const setAudioBus = (b) => { bus = b ?? null; };
  const dispose = () => { ownCtx?.close?.(); ownCtx = null; };
  return { ring, dispose, setAudioBus };
}
