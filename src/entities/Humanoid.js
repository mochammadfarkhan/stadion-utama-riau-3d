/**
 * Humanoid low-poly prosedural (tanpa aset eksternal).
 *
 * Hierarki pivot (semua dalam meter, model menghadap +Z lokal, Y ke atas):
 *   group (kaki di y=0)
 *     body (Group di pinggul; diskalakan sesuai tinggi)
 *       spine (Group) → torso(+leher+celemek), headPivot → head(+rambut/hijab/topi)
 *                     → shoulderL/R → upperArm → elbowL/R → lowerArm(+tangan), hand (titik pegang)
 *       hipL/R → thigh → kneeL/R → shin(+sepatu)
 *
 * Demi draw call minimal, semua bagian di satu pivot digabung menjadi SATU Mesh
 * berwarna per-vertex dengan satu material bersama (10 mesh per orang).
 * Fungsi animasi ada di Humanoid.anim.js dan hanya menyentuh rotasi pivot.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BASE_HEIGHT = 1.7;

/** Dimensi model dasar untuk tinggi 1.7 m. */
export const DIM = Object.freeze({
  hipY: 0.86,
  hipHalfWidth: 0.09,
  thigh: 0.42,
  shin: 0.40,
  torsoR: 0.15,
  torsoH: 0.32,
  shoulderY: 0.54,   // relatif pinggul
  shoulderX: 0.22,
  upperArm: 0.30,
  lowerArm: 0.28,
  neckY: 0.62,       // relatif pinggul (pivot kepala)
  headR: 0.12,
});

// Geometri dasar dibagi oleh semua Humanoid; per orang dibuat salinan berwarna lalu digabung.
const GEO = {
  torso: new THREE.CapsuleGeometry(DIM.torsoR, DIM.torsoH, 3, 8),
  thigh: new THREE.CapsuleGeometry(0.07, DIM.thigh - 0.14, 2, 6),
  shin: new THREE.CapsuleGeometry(0.055, DIM.shin - 0.11, 2, 6),
  upperArm: new THREE.CapsuleGeometry(0.05, DIM.upperArm - 0.1, 2, 6),
  lowerArm: new THREE.CapsuleGeometry(0.045, DIM.lowerArm - 0.09, 2, 6),
  hand: new THREE.SphereGeometry(0.05, 6, 5),
  foot: new THREE.BoxGeometry(0.1, 0.06, 0.24),
  neck: new THREE.CylinderGeometry(0.045, 0.05, 0.08, 6),
  head: new THREE.SphereGeometry(DIM.headR, 10, 8),
  hair: new THREE.SphereGeometry(DIM.headR + 0.012, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
  hijabCap: new THREE.SphereGeometry(DIM.headR + 0.02, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.62),
  hijabDrape: new THREE.ConeGeometry(0.21, 0.26, 10, 1, true),
  hatTop: new THREE.CylinderGeometry(0.11, 0.125, 0.09, 10),
  hatBrim: new THREE.CylinderGeometry(0.19, 0.19, 0.012, 12),
  apron: new THREE.BoxGeometry(0.28, 0.46, 0.02),
};

const SHOE_COLOR = 0x222222;
const HEAD_Y = DIM.headR + 0.01;
const BODY_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
const BODY_MAT_DOUBLE = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const _color = new THREE.Color();

/** Salinan geometri dengan atribut warna seragam, digeser ke (x, y, z). */
function colored(geo, hex, x = 0, y = 0, z = 0) {
  const g = geo.clone();
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  _color.setHex(hex);
  for (let i = 0; i < n; i += 1) arr.set([_color.r, _color.g, _color.b], i * 3);
  g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  return g.translate(x, y, z);
}

/** Satu Mesh (satu draw call) dari beberapa bagian berwarna di pivot yang sama. */
function partMesh(pieces, { castShadow = false, doubleSided = false } = {}) {
  const geo = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces, false);
  const mesh = new THREE.Mesh(geo, doubleSided ? BODY_MAT_DOUBLE : BODY_MAT);
  mesh.castShadow = castShadow;
  mesh.frustumCulled = true;
  return mesh;
}

/**
 * Buat manusia low-poly.
 * @param {{skin?:number, shirt?:number, pants?:number, hair?:number|null,
 *   height?:number, hat?:number|null, hijab?:number|null, apron?:number|null,
 *   longSleeve?:boolean, shoes?:number}} opts
 * @returns {{group: THREE.Group, parts: Record<string, THREE.Object3D>, height: number}}
 */
