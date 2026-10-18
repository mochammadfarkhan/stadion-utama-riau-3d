/**
 * Motor parkir kampus (spec §8.4, katalog A01–A04): slot rapat di setiap area `amenity=parking` dari data ground M2
 * (kecuali area di dalam mask region hero — region punya isinya sendiri), dirender `BatchedMesh` per material per
 * area (1 draw call/material/area), warna bodi per instans. Isi mengikuti jam game (`motorFill`): parkir IC
 * (centroid ≤ IC_RADIUS dari Integrated Classroom) penuh siang hari. Area yang muncul di beberapa chunk ground
 * dihitung referensinya per kunci area. Tanpa collider (D8). GLB gagal → placeholder (spec §10).
 * LOD per instans: setiap area punya tiga set BatchedMesh (model detail `hi`, `lo` ±1k, `far` ±150 segitiga); jatah instans per
 * tier berlaku se-distrik (`assignMotorTiers`: terdekat dulu, MOTOR_BUDGET) → beban segitiga terkunci. Area dibangun hanya di
 * dekat kamera (BUILD_RADIUS) dan dihitung ulang tiap REFILL_SEC.
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { loadModel } from '../../world/assets/models.js';
import {
  MOTOR_VARIANTS, MOTOR_BODY_MATERIAL, MOTOR_BODY_COLORS, motorPlaceholderSources,
} from '../../world/props/unri/motorVariants.js';
import { parkingSlots, visibleOrder, assignVariants, seedOf, assignMotorTiers } from '../../sim/parkingSlots.js';
import { motorFill, toPoints } from '../../sim/campusLife.js';
import { polygonCentroid } from '../../geo/polygon.js';

/** Centroid Integrated Classroom way/1313268659 (OSM, dunia) dan radius parkir yang dianggap parkir IC [INFERENSI]. */
export const IC_CENTER = Object.freeze({ x: -1091.0, z: 906.0 });
export const IC_RADIUS = 160;
/** Mitigasi spec §9.3 langkah 2: turunkan (mis. 0.6) bila budget draw call/segitiga terlampaui. */
export const MOTOR_DENSITY_SCALE = 1;
const REFILL_SEC = 0.5;
/** Area dibangun saat pusatnya ≤ BUILD_RADIUS dari kamera dan dilepas > DROP_RADIUS (histeresis); BatchedMesh mahal di CPU. */
const BUILD_RADIUS = 300;
const DROP_RADIUS = 380;
const TIER_NAMES = Object.freeze(['hi', 'lo', 'far']);

/** Salinan geometri untuk BatchedMesh: hanya position + normal, berindeks, transform (opsional) dibakar. */
export function normalizeGeometry(src, matrix = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', src.getAttribute('position').clone());
  const count = g.getAttribute('position').count;
  g.setIndex(src.index ? src.index.clone() : Array.from({ length: count }, (_, i) => i));
  if (src.getAttribute('normal')) g.setAttribute('normal', src.getAttribute('normal').clone());
  else g.computeVertexNormals();
  if (matrix) g.applyMatrix4(matrix);
  return g;
}

/** Area parkir (ring luar) dari satu chunk ground M2, dengan kunci dedupe dan jenis 'ic' | 'kampus'. */
export function parkingAreas(ground, scale = 1) {
  return (ground?.areas ?? [])
    .filter((a) => a.kind === 'parking' && Array.isArray(a.rings) && a.rings.length)
    .map((a) => toPoints(a.rings[0], scale))
    .filter((ring) => ring.length >= 3)
    .map((ring) => {
      const center = polygonCentroid(ring);
      const kind = Math.hypot(center.x - IC_CENTER.x, center.z - IC_CENTER.z) <= IC_RADIUS ? 'ic' : 'kampus';
      return Object.freeze({ key: `${Math.round(center.x)}_${Math.round(center.z)}_${ring.length}`, ring, center, kind });
    });
}

/** Bagian per material dari GLB (geometri ternormalisasi), atau null bila gagal/tanpa mesh bermaterial. */
async function loadParts(scope, path, label, logger) {
  try {
    const root = await withScope(scope, () => loadModel(path));
    root.updateMatrixWorld(true);
    const parts = [];
    root.traverse((o) => {
      if (o.isMesh && o.material?.name) parts.push({ name: o.material.name, geometry: normalizeGeometry(o.geometry, o.matrixWorld), material: o.material });
    });
    if (parts.length) return parts;
    logger.warn(`Motor ${label}: GLB tanpa mesh bermaterial, memakai placeholder`);
  } catch (err) {
    logger.warn(`Motor ${label}: GLB gagal dimuat, memakai placeholder:`, err);
  }
  return null;
}

