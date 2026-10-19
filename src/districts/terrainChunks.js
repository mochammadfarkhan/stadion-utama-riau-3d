/**
 * Streaming chunk terrain distrik: aksi ChunkStreamer (diinjeksi — distrik tidak boleh mengimpor city/)
 * → unduh `terrain/<key>.bin` (retry + backoff; data rusak tidak dicoba ulang) → decodeChunk →
 * `field.add` SEGERA (fisika sepeda) → mesh LOD dirakit time-sliced lewat scheduler → dipasang bila
 * permintaan masih berlaku. Lubang tanah dasar kota (`hole`) diisi tepat untuk sel chunk yang meshnya
 * tampil. Chunk gagal: heightAt = 0 di area itu (tidak ditambahkan ke field), mesh datar dipasang agar
 * lubang tetap tertutup, `onFail` (toast sekali di pemanggil). Spec §4.2, §5.3, §10.
 */
import { decodeChunk, TerrainDataError } from '../geo/terrain/heightfield.js';
import { CHUNK_SIZE, N, ZERO_U16 } from '../geo/terrain/format.js';
import { parseTileKey } from '../geo/tiles.js';
import { buildTerrainChunkMesh, buildTerrainChunkMeshSteps } from '../world/terrain/TerrainMesh.js';

export const TERRAIN_FETCH = Object.freeze({ retries: 2, backoffMs: Object.freeze([500, 1500]) });

/** fetch biner dengan galat HTTP eksplisit. */
export async function fetchArrayBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

/**
 * Grid sel (4 m) yang menutup persegi semua chunk; sel (r, c) chunk (ix, iz) = baris (iz − iz0)·125 + r.
 * @param {string[]} keys
 * @returns {{minX:number, minZ:number, cell:number, cols:number, rows:number, ix0:number, iz0:number, per:number}}
 */
export function chunkCellGrid(keys, step = 4) {
  const ids = keys.map((k) => parseTileKey(k)).filter(Boolean);
  if (ids.length === 0) return { minX: 0, minZ: 0, cell: step, cols: 0, rows: 0, ix0: 0, iz0: 0, per: CHUNK_SIZE / step };
  const ix0 = Math.min(...ids.map((t) => t.ix));
  const iz0 = Math.min(...ids.map((t) => t.iz));
  const ix1 = Math.max(...ids.map((t) => t.ix));
  const iz1 = Math.max(...ids.map((t) => t.iz));
  const per = CHUNK_SIZE / step;
  return { minX: ix0 * CHUNK_SIZE, minZ: iz0 * CHUNK_SIZE, cell: step, cols: (ix1 - ix0 + 1) * per, rows: (iz1 - iz0 + 1) * per, ix0, iz0, per };
}

/** Chunk datar (y = 0) untuk fallback visual chunk yang gagal. */
function flatChunk(key, header) {
  const id = parseTileKey(key);
  const data = new Uint16Array(N * N).fill(ZERO_U16);
  return {
    key, ix: id.ix, iz: id.iz, origin: { x: id.ix * CHUNK_SIZE, z: id.iz * CHUNK_SIZE },
    size: header.size, step: header.step, n: header.n, unit: header.unit, bias: header.bias, data,
  };
}

/**
 * @param {{header:{size:number, step:number, n:number, unit:number, bias:number, chunks:string[]},
 *   baseUrl:string, field:object, parent:{add(o:object):void, remove(o:object):void},
 *   materials:{terrain:object}, cellGrid:ReturnType<typeof chunkCellGrid>, cellMask:Uint8Array,
 *   hole?:Uint8Array|null, onHoleChange?:() => void,
 *   scheduler:{schedule(task:Function, opts:{owner:string}):{cancel():void}, cancelOwner(owner:string):void, pending(owner?:string):number},
 *   owner:string, createStreamer:(opts:{tiles:Array<{key:string, ix:number, iz:number}>}) => object,
 *   fetchArrayBuffer?:(url:string) => Promise<ArrayBuffer>, retries?:number, backoffMs?:readonly number[],
 *   sleep?:(ms:number) => Promise<void>, onFail?:(key:string, err:unknown) => void, logger?:{error:(...a:unknown[]) => void},
 *   onChunkMesh?:(key:string, info:{mesh:object|null, lod:0|1, chunk:object}) => void, onChunkRelease?:(key:string) => void}} opts
 *   onChunkMesh: setelah mesh chunk NYATA (bukan fallback datar) dipasang — muat pertama & tiap tukar LOD;
 *   onChunkRelease: sebelum mesh chunk dilepas karena aksi `unload` (bukan tukar LOD). Galat hook dicatat, tidak memutus streaming.
 */
