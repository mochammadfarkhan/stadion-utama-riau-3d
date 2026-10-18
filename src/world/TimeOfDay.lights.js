/**
 * Lampu malam: material emissive (bohlam PJU, floodlight, arang gerobak, dll.),
 * maksimal DAY.maxPointLights PointLight nyata di PJU terdekat sepeda, dan
 * satu SpotLight lampu depan sepeda. Data lampu milik region (posisi PJU, sorot
 * floodlight, lensa) didaftarkan lewat registerLamps() dalam koordinat DUNIA dan
 * dicabut saat region dilepas. Intensitas 0 saat siang (objek tetap ada).
 */
import * as THREE from 'three';
import { DAY } from '../config/constants.js';
import { LAMP_POST } from './props/LampPost.js';
import { createNightHalos } from './NightHalos.js';
import { createMaterialRegistry } from '../engine/materialRegistry.js';

const LAMP_COLOR = 0xffe2a8;
const LAMP_POWER = 320;           // candela (PointLight fisik)
const LAMP_DISTANCE = 45;
const LAMP_HEIGHT = LAMP_POST.height - LAMP_POST.armDrop;
const HEADLIGHT_COLOR = 0xfff4d6;
const HEADLIGHT_POWER = 90;       // candela
const HEADLIGHT_ANGLE = 0.55;
const HEADLIGHT_HEIGHT = 0.95;
const HEADLIGHT_REACH = 14;
const FLOOD_COLOR = 0xfff1dc;
const FLOOD_POWER = 40000;        // candela per sorot (jarak ±100 m → ±4 lux di lapangan)
const FLOOD_ANGLE = 0.62;
const FLOOD_DISTANCE = 260;
const POOL_RADIUS = 9;            // kolam cahaya palsu di bawah setiap PJU (m)
const POOL_OPACITY = 0.5;
const POOL_Y = 0.14;
const EMISSIVE_AUTO_BOOST = 1.8;  // material emissive tanpa tag: on = off × boost
const FADE_RATE = 1.5;            // 1/s, transisi intensitas

const _fwd = new THREE.Vector3();

/** Entri registry emissive: material bertanda userData.nightEmissive, atau bercahaya (emissive > 0) → boost otomatis. */
export function selectEmissive(mat) {
  if (!mat.emissive) return null;
  const tagged = mat.userData?.nightEmissive;
  const base = mat.emissiveIntensity;
  const glow = !tagged && base > 0 && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0;
  if (!tagged && !glow) return null;
  const cfg = tagged ?? { on: base * EMISSIVE_AUTO_BOOST, off: base };
  return { mat, on: cfg.on, off: cfg.off };
}

function createPointLights(parent) {
  return Array.from({ length: DAY.maxPointLights }, (_, i) => {
    const light = new THREE.PointLight(LAMP_COLOR, 0, LAMP_DISTANCE, 2);
    light.name = `lampuPJU-${i}`;
    light.position.set(0, -50, 0); // di bawah tanah sampai dipilih
    parent.add(light);
    return light;
  });
}

function createHeadlight(parent) {
  const spot = new THREE.SpotLight(HEADLIGHT_COLOR, 0, HEADLIGHT_REACH * 2.5, HEADLIGHT_ANGLE, 0.6, 2);
  spot.name = 'lampuSepeda';
  parent.add(spot, spot.target);
  return spot;
}

