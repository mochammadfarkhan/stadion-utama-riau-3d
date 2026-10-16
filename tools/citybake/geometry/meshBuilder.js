/**
 * Akumulator mesh sederhana (POSITION/NORMAL/COLOR_0 + indeks) dan helper muka berorientasi otomatis.
 * Builder sengaja mutable tetapi lokal: dibuat, diisi, lalu dibekukan lewat toArrays() dalam satu fungsi.
 */

/** @typedef {[number, number, number]} Vec3 */

export function createMeshBuilder() {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  return {
    /** Tambah vertex; kembalikan indeksnya. */
    addVertex(x, y, z, nx, ny, nz, rgb) {
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      colors.push(rgb[0], rgb[1], rgb[2]);
      return positions.length / 3 - 1;
    },
    addTriangle(a, b, c) {
      indices.push(a, b, c);
    },
    get vertexCount() {
      return positions.length / 3;
    },
    get triangleCount() {
      return indices.length / 3;
    },
    /** Salinan bertipe; null bila kosong. */
    toArrays() {
      if (indices.length === 0) return null;
      return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        colors: new Float32Array(colors),
        indices: new Uint32Array(indices),
      };
    },
  };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 1, 0];
}

/**
 * Tambah muka datar (segitiga atau quad planar) dengan normal flat. Urutan titik dibalik bila
 * normal geometris berlawanan dengan `expected`, sehingga muka depan (CCW) selalu menghadap keluar.
 * @param {ReturnType<typeof createMeshBuilder>} builder
 * @param {Vec3[]} pts 3 atau 4 titik
 * @param {Vec3|Vec3[]} rgb satu warna atau warna per titik (sejajar `pts`)
 * @param {Vec3} expected arah kira-kira normal luar
 */
export function addFace(builder, pts, rgb, expected) {
  const cols = Array.isArray(rgb[0]) ? rgb : pts.map(() => rgb);
  let n = normalize(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  let order = pts.map((_, i) => i);
  if (dot(n, expected) < 0) {
    order = order.reverse();
    n = [-n[0], -n[1], -n[2]];
  }
  const idx = order.map((i) => builder.addVertex(pts[i][0], pts[i][1], pts[i][2], n[0], n[1], n[2], cols[i]));
  builder.addTriangle(idx[0], idx[1], idx[2]);
  if (idx.length === 4) builder.addTriangle(idx[0], idx[2], idx[3]);
}

/**
 * Tambah segitiga horizontal (normal +Y) dari indeks vertex yang sudah ada; urutan disesuaikan agar
 * menghadap atas. `xz` = koordinat [x, z] per indeks.
 */
export function addUpTriangle(builder, a, b, c, xz) {
  const [ax, az] = xz(a);
  const [bx, bz] = xz(b);
  const [cx, cz] = xz(c);
  const upY = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
  if (upY >= 0) builder.addTriangle(a, b, c);
  else builder.addTriangle(a, c, b);
}
