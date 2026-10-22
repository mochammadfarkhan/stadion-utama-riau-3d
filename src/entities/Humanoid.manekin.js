/**
 * Perakit avatar manekin tanpa wajah (kit manekin-kit.glb, proporsi realistis ≈ 7,6 kepala): kerangka pivot dari rig
 * gender (Humanoid.kit.js kitRig), lalu bagian badan yang TIDAK tertutup + potongan baju/aksesori dari
 * Humanoid.wardrobe.js dipasang ke pivotnya. Hierarki & nama parts SAMA dengan Humanoid chibi
 * (body/spine/headPivot/shoulder/elbow/hand/hip/knee) sehingga animasi, pose, LOD, dan SkinnedMesh tetap jalan.
 * Rambut/hijab/topi masih geometri gaya chibi, dipaskan ke kotak kepala manekin dengan skala per sumbu.
 */
import * as THREE from 'three';
import { GEO } from './Humanoid.dim.js';
import { createHair, createHat } from './Humanoid.hair.js';
import { kitGeometry } from './Humanoid.kit.js';
import { BODY_PARTS, wardrobe } from './Humanoid.wardrobe.js';
import { matFor } from './util.js';

const FEMININE_HAIR = new Set(['bob', 'long', 'bun', 'twintails']);
const SKIRTS = new Set(['skirt', 'longskirt']);
const HEADWEAR = new Set(['hijab', 'caping', 'hardhat', 'cap']);
const SIDES = Object.freeze([['L', 1], ['R', -1]]);
const LIMB_PIVOTS = new Set(['shoulder', 'elbow', 'hip', 'knee']);

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

function mesh(geo, color, { castShadow = false, doubleSided = false } = {}) {
  const m = new THREE.Mesh(geo, doubleSided ? matFor(color, { side: THREE.DoubleSide }) : matFor(color));
  m.castShadow = castShadow;
  return m;
}

function boxOf(geo) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  return geo.boundingBox;
}

/** Bungkus `obj` dalam grup yang memetakan kotak `from` ke kotak `to` (skala per sumbu + geser). */
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

/** Kerangka pivot manekin (tanpa mesh) sesuai rig; mengisi parts. */
function buildSkeleton(body, parts, o, rig) {
  const spine = new THREE.Group();
  body.add(spine);
  const headPivot = new THREE.Group();
  headPivot.position.set(...rig.neck);
  headPivot.userData.baseY = rig.neck[1];
  headPivot.scale.setScalar(o.fit.head);
  spine.add(headPivot);
  Object.assign(parts, { spine, headPivot });
  for (const [side, sx] of SIDES) {
    const shoulder = new THREE.Group();
    const [x, y, z] = rig[`shoulder${side}`];
    shoulder.position.set(x * (0.35 + 0.65 * o.fit.w), y, z);
    spine.add(shoulder);
    const elbow = new THREE.Group();
    elbow.position.y = -rig.upperArm;
    shoulder.add(elbow);
    const hand = new THREE.Group();
    hand.position.y = -rig.lowerArm;
    elbow.add(hand);
    const hip = new THREE.Group();
    hip.position.set(sx * rig.hipHalfWidth * o.fit.w, 0, 0);
    body.add(hip);
    const knee = new THREE.Group();
    knee.position.y = -rig.thigh;
    hip.add(knee);
    Object.assign(parts, {
      [`shoulder${side}`]: shoulder, [`elbow${side}`]: elbow, [`hand${side}`]: hand, [`hip${side}`]: hip, [`knee${side}`]: knee,
    });
  }
}

/** Skala tipe tubuh per jenis pivot: torso/pinggul (lebar, tebal), tungkai (tebal), kepala tidak. */
function fitScale(pivot, fit) {
  if (pivot === 'spine' || pivot === 'body') return [fit.w, 1, fit.d];
  if (LIMB_PIVOTS.has(pivot.replace(/[LR]$/, ''))) return [fit.limb, 1, fit.limb];
  return [1, 1, 1];
}

