import { describe, it, expect } from 'vitest';
import { routeEscape } from '../src/core/escapeRoute.js';

describe('routeEscape', () => {
  it('jurnal terbuka -> tutup jurnal (prioritas)', () => {
    expect(routeEscape({ journalOpen: true, shopOpen: true })).toBe('journal');
  });
  it('toko terbuka -> tutup toko', () => {
    expect(routeEscape({ journalOpen: false, shopOpen: true })).toBe('shop');
  });
  it('panel perjalanan cepat terbuka -> tutup panel (di bawah jurnal & toko)', () => {
    expect(routeEscape({ journalOpen: false, shopOpen: false, travelOpen: true })).toBe('travel');
    expect(routeEscape({ journalOpen: false, shopOpen: true, travelOpen: true })).toBe('shop');
    expect(routeEscape({ journalOpen: true, shopOpen: false, travelOpen: true })).toBe('journal');
  });
  it('tidak ada yang terbuka -> tidak melakukan apa pun (jangan membuka toko)', () => {
    expect(routeEscape({ journalOpen: false, shopOpen: false })).toBeNull();
  });
});
