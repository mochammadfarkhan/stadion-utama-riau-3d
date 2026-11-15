import { describe, it, expect } from 'vitest';
import { buildStadionProxy, ribPolyline } from '../src/regions/stadion/proxy.js';
import { RIB_PROFILE } from '../src/world/stadium/profiles.js';
import { STADIUM } from '../src/config/constants.js';

describe('proxy stadion', () => {
  it('rusuk: kaki di tanah, puncak di atas atap', () => {
    const pts = ribPolyline(0.25, RIB_PROFILE);
    expect(pts).toHaveLength(RIB_PROFILE.length);
    expect(pts[0].y).toBe(0);
    expect(Math.max(...pts.map((p) => p.y))).toBeGreaterThan(STADIUM.roofHeight);
  });
  it('anggaran: ≤ 8 draw call dan ≤ 10.000 segitiga', () => {
    const p = buildStadionProxy();
    let calls = 0;
    let tris = 0;
    p.group.traverse((o) => { if (o.isMesh) { calls += 1; tris += o.geometry.getAttribute('position').count / 3; } });
    expect(calls).toBeLessThanOrEqual(8);
    expect(tris).toBeLessThanOrEqual(10000);
    p.dispose();
  });
});
