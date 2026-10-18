/**
 * Bagian kanonik sekretariat (MUKA DEPAN −Z, sumbu dinding di z = 0, alas y = 0), ditempatkan dengan
 * placeGeos({x, y, z, rotY}). Keluaran = daftar geometri per material (digabung mergeByMaterial).
 * [INFERENSI pola kampus negeri 1980–2000-an, riset §4]: jendela nako aluminium 2 kolom bilah kaca,
 * pintu panel kayu bercat, roster beton di atas jendela, lampu bohlam di plafon selasar.
 */
import * as THREE from 'three';
import { boxAt, paint, facePlane } from '../../world/props/unri/geom.js';
import { ROSTER_M } from './sekretariat.textures.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);

/** Terapkan transform {x, y, z, rotY} ke setiap geometri (dimutasi) dan kembalikan daftar yang sama. */
export function placeGeos(geos, { x = 0, y = 0, z = 0, rotY = 0 }) {
  _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_up, rotY), _s);
  for (const g of geos) g.applyMatrix4(_m);
  return geos;
}

/** Jendela nako: bingkai aluminium, 2 kolom bilah kaca miring (atas ke luar), latar ruang gelap di dalam. */
export function nakoWindow(w = 1.2, h = 1.15, { tilt = 0.3, darkDepth = 0.12 } = {}) {
  const frame = [
    boxAt(w, 0.04, 0.06, 0, 0, 0), boxAt(w, 0.04, 0.06, 0, h - 0.04, 0),
    boxAt(0.04, h, 0.06, -(w / 2 - 0.02), 0, 0), boxAt(0.04, h, 0.06, w / 2 - 0.02, 0, 0),
    boxAt(0.03, h, 0.05, 0, 0, 0),
  ];
  const slatW = w / 2 - 0.06;
  const n = Math.floor((h - 0.08) / 0.13);
  const glass = [];
  for (const cx of [-w / 4, w / 4]) {
    for (let k = 0; k < n; k += 1) glass.push(new THREE.BoxGeometry(slatW, 0.12, 0.005).rotateX(-tilt).translate(cx, 0.105 + k * 0.13, 0));
  }
  return { frame, glass, dark: [boxAt(w - 0.06, h - 0.06, 0.01, 0, 0.03, darkDepth)] };
}

/** Ambang jendela luar (putih) sedikit menonjol. */
export const windowSill = (w = 1.2) => [boxAt(w + 0.1, 0.04, 0.08, 0, -0.04, -0.06)];

/**
 * Pintu panel kayu bercat (warna per ormawa, vertexColors) + kusen + gagang + stiker.
 * stickers: [{cell, x, y, size}] koordinat muka daun pintu.
 */
export function panelDoor({ w = 0.9, h = 2.1, color, stickers = [], depth = 0.17 }) {
  const shade = new THREE.Color(color).multiplyScalar(0.8).getHex();
  return {
    leaf: [
      paint(boxAt(w - 0.1, h - 0.06, 0.04, 0, 0.01, 0.02), color),
      paint(boxAt(0.6, 0.72, 0.012, 0, 0.28, 0.004), shade),
      paint(boxAt(0.6, 0.72, 0.012, 0, 1.12, 0.004), shade),
    ],
    kusen: [boxAt(0.05, h, depth, -(w / 2 - 0.025), 0, 0), boxAt(0.05, h, depth, w / 2 - 0.025, 0, 0), boxAt(w, 0.05, depth, 0, h - 0.05, 0)],
    handle: [boxAt(0.12, 0.025, 0.03, w / 2 - 0.17, 1.0, -0.015), boxAt(0.05, 0.1, 0.01, w / 2 - 0.13, 0.96, -0.005)],
    decals: stickers.map(({ cell, x, y, size }) => facePlane(size, size, { x, y, z: -0.008, cell })),
  };
}

/** Bidang roster (blok 20 cm, UV dalam satuan blok), muka −Z, alas y = 0. */
export function rosterPlane(w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, (uv.getX(i) * w) / ROSTER_M, (uv.getY(i) * h) / ROSTER_M);
  return g.rotateY(Math.PI).translate(0, h / 2, 0);
}

/** Lampu bohlam plafon: dudukan (putih) + bohlam emisif, digantung di bawah y. */
export function ceilingLamp(bx, y, bz) {
  return {
    putih: [new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12).translate(bx, y - 0.015, bz)],
    lampu: [new THREE.SphereGeometry(0.055, 10, 8).translate(bx, y - 0.08, bz)],
  };
}

/** Lampu dinding di balok ambang mulut selasar: siku + bohlam. sz = ±1 (ujung). */
export function lintelLamp(bz, y, sz) {
  return {
    putih: [boxAt(0.06, 0.06, 0.14, 0, y + 0.02, bz - sz * 0.05)],
    lampu: [new THREE.SphereGeometry(0.06, 10, 8).translate(0, y - 0.03, bz)],
  };
}

/** Kolam cahaya lantai (aditif emisif) di bawah lampu. */
export const floorPool = (bx, y, bz, size) => new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2).translate(bx, y, bz);
