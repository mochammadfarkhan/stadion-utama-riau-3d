/**
 * Tata letak zona Lembaga (MURNI, tanpa three): denah sekretariat (lokal-gedung), titik props teras, baris
 * motor parkir, PJU, detail Rusunawa/FH. Semua titik keluaran region-lokal {x, z, rotY} kecuali disebut.
 * Konvensi prop (katalog aset): muka depan menghadap −Z lokal prop; rotY = rotasi sumbu +Y (Object3D).
 * [INFERENSI] seluruh tata letak props (pola umum sekre ormawa Indonesia, riset §3).
 */
import { placementFromFootprint } from '../../geo/placement.js';
import { toLocal, toWorld } from '../../geo/regionTransform.js';
import { pointInPolygon, distanceToRing } from '../../geo/polygon.js';
import { createRandom } from '../../world/siteutil/rng.js';
import {
  SEKRE_SIZE, SEKRE_FRAME, fromSekre, FOOTPRINTS, toRegion, regionToWorld,
} from './placement.js';
import { sekreRooms } from './sekre.data.js';
import { evenSteps, fenceRuns, rowPoints } from './generators.js';

/** Dimensi sekretariat (lokal-gedung, m). v = tinggi dari tanah pad. */
export const SEKRE_DIM = Object.freeze({
  hx: SEKRE_SIZE.width / 2,
  hz: SEKRE_SIZE.length / 2,
  roomLen: SEKRE_SIZE.length / 4,
  corridorHalf: 1.85,
  wallT: 0.15,
  wallTop: 3.75,
  floorY: 0.15,
  selasarY: 0.04,
  plint: 0.6,
  plafonY: 3.3,
  teras: 1.4,
  door: Object.freeze({ w: 0.9, v0: 0.15, v1: 2.25, off: 0.95 }),
  winCorr: Object.freeze({ w: 1.2, v0: 1.1, v1: 2.25, off: 2.75 }),
  winOut: Object.freeze({ w: 1.2, v0: 1.1, v1: 2.25 }),
  winEndX: 4.8,
  roster: Object.freeze({ v0: 2.45, v1: 2.75 }),
  signY: 2.55,
  roof: Object.freeze({ pitch: (20 * Math.PI) / 180, eave: 0.8, gable: 0.6 }),
});

/** rotY agar muka −Z prop menghadap arah (fx, fz). */
export const faceToward = (fx, fz) => Math.atan2(-fx, -fz);

/**
 * Info satu ruang (lokal-gedung). side +1 = baris U (+X), −1 = baris S. outYaw = yaw (konvensi entitas:
 * maju = (sin, cos)) orang yang keluar dari pintu ke selasar.
 */
export function roomInfo(index, dim = SEKRE_DIM) {
  const side = index < 4 ? 1 : -1;
  const col = index % 4;
  const z0 = -dim.hz + col * dim.roomLen;
  return Object.freeze({
    index, side, col, z0, z1: z0 + dim.roomLen,
    doorZ: z0 + dim.door.off,
    winZ: z0 + dim.winCorr.off,
    wallX: side * dim.corridorHalf,
    outYaw: side > 0 ? -Math.PI / 2 : Math.PI / 2,
  });
}

/** Titik lokal-gedung → region-lokal dengan rotY lokal-gedung ditambah yaw gedung. */
const placeSekre = (bx, bz, rotY = 0, extra = {}) => {
  const p = fromSekre(bx, bz);
  return Object.freeze({ x: p.x, z: p.z, rotY: rotY + SEKRE_FRAME.yaw, ...extra });
};

/**
 * Baris motor punggung-ke-punggung di lot poligon (region-lokal). Sumbu baris = sumbu panjang lot
 * (placementFromFootprint) kecuali `axisYaw`. Kandidat diterima bila kedua ujung & sisi motor ≥ `margin`
 * dari tepi lot; `fill` = peluang slot terisi (seed). rows = kapsul collider {a, b, r} per deret menerus.
 * @param {ReadonlyArray<readonly [number, number]>} ring
 */
