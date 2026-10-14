import { Control } from './Control.js';
import { h, callHook } from '../dom.js';
import { icon } from '../icons.js';

/**
 * Tombol aksi: { label, icon?, onClick, tooltip?, kind?: 'primary'|'danger' }.
 * Tidak terikat ke key store.
 */
export class Button extends Control {
  constructor(container, opts = {}) {
    super(container, { label: opts.label, tooltip: opts.tooltip });
    this.el.classList.add('ui-btn-ctl');
    this.onClick = opts.onClick ?? null;
    this.button = h('button', 'ui-btn ui-interactive', { type: 'button' });
    if (opts.kind) this.button.classList.add(`is-${opts.kind}`);
    if (opts.icon) this.button.append(h('span', 'ui-btn__ico', { html: icon(opts.icon) }));
    this.labelSpan = h('span', 'ui-btn__label', { text: this.label });
    this.button.append(this.labelSpan);
    if (this.tooltip) this.button.title = this.tooltip;
    this.button.addEventListener('click', (e) => callHook(this.onClick, e, this));
    this.el.append(this.button);
  }

  setLabel(text) {
    this.label = text;
    this.labelSpan.textContent = text;
    return this;
  }

  setEnabled(enabled) {
    this.button.disabled = !enabled;
    return super.setEnabled(enabled);
  }
}
