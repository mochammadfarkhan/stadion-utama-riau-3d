/**
 * Mesh sepeda prosedural (city bike). Frame lokal: depan = +Z, poros roda = X,
 * tanah y = 0. Mengembalikan pivot yang dibutuhkan Bicycle.js untuk animasi:
 *   frame (lean), steer (kemudi: garpu + setang + roda depan), wheelF/wheelR
 *   (spin), crankL/crankR (pedal), saddleMount (tempat duduk pengendara).
 */
import * as THREE from 'three';
import { BIKE } from '../config/constants.js';
import { matFor } from './util.js';

const R = BIKE.wheelRadius;
const SPOKES = 16;

/** Titik acuan rangka (meter). */
export const BIKE_GEO = Object.freeze({
  rearHub: new THREE.Vector3(0, R, -0.45),
  frontHub: new THREE.Vector3(0, R, 0.60),
  bb: new THREE.Vector3(0, 0.30, 0.05),          // bottom bracket (poros pedal)
  saddle: new THREE.Vector3(0, 0.88, -0.18),
  headTop: new THREE.Vector3(0, 0.95, 0.42),
  headBottom: new THREE.Vector3(0, 0.76, 0.49),
  crankR: 0.17,
  handlebarY: 0.98,
});

const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** Tabung antara dua titik (silinder diorientasikan). */
function tube(a, b, r, mat) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  _dir.copy(b).sub(a).normalize();
  m.quaternion.setFromUnitVectors(_up, _dir);
  m.castShadow = true;
  return m;
}

/** Roda: ban, velg, hub, jari-jari (InstancedMesh). */
function createWheel(matTire, matMetal) {
  const w = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(R - 0.028, 0.028, 8, 28), matTire);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.052, 0.011, 6, 28), matMetal);
  tire.rotation.y = rim.rotation.y = Math.PI / 2;
  tire.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 8), matMetal);
  hub.rotation.z = Math.PI / 2;
  const spokeLen = R - 0.07;
  const spokes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.002, 0.002, spokeLen, 3), matMetal, SPOKES);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  for (let i = 0; i < SPOKES; i++) {
    const ang = (i / SPOKES) * Math.PI * 2;
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), ang);
    // jari-jari dari hub ke velg, sedikit zig-zag kiri/kanan agar terlihat silang
    p.set(i % 2 ? 0.012 : -0.012, Math.cos(ang) * spokeLen / 2, -Math.sin(ang) * spokeLen / 2);
    m.compose(p, q, new THREE.Vector3(1, 1, 1));
    spokes.setMatrixAt(i, m);
  }
  spokes.instanceMatrix.needsUpdate = true;
  w.add(tire, rim, hub, spokes);
  return w;
}

/** Rangka dua segitiga + sadel. */
function createFrame(g, matFrame, matMetal) {
  const frame = new THREE.Group();
  const seatTop = g.saddle.clone().setY(g.saddle.y - 0.06);
  frame.add(
    tube(g.bb, seatTop, 0.018, matFrame),                              // seat tube
    tube(seatTop.clone().setZ(seatTop.z + 0.03), g.headTop, 0.017, matFrame), // top tube
    tube(g.bb, g.headBottom, 0.019, matFrame),                         // down tube
    tube(g.headBottom, g.headTop, 0.024, matFrame),                    // head tube
    tube(g.bb.clone().setX(0.04), g.rearHub.clone().setX(0.05), 0.011, matFrame),  // chain stay kiri
    tube(g.bb.clone().setX(-0.04), g.rearHub.clone().setX(-0.05), 0.011, matFrame), // chain stay kanan
    tube(seatTop.clone().setX(0.03), g.rearHub.clone().setX(0.05), 0.011, matFrame),  // seat stay
    tube(seatTop.clone().setX(-0.03), g.rearHub.clone().setX(-0.05), 0.011, matFrame),
    tube(g.saddle.clone().setY(g.saddle.y - 0.08), g.saddle, 0.012, matMetal),      // seat post
  );
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.26), matFor(0x2b2b2b));
  saddle.position.copy(g.saddle).add(new THREE.Vector3(0, 0.02, -0.03));
  frame.add(saddle);
  return frame;
}

/** Rantai: TubeGeometry mengelilingi chainring & gir belakang (sisi kanan, x < 0). */
function createChain(g, matMetal) {
  const x = -0.06;
  const rc = 0.09, rr = 0.035;
  const pts = [
    new THREE.Vector3(x, g.bb.y + rc, g.bb.z), new THREE.Vector3(x, g.rearHub.y + rr, g.rearHub.z),
    new THREE.Vector3(x, g.rearHub.y, g.rearHub.z - rr), new THREE.Vector3(x, g.rearHub.y - rr, g.rearHub.z),
    new THREE.Vector3(x, g.bb.y - rc, g.bb.z), new THREE.Vector3(x, g.bb.y, g.bb.z + rc),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const chain = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.006, 5, true), matMetal);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(rc, 0.008, 4, 24), matMetal);
  ring.rotation.y = Math.PI / 2;
  ring.position.copy(g.bb).setX(x);
  const cog = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.006, 4, 12), matMetal);
  cog.rotation.y = Math.PI / 2;
  cog.position.copy(g.rearHub).setX(x);
  const grp = new THREE.Group();
  grp.add(chain, ring, cog);
  return grp;
}

