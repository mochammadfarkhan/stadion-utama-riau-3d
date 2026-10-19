/**
 * Atap (spec §7.2 langkah 5): pelana (25°), limas (25°), pelana-lebar K03 (15°, tritisan 2,5 m),
 * limas-tumpang musala (dua tingkat + pita ventilasi), datar-parapet (plat + parapet 0,9 m + coping), datar
 * (K10). Garis atap = footprint + (tritisan − mundur dinding); sisi dalam antar-massa tanpa tritisan.
 * LOD0 menambah lisplang, talang, pipa turun, bubungan, plafon tritisan; LOD1 hanya bidang atap + tebeng.
 */
import { ShapeUtils, Vector2 } from 'three';
import { cellUv } from './atlas.js';
import { floorPolygon, wallTiled, wp } from './kitShapes.js';
import { makeFace } from './planGeom.js';

export const ROOF = Object.freeze({
  corridorEave: 0.4, fascia: 0.22, fasciaWide: 0.35, soffitDrop: 0.1, ridgeCap: 0.35, gutter: 0.12,
  pipe: 0.08, seng: Object.freeze({ w: 2.0, h: 3.0 }), beton: 4, coping: 0.2, ventBand: 0.7, upperPitch: 35,
});

const DEG = Math.PI / 180;

/** Frame atap dari massa kotak: pusat, sumbu lokal x/z dunia, setengah lebar & dalam garis atap. */
export function roofFrame(mass) {
  const { obb, insets, roof } = mass;
  const flat = roof.type === 'datar-parapet' || roof.type === 'datar';
  const ext = (id) => {
    if (flat) return 0;
    if (insets[id] === 0 && mass.faces.find((f) => f.id === id)?.exterior.length === 0) return 0;
    if (mass.corridor.faces.includes(id)) return ROOF.corridorEave;
    return Math.max(0.3, roof.overhang - insets[id]);
  };
  const x0 = -obb.w / 2 - ext('-x');
  const x1 = obb.w / 2 + ext('+x');
  const z0 = -obb.d / 2 - ext('-z');
  const z1 = obb.d / 2 + ext('+z');
  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  const mx = (x0 + x1) / 2;
  const mz = (z0 + z1) / 2;
  return {
    cx: obb.cx + mx * c + mz * s, cz: obb.cz - mx * s + mz * c,
    ax: [c, 0, -s], az: [s, 0, c], hw: (x1 - x0) / 2, hd: (z1 - z0) / 2,
  };
}

/** Frame diputar 90° bila lebih dalam daripada lebar (bubungan selalu di sumbu x frame). */
function longFrame(f) {
  if (f.hw >= f.hd) return f;
  return { ...f, ax: f.az, az: [-f.ax[0], 0, -f.ax[2]], hw: f.hd, hd: f.hw };
}

/** Titik frame lokal (x, y, z) → dunia. */
const P = (f, x, y, z) => [f.cx + f.ax[0] * x + f.az[0] * z, y, f.cz + f.ax[2] * x + f.az[2] * z];
const neg = (v) => [-v[0], -v[1], -v[2]];
const slopeV = (f, dir, pitch) => [-dir * f.az[0] * Math.cos(pitch), Math.sin(pitch), -dir * f.az[2] * Math.cos(pitch)];
const endV = (f, dir, pitch) => [-dir * f.ax[0] * Math.cos(pitch), Math.sin(pitch), -dir * f.ax[2] * Math.cos(pitch)];

/**
 * Bidang atap perisai/pelana dari eave yE: run r (horizontal ke bubungan), `truncate` 0..1 (tumpang), `hip`
 * true = limas (ujung miring), false = pelana (ujung tegak, diisi tebeng). Mengembalikan tinggi puncak.
 */
