/**
 * Daftar set tekstur PBR (ambientCG, CC0) + fungsi murni pipeline (dites): rencana ukuran, pak ORM, validasi manifest.
 * Tanpa sharp/IO di sini agar bisa dites tanpa berkas.
 */
export const SOURCE = Object.freeze({
  name: 'ambientCG',
  url: 'https://ambientcg.com',
  license: 'CC0-1.0',
  licenseUrl: 'https://docs.ambientcg.com/license/',
});

/** name = nama set runtime, id = ID ambientCG, tileM = sisi satu tile dalam meter nyata (diisi/diperiksa dari API dimensionX). */
export const SETS = Object.freeze([
  { name: 'grass', id: 'Grass004', category: 'rumput', tileM: 1.4 },
  { name: 'soilMoist', id: 'Ground048', category: 'tanah-lembap', tileM: 1.4 },
  { name: 'soilDry', id: 'Ground054', category: 'tanah-kering', tileM: 3.5 },
  { name: 'gravel', id: 'Gravel023', category: 'kerikil', tileM: 1.5 },
  { name: 'moss', id: 'Moss002', category: 'lumut', tileM: 1.5 },
  { name: 'plaster', id: 'Plaster001', category: 'plester', tileM: 2, big: true },
  { name: 'concrete', id: 'Concrete034', category: 'beton', tileM: 2.2 },
  { name: 'paving', id: 'PavingStones070', category: 'paving', tileM: 1.15 },
  { name: 'asphalt', id: 'Asphalt031', category: 'aspal', tileM: 2.5 },
  { name: 'roofSteel', id: 'CorrugatedSteel005', category: 'atap-seng', tileM: 1.2, big: true },
  { name: 'wood', id: 'Planks021', category: 'kayu', tileM: 1.4, big: true },
  { name: 'tile', id: 'Tiles074', category: 'ubin', tileM: 2.1 },
  { name: 'bark', id: 'Bark001', category: 'kulit-pohon', tileM: 1, big: true },
]);

export const TIER_SIZES = Object.freeze([512, 256]);
export const BIG_SIZE = 1024;
export const MAP_KINDS = Object.freeze(['albedo', 'normal', 'orm']);

/** Ukuran keluaran untuk satu set: 512 & 256, ditambah 1024 hanya bila set.big. Urut menurun. */
export function resizePlan(set) {
  return set.big ? [BIG_SIZE, ...TIER_SIZES] : [...TIER_SIZES];
}

/** Path relatif (terhadap public/textures) satu peta. */
export const mapPath = (name, kind, size) => `${name}/${kind}.${size}.webp`;

/**
 * Pak ORM: R = AO, G = Roughness, B = 0. Masukan gray 1 kanal (Uint8, panjang sama); AO null -> 255 (tanpa oklusi);
 * roughness null -> 200. Keluaran RGB berlapis (3 byte/piksel).
 */
export function packOrm(ao, rough, pixels) {
  const out = new Uint8Array(pixels * 3);
  for (let i = 0; i < pixels; i += 1) {
    out[i * 3] = ao ? ao[i] : 255;
    out[i * 3 + 1] = rough ? rough[i] : 200;
    out[i * 3 + 2] = 0;
  }
  return out;
}

/** Warna rata-rata sRGB (#rrggbb) dari piksel RGB 3 byte/piksel. */
export function averageColor(rgb) {
  let r = 0;
  let g = 0;
  let b = 0;
  const n = Math.floor(rgb.length / 3);
  for (let i = 0; i < n; i += 1) {
    r += rgb[i * 3];
    g += rgb[i * 3 + 1];
    b += rgb[i * 3 + 2];
  }
  const h = (v) => Math.round(v / Math.max(1, n)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Cari berkas peta dalam daftar nama zip (huruf besar/kecil diabaikan); null bila tak ada. */
export function pickMapFile(files, kind) {
  const want = { color: /_color\.(jpg|png)$/i, normal: /_normalgl\.(jpg|png)$/i, rough: /_roughness\.(jpg|png)$/i, ao: /_ambientocclusion\.(jpg|png)$/i }[kind];
  return files.find((f) => want.test(f)) ?? null;
}

/** Validasi manifest; kembalikan daftar galat (kosong = valid). */
export function validateManifest(m) {
  const errs = [];
  if (!m || m.v !== 1) errs.push('v harus 1');
  if (!m?.source?.license) errs.push('source.license kosong');
  if (!Array.isArray(m?.sets) || m.sets.length === 0) { errs.push('sets kosong'); return errs; }
  const seen = new Set();
  for (const s of m.sets) {
    if (!s.name || seen.has(s.name)) errs.push(`nama set ganda/kosong: ${s.name}`);
    seen.add(s.name);
    if (!/^#[0-9a-f]{6}$/i.test(s.avg ?? '')) errs.push(`${s.name}: avg bukan #rrggbb`);
    if (!(s.tileM > 0)) errs.push(`${s.name}: tileM harus > 0`);
    if (!s.sourceId) errs.push(`${s.name}: sourceId kosong`);
    if (s.license !== 'CC0-1.0') errs.push(`${s.name}: lisensi harus CC0-1.0`);
    if (!Array.isArray(s.sizes) || !s.sizes.includes(512) || !s.sizes.includes(256)) errs.push(`${s.name}: sizes harus memuat 512 dan 256`);
  }
  return errs;
}
