import { SETTINGS_SCHEMA, coerceValue, defaultSettings, listFields } from './schema.js';

export const STORAGE_KEY = 'sur3d.settings.v1';

/**
 * Store settings immutable: state = objek datar beku {"grup.field": nilai}.
 * - set(key, value) memvalidasi lewat skema, mengganti state dengan salinan baru,
 *   lalu memberi tahu subscriber (per-key dan global).
 * - Persist opsional ke storage mirip localStorage (bisa null di Node/test).
 */
export function createSettingsStore({ schema = SETTINGS_SCHEMA, storage = null, initial = null } = {}) {
  const fields = new Map(listFields(schema));
  const defaults = defaultSettings(schema);
  let state = Object.freeze({ ...defaults, ...sanitize(initial ?? load(storage), fields) });
  const listeners = new Map(); // key → Set<fn>; '*' = semua
  let saveTimer = null;

  const notify = (key, value, prev) => {
    listeners.get(key)?.forEach((fn) => fn(value, prev, key));
    listeners.get('*')?.forEach((fn) => fn(value, prev, key));
  };

  const scheduleSave = () => {
    if (!storage) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(storage, state, defaults), 150);
  };

  return {
    get state() { return state; },
    get(key) { return state[key]; },
    field(key) { return fields.get(key); },
    set(key, value) {
      const field = fields.get(key);
      if (!field) return false;
      const next = coerceValue(field, value);
      if (Object.is(next, state[key])) return false;
      const prev = state[key];
      state = Object.freeze({ ...state, [key]: next });
      notify(key, next, prev);
      scheduleSave();
      return true;
    },
    reset(prefix = '') {
      for (const [key, def] of Object.entries(defaults)) {
        if (key.startsWith(prefix)) this.set(key, def);
      }
    },
    subscribe(key, fn) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(fn);
      return () => listeners.get(key)?.delete(fn);
    },
    /** Kirim nilai saat ini ke fn lalu tetap berlangganan (praktis untuk binding awal). */
    bind(key, fn) {
      fn(state[key], undefined, key);
      return this.subscribe(key, fn);
    },
    flush() {
      clearTimeout(saveTimer);
      if (storage) save(storage, state, defaults);
    },
    export() { return JSON.stringify(diff(state, defaults)); },
    import(json) {
      let parsed;
      try { parsed = JSON.parse(json); } catch { return false; }
      if (!parsed || typeof parsed !== 'object') return false;
      for (const [k, v] of Object.entries(parsed)) this.set(k, v);
      return true;
    },
  };
}

function sanitize(obj, fields) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const field = fields.get(k);
    if (field) out[k] = coerceValue(field, v);
  }
  return out;
}

function load(storage) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {}; // storage rusak/penuh: abaikan, pakai default
  }
}

/** Simpan hanya nilai yang berbeda dari default agar perubahan default di versi baru tetap berlaku. */
function save(storage, state, defaults) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(diff(state, defaults)));
  } catch {
    // kuota penuh / mode privat: tidak fatal
  }
}

function diff(state, defaults) {
  const out = {};
  for (const [k, v] of Object.entries(state)) if (!Object.is(v, defaults[k])) out[k] = v;
  return out;
}
