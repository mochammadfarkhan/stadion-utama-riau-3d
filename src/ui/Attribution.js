/**
 * Atribusi data peta (kewajiban ODbL): teks kecil tetap di pojok HUD dengan tautan hak cipta OSM.
 * Ditampilkan hanya saat tile kota aktif.
 */
export const ATTRIBUTION = Object.freeze({
  href: 'https://www.openstreetmap.org/copyright',
  osm: 'OpenStreetMap',
  rest: ' contributors · Overture Maps Foundation',
});

/** @param {HTMLElement} root @returns {{el: HTMLElement, dispose(): void}} */
export function createAttribution(root, { doc = root.ownerDocument ?? document } = {}) {
  const el = doc.createElement('div');
  el.id = 'map-attribution';
  const link = doc.createElement('a');
  link.href = ATTRIBUTION.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = ATTRIBUTION.osm;
  el.append('© ', link, ATTRIBUTION.rest);
  root.append(el);
  return { el, dispose: () => el.remove() };
}
