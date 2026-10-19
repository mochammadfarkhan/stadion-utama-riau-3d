/**
 * Humanoid chibi prosedural (gaya cozy Dinkum/Overcooked, tanpa aset eksternal).
 *
 * Hierarki pivot (meter, model menghadap +Z lokal, Y ke atas):
 *   group (kaki di y=0)
 *     body (Group di pinggul; diskalakan sesuai tinggi; squash-stretch oleh animasi)
 *       spine → torso(+rompi/celemek/lencana), headPivot → head, wajah, rambut/penutup, topi
 *             → shoulderL/R → lengan atas → elbowL/R → lengan bawah(+tangan), hand (titik pegang)
 *       hipL/R → paha → kneeL/R → betis, sepatu
 *       celana pendek/rok menempel di body (pinggul)
 *
 * Semua geometri BERSAMA (Humanoid.dim/face/hair.js) dan material lewat matFor,
 * sehingga per orang hanya dibuat Mesh (≤ 20). Bayangan hanya dari torso & kepala.
 * Fungsi animasi ada di Humanoid.anim.js (hanya menyentuh pivot).
 */
import * as THREE from 'three';
import { BASE_HEIGHT, DIM, GEO } from './Humanoid.dim.js';
import { createFace } from './Humanoid.face.js';
import { ALL_HAIR_STYLES, HAIR_STYLES, createHair, createHat, styleUnderHat } from './Humanoid.hair.js';
import { buildStaticLodMesh } from './Humanoid.lod.js';
import { makeRng, matFor, pick } from './util.js';

export { BASE_HEIGHT, DIM };

const SHOE_COLOR = 0x222222;
/** Palet rambut cerah default (dipakai bila hairColor tidak diberi). */
const DEFAULT_HAIR_COLORS = Object.freeze([
  0xe03e3e, 0xff7eb6, 0x4cc96a, 0x9b5de5, 0x3d8bff, 0xffd23f, 0x8b5a2b, 0x222222,
]);
const HAT_STYLES = new Set(['hijab', 'caping', 'hardhat', 'cap']);
/** RNG cadangan (deterministik) bila pemanggil tidak memberi opts.rng. */
const fallbackRng = makeRng(0x5eed);

/** Mesh dari geometri bersama + material cache; bayangan opsional. */
function mesh(geo, color, { castShadow = false, side } = {}) {
  const m = new THREE.Mesh(geo, side != null ? matFor(color, { side }) : matFor(color));
  m.castShadow = castShadow;
  m.frustumCulled = true;
  return m;
}

/**
 * Normalisasi opsi rambut: `hair` boleh nama gaya (string) atau warna hex
 * (legacy), `hijab` warna hex legacy → gaya 'hijab'. Mengembalikan {style, color}
 * baru tanpa mengubah opts.
 */
function resolveHair(o) {
  const rng = typeof o.rng === 'function' ? o.rng : fallbackRng;
  if (o.hijab != null) return { style: 'hijab', color: o.hijab };
  const legacyColor = typeof o.hair === 'number' ? o.hair : null;
  const named = typeof o.hair === 'string' && ALL_HAIR_STYLES.includes(o.hair) ? o.hair : null;
  if (o.hair === null) return { style: null, color: null };
  const style = named ?? pick(rng, HAIR_STYLES);
  const color = o.hairColor ?? legacyColor ?? pick(rng, DEFAULT_HAIR_COLORS);
  return { style: o.hat != null ? styleUnderHat(style) : style, color };
}

/**
 * Buat manusia chibi.
 * @param {{skin?:number, shirt?:number, pants?:number, hair?:string|number|null,
 *   hairColor?:number, height?:number, hat?:number|null, hijab?:number|null,
 *   apron?:number|null, vest?:number|null, badge?:number|null, backpack?:number|null,
 *   bottom?:'shorts'|'pants'|'skirt', longSleeve?:boolean, shoes?:number,
 *   glasses?:boolean, mustache?:boolean, rng?:() => number}} opts
 * @returns {{group: THREE.Group, parts: Record<string, THREE.Object3D>, height: number}}
 */
export function createHumanoid(opts = {}) {
  const o = {
    skin: 0xc68642, shirt: 0x3366cc, pants: 0x2b2b44, hair: undefined, hairColor: undefined,
    height: BASE_HEIGHT, hat: null, hijab: null, apron: null, vest: null, badge: null, backpack: null,
    bottom: 'pants', longSleeve: false, shoes: SHOE_COLOR, glasses: false, mustache: false,
    ...opts,
  };
  const group = new THREE.Group();
  const body = new THREE.Group();
  const scale = o.height / BASE_HEIGHT;
  body.position.y = DIM.hipY * scale;
  body.scale.setScalar(scale);
  body.userData.baseY = body.position.y;   // dipakai animasi untuk bob naik-turun
  body.userData.baseScale = scale;         // dipakai animasi untuk squash-stretch
  group.add(body);

  const parts = { body };
  buildSpine(body, parts, o);
  buildHead(parts.spine, parts, o);
  buildArm(parts.spine, parts, o, 'L', 1);
  buildArm(parts.spine, parts, o, 'R', -1);
  buildLeg(body, parts, o, 'L', 1);
  buildLeg(body, parts, o, 'R', -1);
  buildBottom(body, parts, o);
  // Mesh gabungan untuk jarak menengah (disembunyikan sampai pengelola LOD memilihnya).
  const lodMesh = buildStaticLodMesh(group, body);
  group.add(lodMesh);
  group.userData.humanoidLod = { body, mesh: lodMesh };
  return { group, parts, height: o.height };
}

