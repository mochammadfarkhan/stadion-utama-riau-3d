/**
 * Template SVG statis untuk dial Waktu. Dibangun sekali per kontrol dengan id unik;
 * atribut dinamis (posisi matahari/bulan, warna gradien, opacity bintang, fase)
 * dimutasi oleh TimeOfDayControl.update(), bukan dengan membangun ulang.
 */
import { TOD, todPoint } from './TimeOfDay.math.js';

const STAR_COUNT = 26;
const STAR_SEED = 0x5ad1e;
const TICK_EVERY_HOURS = 3;
const TICK_LEN = 4;
const LABEL_OFFSET = 10;
const SUN_GLOW_R = 24;
const SUN_DISC_R = 7;
const MOON_R = 5;
const CORNER_R = 10;

/** PRNG deterministik (mulberry32) agar sebaran bintang stabil antar render. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f2 = (n) => n.toFixed(2);

function starsMarkup() {
  const rnd = mulberry32(STAR_SEED);
  const items = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const x = 6 + rnd() * (TOD.w - 12);
    const y = 6 + rnd() * (TOD.cy - 14);
    const r = 0.5 + rnd() * 0.9;
    items.push(`<circle class="ui-tod-star" cx="${f2(x)}" cy="${f2(y)}" r="${f2(r)}"/>`);
  }
  return items.join('');
}

/** Tick radial tiap 3 jam di sepanjang kedua busur. */
function ticksMarkup() {
  const items = [];
  for (let h = 0; h < 24; h += TICK_EVERY_HOURS) {
    const p = todPoint(h);
    const dx = (p.x - TOD.cx) / TOD.rx;
    const ry = p.y <= TOD.cy ? TOD.up : TOD.down;
    const dy = (p.y - TOD.cy) / ry;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    items.push(
      `<line class="ui-tod-tick" x1="${f2(p.x - nx * TICK_LEN)}" y1="${f2(p.y - ny * TICK_LEN)}" ` +
        `x2="${f2(p.x + nx * TICK_LEN)}" y2="${f2(p.y + ny * TICK_LEN)}"/>`,
    );
  }
  return items.join('');
}

/** Label jam utama 06 / 12 / 18 / 00. */
function labelsMarkup() {
  const top = todPoint(12);
  const bottom = todPoint(0);
  const left = todPoint(6);
  const right = todPoint(18);
  return (
    `<text class="ui-tod-lbl" x="${f2(left.x + 6)}" y="${f2(left.y - 5)}" text-anchor="start">06</text>` +
    `<text class="ui-tod-lbl" x="${f2(top.x)}" y="${f2(top.y + LABEL_OFFSET + 4)}" text-anchor="middle">12</text>` +
    `<text class="ui-tod-lbl" x="${f2(right.x - 6)}" y="${f2(right.y - 5)}" text-anchor="end">18</text>` +
    `<text class="ui-tod-lbl" x="${f2(bottom.x)}" y="${f2(bottom.y - 5)}" text-anchor="middle">00</text>`
  );
}

function defsMarkup(id) {
  return (
    `<defs>` +
    `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop class="ui-tod-sky-top" offset="0" stop-color="#2f7fe0"/>` +
    `<stop class="ui-tod-sky-bot" offset="1" stop-color="#9fd2ff"/></linearGradient>` +
    `<linearGradient id="${id}-sea" x1="0" y1="0" x2="0" y2="1">` +
    `<stop class="ui-tod-sea-top" offset="0" stop-color="#9fd2ff"/>` +
    `<stop class="ui-tod-sea-bot" offset="1" stop-color="#2a6fb0"/></linearGradient>` +
    `<radialGradient id="${id}-glow">` +
    `<stop offset="0" stop-color="#ffd9a0" stop-opacity="0.9"/>` +
    `<stop offset="0.45" stop-color="#ffb86b" stop-opacity="0.35"/>` +
    `<stop offset="1" stop-color="#ffb86b" stop-opacity="0"/></radialGradient>` +
    `<clipPath id="${id}-clip"><rect x="0" y="0" width="${TOD.w}" height="${TOD.h}" rx="${CORNER_R}"/></clipPath>` +
    `<mask id="${id}-moonmask" maskUnits="userSpaceOnUse" x="-8" y="-8" width="16" height="16">` +
    `<circle r="${MOON_R}" fill="#fff"/><circle cx="2.4" cy="-1.4" r="${MOON_R - 0.6}" fill="#000"/></mask>` +
    `</defs>`
  );
}

/**
 * Bangun markup SVG dial lengkap. `id` harus unik per instance (dipakai untuk defs).
 * @param {string} id
 * @returns {string}
 */
export function buildDialSvg(id) {
  const dayArc = `M${TOD.cx - TOD.rx} ${TOD.cy} A${TOD.rx} ${TOD.up} 0 0 1 ${TOD.cx + TOD.rx} ${TOD.cy}`;
  const nightArc = `M${TOD.cx + TOD.rx} ${TOD.cy} A${TOD.rx} ${TOD.down} 0 0 1 ${TOD.cx - TOD.rx} ${TOD.cy}`;
  return (
    `<svg class="ui-tod-dial" viewBox="0 0 ${TOD.w} ${TOD.h}" xmlns="http://www.w3.org/2000/svg" ` +
    `role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="24" aria-label="Waktu">` +
    defsMarkup(id) +
    `<g clip-path="url(#${id}-clip)">` +
    `<rect class="ui-tod-sky" x="0" y="0" width="${TOD.w}" height="${TOD.cy}" fill="url(#${id}-sky)"/>` +
    `<rect class="ui-tod-sea" x="0" y="${TOD.cy}" width="${TOD.w}" height="${TOD.h - TOD.cy}" fill="url(#${id}-sea)"/>` +
    `<g class="ui-tod-stars" opacity="0">${starsMarkup()}</g>` +
    `<path class="ui-tod-arc ui-tod-arc-day" d="${dayArc}"/>` +
    `<path class="ui-tod-arc ui-tod-arc-night" d="${nightArc}"/>` +
    `<line class="ui-tod-horizon" x1="0" y1="${TOD.cy}" x2="${TOD.w}" y2="${TOD.cy}"/>` +
    ticksMarkup() +
    labelsMarkup() +
    `<g class="ui-tod-moon" opacity="0"><circle class="ui-tod-moon-disc" r="${MOON_R}" mask="url(#${id}-moonmask)"/></g>` +
    `<g class="ui-tod-sun"><circle class="ui-tod-sun-glow" r="${SUN_GLOW_R}" fill="url(#${id}-glow)"/>` +
    `<circle class="ui-tod-sun-disc" r="${SUN_DISC_R}"/></g>` +
    `<text class="ui-tod-phase" x="10" y="18">Siang</text>` +
    `</g></svg>`
  );
}
