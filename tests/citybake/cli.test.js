import { describe, it, expect, vi } from 'vitest';
import { parseCli, main } from '../../tools/citybake/cli.js';

describe('parseCli', () => {
  it('--area all → semua area; default opsi', () => {
    expect(parseCli(['--area', 'all'])).toEqual({
      areaIds: ['stadion', 'pusat', 'unri'], offline: false, useOverture: true, release: '2026-09-23.1',
      outDir: 'public/tiles', cacheDir: 'data-src',
    });
  });

  it('opsi lengkap', () => {
    const o = parseCli(['--area', 'pusat', '--offline', '--no-overture', '--overture-release', '2026-10-21.0', '--out', 'tmp/t']);
    expect(o).toMatchObject({ areaIds: ['pusat'], offline: true, useOverture: false, release: '2026-10-21.0', outDir: 'tmp/t' });
  });

  it('galat: tanpa --area, area tak dikenal, opsi tak dikenal', () => {
    expect(() => parseCli([])).toThrow(/--area wajib/);
    expect(() => parseCli(['--area', 'bandara'])).toThrow(/tidak dikenal/);
    expect(() => parseCli(['--area', 'stadion', '--cepat'])).toThrow();
  });
});

describe('main', () => {
  it('argumen salah → exit code 2 dengan pesan pemakaian', async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    expect(await main(['--area', 'bandara'], log)).toBe(2);
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/Pakai: node tools\/citybake/));
  });
});
