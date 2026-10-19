/**
 * H01 hero:sekretariat-lembaga — Sekretariat Lembaga Mahasiswa (way 327530276), handmade (spec §8.1).
 * Fakta: footprint OSM 16,77 × 15,57 m, satu gedung (T). Inferensi: 1 lantai, 2 baris × 4 ruang, selasar
 * tengah 3,7 m terbuka di kedua ujung, dinding plester krem dengan plint abu, pilaster & balok ring putih,
 * jendela nako + roster, pintu panel bercat warna ormawa, papan nama di atas pintu, stiker, atap pelana seng
 * dengan talang, plafon selasar, lampu bohlam selasar + lampu dinding di mulut selasar, keramik krem.
 * Koordinat lokal-gedung (SEKRE_FRAME): +Z = sumbu panjang (ESE), +X = baris U (NNE).
 */
import * as THREE from 'three';
import { RENDER_LAYERS } from '../../config/constants.js';
import { mergeAll } from '../../world/siteutil/rounded.js';
import { quad } from '../../world/props/unri/geom.js';
import { createPapanNamaSekre } from '../../world/props/unri/papanNamaSekre.js';
import { SEKRE_FRAME } from './placement.js';
import { SEKRE_DIM, roomInfo, faceToward, LEMBAGA_LAYOUT } from './layout.js';
import { wallSegments, clipOpenings, wallBoxes } from './sekretariat.walls.js';
import {
  placeGeos, nakoWindow, windowSill, panelDoor, rosterPlane, ceilingLamp, lintelLamp, floorPool,
} from './sekretariat.parts.js';
import { roofGeometries, gableGeometries } from './sekretariat.roof.js';
import { STICKERS } from './sekretariat.atlas.js';
import { staged, meshesByMaterial } from './staged.js';

const bucket = () => new Map();
const add = (map, mat, geos) => map.set(mat, [...(map.get(mat) ?? []), ...geos]);

const winAndRoster = (uc, win, dim) => [
  { u0: uc - win.w / 2, u1: uc + win.w / 2, v0: win.v0, v1: win.v1, kind: 'jendela' },
  { u0: uc - win.w / 2, u1: uc + win.w / 2, v0: dim.roster.v0, v1: dim.roster.v1, kind: 'roster' },
];

/**
 * Spesifikasi 8 dinding (lokal-gedung). out = normal muka yang terlihat; faceAt = koordinat muka itu.
 * Ruang: baris U (side +1) indeks 0–3, baris S (side −1) indeks 4–7.
 */
export function wallSpecs(dim = SEKRE_DIM) {
  const t = dim.wallT;
  const centers = [0, 1, 2, 3].map((c) => -dim.hz + (c + 0.5) * dim.roomLen);
  const specs = [];
  for (const side of [1, -1]) {
    specs.push({
      id: `luar${side}`, axis: 'z', at: side * (dim.hx - t / 2), from: -dim.hz, length: 2 * dim.hz, faceAt: side * dim.hx, out: [side, 0],
      openings: centers.flatMap((zc) => winAndRoster(zc + dim.hz, dim.winOut, dim)),
    });
    specs.push({
      id: `selasar${side}`, axis: 'z', at: side * (dim.corridorHalf + t / 2), from: -dim.hz, length: 2 * dim.hz, faceAt: side * dim.corridorHalf, out: [-side, 0],
      openings: [0, 1, 2, 3].flatMap((c) => {
        const r = roomInfo(side > 0 ? c : c + 4, dim);
        const door = { u0: r.doorZ + dim.hz - dim.door.w / 2, u1: r.doorZ + dim.hz + dim.door.w / 2, v0: dim.door.v0, v1: dim.door.v1, kind: 'pintu', room: r.index };
        return [door, ...winAndRoster(r.winZ + dim.hz, dim.winCorr, dim)];
      }),
    });
    for (const sz of [1, -1]) {
      const from = side > 0 ? dim.corridorHalf + t : -(dim.hx - t);
      specs.push({
        id: `ujung${side}${sz}`, axis: 'x', at: sz * (dim.hz - t / 2), from, length: dim.hx - dim.corridorHalf - 2 * t, faceAt: sz * dim.hz, out: [0, sz],
        openings: winAndRoster(side * dim.winEndX - from, dim.winOut, dim),
      });
    }
  }
  return specs;
}

