/**
 * Overlay kecil `?perf`: baris statistik + tombol "Salin laporan", lipat, dan kotak salin manual (bila clipboard ditolak,
 * mis. http lewat IP LAN). Hanya DOM; isi baris & laporan disusun app/perfProbe.
 */
import { h } from './dom.js';
import './perf.css';

/**
 * @param {{onCopy:() => void, parent?:HTMLElement}} opts
 * @returns {{setLines(lines:string[]):void, flash(text:string):void, showText(text:string):void, dispose():void}}
 */
export function createPerfOverlay({ onCopy, parent = document.body }) {
  const lines = h('pre', 'perf-lines', { text: 'mengukur…' });
  const status = h('span', 'perf-status');
  const copyBtn = h('button', 'perf-copy', { type: 'button', text: 'Salin laporan' });
  const foldBtn = h('button', 'perf-fold', { type: 'button', text: '–', title: 'Lipat', 'aria-label': 'Lipat' });
  const manual = h('textarea', 'perf-manual', { readonly: true, rows: 6, hidden: true });
  const root = h('div', '', {
    id: 'perf-overlay',
    children: [
      h('div', 'perf-head', { children: [h('strong', '', { text: 'PERF' }), status, foldBtn] }),
      lines, h('div', 'perf-actions', { children: [copyBtn] }), manual,
    ],
  });
  // klik di overlay tidak boleh sampai ke kanvas / handler kunci pointer
  for (const type of ['pointerdown', 'click', 'wheel']) root.addEventListener(type, (e) => e.stopPropagation());
  copyBtn.addEventListener('click', () => onCopy());
  foldBtn.addEventListener('click', () => {
    const folded = root.classList.toggle('folded');
    foldBtn.textContent = folded ? '+' : '–';
  });
  parent.appendChild(root);

  let flashTimer = 0;
  return {
    setLines(next) { lines.textContent = next.join('\n'); },
    flash(text) {
      status.textContent = text;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => { status.textContent = ''; }, 4000);
    },
    showText(text) {
      manual.hidden = false;
      manual.value = text;
      manual.focus();
      manual.select();
    },
    dispose() {
      clearTimeout(flashTimer);
      root.remove();
    },
  };
}
