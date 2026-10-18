import { describe, it, expect } from 'vitest';
import { gridForRing, sampleGrid, nodesInside, densifyRing, median } from '../../tools/campusbake/terrain/grid.js';
import { boundaryReference, applyDatum } from '../../tools/campusbake/terrain/datum.js';
import { smoothstep, blendWeightAt, blendWeights, applyBlend } from '../../tools/campusbake/terrain/blend.js';
import {
  resamplePolyline, smooth3, limitGrade, maxGradeOf, ditchDepth, lipschitzOnMask, conditionRoads,
} from '../../tools/campusbake/terrain/roads.js';
import { applyPads } from '../../tools/campusbake/terrain/pads.js';
import { applyWater, lakeFloor } from '../../tools/campusbake/terrain/water.js';
import { quantize, encodeChunk, encodeChunks } from '../../tools/campusbake/terrain/writeChunks.js';
import { decodeChunk } from '../../src/geo/terrain/heightfield.js';
import { TERRAIN_HEADER } from '../../src/geo/terrain/format.js';

/** Grid kecil uji: simpul tiap 4 m, minX/minZ 0. */
const smallGrid = (cols, rows) => ({ minX: 0, minZ: 0, step: 4, cols, rows });
const fill = (g, fn) => Float64Array.from({ length: g.cols * g.rows }, (_, i) => fn(g.minX + (i % g.cols) * g.step, g.minZ + Math.floor(i / g.cols) * g.step));
const ones = (g) => new Float32Array(g.cols * g.rows).fill(1);

