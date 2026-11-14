/**
 * AudioBus: satu AudioContext bersama + GainNode master + kanal bernama
 * (mis. 'bell', 'ambience'). Konteks dibuat malas (lazy) lewat ensure(),
 * di-resume pada gesture pengguna (pointerdown/keydown). Tanpa AudioContext
 * (Node/test, browser lama) semua metode menjadi no-op yang aman.
 *
 * Nilai gain yang diset sebelum konteks ada disimpan dan diterapkan saat
 * kanal dibuat, sehingga settings dapat di-bind sebelum ada gesture.
 */

import { karplusStrong, fanHumBuffer, rainOnTinBuffer, murmurBuffer, cityHumBuffer, windBuffer, rainHissBuffer, tyreRollBuffer, chainTickBuffer, birdsBuffer, crowdRoarBuffer, trafficBuffer, riverBuffer,
  thudBuffer, splashBuffer, popBuffer, tickBuffer,
} from './audioSynth.js';

const DEFAULT_MASTER = 0.8;

/** @typedef {{ ensure(): AudioContext|null, resume(): void, channel(name): GainNode|null,
 *   setMaster(v): void, setChannel(name, v): void, master: number, context: AudioContext|null,
 *   pluck(freq, opts?): boolean, startFanHum(opts?): LoopHandle, startRainOnTin(opts?): LoopHandle,
 *   startMurmur(opts?): LoopHandle, startCityHum(opts?): LoopHandle, startWind(opts?): LoopHandle,
 *   dispose(): void }} AudioBus */
/** @typedef {{ setLevel(v:number, rampSeconds?:number): void, stop(): void, readonly stopped: boolean }} LoopHandle */

function getAudioCtor() {
  if (typeof globalThis === 'undefined') return null;
  return globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;
}

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

/**
 * @param {{ master?: number, target?: EventTarget|null, createContext?: (() => AudioContext)|null }} opts
 *   createContext: pabrik konteks (tes); default AudioContext browser.
 * @returns {AudioBus}
 */
