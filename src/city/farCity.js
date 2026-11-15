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
import { applyTreeSway } from './treeSway.js';
import { applyNightGlow } from './nightGlow.js';
import { createFarLife, parseRivers } from './farLife.js';

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
/** Lapisan irisan tanah diorama di tepi peta (tebal m dari permukaan, warna sRGB): rumput → tanah → liat → batuan. */
export const SLAB_STRATA = Object.freeze([
  Object.freeze({ depth: 45, color: '#5f8a3a' }), Object.freeze({ depth: 260, color: '#6b4a32' }),
  Object.freeze({ depth: 560, color: '#a47a52' }), Object.freeze({ depth: 900, color: '#7a7774' }),
]);
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

/** Kontak-AO murah: titik dasar dinding (y=0) digelapkan, gradasi sampai puncak. */
export const WALL_BASE_SHADE = 0.72;
function baseShade(g) {
  const pos = g.attributes.position;
  const col = g.attributes.color;
  for (let i = 0; i < pos.count; i += 1) {
    if (pos.getY(i) < 0.001) col.setXYZ(i, col.getX(i) * WALL_BASE_SHADE, col.getY(i) * WALL_BASE_SHADE, col.getZ(i) * WALL_BASE_SHADE);
  }
  return g;
}

/** Dinding kotak satuan (alas y=0, tinggi 1) tanpa atap & alas: 4 sisi (8 segitiga). */
function wallsGeometry(color) {
  const b = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const idx = Array.from(b.index.array).filter((_, i) => i < 12 || (i >= 24 && i < 36)); // px, nx, pz, nz (buang py & ny)
  b.setIndex(idx);
  const g = b.toNonIndexed();
  b.dispose();
  g.deleteAttribute('uv');
  return baseShade(paintAll(g, color));
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

/**
 * Dinding irisan diorama di keempat sisi `bounds` (dunia), pita warna per lapisan SLAB_STRATA dari y=top ke bawah.
 * Quad per (dinding × lapisan) = 4 × strata; normal keluar; tanpa alas.
 * @returns {THREE.BufferGeometry}
 */
export function slabGeometry(bounds, top, strata = SLAB_STRATA) {
  const { minX, maxX, minZ, maxZ } = bounds;
  const walls = [ // [x1,z1,x2,z2,nx,nz]
    [minX, minZ, maxX, minZ, 0, -1], [maxX, minZ, maxX, maxZ, 1, 0], [maxX, maxZ, minX, maxZ, 0, 1], [minX, maxZ, minX, minZ, -1, 0],
  ];
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  const c = new THREE.Color();
  for (const [x1, z1, x2, z2, nx, nz] of walls) {
    let y0 = top;
    for (const { depth, color } of strata) {
      const y1 = top - depth;
      const base = pos.length / 3;
      pos.push(x1, y0, z1, x2, y0, z2, x2, y1, z2, x1, y1, z1);
      for (let k = 0; k < 4; k += 1) { nor.push(nx, 0, nz); c.set(color); col.push(c.r, c.g, c.b); }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      y0 = y1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
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

/** Sel per sisi blok perakitan: 2 × 2 sel (4 km) = satu set mesh (4 × 4 membuat zoom dekat menggambar 5× segitiga di luar layar). Data tetap diunduh per sel (tanpa bake ulang). */
export const FAR_BATCH = 2;

/** Kunci blok untuk sel (ix, iz). */
export function batchKey(ix, iz, n = FAR_BATCH) {
  return `${Math.floor(ix / n)}_${Math.floor(iz / n)}`;
}

/** Ambang jarak kamera → fokus (m): penuh di bawah `full`, bagian `min` di atas `at`, linier di antaranya. */
const FAR_DETAIL = Object.freeze({
  bangunan: Object.freeze({ full: 6000, at: 20000, min: 0.45 }),
  pohon: Object.freeze({ full: 4000, at: 14000, min: 0.25 }),
});

/** Bagian instans yang digambar (0..1) menurut jarak kamera → fokus; yang kecil/pendek hilang lebih dulu (lebih kecil dari 1 px). */
export function farDetail(distance, kind) {
  const c = FAR_DETAIL[kind];
  if (!c || !(distance > c.full)) return 1;
  if (distance >= c.at) return c.min;
  return 1 - ((distance - c.full) / (c.at - c.full)) * (1 - c.min);
}

/** Ukuran untuk urutan pangkas: bangunan = luas jejak, pohon = tinggi. */
const sizeOf = (it, kind) => (kind === 'pohon' ? it.h : it.w * it.d);

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
  const life = createFarLife({ parent: group }); // mobil berjalan + lampu jalan (farLife.js)
  let loaded = null;
  let disposed = false;
  const counts = { cells: 0, buildings: 0, trees: 0, roadMeshes: 0 };
  const instanced = []; // mesh instans per blok (count dipangkas menurut jarak)
  let floor = null; // lantai dunia (warna mengikuti kabut)
  let lastDistance = 0;

  const own = (r) => { if (r) owned.push(r); return r; };
  const buildingMat = own(new THREE.MeshLambertMaterial({ vertexColors: true }));
  buildingMat.name = 'kotaJauh:bangunan';
  applyFacade(buildingMat, 'wall'); // jendela & kios pada dinding dari dekat; memudar > 900 m (atap tak terkena: normal.y >= 0,5)
  const treeMat = own(applyTreeSway(new THREE.MeshLambertMaterial({ vertexColors: true })));
  treeMat.name = 'kotaJauh:pohon';
  const roadMat = own(applyNightGlow(new THREE.MeshLambertMaterial({ vertexColors: true, depthWrite: false }), { strength: 0.3 })); // lampu jalan malam
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

  /** Alas diorama: irisan tanah berlapis di tepi peta (terlihat saat zoom jauh; gaya maket). */
  const addSlab = () => {
    const mat = own(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    mat.name = 'kotaJauh:alas';
    const mesh = new THREE.Mesh(own(slabGeometry(manifest.bounds, GROUND_Y)), mat);
    mesh.name = 'alasDiorama';
    mesh.renderOrder = -6;
    group.add(mesh);
    // Lantai dunia di dasar alas: di luar diorama kamera zoom penuh melihat lantai berwarna kabut, bukan langit putih.
    const floorMat = own(new THREE.MeshBasicMaterial({ color: 0x8a8f96, fog: true }));
    floorMat.name = 'kotaJauh:lantaiDunia';
    floor = new THREE.Mesh(own(new THREE.PlaneGeometry(200000, 200000).rotateX(-Math.PI / 2)), floorMat);
    floor.name = 'lantaiDunia';
    floor.position.y = GROUND_Y - SLAB_STRATA.at(-1).depth;
    floor.renderOrder = -7;
    group.add(floor);
  };

  /** Unduh + urai satu sel; koordinat dikembalikan dalam DUNIA, warna instans dihitung di sini (seed per sel tetap). */
  const loadCell = async (c) => {
    const ox = c.ix * manifest.cell;
    const oz = c.iz * manifest.cell;
    const [bb, rb, tb] = await Promise.all([
      c.nb ? fetchBuffer(`${baseUrl}far/b_${c.key}.bin`) : null,
      c.nr ? fetchBuffer(`${baseUrl}far/r_${c.key}.bin`) : null,
      c.nt ? fetchBuffer(`${baseUrl}far/t_${c.key}.bin`) : null,
    ]);
    const out = { flat: [], gable: [], trees: [], road: null };
    if (disposed) return out;
    if (bb) {
      const seed = c.ix * 977 + c.iz * 131;
      parseBuildings(bb).forEach((bd, i) => {
        const tint = FAR_CLASS_TINT[bd.cls] ?? FAR_CLASS_TINT[0];
        const k = 0.82 + 0.34 * hash(i + seed);
        const color = [tint[0] * k, tint[1] * k * (0.96 + 0.08 * hash(i * 3 + seed)), tint[2] * k];
        (bd.gable ? out.gable : out.flat).push({ ...bd, x: ox + bd.x, z: oz + bd.z, color });
      });
    }
    if (tb) {
      parseTrees(tb).forEach((t, i) => {
        const k = 0.8 + 0.4 * hash(i * 7 + c.ix * 31 + c.iz * 17);
        out.trees.push({ x: ox + t.x, z: oz + t.z, h: t.h, color: [k, k * (0.95 + 0.1 * hash(i + 5)), k] });
      });
    }
    if (rb) {
      const roads = parseRoads(rb);
      life.addRoads(ox, oz, roads);
      out.road = roadGeometry(roads, ox, oz);
    }
    counts.cells += 1;
    return out;
  };

  /** Mesh instans satu blok; instans diurutkan besar → kecil supaya `count` bisa dipangkas dari ekor saat kamera jauh (farDetail). */
  const addInstanced = (name, geo, mat, items, kind, place) => {
    if (!items.length) return;
    items.sort((p1, p2) => sizeOf(p2, kind) - sizeOf(p1, kind));
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      place(it, m, q);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.setRGB(it.color[0], it.color[1], it.color[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = name;
    mesh.matrixAutoUpdate = false;
    mesh.userData.total = items.length;
    mesh.userData.kind = kind;
    mesh.count = Math.max(1, Math.round(items.length * farDetail(lastDistance, kind)));
    instanced.push(mesh);
    group.add(mesh);
  };

  const placeBuilding = (gable) => (bd, m, q) => {
    let { w, d, rot } = bd;
    if (gable && w < d) { [w, d] = [d, w]; rot += Math.PI / 2; } // bubungan sepanjang sisi terpanjang
    q.setFromAxisAngle(UP, -rot);
    m.compose(new THREE.Vector3(bd.x, 0, bd.z), q, new THREE.Vector3(Math.max(2, w), Math.max(2.4, bd.h), Math.max(2, d)));
  };
  const placeTree = (t, m) => m.compose(new THREE.Vector3(t.x, 0, t.z), IDENTITY_Q, new THREE.Vector3(t.h * 0.85, t.h, t.h * 0.85));

  /** Satu blok FAR_BATCH × FAR_BATCH sel → ≤ 4 draw call (datar, pelana, pohon, jalan) alih-alih ≤ 4 per sel. */
  const addBatch = async (key, cells) => {
    const parts = [];
    for (const c of cells) {
      if (disposed) return;
      try { parts.push(await loadCell(c)); } catch (err) { logger.error(`Sel kota jauh ${c.key} gagal (dilewati):`, err); }
    }
    if (disposed) return;
    const flat = parts.flatMap((x) => x.flat);
    const gable = parts.flatMap((x) => x.gable);
    const trees = parts.flatMap((x) => x.trees);
    addInstanced(`bangunanJauh:${key}:datar`, flatGeo, buildingMat, flat, 'bangunan', placeBuilding(false));
    addInstanced(`bangunanJauh:${key}:pelana`, gableGeo, buildingMat, gable, 'bangunan', placeBuilding(true));
    addInstanced(`pohonJauh:${key}`, crownGeo, treeMat, trees, 'pohon', placeTree);
    counts.buildings += flat.length + gable.length;
    counts.trees += trees.length;
    const roads = parts.map((x) => x.road).filter(Boolean);
    if (roads.length) {
      const g = roads.length === 1 ? roads[0] : mergeGeometries(roads, false);
      if (roads.length > 1) roads.forEach((r) => r.dispose());
      if (g) {
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(own(g), roadMat);
        mesh.name = `jalanJauh:${key}`;
        mesh.renderOrder = -4;
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
        counts.roadMeshes += 1;
      }
    }
  };

  const loadAll = async () => {
    addSlab();
    try {
      await addGround();
    } catch (err) {
      logger.error('Peta tanah kota jauh gagal dimuat:', err);
    }
    if (manifest.rivers?.file) { // jalur perahu (opsional; gagal = tanpa perahu)
      try { life.addRivers(parseRivers(await fetchBuffer(`${baseUrl}far/${manifest.rivers.file}`))); } catch (err) { logger.error('Jalur sungai gagal dimuat (tanpa perahu):', err); }
    }
    const batches = new Map();
    for (const c of manifest.cells) {
      const k = batchKey(c.ix, c.iz);
      if (!batches.has(k)) batches.set(k, []);
      batches.get(k).push(c);
    }
    const near = (cells) => Math.min(...cells.map((c) => Math.hypot(c.ix - 3, c.iz)));
    const queue = [...batches].sort((x, y) => near(x[1]) - near(y[1])); // blok dekat stadion dulu
    const worker = async () => {
      for (let q = queue.shift(); q && !disposed; q = queue.shift()) await addBatch(q[0], q[1]);
    };
    await Promise.all(Array.from({ length: FETCH_PARALLEL }, worker));
  };

  return {
    group,
    /** true: tampilkan (dan muat pada pemanggilan pertama); false: sembunyikan. */
    async setActive(on) {
      group.visible = Boolean(on);
      life.setVisible(on);
      if (on && !loaded) loaded = loadAll();
      if (on) await loaded;
    },
    /** Tiap frame saat pratinjau: gerak mobil, lampu malam. `focus` {x,z}, `distance` kamera→fokus (m), `hour` jam permainan. */
    update(o) {
      if (!group.visible) return;
      life.update(o);
      if (floor) { // `scene` di sini grup kota: kabut ada di akar adegan
        let root = group;
        while (root.parent) root = root.parent;
        if (root.fog?.color) floor.material.color.copy(root.fog.color);
      }
      const d = o?.distance;
      if (Number.isFinite(d) && Math.abs(d - lastDistance) / Math.max(1, lastDistance) > 0.08) { // tanpa alokasi
        lastDistance = d;
        for (const mesh of instanced) mesh.count = Math.max(1, Math.round(mesh.userData.total * farDetail(d, mesh.userData.kind)));
      }
    },
    stats: () => ({ ...counts, ...life.stats() }),
    dispose() {
      disposed = true;
      life.dispose();
      group.removeFromParent();
      for (const r of owned) r.dispose?.();
    },
  };
}
