/**
 * Rincian tile kota dari data.json (tanpa bake ulang): marka jalan (garis tengah putus-putus + garis tepi jalan besar)
 * dan pohon (deret pohon tepi jalan + sebaran halaman) sebagai SATU InstancedMesh per tile. Murni di bagian penghitung
 * (markingQuads, treePoints; deterministik dari key tile, tanpa THREE) supaya mudah diuji; perakit THREE ada di bawah.
 * Koordinat data tile terdekode = DUNIA (meter); mesh dipasang di anak root tile (lokal = dunia − pusat tile).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pointInPolygon } from '../geo/polygon.js';

export const MARKING = Object.freeze({ y: 0.14, dash: 3.5, gap: 5.5, width: 0.5, edgeInset: 0.9, minRoadWidth: 5.5 }); // lebar dilebihkan (aslinya ±0,12 m) agar terbaca dari udara
const CENTER_CLASSES = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential']);
const EDGE_CLASSES = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);
const TREE_ROAD_CLASSES = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street']);
export const LAMPS = Object.freeze({ spacing: 38, offset: 1.4, maxPerTile: 170, poleH: 6.5 });
export const TREES = Object.freeze({ spacing: 13, scatter: 17, maxPerTile: 420, rowKeep: 0.72, minH: 6, maxH: 11, half: 250, cell: 20 });

/** Hash deterministik [0, 1) dari tiga bilangan bulat. */
export function hash01(a, b, c = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const keyHash = (key) => [...key].reduce((s, ch) => (Math.imul(s, 31) + ch.charCodeAt(0)) | 0, 7);

/** Satu quad pita sepanjang segmen (ax,az)+u·[t0,t1], digeser `off` ke normal, selebar 2·halfW (8 angka). */
function pushQuad(out, ax, az, ux, uz, t0, t1, off, halfW) {
  const nx = -uz;
  const nz = ux;
  const cx0 = ax + ux * t0 + nx * off;
  const cz0 = az + uz * t0 + nz * off;
  const cx1 = ax + ux * t1 + nx * off;
  const cz1 = az + uz * t1 + nz * off;
  out.push(cx0 - nx * halfW, cz0 - nz * halfW, cx0 + nx * halfW, cz0 + nz * halfW, cx1 + nx * halfW, cz1 + nz * halfW, cx1 - nx * halfW, cz1 - nz * halfW);
}

/**
 * Quad marka untuk jalan-jalan tile: garis tengah putus-putus (jalan ≥ minRoadWidth) dan dua garis tepi menerus
 * (kelas besar). `reserved(x, z)` (dunia) true = lewati segmen (kawasan region/kampus).
 * @returns {number[]} 8 angka (x,z ×4 sudut) per quad
 */
export function markingQuads(roads, reserved = () => false) {
  const out = [];
  const period = MARKING.dash + MARKING.gap;
  for (const r of roads) {
    if (!CENTER_CLASSES.has(r.cls) || r.width < MARKING.minRoadWidth) continue;
    const edge = EDGE_CLASSES.has(r.cls);
    let s = 0; // jarak kumulatif sepanjang jalan (fase putus-putus menyambung antar segmen)
    for (let i = 0; i + 1 < r.pts.length; i += 1) {
      const [ax, az] = r.pts[i];
      const [bx, bz] = r.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1e-3) continue;
      const ux = (bx - ax) / len;
      const uz = (bz - az) / len;
      if (!reserved((ax + bx) / 2, (az + bz) / 2)) {
        for (let k = Math.floor(s / period); k * period < s + len; k += 1) { // garis tengah
          const a0 = Math.max(k * period, s) - s;
          const a1 = Math.min(k * period + MARKING.dash, s + len) - s;
          if (a1 - a0 > 0.3) pushQuad(out, ax, az, ux, uz, a0, a1, 0, MARKING.width / 2);
        }
        if (edge) {
          const off = r.width / 2 - MARKING.edgeInset;
          pushQuad(out, ax, az, ux, uz, 0, len, off, MARKING.width / 2);
          pushQuad(out, ax, az, ux, uz, 0, len, -off, MARKING.width / 2);
        }
      }
      s += len;
    }
  }
  return out;
}

