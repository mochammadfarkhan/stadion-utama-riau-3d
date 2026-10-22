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
import { BASE_HEIGHT, BODY_BUILDS, DIM, GEO } from './Humanoid.dim.js';
import { createFace } from './Humanoid.face.js';
import { ALL_HAIR_STYLES, HAIR_STYLES, createHair, createHat, styleUnderHat } from './Humanoid.hair.js';
import { kitGeometry, kitRig } from './Humanoid.kit.js';
import { buildManekin, resolveGender } from './Humanoid.manekin.js';
import { buildStaticLodMesh } from './Humanoid.lod.js';
import { makeRng, matFor, pick } from './util.js';

export { BASE_HEIGHT, BODY_BUILDS, DIM };

const SHOE_COLOR = 0x222222;
/** Palet rambut cerah default (dipakai bila hairColor tidak diberi). */
const DEFAULT_HAIR_COLORS = Object.freeze([
  0xe03e3e, 0xff7eb6, 0x4cc96a, 0x9b5de5, 0x3d8bff, 0xffd23f, 0x8b5a2b, 0x222222,
]);
const HAT_STYLES = new Set(['hijab', 'caping', 'hardhat', 'cap']);
/** RNG cadangan (deterministik) bila pemanggil tidak memberi opts.rng. */
const fallbackRng = makeRng(0x5eed);

/** Geometri kit Blender bila termuat, selain itu bentuk prosedural. */
const kitOr = (name, fallback) => kitGeometry(name) ?? fallback;

/** Skala per bagian (tipe tubuh) tanpa mengubah geometri bersama. */
function scaled(m, x, y, z) {
  m.scale.set(x, y, z);
  return m;
}

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
 *   glasses?:boolean, mustache?:boolean, build?:'slim'|'average'|'chubby'|'child', pantsFit?:'wide'|'slim',
 *   rng?:() => number}} opts
 * bottom 'longskirt' = rok panjang/gamis sampai mata kaki.
 * @returns {{group: THREE.Group, parts: Record<string, THREE.Object3D>, height: number}}
 */
export function createHumanoid(opts = {}) {
  const o = {
    skin: 0xc68642, shirt: 0x3366cc, pants: 0x2b2b44, hair: undefined, hairColor: undefined,
    height: BASE_HEIGHT, hat: null, hijab: null, apron: null, vest: null, badge: null, backpack: null,
    bottom: 'pants', longSleeve: false, shoes: SHOE_COLOR, glasses: false, mustache: false, build: 'average',
    ...opts,
  };
  o.fit = BODY_BUILDS[o.build] ?? BODY_BUILDS.average;
  const hair = resolveHair(o);
  const gender = resolveGender(o, hair.style);
  // Manekin tanpa wajah (default bila kit manekin termuat); selain itu chibi kit/prosedural (gaya lama).
  const rig = kitRig(gender);
  const group = new THREE.Group();
  const body = new THREE.Group();
  const scale = o.height / BASE_HEIGHT;
  body.position.y = (rig?.hipY ?? DIM.hipY) * scale;
  body.scale.setScalar(scale);
  body.userData.baseY = body.position.y;   // dipakai animasi untuk bob naik-turun
  body.userData.baseScale = scale;         // dipakai animasi untuk squash-stretch
  group.add(body);

  const parts = { body };
  if (rig) {
    buildManekin(body, parts, o, gender, rig, hair);
  } else {
    buildSpine(body, parts, o);
    buildHead(parts.spine, parts, o, hair);
    buildArm(parts.spine, parts, o, 'L', 1);
    buildArm(parts.spine, parts, o, 'R', -1);
    buildLeg(body, parts, o, 'L', 1);
    buildLeg(body, parts, o, 'R', -1);
    buildBottom(body, parts, o);
  }
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
  const { w, d } = o.fit;
  const torso = scaled(mesh(kitOr('torso', GEO.torso), o.shirt, { castShadow: true }), w, 1, d);
  spine.add(torso);
  Object.assign(parts, { spine, torso });
  // Rompi/celemek/lencana/ransel diskalakan sama dengan torso agar tetap menempel di permukaannya.
  for (const key of ['vest', 'apron', 'badge', 'backpack']) {
    if (o[key] == null) continue;
    parts[key] = scaled(mesh(GEO[key], o[key]), w, 1, d);
    spine.add(parts[key]);
  }
}

