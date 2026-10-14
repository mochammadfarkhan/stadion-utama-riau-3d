import { Control } from './Control.js';
import { h, callHook } from '../dom.js';

/**
 * Baris info read-only: { label, get: () => string, tooltip? }.
 * Nilai di-refresh oleh panel (tick 250 ms) lewat update().
 */
export class Info extends Control {
  constructor(container, opts = {}) {
    super(container, { label: opts.label, tooltip: opts.tooltip });
    this.el.classList.add('ui-info');
    this.get = typeof opts.get === 'function' ? opts.get : () => '';
    this.valueEl = h('span', 'ui-ctl__value ui-mono', { 'aria-live': 'off' });
    this.el.append(this._makeLabel({ withReset: false, valueEl: this.valueEl }));
    this._last = null;
    this.update();
  }

  _paint() {
    const text = String(callHook(this.get) ?? '');
    if (text === this._last) return; // hindari tulis DOM bila tidak berubah
    this._last = text;
    this.valueEl.textContent = text;
  }
}
