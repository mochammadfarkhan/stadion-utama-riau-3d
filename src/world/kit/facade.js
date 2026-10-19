/**
 * Fasad (spec §7.2 langkah 4): dinding per bay per lantai yang dipotong bukaan, pita plint, balok lantai,
 * selasar (lantai, kolom, balok, railing, lampu), struktur terbuka K07 dan rangka K10, serta fasad LOD1
 * (satu quad ber-ubin per sisi per lantai dengan sel bay dilukis). Menulis ke sink (kitBuilder).
 */
import { cellUv } from './atlas.js';
import { subUv } from './kitBuilder.js';
import { facePoint } from './planGeom.js';
import { buildOpening } from './openings.js';
import { floorPolygon, subtractIntervals, wallQuad, wallTiled, wp, yawOf } from './kitShapes.js';

export const FACADE = Object.freeze({
  plinthOut: 0.03, bandH: 0.3, bandOut: 0.06, column: 0.3, beamH: 0.35, beamD: 0.25, railH: 1.0,
  slabT: 0.15, lampEvery: 2, lampY: 0.4,
});

/** Dinding satu bay satu lantai dipotong lubang bukaan (strip vertikal × interval y). UV menerus per bay. */
function bayWall(b, face, bay, y0, fh, holes, cell, color) {
  const xs = [...new Set([bay.u0, bay.u1, ...holes.flatMap((h) => [h.u0, h.u1])])].sort((p, q) => p - q);
  const r = cellUv(cell);
  for (let i = 0; i + 1 < xs.length; i += 1) {
    const s0 = xs[i];
    const s1 = xs[i + 1];
    if (s1 - s0 < 1e-3) continue;
    const mid = (s0 + s1) / 2;
    const cut = holes.filter((h) => h.u0 <= mid && h.u1 >= mid).map((h) => [h.y0, h.y1]);
    for (const [t0, t1] of subtractIntervals(0, fh, cut)) {
      const uv = subUv(r, (s0 - bay.u0) / (bay.u1 - bay.u0), t0 / fh, (s1 - bay.u0) / (bay.u1 - bay.u0), t1 / fh);
      wallQuad(b, face, s0, s1, y0 + t0, y0 + t1, 0, uv, color);
    }
  }
}

const opsOf = (plan, mi, face, floor) => plan.openings.filter((o) => o.mass === mi && o.face === face.id && o.floor === floor);

/** Dinding + bukaan semua bay satu sisi luar (LOD0): per lantai per bay, pita lantai, plint. `yield` per lantai. */
export function* faceWallSteps(sink, plan, mass, mi, face, ctx) {
  const wallCell = plan.style.stain ? 'plester-kusam' : 'plester';
  const faceBays = plan.bays.filter((x) => x.mass === mi && x.face === face.id);
  const faceOps = plan.openings.filter((o) => o.mass === mi && o.face === face.id);
  let y = plan.baseY;
  for (let f = 0; f < plan.floors; f += 1) {
    const fh = plan.floorH[f];
    const ops = faceOps.filter((o) => o.floor === f);
    for (const bay of faceBays) {
      const inBay = ops.filter((o) => o.u0 >= bay.u0 - 1e-6 && o.u1 <= bay.u1 + 1e-6);
      const holes = inBay.filter((o) => o.kind !== 'balkon' && o.kind !== 'bata');
      bayWall(sink.opak, face, bay, y, fh, holes, wallCell, ctx.colors.wall);
      for (const op of inBay) buildOpening(sink, plan, face, op, y, ctx);
    }
    if (f + 1 < plan.floors) floorBand(sink.opak, face, y + fh, ctx);
    y += fh;
    yield;
  }
  plinthBand(sink.opak, plan, mass, face, mi, ctx);
}

