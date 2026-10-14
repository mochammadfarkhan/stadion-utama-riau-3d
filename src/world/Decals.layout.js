/**
 * Tata letak dekal permukaan (data murni, deterministik): retak paving plaza,
 * noda parkir & Naga Sakti, bekas ban & panah jalan lingkar, lumut kaki rib &
 * tugu, grafiti dinding concourse, manhole trotoar, zebra cross, huruf "P".
 * Item: { name, x, y, z, rotY, scale, aspect?, vertical? }
 *  - horizontal: "atas" tekstur (v) menunjuk −Z sebelum rotY; scale = panjang v (m)
 *  - vertical: bidang menghadap +Z lokal (rotY = yaw keluar); scale = tinggi (m)
 *  - aspect (opsional) = lebar/tinggi; default mengikuti sel atlas
 */
import { STADIUM, SITE } from '../config/constants.js';
import { createRandom } from './siteutil/rng.js';
import { frameAt, framePoint } from './stadium/ovalFrame.js';
import { isInsideGate, isInsideStair } from './stadium/gateLayout.js';
import { distanceToGateCorridor } from '../core/Collider.js';

const SEED = 20121;
const TWO_PI = Math.PI * 2;
// Ketinggian permukaan (selaras LAYER_Y Ground.materials) + offset kecil anti z-fighting
const Y = Object.freeze({ plaza: 0.032, moss: 0.034, road: 0.042, letter: 0.046, zebra: 0.066, sidewalk: 0.128 });
const COUNTS = Object.freeze({ cracks: 120, parkingStains: 30, nagaStains: 10, tire: 15, arrows: 8, manholes: 12 });
const GATE_CLEARANCE = 7;                 // jarak retak dari koridor gate utama (m)
const TUGU = Object.freeze({ x: 0, z: -(STADIUM.outerSemiZ + 45), clear: 14, wallR: 11.53, wallH: 0.7, moss: 6 });
const NAGA = Object.freeze({ halfRoad: (SITE.nagaSaktiLanes * SITE.laneWidth) / 2, walk: 2.5 });
const ZEBRA_WIDTH = 4;                    // lebar penyeberangan (sepanjang X)
const RIB_FOOT_OUT = 1.1;                 // geser lumut keluar dari pusat kaki rib (m)
const GRAFFITI_U = Object.freeze([0.125, 0.332, 0.425, 0.625, 0.825, 0.925]);
const GRAFFITI_K = 0.0185;                // sedikit di luar dinding concourse (WALL_K 0.02)
const ARROW_T = Object.freeze([0.35, 0.9, 1.75, 2.6, 3.5, 3.95, 5.0, 5.9]); // jauh dari simpang utara

/** Yaw horizontal agar "atas" tekstur menunjuk arah (dx, dz). */
const yawToward = (dx, dz) => Math.atan2(-dx, -dz);

/** Retak paving: sabuk elips antara cangkang+2 dan batas plaza−2. */
function plazaCracks(rnd) {
  const out = [];
  const inA = STADIUM.outerSemiX + 2;
  const inB = STADIUM.outerSemiZ + 2;
  const outA = SITE.plazaSemiX - 2;
  const outB = SITE.plazaSemiZ - 2;
  let guard = 0;
  while (out.length < COUNTS.cracks && guard < COUNTS.cracks * 20) {
    guard += 1;
    const t = rnd.range(0, TWO_PI);
    const f = rnd.range(0.05, 0.95);
    const x = (inA + (outA - inA) * f) * Math.cos(t);
    const z = (inB + (outB - inB) * f) * Math.sin(t);
    if (distanceToGateCorridor(x, z) < GATE_CLEARANCE) continue;
    if (Math.hypot(x - TUGU.x, z - TUGU.z) < TUGU.clear) continue;
    const name = rnd.chance(0.5) ? 'crack1' : 'crack2';
    out.push({ name, x, y: Y.plaza, z, rotY: rnd.range(0, TWO_PI), scale: rnd.range(2.6, 4.2) });
  }
  return out;
}

/** Noda oli/air di blok parkir mobil (¾) & motor (¼). */
function parkingStains(rnd) {
  const lots = [SITE.parkingCar, SITE.parkingMoto];
  return Array.from({ length: COUNTS.parkingStains }, (_, i) => {
    const lot = lots[i % 4 === 3 ? 1 : 0];
    return {
      name: rnd.chance(0.6) ? 'oil' : 'water',
      x: lot.x + rnd.range(-0.45, 0.45) * lot.w,
      y: Y.road,
      z: lot.z + rnd.range(-0.42, 0.42) * lot.d,
      rotY: rnd.range(0, TWO_PI),
      scale: rnd.range(0.9, 2.0),
    };
  });
}

/** Noda di lajur Jl. Naga Sakti. */
function nagaStains(rnd) {
  return Array.from({ length: COUNTS.nagaStains }, () => ({
    name: rnd.chance(0.5) ? 'oil' : 'water',
    x: rnd.range(-320, 320),
    y: Y.road,
    z: SITE.nagaSaktiZ + rnd.range(-0.8, 0.8) * NAGA.halfRoad,
    rotY: rnd.range(0, TWO_PI),
    scale: rnd.range(1.0, 2.2),
  }));
}

