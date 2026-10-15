import { describe, it, expect } from 'vitest';
import { Input } from '../src/core/Input.js';

/** Target palsu: simpan handler agar tes bisa memicu keydown/keyup/blur langsung. */
function fakeTarget() {
  const handlers = {};
  return {
    addEventListener: (type, fn) => { (handlers[type] ??= []).push(fn); },
    fire: (type, ev = {}) => (handlers[type] ?? []).forEach((fn) => fn(ev)),
  };
}
const key = (code, extra = {}) => ({ code, target: { tagName: 'BODY' }, ctrlKey: false, metaKey: false, altKey: false, ...extra });

describe('Input: keyboard', () => {
  it('isDown selama ditahan, consumePress hanya sekali', () => {
    const t = fakeTarget(); const input = new Input(t);
    t.fire('keydown', key('KeyW'));
    expect(input.isDown('KeyW')).toBe(true);
    expect(input.consumePress('KeyW')).toBe(true);
    expect(input.consumePress('KeyW')).toBe(false);
    t.fire('keyup', key('KeyW'));
    expect(input.isDown('KeyW')).toBe(false);
  });

  it('mengabaikan tombol game saat fokus di kolom input/select/textarea', () => {
    const t = fakeTarget(); const input = new Input(t);
    for (const tagName of ['INPUT', 'SELECT', 'TEXTAREA']) {
      t.fire('keydown', key('KeyW', { target: { tagName } }));
      expect(input.isDown('KeyW')).toBe(false);
    }
    t.fire('keydown', key('KeyW', { target: { tagName: 'DIV', isContentEditable: true } }));
    expect(input.isDown('KeyW')).toBe(false);
  });

  it('fokus di tombol: Space/Enter diabaikan (agar bel tidak ikut berbunyi), tombol lain tetap', () => {
    const t = fakeTarget(); const input = new Input(t);
    t.fire('keydown', key('Space', { target: { tagName: 'BUTTON' } }));
    expect(input.isDown('Space')).toBe(false);
    t.fire('keydown', key('KeyW', { target: { tagName: 'BUTTON' } }));
    expect(input.isDown('KeyW')).toBe(true);
  });

  it('kombinasi Ctrl/Meta/Alt tidak memicu hotkey game (mis. Ctrl+R muat ulang)', () => {
    const t = fakeTarget(); const input = new Input(t);
    t.fire('keydown', key('KeyR', { ctrlKey: true }));
    expect(input.consumePress('KeyR')).toBe(false);
    t.fire('keydown', key('KeyR', { metaKey: true }));
    expect(input.consumePress('KeyR')).toBe(false);
  });

  it('keyup tetap melepas tombol meski modifier ditekan, dan blur melepas semuanya', () => {
    const t = fakeTarget(); const input = new Input(t);
    t.fire('keydown', key('KeyW'));
    t.fire('keyup', key('KeyW', { ctrlKey: true }));
    expect(input.isDown('KeyW')).toBe(false);
    t.fire('keydown', key('KeyA'));
    t.fire('blur');
    expect(input.isDown('KeyA')).toBe(false);
  });
});

describe('Input: tombol virtual (sentuh/gamepad)', () => {
  it('setVirtual menahan tombol dan menghasilkan press sekali saat transisi turun→naik', () => {
    const input = new Input(fakeTarget());
    input.setVirtual('KeyW', true);
    expect(input.isDown('KeyW')).toBe(true);
    expect(input.consumePress('KeyW')).toBe(true);
    input.setVirtual('KeyW', true); // tetap ditahan: bukan press baru
    expect(input.consumePress('KeyW')).toBe(false);
    input.setVirtual('KeyW', false);
    expect(input.isDown('KeyW')).toBe(false);
  });

  it('tombol virtual dan keyboard digabung (OR): melepas salah satu tidak melepas yang lain', () => {
    const t = fakeTarget(); const input = new Input(t);
    t.fire('keydown', key('KeyW'));
    input.setVirtual('KeyW', true);
    input.setVirtual('KeyW', false);
    expect(input.isDown('KeyW')).toBe(true);
  });

  it('sumber virtual terpisah: gamepad yang melepas tidak menimpa joystick sentuh (regresi)', () => {
    const input = new Input(fakeTarget());
    input.setVirtual('KeyW', true, 'touch');
    input.setVirtual('KeyW', false, 'gamepad'); // gamepad tanpa pad melepas tiap frame
    expect(input.isDown('KeyW')).toBe(true);
    input.setVirtual('KeyW', true, 'gamepad');
    input.setVirtual('KeyW', false, 'touch');
    expect(input.isDown('KeyW')).toBe(true); // gamepad masih menahan
    input.setVirtual('KeyW', false, 'gamepad');
    expect(input.isDown('KeyW')).toBe(false);
  });

  it('press() mensimulasikan satu ketukan; endFrame menghapus sisa press', () => {
    const input = new Input(fakeTarget());
    input.press('KeyE');
    expect(input.consumePress('KeyE')).toBe(true);
    input.press('KeyJ');
    input.endFrame();
    expect(input.consumePress('KeyJ')).toBe(false);
  });
});
