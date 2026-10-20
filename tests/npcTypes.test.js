import { describe, it, expect } from 'vitest';
import { NPC_TYPES, NPC_MIX, outfitForNpcType, pickNpcType, outfitFromMix } from '../src/entities/npcTypes.js';
import { makeRng } from '../src/entities/util.js';

describe('npcTypes', () => {
  it('setiap tipe menghasilkan opsi humanoid yang sah', () => {
    for (const type of NPC_TYPES) {
      for (let s = 1; s <= 30; s += 1) {
        const o = outfitForNpcType(type, makeRng(s));
        expect(o.npcType).toBe(type);
        expect(Number.isFinite(o.skin) && Number.isFinite(o.shirt)).toBe(true);
        expect(o.height).toBeGreaterThan(0.9);
        expect(o.height).toBeLessThan(1.9);
        if (o.hijab != null) expect(o.hair == null || o.hair === 'hijab').toBe(true);
      }
    }
  });

  it('anak lebih pendek dari dewasa, dosen berlengan panjang', () => {
    for (let s = 1; s <= 30; s += 1) {
      expect(outfitForNpcType('anak', makeRng(s)).height).toBeLessThanOrEqual(1.3);
      expect(outfitForNpcType('dosen', makeRng(s)).longSleeve).toBe(true);
    }
  });

  it('tipe tak dikenal jatuh ke pengunjung', () => {
    expect(outfitForNpcType('alien', makeRng(1)).npcType).toBe('pengunjung');
  });

  it('pickNpcType mengikuti bobot dan deterministik', () => {
    const rng = makeRng(42);
    const counts = {};
    for (let i = 0; i < 4000; i += 1) {
      const t = pickNpcType(NPC_MIX.kampus, rng);
      counts[t] = (counts[t] ?? 0) + 1;
    }
    expect(counts.mahasiswa / 4000).toBeGreaterThan(0.72);
    expect(counts.mahasiswa / 4000).toBeLessThan(0.84);
    expect(counts.dosen).toBeGreaterThan(0);
    expect(counts.satpam).toBeUndefined();
    const strip = ({ rng: _r, ...o }) => o;
    expect(strip(outfitFromMix(NPC_MIX.plaza, makeRng(7)))).toEqual(strip(outfitFromMix(NPC_MIX.plaza, makeRng(7))));
  });

  it('campuran kosong/rusak aman', () => {
    expect(pickNpcType({}, makeRng(1))).toBe('pengunjung');
    expect(pickNpcType({ dosen: -1, anak: Number.NaN }, makeRng(1))).toBe('pengunjung');
    expect(pickNpcType({ anak: 1 }, () => 0.999999)).toBe('anak');
  });
});
