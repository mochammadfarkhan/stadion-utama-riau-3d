/**
 * Konfigurasi citybake (Node, offline). Menambah kawasan kota baru = menambah entri AREAS saja.
 * Koordinat diverifikasi lewat Overpass/Nominatim 2026-10-16 (lihat komentar per entri).
 */
import { tileBounds, tilesInRect, TILE_SIZE } from '../../src/geo/tiles.js';
import { WORLD_ORIGIN } from '../../src/config/constants.js';
import { stadionMaskWorld } from '../../src/regions/stadion/mask.js';
import { UNRI_BOUNDARY } from '../../src/districts/unri/boundary.js';

export { TILE_SIZE };

/** Versi format tile (manifest.version & data.json v). Naikkan bila kontrak berubah. */
export const FORMAT_VERSION = 1;

/**
 * Origin frame dunia = centroid luas poligon OSM way 327365495 "Stadion Utama Riau"
 * (leisure=stadium, 53 titik), dihitung dari `out geom` Overpass 2026-10-16. Sumber: src/config/constants.js.
 */
export const ORIGIN = WORLD_ORIGIN;

/**
 * Kawasan bake. center = lat/lon; halfSize = setengah sisi persegi (m) di frame dunia.
 * Tile yang di-bake = semua tile yang beririsan persegi itu (dibulatkan keluar ke grid 500 m), dikurangi
 * tile milik area di `skipAreas` (satu tile = satu area di manifest).
 */
export const AREAS = Object.freeze({
  stadion: Object.freeze({
    id: 'stadion',
    name: 'Kawasan Stadion Utama Riau',
    center: ORIGIN,
    halfSize: 1500,
  }),
  pusat: Object.freeze({
    id: 'pusat',
    name: 'Pusat kota — Masjid Raya An-Nur',
    // OSM node 13792599822 "Masjid Raya An-Nur" (amenity=place_of_worship); poligon kompleks:
    // way 1204061673 "Kompleks Masjid Raya An-Nur Provinsi Riau". ±8,3 km timur-laut stadion.
    center: Object.freeze({ lat: 0.5265934, lon: 101.4508552 }),
    halfSize: 750,
  }),
  unri: Object.freeze({
    id: 'unri',
    name: 'Kampus UNRI Bina Widya (tepi barat & selatan di luar area stadion)',
    // Pusat bbox poligon kampus OSM way 938374562 (lat 0,46434–0,48775; lon 101,37495–101,39352) ≈ dunia
    // (−589, 835). halfSize 1300 memuat seluruh poligon (x −1622…444, z −459…2129). Cache OSM area ini
    // (data-src/osm/unri.json) juga sumber campusbake ground/buildings (spec §6 butir 5).
    center: Object.freeze({ lat: 0.476045, lon: 101.384235 }),
    halfSize: 1300,
    skipAreas: Object.freeze(['stadion']),
  }),
});

/** Endpoint Overpass publik (dicoba berurutan saat retry). */
export const OVERPASS_ENDPOINTS = Object.freeze([
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]);

/** User-Agent wajib mengidentifikasi aplikasi (kebijakan penggunaan Overpass & OSMF). */
export const USER_AGENT = 'stadion-utama-riau-3d-citybake/0.1 (+https://github.com/mochammadfarkhan/stadion-utama-riau-3d)';

/** Overture Maps: rilis dipin agar hasil bake dapat diulang. Rilis terbaru di STAC catalog. */
export const OVERTURE = Object.freeze({
  release: '2026-09-23.1',
  s3Base: 's3://overturemaps-us-west-2/release',
  s3Region: 'us-west-2',
  stacCatalog: 'https://stac.overturemaps.org/catalog.json',
});

/** Direktori cache data mentah (di-.gitignore) dan keluaran tile (di-commit). */
export const PATHS = Object.freeze({ cacheDir: 'data-src', outDir: 'public/tiles' });

/** Tinggi per lantai (m) untuk building:levels dan heuristik. */
export const LEVEL_HEIGHT = 3.2;

