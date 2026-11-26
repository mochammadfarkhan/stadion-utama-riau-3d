/**
 * Bayangan sudut (ambient occlusion screen-space) untuk SKALA KOTA: kamera fov ±20° pada 300–3000 m.
 * GTAO bawaan nyaris tak terlihat di skala ini; pass ini estimator gaya Alchemy/SAO sederhana:
 * gelap di kaki gedung, sudut dalam antar-dinding, celah antar gedung rapat, bawah kanopi.
 *
 * - Satu pass layar penuh mode salin: tDiffuse (readBuffer) + kedalaman dari DepthRenderPass.
 * - Posisi view direkonstruksi dari kedalaman (fov/aspect kamera), normal dari tetangga
 *   yang selisih kedalamannya terkecil (aman di tepi siluet).
 * - SAMPLES titik spiral di cakram layar (radius = uRadius meter dunia), diputar per piksel (IGN).
 * - Area tergelap ditarik ke uTint (biru-arang), bukan hitam.
 *
 * Anti feedback-loop: bila writeBuffer == target adegan (pemilik depthTexture), pass dilewati.
 */
import { Color, NoBlending, ShaderMaterial, Vector2 } from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const SKY_DEPTH = 0.99999;
const AO_GAIN = 1.5; // k: intensity 1 ≈ sudut dalam 90° 40–50% lebih gelap (perkiraan, setel lewat uDebug)

/** Skala proyeksi: piksel per meter pada kedalaman 1 m. */
export function aoProjScale(heightPx, fovDeg) {
  return heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
#include <packing>
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uTanHalfFov;
uniform float uAspect;
uniform float uProjScale;
uniform float uRadius;
uniform float uIntensity;
uniform float uPower;
uniform float uBias;
uniform float uMinPx;
uniform float uMaxPx;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform float uStrength;
uniform vec3 uTint;
uniform float uDebug;
varying vec2 vUv;

const float SKY = ${SKY_DEPTH.toFixed(5)};
const float TURNS = 7.0;
const float TAU = 6.28318530718;

vec3 viewPos(vec2 uv, float raw) {
  float vz = perspectiveDepthToViewZ(raw, uNear, uFar);
  return vec3((uv * 2.0 - 1.0) * vec2(uTanHalfFov * uAspect, uTanHalfFov) * (-vz), vz);
}

vec3 viewPosAt(vec2 uv) {
  return viewPos(uv, texture2D(tDepth, uv).x);
}

// Normal dari tetangga dengan selisih kedalaman lebih kecil per sumbu.
vec3 viewNormal(vec3 p) {
  vec2 t = 1.0 / uResolution;
  vec3 l = viewPosAt(vUv - vec2(t.x, 0.0));
  vec3 r = viewPosAt(vUv + vec2(t.x, 0.0));
  vec3 b = viewPosAt(vUv - vec2(0.0, t.y));
  vec3 u = viewPosAt(vUv + vec2(0.0, t.y));
  vec3 dx = abs(r.z - p.z) < abs(p.z - l.z) ? r - p : p - l;
  vec3 dy = abs(u.z - p.z) < abs(p.z - b.z) ? u - p : p - b;
  return normalize(cross(dx, dy));
}

float occlusion(vec3 p, float depth) {
  vec3 n = viewNormal(p);
  float rPx = clamp(uRadius * uProjScale / depth, uMinPx, uMaxPx);
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float rot = ign * TAU;
  float r2 = uRadius * uRadius;
  float eps = 0.01 * r2;
  float sum = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float a = (float(i) + 0.5) / float(SAMPLES);
    float ang = a * TURNS * TAU + rot;
    vec2 suv = vUv + vec2(cos(ang), sin(ang)) * (a * rPx) / uResolution;
    if (any(lessThan(suv, vec2(0.0))) || any(greaterThan(suv, vec2(1.0)))) continue;
    float raw = texture2D(tDepth, suv).x;
    if (raw >= SKY) continue;
    vec3 v = viewPos(suv, raw) - p;
    float vv = dot(v, v);
    float f = clamp(1.0 - vv / r2, 0.0, 1.0); // jangkauan: turun halus ke 0 di |v| = radius
    sum += f * f * max(0.0, dot(v, n) - uBias * depth) / (vv + eps);
  }
  float ao = clamp(1.0 - uIntensity * uRadius * sum / float(SAMPLES) * ${AO_GAIN.toFixed(3)}, 0.0, 1.0);
  ao = pow(ao, uPower);
  return mix(ao, 1.0, smoothstep(uFadeStart, uFadeEnd, depth));
}

