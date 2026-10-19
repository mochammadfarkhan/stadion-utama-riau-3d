/**
 * Logika murni atlas daun (dites): tata letak 2x2 varian gerombol, pemilihan UV, sebar daun deterministik, dan penyusun SVG.
 * Dipakai tools/texbake/leafAtlas.mjs (render sharp) dan dijaga selaras dengan skrip Blender v15_pohon_kartu.py (konstanta UV sama).
 * Konvensi UV: `imageRect` = ruang gambar (v ke bawah, seperti glTF); `blenderRect` = ruang Blender (v ke atas).
 */
export const ATLAS_SIZE = 1024;
export const GRID = 2;
export const CELL = ATLAS_SIZE / GRID;
/** Tepi transparan di dalam sel (px) agar mip tidak mencampur sel tetangga. */
export const INSET = 6;

export const PALETTE = Object.freeze({
  shadow: '#1E3F22', dark: '#2E5A2B', light: '#6FA03F', highlight: '#A8C95A', warm: '#D4DE7A', under: '#3E6B2C',
});

/** Varian gerombol: id, posisi sel (kolom, baris dari atas), jenis daun. */
export const VARIANTS = Object.freeze([
  Object.freeze({ id: 'mahoni', col: 0, row: 0, kind: 'pinnate', seed: 101 }),
  Object.freeze({ id: 'akasia', col: 1, row: 0, kind: 'lanceolate', seed: 202 }),
  Object.freeze({ id: 'semak', col: 0, row: 1, kind: 'broad', seed: 303 }),
  Object.freeze({ id: 'rimbun', col: 1, row: 1, kind: 'tiny', seed: 404 }),
]);

/** Persegi UV varian (0..1) dalam ruang gambar, sudah dimasukkan INSET. */
export function imageRect(variant) {
  const pad = INSET / ATLAS_SIZE;
  const u0 = variant.col / GRID + pad;
  const v0 = variant.row / GRID + pad;
  return { u0, v0, u1: (variant.col + 1) / GRID - pad, v1: (variant.row + 1) / GRID - pad };
}

/** Persegi UV ruang Blender (v ke atas): v = 1 - v_gambar. */
export function blenderRect(variant) {
  const r = imageRect(variant);
  return { u0: r.u0, u1: r.u1, v0: 1 - r.v1, v1: 1 - r.v0 };
}

/** Varian menurut id atau indeks (melingkar); varian tak dikenal dilempar. */
export function pickVariant(key) {
  if (typeof key === 'number') return VARIANTS[((key % VARIANTS.length) + VARIANTS.length) % VARIANTS.length];
  const v = VARIANTS.find((x) => x.id === key);
  if (!v) throw new Error(`varian daun tak dikenal: ${key}`);
  return v;
}

/** PRNG kecil deterministik (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R = CELL / 2 - INSET - 4; // jari-jari pakai dalam sel
const rr = (rand, a, b) => a + (b - a) * rand();

/** Satu daun: posisi (x, y px dalam sel), rotasi derajat (0 = ujung ke atas), panjang, lebar, nada 0..1 (0 gelap, 1 terang). */
function leaf(x, y, rot, len, wid, t) {
  return { x, y, rot, len, wid, t: Math.max(0, Math.min(1, t)) };
}

/** Nada menurut posisi: atas/luar-kanan-atas lebih terang (cahaya dari atas), dalam/bawah lebih gelap, plus acak. */
function toneAt(x, y, rand) {
  const nx = (x - CELL / 2) / R;
  const ny = (y - CELL / 2) / R;
  return 0.5 - ny * 0.32 + nx * 0.08 + (rand() - 0.5) * 0.45;
}

