/**
 * Konfigurasi campusbake (Node, offline): sumber DEM, kawasan OSM kampus, parameter terrain (spec §5.2).
 * Semua angka bake ada di sini agar mudah ditinjau; mengubahnya mengubah keluaran (golden test).
 */
import { WORLD_ORIGIN } from '../../src/config/constants.js';
import { stadionMaskWorld } from '../../src/regions/stadion/mask.js';
import { ROAD_CLASSES } from '../citybake/config.js';

export const ORIGIN = WORLD_ORIGIN;

/** Direktori keluaran distrik (di-commit) dan cache data mentah (di-.gitignore lewat `data-src/`). */
export const PATHS = Object.freeze({
  outDir: 'public/districts/unri',
  cacheDir: 'data-src',
  boundaryModule: 'src/districts/unri/boundary.js',
});

/**
 * SRTM GL1 (1″, NASA/USGS, domain publik) ubin N00E101, mirror AWS Open Data "Terrain Tiles"
 * (elevation-tiles-prod, format skadi = .hgt.gz). Diverifikasi 2026-10-17: HTTP 200 tanpa login,
 * Content-Length 8.376.941, ETag "16e6f55bbca4ce2caf1671381a458c26", ISIZE gzip 25.934.402 = 3601² × 2.
 * sha256 dipin agar bake ulang memakai data yang sama (spec §15 "rilis dipin").
 */
export const SRTM = Object.freeze({
  tile: 'N00E101',
  lat0: 0,
  lon0: 101,
  size: 3601,
  url: 'https://s3.amazonaws.com/elevation-tiles-prod/skadi/N00/N00E101.hgt.gz',
  sha256: '9dbcbb8021efcb2a472fae201ab9a3c8a323e61c69f0d8ca6b1eea134998d314',
  attribution: 'SRTM GL1 1″ (NASA/USGS, domain publik) via AWS Open Data Terrain Tiles (skadi)',
});

/**
 * Kawasan OSM kampus (cache `data-src/osm/unri-kampus.json`, query Overpass yang sama dengan citybake).
 * Bbox = bbox poligon way 938374562 (lat 0,46434–0,48775; lon 101,37495–101,39352) + ±0,002° (±220 m).
 */
export const CAMPUS_OSM = Object.freeze({
  areaId: 'unri-kampus',
  wayId: 938374562,
  bbox: Object.freeze({ south: 0.4623, west: 101.3727, north: 0.4898, east: 101.3957 }),
});

/** Mask stadion dunia (sumber tunggal: src/regions/stadion/mask.js). */
export const STADION_MASK_WORLD = stadionMaskWorld();

/** Batas distrik (spec §6 bullet terakhir): way kampus − (mask stadion + 40 m), disederhanakan 5 m. */
export const BOUNDARY = Object.freeze({ maskMargin: 40, simplify: 5, circleSegments: 16 });

/** Parameter terrain (spec §5.2). Satuan meter kecuali disebut lain. */
export const TERRAIN = Object.freeze({
  margin: 150,              // bbox distrik + margin → chunk yang dibuat
  median: 5,                // median 5×5 sampel
  gaussSigma: 5,            // σ = 20 m = 5 sampel grid 4 m
  datumSpacing: 4,          // sampel datum sepanjang batas
  blendDistance: 120,       // smoothstep(0, 120, jarakKeTepi)
  maskBlendMargin: 60,      // mask stadion + 60 m tetap y = 0
  road: Object.freeze({
    spacing: 4, maxGrade: 0.06, shoulder: 1.5, blend: 6,
    skip: Object.freeze(['steps']),
  }),
  ditch: Object.freeze({    // [INFERENSI pola kampus Pekanbaru]: parit tepi jalan utama
    enabled: true, width: 1.0, depth: 0.6, offset: 1.0,
    classes: Object.freeze(['primary', 'secondary', 'tertiary', 'tertiary_link']),
  }),
  pad: Object.freeze({ blend: 4 }),
  water: Object.freeze({
    shoreDrop: 0.4, depth: 1.5, bankRun: 3,
    lakes: Object.freeze([
      Object.freeze({ id: 'w373856980', name: 'Danau Buatan Universitas Riau' }),
      Object.freeze({ id: 'w327366050', name: 'Waduk UNRI' }),
    ]),
  }),
});

/** Lebar total jalan per kelas OSM (m) — mengikuti citybake (spec §6). */
export const ROAD_WIDTHS = Object.freeze(Object.fromEntries(Object.entries(ROAD_CLASSES).map(([k, v]) => [k, v.width])));

/**
 * Pad region hero (dunia): `{ id, ring:[[x,z]...], y:'median'|number }`. Kosong di M1; M4/M6 menambah
 * pad region `unri-lembaga`/`unri-rektorat` (ring lokal region diubah ke dunia lewat placement region).
 */
export const REGION_PADS = Object.freeze([]);

/** Batas laporan (peringatan, tidak menggagalkan bake). Spec §9.1: data distrik ≤ 8 MB total. */
export const BUDGET = Object.freeze({ terrainBytes: 3 * 1024 * 1024 });
