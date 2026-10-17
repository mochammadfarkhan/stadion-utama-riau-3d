import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createTileLoader, TileDataError, fetchJson } from '../../src/city/TileLoader.js';
import { createCityMaterials, CITY_LAYERS } from '../../src/city/cityMaterials.js';
import { createChunkStreamer } from '../../src/city/ChunkStreamer.js';
import { createTileCollider } from '../../src/city/TileCollider.js';

const quiet = { error() {} };
const KEY = '0_-1';
const DATA = {
  v: 1, key: KEY, ix: 0, iz: -1, center: [250, -250], unit: 0.1,
  buildings: [{ h: 64, ring: [-100, -100, 100, -100, 100, 100, -100, 100] }], water: [], waterways: [], roads: [],
};
const manifest = {
  tiles: [{ key: KEY, ix: 0, iz: -1, lod: [{ level: 0, file: `${KEY}.lod0.glb` }, { level: 1, file: `${KEY}.lod1.glb` }], data: { file: `${KEY}.data.json` } }],
};

/** Scene GLB palsu: mesh bernama sesuai kontrak + satu nama asing. */
function fakeGltf(names = ['landuse', 'roads', 'buildings_walls', 'asing']) {
  const scene = new THREE.Group();
  for (const n of names) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
    m.name = n;
    scene.add(m);
  }
  return { scene };
}

function setup({ gltf = () => Promise.resolve(fakeGltf()), json = () => Promise.resolve(structuredClone(DATA)), weather = null } = {}) {
  const parent = new THREE.Group();
  const materials = createCityMaterials();
  const collider = createTileCollider();
  const minimap = { added: [], dropped: [], add(k) { this.added.push(k); }, drop(k) { this.dropped.push(k); } };
  const fails = [];
  const calls = { gltf: [], json: [] };
  const loader = createTileLoader({
    manifest, baseUrl: '/base/', parent, materials, collider, minimap, weather,
    loadGltf: (u) => { calls.gltf.push(u); return gltf(u); },
    fetchJson: (u) => { calls.json.push(u); return json(u); },
    sleep: () => Promise.resolve(), onFail: (k, e) => fails.push([k, e]), logger: quiet,
  });
  const streamer = createChunkStreamer({ tiles: manifest.tiles });
  return { parent, materials, collider, minimap, fails, calls, loader, streamer };
}

const run = async (s, focus) => {
  for (const a of s.streamer.update(focus)) await s.loader.execute(a, s.streamer);
};