/** Tekstur gradasi radial lembut untuk kolam cahaya. */
function poolTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Kolam cahaya hangat aditif di tanah untuk SEMUA PJU (PointLight nyata hanya segelintir). */
function createLightPools(parent, lamps) {
  const mat = new THREE.MeshBasicMaterial({
    color: LAMP_COLOR, map: poolTexture(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  const geo = new THREE.PlaneGeometry(POOL_RADIUS * 2, POOL_RADIUS * 2).rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, mat, lamps.length);
  const m = new THREE.Matrix4();
  lamps.forEach((l, i) => mesh.setMatrixAt(i, m.makeTranslation(l.x, (l.y ?? 0) + POOL_Y, l.z)));
  mesh.name = 'kolamCahayaPJU';
  mesh.frustumCulled = false;
  mesh.visible = false;
  parent.add(mesh);
  return mesh;
}

/**
 * Sorot floodlight dari data region (koordinat dunia).
 * @param {THREE.Object3D} parent
 * @param {Array<{x:number,y:number,z:number,tx:number,ty:number,tz:number}>} floods
 */
function createFloodSpots(parent, floods) {
  return floods.map((f, i) => {
    const spot = new THREE.SpotLight(FLOOD_COLOR, 0, FLOOD_DISTANCE, FLOOD_ANGLE, 0.6, 2);
    spot.name = `floodlightSorot-${i}`;
    spot.position.set(f.x, f.y, f.z);
    spot.target.position.set(f.tx, f.ty, f.tz);
    parent.add(spot, spot.target);
    return spot;
  });
}

/** Lepas mesh kolam/halo (geometri, material, peta) dari induknya. */
function releaseObject(obj) {
  if (!obj) return;
  obj.removeFromParent();
  obj.traverse((o) => {
    o.geometry?.dispose();
    o.material?.map?.dispose();
    o.material?.dispose();
  });
  if (obj.isInstancedMesh) obj.dispose();
}

/** Satu set lampu milik satu pendaftar (region): kolam cahaya, halo, sorot floodlight. */
function createLampSet(parent, { lamps = [], lensRoot = null, floods = [] }) {
  const list = lamps.map((l) => ({ x: l.x, z: l.z, y: Number.isFinite(l.y) ? l.y : 0 })); // y = tanah di kaki tiang (M1)
  const spots = createFloodSpots(parent, floods);
  const pools = list.length ? createLightPools(parent, list) : null;
  const halos = createNightHalos(parent, list.map((l) => ({ x: l.x, y: l.y + LAMP_HEIGHT, z: l.z })), lensRoot ?? parent);
  return {
    lamps: list,
    spots,
    pools,
    halos,
    dispose() {
      for (const spot of spots) {
        spot.removeFromParent();
        spot.target.removeFromParent();
        spot.dispose();
      }
      releaseObject(pools);
      releaseObject(halos.group ?? null);
    },
  };
}

/**
 * @param {THREE.Object3D} parent grup pemilik (TimeOfDay.group), bukan scene
 * @returns {{ update(dt, bikePos, bikeYaw?, focus?): void, setLampsOn(on: boolean): void, lampsOn: boolean,
 *   registerLamps(opts?: {lamps?: {x:number,z:number,y?:number}[], lensRoot?: THREE.Object3D|null,
 *     floods?: Array<{x:number,y:number,z:number,tx:number,ty:number,tz:number}>}): () => boolean,
 *   lampCount: number, registerEmissive(root): () => boolean, unregisterEmissive(root): boolean,
 *   emissiveCount: number, dispose(): void }}
 */
export function createNightLights(parent) {
  const emissives = createMaterialRegistry(selectEmissive, { onRemove: (e) => { e.mat.emissiveIntensity = e.off; } });
  const points = createPointLights(parent);
  const headlight = createHeadlight(parent);
  let sets = [];
  let lamps = [];   // gabungan PJU semua set (dunia)
  let order = [];
  let dist2 = new Float32Array(0);
  let lampsOn = false;
  let level = 0;       // 0..1 intensitas lampu (transisi)
  let pickTimer = 0;

  const rebuildIndex = () => {
    lamps = sets.flatMap((s) => s.lamps);
    order = lamps.map((_, i) => i);
    dist2 = new Float32Array(lamps.length);
    pickTimer = 0; // pilih ulang PJU terdekat pada frame berikutnya
  };

  /** Pilih PJU terdekat (≤ maxPointLights dalam pointLightRange) tiap pointLightInterval. */
  const pickNearest = (pos) => {
    for (let i = 0; i < lamps.length; i += 1) {
      const dx = lamps[i].x - pos.x;
      const dz = lamps[i].z - pos.z;
      dist2[i] = dx * dx + dz * dz;
    }
    order.sort((a, b) => dist2[a] - dist2[b]);
    const maxD2 = DAY.pointLightRange * DAY.pointLightRange;
    points.forEach((light, k) => {
      const idx = order[k];
      const hit = idx !== undefined && dist2[idx] <= maxD2;
      light.userData.active = hit;
      if (hit) light.position.set(lamps[idx].x, lamps[idx].y + LAMP_HEIGHT, lamps[idx].z);
    });
  };

  const updateHeadlight = (pos, yaw) => {
    _fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    const ground = Number.isFinite(pos.y) ? pos.y : 0; // bikePos.y = tanah di bawah sepeda (M1)
    headlight.position.set(pos.x + _fwd.x * 0.6, ground + HEADLIGHT_HEIGHT, pos.z + _fwd.z * 0.6);
    headlight.target.position.set(pos.x + _fwd.x * HEADLIGHT_REACH, ground, pos.z + _fwd.z * HEADLIGHT_REACH);
    headlight.intensity = HEADLIGHT_POWER * level;
  };

  const removeSet = (set) => {
    if (!sets.includes(set)) return false;
    sets = sets.filter((s) => s !== set);
    set.dispose();
    rebuildIndex();
    return true;
  };

  return {
    get lampsOn() { return lampsOn; },
    setLampsOn(on) { lampsOn = Boolean(on); },
    /**
     * Daftarkan lampu milik region (koordinat dunia). `lensRoot` = grup tempat mencari lensa
     * floodlight; matriks dunianya harus sudah final. Mengembalikan pencabut (idempoten).
     */
    registerLamps(opts = {}) {
      const set = createLampSet(parent, opts);
      sets = [...sets, set];
      rebuildIndex();
      return () => removeSet(set);
    },
    get lampCount() { return lamps.length; },
    /** Daftarkan material emissive di bawah `root` (region, entitas, GLB yang datang belakangan). */
    registerEmissive: (root) => emissives.register(root),
    unregisterEmissive: (root) => emissives.unregister(root),
    get emissiveCount() { return emissives.size; },
    /** `focus`: pusat pemilihan PJU terdekat (titik pandang POV); lampu depan tetap di sepeda. */
    update(dt, bikePos, bikeYaw = 0, focus = bikePos) {
      const target = lampsOn ? 1 : 0;
      level = THREE.MathUtils.damp(level, target, FADE_RATE * 3, dt);
      if (Math.abs(level - target) < 0.002) level = target;
      for (const e of emissives.entries) e.mat.emissiveIntensity = THREE.MathUtils.lerp(e.off, e.on, level);
      pickTimer -= dt;
      if (pickTimer <= 0) {
        pickTimer = DAY.pointLightInterval;
        pickNearest(focus);
      }
      for (const light of points) light.intensity = light.userData.active ? LAMP_POWER * level : 0;
      for (const set of sets) {
        if (set.pools) {
          set.pools.material.opacity = POOL_OPACITY * level;
          set.pools.visible = level > 0.01;
        }
        set.halos.setLevel(level);
        for (const spot of set.spots) spot.intensity = FLOOD_POWER * level;
      }
      updateHeadlight(bikePos, bikeYaw);
    },
    /** Lepas semua registrasi (nilai emissive siang dipulihkan) dan semua set lampu. */
    dispose() {
      emissives.clear();
      for (const set of sets) set.dispose();
      sets = [];
      rebuildIndex();
    },
  };
}
