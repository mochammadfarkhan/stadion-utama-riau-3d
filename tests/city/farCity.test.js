import { describe, it, expect } from 'vitest';
import { parseBuildings, parseRoads, parseTrees } from '../../src/city/farCity.js';

describe('format biner kota jauh (v2)', () => {
  it('parseBuildings membaca 10 byte/bangunan (desimeter, setengah meter, rotasi, bendera atap pelana)', () => {
    const buf = new ArrayBuffer(20);
    const v = new DataView(buf);
    v.setUint16(0, 12345, true); v.setUint16(2, 20000, true); v.setUint8(4, 24); v.setUint8(5, 18); v.setUint8(6, 9); v.setUint8(7, 4);
    v.setUint8(8, 255); v.setUint8(9, 1);
    v.setUint16(10, 1, true); v.setUint16(12, 2, true); v.setUint8(14, 255); v.setUint8(15, 1); v.setUint8(16, 200); v.setUint8(17, 0);
    v.setUint8(18, 0); v.setUint8(19, 0);
    const list = parseBuildings(buf);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ x: 1234.5, z: 2000, w: 12, d: 9, h: 4.5, cls: 4, gable: true });
    expect(list[0].rot).toBeCloseTo(Math.PI / 4, 6); // 255 → +45°
    expect(list[1].w).toBe(127.5);
    expect(list[1].gable).toBe(false);
    expect(list[1].rot).toBeCloseTo(-Math.PI / 4, 6); // 0 → −45°
  });
  it('parseTrees membaca 5 byte/pohon', () => {
    const buf = new ArrayBuffer(10);
    const v = new DataView(buf);
    v.setUint16(0, 100, true); v.setUint16(2, 250, true); v.setUint8(4, 20);
    v.setUint16(5, 65535, true); v.setUint16(7, 0, true); v.setUint8(9, 13);
    expect(parseTrees(buf)).toEqual([{ x: 10, z: 25, h: 10 }, { x: 6553.5, z: 0, h: 6.5 }]);
  });
  it('parseRoads membaca rangkaian [kelas, n, titik i16] dan berhenti pada data terpotong', () => {
    const b = new ArrayBuffer(3 + 8 + 3 + 4);
    const v = new DataView(b);
    v.setUint8(0, 2); v.setUint16(1, 2, true);
    v.setInt16(3, -100, true); v.setInt16(5, 50, true); v.setInt16(7, 3000, true); v.setInt16(9, -7, true);
    v.setUint8(11, 5); v.setUint16(12, 9, true); // n=9 tetapi data habis → dibuang
    const roads = parseRoads(b);
    expect(roads).toEqual([{ cls: 2, pts: [[-10, 5], [300, -0.7]] }]);
  });
});

describe('alas diorama', () => {
  it('slabGeometry: 4 dinding × lapisan quad, normal keluar, kedalaman total = lapisan terdalam', async () => {
    const { slabGeometry, SLAB_STRATA } = await import('../../src/city/farCity.js');
    const b = { minX: -100, maxX: 300, minZ: -50, maxZ: 250 };
    const g = slabGeometry(b, -0.4);
    expect(g.index.count).toBe(4 * SLAB_STRATA.length * 6);
    const pos = g.attributes.position;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i += 1) { minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i)); }
    expect(maxY).toBeCloseTo(-0.4, 3);
    expect(minY).toBeCloseTo(-0.4 - SLAB_STRATA.at(-1).depth, 2);
    const nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i += 1) { // titik pada dinding: normal searah dari pusat peta ke luar
      const outX = pos.getX(i) < 100 ? -1 : 1;
      const onXWall = pos.getX(i) === b.minX || pos.getX(i) === b.maxX;
      if (onXWall && nor.getX(i) !== 0) expect(Math.sign(nor.getX(i))).toBe(outX);
    }
  });
});

describe('kota jauh: perakitan per blok + detail menurut jarak', () => {
  it('batchKey mengelompokkan n × n sel (juga koordinat negatif)', async () => {
    const { batchKey, FAR_BATCH } = await import('../../src/city/farCity.js');
    expect(batchKey(0, 0, 4)).toBe('0_0');
    expect(batchKey(3, 3, 4)).toBe('0_0');
    expect(batchKey(4, -1, 4)).toBe('1_-1');
    expect(batchKey(-1, -4, 4)).toBe('-1_-1');
    expect(batchKey(1, 1)).toBe(FAR_BATCH > 1 ? '0_0' : '1_1');
  });
  it('farDetail: penuh dekat, menyusut linier, batas bawah per jenis', async () => {
    const { farDetail } = await import('../../src/city/farCity.js');
    expect(farDetail(1000, 'bangunan')).toBe(1);
    expect(farDetail(20000, 'bangunan')).toBe(0.45);
    expect(farDetail(13000, 'bangunan')).toBeCloseTo(0.725, 6);
    expect(farDetail(14000, 'pohon')).toBe(0.25);
    expect(farDetail(99999, 'lain')).toBe(1);
  });
});

describe('pratinjau kota: detail kecil tile disembunyikan saat zoom jauh', () => {
  it('histeresis 6000 / 5000 m', async () => {
    const { nextTileDetailHidden } = await import('../../src/city/index.js');
    expect(nextTileDetailHidden(false, 5500)).toBe(false);
    expect(nextTileDetailHidden(false, 6100)).toBe(true);
    expect(nextTileDetailHidden(true, 5500)).toBe(true);
    expect(nextTileDetailHidden(true, 4900)).toBe(false);
    expect(nextTileDetailHidden(true, NaN)).toBe(true);
  });
});

describe('blur maket tanpa pola kisi', () => {
  it('blurPlan memecah radius besar jadi putaran kecil (≤ 4)', async () => {
    const { blurPlan } = await import('../../src/core/postprocessing/efekLayar.js');
    expect(blurPlan(1)).toEqual({ iterations: 1, step: 1 });
    const p = blurPlan(3.6);
    expect(p.iterations).toBe(3);
    expect(p.step).toBeCloseTo(2.078, 3);
    expect(blurPlan(100).iterations).toBe(4);
  });
});
