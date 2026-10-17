import * as THREE from 'three';
import { createBigTrees, createYoungTrees, createShrubs, createWildGrass } from './Landscape.trees.js';

/**
 * Lanskap kawasan: vegetasi (pohon besar, pohon muda, semak, ilalang). Danau, sungai + jembatan,
 * jalan setapak helipad, dan venue baseball fiktif dihapus Plan C (I4); versi OSM ada di tile kota.
 */
export function createLandscape(opts = {}) {
  const g = new THREE.Group();
  g.name = 'landscape';
  g.add(createBigTrees(opts.seed ?? 11));
  g.add(createYoungTrees((opts.seed ?? 11) + 12));
  g.add(createShrubs((opts.seed ?? 11) + 20));
  g.add(createWildGrass((opts.seed ?? 11) + 30));
  return g;
}
