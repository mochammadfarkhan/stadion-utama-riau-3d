/**
 * OBB (kotak berorientasi) footprint gedung. Sumbu utama dari momen luas poligon (PCA), lalu
 * disempurnakan dengan sudut setiap sisi hull cembung: kandidat dengan luas OBB terkecil menang
 * (PCA tidak stabil untuk footprint ~persegi). Konvensi frame lokal massa: X lokal = sisi panjang `w`,
 * Z lokal = sisi pendek `d`, `yaw` = rotasi three.js mengitari +Y (X lokal → dunia (cos yaw, −sin yaw)),
 * dinormalkan ke (−π/2, π/2]. Murni (tanpa three).
 */
import { cleanRing, convexHull, polygonArea } from '../../geo/polygon.js';

export const OBB_RECT_MIN = 0.85; // rasio luas footprint/OBB minimum agar dianggap persegi (spec §7.2)
const MIN_AREA = 1; // m²; footprint lebih kecil dari ini dianggap rusak
const EPS = 1e-9;

/** Normalkan sudut ke (−π/2, π/2] (OBB simetris terhadap putaran 180°). */
export function normalizeYaw(yaw) {
  let a = yaw % Math.PI;
  if (a <= -Math.PI / 2) a += Math.PI;
  if (a > Math.PI / 2) a -= Math.PI;
  return a;
}

/** Titik dunia → frame lokal OBB. */
export function toLocal(obb, x, z) {
  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  const dx = x - obb.cx;
  const dz = z - obb.cz;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/** Titik frame lokal OBB → dunia. */
export function toWorld(obb, lx, lz) {
  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  return { x: obb.cx + lx * c + lz * s, z: obb.cz - lx * s + lz * c };
}

/** Sudut sumbu utama (radian; arah (cos θ, sin θ) di bidang x,z) dari momen luas kedua poligon. */
export function principalAngle(ring) {
  let a = 0;
  let sx = 0;
  let sz = 0;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (let i = 0, n = ring.length; i < n; i += 1) {
    const [px, pz] = ring[i];
    const [qx, qz] = ring[(i + 1) % n];
    const cr = px * qz - qx * pz;
    a += cr;
    sx += (px + qx) * cr;
    sz += (pz + qz) * cr;
    sxx += (px * px + px * qx + qx * qx) * cr;
    szz += (pz * pz + pz * qz + qz * qz) * cr;
    sxz += (px * qz + 2 * px * pz + 2 * qx * qz + qx * pz) * cr;
  }
  if (Math.abs(a) < EPS) return 0;
  const cx = sx / (3 * a);
  const cz = sz / (3 * a);
  const cxx = sxx / (6 * a) - cx * cx;
  const czz = szz / (6 * a) - cz * cz;
  const cxz = sxz / (12 * a) - cx * cz;
  return 0.5 * Math.atan2(2 * cxz, cxx - czz);
}

/**
 * Yaw sumbu sisi dominan: histogram arah sisi (modulo 90°, bin 1°, bobot panjang, dihaluskan), lalu rata-rata
 * berbobot sisi dalam ±3° dari puncak. Untuk footprint siku-siku yang sayapnya miring terhadap OBB
 * (denah silang/pinwheel FKIP) frame ini memberi dekomposisi yang benar.
 */
export function dominantYaw(ring) {
  const quarter = Math.PI / 2;
  const bins = new Float64Array(90);
  const edges = [];
  for (let i = 0, n = ring.length; i < n; i += 1) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < EPS) continue;
    const ang = ((Math.atan2(bz - az, bx - ax) % quarter) + quarter) % quarter;
    edges.push({ ang, len });
    bins[Math.min(89, Math.floor((ang / quarter) * 90))] += len;
  }
  let peak = 0;
  let peakW = -1;
  for (let i = 0; i < 90; i += 1) {
    const w = bins[(i + 89) % 90] * 0.5 + bins[i] + bins[(i + 1) % 90] * 0.5;
    if (w > peakW) {
      peakW = w;
      peak = i;
    }
  }
  const center = ((peak + 0.5) / 90) * quarter;
  let sum = 0;
  let wsum = 0;
  for (const e of edges) {
    let delta = e.ang - center;
    if (delta > quarter / 2) delta -= quarter;
    if (delta < -quarter / 2) delta += quarter;
    if (Math.abs(delta) <= (3 * Math.PI) / 180) {
      sum += delta * e.len;
      wsum += e.len;
    }
  }
  const theta = center + (wsum > 0 ? sum / wsum : 0);
  return normalizeYaw(-theta);
}

/** Rentang proyeksi titik pada sumbu θ (u) dan tegak lurusnya (v). */
function extentsAt(points, theta) {
  const ux = Math.cos(theta);
  const uz = Math.sin(theta);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const [x, z] of points) {
    const u = x * ux + z * uz;
    const v = -x * uz + z * ux;
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
    if (v < v0) v0 = v;
    if (v > v1) v1 = v;
  }
  return { theta, u0, u1, v0, v1, area: (u1 - u0) * (v1 - v0) };
}

/**
 * @param {Array<[number, number]>} ring ring dunia (terbuka atau tertutup)
 * @returns {{cx:number, cz:number, w:number, d:number, yaw:number, area:number, rectangularity:number}}
 */
export function computeObb(ring) {
  const clean = cleanRing(ring ?? []);
  const area = clean.length >= 3 ? polygonArea(clean) : 0;
  if (!(area >= MIN_AREA)) throw new RangeError(`computeObb: footprint tidak valid (luas ${area})`);
  const hull = convexHull(clean);
  const candidates = [principalAngle(clean)];
  for (let i = 0; i < hull.length; i += 1) {
    const [ax, az] = hull[i];
    const [bx, bz] = hull[(i + 1) % hull.length];
    if (Math.hypot(bx - ax, bz - az) > EPS) candidates.push(Math.atan2(bz - az, bx - ax));
  }
  let best = extentsAt(hull, candidates[0]);
  for (let i = 1; i < candidates.length; i += 1) {
    const e = extentsAt(hull, candidates[i]);
    if (e.area < best.area * (1 - 1e-6)) best = e;
  }
  let theta = best.theta;
  let w = best.u1 - best.u0;
  let d = best.v1 - best.v0;
  const mu = (best.u0 + best.u1) / 2;
  const mv = (best.v0 + best.v1) / 2;
  const cx = mu * Math.cos(theta) - mv * Math.sin(theta);
  const cz = mu * Math.sin(theta) + mv * Math.cos(theta);
  if (w < d) {
    [w, d] = [d, w];
    theta += Math.PI / 2;
  }
  // arah sumbu X lokal di dunia = (cos θ, sin θ) → yaw three.js = atan2(−sin θ, cos θ) = −θ
  return { cx, cz, w, d, yaw: normalizeYaw(-theta), area, rectangularity: area / (w * d) };
}
