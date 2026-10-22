/**
 * Perakit avatar manekin tanpa wajah (kit manekin-kit.glb, proporsi realistis ≈ 7,6 kepala): segmen kaku per pivot
 * Humanoid dengan posisi pivot dari rig gender (Humanoid.kit.js kitRig). Hierarki & nama parts SAMA dengan Humanoid
 * chibi (body/spine/headPivot/shoulder/elbow/hand/hip/knee) sehingga animasi, pose, LOD, dan SkinnedMesh tetap jalan.
 *
 * Warna = "baju cat badan" sementara (baju modular menyusul): torso & lengan atas = kaos, lengan bawah = kaos bila
 * lengan panjang, pinggul & paha = bawahan, betis = bawahan kecuali celana pendek/rok, kaki = sepatu, sisanya kulit.
 * Rambut/hijab/topi & aksesori torso (rompi, celemek, lencana, ransel) masih geometri gaya chibi, dipaskan ke kotak
 * kepala/torso manekin dengan skala per sumbu.
 */
import * as THREE from 'three';
import { GEO } from './Humanoid.dim.js';
import { createHair, createHat } from './Humanoid.hair.js';
import { kitGeometry } from './Humanoid.kit.js';
import { matFor } from './util.js';

const FEMININE_HAIR = new Set(['bob', 'long', 'bun', 'twintails']);
const SKIRTS = new Set(['skirt', 'longskirt']);
const TORSO_ACCESSORIES = Object.freeze(['vest', 'apron', 'badge', 'backpack']);

/**
 * Gender avatar: opts.gender eksplisit, selain itu disimpulkan dari hijab / rok / gaya rambut panjang.
 * @param {{gender?:string, hijab?:number|null, bottom?:string}} o
 * @param {string|null} hairStyle gaya rambut yang sudah di-resolve
 * @returns {'m'|'f'}
 */
export function resolveGender(o, hairStyle) {
  if (o.gender === 'm' || o.gender === 'f') return o.gender;
  return o.hijab != null || SKIRTS.has(o.bottom) || FEMININE_HAIR.has(hairStyle) ? 'f' : 'm';
}

function mesh(geo, color, castShadow = false) {
  const m = new THREE.Mesh(geo, matFor(color));
  m.castShadow = castShadow;
  return m;
}

const part = (g, name) => kitGeometry(`${g}_${name}`);

function boxOf(geo) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  return geo.boundingBox;
}

/**
 * Bungkus `obj` dalam grup yang memetakan kotak `from` ke kotak `to` (skala per sumbu + geser). Dipakai untuk
 * memasang rambut/topi/aksesori gaya chibi di kepala & torso manekin.
 */
function fitted(obj, from, to) {
  const wrap = new THREE.Group();
  const fs = from.getSize(new THREE.Vector3());
  const ts = to.getSize(new THREE.Vector3());
  wrap.scale.set(ts.x / fs.x, ts.y / fs.y, ts.z / fs.z);
  const fc = from.getCenter(new THREE.Vector3()).multiply(wrap.scale);
  wrap.position.copy(to.getCenter(new THREE.Vector3())).sub(fc);
  wrap.add(obj);
  return wrap;
}

/** Kotak kepala manekin di ruang pivot kepala (three) dari rig. */
function headBox(rig) {
  const c = new THREE.Vector3(...rig.headCenter);
  const h = new THREE.Vector3(...rig.headHalf);
  return new THREE.Box3(c.clone().sub(h), c.clone().add(h));
}

function buildHead(spine, parts, o, g, rig, hair) {
  const headPivot = new THREE.Group();
  headPivot.position.set(...rig.neck);
  headPivot.userData.baseY = rig.neck[1];
  headPivot.scale.setScalar(o.fit.head);
  spine.add(headPivot);
  const head = mesh(part(g, 'head'), o.skin, true);
  headPivot.add(head);
  Object.assign(parts, { headPivot, head });
  const target = headBox(rig);
  if (hair.style != null) {
    const kitHead = kitGeometry('head');
    const hairMesh = createHair(hair.style, hair.color);
    headPivot.add(fitted(hairMesh, boxOf(kitHead ?? GEO.head), target));
    parts[hair.style === 'hijab' ? 'hijab' : 'hair'] = hairMesh;
    parts.hairStyle = hair.style;
  }
  if (o.hat != null && !['hijab', 'caping', 'hardhat', 'cap'].includes(hair.style)) {
    parts.hat = createHat(o.hat);
    headPivot.add(fitted(parts.hat, boxOf(GEO.head), target));
  }
}

