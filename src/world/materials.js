/** Material bersama (lazy, di-cache) agar jumlah material & shader minimal. */
import { DoubleSide, MeshLambertMaterial, MeshStandardMaterial } from 'three';
import { COLORS } from '../config/constants.js';

const cache = new Map();

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export const Materials = Object.freeze({
  acp: () => cached('acp', () => new MeshStandardMaterial({ color: COLORS.acp, roughness: 0.45, metalness: 0.15 })),
  grc: () => cached('grc', () => new MeshLambertMaterial({ color: COLORS.roofWhite, side: DoubleSide })),
  concrete: () => cached('concrete', () => new MeshLambertMaterial({ color: COLORS.concrete, side: DoubleSide })),
  concreteDark: () => cached('concreteDark', () => new MeshLambertMaterial({ color: COLORS.concreteDark })),
  louvre: () => cached('louvre', () => new MeshStandardMaterial({ color: COLORS.louvre, roughness: 0.5, metalness: 0.35 })),
  louvreGold: () => cached('louvreGold', () => new MeshStandardMaterial({ color: COLORS.louvreGold, roughness: 0.45, metalness: 0.4 })),
  gold: () => cached('gold', () => new MeshStandardMaterial({ color: COLORS.gold, roughness: 0.3, metalness: 0.7 })),
  steel: () => cached('steel', () => new MeshLambertMaterial({ color: COLORS.steel })),
  iron: () => cached('iron', () => new MeshLambertMaterial({ color: COLORS.ironDark })),
  dark: () => cached('dark', () => new MeshLambertMaterial({ color: 0x15171a })),
  navy: () => cached('navy', () => new MeshLambertMaterial({ color: COLORS.navy })),
  white: () => cached('white', () => new MeshLambertMaterial({ color: 0xf4f4f4 })),
  terracotta: () => cached('terracotta', () => new MeshLambertMaterial({ color: COLORS.terracotta })),
  wood: () => cached('wood', () => new MeshLambertMaterial({ color: 0x5a3a1e })),
  glass: () => cached('glass', () => new MeshStandardMaterial({
    color: COLORS.glass, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.55,
  })),
});
