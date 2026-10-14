import { describe, it, expect } from 'vitest';
import { createLapTracker, stepLap } from '../src/sim/story/lapTracker.js';

const R = 40;
const cps = Array.from({ length: 8 }, (_, i) => ({ x: R * Math.cos((i / 8) * 2 * Math.PI), z: R * Math.sin((i / 8) * 2 * Math.PI) }));

function drive(tracker, order, t0 = 0, dt = 5) {
  let t = t0;
  let laps = [];
  let st = tracker;
  for (const i of order) {
    const r = stepLap(st, cps[i], t);
    st = r.state;
    if (r.lapSeconds != null) laps = [...laps, r.lapSeconds];
    t += dt;
  }
  return { st, laps };
}

describe('lapTracker', () => {
  it('putaran penuh berurutan menghasilkan waktu', () => {
    const { laps } = drive(createLapTracker(cps, 6), [0, 1, 2, 3, 4, 5, 6, 7, 0]);
    expect(laps).toEqual([40]);
  });
  it('dua putaran', () => {
    const { laps } = drive(createLapTracker(cps, 6), [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7, 0]);
    expect(laps).toEqual([40, 40]);
  });
  it('melompati titik atau memutar balik tidak menghitung', () => {
    const { laps } = drive(createLapTracker(cps, 6), [0, 2, 4, 6, 0, 7, 6, 5, 4, 3, 2, 1, 0]);
    expect(laps).toEqual([]);
  });
  it('di luar radius tidak mengubah state', () => {
    const t = createLapTracker(cps, 6);
    const r = stepLap(t, { x: 999, z: 999 }, 1);
    expect(r.state).toBe(t);
    expect(r.lapSeconds).toBeNull();
  });
});