function buildSpine(body, parts, o, g) {
  const spine = new THREE.Group();
  body.add(spine);
  const { w, d } = o.fit;
  const torso = mesh(part(g, 'torso'), o.shirt, true);
  torso.scale.set(w, 1, d);
  spine.add(torso, mesh(part(g, 'neck'), o.skin));
  Object.assign(parts, { spine, torso });
  const target = boxOf(part(g, 'torso')).clone();
  target.min.multiply(torso.scale);
  target.max.multiply(torso.scale);
  for (const key of TORSO_ACCESSORIES) {
    if (o[key] == null) continue;
    parts[key] = mesh(GEO[key], o[key]);
    spine.add(fitted(parts[key], boxOf(GEO.torso), target));
  }
}

function buildArm(spine, parts, o, g, rig, side) {
  const s = side.toLowerCase();
  const { limb } = o.fit;
  const shoulder = new THREE.Group();
  const [x, y, z] = rig[`shoulder${side}`];
  shoulder.position.set(x * (0.35 + 0.65 * o.fit.w), y, z);
  spine.add(shoulder);
  const upper = mesh(part(g, `arm_upper_${s}`), o.shirt);
  upper.scale.set(limb, 1, limb);
  shoulder.add(upper);
  const elbow = new THREE.Group();
  elbow.position.y = -rig.upperArm;
  shoulder.add(elbow);
  const lower = mesh(part(g, `arm_lower_${s}`), o.longSleeve ? o.shirt : o.skin);
  lower.scale.set(limb, 1, limb);
  elbow.add(lower, mesh(part(g, `hand_${s}`), o.skin));
  const hand = new THREE.Group();
  hand.position.y = -rig.lowerArm;
  elbow.add(hand);
  Object.assign(parts, { [`shoulder${side}`]: shoulder, [`elbow${side}`]: elbow, [`hand${side}`]: hand });
}

function buildLeg(body, parts, o, g, rig, side, sx) {
  const s = side.toLowerCase();
  const { limb, w } = o.fit;
  const hip = new THREE.Group();
  hip.position.set(sx * rig.hipHalfWidth * w, 0, 0);
  body.add(hip);
  const thigh = mesh(part(g, `leg_thigh_${s}`), o.pants);
  thigh.scale.set(limb, 1, limb);
  hip.add(thigh);
  const knee = new THREE.Group();
  knee.position.y = -rig.thigh;
  hip.add(knee);
  const bare = o.bottom === 'shorts' || o.bottom === 'skirt';
  const shin = mesh(part(g, `leg_shin_${s}`), bare ? o.skin : o.pants);
  shin.scale.set(limb, 1, limb);
  knee.add(shin, mesh(part(g, `foot_${s}`), o.shoes));
  Object.assign(parts, { [`hip${side}`]: hip, [`knee${side}`]: knee, [`foot${side}`]: shin });
}

/**
 * Rakit manekin ke dalam `body` (Group pinggul yang sudah diskalakan tinggi). Mengisi `parts` seperti Humanoid chibi.
 * @param {THREE.Group} body
 * @param {Record<string, THREE.Object3D>} parts
 * @param {object} o opsi Humanoid yang sudah dinormalkan (fit, warna, bottom, longSleeve, hat, aksesori)
 * @param {'m'|'f'} g
 * @param {object} rig kitRig(g)
 * @param {{style:string|null, color:number|null}} hair
 */
export function buildManekin(body, parts, o, g, rig, hair) {
  buildSpine(body, parts, o, g);
  buildHead(parts.spine, parts, o, g, rig, hair);
  buildArm(parts.spine, parts, o, g, rig, 'L');
  buildArm(parts.spine, parts, o, g, rig, 'R');
  buildLeg(body, parts, o, g, rig, 'L', 1);
  buildLeg(body, parts, o, g, rig, 'R', -1);
  const pelvis = mesh(part(g, 'pelvis'), o.pants);
  pelvis.scale.set(o.fit.w, 1, o.fit.d);
  body.add(pelvis);
  parts.bottom = pelvis;
  // Ukuran kaki per orang untuk pose duduk & IK sepeda (Humanoid.poses / Humanoid.anim / Bicycle).
  Object.assign(body.userData, { gender: g, thigh: rig.thigh, shin: rig.shin, thighR: rig.thighR });
}
