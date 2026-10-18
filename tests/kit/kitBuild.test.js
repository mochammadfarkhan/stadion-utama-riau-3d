import { describe, it, expect, vi, afterEach } from 'vitest';
import { planBuilding } from '../../src/world/kit/planBuilding.js';
import { buildBuilding, appendPlan } from '../../src/world/kit/buildBuilding.js';
import { createKitSink, clipRect } from '../../src/world/kit/kitBuilder.js';
import { createKitMaterials } from '../../src/world/kit/kitMaterials.js';
import { createResourceScope } from '../../src/engine/ResourceScope.js';
import { ATLAS_CELLS, ATLAS_SIZE, cellUv, PAINTERS } from '../../src/world/kit/atlas.js';
import { ARCHETYPE_IDS, HERO_IDS, VARIANTS } from '../../src/world/kit/archetypes.js';
import { ORNAMENT_IDS } from '../../src/world/kit/ornaments.js';
import { HERO_BUILDERS } from '../../src/world/kit/hero/index.js';
import { isRegionOwned } from '../../src/world/kit/hero/regionOwned.js';

const rect = (w, d) => [[0, 0], [w, 0], [w, d], [0, d]];
// Spesimen tipikal katalog aset §1 + batas segitiga LOD0 (kolom "Segitiga", batas atas).
const SPECIMENS = [
  ['K01', rect(40, 12), 1, {}, 12000], ['K01', rect(46, 15), 2, {}, 12000], ['K02', rect(35, 14), 2, { sign: 'DEKANAT' }, 15000],
  ['K03', rect(50, 50), 4, { variant: 'segitiga' }, 25000], ['K04', rect(30, 15), 1, {}, 9000], ['K05', rect(30, 20), 1, {}, 8000],
  ['K06', rect(10, 10), 1, {}, 6000], ['K06', rect(10, 10), 1, { variant: 'kubah-kecil', roof: 'datar-parapet' }, 6000],
  ['K07', rect(20, 10), 1, {}, 7000], ['K07', rect(20, 10), 1, { variant: 'parkir' }, 7000], ['K08', rect(12, 12), 1, {}, 5000],
  ['K09', rect(69, 23), 5, {}, 20000], ['K10', rect(40, 14), 3, { variant: 'rangka' }, 15000], ['K10', rect(40, 14), 3, { variant: 'beratap', roof: 'pelana' }, 15000],
  ['K11', rect(8, 8), 1, {}, 2000], ['K12', [[0, 0], [32, 0], [36, 12], [22, 20], [0, 20]], 3, {}, 4000],
];

const mats = createKitMaterials(createResourceScope('uji-kit'));
const plan = ([arch, ring, levels, ov]) => planBuilding({ id: `uji-${arch}`, ring, levels, archetype: arch, overrides: ov, front: [0, 1], groundY: () => 0 });

afterEach(() => vi.restoreAllMocks());

