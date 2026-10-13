import * as THREE from 'three';
import { SITE, STADIUM } from '../config/constants.js';
import { ellipseRingGeometry } from './siteutil/ellipseGeo.js';
import { groundMaterials, GROUND_COLORS, LAYER_Y, uvToMeters } from './Ground.materials.js';
import {
  createRingRoad, createNagaSakti, createConnectorRoads,
  createParkingLot, createJoggingTrack, createSkateTrack,
} from './Ground.roads.js';

/**
 * Tanah kawasan: rumput, plaza paving oval, jalan, parkir, helipad, amphitheater.
 * Tidak ada apa pun di dalam elips stadion (outerSemiX × outerSemiZ).
 */
const HELIPAD = Object.freeze({ ringInner: 10.5, ringOuter: 11.5, hBar: 6, hWidth: 1.1, hGap: 2.4 });
const AMPHI = Object.freeze({ steps: 6, innerR: 6, stepR: 2.6, stepH: 0.45, stageR: 5.5 });

/** Tanah rumput besar (UV dalam meter agar tekstur rumput berulang tiap 4 m). */
function createGrassPlane() {
  const m = groundMaterials();
  const geo = uvToMeters(new THREE.PlaneGeometry(SITE.groundSize, SITE.groundSize, 8, 8), SITE.groundSize, SITE.groundSize);
  const mesh = new THREE.Mesh(geo, m.grass);
  mesh.rotation.x = -Math.PI / 2;
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

/** Helipad: lingkaran beton, cincin putih, huruf H. */
export function createHelipad() {
  const m = groundMaterials();
  const { x, z, r } = SITE.helipadCenter;
  const g = new THREE.Group();
  g.name = 'helipad';
  const pad = new THREE.Mesh(uvToMeters(new THREE.CircleGeometry(r, 48), r * 2, r * 2), m.concrete);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = LAYER_Y.road;
  pad.receiveShadow = true;
  g.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(HELIPAD.ringInner, HELIPAD.ringOuter, 48), m.lineWhite);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = LAYER_Y.marking;
  g.add(ring);
  const barGeo = new THREE.BoxGeometry(HELIPAD.hWidth, 0.02, HELIPAD.hBar);
  [-1, 1].forEach((s) => {
    const bar = new THREE.Mesh(barGeo, m.lineWhite);
    bar.position.set(s * HELIPAD.hGap, LAYER_Y.marking, 0);
    g.add(bar);
  });
  const cross = new THREE.Mesh(new THREE.BoxGeometry(HELIPAD.hGap * 2, 0.02, HELIPAD.hWidth), m.lineWhite);
  cross.position.y = LAYER_Y.marking;
  g.add(cross);
  g.position.set(x, 0, z);
  return g;
}

/** Shape setengah cincin (bukaan menghadap +Z setelah rotasi). */
function halfRingShape(rIn, rOut) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, Math.PI, false);
  s.absarc(0, 0, rIn, Math.PI, 0, true);
  return s;
}

/** Amphitheater kecil: undakan setengah lingkaran + panggung bundar. */
export function createAmphitheater() {
  const m = groundMaterials();
  const { x, z } = SITE.amphitheaterCenter;
  const g = new THREE.Group();
  g.name = 'amphitheater';
  for (let i = 0; i < AMPHI.steps; i += 1) {
    const rIn = AMPHI.innerR + i * AMPHI.stepR;
    const geo = new THREE.ExtrudeGeometry(halfRingShape(rIn, rIn + AMPHI.stepR), {
      depth: AMPHI.stepH * (i + 1), bevelEnabled: false, curveSegments: 24,
    });
    geo.rotateX(-Math.PI / 2);
    const step = new THREE.Mesh(geo, m.amphitheater);
    step.castShadow = true;
    step.receiveShadow = true;
    g.add(step);
  }
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(AMPHI.stageR, AMPHI.stageR, 0.3, 32), m.concrete);
  stage.position.y = 0.15;
  stage.receiveShadow = true;
  g.add(stage);
  g.position.set(x, 0, z);
  return g;
}

/** Group lengkap tanah & infrastruktur datar kawasan. */
export function createGround(opts = {}) {
  const g = new THREE.Group();
  g.name = 'ground';
  g.add(createGrassPlane());
  g.add(createPlaza());
  g.add(createRingRoad());
  g.add(createNagaSakti());
  g.add(createConnectorRoads());
  g.add(createParkingLot('car'));
  g.add(createParkingLot('moto'));
  g.add(createJoggingTrack());
  g.add(createSkateTrack());
  g.add(createHelipad());
  g.add(createAmphitheater());
  g.userData.colors = GROUND_COLORS;
  if (opts.name) g.name = opts.name;
  return g;
}
