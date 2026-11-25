/**
 * Potongan landmark (kit modular): detail kecil (AC, pohon, lampu, …) = GLB kecil di public/models/potongan/,
 * disusun di game menurut "daftar belanja" per landmark (parts.data.js). Satu InstancedMesh per jenis per landmark;
 * geometri tiap jenis dimuat sekali dan dibagi antar-landmark.
 */
import * as THREE from 'three';
import { PART_FILES, PART_RECIPES, PART_SHADOW } from './parts.data.js';
import { pointInPolygon } from '../geo/polygon.js';

const fin = (n) => typeof n === 'number' && Number.isFinite(n);
const DEG = Math.PI / 180;

/**
 * Penanda "jangan taruh pohon/marka di sini": true bila titik dunia (x, z) jatuh di `site` (poligon tapak, denah lokal
 * x timur, y utara = −z three) salah satu landmark. `landmarks`: larik { id, x, z, yaw }.
 */
export function siteReserved(landmarks, recipes = PART_RECIPES) {
  const sites = [];
  for (const def of landmarks ?? []) {
    const site = recipes?.[def.id]?.site;
    if (!Array.isArray(site) || site.length < 3) continue;
    let r = 0;
    for (const p of site) r = Math.max(r, Math.hypot(p[0], p[1]));
    sites.push({ x: def.x, z: def.z, cos: Math.cos(def.yaw ?? 0), sin: Math.sin(def.yaw ?? 0), r, site });
  }
  if (!sites.length) return () => false;
  return (x, z) => {
    for (const s of sites) {
      const dx = x - s.x;
      const dz = z - s.z;
      if (Math.abs(dx) > s.r || Math.abs(dz) > s.r) continue;
      const lx = dx * s.cos - dz * s.sin;
      const lz = dx * s.sin + dz * s.cos;
      if (pointInPolygon(lx, -lz, s.site)) return true;
    }
    return false;
  };
}

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

/** Aturan `ring`: potongan di sepanjang keliling poligon jejak `poly` (denah x timur, y utara), menghadap keluar. */
function ringInstances(poly, r) {
  if (!r || !Array.isArray(poly) || poly.length < 3 || !poly.every((p) => Array.isArray(p) && fin(p[0]) && fin(p[1]))) return [];
  const { step, ys } = r;
  const offset = opt(r.offset, 0.05);
  const margin = opt(r.margin, 1.5);
  const minEdge = opt(r.minEdge, 0);
  const maxEdge = opt(r.maxEdge, Infinity);
  const scale = opt(r.skala, 1);
  if (!fin(step) || step <= 0 || !Array.isArray(ys) || ys.length === 0 || !ys.every(fin)) return [];
  if (!fin(offset) || !fin(margin) || !fin(scale) || scale <= 0 || typeof minEdge !== 'number' || typeof maxEdge !== 'number') return [];
  let area = 0;
  poly.forEach(([x, y], i) => { const [x2, y2] = poly[(i + 1) % poly.length]; area += x * y2 - x2 * y; });
  const pts = area < 0 ? [...poly].reverse() : poly; // berlawanan jarum jam
  const out = [];
  pts.forEach(([ax, ay], i) => {
    const [bx, by] = pts[(i + 1) % pts.length];
    const Ls = Math.hypot(bx - ax, by - ay);
    const room = Ls - 2 * margin;
    if (Ls === 0 || Ls < minEdge || Ls > maxEdge || room < 0) return;
    const dx = (bx - ax) / Ls;
    const dy = (by - ay) / Ls;
    const nx = dy;
    const ny = -dx;
    const n = Math.floor(room / step) + 1;
    const start = margin + (room - (n - 1) * step) / 2;
    for (let k = 0; k < n; k++) {
      const d = start + k * step;
      const px = ax + dx * d + nx * offset;
      const py = ay + dy * d + ny * offset;
      for (const y of ys) out.push({ x: px, y, z: -py, rotY: Math.atan2(nx, -ny), scale });
    }
  });
  return out;
}

/**
 * Resep → Map<part, Array<{x, y, z, rotY, scale}>> (lokal landmark). Data cacat dilewati, tidak melempar.
 * Aturan: `at`, `line` (koordinat frame, perlu `frame`) dan `ring` (keliling `recipe.ring`, denah model; tanpa frame).
 */
export function expandRecipe(recipe) {
  const out = new Map();
  if (!recipe || !Array.isArray(recipe.rules)) return out;
  const frameOk = validFrame(recipe.frame);
  const add = (part, p) => {
    if (!out.has(part)) out.set(part, []);
    out.get(part).push(p);
  };
  for (const rule of recipe.rules) {
    if (!rule || typeof rule.part !== 'string') continue;
    if (rule.ring) {
      for (const p of ringInstances(recipe.ring, rule.ring)) add(rule.part, p);
      continue;
    }
    if (!frameOk) continue;
    for (const [u, v, y, yaw, scale] of rulePoints(rule)) {
      if (![u, v, y, yaw, scale].every(fin) || scale <= 0) continue;
      add(rule.part, { ...frameToLocal(recipe.frame, u, v, y, yaw), scale });
    }
  }
  return out;
}

/**
 * @param {{baseUrl?: string, loadGltf: (url: string) => Promise<{scene: THREE.Object3D}>, material: THREE.Material,
 *   files?: Record<string, string>, recipes?: Record<string, object>, logger?: {error: Function}}} o
 */
export function createParts({ baseUrl = '/', loadGltf, material, files = PART_FILES, recipes = PART_RECIPES, logger = console, shadows = PART_SHADOW }) {
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
      im.castShadow = shadows.includes(name);
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
