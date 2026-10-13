/**
 * Atlas dekal prosedural 1024×1024 (grid 4 kolom × 3 baris = 12 dekal) dengan
 * kanal alpha, digambar lewat Canvas 2D (browser). Di Node (tanpa `document`)
 * mengembalikan DataTexture kecil transparan sebagai fallback.
 * createDecalAtlas() → { texture, uv(name) } ; uv = { u0, v0, du, dv } sub-rect.
 */
import { CanvasTexture, DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, SRGBColorSpace, ClampToEdgeWrapping } from 'three';
import { createRandom } from '../siteutil/rng.js';
import { hasDocument } from './noise.js';

export const ATLAS_SIZE = 1024;
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 3;
const CELL_W = ATLAS_SIZE / ATLAS_COLS;
const CELL_H = ATLAS_SIZE / ATLAS_ROWS;
const PAD = 6;                 // jarak aman dari tepi sel (anti-bleed mipmap)
const FALLBACK_SIZE = 16;
const ANISOTROPY = 4;
const SEED = 4242;

/** Urutan nama dekal = indeks sel (baris-mayor). */
export const DECAL_NAMES = Object.freeze([
  'crack1', 'crack2', 'oil', 'water',
  'tire', 'moss', 'graffiti1', 'graffiti2',
  'manhole', 'zebra', 'arrow', 'parkingP',
]);

const PALETTE = Object.freeze({
  crack: 'rgba(52,46,40,', oil: 'rgba(28,30,40,', water: 'rgba(70,78,88,',
  tire: 'rgba(40,38,36,', moss: 'rgba(96,140,62,', mossDark: 'rgba(70,110,48,',
  manhole: 'rgba(78,76,72,', manholeRim: 'rgba(48,46,44,', white: 'rgba(250,248,242,',
});

/** Piksel sel (x, y, w, h) untuk indeks i. */
function cellRect(i) {
  const col = i % ATLAS_COLS;
  const row = Math.floor(i / ATLAS_COLS);
  return { x: col * CELL_W + PAD, y: row * CELL_H + PAD, w: CELL_W - PAD * 2, h: CELL_H - PAD * 2 };
}

/** Sub-rect UV (flipY: baris atas kanvas = v mendekati 1). */
function cellUv(i) {
  const r = cellRect(i);
  return Object.freeze({
    u0: r.x / ATLAS_SIZE,
    v0: 1 - (r.y + r.h) / ATLAS_SIZE,
    du: r.w / ATLAS_SIZE,
    dv: r.h / ATLAS_SIZE,
  });
}

/** Gores satu polyline retak: halo kotoran lebar tipis (terbaca dari sudut landai) + inti gelap. */
function strokeCrack(ctx, pts, width) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.lineWidth = width * 3.2;
  ctx.strokeStyle = `${PALETTE.crack}0.22)`;
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = `${PALETTE.crack}0.92)`;
  ctx.stroke();
}

/** Polyline retak bercabang (garis gelap acak); cabang digambar setelah induknya selesai. */
function drawCrack(ctx, w, h, rnd, branches) {
  const walk = (x, y, ang, len, width) => {
    const pts = [[x, y]];
    const forks = [];
    let a = ang;
    for (let i = 0; i < len; i += 1) {
      const [px, py] = pts[pts.length - 1];
      a += rnd.range(-0.55, 0.55);
      pts.push([px + Math.cos(a) * rnd.range(8, 16), py + Math.sin(a) * rnd.range(8, 16)]);
      if (i % 4 === 3 && width > 4 && rnd.chance(0.5)) forks.push([...pts[pts.length - 1], a + rnd.range(-1.4, 1.4)]);
    }
    strokeCrack(ctx, pts, width);
    forks.forEach(([fx, fy, fa]) => walk(fx, fy, fa, Math.floor(len * 0.4), width * 0.55));
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let b = 0; b < branches; b += 1) {
    // retak utama melintang sel (± seluruh lebar), cabang lebih tipis
    walk(rnd.range(w * 0.05, w * 0.2), rnd.range(h * 0.25, h * 0.75), rnd.range(-0.5, 0.5), 18, 14);
  }
}

