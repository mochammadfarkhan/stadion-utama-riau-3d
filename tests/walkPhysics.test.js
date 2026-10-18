import { describe, it, expect } from 'vitest';
import { WALK, createWalkState, stepWalk, walkSpeedOf, desiredVelocity } from '../src/sim/walkPhysics.js';
import { deepFreeze } from './helpers.js';

const run = (state, input, seconds, collider = null, dt = 1 / 60) => {
  let s = state;
  for (let t = 0; t < seconds - 1e-9; t += dt) s = stepWalk(s, input, dt, collider);
  return s;
};
const fwd = (over = {}) => ({ forward: 1, strafe: 0, run: false, yaw: 0, ...over });

describe('createWalkState', () => {
  it('beku, kecepatan 0, NaN → 0, yaw dinormalkan', () => {
    const s = createWalkState({ x: 1, z: Number.NaN, yaw: 3 * Math.PI });
    expect(Object.isFrozen(s)).toBe(true);
    expect(s).toMatchObject({ x: 1, z: 0, vx: 0, vz: 0 });
    expect(Math.abs(s.yaw)).toBeCloseTo(Math.PI, 9);
  });
});

describe('stepWalk', () => {
  it('akselerasi dibatasi 8 m/s²; jalan maks 1,35 m/s', () => {
    const a = stepWalk(createWalkState(), fwd(), 0.05);
    expect(walkSpeedOf(a)).toBeCloseTo(0.4, 6);
    const b = run(createWalkState(), fwd(), 1);
    expect(walkSpeedOf(b)).toBeCloseTo(WALK.walkSpeed, 6);
  });

  it('Shift: lari 3,2 m/s dan tidak lebih', () => {
    const s = run(createWalkState(), fwd({ run: true }), 2);
    expect(walkSpeedOf(s)).toBeCloseTo(WALK.runSpeed, 6);
  });

  it('diagonal dinormalkan (tidak lebih cepat)', () => {
    const s = run(createWalkState(), fwd({ strafe: 1 }), 1);
    expect(walkSpeedOf(s)).toBeCloseTo(WALK.walkSpeed, 6);
  });

  it('arah: yaw 0 → +z; yaw π/2 → +x; geser kanan di yaw 0 → −x', () => {
    expect(run(createWalkState(), fwd(), 1).z).toBeGreaterThan(0.5);
    expect(run(createWalkState(), fwd({ yaw: Math.PI / 2 }), 1).x).toBeGreaterThan(0.5);
    expect(run(createWalkState(), { forward: 0, strafe: 1, yaw: 0 }, 1).x).toBeLessThan(-0.5);
  });

  it('tanpa masukan melambat sampai berhenti (≤ 0,2 s dari kecepatan jalan)', () => {
    const moving = run(createWalkState(), fwd(), 1);
    const stopped = run(moving, { forward: 0, strafe: 0, yaw: 0 }, 0.2);
    expect(walkSpeedOf(stopped)).toBe(0);
  });

  it('dinding: tidak pernah menembus; diagonal ke dinding menggeser sepanjang dinding', () => {
    const wall = { isWalkable: (x) => x < 1 };
    const s = run(createWalkState(), fwd({ yaw: Math.PI / 2, run: true }), 3, wall);
    expect(s.x).toBeLessThan(1);
    const slide = run(createWalkState(), fwd({ yaw: Math.PI / 4 }), 3, wall);
    expect(slide.x).toBeLessThan(1);
    expect(slide.z).toBeGreaterThan(1.5);
  });

  it('dinding tipis 6 cm (> sub-langkah 5 cm) tidak tertembus walau lari dengan dt besar', () => {
    const thin = { isWalkable: (x) => !(x > 0.5 && x < 0.56) };
    const s = run(createWalkState(), fwd({ yaw: Math.PI / 2, run: true }), 2, thin, 0.1);
    expect(s.x).toBeLessThan(0.5);
  });

  it('dt tidak valid tidak menggerakkan; dt besar dibatasi', () => {
    const s0 = createWalkState();
    expect(stepWalk(s0, fwd(), Number.NaN)).toMatchObject({ x: 0, z: 0, vx: 0, vz: 0 });
    expect(stepWalk(s0, fwd(), -1)).toMatchObject({ x: 0, z: 0 });
    const big = stepWalk(s0, fwd(), 5);
    expect(walkSpeedOf(big)).toBeCloseTo(WALK.accel * WALK.maxDt, 6);
  });

  it('terjebak di dalam penghalang: boleh bergerak keluar', () => {
    const solid = { isWalkable: (x, z) => !(Math.abs(x) < 0.3 && Math.abs(z) < 0.3) };
    const s = run(createWalkState(), fwd(), 1, solid);
    expect(s.z).toBeGreaterThan(0.3);
  });

  it('immutabel: state & input beku tidak berubah; yaw tanpa masukan dipertahankan', () => {
    const s0 = deepFreeze(createWalkState({ yaw: 1 }));
    const input = deepFreeze({ forward: 1 });
    const s1 = stepWalk(s0, input, 0.1);
    expect(s1).not.toBe(s0);
    expect(s1.yaw).toBe(1);
  });

  it('state rusak dipulihkan ke state valid', () => {
    const s = stepWalk({ x: Number.NaN, z: 0, yaw: 0, vx: 0, vz: 0 }, fwd(), 0.1);
    expect(Number.isFinite(s.x)).toBe(true);
  });
});

describe('desiredVelocity', () => {
  it('stick analog setengah → setengah kecepatan', () => {
    const v = desiredVelocity({ forward: 0.5, strafe: 0 }, 0);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(WALK.walkSpeed / 2, 9);
  });
});
