import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDummyRegion, DUMMY_BOXES, DUMMY_REGION_ID } from '../src/app/dummyRegion.js';
import { mountRegion } from '../src/app/mountRegion.js';
import { createScheduler } from '../src/engine/scheduler.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';
import { createRegionFrame } from '../src/geo/regionTransform.js';

const quiet = { error() {}, warn() {} };
const fakeApp = () => ({ scene: new THREE.Scene(), addSystem() {}, removeSystem() { return true; } });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('region dummy (M0)', () => {
  it('streaming 700/900 di sekitar pusat, satu POV dunia, proxy ≤ 8 mesh', () => {
    const def = createDummyRegion({ x: 10, z: 20 });
    expect(def.id).toBe(DUMMY_REGION_ID);
    expect(def.activation).toEqual({ persistent: false, center: { x: 10, z: 20 }, mountRadius: 700, unmountRadius: 900 });
    expect(def.povs.map((p) => p.id)).toEqual(['atas']);
    const pose = def.povs[0].pose(createRegionFrame(def.placement), { time: 0 });
    expect([pose.tx, pose.tz]).toEqual([10, 20]);
    const scope = createResourceScope('uji-proxy');
    const proxy = def.proxy({ scope });
    let meshes = 0;
    proxy.group.traverse((o) => { if (o.isMesh) meshes += 1; });
    expect(meshes).toBeGreaterThan(0);
    expect(meshes).toBeLessThanOrEqual(8);
    scope.dispose();
  });

  it('build inkremental: kotak dipasang lewat scheduler, ready menunggu antrean habis', async () => {
    const scheduler = createScheduler({ budgetMs: 0, now: () => 0 }); // satu potongan per update
    const m = await mountRegion(fakeApp(), createDummyRegion(), { scheduler, logger: quiet });
    let ready = false;
    m.ready.then(() => { ready = true; });
    expect(m.region.group.children).toHaveLength(1); // tanah saja
    scheduler.update();
    expect(m.region.group.children).toHaveLength(2);
    while (scheduler.pending()) scheduler.update();
    await tick();
    expect(m.region.group.children).toHaveLength(1 + DUMMY_BOXES);
    expect(ready).toBe(true);
    m.unmount();
  });
});
