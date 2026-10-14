/**
 * Beton tribun: undakan per baris sebagai cincin elips terekstrusi,
 * digabung per tier (2 draw call) + concourse, parapet balkon, dinding belakang.
 * Baris yang berada di volume terowongan gate utama (lihat tunnelLayout.js)
 * dibangun sebagai cincin bercelah sehingga koridor kendaraan menembus tribun.
 */
import * as THREE from 'three';
import { COLORS } from '../../config/constants.js';
import { ellipseRingExtrude, ellipseRingExtrudeGapped, mergeFlat } from './ovalMath.js';
import { corridorGapsOnRing, isRowCut } from './tunnelLayout.js';
import { BASE_A, BASE_B, ROW_DEPTH, CONCOURSE_W, UPPER_LIFT, CURVE_SEG } from './Tribune.layout.js';

const SLAB_T = 0.4;        // tebal pelat concourse
const PARAPET_W = 0.35;    // tebal parapet balkon
const PARAPET_H = 1.0;     // tinggi parapet di atas baris pertama tier atas
const BACK_WALL_W = 0.4;
const BACK_WALL_H = 2.5;
const BACK_WALL_DROP = 6;  // dinding belakang turun di bawah baris terakhir
const COLOR_UPPER = 0xaeaaa0;

/** Satu undakan: cincin offset→offset+rowDepth, tinggi rise, dasar y; bercelah bila kena terowongan. */
function rowRing(offset, rise, y) {
  const a = BASE_A + offset;
  const b = BASE_B + offset;
  if (!isRowCut(y)) return ellipseRingExtrude(a, b, ROW_DEPTH, rise, y, CURVE_SEG);
  const gaps = corridorGapsOnRing(a + ROW_DEPTH / 2, b + ROW_DEPTH / 2);
  return ellipseRingExtrudeGapped(a, b, ROW_DEPTH, rise, y, gaps, CURVE_SEG);
}

function tierRows(tier) {
  return Array.from({ length: tier.rows }, (_, i) =>
    rowRing(tier.offset0 + i * ROW_DEPTH, tier.rise, tier.y0 + i * tier.rise));
}

/** Tier bawah + pelat concourse yang menerus sampai ke bawah tier atas. */
function lowerGeometry(layout) {
  const { lower, upper } = layout;
  const slabWidth = upper.endOffset - lower.endOffset + BACK_WALL_W;
  const slab = ellipseRingExtrude(
    BASE_A + lower.endOffset, BASE_B + lower.endOffset, slabWidth, SLAB_T,
    layout.concourseY - SLAB_T, CURVE_SEG,
  );
  return mergeFlat([...tierRows(lower), slab]);
}

/** Tier atas + parapet balkon + dinding belakang. */
function upperGeometry(layout) {
  const { upper } = layout;
  const parapetH = UPPER_LIFT + PARAPET_H;
  const parapet = ellipseRingExtrude(
    BASE_A + upper.offset0 - PARAPET_W, BASE_B + upper.offset0 - PARAPET_W, PARAPET_W, parapetH,
    layout.concourseY, CURVE_SEG,
  );
  const wallY = upper.topY - BACK_WALL_DROP;
  const backWall = ellipseRingExtrude(
    BASE_A + upper.endOffset, BASE_B + upper.endOffset, BACK_WALL_W,
    BACK_WALL_H + BACK_WALL_DROP, wallY, CURVE_SEG,
  );
  return mergeFlat([...tierRows(upper), parapet, backWall]);
}

/**
 * Beton kedua tier.
 * @returns {THREE.Group}
 */
export function createTribuneConcrete(layout) {
  const group = new THREE.Group();
  group.name = 'beton';
  const lowerMesh = new THREE.Mesh(lowerGeometry(layout), new THREE.MeshLambertMaterial({ color: COLORS.concrete }));
  lowerMesh.name = 'betonBawah';
  const upperMesh = new THREE.Mesh(upperGeometry(layout), new THREE.MeshLambertMaterial({ color: COLOR_UPPER }));
  upperMesh.name = 'betonAtas';
  for (const m of [lowerMesh, upperMesh]) {
    m.receiveShadow = true;
    m.castShadow = true;
  }
  group.add(lowerMesh, upperMesh);
  group.userData.concourseWidth = CONCOURSE_W;
  return group;
}
