/**
 * Material bersama region Lembaga: satu set per ResourceScope region (dilepas bersama region). Nama material
 * memudahkan diagnosis draw call; `userData.nightEmissive` dibaca registry malam (TimeOfDay.lights) untuk
 * lampu selasar dan kolam cahaya aditif (tanpa PointLight tambahan).
 */
import * as THREE from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { surfaceMaps } from '../../world/textures/surfaces.js';
import { surfaceMaterial } from '../../world/Ground.materials.js';
import { createLembagaAtlas } from './sekretariat.atlas.js';
import { keramikTexture, plafonTexture, rosterTexture, poolTexture } from './sekretariat.textures.js';
import { LEMBAGA_LAYOUT } from './layout.js';

const std = (name, params) => {
  const m = new THREE.MeshStandardMaterial(params);
  m.name = name;
  m.userData.baseRoughness = params.roughness ?? 1;
  return m;
};
const withMap = (map, params) => (map ? { ...params, map } : params);

function createMaterials(atlas) {
  const tex = { keramik: keramikTexture(), plafon: plafonTexture(), roster: rosterTexture(), pool: poolTexture() };
  const lampu = std('lampuSelasar', { color: 0xfff6e0, emissive: 0xffe2a8, emissiveIntensity: 0.05, roughness: 0.4 });
  lampu.userData.nightEmissive = { on: 2.6, off: 0.05 };
  const kolam = std('kolamCahaya', {
    color: 0x000000, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 1, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, ...(tex.pool ? { emissiveMap: tex.pool } : {}),
  });
  kolam.userData.nightEmissive = { on: 1.1, off: 0 };
  const rabat = surfaceMaterial('concrete', { color: 0xc9c4b8 });
  rabat.name = 'rabatBeton';
  return {
    dinding: std('dindingKrem', { color: 0xe8dcc0, roughness: 0.92, ...surfaceMaps('concrete', 2) }),
    plint: std('plintAbu', { color: 0x8d8c86, roughness: 0.95 }),
    putih: std('putihKusam', { color: 0xf3efe6, roughness: 0.85 }),
    pintu: std('pintuCat', { vertexColors: true, roughness: 0.65 }),
    kusen: std('kusenKayu', { color: 0x6a4a30, roughness: 0.8 }),
    alu: std('aluminium', { color: 0xa9b1b6, roughness: 0.45, metalness: 0.35 }),
    kaca: std('kacaNako', { color: 0xa7c4cf, roughness: 0.08, transparent: true, opacity: 0.42, depthWrite: false }),
    gelap: std('ruangGelap', { color: 0x1f1c18, roughness: 1 }),
    roster: std('rosterBeton', withMap(tex.roster, { color: 0xd9d2c3, roughness: 0.95, side: THREE.DoubleSide, alphaTest: 0.5 })),
    seng: std('sengAtap', { color: 0x8e9aa6, roughness: 0.5, metalness: 0.35, side: THREE.DoubleSide, ...surfaceMaps('metalSeam', 0.4) }),
    talang: std('talangPvc', { color: 0xcfd3d4, roughness: 0.6 }),
    plafon: std('plafonSelasar', withMap(tex.plafon, { color: 0xf1ede4, roughness: 0.95 })),
    keramik: std('keramikSelasar', withMap(tex.keramik, { color: 0xffffff, roughness: 0.35 })),
    rabat,
    lampu,
    kolam,
    atlas: std('atlasDecal', withMap(atlas.texture, { color: 0xffffff, roughness: 0.8, alphaTest: 0.5 })),
    spanduk: std('spandukKain', withMap(atlas.texture, { color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide })),
    kayu: std('kayuPapan', { color: 0x8a5a36, roughness: 0.85 }),
    besi: std('besiPagar', { color: 0x2f5d3a, roughness: 0.6, metalness: 0.3 }),
    tali: std('taliHitam', { color: 0x3a3a3a, roughness: 1 }),
    beton: std('betonTribun', { color: 0xbdb8ad, roughness: 0.95, ...surfaceMaps('concrete', 2) }),
    baja: std('bajaCat', { color: 0x5b6670, roughness: 0.55, metalness: 0.5 }),
    seng2: std('sengBerkarat', { color: 0x9c7a5b, roughness: 0.75, metalness: 0.25, side: THREE.DoubleSide, ...surfaceMaps('metalSeam', 0.4) }),
    tanah: std('tanahUrug', { color: 0x9b6b47, roughness: 1 }),
    vcolor: std('vertexWarna', { vertexColors: true, roughness: 0.9 }),
  };
}

/** Material + atlas region (cache per scope aktif). */
export function lembagaMaterials(rooms = LEMBAGA_LAYOUT.rooms) {
  const atlas = currentScope().get('lembaga:atlas', () => createLembagaAtlas(rooms));
  const mats = currentScope().get('lembaga:materials', () => createMaterials(atlas));
  return { mats, atlas };
}
