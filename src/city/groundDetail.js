/**
 * "Tekstur" tanah kota di SELURUH wilayah tanpa berkas gambar (0 MB GPU, jadi tak perlu dikompres): shader menambah variasi
 * noise nilai pada landuse/jalan/tanah dasar/air menurut posisi DUNIA, tiga skala yang memudar bertahap dengan jarak
 * kamera: bercak luas (40 m; terlihat dari udara), tekstur sedang (7 m), butir halus (1,3 m; hanya dekat).
 * Warna dasar tetap dari vertex color; pola hanya mengalikan luminans (±14%), jadi aman untuk semua lapisan datar.
 */

const COMMON_V = 'varying vec3 vGroundP;';
const COMMON_F = [
  'varying vec3 vGroundP;',
  'uniform float uGroundGrain;',
  'float gdHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  'float gdValue(vec2 p) {',
  '  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(gdHash(i), gdHash(i + vec2(1.0, 0.0)), f.x), mix(gdHash(i + vec2(0.0, 1.0)), gdHash(i + vec2(1.0, 1.0)), f.x), f.y);',
  '}',
].join('\n');

const FRAGMENT = [
  'float gdDist = distance(vGroundP, cameraPosition);',
  'float gdFine = 1.0 - smoothstep(250.0, 1400.0, gdDist);',
  'float gdMid = 1.0 - smoothstep(1500.0, 7000.0, gdDist);',
  'float gdVar = (gdValue(vGroundP.xz / 40.0) - 0.5) * 0.16',
  '  + (gdValue(vGroundP.xz / 7.0) - 0.5) * 0.14 * gdMid',
  '  + (gdValue(vGroundP.xz / 1.3) - 0.5) * 0.18 * gdFine * uGroundGrain;',
  'diffuseColor.rgb *= 1.0 + gdVar;',
].join('\n');

/** Sisipkan varying + pola ke sumber shader (murni; dites tanpa WebGL). */
export function patchGroundDetailSource(shader) {
  return {
    vertexShader: shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON_V}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundP = (modelMatrix * vec4(transformed, 1.0)).xyz;'),
    fragmentShader: shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON_F}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT}`),
  };
}

/**
 * Pasang detail tanah pada material (berantai dengan onBeforeCompile yang sudah ada).
 * @param {import('three').Material} material
 * @param {string} name kunci cache program
 * @param {number} [grain=1] pengali butir halus (0 = tanpa butir)
 */
export function applyGroundDetail(material, name, grain = 1) {
  const prev = material.onBeforeCompile;
  const own = { uGroundGrain: { value: grain } };
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    Object.assign(shader.uniforms, own);
    const patched = patchGroundDetailSource(shader);
    shader.vertexShader = patched.vertexShader;
    shader.fragmentShader = patched.fragmentShader;
  };
  material.customProgramCacheKey = () => `kota-ground-detail-${name}-${grain}`;
  material.needsUpdate = true;
  return material;
}
