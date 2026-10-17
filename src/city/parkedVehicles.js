/**
 * Kendaraan mangkal (Plan C Task 18b): bus kota di bahu jalan dekat halte OSM nyata dan angkot ngetem di
 * bahu Jl. Naga Sakti dekat gapura stadion. Statis: posisi dihitung sekali dari polyline jalan tile
 * (`computeParkedSlots`, murni), model GLB dimuat sekali per jenis lalu disalin per slot. Lampu emissive
 * didaftarkan ke registry malam, collider = deretan lingkaran di TileCollider kota. Dipasang/dilepas
 * oleh createCity; muatan yang selesai setelah dispose dibuang (tidak dipasang/didaftarkan).
 */
import * as THREE from 'three';
import { WORLD_ORIGIN } from '../config/constants.js';
import { createProjection } from '../geo/projection.js';
import { pointInPolygon } from '../geo/polygon.js';
import { tilesInRect } from '../geo/tiles.js';
import { disposeTree } from '../engine/disposeTree.js';
import { freezeStatic } from '../engine/freezeStatic.js';

export const PARKED_GROUP_NAME = 'kendaraanMangkal';
export const PARKED_COLLIDER_KEY = 'kendaraanMangkal';

/** Jarak tepi badan jalan ke sumbu kendaraan (m): slot = lebarJalan/2 − inset dari sumbu jalan. */
export const SHOULDER_INSET = 1.2;

/**
 * Model GLB (menghadap +Z; rotation.y = yaw) dan ukuran badan (m, bbox GLB: lebar X × panjang Z).
 * Skala 1 seperti entri lama `LAYOUT.blenderModels` region (commit 533415c).
 */
export const VEHICLE_MODELS = Object.freeze({
  angkot: Object.freeze({ path: 'models/kendaraan/angkot.glb', width: 1.96, length: 4.82 }),
  bus: Object.freeze({ path: 'models/kendaraan/bus-kota.glb', width: 2.66, length: 10.53 }),
});

/**
 * Halte OSM node 4561327395 {highway: bus_stop, name: "Halte", bench: yes}: satu-satunya bus_stop
 * dalam 1,5 km dari stadion. Diverifikasi Overpass `node(4561327395);out;` (osm_base 2026-10-17T03:11:05Z).
 */
export const HALTE_NODE = Object.freeze({ id: 4561327395, lat: 0.4905998, lon: 101.3945433, road: 'Jalan SM Amin' });

/**
 * Bus berhenti di belakang halte (searah lajur, m): badannya tidak menembus bangunan OSM kecil di tepi
 * Jl. SM Amin (x 561…564, z −777…−773) dan bagian depannya ±2,7 m sebelum titik halte.
 */
export const BUS_ALONG = -8;

/**
 * Gapura stadion di dunia (SITE.gapuraZ = −436, ujung utara sumbu pedestrian OSM; placement region ≈ identitas).
 * Angkot ngetem di timur bukaan gapura (pilar di x ±8), berjarak 8 m, di bahu jalur selatan Naga Sakti.
 */
export const GAPURA_WORLD = Object.freeze({ x: 0, z: -436 });
export const ANGKOT_XS = Object.freeze([16, 24, 32]);
/** Titik acuan sisi "menghadap stadion": pusat stadion (origin dunia = centroid footprint OSM). */
export const STADION_CENTER = Object.freeze({ x: 0, z: 0 });

/** Bulatkan ke `digits` desimal (nilai bersih untuk log/tes; -0 → 0). */
const round = (v, digits) => Number(v.toFixed(digits)) + 0;

/** Sudut ke (−π, π]. */
const wrapAngle = (a) => {
  const t = Math.atan2(Math.sin(a), Math.cos(a));
  return t === -Math.PI ? Math.PI : t;
};

/**
 * Target penempatan default (koordinat dunia). Urutan = urutan slot (bus dulu, lalu angkot timur gapura).
 * @param {{toWorld(lat:number, lon:number): {x:number, z:number}}} [projection]
 */
export function parkedTargets(projection = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon })) {
  const halte = projection.toWorld(HALTE_NODE.lat, HALTE_NODE.lon);
  return Object.freeze([
    Object.freeze({ model: 'bus', x: halte.x, z: halte.z, road: HALTE_NODE.road, along: BUS_ALONG }),
    ...ANGKOT_XS.map((x) => Object.freeze({
      model: 'angkot', x: GAPURA_WORLD.x + x, z: GAPURA_WORLD.z, road: 'Jalan Naga Sakti', side: STADION_CENTER,
    })),
  ]);
}

/** Titik terdekat pada segmen a→b dan parameter t ∈ [0, 1]. */
function footOnSegment(x, z, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / len2)) : 0;
  const fx = a[0] + dx * t;
  const fz = a[1] + dz * t;
  return { fx, fz, d: Math.hypot(x - fx, z - fz), len: Math.sqrt(len2), dx, dz };
}

