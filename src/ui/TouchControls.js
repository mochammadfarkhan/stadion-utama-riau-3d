/**
 * Kontrol sentuh: joystick virtual (kiri bawah → W/A/S/D), tombol aksi (Bel, E, Lari, Kamera, Jurnal),
 * dan geser jari di permukaan kamera untuk melihat sekeliling. Semuanya menulis ke `Input`
 * lewat kode tombol yang sama dengan keyboard, jadi game tidak perlu tahu sumber inputnya.
 * DOM dibangun dengan createElement (tanpa innerHTML).
 */
import { clampToRadius, joystickKeys } from './touchMath.js';

const MOVE_KEYS = Object.freeze(['KeyW', 'KeyS', 'KeyA', 'KeyD']);
const LOOK_SCALE = 1.8; // jari lebih sulit presisi daripada mouse: sedikit lebih peka

/** [id, label, kode tombol, mode]. tap = satu ketukan saat disentuh, hold = ditahan selama disentuh. */
const BUTTONS = Object.freeze([
  ['bel', 'Bel', 'Space', 'tap'],
  ['aksi', 'E', 'KeyE', 'tap'],
  ['sprint', 'Lari', 'ShiftLeft', 'hold'],
  ['kamera', 'Kamera', 'CameraCycle', 'tap'], // siklus third → first → angled
  ['jurnal', 'Jurnal', 'KeyJ', 'tap'],
]);

/** setPointerCapture melempar NotFoundError bila pointer sudah tidak aktif; itu tidak boleh membatalkan handler. */
function capture(target, pointerId) {
  try {
    target.setPointerCapture?.(pointerId);
  } catch {
    // pointer sudah lepas: abaikan, input tetap diproses tanpa capture
  }
}

const el = (tag, className, attrs = {}) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

export class TouchControls {
  /**
   * @param {HTMLElement} root tempat elemen dipasang
   * @param {{input: import('../core/Input.js').Input, rig: {lookBy:(dx:number,dy:number,scale?:number)=>void}, surface: HTMLElement}} deps
   *   surface: elemen kamera (kanvas) yang menerima geser-untuk-melihat
   */
  constructor(root, { input, rig, surface }) {
    this.input = input;
    this.rig = rig;
    this.surface = surface;
    this._abort = new AbortController();
    this._stickId = null;
    this._lookId = null;
    this._lastLook = null;

    this.el = el('div', 'hidden', { id: 'touch-ui', role: 'group', 'aria-label': 'Kontrol sentuh' });
    this.knob = el('div', 'touch-knob');
    this.stick = el('div', 'touch-stick', { role: 'application', 'aria-label': 'Joystick: kayuh dan belok' });
    this.stick.append(this.knob);
    this.buttons = {};
    const pad = el('div', 'touch-actions');
    for (const [id, label, code, mode] of BUTTONS) {
      const b = el('button', `touch-btn touch-btn-${id}`, { type: 'button', 'aria-label': label });
      b.textContent = label;
      this.#bindButton(b, code, mode);
      this.buttons[id] = b;
      pad.append(b);
    }
    this.el.append(this.stick, pad);
    root.append(this.el);

    this.#bindStick();
    this.#bindLook();
  }

  setVisible(visible) {
    this.el.classList.toggle('hidden', !visible);
    if (!visible) this.#releaseAll();
  }

  get visible() { return !this.el.classList.contains('hidden'); }

  dispose() {
    this._abort.abort();
    this.#releaseAll();
    this.el.remove();
  }

  #bindButton(button, code, mode) {
    const { signal } = this._abort;
    const down = (e) => {
      e.preventDefault();
      capture(button, e.pointerId);
      button.classList.add('active');
      if (mode === 'hold') this.input.setVirtual(code, true, 'touch');
      else this.input.press(code);
    };
    const up = () => {
      button.classList.remove('active');
      if (mode === 'hold') this.input.setVirtual(code, false, 'touch');
    };
    button.addEventListener('pointerdown', down, { signal });
    // Aktivasi lewat keyboard/switch (Enter/Space pada tombol fokus = click tanpa pointer, detail 0).
    button.addEventListener('click', (e) => { if (e.detail === 0 && mode === 'tap') this.input.press(code); }, { signal });
    button.addEventListener('pointerup', up, { signal });
    button.addEventListener('pointercancel', up, { signal });
  }

  #bindStick() {
    const { signal } = this._abort;
    const update = (e) => {
      const r = this.stick.getBoundingClientRect();
      const radius = r.width / 2;
      const dx = e.clientX - (r.left + radius);
      const dy = e.clientY - (r.top + r.height / 2);
      const k = clampToRadius(dx, dy, radius);
      this.knob.style.transform = `translate(${k.x}px, ${k.y}px)`;
      const keys = joystickKeys(dx, dy, radius);
      for (const code of MOVE_KEYS) this.input.setVirtual(code, keys[code], 'touch');
    };
    this.stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._stickId = e.pointerId;
      capture(this.stick, e.pointerId);
      update(e);
    }, { signal });
    this.stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === this._stickId) update(e);
    }, { signal });
    const end = (e) => {
      if (e.pointerId !== undefined && this._stickId !== null && e.pointerId !== this._stickId) return;
      this._stickId = null;
      this.#releaseStick();
    };
    this.stick.addEventListener('pointerup', end, { signal });
    this.stick.addEventListener('pointercancel', end, { signal });
  }

  #bindLook() {
    const { signal } = this._abort;
    this.surface.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      this.setVisible(true); // laptop layar sentuh: UI muncul saat jari pertama menyentuh
      if (this._lookId !== null) return;
      this._lookId = e.pointerId;
      this._lastLook = { x: e.clientX, y: e.clientY };
    }, { signal });
    this.surface.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._lookId || !this._lastLook) return;
      this.rig.lookBy(e.clientX - this._lastLook.x, e.clientY - this._lastLook.y, LOOK_SCALE);
      this._lastLook = { x: e.clientX, y: e.clientY };
    }, { signal });
    const end = (e) => {
      if (e.pointerId !== this._lookId) return;
      this._lookId = null;
      this._lastLook = null;
    };
    this.surface.addEventListener('pointerup', end, { signal });
    this.surface.addEventListener('pointercancel', end, { signal });
  }

  #releaseStick() {
    this.knob.style.transform = 'translate(0px, 0px)';
    for (const code of MOVE_KEYS) this.input.setVirtual(code, false, 'touch');
  }

  #releaseAll() {
    this.#releaseStick();
    this.input.setVirtual('ShiftLeft', false, 'touch');
    this._stickId = null;
    this._lookId = null;
    this._lastLook = null;
    for (const b of Object.values(this.buttons)) b.classList.remove('active');
  }
}
