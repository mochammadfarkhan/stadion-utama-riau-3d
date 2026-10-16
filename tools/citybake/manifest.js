/**
 * manifest.json & ATTRIBUTION.txt (kontrak "Format tile v1"). Fungsi murni; I/O ada di pipeline.js.
 */
import { FORMAT_VERSION } from './config.js';

export const MANIFEST_FILE = 'manifest.json';
export const ATTRIBUTION_FILE = 'ATTRIBUTION.txt';

/** Nama file tile. */
export const tileFiles = (key) => ({ lod0: `${key}.lod0.glb`, lod1: `${key}.lod1.glb`, data: `${key}.data.json` });

/** Manifest kosong. */
export function createManifest({ origin, tileSize }) {
  return {
    version: FORMAT_VERSION,
    format: 'citybake-tiles',
    origin: { lat: origin.lat, lon: origin.lon },
    frame: 'ENU lokal; +X timur, -Z utara, +Y atas; meter',
    tileSize,
    unit: 0.1,
    areas: [],
    tiles: [],
  };
}

/** Pastikan manifest lama sejenis sebelum digabung. @throws {Error} */
export function assertCompatible(existing, fresh) {
  const same = existing.version === fresh.version && existing.tileSize === fresh.tileSize
    && existing.origin?.lat === fresh.origin.lat && existing.origin?.lon === fresh.origin.lon;
  if (!same) {
    throw new Error('manifest.json lama berbeda versi/origin/tileSize — hapus public/tiles/ lalu bake ulang semua area');
  }
}

const tileOrder = (a, b) => a.iz - b.iz || a.ix - b.ix;

/**
 * Entri tile manifest.
 * @param {{key: string, ix: number, iz: number, area: string, bytes: {lod0: number, lod1: number, data: number},
 *   triangles: [number, number]}} t
 */
export function tileEntry(t) {
  const f = tileFiles(t.key);
  return {
    key: t.key,
    ix: t.ix,
    iz: t.iz,
    area: t.area,
    bytes: t.bytes.lod0 + t.bytes.lod1 + t.bytes.data,
    lod: [
      { level: 0, file: f.lod0, bytes: t.bytes.lod0, triangles: t.triangles[0] },
      { level: 1, file: f.lod1, bytes: t.bytes.lod1, triangles: t.triangles[1] },
    ],
    data: { file: f.data, bytes: t.bytes.data },
  };
}

/**
 * Ganti (atau tambah) satu area beserta tile-nya; tile area lain dipertahankan. Objek baru.
 * @param {object} manifest
 * @param {{id: string, name: string, bounds: object, osmTimestamp: string|null, overtureRelease: string|null,
 *   tiles: object[]}} area tiles = hasil tileEntry
 */
export function upsertArea(manifest, area) {
  const keys = new Set(area.tiles.map((t) => t.key));
  const otherTiles = manifest.tiles.filter((t) => t.area !== area.id && !keys.has(t.key));
  const areaEntry = {
    id: area.id,
    name: area.name,
    bounds: area.bounds,
    osmTimestamp: area.osmTimestamp,
    overtureRelease: area.overtureRelease,
    tiles: area.tiles.map((t) => t.key),
  };
  return {
    ...manifest,
    areas: [...manifest.areas.filter((a) => a.id !== area.id), areaEntry].sort((a, b) => (a.id < b.id ? -1 : 1)),
    tiles: [...otherTiles, ...area.tiles].sort(tileOrder),
  };
}

/** Validasi bentuk manifest (dipakai golden test dan dapat dipakai klien). @returns {string[]} galat */
export function validateManifest(m) {
  const errors = [];
  if (!m || m.version !== FORMAT_VERSION) errors.push(`version harus ${FORMAT_VERSION}`);
  if (!Number.isFinite(m?.origin?.lat) || !Number.isFinite(m?.origin?.lon)) errors.push('origin lat/lon tidak valid');
  if (!(m?.tileSize > 0)) errors.push('tileSize tidak valid');
  for (const t of m?.tiles ?? []) {
    if (t.key !== `${t.ix}_${t.iz}`) errors.push(`key ${t.key} tidak cocok dengan ix/iz`);
    if (!Array.isArray(t.lod) || t.lod.length !== 2) errors.push(`${t.key}: lod harus 2 entri`);
    const sum = (t.lod ?? []).reduce((s, l) => s + l.bytes, 0) + (t.data?.bytes ?? 0);
    if (sum !== t.bytes) errors.push(`${t.key}: bytes ${t.bytes} ≠ jumlah file ${sum}`);
  }
  return errors;
}

/** Isi ATTRIBUTION.txt. */
export function attributionText(manifest) {
  const areas = manifest.areas.map((a) => {
    const ov = a.overtureRelease ? `Overture ${a.overtureRelease}` : 'tanpa Overture';
    return `- ${a.name} (${a.id}): OSM ${a.osmTimestamp ?? 'waktu tidak diketahui'}; ${ov}; ${a.tiles.length} tile`;
  });
  return [
    'Data tile kota di direktori ini adalah karya turunan (derived database) dari:',
    '',
    '  © OpenStreetMap contributors — https://www.openstreetmap.org/copyright',
    '  Overture Maps Foundation (theme buildings) — https://overturemaps.org',
    '    (menggabungkan OpenStreetMap, Microsoft ML Buildings, Google Open Buildings, Esri Community Maps)',
    '',
    'Lisensi data: Open Database License (ODbL) 1.0 — https://opendatacommons.org/licenses/odbl/1-0/',
    'File *.glb dan *.data.json di sini tunduk pada ODbL; kode proyek tetap berlisensi MIT.',
    '',
    'Area yang di-bake:',
    ...areas,
    '',
    'Dihasilkan oleh tools/citybake (node tools/citybake --area <id>).',
    '',
  ].join('\n');
}
