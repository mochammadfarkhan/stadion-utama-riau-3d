import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createParts, expandRecipe, siteReserved } from '../../src/city/parts.js';

describe('siteReserved', () => {
  const recipes = { a: { site: [[-10, -40], [10, -40], [10, -10], [-10, -10]] } };
  it('yaw 0: tapak di depan model (+z three)', () => {
    const f = siteReserved([{ id: 'a', x: 1000, z: 2000, yaw: 0 }], recipes);
    expect(f(1000, 2025)).toBe(true);
    expect(f(1000, 1975)).toBe(false);
    expect(f(1020, 2025)).toBe(false);
  });
  it('yaw π/2: tapak ikut berputar', () => {
    const f = siteReserved([{ id: 'a', x: 1000, z: 2000, yaw: Math.PI / 2 }], recipes);
    expect(f(1025, 2000)).toBe(true);
    expect(f(1000, 2025)).toBe(false);
  });
  it('tanpa site: selalu false', () => {
    const f = siteReserved([{ id: 'a', x: 1000, z: 2000, yaw: 0 }, { id: 'b', x: 0, z: 0, yaw: 0 }], { a: {} });
    expect(f(1000, 2025)).toBe(false);
  });
});

describe('expandRecipe', () => {
  const frame = { cx: 10, cy: 20, ang: Math.PI / 2, L: 40, W: 20 };

  it('at: frame berotasi 90° → posisi lokal & rotY benar; yaw/skala default', () => {
    const map = expandRecipe({ frame, rules: [{ part: 'ac', at: [[5, 0, 3], [0, 2, 1, 90, 2]] }] });
    const [a, b] = map.get('ac');
    expect(a.x).toBeCloseTo(10);
    expect(a.z).toBeCloseTo(-25);
    expect(a.y).toBe(3);
    expect(a.rotY).toBeCloseTo(Math.PI / 2);
    expect(a.scale).toBe(1);
    // v=2 pada ang 90° → x = 10 − 2, z = −20
    expect(b.x).toBeCloseTo(8);
    expect(b.z).toBeCloseTo(-20);
    expect(b.rotY).toBeCloseTo(Math.PI);
    expect(b.scale).toBe(2);
  });

  it('line: count 5 dari u=−10 ke u=10 → 5 titik berjarak 5; count 1 → titik tengah', () => {
    const f0 = { cx: 0, cy: 0, ang: 0 };
    const map = expandRecipe({ frame: f0, rules: [
      { part: 'lampu', line: { from: [-10, 0], to: [10, 0], y: 0, count: 5 } },
      { part: 'pot', line: { from: [-10, 4], to: [10, 8], y: 1, count: 1, skala: 0.5, yaw: 180 } },
    ] });
    expect(map.get('lampu').map((p) => p.x)).toEqual([-10, -5, 0, 5, 10]);
    const [mid] = map.get('pot');
    expect(mid.x).toBeCloseTo(0);
    expect(mid.z).toBeCloseTo(-6);
    expect(mid.scale).toBe(0.5);
    expect(mid.rotY).toBeCloseTo(Math.PI);
  });

  it('aturan cacat dilewati tanpa melempar', () => {
    const map = expandRecipe({ frame: { cx: 0, cy: 0, ang: 0 }, rules: [
      null, { part: 'x' }, { at: [[0, 0, 0]] }, { part: 'a', at: [[0, 'b', 0], [1, 0, 0], 'rusak'] },
      { part: 'b', line: { from: [0, 0], to: [1, 0], y: 0, count: 0 } }, { part: 'c', at: [[0, 0, 0, 0, -1]] },
    ] });
    expect([...map.keys()]).toEqual(['a']);
    expect(map.get('a')).toHaveLength(1);
    expect(expandRecipe(undefined).size).toBe(0);
    expect(expandRecipe({ frame: { cx: 'a' }, rules: [] }).size).toBe(0);
  });
});

