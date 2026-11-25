/**
 * Potongan landmark (kit modular): detail kecil (AC, pohon, lampu, …) = GLB kecil di public/models/potongan/,
 * disusun di game menurut "daftar belanja" per landmark (parts.data.js). Satu InstancedMesh per jenis per landmark;
 * geometri tiap jenis dimuat sekali dan dibagi antar-landmark.
 */
import * as THREE from 'three';
import { PART_FILES, PART_RECIPES } from './parts.data.js';

const fin = (n) => typeof n === 'number' && Number.isFinite(n);
const DEG = Math.PI / 180;

/** Titik (u, v, y) di frame denah → koordinat lokal three landmark (x, y, z) + rotY. */
export function frameToLocal(frame, u, v, y, yawDeg = 0) {
  const c = Math.cos(frame.ang);
  const s = Math.sin(frame.ang);
  return {
    x: frame.cx + u * c - v * s,
    y,
    z: -(frame.cy + u * s + v * c),
    rotY: frame.ang + yawDeg * DEG,
  };
}

const validFrame = (f) => f && ['cx', 'cy', 'ang'].every((k) => fin(f[k]));
const opt = (n, d) => (n === undefined ? d : n);

/** Titik-titik (u, v, y, yaw, skala) sebuah aturan; [] bila cacat atau tak dikenal. */
function rulePoints(rule) {
  if (Array.isArray(rule.at)) {
    return rule.at.filter(Array.isArray).map(([u, v, y, yaw, scale]) => [u, v, y, opt(yaw, 0), opt(scale, 1)]);
  }
  const l = rule.line;
  if (l && Array.isArray(l.from) && Array.isArray(l.to) && Number.isInteger(l.count) && l.count >= 1) {
    const yaw = opt(l.yaw, 0);
    const scale = opt(l.skala, 1);
    return Array.from({ length: l.count }, (_, i) => {
      const t = l.count === 1 ? 0.5 : i / (l.count - 1);
      return [l.from[0] + (l.to[0] - l.from[0]) * t, l.from[1] + (l.to[1] - l.from[1]) * t, l.y, yaw, scale];
    });
  }
  return [];
}

/** Resep → Map<part, Array<{x, y, z, rotY, scale}>> (lokal landmark). Data cacat dilewati, tidak melempar. */
export function expandRecipe(recipe) {
  const out = new Map();
  if (!recipe || !validFrame(recipe.frame) || !Array.isArray(recipe.rules)) return out;
  for (const rule of recipe.rules) {
    if (!rule || typeof rule.part !== 'string') continue;
    for (const [u, v, y, yaw, scale] of rulePoints(rule)) {
      if (![u, v, y, yaw, scale].every(fin) || scale <= 0) continue;
      const p = frameToLocal(recipe.frame, u, v, y, yaw);
      if (!out.has(rule.part)) out.set(rule.part, []);
      out.get(rule.part).push({ ...p, scale });
    }
  }
  return out;
}

/**
 * @param {{baseUrl?: string, loadGltf: (url: string) => Promise<{scene: THREE.Object3D}>, material: THREE.Material,
 *   files?: Record<string, string>, recipes?: Record<string, object>, logger?: {error: Function}}} o
 */
export function createParts({ baseUrl = '/', loadGltf, material, files = PART_FILES, recipes = PART_RECIPES, logger = console }) {
  const geoms = new Map(); // nama → Promise<BufferGeometry|null>
  const loaded = [];
  const groups = new Map(); // id landmark → Promise<Group>
  const meshes = [];
  const built = [];
  let disposed = false;

  const geometry = (name) => {
    if (!geoms.has(name)) {
      geoms.set(name, (async () => {
        try {
          if (!files[name]) throw new Error('potongan tak terdaftar di PART_FILES');
          const gltf = await loadGltf(`${baseUrl}models/potongan/${files[name]}`);
          let mesh = null;
          gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
          if (!mesh) throw new Error('GLB tanpa mesh');
          if (disposed) { mesh.geometry.dispose(); return null; }
          loaded.push(mesh.geometry);
          return mesh.geometry;
        } catch (err) {
          logger.error(`Potongan ${name} gagal:`, err);
          return null;
        }
      })());
    }
    return geoms.get(name);
  };

  const build = async (id, root) => {
    const group = new THREE.Group();
    group.name = 'potongan';
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const list = [...expandRecipe(recipes[id])];
    const geos = await Promise.all(list.map(([name]) => geometry(name)));
    list.forEach(([name, pts], i) => {
      if (!geos[i]) return;
      const im = new THREE.InstancedMesh(geos[i], material, pts.length);
      im.name = `potongan:${name}`;
      im.castShadow = true;
      im.receiveShadow = true;
      pts.forEach((p, k) => {
        im.setMatrixAt(k, m.compose(pos.set(p.x, p.y, p.z), q.setFromAxisAngle(up, p.rotY), scl.setScalar(p.scale)));
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      meshes.push(im);
      group.add(im);
    });
    built.push(group);
    if (!disposed) root.add(group);
    return group;
  };

  return {
    has: (id) => expandRecipe(recipes[id]).size > 0,
    /** Pasang grup `potongan` ke `root` (sekali per id; panggilan berikutnya mengembalikan grup yang sama). */
    attach(id, root) {
      if (!groups.has(id)) groups.set(id, build(id, root));
      return groups.get(id);
    },
    stats: () => ({ types: loaded.length, instances: meshes.reduce((n, im) => n + im.count, 0) }),
    dispose() {
      disposed = true;
      for (const g of built) g.removeFromParent();
      for (const im of meshes) im.dispose();
      for (const g of loaded) g.dispose();
      built.length = 0;
      meshes.length = 0;
      loaded.length = 0;
    },
  };
}
