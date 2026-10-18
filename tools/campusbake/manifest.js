/**
 * manifest.json & ATTRIBUTION.txt distrik UNRI (index M1: `{ format:'unri-district', version:1,
 * terrain:{…format.js…, chunks:[key…]}, ground:{chunks:[…]}, buildings:'buildings.json',
 * attribution:'ATTRIBUTION.txt' }`). Murni; I/O di cli.js. Bagian lain (ground/buildings) milik M2/M3 dan
 * dipertahankan saat terrain di-bake ulang.
 */
export const MANIFEST_FILE = 'manifest.json';
export const ATTRIBUTION_FILE = 'ATTRIBUTION.txt';
export const DISTRICT_FORMAT = 'unri-district';
export const DISTRICT_VERSION = 1;

/** Manifest kosong. */
export function emptyManifest() {
  return {
    format: DISTRICT_FORMAT, version: DISTRICT_VERSION, terrain: null, ground: { chunks: [] },
    buildings: 'buildings.json', attribution: ATTRIBUTION_FILE,
  };
}

/** Ganti bagian terrain (objek baru); manifest lama berformat lain → galat jelas. */
export function withTerrain(existing, terrain) {
  const base = existing ?? emptyManifest();
  if (base.format !== DISTRICT_FORMAT || base.version !== DISTRICT_VERSION) {
    throw new Error(`manifest distrik lama berformat ${base.format}/${base.version} — hapus ${MANIFEST_FILE} lalu bake ulang`);
  }
  return { ...base, terrain };
}

/** Isi ATTRIBUTION.txt. */
export function attributionText({ srtm, osmTimestamp }) {
  return [
    'Data distrik Kampus UNRI Bina Widya di direktori ini adalah karya turunan dari:',
    '',
    `  ${srtm.attribution}`,
    `    ${srtm.url}`,
    '    Shuttle Radar Topography Mission (Februari 2000) — domain publik, disebut sebagai sumber.',
    '  © OpenStreetMap contributors — https://www.openstreetmap.org/copyright',
    `    (batas kampus, jalan, gedung, danau; data ${osmTimestamp ?? 'waktu tidak diketahui'})`,
    '',
    'Lisensi data OSM: Open Database License (ODbL) 1.0 — https://opendatacommons.org/licenses/odbl/1-0/',
    'File terrain/*.bin dibentuk dengan geometri OSM (pengondisian jalan, pad gedung, danau) sehingga tunduk',
    'pada ODbL; kode proyek tetap berlisensi MIT.',
    '',
    'Dihasilkan oleh tools/campusbake (npm run bake:campus -- terrain).',
    '',
  ].join('\n');
}
