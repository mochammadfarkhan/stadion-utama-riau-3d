import { describe, it, expect } from 'vitest';
import {
  createFrameWindow, summarizeFrames, guessBottleneck, summarizeLongTasks, loadPhases, LOAD_DONE_MARK,
} from '../src/engine/perfStats.js';

describe('createFrameWindow', () => {
  it('hanya menyimpan frame terbaru yang totalnya ≤ jendela, urut lama → baru', () => {
    const w = createFrameWindow({ windowMs: 100, capacity: 64 });
    for (let i = 1; i <= 10; i += 1) w.push(20, i);
    expect(w.size).toBe(5);
    expect(w.totalMs).toBe(100);
    expect(Array.from(w.cpu())).toEqual([6, 7, 8, 9, 10]);
  });

  it('kapasitas penuh membuang yang tertua; nilai tak valid diabaikan; cpu tak ada = NaN', () => {
    const w = createFrameWindow({ windowMs: 1e9, capacity: 3 });
    w.push(0, 1);
    w.push(NaN, 1);
    w.push(-5, 1);
    for (const ms of [1, 2, 3, 4]) w.push(ms, undefined);
    expect(Array.from(w.frames())).toEqual([2, 3, 4]);
    expect(Number.isNaN(w.cpu()[0])).toBe(true);
  });

  it('total tidak melantur setelah ratusan ribu frame acak (float32)', () => {
    const w = createFrameWindow({ windowMs: 30000, capacity: 8192 });
    let seed = 3;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 300000; i += 1) w.push(4 + rnd() * 60, rnd() * 10);
    const exact = w.frames().reduce((s, x) => s + x, 0);
    expect(w.totalMs).toBe(exact);
    expect(w.totalMs).toBeLessThanOrEqual(30000);
  });
});

describe('summarizeFrames', () => {
  it('persentil, fps, persen tersendat, dan CPU (NaN dilewati); masukan tidak diubah', () => {
    const frames = new Float32Array([10, 20, 30, 40, 100]);
    const s = summarizeFrames(frames, [5, NaN, 5, 6, 50]);
    expect(Array.from(frames)).toEqual([10, 20, 30, 40, 100]);
    expect(s).toMatchObject({ jumlah: 5, detik: 0.2, fps: 25, rataMs: 40, p50Ms: 30, p95Ms: 100, maksMs: 100 });
    expect(s.persenTersendat).toBe(60); // 30, 40, 100 ms > 1,5 × 16,7 ms
    expect(s.cpuP50Ms).toBe(5);
    expect(s.cpuP95Ms).toBe(50);
  });

  it('tersendat relatif terhadap batas FPS: frame 34–36 ms pada batas 30 fps bukan tersendat', () => {
    const frames = [33.4, 34, 35.6, 36, 33.4, 34, 60, 33.4, 34, 35];
    expect(summarizeFrames(frames, [], 1000 / 30).persenTersendat).toBe(10); // hanya 60 ms > 50 ms
    expect(summarizeFrames(frames, [], 1000 / 60).persenTersendat).toBe(100);
  });

  it('kosong → null', () => {
    expect(summarizeFrames([])).toBeNull();
  });
});

describe('guessBottleneck', () => {
  it('lancar/tersendat bila median dekat target; cpu/gpu/campuran dari porsi waktu CPU', () => {
    expect(guessBottleneck({ p50Ms: 17, cpuP50Ms: 16 })).toBe('lancar');
    expect(guessBottleneck({ p50Ms: 34, cpuP50Ms: 30, persenTersendat: 3 }, 1000 / 30)).toBe('lancar'); // batas 30 fps
    expect(guessBottleneck({ p50Ms: 35.6, cpuP50Ms: 16, persenTersendat: 15 }, 1000 / 30)).toBe('tersendat');
    expect(guessBottleneck({ p50Ms: 40, cpuP50Ms: 32 })).toBe('cpu');
    expect(guessBottleneck({ p50Ms: 40, cpuP50Ms: 12 })).toBe('gpu');
    expect(guessBottleneck({ p50Ms: 40, cpuP50Ms: 25 })).toBe('campuran');
    expect(guessBottleneck({ p50Ms: 40, cpuP50Ms: null })).toBeNull();
    expect(guessBottleneck(null)).toBeNull();
  });
});

describe('summarizeLongTasks', () => {
  it('membagi saat muat / saat main dan mengurutkan yang terlama', () => {
    const entries = [{ startTime: 1000, duration: 300 }, { startTime: 5000, duration: 80 }, { startTime: 12000, duration: 524 }];
    const s = summarizeLongTasks(entries, 6000, 2);
    expect(s.saatMuat).toEqual({ jumlah: 2, totalMs: 380, maksMs: 300 });
    expect(s.saatMain).toEqual({ jumlah: 1, totalMs: 524, maksMs: 524 });
    expect(s.terlama).toEqual([{ detikKe: 12, ms: 524, fase: 'main' }, { detikKe: 1, ms: 300, fase: 'muat' }]);
  });
});

describe('loadPhases', () => {
  it('durasi tiap tahap sampai tanda berikutnya; tanda lain diabaikan; siapS dari tanda selesai', () => {
    const marks = [
      { name: 'muat:Langit', startTime: 1500 }, { name: 'lain', startTime: 1600 },
      { name: 'muat:Mesin', startTime: 500 }, { name: LOAD_DONE_MARK, startTime: 9000 },
    ];
    expect(loadPhases(marks)).toEqual({
      tahap: [{ nama: 'Mesin', mulaiS: 0.5, durasiS: 1 }, { nama: 'Langit', mulaiS: 1.5, durasiS: 7.5 }],
      siapS: 9,
    });
  });

  it('tahap terakhir yang masih berjalan → durasi null, siapS null', () => {
    expect(loadPhases([{ name: 'muat:Mesin', startTime: 500 }])).toEqual({ tahap: [{ nama: 'Mesin', mulaiS: 0.5, durasiS: null }], siapS: null });
  });
});
