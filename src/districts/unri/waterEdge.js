/**
 * Geometri murni untuk air kartun (M8 P2): jarak titik ke tepi poligon (ring + lubang) dan pemecahan segitiga
 * agar atribut vertex "jarak ke tepi" punya simpul di bagian dalam bidang. Tanpa three (dites di Node).
 */

/** Jarak titik (px, pz) ke segmen a-b. */
export function pointSegmentDistance(px, pz, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2)) : 0;
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz));
}

/** Segmen yang menempel pada sisi persegi potong chunk (garis potong buatan, bukan tepi air sungguhan). */
export function onRectEdge(a, b, rect, eps = 0.05) {
  if (!rect) return false;
  const near = (v, w) => Math.abs(v - w) <= eps;
  return (near(a[0], rect.minX) && near(b[0], rect.minX)) || (near(a[0], rect.maxX) && near(b[0], rect.maxX))
    || (near(a[1], rect.minZ) && near(b[1], rect.minZ)) || (near(a[1], rect.maxZ) && near(b[1], rect.maxZ));
}

/**
 * Jarak minimum titik ke semua tepi ring (luar + lubang). Tepi yang menempel pada `rect` dilewati supaya
 * sambungan antar chunk tidak berbusa. Tanpa tepi tersisa -> `far`.
 * @param {number} x
 * @param {number} z
 * @param {Array<Array<[number, number]>>} rings
 * @param {{minX:number,minZ:number,maxX:number,maxZ:number}|null} [rect]
 * @param {number} [far]
 */
export function distanceToRings(x, z, rings, rect = null, far = 1e6) {
  let best = far;
  for (const ring of rings) {
    const n = ring.length;
    for (let i = 0; i < n; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      if (onRectEdge(a, b, rect)) continue;
      const d = pointSegmentDistance(x, z, a, b);
      if (d < best) best = d;
    }
  }
  return best;
}

const edgeKey = (i, j) => (i < j ? `${i}_${j}` : `${j}_${i}`);

/** Satu putaran: pecah semua tepi lebih panjang dari maxEdge di titik tengahnya (konforming, tanpa T-junction). */
function splitPass(verts, faces, maxEdge) {
  const mids = new Map();
  let any = false;
  const mid = (i, j) => {
    const k = edgeKey(i, j);
    const hit = mids.get(k);
    if (hit !== undefined) return hit;
    const a = verts[i];
    const b = verts[j];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= maxEdge) {
      mids.set(k, -1);
      return -1;
    }
    verts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    const idx = verts.length - 1;
    mids.set(k, idx);
    any = true;
    return idx;
  };
  const out = [];
  for (const [a, b, c] of faces) {
    const v = [a, b, c];
    const m = [mid(a, b), mid(b, c), mid(c, a)];
    const s = m.map((x) => x >= 0);
    const count = s.filter(Boolean).length;
    if (count === 0) out.push([a, b, c]);
    else if (count === 3) out.push([a, m[0], m[2]], [m[0], b, m[1]], [m[2], m[1], c], [m[0], m[1], m[2]]);
    else if (count === 1) {
      const e = s.indexOf(true); // tepi e = v[e] -> v[e+1]
      const p = v[e];
      const q = v[(e + 1) % 3];
      const r = v[(e + 2) % 3];
      out.push([p, m[e], r], [m[e], q, r]);
    } else {
      const e = s.indexOf(false); // satu-satunya tepi utuh: v[e] -> v[e+1]
      const p = v[(e + 1) % 3]; // titik yang diapit dua tepi terpecah
      const q = v[(e + 2) % 3];
      const r = v[e];
      const mpq = m[(e + 1) % 3]; // tepi p -> q
      const mqr = m[(e + 2) % 3]; // tepi q -> r
      out.push([mpq, q, mqr]);
      const d1 = Math.hypot(verts[r][0] - verts[mpq][0], verts[r][1] - verts[mpq][1]);
      const d2 = Math.hypot(verts[p][0] - verts[mqr][0], verts[p][1] - verts[mqr][1]);
      if (d1 <= d2) out.push([p, mpq, r], [mpq, mqr, r]);
      else out.push([p, mpq, mqr], [p, mqr, r]);
    }
  }
  return { faces: out, any };
}

/**
 * Pecah segitiga sampai semua tepi <= maxEdge (maks 8 putaran). Tidak mengubah masukan.
 * @param {Array<[number, number]>} verts
 * @param {Array<[number, number, number]>} faces
 * @param {number} maxEdge
 */
export function refineTriangles(verts, faces, maxEdge) {
  const outVerts = verts.map((v) => [v[0], v[1]]);
  let outFaces = faces.map((f) => [f[0], f[1], f[2]]);
  if (!(maxEdge > 0)) return { verts: outVerts, faces: outFaces };
  for (let pass = 0; pass < 8; pass += 1) {
    const r = splitPass(outVerts, outFaces, maxEdge);
    outFaces = r.faces;
    if (!r.any) break;
  }
  return { verts: outVerts, faces: outFaces };
}
