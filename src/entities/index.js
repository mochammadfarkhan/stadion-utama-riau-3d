import * as THREE from 'three';
import { Bicycle } from './Bicycle.js';
import { RunnerGroup, LoopWalkers } from './Runner.js';
import { FootballMatch } from './Footballer.js';
import { VendorGroup } from './Vendor.js';
import { Crowd } from './Crowd.js';
import { createHumanoidLod } from './Humanoid.lod.js';
import { ORANG_LOD } from './Orang.js';

const _p = new THREE.Vector3();

/**
 * Sembunyikan orang paket (`orang:*`) yang jauh dari kamera. Mesh-nya `frustumCulled = false` (bola pembatas SkinnedMesh
 * tidak ikut pose) dan tidak dikenal LOD humanoid lama, jadi tanpa ini SEMUA orang region tetap digambar (juga ke peta
 * bayangan) walau kamera berkilometer jauhnya: 79 draw call terbuang saat pemain di Masjid An-Nur (diukur 2026-11-26).
 * Histeresis 15% agar tidak berkedip di batas. Posisi diambil dari induk (grup orang), bukan root yang matriksnya dibekukan saat sembunyi.
 * @param {THREE.Object3D[]} roots @param {THREE.Vector3} camPos @param {number} [far]
 * @returns {{total:number, visible:number}}
 */
export function cullOrangByDistance(roots, camPos, far = ORANG_LOD.far) {
  let total = 0;
  let visible = 0;
  for (const root of roots) {
    root.traverse((o) => {
      if (!o.name?.startsWith('orang:')) return;
      total += 1;
      const d = (o.parent ?? o).getWorldPosition(_p).distanceTo(camPos);
      o.visible = d <= (o.visible ? far * 1.15 : far);
      if (o.visible) visible += 1;
    });
  }
  return { total, visible };
}

/**
 * Merakit semua entitas bergerak. Sepeda hidup di koordinat DUNIA (`group`); entitas region
 * (pelari, pemain bola, pedagang, penonton) di koordinat region-lokal (`regionGroup`, dipasang di
 * bawah grup ber-placement oleh composition root).
 * @param {{start:{x:number,z:number,yaw:number}, world:{seatSamples:object[], layout:object}, wallet:object,
 *   camera?:import('three').Camera, extraVendors?:object[]}} opts  start: posisi DUNIA sepeda; camera: dipakai LOD humanoid;
 *   extraVendors: pedagang tambahan di luar layout region (M7: Kantin FKIP)
 * @returns {{group: THREE.Group, regionGroup: THREE.Group, bike: Bicycle, runners: RunnerGroup,
 *   walkers: LoopWalkers[], match: FootballMatch, vendors: VendorGroup, crowd: Crowd,
 *   updatables: Array<{update(dt:number, ctx:object):void}>, lod: object}}
 */
export function buildEntities({ start, world, wallet, camera, extraVendors = [] }) {
  const group = new THREE.Group();
  group.name = 'entities';
  const regionGroup = new THREE.Group();
  regionGroup.name = 'entitasRegion';
  const { layout } = world;

  const bike = new Bicycle({ x: start.x, z: start.z, yaw: start.yaw, frameColor: 0x1d4e89 });
  const runners = new RunnerGroup({ count: 8 });
  const walkers = layout.loopWalkers.map((cfg, i) => new LoopWalkers({ ...cfg, seed: 23 + i }));
  const match = new FootballMatch({ teamSize: 5 });
  const vendors = new VendorGroup({ vendors: [...layout.vendors, ...extraVendors], wallet });
  const crowd = new Crowd({
    seatSamples: world.seatSamples,
    plazaCenter: layout.plazaCenter,
    plazaSpots: layout.plazaSpots,
    count: 20,
  });

  const updatables = [bike, runners, ...walkers, match, vendors, crowd];
  group.add(bike.group);
  for (const e of updatables) if (e !== bike) regionGroup.add(e.group);

  // LOD humanoid: detail penuh dekat kamera, satu mesh gabungan di jarak menengah, sembunyi di jauh.
  const lod = createHumanoidLod();
  lod.addFrom(group);
  lod.addFrom(regionGroup);
  if (camera) updatables.push({ update: () => lod.update(camera.position) });
  let cullTick = 0;
  if (camera) updatables.push({ update: () => { cullTick = (cullTick + 1) % 15; if (cullTick === 0) cullOrangByDistance([group, regionGroup], camera.position); } }); // tiap ±0,25 dtk

  return { group, regionGroup, bike, runners, walkers, match, vendors, crowd, updatables, lod };
}
