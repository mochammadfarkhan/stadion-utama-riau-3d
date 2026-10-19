/**
 * Tanah splat PBR (M8-T2): satu patch shader `onBeforeCompile` pada MeshStandardMaterial.
 * Lapisan: rumput, tanah lembap/serasah, tanah kering, kerikil, lumut. Bobot dasar dari atribut `splat` per simpul
 * (vec4: rumput, tanah, basah, kota — dari data ground M2, lihat splatAttribute); tambalan serasah di dalam rumput,
 * lumut teduh, kerikil di tepi tanah diturunkan di shader dari noise dunia (tanpa kanal bobot baru, tanpa bake ulang).
 * Blend berbasis tinggi (luminansi albedo), anti-tiling (rumput: dua sampel berotasi/berskala dicampur noise makro),
 * variasi makro (periode 37-53 m, +-12% terang, geser hijau-kuning), basah (gelap + roughness turun), normal detail
 * hanya < 28 m (memudar mulai 16 m), mip-bias jauh. UV = koordinat dunia (atribut uv drape/terrain = meter dunia).
 * Tiga tingkat kualitas (lihat TERRAIN_LAYERS di pbrCore); percabangan per bobot + textureGrad menjaga rata-rata sampel.
 */
import { MeshStandardMaterial, Vector3 } from 'three';
import { loadPbr } from '../textures/pbr.js';
import { TERRAIN_LAYERS, TILE_M, tierForQuality } from '../textures/pbrCore.js';

const DRY_TINT = Object.freeze([1.04, 0.82, 0.68]); // geser pasir -> tanah laterit Pekanbaru [INFERENSI visual]
const MOIST_TINT = Object.freeze([3.6, 2.9, 1.55]);   // serasah gelap -> cokelat-oranye hangat (pengali LINEAR; grading kartun menggeser bayangan ke biru, jadi condong hangat)
const GRAVEL_TINT = Object.freeze([0.66, 0.62, 0.55]); // kerikil putih bersih -> abu-krem
const KOTA_COLOR = 0xb9b59a;                          // = CITY_GROUND_COLOR (sambungan ke tile kota)

/**
 * Atribut splat per titik dunia xz (Float32Array [x0, z0, ...]) dari grid bobot byte (sampel (i, j) di origin + (i·step,
 * j·step)): tiap sampel dinormalisasi (rumput, tanah, basah)/jumlah, semua nol -> kota = 1; interpolasi bilinear.
 * @returns {Float32Array} vec4 per titik (rumput, tanah, basah, kota)
 */
export function splatAttribute(xz, weights, origin, step = 4) {
  const { n } = weights;
  const cache = new Float32Array(n * n * 4);
  for (let i = 0; i < n * n; i += 1) {
    const g = weights.grass[i];
    const s = weights.soil[i];
    const w = weights.wet[i];
    const t = g + s + w;
    if (t === 0) cache[i * 4 + 3] = 1;
    else {
      cache[i * 4] = g / t;
      cache[i * 4 + 1] = s / t;
      cache[i * 4 + 2] = w / t;
    }
  }
  const count = xz.length / 2;
  const out = new Float32Array(count * 4);
  for (let v = 0; v < count; v += 1) {
    const fx = Math.min(Math.max((xz[2 * v] - origin.x) / step, 0), n - 1);
    const fz = Math.min(Math.max((xz[2 * v + 1] - origin.z) / step, 0), n - 1);
    const i0 = Math.min(Math.floor(fx), n - 2);
    const j0 = Math.min(Math.floor(fz), n - 2);
    const u = fx - i0;
    const t = fz - j0;
    for (let k = 0; k < 4; k += 1) {
      const c00 = cache[(j0 * n + i0) * 4 + k];
      const c10 = cache[(j0 * n + i0 + 1) * 4 + k];
      const c01 = cache[((j0 + 1) * n + i0) * 4 + k];
      const c11 = cache[((j0 + 1) * n + i0 + 1) * 4 + k];
      out[v * 4 + k] = (c00 * (1 - u) + c10 * u) * (1 - t) + (c01 * (1 - u) + c11 * u) * t;
    }
  }
  return out;
}