/** Atap pelana hanya untuk footprint ~persegi panjang dengan luas < nilai ini (m²). */
export const GABLE_MAX_AREA = 150;

/** LOD1: bangunan lebih kecil dari ini (m²) dibuang. */
export const LOD1_MIN_BUILDING_AREA = 40;

/**
 * Ketinggian lapisan datar (m). Landuse: landuse + indeks prioritas kelas × landuseStep (maks ±0,05).
 * Offset kecil ini hanya membantu penampil biasa; klien sebaiknya menggambar lapisan datar dengan
 * depthWrite=false dan renderOrder landuse < water < roads (urutan segitiga = urutan gambar).
 */
export const LAYER_Y = Object.freeze({ landuse: 0.02, landuseStep: 0.002, water: 0.06, roadMinor: 0.08, roadMajor: 0.1 });

/**
 * Kelas jalan OSM `highway` → lebar total (m), warna, minor (dibuang di LOD1), label (nama di data.json).
 * Kelas yang tidak terdaftar (construction, proposed, platform, ...) diabaikan.
 */
export const ROAD_CLASSES = Object.freeze({
  motorway: { width: 22, color: '#3b3e44', minor: false, label: true },
  trunk: { width: 18, color: '#3b3e44', minor: false, label: true },
  primary: { width: 14, color: '#404349', minor: false, label: true },
  secondary: { width: 12, color: '#44474d', minor: false, label: true },
  tertiary: { width: 10, color: '#484b51', minor: false, label: true },
  motorway_link: { width: 8, color: '#3b3e44', minor: false, label: false },
  trunk_link: { width: 8, color: '#3b3e44', minor: false, label: false },
  primary_link: { width: 7, color: '#404349', minor: false, label: false },
  secondary_link: { width: 7, color: '#44474d', minor: false, label: false },
  tertiary_link: { width: 6, color: '#484b51', minor: false, label: false },
  unclassified: { width: 7, color: '#4c4f55', minor: false, label: false },
  residential: { width: 6, color: '#505359', minor: false, label: false },
  living_street: { width: 5, color: '#55585e', minor: true, label: false },
  service: { width: 4.5, color: '#55585e', minor: true, label: false },
  pedestrian: { width: 4, color: '#9a948a', minor: true, label: false },
  track: { width: 3.5, color: '#8a7a62', minor: true, label: false },
  cycleway: { width: 2, color: '#7a5a52', minor: true, label: false },
  footway: { width: 2, color: '#a8a296', minor: true, label: false },
  path: { width: 1.8, color: '#a39a86', minor: true, label: false },
  steps: { width: 2, color: '#a8a296', minor: true, label: false },
});

/** Sungai/kanal sebagai garis → pita air dengan lebar (m). */
export const WATERWAY_WIDTHS = Object.freeze({ river: 25, canal: 10, stream: 4, drain: 2.5, ditch: 1.5 });

/** Warna air (sRGB). */
export const WATER_COLOR = '#3f6f8f';

/**
 * Kelas landuse → warna (sRGB). URUTAN KUNCI = PRIORITAS GAMBAR (bawah → atas): kelas luas (permukiman)
 * di bawah, kelas kecil/spesifik (taman, lapangan, parkir) di atas. Kunci = `cls` hasil
 * normalisasi (lihat fetchOsm.landuseClassOf).
 */
export const LANDUSE_COLORS = Object.freeze({
  residential: '#c9c2b3',
  commercial: '#d4b8b0',
  retail: '#d9b3a8',
  industrial: '#bdb3c2',
  education: '#d8cfa0',
  religious: '#cfc4a8',
  construction: '#b9a888',
  farmland: '#b8c47a',
  cemetery: '#9fb08a',
  forest: '#4f7a3a',
  scrub: '#7d9a55',
  wetland: '#7a9a7a',
  grass: '#8fb36a',
  park: '#7fae5a',
  pitch: '#6fa84f',
  parking: '#a9a9a9',
});

