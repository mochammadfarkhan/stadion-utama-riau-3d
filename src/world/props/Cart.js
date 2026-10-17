import * as THREE from 'three';
import { makeTextMaterial } from '../siteutil/textCanvas.js';
import { groupFromParts, localMatrix, placeObject } from '../siteutil/instanceParts.js';
import { roundedBox, mergeAll } from '../siteutil/rounded.js';
import { currentScope } from '../../engine/ResourceScope.js';

/**
 * Gerobak PKL gaya cozy (badan membulat, roda tebal, atap sedikit melengkung).
 */
export const CART = Object.freeze({
  bodyW: 1.7, bodyH: 0.9, bodyD: 0.85, wheelR: 0.45, roofY: 2.3,
  banner: { minuman: 'ES TEH JUMBO', buah: 'BUAH POTONG SEGAR' },
  colors: { kayu: 0xa1887f, seng: 0xb0bec5, kaca: 0xe1f5fe, roda: 0x5d4037 },
});
const EDGE = Object.freeze({ body: 0.08, small: 0.03, seat: 0.04 });
const ROOF_BEND_R = 4; // radius lengkung atap seng (semakin besar semakin datar)

const woodMat = () => currentScope().get('Cart:woodMat', () => new THREE.MeshLambertMaterial({ color: CART.colors.kayu }));
const zincMat = () => currentScope().get('Cart:zincMat', () => new THREE.MeshLambertMaterial({ color: CART.colors.seng, side: THREE.DoubleSide }));
const glassMat = () => currentScope().get('Cart:glassMat', () => new THREE.MeshStandardMaterial({ color: CART.colors.kaca, transparent: true, opacity: 0.3, roughness: 0.1 }));
const wheelMat = () => currentScope().get('Cart:wheelMat', () => new THREE.MeshLambertMaterial({ color: CART.colors.roda }));
const thermosMat = () => currentScope().get('Cart:thermosMat', () => new THREE.MeshLambertMaterial({ color: 0x5c8dd6 }));
/** Material Lambert di-cache per warna (per ResourceScope aktif) agar banyak lapak berbagi material. */
function lambert(color) {
  return currentScope().get(`Cart:lambert:${color}`, () => new THREE.MeshLambertMaterial({ color }));
}

/** Roda tebal: silinder + bola kecil sebagai poros, sumbu Z. */
function thickWheel(r, width) {
  const tire = new THREE.CylinderGeometry(r, r, width, 14).rotateX(Math.PI / 2);
  const hub = new THREE.SphereGeometry(r * 0.35, 6, 4).scale(1, 1, width * 1.6 / r);
  return mergeAll([tire, hub]);
}

/** Atap seng sedikit melengkung: cangkang silinder tipis dengan sumbu X. */
function curvedRoof(w, d) {
  const theta = d / ROOF_BEND_R;
  return new THREE.CylinderGeometry(ROOF_BEND_R, ROOF_BEND_R, w, 10, 1, true, -theta / 2, theta)
    .rotateZ(Math.PI / 2)
    .translate(0, -ROOF_BEND_R, 0);
}

/** Rangka gerobak: badan kayu membulat, dua roda tebal, gagang, etalase kaca, atap melengkung + tiang. */
function cartFrameParts() {
  const { bodyW, bodyH, bodyD, wheelR, roofY } = CART;
  const parts = [
    { geometry: roundedBox(bodyW, bodyH, bodyD, EDGE.body), material: woodMat(), matrix: localMatrix(0, wheelR + bodyH / 2 - 0.1, 0), castShadow: true, name: 'badan' },
    { geometry: roundedBox(bodyW - 0.2, 0.7, bodyD - 0.15, EDGE.body), material: glassMat(), matrix: localMatrix(0, wheelR + bodyH + 0.25, 0), name: 'etalase' },
    { geometry: curvedRoof(bodyW + 0.5, bodyD + 0.5), material: zincMat(), matrix: localMatrix(0, roofY + 0.08, 0), castShadow: true, name: 'atapSeng' },
  ];
  const wheelGeo = thickWheel(wheelR, 0.14);
  [-1, 1].forEach((s) => parts.push({ geometry: wheelGeo, material: wheelMat(), matrix: localMatrix(-0.2, wheelR, s * (bodyD / 2 + 0.09)), name: 'roda' }));
  const handleGeo = new THREE.CapsuleGeometry(0.04, 0.92, 2, 6).rotateZ(Math.PI / 2);
  [-1, 1].forEach((s) => parts.push({ geometry: handleGeo, material: woodMat(), matrix: localMatrix(-bodyW / 2 - 0.4, wheelR + 0.6, s * 0.3), name: 'gagang' }));
  const postGeo = new THREE.CylinderGeometry(0.035, 0.035, roofY - wheelR - bodyH + 0.1, 6);
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => parts.push({
    geometry: postGeo, material: woodMat(), matrix: localMatrix(sx * (bodyW / 2 - 0.1), (roofY + wheelR + bodyH - 0.1) / 2, sz * (bodyD / 2 - 0.1)), name: 'tiangAtap',
  }));
  return parts;
}

