/**
 * Vegetasi sekitar gedung UKM blok biru bergaya foto Street View: pohon rimbun (mahoni/angsana, tajuk lebar) di barat
 * (tepi Jl. Prof. Aras Mulyadi) dan hutan lebat di timur/selatan gedung. Murni parameter: zona tanam (kotak dunia,
 * kerapatan) dikurangi zona kosong (gedung, halaman, kompleks lapangan, lapangan memanah, jalan) lewat generator
 * `jitteredGrid`; instans dari kit vegetasi distrik (sel 200 m). Distrik tidak menanam di dalam mask region (isReserved),
 * jadi di sini area itu ditanami ulang oleh region.
 */
import { jitteredGrid } from './generators.js';
import { pointInPolygon, distanceToSegment } from '../../geo/polygon.js';
import { toRegion } from './placement.js';
import { UKM_ROOF, ukmToWorld, COMPLEX_BOX } from './sekreUkm.data.js';
import { vegetationInstances, buildVegetationCells, createVegetationKit } from '../../world/vegetation/campusVegetation.js';
import { staged } from './staged.js';
import * as THREE from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { hasDocument } from '../../world/props/canvasText.js';
import { createRandom } from '../../world/siteutil/rng.js';
import { mergeAll } from '../../world/siteutil/rounded.js';
import { drapePolygon } from '../../world/terrain/drape.js';
import { LEMBAGA_PLACEMENT } from './placement.js';

/** Jalan servis OSM di sekitar (dunia): Jl. Prof. Aras Mulyadi dan akses ke halaman/gubuk (lebar 4,5 m). */
export const UKM_ROADS = Object.freeze([
  [[-139.1, 959.1], [-138, 998.3], [-141.5, 1013.4], [-146.2, 1028.6], [-152.6, 1039.3], [-164.3, 1053.6]],
  [[-139.1, 959.1], [-123.4, 958.4], [-118.3, 963], [-115.6, 998.1], [-112.5, 1002.4], [-96.9, 1001.7]],
].map((r) => Object.freeze(r.map((p) => Object.freeze(p)))));
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

/** true bila (x, z) dunia boleh ditanami. */
export function plantable(x, z) {
  if (UKM_CLEAR_BOXES.some((b) => inBox(b, x, z))) return false;
  if (pointInPolygon(x, z, roofWorld)) return false;
  for (let i = 0; i < roofWorld.length; i += 1) {
    if (distanceToSegment(x, z, roofWorld[i], roofWorld[(i + 1) % roofWorld.length]) < ROOF_CLEAR) return false;
  }
  for (const road of UKM_ROADS) {
    for (let i = 0; i < road.length - 1; i += 1) if (distanceToSegment(x, z, road[i], road[i + 1]) < ROAD_CLEAR) return false;
  }
  return true;
}

/** Zona tanam: kotak dunia, jarak kisi, peluang tumbuh, bauran spesies (bobot), seed. */
export const UKM_ZONES = Object.freeze([
  { id: 'barat-jalan', box: { minX: -136, maxX: -122, minZ: 976, maxZ: 1050 }, spacing: 5, fill: 0.9, mix: { hutan: 0.5, mahoni: 0.3, angsana: 0.2 }, seed: 11 },
  { id: 'barat-kompleks', box: { minX: -136, maxX: -124, minZ: 900, maxZ: 976 }, spacing: 6.8, fill: 0.85, mix: { hutan: 0.5, mahoni: 0.3, angsana: 0.2 }, seed: 12 },
  { id: 'timur-hutan', box: { minX: -92, maxX: -50.5, minZ: 960, maxZ: 1036 }, spacing: 4.4, fill: 0.92, mix: { hutan: 0.6, mahoni: 0.2, angsana: 0.1, saga: 0.1 }, seed: 13 },
  { id: 'selatan-gedung', box: { minX: -124, maxX: -91, minZ: 1031, maxZ: 1037 }, spacing: 5, fill: 0.9, mix: { hutan: 0.5, mahoni: 0.3, angsana: 0.2 }, seed: 14 },
  { id: 'timur-kompleks', box: { minX: -49.2, maxX: -48, minZ: 905, maxZ: 957 }, spacing: 5.5, fill: 0.85, mix: { mahoni: 0.6, saga: 0.4 }, seed: 15 },
  { id: 'semak-hutan', box: { minX: -92, maxX: -50.5, minZ: 960, maxZ: 1036 }, spacing: 3.2, fill: 0.55, mix: { semak: 1 }, seed: 16 },
].map((z) => Object.freeze({ ...z, box: Object.freeze(z.box), mix: Object.freeze(z.mix) })));

