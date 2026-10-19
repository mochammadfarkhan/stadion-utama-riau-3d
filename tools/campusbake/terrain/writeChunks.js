/**
 * Kuantisasi & potong grid ke chunk "unri-terrain" v1 (Uint16 LE, spec §4.1). Chunk yang semua
 * sampelnya y = 0 tidak ditulis (heightAt = 0 tanpa chunk). Murni (I/O di cli.js).
 */
import { Buffer } from 'node:buffer';
import { BIAS, N, UNIT, ZERO_U16 } from '../../../src/geo/terrain/format.js';
import { tileKey } from '../../../src/geo/tiles.js';

/** Meter → u16 (dibulatkan ke 1 cm, di-clamp ke rentang format). */
export function quantize(y) {
  const u = Math.round(y / UNIT) - BIAS;
  return Math.min(65535, Math.max(0, u));
}

/**
 * Chunk (ix, iz) dari grid selaras chunk.
 * @returns {{key:string, ix:number, iz:number, buffer:Buffer, empty:boolean}}
 */
export function encodeChunk(grid, data, ix, iz) {
  const per = N - 1;
  const c0 = (ix - grid.ix0) * per;
  const r0 = (iz - grid.iz0) * per;
  if (c0 < 0 || r0 < 0 || c0 + per >= grid.cols || r0 + per >= grid.rows) throw new RangeError(`chunk ${ix}_${iz} di luar grid`);
  const buffer = Buffer.alloc(N * N * 2);
  let empty = true;
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      const u = quantize(data[(r0 + r) * grid.cols + c0 + c]);
      if (u !== ZERO_U16) empty = false;
      buffer.writeUInt16LE(u, (r * N + c) * 2);
    }
  }
  return { key: tileKey(ix, iz), ix, iz, buffer, empty };
}

/** Semua chunk tak kosong grid, urut iz lalu ix. */
export function encodeChunks(grid, data) {
  const out = [];
  for (let iz = grid.iz0; iz < grid.iz0 + grid.chunksZ; iz += 1) {
    for (let ix = grid.ix0; ix < grid.ix0 + grid.chunksX; ix += 1) {
      const chunk = encodeChunk(grid, data, ix, iz);
      if (!chunk.empty) out.push(chunk);
    }
  }
  return out;
}
