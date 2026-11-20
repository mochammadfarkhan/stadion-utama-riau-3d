import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BAKED, NEW, BAKED_WALL_SHADE, buildTileRemap, hexToLinear, remapTileColors, toBytes } from '../../src/city/tilePalette.js';
import { BUILDING_COLORS, LANDUSE_COLORS, ROAD_CLASSES } from '../../tools/citybake/config.js';
import { hexToLinear as bakeHexToLinear, shade } from '../../tools/citybake/geometry/colors.js';

describe('tilePalette (remap warna tile di klien)', () => {
  it('salinan palet bake sama persis dengan config bake (kalau bake berubah, palet ini wajib ikut)', () => {
    expect(BAKED.walls).toEqual(BUILDING_COLORS.walls);
    expect(BAKED.roofFlat).toEqual(BUILDING_COLORS.roofFlat);
    expect(BAKED.roofGable).toEqual(BUILDING_COLORS.roofGable);
    for (const [k, v] of Object.entries(BAKED.landuse)) expect(v).toBe(LANDUSE_COLORS[k]);
    for (const [k, v] of Object.entries(BAKED.roads)) expect(v).toBe(ROAD_CLASSES[k].color);
    expect(Object.keys(NEW.landuse).sort()).toEqual(Object.keys(BAKED.landuse).sort());
    expect(Object.keys(NEW.roads).sort()).toEqual(Object.keys(BAKED.roads).sort());
    expect(NEW.walls).toHaveLength(BAKED.walls.length);
    expect(NEW.roofFlat).toHaveLength(BAKED.roofFlat.length);
    expect(NEW.roofGable).toHaveLength(BAKED.roofGable.length);
  });

  it('konversi warna & kaki dinding sama dengan bake (byte kuantisasi)', () => {
    for (const h of BAKED.walls) {
      expect(toBytes(hexToLinear(h))).toEqual(toBytes(bakeHexToLinear(h)));
      expect(toBytes(hexToLinear(h), BAKED_WALL_SHADE)).toEqual(toBytes(shade(bakeHexToLinear(h), BAKED_WALL_SHADE)));
    }
  });

  it('tabel: 16 kunci dinding (atas + kaki), 8 atap, landuse; tanpa tabrakan kunci', () => {
    const t = buildTileRemap();
    expect(t.get('buildings_walls').size).toBe(16);
    expect(t.get('buildings_roofs').size).toBe(8);
    expect(t.get('landuse').size).toBe(Object.keys(BAKED.landuse).length);
    expect(t.get('roads').size).toBe(Object.keys(BAKED.roads).length);
  });

  it('remap atribut byte (GLB ternormalisasi) dan float; warna tak dikenal tidak disentuh', () => {
    const t = buildTileRemap().get('buildings_roofs');
    const oldB = toBytes(hexToLinear(BAKED.roofFlat[0]));
    const newB = toBytes(hexToLinear(NEW.roofFlat[0]));
    const g = new THREE.BufferGeometry();
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array([...oldB, 1, 2, 3]), 3, true));
    expect(remapTileColors(g, t)).toBe(1);
    expect([...g.attributes.color.array]).toEqual([...newB, 1, 2, 3]);
    const f = new THREE.BufferGeometry();
    f.setAttribute('color', new THREE.BufferAttribute(new Float32Array(oldB.map((b) => b / 255)), 3));
    expect(remapTileColors(f, t)).toBe(1);
    expect([...f.attributes.color.array].map((v) => Math.round(v * 255))).toEqual(newB);
    expect(remapTileColors(new THREE.BufferGeometry(), t)).toBe(0);
  });

  it('atribut berselang stride 4 (seperti COLOR_0 GLB ber-padding): semua vertex dipetakan, byte padding utuh', () => {
    const t = buildTileRemap().get('buildings_roofs');
    const oldB = toBytes(hexToLinear(BAKED.roofFlat[1]));
    const newB = toBytes(hexToLinear(NEW.roofFlat[1]));
    const raw = new Uint8Array([...oldB, 9, ...oldB, 9, ...oldB, 9]); // 3 vertex, stride 4, byte ke-4 = padding
    const g = new THREE.BufferGeometry();
    g.setAttribute('color', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(raw, 4), 3, 0, true));
    expect(remapTileColors(g, t)).toBe(3);
    expect([...raw]).toEqual([...newB, 9, ...newB, 9, ...newB, 9]);
  });
});
