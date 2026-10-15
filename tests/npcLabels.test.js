import { describe, it, expect } from 'vitest';
import { npcLabelVisible, NPC_LABEL_DISTANCE } from '../src/entities/StoryNpcs.js';

describe('npcLabelVisible', () => {
  it('terlihat hanya bila label diaktifkan dan NPC dalam jarak', () => {
    expect(npcLabelVisible(10, true)).toBe(true);
    expect(npcLabelVisible(NPC_LABEL_DISTANCE, true)).toBe(true);
    expect(npcLabelVisible(NPC_LABEL_DISTANCE + 0.1, true)).toBe(false);
    expect(npcLabelVisible(10, false)).toBe(false);
  });
  it('jarak tidak valid menyembunyikan label (aman)', () => {
    expect(npcLabelVisible(Number.NaN, true)).toBe(false);
  });
});