describe('expandRecipe ring', () => {
  const sq = [[0, 0], [20, 0], [20, 10], [0, 10]];
  const ring = { step: 5, ys: [3], margin: 2.5, offset: 0.1 };
  const run = (poly, r) => expandRecipe({ ring: poly, rules: [{ part: 'jendela', ring: r }] }).get('jendela') ?? [];
  const key = (p) => `${p.x.toFixed(6)},${p.y},${p.z.toFixed(6)},${p.rotY.toFixed(6)}`;

  it('persegi 20×10: 4 + 2 potongan per sisi, terpusat, menghadap keluar', () => {
    const pts = run(sq, ring);
    expect(pts).toHaveLength(12);
    const bawah = pts.filter((p) => Math.abs(p.z - 0.1) < 1e-6).map((p) => p.x).sort((a, b) => a - b);
    expect(bawah).toHaveLength(4);
    [2.5, 7.5, 12.5, 17.5].forEach((x, i) => expect(bawah[i]).toBeCloseTo(x, 6));
    pts.filter((p) => Math.abs(p.z - 0.1) < 1e-6).forEach((p) => expect(p.rotY).toBeCloseTo(0, 6));
    const kanan = pts.filter((p) => Math.abs(p.x - 20.1) < 1e-6);
    expect(kanan).toHaveLength(2);
    kanan.forEach((p) => { expect(p.rotY).toBeCloseTo(Math.PI / 2, 6); expect(p.y).toBe(3); });
  });

  it('urutan CW memberi himpunan posisi yang sama', () => {
    const a = run(sq, ring).map(key).sort();
    const b = run([...sq].reverse(), ring).map(key).sort();
    expect(b).toEqual(a);
  });

  it('ys menggandakan, minEdge menyaring sisi pendek, skala diteruskan', () => {
    expect(run(sq, { ...ring, ys: [3, 6.6] })).toHaveLength(24);
    const panjang = run(sq, { ...ring, minEdge: 15, skala: 2 });
    expect(panjang).toHaveLength(8);
    expect(panjang.every((p) => p.scale === 2)).toBe(true);
  });

  it('aturan cacat dilewati; aturan sah lain tetap jalan; resep tanpa frame diterima', () => {
    const map = expandRecipe({ ring: sq, rules: [
      { part: 'a', ring: { ...ring, step: 0 } }, { part: 'b', ring: { ...ring, ys: [] } },
      { part: 'c', ring: { ...ring, ys: ['x'] } }, { part: 'd', ring: { ...ring, margin: Infinity } },
      { part: 'ok', ring },
    ] });
    expect([...map.keys()]).toEqual(['ok']);
    expect(expandRecipe({ ring: [[0, 0], [1, 1]], rules: [{ part: 'a', ring }] }).size).toBe(0);
    expect(expandRecipe({ ring: [[0, 0], [1, NaN], [2, 2]], rules: [{ part: 'a', ring }] }).size).toBe(0);
  });
});

describe('createParts', () => {
  const recipes = {
    satu: { frame: { cx: 0, cy: 0, ang: 0 }, rules: [
      { part: 'ac', at: [[0, 0, 5], [2, 0, 5]] },
      { part: 'pohon', line: { from: [-10, 5], to: [10, 5], y: 0, count: 3 } },
    ] },
    dua: { frame: { cx: 0, cy: 0, ang: 0 }, rules: [{ part: 'ac', at: [[1, 1, 1]] }] },
  };
  const files = { ac: 'ac.glb', pohon: 'pohon.glb' };
  const make = (fail = null) => {
    const urls = [];
    const errors = [];
    const loadGltf = async (url) => {
      urls.push(url);
      if (fail && url.includes(fail)) throw new Error('404');
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
      return { scene };
    };
    const parts = createParts({ loadGltf, material: new THREE.MeshLambertMaterial(), files, recipes, logger: { error: (...a) => errors.push(a) } });
    return { parts, urls, errors };
  };

  it('attach: grup potongan berisi satu InstancedMesh per jenis dengan count benar', async () => {
    const { parts } = make();
    expect(parts.has('satu')).toBe(true);
    expect(parts.has('tidak-ada')).toBe(false);
    const root = new THREE.Group();
    const g = await parts.attach('satu', root);
    expect(g.name).toBe('potongan');
    expect(g.parent).toBe(root);
    const byName = Object.fromEntries(g.children.map((c) => [c.name, c]));
    expect(byName['potongan:ac'].isInstancedMesh).toBe(true);
    expect(byName['potongan:ac'].count).toBe(2);
    expect(byName['potongan:pohon'].count).toBe(3);
    expect(byName['potongan:ac'].castShadow && byName['potongan:ac'].receiveShadow).toBe(true);
    expect(parts.stats()).toEqual({ types: 2, instances: 5 });
  });

  it('berkas dimuat sekali walau dua landmark memakainya; attach kedua tidak menggandakan', async () => {
    const { parts, urls } = make();
    const r1 = new THREE.Group();
    const r2 = new THREE.Group();
    const [g1, g2] = await Promise.all([parts.attach('satu', r1), parts.attach('dua', r2)]);
    expect(urls.filter((u) => u.endsWith('ac.glb'))).toHaveLength(1);
    expect(urls[0]).toBe('/models/potongan/ac.glb');
    expect(g1.children[0].geometry).toBe(g2.children[0].geometry);
    expect(await parts.attach('satu', r1)).toBe(g1);
    expect(r1.children).toHaveLength(1);
  });

  it('jenis yang gagal dimuat dilewati, jenis lain tetap; dispose melepas grup', async () => {
    const { parts, errors } = make('pohon');
    const root = new THREE.Group();
    const g = await parts.attach('satu', root);
    expect(g.children.map((c) => c.name)).toEqual(['potongan:ac']);
    expect(errors).toHaveLength(1);
    parts.dispose();
    expect(g.parent).toBeNull();
    expect(root.children).toHaveLength(0);
  });
});