/** Atribut splat konstan (mis. lantai hutan tanpa grid bobot) untuk `count` titik. */
export function constantSplat(count, [g, s, w, k = 0]) {
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) out.set([g, s, w, k], i * 4);
  return out;
}

const VERT_DECL = /* glsl */ `
attribute vec4 splat;
varying vec4 vSplat;
varying vec2 vWXZ;
varying float vDistCam;
`;

const FRAG_DECL = /* glsl */ `
uniform sampler2D tGrass;
uniform sampler2D tMoist;
uniform sampler2D tDry;
#ifdef TS_GRAVEL
uniform sampler2D tGravel;
#endif
#ifdef TS_MOSS
uniform sampler2D tMoss;
#endif
#ifdef TS_NORMAL
uniform sampler2D nGrass;
uniform sampler2D nMoist;
uniform float uNormalStrength;
#endif
uniform vec4 uTile;
uniform float uTileMoss;
uniform float uMoistBias;
uniform float uPatch;
uniform vec3 uDryTint;
uniform vec3 uMoistTint;
uniform vec3 uGravelTint;
uniform float uGravel;
uniform vec3 uKota;
varying vec4 vSplat;
varying vec2 vWXZ;
varying float vDistCam;

float tsHash(vec2 p) { p = mod(p, 289.0); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tsVN(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tsHash(i), tsHash(i + vec2(1.0, 0.0)), f.x), mix(tsHash(i + vec2(0.0, 1.0)), tsHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float tsLum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
#define TS_TEX(t, k) textureGrad(t, tsXZ * (k), tsDx * (k), tsDy * (k)).rgb
`;

