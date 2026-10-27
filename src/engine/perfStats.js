/**
 * Statistik laporan `?perf` (MURNI; rencana performa Fase 0): jendela waktu frame bergulir, ringkasan persentil, dugaan
 * sumber beban (CPU vs GPU), ringkasan long task, dan durasi tahap muat dari performance.mark layar muat.
 */
import { pickSorted } from './qualityTier.js';

/** Frame lebih lama dari selang sasaran × ini = tersendat (melewatkan ≥ 1 vsync di atas sasaran). */
export const STUTTER_FACTOR = 1.5;
/** Porsi frame tersendat (%) yang masih dianggap lancar. */
export const STUTTER_OK_PERCENT = 10;
/** Awalan performance.mark tiap langkah layar muat; tanda selesai = layar muat ditutup ("bisa main"). */
export const LOAD_MARK_PREFIX = 'muat:';
export const LOAD_DONE_MARK = `${LOAD_MARK_PREFIX}selesai`;

const round = (x, d = 1) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);

/**
 * Jendela bergulir waktu frame + waktu CPU (thread utama) per frame: hanya frame terbaru yang totalnya ≤ windowMs.
 * Kapasitas tetap, tanpa alokasi per frame. Total dijumlah dari nilai float32 yang TERSIMPAN sehingga pengurangan saat
 * frame lama dibuang tepat sama (tidak melantur walau berjalan berjam-jam).
 */
export function createFrameWindow({ windowMs = 30000, capacity = 8192 } = {}) {
  const frame = new Float32Array(capacity);
  const cpu = new Float32Array(capacity);
  let head = 0;
  let size = 0;
  let total = 0;
  const dropOldest = () => {
    total -= frame[head];
    head = (head + 1) % capacity;
    size -= 1;
  };
  const copy = (src) => {
    const out = new Float32Array(size);
    for (let k = 0; k < size; k += 1) out[k] = src[(head + k) % capacity];
    return out;
  };
  return {
    /** @param {number} frameMs selang sejak frame sebelumnya @param {number} cpuMs waktu thread utama frame itu (NaN = tak ada) */
    push(frameMs, cpuMs) {
      if (!(frameMs > 0) || !Number.isFinite(frameMs)) return;
      if (size === capacity) dropOldest();
      const i = (head + size) % capacity;
      frame[i] = frameMs;
      cpu[i] = cpuMs >= 0 ? cpuMs : NaN;
      size += 1;
      total += frame[i];
      while (size > 1 && total > windowMs) dropOldest();
    },
    reset() {
      head = 0;
      size = 0;
      total = 0;
    },
    get size() { return size; },
    get totalMs() { return total; },
    /** Salinan urut waktu (lama → baru). */
    frames: () => copy(frame),
    cpu: () => copy(cpu),
  };
}

/**
 * Ringkasan frame (masukan tidak diubah). Kosong → null.
 * @param {ArrayLike<number>} frames ms per frame @param {ArrayLike<number>} [cpu] ms CPU per frame (NaN dilewati)
 * @param {number} [targetMs] selang frame sasaran (batas FPS; tanpa batas = 60 fps)
 */
export function summarizeFrames(frames, cpu = [], targetMs = 1000 / 60) {
  const n = frames.length;
  if (!n) return null;
  let sum = 0;
  let slow = 0;
  for (let i = 0; i < n; i += 1) {
    sum += frames[i];
    if (frames[i] > targetMs * STUTTER_FACTOR) slow += 1;
  }
  const f = Float32Array.from(frames).sort();
  const c = Float32Array.from(Array.from(cpu).filter(Number.isFinite)).sort();
  return {
    detik: round(sum / 1000),
    sasaranMs: round(targetMs),
    jumlah: n,
    fps: round(n / (sum / 1000)),
    rataMs: round(sum / n),
    p50Ms: round(pickSorted(f, 0.5)),
    p95Ms: round(pickSorted(f, 0.95)),
    p99Ms: round(pickSorted(f, 0.99)),
    maksMs: round(f[n - 1]),
    persenTersendat: round((slow / n) * 100),
    cpuP50Ms: round(pickSorted(c, 0.5)),
    cpuP95Ms: round(pickSorted(c, 0.95)),
  };
}