/** Pasang satu potongan kit `{g}_{name}` di pivot (sisi L/R bila sided); null bila geometri tak ada. */
function attach(parts, o, g, { pivot, name, sided, color, doubleSided }, castShadow = false) {
  const targets = sided ? SIDES.map(([side]) => [`${pivot}${side}`, `${name}_${side.toLowerCase()}`]) : [[pivot, name]];
  const out = [];
  for (const [pv, nm] of targets) {
    const geo = kitGeometry(`${g}_${nm}`);
    const parent = parts[pv];
    if (!geo || !parent) continue;
    const m = mesh(geo, color, { castShadow, doubleSided });
    m.scale.set(...fitScale(pv, o.fit));
    parent.add(m);
    out.push(m);
  }
  return out;
}

/**
 * Rambut/hijab/topi: geometri khusus kepala manekin (`{g}_hair_<gaya>`, `{g}_hijab`, `{g}_hat_pet`) bila ada di kit;
 * selain itu geometri gaya chibi dipaskan ke kotak kepala (cadangan).
 */
function buildHeadwear(parts, o, g, rig, hair) {
  const c = new THREE.Vector3(...rig.headCenter);
  const h = new THREE.Vector3(...rig.headHalf);
  const target = new THREE.Box3(c.clone().sub(h), c.clone().add(h));
  if (hair.style != null) {
    const own = kitGeometry(`${g}_${hair.style === 'hijab' ? 'hijab' : `hair_${hair.style}`}`);
    const hairMesh = own ? mesh(own, hair.color, { doubleSided: true }) : createHair(hair.style, hair.color);
    parts.headPivot.add(own ? hairMesh : fitted(hairMesh, boxOf(kitGeometry('head') ?? GEO.head), target));
    parts[hair.style === 'hijab' ? 'hijab' : 'hair'] = hairMesh;
    parts.hairStyle = hair.style;
  }
  if (o.hat != null && !HEADWEAR.has(hair.style)) {
    const own = kitGeometry(`${g}_hat_pet`);
    parts.hat = own ? mesh(own, o.hat, { doubleSided: true }) : createHat(o.hat);
    parts.headPivot.add(own ? parts.hat : fitted(parts.hat, boxOf(GEO.head), target));
  }
}

/**
 * Rakit manekin ke dalam `body` (Group pinggul yang sudah diskalakan tinggi). Mengisi `parts` seperti Humanoid chibi;
 * parts.outfit = ringkasan lemari ({top, bottom, pieces, hide}).
 * @param {THREE.Group} body
 * @param {Record<string, THREE.Object3D>} parts
 * @param {object} o opsi Humanoid yang sudah dinormalkan (fit, warna, bottom, top, aksesori, …)
 * @param {'m'|'f'} g
 * @param {object} rig kitRig(g)
 * @param {{style:string|null, color:number|null}} hair
 */
export function buildManekin(body, parts, o, g, rig, hair) {
  parts.body = body;
  buildSkeleton(body, parts, o, rig);
  const outfit = wardrobe(o);
  for (const [name, pivot] of Object.entries(BODY_PARTS)) {
    if (outfit.hide.has(name)) continue;
    const sided = pivot !== 'body' && pivot !== 'spine' && pivot !== 'headPivot';
    attach(parts, o, g, { pivot, name, sided, color: outfit.bodyColor[name], doubleSided: false }, name === 'head');
  }
  const worn = outfit.pieces.flatMap((p) => attach(parts, o, g, p, p.pivot === 'spine'));
  parts.torso = worn.find((m) => m.parent === parts.spine) ?? parts.spine;
  parts.head = parts.headPivot.children.find((m) => m.isMesh) ?? parts.headPivot;
  parts.bottom = worn.find((m) => m.parent === body) ?? body;
  parts.outfit = outfit;
  buildHeadwear(parts, o, g, rig, hair);
  for (const [side] of SIDES) parts[`foot${side}`] = parts[`knee${side}`].children.find((m) => m.isMesh) ?? parts[`knee${side}`];
  // Ukuran kaki per orang untuk pose duduk & IK sepeda (Humanoid.poses / Humanoid.anim / Bicycle).
  Object.assign(body.userData, { gender: g, thigh: rig.thigh, shin: rig.shin, thighR: rig.thighR });
}
