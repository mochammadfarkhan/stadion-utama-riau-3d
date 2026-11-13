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

describe('faktor malam', () => {
  it('siang 0, malam 1, transisi halus & melingkar 24 jam', async () => {
    const { nightFactor } = await import('../src/city/facade.js');
    expect(nightFactor(12)).toBe(0);
    expect(nightFactor(16)).toBe(0);
    expect(nightFactor(21)).toBe(1);
    expect(nightFactor(2)).toBe(1);
    expect(nightFactor(7)).toBe(0);
    expect(nightFactor(18.25)).toBeGreaterThan(0.2);
    expect(nightFactor(18.25)).toBeLessThan(0.8);
    expect(nightFactor(-3)).toBe(nightFactor(21)); // 24 jam melingkar
  });
});

describe('cahaya jendela', () => {
  it('dinding menyuntik emisi malam setelah emissivemap_fragment; atap tidak', () => {
    const sh = { vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>' };
    expect(patchFacadeSource(sh, 'wall').fragmentShader).toContain('totalEmissiveRadiance +=');
    expect(patchFacadeSource(sh, 'roof').fragmentShader).not.toContain('totalEmissiveRadiance +=');
  });
});
