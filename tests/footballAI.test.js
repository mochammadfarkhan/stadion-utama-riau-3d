import { describe, it, expect } from 'vitest';
import { createMatch, stepMatch } from '../src/sim/footballAI.js';
import { PITCH, FOOTBALL } from '../src/config/constants.js';
import { deepFreeze, hasNaN } from './helpers.js';

const DT = 1 / 60;
const runFor = (m, seconds) => {
  let s = m;
  for (let i = 0; i < Math.round(seconds / DT); i += 1) s = stepMatch(s, DT);
  return s;
};

describe('createMatch', () => {
  it('2 tim × 5 pemain, tim a di z<0 dan tim b di z>0', () => {
    const m = createMatch();
    expect(m.players).toHaveLength(10);
    const a = m.players.filter((p) => p.team === 'a');
    const b = m.players.filter((p) => p.team === 'b');
    expect(a).toHaveLength(5);
    expect(b).toHaveLength(5);
    a.forEach((p) => expect(p.home.z).toBeLessThan(0));
    b.forEach((p) => expect(p.home.z).toBeGreaterThan(0));
    expect(m.score).toEqual({ a: 0, b: 0 });
    expect(m.ball.pos.y).toBeGreaterThan(0);
    expect(m.t).toBe(0);
  });
  it('pemain punya field kontrak', () => {
    const p = createMatch().players[0];
    expect(p).toMatchObject({ state: 'RETURN', kickTimer: 0 });
    expect(p.pos).toEqual(p.home);
    expect(p.vel).toEqual({ x: 0, z: 0 });
    expect(typeof p.facing).toBe('number');
  });
  it('teamSize lain tetap valid', () => {
    expect(createMatch({ teamSize: 7 }).players).toHaveLength(14);
  });
});

describe('stepMatch — FSM', () => {
  it('hanya satu pemain per tim yang CHASE/KICK', () => {
    const m = stepMatch(createMatch(), DT);
    ['a', 'b'].forEach((team) => {
      const chasing = m.players.filter((p) => p.team === team && p.state !== 'RETURN');
      expect(chasing).toHaveLength(1);
    });
  });
  it('pemain CHASE mendekati bola', () => {
    const m0 = createMatch();
    const m1 = runFor(m0, 1);
    const chaser = m1.players.find((p) => p.team === 'a' && p.state !== 'RETURN');
    const before = m0.players.find((p) => p.id === chaser.id);
    const d0 = Math.hypot(before.pos.x - m0.ball.pos.x, before.pos.z - m0.ball.pos.z);
    const d1 = Math.hypot(chaser.pos.x - m1.ball.pos.x, chaser.pos.z - m1.ball.pos.z);
    expect(d1).toBeLessThan(d0);
  });
  it('dekat bola → KICK, bola mendapat kecepatan, kickTimer > 0', () => {
    const m0 = createMatch();
    const p = m0.players.find((x) => x.team === 'a');
    const m = { ...m0, ball: { ...m0.ball, pos: { x: p.pos.x + 0.3, y: FOOTBALL.ballRadius, z: p.pos.z + 0.3 } } };
    const m1 = stepMatch(m, DT);
    const kicker = m1.players.find((x) => x.id === p.id);
    expect(kicker.state).toBe('KICK');
    expect(kicker.kickTimer).toBeGreaterThan(0);
    expect(Math.hypot(m1.ball.vel.x, m1.ball.vel.z)).toBeGreaterThan(1);
  });
  it('tendang ke gawang bila dekat gawang lawan', () => {
    const m0 = createMatch();
    const p = m0.players.find((x) => x.team === 'a');
    const nearGoal = { x: 2, z: PITCH.length / 2 - 12 };
    const players = m0.players.map((x) => (x.id === p.id ? { ...x, pos: nearGoal } : x));
    const ball = { ...m0.ball, pos: { x: nearGoal.x + 0.2, y: FOOTBALL.ballRadius, z: nearGoal.z + 0.2 } };
    const m1 = stepMatch({ ...m0, players, ball }, DT);
    expect(m1.ball.vel.z).toBeGreaterThan(0);
    expect(Math.abs(m1.ball.vel.x)).toBeLessThan(m1.ball.vel.z);
  });
  it('facing mengikuti arah velocity', () => {
    const m = runFor(createMatch(), 0.5);
    const mover = m.players.find((p) => Math.hypot(p.vel.x, p.vel.z) > 0.5);
    expect(mover).toBeDefined();
    expect(mover.facing).toBeCloseTo(Math.atan2(mover.vel.x, mover.vel.z), 3);
  });
});

