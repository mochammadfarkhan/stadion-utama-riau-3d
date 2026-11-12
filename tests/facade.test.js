import { describe, it, expect } from 'vitest';
import { patchFacadeSource } from '../src/city/facade.js';

const shader = {
  vertexShader: '#include <common>\n#include <begin_vertex>\n',
  fragmentShader: '#include <common>\n#include <color_fragment>\n',
};
// Kata terpesan GLSL yang pernah menjatuhkan shader atap (tidak terkompilasi = atap tak tergambar).
const RESERVED = /\b(patch|sample|common|filter|input|output|packed|union|namespace)\b\s+\w+\s*=/;

describe('fasad kota (patch shader)', () => {
  for (const kind of ['wall', 'roof']) {
    it(`${kind}: menyisipkan varying & pola, tanpa nama variabel terpesan`, () => {
      const out = patchFacadeSource(shader, kind);
      expect(out.vertexShader).toContain('vFacadeP =');
      expect(out.fragmentShader).toContain('facadeFade');
      expect(out.fragmentShader.split('\n').filter((l) => RESERVED.test(l.replace(/^#include.*/, '')))).toEqual([]);
    });
  }
});
