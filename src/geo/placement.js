/**
 * Placement region dari footprint OSM (Plan C, Fase 3): posisi = centroid luas poligon, yaw = arah
 * sumbu panjang (momen inersia luas kedua) dipetakan ke sumbu +Z lokal region. Murni.
 */
import { cleanRing, orientRing, signedArea } from './polygon.js';

/**
 * Centroid & momen luas kedua (terhadap centroid) ring [[x, z], ...]; ring dipositifkan dulu.
 * @returns {{area:number, cx:number, cz:number, sxx:number, szz:number, sxz:number}}
 */
export function areaMoments(ring) {
  const r = orientRing(cleanRing(ring), true);
  const n = r.length;
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < n; i += 1) {
    const [x0, z0] = r[i];
    const [x1, z1] = r[(i + 1) % n];
    const c = x0 * z1 - x1 * z0;
    a += c;
    cx += (x0 + x1) * c;
    cz += (z0 + z1) * c;
  }
  a /= 2;
  cx /= 6 * a;
  cz /= 6 * a;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (let i = 0; i < n; i += 1) {
    const x0 = r[i][0] - cx;
    const z0 = r[i][1] - cz;
    const x1 = r[(i + 1) % n][0] - cx;
    const z1 = r[(i + 1) % n][1] - cz;
    const c = x0 * z1 - x1 * z0;
    sxx += (x0 * x0 + x0 * x1 + x1 * x1) * c;
    szz += (z0 * z0 + z0 * z1 + z1 * z1) * c;
    sxz += (x0 * z1 + 2 * x0 * z0 + 2 * x1 * z1 + x1 * z0) * c;
  }
  return { area: a, cx, cz, sxx: sxx / 12, szz: szz / 12, sxz: sxz / 24 };
}

/**
 * Placement {x, z, yaw} agar sumbu +Z lokal region sejajar sumbu panjang footprint. yaw ∈ (−π/2, π/2]
 * (sumbu tak berarah). Konvensi toWorld: lokal +Z → dunia (sin yaw, cos yaw).
 * @param {Array<[number, number]>} ring footprint dalam koordinat dunia
 */
export function placementFromFootprint(ring) {
  if (!Array.isArray(ring) || ring.length < 3 || Math.abs(signedArea(ring)) < 1e-6) {
    throw new RangeError('placementFromFootprint: ring minimal 3 titik dengan luas > 0');
  }
  const m = areaMoments(ring);
  const ang = 0.5 * Math.atan2(2 * m.sxz, m.sxx - m.szz); // arah variansi terbesar dari +X
  let dx = Math.cos(ang);
  let dz = Math.sin(ang);
  if (dz < 0 || (dz === 0 && dx < 0)) {
    dx = -dx;
    dz = -dz;
  }
  return { x: m.cx, z: m.cz, yaw: Math.atan2(dx, dz) };
}
