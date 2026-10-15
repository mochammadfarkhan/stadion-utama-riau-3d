/**
 * Input sederhana: keyboard + tombol virtual (sentuh/gamepad memakai kode tombol yang sama,
 * sehingga seluruh game cukup membaca `isDown`/`consumePress`).
 *
 * Penjaga: tombol game diabaikan saat fokus ada di kolom isian/select (mengetik di panel
 * tidak boleh menggerakkan sepeda), Space/Enter diabaikan saat fokus di tombol (agar tidak
 * ikut membunyikan bel), dan kombinasi Ctrl/Meta/Alt dilewati (Ctrl+R = muat ulang, bukan hujan).
 */
const FORM_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const BUTTON_IGNORED = new Set(['Space', 'Enter', 'NumpadEnter']);

/** Apakah tombol ini milik kontrol UI yang sedang fokus, bukan milik game. */
function belongsToUi(e) {
  const t = e.target;
  if (!t) return false;
  if (FORM_TAGS.has(t.tagName) || t.isContentEditable) return true;
  return t.tagName === 'BUTTON' && BUTTON_IGNORED.has(e.code);
}

export class Input {
  #keys = new Set();
  #virtual = new Map(); // kode tombol → Set sumber yang sedang menahan (touch, gamepad, ...)
  #pressedOnce = new Set();

  constructor(target = window) {
    target.addEventListener('keydown', (e) => {
      if (belongsToUi(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!this.isDown(e.code)) this.#pressedOnce.add(e.code);
      this.#keys.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.#keys.delete(e.code));
    (typeof window !== 'undefined' ? window : target).addEventListener('blur', () => this.#keys.clear());
  }

  /** Tombol sedang ditahan (keyboard ATAU virtual). */
  isDown(code) { return this.#keys.has(code) || (this.#virtual.get(code)?.size ?? 0) > 0; }

  /** true hanya pada frame pertama tombol ditekan */
  consumePress(code) {
    const hit = this.#pressedOnce.has(code);
    this.#pressedOnce.delete(code);
    return hit;
  }

  /**
   * Tahan/lepas tombol virtual dari satu `source` (joystick sentuh, stick gamepad). Tiap sumber
   * dicatat terpisah, jadi satu sumber yang melepas tidak menimpa sumber lain yang masih menahan.
   * Transisi turun→naik (belum ada yang menahan) = satu press.
   */
  setVirtual(code, down, source = 'virtual') {
    const sources = this.#virtual.get(code);
    if (down) {
      if (sources?.has(source)) return;
      if (!this.isDown(code)) this.#pressedOnce.add(code);
      if (sources) sources.add(source);
      else this.#virtual.set(code, new Set([source]));
    } else if (sources) {
      sources.delete(source);
      if (sources.size === 0) this.#virtual.delete(code);
    }
  }

  /** Satu ketukan tombol virtual (tombol layar, tombol gamepad). */
  press(code) { this.#pressedOnce.add(code); }

  endFrame() { this.#pressedOnce.clear(); }
}
