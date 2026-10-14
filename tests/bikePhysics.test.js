import { describe, it, expect } from 'vitest';
import { createBikeState, stepBike } from '../src/sim/bikePhysics.js';
import { BIKE } from '../src/config/constants.js';
import { deepFreeze, hasNaN } from './helpers.js';

const DT = 1 / 60;
const run = (state, input, seconds) => {
  let s = state;
  for (let i = 0; i < seconds * 60; i += 1) s = stepBike(s, input, DT);
  return s;
};

describe('createBikeState', () => {
  it('default di origin dengan semua field', () => {
    const s = createBikeState();
    expect(s).toMatchObject({ x: 0, z: 0, yaw: 0, v: 0, steer: 0, lean: 0, wheelSpin: 0, pedalAngle: 0 });
  });
  it('menerima posisi awal', () => {
    expect(createBikeState({ x: 3, z: -2, yaw: 1 })).toMatchObject({ x: 3, z: -2, yaw: 1 });
  });
});

describe('stepBike', () => {
  it('BIKE punya wheelBase', () => {
    expect(BIKE.wheelBase).toBeCloseTo(1.05, 6);
  });
  it('inersia: kecepatan naik bertahap saat mengayuh', () => {
    const s1 = stepBike(createBikeState(), { pedal: 1, steer: 0, sprint: false }, DT);
    expect(s1.v).toBeGreaterThan(0);
    expect(s1.v).toBeLessThan(1);
    const s2 = run(createBikeState(), { pedal: 1, steer: 0, sprint: false }, 2);
    expect(s2.v).toBeGreaterThan(s1.v);
  });
  it('batas kecepatan: tidak melewati maxSpeed, sprint sampai sprintSpeed', () => {
    const s = run(createBikeState(), { pedal: 1, steer: 0, sprint: false }, 30);
    expect(s.v).toBeLessThanOrEqual(BIKE.maxSpeed + 1e-6);
    expect(s.v).toBeGreaterThan(BIKE.maxSpeed * 0.8);
    const sp = run(createBikeState(), { pedal: 1, steer: 0, sprint: true }, 30);
    expect(sp.v).toBeLessThanOrEqual(BIKE.sprintSpeed + 1e-6);
    expect(sp.v).toBeGreaterThan(BIKE.maxSpeed);
  });
  it('bergerak maju searah yaw (yaw 0 → +Z)', () => {
    const s = run(createBikeState(), { pedal: 1, steer: 0, sprint: false }, 3);
    expect(s.z).toBeGreaterThan(1);
    expect(Math.abs(s.x)).toBeLessThan(1e-6);
    expect(s.wheelSpin).toBeGreaterThan(0);
    expect(s.pedalAngle).toBeGreaterThan(0);
  });
  it('belok kanan: yaw naik dan lean negatif', () => {
    const moving = run(createBikeState(), { pedal: 1, steer: 0, sprint: false }, 3);
    const turned = run(moving, { pedal: 1, steer: 1, sprint: false }, 1);
    expect(turned.yaw).toBeGreaterThan(moving.yaw);
    expect(turned.lean).toBeLessThan(0);
    expect(Math.abs(turned.lean)).toBeLessThanOrEqual(BIKE.leanMax + 1e-6);
    expect(turned.steer).toBeGreaterThan(0);
  });
  it('rem menghentikan sepeda', () => {
    const moving = run(createBikeState(), { pedal: 1, steer: 0, sprint: false }, 5);
    const stopped = run(moving, { pedal: -1, steer: 0, sprint: false }, 3);
    expect(stopped.v).toBeLessThanOrEqual(0);
    expect(stopped.v).toBeGreaterThanOrEqual(-1.5 - 1e-6);
  });
  it('mundur pelan maksimal 1.5 m/s', () => {
    const s = run(createBikeState(), { pedal: -1, steer: 0, sprint: true }, 10);
    expect(s.v).toBeLessThan(0);
    expect(s.v).toBeGreaterThanOrEqual(-1.5 - 1e-6);
  });
  it('drag memperlambat tanpa input', () => {
    const moving = run(createBikeState(), { pedal: 1, steer: 0, sprint: false }, 5);
    const coasting = run(moving, { pedal: 0, steer: 0, sprint: false }, 5);
    expect(coasting.v).toBeLessThan(moving.v);
    expect(coasting.v).toBeGreaterThanOrEqual(0);
  });
  it('immutability: input tidak diubah, objek baru dikembalikan', () => {
    const s = deepFreeze(createBikeState());
    const input = deepFreeze({ pedal: 1, steer: 0.5, sprint: false });
    const next = stepBike(s, input, DT);
    expect(next).not.toBe(s);
    expect(s.v).toBe(0);
  });
  it('dt NaN / 0 / negatif aman, dt besar di-clamp', () => {
    const s = createBikeState();
    const inp = { pedal: 1, steer: 0, sprint: false };
    expect(hasNaN(stepBike(s, inp, NaN))).toBe(false);
    expect(stepBike(s, inp, 0)).toMatchObject({ v: 0, x: 0, z: 0 });
    expect(hasNaN(stepBike(s, inp, -1))).toBe(false);
    const big = stepBike(s, inp, 10);
    expect(big.v).toBeLessThanOrEqual(BIKE.accel * 0.05 + 1e-6);
  });
  it('input tidak lengkap / NaN tetap aman', () => {
    const s = createBikeState();
    expect(hasNaN(stepBike(s, {}, DT))).toBe(false);
    expect(hasNaN(stepBike(s, { pedal: NaN, steer: undefined }, DT))).toBe(false);
  });
});
