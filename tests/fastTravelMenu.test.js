// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { FastTravelMenu, createTravelScreen } from '../src/ui/FastTravelMenu.js';

describe('FastTravelMenu', () => {
  beforeEach(() => { document.body.replaceChildren(); });

  it('tombol HUD membuka panel; memilih tujuan menutup panel dan memanggil onTravel(id)', () => {
    const seen = [];
    const menu = new FastTravelMenu(document.body, {
      destinations: [{ id: 'stadion', label: 'Stadion Utama Riau' }, { id: 'annur', label: 'Masjid Raya An-Nur' }],
      onTravel: (id) => seen.push(id),
    });
    expect(menu.open).toBe(false);
    document.getElementById('hud-travel').click();
    expect(menu.open).toBe(true);
    document.querySelector('#fast-travel button[data-id="annur"]').click();
    expect(seen).toEqual(['annur']);
    expect(menu.open).toBe(false);
    menu.toggle();
    document.querySelector('#fast-travel .travel-close').click();
    expect(menu.open).toBe(false);
    menu.dispose();
    expect(document.getElementById('fast-travel')).toBeNull();
    expect(document.getElementById('hud-travel')).toBeNull();
  });

  it('membuka panel melepas pointer lock (G saat kursor terkunci tetap bisa memilih tujuan)', () => {
    let released = 0;
    document.exitPointerLock = () => { released += 1; };
    try {
      const menu = new FastTravelMenu(document.body, { destinations: [{ id: 'stadion', label: 'Stadion Utama Riau' }], onTravel: () => {} });
      menu.toggle();
      expect(released).toBe(1);
      menu.toggle(); // menutup: tidak melepas lagi
      expect(released).toBe(1);
      menu.dispose();
    } finally {
      delete document.exitPointerLock;
    }
  });

  it('gamepad/keyboard: membuka memfokuskan tujuan pertama; focusNext berputar; confirm memilih & menutup', () => {
    const seen = [];
    const menu = new FastTravelMenu(document.body, {
      destinations: [{ id: 'stadion', label: 'Stadion Utama Riau' }, { id: 'annur', label: 'Masjid Raya An-Nur' }],
      onTravel: (id) => seen.push(id),
    });
    menu.confirm(); // tertutup: tidak melakukan apa pun
    expect(seen).toEqual([]);
    menu.toggle();
    const btn = (id) => document.querySelector(`#fast-travel button[data-id="${id}"]`);
    expect(document.activeElement).toBe(btn('stadion'));
    expect(btn('stadion').classList.contains('selected')).toBe(true);
    menu.focusNext();
    expect(document.activeElement).toBe(btn('annur'));
    expect(btn('stadion').classList.contains('selected')).toBe(false);
    menu.focusNext();
    expect(document.activeElement).toBe(btn('stadion')); // berputar
    menu.focusNext(-1);
    expect(document.activeElement).toBe(btn('annur'));
    menu.confirm();
    expect(seen).toEqual(['annur']);
    expect(menu.open).toBe(false);
    menu.toggle(); // dibuka lagi: pilihan kembali ke tujuan pertama
    expect(document.activeElement).toBe(btn('stadion'));
    menu.dispose();
  });

  it('HP (touch): label tanpa "(G)"; desktop tetap menampilkan tombol G', () => {
    const dests = [{ id: 'stadion', label: 'Stadion Utama Riau' }];
    const touchMenu = new FastTravelMenu(document.body, { destinations: dests, onTravel: () => {}, touch: true });
    expect(document.getElementById('hud-travel').textContent).toBe('Perjalanan cepat');
    expect(document.querySelector('#fast-travel .travel-close').textContent).toBe('Tutup');
    touchMenu.dispose();
    const deskMenu = new FastTravelMenu(document.body, { destinations: dests, onTravel: () => {} });
    expect(document.getElementById('hud-travel').textContent).toBe('Perjalanan cepat (G)');
    expect(document.querySelector('#fast-travel .travel-close').textContent).toBe('Tutup (G)');
    deskMenu.dispose();
  });

  it('layar perjalanan: show/hide teks status', () => {
    const s = createTravelScreen(document.body);
    s.show('Menuju Masjid Raya An-Nur…');
    expect(s.visible).toBe(true);
    expect(document.querySelector('#travel-screen .travel-label').textContent).toBe('Menuju Masjid Raya An-Nur…');
    s.hide();
    expect(s.visible).toBe(false);
    s.dispose();
    expect(document.getElementById('travel-screen')).toBeNull();
  });
});
