/**
 * Kit bagian chibi kartun dari Blender (assets-src/blender/karakter/chibi_kit.py → public/models/karakter/chibi-kit.glb):
 * kepala bertelinga, wajah mata anime (warna per-vertex), rambut, hijab, dan torso berkerah. Setelah setHumanoidKit()
 * dipanggil (sekali saat muat, sebelum entitas dibuat), Humanoid memakai geometri ini menggantikan bentuk prosedural;
 * bila GLB gagal dimuat, kitGeometry() mengembalikan null dan Humanoid tetap memakai bentuk lama.
 *
 * Geometri disalin dan dinormalkan ke atribut position + normal (+ color float RGB untuk wajah) agar bisa digabung
 * dengan kepingan prosedural (kacamata/kumis) dan dibakar ke LOD / SkinnedMesh.
 */
import * as THREE from 'three';

export const HUMANOID_KIT_PATH = 'models/karakter/chibi-kit.glb';
/**
 * Kit avatar manekin tanpa wajah (assets-src/blender/karakter/manekin_kit.py): segmen pria `m_*` & wanita `f_*`
 * dalam ruang pivot Humanoid + node `rig_m`/`rig_f` (glTF extras: ukuran tulang). Dimuat BERSAMA kit chibi
 * (rambut/hijab/topi masih dari kit chibi, dipaskan ke kepala manekin oleh Humanoid.manekin.js).
 */
export const MANEKIN_KIT_PATH = 'models/karakter/manekin-kit.glb';
/** Semua kit yang dimuat composition root (urutan bebas; addHumanoidKit bersifat aditif). */
export const HUMANOID_KIT_PATHS = Object.freeze([HUMANOID_KIT_PATH, MANEKIN_KIT_PATH]);
export const MANEKIN_PART_NAMES = Object.freeze([
  'pelvis', 'torso', 'neck', 'head',
  ...['l', 'r'].flatMap((s) => [`arm_upper_${s}`, `arm_lower_${s}`, `hand_${s}`, `leg_thigh_${s}`, `leg_shin_${s}`, `foot_${s}`]),
]);
export const GENDERS = Object.freeze(['m', 'f']);
/** Nama node yang dikenali; hair_<gaya> menggantikan gaya rambut prosedural dengan nama sama. */
export const KIT_PARTS = Object.freeze([
  'head', 'face', 'face_g', 'face_m', 'face_gm', 'torso', 'hijab',
  'hair_helmet', 'hair_bob', 'hair_long', 'hair_bun', 'hair_twintails', 'hair_buzz', 'hair_afro',
  'hair_cap', 'hair_hardhat',
  'arm_upper_short', 'arm_upper_long', 'arm_lower_skin', 'arm_lower_sleeve', 'hand',
  'leg_thigh', 'leg_shin', 'leg_thigh_wide', 'leg_shin_wide', 'shoe', 'shorts', 'hips', 'skirt', 'skirt_long',
  ...GENDERS.flatMap((g) => MANEKIN_PART_NAMES.map((p) => `${g}_${p}`)),
]);
const RIG_KEYS = Object.freeze(['hipY', 'hipHalfWidth', 'neck', 'shoulderL', 'shoulderR', 'upperArm', 'lowerArm',
  'thigh', 'shin', 'thighR', 'headCenter', 'headHalf']);

/** @type {Map<string, THREE.BufferGeometry>} */
let parts = new Map();
/** @type {Record<string, Readonly<object>>} rig per gender dari node rig_<g> */
let rigs = {};
/** 'manekin' (default bila kit manekin termuat) | 'chibi' (gaya lama tetap bisa dipilih). */
let avatarStyle = 'manekin';

