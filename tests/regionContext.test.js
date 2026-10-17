import { describe, it, expect } from 'vitest';
import { createLocalContext, pointToWorld, pointToLocal } from '../src/app/regionContext.js';
import { createRegionFrame, IDENTITY_FRAME } from '../src/geo/regionTransform.js';

const frame = createRegionFrame({ x: 100, z: -50, yaw: 0.3 });

describe('konteks region-lokal', () => {
  it('frame identitas: ctx dikembalikan apa adanya', () => {
    const ctx = { bikePos: { x: 1, y: 0, z: 2 } };
    expect(createLocalContext(IDENTITY_FRAME)(ctx)).toBe(ctx);
  });

  it('bikePos & focus diubah ke lokal, field lain tetap; cache per objek ctx', () => {
    const local = createLocalContext(frame);
    const w = frame.toWorld(5, -7);
    const ctx = { time: 3, input: 'in', bikePos: { x: w.x, y: 0, z: w.z }, focus: null };
    const a = local(ctx);
    expect(a.bikePos.x).toBeCloseTo(5, 9);
    expect(a.bikePos.z).toBeCloseTo(-7, 9);
    expect(a.focus).toBeNull();
    expect(a.time).toBe(3);
    expect(a.input).toBe('in');
    expect(local(ctx)).toBe(a);
    expect(local({ ...ctx })).not.toBe(a);
  });

  it('pointToWorld/pointToLocal saling berkebalikan; null aman; identitas = objek sama', () => {
    const p = { x: 12, z: -3, color: 'merah' };
    const w = pointToWorld(frame, p);
    expect(w.color).toBe('merah');
    const back = pointToLocal(frame, w);
    expect(back.x).toBeCloseTo(12, 9);
    expect(back.z).toBeCloseTo(-3, 9);
    expect(pointToWorld(frame, null)).toBeNull();
    expect(pointToWorld(IDENTITY_FRAME, p)).toBe(p);
  });
});
