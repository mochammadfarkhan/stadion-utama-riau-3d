import * as THREE from 'three';
import { SITE } from '../../config/constants.js';
import { makeTextMaterial } from '../siteutil/textCanvas.js';
import { placeObject } from '../siteutil/instanceParts.js';

/**
 * Tugu kapal layar Lancang Kuning (cat putih) di atas pedestal 3 tingkat
 * dengan kolam air mancur (nozzle mati), plus tugu tanjak kecil untuk area timur.
 */
export const LANCANG = Object.freeze({
  hullLen: 11, beam: 2.6, deckY: 2.4, mastH: 7.5, mastXs: [-2.8, 0.4, 3.2],
  pedestal: [{ r: 7, h: 0.6 }, { r: 5.5, h: 0.6 }, { r: 4.2, h: 0.6 }],
  pool: { rOuter: 11.5, rInner: 9.8, wallH: 0.7, waterY: 0.5, nozzles: 6, nozzleR: 6.5 },
  text: 'LANCANG KUNING',
  colors: { putih: 0xf2f2ee, layar: 0xfafaf5, pedestal: 0xcfcbc2, kolam: 0xb8b4aa, air: 0x4f9c8c, naga: 0xe8c547 },
});
export const TANJAK = Object.freeze({ height: 2.4, pedestalR: 1.2, colors: { emas: 0xd4a017, pedestal: 0xb8b4aa } });

const whiteMat = new THREE.MeshStandardMaterial({ color: LANCANG.colors.putih, roughness: 0.7 });
const sailMat = new THREE.MeshLambertMaterial({ color: LANCANG.colors.layar, side: THREE.DoubleSide });
const pedestalMat = new THREE.MeshLambertMaterial({ color: LANCANG.colors.pedestal });
const poolMat = new THREE.MeshLambertMaterial({ color: LANCANG.colors.kolam });
const goldMat = new THREE.MeshStandardMaterial({ color: TANJAK.colors.emas, metalness: 0.6, roughness: 0.35 });
const hornMat = new THREE.MeshStandardMaterial({ color: LANCANG.colors.naga });
const nozzleMat = new THREE.MeshLambertMaterial({ color: 0x6b6f72 });

/** Profil samping lambung (XY): buritan kiri, haluan naik di kanan. */
function hullShape() {
  const L = LANCANG.hullLen / 2;
  const s = new THREE.Shape();
  s.moveTo(-L, 2.0);
  s.lineTo(L - 0.6, 2.2);
  s.quadraticCurveTo(L + 0.3, 2.6, L + 0.4, 3.4);
  s.lineTo(L + 0.1, 3.4);
  s.quadraticCurveTo(L - 0.8, 1.4, L - 2.2, 0.15);
  s.lineTo(-L + 1.6, 0);
  s.quadraticCurveTo(-L - 0.3, 0.3, -L, 2.0);
  return s;
}

/** Lambung melengkung dari ExtrudeGeometry berbevel (tirus ke lunas). */
function createHull() {
  const geo = new THREE.ExtrudeGeometry(hullShape(), {
    depth: LANCANG.beam - 1.0, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 4, curveSegments: 12,
  });
  geo.translate(0, 0, -(LANCANG.beam - 1.0) / 2);
  const hull = new THREE.Mesh(geo, whiteMat);
  hull.castShadow = true;
  hull.name = 'lambung';
  return hull;
}

/** Tiga tiang layar dengan layar trapesium putih. */
function createMasts() {
  const g = new THREE.Group();
  g.name = 'tiangLayar';
  const mastGeo = new THREE.CylinderGeometry(0.07, 0.1, LANCANG.mastH, 6).translate(0, LANCANG.mastH / 2, 0);
  LANCANG.mastXs.forEach((x, i) => {
    const mast = new THREE.Mesh(mastGeo, whiteMat);
    mast.position.set(x, LANCANG.deckY - 0.2, 0);
    mast.castShadow = true;
    g.add(mast);
    const h = LANCANG.mastH * (i === 1 ? 0.8 : 0.65);
    const shape = new THREE.Shape([new THREE.Vector2(0, 0.6), new THREE.Vector2(1.9, 0.6), new THREE.Vector2(1.4, h), new THREE.Vector2(0, h)]);
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(shape), sailMat);
    sail.position.set(x + 0.08, LANCANG.deckY - 0.2, 0);
    sail.rotation.y = -0.25;
    sail.castShadow = true;
    g.add(sail);
  });
  return g;
}

/** Kepala naga sederhana di haluan (kerucut + bola + dua tanduk). */
function createDragonHead() {
  const g = new THREE.Group();
  g.name = 'haluanNaga';
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.3, 8).rotateZ(-Math.PI / 2), whiteMat);
  head.position.set(0.7, 0, 0);
  const neck = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), whiteMat);
  const hornGeo = new THREE.ConeGeometry(0.06, 0.5, 5);
  [-0.15, 0.15].forEach((z) => {
    const horn = new THREE.Mesh(hornGeo, hornMat);
    horn.position.set(-0.1, 0.45, z);
    horn.rotation.z = -0.4;
    g.add(horn);
  });
  g.add(head, neck);
  g.position.set(LANCANG.hullLen / 2 + 0.3, 3.6, 0);
  return g;
}

