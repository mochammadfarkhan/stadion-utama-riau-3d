/**
 * Heightfield terrain distrik (spec §4.1): dekode chunk biner, sampel bilinear, dan kumpulan chunk
 * aktif (`createHeightField`). Di luar chunk mana pun tinggi = 0 sehingga stadion & tile kota datar
 * tidak berubah perilakunya. Murni (tanpa three/DOM).
 */
import { tileKey, parseTileKey } from '../tiles.js';
import { CHUNK_SIZE, FORMAT, VERSION } from './format.js';

/** Data chunk rusak/tidak sesuai header: tidak dicoba ulang (chunk dianggap datar, spec §10). */
export class TerrainDataError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'TerrainDataError';
  }
}

const finite = Number.isFinite;

/** Validasi header terrain manifest; mengembalikan salinan beku. @throws {TerrainDataError} */
export function validateTerrainHeader(h) {
  if (!h || typeof h !== 'object') throw new TerrainDataError('header terrain bukan objek');
  if (h.format !== undefined && h.format !== FORMAT) throw new TerrainDataError(`format "${h.format}" bukan ${FORMAT}`);
  if (h.version !== undefined && h.version !== VERSION) throw new TerrainDataError(`versi terrain ${h.version} tidak didukung`);
  const { size, step, n, unit, bias } = h;
  if (size !== CHUNK_SIZE) throw new TerrainDataError(`size ${size} ≠ ${CHUNK_SIZE}`);
  if (!(step > 0) || !Number.isInteger(n) || n !== size / step + 1) throw new TerrainDataError(`n ${n} ≠ size/step + 1`);
  if (!(unit > 0) || !finite(bias)) throw new TerrainDataError('unit/bias tidak valid');
  return Object.freeze({ size, step, n, unit, bias });
}

/**
 * Dekode satu chunk Uint16 LE.
 * @param {ArrayBuffer} arrayBuffer isi `terrain/<key>.bin`
 * @param {{key:string, size:number, step:number, n:number, unit:number, bias:number}} header
 * @returns {{key:string, ix:number, iz:number, origin:{x:number,z:number}, size:number, step:number, n:number,
 *   unit:number, bias:number, data:Uint16Array}}
 * @throws {TerrainDataError}
 */
export function decodeChunk(arrayBuffer, header) {
  const h = validateTerrainHeader(header);
  const id = parseTileKey(header.key);
  if (!id) throw new TerrainDataError(`kunci chunk tidak valid: ${JSON.stringify(header.key)}`);
  if (!(arrayBuffer instanceof ArrayBuffer)) throw new TerrainDataError(`chunk ${header.key}: bukan ArrayBuffer`);
  const expected = h.n * h.n * 2;
  if (arrayBuffer.byteLength !== expected) {
    throw new TerrainDataError(`chunk ${header.key}: ${arrayBuffer.byteLength} byte ≠ ${expected}`);
  }
  const view = new DataView(arrayBuffer);
  const data = new Uint16Array(h.n * h.n);
  for (let i = 0; i < data.length; i += 1) data[i] = view.getUint16(i * 2, true);
  return Object.freeze({
    key: tileKey(id.ix, id.iz), ix: id.ix, iz: id.iz,
    origin: Object.freeze({ x: id.ix * h.size, z: id.iz * h.size }),
    ...h, data,
  });
}

/** Tinggi (m) sampel baris r, kolom c (tanpa pemeriksaan batas). */
export const sampleAt = (chunk, r, c) => (chunk.data[r * chunk.n + c] + chunk.bias) * chunk.unit;

/**
 * Bilinear pada chunk; (x, z) dunia di-clamp ke persegi chunk.
 * @returns {number} meter
 */
export function sampleChunk(chunk, x, z) {
  const last = chunk.n - 1;
  const fx = Math.min(last, Math.max(0, (x - chunk.origin.x) / chunk.step));
  const fz = Math.min(last, Math.max(0, (z - chunk.origin.z) / chunk.step));
  const c0 = Math.min(last - 1, Math.floor(fx));
  const r0 = Math.min(last - 1, Math.floor(fz));
  const tx = fx - c0;
  const tz = fz - r0;
  const a = sampleAt(chunk, r0, c0);
  const b = sampleAt(chunk, r0, c0 + 1);
  const c = sampleAt(chunk, r0 + 1, c0);
  const d = sampleAt(chunk, r0 + 1, c0 + 1);
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

const NORMAL_DELTA = 1; // m (spec: beda hingga 1 m)

/**
 * Kumpulan chunk aktif. heightAt = 0 di luar chunk; version naik tiap add/remove (cache invalidasi).
 * @returns {{add(chunk:object):void, remove(key:string):boolean, has(key:string):boolean, keys():string[],
 *   heightAt(x:number, z:number):number, normalAt(x:number, z:number, out?:object):{x:number,y:number,z:number},
 *   gradeAlong(x:number, z:number, yaw:number):number, readonly version:number, readonly size:number}}
 */
export function createHeightField() {
  const chunks = new Map();
  let version = 0;

  const heightAt = (x, z) => {
    if (!finite(x) || !finite(z)) return 0;
    const chunk = chunks.get(tileKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)));
    return chunk ? sampleChunk(chunk, x, z) : 0;
  };

  return {
    add(chunk) {
      if (!chunk?.data || typeof chunk.key !== 'string') throw new TypeError('HeightField.add: chunk tidak valid');
      chunks.set(chunk.key, chunk);
      version += 1;
    },
    remove(key) {
      const had = chunks.delete(key);
      if (had) version += 1;
      return had;
    },
    has: (key) => chunks.has(key),
    keys: () => [...chunks.keys()],
    heightAt,
    normalAt(x, z, out = { x: 0, y: 1, z: 0 }) {
      const d = NORMAL_DELTA;
      const sx = (heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d);
      const sz = (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d);
      const len = Math.hypot(sx, 1, sz);
      out.x = -sx / len;
      out.y = 1 / len;
      out.z = -sz / len;
      return out;
    },
    gradeAlong(x, z, yaw) {
      if (!finite(yaw)) return 0;
      const d = NORMAL_DELTA;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      return (heightAt(x + fx * d, z + fz * d) - heightAt(x - fx * d, z - fz * d)) / (2 * d);
    },
    get version() { return version; },
    get size() { return chunks.size; },
  };
}
