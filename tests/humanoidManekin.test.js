import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  addHumanoidKit, clearHumanoidKit, kitRig, MANEKIN_PART_NAMES, setAvatarStyle,
} from '../src/entities/Humanoid.kit.js';
import { createHumanoid } from '../src/entities/Humanoid.js';
import { resolveGender } from '../src/entities/Humanoid.manekin.js';

const RIG = {
  hipY: 0.92, hipHalfWidth: 0.08, neck: [0, 0.63, -0.1], shoulderL: [0.15, 0.44, -0.08], shoulderR: [-0.15, 0.44, -0.08],
  upperArm: 0.3, lowerArm: 0.25, thigh: 0.39, shin: 0.46, thighR: 0.07, headCenter: [0, 0.04, 0.06], headHalf: [0.07, 0.11, 0.1],
};

/** Root GLB tiruan: semua segmen gender `g` (kotak kecil) + node rig_<g> berextras. */
function fakeKit(g, rig = RIG) {
  const root = new THREE.Group();
  for (const p of MANEKIN_PART_NAMES) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
    m.name = `${g}_${p}`;
    root.add(m);
  }
  const node = new THREE.Object3D();
  node.name = `rig_${g}`;
  node.userData = { ...rig };
  root.add(node);
  return root;
}

afterEach(() => {
  clearHumanoidKit();
  setAvatarStyle('manekin');
});

describe('kit manekin', () => {
  it('rig terpasang hanya bila semua segmen ada dan userData lengkap', () => {
    expect(addHumanoidKit(fakeKit('m'))).toContain('rig_m');
    expect(kitRig('m')).toMatchObject({ hipY: 0.92, thigh: 0.39 });
    expect(kitRig('f')).toBeNull();
    clearHumanoidKit();
    addHumanoidKit(fakeKit('f', { ...RIG, neck: [0, 'x', 0] }));
    expect(kitRig('f')).toBeNull();
  });

  it('gaya chibi mematikan rig tanpa melepas kit', () => {
    addHumanoidKit(fakeKit('m'));
    setAvatarStyle('chibi');
    expect(kitRig('m')).toBeNull();
    expect(setAvatarStyle('apa saja')).toBe('manekin');
    expect(kitRig('m')).not.toBeNull();
  });

  it('Humanoid manekin memakai pivot rig, tanpa wajah, dan menyimpan ukuran kaki', () => {
    addHumanoidKit(fakeKit('m'));
    const h = createHumanoid({ gender: 'm', hair: null, height: 1.7 });
    expect(h.parts.body.position.y).toBeCloseTo(0.92);
    expect(h.parts.headPivot.position.toArray()).toEqual([0, 0.63, -0.1]);
    expect(h.parts.elbowL.position.y).toBeCloseTo(-0.3);
    expect(h.parts.kneeR.position.y).toBeCloseTo(-0.39);
    expect(h.parts.face).toBeUndefined();
    expect(h.parts.body.userData).toMatchObject({ gender: 'm', thigh: 0.39, shin: 0.46, thighR: 0.07 });
  });

  it('tanpa kit manekin tetap chibi/prosedural (wajah ada)', () => {
    const h = createHumanoid({ hair: null });
    expect(h.parts.face).toBeDefined();
    expect(h.parts.body.userData.gender).toBeUndefined();
  });
});

describe('resolveGender', () => {
  it('eksplisit menang; hijab/rok/rambut panjang → f; selain itu m', () => {
    expect(resolveGender({ gender: 'm', hijab: 0x123 }, 'long')).toBe('m');
    expect(resolveGender({ hijab: 0x123 }, null)).toBe('f');
    expect(resolveGender({ bottom: 'longskirt' }, 'buzz')).toBe('f');
    expect(resolveGender({}, 'bob')).toBe('f');
    expect(resolveGender({ bottom: 'pants' }, 'afro')).toBe('m');
  });
});
