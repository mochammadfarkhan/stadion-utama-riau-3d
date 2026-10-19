/**
 * Unduh & cache ubin SRTM: `data-src/dem/srtm/<tile>.hgt` (didekompresi). Cache dipakai bila ada dan
 * sha256-nya cocok; mode offline tanpa cache → galat berisi URL & langkah unduh manual (spec §10).
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { USER_AGENT } from '../../citybake/config.js';

const REQUEST_TIMEOUT_MS = 120000;
const RETRIES = 2;
const BACKOFF_MS = [2000, 6000];

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Path cache ubin. */
export const srtmCachePath = (cacheDir, tile) => join(cacheDir, 'dem', 'srtm', `${tile}.hgt`);

/** Pesan langkah unduh manual (dipakai saat offline/gagal). */
export function manualSteps(srtm, cacheDir) {
  const path = srtmCachePath(cacheDir, srtm.tile);
  return `Unduh manual: curl -L -o ${path}.gz ${srtm.url} && gzip -d ${path}.gz (hasil ${path}, sha256 ${srtm.sha256}).`;
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET dengan retry (galat jaringan & 5xx/429); 4xx lain langsung gagal. @returns {Promise<Uint8Array>} */
async function download(url, { fetchImpl, sleep, log }) {
  let last = null;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      last = new Error(`HTTP ${res.status}`);
      if (res.status < 500 && res.status !== 429) break;
    } catch (err) {
      last = err;
    }
    if (attempt < RETRIES) {
      log.warn(`[campusbake] unduh SRTM gagal (${last.message}) — coba lagi`);
      await sleep(BACKOFF_MS[attempt]);
    }
  }
  throw new Error(`unduh ${url} gagal: ${last?.message}`);
}

/**
 * Muat ubin SRTM (.hgt mentah, sudah didekompresi) dari cache atau unduh.
 * @param {{tile:string, url:string, sha256:string}} srtm
 * @param {{cacheDir:string, offline?:boolean, fetchImpl?:typeof fetch, sleep?:(ms:number)=>Promise<void>, log?:Console}} opts
 * @returns {Promise<Uint8Array>}
 */
export async function loadSrtm(srtm, { cacheDir, offline = false, fetchImpl = globalThis.fetch, sleep = defaultSleep, log = console }) {
  const path = srtmCachePath(cacheDir, srtm.tile);
  try {
    const cached = new Uint8Array(await readFile(path));
    if (sha256(cached) !== srtm.sha256) throw new Error(`cache SRTM ${path} sha256 tidak cocok (hapus lalu unduh ulang)`);
    return cached;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (offline) throw new Error(`mode --offline tetapi cache SRTM tidak ada: ${path}. ${manualSteps(srtm, cacheDir)}`);
  log.info(`[campusbake] mengunduh SRTM ${srtm.tile} dari ${srtm.url}…`);
  let raw;
  try {
    raw = new Uint8Array(gunzipSync(await download(srtm.url, { fetchImpl, sleep, log })));
  } catch (err) {
    throw new Error(`${err.message}. ${manualSteps(srtm, cacheDir)}`, { cause: err });
  }
  if (sha256(raw) !== srtm.sha256) {
    throw new Error(`SRTM ${srtm.tile} terunduh tetapi sha256 ${sha256(raw)} ≠ ${srtm.sha256} (mirror berubah?)`);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, raw);
  return raw;
}