const MAP_BLOCK = /* glsl */ `
vec2 tsXZ = vWXZ;
float tsMip = 1.0 + smoothstep(25.0, 140.0, vDistCam) * 1.6;
vec2 tsDx = dFdx(tsXZ) * tsMip;
vec2 tsDy = dFdy(tsXZ) * tsMip;
vec4 tsSp = vSplat / max(vSplat.x + vSplat.y + vSplat.z + vSplat.w, 1e-4);
float tsMid = tsVN(tsXZ / 11.0 + 17.0);
float tsFine = tsVN(tsXZ / 2.7 + 41.0);
float tsBlot = tsMid * 0.65 + tsFine * 0.35;
float tsFDry = (1.0 - uMoistBias) * smoothstep(0.25, 0.75, tsVN(tsXZ / 23.0 + 5.0));
float tsBare = smoothstep(0.58, 0.72, tsBlot) * uPatch;
float tsWet = tsSp.z;
float tsMossAmt = 0.0;
#ifdef TS_MOSS
tsMossAmt = tsSp.x * (1.0 - tsBare) * smoothstep(0.58, 0.78, tsVN(tsXZ / 17.0 + 7.0)) * 0.5 + tsWet * 0.12;
#endif
float tsGravelAmt = 0.0;
#ifdef TS_GRAVEL
tsGravelAmt = clamp(4.0 * tsSp.y * (tsSp.x + 0.5 * tsSp.z), 0.0, 1.0) * smoothstep(0.5, 0.68, tsFine) * uGravel;
#endif
vec4 wA = vec4(
  max(tsSp.x * (1.0 - tsBare * 0.65) - tsMossAmt, 0.0),
  tsSp.y * (1.0 - tsFDry) + tsWet * 0.9 + tsSp.x * tsBare * 0.65,
  tsSp.y * tsFDry,
  tsGravelAmt);
float wM = tsMossAmt;
float tsTot = max(wA.x + wA.y + wA.z + wA.w + wM, 1e-4);
wA /= tsTot; wM /= tsTot;
vec3 cG = vec3(0.0); vec3 cM = vec3(0.0); vec3 cD = vec3(0.0); vec3 cV = vec3(0.0); vec3 cO = vec3(0.0);
float bG = 0.0; float bM = 0.0; float bD = 0.0; float bV = 0.0; float bO = 0.0;
if (wA.x > 0.02) {
  cG = TS_TEX(tGrass, uTile.x);
#ifdef TS_DUAL
  mat2 tsRot = mat2(0.80, -0.60, 0.60, 0.80);
  vec2 tsQ = tsRot * tsXZ * 0.71 + vec2(13.7, 5.3);
  vec3 cG2 = textureGrad(tGrass, tsQ * uTile.x, tsRot * tsDx * 0.71 * uTile.x, tsRot * tsDy * 0.71 * uTile.x).rgb;
  cG = mix(cG, cG2, smoothstep(0.3, 0.7, tsVN(tsXZ / 19.0 + 3.0)));
#endif
  bG = wA.x + tsLum(cG) * 0.9;
}
if (wA.y > 0.02) { cM = TS_TEX(tMoist, uTile.y) * uMoistTint; bM = wA.y + tsLum(cM) * 0.9 + 0.1; }
if (wA.z > 0.02) { cD = TS_TEX(tDry, uTile.z) * uDryTint; bD = wA.z + tsLum(cD) * 0.9; }
#ifdef TS_GRAVEL
if (wA.w > 0.02) { cV = TS_TEX(tGravel, uTile.w) * uGravelTint; bV = wA.w + tsLum(cV) * 0.9 - 0.1; }
#endif
#ifdef TS_MOSS
if (wM > 0.02) { cO = TS_TEX(tMoss, uTileMoss); bO = wM + tsLum(cO) * 0.9; }
#endif
float tsMax = max(max(max(bG, bM), max(bD, bV)), bO);
float tsDepth = 0.42;
float fG = max(bG - tsMax + tsDepth, 0.0) * step(0.02, wA.x);
float fM = max(bM - tsMax + tsDepth, 0.0) * step(0.02, wA.y);
float fD = max(bD - tsMax + tsDepth, 0.0) * step(0.02, wA.z);
float fV = max(bV - tsMax + tsDepth, 0.0) * step(0.02, wA.w);
float fO = max(bO - tsMax + tsDepth, 0.0) * step(0.02, wM);
float fS = max(fG + fM + fD + fV + fO, 1e-4);
vec3 tsCol = (cG * fG + cM * fM + cD * fD + cV * fV + cO * fO) / fS;
float tsRoughBase = (0.95 * fG + 0.9 * fM + 0.85 * fD + 0.8 * fV + 0.95 * fO) / fS;
float tsMacro = tsVN(tsXZ / 37.0) * 0.6 + tsVN(tsXZ / 53.0 + 9.0) * 0.4;
float tsHue = tsVN(tsXZ / 41.0 + 5.0) - 0.5;
tsCol *= 1.0 + (tsMacro - 0.5) * 0.24 + (tsMid - 0.5) * 0.18 + (tsFine - 0.5) * 0.16; // makro 37-53 m + mid 11 m + halus 2,7 m (tekstur jauh sudah rata)
float tsGrassy = (fG + fO * 0.5) / fS;
tsCol *= mix(vec3(1.0), vec3(1.0 + tsHue * 0.28, 1.0 + tsHue * 0.06, 1.0 - tsHue * 0.45), tsGrassy);
float tsWetK = smoothstep(0.15, 0.7, tsWet);
tsCol *= mix(1.0, 0.6, tsWetK);
tsCol = mix(tsCol, uKota * (0.92 + 0.16 * tsMacro), tsSp.w);
float tsRough = mix(tsRoughBase, 0.28, tsWetK);
diffuseColor.rgb *= tsCol;
`;

const NORMAL_BLOCK = /* glsl */ `
#ifdef TS_NORMAL
{
  float tsFade = 1.0 - smoothstep(16.0, 28.0, vDistCam);
  if (tsFade > 0.01) {
    vec2 uvN = vec2(tsXZ.x, -tsXZ.y);
    vec2 dxN = vec2(tsDx.x, -tsDx.y);
    vec2 dyN = vec2(tsDy.x, -tsDy.y);
    vec2 nxy = vec2(0.0);
    float wg = wA.x + wM;
    float ws = wA.y + 0.35 * wA.z;
    if (wg > 0.03) nxy += (textureGrad(nGrass, uvN * uTile.x, dxN * uTile.x, dyN * uTile.x).xy * 2.0 - 1.0) * wg;
    if (ws > 0.03) nxy += (textureGrad(nMoist, uvN * uTile.y, dxN * uTile.y, dyN * uTile.y).xy * 2.0 - 1.0) * ws;
    nxy *= uNormalStrength * tsFade;
    mat3 tsTbn = getTangentFrame(-vViewPosition, normal, uvN);
    normal = normalize(tsTbn * vec3(nxy, 1.0));
  }
}
#endif
`;

