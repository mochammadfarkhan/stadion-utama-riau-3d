/**
 * Perabot sekre (katalog S07–S30 + kursi lipat, kertas, kabel). Placeholder prosedural berukuran PERSIS katalog;
 * statis → staticGroup (digabung per material oleh index.js), yang bergerak/diganti GLB → dynamicGroup.
 * Hidup: kipas (S14) berputar + menoleh, kertas di meja berkibar saat kipas menyala, dispenser (S13) mengisi gelas,
 * gitar (S19) berpindah ke tangan NPC, layar laptop (S17) emisif (dikendalikan lighting).
 * GLB final (GLB_ASET di data.js) dimuat ke container; gagal → placeholder tetap tampil.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { instantiateModel } from '../../world/assets/models.js';
import { ASET, EKSTRA, GLB_ASET, GUITAR_HOLD, ordnerSlots } from './data.js';
import { makeCanvas, canvasTexture, tint } from './canvas.js';
import { drawKarpet } from './room.js';

const PI = Math.PI;
const propRy = (hadap) => hadap + PI;
const TMP_M = new THREE.Matrix4();
const TMP_E = new THREE.Euler();
const TMP_V = new THREE.Vector3();
const FAN_POS = new THREE.Vector3(ASET.S14.items[0].x, 1.05, ASET.S14.items[0].z);

/** Material bersama interior (dibuat sekali per build; dilepas lewat disposeTree scene). */
export function createSekreMaterials(renderer = null) {
  const karpetCanvas = makeCanvas(768, 1024);
  drawKarpet(karpetCanvas.getContext('2d'), 768, 1024);
  return {
    prop: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.65 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xd8ecf2, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
    galon: new THREE.MeshStandardMaterial({ color: 0x8cc4ea, roughness: 0.15, transparent: true, opacity: 0.5, depthWrite: false }),
    water: new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.05, transparent: true, opacity: 0.65, depthWrite: false }),
    tl: new THREE.MeshStandardMaterial({ color: 0xf6f8ff, emissive: 0xeef4ff, emissiveIntensity: 0.15, roughness: 0.3 }),
    screen: new THREE.MeshStandardMaterial({ name: 'unri:layar-emisif', color: 0x0b0f14, emissive: 0x9cc4ff, emissiveIntensity: 0, roughness: 0.25 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf7f5ee, roughness: 0.9, side: THREE.DoubleSide }),
    karpet: new THREE.MeshStandardMaterial({ map: canvasTexture(karpetCanvas, renderer), roughness: 1 }),
  };
}

// ---------- Helper geometri berwarna (koordinat lokal aset) ----------

function shaped(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  if (rx || ry || rz) geo.applyMatrix4(TMP_M.makeRotationFromEuler(TMP_E.set(rx, ry, rz)));
  return tint(geo.translate(x, y, z), color);
}
const box = (w, h, d, color, t) => shaped(new THREE.BoxGeometry(w, h, d), color, t);
const rbox = (w, h, d, r, color, t) => shaped(new RoundedBoxGeometry(w, h, d, 2, r), color, t);
const cyl = (rt, rb, h, color, t, seg = 14) => shaped(new THREE.CylinderGeometry(rt, rb, h, seg), color, t);
const torus = (r, tube, color, t) => shaped(new THREE.TorusGeometry(r, tube, 6, 24), color, t);
const ball = (r, color, t) => shaped(new THREE.SphereGeometry(r, 10, 8), color, t);
const tube = (points, r, color) => tint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), 48, r, 6), color);

/**
 * Satu Mesh dari potongan berwarna (atribut identik: posisi, normal, uv, warna). RoundedBoxGeometry tidak
 * ber-indeks sedangkan Box/Cylinder ber-indeks → semua disamakan non-indexed sebelum digabung.
 */
function piece(geos, material, name = '', castShadow = true) {
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const geo = mergeGeometries(flat, false);
  for (const g of new Set([...geos, ...flat])) g.dispose();
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  m.castShadow = castShadow;
  m.receiveShadow = true;
  return m;
}

function placed(obj, it, ry = propRy(it.hadap)) {
  obj.position.set(it.x, it.y, it.z);
  obj.rotation.y = ry;
  return obj;
}

function groupOf(name, ...children) {
  const g = new THREE.Group();
  g.name = name;
  g.add(...children);
  return g;
}

// ---------- Placeholder aset GLB (lokal: origin tengah alas, depan −Z) ----------

/** S07 piala 0,15 × 0,15 × 0,45 */
function buildPiala(m) {
  const GOLD = '#d4a838';
  const gold = piece([
    cyl(0.012, 0.025, 0.1, GOLD, { y: 0.17 }),
    cyl(0.065, 0.03, 0.13, GOLD, { y: 0.285 }),
    torus(0.035, 0.007, GOLD, { x: 0.07, y: 0.29 }),
    torus(0.035, 0.007, GOLD, { x: -0.07, y: 0.29 }),
    cyl(0.068, 0.068, 0.012, GOLD, { y: 0.356 }),
    cyl(0.004, 0.01, 0.06, GOLD, { y: 0.392 }),
    ball(0.022, GOLD, { y: 0.428 }),
  ], m.metal, 'emas');
  const base = piece([
    box(0.15, 0.05, 0.15, '#3a2a1e', { y: 0.025 }),
    box(0.11, 0.07, 0.11, '#e8e2d6', { y: 0.085 }),
    box(0.06, 0.02, 0.003, '#c9b27a', { y: 0.07, z: -0.0565 }),
  ], m.prop, 'alas');
  return groupOf('S07-ph', gold, base);
}

