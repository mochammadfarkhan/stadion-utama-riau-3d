import * as THREE from 'three';
import { GRASS } from '../config/constants.js';
import { createRandom } from './siteutil/rng.js';
import { createGrassMaterial, updateGrassLight } from './Grass.shader.js';
import { isGrassSpot } from './Grass.placement.js';

/**
 * Rumput bilah instanced mengikuti pemain: satu InstancedMesh (1 draw call),
 * instance = rumpun 3 bilah. Grid sel GRASS.cellSize mengikuti fokus; sel dalam
 * radius diisi dari pool blok (deterministik per sel via seed hash). Saat fokus
 * berpindah > moveThreshold hanya sel keluar/masuk yang dihitung ulang dan hanya
 * slot blok yang berubah yang diunggah (addUpdateRange). Tanpa alokasi per frame.
 */
const CLUMP = GRASS.clumpsPerCell;
const CELL = GRASS.cellSize;
const CELL_RADIUS = Math.ceil(GRASS.radius / CELL);
const KEY_OFFSET = 1 << 15;
const KEY_SPAN = 1 << 16;
const FREE = -1;
const MATRIX_FLOATS = 16;
const BLADE_WIDTHS = [1, 0.8, 0.5]; // lebar relatif tiap tingkat segmen (ujung = 0)
const BLADE_YAW_OFFSET = 0.4;

/** Kunci integer unik untuk sel (ix, iz). */
const cellKey = (ix, iz) => (ix + KEY_OFFSET) * KEY_SPAN + (iz + KEY_OFFSET);
const keyIx = (key) => Math.floor(key / KEY_SPAN) - KEY_OFFSET;
const keyIz = (key) => (key % KEY_SPAN) - KEY_OFFSET;
/** Seed deterministik per sel (hash integer sederhana). */
const cellSeed = (ix, iz) => ((Math.imul(ix, 73856093) ^ Math.imul(iz, 19349663)) >>> 0) || 1;

/** Satu bilah segitiga tipis 3 segmen (7 vertex, 5 segitiga) diputar yaw, digeser (ox, oz). */
function bladeVertices(w, h, yaw, ox, oz) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const pos = [];
  const dir = [];
  const push = (lx, y) => {
    pos.push(ox + lx * cos, y, oz - lx * sin);
    dir.push(sin, cos); // arah lengkung = normal bilah (lokal XZ)
  };
  BLADE_WIDTHS.forEach((k, i) => {
    push(-w * k * 0.5, (h * i) / 3);
    push(w * k * 0.5, (h * i) / 3);
  });
  push(0, h);
  const idx = [];
  for (let s = 0; s < 2; s += 1) {
    const a = s * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  idx.push(4, 5, 6);
  return { pos, dir, idx };
}

/** Geometri rumpun: 3 bilah di sekitar pusat, yaw berselang 120°. */
function createClumpGeometry() {
  const pos = [];
  const dir = [];
  const idx = [];
  for (let b = 0; b < GRASS.bladesPerClump; b += 1) {
    const a = (b / GRASS.bladesPerClump) * Math.PI * 2;
    const ox = Math.cos(a) * GRASS.clumpSpread;
    const oz = Math.sin(a) * GRASS.clumpSpread;
    const blade = bladeVertices(GRASS.bladeWidth, GRASS.heightMax, a + BLADE_YAW_OFFSET, ox, oz);
    const off = pos.length / 3;
    pos.push(...blade.pos);
    dir.push(...blade.dir);
    idx.push(...blade.idx.map((i) => i + off));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 2));
  geo.setIndex(idx);
  return geo;
}

/** Buffer per-instance: skala (tinggi, lengkung) dan tint. */
function createInstanceAttributes(geo, total) {
  const scale = new THREE.InstancedBufferAttribute(new Float32Array(total * 2), 2);
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
  scale.setUsage(THREE.DynamicDrawUsage);
  tint.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aScale', scale);
  geo.setAttribute('aTint', tint);
  return { scale, tint };
}

