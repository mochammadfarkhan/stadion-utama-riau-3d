import { describe, it, expect } from 'vitest';
import { createLane, pointAt, trafficDensity, selectLanes, carsOnLane, lampSpots, LIFE } from '../../src/city/farLife.js';

const out = () => ({ x: 0, z: 0, ux: 0, uz: 0 });

describe('lajur & posisi', () => {
  const lane = createLane(1, 2, [[0, 0], [100, 0], [100, 50]]);
  it('panjang kumulatif; terlalu pendek → null', () => {
    expect(lane.len).toBe(150);
    expect(createLane(2, 2, [[0, 0], [10, 0]])).toBeNull();
    expect(createLane(3, 2, [[0, 0]])).toBeNull();
  });
  it('pointAt: interpolasi, arah satuan, dijepit di ujung', () => {
    const p = pointAt(lane, 50, out());
    expect([p.x, p.z, p.ux, p.uz]).toEqual([50, 0, 1, 0]);
    const q = pointAt(lane, 125, out());
    expect([q.x, q.z, q.ux, q.uz]).toEqual([100, 25, 0, 1]);
    expect(pointAt(lane, -5, out()).x).toBe(0);
    expect(pointAt(lane, 9999, out()).z).toBe(50);
  });
});

describe('kepadatan & pemilihan', () => {
  it('padat di jam sibuk, jarang malam, 0..1 dan melingkar 24 jam', () => {
    expect(trafficDensity(8)).toBeGreaterThan(0.95);
    expect(trafficDensity(17.3)).toBeGreaterThan(0.95);
    expect(trafficDensity(13)).toBeGreaterThan(0.6);
    expect(trafficDensity(13)).toBeLessThan(0.85);
    expect(trafficDensity(3)).toBeLessThan(0.3);
    expect(trafficDensity(-1)).toBeCloseTo(trafficDensity(23), 10);
    for (let h = 0; h < 24; h += 0.5) { const d = trafficDensity(h); expect(d).toBeGreaterThanOrEqual(0); expect(d).toBeLessThanOrEqual(1); }
  });
  it('selectLanes memilih hanya lajur dalam radius; carsOnLane dibatasi', () => {
    const a = createLane(1, 1, [[0, 0], [500, 0]]);
    const b = createLane(2, 1, [[5000, 0], [5500, 0]]);
    expect(selectLanes([a, b], 100, 100, 300)).toEqual([a]);
    expect(selectLanes([a, b], 5200, 0, 100)).toEqual([b]);
    expect(carsOnLane(a)).toBe(Math.floor(500 / 60));
    expect(carsOnLane(createLane(9, 1, [[0, 0], [1e6, 0]]))).toBe(LIFE.maxCarsPerLane);
  });
});

describe('lampu jalan', () => {
  it('tiap ±45 m bergantian kiri/kanan sejauh lebar/2+1,5 dari sumbu', () => {
    const lane = createLane(4, 2, [[0, 0], [450, 0]]);
    const spots = lampSpots(lane, 6);
    expect(spots.length).toBeGreaterThanOrEqual(9);
    expect(spots.length).toBeLessThanOrEqual(11);
    spots.forEach((s, i) => {
      expect(Math.abs(s.z)).toBeCloseTo(7.5, 6);
      if (i > 0) expect(Math.sign(s.z)).toBe(-Math.sign(spots[i - 1].z));
    });
  });
});

describe('lampu mobil', () => {
  it('carLightsGeometry: 4 kotak (2 depan terang, 2 belakang merah), warna per titik', async () => {
    const { carLightsGeometry } = await import('../../src/city/farLife.js');
    const g = carLightsGeometry();
    expect(g.attributes.position.count).toBe(4 * 36);
    const col = g.attributes.color;
    const pos = g.attributes.position;
    let front = 0; let rear = 0;
    for (let i = 0; i < pos.count; i += 1) {
      if (pos.getZ(i) > 0) { front += 1; expect(col.getY(i)).toBeGreaterThan(0.8); } else { rear += 1; expect(col.getY(i)).toBeLessThan(0.3); }
    }
    expect(front).toBe(rear);
  });
});
