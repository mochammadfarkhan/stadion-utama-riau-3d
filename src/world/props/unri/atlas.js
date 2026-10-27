/**
 * Atlas kanvas: banyak gambar kecil (papan nama, stiker, kertas pengumuman, spanduk) dalam SATU tekstur agar
 * semua decal berbagi satu material = satu draw call. packShelves murni (dites); gambar hanya bila ada document.
 */
import * as THREE from 'three';
import { hasDocument } from '../canvasText.js';
import { fitFontSize } from '../../util/fitText.js';

/**
 * Kemas sel ke rak (shelf packing), sel tertinggi dulu. Koordinat piksel kanvas (y ke bawah).
 * @param {Array<{id:string, w:number, h:number}>} cells
 * @returns {Map<string, {x:number, y:number, w:number, h:number}>}
 */
export function packShelves(cells, { width, height, pad = 2 }) {
  const order = [...cells].sort((a, b) => b.h - a.h || b.w - a.w);
  const out = new Map();
  let x = pad;
  let y = pad;
  let shelfH = 0;
  for (const c of order) {
    if (!(c.w > 0 && c.h > 0)) throw new RangeError(`atlas: sel "${c.id}" berukuran tidak valid`);
    if (out.has(c.id)) throw new RangeError(`atlas: id ganda "${c.id}"`);
    if (c.w + 2 * pad > width) throw new RangeError(`atlas: sel "${c.id}" lebih lebar dari atlas`);
    if (x + c.w + pad > width) {
      x = pad;
      y += shelfH + pad;
      shelfH = 0;
    }
    if (y + c.h + pad > height) throw new RangeError(`atlas: penuh di sel "${c.id}"`);
    out.set(c.id, { x, y, w: c.w, h: c.h });
    x += c.w + pad;
    shelfH = Math.max(shelfH, c.h);
  }
  return out;
}

/** Persegi piksel → UV (CanvasTexture flipY: v = 1 di tepi atas kanvas). */
export function rectToUv(r, width, height) {
  return { u0: r.x / width, u1: (r.x + r.w) / width, v0: 1 - (r.y + r.h) / height, v1: 1 - r.y / height };
}

/** Kecilkan huruf sampai teks muat `maxW` piksel; kembalikan ukuran px akhir. */
export function fitFont(ctx, text, maxW, px, weight = 'bold') {
  const font = (s) => `${weight} ${s}px sans-serif`;
  const size = fitFontSize((s) => { ctx.font = font(s); return ctx.measureText(text).width; }, Math.round(px), 6, 1, maxW);
  ctx.font = font(size);
  return size;
}

/**
 * @param {{width?:number, height?:number, pad?:number,
 *   cells: Array<{id:string, w:number, h:number, draw(ctx: CanvasRenderingContext2D, w:number, h:number):void}>}} opts
 * @returns {{texture: THREE.CanvasTexture|null, width:number, height:number, cell(id:string): {u0:number,u1:number,v0:number,v1:number}, has(id:string): boolean}}
 */
export function createCanvasAtlas({ width = 1024, height = 1024, pad = 4, cells }) {
  const rects = packShelves(cells, { width, height, pad });
  const uvs = new Map([...rects].map(([id, r]) => [id, Object.freeze(rectToUv(r, width, height))]));
  let texture = null;
  if (hasDocument()) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      for (const c of cells) {
        const r = rects.get(c.id);
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.beginPath();
        ctx.rect(0, 0, r.w, r.h);
        ctx.clip();
        c.draw(ctx, r.w, r.h);
        ctx.restore();
      }
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
    }
  }
  return {
    texture,
    width,
    height,
    has: (id) => uvs.has(id),
    cell(id) {
      const uv = uvs.get(id);
      if (!uv) throw new RangeError(`atlas: sel "${id}" tidak ada`);
      return uv;
    },
  };
}
