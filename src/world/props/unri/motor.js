/**
 * A01 motor bebek & A02 motor matic (parkir padat kampus [T]). Placeholder prosedural berukuran persis
 * katalog (muka/hidung −Z, pusat alas di origin) di-instance; GLB Blender (public/models/unri/*.glb) bila
 * tersedia juga di-instance: setiap mesh GLB → InstancedMesh per material (bukan clone per motor).
 * Warna bodi per instance (material bernama 'unri:bodi' berwarna putih → instanceColor yang mewarnai).
 */
import * as THREE from 'three';
import { instanceParts, colorizeInstances } from '../../siteutil/instanceParts.js';
import { createRandom } from '../../siteutil/rng.js';
import { mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';
import { loadModel } from '../../assets/models.js';
import { boxAt } from './geom.js';

export const MOTOR = Object.freeze({
  bebek: Object.freeze({ id: 'A01', nama: 'motor-bebek', w: 0.7, l: 1.9, h: 1.05, wheelR: 0.29, glb: 'models/unri/a01-motor-bebek.glb', glbLod: 'models/unri/a01-motor-bebek-lod.glb', glbFar: 'models/unri/a01-motor-bebek-far.glb' }),
  matic: Object.freeze({ id: 'A02', nama: 'motor-matic', w: 0.7, l: 1.85, h: 1.1, wheelR: 0.25, glb: 'models/unri/a02-motor-matic.glb', glbLod: 'models/unri/a02-motor-matic-lod.glb', glbFar: 'models/unri/a02-motor-matic-far.glb' }),
});
export const MOTOR_COLORS = Object.freeze([0xc62828, 0x1565c0, 0x212121, 0xeeeeee, 0x6d6d6d, 0x2e7d32, 0xf9a825, 0x8e24aa, 0x37474f, 0xd84315]);

/**
 * true: GLB Blender M7 (assets-src/blender/unri/m7_motor.py) tersedia — `<slug>.glb` (detail, dilihat dari dekat) dan

 * `<slug>-lod.glb` (±1k segitiga) dan `<slug>-far.glb` (±110 segitiga, siluet) untuk parkir padat/jauh. Placeholder prosedural tetap menjadi cadangan bila GLB gagal.
 */
export const MOTOR_GLB_READY = true;

const named = (mat, name) => {
  mat.name = name;
  return mat;
};
const mats = () => currentScope().get('unri:motor:mats', () => ({
  bodi: named(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.1 }), 'unri:bodi'),
  hitam: named(new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.8 }), 'unri:hitam'),
  krom: named(new THREE.MeshStandardMaterial({ color: 0xb0b6ba, roughness: 0.3, metalness: 0.8 }), 'unri:krom'),
  lampu: named(new THREE.MeshStandardMaterial({ color: 0xf4f1e6, roughness: 0.2 }), 'unri:lampu'),
}));

/** Roda (ban + velg) sumbu X di z, jari-jari r. */
const wheel = (r, z) => ({
  ban: new THREE.CylinderGeometry(r, r, 0.09, 12).rotateZ(Math.PI / 2).translate(0, r, z),
  velg: new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.1, 8).rotateZ(Math.PI / 2).translate(0, r, z),
});

function bebekGeometries(s) {
  const wb = s.l / 2 - s.wheelR;
  const [f, b] = [wheel(s.wheelR, -wb), wheel(s.wheelR, wb)];
  return {
    bodi: mergeAll([
      boxAt(0.46, 0.42, 0.06, 0, 0.36, -0.36), // tameng kaki
      boxAt(0.22, 0.12, 0.5, 0, 0.36, -0.08), // lorong tengah (bebek: rangka terbuka)
      boxAt(0.3, 0.26, 0.7, 0, 0.55, 0.3), // bodi belakang
      boxAt(0.28, 0.16, 0.24, 0, 0.82, -0.52), // kepala/batok lampu
      boxAt(0.12, 0.04, 0.4, 0, s.wheelR * 2 + 0.02, -wb), // spakbor depan
      boxAt(0.14, 0.04, 0.32, 0, s.wheelR * 2 + 0.03, wb + 0.04), // spakbor belakang
    ]),
    hitam: mergeAll([
      f.ban, b.ban,
      boxAt(0.28, 0.08, 0.64, 0, 0.81, 0.3), // jok
      boxAt(0.7, 0.03, 0.03, 0, 0.97, -0.5), // stang
      boxAt(0.02, 0.07, 0.02, -0.24, 0.98, -0.5), // tangkai spion kiri
      boxAt(0.02, 0.07, 0.02, 0.24, 0.98, -0.5), // tangkai spion kanan
      boxAt(0.04, 0.5, 0.04, 0.07, s.wheelR, -wb + 0.05), // garpu
      boxAt(0.04, 0.5, 0.04, -0.07, s.wheelR, -wb + 0.05),
      boxAt(0.24, 0.22, 0.3, 0, 0.18, 0.02), // mesin
    ]),
    krom: mergeAll([
      f.velg, b.velg,
      new THREE.CylinderGeometry(0.04, 0.04, 0.6, 10).rotateX(Math.PI / 2).translate(0.17, 0.24, 0.3), // knalpot
    ]),
    lampu: boxAt(0.14, 0.07, 0.03, 0, 0.86, -0.655),
  };
}