/** Titik tengah bukaan (lokal-gedung) + rotY muka depan bagian kanonik. */
function openingPose(spec, o) {
  const uc = spec.from + (o.u0 + o.u1) / 2;
  const [x, z] = spec.axis === 'z' ? [spec.at, uc] : [uc, spec.at];
  return { x, y: o.v0, z, rotY: faceToward(spec.out[0], spec.out[1]) };
}

function wallsStep(mats, dim) {
  const m = bucket();
  const t = dim.wallT;
  for (const s of wallSpecs(dim)) {
    add(m, mats.dinding, wallBoxes(wallSegments(s.length, dim.wallTop, s.openings), { axis: s.axis, at: s.at, from: s.from, thickness: t }));
    const bandAt = s.faceAt + (s.axis === 'z' ? s.out[0] : s.out[1]) * 0.01;
    const band = wallSegments(s.length, dim.plint, clipOpenings(s.openings, dim.plint));
    add(m, mats.plint, wallBoxes(band, { axis: s.axis, at: bandAt, from: s.from, thickness: 0.02 }));
  }
  const putih = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      putih.push(new THREE.BoxGeometry(0.3, dim.wallTop, 0.3).translate(sx * (dim.hx - 0.1), dim.wallTop / 2, sz * (dim.hz - 0.1)));
      putih.push(new THREE.BoxGeometry(0.3, dim.wallTop, 0.3).translate(sx * (dim.corridorHalf + 0.1), dim.wallTop / 2, sz * (dim.hz - 0.1)));
      putih.push(new THREE.BoxGeometry(2 * dim.hx + 0.06, 0.35, 0.03).translate(0, 3.575, sz * (dim.hz + 0.015)));
    }
    for (let k = 1; k <= 3; k += 1) putih.push(new THREE.BoxGeometry(0.05, dim.wallTop, 0.25).translate(sx * (dim.hx + 0.025), dim.wallTop / 2, -dim.hz + k * dim.roomLen));
    putih.push(new THREE.BoxGeometry(0.03, 0.35, 2 * dim.hz).translate(sx * (dim.hx + 0.015), 3.575, 0));
  }
  add(m, mats.putih, putih);
  const lintel = [-1, 1].map((sz) => new THREE.BoxGeometry(2 * dim.corridorHalf, dim.wallTop - dim.plafonY, t).translate(0, (dim.wallTop + dim.plafonY) / 2, sz * (dim.hz - t / 2)));
  const gable = gableGeometries(dim);
  add(m, mats.dinding, [...lintel, ...gable.walls]);
  add(m, mats.roster, gable.vents);
  return meshesByMaterial('H01-dinding', [...m], { cast: true });
}

function stickersFor(index) {
  const a = (index * 5) % STICKERS.length;
  const b = (index * 5 + 7) % STICKERS.length;
  return [
    { id: `stiker:${a}`, x: -0.18, y: 1.45, size: 0.16 },
    { id: `stiker:${b}`, x: 0.12, y: 1.62, size: 0.12 },
    ...(index % 2 === 0 ? [{ id: `stiker:${(a + 3) % STICKERS.length}`, x: 0.02, y: 0.95, size: 0.14 }] : []),
  ];
}

function openingsStep(mats, atlas, rooms, dim) {
  const m = bucket();
  const signs = [];
  for (const spec of wallSpecs(dim)) {
    for (const o of spec.openings) {
      const pose = openingPose(spec, o);
      const w = o.u1 - o.u0;
      const h = o.v1 - o.v0;
      if (o.kind === 'jendela') {
        const win = nakoWindow(w, h);
        add(m, mats.alu, placeGeos(win.frame, pose));
        add(m, mats.kaca, placeGeos(win.glass, pose));
        add(m, mats.gelap, placeGeos(win.dark, pose));
        if (!spec.id.startsWith('selasar')) add(m, mats.putih, placeGeos(windowSill(w), pose));
      } else if (o.kind === 'roster') {
        add(m, mats.roster, placeGeos([rosterPlane(w, h)], pose));
      } else if (o.kind === 'pintu') {
        const room = rooms[o.room];
        const door = panelDoor({
          w, h, color: room.pintu,
          stickers: stickersFor(room.index).map((s) => ({ ...s, cell: atlas.cell(s.id) })),
        });
        add(m, mats.pintu, placeGeos(door.leaf, pose));
        add(m, mats.kusen, placeGeos(door.kusen, pose));
        add(m, mats.alu, placeGeos(door.handle, pose));
        add(m, mats.atlas, placeGeos(door.decals, pose));
        const sign = createPapanNamaSekre({ cell: atlas.cell(`sign:${room.index}`), faceMaterial: mats.atlas, frameMaterial: mats.kusen });
        sign.position.set(spec.faceAt + spec.out[0] * 0.03, dim.signY, pose.z);
        sign.rotation.y = pose.rotY;
        signs.push(sign);
      }
    }
  }
  const g = meshesByMaterial('H01-bukaan', [...m]);
  g.add(...signs);
  return g;
}

