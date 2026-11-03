import { describe, expect, it } from 'vitest';
import { beamAt, deckAt, deckPoint, hullGrid, keelAt, sectionPoint } from '../../src/dev/skala/hullMath.js';

const H = { length: 45, beam: 10.5, draft: 4.6, freeboard: 4.2, sheerAft: 4.5, sheerFwd: 2.2, transom: 0.62, bulwark: 1 };

describe('hullMath (lambung maket)', () => {
  it('lebar penuh di tengah, runcing di haluan, buritan rata = transom', () => {
    expect(beamAt(0.5, H)).toBeCloseTo(1);
    expect(beamAt(1, H)).toBeCloseTo(0);
    expect(beamAt(0, H)).toBeCloseTo(H.transom);
    for (let u = 0; u <= 1; u += 0.05) expect(beamAt(u, H)).toBeGreaterThanOrEqual(0);
  });

  it('geladak naik ke ujung (sheer), lunas terdalam di tengah = draft', () => {
    expect(deckAt(0, H)).toBeCloseTo(H.freeboard + H.sheerAft);
    expect(deckAt(1, H)).toBeCloseTo(H.freeboard + H.sheerFwd);
    expect(keelAt(0.5, H)).toBeCloseTo(-H.draft);
    expect(keelAt(0, H)).toBeGreaterThan(keelAt(0.5, H));
  });

  it('penampang simetris kiri-kanan, ujung = bibir geladak, tengah = lunas', () => {
    const K = 14;
    const [x0, y0, z0] = sectionPoint(0.5, 0, K, H);
    const [, yK, zK] = sectionPoint(0.5, K, K, H);
    expect(x0).toBeCloseTo(0);
    expect(z0).toBeCloseTo(H.beam / 2);
    expect(zK).toBeCloseTo(-H.beam / 2);
    expect(y0).toBeCloseTo(yK);
    const [, yMid, zMid] = sectionPoint(0.5, K / 2, K, H);
    expect(yMid).toBeCloseTo(-H.draft);
    expect(zMid).toBeCloseTo(0);
  });

  it('grid lambung lengkap tanpa NaN, indeks dalam rentang', () => {
    const { positions, indices, S, K } = hullGrid(H, 20, 8);
    expect(positions.length).toBe((S + 1) * (K + 1) * 3);
    expect(positions.every(Number.isFinite)).toBe(true);
    expect(Math.max(...indices)).toBeLessThan((S + 1) * (K + 1));
    const xs = positions.filter((_, i) => i % 3 === 0);
    expect(Math.min(...xs)).toBeCloseTo(-H.length / 2);
    expect(Math.max(...xs)).toBeCloseTo(H.length / 2);
  });

  it('titik geladak berada di dalam lebar lambung', () => {
    for (const [u, v] of [[0.1, 1], [0.5, -1], [0.9, 0.5]]) {
      const [, , z] = deckPoint(u, v, H);
      expect(Math.abs(z)).toBeLessThan((H.beam / 2) * beamAt(u, H));
    }
  });
});
