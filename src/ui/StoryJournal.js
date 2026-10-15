/**
 * Jurnal cerita (tombol J): chapter selesai, lencana, easter egg ("???" sebelum
 * ditemukan), rekor putaran, dan tombol mulai ulang dengan konfirmasi dua langkah.
 */
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

const rupiah = (n) => `Rp ${n.toLocaleString('id-ID')}`;

export class StoryJournal {
  /** @param {HTMLElement} root @param {{onReset:()=>void, onClose:()=>void}} handlers */
  constructor(root, { onReset, onClose }) {
    this.body = el('div', { className: 'journal-body' });
    this.resetBtn = el('button', { className: 'journal-reset', textContent: 'Mulai ulang cerita' });
    this.resetBtn.addEventListener('click', () => this.#confirmReset(onReset));
    const close = el('button', { className: 'journal-close', textContent: 'Tutup (J)' });
    close.addEventListener('click', onClose);
    this.panel = el('div', { id: 'story-journal', className: 'hidden', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Jurnal perjalanan' },
      el('h2', {}, 'Jurnal Perjalanan'), this.body, el('div', { className: 'journal-actions' }, this.resetBtn, close));
    root.append(this.panel);
    this._armed = false;
  }

  get open() { return !this.panel.classList.contains('hidden'); }

  hide() { this.panel.classList.add('hidden'); this.#disarm(); }

  /** @param {{rank:string, rupiah:number, bestLap:number|null, chapters:{title:string,done:boolean,current:boolean}[], badges:string[], eggs:{title:string,text:string,hint:string,found:boolean}[]}} v */
  show(v) {
    this.#disarm();
    this.body.replaceChildren(
      el('p', { className: 'journal-sum' }, `Gelar: ${v.rank} · Hadiah terkumpul: ${rupiah(v.rupiah)}${v.bestLap ? ` · Rekor putaran: ${v.bestLap.toFixed(1)} dtk` : ''}`),
      el('h3', {}, 'Chapter'),
      el('ul', {}, ...v.chapters.map((c) => el('li', { className: c.done ? 'done' : c.current ? 'current' : '' }, `${c.done ? '✔' : c.current ? '▶' : '○'} ${c.title}`))),
      el('h3', {}, 'Lencana'),
      el('p', {}, v.badges.length ? v.badges.join(' · ') : 'Belum ada lencana'),
      el('h3', {}, `Easter egg (${v.eggs.filter((e) => e.found).length}/${v.eggs.length})`),
      el('ul', {}, ...v.eggs.map((e) => el('li', { className: e.found ? 'done' : '' },
        e.found ? `★ ${e.title} — ${e.text}` : `? ??? — ${e.hint}`))),
    );
    this.panel.classList.remove('hidden');
  }

  #confirmReset(onReset) {
    if (!this._armed) {
      this._armed = true;
      this.resetBtn.textContent = 'Yakin? Klik lagi untuk menghapus progres';
      return;
    }
    this.#disarm();
    onReset();
  }

  #disarm() {
    this._armed = false;
    this.resetBtn.textContent = 'Mulai ulang cerita';
  }
}
