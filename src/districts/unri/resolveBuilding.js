/**
 * Resolusi gedung OSM → parameter kit (spec §4.7 + deviasi D1 plan M3): override tabel menang; selain itu
 * aturan nama/tag berurutan (pertama yang cocok menang). Lantai: override → `building:levels` (rentang
 * "4-7" → minimum) → default arketipe. Override tak valid di runtime → aturan default + console.warn sekali
 * per id. Murni (tanpa three); `logger` dapat disuntik untuk tes.
 */
import { polygonArea } from '../../geo/polygon.js';
import {
  ARCHETYPE_IDS, CONFIDENCE, CORRIDOR_SIDES, HERO_IDS, PALETTES, ROOF_TYPES, VARIANTS, geometryArchetype, hashId,
} from '../../world/kit/archetypes.js';

export const OVERRIDE_KEYS = Object.freeze([
  'archetype', 'levels', 'palette', 'roof', 'corridorSide', 'sign', 'variant', 'sumber', 'keyakinan',
]);
const ID_RE = /^[wr]\d+$/;
const MAX_SIGN = 48;
const UNNAMED_SMALL = 150; // m²: gedung tanpa nama lebih kecil → K11 (D1)
const TINY = 60;           // m²: spec §4.7 → K11

/** Aturan nama/tag spec §4.7 (urut). `test(name, tags, area)`. */
export const RULES = Object.freeze([
  { archetype: 'K02', why: 'nama /dekanat/', test: (n) => /dekanat/i.test(n) },
  { archetype: 'K04', why: 'nama /lab|laborator/', test: (n) => /lab|laborator/i.test(n) },
  { archetype: 'K07', why: 'nama /kantin|food/', test: (n) => /kantin|food/i.test(n) },
  { archetype: 'K06', why: 'nama /musholla/', test: (n) => /mus(h)?oll?a|mushola/i.test(n) },
  { archetype: 'K08', why: 'nama /pendopo|balai bahasa/', test: (n) => /pendopo|balai bahasa/i.test(n) },
  { archetype: 'K05', why: 'nama /auditorium|gelanggang|aula/', test: (n) => /auditorium|gelanggang|aula/i.test(n) },
  { archetype: 'K10', why: 'nama /mangkrak/', test: (n) => /mangkrak/i.test(n) },
  { archetype: 'K09', why: 'building=apartments', test: (n, t) => t.building === 'apartments' },
  { archetype: 'K11', why: 'luas < 60 m²', test: (n, t, a) => a < TINY },
  { archetype: 'K01', why: 'nama gedung kuliah / amenity=university|college', test: (n, t) => /gedung [a-h]\b|kuliah|classroom/i.test(n) || t.amenity === 'university' || t.amenity === 'college' },
  { archetype: 'K11', why: 'D1: tanpa padanan, luas < 150 m²', test: (n, t, a) => a < UNNAMED_SMALL },
  { archetype: 'K01', why: 'D1: tanpa padanan → blok koridor kampus [INF]', test: () => true },
]);

/** "4-7" → 4, "2" → 2, "2;3" → 2; selain itu null. */
export function parseLevelsTag(raw) {
  if (raw === undefined || raw === null) return null;
  const m = String(raw).match(/\d+(\.\d+)?/);
  if (!m) return null;
  const v = Math.floor(Number(m[0]));
  return v >= 1 && v <= 60 ? v : null;
}

/** Daftar galat satu entri override (kosong = valid). */
export function overrideErrors(id, ov) {
  const errs = [];
  const at = (msg) => errs.push(`${id}: ${msg}`);
  if (!ID_RE.test(id)) at('id harus "w<angka>" atau "r<angka>"');
  if (!ov || typeof ov !== 'object' || Array.isArray(ov)) return [...errs, `${id}: entri harus objek`];
  for (const k of Object.keys(ov)) if (!OVERRIDE_KEYS.includes(k)) at(`kunci tak dikenal "${k}"`);
  if (ov.archetype !== undefined && !ARCHETYPE_IDS.includes(ov.archetype) && !HERO_IDS.includes(ov.archetype)) at(`archetype "${ov.archetype}" tidak dikenal`);
  if (ov.levels !== undefined && !(Number.isInteger(ov.levels) && ov.levels >= 1 && ov.levels <= 12)) at('levels harus bilangan bulat 1–12');
  if (ov.palette !== undefined && !Object.hasOwn(PALETTES, ov.palette)) at(`palette "${ov.palette}" tidak dikenal`);
  if (ov.roof !== undefined && !ROOF_TYPES.includes(ov.roof)) at(`roof "${ov.roof}" tidak dikenal`);
  if (ov.corridorSide !== undefined && !CORRIDOR_SIDES.includes(ov.corridorSide)) at(`corridorSide "${ov.corridorSide}" tidak dikenal`);
  if (ov.sign !== undefined && ov.sign !== null && !(typeof ov.sign === 'string' && ov.sign.trim() && ov.sign.length <= MAX_SIGN)) at(`sign harus teks 1–${MAX_SIGN} huruf atau null`);
  if (ov.variant !== undefined) {
    const arch = geometryArchetype(ov.archetype ?? '').id;
    const allowed = VARIANTS[ov.archetype] ?? VARIANTS[arch] ?? [];
    if (!ov.archetype || !allowed.includes(ov.variant)) at(`variant "${ov.variant}" tidak sah untuk archetype ${ov.archetype ?? '(kosong)'}`);
  }
  if (typeof ov.sumber !== 'string' || ov.sumber.trim().length < 3) at('sumber wajib (teks)');
  if (!CONFIDENCE.includes(ov.keyakinan)) at(`keyakinan harus salah satu ${CONFIDENCE.join('/')}`);
  return errs;
}

