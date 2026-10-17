/**
 * Layer minimap tile kota: data vektor tile (air, jalan, bangunan) digambar SEKALI per tile ke canvas
 * kecil (cache per tile), lalu Minimap2D hanya `drawImage` tile yang tampak. Utara = atas (+x kanan,
 * +z bawah), sama dengan peta dasar region.
 */
import { tileBounds, TILE_SIZE } from '../geo/tiles.js';

export const TILE_MINIMAP_PX = 256; // ±2 m/piksel untuk tile 500 m
export const TILE_MINIMAP_STYLE = Object.freeze({
  land: '#c9c2b0',
  water: '#4f86a6',
  waterway: '#4f86a6',
  roadMajor: '#f4f1ea',
  roadMinor: '#e2ddd2',
  building: '#a89f92',
  buildingEdge: '#8c8377',
});
const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
const MIN_LINE_PX = 0.8;

/**
 * Gambar satu tile terdekode (koordinat dunia) ke ctx2d ukuran px × px yang mewakili persegi tile.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ix:number, iz:number, water:object[], waterways:object[], roads:object[], buildings:object[]}} tile
 */
export function drawTileLayer(ctx, tile, { px = TILE_MINIMAP_PX, tileSize = TILE_SIZE, style = TILE_MINIMAP_STYLE } = {}) {
  const b = tileBounds(tile.ix, tile.iz, tileSize);
  const k = px / tileSize;
  const tx = (x) => (x - b.minX) * k;
  const tz = (z) => (z - b.minZ) * k;
  const path = (pts, close) => {
    ctx.beginPath();
    pts.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(tx(x), tz(z)) : ctx.lineTo(tx(x), tz(z))));
    if (close) ctx.closePath();
  };
  ctx.fillStyle = style.land;
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = style.water;
  for (const w of tile.water) {
    path(w.outer, true);
    for (const h of w.holes) {
      h.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(tx(x), tz(z)) : ctx.lineTo(tx(x), tz(z))));
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const stroke = (lines, color) => {
    ctx.strokeStyle = color;
    for (const l of lines) {
      ctx.lineWidth = Math.max(MIN_LINE_PX, l.width * k);
      path(l.pts, false);
      ctx.stroke();
    }
  };
  stroke(tile.waterways, style.waterway);
  stroke(tile.roads.filter((r) => !MAJOR.has(r.cls)), style.roadMinor);
  stroke(tile.roads.filter((r) => MAJOR.has(r.cls)), style.roadMajor);
  ctx.fillStyle = style.building;
  ctx.strokeStyle = style.buildingEdge;
  ctx.lineWidth = MIN_LINE_PX;
  for (const bd of tile.buildings) {
    path(bd.ring, true);
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * Cache canvas per tile untuk Minimap2D.
 * @param {{createCanvas?: (w:number, h:number) => {width:number, height:number, getContext(t:string): object},
 *   px?: number, tileSize?: number}} [opts]
 */
export function createTileMinimapCache({ createCanvas = defaultCanvas, px = TILE_MINIMAP_PX, tileSize = TILE_SIZE } = {}) {
  const tiles = new Map(); // key → {canvas, bounds}
  return {
    add(key, tile) {
      const canvas = createCanvas(px, px);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawTileLayer(ctx, tile, { px, tileSize });
      release(tiles.get(key));
      tiles.set(key, { canvas, bounds: tileBounds(tile.ix, tile.iz, tileSize) });
    },
    drop(key) {
      release(tiles.get(key));
      tiles.delete(key);
    },
    clear() {
      for (const t of tiles.values()) release(t);
      tiles.clear();
    },
    get size() { return tiles.size; },
    /** Tile yang beririsan dengan jendela ±halfExtent di sekitar fokus. */
    tilesInView(focus, halfExtent) {
      const out = [];
      for (const t of tiles.values()) {
        const b = t.bounds;
        if (b.maxX < focus.x - halfExtent || b.minX > focus.x + halfExtent) continue;
        if (b.maxZ < focus.z - halfExtent || b.minZ > focus.z + halfExtent) continue;
        out.push(t);
      }
      return out;
    },
  };
}

/** Kosongkan backing store canvas (width/height = 0) agar memorinya lepas tanpa menunggu GC. */
function release(entry) {
  if (!entry) return;
  entry.canvas.width = 0;
  entry.canvas.height = 0;
}

function defaultCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
