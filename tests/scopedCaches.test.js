import { describe, it, expect } from 'vitest';
import { createResourceScope, withScope } from '../src/engine/ResourceScope.js';
import { inTwoScopes, materialsOf, geometriesOf } from './helpers.js';
import { Materials } from '../src/world/materials.js';
import { groundMaterials } from '../src/world/Ground.materials.js';
import { asphaltTexture } from '../src/world/textures/surfaces.js';
import { createDecalAtlas } from '../src/world/textures/decalAtlas.js';
import { roundedBox } from '../src/world/siteutil/rounded.js';
import { makeTextMaterial } from '../src/world/siteutil/textCanvas.js';
import { createBaseballVenue } from '../src/world/Landscape.baseball.js';
import { createRingRoad } from '../src/world/Ground.roads.js';

describe('cache modul dunia memakai ResourceScope aktif', () => {
  it.each([
    ['Materials.acp', () => Materials.acp()],
    ['roundedBox', () => roundedBox(1, 0.5, 0.4, 0.05)],
    ['makeTextMaterial', () => makeTextMaterial('UJI', { bg: '#fff' })],
  ])('%s: sama dalam satu scope, baru di scope lain, dimiliki scope', (_name, make) => {
    const { a, first, again, other } = inTwoScopes(make);
    expect(again).toBe(first);
    expect(other).not.toBe(first);
    expect(a.owns(first)).toBe(true);
  });

  it('groundMaterials dan tekstur permukaan: satu set per scope, dimiliki scope', () => {
    const g = inTwoScopes(() => groundMaterials());
    expect(g.again).toBe(g.first);
    expect(g.other.grass).not.toBe(g.first.grass);
    expect(g.a.owns(g.first.asphalt)).toBe(true);
    const t = inTwoScopes(() => asphaltTexture());
    expect(t.other.map).not.toBe(t.first.map);
    expect(t.a.owns(t.first.map)).toBe(true);
  });

  it('atlas dekal: satu tekstur per scope', () => {
    const { a, first, again, other } = inTwoScopes(() => createDecalAtlas());
    expect(again).toBe(first);
    expect(other.texture).not.toBe(first.texture);
    expect(a.owns(first.texture)).toBe(true);
  });

  it('dispose scope melepas material cache', () => {
    const a = createResourceScope('a');
    const mat = withScope(a, () => Materials.steel());
    let disposed = false;
    mat.addEventListener('dispose', () => { disposed = true; });
    a.dispose();
    expect(disposed).toBe(true);
  });
});

describe('material/geometri saat-impor kini lazy per scope', () => {
  it('venue baseball: semua material milik scope a dan tidak dibagi dengan scope b', () => {
    const { a, first, other } = inTwoScopes(() => createBaseballVenue());
    const matsA = [...materialsOf(first)];
    const matsB = materialsOf(other);
    expect(matsA.length).toBeGreaterThan(0);
    expect(matsA.every((m) => a.owns(m))).toBe(true);
    expect(matsA.some((m) => matsB.has(m))).toBe(false);
  });

  it('marka jalan lingkar: geometri dash dimiliki scope', () => {
    const { a, first, other } = inTwoScopes(() => createRingRoad());
    const owned = [...geometriesOf(first)].filter((g) => a.owns(g));
    expect(owned).toHaveLength(1);
    expect(geometriesOf(other).has(owned[0])).toBe(false);
  });
});
