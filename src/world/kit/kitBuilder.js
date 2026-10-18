/**
 * Penampung geometri kit: satu MeshBuilder per kunci material ('opak' | 'potong' | 'papan'), atribut seragam
 * position(3) normal(3) uv(2) color(3), non-indexed, array tumbuh (kapasitas ×2) agar banyak gedung bisa
 * ditulis bertahap ke SATU sink per klaster (penggabungan per material tanpa clone/merge di akhir).
 * Primitif: quad, tri, poligon cembung, kotak, bidang ber-ubin (grid diklip, UV per sel atlas) dan tutup bola.
 * Warna vertex dalam ruang linear (three ColorManagement).
 */
import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three';

export const SINK_KEYS = Object.freeze(['opak', 'potong', 'papan']);
const START_VERTS = 4096;

/** sRGB hex → [r,g,b] linear, dikalikan k (variasi luminance). */
export function linearColor(hex, k = 1) {
  const c = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [c((hex >> 16) & 255) * k, c((hex >> 8) & 255) * k, c(hex & 255) * k];
}

export const WHITE = Object.freeze([1, 1, 1]);

/** Sub-persegi UV dari rect sel {u0,v0,u1,v1} untuk pecahan s∈[0,1] (horizontal) dan t∈[0,1] (vertikal, bawah→atas). */
export function subUv(rect, s0, t0, s1, t1) {
  const du = rect.u1 - rect.u0;
  const dv = rect.v1 - rect.v0;
  return { u0: rect.u0 + du * s0, v0: rect.v0 + dv * t0, u1: rect.u0 + du * s1, v1: rect.v0 + dv * t1 };
}

