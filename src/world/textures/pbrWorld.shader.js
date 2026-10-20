/**
 * Potongan GLSL material PBR dunia (M8-T3). Satu proyeksi sumbu-dominan di ruang dunia (meter) per peta: normal geometri
 * dari turunan posisi (per segitiga, tanpa varying normal), UV tangan-kanan (lihat projectUv di pbrWorldCore.js),
 * turunan UV analitik (linear) untuk textureGrad. Hanya aktif saat uWpOn > 0.5 (gaya kartun/facet); 'asli' tidak berubah.
 * Dua varian: umum (GLB hero: satu set, noda dinding bawah, karat tepi atap) dan KIT (opak kit: plester + seng hanya di
 * sel atlas dinding/atap).
 */
import { KIT_CELL_BOUNDS as B } from './pbrWorldCore.js';

export const VERT_DECL = /* glsl */ `varying vec3 vWpP;`;
export const VERT_BODY = /* glsl */ `
{
  vec4 wpL = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wpL = instanceMatrix * wpL;
#endif
  vWpP = (modelMatrix * wpL).xyz;
}
`;

const COMMON = /* glsl */ `
varying vec3 vWpP;
float wpHash(vec2 p) { p = mod(p, 289.0); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wpVN(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wpHash(i), wpHash(i + vec2(1.0, 0.0)), f.x), mix(wpHash(i + vec2(0.0, 1.0)), wpHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Proyeksi sumbu-dominan tangan-kanan (salinan projectUv); linear terhadap p sehingga turunan UV = proyeksi turunan p.
vec2 wpProj(vec3 p, vec3 n) {
  vec3 a = abs(n);
  if (a.y >= a.x && a.y >= a.z) return vec2(p.x, n.y >= 0.0 ? -p.z : p.z);
  if (a.x >= a.z) return vec2(n.x >= 0.0 ? -p.z : p.z, p.y);
  return vec2(n.z >= 0.0 ? p.x : -p.x, p.y);
}
// Kompres kejenuhan lembut (salinan compressSaturation).
vec3 wpCompress(vec3 c, float maxS) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float s = mx > 1e-4 ? (mx - mn) / mx : 0.0;
  if (s <= maxS) return c;
  float k = (maxS + (s - maxS) * 0.35) / s;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return max(vec3(l) + (c - vec3(l)) * k, 0.0);
}
mat3 wpTBN(vec3 eyePos, vec3 sn, vec2 uv) {
  vec3 q0 = dFdx(eyePos); vec3 q1 = dFdy(eyePos);
  vec2 st0 = dFdx(uv); vec2 st1 = dFdy(uv);
  vec3 q1p = cross(q1, sn); vec3 q0p = cross(sn, q0);
  vec3 T = q1p * st0.x + q0p * st1.x;
  vec3 Bt = q1p * st0.y + q0p * st1.y;
  float det = max(dot(T, T), dot(Bt, Bt));
  float sc = det == 0.0 ? 0.0 : inversesqrt(det);
  return mat3(T * sc, Bt * sc, sn);
}
`;

/** ---- Varian umum (hero GLB) ---- */
export const GENERIC_DECL = /* glsl */ `${COMMON}
uniform float uWpOn;
uniform float uWpNormalOn;
uniform float uWpOrmOn;
uniform sampler2D tWpA;
uniform sampler2D tWpN;
uniform sampler2D tWpO;
uniform float uWpTile;
uniform vec3 uWpAvg;
uniform float uWpDetail;
uniform float uWpMaxSat;
uniform float uWpLift;
uniform float uWpRough;
uniform float uWpMetal;
uniform float uWpNormalK;
uniform vec2 uWpStain;
uniform vec4 uWpBox;
vec2 wpUv = vec2(0.0); vec2 wpDx = vec2(0.0); vec2 wpDy = vec2(0.0);
float wpMip = 1.0;
`;

