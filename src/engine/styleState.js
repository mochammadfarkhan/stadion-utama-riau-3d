/**
 * Keadaan gaya grafis bersama (pub/sub kecil, tanpa three): gaya, faktor LOD, faktor tile, pengali kepadatan, batas pixel ratio.
 * Konsumen LOD membaca `styleState.lod` tiap evaluasi; styleManager menulis saat gaya/kamera berubah.
 */
const state = { style: 'asli', angled: false, lod: 1, tileLoad: 1, tileLod0: 1, density: 1, pixelCap: Infinity, terrainQuality: 'tinggi', leafCards: false };
const listeners = new Set();

export const styleState = state;

/** Terapkan perubahan (objek sebagian); mengembalikan true bila ada yang berubah. */
export function setStyleState(patch) {
  let changed = false;
  for (const [k, v] of Object.entries(patch)) {
    if (k in state && state[k] !== v) { state[k] = v; changed = true; }
  }
  if (changed) listeners.forEach((fn) => fn(state));
  return changed;
}

export function onStyleState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Faktor turunan murni dari gaya + mode kamera (dites). */
export function deriveStyleFactors(style, angled, sv) {
  const saving = angled && style !== 'asli';
  return {
    lod: saving ? sv.lodScale : 1,
    tileLoad: saving ? sv.tileLoadScale : 1,
    tileLod0: saving ? sv.tileLod0Scale : 1,
    density: saving ? sv.densityScale : 1,
    pixelCap: style !== 'asli' ? sv.pixelRatioCap : Infinity,
  };
}
