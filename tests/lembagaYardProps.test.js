import { describe, it, expect } from 'vitest';
import { yardPropLayout, YARD_PROPS_MAX } from '../src/regions/unri-lembaga/yardProps.js';

describe('yardPropLayout', () => {
  it('deterministik dan di bawah anggaran', () => {
    const a = yardPropLayout();
    expect(a).toEqual(yardPropLayout());
    expect(a.length).toBeGreaterThan(10);
    expect(a.length).toBeLessThanOrEqual(YARD_PROPS_MAX);
  });
  it('semua item punya posisi hingga dan jenis dikenal', () => {
    for (const it of yardPropLayout()) {
      expect(['meja', 'kursi', 'pot', 'ban', 'karung']).toContain(it.kind);
      expect(Number.isFinite(it.x + it.z + it.rot)).toBe(true);
    }
  });
});
