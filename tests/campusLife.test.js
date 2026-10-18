import { describe, it, expect } from 'vitest';
import {
  studentDensity, motorFill, toPoints, pathsFromGround, measurePath, pointAt, chopPath, bucketPaths, cellCenter,
  targetCount, allocateStudents, createWalker, stepWalker, walkerPose, benchSpotsFromPaths, seatsOf, sitterCount,
  mulberry32, hashString, CELL_SIZE,
} from '../src/sim/campusLife.js';

describe('studentDensity (spec §8.4: 07–17 ramai, 17–21 sedang, malam sepi)', () => {
  it('nilai pita dan transisi 0,5 jam', () => {
    expect(studentDensity(12)).toBe(1);
    expect(studentDensity(19)).toBe(0.45);
    expect(studentDensity(23)).toBe(0.05);
    expect(studentDensity(2)).toBe(0.05);
    expect(studentDensity(6)).toBe(0.25);
    expect(studentDensity(7)).toBe(0.25);
    expect(studentDensity(7.25)).toBeCloseTo(0.625, 6);
    expect(studentDensity(17.25)).toBeCloseTo(0.725, 6);
    expect(studentDensity(21.25)).toBeCloseTo(0.25, 6);
  });
  it('jam dibungkus 24 jam; tak hingga = malam', () => {
    expect(studentDensity(24)).toBe(0.05);
    expect(studentDensity(-1)).toBe(0.05);
    expect(studentDensity(36)).toBe(1);
    expect(studentDensity(Number.NaN)).toBe(0.05);
  });
  it('ramai > sedang > sepi', () => {
    expect(studentDensity(10)).toBeGreaterThan(studentDensity(19));
    expect(studentDensity(19)).toBeGreaterThan(studentDensity(23));
  });
});

describe('motorFill', () => {
  it('parkir IC penuh siang; area lain lebih longgar; malam sepi', () => {
    expect(motorFill(12, 'ic')).toBeCloseTo(0.97, 6);
    expect(motorFill(12, 'kampus')).toBeCloseTo(0.65, 6);
    expect(motorFill(2, 'ic')).toBeCloseTo(0.1625, 6);
    expect(motorFill(2, 'kampus')).toBeCloseTo(0.08, 6);
    expect(motorFill(12, 'tidak-dikenal')).toBeCloseTo(motorFill(12, 'kampus'), 6);
  });
});

describe('jalur dari data ground M2', () => {
  const ground = {
    walks: [{ w: 2, pts: [[0, 0], [0, 40]] }, { w: 2, pts: [[5, 5], [5, 9]] }],
    roads: [
      { cls: 'service', w: 4, pts: [[100, 0], [100, 60]] },
      { cls: 'primary', w: 12, pts: [[200, 0], [200, 80]] },
    ],
  };
  it('walks + kedua bahu jalan kampus (offset lebar/2 + 0,9 m); jalan utama & jalur < 8 m dibuang', () => {
    const paths = pathsFromGround(ground);
    expect(paths.filter((p) => p.kind === 'walk').map((p) => p.length)).toEqual([40]);
    const bahu = paths.filter((p) => p.kind === 'bahu');
    expect(bahu.map((p) => p.length)).toEqual([60, 60]);
    expect(bahu.map((p) => p.pts[0][0]).sort((a, b) => a - b)).toEqual([97.1, 102.9]);
  });
  it('titik datar dan skala desimeter', () => {
    expect(toPoints([0, 0, 0, 40])).toEqual([[0, 0], [0, 40]]);
    expect(toPoints([[0, 0], [0, 400]], 0.1)).toEqual([[0, 0], [0, 40]]);
    expect(toPoints([[0, Number.NaN], [1, 1]])).toEqual([[1, 1]]);
    expect(pathsFromGround(null)).toEqual([]);
  });
  it('pointAt: posisi & yaw (maju = (sin, cos)), dijepit di ujung', () => {
    const p = measurePath([[0, 0], [0, 10], [10, 10]], 'walk');
    expect(pointAt(p, 5)).toEqual({ x: 0, z: 5, yaw: 0 });
    const q = pointAt(p, 15);
    expect(q.x).toBeCloseTo(5, 9);
    expect(q.z).toBeCloseTo(10, 9);
    expect(q.yaw).toBeCloseTo(Math.PI / 2, 9);
    expect(pointAt(p, 99).x).toBeCloseTo(10, 9);
  });
  it('chopPath memotong jalur panjang menjadi potongan bersambung ≤ maxLen', () => {
    const p = measurePath([[0, 0], [0, 300]], 'walk');
    const pieces = chopPath(p, 120);
    expect(pieces).toHaveLength(3);
    pieces.forEach((q) => expect(q.length).toBeCloseTo(100, 6));
    expect(pieces[1].pts[0]).toEqual(pieces[0].pts[pieces[0].pts.length - 1]);
  });
  it('bucketPaths per sel 250 m menurut titik tengah potongan', () => {
    const p = measurePath([[0, 0], [0, 600]], 'walk');
    const cells = bucketPaths([p]);
    expect([...cells.keys()].sort()).toEqual(['0_0', '0_1', '0_2']);
    expect(cells.get('0_0')).toHaveLength(2);
    expect(cells.get('0_1')).toHaveLength(2);
    expect(cells.get('0_2')).toHaveLength(1);
    expect(cellCenter('0_1')).toEqual({ x: CELL_SIZE / 2, z: CELL_SIZE * 1.5 });
    expect(cellCenter('-1_2')).toEqual({ x: -CELL_SIZE / 2, z: CELL_SIZE * 2.5 });
  });
});