function maticGeometries(s) {
  const wb = s.l / 2 - s.wheelR;
  const [f, b] = [wheel(s.wheelR, -wb), wheel(s.wheelR, wb)];
  return {
    bodi: mergeAll([
      boxAt(0.44, 0.5, 0.08, 0, 0.3, -0.42), // apron depan
      boxAt(0.3, 0.06, 0.45, 0, 0.26, -0.05), // dek kaki
      boxAt(0.32, 0.36, 0.78, 0, 0.42, 0.33), // bodi belakang besar
      boxAt(0.3, 0.2, 0.26, 0, 0.84, -0.5), // batok depan
      boxAt(0.12, 0.04, 0.34, 0, s.wheelR * 2 + 0.02, -wb), // spakbor depan
    ]),
    hitam: mergeAll([
      f.ban, b.ban,
      boxAt(0.3, 0.08, 0.66, 0, 0.78, 0.3), // jok
      boxAt(0.7, 0.03, 0.03, 0, 1.02, -0.48), // stang
      boxAt(0.02, 0.08, 0.02, -0.25, 1.02, -0.48), // tangkai spion
      boxAt(0.02, 0.08, 0.02, 0.25, 1.02, -0.48),
      boxAt(0.1, 0.18, 0.6, -0.17, 0.12, 0.35), // CVT kiri
    ]),
    krom: mergeAll([
      f.velg, b.velg,
      new THREE.CylinderGeometry(0.035, 0.035, 0.45, 10).rotateX(Math.PI / 2).translate(0.17, 0.26, 0.45), // knalpot
    ]),
    lampu: boxAt(0.16, 0.07, 0.03, 0, 0.9, -0.645),
  };
}

const placeholderGeos = (kind) => currentScope().get(`unri:motor:${kind}:geo`, () => {
  const s = MOTOR[kind];
  return kind === 'matic' ? maticGeometries(s) : bebekGeometries(s);
});

function colorBodies(group, seed) {
  const rnd = createRandom(seed);
  group.traverse((o) => {
    if (o.isInstancedMesh && /bodi/.test(o.material?.name ?? '')) colorizeInstances(o, MOTOR_COLORS, rnd);
  });
  return group;
}

/**
 * Motor parkir placeholder (instanced; frustum culling per sel `cellSize` m bila > 0; `castShadow` false untuk lot
 * jauh yang padat — hemat pass bayangan).
 * @param {'bebek'|'matic'} kind
 * @param {Array<{x:number, y?:number, z:number, rotY?:number}>} positions
 */
export function createMotorPlaceholders(kind, positions = [], { seed = 19, cellSize = 0, castShadow = true } = {}) {
  const g = placeholderGeos(kind);
  const m = mats();
  const parts = [
    { geometry: g.bodi, material: m.bodi, castShadow, name: `${MOTOR[kind].id}-bodi` },
    { geometry: g.hitam, material: m.hitam, castShadow, name: `${MOTOR[kind].id}-hitam` },
    { geometry: g.krom, material: m.krom, name: `${MOTOR[kind].id}-krom` },
    { geometry: g.lampu, material: m.lampu, name: `${MOTOR[kind].id}-lampu` },
  ];
  const group = instanceParts(parts, positions, `${MOTOR[kind].id}-${MOTOR[kind].nama}`, { cellSize });
  return colorBodies(group, seed);
}

/**
 * Motor dari GLB Blender, di-instance. Panggil DI DALAM withScope(scope) (loadModel memakai currentScope()
 * secara sinkron). null bila GLB gagal/dibatalkan (pemanggil mempertahankan placeholder). `variant` = 'hi' (detail, bayangan) | 'lo' | 'far'
 * (lot padat; tanpa bayangan).
 */
export function loadMotorInstances(kind, positions, { seed = 19, cellSize = 0, variant = 'hi', isCancelled = () => false, logger = console } = {}) {
  const spec = MOTOR[kind];
  const path = { hi: spec.glb, lo: spec.glbLod, far: spec.glbFar }[variant] ?? spec.glb;
  return loadModel(path).then((source) => {
    if (isCancelled()) return null;
    source.updateMatrixWorld(true);
    const parts = [];
    source.traverse((o) => {
      if (!o.isMesh) return;
      parts.push({ geometry: o.geometry.clone().applyMatrix4(o.matrixWorld), material: o.material, castShadow: variant === 'hi', name: o.material.name });
    });
    if (!parts.length) return null;
    return colorBodies(instanceParts(parts, positions, `${spec.id}-${spec.nama}-${variant}`, { cellSize }), seed);
  }, (err) => {
    logger.warn(`Model ${spec.id} (${path}) gagal dimuat, placeholder dipakai:`, err?.message ?? err);
    return null;
  });
}
