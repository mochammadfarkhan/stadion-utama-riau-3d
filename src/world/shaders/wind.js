import { MeshDepthMaterial, RGBADepthPacking } from 'three';
import { WIND_UNIFORMS, WIND_GLSL_UNIFORMS, WIND_GLSL_FUNC } from './windState.js';
import { FADE_UNIFORMS, FADE_GLSL_DECL, FADE_GLSL_FRAGMENT } from '../../engine/occlusionFade.js';

/**
 * Menyuntikkan goyangan angin ke material yang SUDAH ADA lewat onBeforeCompile
 * (tanpa mengganti material, tanpa menambah draw call). Posisi vertex digeser
 * di vertex shader setelah `begin_vertex`; normal tidak diubah.
 *
 * Bobot (weight) per vertex, dihitung dari koordinat LOKAL geometri:
 * - 'height'   : clamp((position.y - heightMin) / (heightMax - heightMin), 0, 1) — akar diam, puncak bergoyang
 * - 'uvX'      : uv.x (0 = sisi yang menempel/diam, 1 = ujung bebas)
 * - 'uvArc'    : sin(uv.x * PI) — kedua ujung diam (spanduk terpancang di dua tiang), tengah bergelombang
 * - 'localX'   : clamp((position.x - xMin) / (xMax - xMin), 0, 1) — untuk geometri tanpa atribut uv (bendera)
 * - 'constant' : nilai tetap `weight`
 * `weightMin` (0..1) menaikkan lantai bobot: weight = mix(weightMin, 1, t) — mis. 0.2→1 untuk tajuk.
 *
 * Catatan bayangan: offset hanya berlaku pada program warna. Agar bayangan ikut
 * bergoyang, mesh perlu `customDepthMaterial` dari createWindDepthMaterial(opsi
 * yang sama). Ini hanya dipakai untuk tajuk pohon besar; objek lain menerima
 * bayangan statis (perbedaan tidak terlihat karena amplitudonya kecil).
 */

const WEIGHT_MODES = Object.freeze(['height', 'uvX', 'uvArc', 'localX', 'constant']);
const DEFAULTS = Object.freeze({
  weightMode: 'height', heightMin: 0, heightMax: 1, xMin: 0, xMax: 1, weight: 1, weightMin: 0, amplitude: 1, flutter: 0,
});

/** Format angka GLSL (selalu dengan titik desimal agar bertipe float). */
function f(n) {
  const s = String(Number(n));
  return s.includes('.') || s.includes('e') ? s : `${s}.0`;
}

/** Ekspresi GLSL bobot mentah (0..1) sesuai mode. */
function rawWeightExpr(o) {
  switch (o.weightMode) {
    case 'uvX': return 'clamp(uv.x, 0.0, 1.0)';
    case 'uvArc': return 'sin(clamp(uv.x, 0.0, 1.0) * 3.14159265)';
    case 'localX': return `clamp((position.x - ${f(o.xMin)}) / ${f(o.xMax - o.xMin)}, 0.0, 1.0)`;
    case 'constant': return f(o.weight);
    default: return `clamp((position.y - ${f(o.heightMin)}) / ${f(o.heightMax - o.heightMin)}, 0.0, 1.0)`;
  }
}

/** Ekspresi GLSL bobot akhir: mix(weightMin, 1, t). */
function weightExpr(o) {
  const raw = rawWeightExpr(o);
  return o.weightMin > 0 ? `mix(${f(o.weightMin)}, 1.0, ${raw})` : raw;
}

/** Potongan GLSL yang disisipkan setelah #include <begin_vertex>. */
function windVertexSnippet(o, fade = true) {
  const flutter = o.flutter > 0
    ? `transformed.z += sin(uWindTime * 6.0 + wWorldPos.y * 3.0) * wWeight * ${f(o.flutter)};`
    : '';
  return /* glsl */ `
#include <begin_vertex>
{
  #ifdef USE_INSTANCING
    vec4 wWorld4 = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #else
    vec4 wWorld4 = modelMatrix * vec4(position, 1.0);
  #endif
  vec3 wWorldPos = wWorld4.xyz;
  ${fade ? 'vFadeWorld = wWorldPos;' : ''}
  float wWeight = ${weightExpr(o)};
  transformed += windOffset(wWorldPos, wWeight) * ${f(o.amplitude)};
  ${flutter}
}`;
}

/** Validasi + normalisasi opsi (gagal cepat bila mode tidak dikenal). */
function normalizeOptions(options = {}) {
  const o = { ...DEFAULTS, ...options };
  if (!WEIGHT_MODES.includes(o.weightMode)) throw new Error(`applyWind: weightMode tidak dikenal: ${o.weightMode}`);
  if (o.heightMax === o.heightMin) throw new Error('applyWind: heightMax harus berbeda dari heightMin');
  if (o.xMax === o.xMin) throw new Error('applyWind: xMax harus berbeda dari xMin');
  if (o.weightMin < 0 || o.weightMin > 1) throw new Error('applyWind: weightMin harus 0..1');
  return o;
}

/** Hook onBeforeCompile: tautkan uniform by-reference + sisipkan GLSL. */
function makeOnBeforeCompile(o, snippet, fade) {
  return (shader) => {
    shader.uniforms.uWindTime = WIND_UNIFORMS.uWindTime;
    shader.uniforms.uWindStrength = WIND_UNIFORMS.uWindStrength;
    shader.uniforms.uWindDir = WIND_UNIFORMS.uWindDir;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL_UNIFORMS}\n${WIND_GLSL_FUNC}${fade ? FADE_GLSL_DECL : ''}`)
      .replace('#include <begin_vertex>', snippet);
    if (!fade) return;
    Object.assign(shader.uniforms, FADE_UNIFORMS);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FADE_GLSL_DECL}`)
      .replace('#include <clipping_planes_fragment>', FADE_GLSL_FRAGMENT);
  };
}

/**
 * Terapkan angin pada material yang ada (dimutasi di tempat: material three.js
 * memang objek stateful; tidak ada salinan agar tetap berbagi program & draw call).
 * @param {import('three').Material} material
 * @param {{weightMode?:string,heightMin?:number,heightMax?:number,xMin?:number,xMax?:number,weight?:number,weightMin?:number,amplitude?:number,flutter?:number}} options
 * @returns {import('three').Material} material yang sama
 */
export function applyWind(material, options = {}) {
  if (!material || typeof material.onBeforeCompile === 'undefined') throw new Error('applyWind: material tidak valid');
  const o = normalizeOptions(options);
  const fade = !material.isMeshDepthMaterial; // pass bayangan tidak ikut fade (bayangan tidak boleh bolong)
  const key = `wind:${JSON.stringify(o)}:${fade ? 'fade' : 'nofade'}`;
  material.onBeforeCompile = makeOnBeforeCompile(o, windVertexSnippet(o, fade), fade);
  material.customProgramCacheKey = () => key;
  material.userData.wind = o;
  material.needsUpdate = true;
  return material;
}

/**
 * Material kedalaman (shadow map) dengan goyangan yang sama, untuk
 * `mesh.customDepthMaterial` agar bayangan ikut bergerak.
 * @param {object} options opsi yang sama seperti applyWind
 * @returns {MeshDepthMaterial}
 */
export function createWindDepthMaterial(options = {}) {
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  return applyWind(depth, options);
}
