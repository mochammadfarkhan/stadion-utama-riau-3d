/**
 * Material PBR dunia (M8-T3): patch `onBeforeCompile` PADA material yang sudah ada (GLB hero `unri:*`, kit opak) sehingga
 * tidak perlu mengubah GLB/geometri. Diaktifkan lewat `material.userData.styleHook(style, quality)` yang dipanggil
 * styleManager: 'asli' -> uniform mati (render identik); 'kartun'/'facet' -> tekstur PBR dimuat malas (loadPbr di scope
 * pemilik) dan uniform menyala. Kualitas rendah (facet / resolusi turun) = albedo saja, tanpa normal/ORM, tier 256.
 */
import { Box3, DataTexture, RGBAFormat, Vector2, Vector3, Vector4 } from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { loadPbr, pbrInfo } from './pbr.js';
import { TILE_M, tierForQuality } from './pbrCore.js';
import { recipeForMaterial } from './pbrWorldCore.js';
import {
  GENERIC_DECL, GENERIC_MAP, GENERIC_METAL, GENERIC_NORMAL, GENERIC_ROUGH, KIT_DECL, KIT_MAP, KIT_NORMAL, VERT_BODY, VERT_DECL, WEAR_DECL, WEAR_MAP,
} from './pbrWorld.shader.js';

/** Rata-rata albedo (sRGB hex) cadangan sebelum manifest termuat; identik dengan manifest. */
const AVG_FALLBACK = Object.freeze({ plaster: '#d7d3d0', concrete: '#b9b9b9', roofSteel: '#9a9b9e', wood: '#c4aa74' });
const NORMAL_K = 0.9;

let flatTextures = null;
function flats() {
  if (!flatTextures) {
    const mk = (r, g, b) => {
      const t = new DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, RGBAFormat);
      t.needsUpdate = true;
      return t;
    };
    flatTextures = { white: mk(255, 255, 255), normal: mk(128, 128, 255), orm: mk(255, 200, 0) };
  }
  return flatTextures;
}

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
/** '#rrggbb' sRGB -> Vector3 linear. */
export function avgLinear(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return new Vector3(toLinear(((n >> 16) & 255) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255));
}

function patchVertex(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
    .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_BODY}`);
}

function loadSet(scope, name, quality) {
  const low = quality === 'rendah';
  return withScope(scope, () => loadPbr(name, {
    tier: tierForQuality(quality), anisotropy: low ? 2 : 8, kinds: low ? ['albedo'] : ['albedo', 'normal', 'orm'],
  }));
}

/**
 * Pasang PBR dunia umum pada satu material.
 * @param {import('three').MeshStandardMaterial} mat
 * @param {{set: string, detail: number, maxSat: number, lift: number, rough?: number, metal?: number, stain?: boolean, rust?: boolean}} recipe
 * @param {{scope: object, stain?: [number, number], box?: [number, number, number, number]}} opts
 *   stain = [y dasar dunia, tinggi zona noda]; box = [minX, minZ, maxX, maxZ] dunia atap (karat tepi)
 */
export function installWorldPbr(mat, recipe, { scope, stain = [0, 3], box = [0, 0, 1, 1] }) {
  if (mat.userData.worldPbr) return mat;
  const f = flats();
  const u = {
    uWpOn: { value: 0 }, uWpNormalOn: { value: 0 }, uWpOrmOn: { value: 0 },
    tWpA: { value: f.white }, tWpN: { value: f.normal }, tWpO: { value: f.orm },
    uWpTile: { value: 1 / TILE_M[recipe.set] }, uWpAvg: { value: avgLinear(AVG_FALLBACK[recipe.set]) },
    uWpDetail: { value: recipe.detail }, uWpMaxSat: { value: recipe.maxSat }, uWpLift: { value: recipe.lift },
    uWpRough: { value: recipe.rough ?? 1 }, uWpMetal: { value: recipe.metal ?? 1 }, uWpNormalK: { value: NORMAL_K },
    uWpStain: { value: new Vector2(stain[0], stain[1]) },
    uWpBox: { value: new Vector4(...box) },
  };
  const defines = { ...(recipe.stain ? { WP_STAIN: '' } : {}), ...(recipe.rust ? { WP_RUST: '' } : {}) };
  mat.defines = { ...mat.defines, ...defines };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    patchVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GENERIC_DECL}`)
      .replace('#include <map_fragment>', GENERIC_MAP)
      .replace('#include <roughnessmap_fragment>', GENERIC_ROUGH)
      .replace('#include <metalnessmap_fragment>', GENERIC_METAL)
      .replace('#include <normal_fragment_maps>', GENERIC_NORMAL);
  };
  mat.customProgramCacheKey = () => `worldPbr:${recipe.set}:${recipe.stain ? 's' : ''}${recipe.rust ? 'r' : ''}`;
  let applied = '';
  mat.userData.worldPbr = true;
  mat.userData.styleHook = (style, quality) => {
    const on = style !== 'asli';
    const key = `${on}:${quality}`;
    if (key === applied) return;
    applied = key;
    u.uWpOn.value = on ? 1 : 0;
    if (!on) return;
    const full = quality !== 'rendah';
    const set = loadSet(scope, recipe.set, quality);
    u.tWpA.value = set.map;
    u.tWpN.value = full ? set.normalMap : f.normal;
    u.tWpO.value = full ? set.ormMap : f.orm;
    u.uWpNormalOn.value = full ? 1 : 0;
    u.uWpOrmOn.value = full ? 1 : 0;
    set.ready.then(() => {
      const info = pbrInfo(recipe.set);
      if (info?.avg) u.uWpAvg.value = avgLinear(info.avg);
    });
  };
  mat.needsUpdate = true;
  return mat;
}

