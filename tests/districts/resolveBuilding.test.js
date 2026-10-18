import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveBuilding, validateOverrides, overrideErrors, parseLevelsTag, ruleArchetype, resetResolveWarnings, K01_VARIATION,
} from '../../src/districts/unri/resolveBuilding.js';
import { BUILDING_OVERRIDES } from '../../src/districts/unri/buildings.data.js';
import { ARCHETYPES, HERO_IDS, hashId } from '../../src/world/kit/archetypes.js';
import { HERO_BUILDERS } from '../../src/world/kit/hero/index.js';

const RING = [[0, 0], [40, 0], [40, 12], [0, 12]]; // 480 m²
const osm = (tags, extra = {}) => ({ id: 'w100', ring: RING, levels: null, tags, ...extra });
const arch = (tags, extra) => resolveBuilding(osm(tags, extra), undefined).archetype;
const quiet = { warn: () => {} };

describe('aturan default spec §4.7 (+ D1)', () => {
  it.each([
    ['Gedung Dekanat FISIP', {}, 'K02'],
    ['Laboratorium Kayu', {}, 'K04'],
    ['Lab. Fisika Bumi', {}, 'K04'],
    ['Kantin FKIP', {}, 'K07'],
    ['Musholla FKIP', {}, 'K06'],
    ['Musholah', {}, 'K06'],
    ['Pendopo FISIP', {}, 'K08'],
    ['Gedung Auditorium Sultan Balia FISIP', {}, 'K05'],
    ['Gelanggang Mahasiswa FISIP', {}, 'K05'],
    ['Gedung Mangkrak FISIP UNRI', { amenity: 'university' }, 'K10'],
    ['Gedung B - FISIP', {}, 'K01'],
    ['Gedung Kuliah FMIPA', {}, 'K01'],
    ['Integrated Classroom', {}, 'K01'],
    ['LPPM UNRI', { amenity: 'university' }, 'K01'],
  ])('%s → %s', (name, tags, expected) => {
    expect(arch({ name, building: 'yes', ...tags })).toBe(expected);
  });

  it('urutan: dekanat menang atas lab ("Lab Dekanat") dan atas gedung A–H', () => {
    expect(arch({ name: 'Lab Dekanat' })).toBe('K02');
    expect(arch({ name: 'Gedung A Dekanat' })).toBe('K02');
  });

  it('apartments → K09; luas < 60 → K11; tanpa padanan < 150 → K11; lainnya → K01 [D1]', () => {
    expect(arch({ building: 'apartments' })).toBe('K09');
    expect(resolveBuilding({ id: 'w1', ring: [[0, 0], [7, 0], [7, 5], [0, 5]], tags: { name: 'Gedung A' } }).archetype).toBe('K11');
    expect(resolveBuilding({ id: 'w1', ring: [[0, 0], [12, 0], [12, 10], [0, 10]], tags: {} }).archetype).toBe('K11');
    expect(arch({ building: 'yes' })).toBe('K01');
    expect(resolveBuilding(osm({ building: 'yes' })).keyakinan).toBe('rendah');
  });

  it('lantai: override → building:levels (rentang "4-7" → 4) → default arketipe, dibatasi maxLevels', () => {
    expect(parseLevelsTag('4-7')).toBe(4);
    expect(parseLevelsTag('2')).toBe(2);
    expect(parseLevelsTag('x')).toBeNull();
    expect(resolveBuilding(osm({ name: 'Gedung Dekanat', 'building:levels': '4-7' })).levels).toBe(4);
    expect(resolveBuilding(osm({ name: 'Gedung Dekanat' })).levels).toBe(ARCHETYPES.K02.levels);
    expect(resolveBuilding(osm({ name: 'Gedung C', 'building:levels': '9' })).levels).toBe(ARCHETYPES.K01.maxLevels);
    expect(resolveBuilding(osm({ name: 'Gedung C' }, { levels: 3 })).levels).toBe(3);
  });

  it('tag atap/dinding: roof=concrete → datar-parapet; roof=tile → genteng; walls=wood → kayu', () => {
    expect(resolveBuilding(osm({ name: 'Rumah susun', building: 'apartments', 'building:roof': 'concrete' })).roof).toBe('datar-parapet');
    expect(resolveBuilding(osm({ name: 'Gedung Dekanat FISIP', 'building:roof': 'tile' })).palette).toBe('krem-genteng');
    expect(resolveBuilding(osm({ name: 'Pendopo FISIP', 'building:walls': 'wood' })).palette).toBe('kayu');
  });

  it('variasi K01 [INF] dari hash id: limas & putih sesuai ambang', () => {
    const r = resolveBuilding(osm({ name: 'Gedung C' }, { id: 'w282225411' }));
    const h = hashId('w282225411');
    expect(r.roof).toBe(h % 100 < K01_VARIATION.limas ? 'limas' : 'pelana');
    expect(r.palette).toBe((h >>> 8) % 100 < K01_VARIATION.putih ? 'putih-seng' : 'krem-seng');
  });

  it('varian dari nama: K07 parkir, K11 pos/toilet', () => {
    expect(resolveBuilding(osm({ name: 'Kantin Parkir Belakang' })).variant).toBe('parkir');
    expect(resolveBuilding({ id: 'w2', ring: [[0, 0], [7, 0], [7, 5], [0, 5]], tags: { name: 'Pos Keamanan' } }).variant).toBe('pos');
    expect(resolveBuilding({ id: 'w3', ring: [[0, 0], [7, 0], [7, 5], [0, 5]], tags: { name: 'Toilet' } }).variant).toBe('toilet');
  });

  it('papan nama: nama huruf kapital untuk arketipe bertanda; K07/K09/K10/K11 tanpa papan', () => {
    expect(resolveBuilding(osm({ name: 'Gedung A FKIP (PPKN)' })).sign).toBe('GEDUNG A FKIP (PPKN)');
    expect(resolveBuilding(osm({ name: 'Kantin FT' })).sign).toBeNull();
    expect(resolveBuilding(osm({ building: 'yes' })).sign).toBeNull();
  });
});

