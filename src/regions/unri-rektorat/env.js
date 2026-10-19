// src/regions/unri-rektorat/env.js
/**
 * Lingkungan situs region: medan (ctx.heightAtLocal / ctx.terrain; cadangan datar), menunggu chunk terrain
 * mask termuat sebelum merakit, helper drape lokal (drape.js bekerja di koordinat DUNIA → hasil
 * ditranslasi ke lokal; yaw 0), dan kerbWall (dinding tegak kerb/sisi trotoar di sisi polyline).
 */
import * as THREE from 'three';
import { drapePolygon, drapePolyline } from '../../world/terrain/drape.js';
import { tilesInRect } from '../../geo/tiles.js';
import { ringBounds } from '../../geo/polygon.js';
import { REKTORAT_PLACEMENT as P } from './placement.js';
import { rektoratMaskWorld } from './mask.js';

/** Medan datar (tes / tanpa distrik): kontrak HeightField minimal. */
export const FLAT_FIELD = Object.freeze({
  heightAt: () => 0,
  normalAt: (_x, _z, out = { x: 0, y: 1, z: 0 }) => out,
  gradeAlong: () => 0,
  version: 0,
});

/** Kunci chunk terrain (grid 500 m = TILE_SIZE) yang menutup mask region: ['-3_1', '-2_1']. */
export const TERRAIN_KEYS = Object.freeze(tilesInRect(ringBounds(rektoratMaskWorld())).map((t) => t.key));

/**
 * @param {{terrain?: object, heightAtLocal?: (lx:number, lz:number) => number}} [ctx]
 * @returns {{field: object, hAt(lx:number, lz:number): number}}
 */
export function createSiteEnv(ctx = {}) {
  const field = ctx.terrain ?? FLAT_FIELD;
  const hAt = typeof ctx.heightAtLocal === 'function'
    ? (lx, lz) => ctx.heightAtLocal(lx, lz)
    : (lx, lz) => field.heightAt(lx + P.x, lz + P.z);
  return Object.freeze({ field, hAt });
}

/**
 * Tunggu semua chunk `keys` ada di HeightField (field.has). Field tanpa `has` (datar/tes) → langsung true.
 * Batas waktu → false + satu peringatan (dirakit di atas tinggi yang ada; spec §10: chunk gagal = datar).
 */
export function waitForTerrain(env, { keys = TERRAIN_KEYS, timeoutMs = 15000, intervalMs = 100, logger = console } = {}) {
  const field = env.field;
  if (typeof field.has !== 'function') return Promise.resolve(true);
  const ready = () => keys.every((k) => field.has(k));
  if (ready()) return Promise.resolve(true);
  const t0 = Date.now();
  return new Promise((resolve) => {
    const poll = () => {
      if (ready()) {
        resolve(true);
        return;
      }
      if (Date.now() - t0 >= timeoutMs) {
        logger.warn(`Region unri-rektorat: chunk terrain ${keys.join(', ')} belum termuat setelah ${timeoutMs} ms; dirakit dengan tinggi yang ada`);
        resolve(false);
        return;
      }
      setTimeout(poll, intervalMs);
    };
    setTimeout(poll, intervalMs);
  });
}

const toLocalGeometry = (g) => g.translate(-P.x, 0, -P.z);
const toWorldPts = (pts) => pts.map(([x, z]) => [x + P.x, z + P.z]);

/** drapePolygon (M2) untuk ring lokal → geometri lokal (UV tetap dunia). */
export const drapePolygonLocal = (env, ringLocal, opts) => toLocalGeometry(drapePolygon([toWorldPts(ringLocal)], env.field, opts));

/** drapePolyline (M2) untuk polyline lokal → geometri lokal. */
export const drapePolylineLocal = (env, ptsLocal, width, opts) => toLocalGeometry(drapePolyline(toWorldPts(ptsLocal), width, env.field, opts));

/**
 * Dinding tegak sejajar polyline lokal `pts` pada offset kiri `offset` m (negatif = kanan), dari
 * tanah − 0,05 sampai tanah + height; sampel tiap ≤ `step` m. BufferGeometry ber-index (position/normal/uv).
 */
export function kerbWall(env, pts, offset, height, step = 2) {
  const pos = [];
  const uv = [];
  const idx = [];
  let base = 0;
  let along = 0;
  for (let s = 0; s < pts.length - 1; s += 1) {
    const [ax, az] = pts[s];
    const [bx, bz] = pts[s + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const x = ax + (bx - ax) * t + nx * offset;
      const z = az + (bz - az) * t + nz * offset;
      const y = env.hAt(x, z);
      pos.push(x, y - 0.05, z, x, y + height, z);
      uv.push(along + len * t, 0, along + len * t, height + 0.05);
    }
    for (let i = 0; i < n; i += 1) {
      const k = base + i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
    base += (n + 1) * 2;
    along += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
