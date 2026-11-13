/**
 * Lapisan "kota jauh" untuk pratinjau (K): SELURUH Pekanbaru di luar tile terperinci, dari public/far/ (tools/citybake/farbake.mjs).
 *  - Peta tanah 2048² (WebP: tutupan lahan, air, jalan besar, kerapatan bangunan) di satu bidang; dikompres karena hanya dilihat dari jauh.
 *  - Bangunan: InstancedMesh per sel 2 km dan per jenis (kotak beratap datar / rumah beratap pelana), diputar mengikuti jejak asli,
 *    10 byte/bangunan di berkas; warna dasar per vertex (dinding, atap) x tint per instans (kelas + variasi).
 *  - Pohon: InstancedMesh per sel (tajuk oktahedron 8 segitiga), 5 byte/pohon, dari titik hijau peta tanah.
 *  - Jalan besar (motorway…unclassified): pita datar per sel; jalan kecil hanya ada di peta tanah.
 * Dimuat malas saat setActive(true) pertama; setActive(false) menyembunyikan (memori tetap, pemuatan ulang tidak perlu).
 * Format biner: lihat kepala farbake.mjs. Parser (parseBuildings / parseRoads) murni agar bisa diuji.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyGroundDetail } from './groundDetail.js';
import { applyFacade } from './facade.js';
import { applyNightGlow } from './nightGlow.js';

const GROUND_Y = -0.4;
const ROAD_Y = 0.08;
const MAX_ROAD_CLASS = 6; // semua kelas (residential ikut: jalan kecil terbaca dari udara)
const FETCH_PARALLEL = 6;
/** Lebar jalan LOD jauh (m) per indeks kelas (dilebarkan dari aslinya agar terbaca dari udara). */
export const FAR_ROAD_WIDTH = Object.freeze([18, 16, 14, 12, 10, 8, 6.5]);
/** Warna dasar (sRGB) per vertex: dinding, atap datar, atap pelana, tajuk pohon (atas/bawah). */
export const FAR_COLORS = Object.freeze({ wall: '#d6ccb8', flatRoof: '#85837f', gableRoof: '#a8452e', crownTop: '#4f8a3c', crownBottom: '#2c5524' });
/** Pengali warna per kelas bangunan: 0 lain, 1 niaga, 2 industri, 3 publik/ibadah, 4 hunian. */
export const FAR_CLASS_TINT = Object.freeze([[1, 1, 1], [1, 0.9, 0.87], [0.78, 0.85, 0.95], [1.1, 1.06, 0.88], [1, 0.95, 0.9]]);
const RIDGE = 0.45; // tinggi bubungan atap pelana relatif tinggi dinding
/** Warna aspal jalan jauh per kelas (sRGB): jalan besar lebih gelap. */
export const FAR_ROAD_COLORS = Object.freeze(['#34363b', '#34363b', '#383a3f', '#3c3e43', '#404247', '#46484d', '#4b4d52']);

/** @returns {Array<{x:number, z:number, w:number, d:number, h:number, cls:number, rot:number, gable:boolean}>} lokal sel (m); rot = sudut sumbu-x kotak (rad) */
export function parseBuildings(buffer) {
  const v = new DataView(buffer);
  const n = Math.floor(buffer.byteLength / 10);
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const o = i * 10;
    out[i] = {
      x: v.getUint16(o, true) / 10, z: v.getUint16(o + 2, true) / 10, w: v.getUint8(o + 4) / 2, d: v.getUint8(o + 5) / 2, h: v.getUint8(o + 6) / 2,
      cls: v.getUint8(o + 7), rot: (v.getUint8(o + 8) / 255) * (Math.PI / 2) - Math.PI / 4, gable: (v.getUint8(o + 9) & 1) === 1,
    };
  }
  return out;
}

/** @returns {Array<{x:number, z:number, h:number}>} lokal sel (m) */
export function parseTrees(buffer) {
  const v = new DataView(buffer);
  const n = Math.floor(buffer.byteLength / 5);
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) out[i] = { x: v.getUint16(i * 5, true) / 10, z: v.getUint16(i * 5 + 2, true) / 10, h: v.getUint8(i * 5 + 4) / 2 };
  return out;
}

