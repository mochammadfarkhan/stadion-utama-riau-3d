/**
 * Data murni Sekretariat UKM "Blok Biru" (gedung L beratap biru, Jl. Prof. Aras Mulyadi) + kompleks lapangan
 * di sekitarnya. Sumber kebenaran ukuran: docs/research/sekre-ukm/sekre-ukm-blok-biru.md (diukur dari Street View
 * dan satelit, keyakinan posisi ±2 m) dan public/models/unri/h09-sekre-ukm.json (footprint & pintu GLB; tes
 * menjaga salinan angka di sini tetap sama dengan JSON). Koordinat gedung = frame GLB (origin pusat bbox, +X
 * timur, +Z selatan); koordinat region-lokal = dunia − placement region.
 */
import { toRegion, regionToWorld } from './placement.js';

const freeze = (pts) => Object.freeze(pts.map((p) => Object.freeze(p)));

/**
 * Organisasi pemain di gedung ini. User menyebut UKM-nya = ERC (kepanjangan TIDAK diketahui, jangan mengarang);
 * hanya `nama` yang dipakai papan nama pintu D5 dan isi interior.
 */
export const SEKRE_PEMAIN = Object.freeze({ nama: 'ERC' });

/** Pintu ruang pemain (kontrak aset H09): sayap utara–selatan, sisi barat, menghadap halaman. */
export const PLAYER_DOOR_ID = 'D5';

/** Pusat gedung (origin GLB) dalam koordinat dunia. */
export const UKM_WORLD = Object.freeze({ x: -99.65, z: 1014.9 });

/** Frame gedung di region-lokal (yaw 0): {x, z} = UKM_WORLD − placement region. */
export const UKM_FRAME = (() => {
  const [x, z] = toRegion(UKM_WORLD.x, UKM_WORLD.z);
  return Object.freeze({ x, z, yaw: 0 });
})();

/** Lokal-gedung → region-lokal {x, z}. */
export const fromUkm = (bx, bz) => ({ x: UKM_FRAME.x + bx, z: UKM_FRAME.z + bz });
/** Lokal-gedung → dunia {x, z}. */
export const ukmToWorld = (bx, bz) => ({ x: UKM_WORLD.x + bx, z: UKM_WORLD.z + bz });

/** Footprint dinding (lokal-gedung), salinan wallsFootprintLocal JSON. */
export const UKM_WALLS = freeze([[-17.35, 4.2], [6.15, 4.2], [6.15, -15.2], [17.35, -15.2], [17.35, 15.2], [-17.35, 15.2]]);
/** Tepi atap termasuk tritisan (lokal-gedung), salinan roofOutlineLocal JSON. */
export const UKM_ROOF = freeze([[-18.25, 3.3], [5.25, 3.3], [5.25, -16.1], [18.25, -16.1], [18.25, 16.1], [-18.25, 16.1]]);

/** Anchor papan nama: pintu (lokal-gedung), normal keluar [nx, nz], sign {x, y, z}. Salinan `doors` JSON (tanpa B1). */
export const UKM_DOORS = Object.freeze([
  { id: 'D1', x: -15.392, z: 4.05, normal: [0, -1], sign: { x: -15.392, y: 3.07, z: 4.11 } },
  { id: 'D2', x: -7.558, z: 4.05, normal: [0, -1], sign: { x: -7.558, y: 3.07, z: 4.11 } },
  { id: 'D3', x: 0.275, z: 4.05, normal: [0, -1], sign: { x: 0.275, y: 3.07, z: 4.11 } },
  { id: 'D4', x: 6.0, z: -1.62, normal: [-1, 0], sign: { x: 6.06, y: 3.07, z: -1.62 } },
  { id: 'D5', x: 6.0, z: -9.38, normal: [-1, 0], sign: { x: 6.06, y: 3.07, z: -9.38 } },
].map((d) => Object.freeze({ ...d, normal: Object.freeze(d.normal), sign: Object.freeze(d.sign) })));

/** Label papan nama per pintu. D1/D2/D5 = label Google Maps; D3 & D4 = ruang biasa tak berlabel (generik). */
export const UKM_LABELS = Object.freeze({
  D1: 'KSR PMI', D2: 'KOPMA UNRI', D3: 'SEKRETARIAT', D4: 'SEKRETARIAT', D5: SEKRE_PEMAIN.nama,
});

/** Warna papan per label (latar, teks). */
export const UKM_SIGN_STYLE = Object.freeze({
  'KSR PMI': Object.freeze({ latar: 0xb3121f, teks: 0xffffff }),
  'KOPMA UNRI': Object.freeze({ latar: 0x1f6f43, teks: 0xffffff }),
  SEKRETARIAT: Object.freeze({ latar: 0x24488f, teks: 0xffffff }),
  ERC: Object.freeze({ latar: 0x0d3b66, teks: 0xf2c200 }),
});
const DEFAULT_STYLE = UKM_SIGN_STYLE.SEKRETARIAT;
export const signStyle = (label) => UKM_SIGN_STYLE[label] ?? DEFAULT_STYLE;

