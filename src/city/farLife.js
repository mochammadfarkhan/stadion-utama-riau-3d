/**
 * Kehidupan kota jauh (pratinjau K): mobil berjalan dan lampu jalan nyata sepanjang jalan besar, murah via InstancedMesh.
 *  - Lajur = polyline jalan (kelas ≤ tertiary) dengan panjang kumulatif. Posisi mobil = FUNGSI WAKTU murni (fase + kecepatan × t, mod panjang),
 *    jadi tanpa state per mobil: pooling ulang tidak membuat mobil "meloncat".
 *  - Pool = lajur dalam radius R dari fokus (R mengikuti jarak kamera), dipilih ulang saat fokus/radius berubah cukup jauh; total dibatasi
 *    (MAX_CARS, MAX_LAMPS). Kepadatan menurut jam (padat pagi/sore, jarang malam); lalu lintas lajur kiri (Indonesia).
 *  - Lampu: titik emisif (kepala lampu) tiap ±45 m kedua sisi jalan; hanya tampil malam (warna mengikuti nightFactor).
 * Bagian murni (createLane, pointAt, trafficDensity, selectLanes, lampSpots) diuji tanpa WebGL.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { nightFactor } from './facade.js';
import { applyNightGlow } from './nightGlow.js';
import { hash01 } from './tileDetail.js';

export const LIFE = Object.freeze({
  maxCars: 4000, maxLamps: 5000, minRadius: 450, maxRadius: 3600, radiusPerDistance: 0.9, carScale: 1.8,
  repoolDistance: 0.35, minLaneLength: 40, maxCarsPerLane: 40,
});
/** Jarak antar mobil (m) per indeks kelas jalan (0 motorway … 4 tertiary) dan kecepatan dasar (m/s). */
const SPACING = Object.freeze([55, 60, 70, 90, 120]);
const SPEED = Object.freeze([17, 15, 13, 10, 8]);
const LAMP_SPACING = 45;
const CAR_COLORS = Object.freeze(['#d94f4f', '#e8c04a', '#3f7fd0', '#e8e8e4', '#4a4a50', '#58a860', '#e08a3c', '#9a6fd0']);
export const FAR_LIFE_ROAD_CLASS = 4; // kelas ≤ tertiary

/** Lajur dari polyline dunia [[x, z], …]; null bila terlalu pendek. */
export function createLane(id, cls, pts, minLength = LIFE.minLaneLength) {
  if (pts.length < 2) return null;
  const cum = new Float64Array(pts.length);
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
  for (let i = 0; i < pts.length; i += 1) {
    if (i > 0) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    minX = Math.min(minX, pts[i][0]); maxX = Math.max(maxX, pts[i][0]); minZ = Math.min(minZ, pts[i][1]); maxZ = Math.max(maxZ, pts[i][1]);
  }
  const len = cum[pts.length - 1];
  if (!(len >= minLength)) return null;
  return { id, cls, pts, cum, len, bbox: { minX, maxX, minZ, maxZ } };
}

/** Posisi + arah satuan di jarak s (m) sepanjang lajur (dijepit); ditulis ke `out` {x, z, ux, uz}. */
export function pointAt(lane, s, out) {
  const { cum, pts } = lane;
  const t = Math.min(lane.len, Math.max(0, s));
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= t) lo = mid; else hi = mid;
  }
  const segLen = cum[hi] - cum[lo] || 1;
  const f = (t - cum[lo]) / segLen;
  out.x = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f;
  out.z = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f;
  out.ux = (pts[hi][0] - pts[lo][0]) / segLen;
  out.uz = (pts[hi][1] - pts[lo][1]) / segLen;
  return out;
}

/** Kepadatan lalu lintas 0..1 menurut jam: puncak 07–09 & 16–19, siang 0,7, malam sepi (0,2). Murni, kontinu melingkar. */
export function trafficDensity(hour) {
  const h = ((Number(hour) % 24) + 24) % 24;
  const bump = (c, w) => {
    const d = ((h - c + 12 + 24) % 24) - 12; // selisih jam melingkar (−12..12)
    return Math.exp(-(d * d) / (2 * w * w));
  };
  return Math.min(1, 0.2 + 0.5 * Math.min(1, bump(13, 3.6) * 1.4) + 0.8 * Math.max(bump(8, 1.1), bump(17.3, 1.4)));
}

