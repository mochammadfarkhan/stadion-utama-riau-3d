/**
 * Atap pelana seng gelombang (bubungan sejajar Z lokal-gedung, kemiringan 20°, tritisan 0,8 m sisi panjang,
 * 0,6 m ujung pelana), talang + pipa turun di 4 sudut, lisplang putih, plafon selasar bergaris panel,
 * dinding gable segitiga dengan lubang roster ventilasi di atas mulut selasar. [INFERENSI: OSM tag
 * building:roof=tin umum di kampus; bentuk pelana = pola gedung kuliah lama, riset §2 & spec §7.1 K01]
 */
import * as THREE from 'three';
import { boxAt, quad } from '../../world/props/unri/geom.js';
import { rosterPlane } from './sekretariat.parts.js';

/** Elevasi atap (lokal-gedung, dari tanah pad). */
export function roofLevels(dim) {
  const tan = Math.tan(dim.roof.pitch);
  const E = dim.hx + dim.roof.eave;
  const L = dim.hz + dim.roof.gable;
  const ridgeY = dim.wallTop + 0.1 + dim.hx * tan;
  return { tan, E, L, ridgeY, eaveY: ridgeY - E * tan, slope: E / Math.cos(dim.roof.pitch) };
}

export function roofGeometries(dim) {
  const { E, L, ridgeY, eaveY, slope: S, tan } = roofLevels(dim);
  const seng = [
    quad([[0, ridgeY, -L], [0, ridgeY, L], [E, eaveY, L], [E, eaveY, -L]], [[-L, 0], [L, 0], [L, S], [-L, S]]),
    quad([[0, ridgeY, L], [0, ridgeY, -L], [-E, eaveY, -L], [-E, eaveY, L]], [[L, 0], [-L, 0], [-L, S], [L, S]]),
    boxAt(0.36, 0.05, 2 * L, 0, ridgeY - 0.02, 0),
  ];
  const talang = [];
  const putih = [];
  for (const sx of [-1, 1]) {
    talang.push(boxAt(0.12, 0.1, 2 * L, sx * (E + 0.03), eaveY - 0.12, 0));
    putih.push(boxAt(0.025, 0.2, 2 * L, sx * (E - 0.01), eaveY - 0.17, 0));
    for (const sz of [-1, 1]) {
      const px = sx * (dim.hx + 0.07);
      const pz = sz * (dim.hz - 0.3);
      const h = eaveY - 0.32;
      talang.push(new THREE.CylinderGeometry(0.045, 0.045, h, 8).translate(px, 0.12 + h / 2, pz));
      talang.push(boxAt(E + 0.03 - dim.hx - 0.07 + 0.06, 0.06, 0.06, sx * ((dim.hx + 0.07 + E + 0.03) / 2), eaveY - 0.2, pz));
      talang.push(boxAt(0.06, 0.06, 0.2, px, 0.06, pz + sz * 0.08));
      const rake = new THREE.BoxGeometry(S, 0.2, 0.025).rotateZ(-sx * dim.roof.pitch);
      putih.push(rake.translate(sx * (E / 2), (ridgeY + eaveY) / 2 - 0.09, sz * (L + 0.0125)));
    }
  }
  const c = dim.corridorHalf;
  const y = dim.plafonY;
  const plafon = [quad([[-c, y, -dim.hz], [c, y, -dim.hz], [c, y, dim.hz], [-c, y, dim.hz]], [[-c, -dim.hz], [c, -dim.hz], [c, dim.hz], [-c, dim.hz]])];
  return { seng, talang, putih, plafon, tan };
}

/** Dinding gable (segitiga di atas wallTop) dengan lubang ventilasi berisi roster. */
export function gableGeometries(dim) {
  const { tan } = roofLevels(dim);
  const apex = dim.hx * tan + 0.04;
  const vent = { w: 1.6, y0: 0.65, h: 0.5 };
  const shape = new THREE.Shape();
  shape.moveTo(-dim.hx, 0);
  shape.lineTo(dim.hx, 0);
  shape.lineTo(0, apex);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-vent.w / 2, vent.y0);
  hole.lineTo(-vent.w / 2, vent.y0 + vent.h);
  hole.lineTo(vent.w / 2, vent.y0 + vent.h);
  hole.lineTo(vent.w / 2, vent.y0);
  hole.closePath();
  shape.holes.push(hole);
  const walls = [];
  const vents = [];
  for (const sz of [-1, 1]) {
    const g = new THREE.ShapeGeometry(shape);
    if (sz < 0) g.rotateY(Math.PI);
    walls.push(g.translate(0, dim.wallTop, sz * dim.hz));
    const r = rosterPlane(vent.w, vent.h);
    if (sz > 0) r.rotateY(Math.PI);
    vents.push(r.translate(0, dim.wallTop + vent.y0, sz * (dim.hz - dim.wallT / 2)));
  }
  return { walls, vents };
}
