/**
 * Simpan/muat progres cerita di localStorage (kunci berversi). Data dari storage
 * tidak dipercaya: dibersihkan terhadap batas chapter/langkah dan id yang dikenal.
 */
export const STORY_KEY = 'sur3d.story.v1';
const VERSION = 1;

const int = (v, min, max) => (Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : min);
const strings = (a, allowed) => (Array.isArray(a)
  ? a.filter((x) => typeof x === 'string' && (!allowed || allowed.includes(x))) : []);

/** @param {{chapters:number, steps:number[], eggIds:string[]}} limits */
export function sanitizeSave(raw, limits) {
  if (!raw || typeof raw !== 'object' || raw.version !== VERSION) return null;
  const chapter = int(raw.chapter, 0, limits.chapters - 1);
  const stepMax = Math.max(0, (limits.steps[chapter] ?? 1) - 1);
  return {
    version: VERSION,
    chapter,
    step: int(raw.step, 0, stepMax),
    badges: strings(raw.badges),
    eggs: strings(raw.eggs, limits.eggIds),
    bestLap: Number.isFinite(raw.bestLap) && raw.bestLap > 0 ? raw.bestLap : null,
    rupiah: Number.isFinite(raw.rupiah) && raw.rupiah > 0 ? Math.floor(raw.rupiah) : 0,
    finished: raw.finished === true,
  };
}

export function loadStory(storage, limits) {
  try {
    const text = storage.getItem(STORY_KEY);
    return text ? sanitizeSave(JSON.parse(text), limits) : null;
  } catch {
    return null;
  }
}

export function saveStory(storage, save) {
  try {
    storage.setItem(STORY_KEY, JSON.stringify(save));
  } catch {
    // storage penuh/diblokir: progres hanya di memori
  }
}
