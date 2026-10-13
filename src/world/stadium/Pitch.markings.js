/**
 * Marka FIFA, gawang, dan bendera corner untuk Pitch.js.
 * Semua garis digabung menjadi satu mesh putih (1 draw call).
 */
import * as THREE from 'three';
import { PITCH } from '../../config/constants.js';
import { mergeFlat } from './ovalMath.js';

const LINE_Y = 0.015;
const SPOT_RADIUS = 0.2;
const CORNER_ARC_RADIUS = 1.0;
const ARC_SEGMENTS = 48;
const POST_RADIUS = 0.06;
const NET_DEPTH = PITCH.goalDepth;
const FLAG_HEIGHT = 1.5;
const COLOR_LINE = 0xffffff;
const COLOR_FLAG = 0xd62828;

const halfL = PITCH.length / 2;
const halfW = PITCH.width / 2;
const lw = PITCH.lineWidth;

/** Garis lurus: pusat (cx, cz), panjang sepanjang sumbu Z (alongZ) atau X. */
function lineGeom(cx, cz, length, alongZ) {
  const g = alongZ ? new THREE.PlaneGeometry(lw, length) : new THREE.PlaneGeometry(length, lw);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, LINE_Y, cz);
  return g;
}

/** Busur: sudut ring t diukur dari +X menuju −Z (akibat rotateX(−π/2)). */
function arcGeom(cx, cz, r, start, len) {
  const g = new THREE.RingGeometry(r - lw / 2, r + lw / 2, ARC_SEGMENTS, 1, start, len);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, LINE_Y, cz);
  return g;
}

function spotGeom(cx, cz) {
  const g = new THREE.CircleGeometry(SPOT_RADIUS, 16);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, LINE_Y, cz);
  return g;
}

/** Marka satu ujung lapangan (sign = −1 utara, +1 selatan). */
function endMarkings(sign) {
  const goalZ = sign * halfL;
  const penZ = sign * (halfL - PITCH.penaltyBoxLength);
  const gbZ = sign * (halfL - PITCH.goalBoxLength);
  const spotZ = sign * (halfL - PITCH.penaltySpot);
  const halfPen = PITCH.penaltyBoxWidth / 2;
  const halfGb = PITCH.goalBoxWidth / 2;
  const r = PITCH.centerCircleRadius;
  const alpha = Math.acos((PITCH.penaltyBoxLength - PITCH.penaltySpot) / r);
  // busur penalti mengarah ke tengah: arah −Z dunia = t +π/2, arah +Z = t −π/2
  const centerT = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
  const cornerStart = sign > 0 ? Math.PI / 2 : Math.PI;
  return [
    lineGeom(halfPen, (goalZ + penZ) / 2, PITCH.penaltyBoxLength, true),
    lineGeom(-halfPen, (goalZ + penZ) / 2, PITCH.penaltyBoxLength, true),
    lineGeom(0, penZ, PITCH.penaltyBoxWidth, false),
    lineGeom(halfGb, (goalZ + gbZ) / 2, PITCH.goalBoxLength, true),
    lineGeom(-halfGb, (goalZ + gbZ) / 2, PITCH.goalBoxLength, true),
    lineGeom(0, gbZ, PITCH.goalBoxWidth, false),
    spotGeom(0, spotZ),
    arcGeom(0, spotZ, r, centerT - alpha, alpha * 2),
    arcGeom(halfW, goalZ, CORNER_ARC_RADIUS, cornerStart, Math.PI / 2),
    arcGeom(-halfW, goalZ, CORNER_ARC_RADIUS, cornerStart - Math.PI / 2, Math.PI / 2),
  ];
}