export function layoutMotorRows(ring, {
  seed = 1, fill = 0.7, pitch = 0.82, length = 1.9, aisle = 3.0, margin = 1.2, axisYaw = null, kindRatio = 0.55,
} = {}) {
  const p = placementFromFootprint(ring);
  const frame = { x: p.x, z: p.z, yaw: axisYaw ?? p.yaw };
  const loc = ring.map(([x, z]) => {
    const l = toLocal(frame, x, z);
    return [l.x, l.z];
  });
  const xs = loc.map((q) => q[0]);
  const zs = loc.map((q) => q[1]);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const ok = (x, z) => pointInPolygon(x, z, loc) && distanceToRing(x, z, loc) >= margin;
  const rnd = createRandom(seed);
  const motors = [];
  const rows = [];
  const toRegionPt = (x, z) => {
    const w = toWorld(frame, x, z);
    return [w.x, w.z];
  };
  const closeRun = (cx, run) => rows.push(Object.freeze({ a: toRegionPt(cx, run.z0), b: toRegionPt(cx, run.z1), r: length / 2 + 0.2 }));
  for (let px = minX + margin + length; px + length + margin <= maxX; px += 2 * length + aisle) {
    for (const side of [-1, 1]) {
      const cx = px + side * (length / 2);
      const noseYaw = faceToward(side, 0) + Math.PI; // hidung menjauhi garis punggung (model menghadap −Z)
      let run = null;
      for (let z = minZ + margin; z <= maxZ - margin + 1e-9; z += pitch) {
        const fits = ok(cx - length / 2, z) && ok(cx + length / 2, z) && ok(cx, z - 0.35) && ok(cx, z + 0.35);
        if (!fits) {
          if (run) closeRun(cx, run);
          run = null;
          continue;
        }
        run = run ? { ...run, z1: z } : { z0: z, z1: z };
        const take = rnd.chance(fill);
        const kind = rnd.chance(kindRatio) ? 'matic' : 'bebek';
        const jitter = rnd.range(-0.12, 0.12);
        if (!take) continue;
        const [x, wz] = toRegionPt(cx, z);
        motors.push(Object.freeze({ x, z: wz, rotY: noseYaw + frame.yaw + jitter, kind }));
      }
      if (run) closeRun(cx, run);
    }
  }
  return { motors, rows };
}

const SEKRE_MOTOR_FILL = 0.85;

/**
 * Teras sekretariat [INFERENSI pola umum]: rak sepatu di bawah jendela selasar, sandal menumpuk di depan
 * pintu, galon kosong di sela pintu–rak, papan pengumuman di mulut barat, jemuran almamater di halaman
 * selatan, pagar besi + 3 spanduk ormawa menghadap jogging track (utara), motor parkir rapat di sisi utara
 * dan kedua mulut selasar, tong sampah, lampu selasar.
 */
export function sekreTerasLayout(rooms = sekreRooms(), { seed = 2026, dim = SEKRE_DIM } = {}) {
  const rnd = createRandom(seed);
  const info = rooms.map((r) => roomInfo(r.index, dim));
  const racks = info.filter((r) => r.index !== 3 && r.index !== 6)
    .map((r) => placeSekre(r.side * (dim.corridorHalf - 0.175 - 0.03), r.winZ, faceToward(-r.side, 0), { room: r.index }));
  const sandals = info.flatMap((r) => {
    const base = placeSekre(r.side * (dim.corridorHalf - 0.42), r.doorZ + rnd.range(-0.12, 0.12), faceToward(-r.side, 0) + rnd.range(-0.4, 0.4), { room: r.index });
    const extra = [0, 1, 4].includes(r.index)
      ? [placeSekre(r.side * (dim.corridorHalf - 0.62), r.doorZ + 0.35, rnd.range(-Math.PI, Math.PI), { room: r.index })]
      : [];
    return [base, ...extra];
  });
  const galons = [
    ...info.filter((r) => [0, 1, 5].includes(r.index)).flatMap((r) => [1.6, 1.92].map((dz) => placeSekre(r.side * (dim.corridorHalf - 0.2), r.z0 + dz, rnd.range(0, Math.PI)))),
    ...[-3.6, -3.3, -3.0, -3.45].map((bx, k) => placeSekre(bx, dim.hz + 0.6 + (k === 3 ? 0.28 : 0), rnd.range(0, Math.PI))),
  ];
  const fenceX = dim.hx + 4.6;
  const fenceZ = dim.hz + 2;
  const gate = 1.6;
  const fence = fenceRuns({ from: [fenceX, -fenceZ], to: [fenceX, fenceZ], gaps: [{ at: fenceZ, width: 2 * gate }], postSpacing: 2.4, r: 0.25 });
  const fenceSegments = fence.segments.map(({ a, b, r }) => {
    const pa = fromSekre(a[0], a[1]);
    const pb = fromSekre(b[0], b[1]);
    return Object.freeze({ a: [pa.x, pa.z], b: [pb.x, pb.z], r });
  });
  const fencePosts = fence.posts.map(([bx, bz]) => placeSekre(bx, bz));
  const motors = [];
  const pushMotor = (bx, bz, noseX, noseZ) => {
    if (!rnd.chance(SEKRE_MOTOR_FILL)) return;
    const kind = rnd.chance(0.55) ? 'matic' : 'bebek';
    motors.push(placeSekre(bx, bz, faceToward(noseX, noseZ) + rnd.range(-0.08, 0.08), { kind }));
  };
  for (const bz of evenSteps(-dim.hz + 0.8, dim.hz - 0.8, 0.85)) {
    if (Math.abs(bz) > 1.2) pushMotor(dim.hx + 1.45, bz, -1, 0);
  }
  for (const bx of evenSteps(2.6, 7.0, 0.88)) {
    pushMotor(-bx, -(dim.hz + 2.55), 0, 1);
    pushMotor(bx, dim.hz + 2.55, 0, -1);
  }
  const lamps = rowPoints({ from: [0, -1.5 * dim.roomLen], dir: [0, 1], count: 4, step: dim.roomLen }).map(([bx, bz]) => Object.freeze({ bx, bz, y: dim.plafonY }));
  const mouthLamps = [-1, 1].map((s) => Object.freeze({ bx: 0, bz: s * (dim.hz + 0.1), y: 3.15 })); // lampu dinding di muka balok ambang mulut selasar
  return Object.freeze({
    racks, sandals, galons, motors, lamps, mouthLamps, fenceSegments, fencePosts,
    fence: Object.freeze({ x: fenceX, z0: -fenceZ, z1: fenceZ, gate }),
    board: placeSekre(2.9, -(dim.hz + 0.9), faceToward(0, -1)),
    jemuran: placeSekre(-(dim.hx + 2.4), 4.0, Math.PI / 2),
    spanduk: [-7.6, -3.5, 4.2].map((bz, k) => placeSekre(fenceX + 0.05, bz, faceToward(1, 0), { cell: `spanduk:${k}` })),
    trashBins: [placeSekre(-2.6, -(dim.hz + 1.0), 0, { kind: 'hijau' }), placeSekre(2.6, dim.hz + 1.0, 0, { kind: 'biru' })],
    pju: [placeSekre(fenceX + 1.2, -9.5), placeSekre(fenceX + 1.2, 9.5)],
  });
}

