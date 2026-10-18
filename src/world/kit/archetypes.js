/**
 * Katalog arketipe gedung kampus K01–K12 (spec §7.1) + palet + jenis atap + id hero. Data beku,
 * murni (tanpa three). Satuan meter; warna hex sRGB. Setiap ciri bertanda sumber di komentar:
 * [T] fakta riset, [INF] inferensi pola kampus negeri Indonesia 1980–90-an (riset §4 baris "Gedung lama").
 */

const deepFreeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  return Object.freeze(o);
};

/** Id hero handmade (spec §7.1). Builder-nya di src/world/kit/hero/index.js. */
export const HERO_IDS = Object.freeze([
  'hero:rektorat', 'hero:masjid-arfaunnas', 'hero:gerbang-sm-amin', 'hero:ggm',
  'hero:sekretariat-lembaga', 'hero:student-center', 'hero:stadion-mini',
]);

/** Arketipe pengganti geometri placeholder hero (M3) sampai M4/M6 mengganti builder-nya. */
export const HERO_STANDIN = Object.freeze({
  'hero:rektorat': 'K12', 'hero:masjid-arfaunnas': 'K06', 'hero:gerbang-sm-amin': 'K11', 'hero:ggm': 'K12',
  'hero:sekretariat-lembaga': 'K01', 'hero:student-center': 'K03', 'hero:stadion-mini': 'K07',
});

/** Jenis atap (spec §7.2 langkah 5) + dua bentuk khusus musala. */
export const ROOF_TYPES = Object.freeze(['pelana', 'limas', 'datar-parapet', 'pelana-lebar', 'limas-tumpang', 'datar']);

/** Sisi selasar: 'jalan' = sisi panjang paling menghadap jalan terdekat (spec §7.2 langkah 3). */
export const CORRIDOR_SIDES = Object.freeze(['jalan', 'belakang', 'dua', 'keliling', 'tidak']);

export const CONFIDENCE = Object.freeze(['tinggi', 'sedang', 'rendah']);

/**
 * Palet: wall (dinding), trim (list/kusen beton), plinth (plint 0,6 m), column (kolom selasar),
 * roof (penutup atap), fascia (lisplang), accent (pintu/kusen kayu), floor (lantai selasar).
 */
export const PALETTES = deepFreeze({
  'krem-seng': { wall: 0xeadfc4, trim: 0xf5efe2, plinth: 0x8f9396, column: 0xf2ecdf, roof: 0x7f909d, fascia: 0xf4f1ea, accent: 0x6e4b32, floor: 0xcfc6b4 }, // [INF] cat krem, [T] seng
  'putih-seng': { wall: 0xf1efe9, trim: 0xe2e0da, plinth: 0x8d9195, column: 0xfbfaf6, roof: 0x8495a1, fascia: 0xf7f6f2, accent: 0x5f4532, floor: 0xd2cdc2 }, // [INF]
  'krem-genteng': { wall: 0xeadfc4, trim: 0xf5efe2, plinth: 0x8f9396, column: 0xf2ecdf, roof: 0xa65b3c, fascia: 0xf4f1ea, accent: 0x6e4b32, floor: 0xcfc6b4 }, // [T] building:roof=tile
  adb: { wall: 0xf4f4f1, trim: 0xd8d9d7, plinth: 0xb9bcbd, column: 0xffffff, roof: 0xc5c9cc, fascia: 0xe9ebec, accent: 0x2b2b2b, floor: 0xd9d6cf, screen: 0xd8703a }, // [T] foto ADB
  putih: { wall: 0xf3f1ec, trim: 0xdedcd6, plinth: 0x9a9da0, column: 0xfbfaf7, roof: 0x55595e, fascia: 0x4b4f54, accent: 0x50433a, floor: 0xd2cdc2 }, // [T] Rektorat putih, parapet gelap
  kayu: { wall: 0x8b5d3b, trim: 0x6f4a2e, plinth: 0x7d7468, column: 0x6a4329, roof: 0x7f909d, fascia: 0x6f4a2e, accent: 0x5a3a24, floor: 0x9a7350 }, // [T] building:walls=wood
  'beton-mentah': { wall: 0xa9a59c, trim: 0x9e9a91, plinth: 0x8a857c, column: 0xa3a097, roof: 0x7d8790, fascia: 0x8f8b83, accent: 0x5b5148, floor: 0x9b958a }, // [T] mangkrak
  rusun: { wall: 0xece7dc, trim: 0xd9d3c6, plinth: 0x8f9396, column: 0xf4f0e8, roof: 0x5f6469, fascia: 0xd9d3c6, accent: 0x5f4532, floor: 0xc9c2b4 }, // [INF] warna
});

