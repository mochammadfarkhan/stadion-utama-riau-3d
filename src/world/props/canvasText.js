/**
 * Tekstur teks dari canvas 2D. Hanya dibuat jika `document` tersedia (browser);
 * di Node mengembalikan null sehingga pemanggil memakai fallback plane polos.
 */
import { CanvasTexture, Color, SRGBColorSpace } from 'three';

const DEFAULT_WIDTH = 512;
const DEFAULT_HEIGHT = 128;
const PADDING_RATIO = 0.12;

export function hasDocument() {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

/** Warna (number/string) → string CSS. */
export function toCss(color) {
  return `#${new Color(color).getHexString()}`;
}

function drawLines(ctx, lines, width, height, fg, fontPx) {
  ctx.fillStyle = toCss(fg);
  ctx.font = `bold ${fontPx}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineH = fontPx * 1.15;
  const startY = height / 2 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => ctx.fillText(line, width / 2, startY + i * lineH));
}

/**
 * @param {{text:string, width?:number, height?:number, bg?:number|string, fg?:number|string, fontPx?:number, border?:number|string|null}} opts
 * @returns {CanvasTexture|null}
 */
export function createTextTexture({ text, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, bg = 0x1b3f8f, fg = 0xffffff, fontPx, border = null }) {
  if (!hasDocument()) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = toCss(bg);
  ctx.fillRect(0, 0, width, height);
  if (border !== null) {
    ctx.strokeStyle = toCss(border);
    ctx.lineWidth = Math.max(2, height * 0.04);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
  }
  const lines = String(text).split('\n');
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const autoPx = Math.min(height * (1 - PADDING_RATIO * 2) / lines.length / 1.15, (width * (1 - PADDING_RATIO * 2)) / (longest * 0.62));
  drawLines(ctx, lines, width, height, fg, fontPx ?? autoPx);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