/** Kepala: bola kulit + wajah + rambut/penutup kepala + topi pet legacy. */
function buildHead(spine, parts, o, hair) {
  const headPivot = new THREE.Group();
  headPivot.position.y = DIM.neckY;
  headPivot.userData.baseY = DIM.neckY;    // dipakai animasi untuk bob kepala
  headPivot.scale.setScalar(o.fit.head);    // kepala besar khas chibi (anak lebih besar)
  spine.add(headPivot);
  const head = mesh(kitGeometry('head') ?? GEO.head, o.skin, { castShadow: true });
  headPivot.add(head);
  const face = createFace({ glasses: o.glasses, mustache: o.mustache });
  headPivot.add(face);
  Object.assign(parts, { headPivot, head, face });
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
  const { limb } = o.fit;
  shoulder.position.set(sx * DIM.shoulderX * (0.35 + 0.65 * o.fit.w), DIM.shoulderY, 0);
  spine.add(shoulder);
  const kit = kitGeometry('arm_lower_skin') != null;
  shoulder.add(scaled(mesh(kitOr(o.longSleeve ? 'arm_upper_long' : 'arm_upper_short', GEO.upperArm), o.shirt), limb, 1, limb));
  const elbow = new THREE.Group();
  elbow.position.y = -DIM.upperArm;
  shoulder.add(elbow);
  if (kit && o.longSleeve) {
    // Lengan baju panjang bermanset + tangan mitten kulit terpisah.
    elbow.add(scaled(mesh(kitGeometry('arm_lower_sleeve'), o.shirt), limb, 1, limb));
    elbow.add(scaled(mesh(kitOr('hand', GEO.lowerArm), o.skin), limb, 1, limb));
  } else if (kit) {
    elbow.add(scaled(mesh(kitGeometry('arm_lower_skin'), o.skin), limb, 1, limb)); // lengan + tangan mitten
  } else {
    // Prosedural: kapsul lengan bawah membulat di ujung = tangan (sarung tangan bila lengan panjang).
    elbow.add(mesh(GEO.lowerArm, o.longSleeve ? o.shirt : o.skin));
  }
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
  const { limb, w } = o.fit;
  hip.position.set(sx * DIM.hipHalfWidth * w, 0, 0);
  body.add(hip);
  const skirted = o.bottom === 'skirt' || o.bottom === 'longskirt';
  const legColor = o.bottom === 'pants' ? o.pants : o.skin;
  // Celana panjang: kaki lebar lurus (gaya kargo) kecuali legging/training ('slim').
  const wide = o.bottom === 'pants' && o.pantsFit !== 'slim' ? '_wide' : '';
  hip.add(scaled(mesh(kitOr(`leg_thigh${wide}`, GEO.thigh), skirted ? o.skin : o.pants), limb, 1, limb));
  const knee = new THREE.Group();
  knee.position.y = -DIM.thigh;
  hip.add(knee);
  const shin = scaled(mesh(kitOr(`leg_shin${wide}`, GEO.shin), legColor), limb, 1, limb);
  knee.add(shin);
  knee.add(mesh(kitOr('shoe', GEO.foot), o.shoes));
  parts[`hip${side}`] = hip;
  parts[`knee${side}`] = knee;
  parts[`foot${side}`] = shin;
}

/** Bawahan di pinggul: celana pendek lebar, pinggul celana panjang, rok, atau rok panjang (kit; fallback prosedural). */
const BOTTOM_KIT = Object.freeze({
  shorts: ['shorts', 'shorts'], pants: ['hips', 'shorts'], skirt: ['skirt', 'skirt'], longskirt: ['skirt_long', 'skirt'],
});

function buildBottom(body, parts, o) {
  const [kitName, procName] = BOTTOM_KIT[o.bottom] ?? BOTTOM_KIT.pants;
  parts.bottom = scaled(mesh(kitOr(kitName, GEO[procName]), o.pants), o.fit.w, 1, o.fit.d);
  body.add(parts.bottom);
}

// Re-export fungsi animasi agar cukup satu import dari Humanoid.js
export * from './Humanoid.anim.js';
