/**
 * Tekstur kanvas sekretariat (null tanpa document → material warna polos): keramik selasar 40 × 40 cm krem
 * dengan nat, plafon triplek bercat dengan nat 1,2 m dan noda bocor samar, roster beton motif bunga
 * (alpha berlubang), gradasi kolam cahaya. UV geometri bersatuan meter (keramik/plafon) atau blok (roster).
 */
import * as THREE from 'three';
import { hasDocument } from '../../world/props/canvasText.js';
import { createRandom } from '../../world/siteutil/rng.js';
import { currentScope } from '../../engine/ResourceScope.js';

export const KERAMIK_M = 1.6; // satu tekstur = 4 × 4 keramik 40 cm
export const PLAFON_M = 1.2;
export const ROSTER_M = 0.2;

function canvasTexture(size, draw, { repeatM = null, wrap = false, srgb = true } = {}) {
  if (!hasDocument()) return null;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeatM || wrap) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  if (repeatM) t.repeat.set(1 / repeatM, 1 / repeatM);
  return t;
}

function drawKeramik(ctx, s) {
  const rnd = createRandom(4040);
  const n = 4;
  const cell = s / n;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const k = 0.96 + rnd.range(0, 0.06);
      ctx.fillStyle = `rgb(${Math.round(232 * k)},${Math.round(223 * k)},${Math.round(203 * k)})`;
      ctx.fillRect(i * cell, j * cell, cell, cell);
      if (rnd.chance(0.12)) {
        ctx.strokeStyle = 'rgba(120,110,95,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(i * cell + rnd.range(4, cell - 4), j * cell + 3);
        ctx.lineTo(i * cell + rnd.range(4, cell - 4), j * cell + cell - 3);
        ctx.stroke();
      }
    }
  }
  ctx.fillStyle = '#b9b0a0';
  for (let k = 0; k <= n; k += 1) {
    ctx.fillRect(k * cell - 1.5, 0, 3, s);
    ctx.fillRect(0, k * cell - 1.5, s, 3);
  }
}

function drawPlafon(ctx, s) {
  ctx.fillStyle = '#f1ede4';
  ctx.fillRect(0, 0, s, s);
  const rnd = createRandom(5151);
  for (let i = 0; i < 300; i += 1) {
    ctx.fillStyle = `rgba(150,140,120,${rnd.range(0.02, 0.05)})`;
    ctx.fillRect(rnd.range(0, s), rnd.range(0, s), 3, 3);
  }
  const g = ctx.createRadialGradient(s * 0.7, s * 0.3, 2, s * 0.7, s * 0.3, s * 0.18);
  g.addColorStop(0, 'rgba(160,120,70,0.10)');
  g.addColorStop(1, 'rgba(160,120,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#d3ccbf';
  ctx.fillRect(0, 0, s, 3);
  ctx.fillRect(0, 0, 3, s);
}

function drawRoster(ctx, s) {
  ctx.fillStyle = '#d8d1c2';
  ctx.fillRect(0, 0, s, s);
  ctx.globalCompositeOperation = 'destination-out';
  const r = s * 0.19;
  for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(s / 2, s / 2 - r);
  ctx.lineTo(s / 2 + r, s / 2);
  ctx.lineTo(s / 2, s / 2 + r);
  ctx.lineTo(s / 2 - r, s / 2);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(90,85,75,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, s - 2, s - 2);
}

function drawPool(ctx, s) {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#666666');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

export const keramikTexture = () => currentScope().get('lembaga:tex:keramik', () => canvasTexture(256, drawKeramik, { repeatM: KERAMIK_M }));
export const plafonTexture = () => currentScope().get('lembaga:tex:plafon', () => canvasTexture(256, drawPlafon, { repeatM: PLAFON_M }));
export const rosterTexture = () => currentScope().get('lembaga:tex:roster', () => canvasTexture(128, drawRoster, { wrap: true }));
export const poolTexture = () => currentScope().get('lembaga:tex:kolam', () => canvasTexture(64, drawPool, { srgb: false }));