function slopes(b, f, yE, pitch, hip, truncate, cell, tile, color) {
  const r = f.hd * truncate;
  const S = r / Math.cos(pitch);
  const W = 2 * f.hw;
  const D = 2 * f.hd;
  const rx = hip ? r : 0;
  const quad = (o, U, V, poly) => b.tiled(o, U, V, poly, tile.w, tile.h, cellUv(cell), color);
  quad(P(f, -f.hw, yE, f.hd), f.ax, slopeV(f, 1, pitch), [[0, 0], [W, 0], [W - rx, S], [rx, S]]);
  quad(P(f, f.hw, yE, -f.hd), neg(f.ax), slopeV(f, -1, pitch), [[0, 0], [W, 0], [W - rx, S], [rx, S]]);
  if (hip) {
    const top = D - 2 * r;
    quad(P(f, f.hw, yE, f.hd), neg(f.az), endV(f, 1, pitch), top > 1e-3 ? [[0, 0], [D, 0], [D - r, S], [r, S]] : [[0, 0], [D, 0], [D / 2, S]]);
    quad(P(f, -f.hw, yE, -f.hd), f.az, endV(f, -1, pitch), top > 1e-3 ? [[0, 0], [D, 0], [D - r, S], [r, S]] : [[0, 0], [D, 0], [D / 2, S]]);
  }
  return yE + r * Math.tan(pitch);
}

/** Tebeng (gable) pentagon di ujung dinding untuk atap pelana. */
function gables(b, plan, mass, f, yE, pitch, ctx) {
  const yRoof = (z) => yE + (f.hd - Math.abs(z)) * Math.tan(pitch) - 0.12;
  for (const face of mass.faces) {
    const n = [face.n[0], 0, face.n[1]];
    const along = Math.abs(n[0] * f.ax[0] + n[2] * f.ax[2]);
    if (along < 0.9 || face.exterior.length === 0) continue; // hanya sisi ujung (normal ∥ sumbu bubungan)
    const toLocalZ = (u) => {
      const [x, , z] = wp(face, u, 0);
      return (x - f.cx) * f.az[0] + (z - f.cz) * f.az[2];
    };
    const za = toLocalZ(0);
    const zb = toLocalZ(face.len);
    const um = Math.abs(zb - za) > 1e-6 ? (0 - za) / (zb - za) * face.len : -1;
    const poly = [[0, 0], [face.len, 0], [face.len, yRoof(zb) - yE]];
    if (um > 0.05 && um < face.len - 0.05) poly.push([um, yRoof(0) - yE]);
    poly.push([0, yRoof(za) - yE]);
    const U = [(face.b[0] - face.a[0]) / face.len, 0, (face.b[1] - face.a[1]) / face.len];
    b.tiled(wp(face, 0, yE), U, [0, 1, 0], poly, 3.6, 3.8, cellUv(plan.style.stain ? 'plester-kusam' : 'plester'), ctx.colors.wall);
  }
}

/** Lisplang keliling (eave) + papan miring di ujung pelana. */
function fascia(b, f, yE, yR, hip, ctx) {
  const h = ctx.arch.id === 'K03' ? ROOF.fasciaWide : ROOF.fascia;
  const r = cellUv('lisplang');
  const c = ctx.colors.fascia;
  b.quad(P(f, -f.hw, yE - h, f.hd), P(f, f.hw, yE - h, f.hd), P(f, f.hw, yE + 0.03, f.hd), P(f, -f.hw, yE + 0.03, f.hd), r, c);
  b.quad(P(f, f.hw, yE - h, -f.hd), P(f, -f.hw, yE - h, -f.hd), P(f, -f.hw, yE + 0.03, -f.hd), P(f, f.hw, yE + 0.03, -f.hd), r, c);
  if (hip) {
    b.quad(P(f, f.hw, yE - h, f.hd), P(f, f.hw, yE - h, -f.hd), P(f, f.hw, yE + 0.03, -f.hd), P(f, f.hw, yE + 0.03, f.hd), r, c);
    b.quad(P(f, -f.hw, yE - h, -f.hd), P(f, -f.hw, yE - h, f.hd), P(f, -f.hw, yE + 0.03, f.hd), P(f, -f.hw, yE + 0.03, -f.hd), r, c);
    return;
  }
  for (const sx of [1, -1]) {
    const x = sx * f.hw;
    const zs = sx > 0 ? [f.hd, 0, -f.hd] : [-f.hd, 0, f.hd];
    const ys = [yE, yR, yE];
    for (let i = 0; i < 2; i += 1) {
      b.quad(P(f, x, ys[i] - h, zs[i]), P(f, x, ys[i + 1] - h, zs[i + 1]), P(f, x, ys[i + 1] + 0.03, zs[i + 1]), P(f, x, ys[i] + 0.03, zs[i]), r, c);
    }
  }
}

