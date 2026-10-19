import { describe, expect, it } from 'vitest';
import {
  WORLD_RECIPES, compressSaturation, dominantAxis, kitCellRole, projectBasis, projectUv, recipeForMaterial,
} from '../src/world/textures/pbrWorldCore.js';
import { ATLAS_CELLS, cellUv } from '../src/world/kit/atlas.js';
import { TILE_M } from '../src/world/textures/pbrCore.js';

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('recipeForMaterial', () => {
  it('memetakan nama GLB hero ke set PBR', () => {
    expect(recipeForMaterial('unri:dinding').set).toBe('plaster');
    expect(recipeForMaterial('unri:plint').set).toBe('concrete');
    expect(recipeForMaterial('unri:beton').set).toBe('concrete');
    expect(recipeForMaterial('unri:atap-biru').set).toBe('roofSteel');
    expect(recipeForMaterial('unri:atap-bubungan').set).toBe('roofSteel');
    expect(recipeForMaterial('unri:kayu').set).toBe('wood');
    expect(recipeForMaterial('UNRI:Dinding').set).toBe('plaster');
  });
  it('mengabaikan kaca, kusen, lampu, nama kosong atau bukan string', () => {
    for (const n of ['unri:kaca', 'unri:kusen', 'unri:lampu-emisif', 'unri:pintu-biru', '', undefined, null, 3]) expect(recipeForMaterial(n)).toBeNull();
  });
  it('semua set resep punya ukuran tile', () => {
    for (const r of Object.values(WORLD_RECIPES)) expect(TILE_M[r.set]).toBeGreaterThan(0);
  });
});

describe('dominantAxis / projectUv', () => {
  it('memilih sumbu terbesar; seri y menang', () => {
    expect(dominantAxis(0, 1, 0)).toBe('y');
    expect(dominantAxis(0.7, 0.7, 0)).toBe('y');
    expect(dominantAxis(0.9, 0.2, 0.1)).toBe('x');
    expect(dominantAxis(-0.1, 0.2, -0.95)).toBe('z');
    expect(dominantAxis(0.5, 0.2, -0.5)).toBe('x');
  });
  it('UV tangan-kanan: u x v searah normal untuk 6 sisi', () => {
    for (const n of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const { u, v } = projectBasis(n);
      expect(dot(cross(u, v), n)).toBeGreaterThan(0.99);
    }
  });
  it('projectUv konsisten dengan projectBasis', () => {
    const p = [3.5, -2, 7.25];
    for (const n of [[1, 0.1, 0], [-1, 0, 0.2], [0.1, 1, 0], [0, -1, 0.1], [0.1, 0, 1], [0, 0.2, -1]]) {
      const { u, v } = projectBasis(n);
      const uv = projectUv(n, p);
      expect(uv[0]).toBeCloseTo(dot(u, p));
      expect(uv[1]).toBeCloseTo(dot(v, p));
    }
  });
  it('dinding vertikal: v = tinggi dunia (y) sehingga tekstur tegak', () => {
    expect(projectUv([0, 0, 1], [10, 4.5, 3])[1]).toBe(4.5);
    expect(projectUv([-1, 0, 0], [10, 4.5, 3])[1]).toBe(4.5);
  });
});

describe('compressSaturation', () => {
  const sat = (c) => { const mx = Math.max(...c); return mx ? (mx - Math.min(...c)) / mx : 0; };
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  it('tidak mengubah warna yang kejenuhannya di bawah batas', () => {
    expect(compressSaturation([0.5, 0.45, 0.4], 0.45)).toEqual([0.5, 0.45, 0.4]);
  });
  it('mengompres kobalt jenuh: kejenuhan turun, luminans tetap, tak ada kanal negatif', () => {
    const cobalt = [0.017, 0.084, 0.55];
    const out = compressSaturation(cobalt, 0.42);
    expect(sat(out)).toBeLessThan(sat(cobalt));
    expect(sat(out)).toBeGreaterThan(0.42);
    expect(lum(out)).toBeCloseTo(lum(cobalt), 4);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
  });
  it('monoton: warna lebih jenuh tetap lebih jenuh sesudah kompres', () => {
    const a = compressSaturation([0.1, 0.2, 0.6], 0.4);
    const b = compressSaturation([0.02, 0.12, 0.6], 0.4);
    expect(sat(b)).toBeGreaterThan(sat(a));
  });
  it('abu-abu tak berubah', () => {
    expect(compressSaturation([0.3, 0.3, 0.3], 0.3)).toEqual([0.3, 0.3, 0.3]);
    expect(compressSaturation([0, 0, 0], 0.3)).toEqual([0, 0, 0]);
  });
});

describe('kitCellRole', () => {
  const mid = (id) => { const r = cellUv(id); return [(r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2]; };
  it('dinding polos: plester, plester-kusam, beton, beton-mentah, beton-coret', () => {
    for (const id of ['plester', 'plester-kusam', 'beton', 'beton-mentah', 'beton-coret']) expect(kitCellRole(...mid(id))).toBe('dinding');
  });
  it('atap seng: seng, seng-karat', () => {
    for (const id of ['seng', 'seng-karat']) expect(kitCellRole(...mid(id))).toBe('atap');
  });
  it('sel lain (jendela, pintu, roster, bata, genteng, plint, lod1) tetap atlas', () => {
    for (const id of ['nako', 'kaca-biru', 'pintu-kayu', 'roster-kotak', 'bata-merah', 'genteng', 'plint', 'keramik-dinding', 'kayu-papan', 'lod1-kuliah', 'lampu', 'railing']) {
      expect(kitCellRole(...mid(id))).toBeNull();
    }
  });
  it('tiap sel atlas tidak melintasi batas peran', () => {
    for (const id of Object.keys(ATLAS_CELLS)) {
      const r = cellUv(id);
      const roles = [[r.u0, r.v0], [r.u1, r.v0], [r.u0, r.v1], [r.u1, r.v1]].map((c) => kitCellRole(...c));
      expect(new Set(roles).size).toBe(1);
    }
  });
});
