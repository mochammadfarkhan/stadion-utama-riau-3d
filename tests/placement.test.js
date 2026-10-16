import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createRegionFrame } from '../src/geo/regionTransform.js';
import { POV_BY_ID, povPose, createPose, routeControl, poseToWorld } from '../src/core/cameraPresets.js';
import { createPovSource } from '../src/core/povSource.js';
import { sourceRect } from '../src/shared/minimapMath.js';
import { withPlacement, regionContains } from '../src/regions/Region.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { SITE } from '../src/regions/stadion/site.js';
import { createSystemRunner } from '../src/engine/SystemRunner.js';
import { mountRegion } from '../src/app/mountRegion.js';
import { parsePlacementParam } from '../src/app/devtools.js';
import { createCompositeCollider } from '../src/core/Collider.js';

const P = { x: 100, z: -50, yaw: 0.3 };
const frame = createRegionFrame(P);
const quiet = { error() {} };

describe('placement non-identitas ujung-ke-ujung (I1)', () => {
  it('POV tetap (udara/tribun/orbit) = pose lokal yang diubah ke dunia; POV ikut tidak diubah', () => {
    const bike = { x: 5, z: 6, yaw: 0 };
    for (const id of ['udara', 'tribun', 'orbit']) {
      const local = createPose();
      const world = createPose();
      povPose(POV_BY_ID[id], { bike }, 0, 12, local);
      povPose(POV_BY_ID[id], { bike, frame }, 0, 12, world);
      const want = poseToWorld({ ...local }, frame);
      for (const k of ['px', 'py', 'pz', 'tx', 'ty', 'tz']) expect(world[k]).toBeCloseTo(want[k], 9);
    }
    const a = createPose();
    const b = createPose();
    povPose(POV_BY_ID.atas, { bike }, 0, 0, a);
    povPose(POV_BY_ID.atas, { bike, frame }, 0, 0, b);
    expect(b).toEqual(a);
  });

  it('rute kamera dihitung di frame region: hasil = rute lokal yang diubah ke dunia', () => {
    const la = { ...createPose(), px: 0, py: 150, pz: -400, tx: 0, ty: 0, tz: 0 };
    const ld = { ...createPose(), px: 10, py: 5, pz: 20, tx: 0, ty: 0, tz: 0 };
    const lc1 = {};
    const lc2 = {};
    routeControl(la, ld, lc1, lc2);
    const wc1 = {};
    const wc2 = {};
    routeControl(poseToWorld({ ...la }, frame), poseToWorld({ ...ld }, frame), wc1, wc2, frame);
    const e1 = frame.toWorld(lc1.x, lc1.z);
    expect(wc1.x).toBeCloseTo(e1.x, 9);
    expect(wc1.z).toBeCloseTo(e1.z, 9);
    expect(wc1.y).toBeCloseTo(lc1.y, 9);
    expect(wc2.y).toBeCloseTo(lc2.y, 9);
  });

  it('sumber POV: bola & pedagang region-lokal → dunia (yaw + placement.yaw)', () => {
    const ents = {
      bike: { state: { x: 0, z: 0, yaw: 0 } },
      match: { ball: { pos: { x: 4, z: -6 } } },
      vendors: { vendors: [{ position: { x: -20, z: -188 }, yaw: 1 }] },
    };
    const src = createPovSource(ents, frame);
    const ball = src.ball();
    const wb = frame.toWorld(4, -6);
    expect([ball.x, ball.z]).toEqual([wb.x, wb.z]);
    const v = src.vendor(0);
    const wv = frame.toWorld(-20, -188);
    expect([v.x, v.z]).toEqual([wv.x, wv.z]);
    expect(v.yaw).toBeCloseTo(1.3, 12);
    expect(src.frame).toBe(frame);
  });

  it('minimap: jendela sumber relatif terhadap pusat bake (placement)', () => {
    const r0 = sourceRect({ x: 0, z: 0 }, 160, 700, 1400);
    const r1 = sourceRect({ x: P.x, z: P.z }, 160, 700, 1400, P);
    expect(r1).toEqual(r0);
  });

  it('region terpasang: grup, lampu malam, model GLB, mask, collider mengikuti placement', async () => {
    const def = withPlacement(stadionRegion, P);
    const runner = createSystemRunner({ logger: quiet });
    const app = { scene: new THREE.Scene(), addSystem: (s) => runner.add(s), removeSystem: (id) => runner.remove(id) };
    const lampsSeen = [];
    const time = {
      registerEmissive: () => () => true,
      registerLamps: (o) => { lampsSeen.push(o); return () => true; },
    };
    const m = await mountRegion(app, def, { time, logger: quiet });
    const g = m.region.group;
    const tugu = new THREE.Vector3(SITE.tugu.x, 0, SITE.tugu.z).applyMatrix4(g.matrixWorld);
    const want = frame.toWorld(SITE.tugu.x, SITE.tugu.z);
    expect(tugu.x).toBeCloseTo(want.x, 6);
    expect(tugu.z).toBeCloseTo(want.z, 6);
    const lamp0 = m.region.nightLights.lamps[0];
    expect(lampsSeen[0].lamps[0]).toEqual(lamp0);
    expect(m.region.lateRoot.parent).toBe(g); // model GLB ikut transform region
    expect(regionContains(def, want.x, want.z)).toBe(true);
    expect(regionContains(def, SITE.tugu.x, SITE.tugu.z - 300)).toBe(false);
    const comp = createCompositeCollider({ regions: [{ region: def, colliders: m.region.colliders }], fallback: { isWalkable: () => true, isCameraClear: () => true } });
    expect(comp.isWalkable(want.x, want.z)).toBe(false); // kolam tugu (dunia) tetap padat
    m.unmount();
  }, 30000);

  it('parsePlacementParam: ?placement=x,z,yaw; selain itu null', () => {
    expect(parsePlacementParam('?placement=100,-50,0.3')).toEqual(P);
    expect(parsePlacementParam('?placement=1,2')).toBeNull();
    expect(parsePlacementParam('?placement=a,b,c')).toBeNull();
    expect(parsePlacementParam('')).toBeNull();
  });
});
