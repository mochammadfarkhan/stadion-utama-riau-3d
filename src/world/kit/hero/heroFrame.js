// src/world/kit/hero/heroFrame.js
/**
 * Utilitas hero building (M6): bingkai lokal→dunia yang menghasilkan PartList ({geometry, material,
 * matrix, castShadow, name}; matriks DUNIA, kontrak spec §4.6), cache material/geometri di ResourceScope
 * aktif (kunci 'hero:…': pembangunan ulang klaster memakai ulang sumber daya, scope pemilik yang melepas),
 * dan permukaan tanah yang mengikuti ctx.groundY bila tersedia (cadangan: datar di tanah pad).
 */
import * as THREE from 'three';
import { currentScope } from '../../../engine/ResourceScope.js';

const UP = new THREE.Vector3(0, 1, 0);
const MAP_KEYS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'alphaMap'];
/** Plint kit (spec §7.2 butir 2): baseY = median tanah + 0,15 m. */
export const PLINTH = 0.15;

/** Lepas material beserta teksturnya (default ResourceScope hanya melepas material). */
export function disposeMaterialDeep(mat) {
  for (const key of MAP_KEYS) mat[key]?.dispose?.();
  mat.dispose();
}

/** Material hero ber-cache per kunci (scope aktif; ruang kunci terpisah dari geometri). */
export const heroMaterial = (key, make) => currentScope().get(`hero:mat:${key}`, make, { dispose: disposeMaterialDeep });

/** Geometri hero ber-cache per kunci (scope aktif). */
export const heroGeometry = (key, make) => currentScope().get(`hero:geo:${key}`, make);

/** Beri nama material (dibaca registry malam/basah & alat debug). */
export function named(mat, name) {
  mat.name = name;
  return mat;
}

/** Matrix4 lokal: translasi, rotasi Euler 'YXZ' (Z lebih dulu, lalu X, lalu Y), skala. */
export function local(x = 0, y = 0, z = 0, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    new THREE.Vector3(sx, sy, sz),
  );
}

/** Kotak satuan beralas y = 0 (diskalakan matriks; hanya untuk material TANPA tekstur). */
const unitBox = () => heroGeometry('kotakSatuan', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
/** Silinder satuan (r 1, tinggi 1) beralas y = 0. */
const unitCylinder = (seg) => heroGeometry(`silinderSatuan:${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg).translate(0, 0.5, 0));

/** Tinggi alas hero (dunia, = tanah pad + PLINTH): min baseY massa plan → ctx.groundY → PLINTH. */
export function heroBaseY(plan, ctx, site) {
  const ys = (plan?.masses ?? []).map((m) => m?.baseY).filter(Number.isFinite);
  if (ys.length) return Math.min(...ys);
  if (typeof ctx?.groundY === 'function') return ctx.groundY(site.x, site.z) + PLINTH;
  return PLINTH;
}

/**
 * Bingkai hero: origin dunia (x, y, z) + yaw (konvensi Object3D.rotation.y = regionTransform.toWorld).
 * `origin` ({x, z}) opsional dikurangkan dari translasi bila klaster M3 memakai koordinat relatif.
 */
export function createHeroFrame({ x, z, yaw = 0, y = 0, origin = null }) {
  const base = new THREE.Matrix4().compose(
    new THREE.Vector3(x - (origin?.x ?? 0), y, z - (origin?.z ?? 0)),
    new THREE.Quaternion().setFromAxisAngle(UP, yaw),
    new THREE.Vector3(1, 1, 1),
  );
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const parts = [];
  const add = (geometry, material, matrix = null, { castShadow = true, name = '' } = {}) => {
    parts.push({ geometry, material, matrix: matrix ? base.clone().multiply(matrix) : base.clone(), castShadow, name });
  };
  return {
    parts,
    y,
    add,
    /** Lokal → dunia {x, z} (tanpa pengurangan origin; untuk sampel ctx.groundY). */
    toWorld: (lx, lz) => ({ x: x + c * lx + s * lz, z: z - s * lx + c * lz }),
    /** Kotak [x0,x1]×[y0,y1]×[z0,z1] lokal; `ry` memutar terhadap pusat alas (rentang = ukuran sebelum diputar). */
    box(material, [x0, x1], [y0, y1], [z0, z1], { ry = 0, castShadow = true, name = '' } = {}) {
      add(unitBox(), material, local((x0 + x1) / 2, y0, (z0 + z1) / 2, { ry, sx: x1 - x0, sy: y1 - y0, sz: z1 - z0 }), { castShadow, name });
    },
    /** Silinder tegak beralas y0. */
    cylinder(material, { x: cx = 0, z: cz = 0, y0 = 0, h, r, seg = 12 }, { castShadow = true, name = '' } = {}) {
      add(unitCylinder(seg), material, local(cx, y0, cz, { sx: r, sy: h, sz: r }), { castShadow, name });
    },
  };
}

/** Penanda tinggi tanah di pusat bingkai: kunci cache berubah bila terrain termuat belakangan. */
export function groundStamp(frame, groundY) {
  if (typeof groundY !== 'function') return 'datar';
  const w = frame.toWorld(0, 0);
  return String(Math.round(groundY(w.x, w.z) * 100));
}

/** Letakkan vertex (bidang XZ lokal) di tanah: y = groundY(dunia) − frame.y + lift; UV = meter lokal. */
function settle(geometry, frame, { groundY, lift }) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const w = frame.toWorld(lx, lz);
    pos.setY(i, (typeof groundY === 'function' ? groundY(w.x, w.z) - frame.y : 0) + lift);
    uv?.setXY(i, lx, lz);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Permukaan persegi lokal [x0,x1]×[z0,z1] (grid `step` m) yang mengikuti tanah. */
export function groundGrid(key, frame, { x0, x1, z0, z1, step = 2, lift = 0.05, groundY = null }) {
  return heroGeometry(`tanah:${key}:${groundStamp(frame, groundY)}`, () => {
    const nx = Math.max(1, Math.ceil((x1 - x0) / step));
    const nz = Math.max(1, Math.ceil((z1 - z0) / step));
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    return settle(g, frame, { groundY, lift });
  });
}

/** Cakram lokal berpusat (0, 0) radius r (cincin konsentris) yang mengikuti tanah. */
export function groundDisc(key, frame, { r, seg = 48, rings = 8, lift = 0.04, groundY = null }) {
  return heroGeometry(`tanah:${key}:${groundStamp(frame, groundY)}`, () => settle(new THREE.RingGeometry(0.01, r, seg, rings).rotateX(-Math.PI / 2), frame, { groundY, lift }));
}
