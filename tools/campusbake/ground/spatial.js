/**
 * Indeks grid sederhana untuk kueri jarak/isi saat bake ground (murni, deterministik: urutan kandidat =
 * urutan penyisipan). Jarak hanya akurat sampai `reach` m dari bentuk; di luar itu Infinity.
 */
import { distanceToRing, distanceToSegment, pointInPolygon, ringBounds } from '../../../src/geo/polygon.js';

function createGrid(cell) {
  const cells = new Map();
  const keyOf = (cx, cz) => `${cx},${cz}`;
  return {
    insert(b, item) {
      for (let cz = Math.floor(b.minZ / cell); cz <= Math.floor(b.maxZ / cell); cz += 1) {
        for (let cx = Math.floor(b.minX / cell); cx <= Math.floor(b.maxX / cell); cx += 1) {
          const k = keyOf(cx, cz);
          let list = cells.get(k);
          if (!list) cells.set(k, (list = []));
          list.push(item);
        }
      }
    },
    at: (x, z) => cells.get(keyOf(Math.floor(x / cell), Math.floor(z / cell))) ?? [],
  };
}

const pad = (b, r) => ({ minX: b.minX - r, minZ: b.minZ - r, maxX: b.maxX + r, maxZ: b.maxZ + r });

/**
 * Pita polyline berlebar: items [{line, w, ...}]. nearest(x, z) → {d, item}: d = jarak ke TEPI pita terdekat
 * (negatif = di atas pita), Infinity bila tak ada pita dalam `reach`.
 */
export function createLineIndex(items, { cell = 25, reach = 10 } = {}) {
  const grid = createGrid(cell);
  for (const item of items) {
    for (let i = 0; i < item.line.length - 1; i += 1) {
      const a = item.line[i];
      const b = item.line[i + 1];
      const box = { minX: Math.min(a[0], b[0]), minZ: Math.min(a[1], b[1]), maxX: Math.max(a[0], b[0]), maxZ: Math.max(a[1], b[1]) };
      grid.insert(pad(box, item.w / 2 + reach), { item, a, b });
    }
  }
  return {
    nearest(x, z) {
      let best = { d: Infinity, item: null };
      for (const s of grid.at(x, z)) {
        const d = distanceToSegment(x, z, s.a, s.b) - s.item.w / 2;
        if (d < best.d) best = { d, item: s.item };
      }
      return best;
    },
  };
}

/** Poligon [{rings, ...}] (ring luar + lubang). */
export function createAreaIndex(items, { cell = 50, reach = 10 } = {}) {
  const grid = createGrid(cell);
  for (const item of items) grid.insert(pad(ringBounds(item.rings[0]), reach), item);
  const inside = (item, x, z) => pointInPolygon(x, z, item.rings[0])
    && !item.rings.slice(1).some((h) => pointInPolygon(x, z, h));
  return {
    /** Item pertama (urutan penyisipan) yang memuat titik, atau null. */
    contains(x, z, filter = null) {
      for (const item of grid.at(x, z)) if ((!filter || filter(item)) && inside(item, x, z)) return item;
      return null;
    },
    /** Jarak ke tepi ring luar terdekat (≤ reach), Infinity bila tak ada. */
    edgeDistance(x, z, filter = null) {
      let best = Infinity;
      for (const item of grid.at(x, z)) {
        if (filter && !filter(item)) continue;
        const d = distanceToRing(x, z, item.rings[0]);
        if (d < best) best = d;
      }
      return best;
    },
  };
}

/** Titik tiap `spacing` m sepanjang polyline mulai jarak `phase`: [{x, z, tx, tz, s}] (t = arah satuan segmen). */
export function samplesAlong(line, spacing, phase = 0) {
  const out = [];
  let acc = 0;
  let next = phase;
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len === 0) continue;
    const tx = (b[0] - a[0]) / len;
    const tz = (b[1] - a[1]) / len;
    while (next <= acc + len + 1e-9) {
      const t = next - acc;
      out.push({ x: a[0] + tx * t, z: a[1] + tz * t, tx, tz, s: next });
      next += spacing;
    }
    acc += len;
  }
  return out;
}