/**
 * Titik lampu jalan tile: tiap LAMPS.spacing m sepanjang jalan besar (kelas EDGE, lebar ≥ minRoadWidth), bergantian kiri/kanan,
 * digeser lebar/2 + offset dari sumbu; `rot` = arah jalan (kepala lampu memanjang searah jalan). Dibatasi maxPerTile.
 * @returns {Array<{x:number, z:number, rot:number}>}
 */
export function streetLampPoints(roads, reserved = () => false, { max = LAMPS.maxPerTile } = {}) {
  const out = [];
  for (const r of roads) {
    if (!EDGE_CLASSES.has(r.cls) || r.width < MARKING.minRoadWidth) continue;
    let s = 0;
    let next = hash01(Math.round(r.pts[0][0]), Math.round(r.pts[0][1]), 11) * LAMPS.spacing; // fase acak per jalan
    let k = 0;
    for (let i = 0; i + 1 < r.pts.length; i += 1) {
      const [ax, az] = r.pts[i];
      const [bx, bz] = r.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1e-3) continue;
      const ux = (bx - ax) / len;
      const uz = (bz - az) / len;
      for (; next < s + len; next += LAMPS.spacing, k += 1) {
        const t = next - s;
        const side = k % 2 === 0 ? 1 : -1;
        const off = side * (r.width / 2 + LAMPS.offset);
        const x = ax + ux * t - uz * off;
        const z = az + uz * t + ux * off;
        if (!reserved(x, z)) out.push({ x, z, rot: Math.atan2(ux, uz) });
        if (out.length >= max) return out;
      }
      s += len;
    }
  }
  return out;
}

/** Indeks spasial kasar (sel 20 m): bangunan (bbox), segmen jalan (bbox + lebar), air. Murni. */
function buildIndex(tile) {
  const cell = TREES.cell;
  const grid = new Map();
  const put = (minX, minZ, maxX, maxZ, item) => {
    for (let gx = Math.floor(minX / cell); gx <= Math.floor(maxX / cell); gx += 1) {
      for (let gz = Math.floor(minZ / cell); gz <= Math.floor(maxZ / cell); gz += 1) {
        const k = `${gx},${gz}`;
        const list = grid.get(k);
        if (list) list.push(item); else grid.set(k, [item]);
      }
    }
  };
  for (const b of tile.buildings) {
    const xs = b.ring.map((p) => p[0]);
    const zs = b.ring.map((p) => p[1]);
    put(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), { kind: 'b', ring: b.ring });
  }
  for (const r of tile.roads) {
    const reach = r.width / 2 + 2.2;
    for (let i = 0; i + 1 < r.pts.length; i += 1) {
      const [ax, az] = r.pts[i];
      const [bx, bz] = r.pts[i + 1];
      put(Math.min(ax, bx) - reach, Math.min(az, bz) - reach, Math.max(ax, bx) + reach, Math.max(az, bz) + reach,
        { kind: 'r', ax, az, bx, bz, reach: r.width / 2 + 1.4 });
    }
  }
  for (const w of tile.water) {
    const xs = w.outer.map((p) => p[0]);
    const zs = w.outer.map((p) => p[1]);
    put(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), { kind: 'w', ring: w.outer });
  }
  return (x, z) => grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? [];
}

const segDist = (px, pz, { ax, az, bx, bz }) => {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};

/**
 * Posisi pohon tile: deret tepi jalan (kedua sisi, jarak ±13 m) lalu sebaran halaman (grid berjitter, gugus noise),
 * ditolak bila di dalam bangunan, air, badan jalan, atau `reserved`. Maksimum TREES.maxPerTile.
 * @returns {Array<{x:number, z:number, h:number, w:number, rot:number, tint:number}>}
 */
