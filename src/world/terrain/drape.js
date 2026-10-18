/**
 * Mesh ter-drape (spec §5.3): pita polyline & poligon mengikuti permukaan terrain. Dipecah ≤ 2 m (memanjang:
 * titik pecah di garis kisi GLOBAL berjarak segment/√2 sehingga chunk tetangga memecah segmen yang sama di titik
 * yang sama; melintang: kolom ≤ segment; poligon: sel kisi maxEdge/√2), y = tinggi permukaan + lift, UV =
 * koordinat dunia (m) agar surfaceMaps (repeat = 1/TILE_M) konsisten, normal dari permukaan.
 * `field` = {heightAt(x,z), normalAt?(x,z,out)}: HeightField M1 atau createChunkSurface (aman-mesh).
 * Material pemakai wajib polygonOffset (groundMaterials distrik). `clipRect` memotong hasil tepat ke persegi
 * chunk → pita/poligon dari chunk bertetangga bersambung tanpa tumpang atau celah.
 */
import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';
import { clipPolygonToRect, ringBounds } from '../../geo/polygon.js';
import { sampleChunk } from '../../geo/terrain/heightfield.js';

export const DRAPE = Object.freeze({
  segment: 2,
  maxEdge: 2,
  miterLimit: 2.5,
  /** Lift di atas permukaan (m): spec §5.3 jalan 0,03, trotoar 0,05; lapisan lain di antaranya. */
  lift: Object.freeze({ pitch: 0.02, ditch: 0.02, road: 0.03, marking: 0.035, paving: 0.04, walk: 0.05 }),
});

const KEY_SCALE = 1e4;
const near = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
const unit = (x, z) => {
  const l = Math.hypot(x, z);
  return l > 0 ? [x / l, z / l] : null;
};

/** Penumpuk geometri: simpul dibagi per posisi, segitiga dipaksa menghadap +Y. */
function createBuilder(field, lift) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const keys = new Map();
  const tmp = { x: 0, y: 1, z: 0 };
  const vertex = (x, z) => {
    const k = `${Math.round(x * KEY_SCALE)},${Math.round(z * KEY_SCALE)}`;
    const hit = keys.get(k);
    if (hit !== undefined) return hit;
    const n = field.normalAt ? field.normalAt(x, z, tmp) : tmp;
    pos.push(x, field.heightAt(x, z) + lift, z);
    nor.push(n.x, n.y, n.z);
    uv.push(x, z);
    const i = pos.length / 3 - 1;
    keys.set(k, i);
    return i;
  };
  const tri = (a, b, c) => {
    const ax = pos[a * 3];
    const az = pos[a * 3 + 2];
    const up = (pos[b * 3 + 2] - az) * (pos[c * 3] - ax) - (pos[b * 3] - ax) * (pos[c * 3 + 2] - az);
    if (Math.abs(up) < 1e-12) return;
    if (up > 0) idx.push(a, b, c);
    else idx.push(a, c, b);
  };
  /** Kipas segitiga untuk poligon cembung [[x, z]…]. */
  const fan = (poly) => {
    const v = poly.map(([x, z]) => vertex(x, z));
    for (let k = 1; k < v.length - 1; k += 1) tri(v[0], v[k], v[k + 1]);
  };
  const build = () => {
    const g = new BufferGeometry();
    if (idx.length === 0) return g;
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  };
  return { fan, build };
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    if (out.length === 0 || !near(out[out.length - 1], p)) out.push([p[0], p[1]]);
  }
  return out;
}

/** Sisipkan titik di setiap perpotongan segmen dengan garis kisi global x = k·cell dan z = k·cell. */
function latticeSplit(line, cell) {
  const out = [line[0]];
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const ts = [];
    for (const ax of [0, 1]) {
      const d = b[ax] - a[ax];
      if (d === 0) continue;
      const lo = Math.min(a[ax], b[ax]);
      const hi = Math.max(a[ax], b[ax]);
      for (let k = Math.floor(lo / cell) + 1; k * cell < hi; k += 1) ts.push((k * cell - a[ax]) / d);
    }
    ts.sort((p, q) => p - q);
    let last = 0;
    for (const t of ts) {
      if (t - last > 1e-9 && 1 - t > 1e-9) {
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        last = t;
      }
    }
    out.push(b);
  }
  return dedupe(out);
}

