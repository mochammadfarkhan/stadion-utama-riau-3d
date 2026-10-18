/**
 * Proxy region (spec §4.3): siluet murah saat region tidak terpasang — SATU mesh vertexColors (1 draw call):
 * massa + atap sekretariat, tribun + atap VIP, Student Center, rumput & lintasan stadion mini. Rusunawa/FH
 * tidak perlu (dirender distrik). Placement diterapkan di sini (idempoten bila manager juga menerapkannya).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ringBounds } from '../../geo/polygon.js';
import { stadiumShape, stadiumPath, flatShapeGeometry } from '../../world/stadium/ovalMath.js';
import { boxAt, paint } from '../../world/props/unri/geom.js';
import { LEMBAGA_PLACEMENT, SEKRE_FRAME, SEKRE_SIZE, PITCH_FRAME, TRIBUN, FOOTPRINTS } from './placement.js';
import { TRACK_MINI } from './stadionMini.js';

export const PROXY_NAME = 'proxy:unri-lembaga';
const COLOR = Object.freeze({ dinding: 0xe8dcc0, seng: 0x8e9aa6, beton: 0xbdb8ad, putih: 0xeeeeea, rumput: 0x74a040, lintasan: 0xa65a3c });

const framed = (geo, f, y) => geo.rotateY(f.yaw).translate(f.x, y, f.z);

/**
 * @param {{terrain?:{heightAt(x:number, z:number):number}, heightAtLocal?:(lx:number, lz:number)=>number}} [ctx]
 *   M0 memberi proxy ctx {scope, placement, terrain}; tinggi dari terrain dunia (yaw region 0 → dunia = lokal + origin).
 */
export function buildLembagaProxy(ctx = {}) {
  const h = typeof ctx.heightAtLocal === 'function'
    ? (x, z) => ctx.heightAtLocal(x, z)
    : (x, z) => (typeof ctx.terrain?.heightAt === 'function' ? ctx.terrain.heightAt(x + LEMBAGA_PLACEMENT.x, z + LEMBAGA_PLACEMENT.z) : 0);
  const ys = h(SEKRE_FRAME.x, SEKRE_FRAME.z);
  const yp = h(PITCH_FRAME.x, PITCH_FRAME.z);
  const yt = h(TRIBUN.frame.x, TRIBUN.frame.z);
  const sc = ringBounds(FOOTPRINTS.studentCenter);
  const ysc = h((sc.minX + sc.maxX) / 2, (sc.minZ + sc.maxZ) / 2);
  const outer = TRACK_MINI.kerb + TRACK_MINI.lanes * TRACK_MINI.laneW;
  const geos = [
    framed(paint(boxAt(SEKRE_SIZE.width, 3.75, SEKRE_SIZE.length), COLOR.dinding), SEKRE_FRAME, ys),
    framed(paint(boxAt(SEKRE_SIZE.width + 1.6, 1.4, SEKRE_SIZE.length + 1.2, 0, 3.75), COLOR.seng), SEKRE_FRAME, ys),
    framed(paint(boxAt(TRIBUN.depth, 7.0, TRIBUN.length), COLOR.beton), TRIBUN.frame, yt),
    framed(paint(boxAt(22, 0.4, 54, -5, 10.4, (TRIBUN.vip.z0 + TRIBUN.vip.z1) / 2), COLOR.seng), TRIBUN.frame, yt),
    paint(boxAt(sc.maxX - sc.minX, 13, sc.maxZ - sc.minZ, (sc.minX + sc.maxX) / 2, ysc, (sc.minZ + sc.maxZ) / 2), COLOR.putih),
    paint(boxAt(sc.maxX - sc.minX + 5, 0.6, sc.maxZ - sc.minZ + 5, (sc.minX + sc.maxX) / 2, ysc + 13, (sc.minZ + sc.maxZ) / 2), COLOR.seng),
    framed(paint(flatShapeGeometry(stadiumShape(TRACK_MINI.halfStraight, TRACK_MINI.kerb), [], 24), COLOR.rumput), PITCH_FRAME, yp + 0.08),
    framed(paint(flatShapeGeometry(stadiumShape(TRACK_MINI.halfStraight, outer), [stadiumPath(TRACK_MINI.halfStraight, TRACK_MINI.kerb)], 24), COLOR.lintasan), PITCH_FRAME, yp + 0.07),
  ];
  const geometry = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.name = 'proxyLembaga';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = PROXY_NAME;
  const group = new THREE.Group();
  group.name = PROXY_NAME;
  group.position.set(LEMBAGA_PLACEMENT.x, 0, LEMBAGA_PLACEMENT.z);
  group.rotation.y = LEMBAGA_PLACEMENT.yaw;
  group.add(mesh);
  let disposed = false;
  return {
    group,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