describe('grid', () => {
  it('gridForRing membulatkan keluar ke chunk 500 m (+ margin)', () => {
    const g = gridForRing([[-1622, -459], [444, -459], [444, 2129], [-1622, 2129]], 150);
    expect(g).toMatchObject({ minX: -2000, minZ: -1000, ix0: -4, iz0: -2, chunksX: 6, chunksZ: 7, cols: 751, rows: 876 });
  });
  it('sampleGrid bilinear & clamp; nodesInside; densify; median', () => {
    const g = smallGrid(3, 3);
    const d = fill(g, (x, z) => x + 2 * z);
    expect(sampleGrid(g, d, 2, 2)).toBeCloseTo(6, 12);
    expect(sampleGrid(g, d, -10, 100)).toBeCloseTo(16, 12);
    expect([...nodesInside(g, [[1, 1], [9, 1], [9, 9], [1, 9]])]).toEqual([0, 0, 0, 0, 1, 1, 0, 1, 1]);
    expect(densifyRing([[0, 0], [10, 0], [10, 10]], 4)).toHaveLength(3 + 3 + 4);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
});

describe('datum (median sepanjang batas)', () => {
  it('h_ref = median tinggi tepi; y = h − h_ref', () => {
    const g = smallGrid(26, 26); // 0..100 m
    const h = fill(g, (x) => 30 + x / 100); // 30 di barat, 31 di timur
    const ring = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const ref = boundaryReference(g, h, ring, 4);
    expect(ref).toBeCloseTo(30.5, 6);
    expect(applyDatum(h, ref)[0]).toBeCloseTo(-0.5, 9);
  });
});

describe('blend ke nol di tepi (smoothstep 120 m) dan mask + 60 m', () => {
  const boundary = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
  const mask = [[400, 400], [600, 400], [600, 600], [400, 600]];
  const opts = { boundary, mask, distance: 120, maskMargin: 60 };
  it('smoothstep: 0 → 0, 60 → 0,5, 120 → 1', () => {
    expect(smoothstep(0, 120, 0)).toBe(0);
    expect(smoothstep(0, 120, 60)).toBe(0.5);
    expect(smoothstep(0, 120, 200)).toBe(1);
  });
  it('w = 0 di luar batas & tepat di tepi; 0,5 di 60 m dari tepi; 0 di mask dan sampai 60 m darinya', () => {
    expect(blendWeightAt(-5, 500, opts)).toBe(0);
    expect(blendWeightAt(1e-9, 500, { ...opts, mask: null })).toBeCloseTo(0, 6);
    expect(blendWeightAt(60, 150, opts)).toBeCloseTo(0.5, 9);
    expect(blendWeightAt(200, 200, opts)).toBe(1);
    expect(blendWeightAt(500, 500, opts)).toBe(0);
    expect(blendWeightAt(500, 340, opts)).toBe(0); // 60 m dari mask
    expect(blendWeightAt(500, 280, opts)).toBeCloseTo(0.5, 9); // 120 m dari mask → smoothstep(0,120,60)
  });
  it('grid: semua simpul di luar batas tepat 0 setelah applyBlend', () => {
    const g = { minX: -100, minZ: -100, step: 20, cols: 61, rows: 61 };
    const w = blendWeights(g, opts);
    const y = applyBlend(new Float64Array(w.length).fill(5), w);
    for (let i = 0; i < y.length; i += 1) {
      const x = g.minX + (i % g.cols) * g.step;
      const z = g.minZ + Math.floor(i / g.cols) * g.step;
      if (x <= 0 || z <= 0 || x >= 1000 || z >= 1000) expect(y[i]).toBe(0);
    }
    expect(y[30 * 61 + 15]).toBeGreaterThan(0); // (200, 500)
  });
});

describe('pengondisian jalan', () => {
  it('resamplePolyline tiap ≤ 4 m; smooth3 [¼ ½ ¼] dengan ujung tetap', () => {
    const { pts, s } = resamplePolyline([[0, 0], [10, 0]], 4);
    expect(pts).toHaveLength(4);
    expect(s[3]).toBeCloseTo(10, 12);
    expect([...smooth3([0, 4, 0, 4])]).toEqual([0, 2, 2, 4]);
  });

  it('limitGrade: profil undak 0 → 2 m dalam 4 m dibatasi ≤ 6% (rerata maju+mundur)', () => {
    const s = Array.from({ length: 21 }, (_, i) => i * 4);
    const v = s.map((d) => (d < 40 ? 0 : 2));
    const out = limitGrade(v, s, 0.06);
    expect(maxGradeOf(v, s)).toBeCloseTo(0.5, 9);
    expect(maxGradeOf(out, s)).toBeLessThanOrEqual(0.06 + 1e-12);
    // maju: 0,24 m per 4 m mulai i = 10; mundur: 2 − 0,24·(10 − i) sebelum undak → rerata simetris
    expect(out[0]).toBe(0);
    expect(out[9]).toBeCloseTo(0.88, 12);
    expect(out[10]).toBeCloseTo(1.12, 12);
    expect(out[20]).toBe(2);
  });

  it('ditchDepth: 0,6 m di sumbu parit, 0 jauh darinya; dimatikan → 0', () => {
    const ditch = { enabled: true, width: 1, depth: 0.6, offset: 1 };
    expect(ditchDepth(5 + 1 + 0.5, 5, ditch, 4)).toBeCloseTo(0.6, 12);
    expect(ditchDepth(20, 5, ditch, 4)).toBe(0);
    expect(ditchDepth(6.5, 5, { ...ditch, enabled: false }, 4)).toBe(0);
  });

  it('lipschitzOnMask: undak 1 m antar simpul bertetangga → ≤ g per meter, konstanta tetap', () => {
    const g = smallGrid(10, 1);
    const mask = new Uint8Array(10).fill(1);
    const v = Float64Array.from({ length: 10 }, (_, i) => (i < 5 ? 0 : 1));
    const out = lipschitzOnMask(g, mask, v, 0.06);
    for (let i = 1; i < 10; i += 1) expect(Math.abs(out[i] - out[i - 1])).toBeLessThanOrEqual(0.06 * 4 + 1e-12);
    expect([...lipschitzOnMask(g, mask, new Float64Array(10).fill(2), 0.06)]).toEqual(new Array(10).fill(2));
    const partial = new Uint8Array(10);
    expect(lipschitzOnMask(g, partial, v, 0.06)).toEqual(v);
  });

  it('conditionRoads: bukit 3 m di jalan lurus → inti ≤ 6% (+toleransi bilinear), simpul w = 0 tidak disentuh', () => {
    const g = smallGrid(101, 21); // 400 × 80 m
    const data = fill(g, (x) => 3 * Math.exp(-(((x - 200) / 25) ** 2)));
    const w = ones(g);
    for (let r = 0; r < g.rows; r += 1) w[r * g.cols] = 0; // kolom x = 0 di luar distrik
    const road = { id: 'w1', cls: 'tertiary', width: 10, line: [[0, 40], [400, 40]] };
    const res = conditionRoads(g, data, w, [road], { spacing: 4, maxGrade: 0.06, shoulder: 1.5, blend: 6, ditch: null });
    const { pts, s } = resamplePolyline(road.line, 4);
    const profile = pts.map(([x, z]) => sampleGrid(g, res.data, x, z));
    expect(maxGradeOf(profile.slice(1), s.slice(1))).toBeLessThanOrEqual(0.06 + 0.005);
    expect(res.stats[0].gradeBefore).toBeGreaterThan(0.1);
    expect(res.stats[0].gradeAfter).toBeLessThanOrEqual(0.06 + 1e-12);
    expect(res.data[10 * g.cols]).toBe(data[10 * g.cols]); // w = 0
    expect(res.core[10 * g.cols + 50]).toBe(1); // (200, 40) inti jalan
    expect(res.data[0]).toBe(data[0]); // (0, 0) jauh dari jalan
  });

  it('simpang dua jalan beda profil tanpa tangga (Lipschitz inti)', () => {
    const g = smallGrid(51, 51); // 200 × 200 m
    const data = fill(g, (x, z) => 0.2 * Math.max(0, x - 100) + 0.05 * z);
    const roads = [
      { id: 'a', cls: 'service', width: 4.5, line: [[0, 100], [200, 100]] },
      { id: 'b', cls: 'service', width: 4.5, line: [[100, 0], [100, 200]] },
    ];
    const res = conditionRoads(g, data, ones(g), roads, { spacing: 4, maxGrade: 0.06, shoulder: 1.5, blend: 6, ditch: null });
    for (const road of roads) {
      const { pts, s } = resamplePolyline(road.line, 4);
      const prof = pts.map(([x, z]) => sampleGrid(g, res.data, x, z));
      expect(maxGradeOf(prof, s)).toBeLessThanOrEqual(0.07);
    }
  });
});

describe('pad gedung', () => {
  it('footprint rata ke median, blend 4 m; simpul terkunci (inti jalan) tidak diubah', () => {
    const g = smallGrid(11, 11); // 40 × 40 m
    const data = fill(g, (x) => x / 10); // 0..4 m
    const ring = [[10, 10], [22, 10], [22, 22], [10, 22]];
    const locked = new Uint8Array(121);
    locked[5 * 11 + 7] = 1; // (28, 20): 6 m di luar → di luar blend juga, tidak berpengaruh
    locked[3 * 11 + 3] = 1; // (12, 12) di dalam pad tetapi terkunci
    const res = applyPads(g, data, ones(g), [{ id: 'w9', ring, y: 'median' }], { blend: 4 }, locked);
    // simpul dalam: x = 12, 16, 20 (× 3 baris) → median 1,6
    expect(res.stats).toEqual([{ id: 'w9', target: 1.6, nodes: 9 }]);
    expect(res.data[4 * 11 + 4]).toBeCloseTo(1.6, 12); // (16, 16)
    expect(res.data[3 * 11 + 3]).toBe(data[3 * 11 + 3]); // terkunci
    expect(res.data[4 * 11 + 6]).toBeCloseTo(1.6 + (2.4 - 1.6) * 0.5, 12); // (24,16): 2 m dari tepi → separuh
    expect(res.data[4 * 11 + 8]).toBe(data[4 * 11 + 8]); // (32,16) di luar blend
  });
  it('pad dengan y angka tetap', () => {
    const g = smallGrid(11, 11);
    const res = applyPads(g, fill(g, () => 0), ones(g), [{ id: 'p', ring: [[10, 10], [22, 10], [22, 22], [10, 22]], y: 0.75 }], { blend: 4 });
    expect(res.data[4 * 11 + 4]).toBe(0.75);
  });
});

describe('danau', () => {
  it('lakeFloor: tepi = tanah tepi terendah, lereng 1:3, dasar = muka − 1,5', () => {
    const o = { shoreDrop: 0.4, depth: 1.5, bankRun: 3 };
    expect(lakeFloor(0, 2, o)).toBe(2);
    expect(lakeFloor(3, 2, o)).toBe(1);
    expect(lakeFloor(100, 2, o)).toBeCloseTo(0.1, 12); // 2 − 0,4 − 1,5
  });
  it('applyWater: muka air = min tepi − 0,4; hanya menggali; tingkat dilaporkan', () => {
    const g = smallGrid(26, 26);
    const data = fill(g, (x) => 1 + x / 100); // tepi barat x = 20 → 1,2 terendah
    const lake = { id: 'w1', name: 'Uji', ring: [[20, 20], [80, 20], [80, 80], [20, 80]] };
    const res = applyWater(g, data, ones(g), [lake], { shoreDrop: 0.4, depth: 1.5, bankRun: 3 });
    expect(res.levels).toEqual([{ id: 'w1', name: 'Uji', level: 0.8, bed: -0.7 }]);
    expect(res.data[12 * 26 + 12]).toBeCloseTo(-0.7, 9); // tengah (48, 48): dasar
    expect(res.data[0]).toBe(data[0]);
    for (let i = 0; i < data.length; i += 1) expect(res.data[i]).toBeLessThanOrEqual(data[i]);
  });
});

describe('kuantisasi & chunk', () => {
  it('quantize: 0 → 5000, 12,345 → 6235, −50 → 0, di-clamp', () => {
    expect(quantize(0)).toBe(5000);
    expect(quantize(12.345)).toBe(6235);
    expect(quantize(-50)).toBe(0);
    expect(quantize(-80)).toBe(0);
    expect(quantize(700)).toBe(65535);
  });
  it('encodeChunk ↔ decodeChunk pulang-pergi (tepi bersama), chunk nol dilewati', () => {
    const grid = { minX: -500, minZ: 0, step: 4, cols: 251, rows: 126, ix0: -1, iz0: 0, chunksX: 2, chunksZ: 1 };
    const data = fill(grid, (x, z) => (x <= 0 ? 0 : 0.01 * x + 0.02 * z)); // kolom bersama x = 0 bernilai 0
    const chunks = encodeChunks(grid, data);
    expect(chunks.map((c) => c.key)).toEqual(['0_0']); // -1_0 semua nol
    const c = decodeChunk(new Uint8Array(chunks[0].buffer).buffer.slice(0), { ...TERRAIN_HEADER, key: '0_0' });
    expect((c.data[0] - 5000) * 0.01).toBeCloseTo(0, 9);
    expect((c.data[125 * 126 + 125] - 5000) * 0.01).toBeCloseTo(5 + 10, 9);
    expect(encodeChunk(grid, data, -1, 0).empty).toBe(true);
    expect(() => encodeChunk(grid, data, 1, 0)).toThrow(/di luar grid/);
  });
});
