/**
 * Lintasan atletik 400 m 8 lane (lurus 84,39 m sejajar Z, kerb 36,2 m),
 * garis lane, kerb, garis start/finish, nomor lane, lurus 100 m sisi barat,
 * apron beton sampai kaki tribun, dan parit drainase keliling.
 */
import * as THREE from 'three';
import { TRACK, STADIUM, COLORS } from '../../config/constants.js';
import {
  stadiumShape, stadiumPath, ellipseShape, flatShapeGeometry, mergeFlat, createCanvasTexture,
} from './ovalMath.js';

const HALF_STRAIGHT = TRACK.straightLength / 2;
const KERB_R = TRACK.innerRadius - TRACK.kerbOffset; // tepi dalam lane 1
const OUTER_R = KERB_R + TRACK.laneCount * TRACK.laneWidth;
const OUTER_MARGIN = 1.0;
const LINE_W = 0.05;
const KERB_W = 0.15;
const KERB_H = 0.05;
const CURVE_SEG = 48;
const LINE_Y = 0.01;
const APRON_Y = -0.01;
const DRAIN_W = 0.35;
const EXTRA_LANES = 2;
const EXTRA_LEN = 117; // 100 m + run-off
const FINISH_Z = HALF_STRAIGHT; // ujung selatan lurus barat (lari berlawanan jarum jam)
const NUMBER_SIZE = 0.8;
const COLOR_APRON = 0x8d8b86;
const COLOR_DRAIN = 0x2a2a2a;

/** Permukaan tartan oval dengan lubang dalam. */
function createSurface(mat) {
  const g = flatShapeGeometry(
    stadiumShape(HALF_STRAIGHT, OUTER_R + OUTER_MARGIN),
    [stadiumPath(HALF_STRAIGHT, KERB_R)],
    CURVE_SEG,
  );
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'tartan';
  mesh.receiveShadow = true;
  return mesh;
}

/** Cincin tipis (oval) selebar w pada radius r. */
function ringGeom(r, w) {
  const g = flatShapeGeometry(
    stadiumShape(HALF_STRAIGHT, r + w / 2),
    [stadiumPath(HALF_STRAIGHT, r - w / 2)],
    CURVE_SEG,
  );
  g.translate(0, LINE_Y, 0);
  return g;
}

/** 9 garis lane putih digabung satu mesh. */
function createLaneLines(mat) {
  const geoms = [];
  for (let k = 0; k <= TRACK.laneCount; k++) {
    geoms.push(ringGeom(KERB_R + k * TRACK.laneWidth, LINE_W));
  }
  const mesh = new THREE.Mesh(mergeFlat(geoms), mat);
  mesh.name = 'garisLane';
  return mesh;
}

/** Kerb putih timbul di sisi dalam. */
function createKerb(mat) {
  const s = stadiumShape(HALF_STRAIGHT, KERB_R);
  s.holes = [stadiumPath(HALF_STRAIGHT, KERB_R - KERB_W)];
  const g = new THREE.ExtrudeGeometry(s, { depth: KERB_H, bevelEnabled: false, curveSegments: CURVE_SEG });
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'kerb';
  return mesh;
}

/** Garis finish melintang 8 lane di lurus barat + garis start 100 m. */
function createStartFinish(mat) {
  const laneSpan = TRACK.laneCount * TRACK.laneWidth;
  const finish = new THREE.BoxGeometry(laneSpan, 0.01, LINE_W * 2);
  finish.translate(-(KERB_R + laneSpan / 2), LINE_Y, FINISH_Z);
  const extraSpan = EXTRA_LANES * TRACK.laneWidth;
  const start100 = new THREE.BoxGeometry(extraSpan, 0.01, LINE_W * 2);
  start100.translate(-(OUTER_R + extraSpan / 2), LINE_Y + 0.002, FINISH_Z - 100);
  const finish100 = start100.clone().translate(0, 0, 100);
  const mesh = new THREE.Mesh(mergeFlat([finish, start100, finish100]), mat);
  mesh.name = 'garisFinish';
  return mesh;
}

