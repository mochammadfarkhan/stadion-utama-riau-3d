/**
 * Gedung tile di dalam tapak landmark hero (PART_RECIPES[id].site): mesh gedung tile sudah dilebur per tile
 * saat bake, jadi gedung yang seluruhnya berada di tapak "ditenggelamkan" saat tile dimuat: vertex-nya di
 * `buildings_walls` / `buildings_roofs` dipindah ke y −200 (di bawah tanah). Posisi tile GLB = Int16
 * ternormalisasi (KHR_mesh_quantization) dengan skala node ±270 m, jadi −200 biasanya muat; bila tidak muat,
 * vertex ditenggelamkan sedalam yang muat dan x/z-nya dilebur ke satu titik (segitiga berluas nol).
 * Bounding box/sphere sengaja TIDAK dihitung ulang (vertex tenggelam akan membesarkan bola culling/bayangan).
 */
import * as THREE from 'three';
import { pointInPolygon, distanceToRing, polygonCentroid, ringBounds } from '../geo/polygon.js';

export const SINK_Y = -200;
const SINK_MESHES = new Set(['buildings_walls', 'buildings_roofs']);
/** Bila kedalaman yang muat di atas batas ini, x/z ikut dilebur supaya segitiga tidak tampak di tanah. */
const SINK_MIN_DEPTH = -1;
const TOUCH = 1.5; // m: jarak cincin yang dianggap menempel (lebih besar dari pad sinkMask)

/** Murni: indeks gedung yang SELURUH titik cincinnya di tapak (titik boleh `tol` m di luar tepi, diuji ke arah titik berat). */
export function buildingsInSite(buildings, siteHit, tol = 1.5) {
  const out = new Set();
  (buildings ?? []).forEach((b, i) => {
    const ring = b?.ring;
    if (!Array.isArray(ring) || ring.length < 3) return;
    const c = polygonCentroid(ring);
    const ok = ring.every(([x, z]) => {
      if (siteHit(x, z)) return true;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < 1e-9) return false;
      const k = Math.min(tol, d) / d;
      return siteHit(x + (c.x - x) * k, z + (c.z - z) * k);
    });
    if (ok) out.add(i);
  });
  // Gedung yang MENEMPEL pada gedung lain yang tidak ikut tenggelam dibiarkan: vertex dinding bersama akan ikut tertarik
  // ke bawah tanah dan merusak tetangganya (terlihat di An-Nur: jejak masjid lama menempel ke kompleks di sekelilingnya).
  for (const i of [...out]) {
    const touches = buildings.some((o, j) => j !== i && !out.has(j) && Array.isArray(o?.ring) && o.ring.length >= 3
      && buildings[i].ring.some(([x, z]) => distanceToRing(x, z, o.ring) <= TOUCH || pointInPolygon(x, z, o.ring)));
    if (touches) out.delete(i);
  }
  return out;
}

/** Murni: indeks vertex (posisi DUNIA x,y,z berselang `itemSize`) yang (x, z)-nya di salah satu cincin, cincin diperbesar `pad`. */
export function sinkMask(positions, itemSize, rings, { pad = 0.6 } = {}) {
  const boxes = rings.map((r) => ({ ring: r, b: ringBounds(r) }));
  const out = [];
  const n = Math.floor(positions.length / itemSize);
  for (let i = 0; i < n; i += 1) {
    const x = positions[i * itemSize];
    const z = positions[i * itemSize + 2];
    for (const { ring, b } of boxes) {
      if (x < b.minX - pad || x > b.maxX + pad || z < b.minZ - pad || z > b.maxZ + pad) continue;
      if (pointInPolygon(x, z, ring) || distanceToRing(x, z, ring) <= pad) {
        out.push(i);
        break;
      }
    }
  }
  return out;
}

/** Salinan dangkal `tile` tanpa gedung tapak (untuk collider dan generator atap); objek asli tidak dimutasi. */
export function withoutSiteBuildings(tile, siteHit) {
  const hit = buildingsInSite(tile?.buildings, siteHit);
  if (!hit.size) return tile;
  return { ...tile, buildings: tile.buildings.filter((_, i) => !hit.has(i)) };
}

/** Batas bawah nilai lokal atribut (ternormalisasi signed −1, unsigned 0; float tak terbatas). */
function localFloor(attr) {
  if (!attr.normalized) return -Infinity;
  const a = attr.array;
  return a instanceof Uint8Array || a instanceof Uint16Array || a instanceof Uint32Array ? 0 : -1;
}

const _v = new THREE.Vector3();
const _inv = new THREE.Matrix4();

function sinkMesh(mesh, rings) {
  const pos = mesh.geometry?.attributes?.position;
  if (!pos) return 0;
  const m = mesh.matrixWorld;
  const world = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    _v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
    world[i * 3] = _v.x;
    world[i * 3 + 1] = _v.y;
    world[i * 3 + 2] = _v.z;
  }
  const hit = sinkMask(world, 3, rings);
  if (!hit.length) return 0;
  _inv.copy(m).invert();
  const lo = localFloor(pos);
  const hi = pos.normalized ? 1 : Infinity;
  let collapse = null; // titik lokal (x, z) bersama bila −200 tidak muat
  for (const i of hit) {
    _v.set(world[i * 3], SINK_Y, world[i * 3 + 2]).applyMatrix4(_inv);
    const y = Math.min(hi, Math.max(lo, _v.y));
    const wy = _v.set(pos.getX(i), y, pos.getZ(i)).applyMatrix4(m).y;
    if (wy > SINK_MIN_DEPTH) collapse ??= [pos.getX(i), pos.getZ(i)];
    pos.setY(i, y);
  }
  if (collapse) for (const i of hit) { pos.setX(i, collapse[0]); pos.setZ(i, collapse[1]); }
  if (pos.isInterleavedBufferAttribute) pos.data.needsUpdate = true;
  else pos.needsUpdate = true;
  return hit.length;
}

/**
 * Tenggelamkan gedung tile yang seluruhnya di tapak. `root` = akar tile (boleh belum punya induk: matriksnya
 * dianggap dunia, sebagaimana grup kota di titik asal).
 * @returns {{buildings: number, vertices: number}}
 */
export function clearSiteBuildings(root, tile, siteHit) {
  const hit = buildingsInSite(tile?.buildings, siteHit);
  if (!hit.size) return { buildings: 0, vertices: 0 };
  const rings = [...hit].map((i) => tile.buildings[i].ring);
  root.updateWorldMatrix(true, true);
  let vertices = 0;
  root.traverse((o) => {
    if (o.isMesh && SINK_MESHES.has(o.name)) vertices += sinkMesh(o, rings);
  });
  return { buildings: hit.size, vertices };
}
