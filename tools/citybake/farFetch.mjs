/**
 * Ambil data SELURUH Kota Pekanbaru dari Overture Maps (DuckDB → CSV, di-cache ke data-src/overture-kota/, di-.gitignore)
 * untuk lapisan "kota jauh" (farbake.mjs → public/far/*). Hanya atribut ringkas: bangunan (pusat, luas, rasio, tinggi),
 * jalan (WKT sederhana), air & tutupan lahan (WKT sederhana). Tiap query memindai metadata partisi global (±5 menit).
 * Pakai: node tools/citybake/farFetch.mjs [bangunan|jalan|air|lahan ...]  (tanpa argumen = semua)
 */
import process from 'node:process';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { connectDuckDb } from './fetchOverture.js';
import { OVERTURE } from './config.js';

/** Kotak kota (Nominatim relation 16563796) + sedikit margin. */
export const KOTA_BBOX = Object.freeze({ south: 0.42, north: 0.691, west: 101.324, east: 101.606 });
const OUT = join('data-src', 'overture-kota');
const base = (theme, type) => `read_parquet('${OVERTURE.s3Base}/${OVERTURE.release}/theme=${theme}/type=${type}/*', hive_partitioning=1)`;
const where = ({ south, north, west, east } = KOTA_BBOX) =>
  `bbox.xmin <= ${east} AND bbox.xmax >= ${west} AND bbox.ymin <= ${north} AND bbox.ymax >= ${south}`;

/** Jalan yang dipakai di LOD jauh (kelas kecil/jalan setapak dibuang). */
const ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential'];

export const QUERIES = Object.freeze({
  bangunan: {
    file: 'bangunan.csv',
    // luas planar derajat² → m² dihitung di farbake (butuh lintang); di sini simpan mentah
    sql: `SELECT round((bbox.xmin + bbox.xmax) / 2, 6) AS lon, round((bbox.ymin + bbox.ymax) / 2, 6) AS lat,
      round(bbox.xmax - bbox.xmin, 7) AS dlon, round(bbox.ymax - bbox.ymin, 7) AS dlat, round(ST_Area(geometry), 12) AS area_deg2,
      coalesce(height, num_floors * 3.2, 0) AS h, coalesce(class, subtype, '') AS kelas
      FROM ${base('buildings', 'building')} WHERE ${where()}`,
  },
  jalan: {
    file: 'jalan.csv',
    sql: `SELECT class AS kelas, ST_AsText(ST_Simplify(geometry, 0.00003)) AS wkt FROM ${base('transportation', 'segment')}
      WHERE subtype = 'road' AND class IN (${ROAD_CLASSES.map((c) => `'${c}'`).join(',')}) AND ${where()}`,
  },
  air: {
    file: 'air.csv',
    sql: `SELECT coalesce(subtype, '') AS subtype, ST_AsText(ST_Simplify(geometry, 0.00005)) AS wkt FROM ${base('base', 'water')} WHERE ${where()}`,
  },
  lahan: {
    file: 'lahan.csv',
    sql: `SELECT subtype AS kelas, ST_AsText(ST_Simplify(geometry, 0.0001)) AS wkt FROM ${base('base', 'land_cover')} WHERE ${where()}`,
  },
});

async function main() {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(QUERIES);
  await mkdir(OUT, { recursive: true });
  const db = await connectDuckDb();
  try {
    for (const name of names) {
      const q = QUERIES[name];
      if (!q) throw new Error(`query tidak dikenal: ${name}`);
      const path = join(OUT, q.file).replaceAll('\\', '/');
      const t0 = Date.now();
      console.log(`[${name}] mulai…`);
      await db.runAndReadAll(`COPY (${q.sql}) TO '${path}' (HEADER, DELIMITER ',')`);
      const size = (await stat(path)).size;
      console.log(`[${name}] selesai ${((Date.now() - t0) / 1000).toFixed(0)} s, ${(size / 1048576).toFixed(1)} MB → ${path}`);
    }
  } finally {
    db.closeSync();
  }
}

if (import.meta.url === `file:///${process.argv[1].replaceAll('\\', '/')}`) main().catch((err) => { console.error(err); process.exit(1); });
