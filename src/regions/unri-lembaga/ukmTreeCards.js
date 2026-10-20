/**
 * Pohon kartu daun (gaya kartun, M8 T4): GLB V15 (batang ber-UV silinder + 8–14 kartu melengkung per gerombol dengan normal
 * dibengkokkan ke pusat gerombol) dipasang sebagai lapisan LOD terpisah di sebelah gumpalan V11–V14. Per LOD0: dua BatchedMesh
 * (kulit kayu PBR `Bark001` + daun atlas alpha-test); LOD1 = gumpalan halus V15-lod (vertex color) yang memakai material gumpalan.
 * Anggaran overdraw: ≤ CARD_BUDGET pohon LOD0 serentak (terdekat menang), sisanya gumpalan; styleState.leafCards (dimatikan
 * auto-turun kualitas / pengaturan) membuat lapisan gumpalan menggantikan lapisan ini sepenuhnya.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { currentScope, withScope } from '../../engine/ResourceScope.js';
import { loadModel } from '../../world/assets/models.js';
import { pbrSurfaceMaterial } from '../../world/textures/pbrMaterials.js';
import { createWindDepthMaterial, applyWind } from '../../world/shaders/wind.js';
import { hash01 } from '../../world/vegetation/campusVegetation.js';
import { createTreeLayer, mergeModelGeometry } from './ukmTrees.js';

const BASE = 'models/unri/';
export const CARD_BUDGET = 55;
const CARD_NEAR = 40; // m: batas LOD0 kartu (anggaran 55 pohon dalam 40 m)
const ALPHA_TEST = 0.5;
const LEAF_TINT_MUL = 10 / 6; // tint instans daun ±10% (dasar instans ±6%)
const BARK_COLOR = 0xb08766; // pengali albedo abu-abu Bark001 → cokelat kayu
const WIND = Object.freeze({ weightMode: 'height', heightMin: 2, heightMax: 16, weightMin: 0, amplitude: 0.35 });

/** Spesies V15: pasangan GLB per spesies V11–V14 (jarak LOD1 sama; LOD0 kartu dibatasi CARD_NEAR). */
export const CARD_SPECIES = Object.freeze({
  v11: Object.freeze({ lod0: `${BASE}v15-pohon-ramping.glb`, lod1: `${BASE}v15-pohon-ramping-lod.glb` }),
  v12: Object.freeze({ lod0: `${BASE}v15-pohon-kecil.glb`, lod1: `${BASE}v15-pohon-kecil-lod.glb` }),
  v13: Object.freeze({ lod0: `${BASE}v15-pohon-lurus.glb`, lod1: `${BASE}v15-pohon-lurus-lod.glb` }),
  v14: Object.freeze({ lod0: `${BASE}v15-semak.glb`, lod1: `${BASE}v15-semak-lod.glb` }),
});

/**
 * Faktor warna daun menurut tinggi relatif t (0 bawah .. 1 atas): bawah gelap-sejuk, atas terang-hangat (sorotan). Murni, dites.
 * @returns {[number, number, number]} pengali RGB
 */
export function leafGradient(t) {
  const u = Math.min(1, Math.max(0, t));
  const k = 0.72 + 0.42 * u ** 0.8;
  return [k * (1 + 0.06 * u), k, k * (1 - 0.1 * u)];
}

function emptyGeometry(withColor) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
  if (withColor) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9).fill(1), 3));
  g.setIndex([0, 1, 2]);
  return g;
}

/** Pisahkan mesh GLB V15 per jenis material → {bark, leaf} geometri (posisi, normal bengkok, uv; daun + vertex color gradasi). */
export function mergeCardGeometry(root) {
  root.updateMatrixWorld(true);
  const parts = { bark: [], leaf: [] };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    parts[/daun/.test(o.material?.name ?? '') ? 'leaf' : 'bark'].push(g);
  });
  const leaf = parts.leaf.length ? mergeGeometries(parts.leaf, false) : emptyGeometry(true);
  const bark = parts.bark.length ? mergeGeometries(parts.bark, false) : emptyGeometry(false);
  leaf.computeBoundingBox();
  const { min, max } = leaf.boundingBox;
  const p = leaf.getAttribute('position');
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 1) {
    const m = 0.94 + 0.12 * hash01(p.getX(i) * 4.3, p.getZ(i) * 4.3 + p.getY(i), 91);
    const [r, g, b] = leafGradient((p.getY(i) - min.y) / Math.max(1e-3, max.y - min.y));
    col.set([r * m, g * m, b * m], i * 3);
  }
  leaf.setAttribute('color', new THREE.BufferAttribute(col, 3));
  leaf.computeBoundingSphere();
  bark.computeBoundingSphere();
  return { bark, leaf };
}

