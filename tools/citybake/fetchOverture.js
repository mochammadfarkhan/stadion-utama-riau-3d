/**
 * Overture Maps buildings via DuckDB (@duckdb/node-api) langsung dari GeoParquet di S3 publik
 * (tanpa kredensial). Hasil di-cache ke data-src/overture/<area>.geojson. Bila DuckDB/S3 gagal,
 * pemanggil melanjutkan dengan OSM saja (loadOverture mengembalikan null + peringatan).
 * Catatan kinerja: query bbox kecil pun memindai metadata semua partisi global (±4–5 menit, 2026-10-16).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { cleanRing } from '../../src/geo/polygon.js';
import { OVERTURE } from './config.js';

const SETUP_SQL = Object.freeze(['INSTALL spatial', 'LOAD spatial', 'INSTALL httpfs', 'LOAD httpfs']);

/** SQL bbox Overture; predikat pada kolom struct `bbox` memanfaatkan statistik row-group Parquet. */
export function buildOvertureSql({ south, west, north, east }, release = OVERTURE.release) {
  const n = (v) => Number(v).toFixed(7);
  return [
    'SELECT id, names.primary AS name, sources[1].dataset AS src, subtype, class, height, num_floors,',
    '       ST_AsGeoJSON(geometry) AS geojson',
    `FROM read_parquet('${OVERTURE.s3Base}/${release}/theme=buildings/type=building/*', hive_partitioning=1)`,
    `WHERE bbox.xmin <= ${n(east)} AND bbox.xmax >= ${n(west)}`,
    `  AND bbox.ymin <= ${n(north)} AND bbox.ymax >= ${n(south)}`,
    'ORDER BY id',
  ].join('\n');
}

/**
 * Koneksi DuckDB default (impor dinamis agar tes & mode tanpa Overture tidak memuat biner native).
 * Mengembalikan `{ runAndReadAll, closeSync }`; closeSync menutup koneksi DAN instance.
 * Bila setup (INSTALL/LOAD) gagal, apa yang sudah dibuka ditutup sebelum melempar.
 */
export async function connectDuckDb() {
  const { DuckDBInstance } = await import('@duckdb/node-api');
  const instance = await DuckDBInstance.create(':memory:');
  let connection = null;
  const closeSync = () => {
    connection?.closeSync();
    instance.closeSync();
  };
  try {
    connection = await instance.connect();
    for (const sql of SETUP_SQL) await connection.run(sql);
    await connection.run(`SET s3_region='${OVERTURE.s3Region}'`);
  } catch (err) {
    closeSync();
    throw err;
  }
  return { runAndReadAll: (sql) => connection.runAndReadAll(sql), closeSync };
}

/** Baris hasil query → GeoJSON FeatureCollection (properti apa adanya; geometri dari ST_AsGeoJSON). */
export function rowsToGeoJSON(rows) {
  const features = [];
  for (const row of rows) {
    let geometry;
    try {
      geometry = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
    } catch {
      continue;
    }
    if (!geometry) continue;
    const { geojson: _g, ...props } = row;
    features.push({ type: 'Feature', properties: props, geometry });
  }
  return { type: 'FeatureCollection', features };
}

const toNumber = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/** Tag gaya OSM dari properti Overture (agar height.js membaca satu skema). */
function overtureTags(props) {
  const tags = { building: props.class || 'yes' };
  const h = toNumber(props.height);
  const floors = toNumber(props.num_floors);
  if (Number.isFinite(h) && h > 0) tags.height = String(h);
  if (Number.isFinite(floors) && floors > 0) tags['building:levels'] = String(floors);
  if (props.subtype) tags['overture:subtype'] = String(props.subtype);
  if (props.src) tags['overture:dataset'] = String(props.src);
  if (props.name) tags.name = String(props.name);
  return tags;
}

/** Polygon/MultiPolygon GeoJSON → daftar `rings` ([luar, ...lubang], [lon, lat], terbuka). */
function polygonsOf(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polys
    .map((poly) => poly.map((ring) => cleanRing(ring.map(([lon, lat]) => [lon, lat]), 0)).filter((r) => r.length >= 3))
    .filter((rings) => rings.length > 0);
}

