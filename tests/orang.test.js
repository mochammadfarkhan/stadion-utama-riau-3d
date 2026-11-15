import { describe, it, expect } from 'vitest';
import { pickKarakter, loopTime, ORANG_KARAKTER } from '../src/entities/Orang.js';
import { makeRng } from '../src/entities/util.js';

describe('pack orang', () => {
  it('pickKarakter: deterministik, tidak pernah memilih bobot 0, semua kasual muncul', () => {
    const rng = makeRng(42);
    const seen = new Map();
    for (let i = 0; i < 2000; i += 1) {
      const id = pickKarakter(rng);
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    expect(seen.has('polisi-wanita')).toBe(false);
    for (const id of ['kasual-pria-g', 'kasual-pria-k', 'kasual-wanita-g', 'kasual-wanita-k']) expect(seen.get(id)).toBeGreaterThan(200);
    expect(pickKarakter(makeRng(7))).toBe(pickKarakter(makeRng(7)));
    expect(Object.keys(ORANG_KARAKTER)).toHaveLength(9);
  });
  it('loopTime: berulang, aman untuk negatif/NaN/durasi 0', () => {
    expect(loopTime(2.5, 1)).toBeCloseTo(0.5);
    expect(loopTime(-0.25, 1)).toBeCloseTo(0.75);
    expect(loopTime(Number.NaN, 1)).toBe(0);
    expect(loopTime(3, 0)).toBe(0);
  });
});
