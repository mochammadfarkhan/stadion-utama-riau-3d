import { describe, it, expect } from 'vitest';
import { formatDistance, relativeBearing } from '../src/story/goalInfo.js';

describe('goalInfo', () => {
  it('formatDistance', () => {
    expect(formatDistance(4)).toBe('0 m');
    expect(formatDistance(244)).toBe('240 m');
    expect(formatDistance(995)).toBe('1,0 km');
    expect(formatDistance(1284)).toBe('1,3 km');
    expect(formatDistance(null)).toBe('');
  });
  it('relativeBearing', () => {
    expect(relativeBearing({ x: 0, z: 0 }, { x: 0, z: 10 }, 0)).toBeCloseTo(0, 9);
    expect(relativeBearing({ x: 0, z: 0 }, { x: 10, z: 0 }, 0)).toBeCloseTo(Math.PI / 2, 9);
    expect(Math.abs(relativeBearing({ x: 0, z: 0 }, { x: 0, z: -10 }, 0))).toBeCloseTo(Math.PI, 9);
  });
});
