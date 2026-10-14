/**
 * Lintasan atletik 400 m: oval berpusat di origin, lurus sejajar sumbu Z,
 * setengah lingkaran di ±Z. Arah lari berlawanan jarum jam dilihat dari atas (+Y):
 * di sisi x>0 lari ke −Z, di sisi x<0 lari ke +Z.
 * Pemetaan 2D CurvePath (x,y) → dunia (x,z).
 */
import { CurvePath, LineCurve, EllipseCurve, Vector2 } from 'three';
import { TRACK } from '../config/constants.js';

const ARC_DIVISIONS = 400;
const pathCache = new Map();

/** Radius garis ukur lane (lane 1 = innerRadius + kerbOffset). */
export function laneRadius(lane) {
  const idx = Math.min(Math.max(1, Math.floor(lane)), TRACK.laneCount) - 1;
  return TRACK.innerRadius + TRACK.kerbOffset + idx * TRACK.laneWidth;
}

/** Panjang analitik satu putaran lane. */
export function laneLength(lane) {
  return 2 * TRACK.straightLength + 2 * Math.PI * laneRadius(lane);
}

/** Setengah lingkaran searah jarum jam (sudut menurun) dari startAngle sejauh π. */
function halfCircle(cx, cy, r, startAngle) {
  const curve = new EllipseCurve(cx, cy, r, r, startAngle, startAngle - Math.PI, true);
  curve.arcLengthDivisions = ARC_DIVISIONS;
  return curve;
}

/**
 * CurvePath tertutup: mulai di (R, 0) menuju −Z, lengkung di −Z, lurus +Z di sisi x<0,
 * lengkung di +Z, kembali ke (R, 0).
 */
export function createLanePath(lane) {
  const r = laneRadius(lane);
  const half = TRACK.straightLength / 2;
  const path = new CurvePath();
  path.add(new LineCurve(new Vector2(r, 0), new Vector2(r, -half)));
  path.add(halfCircle(0, -half, r, 0));
  path.add(new LineCurve(new Vector2(-r, -half), new Vector2(-r, half)));
  path.add(halfCircle(0, half, r, Math.PI));
  path.add(new LineCurve(new Vector2(r, half), new Vector2(r, 0)));
  path.arcLengthDivisions = ARC_DIVISIONS;
  return path;
}

function cachedPath(lane) {
  const key = laneRadius(lane);
  if (!pathCache.has(key)) pathCache.set(key, createLanePath(lane));
  return pathCache.get(key);
}

/**
 * Posisi & yaw pada jarak dist (meter, di-wrap). yaw = atan2(tx, tz)
 * sehingga objek yang menghadap +Z lokal akan menghadap arah lari.
 * @returns {{x:number,z:number,yaw:number}}
 */
export function pointOnLane(lane, dist) {
  const L = laneLength(lane);
  const d = Number.isFinite(dist) ? dist : 0;
  const u = (((d % L) + L) % L) / L;
  const path = cachedPath(lane);
  const p = path.getPointAt(u);
  const t = path.getTangentAt(u);
  return { x: p.x, z: p.y, yaw: Math.atan2(t.x, t.y) };
}
