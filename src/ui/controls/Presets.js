import { Control } from './Control.js';
import { h, callHook } from '../dom.js';
import { icon } from '../icons.js';

/**
 * Grid chip preset: { label, presets: { nama: { 'grup.field': nilai, ... } }, icons?, onApply? }.
 * Klik chip = store.set untuk tiap pasangan; chip aktif bila semua nilainya cocok dengan store.
 */
export class Presets extends Control {
  constructor(container, opts = {}) {
    super(container, { label: opts.label ?? 'Preset', tooltip: opts.tooltip });
    this.el.classList.add('ui-presets');
    this.presets = Object.freeze({ ...(opts.presets ?? {}) });
    this.icons = opts.icons ?? {};
    this.onApply = opts.onApply ?? null;
    this.el.append(this._makeLabel({ withReset: false }));
    this.grid = h('div', 'ui-presets__grid', { role: 'group', 'aria-labelledby': `${this.id}-label` });
    this.chips = new Map();
    for (const name of Object.keys(this.presets)) this.grid.append(this._makeChip(name));
    this.el.append(this.grid);
    // berlangganan semua key agar status chip aktif selalu sinkron
    this._unsubAll = this.store ? this.store.subscribe('*', () => this.update()) : null;
    this.update();
  }

  _makeChip(name) {
    const chip = h('button', 'ui-chip ui-interactive', { type: 'button', 'aria-pressed': 'false', 'data-preset': name });
    if (this.icons[name]) chip.append(h('span', 'ui-chip__ico', { html: icon(this.icons[name]) }));
    chip.append(h('span', '', { text: name }));
    chip.addEventListener('click', () => this.apply(name));
    this.chips.set(name, chip);
    return chip;
  }

  /** Terapkan preset bernama `name`; mengembalikan true bila ada nilai yang berubah. */
  apply(name) {
    const values = this.presets[name];
    if (!values || !this.store) return false;
    let changed = false;
    for (const [key, value] of Object.entries(values)) {
      if (this.store.set(key, value)) changed = true;
    }
    this.flash();
    callHook(this.onApply, name, values, this);
    return changed;
  }

  /** Nama preset yang semua nilainya sama dengan state store, atau null. */
  activeName() {
    if (!this.store) return null;
    for (const [name, values] of Object.entries(this.presets)) {
      const match = Object.entries(values).every(([k, v]) => Object.is(this.store.get(k), v));
      if (match) return name;
    }
    return null;
  }

  _paint() {
    const active = this.activeName();
    for (const [name, chip] of this.chips) {
      const on = name === active;
      chip.classList.toggle('is-active', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  dispose() {
    this._unsubAll?.();
    this._unsubAll = null;
    super.dispose();
  }
}
