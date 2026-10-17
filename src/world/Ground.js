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

/**
 * Bidang tanah persegi dengan lubang elips di bawah stadion agar tidak berimpit
 * (z-fighting) dengan apron, lintasan, dan lapangan. UV ShapeGeometry = meter.
 */
function createGroundWithHole() {
  const half = SITE.groundSize / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half, -half);
  shape.lineTo(half, -half);
  shape.lineTo(half, half);
  shape.lineTo(-half, half);
  shape.closePath();
  const hole = new THREE.Path();
  const inset = SURFACE_Y.groundHoleInset;
  hole.absellipse(0, 0, STADIUM.innerSemiX - inset, STADIUM.innerSemiZ - inset, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape, 96);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Tanah rumput besar (UV dalam meter agar tekstur rumput berulang tiap 4 m). */
function createGrassPlane() {
  const m = groundMaterials();
  const mesh = new THREE.Mesh(createGroundWithHole(), m.grass);
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

/** Group lengkap tanah & infrastruktur datar kawasan. */
export function createGround(opts = {}) {
  const g = new THREE.Group();
  g.name = 'ground';
  g.add(createGrassPlane());
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
