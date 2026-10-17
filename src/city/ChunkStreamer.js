/**
 * ChunkStreamer: state machine muat/lepas tile kota (logika murni, terpisah dari I/O).
 * update(focus) → daftar aksi untuk TileLoader:
 *   {type:'load', key, lod, req}  tile belum tampil → muat LOD `lod`
 *   {type:'swap', key, lod, req}  tile tampil → ganti ke LOD lain (yang lama tetap tampil sampai selesai)
 *   {type:'cancel', key, req}     muatan > unloadRadius sebelum selesai, atau swap usang → hasilnya dibuang
 *   {type:'unload', key}          tile terlalu jauh → lepas
 * Jarak = jarak fokus ke persegi tile. Muat bila ≤ loadRadius, lepas/batal muat bila > unloadRadius (histeresis),
 * LOD0 di bawah lod0Radius (± lodHysteresis), maks maxParallel muatan bersamaan, prioritas terdekat.
 * Swap dibatalkan bila tile keluar loadRadius atau fokus berbalik (LOD tujuan tak lagi diinginkan, ± histeresis).
 * Hasil muatan dilaporkan lewat loaded()/failed() dengan `req`; hasil basi (dibatalkan) → false.
 */
import { tileBounds, TILE_SIZE } from '../geo/tiles.js';

export const STREAM = Object.freeze({ loadRadius: 1000, unloadRadius: 1300, lod0Radius: 600, lodHysteresis: 50, maxParallel: 2 });

/** Jarak titik ke persegi tile (0 bila di dalam). */
export function rectDistance(x, z, b) {
  const dx = Math.max(b.minX - x, 0, x - b.maxX);
  const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
  return Math.hypot(dx, dz);
}

/**
 * @param {{tiles: Array<{key:string, ix:number, iz:number}>, tileSize?: number, config?: typeof STREAM}} opts
 */
export function createChunkStreamer({ tiles, tileSize = TILE_SIZE, config = STREAM }) {
  if (!(config.unloadRadius > config.loadRadius)) throw new RangeError('ChunkStreamer: unloadRadius harus > loadRadius');
  const list = tiles.map((t) => ({
    key: t.key, bounds: tileBounds(t.ix, t.iz, tileSize),
    status: 'idle', lod: null, pending: null, noSwap: false, dist: Infinity,
  }));
  const byKey = new Map();
  for (const t of list) {
    if (byKey.has(t.key)) throw new Error(`ChunkStreamer: key tile ganda "${t.key}"`);
    byKey.set(t.key, t);
  }
  let seq = 0;

  const inFlight = () => list.reduce((n, t) => n + (t.pending ? 1 : 0), 0);
  /** LOD yang diinginkan pada jarak t.dist bila LOD `from` sedang tampil (histeresis di sekitar lod0Radius). */
  const wantLod = (t, from = t.lod) => {
    const near = config.lod0Radius;
    if (from === 0) return t.dist <= near + config.lodHysteresis ? 0 : 1;
    return t.dist < near ? 0 : 1;
  };

  const release = (t, out) => {
    if (t.status === 'loaded' || t.status === 'loading') {
      if (t.pending) out.push({ type: 'cancel', key: t.key, req: t.pending.req });
      if (t.status === 'loaded') out.push({ type: 'unload', key: t.key });
    }
    t.status = 'idle';
    t.lod = null;
    t.pending = null;
    t.noSwap = false;
  };

  const cancelSwap = (t, out) => {
    out.push({ type: 'cancel', key: t.key, req: t.pending.req });
    t.pending = null;
  };

  return {
    /** @param {{x:number, z:number}} focus @returns {Array<object>} aksi berurutan */
    update(focus) {
      const out = [];
      if (!focus || !Number.isFinite(focus.x) || !Number.isFinite(focus.z)) return out;
      for (const t of list) t.dist = rectDistance(focus.x, focus.z, t.bounds);
      for (const t of list) {
        if (t.dist > config.unloadRadius) {
          if (t.status !== 'idle') release(t, out); // termasuk muatan berjalan: batal hanya di luar radius lepas
          continue;
        }
        if (t.status !== 'loaded') continue; // 'loading' berjalan terus di pita histeresis
        if (t.dist > config.loadRadius) {
          t.noSwap = false; // boleh mencoba tukar LOD lagi saat masuk kembali
          if (t.pending) cancelSwap(t, out); // tukar LOD di luar radius muat: batalkan, tetap tampil
        } else if (t.pending && wantLod(t, t.pending.lod) === t.lod) {
          cancelSwap(t, out); // fokus berbalik: LOD tujuan tak lagi diinginkan (dengan histeresis)
        }
      }
      const candidates = list
        .filter((t) => t.dist <= config.loadRadius && !t.pending
          && (t.status === 'idle' || (t.status === 'loaded' && !t.noSwap && wantLod(t) !== t.lod)))
        .sort((a, b) => a.dist - b.dist || (a.key < b.key ? -1 : 1));
      let slots = config.maxParallel - inFlight();
      for (const t of candidates) {
        if (slots <= 0) break;
        seq += 1;
        const lod = wantLod(t);
        t.pending = { lod, req: seq };
        if (t.status === 'idle') {
          t.status = 'loading';
          out.push({ type: 'load', key: t.key, lod, req: seq });
        } else {
          out.push({ type: 'swap', key: t.key, lod, req: seq });
        }
        slots -= 1;
      }
      return out;
    },
    /** Muatan selesai; false = basi (dibatalkan/diganti) → pemanggil membuang hasilnya. */
    loaded(key, lod, req) {
      const t = byKey.get(key);
      if (!t?.pending || t.pending.req !== req || t.pending.lod !== lod) return false;
      t.status = 'loaded';
      t.lod = lod;
      t.pending = null;
      return true;
    },
    /** Muatan gagal (setelah retry). Tukar LOD gagal: LOD lama tetap, tidak dicoba lagi sampai tile dilepas. */
    failed(key, req) {
      const t = byKey.get(key);
      if (!t?.pending || t.pending.req !== req) return false;
      t.pending = null;
      if (t.status === 'loaded') t.noSwap = true;
      else t.status = 'failed';
      return true;
    },
    status: (key) => byKey.get(key)?.status ?? null,
    lodOf: (key) => byKey.get(key)?.lod ?? null,
    /** Semua tile manifest dalam radius r dari (x, z) sudah tampil atau gagal (tidak ada yang menunggu). */
    settled(x, z, r) {
      return list.every((t) => rectDistance(x, z, t.bounds) > r || t.status === 'loaded' || t.status === 'failed');
    },
    keys(status) { return list.filter((t) => t.status === status).map((t) => t.key); },
    stats() {
      const s = { idle: 0, loading: 0, loaded: 0, failed: 0, inFlight: inFlight() };
      for (const t of list) s[t.status] += 1;
      return s;
    },
  };
}
