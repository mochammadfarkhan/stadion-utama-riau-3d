/**
 * Tile terperinci digabung per material saat pratinjau Kota di-zoom jauh (R08).
 *
 * Diukur 2026-11-15 di iGPU AMD (laptop user): 157 tile × ±4 lapisan = ±590 draw call; menyembunyikannya
 * memangkas 4–10 ms waktu CPU per frame. Saat kamera jauh (histeresis TILE_DETAIL_FAR) semua tile yang
 * termuat digabung menjadi satu mesh per material (±5 draw call), tile aslinya disembunyikan. Detail kecil
 * (pohon, marka, lampu) memang sudah disembunyikan pada jarak itu, jadi tidak ikut digabung.
 *
 * Biaya: salinan geometri ±1,4 jt titik (±35 MB) selama pratinjau; dibuang saat pratinjau ditutup.
 * Penggabungan dicicil satu material per tick supaya tidak membekukan layar.
 */
import * as THREE from 'three';

const TILE_ROOT = /^tile:.*:lod\d$/;

/** Murni: apakah objek adalah akar tile (TileLoader menamai `tile:<key>:lod<n>`). */
export const isTileRoot = (o) => TILE_ROOT.test(o?.name ?? '');

/** Murni: kunci himpunan tile; berubah bila tile dimuat, dilepas, atau berganti LOD. */
export function tileSetKey(roots) {
  return roots.map((r) => r.name).sort().join('|');
}

/** Murni: kunci kelompok gabung (material + tata atribut + bayangan). */
function bucketKey(mesh) {
  const g = mesh.geometry;
  const attrs = Object.keys(g.attributes).sort().map((n) => `${n}:${g.attributes[n].array.constructor.name}`).join(',');
  return `${mesh.material.uuid}|${attrs}|${g.index ? 'i' : 'n'}|${Number(mesh.receiveShadow)}`;
}

/** Mesh statis yang bisa digabung: bukan instans, bukan grup detail yang tersembunyi. */
function collect(roots) {
  const buckets = new Map();
  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || !o.geometry?.attributes?.position) return;
      for (let p = o; p && p !== root; p = p.parent) if (!p.visible) return;
      const key = bucketKey(o);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(o);
    });
  }
  return [...buckets.values()];
}

/** Batas kerja per tick (ms): gabung dicicil supaya tidak ada frame yang membeku (diukur: per lapisan sekaligus = 480 ms). */
export const MERGE_BUDGET_MS = 8;

/** Pembagi denormalisasi atribut ternormalisasi (aturan glTF/three: signed = max(v / maks, −1)). */
const NORM_MAX = new Map([[Int8Array, 127], [Uint8Array, 255], [Int16Array, 32767], [Uint16Array, 65535]]);

/** Akses mentah atribut (biasa atau interleaved) tanpa getX per elemen. */
function raw(attr) {
  if (attr.isInterleavedBufferAttribute) return { arr: attr.data.array, stride: attr.data.stride, off: attr.offset, size: attr.itemSize };
  return { arr: attr.array, stride: attr.itemSize, off: 0, size: attr.itemSize };
}
const denorm = (attr) => (attr.normalized ? (NORM_MAX.get(attr.array.constructor) ?? 1) : 1);

/**
 * Gabung mesh satu kelompok ke array baru: posisi → Float32 dunia (matrixWorld), normal → Int8 ternormalisasi
 * (normalMatrix), atribut lain disalin apa adanya. `pause()` dipanggil antar-mesh dan boleh menunggu tick berikut;
 * mengembalikan false bila dibatalkan.
 */
