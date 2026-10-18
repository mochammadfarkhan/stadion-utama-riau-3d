/**
 * Ornamen LOD0 per arketipe (plan.ornaments, spec §7.1 "Ciri wajib"): teras berkanopi + tangga + tiang
 * bendera + pot (K02), exhaust (K04), kanopi masuk (K05), tempat wudu + rak sandal (K06), etalase +
 * meja-bangku + spanduk menu (K07), tandon atap (K09), ilalang (K10). transform dunia {x,y,z,yaw,sx,sy,sz};
 * +Z lokal ornamen menghadap keluar gedung. Ornamen tak dikenal dilewati (console.warn sekali per id).
 */
import { cellUv } from './atlas.js';

const warned = new Set();

/** Titik lokal ornamen (x kanan, y atas, z keluar) → dunia. */
function L(t, x, y, z) {
  const c = Math.cos(t.yaw);
  const s = Math.sin(t.yaw);
  return [t.x + x * c + z * s, t.y + y, t.z - x * s + z * c];
}

/** Kotak di ruang lokal ornamen (pusat lokal x,y,z; ukuran sx,sy,sz). */
function lbox(b, t, x, y, z, sx, sy, sz, cell, color, opts) {
  const [px, py, pz] = L(t, x, y, z);
  b.box(px, py, pz, sx, sy, sz, t.yaw, cellUv(cell), color, opts);
}

/** Dua quad bersilang (rumput/tanaman), sel potong. */
function cross(b, t, w, h, cell, color) {
  for (const a of [0, Math.PI / 2]) {
    const tt = { ...t, yaw: t.yaw + a };
    b.quad(L(tt, -w / 2, 0, 0), L(tt, w / 2, 0, 0), L(tt, w / 2, h, 0), L(tt, -w / 2, h, 0), cellUv(cell), color);
  }
}

/** Prisma n-sisi tegak (tandon, tiang bulat). */
function prism(b, t, r, h, sides, cell, color) {
  for (let i = 0; i < sides; i += 1) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const p = (a, y) => L(t, Math.cos(a) * r, y, Math.sin(a) * r);
    b.quad(p(a1, 0), p(a0, 0), p(a0, h), p(a1, h), cellUv(cell), color);
  }
  const top = Array.from({ length: sides }, (_, i) => L(t, Math.cos((-i / sides) * Math.PI * 2) * r, h, Math.sin((-i / sides) * Math.PI * 2) * r));
  b.polygon(top, top.map(() => [cellUv(cell).u0, cellUv(cell).v0]), color);
}

const BUILDERS = {
  'teras-kanopi': (s, t, c) => { // pelat kanopi beton di atas dua kolom depan
    const w = t.sx;
    const d = t.sz;
    lbox(s.opak, t, 0, 3.55, 0, w, 0.22, d, 'beton', c.trim, { bottom: true });
    for (const side of [-1, 1]) lbox(s.opak, t, side * (w / 2 - 0.25), 1.75, d / 2 - 0.25, 0.4, 3.5, 0.4, 'beton', c.column);
  },
  'tangga-tengah': (s, t, c) => {
    const steps = Math.max(1, Math.ceil(t.sy / 0.17));
    const rise = t.sy / steps;
    for (let i = 0; i < steps; i += 1) lbox(s.opak, t, 0, rise * (i + 0.5), -(i * t.sz) / steps / 2, t.sx, rise, t.sz - (i * t.sz) / steps, 'tangga', c.floor);
  },
  'tiang-bendera': (s, t, c) => {
    lbox(s.opak, t, 0, 4, 0, 0.09, 8, 0.09, 'besi', c.white);
    lbox(s.opak, t, 0, 0.15, 0, 0.8, 0.3, 0.8, 'beton', c.trim);
    const f = (x, y) => L(t, x, y, 0);
    s.opak.quad(f(0.05, 6.9), f(1.25, 6.9), f(1.25, 7.7), f(0.05, 7.7), cellUv('bendera'), c.white);
    s.opak.quad(f(1.25, 6.9), f(0.05, 6.9), f(0.05, 7.7), f(1.25, 7.7), cellUv('bendera'), c.white);
  },
  pot: (s, t, c) => {
    lbox(s.opak, t, 0, 0.22, 0, 0.5, 0.44, 0.5, 'pot-tanah', c.white);
    cross(s.potong, { ...t, y: t.y + 0.4 }, 1.0, 1.1, 'tanaman-pot', c.white);
  },
  exhaust: (s, t, c) => lbox(s.opak, t, 0, 0, 0.06, 0.7, 0.7, 0.12, 'exhaust', c.white),
  'kanopi-masuk': (s, t, c) => lbox(s.opak, t, 0, 0, 0, t.sx, 0.18, t.sz, 'beton', c.trim, { bottom: true }),
  'tempat-wudu': (s, t, c) => {
    lbox(s.opak, t, 0, 0.55, 0, t.sx, 1.1, 0.3, 'tempat-wudu', c.white);
    lbox(s.opak, t, 0, 0.05, 0.4, t.sx, 0.1, 0.5, 'keramik-lantai', c.white);
  },
  'rak-sandal': (s, t, c) => lbox(s.opak, t, 0, 0.45, 0, 1.2, 0.9, 0.35, 'rak-sandal', c.white),
  etalase: (s, t, c) => lbox(s.opak, t, 0, 0.5, 0, t.sx, 1.0, 0.6, 'etalase', c.white),
  'meja-bangku': (s, t, c) => {
    lbox(s.opak, t, 0, 0.74, 0, t.sx, 0.05, 0.8, 'meja-bangku', c.white);
    for (const z of [-0.65, 0.65]) lbox(s.opak, t, 0, 0.44, z, t.sx, 0.05, 0.3, 'meja-bangku', c.white);
    for (const x of [-t.sx / 2 + 0.2, t.sx / 2 - 0.2]) lbox(s.opak, t, x, 0.36, 0, 0.08, 0.72, 1.5, 'besi', c.white);
  },
  'spanduk-menu': (s, t, c) => {
    const f = (x, y) => L(t, x, y, 0);
    s.opak.quad(f(-t.sx / 2, -0.4), f(t.sx / 2, -0.4), f(t.sx / 2, 0.4), f(-t.sx / 2, 0.4), cellUv('spanduk-menu'), c.white);
  },
  tandon: (s, t, c) => {
    for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) lbox(s.opak, t, x, 0.5, z, 0.08, 1.0, 0.08, 'besi', c.white);
    prism(s.opak, { ...t, y: t.y + 1.0 }, 0.6, 1.3, 8, 'tandon', c.white);
  },
  ilalang: (s, t, c) => cross(s.potong, t, 1.4 * t.sx, 0.9 * t.sx, 'ilalang', c.white),
};

/** Tambah semua ornamen plan ke sink (LOD0 saja). */
export function buildOrnaments(sink, plan, ctx) {
  for (const o of plan.ornaments) {
    const fn = BUILDERS[o.assetId];
    if (!fn) {
      if (!warned.has(o.assetId)) {
        warned.add(o.assetId);
        console.warn(`kit: ornamen "${o.assetId}" belum punya builder`);
      }
      continue;
    }
    fn(sink, o.transform, ctx.colors);
  }
}

export const ORNAMENT_IDS = Object.freeze(Object.keys(BUILDERS));