/** Lajur yang bbox-nya berjarak < R dari (x, z). */
export function selectLanes(lanes, x, z, R) {
  const out = [];
  for (const l of lanes) {
    const b = l.bbox;
    const dx = Math.max(b.minX - x, 0, x - b.maxX);
    const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
    if (dx * dx + dz * dz <= R * R) out.push(l);
  }
  return out;
}

/** Banyak mobil pada lajur (menurut kelas & panjang), dibatasi. */
export const carsOnLane = (lane) => Math.min(LIFE.maxCarsPerLane, Math.floor(lane.len / (SPACING[lane.cls] ?? 120)));

/**
 * Posisi lampu jalan sepanjang lajur: tiap LAMP_SPACING m, bergantian kiri/kanan, digeser lebar/2+1,5 m dari sumbu.
 * @returns {Array<{x:number, z:number}>}
 */
export function lampSpots(lane, halfWidth = 6) {
  const out = [];
  const p = { x: 0, z: 0, ux: 0, uz: 0 };
  const phase = hash01(lane.id, 5) * LAMP_SPACING;
  let k = 0;
  for (let s = phase; s < lane.len; s += LAMP_SPACING, k += 1) {
    pointAt(lane, s, p);
    const side = k % 2 === 0 ? 1 : -1;
    const off = side * (halfWidth + 1.5);
    out.push({ x: p.x + p.uz * off, z: p.z - p.ux * off });
  }
  return out;
}

/** Jalur perahu dari `rivers.bin` (u32 n; per garis u16 np, np×(f32 x, f32 z)) → [[x, z], …][]; data terpotong dibuang. */
export function parseRivers(buffer) {
  const v = new DataView(buffer);
  const out = [];
  if (v.byteLength < 4) return out;
  const n = v.getUint32(0, true);
  let o = 4;
  for (let i = 0; i < n && o + 2 <= v.byteLength; i += 1) {
    const np = v.getUint16(o, true);
    o += 2;
    if (o + np * 8 > v.byteLength) break;
    const pts = [];
    for (let k = 0; k < np; k += 1, o += 8) pts.push([v.getFloat32(o, true), v.getFloat32(o + 4, true)]);
    out.push(pts);
  }
  return out;
}

export const BOATS = Object.freeze({ max: 300, perLaneSpacing: 380, maxPerLane: 5, speed: 2.6, scale: 2.2, minLaneLength: 120 });
/** Banyak perahu pada lajur sungai (menurut panjang), dibatasi. */
export const boatsOnLane = (lane) => Math.min(BOATS.maxPerLane, Math.floor(lane.len / BOATS.perLaneSpacing));

const UP = new THREE.Vector3(0, 1, 0);

/** Kotak mobil satuan (lebar 1, tinggi 1, panjang 1; alas y=0; tanpa alas) — 10 segitiga. */
function carGeometry() {
  const b = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  b.setIndex(Array.from(b.index.array).filter((_, i) => i < 18 || i >= 24)); // buang sisi −Y
  b.deleteAttribute('uv');
  return b;
}

