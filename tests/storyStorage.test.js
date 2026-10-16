import { describe, it, expect } from 'vitest';
import {
  sanitizeSave, sanitizeWallet, loadStory, saveStory, migrateV1, STORY_KEY, STORY_BACKUP_KEY, SAVE_VERSION,
} from '../src/story/storage.js';

const mem = (init = {}) => {
  const data = { ...init };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, data };
};
const LIMITS = { chapters: 5, steps: [2, 2, 2, 1, 1], eggIds: ['a', 'b'], startBalance: 50000, itemIds: ['es-teh', 'rujak'] };
const TEH = { id: 'es-teh', name: 'Es Teh', kind: 'minuman', price: 5000 };
const V2 = {
  version: 2, chapter: 2, step: 1, badges: ['x'], eggs: ['a'], bestLap: 41.5, rupiah: 20000, finished: false,
  wallet: { balance: 31000, items: [TEH] },
};

describe('story storage v2', () => {
  it('round-trip v2 (progres + dompet)', () => {
    const s = mem();
    saveStory(s, V2);
    expect(SAVE_VERSION).toBe(2);
    expect(loadStory(s, LIMITS)).toEqual(V2);
  });

  it('v1 dimigrasi: hadiah dikreditkan SEKALI ke saldo awal, tanpa barang', () => {
    const v1 = { version: 1, chapter: 2, step: 1, badges: ['x'], eggs: ['a'], bestLap: 41.5, rupiah: 20000, finished: false };
    const expected = { ...v1, version: 2, wallet: { balance: 70000, items: [] } };
    expect(migrateV1(v1, LIMITS)).toEqual(expected);
    expect(loadStory(mem({ [STORY_KEY]: JSON.stringify(v1) }), LIMITS)).toEqual(expected);
  });

  it('JSON rusak atau versi tak dikenal → null dan teks asli dicadangkan ke .bak', () => {
    expect(STORY_BACKUP_KEY).toBe(`${STORY_KEY}.bak`);
    const broken = mem({ [STORY_KEY]: '{oops' });
    expect(loadStory(broken, LIMITS)).toBeNull();
    expect(broken.data[STORY_BACKUP_KEY]).toBe('{oops');
    const future = JSON.stringify({ version: 99 });
    const unknown = mem({ [STORY_KEY]: future });
    expect(loadStory(unknown, LIMITS)).toBeNull();
    expect(unknown.data[STORY_BACKUP_KEY]).toBe(future);
  });

  it('v2 dengan dompet tidak sah dianggap rusak (dicadangkan)', () => {
    const text = JSON.stringify({ ...V2, wallet: 'x' });
    const s = mem({ [STORY_KEY]: text });
    expect(loadStory(s, LIMITS)).toBeNull();
    expect(s.data[STORY_BACKUP_KEY]).toBe(text);
  });

  it('tanpa save: null tanpa cadangan', () => {
    const s = mem();
    expect(loadStory(s, LIMITS)).toBeNull();
    expect(s.data[STORY_BACKUP_KEY]).toBeUndefined();
  });

  it('membuang nilai di luar rentang, id tak dikenal, dan item dompet tak sah', () => {
    const r = sanitizeSave({
      version: 2, chapter: 99, step: -3, badges: ['ok', 5], eggs: ['a', 'zzz'], bestLap: -1, rupiah: 'x', finished: 'y',
      wallet: { balance: -50, items: [TEH, { id: 'palsu' }, null, { id: 'rujak', price: -3 }] },
    }, LIMITS);
    expect(r).toEqual({
      version: 2, chapter: 4, step: 0, badges: ['ok'], eggs: ['a'], bestLap: null, rupiah: 0, finished: false,
      wallet: { balance: 0, items: [TEH, { id: 'rujak', name: 'rujak', kind: '', price: 0 }] },
    });
    expect(sanitizeSave(null, LIMITS)).toBeNull();
  });

  it('sanitizeWallet tanpa daftar id menerima item ber-id string', () => {
    expect(sanitizeWallet({ balance: 10.7, items: [{ id: 'apa', name: 'Apa', kind: 'buah', price: 1 }] }))
      .toEqual({ balance: 10, items: [{ id: 'apa', name: 'Apa', kind: 'buah', price: 1 }] });
    expect(sanitizeWallet(null)).toBeNull();
  });

  it('storage yang melempar, null, atau gagal menulis cadangan tidak crash', () => {
    const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('y'); } };
    expect(loadStory(bad, LIMITS)).toBeNull();
    expect(loadStory(null, LIMITS)).toBeNull();
    expect(() => saveStory(bad, { version: 2 })).not.toThrow();
    const full = { getItem: () => '{oops', setItem() { throw new Error('penuh'); } };
    expect(loadStory(full, LIMITS)).toBeNull();
  });
});
