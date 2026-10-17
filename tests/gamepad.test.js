import { describe, it, expect } from 'vitest';
import { applyDeadzone, padToIntents, createGamepadPoller } from '../src/core/gamepad.js';
import { Input } from '../src/core/Input.js';

const btn = (pressed = false, value = pressed ? 1 : 0) => ({ pressed, value });
function pad({ axes = [0, 0, 0, 0], pressed = [], values = {} } = {}) {
  const buttons = Array.from({ length: 17 }, (_, i) => btn(pressed.includes(i), values[i] ?? (pressed.includes(i) ? 1 : 0)));
  return { connected: true, axes, buttons };
}
const fakeTarget = () => ({ addEventListener: () => {} });

describe('applyDeadzone', () => {
  it('0 di dalam deadzone, skala lagi ke 0..1 di luarnya, simetris', () => {
    expect(applyDeadzone(0.1)).toBe(0);
    expect(applyDeadzone(-0.2)).toBe(0);
    expect(applyDeadzone(1)).toBeCloseTo(1, 6);
    expect(applyDeadzone(-1)).toBeCloseTo(-1, 6);
    expect(applyDeadzone(0.625)).toBeCloseTo(0.5, 6);
  });
  it('NaN/undefined -> 0', () => {
    expect(applyDeadzone(Number.NaN)).toBe(0);
    expect(applyDeadzone(undefined)).toBe(0);
  });
});

describe('padToIntents', () => {
  it('stick kiri: atas=W, bawah=S, kiri=A, kanan=D', () => {
    expect(padToIntents(pad({ axes: [0, -1, 0, 0] })).held).toMatchObject({ KeyW: true, KeyS: false });
    expect(padToIntents(pad({ axes: [0, 1, 0, 0] })).held).toMatchObject({ KeyS: true, KeyW: false });
    expect(padToIntents(pad({ axes: [-1, 0, 0, 0] })).held).toMatchObject({ KeyA: true, KeyD: false });
    expect(padToIntents(pad({ axes: [1, 0, 0, 0] })).held).toMatchObject({ KeyD: true, KeyA: false });
  });
  it('stick di deadzone tidak menggerakkan apa pun', () => {
    const h = padToIntents(pad({ axes: [0.1, -0.1, 0, 0] })).held;
    expect(Object.values(h).some(Boolean)).toBe(false);
  });
  it('D-pad setara stick; RT/RB = sprint; LT = rem', () => {
    expect(padToIntents(pad({ pressed: [12] })).held.KeyW).toBe(true);
    expect(padToIntents(pad({ pressed: [15] })).held.KeyD).toBe(true);
    expect(padToIntents(pad({ values: { 7: 0.8 } })).held.ShiftLeft).toBe(true);
    expect(padToIntents(pad({ pressed: [5] })).held.ShiftLeft).toBe(true);
    expect(padToIntents(pad({ values: { 6: 0.9 } })).held.KeyS).toBe(true);
  });
  it('stick kanan = arah lihat dengan deadzone', () => {
    expect(padToIntents(pad({ axes: [0, 0, 1, -1] })).look).toEqual({ x: 1, y: -1 });
    expect(padToIntents(pad({ axes: [0, 0, 0.1, 0.1] })).look).toEqual({ x: 0, y: 0 });
  });
  it('pad null/terputus/aksis hilang tidak melempar', () => {
    expect(() => padToIntents(null)).not.toThrow();
    expect(padToIntents({ connected: false, axes: [], buttons: [] }).held.KeyW).toBe(false);
    expect(() => padToIntents({ connected: true })).not.toThrow();
  });
});

describe('createGamepadPoller', () => {
  it('menahan tombol virtual sesuai stick dan melepasnya saat stick kembali', () => {
    const input = new Input(fakeTarget());
    let current = pad({ axes: [0, -1, 0, 0] });
    const poller = createGamepadPoller(input, { getPads: () => [current], lookBy: () => {} });
    poller.update(0.016);
    expect(input.isDown('KeyW')).toBe(true);
    current = pad();
    poller.update(0.016);
    expect(input.isDown('KeyW')).toBe(false);
  });

  it('tombol aksi memicu press sekali per penekanan (edge), bukan tiap frame', () => {
    const input = new Input(fakeTarget());
    let current = pad({ pressed: [2] }); // X = interaksi (E)
    const poller = createGamepadPoller(input, { getPads: () => [current], lookBy: () => {} });
    poller.update(0.016);
    expect(input.consumePress('KeyE')).toBe(true);
    poller.update(0.016);
    expect(input.consumePress('KeyE')).toBe(false);
    current = pad();
    poller.update(0.016);
    current = pad({ pressed: [2] });
    poller.update(0.016);
    expect(input.consumePress('KeyE')).toBe(true);
  });

  it('A=bel(Space), Y=kamera(V), START=jurnal(J), B=Esc', () => {
    const input = new Input(fakeTarget());
    const current = pad({ pressed: [0, 3, 9, 1] });
    createGamepadPoller(input, { getPads: () => [current], lookBy: () => {} }).update(0.016);
    for (const code of ['Space', 'KeyV', 'KeyJ', 'Escape']) expect(input.consumePress(code)).toBe(true);
  });

  it('LB = perjalanan cepat (KeyG), tidak bentrok dengan aksi lain', () => {
    const input = new Input(fakeTarget());
    const current = pad({ pressed: [4] });
    createGamepadPoller(input, { getPads: () => [current], lookBy: () => {} }).update(0.016);
    expect(input.consumePress('KeyG')).toBe(true);
    for (const code of ['Space', 'KeyE', 'KeyV', 'Escape', 'KeyJ', 'KeyH']) expect(input.consumePress(code)).toBe(false);
  });

  it('stick kanan memanggil lookBy proporsional dt; tanpa pad tidak melakukan apa pun', () => {
    const input = new Input(fakeTarget());
    const calls = [];
    const poller = createGamepadPoller(input, { getPads: () => [pad({ axes: [0, 0, 1, 0] })], lookBy: (x, y) => calls.push([x, y]) });
    poller.update(0.5);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBeCloseTo(450, 5); // 900 px/dtk × 0,5 dtk
    const idle = createGamepadPoller(input, { getPads: () => [null, undefined], lookBy: () => calls.push('x') });
    expect(() => idle.update(0.016)).not.toThrow();
    expect(calls).toHaveLength(1);
  });

  it('memakai pad terhubung pertama bila ada beberapa slot', () => {
    const input = new Input(fakeTarget());
    const poller = createGamepadPoller(input, { getPads: () => [null, pad({ axes: [0, -1, 0, 0] })], lookBy: () => {} });
    poller.update(0.016);
    expect(input.isDown('KeyW')).toBe(true);
  });
});