export function createMeshBuilder(startVerts = START_VERTS) {
  let cap = Math.max(64, startVerts);
  let count = 0;
  let pos = new Float32Array(cap * 3);
  let nor = new Float32Array(cap * 3);
  let uvs = new Float32Array(cap * 2);
  let col = new Float32Array(cap * 3);
  const grow = (need) => {
    if (count + need <= cap) return;
    while (count + need > cap) cap *= 2;
    const g = (arr, k) => {
      const next = new Float32Array(cap * k);
      next.set(arr.subarray(0, count * k));
      return next;
    };
    pos = g(pos, 3);
    nor = g(nor, 3);
    uvs = g(uvs, 2);
    col = g(col, 3);
  };
  const emit = (x, y, z, nx, ny, nz, u, v, c) => {
    const i3 = count * 3;
    pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;
    nor[i3] = nx; nor[i3 + 1] = ny; nor[i3 + 2] = nz;
    col[i3] = c[0]; col[i3 + 1] = c[1]; col[i3 + 2] = c[2];
    uvs[count * 2] = u; uvs[count * 2 + 1] = v;
    count += 1;
  };
  /** Normal satuan dari (b − a) × (c − a); hasil di _n. */
  const _n = [0, 1, 0];
  const normalOf = (a, b, c) => {
    const ux = b[0] - a[0]; const uy = b[1] - a[1]; const uz = b[2] - a[2];
    const vx = c[0] - a[0]; const vy = c[1] - a[1]; const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    _n[0] = nx / l; _n[1] = ny / l; _n[2] = nz / l;
    return _n;
  };
  /** Ubin persegi [0,W]×[0,H] tanpa klip (jalur cepat dinding/lereng atap/lantai). */
  const rectTiles = (o, U, V, W, H, tw, th, r, color) => {
    const nx = U[1] * V[2] - U[2] * V[1];
    const ny = U[2] * V[0] - U[0] * V[2];
    const nz = U[0] * V[1] - U[1] * V[0];
    const du = r.u1 - r.u0;
    const dv = r.v1 - r.v0;
    const ni = Math.max(1, Math.ceil(W / tw - 1e-6));
    const nj = Math.max(1, Math.ceil(H / th - 1e-6));
    grow(ni * nj * 6);
    for (let j = 0; j < nj; j += 1) {
      const t0 = j * th;
      const t1 = Math.min(H, t0 + th);
      const v0 = r.v0;
      const v1 = r.v0 + dv * ((t1 - t0) / th);
      for (let i = 0; i < ni; i += 1) {
        const s0 = i * tw;
        const s1 = Math.min(W, s0 + tw);
        const u1 = r.u0 + du * ((s1 - s0) / tw);
        const P = (s, t) => [o[0] + U[0] * s + V[0] * t, o[1] + U[1] * s + V[1] * t, o[2] + U[2] * s + V[2] * t];
        const a = P(s0, t0); const b = P(s1, t0); const c = P(s1, t1); const d = P(s0, t1);
        emit(a[0], a[1], a[2], nx, ny, nz, r.u0, v0, color);
        emit(b[0], b[1], b[2], nx, ny, nz, u1, v0, color);
        emit(c[0], c[1], c[2], nx, ny, nz, u1, v1, color);
        emit(a[0], a[1], a[2], nx, ny, nz, r.u0, v0, color);
        emit(c[0], c[1], c[2], nx, ny, nz, u1, v1, color);
        emit(d[0], d[1], d[2], nx, ny, nz, r.u0, v1, color);
      }
    }
  };
  const api = {
    get vertexCount() { return count; },
    get triangles() { return count / 3; },
    /** Segitiga p0,p1,p2 (CCW dilihat dari depan) dengan uv per titik [[u,v]×3]. */
    tri(p0, p1, p2, uv, color = WHITE) {
      grow(3);
      const n = normalOf(p0, p1, p2);
      emit(p0[0], p0[1], p0[2], n[0], n[1], n[2], uv[0][0], uv[0][1], color);
      emit(p1[0], p1[1], p1[2], n[0], n[1], n[2], uv[1][0], uv[1][1], color);
      emit(p2[0], p2[1], p2[2], n[0], n[1], n[2], uv[2][0], uv[2][1], color);
    },
    /** Quad p0 kiri-bawah, p1 kanan-bawah, p2 kanan-atas, p3 kiri-atas (dilihat dari depan); rect UV penuh. */
    quad(p0, p1, p2, p3, r, color = WHITE) {
      grow(6);
      const n = normalOf(p0, p1, p3);
      const [nx, ny, nz] = n;
      emit(p0[0], p0[1], p0[2], nx, ny, nz, r.u0, r.v0, color);
      emit(p1[0], p1[1], p1[2], nx, ny, nz, r.u1, r.v0, color);
      emit(p2[0], p2[1], p2[2], nx, ny, nz, r.u1, r.v1, color);
      emit(p0[0], p0[1], p0[2], nx, ny, nz, r.u0, r.v0, color);
      emit(p2[0], p2[1], p2[2], nx, ny, nz, r.u1, r.v1, color);
      emit(p3[0], p3[1], p3[2], nx, ny, nz, r.u0, r.v1, color);
    },
    /** Poligon cembung (titik 3D CCW dari depan, uv per titik), kipas dari titik 0. */
    polygon(points, uv, color = WHITE) {
      for (let i = 1; i + 1 < points.length; i += 1) api.tri(points[0], points[i], points[i + 1], [uv[0], uv[i], uv[i + 1]], color);
    },
    /**
     * Bidang ber-ubin: origin + s·U + t·V (U,V satuan; normal = U × V), poligon cembung `poly` di (s,t) meter,
     * dipotong grid tileW × tileH; tiap potongan memetakan sel atlas `r` penuh per ubin. Persegi [0,W]×[0,H]
     * memakai jalur cepat tanpa klip.
     */
    tiled(origin, U, V, poly, tileW, tileH, r, color = WHITE) {
      if (isRect(poly)) {
        rectTiles(origin, U, V, poly[2][0], poly[2][1], tileW, tileH, r, color);
        return;
      }
      const s = poly.map((p) => p[0]);
      const t = poly.map((p) => p[1]);
      const i0 = Math.floor(Math.min(...s) / tileW + 1e-6);
      const i1 = Math.ceil(Math.max(...s) / tileW - 1e-6);
      const j0 = Math.floor(Math.min(...t) / tileH + 1e-6);
      const j1 = Math.ceil(Math.max(...t) / tileH - 1e-6);
      for (let j = j0; j < j1; j += 1) {
        for (let i = i0; i < i1; i += 1) {
          const cell = clipRect(poly, i * tileW, j * tileH, (i + 1) * tileW, (j + 1) * tileH);
          if (cell.length < 3) continue;
          const pts = cell.map(([ps, pt]) => [origin[0] + U[0] * ps + V[0] * pt, origin[1] + U[1] * ps + V[1] * pt, origin[2] + U[2] * ps + V[2] * pt]);
          const uv = cell.map(([ps, pt]) => [r.u0 + (r.u1 - r.u0) * (ps / tileW - i), r.v0 + (r.v1 - r.v0) * (pt / tileH - j)]);
          api.polygon(pts, uv, color);
        }
      }
    },
    /** Kotak berpusat (cx, cy, cz) ukuran sx × sy × sz, diputar yaw; tiap sisi memetakan rect penuh. */
    box(cx, cy, cz, sx, sy, sz, yaw, r, color = WHITE, { bottom = false, top = true } = {}) {
      const c = Math.cos(yaw);
      const sn = Math.sin(yaw);
      const P = (x, y, z) => [cx + x * c + z * sn, cy + y, cz - x * sn + z * c];
      const hx = sx / 2;
      const hy = sy / 2;
      const hz = sz / 2;
      api.quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), r, color);
      api.quad(P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), r, color);
      api.quad(P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), r, color);
      api.quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), r, color);
      if (top) api.quad(P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), P(-hx, hy, -hz), r, color);
      if (bottom) api.quad(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz), r, color);
    },
    /** Tutup bola (kubah) di atas pusat (cx, cy, cz): radius, segmen keliling & lintang. */
    dome(cx, cy, cz, radius, segs, rings, r, color = WHITE) {
      const pt = (a, b) => [cx + radius * Math.cos(b) * Math.cos(a), cy + radius * Math.sin(b), cz + radius * Math.cos(b) * Math.sin(a)];
      for (let j = 0; j < rings; j += 1) {
        const b0 = (j / rings) * (Math.PI / 2);
        const b1 = ((j + 1) / rings) * (Math.PI / 2);
        for (let i = 0; i < segs; i += 1) {
          const a0 = (i / segs) * Math.PI * 2;
          const a1 = ((i + 1) / segs) * Math.PI * 2;
          const q = subUv(r, i / segs, j / rings, (i + 1) / segs, (j + 1) / rings);
          api.quad(pt(a1, b0), pt(a0, b0), pt(a0, b1), pt(a1, b1), q, color);
        }
      }
    },
    /** Penanda posisi tulis (untuk membatalkan gedung yang gagal dirakit). */
    mark() { return count; },
    /** Kembalikan posisi tulis ke penanda (membuang verteks sesudahnya). */
    rewind(m) { count = Math.min(count, Math.max(0, m)); },
    /**
     * BufferGeometry; null bila kosong. copy=false memakai view (tanpa salin; buffer cadangan tetap hidup),
     * sphere = {center:[x,y,z], radius} menghindari iterasi computeBoundingSphere (klaster besar).
     */
    toGeometry({ copy = true, sphere = null } = {}) {
      if (count === 0) return null;
      const take = (arr, k) => (copy ? arr.slice(0, count * k) : arr.subarray(0, count * k));
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(take(pos, 3), 3));
      g.setAttribute('normal', new BufferAttribute(take(nor, 3), 3));
      g.setAttribute('uv', new BufferAttribute(take(uvs, 2), 2));
      g.setAttribute('color', new BufferAttribute(take(col, 3), 3));
      if (sphere) g.boundingSphere = new Sphere(new Vector3(...sphere.center), sphere.radius);
      else g.computeBoundingSphere();
      return g;
    },
  };
  return api;
}

