import { describe, it, expect, vi, afterEach } from 'vitest';
import { patchGroundDetailSource, GROUND_UNIFORMS, GROUND_TEX, loadGroundTextures } from '../../src/city/groundDetail.js';

const shader = {
  vertexShader: '#include <common>\n#include <begin_vertex>\n',
  fragmentShader: '#include <common>\n#include <color_fragment>\n',
};

describe('peta rincian tanah', () => {
  const initial = { pave: GROUND_UNIFORMS.uPaveTex.value, grass: GROUND_UNIFORMS.uGrassTex.value };
  afterEach(() => { GROUND_UNIFORMS.uPaveTex.value = initial.pave; GROUND_UNIFORMS.uGrassTex.value = initial.grass; });

  it('fragmen memuat sampler; nilai awal tekstur netral 1x1', () => {
    const f = patchGroundDetailSource(shader).fragmentShader;
    expect(f).toContain('uniform sampler2D uPaveTex;');
    expect(f).toContain('uniform sampler2D uGrassTex;');
    expect(f).toContain('texture2D(uPaveTex');
    expect(initial.pave.image.width).toBe(1);
    expect(initial.grass.image.height).toBe(1);
  });

  it('memuat kedua berkas dari <baseUrl>textures/kota/ dan menggantikan uniform', async () => {
    const urls = [];
    const loadTexture = async (url) => { urls.push(url); return { url }; };
    await loadGroundTextures({ baseUrl: '/x/', loadTexture, logger: { error: vi.fn() } });
    expect(urls.sort()).toEqual([`/x/${GROUND_TEX.files.pave}`, `/x/${GROUND_TEX.files.grass}`].sort());
    expect(GROUND_UNIFORMS.uPaveTex.value.url).toBe('/x/textures/kota/paving.webp');
    expect(GROUND_UNIFORMS.uGrassTex.value.url).toBe('/x/textures/kota/rumput.webp');
  });

  it('loader menolak: tidak melempar, galat dilog, uniform tetap netral', async () => {
    const logger = { error: vi.fn() };
    await expect(loadGroundTextures({ loadTexture: () => Promise.reject(new Error('x')), logger })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
    expect(GROUND_UNIFORMS.uPaveTex.value).toBe(initial.pave);
  });
});
