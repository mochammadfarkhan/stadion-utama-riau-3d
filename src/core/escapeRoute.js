/** Esc menutup lapisan teratas: jurnal dulu, lalu toko. Tidak pernah membuka apa pun. */
export function routeEscape({ journalOpen, shopOpen }) {
  if (journalOpen) return 'journal';
  if (shopOpen) return 'shop';
  return null;
}
