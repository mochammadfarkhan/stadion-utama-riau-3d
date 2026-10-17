/**
 * Klien kota (Fase 2): manifest → ChunkStreamer (aksi) → TileLoader (I/O) → TileCollider, layer
 * minimap, dan tanah dasar kota yang mengikuti fokus. Satu sistem `city.stream` (fase world).
 * Kendaraan mangkal (parkedVehicles.js) dipasang di grup kota dan dilepas bersama kota.
 * Manifest gagal/tak valid → null + toast: pemanggil tetap mode hanya-region (spec §5).
 */
import * as THREE from 'three';
import { createChunkStreamer, STREAM } from './ChunkStreamer.js';
import { createTileLoader, createGltfLoader, fetchJson as defaultFetchJson } from './TileLoader.js';
import { createTileCollider } from './TileCollider.js';
import { createCityMaterials, CITY_LAYERS } from './cityMaterials.js';
import { createTileMinimapCache } from './tileMinimap.js';
import { validateManifest } from './tileData.js';
import { mountParkedVehicles } from './parkedVehicles.js';

/** Tanah dasar kota: persegi besar di bawah landuse (y −0,05), dipindah per 50 m mengikuti fokus. */
export const CITY_GROUND = Object.freeze({ size: 2 * STREAM.unloadRadius + 400, y: -0.05, snap: 50 });
export const SETTLE_TIMEOUT_MS = 20000;

function createCityGround(material) {
  const geo = new THREE.PlaneGeometry(CITY_GROUND.size, CITY_GROUND.size).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'tanahKota';
  mesh.position.y = CITY_GROUND.y;
  mesh.renderOrder = CITY_LAYERS.ground.renderOrder;
  mesh.receiveShadow = true;
  return mesh;
}

/** Posisi tanah dasar (snap grid) untuk fokus; murni. */
export function groundAnchor(focus, snap = CITY_GROUND.snap) {
  return { x: Math.round(focus.x / snap) * snap, z: Math.round(focus.z / snap) * snap };
}

/**
 * @param {{app: {scene: THREE.Scene, addSystem(s:object):object, removeSystem(id:string):boolean},
 *   baseUrl?: string, weather?: object|null, time?: {registerEmissive(root: THREE.Object3D): () => boolean}|null, toast?: (text:string, ok:boolean) => void,
 *   fetchJson?: (url:string) => Promise<unknown>, loadGltf?: (url:string) => Promise<{scene: THREE.Object3D}>,
 *   createCanvas?: (w:number, h:number) => object, logger?: {error: (...a: unknown[]) => void}, config?: typeof STREAM,
 *   setTimer?: (fn: () => void, ms: number) => unknown, clearTimer?: (handle: unknown) => void}} opts
 */
export async function createCity({
  app, baseUrl = '/', weather = null, time = null, toast = () => {}, fetchJson = defaultFetchJson, loadGltf = null,
  createCanvas = null, logger = console, config = STREAM, setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) => clearTimeout(handle),
}) {
  let manifest;
  try {
    manifest = await fetchJson(`${baseUrl}tiles/manifest.json`);
    const check = validateManifest(manifest);
    if (!check.ok) throw new Error(check.error);
  } catch (err) {
    logger.error('Manifest tile kota gagal dimuat; mode hanya-region:', err);
    toast('Peta kota gagal dimuat — hanya kawasan stadion', false);
    return null;
  }
  const group = new THREE.Group();
  group.name = 'kota';
  app.scene.add(group);
  const materials = createCityMaterials();
  const ground = createCityGround(materials.ground);
  group.add(ground);
  const collider = createTileCollider();
  const minimap = createTileMinimapCache(createCanvas ? { createCanvas } : {});
  const streamer = createChunkStreamer({ tiles: manifest.tiles, config });
  let warned = false;
  const gltf = loadGltf ?? createGltfLoader();
  const loader = createTileLoader({
    manifest, baseUrl, parent: group, materials, collider, minimap, weather, fetchJson, logger,
    loadGltf: gltf,
    onFail: () => {
      if (warned) return;
      warned = true;
      toast('Sebagian peta gagal dimuat', false);
    },
  });
  // Angkot & bus kota mangkal (statis): lampu ke registry malam, collider lingkaran di TileCollider kota.
  const vehicles = mountParkedVehicles({ parent: group, manifest, baseUrl, fetchJson, loadGltf: gltf, collider, time, logger });
  const waiters = new Set();
  let disposed = false;
  /** Selesaikan penunggu sekali dan bersihkan timer habis-waktunya. */
  const settle = (w, value) => {
    if (!waiters.delete(w)) return;
    clearTimer(w.timer);
    w.resolve(value);
  };
  const system = {
    id: 'city.stream',
    phase: 'world',
    update(dt, ctx) {
      const focus = ctx.focus ?? ctx.bikePos;
      if (!focus) return;
      const a = groundAnchor(focus);
      ground.position.set(a.x, CITY_GROUND.y, a.z);
      for (const action of streamer.update(focus)) {
        loader.execute(action, streamer).catch((err) => logger.error(`Aksi tile ${action.key} gagal:`, err));
      }
      for (const w of waiters) {
        if (streamer.settled(w.x, w.z, w.r)) settle(w, true);
      }
    },
    dispose() {},
  };
  app.addSystem(system);
  return {
    manifest, group, collider, minimap, streamer, loader, vehicles,
    /** Selesai bila semua tile dalam radius r dari (x, z) tampil/gagal; false bila habis waktu. */
    whenSettled(x, z, r = config.lod0Radius, timeoutMs = SETTLE_TIMEOUT_MS) {
      if (disposed) return Promise.resolve(false);
      if (streamer.settled(x, z, r)) return Promise.resolve(true);
      return new Promise((resolve) => {
        const w = { x, z, r, resolve, timer: null };
        waiters.add(w);
        w.timer = setTimer(() => { if (waiters.delete(w)) resolve(false); }, timeoutMs);
      });
    },
    stats: () => ({ ...streamer.stats(), ...loader.stats() }),
    dispose() {
      if (disposed) return;
      disposed = true;
      app.removeSystem(system.id);
      for (const w of [...waiters]) settle(w, false);
      vehicles.dispose(); // muatan kendaraan yang telat dibuang (tidak dipasang/didaftarkan)
      loader.dispose(); // muatan yang masih berjalan dibuang saat selesai (tidak dipasang/didaftarkan)
      group.removeFromParent();
      ground.geometry.dispose();
      materials.dispose();
    },
  };
}
