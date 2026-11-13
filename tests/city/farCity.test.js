import { describe, it, expect } from 'vitest';
import { parseBuildings, parseRoads } from '../../src/city/farCity.js';

describe('format biner kota jauh', () => {
  it('parseBuildings membaca 8 byte/bangunan (desimeter, setengah meter)', () => {
    const buf = new ArrayBuffer(16);
    const v = new DataView(buf);
    v.setUint16(0, 12345, true); v.setUint16(2, 20000, true); v.setUint8(4, 24); v.setUint8(5, 18); v.setUint8(6, 9); v.setUint8(7, 4);
    v.setUint16(8, 1, true); v.setUint16(10, 2, true); v.setUint8(12, 255); v.setUint8(13, 1); v.setUint8(14, 200); v.setUint8(15, 0);
    const list = parseBuildings(buf);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({ x: 1234.5, z: 2000, w: 12, d: 9, h: 4.5, cls: 4 });
    expect(list[1].w).toBe(127.5);
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
