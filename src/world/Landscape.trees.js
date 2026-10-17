import * as THREE from 'three';
import { SITE } from '../config/constants.js';
import { createRandom } from './siteutil/rng.js';
import { instanceParts, localMatrix, colorizeInstances } from './siteutil/instanceParts.js';
import { blobCluster, mergeAll } from './siteutil/rounded.js';
import { distributeOnEllipse } from './siteutil/ellipseGeo.js';
import { isFreeForBigTree, isFreeInPlazaBelt } from './Landscape.zones.js';
import { applyWind, createWindDepthMaterial } from './shaders/wind.js';
import { currentScope } from '../engine/ResourceScope.js';

/**
 * Vegetasi prosedural gaya "cozy stylized": tajuk = gabungan 5-9 bola low-poly
 * (satu BufferGeometry -> satu InstancedMesh per jenis), batang pendek gemuk,
 * warna pastel per-instance. Hanya pohon besar yang memancarkan bayangan.
 */
export const TREE_TYPES = Object.freeze({
  trembesi: { trunkH: 4.2, trunkR: 0.75, crown: 'umbrella', crownR: 5.2, crownY: 7.4, blobs: 9, spread: 5.5, flat: 0.62, seed: 101 },
  mahoni: { trunkH: 4.8, trunkR: 0.5, crown: 'tall', crownR: 3.6, crownY: 8.6, blobs: 7, spread: 2.2, flat: 1.15, seed: 102 },
  pulai: { trunkH: 6, trunkR: 0.45, crown: 'layered', crownR: 3.2, crownY: 9.5, blobs: 8, spread: 2.4, flat: 0.9, seed: 103 },
  palem: { trunkH: 7.5, trunkR: 0.34, crown: 'palm', crownR: 3.2, crownY: 8.2, blobs: 7, spread: 0, flat: 1, seed: 104 },
  sawit: { trunkH: 9, trunkR: 0.36, crown: 'sawit', crownR: 4.6, crownY: 9.2, blobs: 0, spread: 0, flat: 1, seed: 105 },
});
/** Palet pastel: 3 tingkat hijau + sedikit kuning muda. */
export const LEAF_PALETTE = Object.freeze([0x9ccc65, 0x7cb342, 0xc5e1a5, 0x9ccc65, 0x7cb342, 0xdce775]);
const SHRUB_PALETTE = Object.freeze([0x9ccc65, 0xaed581, 0x7cb342, 0xc5e1a5]);
const GRASS_PALETTE = Object.freeze([0xdce775, 0xe6ee9c, 0xc5e1a5, 0xd4e157]);
const TREE_COUNT_RANDOM = 260;
const YOUNG_TREE_COUNT = 150;
const SHRUB_COUNT = 320;
const VEGETATION_CELL = 200; // m: ukuran sel culling untuk instansi vegetasi
const GRASS_CLUMP = Object.freeze({ clusters: 6, perCluster: 120, radius: 28 });
const PALM = Object.freeze({ leaves: 7, len: 3.4, width: 0.55, lift: 0.55, droop: 0.95 });
const GRASS_BLADES = 5;
const SAWIT = Object.freeze({ fronds: 22, segments: 11, length: 4.3, leafLen: 1.2, leafHalfBase: 0.22, ribbon: 0.08, ringStep: 0.55 });
const SAWIT_PALETTE = Object.freeze([0x3f8f3a, 0x357f35, 0x4a9a3e, 0x2f7433]);

/**
 * Parameter angin per jenis vegetasi (koordinat lokal geometri; tajuk berpusat di origin
 * sehingga rentang tinggi memakai ±radius). Batang/ajir memakai material tanpa angin → diam.
 */
const WIND = Object.freeze({
  bigCrown: { weightMode: 'height', heightMin: -4, heightMax: 4, weightMin: 0.2, amplitude: 1 },
  youngCrown: { weightMode: 'height', heightMin: -0.7, heightMax: 0.7, weightMin: 0.3, amplitude: 0.15 },
  shrub: { weightMode: 'height', heightMin: 0, heightMax: 1.3, amplitude: 0.12 },
  grass: { weightMode: 'height', heightMin: 0.1, heightMax: 1.4, amplitude: 0.35 },
});

