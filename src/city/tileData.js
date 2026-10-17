/**
 * Validasi & dekode data tile citybake ("Format tile v1", Plan B): manifest.json dan {key}.data.json.
 * Data tak valid ditolak sebelum dipakai (spec §5): tile tak valid dilewati, manifest tak valid →
 * mode hanya-region. Murni (tanpa three/DOM).
 */
import { tileCenter, TILE_SIZE } from '../geo/tiles.js';

export const TILE_FORMAT_VERSION = 1;
export const TILE_FORMAT = 'citybake-tiles';
export const TILE_UNIT = 0.1;

const isInt = (v) => Number.isInteger(v);
const isFlat = (a, min) => Array.isArray(a) && a.length >= min && a.length % 2 === 0 && a.every(isInt);

/**
 * @param {unknown} m isi manifest.json
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function validateManifest(m) {
  if (!m || typeof m !== 'object') return { ok: false, error: 'manifest bukan objek' };
  if (m.version !== TILE_FORMAT_VERSION) return { ok: false, error: `versi manifest ${m.version} tidak didukung` };
  if (m.format !== TILE_FORMAT) return { ok: false, error: `format "${m.format}" bukan ${TILE_FORMAT}` };
  if (m.tileSize !== TILE_SIZE) return { ok: false, error: `tileSize ${m.tileSize} ≠ ${TILE_SIZE}` };
  if (m.unit !== TILE_UNIT) return { ok: false, error: `unit ${m.unit} ≠ ${TILE_UNIT}` };
  if (!Array.isArray(m.tiles) || !Array.isArray(m.areas)) return { ok: false, error: 'tiles/areas harus array' };
  for (const t of m.tiles) {
    const lodOk = Array.isArray(t?.lod) && t.lod.length === 2 && t.lod.every((l, i) => l?.level === i && typeof l.file === 'string');
    if (typeof t?.key !== 'string' || !isInt(t.ix) || !isInt(t.iz) || t.key !== `${t.ix}_${t.iz}` || !lodOk || typeof t.data?.file !== 'string') {
      return { ok: false, error: `entri tile tidak valid: ${JSON.stringify(t?.key ?? t)}` };
    }
  }
  return { ok: true };
}

/**
 * @param {unknown} d isi {key}.data.json
 * @param {string} [expectedKey] kunci tile yang diminta
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function validateTileData(d, expectedKey) {
  if (!d || typeof d !== 'object') return { ok: false, error: 'data tile bukan objek' };
  if (d.v !== TILE_FORMAT_VERSION) return { ok: false, error: `versi data tile ${d.v} tidak didukung` };
  if (expectedKey !== undefined && d.key !== expectedKey) return { ok: false, error: `kunci ${d.key} ≠ ${expectedKey}` };
  if (!isInt(d.ix) || !isInt(d.iz) || d.key !== `${d.ix}_${d.iz}`) return { ok: false, error: 'ix/iz/key tidak konsisten' };
  const c = tileCenter(d.ix, d.iz);
  if (!Array.isArray(d.center) || d.center[0] !== c.x || d.center[1] !== c.z) return { ok: false, error: 'center ≠ pusat tile' };
  if (d.unit !== TILE_UNIT) return { ok: false, error: `unit ${d.unit} ≠ ${TILE_UNIT}` };
  for (const k of ['buildings', 'water', 'waterways', 'roads']) if (!Array.isArray(d[k])) return { ok: false, error: `${k} harus array` };
  if (!d.buildings.every((b) => isInt(b?.h) && b.h >= 0 && isFlat(b.ring, 6))) return { ok: false, error: 'bangunan tidak valid' };
  if (!d.water.every((w) => Array.isArray(w?.rings) && w.rings.length >= 1 && w.rings.every((r) => isFlat(r, 6)))) {
    return { ok: false, error: 'air tidak valid' };
  }
  const lineOk = (l) => typeof l?.cls === 'string' && isInt(l.w) && l.w > 0 && isFlat(l.pts, 4);
  if (!d.waterways.every(lineOk) || !d.roads.every(lineOk)) return { ok: false, error: 'polyline tidak valid' };
  return { ok: true };
}

/** Array datar tile-lokal (satuan unit) → ring dunia [[x, z], ...]. */
function toWorldPoints(flat, cx, cz, unit) {
  const out = new Array(flat.length / 2);
  for (let i = 0; i < flat.length; i += 2) out[i / 2] = [cx + flat[i] * unit, cz + flat[i + 1] * unit];
  return out;
}

/**
 * Dekode data tile (sudah tervalidasi) ke koordinat DUNIA (meter).
 * @returns {{key:string, ix:number, iz:number, center:{x:number,z:number},
 *   buildings: Array<{height:number, ring:Array<[number,number]>}>,
 *   water: Array<{outer:Array<[number,number]>, holes:Array<Array<[number,number]>>}>,
 *   waterways: Array<{cls:string, width:number, pts:Array<[number,number]>}>,
 *   roads: Array<{cls:string, width:number, name:string|null, pts:Array<[number,number]>}>}}
 */
export function decodeTileData(d) {
  const [cx, cz] = d.center;
  const u = d.unit;
  const pts = (flat) => toWorldPoints(flat, cx, cz, u);
  return {
    key: d.key,
    ix: d.ix,
    iz: d.iz,
    center: { x: cx, z: cz },
    buildings: d.buildings.map((b) => ({ height: b.h * u, ring: pts(b.ring) })),
    water: d.water.map((w) => ({ outer: pts(w.rings[0]), holes: w.rings.slice(1).map(pts) })),
    waterways: d.waterways.map((l) => ({ cls: l.cls, width: l.w * u, pts: pts(l.pts) })),
    roads: d.roads.map((l) => ({ cls: l.cls, width: l.w * u, name: l.name ?? null, pts: pts(l.pts) })),
  };
}
