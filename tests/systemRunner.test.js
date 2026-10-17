import { describe, it, expect } from 'vitest';
import { createSystemRunner, PHASES, MAX_CONSECUTIVE_FAILURES } from '../src/engine/SystemRunner.js';

const quietLogger = () => {
  const calls = [];
  return { calls, error: (...args) => calls.push(args) };
};
const sys = (id, phase, update = () => {}, extra = {}) => ({ id, phase, update, dispose() {}, ...extra });
const boom = () => { throw new Error('rusak'); };

describe('SystemRunner: urutan fase', () => {
  it('menjalankan input → sim → world → camera → ui; dalam satu fase sesuai urutan daftar', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    const log = [];
    const mk = (id, phase) => sys(id, phase, () => log.push(id));
    r.add(mk('ui1', 'ui'));
    r.add(mk('w1', 'world'));
    r.add(mk('in1', 'input'));
    r.add(mk('w2', 'world'));
    r.add(mk('cam', 'camera'));
    r.add(mk('sim1', 'sim'));
    r.update(0.016, {});
    expect(log).toEqual(['in1', 'sim1', 'w1', 'w2', 'cam', 'ui1']);
    expect(r.ids).toEqual(log);
    expect(PHASES).toEqual(['input', 'sim', 'world', 'camera', 'ui']);
  });

  it('meneruskan dt dan ctx apa adanya', () => {
    const r = createSystemRunner();
    const seen = [];
    const ctx = { time: 3 };
    r.add(sys('a', 'sim', (dt, c) => seen.push([dt, c])));
    r.update(0.02, ctx);
    expect(seen).toEqual([[0.02, ctx]]);
  });
});

describe('SystemRunner: isolasi galat', () => {
  it('sistem yang melempar tidak menghentikan sistem lain', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    let n = 0;
    r.add(sys('rusak', 'sim', boom));
    r.add(sys('sehat', 'ui', () => { n += 1; }));
    r.update(0.016, {});
    expect(n).toBe(1);
    expect(r.has('rusak')).toBe(true);
  });

  it(`dinonaktifkan setelah ${MAX_CONSECUTIVE_FAILURES} galat beruntun dan dicatat dengan id`, () => {
    const logger = quietLogger();
    const r = createSystemRunner({ logger });
    let n = 0;
    r.add(sys('rusak', 'world', boom));
    r.add(sys('sehat', 'ui', () => { n += 1; }));
    for (let i = 0; i < 3; i += 1) r.update(0.016, {});
    expect(r.has('rusak')).toBe(false);
    expect(r.disabled).toEqual(['rusak']);
    expect(n).toBe(3);
    expect(logger.calls).toHaveLength(2);
    expect(logger.calls[0][0]).toContain('"rusak"');
    expect(logger.calls[1][0]).toContain('dinonaktifkan');
    expect(logger.calls[1][0]).toContain('"rusak"');
    r.update(0.016, {});
    expect(n).toBe(4);
  });

  it('galat yang diselingi frame sukses mereset hitungan', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    const plan = [true, true, false, true, true, true];
    let frame = 0;
    r.add(sys('kadang', 'sim', () => { if (plan[frame]) throw new Error('x'); }));
    for (; frame < 5; frame += 1) r.update(0.016, {});
    expect(r.has('kadang')).toBe(true);
    r.update(0.016, {});
    expect(r.has('kadang')).toBe(false);
  });
});

describe('SystemRunner: pendaftaran & dispose', () => {
  it('menolak sistem tidak valid dan id ganda', () => {
    const r = createSystemRunner();
    expect(() => r.add({ phase: 'sim', update() {} })).toThrow(TypeError);
    expect(() => r.add(sys('a', 'render'))).toThrow(TypeError);
    expect(() => r.add({ id: 'b', phase: 'sim' })).toThrow(TypeError);
    r.add(sys('a', 'sim'));
    expect(() => r.add(sys('a', 'ui'))).toThrow(/sudah terdaftar/);
  });

  it('remove mengembalikan true/false; sistem tanpa dispose diperbolehkan', () => {
    const r = createSystemRunner();
    r.add({ id: 'tanpaDispose', phase: 'ui', update() {} });
    expect(r.remove('tanpaDispose')).toBe(true);
    expect(r.remove('tanpaDispose')).toBe(false);
  });

  it('dispose memanggil dispose tiap sistem, galatnya diisolasi, runner kosong', () => {
    const logger = quietLogger();
    const r = createSystemRunner({ logger });
    const order = [];
    r.add(sys('a', 'sim', () => {}, { dispose: () => order.push('a') }));
    r.add(sys('b', 'ui', () => {}, { dispose: () => { throw new Error('gagal'); } }));
    r.add({ id: 'c', phase: 'world', update() {} });
    r.dispose();
    expect(order).toEqual(['a']);
    expect(logger.calls).toHaveLength(1);
    expect(logger.calls[0][0]).toContain('"b"');
    expect(r.ids).toEqual([]);
  });
});