/** Daftar offset sel dalam radius, urut dari pusat, dipotong sesuai kapasitas pool. */
function buildCellOffsets(maxCells) {
  const list = [];
  for (let dx = -CELL_RADIUS; dx <= CELL_RADIUS; dx += 1) {
    for (let dz = -CELL_RADIUS; dz <= CELL_RADIUS; dz += 1) {
      const d = Math.hypot((dx + 0.5) * CELL, (dz + 0.5) * CELL);
      if (d <= GRASS.radius + CELL * 0.5) list.push({ dx, dz, d });
    }
  }
  list.sort((a, b) => a.d - b.d);
  const offsets = list.slice(0, maxCells);
  const span = CELL_RADIUS * 2 + 1;
  const member = new Uint8Array(span * span);
  offsets.forEach((o) => { member[(o.dx + CELL_RADIUS) * span + (o.dz + CELL_RADIUS)] = 1; });
  const inSet = (dx, dz) => Math.abs(dx) <= CELL_RADIUS && Math.abs(dz) <= CELL_RADIUS
    && member[(dx + CELL_RADIUS) * span + (dz + CELL_RADIUS)] === 1;
  return { offsets, inSet };
}

const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _one = new THREE.Vector3(1, 1, 1);
const _zero = new THREE.Vector3();
const _axisY = new THREE.Vector3(0, 1, 0);

/** Isi satu blok instance untuk sel (ix, iz): posisi acak deterministik, hanya di titik berumput. */
function fillCell(buffers, block, ix, iz) {
  const rng = createRandom(cellSeed(ix, iz));
  const { matrix, scale, tint } = buffers;
  for (let i = 0; i < CLUMP; i += 1) {
    const slot = block * CLUMP + i;
    const x = (ix + rng.next()) * CELL;
    const z = (iz + rng.next()) * CELL;
    const yaw = rng.next() * Math.PI * 2;
    const h = rng.range(GRASS.heightMin, GRASS.heightMax) / GRASS.heightMax;
    const bend = rng.range(GRASS.bendMin, GRASS.bendMax);
    const t = 1 + (rng.next() * 2 - 1) * GRASS.tintVariance;
    _quat.setFromAxisAngle(_axisY, yaw);
    _mat.compose(_pos.set(x, 0, z), _quat, isGrassSpot(x, z) ? _one : _zero);
    _mat.toArray(matrix.array, slot * MATRIX_FLOATS);
    scale.array[slot * 2] = h;
    scale.array[slot * 2 + 1] = bend;
    tint.array[slot * 3] = t;
    tint.array[slot * 3 + 1] = 1 + (t - 1) * 0.6;
    tint.array[slot * 3 + 2] = t;
  }
}

/** Kosongkan blok (skala nol) agar tidak tergambar. */
function clearBlock(matrix, block) {
  _mat.compose(_zero, _quat.identity(), _zero);
  for (let i = 0; i < CLUMP; i += 1) _mat.toArray(matrix.array, (block * CLUMP + i) * MATRIX_FLOATS);
}

/** Tandai rentang buffer blok untuk diunggah ulang (hanya slot yang berubah). */
function markBlock(buffers, block) {
  const start = block * CLUMP;
  buffers.matrix.addUpdateRange(start * MATRIX_FLOATS, CLUMP * MATRIX_FLOATS);
  buffers.scale.addUpdateRange(start * 2, CLUMP * 2);
  buffers.tint.addUpdateRange(start * 3, CLUMP * 3);
  buffers.matrix.needsUpdate = true;
  buffers.scale.needsUpdate = true;
  buffers.tint.needsUpdate = true;
}