/** S13 dispenser + galon terbalik (0,32 × 0,32 × 1,25); air tinggal seperempat galon. */
function buildDispenser(m) {
  const body = piece([
    box(0.32, 0.9, 0.32, '#eceff1', { y: 0.45 }),
    box(0.26, 0.28, 0.01, '#cfd8dc', { y: 0.62, z: -0.165 }),
    cyl(0.012, 0.012, 0.05, '#d32f2f', { x: -0.05, y: 0.66, z: -0.19, rx: PI / 2 }),
    cyl(0.012, 0.012, 0.05, '#1e88e5', { x: 0.05, y: 0.66, z: -0.19, rx: PI / 2 }),
    box(0.2, 0.02, 0.1, '#90a4ae', { y: 0.5, z: -0.2 }),
    box(0.3, 0.04, 0.3, '#dfe3e6', { y: 0.92 }),
    box(0.03, 0.03, 0.005, '#43a047', { x: 0.1, y: 0.8, z: -0.163 }),
    cyl(0.128, 0.128, 0.07, '#5fa8d3', { y: 1.015 }, 20),
  ], m.prop, 'badan');
  const galon = piece([
    cyl(0.135, 0.05, 0.04, '#ffffff', { y: 0.96 }, 20),
    cyl(0.135, 0.135, 0.27, '#ffffff', { y: 1.115 }, 20),
  ], m.galon, 'galon', false);
  return groupOf('S13-ph', body, galon);
}

/** S14 kipas berdiri (0,45 × 0,45 × 1,3): badan statis + kepala (menoleh) + baling (berputar). */
function buildKipas(m) {
  const base = piece([
    cyl(0.2, 0.22, 0.04, '#e8e8e8', { y: 0.02 }, 24),
    cyl(0.018, 0.018, 0.98, '#cfcfcf', { y: 0.53 }),
    box(0.06, 0.08, 0.05, '#e8e8e8', { y: 0.32, z: -0.03 }),
    box(0.012, 0.012, 0.012, '#2e7d32', { x: -0.015, y: 0.34, z: -0.058 }),
    box(0.012, 0.012, 0.012, '#c62828', { x: 0.015, y: 0.34, z: -0.058 }),
  ], m.prop, 'badan');
  const head = new THREE.Group();
  head.name = 'kepala';
  head.position.y = 1.05;
  const cage = [
    cyl(0.07, 0.08, 0.14, '#e8e8e8', { z: 0.09, rx: PI / 2 }),
    torus(0.21, 0.006, '#d0d0d0', { z: -0.03 }),
    torus(0.21, 0.006, '#d0d0d0', { z: -0.1 }),
    cyl(0.03, 0.03, 0.02, '#4fc3f7', { z: -0.105, rx: PI / 2 }),
  ];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * PI * 2;
    cage.push(box(0.005, 0.21, 0.005, '#d0d0d0', { x: Math.cos(a) * 0.105, y: Math.sin(a) * 0.105, z: -0.1, rz: a - PI / 2 }));
  }
  head.add(piece(cage, m.prop, 'kepala-ph'));
  const bladeGeos = [cyl(0.03, 0.03, 0.03, '#4fc3f7', { rx: PI / 2 })];
  for (let i = 0; i < 3; i += 1) {
    bladeGeos.push(tint(new THREE.BoxGeometry(0.075, 0.17, 0.008).rotateY(0.3).translate(0, 0.1, 0).rotateZ((i * 2 * PI) / 3), '#4fc3f7'));
  }
  const blades = piece(bladeGeos, m.prop, 'baling');
  blades.position.z = -0.065;
  head.add(blades);
  return { group: groupOf('S14-ph', base, head), head, blades };
}

/** S15 printer tua 0,45 × 0,4 × 0,25 */
function buildPrinter(m) {
  return groupOf('S15-ph', piece([
    box(0.45, 0.2, 0.38, '#d6d0c2', { y: 0.1 }),
    box(0.42, 0.03, 0.2, '#c8c1b1', { y: 0.215, z: 0.05 }),
    box(0.3, 0.01, 0.15, '#bdb6a6', { y: 0.2, z: -0.24, rx: -0.3 }),
    box(0.28, 0.002, 0.12, '#ffffff', { y: 0.21, z: -0.24, rx: -0.3 }),
    box(0.1, 0.03, 0.005, '#424242', { x: 0.14, y: 0.15, z: -0.191 }),
    box(0.015, 0.015, 0.004, '#ff9800', { x: 0.17, y: 0.15, z: -0.194 }),
  ], m.prop, 'printer'));
}

