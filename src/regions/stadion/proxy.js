/**
 * Proxy stadion untuk pratinjau kota (K): SATU mesh vertexColors (±4 rb segitiga), menggantikan cangkang tribun,
 * atap, fasad, dan ribuan instans kursi/penonton selama kamera helikopter. Dimensi dari STADIUM (region-lokal,
 * pusat lapangan di origin); placement diterapkan pemanggil (applyPlacement).
 * Isi: plaza oval, lintasan, rumput + marka FIFA (garis, lingkaran tengah, kotak penalti), fasad putih, mangkuk
 * tribun berundak dengan jalur kursi biru, cincin atap putih, empat tiang lampu sorot. Warna [INFERENSI, tanpa foto].
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STADIUM } from '../../config/constants.js';
import { ellipseShape, ellipsePath, flatShapeGeometry, ellipseRingExtrude } from '../../world/stadium/ovalMath.js';
import { boxAt, paint } from '../../world/props/unri/geom.js';

export const STADION_PROXY_NAME = 'proxy:stadion';
const COLOR = Object.freeze({
  plaza: 0xc9c4b4, lintasan: 0xb35e3d, rumput: 0x5f9a38, rumput2: 0x6aa843, fasad: 0xf3efe4, tribun: 0xb4b0a6, tribunGelap: 0x8f8c84,
  atap: 0xf7f7f4, kursi: 0x2563b8, garis: 0xf5f5f0, tiang: 0x6b6f76, lampu: 0xfff3c4,
});
const SEGMENTS = 48;
const PITCH = Object.freeze({ halfW: 34, halfL: 52.5, line: 0.28, penaltyW: 20.16, penaltyD: 16.5, circle: 9.15 }); // FIFA 68 × 105 m
const MAST_HEIGHT = 58;

/** Cincin elips datar (bidang XZ) dari semi-sumbu dalam (a, b) selebar w, pada ketinggian y. */
function flatRing(a, b, w, y, hex) {
  const g = flatShapeGeometry(ellipseShape(a + w, b + w), [ellipsePath(a, b)], SEGMENTS);
  return paint(g.translate(0, y, 0), hex);
}

/** Cincin lingkaran tipis (marka lingkaran tengah). */
function circleLine(r, y, hex) {
  const g = flatShapeGeometry(ellipseShape(r + PITCH.line, r + PITCH.line), [ellipsePath(r, r)], 32);
  return paint(g.translate(0, y, 0), hex);
}

/** Garis marka (balok pipih) dari (x1,z1) ke (x2,z2), sejajar sumbu. */
function markLine(x1, z1, x2, z2, y, hex) {
  const w = Math.abs(x2 - x1) + PITCH.line;
  const d = Math.abs(z2 - z1) + PITCH.line;
  return paint(boxAt(w, 0.06, d, (x1 + x2) / 2, y, (z1 + z2) / 2), hex);
}

/** Marka lapangan: garis tepi, tengah, lingkaran tengah, dua kotak penalti. Lapangan memanjang di sumbu Z. */
function pitchMarkings(y) {
  const { halfW: w, halfL: l, penaltyW: pw, penaltyD: pd } = PITCH;
  const c = COLOR.garis;
  const out = [
    markLine(-w, -l, w, -l, y, c), markLine(-w, l, w, l, y, c),
    markLine(-w, -l, -w, l, y, c), markLine(w, -l, w, l, y, c),
    markLine(-w, 0, w, 0, y, c), circleLine(PITCH.circle, y + 0.03, c),
  ];
  for (const s of [-1, 1]) { // kotak penalti di kedua ujung
    const z0 = s * l;
    const z1 = s * (l - pd);
    out.push(markLine(-pw, z1, pw, z1, y, c), markLine(-pw, z0, -pw, z1, y, c), markLine(pw, z0, pw, z1, y, c));
  }
  return out;
}

/** Tribun berundak: dua cincin bertingkat + jalur kursi biru di bibir dalam + pagar bibir. */
function bowl() {
  const { innerSemiX: ix, innerSemiZ: iz, outerSemiX: ox, outerSemiZ: oz, facadeHeight: fh } = STADIUM;
  const w = Math.min(ox - ix, oz - iz) * 0.5;
  const lower = paint(ellipseRingExtrude(ix, iz, w, fh * 0.42, 0, SEGMENTS), COLOR.tribun);
  const upper = paint(ellipseRingExtrude(ix + w, iz + w, ox - ix - w, fh * 0.78, 0, SEGMENTS), COLOR.tribunGelap);
  const seat = paint(ellipseRingExtrude(ix, iz, w * 0.8, fh * 0.42 + 0.35, 0, SEGMENTS), COLOR.kursi);
  const seatUp = paint(ellipseRingExtrude(ix + w, iz + w, (ox - ix - w) * 0.7, fh * 0.78 + 0.35, 0, SEGMENTS), COLOR.kursi);
  return [upper, lower, seatUp, seat];
}

/** Empat tiang lampu sorot di sudut elips luar (kepala lampu = balok terang). */
function floodlights() {
  const { outerSemiX: ox, outerSemiZ: oz } = STADIUM;
  const out = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * ox * 0.78;
      const z = sz * oz * 0.78;
      out.push(paint(boxAt(2.2, MAST_HEIGHT, 2.2, x, 0, z), COLOR.tiang));
      out.push(paint(boxAt(11, 5, 2.4, x, MAST_HEIGHT, z), COLOR.lampu));
    }
  }
  return out;
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
    flatRing(ix * 0.82, iz * 0.82, ix * 0.18, 0.18, COLOR.lintasan),
    paint(flatShapeGeometry(ellipseShape(ix * 0.82, iz * 0.82), [], SEGMENTS).translate(0, 0.15, 0), COLOR.rumput),
    paint(boxAt(PITCH.halfW * 2, 0.04, PITCH.halfL * 2, 0, 0.14, 0), COLOR.rumput2), // petak rumput lapangan inti
    ...pitchMarkings(0.19),
    ...bowl(),
    // fasad luar (dinding tegak) + atap putih berupa cincin tebal di ketinggian atap
    paint(ellipseRingExtrude(ox - 2, oz - 2, 2, fh, 0, SEGMENTS), COLOR.fasad),
    paint(ellipseRingExtrude(ix + pad, iz + pad, ox - ix - pad, 1.4, rh - 1.4, SEGMENTS), COLOR.atap),
    ...floodlights(),
  ];
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g)); // Extrude = tak berindeks, Shape/Box = berindeks: samakan agar bisa digabung
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
