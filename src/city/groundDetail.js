/**
 * "Tekstur" tanah kota di SELURUH wilayah: shader menambah variasi
 * noise nilai pada landuse/jalan/tanah dasar/air menurut posisi DUNIA, tiga skala yang memudar bertahap dengan jarak
 * kamera: bercak luas (40 m; terlihat dari udara), tekstur sedang (7 m), butir halus (1,3 m; hanya dekat).
 * Warna dasar tetap dari vertex color; pola hanya mengalikan luminans (±14%), jadi aman untuk semua lapisan datar.
 * Selain noise, ada 2 peta rincian kecil abu-abu 512² (paving & rumput; data linear, ×2 = pengali ≈ 1) yang diulang di
 * permukaan terang non-hijau (paving) dan hijau dominan (rumput); memudar menurut jarak, air & aspal gelap tak disentuh.
 */
import * as THREE from 'three';

/** Meter per ulangan peta rincian + berkasnya. */
export const GROUND_TEX = Object.freeze({ paveRepeat: 8, grassRepeat: 24, farScale: 4, files: { pave: 'textures/kota/paving.webp', grass: 'textures/kota/rumput.webp' } });

/** Tekstur netral 1×1 (0,5 × 2 = 1): aman disampel sebelum berkas termuat. */
const neutralTex = () => {
  const t = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
};

/** Uniform bersama detail tanah: waktu (dtk) & kekuatan bayangan awan 0..1 (diisi sistem kota). */
export const GROUND_UNIFORMS = { uCloudT: { value: 0 }, uCloudAmt: { value: 1 }, uPaveTex: { value: neutralTex() }, uGrassTex: { value: neutralTex() } };

/** Muat peta paving & rumput ke uniform bersama. Gagal → log, uniform tetap netral (tak melempar). */
export function loadGroundTextures({ baseUrl = '/', loadTexture = (url) => new THREE.TextureLoader().loadAsync(url), logger = console } = {}) {
  const one = async (key, uniform) => {
    try {
      const tex = await loadTexture(`${baseUrl}${GROUND_TEX.files[key]}`);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.NoColorSpace;
      tex.anisotropy = 4;
      uniform.value = tex;
    } catch (err) {
      logger.error(`Tekstur tanah ${key} gagal dimuat:`, err);
    }
  };
  return Promise.all([one('pave', GROUND_UNIFORMS.uPaveTex), one('grass', GROUND_UNIFORMS.uGrassTex)]).then(() => undefined);
}

const PAVE_REPEAT = GROUND_TEX.paveRepeat.toFixed(1);
const GRASS_REPEAT = GROUND_TEX.grassRepeat.toFixed(1);
const FAR_SCALE = GROUND_TEX.farScale.toFixed(1);

const COMMON_V = 'varying vec3 vGroundP;';
const COMMON_F = [
  'varying vec3 vGroundP;',
  'uniform float uGroundGrain;',
  'uniform float uCloudT;',
  'uniform float uCloudAmt;',
  'uniform sampler2D uPaveTex;',
  'uniform sampler2D uGrassTex;',
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
  // peta rincian: rumput di warna hijau dominan, paving di permukaan terang non-hijau non-biru; aspal gelap & air dibiarkan
  'float gdGrass = step(diffuseColor.r * 1.15, diffuseColor.g) * step(diffuseColor.b * 1.2, diffuseColor.g);',
  'float gdBlue = step(max(diffuseColor.r, diffuseColor.g) * 1.35, diffuseColor.b);', // hanya biru tegas (air); abu kebiruan plaza tetap paving
  'float gdLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));',
  'float gdPave = (1.0 - gdGrass) * (1.0 - gdBlue) * smoothstep(0.30, 0.42, gdLum);',
  'float gdTexFade = 1.0 - smoothstep(900.0, 3500.0, gdDist);',
  'float gdNear = 1.0 - smoothstep(60.0, 200.0, gdDist);', // dekat: skala asli; jauh: diperbesar FAR_SCALE (skala asli < 1 px dari kamera Kota)
  `float gdGrassT = mix(texture2D(uGrassTex, vGroundP.xz / (${GRASS_REPEAT} * ${FAR_SCALE})).r, texture2D(uGrassTex, vGroundP.xz / ${GRASS_REPEAT}).r, gdNear);`,
  `float gdPaveT = mix(texture2D(uPaveTex, vGroundP.xz / (${PAVE_REPEAT} * ${FAR_SCALE})).r, texture2D(uPaveTex, vGroundP.xz / ${PAVE_REPEAT}).r, gdNear);`,
  'diffuseColor.rgb *= mix(1.0, gdGrassT * 2.0, gdGrass * gdTexFade);',
  'diffuseColor.rgb *= mix(1.0, gdPaveT * 2.0, gdPave * gdTexFade);',
  // bayangan awan: bercak lebar (±1,4 km) bergeser searah angin; gelap 20% di bawah awan, tepi lembut
  'vec2 gdCloudUv = vGroundP.xz / 1400.0 + vec2(uCloudT * 0.011, uCloudT * 0.006);',
  'float gdCloud = smoothstep(0.5, 0.7, gdValue(gdCloudUv) * 0.65 + gdValue(gdCloudUv * 2.3 + 7.0) * 0.35);',
  'diffuseColor.rgb *= 1.0 - 0.2 * gdCloud * uCloudAmt * (1.0 - smoothstep(2500.0, 9000.0, gdDist));',
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
    Object.assign(shader.uniforms, own, GROUND_UNIFORMS);
    const patched = patchGroundDetailSource(shader);
    shader.vertexShader = patched.vertexShader;
    shader.fragmentShader = patched.fragmentShader;
  };
  material.customProgramCacheKey = () => `kota-ground-detail-${name}-${grain}-t3`;
  material.needsUpdate = true;
  return material;
}
