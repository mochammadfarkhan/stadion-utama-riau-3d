import { describe, it, expect } from 'vitest';
import { splitPolylineByRing, insideWithOverlap, slicePolyline, polylineLength } from '../../src/geo/lineClip.js';

const SQ = [[-50, -50], [50, -50], [50, 50], [-50, 50]];
const close = (a, b) => {
  expect(a).toHaveLength(b.length);
  a.forEach((p, i) => {
    expect(p[0]).toBeCloseTo(b[i][0], 9);
    expect(p[1]).toBeCloseTo(b[i][1], 9);
  });
};

describe('splitPolylineByRing', () => {
  it('garis menembus: titik potong tepat di tepi ring', () => {
    const { inside, outside } = splitPolylineByRing([[-100, 0], [100, 0]], SQ);
    expect(inside).toHaveLength(1);
    close(inside[0], [[-50, 0], [50, 0]]);
    expect(outside).toHaveLength(2);
    close(outside[0], [[-100, 0], [-50, 0]]);
    close(outside[1], [[50, 0], [100, 0]]);
  });

  it('belokan di dalam ring mempertahankan simpul', () => {
    const { inside } = splitPolylineByRing([[-100, 0], [0, 0], [0, 100]], SQ);
    close(inside[0], [[-50, 0], [0, 0], [0, 50]]);
  });

  it('seluruhnya di dalam / di luar', () => {
    expect(splitPolylineByRing([[-10, 0], [10, 0]], SQ).outside).toEqual([]);
    const out = splitPolylineByRing([[-100, 80], [100, 80]], SQ);
    expect(out.inside).toEqual([]);
    close(out.outside[0], [[-100, 80], [100, 80]]);
  });

  it('panjang potongan dalam + luar = panjang asli', () => {
    const line = [[-120, -30], [-20, 10], [30, 90], [70, -70]];
    const { inside, outside } = splitPolylineByRing(line, SQ);
    const sum = [...inside, ...outside].reduce((s, l) => s + polylineLength(l), 0);
    expect(sum).toBeCloseTo(polylineLength(line), 9);
  });
});

describe('insideWithOverlap', () => {
  it('ujung yang memotong tepi diperpanjang menyusuri polyline asli', () => {
    const parts = insideWithOverlap([[-100, 0], [100, 0]], SQ, 5);
    expect(parts).toHaveLength(1);
    close(parts[0], [[-55, 0], [55, 0]]);
  });

  it('perpanjangan berhenti di ujung polyline asli', () => {
    close(insideWithOverlap([[-52, 0], [0, 0]], SQ, 5)[0], [[-52, 0], [0, 0]]);
  });

  it('dua potongan dalam yang berdekatan digabung bila perpanjangannya bertumpuk', () => {
    const notch = [[-50, -50], [50, -50], [50, 50], [2, 50], [2, -10], [-2, -10], [-2, 50], [-50, 50]];
    expect(splitPolylineByRing([[-100, 0], [100, 0]], notch).inside).toHaveLength(2);
    const parts = insideWithOverlap([[-100, 0], [100, 0]], notch, 5);
    expect(parts).toHaveLength(1);
    close(parts[0], [[-55, 0], [55, 0]]);
  });

  it('tanpa bagian dalam → []', () => {
    expect(insideWithOverlap([[-100, 80], [100, 80]], SQ, 5)).toEqual([]);
  });
});

describe('slicePolyline', () => {
  it('potong menurut jarak; simpul asli di antaranya dipertahankan', () => {
    close(slicePolyline([[0, 0], [10, 0], [10, 10]], 5, 15), [[5, 0], [10, 0], [10, 5]]);
    expect(slicePolyline([[0, 0], [10, 0]], 4, 4)).toEqual([]);
  });
});