async function mergeBucket(meshes, pause) {
  const first = meshes[0];
  const names = Object.keys(first.geometry.attributes);
  let verts = 0;
  let idxCount = 0;
  for (const m of meshes) {
    verts += m.geometry.attributes.position.count;
    idxCount += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
  }
  const out = {};
  for (const n of names) {
    const a = first.geometry.attributes[n];
    if (n === 'position') out[n] = { arr: new Float32Array(verts * 3), size: 3, normalized: false };
    else if (n === 'normal') out[n] = { arr: new Int8Array(verts * 3), size: 3, normalized: true };
    else out[n] = { arr: new a.array.constructor(verts * a.itemSize), size: a.itemSize, normalized: a.normalized };
  }
  const index = verts > 65535 ? new Uint32Array(idxCount) : new Uint16Array(idxCount);
  const nm = new THREE.Matrix3();
  let v0 = 0;
  let i0 = 0;
  for (const m of meshes) {
    if (!(await pause())) return null;
    const g = m.geometry;
    const count = g.attributes.position.count;
    const e = m.matrixWorld.elements;
    nm.getNormalMatrix(m.matrixWorld);
    const ne = nm.elements;
    for (const n of names) {
      const a = g.attributes[n];
      const { arr, stride, off, size } = raw(a);
      const dst = out[n].arr;
      const k = 1 / denorm(a);
      const lo = a.normalized ? -1 : -Infinity; // aturan denormalisasi signed: max(v / maks, −1)
      if (n === 'position') {
        for (let i = 0; i < count; i += 1) {
          const s = off + i * stride;
          const px = Math.max(arr[s] * k, lo);
          const py = Math.max(arr[s + 1] * k, lo);
          const pz = Math.max(arr[s + 2] * k, lo);
          const d = (v0 + i) * 3;
          dst[d] = e[0] * px + e[4] * py + e[8] * pz + e[12];
          dst[d + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13];
          dst[d + 2] = e[2] * px + e[6] * py + e[10] * pz + e[14];
        }
      } else if (n === 'normal') {
        for (let i = 0; i < count; i += 1) {
          const s = off + i * stride;
          const nx = arr[s] * k;
          const ny = arr[s + 1] * k;
          const nz = arr[s + 2] * k;
          let x = ne[0] * nx + ne[3] * ny + ne[6] * nz;
          let y = ne[1] * nx + ne[4] * ny + ne[7] * nz;
          let z = ne[2] * nx + ne[5] * ny + ne[8] * nz;
          const len = Math.hypot(x, y, z) || 1;
          x /= len; y /= len; z /= len;
          const d = (v0 + i) * 3;
          dst[d] = Math.round(x * 127);
          dst[d + 1] = Math.round(y * 127);
          dst[d + 2] = Math.round(z * 127);
        }
      } else if (!a.isInterleavedBufferAttribute) {
        dst.set(arr.subarray(0, count * size), v0 * size);
      } else {
        for (let i = 0; i < count; i += 1) for (let c = 0; c < size; c += 1) dst[(v0 + i) * size + c] = arr[off + i * stride + c];
      }
    }
    if (g.index) {
      const src = g.index.array;
      for (let i = 0; i < g.index.count; i += 1) index[i0 + i] = src[i] + v0;
      i0 += g.index.count;
    } else {
      for (let i = 0; i < count; i += 1) index[i0 + i] = v0 + i;
      i0 += count;
    }
    v0 += count;
  }
  const merged = new THREE.BufferGeometry();
  for (const n of names) merged.setAttribute(n, new THREE.BufferAttribute(out[n].arr, out[n].size, out[n].normalized));
  merged.setIndex(new THREE.BufferAttribute(index, 1));
  merged.computeBoundingSphere();
  const mesh = new THREE.Mesh(merged, first.material);
  mesh.name = `tileGabung:${first.name || 'mesh'}+${meshes.length}`;
  mesh.receiveShadow = first.receiveShadow;
  mesh.layers.mask = first.layers.mask;
  mesh.renderOrder = first.renderOrder;
  mesh.castShadow = false; // kamera pratinjau jauh: bayangan tile tidak terlihat
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

const tick = () => new Promise((resolve) => { setTimeout(resolve, 0); });

/**
 * @param {{parent: THREE.Object3D, logger?: {error(...a: unknown[]): void}}} opts
 * @returns {{update(far: boolean, tiles: THREE.Object3D[]): void, dispose(): void, readonly key: string, readonly ready: boolean, readonly lastBuildMs: number}}
 */
export function createTileMerge({ parent, logger = console }) {
  const group = new THREE.Group();
  group.name = 'tileGabung';
  group.visible = false;
  parent.add(group);
  let key = '';
  let building = null; // kunci yang sedang dibangun
  let candidate = ''; // kunci yang terlihat pada cek sebelumnya: bangun hanya bila himpunan tile sudah tenang (2 cek berturut-turut)
  let lastBuildMs = 0; // tick gabung terlama (ms), untuk ukur patah sesaat
  let token = 0;
  let shown = false; // tile asli sedang disembunyikan demi gabungan

  const clear = () => {
    for (const m of [...group.children]) {
      m.geometry.dispose();
      group.remove(m);
    }
    key = '';
  };

  const build = async (tiles, nextKey) => {
    const my = ++token;
    building = nextKey;
    const meshes = [];
    try {
      let t0 = performance.now();
      const pause = async () => { // jeda antar-mesh bila jatah tick habis
        const used = performance.now() - t0;
        if (used >= MERGE_BUDGET_MS) {
          lastBuildMs = Math.max(lastBuildMs, used);
          await tick();
          t0 = performance.now();
        }
        return my === token;
      };
      for (const bucket of collect(tiles)) {
        const m = await mergeBucket(bucket, pause);
        if (my !== token) { meshes.forEach((x) => x.geometry.dispose()); m?.geometry.dispose(); return; }
        if (m) meshes.push(m);
      }
      lastBuildMs = Math.max(lastBuildMs, performance.now() - t0);
      clear();
      for (const m of meshes) group.add(m);
      key = nextKey;
    } catch (err) {
      logger.error('Gabung tile gagal (tile asli tetap dipakai):', err);
      meshes.forEach((m) => m.geometry.dispose());
    } finally {
      if (my === token) building = null;
    }
  };

  const setTilesVisible = (tiles, visible) => { for (const t of tiles) t.visible = visible; };

  return {
    get key() { return key; },
    get ready() { return key !== ''; },
    /** Tick gabung terlama (ms) sejak dibuat. */
    get lastBuildMs() { return lastBuildMs; },
    /** Panggil berkala (bukan tiap frame); `far` = pratinjau aktif dan kamera jauh. */
    update(far, tiles) {
      if (!far) {
        if (shown) setTilesVisible(tiles, true);
        shown = false;
        group.visible = false;
        return;
      }
      const want = tileSetKey(tiles);
      if (want !== key && want !== building && tiles.length) {
        if (want === candidate) build(tiles, want); // tile masih dimuat: tunggu tenang dulu, jangan bangun ulang tiap cek
        candidate = want;
      }
      const ok = want === key && key !== '';
      setTilesVisible(tiles, !ok);
      group.visible = ok;
      shown = ok;
    },
    dispose() {
      token += 1;
      clear();
      group.removeFromParent();
    },
  };
}
