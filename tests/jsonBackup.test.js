import { describe, it, expect } from 'vitest';
import { loadJsonWithBackup } from '../src/settings/jsonBackup.js';

const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { map: m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
const parse = (t) => { const v = JSON.parse(t); return Array.isArray(v) ? v : null; };

describe('loadJsonWithBackup', () => {
  it('data sah dikembalikan, tanpa cadangan', () => {
    const s = mem({ k: '[1,2]' });
    expect(loadJsonWithBackup(s, 'k', parse)).toEqual([1, 2]);
    expect(s.map.has('k.bak')).toBe(false);
  });
  it('rusak (lempar atau null) → null dan teks asli disalin ke .bak', () => {
    const a = mem({ k: '{bukan json' });
    expect(loadJsonWithBackup(a, 'k', parse)).toBeNull();
    expect(a.map.get('k.bak')).toBe('{bukan json');
    const b = mem({ k: '{"a":1}' });
    expect(loadJsonWithBackup(b, 'k', parse)).toBeNull();
    expect(b.map.get('k.bak')).toBe('{"a":1}');
  });
  it('kosong atau tanpa storage → null', () => {
    expect(loadJsonWithBackup(mem(), 'k', parse)).toBeNull();
    expect(loadJsonWithBackup(null, 'k', parse)).toBeNull();
  });
});

describe('SAVE_KEYS (nilai tidak boleh berubah: simpanan pemain hilang)', () => {
  it('nilai kunci tetap', async () => {
    const { SAVE_KEYS } = await import('../src/config/saveKeys.js');
    expect(SAVE_KEYS).toEqual({
      story: 'sur3d.story.v1', storyBackup: 'sur3d.story.v1.bak', settings: 'sur3d.settings.v1',
      quality: 'sur3d.quality.v1', farm: 'stadion.kebun.v1', inventory: 'stadion.inventory.v1',
    });
    const { STORY_BACKUP_KEY } = await import('../src/story/storage.js');
    expect(STORY_BACKUP_KEY).toBe(SAVE_KEYS.storyBackup);
  });
});
