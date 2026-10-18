/**
 * Distrik Kampus UNRI Bina Widya (spec §3, §4.2). M1: terrain saja (chunk heightfield + mesh LOD +
 * lubang tanah dasar kota); M2 menambah tanah & jalan (groundLayer + collider), M3 gedung kit, M7 kehidupan. Koordinat dunia.
 */
import * as THREE from 'three';
import { defineDistrict } from '../District.js';
import { UNRI_BOUNDARY } from './boundary.js';
import { TerrainDataError, validateTerrainHeader } from '../../geo/terrain/heightfield.js';
import { rasterizeRing } from '../../geo/terrain/cellMask.js';
import { parseTileKey } from '../../geo/tiles.js';
import { chunkCellGrid, createTerrainChunks } from '../terrainChunks.js';
import { createTerrainMaterial } from '../../world/terrain/TerrainMesh.js';
import { createUnriGroundLayer } from './groundLayer.js';
import { createUnriCollider } from './collider.js';
import { mountBuildings } from './buildings.js';

export const UNRI_DIR = 'districts/unri/';
export const DISTRICT_FORMAT = 'unri-district';
export const SETTLE = Object.freeze({ radius: 600, timeoutMs: 20000 });

/**
 * Validasi manifest distrik; mengembalikan header terrain beku.
 * @throws {TerrainDataError}
 */
export function validateDistrictManifest(m) {
  if (!m || typeof m !== 'object') throw new TerrainDataError('manifest distrik bukan objek');
  if (m.format !== DISTRICT_FORMAT || m.version !== 1) throw new TerrainDataError(`manifest ${m.format}/${m.version} bukan ${DISTRICT_FORMAT}/1`);
  const t = m.terrain;
  validateTerrainHeader(t);
  if (!Array.isArray(t.chunks) || !t.chunks.every((k) => parseTileKey(k) && `${parseTileKey(k).ix}_${parseTileKey(k).iz}` === k)) {
    throw new TerrainDataError('terrain.chunks harus daftar kunci "ix_iz"');
  }
  if (new Set(t.chunks).size !== t.chunks.length) throw new TerrainDataError('terrain.chunks berisi kunci ganda');
  return Object.freeze({ ...t, chunks: Object.freeze([...t.chunks]) });
}

/** Isi batas kampus di minimap (hijau pucat + garis tepi). */
function drawBoundary(ctx2d, view) {
  ctx2d.save();
  ctx2d.beginPath();
  UNRI_BOUNDARY.forEach(([x, z], i) => {
    const [px, py] = view.toCanvas(x, z);
    if (i === 0) ctx2d.moveTo(px, py);
    else ctx2d.lineTo(px, py);
  });
  ctx2d.closePath();
  ctx2d.fillStyle = 'rgba(132, 176, 96, 0.35)';
  ctx2d.fill();
  ctx2d.strokeStyle = 'rgba(58, 92, 48, 0.85)';
  ctx2d.lineWidth = 2;
  ctx2d.stroke();
  ctx2d.restore();
}

/** Lepas material terrain beserta petanya (ResourceScope hanya melepas material). */
const disposeMaterial = (mat) => {
  for (const key of ['map', 'normalMap', 'roughnessMap']) mat[key]?.dispose();
  mat.dispose();
};

/**
 * ctx (dari app/districtMount.js): { scope, terrain, scheduler, owner, baseUrl, fetchJson, fetchArrayBuffer,
 *   createStreamer, onTerrainFail, groundHoleChanged, logger, registries, isReserved, setTimer?, clearTimer? }
 */
