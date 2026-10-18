/**
 * Format public/districts/unri/buildings.json (indeks M3): { v:1, buildings:[{ id, ring, levels, tags, cluster,
 * area, front, holes? }] }. Sumber tunggal konstanta format untuk tools/campusbake/buildings.js dan klien
 * distrik (validasi saat muat). Murni (tanpa three).
 */
export const BUILDINGS_FORMAT = Object.freeze({ v: 1, cluster: 250, quant: 0.1, frontMax: 80, maxBuildings: 2000 });

const ID_RE = /^[wr]\d+$/;
const KEY_RE = /^-?\d+_-?\d+$/;

/** Kunci klaster 250 m dari titik dunia, mis. "-5_4". */
export function clusterKey(x, z, size = BUILDINGS_FORMAT.cluster) {
  return `${Math.floor(x / size)}_${Math.floor(z / size)}`;
}

const isRing = (r) => Array.isArray(r) && r.length >= 3 && r.every((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));

/** Galat satu entri gedung (kosong = valid). */
export function buildingErrors(b, i) {
  const at = `buildings[${i}]${b?.id ? ` (${b.id})` : ''}`;
  if (!b || typeof b !== 'object') return [`${at}: bukan objek`];
  const errs = [];
  if (!ID_RE.test(b.id ?? '')) errs.push(`${at}: id harus "w<angka>"/"r<angka>"`);
  if (!isRing(b.ring)) errs.push(`${at}: ring harus ≥ 3 titik [x,z] berhingga`);
  if (b.levels !== null && !(Number.isInteger(b.levels) && b.levels >= 1 && b.levels <= 60)) errs.push(`${at}: levels harus null atau 1–60`);
  if (!b.tags || typeof b.tags !== 'object') errs.push(`${at}: tags wajib objek`);
  if (!KEY_RE.test(b.cluster ?? '')) errs.push(`${at}: cluster harus "cx_cz"`);
  if (!(b.area > 0)) errs.push(`${at}: area harus > 0`);
  if (b.front !== null && !(Array.isArray(b.front) && b.front.length === 2 && b.front.every(Number.isFinite))) errs.push(`${at}: front harus null atau [fx,fz]`);
  if (b.holes !== undefined && !(Array.isArray(b.holes) && b.holes.every(isRing))) errs.push(`${at}: holes harus array ring`);
  return errs;
}

/**
 * Validasi berkas buildings.json; [] = valid. Galat pertama per gedung saja agar laporan ringkas.
 * @returns {string[]}
 */
export function validateBuildingsData(json) {
  if (!json || typeof json !== 'object') return ['buildings.json: bukan objek'];
  if (json.v !== BUILDINGS_FORMAT.v) return [`buildings.json: versi ${json.v} tidak didukung (harus ${BUILDINGS_FORMAT.v})`];
  if (!Array.isArray(json.buildings)) return ['buildings.json: buildings harus array'];
  if (json.buildings.length > BUILDINGS_FORMAT.maxBuildings) return [`buildings.json: > ${BUILDINGS_FORMAT.maxBuildings} gedung`];
  const errs = [];
  const seen = new Set();
  json.buildings.forEach((b, i) => {
    const e = buildingErrors(b, i);
    if (e.length) errs.push(e[0]);
    if (seen.has(b?.id)) errs.push(`buildings[${i}]: id ganda ${b.id}`);
    seen.add(b?.id);
  });
  return errs;
}
