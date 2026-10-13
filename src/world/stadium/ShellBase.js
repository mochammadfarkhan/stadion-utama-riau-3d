/**
 * Dasar cangkang: dinding concourse beton lantai dasar (dengan bukaan gate nyata),
 * sabuk kolom, pelat lantai concourse lantai 1, dan tangga beton lebar di 4 sisi.
 */
import { BoxGeometry, CylinderGeometry, Group, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STADIUM } from '../../config/constants.js';
import { Materials } from '../materials.js';
import { instancedFromMatrices } from '../util/instancing.js';
import { GATES, STAIR_U, STAIR_WIDTH, gateHalfSpan, isInsideGate } from './gateLayout.js';
import { frameAt, framePoint, outerEllipse } from './ovalFrame.js';
import { buildRingGeometry } from './ringGeometry.js';

const WALL_K = 0.02;
const WALL_H = STADIUM.concourseHeight;
const COLUMN_K = -0.012;
const COLUMN_RADIUS = 0.45;
const COLUMN_SPACING = 7.5;
const SLAB_DEPTH_K = 0.26;
const STAIR_STEPS = 15;
const STAIR_TREAD = 0.9;
const GATE_EDGE_MARGIN = 0.3;

/** Potongan dinding antar gate + ambang (lintel) di atas tiap gate, digabung jadi satu geometri. */
function buildWallGeometry() {
  const sorted = [...GATES].sort((a, b) => a.u - b.u);
  const parts = [];
  sorted.forEach((gate, i) => {
    const next = sorted[(i + 1) % sorted.length];
    const start = gate.u + gateHalfSpan(gate, GATE_EDGE_MARGIN);
    const end = (i + 1 < sorted.length ? next.u : next.u + 1) - gateHalfSpan(next, GATE_EDGE_MARGIN);
    parts.push(buildRingGeometry({ profile: [{ k: WALL_K, y: 0 }, { k: WALL_K, y: WALL_H }], uStart: start, uEnd: end }));
    const half = gateHalfSpan(gate, GATE_EDGE_MARGIN);
    parts.push(buildRingGeometry({
      profile: [{ k: WALL_K, y: gate.height }, { k: WALL_K, y: WALL_H }],
      uStart: gate.u - half,
      uEnd: gate.u + half,
      segments: 6,
    }));
  });
  return mergeGeometries(parts, false);
}

function createWall() {
  const mesh = new Mesh(buildWallGeometry(), Materials.concrete());
  mesh.name = 'concourse-wall';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Sabuk kolom bulat di depan dinding, dilewati pada bukaan gate. */
function createColumns() {
  const count = Math.round(outerEllipse().perimeter / COLUMN_SPACING);
  const mats = [];
  const q = new Quaternion();
  const s = new Vector3(1, WALL_H, 1);
  for (let i = 0; i < count; i++) {
    const u = i / count;
    if (isInsideGate(u, 1.0)) continue;
    mats.push(new Matrix4().compose(framePoint(u, COLUMN_K, WALL_H / 2), q, s));
  }
  const geom = new CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS, 1, 10);
  const mesh = instancedFromMatrices(geom, Materials.concreteDark(), mats, 'concourse-columns');
  mesh.castShadow = true;
  return mesh;
}

/** Pelat lantai concourse lantai 1 (permukaan atas di y = WALL_H). */
function createSlab() {
  const geom = buildRingGeometry({ profile: [{ k: 0, y: WALL_H }, { k: SLAB_DEPTH_K, y: WALL_H }], flip: true });
  const mesh = new Mesh(geom, Materials.concrete());
  mesh.name = 'concourse-slab';
  mesh.receiveShadow = true;
  return mesh;
}

/** Matriks anak tangga (balok pejal dari tanah) untuk satu tangga di u. */
function collectStair(u, out) {
  const f = frameAt(u);
  const rise = WALL_H / STAIR_STEPS;
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), f.yaw);
  for (let i = 0; i < STAIR_STEPS; i++) {
    const top = (i + 1) * rise;
    const dist = (STAIR_STEPS - i - 0.5) * STAIR_TREAD;
    const pos = new Vector3(f.x + f.nx * dist, top / 2, f.z + f.nz * dist);
    out.push(new Matrix4().compose(pos, q, new Vector3(STAIR_WIDTH, top, STAIR_TREAD)));
  }
}

function createStairs() {
  const mats = [];
  STAIR_U.forEach((u) => collectStair(u, mats));
  const mesh = instancedFromMatrices(new BoxGeometry(1, 1, 1), Materials.concrete(), mats, 'stairs');
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** @param {{columns?:boolean, slab?:boolean, stairs?:boolean}} opts */
export function createShellBase({ columns = true, slab = true, stairs = true } = {}) {
  const group = new Group();
  group.name = 'shell-base';
  group.add(createWall());
  if (columns) group.add(createColumns());
  if (slab) group.add(createSlab());
  if (stairs) group.add(createStairs());
  return group;
}
