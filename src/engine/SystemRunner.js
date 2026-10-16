/**
 * SystemRunner: menjalankan sistem per frame dalam fase eksplisit input → sim → world → camera → ui.
 * Di dalam satu fase, urutan = urutan pendaftaran. Satu sistem yang melempar galat tidak menghentikan
 * sistem lain; setelah MAX_CONSECUTIVE_FAILURES galat beruntun sistem dinonaktifkan dan id-nya dicatat.
 * Lapisan engine: tanpa impor three/world/ui.
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
  let entries = []; // { system, failures } terurut fase lalu pendaftaran
  const disabled = [];

  const insert = (entry) => {
    const idx = PHASE_INDEX.get(entry.system.phase);
    const at = entries.findIndex((e) => PHASE_INDEX.get(e.system.phase) > idx);
    entries = at < 0 ? [...entries, entry] : [...entries.slice(0, at), entry, ...entries.slice(at)];
  };

  const fail = (entry, err) => {
    entry.failures += 1;
    const { id } = entry.system;
    if (entry.failures >= MAX_CONSECUTIVE_FAILURES) {
      logger.error(`Sistem "${id}" dinonaktifkan setelah ${entry.failures} galat beruntun:`, err);
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
      insert({ system, failures: 0 });
      return system;
    },
    remove(id) {
      const before = entries.length;
      entries = entries.filter((e) => e.system.id !== id);
      return entries.length !== before;
    },
    has(id) { return entries.some((e) => e.system.id === id); },
    get ids() { return entries.map((e) => e.system.id); },
    get disabled() { return [...disabled]; },
    update(dt, ctx) {
      for (const entry of entries) { // iterasi atas array saat ini; penghapusan membuat array baru
        try {
          entry.system.update(dt, ctx);
          entry.failures = 0;
        } catch (err) {
          fail(entry, err);
        }
      }
    },
    dispose() {
      const list = entries;
      entries = [];
      for (const { system } of list) {
        try {
          system.dispose?.();
        } catch (err) {
          logger.error(`Sistem "${system.id}" gagal di-dispose:`, err);
        }
      }
    },
  };
}
