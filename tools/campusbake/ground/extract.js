/**
 * Ekstraksi fitur ground kampus (M2) dari fitur citybake ter-normalisasi & terproyeksi (dunia): jalan kendaraan
 * (tumpang w/2 + 2 m melewati batas distrik), trotoar (tumpang 1 m), jalan tanah, parit OSM, area keras/air
 * (diklip ke distrik), landcover (sawit/kebun/hutan/…), footprint gedung OSM (menjauhkan vegetasi/props).
 * Jembatan (dibuat region hero M6), gorong-gorong, dan parking_aisle (tertutup paving parkir) dilewati.
 */
import polygonClipping from 'polygon-clipping';
import { boundsOverlap, cleanRing, polygonArea, ringBounds } from '../../../src/geo/polygon.js';
import { insideWithOverlap, splitPolylineByRing } from '../../../src/geo/lineClip.js';
import { ROAD_CLASSES } from '../../citybake/config.js';
import { DITCH, ONEWAY, OVERLAP, SOIL_PATH_CLASSES, VEHICLE_CLASSES, WALK_CLASSES } from './constants.js';

/** Serpihan klip lebih kecil dari ini (m²) dibuang. */
const MIN_AREA = 0.5;

/** Lebar jalan (m): tag width bila valid, selain itu tabel citybake; searah pada kelas besar × faktor. */
export function roadWidth(cls, tags = {}) {
  const tagged = Number(String(tags.width ?? '').replace(',', '.'));
  if (Number.isFinite(tagged) && tagged > 0 && tagged < 40) return tagged;
  const base = ROAD_CLASSES[cls]?.width ?? 0;
  return tags.oneway === 'yes' && ONEWAY.classes.includes(cls) ? base * ONEWAY.factor : base;
}

/** Irisan poligon (rings) dengan ring (polygon-clipping) → daftar [luar, ...lubang] terbuka; serpihan dibuang. */
export function clipToRing(rings, ring) {
  return polygonClipping.intersection(rings, [ring])
    .map((poly) => poly.map((r) => cleanRing(r, 1e-9)).filter((r) => r.length >= 3))
    .filter((poly) => poly.length > 0 && polygonArea(poly[0]) >= MIN_AREA);
}

/** Jenis landcover dari fitur landuse citybake (kunci SURFACE_RULES.landcover) atau null. */
export function landcoverKind(f) {
  const t = f.tags ?? {};
  if (t.trees === 'oil_palms' || t.genus === 'Elaeis' || /sawit/i.test(t.name ?? '')) return 'sawit';
  if (t.landuse === 'orchard') return 'orchard';
  if (t.landuse === 'farmland') return 'farmland';
  if (f.cls === 'construction') return 'bare';
  if (f.cls === 'wetland') return 'wetland';
  if (f.cls === 'forest') return 'forest';
  if (f.cls === 'park') return 'park';
  if (f.cls === 'grass' || f.cls === 'scrub') return 'grass';
  return null;
}

function lineFeature(f, boundary, out) {
  const t = f.tags ?? {};
  if (t.tunnel && t.tunnel !== 'no') return;
  if (f.kind === 'waterway') {
    for (const line of splitPolylineByRing(f.line, boundary).inside) out.waterLines.push({ id: f.id, w: DITCH.osmWidth, line });
    return;
  }
  if ((t.bridge && t.bridge !== 'no') || t.service === 'parking_aisle') return;
  const w = roadWidth(f.cls, t);
  if (VEHICLE_CLASSES.includes(f.cls)) {
    for (const line of insideWithOverlap(f.line, boundary, w / 2 + OVERLAP.roadExtra)) out.roads.push({ id: f.id, cls: f.cls, w, line });
  } else if (WALK_CLASSES.includes(f.cls)) {
    for (const line of insideWithOverlap(f.line, boundary, OVERLAP.walk)) out.walks.push({ id: f.id, cls: f.cls, w, line });
  } else if (SOIL_PATH_CLASSES.includes(f.cls)) {
    for (const line of splitPolylineByRing(f.line, boundary).inside) out.soilPaths.push({ id: f.id, cls: f.cls, w, line });
  }
}

function areaFeature(f, boundary, out) {
  const t = f.tags ?? {};
  if (f.kind === 'building') {
    out.buildings.push({ id: f.id, ring: f.rings[0] });
    return;
  }
  let kind = null;
  if (f.kind === 'water') kind = 'water';
  else if (t.amenity === 'parking') kind = 'parking';
  else if (t.leisure === 'pitch') kind = 'pitch';
  if (kind) {
    for (const rings of clipToRing(f.rings, boundary)) out.areas.push({ id: f.id, kind, rings });
    return;
  }
  if (f.kind !== 'landuse') return;
  const lc = landcoverKind(f);
  if (!lc) return;
  for (const rings of clipToRing(f.rings, boundary)) out.landcover.push({ id: f.id, kind: lc, rings });
}

/**
 * @param {{features: import('../../citybake/features.js').Feature[], plazas?: Array<{id:string, rings:Array<Array<[number,number]>>}>}} src
 * @param {Array<[number, number]>} boundary ring distrik (dunia)
 */
export function extractGround({ features, plazas = [] }, boundary) {
  const db = ringBounds(boundary);
  const out = { roads: [], walks: [], soilPaths: [], waterLines: [], areas: [], landcover: [], buildings: [] };
  for (const f of features) {
    const geom = f.rings ? f.rings[0] : f.line;
    if (!geom || !boundsOverlap(ringBounds(geom), db)) continue;
    if (f.line) lineFeature(f, boundary, out);
    else areaFeature(f, boundary, out);
  }
  for (const p of plazas) {
    for (const rings of clipToRing(p.rings, boundary)) out.areas.push({ id: p.id, kind: 'plaza', rings });
  }
  return out;
}
