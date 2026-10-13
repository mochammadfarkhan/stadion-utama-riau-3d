/**
 * Atap cincin oval profil lengkung (panel Kalzip putih/silver) + normal map bergelombang
 * prosedural (DataTexture sinus) + listplank GRC di tepi luar & dalam.
 */
import {
  DataTexture, DoubleSide, Group, Mesh, MeshStandardMaterial, RGBAFormat, RepeatWrapping, Vector2,
} from 'three';
import { COLORS } from '../../config/constants.js';
import { Materials } from '../materials.js';
import { ROOF_PROFILE, roofYAt } from './profiles.js';
import { buildRingGeometry } from './ringGeometry.js';

const WAVE_TEX_WIDTH = 128;
const WAVE_TEX_HEIGHT = 4;
const WAVE_SLOPE = 0.9;           // kecuraman gelombang (0..1+)
const WAVE_REPEAT = 220;          // jumlah gelombang per keliling (standing seam ±4 m)
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

function createRoofMaterial() {
  return new MeshStandardMaterial({
    color: COLORS.roofSilver,
    metalness: 0.6,
    roughness: 0.4,
    normalMap: createWaveNormalMap(),
    normalScale: new Vector2(1, 1),
    side: DoubleSide,
  });
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
