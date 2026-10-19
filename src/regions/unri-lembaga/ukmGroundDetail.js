/**
 * Detail tanah area sekre UKM (foto Street View: lantai hutan berumput bertambal serasah cokelat, gundukan berlumut,
 * karung/sampah sesekali). Tiga mesh saja: lantai ter-drape (tekstur kanvas tilable bertambal + noise warna per simpul),
 * gundukan instans (hemisfer rendah), dan sampah instans (karung/bungkusan, warna per instans). Penempatan dari
 * generator `jitteredGrid` (kotak dunia → region-lokal), difilter `accept` (zona tanam + jarak aman).
 */
import * as THREE from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { hasDocument } from '../../world/props/canvasText.js';
import { createRandom } from '../../world/siteutil/rng.js';
import { mergeAll } from '../../world/siteutil/rounded.js';
import { drapePolygon } from '../../world/terrain/drape.js';
import { hash01 } from '../../world/vegetation/campusVegetation.js';
import { jitteredGrid } from './generators.js';
import { LEMBAGA_PLACEMENT, toRegion } from './placement.js';

/** Lantai hutan (kotak dunia): drape di atas tanah di bawah tajuk. */
export const UKM_LITTER_BOXES = Object.freeze([
  { minX: -136.5, maxX: -121, minZ: 974, maxZ: 1050 },
  { minX: -136.5, maxX: -125, minZ: 898, maxZ: 974 },
  { minX: -92, maxX: -47.5, minZ: 998, maxZ: 1036 },
  { minX: -66, maxX: -47.5, minZ: 960, maxZ: 998 },
  { minX: -124, maxX: -92, minZ: 1032, maxZ: 1037.5 },
].map((b) => Object.freeze(b)));

/** Pita tepi hutan tempat karung/sampah (kotak dunia, jarak kisi, peluang, seed). */
export const UKM_TRASH_BANDS = Object.freeze([
  { box: { minX: -92, maxX: -84, minZ: 1000, maxZ: 1033 }, spacing: 7, fill: 0.7, seed: 31 },
  { box: { minX: -132.5, maxX: -124.5, minZ: 984, maxZ: 1040 }, spacing: 11, fill: 0.7, seed: 32 },
  { box: { minX: -124, maxX: -92, minZ: 1031.5, maxZ: 1036.5 }, spacing: 9, fill: 0.5, seed: 33 },
].map((b) => Object.freeze({ ...b, box: Object.freeze(b.box) })));

const TILE_M = 16;
const LITTER_BASE = '#8c7a52';

const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

