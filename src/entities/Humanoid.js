/**
 * Humanoid low-poly prosedural (tanpa aset eksternal).
 *
 * Hierarki pivot (semua dalam meter, model menghadap +Z lokal, Y ke atas):
 *   group (kaki di y=0)
 *     body (Group di pinggul; diskalakan sesuai tinggi)
 *       spine (Group) → torso, apron?, headPivot → head, hair/hat/hijab
 *                     → shoulderL/R → upperArm → elbowL/R → lowerArm → hand
 *       hipL/R → thigh → kneeL/R → shin → foot
 *
 * Fungsi animasi ada di Humanoid.anim.js dan hanya menyentuh rotasi pivot.
 */
import * as THREE from 'three';
import { matFor } from './util.js';

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

// Geometri dibagi oleh semua Humanoid (ratusan instance) → alokasi sekali.
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
  buildHeadgear(parts.head, parts, o);

  group.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; obj.frustumCulled = true; } });
  return { group, parts, height: o.height };
}

/** Tulang punggung: torso, celemek opsional, leher, kepala. */
function buildSpine(body, parts, o) {
  const spine = new THREE.Group();
  body.add(spine);
  const torso = new THREE.Mesh(GEO.torso, matFor(o.shirt));
  torso.position.y = DIM.torsoH / 2 + DIM.torsoR - 0.02;
  spine.add(torso);
  if (o.apron != null) {
    const apron = new THREE.Mesh(GEO.apron, matFor(o.apron));
    apron.position.set(0, 0.22, DIM.torsoR + 0.005);
    spine.add(apron);
    parts.apron = apron;
  }
  const neck = new THREE.Mesh(GEO.neck, matFor(o.skin));
  neck.position.y = DIM.neckY - 0.02;
  spine.add(neck);
  const headPivot = new THREE.Group();
  headPivot.position.y = DIM.neckY;
  spine.add(headPivot);
  const head = new THREE.Mesh(GEO.head, matFor(o.skin));
  head.position.y = DIM.headR + 0.01;
  headPivot.add(head);
  Object.assign(parts, { spine, torso, headPivot, head });
}

/** Lengan: bahu → lengan atas → siku → lengan bawah → tangan. */
function buildArm(spine, parts, o, side, sx) {
  const shoulder = new THREE.Group();
  shoulder.position.set(sx * DIM.shoulderX, DIM.shoulderY, 0);
  spine.add(shoulder);
  const upper = new THREE.Mesh(GEO.upperArm, matFor(o.shirt));
  upper.position.y = -DIM.upperArm / 2;
  shoulder.add(upper);
  const elbow = new THREE.Group();
  elbow.position.y = -DIM.upperArm;
  shoulder.add(elbow);
  const lower = new THREE.Mesh(GEO.lowerArm, matFor(o.longSleeve ? o.shirt : o.skin));
  lower.position.y = -DIM.lowerArm / 2;
  elbow.add(lower);
  const hand = new THREE.Mesh(GEO.hand, matFor(o.skin));
  hand.position.y = -DIM.lowerArm;
  elbow.add(hand);
  parts[`shoulder${side}`] = shoulder;
  parts[`elbow${side}`] = elbow;
  parts[`hand${side}`] = hand;
}

/** Kaki: pinggul → paha → lutut → betis → sepatu. */
function buildLeg(body, parts, o, side, sx) {
  const hip = new THREE.Group();
  hip.position.set(sx * DIM.hipHalfWidth, 0, 0);
  body.add(hip);
  const thigh = new THREE.Mesh(GEO.thigh, matFor(o.pants));
  thigh.position.y = -DIM.thigh / 2;
  hip.add(thigh);
  const knee = new THREE.Group();
  knee.position.y = -DIM.thigh;
  hip.add(knee);
  const shin = new THREE.Mesh(GEO.shin, matFor(o.pants));
  shin.position.y = -DIM.shin / 2;
  knee.add(shin);
  const foot = new THREE.Mesh(GEO.foot, matFor(o.shoes));
  foot.position.set(0, -DIM.shin + 0.01, 0.05);
  knee.add(foot);
  parts[`hip${side}`] = hip;
  parts[`knee${side}`] = knee;
  parts[`foot${side}`] = foot;
}

/** Rambut / hijab / topi di kepala. */
function buildHeadgear(head, parts, o) {
  if (o.hijab != null) {
    const cap = new THREE.Mesh(GEO.hijabCap, matFor(o.hijab, { side: THREE.DoubleSide }));
    cap.position.y = -0.01;
    head.add(cap);
    const drape = new THREE.Mesh(GEO.hijabDrape, matFor(o.hijab, { side: THREE.DoubleSide }));
    drape.position.y = -0.17;
    head.add(drape);
    parts.hijab = cap;
  } else if (o.hair != null) {
    const hair = new THREE.Mesh(GEO.hair, matFor(o.hair));
    hair.position.set(0, 0.0, -0.01);
    head.add(hair);
    parts.hair = hair;
  }
  if (o.hat != null) {
    const hat = new THREE.Group();
    hat.position.y = DIM.headR - 0.02;
    const top = new THREE.Mesh(GEO.hatTop, matFor(o.hat));
    top.position.y = 0.045;
    const brim = new THREE.Mesh(GEO.hatBrim, matFor(o.hat));
    brim.position.set(0, 0, 0.0);
    hat.add(top, brim);
    head.add(hat);
    parts.hat = hat;
  }
}

// Re-export fungsi animasi agar cukup satu import dari Humanoid.js
export * from './Humanoid.anim.js';