describe('kepadatan per sel & kolam', () => {
  it('targetCount: kapasitas sel × kepadatan', () => {
    expect(targetCount(600, 1)).toBe(10);
    expect(targetCount(600, 0.45)).toBe(5);
    expect(targetCount(600, 0.05)).toBe(1);
    expect(targetCount(56, 1)).toBe(2);
    expect(targetCount(0, 1)).toBe(0);
    expect(targetCount(100, 0)).toBe(0);
  });
  it('allocateStudents: sel terdekat dulu sampai kolam habis', () => {
    const plan = allocateStudents([
      { key: 'a', want: 6, dist: 100 }, { key: 'b', want: 6, dist: 50 }, { key: 'c', want: 6, dist: 300 },
    ], 10);
    expect(Object.fromEntries(plan)).toEqual({ b: 6, a: 4, c: 0 });
  });
});

describe('pejalan', () => {
  const path = measurePath([[0, 0], [0, 10]], 'walk');
  it('maju, berhenti di ujung lalu berbalik; input tidak dimutasi', () => {
    const w0 = Object.freeze({ s: 9, dir: 1, speed: 1.35, lateral: 0, pause: 0, phase: 0, mode: 'walk' });
    const w1 = stepWalker(w0, path, 1, () => 0);
    expect(w1).toMatchObject({ s: 10, dir: -1, pause: 1.5 });
    const w2 = stepWalker(w1, path, 1, () => 0);
    expect(w2).toMatchObject({ s: 10, pause: 0.5 });
    const w3 = stepWalker(stepWalker(w2, path, 1, () => 0), path, 1, () => 0);
    expect(w3.s).toBeCloseTo(8.65, 9);
    expect(w0.s).toBe(9);
    expect(stepWalker(w0, path, 0, () => 0)).toBe(w0);
    expect(stepWalker(w0, path, Number.NaN, () => 0)).toBe(w0);
  });
  it('createWalker deterministik dari rng; pose = titik jalur + offset lateral, yaw searah gerak', () => {
    expect(createWalker(path, mulberry32(7))).toEqual(createWalker(path, mulberry32(7)));
    expect(walkerPose({ s: 5, dir: 1, lateral: 0.5 }, path)).toEqual({ x: 0.5, z: 5, yaw: 0 });
    expect(walkerPose({ s: 5, dir: -1, lateral: 0 }, path).yaw).toBeCloseTo(Math.PI, 9);
  });
});

describe('bangku diskusi', () => {
  it('tiap 85 m di sisi jalur walk (bukan bahu), dua kursi menghadap jalur', () => {
    const walk = measurePath([[0, 0], [0, 200]], 'walk');
    const bahu = measurePath([[50, 0], [50, 200]], 'bahu');
    const spots = benchSpotsFromPaths([walk, bahu]);
    expect(spots).toHaveLength(2);
    expect(spots[0].z).toBeCloseTo(42.5, 9);
    expect(spots[1].z).toBeCloseTo(127.5, 9);
    expect(spots[0].x).toBeCloseTo(2.4, 9);
    expect(spots[0].rotY).toBeCloseTo(-Math.PI / 2, 9);
    const seats = seatsOf(spots.slice(0, 1));
    expect(seats).toHaveLength(2);
    expect(seats[0].z).toBeCloseTo(42.05, 9);
    expect(seats[1].z).toBeCloseTo(42.95, 9);
    seats.forEach((s) => {
      expect(s.x).toBeCloseTo(2.4, 9);
      expect(s.yaw).toBeCloseTo(-Math.PI / 2, 9);
    });
  });
  it('sitterCount ±25% dibatasi jumlah kursi', () => {
    expect(sitterCount(10, 4)).toBe(3);
    expect(sitterCount(10, 2)).toBe(2);
    expect(sitterCount(10, 0)).toBe(0);
  });
});

describe('rng & hash', () => {
  it('mulberry32 deterministik di [0,1); hashString stabil', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    xs.forEach((x) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); });
    expect(hashString('0_4')).toBe(hashString('0_4'));
    expect(hashString('0_4')).not.toBe(hashString('4_0'));
  });
});
