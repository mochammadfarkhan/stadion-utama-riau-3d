import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHumanoid } from '../src/entities/Humanoid.js';
import { addHumanoidPreset, clearHumanoidPresets, hasPreset, PRESET_BONES } from '../src/entities/Humanoid.preset.js';
import { bakeSkinnedHumanoid } from '../src/entities/Humanoid.skinned.js';

/** Posisi sendi dunia (mirip rig_preset.py, Y atas). */
const JOINTS = {
  body: [0, 0.89, 0], spine: [0, 0.89, 0], headPivot: [0, 1.37, 0],
  shoulderL: [0.154, 1.3, 0], elbowL: [0.154, 1.11, 0], handL: [0.154, 0.88, 0],
  shoulderR: [-0.154, 1.3, 0], elbowR: [-0.154, 1.11, 0], handR: [-0.154, 0.88, 0],
  hipL: [0.095, 0.89, 0], kneeL: [0.095, 0.48, 0], hipR: [-0.095, 0.89, 0], kneeR: [-0.095, 0.48, 0],
};
const PARENT = { spine: 'body', headPivot: 'spine', shoulderL: 'spine', elbowL: 'shoulderL', handL: 'elbowL',
  shoulderR: 'spine', elbowR: 'shoulderR', handR: 'elbowR', hipL: 'body', kneeL: 'hipL', hipR: 'body', kneeR: 'hipR' };
/** Vertex uji: [posisi, tulang]. */
const VERTS = [[[0.154, 1.0, 0.03], 'elbowL'], [[0, 1.6, 0.05], 'headPivot'], [[-0.095, 0.1, 0.05], 'kneeR']];

/**
 * Root GLB tiruan seperti keluaran Blender: tulang ber-rotasi rest bukan identitas (sumbu Y tulang = arah tulang),
 * urutan joint DIACAK, mesh ber-skin di bawah root.
 */
function fakePreset({ rename } = {}) {
  const root = new THREE.Group();
  const order = [...PRESET_BONES].reverse();
  const bones = Object.fromEntries(order.map((n) => {
    const b = new THREE.Bone();
    b.name = rename && n === 'kneeL' ? 'lutut' : n;
    return [n, b];
  }));
  const world = (n) => new THREE.Vector3(...JOINTS[n]);
  for (const n of PRESET_BONES) {
    const b = bones[n];
    b.quaternion.setFromEuler(new THREE.Euler(0.4, -0.3, 1.1)); // rotasi rest acak
    if (PARENT[n]) bones[PARENT[n]].add(b); else root.add(b);
  }
  root.updateMatrixWorld(true);
  for (const n of PRESET_BONES) { // set posisi lokal agar posisi dunia = JOINTS
    const b = bones[n];
    const parentInv = b.parent.matrixWorld.clone().invert();
    b.position.copy(world(n).applyMatrix4(parentInv));
    b.updateMatrixWorld(true);
  }
  const boneList = order.map((n) => bones[n]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(VERTS.flatMap(([p]) => p), 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(VERTS.flatMap(() => [0, 0, 1]), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(VERTS.flatMap(() => [1, 0.5, 0.25]), 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(VERTS.flatMap(([, b]) => [order.indexOf(b), 0, 0, 0]), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(VERTS.flatMap(() => [1, 0, 0, 0]), 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(boneList));
  return root;
}

/** Posisi dunia vertex i setelah skinning. */
function skinnedPos(h, i) {
  const { mesh } = h.group.userData.presetSkin;
  h.group.updateMatrixWorld(true);
  mesh.skeleton.update();
  const v = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i);
  return mesh.applyBoneTransform(i, v).applyMatrix4(mesh.matrixWorld);
}

afterEach(() => clearHumanoidPresets());

describe('karakter jadi (preset)', () => {
  it('tulang tidak lengkap/salah nama → tidak terpasang, createHumanoid jatuh ke bentuk biasa', () => {
    expect(addHumanoidPreset('x', fakePreset({ rename: true }))).toBe(false);
    expect(hasPreset('x')).toBe(false);
    const h = createHumanoid({ preset: 'x' });
    expect(h.group.userData.presetSkin).toBeUndefined();
  });

  it('rest pose = bind pose meski urutan & rotasi tulang sumber berbeda; tulang = pivot', () => {
    expect(addHumanoidPreset('uji', fakePreset())).toBe(true);
    const h = createHumanoid({ preset: 'uji' });
    expect(h.parts.elbowL.isBone).toBe(true);
    expect(h.parts.elbowL.quaternion.equals(new THREE.Quaternion())).toBe(true);
    VERTS.forEach(([p], i) => {
      expect(skinnedPos(h, i).distanceTo(new THREE.Vector3(...p))).toBeLessThan(1e-5);
    });
    expect(h.parts.body.userData).toMatchObject({ baseY: 0.89, gender: 'f' });
    expect(h.parts.body.userData.thigh).toBeCloseTo(0.41, 5);
  });

  it('memutar pivot siku menggerakkan vertex lengan bawah mengelilingi siku', () => {
    addHumanoidPreset('uji', fakePreset());
    const h = createHumanoid({ preset: 'uji' });
    h.parts.elbowL.rotation.x = -Math.PI / 2; // lengan bawah ke depan (+Z)
    const p = skinnedPos(h, 0);
    expect(p.x).toBeCloseTo(0.154, 4);
    expect(p.y).toBeCloseTo(1.11 + 0.03, 4); // (0, −0.11, 0.03) diputar −90° di X → (0, 0.03, 0.11)
    expect(p.z).toBeCloseTo(0.11, 4);
    expect(skinnedPos(h, 1).distanceTo(new THREE.Vector3(0, 1.6, 0.05))).toBeLessThan(1e-5); // kepala diam
  });

  it('tinggi badan menskalakan dari kaki; bake skinned memakai mesh preset tanpa menggandakan', () => {
    addHumanoidPreset('uji', fakePreset());
    const tall = createHumanoid({ preset: 'uji' });
    const nat = tall.height;
    const h = createHumanoid({ preset: 'uji', height: nat * 0.5 });
    expect(h.parts.body.userData.baseScale).toBeCloseTo(0.5, 6);
    expect(skinnedPos(h, 2).y).toBeCloseTo(0.05, 5); // vertex lutut kanan y=0.1 → 0.05
    const skin = bakeSkinnedHumanoid(h);
    expect(skin.mesh).toBe(h.group.userData.presetSkin.mesh);
    expect(h.group.children.filter((o) => o.isSkinnedMesh)).toHaveLength(1);
  });
});
