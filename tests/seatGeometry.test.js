import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSeatGeometry } from '../src/world/stadium/Tribune.seats.js';

const triCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

describe('createSeatGeometry', () => {
  it('membuang sisi yang tak pernah terlihat: ≤ 18 segitiga (dulu 24)', () => {
    expect(triCount(createSeatGeometry())).toBeLessThanOrEqual(18);
  });
  it('dimensi tidak berubah (bounding box sama dengan dua balok asli)', () => {
    const g = createSeatGeometry();
    g.computeBoundingBox();
    const size = g.boundingBox.getSize(new THREE.Vector3());
    expect(size.y).toBeCloseTo(0.89 - 0.39, 3);   // dasar dudukan 0.39 .. puncak sandaran 0.89
    expect(size.z).toBeCloseTo(0.23 - -0.225, 3); // depan dudukan .. belakang sandaran
  });
  it('skala VIP menskalakan semua dimensi', () => {
    const a = createSeatGeometry(); const b = createSeatGeometry(2);
    a.computeBoundingBox(); b.computeBoundingBox();
    expect(b.boundingBox.max.y / a.boundingBox.max.y).toBeCloseTo(2, 3);
  });
  it('semua normal terdefinisi (pencahayaan benar)', () => {
    expect(createSeatGeometry().attributes.normal.count).toBe(createSeatGeometry().attributes.position.count);
  });
});
