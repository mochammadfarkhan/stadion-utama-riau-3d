/**
 * Item inventory pemain (gaya Minecraft: hotbar 9 + tas 27). kind: 'tool' (tidak bertumpuk), 'seed' (benih, dibeli di
 * kotak benih rumah kebun), 'crop' (hasil panen, dijual lewat kotak kiriman). Harga diturunkan dari CROPS agar satu sumber.
 * Kunci item disimpan apa adanya di localStorage: JANGAN mengganti nama kunci yang sudah ada.
 */
import { CROPS, CROP_ORDER } from './kebun.js';

export const INVENTORY = Object.freeze({ hotbar: 9, bag: 27, stack: 64 });
export const INVENTORY_SIZE = INVENTORY.hotbar + INVENTORY.bag;

const CROP_ICON = Object.freeze({ cabai: '🌶️', jagung: '🌽', terong: '🍆' });

const seedItems = Object.fromEntries(CROP_ORDER.map((c) => [`benih-${c}`, Object.freeze({
  label: `Benih ${CROPS[c].label.toLowerCase()}`, icon: CROP_ICON[c], kind: 'seed', crop: c, stack: INVENTORY.stack, price: CROPS[c].seed,
})]));
const cropItems = Object.fromEntries(CROP_ORDER.map((c) => [c, Object.freeze({
  label: CROPS[c].label, icon: CROP_ICON[c], kind: 'crop', crop: c, stack: INVENTORY.stack, sell: CROPS[c].price,
})]));

export const ITEMS = Object.freeze({
  cangkul: Object.freeze({ label: 'Cangkul', icon: '⛏️', kind: 'tool', tool: 'cangkul', stack: 1 }),
  gembor: Object.freeze({ label: 'Gembor (penyiram)', icon: '🪣', kind: 'tool', tool: 'gembor', stack: 1 }),
  ...seedItems,
  ...cropItems,
});

/** Isi awal tas baru: [slot, id, jumlah]. */
export const STARTER_KIT = Object.freeze([[0, 'cangkul', 1], [1, 'gembor', 1], [2, 'benih-cabai', 5]]);
