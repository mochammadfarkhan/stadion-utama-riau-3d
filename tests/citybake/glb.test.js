import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { MESH_NAMES, writeTileGlb, readGlbSummary } from '../../tools/citybake/glb.js';
import { createMeshBuilder } from '../../tools/citybake/geometry/meshBuilder.js';
import { addFlatPolygon } from '../../tools/citybake/geometry/areas.js';
import { addBuilding } from '../../tools/citybake/geometry/buildings.js';
import { WHITE, rect } from './meshTestUtils.js';

/** JSON chunk GLB mentah (untuk memeriksa tipe komponen accessor & transform node). */
function glbJson(bytes) {
  const len = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
}

const INT8 = 5120;
const UINT8 = 5121;
const INT16 = 5122;

function sampleMeshes() {
  const walls = createMeshBuilder();
  const roofs = createMeshBuilder();
  const water = createMeshBuilder();
  addBuilding({ walls, roofs }, { rings: [rect(100, -100, 20, 10)], height: 9.6, wallRgb: WHITE, roofRgb: [0.3, 0.3, 0.3] });
  addFlatPolygon(water, [rect(-150, 150, 80, 60)], 0.04, [0.05, 0.15, 0.25]);
  return { buildings_walls: walls.toArrays(), buildings_roofs: roofs.toArrays(), water: water.toArrays(), roads: null, landuse: null };
}

describe('writeTileGlb / readGlbSummary', () => {
  it('nama node/mesh/material, urutan MESH_NAMES, node kosong dilewati', async () => {
    const s = await readGlbSummary(await writeTileGlb(sampleMeshes(), 'tile_0_-1_lod0'));
    expect(s.scene).toBe('tile_0_-1_lod0');
    expect(s.nodes.map((n) => n.name)).toEqual(['water', 'buildings_walls', 'buildings_roofs']);
    for (const n of s.nodes) {
      expect(n.mesh).toBe(n.name);
      expect(n.material).toBe(n.name);
      expect(n.attributes).toEqual(['COLOR_0', 'NORMAL', 'POSITION']);
    }
    expect(s.nodes.map((n) => n.triangles)).toEqual([2, 8, 2]);
    expect(MESH_NAMES).toEqual(['landuse', 'water', 'roads', 'buildings_walls', 'buildings_roofs']);
  });

  it('memakai EXT_meshopt_compression + KHR_mesh_quantization (wajib)', async () => {
    const s = await readGlbSummary(await writeTileGlb(sampleMeshes(), 't'));
    expect(s.extensionsRequired).toEqual(['EXT_meshopt_compression', 'KHR_mesh_quantization']);
  });

  it('atribut terkuantisasi sesuai kontrak; translation + scale pada node', async () => {
    const json = glbJson(await writeTileGlb(sampleMeshes(), 't'));
    for (const mesh of json.meshes) {
      const { attributes, mode } = mesh.primitives[0];
      expect(mesh.primitives).toHaveLength(1);
      expect(mode).toBe(4);
      const acc = (k) => json.accessors[attributes[k]];
      expect([acc('POSITION').componentType, acc('POSITION').normalized]).toEqual([INT16, true]);
      expect([acc('NORMAL').componentType, acc('NORMAL').normalized]).toEqual([INT8, true]);
      expect([acc('COLOR_0').componentType, acc('COLOR_0').normalized, acc('COLOR_0').type]).toEqual([UINT8, true, 'VEC3']);
    }
    for (const node of json.nodes) {
      expect(node.translation).toHaveLength(3);
      expect(node.scale).toHaveLength(3);
    }
  });

  it('deterministik: byte identik untuk input identik', async () => {
    const h = async () => createHash('sha1').update(await writeTileGlb(sampleMeshes(), 't')).digest('hex');
    expect(await h()).toBe(await h());
  });
});
