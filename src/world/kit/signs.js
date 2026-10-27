/**
 * Papan nama gedung (N05, spec §7.1): satu atlas canvas PER KLASTER (1024 × 2^n, dua kolom sel
 * 512 × 64 = rasio 8:1 per papan) → satu material 'papan' per klaster (1 draw call). Gaya 'panel' = panel hitam huruf
 * putih kapital [T gedung ADB]; 'timbul' = huruf gelap tanpa latar (alphaTest) [INF gedung lama]. Tanpa canvas
 * (Node) → null (papan dilewati). Quad ditempel di sisi utama massa 0 pada `out` meter dari bidang dinding.
 */
import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { facePoint } from './planGeom.js';
import { fitFontSize } from '../util/fitText.js';

export const SIGN_ATLAS = Object.freeze({ width: 1024, cellW: 512, cellH: 64, pad: 8 });
const FONT = "'Inter Variable', 'Arial Narrow', Arial, sans-serif";

function defaultCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Ukuran font terbesar yang muat lebar maksimum. */
function fitFont(ctx, text, maxW, maxPx) {
  const font = (p) => `700 ${p}px ${FONT}`;
  const px = fitFontSize((p) => { ctx.font = font(p); return ctx.measureText(text).width; }, maxPx, 10, 2, maxW);
  ctx.font = font(px);
  return px;
}

function drawSign(ctx, sign, x, y) {
  const { cellW, cellH, pad } = SIGN_ATLAS;
  if (sign.style === 'panel') {
    ctx.fillStyle = '#161616';
    ctx.fillRect(x, y, cellW, cellH);
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.clearRect(x, y, cellW, cellH);
  }
  fitFont(ctx, sign.text, cellW - pad * 2, cellH * 0.62);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (sign.style === 'timbul') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(sign.text, x + cellW / 2 - 2, y + cellH / 2 - 2);
    ctx.fillStyle = '#3b352e';
  }
  ctx.fillText(sign.text, x + cellW / 2, y + cellH / 2);
}

/**
 * @param {Array<{text:string, style:'panel'|'timbul'}>} signs
 * @param {{createCanvas?: Function}} [opts]
 * @returns {{material: MeshStandardMaterial, uvOf(i:number): {u0:number,v0:number,u1:number,v1:number}, dispose(): void}|null}
 */
export function createSignAtlas(signs, { createCanvas = defaultCanvas } = {}) {
  if (!signs.length) return null;
  const rows = Math.ceil(signs.length / 2);
  const height = Math.max(SIGN_ATLAS.cellH, 2 ** Math.ceil(Math.log2(rows * SIGN_ATLAS.cellH)));
  const canvas = createCanvas(SIGN_ATLAS.width, height);
  const ctx = canvas?.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, SIGN_ATLAS.width, height);
  signs.forEach((s, i) => drawSign(ctx, s, (i % 2) * SIGN_ATLAS.cellW, Math.floor(i / 2) * SIGN_ATLAS.cellH));
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  const material = new MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.6, metalness: 0 });
  material.name = 'kit:papan';
  return {
    material,
    uvOf(i) {
      const x = (i % 2) * SIGN_ATLAS.cellW;
      const y = Math.floor(i / 2) * SIGN_ATLAS.cellH;
      return { u0: (x + 2) / SIGN_ATLAS.width, u1: (x + SIGN_ATLAS.cellW - 2) / SIGN_ATLAS.width, v0: 1 - (y + SIGN_ATLAS.cellH - 2) / height, v1: 1 - (y + 2) / height };
    },
    dispose() {
      map.dispose();
      material.dispose();
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

/** Kumpulkan papan semua plan (urutan stabil) → [{plan, sign}]. */
export function collectSigns(plans) {
  return plans.flatMap((plan) => plan.signs.map((sign) => ({ plan, sign })));
}

/** Tulis quad papan ke sink.papan memakai UV atlas klaster. */
export function appendSigns(sink, entries, atlas) {
  if (!atlas) return 0;
  entries.forEach(({ plan, sign }, i) => {
    const face = plan.masses[sign.mass].faces.find((f) => f.id === sign.face);
    if (!face) return;
    const yC = plan.baseY + sign.y;
    const p = (u, y) => {
      const [x, z] = facePoint(face, u, sign.out);
      return [x, y, z];
    };
    const h = sign.h;
    const w = Math.min(sign.w, (h * SIGN_ATLAS.cellW) / SIGN_ATLAS.cellH);
    sink.papan.quad(p(sign.u - w / 2, yC - h / 2), p(sign.u + w / 2, yC - h / 2), p(sign.u + w / 2, yC + h / 2), p(sign.u - w / 2, yC + h / 2), atlas.uvOf(i));
  });
  return entries.length;
}
