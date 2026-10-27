import * as THREE from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { fitFontSize } from '../util/fitText.js';

/**
 * CanvasTexture berisi teks — hanya jika `document` tersedia (browser).
 * Di Node (dry-run/test) mengembalikan null sehingga pemanggil memakai warna polos.
 */
const DEFAULTS = Object.freeze({
  width: 1024,
  height: 256,
  bg: '#ffffff',
  fg: '#1a1a1a',
  font: 'bold 110px sans-serif',
  padding: 24,
});

export function hasDocument() {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

/** Kecilkan font sampai teks muat dalam lebar maksimum. */
function fitText(ctx, text, maxWidth) {
  const match = ctx.font.match(/(\d+)px/);
  const base = ctx.font;
  const font = (px) => base.replace(/\d+px/, `${px}px`);
  const size = fitFontSize((px) => { ctx.font = font(px); return ctx.measureText(text).width; },
    parseInt(match ? match[1] : '100', 10), 12, 4, maxWidth);
  ctx.font = font(size);
}

export function makeTextTexture(text, opts = {}) {
  if (!hasDocument()) return null;
  const o = { ...DEFAULTS, ...opts };
  const canvas = document.createElement('canvas');
  canvas.width = o.width;
  canvas.height = o.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = o.bg;
  ctx.fillRect(0, 0, o.width, o.height);
  ctx.fillStyle = o.fg;
  ctx.font = o.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(ctx, text, o.width - o.padding * 2);
  ctx.fillText(text, o.width / 2, o.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Material plane bertulisan; fallback warna polos jika kanvas tak tersedia.
 * Di-cache per (teks + opsi) dalam ResourceScope aktif agar papan dengan tulisan sama berbagi
 * material dan bisa digabung menjadi satu draw call. Tekstur kanvas ikut dilepas bersama material.
 */
export function makeTextMaterial(text, opts = {}) {
  const key = `${text}|${JSON.stringify(opts)}`;
  return currentScope().get(`text:${key}`, () => buildTextMaterial(text, opts), { dispose: disposeTextMaterial });
}

function disposeTextMaterial(mat) {
  mat.map?.dispose();
  mat.dispose();
}

function buildTextMaterial(text, opts) {
  const tex = makeTextTexture(text, opts);
  const mat = new THREE.MeshLambertMaterial({
    color: tex ? 0xffffff : new THREE.Color(opts.bg ?? '#ffffff'),
    side: opts.side ?? THREE.FrontSide,
  });
  if (tex) mat.map = tex;
  mat.userData.text = text;
  return mat;
}

/** Hilangkan beberapa huruf (efek huruf rontok) secara deterministik. */
export function dropLetters(text, indices) {
  return text
    .split('')
    .map((ch, i) => (indices.includes(i) ? ' ' : ch))
    .join('');
}
