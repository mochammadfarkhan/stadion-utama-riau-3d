import * as THREE from 'three';
import { SITE } from '../config/constants.js';
import { instanceParts } from './siteutil/instanceParts.js';

/**
 * Venue baseball/softball: outfield rumput (sektor 90°), infield tanah,
 * diamond, mound, pagar keliling, backstop jaring, dua dugout.
 * Home plate di origin lokal; lapangan membentang ke -Z lokal.
 */
const FIELD = Object.freeze({
  outfieldR: 75, infieldR: 29, baseSide: 27.4, moundR: 2.7, moundH: 0.25,
  fencePostStep: 7, fenceH: 2.4, backstopW: 16, backstopH: 6, backstopZ: 7,
});
const Y = Object.freeze({ outfield: 0.03, infield: 0.04, innerGrass: 0.05, base: 0.08 });

const outfieldMat = new THREE.MeshLambertMaterial({ color: 0x2c7d35 });
const infieldMat = new THREE.MeshLambertMaterial({ color: 0x9c6b3c });
const innerGrassMat = new THREE.MeshLambertMaterial({ color: 0x3a9344 });
const baseMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f0 });
const fenceMat = new THREE.MeshLambertMaterial({ color: 0x4a5a3a, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
const postMat = new THREE.MeshLambertMaterial({ color: 0x6e7278 });
const netMat = new THREE.MeshBasicMaterial({ color: 0x202020, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
const dugoutMat = new THREE.MeshLambertMaterial({ color: 0x8f8f88 });

/** Mesh datar di XZ. */
function flat(geometry, material, y) {
  const m = new THREE.Mesh(geometry, material);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

/** Outfield + infield tanah + rumput dalam diamond + mound + base. */
function createFieldSurface() {
  const g = new THREE.Group();
  g.add(flat(new THREE.CircleGeometry(FIELD.outfieldR, 40, Math.PI / 4, Math.PI / 2), outfieldMat, Y.outfield));
  const half = FIELD.baseSide / Math.SQRT2; // setengah diagonal diamond
  const infield = flat(new THREE.CircleGeometry(FIELD.infieldR, 32), infieldMat, Y.infield);
  infield.position.z = -half;
  g.add(infield);
  const inner = flat(new THREE.PlaneGeometry(FIELD.baseSide - 4, FIELD.baseSide - 4), innerGrassMat, Y.innerGrass);
  inner.rotation.z = Math.PI / 4;
  inner.position.z = -half;
  g.add(inner);
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(FIELD.moundR, FIELD.moundR + 0.6, FIELD.moundH, 16), infieldMat);
  mound.position.set(0, FIELD.moundH / 2 + Y.infield, -half + 1);
  g.add(mound);
  const bases = [{ x: 0, z: 0 }, { x: half, z: -half }, { x: 0, z: -2 * half }, { x: -half, z: -half }]
    .map((p) => ({ ...p, y: Y.base, rotY: Math.PI / 4 }));
  g.add(instanceParts([{ geometry: new THREE.BoxGeometry(0.45, 0.06, 0.45), material: baseMat }], bases, 'base'));
  return g;
}

/** Pagar keliling outfield: tiang + panel semi transparan mengikuti busur. */
function createOutfieldFence() {
  const r = FIELD.outfieldR;
  const arcLen = (Math.PI / 2) * r;
  const n = Math.floor(arcLen / FIELD.fencePostStep);
  const spots = [];
  for (let i = 0; i <= n; i += 1) {
    const a = Math.PI / 4 + (i / n) * (Math.PI / 2);
    spots.push({ x: r * Math.cos(a), z: -r * Math.sin(a), rotY: Math.atan2(r * Math.cos(a), r * Math.sin(a)) });
  }
  const panels = spots.slice(0, -1).map((p, i) => {
    const q = spots[i + 1];
    return { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2, rotY: Math.atan2(-(q.z - p.z), q.x - p.x) };
  });
  const parts = [
    { geometry: new THREE.CylinderGeometry(0.06, 0.06, FIELD.fenceH, 6).translate(0, FIELD.fenceH / 2, 0), material: postMat, name: 'tiangPagar' },
  ];
  const g = new THREE.Group();
  g.name = 'pagarOutfield';
  g.add(instanceParts(parts, spots, 'tiang'));
  const panelGeo = new THREE.PlaneGeometry(FIELD.fencePostStep, FIELD.fenceH).translate(0, FIELD.fenceH / 2, 0);
  g.add(instanceParts([{ geometry: panelGeo, material: fenceMat, name: 'panelPagar' }], panels, 'panel'));
  return g;
}

/** Backstop jaring di belakang home plate + 3 tiang. */
function createBackstop() {
  const g = new THREE.Group();
  g.name = 'backstop';
  const net = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.backstopW, FIELD.backstopH), netMat);
  net.position.set(0, FIELD.backstopH / 2, FIELD.backstopZ);
  g.add(net);
  const postGeo = new THREE.CylinderGeometry(0.08, 0.08, FIELD.backstopH, 6);
  [-FIELD.backstopW / 2, 0, FIELD.backstopW / 2].forEach((x) => {
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(x, FIELD.backstopH / 2, FIELD.backstopZ);
    g.add(p);
  });
  return g;
}

/** Dugout: bangku beton beratap di kiri-kanan home plate. */
function createDugouts() {
  const g = new THREE.Group();
  g.name = 'dugout';
  const roofGeo = new THREE.BoxGeometry(6, 0.15, 2.6);
  const benchGeo = new THREE.BoxGeometry(5.6, 0.45, 0.6);
  const wallGeo = new THREE.BoxGeometry(6, 2.2, 0.15);
  [-1, 1].forEach((s) => {
    const d = new THREE.Group();
    const roof = new THREE.Mesh(roofGeo, dugoutMat);
    roof.position.y = 2.3;
    const bench = new THREE.Mesh(benchGeo, dugoutMat);
    bench.position.set(0, 0.25, 0.9);
    const wall = new THREE.Mesh(wallGeo, dugoutMat);
    wall.position.set(0, 1.1, 1.3);
    d.add(roof, bench, wall);
    d.position.set(s * 15, 0, 3);
    d.rotation.y = s * 0.3;
    g.add(d);
  });
  return g;
}

/** Venue baseball lengkap di SITE.baseballCenter. */
export function createBaseballVenue(opts = {}) {
  const g = new THREE.Group();
  g.name = 'venueBaseball';
  g.add(createFieldSurface(), createOutfieldFence(), createBackstop(), createDugouts());
  const c = opts.center ?? SITE.baseballCenter;
  g.position.set(c.x, 0, c.z);
  g.rotation.y = opts.rotY ?? Math.PI; // home plate menghadap kawasan (selatan)
  return g;
}
