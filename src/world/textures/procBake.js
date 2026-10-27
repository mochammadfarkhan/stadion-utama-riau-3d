/**
 * Tekstur prosedural hasil bake (public/textures/proc/, `npm run bake:proc`).
 * Kunci = sidik jari isi generator (noise.procKey): warna/parameter berubah → kunci berubah → berkas lama
 * tidak cocok dan fillCanvas kembali membuat prosedural. Bitmap di-decode di awal muat (di luar thread utama),
 * dipakai bersama selama muat (tekstur yang sama bisa diminta beberapa scope), lalu dilepas releaseBaked()
 * sesudah "Siap!". Manifest (kunci → berkas) TETAP disimpan: tekstur yang diminta lagi sesudahnya (region kampus,
 * pemasangan ulang) dimuat ulang asinkron lewat loadBakedImage (cache HTTP + decode di luar thread utama) alih-alih
 * dihitung per piksel di thread utama (rencana performa Fase 2).
 */
const PROC_DIR = 'textures/proc/';
const baked = new Map();
const files = new Map(); // kunci → URL berkas bake (tetap sesudah releaseBaked)
let loader = { fetchImpl: globalThis.fetch?.bind(globalThis), decode: null };

/** @param {string} key @param {ImageBitmap|object} image */
export function registerBaked(key, image) {
  baked.set(key, image);
}

/** Bitmap untuk `key` (tidak dilepas; boleh diminta berulang); null bila tidak ada. */
export function getBaked(key) {
  return baked.get(key) ?? null;
}

/** URL berkas bake untuk `key` (tetap ada sesudah releaseBaked); null bila kunci tidak dipanggang. */
export function bakedFileUrl(key) {
  return files.get(key) ?? null;
}

/** Catat berkas bake tanpa memuatnya (dipakai preload; boleh dipanggil tes). */
export function registerBakedFile(key, url) {
  files.set(key, url);
}

/**
 * Muat ulang bitmap bake `key` (asinkron; decode di luar thread utama). Pemanggil wajib close() bitmap sesudah dipakai.
 * @returns {Promise<ImageBitmap>} ditolak bila kunci tidak dipanggang atau unduhan gagal
 */
export async function loadBakedImage(key) {
  const url = files.get(key);
  if (!url) throw new Error(`Tekstur bake ${key} tidak ada di manifest`);
  const r = await loader.fetchImpl(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (loader.decode ?? defaultDecode)(await r.blob());
}

/** Lepas semua bitmap (memori decode) — panggil sesudah muat selesai. */
export function releaseBaked() {
  for (const image of baked.values()) image.close?.();
  baked.clear();
}

/** Kait skrip bake: saat `globalThis.__procBake` berupa array, piksel hasil prosedural direkam. */
export function captureProc(key, w, h, srgb, data) {
  const sink = globalThis.__procBake;
  if (Array.isArray(sink)) sink.push({ key, w, h, srgb, data });
}

const defaultDecode = (blob) => createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });

/**
 * Unduh + decode semua tekstur di manifest secara paralel. Tidak pernah melempar: berkas yang gagal
 * cukup dilewati (fillCanvas membuatnya prosedural).
 * @returns {Promise<number>} jumlah tekstur siap pakai
 */
export async function preloadProcTextures(baseUrl, {
  fetchImpl = globalThis.fetch?.bind(globalThis), decode = defaultDecode, warn = console.warn,
} = {}) {
  const dir = `${baseUrl}${PROC_DIR}`;
  loader = { fetchImpl, decode };
  try {
    const res = await fetchImpl(`${dir}manifest.json`);
    if (!res.ok) return 0;
    const { entries = [] } = await res.json();
    const done = await Promise.all(entries.map(async ({ key, file }) => {
      try {
        const r = await fetchImpl(`${dir}${file}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        registerBaked(key, await decode(await r.blob()));
        registerBakedFile(key, `${dir}${file}`);
        return 1;
      } catch (err) {
        warn(`Tekstur bake ${file} gagal dimuat; dibuat prosedural:`, err);
        return 0;
      }
    }));
    return done.reduce((a, b) => a + b, 0);
  } catch (err) {
    warn('Manifest tekstur bake gagal dimuat; semua dibuat prosedural:', err);
    return 0;
  }
}
