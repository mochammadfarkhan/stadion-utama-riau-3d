import * as THREE from 'three';
import { STADIUM } from '../config/constants.js';
import { createGround } from './Ground.js';
import { createLandscape } from './Landscape.js';
import { createShell } from './stadium/Shell.js';
import { createFacade } from './stadium/Facade.js';
import { createTribune } from './stadium/Tribune.js';
import { createPitch } from './stadium/Pitch.js';
import { createTrack } from './stadium/Track.js';
import { createFixtures } from './stadium/Fixtures.js';
import { createFlagpoles } from './props/Flagpole.js';
import { createGuardPosts } from './props/GuardPost.js';
import { createFence } from './props/Fence.js';
import { createRoadSign, createBanner } from './props/Signage.js';
import { createBenches } from './props/Bench.js';
import { createTrashBins } from './props/TrashBin.js';
import { createLampPosts } from './props/LampPost.js';
import { createPlanters } from './props/Planter.js';
import { createLancangKuning, createTanjakMonument } from './props/Monument.js';
import { createGapura } from './props/Gapura.js';
import { createParkedCars, createParkedMotorcycles, pickParkingSpots } from './props/Vehicles.js';
import { createCart, createUmbrellaSet, createFoodStall } from './props/Cart.js';
import { LAYOUT } from './layout.js';

const ROW_DEPTH = STADIUM.rowDepth;
const SEAT_INSET = 0.45;
const SPECTATOR_SEED = 97;

/**
 * Merakit seluruh dunia statis.
 * @returns {{group: THREE.Group, update(dt:number, t:number):void, seatSamples: object[], layout: object}}
 */
export function buildWorld() {
  const group = new THREE.Group();
  group.name = 'world';
  const updatables = [];
  const add = (obj) => {
    group.add(obj);
    if (obj.userData?.update) updatables.push(obj.userData.update);
    return obj;
  };

  const ground = add(createGround());
  add(createLandscape());
  add(createShell());
  add(createFacade());
  const tribune = add(createTribune());
  add(createPitch());
  add(createTrack());
  add(createFixtures());
  addStadiumSurroundings(add);
  addPlazaFurniture(add);
  addNagaSakti(add);
  addParking(add, ground);

  const seatSamples = sampleSeats(tribune.userData.tiers, LAYOUT.spectatorCount);
  return {
    group,
    seatSamples,
    layout: LAYOUT,
    update: (dt, t) => updatables.forEach((fn) => fn(dt, t)),
  };
}

function addStadiumSurroundings(add) {
  add(createFlagpoles());
  add(createLancangKuning());
  add(createTanjakMonument());
  add(createGapura({ damaged: true }));
  add(createGuardPosts(LAYOUT.guardPosts));
  for (const s of LAYOUT.roadSigns) add(placed(createRoadSign({ text: s.text, kind: s.kind }), s));
  for (const b of LAYOUT.banners) add(placed(createBanner({ text: b.text }), b));
}

function addPlazaFurniture(add) {
  add(createBenches(LAYOUT.benches.map((p, i) => ({ ...p, type: i % 3 === 0 ? 'besi' : 'semen' }))));
  add(createTrashBins(LAYOUT.trashBins));
  add(createPlanters(LAYOUT.planters));
  add(createLampPosts(LAYOUT.plazaLamps.map((p, i) => ({ ...p, broken: i % 7 === 3 }))));
  add(createLampPosts(LAYOUT.ringRoadLamps.map((p, i) => ({ ...p, double: true, broken: i % 9 === 4 }))));
}

function addNagaSakti(add) {
  add(createLampPosts(LAYOUT.nagaSaktiLamps));
  for (const seg of LAYOUT.nagaSaktiFence) {
    add(createFence({ points: [{ x: seg.from, z: seg.z }, { x: seg.to, z: seg.z }], height: 2 }));
  }
  LAYOUT.stalls.forEach((p, i) => add(placed(stallFor(i), p)));
}

/** Variasi lapak PKL berselang-seling di trotoar Naga Sakti. */
function stallFor(i) {
  switch (i % 4) {
    case 0: return createCart({ kind: 'minuman' });
    case 1: return createUmbrellaSet();
    case 2: return createFoodStall();
    default: return createCart({ kind: 'buah' });
  }
}

function addParking(add, ground) {
  const lots = [];
  ground.traverse((o) => { if (o.userData?.bays) lots.push(o); });
  for (const lot of lots) {
    const bays = lot.userData.bays;
    const isMoto = Math.abs(lot.position.x) > 100 || (bays[0] && bays[0].x > 100);
    const spots = pickParkingSpots(bays, isMoto ? 0.5 : 0.45, isMoto ? 5 : 3);
    add(isMoto ? createParkedMotorcycles(spots) : createParkedCars(spots));
  }
}

function placed(obj, p) {
  obj.position.set(p.x, p.y ?? 0, p.z);
  obj.rotation.y = p.rotY ?? 0;
  return obj;
}

/** Sampel posisi penonton acak di tread kursi (deterministik). */
function sampleSeats(tiers, count) {
  const rng = mulberry(SPECTATOR_SEED);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const tier = tiers[rng() < 0.45 ? 0 : 1];
    const row = Math.floor(rng() * tier.rows);
    const th = rng() * Math.PI * 2;
    const offset = tier.offset0 + row * ROW_DEPTH + SEAT_INSET;
    const x = (STADIUM.innerSemiX + offset) * Math.cos(th);
    const z = (STADIUM.innerSemiZ + offset) * Math.sin(th);
    const y = tier.y0 + (row + 1) * tier.rise;
    out.push({ x, y, z, yaw: Math.atan2(-x, -z) });
  }
  return out;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
