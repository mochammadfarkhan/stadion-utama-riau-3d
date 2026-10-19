/**
 * Estimasi tinggi bangunan (m). Urutan: tag `height` → `building:levels` × LEVEL_HEIGHT → heuristik
 * (tabel HEURISTIC_RULES, aturan pertama yang cocok menang). Deterministik: variasi diambil dari
 * hash id bangunan.
 *
 * TITIK KONTRIBUSI USER: HEURISTIC_RULES adalah baseline umum; pengetahuan lokal Pekanbaru
 * (ruko 2–3 lantai di arteri, rumah 1 lantai di gang, gedung tinggi di Sudirman) ditambahkan user
 * di tabel ini (lihat Task 10 rencana Plan B).
 */
import { polygonArea } from '../../src/geo/polygon.js';
import { LEVEL_HEIGHT } from './config.js';
import { seededUnit } from './random.js';

export const MIN_HEIGHT = 2.5;
export const MAX_HEIGHT = 300;

/** Kelas jalan arteri (konteks ruko/komersial). */
export const ARTERIAL_CLASSES = Object.freeze(new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link',
]));

const clamp = (v) => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, v));
const round1 = (v) => Math.round(v * 10) / 10;

/** "12", "12 m", "12m", "12,5" → angka (m); satuan kaki/format lain → null. */
export function parseHeight(value) {
  if (value === undefined || value === null) return null;
  const m = String(value).match(/^\s*(\d+(?:[.,]\d+)?)\s*(m|meter|meters)?\s*$/i);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : null;
}

const LEVEL_RANGE = /^\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/;

/**
 * "3", "2.5", "2;3" (ambil maks), rentang "4-7" (ambil MINIMUM, spec §4.7/§6) → jumlah lantai;
 * null bila tidak valid.
 */
export function parseLevels(value) {
  if (value === undefined || value === null) return null;
  const range = String(value).match(LEVEL_RANGE);
  if (range) {
    const lo = Math.min(Number(range[1]), Number(range[2]));
    return lo > 0 ? lo : null;
  }
  const nums = String(value).split(/[;,]/).map((s) => Number(s.trim())).filter((v) => Number.isFinite(v) && v > 0);
  return nums.length ? Math.max(...nums) : null;
}

const inSet = (list) => {
  const s = new Set(list);
  return (v) => s.has(v);
};

const isSmallStructure = inSet(['roof', 'carport', 'shed', 'garage', 'garages', 'kiosk', 'hut', 'toilets', 'gazebo', 'cabin']);
const isIndustrial = inSet(['industrial', 'warehouse', 'factory', 'manufacture', 'hangar', 'storage_tank']);
const isReligious = inSet(['mosque', 'church', 'temple', 'religious', 'chapel', 'cathedral', 'shrine']);
const isHighrise = inSet(['apartments', 'office', 'hotel', 'dormitory']);
const isEducationCivic = inSet(['school', 'university', 'college', 'kindergarten', 'government', 'public', 'civic', 'train_station']);
const isCommercial = inSet(['retail', 'commercial', 'shop', 'supermarket', 'mall', 'kios']);
const isHouse = inSet(['house', 'detached', 'semidetached_house', 'terrace', 'bungalow', 'residential']);
const isStadium = inSet(['stadium', 'grandstand']);

/**
 * Aturan heuristik berurutan. `pick(info)` → { floors: [min, max] } (bilangan bulat, × LEVEL_HEIGHT)
 * atau { height: [min, max] } (meter, kontinu). info = { id, cls, subtype, area, nearestRoadClass }.
 */