export function treePoints(tile, reserved = () => false, { max = TREES.maxPerTile } = {}) {
  const near = buildIndex(tile);
  const seed = keyHash(tile.key);
  const { x: cx, z: cz } = tile.center;
  const out = [];
  const free = (x, z) => {
    if (Math.abs(x - cx) > TREES.half || Math.abs(z - cz) > TREES.half || reserved(x, z)) return false;
    for (const it of near(x, z)) {
      if (it.kind === 'b' && pointInPolygon(x, z, it.ring)) return false;
      if (it.kind === 'w' && pointInPolygon(x, z, it.ring)) return false;
      if (it.kind === 'r' && segDist(x, z, it) < it.reach) return false;
    }
    return true;
  };
  const push = (x, z, i, j) => {
    const h = TREES.minH + hash01(seed, i, j) * (TREES.maxH - TREES.minH);
    out.push({ x, z, h, w: h * (0.55 + hash01(j, i, seed) * 0.25), rot: hash01(i, j, seed + 5) * Math.PI * 2, tint: 0.82 + hash01(seed, j, i) * 0.36 });
  };
  roads: for (const [ri, r] of tile.roads.entries()) {
    if (!TREE_ROAD_CLASSES.has(r.cls)) continue;
    let carry = 0;
    for (let i = 0; i + 1 < r.pts.length; i += 1) {
      const [ax, az] = r.pts[i];
      const [bx, bz] = r.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1e-3) continue;
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      for (let d = TREES.spacing - carry; d <= len; d += TREES.spacing) {
        const slot = Math.floor(d * 10) + i * 7919;
        for (const side of [-1, 1]) {
          if (hash01(seed, ri * 31 + slot, side) > TREES.rowKeep) continue;
          const off = side * (r.width / 2 + 2.6 + hash01(slot, ri, side) * 1.4);
          const x = ax + ((bx - ax) * d) / len + nx * off;
          const z = az + ((bz - az) * d) / len + nz * off;
          if (free(x, z)) push(x, z, ri * 131 + slot, side);
          if (out.length >= max) break roads;
        }
      }
      carry = (carry + len) % TREES.spacing;
    }
  }
  const grid = TREES.scatter;
  for (let gx = -TREES.half; gx < TREES.half && out.length < max; gx += grid) {
    for (let gz = -TREES.half; gz < TREES.half && out.length < max; gz += grid) {
      const ix = Math.round(gx / grid);
      const iz = Math.round(gz / grid);
      const cluster = 0.5 + 0.5 * Math.sin((cx + gx) / 70 + seed) * Math.cos((cz + gz) / 55 - seed); // gugus: ada rimbun, ada gundul
      if (hash01(seed, ix, iz + 99) > 0.16 + 0.42 * cluster) continue;
      const x = cx + gx + hash01(ix, iz, seed) * grid;
      const z = cz + gz + hash01(iz, ix, seed + 1) * grid;
      if (free(x, z)) push(x, z, ix + 5000, iz + 5000);
    }
  }
  return out;
}

const TRUNK_RGB = [0.16, 0.09, 0.05];
const CROWN_RGB = [0.07, 0.24, 0.06];

