/**
 * Pengondisian jalan (spec §5.2 langkah 6), tiga tahap:
 * 1. Profil memanjang tiap jalan (sampel tiap `spacing` m dari tanah asal) dihaluskan Gaussian 3 sampel
 *    lalu dibatasi tanjakan ≤ maxGrade (rerata lintasan maju & mundur; keduanya memenuhi batas sehingga
 *    reratanya juga).
 * 2. Tiap simpul grid dalam jangkauan mengambil jalan TERDEKAT (target = profil di titik proyeksi).
 * 3. Simpul inti (≤ lebar/2 + bahu) dibuat Lipschitz-g pada graf 8-tetangga simpul inti: selubung bawah
 *    U = min_j(v_j + g·d_ij) dan atas L = max_j(v_j − g·d_ij) (Dijkstra multi-sumber), hasil (U + L)/2 juga
 *    Lipschitz-g. Ini menghapus "tangga" di simpang/jalan sejajar yang profilnya berbeda.
 * Zona blend (`blend` m di luar inti) berbaur linier ke tanah asal; parit opsional di tepi jalan utama.
 * Hanya simpul dengan w > 0 (di dalam distrik) yang diubah. Murni.
 */
import { nodeRange, sampleGrid } from './grid.js';

/** Polyline → titik tiap ≤ spacing m + jarak kumulatif s. */
export function resamplePolyline(line, spacing) {
  const pts = [[line[0][0], line[0][1]]];
  const s = [0];
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len === 0) continue;
    const steps = Math.max(1, Math.ceil(len / spacing));
    for (let k = 1; k <= steps; k += 1) {
      pts.push([a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps]);
      s.push(s[s.length - 1] + len / steps);
    }
  }
  return { pts, s };
}

/** Gaussian 3 sampel [¼, ½, ¼]; ujung tetap. */
export function smooth3(values) {
  const out = Float64Array.from(values);
  for (let i = 1; i < values.length - 1; i += 1) out[i] = 0.25 * values[i - 1] + 0.5 * values[i] + 0.25 * values[i + 1];
  return out;
}

/** Batasi |Δy| ≤ g·Δs: rerata lintasan maju dan lintasan mundur (simetris, tetap memenuhi batas). */
export function limitGrade(values, s, maxGrade) {
  const n = values.length;
  const fwd = Float64Array.from(values);
  for (let i = 1; i < n; i += 1) {
    const d = maxGrade * (s[i] - s[i - 1]);
    fwd[i] = Math.min(fwd[i - 1] + d, Math.max(fwd[i - 1] - d, fwd[i]));
  }
  const bwd = Float64Array.from(values);
  for (let i = n - 2; i >= 0; i -= 1) {
    const d = maxGrade * (s[i + 1] - s[i]);
    bwd[i] = Math.min(bwd[i + 1] + d, Math.max(bwd[i + 1] - d, bwd[i]));
  }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) out[i] = (fwd[i] + bwd[i]) / 2;
  return out;
}

/** Tanjakan maksimum |Δy/Δs| sebuah profil. */
export function maxGradeOf(values, s) {
  let g = 0;
  for (let i = 1; i < values.length; i += 1) {
    const ds = s[i] - s[i - 1];
    if (ds > 0) g = Math.max(g, Math.abs(values[i] - values[i - 1]) / ds);
  }
  return g;
}

/** Kedalaman parit (m, positif) pada jarak d dari sumbu; profil cos² selebar parit + 1 sampel grid tiap sisi. */
export function ditchDepth(d, core, ditch, step) {
  if (!ditch?.enabled) return 0;
  const center = core + ditch.offset + ditch.width / 2;
  const half = ditch.width / 2 + step;
  const u = Math.abs(d - center) / half;
  return u >= 1 ? 0 : ditch.depth * Math.cos((Math.PI / 2) * u) ** 2;
}

/** Profil terkondisi satu jalan. */
export function roadProfile(grid, data, road, { spacing, maxGrade }) {
  const { pts, s } = resamplePolyline(road.line, spacing);
  const raw = pts.map(([x, z]) => sampleGrid(grid, data, x, z));
  const values = limitGrade(smooth3(raw), s, maxGrade);
  return { pts, s, values, gradeBefore: maxGradeOf(raw, s), gradeAfter: maxGradeOf(values, s) };
}

/** Min-heap biner (kunci, indeks) untuk Dijkstra. */
function createHeap() {
  const keys = [];
  const ids = [];
  const swap = (a, b) => {
    [keys[a], keys[b]] = [keys[b], keys[a]];
    [ids[a], ids[b]] = [ids[b], ids[a]];
  };
  return {
    get size() { return keys.length; },
    push(k, id) {
      keys.push(k);
      ids.push(id);
      let i = keys.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (keys[p] < keys[i] || (keys[p] === keys[i] && ids[p] <= ids[i])) break;
        swap(i, p);
        i = p;
      }
    },
    pop() {
      const top = [keys[0], ids[0]];
      const lastK = keys.pop();
      const lastI = ids.pop();
      if (keys.length > 0) {
        keys[0] = lastK;
        ids[0] = lastI;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          const less = (a, b) => keys[a] < keys[b] || (keys[a] === keys[b] && ids[a] < ids[b]);
          if (l < keys.length && less(l, m)) m = l;
          if (r < keys.length && less(r, m)) m = r;
          if (m === i) break;
          swap(i, m);
          i = m;
        }
      }
      return top;
    },
  };
}

const NEIGHBORS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

