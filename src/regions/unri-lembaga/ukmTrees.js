/**
 * Pohon kampus ramping area sekre UKM dari GLB Blender V11–V14 (LOD0 + LOD1) lewat instancing. Tiap spesies:
 * tiga mesh GLB (kulit kayu, daun gelap, daun terang) digabung menjadi SATU geometri ber-vertex-color (satu draw call per
 * spesies per LOD). LOD dinamis per instans: sistem region memanggil `update(fx, fz)` (fokus region-lokal); instans
 * ≤ jarak LOD0 masuk mesh LOD0, ≤ jarak LOD1 masuk mesh LOD1, sisanya disembunyikan (count 0). Variasi instans:
 * skala 0,8–1,25, rotasi acak, miring ±3°, tint ±6% (warna instans) — deterministik dari posisi (hash01).
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { currentScope, withScope } from '../../engine/ResourceScope.js';
import { loadModel } from '../../world/assets/models.js';
import { applyWind } from '../../world/shaders/wind.js';
import { hash01 } from '../../world/vegetation/campusVegetation.js';

export const TREE_GROUP = 'ukm-pohon';
const BASE = 'models/unri/';

/** Spesies → berkas GLB + jarak LOD (m). `far` = batas LOD1 (sembunyi sesudahnya); `scale` = pengali skala dasar (semak 1,5 m terlalu besar bila 1,0). */
export const TREE_SPECIES = Object.freeze({
  v11: Object.freeze({ lod0: `${BASE}v11-pohon-ramping.glb`, lod1: `${BASE}v11-pohon-ramping-lod.glb`, near: 42, far: 160 }),
  v12: Object.freeze({ lod0: `${BASE}v12-pohon-kecil.glb`, lod1: `${BASE}v12-pohon-kecil-lod.glb`, near: 34, far: 140 }),
  v13: Object.freeze({ lod0: `${BASE}v13-pohon-lurus.glb`, lod1: `${BASE}v13-pohon-lurus-lod.glb`, near: 42, far: 160 }),
  v14: Object.freeze({ lod0: `${BASE}v14-semak.glb`, lod1: `${BASE}v14-semak-lod.glb`, near: 30, far: 90, scale: 0.7 }),
});

const SCALE = Object.freeze({ min: 0.8, max: 1.25 });
const TILT = 0.052; // ±3°
const TINT = 0.06;
const LEAF_DARKEN = 0.8; // daun GLB terlalu cerah di bawah matahari dibanding foto (hijau tua kusam)
const UPDATE_MOVE = 1.5; // m: evaluasi ulang LOD bila fokus bergeser lebih dari ini
const WIND = Object.freeze({ weightMode: 'height', heightMin: 2, heightMax: 16, weightMin: 0, amplitude: 0.35 });

/** Instans pohon deterministik: [{sp, x, y, z, scale, rot, tiltX, tiltZ, tint:[r,g,b]}]. Murni (tanpa three). */
export function treeInstances(points, heightAt) {
  return points.filter((p) => TREE_SPECIES[p.sp]).map((p) => {
    const h = (salt) => hash01(p.x, p.z, salt + 100);
    return {
      sp: p.sp, x: p.x, y: heightAt(p.x, p.z), z: p.z,
      scale: (SCALE.min + (SCALE.max - SCALE.min) * h(1)) * (TREE_SPECIES[p.sp].scale ?? 1),
      rot: h(2) * Math.PI * 2,
      tiltX: (h(3) * 2 - 1) * TILT,
      tiltZ: (h(4) * 2 - 1) * TILT,
      tint: [1 + (h(5) * 2 - 1) * TINT, 1 + (h(6) * 2 - 1) * TINT, 1 + (h(7) * 2 - 1) * TINT],
    };
  });
}

