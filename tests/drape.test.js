import { describe, it, expect } from 'vitest';
import { createChunkSurface, drapePolygon, drapePolyline, nodeIndices, DRAPE } from '../src/world/terrain/drape.js';

const plane = (a = 0, b = 0, c = 0) => ({
  heightAt: (x, z) => a * x + b * z + c,
  normalAt: (x, z, out = {}) => {
    const l = Math.hypot(a, 1, b);
    return Object.assign(out, { x: -a / l, y: 1 / l, z: -b / l });
  },
});
function tris(g) {
  const p = g.getAttribute('position');
  const ix = g.index.array;
  const out = [];
  for (let i = 0; i < ix.length; i += 3) out.push([0, 1, 2].map((k) => [p.getX(ix[i + k]), p.getY(ix[i + k]), p.getZ(ix[i + k])]));
  return out;
}
const areaXZ = (t) => Math.abs((t[1][0] - t[0][0]) * (t[2][2] - t[0][2]) - (t[2][0] - t[0][0]) * (t[1][2] - t[0][2])) / 2;
const upY = (t) => (t[1][2] - t[0][2]) * (t[2][0] - t[0][0]) - (t[1][0] - t[0][0]) * (t[2][2] - t[0][2]);
const edges = (t) => [[0, 1], [1, 2], [2, 0]].map(([i, j]) => Math.hypot(t[i][0] - t[j][0], t[i][2] - t[j][2]));
const sum = (list, f) => list.reduce((s, t) => s + f(t), 0);
const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

describe('nodeIndices', () => {
  it('LOD0 = semua sampel; LOD1 = kelipatan 4 + tepi 125', () => {
    expect(nodeIndices(126, 1)).toHaveLength(126);
    const l1 = nodeIndices(126, 4);
    expect(l1.slice(0, 3)).toEqual([0, 4, 8]);
    expect(l1.slice(-2)).toEqual([124, 125]);
    expect(l1).toHaveLength(33);
  });
});

describe('createChunkSurface', () => {
  const chunk = { origin: { x: 500, z: -500 }, step: 4, n: 126 };

  it('bidang miring: tinggi & normal persis', () => {
    const s = createChunkSurface(chunk, { sample: (c, x, z) => 0.1 * x - 0.05 * z + 2 });
    expect(s.heightAt(612.3, -401.7)).toBeCloseTo(0.1 * 612.3 + 0.05 * 401.7 + 2, 9);
    const n = s.normalAt(700, -300);
    const l = Math.hypot(0.1, 1, 0.05);
    expect(n.x).toBeCloseTo(-0.1 / l, 9);
    expect(n.y).toBeCloseTo(1 / l, 9);
    expect(n.z).toBeCloseTo(0.05 / l, 9);
  });

  it('aman-mesh: ≥ kedua kemungkinan triangulasi sel (papan catur)', () => {
    const s = createChunkSurface(chunk, { sample: (c, x, z) => (((x - 500) / 4 + (z + 500) / 4) % 2 === 0 ? 0 : 1) });
    expect(s.heightAt(502, -498)).toBe(1); // pusat sel: diagonal 10–01 memberi 1, diagonal 00–11 memberi 0
    expect(s.heightAt(500, -500)).toBe(0); // tepat di simpul
  });

  it('stride 4 hanya membaca simpul LOD1 (kelipatan 16 m dari origin)', () => {
    const seen = new Set();
    const s = createChunkSurface(chunk, {
      stride: 4,
      sample: (c, x, z) => {
        seen.add(`${x - 500},${z + 500}`);
        return 0;
      },
    });
    s.heightAt(520, -480);
    expect([...seen].sort()).toEqual(['16,16', '16,32', '32,16', '32,32']);
  });

  it('di luar chunk di-clamp ke tepi', () => {
    const s = createChunkSurface(chunk, { sample: (c, x) => x });
    expect(s.heightAt(400, -300)).toBe(500);
    expect(s.heightAt(2000, -300)).toBe(1000);
  });
});

