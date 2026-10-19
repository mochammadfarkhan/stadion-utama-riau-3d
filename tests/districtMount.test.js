import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { mountDistrict, minimapView } from '../src/app/districtMount.js';
import { defineDistrict } from '../src/districts/District.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';
import { createTerrainService } from '../src/app/terrainService.js';

const BOUNDARY = [[0, 0], [400, 0], [400, 300], [0, 300]];

function fakeApp() {
  const systems = new Map();
  return {
    scene: new THREE.Scene(),
    systems,
    addSystem(s) { systems.set(s.id, s); return s; },
    removeSystem(id) { return systems.delete(id); },
  };
}
const scheduler = () => ({ schedule: vi.fn(() => ({ cancel() {} })), cancelOwner: vi.fn(), pending: () => 0 });

function districtWith(buildResult) {
  return defineDistrict({ id: 'uji', boundary: BOUNDARY, manifestUrl: 'd/m.json', build: vi.fn(async () => buildResult) });
}

const goodBuild = (log) => ({
  group: new THREE.Group(),
  systems: [{ id: 'district.uji.a', phase: 'world', update() {} }],
  colliders: { isWalkable: () => true, isCameraClear: () => true },
  minimapLayer: vi.fn(),
  excludeIds: new Set(),
  whenSettled: async () => true,
  groundHole: { minX: 0, minZ: 0, cell: 4, cols: 100, rows: 75, data: new Uint8Array(7500) },
  dispose: () => log.push('district.dispose'),
});

describe('minimapView', () => {
  it('persegi memuat bbox + 20 m, utara di atas', () => {
    const v = minimapView({ minX: 0, minZ: 0, maxX: 400, maxZ: 300 }, 1000);
    expect(v.center).toEqual({ x: 200, z: 150 });
    expect(v.half).toBe(220);
    expect(v.toCanvas(-20, -70)).toEqual([0, 0]);
    const [px, py] = v.toCanvas(420, 370);
    expect(px).toBeCloseTo(1000, 9);
    expect(py).toBeCloseTo(1000, 9);
  });
});

describe('mountDistrict', () => {
  it('memasang group, sistem, collider, lubang, minimap; dispose membongkar terbalik', async () => {
    const log = [];
    const app = fakeApp();
    const collider = { addDistrict: vi.fn(() => () => log.push('collider.off')) };
    const city = { setGroundHole: vi.fn((h) => log.push(h ? 'hole.on' : 'hole.off')) };
    const minimap = { setBaseLayer: vi.fn(), removeBaseLayer: vi.fn(() => log.push('minimap.off')) };
    const ctx2d = {};
    const def = districtWith(goodBuild(log));
    const sched = scheduler();
    const m = await mountDistrict(app, def, {
      terrain: createTerrainService(), scheduler: sched, collider, city, minimap,
      createCanvas: (w, h) => ({ width: w, height: h, getContext: () => ctx2d }),
    });
    expect(m.mounted).toBe(true);
    expect(app.scene.children).toContain(m.district.group);
    expect(app.systems.has('district.uji.a')).toBe(true);
    expect(collider.addDistrict).toHaveBeenCalledWith(expect.objectContaining({ id: 'uji', bounds: def.bounds }));
    const hole = city.setGroundHole.mock.calls[0][0];
    expect(hole.rect).toEqual({ minX: 0, minZ: 0, maxX: 400, maxZ: 300 });
    expect(hole.texture.image.width).toBe(100);
    expect(minimap.setBaseLayer).toHaveBeenCalledWith('district:uji', expect.anything(), expect.objectContaining({ yaw: 0 }));
    expect(def.build.mock.calls[0][0]).toMatchObject({ owner: 'district:uji', baseUrl: '/' });
    m.dispose();
    m.dispose();
    expect(log).toEqual(['hole.on', 'minimap.off', 'hole.off', 'collider.off', 'district.dispose']);
    expect(app.systems.size).toBe(0);
    expect(app.scene.children).toHaveLength(0);
    expect(sched.cancelOwner).toHaveBeenCalledWith('district:uji');
  });

  it('build gagal → null, toast, scope dilepas', async () => {
    const toast = vi.fn();
    const scopes = [];
    const def = defineDistrict({ id: 'uji', boundary: BOUNDARY, manifestUrl: 'd/m.json', build: async () => { throw new Error('manifest 404'); } });
    const m = await mountDistrict(fakeApp(), def, {
      terrain: createTerrainService(), scheduler: scheduler(), toast, logger: { error() {} },
      createScope: (n) => { const s = createResourceScope(n); scopes.push(s); return s; },
    });
    expect(m).toBeNull();
    expect(toast).toHaveBeenCalledWith('Kawasan kampus gagal dimuat — peta kota tetap tersedia', false);
    expect(() => scopes[0].get('x', () => 1)).toThrow(/sudah di-dispose/);
  });

  it('onTerrainFail memberi toast sekali saja', async () => {
    const toast = vi.fn();
    let ctxSeen = null;
    const def = defineDistrict({
      id: 'uji', boundary: BOUNDARY, manifestUrl: 'd/m.json',
      build: async (ctx) => { ctxSeen = ctx; return goodBuild([]); },
    });
    await mountDistrict(fakeApp(), def, { terrain: createTerrainService(), scheduler: scheduler(), toast });
    ctxSeen.onTerrainFail();
    ctxSeen.onTerrainFail();
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
