/**
 * Vegetasi sekitar gedung UKM blok biru bergaya foto Street View: pohon peneduh tinggi ramping berbatang lurus (V11/V13)
 * berbaris longgar di tepi Jl. Prof. Aras Mulyadi dengan pohon kecil bercabang (V12) di antaranya, hutan rapat di timur,
 * pohon kecil + semak (V14) di selatan, sedikit V12 di sekitar lapangan (palem tetap dari kompleks). Murni parameter: zona
 * tanam (kotak dunia, kerapatan, bauran) dikurangi zona kosong (gedung, halaman, kompleks, lapangan memanah, jalan) lewat
 * generator `jitteredGrid`/`polylineSteps`. Pohon sendiri dirakit di ukmTrees.js (GLB + LOD); modul ini memegang titik
 * tanam, lantai hutan/gundukan/sampah (ukmGroundDetail.js), dan kit pohon lama sebagai cadangan bila GLB gagal.
 * Distrik tidak menanam di dalam mask region (isReserved), jadi area itu ditanami ulang oleh region.
 */
import { jitteredGrid, polylineOffset, polylineSteps } from './generators.js';
import { pointInPolygon, distanceToSegment } from '../../geo/polygon.js';
import { toRegion } from './placement.js';
import { UKM_ROOF, ukmToWorld, COMPLEX_BOX } from './sekreUkm.data.js';
import { UKM_ROADS } from './ukmRoads.data.js';
import { vegetationInstances, buildVegetationCells, createVegetationKit } from '../../world/vegetation/campusVegetation.js';
import { litterFloorMesh, detailMesh, moundPoints, trashPoints } from './ukmGroundDetail.js';
import { staged } from './staged.js';

export { UKM_ROADS };
export { UKM_LITTER_BOXES } from './ukmGroundDetail.js';

const ROAD_CLEAR = 4.5;

/** Zona kosong (kotak dunia): halaman beton, kompleks lapangan, hamparan rumput + gubuk panahan. */
export const UKM_CLEAR_BOXES = Object.freeze([
  Object.freeze({ minX: -124, maxX: -91, minZ: 994, maxZ: 1021 }),
  Object.freeze({ minX: COMPLEX_BOX.minX - 2, maxX: COMPLEX_BOX.maxX + 2, minZ: COMPLEX_BOX.minZ - 3, maxZ: COMPLEX_BOX.maxZ + 6 }),
  Object.freeze({ minX: -122, maxX: -66, minZ: 962, maxZ: 998 }),
]);

const roofWorld = UKM_ROOF.map(([x, z]) => {
  const w = ukmToWorld(x, z);
  return [w.x, w.z];
});
const ROOF_CLEAR = 3.5;

const inBox = (b, x, z) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

/** true bila (x, z) dunia boleh ditanami; `roadClear` = jarak minimum ke sumbu jalan (m). */
export function plantable(x, z, roadClear = ROAD_CLEAR) {
  if (UKM_CLEAR_BOXES.some((b) => inBox(b, x, z))) return false;
  if (pointInPolygon(x, z, roofWorld)) return false;
  for (let i = 0; i < roofWorld.length; i += 1) {
    if (distanceToSegment(x, z, roofWorld[i], roofWorld[(i + 1) % roofWorld.length]) < ROOF_CLEAR) return false;
  }
  for (const road of UKM_ROADS) {
    for (let i = 0; i < road.length - 1; i += 1) if (distanceToSegment(x, z, road[i], road[i + 1]) < roadClear) return false;
  }
  return true;
}

/**
 * Zona tanam: kotak dunia, jarak kisi, peluang tumbuh, bauran spesies (bobot; V11 ramping, V12 kecil bercabang,
 * V13 lurus tajuk atas, V14 semak), seed.
 */
