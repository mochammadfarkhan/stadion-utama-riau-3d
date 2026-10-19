/**
 * Primitif bentuk kit di atas sisi dinding: titik 3D pada sisi, quad & bidang ber-ubin tegak, lantai poligon,
 * pengurangan interval (pemotongan dinding oleh bukaan). Dipakai facade/openings/roofs/ornaments.
 */
import { cellUv } from './atlas.js';
import { facePoint } from './planGeom.js';

/** Titik 3D pada sisi: u sepanjang sisi, y absolut, out keluar dari bidang dinding. */
export function wp(face, u, y, out = 0) {
  const [x, z] = facePoint(face, u, out);
  return [x, y, z];
}

/** Yaw three.js yang membuat +Z lokal kotak menghadap normal luar sisi. */
export const yawOf = (face) => Math.atan2(face.n[0], face.n[1]);

/** Quad tegak di bidang sisi (dilihat dari luar), UV rect `r`. */
export function wallQuad(b, face, u0, u1, y0, y1, out, r, color) {
  b.quad(wp(face, u0, y0, out), wp(face, u1, y0, out), wp(face, u1, y1, out), wp(face, u0, y1, out), r, color);
}

/** Bidang tegak ber-ubin di sisi: s = u − u0, t = y − y0; tiap ubin tileW × tileH memetakan sel penuh. */
export function wallTiled(b, face, u0, u1, y0, y1, out, cell, tileW, tileH, color) {
  const o = wp(face, u0, y0, out);
  const U = [(face.b[0] - face.a[0]) / face.len, 0, (face.b[1] - face.a[1]) / face.len];
  b.tiled(o, U, [0, 1, 0], [[0, 0], [u1 - u0, 0], [u1 - u0, y1 - y0], [0, y1 - y0]], tileW, tileH, cellUv(cell), color);
}

/** Lantai/atap datar poligon (ring dunia [x,z], cembung atau segitiga) menghadap atas pada y. */
export function floorPolygon(b, ring, y, cell, color, tile = 1.6) {
  const x0 = Math.min(...ring.map((p) => p[0]));
  const z1 = Math.max(...ring.map((p) => p[1]));
  let poly = ring.map(([x, z]) => [x - x0, z1 - z]);
  const area = poly.reduce((s, p, i) => s + p[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * p[1], 0);
  if (area < 0) poly = poly.reverse();
  b.tiled([x0, y, z1], [1, 0, 0], [0, 0, -1], poly, tile, tile, cellUv(cell), color);
}

/** Interval [a,b] dikurangi interval lubang → potongan tersisa (> 1 mm). */
export function subtractIntervals(a, b, holes) {
  let parts = [[a, b]];
  for (const [h0, h1] of holes) {
    parts = parts.flatMap(([p0, p1]) => {
      if (h1 <= p0 || h0 >= p1) return [[p0, p1]];
      const out = [];
      if (h0 > p0) out.push([p0, h0]);
      if (h1 < p1) out.push([h1, p1]);
      return out;
    });
  }
  return parts.filter(([p0, p1]) => p1 - p0 > 1e-3);
}
