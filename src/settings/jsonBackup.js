/**
 * Muat JSON dengan cadangan: data yang tidak bisa dibaca disalin ke `${key}.bak` sebelum diganti nilai awal,
 * supaya kebun/tas yang rusak tidak hilang diam-diam (bisa dipulihkan manual).
 * @template T
 * @param {Storage|null} storage
 * @param {string} key
 * @param {(text: string) => T|null} parse melempar atau null = rusak
 * @returns {T|null} null bila kosong, rusak, atau storage tidak ada
 */
export function loadJsonWithBackup(storage, key, parse) {
  if (!storage) return null;
  let text;
  try { text = storage.getItem(key); } catch { return null; }
  if (!text) return null;
  let value;
  try { value = parse(text); } catch { value = null; }
  if (value == null) {
    try { storage.setItem(`${key}.bak`, text); } catch { /* kuota penuh: tetap lanjut */ }
  }
  return value;
}
