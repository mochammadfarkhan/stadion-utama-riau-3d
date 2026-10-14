import { Control } from './Control.js';
import { h } from '../dom.js';

const MAX_SEGMENTED = 4;

/**
 * Select: segmented control (≤4 opsi) dengan indikator geser, role="radiogroup".
 * Lebih dari 4 opsi → fallback <select> native. Label opsi dari field.labels.
 */
export class Select extends Control {
  constructor(container, opts = {}) {
    super(container, opts);
    if (!this.field) throw new Error(`Select: field tidak ditemukan untuk key "${this.key}"`);
    this.el.classList.add('ui-select');
    this.options = this.field.options ?? [];
    this.el.append(this._makeLabel());
    if (this.options.length <= MAX_SEGMENTED) this._buildSegmented();
    else this._buildNative();
    this.update();
  }

  _labelOf(opt) {
    return this.field.labels?.[opt] ?? String(opt);
  }

  _buildSegmented() {
    this.group = h('div', 'ui-seg', { role: 'radiogroup', 'aria-labelledby': `${this.id}-label` });
    this.indicator = h('span', 'ui-seg__ind', { 'aria-hidden': 'true' });
    this.group.append(this.indicator);
    this.buttons = this.options.map((opt, i) => {
      const btn = h('button', 'ui-seg__opt', {
        type: 'button', role: 'radio', 'data-value': String(opt), 'data-index': String(i),
        text: this._labelOf(opt),
      });
      btn.addEventListener('click', () => this._choose(opt));
      this.group.append(btn);
      return btn;
    });
    this.group.addEventListener('keydown', (e) => this._onKey(e));
    this.el.append(this.group);
  }

  _buildNative() {
    this.native = h('select', 'ui-native-select', { 'aria-labelledby': `${this.id}-label` });
    for (const opt of this.options) {
      this.native.append(h('option', '', { value: String(opt), text: this._labelOf(opt) }));
    }
    this.native.addEventListener('change', () => this._choose(this.native.value));
    this.el.append(this.native);
  }

  _choose(opt) {
    if (this.setValue(opt)) this.finish();
  }

  /** Panah kiri/kanan/atas/bawah memindah pilihan; Home/End ke ujung. */
  _onKey(e) {
    const n = this.options.length;
    const cur = Math.max(0, this.options.indexOf(this.value));
    const map = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (map[e.key]) next = (cur + map[e.key] + n) % n;
    else return;
    e.preventDefault();
    this._choose(this.options[next]);
    this.buttons[next]?.focus();
  }

  _paint() {
    const v = this.value;
    if (this.native) { this.native.value = String(v); return; }
    const idx = Math.max(0, this.options.indexOf(v));
    const n = this.options.length || 1;
    this.indicator.style.left = `calc(3px + ${(idx / n) * 100}% - ${(idx / n) * 6}px)`;
    this.indicator.style.width = `calc(${100 / n}% - ${6 / n}px)`;
    this.buttons.forEach((btn, i) => {
      const on = i === idx;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.setAttribute('tabindex', on ? '0' : '-1');
    });
  }
}
