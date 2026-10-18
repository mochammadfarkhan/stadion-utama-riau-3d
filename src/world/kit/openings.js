/**
 * Bukaan (spec §7.2 langkah 4): kusen masuk (reveal) 12 cm, isi jendela/pintu mundur dari bidang dinding,
 * ambang, roster tembus (sel potong + latar gelap di belakang), layar perforasi K03 di depan pita kaca,
 * AC luar, balkon berjemuran K09, isian bata K10. Menulis ke sink; y relatif lantai `yFloor`.
 */
import { cellUv, ATLAS_CELLS } from './atlas.js';
import { wp, wallQuad, wallTiled, yawOf } from './kitShapes.js';
import { facePoint } from './planGeom.js';

export const OPENING_GEOM = Object.freeze({
  reveal: 0.12, fillBack: 0.08, rosterBack: 0.06, backing: 0.3, sillH: 0.06, sillOut: 0.06,
  ac: Object.freeze({ w: 0.8, h: 0.55, d: 0.28, below: 0.7 }), rosterTile: Object.freeze({ w: 1.6, h: 0.4 }), balcony: 1.2, screenOut: 0.45, screenTile: 1.2, screenGap: 0.35,
});

/** Reveal (4 sisi dalam lubang) sedalam `depth`, warna dinding. */
function reveal(b, face, op, y0, y1, depth, color) {
  const r = cellUv('plester');
  const L = (u, y) => wp(face, u, y, 0);
  const I = (u, y) => wp(face, u, y, -depth);
  b.quad(L(op.u0, y0), I(op.u0, y0), I(op.u0, y1), L(op.u0, y1), r, color); // kusen kiri (normal +R)
  b.quad(I(op.u1, y0), L(op.u1, y0), L(op.u1, y1), I(op.u1, y1), r, color); // kusen kanan (normal −R)
  b.quad(L(op.u0, y1), I(op.u0, y1), I(op.u1, y1), L(op.u1, y1), r, color); // atas (normal ke bawah)
  b.quad(I(op.u0, y0), L(op.u0, y0), L(op.u1, y0), I(op.u1, y0), r, color); // ambang dalam (normal ke atas)
}

function sill(b, face, op, y0, color) {
  const [x, z] = facePoint(face, (op.u0 + op.u1) / 2, OPENING_GEOM.sillOut / 2);
  b.box(x, y0 - OPENING_GEOM.sillH / 2, z, op.u1 - op.u0 + 0.12, OPENING_GEOM.sillH, OPENING_GEOM.reveal + OPENING_GEOM.sillOut, yawOf(face), cellUv('beton'), color);
}

function acUnit(b, face, op, y0, ctx) {
  const g = OPENING_GEOM.ac;
  const [x, z] = facePoint(face, (op.u0 + op.u1) / 2, g.d / 2 + 0.05);
  b.box(x, y0 - g.below + g.h / 2 - 0.2, z, g.w, g.h, g.d, yawOf(face), cellUv('ac-luar'), ctx.colors.white);
}

function balcony(sink, face, op, y0, ctx) {
  const g = OPENING_GEOM;
  const [x, z] = facePoint(face, (op.u0 + op.u1) / 2, g.balcony / 2);
  const yaw = yawOf(face);
  sink.opak.box(x, y0 - 0.06, z, op.u1 - op.u0, 0.12, g.balcony, yaw, cellUv('beton'), ctx.colors.trim, { bottom: true });
  wallTiled(sink.potong, face, op.u0, op.u1, y0, y0 + op.y1, g.balcony, 'railing', 1.0, op.y1, ctx.colors.white);
  if (op.jemuran) wallTiled(sink.potong, face, op.u0 + 0.1, op.u1 - 0.1, y0 + 0.9, y0 + 2.2, g.balcony - 0.35, 'jemuran', op.u1 - op.u0 - 0.2, 1.3, ctx.colors.white);
}

/**
 * Layar perforasi K03 (lantai atas): panel per bay di antara kolom (celah 0,35 m tiap sisi bay, 0,15 m atas/bawah)
 * pada bidang luar `op.screenOut`; ubin 1,2 m. Celah memperlihatkan kolom putih (ritme fasad foto ADB).
 */
function screen(sink, face, op, yFloor, ctx) {
  const motif = `layar-${ctx.variant ?? 'segitiga'}`;
  const cell = ATLAS_CELLS[motif] ? motif : 'layar-segitiga';
  const g = OPENING_GEOM;
  const u0 = op.bayU0 + g.screenGap;
  const u1 = op.bayU1 - g.screenGap;
  if (u1 - u0 < 0.6) return;
  wallTiled(sink.potong, face, u0, u1, yFloor + 0.15, yFloor + ctx.floorH(op.floor) - 0.15, op.screenOut ?? g.screenOut, cell, g.screenTile, g.screenTile, ctx.colors.screen);
}

/**
 * @param {object} sink kitBuilder sink
 * @param {object} plan BuildingPlan
 * @param {object} face sisi massa
 * @param {object} op bukaan plan
 * @param {number} yFloor y absolut lantai bukaan
 * @param {object} ctx konteks rakit (warna, arketipe)
 */
export function buildOpening(sink, plan, face, op, yFloor, ctx) {
  const y0 = yFloor + op.y0;
  const y1 = yFloor + op.y1;
  const g = OPENING_GEOM;
  switch (op.kind) {
    case 'balkon':
      balcony(sink, face, op, yFloor, ctx);
      return;
    case 'bata':
      wallQuad(sink.opak, face, op.u0, op.u1, y0, y1, -0.02, cellUv(op.cell), ctx.colors.white);
      return;
    case 'lubang':
      return;
    case 'roster':
      reveal(sink.opak, face, op, y0, y1, g.reveal, ctx.colors.wall);
      wallTiled(sink.potong, face, op.u0, op.u1, y0, y1, -g.rosterBack, op.cell, g.rosterTile.w, g.rosterTile.h, ctx.colors.roster);
      wallQuad(sink.opak, face, op.u0, op.u1, y0, y1, -g.backing, cellUv('gelap'), ctx.colors.white);
      return;
    default:
      break;
  }
  reveal(sink.opak, face, op, y0, y1, g.reveal, ctx.colors.wall);
  wallQuad(sink.opak, face, op.u0, op.u1, y0, y1, -g.fillBack, cellUv(op.cell), ctx.colors.white);
  if (op.kind === 'jendela' || op.kind === 'kaca-pita' || op.kind === 'clerestory') sill(sink.opak, face, op, y0, ctx.colors.trim);
  if (op.ac) acUnit(sink.opak, face, op, y0, ctx);
  if (op.layar) screen(sink, face, op, yFloor, ctx);
}