/** Segmen terdekat (jalan bernama `name` bila diberikan, lebar > 2 × inset); seri → urutan masukan. */
function nearestShoulderSegment(roads, x, z, name, inset) {
  let best = null;
  for (const road of roads) {
    if (!(road.width > 2 * inset)) continue;
    if (name && road.name !== name) continue;
    for (let i = 0; i + 1 < road.pts.length; i += 1) {
      const f = footOnSegment(x, z, road.pts[i], road.pts[i + 1]);
      if (f.len > 0 && (!best || f.d < best.d)) best = { ...f, road };
    }
  }
  return best;
}

/**
 * Slot parkir di bahu jalan (murni, deterministik): titik target diproyeksikan ke segmen polyline
 * terdekat, digeser `along` m searah polyline, lalu tegak lurus ke bahu sebesar `lebar/2 − inset`
 * di sisi titik `side` (default: titik target). Yaw sejajar segmen, menghadap arah polyline.
 * Target tanpa jalan yang cocok dilewati.
 * @param {ReadonlyArray<{width:number, name?:string|null, pts:ReadonlyArray<readonly [number, number]>}>} roads koordinat dunia
 * @param {ReadonlyArray<{model:string, x:number, z:number, road?:string, side?:{x:number,z:number}, along?:number}>} targets
 * @param {{inset?: number}} [opts]
 * @returns {Array<{model:string, x:number, z:number, yaw:number}>}
 */
export function computeParkedSlots(roads, targets, { inset = SHOULDER_INSET } = {}) {
  const slots = [];
  for (const t of targets) {
    const seg = nearestShoulderSegment(roads, t.x, t.z, t.road ?? null, inset);
    if (!seg) continue;
    const ux = seg.dx / seg.len;
    const uz = seg.dz / seg.len;
    const side = t.side ?? t;
    // Normal kiri/kanan segmen; pilih yang mengarah ke titik `side`.
    const sign = (side.x - seg.fx) * -uz + (side.z - seg.fz) * ux >= 0 ? 1 : -1;
    const offset = seg.road.width / 2 - inset;
    const along = t.along ?? 0;
    slots.push({
      model: t.model,
      x: round(seg.fx + ux * along - uz * offset * sign, 2),
      z: round(seg.fz + uz * along + ux * offset * sign, 2),
      yaw: round(wrapAngle(Math.atan2(ux, uz)), 4),
    });
  }
  return slots;
}

/** Sudut-sudut jejak badan kendaraan (ring dunia, 4 titik) untuk slot {x, z, yaw}. */
export function vehicleFootprint(slot, { width, length }) {
  const fx = Math.sin(slot.yaw);
  const fz = Math.cos(slot.yaw);
  const hl = length / 2;
  const hw = width / 2;
  return [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].map(([a, b]) => [slot.x + fx * a + fz * b, slot.z + fz * a - fx * b]);
}

/**
 * Collider sederhana: deretan lingkaran (r = setengah lebar) di sepanjang sumbu badan, ujung pertama/terakhir
 * menyinggung moncong/buritan. Jumlah = ceil(panjang/lebar) + 1 agar celah antar-lingkaran kecil.
 */
export function vehicleCircles(slot, { width, length }) {
  const r = width / 2;
  const n = Math.max(1, Math.ceil(length / width) + 1);
  const span = Math.max(0, length / 2 - r);
  const fx = Math.sin(slot.yaw);
  const fz = Math.cos(slot.yaw);
  return Array.from({ length: n }, (_, i) => {
    const s = n === 1 ? 0 : -span + (2 * span * i) / (n - 1);
    return { x: slot.x + fx * s, z: slot.z + fz * s, r };
  });
}

/** Jejak kendaraan bebas bangunan (titik bangunan di jejak / sudut jejak di bangunan = tabrakan). */
export function clearOfBuildings(slot, dims, buildings) {
  const corners = vehicleFootprint(slot, dims);
  return buildings.every((b) => !pointInPolygon(slot.x, slot.z, b.ring)
    && corners.every(([x, z]) => !pointInPolygon(x, z, b.ring))
    && b.ring.every(([x, z]) => !pointInPolygon(x, z, corners)));
}

/** Kunci tile yang beririsan persegi ±margin di sekitar setiap target (urut, unik). */
export function tilesForTargets(targets, margin = 30) {
  const keys = new Set();
  for (const t of targets) {
    for (const tile of tilesInRect({ minX: t.x - margin, minZ: t.z - margin, maxX: t.x + margin, maxZ: t.z + margin })) keys.add(tile.key);
  }
  return [...keys].sort();
}