// Kelapa sawit: helai daun tipis tanpa ketebalan → perlu DoubleSide (juga untuk bayangan).
const sawitLeafMat = () => currentScope().get('Landscape.trees:sawitLeafMat', () => {
  const v = applyWind(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), WIND.bigCrown);
  v.shadowSide = THREE.DoubleSide;
  return v;
});
const sawitDepthMat = () => currentScope().get('Landscape.trees:sawitDepthMat', () => {
  const v = createWindDepthMaterial(WIND.bigCrown);
  v.side = THREE.DoubleSide;
  return v;
});
const trunkMat = () => currentScope().get('Landscape.trees:trunkMat', () => new THREE.MeshLambertMaterial({ color: 0x8d6e63 }));
const stakeMat = () => currentScope().get('Landscape.trees:stakeMat', () => new THREE.MeshLambertMaterial({ color: 0xd7b98e }));
const leafMat = () => currentScope().get('Landscape.trees:leafMat', () => applyWind(new THREE.MeshLambertMaterial({ color: 0xffffff }), WIND.bigCrown)); // warna via instanceColor
const leafDepthMat = () => currentScope().get('Landscape.trees:leafDepthMat', () => createWindDepthMaterial(WIND.bigCrown)); // bayangan tajuk besar ikut bergoyang
const youngLeafMat = () => currentScope().get('Landscape.trees:youngLeafMat', () => applyWind(new THREE.MeshLambertMaterial({ color: 0xffffff }), WIND.youngCrown));
const shrubMat = () => currentScope().get('Landscape.trees:shrubMat', () => applyWind(new THREE.MeshLambertMaterial({ color: 0xffffff }), WIND.shrub));
const grassMat = () => currentScope().get('Landscape.trees:grassMat', () => applyWind(new THREE.MeshLambertMaterial({ color: 0xffffff }), WIND.grass));

/** Satu pelepah palem: dua kapsul pipih (pangkal naik, ujung menjuntai) pada sudut a. */
function palmLeaf(a) {
  const half = PALM.len / 2;
  const seg = (y0, tilt) => new THREE.CapsuleGeometry(PALM.width, half, 2, 6)
    .scale(1, 1, 0.3)
    .rotateZ(Math.PI / 2 + tilt)
    .translate(half * 0.9, y0, 0);
  const inner = seg(0.2, -PALM.lift);
  const outer = seg(0.15 + Math.sin(PALM.lift) * half, PALM.droop).translate(Math.cos(PALM.lift) * half * 0.9 + 0.5, 0, 0);
  return mergeAll([inner, outer]).rotateY(a);
}

/** Tajuk palem: pelepah radial + bola kecil di pusat (pangkal daun). */
function palmCrown(t) {
  const leaves = [];
  for (let i = 0; i < PALM.leaves; i += 1) leaves.push(palmLeaf((i / PALM.leaves) * Math.PI * 2));
  leaves.push(new THREE.SphereGeometry(t.trunkR * 1.8, 8, 6));
  return mergeAll(leaves);
}

/**
 * Satu pelepah sawit di bidang XY (x keluar, y atas): tulang daun melengkung (naik lalu menjuntai)
 * berupa pita pipih + helai daun sirip di kedua sisi (segitiga bersudut ke depan-samping-bawah).
 * `lift`/`droop` mengatur kelengkungan: pelepah dalam lebih tegak, luar menjuntai.
 */
