/**
 * Material bersama (lazy, di-cache) agar jumlah material & shader minimal.
 * Gaya "cozy stylized": permukaan matte (roughness tinggi, metalness 0);
 * hanya ACP yang sedikit metalik (<= 0.3).
 */
import { DoubleSide, MeshLambertMaterial, MeshStandardMaterial, Vector2 } from 'three';
import { COLORS } from '../config/constants.js';
import { surfaceMaps } from './textures/surfaces.js';

const ROUGH_MATTE = 0.9;
const ROUGH_SATIN = 0.85;
const ACP_METALNESS = 0.1;
const CONCRETE_TILE_M = 2;   // UV kotak 0..1 → setengah tile; dinding cincin (u 0..1) nyaris polos
const NORMAL_SCALE = 0.35;
const LOUVRE_ROUGHNESS = 0.8;

const cache = new Map();

/** Kesan disorot lampu dari bawah saat malam: emissive tipis yang dinaikkan TimeOfDay.lights (userData.nightEmissive). */
function uplit(mat, color, on) {
  mat.emissive.setHex(color);
  mat.emissiveIntensity = 0;
  mat.userData.nightEmissive = { on, off: 0 };
  return mat;
}

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

/** MeshStandardMaterial matte (metalness 0) dengan opsi tambahan. */
function matte(color, roughness = ROUGH_MATTE, extra = {}) {
  return new MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
}

/** Beri nama + roughness dasar agar modul cuaca bisa menemukan & memodulasi material. */
function named(mat, name, baseRoughness = 1) {
  mat.name = name;
  mat.userData.baseRoughness = baseRoughness;
  return mat;
}

/** Lambert beton bertekstur pori halus (warna dari `color`). */
function concreteLambert(color, extra = {}) {
  const maps = surfaceMaps('concrete', CONCRETE_TILE_M);
  return named(new MeshLambertMaterial({ color, ...maps, normalScale: new Vector2(NORMAL_SCALE, NORMAL_SCALE), ...extra }), 'concrete');
}

/** Louvre kayu/ACP: serat garis lembut, satu tile per bilah. */
function louvreMaterial(color) {
  const maps = surfaceMaps('wood', 1);
  return named(matte(color, LOUVRE_ROUGHNESS, { ...maps, normalScale: new Vector2(NORMAL_SCALE, NORMAL_SCALE) }), 'louvre', LOUVRE_ROUGHNESS);
}

export const Materials = Object.freeze({
  acp: () => cached('acp', () => new MeshStandardMaterial({ color: COLORS.acp, roughness: ROUGH_SATIN, metalness: ACP_METALNESS })),
  grc: () => cached('grc', () => uplit(new MeshLambertMaterial({ color: COLORS.roofWhite, side: DoubleSide }), 0x8fa6ff, 0.16)),
  concrete: () => cached('concrete', () => concreteLambert(COLORS.concrete, { side: DoubleSide })),
  concreteDark: () => cached('concreteDark', () => concreteLambert(COLORS.concreteDark)),
  louvre: () => cached('louvre', () => uplit(louvreMaterial(COLORS.louvre), 0xff9a50, 0.3)),
  louvreGold: () => cached('louvreGold', () => uplit(louvreMaterial(COLORS.louvreGold), 0xffb860, 0.3)),
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
