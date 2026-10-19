import { describe, it, expect } from 'vitest';
import { reopenForNewChapters } from '../src/story/storage.js';

const base = Object.freeze({
  version: 3, chapter: 4, step: 0, badges: Object.freeze(['Anak Bertuah']), eggs: Object.freeze([]), bestLap: null,
  rupiah: 100, finished: true, wallet: Object.freeze({ balance: 1000, items: Object.freeze([]) }),
});

describe('reopenForNewChapters (M7: chapter 6 ditambahkan)', () => {
  it('save tamat di chapter lama dibuka di chapter berikutnya, langkah 0; progres lain utuh; input tidak dimutasi', () => {
    const r = reopenForNewChapters(base, 6);
    expect(r.reopened).toBe(true);
    expect(r.save).toMatchObject({ chapter: 5, step: 0, finished: false, rupiah: 100, badges: ['Anak Bertuah'] });
    expect(r.save.wallet).toEqual(base.wallet);
    expect(base.chapter).toBe(4);
    expect(base.finished).toBe(true);
  });
  it('tamat di chapter terakhir, belum tamat, atau bukan save: dikembalikan apa adanya', () => {
    const last = { ...base, chapter: 5 };
    expect(reopenForNewChapters(last, 6)).toEqual({ save: last, reopened: false });
    const ongoing = { ...base, finished: false, chapter: 2 };
    expect(reopenForNewChapters(ongoing, 6).save).toBe(ongoing);
    expect(reopenForNewChapters(null, 6)).toEqual({ save: null, reopened: false });
    expect(reopenForNewChapters({ ...base, chapter: 'x' }, 6).reopened).toBe(false);
  });
});
