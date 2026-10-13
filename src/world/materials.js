/**
 * Material bersama (lazy, di-cache) agar jumlah material & shader minimal.
 * Gaya "cozy stylized": permukaan matte (roughness tinggi, metalness 0);
 * hanya ACP yang sedikit metalik (<= 0.3).
 */
import { DoubleSide, MeshLambertMaterial, MeshStandardMaterial } from 'three';
import { COLORS } from '../config/constants.js';

const ROUGH_MATTE = 0.9;
const ROUGH_SATIN = 0.85;
const ACP_METALNESS = 0.1;

const cache = new Map();

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

/** MeshStandardMaterial matte (metalness 0) dengan opsi tambahan. */
function matte(color, roughness = ROUGH_MATTE, extra = {}) {
  return new MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
}

export const Materials = Object.freeze({
  acp: () => cached('acp', () => new MeshStandardMaterial({ color: COLORS.acp, roughness: ROUGH_SATIN, metalness: ACP_METALNESS })),
  grc: () => cached('grc', () => new MeshLambertMaterial({ color: COLORS.roofWhite, side: DoubleSide })),
  concrete: () => cached('concrete', () => new MeshLambertMaterial({ color: COLORS.concrete, side: DoubleSide })),
  concreteDark: () => cached('concreteDark', () => new MeshLambertMaterial({ color: COLORS.concreteDark })),
  louvre: () => cached('louvre', () => matte(COLORS.louvre)),
  louvreGold: () => cached('louvreGold', () => matte(COLORS.louvreGold, ROUGH_SATIN)),
  gold: () => cached('gold', () => matte(COLORS.gold, ROUGH_SATIN)),
  steel: () => cached('steel', () => new MeshLambertMaterial({ color: COLORS.steel })),
  iron: () => cached('iron', () => new MeshLambertMaterial({ color: COLORS.ironDark })),
  dark: () => cached('dark', () => new MeshLambertMaterial({ color: 0x3a3d46 })),
  navy: () => cached('navy', () => new MeshLambertMaterial({ color: COLORS.navy })),
  white: () => cached('white', () => new MeshLambertMaterial({ color: 0xfaf8f4 })),
  terracotta: () => cached('terracotta', () => new MeshLambertMaterial({ color: COLORS.terracotta })),
  wood: () => cached('wood', () => new MeshLambertMaterial({ color: 0x9a6b44 })),
  glass: () => cached('glass', () => matte(COLORS.glass, ROUGH_SATIN, { transparent: true, opacity: 0.55 })),
});
