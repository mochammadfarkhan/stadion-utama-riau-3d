/**
 * Material kit gedung (spec §4.6): SATU atlas dibagi dua material agar draw call per klaster minimal —
 * 'opak' (dinding, atap, kaca, pintu, lampu; peta warna + kekasaran + emisif malam; warna vertex = palet) dan
 * 'potong' (roster, layar perforasi, railing, ilalang, jemuran; alphaTest, dua sisi, ikut bayangan berpola).
 * Papan nama punya material per klaster (signs.js). Di-cache per ResourceScope (scope EKSPLISIT, bukan
 * currentScope: aman dipanggil dari tugas scheduler). Tanpa canvas (Node/tes) → tekstur 1×1 netral.
 */
import {
  ClampToEdgeWrapping, CanvasTexture, Color, DataTexture, DoubleSide, LinearFilter, LinearMipmapLinearFilter,
  MeshStandardMaterial, NoColorSpace, RGBAFormat, SRGBColorSpace,
} from 'three';
import { createAtlasCanvases } from './atlas.js';

export const KIT_NIGHT = Object.freeze({ on: 1.0, off: 0 });
const GLOW_COLOR = 0xffe2b0;

function finish(tex, srgb, anisotropy) {
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function solid(rgb) {
  return new DataTexture(new Uint8Array([rgb[0], rgb[1], rgb[2], 255]), 1, 1, RGBAFormat);
}

/** Tekstur atlas (canvas di browser, 1×1 netral di Node). */
export function createAtlasTextures({ anisotropy = 8, createCanvas } = {}) {
  const canvases = createAtlasCanvases(createCanvas ? { createCanvas } : {});
  if (!canvases) {
    return {
      ready: false,
      map: finish(solid([235, 232, 226]), true, 1),
      roughnessMap: finish(solid([230, 230, 230]), false, 1),
      emissiveMap: finish(solid([0, 0, 0]), true, 1),
    };
  }
  return {
    ready: true,
    map: finish(new CanvasTexture(canvases.color), true, anisotropy),
    roughnessMap: finish(new CanvasTexture(canvases.rough), false, anisotropy),
    emissiveMap: finish(new CanvasTexture(canvases.glow), true, anisotropy),
  };
}

function buildKitMaterials(opts) {
  const tex = createAtlasTextures(opts);
  const opak = new MeshStandardMaterial({
    map: tex.map, roughnessMap: tex.roughnessMap, emissiveMap: tex.emissiveMap, emissive: new Color(GLOW_COLOR),
    emissiveIntensity: KIT_NIGHT.off, vertexColors: true, roughness: 1, metalness: 0,
  });
  opak.name = 'kit:opak';
  opak.userData.nightEmissive = { ...KIT_NIGHT };
  const potong = new MeshStandardMaterial({
    map: tex.map, roughnessMap: tex.roughnessMap, vertexColors: true, roughness: 1, metalness: 0,
    alphaTest: 0.5, side: DoubleSide,
  });
  potong.name = 'kit:potong';
  return Object.freeze({ opak, potong, textures: tex, atlasReady: tex.ready });
}

function disposeKit(kit) {
  kit.opak.dispose();
  kit.potong.dispose();
  for (const t of Object.values(kit.textures)) if (t?.isTexture) t.dispose();
}

/**
 * Material kit bersama per scope (sekali per scope; refcount scope). Lepas dengan scope.release('kit:materials')
 * atau scope.dispose().
 * @param {{get: Function}} scope ResourceScope
 * @param {{anisotropy?: number, createCanvas?: Function}} [opts]
 * @returns {{opak: MeshStandardMaterial, potong: MeshStandardMaterial, textures: object, atlasReady: boolean}}
 */
export function createKitMaterials(scope, opts = {}) {
  if (!scope || typeof scope.get !== 'function') throw new TypeError('createKitMaterials: scope wajib (ResourceScope)');
  return scope.get('kit:materials', () => buildKitMaterials(opts), { dispose: disposeKit });
}
