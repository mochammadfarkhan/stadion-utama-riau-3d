/**
 * Vegetasi distrik UNRI (placeholder prosedural katalog V01 mahoni, V02 angsana, V03 saga, V06 sawit, V07 semak).
 * Draw call minimal: semua peneduh + semak berbagi SATU geometri tajuk (gumpalan bola) dan satu material
 * berangin; bentuk spesies dibedakan skala non-seragam per instans + palet warna instans. Per sel 200 m
 * (VEGETATION_CELL) maksimal 4 InstancedMesh: batang, tajuk, batang sawit, pelepah sawit. Variasi (skala, rotasi,
 * warna, tinggi batang) deterministik dari posisi (hash01).
 */
import {
  BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4,
  MeshLambertMaterial, Quaternion, Vector3,
} from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { blobCluster } from '../siteutil/rounded.js';
import { createRandom } from '../siteutil/rng.js';
import { applyWind, createWindDepthMaterial } from '../shaders/wind.js';
import { VEGETATION_CELL } from '../Landscape.trees.js';

/**
 * Parameter spesies (m). Tinggi total ≈ (batang + 1,6 × tajuk.y) × skala; skala 0,85–1,3. Tinggi katalog:
 * mahoni 12–18, angsana 10–15 (tajuk payung), saga 8–12 (renggang), sawit 6–9, semak ±1.
 */
export const VEG_SPECIES = Object.freeze({
  mahoni: Object.freeze({ trunkH: [6, 8], trunkR: 0.34, crown: [4.2, 3.6, 4.2], palette: Object.freeze([0x4f7d32, 0x5b8a3a, 0x46722d]) }),
  angsana: Object.freeze({ trunkH: [5.5, 7], trunkR: 0.3, crown: [5.6, 2.6, 5.6], palette: Object.freeze([0x6e9e3c, 0x79a845, 0x86b24f]) }),
  saga: Object.freeze({ trunkH: [4.25, 5], trunkR: 0.24, crown: [3.4, 2.9, 3.4], palette: Object.freeze([0x8cb85a, 0x98c266, 0x7fae4f]) }),
  sawit: Object.freeze({ trunkH: [4.5, 7], trunkR: 0.32, crownScale: 1.4, palette: Object.freeze([0x3f8f3a, 0x357f35, 0x4a9a3e]) }),
  // Hutan kampus bergaya Street View (region UKM blok biru): batang ramping, tajuk lebar bertingkat, hijau tua.
  hutan: Object.freeze({ trunkH: [6.5, 10], trunkR: 0.2, crown: [5.2, 4.2, 5.2], palette: Object.freeze([0x3f6b2c, 0x4a7a33, 0x38612a, 0x557f38]) }),
  semak: Object.freeze({ crown: [1.1, 0.75, 1.1], palette: Object.freeze([0x7cb342, 0x8bc34a, 0x689f38]) }),
});

