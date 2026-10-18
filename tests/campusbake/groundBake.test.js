import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Buffer } from 'node:buffer';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bakeGroundChunks, groundReport } from '../../tools/campusbake/ground/index.js';
import { quantizeLine, quantizeRing, writeGround } from '../../tools/campusbake/ground/writeGround.js';
import { BOUNDARY, FEATURES, FIELD, PLAZAS } from './groundFixture.js';

const run = () => bakeGroundChunks({ features: FEATURES, plazas: PLAZAS, boundary: BOUNDARY, field: FIELD, keys: ['-1_0', '0_0'] });
const result = run();
const chunk = (key) => JSON.parse(result.chunks.find((c) => c.key === key).json);
const bytes = (b64) => new Uint8Array(Buffer.from(b64, 'base64'));

describe('kuantisasi', () => {
  it('0,1 m relatif origin; duplikat berurutan & penutup ring dibuang', () => {
    expect(quantizeLine([[1.04, 2], [1.0, 2.01], [3, 4]], [0, 0])).toEqual([10, 20, 30, 40]);
    expect(quantizeRing([[0, 0], [1, 0], [1, 1], [0, 0]], [0, 0])).toEqual([0, 0, 10, 0, 10, 10]);
  });
});

describe('bakeGroundChunks (golden fixture)', () => {
  it('deterministik: dua kali bake → string identik', () => {
    expect(run().chunks).toEqual(result.chunks);
  });

  it('kunci & urutan field sesuai format v1', () => {
    expect(Object.keys(chunk('0_0'))).toEqual(['v', 'key', 'roads', 'walks', 'areas', 'ditches', 'veg', 'props', 'weights']);
    expect(chunk('0_0')).toMatchObject({ v: 1, key: '0_0' });
  });

  it('jalan bertumpang 7 m di batas, dipotong ke chunk + margin 16 m', () => {
    expect(chunk('0_0').roads).toEqual([{ cls: 'tertiary', w: 100, pts: [-70, 2000, 4070, 2000] }]);
    expect(chunk('-1_0').roads).toEqual([{ cls: 'tertiary', w: 100, pts: [4930, 2000, 5160, 2000] }]);
    expect(chunk('0_0').walks).toEqual([{ w: 20, pts: [1000, 500, 1000, 3500] }]);
  });

  it('area: parkir, air (level), lapangan, plaza', () => {
    const a = chunk('0_0').areas;
    expect(a.map((x) => x.kind)).toEqual(['parking', 'water', 'pitch', 'plaza']);
    expect(a[0].rings).toEqual([[2500, 2500, 3000, 2500, 3000, 3000, 2500, 3000]]);
    expect(a[1].level).toBe(-0.4);
    expect(chunk('-1_0').areas).toEqual([]);
  });

  it('props & vegetasi hanya di chunk pemiliknya', () => {
    const p = chunk('0_0').props;
    expect(p.lamps.slice(0, 3)).toEqual([105, 2060, 180]);
    expect(p.lamps).toHaveLength(36);
    expect(p.benches.slice(0, 3)).toEqual([974, 650, 90]);
    expect(p.bins.slice(0, 2)).toEqual([974, 664]);
    expect(chunk('0_0').veg.map((v) => v.sp)).toEqual(['mahoni', 'angsana', 'saga', 'sawit', 'semak']);
    expect(chunk('-1_0').veg).toEqual([]);
    expect(chunk('-1_0').props).toEqual({ lamps: [], benches: [], bins: [] });
  });

  it('bobot chunk di luar distrik = nol (kecuali kolom i = 125, x = 0 tepat di tepi); laporan memuat air & PJU', () => {
    const w = chunk('-1_0').weights;
    expect(w.n).toBe(126);
    for (const k of ['grass', 'soil', 'wet']) expect(bytes(w[k]).every((v, i) => i % 126 === 125 || v === 0)).toBe(true);
    const lines = groundReport({ stats: result.stats, bytes: 1000, files: 2, timestamp: 'uji', ms: 1 });
    expect(lines.join('\n')).toMatch(/air osm:way\/7: muka -0\.40 m dipahat/);
    expect(lines.join('\n')).toMatch(/PJU 12, bangku 10, tong 5/);
  });
});

describe('writeGround', () => {
  let dir;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'campusbake-ground-'));
    await mkdir(join(dir, 'ground'), { recursive: true });
    await writeFile(join(dir, 'ground', '9_9.json'), '{}');
    await writeFile(join(dir, 'manifest.json'), `${JSON.stringify({
      format: 'unri-district', version: 1, terrain: { chunks: ['-1_0', '0_0'] }, ground: { chunks: [] }, buildings: 'buildings.json',
    }, null, 2)}\n`);
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('menulis berkas per chunk, menghapus berkas basi, memperbarui manifest.ground (urutan kunci tetap)', async () => {
    const out = await writeGround({ dir: join(dir, 'ground'), manifestPath: join(dir, 'manifest.json'), chunks: result.chunks });
    expect(out.files).toBe(2);
    expect((await readdir(join(dir, 'ground'))).sort()).toEqual(['-1_0.json', '0_0.json']);
    const m = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
    expect(Object.keys(m)).toEqual(['format', 'version', 'terrain', 'ground', 'buildings']);
    expect(m.ground).toEqual({ chunks: ['-1_0', '0_0'] });
  });
});
