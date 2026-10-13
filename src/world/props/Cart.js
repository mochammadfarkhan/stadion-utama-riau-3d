import * as THREE from 'three';
import { makeTextMaterial } from '../siteutil/textCanvas.js';
import { groupFromParts, localMatrix, placeObject } from '../siteutil/instanceParts.js';

/**
 * Gerobak PKL kayu (minuman / buah potong), set payung "tenda ceper" + kursi
 * plastik, dan lapak jagung bakar dengan arang menyala.
 */
export const CART = Object.freeze({
  bodyW: 1.7, bodyH: 0.9, bodyD: 0.85, wheelR: 0.45, roofY: 2.3,
  banner: { minuman: 'ES TEH JUMBO', buah: 'BUAH POTONG SEGAR' },
  colors: { kayu: 0x8b5a2b, seng: 0x9aa0a6, kaca: 0xcfe8f5, roda: 0x3b2a1a },
});
export const UMBRELLA = Object.freeze({ radius: 1.6, height: 2.4, panels: [0xe63946, 0xf4f4f4, 0x1d7ed6, 0xf4c20d], chair: [0xd62828, 0x1f7a3a] });
export const FOOD_STALL = Object.freeze({ colors: { arang: 0xff3b00, jagung: 0xf0c419, meja: 0x7a4f26 } });

const woodMat = new THREE.MeshLambertMaterial({ color: CART.colors.kayu });
const zincMat = new THREE.MeshLambertMaterial({ color: CART.colors.seng });
const glassMat = new THREE.MeshStandardMaterial({ color: CART.colors.kaca, transparent: true, opacity: 0.3, roughness: 0.1 });
const wheelMat = new THREE.MeshLambertMaterial({ color: CART.colors.roda });

/** Rangka gerobak: badan kayu, dua roda besar, gagang, etalase kaca, atap seng + tiang. */
function cartFrameParts() {
  const { bodyW, bodyH, bodyD, wheelR, roofY } = CART;
  const parts = [
    { geometry: new THREE.BoxGeometry(bodyW, bodyH, bodyD), material: woodMat, matrix: localMatrix(0, wheelR + bodyH / 2 - 0.1, 0), castShadow: true, name: 'badan' },
    { geometry: new THREE.BoxGeometry(bodyW - 0.2, 0.7, bodyD - 0.15), material: glassMat, matrix: localMatrix(0, wheelR + bodyH + 0.25, 0), name: 'etalase' },
    { geometry: new THREE.BoxGeometry(bodyW + 0.5, 0.04, bodyD + 0.5), material: zincMat, matrix: localMatrix(0, roofY, 0, 0.08), castShadow: true, name: 'atapSeng' },
  ];
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.08, 14).rotateX(Math.PI / 2);
  [-1, 1].forEach((s) => parts.push({ geometry: wheelGeo, material: wheelMat, matrix: localMatrix(-0.2, wheelR, s * (bodyD / 2 + 0.06)), name: 'roda' }));
  const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6).rotateZ(Math.PI / 2);
  [-1, 1].forEach((s) => parts.push({ geometry: handleGeo, material: woodMat, matrix: localMatrix(-bodyW / 2 - 0.4, wheelR + 0.6, s * 0.3), name: 'gagang' }));
  const postGeo = new THREE.CylinderGeometry(0.025, 0.025, roofY - wheelR - bodyH + 0.1, 6);
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => parts.push({
    geometry: postGeo, material: woodMat, matrix: localMatrix(sx * (bodyW / 2 - 0.08), (roofY + wheelR + bodyH - 0.1) / 2, sz * (bodyD / 2 - 0.08)), name: 'tiangAtap',
  }));
  return parts;
}

/** Isi gerobak minuman: botol, termos, tumpukan gelas. */
function drinkContentParts() {
  const y = CART.wheelR + CART.bodyH - 0.1;
  const bottle = new THREE.CylinderGeometry(0.05, 0.05, 0.28, 8);
  const parts = [0x8b4513, 0xf39c12, 0x3498db, 0x27ae60, 0xe74c3c].map((c, i) => ({
    geometry: bottle, material: new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }), matrix: localMatrix(-0.6 + i * 0.22, y + 0.14, 0.2), name: 'botol',
  }));
  parts.push({ geometry: new THREE.CylinderGeometry(0.14, 0.14, 0.5, 10), material: new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }), matrix: localMatrix(0.5, y + 0.25, -0.15), name: 'termos' });
  parts.push({ geometry: new THREE.CylinderGeometry(0.06, 0.05, 0.4, 8), material: glassMat, matrix: localMatrix(-0.1, y + 0.2, -0.2), name: 'gelasTumpuk' });
  return parts;
}

/** Isi gerobak buah: potongan buah warna-warni. */
function fruitContentParts() {
  const y = CART.wheelR + CART.bodyH - 0.1;
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  return [
    { geometry: new THREE.BoxGeometry(0.35, 0.12, 0.2), material: mat(0xf47c20), matrix: localMatrix(-0.55, y + 0.06, 0.15), name: 'pepaya' },
    { geometry: new THREE.SphereGeometry(0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), material: mat(0xd62828), matrix: localMatrix(-0.1, y, 0.15), name: 'semangka' },
    { geometry: new THREE.SphereGeometry(0.15, 10, 8), material: mat(0x9acd32), matrix: localMatrix(0.3, y + 0.15, -0.15), name: 'melon' },
    { geometry: new THREE.CylinderGeometry(0.1, 0.12, 0.3, 8), material: mat(0xf4c20d), matrix: localMatrix(0.6, y + 0.15, 0.1), name: 'nanas' },
    { geometry: new THREE.BoxGeometry(0.3, 0.1, 0.18), material: mat(0xff6f91), matrix: localMatrix(0.1, y + 0.05, -0.25), name: 'jambu' },
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
    makeTextMaterial(label, { bg: kind === 'buah' ? '#2e8b3d' : '#d62828', fg: '#ffffff', width: 1024, height: 192, side: THREE.DoubleSide }),
  );
  banner.position.set(0, CART.roofY - 0.25, CART.bodyD / 2 + 0.3);
  banner.name = 'spanduk';
  g.add(banner);
  g.userData.kind = kind;
  return placeObject(g, opts);
}

