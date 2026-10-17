/**
 * Permukaan basah: material tanah/jalan (mesh bernama di Ground/Track) didaftarkan lewat registry
 * lalu dibuat lebih licin dan gelap saat hujan, plus genangan (puddle) memantulkan env map
 * dengan normal map riak prosedural. Nilai asli material disimpan untuk dipulihkan.
 */
import * as THREE from 'three';
import { WEATHER, SITE, STADIUM } from '../config/constants.js';
import { createMaterialRegistry } from '../engine/materialRegistry.js';

// Nama mesh dasar (sebelum "+N" hasil merge) yang dianggap permukaan basah.
const WET_MESH_NAMES = new Set([
  'rumput', 'plazaPaving', 'aspal', 'trotoar', 'trotoarLuar', 'trotoarDalam', 'kerb', 'kerbLuar', 'kerbDalam',
  'joggingTrack', 'tartan', 'apron',
]);
const PUDDLE_Y = 0.1;
const PUDDLE_COLOR = 0x202c3a;
const PUDDLE_OPACITY = 0.7;
const PUDDLE_ROUGHNESS = 0.05;
const PUDDLE_METALNESS = 0.6;
const PUDDLE_NORMAL_SCALE = 0.35;
const RIPPLE_TEX_SIZE = 64;
const RIPPLE_SPEED = 0.06;        // pergeseran UV normal map per detik
const PUDDLE_SIZE = Object.freeze({ minX: 3, maxX: 7, minZ: 2, maxZ: 4.5 });

const baseName = (name) => (name ?? '').split('+')[0];

/** Entri registry: material unik dari mesh bernama permukaan basah; nilai asli disimpan. */
function selectWet(mat, o) {
  if (!o.isMesh || !WET_MESH_NAMES.has(baseName(o.name)) || !mat.color) return null;
  return {
    mat,
    color: mat.color.clone(),
    roughness: typeof mat.roughness === 'number' ? mat.roughness : null,
    envMapIntensity: typeof mat.envMapIntensity === 'number' ? mat.envMapIntensity : null,
  };
}

function applyWet(entry, k) {
  const { mat } = entry;
  mat.color.copy(entry.color).multiplyScalar(1 - (1 - WEATHER.wetDarken) * k);
  if (entry.roughness !== null) mat.roughness = THREE.MathUtils.lerp(entry.roughness, WEATHER.wetRoughness, k);
  if (entry.envMapIntensity !== null) mat.envMapIntensity = THREE.MathUtils.lerp(entry.envMapIntensity, WEATHER.wetEnvIntensity, k);
}

/** Normal map riak prosedural (jumlah beberapa gelombang sinus), tileable. */
function createRippleNormalTexture() {
  const n = RIPPLE_TEX_SIZE;
  const data = new Uint8Array(n * n * 4);
  const waves = [[3, 1, 0.9], [-2, 4, 0.6], [5, -3, 0.4]];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      let dx = 0;
      let dz = 0;
      for (const [fx, fy, amp] of waves) {
        const ph = ((fx * x + fy * y) / n) * Math.PI * 2;
        dx += Math.cos(ph) * fx * amp;
        dz += Math.cos(ph) * fy * amp;
      }
      const i = (y * n + x) * 4;
      data[i] = 128 + Math.round(THREE.MathUtils.clamp(-dx * 4, -127, 127));
      data[i + 1] = 128 + Math.round(THREE.MathUtils.clamp(-dz * 4, -127, 127));
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Titik genangan: cincin plaza dan jalan lingkar (deterministik). */
function puddleSpots(count) {
  const spots = [];
  const plazaA = (STADIUM.outerSemiX + SITE.plazaSemiX) / 2;
  const plazaB = (STADIUM.outerSemiZ + SITE.plazaSemiZ) / 2;
  const ringN = Math.max(2, Math.round(count * 0.55));
  for (let i = 0; i < ringN; i += 1) {
    const th = 0.2 + (i / ringN) * Math.PI * 2;
    spots.push({ x: plazaA * Math.cos(th), z: plazaB * Math.sin(th), i });
  }
  const roadN = Math.max(2, count - ringN);
  for (let i = 0; i < roadN; i += 1) {
    const th = 0.7 + (i / roadN) * Math.PI * 2;
    spots.push({ x: SITE.ringRoadSemiX * Math.cos(th), z: SITE.ringRoadSemiZ * Math.sin(th), i: i + 7 });
  }
  return spots;
}

function createPuddles(normalMap) {
  const group = new THREE.Group();
  group.name = 'genangan';
  const mat = new THREE.MeshStandardMaterial({
    color: PUDDLE_COLOR, roughness: PUDDLE_ROUGHNESS, metalness: PUDDLE_METALNESS,
    transparent: true, opacity: 0, normalMap, normalScale: new THREE.Vector2(PUDDLE_NORMAL_SCALE, PUDDLE_NORMAL_SCALE),
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
  });
  mat.name = 'genangan';
  const geo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
  for (const s of puddleSpots(WEATHER.puddleCount)) {
    const mesh = new THREE.Mesh(geo, mat);
    const fx = 0.5 + 0.5 * Math.sin(s.i * 12.9898);
    const fz = 0.5 + 0.5 * Math.sin(s.i * 78.233);
    mesh.scale.set(THREE.MathUtils.lerp(PUDDLE_SIZE.minX, PUDDLE_SIZE.maxX, fx), 1, THREE.MathUtils.lerp(PUDDLE_SIZE.minZ, PUDDLE_SIZE.maxZ, fz));
    mesh.position.set(s.x, PUDDLE_Y, s.z);
    mesh.rotation.y = s.i * 0.7;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.visible = false;
  return { group, mat };
}

/**
 * @param {THREE.Object3D} parent grup pemilik (Weather.group)
 * @param {{placement?: {x:number, z:number, yaw:number}|null}} [opts] placement region pemilik titik genangan
 * @returns {{ update(dt, intensity): void, register(root): () => boolean, unregister(root): boolean,
 *   dispose(): void, group: THREE.Group, count: number }}
 */
export function createWetSurfaces(parent, { placement = null } = {}) {
  const registry = createMaterialRegistry(selectWet, { onRemove: (e) => applyWet(e, 0) });
  const normalMap = createRippleNormalTexture();
  const puddles = createPuddles(normalMap);
  if (placement) { // titik genangan region-lokal (plaza, jalan lingkar) → frame dunia
    puddles.group.position.set(placement.x, 0, placement.z);
    puddles.group.rotation.y = placement.yaw;
  }
  parent.add(puddles.group);
  let last = -1;

  return {
    group: puddles.group,
    get count() { return registry.size; },
    /** Daftarkan permukaan basah di bawah root; frame berikutnya menerapkan intensitas saat ini. */
    register(root) {
      const off = registry.register(root);
      last = -1;
      return off;
    },
    unregister: (root) => registry.unregister(root),
    update(dt, intensity) {
      const on = intensity > 0.001;
      puddles.group.visible = on;
      if (on) normalMap.offset.x = (normalMap.offset.x + dt * RIPPLE_SPEED) % 1;
      if (intensity === last) return;
      last = intensity;
      for (const e of registry.entries) applyWet(e, intensity);
      puddles.mat.opacity = PUDDLE_OPACITY * intensity;
    },
    /** Lepas semua registrasi (material kering dipulihkan). */
    dispose() { registry.clear(); },
  };
}
