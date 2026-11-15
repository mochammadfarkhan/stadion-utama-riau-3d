/**
 * HUD cerita: kartu tujuan aktif (judul chapter, langkah, hitung mundur, gelar) dan
 * kotak dialog bawah layar. Hanya DOM API (tanpa innerHTML data dinamis).
 */
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

import { formatDistance } from '../story/goalInfo.js';

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class StoryHUD {
  /** @param {HTMLElement} root @param {{onAdvance:()=>void}} handlers */
  constructor(root, { onAdvance }) {
    this.title = el('div', { className: 'story-title' });
    this.rank = el('div', { className: 'story-rank' });
    this.goal = el('div', { className: 'story-goal' });
    this.timer = el('div', { className: 'story-timer hidden' });
    this.arrow = el('span', { className: 'story-arrow', ariaHidden: 'true' }, '▲');
    this.dist = el('span', { className: 'story-dist' });
    this.where = el('div', { className: 'story-where hidden' }, this.arrow, this.dist);
    this._whereText = null;
    this._whereAngle = null;
    this.card = el('div', { id: 'story-card' }, this.title, this.rank, this.goal, this.where, this.timer);
    this.dialogText = el('div', { className: 'story-dialog-text' });
    this.dialogHint = el('div', { className: 'story-dialog-hint' }, 'E / klik untuk lanjut');
    this.dialog = el('div', { id: 'story-dialog', className: 'hidden' }, this.dialogText, this.dialogHint);
    this.dialog.addEventListener('click', onAdvance);
    root.append(this.card, this.dialog);
    this._last = '';
  }

  /**
   * Jarak + panah arah ke tujuan (null = sembunyikan). bearing: rad relatif arah hadap, positif = kiri (goalInfo.relativeBearing).
   * DOM ditulis hanya bila teks berubah atau sudut berubah > 0,05 rad.
   */
  setGoalInfo(info) {
    const text = info ? formatDistance(info.distance) : null;
    if (text !== this._whereText) {
      this._whereText = text;
      this.where.classList.toggle('hidden', text == null);
      this.dist.textContent = text ?? '';
    }
    if (!info) { this._whereAngle = null; return; }
    if (this._whereAngle == null || Math.abs(info.bearing - this._whereAngle) > 0.05) {
      this._whereAngle = info.bearing;
      this.arrow.style.transform = `rotate(${(-info.bearing).toFixed(2)}rad)`;
    }
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