export function createHumanoid(opts = {}) {
  const o = {
    skin: 0xc68642, shirt: 0x3366cc, pants: 0x2b2b44, hair: 0x1a1210,
    height: BASE_HEIGHT, hat: null, hijab: null, apron: null,
    longSleeve: false, shoes: SHOE_COLOR, ...opts,
  };
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = DIM.hipY * (o.height / BASE_HEIGHT);
  body.scale.setScalar(o.height / BASE_HEIGHT);
  body.userData.baseY = body.position.y; // dipakai animasi untuk bob naik-turun
  group.add(body);

  const parts = { body };
  buildSpine(body, parts, o);
  buildArm(parts.spine, parts, o, 'L', 1);
  buildArm(parts.spine, parts, o, 'R', -1);
  buildLeg(body, parts, o, 'L', 1);
  buildLeg(body, parts, o, 'R', -1);
  return { group, parts, height: o.height };
}

/** Tulang punggung: torso (+leher, celemek) dan kepala (+rambut/hijab/topi). */
function buildSpine(body, parts, o) {
  const spine = new THREE.Group();
  body.add(spine);
  const torsoPieces = [
    colored(GEO.torso, o.shirt, 0, DIM.torsoH / 2 + DIM.torsoR - 0.02, 0),
    colored(GEO.neck, o.skin, 0, DIM.neckY - 0.02, 0),
  ];
  if (o.apron != null) torsoPieces.push(colored(GEO.apron, o.apron, 0, 0.22, DIM.torsoR + 0.005));
  const torso = partMesh(torsoPieces, { castShadow: true });
  spine.add(torso);
  const headPivot = new THREE.Group();
  headPivot.position.y = DIM.neckY;
  spine.add(headPivot);
  const head = partMesh(headPieces(o), { castShadow: false, doubleSided: o.hijab != null });
  headPivot.add(head);
  Object.assign(parts, { spine, torso, headPivot, head });
  if (o.apron != null) parts.apron = torso;
  if (o.hijab != null) parts.hijab = head;
  else if (o.hair != null) parts.hair = head;
  if (o.hat != null) parts.hat = head;
}

/** Potongan kepala: bola kepala + rambut / hijab (cap + juntai) + topi (atas + pinggiran). */
function headPieces(o) {
  const pieces = [colored(GEO.head, o.skin, 0, HEAD_Y, 0)];
  if (o.hijab != null) {
    pieces.push(colored(GEO.hijabCap, o.hijab, 0, HEAD_Y - 0.01, 0));
    pieces.push(colored(GEO.hijabDrape, o.hijab, 0, HEAD_Y - 0.17, 0));
  } else if (o.hair != null) {
    pieces.push(colored(GEO.hair, o.hair, 0, HEAD_Y, -0.01));
  }
  if (o.hat != null) {
    const hatY = HEAD_Y + DIM.headR - 0.02;
    pieces.push(colored(GEO.hatTop, o.hat, 0, hatY + 0.045, 0));
    pieces.push(colored(GEO.hatBrim, o.hat, 0, hatY, 0));
  }
  return pieces;
}

/** Lengan: bahu → lengan atas → siku → lengan bawah (+tangan); hand = titik pegang kosong. */
function buildArm(spine, parts, o, side, sx) {
  const shoulder = new THREE.Group();
  shoulder.position.set(sx * DIM.shoulderX, DIM.shoulderY, 0);
  spine.add(shoulder);
  shoulder.add(partMesh([colored(GEO.upperArm, o.shirt, 0, -DIM.upperArm / 2, 0)])); // siluet bayangan cukup dari torso + kaki
  const elbow = new THREE.Group();
  elbow.position.y = -DIM.upperArm;
  shoulder.add(elbow);
  elbow.add(partMesh([
    colored(GEO.lowerArm, o.longSleeve ? o.shirt : o.skin, 0, -DIM.lowerArm / 2, 0),
    colored(GEO.hand, o.skin, 0, -DIM.lowerArm, 0),
  ]));
  const hand = new THREE.Group();
  hand.position.y = -DIM.lowerArm;
  elbow.add(hand);
  parts[`shoulder${side}`] = shoulder;
  parts[`elbow${side}`] = elbow;
  parts[`hand${side}`] = hand;
}

/** Kaki: pinggul → paha → lutut → betis (+sepatu). */
function buildLeg(body, parts, o, side, sx) {
  const hip = new THREE.Group();
  hip.position.set(sx * DIM.hipHalfWidth, 0, 0);
  body.add(hip);
  hip.add(partMesh([colored(GEO.thigh, o.pants, 0, -DIM.thigh / 2, 0)], { castShadow: true }));
  const knee = new THREE.Group();
  knee.position.y = -DIM.thigh;
  hip.add(knee);
  const shin = partMesh([
    colored(GEO.shin, o.pants, 0, -DIM.shin / 2, 0),
    colored(GEO.foot, o.shoes, 0, -DIM.shin + 0.01, 0.05),
  ], { castShadow: false });
  knee.add(shin);
  parts[`hip${side}`] = hip;
  parts[`knee${side}`] = knee;
  parts[`foot${side}`] = shin;
}

// Re-export fungsi animasi agar cukup satu import dari Humanoid.js
export * from './Humanoid.anim.js';
