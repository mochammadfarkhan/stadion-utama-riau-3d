/**
 * UI inventory gaya Minecraft: hotbar 9 slot di bawah layar (klik/tap = pilih) + panel tas (tombol I) berisi 27 slot
 * tas dan 9 slot hotbar; klik item lalu klik slot tujuan = pindah / gabung / tukar. Murni tampilan: status inventory
 * dan aturan pindah ada di sim/inventory.js; perubahan dilaporkan lewat callback. Tanpa innerHTML dari data.
 */
import { h } from './dom.js';
import './inventory.css';

/**
 * @param {{hotbar:number, size:number, root?:HTMLElement, onSelect?:(slot:number)=>void,
 *   onMove?:(from:number, to:number)=>void, onClose?:()=>void}} opts
 */
export function createInventoryUI({ hotbar, size, root = document.body, onSelect = () => {}, onMove = () => {}, onClose = () => {} }) {
  const makeSlot = (i, showKey) => {
    const btn = h('button', 'inv-slot', { type: 'button', 'data-slot': i });
    btn.append(h('span', 'inv-icon'), h('span', 'inv-count'));
    if (showKey) btn.append(h('span', 'inv-key', { text: i + 1 }));
    return btn;
  };
  const heldName = h('div', 'inv-held hidden', { id: 'hotbar-held', 'aria-live': 'polite' });
  const bar = h('div', 'inv-row', { id: 'hotbar', role: 'toolbar', 'aria-label': 'Hotbar' });
  const barSlots = Array.from({ length: hotbar }, (_, i) => makeSlot(i, true));
  bar.append(...barSlots);
  const barWrap = h('div', 'hidden', { id: 'hotbar-wrap', children: [heldName, bar] });

  const bag = h('div', 'inv-grid');
  const hot = h('div', 'inv-grid inv-grid-hot');
  const panelSlots = Array.from({ length: size }, (_, i) => makeSlot(i, i < hotbar));
  bag.append(...panelSlots.slice(hotbar));
  hot.append(...panelSlots.slice(0, hotbar));
  const info = h('p', 'inv-info', { text: ' ' });
  const close = h('button', 'inv-close', { type: 'button', text: 'Tutup (I)' });
  const panel = h('div', 'hidden', {
    id: 'inventory-panel', role: 'dialog', 'aria-label': 'Tas',
    children: [h('h2', '', { text: 'Tas' }), bag, h('div', 'inv-sep', { text: 'Hotbar' }), hot, info,
      h('p', 'inv-hint', { text: 'Klik item lalu klik slot tujuan: pindah, gabung, atau tukar. Esc / I untuk menutup.' }), close],
  });
  root.append(barWrap, panel);

  let picked = null;
  let state = { inv: null, selected: 0, defs: {} };
  let heldTimer = 0;

  const fill = (btn, s, defs) => {
    const def = s ? defs[s.id] : null;
    btn.querySelector('.inv-icon').textContent = def?.icon ?? '';
    btn.querySelector('.inv-count').textContent = s && s.n > 1 ? String(s.n) : '';
    btn.dataset.kind = def?.kind ?? '';
    btn.title = def ? `${def.label}${s.n > 1 ? ` ×${s.n}` : ''}` : '';
    btn.setAttribute('aria-label', btn.title || `Slot ${Number(btn.dataset.slot) + 1} kosong`);
  };

  function render(inv, selected, defs) {
    const prevHeld = state.inv?.slots[state.selected]?.id ?? null;
    state = { inv, selected, defs };
    barSlots.forEach((b, i) => {
      fill(b, inv.slots[i], defs);
      b.classList.toggle('selected', i === selected);
    });
    panelSlots.forEach((b, i) => {
      fill(b, inv.slots[i], defs);
      b.classList.toggle('selected', i === selected);
      b.classList.toggle('picked', i === picked);
    });
    const held = inv.slots[selected];
    info.textContent = held ? `Dipegang: ${defs[held.id].label}${held.n > 1 ? ` ×${held.n}` : ''}` : 'Dipegang: tangan kosong';
    if ((held?.id ?? null) !== prevHeld) { // nama item muncul sebentar di atas hotbar saat berganti (seperti Minecraft)
      heldName.textContent = held ? defs[held.id].label : 'Tangan kosong';
      heldName.classList.remove('hidden');
      clearTimeout(heldTimer);
      heldTimer = setTimeout(() => heldName.classList.add('hidden'), 1500);
    }
  }

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('.inv-slot');
    if (btn) onSelect(Number(btn.dataset.slot));
  });
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('.inv-slot');
    if (!btn) return;
    const i = Number(btn.dataset.slot);
    if (picked === null) {
      if (state.inv?.slots[i]) picked = i;
    } else {
      const from = picked;
      picked = null;
      if (from !== i) onMove(from, i);
    }
    if (state.inv) render(state.inv, state.selected, state.defs);
  });
  close.addEventListener('click', () => onClose());

  return {
    render,
    get open() { return !panel.classList.contains('hidden'); },
    setOpen(open) {
      panel.classList.toggle('hidden', !open);
      picked = null;
      if (state.inv) render(state.inv, state.selected, state.defs);
    },
    setHotbarVisible(visible) {
      barWrap.classList.toggle('hidden', !visible);
      document.body.classList.toggle('has-hotbar', visible);
    },
    dispose() {
      clearTimeout(heldTimer);
      document.body.classList.remove('has-hotbar');
      barWrap.remove();
      panel.remove();
    },
  };
}
