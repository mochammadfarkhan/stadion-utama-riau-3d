import { describe, it, expect } from 'vitest';
import { VEG_SPECIES, buildVegetationCells, hash01, vegetationInstances } from '../../src/districts/unri/vegetation.js';

const h = (x) => 0.01 * x + 2;
const pts = [
  { sp: 'mahoni', x: 10, z: 20 }, { sp: 'semak', x: 30, z: 40 }, { sp: 'sawit', x: 250, z: 50 }, { sp: 'jati', x: 0, z: 0 },
];

describe('vegetationInstances', () => {
  const inst = vegetationInstances(pts, h);

  it('peneduh = batang + tajuk; semak = tajuk saja; sawit = kit sawit; spesies asing diabaikan', () => {
    expect(inst.trunks).toHaveLength(1);
    expect(inst.crowns).toHaveLength(2);
    expect(inst.sawitTrunks).toHaveLength(1);
    expect(inst.sawitCrowns).toHaveLength(1);
  });

  it('akar di permukaan; tajuk di atas batang; skala 0,85–1,3; deterministik dari posisi', () => {
    const t = inst.trunks[0];
    expect(t.y).toBeCloseTo(h(10, 20), 9);
    expect(inst.crowns[0].y).toBeGreaterThan(t.y + t.sy * 0.9);
    const s = t.sx / VEG_SPECIES.mahoni.trunkR;
    expect(s).toBeGreaterThanOrEqual(0.85);
    expect(s).toBeLessThan(1.3);
    expect(vegetationInstances(pts, h)).toEqual(inst);
    expect(hash01(10, 20, 1)).toBe(hash01(10, 20, 1));
    expect(hash01(10, 20, 1)).not.toBe(hash01(10.1, 20, 1));
  });

  it('tinggi total sesuai katalog (mahoni ±10–18 m, sawit ±4–9 m)', () => {
    const c = inst.crowns[0];
    const top = c.y + c.sy - h(10, 20);
    expect(top).toBeGreaterThan(9.5);
    expect(top).toBeLessThan(18.5);
    const sc = inst.sawitCrowns[0];
    expect(sc.y - h(250, 50)).toBeGreaterThan(3.5);
    expect(sc.y - h(250, 50)).toBeLessThan(9.5);
  });
});

describe('buildVegetationCells', () => {
  it('satu grup per sel 200 m (≤ 4 InstancedMesh), pusat sel tercatat; kit tak lengkap → galat jelas', async () => {
    const THREE = await import('three');
    const part = (name) => ({ name, geometry: new THREE.BoxGeometry(), material: new THREE.MeshBasicMaterial() });
    const kit = { trunk: part('b'), crown: part('t'), sawitTrunk: part('sb'), sawitCrown: part('sp') };
    const cells = buildVegetationCells(vegetationInstances(pts, h), kit);
    expect(cells.map((c) => [c.group.name, c.x, c.z])).toEqual([['unri:vegetasi:0_0', 100, 100], ['unri:vegetasi:1_0', 300, 100]]);
    expect(cells[0].group.children.map((m) => [m.name, m.count])).toEqual([['b', 1], ['t', 2]]);
    expect(cells[1].group.children.map((m) => m.name)).toEqual(['sb', 'sp']);
    expect(() => buildVegetationCells(vegetationInstances(pts, h), { trunk: kit.trunk })).toThrow(/tidak lengkap/);
  });
});
