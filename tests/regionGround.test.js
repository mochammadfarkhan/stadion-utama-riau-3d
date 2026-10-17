/**
 * Fase 3: tanah region = mask (bukan persegi 1.400 m); vegetasi & rumput hanya di dalam mask.
 * Di luar mask tanah datang dari tile kota.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync, existsSync } from 'node:fs';
import { createGround } from '../src/world/Ground.js';
import { createGrass } from '../src/world/Grass.js';
import { createLandscape } from '../src/world/Landscape.js';
import { createBigTrees, createShrubs } from '../src/world/Landscape.trees.js';
import { STADION_MASK } from '../src/regions/stadion/mask.js';
import { pointInPolygon, ringBounds, distanceToRing } from '../src/geo/polygon.js';
import { createResourceScope, withScope } from '../src/engine/ResourceScope.js';
import { createCompositeCollider } from '../src/core/Collider.js';
import { stadionColliders } from '../src/regions/stadion/collider.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { maskHalfExtent } from '../src/regions/Region.js';
import { EASTER_EGGS } from '../src/story/easterEggs.js';
import { createTileCollider } from '../src/city/TileCollider.js';
import { decodeTileData } from '../src/city/tileData.js';
import { tilesInRect } from '../src/geo/tiles.js';

const inMask = (x, z) => pointInPolygon(x, z, STADION_MASK);
const scoped = (fn) => withScope(createResourceScope('uji'), fn);

/** Posisi dunia semua instans di bawah root. */
function instancePositions(root) {
  const out = [];
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isInstancedMesh) return;
    for (let i = 0; i < o.count; i += 1) {
      o.getMatrixAt(i, m);
      p.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);
      out.push([p.x, p.z]);
    }
  });
  return out;
}

describe('tanah region berbentuk mask', () => {
  it('bidang rumput mengikuti bbox mask (tidak lagi ±700 m)', () => {
    const ground = scoped(() => createGround({ outline: STADION_MASK }));
    const grass = ground.getObjectByName('rumput');
    grass.geometry.computeBoundingBox();
    const b = grass.geometry.boundingBox;
    const m = ringBounds(STADION_MASK);
    expect(b.min.x).toBeCloseTo(m.minX, 3);
    expect(b.max.x).toBeCloseTo(m.maxX, 3);
    expect(b.min.z).toBeCloseTo(m.minZ, 3);
    expect(b.max.z).toBeCloseTo(m.maxZ, 3);
  });

  it('tanpa outline: persegi lama (kompatibel)', () => {
    const ground = scoped(() => createGround());
    const grass = ground.getObjectByName('rumput');
    grass.geometry.computeBoundingBox();
    expect(grass.geometry.boundingBox.max.x).toBeCloseTo(700, 3);
  });

  it('semua verteks bidang rumput di dalam/tepi mask (tidak menutup jalan/air tile di luar)', () => {
    const ground = scoped(() => createGround({ outline: STADION_MASK }));
    const pos = ground.getObjectByName('rumput').geometry.attributes.position;
    const EPS = 0.01;
    const out = [];
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // titik tepi tidak dijamin pointInPolygon: verteks di tepi mask (≤ EPS) dihitung di dalam
      if (!inMask(x, z) && distanceToRing(x, z, STADION_MASK) > EPS) out.push([x, z]);
    }
    expect(out).toEqual([]);
    // Jl. Naga Sakti OSM (z ≈ −447) dan angkot mangkal (z ≈ −441) di luar tanah region
    expect(inMask(24, -441.5)).toBe(false);
    expect(inMask(0, -447)).toBe(false);
  });
});

describe('maskHalfExtent (area bake minimap region)', () => {
  it('persegi ±half memuat seluruh mask untuk yaw placement apa pun', () => {
    const half = maskHalfExtent(STADION_MASK);
    expect(half).toBeGreaterThan(440);
    expect(half).toBeLessThan(700); // lebih kecil dari persegi lama ±700 m
    for (const yaw of [0, 0.3, Math.PI / 4, 2]) {
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const out = STADION_MASK.filter(([x, z]) => Math.abs(x * c + z * s) > half + 1e-9 || Math.abs(-x * s + z * c) > half + 1e-9);
      expect(out).toEqual([]);
    }
  });
});