/** Satu geometri ber-vertex-color dari semua mesh GLB (warna = baseColor material, ruang linear). */
export function mergeModelGeometry(root) {
  root.updateMatrixWorld(true);
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    const c = (o.material?.color ?? new THREE.Color(0x4a7a33)).clone();
    if (/daun/.test(o.material?.name ?? '')) c.multiplyScalar(LEAF_DARKEN);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  });
  const joined = mergeGeometries(parts.map((g) => g.toNonIndexed()), false);
  if (!joined) throw new Error('GLB pohon tanpa mesh yang bisa digabung');
  const merged = mergeVertices(joined, 1e-4); // normal dihaluskan: gumpalan daun membulat, bukan bidang kaku
  merged.computeVertexNormals();
  mottle(merged);
  merged.computeBoundingSphere();
  return merged;
}

/** Variasi kecerahan per simpul ±13% (daun tidak rata satu warna). Mengubah atribut warna in-place pada geometri baru. */
function mottle(geo) {
  const p = geo.getAttribute('position');
  const c = geo.getAttribute('color');
  for (let i = 0; i < p.count; i += 1) {
    const k = 0.87 + 0.26 * hash01(p.getX(i) * 3.1, p.getZ(i) * 3.1 + p.getY(i), 77);
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
}

function treeMaterial() {
  return currentScope().get('ukm:tree-material', () => {
    const m = applyWind(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide }), WIND);
    m.name = 'pohonKampusUkm';
    return m;
  });
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qt = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** Matriks instans: miring kecil → putar Y → skala seragam → posisi. */
function instanceMatrix(it, out) {
  _q.setFromAxisAngle(_up, it.rot);
  _qt.setFromEuler(_e.set(it.tiltX, 0, it.tiltZ));
  _q.multiply(_qt);
  return out.compose(_p.set(it.x, it.y, it.z), _q, _s.setScalar(it.scale));
}

/** BatchedMesh satu LOD: geometri semua spesies, satu instans per pohon (awal tersembunyi), matriks + tint tetap. */
function lodBatch(list, order, geoms, material, name, cast) {
  const vertexCount = geoms.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const indexCount = geoms.reduce((n, g) => n + g.index.count, 0);
  const batch = new THREE.BatchedMesh(list.length, vertexCount, indexCount, material);
  batch.name = name;
  batch.castShadow = cast;
  batch.receiveShadow = true;
  batch.sortObjects = false; // buram: urutan depan-belakang tak perlu
  batch.frustumCulled = false; // culling per instans tetap aktif (perObjectFrustumCulled)
  const gid = geoms.map((g) => batch.addGeometry(g));
  const c = new THREE.Color();
  const ids = list.map((it) => {
    const id = batch.addInstance(gid[order.indexOf(it.sp)]);
    batch.setMatrixAt(id, instanceMatrix(it, _m));
    batch.setColorAt(id, c.setRGB(it.tint[0], it.tint[1], it.tint[2]));
    batch.setVisibleAt(id, false);
    return id;
  });
  return { batch, ids };
}

/**
 * Lapisan pohon: grup + pengendali LOD. `geometries` = {sp: {lod0, lod1}} sudah digabung. Dua BatchedMesh saja (LOD0
 * berbayang, LOD1 tanpa bayangan) berisi semua spesies → draw call tetap kecil berapa pun jumlah pohon.
 * @param {{sp:string, x:number, z:number}[]} list hasil treeInstances
 */
