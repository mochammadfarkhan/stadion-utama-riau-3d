/**
 * Kartu info barang interaktif interior (judul + teks multi-baris). DOM dibangun dengan createElement +
 * textContent — TANPA innerHTML (hook keamanan repo menolaknya; teks berasal dari data yang bisa diubah user).
 * Baris berawalan "• " tampil sebagai butir daftar. Tutup: E / Esc / Spasi (ditangani portal) atau tombol.
 */
import './infoCard.css';

export class InfoCard {
  /** @param {HTMLElement} [root] */
  constructor(root = document.body) {
    this.el = document.createElement('div');
    this.el.id = 'info-card';
    this.el.className = 'hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-live', 'polite');
    this.titleEl = document.createElement('h2');
    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'info-card-body';
    const hint = document.createElement('p');
    hint.className = 'info-card-hint';
    hint.textContent = 'E / Esc untuk menutup';
    this.closeBtn = document.createElement('button');
    this.closeBtn.type = 'button';
    this.closeBtn.className = 'info-card-close';
    this.closeBtn.textContent = 'Tutup';
    this.closeBtn.addEventListener('click', () => this.hide());
    this.el.append(this.titleEl, this.bodyEl, hint, this.closeBtn);
    root.append(this.el);
  }

  get open() { return !this.el.classList.contains('hidden'); }

  /** @param {{title?:string, text?:string}} content */
  show({ title = '', text = '' } = {}) {
    this.titleEl.textContent = String(title);
    const lines = String(text).split('\n');
    this.bodyEl.replaceChildren(...lines.map((line) => {
      const p = document.createElement('p');
      if (line.startsWith('• ')) {
        p.className = 'info-card-item';
        p.textContent = line.slice(2);
      } else {
        p.textContent = line;
      }
      return p;
    }));
    this.el.classList.remove('hidden');
  }

  hide() { this.el.classList.add('hidden'); }

  dispose() { this.el.remove(); }
}
