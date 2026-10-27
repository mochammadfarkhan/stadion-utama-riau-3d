import { describe, it, expect } from 'vitest';
import { fitFontSize } from '../src/world/util/fitText.js';

/** Perulangan lama (referensi): turun `step` selama px > minPx dan terlalu lebar. */
function reference(measure, maxPx, minPx, step, maxW) {
  let px = maxPx;
  while (px > minPx && measure(px) > maxW) px -= step;
  return px;
}

describe('fitFontSize', () => {
  it('hasil sama dengan perulangan lama untuk banyak masukan acak (step 1 dan 2)', () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 2000; i += 1) {
      const k = 0.3 + rnd() * 8; // lebar per px (panjang teks)
      const measure = (px) => Math.round(k * px * 10) / 10; // monoton, dibulatkan seperti measureText
      const maxPx = 4 + Math.floor(rnd() * 160);
      const step = rnd() < 0.5 ? 1 : 2;
      const minPx = step === 1 ? 6 : 10;
      const maxW = rnd() * 600;
      expect(fitFontSize(measure, maxPx, minPx, step, maxW)).toBe(reference(measure, maxPx, minPx, step, maxW));
    }
  });

  it('jauh lebih sedikit pengukuran: 120 px → muat di 40 px dengan ≤ 8 ukur', () => {
    let calls = 0;
    const measure = (px) => { calls += 1; return px * 5; };
    expect(fitFontSize(measure, 120, 6, 1, 200)).toBe(40);
    expect(calls).toBeLessThanOrEqual(8);
  });
});