/** Lampu mobil satuan (ruang kotak mobil): dua lampu depan putih-kuning (+z) dan dua lampu belakang merah (−z). Warna per titik. */
export function carLightsGeometry() {
  const parts = [];
  const add = (x, z, color) => {
    const b = new THREE.BoxGeometry(0.22, 0.16, 0.06).translate(x, 0.38, z).toNonIndexed();
    b.deleteAttribute('uv');
    const c = new THREE.Color(color);
    const n = b.attributes.position.count;
    b.setAttribute('color', new THREE.BufferAttribute(Float32Array.from({ length: n * 3 }, (_, i) => [c.r, c.g, c.b][i % 3]), 3));
    parts.push(b);
  };
  for (const x of [-0.32, 0.32]) { add(x, 0.505, '#fff2c0'); add(x, -0.505, '#ff2a1a'); }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/**
 * @param {{parent: THREE.Object3D, halfWidths?: number[]}} opts
 * @returns {{addRoads(ox:number, oz:number, roads: Array<{cls:number, pts:Array<[number,number]>}>): void,
 *   update(o: {time:number, focus:{x:number,z:number}, distance:number, hour:number}): void, setVisible(on: boolean): void,
 *   stats(): object, dispose(): void}}
 */
export function createFarLife({ parent }) {
  const lanes = [];
  let laneSeq = 1;
  const owned = [];
  const own = (r) => { owned.push(r); return r; };

  const carMat = own(applyNightGlow(new THREE.MeshLambertMaterial(), { strength: 0.5 })); // lampu mobil malam
  carMat.name = 'kotaJauh:mobil';
  const cars = new THREE.InstancedMesh(own(carGeometry()), carMat, LIFE.maxCars);
  cars.name = 'mobilJauh';
  cars.frustumCulled = false;
  cars.count = 0;
  const palette = CAR_COLORS.map((c) => new THREE.Color(c));
  for (let i = 0; i < LIFE.maxCars; i += 1) cars.setColorAt(i, palette[Math.floor(hash01(i, 77) * palette.length)]);
  cars.instanceColor.needsUpdate = true;

  const lampMat = own(new THREE.MeshBasicMaterial({ color: 0x20222a }));
  lampMat.name = 'kotaJauh:lampu';
  const lampGeo = own(new THREE.BoxGeometry(2.4, 1.4, 2.4).translate(0, 6.5, 0));
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, LIFE.maxLamps);
  lamps.name = 'lampuJauh';
  lamps.frustumCulled = false;
  lamps.count = 0;
  lamps.visible = false;
  const lightMat = own(new THREE.MeshBasicMaterial({ vertexColors: true }));
  lightMat.name = 'kotaJauh:lampuMobil';
  const carLights = new THREE.InstancedMesh(own(carLightsGeometry()), lightMat, LIFE.maxCars);
  carLights.name = 'lampuMobilJauh';
  carLights.frustumCulled = false;
  carLights.count = 0;
  carLights.visible = false;
  const boatMat = own(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  boatMat.name = 'kotaJauh:perahu';
  const boats = new THREE.InstancedMesh(own(carGeometry()), boatMat, BOATS.max);
  boats.name = 'perahuJauh';
  boats.frustumCulled = false;
  boats.count = 0;
  const boatPalette = ['#c9552f', '#e8e4d8', '#2f6fa8', '#e0b43c'].map((c) => new THREE.Color(c));
  for (let i = 0; i < BOATS.max; i += 1) boats.setColorAt(i, boatPalette[Math.floor(hash01(i, 55) * boatPalette.length)]);
  boats.instanceColor.needsUpdate = true;
  const boatLanes = [];
  parent.add(cars, lamps, carLights, boats);

  let pool = []; // { lane, n, speed }
  let lampPoints = [];
  let poolKey = { x: Infinity, z: Infinity, R: 0 };
  const warmOff = new THREE.Color(0x20222a);
  const warmOn = new THREE.Color(0xffc070).multiplyScalar(2.2);

  const repool = (x, z, R) => {
    const chosen = selectLanes(lanes, x, z, R);
    let total = 0;
    pool = [];
    for (const lane of chosen) {
      const n = carsOnLane(lane);
      if (n > 0) { pool.push({ lane, n, speed: (SPEED[lane.cls] ?? 8) * 1.6 }); total += n; }
    }
    // terlalu banyak → tipiskan secara deterministik (tiap mobil punya ambang hash; skala = batas / total)
    pool.keep = total > LIFE.maxCars ? LIFE.maxCars / total : 1;
    lampPoints = [];
    for (const lane of chosen) {
      const half = [9, 8, 7, 6, 5][lane.cls] ?? 5;
      for (const sp of lampSpots(lane, half)) lampPoints.push(sp);
    }
    if (lampPoints.length > LIFE.maxLamps) {
      const step = lampPoints.length / LIFE.maxLamps;
      lampPoints = Array.from({ length: LIFE.maxLamps }, (_, i) => lampPoints[Math.floor(i * step)]);
    }
    const m = new THREE.Matrix4();
    lampPoints.forEach((p, i) => lamps.setMatrixAt(i, m.makeTranslation(p.x, 0, p.z)));
    lamps.count = lampPoints.length;
    lamps.instanceMatrix.needsUpdate = true;
    poolKey = { x, z, R };
  };

  const tmp = { x: 0, z: 0, ux: 0, uz: 0 };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  return {
    /** Daftarkan jalan satu sel (koordinat lokal sel → dunia); hanya kelas ≤ tertiary. */
    addRoads(ox, oz, roads) {
      for (const r of roads) {
        if (r.cls > FAR_LIFE_ROAD_CLASS) continue;
        const lane = createLane(laneSeq, r.cls, r.pts.map(([x, z]) => [ox + x, oz + z]));
        laneSeq += 1;
        if (lane) lanes.push(lane);
      }
      poolKey = { x: Infinity, z: Infinity, R: 0 }; // sel baru: pool ditinjau ulang
    },
    /** Daftarkan jalur sungai/kanal (koordinat dunia). */
    addRivers(lines) {
      let id = 100000;
      for (const pts of lines) {
        const lane = createLane(id, 0, pts, BOATS.minLaneLength);
        id += 1;
        if (lane) boatLanes.push(lane);
      }
    },
    setVisible(on) { boats.visible = Boolean(on); cars.visible = Boolean(on); if (!on) { lamps.visible = false; carLights.visible = false; } },
    update({ time, focus, distance, hour }) {
      if (!cars.visible) return;
      const R = Math.min(LIFE.maxRadius, Math.max(LIFE.minRadius, distance * LIFE.radiusPerDistance));
      const moved = Math.hypot(focus.x - poolKey.x, focus.z - poolKey.z);
      if (moved > R * LIFE.repoolDistance || Math.abs(R - poolKey.R) > poolKey.R * 0.25) repool(focus.x, focus.z, R);
      const density = trafficDensity(hour);
      let count = 0;
      outer: for (const { lane, n, speed } of pool) {
        for (let i = 0; i < n; i += 1) {
          if (hash01(lane.id, i, 7) > density * pool.keep) continue;
          if (count >= LIFE.maxCars) break outer;
          const dir = hash01(lane.id, i, 3) < 0.5 ? 1 : -1;
          const v = speed * (0.8 + 0.4 * hash01(lane.id, i, 9));
          const phase = hash01(lane.id, i, 1) * lane.len;
          const along = (((phase + v * time) % lane.len) + lane.len) % lane.len;
          pointAt(lane, dir > 0 ? along : lane.len - along, tmp);
          const hx = tmp.ux * dir;
          const hz = tmp.uz * dir;
          const off = 2.4; // lajur kiri: kiri arah jalan = (hz, −hx)
          q.setFromAxisAngle(UP, Math.atan2(hx, hz));
          m4.compose(pos.set(tmp.x + hz * off, 0.4, tmp.z - hx * off), q, scl.set(2.0 * LIFE.carScale, 1.5 * LIFE.carScale, 4.4 * LIFE.carScale));
          cars.setMatrixAt(count, m4);
          carLights.setMatrixAt(count, m4);
          count += 1;
        }
      }
      cars.count = count;
      carLights.count = count;
      cars.instanceMatrix.needsUpdate = true;
      carLights.instanceMatrix.needsUpdate = true;
      let nb = 0;
      const nearBoats = selectLanes(boatLanes, focus.x, focus.z, R * 1.3);
      for (const lane of nearBoats) {
        const n = boatsOnLane(lane);
        for (let i = 0; i < n && nb < BOATS.max; i += 1) {
          const dir = hash01(lane.id, i, 3) < 0.5 ? 1 : -1;
          const along = (((hash01(lane.id, i, 1) * lane.len + BOATS.speed * (0.7 + 0.6 * hash01(lane.id, i, 9)) * time) % lane.len) + lane.len) % lane.len;
          pointAt(lane, dir > 0 ? along : lane.len - along, tmp);
          q.setFromAxisAngle(UP, Math.atan2(tmp.ux * dir, tmp.uz * dir));
          boats.setMatrixAt(nb, m4.compose(pos.set(tmp.x, 0.3, tmp.z), q, scl.set(1.6 * BOATS.scale, 1.1 * BOATS.scale, 5.5 * BOATS.scale)));
          nb += 1;
        }
      }
      boats.count = nb;
      boats.instanceMatrix.needsUpdate = true;
      const night = nightFactor(hour);
      carLights.visible = night > 0.05;
      lightMat.color.setScalar(Math.min(1, night) * 2.2);
      lamps.visible = night > 0.02;
      lampMat.color.copy(warmOff).lerp(warmOn, night);
    },
    stats: () => ({ lanes: lanes.length, cars: cars.count, lamps: lamps.count, boatLanes: boatLanes.length, boats: boats.count }),
    dispose() {
      parent.remove(cars, lamps, carLights, boats);
      boats.dispose();
      cars.dispose();
      lamps.dispose();
      carLights.dispose();
      for (const r of owned) r.dispose?.();
    },
  };
}