/** Pengelola sel ↔ blok pool. blockKey[b] = kunci sel pemilik blok b (FREE bila kosong). */
function createCellPool(buffers, maxCells) {
  const { offsets, inSet } = buildCellOffsets(maxCells);
  // Float64Array: kunci sel bisa > 2^31 (ix >= 0) sehingga Int32Array akan meluap
  const blockKey = new Float64Array(maxCells).fill(FREE);
  const cellBlock = new Map();
  const freeList = Array.from({ length: maxCells }, (_, i) => maxCells - 1 - i);

  /** Lepaskan blok milik sel yang keluar dari radius sekitar sel pusat (cx, cz). */
  const release = (cx, cz) => {
    for (let b = 0; b < maxCells; b += 1) {
      const key = blockKey[b];
      if (key === FREE || inSet(keyIx(key) - cx, keyIz(key) - cz)) continue;
      cellBlock.delete(key);
      blockKey[b] = FREE;
      freeList.push(b);
      clearBlock(buffers.matrix, b);
      markBlock(buffers, b);
    }
  };

  /** Isi sel baru dalam radius (urut dari pusat) dengan blok bebas. */
  const acquire = (cx, cz) => {
    for (let i = 0; i < offsets.length; i += 1) {
      const ix = cx + offsets[i].dx;
      const iz = cz + offsets[i].dz;
      const key = cellKey(ix, iz);
      if (cellBlock.has(key) || freeList.length === 0) continue;
      const b = freeList.pop();
      blockKey[b] = key;
      cellBlock.set(key, b);
      fillCell(buffers, b, ix, iz);
      markBlock(buffers, b);
    }
  };

  return { rebuild: (cx, cz) => { release(cx, cz); acquire(cx, cz); } };
}

/** Pasang pembaruan radiansi lampu dunia sebelum render (cache group 'lighting' sekali). */
function attachLightSync(mesh, material) {
  const state = { lighting: null };
  mesh.onBeforeRender = (renderer, scene) => {
    if (!state.lighting) state.lighting = scene.getObjectByName('lighting')?.userData ?? null;
    if (state.lighting?.sun && state.lighting?.hemi) updateGrassLight(material, state.lighting, scene);
  };
}

/**
 * @param {{count?: number}} opts jumlah bilah dalam pool
 * @returns {THREE.Group} berisi InstancedMesh; userData.update(dt, t, focus)
 */
export function createGrass({ count = GRASS.count } = {}) {
  const total = Math.max(CLUMP, Math.floor(count / GRASS.bladesPerClump));
  const maxCells = Math.floor(total / CLUMP);
  const geo = createClumpGeometry();
  const { scale, tint } = createInstanceAttributes(geo, maxCells * CLUMP);
  const material = createGrassMaterial();
  const mesh = new THREE.InstancedMesh(geo, material, maxCells * CLUMP);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.name = 'rumputBilah';
  for (let b = 0; b < maxCells; b += 1) clearBlock(mesh.instanceMatrix, b);
  attachLightSync(mesh, material);

  const pool = createCellPool({ matrix: mesh.instanceMatrix, scale, tint }, maxCells);
  const last = { x: Number.NaN, z: Number.NaN };
  const focusU = material.uniforms.uFocus.value;

  const group = new THREE.Group();
  group.name = 'rumput';
  group.add(mesh);
  const local = new THREE.Vector3();
  group.userData.update = (dt, t, focus) => {
    if (!focus) return;
    focusU.copy(focus); // fade shader: jarak di frame dunia
    // Sel rumput diisi di koordinat lokal grup (di bawah region.group ber-placement): focus dunia → lokal.
    const l = group.worldToLocal(local.set(focus.x, 0, focus.z));
    const moved = Math.hypot(l.x - last.x, l.z - last.z);
    if (Number.isFinite(moved) && moved <= GRASS.moveThreshold) return;
    last.x = l.x;
    last.z = l.z;
    pool.rebuild(Math.floor(l.x / CELL), Math.floor(l.z / CELL));
  };
  return group;
}
