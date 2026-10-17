/**
 * Geometri poligon 2D pada bidang (x, z). Ring = Array<[x, z]> TERBUKA (titik terakhir ≠ titik pertama).
 * signedArea > 0 berarti urutan (x, z) "positif" (searah jarum jam bila dilihat dari atas dengan
 * utara di atas, karena +Z = selatan). Untuk ring positif, normal luar sisi (dx, dz) = (dz, −dx).
 * Murni (tanpa three/DOM). SATU-SATUNYA implementasi poligon proyek: dipakai citybake, mask region,
 * collider komposit, dan TileCollider.
 */

/** Buang titik penutup duplikat dan titik berurutan yang berimpit (< eps). */
export function cleanRing(ring, eps = 1e-6) {
  const out = [];
  for (const p of ring) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > eps || Math.abs(q[1] - p[1]) > eps) out.push([p[0], p[1]]);
  }
  while (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) > eps || Math.abs(a[1] - b[1]) > eps) break;
    out.pop();
  }
  return out;
}

/** Luas bertanda (shoelace). */
export function signedArea(ring) {
  let s = 0;
  for (let i = 0, n = ring.length; i < n; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/** Luas absolut (m²). */
export const polygonArea = (ring) => Math.abs(signedArea(ring));

/** Salinan ring dengan tanda luas sesuai `positive`. */
export function orientRing(ring, positive = true) {
  const copy = ring.map((p) => [p[0], p[1]]);
  return (signedArea(copy) > 0) === positive ? copy : copy.reverse();
}

/** Centroid luas; fallback rata-rata titik bila luas ≈ 0. */
export function polygonCentroid(ring) {
  const a = signedArea(ring);
  if (Math.abs(a) < 1e-9) {
    const n = ring.length || 1;
    return { x: ring.reduce((s, p) => s + p[0], 0) / n, z: ring.reduce((s, p) => s + p[1], 0) / n };
  }
  let cx = 0;
  let cz = 0;
  for (let i = 0, n = ring.length; i < n; i += 1) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    const c = p[0] * q[1] - q[0] * p[1];
    cx += (p[0] + q[0]) * c;
    cz += (p[1] + q[1]) * c;
  }
  return { x: cx / (6 * a), z: cz / (6 * a) };
}

/**
 * Titik di dalam poligon (aturan genap-ganjil, cekung boleh; titik tepat di tepi tidak dijamin).
 * Input tak valid (ring < 3 titik / bukan array, koordinat tak hingga) = false.
 */
export function pointInPolygon(x, z, ring) {
  if (!Array.isArray(ring) || ring.length < 3 || !Number.isFinite(x) || !Number.isFinite(z)) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Hull cembung (Andrew monotone chain), luas bertanda positif, tanpa titik kolinear; titik tak hingga dibuang. */
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

/** Bounding box ring/polyline. */
export function ringBounds(ring) {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of ring) {
    if (x < minX) minX = x;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minZ, maxX, maxZ };
}

/** Dua bounding box beririsan (tepi bersentuhan dihitung beririsan). */
export const boundsOverlap = (a, b) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;

function lerpAtX(a, b, x) {
  const t = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + (b[1] - a[1]) * t];
}

function lerpAtZ(a, b, z) {
  const t = (z - a[1]) / (b[1] - a[1]);
  return [a[0] + (b[0] - a[0]) * t, z];
}

const CLIP_EDGES = [
  { inside: (p, r) => p[0] >= r.minX, cut: (a, b, r) => lerpAtX(a, b, r.minX) },
  { inside: (p, r) => p[0] <= r.maxX, cut: (a, b, r) => lerpAtX(a, b, r.maxX) },
  { inside: (p, r) => p[1] >= r.minZ, cut: (a, b, r) => lerpAtZ(a, b, r.minZ) },
  { inside: (p, r) => p[1] <= r.maxZ, cut: (a, b, r) => lerpAtZ(a, b, r.maxZ) },
];

/** Satu lintasan Sutherland–Hodgman terhadap satu sisi persegi. */
function clipAgainstEdge(input, edge, rect) {
  const out = [];
  for (let i = 0; i < input.length; i += 1) {
    const cur = input[i];
    const prev = input[(i + input.length - 1) % input.length];
    const curIn = edge.inside(cur, rect);
    const prevIn = edge.inside(prev, rect);
    if (curIn && !prevIn) out.push(edge.cut(prev, cur, rect));
    if (curIn) out.push(cur);
    if (!curIn && prevIn) out.push(edge.cut(prev, cur, rect));
  }
  return out;
}

/**
 * Potong poligon ke persegi {minX, minZ, maxX, maxZ} (Sutherland–Hodgman). Hasil ring terbuka;
 * [] bila tersisa < 3 titik atau luas ≈ 0. Poligon cekung dapat menghasilkan sisi berimpit di tepi
 * persegi — wajar untuk area datar (air/landuse).
 */
export function clipPolygonToRect(ring, rect) {
  let out = ring;
  for (const edge of CLIP_EDGES) {
    if (out.length === 0) break;
    out = clipAgainstEdge(out, edge, rect);
  }
  const cleaned = cleanRing(out);
  return cleaned.length >= 3 && polygonArea(cleaned) > 1e-6 ? cleaned : [];
}

/** Liang–Barsky: potong segmen a→b ke persegi; null bila di luar. Elemen ke-3: segmen keluar persegi. */
function clipSegment(a, b, r) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const checks = [[-dx, a[0] - r.minX], [dx, r.maxX - a[0]], [-dz, a[1] - r.minZ], [dz, r.maxZ - a[1]]];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      t0 = Math.max(t0, t);
    } else {
      if (t < t0) return null;
      t1 = Math.min(t1, t);
    }
  }
  return [[a[0] + dx * t0, a[1] + dz * t0], [a[0] + dx * t1, a[1] + dz * t1], t1 < 1];
}

const samePoint = (a, b) => Math.abs(a[0] - b[0]) <= 1e-9 && Math.abs(a[1] - b[1]) <= 1e-9;

/**
 * Potong polyline ke persegi. Mengembalikan array polyline (masing-masing ≥ 2 titik); satu polyline
 * dapat terpecah bila keluar-masuk persegi.
 */
export function clipPolylineToRect(line, rect) {
  const parts = [];
  let cur = null;
  for (let i = 0; i < line.length - 1; i += 1) {
    const seg = clipSegment(line[i], line[i + 1], rect);
    if (!seg) {
      cur = null;
      continue;
    }
    const [p, q, exits] = seg;
    if (samePoint(p, q)) {
      // segmen hanya menyentuh tepi persegi di satu titik
      if (exits) cur = null;
      continue;
    }
    if (!cur || !samePoint(cur[cur.length - 1], p)) {
      cur = [p];
      parts.push(cur);
    }
    cur.push(q);
    if (exits) cur = null;
  }
  return parts.filter((l) => l.length >= 2);
}
