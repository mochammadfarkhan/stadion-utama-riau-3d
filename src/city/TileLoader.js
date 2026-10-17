/**
 * TileLoader: mengeksekusi aksi ChunkStreamer (I/O). Memuat {key}.data.json (divalidasi) dan
 * {key}.lod{n}.glb (GLTFLoader + MeshoptDecoder), memasang grup tile di pusat tile, mengganti
 * material berdasarkan nama mesh, freezeStatic per tile, mendaftarkan collider/minimap/permukaan
 * basah, dan melepas semuanya saat tile dilepas. Galat jaringan dicoba ulang `retries`× dengan
 * backoff; data tak valid tidak dicoba ulang (tile dilewati, spec §5).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { tileCenter } from '../geo/tiles.js';
import { disposeTree } from '../engine/disposeTree.js';
import { freezeStatic } from '../engine/freezeStatic.js';
import { applyCityMaterials } from './cityMaterials.js';
import { decodeTileData, validateTileData } from './tileData.js';

export const TILE_RETRIES = 2;
export const TILE_BACKOFF_MS = Object.freeze([500, 1500]);

/** Galat yang tidak layak dicoba ulang (data rusak/tak valid). */
export class TileDataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TileDataError';
  }
}

/** GLTFLoader dengan dekoder meshopt (EXT_meshopt_compression + KHR_mesh_quantization). */
export function createGltfLoader() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return (url) => loader.loadAsync(url);
}

/** fetch JSON dengan galat HTTP eksplisit. */
export async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {{manifest: object, baseUrl?: string, parent: THREE.Object3D, materials: ReturnType<import('./cityMaterials.js').createCityMaterials>,
 *   collider: {addTile(key:string, tile:object):void, removeTile(key:string):boolean},
 *   minimap?: {add(key:string, tile:object):void, drop(key:string):void}|null,
 *   weather?: {registerWet(root:THREE.Object3D): () => boolean}|null,
 *   loadGltf?: (url:string) => Promise<{scene: THREE.Object3D}>, fetchJson?: (url:string) => Promise<unknown>,
 *   retries?: number, backoffMs?: readonly number[], sleep?: (ms:number) => Promise<void>,
 *   onFail?: (key:string, err:unknown) => void, logger?: {error: (...a: unknown[]) => void}}} opts
 */
export function createTileLoader({
  manifest, baseUrl = '/', parent, materials, collider, minimap = null, weather = null,
  loadGltf = createGltfLoader(), fetchJson: getJson = fetchJson, retries = TILE_RETRIES, backoffMs = TILE_BACKOFF_MS,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onFail = () => {}, logger = console,
}) {
  const info = new Map(manifest.tiles.map((t) => [t.key, t]));
  const entries = new Map(); // key → {root, lod, offWet, meshes, triangles}
  const decoded = new Map(); // key → data tile terdekode (dipakai ulang saat tukar LOD)
  const url = (file) => `${baseUrl}tiles/${file}`;

  const retry = async (fn) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        if (err instanceof TileDataError || attempt >= retries) throw err;
        await sleep(backoffMs[Math.min(attempt, backoffMs.length - 1)]);
      }
    }
  };

  const loadData = async (t) => {
    if (decoded.has(t.key)) return decoded.get(t.key);
    const json = await retry(() => getJson(url(t.data.file)));
    const check = validateTileData(json, t.key);
    if (!check.ok) throw new TileDataError(`tile ${t.key}: ${check.error}`);
    const tile = decodeTileData(json);
    decoded.set(t.key, tile);
    return tile;
  };

  const buildRoot = async (t, lod) => {
    const gltf = await retry(() => loadGltf(url(t.lod[lod].file)));
    const root = new THREE.Group();
    root.name = `tile:${t.key}:lod${lod}`;
    const c = tileCenter(t.ix, t.iz);
    root.position.set(c.x, 0, c.z); // kontrak: transform node GLB (kuantisasi) tidak boleh direset
    root.add(gltf.scene);
    return { root, ...applyCityMaterials(gltf.scene, materials) };
  };

  const discard = (root) => disposeTree(root, { scope: materials }); // material kota dibagi: hanya geometri

  const attach = (key, built, lod) => {
    parent.add(built.root);
    freezeStatic(built.root);
    const offWet = weather ? weather.registerWet(built.root) : null;
    entries.set(key, { root: built.root, lod, offWet, meshes: built.meshes, triangles: built.triangles });
  };

  const detach = (key) => {
    const e = entries.get(key);
    if (!e) return;
    entries.delete(key);
    e.offWet?.();
    e.root.removeFromParent();
    discard(e.root);
  };

  const fail = (streamer, action, err) => {
    if (streamer.failed(action.key, action.req)) {
      logger.error(`Tile ${action.key} gagal dimuat:`, err);
      onFail(action.key, err);
    }
  };

  async function load(action, streamer) {
    const t = info.get(action.key);
    let tile;
    let built;
    try {
      [tile, built] = await Promise.all([loadData(t), buildRoot(t, action.lod)]);
    } catch (err) {
      fail(streamer, action, err);
      return;
    }
    if (!streamer.loaded(action.key, action.lod, action.req)) {
      discard(built.root); // dibatalkan sementara dimuat
      return;
    }
    attach(action.key, built, action.lod);
    collider.addTile(action.key, tile);
    minimap?.add(action.key, tile);
  }

  async function swap(action, streamer) {
    const t = info.get(action.key);
    let built;
    try {
      built = await buildRoot(t, action.lod);
    } catch (err) {
      fail(streamer, action, err);
      return;
    }
    if (!streamer.loaded(action.key, action.lod, action.req)) {
      discard(built.root);
      return;
    }
    detach(action.key); // LOD lama dilepas setelah yang baru siap (tanpa lubang)
    attach(action.key, built, action.lod);
  }

  function unload(key) {
    detach(key);
    decoded.delete(key);
    collider.removeTile(key);
    minimap?.drop(key);
  }

  return {
    /** Eksekusi satu aksi streamer; muatan berjalan async (hasil dilaporkan ke streamer). */
    execute(action, streamer) {
      if (!info.has(action.key)) return Promise.resolve();
      switch (action.type) {
        case 'load': return load(action, streamer);
        case 'swap': return swap(action, streamer);
        case 'unload': unload(action.key); return Promise.resolve();
        default: return Promise.resolve(); // 'cancel': hasil basi dibuang saat streamer.loaded() = false
      }
    },
    has: (key) => entries.has(key),
    lodOf: (key) => entries.get(key)?.lod ?? null,
    stats() {
      let meshes = 0;
      let triangles = 0;
      for (const e of entries.values()) {
        meshes += e.meshes;
        triangles += e.triangles;
      }
      return { tiles: entries.size, meshes, triangles };
    },
    dispose() { for (const key of [...entries.keys()]) unload(key); },
  };
}
