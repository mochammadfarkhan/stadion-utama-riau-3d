import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { signedArea } from '../../src/geo/polygon.js';
import {
  ROOFS, buildingRoof, createRoofMesh, ensureCCW, fieldRoof, hipRoof, insetRing, rectFrame, skirtRoof, triNormal,
} from '../../src/city/roofs.js';

const rect = (w, l, ang = 0, cx = 0, cz = 0) => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]].map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c]);
};
const L = [[0, 0], [40, 0], [40, 15], [15, 15], [15, 40], [0, 40]];
const maxY = (tris) => Math.max(...tris.flat().map((p) => p[1]));
const area = (t) => Math.hypot(...triNormal(t)) / 2;

describe('rectFrame', () => {
  it('persegi 20×10 miring 30°', () => {
    const f = rectFrame(rect(20, 10, Math.PI / 6));
    expect(f.hu).toBeCloseTo(10, 5);
    expect(f.hv).toBeCloseTo(5, 5);
  });
  it('trapesium tak siku dan 5 titik → null', () => {
    expect(rectFrame([[0, 0], [20, 0], [16, 10], [4, 10]])).toBeNull();
    expect(rectFrame([[0, 0], [20, 0], [24, 8], [10, 14], [-3, 8]])).toBeNull();
  });
});

describe('hipRoof', () => {
  it('persegi 20×10: 6 segitiga, puncak benar, normal ke atas', () => {
    const tris = hipRoof(rectFrame(rect(20, 10)), 9);
    expect(tris).toHaveLength(6);
    expect(maxY(tris)).toBeCloseTo(9 + Math.min(5.5 * ROOFS.pitch, ROOFS.maxRise), 6);
    for (const t of tris) expect(triNormal(t)[1]).toBeGreaterThan(0);
  });
  it('bujur sangkar → piramida tanpa segitiga degenerasi', () => {
    const tris = hipRoof(rectFrame(rect(10, 10)), 5);
    expect(tris).toHaveLength(4);
    for (const t of tris) expect(area(t)).toBeGreaterThan(1e-3);
  });
});

describe('insetRing', () => {
  it('bentuk L lega → lebih kecil dan sah', () => {
    const r = insetRing(ensureCCW(L), 3);
    expect(r).toHaveLength(L.length);
    expect(signedArea(r)).toBeGreaterThan(0);
    expect(signedArea(r)).toBeLessThan(signedArea(ensureCCW(L)));
  });
  it('lorong sempit 3 m dengan d=3 → null', () => {
    expect(insetRing(ensureCCW([[0, 0], [30, 0], [30, 3], [3, 3], [3, 30], [0, 30]]), 3)).toBeNull();
  });
});

describe('skirtRoof', () => {
  it('bentuk L: normal ke atas, naik, CW = CCW', () => {
    const a = skirtRoof(L, 6);
    const b = skirtRoof([...L].reverse(), 6);
    expect(a.length).toBeGreaterThan(0);
    expect(maxY(a)).toBeGreaterThan(6);
    for (const t of a) expect(triNormal(t)[1]).toBeGreaterThanOrEqual(0);
    expect(b).toHaveLength(a.length);
  });
});

const U = [[0, 0], [40, 0], [40, 30], [37, 30], [37, 3], [3, 3], [3, 30], [0, 30]]; // lorong sempit 3 m
const projArea = (tris) => tris.reduce((s, t) => s + Math.abs(signedArea(t.map((p) => [p[0], p[2]]))), 0);

describe('fieldRoof', () => {
  it('persegi 20×10: puncak, tepi di eaveY, normal ke atas, luas proyeksi 200', () => {
    const tris = fieldRoof(rect(20, 10), 8);
    expect(Math.abs(maxY(tris) - (8 + Math.min(5 * ROOFS.pitch, ROOFS.maxRise)))).toBeLessThan(0.3);
    for (const [x, y, z] of tris.flat()) {
      if (Math.abs(Math.abs(x) - 10) < 1e-6 || Math.abs(Math.abs(z) - 5) < 1e-6) expect(y).toBeCloseTo(8, 6);
    }
    for (const t of tris) expect(triNormal(t)[1]).toBeGreaterThan(0);
    expect(Math.abs(projArea(tris) - 200) / 200).toBeLessThan(0.01);
  });
  it('bentuk U lorong sempit: insetRing null, tetap beratap; CW = CCW', () => {
    expect(insetRing(ensureCCW(U), 3)).toBeNull();
    const a = fieldRoof(U, 6);
    const b = fieldRoof([...U].reverse(), 6);
    const A = Math.abs(signedArea(U));
    expect(a.length).toBeGreaterThan(0);
    expect(Math.abs(projArea(a) - A) / A).toBeLessThan(0.01);
    expect(Math.abs(projArea(b) - projArea(a))).toBeLessThan(1e-6);
    for (const t of a) expect(triNormal(t)[1]).toBeGreaterThan(0);
  });
});

describe('buildingRoof', () => {
  it('U sempit → field; L kecil lega → skirt', () => {
    const f = buildingRoof({ height: 7, ring: U }, 3);
    expect(f.kind).toBe('field');
    expect(f.tris.length).toBeGreaterThan(0);
    expect(buildingRoof({ height: 7, ring: L }, 3).kind).toBe('skirt');
  });
  it('rumah kecil 10×8 → kosong (pelana dari bake)', () => {
    expect(buildingRoof({ height: 6, ring: rect(10, 8) }, 1).tris).toHaveLength(0);
  });
  it('30×20 tinggi 9 → limasan terakota', () => {
    const r = buildingRoof({ height: 9, ring: rect(30, 20) }, 42);
    expect(r.kind).toBe('hip');
    expect(r.tris).toHaveLength(6);
    for (const [cr, , cb] of r.colors) expect(cr).toBeGreaterThan(cb * 1.6);
  });
  it('gedung tinggi 30 m → hanya kotak, puncak ≤ height + 3', () => {
    const r = buildingRoof({ height: 30, ring: rect(40, 30) }, 9);
    expect(r.kind).toBe('boxes');
    expect(r.tris.length).toBeGreaterThan(0);
    expect(maxY(r.tris)).toBeLessThanOrEqual(33);
    expect(Math.min(...r.tris.flat().map((p) => p[1]))).toBeGreaterThanOrEqual(30);
  });
  it('deterministik untuk seed sama', () => {
    const b = { height: 7, ring: L };
    expect(buildingRoof(b, 5)).toEqual(buildingRoof(b, 5));
    const t = { height: 25, ring: rect(40, 30) };
    expect(buildingRoof(t, 5)).toEqual(buildingRoof(t, 5));
  });
});

describe('createRoofMesh', () => {
  it('tile buatan 3 gedung → Mesh atap', () => {
    const tile = {
      key: '0_0', center: { x: 0, z: 0 },
      buildings: [{ height: 9, ring: rect(30, 20, 0, 50, 50) }, { height: 7, ring: L }, { height: 30, ring: rect(40, 30, 0, -80, -80) }],
    };
    const mesh = createRoofMesh(tile, new THREE.MeshLambertMaterial({ vertexColors: true }));
    expect(mesh.name).toBe('atap');
    const { position, color, normal } = mesh.geometry.attributes;
    expect(position.array.length).toBe(color.array.length);
    expect(position.array.length).toBe(normal.array.length);
    expect(position.array.length % 9).toBe(0);
    expect(createRoofMesh({ ...tile, buildings: [] }, null)).toBeNull();
  });
});
