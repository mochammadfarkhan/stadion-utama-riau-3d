/**
 * Karakter jadi (model user, di-rig oleh assets-src/blender/karakter/rig_preset.py → public/models/karakter/preset-<id>.glb):
 * SATU SkinnedMesh berwarna vertex (1 draw call) dengan 13 tulang bernama sama dengan pivot Humanoid. Di sini tulang
 * dibuat ulang dengan rotasi rest identitas dan TULANG ITU SENDIRI menjadi pivot (parts.body, parts.shoulderL, …),
 * sehingga Humanoid.anim / Humanoid.poses / pegangan tangan langsung menggerakkan mesh tanpa sync.
 *
 * Alur: addHumanoidPreset(id, root) sekali saat muat (menyalin geometri + posisi sendi), lalu
 * createHumanoid({ preset: id, … }) memanggil createPresetHumanoid. Bila GLB belum/tidak termuat, createHumanoid
 * jatuh ke manekin/chibi biasa (hasPreset → false).
 */
import * as THREE from 'three';
import { currentScope } from '../engine/ResourceScope.js';

export const PRESET_IDS = Object.freeze(['tactical_blonde', 'tactical_hijab', 'cardigan_hijab']);
export const presetPath = (id) => `models/karakter/preset-${id}.glb`;
export const PRESET_PATHS = Object.freeze(PRESET_IDS.map(presetPath));

/** Urutan tulang = urutan pivot Humanoid.skinned (SKIN_PIVOTS); induk tiap tulang. */
export const PRESET_BONES = Object.freeze([
  'body', 'spine', 'headPivot', 'shoulderL', 'elbowL', 'handL', 'shoulderR', 'elbowR', 'handR', 'hipL', 'kneeL', 'hipR', 'kneeR',
]);
const PARENT = Object.freeze({
  spine: 'body', headPivot: 'spine', shoulderL: 'spine', elbowL: 'shoulderL', handL: 'elbowL',
  shoulderR: 'spine', elbowR: 'shoulderR', handR: 'elbowR', hipL: 'body', kneeL: 'hipL', hipR: 'body', kneeR: 'hipR',
});
const THIGH_R = 0.08; // tebal paha (pose duduk: tinggi pinggul di atas kursi/lantai)

/** @type {Map<string, {geometry: THREE.BufferGeometry, joints: Record<string, THREE.Vector3>, height: number}>} */
let presets = new Map();

const presetMaterial = () => currentScope().get('humanoid:presetMaterial', () => new THREE.MeshLambertMaterial({
  vertexColors: true,
}));

/**
 * Salin geometri ber-skin + posisi sendi rest dari root GLB preset (root tidak diubah).
 * skinIndex dipetakan ulang ke urutan PRESET_BONES; warna vertex dijadikan RGB float.
 * @returns {boolean} true bila preset terpasang
 */
export function addHumanoidPreset(id, root) {
  let skinned = null;
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (!skinned && o.isSkinnedMesh) skinned = o; });
  if (!skinned) return false;
  const bones = skinned.skeleton.bones;
  const remap = bones.map((b) => PRESET_BONES.indexOf(b.name));
  if (remap.some((i) => i < 0) || PRESET_BONES.some((n) => !bones.find((b) => b.name === n))) return false;
  const joints = {};
  for (const b of bones) joints[b.name] = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);

  const src = skinned.geometry;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', src.getAttribute('position').clone());
  geo.setAttribute('normal', src.getAttribute('normal').clone());
  geo.applyMatrix4(skinned.matrixWorld);
  const col = src.getAttribute('color');
  const n = geo.attributes.position.count;
  const rgb = new Float32Array(n * 3).fill(1);
  if (col) for (let i = 0; i < n; i += 1) rgb.set([col.getX(i), col.getY(i), col.getZ(i)], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  const si = src.getAttribute('skinIndex');
  const idx = new Uint16Array(n * 4);
  for (let i = 0; i < n * 4; i += 1) idx[i] = remap[si.array[i]] ?? 0;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', src.getAttribute('skinWeight').clone());
  if (src.index) geo.setIndex(src.index.clone());
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const prev = presets.get(id);
  if (prev) prev.geometry.dispose();
  presets = new Map(presets).set(id, { geometry: geo, joints, height: geo.boundingBox.max.y });
  return true;
}

export const hasPreset = (id) => presets.has(id);

/** Lepas semua preset (tes / halaman dev). */
export function clearHumanoidPresets() {
  for (const p of presets.values()) p.geometry.dispose();
  presets = new Map();
}

/**
 * Humanoid dari preset: { group, parts, height } seperti createHumanoid; group.userData.presetSkin = { mesh, skeleton }.
 * @param {string} id salah satu PRESET_IDS (harus sudah addHumanoidPreset)
 * @param {{height?: number}} [opts] tinggi badan (m); default tinggi asli model
 */
export function createPresetHumanoid(id, opts = {}) {
  const preset = presets.get(id);
  if (!preset) throw new Error(`Preset karakter "${id}" belum dimuat`);
  const { geometry, joints } = preset;
  const height = Number.isFinite(opts.height) && opts.height > 0 ? opts.height : preset.height;
  const scale = height / preset.height;
  const group = new THREE.Group();
  const parts = {};
  for (const name of PRESET_BONES) {
    const bone = new THREE.Bone();
    bone.name = name;
    const parent = PARENT[name];
    if (parent) bone.position.subVectors(joints[name], joints[parent]);
    else bone.position.copy(joints[name]);
    parts[name] = bone;
    (parent ? parts[parent] : group).add(bone);
  }
  const { body, headPivot } = parts;
  // Invers tulang dihitung pada ukuran asli (= bind pose geometri); skala tinggi baru diterapkan sesudahnya.
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(PRESET_BONES.map((nm) => parts[nm]));
  const mesh = new THREE.SkinnedMesh(geometry, presetMaterial());
  mesh.name = `preset-${id}`;
  mesh.castShadow = true;
  mesh.frustumCulled = false; // pose duduk/rebahan keluar dari bounding sphere pose diam
  group.add(mesh);
  mesh.bind(skeleton);
  body.position.multiplyScalar(scale);
  body.scale.setScalar(scale);
  const thigh = joints.hipL.distanceTo(joints.kneeL);
  Object.assign(body.userData, {
    baseY: body.position.y, baseScale: scale, gender: 'f', thigh, shin: joints.kneeL.y, thighR: THIGH_R,
  });
  headPivot.userData.baseY = headPivot.position.y;
  Object.assign(parts, {
    torso: parts.spine, head: headPivot, bottom: body, footL: parts.kneeL, footR: parts.kneeR, preset: id,
  });
  group.userData.presetSkin = { mesh, skeleton };
  return { group, parts, height };
}
