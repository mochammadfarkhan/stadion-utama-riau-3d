import { describe, expect, it } from 'vitest';
import { TRANSIT_LINES, buildTrack, sampleTrackAt, buildSchedule, trainStateAt } from '../../src/city/transitData.js';

describe('transitData (MRT & LRT Pekanbaru)', () => {
  it('menyertakan stasiun interchange Living World / SKA pada kedua jalur', () => {
    const mrt = TRANSIT_LINES.find((l) => l.id === 'mrt');
    const lrt = TRANSIT_LINES.find((l) => l.id === 'lrt');
    expect(mrt).toBeDefined();
    expect(lrt).toBeDefined();
    expect(mrt.stations.some((s) => s.id === 'mrt-living-world' && s.interchange)).toBe(true);
    expect(lrt.stations.some((s) => s.id === 'lrt-living-world' && s.interchange)).toBe(true);
    expect(mrt.elevation).not.toBe(lrt.elevation);
  });

  it('buildTrack menghasilkan panjang positif dan melewati titik tiap stasiun', () => {
    for (const line of TRANSIT_LINES) {
      const track = buildTrack(line);
      expect(track.len).toBeGreaterThan(5000);
      expect(track.stationS.length).toBe(line.stations.length);
      const out = { x: 0, z: 0, ux: 0, uz: 0 };
      for (let i = 0; i < line.stations.length; i += 1) {
        sampleTrackAt(track, track.stationS[i], out);
        expect(out.x).toBeCloseTo(line.stations[i].x, 1);
        expect(out.z).toBeCloseTo(line.stations[i].z, 1);
        expect(Math.hypot(out.ux, out.uz)).toBeCloseTo(1, 5);
      }
    }
  });

  it('trainStateAt bergerak maju, berhenti di stasiun, lalu berbalik arah', () => {
    const track = buildTrack(TRANSIT_LINES[0]);
    const schedule = buildSchedule(track);
    expect(schedule.cycleSec).toBeGreaterThan(60);

    const a = trainStateAt(schedule, 0, 1, 0.5, { s: 0, dir: 1 });
    const b = trainStateAt(schedule, 0, 1, schedule.cycleSec * 0.25, { s: 0, dir: 1 });
    const c = trainStateAt(schedule, 0, 1, schedule.cycleSec * 0.75, { s: 0, dir: 1 });
    expect(b.s).toBeGreaterThan(a.s);
    expect(b.dir).toBe(1);
    expect(c.dir).toBe(-1);

    // Saat dwell di stasiun pertama setelah tiba (akhir segmen 0)
    const firstLegEnd = schedule.segs[0].t1;
    const d1 = trainStateAt(schedule, 0, 1, firstLegEnd + 0.2, { s: 0, dir: 1 }).s;
    const d2 = trainStateAt(schedule, 0, 1, firstLegEnd + 1.2, { s: 0, dir: 1 }).s;
    expect(d1).toBeCloseTo(track.stationS[1], 4);
    expect(d2).toBeCloseTo(track.stationS[1], 4);
  });
});
