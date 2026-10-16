/**
 * ResourceScope: cache sumber daya GPU (material/geometri/tekstur) ber-refcount per kunci.
 * - get(key, make) membuat sekali lalu menaikkan refs; release(key) menurunkan, di nol dilepas.
 * - dispose() melepas semua entri (dipakai saat region di-dispose).
 * - owns(resource) dipakai disposeTree agar sumber daya bersama tidak dilepas dua kali oleh pohon.
 * Modul memakai currentScope() pada saat pemanggilan; withScope(scope, fn) menukar scope aktif
 * selama fn sinkron (mis. saat region dibangun). Lapisan engine: tanpa impor three/world/ui.
 */
const RESOURCE_FLAGS = ['isMaterial', 'isBufferGeometry', 'isTexture'];

const isResource = (v) => Boolean(v) && typeof v === 'object' && RESOURCE_FLAGS.some((f) => v[f] === true);

/** Sumber daya langsung di dalam nilai cache: nilai itu sendiri, atau anggota array/objek polos (satu tingkat). */
export function collectResources(value) {
  if (isResource(value)) return [value];
  if (Array.isArray(value)) return value.filter(isResource);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.values(value).filter(isResource);
  }
  return [];
}

function defaultDispose(value) {
  for (const r of new Set(collectResources(value))) r.dispose();
}

/**
 * @param {string} [name]
 * @param {{logger?: {error: (...args: unknown[]) => void}}} [opts]
 */
export function createResourceScope(name = 'scope', { logger = console } = {}) {
  const entries = new Map(); // key -> { value, refs, dispose, resources }
  const owned = new Map();   // resource -> jumlah entri yang memuatnya
  let disposed = false;

  const own = (resources, delta) => {
    for (const r of resources) {
      const n = (owned.get(r) ?? 0) + delta;
      if (n > 0) owned.set(r, n);
      else owned.delete(r);
    }
  };

  const drop = (key, entry) => {
    entries.delete(key);
    own(entry.resources, -1);
    try {
      entry.dispose(entry.value);
    } catch (err) {
      logger.error(`ResourceScope "${name}": gagal melepas "${key}":`, err);
    }
  };

  return {
    name,
    /**
     * @template T
     * @param {string} key
     * @param {() => T} make
     * @param {{dispose?: (value: T) => void}} [opts]
     * @returns {T}
     */
    get(key, make, { dispose = defaultDispose } = {}) {
      if (disposed) throw new Error(`ResourceScope "${name}" sudah di-dispose`);
      if (typeof make !== 'function') throw new TypeError('ResourceScope.get: make harus fungsi');
      const hit = entries.get(key);
      if (hit) {
        hit.refs += 1;
        return hit.value;
      }
      const value = make();
      const resources = [...new Set(collectResources(value))];
      entries.set(key, { value, refs: 1, dispose, resources });
      own(resources, 1);
      return value;
    },
    has(key) { return entries.has(key); },
    refs(key) { return entries.get(key)?.refs ?? 0; },
    release(key) {
      const entry = entries.get(key);
      if (!entry) return false;
      entry.refs -= 1;
      if (entry.refs <= 0) drop(key, entry);
      return true;
    },
    /** Hapus entri tanpa melepas nilainya (mis. muatan yang gagal agar bisa dicoba ulang). */
    forget(key) {
      const entry = entries.get(key);
      if (!entry) return false;
      entries.delete(key);
      own(entry.resources, -1);
      return true;
    },
    owns(resource) { return owned.has(resource); },
    get size() { return entries.size; },
    get disposed() { return disposed; },
    dispose() {
      for (const [key, entry] of [...entries]) drop(key, entry);
      disposed = true;
    },
  };
}

let current = createResourceScope('global');

/** Scope yang dipakai cache modul saat ini (default: scope global aplikasi). */
export function currentScope() {
  return current;
}

/** Jalankan fn (sinkron) dengan `scope` sebagai scope aktif; scope sebelumnya selalu dipulihkan. */
export function withScope(scope, fn) {
  if (!scope || typeof scope.get !== 'function') throw new TypeError('withScope: scope tidak valid');
  const prev = current;
  current = scope;
  try {
    return fn();
  } finally {
    current = prev;
  }
}