function pickSpecies(mix, r) {
  let acc = 0;
  for (const [sp, w] of Object.entries(mix)) {
    acc += w;
    if (r < acc) return sp;
  }
  return Object.keys(mix)[0];
}

/** Titik tanam region-lokal [{sp, x, z}] (deterministik). */
export function ukmPlantPoints(zones = UKM_ZONES) {
  const out = [];
  for (const z of zones) {
    const pts = jitteredGrid({
      box: z.box, spacing: z.spacing, seed: z.seed,
      accept: (x, zz, rnd) => plantable(x, zz) && rnd.chance(z.fill),
    });
    pts.forEach(([x, zz], i) => {
      const [lx, lz] = toRegion(x, zz);
      out.push({ sp: pickSpecies(z.mix, ((i * 0.6180339887) % 1)), x: lx, z: lz });
    });
  }
  return out;
}

/** Lantai hutan berserasah (kotak dunia): drape di atas tanah di bawah tajuk, sesuai foto Street View (tanah cokelat, daun kering). */
export const UKM_LITTER_BOXES = Object.freeze([
  { minX: -136.5, maxX: -121, minZ: 974, maxZ: 1050 },
  { minX: -136.5, maxX: -125, minZ: 898, maxZ: 974 },
  { minX: -80, maxX: -47.5, minZ: 960, maxZ: 1036 },
  { minX: -124, maxX: -80, minZ: 1032, maxZ: 1037.5 },
].map((b) => Object.freeze(b)));

function litterTexture() {
  if (!hasDocument()) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#7d6a48';
  ctx.fillRect(0, 0, 128, 128);
  const rnd = createRandom(2025);
  const tones = ['#9a8157', '#6a5a3c', '#8c7549', '#6f8444', '#a88b5c', '#5c4c34'];
  for (let i = 0; i < 520; i += 1) {
    ctx.fillStyle = tones[Math.floor(rnd.next() * tones.length)];
    ctx.save();
    ctx.translate(rnd.next() * 128, rnd.next() * 128);
    ctx.rotate(rnd.next() * Math.PI);
    ctx.fillRect(0, 0, 2 + rnd.next() * 5, 1 + rnd.next() * 2);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 3, 1 / 3); // UV drape = meter dunia
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function litterMaterial() {
  return currentScope().get('ukm:serasah', () => {
    const map = litterTexture();
    const m = new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : 0x7d6a48, roughness: 1, ...(map ? { map } : {}),
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    m.name = 'serasahHutan';
    return m;
  });
}

/** Satu mesh serasah ter-drape (kotak digabung, 1 draw call); `heightAt` region-lokal. */
function litterMeshes(heightAt) {
  const field = { heightAt: (x, z) => heightAt(x - LEMBAGA_PLACEMENT.x, z - LEMBAGA_PLACEMENT.z) };
  const geos = UKM_LITTER_BOXES.map((b) => {
    const ring = [[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ]];
    return drapePolygon([ring], field, { lift: 0.02 }).translate(-LEMBAGA_PLACEMENT.x, 0, -LEMBAGA_PLACEMENT.z);
  });
  const mesh = new THREE.Mesh(mergeAll(geos), litterMaterial());
  mesh.name = 'ukm-serasah';
  mesh.receiveShadow = true;
  return mesh;
}

/** Builder bertahap: serasah + instans pohon per sel 200 m. `heightAt` region-lokal. */
export function createUkmVegetationBuilder({ heightAt }) {
  return staged('ukm-vegetasi', [
    () => litterMeshes(heightAt),
    () => {
      const kit = createVegetationKit();
      const cells = buildVegetationCells(vegetationInstances(ukmPlantPoints(), heightAt), kit);
      return cells.map((c) => c.group);
    },
  ], null, { merge: false });
}
