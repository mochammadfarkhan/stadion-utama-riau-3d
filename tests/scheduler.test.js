import { describe, it, expect } from 'vitest';
import { createScheduler, runTaskNow, DEFAULT_BUDGET_MS } from '../src/engine/scheduler.js';

const quiet = () => {
  const calls = [];
  return { calls, error: (...a) => calls.push(a) };
};
const clock = () => {
  const c = { t: 0 };
  c.now = () => c.t;
  return c;
};

describe('scheduler: dasar', () => {
  it('anggaran default 4 ms; fungsi biasa jalan sekali pada update berikutnya', async () => {
    expect(DEFAULT_BUDGET_MS).toBe(4);
    const s = createScheduler({ now: () => 0 });
    let n = 0;
    s.schedule(() => { n += 1; });
    expect(n).toBe(0);
    expect(s.pending()).toBe(1);
    expect(s.update()).toBe(1);
    expect(n).toBe(1);
    expect(s.pending()).toBe(0);
    expect(s.update()).toBe(0);
    await s.whenIdle(); // langsung selesai
  });

  it('generator dipotong per yield sampai anggaran habis, lalu lanjut pada update berikutnya', () => {
    const c = clock();
    const s = createScheduler({ budgetMs: 4, now: c.now });
    const hits = [];
    s.schedule(function* kerja() {
      for (let i = 0; i < 10; i += 1) {
        c.t += 1;
        hits.push(i);
        yield;
      }
    });
    expect(s.update()).toBe(4);
    expect(hits).toEqual([0, 1, 2, 3]);
    s.update();
    expect(hits).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    s.update();
    expect(hits).toHaveLength(10);
    expect(s.pending()).toBe(0);
  });

  it('minimal satu potongan per update walau satu potongan melebihi anggaran', () => {
    const c = clock();
    const s = createScheduler({ budgetMs: 4, now: c.now });
    const hits = [];
    s.schedule(function* berat() {
      for (let i = 0; i < 3; i += 1) {
        c.t += 10;
        hits.push(i);
        yield;
      }
    });
    s.update();
    expect(hits).toEqual([0]);
    s.update();
    expect(hits).toEqual([0, 1]);
  });

  it('FIFO: task berikutnya mulai setelah task sebelumnya selesai', () => {
    const s = createScheduler({ now: () => 0 });
    const log = [];
    s.schedule(function* a() { log.push('a1'); yield; log.push('a2'); });
    s.schedule(() => log.push('b'));
    s.update();
    expect(log).toEqual(['a1', 'a2', 'b']);
  });

  it('task boleh menjadwalkan task baru (masuk ke akhir antrean)', () => {
    const s = createScheduler({ now: () => 0 });
    const log = [];
    s.schedule(() => { log.push('induk'); s.schedule(() => log.push('anak')); });
    s.schedule(() => log.push('kedua'));
    s.update();
    expect(log).toEqual(['induk', 'kedua', 'anak']);
  });
});

describe('scheduler: pemilik, pembatalan, galat', () => {
  it('pending(owner) dan whenIdle(owner) per pemilik', async () => {
    const c = clock();
    const s = createScheduler({ budgetMs: 1, now: c.now });
    s.schedule(() => { c.t += 5; }, { owner: 'region:a' });
    s.schedule(() => { c.t += 5; }, { owner: 'region:b' });
    expect(s.pending('region:a')).toBe(1);
    expect(s.pending()).toBe(2);
    let aIdle = false;
    let allIdle = false;
    s.whenIdle('region:a').then(() => { aIdle = true; });
    s.whenIdle().then(() => { allIdle = true; });
    s.update(); // satu potongan (anggaran 1 ms habis): task a
    await Promise.resolve();
    expect(aIdle).toBe(true);
    expect(allIdle).toBe(false);
    s.update();
    await Promise.resolve();
    expect(allIdle).toBe(true);
  });

  it('cancel membuang task; generator yang sedang berjalan menjalankan blok finally; idempoten', () => {
    const s = createScheduler({ budgetMs: 0, now: () => 0 }); // satu potongan per update
    const log = [];
    const a = s.schedule(function* a() {
      try {
        log.push('a1');
        yield;
        log.push('a2');
      } finally {
        log.push('a-finally');
      }
    });
    const b = s.schedule(() => log.push('b'));
    s.update();
    a.cancel();
    a.cancel();
    b.cancel();
    s.update();
    expect(log).toEqual(['a1', 'a-finally']);
    expect(s.pending()).toBe(0);
  });

  it('cancelOwner hanya membatalkan milik pemilik itu dan mengembalikan jumlahnya', () => {
    const s = createScheduler({ now: () => 0 });
    const log = [];
    s.schedule(() => log.push('a'), { owner: 'x' });
    s.schedule(() => log.push('b'), { owner: 'y' });
    s.schedule(() => log.push('c'), { owner: 'x' });
    expect(s.cancelOwner('x')).toBe(2);
    expect(s.cancelOwner('x')).toBe(0);
    s.update();
    expect(log).toEqual(['b']);
  });

  it('task yang melempar dicatat lalu dibuang; antrean lanjut; whenIdle tetap selesai', async () => {
    const logger = quiet();
    const s = createScheduler({ now: () => 0, logger });
    const log = [];
    s.schedule(() => { throw new Error('rusak'); }, { owner: 'r' });
    s.schedule(function* tengah() { yield; throw new Error('rusak di tengah'); }, { owner: 'r' });
    s.schedule(() => log.push('lanjut'));
    const idle = s.whenIdle('r');
    s.update();
    await idle;
    expect(log).toEqual(['lanjut']);
    expect(logger.calls).toHaveLength(2);
    expect(String(logger.calls[0][0])).toContain('"r"');
  });

  it('input tidak sah melempar TypeError', () => {
    expect(() => createScheduler({ budgetMs: -1 })).toThrow(TypeError);
    expect(() => createScheduler({ now: 5 })).toThrow(TypeError);
    expect(() => createScheduler().schedule(null)).toThrow(TypeError);
    expect(() => runTaskNow(5)).toThrow(TypeError);
  });
});

describe('runTaskNow', () => {
  it('menjalankan fungsi biasa dan generator sampai habis secara sinkron', () => {
    const log = [];
    runTaskNow(() => log.push('f'));
    runTaskNow(function* g() { log.push('g1'); yield; log.push('g2'); });
    expect(log).toEqual(['f', 'g1', 'g2']);
  });
});
