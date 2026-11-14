import { describe, it, expect } from 'vitest';
import { BLOB_STOPS } from '../src/engine/contactShadows.js';

describe('bayangan kontak', () => {
  it('alphaMap dibaca dari kanal hijau: pusat harus terang, tepi gelap', () => {
    expect(BLOB_STOPS[0]).toEqual([0, 255]);
    expect(BLOB_STOPS.at(-1)).toEqual([1, 0]);
    for (let i = 1; i < BLOB_STOPS.length; i += 1) expect(BLOB_STOPS[i][1]).toBeLessThan(BLOB_STOPS[i - 1][1]);
  });
});
