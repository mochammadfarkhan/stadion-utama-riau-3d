/**
 * Lapangan sepak bola 105×68: rumput strip mowing, marka FIFA, gawang,
 * bendera corner, bench pemain, A-board iklan, dan rumput D-zone.
 * Origin = pusat lapangan, sumbu panjang = Z, barat = −X.
 */
import * as THREE from 'three';
import { PITCH, TRACK, COLORS, SURFACE_Y } from '../../config/constants.js';
import {
  stadiumShape, flatShapeGeometry, mergeFlat, mulberry32, createCanvasTexture,
} from './ovalMath.js';
import { createMarkings, createGoals, createCornerFlags } from './Pitch.markings.js';
import { fillCanvas } from '../textures/noise.js';
import { groundMaterials } from '../Ground.materials.js';

const STRIPE_COUNT = 14;
const TEX_W = 512;
const TEX_H = 768;
const GRASS_ROUGHNESS = 0.92;
const GRASS_NOISE = Object.freeze({ blades: { freq: 48, octaves: 3, seed: 31 }, clumps: { freq: 6, octaves: 2, seed: 32 } });
const PATCH_COUNT = 9;
const PATCH_COLOR = [150, 160, 60]; // kuning samar (rumput kering)
const DZONE_Y = SURFACE_Y.dzone;
const BOARD_OFFSET = 4.5;
const BOARD_LEN = 5;
const BOARD_H = 0.9;
const BOARD_TILT = 0.17;
const BENCH_X = -(PITCH.width / 2 + 3);
const BENCH_Z = 10;
const BENCH_LEN = 5;
const BENCH_SEATS = 6;
const DEFAULT_SEED = 1205;
const SPONSORS = Object.freeze([
  { text: 'RIAU', bg: 0x1f7a3a },
  { text: 'PEKANBARU', bg: 0x1d4e89 },
  { text: 'PON XVIII 2012', bg: 0xe8711c },
]);

const halfL = PITCH.length / 2;
const halfW = PITCH.width / 2;

function hexToRgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function hexToCss(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}

/** Campuran warna piksel dengan patch kuning samar (koordinat u, v ∈ 0..1). */
function applyPatches(c, u, v, patches) {
  let out = c;
  for (const p of patches) {
    const d = Math.hypot(u - p.u, v - p.v) / p.r;
    if (d < 1) {
      const f = p.k * (1 - d);
      out = out.map((val, i) => val + (PATCH_COLOR[i] - val) * f);
    }
  }
  return out;
}

/**
 * Tekstur rumput: strip mowing bergantian + noise halus dua tingkat hijau
 * + patch kuning samar deterministik. Browser: CanvasTexture 512×768; Node: DataTexture kecil.
 */
