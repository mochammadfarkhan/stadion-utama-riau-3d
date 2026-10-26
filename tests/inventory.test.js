import { describe, it, expect } from 'vitest';
import {
  createInventory, putInSlot, addItem, takeFromSlot, removeItem, countItem, moveSlot, shipInto, shipValue, inventoryToJson, inventoryFromJson,
} from '../src/sim/inventory.js';
import { ITEMS, INVENTORY, INVENTORY_SIZE, STARTER_KIT } from '../src/config/items.js';
import { CROPS, CROP_ORDER } from '../src/config/kebun.js';
import { HELD_MODELS, heldModelKey } from '../src/world/props/unri/heldItems.js';

const fresh = () => createInventory(INVENTORY_SIZE);

describe('inventory: tumpukan', () => {
  it('menambah mengisi tumpukan sejenis dulu, lalu slot kosong pertama (hotbar dulu)', () => {
    let inv = putInSlot(fresh(), 3, 'cabai', 60, ITEMS);
    inv = addItem(inv, 'cabai', 10, ITEMS).inv;
    expect(inv.slots[3]).toEqual({ id: 'cabai', n: 64 });
    expect(inv.slots[0]).toEqual({ id: 'cabai', n: 6 });
    expect(countItem(inv, 'cabai')).toBe(70);
  });

  it('alat tidak bertumpuk; tas penuh mengembalikan sisa tanpa mengubah apa pun', () => {
    let inv = addItem(fresh(), 'cangkul', 2, ITEMS).inv;
    expect(inv.slots[0]).toEqual({ id: 'cangkul', n: 1 });
    expect(inv.slots[1]).toEqual({ id: 'cangkul', n: 1 });
    let full = fresh();
    for (let i = 0; i < INVENTORY_SIZE; i += 1) full = putInSlot(full, i, 'gembor', 1, ITEMS);
    const r = addItem(full, 'cabai', 3, ITEMS);
    expect(r.left).toBe(3);
    expect(r.inv).toBe(full);
    expect(addItem(fresh(), 'kentang', 1, ITEMS).left).toBe(1);
  });

  it('ambil dari slot mengosongkan bila habis; immutable', () => {
    const inv = putInSlot(fresh(), 0, 'benih-jagung', 2, ITEMS);
    const one = takeFromSlot(inv, 0);
    expect(one.slots[0]).toEqual({ id: 'benih-jagung', n: 1 });
    expect(takeFromSlot(one, 0).slots[0]).toBeNull();
    expect(inv.slots[0].n).toBe(2);
    expect(() => { inv.slots[0].n = 9; }).toThrow();
  });
});

describe('inventory: ambil per jenis', () => {
  it('slot pilihan lebih dulu, lalu urut indeks; kurang = null tanpa perubahan', () => {
    const inv = putInSlot(putInSlot(fresh(), 1, 'benih-cabai', 2, ITEMS), 5, 'benih-cabai', 3, ITEMS);
    const a = removeItem(inv, 'benih-cabai', 1, 5);
    expect(a.slots[5]).toEqual({ id: 'benih-cabai', n: 2 });
    expect(a.slots[1]).toEqual({ id: 'benih-cabai', n: 2 });
    const b = removeItem(inv, 'benih-cabai', 4, 5);
    expect(b.slots[5]).toBeNull();
    expect(b.slots[1]).toEqual({ id: 'benih-cabai', n: 1 });
    expect(removeItem(inv, 'benih-cabai', 6)).toBeNull();
    expect(countItem(inv, 'benih-cabai')).toBe(5);
  });
});

describe('inventory: pindah slot', () => {
  it('ke kosong = pindah, sejenis = gabung (sisa tetap), beda = tukar', () => {
    let inv = putInSlot(putInSlot(fresh(), 0, 'cabai', 50, ITEMS), 1, 'cabai', 30, ITEMS);
    inv = moveSlot(inv, 1, 0, ITEMS);
    expect(inv.slots[0]).toEqual({ id: 'cabai', n: 64 });
    expect(inv.slots[1]).toEqual({ id: 'cabai', n: 16 });
    inv = moveSlot(inv, 1, 20, ITEMS);
    expect(inv.slots[1]).toBeNull();
    expect(inv.slots[20]).toEqual({ id: 'cabai', n: 16 });
    inv = putInSlot(inv, 5, 'cangkul', 1, ITEMS);
    inv = moveSlot(inv, 5, 20, ITEMS);
    expect(inv.slots[5]).toEqual({ id: 'cabai', n: 16 });
    expect(inv.slots[20]).toEqual({ id: 'cangkul', n: 1 });
  });
});

describe('inventory: kotak kiriman & simpanan', () => {
  it('nilai kiriman = jumlah × harga jual hasil panen', () => {
    const box = shipInto(shipInto(shipInto({}, 'cabai', 2), 'jagung', 1), 'cabai', 1);
    expect(box).toEqual({ cabai: 3, jagung: 1 });
    expect(shipValue(box, ITEMS)).toBe(3 * CROPS.cabai.price + CROPS.jagung.price);
    expect(shipValue({ cangkul: 1 }, ITEMS)).toBe(0);
  });

  it('JSON pulang-pergi; id asing/jumlah salah dibuang; teks rusak → null', () => {
    const inv = putInSlot(putInSlot(fresh(), 0, 'cangkul', 1, ITEMS), 9, 'benih-terong', 12, ITEMS);
    const back = inventoryFromJson(inventoryToJson(inv, { cabai: 2 }), INVENTORY_SIZE, ITEMS);
    expect(back.inv.slots).toEqual(inv.slots);
    expect(back.box).toEqual({ cabai: 2 });
    const dirty = inventoryFromJson(JSON.stringify({ slots: [['kentang', 1], ['cabai', -2], ['cabai', 999]], box: { emas: 5 } }), INVENTORY_SIZE, ITEMS);
    expect(dirty.inv.slots.slice(0, 3)).toEqual([null, null, { id: 'cabai', n: INVENTORY.stack }]);
    expect(dirty.box).toEqual({});
    expect(inventoryFromJson('{rusak', INVENTORY_SIZE, ITEMS)).toBeNull();
  });
});

describe('items: data', () => {
  it('tiap jenis tanaman punya benih (harga beli) dan hasil (harga jual); perlengkapan awal valid', () => {
    for (const c of CROP_ORDER) {
      expect(ITEMS[`benih-${c}`]).toMatchObject({ kind: 'seed', crop: c, price: CROPS[c].seed });
      expect(ITEMS[c]).toMatchObject({ kind: 'crop', crop: c, sell: CROPS[c].price });
    }
    for (const [slot, id] of STARTER_KIT) {
      expect(ITEMS[id]).toBeTruthy();
      expect(slot).toBeLessThan(INVENTORY.hotbar);
    }
  });
});

describe('item di tangan', () => {
  it('setiap item punya model tangan; tangan kosong = null', () => {
    for (const [id, def] of Object.entries(ITEMS)) expect(HELD_MODELS[heldModelKey(def)], id).toBeTruthy();
    expect(heldModelKey(null)).toBeNull();
  });
});