export function createAudioBus({ master = DEFAULT_MASTER, target = null, createContext = null } = {}) {
  const Ctor = getAudioCtor();
  const makeContext = createContext ?? (Ctor ? () => new Ctor() : null);
  let ctx = null;
  let masterGain = null;
  let masterLevel = clamp01(master);
  const channels = new Map();   // name -> GainNode
  const levels = new Map();     // name -> level (0..1), berlaku sebelum/ sesudah node ada
  let resuming = false;

  const resume = () => {
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed' || resuming) return; // iOS: 'interrupted' juga dilanjutkan
    resuming = true;
    ctx.resume().catch(() => {}).finally(() => { resuming = false; });
  };

  /** Tab disembunyikan: hentikan semua bunyi (resume() saat kembali). */
  const suspend = () => {
    if (ctx && ctx.state === 'running') ctx.suspend?.().catch?.(() => {});
  };

  /** Buat konteks bila belum ada; null bila Web Audio tidak tersedia. */
  const ensure = () => {
    if (ctx) return ctx;
    if (!makeContext) return null;
    try {
      ctx = makeContext();
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

  const buffers = new Map(); // kunci -> AudioBuffer (sekali per konteks)
  const loops = new Set();   // handle loop aktif (dihentikan saat dispose)
  const NOOP_LOOP = Object.freeze({ setLevel() {}, stop() {}, stopped: true });

  /** AudioBuffer mono dari generator `make(sampleRate)`; null tanpa Web Audio. */
  const bufferFor = (key, make) => {
    if (!ensure()) return null;
    let b = buffers.get(key);
    if (!b) {
      const data = make(ctx.sampleRate);
      b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.getChannelData(0).set(data);
      buffers.set(key, b);
    }
    return b;
  };

  /** Mainkan buffer sekali ke kanal (default 'ambience'); true bila dijadwalkan. */
  const play = (key, make, { channel: ch = 'ambience', gain = 1, at = 0 } = {}) => {
    const buffer = bufferFor(key, make);
    if (!buffer) return false;
    resume();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = clamp01(gain);
    src.connect(g).connect(channel(ch) ?? masterGain);
    src.onended = () => { src.disconnect(); g.disconnect(); };
    src.start(ctx.currentTime + Math.max(0, Number(at) || 0));
    return true;
  };

  /** Putar buffer berulang dengan gain yang bisa diatur; handle no-op tanpa Web Audio. */
  const loop = (key, make, { channel: ch = 'ambience', level = 0 } = {}) => {
    const buffer = bufferFor(key, make);
    if (!buffer) return NOOP_LOOP;
    resume();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = clamp01(level);
    src.connect(g).connect(channel(ch) ?? masterGain);
    src.start();
    let stopped = false;
    const handle = {
      setLevel(v, rampSeconds = 0.25) {
        if (stopped || !ctx) return;
        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(clamp01(v), now, Math.max(0.01, rampSeconds / 3));
      },
      stop() {
        if (stopped) return;
        stopped = true;
        try { src.stop(); } catch { /* sudah berhenti */ }
        src.disconnect();
        g.disconnect();
        loops.delete(handle);
      },
      get stopped() { return stopped; },
    };
    loops.add(handle);
    return handle;
  };

  /** Senar dipetik (Karplus-Strong); buffer di-cache per frekuensi (0,01 Hz). */
  const pluck = (freq, { gain = 0.5, at = 0, channel: ch = 'ambience', seconds = 2.2 } = {}) => play(
    `pluck:${Math.round(freq * 100)}:${seconds}`,
    (sr) => karplusStrong(freq, sr, seconds, { seed: Math.round(freq) }),
    { channel: ch, gain, at },
  );
  const startFanHum = (opts) => loop('fanHum', (sr) => fanHumBuffer(sr), opts);
  const startRainOnTin = (opts) => loop('rainOnTin', (sr) => rainOnTinBuffer(sr), opts);
  const startMurmur = (opts) => loop('murmur', (sr) => murmurBuffer(sr), opts);
  const startCityHum = (opts) => loop('cityHum', (sr) => cityHumBuffer(sr), opts); // pratinjau Kota
  const startWind = (opts) => loop('wind', (sr) => windBuffer(sr), opts);
  const startRainHiss = (opts) => loop('rainHiss', (sr) => rainHissBuffer(sr), opts); // hujan luar (Weather)
  // R18: sepeda + suasana per kawasan (app/ambience.js)
  const startTyreRoll = (opts) => loop('tyreRoll', (sr) => tyreRollBuffer(sr), opts);
  const startChainTick = (opts) => loop('chainTick', (sr) => chainTickBuffer(sr), opts);
  const startBirds = (opts) => loop('birds', (sr) => birdsBuffer(sr), opts);
  const startCrowdRoar = (opts) => loop('crowdRoar', (sr) => crowdRoarBuffer(sr), opts);
  const startTraffic = (opts) => loop('traffic', (sr) => trafficBuffer(sr), opts);
  const startRiver = (opts) => loop('river', (sr) => riverBuffer(sr), opts);
  /** Bunyi aksi pendek (kanal 'sfx'): cangkul, siram, pop (tanam/panen/beli), tick (klik/ganti kendaraan). */
  const SFX = { thud: thudBuffer, splash: splashBuffer, pop: popBuffer, tick: tickBuffer };
  const sfx = (name, { gain = 0.6 } = {}) => (SFX[name] ? play(`sfx:${name}`, (sr) => SFX[name](sr), { channel: 'sfx', gain }) : false);

  const onGesture = () => resume();
  const evTarget = target ?? (typeof window !== 'undefined' ? window : null);
  evTarget?.addEventListener?.('pointerdown', onGesture, { passive: true });
  evTarget?.addEventListener?.('keydown', onGesture, { passive: true });
  evTarget?.addEventListener?.('touchend', onGesture, { passive: true }); // iOS: konteks hanya bisa dimulai dari touchend/click
  evTarget?.addEventListener?.('click', onGesture, { passive: true });

  const dispose = () => {
    evTarget?.removeEventListener?.('pointerdown', onGesture);
    evTarget?.removeEventListener?.('keydown', onGesture);
    evTarget?.removeEventListener?.('touchend', onGesture);
    evTarget?.removeEventListener?.('click', onGesture);
    for (const h of [...loops]) h.stop();
    buffers.clear();
    ctx?.close?.().catch?.(() => {});
    ctx = null;
    masterGain = null;
    channels.clear();
  };

  return {
    ensure, resume, suspend, channel, setMaster, setChannel, dispose, play, loop, pluck, startFanHum, startRainOnTin, startMurmur, startCityHum, startWind, startRainHiss,
    startTyreRoll, startChainTick, startBirds, startCrowdRoar, startTraffic, startRiver, sfx,
    get master() { return masterLevel; },
    get context() { return ctx; },
  };
}