describe('override', () => {
  beforeEach(() => resetResolveWarnings());

  it('override menang atas aturan; sign:null mematikan papan', () => {
    const r = resolveBuilding(osm({ name: 'Gedung Rektorat Universitas Riau', 'building:levels': '4-7' }, { id: 'w282225347' }), BUILDING_OVERRIDES.w282225347);
    expect(r).toMatchObject({ archetype: 'hero:rektorat', levels: 5, palette: 'putih', roof: 'datar-parapet', aturan: 'override', keyakinan: 'tinggi' });
    const fh = resolveBuilding(osm({ name: 'Gedung Fakultas Hukum' }, { id: 'w327366046' }), BUILDING_OVERRIDES.w327366046);
    expect(fh).toMatchObject({ archetype: 'K10', variant: 'beratap', levels: 3, sign: null });
  });

  it('override tak valid → aturan default + console.warn SEKALI per id', () => {
    const logger = { warn: vi.fn() };
    const bad = { archetype: 'K99', sumber: 'uji', keyakinan: 'tinggi' };
    const a = resolveBuilding(osm({ name: 'Laboratorium Batu' }), bad, { logger });
    resolveBuilding(osm({ name: 'Laboratorium Batu' }), bad, { logger });
    expect(a.archetype).toBe('K04');
    expect(a.aturan).not.toBe('override');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('validateOverrides', () => {
  it('TABEL NYATA buildings.data.js lulus', () => {
    expect(validateOverrides(BUILDING_OVERRIDES)).toEqual([]);
  });

  it('setiap entri nyata punya sumber & keyakinan', () => {
    for (const [id, ov] of Object.entries(BUILDING_OVERRIDES)) {
      expect(ov.sumber.length, id).toBeGreaterThan(10);
      expect(['tinggi', 'sedang', 'rendah']).toContain(ov.keyakinan);
    }
  });

  it('menangkap galat umum', () => {
    const errs = validateOverrides({
      x1: { archetype: 'K01', sumber: 'uji', keyakinan: 'tinggi' },
      w2: { archetype: 'K99', sumber: 'uji', keyakinan: 'tinggi' },
      w3: { archetype: 'K01', levels: 0, sumber: 'uji', keyakinan: 'tinggi' },
      w4: { archetype: 'K01', palette: 'ungu', sumber: 'uji', keyakinan: 'tinggi' },
      w5: { archetype: 'K01', roof: 'kubah', sumber: 'uji', keyakinan: 'tinggi' },
      w6: { archetype: 'K01', corridorSide: 'atas', sumber: 'uji', keyakinan: 'tinggi' },
      w7: { archetype: 'K01', variant: 'parkir', sumber: 'uji', keyakinan: 'tinggi' },
      w8: { archetype: 'K01', sumber: '', keyakinan: 'tinggi' },
      w9: { archetype: 'K01', sumber: 'uji', keyakinan: 'pasti' },
      w10: { archetype: 'K01', warna: 'merah', sumber: 'uji', keyakinan: 'tinggi' },
      w11: { archetype: 'K01', sign: 'X'.repeat(60), sumber: 'uji', keyakinan: 'tinggi' },
    });
    const ids = errs.map((e) => e.split(':')[0]);
    expect(new Set(ids)).toEqual(new Set(['x1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'w11']));
    expect(overrideErrors('w12', { archetype: 'K07', variant: 'parkir', sumber: 'uji', keyakinan: 'sedang' })).toEqual([]);
    expect(validateOverrides(null)).toEqual(['tabel override harus objek']);
  });

  it('id hero tabel = HERO_IDS dan semua punya builder', () => {
    for (const id of HERO_IDS) expect(typeof HERO_BUILDERS[id]).toBe('function');
    const heroes = Object.values(BUILDING_OVERRIDES).map((o) => o.archetype).filter((a) => a.startsWith('hero:'));
    for (const h of heroes) expect(HERO_IDS).toContain(h);
  });

  it('ruleArchetype tanpa override', () => {
    expect(ruleArchetype(osm({ name: 'Kantin FKIP' }))).toBe('K07');
    expect(resolveBuilding(osm({ name: 'Kantin FKIP' }), undefined, { logger: quiet }).aturan).toMatch(/kantin/);
  });
});