/** @returns {Array<{cls:number, pts:Array<[number, number]>}>} koordinat lokal sel (m) */
export function parseRoads(buffer) {
  const v = new DataView(buffer);
  const out = [];
  for (let o = 0; o + 3 <= buffer.byteLength;) {
    const cls = v.getUint8(o);
    const n = v.getUint16(o + 1, true);
    o += 3;
    if (o + n * 4 > buffer.byteLength) break;
    const pts = new Array(n);
    for (let i = 0; i < n; i += 1) pts[i] = [v.getInt16(o + i * 4, true) / 10, v.getInt16(o + i * 4 + 2, true) / 10];
    o += n * 4;
    out.push({ cls, pts });
  }
  return out;
}

const paintAll = (g, color) => {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) { c[i * 3] = color.r; c[i * 3 + 1] = color.g; c[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
};

/** Dinding kotak satuan (alas y=0, tinggi 1) tanpa atap & alas: 4 sisi (8 segitiga). */
function wallsGeometry(color) {
  const b = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const idx = Array.from(b.index.array).filter((_, i) => i < 12 || (i >= 24 && i < 36)); // px, nx, pz, nz (buang py & ny)
  b.setIndex(idx);
  const g = b.toNonIndexed();
  b.dispose();
  g.deleteAttribute('uv');
  return paintAll(g, color);
}

/** Atap datar: bidang atas di y=1. */
function flatRoofGeometry(color) {
  const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 1, 0).toNonIndexed();
  g.deleteAttribute('uv');
  return paintAll(g, color);
}

