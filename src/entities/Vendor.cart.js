/**
 * Gerobak fallback sederhana untuk pedagang, dipakai bila
 * `world/props/Cart.js` (ditulis agen lain) belum tersedia saat runtime.
 * Frame lokal: pedagang mendorong dari z negatif, gerobak menghadap +Z.
 */
import * as THREE from 'three';
import { matFor } from './util.js';

const BODY = { w: 1.0, h: 0.75, d: 1.4 };
const WHEEL_R = 0.28;

/** Payung bulat di atas gerobak. */
function createUmbrella(color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 6), matFor(0x888888));
  pole.position.y = 0.75;
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.3, 10, 1, false), matFor(color, { side: THREE.DoubleSide }));
  canopy.position.y = 1.55;
  g.add(pole, canopy);
  return g;
}

/** Barang dagangan di atas meja: kotak es / tumpukan buah. */
function createGoods(kind) {
  const g = new THREE.Group();
  if (kind === 'buah') {
    const colors = [0xff7043, 0xffee58, 0x66bb6a, 0xef5350];
    colors.forEach((c, i) => {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), matFor(c));
      fruit.position.set(-0.3 + i * 0.2, 0.12, 0.1 - (i % 2) * 0.3);
      g.add(fruit);
    });
    return g;
  }
  const icebox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), matFor(0x1e88e5));
  icebox.position.set(0.15, 0.2, 0);
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 10), matFor(0xffb300));
  jar.position.set(-0.3, 0.18, 0.2);
  g.add(icebox, jar);
  return g;
}

/**
 * @param {{kind?:'minuman'|'buah', color?:number}} opts
 * @returns {THREE.Group}
 */
export function createFallbackCart(opts = {}) {
  const { kind = 'minuman', color = kind === 'buah' ? 0x2e7d32 : 0x1565c0 } = opts;
  const cart = new THREE.Group();
  cart.name = `cart-${kind}`;
  const box = new THREE.Mesh(new THREE.BoxGeometry(BODY.w, BODY.h, BODY.d), matFor(color));
  box.position.y = WHEEL_R + BODY.h / 2;
  box.castShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(BODY.w + 0.1, 0.04, BODY.d + 0.1), matFor(0xd7ccc8));
  top.position.y = WHEEL_R + BODY.h + 0.02;
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.06, 12);
  const wheelMat = matFor(0x222222);
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * (BODY.w / 2 + 0.04), WHEEL_R, 0.2);
    cart.add(w);
  }
  const handleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6);
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(handleGeo, matFor(0x8d6e63));
    h.rotation.x = Math.PI / 2 - 0.5;
    h.position.set(sx * 0.4, WHEEL_R + BODY.h - 0.1, -BODY.d / 2 - 0.25);
    cart.add(h);
  }
  const goods = createGoods(kind);
  goods.position.y = top.position.y + 0.02;
  cart.add(box, top, goods, createUmbrella(kind === 'buah' ? 0xffb300 : 0xe53935));
  return cart;
}