function pinnateLeaves(rand) {
  const out = [];
  const fronds = 7;
  for (let f = 0; f < fronds; f += 1) {
    const ang = -100 + (200 * (f + 0.5)) / fronds + (rand() - 0.5) * 18; // kipas ke atas (derajat dari vertikal)
    const rad = (ang * Math.PI) / 180;
    const len = R * rr(rand, 0.78, 0.98);
    const pairs = 6;
    for (let k = 1; k <= pairs; k += 1) {
      const s = (k / (pairs + 0.5)) * len;
      const cx = CELL / 2 + Math.sin(rad) * s;
      const cy = CELL / 2 + R * 0.28 - Math.cos(rad) * s * 0.92;
      const lw = R * 0.115 * (1.1 - (k / (pairs + 1)) * 0.5);
      const ll = R * 0.34 * (1.05 - (k / (pairs + 1)) * 0.35);
      for (const side of [-1, 1]) {
        out.push(leaf(cx, cy, ang + side * rr(rand, 48, 68), ll, lw, toneAt(cx, cy, rand)));
      }
    }
    out.push(leaf(CELL / 2 + Math.sin(rad) * len, CELL / 2 + R * 0.28 - Math.cos(rad) * len * 0.92, ang, R * 0.26, R * 0.1, toneAt(CELL / 2, CELL / 2 - len, rand) + 0.1));
  }
  return out;
}

function lanceolateLeaves(rand) {
  const out = [];
  for (let i = 0; i < 95; i += 1) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * R * 0.72;
    const x = CELL / 2 + Math.cos(a) * d * 1.05;
    const y = CELL / 2 + Math.sin(a) * d * 0.85;
    const rot = (Math.atan2(y - CELL / 2, x - CELL / 2) * 180) / Math.PI + 90 + (rand() - 0.5) * 70;
    out.push(leaf(x, y, rot, R * rr(rand, 0.3, 0.46), R * rr(rand, 0.05, 0.075), toneAt(x, y, rand)));
  }
  return out;
}

function broadLeaves(rand) {
  const out = [];
  for (let i = 0; i < 38; i += 1) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * R * 0.5;
    const x = CELL / 2 + Math.cos(a) * d * 1.1;
    const y = CELL / 2 + Math.sin(a) * d * 0.9;
    const rot = (Math.atan2(y - CELL / 2, x - CELL / 2) * 180) / Math.PI + 90 + (rand() - 0.5) * 80;
    out.push(leaf(x, y, rot, R * rr(rand, 0.42, 0.6), R * rr(rand, 0.17, 0.24), toneAt(x, y, rand)));
  }
  return out;
}

function tinyLeaves(rand) {
  const out = [];
  for (let i = 0; i < 260; i += 1) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * R * 0.86;
    const x = CELL / 2 + Math.cos(a) * d;
    const y = CELL / 2 + Math.sin(a) * d * 0.9;
    out.push(leaf(x, y, rand() * 360, R * rr(rand, 0.1, 0.16), R * rr(rand, 0.055, 0.085), toneAt(x, y, rand)));
  }
  return out;
}

const SCATTER = Object.freeze({ pinnate: pinnateLeaves, lanceolate: lanceolateLeaves, broad: broadLeaves, tiny: tinyLeaves });

/** Daftar daun varian (deterministik dari seed), diurut nada naik: gelap digambar dulu, terang menutupi (lapisan bertumpuk). */
export function scatterLeaves(variant, seed = variant.seed) {
  const fn = SCATTER[variant.kind];
  if (!fn) throw new Error(`jenis daun tak dikenal: ${variant.kind}`);
  return fitToCell(fn(rng(seed))).sort((a, b) => a.t - b.t);
}

/** Skala seluruh gerombol (posisi, panjang, lebar) agar jangkauan tiap daun muat dalam sel: tak ada potongan lurus di tepi sel. */
export function fitToCell(leaves) {
  const half = CELL / 2 - INSET - 2;
  let ext = 0;
  for (const lf of leaves) {
    const rad = (lf.rot * Math.PI) / 180;
    const tx = lf.x + Math.sin(rad) * lf.len;
    const ty = lf.y - Math.cos(rad) * lf.len;
    const w = lf.wid * 1.2;
    for (const [x, y] of [[lf.x, lf.y], [tx, ty], [(lf.x + tx) / 2 + w, (lf.y + ty) / 2], [(lf.x + tx) / 2 - w, (lf.y + ty) / 2]]) {
      ext = Math.max(ext, Math.abs(x - CELL / 2), Math.abs(y - CELL / 2));
    }
  }
  const k = ext > half ? half / ext : 1;
  return leaves.map((lf) => ({ ...lf, x: CELL / 2 + (lf.x - CELL / 2) * k, y: CELL / 2 + (lf.y - CELL / 2) * k, len: lf.len * k, wid: lf.wid * k }));
}

