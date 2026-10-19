import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SETS, averageColor, mapPath, packOrm, pickMapFile, resizePlan, validateManifest,
} from '../tools/texbake/sets.mjs';
import {
  TERRAIN_LAYERS, TILE_M, autoTerrainQuality, maxTerrainSamples, resolveTerrainQuality, resolveTier, tierForQuality,
} from '../src/world/textures/pbrCore.js';

describe('texbake: pak ORM dan rencana ukuran', () => {
  it('packOrm menaruh AO di R, Roughness di G, B nol', () => {
    const out = packOrm(Uint8Array.from([10, 20]), Uint8Array.from([100, 200]), 2);
    expect([...out]).toEqual([10, 100, 0, 20, 200, 0]);
  });
  it('packOrm tanpa AO/roughness memakai default (255 / 200)', () => {
    expect([...packOrm(null, null, 1)]).toEqual([255, 200, 0]);
  });
  it('resizePlan: 512+256, ditambah 1024 hanya set besar', () => {
    expect(resizePlan({ big: false })).toEqual([512, 256]);
    expect(resizePlan({ big: true })).toEqual([1024, 512, 256]);
    const big = SETS.filter((s) => s.big).map((s) => s.id).sort();
    expect(big).toEqual(['Bark001', 'CorrugatedSteel005', 'Planks021', 'Plaster001']);
  });
  it('averageColor dan mapPath', () => {
    expect(averageColor(Uint8Array.from([255, 0, 0, 255, 0, 0]))).toBe('#ff0000');
    expect(mapPath('grass', 'orm', 256)).toBe('grass/orm.256.webp');
  });
  it('pickMapFile memilih NormalGL (bukan NormalDX) dan mengabaikan huruf besar/kecil', () => {
    const files = ['X_Color.jpg', 'X_NormalDX.jpg', 'X_NormalGL.jpg', 'X_Roughness.jpg', 'X_AmbientOcclusion.jpg'];
    expect(pickMapFile(files, 'normal')).toBe('X_NormalGL.jpg');
    expect(pickMapFile(files, 'ao')).toBe('X_AmbientOcclusion.jpg');
    expect(pickMapFile(files.slice(0, 4), 'ao')).toBeNull();
  });
});

describe('texbake: validasi manifest', () => {
  const ok = { v: 1, source: { license: 'CC0-1.0' }, sets: [{ name: 'a', avg: '#112233', tileM: 1, sourceId: 'A1', license: 'CC0-1.0', sizes: [512, 256] }] };
  it('manifest benar lolos', () => expect(validateManifest(ok)).toEqual([]));
  it('menolak lisensi non-CC0, nama ganda, avg buruk, sizes tanpa 256', () => {
    const bad = { ...ok, sets: [{ ...ok.sets[0], license: 'CC-BY' }, { ...ok.sets[0], avg: 'merah', sizes: [512] }] };
    const errs = validateManifest(bad).join('|');
    expect(errs).toMatch(/lisensi/);
    expect(errs).toMatch(/ganda/);
    expect(errs).toMatch(/avg/);
    expect(errs).toMatch(/sizes/);
  });
  it('manifest hasil bake (bila ada) valid, sizes ada di disk, tileM sama dengan TILE_M runtime', () => {
    const path = new URL('../public/textures/manifest.json', import.meta.url);
    if (!existsSync(path)) return;
    const m = JSON.parse(readFileSync(path, 'utf8'));
    expect(validateManifest(m)).toEqual([]);
    for (const s of m.sets) {
      expect(TILE_M[s.name], s.name).toBe(s.tileM);
      for (const size of s.sizes) for (const k of ['albedo', 'normal', 'orm']) {
        expect(existsSync(new URL(`../public/textures/${mapPath(s.name, k, size)}`, import.meta.url)), mapPath(s.name, k, size)).toBe(true);
      }
    }
  });
});

describe('pbrCore: tier dan kualitas tanah', () => {
  it('tierForQuality dan resolveTier', () => {
    expect(tierForQuality('tinggi')).toBe(512);
    expect(tierForQuality('rendah')).toBe(256);
    expect(resolveTier(512, [1024, 512, 256])).toBe(512);
    expect(resolveTier(1024, [512, 256])).toBe(512);
    expect(resolveTier(128, [512, 256])).toBe(256);
  });
  it('kualitas otomatis turun cepat dan naik dengan histeresis', () => {
    expect(autoTerrainQuality('tinggi', 1.25)).toBe('tinggi');
    expect(autoTerrainQuality('tinggi', 0.75)).toBe('sedang');
    expect(autoTerrainQuality('tinggi', 0.5)).toBe('rendah');
    expect(autoTerrainQuality('sedang', 0.85)).toBe('sedang'); // belum melewati 0.9
    expect(autoTerrainQuality('sedang', 0.95)).toBe('tinggi');
    expect(autoTerrainQuality('rendah', 0.7)).toBe('rendah');
    expect(autoTerrainQuality('rendah', 0.75)).toBe('sedang');
  });
  it('pengaturan manual menang atas otomatis', () => {
    expect(resolveTerrainQuality('rendah', 'tinggi', 2)).toBe('rendah');
    expect(resolveTerrainQuality('auto', 'tinggi', 0.5)).toBe('rendah');
  });
  it('anggaran sampel tanah <= 8 untuk semua kualitas', () => {
    for (const q of Object.keys(TERRAIN_LAYERS)) expect(maxTerrainSamples(q)).toBeLessThanOrEqual(8);
  });
});