/** Daftar papan nama [{id, label, latar, teks, ...anchor}] dari pintu + label. */
export function ukmSigns(doors = UKM_DOORS, labels = UKM_LABELS) {
  return doors.map((d) => Object.freeze({ id: d.id, label: labels[d.id], normal: d.normal, ...d.sign, ...signStyle(labels[d.id]) }));
}

/** Daftar galat (kosong = valid): id unik, label tak kosong, pintu pemain ada, hanya satu label pemain. */
export function validateUkmData({ doors = UKM_DOORS, labels = UKM_LABELS, pemain = SEKRE_PEMAIN, playerDoor = PLAYER_DOOR_ID } = {}) {
  const errs = [];
  const ids = doors.map((d) => d.id);
  if (new Set(ids).size !== ids.length) errs.push('id pintu tidak unik');
  for (const d of doors) {
    const label = labels[d.id];
    if (typeof label !== 'string' || label.trim() === '') errs.push(`pintu ${d.id}: label kosong`);
    else if (label !== label.toUpperCase()) errs.push(`pintu ${d.id}: label harus kapital`);
  }
  if (!ids.includes(playerDoor)) errs.push(`pintu pemain ${playerDoor} tidak ada`);
  else if (labels[playerDoor] !== pemain?.nama) errs.push(`label pintu pemain ${playerDoor} harus sama dengan nama organisasi pemain`);
  if (typeof pemain?.nama !== 'string' || pemain.nama.trim() === '') errs.push('nama organisasi pemain kosong');
  return errs;
}

// ---------------------------------------------------------------------------------------------------------------
// Kompleks lapangan, halaman, gubuk panahan (DUNIA; dokumen §3.2–3.3). Hanya parameter; geometri dari generator.
// ---------------------------------------------------------------------------------------------------------------

/** Warna permukaan & run-off (dokumen: voli biru-lavender, basket biru muda, tenis hijau, run-off oranye-bata). */
export const COURT_COLORS = Object.freeze({
  runoff: '#B85A3C', voli: '#7C93D1', basket: '#8DA3DD', tenis: '#3E8E5A', garis: '#F4F4EE',
});

/** Lapangan: pusat dunia, permukaan berwarna (lebar × panjang), dengan run-off (lebar × panjang). Sumbu panjang = Z. */
export const COURTS = Object.freeze([
  { id: 'voli', kind: 'voli', x: -112.1, z: 945.4, surface: { w: 10.1, l: 18.5 }, outer: { w: 13.8, l: 27 } },
  { id: 'basket', kind: 'basket', x: -86.4, z: 939.0, surface: { w: 17.2, l: 28.7 }, outer: { w: 20.4, l: 32.5 } },
  { id: 'tenis', kind: 'tenis', x: -59.5, z: 935.5, surface: { w: 11.8, l: 24.3 }, outer: { w: 20, l: 37 } },
].map((c) => Object.freeze({ ...c, surface: Object.freeze(c.surface), outer: Object.freeze(c.outer) })));

/** Kotak luar kompleks (jalur hijau + palem). */
export const COMPLEX_BOX = Object.freeze({ minX: -122.4, maxX: -49.2, minZ: 915.1, maxZ: 960.6 });

/** Halaman beton di sisi dalam L + apron di depan sayap (dunia). */
export const YARD_BOX = Object.freeze({ minX: -119.2, maxX: -99.2, minZ: 998.2, maxZ: 1011.5 });
export const APRON_WIDTH = 3.5;

/** Gubuk panahan (dunia): atap merah memanjang N–S + lapangan rumput di timurnya. */
export const ARCHERY = Object.freeze({
  hut: Object.freeze({ minX: -116.6, maxX: -109.9, minZ: 969.6, maxZ: 995.4 }),
  field: Object.freeze({ minX: -107, maxX: -62, minZ: 968, maxZ: 998 }),
});

/** Dunia → region-lokal untuk kotak. */
export function boxToRegion(b) {
  const [minX, minZ] = toRegion(b.minX, b.minZ);
  const [maxX, maxZ] = toRegion(b.maxX, b.maxZ);
  return Object.freeze({ minX, minZ, maxX, maxZ });
}

/** Cincin persegi region-lokal dari kotak dunia (searah jarum jam, tanpa titik penutup). */
export const boxRing = (b, margin = 0) => {
  const r = boxToRegion(b);
  return freeze([[r.minX - margin, r.minZ - margin], [r.maxX + margin, r.minZ - margin], [r.maxX + margin, r.maxZ + margin], [r.minX - margin, r.maxZ + margin]]);
};

export { regionToWorld };
