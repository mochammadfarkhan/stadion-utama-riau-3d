/** Alat bentuk bersama perabot sekre: potongan geometri berwarna (koordinat lokal aset) digabung jadi satu Mesh per material. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tint } from '../canvas.js';

export const PI = Math.PI;
export const propRy = (hadap) => hadap + PI;
export const TMP_M = new THREE.Matrix4();
export const TMP_E = new THREE.Euler();
export const TMP_V = new THREE.Vector3();

export function shaped(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  if (rx || ry || rz) geo.applyMatrix4(TMP_M.makeRotationFromEuler(TMP_E.set(rx, ry, rz)));
  return tint(geo.translate(x, y, z), color);
}
export const box = (w, h, d, color, t) => shaped(new THREE.BoxGeometry(w, h, d), color, t);
export const rbox = (w, h, d, r, color, t) => shaped(new RoundedBoxGeometry(w, h, d, 2, r), color, t);
export const cyl = (rt, rb, h, color, t, seg = 14) => shaped(new THREE.CylinderGeometry(rt, rb, h, seg), color, t);
export const torus = (r, tube, color, t) => shaped(new THREE.TorusGeometry(r, tube, 6, 24), color, t);
export const ball = (r, color, t) => shaped(new THREE.SphereGeometry(r, 10, 8), color, t);
export const tube = (points, r, color) => tint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), 48, r, 6), color);

/**
 * Satu Mesh dari potongan berwarna (atribut identik: posisi, normal, uv, warna). RoundedBoxGeometry tidak
 * ber-indeks sedangkan Box/Cylinder ber-indeks → semua disamakan non-indexed sebelum digabung.
 */
export function piece(geos, material, name = '', castShadow = true) {
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const geo = mergeGeometries(flat, false);
  for (const g of new Set([...geos, ...flat])) g.dispose();
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  m.castShadow = castShadow;
  m.receiveShadow = true;
  return m;
}

export function placed(obj, it, ry = propRy(it.hadap)) {
  obj.position.set(it.x, it.y, it.z);
  obj.rotation.y = ry;
  return obj;
}

export function groupOf(name, ...children) {
  const g = new THREE.Group();
  g.name = name;
  g.add(...children);
  return g;
}
