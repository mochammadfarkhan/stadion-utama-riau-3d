/**
 * Dukungan gamepad (layout "standard" W3C): stick kiri / D-pad = kayuh & belok, stick kanan = lihat,
 * RT/RB = sprint, LT = rem, A = bel, X = interaksi (E), Y = ganti kamera, B = Esc, Start = jurnal, Back = panel.
 * Pemeta murni (`padToIntents`) dipisah dari poller agar mudah dites tanpa navigator.
 */
export const DEADZONE = 0.25;
const TRIGGER_THRESHOLD = 0.4;
const LOOK_PX_PER_SEC = 900; // setara ±2 rad/dtk pada sensitivitas mouse 1 (0,0022 rad/px)

const BTN = Object.freeze({ A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 });

/** Tombol aksi (sekali per penekanan) → kode tombol keyboard yang setara. */
const ACTIONS = Object.freeze([
  [BTN.A, 'Space'], [BTN.X, 'KeyE'], [BTN.Y, 'KeyV'], [BTN.B, 'Escape'], [BTN.START, 'KeyJ'], [BTN.BACK, 'KeyH'],
]);
const HELD_CODES = Object.freeze(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ShiftLeft']);

/** Buang zona mati lalu skalakan ulang agar keluaran tetap 0..1 (simetris). */
export function applyDeadzone(v, dz = DEADZONE) {
  if (!Number.isFinite(v)) return 0;
  const a = Math.abs(v);
  if (a < dz) return 0;
  return Math.sign(v) * Math.min(1, (a - dz) / (1 - dz));
}

const pressed = (pad, i) => Boolean(pad?.buttons?.[i]?.pressed);
const value = (pad, i) => pad?.buttons?.[i]?.value ?? (pressed(pad, i) ? 1 : 0);
const axis = (pad, i) => pad?.axes?.[i] ?? 0;

/**
 * Terjemahkan keadaan pad menjadi niat game.
 * @returns {{held: Record<string, boolean>, buttons: boolean[], look: {x:number, y:number}}}
 */
export function padToIntents(pad) {
  const empty = { held: Object.fromEntries(HELD_CODES.map((c) => [c, false])), buttons: [], look: { x: 0, y: 0 } };
  if (!pad || pad.connected === false) return empty;
  const lx = applyDeadzone(axis(pad, 0));
  const ly = applyDeadzone(axis(pad, 1));
  const held = {
    KeyW: ly < 0 || pressed(pad, BTN.UP),
    KeyS: ly > 0 || pressed(pad, BTN.DOWN) || value(pad, BTN.LT) > TRIGGER_THRESHOLD,
    KeyA: lx < 0 || pressed(pad, BTN.LEFT),
    KeyD: lx > 0 || pressed(pad, BTN.RIGHT),
    ShiftLeft: value(pad, BTN.RT) > TRIGGER_THRESHOLD || pressed(pad, BTN.RB),
  };
  const buttons = Array.from({ length: 17 }, (_, i) => pressed(pad, i));
  return { held, buttons, look: { x: applyDeadzone(axis(pad, 2)), y: applyDeadzone(axis(pad, 3)) } };
}

/**
 * Poller per frame: menahan/melepas tombol virtual di `input`, mengirim ketukan aksi saat
 * tombol baru ditekan, dan menggeser kamera lewat `lookBy(pxX, pxY)`.
 * @param {import('./Input.js').Input} input
 * @param {{getPads?: () => ArrayLike<any>, lookBy: (x:number, y:number) => void}} deps
 */
export function createGamepadPoller(input, { getPads = () => (typeof navigator !== 'undefined' ? navigator.getGamepads?.() ?? [] : []), lookBy }) {
  let prev = [];
  return {
    update(dt) {
      const pad = Array.from(getPads() ?? []).find((p) => p && p.connected !== false) ?? null;
      const { held, buttons, look } = padToIntents(pad);
      for (const code of HELD_CODES) input.setVirtual(code, held[code], 'gamepad');
      for (const [index, code] of ACTIONS) if (buttons[index] && !prev[index]) input.press(code);
      prev = buttons;
      if (look.x || look.y) lookBy(look.x * LOOK_PX_PER_SEC * dt, look.y * LOOK_PX_PER_SEC * dt);
    },
  };
}