/** Pita balok lantai di antara lantai (menonjol). */
function floorBand(b, face, y, ctx) {
  for (const [s, e] of face.exterior) {
    wallTiled(b, face, s, e, y - FACADE.bandH / 2, y + FACADE.bandH / 2, FACADE.bandOut, 'beton', 3, 0.6, ctx.colors.trim);
  }
}

/** Plint: dari kaki (footY) sampai baseY + plinth, dipotong pintu lantai dasar. */
function plinthBand(b, plan, mass, face, mi, ctx) {
  const top = plan.baseY + (ctx.arch.plinth ?? 0.45);
  const doors = opsOf(plan, mi, face, 0).filter((o) => o.y0 === 0).map((o) => [o.u0, o.u1]);
  for (const [s, e] of face.exterior) {
    for (const [p0, p1] of subtractIntervals(s, e, doors)) {
      wallTiled(b, face, p0, p1, plan.footY, top, FACADE.plinthOut, 'plint', 2, 1, ctx.colors.plinth);
    }
  }
}

/** Fasad LOD1 satu sisi: per lantai satu bidang ber-ubin selebar bay (sel bay dilukis; sebagian menyala). */
export function faceWallsLod1(sink, plan, face, mi, ctx) {
  const n = Math.max(1, face.bays);
  let y = plan.baseY;
  for (let f = 0; f < plan.floors; f += 1) {
    const fh = plan.floorH[f];
    const lit = ctx.lod1Lit && ((plan.seed >>> ((f * 3 + mi * 5 + face.id.length) % 24)) & 3) === 0;
    const cell = lit ? ctx.lod1LitCell : ctx.lod1Cell;
    for (const [s, e] of face.exterior) {
      const tw = (e - s) / Math.max(1, Math.round((e - s) / (face.len / n)));
      wallTiled(sink.opak, face, s, e, y, y + fh, 0, cell, tw, fh, ctx.colors.wall);
    }
    y += fh;
  }
}

/** K12 satu sisi (spec §7.1 "ekstrusi + parapet + modul jendela beratlas"): fasad dilukis + pita + plint + pintu. */
export function facePainted(sink, plan, mass, mi, face, ctx) {
  faceWallsLod1(sink, plan, face, mi, ctx);
  let y = plan.baseY;
  for (let f = 0; f + 1 < plan.floors; f += 1) {
    y += plan.floorH[f];
    floorBand(sink.opak, face, y, ctx);
  }
  plinthBand(sink.opak, plan, mass, face, mi, ctx);
  for (const op of opsOf(plan, mi, face, 0)) {
    wallQuad(sink.opak, face, op.u0, op.u1, plan.baseY + op.y0, plan.baseY + op.y1, 0.015, cellUv(op.cell), ctx.colors.white);
  }
}

/** Ujung kiri/kanan selasar: mundur sisi tetangga (menutup sudut footprint). */
function corridorSpan(mass, face) {
  const i = mass.faces.indexOf(face);
  const left = mass.faces[(i + 1) % mass.faces.length];
  const right = mass.faces[(i + mass.faces.length - 1) % mass.faces.length];
  return [-(mass.insets?.[left.id] ?? 0), face.len + (mass.insets?.[right.id] ?? 0)];
}

/** Bidang horizontal di zona selasar (u0..u1 × out0..out1) pada ketinggian y; up=true menghadap atas. */
function corridorPlane(b, face, u0, u1, out0, out1, y, cell, tile, color, up = true) {
  const p = (u, o) => wp(face, u, y, o);
  const U = [(face.b[0] - face.a[0]) / face.len, 0, (face.b[1] - face.a[1]) / face.len];
  const N = [face.n[0], 0, face.n[1]];
  if (up) b.tiled(p(u0, out1), U, [-N[0], 0, -N[2]], [[0, 0], [u1 - u0, 0], [u1 - u0, out1 - out0], [0, out1 - out0]], tile, tile, cellUv(cell), color);
  else b.tiled(p(u0, out0), U, N, [[0, 0], [u1 - u0, 0], [u1 - u0, out1 - out0], [0, out1 - out0]], tile, tile, cellUv(cell), color);
}