export const UKM_ZONES = Object.freeze([
  { id: 'barat-jalan', box: { minX: -136, maxX: -122, minZ: 976, maxZ: 1050 }, spacing: 6, fill: 0.85, clear: 6.5, mix: { v12: 0.5, v11: 0.28, v13: 0.22 }, seed: 11 },
  { id: 'barat-kompleks', box: { minX: -136, maxX: -124, minZ: 900, maxZ: 976 }, spacing: 7, fill: 0.8, mix: { v13: 0.4, v11: 0.3, v12: 0.3 }, seed: 12 },
  { id: 'timur-hutan', box: { minX: -92, maxX: -50.5, minZ: 960, maxZ: 1036 }, spacing: 4.6, fill: 0.92, mix: { v13: 0.34, v11: 0.3, v12: 0.36 }, seed: 13 },
  { id: 'selatan-gedung', box: { minX: -124, maxX: -91, minZ: 1031, maxZ: 1037 }, spacing: 5, fill: 0.9, mix: { v12: 0.55, v14: 0.45 }, seed: 14 },
  { id: 'timur-kompleks', box: { minX: -49.2, maxX: -48, minZ: 905, maxZ: 957 }, spacing: 5.5, fill: 0.85, mix: { v11: 0.55, v13: 0.45 }, seed: 15 },
  { id: 'semak-hutan', box: { minX: -92, maxX: -50.5, minZ: 960, maxZ: 1036 }, spacing: 3.2, fill: 0.55, mix: { v14: 1 }, seed: 16 },
  { id: 'semak-barat', box: { minX: -136, maxX: -122, minZ: 976, maxZ: 1050 }, spacing: 4.2, fill: 0.22, clear: 6.5, mix: { v14: 1 }, seed: 17 },
  { id: 'sekitar-lapangan', box: { minX: -126, maxX: -46, minZ: 901, maxZ: 910 }, spacing: 13, fill: 0.5, mix: { v12: 1 }, seed: 18 },
].map((z) => Object.freeze({ ...z, box: Object.freeze(z.box), mix: Object.freeze(z.mix) })));

/** Barisan pohon peneduh tinggi di tepi jalan (berbaris longgar): sisi (+ timur, − barat) via offset dari sumbu, jarak, selang-seling spesies. */
export const UKM_TREE_ROWS = Object.freeze([
  Object.freeze({ offset: 7.5, step: 8.5, start: 3, jitter: 1.6, species: Object.freeze(['v11', 'v13', 'v13', 'v11']) }),
  Object.freeze({ offset: -8, step: 14, start: 9, jitter: 2.2, species: Object.freeze(['v13', 'v11', 'v12']) }),
]);

function pickSpecies(mix, r) {
  let acc = 0;
  for (const [sp, w] of Object.entries(mix)) {
    acc += w;
    if (r < acc) return sp;
  }
  return Object.keys(mix)[0];
}

/** Titik barisan peneduh sepanjang Jl. Prof. Aras Mulyadi (dunia → [{sp, x, z}] dunia), hanya yang boleh ditanami. */
export function treeRowPoints(rows = UKM_TREE_ROWS) {
  const road = UKM_ROADS[0];
  return rows.flatMap((row) => polylineSteps(polylineOffset(road, row.offset), row.step, { start: row.start }).map((s, i) => {
    const j = ((i * 0.6180339887) % 1) * 2 - 1;
    return { sp: row.species[i % row.species.length], x: s.x - s.tz * j * row.jitter, z: s.z + s.tx * j * row.jitter };
  })).filter((p) => plantable(p.x, p.z, 5));
}

/** Titik tanam region-lokal [{sp, x, z}] (deterministik). */
export function ukmPlantPoints(zones = UKM_ZONES) {
  const world = [];
  for (const z of zones) {
    const pts = jitteredGrid({
      box: z.box, spacing: z.spacing, seed: z.seed,
      accept: (x, zz, rnd) => plantable(x, zz, z.clear) && rnd.chance(z.fill),
    });
    pts.forEach(([x, zz], i) => world.push({ sp: pickSpecies(z.mix, ((i * 0.6180339887) % 1)), x, z: zz }));
  }
  world.push(...treeRowPoints());
  return world.map((p) => {
    const [lx, lz] = toRegion(p.x, p.z);
    return { sp: p.sp, x: lx, z: lz };
  });
}

/** Pemetaan spesies GLB → spesies kit lama (cadangan bila GLB gagal dimuat). */
const FALLBACK_SPECIES = Object.freeze({ v11: 'hutan', v12: 'angsana', v13: 'mahoni', v14: 'semak' });

/** Kit pohon lama (gumpalan) per sel 200 m sebagai cadangan; panggil di dalam withScope(scope region). */
export function fallbackTreeCells(points, heightAt) {
  const kit = createVegetationKit();
  const mapped = points.map((p) => ({ ...p, sp: FALLBACK_SPECIES[p.sp] ?? p.sp }));
  return buildVegetationCells(vegetationInstances(mapped, heightAt), kit).map((c) => c.group);
}

/** Builder bertahap: lantai hutan bertambal, gundukan, sampah (pohon dipasang terpisah oleh ukmTrees). `heightAt` region-lokal. */
export function createUkmVegetationBuilder({ heightAt }) {
  return staged('ukm-vegetasi', [
    () => litterFloorMesh(heightAt),
    () => detailMesh(moundPoints(plantable), trashPoints(plantable), heightAt),
  ], null, { merge: false });
}
