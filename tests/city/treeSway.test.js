import { describe, it, expect } from 'vitest';
import { patchTreeSwaySource, applyTreeSway, SWAY_UNIFORMS } from '../../src/city/treeSway.js';

const SRC = { vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n}' };

describe('treeSway', () => {
  it('menyisipkan uniform dan pergeseran hanya untuk instans', () => {
    const { vertexShader: v } = patchTreeSwaySource(SRC);
    expect(v).toContain('uniform float uSwayT;');
    expect(v).toContain('#ifdef USE_INSTANCING');
    expect(v).toContain('transformed.x +=');
    expect(v).toContain('#include <begin_vertex>');
  });
  it('tidak memakai kata cadangan GLSL', () => {
    const { vertexShader: v } = patchTreeSwaySource(SRC);
    expect(v).not.toMatch(/\b(patch|sample|common|input|output)\s+[a-z]/);
  });
  it('applyTreeSway menautkan uniform bersama dan menjaga hook lama', () => {
    let called = 0;
    const mat = { onBeforeCompile: () => { called += 1; } };
    applyTreeSway(mat);
    const shader = { uniforms: {}, vertexShader: SRC.vertexShader };
    mat.onBeforeCompile(shader);
    expect(called).toBe(1);
    expect(shader.uniforms.uSwayT).toBe(SWAY_UNIFORMS.uSwayT);
    expect(shader.vertexShader).toContain('swayPh');
  });
});
