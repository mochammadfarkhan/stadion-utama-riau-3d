/**
 * Konstanta bake tanah & jalan kampus (M2). Aturan berlabel [INFERENSI] bukan fakta OSM/riset dan dapat
 * diubah tanpa mengubah format. Satuan meter kecuali disebut.
 */
export const GROUND_FORMAT = Object.freeze({ v: 1, unit: 0.1, roadClipMargin: 16 });

export const GROUND_PATHS = Object.freeze({
  osmCache: 'data-src/osm/unri.json', // cache citybake area "unri" (plan M2 Task 6)
  districtDir: 'public/districts/unri',
  groundDir: 'public/districts/unri/ground',
});

/** Peringatan laporan bila total berkas ground melebihi ini (budget data distrik spec §9.1 = 8 MB total). */
export const GROUND_BUDGET_BYTES = 3 * 1024 * 1024;

/** Kelas highway yang digambar sebagai aspal ter-drape (lebar dari ROAD_CLASSES citybake). */
export const VEHICLE_CLASSES = Object.freeze([
  'primary', 'secondary', 'tertiary', 'primary_link', 'secondary_link', 'tertiary_link',
  'unclassified', 'residential', 'living_street', 'service',
]);
/** Kelas pejalan kaki yang digambar sebagai beton ter-drape. */
export const WALK_CLASSES = Object.freeze(['footway', 'pedestrian', 'steps', 'cycleway']);
/** Jalan tanah: tidak di-drape, menjadi bobot "soil" permukaan. */
export const SOIL_PATH_CLASSES = Object.freeze(['path', 'track']);

/**
 * Jalur searah (oneway=yes) kelas besar di kampus = satu sisi jalur ganda 2 lajur (foto drone 2016:
 * "aspal 2 lajur searah"): lebar = lebar kelas × faktor [INFERENSI: 10 m × 0,7 = 7 m].
 */
export const ONEWAY = Object.freeze({ classes: Object.freeze(['primary', 'secondary', 'tertiary']), factor: 0.7 });

/** Tumpang di batas distrik: jalan kendaraan w/2 + roadExtra, trotoar `walk` (menutup ujung jalan kota). */
export const OVERLAP = Object.freeze({ roadExtra: 2, walk: 1 });

/** Muka air (spec §5.2.8): tanah terendah di tepi − drop; "dipahat" bila dasar < muka − carvedMin. */
export const WATER = Object.freeze({ drop: 0.4, carvedMin: 0.3, edgeStep: 2, gridStep: 4 });

/**
 * Parit tepi jalan utama [INFERENSI pola kampus Pekanbaru, spec §5.2.8]: lebar 1,0 m; garis tengah di
 * w/2 + bahu 1,5 + jarak 1,0 + ½ lebar 0,5 = w/2 + 3,0 m dari sumbu jalan. Sama dengan konstanta parit M1
 * (diperiksa di Task 0). `osmWidth` = lebar parit OSM (WATERWAY_WIDTHS.ditch citybake).
 */
export const DITCH = Object.freeze({
  enabled: true, classes: Object.freeze(['primary', 'secondary', 'tertiary', 'tertiary_link']), width: 1.0, centerOffset: 3.0,
  step: 1, minRun: 4, clearRoad: 1.5, clearWalk: 0.5, clearBuilding: 1, osmWidth: 1.5,
});

/** Bobot permukaan per sampel grid 4 m (spec §5.3). Nilai landcover [INFERENSI visual]. */
export const SURFACE_RULES = Object.freeze({
  landcover: Object.freeze({
    bare: Object.freeze({ soil: 1 }),
    wetland: Object.freeze({ wet: 0.75 }),
    farmland: Object.freeze({ soil: 0.8 }),
    sawit: Object.freeze({ soil: 0.5 }),
    orchard: Object.freeze({ soil: 0.45 }),
    forest: Object.freeze({ soil: 0.35 }),
    park: Object.freeze({}),
    grass: Object.freeze({}),
  }),
  /** Prioritas tumpang-tindih landcover (pertama menang). */
  priority: Object.freeze(['bare', 'wetland', 'farmland', 'sawit', 'orchard', 'forest', 'park', 'grass']),
  shoulder: Object.freeze({ classes: Object.freeze(['tertiary', 'tertiary_link', 'residential', 'service']), width: 1.5, soil: 0.35 }),
  soilPath: Object.freeze({ feather: 1.5 }),
  waterBank: Object.freeze({ width: 6 }),
  ditch: Object.freeze({ width: 2, wet: 0.8 }),
  steep: Object.freeze({ grade: 0.25, soil: 0.4 }),
});

/** Spesies vegetasi (urutan = urutan di ground JSON). Katalog: V01, V02, V03, V06, V07. */
export const VEG_SPECIES = Object.freeze(['mahoni', 'angsana', 'saga', 'sawit', 'semak']);

/**
 * Penempatan vegetasi. Komposisi peneduh dari riset (mahoni dominan, angsana, saga — [T]); jarak tanam &
 * proporsi [INFERENSI]. Sawit: pola segitiga 9 m (standar kebun sawit). Pohon tepi jalan 5 m dari tepi
 * aspal (di luar parit yang 2,5–3,5 m dari tepi).
 */
export const VEG = Object.freeze({
  forest: Object.freeze({ spacing: 16, jitter: 0.35, mix: Object.freeze([['mahoni', 0.5], ['angsana', 0.3], ['saga', 0.2]]) }),
  park: Object.freeze({ spacing: 24, jitter: 0.4, keep: 0.6, mix: Object.freeze([['angsana', 0.45], ['mahoni', 0.35], ['saga', 0.2]]) }),
  grass: Object.freeze({ spacing: 30, jitter: 0.45, keep: 0.25, mix: Object.freeze([['saga', 0.5], ['angsana', 0.5]]) }),
  orchard: Object.freeze({ spacing: 12, jitter: 0.15, mix: Object.freeze([['saga', 1]]) }), // kebun tanpa spesies OSM → pohon buah [INFERENSI]
  sawit: Object.freeze({ spacing: 9 }),
  shrubPark: Object.freeze({ spacing: 12, jitter: 0.45, keep: 0.4, mix: Object.freeze([['semak', 1]]) }),
  shrubParking: Object.freeze({ spacing: 6, offset: 1.2 }),
  street: Object.freeze({
    spacing: 14, offset: 5, classes: Object.freeze(['tertiary', 'tertiary_link', 'residential']),
    mix: Object.freeze([['mahoni', 0.5], ['angsana', 0.3], ['saga', 0.2]]),
  }),
  clear: Object.freeze({ road: 1.5, walk: 1, building: 3, water: 2 }),
  maxGrade: 0.35,
});

/** Props kampus (P03 PJU, P04 bangku, P05 tong sampah). Jarak [INFERENSI]. */
export const PROPS = Object.freeze({
  lamp: Object.freeze({ spacing: Object.freeze({ tertiary: 35, tertiary_link: 35, residential: 40, service: 50 }), offset: 1.0 }),
  bench: Object.freeze({ spacing: 30, offset: 1.6, minWalk: 20 }),
  bin: Object.freeze({ every: 2, along: 1.4 }),
  clear: Object.freeze({ road: 0.8, walk: 0.5, building: 1.5, water: 1 }),
});