export const HEURISTIC_RULES = Object.freeze([
  { name: 'struktur kecil', match: (i) => isSmallStructure(i.cls), pick: () => ({ height: [2.6, 3.4] }) },
  { name: 'stadion/tribun', match: (i) => isStadium(i.cls), pick: () => ({ height: [12, 18] }) },
  {
    name: 'industri/gudang',
    match: (i) => isIndustrial(i.cls) || i.subtype === 'industrial',
    pick: (i) => ({ height: i.area > 1000 ? [8, 10] : [5.5, 7] }),
  },
  { name: 'ibadah', match: (i) => isReligious(i.cls) || i.subtype === 'religious', pick: () => ({ height: [8, 12] }) },
  { name: 'rumah sakit', match: (i) => i.cls === 'hospital' || i.subtype === 'medical', pick: () => ({ floors: [3, 5] }) },
  {
    name: 'apartemen/kantor/hotel',
    match: (i) => isHighrise(i.cls),
    pick: (i) => ({ floors: i.area < 500 ? [4, 6] : i.area < 2000 ? [6, 10] : [8, 15] }),
  },
  {
    name: 'pendidikan/pemerintahan',
    match: (i) => isEducationCivic(i.cls) || i.subtype === 'education' || i.subtype === 'civic',
    pick: () => ({ floors: [2, 3] }),
  },
  {
    name: 'ruko/komersial',
    match: (i) => isCommercial(i.cls) || i.subtype === 'commercial',
    pick: (i) => ({ floors: ARTERIAL_CLASSES.has(i.nearestRoadClass) ? [3, 4] : [2, 3] }),
  },
  {
    name: 'rumah',
    match: (i) => isHouse(i.cls) || i.subtype === 'residential',
    pick: (i) => ({ floors: i.area < 150 ? [1, 1] : [1, 2] }),
  },
  {
    name: 'umum (building=yes)',
    match: () => true,
    pick: (i) => {
      if (i.area < 80) return { floors: [1, 1] };
      if (i.area < 250) return { floors: [1, 2] };
      if (i.area < 1000) return { floors: [2, 3] };
      return { height: [7, 9] };
    },
  },
]);

/** Terapkan rentang aturan dengan nilai acak deterministik r ∈ [0, 1). */
function applyRange(spec, r) {
  if (spec.floors) {
    const [lo, hi] = spec.floors;
    return (lo + Math.min(hi - lo, Math.floor(r * (hi - lo + 1)))) * LEVEL_HEIGHT;
  }
  const [lo, hi] = spec.height;
  return lo + r * (hi - lo);
}

/**
 * Tinggi + asal estimasi (untuk debugging/laporan).
 * @param {{id: string, cls?: string, tags?: Record<string,string>, rings?: Array<Array<[number,number]>>}} feature
 * @param {{area?: number, nearestRoadClass?: string|null, rules?: typeof HEURISTIC_RULES}} [ctx]
 * @returns {{height: number, source: 'height'|'levels'|'heuristic', rule: string|null}}
 */
export function explainHeight(feature, ctx = {}) {
  const tags = feature.tags ?? {};
  const h = parseHeight(tags.height);
  if (h !== null) return { height: round1(clamp(h)), source: 'height', rule: null };
  const levels = parseLevels(tags['building:levels']);
  if (levels !== null) return { height: round1(clamp(levels * LEVEL_HEIGHT)), source: 'levels', rule: null };
  const info = {
    id: feature.id,
    cls: feature.cls ?? tags.building ?? 'yes',
    subtype: tags['overture:subtype'] ?? null,
    area: ctx.area ?? (feature.rings ? polygonArea(feature.rings[0]) : 0),
    nearestRoadClass: ctx.nearestRoadClass ?? null,
  };
  const rules = ctx.rules ?? HEURISTIC_RULES;
  const rule = rules.find((r) => r.match(info)) ?? rules[rules.length - 1];
  const height = applyRange(rule.pick(info), seededUnit(feature.id, 'height'));
  return { height: round1(clamp(height)), source: 'heuristic', rule: rule.name };
}

/** Tinggi bangunan (m, dibulatkan 0,1). */
export const estimateHeight = (feature, ctx = {}) => explainHeight(feature, ctx).height;
