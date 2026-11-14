/**
 * Binding grup "aksesibilitas" (store -> <html>): skala teks (--ui-text-scale) dan kurangi gerakan
 * (atribut data-kurangi-gerak; CSS mematikan animasi, kamera mematikan efek gerak).
 */

/**
 * @param {object} store
 * @param {{ root?: { style: { setProperty: Function }, toggleAttribute: Function }|null }} [ctx]
 * @returns {() => void} unsubscribe
 */
export function bindAccessibility(store, { root = globalThis.document?.documentElement ?? null } = {}) {
  if (!root) return () => {};
  const unsubs = [
    store.bind('aksesibilitas.textScale', (v) => root.style.setProperty('--ui-text-scale', String(v))),
    store.bind('aksesibilitas.reduceMotion', (v) => root.toggleAttribute('data-kurangi-gerak', Boolean(v))),
  ];
  return () => { for (const u of unsubs) u(); };
}
