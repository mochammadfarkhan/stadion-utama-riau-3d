// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TouchControls } from '../src/ui/TouchControls.js';
import { Input } from '../src/core/Input.js';

/** Event pointer palsu (jsdom tidak punya PointerEvent). */
function ptr(type, target, { x = 0, y = 0, id = 1, pointerType = 'touch' } = {}) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: x, clientY: y, pointerId: id, pointerType });
  target.dispatchEvent(e);
}

function setup() {
  document.body.replaceChildren();
  const root = document.createElement('div');
  document.body.append(root);
  const surface = document.createElement('canvas'); // permukaan kamera (kanvas)
  document.body.append(surface);
  const input = new Input({ addEventListener: () => {} });
  const looks = [];
  const rig = { lookBy: (dx, dy, scale) => looks.push([dx, dy, scale]) };
  const ui = new TouchControls(root, { input, rig, surface });
  // Basis joystick berukuran tetap agar perhitungan deterministik di jsdom.
  ui.stick.getBoundingClientRect = () => ({ left: 0, top: 0, width: 140, height: 140, right: 140, bottom: 140 });
  return { root, input, looks, ui, surface };
}

describe('TouchControls', () => {
  let ctx;
  beforeEach(() => { ctx = setup(); });

  it('tersembunyi sampai diaktifkan; setVisible mengatur kelas', () => {
    expect(ctx.ui.el.classList.contains('hidden')).toBe(true);
    ctx.ui.setVisible(true);
    expect(ctx.ui.el.classList.contains('hidden')).toBe(false);
  });

  it('joystick: geser ke atas menahan W, lepas melepaskan semua', () => {
    ctx.ui.setVisible(true);
    ptr('pointerdown', ctx.ui.stick, { x: 70, y: 70 });
    ptr('pointermove', ctx.ui.stick, { x: 70, y: 5 });
    expect(ctx.input.isDown('KeyW')).toBe(true);
    ptr('pointermove', ctx.ui.stick, { x: 135, y: 70 });
    expect(ctx.input.isDown('KeyD')).toBe(true);
    expect(ctx.input.isDown('KeyW')).toBe(false);
    ptr('pointerup', ctx.ui.stick, { x: 135, y: 70 });
    for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) expect(ctx.input.isDown(k)).toBe(false);
  });

  it('setPointerCapture yang melempar (pointer sudah tidak aktif) tidak membatalkan joystick/tombol', () => {
    ctx.ui.setVisible(true);
    const boom = () => { throw new DOMException('No active pointer', 'NotFoundError'); };
    ctx.ui.stick.setPointerCapture = boom;
    ctx.ui.buttons.sprint.setPointerCapture = boom;
    ptr('pointerdown', ctx.ui.stick, { x: 70, y: 70 });
    ptr('pointermove', ctx.ui.stick, { x: 70, y: 5 });
    expect(ctx.input.isDown('KeyW')).toBe(true);
    ptr('pointerdown', ctx.ui.buttons.sprint, {});
    expect(ctx.input.isDown('ShiftLeft')).toBe(true);
  });

  it('pointercancel juga melepas joystick', () => {
    ctx.ui.setVisible(true);
    ptr('pointerdown', ctx.ui.stick, { x: 70, y: 70 });
    ptr('pointermove', ctx.ui.stick, { x: 70, y: 135 });
    expect(ctx.input.isDown('KeyS')).toBe(true);
    ptr('pointercancel', ctx.ui.stick, {});
    expect(ctx.input.isDown('KeyS')).toBe(false);
  });

  it('tombol aksi: Bel=Space, E, Kamera=CameraCycle, Jurnal=J sebagai satu ketukan', () => {
    ctx.ui.setVisible(true);
    for (const [name, code] of [['bel', 'Space'], ['aksi', 'KeyE'], ['kamera', 'CameraCycle'], ['jurnal', 'KeyJ']]) {
      ptr('pointerdown', ctx.ui.buttons[name], {});
      ptr('pointerup', ctx.ui.buttons[name], {});
      expect(ctx.input.consumePress(code)).toBe(true);
    }
  });

  it('tombol sprint ditahan selama disentuh', () => {
    ctx.ui.setVisible(true);
    ptr('pointerdown', ctx.ui.buttons.sprint, {});
    expect(ctx.input.isDown('ShiftLeft')).toBe(true);
    ptr('pointerup', ctx.ui.buttons.sprint, {});
    expect(ctx.input.isDown('ShiftLeft')).toBe(false);
  });

  it('geser di permukaan kamera memanggil rig.lookBy dengan delta jari (hanya sentuh)', () => {
    ctx.ui.setVisible(true);
    ptr('pointerdown', ctx.surface, { x: 300, y: 200, id: 7 });
    ptr('pointermove', ctx.surface, { x: 320, y: 190, id: 7 });
    expect(ctx.looks).toHaveLength(1);
    expect(ctx.looks[0][0]).toBe(20);
    expect(ctx.looks[0][1]).toBe(-10);
    ptr('pointerup', ctx.surface, { id: 7 });
    ptr('pointerdown', ctx.surface, { x: 0, y: 0, id: 8, pointerType: 'mouse' });
    ptr('pointermove', ctx.surface, { x: 50, y: 50, id: 8, pointerType: 'mouse' });
    expect(ctx.looks).toHaveLength(1); // mouse ditangani pointer lock, bukan drag sentuh
  });

  it('menyentuh permukaan mengaktifkan UI otomatis (laptop layar sentuh)', () => {
    ptr('pointerdown', ctx.surface, { x: 1, y: 1, id: 3 });
    expect(ctx.ui.el.classList.contains('hidden')).toBe(false);
  });

  it('dispose membersihkan elemen dan melepas tombol yang tertahan', () => {
    ctx.ui.setVisible(true);
    ptr('pointerdown', ctx.ui.buttons.sprint, {});
    ctx.ui.dispose();
    expect(ctx.input.isDown('ShiftLeft')).toBe(false);
    expect(ctx.root.contains(ctx.ui.el)).toBe(false);
  });
});