/** Selasar: lantai/plat, kolom di tepi footprint per batas bay, balok, railing lantai atas, lampu. */
export function buildCorridors(sink, plan, mass, mi, ctx) {
  const depth = mass.corridor.depth;
  if (!depth) return;
  for (const id of mass.corridor.faces) {
    const face = mass.faces.find((f) => f.id === id);
    const [u0, u1] = corridorSpan(mass, face);
    const edge = depth - FACADE.column / 2;
    const bays = plan.bays.filter((x) => x.mass === mi && x.face === id);
    const cols = [...new Set([u0 + FACADE.column / 2, ...bays.map((x) => x.u0), u1 - FACADE.column / 2])].filter((u) => u >= u0 && u <= u1);
    const floorCell = ctx.arch.id === 'K10' || ctx.arch.id === 'K04' ? 'rabat' : 'keramik-lantai';
    corridorPlane(sink.opak, face, u0, u1, 0, depth, plan.baseY, floorCell, 1.6, ctx.colors.floor);
    wallTiled(sink.opak, face, u0, u1, plan.footY, plan.baseY, depth, 'plint', 2, 1, ctx.colors.plinth);
    let y = plan.baseY;
    for (let f = 0; f < plan.floors; f += 1) {
      const fh = plan.floorH[f];
      for (const u of cols) {
        const [x, z] = facePoint(face, u, edge);
        sink.opak.box(x, y + fh / 2, z, FACADE.column, fh, FACADE.column, yawOf(face), cellUv('beton'), ctx.colors.column);
      }
      const top = y + fh;
      wallTiled(sink.opak, face, u0, u1, top - FACADE.beamH, top, depth + 0.01, 'beton', 3.6, FACADE.beamH, ctx.colors.trim);
      corridorPlane(sink.opak, face, u0, u1, 0, depth, top - FACADE.beamH, 'plafon', 2.4, ctx.colors.fascia, false);
      if (f > 0) railings(sink.potong, face, cols, y, edge, ctx);
      lamps(sink.opak, face, bays, top - FACADE.lampY, depth / 2, ctx);
      if (f + 1 < plan.floors) corridorPlane(sink.opak, face, u0, u1, 0, depth, top, floorCell, 1.6, ctx.colors.floor);
      y = top;
    }
  }
}

function railings(b, face, cols, y, edge, ctx) {
  for (let i = 0; i + 1 < cols.length; i += 1) {
    const a = cols[i] + FACADE.column / 2;
    const c = cols[i + 1] - FACADE.column / 2;
    if (c - a > 0.2) wallTiled(b, face, a, c, y, y + FACADE.railH, edge, 'railing', 1.0, FACADE.railH, ctx.colors.white);
  }
}

function lamps(b, face, bays, y, out, ctx) {
  bays.forEach((bay, i) => {
    if (i % FACADE.lampEvery) return;
    const [x, z] = facePoint(face, (bay.u0 + bay.u1) / 2, out);
    b.box(x, y, z, 1.2, 0.06, 0.12, yawOf(face) + Math.PI / 2, cellUv('lampu'), ctx.colors.white);
  });
}

