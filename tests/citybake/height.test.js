import { describe, it, expect } from 'vitest';
import {
  estimateHeight, explainHeight, parseHeight, parseLevels, HEURISTIC_RULES, MIN_HEIGHT, MAX_HEIGHT,
} from '../../tools/citybake/height.js';
import { hashString, mulberry32, seededUnit, pickBySeed } from '../../tools/citybake/random.js';
import { createRoadLocator } from '../../tools/citybake/roadLocator.js';

const sq = (s) => [[0, 0], [s, 0], [s, s], [0, s]];
const bld = (id, tags = {}, area = 100) => ({ id, cls: tags.building ?? 'yes', tags: { building: 'yes', ...tags }, rings: [sq(Math.sqrt(area))] });
const ids = (n) => Array.from({ length: n }, (_, i) => `osm:way/${i + 1}`);

describe('random', () => {
  it('hashString & mulberry32 deterministik', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const u = seededUnit('x', 's');
    expect(u).toBeGreaterThanOrEqual(0);
    expect(u).toBeLessThan(1);
    expect(['p', 'q', 'r']).toContain(pickBySeed(['p', 'q', 'r'], 'id'));
  });
});

describe('parseHeight / parseLevels', () => {
  it('format umum', () => {
    expect(parseHeight('12')).toBe(12);
    expect(parseHeight('12 m')).toBe(12);
    expect(parseHeight('12,5')).toBe(12.5);
    expect(parseHeight("40'")).toBeNull();
    expect(parseHeight('tinggi')).toBeNull();
    expect(parseLevels('3')).toBe(3);
    expect(parseLevels('2;4')).toBe(4);
    expect(parseLevels('x')).toBeNull();
  });
});

describe('estimateHeight — kontrak (WAJIB dipertahankan saat aturan diubah)', () => {
  it('tag height menang atas building:levels', () => {
    expect(explainHeight(bld('a', { height: '12 m', 'building:levels': '10' }))).toEqual({ height: 12, source: 'height', rule: null });
  });

  it('building:levels × 3,2 m', () => {
    expect(explainHeight(bld('a', { 'building:levels': '3' }))).toEqual({ height: 9.6, source: 'levels', rule: null });
  });

  it('dibatasi [2,5; 300] m', () => {
    expect(estimateHeight(bld('a', { height: '0.5' }))).toBe(MIN_HEIGHT);
    expect(estimateHeight(bld('a', { height: '1000' }))).toBe(MAX_HEIGHT);
  });

  it('heuristik deterministik untuk id yang sama', () => {
    for (const id of ids(20)) expect(estimateHeight(bld(id, {}, 180))).toBe(estimateHeight(bld(id, {}, 180)));
  });

  it('semua hasil heuristik dalam batas & kelipatan 0,1 m', () => {
    for (const cls of ['yes', 'house', 'retail', 'industrial', 'apartments', 'mosque', 'roof', 'school']) {
      for (const area of [30, 120, 400, 1500, 5000]) {
        const h = estimateHeight(bld(`osm:way/${cls}${area}`, { building: cls }, area));
        expect(h).toBeGreaterThanOrEqual(MIN_HEIGHT);
        expect(h).toBeLessThanOrEqual(MAX_HEIGHT);
        expect(Math.round(h * 10)).toBeCloseTo(h * 10, 6);
      }
    }
  });

  it('aturan terakhir menangkap semua (fallback)', () => {
    expect(HEURISTIC_RULES[HEURISTIC_RULES.length - 1].match({})).toBe(true);
  });
});

describe('estimateHeight — baseline heuristik', () => {
  it('rumah kecil (< 150 m²) = 1 lantai', () => {
    expect(explainHeight(bld('h', { building: 'house' }, 48))).toEqual({ height: 3.2, source: 'heuristic', rule: 'rumah' });
  });

  it('building=yes kecil 1 lantai; besar (> 1000 m²) 7–9 m', () => {
    expect(estimateHeight(bld('y', {}, 60))).toBe(3.2);
    for (const id of ids(30)) {
      const h = estimateHeight(bld(id, {}, 2000));
      expect(h).toBeGreaterThanOrEqual(7);
      expect(h).toBeLessThanOrEqual(9);
    }
  });

  it('building=yes 80–250 m² bervariasi 1–2 lantai', () => {
    const hs = new Set(ids(60).map((id) => estimateHeight(bld(id, {}, 150))));
    expect([...hs].sort()).toEqual([3.2, 6.4]);
  });

  it('ruko/komersial: 3–4 lantai di arteri, 2–3 lantai di jalan biasa', () => {
    for (const id of ids(30)) {
      const arteri = estimateHeight(bld(id, { building: 'retail' }, 120), { nearestRoadClass: 'primary' });
      const biasa = estimateHeight(bld(id, { building: 'retail' }, 120), { nearestRoadClass: 'residential' });
      expect([9.6, 12.8]).toContain(arteri);
      expect([6.4, 9.6]).toContain(biasa);
    }
  });

  it('industri besar 8–10 m; apartemen 800 m² 6–10 lantai', () => {
    for (const id of ids(20)) {
      const ind = estimateHeight(bld(id, { building: 'industrial' }, 1500));
      expect(ind).toBeGreaterThanOrEqual(8);
      expect(ind).toBeLessThanOrEqual(10);
      const apt = estimateHeight(bld(id, { building: 'apartments' }, 800));
      expect(apt).toBeGreaterThanOrEqual(6 * 3.2 - 1e-9);
      expect(apt).toBeLessThanOrEqual(10 * 3.2 + 1e-9);
    }
  });

  it('subtype Overture dipakai bila class kosong', () => {
    const f = { id: 'overture:x', cls: 'yes', tags: { building: 'yes', 'overture:subtype': 'industrial' }, rings: [sq(40)] };
    expect(explainHeight(f).rule).toBe('industri/gudang');
  });
});

describe('createRoadLocator', () => {
  const locate = createRoadLocator([
    { cls: 'primary', line: [[0, 0], [200, 0]] },
    { cls: 'residential', line: [[0, 30], [200, 30]] },
  ]);
  it('kelas jalan terdekat dalam maxDist', () => {
    expect(locate(50, 5)).toBe('primary');
    expect(locate(50, 25)).toBe('residential');
    expect(locate(50, 200)).toBeNull();
    expect(locate(250, 0, 60)).toBe('primary');
  });
});
