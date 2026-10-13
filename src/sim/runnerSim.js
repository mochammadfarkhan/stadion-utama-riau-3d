/**
 * Pelari di lane lintasan: jarak tempuh di-wrap modulo panjang lane,
 * kecepatan bervariasi halus (sinus) ±10% di sekitar speed dasar.
 */
import { laneLength } from './trackPath.js';

const SPEED_VARIATION = 0.1;   // ±10%
const VARIATION_RATE = 0.5;    // rad/s

const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

/** Pelari baru. phase acak bila tidak diberikan agar tiap pelari tidak sinkron. */
export function createRunner({ id, lane = 1, speed = 3.5, dist = 0, phase } = {}) {
  return {
    id,
    lane,
    speed: num(speed, 3.5),
    dist: num(dist),
    phase: num(phase, Math.random() * Math.PI * 2),
    t: 0,
    v: num(speed, 3.5),
  };
}

/** Satu langkah: kembalikan pelari baru dengan dist ter-wrap. dt NaN/≤0 → salinan. */
export function stepRunner(runner, dt) {
  const h = num(dt);
  if (h <= 0) return { ...runner };
  const t = runner.t + h;
  const v = runner.speed * (1 + SPEED_VARIATION * Math.sin(VARIATION_RATE * t + runner.phase));
  const L = laneLength(runner.lane);
  const dist = (((runner.dist + v * h) % L) + L) % L;
  return { ...runner, t, v, dist };
}