function sawitFrond(lift, droop) {
  const { segments: N, length: L, leafLen, leafHalfBase: w, ribbon } = SAWIT;
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N;
    return new THREE.Vector3(L * t, lift * t - droop * t * t, 0);
  });
  const pos = [];
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const tan = new THREE.Vector3();
  for (let i = 0; i < N; i += 1) {
    const [a, b] = [pts[i], pts[i + 1]];
    quad(a.clone().setZ(-ribbon), b.clone().setZ(-ribbon), b.clone().setZ(ribbon), a.clone().setZ(ribbon));
  }
  for (let i = 2; i <= N; i += 1) {
    const p = pts[i];
    tan.subVectors(pts[Math.min(i + 1, N)], pts[i - 1]).normalize();
    const len = leafLen * (1 - 0.5 * (i / N));
    for (const side of [-1, 1]) {
      const dir = new THREE.Vector3(tan.x * 0.5, tan.y * 0.5 - 0.35, side * 0.85).normalize().multiplyScalar(len);
      const tip = p.clone().add(dir);
      tri(p.clone().addScaledVector(tan, -w), p.clone().addScaledVector(tan, w), tip);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Tajuk sawit: pelepah tersusun spiral (dalam tegak, luar menjuntai) + pangkal bulat kecil. */
export function sawitCrownGeometry(t) {
  const { fronds } = SAWIT;
  const parts = [new THREE.SphereGeometry(t.trunkR * 1.6, 8, 6)];
  for (let i = 0; i < fronds; i += 1) {
    const ring = i % 3;                                   // 0 = tegak, 1 = sedang, 2 = menjuntai
    const frond = sawitFrond([3.2, 2.7, 2.3][ring], [3.6, 4.0, 4.4][ring]);
    parts.push(frond.rotateY((i / fronds) * Math.PI * 2 + ring * 0.35));
  }
  return mergeAll(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    g.deleteAttribute('uv');
    return g;
  }));
}

/** Batang sawit: tumpukan cincin bergantian (bekas pelepah) dan menyempit ke atas. */
export function sawitTrunkGeometry(r, h) {
  const n = Math.max(2, Math.round(h / SAWIT.ringStep));
  const step = h / n;
  const rings = Array.from({ length: n }, (_, i) => {
    const k = 1 - 0.18 * (i / n);
    const radius = r * k * (i % 2 === 0 ? 0.9 : 1.13);
    return new THREE.CylinderGeometry(radius * 0.97, radius, step, 8, 1, true).translate(0, step * (i + 0.5), 0);
  });
  rings.push(new THREE.CircleGeometry(r * 0.78, 8).rotateX(-Math.PI / 2).translate(0, h, 0));
  return mergeAll(rings.map((g) => (g.index ? g.toNonIndexed() : g)));
}

/** Geometri tajuk gumpalan bola sesuai jenis (origin di pusat tajuk). */
function crownGeometry(t) {
  if (t.crown === 'palm') return palmCrown(t);
  if (t.crown === 'sawit') return sawitCrownGeometry(t);
  const rnd = createRandom(t.seed);
  const vertical = t.crown === 'tall' ? t.crownR * 0.9 : t.crownR * 0.35;
  return blobCluster({ count: t.blobs, radius: t.crownR, spread: t.spread, flat: t.flat, vertical }, rnd);
}

/** Batang pendek gemuk: silinder melebar di bawah + bola di pangkal dan di ujung. */
function trunkGeometry(r, h, segments = 8) {
  const body = new THREE.CylinderGeometry(r * 0.75, r * 1.15, h, segments).translate(0, h / 2, 0);
  const foot = new THREE.SphereGeometry(r * 1.25, segments, 5).scale(1, 0.45, 1).translate(0, 0.1, 0);
  const top = new THREE.SphereGeometry(r * 0.8, segments, 5).translate(0, h, 0);
  return mergeAll([body, foot, top]);
}

/** Daftar part (batang + tajuk) untuk satu jenis pohon. */
function treeParts(type) {
  const t = TREE_TYPES[type];
  const sawit = type === 'sawit';
  return [
    { geometry: sawit ? sawitTrunkGeometry(t.trunkR, t.trunkH) : trunkGeometry(t.trunkR, t.trunkH), material: trunkMat(), castShadow: true, name: `batang-${type}` },
    { geometry: crownGeometry(t), material: sawit ? sawitLeafMat() : leafMat(), matrix: localMatrix(0, t.crownY, 0), castShadow: true, name: `tajuk-${type}` },
  ];
}

const ALL = () => true;

/** Posisi acak bebas untuk pohon besar. */
function randomTreeSpots(rnd, count, keep) {
  const spots = [];
  const half = SITE.groundSize / 2 - 30;
  let guard = 0;
  while (spots.length < count && guard < count * 40) {
    guard += 1;
    const x = rnd.range(-half, half);
    const z = rnd.range(-half, half);
    if (isFreeForBigTree(x, z) && keep(x, z)) spots.push({ x, z, rotY: rnd.range(0, Math.PI * 2), scale: rnd.range(0.8, 1.25) });
  }
  return spots;
}

