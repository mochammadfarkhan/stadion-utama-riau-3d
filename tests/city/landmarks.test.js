import { describe, expect, it } from 'vitest';
import { LANDMARKS, landmarkDistance, pickLod } from '../../src/city/landmarks.js';

describe('pickLod', () => {
  const lim = [260, 900];
  it('memilih tingkat menurut jarak', () => {
    expect(pickLod(50, 0, lim)).toBe(0);
    expect(pickLod(500, 0, lim)).toBe(1);
    expect(pickLod(2000, 0, lim)).toBe(2);
  });
  it('histeresis: tidak berkedip tepat di batas', () => {
    expect(pickLod(270, 0, lim)).toBe(0); // naik butuh > 260*1,12
    expect(pickLod(300, 0, lim)).toBe(1);
    expect(pickLod(250, 1, lim)).toBe(1); // turun butuh < 260*0,88
    expect(pickLod(220, 1, lim)).toBe(0);
  });
});

describe('landmarkDistance', () => {
  it('menambah jarak mendatar fokus → landmark', () => {
    const lm = { x: 300, z: 400 };
    expect(landmarkDistance(0, { x: 0, z: 0 }, lm)).toBeCloseTo(500);
    expect(landmarkDistance(100, { x: 300, z: 400 }, lm)).toBeCloseTo(100);
  });
});

describe('LANDMARKS (daftar)', () => {
  it('id unik, koordinat berhingga, berkas ada di public/models/landmark', async () => {
    const { existsSync } = await import('node:fs');
    const ids = new Set();
    for (const lm of LANDMARKS) {
      expect(ids.has(lm.id)).toBe(false);
      ids.add(lm.id);
      expect(Number.isFinite(lm.x) && Number.isFinite(lm.z)).toBe(true);
      for (const f of lm.files) expect(existsSync(new URL(`../../public/models/landmark/${f}`, import.meta.url))).toBe(true);
    }
    expect(LANDMARKS.length).toBeGreaterThanOrEqual(26);
  });
});

describe('LANDMARKS', () => {
  it('tiap landmark punya 3 berkas LOD dan batas menaik', () => {
    for (const lm of LANDMARKS) {
      expect(lm.files).toHaveLength(3);
      expect(lm.lod[0]).toBeLessThan(lm.lod[1]);
    }
  });
});
