import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ATLAS_SIZE, CELL, INSET, VARIANTS, blenderRect, imageRect, leafTone, pickVariant, scatterLeaves, variantSvg,
} from '../tools/texbake/leafAtlasCore.mjs';

describe('atlas daun: tata letak dan UV', () => {
  it('4 varian di sel 2x2 tanpa tumpang tindih, UV di dalam 0..1', () => {
    const rects = VARIANTS.map(imageRect);
    for (const r of rects) {
      expect(r.u0).toBeGreaterThanOrEqual(0);
      expect(r.u1).toBeLessThanOrEqual(1);
      expect(r.u1 - r.u0).toBeCloseTo(0.5 - (2 * INSET) / ATLAS_SIZE, 6);
    }
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.u0 < b.u1 && b.u0 < a.u1 && a.v0 < b.v1 && b.v0 < a.v1;
        expect(overlap).toBe(false);
      }
    }
  });

  it('ruang Blender membalik v (v = 1 - v_gambar)', () => {
    const v = pickVariant('semak'); // baris bawah gambar -> v Blender rendah
    const img = imageRect(v);
    const bl = blenderRect(v);
    expect(bl.v0).toBeCloseTo(1 - img.v1, 9);
    expect(bl.v1).toBeCloseTo(1 - img.v0, 9);
    expect(bl.v1).toBeLessThan(0.5);
  });

  it('pickVariant: id, indeks melingkar, dan galat untuk id asing', () => {
    expect(pickVariant('akasia').id).toBe('akasia');
    expect(pickVariant(4).id).toBe(VARIANTS[0].id);
    expect(pickVariant(-1).id).toBe(VARIANTS[3].id);
    expect(() => pickVariant('palem')).toThrow();
  });
});

describe('atlas daun: sebar daun', () => {
  it('deterministik, terurut gelap->terang, dan semua daun muat dalam sel', () => {
    for (const v of VARIANTS) {
      const a = scatterLeaves(v);
      expect(scatterLeaves(v)).toEqual(a);
      expect(a.length).toBeGreaterThan(20);
      for (let i = 1; i < a.length; i += 1) expect(a[i].t).toBeGreaterThanOrEqual(a[i - 1].t);
      for (const lf of a) {
        expect(lf.t).toBeGreaterThanOrEqual(0);
        expect(lf.t).toBeLessThanOrEqual(1);
        const rad = (lf.rot * Math.PI) / 180;
        const tx = lf.x + Math.sin(rad) * lf.len;
        const ty = lf.y - Math.cos(rad) * lf.len;
        for (const p of [lf.x, lf.y, tx, ty]) {
          expect(p).toBeGreaterThan(INSET);
          expect(p).toBeLessThan(CELL - INSET);
        }
      }
    }
  });

  it('seed berbeda memberi tata letak berbeda; SVG berisi satu <path> per daun dan gradien nada', () => {
    const v = pickVariant('rimbun');
    expect(scatterLeaves(v, 1)).not.toEqual(scatterLeaves(v, 2));
    const svg = variantSvg(v);
    expect((svg.match(/<path d="M0,0 C/g) ?? []).length).toBeGreaterThanOrEqual(scatterLeaves(v).length);
    expect(svg).toContain('linearGradient');
    expect(svg).not.toContain('NaN');
  });

  it('leafTone: gelap di t=0, terang di t=1, heksa valid', () => {
    const lo = leafTone(0);
    const hi = leafTone(1);
    expect(lo.base).toBe('#1e3f22');
    expect(hi.base).toBe('#6fa03f');
    for (const c of [lo.tip, hi.tip]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('manifest atlas', () => {
  it('entri daun cocok dengan tata letak dan ukuran <= 600 KB', () => {
    const m = JSON.parse(readFileSync('public/textures/manifest.json', 'utf8'));
    const e = m.atlases.find((a) => a.name === 'daun');
    expect(e.size).toBe(ATLAS_SIZE);
    expect(e.bytes).toBeLessThanOrEqual(600 * 1024);
    expect(e.variants.map((v) => v.id)).toEqual(VARIANTS.map((v) => v.id));
    expect(e.variants[0].blender).toEqual(blenderRect(VARIANTS[0]));
  });
});