/** Kerucut payung dengan panel warna bergantian (vertex color). */
function umbrellaCanopy() {
  const geo = new THREE.ConeGeometry(UMBRELLA.radius, 0.55, 8, 1, true).toNonIndexed();
  const colors = [];
  const c = new THREE.Color();
  const triCount = geo.attributes.position.count / 3;
  for (let i = 0; i < triCount; i += 1) {
    c.setHex(UMBRELLA.panels[i % UMBRELLA.panels.length]);
    for (let k = 0; k < 3; k += 1) colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

/** Kursi plastik: dudukan, sandaran, 4 kaki. */
function plasticChair(color) {
  const mat = new THREE.MeshLambertMaterial({ color });
  const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 5);
  const parts = [
    { geometry: new THREE.BoxGeometry(0.42, 0.04, 0.42), material: mat, matrix: localMatrix(0, 0.45, 0), name: 'dudukan' },
    { geometry: new THREE.BoxGeometry(0.42, 0.42, 0.04), material: mat, matrix: localMatrix(0, 0.68, -0.19, -0.1), name: 'sandaran' },
  ];
  [[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]].forEach(([x, z]) => parts.push({
    geometry: legGeo, material: mat, matrix: localMatrix(x, 0.225, z), name: 'kaki',
  }));
  return groupFromParts(parts, 'kursiPlastik');
}

/** Payung besar warna-warni + 4 kursi plastik + meja kecil ("tenda ceper"). */
export function createUmbrellaSet(opts = {}) {
  const g = new THREE.Group();
  g.name = 'tendaCeper';
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, UMBRELLA.height, 6), zincMat);
  pole.position.y = UMBRELLA.height / 2;
  const canopy = umbrellaCanopy();
  canopy.position.y = UMBRELLA.height - 0.2;
  canopy.castShadow = true;
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 12), new THREE.MeshLambertMaterial({ color: 0xf4f4f4 }));
  table.position.y = 0.7;
  g.add(pole, canopy, table);
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const chair = plasticChair(UMBRELLA.chair[i % 2]);
    chair.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9);
    chair.rotation.y = -a - Math.PI / 2;
    g.add(chair);
  }
  return placeObject(g, opts);
}

/** Lapak jagung bakar: meja kayu, pemanggang, arang merah emissive, jagung kuning. */
export function createFoodStall(opts = {}) {
  const tableMat = new THREE.MeshLambertMaterial({ color: FOOD_STALL.colors.meja });
  const grillMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x3a1a0a, emissive: FOOD_STALL.colors.arang, emissiveIntensity: 1.6, roughness: 0.9 });
  const cornMat = new THREE.MeshLambertMaterial({ color: FOOD_STALL.colors.jagung });
  const legGeo = new THREE.BoxGeometry(0.06, 0.78, 0.06);
  const parts = [
    { geometry: new THREE.BoxGeometry(1.6, 0.05, 0.7), material: tableMat, matrix: localMatrix(0, 0.8, 0), castShadow: true, name: 'meja' },
    { geometry: new THREE.BoxGeometry(0.9, 0.2, 0.42), material: grillMat, matrix: localMatrix(-0.25, 0.92, 0), name: 'pemanggang' },
  ];
  [[-0.75, -0.3], [-0.75, 0.3], [0.75, -0.3], [0.75, 0.3]].forEach(([x, z]) => parts.push({ geometry: legGeo, material: tableMat, matrix: localMatrix(x, 0.39, z), name: 'kaki' }));
  const coalGeo = new THREE.SphereGeometry(0.05, 6, 4);
  for (let i = 0; i < 9; i += 1) {
    parts.push({ geometry: coalGeo, material: coalMat, matrix: localMatrix(-0.6 + (i % 5) * 0.17, 0.99, -0.1 + Math.floor(i / 5) * 0.2), name: 'arang' });
  }
  const cornGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.22, 7).rotateZ(Math.PI / 2);
  for (let i = 0; i < 4; i += 1) {
    parts.push({ geometry: cornGeo, material: cornMat, matrix: localMatrix(-0.45 + i * 0.14, 1.06, 0.02), name: 'jagung' });
  }
  parts.push({ geometry: new THREE.BoxGeometry(0.5, 0.1, 0.3), material: cornMat, matrix: localMatrix(0.5, 0.88, 0), name: 'tumpukanJagung' });
  const g = groupFromParts(parts, 'lapakJagungBakar');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), makeTextMaterial(opts.label ?? 'JAGUNG BAKAR', { bg: '#f4c20d', fg: '#222222', width: 768, height: 192, side: THREE.DoubleSide }));
  sign.position.set(0, 0.6, 0.36);
  g.add(sign);
  return placeObject(g, opts);
}
