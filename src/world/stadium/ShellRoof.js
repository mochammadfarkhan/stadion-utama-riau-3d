/**
 * Atap cincin oval profil lengkung (panel Kalzip putih/silver) + normal map bergelombang
 * prosedural (DataTexture sinus) + listplank GRC di tepi luar & dalam.
 */
import {
  DataTexture, DoubleSide, Group, Mesh, MeshStandardMaterial, RGBAFormat, RepeatWrapping, Vector2,
} from 'three';
import { COLORS } from '../../config/constants.js';
import { Materials } from '../materials.js';
import { metalSeamTexture, TILE_M } from '../textures/surfaces.js';
import { outerEllipse } from './ovalFrame.js';
import { ROOF_PROFILE, roofYAt } from './profiles.js';
import { buildRingGeometry } from './ringGeometry.js';

const WAVE_TEX_WIDTH = 128;
const WAVE_TEX_HEIGHT = 4;
const WAVE_SLOPE = 0.9;           // kecuraman gelombang (0..1+)
const WAVE_REPEAT = 220;          // jumlah gelombang per keliling (standing seam ±4 m)
const ROOF_DEPTH_M = 55;          // perkiraan lebar atap (k 0→1) untuk repeat tekstur arah V
const ROOF_NORMAL_SCALE = 0.45;
const ROOF_ROUGHNESS = 0.4;
const LISTPLANK_HEIGHT = 2.4;
const LISTPLANK_OUTER_K = -0.012;
const LISTPLANK_INNER_K = 1.012;

/** Normal map tangent-space: gelombang sinus sepanjang sumbu U (seam radial). */
export function createWaveNormalMap(width = WAVE_TEX_WIDTH, height = WAVE_TEX_HEIGHT) {
  const data = new Uint8Array(width * height * 4);
  for (let x = 0; x < width; x++) {
    const slope = -WAVE_SLOPE * Math.cos((x / width) * Math.PI * 2);
    const len = Math.hypot(slope, 1);
    const nx = slope / len;
    const nz = 1 / len;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = 128;
      data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, width, height, RGBAFormat);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Peta metal standing seam: U geometri = 0..WAVE_REPEAT per keliling, jadi
 * repeat.x = (keliling / tile) / WAVE_REPEAT agar seam tetap tiap 0,4 m;
 * V = 0..1 melintang atap → repeat.y = lebar atap / tile.
 */
function roofSeamMaps() {
  const tile = TILE_M.metalSeam;
  const src = metalSeamTexture();
  const repeatX = outerEllipse().perimeter / tile / WAVE_REPEAT;
  const repeatY = ROOF_DEPTH_M / tile;
  const map = src.map.clone();
  const normalMap = src.normalMap.clone();
  map.repeat.set(repeatX, repeatY);
  normalMap.repeat.set(repeatX, repeatY);
  map.needsUpdate = true;
  normalMap.needsUpdate = true;
  return { map, normalMap };
}

/** Material atap: metal seam (map + normal map seam, menggantikan sinus polos). */
function createRoofMaterial() {
  const mat = new MeshStandardMaterial({
    color: COLORS.roofSilver,
    metalness: 0.6,
    roughness: ROOF_ROUGHNESS,
    ...roofSeamMaps(),
    normalScale: new Vector2(ROOF_NORMAL_SCALE, ROOF_NORMAL_SCALE),
    side: DoubleSide,
  });
  mat.name = 'roof';
  mat.userData.baseRoughness = ROOF_ROUGHNESS;
  return mat;
}

/** Band listplank vertikal pada k tertentu, tepat di bawah tepi atap. */
function createListplank(k, name) {
  const top = roofYAt(Math.min(Math.max(k, 0), 1)) + 0.3;
  const geom = buildRingGeometry({
    profile: [{ k, y: top - LISTPLANK_HEIGHT }, { k, y: top }],
    flip: k > 0.5,
  });
  const mesh = new Mesh(geom, Materials.grc());
  mesh.name = name;
  mesh.castShadow = true;
  return mesh;
}

/** @param {{listplank?:boolean}} opts */
export function createRoof({ listplank = true } = {}) {
  const group = new Group();
  group.name = 'roof';
  const sheet = new Mesh(buildRingGeometry({ profile: ROOF_PROFILE, uvRepeat: WAVE_REPEAT }), createRoofMaterial());
  sheet.name = 'roof-sheet';
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  group.add(sheet);
  if (listplank) {
    group.add(createListplank(LISTPLANK_OUTER_K, 'listplank-outer'));
    group.add(createListplank(LISTPLANK_INNER_K, 'listplank-inner'));
  }
  return group;
}