void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  float raw = texture2D(tDepth, vUv).x;
  float ao = 1.0;
  if (raw < SKY) {
    vec3 p = viewPos(vUv, raw);
    ao = occlusion(p, -p.z);
  }
  if (uDebug > 0.5) {
    gl_FragColor = vec4(vec3(ao), 1.0);
    return;
  }
  vec3 shade = mix(vec3(1.0), mix(uTint, vec3(1.0), ao), uStrength);
  gl_FragColor = vec4(base.rgb * shade, base.a);
}`;

const DEFAULTS = Object.freeze({
  radius: 9, intensity: 1, power: 1.5, bias: 0.0015, strength: 1, tint: 0x5a6a86, samples: 16,
  minPx: 2, maxPx: 96, fadeStart: 6000, fadeEnd: 9000,
});

export class CityAoPass extends Pass {
  /**
   * @param {import('three').PerspectiveCamera} camera
   * @param {{target: import('three').WebGLRenderTarget|null}} source DepthRenderPass (pemilik depthTexture)
   * @param {Partial<typeof DEFAULTS>} [options]
   */
  constructor(camera, source, options = {}) {
    super();
    const o = { ...DEFAULTS, ...options };
    this.camera = camera;
    this.source = source;
    this.uniforms = {
      tDiffuse: { value: null },
      tDepth: { value: null },
      uResolution: { value: new Vector2(1, 1) },
      uNear: { value: 0.1 },
      uFar: { value: 1000 },
      uTanHalfFov: { value: 1 },
      uAspect: { value: 1 },
      uProjScale: { value: 1 },
      uRadius: { value: o.radius },
      uIntensity: { value: o.intensity },
      uPower: { value: o.power },
      uBias: { value: o.bias },
      uMinPx: { value: o.minPx },
      uMaxPx: { value: o.maxPx },
      uFadeStart: { value: o.fadeStart },
      uFadeEnd: { value: o.fadeEnd },
      uStrength: { value: o.strength },
      uTint: { value: new Color(o.tint) }, // hex sRGB → ruang kerja linear
      uDebug: { value: 0 },
    };
    this.material = new ShaderMaterial({
      name: 'CityAoPass',
      uniforms: this.uniforms,
      defines: { SAMPLES: Math.max(1, Math.round(o.samples)) },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }

  /** Ubah tampilan; hanya kunci yang diberikan. */
  setLook({ radius, intensity, power, bias, strength, tint, samples } = {}) {
    const u = this.uniforms;
    if (radius != null) u.uRadius.value = radius;
    if (intensity != null) u.uIntensity.value = intensity;
    if (power != null) u.uPower.value = power;
    if (bias != null) u.uBias.value = bias;
    if (strength != null) u.uStrength.value = strength;
    if (tint != null) u.uTint.value.set(tint);
    if (samples != null) {
      const n = Math.max(1, Math.round(samples));
      if (n !== this.material.defines.SAMPLES) {
        this.material.defines.SAMPLES = n;
        this.material.needsUpdate = true;
      }
    }
  }

  /** Ukuran efektif (piksel fisik) dari EffectComposer. */
  setSize(width, height) {
    this.uniforms.uResolution.value.set(Math.max(1, width), Math.max(1, height));
  }

  render(renderer, writeBuffer, readBuffer) {
    const scene = this.source?.target;
    if (!scene?.depthTexture || writeBuffer === scene) {
      this.needsSwap = false; // tanpa kedalaman / feedback loop: lewati
      return;
    }
    this.needsSwap = true;
    const u = this.uniforms;
    const cam = this.camera;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = scene.depthTexture;
    u.uNear.value = cam.near;
    u.uFar.value = cam.far;
    u.uTanHalfFov.value = Math.tan((cam.fov * Math.PI) / 360);
    u.uAspect.value = cam.aspect;
    u.uProjScale.value = aoProjScale(u.uResolution.value.y, cam.fov);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