/** Tulang punggung: torso (kaos) + rompi / celemek / lencana opsional. */
function buildSpine(body, parts, o) {
  const spine = new THREE.Group();
  body.add(spine);
  const torso = mesh(GEO.torso, o.shirt, { castShadow: true });
  spine.add(torso);
  Object.assign(parts, { spine, torso });
  if (o.vest != null) { parts.vest = mesh(GEO.vest, o.vest); spine.add(parts.vest); }
  if (o.apron != null) { parts.apron = mesh(GEO.apron, o.apron); spine.add(parts.apron); }
  if (o.badge != null) { parts.badge = mesh(GEO.badge, o.badge); spine.add(parts.badge); }
  if (o.backpack != null) { parts.backpack = mesh(GEO.backpack, o.backpack); spine.add(parts.backpack); }
}

/** Kepala: bola kulit + wajah + rambut/penutup kepala + topi pet legacy. */
function buildHead(spine, parts, o) {
  const headPivot = new THREE.Group();
  headPivot.position.y = DIM.neckY;
  headPivot.userData.baseY = DIM.neckY;    // dipakai animasi untuk bob kepala
  spine.add(headPivot);
  const head = mesh(GEO.head, o.skin, { castShadow: true });
  headPivot.add(head);
  const face = createFace({ glasses: o.glasses, mustache: o.mustache });
  headPivot.add(face);
  Object.assign(parts, { headPivot, head, face });
  const hair = resolveHair(o);
  if (hair.style != null) {
    const hairMesh = createHair(hair.style, hair.color);
    headPivot.add(hairMesh);
    parts[hair.style === 'hijab' ? 'hijab' : 'hair'] = hairMesh;
    parts.hairStyle = hair.style;
  }
  if (o.hat != null && !HAT_STYLES.has(hair.style)) {
    parts.hat = createHat(o.hat);
    headPivot.add(parts.hat);
  }
}

/** Lengan: bahu → lengan atas → siku → lengan bawah (+tangan); hand = titik pegang kosong. */
function buildArm(spine, parts, o, side, sx) {
  const shoulder = new THREE.Group();
  shoulder.position.set(sx * DIM.shoulderX, DIM.shoulderY, 0);
  spine.add(shoulder);
  shoulder.add(mesh(GEO.upperArm, o.shirt));
  const elbow = new THREE.Group();
  elbow.position.y = -DIM.upperArm;
  shoulder.add(elbow);
  // Lengan pendek: kapsul lengan bawah sudah membulat di ujung = tangan (sarung tangan bila lengan panjang).
  elbow.add(mesh(GEO.lowerArm, o.longSleeve ? o.shirt : o.skin));
  const hand = new THREE.Group();
  hand.position.y = -DIM.lowerArm;
  elbow.add(hand);
  parts[`shoulder${side}`] = shoulder;
  parts[`elbow${side}`] = elbow;
  parts[`hand${side}`] = hand;
}

/** Kaki: pinggul → paha → lutut → betis + sepatu bulat. Betis kulit bila celana pendek/rok. */
function buildLeg(body, parts, o, side, sx) {
  const hip = new THREE.Group();
  hip.position.set(sx * DIM.hipHalfWidth, 0, 0);
  body.add(hip);
  const legColor = o.bottom === 'pants' ? o.pants : o.skin;
  hip.add(mesh(GEO.thigh, o.bottom === 'skirt' ? o.skin : o.pants));
  const knee = new THREE.Group();
  knee.position.y = -DIM.thigh;
  hip.add(knee);
  const shin = mesh(GEO.shin, legColor);
  knee.add(shin);
  knee.add(mesh(GEO.foot, o.shoes));
  parts[`hip${side}`] = hip;
  parts[`knee${side}`] = knee;
  parts[`foot${side}`] = shin;
}

/** Celana pendek (blok membulat) atau rok (kerucut pipih) menempel di pinggul. */
function buildBottom(body, parts, o) {
  const geo = o.bottom === 'skirt' ? GEO.skirt : GEO.shorts;
  parts.bottom = mesh(geo, o.pants);
  body.add(parts.bottom);
}

// Re-export fungsi animasi agar cukup satu import dari Humanoid.js
export * from './Humanoid.anim.js';
