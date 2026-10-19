/**
 * N06 papan nama sekre di atas pintu [INFERENSI pola umum]: papan 1,6 × 0,4 m tebal 5 cm, muka kanvas
 * (sel atlas) menghadap −Z, asal = pusat papan. Logo = lingkaran kuning generik (bukan lambang resmi).
 */
import * as THREE from 'three';
import { boxAt, facePlane, meshOf } from './geom.js';
import { fitFont } from './atlas.js';
import { toCss } from '../canvasText.js';

export const PAPAN_NAMA_SEKRE = Object.freeze({ w: 1.6, h: 0.4, d: 0.05, px: Object.freeze({ w: 384, h: 96 }) });

/** Gambar papan: latar, bingkai tipis, logo bulat, nama tebal, keterangan kecil. */
export function drawPapanNama(ctx, w, h, { nama, sub = '', latar = 0x0d3b66, teks = 0xffffff }) {
  ctx.fillStyle = toCss(latar);
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = toCss(teks);
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = Math.max(2, h * 0.04);
  ctx.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(h * 0.5, h / 2, h * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = '#f2c200';
  ctx.fill();
  ctx.fillStyle = toCss(teks);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const left = h * 0.95;
  const tw = w - left - h * 0.2;
  const mid = left + tw / 2;
  fitFont(ctx, nama, tw, h * (sub ? 0.36 : 0.5), 'bold');
  ctx.fillText(nama, mid, sub ? h * 0.4 : h / 2);
  if (sub) {
    fitFont(ctx, sub, tw, h * 0.17, 'normal');
    ctx.fillText(sub, mid, h * 0.74);
  }
}

/**
 * @param {{cell: {u0:number,u1:number,v0:number,v1:number}, faceMaterial: THREE.Material, frameMaterial: THREE.Material}} opts
 */
export function createPapanNamaSekre({ cell, faceMaterial, frameMaterial }) {
  const { w, h, d } = PAPAN_NAMA_SEKRE;
  const g = new THREE.Group();
  g.name = 'N06-papan-nama-sekre';
  g.add(meshOf(boxAt(w, h, d - 0.005, 0, -h / 2, 0.0025), frameMaterial, 'papanNamaBingkai'));
  g.add(meshOf(facePlane(w - 0.03, h - 0.03, { z: -d / 2 + 0.001, cell }), faceMaterial, 'papanNamaMuka'));
  return g;
}
