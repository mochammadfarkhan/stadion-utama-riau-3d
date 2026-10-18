import { describe, it, expect } from 'vitest';
import { planBuilding, footprintMasses, ROOF_PITCH } from '../../src/world/kit/planBuilding.js';
import { corridorFaces, median, PLAN } from '../../src/world/kit/planGeom.js';
import { doorKind, windowRect, rosterRect } from '../../src/world/kit/planRules.js';
import { hashId } from '../../src/world/kit/archetypes.js';

const RECT = [[0, 0], [46.4, 0], [46.4, 14.7], [0, 14.7]]; // ±"Gedung A FKIP (PPKN)" 46,4 × 14,7 m
const L_SHAPE = [[0, 0], [40, 0], [40, 14], [14, 14], [14, 40], [0, 40]];
const CURVED = Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * Math.PI * 2) * 40, Math.sin((i / 16) * Math.PI * 2) * 40]);
const base = (over = {}) => ({ id: 'w282225412', ring: RECT, levels: 1, archetype: 'K01', overrides: {}, front: [0, 1], groundY: () => 30, ...over });
const face = (plan, id, m = 0) => plan.masses[m].faces.find((f) => f.id === id);

describe('planBuilding — K01 kuliah-koridor', () => {
  const plan = planBuilding(base());

  it('satu massa, 1 lantai 3,8 m, baseY = median tanah + 0,15', () => {
    expect(plan.masses).toHaveLength(1);
    expect(plan.kit).toBe('K01');
    expect(plan.fallback).toBeNull();
    expect(plan.floors).toBe(1);
    expect(plan.floorH).toEqual([3.8]);
    expect(plan.height).toBeCloseTo(3.8, 9);
    expect(plan.baseY).toBeCloseTo(30 + PLAN.plinthLift, 9);
  });

  it('selasar 2,4 m di sisi panjang yang menghadap jalan (+z = selatan)', () => {
    expect(plan.corridor).toEqual({ side: '+z', faces: ['+z'], depth: 2.4 });
    expect(face(plan, '+z').role).toBe('selasar');
  });

  it('dinding mundur: sisi panjang 46,4 − 2×0,5 = 45,4 m → 13 bay; sisi pendek 14,7 − 2,4 − 0,5 = 11,8 m → 3 bay', () => {
    expect(face(plan, '+z').len).toBeCloseTo(45.4, 6);
    expect(face(plan, '-z').bays).toBe(13);
    expect(face(plan, '+z').bays).toBe(13);
    expect(face(plan, '+x').len).toBeCloseTo(11.8, 6);
    expect(face(plan, '+x').bays).toBe(3);
    expect(plan.bays).toHaveLength(13 + 3 + 13 + 3);
  });

  it('pola kelas: pintu di bay 0,3,6,9,12 sisi selasar; jendela + roster di bay lain', () => {
    const ops = plan.openings.filter((o) => o.face === '+z');
    const doors = ops.filter((o) => o.kind === 'pintu');
    expect(doors).toHaveLength(5);
    expect(ops.filter((o) => o.kind === 'jendela')).toHaveLength(8);
    expect(ops.filter((o) => o.kind === 'roster')).toHaveLength(13);
    for (const d of doors) expect(d.y0).toBe(0);
  });

  it('atap pelana 25°, tritisan 1 m; papan nama timbul hanya bila ada teks', () => {
    expect(plan.roof).toEqual({ type: 'pelana', pitch: 25, overhang: 1, parapet: 0 });
    expect(plan.signs).toEqual([]);
    const signed = planBuilding(base({ overrides: { sign: 'GEDUNG A FKIP' } }));
    expect(signed.signs).toHaveLength(1);
    expect(signed.signs[0]).toMatchObject({ text: 'GEDUNG A FKIP', style: 'timbul', face: '+z', h: 0.5 });
  });

  it('deterministik: input sama → plan identik; id lain → seed lain', () => {
    expect(planBuilding(base())).toEqual(plan);
    expect(plan.seed).toBe(hashId('w282225412'));
    expect(planBuilding(base({ id: 'w1' })).seed).not.toBe(plan.seed);
  });

  it('jalan di utara → selasar di −z; lantai dibatasi maxLevels (K01 = 4)', () => {
    expect(planBuilding(base({ front: [0, -1] })).corridor.faces).toEqual(['-z']);
    const tall = planBuilding(base({ levels: 7 }));
    expect(tall.floors).toBe(4);
    expect(tall.floorH).toEqual([3.8, 3.6, 3.6, 3.6]);
  });

  it('baseY = median tanah di sudut + centroid (lereng)', () => {
    const p = planBuilding(base({ groundY: (x) => x * 0.1 }));
    expect(p.baseY).toBeCloseTo(median([0, 4.64, 4.64, 0, 2.32]) + 0.15, 9);
    expect(p.footY).toBeCloseTo(-0.25, 9);
  });
});

