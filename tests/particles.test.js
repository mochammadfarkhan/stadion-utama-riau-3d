import { describe, it, expect } from 'vitest';
import { createParticles, emitParticle, stepParticles, countAlive } from '../src/sim/particles.js';

describe('particles', () => {
  it('jatuh bebas mengikuti gravitasi dan mati saat umur habis', () => {
    const p = createParticles(4);
    emitParticle(p, 0, 10, 0, 1, 0, 0, 1, 0.1);
    for (let i = 0; i < 10; i += 1) stepParticles(p, 0.05);
    expect(p.px[0]).toBeCloseTo(0.5, 5);
    expect(p.vy[0]).toBeCloseTo(-9.8 * 0.5, 4);
    expect(p.py[0]).toBeLessThan(10 - 0.5 * 9.8 * 0.25 + 0.2); // ≈ ½gt² (Euler semi-implisit sedikit lebih jauh)
    expect(stepParticles(p, 0.6)).toBe(0);
    expect(p.alive[0]).toBe(0);
  });

  it("menyentuh tanah: 'stop' diam di tanah sampai umur habis, 'kill' langsung hilang", () => {
    const stop = createParticles(1);
    emitParticle(stop, 0, 0.5, 0, 0, -2, 0, 5, 0.1);
    for (let i = 0; i < 20; i += 1) stepParticles(stop, 0.05, { groundAt: () => 0.2 });
    expect(stop.py[0]).toBeCloseTo(0.2, 6); // Float32Array
    expect(stop.grounded[0]).toBe(1);
    expect(countAlive(stop)).toBe(1);
    const kill = createParticles(1);
    emitParticle(kill, 0, 0.5, 0, 0, -2, 0, 5, 0.1);
    let live = 1;
    for (let i = 0; i < 20; i += 1) live = stepParticles(kill, 0.05, { groundAt: () => 0.2, onGround: 'kill' });
    expect(live).toBe(0);
  });

  it('kolam penuh menimpa yang tertua; drag memperlambat; life tidak valid diabaikan', () => {
    const p = createParticles(2);
    emitParticle(p, 1, 0, 0, 0, 0, 0, 1, 0.1);
    emitParticle(p, 2, 0, 0, 0, 0, 0, 1, 0.1);
    expect(emitParticle(p, 3, 0, 0, 0, 0, 0, 1, 0.1)).toBe(0);
    expect(p.px[0]).toBe(3);
    expect(emitParticle(p, 0, 0, 0, 0, 0, 0, 0, 0.1)).toBe(-1);
    const d = createParticles(1);
    emitParticle(d, 0, 0, 0, 10, 0, 0, 5, 0.1);
    stepParticles(d, 0.1, { gravity: 0, drag: 2 });
    expect(d.vx[0]).toBeCloseTo(8);
  });
});