/** Tulisan nama di kedua sisi lambung (CanvasTexture; fallback plane putih). */
function createHullText() {
  const g = new THREE.Group();
  g.name = 'tulisanLambung';
  const mat = makeTextMaterial(LANCANG.text, { bg: '#f2f2ee', fg: '#1b3a6b', width: 1024, height: 192, font: 'bold 120px sans-serif' });
  const geo = new THREE.PlaneGeometry(5.2, 0.9);
  [1, -1].forEach((s) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(-0.3, 1.3, s * (LANCANG.beam / 2 + 0.05));
    m.rotation.y = s > 0 ? 0 : Math.PI;
    g.add(m);
  });
  return g;
}

/** Pedestal bundar 3 tingkat (menurun ke atas). */
function createPedestal() {
  const g = new THREE.Group();
  g.name = 'pedestal';
  let y = LANCANG.pool.waterY;
  LANCANG.pedestal.forEach((lvl) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(lvl.r, lvl.r, lvl.h, 32), pedestalMat);
    m.position.y = y + lvl.h / 2;
    m.receiveShadow = true;
    m.castShadow = true;
    g.add(m);
    y += lvl.h;
  });
  g.userData.topY = y;
  return g;
}

/** Kolam air mancur: dinding cincin beton, air kehijauan keruh, nozzle mati. */
function createFountainPool() {
  const { rOuter, rInner, wallH, waterY, nozzles, nozzleR } = LANCANG.pool;
  const g = new THREE.Group();
  g.name = 'kolamAirMancur';
  const ringShape = new THREE.Shape();
  ringShape.absarc(0, 0, rOuter, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rInner, 0, Math.PI * 2, true);
  ringShape.holes.push(hole);
  const wallGeo = new THREE.ExtrudeGeometry(ringShape, { depth: wallH, bevelEnabled: false, curveSegments: 48 });
  wallGeo.rotateX(-Math.PI / 2);
  const wall = new THREE.Mesh(wallGeo, poolMat);
  wall.castShadow = true;
  wall.receiveShadow = true;
  g.add(wall);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(rInner, 48), poolMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.05;
  g.add(floor);
  const waterMat = new THREE.MeshStandardMaterial({ color: LANCANG.colors.air, roughness: 0.3, transparent: true, opacity: 0.88 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(rInner - 0.05, 48), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = waterY;
  water.name = 'airKolam';
  g.add(water);
  const nozzleGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.35, 6);
  for (let i = 0; i < nozzles; i += 1) {
    const a = (i / nozzles) * Math.PI * 2;
    const n = new THREE.Mesh(nozzleGeo, nozzleMat);
    n.position.set(Math.cos(a) * nozzleR, waterY + 0.12, Math.sin(a) * nozzleR);
    g.add(n);
  }
  g.userData.waterMaterial = waterMat;
  return g;
}

/** Tugu Lancang Kuning lengkap; default di SITE.tugu (plaza utara). */
export function createLancangKuning(opts = {}) {
  const g = new THREE.Group();
  g.name = 'tuguLancangKuning';
  const pool = createFountainPool();
  const pedestal = createPedestal();
  const ship = new THREE.Group();
  ship.name = 'kapal';
  ship.add(createHull(), createMasts(), createDragonHead(), createHullText());
  ship.position.y = pedestal.userData.topY;
  g.add(pool, pedestal, ship);
  return placeObject(g, { x: opts.x ?? SITE.tugu.x, z: opts.z ?? SITE.tugu.z, rotY: opts.rotY ?? 0 });
}

/** Profil kain tanjak terlipat (XY). */
function tanjakShape() {
  const pts = [[0, 0], [1.3, 0], [1.5, 0.5], [1.0, 1.7], [0.7, 2.4], [0.45, 1.9], [0.2, 1.1], [-0.2, 0.6]];
  return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
}

/** Tugu tanjak kecil emas di atas pedestal bundar (area timur). */
export function createTanjakMonument(opts = {}) {
  const g = new THREE.Group();
  g.name = 'tuguTanjak';
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(TANJAK.pedestalR, TANJAK.pedestalR + 0.3, 1.0, 20), pedestalMat);
  ped.position.y = 0.5;
  ped.castShadow = true;
  g.add(ped);
  const geo = new THREE.ExtrudeGeometry(tanjakShape(), { depth: 0.5, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
  geo.translate(-0.6, 0, -0.25);
  const cloth = new THREE.Mesh(geo, goldMat);
  cloth.position.y = 1.0;
  cloth.castShadow = true;
  g.add(cloth);
  const fold = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.7), goldMat);
  fold.position.set(-0.1, 1.06, 0);
  g.add(fold);
  const c = SITE.tanjakMonument;
  return placeObject(g, { x: opts.x ?? c.x, z: opts.z ?? c.z, rotY: opts.rotY ?? Math.PI / 2 });
}
