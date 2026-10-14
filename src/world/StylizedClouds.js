/**
 * Awan gaya cozy: kubah langit transparan di atas Sky fisik. Awan dibuat dari
 * tekstur fbm prosedural (tanpa aset unduhan) yang dipotong dengan smoothstep
 * menjadi bentuk "kapas" bertepi tegas, lalu dialirkan lewat flowmap dua fase
 * (dua sampel bergeser berlawanan fase, dicampur) supaya bentuknya berubah pelan
 * tanpa meregang. Sisi yang membelakangi matahari diberi bayangan datar.
 */
import * as THREE from 'three';
import { fbm, fillCanvas } from './textures/noise.js';

const TEX_SIZE = 256;
const DOME_RADIUS = 2200; // di bawah far kamera (2500)
const FLOW_SPEED = 0.2;
const FLOW_STRENGTH = 0.09;
const DRIFT_SPEED = 0.004;
const LIT_DEFAULT = new THREE.Color('#fff1d8');
const ZENITH_DAY = new THREE.Color('#1478e6');
const ZENITH_TWILIGHT = new THREE.Color('#3a3f86');
const ZENITH_NIGHT = new THREE.Color('#050a1e');
const SHADE_DEFAULT = new THREE.Color('#aebfdc');

/** Kepadatan awan 0..1 (R) yang bisa diulang tanpa sambungan. */
function createCloudTexture() {
  return fillCanvas(TEX_SIZE, TEX_SIZE, (u, v) => {
    const base = fbm(u, v, { freq: 4, freqV: 4, octaves: 5, gain: 0.55, seed: 3 });
    const d = Math.min(1, Math.max(0, (base - 0.3) * 2.5)) * 255;
    return [d, d, d];
  }, { srgb: false });
}

/** Arah aliran (RG, 0.5 = diam) dan fase acak (B). */
function createFlowTexture() {
  return fillCanvas(TEX_SIZE / 2, TEX_SIZE / 2, (u, v) => {
    const fx = fbm(u, v, { freq: 3, octaves: 2, seed: 41 });
    const fy = fbm(u, v, { freq: 3, octaves: 2, seed: 77 });
    const ph = fbm(u, v, { freq: 6, octaves: 1, seed: 9 });
    return [fx * 255, fy * 255, ph * 255];
  }, { srgb: false });
}

