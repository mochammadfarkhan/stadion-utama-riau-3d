import { describe, it, expect } from 'vitest';
import { keyframes, activeAt, frameCount, EASE } from '../src/dev/reels/timeline.js';

describe('timeline reels', () => {
  it('keyframes menahan di luar rentang dan menginterpolasi array', () => {
    const f = keyframes([{ t: 2, v: [0, 10] }, { t: 4, v: [2, 20], ease: 'linear' }]);
    expect(f(0)).toEqual([0, 10]);
    expect(f(3)).toEqual([1, 15]);
    expect(f(9)).toEqual([2, 20]);
  });

  it('keyframes memakai easing key tujuan; step = potongan', () => {
    const f = keyframes([{ t: 0, v: 0 }, { t: 1, v: 1, ease: 'step' }, { t: 2, v: 3 }]);
    expect(f(0.99)).toBe(0);
    expect(f(1)).toBe(1);
    expect(f(1.5)).toBeCloseTo(2, 6); // inOut simetris: tengah = tengah
  });

  it('easing berujung 0 dan 1', () => {
    for (const e of Object.values(EASE)) {
      expect(e(0)).toBe(0);
      expect(e(1)).toBe(1);
    }
  });

  it('activeAt memberi alpha fade dan batas sampai eksklusif', () => {
    const items = [{ dari: 1, sampai: 3, fade: 0.5 }];
    expect(activeAt(items, 0.9)).toEqual([]);
    expect(activeAt(items, 1.25)[0].alpha).toBeCloseTo(0.5);
    expect(activeAt(items, 2)[0].alpha).toBe(1);
    expect(activeAt(items, 3)).toEqual([]);
  });

  it('frameCount 20 detik × 30 fps = 600 dan menolak nilai tak valid', () => {
    expect(frameCount(20, 30)).toBe(600);
    expect(() => frameCount(0, 30)).toThrow(RangeError);
  });
});
