/**
 * Lapisan "kota jauh" untuk pratinjau (K): SELURUH Pekanbaru di luar tile terperinci, dari public/far/ (tools/citybake/farbake.mjs).
 *  - Peta tanah 2048² (WebP: tutupan lahan, air, jalan besar, kerapatan bangunan) di satu bidang; dikompres karena hanya dilihat dari jauh.
 *  - Bangunan: SATU InstancedMesh per sel 2 km (kotak 10 segitiga; warna per instans dari kelas), 8 byte/bangunan di berkas.
 *  - Jalan besar (motorway…unclassified): pita datar per sel; jalan kecil hanya ada di peta tanah.
 * Dimuat malas saat setActive(true) pertama; setActive(false) menyembunyikan (memori tetap, pemuatan ulang tidak perlu).
 * Format biner: lihat kepala farbake.mjs. Parser (parseBuildings / parseRoads) murni agar bisa diuji.
 */
import * as THREE from 'three';
import { applyGroundDetail } from './groundDetail.js';

const GROUND_Y = -0.4;
const ROAD_Y = 0.08;
const MAX_ROAD_CLASS = 5;
const FETCH_PARALLEL = 6;
/** Lebar jalan LOD jauh (m) per indeks kelas (dilebarkan dari aslinya agar terbaca dari udara). */
export const FAR_ROAD_WIDTH = Object.freeze([16, 14, 12, 10, 8, 6, 5]);
/** Palet dinding per kelas bangunan (sRGB): 0 lain, 1 niaga, 2 industri, 3 publik/ibadah, 4 hunian. */
export const FAR_PALETTE = Object.freeze(['#cfc8b8', '#d6b6aa', '#a4abb4', '#dccfae', '#c4ae92']);

/** @returns {Array<{x:number, z:number, w:number, d:number, h:number, cls:number}>} koordinat lokal sel (m) */
export function parseBuildings(buffer) {
  const v = new DataView(buffer);
  const n = Math.floor(buffer.byteLength / 8);
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const o = i * 8;
    out[i] = { x: v.getUint16(o, true) / 10, z: v.getUint16(o + 2, true) / 10, w: v.getUint8(o + 4) / 2, d: v.getUint8(o + 5) / 2, h: v.getUint8(o + 6) / 2, cls: v.getUint8(o + 7) };
  }
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

/** Kotak satuan alas di y=0 tanpa sisi bawah (10 segitiga). */
function createBoxGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const idx = Array.from(g.index.array).filter((_, i) => i < 18 || i >= 24); // buang grup sisi −Y (indeks 18–23)
  g.setIndex(idx);
  return g;
}

function roadGeometry(roads, ox, oz) {
  const pos = [];
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
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  if (!index.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(index);
  return g;
}

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
  const counts = { cells: 0, buildings: 0, roadMeshes: 0 };

  const own = (r) => { owned.push(r); return r; };
  const buildingMat = own(new THREE.MeshLambertMaterial({ name: 'kotaJauh:bangunan' }));
  const roadMat = own(new THREE.MeshLambertMaterial({ color: 0x74777d, depthWrite: false }));
  roadMat.name = 'kotaJauh:jalan';
  const palette = FAR_PALETTE.map((c) => new THREE.Color(c));
  const boxGeo = own(createBoxGeometry());

  const addGround = async () => {
    const b = manifest.bounds;
    const tex = own(await loadTexture(`${baseUrl}far/${manifest.ground.file}`));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const geo = own(new THREE.PlaneGeometry(b.maxX - b.minX, b.maxZ - b.minZ).rotateX(-Math.PI / 2));
    const mat = own(applyGroundDetail(new THREE.MeshLambertMaterial({ map: tex }), 'far', 0)); // tanpa butir halus (hanya dilihat jauh)
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
    const [bb, rb] = await Promise.all([
      c.nb ? fetchBuffer(`${baseUrl}far/b_${c.key}.bin`) : null,
      c.nr ? fetchBuffer(`${baseUrl}far/r_${c.key}.bin`) : null,
    ]);
    if (disposed) return;
    if (bb) {
      const list = parseBuildings(bb);
      const mesh = new THREE.InstancedMesh(boxGeo, buildingMat, list.length);
      const m = new THREE.Matrix4();
      const col = new THREE.Color();
      list.forEach((b, i) => {
        m.makeScale(Math.max(2, b.w), Math.max(2.5, b.h), Math.max(2, b.d)).setPosition(ox + b.x, 0, oz + b.z);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, col.copy(palette[b.cls] ?? palette[0]).multiplyScalar(0.82 + 0.3 * hash(i + c.ix * 977 + c.iz * 131)));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.name = `bangunanJauh:${c.key}`;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      counts.buildings += list.length;
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
