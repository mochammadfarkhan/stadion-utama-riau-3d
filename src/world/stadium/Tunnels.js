/**
 * Terowongan kendaraan di gate utama (underpass bus tim): lorong beton lurus
 * dari depan cangkang (k = kStart) menembus tribun bawah sampai apron lintasan (k = kEnd).
 * Lantai aspal, dinding samping, pelat langit-langit, lampu TL, rambu, garis kuning tepi.
 * Potongan undakan/kursi dilakukan di modul Tribune.* lewat tunnelLayout.js.
 */
import * as THREE from 'three';
import { COLORS } from '../../config/constants.js';
import { Materials } from '../materials.js';
import { GATES } from './gateLayout.js';
import { createCanvasTexture, mergeFlat } from './ovalMath.js';
import { TUNNEL, corridorLine } from './tunnelLayout.js';

const LAMP_SPACING = 6;
const LAMP_SIZE = Object.freeze({ w: 0.12, h: 0.06, len: 1.2 });
const LINE_W = 0.12;
const LINE_INSET = 0.3;          // garis kuning dari kaki dinding
const SIGN_SIZE = Object.freeze({ w: 2.0, h: 0.6 });
const SIGN_DROP = 0.5;           // pusat rambu di bawah langit-langit
const SIGN_INSET = 0.6;          // jarak rambu dari mulut terowongan
const COLOR_YELLOW = 0xf2c100;
const COLOR_LAMP = 0xfff7d6;
const SIGNS = Object.freeze([
  { text: 'MASUK', color: 0x1d4e89, atInner: false }, // dilihat dari plaza
  { text: 'KELUAR', color: 0x1f7a3a, atInner: true }, // dilihat dari apron
]);

/** Dimensi lokal lorong: lebar total, panjang, posisi awal/arah dunia. */
function corridorFrame(corr) {
  const length = corr.len * (TUNNEL.kEnd - TUNNEL.kStart);
  const fx = corr.dx / corr.len;
  const fz = corr.dz / corr.len;
  return Object.freeze({
    length,
    startX: corr.ox + corr.dx * TUNNEL.kStart,
    startZ: corr.oz + corr.dz * TUNNEL.kStart,
    yaw: Math.atan2(fx, fz),
    fx, fz,
  });
}

/** Dinding kiri/kanan + pelat langit-langit (satu geometri beton). */
function concreteGeometry(length) {
  const wallH = TUNNEL.clearance + TUNNEL.slabT;
  const wallX = TUNNEL.halfWidth + TUNNEL.wallT / 2;
  const walls = [-1, 1].map((s) => new THREE.BoxGeometry(TUNNEL.wallT, wallH, length)
    .translate(s * wallX, wallH / 2, length / 2));
  const slab = new THREE.BoxGeometry(TUNNEL.halfWidth * 2, TUNNEL.slabT, length)
    .translate(0, TUNNEL.clearance + TUNNEL.slabT / 2, length / 2);
  return mergeFlat([...walls, slab]);
}

function floorMesh(length) {
  const g = new THREE.PlaneGeometry(TUNNEL.halfWidth * 2, length);
  g.rotateX(-Math.PI / 2);
  g.translate(0, TUNNEL.floorLift, length / 2);
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: COLORS.asphalt }));
  mesh.name = 'lantai';
  mesh.receiveShadow = true;
  return mesh;
}

/** Garis kuning tepi kiri/kanan di atas aspal. */
function edgeLinesMesh(length) {
  const x = TUNNEL.halfWidth - LINE_INSET;
  const lines = [-1, 1].map((s) => new THREE.BoxGeometry(LINE_W, 0.01, length)
    .translate(s * x, TUNNEL.floorLift + 0.01, length / 2));
  const mesh = new THREE.Mesh(mergeFlat(lines), new THREE.MeshLambertMaterial({ color: COLOR_YELLOW }));
  mesh.name = 'garisTepi';
  return mesh;
}

