/**
 * Simpan/muat progres cerita di localStorage (kunci tetap; versi di dalam data). Data dari storage
 * tidak dipercaya: dibersihkan terhadap batas chapter/langkah, id yang dikenal, dan dompet yang sah.
 * v2 menyimpan dompet {balance, items}; v1 (tanpa dompet) dimigrasi sekali. Data rusak atau versi tak
 * dikenal dicadangkan ke STORY_BACKUP_KEY sebelum mulai baru (tidak dibuang diam-diam).
 */
export const STORY_KEY = 'sur3d.story.v1';
export const STORY_BACKUP_KEY = `${STORY_KEY}.bak`;
export const SAVE_VERSION = 2;

const int = (v, min, max) => (Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : min);
const strings = (a, allowed) => (Array.isArray(a)
  ? a.filter((x) => typeof x === 'string' && (!allowed || allowed.includes(x))) : []);
const nonNegInt = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Item dompet sah: id string (dan dikenal bila itemIds ada); nama/jenis string; harga ≥ 0. */
function sanitizeItems(items, itemIds) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i) => i && typeof i === 'object' && typeof i.id === 'string' && (!itemIds || itemIds.includes(i.id)))
    .map((i) => ({
      id: i.id,
      name: typeof i.name === 'string' ? i.name : i.id,
      kind: typeof i.kind === 'string' ? i.kind : '',
      price: nonNegInt(i.price),
    }));
}

/** @returns {{balance:number, items:object[]}|null} */
export function sanitizeWallet(raw, itemIds) {
  if (!raw || typeof raw !== 'object') return null;
  return { balance: nonNegInt(raw.balance), items: sanitizeItems(raw.items, itemIds) };
}

/** Field progres yang sama di v1 & v2. */
function sanitizeProgress(raw, limits) {
  const chapter = int(raw.chapter, 0, limits.chapters - 1);
  const stepMax = Math.max(0, (limits.steps[chapter] ?? 1) - 1);
  return {
    chapter,
    step: int(raw.step, 0, stepMax),
    badges: strings(raw.badges),
    eggs: strings(raw.eggs, limits.eggIds),
    bestLap: Number.isFinite(raw.bestLap) && raw.bestLap > 0 ? raw.bestLap : null,
    rupiah: nonNegInt(raw.rupiah),
    finished: raw.finished === true,
  };
}

/** v1 → v2: hadiah (rupiah) dikreditkan SEKALI ke saldo awal; belanjaan v1 memang tidak pernah tersimpan. */
export function migrateV1(raw, limits) {
  const progress = sanitizeProgress(raw, limits);
  return { version: SAVE_VERSION, ...progress, wallet: { balance: nonNegInt(limits.startBalance) + progress.rupiah, items: [] } };
}

/**
 * @param {{chapters:number, steps:number[], eggIds:string[], startBalance?:number, itemIds?:string[]}} limits
 * @returns {object|null} save v2 tersanitasi; null bila bukan save yang dikenali
 */
export function sanitizeSave(raw, limits) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version === 1) return migrateV1(raw, limits);
  if (raw.version !== SAVE_VERSION) return null;
  const wallet = sanitizeWallet(raw.wallet, limits.itemIds);
  return wallet ? { version: SAVE_VERSION, ...sanitizeProgress(raw, limits), wallet } : null;
}

function backup(storage, text) {
  try {
    storage.setItem(STORY_BACKUP_KEY, text);
  } catch {
    // storage penuh/diblokir: tetap mulai baru
  }
}

export function loadStory(storage, limits) {
  let text;
  try {
    text = storage.getItem(STORY_KEY);
  } catch {
    return null;
  }
  if (!text) return null;
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    backup(storage, text);
    return null;
  }
  const save = sanitizeSave(raw, limits);
  if (!save) backup(storage, text);
  return save;
}

export function saveStory(storage, save) {
  try {
    storage.setItem(STORY_KEY, JSON.stringify(save));
  } catch {
    // storage penuh/diblokir: progres hanya di memori
  }
}
