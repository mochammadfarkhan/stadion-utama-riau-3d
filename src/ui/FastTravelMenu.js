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
   * @param {{destinations: Array<{id:string, label:string}>, onTravel: (id:string) => void}} opts
   */
  constructor(root, { destinations, onTravel }) {
    const doc = root.ownerDocument ?? document;
    this.list = el(doc, 'div', { className: 'travel-list' }, ...destinations.map((d) => {
      const b = el(doc, 'button', { type: 'button', textContent: d.label });
      b.dataset.id = d.id;
      b.addEventListener('click', () => {
        this.hide();
        onTravel(d.id);
      });
      return b;
    }));
    const close = el(doc, 'button', { type: 'button', className: 'travel-close', textContent: 'Tutup (G)' });
    close.addEventListener('click', () => this.hide());
    this.panel = el(doc, 'div', { id: 'fast-travel', className: 'hidden' }, el(doc, 'h2', {}, 'Perjalanan cepat'), this.list, close);
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Perjalanan cepat');
    this.button = el(doc, 'button', { type: 'button', id: 'hud-travel', textContent: 'Perjalanan cepat (G)' });
    this.button.addEventListener('click', () => this.toggle());
    root.append(this.panel, this.button);
  }

  get open() { return !this.panel.classList.contains('hidden'); }

  toggle() { this.panel.classList.toggle('hidden'); }

  hide() { this.panel.classList.add('hidden'); }

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
