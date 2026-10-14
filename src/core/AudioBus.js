/**
 * AudioBus: satu AudioContext bersama + GainNode master + kanal bernama
 * (mis. 'bell', 'ambience'). Konteks dibuat malas (lazy) lewat ensure(),
 * di-resume pada gesture pengguna (pointerdown/keydown). Tanpa AudioContext
 * (Node/test, browser lama) semua metode menjadi no-op yang aman.
 *
 * Nilai gain yang diset sebelum konteks ada disimpan dan diterapkan saat
 * kanal dibuat, sehingga settings dapat di-bind sebelum ada gesture.
 */

const DEFAULT_MASTER = 0.8;

/** @typedef {{ ensure(): AudioContext|null, resume(): void, channel(name): GainNode|null,
 *   setMaster(v): void, setChannel(name, v): void, master: number, context: AudioContext|null,
 *   dispose(): void }} AudioBus */

function getAudioCtor() {
  if (typeof globalThis === 'undefined') return null;
  return globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;
}

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

/**
 * @param {{ master?: number, target?: EventTarget|null }} opts
 * @returns {AudioBus}
 */
export function createAudioBus({ master = DEFAULT_MASTER, target = null } = {}) {
  const Ctor = getAudioCtor();
  let ctx = null;
  let masterGain = null;
  let masterLevel = clamp01(master);
  const channels = new Map();   // name -> GainNode
  const levels = new Map();     // name -> level (0..1), berlaku sebelum/ sesudah node ada
  let resuming = false;

  const resume = () => {
    if (!ctx || ctx.state !== 'suspended' || resuming) return;
    resuming = true;
    ctx.resume().catch(() => {}).finally(() => { resuming = false; });
  };

  /** Buat konteks bila belum ada; null bila Web Audio tidak tersedia. */
  const ensure = () => {
    if (ctx) return ctx;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = masterLevel;
      masterGain.connect(ctx.destination);
    } catch {
      ctx = null; // kebijakan browser/perangkat tanpa audio: tetap no-op
    }
    return ctx;
  };

  /** Kanal bernama (GainNode -> master); dibuat saat pertama diminta. */
  const channel = (name) => {
    if (!ensure()) return null;
    let node = channels.get(name);
    if (!node) {
      node = ctx.createGain();
      node.gain.value = levels.has(name) ? levels.get(name) : 1;
      node.connect(masterGain);
      channels.set(name, node);
    }
    return node;
  };

  const setMaster = (v) => {
    masterLevel = clamp01(v);
    if (masterGain) masterGain.gain.value = masterLevel;
  };

  const setChannel = (name, v) => {
    const level = clamp01(v);
    levels.set(name, level);
    const node = channels.get(name);
    if (node) node.gain.value = level;
  };

  const onGesture = () => resume();
  const evTarget = target ?? (typeof window !== 'undefined' ? window : null);
  evTarget?.addEventListener?.('pointerdown', onGesture, { passive: true });
  evTarget?.addEventListener?.('keydown', onGesture, { passive: true });

  const dispose = () => {
    evTarget?.removeEventListener?.('pointerdown', onGesture);
    evTarget?.removeEventListener?.('keydown', onGesture);
    ctx?.close?.().catch?.(() => {});
    ctx = null;
    masterGain = null;
    channels.clear();
  };

  return {
    ensure, resume, channel, setMaster, setChannel, dispose,
    get master() { return masterLevel; },
    get context() { return ctx; },
  };
}
