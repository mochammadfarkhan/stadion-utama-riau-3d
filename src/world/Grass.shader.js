import * as THREE from 'three';
import { GRASS } from '../config/constants.js';
import { WIND_UNIFORMS, WIND_GLSL_UNIFORMS, WIND_GLSL_FUNC } from './shaders/windState.js';

/**
 * ShaderMaterial ringan untuk bilah rumput instanced:
 * - vertex: instanceMatrix (posisi + yaw rumpun), aScale (tinggi, lengkung),
 *   aDir (arah lengkung bilah), windOffset bersama dari windState, fade skala
 *   berdasarkan jarak akar ke uFocus (0 di ≥ GRASS.radius);
 * - fragment: gradasi pangkal gelap → ujung terang × tint rumpun × uLight
 *   (radiansi lampu dunia yang dihitung di JS agar selaras tanah Lambert), kabut three.
 * Tanpa bayangan, DoubleSide, output linear (tone mapping di OutputPass).
 */
const VERTEX = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
${WIND_GLSL_UNIFORMS}
${WIND_GLSL_FUNC}
uniform float uBladeHeight;
uniform vec3 uFocus;
uniform float uRadius;
uniform float uFadeStart;
uniform float uWindScale;
uniform float uFlutter;
attribute vec2 aScale;   // x = skala tinggi, y = lengkung ujung (m)
attribute vec3 aTint;
attribute vec2 aDir;     // arah lengkung bilah (lokal XZ)
varying float vWeight;
varying vec3 vTint;

void main() {
  float weight = position.y / uBladeHeight;   // 0 akar, 1 ujung
  float w2 = weight * weight;
  vec3 rootW = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float dist = distance(rootW.xz, uFocus.xz);
  float fade = 1.0 - smoothstep(uFadeStart, uRadius, dist);
  vec3 p = position;
  p.y *= aScale.x * fade;
  p.xz += aDir * (aScale.y * w2);
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  wp.xyz += windOffset(rootW, w2) * uWindScale;
  float flutter = sin(uWindTime * 2.7 + rootW.x * 1.9 + rootW.z * 1.3);
  wp.xz += uWindDir * (flutter * uFlutter * w2 * (0.3 + uWindStrength));
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  vWeight = weight;
  vTint = aTint;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColorBase;
uniform vec3 uColorTip;
uniform vec3 uLight;
varying float vWeight;
varying vec3 vTint;

void main() {
  vec3 albedo = mix(uColorBase, uColorTip, vWeight) * vTint;
  gl_FragColor = vec4(albedo * uLight, 1.0);
  #include <fog_fragment>
}
`;

/** Material rumput; uniform angin menunjuk ke WIND_UNIFORMS (by-reference). */
export function createGrassMaterial() {
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uWindTime: WIND_UNIFORMS.uWindTime,
    uWindStrength: WIND_UNIFORMS.uWindStrength,
    uWindDir: WIND_UNIFORMS.uWindDir,
    uBladeHeight: { value: GRASS.heightMax },
    uFocus: { value: new THREE.Vector3() },
    uRadius: { value: GRASS.radius },
    uFadeStart: { value: GRASS.fadeStart },
    uWindScale: { value: GRASS.windScale },
    uFlutter: { value: GRASS.flutter },
    uColorBase: { value: new THREE.Color(GRASS.colorBase) },
    uColorTip: { value: new THREE.Color(GRASS.colorTip) },
    uLight: { value: new THREE.Vector3(1, 1, 1) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.DoubleSide,
    fog: true,
  });
  mat.name = 'rumputBilah';
  return mat;
}

const _sunPos = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _acc = new THREE.Color();

/**
 * Hitung radiansi lampu dunia untuk normal menghadap atas (selaras Lambert tanah):
 * (matahari·cos + hemisphere langit + env) / π, lalu tulis ke uLight.
 * @param {{sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight, defaults: {envIntensity:number}}} L
 */
export function updateGrassLight(material, L, scene) {
  const out = material.uniforms.uLight.value;
  const sun = L.sun;
  sun.getWorldPosition(_sunPos);
  sun.target.getWorldPosition(_targetPos);
  const upDot = Math.max(0, _sunPos.sub(_targetPos).normalize().y);
  _acc.copy(sun.color).multiplyScalar(sun.intensity * upDot);
  out.set(_acc.r, _acc.g, _acc.b);
  _acc.copy(L.hemi.color).multiplyScalar(L.hemi.intensity);
  out.x += _acc.r; out.y += _acc.g; out.z += _acc.b;
  const envRatio = L.defaults.envIntensity > 0 ? (scene.environmentIntensity ?? 1) / L.defaults.envIntensity : 0;
  out.addScalar(GRASS.envAmbient * envRatio);
  out.multiplyScalar(1 / Math.PI).addScalar(GRASS.lightPad);
}