/**
 * Dugaan sumber beban dari frame MEDIAN. Median ≤ sasaran × 1,15 → 'lancar' (dibatasi vsync/batas FPS), atau
 * 'tersendat' bila ≥ STUTTER_OK_PERCENT % frame tersendat (lonjakan sesaat: streaming/shader → lihat long task).
 * Selain itu dari porsi waktu CPU: ≥ 75% frame → 'cpu' (JS/draw call di thread utama); ≤ 50% → 'gpu' (thread utama
 * menunggu GPU: jumlah piksel, bayangan, efek); di antaranya 'campuran'.
 * @param {{p50Ms:number|null, cpuP50Ms:number|null, persenTersendat?:number|null}|null} summary
 * @param {number} [targetMs] selang frame sasaran
 * @returns {'lancar'|'tersendat'|'cpu'|'gpu'|'campuran'|null} null = data kurang
 */
export function guessBottleneck(summary, targetMs = 1000 / 60) {
  if (!summary || !Number.isFinite(summary.p50Ms) || !Number.isFinite(summary.cpuP50Ms)) return null;
  if (summary.p50Ms <= targetMs * 1.15) return (summary.persenTersendat ?? 0) >= STUTTER_OK_PERCENT ? 'tersendat' : 'lancar';
  const share = summary.cpuP50Ms / summary.p50Ms;
  if (share >= 0.75) return 'cpu';
  if (share <= 0.5) return 'gpu';
  return 'campuran';
}

/**
 * Long task dibagi saat muat / saat main (batas = playableAtMs) + daftar terlama.
 * @param {{startTime:number, duration:number}[]} entries @param {number} [playableAtMs] @param {number} [top]
 */
export function summarizeLongTasks(entries, playableAtMs = Infinity, top = 10) {
  const part = (list) => ({
    jumlah: list.length,
    totalMs: round(list.reduce((s, e) => s + e.duration, 0), 0),
    maksMs: round(list.reduce((m, e) => Math.max(m, e.duration), 0), 0),
  });
  const phase = (e) => (e.startTime < playableAtMs ? 'muat' : 'main');
  return {
    saatMuat: part(entries.filter((e) => phase(e) === 'muat')),
    saatMain: part(entries.filter((e) => phase(e) === 'main')),
    terlama: [...entries].sort((a, b) => b.duration - a.duration).slice(0, top)
      .map((e) => ({ detikKe: round(e.startTime / 1000), ms: round(e.duration, 0), fase: phase(e) })),
  };
}

/**
 * Tahap muat dari performance.mark berawalan LOAD_MARK_PREFIX: durasi tiap tahap = sampai tanda berikutnya (tahap terakhir
 * yang belum selesai → null). siapS = saat layar muat ditutup (null bila belum).
 * @param {{name:string, startTime:number}[]} marks
 */
export function loadPhases(marks) {
  const list = marks.filter((m) => m.name.startsWith(LOAD_MARK_PREFIX)).sort((a, b) => a.startTime - b.startTime);
  const done = list.find((m) => m.name === LOAD_DONE_MARK);
  const tahap = [];
  list.forEach((m, i) => {
    if (m.name === LOAD_DONE_MARK) return;
    const next = list[i + 1];
    tahap.push({
      nama: m.name.slice(LOAD_MARK_PREFIX.length),
      mulaiS: round(m.startTime / 1000, 2),
      durasiS: next ? round((next.startTime - m.startTime) / 1000, 2) : null,
    });
  });
  return { tahap, siapS: done ? round(done.startTime / 1000, 2) : null };
}
