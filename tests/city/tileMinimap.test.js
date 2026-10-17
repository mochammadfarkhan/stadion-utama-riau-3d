import { describe, it, expect } from 'vitest';
import { drawTileLayer, createTileMinimapCache, TILE_MINIMAP_STYLE } from '../../src/city/tileMinimap.js';
import { worldRectToView } from '../../src/shared/minimapMath.js';

/** Konteks 2D palsu yang mencatat panggilan. */
function fakeCtx() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...args) => calls.push([k, ...args])),
    set: (t, k, v) => { calls.push([`=${String(k)}`, v]); return true; },
  });
  return { ctx, calls };
}
const tile = {
  ix: 0, iz: -1,
  water: [{ outer: [[0, -500], [100, -500], [100, -400]], holes: [] }],
  waterways: [],
  roads: [{ cls: 'primary', width: 14, pts: [[0, -250], [500, -250]] }, { cls: 'footway', width: 2, pts: [[0, -100], [10, -100]] }],
  buildings: [{ height: 6, ring: [[250, -250], [260, -250], [260, -240]] }],
};

describe('tileMinimap', () => {
  it('drawTileLayer: latar daratan, air (evenodd), jalan minor lalu mayor, bangunan; koordinat tile → piksel', () => {
    const { ctx, calls } = fakeCtx();
    drawTileLayer(ctx, tile, { px: 256, tileSize: 500 });
    expect(calls[0]).toEqual(['=fillStyle', TILE_MINIMAP_STYLE.land]);
    expect(calls[1]).toEqual(['fillRect', 0, 0, 256, 256]);
    expect(calls).toContainEqual(['fill', 'evenodd']);
    const moveTos = calls.filter((c) => c[0] === 'moveTo');
    expect(moveTos[0]).toEqual(['moveTo', 0, 0]); // (0, −500) = sudut barat laut tile 0_-1
    const styles = calls.filter((c) => c[0] === '=strokeStyle').map((c) => c[1]);
    expect(styles.indexOf(TILE_MINIMAP_STYLE.roadMinor)).toBeLessThan(styles.indexOf(TILE_MINIMAP_STYLE.roadMajor));
    const widths = calls.filter((c) => c[0] === '=lineWidth').map((c) => c[1]);
    expect(widths).toContain(14 * 256 / 500);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(0.8);
  });

  it('cache: add/drop, tilesInView hanya tile yang beririsan jendela', () => {
    const created = [];
    const cache = createTileMinimapCache({ createCanvas: (w, h) => { const c = { width: w, height: h, getContext: () => fakeCtx().ctx }; created.push(c); return c; } });
    cache.add('0_-1', tile);
    cache.add('5_5', { ...tile, ix: 5, iz: 5 });
    expect(cache.size).toBe(2);
    const view = cache.tilesInView({ x: 250, z: -250 }, 160);
    expect(view).toHaveLength(1);
    expect(view[0].bounds).toEqual({ minX: 0, minZ: -500, maxX: 500, maxZ: 0 });
    cache.drop('0_-1');
    expect(cache.tilesInView({ x: 250, z: -250 }, 160)).toEqual([]);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('drop/clear melepas canvas tile (width = 0) sebelum dibuang', () => {
    const created = [];
    const cache = createTileMinimapCache({ createCanvas: (w, h) => { const c = { width: w, height: h, getContext: () => fakeCtx().ctx }; created.push(c); return c; } });
    cache.add('0_-1', tile);
    cache.add('5_5', { ...tile, ix: 5, iz: 5 });
    cache.add('6_6', { ...tile, ix: 6, iz: 6 });
    cache.drop('0_-1');
    expect(created[0].width).toBe(0);
    expect(created[1].width).toBe(256);
    cache.drop('tidak-ada'); // aman tanpa entri
    cache.clear();
    expect(created.map((c) => c.width)).toEqual([0, 0, 0]);
  });

  it('add ulang key yang sama melepas canvas lama', () => {
    const created = [];
    const cache = createTileMinimapCache({ createCanvas: (w, h) => { const c = { width: w, height: h, getContext: () => fakeCtx().ctx }; created.push(c); return c; } });
    cache.add('0_-1', tile);
    cache.add('0_-1', tile);
    expect(cache.size).toBe(1);
    expect(created.map((c) => c.width)).toEqual([0, 256]);
  });

  it('worldRectToView: persegi tile relatif fokus, skala tampilan', () => {
    const r = worldRectToView({ minX: 0, minZ: -500, maxX: 500, maxZ: 0 }, { x: 250, z: -250 }, 250, 200);
    expect(r).toEqual({ x: 0, y: 0, w: 200, h: 200 });
    expect(worldRectToView({ minX: 0, minZ: -500, maxX: 500, maxZ: 0 }, { x: 0, z: -250 }, 250, 200)).toEqual({ x: 100, y: 0, w: 200, h: 200 });
  });
});