/** Penampang tiap simpul: cols+1 titik dari kiri ke kanan; simpul dalam memakai garis bagi + miter. */
function sections(line, closed, half, cols) {
  const n = line.length;
  return line.map((p, i) => {
    const prev = i > 0 ? line[i - 1] : (closed ? line[n - 2] : null);
    const next = i < n - 1 ? line[i + 1] : (closed ? line[1] : null);
    const d1 = prev ? unit(p[0] - prev[0], p[1] - prev[1]) : null;
    const d2 = next ? unit(next[0] - p[0], next[1] - p[1]) : null;
    const t = (d1 && d2 ? unit(d1[0] + d2[0], d1[1] + d2[1]) : null) ?? d2 ?? d1;
    const ref = d2 ?? d1;
    const k = 1 / Math.max(t[0] * ref[0] + t[1] * ref[1], 1 / DRAPE.miterLimit);
    const nx = -t[1] * k;
    const nz = t[0] * k;
    const out = [];
    for (let c = 0; c <= cols; c += 1) {
      const s = -half + (2 * half * c) / cols;
      out.push([p[0] + nx * s, p[1] + nz * s]);
    }
    return out;
  });
}

const outsideRect = (b, r) => b.maxX <= r.minX || b.minX >= r.maxX || b.maxZ <= r.minZ || b.minZ >= r.maxZ;
const insideRect = (b, r) => b.minX >= r.minX && b.maxX <= r.maxX && b.minZ >= r.minZ && b.maxZ <= r.maxZ;

/**
 * Pita polyline ter-drape.
 * @param {Array<[number, number]>} pts polyline dunia (tertutup bila titik akhir = awal)
 * @param {number} width lebar (m)
 * @param {{heightAt(x:number,z:number):number, normalAt?(x:number,z:number,out?:object):{x:number,y:number,z:number}}} field
 * @param {{lift?: number, segment?: number, clipRect?: {minX:number,minZ:number,maxX:number,maxZ:number}|null}} [opts]
 * @returns {BufferGeometry} position/normal/uv berindeks; kosong (tanpa atribut) bila masukan tak valid
 */
export function drapePolyline(pts, width, field, { lift = DRAPE.lift.road, segment = DRAPE.segment, clipRect = null } = {}) {
  const b = createBuilder(field, lift);
  const base = Array.isArray(pts) ? dedupe(pts) : [];
  if (!(width > 0) || base.length < 2) return b.build();
  const line = latticeSplit(base, segment / Math.SQRT2);
  const closed = line.length > 3 && near(line[0], line[line.length - 1]);
  const cols = Math.max(1, Math.ceil(width / segment));
  const secs = sections(line, closed, width / 2, cols);
  for (let i = 0; i < secs.length - 1; i += 1) {
    for (let c = 0; c < cols; c += 1) {
      const quad = [secs[i][c], secs[i][c + 1], secs[i + 1][c + 1], secs[i + 1][c]];
      if (!clipRect) {
        b.fan(quad);
        continue;
      }
      const qb = ringBounds(quad);
      if (outsideRect(qb, clipRect)) continue;
      const piece = insideRect(qb, clipRect) ? quad : clipPolygonToRect(quad, clipRect);
      if (piece.length >= 3) b.fan(piece);
    }
  }
  return b.build();
}

/**
 * Poligon ter-drape (dengan lubang): triangulasi earcut lalu tiap segitiga dipotong per sel kisi global
 * maxEdge/√2 (semua tepi ≤ maxEdge), tinggi per simpul dari `field`.
 * @param {Array<Array<[number, number]>>} rings [luar, ...lubang] dunia, terbuka
 */
