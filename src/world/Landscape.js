import * as THREE from 'three';
import { createBigTrees, createYoungTrees, createShrubs } from './Landscape.trees.js';

/**
 * Lanskap kawasan: vegetasi (pohon besar, pohon muda, semak). Danau, sungai + jembatan, jalan setapak
 * helipad, dan venue baseball fiktif dihapus Plan C (I4); versi OSM ada di tile kota. Ilalang dihapus Plan C
 * Task 19 (rumpunnya di sudut persegi 1,4 km, kini wilayah kota; vegetasi dari landuse = backlog).
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
  return g;
}
