import * as THREE from 'three';
import { SITE } from '../config/constants.js';
import { createRandom } from './siteutil/rng.js';
import { instanceParts, localMatrix } from './siteutil/instanceParts.js';
import { distributeOnEllipse } from './siteutil/ellipseGeo.js';
import { isFreeForBigTree, isFreeInPlazaBelt } from './Landscape.zones.js';

/**
 * Vegetasi prosedural: pohon besar (4 jenis, InstancedMesh per bagian),
 * pohon muda berajir, semak, dan ilalang.
 */
export const TREE_TYPES = Object.freeze({
  trembesi: { trunkH: 5, trunkR: 0.5, crown: 'umbrella', crownR: 9, crownY: 7.5, color: 0x2d6b2a },
  mahoni: { trunkH: 6, trunkR: 0.32, crown: 'tall', crownR: 4, crownY: 9.5, color: 0x2f7a30 },
  pulai: { trunkH: 8, trunkR: 0.3, crown: 'layered', crownR: 3.8, crownY: 10.5, color: 0x3f8f3a },
  palem: { trunkH: 8, trunkR: 0.22, crown: 'palm', crownR: 3.2, crownY: 8.6, color: 0x3c8c2c },
});
const TREE_COUNT_RANDOM = 260;
const ROADSIDE_SPACING = 25;
const YOUNG_TREE_COUNT = 150;
const SHRUB_COUNT = 320;
const GRASS_CLUMP = Object.freeze({ clusters: 6, perCluster: 120, radius: 28 });

const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3f28 });
const stakeMat = new THREE.MeshLambertMaterial({ color: 0xb08a5a });
const shrubMat = new THREE.MeshLambertMaterial({ color: 0x3e7d2f });
const grassMat = new THREE.MeshLambertMaterial({ color: 0xb9a85c, side: THREE.DoubleSide });

/** Geometri tajuk sesuai jenis (origin di pusat tajuk). */
function crownGeometry(t) {
  if (t.crown === 'umbrella') return new THREE.SphereGeometry(t.crownR, 10, 7).scale(1, 0.45, 1);
  if (t.crown === 'tall') return new THREE.SphereGeometry(t.crownR, 9, 7).scale(1, 1.35, 1);
  if (t.crown === 'layered') return new THREE.ConeGeometry(t.crownR, t.crownR * 2.2, 9);
  return new THREE.ConeGeometry(t.crownR, 2.6, 8).rotateX(Math.PI); // palem: daun menjuntai
}

/** Daftar part (batang + tajuk) untuk satu jenis pohon. */
function treeParts(type) {
  const t = TREE_TYPES[type];
  const trunk = new THREE.CylinderGeometry(t.trunkR * 0.7, t.trunkR, t.trunkH, 7).translate(0, t.trunkH / 2, 0);
  return [
    { geometry: trunk, material: trunkMat, castShadow: true, name: `batang-${type}` },
    {
      geometry: crownGeometry(t),
      material: new THREE.MeshLambertMaterial({ color: t.color }),
      matrix: localMatrix(0, t.crownY, 0),
      castShadow: true,
      name: `tajuk-${type}`,
    },
  ];
}

/** Posisi acak bebas untuk pohon besar. */
function randomTreeSpots(rnd, count) {
  const spots = [];
  const half = SITE.groundSize / 2 - 30;
  let guard = 0;
  while (spots.length < count && guard < count * 40) {
    guard += 1;
    const x = rnd.range(-half, half);
    const z = rnd.range(-half, half);
    if (isFreeForBigTree(x, z)) spots.push({ x, z, rotY: rnd.range(0, Math.PI * 2), scale: rnd.range(0.8, 1.25) });
  }
  return spots;
}

/** Pohon tepi jalan: sepanjang jalan lingkar luar & kedua sisi Jl. Naga Sakti. */
function roadsideTreeSpots(rnd) {
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, joggingTrackOffset: off } = SITE;
  const ring = distributeOnEllipse(ax + off + 9, az + off + 9, 70)
    .filter((p) => isFreeForBigTree(p.x, p.z) || Math.abs(p.z - SITE.nagaSaktiZ) > 12)
    .map((p) => ({ x: p.x, z: p.z, rotY: rnd.range(0, 6.28), scale: rnd.range(0.9, 1.1) }));
  const len = SITE.groundSize * 0.95;
  const sideZ = SITE.nagaSaktiLanes * SITE.laneWidth / 2 + 6;
  const naga = [];
  for (let x = -len / 2; x <= len / 2; x += ROADSIDE_SPACING) {
    if (SITE.connectorXs.some((cx) => Math.abs(x - cx) < 9)) continue;
    [-1, 1].forEach((s) => naga.push({ x, z: SITE.nagaSaktiZ + s * sideZ, rotY: rnd.range(0, 6.28), scale: rnd.range(0.85, 1.1) }));
  }
  return { ring, naga };
}

/** Bagi array posisi ke beberapa jenis pohon secara acak (bobot). */
function splitByType(spots, rnd, weights) {
  const result = Object.fromEntries(Object.keys(TREE_TYPES).map((k) => [k, []]));
  const keys = Object.keys(weights);
  const total = keys.reduce((s, k) => s + weights[k], 0);
  spots.forEach((p) => {
    let r = rnd.next() * total;
    const key = keys.find((k) => (r -= weights[k]) <= 0) ?? keys[keys.length - 1];
    result[key].push(p);
  });
  return result;
}

