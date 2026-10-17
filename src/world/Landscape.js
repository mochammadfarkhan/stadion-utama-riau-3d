import * as THREE from 'three';
import { createBigTrees, createYoungTrees, createShrubs, createWildGrass } from './Landscape.trees.js';

/**
 * Lanskap kawasan: vegetasi (pohon besar, pohon muda, semak, ilalang). Danau, sungai + jembatan,
 * jalan setapak helipad, dan venue baseball fiktif dihapus Plan C (I4); versi OSM ada di tile kota.
 * @param {{seed?: number, keep?: (x:number, z:number) => boolean}} [opts] keep: titik boleh bervegetasi (mask region)
 */
export function createLandscape(opts = {}) {
  const g = new THREE.Group();
  g.name = 'landscape';
  const seed = opts.seed ?? 11;
  const keep = opts.keep ?? (() => true);
  g.add(createBigTrees(seed, keep));
  g.add(createYoungTrees(seed + 12, keep));
  g.add(createShrubs(seed + 20, keep));
  g.add(createWildGrass(seed + 30, undefined, keep));
  return g;
}
