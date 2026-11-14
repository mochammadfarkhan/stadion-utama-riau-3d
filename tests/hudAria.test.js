// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { HUD } from '../src/ui/HUD.js';

describe('HUD: atribut pembaca layar tidak terbuang', () => {
  it('toast = status polite; prompt polite; toko = dialog berjudul', () => {
    document.body.innerHTML = '<div id="hud"></div>';
    new HUD(document.getElementById('hud'));
    const toast = document.getElementById('hud-toast');
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(document.getElementById('hud-prompt').getAttribute('aria-live')).toBe('polite');
    const shop = document.getElementById('hud-shop');
    expect(shop.getAttribute('role')).toBe('dialog');
    expect(shop.getAttribute('aria-labelledby')).toBe('hud-shop-title');
  });
});