/** Noda lembut: beberapa gradien radial saling tumpang tindih. */
function drawStain(ctx, w, h, rnd, color, blobs, alpha) {
  for (let i = 0; i < blobs; i += 1) {
    const cx = w * 0.5 + rnd.range(-w * 0.18, w * 0.18);
    const cy = h * 0.5 + rnd.range(-h * 0.18, h * 0.18);
    const r = rnd.range(Math.min(w, h) * 0.18, Math.min(w, h) * 0.36);
    const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    g.addColorStop(0, `${color}${alpha})`);
    g.addColorStop(0.7, `${color}${alpha * 0.55})`);
    g.addColorStop(1, `${color}0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Bekas ban: dua jalur sejajar sumbu v dengan pola tapak dan ujung memudar. */
function drawTire(ctx, w, h, rnd) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `${PALETTE.tire}0)`);
  g.addColorStop(0.25, `${PALETTE.tire}0.55)`);
  g.addColorStop(0.75, `${PALETTE.tire}0.55)`);
  g.addColorStop(1, `${PALETTE.tire}0)`);
  ctx.fillStyle = g;
  const trackW = w * 0.16;
  [w * 0.3, w * 0.7].forEach((cx) => {
    for (let y = 0; y < h; y += 14) {
      const jitter = rnd.range(-2, 2);
      ctx.fillRect(cx - trackW / 2 + jitter, y, trackW, 9);
    }
  });
}

/** Lumut: bercak hijau berbutir. */
function drawMoss(ctx, w, h, rnd) {
  drawStain(ctx, w, h, rnd, PALETTE.moss, 5, 0.8);
  for (let i = 0; i < 160; i += 1) {
    const a = rnd.range(0, Math.PI * 2);
    const d = rnd.range(0, Math.min(w, h) * 0.42);
    ctx.fillStyle = `${PALETTE.mossDark}${rnd.range(0.3, 0.8)})`;
    ctx.beginPath();
    ctx.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d * 0.9, rnd.range(2, 6), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Ukuran font terbesar (≤ maxSize) agar lebar teks ≤ maxWidth (sel atlas sempit). */
function fitFontSize(ctx, text, maxWidth, maxSize) {
  ctx.font = `bold ${Math.floor(maxSize)}px sans-serif`;
  const width = ctx.measureText(text).width;
  return Math.floor(width > maxWidth ? maxSize * (maxWidth / width) : maxSize);
}

/** Grafiti: teks tebal berwarna dengan garis tepi + coretan. */
function drawGraffiti(ctx, w, h, rnd, { text, fill, stroke, scribble }) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rnd.range(-0.12, 0.12));
  ctx.font = `bold ${fitFontSize(ctx, text, w * 0.84, h * 0.42)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
  ctx.strokeStyle = scribble;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.82);
  for (let i = 1; i <= 8; i += 1) ctx.lineTo(w * (0.15 + i * 0.09), h * (0.82 + rnd.range(-0.08, 0.08)));
  ctx.stroke();
}

/** Manhole bulat: cakram gelap, cincin tepi, kisi. */
function drawManhole(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.46;
  ctx.fillStyle = `${PALETTE.manhole}1)`;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `${PALETTE.manholeRim}1)`;
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = r * 0.05;
  for (let i = -3; i <= 3; i += 1) {
    const off = (i / 4) * r * 0.8;
    const half = Math.sqrt(Math.max(0, (r * 0.8) ** 2 - off * off));
    ctx.beginPath();
    ctx.moveTo(cx + off, cy - half);
    ctx.lineTo(cx + off, cy + half);
    ctx.moveTo(cx - half, cy + off);
    ctx.lineTo(cx + half, cy + off);
    ctx.stroke();
  }
}

