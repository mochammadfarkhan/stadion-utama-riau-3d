/**
 * Lubang pada tanah dasar kota (y −0,05, menulis depth) di sel yang ditutup terrain distrik: tanpa
 * lubang, terrain di bawah y −0,05 (cekungan, danau) tertutup tanah dasar. Fragmen dibuang bila tekstur
 * R8 sel (NearestFilter, byte 1 = lubang → r = 1/255, jadi ambang 0,002; ambang 0,5 membuat lubang tak pernah aktif —
 * diperbaiki di M2) bernilai 1 di posisi dunia fragmen. Satu lubang aktif (distrik UNRI);
 * tanpa lubang shader identik perilaku lama (uniform uHoleOn = 0).
 */
import * as THREE from 'three';

const VERTEX_DECL = 'varying vec2 vHoleXZ;';
const FRAGMENT_DECL = 'varying vec2 vHoleXZ;\nuniform sampler2D uHoleMap;\nuniform vec4 uHoleRect;\nuniform float uHoleOn;';
const FRAGMENT_TEST = [
  'if (uHoleOn > 0.5) {',
  '  vec2 holeUv = (vHoleXZ - uHoleRect.xy) / (uHoleRect.zw - uHoleRect.xy);',
  '  if (all(greaterThanEqual(holeUv, vec2(0.0))) && all(lessThan(holeUv, vec2(1.0))) && texture2D(uHoleMap, holeUv).r > 0.002) discard;',
  '}',
].join('\n');

/** Sisipkan deklarasi & uji lubang ke sumber shader (murni; dites tanpa WebGL). */
export function patchShaderSource(shader) {
  return {
    vertexShader: shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_DECL}`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHoleXZ = (modelMatrix * vec4(transformed, 1.0)).xz;'),
    fragmentShader: shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_DECL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${FRAGMENT_TEST}`),
  };
}

/**
 * Pasang dukungan lubang pada material tanah dasar (sekali).
 * @param {THREE.Material} material
 * @returns {{set(hole:{texture:THREE.Texture, rect:{minX:number,minZ:number,maxX:number,maxZ:number}}|null):void, readonly active:boolean}}
 */
export function applyGroundHole(material) {
  const uniforms = {
    uHoleMap: { value: null },
    uHoleRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uHoleOn: { value: 0 },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const patched = patchShaderSource(shader);
    shader.vertexShader = patched.vertexShader;
    shader.fragmentShader = patched.fragmentShader;
  };
  material.customProgramCacheKey = () => 'kota-ground-hole-v1';
  material.needsUpdate = true;
  return {
    set(hole) {
      if (!hole) {
        uniforms.uHoleOn.value = 0;
        uniforms.uHoleMap.value = null;
        return;
      }
      const { minX, minZ, maxX, maxZ } = hole.rect;
      uniforms.uHoleRect.value.set(minX, minZ, maxX, maxZ);
      uniforms.uHoleMap.value = hole.texture;
      uniforms.uHoleOn.value = 1;
    },
    get active() { return uniforms.uHoleOn.value === 1; },
  };
}