function roofStep(mats, dim) {
  const r = roofGeometries(dim);
  const roof = meshesByMaterial('H01-atap', [[mats.seng, r.seng]], { cast: true, minimap: true, layer: RENDER_LAYERS.minimap });
  const rest = meshesByMaterial('H01-atap-detail', [[mats.talang, r.talang], [mats.putih, r.putih], [mats.plafon, r.plafon]]);
  return [roof, rest];
}

function lampsStep(mats, dim, teras) {
  const putih = [];
  const lampu = [];
  const pools = [];
  for (const l of teras.lamps) {
    const f = ceilingLamp(l.bx, l.y, l.bz);
    putih.push(...f.putih);
    lampu.push(...f.lampu);
    pools.push(floorPool(l.bx, dim.selasarY + 0.012, l.bz, 3.2));
  }
  for (const l of teras.mouthLamps) {
    const f = lintelLamp(l.bz, l.y, Math.sign(l.bz));
    putih.push(...f.putih);
    lampu.push(...f.lampu);
    pools.push(floorPool(0, dim.selasarY + 0.014, Math.sign(l.bz) * (dim.hz + 0.7), 2.4)); // di atas keramik teras
  }
  return meshesByMaterial('H01-lampu', [[mats.putih, putih], [mats.lampu, lampu], [mats.kolam, pools]]);
}

/**
 * Rakitan bertahap H01 (4 langkah + finish). baseY = tinggi pad (heightAtLocal di pusat gedung).
 * @param {{baseY:number, mats:object, atlas:object, rooms?:object[], dim?:object, teras?:object}} opts
 */
export function createSekretariatBuilder({ baseY, mats, atlas, rooms = LEMBAGA_LAYOUT.rooms, dim = SEKRE_DIM, teras = LEMBAGA_LAYOUT.teras }) {
  return staged('H01-sekretariat-lembaga', [
    () => wallsStep(mats, dim),
    () => openingsStep(mats, atlas, rooms, dim),
    () => roofStep(mats, dim),
    () => lampsStep(mats, dim, teras),
  ], { x: SEKRE_FRAME.x, y: baseY, z: SEKRE_FRAME.z, yaw: SEKRE_FRAME.yaw });
}

/** Quad lantai menghadap +Y, UV meter. */
const floor = (x0, x1, z0, z1, y) => quad([[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]]);

/**
 * Permukaan basah sinkron (dibangun di build(), sebelum registerWet saat mount): keramik selasar + teras
 * ujung ('plazaPaving'), rabat beton keliling sisi panjang ('trotoar').
 */
export function createSekreSurfaces({ baseY, mats, dim = SEKRE_DIM }) {
  const g = new THREE.Group();
  g.name = 'H01-permukaan';
  g.position.set(SEKRE_FRAME.x, baseY, SEKRE_FRAME.z);
  g.rotation.y = SEKRE_FRAME.yaw;
  const c = dim.corridorHalf;
  const ex = dim.hx + 0.3;
  const tz = dim.hz + dim.teras;
  const y = dim.selasarY;
  const keramik = mergeAll([floor(-c, c, -dim.hz, dim.hz, y), floor(-ex, ex, dim.hz, tz, y), floor(-ex, ex, -tz, -dim.hz, y)]);
  const rabat = mergeAll([floor(dim.hx, dim.hx + 0.6, -dim.hz, dim.hz, 0.03), floor(-dim.hx - 0.6, -dim.hx, -dim.hz, dim.hz, 0.03)]);
  const k = new THREE.Mesh(keramik, mats.keramik);
  k.name = 'plazaPaving';
  k.receiveShadow = true;
  const r = new THREE.Mesh(rabat, mats.rabat);
  r.name = 'trotoar';
  r.receiveShadow = true;
  g.add(k, r);
  return g;
}
