import { describe, it, expect } from 'vitest';
import { defineRegion, validateBuild, regionContains } from '../src/regions/Region.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { STADION_MASK, createStadionMask } from '../src/regions/stadion/mask.js';
import { litLampPositions } from '../src/regions/stadion/lamps.js';
import { LAYOUT } from '../src/regions/stadion/layout.js';
import { SITE } from '../src/regions/stadion/site.js';
import { SITE as SITE_COMPAT } from '../src/config/constants.js';
import { buildWorld } from '../src/world/index.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';

const square = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
const spec = (over = {}) => ({ id: 'uji', placement: { x: 0, z: 0, yaw: 0 }, mask: square, build: async () => ({}), ...over });

describe('kontrak Region', () => {
  it('defineRegion memvalidasi id, placement, mask, build', () => {
    expect(defineRegion(spec()).id).toBe('uji');
    expect(() => defineRegion(spec({ id: '' }))).toThrow(/id/);
    expect(() => defineRegion(spec({ placement: { x: 0, z: 0 } }))).toThrow(/placement/);
    expect(() => defineRegion(spec({ mask: [[0, 0], [1, 1]] }))).toThrow(/mask/);
    expect(() => defineRegion(spec({ build: null }))).toThrow(/build/);
  });
  it('validateBuild menyebut semua bagian yang hilang', () => {
    expect(() => validateBuild({}, 'uji')).toThrow(/group, colliders, minimapLayer, systems, dispose/);
  });
  it('regionContains memakai placement (offset + yaw)', () => {
    const r = defineRegion(spec({ placement: { x: 100, z: 0, yaw: Math.PI / 4 } }));
    expect(regionContains(r, 100, 0)).toBe(true);
    expect(regionContains(r, 0, 0)).toBe(false);
  });
});

describe('region stadion: data', () => {
  it('SITE dari site.js sama dengan re-export lama di config/constants.js', () => {
    expect(SITE_COMPAT).toBe(SITE);
  });
  it('mask memuat stadion, plaza, dan parkir; danau & area jauh di luar', () => {
    expect(createStadionMask(SITE)).toEqual(createStadionMask());
    for (const [x, z] of [[0, 0], [0, -180], [0, -330], [190, -330], [240, 0]]) expect(regionContains(stadionRegion, x, z)).toBe(true);
    for (const [x, z] of [[0, -500], [600, 0], [-60, -480]]) expect(regionContains(stadionRegion, x, z)).toBe(false);
    expect(stadionRegion.mask).toBe(STADION_MASK);
    expect(stadionRegion.placement).toEqual({ x: 0, z: 0, yaw: 0 });
  });
  it('PJU menyala: plaza i%7==3 dan jalan lingkar i%9==4 padam', () => {
    const lit = litLampPositions(LAYOUT);
    expect(lit).toHaveLength(LAYOUT.plazaLamps.length - 4 + LAYOUT.ringRoadLamps.length - 5 + LAYOUT.nagaSaktiLamps.length);
    expect(lit).not.toContainEqual({ x: LAYOUT.plazaLamps[3].x, z: LAYOUT.plazaLamps[3].z });
    expect(lit).not.toContainEqual({ x: LAYOUT.ringRoadLamps[4].x, z: LAYOUT.ringRoadLamps[4].z });
  });
  it('buildWorld tanpa layout melempar (layout wajib dari region)', () => {
    expect(() => buildWorld()).toThrow(/layout wajib/);
  });
});

describe('region stadion: build & dispose', () => {
  it('build(ctx) memenuhi kontrak; dispose mengosongkan grup dan scope', async () => {
    const scope = createResourceScope('uji');
    const built = await stadionRegion.build({ scope });
    expect(built.group.children.length).toBeGreaterThan(0);
    expect(built.systems.map((s) => s.id)).toEqual(['stadion.world']);
    expect(typeof built.colliders.isWalkable).toBe('function');
    expect(built.seatSamples.length).toBeGreaterThan(0);
    expect(built.nightLights.lamps).toEqual(litLampPositions(LAYOUT));
    expect(scope.size).toBeGreaterThan(0);
    built.dispose();
    built.dispose(); // idempoten
    expect(built.group.children).toHaveLength(0);
    expect(scope.size).toBe(0);
    expect(scope.disposed).toBe(true);
  }, 30000);
  it('build tanpa ctx.scope ditolak', async () => {
    await expect(stadionRegion.build({})).rejects.toThrow(/ctx.scope/);
  });
});
