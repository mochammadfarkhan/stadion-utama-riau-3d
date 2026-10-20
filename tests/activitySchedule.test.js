import { describe, it, expect } from 'vitest';
import { PERIODS, periodAt, scheduleFor, DEFAULT_NPC_IDS } from '../src/sim/activitySchedule.js';

const POSE = {
  'rapat-1': 'sitCrossLegged', 'rapat-2': 'sitCrossLegged', 'rapat-3': 'sitCrossLegged', 'rapat-4': 'sitCrossLegged',
  laptop: 'sitChairTyping', gitar: 'guitarStrum', rebahan: 'lieDown', whiteboard: 'writeBoard',
  'ngobrol-1': 'standTalk', 'ngobrol-2': 'standTalk', minum: 'drinkCup',
};
const SLOTS = Object.entries(POSE).map(([id, poseId]) => ({ id, poseId }));

describe('periodAt (jam batas, spec §8.2)', () => {
  it.each([
    [7.999, 'pagi-kosong'], [8, 'rapat'], [11.999, 'rapat'], [12, 'sepi'], [13.999, 'sepi'], [14, 'santai'],
    [17.999, 'santai'], [18, 'begadang'], [22.999, 'begadang'], [23, 'tidur'], [0, 'tidur'], [4.999, 'tidur'],
    [5, 'pagi-kosong'], [24, 'tidur'], [-1, 'tidur'], [Number.NaN, 'tidur'], [32, 'rapat'],
  ])('jam %s → %s', (h, id) => {
    expect(periodAt(h).id).toBe(id);
  });

  it('24 jam tertutup tanpa celah/tumpang tindih', () => {
    for (let h = 0; h < 24; h += 0.05) {
      const hits = PERIODS.filter((p) => (p.from < p.to ? h >= p.from && h < p.to : h >= p.from || h < p.to));
      expect(hits.length).toBe(1);
    }
  });
});

describe('scheduleFor', () => {
  const counts = (hour) => Array.from({ length: 300 }, (_, seed) => scheduleFor(hour, seed, SLOTS).length);

  it.each([[10, 4, 5], [13, 1, 2], [15, 3, 4], [20, 4, 6], [1, 2, 3], [6, 0, 1]])(
    'jam %s: jumlah NPC dalam [%s, %s] dan kedua ujung muncul',
    (hour, min, max) => {
      const c = counts(hour);
      expect(Math.min(...c)).toBe(min);
      expect(Math.max(...c)).toBe(max);
    },
  );

  it('rapat 4 orang = lesehan saja; 5 orang = + papan tulis', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const r = scheduleFor(9, seed, SLOTS).map((a) => a.slotId);
      if (r.length === 4) expect(r).not.toContain('whiteboard');
      else expect(r).toContain('whiteboard');
    }
  });

  it('begadang selalu memuat laptop dan whiteboard', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const r = scheduleFor(21, seed, SLOTS).map((a) => a.slotId);
      expect(r).toEqual(expect.arrayContaining(['laptop', 'whiteboard']));
    }
  });

  it('npc & slot unik; poseId mengikuti slot; hasil beku', () => {
    for (const hour of [6, 9, 13, 15, 20, 2]) {
      const r = scheduleFor(hour, 7, SLOTS);
      expect(new Set(r.map((a) => a.npcId)).size).toBe(r.length);
      expect(new Set(r.map((a) => a.slotId)).size).toBe(r.length);
      for (const a of r) {
        expect(a.poseId).toBe(POSE[a.slotId]);
        expect(DEFAULT_NPC_IDS).toContain(a.npcId);
        expect(Object.isFrozen(a)).toBe(true);
      }
    }
  });

  it('deterministik & stabil sepanjang satu periode; seed beda bisa beda', () => {
    expect(scheduleFor(8.1, 42, SLOTS)).toEqual(scheduleFor(11.9, 42, SLOTS));
    const differs = [1, 2, 3, 4, 5, 6, 7, 8].some((s) => JSON.stringify(scheduleFor(20, s, SLOTS)) !== JSON.stringify(scheduleFor(20, 0, SLOTS)));
    expect(differs).toBe(true);
  });

  it('slot yang tidak tersedia dilewati; jumlah dibatasi slot & npc yang ada', () => {
    const noGuitar = SLOTS.filter((s) => s.id !== 'gitar');
    for (let seed = 0; seed < 50; seed += 1) {
      expect(scheduleFor(15, seed, noGuitar).map((a) => a.slotId)).not.toContain('gitar');
      expect(scheduleFor(20, seed, SLOTS, ['a', 'b']).length).toBeLessThanOrEqual(2);
    }
    expect(scheduleFor(10, 1, null)).toEqual([]);
  });
});

describe('profil kehadiran', () => {
  const slots = [{ id: 'gitar', poseId: 'guitarStrum' }, { id: 'rapat-1', poseId: 'sitCrossLegged' }];
  const profiles = {
    a: { datang: 14, pulang: 24, suka: ['gitar'] },
    b: { datang: 22, pulang: 6, suka: ['rapat-1'] },
    c: { datang: 7, pulang: 13, suka: [] },
  };
  it('presentAt: jam wrap dan datang===pulang selalu hadir', async () => {
    const { presentAt } = await import('../src/sim/activitySchedule.js');
    expect(presentAt(profiles.b, 23)).toBe(true);
    expect(presentAt(profiles.b, 3)).toBe(true);
    expect(presentAt(profiles.b, 12)).toBe(false);
    expect(presentAt({ datang: 0, pulang: 0 }, 5)).toBe(true);
    expect(presentAt(undefined, 5)).toBe(true);
  });
  it('hanya NPC yang hadir dipilih dan slot favorit didahulukan', () => {
    for (let seed = 1; seed < 20; seed += 1) {
      const out = scheduleFor(15, seed, slots, ['a', 'b', 'c'], profiles);
      expect(out.every((x) => x.npcId === 'a')).toBe(true); // jam 15: hanya 'a' hadir (periode santai punya slot gitar)
    }
  });
});