/** Semua marka FIFA sebagai satu mesh. */
export function createMarkings() {
  const geoms = [
    lineGeom(halfW, 0, PITCH.length, true),
    lineGeom(-halfW, 0, PITCH.length, true),
    lineGeom(0, halfL, PITCH.width, false),
    lineGeom(0, -halfL, PITCH.width, false),
    lineGeom(0, 0, PITCH.width, false),
    arcGeom(0, 0, PITCH.centerCircleRadius, 0, Math.PI * 2),
    spotGeom(0, 0),
    ...endMarkings(-1),
    ...endMarkings(1),
  ];
  const mat = new THREE.MeshBasicMaterial({ color: COLOR_LINE, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(mergeFlat(geoms), mat);
  mesh.name = 'marka';
  return mesh;
}

/** Satu gawang di garis gawang z = 0 lokal; mulut ke +Z, jaring ke −Z. */
function buildGoal(frameMat, netMat, netPlaneMat) {
  const group = new THREE.Group();
  const hw = PITCH.goalWidth / 2;
  const h = PITCH.goalHeight;
  const post = new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, h, 10);
  const bar = new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, PITCH.goalWidth + POST_RADIUS * 2, 10);
  bar.rotateZ(Math.PI / 2);
  const stayLen = Math.hypot(NET_DEPTH, h);
  const stay = new THREE.CylinderGeometry(0.03, 0.03, stayLen, 6);
  stay.rotateX(Math.PI / 2 - Math.atan2(h, NET_DEPTH));
  const parts = [
    post.clone().translate(hw, h / 2, 0),
    post.clone().translate(-hw, h / 2, 0),
    bar.clone().translate(0, h, 0),
    stay.clone().translate(hw, h / 2, -NET_DEPTH / 2),
    stay.clone().translate(-hw, h / 2, -NET_DEPTH / 2),
  ];
  group.add(new THREE.Mesh(mergeFlat(parts), frameMat));
  const netBox = new THREE.BoxGeometry(PITCH.goalWidth, h, NET_DEPTH, 12, 4, 3);
  netBox.translate(0, h / 2, -NET_DEPTH / 2);
  group.add(new THREE.LineSegments(new THREE.WireframeGeometry(netBox), netMat));
  const back = new THREE.PlaneGeometry(PITCH.goalWidth, h);
  back.translate(0, h / 2, -NET_DEPTH);
  group.add(new THREE.Mesh(back, netPlaneMat));
  return group;
}

/** Dua gawang: utara (jaring ke −Z) dan selatan (jaring ke +Z). */
export function createGoals() {
  const frameMat = new THREE.MeshLambertMaterial({ color: COLOR_LINE });
  const netMat = new THREE.LineBasicMaterial({ color: COLOR_LINE, transparent: true, opacity: 0.5 });
  const netPlaneMat = new THREE.MeshBasicMaterial({
    color: COLOR_LINE, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false,
  });
  const group = new THREE.Group();
  group.name = 'gawang';
  const north = buildGoal(frameMat, netMat, netPlaneMat);
  north.position.z = -halfL;
  const south = north.clone();
  south.position.z = halfL;
  south.rotation.y = Math.PI;
  group.add(north, south);
  return group;
}

/** Empat bendera corner: tiang digabung, bendera digabung (2 draw call). */
export function createCornerFlags() {
  const poles = [];
  const flags = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pole = new THREE.CylinderGeometry(0.02, 0.025, FLAG_HEIGHT, 6);
      pole.translate(sx * halfW, FLAG_HEIGHT / 2, sz * halfL);
      poles.push(pole);
      const flag = new THREE.PlaneGeometry(0.4, 0.3);
      flag.translate(0.2, 0, 0);
      flag.rotateY(sx > 0 ? Math.PI : 0);
      flag.translate(sx * halfW, FLAG_HEIGHT - 0.2, sz * halfL);
      flags.push(flag);
    }
  }
  const group = new THREE.Group();
  group.name = 'benderaCorner';
  group.add(new THREE.Mesh(mergeFlat(poles), new THREE.MeshLambertMaterial({ color: 0xdddddd })));
  group.add(new THREE.Mesh(mergeFlat(flags), new THREE.MeshLambertMaterial({ color: COLOR_FLAG, side: THREE.DoubleSide })));
  return group;
}
