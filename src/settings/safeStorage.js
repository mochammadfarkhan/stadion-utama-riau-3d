/**
 * safeLocalStorage(): localStorage bila dapat diakses (bukan mode privat ketat /
 * sandbox tanpa izin), selain itu null sehingga store berjalan tanpa persist.
 */
const PROBE_KEY = 'sur3d.probe';

export function safeLocalStorage(win = typeof window !== 'undefined' ? window : null) {
  try {
    const ls = win?.localStorage;
    if (!ls) return null;
    ls.setItem(PROBE_KEY, '1');
    ls.removeItem(PROBE_KEY);
    return ls;
  } catch {
    return null;
  }
}
