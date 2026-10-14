/**
 * Pelacak putaran lintasan: checkpoint harus dilewati berurutan; titik 0 = garis start.
 * Putaran selesai saat kembali ke titik 0 setelah melewati semua titik lain.
 */
export function createLapTracker(checkpoints, radius = 6) {
  return Object.freeze({ checkpoints, radius, next: 0, startedAt: null });
}

/** @returns {{state:object, lapSeconds:number|null}} */
export function stepLap(state, pos, time) {
  const cp = state.checkpoints[state.next];
  if (!cp || Math.hypot(pos.x - cp.x, pos.z - cp.z) > state.radius) return { state, lapSeconds: null };
  if (state.next !== 0) return { state: { ...state, next: (state.next + 1) % state.checkpoints.length }, lapSeconds: null };
  if (state.startedAt == null) return { state: { ...state, next: 1, startedAt: time }, lapSeconds: null };
  return { state: { ...state, next: 1, startedAt: time }, lapSeconds: time - state.startedAt };
}