function createGrassTexture(seed) {
  const rng = mulberry32(seed);
  const base = hexToRgb(COLORS.grass);
  const stripe = hexToRgb(COLORS.grassStripe);
  const patches = Array.from({ length: PATCH_COUNT }, () => ({
    u: rng(), v: rng(), r: 0.04 + rng() * 0.07, k: 0.25 + rng() * 0.35,
  }));
  const tex = fillCanvas(TEX_W, TEX_H, (u, v, noise) => {
    const even = Math.floor(v * STRIPE_COUNT) % 2 === 0;
    const blades = noise(u, v, GRASS_NOISE.blades);
    const clumps = noise(u, v, GRASS_NOISE.clumps);
    const k = 0.94 + blades * 0.08 + clumps * 0.04;
    const c = (even ? base : stripe).map((val) => val * k);
    return applyPatches(c, u, v, patches);
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createGrass(seed) {
  const g = new THREE.PlaneGeometry(PITCH.width, PITCH.length);
  g.rotateX(-Math.PI / 2);
  g.translate(0, SURFACE_Y.pitch, 0);
  const mat = new THREE.MeshStandardMaterial({ map: createGrassTexture(seed), roughness: GRASS_ROUGHNESS, metalness: 0 });
  mat.name = 'grass';
  mat.userData.baseRoughness = GRASS_ROUGHNESS;
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'rumput';
  mesh.receiveShadow = true;
  return mesh;
}

/** Rumput luar (D-zone) sampai kerb dalam lintasan; berbagi material rumput kawasan. */
function createDZone() {
  const kerbR = TRACK.innerRadius - TRACK.kerbOffset;
  const g = flatShapeGeometry(stadiumShape(TRACK.straightLength / 2, kerbR), [], 48);
  g.translate(0, DZONE_Y, 0);
  const mesh = new THREE.Mesh(g, groundMaterials().grass);
  mesh.name = 'dzone';
  mesh.receiveShadow = true;
  return mesh;
}

/** Satu bench pemain beratap akrilik dengan 6 kursi biru (menghadap +X). */
function buildBench(mats) {
  const group = new THREE.Group();
  const base = new THREE.BoxGeometry(1.6, 0.4, BENCH_LEN);
  base.translate(0, 0.2, 0);
  group.add(new THREE.Mesh(base, mats.concrete));
  const seats = [];
  for (let i = 0; i < BENCH_SEATS; i++) {
    const z = (i - (BENCH_SEATS - 1) / 2) * (BENCH_LEN / BENCH_SEATS);
    seats.push(new THREE.BoxGeometry(0.5, 0.08, 0.5).translate(0.2, 0.45, z));
    seats.push(new THREE.BoxGeometry(0.06, 0.5, 0.5).translate(-0.05, 0.7, z));
  }
  group.add(new THREE.Mesh(mergeFlat(seats), mats.seat));
  const posts = [-1, 1].map((s) => new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8).translate(-0.7, 1.1, (s * BENCH_LEN) / 2));
  group.add(new THREE.Mesh(mergeFlat(posts), mats.steel));
  const roof = new THREE.BoxGeometry(2.0, 0.06, BENCH_LEN + 0.4);
  roof.translate(0.1, 2.2, 0);
  group.add(new THREE.Mesh(roof, mats.acrylic));
  return group;
}

/** Dua bench di sisi barat. */
function createBenches() {
  const mats = {
    concrete: new THREE.MeshLambertMaterial({ color: COLORS.concrete }),
    seat: new THREE.MeshLambertMaterial({ color: 0x1d4e89 }),
    steel: new THREE.MeshLambertMaterial({ color: 0x888888 }),
    acrylic: new THREE.MeshLambertMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.35, depthWrite: false }),
  };
  const group = new THREE.Group();
  group.name = 'bench';
  for (const sz of [-1, 1]) {
    const bench = buildBench(mats);
    bench.position.set(BENCH_X, 0, sz * BENCH_Z);
    group.add(bench);
  }
  return group;
}

/** Material sponsor: CanvasTexture bila ada document, jika tidak warna polos. */
function createSponsorMaterial(sponsor) {
  const tex = createCanvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = hexToCss(sponsor.bg);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sponsor.text, w / 2, h / 2);
  });
  return tex
    ? new THREE.MeshLambertMaterial({ map: tex })
    : new THREE.MeshLambertMaterial({ color: sponsor.bg });
}

/** Panel A-board di (cx, cz), diputar rotY agar menghadap lapangan, miring ke belakang. */
function boardPanel(cx, cz, rotY) {
  const g = new THREE.PlaneGeometry(BOARD_LEN, BOARD_H);
  g.translate(0, BOARD_H / 2, 0);
  g.rotateX(-BOARD_TILT);
  g.rotateY(rotY);
  g.translate(cx, 0, cz);
  return g;
}

/** A-board keliling lapangan, dikelompokkan per sponsor (3 draw call). */
function createAdBoards() {
  const bx = halfW + BOARD_OFFSET;
  const bz = halfL + BOARD_OFFSET;
  const buckets = SPONSORS.map(() => []);
  let idx = 0;
  const push = (g) => { buckets[idx % SPONSORS.length].push(g); idx += 1; };
  const nLong = Math.floor(PITCH.length / BOARD_LEN);
  const nShort = Math.floor(PITCH.width / BOARD_LEN);
  for (let i = 0; i < nLong; i++) {
    const z = (i - (nLong - 1) / 2) * BOARD_LEN;
    push(boardPanel(bx, z, -Math.PI / 2));
    push(boardPanel(-bx, z, Math.PI / 2));
  }
  for (let i = 0; i < nShort; i++) {
    const x = (i - (nShort - 1) / 2) * BOARD_LEN;
    push(boardPanel(x, bz, Math.PI));
    push(boardPanel(x, -bz, 0));
  }
  const group = new THREE.Group();
  group.name = 'aboard';
  buckets.forEach((geoms, i) => {
    group.add(new THREE.Mesh(mergeFlat(geoms), createSponsorMaterial(SPONSORS[i])));
  });
  return group;
}

/**
 * Bangun lapangan lengkap.
 * @param {{seed?: number}} opts
 * @returns {THREE.Group}
 */
export function createPitch(opts = {}) {
  const seed = Number.isFinite(opts.seed) ? opts.seed : DEFAULT_SEED;
  const group = new THREE.Group();
  group.name = 'pitch';
  group.add(
    createDZone(), createGrass(seed), createMarkings(), createGoals(),
    createCornerFlags(), createBenches(), createAdBoards(),
  );
  return group;
}