export function createTerrainChunks({
  header, baseUrl, field, parent, materials, cellGrid, cellMask, hole = null, onHoleChange = () => {},
  scheduler, owner, createStreamer, fetchArrayBuffer: getBuffer = fetchArrayBuffer,
  retries = TERRAIN_FETCH.retries, backoffMs = TERRAIN_FETCH.backoffMs,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onFail = () => {}, logger = console,
  onChunkMesh = () => {}, onChunkRelease = () => {},
}) {
  const streamer = createStreamer({ tiles: header.chunks.map((key) => ({ key, ...parseTileKey(key) })) });
  const decoded = new Map(); // key → chunk
  const shown = new Map();   // key → {mesh|null, lod, flat}
  let disposed = false;

  const cellRect = (key) => {
    const id = parseTileKey(key);
    return { r0: (id.iz - cellGrid.iz0) * cellGrid.per, c0: (id.ix - cellGrid.ix0) * cellGrid.per };
  };
  const insideFor = (key) => {
    const { r0, c0 } = cellRect(key);
    return (r, c) => cellMask[(r0 + r) * cellGrid.cols + c0 + c] === 1;
  };
  const setHole = (key, on) => {
    if (!hole) return;
    const { r0, c0 } = cellRect(key);
    for (let r = 0; r < cellGrid.per; r += 1) {
      const row = (r0 + r) * cellGrid.cols + c0;
      for (let c = 0; c < cellGrid.per; c += 1) hole[row + c] = on ? cellMask[row + c] : 0;
    }
    onHoleChange();
  };

  const disposeMesh = (mesh) => mesh?.geometry.dispose(); // material bersama milik distrik
  const detach = (key) => {
    const e = shown.get(key);
    if (!e) return;
    shown.delete(key);
    if (e.mesh) {
      parent.remove(e.mesh);
      disposeMesh(e.mesh);
    }
    setHole(key, false);
  };
  const attach = (key, mesh, lod, flat = false) => {
    detach(key);
    if (mesh) parent.add(mesh);
    shown.set(key, { mesh, lod, flat });
    setHole(key, true);
  };
  const dropData = (key) => {
    decoded.delete(key);
    field.remove(key);
  };

  const fetchDecode = async (key) => {
    const url = `${baseUrl}terrain/${key}.bin`;
    for (let attempt = 0; ; attempt += 1) {
      try {
        return decodeChunk(await getBuffer(url), { ...header, key });
      } catch (err) {
        if (err instanceof TerrainDataError || attempt >= retries) throw err;
        await sleep(backoffMs[Math.min(attempt, backoffMs.length - 1)]);
      }
    }
  };

  const hook = (name, fn) => {
    try {
      fn();
    } catch (err) {
      logger.error(`Hook ${name} chunk gagal (dilanjutkan):`, err);
    }
  };

  const finish = (key, lod, req, mesh) => {
    if (disposed || !streamer.loaded(key, lod, req)) {
      disposeMesh(mesh);
      if (!disposed && streamer.status(key) === 'idle') dropData(key);
      return;
    }
    attach(key, mesh, lod);
    hook('onChunkMesh', () => onChunkMesh(key, { mesh, lod, chunk: decoded.get(key) }));
  };

  const scheduleBuild = (key, chunk, lod, req) => {
    scheduler.schedule(function* buildChunk() {
      if (disposed) return;
      const mesh = yield* buildTerrainChunkMeshSteps(chunk, field, { lod, materials, cellInside: insideFor(key) });
      finish(key, lod, req, mesh);
    }, { owner });
  };

  const fail = (action, err) => {
    if (disposed || !streamer.failed(action.key, action.req)) return;
    logger.error(`Chunk terrain ${action.key} gagal dimuat:`, err);
    onFail(action.key, err);
    if (streamer.status(action.key) === 'failed') {
      attach(action.key, buildTerrainChunkMesh(flatChunk(action.key, header), null, { lod: 1, materials, cellInside: insideFor(action.key) }), 1, true);
    }
  };

  async function load(action) {
    let chunk;
    try {
      chunk = decoded.get(action.key) ?? await fetchDecode(action.key);
    } catch (err) {
      fail(action, err);
      return;
    }
    if (disposed || streamer.status(action.key) !== 'loading') return; // dilepas selama unduh
    decoded.set(action.key, chunk);
    if (!field.has(action.key)) field.add(chunk);
    scheduleBuild(action.key, chunk, action.lod, action.req);
  }

  const execute = (action) => {
    switch (action.type) {
      case 'load':
        load(action).catch((err) => logger.error(`Aksi terrain ${action.key} gagal:`, err));
        break;
      case 'swap': {
        const chunk = decoded.get(action.key);
        if (chunk) scheduleBuild(action.key, chunk, action.lod, action.req);
        else streamer.failed(action.key, action.req);
        break;
      }
      case 'unload':
        if (shown.get(action.key) && !shown.get(action.key).flat) hook('onChunkRelease', () => onChunkRelease(action.key));
        detach(action.key);
        dropData(action.key);
        break;
      default: // 'cancel': hasil basi dibuang saat streamer.loaded() = false
    }
  };

  return {
    /** Satu langkah streaming untuk fokus dunia {x, z}. */
    update(focus) {
      if (disposed || !focus) return;
      for (const action of streamer.update(focus)) execute(action);
      for (const [key, e] of [...shown]) if (e.flat && streamer.status(key) !== 'failed') detach(key); // fallback dilepas
    },
    /** Semua chunk dalam radius r tampil/gagal dan tidak ada rakitan mesh tertunda. */
    settled(x, z, r) {
      return streamer.settled(x, z, r) && scheduler.pending(owner) === 0;
    },
    stats() {
      let triangles = 0;
      for (const e of shown.values()) if (e.mesh) triangles += e.mesh.geometry.index.count / 3;
      return { shown: shown.size, decoded: decoded.size, triangles, ...streamer.stats() };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scheduler.cancelOwner(owner);
      for (const key of [...shown.keys()]) detach(key);
      for (const key of [...decoded.keys()]) dropData(key);
    },
  };
}
