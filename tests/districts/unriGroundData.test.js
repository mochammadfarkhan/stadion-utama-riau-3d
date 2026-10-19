import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { Color } from 'three';
import { CITY_GROUND_COLOR } from '../../src/city/cityMaterials.js';
import { COLORS } from '../../src/config/constants.js';
import { GroundDataError, parseGroundChunk } from '../../src/districts/unri/groundData.js';
import { SURFACE_COLORS, sampleColor, surfaceColors, surfaceTints } from '../../src/districts/unri/surfaceTint.js';

const b64 = (arr) => Buffer.from(Uint8Array.from(arr)).toString('base64');
const base = () => ({
  v: 1,
  key: '-2_1',
  roads: [{ cls: 'tertiary', w: 70, pts: [0, 0, 100, 0] }],
  walks: [{ w: 20, pts: [0, 10, 0, 50] }],
  areas: [{ kind: 'water', rings: [[0, 0, 40, 0, 40, 40]], level: -0.4 }],
  ditches: [{ w: 10, pts: [5, 5, 50, 5] }],
  veg: [{ sp: 'mahoni', pts: [10, 20, 30, 40] }],
  props: { lamps: [10, 20, 180], benches: [], bins: [7, 8] },
  weights: { n: 4, grass: b64(new Array(16).fill(255)), soil: b64(new Array(16).fill(0)), wet: b64(new Array(16).fill(0)) },
});
const closePt = (p, q) => {
  expect(p[0]).toBeCloseTo(q[0], 9);
  expect(p[1]).toBeCloseTo(q[1], 9);
};

describe('parseGroundChunk', () => {
  it('0,1 m relatif sudut barat-laut chunk → dunia; yaw derajat → radian; bobot terdekode', () => {
    const d = parseGroundChunk(base(), '-2_1');
    expect(d.origin).toEqual({ x: -1000, z: 500 });
    expect(d.roads[0].cls).toBe('tertiary');
    expect(d.roads[0].w).toBeCloseTo(7, 12);
    closePt(d.roads[0].pts[1], [-990, 500]);
    expect(d.walks[0].w).toBeCloseTo(2, 12);
    expect(d.areas[0]).toMatchObject({ kind: 'water', level: -0.4 });
    closePt(d.areas[0].rings[0][1], [-996, 500]);
    expect(d.veg.map((v) => v.sp)).toEqual(['mahoni', 'mahoni']);
    closePt([d.veg[1].x, d.veg[1].z], [-997, 504]);
    expect(d.props.lamps[0].yaw).toBeCloseTo(Math.PI, 12);
    closePt([d.props.bins[0].x, d.props.bins[0].z], [-999.3, 500.8]);
    expect(d.ditches[0].w).toBeCloseTo(1, 12);
    expect(d.weights.n).toBe(4);
    expect(d.weights.grass[15]).toBe(255);
  });

  it.each([
    ['v salah', (j) => { j.v = 2; }, /v harus 1/],
    ['key salah', (j) => { j.key = '0_0'; }, /tidak cocok/],
    ['pts ganjil', (j) => { j.roads[0].pts = [0, 0, 1]; }, /roads\.pts/],
    ['bukan bulat', (j) => { j.walks[0].pts = [0, 0.5, 1, 1]; }, /walks\.pts/],
    ['kind asing', (j) => { j.areas[0].kind = 'kolam'; }, /tidak dikenal/],
    ['air tanpa level', (j) => { delete j.areas[0].level; }, /tanpa level/],
    ['spesies asing', (j) => { j.veg[0].sp = 'jati'; }, /tidak dikenal/],
    ['lamps bukan kelipatan 3', (j) => { j.props.lamps = [1, 2]; }, /kelipatan 3/],
    ['bobot salah panjang', (j) => { j.weights.soil = b64([1, 2]); }, /panjang/],
  ])('%s → GroundDataError', (_, mutate, re) => {
    const j = base();
    mutate(j);
    expect(() => parseGroundChunk(j, '-2_1')).toThrow(GroundDataError);
    expect(() => parseGroundChunk(j, '-2_1')).toThrow(re);
  });

  it('field ekstensi (ditches/veg/props) boleh tidak ada', () => {
    const j = base();
    delete j.ditches;
    delete j.veg;
    delete j.props;
    const d = parseGroundChunk(j, '-2_1');
    expect(d.ditches).toEqual([]);
    expect(d.veg).toEqual([]);
    expect(d.props).toEqual({ lamps: [], benches: [], bins: [] });
  });
});

describe('surfaceTint', () => {
  const tints = surfaceTints();

  it('tint rumput = 1; tint tanah × warna dasar rumput = warna tanah (linear)', () => {
    expect(tints.grass).toEqual([1, 1, 1]);
    expect(tints.soil[0] * new Color(COLORS.grass).r).toBeCloseTo(new Color(SURFACE_COLORS.soil).r, 9);
  });

  it('warna di luar distrik = CITY_GROUND_COLOR (satu nada dengan tanah kota)', () => {
    expect(SURFACE_COLORS.kota).toBe(CITY_GROUND_COLOR);
  });

  it('sampleColor: campuran berbobot; semua nol → tint kota', () => {
    expect(sampleColor(0, 0, 0, tints)).toEqual(tints.kota);
    expect(sampleColor(128, 127, 0, tints)[1]).toBeCloseTo((128 + 127 * tints.soil[1]) / 255, 9);
  });

  it('surfaceColors: bilinear antar sampel grid 4 m; di luar grid di-clamp', () => {
    const w = { n: 2, grass: Uint8Array.from([255, 0, 255, 0]), soil: Uint8Array.from([0, 255, 0, 255]), wet: new Uint8Array(4) };
    const c = surfaceColors(Float32Array.from([0, 0, 2, 0, 4, 4, -10, 0]), w, { x: 0, z: 0 }, tints);
    expect([c[0], c[1], c[2]]).toEqual([1, 1, 1]);
    expect(c[3]).toBeCloseTo((1 + tints.soil[0]) / 2, 6);
    expect(c[6]).toBeCloseTo(tints.soil[0], 6);
    expect(c[9]).toBeCloseTo(1, 6);
  });
});
