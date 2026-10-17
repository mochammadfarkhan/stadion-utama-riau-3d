import * as THREE from 'three';
import { pointInPolygon } from '../geo/polygon.js';
import { RENDER_LAYERS, STADIUM, SITE } from '../config/constants.js';
import { createGround } from './Ground.js';
import { createLandscape } from './Landscape.js';
import { createGrass } from './Grass.js';
import { createDecals } from './Decals.js';
import { createShell } from './stadium/Shell.js';
import { createFacade } from './stadium/Facade.js';
import { createTribune } from './stadium/Tribune.js';
import { createPitch } from './stadium/Pitch.js';
import { createTrack } from './stadium/Track.js';
import { createFixtures } from './stadium/Fixtures.js';
import { createSerinditStatue } from './stadium/Fixtures.props.js';
import { createTunnels } from './stadium/Tunnels.js';
import { createFlagpoles } from './props/Flagpole.js';
import { createGuardPosts } from './props/GuardPost.js';
import { createRoadSign, createBanner, createBillboard } from './props/Signage.js';
import { createBenches } from './props/Bench.js';
import { createTrashBins } from './props/TrashBin.js';
import { createLampPosts } from './props/LampPost.js';
import { createPlanters } from './props/Planter.js';
import { createLancangKuning, createTanjakMonument } from './props/Monument.js';
import { createGapura } from './props/Gapura.js';
import { createParkedCars, createParkedMotorcycles, pickParkingSpots } from './props/Vehicles.js';
import { mergeByMaterial } from './util/merge.js';
import { distanceToGateCorridor } from './stadium/gateCorridor.js';

const ROW_DEPTH = STADIUM.rowDepth;
const SEAT_INSET = 0.45;
const SPECTATOR_SEED = 97;
const CORRIDOR_CLEARANCE = 7; // penonton tidak ditempatkan di koridor terowongan
const MINIMAP_SHELL_PARTS = ['roof', 'ribs'];
const MINIMAP_TRIBUNE_PARTS = ['beton'];

/**
 * Merakit seluruh dunia statis region stadion. Setiap bagian statis digabung per material
 * (mergeByMaterial) agar jumlah draw call minimal; objek besar diberi layer minimap agar tampil
 * di peta kecil. `layout` WAJIB dari region (regions/stadion/layout.js); `site` default = SITE.
 * `mask` (region-lokal): tanah berbentuk mask dan vegetasi/rumput hanya di dalam mask (di luar = kota).
 * @param {{layout: object, site?: object, mask?: Array<[number, number]>|null}} opts
 * @returns {{group: THREE.Group, update(dt:number, t:number, focus?:object):void, seatSamples: object[], layout: object}}
 */
export function buildWorld({ layout, site = SITE, mask = null } = {}) {
  if (!layout) throw new TypeError('buildWorld: layout wajib (diberikan region)');
  const keep = mask ? (x, z) => pointInPolygon(x, z, mask) : () => true;
  const group = new THREE.Group();
  group.name = 'world';
  const updatables = [];
  const add = (obj, { merge = true, minimap = false } = {}) => {
    const out = merge ? mergeByMaterial(obj) : obj;
    if (minimap) enableMinimap(out);
    group.add(out);
    if (out.userData?.update) updatables.push(out.userData.update);
    return out;
  };

  const ground = createGround({ outline: mask });
  const lots = collectParkingLots(ground);
  add(ground, { minimap: true });
  add(createLandscape({ keep }));
  add(createGrass({ keep }), { merge: false });
  add(withMinimapParts(createShell(), MINIMAP_SHELL_PARTS));
  add(createFacade());
  const tribune = add(withMinimapParts(createTribune(), MINIMAP_TRIBUNE_PARTS), { merge: false });
  add(createPitch(), { minimap: true });
  add(createTrack(), { minimap: true });
  add(createDecals(), { merge: false }); // dekal permukaan: 1 InstancedMesh, bukan layer minimap
  add(createFixtures());
  add(createSerinditStatue()); // terpisah dari fixtures agar namanya terjaga: model Blender menggantikannya (layout.blenderModels)
  add(createTunnels());
  addStadiumSurroundings(add, layout, site);
  addPlazaFurniture(add, layout);
  addParking(add, lots);

  const seatSamples = sampleSeats(tribune.userData.tiers, layout.spectatorCount);
  return {
    group,
    seatSamples,
    layout,
    update: (dt, t, focus) => updatables.forEach((fn) => fn(dt, t, focus)),
  };
}

/** Aktifkan layer minimap pada obj & seluruh turunannya (layer utama tetap aktif). */
function enableMinimap(obj) {
  obj.traverse((o) => o.layers.enable(RENDER_LAYERS.minimap));
  return obj;
}

/** Aktifkan layer minimap hanya pada anak bernama tertentu (sebelum digabung). */
function withMinimapParts(obj, names) {
  names.forEach((n) => {
    const part = obj.getObjectByName(n);
    if (part) enableMinimap(part);
  });
  return obj;
}

/** Blok parkir (userData.bays) harus dibaca sebelum ground digabung. */
function collectParkingLots(ground) {
  const lots = [];
  ground.traverse((o) => { if (o.userData?.bays) lots.push(o); });
  return lots;
}

function addStadiumSurroundings(add, layout, site) {
  add(createFlagpoles());
  add(createLancangKuning({ x: site.tugu.x, z: site.tugu.z }));
  add(createTanjakMonument({ x: site.tanjakMonument.x, z: site.tanjakMonument.z }));
  add(createGapura({ damaged: true }));
  add(createGuardPosts(layout.guardPosts));
  const signs = new THREE.Group();
  signs.name = 'signage';
  for (const s of layout.roadSigns) signs.add(placed(createRoadSign({ text: s.text, kind: s.kind }), s));
  for (const b of layout.banners) signs.add(placed(createBanner({ text: b.text }), b));
  for (const b of layout.billboards) signs.add(placed(createBillboard({ text: b.text }), b));
  add(signs);
}

function addPlazaFurniture(add, layout) {
  add(createBenches(layout.benches.map((p, i) => ({ ...p, type: i % 3 === 0 ? 'besi' : 'semen' }))));
  add(createTrashBins(layout.trashBins));
  add(createPlanters(layout.planters));
  // Semua tiang PJU dalam satu panggilan agar instanced per varian (bukan per area)
  add(createLampPosts([
    ...layout.plazaLamps,
    ...layout.ringRoadLamps.map((p) => ({ ...p, double: true })),
  ]));
}

function addParking(add, lots) {
  for (const lot of lots) {
    const bays = lot.userData.bays;
    const isMoto = Math.abs(lot.position.x) > 100 || (bays[0] && bays[0].x > 100);
    const spots = pickParkingSpots(bays, isMoto ? 0.5 : 0.45, isMoto ? 5 : 3);
    add(isMoto ? createParkedMotorcycles(spots) : createParkedCars(spots), { merge: false });
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
    if (distanceToGateCorridor(x, z) < CORRIDOR_CLEARANCE) continue;
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
