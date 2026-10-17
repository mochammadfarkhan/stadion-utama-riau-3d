/**
 * Menu perjalanan cepat (tombol G atau tombol HUD "Perjalanan cepat") dan layar perjalanan yang
 * menutupi dunia selama tile tujuan dimuat. Vanilla DOM, tanpa innerHTML.
 */
const el = (doc, tag, props = {}, ...children) => {
  const node = Object.assign(doc.createElement(tag), props);
  node.append(...children);
  return node;
};

export class FastTravelMenu {
  /**
   * @param {HTMLElement} root
   * @param {{destinations: Array<{id:string, label:string}>, onTravel: (id:string) => void, touch?: boolean}} opts
   *   `touch`: perangkat sentuh, label tanpa petunjuk tombol "(G)".
   */
  constructor(root, { destinations, onTravel, touch = false }) {
    const doc = root.ownerDocument ?? document;
    const key = touch ? '' : ' (G)';
    this.selected = 0;
    this.items = destinations.map((d) => {
      const b = el(doc, 'button', { type: 'button', textContent: d.label });
      b.dataset.id = d.id;
      b.addEventListener('click', () => {
        this.hide();
        onTravel(d.id);
      });
      return b;
    });
    this.list = el(doc, 'div', { className: 'travel-list' }, ...this.items);
    const close = el(doc, 'button', { type: 'button', className: 'travel-close', textContent: `Tutup${key}` });
    close.addEventListener('click', () => this.hide());
    this.panel = el(doc, 'div', { id: 'fast-travel', className: 'hidden' }, el(doc, 'h2', {}, 'Perjalanan cepat'), this.list, close);
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Perjalanan cepat');
    this.button = el(doc, 'button', { type: 'button', id: 'hud-travel', textContent: `Perjalanan cepat${key}` });
    this.button.addEventListener('click', () => this.toggle());
    root.append(this.panel, this.button);
  }

  get open() { return !this.panel.classList.contains('hidden'); }

  /**
   * Membuka melepas pointer lock (seperti toko/jurnal/panel) agar tujuan bisa diklik, dan memilih tujuan
   * pertama (keyboard/gamepad: arah ganti pilihan, A/Space konfirmasi).
   */
  toggle() {
    if (this.open) {
      this.hide();
      return;
    }
    this.panel.classList.remove('hidden');
    this.panel.ownerDocument.exitPointerLock?.();
    this.#select(0);
  }

  /** Pilih tujuan berikutnya (dir = 1) / sebelumnya (dir = −1), berputar. */
  focusNext(dir = 1) {
    if (!this.open || !this.items.length) return;
    const n = this.items.length;
    this.#select((((this.selected + Math.sign(dir || 1)) % n) + n) % n);
  }

  /** Jalankan tujuan terpilih (sama dengan mengklik tombolnya). Panel tertutup: tidak melakukan apa pun. */
  confirm() {
    if (this.open) this.items[this.selected]?.click();
  }

  hide() {
    const active = this.panel.ownerDocument.activeElement;
    if (active && this.panel.contains(active)) active.blur(); // Space tidak tertahan di tombol tersembunyi (bel)
    this.panel.classList.add('hidden');
  }

  #select(i) {
    this.selected = i;
    this.items.forEach((b, j) => b.classList.toggle('selected', j === i));
    this.items[i]?.focus({ preventScroll: true });
  }

  dispose() {
    this.panel.remove();
    this.button.remove();
  }
}

/** Layar perjalanan: overlay teks selama teleport menunggu streamer. */
export function createTravelScreen(root) {
  const doc = root.ownerDocument ?? document;
  const label = el(doc, 'p', { className: 'travel-label' });
  const box = el(doc, 'div', { id: 'travel-screen', className: 'hidden' }, label);
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  root.append(box);
  return {
    show(text) {
      label.textContent = text;
      box.classList.remove('hidden');
    },
    hide() { box.classList.add('hidden'); },
    get visible() { return !box.classList.contains('hidden'); },
    dispose() { box.remove(); },
  };
}
