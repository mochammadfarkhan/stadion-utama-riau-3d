/**
 * Tata letak MURNI area gedung UKM blok biru (region-lokal): dinding/atap, halaman beton, lapangan + rintangan
 * (tiang net, tiang ring), baris palem, gubuk panahan + tiangnya, serta benda halaman dari GLB (tiang lampu, tong).
 * Dipakai builder, collider, dan tes; semuanya diturunkan dari parameter di sekreUkm.data.js lewat generator.
 */
import {
  UKM_WALLS, UKM_ROOF, COURTS, COURT_COLORS, COMPLEX_BOX, YARD_BOX, ARCHERY, fromUkm, boxToRegion,
} from './sekreUkm.data.js';
import { toRegion } from './placement.js';
import { courtSpec, courtObstacles } from './courts.spec.js';
import { boxPerimeter, rowPoints, postRows } from './generators.js';

const toLocalRing = (ring) => Object.freeze(ring.map(([x, z]) => {
  const p = fromUkm(x, z);
  return Object.freeze([p.x, p.z]);
}));

/** Benda halaman dari GLB (lokal-gedung, dari yard_props h09_sekre_ukm.py): tiang lampu, 3 tong biru. */
const GLB_PROPS = Object.freeze([
  { bx: -0.9, bz: 1.6, r: 0.25 },
  { bx: -13.3, bz: 2.95, r: 0.32 }, { bx: -12.75, bz: 2.9, r: 0.32 }, { bx: 1.9, bz: 3.0, r: 0.32 },
]);

function courtsRegion() {
  const local = COURTS.map((c) => {
    const [x, z] = toRegion(c.x, c.z);
    return { ...c, x, z };
  });
  return local.map((c) => ({
    ...courtSpec(c.kind, { surface: c.surface, outer: c.outer }),
    id: c.id, x: c.x, z: c.z,
    colors: { runoff: COURT_COLORS.runoff, surface: COURT_COLORS[c.kind], lines: COURT_COLORS.garis },
  }));
}

/** Palem: keliling kotak luar kompleks (masuk 2 m; sisi timur kosong, run-off tenis menempel) + dua jalur hijau di antara lapangan (rowPoints). Dunia → region-lokal. */
function palmPoints() {
  const b = COMPLEX_BOX;
  const gaps = [
    [(COURTS[0].x + COURTS[0].outer.w / 2 + (COURTS[1].x - COURTS[1].outer.w / 2)) / 2],
    [(COURTS[1].x + COURTS[1].outer.w / 2 + (COURTS[2].x - COURTS[2].outer.w / 2)) / 2],
  ].map(([x]) => rowPoints({ from: [x, b.minZ + 3], to: [x, b.maxZ - 3], count: 8 }));
  const ring = boxPerimeter(b, { step: 5.2, inset: 2, sides: ['n', 's', 'w'] });
  return [...ring, ...gaps.flat()].map(([x, z]) => toRegion(x, z));
}

function build() {
  const courts = courtsRegion();
  const hutBox = boxToRegion(ARCHERY.hut);
  const hutPosts = postRows(hutBox, { spacing: 4.3, inset: 0.3 });
  const obstacles = [
    ...courts.flatMap((c) => courtObstacles(c, c)),
    ...hutPosts.map(([x, z]) => ({ x, z, r: 0.3 })),
    ...GLB_PROPS.map((p) => ({ ...fromUkm(p.bx, p.bz), r: p.r })),
  ];
  return Object.freeze({
    walls: toLocalRing(UKM_WALLS),
    roof: toLocalRing(UKM_ROOF),
    courts: Object.freeze(courts),
    obstacles: Object.freeze(obstacles.map((o) => Object.freeze(o))),
    palms: Object.freeze(palmPoints().map((p) => Object.freeze(p))),
    hut: Object.freeze({ box: hutBox, posts: Object.freeze(hutPosts) }),
    yard: Object.freeze(boxToRegion({ minX: YARD_BOX.minX, maxX: -93.6, minZ: YARD_BOX.minZ, maxZ: 1019.1 })),
    field: boxToRegion(ARCHERY.field),
  });
}

export const UKM_LAYOUT = build();
