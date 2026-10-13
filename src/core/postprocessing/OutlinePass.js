/**
 * Garis tepi tipis screen-space dari buffer kedalaman (gaya kartun lembut).
 *
 * - DepthRenderPass: RenderPass yang mencatat render target tempat adegan
 *   dirender (target composer ber-DepthTexture), karena buffer composer
 *   bertukar (ping-pong) sehingga posisinya berubah tiap frame.
 * - OutlinePass: Sobel (bobot 1-2-1) atas turunan kedua kedalaman linear,
 *   dinormalisasi oleh kedalaman pusat → bidang datar (tanah miring jauh) tidak
 *   bergaris, hanya tepi cembung / siluet di sisi objek yang lebih dekat.
 *   Memudar menurut jarak (fadeStart..fadeEnd), langit (depth = 1) diabaikan.
 *
 * Anti feedback-loop: tekstur kedalaman tidak boleh di-sample saat target
 * pemiliknya sedang ditulis. Bila writeBuffer == target adegan, garis
 * di-blend langsung ke readBuffer (needsSwap = false); selain itu mode salin
 * biasa (readBuffer → writeBuffer, needsSwap = true).
 */
import { Color, NoBlending, NormalBlending, ShaderMaterial, Vector2 } from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

const SKY_DEPTH = 0.99999;

/** RenderPass yang mengingat target tujuan (pemilik depthTexture adegan). */
export class DepthRenderPass extends RenderPass {
  constructor(scene, camera) {
    super(scene, camera);
    this.target = null;
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    this.target = this.renderToScreen ? null : readBuffer;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
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
uniform float uThickness;
uniform float uNear;
uniform float uFar;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform float uThreshold;
uniform float uSoftness;
varying vec2 vUv;

float linDepth(vec2 uv) {
  return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
}

// Sobel berbobot 1-2-1 atas turunan kedua (positif = pusat lebih dekat).
float edgeStrength(float c) {
  vec2 o = uThickness / uResolution;
  float l = linDepth(vUv - vec2(o.x, 0.0));
  float r = linDepth(vUv + vec2(o.x, 0.0));
  float b = linDepth(vUv - vec2(0.0, o.y));
  float t = linDepth(vUv + vec2(0.0, o.y));
  float tl = linDepth(vUv + vec2(-o.x, o.y));
  float tr = linDepth(vUv + vec2(o.x, o.y));
  float bl = linDepth(vUv + vec2(-o.x, -o.y));
  float br = linDepth(vUv + vec2(o.x, -o.y));
  float gx = (tl + tr - 2.0 * t) + 2.0 * (l + r - 2.0 * c) + (bl + br - 2.0 * b);
  float gy = (tl + bl - 2.0 * l) + 2.0 * (t + b - 2.0 * c) + (tr + br - 2.0 * r);
  return max(max(gx, gy), 0.0) / (4.0 * c);
}

void main() {
  float raw = texture2D(tDepth, vUv).x;
  float edge = 0.0;
  if (raw < ${SKY_DEPTH.toFixed(5)}) {
    float c = linDepth(vUv);
    float e = smoothstep(uThreshold, uThreshold + uSoftness, edgeStrength(c));
    edge = e * (1.0 - smoothstep(uFadeStart, uFadeEnd, c)) * uIntensity;
  }
#ifdef OVERLAY
  if (edge <= 0.002) discard;
  gl_FragColor = vec4(uColor, edge);
#else
  vec4 base = texture2D(tDiffuse, vUv);
  gl_FragColor = vec4(mix(base.rgb, uColor, edge), base.a);
#endif
}`;

function createUniforms(o) {
  return {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uResolution: { value: new Vector2(1, 1) },
    uThickness: { value: o.thickness },
    uNear: { value: 0.1 },
    uFar: { value: 1000 },
    uColor: { value: new Color(o.color) }, // hex sRGB → ruang kerja linear
    uIntensity: { value: o.intensity },
    uFadeStart: { value: o.fadeStart },
    uFadeEnd: { value: o.fadeEnd },
    uThreshold: { value: o.threshold },
    uSoftness: { value: o.softness },
  };
}

function createMaterial(uniforms, overlay) {
  return new ShaderMaterial({
    name: overlay ? 'OutlineOverlay' : 'OutlineComposite',
    uniforms,
    defines: overlay ? { OVERLAY: 1 } : {},
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    blending: overlay ? NormalBlending : NoBlending,
    transparent: overlay,
    depthTest: false,
    depthWrite: false,
  });
}

const DEFAULTS = Object.freeze({
  color: 0x1b2a33, intensity: 0.55, thickness: 1, fadeStart: 60, fadeEnd: 120, threshold: 0.0025, softness: 0.01,
});

export class OutlinePass extends Pass {
  /**
   * @param {import('three').PerspectiveCamera} camera
   * @param {DepthRenderPass} source pass adegan (pemilik depthTexture)
   * @param {Partial<typeof DEFAULTS>} [options]
   */
  constructor(camera, source, options = {}) {
    super();
    const o = { ...DEFAULTS, ...options };
    this.camera = camera;
    this.source = source;
    this.thickness = o.thickness;
    this.pixelRatio = 1;
    this.uniforms = createUniforms(o);
    this.compositeMaterial = createMaterial(this.uniforms, false);
    this.overlayMaterial = createMaterial(this.uniforms, true);
    this.fsQuad = new FullScreenQuad(this.compositeMaterial);
  }

  /** Lebar garis = thickness piksel CSS × pixelRatio (piksel fisik). */
  setPixelRatio(ratio) {
    this.pixelRatio = Number(ratio) > 0 ? Number(ratio) : 1;
    this.uniforms.uThickness.value = this.thickness * this.pixelRatio;
  }

  /** Ukuran efektif (piksel fisik) dari EffectComposer. */
  setSize(width, height) {
    this.uniforms.uResolution.value.set(Math.max(1, width), Math.max(1, height));
  }

  render(renderer, writeBuffer, readBuffer) {
    const scene = this.source?.target;
    if (!scene?.depthTexture) {
      this.needsSwap = false; // tanpa kedalaman: lewati (warna tetap di readBuffer)
      return;
    }
    const u = this.uniforms;
    u.tDepth.value = scene.depthTexture;
    u.uNear.value = this.camera.near;
    u.uFar.value = this.camera.far;
    const inPlace = !this.renderToScreen && writeBuffer === scene;
    this.needsSwap = !inPlace;
    if (inPlace) {
      u.tDiffuse.value = null;
      this.fsQuad.material = this.overlayMaterial;
      renderer.setRenderTarget(readBuffer);
    } else {
      u.tDiffuse.value = readBuffer.texture;
      this.fsQuad.material = this.compositeMaterial;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    }
    this.fsQuad.render(renderer);
  }

  dispose() {
    this.compositeMaterial.dispose();
    this.overlayMaterial.dispose();
    this.fsQuad.dispose();
  }
}
