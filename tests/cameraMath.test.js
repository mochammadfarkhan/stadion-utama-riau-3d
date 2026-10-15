import { describe, it, expect } from 'vitest';
import {
  THIRD, wrapAngle, thirdPersonOffset, pullInOffset, sweepOffset, decayLook, shouldSnap, firstPersonDirection,
} from '../src/core/cameraMath.js';

const len = (o) => Math.hypot(o.x, o.y, o.z);

describe('wrapAngle', () => {
  it('menormalkan ke (-π, π]', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 6);
    expect(wrapAngle(-3 * Math.PI + 0.1)).toBeCloseTo(-Math.PI + 0.1, 6);
    expect(wrapAngle(Number.NaN)).toBe(0);
  });
});

describe('thirdPersonOffset', () => {
  it('yaw 0, pitch 0: tepat di belakang (−z) setinggi pandangan semula (2,4 m di atas tanah)', () => {
    const o = thirdPersonOffset(0, 0);
    expect(o.x).toBeCloseTo(0, 6);
    expect(o.z).toBeLessThan(0);
    expect(THIRD.lookHeight + o.y).toBeCloseTo(2.4, 1);
  });
  it('yaw memutar kamera mengitari target: yaw 90° → kamera di sisi −x', () => {
    const o = thirdPersonOffset(Math.PI / 2, 0);
    expect(o.x).toBeLessThan(-5);
    expect(Math.abs(o.z)).toBeLessThan(1e-6);
  });
  it('jarak ke target selalu sama (radius orbit) untuk semua pitch', () => {
    for (const p of [-1.3, -0.5, 0, 0.5, 1.3]) expect(len(thirdPersonOffset(0.7, p))).toBeCloseTo(THIRD.radius, 6);
  });
  it('REGRESI: melihat ke atas tidak membawa kamera ke bawah tanah', () => {
    for (const p of [-0.4, -1.0, -1.31, -3]) expect(THIRD.lookHeight + thirdPersonOffset(0, p).y).toBeGreaterThanOrEqual(THIRD.minHeight - 1e-9);
  });
  it('melihat ke bawah dibatasi (tidak tepat di atas kepala)', () => {
    const o = thirdPersonOffset(0, 3);
    expect(o.y / len(o)).toBeLessThanOrEqual(Math.sin(THIRD.maxElevation) + 1e-9);
  });
  it('pitch positif (mouse turun) menaikkan kamera, negatif menurunkan', () => {
    expect(thirdPersonOffset(0, 0.4).y).toBeGreaterThan(thirdPersonOffset(0, 0).y);
    expect(thirdPersonOffset(0, -0.1).y).toBeLessThan(thirdPersonOffset(0, 0).y);
  });
  it('input rusak tetap menghasilkan angka hingga', () => {
    const o = thirdPersonOffset(Number.NaN, Number.POSITIVE_INFINITY);
    expect([o.x, o.y, o.z].every(Number.isFinite)).toBe(true);
  });
});

describe('pullInOffset', () => {
  const offset = { x: 0, y: 1.1, z: -6.4 };
  const target = { x: 0, y: 1.3, z: 0 };
  it('bila posisi kamera bebas: tidak diubah (skala 1)', () => {
    const r = pullInOffset(target, offset, () => true);
    expect(r.scale).toBe(1);
    expect(r.z).toBe(offset.z);
  });
  it('dinding di belakang: kamera ditarik ke depan dinding (skala < 1, bebas)', () => {
    const wallZ = -3; // z < −3 terblokir
    const r = pullInOffset(target, offset, (x, z) => z > wallZ);
    expect(r.scale).toBeLessThan(1);
    expect(target.z + r.z).toBeGreaterThan(wallZ);
    expect(target.z + r.z).toBeLessThan(wallZ + 0.5); // sedekat mungkin ke dinding, bukan terlalu dekat ke rider
  });
  it('tidak pernah lebih dekat dari minScale (kamera tidak masuk ke kepala rider)', () => {
    const r = pullInOffset(target, offset, () => false, 0.25);
    expect(r.scale).toBeCloseTo(0.25, 6);
  });
  it('elevasi dipertahankan saat ditarik (skala seragam)', () => {
    const r = pullInOffset(target, offset, (x, z) => z > -2);
    expect(r.y / r.z).toBeCloseTo(offset.y / offset.z, 6);
  });
});

describe('decayLook', () => {
  it('tidak meluruh saat masih aktif digerakkan (idle < jeda)', () => {
    expect(decayLook(1, 0.016, 0.3)).toBe(1);
  });
  it('meluruh ke 0 setelah diam melewati jeda, tanpa melewati 0 dan menjaga tanda', () => {
    let v = 1;
    for (let i = 0; i < 400; i += 1) { const n = decayLook(v, 0.05, 5); expect(n).toBeLessThanOrEqual(v); v = n; }
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(0.01);
    expect(decayLook(-1, 0.05, 5)).toBeGreaterThan(-1);
  });
  it('dt besar tidak membalik tanda', () => {
    expect(decayLook(0.5, 100, 5)).toBeGreaterThanOrEqual(0);
  });
});

describe('shouldSnap', () => {
  it('true bila kamera terlalu jauh dari pose ideal (teleport/respawn), false bila dekat', () => {
    expect(shouldSnap(30, 0, 0)).toBe(true);
    expect(shouldSnap(3, 1, 2)).toBe(false);
    expect(shouldSnap(Number.NaN, 0, 0)).toBe(true);
  });
});

describe('firstPersonDirection', () => {
  it('yaw 0, pitch 0 menghadap +z; pitch positif melihat ke bawah', () => {
    const d = firstPersonDirection(0, 0);
    expect(d.z).toBeCloseTo(1, 6);
    expect(firstPersonDirection(0, 0.5).y).toBeLessThan(0);
    expect(firstPersonDirection(0, -0.5).y).toBeGreaterThan(0);
  });
  it('vektor satuan dan hingga untuk input rusak', () => {
    const d = firstPersonDirection(Number.NaN, 0.3);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 6);
  });
});

describe('sweepOffset', () => {
  const target = { x: 0, y: 1.3, z: 0 };
  it('bila posisi default bebas: dipakai apa adanya (tanpa berputar)', () => {
    const r = sweepOffset(target, 0, 0, () => true);
    expect(r.swept).toBe(0);
    expect(r.z).toBeLessThan(0);
  });
  it('dinding di belakang: kamera berputar ke sudut bebas terdekat pada radius penuh', () => {
    const r = sweepOffset(target, 0, 0, (x, z) => z > -3);
    expect(r).not.toBeNull();
    expect(Math.abs(r.swept)).toBeGreaterThan(0);
    expect(target.z + r.z).toBeGreaterThan(-3);
    expect(Math.hypot(r.x, r.y, r.z)).toBeCloseTo(THIRD.radius, 6);
  });
  it('memilih putaran terkecil (±15° sebelum ±30°, dst.)', () => {
    // hanya sisi kanan (x > 3) yang bebas
    const r = sweepOffset(target, 0, 0, (x) => x > 3);
    expect(r.swept).not.toBe(0);
    const alt = sweepOffset(target, 0, 0, (x) => x > 5.5);
    expect(Math.abs(alt.swept)).toBeGreaterThanOrEqual(Math.abs(r.swept));
  });
  it('semua sudut terhalang: null (pemanggil memakai pull-in)', () => {
    expect(sweepOffset(target, 0, 0, () => false)).toBeNull();
  });
});
