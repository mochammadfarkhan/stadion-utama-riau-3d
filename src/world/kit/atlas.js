/**
 * Atlas fasad prosedural 2048² (spec §7.3): daftar sel & koordinat piksel PERSIS, UV per sel, dan pembuat
 * tiga canvas selaras tata letak: warna (2048², sRGB, alfa untuk sel potong), kekasaran (256², kanal G),
 * emisif (512², jendela/lampu menyala malam). Slot dasar 256 px; sel boleh setengah/seperempat slot.
 * UV mengikuti CanvasTexture flipY: v = 1 − y/2048; tiap sel di-inset 4 px agar mipmap tidak bocor.
 * Sel 'tint' digambar netral terang dan diwarnai warna vertex (palet); sel lain digambar berwarna asli.
 */
import { createRandom } from '../siteutil/rng.js';
import { SURFACE_PAINTERS } from './atlasPaint.surfaces.js';
import { OPENING_PAINTERS } from './atlasPaint.openings.js';
import { MISC_PAINTERS, GLOW_RECTS } from './atlasPaint.misc.js';

export const ATLAS_SIZE = 2048;
export const ROUGH_SIZE = 256;
export const GLOW_SIZE = 512;
const INSET_PX = 4;

/** [id, x, y, w, h, kekasaran 0..1, potong(alfa)?, menyala?] */
const LAYOUT = [
  // Baris 0 (y 0): dinding (tint)
  ['plester', 0, 0, 256, 256, 0.92], ['plester-kusam', 256, 0, 256, 256, 0.94], ['beton', 512, 0, 256, 256, 0.9],
  ['beton-mentah', 768, 0, 256, 256, 0.95], ['beton-coret', 1024, 0, 256, 256, 0.9], ['bata-merah', 1280, 0, 256, 256, 0.95],
  ['keramik-dinding', 1536, 0, 256, 256, 0.35], ['kayu-papan', 1792, 0, 256, 256, 0.85],
  // Baris 1 (y 256): atap & lantai
  ['seng', 0, 256, 256, 256, 0.5], ['seng-karat', 256, 256, 256, 256, 0.7], ['genteng', 512, 256, 256, 256, 0.85],
  ['atap-beton', 768, 256, 256, 256, 0.95], ['keramik-lantai', 1024, 256, 256, 256, 0.4], ['rabat', 1280, 256, 256, 256, 0.95],
  ['plafon', 1536, 256, 256, 256, 0.9], ['plint', 1792, 256, 256, 256, 0.95],
  // Baris 2 (y 512): jendela
  ['nako', 0, 512, 256, 256, 0.15], ['nako-tirai', 256, 512, 256, 256, 0.15], ['nako-nyala', 512, 512, 256, 256, 0.15, false, true],
  ['jalusi-kayu', 768, 512, 256, 256, 0.8], ['kaca-biru', 1024, 512, 256, 256, 0.08], ['kaca-biru-nyala', 1280, 512, 256, 256, 0.08, false, true],
  ['clerestory', 1536, 512, 256, 128, 0.15], ['kaca-gelap', 1536, 640, 256, 128, 0.1],
  ['jalusi-alu', 1792, 512, 128, 128, 0.45], ['ac-luar', 1920, 512, 128, 128, 0.6], ['exhaust', 1792, 640, 128, 128, 0.5],
  ['lampu', 1920, 640, 128, 128, 0.3, false, true],
  // Baris 3 (y 768): pintu & benda kecil
  ['pintu-kayu', 0, 768, 128, 256, 0.75], ['pintu-kaca', 128, 768, 128, 256, 0.15], ['pintu-ganda', 256, 768, 256, 256, 0.7],
  ['pintu-gulung', 512, 768, 256, 256, 0.55], ['gelap', 768, 768, 128, 128, 0.95], ['besi', 896, 768, 128, 128, 0.5],
  ['kayu-tiang', 768, 896, 128, 128, 0.8], ['tandon', 896, 896, 128, 128, 0.6],
  ['lisplang', 1024, 768, 256, 64, 0.85], ['talang', 1024, 832, 256, 64, 0.5], ['papan-kosong', 1024, 896, 256, 64, 0.6],
  ['spanduk-menu', 1024, 960, 256, 64, 0.9], ['etalase', 1280, 768, 256, 128, 0.2], ['tempat-wudu', 1280, 896, 256, 128, 0.4],
  ['rak-sandal', 1536, 768, 256, 128, 0.8], ['meja-bangku', 1536, 896, 256, 128, 0.8],
  ['bendera', 1792, 768, 128, 128, 0.9], ['pot-tanah', 1920, 768, 128, 128, 0.9], ['tangga', 1792, 896, 256, 128, 0.9],
  // Baris 4 (y 1024): sel potong (alfa) — material 'potong'
  ['roster-kotak', 0, 1024, 256, 64, 0.92, true], ['roster-lingkaran', 0, 1088, 256, 64, 0.92, true],
  ['roster-silang', 0, 1152, 256, 64, 0.92, true], ['roster-bunga', 0, 1216, 256, 64, 0.92, true],
  ['roster-krawangan', 256, 1024, 256, 64, 0.92, true], ['railing', 256, 1088, 128, 128, 0.5, true],
  ['besi-tulangan', 384, 1088, 128, 128, 0.7, true], ['ilalang-kecil', 256, 1216, 256, 64, 0.9, true],
  ['layar-segitiga', 512, 1024, 256, 256, 0.55, true], ['layar-vertikal', 768, 1024, 256, 256, 0.55, true],
  ['layar-wajik', 1024, 1024, 256, 256, 0.55, true], ['ilalang', 1280, 1024, 256, 256, 0.9, true],
  ['jemuran', 1536, 1024, 256, 256, 0.9, true], ['tanaman-pot', 1792, 1024, 256, 256, 0.85, true],
  // Baris 5–6 (y 1280, 1536): fasad LOD1 (satu bay dilukis) — tint
  ['lod1-kuliah', 0, 1280, 256, 256, 0.85], ['lod1-kuliah-nyala', 256, 1280, 256, 256, 0.85, false, true],
  ['lod1-adb', 512, 1280, 256, 256, 0.7], ['lod1-adb-nyala', 768, 1280, 256, 256, 0.7, false, true],
  ['lod1-lab', 1024, 1280, 256, 256, 0.85], ['lod1-rusun', 1280, 1280, 256, 256, 0.85],
  ['lod1-rusun-nyala', 1536, 1280, 256, 256, 0.85, false, true], ['lod1-mangkrak', 1792, 1280, 256, 256, 0.95],
  ['lod1-polos', 0, 1536, 256, 256, 0.9], ['lod1-kantin', 256, 1536, 256, 256, 0.9], ['lod1-aula', 512, 1536, 256, 256, 0.9],
  ['lod1-jalusi', 768, 1536, 256, 256, 0.85],
];