/** S17 laptop 0,34 × 0,24 × 0,23 terbuka ±105°; layar = material emisif bersama. */
function buildLaptop(m) {
  const lid = (geo) => geo.translate(0, 0.11, 0).rotateX(0.26).translate(0, 0.018, 0.12);
  const body = piece([
    box(0.34, 0.018, 0.24, '#3a3d42', { y: 0.009 }),
    box(0.3, 0.002, 0.12, '#202225', { y: 0.019, z: 0.03 }),
    box(0.09, 0.001, 0.06, '#4a4d52', { y: 0.019, z: -0.075 }),
    tint(lid(new THREE.BoxGeometry(0.34, 0.22, 0.008)), '#3a3d42'),
  ], m.prop, 'badan');
  const screen = new THREE.Mesh(lid(new THREE.PlaneGeometry(0.3, 0.18).rotateY(PI).translate(0, 0, -0.0045)), m.screen);
  screen.name = 'layar';
  return groupOf('S17-ph', body, screen);
}

/** S19 gitar akustik 0,38 × 0,1 × 1,0 (tegak, depan −Z). */
function buildGitar(m) {
  const BODY = '#c98b4b';
  const NECK = '#4a2e1c';
  const geos = [
    cyl(0.19, 0.19, 0.1, BODY, { y: 0.21, rx: PI / 2 }, 24),
    cyl(0.145, 0.145, 0.1, BODY, { y: 0.45, rx: PI / 2 }, 24),
    cyl(0.055, 0.055, 0.004, '#1b1b1b', { y: 0.4, z: -0.051, rx: PI / 2 }, 18),
    box(0.05, 0.42, 0.03, NECK, { y: 0.77 }),
    box(0.075, 0.13, 0.025, NECK, { y: 0.935 }),
    box(0.1, 0.012, 0.02, '#1b1b1b', { y: 0.12, z: -0.055 }),
  ];
  for (let i = 0; i < 6; i += 1) {
    geos.push(box(0.0015, 0.8, 0.0015, '#d7d7d7', { x: -0.0125 + i * 0.005, y: 0.52, z: -0.04 }));
    geos.push(cyl(0.006, 0.006, 0.03, '#c9b27a', { x: i < 3 ? -0.045 : 0.045, y: 0.9 + (i % 3) * 0.035, rz: PI / 2 }));
  }
  return groupOf('S19-ph', piece(geos, m.prop, 'gitar'));
}

/** S20 tas ransel 0,3 × 0,2 × 0,45 */
function buildTas(m, color) {
  const c = new THREE.Color(color);
  const dark = `#${c.clone().multiplyScalar(0.7).getHexString()}`;
  return groupOf('S20-ph', piece([
    rbox(0.3, 0.42, 0.18, 0.06, color, { y: 0.21 }),
    rbox(0.22, 0.18, 0.06, 0.03, dark, { y: 0.14, z: -0.1 }),
    torus(0.04, 0.008, dark, { y: 0.43 }),
    box(0.04, 0.36, 0.02, dark, { x: -0.08, y: 0.24, z: 0.095 }),
    box(0.04, 0.36, 0.02, dark, { x: 0.08, y: 0.24, z: 0.095 }),
    box(0.2, 0.006, 0.004, '#cfd8dc', { y: 0.22, z: -0.131 }),
  ], m.prop, 'tas'));
}

// ---------- Perabot statis ----------

function buildMeja(m) {
  const top = piece([
    box(1.8, 0.03, 0.6, '#d8cbb0', { y: 0.735 }),
    box(1.8, 0.035, 0.012, '#7a6f5d', { y: 0.72, z: -0.3 }),
    box(1.8, 0.035, 0.012, '#7a6f5d', { y: 0.72, z: 0.3 }),
  ], m.prop, 'meja');
  const legs = [];
  for (const x of [-0.8, 0.8]) {
    for (const z of [-0.24, 0.24]) legs.push(cyl(0.012, 0.012, 0.72, '#9ea7ad', { x, y: 0.36, z, rx: z > 0 ? 0.06 : -0.06 }));
    legs.push(cyl(0.01, 0.01, 0.5, '#9ea7ad', { x, y: 0.12, rx: PI / 2 }));
  }
  legs.push(cyl(0.01, 0.01, 1.6, '#9ea7ad', { y: 0.12, rz: PI / 2 }));
  return groupOf('S16', top, piece(legs, m.metal, 'kaki'));
}

function buildKursi(m) {
  const seat = piece([
    box(0.42, 0.04, 0.4, '#8a5a2b', { y: 0.45 }),
    box(0.42, 0.34, 0.03, '#8a5a2b', { y: 0.78, z: 0.2 }),
    box(0.03, 0.2, 0.36, '#7a4c22', { x: -0.22, y: 0.58 }),
    box(0.03, 0.2, 0.36, '#7a4c22', { x: 0.22, y: 0.58 }),
  ], m.prop, 'dudukan');
  const legs = [];
  for (const x of [-0.19, 0.19]) {
    legs.push(cyl(0.011, 0.011, 0.45, '#9ea7ad', { x, y: 0.225, z: -0.17 }));
    legs.push(cyl(0.011, 0.011, 0.9, '#9ea7ad', { x, y: 0.45, z: 0.19 }));
  }
  legs.push(cyl(0.009, 0.009, 0.38, '#9ea7ad', { y: 0.2, z: -0.17, rz: PI / 2 }));
  return groupOf('kursi-lipat', seat, piece(legs, m.metal, 'kaki'));
}

