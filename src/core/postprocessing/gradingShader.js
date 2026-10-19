import * as THREE from 'three';

/**
 * Color grading murah satu pass (ruang linear HDR, sebelum OutputPass): saturasi, kontras di sekitar abu-abu 18%,
 * lalu tint sorotan hangat / bayangan sejuk (berdasarkan luma). Warna tint dinormalisasi ke luma 1 agar tidak
 * mengubah kecerahan keseluruhan.
 */
export const GradingShader = {
  name: 'GradingShader',
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1 },
    contrast: { value: 1 },
    strength: { value: 0 },
    highlight: { value: new THREE.Vector3(1, 1, 1) },
    shadow: { value: new THREE.Vector3(1, 1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    uniform float strength;
    uniform vec3 highlight;
    uniform vec3 shadow;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = tex.rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      c = max((c - 0.18) * contrast + 0.18, 0.0);
      float t = smoothstep(0.03, 0.7, l);
      c *= mix(vec3(1.0), mix(shadow, highlight, t), strength);
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
