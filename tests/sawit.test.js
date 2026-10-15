import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TREE_TYPES, createBigTrees, sawitCrownGeometry, sawitTrunkGeometry } from '../src/world/Landscape.trees.js';

const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const finite = (g) => Array.from(g.attributes.position.array).every(Number.isFinite);

describe('kelapa sawit', () => {
  it('terdaftar sebagai jenis pohon dengan batang tinggi', () => {
    expect(TREE_TYPES.sawit).toBeDefined();
    expect(TREE_TYPES.sawit.trunkH).toBeGreaterThan(7);
  });

  it('tajuk: pelepah melengkung berdaun sirip, anggaran segitiga hemat, simetris di sekitar sumbu batang', () => {
    const g = sawitCrownGeometry(TREE_TYPES.sawit);
    expect(finite(g)).toBe(true);
    expect(tris(g)).toBeGreaterThan(300);
    expect(tris(g)).toBeLessThan(1600);
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(new THREE.Vector3());
    expect(Math.abs(c.x)).toBeLessThan(0.8);
    expect(Math.abs(c.z)).toBeLessThan(0.8);
    const size = g.boundingBox.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(7); // rentang tajuk lebar (±3,5 m)
    expect(size.x).toBeLessThan(14);
    expect(size.y).toBeLessThan(5);    // pelepah melengkung, bukan menjulang
  });

  it('pelepah menjuntai: titik terendah tajuk di bawah titik terdekat ke pusat (melengkung turun)', () => {
    const g = sawitCrownGeometry(TREE_TYPES.sawit);
    g.computeBoundingBox();
    expect(g.boundingBox.min.y).toBeLessThan(-0.3);
    expect(g.boundingBox.max.y).toBeGreaterThan(0.3);
  });

  it('batang: bercincin (radius bergantian) dan menaikkan alas di y=0 sampai tinggi batang', () => {
    const t = TREE_TYPES.sawit;
    const g = sawitTrunkGeometry(t.trunkR, t.trunkH);
    expect(finite(g)).toBe(true);
    g.computeBoundingBox();
    expect(g.boundingBox.min.y).toBeCloseTo(0, 1);
    expect(g.boundingBox.max.y).toBeCloseTo(t.trunkH, 0);
    const radii = new Set();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 1) radii.add(Math.round(Math.hypot(p.getX(i), p.getZ(i)) * 100));
    expect(radii.size).toBeGreaterThan(2); // bukan silinder polos
  });

  it('createBigTrees menempatkan sawit sebagai InstancedMesh tajuk+batang yang berwarna hijau tua', () => {
    const g = createBigTrees();
    const crowns = g.getObjectByName('pohon-sawit').children.filter((m) => m.isInstancedMesh && m.name.startsWith('tajuk'));
    expect(crowns.length).toBeGreaterThan(0);
    expect(crowns[0].count).toBeGreaterThan(10);
    expect(crowns[0].instanceColor).toBeTruthy();
  });
});
