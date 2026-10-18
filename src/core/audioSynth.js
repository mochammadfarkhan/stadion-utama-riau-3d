/**
 * Sintesis audio prosedural MURNI (tanpa Web Audio): menghasilkan Float32Array mono yang dimainkan AudioBus.
 * Tanpa berkas audio berlisensi. Semua generator deterministik per seed.
 * - karplusStrong: senar dipetik (gitar), ring buffer derau + rerata dua sampel teredam.
 * - fanHumBuffer: dengung motor 100 Hz (listrik 50 Hz) + desis angin bilah termodulasi.
 * - rainOnTinBuffer: desis hujan + ketukan "tik" logam acak (atap seng).
 * - murmurBuffer: gumaman obrolan teredam dinding (derau ber-formant dengan amplop suku kata).
 * Buffer loop dibuat sedikit lebih panjang lalu ujungnya di-crossfade ke awal (makeLoopable).
 */
const TAU = Math.PI * 2;
const LOOP_FADE_S = 0.12;

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sr8 = (sampleRate) => Math.max(8000, Math.round(sampleRate));

/** Skala agar puncak |x| = peak (sunyi dibiarkan). Memodifikasi & mengembalikan `data`. */
export function normalizePeak(data, peak = 0.9) {
  let max = 0;
  for (let i = 0; i < data.length; i += 1) max = Math.max(max, Math.abs(data[i]));
  if (max > 1e-9) {
    const k = peak / max;
    for (let i = 0; i < data.length; i += 1) data[i] *= k;
  }
  return data;
}

function fadeEdges(data, fadeIn, fadeOut) {
  const n = data.length;
  for (let i = 0; i < Math.min(fadeIn, n); i += 1) data[i] *= i / fadeIn;
  for (let i = 0; i < Math.min(fadeOut, n); i += 1) data[n - 1 - i] *= i / fadeOut;
}

/** Buffer loop mulus: `fade` sampel terakhir di-crossfade ke awal; panjang hasil = len − fade. */
export function makeLoopable(data, fade) {
  const n = data.length - fade;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    if (i < fade) {
      const w = i / fade;
      out[i] = data[i] * w + data[n + i] * (1 - w);
    } else {
      out[i] = data[i];
    }
  }
  return out;
}

/**
 * Senar dipetik (Karplus-Strong).
 * @param {number} freq Hz @param {number} sampleRate @param {number} seconds
 * @param {{decay?:number, brightness?:number, seed?:number}} [opts]
 */
export function karplusStrong(freq, sampleRate, seconds, { decay = 0.996, brightness = 0.5, seed = 1 } = {}) {
  const sr = sr8(sampleRate);
  const f = Math.min(sr / 4, Math.max(20, Number(freq) || 220));
  const total = Math.max(1, Math.round(sr * seconds));
  const n = Math.max(2, Math.round(sr / f));
  const rnd = mulberry(seed);
  const buf = new Float32Array(n);
  const b = Math.min(1, Math.max(0, brightness));
  let prev = 0;
  let mean = 0;
  for (let i = 0; i < n; i += 1) {
    prev += (rnd() * 2 - 1 - prev) * (0.2 + 0.8 * b);
    buf[i] = prev;
    mean += prev / n;
  }
  for (let i = 0; i < n; i += 1) buf[i] -= mean;
  const out = new Float32Array(total);
  let idx = 0;
  for (let i = 0; i < total; i += 1) {
    const cur = buf[idx];
    const next = buf[(idx + 1) % n];
    out[i] = cur;
    buf[idx] = decay * 0.5 * (cur + next);
    idx = (idx + 1) % n;
  }
  fadeEdges(out, Math.round(sr * 0.002), Math.round(sr * 0.05));
  return normalizePeak(out, 0.9);
}