/** Pohon tepi jalan lingkar luar (deret palem Jl. Naga Sakti handmade dihapus Plan C). */
function roadsideTreeSpots(rnd, keep) {
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, joggingTrackOffset: off } = SITE;
  const ring = distributeOnEllipse(ax + off + 9, az + off + 9, 70)
    .filter((p) => isFreeForBigTree(p.x, p.z) && keep(p.x, p.z))
    .map((p) => ({ x: p.x, z: p.z, rotY: rnd.range(0, 6.28), scale: rnd.range(0.9, 1.1) }));
  return { ring };
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

/** Warnai InstancedMesh bernama (awalan) di dalam group dengan palet acak. */
function colorizeNamed(group, prefix, palette, rnd) {
  group.children
    .filter((m) => m.isInstancedMesh && m.name.startsWith(prefix))
    .forEach((mesh) => colorizeInstances(mesh, palette, rnd));
  return group;
}

/** Pasang material kedalaman berangin pada tajuk pohon besar agar bayangannya ikut bergoyang. */
function attachCrownShadow(group) {
  group.children
    .filter((m) => m.isInstancedMesh && (m.material === leafMat() || m.material === sawitLeafMat()))
    .forEach((crown) => { crown.customDepthMaterial = crown.material === sawitLeafMat() ? sawitDepthMat() : leafDepthMat(); });
  return group;
}

/** Semua pohon besar (sekitar 400) sebagai InstancedMesh per jenis (batang + tajuk). */
export function createBigTrees(seed = 11, keep = ALL) {
  const rnd = createRandom(seed);
  const road = roadsideTreeSpots(rnd, keep);
  const random = splitByType(randomTreeSpots(rnd, TREE_COUNT_RANDOM, keep), rnd, { trembesi: 3, mahoni: 3, pulai: 2, palem: 1, sawit: 3 });
  const ringSplit = splitByType(road.ring, rnd, { trembesi: 2, mahoni: 1, sawit: 2 });
  const g = new THREE.Group();
  g.name = 'pohonBesar';
  Object.keys(TREE_TYPES).forEach((type) => {
    const spots = [...random[type], ...ringSplit[type]];
    g.add(attachCrownShadow(colorizeNamed(instanceParts(treeParts(type), spots, `pohon-${type}`), 'tajuk', type === 'sawit' ? SAWIT_PALETTE : LEAF_PALETTE, rnd)));
  });
  g.userData.count = Object.values(random).flat().length + road.ring.length;
  return g;
}

/** Tiga ajir (bilah kayu bulat) miring mengelilingi batang pohon muda. */
function stakeParts() {
  const geo = new THREE.CylinderGeometry(0.035, 0.045, 1.6, 5);
  return [0, 1, 2].map((i) => ({
    geometry: geo,
    material: stakeMat(),
    matrix: new THREE.Matrix4()
      .makeRotationY((i * Math.PI * 2) / 3)
      .multiply(localMatrix(0.4, 0.75, 0, 0, 0, 0.22)),
    name: `ajir-${i}`,
  }));
}

/** Posisi pohon muda di sabuk plaza (deterministik). */
function youngTreeSpots(rnd, keep) {
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, plazaSemiX: px, plazaSemiZ: pz } = SITE;
  const spots = [];
  let guard = 0;
  while (spots.length < YOUNG_TREE_COUNT && guard < 8000) {
    guard += 1;
    const t = rnd.range(0, Math.PI * 2);
    const u = rnd.next();
    const x = (px + 6 + (ax - px - 24) * u) * Math.cos(t);
    const z = (pz + 6 + (az - pz - 24) * u) * Math.sin(t);
    if (isFreeInPlazaBelt(x, z) && keep(x, z)) spots.push({ x, z, rotY: rnd.range(0, 6.28), scale: rnd.range(0.8, 1.2) });
  }
  return spots;
}

