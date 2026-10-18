import { describe, it, expect } from 'vitest';
import {
  sanitizeSave, sanitizeWallet, sanitizePlace, loadStory, saveStory, migrateV1, migrateV2,
  STORY_KEY, STORY_BACKUP_KEY, SAVE_VERSION,
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
const V3 = { ...V2, version: 3, place: { region: 'stadion', x: 12.5, z: -190, yaw: 0.4 } };

describe('story storage v3 (M0 multi-region)', () => {
  it('SAVE_VERSION = 3; round-trip v3 (progres + dompet + tempat)', () => {
    const s = mem();
    saveStory(s, V3);
    expect(SAVE_VERSION).toBe(3);
    expect(loadStory(s, LIMITS)).toEqual(V3);
  });

  it('v2 → v3: progres & dompet utuh, tempat null (tanpa kehilangan progres)', () => {
    const expected = { ...V2, version: 3, place: null };
    expect(migrateV2(V2, LIMITS)).toEqual(expected);
    expect(loadStory(mem({ [STORY_KEY]: JSON.stringify(V2) }), LIMITS)).toEqual(expected);
  });

  it('v1 → v2 → v3: hadiah dikreditkan SEKALI ke saldo awal, tanpa barang', () => {
    const v1 = { version: 1, chapter: 2, step: 1, badges: ['x'], eggs: ['a'], bestLap: 41.5, rupiah: 20000, finished: false };
    expect(migrateV1(v1, LIMITS)).toEqual({ ...v1, version: 2, wallet: { balance: 70000, items: [] } });
    expect(loadStory(mem({ [STORY_KEY]: JSON.stringify(v1) }), LIMITS))
      .toEqual({ ...v1, version: 3, wallet: { balance: 70000, items: [] }, place: null });
  });

  it('tempat tidak sah dibuang (null) tanpa membuang progres; tempat sah dipangkas ke field kontrak', () => {
    for (const place of [null, 'x', { region: '', x: 0, z: 0, yaw: 0 }, { region: 'stadion', x: Number.NaN, z: 0, yaw: 0 }, { x: 1, z: 2, yaw: 0 }]) {
      expect(sanitizeSave({ ...V3, place }, LIMITS)).toEqual({ ...V3, place: null });
    }
    expect(sanitizePlace({ region: 'unri-lembaga', x: 1, z: 2, yaw: 3, extra: true })).toEqual({ region: 'unri-lembaga', x: 1, z: 2, yaw: 3 });
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

  it('v2 atau v3 dengan dompet tidak sah dianggap rusak (dicadangkan)', () => {
    for (const bad of [{ ...V2, wallet: 'x' }, { ...V3, wallet: null }]) {
      const text = JSON.stringify(bad);
      const s = mem({ [STORY_KEY]: text });
      expect(loadStory(s, LIMITS)).toBeNull();
      expect(s.data[STORY_BACKUP_KEY]).toBe(text);
    }
  });

  it('tanpa save: null tanpa cadangan', () => {
    const s = mem();
    expect(loadStory(s, LIMITS)).toBeNull();
    expect(s.data[STORY_BACKUP_KEY]).toBeUndefined();
  });

  it('membuang nilai di luar rentang, id tak dikenal, dan item dompet tak sah (v2 → v3)', () => {
    const r = sanitizeSave({
      version: 2, chapter: 99, step: -3, badges: ['ok', 5], eggs: ['a', 'zzz'], bestLap: -1, rupiah: 'x', finished: 'y',
      wallet: { balance: -50, items: [TEH, { id: 'palsu' }, null, { id: 'rujak', price: -3 }] },
    }, LIMITS);
    expect(r).toEqual({
      version: 3, chapter: 4, step: 0, badges: ['ok'], eggs: ['a'], bestLap: null, rupiah: 0, finished: false,
      wallet: { balance: 0, items: [TEH, { id: 'rujak', name: 'rujak', kind: '', price: 0 }] },
      place: null,
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
    expect(() => saveStory(bad, { version: 3 })).not.toThrow();
    const full = { getItem: () => '{oops', setItem() { throw new Error('penuh'); } };
    expect(loadStory(full, LIMITS)).toBeNull();
  });
});
