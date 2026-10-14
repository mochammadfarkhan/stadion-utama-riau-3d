import { Control } from './Control.js';
import { h, clamp } from '../dom.js';
import { formatValue } from '../../settings/schema.js';

const PAGE_STEPS = 10; // PageUp/PageDown = 10 langkah
const FINE_FACTOR = 0.1; // Shift saat drag = 10× lebih halus
const KEY_STEP = Object.freeze({
  ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1,
  PageUp: PAGE_STEPS, PageDown: -PAGE_STEPS,
});

/**
 * Slider custom: rail/fill/thumb dengan role="slider".
 * - Klik rail = lompat; drag dengan pointer capture; Shift = gerakan 10× halus.
 * - Keyboard: panah ±step (Shift ×10), PageUp/Down ±10 step, Home/End.
 * - Klik nilai = ketik angka (mendukung format jam "HH:MM").
 * - Fill bipolar dari 0 bila min < 0 < max. onFinishChange di pointerup/keyup/commit.
 */
export class Slider extends Control {
  constructor(container, opts = {}) {
    super(container, opts);
    if (!this.field) throw new Error(`Slider: field tidak ditemukan untuk key "${this.key}"`);
    this.el.classList.add('ui-slider-ctl');
    this.valueBtn = h('button', 'ui-ctl__value ui-interactive', {
      type: 'button',
      title: 'Klik untuk mengetik nilai',
      'aria-label': `Ketik nilai ${this.label}`,
    });
    this.el.append(this._makeLabel({ valueEl: this.valueBtn }));
    this._buildTrack();
    this._bindPointer();
    this._bindKeyboard();
    this.valueBtn.addEventListener('click', () => this._beginEdit());
    this.update();
  }

  get min() { return this.field.min; }
  get max() { return this.field.max; }
  get step() { return this.field.step || 1; }
  get range() { return this.max - this.min || 1; }

  _ratio(v) { return clamp((v - this.min) / this.range, 0, 1); }

  _buildTrack() {
    const { min, max } = this;
    this.slider = h('div', 'ui-slider', {
      role: 'slider', tabindex: 0,
      'aria-labelledby': `${this.id}-label`,
      'aria-valuemin': min, 'aria-valuemax': max,
    });
    this.rail = h('div', 'ui-slider__rail');
    this.fill = h('div', 'ui-slider__fill');
    this.mark = h('div', 'ui-slider__mark', { title: 'Default' });
    this.thumb = h('div', 'ui-slider__thumb');
    this.mark.style.left = `${this._ratio(this.field.default) * 100}%`;
    this.rail.append(this.fill, this.mark, this.thumb);
    this.slider.append(this.rail);
    this.el.append(this.slider);
  }

  _paint() {
    const v = this.value;
    const r = this._ratio(v);
    const zero = this.min < 0 && this.max > 0 ? this._ratio(0) : 0;
    this.fill.style.left = `${Math.min(zero, r) * 100}%`;
    this.fill.style.width = `${Math.abs(r - zero) * 100}%`;
    this.thumb.style.left = `${r * 100}%`;
    const text = formatValue(this.field, v);
    this.slider.setAttribute('aria-valuenow', String(v));
    this.slider.setAttribute('aria-valuetext', text);
    if (!this.input) this.valueBtn.textContent = text;
  }

  /** Nilai dari posisi X pointer relatif terhadap rail. */
  _valueFromX(clientX) {
    const rect = this.rail.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return this.min + clamp(ratio, 0, 1) * this.range;
  }

  _bindPointer() {
    const el = this.slider;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('is-dragging');
      el.focus({ preventScroll: true });
      this._drag = { x: e.clientX, v: this.value, shift: e.shiftKey, changed: false };
      if (!e.shiftKey) this._dragTo(e); // tanpa Shift: lompat ke posisi klik
    });
    el.addEventListener('pointermove', (e) => { if (this._drag) this._dragTo(e); });
    const end = (e) => {
      if (!this._drag) return;
      const { changed } = this._drag;
      this._drag = null;
      el.classList.remove('is-dragging');
      el.releasePointerCapture?.(e.pointerId);
      if (changed) this.finish();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /** Hitung nilai saat drag; Shift menggeser relatif terhadap jangkar dengan faktor halus. */
  _dragTo(e) {
    const d = this._drag;
    if (e.shiftKey !== d.shift) {
      // Shift ditekan/dilepas di tengah drag: pasang jangkar ulang agar tidak melompat
      d.shift = e.shiftKey;
      d.x = e.clientX;
      d.v = this.value;
    }
    let v;
    if (d.shift) {
      const width = this.rail.getBoundingClientRect().width || 1;
      v = d.v + ((e.clientX - d.x) / width) * this.range * FINE_FACTOR;
    } else {
      v = this._valueFromX(e.clientX);
    }
    if (this.setValue(v)) d.changed = true;
  }

  _bindKeyboard() {
    this.slider.addEventListener('keydown', (e) => {
      const next = this._keyTarget(e);
      if (next == null) return;
      e.preventDefault();
      if (this.setValue(next)) this._kbDirty = true;
    });
    this.slider.addEventListener('keyup', () => {
      if (!this._kbDirty) return;
      this._kbDirty = false;
      this.finish();
    });
  }

  /** Nilai tujuan untuk tombol keyboard, atau null bila tombol tidak dikenal. */
  _keyTarget(e) {
    if (e.key === 'Home') return this.min;
    if (e.key === 'End') return this.max;
    const steps = KEY_STEP[e.key];
    if (!steps) return null;
    const mult = e.shiftKey ? PAGE_STEPS : 1;
    return clamp(this.value + steps * mult * this.step, this.min, this.max);
  }

  /** Ganti tombol nilai dengan input teks; Enter/blur commit, Esc batal. */
  _beginEdit() {
    if (this.input) return;
    const input = h('input', 'ui-ctl__input', {
      type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false',
      'aria-label': `Nilai ${this.label}`,
      value: this.field.format === 'clock' ? formatValue(this.field, this.value) : String(this.value),
    });
    this.input = input;
    this.valueBtn.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const close = (commit) => {
      if (done) return;
      done = true;
      if (commit) this._commitEdit(input.value);
      input.replaceWith(this.valueBtn);
      this.input = null;
      this._paint();
      this.valueBtn.focus({ preventScroll: true });
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); close(true); }
      else if (e.key === 'Escape') { e.preventDefault(); close(false); }
      e.stopPropagation();
    });
    input.addEventListener('blur', () => close(true));
  }

  _commitEdit(text) {
    const parsed = parseSliderInput(text, this.field);
    if (parsed == null) return;
    if (this.setValue(parsed)) this.finish();
  }
}

/** Parse teks menjadi angka; mendukung "HH:MM" untuk format jam dan tanda % / satuan. */
export function parseSliderInput(text, field) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const clock = raw.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (field.format === 'clock' && clock) {
    return Number(clock[1]) + Number(clock[2]) / 60;
  }
  const num = Number.parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(num)) return null;
  if (field.format === 'percent' && (raw.endsWith('%') || num > 1)) return num / 100;
  return num;
}