/** Semua pohon besar (±400) sebagai InstancedMesh per jenis. */
export function createBigTrees(seed = 11) {
  const rnd = createRandom(seed);
  const road = roadsideTreeSpots(rnd);
  const random = splitByType(randomTreeSpots(rnd, TREE_COUNT_RANDOM), rnd, { trembesi: 3, mahoni: 3, pulai: 2, palem: 1 });
  const ringSplit = splitByType(road.ring, rnd, { trembesi: 2, mahoni: 1 });
  const g = new THREE.Group();
  g.name = 'pohonBesar';
  Object.keys(TREE_TYPES).forEach((type) => {
    const spots = [...random[type], ...ringSplit[type], ...(type === 'palem' ? road.naga : [])];
    g.add(instanceParts(treeParts(type), spots, `pohon-${type}`));
  });
  g.userData.count = Object.values(random).flat().length + road.ring.length + road.naga.length;
  return g;
}

/** Tiga ajir (bilah kayu) miring mengelilingi batang pohon muda. */
function stakeParts() {
  const geo = new THREE.BoxGeometry(0.05, 1.6, 0.05);
  return [0, 1, 2].map((i) => ({
    geometry: geo,
    material: stakeMat,
    matrix: new THREE.Matrix4()
      .makeRotationY((i * Math.PI * 2) / 3)
      .multiply(localMatrix(0.4, 0.75, 0, 0, 0, 0.22)),
    name: `ajir-${i}`,
  }));
}

/** Pohon muda berajir (±150) di sabuk plaza. */
export function createYoungTrees(seed = 23) {
  const rnd = createRandom(seed);
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, plazaSemiX: px, plazaSemiZ: pz } = SITE;
  const spots = [];
  let guard = 0;
  while (spots.length < YOUNG_TREE_COUNT && guard < 8000) {
    guard += 1;
    const t = rnd.range(0, Math.PI * 2);
    const u = rnd.next();
    const x = (px + 6 + (ax - px - 24) * u) * Math.cos(t);
    const z = (pz + 6 + (az - pz - 24) * u) * Math.sin(t);
    if (isFreeInPlazaBelt(x, z)) spots.push({ x, z, rotY: rnd.range(0, 6.28), scale: rnd.range(0.8, 1.2) });
  }
  const trunk = new THREE.CylinderGeometry(0.04, 0.06, 2.2, 6).translate(0, 1.1, 0);
  const crown = new THREE.SphereGeometry(0.75, 7, 6).scale(1, 1.2, 1);
  const parts = [
    { geometry: trunk, material: trunkMat, name: 'batangMuda' },
    { geometry: crown, material: new THREE.MeshLambertMaterial({ color: 0x55a63f }), matrix: localMatrix(0, 2.5, 0), castShadow: true, name: 'tajukMuda' },
    ...stakeParts(),
  ];
  const g = instanceParts(parts, spots, 'pohonMuda');
  g.userData.count = spots.length;
  return g;
}

/** Semak bulat rendah tersebar di luar plaza. */
export function createShrubs(seed = 31) {
  const rnd = createRandom(seed);
  const spots = [];
  const half = SITE.groundSize / 2 - 40;
  let guard = 0;
  while (spots.length < SHRUB_COUNT && guard < SHRUB_COUNT * 30) {
    guard += 1;
    const x = rnd.range(-half, half);
    const z = rnd.range(-half, half);
    const ok = isFreeForBigTree(x, z) || isFreeInPlazaBelt(x, z);
    if (ok) spots.push({ x, z, rotY: rnd.range(0, 6.28), scale: rnd.range(0.6, 1.5) });
  }
  const geo = new THREE.SphereGeometry(1.1, 7, 5).scale(1, 0.6, 1).translate(0, 0.5, 0);
  return instanceParts([{ geometry: geo, material: shrubMat, castShadow: true, name: 'semak' }], spots, 'semak');
}

/** Ilalang: rumpun kerucut tipis di beberapa area (tepi danau, sungai, dll). */
export function createWildGrass(seed = 41, centers = defaultGrassCenters()) {
  const rnd = createRandom(seed);
  const spots = [];
  centers.forEach((c) => {
    for (let i = 0; i < GRASS_CLUMP.perCluster; i += 1) {
      const a = rnd.range(0, Math.PI * 2);
      const r = Math.sqrt(rnd.next()) * (c.r ?? GRASS_CLUMP.radius);
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      if (!isFreeForBigTree(x, z) && !c.force) continue;
      spots.push({ x, z, rotY: rnd.range(0, 6.28), scale: rnd.range(0.7, 1.4) });
    }
  });
  const geo = new THREE.ConeGeometry(0.35, 1.5, 4).translate(0, 0.75, 0);
  return instanceParts([{ geometry: geo, material: grassMat, name: 'ilalang' }], spots, 'ilalang');
}

/** Pusat rumpun ilalang default: tepi danau, tepi sungai, sudut kawasan. */
function defaultGrassCenters() {
  const L = SITE.lakeCenter;
  return [
    { x: L.x + 105, z: L.z, r: 24, force: true },
    { x: L.x - 105, z: L.z + 10, r: 24, force: true },
    { x: SITE.riverX + 20, z: 180, r: 26, force: true },
    { x: SITE.riverX + 22, z: -220, r: 22, force: true },
    { x: -420, z: -200, r: 30 },
    { x: 380, z: 380, r: 30 },
  ];
}
