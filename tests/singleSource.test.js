import { describe, it, expect } from 'vitest';
import { SITE } from '../src/config/constants.js';
import { TUGU } from '../src/story/chapters.js';
import { OBSTACLES, isWalkable } from '../src/regions/stadion/collider.js';
import { LAYOUT } from '../src/regions/stadion/layout.js';
import { litLampPositions } from '../src/regions/stadion/lamps.js';
import { createLancangKuning } from '../src/world/props/Monument.js';
import { createDecalLayout } from '../src/world/Decals.layout.js';
import { ZONES } from '../src/world/Landscape.zones.js';

describe('kebenaran tunggal: tugu Lancang Kuning', () => {
  it('SITE.tugu dipakai cerita, collider, layout model, Monument, dan lumut dinding kolam', () => {
    const t = SITE.tugu;
    expect(TUGU).toEqual({ x: t.x, z: t.z });
    const o = OBSTACLES.find((x) => x.name === 'tuguLancangKuning');
    expect([o.x, o.z, o.r]).toEqual([t.x, t.z, t.poolR + 0.6]);
    const model = LAYOUT.blenderModels.find((m) => m.replaces === 'tuguLancangKuning');
    expect([model.x, model.z]).toEqual([t.x, t.z]);
    const mono = createLancangKuning();
    expect([mono.position.x, mono.position.z]).toEqual([t.x, t.z]);
    const moss = createDecalLayout().filter((d) => d.name === 'moss' && d.vertical);
    expect(moss.length).toBeGreaterThan(0);
    for (const d of moss) expect(Math.hypot(d.x - t.x, d.z - t.z)).toBeCloseTo(11.53, 6);
  });
});

describe('kebenaran tunggal: PJU rusak', () => {
  it('flag broken di data layout; lampu malam memakai flag yang sama', () => {
    expect(LAYOUT.plazaLamps.map((p) => p.broken)).toEqual(LAYOUT.plazaLamps.map((_, i) => i % 7 === 3));
    expect(LAYOUT.ringRoadLamps.map((p) => p.broken)).toEqual(LAYOUT.ringRoadLamps.map((_, i) => i % 9 === 4));
    const all = [...LAYOUT.plazaLamps, ...LAYOUT.ringRoadLamps, ...LAYOUT.nagaSaktiLamps];
    expect(litLampPositions(LAYOUT)).toEqual(all.filter((p) => !p.broken).map((p) => ({ x: p.x, z: p.z })));
  });
});

describe('kebenaran tunggal: danau', () => {
  it('collider danau mengikuti elips air visual (ZONES.lake), bukan lingkaran r=70', () => {
    const L = SITE.lake;
    expect([ZONES.lake.semiX, ZONES.lake.semiZ]).toEqual([L.semiX, L.semiZ]);
    expect(SITE.lakeCenter).toEqual({ x: L.x, z: L.z });
    expect(isWalkable(L.x, L.z)).toBe(false);
    expect(isWalkable(L.x + L.semiX - 5, L.z)).toBe(false); // di air, di luar lingkaran lama
    expect(isWalkable(L.x, L.z + L.semiZ + 5)).toBe(true);  // tepi daratan, dulu terblokir lingkaran
  });
});