describe('TileLoader', () => {
  it('muat: grup di pusat tile, material kota per nama + renderOrder, collider & minimap terdaftar', async () => {
    const s = setup();
    await run(s, { x: 250, z: -250 });
    expect(s.calls.json).toEqual(['/base/tiles/0_-1.data.json']);
    expect(s.calls.gltf).toEqual(['/base/tiles/0_-1.lod0.glb']);
    const root = s.parent.children[0];
    expect(root.position.toArray()).toEqual([250, 0, -250]);
    const meshes = {};
    root.traverse((o) => { if (o.isMesh) meshes[o.name] = o; });
    expect(meshes.landuse.material).toBe(s.materials.forMesh('landuse'));
    expect(meshes.landuse.renderOrder).toBe(CITY_LAYERS.landuse.renderOrder);
    expect(meshes.landuse.material.depthWrite).toBe(false);
    expect(meshes.buildings_walls.castShadow).toBe(true);
    expect(meshes.asing.visible).toBe(false);
    expect(root.children[0].matrixAutoUpdate).toBe(false); // freezeStatic
    expect(s.collider.isWalkable(250, -250)).toBe(false);  // bangunan 20 × 20 m di pusat
    expect(s.minimap.added).toEqual([KEY]);
    expect(s.loader.stats()).toMatchObject({ tiles: 1, meshes: 3 });
  });

  it('lepas: geometri dilepas, material bersama tidak; collider & minimap dibersihkan; registry basah dicabut', async () => {
    const wet = [];
    const s = setup({ weather: { registerWet: (r) => { wet.push(`+${r.name}`); return () => { wet.push(`-${r.name}`); return true; }; } } });
    await run(s, { x: 250, z: -250 });
    const geos = [];
    s.parent.traverse((o) => { if (o.isMesh) geos.push(o.geometry); });
    let disposed = 0;
    geos.forEach((g) => g.addEventListener('dispose', () => { disposed += 1; }));
    let matDisposed = false;
    s.materials.forMesh('roads').addEventListener('dispose', () => { matDisposed = true; });
    await run(s, { x: 5000, z: -250 });
    expect(s.parent.children).toHaveLength(0);
    expect(disposed).toBe(geos.length);
    expect(matDisposed).toBe(false);
    expect(s.collider.isWalkable(250, -250)).toBe(true);
    expect(s.minimap.dropped).toEqual([KEY]);
    expect(wet).toEqual(['+tile:0_-1:lod0', '-tile:0_-1:lod0']);
  });

  it('tukar LOD: LOD baru terpasang, LOD lama dilepas; data tidak diunduh ulang', async () => {
    const s = setup();
    await run(s, { x: 250, z: -1100 }); // 850 m → LOD1
    expect(s.loader.lodOf(KEY)).toBe(1);
    await run(s, { x: 250, z: -700 });  // 450 m → LOD0
    expect(s.loader.lodOf(KEY)).toBe(0);
    expect(s.parent.children).toHaveLength(1);
    expect(s.parent.children[0].name).toBe('tile:0_-1:lod0');
    expect(s.calls.json).toHaveLength(1);
  });

  it('galat jaringan dicoba ulang 2× lalu gagal: onFail sekali, streamer menandai gagal', async () => {
    let n = 0;
    const s = setup({ gltf: () => { n += 1; return Promise.reject(new Error('jaringan')); } });
    await run(s, { x: 250, z: -250 });
    expect(n).toBe(3);
    expect(s.fails.map(([k]) => k)).toEqual([KEY]);
    expect(s.streamer.status(KEY)).toBe('failed');
    expect(s.parent.children).toHaveLength(0);
  });

  it('data tak valid tidak dicoba ulang dan tile dilewati', async () => {
    let n = 0;
    const s = setup({ json: () => { n += 1; return Promise.resolve({ ...DATA, v: 9 }); } });
    await run(s, { x: 250, z: -250 });
    expect(n).toBe(1);
    expect(s.fails[0][1]).toBeInstanceOf(TileDataError);
    expect(s.parent.children).toHaveLength(0);
  });

  it('JSON rusak (SyntaxError) tidak dicoba ulang: dibungkus TileDataError, tile dilewati', async () => {
    let n = 0;
    const s = setup({ json: () => { n += 1; return Promise.reject(new SyntaxError('Unexpected token < in JSON')); } });
    await run(s, { x: 250, z: -250 });
    expect(n).toBe(1);
    expect(s.fails[0][1]).toBeInstanceOf(TileDataError);
    expect(s.fails[0][1].cause).toBeInstanceOf(SyntaxError);
    expect(s.streamer.status(KEY)).toBe('failed');
  });

  it('loadTileData: tile termuat → data terdekode dari cache tanpa unduh ulang', async () => {
    const s = setup();
    await run(s, { x: 250, z: -250 });
    expect(s.calls.json).toHaveLength(1);
    const tile = await s.loader.loadTileData(KEY);
    expect(tile.key).toBe(KEY);
    expect(tile.buildings).toHaveLength(1);
    expect(s.calls.json).toHaveLength(1);
  });

  it('loadTileData: tile belum termuat → jalur muat yang sama (retry, validasi), hasil tidak di-cache', async () => {
    let n = 0;
    const s = setup({ json: () => { n += 1; return n === 1 ? Promise.reject(new Error('jaringan')) : Promise.resolve(structuredClone(DATA)); } });
    const tile = await s.loader.loadTileData(KEY);
    expect(tile.key).toBe(KEY);
    expect(n).toBe(2); // dicoba ulang setelah galat jaringan
    await s.loader.loadTileData(KEY);
    expect(n).toBe(3); // tidak di-cache (tile tidak dikelola streamer)
    expect(s.parent.children).toHaveLength(0);
  });

  it('loadTileData: data tak valid → TileDataError; kunci asing → TileDataError tanpa unduh', async () => {
    const s = setup({ json: () => Promise.resolve({ ...DATA, v: 9 }) });
    await expect(s.loader.loadTileData(KEY)).rejects.toBeInstanceOf(TileDataError);
    await expect(s.loader.loadTileData('9_9')).rejects.toBeInstanceOf(TileDataError);
    expect(s.calls.json).toHaveLength(1);
  });

  it('hasil yang datang setelah dibatalkan dibuang (tidak terpasang, geometri dilepas)', async () => {
    let resolve;
    const s = setup({ gltf: () => new Promise((r) => { resolve = r; }) });
    const [load] = s.streamer.update({ x: 250, z: -250 });
    const pending = s.loader.execute(load, s.streamer);
    expect(s.streamer.update({ x: 250, z: -1900 })).toEqual([{ type: 'cancel', key: KEY, req: load.req }]); // 1400 m > unloadRadius: batal
    const late = fakeGltf(['roads']);
    let disposed = false;
    late.scene.children[0].geometry.addEventListener('dispose', () => { disposed = true; });
    resolve(late);
    await pending;
    expect(s.parent.children).toHaveLength(0);
    expect(disposed).toBe(true);
  });

  it('muatan yang selesai setelah dispose dibuang: tanpa attach/registerWet/collider/minimap/onFail, geometri dilepas', async () => {
    let resolve;
    const wet = [];
    const s = setup({
      gltf: () => new Promise((r) => { resolve = r; }),
      weather: { registerWet: (r) => { wet.push(r.name); return () => true; } },
    });
    const [load] = s.streamer.update({ x: 250, z: -250 });
    const pending = s.loader.execute(load, s.streamer);
    s.loader.dispose();
    const late = fakeGltf();
    let disposed = 0;
    late.scene.children.forEach((m) => m.geometry.addEventListener('dispose', () => { disposed += 1; }));
    resolve(late);
    await pending;
    expect(s.parent.children).toHaveLength(0);
    expect(wet).toEqual([]);
    expect(s.collider.tileCount).toBe(0);
    expect(s.minimap.added).toEqual([]);
    expect(s.loader.stats().tiles).toBe(0);
    expect(disposed).toBe(late.scene.children.length);
  });

  it('galat muatan setelah dispose tidak melapor gagal (onFail)', async () => {
    let reject;
    const s = setup({ gltf: () => new Promise((_, r) => { reject = r; }) });
    const [load] = s.streamer.update({ x: 250, z: -250 });
    const pending = s.loader.execute(load, s.streamer);
    s.loader.dispose();
    reject(new TileDataError('rusak'));
    await pending;
    expect(s.fails).toEqual([]);
  });

  it('tukar LOD yang selesai setelah dispose dibuang: LOD baru tidak terpasang, geometrinya dilepas', async () => {
    let held = null;
    const wet = [];
    const s = setup({
      gltf: (u) => (u.endsWith('lod0.glb') ? new Promise((r) => { held = r; }) : Promise.resolve(fakeGltf())),
      weather: { registerWet: (r) => { wet.push(`+${r.name}`); return () => { wet.push(`-${r.name}`); return true; }; } },
    });
    await run(s, { x: 250, z: -1100 }); // LOD1
    const [swap] = s.streamer.update({ x: 250, z: -700 });
    expect(swap.type).toBe('swap');
    const pending = s.loader.execute(swap, s.streamer);
    s.loader.dispose();
    const late = fakeGltf(['roads']);
    let disposed = false;
    late.scene.children[0].geometry.addEventListener('dispose', () => { disposed = true; });
    held(late);
    await pending;
    expect(s.parent.children).toHaveLength(0);
    expect(wet).toEqual(['+tile:0_-1:lod1', '-tile:0_-1:lod1']);
    expect(disposed).toBe(true);
  });

  it('GLB nyata dari public/tiles termuat lewat GLTFLoader + MeshoptDecoder (Node)', async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
    await MeshoptDecoder.ready;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const buf = readFileSync('public/tiles/0_-1.lod0.glb');
    const gltf = await new Promise((res, rej) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
    const names = [];
    gltf.scene.traverse((o) => { if (o.isMesh) names.push(o.name); });
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(Object.keys(CITY_LAYERS)).toContain(n);
  });
});

describe('fetchJson', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('respons OK dengan badan bukan JSON → TileDataError (cause SyntaxError, url disebut)', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }));
    const err = await fetchJson('/tiles/x.data.json').catch((e) => e);
    expect(err).toBeInstanceOf(TileDataError);
    expect(err.cause).toBeInstanceOf(SyntaxError);
    expect(err.message).toContain('/tiles/x.data.json');
  });

  it('galat HTTP tetap galat biasa (boleh dicoba ulang)', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 503, json: async () => ({}) }));
    const err = await fetchJson('/tiles/x.data.json').catch((e) => e);
    expect(err).not.toBeInstanceOf(TileDataError);
    expect(err.message).toContain('HTTP 503');
  });
});
