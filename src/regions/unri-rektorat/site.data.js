// src/regions/unri-rektorat/site.data.js
/**
 * Geometri OSM beku zona Rektorat, koordinat REGION-LOKAL (lokal = dunia − REKTORAT_PLACEMENT, yaw 0).
 * Sumber: cache Overpass data-src/osm/stadion.json (OSM 2026-10-16), createProjection(WORLD_ORIGIN),
 * dibulatkan 0,1 m; ring tertutup disimpan TERBUKA (titik penutup dibuang). Dicocokkan ulang oleh
 * tests/unri/rektoratData.test.js. Data © OpenStreetMap contributors (ODbL).
 * Lebar jalan = ROAD_CLASSES citybake (tertiary 10 m, service 4,5 m), sama dengan ground distrik (M2).
 */
const ring = (pts) => Object.freeze(pts.map((p) => Object.freeze(p)));

export const OSM_IDS = Object.freeze({
  rektorat: 282225347,
  perpustakaan: 282225374,
  danau: 373856980,
  putaran: 327363975,
  poros: 1455479596,
  parkir: 938379747,
  pulauParkir: 1455480427,
  jalanDepan: 817449378,
  jalanUtaraRektorat: 282242542,
  loopRektorat: 817449379,
  muchtarUtara: 465415521,
  muchtarSelatan: 1177156794,
  tertiaryUS: 282242560,
  titian: 783152923,
});

/** Gedung Rektorat Universitas Riau (`building:levels=4-7`, `roof=concrete`). Muka depan = +X (timur). */
export const REKTORAT_RING = ring([
  [-11.7, -32.3], [11.7, -32.3], [12.1, -7.5], [17.1, -7.3], [17.4, -2.9], [26, -2.9],
  [26, 5.4], [17.2, 5.7], [17, 10.1], [12.1, 10.2], [11.7, 32.2], [-11.7, 32.2],
]);

/** Perpustakaan UNRI (lama), dua blok besar + penghubung + tonjolan masuk barat/timur. */
export const PERPUS_RING = ring([
  [-138.2, -54.2], [-141.2, -54.2], [-141.1, -67.4], [-137.9, -67.4], [-137.9, -74.9], [-116.7, -74.8],
  [-116.7, -67.7], [-111.5, -67.7], [-111.4, -77.8], [-88, -77.6], [-88, -68.1], [-84.5, -68.1],
  [-84.6, -54.8], [-88.2, -54.9], [-88.2, -49], [-111.7, -49.1], [-111.7, -54.5], [-117, -54.5],
  [-117, -46.6], [-138.2, -46.7],
]);

/** Danau Buatan Universitas Riau (water=reservoir, ±0,33 ha). */
export const DANAU_RING = ring([
  [258.1, -7.4], [265.8, -6.1], [269, -5.5], [276.4, -0.1], [277.3, 6.9], [275.4, 14.8], [266.8, 23.1],
  [249.8, 33.9], [220, 47.6], [201.5, 57.4], [192.8, 63.1], [186.1, 66.3], [182.6, 67.6], [181.3, 70.8],
  [172.7, 75.5], [159.2, 83.2], [148, 88.6], [150.3, 81.9], [150.3, 75.2], [149.3, 71.1], [158.6, 60.9],
  [165.6, 52.3], [173.6, 47.6], [180.4, 46.3], [182.9, 43.1], [188.3, 41.8], [192.2, 38], [198, 35.2],
  [207.9, 31.7], [214.6, 27.5], [220, 24.4], [227.1, 23.1], [234.1, 16.7], [242.4, 7.8], [243.4, 3.7],
  [248.2, -1.4], [253.3, -6.5],
]);

/** Putaran Jalan Mukhtar Luthfi / Depan Rektorat (tertiary, oneway). */
export const PUTARAN = ring([
  [252.1, 48.3], [256.4, 44.9], [285.9, 27.4], [292.9, 22.4], [296.1, 18.9], [298.1, 15.2], [298.8, 11.6],
  [298.7, 8.3], [296.7, 2.4], [292.7, -4.6],
]);

/** Loop service poros taman (U terbuka ke barat, menempel jalan tertiary utara–selatan). */
export const POROS = ring([[83.6, 12.3], [210.3, 12.4], [210.3, -4.2], [84.1, -3.9]]);

/** Parkir depan Rektorat (amenity=parking). */
export const PARKIR = ring([[33.3, -32.2], [34, 39.9], [81.3, 39.5], [80.7, -32.6]]);

/** Loop lorong parkir yang mengelilingi pulau tengah (sumbu Rektorat). */
export const PULAU_PARKIR = ring([[41, -17.9], [64.4, -17.6], [64.5, 21.7], [64.4, 21.7], [41.2, 22.2]]);

/** Jalan drop-off depan Rektorat (service). */
export const JALAN_DEPAN = ring([[26.8, -38.5], [26.6, 42.5]]);

