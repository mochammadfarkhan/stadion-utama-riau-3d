/**
 * Mesh terrain per chunk (spec §5.3): LOD0 grid 4 m (126² simpul), LOD1 16 m, skirt 2 m ke bawah di tepi
 * chunk, normal dari heightfield (beda pusat pada data penuh; tetangga lewat HeightField bila termuat)
 * agar mulus antar chunk. Hanya sel yang `cellInside` (sel di dalam batas distrik) yang digambar — sel
 * yang sama dengan lubang tanah dasar kota. UV = meter dunia (repeat tekstur dari surfaceMaps).
 * `buildTerrainChunkMeshSteps` = generator (tiap `yield` titik potong scheduler); `buildTerrainChunkMesh`
 * menjalankannya sampai selesai.
 */
import * as THREE from 'three';
import { sampleAt } from '../../geo/terrain/heightfield.js';
import { tileKey } from '../../geo/tiles.js';
import { surfaceMaterial } from '../Ground.materials.js';

export const TERRAIN_MESH = Object.freeze({
  lod1Stride: 4,        // LOD1 = setiap simpul ke-4 (16 m)
  skirt: 2,             // m ke bawah di tepi chunk
  rowsPerSlice: 16,     // baris simpul per potongan scheduler
  renderOrder: -3.5,    // setelah tanah dasar kota (−4), sebelum landuse/air/jalan kota (−3/−2/−1)
  color: 0xd9e4b8,      // pengali warna tekstur rumput (sedikit lebih kering dari rumput stadion)
});

/** Indeks simpul per LOD: LOD0 0..n−1; LOD1 0, 4, …, 124, 125. */
export function lodIndices(n, lod) {
  const stride = lod === 0 ? 1 : TERRAIN_MESH.lod1Stride;
  const out = [];
  for (let i = 0; i < n - 1; i += stride) out.push(i);
  out.push(n - 1);
  return out;
}

/** Tinggi simpul (r, c) chunk; di luar chunk → HeightField bila chunk tetangga termuat, selain itu clamp. */
function heightSampler(chunk, field) {
  const last = chunk.n - 1;
  return (r, c) => {
    if (r >= 0 && r <= last && c >= 0 && c <= last) return sampleAt(chunk, r, c);
    const x = chunk.origin.x + c * chunk.step;
    const z = chunk.origin.z + r * chunk.step;
    if (field?.has(tileKey(Math.floor(x / chunk.size), Math.floor(z / chunk.size)))) return field.heightAt(x, z);
    return sampleAt(chunk, Math.min(last, Math.max(0, r)), Math.min(last, Math.max(0, c)));
  };
}

/** Sel LOD (i, j) digambar bila salah satu sel LOD0 di dalamnya ada di dalam batas. */
function lodCellInside(idx, i, j, cellInside) {
  for (let r = idx[i]; r < idx[i + 1]; r += 1) {
    for (let c = idx[j]; c < idx[j + 1]; c += 1) if (cellInside(r, c)) return true;
  }
  return false;
}

/**
 * @param {{key:string, origin:{x:number,z:number}, n:number, step:number, size:number, data:Uint16Array}} chunk
 * @param {{has(key:string):boolean, heightAt(x:number,z:number):number}|null} field
 * @param {{lod:0|1, materials:{terrain:THREE.Material}, cellInside?:(r:number, c:number) => boolean}} opts
 * @returns {Generator<void, THREE.Mesh|null>} null bila tidak ada sel yang digambar
 */
export function* buildTerrainChunkMeshSteps(chunk, field, { lod, materials, cellInside = () => true }) {
  const idx = lodIndices(chunk.n, lod);
  const m = idx.length;
  const H = heightSampler(chunk, field);
  const step = chunk.step;
  const pos = [];
  const nor = [];
  const uv = [];
  for (let i = 0; i < m; i += 1) {
    const r = idx[i];
    for (let j = 0; j < m; j += 1) {
      const c = idx[j];
      pos.push(c * step, H(r, c), r * step);
      const sx = (H(r, c + 1) - H(r, c - 1)) / (2 * step);
      const sz = (H(r + 1, c) - H(r - 1, c)) / (2 * step);
      const len = Math.hypot(sx, 1, sz);
      nor.push(-sx / len, 1 / len, -sz / len);
      uv.push(chunk.origin.x + c * step, chunk.origin.z + r * step);
    }
    if ((i + 1) % TERRAIN_MESH.rowsPerSlice === 0) yield;
  }
  const inside = new Uint8Array((m - 1) * (m - 1));
  const index = [];
  for (let i = 0; i < m - 1; i += 1) {
    for (let j = 0; j < m - 1; j += 1) {
      if (!lodCellInside(idx, i, j, cellInside)) continue;
      inside[i * (m - 1) + j] = 1;
      const a = i * m + j;
      const b = a + 1;
      const c = a + m;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  if (index.length === 0) return null;
  yield;
  addSkirts({ m, inside, pos, nor, uv, index });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, materials.terrain);
  mesh.name = `terrain:${chunk.key}:lod${lod}`;
  mesh.position.set(chunk.origin.x, 0, chunk.origin.z);
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false; // statis (pola freezeStatic): matriks dunia dihitung sekali saat dipasang
  mesh.renderOrder = TERRAIN_MESH.renderOrder;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.lod = lod;
  return mesh;
}

/** Jalankan generator sampai selesai (tes, fallback datar). */
export function buildTerrainChunkMesh(chunk, field, opts) {
  const it = buildTerrainChunkMeshSteps(chunk, field, opts);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}

/**
 * Skirt vertikal `TERRAIN_MESH.skirt` m di tepi chunk, hanya di sisi sel yang digambar.
 * Simpul bawah = salinan simpul tepi (normal & UV sama) diturunkan; urutan segitiga menghadap ke luar.
 */
function addSkirts({ m, inside, pos, nor, uv, index }) {
  const drop = (v) => {
    const k = pos.length / 3;
    pos.push(pos[v * 3], pos[v * 3 + 1] - TERRAIN_MESH.skirt, pos[v * 3 + 2]);
    nor.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
    uv.push(uv[v * 2], uv[v * 2 + 1]);
    return k;
  };
  const cell = (i, j) => inside[i * (m - 1) + j] === 1;
  // [A, B] = dua simpul tepi berurutan; outward=true → segitiga (A, B, A') menghadap ke luar.
  const strip = (A, B, outwardAB) => {
    const a2 = drop(A);
    const b2 = drop(B);
    if (outwardAB) index.push(A, B, a2, B, b2, a2);
    else index.push(A, a2, B, B, a2, b2);
  };
  for (let j = 0; j < m - 1; j += 1) {
    if (cell(0, j)) strip(j, j + 1, true); // utara (−z)
    if (cell(m - 2, j)) strip((m - 1) * m + j, (m - 1) * m + j + 1, false); // selatan (+z)
  }
  for (let i = 0; i < m - 1; i += 1) {
    if (cell(i, 0)) strip(i * m, (i + 1) * m, false); // barat (−x)
    if (cell(i, m - 2)) strip(i * m + m - 1, (i + 1) * m + m - 1, true); // timur (+x)
  }
}

/** Material terrain bersama (rumput bertekstur, polygonOffset agar lapisan datar kota menang saat sejajar). */
export function createTerrainMaterial() {
  const mat = surfaceMaterial('grass', { color: TERRAIN_MESH.color });
  mat.name = 'terrain';
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  return mat;
}