/** Crank + pedal satu sisi; pivot berputar di rotation.x. */
function createCrank(g, sx, matMetal) {
  const crank = new THREE.Group();
  crank.position.copy(g.bb).setX(sx * 0.08);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, g.crankR, 0.03), matMetal);
  arm.position.y = -g.crankR / 2;
  const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.06), matFor(0x333333));
  pedal.position.set(sx * 0.05, -g.crankR, 0);
  crank.add(arm, pedal);
  return crank;
}

/** Garpu, setang, grip, bel, lampu, keranjang (semua ikut berputar saat kemudi). */
function createSteer(g, matFrame, matMetal, withBasket) {
  const steer = new THREE.Group();
  steer.position.copy(g.headTop);
  const local = (v) => v.clone().sub(g.headTop);
  const hub = local(g.frontHub);
  steer.add(
    tube(new THREE.Vector3(0.04, -0.12, 0.03), hub.clone().setX(0.05), 0.011, matFrame),
    tube(new THREE.Vector3(-0.04, -0.12, 0.03), hub.clone().setX(-0.05), 0.011, matFrame),
    tube(new THREE.Vector3(0, -0.12, 0.03), new THREE.Vector3(0, 0.03, 0), 0.016, matMetal), // steerer
    tube(new THREE.Vector3(0, 0.03, 0), new THREE.Vector3(0, g.handlebarY - g.headTop.y, 0.06), 0.014, matMetal), // stem
  );
  const barY = g.handlebarY - g.headTop.y;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.58, 8), matMetal);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, barY, 0.06);
  const gripGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.11, 8);
  const gripL = new THREE.Mesh(gripGeo, matFor(0x222222));
  gripL.rotation.z = Math.PI / 2;
  gripL.position.set(0.24, barY, 0.06);
  const gripR = gripL.clone();
  gripR.position.x = -0.24;
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.025, 10), matFor(0xd4af37));
  bell.position.set(0.14, barY + 0.025, 0.06);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.06, 10), matFor(0xdddddd));
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0, barY - 0.1, 0.16);
  const lampGlass = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), matFor(0xffffcc, { emissive: 0x665522 }));
  lampGlass.position.set(0, barY - 0.1, 0.195);
  steer.add(bar, gripL, gripR, bell, lamp, lampGlass);
  if (withBasket) steer.add(createBasket(barY));
  return { steer, hubLocal: hub };
}

/** Keranjang depan: kotak wireframe + alas. */
function createBasket(barY) {
  const basket = new THREE.Group();
  basket.position.set(0, barY - 0.22, 0.28);
  const wire = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.22, 0.26, 4, 3, 3),
    new THREE.MeshBasicMaterial({ color: 0x444444, wireframe: true }),
  );
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.01, 0.26), matFor(0x555555));
  floor.position.y = -0.11;
  basket.add(wire, floor);
  return basket;
}

/**
 * Bangun mesh sepeda lengkap.
 * @param {{frameColor?:number, withBasket?:boolean}} opts
 * @returns {{group:THREE.Group, parts:{frame:THREE.Group, steer:THREE.Group,
 *   wheelF:THREE.Group, wheelR:THREE.Group, crankL:THREE.Group, crankR:THREE.Group,
 *   saddleMount:THREE.Group}}}
 */
export function createBicycleMesh(opts = {}) {
  const { frameColor = 0x1e6fb8, withBasket = true } = opts;
  const g = BIKE_GEO;
  const matFrame = matFor(frameColor);
  const matMetal = matFor(0xb0b4b8);
  const matTire = matFor(0x1a1a1a);
  const group = new THREE.Group();
  const frame = createFrame(g, matFrame, matMetal);   // pivot lean: di titik kontak tanah
  group.add(frame);
  const wheelR = createWheel(matTire, matMetal);
  wheelR.position.copy(g.rearHub);
  const { steer, hubLocal } = createSteer(g, matFrame, matMetal, withBasket);
  const wheelF = createWheel(matTire, matMetal);
  wheelF.position.copy(hubLocal);
  steer.add(wheelF);
  const crankL = createCrank(g, 1, matMetal);
  const crankR = createCrank(g, -1, matMetal);
  crankR.rotation.x = Math.PI;
  const saddleMount = new THREE.Group();
  saddleMount.position.copy(g.saddle);
  frame.add(wheelR, steer, crankL, crankR, createChain(g, matMetal), saddleMount);
  return { group, parts: { frame, steer, wheelF, wheelR, crankL, crankR, saddleMount } };
}
