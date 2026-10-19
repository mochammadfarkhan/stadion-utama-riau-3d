import { describe, it, expect } from 'vitest';
import { createHumanoid } from '../src/entities/Humanoid.js';
import {
  randomStudentOutfit, campusGuardOutfit, ALMAMATER_COLOR, ALMAMATER_BADGE, GUARD_UNIFORM,
} from '../src/entities/Humanoid.outfits.js';
import { makeRng } from '../src/entities/util.js';
import { createStudentKit, STUDENT_LOD } from '../src/entities/Student.js';

describe('randomStudentOutfit (katalog C01/C02)', () => {
  const rng = makeRng(1);
  const outfits = Array.from({ length: 3000 }, () => randomStudentOutfit(rng));
  it('±30% berjas almamater biru langit berlengan panjang + lencana', () => {
    const alma = outfits.filter((o) => o.shirt === ALMAMATER_COLOR);
    expect(alma.length / outfits.length).toBeGreaterThan(0.26);
    expect(alma.length / outfits.length).toBeLessThan(0.34);
    alma.forEach((o) => { expect(o.longSleeve).toBe(true); expect(o.badge).toBe(ALMAMATER_BADGE); });
  });
  it('tanpa celana pendek, topi, rompi, atau caping; ±70% beransel', () => {
    outfits.forEach((o) => {
      expect(o.bottom).not.toBe('shorts');
      expect(o.hat).toBeNull();
      expect(o.vest).toBeNull();
      expect(o.hair).not.toBe('caping');
    });
    const pack = outfits.filter((o) => o.backpack != null).length / outfits.length;
    expect(pack).toBeGreaterThan(0.65);
    expect(pack).toBeLessThan(0.75);
  });
  it('almamaterChance 1 → selalu almamater', () => {
    expect(randomStudentOutfit(makeRng(3), { almamaterChance: 1 }).shirt).toBe(ALMAMATER_COLOR);
  });
});

describe('ransel ikut mesh LOD gabungan', () => {
  it('opsi backpack menambah part dan vertex mesh LOD', () => {
    const base = { shirt: 0xff0000, hair: 'buzz', hairColor: 0x222222 };
    const plain = createHumanoid(base);
    const bag = createHumanoid({ ...base, backpack: 0x222222 });
    expect(plain.parts.backpack).toBeUndefined();
    expect(bag.parts.backpack.isMesh).toBe(true);
    const count = (h) => h.group.userData.humanoidLod.mesh.geometry.attributes.position.count;
    expect(count(bag)).toBeGreaterThan(count(plain));
  });
});

describe('satpam & kit', () => {
  it('seragam satpam kampus', () => {
    const o = campusGuardOutfit(makeRng(2));
    expect(o).toMatchObject({ shirt: GUARD_UNIFORM.shirt, pants: GUARD_UNIFORM.pants, hat: GUARD_UNIFORM.hat, bottom: 'pants' });
  });
  it('kit deterministik per benih; LOD ambang mahasiswa', () => {
    const kit = createStudentKit();
    const a = kit.createStudent(11);
    const b = kit.createStudent(11);
    expect(a.parts.torso.material.color.getHex()).toBe(b.parts.torso.material.color.getHex());
    expect(a.group.userData.humanoidLod).toBeDefined();
    expect(STUDENT_LOD).toEqual({ near: 30, far: 220 });
    const lod = kit.createLod();
    expect(lod.addFrom(a.group)).toBe(1);
    kit.dispose(a);
  });
});