/** Plafon tritisan: bidang datar menghadap bawah dari garis atap ke dinding (satu quad per sisi garis atap). */
function soffit(b, f, yE, ctx) {
  const r = cellUv('plafon');
  const y = yE - ROOF.soffitDrop;
  b.quad(P(f, f.hw, y, f.hd), P(f, -f.hw, y, f.hd), P(f, -f.hw, y, -f.hd), P(f, f.hw, y, -f.hd), r, ctx.colors.fascia);
}

/** Talang di dua eave panjang + pipa turun di empat sudut dinding. */
function gutters(b, plan, mass, f, yE, ctx) {
  const yaw = Math.atan2(f.az[0], f.az[2]);
  for (const s of [1, -1]) {
    const [x, , z] = P(f, 0, 0, s * (f.hd + ROOF.gutter / 2));
    b.box(x, yE - ROOF.gutter, z, 2 * f.hw, ROOF.gutter, ROOF.gutter, yaw, cellUv('talang'), ctx.colors.white);
  }
  const { obb, wall } = mass;
  const c = Math.cos(obb.yaw);
  const sn = Math.sin(obb.yaw);
  for (const [lx, lz] of [[wall.x0, wall.z0], [wall.x1, wall.z0], [wall.x1, wall.z1], [wall.x0, wall.z1]]) {
    const ox = lx + Math.sign(lx) * 0.1;
    const oz = lz + Math.sign(lz) * 0.1;
    const h = yE - plan.footY;
    b.box(obb.cx + ox * c + oz * sn, plan.footY + h / 2, obb.cz - ox * sn + oz * c, ROOF.pipe, h, ROOF.pipe, obb.yaw, cellUv('talang'), ctx.colors.white);
  }
}

/** Empat sisi (normal keluar) persegi frame — urutan & konvensi sama dengan planGeom.boxMass. */
function rectFaces(f) {
  const w = (x, z) => {
    const p = P(f, x, 0, z);
    return [p[0], p[2]];
  };
  const A = w(-f.hw, -f.hd);
  const B = w(f.hw, -f.hd);
  const C = w(f.hw, f.hd);
  const D = w(-f.hw, f.hd);
  return [makeFace('-z', B, A), makeFace('+x', C, B), makeFace('+z', D, C), makeFace('-x', A, D)];
}

/** Pelana / pelana-lebar / limas / limas-tumpang pada massa kotak. */
function pitchedRoof(sink, plan, mass, ctx, lod) {
  const { roof } = mass;
  const f = longFrame(roofFrame(mass));
  const yE = plan.baseY + plan.height;
  const pitch = roof.pitch * DEG;
  const b = sink.opak;
  const color = ctx.colors.roof;
  const tile = ROOF.seng;
  if (roof.type === 'limas-tumpang') {
    const yMid = slopes(b, f, yE, pitch, true, 0.55, ctx.roofCell, tile, color);
    const inner = { ...f, hw: f.hw - f.hd * 0.55, hd: f.hd * 0.45 };
    for (const face of rectFaces(inner)) wallTiled(b, face, 0, face.len, yMid, yMid + ROOF.ventBand, 0, 'jalusi-alu', 1, ROOF.ventBand, ctx.colors.white);
    const upper = { ...inner, hw: inner.hw + 0.5, hd: inner.hd + 0.5 };
    const yTop = slopes(b, upper, yMid + ROOF.ventBand, ROOF.upperPitch * DEG, true, 1, ctx.roofCell, tile, color);
    if (lod === 0) {
      fascia(b, f, yE, yE, true, ctx);
      soffit(b, f, yE, ctx);
      b.box(upper.cx, yTop + 0.5, upper.cz, 0.18, 1.0, 0.18, 0, cellUv('besi'), ctx.colors.white); // mustaka
    }
    return;
  }
  const hip = roof.type === 'limas';
  const yR = slopes(b, f, yE, pitch, hip, 1, ctx.roofCell, tile, color);
  if (!hip) gables(b, plan, mass, f, yE, pitch, ctx);
  if (lod > 0) return;
  fascia(b, f, yE, yR, hip, ctx);
  soffit(b, f, yE, ctx);
  if (!hip) b.box(f.cx, yR + 0.03, f.cz, 2 * f.hw, 0.08, ROOF.ridgeCap, Math.atan2(f.az[0], f.az[2]), cellUv(ctx.roofCell), ctx.colors.roofDark);
  gutters(b, plan, mass, f, yE, ctx);
}

