import { describe, expect, it } from 'vitest';
import { fbm, hash2, periodicNoise } from '../src/world/textures/noise.js';

/** Rumus asli periodicNoise (tanpa cache kisi): acuan bahwa cache tidak mengubah satu bit pun. */
function reference(x, y, periodX, periodY = periodX, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const wx = (v) => ((v % periodX) + periodX) % periodX;
  const wy = (v) => ((v % periodY) + periodY) % periodY;
  const a = hash2(wx(xi), wy(yi), seed);
  const b = hash2(wx(xi + 1), wy(yi), seed);
  const c = hash2(wx(xi), wy(yi + 1), seed);
  const d = hash2(wx(xi + 1), wy(yi + 1), seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

describe('periodicNoise dengan cache kisi', () => {
  it('identik dengan rumus asli untuk periode bulat, termasuk tepi bungkus', () => {
    for (const [px, py, seed] of [[8, 8, 0], [16, 4, 17], [3, 5, 34], [64, 64, 51]]) {
      for (let i = 0; i < 400; i += 1) {
        const x = (i * 0.37) % (px * 2);
        const y = (i * 0.61) % (py * 2);
        expect(periodicNoise(x, y, px, py, seed)).toBe(reference(x, y, px, py, seed));
      }
      expect(periodicNoise(px - 1e-9, py - 1e-9, px, py, seed)).toBe(reference(px - 1e-9, py - 1e-9, px, py, seed));
    }
  });

  it('periode pecahan tetap memakai rumus asli', () => {
    expect(periodicNoise(2.3, 1.7, 4.5, 3.25, 9)).toBe(reference(2.3, 1.7, 4.5, 3.25, 9));
  });

  it('fbm deterministik dan tetap periodik di tepi tile', () => {
    const opts = { freq: 8, octaves: 4, seed: 3 };
    expect(fbm(0.25, 0.75, opts)).toBe(fbm(0.25, 0.75, opts));
    expect(fbm(0, 0.4, opts)).toBeCloseTo(fbm(1, 0.4, opts), 12);
  });
});
