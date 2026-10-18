/**
 * Dekomposisi footprint tak persegi menjadi ≤ 4 massa persegi panjang (spec §7.2 langkah 1).
 * Di frame lokal OBB: koordinat x/z unik titik ring (digabung bila < `snap`; dicoba bertingkat
 * `snaps` dari halus ke kasar agar tonjolan kecil 1–3 m tidak menghabiskan jatah massa) membentuk grid; sel yang
 * pusatnya di dalam poligon diisi; lalu persegi panjang sel terbesar diambil berulang (greedy) sampai
 * semua sel tertutup atau batas massa tercapai. Frame dicoba dua: arah sisi dominan (dominantYaw) lalu OBB. Gagal (null) bila cakupan < minCoverage, luas sel
 * > maxOvershoot × luas poligon, < minOrthogonal keliling sejajar sumbu (lengkung, mis. "Gedung Setengah
 * Bundar FT": ekstrusi K12 lebih setia), atau tidak ada massa yang cukup lebar.
 * Murni (tanpa three).
 */
import { cleanRing, pointInPolygon, polygonArea } from '../../geo/polygon.js';
import { dominantYaw, normalizeYaw, toLocal, toWorld } from './obb.js';

export const DECOMPOSE = Object.freeze({
  maxMasses: 4, snaps: Object.freeze([0.6, 1.5, 3.5]), minCoverage: 0.9, maxOvershoot: 1.08, minSide: 2.5,
  minOrthogonal: 0.75, orthoTolDeg: 8,
});

/** Fraksi keliling (0..1) yang sisinya sejajar sumbu frame lokal (± tolDeg). Lengkung/miring → rendah. */
export function orthogonalFraction(local, tolDeg = DECOMPOSE.orthoTolDeg) {
  const tol = Math.sin((tolDeg * Math.PI) / 180);
  let ok = 0;
  let all = 0;
  for (let i = 0, n = local.length; i < n; i += 1) {
    const [ax, az] = local[i];
    const [bx, bz] = local[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-9) continue;
    all += len;
    if (Math.min(Math.abs(bx - ax), Math.abs(bz - az)) / len <= tol) ok += len;
  }
  return all > 0 ? ok / all : 0;
}

/** Nilai unik terurut; nilai berurutan berjarak < snap digabung ke rata-ratanya. */
export function snapValues(values, snap) {
  const sorted = [...values].sort((a, b) => a - b);
  const groups = [];
  for (const v of sorted) {
    const g = groups[groups.length - 1];
    if (g && v - g.last < snap) {
      g.sum += v;
      g.n += 1;
      g.last = v;
    } else groups.push({ sum: v, n: 1, last: v });
  }
  return groups.map((g) => g.sum / g.n);
}

/** Grid sel terisi (Uint8Array baris-mayor j*nx+i) di frame lokal. */
function fillGrid(local, xs, zs) {
  const nx = xs.length - 1;
  const nz = zs.length - 1;
  const filled = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cz = (zs[j] + zs[j + 1]) / 2;
      filled[j * nx + i] = pointInPolygon(cx, cz, local) ? 1 : 0;
    }
  }
  return { nx, nz, filled };
}

/** Persegi panjang sel bebas (terisi & belum tertutup) dengan luas m² terbesar. */
function largestRect(grid, covered, xs, zs) {
  const { nx, nz, filled } = grid;
  const free = (i, j) => filled[j * nx + i] === 1 && covered[j * nx + i] === 0;
  let best = null;
  for (let j0 = 0; j0 < nz; j0 += 1) {
    for (let i0 = 0; i0 < nx; i0 += 1) {
      if (!free(i0, j0)) continue;
      let maxI = nx - 1;
      for (let j1 = j0; j1 < nz; j1 += 1) {
        let i1 = i0;
        while (i1 <= maxI && free(i1, j1)) i1 += 1;
        maxI = i1 - 1;
        if (maxI < i0) break;
        const area = (xs[maxI + 1] - xs[i0]) * (zs[j1 + 1] - zs[j0]);
        if (!best || area > best.area + 1e-9) best = { i0, i1: maxI, j0, j1, area };
      }
    }
  }
  return best;
}

/**
 * @param {Array<[number, number]>} ring ring dunia
 * @param {{cx:number, cz:number, w:number, d:number, yaw:number}} obb OBB ring (computeObb)
 * @param {Partial<typeof DECOMPOSE>} [opts]
 * @returns {{masses: Array<{cx:number, cz:number, w:number, d:number, yaw:number}>, coverage:number}|null}
 */
export function decomposeFootprint(ring, obb, opts = {}) {
  const cfg = { ...DECOMPOSE, ...opts };
  const clean = cleanRing(ring ?? []);
  if (clean.length < 3) return null;
  const dom = { cx: obb.cx, cz: obb.cz, yaw: dominantYaw(clean) };
  const sameAxis = Math.abs(Math.sin(2 * (dom.yaw - obb.yaw))) < Math.sin((2 * Math.PI) / 180);
  const frames = sameAxis ? [obb] : [dom, obb];
  for (const frame of frames) {
    const local = clean.map(([x, z]) => {
      const p = toLocal(frame, x, z);
      return [p.x, p.z];
    });
    if (orthogonalFraction(local, cfg.orthoTolDeg) < cfg.minOrthogonal) continue; // lengkung → K12 ekstrusi
    for (const snap of cfg.snaps) {
      const result = decomposeLocal(local, frame, snap, cfg);
      if (result) return result;
    }
  }
  return null;
}

/** Satu percobaan dekomposisi pada ring lokal dengan toleransi `snap`; null bila gagal. */
function decomposeLocal(local, obb, snap, cfg) {
  const total = polygonArea(local);
  const xs = snapValues(local.map((p) => p[0]), snap);
  const zs = snapValues(local.map((p) => p[1]), snap);
  if (xs.length < 2 || zs.length < 2 || !(total > 0)) return null;
  const grid = fillGrid(local, xs, zs);
  const covered = new Uint8Array(grid.filled.length);
  const rects = [];
  while (rects.length < cfg.maxMasses) {
    const r = largestRect(grid, covered, xs, zs);
    if (!r) break;
    for (let j = r.j0; j <= r.j1; j += 1) for (let i = r.i0; i <= r.i1; i += 1) covered[j * grid.nx + i] = 1;
    rects.push({ x0: xs[r.i0], x1: xs[r.i1 + 1], z0: zs[r.j0], z1: zs[r.j1 + 1], area: r.area });
  }
  const filledArea = rects.reduce((s, r) => s + r.area, 0);
  const kept = rects.filter((r) => Math.min(r.x1 - r.x0, r.z1 - r.z0) >= cfg.minSide);
  const coverage = kept.reduce((s, r) => s + r.area, 0) / total;
  if (kept.length === 0 || coverage < cfg.minCoverage || filledArea > total * cfg.maxOvershoot) return null;
  const masses = kept
    .sort((a, b) => b.area - a.area)
    .map((r) => {
      const c = toWorld(obb, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
      const lw = r.x1 - r.x0;
      const ld = r.z1 - r.z0;
      return lw >= ld
        ? { cx: c.x, cz: c.z, w: lw, d: ld, yaw: obb.yaw }
        : { cx: c.x, cz: c.z, w: ld, d: lw, yaw: normalizeYaw(obb.yaw + Math.PI / 2) };
    });
  return { masses, coverage };
}