describe('vegetasi & rumput hanya di dalam mask', () => {
  it('pohon besar dan semak dengan keep = mask: semua instans di dalam mask', () => {
    for (const make of [() => createBigTrees(11, inMask), () => createShrubs(31, inMask)]) {
      const pts = instancePositions(scoped(make));
      expect(pts.length).toBeGreaterThan(0);
      expect(pts.filter(([x, z]) => !inMask(x, z))).toEqual([]);
    }
  });

  it('createLandscape({keep}) — pohon besar/muda, semak, ilalang: tidak ada instans di luar mask', () => {
    const all = instancePositions(scoped(() => createLandscape()));
    expect(all.filter(([x, z]) => !inMask(x, z)).length).toBeGreaterThan(0); // tanpa keep: ada di luar (kontrol)
    const pts = instancePositions(scoped(() => createLandscape({ keep: inMask })));
    expect(pts.length).toBeGreaterThan(0);
    expect(pts.filter(([x, z]) => !inMask(x, z))).toEqual([]);
  });

  it('bilah rumput: keep = false → semua skala nol; keep = true → ada bilah', () => {
    const scaleSum = (group) => {
      const mesh = group.children[0];
      const m = new THREE.Matrix4();
      const s = new THREE.Vector3();
      let sum = 0;
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, m);
        sum += s.setFromMatrixScale(m).x;
      }
      return sum;
    };
    const none = scoped(() => createGrass({ count: 6000, keep: () => false }));
    none.userData.update(0.016, 0, new THREE.Vector3(0, 0, -250));
    expect(scaleSum(none)).toBe(0);
    const some = scoped(() => createGrass({ count: 6000 }));
    some.userData.update(0.016, 0, new THREE.Vector3(0, 0, -250));
    expect(scaleSum(some)).toBeGreaterThan(0);
  });

  it('bilah rumput dengan keep = mask di tepi utara (Naga Sakti): tidak ada bilah tampak di luar mask', () => {
    const grass = scoped(() => createGrass({ count: 6000, keep: inMask }));
    grass.userData.update(0.016, 0, new THREE.Vector3(0, 0, -440));
    const mesh = grass.children[0];
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    let visible = 0;
    const out = [];
    for (let i = 0; i < mesh.count; i += 1) {
      mesh.getMatrixAt(i, m);
      // setFromMatrixScale (bukan decompose: decompose melaporkan skala 1 untuk matriks skala nol)
      if (s.setFromMatrixScale(m).x === 0) continue;
      p.setFromMatrixPosition(m);
      visible += 1;
      if (!inMask(p.x, p.z)) out.push([p.x, p.z]);
    }
    expect(visible).toBeGreaterThan(0);
    expect(out).toEqual([]);
  });
});

describe('keterjangkauan telur jejak (collider komposit)', () => {
  const egg = (id) => EASTER_EGGS.find((e) => e.id === id).at;
  const tileFile = (key) => `public/tiles/${key}.data.json`;
  /** Collider komposit seperti main.js: region stadion + TileCollider kota (tile di sekitar titik). */
  const compositeAround = (at, margin = 60) => {
    const city = createTileCollider();
    const keys = tilesInRect({ minX: at.x - margin, minZ: at.z - margin, maxX: at.x + margin, maxZ: at.z + margin })
      .map((t) => t.key).filter((k) => existsSync(tileFile(k)));
    const tiles = keys.map((k) => [k, decodeTileData(JSON.parse(readFileSync(tileFile(k), 'utf8')))]);
    tiles.forEach(([k, t]) => city.addTile(k, t));
    return {
      tiles: tiles.map(([, t]) => t),
      comp: createCompositeCollider({ regions: [{ region: stadionRegion, colliders: stadionColliders }], fallback: city }),
    };
  };

  it('jejak-2: di dalam mask dan walkable (collider region lewat komposit)', () => {
    const at = egg('jejak-2');
    expect(inMask(at.x, at.z)).toBe(true);
    const { comp } = compositeAround(at);
    expect(comp.isWalkable(at.x, at.z)).toBe(true);
  });

  it('jejak-3 (Venue Baseball OSM, di luar mask): walkable menurut TileCollider, bukan di footprint bangunan tile', () => {
    const at = egg('jejak-3');
    expect(inMask(at.x, at.z)).toBe(false);
    const { tiles, comp } = compositeAround(at);
    expect(tiles.length).toBeGreaterThan(0);
    const buildings = tiles.flatMap((t) => t.buildings);
    expect(buildings.length).toBeGreaterThan(0); // data tile termuat (kontrol)
    expect(buildings.some((b) => pointInPolygon(at.x, at.z, b.ring))).toBe(false);
    expect(comp.isWalkable(at.x, at.z)).toBe(true);
    // ada jalan masuk: sebagian besar titik dalam radius pemicu juga walkable
    const ring = Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      return [at.x + Math.cos(a) * at.radius * 0.5, at.z + Math.sin(a) * at.radius * 0.5];
    });
    expect(ring.filter(([x, z]) => comp.isWalkable(x, z)).length).toBeGreaterThanOrEqual(12);
  });
});
