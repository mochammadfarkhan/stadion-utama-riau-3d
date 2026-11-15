import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTileMerge, isTileRoot, tileSetKey } from '../../src/city/tileMerge.js';

const wait = (ms = 200) => new Promise((r) => { setTimeout(r, ms); });

/** Tile tiruan seperti GLB tile: posisi Int16 ternormalisasi + skala node, normal Int8, satu mesh per lapisan. */
function fakeTile(key, x, mats) {
  const root = new THREE.Group();
  root.name = `tile:${key}:lod0`;
  root.position.set(x, 0, 0);
  for (const [name, mat] of Object.entries(mats)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Int16Array([0, 0, 0, 32767, 0, 0, 0, 32767, 0]), 3, true));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array([0, 0, 127, 0, 0, 127, 0, 0, 127]), 3, true));
    g.setIndex([0, 1, 2]);
    const node = new THREE.Mesh(g, mat);
    node.name = name;
    node.scale.setScalar(100); // kuantisasi: ±1 ternormalisasi × 100 m
    root.add(node);
  }
  const detail = new THREE.Group();
  detail.name = 'pohon';
  detail.visible = false; // detail kecil sudah disembunyikan saat jauh
  detail.add(new THREE.Mesh(new THREE.BoxGeometry(), mats.roads));
  root.add(detail);
  return root;
}

describe('tileMerge', () => {
  it('isTileRoot dan tileSetKey', () => {
    expect(isTileRoot({ name: 'tile:3_-2:lod0' })).toBe(true);
    expect(isTileRoot({ name: 'kotaJauh' })).toBe(false);
    expect(tileSetKey([{ name: 'b' }, { name: 'a' }])).toBe('a|b');
  });

  it('gabung per material saat jauh, tile asli disembunyikan, posisi dunia tetap; dekat dipulihkan', async () => {
    const parent = new THREE.Group();
    const mats = { roads: new THREE.MeshLambertMaterial(), buildings_walls: new THREE.MeshLambertMaterial() };
    const tiles = [fakeTile('0_0', 0, mats), fakeTile('1_0', 500, mats)];
    tiles.forEach((t) => parent.add(t));
    const merge = createTileMerge({ parent });

    merge.update(true, tiles);
    expect(tiles.every((t) => t.visible)).toBe(true); // cek pertama: tunggu himpunan tile tenang
    merge.update(true, tiles);
    expect(tiles.every((t) => t.visible)).toBe(true); // belum jadi: tile asli tetap tampak
    await wait();
    merge.update(true, tiles);
    expect(merge.ready).toBe(true);
    expect(tiles.every((t) => !t.visible)).toBe(true);
    const merged = parent.getObjectByName('tileGabung');
    expect(merged.visible).toBe(true);
    expect(merged.children).toHaveLength(2); // satu per material; detail tersembunyi tidak ikut
    const walls = merged.children.find((m) => m.material === mats.buildings_walls);
    const pos = walls.geometry.attributes.position;
    expect(pos.count).toBe(6);
    expect(pos.getX(1)).toBeCloseTo(100, 1); // 32767/32767 × 100 m
    expect(pos.getX(4)).toBeCloseTo(600, 1); // tile kedua digeser 500 m

    merge.update(false, tiles);
    expect(tiles.every((t) => t.visible)).toBe(true);
    expect(merged.visible).toBe(false);
  });

  it('tile baru: tampilkan tile asli sampai gabungan dibangun ulang; dispose membuang grup', async () => {
    const parent = new THREE.Group();
    const mats = { roads: new THREE.MeshLambertMaterial() };
    const tiles = [fakeTile('0_0', 0, mats)];
    const merge = createTileMerge({ parent });
    merge.update(true, tiles);
    merge.update(true, tiles);
    await wait();
    merge.update(true, tiles);
    const key1 = merge.key;
    tiles.push(fakeTile('0_1', 0, mats));
    merge.update(true, tiles);
    expect(tiles.every((t) => t.visible)).toBe(true);
    merge.update(true, tiles);
    await wait();
    merge.update(true, tiles);
    expect(merge.key).not.toBe(key1);
    expect(tiles.every((t) => !t.visible)).toBe(true);
    merge.dispose();
    expect(parent.getObjectByName('tileGabung')).toBeUndefined();
  });

  it('posisi Float32 negatif tidak terpotong dan normal ikut diputar', async () => {
    const parent = new THREE.Group();
    const root = new THREE.Group();
    root.name = 'tile:n:lod0';
    root.rotation.y = Math.PI / 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-50, 0, 0, -40, 0, 0, -50, 0, 10], 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array([127, 0, 0, 127, 0, 0, 127, 0, 0]), 3, true));
    g.setIndex([0, 1, 2]);
    root.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial()));
    parent.add(root);
    const merge = createTileMerge({ parent });
    merge.update(true, [root]);
    merge.update(true, [root]);
    await wait();
    const m = parent.getObjectByName('tileGabung').children[0];
    const pos = m.geometry.attributes.position;
    expect(pos.getZ(0)).toBeCloseTo(50, 3); // rotasi +90° Y: x −50 → z +50
    const nor = m.geometry.attributes.normal;
    expect(nor.getZ(0)).toBeCloseTo(-1, 1); // normal +X → −Z
  });
});