/** Atap pelana: bubungan sepanjang sumbu x pada y=1+RIDGE; dua lereng (warna atap) + dua segitiga ujung (warna dinding). */
function gableRoofGeometry(wallColor, roofColor) {
  const e = 1;
  const r = 1 + RIDGE;
  const tri = (pts, color) => paintAll(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), color);
  const parts = [
    tri([-0.5, e, 0.5, 0.5, e, 0.5, 0.5, r, 0, -0.5, e, 0.5, 0.5, r, 0, -0.5, r, 0], roofColor), // lereng +z
    tri([0.5, e, -0.5, -0.5, e, -0.5, -0.5, r, 0, 0.5, e, -0.5, -0.5, r, 0, 0.5, r, 0], roofColor), // lereng -z
    tri([0.5, e, 0.5, 0.5, e, -0.5, 0.5, r, 0], wallColor), // ujung +x
    tri([-0.5, e, -0.5, -0.5, e, 0.5, -0.5, r, 0], wallColor), // ujung -x
  ];
  for (const p of parts) p.computeVertexNormals();
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Tajuk pohon: oktahedron lonjong (8 segitiga), warna bawah gelap ke atas terang, alas di y=0,15 tinggi. */
function crownGeometry(top, bottom) {
  const g = new THREE.OctahedronGeometry(0.5, 0).scale(1, 0.72, 1).translate(0, 0.55, 0).toNonIndexed(); // lebih gemuk daripada tinggi: tidak seperti berlian
  g.deleteAttribute('uv');
  const pos = g.attributes.position;
  const c = new Float32Array(pos.count * 3);
  const mix = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    mix.copy(bottom).lerp(top, THREE.MathUtils.clamp((pos.getY(i) - 0.1) / 1.0, 0, 1));
    c.set([mix.r, mix.g, mix.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function mergedBuilding(parts) {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

function roadGeometry(roads, ox, oz) {
  const pos = [];
  const colors = [];
  const index = [];
  for (const r of roads) {
    if (r.cls > MAX_ROAD_CLASS) continue;
    const hw = FAR_ROAD_WIDTH[r.cls] / 2;
    for (let i = 0; i + 1 < r.pts.length; i += 1) {
      const [ax, az] = r.pts[i];
      const [bx, bz] = r.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.5) continue;
      const nx = (-(bz - az) / len) * hw;
      const nz = ((bx - ax) / len) * hw;
      const base = pos.length / 3;
      pos.push(ox + ax - nx, ROAD_Y, oz + az - nz, ox + ax + nx, ROAD_Y, oz + az + nz, ox + bx + nx, ROAD_Y, oz + bz + nz, ox + bx - nx, ROAD_Y, oz + bz - nz);
      const c = ROAD_COLOR_OBJECTS[r.cls];
      for (let k = 0; k < 4; k += 1) colors.push(c.r, c.g, c.b);
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  if (!index.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(index);
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);
const IDENTITY_Q = new THREE.Quaternion();
const ROAD_COLOR_OBJECTS = FAR_ROAD_COLORS.map((c) => new THREE.Color(c));
const hash = (i) => { let h = Math.imul(i + 1, 2654435761); h ^= h >>> 15; return (h >>> 0) / 4294967296; };

/**
 * @param {{scene: THREE.Object3D, baseUrl?: string, fetchBuffer?: (url: string) => Promise<ArrayBuffer>,
 *   fetchJson?: (url: string) => Promise<object>, loadTexture?: (url: string) => Promise<THREE.Texture>,
 *   logger?: {error: Function}}} opts
 * @returns {Promise<{group: THREE.Group, setActive(on: boolean): Promise<void>, stats(): object, dispose(): void}|null>} null bila public/far/ tidak ada
 */
export async function createFarCity({
  scene, baseUrl = '/',
  fetchBuffer = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.arrayBuffer(); }),
  fetchJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); }),
  loadTexture = (url) => new THREE.TextureLoader().loadAsync(url),
  logger = console,
}) {
  let manifest;
  try {
    manifest = await fetchJson(`${baseUrl}far/manifest.json`);
  } catch (err) {
    logger.error('Peta kota jauh tidak tersedia (pratinjau hanya tile terperinci):', err);
    return null;
  }
  const group = new THREE.Group();
  group.name = 'kotaJauh';
  group.visible = false;
  scene.add(group);
  const owned = [];
  let loaded = null;
  let disposed = false;
  const counts = { cells: 0, buildings: 0, trees: 0, roadMeshes: 0 };

  const own = (r) => { if (r) owned.push(r); return r; };
  const buildingMat = own(new THREE.MeshLambertMaterial({ vertexColors: true }));
  buildingMat.name = 'kotaJauh:bangunan';
  applyFacade(buildingMat, 'wall'); // jendela & kios pada dinding dari dekat; memudar > 900 m (atap tak terkena: normal.y >= 0,5)
  const treeMat = own(new THREE.MeshLambertMaterial({ vertexColors: true }));
  treeMat.name = 'kotaJauh:pohon';
  const roadMat = own(applyNightGlow(new THREE.MeshLambertMaterial({ vertexColors: true, depthWrite: false }), { strength: 0.55 })); // lampu jalan malam
  roadMat.name = 'kotaJauh:jalan';
  const colors = Object.fromEntries(Object.entries(FAR_COLORS).map(([k, v]) => [k, new THREE.Color(v)]));
  const flatGeo = own(mergedBuilding([wallsGeometry(colors.wall), flatRoofGeometry(colors.flatRoof)]));
  const gableGeo = own(mergedBuilding([wallsGeometry(colors.wall), gableRoofGeometry(colors.wall, colors.gableRoof)]));
  const crownGeo = own(crownGeometry(colors.crownTop, colors.crownBottom));

  const addGround = async () => {
    const b = manifest.bounds;
    const tex = own(await loadTexture(`${baseUrl}far/${manifest.ground.file}`));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const geo = own(new THREE.PlaneGeometry(b.maxX - b.minX, b.maxZ - b.minZ).rotateX(-Math.PI / 2));
    const glow = manifest.glow ? own(await loadTexture(`${baseUrl}far/${manifest.glow}`).catch(() => null)) : null; // peta pendar malam (opsional)
    if (glow) { glow.colorSpace = THREE.NoColorSpace; glow.anisotropy = 2; }
    const base = applyGroundDetail(new THREE.MeshLambertMaterial({ map: tex }), 'far', 0); // tanpa butir halus (hanya dilihat jauh)
    const mat = own(glow ? applyNightGlow(base, { strength: 2.0, glowMap: glow }) : base);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'tanahJauh';
    mesh.position.set((b.minX + b.maxX) / 2, GROUND_Y, (b.minZ + b.maxZ) / 2);
    mesh.receiveShadow = true;
    mesh.renderOrder = -5;
    group.add(mesh);
  };

  const addCell = async (c) => {
    const ox = c.ix * manifest.cell;
    const oz = c.iz * manifest.cell;
    const [bb, rb, tb] = await Promise.all([
      c.nb ? fetchBuffer(`${baseUrl}far/b_${c.key}.bin`) : null,
      c.nr ? fetchBuffer(`${baseUrl}far/r_${c.key}.bin`) : null,
      c.nt ? fetchBuffer(`${baseUrl}far/t_${c.key}.bin`) : null,
    ]);
    if (disposed) return;
    if (bb) {
      const list = parseBuildings(bb);
      const seed = c.ix * 977 + c.iz * 131;
      const groups = [[false, list.filter((b) => !b.gable)], [true, list.filter((b) => b.gable)]];
      for (const [gable, items] of groups) {
        if (!items.length) continue;
        const mesh = new THREE.InstancedMesh(gable ? gableGeo : flatGeo, buildingMat, items.length);
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const col = new THREE.Color();
        items.forEach((b, i) => {
          let { w, d, rot } = b;
          if (gable && w < d) { [w, d] = [d, w]; rot += Math.PI / 2; } // bubungan sepanjang sisi terpanjang
          q.setFromAxisAngle(UP, -rot);
          m.compose(new THREE.Vector3(ox + b.x, 0, oz + b.z), q, new THREE.Vector3(Math.max(2, w), Math.max(2.4, b.h), Math.max(2, d)));
          mesh.setMatrixAt(i, m);
          const tint = FAR_CLASS_TINT[b.cls] ?? FAR_CLASS_TINT[0];
          const k = 0.82 + 0.34 * hash(i + seed);
          col.setRGB(tint[0] * k, tint[1] * k * (0.96 + 0.08 * hash(i * 3 + seed)), tint[2] * k);
          mesh.setColorAt(i, col);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.name = `bangunanJauh:${c.key}:${gable ? 'pelana' : 'datar'}`;
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
        counts.buildings += items.length;
      }
    }
    if (tb) {
      const list = parseTrees(tb);
      const mesh = new THREE.InstancedMesh(crownGeo, treeMat, list.length);
      const m = new THREE.Matrix4();
      const col = new THREE.Color();
      list.forEach((t, i) => {
        m.compose(new THREE.Vector3(ox + t.x, 0, oz + t.z), IDENTITY_Q, new THREE.Vector3(t.h * 0.85, t.h, t.h * 0.85));
        mesh.setMatrixAt(i, m);
        const k = 0.8 + 0.4 * hash(i * 7 + c.ix * 31 + c.iz * 17);
        mesh.setColorAt(i, col.setRGB(k, k * (0.95 + 0.1 * hash(i + 5)), k));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.name = `pohonJauh:${c.key}`;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      counts.trees += list.length;
    }
    if (rb) {
      const g = roadGeometry(parseRoads(rb), ox, oz);
      if (g) {
        const mesh = new THREE.Mesh(own(g), roadMat);
        mesh.name = `jalanJauh:${c.key}`;
        mesh.renderOrder = -4;
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
        counts.roadMeshes += 1;
      }
    }
    counts.cells += 1;
  };

  const loadAll = async () => {
    try {
      await addGround();
    } catch (err) {
      logger.error('Peta tanah kota jauh gagal dimuat:', err);
    }
    const queue = [...manifest.cells].sort((a, b) => Math.hypot(a.ix - 3, a.iz) - Math.hypot(b.ix - 3, b.iz)); // dekat stadion dulu
    const worker = async () => {
      for (let c = queue.shift(); c && !disposed; c = queue.shift()) {
        try { await addCell(c); } catch (err) { logger.error(`Sel kota jauh ${c.key} gagal (dilewati):`, err); }
      }
    };
    await Promise.all(Array.from({ length: FETCH_PARALLEL }, worker));
  };

  return {
    group,
    /** true: tampilkan (dan muat pada pemanggilan pertama); false: sembunyikan. */
    async setActive(on) {
      group.visible = Boolean(on);
      if (on && !loaded) loaded = loadAll();
      if (on) await loaded;
    },
    stats: () => ({ ...counts }),
    dispose() {
      disposed = true;
      group.removeFromParent();
      for (const r of owned) r.dispose?.();
    },
  };
}