/** Titik & tangen pada elips jalan lingkar (sudut t, offset lajur meter; + = keluar). */
export function ringRoadPose(t, laneOffset) {
  const a = SITE.ringRoadSemiX;
  const b = SITE.ringRoadSemiZ;
  const px = a * Math.cos(t);
  const pz = b * Math.sin(t);
  const nl = Math.hypot(px / (a * a), pz / (b * b));
  const tl = Math.hypot(a * Math.sin(t), b * Math.cos(t));
  return {
    x: px + (px / (a * a) / nl) * laneOffset,
    z: pz + (pz / (b * b) / nl) * laneOffset,
    tx: (-a * Math.sin(t)) / tl,
    tz: (b * Math.cos(t)) / tl,
  };
}

/** Bekas ban searah jalan lingkar. */
function tireMarks(rnd) {
  return Array.from({ length: COUNTS.tire }, () => {
    const p = ringRoadPose(rnd.range(0, TWO_PI), rnd.range(-3, 3));
    const rotY = yawToward(p.tx, p.tz) + rnd.range(-0.06, 0.06);
    return { name: 'tire', x: p.x, y: Y.road, z: p.z, rotY, scale: rnd.range(5, 9), aspect: 0.3 };
  });
}

/** Panah lajur: lajur luar searah t naik, lajur dalam berlawanan. */
function ringArrows() {
  return ARROW_T.slice(0, COUNTS.arrows).map((t, i) => {
    const s = i % 2 === 0 ? 1 : -1;
    const p = ringRoadPose(t, 2.5 * s);
    return { name: 'arrow', x: p.x, y: Y.road, z: p.z, rotY: yawToward(p.tx * s, p.tz * s), scale: 5, aspect: 0.45 };
  });
}

/** Lumut di kaki rib (bukan selembayung) + lumut dinding kolam tugu. */
function mossPatches(rnd) {
  const out = [];
  const half = STADIUM.ribCount / 2;
  for (let i = 1; i < STADIUM.ribCount; i += 1) {
    if (i === half) continue;
    const u = i / STADIUM.ribCount;
    const f = frameAt(u);
    const p = framePoint(u, -0.02, 0);
    const x = p.x + f.nx * RIB_FOOT_OUT;
    const z = p.z + f.nz * RIB_FOOT_OUT;
    out.push({ name: 'moss', x, y: Y.moss, z, rotY: rnd.range(0, TWO_PI), scale: rnd.range(1.6, 2.4) });
  }
  return [...out, ...tuguMoss(rnd)];
}

/** Lumut vertikal di kaki dinding luar kolam tugu Lancang Kuning (menghadap keluar). */
function tuguMoss(rnd) {
  return Array.from({ length: TUGU.moss }, (_, i) => {
    const a = (i / TUGU.moss) * TWO_PI + rnd.range(-0.2, 0.2);
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    return {
      name: 'moss', x: TUGU.x + nx * TUGU.wallR, y: TUGU.wallH * 0.4, z: TUGU.z + nz * TUGU.wallR,
      rotY: Math.atan2(nx, nz), scale: TUGU.wallH * 0.8, aspect: 1.6, vertical: true,
    };
  });
}

/** Grafiti kecil vertikal di dinding concourse (celah antar rib, bebas gate/tangga). */
function graffiti() {
  return GRAFFITI_U.filter((u) => !isInsideGate(u, 2) && !isInsideStair(u, 2)).map((u, i) => {
    const f = frameAt(u);
    const p = framePoint(u, GRAFFITI_K, 0);
    const name = i % 2 === 0 ? 'graffiti1' : 'graffiti2';
    return { name, x: p.x, y: 1.5, z: p.z, rotY: f.yaw, scale: 2.2, vertical: true };
  });
}

/** Manhole di dua trotoar Naga Sakti (selang-seling, hindari gapura). */
function manholes() {
  const zs = [SITE.nagaSaktiZ + NAGA.halfRoad + NAGA.walk / 2, SITE.nagaSaktiZ - NAGA.halfRoad - NAGA.walk / 2];
  return Array.from({ length: COUNTS.manholes }, (_, i) => ({
    name: 'manhole',
    x: -275 + i * 50 + (i >= 6 ? 12 : -12),
    y: Y.sidewalk,
    z: zs[i % 2],
    rotY: i * 0.7,
    scale: 0.9,
  }));
}

/** Zebra cross melintasi Naga Sakti di mulut jalan penghubung (x=0 depan gapura, x=140). */
function zebras() {
  const len = NAGA.halfRoad * 2;
  return SITE.connectorXs.map((x) => ({
    name: 'zebra', x, y: Y.zebra, z: SITE.nagaSaktiZ, rotY: 0, scale: len, aspect: ZEBRA_WIDTH / len,
  }));
}

/** Huruf "P" di lorong tengah tiap blok parkir (blok mobil digeser dari jalan penghubung). */
function parkingLetters() {
  return [
    { lot: SITE.parkingCar, dx: 40 },
    { lot: SITE.parkingMoto, dx: 0 },
  ].map(({ lot, dx }) => ({ name: 'parkingP', x: lot.x + dx, y: Y.letter, z: lot.z, rotY: 0, scale: 6 }));
}

/** Seluruh dekal kawasan (urutan & nilai deterministik). */
export function createDecalLayout() {
  const rnd = createRandom(SEED);
  return Object.freeze([
    ...plazaCracks(rnd),
    ...parkingStains(rnd),
    ...nagaStains(rnd),
    ...tireMarks(rnd),
    ...ringArrows(),
    ...mossPatches(rnd),
    ...graffiti(),
    ...manholes(),
    ...zebras(),
    ...parkingLetters(),
  ].map((d) => Object.freeze(d)));
}

/** Ringkasan jumlah per nama dekal (laporan/debug). */
export function countDecals(items) {
  return items.reduce((acc, d) => ({ ...acc, [d.name]: (acc[d.name] ?? 0) + 1 }), {});
}
