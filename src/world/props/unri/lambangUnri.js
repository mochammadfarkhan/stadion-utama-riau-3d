/**
 * Plang lambang UNRI (katalog N10): dua tiang + papan + emblem segi lima. Placeholder emblem = bidang 1 × 1 m
 * bertekstur canvas (segi lima hijau lumut berbingkai kuning emas, lancang kuning, pohon hayat 1 daun kecil + 10
 * daun besar, teratai 6 + 2 kelopak; deskripsi resmi unri.ac.id/lambang [T], tata letak gambar [INFERENSI]).
 * Mesh emblem bernama 'N10' agar GLB final menyembunyikannya (pola `replaces`). Muka depan = −Z lokal.
 */
import * as THREE from 'three';
import { currentScope } from '../../../engine/ResourceScope.js';
import { localMatrix } from '../../siteutil/instanceParts.js';

export const LAMBANG_MODEL_PATH = 'models/unri/n10-lambang-unri.glb';
/** Tinggi alas emblem dari tanah (m). */
export const LAMBANG_BOARD_Y = 1.5;
const POLE_H = 2.7;

function drawLambang(ctx, size) {
  const c = size / 2;
  const pent = (r) => {
    ctx.beginPath();
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2;
      const x = c + r * Math.sin(a);
      const y = c - r * Math.cos(a);
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  };
  const leaf = (x, y, rx, ry, a, color) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };
  ctx.clearRect(0, 0, size, size);
  pent(size * 0.47);
  ctx.fillStyle = '#d4a017';
  ctx.fill();
  pent(size * 0.42);
  ctx.fillStyle = '#4f5d2f';
  ctx.fill();
  ctx.strokeStyle = '#3d8bff';
  ctx.lineWidth = size * 0.018;
  for (let i = 0; i < 3; i += 1) {
    const y = c + size * (0.2 + i * 0.05);
    ctx.beginPath();
    for (let x = c - size * 0.25; x <= c + size * 0.25; x += size * 0.02) ctx.lineTo(x, y + Math.sin(x * 0.12) * size * 0.012);
    ctx.stroke();
  }
  ctx.fillStyle = '#f2c200';
  ctx.beginPath();
  ctx.moveTo(c - size * 0.24, c + size * 0.1);
  ctx.lineTo(c + size * 0.24, c + size * 0.1);
  ctx.lineTo(c + size * 0.17, c + size * 0.18);
  ctx.lineTo(c - size * 0.17, c + size * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(c - size * 0.008, c - size * 0.2, size * 0.016, size * 0.3);
  ctx.beginPath();
  ctx.moveTo(c + size * 0.012, c - size * 0.18);
  ctx.lineTo(c + size * 0.17, c + size * 0.06);
  ctx.lineTo(c + size * 0.012, c + size * 0.06);
  ctx.closePath();
  ctx.fill();
  const tx = c - size * 0.2;
  const ty = c - size * 0.08;
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(tx - size * 0.01, ty, size * 0.02, size * 0.14);
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI * 0.9 + (i / 9) * Math.PI * 0.8;
    leaf(tx + Math.cos(a) * size * 0.07, ty + Math.sin(a) * size * 0.07, size * 0.03, size * 0.012, a, '#8bc34a');
  }
  leaf(tx, ty - size * 0.1, size * 0.015, size * 0.007, -Math.PI / 2, '#8bc34a');
  const lx = c + size * 0.2;
  const ly = c - size * 0.05;
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI + (i / 5) * Math.PI;
    leaf(lx + Math.cos(a) * size * 0.04, ly + Math.sin(a) * size * 0.04, size * 0.035, size * 0.014, a, '#ffffff');
  }
  for (const s of [-1, 1]) leaf(lx + s * size * 0.07, ly + size * 0.05, size * 0.018, size * 0.008, s * 0.4, '#ffffff');
}

/** Material emblem: tekstur canvas (browser) atau warna polos (lingkungan tanpa DOM, mis. tes Node). */
function emblemMaterial() {
  return currentScope().get('unri:lambang:emblem', () => {
    if (typeof document === 'undefined') return new THREE.MeshLambertMaterial({ color: 0x4f5d2f });
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    drawLambang(canvas.getContext('2d'), size);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshLambertMaterial({ map, transparent: true, alphaTest: 0.5 });
  });
}

/** Part plang (pola instanceParts): tiang ×2, papan, emblem 'N10'. */
export function lambangPlangParts() {
  const scope = currentScope();
  const metal = scope.get('unri:lambang:tiang', () => new THREE.MeshLambertMaterial({ color: 0x6d7a86 }));
  const board = scope.get('unri:lambang:papan', () => new THREE.MeshLambertMaterial({ color: 0xf5f1e6 }));
  const pole = new THREE.CylinderGeometry(0.05, 0.05, POLE_H, 10);
  return [
    { geometry: pole, material: metal, matrix: localMatrix(-0.55, POLE_H / 2, 0.05), castShadow: true, name: 'tiangKiri' },
    { geometry: pole, material: metal, matrix: localMatrix(0.55, POLE_H / 2, 0.05), castShadow: true, name: 'tiangKanan' },
    { geometry: new THREE.BoxGeometry(1.3, 1.3, 0.06), material: board, matrix: localMatrix(0, LAMBANG_BOARD_Y + 0.5, 0), castShadow: true, name: 'papan' },
    { geometry: new THREE.PlaneGeometry(1, 1), material: emblemMaterial(), matrix: localMatrix(0, LAMBANG_BOARD_Y + 0.5, -0.035, 0, Math.PI, 0), name: 'N10' },
  ];
}