/** Jalan service utara Rektorat. */
export const JALAN_UTARA_REKTORAT = ring([[84.6, -39.8], [40.9, -38.7], [26.8, -38.5], [-15, -39], [-22.9, -39], [-59.8, -37.3]]);

/** Jalan service barat & selatan Rektorat. */
export const LOOP_REKTORAT = ring([[-15, -39], [-12.6, 32.4], [-11.5, 36.3], [-9.9, 38.9], [-3.6, 43], [26.6, 42.5], [41.4, 42.6], [85, 42.7]]);

/** Jl. Muchtar Lutfi sisi utara danau (tertiary, oneway ke timur). */
export const MUCHTAR_UTARA = ring([[86.6, -82.5], [148, -59.2], [156, -53.3], [172.3, -46.4], [212.8, -29.4], [227, -24], [245.7, -17], [292.7, -4.6]]);

/** Jl. Muchtar Lutfi sisi selatan danau (tertiary). */
export const MUCHTAR_SELATAN = ring([[252.1, 48.3], [135.2, 117.9]]);

/** Tertiary utara–selatan di kepala poros (way 282242560). */
export const TERTIARY_US = ring([
  [135.2, 117.9], [107.7, 91.3], [97.5, 74], [91.4, 62.9], [86.6, 53.1], [85, 42.7], [83.9, 35.1],
  [83.6, 12.3], [83.6, 11.8], [84.1, -3.9], [84.1, -6.1], [84.6, -39.8], [86.6, -82.5],
]);

/** Titian (jembatan pejalan kaki, footway bridge=yes) di atas gorong-gorong keluaran danau — M2 sengaja tidak men-drape-nya; dibangun region (danau.js). */
export const TITIAN = ring([[281.7, -23.9], [267.6, -27.6]]);

/** Jalan di dalam/sekitar mask beserta lebar total (m) — dipakai tes jarak bebas layout. */
export const ROADS = Object.freeze([
  { id: 'poros', pts: POROS, w: 4.5 },
  { id: 'jalanDepan', pts: JALAN_DEPAN, w: 4.5 },
  { id: 'pulauParkir', pts: PULAU_PARKIR, w: 4.5 },
  { id: 'jalanUtaraRektorat', pts: JALAN_UTARA_REKTORAT, w: 4.5 },
  { id: 'loopRektorat', pts: LOOP_REKTORAT, w: 4.5 },
  { id: 'putaran', pts: PUTARAN, w: 10 },
  { id: 'muchtarUtara', pts: MUCHTAR_UTARA, w: 10 },
  { id: 'muchtarSelatan', pts: MUCHTAR_SELATAN, w: 10 },
  { id: 'tertiaryUS', pts: TERTIARY_US, w: 10 },
].map(Object.freeze));

/**
 * Massa Rektorat (turunan, bukan OSM mentah). slab = massa utama; tengah = blok tengah berkaca biru
 * (OSM x 12,1→17,1, z −7,5…10,2; disimetriskan ke ±8,8, geser 1,3 m < presisi tracing); kanopi =
 * tonjolan depan 8,6 × 8,3 (kanopi merah N03 di atas jalur drop-off).
 */
export const REKTORAT_MASSA = Object.freeze({
  slab: Object.freeze({ x0: -11.7, x1: 11.7, z0: -32.3, z1: 32.2 }),
  tengah: Object.freeze({ x0: 11.7, x1: 17.1, z0: -8.8, z1: 8.8 }),
  kanopi: Object.freeze({ x0: 17.4, x1: 26.0, z0: -4.15, z1: 4.15 }),
});

/**
 * Perpustakaan lama: "empat gedung, masing-masing dua lantai" [S] → blok barat & timur OSM dibelah di
 * tengah (z −60,8 & −63,4) jadi empat kuadran (urutan: barat-laut, barat-daya, timur-laut, timur-daya);
 * penghubung = link tengah + tonjolan masuk barat & timur (persegi panjang lokal).
 */
export const PERPUS_MASSA = Object.freeze({
  kuadran: Object.freeze([
    ring([[-137.9, -74.9], [-116.7, -74.8], [-116.7, -60.8], [-137.9, -60.8]]),
    ring([[-137.9, -60.8], [-117, -60.8], [-117, -46.6], [-138.2, -46.7]]),
    ring([[-111.4, -77.8], [-88, -77.6], [-88, -63.4], [-111.5, -63.4]]),
    ring([[-111.5, -63.4], [-88.2, -63.4], [-88.2, -49], [-111.7, -49.1]]),
  ]),
  penghubung: Object.freeze([
    Object.freeze({ x0: -116.7, x1: -111.5, z0: -67.7, z1: -54.5 }),
    Object.freeze({ x0: -141.2, x1: -137.9, z0: -67.4, z1: -54.2 }),
    Object.freeze({ x0: -88.0, x1: -84.5, z0: -68.1, z1: -54.8 }),
  ]),
});
