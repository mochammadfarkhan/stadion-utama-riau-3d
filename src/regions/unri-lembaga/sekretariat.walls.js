/**
 * Dinding berbukaan (pintu, jendela nako, roster). wallSegments (MURNI): persegi panjang padat (u sepanjang
 * dinding, v tinggi dari tanah) = dinding dikurangi bukaan. Bukaan ber-u sama (jendela + roster di atasnya)
 * diperlakukan sebagai satu kolom bertumpuk vertikal. wallBoxes: segmen → balok lokal-gedung.
 */
import { boxAt } from '../../world/props/unri/geom.js';

const EPS = 1e-6;

/**
 * @param {number} length @param {number} height
 * @param {Array<{u0:number,u1:number,v0:number,v1:number}>} openings
 * @returns {Array<{u0:number,u1:number,v0:number,v1:number}>}
 */
export function wallSegments(length, height, openings = []) {
  if (!(length > 0 && height > 0)) throw new RangeError('dinding: panjang & tinggi harus > 0');
  const cols = new Map();
  openings.forEach((o, i) => {
    const okU = o.u0 >= -EPS && o.u1 <= length + EPS && o.u1 - o.u0 > EPS;
    const okV = o.v0 >= -EPS && o.v1 <= height + EPS && o.v1 - o.v0 > EPS;
    if (!okU || !okV) throw new RangeError(`bukaan ${i} di luar dinding`);
    const key = `${o.u0.toFixed(6)}|${o.u1.toFixed(6)}`;
    if (!cols.has(key)) cols.set(key, []);
    cols.get(key).push(o);
  });
  const columns = [...cols.values()]
    .map((list) => ({ u0: list[0].u0, u1: list[0].u1, spans: [...list].sort((a, b) => a.v0 - b.v0) }))
    .sort((a, b) => a.u0 - b.u0);
  columns.forEach((c, i) => {
    if (i > 0 && c.u0 < columns[i - 1].u1 - EPS) throw new RangeError('bukaan bertumpuk (kolom)');
    c.spans.forEach((s, k) => {
      if (k > 0 && s.v0 < c.spans[k - 1].v1 - EPS) throw new RangeError('bukaan bertumpuk (vertikal)');
    });
  });
  const out = [];
  const push = (u0, u1, v0, v1) => {
    if (u1 - u0 > EPS && v1 - v0 > EPS) out.push({ u0, u1, v0, v1 });
  };
  let u = 0;
  for (const c of columns) {
    push(u, c.u0, 0, height);
    let v = 0;
    for (const s of c.spans) {
      push(c.u0, c.u1, v, s.v0);
      v = s.v1;
    }
    push(c.u0, c.u1, v, height);
    u = c.u1;
  }
  push(u, length, 0, height);
  return out;
}

/** Bukaan yang memotong pita setinggi `h` (mis. plint 0,6 m), dipotong di h. */
export function clipOpenings(openings, h) {
  return openings.filter((o) => o.v0 < h).map((o) => ({ u0: o.u0, u1: o.u1, v0: o.v0, v1: Math.min(o.v1, h) }));
}

/**
 * Segmen → balok lokal-gedung. axis 'z': dinding sejajar Z berpusat di x = at; axis 'x': sejajar X di z = at.
 * u diukur dari `from` (koordinat sepanjang sumbu dinding).
 */
export function wallBoxes(segments, { axis, at, from, thickness, y0 = 0 }) {
  return segments.map((s) => {
    const len = s.u1 - s.u0;
    const h = s.v1 - s.v0;
    const mid = from + (s.u0 + s.u1) / 2;
    return axis === 'z' ? boxAt(thickness, h, len, at, y0 + s.v0, mid) : boxAt(len, h, thickness, mid, y0 + s.v0, at);
  });
}