/** Selubung bawah Lipschitz: out_i = min_j(v_j + g·d_ij) di graf 8-tetangga simpul ber-mask. */
function lowerEnvelope(grid, mask, values, g) {
  const out = Float64Array.from(values);
  const heap = createHeap();
  for (let i = 0; i < mask.length; i += 1) if (mask[i]) heap.push(out[i], i);
  const done = new Uint8Array(mask.length);
  while (heap.size > 0) {
    const [k, i] = heap.pop();
    if (done[i] || k > out[i]) continue;
    done[i] = 1;
    const r = Math.floor(i / grid.cols);
    const c = i - r * grid.cols;
    for (const [dr, dc] of NEIGHBORS) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= grid.rows || cc < 0 || cc >= grid.cols) continue;
      const j = rr * grid.cols + cc;
      if (!mask[j] || done[j]) continue;
      const cand = k + g * grid.step * Math.hypot(dr, dc);
      if (cand < out[j]) {
        out[j] = cand;
        heap.push(cand, j);
      }
    }
  }
  return out;
}

/**
 * Nilai Lipschitz-g (per meter) pada simpul ber-mask: (U + L)/2. Simpul tanpa mask tidak disentuh.
 * @param {Uint8Array} mask
 * @param {Float64Array} values
 * @returns {Float64Array}
 */
export function lipschitzOnMask(grid, mask, values, g) {
  const upper = lowerEnvelope(grid, mask, values, g);
  const neg = values.map((v) => -v);
  const lowerNeg = lowerEnvelope(grid, mask, neg, g);
  const out = Float64Array.from(values);
  for (let i = 0; i < mask.length; i += 1) if (mask[i]) out[i] = (upper[i] - lowerNeg[i]) / 2;
  return out;
}

/** Urutan deterministik jalan (id). */
export const roadOrder = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * @param {{minX:number,minZ:number,step:number,cols:number,rows:number}} grid
 * @param {Float64Array} data tinggi (sudah datum + blend)
 * @param {Float32Array} w bobot blend (0 = di luar distrik)
 * @param {Array<{id:string, cls:string, width:number, line:Array<[number,number]>}>} roads
 * @param {{spacing:number, maxGrade:number, shoulder:number, blend:number, ditch?:{enabled:boolean,
 *   width:number, depth:number, offset:number, classes:string[]}|null}} opts
 * @returns {{data: Float64Array, core: Uint8Array, stats: Array<{id:string, cls:string, gradeBefore:number, gradeAfter:number}>}}
 *   core = simpul inti jalan (dikunci untuk pad/air sesudahnya)
 */
export function conditionRoads(grid, data, w, roads, opts) {
  const { spacing, maxGrade, shoulder, blend, ditch = null } = opts;
  const n = grid.cols * grid.rows;
  const bestD = new Float64Array(n).fill(Infinity);
  const bestT = new Float64Array(n);
  const bestCore = new Float64Array(n);
  const bestDitch = new Uint8Array(n);
  const anchor = new Int32Array(n).fill(-1);
  const stats = [];
  for (const road of [...roads].sort(roadOrder)) {
    if (road.line.length < 2) continue;
    const prof = roadProfile(grid, data, road, { spacing, maxGrade });
    stats.push({ id: road.id, cls: road.cls, gradeBefore: prof.gradeBefore, gradeAfter: prof.gradeAfter });
    const core = road.width / 2 + shoulder;
    const reach = core + blend;
    const hasDitch = ditch?.enabled && ditch.classes.includes(road.cls) ? 1 : 0;
    for (let k = 0; k < prof.pts.length - 1; k += 1) {
      const a = prof.pts[k];
      const b = prof.pts[k + 1];
      const range = nodeRange(grid, {
        minX: Math.min(a[0], b[0]) - reach, maxX: Math.max(a[0], b[0]) + reach,
        minZ: Math.min(a[1], b[1]) - reach, maxZ: Math.max(a[1], b[1]) + reach,
      });
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len2 = dx * dx + dz * dz;
      for (let r = range.r0; r <= range.r1; r += 1) {
        const z = grid.minZ + r * grid.step;
        for (let c = range.c0; c <= range.c1; c += 1) {
          const i = r * grid.cols + c;
          if (!(w[i] > 0)) continue;
          const x = grid.minX + c * grid.step;
          const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / len2)) : 0;
          const px = a[0] + dx * t;
          const pz = a[1] + dz * t;
          const d = Math.hypot(x - px, z - pz);
          if (d > reach || d >= bestD[i]) continue;
          bestD[i] = d;
          bestT[i] = prof.values[k] + (prof.values[k + 1] - prof.values[k]) * t;
          bestCore[i] = core;
          bestDitch[i] = hasDitch;
          const ac = Math.round((px - grid.minX) / grid.step);
          const ar = Math.round((pz - grid.minZ) / grid.step);
          anchor[i] = ar >= 0 && ar < grid.rows && ac >= 0 && ac < grid.cols ? ar * grid.cols + ac : -1;
        }
      }
    }
  }
  const isCore = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) if (bestD[i] <= bestCore[i]) isCore[i] = 1;
  const coreVals = lipschitzOnMask(grid, isCore, bestT, maxGrade);
  const out = Float64Array.from(data);
  for (let i = 0; i < n; i += 1) {
    if (bestD[i] === Infinity) continue;
    if (isCore[i]) {
      out[i] = coreVals[i];
      continue;
    }
    const j = anchor[i];
    const target = bestT[i] + (j >= 0 && isCore[j] ? coreVals[j] - bestT[j] : 0);
    const rel = Math.min(1, (bestD[i] - bestCore[i]) / blend);
    out[i] = target + (data[i] - target) * rel - (bestDitch[i] ? ditchDepth(bestD[i], bestCore[i], ditch, grid.step) : 0);
  }
  return { data: out, core: isCore, stats };
}
