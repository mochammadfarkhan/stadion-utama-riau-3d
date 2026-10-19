import { describe, expect, it } from 'vitest';
import { createSettingsStore } from '../src/settings/store.js';
import { defaultSettings } from '../src/settings/schema.js';

describe('pengaturan kamera 3/4 dan gaya grafis', () => {
  it('default: kamera orang ketiga dan gaya kartun', () => {
    const d = defaultSettings();
    expect(d['camera.mode']).toBe('third');
    expect(d['graphics.gayaGrafis']).toBe('kartun');
    expect(d['camera.angledLockYaw']).toBe(false);
    expect(d['camera.angledDistance']).toBe(24);
  });
  it('validasi: nilai tak dikenal kembali ke default, jarak dijepit', () => {
    const s = createSettingsStore({ initial: { 'camera.mode': 'angled', 'graphics.gayaGrafis': 'neon', 'camera.angledDistance': 999 } });
    expect(s.get('camera.mode')).toBe('angled');
    expect(s.get('graphics.gayaGrafis')).toBe('kartun');
    expect(s.get('camera.angledDistance')).toBe(45);
  });
  it('simpanan lama (tanpa kunci baru) dimigrasi ke default', () => {
    const s = createSettingsStore({ initial: { 'camera.mode': 'first' } });
    expect(s.get('camera.mode')).toBe('first');
    expect(s.get('graphics.gayaGrafis')).toBe('kartun');
  });
});
