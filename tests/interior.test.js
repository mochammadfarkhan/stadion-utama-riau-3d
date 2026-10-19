import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { defineInterior, validateInteriorBuild, nearestInteractable } from '../src/interiors/Interior.js';
import { createRoomCollider } from '../src/interiors/roomCollider.js';

const spec = (over = {}) => ({
  id: 'uji', label: 'Ruang uji', size: { w: 4, d: 6, h: 3 }, spawn: { x: 1, z: -2, yaw: 0 },
  exitTo: { region: 'unri-lembaga', x: 10, z: 5, yaw: 0 }, build: async () => ({}), ...over,
});
const item = (over = {}) => ({
  id: 'papan', label: 'Papan', pos: { x: 0, y: 1.5, z: 2 }, radius: 2, prompt: 'Lihat', onInteract: () => {}, ...over,
});
const build = (over = {}) => ({
  scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), colliders: { isWalkable: () => true },
  interactables: [item()], photoPresets: [{ id: 'a', label: 'A', pose: { position: [0, 1, 0], target: [0, 1, 1], fov: 60 } }],
  systems: [{ id: 'interior.uji', phase: 'sim', update() {} }], dispose() {}, ...over,
});

describe('defineInterior', () => {
  it('mengembalikan salinan beku dengan field tervalidasi', () => {
    const def = defineInterior(spec());
    expect(Object.isFrozen(def)).toBe(true);
    expect(Object.isFrozen(def.size)).toBe(true);
    expect(def.spawn).toEqual({ x: 1, z: -2, yaw: 0 });
    expect(def.exitTo.region).toBe('unri-lembaga');
  });

  it.each([
    [{ id: '' }, 'id'],
    [{ label: '' }, 'label'],
    [{ size: { w: 4, d: 0, h: 3 } }, 'size'],
    [{ spawn: { x: 1, z: Number.NaN, yaw: 0 } }, 'spawn'],
    [{ spawn: { x: 9, z: 0, yaw: 0 } }, 'spawn di luar ruang'],
    [{ exitTo: { region: '', x: 0, z: 0, yaw: 0 } }, 'exitTo'],
    [{ build: null }, 'build'],
  ])('menolak spec tidak valid %#', (over, msg) => {
    expect(() => defineInterior(spec(over))).toThrow(msg);
  });
});

describe('validateInteriorBuild', () => {
  it('hasil lengkap lolos dan dikembalikan apa adanya', () => {
    const b = build();
    expect(validateInteriorBuild(b, 'uji')).toBe(b);
  });

  it('melaporkan semua bagian yang hilang sekaligus', () => {
    expect(() => validateInteriorBuild({}, 'uji')).toThrow(/scene, camera, colliders\.isWalkable, interactables, photoPresets, systems, dispose/);
  });

  it('id sistem wajib berawalan "interior." dan fase dikenal', () => {
    expect(() => validateInteriorBuild(build({ systems: [{ id: 'npc', phase: 'sim', update() {} }] }), 'uji')).toThrow('systems[0].id');
    expect(() => validateInteriorBuild(build({ systems: [{ id: 'interior.x', phase: 'render', update() {} }] }), 'uji')).toThrow('systems[0].phase');
  });

  it('id barang interaktif unik dan pos/radius/prompt/onInteract valid', () => {
    expect(() => validateInteriorBuild(build({ interactables: [item(), item()] }), 'uji')).toThrow('interactables[1].id');
    expect(() => validateInteriorBuild(build({ interactables: [item({ radius: 0 })] }), 'uji')).toThrow('interactables[0].radius');
    expect(() => validateInteriorBuild(build({ interactables: [item({ pos: { x: 0, y: 1 } })] }), 'uji')).toThrow('interactables[0].pos');
  });

  it('preset foto butuh pose {position, target} 3 angka', () => {
    const bad = [{ id: 'a', label: 'A', pose: { position: [0, 1], target: [0, 1, 1] } }];
    expect(() => validateInteriorBuild(build({ photoPresets: bad }), 'uji')).toThrow('photoPresets[0].pose');
  });
});

describe('nearestInteractable', () => {
  const eye = { x: 0, y: 1.55, z: 0 };
  it('memilih barang yang sedang dilihat dalam radius', () => {
    const a = item({ id: 'a', pos: { x: 0, y: 1.5, z: 1.5 } });
    expect(nearestInteractable([a], eye, { x: 0, y: 0, z: 1 })).toBe(a);
  });
  it('mengabaikan barang di belakang dan di luar radius', () => {
    const behind = item({ id: 'b', pos: { x: 0, y: 1.5, z: -1.5 } });
    const far = item({ id: 'c', pos: { x: 0, y: 1.5, z: 5 }, radius: 2 });
    expect(nearestInteractable([behind, far], eye, { x: 0, y: 0, z: 1 })).toBeNull();
  });
  it('dua barang berdekatan: yang dipilih mengikuti arah pandang (atas vs bawah)', () => {
    const atas = item({ id: 'atas', pos: { x: 0, y: 2.5, z: 1.2 } });
    const bawah = item({ id: 'bawah', pos: { x: 0, y: 0.6, z: 1.2 } });
    expect(nearestInteractable([atas, bawah], eye, { x: 0, y: 0.6, z: 0.8 }).id).toBe('atas');
    expect(nearestInteractable([atas, bawah], eye, { x: 0, y: -0.6, z: 0.8 }).id).toBe('bawah');
  });
  it('barang sangat dekat cukup tidak di belakang; masukan rusak → null', () => {
    const dekat = item({ id: 'd', pos: { x: 0.4, y: 0.3, z: 0.1 } });
    expect(nearestInteractable([dekat], eye, { x: 0, y: 0, z: 1 })).toBe(dekat);
    expect(nearestInteractable(null, eye, { x: 0, y: 0, z: 1 })).toBeNull();
    expect(nearestInteractable([dekat], { x: Number.NaN, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })).toBeNull();
  });
});

describe('createRoomCollider', () => {
  const c = createRoomCollider({
    halfW: 2, halfD: 3, radius: 0.25,
    solids: [{ id: 'meja', x0: 1, x1: 2, z0: 0, z1: 1 }],
    tallSolids: [{ id: 'lemari', x0: -2, x1: -1, z0: 2.5, z1: 3 }],
    blockers: () => [{ x: 0, z: -1, r: 0.3 }],
  });
  it('dinding: radius pemain dihormati', () => {
    expect(c.isWalkable(1.7, 0 - 0.5)).toBe(true);
    expect(c.isWalkable(1.8, -2)).toBe(false);
    expect(c.isWalkable(0, 2.8)).toBe(false);
  });
  it('perabot & NPC menghalangi (diperluas radius)', () => {
    expect(c.isWalkable(0.8, 0.5)).toBe(false);
    expect(c.isWalkable(0.7, 0.5)).toBe(true);
    expect(c.isWalkable(0.4, -1)).toBe(false);
    expect(c.isWalkable(0.6, -1)).toBe(true);
  });
  it('kamera: dinding (margin kecil) & perabot tinggi', () => {
    expect(c.isCameraClear(1.9, 0)).toBe(true);
    expect(c.isCameraClear(1.97, 0)).toBe(false);
    expect(c.isCameraClear(-1.5, 2.7)).toBe(false);
    expect(c.isCameraClear(1.5, 0.5)).toBe(true);
  });
  it('NaN tidak walkable', () => {
    expect(c.isWalkable(Number.NaN, 0)).toBe(false);
    expect(c.isCameraClear(0, Number.NaN)).toBe(false);
  });
});
