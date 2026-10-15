import { describe, it, expect } from 'vitest';
import { createStory } from '../src/sim/story/reducer.js';

const chapters = Object.freeze([
  { id: 'c1', title: 'Satu', rank: 'Pemula', outro: ['Bab satu selesai.'], reward: { rupiah: 1000, badge: 'b1' },
    steps: [
      { id: 's1', text: 'Ke A', say: ['Halo'], objective: { type: 'goto', target: { x: 0, z: 0 }, radius: 3 } },
      { id: 's2', text: 'Beli teh', objective: { type: 'buy', itemId: 'es-teh' }, reward: { rupiah: 500 } },
    ] },
  { id: 'c2', title: 'Dua', rank: 'Jago', outro: ['Tamat.'], reward: { rupiah: 2000, badge: 'b2' },
    steps: [
      { id: 's3', text: 'Putar', timeLimit: 10, objective: { type: 'laps', count: 1 } },
      { id: 's4', text: 'Cari', objective: { type: 'find', ids: ['e1'] } },
    ] },
]);
const eggs = Object.freeze([
  { id: 'e1', title: 'Telur', text: 'Ketemu', reward: { rupiah: 300 } },
  { id: 'e2', title: 'Telur 2', text: 'Ketemu lagi', reward: { rupiah: 100 } },
]);
const story = createStory({ chapters, eggs });
const run = (s, events) => events.reduce((acc, e) => {
  const r = story.reduce(acc.state, e);
  return { state: r.state, effects: [...acc.effects, ...r.effects] };
}, { state: s, effects: [] });
const at = (x, z) => ({ type: 'position', x, z });

describe('createStory', () => {
  it('awal: dialog langkah pertama terbuka dan memblokir event selain advance', () => {
    const s0 = story.initial();
    expect(s0.dialog.lines).toEqual(['Halo']);
    expect(story.reduce(s0, at(0, 0)).state).toBe(s0);
    expect(story.reduce(s0, { type: 'advance' }).state.dialog).toBeNull();
  });
  it('urutan langkah, hadiah langkah, dan penyelesaian chapter', () => {
    const r = run(story.initial(), [{ type: 'advance' }, at(1, 1), { type: 'bought', itemId: 'es-teh' }]);
    expect(r.state.chapter).toBe(1);
    expect(r.state.step).toBe(0);
    expect(r.state.rupiah).toBe(500 + 1000);
    expect(r.state.badges).toEqual(['b1']);
    expect(r.state.dialog.lines).toEqual(['Bab satu selesai.']);
    expect(r.effects.some((e) => e.type === 'reward' && e.badge === 'b1')).toBe(true);
    expect(r.effects.some((e) => e.type === 'save')).toBe(true);
    expect(story.rankOf(r.state)).toBe('Pemula');
  });
  it('batas waktu habis mengulang langkah dengan toast', () => {
    let st = run(story.initial(), [{ type: 'advance' }, at(0, 0), { type: 'bought', itemId: 'es-teh' }, { type: 'advance' }]).state;
    expect(st.timeLeft).toBe(10);
    const r = run(st, [{ type: 'tick', dt: 6 }, { type: 'tick', dt: 6 }]);
    expect(r.state.timeLeft).toBe(10);
    expect(r.state.step).toBe(0);
    expect(r.effects.some((e) => e.type === 'toast' && e.ok === false)).toBe(true);
  });
  it('egg memberi hadiah sekali dan ikut menyelesaikan find; chapter terakhir → finished', () => {
    const start = run(story.initial(), [{ type: 'advance' }, at(0, 0), { type: 'bought', itemId: 'es-teh' }, { type: 'advance' }, { type: 'lapDone', seconds: 30 }]).state;
    expect(start.bestLap).toBe(30);
    expect(start.step).toBe(1);
    const a = run(start, [{ type: 'egg', id: 'e2' }, { type: 'egg', id: 'e2' }]);
    expect(a.state.eggs).toEqual(['e2']);
    expect(a.state.rupiah - start.rupiah).toBe(100);
    const b = run(a.state, [{ type: 'egg', id: 'e1' }]);
    expect(b.state.finished).toBe(true);
    expect(b.state.badges).toEqual(['b1', 'b2']);
    expect(story.rankOf(b.state)).toBe('Jago');
  });
  it('bestLap hanya turun', () => {
    const start = run(story.initial(), [{ type: 'advance' }, at(0, 0), { type: 'bought', itemId: 'es-teh' }, { type: 'advance' }]).state;
    const r = run(start, [{ type: 'lapDone', seconds: 50 }]);
    expect(r.state.bestLap).toBe(50);
    const again = story.reduce({ ...r.state, step: 0, progress: { count: 0, found: [] } }, { type: 'lapDone', seconds: 60 });
    expect(again.state.bestLap).toBe(50);
  });
  it('reset kembali ke awal; hydrate memuat simpanan', () => {
    const s = run(story.initial(), [{ type: 'advance' }, at(0, 0)]).state;
    expect(story.reduce(s, { type: 'reset' }).state).toEqual(story.initial());
    const h = story.hydrate({ version: 1, chapter: 1, step: 1, badges: ['b1'], eggs: ['e2'], bestLap: 33, rupiah: 900, finished: false });
    expect(h.chapter).toBe(1);
    expect(h.step).toBe(1);
    expect(h.dialog).toBeNull();
    expect(h.rupiah).toBe(900);
  });
  it('tidak memutasi state masukan', () => {
    const s0 = Object.freeze(story.initial());
    expect(() => story.reduce(s0, { type: 'advance' })).not.toThrow();
  });
});

describe('langkah find dengan egg yang sudah ditemukan lebih dulu', () => {
  const save = (eggsFound, step = 1) => ({ version: 1, chapter: 1, step, eggs: eggsFound, badges: [], bestLap: null, rupiah: 0, finished: false });

  it('hydrate mengisi progress.found dari egg tersimpan', () => {
    expect(story.hydrate(save(['e1'])).progress.found).toEqual(['e1']);
    expect(story.hydrate(save([])).progress.found).toEqual([]);
  });
  it('egg yang sudah lengkap menyelesaikan langkah pada event non-egg berikutnya', () => {
    const { state } = story.reduce(story.hydrate(save(['e1'])), { type: 'tick', dt: 0.016 });
    expect(state.finished).toBe(true);
  });
  it('masuk langkah find dari langkah sebelumnya memakai egg yang sudah ditemukan', () => {
    const s0 = story.hydrate(save(['e1'], 0));
    const s1 = story.reduce(s0, { type: 'lapDone', seconds: 5 }).state;
    expect(s1.step).toBe(1);
    expect(s1.progress.found).toEqual(['e1']);
  });
  it('egg baru tetap dihitung lewat event egg', () => {
    const { state } = story.reduce(story.hydrate(save([])), { type: 'egg', id: 'e1' });
    expect(state.finished).toBe(true);
  });
});
