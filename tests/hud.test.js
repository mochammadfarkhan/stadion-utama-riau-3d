// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { HUD } from '../src/ui/HUD.js';

function makeHud() {
  document.body.innerHTML = '<div id="hud"></div>';
  const hud = new HUD(document.getElementById('hud'));
  const toasts = [];
  hud.toast = (text, ok = true) => toasts.push([text, ok]);
  return { hud, toasts, byId: (id) => document.getElementById(id) };
}

describe('HUD: baris kamera', () => {
  let k;
  beforeEach(() => { k = makeHud(); });

  it('tanpa POV: baris kamera tersembunyi; panggilan pertama tidak memunculkan toast', () => {
    k.hud.setCameraView('third', null, false);
    expect(k.byId('hud-cam').classList.contains('hidden')).toBe(true);
    expect(k.toasts).toEqual([]);
  });

  it('ganti mode kamera: toast sekali, tidak berulang tiap frame', () => {
    k.hud.setCameraView('third', null, false);
    k.hud.setCameraView('first', null, false);
    k.hud.setCameraView('first', null, false);
    expect(k.toasts).toEqual([['Kamera: orang pertama', true]]);
  });

  it('POV aktif: baris kamera tampil dengan petunjuk keluar', () => {
    k.hud.setCameraView('third', 'Kota', true);
    expect(k.byId('hud-cam').classList.contains('hidden')).toBe(false);
    expect(k.byId('hud-cam').textContent).toBe('POV: Kota (sepeda dibekukan · V/0 kembali)');
  });
});

describe('HUD: skor', () => {
  it('setScoreVisible menyembunyikan/menampilkan pil skor', () => {
    const { hud, byId } = makeHud();
    hud.setScoreVisible(false);
    expect(byId('hud-score').classList.contains('hidden')).toBe(true);
    hud.setScoreVisible(true);
    expect(byId('hud-score').classList.contains('hidden')).toBe(false);
  });
});
