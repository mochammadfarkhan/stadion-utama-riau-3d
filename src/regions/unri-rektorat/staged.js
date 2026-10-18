// src/regions/unri-rektorat/staged.js
/**
 * Perakitan region bertahap (spec §4.3): daftar langkah dijalankan sebagai SATU tugas generator di
 * ctx.schedule (scheduler M0, ≤ 4 ms/frame; tiap yield = titik potong), masing-masing di dalam
 * withScope(scope) agar cache material/geometri masuk scope region. Tanpa scheduler (tes/Node) → sinkron.
 */
import { withScope } from '../../engine/ResourceScope.js';

/**
 * @param {{steps: Array<() => void>, scope: object, schedule?: ((task: () => Generator) => {cancel(): void})|null,
 *   isCancelled?: () => boolean}} opts
 * @returns {{promise: Promise<boolean>, cancel(): void}} promise: true selesai, false dibatalkan; reject bila langkah melempar
 */
export function runStaged({ steps, scope, schedule = null, isCancelled = () => false }) {
  let settle = null;
  const promise = new Promise((resolve, reject) => { settle = { resolve, reject }; });
  let finished = false;
  const finish = (fn, value) => {
    if (finished) return;
    finished = true;
    fn(value);
  };
  function* task() {
    for (const step of steps) {
      if (finished) return;
      if (isCancelled()) {
        finish(settle.resolve, false);
        return;
      }
      try {
        withScope(scope, step);
      } catch (err) {
        finish(settle.reject, err);
        return;
      }
      yield;
    }
    finish(settle.resolve, true);
  }
  let handle = null;
  if (typeof schedule === 'function') handle = schedule(task);
  else for (const _ of task()) { /* sinkron: habiskan generator */ }
  return {
    promise,
    cancel() {
      handle?.cancel?.();
      finish(settle.resolve, false);
    },
  };
}

/** Bekukan subpohon yang ditambahkan SETELAH freezeStatic region (matriks lokal tetap; dunia ikut induk). */
export function freezeSubtree(obj) {
  obj.traverse((o) => {
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  });
  obj.updateMatrixWorld(true);
  return obj;
}
