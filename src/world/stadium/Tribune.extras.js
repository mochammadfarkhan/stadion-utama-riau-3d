/**
 * Pelengkap tribun: tangga vomitory per sektor, railing tepi depan tiap tier,
 * dan VIP box tribun barat (kanopi kaca + tiang + railing).
 * Tangga/railing/tiang yang jatuh di koridor terowongan gate utama dilewati.
 */
import * as THREE from 'three';
import {
  createEllipseArcTable, ellipseAngleAtArc, ellipsePoint, ellipseRingExtrude, ellipseRingExtrudeGapped,
  mergeFlat,
} from './ovalMath.js';
import {
  BASE_A, BASE_B, ROW_DEPTH, SECTOR_COUNT, VOMITORY_W, WEST_THETA, CURVE_SEG,
} from './Tribune.layout.js';
import {
  GAP_HALF, arcInRanges, corridorArcRanges, corridorGapsOnRing, isRowCut, thetaInGaps,
} from './tunnelLayout.js';

const STAIR_COLOR = 0x9a968c;
const RAIL_COLOR = 0x4a4f55;
const RAIL_H = 1.0;
const RAIL_W = 0.05;
const POST_SPACING = 2.0;
const POST_R = 0.02;
const VIP_ROW_FROM = 6;
const VIP_ROW_TO = 14;
const VIP_CANOPY_LEN = 24;   // sepanjang Z
const VIP_CANOPY_DEPTH = 8;  // sepanjang X
const VIP_CANOPY_LIFT = 3.2;
const GLASS_COLOR = 0xbfe3ff;

/** Anak tangga setengah-rise di tiap batas sektor, semua baris (1 mesh). */
export function createVomitoryStairs(layout) {
  const geoms = [];
  const dummy = new THREE.Object3D();
  const step = (Math.PI * 2) / SECTOR_COUNT;
  for (const tier of layout.tiers) {
    for (let row = 0; row < tier.rows; row++) {
      const offset = tier.offset0 + row * ROW_DEPTH;
      const y = tier.y0 + row * tier.rise;
      const gaps = stairGaps(offset, y);
      for (let k = 0; k < SECTOR_COUNT; k++) {
        if (thetaInGaps(gaps, k * step)) continue;
        geoms.push(stairBox(dummy, offset + ROW_DEPTH * 0.25, y, k * step, tier.rise));
      }
    }
  }
  const mesh = new THREE.Mesh(mergeFlat(geoms), new THREE.MeshLambertMaterial({ color: STAIR_COLOR }));
  mesh.name = 'tanggaVomitory';
  mesh.receiveShadow = true;
  return mesh;
}

/** Celah koridor terowongan untuk tangga baris ini (dilebarkan selebar anak tangga). */
function stairGaps(offset, y) {
  if (!isRowCut(y)) return [];
  return corridorGapsOnRing(BASE_A + offset, BASE_B + offset, GAP_HALF + VOMITORY_W);
}

function stairBox(dummy, offset, y, theta, rise) {
  const p = ellipsePoint(BASE_A + offset, BASE_B + offset, theta);
  const g = new THREE.BoxGeometry(VOMITORY_W - 0.2, rise / 2, ROW_DEPTH / 2);
  g.translate(0, rise * 0.75, 0);
  dummy.position.set(p.x, y, p.z);
  dummy.lookAt(0, y, 0);
  dummy.updateMatrix();
  g.applyMatrix4(dummy.matrix);
  return g;
}

