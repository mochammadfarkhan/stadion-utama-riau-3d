/**
 * Material permukaan datar PBR (jalan aspal/beton, paving, rumput lapangan): MeshStandardMaterial dengan albedo +
 * normal + ORM (aoMap R, roughnessMap G) dari loadPbr, UV = meter dunia (drape) lewat texture.repeat = 1 / tile.
 * Kualitas: tinggi/sedang = 512 penuh; rendah = 256 albedo saja. Tekstur milik ResourceScope aktif (material.dispose()
 * saja). Wet registry bekerja lewat `color` dan `roughness` (roughnessMap dikali roughness, jadi basah = licin).
 */
import { MeshStandardMaterial, Vector2 } from 'three';
import { loadPbr } from './pbr.js';
import { TILE_M, tierForQuality } from './pbrCore.js';

const NORMAL_SCALE = 0.8;

function tileTexture(tex, name) {
  if (!tex) return tex;
  const r = 1 / TILE_M[name];
  tex.repeat.set(r, r);
  return tex;
}

/**
 * @param {string} name nama set tekstur (asphalt | concrete | paving | grass | ...)
 * @param {{color?: number, quality?: 'tinggi'|'sedang'|'rendah', roughness?: number}} [opts]
 */
export function pbrSurfaceMaterial(name, { color = 0xffffff, quality = 'tinggi', roughness = 1 } = {}) {
  const low = quality === 'rendah';
  const set = loadPbr(name, { tier: tierForQuality(quality), anisotropy: low ? 2 : 8, kinds: low ? ['albedo'] : ['albedo', 'normal', 'orm'] });
  const mat = new MeshStandardMaterial({
    color, roughness, metalness: 0,
    map: tileTexture(set.map, name),
    ...(low ? {} : {
      normalMap: tileTexture(set.normalMap, name),
      normalScale: new Vector2(NORMAL_SCALE, NORMAL_SCALE),
      aoMap: tileTexture(set.aoMap, name),
      roughnessMap: set.roughnessMap,
      aoMapIntensity: 0.8,
    }),
  });
  mat.name = `pbr:${name}`;
  mat.userData.pbr = true;
  mat.userData.baseRoughness = roughness;
  return mat;
}