function drawBlob(ctx, size, x, y, rx, ry, rot, color) {
  for (const ox of [-size, 0, size]) {
    for (const oy of [-size, 0, size]) {
      ctx.save();
      ctx.translate(x + ox, y + oy);
      ctx.rotate(rot);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, rgba(color, 1));
      g.addColorStop(0.5, rgba(color, 0.85));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/** Kanvas 512 px = 16 m: bidang cokelat serasah + tambal rumput + daun kering + ranting, tilable (blob digambar berbungkus). */
function litterTexture() {
  if (!hasDocument()) return null;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const rnd = createRandom(2025);
  ctx.fillStyle = LITTER_BASE;
  ctx.fillRect(0, 0, size, size);
  const patch = (n, colors, rMin, rMax, alpha) => {
    for (let i = 0; i < n; i += 1) {
      ctx.globalAlpha = alpha;
      drawBlob(ctx, size, rnd.next() * size, rnd.next() * size, rMin + rnd.next() * (rMax - rMin), rMin + rnd.next() * (rMax - rMin) * 0.7, rnd.next() * 3, colors[Math.floor(rnd.next() * colors.length)]);
    }
    ctx.globalAlpha = 1;
  };
  patch(30, ['#7a9a46', '#6a8a3c', '#88a650'], 30, 78, 0.85); // tambal rumput
  patch(20, ['#745f3d', '#a08a58', '#6a583a'], 24, 62, 0.75); // serasah gelap/terang
  patch(10, ['#587a34'], 30, 60, 0.5);
  const leaf = ['#9a8157', '#6a5a3c', '#8c7549', '#a88b5c', '#b79a52', '#5c4c34', '#7a8a48'];
  for (let i = 0; i < 1900; i += 1) {
    ctx.fillStyle = leaf[Math.floor(rnd.next() * leaf.length)];
    ctx.save();
    ctx.translate(rnd.next() * size, rnd.next() * size);
    ctx.rotate(rnd.next() * Math.PI);
    ctx.fillRect(0, 0, 3 + rnd.next() * 8, 1 + rnd.next() * 3);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(70,52,34,0.55)'; // ranting
  for (let i = 0; i < 34; i += 1) {
    ctx.lineWidth = 1 + rnd.next();
    const x = rnd.next() * size;
    const y = rnd.next() * size;
    const a = rnd.next() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * (14 + rnd.next() * 26), y + Math.sin(a) * (14 + rnd.next() * 26));
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / TILE_M, 1 / TILE_M); // UV drape = meter dunia
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function groundKit() {
  const map = litterTexture();
  const floor = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, vertexColors: true, ...(map ? { map } : {}),
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  floor.name = 'lantaiHutanUkm';
  const mound = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mound.name = 'gundukanUkm';
  const trash = new THREE.MeshLambertMaterial({ color: 0xffffff });
  trash.name = 'sampahUkm';
  return { map, floor, mound, trash };
}

const kitOf = () => currentScope().get('ukm:ground-detail', groundKit);

/** Noise nilai halus [0, 1) dari hash01 pada kisi `cell` m (bilinear). */
function valueNoise(x, z, cell, salt) {
  const gx = x / cell;
  const gz = z / cell;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const fx = gx - x0;
  const fz = gz - z0;
  const sm = (t) => t * t * (3 - 2 * t);
  const h = (i, j) => hash01(i * cell, j * cell, salt);
  const a = h(x0, z0) + (h(x0 + 1, z0) - h(x0, z0)) * sm(fx);
  const b = h(x0, z0 + 1) + (h(x0 + 1, z0 + 1) - h(x0, z0 + 1)) * sm(fx);
  return a + (b - a) * sm(fz);
}

/** Warna simpul: nada gelap/terang bergelombang ±14% (tambal besar) + sedikit pergeseran hijau-cokelat. */
function tintAttribute(geo) {
  const p = geo.getAttribute('position');
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const v = 0.98 + 0.26 * valueNoise(x, z, 7, 5);
    const g = valueNoise(x, z, 11, 9);
    col[i * 3] = v * (1.04 - 0.1 * g);
    col[i * 3 + 1] = v * (0.96 + 0.1 * g);
    col[i * 3 + 2] = v * 0.94;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Lantai hutan ter-drape (kotak digabung, 1 draw call); `heightAt` region-lokal. */
export function litterFloorMesh(heightAt, boxes = UKM_LITTER_BOXES) {
  const field = { heightAt: (x, z) => heightAt(x - LEMBAGA_PLACEMENT.x, z - LEMBAGA_PLACEMENT.z) };
  const geos = boxes.map((b) => {
    const ring = [[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ]];
    const g = drapePolygon([ring], field, { lift: 0.02 }).translate(-LEMBAGA_PLACEMENT.x, 0, -LEMBAGA_PLACEMENT.z);
    return tintAttribute(g);
  });
  const mesh = new THREE.Mesh(mergeAll(geos), kitOf().floor);
  mesh.name = 'ukm-serasah';
  mesh.receiveShadow = true;
  return mesh;
}

const inLitter = (x, z) => UKM_LITTER_BOXES.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);

/** Titik gundukan (dunia): kisi acak di lantai hutan, hanya di tempat boleh ditanami (jauh dari jalan/gedung). */
export function moundPoints(plantable, { spacing = 10, fill = 0.4, seed = 21 } = {}) {
  return UKM_LITTER_BOXES.flatMap((box, k) => jitteredGrid({
    box, spacing, seed: seed + k,
    accept: (x, z, rnd) => inLitter(x, z) && plantable(x, z) && rnd.chance(fill),
  }));
}

/** Titik sampah (dunia), 1–3 buah per lokasi: lokasi dari kisi tiap pita tepi hutan. */
export function trashPoints(plantable, bands = UKM_TRASH_BANDS) {
  const out = [];
  for (const band of bands) {
    const spots = jitteredGrid({ box: band.box, spacing: band.spacing, seed: band.seed, accept: (x, z, rnd) => plantable(x, z) && rnd.chance(band.fill) });
    spots.forEach(([x, z], i) => {
      const n = 1 + Math.floor(hash01(x, z, 7) * 3);
      for (let k = 0; k < n; k += 1) out.push([x + (hash01(x, z, 11 + k) - 0.5) * 1.6, z + (hash01(x, z, 17 + k) - 0.5) * 1.6, i + k]);
    });
  }
  return out;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();

function instances(geometry, material, list, name, cast = false) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(list.length, 1));
  list.forEach((it, i) => {
    _q.setFromEuler(_e.set(it.tilt ?? 0, it.rot, 0));
    mesh.setMatrixAt(i, _m.compose(new THREE.Vector3(it.x, it.y, it.z), _q, new THREE.Vector3(it.sx, it.sy, it.sz)));
    mesh.setColorAt(i, _c.setHex(it.color));
  });
  mesh.count = list.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  mesh.name = name;
  return mesh;
}

const MOUND_COLORS = Object.freeze([0x6f8a45, 0x5d7a3a, 0x7d7a4a, 0x6a6c3e]);
const TRASH_COLORS = Object.freeze([0xdcd9cc, 0xc4c1b2, 0x8fa5bd, 0xcdb88c, 0xa8473a, 0x9aa09a]);

/** Gundukan berlumut (1 InstancedMesh): hemisfer rendah, jari-jari 0,9–2,2 m, tinggi 0,18–0,38 m, dasar terbenam. */
export function moundMesh(points, heightAt) {
  const geo = currentScope().get('ukm:mound-geo', () => new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2));
  const list = points.map(([wx, wz]) => {
    const [x, z] = toRegion(wx, wz);
    const r = 0.9 + 1.3 * hash01(wx, wz, 31);
    return { x, y: heightAt(x, z) - 0.04, z, rot: hash01(wx, wz, 32) * Math.PI * 2, sx: r, sy: 0.18 + 0.2 * hash01(wx, wz, 33), sz: r * (0.75 + 0.3 * hash01(wx, wz, 34)), color: MOUND_COLORS[Math.floor(hash01(wx, wz, 35) * MOUND_COLORS.length)] };
  });
  return instances(geo, kitOf().mound, list, 'ukm-gundukan');
}

/** Karung/bungkusan sampah (1 InstancedMesh): ellipsoid pipih; warna plastik/karung per instans. */
export function trashMesh(points, heightAt) {
  const geo = currentScope().get('ukm:trash-geo', () => new THREE.SphereGeometry(0.5, 7, 5).scale(1.2, 0.5, 0.8));
  const list = points.map(([wx, wz, k]) => {
    const [x, z] = toRegion(wx, wz);
    const s = 0.55 + 0.7 * hash01(wx, wz, 41 + k);
    return { x, y: heightAt(x, z) + 0.06 * s, z, rot: hash01(wx, wz, 42 + k) * Math.PI * 2, tilt: (hash01(wx, wz, 43) - 0.5) * 0.4, sx: s, sy: s, sz: s, color: TRASH_COLORS[Math.floor(hash01(wx, wz, 44 + k) * TRASH_COLORS.length)] };
  });
  return instances(geo, kitOf().trash, list, 'ukm-sampah');
}