/** Salinan geometri dalam ruang root: hanya position/normal/color(RGB float), index dipertahankan. */
function normalized(mesh) {
  const src = mesh.geometry;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', src.getAttribute('position').clone());
  if (src.getAttribute('normal')) geo.setAttribute('normal', src.getAttribute('normal').clone());
  const col = src.getAttribute('color');
  if (col) {
    const rgb = new Float32Array(col.count * 3);
    for (let i = 0; i < col.count; i += 1) {
      rgb[i * 3] = col.getX(i);
      rgb[i * 3 + 1] = col.getY(i);
      rgb[i * 3 + 2] = col.getZ(i);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
  }
  if (src.index) geo.setIndex(src.index.clone());
  geo.applyMatrix4(mesh.matrixWorld);
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Pasang kit dari root GLB (sumber loadModel; tidak diubah). Mengembalikan daftar bagian yang terpasang.
 * @param {THREE.Object3D} root
 * @returns {string[]}
 */
export function setHumanoidKit(root) {
  clearHumanoidKit();
  return addHumanoidKit(root);
}

/** Bagian kit dikenali: daftar KIT_PARTS, atau segmen/baju/aksesori manekin `m_*` / `f_*` (Humanoid.wardrobe.js). */
const isKitPart = (name) => KIT_PARTS.includes(name) || /^[mf]_[a-z0-9_]+$/.test(name ?? '');

/** Validasi rig dari userData node rig_<g>: semua kunci wajib angka/array angka hingga. */
function readRig(data) {
  const ok = RIG_KEYS.every((k) => {
    const v = data?.[k];
    return Array.isArray(v) ? v.length === 3 && v.every(Number.isFinite) : Number.isFinite(v);
  });
  return ok ? Object.freeze(Object.fromEntries(RIG_KEYS.map((k) => [k, Array.isArray(data[k]) ? Object.freeze([...data[k]]) : data[k]]))) : null;
}

/**
 * Tambahkan bagian dari root GLB ke kit yang sudah ada (bagian bernama sama dari kit sebelumnya dipertahankan).
 * Node `rig_<g>` dengan userData lengkap menjadi rig gender itu. Mengembalikan daftar bagian + rig yang ditambahkan.
 * @param {THREE.Object3D} root
 * @returns {string[]}
 */
export function addHumanoidKit(root) {
  const added = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const rigMatch = /^rig_([a-z])$/.exec(o.name);
    if (rigMatch && GENDERS.includes(rigMatch[1])) {
      const rig = readRig(o.userData);
      if (rig) {
        rigs = { ...rigs, [rigMatch[1]]: rig };
        added.push(o.name);
      }
      return;
    }
    const name = o.isMesh ? (isKitPart(o.name) ? o.name : o.parent?.name) : null;
    if (name && isKitPart(name) && !parts.has(name)) {
      parts.set(name, normalized(o));
      added.push(name);
    }
  });
  return added;
}

/** Geometri kit untuk sebuah bagian, atau null bila kit belum/tidak dimuat. */
export function kitGeometry(name) {
  return parts.get(name) ?? null;
}

/**
 * Rig manekin untuk gender ('m'|'f'), atau null bila gaya chibi dipilih / kit manekin belum lengkap termuat.
 * @returns {Readonly<{hipY:number, hipHalfWidth:number, neck:number[], shoulderL:number[], shoulderR:number[],
 *   upperArm:number, lowerArm:number, thigh:number, shin:number, thighR:number, headCenter:number[], headHalf:number[]}>|null}
 */
export function kitRig(gender) {
  if (avatarStyle !== 'manekin') return null;
  const rig = rigs[gender] ?? null;
  return rig && MANEKIN_PART_NAMES.every((p) => parts.has(`${gender}_${p}`)) ? rig : null;
}

/** Pilih gaya avatar untuk Humanoid yang dibuat SETELAH ini: 'manekin' (default) | 'chibi'. */
export function setAvatarStyle(style) {
  avatarStyle = style === 'chibi' ? 'chibi' : 'manekin';
  return avatarStyle;
}

/**
 * Muat semua kit (HUMANOID_KIT_PATHS) lewat `load(path) → Promise<Object3D>` lalu pasang aditif; kit yang gagal
 * dilewati dengan peringatan. Dipakai halaman dev (studio karakter/reels); main.js memakai loadModel sendiri.
 * @returns {Promise<string[]>} bagian + rig yang terpasang
 */
export async function loadHumanoidKits(load) {
  clearHumanoidKit();
  const roots = await Promise.all(HUMANOID_KIT_PATHS.map((p) => load(p).catch((err) => {
    console.warn(`Kit karakter ${p} gagal dimuat:`, err);
    return null;
  })));
  return roots.filter(Boolean).flatMap((root) => addHumanoidKit(root));
}

/** Lepas kit (dipakai tes; Humanoid kembali ke bentuk prosedural). */
export function clearHumanoidKit() {
  for (const g of parts.values()) g.dispose();
  parts = new Map();
  rigs = {};
}
