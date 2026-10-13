/**
 * Ikon SVG inline 24×24, stroke 1.6, warna mengikuti currentColor.
 * Konstanta internal (bukan data pengguna) sehingga aman disisipkan via innerHTML.
 */

const PATHS = Object.freeze({
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.75 3.75 0 0 1 17.5 18Z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13.5" r="3.5"/>',
  speaker: '<path d="M4 10v4h3l5 4V6L7 10Z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>',
  gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-6"/><circle cx="12" cy="17" r="1"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'chevrons-right': '<path d="M6 6l6 6-6 6"/><path d="M13 6l6 6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><path d="M12 17h.01"/>',
  viewfinder: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><circle cx="12" cy="12" r="3"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  rain: '<path d="M7 15a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 15Z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5Z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  play: '<path d="M7 5l12 7-12 7Z"/>',
  pause: '<path d="M7 5v14M17 5v14"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
});

/** Nama alternatif → nama ikon kanonik. */
export const ALIASES = Object.freeze({
  time: 'clock',
  weather: 'cloud',
  screenshot: 'camera',
  photo: 'viewfinder',
  close: 'x',
  collapse: 'chevrons-right',
  settings: 'layers',
  stats: 'gauge',
  fps: 'gauge',
  sound: 'speaker',
  audio: 'speaker',
  graphics: 'sparkle',
  sky: 'sun',
  performance: 'gauge',
  undo: 'reset',
  question: 'help',
});

export const ICON_NAMES = Object.freeze(Object.keys(PATHS));

/** Kembalikan string SVG untuk ikon; nama tak dikenal → ikon `info`. */
export function icon(name, cls = 'ui-ico') {
  const key = ALIASES[name] ?? name;
  const body = PATHS[key] ?? PATHS.info;
  return (
    `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
  );
}

export function hasIcon(name) {
  return Object.hasOwn(PATHS, ALIASES[name] ?? name);
}