/**
 * Material tanah splat untuk satu tingkat kualitas. Tekstur dimuat lewat loadPbr (cache ResourceScope aktif — panggil di
 * dalam withScope bila perlu); material TIDAK memiliki tekstur (scope yang melepasnya), cukup `material.dispose()`.
 * Wet registry memengaruhi `color` (gelap) dan `roughness` (turun) seperti material tanah lain.
 * @param {{quality?: 'tinggi'|'sedang'|'rendah', moistBias?: number, patch?: number, name?: string}} [opts]
 *   moistBias 0..1: porsi tanah yang lembap/serasah (distrik 0.35, lantai hutan 0.9); patch 0..1: tambalan serasah dalam rumput;
 *   gravel 0..1: kekuatan kerikil di batas tanah/rumput (0 = tanpa).
 */
export function createTerrainSplatMaterial({ quality = 'tinggi', moistBias = 0.35, patch = 1, gravel = 0.7, name = 'tanahSplat' } = {}) {
  const cfg = TERRAIN_LAYERS[quality] ?? TERRAIN_LAYERS.tinggi;
  const tier = tierForQuality(quality);
  const aniso = quality === 'rendah' ? 2 : 8; // tinggi & sedang berbagi tekstur (kunci cache sama)
  const albedo = (n) => loadPbr(n, { tier, anisotropy: aniso, kinds: ['albedo'] }).map;
  const normal = (n) => loadPbr(n, { tier, anisotropy: 4, kinds: ['normal'] }).normalMap;
  const has = (n) => cfg.layers.includes(n);
  const maps = {
    tGrass: albedo('grass'), tMoist: albedo('soilMoist'), tDry: albedo('soilDry'),
    ...(has('gravel') ? { tGravel: albedo('gravel') } : {}),
    ...(has('moss') ? { tMoss: albedo('moss') } : {}),
    ...(cfg.normal ? { nGrass: normal('grass'), nMoist: normal('soilMoist') } : {}),
  };
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, normalMap: cfg.normal ? maps.nGrass : null });
  mat.name = name;
  mat.userData.pbr = true;
  mat.userData.baseRoughness = 1;
  mat.userData.quality = quality;
  const kota = new Vector3();
  const c = (hex) => ({ r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 });
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const k = c(KOTA_COLOR);
  kota.set(lin(k.r), lin(k.g), lin(k.b));
  const uniforms = {
    uTile: { value: [1 / TILE_M.grass, 1 / TILE_M.soilMoist, 1 / TILE_M.soilDry, 1 / TILE_M.gravel] },
    uTileMoss: { value: 1 / TILE_M.moss },
    uMoistBias: { value: moistBias },
    uPatch: { value: patch },
    uDryTint: { value: new Vector3(...DRY_TINT) },
    uMoistTint: { value: new Vector3(...MOIST_TINT) },
    uGravelTint: { value: new Vector3(...GRAVEL_TINT) },
    uGravel: { value: gravel },
    uKota: { value: kota },
    uNormalStrength: { value: 0.9 },
    ...Object.fromEntries(Object.entries(maps).map(([key, tex]) => [key, { value: tex }])),
  };
  const defines = {
    ...(cfg.dualGrass ? { TS_DUAL: '' } : {}), ...(has('gravel') ? { TS_GRAVEL: '' } : {}),
    ...(has('moss') ? { TS_MOSS: '' } : {}), ...(cfg.normal ? { TS_NORMAL: '' } : {}),
  };
  mat.defines = { ...mat.defines, ...defines };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat; vWXZ = uv;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvDistCam = -mvPosition.z;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace('#include <map_fragment>', MAP_BLOCK)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = min(roughness, tsRough);')
      .replace('#include <normal_fragment_maps>', NORMAL_BLOCK);
  };
  mat.customProgramCacheKey = () => `terrainSplat:${quality}`;
  return mat;
}
