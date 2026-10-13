import * as THREE from 'three';
import { COLORS } from '../config/constants.js';
import { surfaceMaps } from './textures/surfaces.js';

/**
 * Material bersama untuk tanah, jalan, plaza (dibuat sekali, dipakai ulang).
 * Permukaan utama (rumput, paving, aspal, beton) memakai tekstur prosedural
 * dengan UV bersatuan meter; material diberi nama + userData.baseRoughness
 * agar modul cuaca bisa mencarinya dan mengubah roughness saat hujan.
 */
// Palet pastel hangat (selaras COLORS di constants.js); semua Lambert = matte penuh.
export const GROUND_COLORS = Object.freeze({
  kerb: 0xf1ece2,
  sidewalk: 0xded7c9,
  lineWhite: 0xfbfaf6,
  lineYellow: 0xf2d16a,
  joggingTrack: 0xe39a84,
  dirt: 0xb2956d,
  helipadRing: 0xfcfcfa,
  amphitheater: 0xd8d0bf,
});

/** Ketinggian lapisan agar tidak z-fighting (meter). */
export const LAYER_Y = Object.freeze({
  ground: 0,
  plaza: 0.02,
  road: 0.03,
  sidewalk: 0.06,
  kerb: 0.08,
  marking: 0.05,
  parkingLine: 0.045,
});

const SURFACE_ROUGHNESS = 0.92;
const NORMAL_SCALE = 0.4;

/**
 * Material permukaan bertekstur (MeshStandardMaterial matte) bernama `name`.
 * @param {string} name nama tekstur sekaligus material ('asphalt' | 'paving' | 'grass' | 'concrete')
 * @param {{color?:number, tileM?:number, roughness?:number, normalScale?:number}} opts
 */
export function surfaceMaterial(name, { color = 0xffffff, tileM, roughness = SURFACE_ROUGHNESS, normalScale = NORMAL_SCALE } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness, metalness: 0, ...surfaceMaps(name, tileM),
    normalScale: new THREE.Vector2(normalScale, normalScale),
  });
  mat.name = name;
  mat.userData.baseRoughness = roughness;
  return mat;
}

/** Ubah UV geometri 0..1 menjadi satuan meter (w × h) agar repeat tekstur konsisten. */
export function uvToMeters(geometry, w, h) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  uv.needsUpdate = true;
  return geometry;
}

let cache = null;

/** Buat (sekali) dan kembalikan set material bersama. */
export function groundMaterials() {
  if (cache) return cache;
  const asphalt = surfaceMaterial('asphalt');
  cache = {
    grass: surfaceMaterial('grass'),
    paving: surfaceMaterial('paving', { color: COLORS.concrete }),
    asphalt,
    asphaltPlain: asphalt,
    concrete: surfaceMaterial('concrete', { color: COLORS.concrete }),
    kerb: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.kerb }),
    sidewalk: surfaceMaterial('concrete', { color: GROUND_COLORS.sidewalk }),
    lineWhite: new THREE.MeshBasicMaterial({ color: GROUND_COLORS.lineWhite }),
    lineYellow: new THREE.MeshBasicMaterial({ color: GROUND_COLORS.lineYellow }),
    joggingTrack: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.joggingTrack }),
    dirt: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.dirt }),
    amphitheater: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.amphitheater }),
  };
  return cache;
}
