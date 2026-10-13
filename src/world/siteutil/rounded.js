import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Helper bentuk "cozy stylized": balok bertepi membulat (di-cache per dimensi)
 * dan gumpalan bola low-poly yang digabung jadi satu BufferGeometry (tajuk
 * pohon, semak, tanaman pot). Semua geometri memiliki atribut position/normal/uv
 * sehingga kompatibel dengan mergeGeometries & mergeByMaterial.
 */
const BLOB_SEGMENTS = Object.freeze({ width: 8, height: 6 });
const boxCache = new Map();

/** Radius sudut aman: tidak melebihi separuh sisi terpendek. */
function safeRadius(w, h, d, r) {
  return Math.min(r, w / 2, h / 2, d / 2);
}

/**
 * Balok bertepi membulat; instance geometri dibagikan untuk dimensi yang sama.
 * @param {number} w lebar (X)  @param {number} h tinggi (Y)  @param {number} d dalam (Z)
 * @param {number} r radius sudut (0.03–0.08 untuk props kecil)
 * @param {number} seg segmen per sudut (2 cukup untuk low-poly)
 */
export function roundedBox(w, h, d, r = 0.05, seg = 2) {
  const radius = safeRadius(w, h, d, r);
  const key = [w, h, d, radius, seg].map((v) => Number(v).toFixed(4)).join('|');
  // RoundedBoxGeometry non-indexed; diubah ke indexed (mergeVertices) agar bisa digabung dengan geometri primitif lain
  if (!boxCache.has(key)) boxCache.set(key, mergeVertices(new RoundedBoxGeometry(w, h, d, seg, radius)));
  return boxCache.get(key);
}

/** Satu bola low-poly yang sudah dipindah & diskala (y bisa dipipihkan). */
function blob(x, y, z, r, flat = 1) {
  return new THREE.SphereGeometry(r, BLOB_SEGMENTS.width, BLOB_SEGMENTS.height).scale(1, flat, 1).translate(x, y, z);
}

/**
 * Gabungan N bola yang saling tumpang tindih di sekitar pusat (cx, cy, cz).
 * Offset acak deterministik dari rnd (createRandom) agar hasil stabil per jenis.
 * @param {{count:number, radius:number, spread:number, flat?:number, center?:number[], vertical?:number}} spec
 * @param {{range:Function}} rnd
 */
export function blobCluster(spec, rnd) {
  const { count, radius, spread, flat = 1, center = [0, 0, 0], vertical = spread * 0.5 } = spec;
  const [cx, cy, cz] = center;
  const geos = [blob(cx, cy, cz, radius, flat)]; // bola pusat terbesar
  for (let i = 1; i < count; i += 1) {
    const a = rnd.range(0, Math.PI * 2);
    const d = rnd.range(spread * 0.35, spread);
    const r = radius * rnd.range(0.55, 0.85);
    geos.push(blob(cx + Math.cos(a) * d, cy + rnd.range(-vertical, vertical), cz + Math.sin(a) * d, r, flat));
  }
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return merged;
}

/** Gabungkan daftar geometri (yang sudah ditransformasi) menjadi satu; geometri sumber dibuang. */
export function mergeAll(geos) {
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return merged;
}

/** Kubah (setengah bola bagian atas) yang dipipihkan; alas di y=0. */
export function dome(r, flat = 0.6, segments = 10) {
  return new THREE.SphereGeometry(r, segments, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, flat, 1);
}

/** Silinder "gemuk": badan silinder + cincin bola tipis di atas & bawah agar tepinya membulat. */
export function chubbyCylinder(rTop, rBottom, h, segments = 12) {
  const body = new THREE.CylinderGeometry(rTop, rBottom, h, segments);
  const top = new THREE.SphereGeometry(rTop, segments, 4).scale(1, 0.18, 1).translate(0, h / 2, 0);
  const bottom = new THREE.SphereGeometry(rBottom, segments, 4).scale(1, 0.18, 1).translate(0, -h / 2, 0);
  return mergeAll([body, top, bottom]);
}