/**
 * Pasang PBR pada material opak kit (atlas + warna vertex): plester di sel dinding, seng di sel atap (UV dunia).
 * @param {import('three').MeshStandardMaterial} mat
 * @param {{scope: object}} opts
 */
export function installKitPbr(mat, { scope }) {
  if (mat.userData.worldPbr) return mat;
  const f = flats();
  const u = {
    uWpOn: { value: 0 }, uWpNormalOn: { value: 0 },
    tKitPlA: { value: f.white }, tKitPlN: { value: f.normal }, tKitRfA: { value: f.white }, tKitRfN: { value: f.normal },
    uKitTile: { value: new Vector4(1 / TILE_M.plaster, 1 / TILE_M.roofSteel, 0, 0) },
    uKitAvgPl: { value: avgLinear(AVG_FALLBACK.plaster) }, uKitAvgRf: { value: avgLinear(AVG_FALLBACK.roofSteel) },
    uKitNormalK: { value: NORMAL_K },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    patchVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${KIT_DECL}`)
      .replace('#include <map_fragment>', KIT_MAP)
      .replace('#include <normal_fragment_maps>', KIT_NORMAL);
  };
  mat.customProgramCacheKey = () => 'worldPbr:kit';
  let applied = '';
  mat.userData.worldPbr = true;
  mat.userData.styleHook = (style, quality) => {
    const on = style !== 'asli';
    const key = `${on}:${quality}`;
    if (key === applied) return;
    applied = key;
    u.uWpOn.value = on ? 1 : 0;
    if (!on) return;
    const full = quality !== 'rendah';
    const pl = loadSet(scope, 'plaster', quality);
    const rf = loadSet(scope, 'roofSteel', quality);
    u.tKitPlA.value = pl.map;
    u.tKitRfA.value = rf.map;
    u.tKitPlN.value = full ? pl.normalMap : f.normal;
    u.tKitRfN.value = full ? rf.normalMap : f.normal;
    u.uWpNormalOn.value = full ? 1 : 0;
    Promise.all([pl.ready, rf.ready]).then(() => {
      const a = pbrInfo('plaster');
      const b = pbrInfo('roofSteel');
      if (a?.avg) u.uKitAvgPl.value = avgLinear(a.avg);
      if (b?.avg) u.uKitAvgRf.value = avgLinear(b.avg);
    });
  };
  mat.needsUpdate = true;
  return mat;
}

const _WALL_SETS = new Set(['plaster', 'concrete']);

/**
 * Pasang PBR dunia pada semua material GLB `unri:*` yang dipetakan (dinding, plint, beton, atap, kayu) di bawah `root`.
 * Menghitung dasar/tinggi dinding (noda bawah) dan kotak atap (karat tepi) dari bounding dunia. Idempoten per material.
 * @returns {string[]} nama material yang dipasangi
 */
export function applyBuildingPbr(root, { scope }) {
  root.updateWorldMatrix(true, true);
  const walls = new Box3();
  const roofs = new Box3();
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const recipe = recipeForMaterial(o.material.name);
    if (!recipe) return;
    meshes.push({ o, recipe });
    const bb = new Box3().setFromObject(o);
    if (_WALL_SETS.has(recipe.set)) walls.union(bb);
    else if (recipe.set === 'roofSteel') roofs.union(bb);
  });
  const stain = walls.isEmpty() ? [0, 3] : [walls.min.y, Math.max(1.5, (walls.max.y - walls.min.y) * 0.34)];
  const box = roofs.isEmpty() ? [0, 0, 1, 1] : [roofs.min.x, roofs.min.z, roofs.max.x, roofs.max.z];
  const done = new Set();
  for (const { o, recipe } of meshes) {
    installWorldPbr(o.material, recipe, { scope, stain, box });
    done.add(o.material.name);
  }
  return [...done];
}

/** Aspal aus untuk material PBR aspal (kartun): tambalan pudar + tambalan perbaikan dari noise dunia (tanpa tekstur baru). */
export function installAsphaltWear(mat) {
  if (mat.userData.asphaltWear) return mat;
  mat.userData.asphaltWear = true;
  mat.onBeforeCompile = (shader) => {
    patchVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
${WEAR_DECL}`)
      .replace('#include <map_fragment>', WEAR_MAP);
  };
  mat.customProgramCacheKey = () => 'asphaltWear';
  mat.needsUpdate = true;
  return mat;
}
