/**
 * Pos jaga kecil gaya cozy: pelat dasar membulat, dinding balok membulat, pintu,
 * jendela kaca, atap dua tingkat tebal bertepi membulat (proporsi mainan).
 * Pintu menghadap +Z lokal. createGuardPosts() mengkloning (geometri/material dibagikan).
 */
import { Group, Mesh } from 'three';
import { Materials } from '../materials.js';
import { roundedBox } from '../siteutil/rounded.js';

const DEFAULTS = Object.freeze({ width: 3, depth: 3, wallHeight: 2.8 });
const SLAB_PAD = 0.3;
const SLAB_H = 0.18;
const DOOR = { w: 0.9, h: 2.1, d: 0.1 };
const WINDOW = { w: 1.2, h: 0.9, d: 0.08, sillY: 1.3 };
const ROOF = Object.freeze({ overhang: 0.5, lowerH: 0.5, upperH: 0.4, upperInset: 0.7 });
const EDGE = Object.freeze({ slab: 0.06, wall: 0.08, roof: 0.15, small: 0.03 });

function part(geom, material, x, y, z, name) {
  const m = new Mesh(geom, material);
  m.position.set(x, y, z);
  m.name = name;
  return m;
}

/** Jendela kaca di tiga sisi (kiri, kanan, belakang). */
function addWindows(group, width, depth) {
  const y = WINDOW.sillY + WINDOW.h / 2;
  const sideGeom = roundedBox(WINDOW.d, WINDOW.h, WINDOW.w, EDGE.small);
  const backGeom = roundedBox(WINDOW.w, WINDOW.h, WINDOW.d, EDGE.small);
  group.add(part(sideGeom, Materials.glass(), -width / 2, y, 0, 'window-l'));
  group.add(part(sideGeom, Materials.glass(), width / 2, y, 0, 'window-r'));
  group.add(part(backGeom, Materials.glass(), 0, y, -depth / 2, 'window-back'));
}

/** Atap dua tingkat tebal membulat: pelat lebar + pelat lebih kecil di atasnya. */
function addRoof(group, width, depth, baseY) {
  const w = width + ROOF.overhang * 2;
  const d = depth + ROOF.overhang * 2;
  const lower = part(roundedBox(w, ROOF.lowerH, d, EDGE.roof), Materials.terracotta(), 0, baseY + ROOF.lowerH / 2 - 0.05, 0, 'roof');
  const upper = part(roundedBox(w - ROOF.upperInset * 2, ROOF.upperH, d - ROOF.upperInset * 2, EDGE.roof), Materials.terracotta(), 0, baseY + ROOF.lowerH + ROOF.upperH / 2 - 0.1, 0, 'roof-top');
  lower.castShadow = true;
  upper.castShadow = true;
  group.add(lower, upper);
}

/**
 * @param {{width?:number, depth?:number, wallHeight?:number}} opts
 * @returns {Group}
 */
export function createGuardPost(opts = {}) {
  const { width, depth, wallHeight } = { ...DEFAULTS, ...opts };
  const g = new Group();
  g.name = 'guard-post';
  g.add(part(roundedBox(width + SLAB_PAD * 2, SLAB_H, depth + SLAB_PAD * 2, EDGE.slab), Materials.concrete(), 0, SLAB_H / 2, 0, 'slab'));
  const walls = part(roundedBox(width, wallHeight, depth, EDGE.wall), Materials.white(), 0, SLAB_H + wallHeight / 2, 0, 'walls');
  walls.castShadow = true;
  g.add(walls);
  g.add(part(roundedBox(DOOR.w, DOOR.h, DOOR.d, EDGE.small), Materials.wood(), 0, SLAB_H + DOOR.h / 2, depth / 2, 'door'));
  addWindows(g, width, depth);
  addRoof(g, width, depth, SLAB_H + wallHeight);
  g.userData = { width, depth, wallHeight };
  return g;
}

/**
 * @param {{x:number, z:number, rotY?:number}[]} positions
 * @returns {Group}
 */
export function createGuardPosts(positions = []) {
  const group = new Group();
  group.name = 'guard-posts';
  const proto = createGuardPost();
  positions.forEach((p, i) => {
    const post = proto.clone();
    post.position.set(p.x, 0, p.z);
    post.rotation.y = p.rotY ?? 0;
    post.name = `guard-post-${i}`;
    group.add(post);
  });
  return group;
}