function buildGelas(m, isi) {
  const geos = isi === 'plastik'
    ? [
      cyl(0.04, 0.032, 0.1, '#e3f2fd', { y: 0.05 }),
      cyl(0.037, 0.037, 0.003, '#c5e1a5', { y: 0.08 }),
      cyl(0.003, 0.003, 0.16, '#e53935', { x: 0.01, y: 0.12, rz: 0.2 }),
    ]
    : [
      cyl(0.04, 0.033, 0.1, '#f5f5f5', { y: 0.05 }),
      cyl(0.036, 0.036, 0.004, '#4e342e', { y: 0.088 }),
      torus(0.025, 0.006, '#f5f5f5', { x: 0.045, y: 0.05 }),
    ];
  return piece(geos, m.prop, 'S18', false);
}

function buildSepatu(m, color) {
  const geos = [];
  for (const z of [-0.065, 0.065]) {
    geos.push(box(0.3, 0.025, 0.11, '#f5f5f5', { y: 0.0125, z }));
    geos.push(rbox(0.27, 0.07, 0.1, 0.03, color, { x: 0.01, y: 0.06, z }));
  }
  return piece(geos, m.prop, 'S21', false);
}

function buildKarpet(m, it) {
  const g = new THREE.Group();
  g.name = 'S22';
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.4).rotateX(-PI / 2).translate(0, 0.006, 0), m.karpet);
  rug.receiveShadow = true;
  g.add(rug);
  g.position.set(it.x, it.y, it.z);
  return g;
}

function buildLemari(m) {
  const GREY = '#8d969e';
  const shell = piece([
    box(0.9, 1.8, 0.01, GREY, { y: 0.9, z: 0.22 }),
    box(0.01, 1.8, 0.45, GREY, { x: -0.445, y: 0.9 }),
    box(0.01, 1.8, 0.45, GREY, { x: 0.445, y: 0.9 }),
    box(0.9, 0.012, 0.45, GREY, { y: 1.794 }),
    box(0.9, 0.05, 0.45, '#6f777e', { y: 0.025 }),
    box(0.88, 0.02, 0.43, GREY, { y: 0.95 }),
    box(0.88, 0.012, 0.43, GREY, { y: 1.35 }),
    box(0.435, 0.86, 0.012, GREY, { x: -0.2225, y: 0.5, z: -0.219 }),
    box(0.435, 0.86, 0.012, GREY, { x: 0.2225, y: 0.5, z: -0.219 }),
    box(0.015, 0.1, 0.015, '#37474f', { x: -0.03, y: 0.75, z: -0.23 }),
    box(0.015, 0.1, 0.015, '#37474f', { x: 0.03, y: 0.75, z: -0.23 }),
    box(0.02, 0.03, 0.01, '#c9b27a', { y: 0.98, z: -0.228 }),
    ...[-0.2225, 0.2225].flatMap((x) => [
      box(0.02, 0.78, 0.015, GREY, { x: x - 0.2075, y: 1.36, z: -0.22 }),
      box(0.02, 0.78, 0.015, GREY, { x: x + 0.2075, y: 1.36, z: -0.22 }),
      box(0.435, 0.02, 0.015, GREY, { x, y: 0.98, z: -0.22 }),
      box(0.435, 0.02, 0.015, GREY, { x, y: 1.74, z: -0.22 }),
    ]),
  ], m.metal, 'lemari');
  const glass = piece([-0.2225, 0.2225].map((x) => box(0.395, 0.74, 0.004, '#ffffff', { x, y: 1.36, z: -0.219 })), m.glass, 'kaca', false);
  return groupOf('S09', shell, glass);
}