/** Titik dunia → objek region-lokal. */
const atWorld = (x, z, rotY = 0, extra = {}) => {
  const [lx, lz] = toRegion(x, z);
  return Object.freeze({ x: lx, z: lz, rotY, ...extra });
};

const teras = sekreTerasLayout();
const spawn = fromSekre(0, -(SEKRE_DIM.hz + 5));
const spawnWorld = regionToWorld(spawn.x, spawn.z);

/** Tata letak seluruh zona (region-lokal kecuali `spawnDev` = DUNIA). */
export const LEMBAGA_LAYOUT = Object.freeze({
  rooms: sekreRooms(),
  teras,
  lots: Object.freeze({
    stadionMini: layoutMotorRows(FOOTPRINTS.parkirStadionMini, { seed: 41, fill: 0.35 }), // ±270 motor siang
    rusunawa: layoutMotorRows(FOOTPRINTS.parkirRusunawa, { seed: 43, fill: 0.3 }), // ±150 motor
  }),
  /** PJU 9 m (LampPost) yang menyala: 2 di pagar sekretariat, 1 di parkir stadion mini, 1 di parkir rusunawa. */
  pju: Object.freeze([...teras.pju, atWorld(-318.5, 966.0), atWorld(60, 787.0)]),
  rusun: Object.freeze({
    sign: atWorld(15.0, 812.5, faceToward(-1, 0)),
    guardPost: atWorld(14.0, 799.0, -Math.PI / 2),
    jemuran: Object.freeze(rowPoints({ from: [40, 846], dir: [1, 0], count: 4, step: 12 }).map(([x, z]) => atWorld(x, z, 0))),
    trashBins: Object.freeze([atWorld(24, 816, 0, { kind: 'hijau' }), atWorld(27, 816, 0, { kind: 'biru' })]),
  }),
  fh: Object.freeze({
    // pagar seng halaman FH (dunia): sisi selatan x −106…−60 (celah pintu di −90…−84) dan sisi barat z 614…578 (celah 592…586)
    fences: Object.freeze([
      fenceRuns({ from: [-106, 616.5], to: [-60, 616.5], gaps: [{ at: 19, width: 6 }], r: 0.3 }),
      fenceRuns({ from: [-107, 614], to: [-107, 578], gaps: [{ at: 25, width: 6 }], r: 0.3 }),
    ].flatMap((f) => f.segments).map(({ a, b, r }) => Object.freeze({ a: toRegion(a[0], a[1]), b: toRegion(b[0], b[1]), r }))),
    plang: atWorld(-86.5, 619.5, faceToward(0, 1)),
    mounds: Object.freeze([atWorld(-70, 622, 0, { r: 1.6 }), atWorld(-63, 625, 0, { r: 1.2 }), atWorld(-27, 600, 0, { r: 2.0 })]),
  }),
  /** Titik muncul perjalanan cepat dev (DUNIA): 5 m di depan mulut selasar barat, menghadap ESE. */
  spawnDev: Object.freeze({ x: spawnWorld.x, z: spawnWorld.z, yaw: SEKRE_FRAME.yaw }),
});
