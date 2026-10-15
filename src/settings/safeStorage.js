/**
 * safeLocalStorage(): localStorage bila dapat diakses (bukan mode privat ketat /
 * sandbox tanpa izin), selain itu null sehingga store berjalan tanpa persist.
 */
const PROBE_KEY = 'sur3d.probe';

export function safeLocalStorage(win = typeof window !== 'undefined' ? window : null) {
  try {
    const ls = win?.localStorage;
    if (!ls) return null;
    ls.getItem(PROBE_KEY); // baca ditolak -> tidak dapat dipakai sama sekali
    try {
      ls.setItem(PROBE_KEY, '1');
      ls.removeItem(PROBE_KEY);
    } catch {
      // kuota penuh: tetap dipakai agar data yang sudah ada dapat dibaca
    }
    return ls;
  } catch {
    return null;
  }
}
