/**
 * Inventory gaya Minecraft (MURNI, immutable): array slot tetap, tiap slot null atau {id, n}. Slot 0..hotbar-1 = hotbar.
 * Tabel item (`defs`: id → {stack}) diberikan pemanggil (config/items.js ITEMS). Penambahan mengisi tumpukan sejenis
 * lebih dulu lalu slot kosong (hotbar dulu, seperti Minecraft); pindah slot = pindah / gabung tumpukan / tukar.
 * Kotak kiriman = peta id → jumlah (nilai jual dibayar saat tidur).
 */

const stackOf = (defs, id) => Math.max(1, defs[id]?.stack ?? 1);
const freezeSlots = (slots) => Object.freeze(slots.map((s) => (s ? Object.freeze({ id: s.id, n: s.n }) : null)));

/** @param {number} size jumlah slot */
export function createInventory(size) {
  return Object.freeze({ slots: Object.freeze(Array(size).fill(null)) });
}

/** Isi slot tertentu (untuk perlengkapan awal); id tak dikenal / jumlah tidak valid diabaikan. */
export function putInSlot(inv, slot, id, n, defs) {
  if (!defs[id] || !(n > 0) || slot < 0 || slot >= inv.slots.length) return inv;
  const slots = inv.slots.slice();
  slots[slot] = { id, n: Math.min(Math.floor(n), stackOf(defs, id)) };
  return Object.freeze({ ...inv, slots: freezeSlots(slots) });
}

/**
 * Tambah `n` item `id`. Kembalikan {inv, left} (left = sisa yang tidak muat; 0 bila semua masuk).
 * Inventory sama dikembalikan bila tidak ada yang masuk.
 */
export function addItem(inv, id, n, defs) {
  if (!defs[id] || !(n > 0)) return { inv, left: Math.max(0, n || 0) };
  const max = stackOf(defs, id);
  const slots = inv.slots.map((s) => (s ? { ...s } : null));
  let left = Math.floor(n);
  for (const s of slots) {
    if (left === 0) break;
    if (s?.id !== id || s.n >= max) continue;
    const put = Math.min(max - s.n, left);
    s.n += put;
    left -= put;
  }
  for (let i = 0; i < slots.length && left > 0; i += 1) {
    if (slots[i]) continue;
    const put = Math.min(max, left);
    slots[i] = { id, n: put };
    left -= put;
  }
  if (left === Math.floor(n)) return { inv, left };
  return { inv: Object.freeze({ ...inv, slots: freezeSlots(slots) }), left };
}

/** Kurangi `n` dari satu slot (slot kosong bila habis). */
export function takeFromSlot(inv, slot, n = 1) {
  const s = inv.slots[slot];
  if (!s || !(n > 0)) return inv;
  const slots = inv.slots.slice();
  slots[slot] = s.n > n ? { id: s.id, n: s.n - n } : null;
  return Object.freeze({ ...inv, slots: freezeSlots(slots) });
}

/** Jumlah total item `id` di semua slot. */
export function countItem(inv, id) {
  return inv.slots.reduce((t, s) => t + (s?.id === id ? s.n : 0), 0);
}

/**
 * Pindahkan isi slot `from` ke `to`: ke slot kosong = pindah; sejenis & bisa bertumpuk = gabung (sisa tetap di asal);
 * selain itu = tukar.
 */
export function moveSlot(inv, from, to, defs) {
  const a = inv.slots[from];
  if (!a || from === to || to < 0 || to >= inv.slots.length) return inv;
  const b = inv.slots[to];
  const slots = inv.slots.slice();
  if (b && b.id === a.id && stackOf(defs, a.id) > 1) {
    const put = Math.min(stackOf(defs, a.id) - b.n, a.n);
    if (put === 0) return inv;
    slots[to] = { id: b.id, n: b.n + put };
    slots[from] = a.n - put > 0 ? { id: a.id, n: a.n - put } : null;
  } else {
    slots[to] = a;
    slots[from] = b;
  }
  return Object.freeze({ ...inv, slots: freezeSlots(slots) });
}

/** Tambah ke kotak kiriman (peta id → jumlah). */
export function shipInto(box, id, n) {
  if (!(n > 0)) return box;
  return Object.freeze({ ...box, [id]: (box[id] ?? 0) + n });
}

/** Nilai jual kotak kiriman (item tanpa `sell` bernilai 0). */
export function shipValue(box, defs) {
  return Object.entries(box).reduce((t, [id, n]) => t + (defs[id]?.sell ?? 0) * n, 0);
}

export function inventoryToJson(inv, box) {
  return JSON.stringify({ slots: inv.slots.map((s) => (s ? [s.id, s.n] : 0)), box });
}

/**
 * Pulihkan {inv, box} dari JSON (data tidak dipercaya: id asing / jumlah tidak valid dibuang, ukuran disesuaikan).
 * Kembalikan null bila teks rusak total (pemanggil memakai perlengkapan awal).
 */
export function inventoryFromJson(text, size, defs) {
  try {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.slots)) return null;
    const valid = (id, n) => typeof id === 'string' && defs[id] && Number.isInteger(n) && n > 0;
    const slots = Array.from({ length: size }, (_, i) => {
      const [id, n] = Array.isArray(data.slots[i]) ? data.slots[i] : [];
      return valid(id, n) ? { id, n: Math.min(n, stackOf(defs, id)) } : null;
    });
    const box = {};
    for (const [id, n] of Object.entries(data.box && typeof data.box === 'object' ? data.box : {})) {
      if (valid(id, n)) box[id] = n;
    }
    return { inv: Object.freeze({ slots: freezeSlots(slots) }), box: Object.freeze(box) };
  } catch {
    return null;
  }
}
