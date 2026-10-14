import { h, uid, callHook } from '../dom.js';
import { icon } from '../icons.js';

const FLASH_MS = 600;

/**
 * Kelas dasar kontrol yang terikat ke settings store.
 * opts: { key, field?, label?, tooltip?, onFinishChange? }
 * - `field` diambil dari store.field(key) bila tidak diberikan.
 * - Nilai dibaca via store.get(key) dan ditulis via store.set(key, v).
 * - Kontrol berlangganan perubahan key agar repaint otomatis; dispose() melepasnya.
 */
export class Control {
  constructor(container, opts = {}) {
    this.container = container;
    this.store = container?.store ?? opts.store ?? null;
    this.key = opts.key ?? null;
    this.field = opts.field ?? (this.key && this.store ? this.store.field(this.key) : null);
    this.label = opts.label ?? this.field?.label ?? '';
    this.tooltip = opts.tooltip ?? null;
    this.onFinishChange = opts.onFinishChange ?? null;
    this.id = uid('ctl');
    this.el = h('div', 'ui-ctl', { 'data-key': this.key ?? undefined });
    this._unsub = this.key && this.store ? this.store.subscribe(this.key, () => this.update()) : null;
    this._flashTimer = null;
    this._disposed = false;
  }

  /** Nilai saat ini dari store (undefined bila kontrol tidak punya key). */
  get value() {
    return this.key && this.store ? this.store.get(this.key) : undefined;
  }

  /** Tulis nilai ke store (divalidasi oleh skema). Mengembalikan true bila berubah. */
  setValue(v) {
    if (!this.key || !this.store) return false;
    return this.store.set(this.key, v);
  }

  /** Repaint dari store: panggil _paint() turunan lalu sinkronkan status modified. */
  update() {
    if (this._disposed) return;
    this._paint();
    this.el.classList.toggle('is-modified', this.isModified());
  }

  /** Dioverride turunan: gambar ulang tampilan dari this.value. */
  _paint() {}

  isModified() {
    if (!this.field || !this.key) return false;
    return !Object.is(this.value, this.field.default);
  }

  /** Kembalikan ke nilai default skema dan beri kilatan oranye. */
  reset() {
    if (!this.field || !this.key) return;
    const changed = this.setValue(this.field.default);
    this.flash();
    if (changed) this.finish();
  }

  /** Animasi kilat singkat (reset/preset diterapkan). */
  flash() {
    clearTimeout(this._flashTimer);
    this.el.classList.remove('is-flash');
    // paksa reflow agar animasi bisa diputar ulang
    void this.el.offsetWidth;
    this.el.classList.add('is-flash');
    this._flashTimer = setTimeout(() => this.el.classList.remove('is-flash'), FLASH_MS);
  }

  /** Dipanggil saat interaksi selesai (pointerup/keyup/commit). */
  finish() {
    callHook(this.onFinishChange, this.value, this);
  }

  get isVisible() {
    return !this.el.classList.contains('is-hidden');
  }

  setVisible(visible) {
    this.el.classList.toggle('is-hidden', !visible);
    return this;
  }

  setEnabled(enabled) {
    this.el.classList.toggle('is-disabled', !enabled);
    if (enabled) this.el.removeAttribute('aria-disabled');
    else this.el.setAttribute('aria-disabled', 'true');
    return this;
  }

  /** Lepas langganan store dan hapus elemen. Aman dipanggil lebih dari sekali. */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    clearTimeout(this._flashTimer);
    this._unsub?.();
    this._unsub = null;
    this.el.remove();
  }

  /**
   * Buat baris label: [label][tombol reset ↺][slot nilai opsional].
   * Tombol reset hanya terlihat saat is-modified; dblclick label juga mereset.
   */
  _makeLabel({ withReset = true, valueEl = null } = {}) {
    const row = h('div', 'ui-ctl__row');
    const label = h('span', 'ui-ctl__label', { id: `${this.id}-label`, text: this.label });
    if (this.tooltip) label.title = this.tooltip;
    label.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.reset();
    });
    row.append(label);
    if (withReset && this.field) {
      const reset = h('button', 'ui-ctl__reset ui-interactive', {
        type: 'button',
        'aria-label': `Reset ${this.label}`,
        title: 'Kembalikan ke default',
        html: icon('reset'),
      });
      reset.addEventListener('click', (e) => {
        e.stopPropagation();
        this.reset();
      });
      row.append(reset);
      this.resetBtn = reset;
    }
    if (valueEl) row.append(valueEl);
    this.labelEl = label;
    return row;
  }
}