/** Isi gerobak minuman: botol kapsul, termos gemuk, tumpukan gelas. */
function drinkContentParts() {
  const y = CART.wheelR + CART.bodyH - 0.1;
  const bottle = new THREE.CapsuleGeometry(0.055, 0.18, 2, 6);
  const parts = [0xa1887f, 0xffb74d, 0x64b5f6, 0x81c784, 0xef5350].map((c, i) => ({
    geometry: bottle, material: lambert(c), matrix: localMatrix(-0.6 + i * 0.22, y + 0.14, 0.2), name: 'botol',
  }));
  parts.push({ geometry: new THREE.CapsuleGeometry(0.15, 0.28, 2, 10), material: thermosMat(), matrix: localMatrix(0.5, y + 0.25, -0.15), name: 'termos' });
  parts.push({ geometry: new THREE.CylinderGeometry(0.06, 0.05, 0.4, 8), material: glassMat(), matrix: localMatrix(-0.1, y + 0.2, -0.2), name: 'gelasTumpuk' });
  return parts;
}

/** Isi gerobak buah: potongan buah warna-warni membulat. */
function fruitContentParts() {
  const y = CART.wheelR + CART.bodyH - 0.1;
  const mat = lambert;
  return [
    { geometry: roundedBox(0.35, 0.14, 0.2, EDGE.seat), material: mat(0xffb74d), matrix: localMatrix(-0.55, y + 0.07, 0.15), name: 'pepaya' },
    { geometry: new THREE.SphereGeometry(0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), material: mat(0xef5350), matrix: localMatrix(-0.1, y, 0.15), name: 'semangka' },
    { geometry: new THREE.SphereGeometry(0.15, 10, 8), material: mat(0xaed581), matrix: localMatrix(0.3, y + 0.15, -0.15), name: 'melon' },
    { geometry: new THREE.CapsuleGeometry(0.11, 0.14, 2, 8), material: mat(0xffd54f), matrix: localMatrix(0.6, y + 0.15, 0.1), name: 'nanas' },
    { geometry: roundedBox(0.3, 0.12, 0.18, EDGE.seat), material: mat(0xf48fb1), matrix: localMatrix(0.1, y + 0.06, -0.25), name: 'jambu' },
  ];
}

/** Gerobak PKL. opts: { kind: 'minuman'|'buah', x, z, rotY, label } */
export function createCart(opts = {}) {
  const kind = opts.kind === 'buah' ? 'buah' : 'minuman';
  const content = kind === 'buah' ? fruitContentParts() : drinkContentParts();
  const g = groupFromParts([...cartFrameParts(), ...content], `gerobak-${kind}`);
  const label = opts.label ?? CART.banner[kind];
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(CART.bodyW + 0.3, 0.38),
    makeTextMaterial(label, { bg: kind === 'buah' ? '#66bb6a' : '#ef5350', fg: '#ffffff', width: 1024, height: 192, side: THREE.DoubleSide }),
  );
  banner.position.set(0, CART.roofY - 0.25, CART.bodyD / 2 + 0.3);
  banner.name = 'spanduk';
  g.add(banner);
  g.userData.kind = kind;
  return placeObject(g, opts);
}
