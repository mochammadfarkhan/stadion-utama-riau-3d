import * as THREE from 'three';

/**
 * State angin global yang dibagikan semua shader (pohon, bendera, rumput).
 * Uniform dibagikan by-reference: material cukup menunjuk ke objek uniform ini,
 * dan satu pembaruan per frame (updateWind) langsung berlaku untuk semua.
 */
export const WIND_UNIFORMS = Object.freeze({
  uWindTime: { value: 0 },
  uWindStrength: { value: 0.3 },           // 0..1 (0.3 = sepoi, 1 = badai)
  uWindDir: { value: new THREE.Vector2(0.8, 0.6).normalize() },
});

/** Dipanggil sekali per frame dari loop utama. */
export function updateWind(dt) {
  WIND_UNIFORMS.uWindTime.value += dt * (0.6 + WIND_UNIFORMS.uWindStrength.value * 1.2);
}

export function setWindStrength(v) {
  WIND_UNIFORMS.uWindStrength.value = Math.min(1, Math.max(0, Number(v) || 0));
}

export function setWindDirection(x, z) {
  WIND_UNIFORMS.uWindDir.value.set(x, z).normalize();
}

/** Potongan GLSL bersama: deklarasi uniform + fungsi goyang (dipakai lewat onBeforeCompile). */
export const WIND_GLSL_UNIFORMS = /* glsl */ `
uniform float uWindTime;
uniform float uWindStrength;
uniform vec2 uWindDir;
`;

/**
 * windOffset(worldPos, weight): pergeseran XZ berdasarkan gelombang berjalan + gust.
 * weight biasanya = tinggi relatif vertex (0 di akar, 1 di puncak) agar akar tetap diam.
 */
export const WIND_GLSL_FUNC = /* glsl */ `
vec3 windOffset(vec3 worldPos, float weight) {
  float phase = dot(worldPos.xz, uWindDir) * 0.15 + uWindTime;
  float wave = sin(phase) * 0.6 + sin(phase * 2.3 + 1.7) * 0.25 + sin(phase * 0.37) * 0.15;
  float gust = 0.5 + 0.5 * sin(uWindTime * 0.21 + worldPos.x * 0.02);
  float amp = uWindStrength * (0.6 + 0.8 * gust) * weight;
  return vec3(uWindDir.x * wave * amp, -abs(wave) * amp * 0.15, uWindDir.y * wave * amp);
}
`;
