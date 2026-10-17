import * as THREE from 'three';
import { makeTextMaterial } from '../siteutil/textCanvas.js';
import { groupFromParts, localMatrix, placeObject } from '../siteutil/instanceParts.js';
import { roundedBox, mergeAll } from '../siteutil/rounded.js';
import { applyWind } from '../shaders/wind.js';
import { currentScope } from '../../engine/ResourceScope.js';

/**
 * Gerobak PKL gaya cozy (badan membulat, roda tebal, atap sedikit melengkung),
 * set payung bulat tebal + kursi plastik membulat, dan lapak jagung bakar.
 */
export const CART = Object.freeze({
  bodyW: 1.7, bodyH: 0.9, bodyD: 0.85, wheelR: 0.45, roofY: 2.3,
  banner: { minuman: 'ES TEH JUMBO', buah: 'BUAH POTONG SEGAR' },
  colors: { kayu: 0xa1887f, seng: 0xb0bec5, kaca: 0xe1f5fe, roda: 0x5d4037 },
});
export const UMBRELLA = Object.freeze({ radius: 1.6, height: 2.4, panels: [0xef5350, 0xfafafa, 0x42a5f5, 0xffee58], chair: [0xef5350, 0x66bb6a] });
export const FOOD_STALL = Object.freeze({ colors: { arang: 0xff3b00, jagung: 0xffd54f, meja: 0xa1887f } });
const EDGE = Object.freeze({ body: 0.08, small: 0.03, seat: 0.04 });
const ROOF_BEND_R = 4; // radius lengkung atap seng (semakin besar semakin datar)

const woodMat = () => currentScope().get('Cart:woodMat', () => new THREE.MeshLambertMaterial({ color: CART.colors.kayu }));
const zincMat = () => currentScope().get('Cart:zincMat', () => new THREE.MeshLambertMaterial({ color: CART.colors.seng, side: THREE.DoubleSide }));
const glassMat = () => currentScope().get('Cart:glassMat', () => new THREE.MeshStandardMaterial({ color: CART.colors.kaca, transparent: true, opacity: 0.3, roughness: 0.1 }));
const wheelMat = () => currentScope().get('Cart:wheelMat', () => new THREE.MeshLambertMaterial({ color: CART.colors.roda }));
const whiteMat = () => currentScope().get('Cart:whiteMat', () => new THREE.MeshLambertMaterial({ color: 0xfafafa }));
/** Kubah payung: satu material bersama (vertex color) + goyangan konstan kecil. */
const canopyMat = () => currentScope().get('Cart:canopyMat', () => applyWind(
  new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  { weightMode: 'constant', weight: 0.3, amplitude: 0.12 },
));
const thermosMat = () => currentScope().get('Cart:thermosMat', () => new THREE.MeshLambertMaterial({ color: 0x5c8dd6 }));
const stallMats = () => currentScope().get('Cart:stallMats', () => Object.freeze({
  table: new THREE.MeshLambertMaterial({ color: FOOD_STALL.colors.meja }),
  grill: new THREE.MeshLambertMaterial({ color: 0x546e7a }),
  coal: new THREE.MeshStandardMaterial({ color: 0x3a1a0a, emissive: FOOD_STALL.colors.arang, emissiveIntensity: 1.6, roughness: 0.9 }),
  corn: new THREE.MeshLambertMaterial({ color: FOOD_STALL.colors.jagung }),
}));
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

/** Kubah payung bulat tebal dengan panel warna bergantian (vertex color per sektor sudut). */
function umbrellaCanopy() {
  const geo = new THREE.SphereGeometry(UMBRELLA.radius, 16, 5, 0, Math.PI * 2, 0, Math.PI / 2.4).scale(1, 0.5, 1).toNonIndexed();
  const pos = geo.attributes.position;
  const colors = [];
  const c = new THREE.Color();
  const sectors = UMBRELLA.panels.length * 2;
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const sector = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * sectors);
    c.setHex(UMBRELLA.panels[sector % UMBRELLA.panels.length]);
    for (let k = 0; k < 3; k += 1) colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, canopyMat());
}