export const GENERIC_MAP = /* glsl */ `
#include <map_fragment>
if (uWpOn > 0.5) {
  vec3 wpGN = normalize(cross(dFdx(vWpP), dFdy(vWpP)));
  wpUv = wpProj(vWpP, wpGN);
  wpMip = 1.0 + smoothstep(30.0, 160.0, length(vViewPosition)) * 1.4;
  wpDx = wpProj(dFdx(vWpP), wpGN) * wpMip;
  wpDy = wpProj(dFdy(vWpP), wpGN) * wpMip;
  vec3 wpAlb = textureGrad(tWpA, wpUv * uWpTile, wpDx * uWpTile, wpDy * uWpTile).rgb;
  vec3 wpDet = mix(vec3(1.0), wpAlb / max(uWpAvg, vec3(0.02)), uWpDetail);
  vec3 wpBase = wpCompress(diffuseColor.rgb, uWpMaxSat) * uWpLift;
  vec3 wpCol = wpBase * wpDet;
#ifdef WP_STAIN
  {
    float h = (vWpP.y - uWpStain.x) / max(uWpStain.y, 0.1);
    float n = wpVN(wpUv / 1.7 + 3.0) * 0.6 + wpVN(wpUv / 0.45 + 11.0) * 0.4;
    float dirt = (1.0 - smoothstep(0.0, 1.0, h)) * (0.35 + 0.65 * smoothstep(0.3, 0.75, n));
    wpCol *= mix(vec3(1.0), vec3(0.6, 0.66, 0.46), dirt * 0.7);
  }
#endif
#ifdef WP_RUST
  {
    float de = min(min(vWpP.x - uWpBox.x, uWpBox.z - vWpP.x), min(vWpP.z - uWpBox.y, uWpBox.w - vWpP.z));
    float n = wpVN(wpUv / 0.9 + 5.0) * 0.6 + wpVN(wpUv / 0.25 + 2.0) * 0.4;
    float rust = (1.0 - smoothstep(0.0, 0.9, de)) * smoothstep(0.38, 0.72, n);
    wpCol = mix(wpCol, vec3(0.30, 0.14, 0.07) * (0.5 + dot(wpBase, vec3(0.33))), rust * 0.5);
  }
#endif
  diffuseColor.rgb = wpCol;
}
`;

export const GENERIC_ROUGH = /* glsl */ `
#include <roughnessmap_fragment>
if (uWpOn > 0.5 && uWpOrmOn > 0.5) {
  vec3 wpOrm = textureGrad(tWpO, wpUv * uWpTile, wpDx * uWpTile, wpDy * uWpTile).rgb;
  roughnessFactor = clamp(wpOrm.g * uWpRough, 0.18, 1.0);
  diffuseColor.rgb *= mix(1.0, wpOrm.r, 0.55);
}
`;

export const GENERIC_METAL = /* glsl */ `
#include <metalnessmap_fragment>
if (uWpOn > 0.5) metalnessFactor *= uWpMetal;
`;

