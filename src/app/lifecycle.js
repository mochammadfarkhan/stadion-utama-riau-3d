/**
 * Tumpukan disposer composition root: dipanggil terbalik (LIFO) agar yang dibuat terakhir dibongkar
 * pertama. Galat satu disposer dicatat lalu pembongkaran berlanjut. disposeAll idempoten.
 * @param {{logger?: {error: (...args: unknown[]) => void}}} [opts]
 */
export function createDisposerStack({ logger = console } = {}) {
  let stack = [];
  return {
    /** @template {() => void} F @param {F} fn @returns {F} */
    add(fn) {
      if (typeof fn !== 'function') throw new TypeError('createDisposerStack.add: fn harus fungsi');
      stack = [...stack, fn];
      return fn;
    },
    get size() { return stack.length; },
    disposeAll() {
      const list = stack;
      stack = [];
      for (let i = list.length - 1; i >= 0; i -= 1) {
        try {
          list[i]();
        } catch (err) {
          logger.error('Pembongkaran gagal (dilanjutkan):', err);
        }
      }
    },
  };
}