/** Poligon (s,t) berbentuk persegi [[0,0],[W,0],[W,H],[0,H]]. */
function isRect(p) {
  return p.length === 4 && p[0][0] === 0 && p[0][1] === 0 && p[1][1] === 0 && p[3][0] === 0 && p[1][0] === p[2][0] && p[2][1] === p[3][1] && p[1][0] > 0 && p[2][1] > 0;
}

/** Sutherland–Hodgman: klip poligon cembung (s,t) ke persegi [s0,s1]×[t0,t1]. */
export function clipRect(poly, s0, t0, s1, t1) {
  const edges = [
    (p) => p[0] >= s0 - 1e-9, (p) => p[0] <= s1 + 1e-9, (p) => p[1] >= t0 - 1e-9, (p) => p[1] <= t1 + 1e-9,
  ];
  const cuts = [
    (a, b) => lerpAt(a, b, 0, s0), (a, b) => lerpAt(a, b, 0, s1), (a, b) => lerpAt(a, b, 1, t0), (a, b) => lerpAt(a, b, 1, t1),
  ];
  let out = poly;
  for (let k = 0; k < 4 && out.length; k += 1) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i += 1) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const inCur = edges[k](cur);
      const inPrev = edges[k](prev);
      if (inCur) {
        if (!inPrev) out.push(cuts[k](prev, cur));
        out.push(cur);
      } else if (inPrev) out.push(cuts[k](prev, cur));
    }
  }
  return out;
}

function lerpAt(a, b, axis, value) {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Satu MeshBuilder per kunci material; toParts → PartList {geometry, material, matrix:null, castShadow, name}.
 * `capacity` = perkiraan verteks awal per kunci (klaster: dari jumlah bay) agar array jarang tumbuh.
 */
export function createKitSink({ capacity = {} } = {}) {
  const builders = Object.fromEntries(SINK_KEYS.map((k) => [k, createMeshBuilder(capacity[k] ?? START_VERTS)]));
  /** Part hero bermaterial sendiri (M6; matriks dunia) — apa adanya, bukan geometri kit. */
  const extra = [];
  return {
    ...builders,
    extra,
    get triangles() { return SINK_KEYS.reduce((s, k) => s + builders[k].triangles, 0); },
    mark() { return [...SINK_KEYS.map((k) => builders[k].mark()), extra.length]; },
    rewind(m) {
      SINK_KEYS.forEach((k, i) => builders[k].rewind(m[i]));
      extra.length = Math.min(extra.length, m[SINK_KEYS.length] ?? 0);
    },
    /** @param {{opak:object, potong:object, papan?:object|null}} materials */
    toParts(materials, name = 'gedung', geometryOpts = {}) {
      const parts = [];
      for (const key of SINK_KEYS) {
        const material = materials[key];
        if (!material) continue;
        const geometry = builders[key].toGeometry(geometryOpts);
        if (geometry) parts.push({ geometry, material, matrix: null, castShadow: key !== 'papan', name: `${name}:${key}` });
      }
      return parts;
    },
  };
}
