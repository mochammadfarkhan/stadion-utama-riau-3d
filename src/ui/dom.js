/**
 * Util DOM kecil untuk pustaka UI (vanilla, tanpa framework).
 * Tidak ada innerHTML dari data pengguna: `attrs.html` hanya untuk template statis/ikon.
 */

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape teks agar aman disisipkan ke template HTML statis. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

/**
 * Buat elemen: h(tag, kelas, attrs).
 * attrs khusus: html (template statis), text, children (array node), dan atribut lain
 * (data-*, aria-*, role, id, tabindex, ...). Nilai null/false dilewati; true → atribut kosong.
 */
export function h(tag, cls = '', attrs = {}) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const [name, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (name === 'html') el.innerHTML = value;
    else if (name === 'text') el.textContent = String(value);
    else if (name === 'children') el.append(...value.filter(Boolean));
    else el.setAttribute(name, value === true ? '' : String(value));
  }
  return el;
}

let counter = 0;
/** ID unik per sesi (untuk aria-labelledby / aria-controls). */
export function uid(prefix = 'ui') {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** True bila elemen target sedang menerima ketikan (hotkey global harus diabaikan). */
export function isTypingTarget(el) {
  if (!el || typeof el !== 'object') return false;
  if (TYPING_TAGS.has(el.tagName)) return true;
  return el.isContentEditable === true;
}

/**
 * Panggil hook opsional (fungsi atau array fungsi) dengan try/catch agar
 * kesalahan di hook pengguna tidak merusak UI. Mengembalikan hasil hook terakhir.
 */
export function callHook(fn, ...args) {
  if (!fn) return undefined;
  if (Array.isArray(fn)) {
    let last;
    for (const f of fn) last = callHook(f, ...args);
    return last;
  }
  if (typeof fn !== 'function') return undefined;
  try {
    return fn(...args);
  } catch (err) {
    console.error('[ui] hook gagal:', err);
    return undefined;
  }
}

/** Baca/tulis storage mirip localStorage tanpa melempar (mode privat/kuota penuh). */
export function safeStorageGet(storage, key) {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}
export function safeStorageSet(storage, key, value) {
  try { storage?.setItem(key, value); } catch { /* tidak fatal */ }
}