export const GENERIC_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
if (uWpOn > 0.5 && uWpNormalOn > 0.5) {
  float wpFade = 1.0 - smoothstep(18.0, 42.0, length(vViewPosition));
  mat3 wpT = wpTBN(-vViewPosition, normal, wpUv);
  vec2 wpN = textureGrad(tWpN, wpUv * uWpTile, wpDx * uWpTile, wpDy * uWpTile).xy * 2.0 - 1.0;
  normal = normalize(wpT * vec3(wpN * uWpNormalK * wpFade, 1.0));
}
`;

/** ---- Varian KIT (opak kit: atlas + vertex color; PBR hanya di sel dinding/atap) ---- */
export const KIT_DECL = /* glsl */ `${COMMON}
uniform float uWpOn;
uniform float uWpNormalOn;
uniform sampler2D tKitPlA;
uniform sampler2D tKitPlN;
uniform sampler2D tKitRfA;
uniform sampler2D tKitRfN;
uniform vec4 uKitTile;
uniform vec3 uKitAvgPl;
uniform vec3 uKitAvgRf;
uniform float uKitNormalK;
float wpRole = 0.0;
vec2 wpUv = vec2(0.0); vec2 wpDx = vec2(0.0); vec2 wpDy = vec2(0.0);
float wpMip = 1.0;
`;

const fx = (n) => n.toFixed(4);
export const KIT_MAP = /* glsl */ `
#include <map_fragment>
#ifdef USE_MAP
if (uWpOn > 0.5) {
  vec2 kuv = vMapUv;
  float wall = step(${fx(B.wallV)}, kuv.y) * step(kuv.x, ${fx(B.wallU)});
  float roof = step(${fx(B.roofV0)}, kuv.y) * step(kuv.y, ${fx(B.roofV1) + '- 0.0001'}) * step(kuv.x, ${fx(B.roofU)});
  wpRole = wall + 2.0 * roof;
  vec3 wpGN = normalize(cross(dFdx(vWpP), dFdy(vWpP)));
  wpUv = wpProj(vWpP, wpGN);
  wpMip = 1.0 + smoothstep(30.0, 160.0, length(vViewPosition)) * 1.4;
  wpDx = wpProj(dFdx(vWpP), wpGN) * wpMip;
  wpDy = wpProj(dFdy(vWpP), wpGN) * wpMip;
  if (wpRole > 0.5) {
    vec3 wpDet;
    float tl;
    if (wpRole < 1.5) {
      tl = uKitTile.x;
      wpDet = textureGrad(tKitPlA, wpUv * tl, wpDx * tl, wpDy * tl).rgb / max(uKitAvgPl, vec3(0.02));
      wpDet = mix(vec3(1.0), wpDet, 0.8);
      diffuseColor.rgb = vec3(0.9) * wpDet * (diffuse);
    } else {
      tl = uKitTile.y;
      wpDet = textureGrad(tKitRfA, wpUv * tl, wpDx * tl, wpDy * tl).rgb / max(uKitAvgRf, vec3(0.02));
      wpDet = mix(vec3(1.0), wpDet, 0.75);
      diffuseColor.rgb = vec3(0.85) * wpDet * (diffuse);
    }
  }
}
#endif
`;

export const KIT_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
if (uWpOn > 0.5 && uWpNormalOn > 0.5) {
  float wpFade = 1.0 - smoothstep(18.0, 42.0, length(vViewPosition));
  mat3 wpT = wpTBN(-vViewPosition, normal, wpUv);
  if (wpRole > 0.5) {
    vec2 wpN;
    float tl;
    if (wpRole < 1.5) { tl = uKitTile.x; wpN = textureGrad(tKitPlN, wpUv * tl, wpDx * tl, wpDy * tl).xy * 2.0 - 1.0; }
    else { tl = uKitTile.y; wpN = textureGrad(tKitRfN, wpUv * tl, wpDx * tl, wpDy * tl).xy * 2.0 - 1.0; }
    normal = normalize(wpT * vec3(wpN * uKitNormalK * wpFade, 1.0));
  }
}
`;

/** ---- Aspal aus (jalan servis kartun): tambalan pudar abu terang + tambalan perbaikan gelap bertepi tegas ---- */
export const WEAR_DECL = COMMON;
export const WEAR_MAP = /* glsl */ `
#include <map_fragment>
{
  vec2 w = vWpP.xz;
  float big = wpVN(w / 9.0 + 4.0);
  float mid = wpVN(w / 2.3 + 9.0);
  float fine = wpVN(w / 0.7);
  float worn = smoothstep(0.52, 0.8, big);
  float fixp = smoothstep(0.64, 0.7, wpVN(w / 5.5 + 21.0));
  float lane = smoothstep(0.55, 0.9, wpVN(vec2(w.x * 0.18 + w.y * 0.06, w.y * 0.18 - w.x * 0.06) + 13.0));
  diffuseColor.rgb *= 1.0 + worn * 0.45 + (mid - 0.5) * 0.3 - lane * 0.1;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.66, 0.65, 0.63), fixp * 0.85);
  diffuseColor.rgb *= 1.0 + (fine - 0.5) * 0.14;
}
`;
