import * as THREE from 'three';
import { Bicycle } from './Bicycle.js';
import { RunnerGroup, LoopWalkers } from './Runner.js';
import { FootballMatch } from './Footballer.js';
import { VendorGroup } from './Vendor.js';
import { Crowd } from './Crowd.js';

/**
 * Merakit semua entitas bergerak.
 * @param {{start:{x:number,z:number,yaw:number}, world:{seatSamples:object[], layout:object}, wallet:object}} opts
 */
export function buildEntities({ start, world, wallet }) {
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

  return { group, bike, runners, walkers, match, vendors, crowd, updatables };
}
