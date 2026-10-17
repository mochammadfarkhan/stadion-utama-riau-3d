/** Esc menutup lapisan teratas: jurnal dulu, lalu toko, lalu panel perjalanan cepat. Tidak pernah membuka apa pun. */
export function routeEscape({ journalOpen, shopOpen, travelOpen = false }) {
  if (journalOpen) return 'journal';
  if (shopOpen) return 'shop';
  if (travelOpen) return 'travel';
  return null;
}
