/**
 * Properti interior kecil untuk Fixtures.js: patung serindit, tunnel pemain,
 * papan jadwal, tempat sampah concourse, kios concourse.
 */
import * as THREE from 'three';
import { STADIUM, COLORS } from '../../config/constants.js';
import {
  createEllipseArcTable, ellipseAngleAtArc, ellipsePoint, mergeFlat, createCanvasTexture, createDataTexture,
} from './ovalMath.js';

const STATUE_POS = Object.freeze({ x: 22, z: -(STADIUM.innerSemiZ - 8) }); // di samping mulut terowongan utara
const COLOR_SERINDIT = 0x2e8b3d;
const COLOR_GOLD = 0xd4af37;
const COLOR_BEAK = 0xe8711c;
const COLOR_FLAME = 0xff7a1a;
const TUNNEL_W = 3.2;
const TUNNEL_H = 3.0;
const TUNNEL_DEPTH = 6;
const CONCOURSE_OFFSET = STADIUM.lowerRows * STADIUM.rowDepth; // tepi dalam concourse
const CONCOURSE_Y = STADIUM.lowerRows * STADIUM.rowRise;
const BIN_SPACING = 15;
const KIOSK_COUNT = 8;
const KIOSK_SIZE = Object.freeze({ w: 4, h: 2.4, d: 2.2 });

/** Patung burung serindit (hijau) memegang cawan obor emas, sisi utara. */
export function createSerinditStatue() {
  const group = new THREE.Group();
  group.name = 'patungSerindit';
  group.position.set(STATUE_POS.x, 0, STATUE_POS.z);
  const pedestal = new THREE.CylinderGeometry(1.6, 1.9, 1.4, 24).translate(0, 0.7, 0);
  group.add(new THREE.Mesh(pedestal, new THREE.MeshLambertMaterial({ color: COLORS.concrete })));
  const body = new THREE.SphereGeometry(0.9, 20, 14).scale(1, 0.95, 1.35).translate(0, 2.6, 0);
  const head = new THREE.SphereGeometry(0.5, 16, 12).translate(0, 3.6, 0.9);
  const tail = new THREE.ConeGeometry(0.35, 1.6, 10).rotateX(-Math.PI / 2 - 0.5).translate(0, 2.4, -1.5);
  const wings = [-1, 1].map((s) => new THREE.SphereGeometry(0.55, 12, 10).scale(0.5, 1.1, 1.6)
    .rotateZ(s * 0.7).translate(s * 0.9, 2.9, 0.1));
  const legs = [-1, 1].map((s) => new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6).translate(s * 0.35, 1.9, 0.2));
  group.add(new THREE.Mesh(mergeFlat([body, head, tail, ...wings, ...legs]), new THREE.MeshLambertMaterial({ color: COLOR_SERINDIT })));
  const beak = new THREE.ConeGeometry(0.12, 0.45, 8).rotateX(Math.PI / 2).translate(0, 3.55, 1.55);
  group.add(new THREE.Mesh(beak, new THREE.MeshLambertMaterial({ color: COLOR_BEAK })));
  const bowl = new THREE.CylinderGeometry(0.7, 0.4, 0.5, 20, 1, true).translate(0, 3.1, 1.9);
  const stem = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8).translate(0, 2.4, 1.9);
  group.add(new THREE.Mesh(mergeFlat([bowl, stem]), new THREE.MeshLambertMaterial({ color: COLOR_GOLD, side: THREE.DoubleSide })));
  const flame = new THREE.ConeGeometry(0.4, 1.0, 10).translate(0, 3.8, 1.9);
  group.add(new THREE.Mesh(flame, new THREE.MeshBasicMaterial({ color: COLOR_FLAME })));
  return group;
}

/** Tunnel pemain sisi barat: bukaan gelap menembus tribun + kanopi akrilik. */
export function createPlayerTunnel() {
  const group = new THREE.Group();
  group.name = 'tunnelPemain';
  const x0 = -STADIUM.innerSemiX;
  const hole = new THREE.BoxGeometry(TUNNEL_DEPTH, TUNNEL_H, TUNNEL_W).translate(x0 - TUNNEL_DEPTH / 2 + 0.5, TUNNEL_H / 2, 0);
  group.add(new THREE.Mesh(hole, new THREE.MeshBasicMaterial({ color: 0x0a0a0a })));
  const frame = new THREE.BoxGeometry(0.3, TUNNEL_H + 0.6, TUNNEL_W + 0.6).translate(x0 + 0.55, (TUNNEL_H + 0.6) / 2, 0);
  group.add(new THREE.Mesh(frame, new THREE.MeshLambertMaterial({ color: 0x3a3f45 })));
  const canopy = new THREE.BoxGeometry(5, 0.12, TUNNEL_W + 1.5).translate(x0 + 3.2, TUNNEL_H + 0.4, 0);
  group.add(new THREE.Mesh(canopy, new THREE.MeshLambertMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.4, depthWrite: false })));
  const posts = [-1, 1].map((s) => new THREE.CylinderGeometry(0.05, 0.05, TUNNEL_H + 0.4, 8)
    .translate(x0 + 5.5, (TUNNEL_H + 0.4) / 2, (s * (TUNNEL_W + 1.3)) / 2));
  group.add(new THREE.Mesh(mergeFlat(posts), new THREE.MeshLambertMaterial({ color: 0x888888 })));
  return group;
}

