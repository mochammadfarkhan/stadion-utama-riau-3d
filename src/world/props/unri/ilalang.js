/**
 * V08 ilalang (Imperata cylindrica) di gedung mangkrak [T: FH Panam/GGM terbengkalai]: rumpun 6 bilah
 * setinggi 0,8 m dengan malai putih di ujung, warna per-vertex hijau→jerami, goyang angin (applyWind).
 * Instanced (1 draw call). scatterIlalang murni (dites).
 */
import * as THREE from 'three';
import { instanceParts } from '../../siteutil/instanceParts.js';
import { createRandom } from '../../siteutil/rng.js';
import { currentScope } from '../../../engine/ResourceScope.js';
import { applyWind } from '../../shaders/wind.js';
import { pointInPolygon, distanceToRing, ringBounds } from '../../../geo/polygon.js';

export const ILALANG = Object.freeze({ h: 0.8, r: 0.25 });
const BLADES = 6;
const BASE = new THREE.Color(0x4f6b2a);
const TIP = new THREE.Color(0xd9cf9a);
const PLUME = new THREE.Color(0xf1eee2);

function tuftGeometry() {
  const rnd = createRandom(808);
  const pos = [];
  const col = [];
  const uv = [];
  const idx = [];
  for (let b = 0; b < BLADES; b += 1) {
    const a = (b / BLADES) * Math.PI * 2 + rnd.range(-0.3, 0.3);
    const r0 = rnd.range(0.02, 0.12);
    const lean = rnd.range(0.12, ILALANG.r - 0.02);
    const h = ILALANG.h * rnd.range(0.82, 1);
    const [cx, cz] = [Math.cos(a) * r0, Math.sin(a) * r0];
    const [tx, tz] = [Math.cos(a) * lean, Math.sin(a) * lean];
    const [px, pz] = [-Math.sin(a) * 0.022, Math.cos(a) * 0.022];
    const base = pos.length / 3;
    pos.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, tx, h, tz);
    for (const c of [BASE, BASE, b % 2 ? PLUME : TIP]) col.push(c.r, c.g, c.b);
    uv.push(0, 0, 1, 0, 0.5, 1);
    idx.push(base, base + 1, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const geo = () => currentScope().get('unri:ilalang:geo', tuftGeometry);
const mat = () => currentScope().get('unri:ilalang:mat', () => applyWind(
  new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  { weightMode: 'height', heightMin: 0, heightMax: ILALANG.h, amplitude: 0.35, flutter: 0.15 },
));

export function createIlalang(positions = []) {
  return instanceParts([{ geometry: geo(), material: mat(), name: 'V08-ilalang' }], positions, 'V08-ilalang', { cellSize: 30 });
}

/**
 * Sebar rumpun di luar footprint, ≤ `band` m dari tepinya (termasuk halaman dalam bentuk U), lebih rapat
 * dekat dinding. Deterministik per seed.
 * @param {ReadonlyArray<readonly [number, number]>} ring
 * @returns {Array<{x:number, z:number, rotY:number, scale:number}>}
 */
export function scatterIlalang(ring, { count = 1200, band = 8, seed = 11, minGap = 0.3, maxTries = 200000 } = {}) {
  const rnd = createRandom(seed);
  const b = ringBounds(ring);
  const out = [];
  for (let t = 0; t < maxTries && out.length < count; t += 1) {
    const x = rnd.range(b.minX - band, b.maxX + band);
    const z = rnd.range(b.minZ - band, b.maxZ + band);
    if (pointInPolygon(x, z, ring)) continue;
    const d = distanceToRing(x, z, ring);
    if (d < minGap || d > band) continue;
    if (!rnd.chance(1 - (0.65 * d) / band)) continue;
    out.push({ x, z, rotY: rnd.range(0, Math.PI * 2), scale: rnd.range(0.75, 1.2) });
  }
  return out;
}