/** Nomor lane 1–8 sebelum garis finish (CanvasTexture; dilewati tanpa document). */
function createLaneNumbers() {
  const group = new THREE.Group();
  group.name = 'nomorLane';
  for (let k = 0; k < TRACK.laneCount; k++) {
    const tex = createCanvasTexture(64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 52px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(k + 1), w / 2, h / 2);
    });
    if (!tex) break;
    const g = new THREE.PlaneGeometry(NUMBER_SIZE, NUMBER_SIZE);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.PI); // terbaca oleh pelari yang datang dari utara
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    mesh.position.set(-(KERB_R + (k + 0.5) * TRACK.laneWidth), LINE_Y + 0.003, FINISH_Z - 1.5);
    group.add(mesh);
  }
  group.userData.count = group.children.length;
  return group;
}

/** Lurus 100 m tambahan (2 lane) menempel di sisi barat lintasan. */
function createExtraStraight(tartanMat, lineMat) {
  const group = new THREE.Group();
  group.name = 'lurus100';
  const span = EXTRA_LANES * TRACK.laneWidth;
  const cz = FINISH_Z - 100 / 2 - 3; // start di z = FINISH_Z−100, run-off setelah finish
  const surf = new THREE.PlaneGeometry(span + OUTER_MARGIN, EXTRA_LEN);
  surf.rotateX(-Math.PI / 2);
  surf.translate(-(OUTER_R + (span + OUTER_MARGIN) / 2), 0.004, cz);
  group.add(new THREE.Mesh(surf, tartanMat));
  const lines = [];
  for (let k = 0; k <= EXTRA_LANES; k++) {
    const l = new THREE.PlaneGeometry(LINE_W, EXTRA_LEN);
    l.rotateX(-Math.PI / 2);
    l.translate(-(OUTER_R + k * TRACK.laneWidth), LINE_Y, cz);
    lines.push(l);
  }
  group.add(new THREE.Mesh(mergeFlat(lines), lineMat));
  return group;
}

/** Apron beton dari tepi lintasan ke elips kaki tribun. */
function createApron() {
  const g = flatShapeGeometry(
    ellipseShape(STADIUM.innerSemiX, STADIUM.innerSemiZ),
    [stadiumPath(HALF_STRAIGHT, OUTER_R + OUTER_MARGIN)],
    96,
  );
  g.translate(0, APRON_Y, 0);
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: COLOR_APRON }));
  mesh.name = 'apron';
  mesh.receiveShadow = true;
  return mesh;
}

/** Parit drainase gelap keliling tepi luar lintasan. */
function createDrain() {
  const r0 = OUTER_R + OUTER_MARGIN;
  const g = flatShapeGeometry(
    stadiumShape(HALF_STRAIGHT, r0 + DRAIN_W),
    [stadiumPath(HALF_STRAIGHT, r0)],
    CURVE_SEG,
  );
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: COLOR_DRAIN }));
  mesh.name = 'drainase';
  return mesh;
}

/**
 * Bangun lintasan atletik lengkap beserta apron.
 * @param {{}} opts
 * @returns {THREE.Group}
 */
export function createTrack(opts = {}) {
  void opts;
  const tartanMat = new THREE.MeshLambertMaterial({ color: TRACK.color });
  const lineMat = new THREE.MeshBasicMaterial({ color: TRACK.lineColor, polygonOffset: true, polygonOffsetFactor: -1 });
  const kerbMat = new THREE.MeshLambertMaterial({ color: TRACK.lineColor });
  const group = new THREE.Group();
  group.name = 'track';
  group.add(
    createApron(), createDrain(), createSurface(tartanMat), createLaneLines(lineMat),
    createKerb(kerbMat), createStartFinish(lineMat), createLaneNumbers(),
    createExtraStraight(tartanMat, lineMat),
  );
  group.userData.geometry = Object.freeze({
    halfStraight: HALF_STRAIGHT, kerbRadius: KERB_R, outerRadius: OUTER_R, finishZ: FINISH_Z,
    laneWidth: TRACK.laneWidth, laneCount: TRACK.laneCount, asphaltColor: COLORS.asphalt,
  });
  return group;
}
