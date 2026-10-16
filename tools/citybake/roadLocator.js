/**
 * Pencari kelas jalan terdekat (grid seragam) — konteks heuristik tinggi bangunan.
 * Input jalan dalam koordinat dunia ({cls, line: [[x, z], ...]}).
 */

const CELL = 50;

function distToSegment(px, pz, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2)) : 0;
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

const cellKey = (cx, cz) => `${cx},${cz}`;

/**
 * @param {Array<{cls: string, line: Array<[number, number]>}>} roads
 * @returns {(x: number, z: number, maxDist?: number) => string|null} kelas jalan terdekat ≤ maxDist
 */
export function createRoadLocator(roads) {
  const grid = new Map();
  for (const road of roads) {
    for (let i = 0; i < road.line.length - 1; i += 1) {
      const a = road.line[i];
      const b = road.line[i + 1];
      const seg = { cls: road.cls, a, b };
      const cx0 = Math.floor(Math.min(a[0], b[0]) / CELL);
      const cx1 = Math.floor(Math.max(a[0], b[0]) / CELL);
      const cz0 = Math.floor(Math.min(a[1], b[1]) / CELL);
      const cz1 = Math.floor(Math.max(a[1], b[1]) / CELL);
      for (let cx = cx0; cx <= cx1; cx += 1) {
        for (let cz = cz0; cz <= cz1; cz += 1) {
          const k = cellKey(cx, cz);
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(seg);
        }
      }
    }
  }
  return (x, z, maxDist = 40) => {
    const r = Math.ceil(maxDist / CELL);
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let best = null;
    let bestD = maxDist;
    for (let i = cx - r; i <= cx + r; i += 1) {
      for (let j = cz - r; j <= cz + r; j += 1) {
        for (const s of grid.get(cellKey(i, j)) ?? []) {
          const d = distToSegment(x, z, s.a, s.b);
          if (d <= bestD) {
            bestD = d;
            best = s.cls;
          }
        }
      }
    }
    return best;
  };
}
