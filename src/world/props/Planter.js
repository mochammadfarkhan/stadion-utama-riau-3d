import * as THREE from 'three';
import { instancePart, instanceParts, placeObject, colorizeInstances } from '../siteutil/instanceParts.js';
import { createRandom } from '../siteutil/rng.js';
import { blobCluster, mergeAll } from '../siteutil/rounded.js';

/**
 * Pot bunga gaya cozy: pot bulat gemuk (lathe), tanaman 4 bola saling
 * tumpang tindih, dan 3 bunga bola berwarna (warna per-instance).
 */
export const PLANTER = Object.freeze({
  rTop: 0.62, rBottom: 0.42, height: 0.6,
  colors: { beton: 0xd7ccc8, tanah: 0x8d6e63, daun: 0x9ccc65, bunga: [0xef9a9a, 0xfff176, 0xf48fb1, 0xffffff, 0xffcc80] },
});
const FLOWER_R = 0.11;
const FLOWER_SPOTS = Object.freeze([[0.12, 0.66, 0.22], [-0.27, 0.6, 0.02], [0.2, 0.7, -0.26]]);

/** Profil pot gemuk (radius, tinggi) diputar jadi LatheGeometry; dasar di y=0. */
function potGeometry() {
  const { rTop, rBottom, height } = PLANTER;
  const profile = [
    [0, 0], [rBottom * 0.85, 0], [rBottom, 0.05], [rTop * 1.02, height * 0.5],
    [rTop, height * 0.82], [rTop * 1.08, height * 0.9], [rTop * 1.08, height], [rTop * 0.9, height], [rTop * 0.9, height - 0.06], [0, height - 0.06],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(profile, 14);
}

/** Tiga bola bunga digabung; satu material putih diwarnai per-instance. */
function flowerGeometry() {
  return mergeAll(FLOWER_SPOTS.map(([x, y, z]) => new THREE.SphereGeometry(FLOWER_R, 6, 5).translate(x, PLANTER.height + y, z)));
}

const potGeo = potGeometry();
const soilGeo = new THREE.CylinderGeometry(PLANTER.rTop * 0.88, PLANTER.rTop * 0.88, 0.05, 14).translate(0, PLANTER.height - 0.05, 0);
const leafGeo = blobCluster({ count: 4, radius: 0.4, spread: 0.3, flat: 0.9, center: [0, PLANTER.height + 0.3, 0], vertical: 0.1 }, createRandom(55));
const flowerGeo = flowerGeometry();
const potMat = new THREE.MeshLambertMaterial({ color: PLANTER.colors.beton });
const soilMat = new THREE.MeshLambertMaterial({ color: PLANTER.colors.tanah });
const leafMat = new THREE.MeshLambertMaterial({ color: PLANTER.colors.daun });

/** Part statis pot: pot, tanah, gumpalan daun. */
function potParts() {
  return [
    { geometry: potGeo, material: potMat, name: 'pot' },
    { geometry: soilGeo, material: soilMat, name: 'tanah' },
    { geometry: leafGeo, material: leafMat, name: 'daun' },
  ];
}

/** Satu pot bunga. opts: { x, z, rotY, flowerColor } */
export function createPlanter(opts = {}) {
  const g = new THREE.Group();
  g.name = 'potBunga';
  potParts().forEach((p) => {
    const m = new THREE.Mesh(p.geometry, p.material);
    m.name = p.name;
    g.add(m);
  });
  const fMat = new THREE.MeshLambertMaterial({ color: opts.flowerColor ?? PLANTER.colors.bunga[0] });
  const flowers = new THREE.Mesh(flowerGeo, fMat);
  flowers.name = 'bunga';
  g.add(flowers);
  return placeObject(g, opts);
}

/** Banyak pot instanced (tanpa bayangan: kecil); bunga diberi warna per-instance acak. positions: [{x,z,rotY?}] */
export function createPlanters(positions = [], opts = {}) {
  const g = new THREE.Group();
  g.name = 'potBunga';
  if (!positions.length) return g;
  const rnd = createRandom(opts.seed ?? 5);
  g.add(instanceParts(potParts(), positions, 'potDanDaun'));
  const flowers = instancePart({ geometry: flowerGeo, material: new THREE.MeshLambertMaterial({ color: 0xffffff }), name: 'bunga' }, positions);
  colorizeInstances(flowers, PLANTER.colors.bunga, rnd);
  g.add(flowers);
  g.userData.count = positions.length;
  return g;
}
