/**
 * Tata letak gate & tangga keliling (dibagi Shell dan Facade).
 * Gate diletakkan di celah antar rib (rib di kelipatan 1/ribCount; u=0 & 0.5 = pasangan selembayung).
 */
import { STADIUM } from '../../config/constants.js';
import { uDelta, uSpan } from './ovalFrame.js';

const REGULAR = { width: 6, height: STADIUM.gateHeight };
const MAIN = { width: 10, height: STADIUM.mainGateHeight };

const SLOTS = [
  { u: 0.0, main: true, name: 'UTARA' },
  { u: 0.075 }, { u: 0.175 }, { u: 0.275 }, { u: 0.375 }, { u: 0.475 },
  { u: 0.5 },
  { u: 0.575 }, { u: 0.675 },
  { u: 0.775, main: true, name: 'BARAT' },
  { u: 0.875 }, { u: 0.975 },
];

/** @type {ReadonlyArray<{id:number,u:number,main:boolean,name:string|null,width:number,height:number}>} */
export const GATES = Object.freeze(SLOTS.map((s, i) => Object.freeze({
  id: i + 1,
  u: s.u,
  main: Boolean(s.main),
  name: s.name ?? null,
  ...(s.main ? MAIN : REGULAR),
})));

if (GATES.length !== STADIUM.gateCount) {
  throw new Error(`gateLayout: ${GATES.length} slot ≠ STADIUM.gateCount ${STADIUM.gateCount}`);
}

/** Posisi u tangga lebar ke concourse (celah rib genap, bebas gate). */
export const STAIR_U = Object.freeze([0.025, 0.225, 0.525, 0.725]);
export const STAIR_WIDTH = 12;

export function gateHalfSpan(gate, marginM = 0) {
  return uSpan(gate.width / 2 + marginM);
}

/** Apakah u berada di dalam bukaan gate (dengan margin meter). */
export function isInsideGate(u, marginM = 0) {
  return GATES.some((g) => Math.abs(uDelta(u, g.u)) < gateHalfSpan(g, marginM));
}

/** Apakah u berada pada rentang tangga. */
export function isInsideStair(u, marginM = 0) {
  const half = uSpan(STAIR_WIDTH / 2 + marginM);
  return STAIR_U.some((su) => Math.abs(uDelta(u, su)) < half);
}
