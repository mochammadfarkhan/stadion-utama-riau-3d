import { describe, it, expect } from 'vitest';
import { createBall, stepBall, kickBall } from '../src/sim/ballPhysics.js';
import { PITCH, FOOTBALL } from '../src/config/constants.js';

const R = FOOTBALL.ballRadius;
const finite = (b) => [b.pos.x, b.pos.y, b.pos.z, b.vel.x, b.vel.y, b.vel.z].every(Number.isFinite);
const ball = (pos, vel = { x: 0, y: 0, z: 0 }) => ({ pos: { ...pos }, vel: { ...vel } });

describe('createBall / kickBall', () => {
  it('bola awal diam di titik tengah, tepat di atas tanah', () => {
    const b = createBall();
    expect(b.pos).toEqual({ x: 0, y: R, z: 0 });
    expect(b.vel).toEqual({ x: 0, y: 0, z: 0 });
  });
  it('tendangan: kecepatan horizontal = speed searah, ada sedikit angkat, posisi tetap, masukan tidak berubah', () => {
    const b = Object.freeze(createBall());
    const k = kickBall(b, 3, 4, 10);
    expect(Math.hypot(k.vel.x, k.vel.z)).toBeCloseTo(10, 6);
    expect(k.vel.x / k.vel.z).toBeCloseTo(0.75, 6);
    expect(k.vel.y).toBeCloseTo(10 * FOOTBALL.kickLift, 6);
    expect(k.pos).toEqual(b.pos);
  });
  it('arah nol tidak menghasilkan NaN (bola tak berubah)', () => {
    const k = kickBall(createBall(), 0, 0, 10);
    expect(finite(k)).toBe(true);
    expect(k.vel).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('stepBall', () => {
  it('jatuh bebas: gravitasi menurunkan, tidak pernah menembus tanah, memantul lebih rendah dari tinggi awal', () => {
    let b = ball({ x: 0, y: 3, z: 0 });
    let maxAfterBounce = 0;
    let bounced = false;
    for (let i = 0; i < 600; i += 1) {
      const prevVy = b.vel.y;
      ({ ball: b } = stepBall(b, 1 / 60));
      expect(b.pos.y).toBeGreaterThanOrEqual(R - 1e-9);
      if (prevVy < 0 && b.vel.y > 0) bounced = true;
      if (bounced) maxAfterBounce = Math.max(maxAfterBounce, b.pos.y);
    }
    expect(bounced).toBe(true);
    expect(maxAfterBounce).toBeLessThan(3);
  });

  it('akhirnya diam di tanah (gesek gulir + restVelocity), tidak memantul selamanya', () => {
    let b = ball({ x: 0, y: 1, z: 0 }, { x: 4, y: 0, z: 2 });
    for (let i = 0; i < 60 * 40; i += 1) ({ ball: b } = stepBall(b, 1 / 60));
    expect(Math.hypot(b.vel.x, b.vel.z)).toBeLessThan(0.05);
    expect(b.pos.y).toBeCloseTo(R, 3);
  });

  it('memantul dari garis samping (tidak keluar lebar lapangan)', () => {
    let b = ball({ x: PITCH.width / 2 - 1, y: R, z: 0 }, { x: 12, y: 0, z: 0 });
    for (let i = 0; i < 120; i += 1) {
      ({ ball: b } = stepBall(b, 1 / 60));
      expect(Math.abs(b.pos.x)).toBeLessThanOrEqual(PITCH.width / 2 + 1e-9);
    }
    expect(b.vel.x).toBeLessThan(0);
  });

  it('gol: bola masuk mulut gawang di garis gawang +z memberi poin tim a, -z tim b', () => {
    const a = stepBall(ball({ x: 0, y: 0.5, z: PITCH.length / 2 - R - 0.01 }, { x: 0, y: 0, z: 20 }), 1 / 30);
    expect(a.scorer).toBe('a');
    const b = stepBall(ball({ x: 1, y: 0.5, z: -PITCH.length / 2 + R + 0.01 }, { x: 0, y: 0, z: -20 }), 1 / 30);
    expect(b.scorer).toBe('b');
  });

  it('di luar mulut gawang (lebar atau tinggi): bukan gol, memantul kembali ke lapangan', () => {
    const wide = stepBall(ball({ x: PITCH.goalWidth / 2 + 3, y: 0.5, z: PITCH.length / 2 - R - 0.01 }, { x: 0, y: 0, z: 20 }), 1 / 30);
    expect(wide.scorer).toBeNull();
    expect(wide.ball.vel.z).toBeLessThan(0);
    expect(wide.ball.pos.z).toBeLessThanOrEqual(PITCH.length / 2);
    const over = stepBall(ball({ x: 0, y: PITCH.goalHeight + 1, z: PITCH.length / 2 - R - 0.01 }, { x: 0, y: 0, z: 20 }), 1 / 30);
    expect(over.scorer).toBeNull();
  });

  it('immutabel: masukan beku tidak dimutasi, hasil objek baru', () => {
    const b = Object.freeze({ pos: Object.freeze({ x: 0, y: 1, z: 0 }), vel: Object.freeze({ x: 1, y: 0, z: 1 }) });
    expect(() => stepBall(b, 1 / 60)).not.toThrow();
    expect(stepBall(b, 1 / 60).ball).not.toBe(b);
  });

  it('dt besar (tab kembali aktif) tidak menembus gawang/lapangan dan tetap hingga', () => {
    for (const dt of [0.5, 2, 5, 60]) {
      const r = stepBall(ball({ x: 10, y: 1, z: 0 }, { x: 25, y: 5, z: 40 }), dt);
      expect(finite(r.ball)).toBe(true);
      if (!r.scorer) {
        expect(Math.abs(r.ball.pos.z)).toBeLessThanOrEqual(PITCH.length / 2 + 1e-9);
        expect(Math.abs(r.ball.pos.x)).toBeLessThanOrEqual(PITCH.width / 2 + 1e-9);
      }
    }
  });

  it('dt NaN/negatif tidak merusak state bola', () => {
    for (const dt of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      const r = stepBall(ball({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 1 }), dt);
      expect(finite(r.ball)).toBe(true);
    }
  });
});
