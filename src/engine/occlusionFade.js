import * as THREE from 'three';

/**
 * Fade pohon yang menutup pemain (kamera 3/4 dan orang ketiga). Uniform dibagikan by-reference ke semua material
 * berangin (applyWind: tajuk, kartu daun, semak): fragmen yang berada di antara kamera dan pemain dalam jarak
 * FADE.radius dari garis pandang dibuang dengan pola dither layar (tanpa blending, tanpa draw call tambahan).
 * Pass bayangan dilewati (bayangan tidak boleh bolong mengikuti kamera).
 */
export const OCCLUSION_FADE = Object.freeze({ radius: 2.6, targetLift: 1.2, strength: 0.9 });

export const FADE_UNIFORMS = Object.freeze({
  uFadeCam: { value: new THREE.Vector3() },
  uFadeTgt: { value: new THREE.Vector3() },
  uFadeR: { value: OCCLUSION_FADE.radius },
  uFadeOn: { value: 0 },
});

/** Deklarasi uniform + varying posisi dunia (vertex dan fragment). */
export const FADE_GLSL_DECL = /* glsl */ `
uniform vec3 uFadeCam;
uniform vec3 uFadeTgt;
uniform float uFadeR;
uniform float uFadeOn;
varying vec3 vFadeWorld;
`;

/** Disisipkan setelah clipping_planes_fragment: buang fragmen dekat garis kamera→pemain dengan pola dither. */
export const FADE_GLSL_FRAGMENT = /* glsl */ `
#include <clipping_planes_fragment>
if (uFadeOn > 0.5) {
  vec3 fAb = uFadeTgt - uFadeCam;
  float fT = clamp(dot(vFadeWorld - uFadeCam, fAb) / max(dot(fAb, fAb), 0.0001), 0.0, 1.0);
  float fD = length(vFadeWorld - (uFadeCam + fAb * fT));
  float fK = (1.0 - smoothstep(uFadeR * 0.45, uFadeR, fD)) * step(fT, 0.95);
  float fN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (fN < fK * ${OCCLUSION_FADE.strength.toFixed(2)}) discard;
}`;

/**
 * Perbarui uniform per frame. `enabled` false (mode asli, kamera orang pertama) mematikan fade.
 * @param {{x:number,y:number,z:number}} cam posisi kamera dunia
 * @param {{x:number,y:number,z:number}|null} target posisi kaki pemain
 */
export function updateOcclusionFade(cam, target, enabled) {
  const on = Boolean(enabled && cam && target && Number.isFinite(cam.x + target.x + target.z));
  FADE_UNIFORMS.uFadeOn.value = on ? 1 : 0;
  if (!on) return;
  FADE_UNIFORMS.uFadeCam.value.set(cam.x, cam.y, cam.z);
  FADE_UNIFORMS.uFadeTgt.value.set(target.x, (target.y ?? 0) + OCCLUSION_FADE.targetLift, target.z);
}
