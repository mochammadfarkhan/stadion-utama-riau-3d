import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildTerrainChunkMesh, buildTerrainChunkMeshSteps, lodIndices, createTerrainMaterial, TERRAIN_MESH,
} from '../../src/world/terrain/TerrainMesh.js';
import { decodeChunk, createHeightField } from '../../src/geo/terrain/heightfield.js';
import { TERRAIN_HEADER, N, BIAS, UNIT } from '../../src/geo/terrain/format.js';

function chunkOf(key, fn) {
  const buf = new ArrayBuffer(N * N * 2);
  const view = new DataView(buf);
  for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) view.setUint16((r * N + c) * 2, Math.round(fn(r, c) / UNIT) - BIAS, true);
  return decodeChunk(buf, { ...TERRAIN_HEADER, key });
}
const materials = { terrain: new THREE.MeshBasicMaterial() };
const triangles = (mesh) => mesh.geometry.index.count / 3;
const vertices = (mesh) => mesh.geometry.attributes.position.count;

describe('lodIndices', () => {
  it('LOD0 = 126 simpul, LOD1 = 0,4,…,124,125 (33 simpul)', () => {
    expect(lodIndices(126, 0)).toHaveLength(126);
    const l1 = lodIndices(126, 1);
    expect(l1).toHaveLength(33);
    expect(l1.slice(0, 3)).toEqual([0, 4, 8]);
    expect(l1.slice(-2)).toEqual([124, 125]);
  });
});

describe('buildTerrainChunkMesh', () => {
  const flat = chunkOf('-1_2', () => 1.5);

  it('LOD0 penuh: 126² simpul + 1.000 skirt, 31.250 + 1.000 segitiga, di origin chunk', () => {
    const mesh = buildTerrainChunkMesh(flat, null, { lod: 0, materials });
    expect(vertices(mesh)).toBe(126 * 126 + 4 * 125 * 2);
    expect(triangles(mesh)).toBe(125 * 125 * 2 + 4 * 125 * 2);
    expect(mesh.position.toArray()).toEqual([-500, 0, 1000]);
    expect(mesh.renderOrder).toBe(TERRAIN_MESH.renderOrder);
    expect(mesh.name).toBe('terrain:-1_2:lod0');
    expect(mesh.geometry.index.array).toBeInstanceOf(Uint16Array);
  });

  it('LOD1: 33² simpul + 256 skirt, 2.048 + 256 segitiga', () => {
    const mesh = buildTerrainChunkMesh(flat, null, { lod: 1, materials });
    expect(vertices(mesh)).toBe(33 * 33 + 4 * 32 * 2);
    expect(triangles(mesh)).toBe(32 * 32 * 2 + 4 * 32 * 2);
  });

  it('y simpul = data chunk; skirt 2 m di bawah tepi; UV = meter dunia', () => {
    const slope = chunkOf('0_0', (r, c) => 0.05 * c * 4);
    const mesh = buildTerrainChunkMesh(slope, null, { lod: 0, materials });
    const p = mesh.geometry.attributes.position;
    expect(p.getY(10)).toBeCloseTo(2, 2); // c = 10 → x 40 m → 2 m
    expect(p.getY(126 * 126)).toBeCloseTo(p.getY(0) - 2, 5); // simpul skirt pertama = salinan simpul 0 − 2 m
    const uv = mesh.geometry.attributes.uv;
    expect([uv.getX(127), uv.getY(127)]).toEqual([4, 4]);
  });

  it('normal bidang miring 5% ke timur = (−0,0499, 0,9988, 0)', () => {
    const slope = chunkOf('0_0', (r, c) => 0.05 * c * 4);
    const n = buildTerrainChunkMesh(slope, null, { lod: 0, materials }).geometry.attributes.normal;
    const k = 60 * 126 + 60;
    expect(n.getX(k)).toBeCloseTo(-0.05 / Math.hypot(0.05, 1), 3);
    expect(n.getY(k)).toBeCloseTo(1 / Math.hypot(0.05, 1), 3);
    expect(n.getZ(k)).toBeCloseTo(0, 6);
  });

  it('normal tepi timur memakai chunk tetangga dari HeightField bila termuat', () => {
    const field = createHeightField();
    const a = chunkOf('0_0', () => 0);
    field.add(a);
    field.add(chunkOf('1_0', (r, c) => 0.1 * c * 4)); // tetangga timur naik 10%
    const n = buildTerrainChunkMesh(a, field, { lod: 0, materials }).geometry.attributes.normal;
    const edge = 60 * 126 + 125; // simpul tepi timur
    expect(n.getX(edge)).toBeLessThan(-0.04); // (H(c+1) − H(c−1)) / 8 = 0,4/8 = 0,05 → miring
    const noField = buildTerrainChunkMesh(a, null, { lod: 0, materials }).geometry.attributes.normal;
    expect(noField.getX(edge)).toBeCloseTo(0, 6);
  });

  it('cellInside membatasi sel: kolom < 10 saja → 2.500 + 290 segitiga', () => {
    const mesh = buildTerrainChunkMesh(flat, null, { lod: 0, materials, cellInside: (r, c) => c < 10 });
    // skirt: utara 10 + selatan 10 + barat 125 segmen (timur tidak) = 145 × 2
    expect(triangles(mesh)).toBe(125 * 10 * 2 + 145 * 2);
  });

  it('tanpa sel di dalam → null; generator memberi titik potong (8 untuk LOD0)', () => {
    expect(buildTerrainChunkMesh(flat, null, { lod: 0, materials, cellInside: () => false })).toBeNull();
    const it = buildTerrainChunkMeshSteps(flat, null, { lod: 0, materials });
    let yields = 0;
    for (let r = it.next(); !r.done; r = it.next()) yields += 1;
    expect(yields).toBe(8);
  });

  it('createTerrainMaterial: rumput bertekstur dengan polygonOffset', () => {
    const mat = createTerrainMaterial();
    expect(mat.name).toBe('terrain');
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBe(1);
    expect(mat.map).toBeTruthy();
    mat.dispose();
  });
});
