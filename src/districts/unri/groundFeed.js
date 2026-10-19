/**
 * Umpan data ground distrik untuk kehidupan kampus (keputusan D3): memuat `ground/<key>.json` (kunci dari
 * `manifest.ground.chunks`) di sekitar fokus dan melepasnya saat jauh, terpisah dari mesh tanah M2 sehingga
 * mahasiswa/motor tidak bergantung pada internal ground.js. Berkas yang sama biasanya sudah di cache HTTP.
 * Fetch gagal: diperingatkan sekali per kunci dan tidak diulang (chunk dianggap kosong, spec §10).
 */
import { tilesInRadius } from '../../geo/tiles.js';
import { parseGroundChunk } from './groundData.js';

export const FEED_LOAD_RADIUS = 480;
export const FEED_DROP_RADIUS = 650;

/** fetch JSON dengan galat jelas untuk status HTTP ≥ 400. */
export function defaultFetchJson(url) {
  return fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status} ${url}`))));
}

/**
 * @param {{baseUrl:string, chunkKeys:string[], fetchJson?:(url:string)=>Promise<object>,
 *   parse?:(json:object, key:string)=>object, onAdd:(key:string, data:object)=>void, onRemove:(key:string)=>void,
 *   logger?:{warn:Function}}} opts  `parse` default = parseGroundChunk M2 (meter dunia; galat parse = chunk dilewati)
 */
export function createGroundFeed({ baseUrl, chunkKeys, fetchJson = defaultFetchJson, parse = parseGroundChunk, onAdd, onRemove, logger = console }) {
  const known = new Set(chunkKeys);
  const loaded = new Map();
  const pending = new Set();
  const failed = new Set();
  let disposed = false;

  const load = (key) => {
    pending.add(key);
    fetchJson(`${baseUrl}ground/${key}.json`).then((raw) => parse(raw, key)).then((data) => {
      pending.delete(key);
      if (disposed) return;
      loaded.set(key, data);
      onAdd(key, data);
    }, (err) => {
      pending.delete(key);
      failed.add(key);
      logger.warn(`Kehidupan kampus: ground ${key} gagal dimuat (chunk dilewati):`, err);
    });
  };

  return {
    /** @param {{x:number, z:number}} focus titik dunia */
    update(focus) {
      if (disposed || !focus) return;
      for (const t of tilesInRadius(focus.x, focus.z, FEED_LOAD_RADIUS)) {
        if (known.has(t.key) && !loaded.has(t.key) && !pending.has(t.key) && !failed.has(t.key)) load(t.key);
      }
      const keep = new Set(tilesInRadius(focus.x, focus.z, FEED_DROP_RADIUS).map((t) => t.key));
      for (const key of [...loaded.keys()]) {
        if (keep.has(key)) continue;
        loaded.delete(key);
        onRemove(key);
      }
    },
    get keys() { return [...loaded.keys()]; },
    dispose() {
      disposed = true;
      for (const key of [...loaded.keys()]) onRemove(key);
      loaded.clear();
    },
  };
}
