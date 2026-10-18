import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { decodeChunk, createHeightField } from '../../src/geo/terrain/heightfield.js';
import { validateDistrictManifest } from '../../src/districts/unri/index.js';
import { stadionMaskWorld } from '../../src/regions/stadion/mask.js';
import { distanceToRing, pointInPolygon } from '../../src/geo/polygon.js';
import { UNRI_BOUNDARY } from '../../src/districts/unri/boundary.js';

/** Data terrain HASIL BAKE yang di-commit (public/districts/unri): paritas stadion & batas wajar. */
const DIR = new URL('../../public/districts/unri/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', DIR), 'utf8'));
const header = validateDistrictManifest(manifest);
const field = createHeightField();
let bytes = 0;
for (const key of header.chunks) {
  const b = readFileSync(new URL(`terrain/${key}.bin`, DIR));
  bytes += b.byteLength;
  field.add(decodeChunk(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), { ...header, key }));
}

describe('data terrain UNRI (bake nyata)', () => {
  it('manifest valid; 15–40 chunk; ≤ 3 MB; berkas = n²·2 byte', () => {
    expect(header.chunks.length).toBeGreaterThanOrEqual(15);
    expect(header.chunks.length).toBeLessThanOrEqual(40);
    expect(bytes).toBe(header.chunks.length * 126 * 126 * 2);
    expect(bytes).toBeLessThanOrEqual(3 * 1024 * 1024);
    expect(statSync(new URL('ATTRIBUTION.txt', DIR)).size).toBeGreaterThan(100);
  });

  it('PARITAS STADION: heightAt = 0 tepat di mask stadion + 60 m (grid 4 m)', () => {
    const mask = stadionMaskWorld();
    let n = 0;
    for (let x = -330; x <= 330; x += 4) {
      for (let z = -510; z <= 400; z += 4) {
        if (!pointInPolygon(x, z, mask) && distanceToRing(x, z, mask) > 60) continue;
        expect(field.heightAt(x, z)).toBe(0);
        n += 1;
      }
    }
    expect(n).toBeGreaterThan(20000);
  });

  it('0 tepat di luar batas distrik; relief di dalam wajar (−12…+15 m)', () => {
    let inside = 0;
    for (let x = -1700; x <= 500; x += 20) {
      for (let z = -500; z <= 2200; z += 20) {
        const y = field.heightAt(x, z);
        if (!pointInPolygon(x, z, UNRI_BOUNDARY)) {
          expect(y).toBe(0);
        } else {
          expect(y).toBeGreaterThan(-12);
          expect(y).toBeLessThan(15);
          inside += 1;
        }
      }
    }
    expect(inside).toBeGreaterThan(5000);
  });

  it('muka air Danau Buatan & Waduk tercatat (untuk mesh air M2)', () => {
    expect(header.water.map((w) => w.id).sort()).toEqual(['w327366050', 'w373856980']);
    for (const w of header.water) expect(w.bed).toBeLessThan(w.level);
  });
});
