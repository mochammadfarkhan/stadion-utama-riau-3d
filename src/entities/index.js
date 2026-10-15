import * as THREE from 'three';
import { Bicycle } from './Bicycle.js';
import { RunnerGroup, LoopWalkers } from './Runner.js';
import { FootballMatch } from './Footballer.js';
import { VendorGroup } from './Vendor.js';
import { Crowd } from './Crowd.js';
import { createHumanoidLod } from './Humanoid.lod.js';

/**
 * Merakit semua entitas bergerak.
 * @param {{start:{x:number,z:number,yaw:number}, world:{seatSamples:object[], layout:object}, wallet:object,
 *   camera?:import('three').Camera}} opts  camera: dipakai LOD humanoid (jarak ke kamera)
 */
export function buildEntities({ start, world, wallet, camera }) {
  const group = new THREE.Group();
  group.name = 'entities';
  const { layout } = world;

  const bike = new Bicycle({ x: start.x, z: start.z, yaw: start.yaw, frameColor: 0x1d4e89 });
  const runners = new RunnerGroup({ count: 8 });
  const walkers = layout.loopWalkers.map((cfg, i) => new LoopWalkers({ ...cfg, seed: 23 + i }));
  const match = new FootballMatch({ teamSize: 5 });
  const vendors = new VendorGroup({ vendors: layout.vendors, wallet });
  const crowd = new Crowd({
    seatSamples: world.seatSamples,
    plazaCenter: layout.plazaCenter,
    plazaSpots: layout.plazaSpots,
    count: 20,
  });

  const updatables = [bike, runners, ...walkers, match, vendors, crowd];
  for (const e of updatables) group.add(e.group);

  // LOD humanoid: detail penuh dekat kamera, satu mesh gabungan di jarak menengah, sembunyi di jauh.
  const lod = createHumanoidLod();
  lod.addFrom(group);
  if (camera) updatables.push({ update: () => lod.update(camera.position) });

  return { group, bike, runners, walkers, match, vendors, crowd, updatables, lod };
}