function leafAtlas() {
  return currentScope().get('ukm:leaf-atlas', () => {
    const t = new THREE.TextureLoader().load(`${import.meta.env?.BASE_URL ?? '/'}textures/daun/atlas.webp`);
    t.flipY = false; // UV GLB mengikuti konvensi glTF (v ke bawah)
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }, { dispose: (t) => t.dispose() });
}

/** Material daun: Lambert alpha-test dua sisi, vertex color gradasi, normal TIDAK dibalik pada sisi belakang (shading bola). */
function leafMaterial() {
  return currentScope().get('ukm:leaf-card-material', () => {
    const m = new THREE.MeshLambertMaterial({
      color: 0xffffff, map: leafAtlas(), vertexColors: true, alphaTest: ALPHA_TEST, side: THREE.DoubleSide,
    });
    applyWind(m, WIND);
    const wind = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      wind(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n  normal *= faceDirection; // batalkan pembalikan sisi belakang: normal sudah dibengkokkan ke luar gerombol\n#endif',
      );
    };
    m.customProgramCacheKey = () => `kartu-daun:${JSON.stringify(WIND)}`;
    m.name = 'daunKartuUkm';
    m.userData.pbr = true; // dilewati styleMaterial (tak di-flat-shade/anisotropi)
    return m;
  });
}

function leafDepthMaterial() {
  return currentScope().get('ukm:leaf-card-depth', () => {
    const d = createWindDepthMaterial(WIND);
    d.map = leafAtlas();
    d.alphaTest = ALPHA_TEST;
    d.side = THREE.DoubleSide;
    d.needsUpdate = true;
    return d;
  });
}

function barkMaterial(quality) {
  return currentScope().get(`ukm:bark-material:${quality}`, () => {
    const m = pbrSurfaceMaterial('bark', { color: BARK_COLOR, quality, roughness: 1 });
    m.name = 'kulitKayuPbr';
    return m;
  });
}

/** Material gumpalan LOD1 (vertex color), sama dengan lapisan V11–V14. */
function lodMaterial() {
  return currentScope().get('ukm:card-lod-material', () => {
    const m = applyWind(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide }), WIND);
    m.name = 'pohonKartuLod';
    return m;
  });
}

/**
 * Muat GLB V15 semua spesies lalu bangun lapisan kartu (panggil setelah region ada; hasil didaftarkan ke `scope`).
 * @returns {Promise<ReturnType<typeof createTreeLayer>>}
 */
export async function createCardLayer({ scope, instances, quality = 'sedang' }) {
  const loaded = await Promise.all(Object.entries(CARD_SPECIES).flatMap(([sp, cfg]) => ['lod0', 'lod1'].map(
    async (lod) => [sp, lod, await withScope(scope, () => loadModel(cfg[lod]))],
  )));
  return withScope(scope, () => {
    const geometries = {};
    const bark = {};
    const leaf = {};
    for (const [sp, lod, root] of loaded) {
      const key = `ukm:card-geo:${sp}:${lod}`;
      if (lod === 'lod1') {
        geometries[sp] = { ...geometries[sp], lod1: currentScope().get(key, () => mergeModelGeometry(root)) };
      } else {
        const g = currentScope().get(key, () => mergeCardGeometry(root), { dispose: (v) => { v.bark.dispose(); v.leaf.dispose(); } });
        bark[sp] = g.bark;
        leaf[sp] = g.leaf;
        geometries[sp] = { ...geometries[sp], lod0: g.leaf };
      }
    }
    const parts = [
      { name: 'lod0-kulit', material: barkMaterial(quality), geoms: bark },
      { name: 'lod0-daun', material: leafMaterial(), depth: leafDepthMaterial(), tintMul: LEAF_TINT_MUL, geoms: leaf },
    ];
    const layer = createTreeLayer(instances, geometries, lodMaterial(), { parts, budget: CARD_BUDGET, near: CARD_NEAR });
    currentScope().get('ukm:card-layer', () => layer, { dispose: (l) => l.dispose() });
    return layer;
  });
}
