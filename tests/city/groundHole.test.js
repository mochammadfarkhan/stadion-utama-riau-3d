import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyGroundHole, patchShaderSource } from '../../src/city/groundHole.js';

describe('patchShaderSource', () => {
  it('menyisipkan varying, uniform, dan uji discard pada chunk Lambert', () => {
    const lib = THREE.ShaderLib.lambert;
    const out = patchShaderSource({ vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader });
    expect(out.vertexShader).toContain('varying vec2 vHoleXZ;');
    expect(out.vertexShader).toContain('vHoleXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    expect(out.fragmentShader).toContain('uniform sampler2D uHoleMap;');
    expect(out.fragmentShader).toContain('discard;');
    // urutan: uji lubang sesudah clipping_planes_fragment (di dalam main)
    expect(out.fragmentShader.indexOf('discard;')).toBeGreaterThan(out.fragmentShader.indexOf('#include <clipping_planes_fragment>'));
  });
});

describe('applyGroundHole', () => {
  it('memasang onBeforeCompile + kunci program; set/clear mengubah uniform', () => {
    const mat = new THREE.MeshLambertMaterial();
    const hole = applyGroundHole(mat);
    expect(mat.customProgramCacheKey()).toBe('kota-ground-hole-v1');
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader };
    mat.onBeforeCompile(shader);
    expect(shader.uniforms.uHoleOn.value).toBe(0);
    const texture = new THREE.DataTexture(new Uint8Array(4), 2, 2, THREE.RedFormat);
    hole.set({ texture, rect: { minX: -2000, minZ: -500, maxX: 500, maxZ: 2500 } });
    expect(hole.active).toBe(true);
    expect(shader.uniforms.uHoleMap.value).toBe(texture);
    expect(shader.uniforms.uHoleRect.value.toArray()).toEqual([-2000, -500, 500, 2500]);
    hole.set(null);
    expect(hole.active).toBe(false);
    expect(shader.uniforms.uHoleMap.value).toBeNull();
  });
});
