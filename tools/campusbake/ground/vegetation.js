/**
 * Penempatan vegetasi kampus (bake, deterministik): kisi global ber-jitter per jenis landcover (hutan, taman,
 * rumput, kebun), kebun sawit pola segitiga, pohon peneduh tepi jalan, semak keliling parkir. Satu titik kisi
 * hanya dipakai landcover berprioritas tertinggi di titik itu (ctx.cover) sehingga poligon bertumpuk tidak
 * menggandakan pohon. Spesies: V01 mahoni, V02 angsana, V03 saga, V06 sawit, V07 semak.
 */
import { orientRing, pointInPolygon, ringBounds } from '../../../src/geo/polygon.js';
import { hashString, mulberry32 } from '../../citybake/random.js';
import { samplesAlong } from './spatial.js';
import { VEG } from './constants.js';

const rngOf = (salt) => mulberry32(hashString(salt));
const insideRings = (rings, x, z) => pointInPolygon(x, z, rings[0]) && !rings.slice(1).some((h) => pointInPolygon(x, z, h));

/** Spesies dari campuran berbobot [['mahoni', 0.5], …] dan u ∈ [0, 1). */
export function pickSpecies(mix, u) {
  const total = mix.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [sp, w] of mix) {
    acc += w / total;
    if (u < acc) return sp;
  }
  return mix[mix.length - 1][0];
}

/** Titik tidak boleh ditanami: luar distrik, area keras/air, dekat jalan/trotoar/jalan tanah/gedung/air, curam. */
export function vegetationBlocked(ctx, x, z, clear = VEG.clear) {
  return !ctx.inside(x, z) || ctx.area(x, z) !== null || ctx.roadEdge(x, z).d < clear.road
    || ctx.walkEdge(x, z).d < clear.walk || ctx.soilPathEdge(x, z).d < clear.walk
    || ctx.building(x, z) !== null || ctx.buildingEdge(x, z) < clear.building
    || ctx.waterEdge(x, z) < clear.water || ctx.grade(x, z) > VEG.maxGrade;
}

function latticeFill(name, rule, polys, ctx, seen, out) {
  const sp = rule.spacing;
  for (const poly of polys) {
    const b = ringBounds(poly.rings[0]);
    for (let j = Math.floor(b.minZ / sp) - 1; j <= Math.ceil(b.maxZ / sp); j += 1) {
      for (let i = Math.floor(b.minX / sp) - 1; i <= Math.ceil(b.maxX / sp); i += 1) {
        const id = `${name}:${i}:${j}`;
        if (seen.has(id)) continue;
        const r = rngOf(id);
        const x = (i + 0.5 + (r() - 0.5) * 2 * rule.jitter) * sp;
        const z = (j + 0.5 + (r() - 0.5) * 2 * rule.jitter) * sp;
        const keepRoll = r();
        const speciesRoll = r();
        if (!insideRings(poly.rings, x, z)) continue;
        seen.add(id);
        if (rule.keep !== undefined && keepRoll >= rule.keep) continue;
        if (ctx.cover(x, z)?.kind !== poly.kind || vegetationBlocked(ctx, x, z)) continue;
        out.push({ sp: pickSpecies(rule.mix, speciesRoll), x, z });
      }
    }
  }
}

function sawitFill(polys, ctx, seen, out) {
  const dx = VEG.sawit.spacing;
  const dz = (dx * Math.sqrt(3)) / 2;
  for (const poly of polys) {
    const b = ringBounds(poly.rings[0]);
    for (let j = Math.floor(b.minZ / dz); j <= Math.ceil(b.maxZ / dz); j += 1) {
      const shift = (((j % 2) + 2) % 2) * (dx / 2);
      for (let i = Math.floor((b.minX - shift) / dx); i <= Math.ceil((b.maxX - shift) / dx); i += 1) {
        const id = `sawit:${i}:${j}`;
        if (seen.has(id)) continue;
        const x = i * dx + shift;
        const z = j * dz;
        if (!insideRings(poly.rings, x, z)) continue;
        seen.add(id);
        if (ctx.cover(x, z)?.kind !== 'sawit' || vegetationBlocked(ctx, x, z)) continue;
        out.push({ sp: 'sawit', x, z });
      }
    }
  }
}

function streetTrees(roads, ctx, out) {
  const rule = VEG.street;
  for (const r of roads) {
    if (!rule.classes.includes(r.cls)) continue;
    for (const side of [1, -1]) {
      const rnd = rngOf(`jalan:${r.id}:${side}:${r.line[0][0].toFixed(2)}:${r.line[0][1].toFixed(2)}`);
      const d = r.w / 2 + rule.offset;
      for (const p of samplesAlong(r.line, rule.spacing, rnd() * rule.spacing)) {
        const x = p.x - p.tz * d * side;
        const z = p.z + p.tx * d * side;
        const roll = rnd();
        const cover = ctx.cover(x, z)?.kind;
        if ((cover && cover !== 'park' && cover !== 'grass') || vegetationBlocked(ctx, x, z)) continue;
        out.push({ sp: pickSpecies(rule.mix, roll), x, z });
      }
    }
  }
}

function parkingShrubs(areas, ctx, out) {
  const rule = VEG.shrubParking;
  const clear = { ...VEG.clear, road: 0.8, walk: 0.5 };
  for (const a of areas) {
    if (a.kind !== 'parking') continue;
    const ring = orientRing(a.rings[0], true);
    for (const p of samplesAlong([...ring, ring[0]], rule.spacing, rule.spacing / 2)) {
      // Ring positif: normal luar = (dz, −dx) (src/geo/polygon.js).
      const x = p.x + p.tz * rule.offset;
      const z = p.z - p.tx * rule.offset;
      if (!vegetationBlocked(ctx, x, z, clear)) out.push({ sp: 'semak', x, z });
    }
  }
}

/** @returns {Array<{sp: string, x: number, z: number}>} titik vegetasi dunia (urutan deterministik) */
export function placeVegetation(E, ctx) {
  const out = [];
  const seen = new Set();
  const byKind = (k) => E.landcover.filter((c) => c.kind === k);
  latticeFill('forest', VEG.forest, byKind('forest'), ctx, seen, out);
  sawitFill(byKind('sawit'), ctx, seen, out);
  latticeFill('orchard', VEG.orchard, byKind('orchard'), ctx, seen, out);
  latticeFill('park', VEG.park, byKind('park'), ctx, seen, out);
  latticeFill('grass', VEG.grass, byKind('grass'), ctx, seen, out);
  latticeFill('shrubPark', VEG.shrubPark, byKind('park'), ctx, seen, out);
  streetTrees(E.roads, ctx, out);
  parkingShrubs(E.areas, ctx, out);
  return out;
}
