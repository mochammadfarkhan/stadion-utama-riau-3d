import { describe, it, expect } from 'vitest';
import { computeObb } from '../../src/world/kit/obb.js';
import { decomposeFootprint, orthogonalFraction, snapValues } from '../../src/world/kit/decompose.js';
import { polygonArea } from '../../src/geo/polygon.js';

// Ring nyata dari data-src/osm/stadion.json (dunia, dikuantisasi 0,1 m seperti buildings.json).
const PERPUSTAKAAN = [[-1124, 745.8], [-1127, 745.8], [-1126.9, 732.6], [-1123.7, 732.6], [-1123.7, 725.1], [-1102.5, 725.2], [-1102.5, 732.3], [-1097.3, 732.3], [-1097.2, 722.2], [-1073.8, 722.4], [-1073.8, 731.9], [-1070.3, 731.9], [-1070.4, 745.2], [-1074, 745.1], [-1074, 751], [-1097.5, 750.9], [-1097.5, 745.5], [-1102.8, 745.5], [-1102.8, 753.4], [-1124, 753.3]];
const FKIP_EKONOMI = [[-1047.6, 1100.6], [-1031.5, 1100.3], [-1031.3, 1084.9], [-1014.9, 1085.1], [-1015, 1100.1], [-999.8, 1100.6], [-999.8, 1116.9], [-1016.2, 1116.5], [-1015.8, 1134.2], [-1030.9, 1133.8], [-1030.7, 1116.8], [-1047.6, 1116.9]];
const FT_SETENGAH_BUNDAR = [[-1451.6, 368.9], [-1447.9, 378.2], [-1443.3, 384.5], [-1434.6, 390.8], [-1423.3, 391.2], [-1410.7, 388.8], [-1402.6, 381.3], [-1399.2, 373.8], [-1396, 365.5], [-1378.3, 368.1], [-1381.6, 382], [-1388.3, 396.3], [-1400.8, 406.9], [-1412.4, 411.3], [-1427, 412.9], [-1439.2, 409.5], [-1453.8, 402.1], [-1461.7, 396.1], [-1467.2, 387.9], [-1469, 382.1], [-1470, 373.7]];
const GGM = [[170.9, 422.9], [162, 436.1], [148.8, 444.9], [133.1, 448], [117.5, 444.9], [104.2, 436.1], [95.4, 422.9], [92.3, 407.4], [95.4, 391.9], [104.2, 378.7], [117.5, 369.9], [133.1, 366.8], [148.8, 369.9], [162, 378.7], [170.9, 391.9], [174, 407.4]];

const run = (ring) => decomposeFootprint(ring, computeObb(ring));
const total = (r) => r.masses.reduce((s, m) => s + m.w * m.d, 0);

describe('decompose', () => {
  it('snapValues menggabungkan nilai berdekatan', () => {
    expect(snapValues([0, 0.2, 10, 10.4, 30], 0.6)).toEqual([0.1, 10.2, 30]);
  });

  it('L 30×30 (lengan 10): dua massa, luas tepat 500 m², w ≥ d', () => {
    const r = run([[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]]);
    expect(r.masses).toHaveLength(2);
    expect(total(r)).toBeCloseTo(500, 6);
    expect(r.coverage).toBeCloseTo(1, 6);
    for (const m of r.masses) expect(m.w).toBeGreaterThanOrEqual(m.d);
  });

  it('U: tiga massa; T: dua massa (terbesar dulu)', () => {
    const u = run([[0, 0], [40, 0], [40, 30], [30, 30], [30, 10], [10, 10], [10, 30], [0, 30]]);
    expect(u.masses).toHaveLength(3);
    expect(total(u)).toBeCloseTo(800, 6);
    const t = run([[0, 0], [30, 0], [30, 10], [20, 10], [20, 30], [10, 30], [10, 10], [0, 10]]);
    expect(t.masses).toHaveLength(2);
    expect(t.masses[0].w * t.masses[0].d).toBeCloseTo(300, 6);
  });

  it('L diputar 37°: massa mewarisi yaw frame', () => {
    const c = Math.cos(37 * Math.PI / 180);
    const s = Math.sin(37 * Math.PI / 180);
    const ring = [[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]].map(([x, z]) => [x * c - z * s, x * s + z * c]);
    const r = run(ring);
    expect(r.masses).toHaveLength(2);
    expect(total(r)).toBeCloseTo(500, 3);
    const yaws = r.masses.map((m) => Math.abs(Math.sin(2 * m.yaw)));
    for (const y of yaws) expect(y).toBeCloseTo(Math.abs(Math.sin(2 * (-37 * Math.PI / 180))), 3);
  });

  it('Perpustakaan UNRI (20 titik, tonjolan 3 m): ≤ 4 massa, cakupan ≥ 0,9 (snap bertingkat)', () => {
    const r = run(PERPUSTAKAAN);
    expect(r).not.toBeNull();
    expect(r.masses.length).toBeLessThanOrEqual(4);
    expect(r.coverage).toBeGreaterThanOrEqual(0.9);
  });

  it('Gedung C FKIP Ekonomi (silang miring terhadap OBB): frame sisi dominan → 3 massa, cakupan ≈ 1', () => {
    const r = run(FKIP_EKONOMI);
    expect(r.masses).toHaveLength(3);
    expect(r.coverage).toBeGreaterThan(0.97);
    expect(total(r)).toBeCloseTo(polygonArea(FKIP_EKONOMI), -1);
  });

  it('lengkung (Gedung C FT "setengah bundar", GGM): null → K12 ekstrusi', () => {
    expect(orthogonalFraction(FT_SETENGAH_BUNDAR)).toBeLessThan(0.75);
    expect(run(FT_SETENGAH_BUNDAR)).toBeNull();
    expect(run(GGM)).toBeNull();
  });

  it('ring rusak → null', () => {
    expect(decomposeFootprint([[0, 0], [1, 1]], { cx: 0, cz: 0, yaw: 0 })).toBeNull();
  });
});
