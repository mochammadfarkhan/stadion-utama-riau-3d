import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * Efek layar murah gaya kartun: BloomLitePass (ekstrak sorotan + blur separabel, setengah resolusi; hasil ke
 * `texture`, TIDAK mengubah gambar — ditambahkan di GradingShader) dan TiltShiftPass (blur dua pass setengah resolusi
 * dicampur menurut jarak vertikal layar dari tengah). Keduanya dilewati total saat enabled = false.
 */

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const EXTRACT = {
  uniforms: { tDiffuse: { value: null }, threshold: { value: 1.25 }, knee: { value: 0.5 } },
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float threshold;
    uniform float knee;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = max(c.r, max(c.g, c.b));
      float soft = clamp((l - threshold + knee) / (2.0 * knee), 0.0, 1.0);
      float w = max(soft * soft * knee * 0.5, l - threshold) / max(l, 1e-4);
      gl_FragColor = vec4(c * max(w, 0.0), 1.0);
    }
  `,
};

const BLUR = {
  uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2(1, 0) } },
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 dir;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
      c += (texture2D(tDiffuse, vUv + dir * 1.3846153846).rgb + texture2D(tDiffuse, vUv - dir * 1.3846153846).rgb) * 0.3162162162;
      c += (texture2D(tDiffuse, vUv + dir * 3.2307692308).rgb + texture2D(tDiffuse, vUv - dir * 3.2307692308).rgb) * 0.0702702703;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

const TILT_MIX = {
  uniforms: {
    tDiffuse: { value: null }, tBlur: { value: null },
    focus: { value: 0.5 }, band: { value: 0.2 }, falloff: { value: 0.28 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tBlur;
    uniform float focus;
    uniform float band;
    uniform float falloff;
    varying vec2 vUv;
    void main() {
      vec4 sharp = texture2D(tDiffuse, vUv);
      float w = smoothstep(band, band + falloff, abs(vUv.y - focus));
      gl_FragColor = vec4(mix(sharp.rgb, texture2D(tBlur, vUv).rgb, w), sharp.a);
    }
  `,
};

const quadOf = (shader) => new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(shader.uniforms), vertexShader: shader.vertexShader, fragmentShader: shader.fragmentShader, depthTest: false, depthWrite: false }));

const makeTarget = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });

function setHalf(targets, w, h, scale) {
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  for (const t of targets) t.setSize(tw, th);
}

/** Bloom setengah resolusi: `texture` berisi sorotan terblur (dibaca GradingShader). */
export class BloomLitePass extends Pass {
  constructor({ threshold, knee, scale, radius }) {
    super();
    this.needsSwap = false; // tidak menyentuh gambar utama
    this.scale = scale;
    this.radius = radius;
    this.a = makeTarget();
    this.b = makeTarget();
    this.extract = quadOf(EXTRACT);
    this.blur = quadOf(BLUR);
    this.extract.material.uniforms.threshold.value = threshold;
    this.extract.material.uniforms.knee.value = knee;
    this.size = new THREE.Vector2(1, 1);
  }

  get texture() { return this.a.texture; }

  setSize(w, h) {
    this.size.set(w, h);
    setHalf([this.a, this.b], w, h, this.scale);
  }

  render(renderer, writeBuffer, readBuffer) {
    const tw = this.a.width;
    const th = this.a.height;
    this.extract.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.a);
    this.extract.render(renderer);
    const u = this.blur.material.uniforms;
    u.tDiffuse.value = this.a.texture;
    u.dir.value.set(this.radius / tw, 0);
    renderer.setRenderTarget(this.b);
    this.blur.render(renderer);
    u.tDiffuse.value = this.b.texture;
    u.dir.value.set(0, this.radius / th);
    renderer.setRenderTarget(this.a);
    this.blur.render(renderer);
  }

  dispose() {
    this.a.dispose(); this.b.dispose();
    this.extract.dispose(); this.blur.dispose();
  }
}

/** Efek maket: blur H+V setengah resolusi, dicampur menurut jarak vertikal dari tengah layar. */
export class TiltShiftPass extends Pass {
  constructor({ focus, band, falloff, radius, scale }) {
    super();
    this.scale = scale;
    this.radius = radius;
    this.a = makeTarget();
    this.b = makeTarget();
    this.blur = quadOf(BLUR);
    this.mix = quadOf(TILT_MIX);
    const u = this.mix.material.uniforms;
    u.focus.value = focus; u.band.value = band; u.falloff.value = falloff;
  }

  setSize(w, h) {
    setHalf([this.a, this.b], w, h, this.scale);
  }

  render(renderer, writeBuffer, readBuffer) {
    const tw = this.a.width;
    const th = this.a.height;
    const u = this.blur.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.dir.value.set(this.radius / tw, 0);
    renderer.setRenderTarget(this.b);
    this.blur.render(renderer);
    u.tDiffuse.value = this.b.texture;
    u.dir.value.set(0, this.radius / th);
    renderer.setRenderTarget(this.a);
    this.blur.render(renderer);
    const m = this.mix.material.uniforms;
    m.tDiffuse.value = readBuffer.texture;
    m.tBlur.value = this.a.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.mix.render(renderer);
  }

  dispose() {
    this.a.dispose(); this.b.dispose();
    this.blur.dispose(); this.mix.dispose();
  }
}