describe('SystemRunner: remove, snapshot, dispose LIFO (Plan C)', () => {
  it('remove memanggil dispose sistem sekali; {dispose:false} tidak', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    const seen = [];
    r.add(sys('a', 'sim', () => {}, { dispose: () => seen.push('a') }));
    r.add(sys('b', 'sim', () => {}, { dispose: () => seen.push('b') }));
    expect(r.remove('a')).toBe(true);
    expect(r.remove('a')).toBe(false);
    expect(r.remove('b', { dispose: false })).toBe(true);
    expect(seen).toEqual(['a']);
  });

  it('galat dispose saat remove dicatat dengan id, sistem tetap tercabut', () => {
    const logger = quietLogger();
    const r = createSystemRunner({ logger });
    r.add(sys('rapuh', 'ui', () => {}, { dispose: boom }));
    expect(r.remove('rapuh')).toBe(true);
    expect(r.has('rapuh')).toBe(false);
    expect(logger.calls[0][0]).toContain('"rapuh"');
  });

  it('sistem yang dicabut sistem lain di tengah frame tidak dijalankan lagi pada frame itu', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    const log = [];
    r.add(sys('pencabut', 'sim', () => { log.push('pencabut'); r.remove('korban'); }));
    r.add(sys('korban', 'world', () => log.push('korban')));
    r.update(0.016, {});
    r.update(0.016, {});
    expect(log).toEqual(['pencabut', 'pencabut']);
  });

  it('dispose melepas terbalik dari urutan pendaftaran, lintas fase', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    const order = [];
    const mk = (id, phase) => sys(id, phase, () => {}, { dispose: () => order.push(id) });
    r.add(mk('ui1', 'ui'));
    r.add(mk('in1', 'input'));
    r.add(mk('w1', 'world'));
    r.dispose();
    expect(order).toEqual(['w1', 'in1', 'ui1']);
    r.update(0.016, {});
    expect(r.ids).toEqual([]);
  });
});

describe('SystemRunner: sistem yang dinonaktifkan tetap dilepas', () => {
  it('runner.dispose() memanggil dispose sistem nonaktif tepat sekali, urutan LIFO bersama sistem aktif', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    const order = [];
    r.add(sys('a', 'sim', () => {}, { dispose: () => order.push('a') }));
    r.add(sys('rusak', 'world', boom, { dispose: () => order.push('rusak') }));
    r.add(sys('c', 'ui', () => {}, { dispose: () => order.push('c') }));
    for (let i = 0; i < MAX_CONSECUTIVE_FAILURES; i += 1) r.update(0.016, {});
    expect(r.disabled).toEqual(['rusak']);
    expect(order).toEqual([]); // belum dilepas saat dinonaktifkan
    r.dispose();
    expect(order).toEqual(['c', 'rusak', 'a']);
    r.dispose();
    expect(order).toEqual(['c', 'rusak', 'a']); // tidak dobel
  });

  it('galat dispose sistem nonaktif dicatat, tidak menghentikan pelepasan lain', () => {
    const logger = quietLogger();
    const r = createSystemRunner({ logger });
    const order = [];
    r.add(sys('a', 'sim', () => {}, { dispose: () => order.push('a') }));
    r.add(sys('rusak', 'world', boom, { dispose: boom }));
    for (let i = 0; i < MAX_CONSECUTIVE_FAILURES; i += 1) r.update(0.016, {});
    const before = logger.calls.length;
    r.dispose();
    expect(order).toEqual(['a']);
    expect(logger.calls).toHaveLength(before + 1);
    expect(logger.calls.at(-1)[0]).toContain('"rusak"');
  });
});