/** Bilangan [0, 1) deterministik dari posisi (dibulatkan 0,1 m) dan salt bulat. */
export function hash01(x, z, salt) {
  let h = Math.imul(Math.round(x * 10) | 0, 73856093) ^ Math.imul(Math.round(z * 10) | 0, 19349663) ^ Math.imul(salt, 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * Titik vegetasi → instans per kategori {x, y, z, sx, sy, sz, rot, color?}. Murni (tanpa three).
 * @param {Array<{sp: string, x: number, z: number}>} points
 * @param {(x: number, z: number) => number} heightAt
 */
export function vegetationInstances(points, heightAt) {
  const out = { trunks: [], crowns: [], sawitTrunks: [], sawitCrowns: [] };
  for (const p of points) {
    const spec = VEG_SPECIES[p.sp];
    if (!spec) continue;
    const s = 0.85 + 0.45 * hash01(p.x, p.z, 1);
    const rot = hash01(p.x, p.z, 2) * Math.PI * 2;
    const color = spec.palette[Math.floor(hash01(p.x, p.z, 3) * spec.palette.length)];
    const y = heightAt(p.x, p.z);
    if (p.sp === 'semak') {
      const [cx, cy, cz] = spec.crown;
      out.crowns.push({ x: p.x, y: y + cy * 0.55 * s, z: p.z, sx: cx * s, sy: cy * s, sz: cz * s, rot, color });
      continue;
    }
    const th = (spec.trunkH[0] + (spec.trunkH[1] - spec.trunkH[0]) * hash01(p.x, p.z, 4)) * s;
    const trunk = { x: p.x, y, z: p.z, sx: spec.trunkR * s, sy: th, sz: spec.trunkR * s, rot };
    if (p.sp === 'sawit') {
      const k = spec.crownScale * s;
      out.sawitTrunks.push(trunk);
      out.sawitCrowns.push({ x: p.x, y: y + th, z: p.z, sx: k, sy: k, sz: k, rot, color });
      continue;
    }
    const [cx, cy, cz] = spec.crown;
    out.trunks.push(trunk);
    out.crowns.push({ x: p.x, y: y + th + cy * 0.6 * s, z: p.z, sx: cx * s, sy: cy * s, sz: cz * s, rot, color });
  }
  return out;
}

/** Pelepah sawit ringan: 8 pita melengkung (48 segitiga), pangkal di origin. */
function sawitLiteCrown(fronds = 8) {
  const spine = [[0, 0], [0.9, 0.55], [1.9, 0.6], [2.8, 0.15]];
  const half = [0.12, 0.45, 0.4, 0.05];
  const pos = [];
  for (let f = 0; f < fronds; f += 1) {
    const a = (f / fronds) * Math.PI * 2 + (f % 2) * 0.2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const P = (out, up, side) => [c * out - s * side, up, s * out + c * side];
    for (let k = 0; k < spine.length - 1; k += 1) {
      const a0 = P(spine[k][0], spine[k][1], -half[k]);
      const a1 = P(spine[k][0], spine[k][1], half[k]);
      const b0 = P(spine[k + 1][0], spine[k + 1][1], -half[k + 1]);
      const b1 = P(spine[k + 1][0], spine[k + 1][1], half[k + 1]);
      pos.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const CROWN_WIND = Object.freeze({ weightMode: 'height', heightMin: -1, heightMax: 1, weightMin: 0.2, amplitude: 0.7 });
const SAWIT_WIND = Object.freeze({ weightMode: 'height', heightMin: 0, heightMax: 0.7, weightMin: 0.2, amplitude: 0.6 });

function createKit() {
  const trunkMat = new MeshLambertMaterial({ color: 0x7a5a45 });
  const crownMat = applyWind(new MeshLambertMaterial({ color: 0xffffff }), CROWN_WIND);
  const sawitMat = applyWind(new MeshLambertMaterial({ color: 0xffffff, side: DoubleSide }), SAWIT_WIND);
  sawitMat.shadowSide = DoubleSide;
  const sawitDepth = createWindDepthMaterial(SAWIT_WIND);
  sawitDepth.side = DoubleSide;
  const trunkGeo = new CylinderGeometry(0.7, 1, 1, 6, 1, true).translate(0, 0.5, 0);
  return {
    trunk: { name: 'batangPohonKampus', geometry: trunkGeo, material: trunkMat, castShadow: true },
    crown: {
      name: 'tajukPohonKampus',
      geometry: blobCluster({ count: 3, radius: 0.62, spread: 0.42, flat: 0.95, vertical: 0.18 }, createRandom(4107)),
      material: crownMat, castShadow: true, depth: createWindDepthMaterial(CROWN_WIND),
    },
    sawitTrunk: { name: 'batangSawitKampus', geometry: trunkGeo, material: trunkMat, castShadow: true },
    sawitCrown: { name: 'pelepahSawitKampus', geometry: sawitLiteCrown(), material: sawitMat, castShadow: true, depth: sawitDepth },
  };
}

function disposeKit(kit) {
  const seen = new Set();
  for (const part of Object.values(kit)) {
    for (const r of [part.geometry, part.material, part.depth]) {
      if (r && !seen.has(r)) {
        seen.add(r);
        r.dispose();
      }
    }
  }
}

/** Kit vegetasi (geometri + material bersama) per ResourceScope. Panggil di dalam withScope(scopeDistrik). */
export function createVegetationKit() {
  return currentScope().get('unri:vegetationKit', createKit, { dispose: disposeKit });
}

const _m = new Matrix4();
const _p = new Vector3();
const _s = new Vector3();
const _q = new Quaternion();
const _up = new Vector3(0, 1, 0);
const _c = new Color();

function instanced(part, list) {
  const mesh = new InstancedMesh(part.geometry, part.material, list.length);
  list.forEach((it, i) => {
    _q.setFromAxisAngle(_up, it.rot);
    mesh.setMatrixAt(i, _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.sx, it.sy, it.sz)));
    if (it.color !== undefined) mesh.setColorAt(i, _c.setHex(it.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = Boolean(part.castShadow);
  mesh.receiveShadow = true;
  if (part.depth) mesh.customDepthMaterial = part.depth;
  mesh.computeBoundingSphere();
  mesh.name = part.name;
  return mesh;
}

const CATEGORIES = Object.freeze([['trunks', 'trunk'], ['crowns', 'crown'], ['sawitTrunks', 'sawitTrunk'], ['sawitCrowns', 'sawitCrown']]);

/**
 * Instans → sel `cellSize` m: [{group, x, z}] (x, z = pusat sel, untuk visibilitas jarak). Urutan sel deterministik.
 * @throws {Error} bila kit tidak lengkap
 */
export function buildVegetationCells(inst, kit, { cellSize = VEGETATION_CELL } = {}) {
  for (const [, part] of CATEGORIES) {
    if (!kit?.[part]?.geometry || !kit[part].material) throw new Error(`kit vegetasi tidak lengkap: "${part}"`);
  }
  const cells = new Map();
  for (const [cat] of CATEGORIES) {
    for (const it of inst[cat]) {
      const k = `${Math.floor(it.x / cellSize)}_${Math.floor(it.z / cellSize)}`;
      let c = cells.get(k);
      if (!c) cells.set(k, (c = { trunks: [], crowns: [], sawitTrunks: [], sawitCrowns: [] }));
      c[cat].push(it);
    }
  }
  return [...cells.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, c]) => {
    const [cx, cz] = k.split('_').map(Number);
    const group = new Group();
    group.name = `unri:vegetasi:${k}`;
    for (const [cat, part] of CATEGORIES) if (c[cat].length) group.add(instanced(kit[part], c[cat]));
    return { group, x: (cx + 0.5) * cellSize, z: (cz + 0.5) * cellSize };
  });
}
