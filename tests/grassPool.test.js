import { describe, it, expect } from 'vitest';
import { Group, Vector3 } from 'three';
import { createGrass } from '../src/world/Grass.js';
import { applyPlacement } from '../src/app/mountRegion.js';
import { createRegionFrame } from '../src/geo/regionTransform.js';
import { GRASS } from '../src/config/constants.js';

/** Posisi lokal (x, z) semua instance aktif (skala > 0). */
function activePositions(mesh) {
  const out = [];
  const a = mesh.instanceMatrix.array;
  for (let i = 0; i < mesh.count; i += 1) {
    const o = i * 16;
    if (Math.hypot(a[o], a[o + 1], a[o + 2]) < 1e-4) continue;
    out.push({ x: a[o + 12], z: a[o + 14] });
  }
  return out;
}

/** Hitung instance aktif (skala > 0) di sisi x positif & negatif fokus. */
function countSides(mesh) {
  let pos = 0;
  let neg = 0;
  const a = mesh.instanceMatrix.array;
  for (let i = 0; i < mesh.count; i += 1) {
    const o = i * 16;
    if (Math.hypot(a[o], a[o + 1], a[o + 2]) < 1e-4) continue;
    if (a[o + 12] > 0) pos += 1;
    else neg += 1;
  }
  return { pos, neg };
}

describe('pool rumput', () => {
  it('tetap simetris di sekitar x=0 setelah fokus berpindah (regresi overflow kunci sel)', () => {
    const g = createGrass();
    const mesh = g.children[0];
    g.userData.update(0.016, 0, new Vector3(0, 0, -275));
    g.userData.update(0.016, 0, new Vector3(0, 0, -255));
    const { pos, neg } = countSides(mesh);
    expect(pos + neg).toBeGreaterThan(2000);
    expect(Math.abs(pos - neg) / (pos + neg)).toBeLessThan(0.1);
  });
  it('berpindah jauh lalu kembali menghasilkan jumlah yang sama (deterministik)', () => {
    const g = createGrass();
    const mesh = g.children[0];
    g.userData.update(0.016, 0, new Vector3(40, 0, -255));
    const first = countSides(mesh);
    g.userData.update(0.016, 0, new Vector3(-300, 0, 300));
    g.userData.update(0.016, 0, new Vector3(40, 0, -255));
    expect(countSides(mesh)).toEqual(first);
  });

  it('placement non-identitas: sel dibangun di sekitar focus LOKAL; uFocus (fade) tetap dunia', () => {
    const frame = createRegionFrame({ x: 100, z: -50, yaw: 0.3 });
    const region = applyPlacement(new Group(), frame.placement);
    const g = createGrass();
    region.add(g);
    region.updateMatrixWorld(true);
    const mesh = g.children[0];
    const local = { x: 40, z: -255 };
    const w = frame.toWorld(local.x, local.z);
    g.userData.update(0.016, 0, new Vector3(w.x, 0, w.z));
    const pts = activePositions(mesh);
    expect(pts.length).toBeGreaterThan(2000);
    // Sel dipilih bila pusatnya ≤ radius + ½ sel dari sel fokus; bilah & fokus bebas di dalam selnya.
    const reach = GRASS.radius + GRASS.cellSize * (0.5 + 2 * Math.SQRT2);
    for (const p of pts) expect(Math.hypot(p.x - local.x, p.z - local.z)).toBeLessThan(reach);
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
    expect(Math.hypot(cx - local.x, cz - local.z)).toBeLessThan(15); // titik dunia berjarak ±55 m
    const u = mesh.material.uniforms.uFocus.value;
    expect([u.x, u.z]).toEqual([w.x, w.z]);
  });
});