/** Varian yang sah per arketipe (override `variant`). Elemen pertama = default. */
export const VARIANTS = deepFreeze({
  K03: ['segitiga', 'vertikal', 'wajik'],   // [T] motif layar: IC segitiga, IL vertikal, HSC wajik
  K06: ['limas-tumpang', 'kubah-kecil'],
  K07: ['kantin', 'parkir'],                // 'parkir': gudang beratap berkolom tanpa dinding (nama OSM "Area Parkir …")
  K10: ['rangka', 'beratap'],               // 'beratap': atap terpasang, dinding belum selesai (FH Panam [T])
  K11: ['gudang', 'pos', 'toilet'],
});

const K = (o) => o;

/**
 * Parameter default arketipe. floorH = tinggi lantai dasar, upperH = lantai atas, bay = target lebar bay,
 * corridor = selasar {side default, depth}, roof = {type, pitch°, overhang m}, plinth = tinggi pita plint,
 * window = sel atlas jendela utama, roster = roster di atas jendela, acChance = peluang AC luar per bay
 * belakang, doors = pola pintu, ornaments = id ornamen LOD0, signStyle = gaya papan nama.
 */
export const ARCHETYPES = deepFreeze({
  K01: K({ id: 'K01', name: 'kuliah-koridor', levels: 1, maxLevels: 4, floorH: 3.8, upperH: 3.6, bay: 3.6, corridor: { side: 'jalan', depth: 2.4 }, roof: { type: 'pelana', pitch: 25, overhang: 1.0 }, plinth: 0.6, palette: 'krem-seng', window: 'nako', windowAlt: 'jalusi-kayu', roster: true, acChance: 0.12, doors: 'kelas', ornaments: ['talang', 'pipa-turun', 'lampu-selasar'], signStyle: 'timbul' }),
  K02: K({ id: 'K02', name: 'dekanat', levels: 2, maxLevels: 4, floorH: 3.8, upperH: 3.6, bay: 3.6, corridor: { side: 'jalan', depth: 2.4 }, roof: { type: 'limas', pitch: 25, overhang: 1.0 }, plinth: 0.6, palette: 'krem-seng', window: 'nako', windowAlt: 'kaca-biru', roster: true, acChance: 0.35, doors: 'kelas', ornaments: ['teras-kanopi', 'tangga-tengah', 'tiang-bendera', 'pot', 'talang', 'pipa-turun', 'lampu-selasar'], signStyle: 'timbul' }),
  K03: K({ id: 'K03', name: 'adb-layar', levels: 3, maxLevels: 5, floorH: 4.2, upperH: 4.2, bay: 4.2, corridor: { side: 'jalan', depth: 2.8 }, roof: { type: 'pelana-lebar', pitch: 15, overhang: 2.5 }, plinth: 0.45, palette: 'adb', window: 'kaca-biru', windowAlt: 'kaca-biru', roster: false, acChance: 0.25, doors: 'lobi', ornaments: ['layar', 'talang', 'lampu-selasar'], signStyle: 'panel' }),
  K04: K({ id: 'K04', name: 'lab-bengkel', levels: 1, maxLevels: 3, floorH: 5.0, upperH: 4.0, bay: 4.5, corridor: { side: 'tidak', depth: 0 }, roof: { type: 'pelana', pitch: 30, overhang: 0.8 }, plinth: 0.6, palette: 'krem-seng', window: 'jalusi-kayu', windowAlt: 'nako', roster: false, acChance: 0.08, doors: 'gulung', ornaments: ['clerestory', 'exhaust', 'talang', 'pipa-turun'], signStyle: 'timbul' }),
  K05: K({ id: 'K05', name: 'aula', levels: 1, maxLevels: 2, floorH: 7.0, upperH: 4.0, bay: 5.0, corridor: { side: 'tidak', depth: 0 }, roof: { type: 'pelana', pitch: 25, overhang: 1.0 }, plinth: 0.6, palette: 'krem-seng', window: 'nako', windowAlt: 'nako', roster: true, acChance: 0.2, doors: 'ganda', ornaments: ['kanopi-masuk', 'ventilasi-atas', 'talang', 'pipa-turun'], signStyle: 'timbul' }),
  K06: K({ id: 'K06', name: 'musala', levels: 1, maxLevels: 2, floorH: 3.6, upperH: 3.4, bay: 3.0, corridor: { side: 'keliling', depth: 2.0 }, roof: { type: 'limas-tumpang', pitch: 30, overhang: 0.8 }, plinth: 0.45, palette: 'putih-seng', window: 'nako', windowAlt: 'nako', roster: true, acChance: 0, doors: 'ganda', ornaments: ['teras-keramik', 'tempat-wudu', 'rak-sandal'], signStyle: 'timbul' }),
  K07: K({ id: 'K07', name: 'kantin', levels: 1, maxLevels: 1, floorH: 3.4, upperH: 3.4, bay: 3.0, corridor: { side: 'tidak', depth: 0 }, roof: { type: 'pelana', pitch: 15, overhang: 0.8 }, plinth: 0.3, palette: 'krem-seng', window: 'tanpa', windowAlt: 'tanpa', roster: false, acChance: 0, doors: 'terbuka', ornaments: ['etalase', 'meja-bangku', 'spanduk-menu'], signStyle: 'tidak' }),
  K08: K({ id: 'K08', name: 'pendopo-kayu', levels: 1, maxLevels: 1, floorH: 3.4, upperH: 3.4, bay: 3.0, corridor: { side: 'keliling', depth: 1.5 }, roof: { type: 'limas', pitch: 30, overhang: 1.0 }, plinth: 0.5, palette: 'kayu', window: 'jalusi-kayu', windowAlt: 'jalusi-kayu', roster: false, acChance: 0, doors: 'ganda', ornaments: ['panggung', 'tangga-tengah'], signStyle: 'timbul' }),
  K09: K({ id: 'K09', name: 'rusun', levels: 5, maxLevels: 8, floorH: 3.0, upperH: 3.0, bay: 3.6, corridor: { side: 'jalan', depth: 1.8 }, roof: { type: 'datar-parapet', pitch: 0, overhang: 0.3 }, plinth: 0.45, palette: 'rusun', window: 'nako', windowAlt: 'nako', roster: true, acChance: 0.3, doors: 'unit', ornaments: ['balkon-jemuran', 'tangga-ujung', 'tandon'], signStyle: 'tidak' }),
  K10: K({ id: 'K10', name: 'mangkrak', levels: 2, maxLevels: 6, floorH: 3.8, upperH: 3.6, bay: 4.0, corridor: { side: 'tidak', depth: 0 }, roof: { type: 'datar', pitch: 0, overhang: 0 }, plinth: 0, palette: 'beton-mentah', window: 'tanpa', windowAlt: 'tanpa', roster: false, acChance: 0, doors: 'tanpa', ornaments: ['besi-tulangan', 'coretan', 'ilalang', 'bata-sebagian'], signStyle: 'tidak' }),
  K11: K({ id: 'K11', name: 'utilitas', levels: 1, maxLevels: 2, floorH: 3.0, upperH: 3.0, bay: 3.0, corridor: { side: 'tidak', depth: 0 }, roof: { type: 'pelana', pitch: 20, overhang: 0.5 }, plinth: 0.3, palette: 'putih-seng', window: 'nako', windowAlt: 'jalusi-alu', roster: false, acChance: 0.05, doors: 'tunggal', ornaments: ['talang'], signStyle: 'tidak' }),
  K12: K({ id: 'K12', name: 'ekstrusi-rapi', levels: 1, maxLevels: 8, floorH: 3.6, upperH: 3.5, bay: 3.2, corridor: { side: 'tidak', depth: 0 }, roof: { type: 'datar-parapet', pitch: 0, overhang: 0 }, plinth: 0.6, palette: 'krem-seng', window: 'nako', windowAlt: 'jalusi-kayu', roster: true, acChance: 0.1, doors: 'tunggal', ornaments: [], signStyle: 'timbul' }),
});

export const ARCHETYPE_IDS = Object.freeze(Object.keys(ARCHETYPES));

/** Pola roster (lubang angin) di atlas: satu per gedung (seed). */
export const ROSTER_PATTERNS = Object.freeze(['kotak', 'lingkaran', 'silang', 'bunga', 'krawangan']);

/** Hash FNV-1a 32-bit dari id OSM → seed deterministik (spec §7.2 langkah 6). */
export function hashId(id) {
  let h = 0x811c9dc5;
  const s = String(id);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Arketipe yang dipakai planBuilding untuk sebuah id (K.. atau hero:..). */
export function geometryArchetype(id) {
  return ARCHETYPES[id] ?? ARCHETYPES[HERO_STANDIN[id]] ?? ARCHETYPES.K12;
}
