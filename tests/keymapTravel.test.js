import { describe, it, expect } from 'vitest';
import { Input } from '../src/core/Input.js';
import { handleKeys } from '../src/app/keymap.js';

/** Panel perjalanan cepat tiruan: mencatat panggilan. */
function fakeMenu() {
  const calls = [];
  return {
    calls,
    open: false,
    toggle() { this.open = !this.open; calls.push(this.open ? 'buka' : 'tutup'); },
    hide() { this.open = false; calls.push('hide'); },
    focusNext(dir = 1) { calls.push(`next:${dir}`); },
    confirm() { calls.push('confirm'); },
  };
}

function setup() {
  const input = new Input(new EventTarget());
  const travelMenu = fakeMenu();
  const deps = {
    rig: { povId: null, mode: 'third', freezesBike: false, handlePovKey: () => null, exitPov: () => false },
    hud: { shopOpen: false, toast: () => {} },
    ents: { bike: { state: { x: 0, z: 0 } } },
    shop: {},
    time: { hour: 12 },
    store: { get: () => false, set: () => {} },
    story: { journal: { open: false }, toggleJournal: () => {}, tryInteract: () => false },
    frame: { toLocal: (x, z) => ({ x, z }), placement: { x: 0, z: 0, yaw: 0 } },
    travelMenu,
  };
  const frameWith = (...codes) => {
    for (const c of codes) input.press(c);
    handleKeys(input, deps);
    input.endFrame();
  };
  return { travelMenu, frameWith };
}

describe('keymap: panel perjalanan cepat (keyboard & gamepad)', () => {
  it('panel tertutup: arah/Space/Esc tidak menyentuh panel; G (atau LB) membuka', () => {
    const { travelMenu, frameWith } = setup();
    frameWith('KeyS', 'Space', 'Escape');
    expect(travelMenu.calls).toEqual([]);
    frameWith('KeyG');
    expect(travelMenu.calls).toEqual(['buka']);
  });

  it('panel terbuka: W/S/panah ganti pilihan, Space (A) konfirmasi, Esc (B) menutup, G menutup', () => {
    const { travelMenu, frameWith } = setup();
    frameWith('KeyG');
    frameWith('KeyS');
    frameWith('ArrowUp');
    frameWith('KeyD');
    frameWith('Space');
    expect(travelMenu.calls).toEqual(['buka', 'next:1', 'next:-1', 'next:1', 'confirm']);
    travelMenu.open = true;
    frameWith('Escape');
    expect(travelMenu.calls.at(-1)).toBe('hide');
    frameWith('KeyG', 'KeyG');
    expect(travelMenu.calls.at(-1)).toBe('buka');
    frameWith('KeyG');
    expect(travelMenu.calls.at(-1)).toBe('tutup');
  });
});
