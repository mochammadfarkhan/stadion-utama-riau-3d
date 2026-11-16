/**
 * Palet tile kota di KLIEN (arah seni 2026-11-16): warna vertex tile (COLOR_0, linear, Uint8 ternormalisasi) dipanggang dari
 * palet tetap di `tools/citybake/config.js` — tiap warna lama berupa byte PERSIS. Saat tile dimuat, byte lama ditukar ke
 * palet baru (dinding hangat warna-warni, atap genteng oranye/terakota, permukiman hijau keabuan) tanpa bake ulang 157 tile.
 * BAKED_* = salinan palet bake (dites sama dengan config bake); ubah NEW_* untuk mengganti gaya. Murni kecuali `remapTileColors`.
 */

/** Salinan palet bake (sRGB). Harus sama dengan tools/citybake/config.js (dites). */
export const BAKED = Object.freeze({
  walls: Object.freeze(['#e8e2d6', '#ddd5c5', '#f0ece4', '#d8cbb5', '#c9c4bb', '#e6d7c3', '#bfc7cc', '#efe6d2']),
  roofFlat: Object.freeze(['#9a9a96', '#8c8a85', '#a8a49c', '#7f8286']),
  roofGable: Object.freeze(['#a5452f', '#8e3b2a', '#b5573a', '#6d5f57']),
  landuse: Object.freeze({ residential: '#c9c2b3', commercial: '#d4b8b0', retail: '#d9b3a8', education: '#d8cfa0', religious: '#cfc4a8' }),
});

/** Palet baru, indeks sejajar BAKED. [INFERENSI] warna ruko/rumah Pekanbaru: cat pastel hangat, genteng & seng. */
export const NEW = Object.freeze({
  walls: Object.freeze(['#f1e2c0', '#efc98f', '#e7ae8c', '#c9dde6', '#d3e2bd', '#f6f2e8', '#e8c49a', '#c7cdd4']),
  roofFlat: Object.freeze(['#c0633b', '#a54d36', '#cf7a4a', '#9a9893']), // terakota, merah bata, terakota muda, beton (oranye dominan seperti target)
  roofGable: Object.freeze(['#cf6d3f', '#bb5232', '#d98a4a', '#a8623f']), // genteng: sisi teduh tetap terbaca oranye, bukan hitam
  landuse: Object.freeze({ residential: '#b4b896', commercial: '#c8bea6', retail: '#cdbca2', education: '#c6c79a', religious: '#c3c39f' }),
});

/** Faktor gelap kaki dinding di bake (`buildings.js` BASE_SHADE). */
export const BAKED_WALL_SHADE = 0.82;

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** '#rrggbb' → [r,g,b] linear 0..1 (sama dengan colors.js bake). */
export function hexToLinear(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new TypeError(`warna tidak valid: ${hex}`);
  return [1, 2, 3].map((i) => srgbToLinear(parseInt(m[i], 16) / 255));
}

/** Linear 0..1 × faktor → byte Uint8 ternormalisasi (pembulatan seperti kuantisasi GLB). */
export const toBytes = (rgb, k = 1) => rgb.map((c) => Math.round(Math.min(1, Math.max(0, c * k)) * 255));
const key = (b) => (b[0] << 16) | (b[1] << 8) | b[2];

/** Tabel byte lama → byte baru per nama mesh tile. @returns {Map<string, Map<number, number[]>>} */
export function buildTileRemap(baked = BAKED, next = NEW) {
  const table = (pairs) => new Map(pairs.map(([a, b]) => [key(a), b]));
  const pair = (oldHex, newHex, k = 1) => [toBytes(hexToLinear(oldHex), k), toBytes(hexToLinear(newHex), k)];
  const walls = baked.walls.flatMap((h, i) => [pair(h, next.walls[i]), pair(h, next.walls[i], BAKED_WALL_SHADE)]);
  const roofs = [...baked.roofFlat.map((h, i) => pair(h, next.roofFlat[i])), ...baked.roofGable.map((h, i) => pair(h, next.roofGable[i]))];
  const landuse = Object.keys(baked.landuse).map((k) => pair(baked.landuse[k], next.landuse[k]));
  return new Map([['buildings_walls', table(walls)], ['buildings_roofs', table(roofs)], ['landuse', table(landuse)]]);
}

let shared = null;
/** Tabel bersama (dibuat sekali). */
export const tileRemap = () => (shared ??= buildTileRemap());

/**
 * Tukar warna vertex satu geometri tile di tempat. Atribut Uint8 ternormalisasi (byte) atau float (0..1) didukung.
 * @returns {number} jumlah vertex yang diganti
 */
export function remapTileColors(geometry, table) {
  const attr = geometry?.attributes?.color;
  if (!attr || !table) return 0;
  // Lewat API atribut (bukan array mentah): COLOR_0 GLB bisa berselang/ber-stride 4 byte (InterleavedBufferAttribute) dan
  // ternormalisasi — getX/setXYZ menangani stride, offset, dan (de)normalisasi. Langkah array mentah per 3 merusak warna.
  const byte = (v) => Math.round(v * 255);
  let n = 0;
  for (let i = 0; i < attr.count; i += 1) {
    const b = table.get(key([byte(attr.getX(i)), byte(attr.getY(i)), byte(attr.getZ(i))]));
    if (!b) continue;
    attr.setXYZ(i, b[0] / 255, b[1] / 255, b[2] / 255);
    n += 1;
  }
  if (n) {
    if (attr.isInterleavedBufferAttribute) attr.data.needsUpdate = true;
    else attr.needsUpdate = true;
  }
  return n;
}