/**
 * Data tile terdekode untuk kunci yang ada di manifest, lewat jalur muat TileLoader (cache bila tile sudah
 * dimuat streamer, selain itu unduh + retry + validasi); tile gagal dicatat dan dilewati.
 */
async function loadTiles(keys, { manifest, loadTileData, logger }) {
  const known = new Set(manifest.tiles.map((t) => t.key));
  const wanted = keys.filter((k) => known.has(k));
  const results = await Promise.allSettled(wanted.map((key) => loadTileData(key)));
  return results.flatMap((r, i) => {
    if (r.status === 'fulfilled') return [r.value];
    logger.error(`Kendaraan mangkal: data tile ${wanted[i]} gagal dimuat:`, r.reason);
    return [];
  });
}

/** Bayangan untuk mesh model (seperti world/assets/models.js; city/ tidak mengimpor world/). */
function prepareModel(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return root;
}

/** Muat tiap jenis model sekali; hasil: Map model → root sumber, dan daftar gagal. */
async function loadModels(models, { baseUrl, loadGltf }) {
  const results = await Promise.allSettled(models.map((m) => loadGltf(`${baseUrl}${VEHICLE_MODELS[m].path}`)));
  const sources = new Map();
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') sources.set(models[i], prepareModel(r.value.scene));
    else failed.push({ model: models[i], error: String(r.reason?.message ?? r.reason) });
  });
  return { sources, failed };
}

/**
 * @param {{parent: THREE.Object3D, manifest: {tiles: Array<{key:string}>}, baseUrl?: string,
 *   loadTileData: (key:string) => Promise<ReturnType<typeof import('./tileData.js').decodeTileData>>, loadGltf: (url:string) => Promise<{scene: THREE.Object3D}>,
 *   collider?: {addObstacles(key:string, circles:object[]):void, removeObstacles(key:string):boolean}|null,
 *   time?: {registerEmissive(root: THREE.Object3D): () => boolean}|null,
 *   targets?: ReturnType<typeof parkedTargets>, logger?: {error: (...a: unknown[]) => void}}} opts
 * @returns {{group: THREE.Group, ready: Promise<{placed:number, failed:Array<{model:string,error:string}>,
 *   slots:Array<{model:string,x:number,z:number,yaw:number}>, cancelled:boolean}>, dispose(): void}}
 */
export function mountParkedVehicles({
  parent, manifest, baseUrl = '/', loadTileData, loadGltf, collider = null, time = null, targets = parkedTargets(), logger = console,
}) {
  const group = new THREE.Group();
  group.name = PARKED_GROUP_NAME;
  parent.add(group);
  let disposed = false;
  const undo = []; // LIFO

  const place = async () => {
    const tiles = await loadTiles(tilesForTargets(targets), { manifest, loadTileData, logger });
    if (disposed) return { placed: 0, failed: [], slots: [], cancelled: true };
    const buildings = tiles.flatMap((t) => t.buildings);
    const slots = computeParkedSlots(tiles.flatMap((t) => t.roads), targets).filter((s) => {
      const ok = clearOfBuildings(s, VEHICLE_MODELS[s.model], buildings);
      if (!ok) logger.error(`Kendaraan mangkal: slot ${s.model} (${s.x}, ${s.z}) menembus bangunan; dilewati`);
      return ok;
    });
    const { sources, failed } = await loadModels([...new Set(slots.map((s) => s.model))], { baseUrl, loadGltf });
    if (disposed) {
      for (const root of sources.values()) disposeTree(root); // dibongkar sementara dimuat: buang
      return { placed: 0, failed: [], slots, cancelled: true };
    }
    const placedSlots = slots.filter((s) => sources.has(s.model));
    for (const s of placedSlots) {
      const obj = sources.get(s.model).clone(true); // geometri & material dibagi antar-salinan
      obj.name = `kendaraan:${s.model}`;
      obj.position.set(s.x, 0, s.z);
      obj.rotation.y = s.yaw;
      group.add(obj);
    }
    freezeStatic(group);
    if (collider) {
      collider.addObstacles(PARKED_COLLIDER_KEY, placedSlots.flatMap((s) => vehicleCircles(s, VEHICLE_MODELS[s.model])));
      undo.push(() => collider.removeObstacles(PARKED_COLLIDER_KEY));
    }
    if (time) undo.push(time.registerEmissive(group));
    for (const f of failed) logger.error(`Kendaraan mangkal: model ${f.model} gagal dimuat:`, f.error);
    return { placed: placedSlots.length, failed, slots, cancelled: false };
  };

  const ready = place().catch((err) => {
    logger.error('Kendaraan mangkal gagal dipasang:', err);
    return { placed: 0, failed: [{ model: '*', error: String(err?.message ?? err) }], slots: [], cancelled: disposed };
  });

  return {
    group,
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      while (undo.length) undo.pop()();
      group.removeFromParent();
      disposeTree(group);
    },
  };
}