/**
 * Normalisasi FeatureCollection Overture → Feature bangunan. MultiPolygon dipecah: id `<id>#k`.
 * @returns {import('./features.js').Feature[]}
 */
export function normalizeOverture(fc) {
  if (!fc || !Array.isArray(fc.features)) throw new TypeError('GeoJSON Overture tidak valid: tidak ada "features"');
  const out = [];
  for (const f of fc.features) {
    const props = f.properties || {};
    if (!props.id || !f.geometry) continue;
    const parts = polygonsOf(f.geometry);
    parts.forEach((rings, k) => {
      const id = parts.length > 1 ? `overture:${props.id}#${k}` : `overture:${props.id}`;
      out.push({ id, source: 'overture', kind: 'building', cls: props.class || 'yes', tags: overtureTags(props), rings });
    });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Path cache Overture untuk kawasan. */
export const overtureCachePath = (cacheDir, areaId) => join(cacheDir, 'overture', `${areaId}.geojson`);

/**
 * Baca cache Overture. Cache hanya sah bila isinya FeatureCollection DAN `release`-nya sama.
 * @returns {Promise<{ fc: object|null, miss: string|null }>} fc bila cache sah; `miss` = alasan
 *   cache tak dipakai (null bila file memang tidak ada).
 */
async function readOvertureCache(path, release, log) {
  let cached;
  try {
    cached = JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return { fc: null, miss: null };
    log.warn(`[citybake] cache Overture rusak (${path}): ${err.message} — hapus file ini bila berulang`);
    return { fc: null, miss: 'cache rusak' };
  }
  if (!Array.isArray(cached?.features)) {
    log.warn(`[citybake] cache Overture tidak valid (${path}): tidak ada "features" — hapus file ini bila berulang`);
    return { fc: null, miss: 'cache tidak valid' };
  }
  if (cached.release !== release) {
    return { fc: null, miss: `cache rilis ${cached.release ?? '(tanpa rilis)'} ≠ ${release}` };
  }
  return { fc: cached, miss: null };
}

/** Jalankan query bbox lewat koneksi `connect()`; koneksi selalu ditutup. */
async function queryOverture(connect, bbox, release) {
  const connection = await connect();
  try {
    const reader = await connection.runAndReadAll(buildOvertureSql(bbox, release));
    return { ...rowsToGeoJSON(reader.getRowObjectsJson()), release };
  } finally {
    connection.closeSync?.();
  }
}

/**
 * Muat Overture untuk kawasan: cache (rilis sama) → (bila tidak offline) DuckDB → simpan cache.
 * Gagal query → peringatan + null (bake lanjut dengan OSM saja). Gagal tulis cache → peringatan, hasil tetap dipakai.
 * @returns {Promise<object|null>} FeatureCollection (dengan `release`) atau null
 */
export async function loadOverture(areaId, bbox, {
  cacheDir, offline = false, release = OVERTURE.release, connect = connectDuckDb, log = console,
} = {}) {
  const path = overtureCachePath(cacheDir, areaId);
  const { fc: cached, miss } = await readOvertureCache(path, release, log);
  if (cached) return cached;
  if (offline) {
    log.warn(`[citybake] --offline dan cache Overture "${areaId}" ${miss ?? 'tidak ada'} — lanjut OSM saja`);
    return null;
  }
  if (miss) log.info(`[citybake] ${miss} untuk "${areaId}" — query ulang`);
  let fc;
  try {
    log.info(`[citybake] query Overture ${release} untuk "${areaId}" (DuckDB, beberapa menit)…`);
    fc = await queryOverture(connect, bbox, release);
  } catch (err) {
    log.warn(`[citybake] Overture gagal (${err.message}) — lanjut OSM saja`);
    return null;
  }
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(fc));
  } catch (err) {
    log.warn(`[citybake] gagal menyimpan cache Overture (${path}): ${err.message} — hasil query tetap dipakai`);
  }
  return fc;
}
