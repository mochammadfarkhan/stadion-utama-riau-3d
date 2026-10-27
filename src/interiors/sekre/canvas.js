/**
 * Util bersama interior sekre: kanvas & CanvasTexture, teks pas lebar, bungkus baris, selotip, derau kertas,
 * siluet "foto" pengurus, belah ketupat, bidang ber-UV atlas, dan warna vertex rata (material vertexColors
 * bersama → banyak placeholder tergabung menjadi satu draw call). Tanpa berkas gambar berlisensi.
 */
import * as THREE from 'three';
import { fitFontSize } from '../../world/util/fitText.js';

export const FONT = '"Inter Variable", "Segoe UI", Arial, sans-serif';
export const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
export const ATLAS_SIZE = 1024;

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** CanvasTexture sRGB + anisotropi; `repeat` untuk permukaan berulang (dinding, lantai, plafon). */
export function canvasTexture(canvas, renderer, { repeat = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  return tex;
}

/** Set c.font dengan ukuran terbesar ≤ size yang membuat teks muat maxWidth; kembalikan ukurannya. */
export function fitFont(c, text, maxWidth, { weight = 700, size = 32, family = FONT, min = 8 } = {}) {
  const font = (s) => `${weight} ${s}px ${family}`;
  const str = String(text);
  const s = fitFontSize((px) => { c.font = font(px); return c.measureText(str).width; }, size, min, 1, maxWidth);
  c.font = font(s);
  return s;
}

/** Pecah teks menjadi baris ≤ maxWidth memakai font c.font saat ini. */
export function wrapLines(c, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && c.measureText(next).width > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Potongan selotip bening kekuningan (miring `rot` rad) berpusat (x, y). */
export function tape(c, x, y, w, h, rot) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.fillStyle = 'rgba(236,226,186,0.78)';
  c.fillRect(-w / 2, -h / 2, w, h);
  c.strokeStyle = 'rgba(160,150,110,0.25)';
  c.strokeRect(-w / 2, -h / 2, w, h);
  c.restore();
}

/** Bintik halus kertas/papan. */
export function paperNoise(c, w, h, rnd, count = 700) {
  for (let i = 0; i < count; i += 1) {
    c.fillStyle = `rgba(${rnd() < 0.5 ? '120,110,90' : '255,255,255'},${0.03 + rnd() * 0.05})`;
    c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

/** Kotak "foto" pengurus: siluet kepala + bahu (bukan foto orang sungguhan). */
export function silhouette(c, x, y, w, h, bg = '#c9d3dc', fg = '#8796a5') {
  c.fillStyle = bg;
  c.fillRect(x, y, w, h);
  c.fillStyle = fg;
  c.beginPath();
  c.arc(x + w / 2, y + h * 0.4, Math.min(w, h) * 0.2, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(x + w / 2, y + h, w * 0.36, h * 0.36, 0, Math.PI, Math.PI * 2);
  c.fill();
}

export function diamond(c, x, y, rx, ry) {
  c.beginPath();
  c.moveTo(x, y - ry);
  c.lineTo(x + rx, y);
  c.lineTo(x, y + ry);
  c.lineTo(x - rx, y);
  c.closePath();
  c.fill();
}

/**
 * PlaneGeometry width × height (normal +Z) dengan UV menunjuk persegi [px, py, pw, ph] (piksel, origin kiri-atas)
 * pada atlas berukuran `size` (CanvasTexture flipY default: v = 1 di baris atas).
 */
export function atlasPlane(width, height, [px, py, pw, ph], size = ATLAS_SIZE) {
  const g = new THREE.PlaneGeometry(width, height);
  const uv = g.attributes.uv;
  const u0 = px / size;
  const u1 = (px + pw) / size;
  const vTop = 1 - py / size;
  const vBottom = 1 - (py + ph) / size;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), vBottom + uv.getY(i) * (vTop - vBottom));
  uv.needsUpdate = true;
  return g;
}

/** Tambahkan atribut warna vertex rata (warna sRGB hex/string → linear) ke geometri; kembalikan geometri. */
export function tint(geometry, color) {
  const col = new THREE.Color(color);
  const n = geometry.attributes.position.count;
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    data[i * 3] = col.r;
    data[i * 3 + 1] = col.g;
    data[i * 3 + 2] = col.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return geometry;
}