describe('planBuilding — dekomposisi & cadangan K12', () => {
  it('L → dua massa; sisi dalam tidak dimundurkan dan tanpa bay di bagian tertutup', () => {
    const p = planBuilding(base({ ring: L_SHAPE, id: 'w-l' }));
    expect(p.masses).toHaveLength(2);
    expect(p.fallback).toBeNull();
    const zeroInset = p.masses.some((m) => Object.values(m.insets).some((v) => v === 0));
    expect(zeroInset).toBe(true);
  });

  it('lengkung → K12 poligon, atap datar-parapet, hanya pintu (fasad dilukis)', () => {
    const p = planBuilding(base({ ring: CURVED, id: 'w-c', archetype: 'K01', levels: 3 }));
    expect(p.kit).toBe('K12');
    expect(p.archetype).toBe('K01');
    expect(p.fallback).toMatch(/dekomposisi gagal/);
    expect(p.masses[0].kind).toBe('poligon');
    expect(p.roof.type).toBe('datar-parapet');
    expect(new Set(p.openings.map((o) => o.kind))).toEqual(new Set(['pintu']));
  });

  it('footprint berlubang → K12', () => {
    expect(footprintMasses(RECT, [[[10, 5], [12, 5], [12, 7], [10, 7]]]).reason).toBe('footprint berlubang');
  });
});

describe('planBuilding — arketipe lain', () => {
  it('K02: ornamen teras berkanopi, tangga, tiang bendera, 2 pot', () => {
    const p = planBuilding(base({ archetype: 'K02', levels: 2, overrides: { sign: 'DEKANAT' } }));
    const ids = p.ornaments.map((o) => o.assetId);
    expect(ids).toEqual(expect.arrayContaining(['teras-kanopi', 'tangga-tengah', 'tiang-bendera']));
    expect(ids.filter((x) => x === 'pot')).toHaveLength(2);
    expect(p.roof.type).toBe('limas');
  });

  it('K03: lantai atas sisi selasar berlayar perforasi di bidang luar (depan kolom), papan panel', () => {
    const p = planBuilding(base({ archetype: 'K03', levels: 3, ring: [[0, 0], [50, 0], [50, 24], [0, 24]], overrides: { variant: 'wajik', sign: 'HEALTH SCIENCES CENTER' } }));
    const layar = p.openings.filter((o) => o.layar);
    expect(layar.length).toBeGreaterThan(0);
    expect(layar.every((o) => o.floor >= 1)).toBe(true);
    expect(layar.filter((o) => o.face === '+z').every((o) => o.screenOut === p.corridor.depth + 0.3)).toBe(true);
    expect(p.signs[0].style).toBe('panel');
    expect(p.variant).toBe('wajik');
    expect(p.roof).toMatchObject({ type: 'pelana-lebar', pitch: ROOF_PITCH['pelana-lebar'], overhang: 2.5 });
  });

  it('K10: tanpa kaca — hanya lubang & isian bata; ilalang di sekeliling', () => {
    const p = planBuilding(base({ archetype: 'K10', levels: 3, overrides: { variant: 'rangka' } }));
    expect(new Set(p.openings.map((o) => o.kind))).toEqual(new Set(['lubang', 'bata']));
    expect(p.ornaments.every((o) => o.assetId === 'ilalang')).toBe(true);
    expect(p.corridor.faces).toEqual([]);
  });

  it('K09: selasar depan (pintu unit) + balkon belakang + 2 tandon', () => {
    const p = planBuilding(base({ archetype: 'K09', levels: 5, ring: [[0, 0], [69, 0], [69, 23], [0, 23]] }));
    expect(p.floors).toBe(5);
    expect(p.openings.some((o) => o.kind === 'balkon')).toBe(true);
    expect(p.ornaments.filter((o) => o.assetId === 'tandon')).toHaveLength(2);
    expect(p.roof.type).toBe('datar-parapet');
  });

  it('hero: arketipe dipertahankan, geometri dari pengganti (student-center → K03)', () => {
    const p = planBuilding(base({ archetype: 'hero:student-center', levels: 3 }));
    expect(p.archetype).toBe('hero:student-center');
    expect(p.kit).toBe('K03');
  });
});

describe('aturan bukaan (murni)', () => {
  it('windowRect: lebar = bay − 2×0,45 (maks 2,4); bay sempit → null', () => {
    expect(windowRect(3.6, 3.8)).toEqual({ w: 2.4, y0: 0.9, y1: 2.6 });
    expect(windowRect(3.0, 3.8).w).toBeCloseTo(2.1, 9);
    expect(windowRect(1.5, 3.8)).toBeNull();
  });

  it('rosterRect butuh ≥ 0,25 m di atas kepala jendela', () => {
    const r = rosterRect(2, 2.6, 3.8);
    expect(r.w).toBe(2);
    expect(r.y0).toBeCloseTo(2.8, 9);
    expect(r.y1).toBeCloseTo(3.35, 9);
    expect(rosterRect(2, 2.6, 3.0)).toBeNull();
  });

  it('doorKind: kelas tiap 3 bay di selasar; ganda di tengah depan lantai dasar', () => {
    const sel = { role: 'selasar' };
    expect([0, 1, 2, 3].map((i) => doorKind('kelas', sel, 0, i, 13))).toEqual(['pintu', null, null, 'pintu']);
    expect(doorKind('ganda', { role: 'depan' }, 0, 2, 5)).toBe('pintu-ganda');
    expect(doorKind('ganda', { role: 'depan' }, 1, 2, 5)).toBeNull();
  });

  it('corridorFaces: keliling/dua/tidak', () => {
    const obb = { yaw: 0 };
    expect(corridorFaces('keliling', obb, null)).toEqual(['-z', '+x', '+z', '-x']);
    expect(corridorFaces('dua', obb, null)).toEqual(['-z', '+z']);
    expect(corridorFaces('tidak', obb, null)).toEqual([]);
    expect(corridorFaces('belakang', obb, [0, 1])).toEqual(['-z']);
  });
});
