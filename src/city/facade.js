/**
 * Rincian fasad & atap bangunan kota TANPA geometri tambahan (tile v1 tanpa UV): shader menyisipkan
 * - dinding: pita lantai (3,2 m), jendela kaca per 3 m, lantai dasar lebih gelap (kios/ruko) dengan pintu gulung,
 * - atap miring (pelana): garis genteng tiap 0,45 m; atap datar: petak seng bernada beda tiap 6 m.
 * Pola dihitung dari posisi dunia + normal, memudar bertahap pada jarak kamera jauh (tidak berdesis di
 * pratinjau kota). Dipasang di material bersama (sekali); tanpa pola di fragmen tanpa kamera dekat → warna asli.
 */

/** Uniform bersama semua material fasad: kekuatan malam 0..1 (jendela menyala). Ditulis sistem kota tiap frame. */
export const FACADE_UNIFORMS = { uNight: { value: 0 } };

/** Kekuatan malam (0 siang … 1 malam) dari jam 0–24: menyala 17:30→19:00, padam 05:00→06:30. Murni. */
export function nightFactor(hour) {
  const h = ((Number(hour) % 24) + 24) % 24;
  const ramp = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const t = h >= 12 ? ramp(17.5, 19, h) : 1 - ramp(5, 6.5, h);
  return t * t * (3 - 2 * t);
}

const COMMON_V = 'varying vec3 vFacadeP;\nvarying vec3 vFacadeN;\nvarying vec2 vFacadeId;';
const COMMON_F = [
  'varying vec3 vFacadeP;',
  'varying vec3 vFacadeN;',
  'varying vec2 vFacadeId;',
  'uniform float uNight;',
  'float facadeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
].join('\n');

/** Fade pola menurut jarak kamera: penuh < 900 m, hilang > 3500 m. */
const FADE = 'float facadeFade = 1.0 - smoothstep(900.0, 3500.0, distance(vFacadeP, cameraPosition));';

const WALL_FRAGMENT = [
  FADE,
  'float facadeGlow = 0.0;',
  'vec3 fn = normalize(vFacadeN);',
  // bangunan jauh (instans): atap berwarna sendiri per bangunan (hash pusat instans): terakota/bata/beton/seng (arah seni 2026-11-16)
  '#ifdef USE_INSTANCING',
  'if (fn.y >= 0.5) {',
  '  vec2 fid = floor(vFacadeId);',
  '  float rh = facadeHash(fid);',
  '  vec3 roofC = rh < 0.4 ? vec3(0.527, 0.125, 0.044) : rh < 0.62 ? vec3(0.376, 0.074, 0.037) : rh < 0.84 ? vec3(0.624, 0.195, 0.068) : vec3(0.323, 0.314, 0.292);', // sama dengan tilePalette NEW.roofFlat
  '  diffuseColor.rgb = roofC * (0.85 + 0.3 * facadeHash(fid + 3.1));',
  '}',
  '#endif',
  'if (abs(fn.y) < 0.5) {',
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
  '  float pane = shop * shopWin + (1.0 - shop) * win;',
  '  diffuseColor.rgb = mix(diffuseColor.rgb, mix(glass, shutter, shop), pane * 0.9 * facadeFade);',
  '  facadeGlow = pane * step(mix(0.45, 0.25, shop), facadeHash(vec2(ci * 1.7, fi + 3.0))) * (0.6 + 0.4 * facadeFade);', // sebagian jendela/kios menyala
  '  diffuseColor.rgb *= 1.0 - 0.10 * facadeFade * step(fv, 0.06);', // pelat lantai
  '}',
].join('\n');

/** Cahaya jendela malam (setelah emissivemap_fragment: totalEmissiveRadiance sudah ada). */
const WALL_EMISSIVE = 'totalEmissiveRadiance += vec3(1.0, 0.72, 0.38) * facadeGlow * uNight * 2.6;';

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
  // peralatan atap (AC luar / tandon): kotak kecil abu terang di ±8% petak 3 m (arah seni 2026-11-16, seperti gambar target)
  '    vec2 eq = fract(vFacadeP.xz / 3.0);',
  '    float box = step(0.92, facadeHash(floor(vFacadeP.xz / 3.0) + 11.0)) * step(0.25, eq.x) * step(eq.x, 0.7) * step(0.25, eq.y) * step(eq.y, 0.7);',
  '    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.44, 0.46), box * facadeFade);',
  '  }',
  '}',
].join('\n');

/** Posisi/normal dunia untuk fasad; memperhitungkan instanceMatrix (bangunan jauh = InstancedMesh). */
const INSTANCE_AWARE_VERTEX = [
  '#include <begin_vertex>',
  'vec4 facadeLocal = vec4(transformed, 1.0);',
  'vec3 facadeNormal = objectNormal;',
  '#ifdef USE_INSTANCING',
  '  facadeLocal = instanceMatrix * facadeLocal;',
  '  facadeNormal = mat3(instanceMatrix) * facadeNormal;',
  '#endif',
  'vFacadeP = (modelMatrix * facadeLocal).xyz;',
  'vFacadeN = normalize(mat3(modelMatrix) * facadeNormal);',
  'vFacadeId = vec2(0.0);',
  '#ifdef USE_INSTANCING',
  '  vFacadeId = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;',
  '#endif',
].join('\n');

/** Sisipkan varying + pola ke sumber shader MeshLambertMaterial (murni; dites tanpa WebGL). */
export function patchFacadeSource(shader, kind) {
  const fragment = kind === 'roof' ? ROOF_FRAGMENT : WALL_FRAGMENT;
  return {
    vertexShader: shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON_V}`)
      .replace('#include <begin_vertex>', INSTANCE_AWARE_VERTEX),
    fragmentShader: shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON_F}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${fragment}`)
      .replace('#include <emissivemap_fragment>', kind === 'roof' ? '#include <emissivemap_fragment>' : `#include <emissivemap_fragment>\n${WALL_EMISSIVE}`),
  };
}

/** Pasang rincian fasad pada material dinding ('wall') atau atap ('roof'). */
export function applyFacade(material, kind) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = FACADE_UNIFORMS.uNight;
    const patched = patchFacadeSource(shader, kind);
    shader.vertexShader = patched.vertexShader;
    shader.fragmentShader = patched.fragmentShader;
  };
  material.customProgramCacheKey = () => `kota-facade-${kind}-v4`;
  material.needsUpdate = true;
  return material;
}
