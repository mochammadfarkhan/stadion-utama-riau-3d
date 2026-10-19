import { describe, it, expect } from 'vitest';
import { CHAPTERS, STORY_NPCS } from '../src/story/chapters.js';
import { EASTER_EGGS, EGG_IDS } from '../src/story/easterEggs.js';
import { VENDOR_CATALOG } from '../src/sim/vendorSim.js';

const allItems = new Set(Object.values(VENDOR_CATALOG).flat().map((i) => i.id));
const steps = CHAPTERS.flatMap((c) => c.steps);

describe('data cerita', () => {
  it('id unik untuk chapter, langkah, easter egg', () => {
    for (const ids of [CHAPTERS.map((c) => c.id), steps.map((s) => s.id), EGG_IDS]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('find merujuk easter egg yang ada', () => {
    steps.filter((s) => s.objective.type === 'find').forEach((s) => {
      s.objective.ids.forEach((id) => expect(EGG_IDS).toContain(id));
    });
  });
  it('buy/deliver memakai item katalog; deliver memakai NPC yang ada', () => {
    const npcIds = STORY_NPCS.map((n) => n.id);
    steps.forEach((s) => {
      const o = s.objective;
      if (o.type === 'buy' || o.type === 'deliver') expect(allItems.has(o.itemId)).toBe(true);
      if (o.type === 'deliver') expect(npcIds).toContain(o.npcId);
    });
  });
  it('interact: target <region|interior>:<id> dan titik penanda valid bila ada', () => {
    steps.filter((s) => s.objective.type === 'interact').forEach((s) => {
      expect(s.objective.target).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/);
      if (s.objective.at) expect([s.objective.at.x, s.objective.at.z].every(Number.isFinite)).toBe(true);
    });
  });
  it('chapter 6 Kampus Biru Langit: 4 misi (deliver, interact NPC, goto berantai, interact interior)', () => {
    const ch = CHAPTERS.find((c) => c.id === 'kampus-biru-langit');
    expect(CHAPTERS.indexOf(ch)).toBe(5);
    expect(new Set(ch.steps.map((s) => s.mission))).toEqual(new Set([1, 2, 3, 4]));
    expect(ch.steps.filter((s) => s.mission === 1).map((s) => s.objective.type)).toEqual(['buy', 'deliver']);
    expect(ch.steps.find((s) => s.mission === 2).objective).toMatchObject({ type: 'interact', target: 'unri-lembaga:ketua-bem' });
    const danau = ch.steps.filter((s) => s.mission === 3);
    expect(danau.length).toBe(5);
    expect(danau.every((s) => s.objective.type === 'goto')).toBe(true);
    expect(danau[4].objective.target).toEqual(danau[0].objective.target);
    expect(ch.steps.find((s) => s.mission === 4).objective.target.startsWith('sekre:')).toBe(true);
  });
  it('NPC target interact ada di STORY_NPCS dengan zone yang sama', () => {
    steps.filter((s) => s.objective.type === 'interact' && !s.objective.target.startsWith('sekre:')).forEach((s) => {
      const [zone, id] = s.objective.target.split(':');
      expect(STORY_NPCS.find((n) => n.id === id)?.zone).toBe(zone);
    });
  });
  it('dialog singkat: maks 160 karakter per baris', () => {
    const lines = [...steps.flatMap((s) => s.say ?? []), ...CHAPTERS.flatMap((c) => c.outro), ...EASTER_EGGS.map((e) => e.text)];
    lines.forEach((l) => expect(l.length).toBeLessThanOrEqual(160));
  });
  it('semua beku dan setiap chapter punya langkah + hadiah', () => {
    expect(Object.isFrozen(CHAPTERS)).toBe(true);
    expect(Object.isFrozen(CHAPTERS[0].steps[0].objective)).toBe(true);
    expect(Object.isFrozen(EASTER_EGGS)).toBe(true);
    CHAPTERS.forEach((c) => {
      expect(c.steps.length).toBeGreaterThan(0);
      expect(c.reward.rupiah).toBeGreaterThan(0);
    });
  });
});