describe('buildBuilding (kit lengkap, Node tanpa canvas)', () => {
  it.each(SPECIMENS.map((s) => [`${s[0]} ${JSON.stringify(s[3])}`, s]))('%s: PartList ≤ batas segitiga katalog, atribut seragam, tanpa NaN', (_, spec) => {
    const parts = buildBuilding(plan(spec), mats);
    const tris = parts.reduce((s, p) => s + p.geometry.attributes.position.count / 3, 0);
    expect(tris).toBeGreaterThan(50);
    expect(tris).toBeLessThanOrEqual(spec[4]);
    for (const p of parts) {
      expect(Object.keys(p.geometry.attributes).sort()).toEqual(['color', 'normal', 'position', 'uv']);
      expect([mats.opak, mats.potong]).toContain(p.material);
      expect(p.matrix).toBeNull();
      for (const v of p.geometry.attributes.position.array) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('LOD1 jauh lebih ringan dari LOD0 (≤ 25%) dan tanpa sel potong (K07/K10 struktur sama; K12 sudah dilukis)', () => {
    for (const spec of SPECIMENS.filter((s) => !['K07', 'K10', 'K12'].includes(s[0]))) {
      const p = plan(spec);
      const t0 = createKitSink();
      const t1 = createKitSink();
      appendPlan(t0, p, mats, { lod: 0 });
      appendPlan(t1, p, mats, { lod: 1 });
      expect(t1.triangles, spec[0]).toBeLessThanOrEqual(Math.max(400, t0.triangles * 0.25));
      expect(t1.potong.triangles, spec[0]).toBe(0);
    }
  });

  it('tidak ada sel atlas tak dikenal (semua arketipe, semua varian, LOD0/1, hero)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const all = [...SPECIMENS];
    for (const [id, list] of Object.entries(VARIANTS)) for (const v of list) all.push([id, rect(30, 14), 2, { variant: v }, Infinity]);
    for (const h of HERO_IDS) all.push([h, rect(40, 24), 2, {}, Infinity]);
    for (const spec of all) for (const lod of [0, 1]) buildBuilding(plan(spec), mats, { lod });
    expect(warn.mock.calls.filter(([m]) => /atlas|ornamen/.test(String(m)))).toEqual([]);
  });

  it('semua id hero punya builder; hero distrik menghasilkan geometri, hero milik region kosong', () => {
    for (const h of HERO_IDS) {
      const parts = buildBuilding(plan([h, rect(40, 24), 2, {}]), mats);
      if (isRegionOwned(HERO_BUILDERS[h])) expect(parts).toEqual([]);
      else expect(parts.length).toBeGreaterThan(0);
    }
  });

  it('perakitan gagal → K12 (dengan input) atau lempar (tanpa input)', () => {
    const p = plan(SPECIMENS[0]);
    const broken = { ...p, masses: [{ ...p.masses[0], faces: null }] };
    const logger = { error: vi.fn() };
    expect(() => buildBuilding(broken, mats)).toThrow();
    const parts = buildBuilding(broken, mats, { input: { id: 'uji', ring: rect(40, 12), levels: 1, front: [0, 1], groundY: () => 0 }, logger });
    expect(parts.length).toBeGreaterThan(0);
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('atlas', () => {
  const cells = Object.entries(ATLAS_CELLS);

  it('semua sel di dalam 2048², selaras 64 px, tidak tumpang tindih', () => {
    for (const [id, c] of cells) {
      expect(c.x + c.w, id).toBeLessThanOrEqual(ATLAS_SIZE);
      expect(c.y + c.h, id).toBeLessThanOrEqual(ATLAS_SIZE);
      for (const v of [c.x, c.y, c.w, c.h]) expect(v % 64, id).toBe(0);
    }
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < cells.length; j += 1) {
        const [a, A] = cells[i];
        const [b, B] = cells[j];
        const overlap = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
        expect(overlap, `${a} × ${b}`).toBe(false);
      }
    }
  });

  it('setiap sel punya pelukis; jumlah sel & sel potong/menyala', () => {
    for (const [id] of cells) expect(typeof PAINTERS[id], id).toBe('function');
    expect(cells.length).toBe(73);
    expect(cells.filter(([, c]) => c.alpha).map(([id]) => id)).toEqual(expect.arrayContaining(['roster-kotak', 'roster-lingkaran', 'roster-silang', 'roster-bunga', 'roster-krawangan', 'layar-segitiga', 'layar-vertikal', 'layar-wajik', 'railing', 'jemuran', 'ilalang', 'besi-tulangan']));
    expect(cells.filter(([, c]) => c.glow).map(([id]) => id).sort()).toEqual(['kaca-biru-nyala', 'lampu', 'lod1-adb-nyala', 'lod1-kuliah-nyala', 'lod1-rusun-nyala', 'nako-nyala']);
  });

  it('cellUv: flipY (v bawah < v atas), inset 4 px', () => {
    const r = cellUv('plester');
    expect(r.u0).toBeCloseTo(4 / 2048, 9);
    expect(r.u1).toBeCloseTo(252 / 2048, 9);
    expect(r.v1).toBeCloseTo(1 - 4 / 2048, 9);
    expect(r.v0).toBeCloseTo(1 - 252 / 2048, 9);
  });

  it('clipRect: segitiga diklip ke sel', () => {
    const c = clipRect([[0, 0], [4, 0], [0, 4]], 0, 0, 2, 2);
    expect(c.length).toBeGreaterThanOrEqual(4);
  });

  it('ornamen yang direncanakan semua punya builder', () => {
    expect(ORNAMENT_IDS).toEqual(expect.arrayContaining(['teras-kanopi', 'tangga-tengah', 'tiang-bendera', 'pot', 'exhaust', 'kanopi-masuk', 'tempat-wudu', 'rak-sandal', 'etalase', 'meja-bangku', 'spanduk-menu', 'tandon', 'ilalang']));
    expect(ARCHETYPE_IDS).toHaveLength(12);
  });
});
