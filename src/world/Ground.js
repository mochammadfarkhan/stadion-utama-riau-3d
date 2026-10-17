import * as THREE from 'three';
import { SITE, STADIUM, SURFACE_Y } from '../config/constants.js';
import { ellipseRingGeometry } from './siteutil/ellipseGeo.js';
import { groundMaterials, GROUND_COLORS, LAYER_Y } from './Ground.materials.js';
import {
  createRingRoad, createConnectorRoads,
  createParkingLot, createJoggingTrack,
} from './Ground.roads.js';

/**
 * Tanah kawasan: rumput, plaza paving oval, jalan, parkir. Helipad, amfiteater, dan lintasan
 * sepatu roda fiktif dihapus Plan C (I4). Tidak ada apa pun di dalam elips stadion.
 */

/** Persegi tanah lama ±groundSize/2 (dipakai bila region tidak memberi outline). */
const squareOutline = (half) => [[-half, -half], [half, -half], [half, half], [-half, half]];

/**
 * Bidang tanah berbentuk `outline` (mask region, [[x, z], ...]) dengan lubang elips di bawah stadion
 * agar tidak berimpit (z-fighting) dengan apron, lintasan, dan lapangan. Di luar outline: tanah
 * tile kota (Plan C Fase 3). Titik Shape (x, −z) karena rotateX(−π/2) memetakan y → −z. UV = meter.
 */
function createGroundWithHole(outline) {
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
  const hole = new THREE.Path();
  const inset = SURFACE_Y.groundHoleInset;
  hole.absellipse(0, 0, STADIUM.innerSemiX - inset, STADIUM.innerSemiZ - inset, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape, 96);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Tanah rumput region (UV dalam meter agar tekstur rumput berulang tiap 4 m). */
function createGrassPlane(outline) {
  const m = groundMaterials();
  const mesh = new THREE.Mesh(createGroundWithHole(outline), m.grass);
  mesh.position.y = LAYER_Y.ground;
  mesh.receiveShadow = true;
  mesh.name = 'rumput';
  return mesh;
}

/** Plaza paving oval di antara cangkang stadion dan batas plaza (UV ShapeGeometry = meter). */
function createPlaza() {
  const m = groundMaterials();
  const geo = ellipseRingGeometry(SITE.plazaSemiX, SITE.plazaSemiZ, STADIUM.outerSemiX, STADIUM.outerSemiZ);
  const mesh = new THREE.Mesh(geo, m.paving);
  mesh.position.y = LAYER_Y.plaza;
  mesh.receiveShadow = true;
  mesh.name = 'plazaPaving';
  return mesh;
}

/**
 * Group lengkap tanah & infrastruktur datar kawasan.
 * @param {{outline?: Array<[number, number]>|null, name?: string}} [opts] outline = mask region (default persegi lama)
 */
export function createGround(opts = {}) {
  const g = new THREE.Group();
  g.name = 'ground';
  g.add(createGrassPlane(opts.outline ?? squareOutline(SITE.groundSize / 2)));
  g.add(createPlaza());
  g.add(createRingRoad());
  g.add(createConnectorRoads());
  g.add(createParkingLot('car'));
  g.add(createParkingLot('moto'));
  g.add(createJoggingTrack());
  g.userData.colors = GROUND_COLORS;
  if (opts.name) g.name = opts.name;
  return g;
}
