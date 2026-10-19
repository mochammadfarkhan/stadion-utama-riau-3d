/**
 * Material tanah distrik UNRI (satu set per ResourceScope distrik). Permukaan bertekstur surfaceMaps
 * (UV dunia bersatuan meter) dengan polygonOffset berjenjang (lapisan lebih atas = offset lebih besar) di atas
 * lift drape (DRAPE.lift) → tidak ada z-fighting antar lapisan maupun dengan terrain. Nama material untuk debug;
 * registry basah memilih berdasarkan NAMA MESH (ground.js), malam berdasarkan userData.nightEmissive.
 */
import { MeshLambertMaterial, MeshStandardMaterial } from 'three';
import { currentScope, withScope } from '../../engine/ResourceScope.js';
import { COLORS } from '../../config/constants.js';
import { GROUND_COLORS, surfaceMaterial } from '../../world/Ground.materials.js';
import { createTerrainSplatMaterial } from '../../world/terrain/terrainSplat.js';
import { pbrSurfaceMaterial } from '../../world/textures/pbrMaterials.js';
import { installAsphaltWear } from '../../world/textures/pbrWorld.js';
import { createWaterToonMaterial } from '../../world/shaders/waterToon.js';

/**
 * Pengali warna. asphalt: tekstur aspal (basis COLORS.asphalt) × 0xb3b0a9 ≈ jalan tersier kota #484b51 (linear:
 * 0,065/0,147 ≈ 0,44) agar sambungan kota–distrik tidak berganti nada. pitch: rumput lapangan sedikit lebih
 * terang. water: WATER_COLOR citybake (#3f6f8f). ditch: air parit keruh [INFERENSI].
 */
export const UNRI_GROUND_COLORS = Object.freeze({
  asphalt: 0xb3b0a9, marking: 0xf4f1e8, pitch: 0xdcefc4, water: 0x3f6f8f, ditch: 0x4b5a4a,
});

/** Aspal kartun: abu hangat netral menengah (bukan abu-biru gelap; bayangan kartun sudah biru, jadi jangan menambah). */
export const ASPHALT_PBR_COLOR = 0xc2bcb2;

const offset = (m, f) => {
  m.polygonOffset = true;
  m.polygonOffsetFactor = f;
  m.polygonOffsetUnits = f * 2;
  return m;
};

/** Material PBR (kartun/facet) per tingkat kualitas: tanah splat + jalan/trotoar/paving/lapangan; dibuat malas, di scope pemilik set. */
function createPbrMaterials(quality) {
  const q = { quality };
  const terrain = createTerrainSplatMaterial({ quality, moistBias: 0.35, name: 'unri:tanahSplat' });
  return {
    terrain,
    asphalt: installAsphaltWear(offset(pbrSurfaceMaterial('asphalt', { ...q, color: ASPHALT_PBR_COLOR }), -1)),
    paving: offset(pbrSurfaceMaterial('paving', { ...q, color: 0xe8e4da }), -2),
    walk: offset(pbrSurfaceMaterial('concrete', { ...q, color: GROUND_COLORS.sidewalk }), -3),
    pitch: offset(pbrSurfaceMaterial('grass', { ...q, color: 0xf2ffe0 }), -1),
  };
}

function createSet() {
  const terrain = surfaceMaterial('grass', { color: 0xffffff });
  terrain.vertexColors = true;
  terrain.name = 'unri:tanahTerrain';
  const marking = offset(new MeshLambertMaterial({ color: UNRI_GROUND_COLORS.marking }), -2);
  marking.name = 'unri:marka';
  const water = new MeshStandardMaterial({ color: UNRI_GROUND_COLORS.water, roughness: 0.35, metalness: 0 });
  water.name = 'unri:air';
  const ditch = offset(new MeshStandardMaterial({ color: UNRI_GROUND_COLORS.ditch, roughness: 0.25, metalness: 0 }), -1);
  ditch.name = 'unri:parit';
  const scope = currentScope();
  const pbrCache = new Map();
  let waterToon = null;
  return {
    pbrCache,
    /** Air kartun/facet (dibuat malas di scope pemilik set; tekstur noise ikut scope). */
    waterToon() {
      if (!waterToon) waterToon = withScope(scope, () => createWaterToonMaterial());
      return waterToon;
    },
    /** Material PBR untuk kualitas `quality` (dibuat sekali; tekstur dimuat lewat scope pemilik set). */
    pbr(quality) {
      let hit = pbrCache.get(quality);
      if (!hit) {
        hit = withScope(scope, () => createPbrMaterials(quality));
        pbrCache.set(quality, hit);
      }
      return hit;
    },
    terrain,
    asphalt: offset(surfaceMaterial('asphalt', { color: UNRI_GROUND_COLORS.asphalt }), -1),
    marking,
    paving: offset(surfaceMaterial('paving', { color: COLORS.concrete }), -2),
    walk: offset(surfaceMaterial('concrete', { color: GROUND_COLORS.sidewalk }), -3),
    pitch: offset(surfaceMaterial('grass', { color: UNRI_GROUND_COLORS.pitch }), -1),
    water,
    ditch,
  };
}

function disposeSet(set) {
  for (const [key, m] of Object.entries(set)) {
    if (key === 'pbrCache' || key === 'pbr' || key === 'waterToon') continue;
    for (const k of ['map', 'normalMap', 'roughnessMap']) m[k]?.dispose();
    m.dispose();
  }
  // air kartun + noise-nya dimiliki scope (dilepas bersama scope distrik)
  for (const mats of set.pbrCache.values()) for (const m of Object.values(mats)) m.dispose(); // tekstur PBR milik scope
}

/** Panggil di dalam withScope(scopeDistrik, …). */
export function createUnriGroundMaterials() {
  return currentScope().get('unri:groundMaterials', createSet, { dispose: disposeSet });
}