/** Lampu TL emissive di langit-langit tiap LAMP_SPACING meter. */
function lampsMesh(length) {
  const count = Math.max(1, Math.floor(length / LAMP_SPACING));
  const y = TUNNEL.clearance - LAMP_SIZE.h / 2;
  const lamps = Array.from({ length: count }, (_, i) =>
    new THREE.BoxGeometry(LAMP_SIZE.len, LAMP_SIZE.h, LAMP_SIZE.w)
      .translate(0, y, (i + 0.5) * LAMP_SPACING));
  const mat = new THREE.MeshLambertMaterial({ color: COLOR_LAMP, emissive: COLOR_LAMP, emissiveIntensity: 0.9 });
  const mesh = new THREE.Mesh(mergeFlat(lamps), mat);
  mesh.name = 'lampuTL';
  mesh.userData.lampCount = count;
  return mesh;
}

/** Material rambu: tekstur teks bila ada canvas, kalau tidak plane warna polos. */
function signMaterial(sign) {
  const map = createCanvasTexture(256, 80, (ctx, w, h) => {
    ctx.fillStyle = `#${sign.color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sign.text, w / 2, h / 2);
  });
  return map
    ? new THREE.MeshBasicMaterial({ map })
    : new THREE.MeshBasicMaterial({ color: sign.color });
}

/** Rambu kecil menggantung di bawah langit-langit dekat mulut terowongan. */
function signMesh(sign, length) {
  const g = new THREE.PlaneGeometry(SIGN_SIZE.w, SIGN_SIZE.h);
  g.rotateY(Math.PI); // menghadap −Z lokal: dibaca oleh yang bergerak searah +Z (masuk) / dari dalam terowongan (keluar)
  g.translate(0, TUNNEL.clearance - SIGN_DROP, sign.atInner ? length - SIGN_INSET : SIGN_INSET);
  const mesh = new THREE.Mesh(g, signMaterial(sign));
  mesh.name = `rambu${sign.text}`;
  return mesh;
}

/** Satu terowongan untuk satu gate utama; +Z lokal = arah masuk ke dalam stadion. */
function createTunnel(gate) {
  const corr = corridorLine(gate);
  const frame = corridorFrame(corr);
  const group = new THREE.Group();
  group.name = `terowongan${gate.name ?? gate.id}`;
  const concrete = new THREE.Mesh(concreteGeometry(frame.length), Materials.concrete());
  concrete.name = 'betonTerowongan';
  concrete.castShadow = true;
  concrete.receiveShadow = true;
  group.add(concrete, floorMesh(frame.length), edgeLinesMesh(frame.length), lampsMesh(frame.length));
  SIGNS.forEach((sign) => group.add(signMesh(sign, frame.length)));
  group.position.set(frame.startX, 0, frame.startZ);
  group.rotation.y = frame.yaw;
  group.userData.tunnel = Object.freeze({
    gateId: gate.id, name: gate.name, length: frame.length,
    halfWidth: TUNNEL.halfWidth, clearance: TUNNEL.clearance,
    start: { x: frame.startX, z: frame.startZ },
    end: { x: frame.startX + frame.fx * frame.length, z: frame.startZ + frame.fz * frame.length },
  });
  return group;
}

/**
 * Semua terowongan kendaraan gate utama.
 * @param {{gates?: ReadonlyArray<{id:number,u:number,main:boolean,name:string|null}>}} opts
 * @returns {THREE.Group} group 'terowongan' berisi satu sub-group per gate (userData.tunnel)
 */
export function createTunnels({ gates = GATES.filter((g) => g.main) } = {}) {
  const group = new THREE.Group();
  group.name = 'terowongan';
  gates.forEach((gate) => group.add(createTunnel(gate)));
  group.userData.tunnels = group.children.map((c) => c.userData.tunnel);
  return group;
}