/** Dengung kipas berdiri, loop 4 s. */
export function fanHumBuffer(sampleRate, { seconds = 4, seed = 3 } = {}) {
  const sr = sr8(sampleRate);
  const fade = Math.round(sr * LOOP_FADE_S);
  const total = Math.round(sr * seconds) + fade;
  const rnd = mulberry(seed);
  const out = new Float32Array(total);
  let lp = 0;
  let lp2 = 0;
  for (let i = 0; i < total; i += 1) {
    const t = i / sr;
    const hum = 0.35 * Math.sin(TAU * 100 * t) + 0.12 * Math.sin(TAU * 200 * t) + 0.05 * Math.sin(TAU * 300 * t);
    lp += (rnd() * 2 - 1 - lp) * 0.06;
    lp2 += (lp - lp2) * 0.06;
    const blade = 1 + 0.35 * Math.sin(TAU * 18 * t);
    out[i] = hum * 0.25 + lp2 * 2.2 * blade;
  }
  return normalizePeak(makeLoopable(out, fade), 0.8);
}

/** Hujan di atap seng, loop 6 s: desis + rumble + ketukan logam acak (~density per detik). */
export function rainOnTinBuffer(sampleRate, { seconds = 6, seed = 5, density = 160 } = {}) {
  const sr = sr8(sampleRate);
  const fade = Math.round(sr * LOOP_FADE_S);
  const total = Math.round(sr * seconds) + fade;
  const rnd = mulberry(seed);
  const out = new Float32Array(total);
  const pings = [];
  let lp = 0;
  let low = 0;
  for (let i = 0; i < total; i += 1) {
    const white = rnd() * 2 - 1;
    lp += (white - lp) * 0.35;
    low += (white - low) * 0.01;
    let s = (white - lp) * 0.22 + low * 0.9;
    if (rnd() < density / sr && pings.length < 32) {
      const f = 1800 + rnd() * 2600;
      const tau = 0.003 + rnd() * 0.006;
      pings.push({ phase: 0, step: (TAU * f) / sr, env: 0.2 + rnd() * 0.8, k: Math.exp(-1 / (tau * sr)) });
    }
    for (let p = pings.length - 1; p >= 0; p -= 1) {
      const ping = pings[p];
      s += Math.sin(ping.phase) * ping.env * 0.35;
      ping.phase += ping.step;
      ping.env *= ping.k;
      if (ping.env < 1e-3) pings.splice(p, 1);
    }
    out[i] = s;
  }
  return normalizePeak(makeLoopable(out, fade), 0.8);
}

/** Resonator dua kutub (formant sederhana). */
function resonator(freq, r, sr) {
  const a1 = 2 * r * Math.cos((TAU * freq) / sr);
  const a2 = r * r;
  let y1 = 0;
  let y2 = 0;
  return (x) => {
    const y = x * (1 - r) + a1 * y1 - a2 * y2;
    y2 = y1;
    y1 = y;
    return y;
  };
}

/** Gumaman obrolan beberapa orang di balik dinding, loop 8 s. */
export function murmurBuffer(sampleRate, { seconds = 8, seed = 7, voices = 4 } = {}) {
  const sr = sr8(sampleRate);
  const fade = Math.round(sr * LOOP_FADE_S);
  const total = Math.round(sr * seconds) + fade;
  const rnd = mulberry(seed);
  const out = new Float32Array(total);
  for (let v = 0; v < voices; v += 1) {
    const f1 = resonator(450 + rnd() * 250, 0.985, sr);
    const f2 = resonator(1200 + rnd() * 600, 0.98, sr);
    const rate = 4 + rnd() * 2;
    let talking = rnd() < 0.6;
    let timer = (0.4 + rnd() * 1.6) * sr;
    let syl = rnd();
    let env = 0;
    for (let i = 0; i < total; i += 1) {
      timer -= 1;
      if (timer <= 0) {
        talking = !talking;
        timer = (talking ? 1.2 + rnd() * 2.4 : 0.4 + rnd() * 0.8) * sr;
      }
      syl += rate / sr;
      const target = talking ? Math.abs(Math.sin(Math.PI * syl)) ** 1.5 : 0;
      env += (target - env) * 0.004;
      const x = rnd() * 2 - 1;
      out[i] += (f1(x) + 0.6 * f2(x)) * env;
    }
  }
  let lp = 0;
  for (let i = 0; i < total; i += 1) {
    lp += (out[i] - lp) * 0.15;
    out[i] = lp;
  }
  return normalizePeak(makeLoopable(out, fade), 0.8);
}
