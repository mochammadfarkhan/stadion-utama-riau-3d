import { Control } from './Control.js';
import { h } from '../dom.js';

/**
 * Toggle switch: seluruh baris bisa diklik, role="switch" dengan aria-checked.
 * Space/Enter mengubah nilai saat fokus.
 */
export class Toggle extends Control {
  constructor(container, opts = {}) {
    super(container, opts);
    if (!this.field) throw new Error(`Toggle: field tidak ditemukan untuk key "${this.key}"`);
    this.el.classList.add('ui-toggle');
    this.el.setAttribute('role', 'switch');
    this.el.setAttribute('tabindex', '0');
    this.el.setAttribute('aria-labelledby', `${this.id}-label`);
    this.switchEl = h('span', 'ui-switch', { 'aria-hidden': 'true', children: [h('span', 'ui-switch__knob')] });
    this.el.append(this._makeLabel({ valueEl: this.switchEl }));
    this._bind();
    this.update();
  }

  _bind() {
    this.el.addEventListener('click', (e) => {
      // klik ke-2 dari dblclick label ditangani sebagai reset oleh Control
      if (e.detail > 1 && e.target === this.labelEl) return;
      this.toggle();
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      this.toggle();
    });
  }

  toggle() {
    if (this.setValue(!this.value)) this.finish();
  }

  _paint() {
    this.el.setAttribute('aria-checked', this.value ? 'true' : 'false');
  }
}