describe('stepMatch — bola', () => {
  it('gol menaikkan skor dan reset ke tengah', () => {
    const m0 = createMatch();
    const m = { ...m0, ball: { pos: { x: 0, y: 0.5, z: PITCH.length / 2 - 0.3 }, vel: { x: 0, y: 0, z: 30 } } };
    const m1 = stepMatch(m, DT);
    expect(m1.score.a).toBe(1);
    expect(m1.score.b).toBe(0);
    expect(m1.ball.pos.x).toBeCloseTo(0, 6);
    expect(m1.ball.pos.z).toBeCloseTo(0, 6);
    expect(m1.ball.vel).toEqual({ x: 0, y: 0, z: 0 });
    m1.players.forEach((p) => expect(p.pos).toEqual(p.home));
  });
  it('gol tim b di gawang z<0', () => {
    const m0 = createMatch();
    const m = { ...m0, ball: { pos: { x: 1, y: 0.5, z: -PITCH.length / 2 + 0.3 }, vel: { x: 0, y: 0, z: -30 } } };
    expect(stepMatch(m, DT).score.b).toBe(1);
  });
  it('bola di luar lebar gawang memantul, bukan gol', () => {
    const m0 = createMatch();
    const m = { ...m0, ball: { pos: { x: 20, y: 0.5, z: PITCH.length / 2 - 0.3 }, vel: { x: 0, y: 0, z: 30 } } };
    const m1 = stepMatch(m, DT);
    expect(m1.score.a).toBe(0);
    expect(m1.ball.vel.z).toBeLessThan(0);
    expect(Math.abs(m1.ball.pos.z)).toBeLessThanOrEqual(PITCH.length / 2);
  });
  it('memantul dari sisi lebar lapangan', () => {
    const m0 = createMatch();
    const m = { ...m0, ball: { pos: { x: PITCH.width / 2 - 0.2, y: 0.3, z: 0 }, vel: { x: 20, y: 0, z: 0 } } };
    const m1 = stepMatch(m, DT);
    expect(m1.ball.vel.x).toBeLessThan(0);
  });
  it('bola tidak tembus tanah dan memantul (tanpa pemain agar tidak ditendang)', () => {
    const m0 = createMatch();
    let m = { ...m0, players: [], ball: { pos: { x: 0, y: 5, z: 0 }, vel: { x: 0, y: 0, z: 0 } } };
    let bounced = false;
    for (let i = 0; i < 300; i += 1) {
      const prev = m.ball.vel.y;
      m = stepMatch(m, DT);
      expect(m.ball.pos.y).toBeGreaterThanOrEqual(FOOTBALL.ballRadius - 1e-9);
      if (prev < 0 && m.ball.vel.y > 0) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(m.ball.pos.y).toBeCloseTo(FOOTBALL.ballRadius, 2);
  });
});

describe('stepMatch — kualitas', () => {
  it('immutability (deep): input beku tidak dimutasi dan pos objek baru', () => {
    const m0 = deepFreeze(createMatch());
    const m1 = stepMatch(m0, DT);
    expect(m1).not.toBe(m0);
    m1.players.forEach((p, i) => {
      expect(p).not.toBe(m0.players[i]);
      expect(p.pos).not.toBe(m0.players[i].pos);
    });
    expect(m1.ball.pos).not.toBe(m0.ball.pos);
    expect(m0.t).toBe(0);
  });
  it('tidak ada NaN setelah 60 s dengan dt=1/60', () => {
    const m = runFor(createMatch(), 60);
    expect(hasNaN(m)).toBe(false);
    expect(m.t).toBeCloseTo(60, 1);
    m.players.forEach((p) => {
      expect(Math.abs(p.pos.x)).toBeLessThan(PITCH.width);
      expect(Math.abs(p.pos.z)).toBeLessThan(PITCH.length);
    });
  });
  it('pemain saling separation (tidak menumpuk)', () => {
    const m = runFor(createMatch(), 10);
    for (let i = 0; i < m.players.length; i += 1) {
      for (let j = i + 1; j < m.players.length; j += 1) {
        const a = m.players[i].pos;
        const b = m.players[j].pos;
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.2);
      }
    }
  });
  it('dt tidak valid aman', () => {
    const m = createMatch();
    expect(hasNaN(stepMatch(m, NaN))).toBe(false);
    expect(stepMatch(m, 0).t).toBe(0);
  });
});
