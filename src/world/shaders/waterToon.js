/**
 * Air kartun (M8 P2, gaya 'kartun'/'facet'): gradasi dangkal -> dalam dari atribut vertex `edgeDist` (jarak ke tepi air,
 * di-bake saat mesh air dibangun), busa tepi putih tipis berdenyut pelan, dua lapis riak normal-scroll dari noise
 * tilable prosedural (DataTexture 256^2, tanpa berkas), kilau matahari tajam, warna menurut jam. Opaque; material
 * dasar MeshBasicMaterial (kabut + tone mapping bawaan three tetap bekerja) dengan fragmen ditulis sendiri.
 * Uniform dibagi seluruh badan air; styleManager memanggil updateWaterToon tiap frame saat gaya bukan 'asli'.
 */
import * as THREE from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { lightByHour } from '../../engine/lightByHour.js';
import { createRng } from '../util/random.js';

export const WATER_TOON = Object.freeze({
  shallow: 0x5fd3c8,
  mid: 0x1f6fa8,
  deep: 0x164e7c,
  noiseSize: 256,
  midAt: 14, // m dari tepi: seluruhnya 'mid'
  deepFrom: 10,
  deepAt: 42,
  foamOffset: 0, // cadangan
  foamWidth: 0.09, // m kedalaman: pita busa di atas dasar yang landai ke tepi
});

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/** Noise nilai tilable (fBm 3 oktaf) 0..1, size x size, deterministik per seed. Murni. */
export function tileableNoise(size = 256, seed = 7) {
  const out = new Float32Array(size * size);
  const octaves = [[8, 0.5], [16, 0.3], [32, 0.2]];
  const rnd = createRng(seed);
  for (const [cells, amp] of octaves) {
    const lat = new Float32Array(cells * cells);
    for (let i = 0; i < lat.length; i += 1) lat[i] = rnd();
    for (let y = 0; y < size; y += 1) {
      const fy = (y / size) * cells;
      const y0 = Math.floor(fy);
      const ty = smooth(0, 1, fy - y0);
      for (let x = 0; x < size; x += 1) {
        const fx = (x / size) * cells;
        const x0 = Math.floor(fx);
        const tx = smooth(0, 1, fx - x0);
        const a = lat[(y0 % cells) * cells + (x0 % cells)];
        const b = lat[(y0 % cells) * cells + ((x0 + 1) % cells)];
        const c = lat[((y0 + 1) % cells) * cells + (x0 % cells)];
        const d = lat[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
        out[y * size + x] += amp * lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
      }
    }
  }
  return out;
}

/** Tinggi -> RGBA8: R,G = kemiringan (0.5 = datar), B = tinggi. Beda hingga dengan pembungkusan (tilable). Murni. */
export function heightToSlopeRGBA(h, size, strength = 5) {
  const data = new Uint8Array(size * size * 4);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const i = (y * size + x) * 4;
      data[i] = Math.round(Math.min(1, Math.max(0, 0.5 - dx)) * 255);
      data[i + 1] = Math.round(Math.min(1, Math.max(0, 0.5 - dy)) * 255);
      data[i + 2] = Math.round(Math.min(1, Math.max(0, h[y * size + x])) * 255);
      data[i + 3] = 255;
    }
  }
  return data;
}

/**
 * Tampilan air per jam (murni): pengali warna (malam gelap kebiruan, sore keemasan), kekuatan kilau, kecerahan busa,
 * warna matahari/langit untuk pantulan. `day` 0..1 (0 = malam).
 */
export function waterLook(hour) {
  const h = Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : 12;
  const L = lightByHour(h);
  const day = smooth(5.3, 7.6, h) * (1 - smooth(17.8, 19.6, h));
  const warm = day * Math.min(1, Math.max(0, (L.split - 0.45) / 0.4));
  const night = [0.15, 0.22, 0.4];
  const gold = [1.0, 0.9, 0.76];
  const tint = night.map((n, i) => lerp(n, lerp(1, gold[i], warm), day));
  return {
    day, warm, tint,
    glint: 0.1 + 0.9 * day,
    foamLight: 0.5 + 0.5 * day,
    sunColor: L.sunColor,
    skyColor: L.hemiSky,
  };
}

/** Uniform bersama semua material air kartun. */
export const waterUniforms = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() },
  uSunCol: { value: new THREE.Color(0xfff4e6) },
  uSky: { value: new THREE.Color(0x9cc8ff) },
  uTint: { value: new THREE.Vector3(1, 1, 1) },
  uGlint: { value: 1 },
  uWarm: { value: 0 },
  uFoamLight: { value: 1 },
  uShallow: { value: new THREE.Color(WATER_TOON.shallow) },
  uMid: { value: new THREE.Color(WATER_TOON.mid) },
  uDeep: { value: new THREE.Color(WATER_TOON.deep) },
  uNoise: { value: null },
  uFoam: { value: new THREE.Vector2(WATER_TOON.foamOffset, WATER_TOON.foamWidth) },
  uRain: { value: 0 },
};

const _dir = new THREE.Vector3();
let lastLookKey = '';

/**
 * Tulis uniform per frame. `sun` = DirectionalLight utama (arah = position - target.position); `hour` jam game;
 * `rain` 0..1 (opsional).
 */
