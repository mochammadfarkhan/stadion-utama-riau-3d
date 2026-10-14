import { describe, it, expect } from 'vitest';
import { sanitizeSave, loadStory, saveStory, STORY_KEY } from '../src/story/storage.js';

const mem = (init = {}) => {
  const data = { ...init };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, data };
};
const LIMITS = { chapters: 5, steps: [2, 2, 2, 1, 1], eggIds: ['a', 'b'] };

describe('story storage', () => {
  it('round-trip', () => {
    const s = mem();
    const save = { version: 1, chapter: 2, step: 1, badges: ['x'], eggs: ['a'], bestLap: 41.5, rupiah: 20000, finished: false };
    saveStory(s, save);
    expect(loadStory(s, LIMITS)).toEqual(save);
  });
  it('versi salah atau JSON rusak → null', () => {
    expect(loadStory(mem({ [STORY_KEY]: '{oops' }), LIMITS)).toBeNull();
    expect(loadStory(mem({ [STORY_KEY]: JSON.stringify({ version: 99 }) }), LIMITS)).toBeNull();
  });
  it('membuang nilai di luar rentang dan id tak dikenal', () => {
    const r = sanitizeSave({ version: 1, chapter: 99, step: -3, badges: ['ok', 5], eggs: ['a', 'zzz'], bestLap: -1, rupiah: 'x', finished: 'y' }, LIMITS);
    expect(r).toEqual({ version: 1, chapter: 4, step: 0, badges: ['ok'], eggs: ['a'], bestLap: null, rupiah: 0, finished: false });
  });
  it('storage yang melempar error tidak crash', () => {
    const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('y'); } };
    expect(loadStory(bad, LIMITS)).toBeNull();
    expect(() => saveStory(bad, { version: 1 })).not.toThrow();
  });
});
