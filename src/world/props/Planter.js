import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { instancePart, instanceParts, localMatrix, placeObject } from '../siteutil/instanceParts.js';
import { createRandom } from '../siteutil/rng.js';

/**
 * Pot bunga beton bulat dengan tanaman hijau & bunga kecil berwarna.
 */
export const PLANTER = Object.freeze({
  rTop: 0.65, rBottom: 0.5, height: 0.6,
  colors: { beton: 0xb4b0a6, tanah: 0x5a4330, daun: 0x3c8a35, bunga: [0xe63946, 0xf4c20d, 0xf07ab8, 0xffffff] },
});

const potGeo = new THREE.CylinderGeometry(PLANTER.rTop, PLANTER.rBottom, PLANTER.height, 14).translate(0, PLANTER.height / 2, 0);
const soilGeo = new THREE.CylinderGeometry(PLANTER.rTop - 0.08, PLANTER.rTop - 0.08, 0.05, 14).translate(0, PLANTER.height - 0.02, 0);
const leafGeo = new THREE.SphereGeometry(0.42, 8, 6).scale(1, 0.8, 1);
const flowerGeo = new THREE.SphereGeometry(0.07, 5, 4);
const potMat = new THREE.MeshLambertMaterial({ color: PLANTER.colors.beton });
const soilMat = new THREE.MeshLambertMaterial({ color: PLANTER.colors.tanah });
const leafMat = new THREE.MeshLambertMaterial({ color: PLANTER.colors.daun });

/** Tiga gumpalan daun bertumpuk. */
function leafParts() {
  return [
    localMatrix(0, PLANTER.height + 0.25, 0),
    localMatrix(0.25, PLANTER.height + 0.15, 0.15, 0, 0, 0, 0.8),
    localMatrix(-0.22, PLANTER.height + 0.18, -0.12, 0, 0, 0, 0.75),
  ].map((matrix, i) => ({ geometry: leafGeo, material: leafMat, matrix, name: `daun-${i}` }));
}

/** Posisi bunga kecil di atas tajuk (deterministik). */
function flowerMatrices() {
  return [[0.1, 0.62, 0.2], [-0.25, 0.55, 0.05], [0.3, 0.5, -0.2], [-0.05, 0.66, -0.25], [0.2, 0.58, 0.32]]
    .map(([x, y, z]) => localMatrix(x, PLANTER.height + y, z));
}

/** Satu pot bunga. opts: { x, z, rotY, flowerColor } */
export function createPlanter(opts = {}) {
  const g = new THREE.Group();
  g.name = 'potBunga';
  g.add(new THREE.Mesh(potGeo, potMat), new THREE.Mesh(soilGeo, soilMat));
  leafParts().forEach((p) => {
    const m = new THREE.Mesh(p.geometry, p.material);
    m.applyMatrix4(p.matrix);
    m.castShadow = true;
    g.add(m);
  });
  const fMat = new THREE.MeshLambertMaterial({ color: opts.flowerColor ?? PLANTER.colors.bunga[0] });
  flowerMatrices().forEach((mtx) => {
    const f = new THREE.Mesh(flowerGeo, fMat);
    f.applyMatrix4(mtx);
    g.add(f);
  });
  g.children[0].castShadow = true;
  return placeObject(g, opts);
}

/** Geometri lima bunga digabung (satu draw call untuk semua pot). */
function mergedFlowerGeometry() {
  return mergeGeometries(flowerMatrices().map((m) => flowerGeo.clone().applyMatrix4(m)), false);
}

/** Banyak pot instanced (tanpa bayangan: kecil); bunga diberi warna per-instance acak. positions: [{x,z,rotY?}] */
export function createPlanters(positions = [], opts = {}) {
  const g = new THREE.Group();
  g.name = 'potBunga';
  if (!positions.length) return g;
  const rnd = createRandom(opts.seed ?? 5);
  g.add(instanceParts([
    { geometry: potGeo, material: potMat, name: 'pot' },
    { geometry: soilGeo, material: soilMat, name: 'tanah' },
    ...leafParts(),
  ], positions, 'potDanDaun'));
  const fMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const c = new THREE.Color();
  const flowers = instancePart({ geometry: mergedFlowerGeometry(), material: fMat, name: 'bunga' }, positions);
  positions.forEach((_, i) => flowers.setColorAt(i, c.setHex(rnd.pick(PLANTER.colors.bunga))));
  flowers.instanceColor.needsUpdate = true;
  g.add(flowers);
  g.userData.count = positions.length;
  return g;
}
