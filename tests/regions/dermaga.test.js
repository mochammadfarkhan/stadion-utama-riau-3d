import { describe, expect, it } from 'vitest';
import { dermaga, distanceToDermaga } from '../../src/regions/unri-rektorat/dermaga.js';
import { LAYOUT } from '../../src/regions/unri-rektorat/layout.js';
import { DANAU_RING, TITIAN } from '../../src/regions/unri-rektorat/site.data.js';
import { pointInPolygon } from '../../src/geo/polygon.js';

const make = () => dermaga({ ...LAYOUT.dermaga, deckY: 1, bedY: -1 });

describe('dermaga', () => {
  it('6-10 papan geladak, tiang sampai dasar, tali; hanya tiga jenis kotak (<= 3 draw call)', () => {
    const d = make();
    const deck = d.boxes.filter((b) => b.kind === 'papan' && b.sy < 0.09 && b.sx > 1);
    expect(deck.length).toBeGreaterThanOrEqual(6);
    expect(deck.length).toBeLessThanOrEqual(10);
    expect(new Set(d.boxes.map((b) => b.kind))).toEqual(new Set(['papan', 'tiang', 'tali']));
    for (const t of d.boxes.filter((b) => b.kind === 'tiang')) expect(t.y - t.sy / 2).toBeLessThanOrEqual(0.2); // sampai dasar
    for (const b of d.boxes) for (const v of [b.x, b.y, b.z, b.sx, b.sy, b.sz]) expect(Number.isFinite(v)).toBe(true);
  });

  it('jumlah papan dijepit ke 6..10', () => {
    const n = (papan) => dermaga({ ...LAYOUT.dermaga, papan, deckY: 1, bedY: -1 }).boxes.filter((b) => b.kind === 'papan' && b.sy < 0.09 && b.sx > 1).length;
    expect(n(2)).toBe(6);
    expect(n(99)).toBe(10);
  });

  it('semua kotak berada di dalam koridor dermaga (tak keluar jalur)', () => {
    const d = make();
    const { start, dir } = LAYOUT.dermaga;
    for (const b of d.boxes) expect(distanceToDermaga(b.x, b.z, start, dir, d.corridor)).toBeLessThan(0.3);
  });

  it('ujung dermaga di atas air (dalam ring danau), tidak menabrak titian, batu pijakan, N01', () => {
    const d = make();
    const { start, dir } = LAYOUT.dermaga;
    expect(pointInPolygon(d.end[0], d.end[1], DANAU_RING)).toBe(true);
    const near = (x, z) => distanceToDermaga(x, z, start, dir, d.corridor);
    for (const [x, z] of TITIAN) expect(near(x, z)).toBeGreaterThan(5);
    for (const s of LAYOUT.batuPijakan) expect(near(s.x, s.z)).toBeGreaterThan(3);
    expect(near(LAYOUT.papanBatu.x, LAYOUT.papanBatu.z)).toBeGreaterThan(3);
    for (const p of LAYOUT.palem) expect(near(p.x, p.z)).toBeGreaterThan(1.5);
    for (const p of LAYOUT.pju) expect(near(p.x, p.z)).toBeGreaterThan(1.5);
  });
});
