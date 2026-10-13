/** Keyboard state sederhana. Immutable snapshot via getState(). */
export class Input {
  #keys = new Set();
  #pressedOnce = new Set();

  constructor(target = window) {
    target.addEventListener('keydown', (e) => {
      if (!this.#keys.has(e.code)) this.#pressedOnce.add(e.code);
      this.#keys.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.#keys.delete(e.code));
    window.addEventListener('blur', () => this.#keys.clear());
  }

  isDown(code) { return this.#keys.has(code); }

  /** true hanya pada frame pertama tombol ditekan */
  consumePress(code) {
    const hit = this.#pressedOnce.has(code);
    this.#pressedOnce.delete(code);
    return hit;
  }

  endFrame() { this.#pressedOnce.clear(); }
}
