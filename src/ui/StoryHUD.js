/**
 * HUD cerita: kartu tujuan aktif (judul chapter, langkah, hitung mundur, gelar) dan
 * kotak dialog bawah layar. Hanya DOM API (tanpa innerHTML data dinamis).
 */
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class StoryHUD {
  /** @param {HTMLElement} root @param {{onAdvance:()=>void}} handlers */
  constructor(root, { onAdvance }) {
    this.title = el('div', { className: 'story-title' });
    this.rank = el('div', { className: 'story-rank' });
    this.goal = el('div', { className: 'story-goal' });
    this.timer = el('div', { className: 'story-timer hidden' });
    this.card = el('div', { id: 'story-card' }, this.title, this.rank, this.goal, this.timer);
    this.dialogText = el('div', { className: 'story-dialog-text' });
    this.dialogHint = el('div', { className: 'story-dialog-hint' }, 'E / klik untuk lanjut');
    this.dialog = el('div', { id: 'story-dialog', className: 'hidden' }, this.dialogText, this.dialogHint);
    this.dialog.addEventListener('click', onAdvance);
    root.append(this.card, this.dialog);
    this._last = '';
  }

  /** @param {{chapterTitle:string, rank:string, goal:string, timeLeft:number|null, dialogLine:string|null, finished:boolean}} v */
  render(v) {
    const key = JSON.stringify([v.chapterTitle, v.rank, v.goal, v.timeLeft == null ? null : Math.floor(v.timeLeft), v.dialogLine, v.finished]);
    if (key === this._last) return;
    this._last = key;
    this.title.textContent = v.finished ? 'Cerita selesai' : v.chapterTitle;
    this.rank.textContent = `Gelar: ${v.rank}`;
    this.goal.textContent = v.finished ? 'Jelajahi bebas dan cari easter egg yang tersisa (J).' : v.goal;
    this.timer.classList.toggle('hidden', v.timeLeft == null);
    if (v.timeLeft != null) this.timer.textContent = `Sisa waktu ${clock(v.timeLeft)}`;
    this.dialog.classList.toggle('hidden', !v.dialogLine);
    this.dialogText.textContent = v.dialogLine ?? '';
  }
}
