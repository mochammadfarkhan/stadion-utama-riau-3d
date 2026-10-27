/**
 * Ukuran huruf terbesar yang muat (MURNI): kandidat maxPx, maxPx−step, … sampai kandidat pertama ≤ minPx (selalu
 * diterima sebagai batas bawah) — hasil SAMA dengan perulangan lama "turunkan step selama terlalu lebar", tetapi lewat
 * pencarian biner: ±7 pengukuran, bukan puluhan (tiap pengukuran = set ctx.font + measureText, mahal di thread utama).
 * Mengandaikan lebar naik monoton terhadap ukuran huruf.
 * @param {(px:number) => number} measure lebar teks pada ukuran px
 * @param {number} maxPx @param {number} minPx @param {number} step @param {number} maxW
 */
export function fitFontSize(measure, maxPx, minPx, step, maxW) {
  const last = Math.max(0, Math.ceil((maxPx - minPx) / step)); // kandidat terakhir ≤ minPx
  const ok = (k) => maxPx - k * step <= minPx || measure(maxPx - k * step) <= maxW;
  let lo = 0;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ok(mid)) hi = mid;
    else lo = mid + 1;
  }
  return maxPx - lo * step;
}
