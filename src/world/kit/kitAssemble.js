/**
 * Perakit kit: BuildingPlan → geometri di sink (kitBuilder). Memilih jalur per arketipe efektif (plan.kit):
 * K07 struktur terbuka, K10 rangka, lainnya dinding + selasar + bukaan; atap per massa; ornamen (LOD0).
 * LOD1 (spec §7.4): massa + atap + fasad atlas (sel bay dilukis), tanpa selasar/ornamen/bukaan nyata.
 */
import { ARCHETYPES, PALETTES } from './archetypes.js';
import { linearColor } from './kitBuilder.js';
import { buildCorridors, buildFrame, buildOpenStructure, faceWallSteps, facePainted, faceWallsLod1 } from './facade.js';
import { buildRoof } from './roofs.js';
import { buildOrnaments } from './ornaments.js';
import { floorPolygon } from './kitShapes.js';

/** Sel fasad LOD1 per arketipe efektif: [sel, sel menyala | null]. */
export const LOD1_CELLS = Object.freeze({
  K01: ['lod1-kuliah', 'lod1-kuliah-nyala'], K02: ['lod1-kuliah', 'lod1-kuliah-nyala'], K03: ['lod1-adb', 'lod1-adb-nyala'],
  K04: ['lod1-lab', null], K05: ['lod1-aula', null], K06: ['lod1-kuliah', 'lod1-kuliah-nyala'], K07: ['lod1-kantin', null],
  K08: ['lod1-jalusi', null], K09: ['lod1-rusun', 'lod1-rusun-nyala'], K10: ['lod1-mangkrak', null], K11: ['lod1-polos', null],
  K12: ['lod1-kuliah', 'lod1-kuliah-nyala'],
});

/** Konteks rakit: warna linear (dengan variasi seed), arketipe efektif, sel atap, sel LOD1. */
export function assembleContext(plan) {
  const arch = ARCHETYPES[plan.kit] ?? ARCHETYPES.K12;
  const pal = PALETTES[plan.palette] ?? PALETTES['krem-seng'];
  const k = plan.style.tint;
  const seng = plan.palette === 'krem-genteng' ? 'genteng' : plan.style.rust || plan.variant === 'beratap' ? 'seng-karat' : 'seng';
  const [lod1Cell, lod1LitCell] = LOD1_CELLS[arch.id];
  return {
    arch,
    variant: plan.variant,
    floorH: (f) => plan.floorH[f],
    roofCell: seng,
    lod1Cell,
    lod1LitCell,
    lod1Lit: Boolean(lod1LitCell),
    colors: {
      wall: linearColor(pal.wall, k), trim: linearColor(pal.trim, k), plinth: linearColor(pal.plinth), column: linearColor(pal.column, k),
      roof: linearColor(pal.roof), roofDark: linearColor(pal.roof, 0.82), fascia: linearColor(pal.fascia), floor: linearColor(pal.floor),
      screen: linearColor(pal.screen ?? 0xc4602f), parapet: linearColor(plan.palette === 'putih' ? pal.fascia : pal.wall, k),
      roster: linearColor(pal.trim), white: [1, 1, 1],
    },
  };
}

/**
 * Langkah perakitan satu gedung ke sink (generator; tiap `yield` = titik potong scheduler ≤ ±2 ms):
 * per sisi dinding, selasar, atap per massa, lalu ornamen.
 * @param {ReturnType<import('./kitBuilder.js').createKitSink>} sink
 * @param {object} plan BuildingPlan
 * @param {{lod?: 0|1}} [opts]
 */
export function* appendBuildingSteps(sink, plan, { lod = 0 } = {}) {
  const ctx = assembleContext(plan);
  const id = ctx.arch.id;
  for (let mi = 0; mi < plan.masses.length; mi += 1) {
    const mass = plan.masses[mi];
    if (id === 'K07') buildOpenStructure(sink, plan, mass, mi, ctx);
    else if (id === 'K10') buildFrame(sink, plan, mass, mi, ctx);
    else {
      for (const face of mass.faces) {
        if (lod > 0) faceWallsLod1(sink, plan, face, mi, ctx);
        else if (id === 'K12') facePainted(sink, plan, mass, mi, face, ctx);
        else yield* faceWallSteps(sink, plan, mass, mi, face, ctx);
        yield;
      }
      if (lod === 0 && id !== 'K12') buildCorridors(sink, plan, mass, mi, ctx);
    }
    yield;
    if (id !== 'K10' || plan.variant === 'beratap') buildRoof(sink, plan, mass, ctx, lod);
    if (id === 'K08' && lod === 0) floorPolygon(sink.opak, mass.ring, plan.baseY + 0.02, 'kayu-papan', ctx.colors.floor, 3);
    yield;
  }
  if (lod === 0) buildOrnaments(sink, plan, ctx);
}

/**
 * Tulis satu gedung ke sink sekaligus (galeri, hero, tes).
 * @returns {number} jumlah segitiga yang ditambahkan
 */
export function appendBuilding(sink, plan, opts = {}) {
  const before = sink.triangles;
  for (const _ of appendBuildingSteps(sink, plan, opts)) { /* jalankan semua langkah */ }
  return sink.triangles - before;
}
