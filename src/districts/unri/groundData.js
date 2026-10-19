/**
 * Parser + validator ground/<key>.json (format v1 + ekstensi M2, lihat plan M2). Koordinat bulat 0,1 m relatif
 * sudut barat-laut chunk → dunia (m); yaw derajat → radian; bobot base64 → Uint8Array. Galat → GroundDataError
 * (pemanggil melewati chunk itu, spec §10). Murni (tanpa three).
 */
import { parseTileKey } from '../../geo/tiles.js';

export class GroundDataError extends Error {}

export const GROUND_UNIT = 0.1;
export const GROUND_SPECIES = Object.freeze(['mahoni', 'angsana', 'saga', 'sawit', 'semak']);
export const GROUND_AREA_KINDS = Object.freeze(['parking', 'plaza', 'pitch', 'water']);

const fail = (key, msg) => {
  throw new GroundDataError(`ground ${key}: ${msg}`);
};
const isInts = (a) => Array.isArray(a) && a.every(Number.isInteger);

function points(flat, origin, key, what, min) {
  if (!isInts(flat) || flat.length % 2 !== 0 || flat.length < min) fail(key, `${what} bukan array bilangan bulat genap ≥ ${min}`);
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push([origin.x + flat[i] * GROUND_UNIT, origin.z + flat[i + 1] * GROUND_UNIT]);
  return out;
}

function decodeBytes(b64, n, key, name) {
  if (typeof b64 !== 'string') fail(key, `weights.${name} bukan base64`);
  let bin = '';
  try {
    bin = atob(b64);
  } catch {
    fail(key, `weights.${name} base64 rusak`);
  }
  if (bin.length !== n * n) fail(key, `weights.${name} panjang ${bin.length} ≠ ${n * n}`);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * @param {unknown} json isi berkas
 * @param {string} key kunci chunk yang diminta ("ix_iz")
 * @returns {{key:string, origin:{x:number,z:number}, roads:Array<{cls:string,w:number,pts:Array<[number,number]>}>,
 *   walks:Array<{w:number,pts:Array<[number,number]>}>, areas:Array<{kind:string,rings:Array<Array<[number,number]>>,level?:number}>,
 *   ditches:Array<{w:number,pts:Array<[number,number]>}>, veg:Array<{sp:string,x:number,z:number}>,
 *   props:{lamps:Array<{x,z,yaw}>, benches:Array<{x,z,yaw}>, bins:Array<{x,z}>},
 *   weights:{n:number, grass:Uint8Array, soil:Uint8Array, wet:Uint8Array}}}
 */
export function parseGroundChunk(json, key, { size = 500 } = {}) {
  if (!json || json.v !== 1) fail(key, 'v harus 1');
  if (json.key !== key) fail(key, `key berkas "${json.key}" tidak cocok`);
  const t = parseTileKey(key);
  if (!t) fail(key, 'kunci tidak valid');
  const origin = { x: t.ix * size, z: t.iz * size };
  const list = (v, what) => {
    if (!Array.isArray(v)) fail(key, `${what} harus array`);
    return v;
  };
  const width = (w, what) => {
    if (!Number.isInteger(w) || w <= 0) fail(key, `${what}.w tidak valid`);
    return w * GROUND_UNIT;
  };
  const roads = list(json.roads, 'roads').map((r) => ({ cls: String(r.cls), w: width(r.w, 'roads'), pts: points(r.pts, origin, key, 'roads.pts', 4) }));
  const walks = list(json.walks, 'walks').map((r) => ({ w: width(r.w, 'walks'), pts: points(r.pts, origin, key, 'walks.pts', 4) }));
  const areas = list(json.areas, 'areas').map((a) => {
    if (!GROUND_AREA_KINDS.includes(a.kind)) fail(key, `areas.kind "${a.kind}" tidak dikenal`);
    const rings = list(a.rings, 'areas.rings').map((r) => points(r, origin, key, 'areas.rings', 6));
    if (rings.length === 0) fail(key, 'areas.rings kosong');
    if (a.kind !== 'water') return { kind: a.kind, rings };
    if (!Number.isFinite(a.level)) fail(key, 'area air tanpa level');
    return { kind: a.kind, rings, level: a.level };
  });
  const ditches = list(json.ditches ?? [], 'ditches').map((r) => ({ w: width(r.w, 'ditches'), pts: points(r.pts, origin, key, 'ditches.pts', 4) }));
  const veg = list(json.veg ?? [], 'veg').flatMap((v) => {
    if (!GROUND_SPECIES.includes(v.sp)) fail(key, `veg.sp "${v.sp}" tidak dikenal`);
    return points(v.pts, origin, key, 'veg.pts', 2).map(([x, z]) => ({ sp: v.sp, x, z }));
  });
  const props = json.props ?? {};
  const triples = (flat = [], what) => {
    if (!isInts(flat) || flat.length % 3 !== 0) fail(key, `props.${what} harus bilangan bulat kelipatan 3`);
    const out = [];
    for (let i = 0; i < flat.length; i += 3) {
      out.push({ x: origin.x + flat[i] * GROUND_UNIT, z: origin.z + flat[i + 1] * GROUND_UNIT, yaw: (flat[i + 2] * Math.PI) / 180 });
    }
    return out;
  };
  const bins = points(props.bins ?? [], origin, key, 'props.bins', 0).map(([x, z]) => ({ x, z }));
  const w = json.weights;
  if (!w || !Number.isInteger(w.n) || w.n < 2) fail(key, 'weights.n tidak valid');
  return {
    key, origin, roads, walks, areas, ditches, veg,
    props: { lamps: triples(props.lamps, 'lamps'), benches: triples(props.benches, 'benches'), bins },
    weights: { n: w.n, grass: decodeBytes(w.grass, w.n, key, 'grass'), soil: decodeBytes(w.soil, w.n, key, 'soil'), wet: decodeBytes(w.wet, w.n, key, 'wet') },
  };
}
