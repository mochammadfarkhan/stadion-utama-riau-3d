/**
 * Registry malam/basah untuk distrik yang kontennya datang belakangan (chunk tanah/vegetasi/PJU di-stream).
 * Setiap pendaftaran mengembalikan pencabut idempoten; dispose() mencabut semua yang tersisa (LIFO).
 * time/weather boleh null (pencabut no-op). Galat saat mencabut dicatat, tidak dilempar.
 * @param {{time?: {registerEmissive?(root: object): () => boolean, registerLamps?(opts: object): () => boolean}|null,
 *   weather?: {registerWet?(root: object): () => boolean}|null, logger?: {error: (...a: unknown[]) => void}}} [opts]
 */
export function createDistrictRegistries({ time = null, weather = null, logger = console } = {}) {
  const live = new Set();
  const track = (off) => {
    if (typeof off !== 'function') return () => false;
    let done = false;
    const undo = () => {
      if (done) return false;
      done = true;
      live.delete(undo);
      try {
        off();
      } catch (err) {
        logger.error('Registry distrik: pencabutan gagal (dilanjutkan):', err);
      }
      return true;
    };
    live.add(undo);
    return undo;
  };
  return Object.freeze({
    registerWet: (root) => track(weather?.registerWet?.(root)),
    registerEmissive: (root) => track(time?.registerEmissive?.(root)),
    registerLamps: (opts) => track(time?.registerLamps?.(opts)),
    get size() { return live.size; },
    dispose() {
      for (const undo of [...live].reverse()) undo();
    },
  });
}
