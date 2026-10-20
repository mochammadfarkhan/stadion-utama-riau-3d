import { describe, expect, it } from 'vitest';
import { KTX_SIZES, ktxPath, ktxSizesFor, toktxArgs } from '../tools/texbake/ktxCore.mjs';
import { compressedBytes, textureBytes } from '../src/world/textures/pbrCore.js';

describe('pipeline KTX2', () => {
  it('ukuran yang dikonversi = irisan ukuran set dan KTX_SIZES (256 tetap WebP)', () => {
    expect(KTX_SIZES).toEqual([1024, 512]);
    expect(ktxSizesFor([1024, 512, 256])).toEqual([1024, 512]);
    expect(ktxSizesFor([512, 256])).toEqual([512]);
    expect(ktxSizesFor([256])).toEqual([]);
  });
  it('path keluaran konsisten', () => {
    expect(ktxPath('grass', 'normal', 512)).toBe('grass/normal.512.ktx2');
  });
  it('argumen toktx: albedo ETC1S sRGB, orm ETC1S linear, normal UASTC linear, semuanya dengan mip dan lower-left', () => {
    const io = { input: 'in.png', output: 'out.ktx2' };
    const albedo = toktxArgs('albedo', io);
    const orm = toktxArgs('orm', io);
    const normal = toktxArgs('normal', io);
    for (const a of [albedo, orm, normal]) {
      expect(a).toEqual(expect.arrayContaining(['--t2', '--genmipmap', '--lower_left_maps_to_s0t0']));
      expect(a.slice(-2)).toEqual(['out.ktx2', 'in.png']);
    }
    expect(albedo.join(' ')).toContain('--encode etc1s');
    expect(albedo.join(' ')).toContain('--assign_oetf srgb');
    expect(orm.join(' ')).toContain('--assign_oetf linear');
    expect(normal.join(' ')).toContain('--encode uastc');
    expect(normal).not.toContain('--normal_mode'); // material memakai normal RGB biasa
  });
  it('jenis peta tak dikenal ditolak', () => {
    expect(() => toktxArgs('emisi', { input: 'a', output: 'b' })).toThrow(/tak dikenal/);
  });
  it('byte terkompresi jauh lebih kecil dari RGBA', () => {
    expect(compressedBytes(512, 512)).toBe(Math.round(512 * 512 * 4 / 3));
    expect(compressedBytes(512, 512)).toBeLessThan(textureBytes(512, 512) / 3);
  });
});
