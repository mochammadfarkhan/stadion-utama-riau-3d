import * as THREE from 'three';
import { box, cyl, piece, groupOf } from './bentuk.js';
import { makeCanvas, canvasTexture } from '../canvas.js';

/** Permadani cokelat bermotif (foto: di depan kursi kayu ukir): bingkai, medali tengah, sulur sudut. Kanvas 512 × 768. */
export function drawPermadani(c, w, h) {
  c.fillStyle = '#6b3a1f';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#c9a36b';
  c.lineWidth = 10;
  c.strokeRect(22, 22, w - 44, h - 44);
  c.strokeStyle = '#3f2111';
  c.lineWidth = 18;
  c.strokeRect(46, 46, w - 92, h - 92);
  c.fillStyle = '#8a4b26';
  c.fillRect(64, 64, w - 128, h - 128);
  c.save();
  c.translate(w / 2, h / 2);
  for (const [r, col] of [[150, '#c9a36b'], [118, '#5a2a12'], [80, '#d8b77d'], [40, '#7a3a1a']]) {
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(0, 0, r * 0.8, r, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  c.fillStyle = '#c9a36b';
  for (const [x, y] of [[90, 90], [w - 90, 90], [90, h - 90], [w - 90, h - 90]]) {
    for (let k = 0; k < 6; k += 1) {
      c.beginPath();
      c.ellipse(x, y, 34, 10, (k * Math.PI) / 3, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.fillStyle = 'rgba(255,240,210,0.06)';
  for (let i = 0; i < 2500; i += 1) c.fillRect((i * 97) % w, (i * 53) % h, 2, 2); // tekstur bulu tenun
}

/** Permadani 1,0 × 1,5 m (mesh datar 1 cm). */
export function buildPermadani(renderer = null) {
  const canvas = makeCanvas(512, 768);
  drawPermadani(canvas.getContext('2d'), 512, 768);
  const mat = new THREE.MeshStandardMaterial({ map: canvasTexture(canvas, renderer), roughness: 1 });
  mat.name = 'sekre:permadani';
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.01, 1.5).translate(0, 0.005, 0), mat);
  mesh.name = 'permadani';
  mesh.receiveShadow = true;
  return mesh;
}

/** Jas hujan merah tergantung di paku dinding (foto): badan plastik merah agak transparan, tudung, paku. Depan −Z lokal. */
export function buildJasHujan(m) {
  const MERAH = '#c4271b';
  const badan = [
    cyl(0.16, 0.3, 0.95, MERAH, { y: -0.55, z: -0.08 }, 10),
    cyl(0.13, 0.16, 0.2, MERAH, { y: -0.02, z: -0.07 }, 10),
    box(0.5, 0.06, 0.12, MERAH, { y: -0.12, z: -0.07 }),
  ];
  const paku = [cyl(0.008, 0.008, 0.06, '#9ea7ad', { z: -0.03, rx: Math.PI / 2 }, 6)];
  return groupOf('jas-hujan', piece(badan, m.plastik, 'jas', true), piece(paku, m.metal, 'paku', false));
}