/** Papan jadwal pertandingan di dekat tunnel (CanvasTexture; fallback putih). */
export function createScheduleBoard() {
  const group = new THREE.Group();
  group.name = 'papanJadwal';
  const tex = createCanvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f4f4f0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d4e89';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JADWAL PERTANDINGAN', w / 2, 56);
    ctx.fillStyle = '#222';
    ctx.font = '28px sans-serif';
    ['Sabtu 15.30  RIAU vs TAMU', 'Minggu 19.00  FINAL ATLETIK', 'Senin 08.00  LATIHAN'].forEach((t, i) => ctx.fillText(t, w / 2, 120 + i * 48));
  });
  const mat = tex ? new THREE.MeshLambertMaterial({ map: tex }) : new THREE.MeshLambertMaterial({ color: 0xf4f4f0 });
  const panel = new THREE.PlaneGeometry(2.4, 1.2).rotateY(Math.PI / 2);
  const mesh = new THREE.Mesh(panel, mat);
  mesh.position.set(-STADIUM.innerSemiX + 1.2, 1.9, 6);
  const stand = new THREE.BoxGeometry(0.1, 1.3, 2.6).translate(-STADIUM.innerSemiX + 1.1, 1.9, 6);
  const legs = new THREE.BoxGeometry(0.08, 1.3, 0.08).translate(-STADIUM.innerSemiX + 1.1, 0.65, 6);
  group.add(mesh, new THREE.Mesh(mergeFlat([stand, legs]), new THREE.MeshLambertMaterial({ color: 0x3a3f45 })));
  return group;
}

/** Tempat sampah instanced di sepanjang concourse (tiap 15 m). */
export function createTrashBins() {
  const a = STADIUM.innerSemiX + CONCOURSE_OFFSET + 0.8;
  const b = STADIUM.innerSemiZ + CONCOURSE_OFFSET + 0.8;
  const table = createEllipseArcTable(a, b);
  const n = Math.floor(table.total / BIN_SPACING);
  const geom = new THREE.CylinderGeometry(0.28, 0.25, 0.85, 10).translate(0, 0.425, 0);
  const inst = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial({ color: 0x1f5a2a }), n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const p = ellipsePoint(a, b, ellipseAngleAtArc(table, (i + 0.5) * BIN_SPACING));
    inst.setMatrixAt(i, m.makeTranslation(p.x, CONCOURSE_Y, p.z));
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.computeBoundingSphere();
  inst.name = 'tempatSampah';
  return inst;
}

/** Tekstur rolling door bergaris horizontal (DataTexture, aman di Node). */
function rollingDoorTexture() {
  return createDataTexture(4, 32, (_x, y) => (y % 4 === 0 ? [120, 120, 120] : [175, 175, 175]));
}

/** Kios concourse kosong: box + rolling door menghadap lapangan (2 draw call). */
export function createKiosks() {
  const group = new THREE.Group();
  group.name = 'kios';
  const offset = CONCOURSE_OFFSET + 4 - KIOSK_SIZE.d / 2 - 0.4;
  const a = STADIUM.innerSemiX + offset;
  const b = STADIUM.innerSemiZ + offset;
  const dummy = new THREE.Object3D();
  const boxes = [];
  const doors = [];
  for (let i = 0; i < KIOSK_COUNT; i++) {
    const theta = ((i + 0.5) / KIOSK_COUNT) * Math.PI * 2 + Math.PI / 16;
    const p = ellipsePoint(a, b, theta);
    dummy.position.set(p.x, CONCOURSE_Y, p.z);
    dummy.lookAt(0, CONCOURSE_Y, 0);
    dummy.updateMatrix();
    boxes.push(new THREE.BoxGeometry(KIOSK_SIZE.w, KIOSK_SIZE.h, KIOSK_SIZE.d).translate(0, KIOSK_SIZE.h / 2, 0).applyMatrix4(dummy.matrix));
    doors.push(new THREE.PlaneGeometry(KIOSK_SIZE.w - 1, KIOSK_SIZE.h - 0.4).translate(0, KIOSK_SIZE.h / 2 - 0.1, KIOSK_SIZE.d / 2 + 0.01).applyMatrix4(dummy.matrix));
  }
  group.add(new THREE.Mesh(mergeFlat(boxes), new THREE.MeshLambertMaterial({ color: 0xcfcac0 })));
  group.add(new THREE.Mesh(mergeFlat(doors), new THREE.MeshLambertMaterial({ map: rollingDoorTexture() })));
  return group;
}