export function updateWaterToon(dt, { hour = 12, sun = null, rain = 0 } = {}) {
  waterUniforms.uTime.value = (waterUniforms.uTime.value + Math.max(0, dt)) % 3600;
  if (sun?.position && sun.target?.position) {
    _dir.subVectors(sun.position, sun.target.position);
    if (_dir.lengthSq() > 1e-6) waterUniforms.uSunDir.value.copy(_dir.normalize());
  }
  waterUniforms.uRain.value = rain;
  const key = String(Math.round(hour * 60));
  if (key === lastLookKey) return;
  lastLookKey = key;
  const look = waterLook(hour);
  waterUniforms.uTint.value.set(look.tint[0], look.tint[1], look.tint[2]);
  waterUniforms.uGlint.value = look.glint;
  waterUniforms.uWarm.value = look.warm;
  waterUniforms.uFoamLight.value = look.foamLight;
  waterUniforms.uSunCol.value.setHex(look.sunColor);
  waterUniforms.uSky.value.setHex(look.skyColor);
}

const VERT_DECL = /* glsl */`
attribute float edgeDist;
attribute float shoreDepth;
varying float vEdge;
varying float vShore;
varying vec3 vWPos;
`;

const VERT_BODY = /* glsl */`
#include <begin_vertex>
vEdge = edgeDist;
vShore = shoreDepth;
vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
`;

const FRAG_DECL = /* glsl */`
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSky;
uniform vec3 uTint;
uniform float uGlint;
uniform float uWarm;
uniform float uFoamLight;
uniform vec3 uShallow;
uniform vec3 uMid;
uniform vec3 uDeep;
uniform vec2 uFoam;
uniform float uRain;
uniform sampler2D uNoise;
varying float vEdge;
varying float vShore;
varying vec3 vWPos;
`;

const FRAG_BODY = /* glsl */`
{
  float d = max( vEdge, 0.0 );
  vec3 col = mix( uShallow, uMid, smoothstep( 0.0, ${WATER_TOON.midAt.toFixed(1)}, d ) );
  col = mix( col, uDeep, smoothstep( ${WATER_TOON.deepFrom.toFixed(1)}, ${WATER_TOON.deepAt.toFixed(1)}, d ) );
  vec2 p = vWPos.xz;
  vec4 n1 = texture2D( uNoise, p * 0.035 + vec2( uTime * 0.010, uTime * 0.006 ) );
  vec4 n2 = texture2D( uNoise, p * 0.093 + vec2( -uTime * 0.017, uTime * 0.013 ) );
  vec2 sl = n1.xy + n2.xy - 1.0;
  float rainK = 1.0 + uRain * 1.6;
  vec3 N = normalize( vec3( sl.x * 0.5 * rainK, 1.0, sl.y * 0.5 * rainK ) );
  vec3 V = normalize( cameraPosition - vWPos );
  float fres = pow( 1.0 - clamp( V.y, 0.0, 1.0 ), 3.0 );
  col = mix( col, uSky, fres * 0.4 );
  col *= 0.93 + 0.14 * ( n1.z * 0.5 + n2.z * 0.5 );
  col = mix( vec3( dot( col, vec3( 0.3, 0.59, 0.11 ) ) ), col, 1.25 );
  col *= uTint;
  col += uSunCol * uWarm * 0.07;
  vec3 H = normalize( uSunDir + V );
  float nh = max( dot( N, H ), 0.0 );
  float spec = pow( nh, 600.0 ) * 1.1 + pow( nh, 60.0 ) * 0.05;
  col += uSunCol * spec * uGlint * ( 1.0 - uRain * 0.6 );
  float wob = n1.z * 0.6 + n2.z * 0.4;
  float pulse = 0.5 + 0.5 * sin( uTime * 0.9 + wob * 6.2831 );
  float de = vShore;
  float w = uFoam.y * ( 0.65 + 0.35 * pulse ) + ( wob - 0.5 ) * 0.35;
  float foam = 1.0 - smoothstep( w * 0.35, w, de );
  float foam2 = ( 1.0 - smoothstep( w * 1.7, w * 1.7 + 0.25, de ) ) * smoothstep( 0.55, 0.66, n2.z ) * 0.6;
  foam = clamp( max( foam, foam2 ), 0.0, 1.0 ) * step( -0.6, de ) * ( 1.0 - smoothstep( 4.0, 8.0, d ) );
  col = mix( col, vec3( 1.5 ) * uFoamLight, foam * 0.9 );
  gl_FragColor = vec4( col, 1.0 );
}
`;

/** Material air kartun (satu per scope pemilik; tekstur noise ikut scope). */
export function createWaterToonMaterial() {
  const { mat } = currentScope().get('waterToon', () => {
    const size = WATER_TOON.noiseSize;
    const tex = new THREE.DataTexture(heightToSlopeRGBA(tileableNoise(size, 7), size), size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
    material.name = 'unri:airToon';
    material.userData.pbr = true; // dilewati styleMaterial (menangani gayanya sendiri)
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, waterUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', `${VERT_DECL}\nvoid main() {`)
        .replace('#include <begin_vertex>', VERT_BODY);
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', `${FRAG_DECL}\nvoid main() {`)
        .replace('#include <opaque_fragment>', FRAG_BODY);
    };
    material.customProgramCacheKey = () => 'waterToon.v1';
    waterUniforms.uNoise.value = tex;
    return { mat: material, tex };
  });
  return mat;
}
