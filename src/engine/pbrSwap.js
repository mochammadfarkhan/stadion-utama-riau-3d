/**
 * Penukaran material per gaya grafis: mesh yang punya `userData.pbrSwap = {asli: Material, pbr: (kualitas) => Material}`
 * memakai material asli di gaya 'asli' dan material PBR (per tingkat kualitas) di 'kartun'/'facet'.
 * styleManager memanggil applyStyleSwap pada tiap pemindaian; pembangun mesh memanggilnya sekali saat dibuat
 * (agar tidak ada kedipan material lama). Lapisan engine: murni, tanpa three.
 */
export function pickSwapMaterial(swap, style, quality) {
  return style === 'asli' ? swap.asli : swap.pbr(quality);
}

/** Terapkan ke satu objek bila punya pbrSwap; kembalikan material yang kini terpasang (atau null bila tak ada swap). */
export function applyStyleSwap(obj, style, quality) {
  const swap = obj?.userData?.pbrSwap;
  if (!swap) return null;
  const mat = pickSwapMaterial(swap, style, quality);
  if (obj.material !== mat) obj.material = mat;
  return mat;
}