/** Zebra cross: garis putih sejajar sumbu u, bertumpuk sepanjang v. */
function drawZebra(ctx, w, h) {
  const stripes = 7;
  const step = h / (stripes * 2 - 1);
  ctx.fillStyle = `${PALETTE.white}0.95)`;
  for (let i = 0; i < stripes; i += 1) ctx.fillRect(w * 0.04, i * step * 2, w * 0.92, step);
}

/** Panah lalu lintas lurus menunjuk ke atas tekstur (v tinggi). */
function drawArrow(ctx, w, h) {
  ctx.fillStyle = `${PALETTE.white}0.95)`;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.05);
  ctx.lineTo(w * 0.88, h * 0.38);
  ctx.lineTo(w * 0.64, h * 0.38);
  ctx.lineTo(w * 0.64, h * 0.95);
  ctx.lineTo(w * 0.36, h * 0.95);
  ctx.lineTo(w * 0.36, h * 0.38);
  ctx.lineTo(w * 0.12, h * 0.38);
  ctx.closePath();
  ctx.fill();
}

/** Huruf "P" parkir putih besar. */
function drawParkingP(ctx, w, h) {
  ctx.fillStyle = `${PALETTE.white}0.95)`;
  ctx.font = `bold ${Math.floor(h * 0.9)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', w / 2, h / 2 + h * 0.04);
}

const DRAWERS = Object.freeze({
  crack1: (c, w, h, r) => drawCrack(c, w, h, r, 2),
  crack2: (c, w, h, r) => drawCrack(c, w, h, r, 3),
  oil: (c, w, h, r) => drawStain(c, w, h, r, PALETTE.oil, 4, 0.75),
  water: (c, w, h, r) => drawStain(c, w, h, r, PALETTE.water, 3, 0.45),
  tire: drawTire,
  moss: drawMoss,
  graffiti1: (c, w, h, r) => drawGraffiti(c, w, h, r, { text: 'PSPS', fill: '#e8402a', stroke: '#2a1a40', scribble: 'rgba(40,120,210,0.85)' }),
  graffiti2: (c, w, h, r) => drawGraffiti(c, w, h, r, { text: 'RIAU', fill: '#f2c200', stroke: '#1b2a33', scribble: 'rgba(230,60,120,0.85)' }),
  manhole: drawManhole,
  zebra: drawZebra,
  arrow: drawArrow,
  parkingP: drawParkingP,
});

/** Gambar semua sel atlas ke kanvas. */
function paintAtlas(ctx) {
  const rnd = createRandom(SEED);
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  DECAL_NAMES.forEach((name, i) => {
    const r = cellRect(i);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.translate(r.x, r.y);
    DRAWERS[name](ctx, r.w, r.h, rnd);
    ctx.restore();
  });
}

function finalize(tex) {
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = ANISOTROPY;
  tex.needsUpdate = true;
  return tex;
}

/** Fallback Node: DataTexture kecil, abu-abu setengah transparan. */
function fallbackTexture() {
  const s = FALLBACK_SIZE;
  const data = new Uint8Array(s * s * 4);
  for (let i = 0; i < s * s; i += 1) data.set([90, 90, 90, 128], i * 4);
  return finalize(new DataTexture(data, s, s, RGBAFormat));
}

let cache = null;

/**
 * Atlas dekal (di-cache; satu tekstur untuk seluruh dunia).
 * @returns {{texture: import('three').Texture, uv(name:string): {u0:number,v0:number,du:number,dv:number}, names: string[]}}
 */
export function createDecalAtlas() {
  if (cache) return cache;
  const uvs = Object.fromEntries(DECAL_NAMES.map((n, i) => [n, cellUv(i)]));
  const uv = (name) => {
    const rect = uvs[name];
    if (!rect) throw new Error(`decalAtlas: dekal "${name}" tidak dikenal`);
    return rect;
  };
  let texture;
  if (hasDocument()) {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const ctx = canvas.getContext('2d');
    if (ctx) paintAtlas(ctx);
    texture = ctx ? finalize(new CanvasTexture(canvas)) : fallbackTexture();
  } else {
    texture = fallbackTexture();
  }
  cache = Object.freeze({ texture, uv, names: DECAL_NAMES });
  return cache;
}
