import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNightLights } from '../src/world/TimeOfDay.lights.js';
import { createWetSurfaces } from '../src/world/Weather.wet.js';
import { WEATHER } from '../src/config/constants.js';

const rootWith = (mat, name = 'objek') => {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(), mat);
  m.name = name;
  g.add(m);
  return g;
};
const runFrames = (night, n) => { for (let i = 0; i < n; i += 1) night.update(0.1, { x: 0, z: 0 }, 0); };

describe('lampu malam: grup pemilik & registry emissive', () => {
  it('objek lampu menempel ke grup pemilik, bukan scene', () => {
    const parent = new THREE.Group();
    createNightLights(parent, { lamps: [{ x: 0, z: 0 }] });
    expect(parent.getObjectByName('lampuSepeda')).toBeTruthy();
    expect(parent.getObjectByName('kolamCahayaPJU')).toBeTruthy();
    expect(parent.getObjectByName('floodlightSorot-0')).toBeTruthy();
  });

  it('material yang didaftarkan belakangan (mis. GLB) ikut menyala; unregister memulihkan nilai siang', () => {
    const night = createNightLights(new THREE.Group(), { lamps: [] });
    const glow = new THREE.MeshStandardMaterial({ emissive: 0xffaa00, emissiveIntensity: 0.5 });
    const tagged = new THREE.MeshStandardMaterial({ emissive: 0x8fa6ff, emissiveIntensity: 0 });
    tagged.userData.nightEmissive = { on: 0.3, off: 0 };
    const root = new THREE.Group();
    root.add(rootWith(glow), rootWith(tagged));
    night.setLampsOn(true);
    runFrames(night, 5);
    expect(glow.emissiveIntensity).toBe(0.5);
    night.registerEmissive(root);
    expect(night.emissiveCount).toBe(2);
    runFrames(night, 200);
    expect(glow.emissiveIntensity).toBeCloseTo(0.9, 5); // 0,5 × boost 1,8
    expect(tagged.emissiveIntensity).toBeCloseTo(0.3, 5);
    night.unregisterEmissive(root);
    expect(glow.emissiveIntensity).toBe(0.5);
    expect(tagged.emissiveIntensity).toBe(0);
    expect(night.emissiveCount).toBe(0);
  });
});

describe('permukaan basah: grup pemilik & registry', () => {
  it('genangan menempel ke grup pemilik; hanya mesh bernama permukaan basah yang terdaftar', () => {
    const parent = new THREE.Group();
    const wet = createWetSurfaces(parent);
    expect(parent.getObjectByName('genangan')).toBe(wet.group);
    const road = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const other = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const root = new THREE.Group();
    root.add(rootWith(road, 'aspal+3'), rootWith(other, 'atapSeng'));
    wet.register(root);
    expect(wet.count).toBe(1);
    wet.update(0.1, 1);
    expect(road.roughness).toBeCloseTo(WEATHER.wetRoughness, 6);
    expect(road.color.r).toBeCloseTo(WEATHER.wetDarken, 6);
    expect(other.roughness).toBe(0.9);
    wet.unregister(root);
    expect(road.roughness).toBeCloseTo(0.9, 6);
    expect(road.color.r).toBeCloseTo(1, 6);
  });

  it('material yang didaftarkan saat hujan sudah berjalan ikut basah pada frame berikutnya', () => {
    const wet = createWetSurfaces(new THREE.Group());
    wet.update(0.1, 0.5);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    wet.register(rootWith(mat, 'rumput'));
    wet.update(0.1, 0.5);
    expect(mat.roughness).toBeCloseTo(0.9 + (WEATHER.wetRoughness - 0.9) * 0.5, 6);
  });
});