const VERTEX = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */`
  uniform sampler2D tCloud;
  uniform sampler2D tFlow;
  uniform float uTime;
  uniform float uCover;
  uniform float uStorm;
  uniform float uBright;
  uniform float uSkyMix;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uLit;
  uniform vec3 uShade;
  uniform vec3 uSunDir;
  varying vec3 vDir;

  float flowCloud(vec2 uv, vec2 flowUv) {
    vec3 flow = texture2D(tFlow, flowUv).rgb;
    vec2 disp = (flow.rg * 2.0 - 1.0) * ${FLOW_STRENGTH.toFixed(3)};
    float t = uTime * ${FLOW_SPEED.toFixed(3)} + flow.b;
    float p1 = fract(t);
    float p2 = fract(t + 0.5);
    float a = texture2D(tCloud, uv - disp * p1).r;
    float b = texture2D(tCloud, uv - disp * p2).r;
    float w = abs(p1 * 2.0 - 1.0);
    return mix(a, b, w * w * (3.0 - 2.0 * w));
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    if (h <= 0.0) discard;
    // Proyeksi bidang: awan merapat ke horizon seperti pada langit sungguhan.
    vec2 plane = dir.xz / (h + 0.18);
    vec2 uv = plane * 0.14 + vec2(uTime * ${DRIFT_SPEED.toFixed(4)}, 0.0);
    vec2 flowUv = plane * 0.05 + 0.5;

    float d = flowCloud(uv, flowUv);
    float thr = mix(0.8, 0.25, uCover);
    float shape = smoothstep(thr, thr + 0.07, d);
    float fade = smoothstep(0.0, 0.16, h);
    // Gradasi langit biru-cerah (siang) di bawah awan; memudar ke warna kabut di horizon.
    vec3 skyCol = mix(uHorizon, uZenith, smoothstep(0.0, 0.28, h));
    float skyA = uSkyMix * smoothstep(0.0, 0.18, h);
    if (shape < 0.003 && skyA < 0.003) discard;

    // Bayangan datar: bandingkan kepadatan sedikit ke arah matahari.
    vec2 sunUv = normalize(uSunDir.xz + 0.0001) * 0.035;
    float d2 = flowCloud(uv + sunUv, flowUv);
    float lit = clamp((d - d2) * 7.0 + 0.55, 0.0, 1.0);
    lit = smoothstep(0.25, 0.75, lit);

    vec3 lightCol = mix(uLit, vec3(0.62, 0.65, 0.7), uStorm);
    vec3 shadeCol = mix(uShade, vec3(0.38, 0.41, 0.46), uStorm);
    vec3 col = mix(shadeCol, lightCol, lit) * uBright;

    float a = shape * fade;
    float outA = a + skyA * (1.0 - a);
    vec3 outRgb = (col * a + skyCol * skyA * (1.0 - a)) / max(outA, 0.0001);
    gl_FragColor = vec4(outRgb, outA);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * @returns {THREE.Mesh} kubah awan; userData.setLook(sunColor, brightness) dan
 *   userData.update(t, cover, sunDir) dipanggil dari Lighting/TimeOfDay.
 */
export function createStylizedClouds() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tCloud: { value: createCloudTexture() },
      tFlow: { value: createFlowTexture() },
      uTime: { value: 0 },
      uCover: { value: 0.35 },
      uStorm: { value: 0 },
      uBright: { value: 1 },
      uSkyMix: { value: 1 },
      uHorizon: { value: new THREE.Color('#bfe6ff') },
      uZenith: { value: new THREE.Color('#1478e6') },
      uLit: { value: LIT_DEFAULT.clone() },
      uShade: { value: SHADE_DEFAULT.clone() },
      uSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.2) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 32, 16), material);
  mesh.name = 'awanStylized';
  mesh.frustumCulled = false;
  mesh.renderOrder = -900;
  mesh.onBeforeRender = (_r, _s, camera) => {
    mesh.position.copy(camera.position);
    mesh.updateMatrixWorld();
  };
  const u = material.uniforms;
  mesh.userData.update = (t, cover, sunDir) => {
    u.uTime.value = t;
    u.uCover.value = cover;
    u.uStorm.value = THREE.MathUtils.smoothstep(cover, 0.7, 0.95);
    u.uSunDir.value.copy(sunDir);
  };
  /**
   * Warna langit & awan mengikuti jam: biru siang → ungu senja → biru tua malam.
   * @param {number} sunColor warna matahari/bulan (hex)
   * @param {number} elevationDeg tinggi matahari (derajat, negatif = di bawah horizon)
   * @param {number} horizonHex warna kabut preset (horizon menyatu dengan kabut)
   */
  mesh.userData.setLook = (sunColor, elevationDeg, horizonHex) => {
    const sm = THREE.MathUtils.smoothstep;
    const day = sm(elevationDeg, -6, 10);
    const twilight = sm(elevationDeg, -8, 2) * (1 - sm(elevationDeg, 2, 14));
    u.uZenith.value.copy(ZENITH_NIGHT).lerp(ZENITH_DAY, day).lerp(ZENITH_TWILIGHT, twilight * 0.7);
    u.uHorizon.value.set(horizonHex);
    u.uLit.value.copy(LIT_DEFAULT).lerp(_tint.set(sunColor), 0.35);
    // Terang awan murni dari tinggi matahari (bukan cahaya sekitar yang masih tinggi saat malam).
    const light = sm(elevationDeg, -12, 14);
    u.uBright.value = 0.04 + 0.96 * light * light;
  };
  return mesh;
}

const _tint = new THREE.Color();
