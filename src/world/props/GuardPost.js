/**
 * Pos jaga kecil: pelat dasar, dinding, pintu, jendela kaca, atap limas genteng.
 * Pintu menghadap +Z lokal. createGuardPosts() mengkloning (geometri/material dibagikan).
 */
import { BoxGeometry, ConeGeometry, Group, Mesh } from 'three';
import { Materials } from '../materials.js';

const DEFAULTS = Object.freeze({ width: 3, depth: 3, wallHeight: 2.8 });
const SLAB_PAD = 0.3;
const SLAB_H = 0.15;
const DOOR = { w: 0.9, h: 2.1, d: 0.08 };
const WINDOW = { w: 1.2, h: 0.9, d: 0.06, sillY: 1.3 };
const ROOF_OVERHANG = 0.5;
const ROOF_H = 1.4;

function part(geom, material, x, y, z, name) {
  const m = new Mesh(geom, material);
  m.position.set(x, y, z);
  m.name = name;
  return m;
}

/** Jendela kaca di tiga sisi (kiri, kanan, belakang). */
function addWindows(group, width, depth) {
  const y = WINDOW.sillY + WINDOW.h / 2;
  const sideGeom = new BoxGeometry(WINDOW.d, WINDOW.h, WINDOW.w);
  const backGeom = new BoxGeometry(WINDOW.w, WINDOW.h, WINDOW.d);
  group.add(part(sideGeom, Materials.glass(), -width / 2, y, 0, 'window-l'));
  group.add(part(sideGeom, Materials.glass(), width / 2, y, 0, 'window-r'));
  group.add(part(backGeom, Materials.glass(), 0, y, -depth / 2, 'window-back'));
}

/**
 * @param {{width?:number, depth?:number, wallHeight?:number}} opts
 * @returns {Group}
 */
export function createGuardPost(opts = {}) {
  const { width, depth, wallHeight } = { ...DEFAULTS, ...opts };
  const g = new Group();
  g.name = 'guard-post';
  g.add(part(new BoxGeometry(width + SLAB_PAD * 2, SLAB_H, depth + SLAB_PAD * 2), Materials.concrete(), 0, SLAB_H / 2, 0, 'slab'));
  const walls = part(new BoxGeometry(width, wallHeight, depth), Materials.white(), 0, SLAB_H + wallHeight / 2, 0, 'walls');
  walls.castShadow = true;
  g.add(walls);
  g.add(part(new BoxGeometry(DOOR.w, DOOR.h, DOOR.d), Materials.wood(), 0, SLAB_H + DOOR.h / 2, depth / 2, 'door'));
  addWindows(g, width, depth);
  const roofR = Math.hypot(width / 2 + ROOF_OVERHANG, depth / 2 + ROOF_OVERHANG);
  const roof = part(new ConeGeometry(roofR, ROOF_H, 4), Materials.terracotta(), 0, SLAB_H + wallHeight + ROOF_H / 2, 0, 'roof');
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
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
