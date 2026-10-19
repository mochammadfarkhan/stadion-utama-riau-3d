/**
 * N07 spanduk ormawa diikat di pagar [INFERENSI pola umum]: bidang 4 × 1 m (kanvas sel atlas, dua sisi)
 * + 4 mata ayam/tali di sudut. Muka −Z, asal = pusat spanduk.
 */
import * as THREE from 'three';
import { boxAt, facePlane, meshOf } from './geom.js';
import { fitFont } from './atlas.js';
import { toCss } from '../canvasText.js';

export const SPANDUK = Object.freeze({ w: 4, h: 1, d: 0.02, px: Object.freeze({ w: 768, h: 192 }) });

/** Gambar spanduk: latar, pita aksen atas-bawah, judul besar, subjudul. */
export function drawSpanduk(ctx, w, h, { judul, sub = '', latar = 0xf2c200, teks = 0x0d3b66, aksen = 0xc8102e }) {
  ctx.fillStyle = toCss(latar);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = toCss(aksen);
  ctx.fillRect(0, 0, w, h * 0.09);
  ctx.fillRect(0, h * 0.91, w, h * 0.09);
  ctx.fillStyle = toCss(teks);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFont(ctx, judul, w * 0.92, h * 0.4, 'bold');
  ctx.fillText(judul, w / 2, sub ? h * 0.42 : h / 2);
  if (sub) {
    fitFont(ctx, sub, w * 0.9, h * 0.17, 'bold');
    ctx.fillText(sub, w / 2, h * 0.73);
  }
}

/** @param {{cell: object, material: THREE.Material, tieMaterial: THREE.Material}} opts material muka: DoubleSide */
export function createSpanduk({ cell, material, tieMaterial }) {
  const { w, h, d } = SPANDUK;
  const g = new THREE.Group();
  g.name = 'N07-spanduk';
  g.add(meshOf(facePlane(w, h, { cell }), material, 'spandukMuka'));
  for (const [sx, sy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    g.add(meshOf(boxAt(0.03, 0.03, d, sx * (w / 2 - 0.015), sy * (h / 2 - 0.015) - 0.015, 0), tieMaterial, 'spandukTali'));
  }
  return g;
}
