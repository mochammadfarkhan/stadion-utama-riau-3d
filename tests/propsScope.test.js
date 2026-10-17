/**
 * Props & vegetasi (Plan C Task 9, utang Plan A Task 4): material/geometri bersama dibuat lewat
 * ResourceScope aktif, bukan saat impor. Pohon/props di scope region tidak lagi berbagi sumber daya
 * dengan gerobak pedagang (scope global), sehingga region.dispose tidak melepas milik entitas.
 */
import { describe, it, expect } from 'vitest';
import { inTwoScopes, materialsOf, geometriesOf } from './helpers.js';
import { createBenches } from '../src/world/props/Bench.js';
import { createCart } from '../src/world/props/Cart.js';
import { createGapura } from '../src/world/props/Gapura.js';
import { createLampPosts } from '../src/world/props/LampPost.js';
import { createLancangKuning, createTanjakMonument } from '../src/world/props/Monument.js';
import { createPlanters } from '../src/world/props/Planter.js';
import { createTrashBins } from '../src/world/props/TrashBin.js';
import { createParkedCars, createTransMetroBus } from '../src/world/props/Vehicles.js';
import { createBigTrees, createYoungTrees, createShrubs } from '../src/world/Landscape.trees.js';

const P = [{ x: 0, z: 0 }, { x: 5, z: 2 }];
const FACTORIES = {
  bangku: () => createBenches(P),
  gerobak: () => createCart({ kind: 'minuman' }),
  gapura: () => createGapura({ damaged: true }),
  pju: () => createLampPosts(P),
  tugu: () => createLancangKuning({ x: 0, z: 0 }),
  tanjak: () => createTanjakMonument({ x: 0, z: 0 }),
  potBunga: () => createPlanters(P),
  tongSampah: () => createTrashBins(P),
  mobil: () => createParkedCars(P),
  bus: () => createTransMetroBus(),
  pohonBesar: () => createBigTrees(11),
  pohonMuda: () => createYoungTrees(23),
  semak: () => createShrubs(31),
};

describe('props & vegetasi memakai ResourceScope aktif', () => {
  it.each(Object.keys(FACTORIES))('%s: tidak berbagi material/geometri antar scope; yang dipakai ulang dimiliki scope', (name) => {
    const { a, first, again, other } = inTwoScopes(FACTORIES[name]);
    const matsA = materialsOf(first);
    const matsB = materialsOf(other);
    const geosA = geometriesOf(first);
    const geosB = geometriesOf(other);
    expect([...matsA].filter((m) => matsB.has(m))).toEqual([]);
    expect([...geosA].filter((g) => geosB.has(g))).toEqual([]);
    // sumber daya yang dipakai ulang dalam scope yang sama harus milik scope itu (dilepas scope.dispose)
    const reused = [...materialsOf(again), ...geometriesOf(again)].filter((r) => matsA.has(r) || geosA.has(r));
    for (const r of reused) expect(a.owns(r), `${name}: ${r.type} ${r.name}`).toBe(true);
  });

  it('bohlam PJU tetap bertanda nightEmissive & bernama (dibaca TimeOfDay) setelah dipindah ke scope', () => {
    const { first } = inTwoScopes(() => createLampPosts(P));
    const bulb = [...materialsOf(first)].find((m) => m.name === 'bohlamPJU');
    expect(bulb.userData.nightEmissive).toEqual({ on: 6.0, off: 0 });
  });
});
