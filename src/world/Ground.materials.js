import * as THREE from 'three';
import { COLORS } from '../config/constants.js';
import { grassTexture, pavingTexture, asphaltTexture } from './siteutil/proceduralTextures.js';

/**
 * Material bersama untuk tanah, jalan, plaza (dibuat sekali, dipakai ulang).
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

let cache = null;

/** Buat (sekali) dan kembalikan set material bersama. */
export function groundMaterials() {
  if (cache) return cache;
  cache = {
    grass: new THREE.MeshLambertMaterial({ color: 0xffffff, map: grassTexture(COLORS.grass, 70) }),
    paving: new THREE.MeshLambertMaterial({ color: 0xffffff, map: pavingTexture(COLORS.concrete, 45) }),
    asphalt: new THREE.MeshLambertMaterial({ color: 0xffffff, map: asphaltTexture(COLORS.asphalt, 40) }),
    asphaltPlain: new THREE.MeshLambertMaterial({ color: COLORS.asphalt }),
    concrete: new THREE.MeshLambertMaterial({ color: COLORS.concrete }),
    kerb: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.kerb }),
    sidewalk: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.sidewalk }),
    lineWhite: new THREE.MeshBasicMaterial({ color: GROUND_COLORS.lineWhite }),
    lineYellow: new THREE.MeshBasicMaterial({ color: GROUND_COLORS.lineYellow }),
    joggingTrack: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.joggingTrack }),
    dirt: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.dirt }),
    amphitheater: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.amphitheater }),
  };
  return cache;
}
