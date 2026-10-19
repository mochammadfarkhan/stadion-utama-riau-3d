import { describe, it, expect } from 'vitest';
import { normalizePoint, resolvePoint, localizePoint, DEFAULT_REGION, WORLD_REGION } from '../src/story/points.js';
import { resolveChapters, resolveNpcs, resolveEggs, resolveAnchors } from '../src/story/storyWorld.js';
import { createRegionFrame, IDENTITY_FRAME } from '../src/geo/regionTransform.js';

const F = createRegionFrame({ x: 100, z: -50, yaw: 0.3 });
const frameOf = (id) => ({ stadion: IDENTITY_FRAME, lembaga: F })[id] ?? null;

describe('normalizePoint', () => {
  it('tanpa region → stadion; field lain dibuang', () => {
    expect(DEFAULT_REGION).toBe('stadion');
    expect(normalizePoint({ x: 1, z: 2, radius: 9 })).toEqual({ region: 'stadion', x: 1, z: 2 });
  });
  it('region dipertahankan (termasuk world)', () => {
    expect(normalizePoint({ region: 'lembaga', x: 1, z: 2 })).toEqual({ region: 'lembaga', x: 1, z: 2 });
    expect(normalizePoint({ region: WORLD_REGION, x: 1, z: 2 }).region).toBe('world');
  });
  it('titik tidak sah melempar TypeError', () => {
    for (const bad of [null, 5, {}, { x: 1 }, { x: Number.NaN, z: 0 }, { x: 0, z: 0, region: '' }, { x: 0, z: 0, region: 5 }]) {
      expect(() => normalizePoint(bad)).toThrow(TypeError);
    }
  });
});

describe('resolvePoint', () => {
  it('stadion identitas & world: koordinat apa adanya', () => {
    expect(resolvePoint({ x: 3, z: 4 }, frameOf)).toEqual({ x: 3, z: 4 });
    expect(resolvePoint({ region: 'world', x: 3, z: 4 }, () => null)).toEqual({ x: 3, z: 4 });
  });
  it('region ber-placement: frame.toWorld', () => {
    const w = resolvePoint({ region: 'lembaga', x: 10, z: 0 }, frameOf);
    expect(w.x).toBeCloseTo(100 + Math.cos(0.3) * 10, 9);
    expect(w.z).toBeCloseTo(-50 - Math.sin(0.3) * 10, 9);
  });
  it('region tak dikenal atau titik null → null', () => {
    expect(resolvePoint({ region: 'hilang', x: 0, z: 0 }, frameOf)).toBeNull();
    expect(resolvePoint(null, frameOf)).toBeNull();
    expect(resolvePoint(undefined, frameOf)).toBeNull();
  });
});

describe('localizePoint', () => {
  it('dunia → lokal region (+yaw), dan kembali lewat resolvePoint', () => {
    const p = localizePoint({ x: 120, z: -40, yaw: 1 }, 'lembaga', frameOf);
    expect(p.region).toBe('lembaga');
    expect(p.yaw).toBeCloseTo(0.7, 12);
    const back = resolvePoint(p, frameOf);
    expect(back.x).toBeCloseTo(120, 9);
    expect(back.z).toBeCloseTo(-40, 9);
  });
  it('tanpa region → world; frame tak dikenal atau titik rusak → null; yaw hilang → 0', () => {
    expect(localizePoint({ x: 1, z: 2, yaw: 3 }, null, frameOf)).toEqual({ region: 'world', x: 1, z: 2, yaw: 3 });
    expect(localizePoint({ x: 1, z: 2 }, 'world', frameOf)).toEqual({ region: 'world', x: 1, z: 2, yaw: 0 });
    expect(localizePoint({ x: 1, z: 2 }, 'hilang', frameOf)).toBeNull();
    expect(localizePoint({ x: Number.NaN, z: 2 }, 'stadion', frameOf)).toBeNull();
  });
});

describe('storyWorld', () => {
  const chapters = [{
    id: 'c',
    title: 'C',
    steps: [
      { id: 'a', objective: { type: 'goto', target: { region: 'lembaga', x: 10, z: 0 }, radius: 5 } },
      { id: 'b', objective: { type: 'buy', itemId: 'x' } },
      { id: 'c', objective: { type: 'goto', target: { region: 'hilang', x: 0, z: 0 }, radius: 5 } },
    ],
  }];

  it('resolveChapters: target goto ke dunia; objective lain sama; region tak dikenal → target null', () => {
    const r = resolveChapters(chapters, frameOf);
    expect(r[0].title).toBe('C');
    expect(r[0].steps[0].objective.target.x).toBeCloseTo(100 + Math.cos(0.3) * 10, 9);
    expect(r[0].steps[0].objective.radius).toBe(5);
    expect(r[0].steps[1].objective).toBe(chapters[0].steps[1].objective);
    expect(r[0].steps[2].objective.target).toBeNull();
    expect(chapters[0].steps[0].objective.target).toEqual({ region: 'lembaga', x: 10, z: 0 }); // input tidak diubah
  });

  it('resolveChapters: objective interact meresolve `at` ke dunia; tanpa `at` tidak berubah (M7)', () => {
    const withAt = { type: 'interact', target: 'sekre:kipas', at: { region: 'world', x: 5, z: 6 } };
    const noAt = { type: 'interact', target: 'sekre:kipas' };
    const r = resolveChapters([{ id: 'c', steps: [{ id: 'a', objective: withAt }, { id: 'b', objective: noAt }] }], frameOf);
    expect(r[0].steps[0].objective).toEqual({ type: 'interact', target: 'sekre:kipas', at: { x: 5, z: 6 } });
    expect(r[0].steps[1].objective).toBe(noAt);
  });

  it('resolveNpcs membuang NPC di region tak dikenal; field lain dipertahankan', () => {
    const r = resolveNpcs([{ id: 'a', name: 'A', x: 1, z: 2, yaw: 0.5 }, { id: 'b', name: 'B', region: 'hilang', x: 0, z: 0 }], frameOf);
    expect(r).toEqual([{ id: 'a', name: 'A', x: 1, z: 2, yaw: 0.5 }]);
  });

  it('resolveEggs: `at` ke dunia dengan radius; tanpa `at` tetap; region tak dikenal → tanpa `at`', () => {
    const eggs = [
      { id: 'a', at: { region: 'lembaga', x: 10, z: 0, radius: 3 } },
      { id: 'b', trigger: 'khusus' },
      { id: 'c', at: { region: 'hilang', x: 0, z: 0, radius: 3 } },
    ];
    const r = resolveEggs(eggs, frameOf);
    expect(r[0].at.radius).toBe(3);
    expect(r[0].at.z).toBeCloseTo(-50 - Math.sin(0.3) * 10, 9);
    expect(r[1]).toBe(eggs[1]);
    expect(r[2].at).toBeUndefined();
  });

  it('resolveAnchors: tiap titik ke dunia; tak dikenal → null', () => {
    expect(resolveAnchors({ tugu: { x: 1, z: 2 }, jauh: { region: 'hilang', x: 0, z: 0 } }, frameOf)).toEqual({ tugu: { x: 1, z: 2 }, jauh: null });
  });
});