/** Sumber per varian: { hi, lo, far } masing-masing [{name, geometry (ternormalisasi), material}]; placeholder bila GLB tak ada. */
async function loadVariantSources(scope, logger) {
  const entries = await Promise.all(Object.values(MOTOR_VARIANTS).map(async (v) => {
    const hi = v.path ? await loadParts(scope, v.path, v.id, logger) : null;
    const lo = hi && v.pathLod ? await loadParts(scope, v.pathLod, `${v.id}-lod`, logger) : null;
    const far = hi && v.pathFar ? await loadParts(scope, v.pathFar, `${v.id}-far`, logger) : null;
    if (hi) return [v.id, { hi, lo: lo ?? hi, far: far ?? lo ?? hi }];
    const parts = withScope(scope, () => motorPlaceholderSources(v)).map((p) => ({ ...p, geometry: normalizeGeometry(p.geometry) }));
    return [v.id, { hi: parts, lo: parts, far: parts }];
  }));
  return new Map(entries);
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

/** Satu set BatchedMesh per material untuk satu tier LOD; tiap slot punya instans (disembunyikan sampai dipilih tier). */
function buildTier(tier, slots, variants, sources, terrain, seed, group) {
  const used = new Set(variants);
  const byMaterial = new Map();
  for (const [vid, parts] of sources) {
    for (const part of parts[tier]) {
      const entry = byMaterial.get(part.name) ?? { material: part.material, geoms: new Map() };
      entry.geoms.set(vid, part.geometry);
      byMaterial.set(part.name, entry);
    }
  }
  const meshes = [];
  for (const [name, entry] of byMaterial) {
    const geoms = [...entry.geoms].filter(([vid]) => used.has(vid));
    if (!geoms.length) continue;
    const vertexCount = geoms.reduce((n, [, g]) => n + g.getAttribute('position').count, 0);
    const indexCount = geoms.reduce((n, [, g]) => n + g.index.count, 0);
    const batch = new THREE.BatchedMesh(slots.length, vertexCount, indexCount, entry.material);
    batch.name = `motor:${tier}:${name}`;
    batch.castShadow = tier === 'hi';
    batch.sortObjects = false; // buram: urutan depan-belakang tak perlu (hemat CPU per frame)
    batch.receiveShadow = true;
    const geomIds = new Map(geoms.map(([vid, g]) => [vid, batch.addGeometry(g)]));
    const ids = slots.map((slot, i) => {
      const gid = geomIds.get(variants[i]);
      if (gid === undefined) return -1;
      const id = batch.addInstance(gid);
      _p.set(slot.x, terrain.heightAt(slot.x, slot.z), slot.z);
      _q.setFromAxisAngle(_up, slot.rotY);
      batch.setMatrixAt(id, _m.compose(_p, _q, _one));
      if (name === MOTOR_BODY_MATERIAL) batch.setColorAt(id, _c.setHex(MOTOR_BODY_COLORS[(seed + i * 7) % MOTOR_BODY_COLORS.length]));
      batch.setVisibleAt(id, false);
      return id;
    });
    group.add(batch);
    meshes.push({ batch, ids });
  }
  return meshes;
}

/** Kerangka area (slot, varian, grup); set BatchedMesh per tier dibangun bertahap oleh `buildTier` di scheduler. */
function prepareArea(area) {
  const slots = parkingSlots(area.ring);
  if (!slots.length) return null;
  const seed = seedOf(area.center.x, area.center.z);
  const group = new THREE.Group();
  group.name = `parkirMotor:${area.key}`;
  return {
    group, tiers: {}, slots, seed, variants: assignVariants(slots.length, seed),
    order: visibleOrder(slots.length, seed ^ 0x9e3779b9), count: slots.length, shown: -1,
    state: new Uint8Array(slots.length), // tier aktif per slot: 0 tersembunyi, 1 hi, 2 lo, 3 far
  };
}

/** Jadikan `want` (Uint8Array tier per slot) tampilan nyata: hanya memanggil setVisibleAt pada slot yang berubah. */
function applyTiers(built, want) {
  const { state, tiers } = built;
  for (let i = 0; i < built.count; i += 1) {
    if (want[i] === state[i]) continue;
    state[i] = want[i];
    TIER_NAMES.forEach((name, k) => {
      for (const { batch, ids } of tiers[name]) if (ids[i] >= 0) batch.setVisibleAt(ids[i], want[i] === k + 1);
    });
  }
}

/**
 * @param {{scope:object, terrain:{heightAt(x:number,z:number):number}, scheduler:{schedule:Function},
 *   hour:() => number, camera?:{position:{x:number,z:number}}, excludeAt?:(x:number, z:number) => boolean, groundScale?:number,
 *   logger?:object}} opts
 */
export function createMotorParking({ scope, terrain, scheduler, hour, camera = null, excludeAt = () => false, groundScale = 1, logger = console }) {
  const group = new THREE.Group();
  group.name = 'parkirMotor';
  const areas = new Map(); // areaKey -> { area, chunks:Set, built, task }
  let sources = null;
  let disposed = false;
  let refill = 0;
  const fillFor = (kind) => motorFill(hour(), kind) * MOTOR_DENSITY_SCALE;
  const distTo = (area, cam) => (cam ? Math.hypot(area.center.x - cam.x, area.center.z - cam.z) : 0);

  /** Bangun area (berjenjang per tier agar tiap potongan kerja kecil) hanya bila fokus cukup dekat. */
  function scheduleBuild(entry) {
    if (!sources || entry.built || entry.task || disposed) return;
    entry.task = scheduler.schedule(function* buildAreaSteps() {
      yield;
      if (disposed || areas.get(entry.area.key) !== entry) return;
      const built = prepareArea(entry.area);
      if (!built) {
        entry.task = null;
        return;
      }
      for (const name of TIER_NAMES) {
        built.tiers[name] = withScope(scope, () => buildTier(name, built.slots, built.variants, sources, terrain, built.seed, built.group));
        yield;
        if (disposed || areas.get(entry.area.key) !== entry) return;
      }
      entry.task = null;
      entry.built = built;
      group.add(built.group);
      refresh();
    }, { owner: 'unri:motor' });
  }

  function drop(entry) {
    entry.task?.cancel();
    entry.task = null;
    if (!entry.built) return;
    entry.built.group.removeFromParent();
    for (const tier of Object.values(entry.built.tiers)) tier.forEach(({ batch }) => batch.dispose());
    entry.built = null;
  }

  /** Bangun/lepas area menurut jarak, lalu bagi jatah tier se-distrik ke semua slot terisi. */
  function refresh() {
    const cam = camera?.position ?? null;
    for (const entry of areas.values()) {
      const d = distTo(entry.area, cam);
      if (!entry.built && d <= BUILD_RADIUS) scheduleBuild(entry);
      else if (entry.built && d > DROP_RADIUS) drop(entry);
    }
    const built = [...areas.values()].filter((e) => e.built);
    const candidates = []; // d² per slot terisi, area demi area
    const offsets = [];
    for (const e of built) {
      const b = e.built;
      const n = Math.round(b.count * Math.min(1, Math.max(0, fillFor(e.area.kind))));
      b.shown = n;
      const on = new Uint8Array(b.count);
      for (let k = 0; k < n; k += 1) on[b.order[k]] = 1;
      offsets.push(candidates.length);
      for (let i = 0; i < b.count; i += 1) {
        if (!on[i]) candidates.push(Number.POSITIVE_INFINITY);
        else if (!cam) candidates.push(0);
        else candidates.push((b.slots[i].x - cam.x) ** 2 + (b.slots[i].z - cam.z) ** 2);
      }
    }
    const tiers = assignMotorTiers(candidates);
    built.forEach((e, k) => applyTiers(e.built, tiers.subarray(offsets[k], offsets[k] + e.built.count)));
  }

  const sourcesReady = loadVariantSources(scope, logger)
    .then((s) => {
      if (disposed) return;
      sources = s;
      refresh();
    })
    .catch((err) => logger.error('Motor parkir: sumber model gagal disiapkan:', err));

  return {
    group,
    sourcesReady,
    get stats() {
      let built = 0;
      let instances = 0;
      let shown = 0;
      const tier = [0, 0, 0, 0];
      for (const e of areas.values()) {
        if (!e.built) continue;
        built += 1;
        instances += e.built.count;
        shown += Math.max(0, e.built.shown);
        for (const v of e.built.state) tier[v] += 1;
      }
      return { areas: areas.size, built, instances, shown, hi: tier[1], lo: tier[2], far: tier[3], sources: sources ? [...sources.keys()] : [] };
    },
    addGroundChunk(chunkKey, data) {
      for (const area of parkingAreas(data, groundScale)) {
        if (excludeAt(area.center.x, area.center.z)) continue;
        const entry = areas.get(area.key) ?? { area, chunks: new Set(), built: null, task: null };
        entry.chunks.add(chunkKey);
        areas.set(area.key, entry);
      }
      refresh();
    },
    removeGroundChunk(chunkKey) {
      for (const [key, entry] of [...areas]) {
        if (!entry.chunks.delete(chunkKey) || entry.chunks.size) continue;
        drop(entry);
        areas.delete(key);
      }
    },
    update(dt) {
      refill -= dt;
      if (refill > 0) return;
      refill = REFILL_SEC;
      refresh();
    },
    dispose() {
      disposed = true;
      for (const entry of areas.values()) drop(entry);
      areas.clear();
      group.removeFromParent();
    },
  };
}