async function buildUnri(ctx) {
  const manifest = await ctx.fetchJson(`${ctx.baseUrl}${UNRI_DIR}manifest.json`); // mentah: M2 membaca manifest.ground
  const header = validateDistrictManifest(manifest);
  const group = new THREE.Group();
  group.name = 'distrik:unri';
  const material = ctx.scope.get('terrain:material', createTerrainMaterial, { dispose: disposeMaterial });
  const cellGrid = chunkCellGrid(header.chunks, header.step);
  const cellMask = rasterizeRing(UNRI_BOUNDARY, cellGrid);
  const hole = new Uint8Array(cellMask.length);
  const collider = createUnriCollider({ terrain: ctx.terrain });
  const ground = createUnriGroundLayer({
    scope: ctx.scope,
    scheduler: ctx.scheduler,
    registries: ctx.registries,
    collider,
    groundKeys: new Set(manifest.ground?.chunks ?? []),
    groundUrl: (key) => `${ctx.baseUrl}${UNRI_DIR}ground/${key}.json`,
    fetchJson: ctx.fetchJson,
    isReserved: ctx.isReserved,
    logger: ctx.logger,
  });
  group.add(ground.group);
  const gedung = await mountBuildings({
    url: `${ctx.baseUrl}${UNRI_DIR}${manifest.buildings ?? 'buildings.json'}`,
    fetchJson: ctx.fetchJson,
    scope: ctx.scope,
    scheduler: ctx.scheduler,
    registries: ctx.registries,
    collider,
    terrain: { heightAt: (x, z) => ctx.terrain.heightAt(x, z), has: (k) => ctx.terrain.field.has(k) },
    terrainChunks: manifest.terrain?.chunks ?? [],
    anisotropy: ctx.renderer?.capabilities?.getMaxAnisotropy?.() ?? 8,
    toast: ctx.toast,
    logger: ctx.logger,
    dev: import.meta.env?.DEV === true,
  });
  if (gedung) group.add(gedung.group);
  const chunks = createTerrainChunks({
    header, baseUrl: `${ctx.baseUrl}${UNRI_DIR}`, field: ctx.terrain.field, parent: group, materials: { terrain: material },
    cellGrid, cellMask, hole, onHoleChange: ctx.groundHoleChanged, scheduler: ctx.scheduler, owner: ctx.owner,
    createStreamer: ctx.createStreamer, fetchArrayBuffer: ctx.fetchArrayBuffer, onFail: ctx.onTerrainFail, logger: ctx.logger,
    onChunkMesh: ground.onChunkMesh, onChunkRelease: ground.onChunkRelease,
  });
  const setTimer = ctx.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = ctx.clearTimer ?? ((h) => clearTimeout(h));
  const waiters = new Set();
  let disposed = false;
  const settle = (w, value) => {
    if (!waiters.delete(w)) return;
    clearTimer(w.timer);
    w.resolve(value);
  };
  const system = {
    id: 'district.unri.terrain',
    phase: 'world',
    update(dt, frame) {
      chunks.update(frame.focus ?? frame.bikePos);
      for (const w of waiters) if (chunks.settled(w.x, w.z, SETTLE.radius)) settle(w, true);
    },
  };
  return {
    group,
    systems: [system, ground.system, ...(gedung ? [gedung.system] : [])],
    colliders: collider,
    minimapLayer(ctx2d, view) {
      drawBoundary(ctx2d, view);
      gedung?.drawMinimap(ctx2d, (x) => view.toCanvas(x, 0)[0], (z) => view.toCanvas(0, z)[1]);
    },
    excludeIds: gedung?.excludeIds ?? new Set(),
    groundHole: { ...cellGrid, data: hole },
    stats: () => chunks.stats(),
    /** Selesai bila chunk terrain dalam SETTLE.radius dari (x, z) tampil/gagal; false bila habis waktu/dilepas. */
    whenSettled(x, z, timeoutMs = SETTLE.timeoutMs) {
      if (disposed) return Promise.resolve(false);
      return new Promise((resolve) => {
        const w = { x, z, resolve, timer: null };
        waiters.add(w);
        w.timer = setTimer(() => { if (waiters.delete(w)) resolve(false); }, timeoutMs);
      }).then((ok) => (ok ? Promise.all([ground.whenIdle(), gedung ? gedung.whenSettled(x, z) : true]).then(() => true) : ok));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const w of [...waiters]) settle(w, false);
      gedung?.dispose(); // sebelum ground (collider & registri emisif masih hidup)
      ground.dispose(); // sebelum terrain: material terrain asli dipulihkan sebelum mesh dilepas
      chunks.dispose();
      group.removeFromParent();
    },
  };
}

export const unriDistrict = defineDistrict({
  id: 'unri',
  boundary: UNRI_BOUNDARY,
  manifestUrl: `${UNRI_DIR}manifest.json`,
  build: buildUnri,
});
