import { describe, it, expect } from 'vitest';
import { laneRadius, laneLength, createLanePath, pointOnLane } from '../src/sim/trackPath.js';
import { TRACK } from '../src/config/constants.js';

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

describe('laneRadius / laneLength', () => {
  it('radius bertambah 1.22 per lane', () => {
    for (let lane = 1; lane < TRACK.laneCount; lane += 1) {
      expect(laneRadius(lane + 1) - laneRadius(lane)).toBeCloseTo(TRACK.laneWidth, 6);
    }
  });
  it('L(1) ≈ 400.00 dan L(8) ≈ 453.66 (toleransi 0.2)', () => {
    expect(Math.abs(laneLength(1) - 400.0)).toBeLessThan(0.2);
    expect(Math.abs(laneLength(8) - 453.66)).toBeLessThan(0.2);
  });
});

describe('createLanePath', () => {
  it('CurvePath tertutup dengan panjang ≈ laneLength', () => {
    const path = createLanePath(1);
    expect(path.curves.length).toBeGreaterThan(0);
    expect(Math.abs(path.getLength() - laneLength(1))).toBeLessThan(0.2);
    const s = path.getPoint(0);
    const e = path.getPoint(1);
    expect(s.distanceTo(e)).toBeLessThan(1e-6);
  });
});

describe('pointOnLane', () => {
  it('dist=0 dan dist=L/2 simetris terhadap origin', () => {
    const L = laneLength(1);
    const p0 = pointOnLane(1, 0);
    const ph = pointOnLane(1, L / 2);
    expect(p0.x).toBeCloseTo(-ph.x, 3);
    expect(p0.z).toBeCloseTo(-ph.z, 3);
    expect(Math.abs(p0.x)).toBeCloseTo(laneRadius(1), 3);
  });
  it('lurus sejajar Z: titik pada lurus memiliki |x| = radius', () => {
    const p = pointOnLane(1, 20);
    expect(Math.abs(p.x)).toBeCloseTo(laneRadius(1), 3);
    expect(Math.abs(p.z)).toBeLessThan(TRACK.straightLength / 2 + 1e-6);
  });
  it('arah lari berlawanan jarum jam dilihat dari atas (+Y)', () => {
    // di x>0 lari ke -Z; di x<0 lari ke +Z
    const p0 = pointOnLane(1, 0);
    const p1 = pointOnLane(1, 1);
    expect(p0.x).toBeGreaterThan(0);
    expect(p1.z).toBeLessThan(p0.z);
    const L = laneLength(1);
    const q0 = pointOnLane(1, L / 2);
    const q1 = pointOnLane(1, L / 2 + 1);
    expect(q0.x).toBeLessThan(0);
    expect(q1.z).toBeGreaterThan(q0.z);
  });
  it('yaw = atan2(tx,tz) dan kontinu sepanjang lintasan', () => {
    const L = laneLength(3);
    const n = 600;
    let prev = pointOnLane(3, 0).yaw;
    expect(Math.abs(wrapAngle(prev - Math.PI))).toBeLessThan(1e-3); // menghadap -Z di dist 0
    for (let i = 1; i <= n; i += 1) {
      const { yaw } = pointOnLane(3, (L * i) / n);
      expect(Math.abs(wrapAngle(yaw - prev))).toBeLessThan(0.1);
      prev = yaw;
    }
  });
  it('dist negatif / lebih dari L di-wrap', () => {
    const L = laneLength(2);
    const a = pointOnLane(2, -5);
    const b = pointOnLane(2, L - 5);
    expect(a.x).toBeCloseTo(b.x, 4);
    expect(a.z).toBeCloseTo(b.z, 4);
  });
});