/** Validasi seluruh tabel override; [] = valid (spec §4.7). */
export function validateOverrides(table) {
  if (!table || typeof table !== 'object') return ['tabel override harus objek'];
  return Object.entries(table).flatMap(([id, ov]) => overrideErrors(id, ov));
}

const warned = new Set();

/** Hanya untuk tes: lupakan peringatan yang sudah dicetak. */
export function resetResolveWarnings() {
  warned.clear();
}

function ruleFor(name, tags, area) {
  return RULES.find((r) => r.test(name, tags, area));
}

/** Variasi [INF] blok kuliah lama: 30% putih (selain krem), 35% atap limas (selain pelana) — dari hash id. */
export const K01_VARIATION = Object.freeze({ putih: 30, limas: 35 });

function defaultPalette(archetype, tags, id) {
  const base = geometryArchetype(archetype).palette;
  if (tags['building:walls'] === 'wood') return 'kayu';
  if (tags['building:roof'] === 'tile' && base === 'krem-seng') return 'krem-genteng';
  if (archetype === 'K01' && (hashId(id) >>> 8) % 100 < K01_VARIATION.putih) return 'putih-seng';
  return base;
}

function defaultRoof(archetype, tags, id) {
  const arch = geometryArchetype(archetype);
  if (tags['building:roof'] === 'concrete' && arch.roof.type !== 'datar') return 'datar-parapet';
  if (archetype === 'K01' && hashId(id) % 100 < K01_VARIATION.limas) return 'limas';
  return arch.roof.type;
}

/** Varian default: dari nama (K07 parkir, K11 pos/toilet), selain itu varian pertama arketipe. */
function defaultVariant(archetype, name) {
  const id = geometryArchetype(archetype).id;
  const list = VARIANTS[id];
  if (!list) return null;
  if (id === 'K07' && /parkir/i.test(name)) return 'parkir';
  if (id === 'K11' && /pos|satpam|keamanan/i.test(name)) return 'pos';
  if (id === 'K11' && /toilet|\bwc\b/i.test(name)) return 'toilet';
  return list[0];
}

function defaultSign(archetype, name) {
  if (!name || geometryArchetype(archetype).signStyle === 'tidak') return null;
  const text = name.trim().toUpperCase();
  return text.length <= MAX_SIGN ? text : `${text.slice(0, MAX_SIGN - 1)}…`;
}

/**
 * @param {{id:string, ring:Array<[number,number]>, levels?:number|null, tags?:Record<string,string>, area?:number}} osm
 * @param {object} [override] entri tabel buildings.data.js
 * @param {{logger?: {warn: (...a: unknown[]) => void}}} [opts]
 * @returns {{archetype:string, levels:number, palette:string, roof:string, corridorSide:string, sign:string|null,
 *   variant:string|null, sumber:string, keyakinan:string, aturan:string}}
 */
export function resolveBuilding(osm, override, { logger = console } = {}) {
  const tags = osm.tags ?? {};
  const name = tags.name ?? '';
  const area = osm.area ?? polygonArea(osm.ring ?? []);
  let ov = override ?? null;
  if (ov) {
    const errs = overrideErrors(osm.id, ov);
    if (errs.length) {
      if (!warned.has(osm.id)) {
        warned.add(osm.id);
        logger.warn(`Override gedung ${osm.id} tidak valid, memakai aturan default:`, errs);
      }
      ov = null;
    }
  }
  const rule = ov?.archetype ? null : ruleFor(name, tags, area);
  const archetype = ov?.archetype ?? rule.archetype;
  const arch = geometryArchetype(archetype);
  const tagged = osm.levels ?? parseLevelsTag(tags['building:levels']);
  const levels = Math.min(ov?.levels ?? tagged ?? arch.levels, arch.maxLevels);
  return {
    archetype,
    levels,
    palette: ov?.palette ?? defaultPalette(archetype, tags, osm.id),
    roof: ov?.roof ?? defaultRoof(archetype, tags, osm.id),
    corridorSide: ov?.corridorSide ?? arch.corridor.side,
    sign: ov && Object.hasOwn(ov, 'sign') ? ov.sign : defaultSign(archetype, name),
    variant: ov?.variant ?? defaultVariant(archetype, name),
    sumber: ov?.sumber ?? `OSM ${osm.id.startsWith('r') ? 'relation' : 'way'}/${osm.id.slice(1)} + aturan (${rule.why})`,
    keyakinan: ov?.keyakinan ?? (name ? 'sedang' : 'rendah'),
    aturan: ov ? 'override' : rule.why,
  };
}

/** Arketipe default untuk tes/laporan: hanya aturan, tanpa override. */
export function ruleArchetype(osm) {
  const tags = osm.tags ?? {};
  return ruleFor(tags.name ?? '', tags, osm.area ?? polygonArea(osm.ring ?? [])).archetype;
}
