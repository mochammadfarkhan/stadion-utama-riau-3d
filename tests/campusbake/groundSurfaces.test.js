import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { extractGround } from '../../tools/campusbake/ground/extract.js';
import { applyWaterLevels } from '../../tools/campusbake/ground/waterLevel.js';
import { createGroundContext } from '../../tools/campusbake/ground/context.js';
import { inferredDitches } from '../../tools/campusbake/ground/ditches.js';
import { createLineIndex } from '../../tools/campusbake/ground/spatial.js';
import { encodeWeights, surfaceWeights, toBytes } from '../../tools/campusbake/ground/surfaces.js';
import { BOUNDARY, FEATURES, FIELD, PLAZAS } from './groundFixture.js';

const { E } = applyWaterLevels(extractGround({ features: FEATURES, plazas: PLAZAS }, BOUNDARY), FIELD);
const ctx = createGroundContext(E, { boundary: BOUNDARY, field: FIELD });
const ditchIndex = createLineIndex([...inferredDitches(E.roads, ctx), ...E.waterLines], { reach: 3 });
const W = surfaceWeights('0_0', ctx, ditchIndex);
/** [grass, soil, wet] sampel di titik dunia (x, z) kelipatan 4 m. */
const at = (x, z) => {
  const k = (z / 4) * W.n + x / 4;
  return [W.grass[k], W.soil[k], W.wet[k]];
};

describe('toBytes', () => {
  it('jumlah 255; semua nol tetap nol (di luar distrik)', () => {
    expect(toBytes({ g: 0.65, s: 0.35, w: 0 })).toEqual([166, 89, 0]);
    expect(toBytes({ g: 0, s: 0, w: 0 })).toEqual([0, 0, 0]);
    expect(toBytes({ g: 0, s: 0.5, w: 0.5 })).toEqual([0, 128, 127]);
  });
});

describe('surfaceWeights (fixture, chunk 0_0)', () => {
  it('ukuran grid n = 126', () => {
    expect(W.n).toBe(126);
    expect(W.grass).toHaveLength(126 * 126);
  });

  it('hutan: rumput 0,65 + serasah tanah 0,35', () => expect(at(340, 60)).toEqual([166, 89, 0]));
  it('di dalam kolam: basah penuh', () => expect(at(60, 60)).toEqual([0, 0, 255]));
  it('tepi kolam 4 m: basah 1 − 4/6', () => expect(at(84, 60)).toEqual([170, 0, 85]));
  it('jalan tanah (path): tanah penuh', () => expect(at(340, 300)).toEqual([0, 255, 0]));
  it('parit tepi jalan (z 208): basah 0,8', () => expect(at(60, 208)).toEqual([51, 0, 204]));
  it('rumput biasa', () => expect(at(200, 380)).toEqual([255, 0, 0]));
  it('di luar distrik: nol', () => expect(at(452, 200)).toEqual([0, 0, 0]));

  it('encodeWeights: base64 bolak-balik', () => {
    const enc = encodeWeights(W);
    expect(enc.n).toBe(126);
    expect(new Uint8Array(Buffer.from(enc.soil, 'base64'))).toEqual(W.soil);
  });
});