const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** Warna dasar dan ujung daun untuk nada t: gelap→terang lewat palet kampus. */
export function leafTone(t) {
  const base = t < 0.5 ? mix(hex(PALETTE.shadow), hex(PALETTE.dark), t * 2) : mix(hex(PALETTE.dark), hex(PALETTE.light), (t - 0.5) * 2);
  const tip = mix(base, hex(PALETTE.highlight), 0.35 + 0.35 * t);
  return { base: toHex(base), tip: toHex(tip) };
}

const TONE_STEPS = 8;
const toneIndex = (t) => Math.min(TONE_STEPS - 1, Math.floor(t * TONE_STEPS));

function leafPath(len, wid, kind) {
  const w = wid;
  const l = len;
  if (kind === 'lanceolate') return `M0,0 C${w},${-l * 0.2} ${w * 0.8},${-l * 0.7} 0,${-l} C${-w * 0.8},${-l * 0.7} ${-w},${-l * 0.2} 0,0Z`;
  if (kind === 'broad') return `M0,0 C${w * 1.2},${-l * 0.1} ${w * 1.1},${-l * 0.8} 0,${-l} C${-w * 1.1},${-l * 0.8} ${-w * 1.2},${-l * 0.1} 0,0Z`;
  return `M0,0 C${w},${-l * 0.25} ${w * 0.9},${-l * 0.75} 0,${-l} C${-w * 0.9},${-l * 0.75} ${-w},${-l * 0.25} 0,0Z`;
}

/** SVG satu sel (CELL x CELL) berisi semua daun varian; latar transparan. */
export function variantSvg(variant) {
  const leaves = scatterLeaves(variant);
  const defs = [];
  for (let i = 0; i < TONE_STEPS; i += 1) {
    const { base, tip } = leafTone((i + 0.5) / TONE_STEPS);
    defs.push(`<linearGradient id="g${i}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${base}"/><stop offset="0.55" stop-color="${base}"/><stop offset="1" stop-color="${tip}"/></linearGradient>`);
  }
  const body = leaves.map((lf) => {
    const i = toneIndex(lf.t);
    const d = leafPath(lf.len, lf.wid, variant.kind === 'pinnate' ? 'pinnate' : variant.kind);
    const rib = lf.len > R * 0.2
      ? `<path d="M0,0 L0,${(-lf.len * 0.92).toFixed(1)}" stroke="${PALETTE.highlight}" stroke-opacity="0.32" stroke-width="${Math.max(0.8, lf.wid * 0.07).toFixed(2)}" fill="none"/>`
      : '';
    return `<g transform="translate(${lf.x.toFixed(1)} ${lf.y.toFixed(1)}) rotate(${lf.rot.toFixed(1)})"><path d="${d}" fill="url(#g${i})" stroke="${PALETTE.warm}" stroke-opacity="${(0.1 + lf.t * 0.32).toFixed(2)}" stroke-width="${Math.max(0.8, lf.wid * 0.06).toFixed(2)}"/>${rib}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL}" height="${CELL}" viewBox="0 0 ${CELL} ${CELL}"><defs>${defs.join('')}</defs>${body}</svg>`;
}

/** Isi entri manifest untuk atlas (nama, berkas, ukuran, persegi UV ruang gambar dan Blender per varian). */
export function atlasManifestEntry(file, bytes) {
  return {
    name: 'daun', file, size: ATLAS_SIZE, bytes, license: 'CC0-1.0 (dilukis prosedural oleh tools/texbake/leafAtlas.mjs)',
    variants: VARIANTS.map((v) => ({ id: v.id, kind: v.kind, image: imageRect(v), blender: blenderRect(v) })),
  };
}
