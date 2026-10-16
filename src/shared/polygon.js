/**
 * Geometri poligon 2D murni (bidang XZ, titik [x, z]).
 */

/** Ray casting: true bila (x, z) di dalam poligon (cekung boleh). Input tak valid = false. */
export function pointInPolygon(x, z, poly) {
  if (!Array.isArray(poly) || poly.length < 3 || !Number.isFinite(x) || !Number.isFinite(z)) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Hull cembung (Andrew monotone chain), berlawanan jarum jam, tanpa titik kolinear. */
export function convexHull(points) {
  const pts = points
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => [p[0], p[1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out;
  };
  const lower = half(pts);
  const upper = half([...pts].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
