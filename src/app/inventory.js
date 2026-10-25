/**
 * Inventory pemain gaya Minecraft: hotbar 9 slot (tampil saat jalan kaki di luar ruangan) + tas 27 slot (tombol I).
 * Sistem 'inventory.input' (fase input, didaftarkan SEBELUM keymap): I buka/tutup tas, Esc menutup, 1–9 dan roda mouse
 * memilih slot hotbar saat jalan kaki (naik sepeda/traktor: 1–8 tetap POV). Status + kotak kiriman disimpan di
 * localStorage; tas baru berisi perlengkapan awal (cangkul, gembor, 5 benih cabai).
 */
import { ITEMS, INVENTORY, INVENTORY_SIZE, STARTER_KIT } from '../config/items.js';
import {
  createInventory, putInSlot, addItem, takeFromSlot, moveSlot, shipInto, shipValue, inventoryToJson, inventoryFromJson,
} from '../sim/inventory.js';
import { createInventoryUI } from '../ui/InventoryUI.js';

const STORAGE_KEY = 'stadion.inventory.v1';
const DIGITS = Array.from({ length: INVENTORY.hotbar }, (_, i) => `Digit${i + 1}`);

function starter() {
  return STARTER_KIT.reduce((inv, [slot, id, n]) => putInSlot(inv, slot, id, n, ITEMS), createInventory(INVENTORY_SIZE));
}

function load() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    const saved = text ? inventoryFromJson(text, INVENTORY_SIZE, ITEMS) : null;
    if (saved) return saved;
  } catch { /* penyimpanan diblokir: mulai dari perlengkapan awal */ }
  return { inv: starter(), box: Object.freeze({}) };
}

/**
 * @param {{app:{addSystem:Function, removeSystem:Function, renderer:{domElement:HTMLElement}},
 *   input:{consumePress(c:string):boolean}, rig:{mode:string, director:{active:boolean}, requestLock():void},
 *   ents:{bike:{mode:string}}, isActive:() => boolean}} opts isActive = sesi berjalan & pemain di luar ruangan
 */
export function setupInventory({ app, input, rig, ents, isActive }) {
  let { inv, box } = load();
  let selected = 0;
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, inventoryToJson(inv, box)); } catch { /* tanpa simpan */ }
  };
  const render = () => ui.render(inv, selected, ITEMS);
  const setInv = (next) => {
    if (next === inv) return;
    inv = next;
    save();
    render();
  };
  const select = (slot) => {
    selected = ((slot % INVENTORY.hotbar) + INVENTORY.hotbar) % INVENTORY.hotbar;
    render();
  };
  const setOpen = (open) => {
    if (ui.open === open) return;
    ui.setOpen(open);
    if (open) document.exitPointerLock?.();
    else rig.requestLock();
  };
  const ui = createInventoryUI({
    hotbar: INVENTORY.hotbar, size: INVENTORY_SIZE,
    onSelect: select,
    onMove: (from, to) => setInv(moveSlot(inv, from, to, ITEMS)),
    onClose: () => setOpen(false),
  });
  render();

  const onFoot = () => ents.bike.mode === 'jalan';
  const canPick = () => isActive() && onFoot() && !ui.open && !rig.director.active && rig.mode !== 'angled';
  const onWheel = (e) => { if (canPick() && e.deltaY) select(selected + Math.sign(e.deltaY)); };
  const dom = app.renderer.domElement;
  dom.addEventListener('wheel', onWheel, { passive: true });

  app.addSystem({
    id: 'inventory.input',
    phase: 'input',
    update: () => {
      const active = isActive();
      ui.setHotbarVisible(active && onFoot());
      if (!active) {
        if (ui.open) ui.setOpen(false);
        return;
      }
      if (input.consumePress('KeyI')) setOpen(!ui.open);
      if (ui.open && input.consumePress('Escape')) setOpen(false);
      if (!canPick()) return;
      const d = DIGITS.findIndex((code) => input.consumePress(code));
      if (d >= 0) select(d);
    },
  });

  return {
    get open() { return ui.open; },
    /** Definisi item di tangan (null = kosong). */
    get held() { const s = inv.slots[selected]; return s ? ITEMS[s.id] : null; },
    get heldId() { return inv.slots[selected]?.id ?? null; },
    get box() { return box; },
    /** Kurangi item di tangan sebanyak n. */
    takeHeld(n = 1) { setInv(takeFromSlot(inv, selected, n)); },
    /** Tambah item; kembalikan sisa yang tidak muat (0 = semua masuk). */
    add(id, n = 1) {
      const r = addItem(inv, id, n, ITEMS);
      setInv(r.inv);
      return r.left;
    },
    /** Pindahkan seluruh tumpukan hasil panen di tangan ke kotak kiriman; kembalikan {id, n} atau null. */
    shipHeld() {
      const s = inv.slots[selected];
      if (!s || ITEMS[s.id]?.kind !== 'crop') return null;
      box = shipInto(box, s.id, s.n);
      setInv(takeFromSlot(inv, selected, s.n));
      return { id: s.id, n: s.n };
    },
    /** Nilai kotak kiriman saat ini (Rp). */
    get boxValue() { return shipValue(box, ITEMS); },
    /** Kosongkan kotak kiriman; kembalikan nilainya (dibayar pemanggil). */
    payBox() {
      const value = shipValue(box, ITEMS);
      box = Object.freeze({});
      save();
      return value;
    },
    dispose() {
      dom.removeEventListener('wheel', onWheel);
      app.removeSystem('inventory.input');
      ui.dispose();
    },
  };
}
