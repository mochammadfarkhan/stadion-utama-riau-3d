/**
 * Pemuat tekstur PBR nyata (public/textures, hasil `npm run bake:tex`, CC0 ambientCG).
 * loadPbr(name, {tier, anisotropy}) -> {map, normalMap, aoMap, roughnessMap, ormMap} SEKARANG juga (sinkron) dengan
 * placeholder netral (albedo = warna rata-rata, normal datar, orm putih); gambar asli dimuat async lalu menggantikan
 * isi tekstur yang sama (objek tidak berganti -> material tak perlu diperbarui). aoMap/roughnessMap = satu tekstur orm
 * (R = AO, G = Roughness). Cache per ResourceScope aktif; dispose melepas ke-3 tekstur dan membatalkan muatan tertunda.
 */
import { ImageLoader, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture } from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { PBR_KINDS, resolveTier, textureBytes } from './pbrCore.js';

const FLAT_NORMAL = [128, 128, 255];
const FLAT_ORM = [255, 200, 0];
const FALLBACK_AVG = '#808080';

let manifestPromise = null;
let manifestData = null;
const registry = new Map(); // Texture -> {name, kind, tier, w, h, bytes}

const baseUrl = () => `${import.meta.env?.BASE_URL ?? '/'}textures/`;
const hasDocument = () => typeof document !== 'undefined' && typeof document.createElement === 'function';

/** Manifest sekali per sesi (fetch); kegagalan -> null (placeholder tetap dipakai, peringatan sekali). */
export function pbrManifest() {
  if (!manifestPromise) {
    manifestPromise = (typeof fetch === 'function' ? fetch(`${baseUrl()}manifest.json`) : Promise.reject(new Error('fetch tidak ada')))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((m) => {
        manifestData = m;
        return m;
      })
      .catch((err) => {
        console.warn('Manifest tekstur PBR gagal dimuat:', err);
        return null;
      });
  }
  return manifestPromise;
}

/** Info set dari manifest yang sudah termuat (atau null). */
export function pbrInfo(name) {
  return manifestData?.sets?.find((s) => s.name === name) ?? null;
}

function colorCanvas(rgb) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 4;
  const ctx = c.getContext('2d');
  ctx.fillStyle = Array.isArray(rgb) ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : rgb;
  ctx.fillRect(0, 0, 4, 4);
  return c;
}

function makeTexture(rgb, colorSpace, anisotropy) {
  const t = new Texture(hasDocument() ? colorCanvas(rgb) : undefined);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = colorSpace;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  if (t.image) t.needsUpdate = true;
  return t;
}

/** Ganti isi tekstur dengan gambar asli: dispose dulu agar penyimpanan GPU (ukuran berbeda) dialokasi ulang. */
function swapImage(tex, image) {
  tex.dispose();
  tex.image = image;
  tex.needsUpdate = true;
}

function loadKind(name, kind, tier, tex, state) {
  const loader = new ImageLoader();
  return new Promise((resolve) => {
    loader.load(
      `${baseUrl()}${name}/${kind}.${tier}.webp`,
      (img) => {
        if (!state.dead) {
          swapImage(tex, img);
          registry.set(tex, { name, kind, tier, w: img.width, h: img.height, bytes: textureBytes(img.width, img.height) });
        }
        resolve(true);
      },
      undefined,
      () => {
        console.warn(`Tekstur PBR ${name}/${kind}.${tier} gagal dimuat`);
        resolve(false);
      },
    );
  });
}

function createSet(name, tier, anisotropy) {
  const state = { dead: false };
  const map = makeTexture(FALLBACK_AVG, SRGBColorSpace, anisotropy);
  const normalMap = makeTexture(FLAT_NORMAL, NoColorSpace, anisotropy);
  const ormMap = makeTexture(FLAT_ORM, NoColorSpace, anisotropy);
  const set = { map, normalMap, aoMap: ormMap, roughnessMap: ormMap, ormMap, name, tier };
  Object.defineProperty(set, 'state', { value: state, enumerable: false });
  const textures = { albedo: map, normal: normalMap, orm: ormMap };
  for (const t of Object.values(textures)) registry.set(t, { name, kind: 'placeholder', tier: 0, w: 4, h: 4, bytes: textureBytes(4, 4) });
  const ready = hasDocument()
    ? pbrManifest().then(async (m) => {
      const info = m?.sets?.find((s) => s.name === name);
      if (!info || state.dead) return false;
      if (info.avg && map.image) swapImage(map, colorCanvas(info.avg));
      const use = resolveTier(tier, info.sizes);
      set.tier = use;
      const ok = await Promise.all(PBR_KINDS.map((k) => loadKind(name, k, use, textures[k], state)));
      return ok.every(Boolean);
    })
    : Promise.resolve(false);
  Object.defineProperty(set, 'ready', { value: ready, enumerable: false });
  return set;
}

function disposeSet(set) {
  set.state.dead = true;
  for (const t of new Set([set.map, set.normalMap, set.ormMap])) {
    registry.delete(t);
    t.dispose();
  }
}

/**
 * Set tekstur PBR bernama (cache per ResourceScope aktif; panggil di dalam withScope bila perlu). `set.ready` =
 * Promise<boolean> selesai-dimuat (tidak wajib ditunggu: placeholder tampil lebih dulu).
 * @param {string} name nama set (lihat public/textures/manifest.json)
 * @param {{tier?: 256|512|1024, anisotropy?: number}} [opts]
 */
export function loadPbr(name, { tier = 512, anisotropy = 8 } = {}) {
  return currentScope().get(`pbr:${name}:${tier}`, () => createSet(name, tier, anisotropy), { dispose: disposeSet });
}

/** Memori GPU tekstur PBR yang sedang termuat (byte; gambar asli + placeholder), untuk galeri/pengukuran. */
export function pbrMemory() {
  let bytes = 0;
  const entries = [];
  for (const e of registry.values()) {
    bytes += e.bytes;
    entries.push(e);
  }
  return { bytes, count: registry.size, entries };
}
