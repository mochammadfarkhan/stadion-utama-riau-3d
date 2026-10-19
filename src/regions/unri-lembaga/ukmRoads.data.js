/**
 * Data MURNI jalan, parit, tiang, dan PJU sekitar sekre UKM blok biru (Jl. Prof. Aras Mulyadi dari BETON dengan parit
 * U terbuka di tepi timur jalan, foto Street View). Semua turunan generator (polylineOffset/polylineSteps/…) dari satu
 * polyline sumbu jalan + parameter; koordinat keluaran region-lokal. Tanpa three.
 */
import { toRegion } from './placement.js';
import { polylineLength, polylineOffset, polylineSlice, polylineSteps } from './generators.js';

const freezeDeep = (v) => (Array.isArray(v) ? Object.freeze(v.map(freezeDeep)) : v);

/** Jalan servis OSM di sekitar (dunia): Jl. Prof. Aras Mulyadi dan akses ke halaman/gubuk. */
export const UKM_ROADS = freezeDeep([
  [[-139.1, 959.1], [-138, 998.3], [-141.5, 1013.4], [-146.2, 1028.6], [-152.6, 1039.3], [-164.3, 1053.6]],
  [[-139.1, 959.1], [-123.4, 958.4], [-118.3, 963], [-115.6, 998.1], [-112.5, 1002.4], [-96.9, 1001.7]],
]);

/** Parameter jalan beton, parit U, tiang listrik, PJU (m). */
export const ROAD_SPEC = Object.freeze({
  width: 5.2,
  jointLength: 5,
  ditch: Object.freeze({ width: 0.6, depth: 0.5, wall: 0.08, gap: 2, from: 14, endTrim: 4, capEvery: 12, capLength: 1.0 }),
  pole: Object.freeze({ height: 8, step: 22, start: 28, side: 1, offset: 6.4 }),
  pju: Object.freeze({ step: 32, start: 20, offset: 3.5 }),
  decals: Object.freeze({ at: [26, 56], size: Object.freeze({ across: 4, along: 3.2 }) }),
});

const toLocal = (pts) => pts.map(([x, z]) => toRegion(x, z));

/** Polyline sumbu (region-lokal) per jalan. */
export const ROAD_LINES = Object.freeze(UKM_ROADS.map((r) => Object.freeze(toLocal(r))));

/** Permukaan beton digambar sampai tepi halaman: jalan akses berhenti di (−115,6; 998,1) sebelum halaman beton. */
export const ROAD_SURFACES = Object.freeze([ROAD_LINES[0], Object.freeze(ROAD_LINES[1].slice(0, 4))]);

const aras = ROAD_LINES[0];
const arasLen = polylineLength(aras);
const edge = ROAD_SPEC.width / 2;

/** Titik di sisi `side` (+1 timur, −1 barat) sumbu jalan, `d` m dari sumbu, mengikuti polyline. */
const sideLine = (side, d) => polylineOffset(aras, side * d);

function ditchLine() {
  const { gap, width, from, endTrim } = ROAD_SPEC.ditch;
  return polylineSlice(sideLine(1, edge + gap + width / 2), from, arasLen - endTrim);
}

function ditchCaps(line) {
  const { capEvery } = ROAD_SPEC.ditch;
  return polylineSteps(line, capEvery, { start: capEvery / 2 }).map((s) => Object.freeze({ x: s.x, z: s.z, tx: s.tx, tz: s.tz }));
}

function poles() {
  const { step, start, side, offset } = ROAD_SPEC.pole;
  const line = sideLine(side, offset);
  return polylineSteps(line, step, { start }).map((s) => Object.freeze({ x: s.x, z: s.z, rotY: Math.atan2(s.tx, s.tz) }));
}

/** PJU: lengan LampPost (+X lokal) mengarah ke sumbu jalan; kepala lampu di ujung lengan. */
function pjus() {
  const { step, start, offset } = ROAD_SPEC.pju;
  const out = polylineSteps(aras, step, { start }).map((s, i) => {
    const sign = i % 2 === 0 ? -1 : 1; // selang-seling barat/timur
    const nx = s.tz;
    const nz = -s.tx;
    const x = s.x + sign * nx * offset;
    const z = s.z + sign * nz * offset;
    return { x, z, rotY: Math.atan2(sign * nz, -sign * nx) };
  });
  const junction = polylineSteps(ROAD_LINES[1], 1000, { start: 9 })[0];
  out.push({ x: junction.x, z: junction.z - ROAD_SPEC.pju.offset, rotY: -Math.PI / 2 });
  return out.map((p) => Object.freeze(p));
}

function decals() {
  const { at, size } = ROAD_SPEC.decals;
  return polylineSteps(aras, 1000, { start: at[0] }).concat(polylineSteps(aras, 1000, { start: at[1] })).map((s) => Object.freeze({
    x: s.x, z: s.z, ax: -s.tx, az: -s.tz, across: size.across, along: size.along, // ax/az = arah baca (menuju utara)
  }));
}

const ditch = ditchLine();
const poleList = poles();
const pjuList = pjus();

export const ROAD_LAYOUT = Object.freeze({
  ditch: Object.freeze(ditch),
  caps: Object.freeze(ditchCaps(ditch)),
  poles: Object.freeze(poleList),
  pju: Object.freeze(pjuList),
  decals: Object.freeze(decals()),
  /** Lingkaran penghalang untuk collider (region-lokal). */
  obstacles: Object.freeze([
    ...poleList.map((p) => Object.freeze({ x: p.x, z: p.z, r: 0.25 })),
    ...pjuList.map((p) => Object.freeze({ x: p.x, z: p.z, r: 0.45 })),
  ]),
});

/** Kepala lampu PJU (region-lokal): ujung lengan sepanjang `reach` (+X lokal tiang → dunia (cos r, −sin r)). */
export const pjuHead = (p, reach) => ({ x: p.x + Math.cos(p.rotY) * reach, z: p.z - Math.sin(p.rotY) * reach });
