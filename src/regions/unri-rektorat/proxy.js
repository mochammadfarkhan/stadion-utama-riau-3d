// src/regions/unri-rektorat/proxy.js
/**
 * Proxy region unri-rektorat (spec §4.3): siluet murah saat region TIDAK terpasang, 7 draw call (≤ 8):
 * putih (massa Rektorat + perpustakaan), pita jendela gelap, parapet gelap, kaca biru blok tengah, atap
 * perpustakaan, kanopi merah, tajuk akasia. y dari terrain saat proxy dibangun (chunk jauh belum termuat
 * → 0; selisih ±2 m tak terlihat di > 700 m).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createResourceScope, withScope } from '../../engine/ResourceScope.js';
import { disposeTree } from '../../engine/disposeTree.js';
import { REKTORAT_MASSA, PERPUS_MASSA } from './site.data.js';
import { LAYOUT } from './layout.js';
import { REKTORAT_PLACEMENT as P, REKTORAT_ID } from './placement.js';
import { createSiteEnv } from './env.js';
import { ROOF_Y, LEVEL, floorY } from './rektorat.js';

export const PROXY_MAX_DRAWS = 8;

const boxGeo = ([x0, x1], [y0, y1], [z0, z1]) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const pyramidGeo = (cx, cz, w, d, y, h) => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0).scale(w, h, d).translate(cx, y, cz);
const boundsOf = (ring) => {
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  return [[Math.min(...xs), Math.max(...xs)], [Math.min(...zs), Math.max(...zs)]];
};

function merged(geos, color, name) {
  const g = mergeGeometries(geos, false);
  geos.forEach((x) => x.dispose());
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
  mesh.name = name;
  return mesh;
}

function buildProxyGroup(env) {
  const { slab: S, tengah: T, kanopi: K } = REKTORAT_MASSA;
  const y0 = env.hAt(0, 0);
  const yp = env.hAt(-113, -62);
  const putih = [
    boxGeo([S.x0, S.x1], [y0, y0 + ROOF_Y], [S.z0, S.z1]),
    boxGeo([T.x0 - 0.3, T.x1], [y0, y0 + ROOF_Y + LEVEL.atik], [T.z0, T.z1]),
    ...PERPUS_MASSA.kuadran.map((r) => { const [xr, zr] = boundsOf(r); return boxGeo(xr, [yp, yp + 7.6], zr); }),
    ...PERPUS_MASSA.penghubung.map((r) => boxGeo([r.x0, r.x1], [yp, yp + 7.6], [r.z0, r.z1])),
  ];
  const pita = Array.from({ length: LEVEL.jumlah }, (_, k) => {
    const y = y0 + floorY(k) + 0.9;
    return boxGeo([S.x0 - 0.05, S.x1 + 0.05], [y, y + (k === 0 ? 2.6 : 2.1)], [S.z0 - 0.05, S.z1 + 0.05]);
  });
  const parapet = [boxGeo([S.x0 - 0.05, S.x1 + 0.05], [y0 + ROOF_Y, y0 + ROOF_Y + LEVEL.parapet], [S.z0 - 0.05, S.z1 + 0.05])];
  const kaca = [boxGeo([T.x1, T.x1 + 0.2], [y0 + floorY(1), y0 + ROOF_Y], [T.z0 + 0.6, T.z1 - 0.6])];
  const atapPerpus = PERPUS_MASSA.kuadran.map((r) => {
    const [[x0, x1], [z0, z1]] = boundsOf(r);
    return pyramidGeo((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 1.6, z1 - z0 + 1.6, yp + 7.6, 3.0);
  });
  const kanopi = [pyramidGeo((K.x0 + K.x1) / 2, 0, K.x1 - K.x0 + 1.6, K.z1 - K.z0 + 1.6, y0 + 3.75, 1.6)];
  const pohon = LAYOUT.akasia.map((p) => new THREE.ConeGeometry(2.0 * p.scale, 9 * p.scale, 6).translate(p.x, env.hAt(p.x, p.z) + 13 * p.scale, p.z));
  const group = new THREE.Group();
  group.name = `proxy:${REKTORAT_ID}`;
  group.add(
    merged(putih, 0xf1efe9, 'proxyPutih'),
    merged(pita, 0x26364a, 'proxyPita'),
    merged(parapet, 0x3d4148, 'proxyParapet'),
    merged(kaca, 0x3b78b8, 'proxyKacaBiru'),
    merged(atapPerpus, 0x7d8a96, 'proxyAtapPerpus'),
    merged(kanopi, 0xb3282d, 'proxyKanopi'),
    merged(pohon, 0x4d6a33, 'proxyPohon'),
  );
  return group;
}

/**
 * @param {{scope?: object, terrain?: object, heightAtLocal?: Function}} [ctx]
 * @returns {{group: THREE.Group, dispose(): void}}
 */
export function createRektoratProxy(ctx = {}) {
  const ownScope = !ctx.scope;
  const scope = ctx.scope ?? createResourceScope(`proxy:${REKTORAT_ID}`);
  const env = createSiteEnv(ctx);
  const group = withScope(scope, () => buildProxyGroup(env));
  group.position.set(P.x, 0, P.z); // idempoten dengan applyPlacement manager (yaw 0)
  return {
    group,
    dispose() {
      group.removeFromParent();
      disposeTree(group, { scope });
      if (ownScope) scope.dispose();
    },
  };
}
