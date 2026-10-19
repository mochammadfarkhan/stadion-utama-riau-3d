/**
 * N09 papan pengumuman berdiri [INFERENSI]: dua kaki kayu, papan gabus 1,5 × 0,95 m, atap tipis. Muka (sel
 * atlas berisi kertas tertempel) menghadap −Z. Asal = tengah alas.
 */
import * as THREE from 'three';
import { boxAt, facePlane, meshOf } from './geom.js';
import { fitFont } from './atlas.js';

export const PAPAN_PENGUMUMAN = Object.freeze({ w: 1.5, d: 0.1, h: 1.8, boardY0: 0.8, boardH: 0.95, px: Object.freeze({ w: 320, h: 208 }) });

const PAPER_COLORS = ['#ffffff', '#fff7c2', '#ffd6e0', '#d9f0ff', '#e6ffd9', '#ffffff'];

/** Gabus + kertas bertumpuk berjudul (isi baris = coretan abu). */
export function drawPapanPengumuman(ctx, w, h, { notices }) {
  ctx.fillStyle = '#b8895a';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i += 1) {
    ctx.fillStyle = i % 2 ? 'rgba(90,60,30,0.12)' : 'rgba(255,240,210,0.10)';
    ctx.fillRect((i * 37) % w, (i * 53) % h, 2, 2);
  }
  notices.forEach((n, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const pw = w * 0.29;
    const ph = h * 0.42;
    const x = w * 0.03 + col * w * 0.325 + (i % 2) * 4;
    const y = h * 0.05 + row * h * 0.48 + (i % 3) * 3;
    ctx.save();
    ctx.translate(x + pw / 2, y + ph / 2);
    ctx.rotate(((i % 3) - 1) * 0.04);
    ctx.fillStyle = PAPER_COLORS[i % PAPER_COLORS.length];
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    ctx.fillStyle = '#c8102e';
    ctx.beginPath();
    ctx.arc(0, -ph / 2 + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    ctx.textAlign = 'center';
    fitFont(ctx, n, pw * 0.9, ph * 0.16, 'bold');
    ctx.fillText(n, 0, -ph / 2 + ph * 0.24);
    ctx.fillStyle = 'rgba(40,40,40,0.55)';
    for (let k = 0; k < 4; k += 1) ctx.fillRect(-pw * 0.4, -ph / 2 + ph * (0.42 + k * 0.13), pw * (0.8 - (k % 2) * 0.2), 2);
    ctx.restore();
  });
}

/** @param {{cell: object, faceMaterial: THREE.Material, woodMaterial: THREE.Material}} opts */
export function createPapanPengumuman({ cell, faceMaterial, woodMaterial }) {
  const { w, h, boardY0, boardH } = PAPAN_PENGUMUMAN;
  const g = new THREE.Group();
  g.name = 'N09-papan-pengumuman';
  for (const sx of [-1, 1]) g.add(meshOf(boxAt(0.06, h, 0.06, sx * (w / 2 - 0.03), 0, 0.02), woodMaterial, 'papanKaki', { cast: true }));
  g.add(meshOf(boxAt(w, boardH, 0.04, 0, boardY0, 0.02), woodMaterial, 'papanGabus', { cast: true }));
  g.add(meshOf(boxAt(w, 0.04, 0.1, 0, h - 0.04, 0), woodMaterial, 'papanAtap'));
  g.add(meshOf(facePlane(w - 0.08, boardH - 0.08, { y: boardY0 + boardH / 2, z: -0.002, cell }), faceMaterial, 'papanKertas'));
  return g;
}