/** Geometri pohon satuan (tinggi 1, tajuk elipsoid radius 0,5): batang prisma 4 sisi + tajuk ikosahedron. ±28 segitiga. */
export function createTreeGeometry() {
  const paint = (g, rgb) => {
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) c.set(rgb, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const trunk = paint(new THREE.CylinderGeometry(0.035, 0.05, 0.42, 4, 1, true).translate(0, 0.21, 0).toNonIndexed(), TRUNK_RGB);
  const crown = paint(new THREE.IcosahedronGeometry(0.5, 0).scale(1, 0.85, 1).translate(0, 0.66, 0).toNonIndexed(), CROWN_RGB);
  for (const g of [trunk, crown]) { g.deleteAttribute('uv'); }
  const merged = mergeGeometries([trunk, crown], false);
  trunk.dispose();
  crown.dispose();
  return merged;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const col = new THREE.Color();

/**
 * Pasang marka & pohon pada root tile (hanya LOD0). Mesh memakai material bersama `materials` (tidak dilepas per tile).
 * @param {THREE.Object3D} root grup tile (posisi = pusat tile)
 * @param {ReturnType<import('./tileData.js').decodeTileData>} tile
 * @param {{forMesh(name: string): THREE.Material|null}} materials
 * @param {{reserved?: (x: number, z: number) => boolean, trees?: boolean, markings?: boolean}} [opts]
 * @returns {{markings: number, trees: number}}
 */
export function addTileDetail(root, tile, materials, { reserved = () => false, trees = true, markings = true, lamps = true } = {}) {
  const result = { markings: 0, trees: 0, lamps: 0 };
  const { x: cx, z: cz } = tile.center;
  const markMat = materials.forMesh('road_markings');
  if (markings && markMat) {
    const quads = markingQuads(tile.roads, reserved);
    const n = quads.length / 8;
    if (n > 0) {
      const p = new Float32Array(n * 4 * 3);
      const normal = new Float32Array(n * 4 * 3);
      const color = new Float32Array(n * 4 * 3).fill(0.9);
      const index = new Uint32Array(n * 6);
      for (let i = 0; i < n; i += 1) {
        for (let k = 0; k < 4; k += 1) {
          const o = (i * 4 + k) * 3;
          p[o] = quads[i * 8 + k * 2] - cx;
          p[o + 1] = MARKING.y;
          p[o + 2] = quads[i * 8 + k * 2 + 1] - cz;
          normal[o + 1] = 1;
        }
        index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
      g.setAttribute('color', new THREE.BufferAttribute(color, 3));
      g.setIndex(new THREE.BufferAttribute(index, 1));
      const mesh = new THREE.Mesh(g, markMat);
      mesh.name = 'marka';
      mesh.renderOrder = -0.5; // di atas jalan (−1), di bawah bangunan (0)
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      root.add(mesh);
      result.markings = n;
    }
  }
  const poleMat = materials.forMesh('lamp_poles');
  const headMat = materials.forMesh('lamp_heads');
  if (lamps && poleMat && headMat) {
    const spots = streetLampPoints(tile.roads, reserved);
    if (spots.length > 0) {
      const mk = (geo, mat, name) => {
        const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
        mesh.name = name;
        spots.forEach((p, i) => {
          q.setFromAxisAngle(up, p.rot);
          mesh.setMatrixAt(i, m4.compose(pos.set(p.x - cx, 0, p.z - cz), q, scl.set(1, 1, 1)));
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = false;
        mesh.computeBoundingSphere();
        root.add(mesh);
      };
      mk(new THREE.BoxGeometry(0.26, LAMPS.poleH, 0.26).translate(0, LAMPS.poleH / 2, 0), poleMat, 'tiangLampu');
      mk(new THREE.BoxGeometry(0.9, 0.3, 1.7).translate(0, LAMPS.poleH + 0.1, 0), headMat, 'kepalaLampu');
      result.lamps = spots.length;
    }
  }
  const treeMat = materials.forMesh('trees');
  if (trees && treeMat) {
    const pts = treePoints(tile, reserved);
    if (pts.length > 0) {
      const mesh = new THREE.InstancedMesh(createTreeGeometry(), treeMat, pts.length);
      mesh.name = 'pohon';
      pts.forEach((t, i) => {
        q.setFromAxisAngle(up, t.rot);
        m4.compose(pos.set(t.x - cx, 0, t.z - cz), q, scl.set(t.w, t.h, t.w));
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, col.setRGB(t.tint, t.tint * (0.9 + 0.2 * hash01(i, 3, 1)), t.tint));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
      result.trees = pts.length;
    }
  }
  return result;
}
