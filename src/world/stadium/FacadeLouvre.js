/**
 * Louvre horizontal coklat-emas mengisi bidang antar rib: InstancedMesh bilah tipis
 * mengikuti oval (parametrisasi merata), louvreLevels band × louvreRows baris, tilt 30°.
 * Band bergantian warna coklat (0x8a5a2b) / emas (0xb8862d).
 */
import { BoxGeometry, Euler, Group, Matrix4, Quaternion, Vector3 } from 'three';
import { STADIUM } from '../../config/constants.js';
import { Materials } from '../materials.js';
import { instancedFromMatrices } from '../util/instancing.js';
import { framePoint, perimeterAtK, uDelta, uSpan } from './ovalFrame.js';
import { louvreKAt } from './profiles.js';

const BLADE_LEN = 3.0;
const BLADE_THICK = 0.18;
const BLADE_DEPTH = 0.9;
const BLADE_OVERLAP = 1.02;
const BAND_GAP = 1.2;
export const LOUVRE_BOTTOM = STADIUM.concourseHeight + 1;

/** Daftar baris {y, band} memenuhi [LOUVRE_BOTTOM, facadeHeight]. */
function planRows(levels, rowsPerBand) {
  const avail = STADIUM.facadeHeight - LOUVRE_BOTTOM;
  const bandH = (avail - (levels - 1) * BAND_GAP) / levels;
  const pitch = bandH / rowsPerBand;
  const rows = [];
  for (let band = 0; band < levels; band++) {
    const y0 = LOUVRE_BOTTOM + band * (bandH + BAND_GAP);
    for (let r = 0; r < rowsPerBand; r++) rows.push({ y: y0 + (r + 0.5) * pitch, band });
  }
  return rows;
}

/** Apakah bilah di (u, y) tertutup mask (mis. kanopi gate utama). */
function isMasked(u, y, masks) {
  return masks.some((m) => y < m.yMax && Math.abs(uDelta(u, m.u)) < uSpan(m.halfWidth));
}

/** Kumpulkan matriks bilah satu baris pada tinggi y. */
function collectRow(y, tilt, masks, out) {
  const k = louvreKAt(y);
  const count = Math.ceil(perimeterAtK(k) / BLADE_LEN);
  const p0 = new Vector3();
  const p1 = new Vector3();
  for (let i = 0; i < count; i++) {
    const u0 = i / count;
    const u1 = (i + 1) / count;
    if (isMasked((u0 + u1) / 2, y, masks)) continue;
    framePoint(u0, k, y, p0);
    framePoint(u1, k, y, p1);
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz) * BLADE_OVERLAP;
    const yaw = Math.atan2(-dz, dx); // sumbu X lokal searah bilah
    const q = new Quaternion().setFromEuler(new Euler(-tilt, yaw, 0, 'YXZ'));
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    out.push(new Matrix4().compose(mid, q, new Vector3(len, 1, 1)));
  }
}

/**
 * @param {{levels?:number, rowsPerBand?:number, tilt?:number, masks?:{u:number,halfWidth:number,yMax:number}[]}} opts
 */
export function createLouvres({ levels = STADIUM.louvreLevels, rowsPerBand = STADIUM.louvreRows, tilt = STADIUM.louvreTilt, masks = [] } = {}) {
  const group = new Group();
  group.name = 'louvres';
  const byColor = [[], []];
  planRows(levels, rowsPerBand).forEach((row) => collectRow(row.y, tilt, masks, byColor[row.band % 2]));
  const geom = new BoxGeometry(1, BLADE_THICK, BLADE_DEPTH);
  group.add(instancedFromMatrices(geom, Materials.louvre(), byColor[0], 'louvre-brown'));
  group.add(instancedFromMatrices(geom, Materials.louvreGold(), byColor[1], 'louvre-gold'));
  return group;
}