/** Pohon muda berajir (sekitar 150): tajuk 3 bola kecil, batang pendek, 3 bilah ajir. */
export function createYoungTrees(seed = 23, keep = ALL) {
  const rnd = createRandom(seed);
  const spots = youngTreeSpots(rnd, keep);
  const crown = blobCluster({ count: 3, radius: 0.7, spread: 0.55, flat: 1.1, vertical: 0.3 }, createRandom(seed + 500));
  const parts = [
    { geometry: trunkGeometry(0.09, 2.0, 6), material: trunkMat(), name: 'batangMuda' },
    { geometry: crown, material: youngLeafMat(), matrix: localMatrix(0, 2.45, 0), name: 'tajukMuda' },
    ...stakeParts(),
  ];
  const g = colorizeNamed(instanceParts(parts, spots, 'pohonMuda'), 'tajuk', LEAF_PALETTE, rnd);
  g.userData.count = spots.length;
  return g;
}

/** Semak bulat rendah tersebar di luar plaza: 6 bola gemuk saling tumpang tindih. */
export function createShrubs(seed = 31, keep = ALL) {
  const rnd = createRandom(seed);
  const spots = [];
  const half = SITE.groundSize / 2 - 40;
  let guard = 0;
  while (spots.length < SHRUB_COUNT && guard < SHRUB_COUNT * 30) {
    guard += 1;
    const x = rnd.range(-half, half);
    const z = rnd.range(-half, half);
    const ok = (isFreeForBigTree(x, z) || isFreeInPlazaBelt(x, z)) && keep(x, z);
    if (ok) spots.push({ x, z, rotY: rnd.range(0, 6.28), scale: rnd.range(0.6, 1.5) });
  }
  const geo = blobCluster({ count: 6, radius: 0.8, spread: 0.85, flat: 0.75, center: [0, 0.45, 0], vertical: 0.15 }, createRandom(seed + 500));
  const g = instanceParts([{ geometry: geo, material: shrubMat(), name: 'semak' }], spots, 'semak', { cellSize: VEGETATION_CELL }); // tanpa bayangan
  return colorizeNamed(g, 'semak', SHRUB_PALETTE, rnd);
}

/** Rumpun ilalang: 5 kerucut gemuk miring ke luar digabung jadi satu geometri. */
function grassClumpGeometry() {
  const rnd = createRandom(77);
  const geos = [new THREE.ConeGeometry(0.3, 1.5, 5).translate(0, 0.75, 0)];
  for (let i = 1; i < GRASS_BLADES; i += 1) {
    const a = (i / (GRASS_BLADES - 1)) * Math.PI * 2 + rnd.range(-0.3, 0.3);
    const h = rnd.range(0.9, 1.3);
    geos.push(new THREE.ConeGeometry(0.22, h, 5).translate(0, h / 2, 0).rotateZ(0.28).rotateY(a).translate(Math.cos(a) * 0.1, 0, -Math.sin(a) * 0.1));
  }
  return mergeAll(geos);
}

/** Ilalang: rumpun di beberapa area kawasan, warna kuning-hijau per instance. */
export function createWildGrass(seed = 41, centers = defaultGrassCenters(), keep = ALL) {
  const rnd = createRandom(seed);
  const spots = [];
  centers.forEach((c) => {
    for (let i = 0; i < GRASS_CLUMP.perCluster; i += 1) {
      const a = rnd.range(0, Math.PI * 2);
      const r = Math.sqrt(rnd.next()) * (c.r ?? GRASS_CLUMP.radius);
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      if ((!isFreeForBigTree(x, z) && !c.force) || !keep(x, z)) continue;
      spots.push({ x, z, rotY: rnd.range(0, 6.28), scale: rnd.range(0.7, 1.4) });
    }
  });
  const g = instanceParts([{ geometry: grassClumpGeometry(), material: grassMat(), name: 'ilalang' }], spots, 'ilalang', { cellSize: VEGETATION_CELL });
  return colorizeNamed(g, 'ilalang', GRASS_PALETTE, rnd);
}

/** Pusat rumpun ilalang default: sudut kawasan (pusat tepi danau/sungai fiktif dihapus Plan C). */
function defaultGrassCenters() {
  return [
    { x: -420, z: -200, r: 30 },
    { x: 380, z: 380, r: 30 },
  ];
}