/** K07: kolom keliling di tepi footprint, lantai rabat/keramik, dinding belakang setengah (kantin). */
export function buildOpenStructure(sink, plan, mass, mi, ctx) {
  const parkir = plan.variant === 'parkir';
  const h = plan.height;
  for (const face of mass.faces) {
    const bays = plan.bays.filter((x) => x.mass === mi && x.face === face.id);
    for (const u of [...bays.map((x) => x.u0), face.len - FACADE.column / 2]) {
      const [x, z] = facePoint(face, Math.max(FACADE.column / 2, u), -FACADE.column / 2);
      sink.opak.box(x, plan.baseY + h / 2, z, FACADE.column, h, FACADE.column, 0, cellUv(parkir ? 'besi' : 'beton'), parkir ? ctx.colors.white : ctx.colors.column);
    }
    if (!parkir && face.role === 'belakang') {
      wallTiled(sink.opak, face, 0, face.len, plan.baseY, plan.baseY + 1.1, -0.05, 'keramik-dinding', 1.6, 1.1, ctx.colors.white);
    }
    wallTiled(sink.opak, face, 0, face.len, plan.footY, plan.baseY, 0, 'plint', 2, 1, ctx.colors.plinth);
  }
  const top = mass.faces[0];
  const ring = mass.faces.map((f) => [f.a[0], f.a[1]]);
  floorPolygon(sink.opak, ring, plan.baseY, parkir ? 'rabat' : 'keramik-lantai', ctx.colors.floor);
  if (top && !parkir) wallTiled(sink.opak, top, 0, top.len, plan.baseY + h - 0.45, plan.baseY + h, 0.02, 'lisplang', 3, 0.45, ctx.colors.fascia);
}

/** K10: kolom grid (keliling + dalam) tiap bay, plat tiap lantai, bata sebagian & lubang, besi tulangan di puncak. */
export function buildFrame(sink, plan, mass, mi, ctx) {
  const { obb, wall } = mass;
  const nx = Math.max(1, Math.round((wall.x1 - wall.x0) / ctx.arch.bay));
  const nz = Math.max(1, Math.round((wall.z1 - wall.z0) / ctx.arch.bay));
  const cos = Math.cos(obb.yaw);
  const sin = Math.sin(obb.yaw);
  const W = (lx, lz) => [obb.cx + lx * cos + lz * sin, obb.cz - lx * sin + lz * cos];
  let y = plan.baseY;
  for (let f = 0; f < plan.floors; f += 1) {
    const fh = plan.floorH[f];
    for (let i = 0; i <= nx; i += 1) {
      for (let j = 0; j <= nz; j += 1) {
        const [x, z] = W(wall.x0 + ((wall.x1 - wall.x0) * i) / nx, wall.z0 + ((wall.z1 - wall.z0) * j) / nz);
        sink.opak.box(x, y + fh / 2, z, 0.35, fh, 0.35, obb.yaw, cellUv('beton-mentah'), ctx.colors.column);
        if (f === plan.floors - 1 && plan.variant !== 'beratap') rebar(sink.potong, x, y + fh, z, ctx);
      }
    }
    const slabY = y + fh;
    const [cx, cz] = W((wall.x0 + wall.x1) / 2, (wall.z0 + wall.z1) / 2);
    sink.opak.box(cx, slabY - 0.1, cz, wall.x1 - wall.x0 + 0.4, 0.2, wall.z1 - wall.z0 + 0.4, obb.yaw, cellUv('beton-mentah'), ctx.colors.wall, { bottom: true });
    for (const face of mass.faces) {
      for (const op of opsOf(plan, mi, face, f)) if (op.kind === 'bata') buildOpening(sink, plan, face, op, y, ctx);
    }
    y = slabY;
  }
  const [gx, gz] = W((wall.x0 + wall.x1) / 2, (wall.z0 + wall.z1) / 2);
  sink.opak.box(gx, (plan.footY + plan.baseY) / 2, gz, wall.x1 - wall.x0 + 0.4, plan.baseY - plan.footY, wall.z1 - wall.z0 + 0.4, obb.yaw, cellUv('beton-mentah'), ctx.colors.plinth);
}

function rebar(b, x, y, z, ctx) {
  for (const a of [0, Math.PI / 2]) {
    const c = Math.cos(a) * 0.3;
    const s = Math.sin(a) * 0.3;
    b.quad([x - c, y, z + s], [x + c, y, z - s], [x + c, y + 0.9, z - s], [x - c, y + 0.9, z + s], cellUv('besi-tulangan'), ctx.colors.white);
  }
}
