import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parkingAreas, IC_CENTER, normalizeGeometry } from '../src/districts/unri/motorParking.js';

/** Parkir OSM way/938379748 (±138 m dari Integrated Classroom) dan persegi di area FISIP (way/938379744). */
const IC_PARK = [[-1006.7, 984.2], [-931.6, 984.4], [-931.5, 950.0], [-1006.6, 949.8]];
const FISIP_PARK = [[-1230, 1100], [-1195, 1100], [-1195, 1126], [-1230, 1126]];

describe('parkingAreas', () => {
  const ground = {
    areas: [
      { kind: 'parking', rings: [IC_PARK] },
      { kind: 'parking', rings: [FISIP_PARK] },
      { kind: 'plaza', rings: [IC_PARK] },
      { kind: 'parking', rings: [[[0, 0], [1, 0]]] },
    ],
  };
  it('hanya parking dengan ring valid; IC bila centroid ≤ 160 m dari Integrated Classroom', () => {
    const areas = parkingAreas(ground);
    expect(areas.map((a) => a.kind)).toEqual(['ic', 'kampus']);
    expect(Math.hypot(areas[0].center.x - IC_CENTER.x, areas[0].center.z - IC_CENTER.z)).toBeLessThan(160);
  });
  it('kunci dedupe sama untuk ring yang sama dari chunk berbeda', () => {
    expect(parkingAreas(ground)[0].key).toBe(parkingAreas({ areas: [{ kind: 'parking', rings: [IC_PARK] }] })[0].key);
    expect(parkingAreas(null)).toEqual([]);
  });
});

describe('normalizeGeometry', () => {
  it('position + normal berindeks, transform dibakar, atribut lain dibuang', () => {
    const src = new THREE.BoxGeometry(1, 1, 1);
    const g = normalizeGeometry(src, new THREE.Matrix4().makeTranslation(0, 2, 0));
    expect(Object.keys(g.attributes).sort()).toEqual(['normal', 'position']);
    expect(g.index.count).toBe(src.index.count);
    g.computeBoundingBox();
    expect(g.boundingBox.min.y).toBeCloseTo(1.5, 6);
    const flat = normalizeGeometry(src.toNonIndexed());
    expect(flat.index.count).toBe(flat.getAttribute('position').count);
  });
});
