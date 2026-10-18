// tests/unri/heroBuilders.test.js
/**
 * Hanya logika berisiko (aturan proses: tanpa tes geometri hero): validator override M6, konsistensi bangunan
 * sintetis gerbang dengan bingkai hero, dan jalur `sink.extra` (part hero bermaterial sendiri tidak dibuang
 * `appendParts`, geometri cache tidak di-dispose, mark/rewind ikut memotong extra).
 */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { withScope, createResourceScope } from '../../src/engine/ResourceScope.js';
import { GERBANG_SITE, GERBANG } from '../../src/world/kit/hero/gerbangSmAmin.js';
import { HERO_BUILDERS } from '../../src/world/kit/hero/index.js';
import { isRegionOwned } from '../../src/world/kit/hero/regionOwned.js';
import { createKitSink } from '../../src/world/kit/kitBuilder.js';
import { appendParts, buildBuilding } from '../../src/world/kit/buildBuilding.js';
import { BUILDING_OVERRIDES, SYNTHETIC_BUILDINGS } from '../../src/districts/unri/buildings.data.js';
import { validateOverrides } from '../../src/districts/unri/resolveBuilding.js';
import { validateBuildingsData } from '../../src/districts/unri/buildingsFormat.js';

const plan = (baseY) => ({ masses: [{ obb: { cx: 0, cz: 0, w: 10, d: 10, yaw: 0 }, floors: 1, floorH: 4, baseY }] });

describe('override & bangunan sintetis M6', () => {
  it('tabel override nyata valid (termasuk id sintetis s-…)', () => {
    expect(validateOverrides(BUILDING_OVERRIDES)).toEqual([]);
    expect(BUILDING_OVERRIDES.w282225347.archetype).toBe('hero:rektorat');
    expect(BUILDING_OVERRIDES.w282225374.archetype).toBe('hero:perpustakaan-lama');
    expect(BUILDING_OVERRIDES.w282230716.archetype).toBe('hero:masjid-arfaunnas');
    expect(BUILDING_OVERRIDES.w314450943.archetype).toBe('hero:ggm');
    expect(BUILDING_OVERRIDES['s-gerbang-sm-amin'].archetype).toBe('hero:gerbang-sm-amin');
  });
  it('override sintetis tanpa entri SYNTHETIC_BUILDINGS ditolak', () => {
    const errs = validateOverrides({ 's-hantu': { archetype: 'K01', sumber: 'x', keyakinan: 'rendah' } });
    expect(errs.join(' ')).toMatch(/s-hantu.*SYNTHETIC_BUILDINGS/);
  });
  it('Rektorat & perpustakaan milik region; masjid/gerbang/GGM milik distrik', () => {
    expect(HERO_BUILDERS['hero:rektorat'](plan(0), {}, {})).toEqual([]);
    expect(isRegionOwned(HERO_BUILDERS['hero:rektorat'])).toBe(true);
    expect(isRegionOwned(HERO_BUILDERS['hero:perpustakaan-lama'])).toBe(true);
    for (const id of ['hero:masjid-arfaunnas', 'hero:gerbang-sm-amin', 'hero:ggm']) expect(isRegionOwned(HERO_BUILDERS[id])).toBe(false);
  });
  it('ring sintetis gerbang = pos satpam di bingkai GERBANG_SITE (tapak collider sama dengan geometri)', () => {
    const syn = SYNTHETIC_BUILDINGS.find((b) => b.id === 's-gerbang-sm-amin');
    const { x0, x1, z0, z1 } = GERBANG.pos;
    const c = Math.cos(GERBANG_SITE.yaw);
    const s = Math.sin(GERBANG_SITE.yaw);
    const expected = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([lx, lz]) => [GERBANG_SITE.x + c * lx + s * lz, GERBANG_SITE.z - s * lx + c * lz]);
    syn.ring.forEach(([x, z], i) => {
      expect(x).toBeCloseTo(expected[i][0], 1);
      expect(z).toBeCloseTo(expected[i][1], 1);
    });
  });
  it('buildings.json dengan id sintetis lolos validasi format', () => {
    const syn = SYNTHETIC_BUILDINGS[0];
    const data = { v: 1, buildings: [{ id: syn.id, ring: syn.ring, levels: 1, tags: syn.tags, cluster: '1_2', area: 9, front: null }] };
    expect(validateBuildingsData(data)).toEqual([]);
  });
});

describe('part hero non-kit di sink kit M3', () => {
  it('appendParts menyimpan part bermaterial sendiri di sink.extra tanpa dispose', () => {
    const sink = createKitSink();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const spy = vi.spyOn(geometry, 'dispose');
    const part = { geometry, material: new THREE.MeshStandardMaterial(), matrix: new THREE.Matrix4(), castShadow: true, name: 'x' };
    appendParts(sink, [part], { opak: {}, potong: {} });
    expect(sink.extra).toEqual([part]);
    expect(spy).not.toHaveBeenCalled();
  });
  it('mark/rewind memotong extra bersama geometri kit', () => {
    const sink = createKitSink();
    const m0 = sink.mark();
    sink.extra.push({ geometry: new THREE.BufferGeometry(), material: new THREE.MeshBasicMaterial() });
    const m1 = sink.mark();
    sink.extra.push({ geometry: new THREE.BufferGeometry(), material: new THREE.MeshBasicMaterial() });
    sink.rewind(m1);
    expect(sink.extra).toHaveLength(1);
    sink.rewind(m0);
    expect(sink.extra).toHaveLength(0);
  });
  it('buildBuilding hero distrik mengembalikan part ber-matriks (extra) dan cache scope dipakai ulang', () => {
    const scope = createResourceScope('uji:extra');
    const build = () => withScope(scope, () => buildBuilding({ ...plan(3.15), id: 'w282230716', archetype: 'hero:masjid-arfaunnas' }, { opak: {}, potong: {} }, { }));
    const parts = build();
    expect(parts.filter((q) => q.matrix).length).toBeGreaterThan(10);
    expect(build()[0].geometry).toBe(parts[0].geometry);
    scope.dispose();
  });
});
