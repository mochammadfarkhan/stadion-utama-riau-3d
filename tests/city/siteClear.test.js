import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildingsInSite, sinkMask, clearSiteBuildings, withoutSiteBuildings } from '../../src/city/siteClear.js';

// Tapak persegi dunia [0, 100] × [0, 100].
const siteHit = (x, z) => x >= 0 && x <= 100 && z >= 0 && z <= 100;
const box = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const inside = { height: 6, ring: box(40, 40, 50, 50) };
const crossing = { height: 6, ring: box(90, 40, 110, 50) };
const nearEdge = { height: 6, ring: box(-1, 40, 10, 50) }; // 1 m di luar tepi barat
const outside = { height: 6, ring: box(200, 200, 210, 210) };

describe('buildingsInSite', () => {
  it('hanya gedung yang seluruhnya di tapak (toleransi 1,5 m)', () => {
    expect([...buildingsInSite([inside, crossing, nearEdge, outside], siteHit)]).toEqual([0, 2]);
  });
  it('siteHit selalu false → kosong', () => {
    expect(buildingsInSite([inside, nearEdge], () => false).size).toBe(0);
  });
});

describe('sinkMask', () => {
  it('vertex di dalam cincin atau dalam pad', () => {
    const pos = [45, 0, 45, 50.5, 3, 45, 52, 0, 45, 0, 0, 0];
    expect(sinkMask(pos, 3, [inside.ring])).toEqual([0, 1]);
  });
});

/** Kotak 8 vertex (x, z dunia; y 0 dan 6). */
const boxVerts = (x0, z0, x1, z1) => box(x0, z0, x1, z1).flatMap(([x, z]) => [x, 0, z, x, 6, z]);

function makeRoot({ interleaved = false } = {}) {
  const root = new THREE.Group();
  root.position.set(10, 0, 20); // akar tile di pusat tile, tanpa induk
  const data = new Float32Array([...boxVerts(40, 40, 50, 50), ...boxVerts(200, 200, 210, 210)].map((v, i) => {
    const c = i % 3;
    return c === 0 ? v - 10 : c === 2 ? v - 20 : v; // lokal terhadap akar
  }));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', interleaved ? new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(data, 3), 3, 0) : new THREE.BufferAttribute(data, 3));
  const walls = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  walls.name = 'buildings_walls';
  const other = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(data.slice(), 3)), walls.material);
  other.name = 'roads';
  root.add(walls, other);
  return { root, walls, other, before: data.slice() };
}

describe('clearSiteBuildings', () => {
  const tile = { buildings: [inside, outside] };
  for (const interleaved of [false, true]) {
    it(`kotak di tapak tenggelam, sisanya utuh (interleaved=${interleaved})`, () => {
      const { root, walls, other, before } = makeRoot({ interleaved });
      expect(clearSiteBuildings(root, tile, siteHit)).toEqual({ buildings: 1, vertices: 8 });
      const p = walls.geometry.attributes.position;
      for (let i = 0; i < 8; i += 1) expect(p.getY(i)).toBeLessThanOrEqual(-100);
      for (let i = 8; i < 16; i += 1) expect(p.getY(i)).toBe(before[i * 3 + 1]);
      expect(Array.from(other.geometry.attributes.position.array)).toEqual(Array.from(before));
    });
  }
  it('tanpa gedung di tapak → tidak menyentuh apa pun', () => {
    const { root, walls, before } = makeRoot();
    expect(clearSiteBuildings(root, { buildings: [outside] }, siteHit)).toEqual({ buildings: 0, vertices: 0 });
    expect(Array.from(walls.geometry.attributes.position.array)).toEqual(Array.from(before));
  });
  it('Int16 ternormalisasi berskala kecil: tenggelam sedalam muat + x/z dilebur', () => {
    const root = new THREE.Group();
    const arr = new Int16Array([0, -32767, 0, 0, 32767, 0, 32767, 32767, 0]); // dunia: kotak ±5 m, y 0..10
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arr, 3, true));
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    mesh.name = 'buildings_roofs';
    mesh.position.set(45, 5, 45);
    mesh.scale.setScalar(5);
    root.add(mesh);
    const r = clearSiteBuildings(root, { buildings: [inside] }, siteHit);
    expect(r.vertices).toBe(3);
    const p = g.attributes.position;
    for (let i = 0; i < 3; i += 1) {
      expect(p.getY(i)).toBeCloseTo(-1, 4);
      expect([p.getX(i), p.getZ(i)]).toEqual([p.getX(0), p.getZ(0)]);
    }
  });
});

describe('withoutSiteBuildings', () => {
  it('membuang gedung tapak tanpa memutasi asli', () => {
    const tile = { key: 'k', roads: [], buildings: [inside, crossing, nearEdge, outside] };
    const out = withoutSiteBuildings(tile, siteHit);
    expect(out.buildings).toEqual([crossing, outside]);
    expect(out.roads).toBe(tile.roads);
    expect(tile.buildings).toHaveLength(4);
  });
});