/** S10: 12 map ordner (InstancedMesh, warna per instans) di rak kaca lemari; koordinat ruang. */
function buildOrdner(m) {
  const slots = ordnerSlots();
  const mesh = new THREE.InstancedMesh(tint(new THREE.BoxGeometry(0.08, 0.32, 0.3), '#ffffff'), m.prop, slots.length);
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const color = new THREE.Color();
  slots.forEach((s, i) => {
    q.setFromEuler(TMP_E.set(0, 0, s.miring));
    TMP_M.compose(TMP_V.set(s.x, s.y + 0.16, s.z), q, one);
    mesh.setMatrixAt(i, TMP_M);
    mesh.setColorAt(i, color.set(s.warna));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = 'S10';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildKardus(m) {
  return piece([
    box(0.5, 0.35, 0.4, '#b88a55', { y: 0.175 }),
    box(0.06, 0.352, 0.402, '#d9c79c', { y: 0.175 }),
    box(0.5, 0.008, 0.2, '#a87a48', { y: 0.355, z: -0.1, rx: -0.25 }),
    box(0.2, 0.12, 0.002, '#efe6d0', { y: 0.2, z: -0.201 }),
  ], m.prop, 'S11');
}

function buildSpanduk(m) {
  return piece([
    cyl(0.05, 0.05, 2, '#f2efe6', { y: 1 }),
    cyl(0.052, 0.052, 0.12, '#d9661f', { y: 0.1 }),
    cyl(0.052, 0.052, 0.12, '#d9661f', { y: 1.9 }),
  ], m.prop, 'S12');
}

function buildBenderaStand(m) {
  return groupOf('S08', piece([box(0.3, 0.03, 0.12, '#3e2723', { y: 0.015 })], m.prop, 'alas'), piece(
    [-0.1, 0, 0.1].flatMap((x) => [cyl(0.004, 0.004, 0.55, '#c9b27a', { x, y: 0.305 }), ball(0.01, '#c9b27a', { x, y: 0.585 })]),
    m.metal, 'tiang',
  ));
}

function buildBantal(m, color) {
  return piece([rbox(0.5, 0.1, 0.35, 0.04, color, { y: 0.05 })], m.prop, 'S23', false);
}

function buildStopkontak(m) {
  return piece([
    box(0.3, 0.04, 0.06, '#f5f5f5', { y: 0.02 }),
    ...[-0.1, -0.033, 0.033].map((x) => cyl(0.013, 0.013, 0.004, '#9e9e9e', { x, y: 0.041 })),
    box(0.03, 0.012, 0.02, '#e53935', { x: 0.125, y: 0.046 }),
  ], m.prop, 'S25', false);
}

function buildSaklar(m) {
  return piece([box(0.08, 0.12, 0.012, '#f2f2f2'), box(0.03, 0.05, 0.008, '#e0e0e0', { z: -0.008 })], m.prop, 'S27', false);
}

/** S24: rumah lampu (prop) + tabung TL (material emisif bersama, kedua lampu satu mesh). Koordinat ruang. */
function buildTL(m) {
  const housing = [];
  const tubes = [];
  for (const it of ASET.S24.items) {
    housing.push(box(0.1, 0.05, 1.22, '#f2f2f2', { x: it.x, y: it.y - 0.025, z: it.z }));
    housing.push(box(0.12, 0.01, 1.24, '#e6e6e6', { x: it.x, y: it.y - 0.052, z: it.z }));
    tubes.push(cyl(0.016, 0.016, 1.2, '#ffffff', { x: it.x, y: it.y - 0.075, z: it.z, rx: PI / 2 }));
  }
  return groupOf('S24', piece(housing, m.prop, 'rumah-tl', false), piece(tubes, m.tl, 'tabung-tl', false));
}

/** S25 kabel: dari stopkontak ke stop dinding & ke laptop (koordinat ruang). */
function buildKabel(m) {
  const s = ASET.S25.items[0];
  const w = ASET.S25.stopDinding;
  return groupOf('S25-kabel', piece([
    tube([[s.x, 0.012, s.z], [1.7, 0.012, 0.7], [2.0, 0.012, 0.42], [2.08, 0.05, 0.3], [w.x - 0.01, w.y, w.z]], 0.004, '#1a1a1a'),
    tube([[s.x + 0.05, 0.012, s.z + 0.05], [1.47, 0.02, 1.12], [1.47, 0.5, 1.18], [1.5, 0.76, 1.24], [1.62, 0.77, 1.3]], 0.004, '#1a1a1a'),
    box(0.012, 0.08, 0.08, '#f2f2f2', { x: w.x, y: w.y, z: w.z }),
  ], m.prop, 'kabel', false));
}

/** S29 jendela nako (kusen aluminium, 8 bilah kaca terbuka, teralis luar). Koordinat ruang. */
function buildJendela(m) {
  const it = ASET.S29.items[0];
  const cx = it.x;
  const y0 = it.y;
  const zc = -3.075;
  const AL = '#c9ccd0';
  const frame = [
    box(0.04, 1.2, 0.1, AL, { x: cx - 0.58, y: y0 + 0.6, z: zc }),
    box(0.04, 1.2, 0.1, AL, { x: cx + 0.58, y: y0 + 0.6, z: zc }),
    box(1.2, 0.04, 0.1, AL, { x: cx, y: y0 + 1.18, z: zc }),
    box(1.2, 0.04, 0.1, AL, { x: cx, y: y0 + 0.02, z: zc }),
    box(0.02, 1.12, 0.03, AL, { x: cx - 0.555, y: y0 + 0.6, z: -3.04 }),
    box(0.02, 1.12, 0.03, AL, { x: cx + 0.555, y: y0 + 0.6, z: -3.04 }),
  ];
  for (let k = 0; k < 5; k += 1) frame.push(cyl(0.008, 0.008, 1.2, '#37474f', { x: cx - 0.52 + k * 0.26, y: y0 + 0.6, z: -3.17 }));
  for (const yy of [0.3, 0.9]) frame.push(cyl(0.008, 0.008, 1.16, '#37474f', { x: cx, y: y0 + yy, z: -3.17, rz: PI / 2 }));
  const sill = piece([box(1.3, 0.03, 0.12, '#d9d4c7', { x: cx, y: y0 - 0.015, z: -2.96 })], m.prop, 'ambang');
  const glass = [];
  for (let i = 0; i < 8; i += 1) glass.push(box(1.1, 0.004, 0.155, '#ffffff', { x: cx, y: y0 + 0.075 + i * 0.15, z: -3.05, rx: 0.35 }));
  return groupOf('S29', piece(frame, m.metal, 'kusen'), sill, piece(glass, m.glass, 'bilah-kaca', false));
}

/** S30 pintu kayu + kusen, daun terbuka ke dalam (engsel di DOOR.x0). Koordinat ruang. */
function buildPintu(m) {
  const it = ASET.S30.items[0];
  const WOOD = '#d4d6da';
  const kusen = piece([
    box(0.06, 2.16, 0.17, WOOD, { x: 0.87, y: 1.08, z: -3.075 }),
    box(0.06, 2.16, 0.17, WOOD, { x: 1.83, y: 1.08, z: -3.075 }),
    box(1.02, 0.06, 0.17, WOOD, { x: 1.35, y: 2.13, z: -3.075 }),
  ], m.prop, 'kusen');
  const panel = piece([
    box(0.9, 2.08, 0.04, '#1f3768', { x: 0.45, y: 1.04, z: 0.02 }),
    ...[0.25, 0.65].flatMap((x) => [0.6, 1.5].flatMap((y) => [
      box(0.3, 0.75, 0.008, '#182d58', { x, y, z: 0.042 }),
      box(0.3, 0.75, 0.008, '#182d58', { x, y, z: -0.002 }),
    ])),
  ], m.prop, 'daun');
  const handle = piece([
    cyl(0.01, 0.01, 0.12, '#cfd8dc', { x: 0.8, y: 1.0, z: 0.065, rz: PI / 2 }),
    cyl(0.025, 0.025, 0.01, '#cfd8dc', { x: 0.84, y: 1.0, z: 0.046, rx: PI / 2 }),
    cyl(0.01, 0.01, 0.12, '#cfd8dc', { x: 0.8, y: 1.0, z: -0.025, rz: PI / 2 }),
  ], m.metal, 'gagang');
  const hinge = groupOf('daun-pintu', panel, handle);
  hinge.position.set(it.x, 0, it.z);
  hinge.rotation.y = it.buka;
  return groupOf('S30', kusen, hinge);
}


/** Perlengkapan khas sekre ERC (dari foto): tirai vertikal krem, ventilasi kotak, AC split, boks plastik, bola futsal. */
function buildPerlengkapanErc(m) {
  const it = ASET.S29.items[0];
  const blinds = [];
  for (let k = 0; k < 13; k += 1) blinds.push(box(0.1, 1.55, 0.012, k % 2 ? '#e8e1c9' : '#f1ecda', { x: it.x - 0.66 + k * 0.11, y: it.y + 0.55, z: -2.93 }));
  blinds.push(box(1.5, 0.06, 0.05, '#cfc8b0', { x: it.x, y: it.y + 1.35, z: -2.93 }));
  const vents = [];
  const ventFrames = [];
  for (let k = 0; k < 9; k += 1) {
    vents.push(box(0.15, 0.27, 0.01, '#f4f8ff', { x: -2.0 + k * 0.33, y: 2.78, z: -2.985 }));
    ventFrames.push(box(0.19, 0.31, 0.008, '#c9cdd0', { x: -2.0 + k * 0.33, y: 2.78, z: -2.99 }));
  }
  for (let k = 0; k < 7; k += 1) {
    vents.push(box(0.01, 0.27, 0.15, '#f4f8ff', { x: -2.085, y: 2.78, z: -2.2 + k * 0.4 }));
    ventFrames.push(box(0.008, 0.31, 0.19, '#c9cdd0', { x: -2.09, y: 2.78, z: -2.2 + k * 0.4 }));
  }
  const ac = [
    box(0.22, 0.28, 0.92, '#f2f3f4', { x: 2.0, y: 2.62, z: 1.3 }),
    box(0.02, 0.05, 0.8, '#3a3f45', { x: 1.89, y: 2.55, z: 1.3 }),
    box(0.02, 0.03, 0.9, '#d9dcdf', { x: 1.89, y: 2.7, z: 1.3 }),
  ];
  const bins = [];
  for (const [x, z, r] of [[0.95, -0.4, 0.1], [-0.95, -0.75, -0.25]]) {
    bins.push(box(0.5, 0.3, 0.36, '#d9ecef', { x, y: 0.15, z, ry: r }));
    bins.push(box(0.52, 0.05, 0.38, '#43a047', { x, y: 0.325, z, ry: r }));
    bins.push(box(0.12, 0.03, 0.02, '#f2c230', { x, y: 0.31, z: z - 0.19, ry: r }));
  }
  const ballG = [ball(0.11, '#ef6c1a', { x: -1.7, y: 0.11, z: 0.15 })];
  return groupOf('perlengkapan-erc',
    piece(blinds, m.prop, 'tirai-vertikal', false), piece(vents, m.tl, 'ventilasi-kotak', false),
    piece(ventFrames, m.prop, 'bingkai-ventilasi', false), piece(ac, m.prop, 'ac-split', false),
    piece(bins, m.prop, 'boks-plastik'), piece(ballG, m.prop, 'bola', false));
}

// ---------- Perabot hidup ----------

function buildKertas(m, it, i) {
  const pivot = new THREE.Group();
  pivot.name = `kertas-${i}`;
  pivot.position.set(it.x, it.y, it.z);
  pivot.rotation.y = it.hadap;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.297).rotateX(-PI / 2).translate(0, 0, 0.1485), m.paper);
  sheet.receiveShadow = true;
  pivot.add(sheet);
  return { pivot, dist: Math.hypot(it.x - FAN_POS.x, it.z - FAN_POS.z), phase: i * 1.7 };
}

/**
 * @param {{materials: ReturnType<typeof createSekreMaterials>}} opts
 */
export function buildFurniture({ materials }) {
  const m = materials;
  const staticGroup = new THREE.Group();
  staticGroup.name = 'sekre-perabot';
  const dynamicGroup = new THREE.Group();
  dynamicGroup.name = 'sekre-perabot-dinamis';
  /** id aset → container dinamis (placeholder + GLB). */
  const containers = new Map();
  const addContainer = (id, it, child, k) => {
    const c = new THREE.Group();
    c.name = `${id}-${k}`;
    placed(c, it);
    if (it.skala) c.scale.setScalar(it.skala);
    if (it.miring) c.rotation.set(it.miring, propRy(it.hadap), 0, 'YXZ');
    c.add(child);
    dynamicGroup.add(c);
    containers.set(id, [...(containers.get(id) ?? []), c]);
    return c;
  };

  // statis: posisi dari data.js
  staticGroup.add(placed(buildMeja(m), ASET.S16.items[0]));
  staticGroup.add(placed(buildKursi(m), EKSTRA.kursiLipat));
  staticGroup.add(placed(buildLemari(m), ASET.S09.items[0]));
  staticGroup.add(buildOrdner(m));
  staticGroup.add(placed(buildBenderaStand(m), ASET.S08.items[0]));
  ASET.S11.items.forEach((it) => staticGroup.add(placed(buildKardus(m), it)));
  ASET.S12.items.forEach((it) => {
    const s = placed(buildSpanduk(m), it);
    s.rotation.set(it.miring, propRy(it.hadap), 0, 'YXZ');
    staticGroup.add(s);
  });
  ASET.S18.items.forEach((it) => staticGroup.add(placed(buildGelas(m, it.isi), it)));
  ASET.S21.items.forEach((it) => staticGroup.add(placed(buildSepatu(m, it.warna), it)));
  staticGroup.add(buildKarpet(m, ASET.S22.items[0]));
  ASET.S23.items.forEach((it) => staticGroup.add(placed(buildBantal(m, it.warna), it)));
  staticGroup.add(buildTL(m));
  staticGroup.add(placed(buildStopkontak(m), ASET.S25.items[0]));
  staticGroup.add(buildKabel(m));
  staticGroup.add(placed(buildSaklar(m), ASET.S27.items[0]));
  staticGroup.add(buildJendela(m));
  staticGroup.add(buildPintu(m));
  staticGroup.add(buildPerlengkapanErc(m));

  // dinamis / dapat diganti GLB
  ASET.S07.items.forEach((it, k) => addContainer('S07', it, buildPiala(m), k));
  const dispenser = addContainer('S13', ASET.S13.items[0], buildDispenser(m), 0);
  const kipas = buildKipas(m);
  addContainer('S14', ASET.S14.items[0], kipas.group, 0);
  addContainer('S15', ASET.S15.items[0], buildPrinter(m), 0);
  ASET.S17.items.forEach((it, k) => addContainer('S17', it, buildLaptop(m), k));
  const gitarRest = ASET.S19.items[0];
  const guitar = addContainer('S19', gitarRest, buildGitar(m), 0);
  ASET.S20.items.forEach((it, k) => addContainer('S20', it, buildTas(m, it.warna), k));
  const papers = EKSTRA.kertas.map((it, i) => buildKertas(m, it, i));
  for (const p of papers) dynamicGroup.add(p.pivot);

  // dispenser: gelas + kucuran air + isi (animasi E)
  const pour = { t: -1 };
  const cup = new THREE.Group();
  cup.name = 'gelas-dispenser';
  cup.position.set(0.05, 0.51, -0.2);
  cup.visible = false;
  cup.add(piece([cyl(0.035, 0.03, 0.09, '#f5f5f5', { y: 0.045 })], m.glass, 'gelas', false));
  const fill = new THREE.Mesh(tint(new THREE.CylinderGeometry(0.031, 0.027, 0.085, 12).translate(0, 0.0425, 0), '#ffffff'), m.water);
  fill.scale.y = 0.02;
  const stream = new THREE.Mesh(tint(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6).translate(0, 0.12, 0), '#ffffff'), m.water);
  stream.visible = false;
  cup.add(fill, stream);
  dispenser.add(cup);

  const fan = { on: false, spin: 0, phase: 0, head: kipas.head, blades: kipas.blades };
  let time = 0;

  const restGuitar = () => {
    dynamicGroup.add(guitar);
    guitar.position.set(gitarRest.x, gitarRest.y, gitarRest.z);
    guitar.rotation.set(gitarRest.miring, propRy(gitarRest.hadap), 0, 'YXZ');
  };
  const holdGuitar = (spine) => {
    spine.add(guitar);
    guitar.position.fromArray(GUITAR_HOLD.pos);
    guitar.rotation.set(GUITAR_HOLD.rot[0], GUITAR_HOLD.rot[1], GUITAR_HOLD.rot[2], 'XYZ');
  };

  function bindFanModel(model) {
    let head = null;
    let blades = null;
    model.traverse((o) => {
      if (o.material?.name === 'unri:kipas-kepala') head = o;
      if (o.material?.name === 'unri:kipas-baling') blades = o;
    });
    if (!head || !blades) return;
    blades.geometry.computeBoundingBox();
    const c = blades.geometry.boundingBox.getCenter(new THREE.Vector3());
    blades.geometry.translate(-c.x, -c.y, -c.z);
    blades.position.add(c);
    const pivot = new THREE.Group();
    pivot.name = 'kepala-glb';
    pivot.position.set(0, 1.05, 0);
    model.add(pivot);
    model.updateMatrixWorld(true);
    pivot.attach(head);
    pivot.attach(blades);
    fan.head = pivot;
    fan.blades = blades;
  }

  /** Muat GLB final ke container (harus dipanggil di dalam withScope interior). */
  async function loadModels(isCancelled = () => false) {
    const jobs = [];
    for (const [id, path] of Object.entries(GLB_ASET)) {
      for (const container of containers.get(id) ?? []) {
        jobs.push(instantiateModel(path).then((model) => {
          if (isCancelled()) return;
          container.add(model);
          const ph = container.getObjectByName(`${id}-ph`);
          if (ph) ph.visible = false;
          if (id === 'S14') bindFanModel(model);
          if (id === 'S17') model.traverse((o) => { if (o.material?.name === 'unri:layar-emisif') o.material = m.screen; });
        }));
      }
    }
    const results = await Promise.allSettled(jobs);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length && !isCancelled()) console.warn(`Sekre: ${failed.length} model GLB gagal dimuat, placeholder prosedural dipakai.`, failed[0].reason);
    return { failed: failed.length };
  }

  return {
    staticGroup,
    dynamicGroup,
    containers,
    props: {
      /** Gelas untuk tangan NPC (pose drinkCup). */
      makeCup: () => piece([cyl(0.035, 0.03, 0.09, '#ffffff', { y: -0.045 }), cyl(0.032, 0.032, 0.004, '#5d4037', { y: -0.01 })], m.prop, 'gelas-npc', false),
      /** Spidol untuk tangan NPC (pose writeBoard). */
      makeMarker: () => piece([cyl(0.008, 0.008, 0.12, '#1565c0', { rx: PI / 2 }), cyl(0.009, 0.009, 0.03, '#111111', { z: 0.06, rx: PI / 2 })], m.prop, 'spidol-npc', false),
      holdGuitar,
      restGuitar,
    },
    get fanOn() { return fan.on; },
    toggleFan() {
      fan.on = !fan.on;
      return fan.on;
    },
    /** Mulai animasi isi gelas (≈1,6 s); false bila sedang mengisi. */
    pourWater() {
      if (pour.t >= 0) return false;
      pour.t = 0;
      cup.visible = true;
      fill.scale.y = 0.02;
      return true;
    },
    /** Posisi dunia badan gitar (mengikuti tangan NPC saat dimainkan). */
    guitarWorldPosition(out) {
      guitar.getWorldPosition(TMP_V);
      out.x = TMP_V.x;
      out.y = TMP_V.y + 0.4;
      out.z = TMP_V.z;
      return out;
    },
    update(dt) {
      const d = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
      time += d;
      fan.spin += ((fan.on ? 1 : 0) - fan.spin) * Math.min(1, d * (fan.on ? 0.8 : 0.4));
      if (fan.blades) fan.blades.rotation.z -= fan.spin * 26 * d;
      if (fan.on) fan.phase += d;
      if (fan.head) fan.head.rotation.y = 0.6 * Math.sin(fan.phase * 1.6);
      for (const p of papers) {
        const reach = Math.max(0.15, Math.min(1, 1.2 - p.dist / 4));
        p.pivot.rotation.x = -fan.spin * reach * (0.05 + 0.18 * (0.5 + 0.5 * Math.sin(time * 11 + p.phase)));
      }
      if (pour.t >= 0) {
        pour.t += d;
        stream.visible = pour.t < 1.6;
        fill.scale.y = Math.max(0.02, Math.min(1, pour.t / 1.6)) * 0.85;
        if (pour.t >= 1.6) pour.t = -1;
      }
    },
    loadModels,
    dispose() { restGuitar(); },
  };
}
