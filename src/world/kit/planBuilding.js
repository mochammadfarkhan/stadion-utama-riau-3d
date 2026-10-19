/**
 * planBuilding (spec §4.6, §7.2): input gedung → BuildingPlan murni & deterministik (seed = hash(id)).
 * 1 footprint → OBB (PCA) → rasio < 0,85 → dekomposisi ≤ 4 massa → gagal/berlubang → massa poligon K12;
 * 2 lantai × tinggi lantai, baseY = median tanah di footprint + 0,15; 3 bay per sisi luar, selasar di sisi
 * panjang paling menghadap jalan; 4 bukaan per bay per lantai (planRules); 5 atap per massa; 6 variasi seed
 * (warna ±3%, jenis jendela, roster, noda, karat, nyala/tirai/AC). Tanpa three.
 */
import { createRandom } from '../siteutil/rng.js';
import { ROSTER_PATTERNS, VARIANTS, ARCHETYPES, geometryArchetype, hashId } from './archetypes.js';
import { computeObb, OBB_RECT_MIN } from './obb.js';
import { decomposeFootprint } from './decompose.js';
import { PLAN, assignRoles, boxMass, floorHeights, makeBays, median, obbRing, polygonMass } from './planGeom.js';
import { bayOpenings, planOrnaments, planSign } from './planRules.js';

export const ROOF_PITCH = Object.freeze({ pelana: 25, limas: 25, 'pelana-lebar': 15, 'limas-tumpang': 30, 'datar-parapet': 0, datar: 0 });
const FLAT = new Set(['datar-parapet', 'datar']);

/** Variasi per gedung dari rng (urutan tarikan tetap → deterministik). */
export function buildingStyle(arch, rng) {
  const tint = 1 + (rng.next() * 2 - 1) * 0.03;
  const altWindow = rng.chance(0.3);
  const roster = ROSTER_PATTERNS[Math.floor(rng.next() * ROSTER_PATTERNS.length)];
  const stain = rng.chance(0.35);
  const rust = rng.chance(0.25);
  return { tint, window: altWindow ? arch.windowAlt : arch.window, roster, stain, rust };
}

/** Massa dari footprint: [obb] bila persegi, hasil dekomposisi, atau null (→ K12 poligon). */
export function footprintMasses(ring, holes) {
  if (holes?.length) return { obbs: null, reason: 'footprint berlubang' };
  const obb = computeObb(ring);
  if (obb.rectangularity >= OBB_RECT_MIN) return { obbs: [obb], reason: null };
  const dec = decomposeFootprint(ring, obb);
  return dec ? { obbs: dec.masses, reason: null } : { obbs: null, reason: `dekomposisi gagal (rasio ${obb.rectangularity.toFixed(2)})` };
}

function roofFor(type, arch) {
  const pitch = type === arch.roof.type ? arch.roof.pitch : ROOF_PITCH[type] ?? 0;
  const overhang = FLAT.has(type) ? (type === 'datar' ? 0 : 0.3) : arch.roof.overhang;
  return { type, pitch, overhang, parapet: type === 'datar-parapet' ? PLAN.parapetH : 0 };
}

/** Tanah di footprint: median (lantai) & minimum (kaki plint). */
function groundStats(ring, groundY) {
  const pts = [...ring];
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  pts.push([cx, cz]);
  const ys = pts.map(([x, z]) => {
    const y = groundY(x, z);
    return Number.isFinite(y) ? y : 0;
  });
  return { med: median(ys), min: Math.min(...ys) };
}

function makeMasses(ring, holes, kitArch, resolved, front) {
  const fp = kitArch.id === 'K12' ? { obbs: null, reason: null } : footprintMasses(ring, holes);
  if (!fp.obbs) return { masses: [polygonMass(ring, holes)], reason: fp.reason, kit: ARCHETYPES.K12 };
  const pitched = !FLAT.has(resolved.roof);
  const masses = fp.obbs.map((obb, i) => {
    const others = fp.obbs.filter((_, j) => j !== i).map(obbRing);
    return boxMass(obb, kitArch, resolved.corridorSide, front, others, pitched);
  });
  return { masses, reason: null, kit: kitArch };
}

/**
 * @param {{id:string, ring:Array<[number,number]>, holes?:Array<Array<[number,number]>>, levels?:number|null,
 *   archetype:string, overrides?:{palette?:string, roof?:string, corridorSide?:string, sign?:string|null, variant?:string|null},
 *   seed?:number, groundY?:(x:number, z:number) => number, front?:[number,number]|null}} input
 * @returns {object} BuildingPlan (lihat plan M3 §"Bentuk BuildingPlan")
 */
export function planBuilding(input) {
  const { id, ring, holes = [], archetype, overrides = {}, groundY = () => 0, front = null } = input;
  const seed = input.seed ?? hashId(id);
  const rng = createRandom(seed);
  const arch = geometryArchetype(archetype);
  const resolved = {
    palette: overrides.palette ?? arch.palette,
    roof: overrides.roof ?? arch.roof.type,
    corridorSide: overrides.corridorSide ?? arch.corridor.side,
    sign: overrides.sign ?? null,
    variant: overrides.variant ?? VARIANTS[arch.id]?.[0] ?? null,
  };
  const style = buildingStyle(arch, rng);
  const { masses, reason, kit } = makeMasses(ring, holes, arch, resolved, front);
  const floors = Math.max(1, Math.min(input.levels ?? arch.levels, kit.maxLevels));
  const floorH = floorHeights(kit.id === 'K12' && arch.id !== 'K12' ? arch : kit, floors);
  const height = floorH.reduce((s, h) => s + h, 0);
  const ground = groundStats(masses[0].kind === 'poligon' ? masses[0].ring : ring, groundY);
  const baseY = ground.med + PLAN.plinthLift;
  const roofType = masses[0].kind === 'poligon' ? 'datar-parapet' : resolved.roof;
  const bays = [];
  const openings = [];
  const ruleArch = kit.id === 'K12' ? kit : arch;
  masses.forEach((mass, mi) => {
    Object.assign(mass, { floors, floorH, baseY, height, roof: roofFor(roofType, kit) });
    assignRoles(mass, front);
    for (const face of mass.faces) {
      const list = makeBays(face, kit.bay);
      list.forEach((bay, i) => {
        bays.push({ mass: mi, face: face.id, index: i, u0: bay.u0, u1: bay.u1 });
        for (let f = 0; f < floors; f += 1) {
          openings.push(...bayOpenings({ arch: ruleArch, variant: resolved.variant, style, rng, face, floor: f, floorH: floorH[f], bay, i, n: list.length, mass: mi, corridorDepth: mass.corridor.depth }));
        }
      });
    }
  });
  const sign = planSign(resolved.sign, arch.id === kit.id ? arch : kit, masses[0], floorH[0]);
  return {
    id, archetype, kit: kit.id, fallback: reason, seed, palette: resolved.palette, variant: resolved.variant, style,
    groundY: ground.med, footY: ground.min - 0.25, baseY, floors, floorH, height,
    masses, bays, openings,
    roof: masses[0].roof,
    corridor: { side: masses[0].corridor.faces[0] ?? null, faces: masses[0].corridor.faces, depth: masses[0].corridor.depth },
    signs: sign ? [sign] : [],
    ornaments: planOrnaments(kit, resolved.variant, masses[0], baseY, height, rng, ground.med),
  };
}