export function createTreeLayer(list, geometries, material) {
  const group = new THREE.Group();
  group.name = TREE_GROUP;
  const order = Object.keys(TREE_SPECIES).filter((sp) => geometries[sp] && list.some((it) => it.sp === sp));
  const items = list.filter((it) => order.includes(it.sp));
  const near2 = items.map((it) => TREE_SPECIES[it.sp].near ** 2);
  const far2 = items.map((it) => TREE_SPECIES[it.sp].far ** 2);
  const l0 = lodBatch(items, order, order.map((sp) => geometries[sp].lod0), material, `${TREE_GROUP}:lod0`, true);
  const l1 = lodBatch(items, order, order.map((sp) => geometries[sp].lod1), material, `${TREE_GROUP}:lod1`, false);
  group.add(l0.batch, l1.batch);

  const state = new Uint8Array(items.length); // 0 tersembunyi, 1 LOD0, 2 LOD1
  const stats = { lod0: 0, lod1: 0 };
  group.userData.stats = stats;
  let last = null;
  return {
    group,
    stats,
    /** Pilih LOD per instans untuk fokus region-lokal (fx, fz); abaikan bila bergeser < UPDATE_MOVE. */
    update(fx, fz) {
      if (last && Math.hypot(fx - last[0], fz - last[1]) < UPDATE_MOVE) return;
      last = [fx, fz];
      stats.lod0 = 0;
      stats.lod1 = 0;
      items.forEach((it, i) => {
        const d2 = (it.x - fx) ** 2 + (it.z - fz) ** 2;
        const want = d2 <= near2[i] ? 1 : d2 <= far2[i] ? 2 : 0;
        if (want === 1) stats.lod0 += 1;
        else if (want === 2) stats.lod1 += 1;
        if (want === state[i]) return;
        if (state[i] === 1) l0.batch.setVisibleAt(l0.ids[i], false);
        else if (state[i] === 2) l1.batch.setVisibleAt(l1.ids[i], false);
        if (want === 1) l0.batch.setVisibleAt(l0.ids[i], true);
        else if (want === 2) l1.batch.setVisibleAt(l1.ids[i], true);
        state[i] = want;
      });
    },
    /** Paksa evaluasi ulang pada update berikut. */
    invalidate() { last = null; },
    /** Lepas tekstur matriks/warna BatchedMesh (disposeTree hanya melepas geometri dan material). */
    dispose() { l0.batch.dispose(); l1.batch.dispose(); },
  };
}

/** Muat GLB semua spesies/LOD (cache per scope) → {sp: {lod0, lod1}} geometri gabungan; galat satu berkas melempar. */
export async function loadTreeGeometries(scope, species = TREE_SPECIES) {
  const entries = await Promise.all(Object.entries(species).flatMap(([sp, cfg]) => ['lod0', 'lod1'].map(
    async (lod) => [sp, lod, await withScope(scope, () => loadModel(cfg[lod]))],
  )));
  const out = {};
  for (const [sp, lod, root] of entries) {
    const key = `ukm:tree-geo:${sp}:${lod}`;
    out[sp] = { ...out[sp], [lod]: withScope(scope, () => currentScope().get(key, () => mergeModelGeometry(root))) };
  }
  return out;
}

/**
 * Pasang pohon GLB ke `root` (konten region). `controller.layer` diisi agar sistem LOD region dapat memperbarui.
 * Gagal (GLB tak termuat) → `fallback()` (kit lama) dan galat dicatat di `failed`.
 * @returns {Promise<{failed:string[], replaced:string[]}>}
 */
export async function upgradeUkmTrees({ root, scope, instances, controller, fallback, isCancelled = () => false, logger = console }) {
  const result = { failed: [], replaced: [] };
  try {
    const geometries = await loadTreeGeometries(scope);
    if (isCancelled()) return result;
    const layer = withScope(scope, () => {
      const made = createTreeLayer(instances, geometries, treeMaterial());
      currentScope().get('ukm:tree-layer', () => made, { dispose: (l) => l.dispose() });
      return made;
    });
    root.add(layer.group);
    controller.layer = layer;
    result.replaced.push(TREE_GROUP);
  } catch (err) {
    logger.warn('Pohon GLB gagal dimuat, kit lama dipakai:', err?.message ?? err);
    result.failed.push(TREE_GROUP);
    if (!isCancelled() && fallback) root.add(withScope(scope, fallback));
  }
  return result;
}
