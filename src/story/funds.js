/**
 * Pengaman soft-lock uang: bila langkah misi butuh membeli (atau mengantar) suatu item tetapi
 * saldo tidak cukup dan satu-satunya pemasukan hanyalah hadiah, pemain buntu. Helper murni ini
 * menghitung kekurangan saldo agar StoryDirector bisa memberi uang saku.
 */
import { VENDOR_CATALOG } from '../sim/vendorSim.js';

/** Harga item dari katalog; null bila tidak dikenal. */
export function priceOf(itemId) {
  for (const list of Object.values(VENDOR_CATALOG)) {
    const hit = list.find((i) => i.id === itemId);
    if (hit) return hit.price;
  }
  return null;
}

/**
 * Kekurangan saldo (rupiah) agar objective bisa diselesaikan; 0 bila cukup atau tidak relevan.
 * @param {{type:string, itemId?:string}|null} objective
 * @param {{balance:number, items:{id:string}[]}|null} wallet
 */
export function fundsShortfall(objective, wallet) {
  if (!objective || !wallet) return 0;
  if (objective.type !== 'buy' && objective.type !== 'deliver') return 0;
  const price = priceOf(objective.itemId);
  if (price == null) return 0;
  const items = Array.isArray(wallet.items) ? wallet.items : [];
  if (objective.type === 'deliver' && items.some((i) => i.id === objective.itemId)) return 0;
  const balance = Number.isFinite(wallet.balance) ? wallet.balance : 0;
  return Math.max(0, price - balance);
}