/** Parapet pada sisi (dalam & luar) + coping. */
function parapetEdge(sink, face, yE, ctx) {
  const H = 0.9;
  for (const [s, e] of face.exterior) {
    wallTiled(sink.opak, face, s, e, yE - 0.3, yE + H, 0, 'plester', 3.6, 1.2, ctx.colors.parapet);
    const inner = { ...face, a: face.b, b: face.a, n: [-face.n[0], -face.n[1]] };
    wallTiled(sink.opak, inner, face.len - e, face.len - s, yE, yE + H, ROOF.coping, 'plester', 3.6, 1.2, ctx.colors.parapet);
    const p = (u, o) => wp(face, u, yE + H, o);
    sink.opak.quad(p(s, 0), p(e, 0), p(e, -ROOF.coping), p(s, -ROOF.coping), cellUv('beton'), ctx.colors.trim);
  }
}

/** Atap datar berparapet: kotak = garis footprint; poligon = ring ditriangulasi (lubang didukung). */
function flatRoof(sink, plan, mass, ctx) {
  const yE = plan.baseY + plan.height;
  if (mass.kind === 'poligon') {
    const contour = mass.ring.map(([x, z]) => new Vector2(x, z));
    const holes = (mass.holes ?? []).map((h) => h.map(([x, z]) => new Vector2(x, z)));
    const all = [...mass.ring, ...(mass.holes ?? []).flat()];
    for (const [i, j, k] of ShapeUtils.triangulateShape(contour, holes)) {
      floorPolygon(sink.opak, [all[i], all[j], all[k]], yE + 0.02, 'atap-beton', ctx.colors.white, ROOF.beton);
    }
    if (mass.roof.type === 'datar-parapet') for (const face of mass.faces) parapetEdge(sink, face, yE, ctx);
    return;
  }
  const f = roofFrame(mass);
  floorPolygon(sink.opak, [P(f, -f.hw, 0, -f.hd), P(f, f.hw, 0, -f.hd), P(f, f.hw, 0, f.hd), P(f, -f.hw, 0, f.hd)].map((p) => [p[0], p[2]]), yE + 0.02, 'atap-beton', ctx.colors.white, ROOF.beton);
  if (mass.roof.type !== 'datar-parapet') return;
  for (const face of rectFaces(f)) {
    const twin = mass.faces.find((mf) => Math.abs(mf.n[0] * face.n[0] + mf.n[1] * face.n[1] - 1) < 1e-3);
    if (twin && twin.exterior.length === 0) continue; // sisi dalam antar-massa
    parapetEdge(sink, face, yE, ctx);
  }
}

/**
 * Drum (16 sisi) + kubah + mahkota di atas atap datar (musala varian 'kubah-kecil', placeholder masjid).
 * @param {object} b MeshBuilder (sink.opak)
 */
export function domeOnRoof(b, cx, cz, y, r, colors) {
  const n = 16;
  const drumH = Math.max(0.8, r * 0.45);
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const p = (a, yy) => [cx + Math.cos(a) * r, yy, cz + Math.sin(a) * r];
    b.quad(p(a1, y), p(a0, y), p(a0, y + drumH), p(a1, y + drumH), cellUv('plester'), colors.wall);
  }
  b.box(cx, y + drumH + 0.06, cz, 2 * r + 0.3, 0.12, 2 * r + 0.3, 0, cellUv('beton'), colors.trim);
  b.dome(cx, y + drumH + 0.12, cz, r, 16, 6, cellUv('seng'), colors.roof);
  b.box(cx, y + drumH + 0.12 + r + 0.5, cz, 0.1, 1.0, 0.1, 0, cellUv('besi'), colors.white);
}

/**
 * @param {object} sink kitBuilder sink
 * @param {object} plan BuildingPlan
 * @param {object} mass massa plan
 * @param {object} ctx konteks rakit
 * @param {0|1} lod
 */
export function buildRoof(sink, plan, mass, ctx, lod = 0) {
  const t = mass.roof.type;
  if (t === 'datar') return;
  if (t === 'datar-parapet' || mass.kind === 'poligon') {
    flatRoof(sink, plan, mass, ctx);
    const main = plan.masses[0] === mass;
    if (main && ctx.arch.id === 'K06' && plan.variant === 'kubah-kecil') {
      domeOnRoof(sink.opak, mass.obb.cx, mass.obb.cz, plan.baseY + plan.height + 0.9, Math.min(mass.obb.w, mass.obb.d) * 0.22, ctx.colors);
    }
    return;
  }
  pitchedRoof(sink, plan, mass, ctx, lod);
}
