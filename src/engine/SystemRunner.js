/**
 * SystemRunner: menjalankan sistem per frame dalam fase eksplisit input → sim → world → camera → ui.
 * Di dalam satu fase, urutan = urutan pendaftaran. Satu sistem yang melempar galat tidak menghentikan
 * sistem lain; setelah MAX_CONSECUTIVE_FAILURES galat beruntun sistem dinonaktifkan dan id-nya dicatat.
 * remove(id) memanggil dispose() sistem (kecuali {dispose:false}); sistem yang dicabut di tengah frame
 * tidak dijalankan lagi pada frame itu. dispose() melepas semua sistem terbalik dari urutan pendaftaran
 * (LIFO). Lapisan engine: tanpa impor three/world/ui.
 */
export const PHASES = Object.freeze(['input', 'sim', 'world', 'camera', 'ui']);
export const MAX_CONSECUTIVE_FAILURES = 3;

const PHASE_INDEX = new Map(PHASES.map((p, i) => [p, i]));

/**
 * @typedef {{id:string, phase:'input'|'sim'|'world'|'camera'|'ui', update(dt:number, ctx:object):void, dispose?():void}} System
 */

function assertSystem(system) {
  if (!system || typeof system.id !== 'string' || system.id === '') throw new TypeError('SystemRunner: sistem butuh id string');
  if (!PHASE_INDEX.has(system.phase)) throw new TypeError(`SystemRunner: fase "${system.phase}" (sistem "${system.id}") tidak dikenal`);
  if (typeof system.update !== 'function') throw new TypeError(`SystemRunner: sistem "${system.id}" butuh update(dt, ctx)`);
}

/**
 * @param {{logger?: {error: (...args: unknown[]) => void}}} [opts]
 */
export function createSystemRunner({ logger = console } = {}) {
  let entries = []; // { system, failures, seq, removed } terurut fase lalu pendaftaran
  const disabled = [];
  let seq = 0;

  const insert = (entry) => {
    const idx = PHASE_INDEX.get(entry.system.phase);
    const at = entries.findIndex((e) => PHASE_INDEX.get(e.system.phase) > idx);
    entries = at < 0 ? [...entries, entry] : [...entries.slice(0, at), entry, ...entries.slice(at)];
  };

  const disposeSystem = (system) => {
    try {
      system.dispose?.();
    } catch (err) {
      logger.error(`Sistem "${system.id}" gagal di-dispose:`, err);
    }
  };

  const fail = (entry, err) => {
    entry.failures += 1;
    const { id } = entry.system;
    if (entry.failures >= MAX_CONSECUTIVE_FAILURES) {
      logger.error(`Sistem "${id}" dinonaktifkan setelah ${entry.failures} galat beruntun:`, err);
      entry.removed = true;
      entries = entries.filter((e) => e !== entry);
      disabled.push(id);
    } else if (entry.failures === 1) {
      logger.error(`Sistem "${id}" galat (dicoba lagi pada frame berikutnya):`, err);
    }
  };

  return {
    /** @param {System} system */
    add(system) {
      assertSystem(system);
      if (entries.some((e) => e.system.id === system.id)) throw new Error(`SystemRunner: id "${system.id}" sudah terdaftar`);
      seq += 1;
      insert({ system, failures: 0, seq, removed: false });
      return system;
    },
    /**
     * Cabut sistem; dispose() sistem dipanggil (galatnya dicatat) kecuali `dispose: false`.
     * @param {string} id
     * @param {{dispose?: boolean}} [opts]
     */
    remove(id, { dispose = true } = {}) {
      const entry = entries.find((e) => e.system.id === id);
      if (!entry) return false;
      entry.removed = true;
      entries = entries.filter((e) => e !== entry);
      if (dispose) disposeSystem(entry.system);
      return true;
    },
    has(id) { return entries.some((e) => e.system.id === id); },
    get ids() { return entries.map((e) => e.system.id); },
    get disabled() { return [...disabled]; },
    update(dt, ctx) {
      for (const entry of entries) { // iterasi atas array saat ini; penghapusan membuat array baru
        if (entry.removed) continue; // dicabut oleh sistem lain di frame ini
        try {
          entry.system.update(dt, ctx);
          entry.failures = 0;
        } catch (err) {
          fail(entry, err);
        }
      }
    },
    /** Lepas semua sistem terbalik dari urutan pendaftaran (LIFO, lintas fase). */
    dispose() {
      const list = [...entries].sort((a, b) => b.seq - a.seq);
      entries = [];
      for (const entry of list) {
        entry.removed = true;
        disposeSystem(entry.system);
      }
    },
  };
}
