/**
 * Cahaya malam kota tanpa lampu nyata: emisi hangat yang dikalikan `uNight` (FACADE_UNIFORMS, diisi sistem kota dari jam permainan)
 * pada (a) permukaan jalan (kesan lampu jalan; tile & kota jauh) dan (b) peta tanah kota jauh lewat peta pendar `uGlowMap`
 * (kerapatan bangunan, baked `glow.webp`): kawasan padat bersinar dari jauh. Jendela menyala ada di facade.js.
 * Murni di bagian patch (patchNightGlowSource) supaya mudah diuji tanpa WebGL.
 */
import { FACADE_UNIFORMS } from './facade.js';

/** Warna cahaya sodium/LED hangat (linear). */
const WARM = 'vec3(1.0, 0.64, 0.3)';

/**
 * Sisipkan deklarasi uniform + emisi ke fragmen MeshLambertMaterial (sesudah emissivemap_fragment).
 * @param {{fragmentShader: string}} shader
 * @param {{strength: number, glowMap: boolean}} opts glowMap: pakai sampler uGlowMap pada vMapUv (material harus ber-`map`)
 */
export function patchNightGlowSource(shader, { strength, glowMap }) {
  const decl = `uniform float uNight;${glowMap ? '\nuniform sampler2D uGlowMap;' : ''}`;
  const term = glowMap
    ? `texture2D(uGlowMap, vMapUv).r * ${strength.toFixed(3)}`
    : strength.toFixed(3);
  return {
    fragmentShader: shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${decl}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += ${WARM} * uNight * ${term};`),
  };
}

/**
 * Pasang cahaya malam pada material (berantai dengan onBeforeCompile/kunci cache yang sudah ada).
 * @param {import('three').Material} material
 * @param {{strength?: number, glowMap?: import('three').Texture|null}} [opts]
 */
export function applyNightGlow(material, { strength = 0.25, glowMap = null } = {}) {
  const prev = material.onBeforeCompile;
  const prevKey = Object.hasOwn(material, 'customProgramCacheKey') ? `${material.customProgramCacheKey()}|` : '';
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.uNight = FACADE_UNIFORMS.uNight;
    if (glowMap) shader.uniforms.uGlowMap = { value: glowMap };
    const patched = patchNightGlowSource(shader, { strength, glowMap: Boolean(glowMap) });
    shader.fragmentShader = patched.fragmentShader;
  };
  material.customProgramCacheKey = () => `${prevKey}night-${strength}-${glowMap ? 'peta' : 'rata'}`;
  material.needsUpdate = true;
  return material;
}