/** Railing: rel atas (ring elips, 1 mesh) + tiang instanced (1 mesh). */
export function createRailings(layout) {
  const group = new THREE.Group();
  group.name = 'railing';
  const rails = [];
  const posts = [];
  for (const tier of layout.tiers) {
    const railY = tier.y0 + RAIL_H; // tier atas: setara puncak parapet balkon
    rails.push(railRing(tier, railY));
    posts.push(...postTransforms(tier.offset0, railY - RAIL_H / 2, isRowCut(tier.y0)));
  }
  group.add(new THREE.Mesh(mergeFlat(rails), new THREE.MeshLambertMaterial({ color: RAIL_COLOR })));
  const postGeom = new THREE.CylinderGeometry(POST_R, POST_R, RAIL_H, 6);
  const inst = new THREE.InstancedMesh(postGeom, new THREE.MeshLambertMaterial({ color: RAIL_COLOR }), posts.length);
  posts.forEach((m, i) => inst.setMatrixAt(i, m));
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = false;
  inst.computeBoundingSphere();
  group.add(inst);
  return group;
}

/** Rel atas tier: cincin penuh, atau bercelah bila tier bawah dilalui terowongan. */
function railRing(tier, railY) {
  const a = BASE_A + tier.offset0 - RAIL_W;
  const b = BASE_B + tier.offset0 - RAIL_W;
  if (!isRowCut(tier.y0)) return ellipseRingExtrude(a, b, RAIL_W, RAIL_W, railY, CURVE_SEG);
  return ellipseRingExtrudeGapped(a, b, RAIL_W, RAIL_W, railY, corridorGapsOnRing(a, b), CURVE_SEG);
}

function postTransforms(offset, yCenter, cut) {
  const a = BASE_A + offset;
  const b = BASE_B + offset;
  const table = createEllipseArcTable(a, b);
  const ranges = cut ? corridorArcRanges(table, GAP_HALF + POST_R) : [];
  const n = Math.floor(table.total / POST_SPACING);
  const list = [];
  for (let i = 0; i < n; i++) {
    const s = i * POST_SPACING;
    if (arcInRanges(ranges, s, table.total)) continue;
    const p = ellipsePoint(a, b, ellipseAngleAtArc(table, s));
    list.push(new THREE.Matrix4().makeTranslation(p.x, yCenter, p.z));
  }
  return list;
}

/** VIP box tribun barat: kanopi kaca, 4 tiang, panel kaca samping. */
export function createVipBox(layout) {
  const { lower } = layout;
  const midOffset = lower.offset0 + ((VIP_ROW_FROM + VIP_ROW_TO) / 2 + 0.5) * ROW_DEPTH;
  const topRowY = lower.y0 + (VIP_ROW_TO + 1) * lower.rise;
  const canopyY = topRowY + VIP_CANOPY_LIFT;
  const cx = ellipsePoint(BASE_A + midOffset, BASE_B + midOffset, WEST_THETA).x;
  const group = new THREE.Group();
  group.name = 'vipBox';
  const glass = new THREE.MeshLambertMaterial({ color: GLASS_COLOR, transparent: true, opacity: 0.35, depthWrite: false });
  const canopy = new THREE.BoxGeometry(VIP_CANOPY_DEPTH, 0.1, VIP_CANOPY_LEN);
  canopy.translate(cx, canopyY, 0);
  const sides = [-1, 1].map((s) => new THREE.BoxGeometry(VIP_CANOPY_DEPTH, 1.2, 0.08)
    .translate(cx, topRowY + 0.6, (s * VIP_CANOPY_LEN) / 2));
  group.add(new THREE.Mesh(mergeFlat([canopy, ...sides]), glass));
  const postMat = new THREE.MeshLambertMaterial({ color: RAIL_COLOR });
  const posts = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = cx + (sx * VIP_CANOPY_DEPTH) / 2;
      const baseY = lower.y0 + (sx < 0 ? VIP_ROW_TO + 1 : VIP_ROW_FROM) * lower.rise;
      const h = canopyY - baseY;
      posts.push(new THREE.CylinderGeometry(0.06, 0.06, h, 8).translate(px, baseY + h / 2, (sz * VIP_CANOPY_LEN) / 2));
    }
  }
  group.add(new THREE.Mesh(mergeFlat(posts), postMat));
  return group;
}
