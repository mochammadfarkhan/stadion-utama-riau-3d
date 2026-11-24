import { describe, it, expect, vi, afterEach } from 'vitest';
import { patchFacadeSource, FACADE_UNIFORMS, FACADE_TEX, loadFacadeTextures } from '../src/city/facade.js';

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

describe('detail tanah', () => {
  it('menyisipkan varying & pola tanpa nama terpesan', async () => {
    const { patchGroundDetailSource } = await import('../src/city/groundDetail.js');
    const out = patchGroundDetailSource({ vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' });
    expect(out.vertexShader).toContain('vGroundP =');
    expect(out.fragmentShader).toContain('gdVar');
    expect(out.fragmentShader).not.toMatch(/\b(patch|sample|filter|input|output|packed|union)\b\s+\w+\s*=/);
  });
});

describe('peta rincian fasad', () => {
  const initial = { roof: FACADE_UNIFORMS.uRoofTex.value, wall: FACADE_UNIFORMS.uWallTex.value };
  afterEach(() => { FACADE_UNIFORMS.uRoofTex.value = initial.roof; FACADE_UNIFORMS.uWallTex.value = initial.wall; });

  it('fragmen memuat sampler; nilai awal tekstur netral 1x1', () => {
    expect(patchFacadeSource(shader, 'wall').fragmentShader).toContain('uniform sampler2D uWallTex;');
    expect(patchFacadeSource(shader, 'roof').fragmentShader).toContain('texture2D(uRoofTex');
    expect(initial.roof.image.width).toBe(1);
    expect(initial.wall.image.height).toBe(1);
  });

  it('memuat kedua berkas dari <baseUrl>textures/kota/ dan menggantikan uniform', async () => {
    const urls = [];
    const loadTexture = async (url) => { urls.push(url); return { url }; };
    await loadFacadeTextures({ baseUrl: '/x/', loadTexture, logger: { error: vi.fn() } });
    expect(urls.sort()).toEqual([`/x/${FACADE_TEX.files.roof}`, `/x/${FACADE_TEX.files.wall}`].sort());
    expect(FACADE_UNIFORMS.uRoofTex.value.url).toBe('/x/textures/kota/genteng.webp');
    expect(FACADE_UNIFORMS.uWallTex.value.url).toBe('/x/textures/kota/fasad.webp');
  });

  it('loader menolak: tidak melempar, galat dilog, uniform tetap netral', async () => {
    const logger = { error: vi.fn() };
    await expect(loadFacadeTextures({ loadTexture: () => Promise.reject(new Error('x')), logger })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
    expect(FACADE_UNIFORMS.uRoofTex.value).toBe(initial.roof);
  });
});