export function drapePolygon(rings, field, { lift = DRAPE.lift.paving, maxEdge = DRAPE.maxEdge, clipRect = null } = {}) {
  const b = createBuilder(field, lift);
  const valid = (Array.isArray(rings) ? rings : []).map((r) => dedupe(r ?? [])).filter((r) => r.length >= 3);
  if (valid.length === 0) return b.build();
  const contour = valid[0].map(([x, z]) => new Vector2(x, z));
  const holes = valid.slice(1).map((h) => h.map(([x, z]) => new Vector2(x, z)));
  const faces = ShapeUtils.triangulateShape(contour, holes);
  // triangulateShape dapat membuang titik ujung duplikat di tempat: indeks mengacu array setelah dipanggil.
  const verts = [...contour, ...holes.flat()].map((v) => [v.x, v.y]);
  const cell = maxEdge / Math.SQRT2;
  for (const [i0, i1, i2] of faces) {
    const tri = [verts[i0], verts[i1], verts[i2]];
    const tb = ringBounds(tri);
    for (let j = Math.floor(tb.minZ / cell); j * cell < tb.maxZ; j += 1) {
      for (let i = Math.floor(tb.minX / cell); i * cell < tb.maxX; i += 1) {
        let rect = { minX: i * cell, minZ: j * cell, maxX: (i + 1) * cell, maxZ: (j + 1) * cell };
        if (clipRect) {
          rect = {
            minX: Math.max(rect.minX, clipRect.minX), minZ: Math.max(rect.minZ, clipRect.minZ),
            maxX: Math.min(rect.maxX, clipRect.maxX), maxZ: Math.min(rect.maxZ, clipRect.maxZ),
          };
          if (rect.minX >= rect.maxX || rect.minZ >= rect.maxZ) continue;
        }
        const piece = clipPolygonToRect(tri, rect);
        if (piece.length >= 3) b.fan(piece);
      }
    }
  }
  return b.build();
}

/** Indeks simpul LOD sepanjang satu sisi chunk: 0, stride, 2·stride, …, dan n−1 (tepi bersama). = TerrainMesh M1. */
export function nodeIndices(n, stride) {
  const out = [];
  for (let i = 0; i < n - 1; i += stride) out.push(i);
  out.push(n - 1);
  return out;
}

/**
 * Permukaan "aman-mesh" satu chunk terrain untuk LOD dengan `stride` (1 = LOD0, 4 = LOD1): tinggi di (x, z) =
 * MAKSIMUM dua kemungkinan triangulasi sel simpul LOD, sehingga mesh ter-drape tidak pernah di bawah mesh
 * terrain apa pun arah diagonal M1 (selisih ≤ |puntiran sel|/2, ≈ 0 di jalan yang dikondisikan). Hanya chunk
 * ini yang dibaca (titik di luar di-clamp) → tidak bergantung chunk tetangga sudah dimuat. Normal = beda hingga.
 * @param {{origin:{x:number,z:number}, step:number, n:number}} chunk Chunk M1 (spec §4.1)
 * @param {{stride?: number, sample?: (chunk: object, x: number, z: number) => number}} [opts]
 */
export function createChunkSurface(chunk, { stride = 1, sample = sampleChunk } = {}) {
  const { origin, step, n } = chunk;
  const nodes = nodeIndices(n, stride).map((i) => i * step);
  const size = (n - 1) * step;
  const locate = (v) => {
    const l = Math.min(Math.max(v, 0), size);
    let lo = 0;
    let hi = nodes.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (nodes[mid] <= l) lo = mid;
      else hi = mid;
    }
    return { a: nodes[lo], b: nodes[hi], t: (l - nodes[lo]) / (nodes[hi] - nodes[lo]) };
  };
  const h = (lx, lz) => sample(chunk, origin.x + lx, origin.z + lz);
  const heightAt = (x, z) => {
    const X = locate(x - origin.x);
    const Z = locate(z - origin.z);
    const h00 = h(X.a, Z.a);
    const h10 = h(X.b, Z.a);
    const h01 = h(X.a, Z.b);
    const h11 = h(X.b, Z.b);
    const u = X.t;
    const v = Z.t;
    const diagA = u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + v * (h01 - h00) + u * (h11 - h01);
    const diagB = u + v <= 1 ? h00 + u * (h10 - h00) + v * (h01 - h00) : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
    return Math.max(diagA, diagB);
  };
  const D = 0.5;
  const normalAt = (x, z, out = { x: 0, y: 1, z: 0 }) => {
    const dx = (heightAt(x + D, z) - heightAt(x - D, z)) / (2 * D);
    const dz = (heightAt(x, z + D) - heightAt(x, z - D)) / (2 * D);
    const len = Math.hypot(dx, 1, dz);
    out.x = -dx / len;
    out.y = 1 / len;
    out.z = -dz / len;
    return out;
  };
  return Object.freeze({ heightAt, normalAt, origin, size, stride });
}
