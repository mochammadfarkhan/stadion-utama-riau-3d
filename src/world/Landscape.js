import * as THREE from 'three';
import { SITE } from '../config/constants.js';
import { createLake, createRiver, createSteelBridge, createWaterMaterial, animateWater } from './Landscape.water.js';
import { createBigTrees, createYoungTrees, createShrubs, createWildGrass } from './Landscape.trees.js';
import { createBaseballVenue } from './Landscape.baseball.js';
import { groundMaterials } from './Ground.materials.js';

/**
 * Lanskap kawasan: danau, sungai + jembatan, vegetasi, venue baseball.
 * Group mengembalikan userData.update(dt, t) untuk animasi air.
 */
const PATH_TO_HELIPAD = Object.freeze({ width: 3, y: 0.045 });

/** Jalan setapak beton dari jalan lingkar timur ke jembatan & helipad. */
function createHelipadPath() {
  const m = groundMaterials();
  const xFrom = SITE.ringRoadSemiX + SITE.joggingTrackOffset + 4;
  const xTo = SITE.helipadCenter.x - SITE.helipadCenter.r;
  const z = SITE.bridgeZ;
  const g = new THREE.Group();
  g.name = 'jalanSetapakHelipad';
  const parts = [
    [xFrom, SITE.riverX - 9],
    [SITE.riverX + 9, xTo],
  ];
  parts.forEach(([a, b]) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(b - a, PATH_TO_HELIPAD.width), m.concrete);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((a + b) / 2, PATH_TO_HELIPAD.y, z);
    mesh.receiveShadow = true;
    g.add(mesh);
  });
  return g;
}

/** Group lanskap lengkap. */
export function createLandscape(opts = {}) {
  const g = new THREE.Group();
  g.name = 'landscape';
  const riverMat = createWaterMaterial(0x3a6f82);
  const lake = createLake();
  const river = createRiver(riverMat);
  g.add(lake, river, createSteelBridge(), createHelipadPath());
  g.add(createBigTrees(opts.seed ?? 11));
  g.add(createYoungTrees((opts.seed ?? 11) + 12));
  g.add(createShrubs((opts.seed ?? 11) + 20));
  g.add(createWildGrass((opts.seed ?? 11) + 30));
  g.add(createBaseballVenue());
  const waterMats = [lake.userData.waterMaterial, riverMat];
  g.userData.update = (dt, t) => waterMats.forEach((mat) => animateWater(mat, dt, t));
  return g;
}
