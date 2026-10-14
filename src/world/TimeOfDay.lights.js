/**
 * Lampu malam: material emissive (bohlam PJU, floodlight, arang gerobak, dll.),
 * maksimal DAY.maxPointLights PointLight nyata di PJU terdekat sepeda, dan
 * satu SpotLight lampu depan sepeda. Semua lampu selalu ada di scene (intensitas 0
 * saat siang) agar jumlah cahaya tetap dan shader tidak dikompilasi ulang.
 */
import * as THREE from 'three';
import { DAY, STADIUM } from '../config/constants.js';
import { LAYOUT } from './layout.js';
import { LAMP_POST } from './props/LampPost.js';

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
// Aturan PJU rusak harus sama dengan world/index.js (plaza i%7==3, jalan lingkar i%9==4).
const PLAZA_BROKEN = (i) => i % 7 === 3;
const RING_BROKEN = (i) => i % 9 === 4;

const _fwd = new THREE.Vector3();

/** Posisi semua PJU yang berlampu (data murni). */
function litLampPositions() {
  return [
    ...LAYOUT.plazaLamps.filter((_, i) => !PLAZA_BROKEN(i)),
    ...LAYOUT.ringRoadLamps.filter((_, i) => !RING_BROKEN(i)),
    ...LAYOUT.nagaSaktiLamps,
  ].map((p) => ({ x: p.x, z: p.z }));
}

/** Kumpulkan material emissive di scene; yang belum bertanda diberi tag otomatis. */
function collectEmissiveMaterials(scene) {
  const seen = new Map();
  scene.traverse((o) => {
    const mat = o.material;
    if (!mat || Array.isArray(mat) || !mat.emissive || seen.has(mat.uuid)) return;
    const tagged = mat.userData.nightEmissive;
    const base = mat.emissiveIntensity;
    const glow = !tagged && base > 0 && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0;
    if (!tagged && !glow) return;
    const cfg = tagged ?? { on: base * EMISSIVE_AUTO_BOOST, off: base };
    seen.set(mat.uuid, { mat, on: cfg.on, off: cfg.off });
  });
  return [...seen.values()];
}

function createPointLights(scene) {
  return Array.from({ length: DAY.maxPointLights }, (_, i) => {
    const light = new THREE.PointLight(LAMP_COLOR, 0, LAMP_DISTANCE, 2);
    light.name = `lampuPJU-${i}`;
    light.position.set(0, -50, 0); // di bawah tanah sampai dipilih
    scene.add(light);
    return light;
  });
}

function createHeadlight(scene) {
  const spot = new THREE.SpotLight(HEADLIGHT_COLOR, 0, HEADLIGHT_REACH * 2.5, HEADLIGHT_ANGLE, 0.6, 2);
  spot.name = 'lampuSepeda';
  scene.add(spot, spot.target);
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
function createLightPools(scene, lamps) {
  const mat = new THREE.MeshBasicMaterial({
    color: LAMP_COLOR, map: poolTexture(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  const geo = new THREE.PlaneGeometry(POOL_RADIUS * 2, POOL_RADIUS * 2).rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, mat, lamps.length);
  const m = new THREE.Matrix4();
  lamps.forEach((l, i) => mesh.setMatrixAt(i, m.makeTranslation(l.x, POOL_Y, l.z)));
  mesh.name = 'kolamCahayaPJU';
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}

/** Empat sorot floodlight di sudut atap, mengarah ke tengah lapangan dan tribun seberang. */
function createFloodSpots(scene) {
  const x = STADIUM.innerSemiX * 0.85;
  const z = STADIUM.innerSemiZ * 0.85;
  const y = STADIUM.roofHeight - 2;
  return [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz], i) => {
    const spot = new THREE.SpotLight(FLOOD_COLOR, 0, FLOOD_DISTANCE, FLOOD_ANGLE, 0.6, 2);
    spot.name = `floodlightSorot-${i}`;
    spot.position.set(sx * x, y, sz * z);
    spot.target.position.set(-sx * x * 0.25, 0, -sz * z * 0.25);
    scene.add(spot, spot.target);
    return spot;
  });
}

/**
 * @returns {{ update(dt, bikePos, bikeYaw): void, setLampsOn(on: boolean): void, get lampsOn }}
 */
export function createNightLights(scene) {
  const emissives = collectEmissiveMaterials(scene);
  const lamps = litLampPositions();
  const points = createPointLights(scene);
  const headlight = createHeadlight(scene);
  const floods = createFloodSpots(scene);
  const pools = createLightPools(scene, lamps);
  const order = lamps.map((_, i) => i);
  const dist2 = new Float32Array(lamps.length);
  let lampsOn = false;
  let level = 0;       // 0..1 intensitas lampu (transisi)
  let pickTimer = 0;

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
      if (hit) light.position.set(lamps[idx].x, LAMP_HEIGHT, lamps[idx].z);
    });
  };

  const updateHeadlight = (pos, yaw) => {
    _fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    headlight.position.set(pos.x + _fwd.x * 0.6, HEADLIGHT_HEIGHT, pos.z + _fwd.z * 0.6);
    headlight.target.position.set(pos.x + _fwd.x * HEADLIGHT_REACH, 0, pos.z + _fwd.z * HEADLIGHT_REACH);
    headlight.intensity = HEADLIGHT_POWER * level;
  };

  return {
    get lampsOn() { return lampsOn; },
    setLampsOn(on) { lampsOn = Boolean(on); },
    /** `focus`: pusat pemilihan PJU terdekat (titik pandang POV); lampu depan tetap di sepeda. */
    update(dt, bikePos, bikeYaw = 0, focus = bikePos) {
      const target = lampsOn ? 1 : 0;
      level = THREE.MathUtils.damp(level, target, FADE_RATE * 3, dt);
      if (Math.abs(level - target) < 0.002) level = target;
      for (const e of emissives) e.mat.emissiveIntensity = THREE.MathUtils.lerp(e.off, e.on, level);
      pickTimer -= dt;
      if (pickTimer <= 0) {
        pickTimer = DAY.pointLightInterval;
        pickNearest(focus);
      }
      for (const light of points) light.intensity = light.userData.active ? LAMP_POWER * level : 0;
      pools.material.opacity = POOL_OPACITY * level;
      pools.visible = level > 0.01;
      for (const f of floods) f.intensity = FLOOD_POWER * level;
      updateHeadlight(bikePos, bikeYaw);
    },
  };
}
