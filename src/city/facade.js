/**
 * Rincian fasad & atap bangunan kota TANPA geometri tambahan (tile v1 tanpa UV): shader menyisipkan
 * - dinding: pita lantai (3,2 m), jendela kaca per 3 m, lantai dasar lebih gelap (kios/ruko) dengan pintu gulung,
 * - atap miring (pelana): garis genteng tiap 0,45 m; atap datar: petak seng bernada beda tiap 6 m.
 * Pola dihitung dari posisi dunia + normal, memudar bertahap pada jarak kamera jauh (tidak berdesis di
 * pratinjau kota). Dipasang di material bersama (sekali); tanpa pola di fragmen tanpa kamera dekat → warna asli.
 */

const COMMON_V = 'varying vec3 vFacadeP;\nvarying vec3 vFacadeN;';
const COMMON_F = [
  'varying vec3 vFacadeP;',
  'varying vec3 vFacadeN;',
  'float facadeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
].join('\n');

/** Fade pola menurut jarak kamera: penuh < 900 m, hilang > 3500 m. */
const FADE = 'float facadeFade = 1.0 - smoothstep(900.0, 3500.0, distance(vFacadeP, cameraPosition));';

const WALL_FRAGMENT = [
  FADE,
  'vec3 fn = normalize(vFacadeN);',
  'if (abs(fn.y) < 0.5 && facadeFade > 0.01) {',
  '  float u = dot(vFacadeP.xz, vec2(fn.z, -fn.x));', // meter sepanjang dinding
  '  float v = vFacadeP.y;',
  '  float fi = floor(v / 3.2);',
  '  float fv = fract(v / 3.2);',
  '  float ci = floor(u / 3.0);',
  '  float fu = fract(u / 3.0);',
  '  float lit = facadeHash(vec2(ci, fi));',
  '  float win = step(0.2, fv) * step(fv, 0.74) * step(0.2, fu) * step(fu, 0.8);',
  '  vec3 glass = mix(vec3(0.045, 0.075, 0.11), vec3(0.12, 0.17, 0.22), lit);',
  '  float shop = 1.0 - step(0.5, fi);', // lantai dasar: kios/pintu gulung
  '  vec3 shutter = mix(vec3(0.10, 0.13, 0.17), vec3(0.22, 0.12, 0.09), step(0.6, facadeHash(vec2(ci, 7.0))));',
  '  float shopWin = step(0.08, fv) * step(fv, 0.8) * step(0.1, fu) * step(fu, 0.9);',
  '  diffuseColor.rgb = mix(diffuseColor.rgb, mix(glass, shutter, shop), (shop * shopWin + (1.0 - shop) * win) * 0.9 * facadeFade);',
  '  diffuseColor.rgb *= 1.0 - 0.10 * facadeFade * step(fv, 0.06);', // pelat lantai
  '}',
].join('\n');

const ROOF_FRAGMENT = [
  FADE,
  'vec3 rn = normalize(vFacadeN);',
  'if (facadeFade > 0.01) {',
  '  if (rn.y < 0.95) {', // miring: genteng
  '    float course = smoothstep(0.0, 0.18, fract(vFacadeP.y / 0.45)) * (1.0 - smoothstep(0.82, 1.0, fract(vFacadeP.y / 0.45)));',
  '    diffuseColor.rgb *= 1.0 - 0.16 * facadeFade * (1.0 - course);',
  '  } else {', // datar: petak seng
  '    float sheet = facadeHash(floor(vFacadeP.xz / 6.0));',
  '    diffuseColor.rgb *= 1.0 + (sheet - 0.5) * 0.22 * facadeFade;',
  '  }',
  '}',
].join('\n');

/** Sisipkan varying + pola ke sumber shader MeshLambertMaterial (murni; dites tanpa WebGL). */
export function patchFacadeSource(shader, kind) {
  const fragment = kind === 'roof' ? ROOF_FRAGMENT : WALL_FRAGMENT;
  return {
    vertexShader: shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON_V}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacadeP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvFacadeN = normalize(mat3(modelMatrix) * objectNormal);'),
    fragmentShader: shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON_F}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${fragment}`),
  };
}

/** Pasang rincian fasad pada material dinding ('wall') atau atap ('roof'). */
export function applyFacade(material, kind) {
  material.onBeforeCompile = (shader) => {
    const patched = patchFacadeSource(shader, kind);
    shader.vertexShader = patched.vertexShader;
    shader.fragmentShader = patched.fragmentShader;
  };
  material.customProgramCacheKey = () => `kota-facade-${kind}-v1`;
  material.needsUpdate = true;
  return material;
}
