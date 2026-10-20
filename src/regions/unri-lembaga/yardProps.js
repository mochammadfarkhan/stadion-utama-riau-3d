/**
 * Benda kecil halaman sekretariat ERC [INFERENSI pola umum sekre ormawa]: set meja-kursi plastik di halaman selatan,
 * pot tanaman di muka dinding barat, tumpukan ban bekas, dan karung di belakang gedung. Penataan lewat generator
 * (`rowPoints`, `jitteredGrid`-gaya jitter deterministik); semua potongan digabung statis ber-vertex-color →
 * SATU draw call. `yardPropLayout` murni (tanpa three) agar bisa diuji.
 */
import * as THREE from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { createRandom } from '../../world/siteutil/rng.js';
import { mergeAll } from '../../world/siteutil/rounded.js';
import { SEKRE_FRAME, fromSekre } from './placement.js';
import { SEKRE_DIM } from './layout.js';
import { rowPoints } from './generators.js';
import { staged } from './staged.js';

export const YARD_PROPS_MAX = 400;

const PLASTIC = Object.freeze([0xc8372d, 0x2f5fa8, 0xe8e6de, 0x3a8a4c]);

/** Titik dasar (lokal-gedung) tiap set meja: pusat + jumlah kursi. */
const TABLE_SETS = Object.freeze([
  { bx: -4.6, bz: SEKRE_DIM.hz + 6.0, chairs: 4 },
  { bx: 3.4, bz: SEKRE_DIM.hz + 7.2, chairs: 3 },
]);

const place = (bx, bz, rotY, extra) => {
  const p = fromSekre(bx, bz);
  return { x: p.x, z: p.z, rot: rotY + SEKRE_FRAME.yaw, ...extra };
};

/**
 * Daftar item region-lokal {kind, x, z, rot, ...}. kind: meja | kursi | pot | ban | karung.
 * @param {number} [seed]
 */
export function yardPropLayout(seed = 77) {
  const rnd = createRandom(seed);
  const items = [];
  for (const set of TABLE_SETS) {
    items.push(place(set.bx, set.bz, rnd.range(-0.3, 0.3), { kind: 'meja' }));
    for (let k = 0; k < set.chairs; k += 1) {
      const a = (k / set.chairs) * Math.PI * 2 + rnd.range(-0.35, 0.35);
      const r = 1.05 + rnd.range(-0.1, 0.25);
      items.push(place(set.bx + Math.sin(a) * r, set.bz + Math.cos(a) * r, a + Math.PI + rnd.range(-0.25, 0.25), { kind: 'kursi', color: PLASTIC[Math.floor(rnd.next() * PLASTIC.length)] }));
    }
  }
  for (const [bx, bz] of rowPoints({ from: [-(SEKRE_DIM.hx + 0.6), -SEKRE_DIM.hz + 2], dir: [0, 1], count: 6, step: 2.7 })) {
    items.push(place(bx + rnd.range(-0.1, 0.1), bz + rnd.range(-0.2, 0.2), rnd.range(0, Math.PI), { kind: 'pot', big: rnd.chance(0.35) }));
  }
  for (let k = 0; k < 3; k += 1) { // tumpukan ban bekas di pojok barat daya
    items.push(place(-(SEKRE_DIM.hx + 2.2) + rnd.range(-0.15, 0.15), SEKRE_DIM.hz + 3.8 + rnd.range(-0.1, 0.1), rnd.range(0, Math.PI), { kind: 'ban', level: k }));
  }
  for (const [bx, bz] of rowPoints({ from: [-6.2, -(SEKRE_DIM.hz + 1.1)], dir: [1, 0], count: 4, step: 0.62 })) {
    items.push(place(bx + rnd.range(-0.08, 0.08), bz + rnd.range(-0.1, 0.1), rnd.range(0, Math.PI), { kind: 'karung' }));
  }
  return items.slice(0, YARD_PROPS_MAX);
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();

/** Potongan primitif (lokal prop) → geometri ber-warna (non-indexed, atribut position/normal/color seragam). */
function piece(geo, color, x, y, z) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  g.translate(x, y, z);
  _c.setHex(color);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) col.set([_c.r, _c.g, _c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** Geometri lokal tiap jenis (alas di y=0, menghadap −Z). */
const BUILDERS = Object.freeze({
  meja: () => [
    piece(BOX(1.1, 0.05, 0.7), 0xf0eee6, 0, 0.72, 0),
    piece(BOX(0.08, 0.7, 0.5), 0xd8d5cb, 0, 0.35, 0),
  ],
  kursi: (it) => [
    piece(BOX(0.42, 0.04, 0.42), it.color, 0, 0.44, 0),
    piece(BOX(0.42, 0.42, 0.04), it.color, 0, 0.67, 0.2),
    piece(BOX(0.3, 0.42, 0.28), it.color, 0, 0.21, 0),
  ],
  pot: (it) => {
    const s = it.big ? 1.35 : 1;
    return [
      piece(new THREE.CylinderGeometry(0.2 * s, 0.14 * s, 0.3 * s, 8), 0xb5603a, 0, 0.15 * s, 0),
      piece(new THREE.SphereGeometry(0.26 * s, 7, 5).scale(1, 0.85, 1), 0x4a8a3c, 0, 0.45 * s, 0),
    ];
  },
  ban: (it) => [piece(new THREE.TorusGeometry(0.3, 0.1, 5, 10).rotateX(Math.PI / 2), 0x23242a, 0, 0.1 + it.level * 0.2, 0)],
  karung: () => [piece(new THREE.SphereGeometry(0.3, 7, 5).scale(1, 0.6, 0.75), 0xd8cfae, 0, 0.17, 0)],
});

/** Gabungkan item → satu BufferGeometry (alas diletakkan di tanah lewat heightAt region-lokal). */
export function yardPropsGeometry(items, heightAt) {
  const geos = [];
  for (const it of items) {
    const y = heightAt(it.x, it.z);
    _m.compose(new THREE.Vector3(it.x, y, it.z), _q.setFromEuler(_e.set(0, it.rot, 0)), new THREE.Vector3(1, 1, 1));
    for (const g of BUILDERS[it.kind](it)) {
      g.applyMatrix4(_m);
      geos.push(g);
    }
  }
  return mergeAll(geos);
}

function kit() {
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  material.name = 'bendaHalamanErc';
  return { material };
}
const kitOf = () => currentScope().get('lembaga:yard-props', kit, { dispose: (k) => k.material.dispose() });

/** Builder bertahap (1 mesh, 1 draw call). `heightAt` region-lokal. */
export function createYardPropsBuilder({ heightAt }) {
  return staged('lembaga-benda-halaman', [
    () => {
      const mesh = new THREE.Mesh(yardPropsGeometry(yardPropLayout(), heightAt), kitOf().material);
      mesh.name = 'lembaga-benda-halaman';
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      return mesh;
    },
  ], null, { merge: false });
}
