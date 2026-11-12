/**
 * Proxy stadion untuk pratinjau kota (K): SATU mesh vertexColors, ±2,5 rb segitiga, menggantikan cangkang tribun,
 * atap, fasad, dan ribuan instans kursi/penonton selama kamera helikopter. Dimensi dari STADIUM (region-lokal,
 * pusat lapangan di origin); placement diterapkan pemanggil (applyPlacement).
 * Isi: plaza oval, lintasan, rumput, dinding fasad, mangkuk tribun miring (dua undakan), cincin atap.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STADIUM } from '../../config/constants.js';
import { ellipseShape, ellipsePath, flatShapeGeometry, ellipseRingExtrude } from '../../world/stadium/ovalMath.js';
import { paint } from '../../world/props/unri/geom.js';

export const STADION_PROXY_NAME = 'proxy:stadion';
const COLOR = Object.freeze({
  plaza: 0xb9b4a6, lintasan: 0xa65a3c, rumput: 0x6f9d3c, fasad: 0xe9e4d6, tribun: 0x9c9a94, atap: 0x6f7b88, kursi: 0x2d6cb3,
});
const SEGMENTS = 48;

/** Cincin elips datar (bidang XZ) dari semi-sumbu dalam (a, b) selebar w, pada ketinggian y. */
function flatRing(a, b, w, y, hex) {
  const g = flatShapeGeometry(ellipseShape(a + w, b + w), [ellipsePath(a, b)], SEGMENTS);
  return paint(g.translate(0, y, 0), hex);
}

/** Dua lapis cincin tribun miring (undakan bawah rendah, atas lebih tinggi) sebagai prisma bertingkat. */
function bowl() {
  const { innerSemiX: ix, innerSemiZ: iz, outerSemiX: ox, outerSemiZ: oz, facadeHeight: fh } = STADIUM;
  const w = Math.min(ox - ix, oz - iz) * 0.5;
  const lower = paint(ellipseRingExtrude(ix, iz, w, fh * 0.42, 0, SEGMENTS), COLOR.tribun);
  const upper = paint(ellipseRingExtrude(ix + w, iz + w, ox - ix - w, fh * 0.78, 0, SEGMENTS), COLOR.tribun);
  const seat = paint(ellipseRingExtrude(ix, iz, 1.2, fh * 0.42 + 0.3, 0, SEGMENTS), COLOR.kursi);
  return [lower, upper, seat];
}

/**
 * @param {{terrain?: {heightAt(x:number, z:number):number}, heightAtLocal?: (lx:number, lz:number)=>number}} [ctx]
 * @returns {{group: THREE.Group, dispose(): void}}
 */
export function buildStadionProxy(ctx = {}) {
  const y0 = typeof ctx.heightAtLocal === 'function' ? ctx.heightAtLocal(0, 0) : 0;
  const { innerSemiX: ix, innerSemiZ: iz, outerSemiX: ox, outerSemiZ: oz, roofHeight: rh, facadeHeight: fh, roofOpeningPad: pad } = STADIUM;
  const geos = [
    paint(flatShapeGeometry(ellipseShape(ox + 40, oz + 40), [], SEGMENTS).translate(0, 0.05, 0), COLOR.plaza),
    paint(flatShapeGeometry(ellipseShape(ix, iz), [], SEGMENTS).translate(0, 0.15, 0), COLOR.rumput),
    flatRing(ix * 0.82, iz * 0.82, ix * 0.18, 0.18, COLOR.lintasan),
    ...bowl(),
    // fasad luar (dinding tegak) + atap miring tipis berupa cincin datar di ketinggian atap
    paint(ellipseRingExtrude(ox - 2, oz - 2, 2, fh, 0, SEGMENTS), COLOR.fasad),
    paint(ellipseRingExtrude(ix + pad, iz + pad, ox - ix - pad, 1.4, rh - 1.4, SEGMENTS), COLOR.atap),
  ];
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g)); // Extrude = tak berindeks, Shape = berindeks: samakan agar bisa digabung
  const merged = mergeGeometries(flat, false);
  geos.forEach((g) => g.dispose());
  flat.forEach((g) => g.dispose());
  if (!merged) throw new Error('Proxy stadion: penggabungan geometri gagal');
  merged.translate(0, y0, 0);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.name = 'proxyStadion';
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = STADION_PROXY_NAME;
  const group = new THREE.Group();
  group.name = STADION_PROXY_NAME;
  group.add(mesh);
  return { group, dispose() { merged.dispose(); material.dispose(); } };
}
