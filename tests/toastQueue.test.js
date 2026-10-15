import { describe, it, expect } from 'vitest';
import { createToastQueue, toastDuration } from '../src/ui/toastQueue.js';

/** Penjadwal palsu: waktu maju manual. */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    schedule: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; },
    cancel: (id) => timers.delete(id),
    advance(ms) {
      now += ms;
      for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); }
    },
  };
}

function setup(opts = {}) {
  const clock = fakeClock();
  const log = [];
  const q = createToastQueue({
    show: (text, ok) => log.push(['show', text, ok]),
    hide: () => log.push(['hide']),
    schedule: clock.schedule,
    cancel: clock.cancel,
    baseMs: 2000,
    perCharMs: 50,
    ...opts,
  });
  return { q, clock, log };
}

describe('toastDuration', () => {
  it('minimal baseMs, bertambah untuk teks panjang', () => {
    expect(toastDuration('ok', { baseMs: 2000, perCharMs: 50 })).toBe(2000);
    expect(toastDuration('x'.repeat(100), { baseMs: 2000, perCharMs: 50 })).toBe(5000);
  });
});

describe('createToastQueue', () => {
  it('toast pertama tampil langsung dan disembunyikan setelah durasinya', () => {
    const { q, clock, log } = setup();
    q.push('A');
    expect(log).toEqual([['show', 'A', true]]);
    clock.advance(1999);
    expect(log).toHaveLength(1);
    clock.advance(1);
    expect(log.at(-1)).toEqual(['hide']);
  });

  it('toast berikutnya diantrekan FIFO, tidak menimpa yang sedang tampil', () => {
    const { q, clock, log } = setup();
    q.push('Teks egg');
    q.push('+Rp 3.000');
    expect(log).toEqual([['show', 'Teks egg', true]]);
    clock.advance(2000);
    expect(log).toEqual([['show', 'Teks egg', true], ['show', '+Rp 3.000', true]]);
    clock.advance(2000);
    expect(log.at(-1)).toEqual(['hide']);
  });

  it('antrean dibatasi agar tidak menumpuk: yang terlama digeser', () => {
    const { q, clock, log } = setup({ maxQueue: 2 });
    q.push('1');
    q.push('2');
    q.push('3');
    q.push('4');
    clock.advance(2000);
    expect(log[1]).toEqual(['show', '3', true]); // '2' digeser keluar
    clock.advance(2000);
    expect(log[2]).toEqual(['show', '4', true]);
  });

  it('pesan galat (ok=false) langsung tampil menggantikan yang sedang tampil, tanpa menunggu antrean', () => {
    const { q, clock, log } = setup();
    q.push('Teks egg panjang');
    q.push('+Rp 3.000');
    q.push('Uang tidak cukup', false);
    expect(log.at(-1)).toEqual(['show', 'Uang tidak cukup', false]);
    clock.advance(2000); // galat selesai → lanjut ke antrean yang tersisa
    expect(log.at(-1)).toEqual(['show', '+Rp 3.000', true]);
  });

  it('setelah kosong dan tersembunyi, toast baru tampil lagi langsung', () => {
    const { q, clock, log } = setup();
    q.push('A');
    clock.advance(2000);
    q.push('B');
    expect(log.at(-1)).toEqual(['show', 'B', true]);
  });
});
