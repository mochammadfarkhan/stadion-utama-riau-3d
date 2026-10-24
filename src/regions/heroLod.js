/**
 * LOD tengah gedung hero region (antara detail penuh dan proxy saat region dilepas). Per anak `lateRoot` (satu
 * rakitan: gedung hero, teras, parkir, kompleks, ...) dihitung jarak datar fokus → pusat bbox dunianya; di luar
 * hideAt (histeresis showAt) mesh DETAIL rakitan itu disembunyikan, sedangkan massa dinding, atap, tanah/paving,
 * pohon, dan tiang PJU tetap menjadi penanda. Rakitan sudah digabung per material, jadi "detail" dipilih per mesh:
 * instans kecil (motor, rak, bangku), mesh kecil (papan nama, tiang, ornamen), atau material detail menurut nama
 * (nako, kusen, talang, pagar, ...). Penyembunyian lewat layer 0 (pass bayangan ikut hemat; `visible` dipakai
 * upgrade GLB untuk mengganti placeholder). `?nohero` di URL mematikannya (pembanding ukur performa).
 */
import * as THREE from 'three';
import { nextFarHidden } from './stadion/farDetail.js';

export const HERO_LOD = Object.freeze({
  hideAt: 300, // m dari pusat rakitan
  showAt: 260,
  smallSize: 3, // m: sisi terpanjang mesh (atau satu instans) di bawah ini = detail
  refreshEvery: 2, // s: periksa rakitan baru/berubah (upgrade GLB & pohon datang belakangan)
});

/** Material detail rakitan hero (nama mesh hasil mergeByMaterial / GLB). */
export const DETAIL_NAME = /nako|kusen|aluminium|mullion|talang|pagar|spanduk|tali|jaring|pita-net|tiang-net|plafon|lampu|decal|papanNama|benda-halaman|jemuran|marka-nama/i;

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _scale = new THREE.Vector3();

/**
 * Sisi terpanjang satu "benda" mesh: per instans untuk Instanced/BatchedMesh (geometri × skala dunia), bbox dunia
 * untuk mesh biasa. BatchedMesh berisi banyak geometri → Infinity (tidak dianggap kecil; punya LOD sendiri).
 */
export function itemExtent(mesh) {
  if (mesh.isBatchedMesh) return Infinity;
  const g = mesh.geometry;
  if (!g) return Infinity;
  if (!g.boundingBox) g.computeBoundingBox();
  if (mesh.isInstancedMesh) {
    g.boundingBox.getSize(_size);
    mesh.matrixWorld.decompose(_box.min, new THREE.Quaternion(), _scale);
    return Math.max(_size.x * _scale.x, _size.y * _scale.y, _size.z * _scale.z);
  }
  _box.copy(g.boundingBox).applyMatrix4(mesh.matrixWorld).getSize(_size);
  return Math.max(_size.x, _size.y, _size.z);
}

/**
 * Mesh yang disembunyikan pada LOD tengah.
 * @param {THREE.Object3D} root rakitan
 * @param {{smallSize?:number, detailName?:RegExp}} [opts]
 * @returns {THREE.Object3D[]}
 */
export function midLodTargets(root, { smallSize = HERO_LOD.smallSize, detailName = DETAIL_NAME } = {}) {
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh && !o.isPoints && !o.isLine) return;
    if (detailName.test(o.name) || itemExtent(o) < smallSize) out.push(o);
  });
  return out;
}

/** Pusat XZ bbox dunia rakitan (null bila belum ada mesh). */
function worldCenter(root) {
  root.updateWorldMatrix(true, true);
  _box.makeEmpty().expandByObject(root);
  if (_box.isEmpty()) return null;
  return { x: (_box.min.x + _box.max.x) / 2, z: (_box.min.z + _box.max.z) / 2 };
}

function setHidden(objects, hidden) {
  for (const o of objects) {
    if (hidden) o.layers.disable(0);
    else o.layers.enable(0);
  }
}

/**
 * Sistem region `phase: 'world'` (fokus dunia dari ctx.focus).
 * @param {{id:string, root:THREE.Object3D, config?:typeof HERO_LOD}} opts
 */
export function createHeroLodSystem({ id, root, config = HERO_LOD }) {
  const disabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nohero');
  /** @type {Map<THREE.Object3D, {center:{x:number,z:number}|null, hidden:boolean, targets:THREE.Object3D[], count:number}>} */
  const state = new Map();
  let sinceRefresh = Infinity;
  const refresh = () => {
    for (const child of root.children) {
      const prev = state.get(child);
      let count = 0;
      child.traverse(() => { count += 1; });
      if (prev && prev.count === count) continue; // rakitan tidak berubah: lewati hitung ulang bbox
      const targets = midLodTargets(child, config);
      if (prev?.hidden) {
        setHidden(prev.targets, false);
        setHidden(targets, true);
      }
      state.set(child, { center: worldCenter(child), hidden: prev?.hidden ?? false, targets, count });
    }
    for (const child of [...state.keys()]) if (child.parent !== root) state.delete(child);
  };
  return {
    id: `${id}.hero-lod`,
    phase: 'world',
    update(dt, ctx) {
      const f = ctx?.focus ?? ctx?.bikePos;
      if (disabled || !f) return;
      sinceRefresh += dt;
      if (sinceRefresh >= config.refreshEvery || root.children.length !== state.size) { // rakitan baru: segera
        sinceRefresh = 0;
        refresh();
      }
      for (const s of state.values()) {
        if (!s.center) continue;
        const next = nextFarHidden(s.hidden, Math.hypot(f.x - s.center.x, f.z - s.center.z), config);
        if (next === s.hidden) continue;
        s.hidden = next;
        setHidden(s.targets, next);
      }
    },
    dispose() {
      for (const s of state.values()) setHidden(s.targets, false);
      state.clear();
    },
  };
}
