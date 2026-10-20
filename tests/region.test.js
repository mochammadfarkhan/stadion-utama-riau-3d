import { describe, it, expect } from 'vitest';
import {
  defineRegion, validateBuild, regionContains, withPlacement, DEFAULT_MOUNT_RADIUS, DEFAULT_UNMOUNT_RADIUS,
} from '../src/regions/Region.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { STADION_MASK, createStadionMask } from '../src/regions/stadion/mask.js';
import { litLampPositions, stadionNightLights } from '../src/regions/stadion/lamps.js';
import { STADION_PLACEMENT } from '../src/regions/stadion/placement.js';
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
    for (const [x, z] of [[0, 0], [0, -180], [0, -330], [190, -330], [240, 0], [250, -60], [0, -385], [0, -436], [-27, -416]]) {
      expect(regionContains(stadionRegion, x, z)).toBe(true);
    }
    // luar: Jl. Naga Sakti OSM (z −447), danau OSM barat (−60, −380) & timur (60, −385), area jauh
    for (const [x, z] of [[0, -447], [0, -500], [600, 0], [-60, -480], [-60, -380], [60, -385]]) {
      expect(regionContains(stadionRegion, x, z)).toBe(false);
    }
    expect(stadionRegion.mask).toBe(STADION_MASK);
    expect(stadionRegion.placement).toEqual(STADION_PLACEMENT);
  });
  it('PJU menyala: plaza i%7==3 dan jalan lingkar i%9==4 padam', () => {
    const lit = litLampPositions(LAYOUT);
    expect(lit).toHaveLength(LAYOUT.plazaLamps.length - 4 + LAYOUT.ringRoadLamps.length - 5);
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
    expect(built.systems.map((s) => s.id)).toEqual(['stadion.world', 'stadion.farDetail']);
    expect(typeof built.colliders.isWalkable).toBe('function');
    expect(built.seatSamples.length).toBeGreaterThan(0);
    expect(built.nightLights).toEqual(stadionNightLights(LAYOUT, STADION_PLACEMENT)); // dunia (placement OSM)
    expect(built.nightLights.lamps).toHaveLength(litLampPositions(LAYOUT).length);
    expect(built.lateRoot.parent).toBe(built.group);
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

describe('kontrak Region: field opsional M0 (spec UNRI §4.3)', () => {
  it('tanpa activation → persistent; persistent:true dinormalisasi dan beku', () => {
    expect(defineRegion(spec()).activation).toEqual({ persistent: true });
    const r = defineRegion(spec({ activation: { persistent: true, center: { x: 1, z: 1 } } }));
    expect(r.activation).toEqual({ persistent: true });
    expect(Object.isFrozen(r.activation)).toBe(true);
  });

  it('activation streaming: center wajib, radius default 700/900, unmount > mount', () => {
    expect([DEFAULT_MOUNT_RADIUS, DEFAULT_UNMOUNT_RADIUS]).toEqual([700, 900]);
    const r = defineRegion(spec({ activation: { center: { x: 5, z: 6 } } }));
    expect(r.activation).toEqual({ persistent: false, center: { x: 5, z: 6 }, mountRadius: 700, unmountRadius: 900 });
    expect(Object.isFrozen(r.activation.center)).toBe(true);
    expect(defineRegion(spec({ activation: { center: { x: 0, z: 0 }, mountRadius: 100, unmountRadius: 150 } })).activation.unmountRadius).toBe(150);
    expect(() => defineRegion(spec({ activation: 'ya' }))).toThrow(/activation harus objek/);
    expect(() => defineRegion(spec({ activation: { center: { x: 0 } } }))).toThrow(/activation\.center/);
    expect(() => defineRegion(spec({ activation: { center: { x: 0, z: 0 }, mountRadius: -1 } }))).toThrow(/mountRadius harus > 0/);
    expect(() => defineRegion(spec({ activation: { center: { x: 0, z: 0 }, mountRadius: 900, unmountRadius: 900 } }))).toThrow(/histeresis/);
  });

  it('proxy harus fungsi bila ada', () => {
    expect(defineRegion(spec({ proxy: () => ({}) })).proxy).toBeTypeOf('function');
    expect(defineRegion(spec()).proxy).toBeUndefined();
    expect(() => defineRegion(spec({ proxy: {} }))).toThrow(/proxy/);
  });

  it('povs: default [], id unik, label, pose fungsi', () => {
    expect(defineRegion(spec()).povs).toEqual([]);
    const pov = { id: 'a', label: 'A', pose: () => null };
    expect(defineRegion(spec({ povs: [pov] })).povs[0]).toMatchObject({ id: 'a', label: 'A' });
    expect(() => defineRegion(spec({ povs: {} }))).toThrow(/povs harus array/);
    expect(() => defineRegion(spec({ povs: [{ ...pov, id: '' }] }))).toThrow(/povs\[0\]\.id/);
    expect(() => defineRegion(spec({ povs: [pov, pov] }))).toThrow(/ganda/);
    expect(() => defineRegion(spec({ povs: [{ ...pov, label: 3 }] }))).toThrow(/povs\[0\]\.label/);
    expect(() => defineRegion(spec({ povs: [{ ...pov, pose: null }] }))).toThrow(/povs\[0\]\.pose/);
  });

  it('pads: default [], ring ≥ 3 titik, y median|angka (default median)', () => {
    expect(defineRegion(spec()).pads).toEqual([]);
    const ring = [[0, 0], [4, 0], [4, 4]];
    expect(defineRegion(spec({ pads: [{ ring }] })).pads).toEqual([{ ring, y: 'median' }]);
    expect(defineRegion(spec({ pads: [{ ring, y: 1.5 }] })).pads[0].y).toBe(1.5);
    expect(() => defineRegion(spec({ pads: 'x' }))).toThrow(/pads harus array/);
    expect(() => defineRegion(spec({ pads: [{ ring: [[0, 0], [1, 1]] }] }))).toThrow(/pads\[0\]\.ring/);
    expect(() => defineRegion(spec({ pads: [{ ring, y: 'tinggi' }] }))).toThrow(/pads\[0\]\.y/);
  });

  it('region stadion persistent; withPlacement mempertahankan field M0', () => {
    expect(stadionRegion.activation).toEqual({ persistent: true });
    const moved = withPlacement(stadionRegion, { x: 1, z: 2, yaw: 0 });
    expect(moved.activation).toEqual({ persistent: true });
    expect(moved.povs).toEqual([]);
    expect(moved.pads).toEqual([]);
  });
});