describe('drapePolyline', () => {
  it('pita lurus datar: luas = panjang × lebar, y = lift, UV dunia, menghadap atas, sisi ≤ 2 m', () => {
    const g = drapePolyline([[0, 0], [100, 0]], 10, plane(), { lift: 0.03 });
    const t = tris(g);
    expect(sum(t, areaXZ)).toBeCloseTo(1000, 2);
    for (const tri of t) {
      expect(upY(tri)).toBeGreaterThan(0);
      for (const v of tri) expect(v[1]).toBeCloseTo(0.03, 6);
      const e = edges(tri);
      expect(e.filter((x) => x <= DRAPE.segment + 1e-5).length).toBeGreaterThanOrEqual(2);
      for (const x of e) expect(x).toBeLessThanOrEqual(DRAPE.segment * Math.SQRT2 + 1e-5);
    }
    const uv = g.getAttribute('uv');
    const pos = g.getAttribute('position');
    for (let i = 0; i < uv.count; i += 1) {
      expect(uv.getX(i)).toBeCloseTo(pos.getX(i), 6);
      expect(uv.getY(i)).toBeCloseTo(pos.getZ(i), 6);
    }
  });

  it('lereng 6 %: y = 0,06·x + lift di setiap simpul', () => {
    const pos = drapePolyline([[0, 0], [30, 17]], 6, plane(0.06), { lift: 0.05 }).getAttribute('position');
    for (let i = 0; i < pos.count; i += 1) expect(pos.getY(i)).toBeCloseTo(0.06 * pos.getX(i) + 0.05, 5);
  });

  it('clipRect: hanya bagian di dalam persegi chunk', () => {
    const t = tris(drapePolyline([[-50, 0], [50, 0]], 10, plane(), { clipRect: { minX: 0, minZ: -250, maxX: 500, maxZ: 250 } }));
    expect(sum(t, areaXZ)).toBeCloseTo(500, 2);
    for (const tri of t) for (const v of tri) expect(v[0]).toBeGreaterThanOrEqual(-1e-6);
  });

  it('bundaran tertutup: simpul berhingga, sudut luar dimiter', () => {
    const g = drapePolyline([[0, 0], [40, 0], [40, 40], [0, 40], [0, 0]], 4, plane());
    g.computeBoundingBox();
    expect(g.boundingBox.min.x).toBeCloseTo(-2, 5);
    expect(g.boundingBox.max.z).toBeCloseTo(42, 5);
    expect([...g.getAttribute('position').array].every(Number.isFinite)).toBe(true);
  });

  it('masukan tak valid → geometri kosong', () => {
    expect(drapePolyline([[0, 0]], 4, plane()).getAttribute('position')).toBeUndefined();
    expect(drapePolyline([[0, 0], [10, 0]], 0, plane()).getAttribute('position')).toBeUndefined();
  });
});

describe('drapePolygon', () => {
  it('persegi 10×10 tak sejajar kisi: luas 100, semua tepi ≤ maxEdge, y = lift, menghadap atas', () => {
    const t = tris(drapePolygon([sq(3.3, 7.1, 13.3, 17.1)], plane(), { lift: 0.04 }));
    expect(sum(t, areaXZ)).toBeCloseTo(100, 2);
    for (const tri of t) {
      expect(upY(tri)).toBeGreaterThan(0);
      for (const e of edges(tri)) expect(e).toBeLessThanOrEqual(DRAPE.maxEdge + 1e-5);
      for (const v of tri) expect(v[1]).toBeCloseTo(0.04, 6);
    }
  });

  it('lubang dihormati: luas 100 − 16', () => {
    const t = tris(drapePolygon([sq(3.3, 7.1, 13.3, 17.1), sq(5, 9, 9, 13)], plane()));
    expect(sum(t, areaXZ)).toBeCloseTo(84, 2);
  });

  it('lereng: y mengikuti bidang', () => {
    const pos = drapePolygon([sq(0, 0, 8, 8)], plane(0.1, -0.2, 1), { lift: 0 }).getAttribute('position');
    for (let i = 0; i < pos.count; i += 1) expect(pos.getY(i)).toBeCloseTo(0.1 * pos.getX(i) - 0.2 * pos.getZ(i) + 1, 5);
  });

  it('clipRect memotong ke persegi chunk', () => {
    const t = tris(drapePolygon([sq(-5, 0, 5, 10)], plane(), { clipRect: { minX: 0, minZ: 0, maxX: 500, maxZ: 500 } }));
    expect(sum(t, areaXZ)).toBeCloseTo(50, 2);
  });
});
