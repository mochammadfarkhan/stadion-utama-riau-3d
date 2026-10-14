import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { createGrass } from '../src/world/Grass.js';

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
});