/** Kursi plastik membulat: dudukan tebal, sandaran, 4 kaki bulat. */
function plasticChair(color) {
  const mat = lambert(color);
  const legGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.45, 6);
  const parts = [
    { geometry: roundedBox(0.44, 0.07, 0.44, EDGE.seat), material: mat, matrix: localMatrix(0, 0.45, 0), name: 'dudukan' },
    { geometry: roundedBox(0.44, 0.42, 0.07, EDGE.seat), material: mat, matrix: localMatrix(0, 0.68, -0.19, -0.1), name: 'sandaran' },
  ];
  [[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]].forEach(([x, z]) => parts.push({
    geometry: legGeo, material: mat, matrix: localMatrix(x, 0.225, z), name: 'kaki',
  }));
  return groupFromParts(parts, 'kursiPlastik');
}

/** Payung bulat tebal warna-warni + 4 kursi plastik + meja kecil ("tenda ceper"). */
export function createUmbrellaSet(opts = {}) {
  const g = new THREE.Group();
  g.name = 'tendaCeper';
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, UMBRELLA.height, 6), zincMat());
  pole.position.y = UMBRELLA.height / 2;
  const canopy = umbrellaCanopy();
  canopy.position.y = UMBRELLA.height - 0.45;
  canopy.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), whiteMat());
  knob.position.y = UMBRELLA.height + 0.33;
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 14), whiteMat());
  table.position.y = 0.7;
  g.add(pole, canopy, knob, table);
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const chair = plasticChair(UMBRELLA.chair[i % 2]);
    chair.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9);
    chair.rotation.y = -a - Math.PI / 2;
    g.add(chair);
  }
  return placeObject(g, opts);
}

/** Arang (9 bola) dan jagung (4 kapsul) sebagai part terpisah per material. */
function grillContentParts() {
  const parts = [];
  const coalGeo = new THREE.SphereGeometry(0.05, 6, 4);
  for (let i = 0; i < 9; i += 1) {
    parts.push({ geometry: coalGeo, material: stallMats().coal, matrix: localMatrix(-0.6 + (i % 5) * 0.17, 0.99, -0.1 + Math.floor(i / 5) * 0.2), name: 'arang' });
  }
  const cornGeo = new THREE.CapsuleGeometry(0.035, 0.16, 2, 7).rotateZ(Math.PI / 2);
  for (let i = 0; i < 4; i += 1) {
    parts.push({ geometry: cornGeo, material: stallMats().corn, matrix: localMatrix(-0.45 + i * 0.14, 1.06, 0.02), name: 'jagung' });
  }
  parts.push({ geometry: roundedBox(0.5, 0.12, 0.3, EDGE.seat), material: stallMats().corn, matrix: localMatrix(0.5, 0.89, 0), name: 'tumpukanJagung' });
  return parts;
}

/** Lapak jagung bakar: meja kayu membulat, pemanggang, arang merah emissive, jagung kuning. */
export function createFoodStall(opts = {}) {
  const legGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.78, 6);
  const parts = [
    { geometry: roundedBox(1.6, 0.08, 0.7, EDGE.seat), material: stallMats().table, matrix: localMatrix(0, 0.8, 0), castShadow: true, name: 'meja' },
    { geometry: roundedBox(0.9, 0.2, 0.42, EDGE.seat), material: stallMats().grill, matrix: localMatrix(-0.25, 0.92, 0), name: 'pemanggang' },
    ...grillContentParts(),
  ];
  [[-0.75, -0.3], [-0.75, 0.3], [0.75, -0.3], [0.75, 0.3]].forEach(([x, z]) => parts.push({ geometry: legGeo, material: stallMats().table, matrix: localMatrix(x, 0.39, z), name: 'kaki' }));
  const g = groupFromParts(parts, 'lapakJagungBakar');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), makeTextMaterial(opts.label ?? 'JAGUNG BAKAR', { bg: '#ffd54f', fg: '#222222', width: 768, height: 192, side: THREE.DoubleSide }));
  sign.position.set(0, 0.6, 0.36);
  g.add(sign);
  return placeObject(g, opts);
}
