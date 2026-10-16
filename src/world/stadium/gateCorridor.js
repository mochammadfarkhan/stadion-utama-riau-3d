/**
 * Koridor gate utama stadion sebagai segmen garis region-lokal (dari luar cangkang ke apron lintasan).
 * Dipakai collider region, penempatan penonton, dan dekal. Dulu di core/Collider.js.
 */
import { GATES } from './gateLayout.js';
import { framePoint } from './ovalFrame.js';

export const GATE_HALF_WIDTH = 4.6;   // sedikit lebih sempit dari terowongan 10 m
const CORRIDOR_K_START = -0.08;
const CORRIDOR_K_END = 1.25;

const CORRIDORS = GATES.filter((g) => g.main).map((g) => {
  const a = framePoint(g.u, CORRIDOR_K_START, 0);
  const b = framePoint(g.u, CORRIDOR_K_END, 0);
  return { ax: a.x, az: a.z, bx: b.x, bz: b.z };
});

/** Jarak titik ke segmen garis (2D). */
function distToSegment(px, pz, s) {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / len2));
  return Math.hypot(px - (s.ax + dx * t), pz - (s.az + dz * t));
}

/** Jarak terdekat titik ke garis tengah koridor gate utama. */
export function distanceToGateCorridor(x, z) {
  return Math.min(...CORRIDORS.map((s) => distToSegment(x, z, s)));
}

export function inGateCorridor(x, z) {
  return distanceToGateCorridor(x, z) < GATE_HALF_WIDTH;
}
