import * as THREE from 'three';

/**
 * Pembatas saturasi (HSV, mirror persis GLSL di bawah; murni & dites): s <= knee tidak berubah; di atasnya dikompres
 * halus (kemiringan 1 di knee) menuju `ceil` tanpa pernah melewatinya. Monoton naik, kontinu.
 */
export function limitSaturation(s, knee, ceil) {
  if (!(s > knee)) return Math.max(0, Number.isFinite(s) ? s : 0);
  const span = Math.max(1e-4, ceil - knee);
  return knee + span * (1 - Math.exp(-(s - knee) / span));
}

/**
 * Color grading murah satu pass (ruang linear HDR, sebelum OutputPass): saturasi, pembatas saturasi (biru jenuh tidak
 * meledak), kontras di sekitar abu-abu 18%, split-toning sorotan hangat / bayangan sejuk (berdasarkan luma; warna tint
 * dinormalisasi ke luma 1), tambahan bloom (tBloom, hanya bila bloomIntensity > 0), dan vinyet halus.
 */
export const GradingShader = {
  name: 'GradingShader',
  uniforms: {
    tDiffuse: { value: null },
    tBloom: { value: null },
    bloomIntensity: { value: 0 },
    saturation: { value: 1 },
    satKnee: { value: 0.5 },
    satCeil: { value: 0.8 },
    contrast: { value: 1 },
    strength: { value: 0 },
    vignette: { value: 0 },
    highlight: { value: new THREE.Vector3(1, 1, 1) },
    shadow: { value: new THREE.Vector3(1, 1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tBloom;
    uniform float bloomIntensity;
    uniform float saturation;
    uniform float satKnee;
    uniform float satCeil;
    uniform float contrast;
    uniform float strength;
    uniform float vignette;
    uniform vec3 highlight;
    uniform vec3 shadow;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = tex.rgb;
      if (bloomIntensity > 0.0) c += texture2D(tBloom, vUv).rgb * bloomIntensity;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      float mx = max(c.r, max(c.g, c.b));
      float mn = min(c.r, min(c.g, c.b));
      float s = (mx - mn) / max(mx, 1e-4);
      if (s > satKnee) {
        float span = max(1e-4, satCeil - satKnee);
        float s2 = satKnee + span * (1.0 - exp(-(s - satKnee) / span));
        c = vec3(mx) - (vec3(mx) - c) * (s2 / s);
      }
      c = max((c - 0.18) * contrast + 0.18, 0.0);
      float t = smoothstep(0.03, 0.7, l);
      c *= mix(vec3(1.0), mix(shadow, highlight, t), strength);
      vec2 d = vUv - 0.5;
      c *= 1.0 - vignette * smoothstep(0.25, 0.8, dot(d, d) * 2.0);
      gl_FragColor = vec4(c, tex.a);
    }
  `,
};

const _c = new THREE.Color();

/** Warna hex sRGB → vektor linear ternormalisasi ke luma 1 (tint pengali). */
export function tintVector(hex, out = new THREE.Vector3()) {
  _c.setHex(hex);
  const l = 0.2126 * _c.r + 0.7152 * _c.g + 0.0722 * _c.b || 1;
  return out.set(_c.r / l, _c.g / l, _c.b / l);
}