/** Prioritas gambar landuse (indeks kecil digambar lebih dulu/lebih rendah). */
export const LANDUSE_ORDER = Object.freeze(Object.keys(LANDUSE_COLORS));

/** Palet bangunan (sRGB); dipilih deterministik dari hash id. */
export const BUILDING_COLORS = Object.freeze({
  walls: Object.freeze(['#e8e2d6', '#ddd5c5', '#f0ece4', '#d8cbb5', '#c9c4bb', '#e6d7c3', '#bfc7cc', '#efe6d2']),
  roofFlat: Object.freeze(['#9a9a96', '#8c8a85', '#a8a49c', '#7f8286']),
  roofGable: Object.freeze(['#a5452f', '#8e3b2a', '#b5573a', '#6d5f57']),
});

/** Batas ukuran (laporan memberi peringatan, tidak menggagalkan bake). */
export const BUDGET = Object.freeze({ tileBytes: 300 * 1024, totalBytes: 20 * 1024 * 1024 });

/**
 * Mask region handmade dalam koordinat DUNIA ({id, ring}). Sumber tunggal: mask region klien
 * (src/regions/stadion/mask.js) yang ditransformasi placement region (regionTransform.toWorld).
 */
export const REGION_MASKS = Object.freeze([
  Object.freeze({ id: 'stadion', ring: stadionMaskWorld() }),
]);

/**
 * Distrik berelevasi (spec §6): fitur kota di dalam ring diklip/dibuang saat bake (mask.applyDistricts).
 * excludeIds dibaca dari `buildingsFile` (keluaran M3) bila ada; tanpa berkas → hanya aturan centroid.
 */
export const DISTRICTS = Object.freeze([
  Object.freeze({ id: 'unri', ring: UNRI_BOUNDARY, buildingsFile: 'public/districts/unri/buildings.json' }),
]);

/** Persegi dunia kawasan (sebelum dibulatkan ke grid). */
export function areaRect(area, projection) {
  const c = projection.toWorld(area.center.lat, area.center.lon);
  return { minX: c.x - area.halfSize, minZ: c.z - area.halfSize, maxX: c.x + area.halfSize, maxZ: c.z + area.halfSize };
}

/** Tile yang di-bake untuk kawasan (tile milik `skipAreas` dibuang). */
export function areaTiles(area, projection, size = TILE_SIZE, areas = AREAS) {
  const skip = new Set((area.skipAreas ?? []).flatMap((id) => {
    const other = areas[id];
    if (!other) throw new Error(`skipAreas area "${area.id}": area tidak dikenal "${id}"`);
    return tilesInRect(areaRect(other, projection), size).map((t) => t.key);
  }));
  return tilesInRect(areaRect(area, projection), size).filter((t) => !skip.has(t.key));
}

/**
 * Bbox lat/lon untuk fetch: gabungan batas tile kawasan + margin (m) agar fitur yang melintas tepi
 * ikut terambil. @returns {{south: number, west: number, north: number, east: number}}
 */
export function areaFetchBBox(area, projection, margin = 60, size = TILE_SIZE, areas = AREAS) {
  const tiles = areaTiles(area, projection, size, areas);
  const b = tiles.map((t) => tileBounds(t.ix, t.iz, size));
  const minX = Math.min(...b.map((v) => v.minX)) - margin;
  const maxX = Math.max(...b.map((v) => v.maxX)) + margin;
  const minZ = Math.min(...b.map((v) => v.minZ)) - margin;
  const maxZ = Math.max(...b.map((v) => v.maxZ)) + margin;
  const sw = projection.toLatLon(minX, maxZ); // z besar = selatan
  const ne = projection.toLatLon(maxX, minZ);
  const se = projection.toLatLon(maxX, maxZ);
  const nw = projection.toLatLon(minX, minZ);
  return {
    south: Math.min(sw.lat, se.lat),
    west: Math.min(sw.lon, nw.lon),
    north: Math.max(ne.lat, nw.lat),
    east: Math.max(ne.lon, se.lon),
  };
}
