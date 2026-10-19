/**
 * Parit tepi jalan utama [INFERENSI, spec §5.2.8]: garis sejajar sumbu jalan pada w/2 + centerOffset di kedua
 * sisi, dipotong di tempat yang tidak mungkin ada parit terbuka (luar distrik, area keras/air, gedung, dekat
 * jalan lain = gorong-gorong, dekat trotoar = titian). Hasil disederhanakan (Douglas–Peucker 5 cm).
 */
import { distanceToSegment } from '../../../src/geo/polygon.js';
import { polylineLength } from '../../../src/geo/lineClip.js';
import { samplesAlong } from './spatial.js';
import { DITCH } from './constants.js';

const unit = (x, z) => {
  const l = Math.hypot(x, z);
  return l > 0 ? [x / l, z / l] : [0, 0];
};

/** Polyline sejajar pada jarak d ke kiri (normal (−tz, tx)); simpul dalam memakai garis bagi + miter (≤ 2×). */
export function offsetPolyline(line, d) {
  const n = line.length;
  return line.map((p, i) => {
    const d1 = i > 0 ? unit(p[0] - line[i - 1][0], p[1] - line[i - 1][1]) : null;
    const d2 = i < n - 1 ? unit(line[i + 1][0] - p[0], line[i + 1][1] - p[1]) : null;
    let t = d1 && d2 ? unit(d1[0] + d2[0], d1[1] + d2[1]) : (d1 ?? d2);
    if (t[0] === 0 && t[1] === 0) t = d2 ?? d1;
    const k = d1 && d2 ? 1 / Math.max(t[0] * d2[0] + t[1] * d2[1], 0.5) : 1;
    return [p[0] - t[1] * d * k, p[1] + t[0] * d * k];
  });
}

/** Douglas–Peucker (toleransi m), ujung selalu dipertahankan. */
export function simplifyLine(pts, tol = 0.05) {
  if (pts.length <= 2) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1;
    let bestD = tol;
    for (let i = a + 1; i < b; i += 1) {
      const d = distanceToSegment(pts[i][0], pts[i][1], pts[a], pts[b]);
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i] === 1);
}

/** Bagi polyline (sampel tiap `step` m) menjadi potongan yang `ok`; potongan < minRun dibuang. */
export function ditchRuns(line, ok, { step = DITCH.step, minRun = DITCH.minRun } = {}) {
  const runs = [];
  let cur = [];
  const flush = () => {
    if (cur.length >= 2 && polylineLength(cur) >= minRun) runs.push(simplifyLine(cur));
    cur = [];
  };
  for (const p of samplesAlong(line, step, 0)) {
    if (ok(p.x, p.z)) cur.push([p.x, p.z]);
    else flush();
  }
  flush();
  return runs;
}

/** Parit kedua sisi jalan kelas DITCH.classes → [{id, w, line}]. */
export function inferredDitches(roads, ctx, cfg = DITCH) {
  if (!cfg.enabled) return [];
  const ok = (x, z) => ctx.inside(x, z) && ctx.area(x, z) === null && ctx.building(x, z) === null
    && ctx.buildingEdge(x, z) > cfg.clearBuilding && ctx.roadEdge(x, z).d > cfg.clearRoad
    && ctx.walkEdge(x, z).d > cfg.clearWalk;
  const out = [];
  for (const r of roads) {
    if (!cfg.classes.includes(r.cls)) continue;
    for (const side of [1, -1]) {
      const line = offsetPolyline(r.line, side * (r.w / 2 + cfg.centerOffset));
      for (const run of ditchRuns(line, ok, cfg)) out.push({ id: `${r.id}:parit${side > 0 ? 'Kiri' : 'Kanan'}`, w: cfg.width, line: run });
    }
  }
  return out;
}