/** Sel atlas beku: { x, y, w, h, rough, alpha, glow }. */
export const ATLAS_CELLS = Object.freeze(Object.fromEntries(LAYOUT.map(([id, x, y, w, h, rough, alpha = false, glow = false]) => [
  id, Object.freeze({ x, y, w, h, rough, alpha, glow }),
])));

const UV_CACHE = new Map();
let warnedUnknown = false;

/** UV rect {u0,v0,u1,v1} sel `id` (v bawah→atas). Id tak dikenal → 'plester' + console.warn sekali. */
export function cellUv(id) {
  const hit = UV_CACHE.get(id);
  if (hit) return hit;
  let c = ATLAS_CELLS[id];
  if (!c) {
    if (!warnedUnknown) {
      warnedUnknown = true;
      console.warn(`atlas: sel "${id}" tidak ada, memakai "plester"`);
    }
    c = ATLAS_CELLS.plester;
  }
  const r = Object.freeze({
    u0: (c.x + INSET_PX) / ATLAS_SIZE,
    u1: (c.x + c.w - INSET_PX) / ATLAS_SIZE,
    v0: 1 - (c.y + c.h - INSET_PX) / ATLAS_SIZE,
    v1: 1 - (c.y + INSET_PX) / ATLAS_SIZE,
  });
  UV_CACHE.set(id, r);
  return r;
}

export const PAINTERS = Object.freeze({ ...SURFACE_PAINTERS, ...OPENING_PAINTERS, ...MISC_PAINTERS });

function defaultCanvas(w, h) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Lukis satu sel ke ctx warna (dipotong ke rect sel). */
function paintColorCell(ctx, id, cell, seed) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(cell.x, cell.y, cell.w, cell.h);
  ctx.clip();
  ctx.translate(cell.x, cell.y);
  const painter = PAINTERS[id];
  if (!painter) throw new Error(`atlas: painter sel "${id}" tidak ada`);
  painter(ctx, cell.w, cell.h, createRandom(seed));
  ctx.restore();
}

/** Lukis area menyala sel `id` ke ctx emisif berskala k. */
function paintGlowCell(ctx, id, cell, k) {
  const rects = GLOW_RECTS[id] ?? [[0, 0, 1, 1]];
  for (const [rx, ry, rw, rh] of rects) {
    const x = (cell.x + rx * cell.w) * k;
    const y = (cell.y + ry * cell.h) * k;
    const g = ctx.createLinearGradient(0, y, 0, y + rh * cell.h * k);
    g.addColorStop(0, '#fff1cf');
    g.addColorStop(1, '#ffd58a');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, rw * cell.w * k, rh * cell.h * k);
  }
}

/**
 * Tiga canvas atlas (warna, kekasaran, emisif); null bila tidak ada canvas (Node/tes).
 * @param {{createCanvas?: (w:number, h:number) => HTMLCanvasElement|null}} [opts]
 */
export function createAtlasCanvases({ createCanvas = defaultCanvas } = {}) {
  const color = createCanvas(ATLAS_SIZE, ATLAS_SIZE);
  const rough = createCanvas(ROUGH_SIZE, ROUGH_SIZE);
  const glow = createCanvas(GLOW_SIZE, GLOW_SIZE);
  const cc = color?.getContext('2d');
  const rc = rough?.getContext('2d');
  const gc = glow?.getContext('2d');
  if (!cc || !rc || !gc) return null;
  cc.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  rc.fillStyle = 'rgb(235,235,235)';
  rc.fillRect(0, 0, ROUGH_SIZE, ROUGH_SIZE);
  gc.fillStyle = '#000';
  gc.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  const kr = ROUGH_SIZE / ATLAS_SIZE;
  const kg = GLOW_SIZE / ATLAS_SIZE;
  LAYOUT.forEach(([id], i) => {
    const cell = ATLAS_CELLS[id];
    paintColorCell(cc, id, cell, 1000 + i * 7919);
    const v = Math.round(cell.rough * 255);
    rc.fillStyle = `rgb(${v},${v},${v})`;
    rc.fillRect(cell.x * kr, cell.y * kr, cell.w * kr, cell.h * kr);
    if (cell.glow) paintGlowCell(gc, id, cell, kg);
  });
  return { color, rough, glow };
}
