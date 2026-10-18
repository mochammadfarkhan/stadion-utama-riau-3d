/**
 * Cahaya sekre (spec §8.2):
 * - TL 2 tabung (PointLight tanpa bayangan + tabung emisif) menyala otomatis 17:30–06:00; saklar membalik keadaan
 *   sampai batas otomatis berikutnya; kedip starter singkat saat menyala dari saklar/otomatis.
 * - Cahaya langit lewat jendela nako & pintu (SpotLight tanpa bayangan) mengikuti preset jam game, redup saat hujan.
 * - Sinar matahari langsung (DirectionalLight, SATU-SATUNYA penebar bayangan → bayangan bilah nako & teralis di
 *   lantai) mengikuti azimut/elevasi matahari game; hanya muncul bila sinarnya lolos lewat ujung selasar
 *   (windowSunFactor). Debu melayang di cahaya jendela.
 * - Env map RoomEnvironment (PMREM) untuk kilap keramik/kaca; exposure interior lewat setExposure (App).
 * Jumlah lampu & castShadow tetap sepanjang hidup interior (tanpa kompilasi ulang shader); "mati" = intensitas 0,
 * peta bayangan tidak diperbarui saat tidak ada sinar (shadow.autoUpdate = false).
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { sunFromHour } from '../../sim/dayCycle.js';
import { directionFromAngles } from '../../world/Lighting.js';
import { makeRng } from '../../entities/util.js';
import { SELASAR, WINDOW, WINDOW_CENTER, DOOR, TL_POS } from './data.js';

export const TL_ON_FROM = 17.5;
export const TL_ON_UNTIL = 6;
const TL_INTENSITY = 9;
const WINDOW_SPOT = 16;
const DOOR_SPOT = 12;
const FLICKER_S = 0.6;
const MOTES = 80;
const UP = new THREE.Vector3(0, 1, 0);
const WHITE = new THREE.Color(0xffffff);

const wrapHour = (h) => (Number.isFinite(h) ? ((h % 24) + 24) % 24 : 0);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** TL menyala otomatis 17:30–06:00 (spec §8.2). */
export function tlAutoOn(hour) {
  const h = wrapHour(hour);
  return h >= TL_ON_FROM || h < TL_ON_UNTIL;
}

/** Arah ke matahari dalam koordinat ruang (ruang diputar roomYaw terhadap dunia, konvensi yaw entitas). */
export function sunLocalDirection(hour, { azimuthOffsetDeg = 0, roomYaw = 0 } = {}, out = new THREE.Vector3()) {
  const sun = sunFromHour(hour);
  directionFromAngles(sun.elevationDeg, sun.azimuthDeg + azimuthOffsetDeg, out);
  return out.applyAxisAngle(UP, -roomYaw);
}

/**
 * 0..1: sinar dari pusat jendela menuju matahari keluar lewat ujung selasar yang terbuka sebelum menabrak atap
 * selasar atau dinding deret seberang. Selasar tanpa atap: cukup lewat di atas dinding seberang. Murni.
 * @param {{x:number,y:number,z:number}} dir arah ke matahari (ruang-lokal)
 */
export function windowSunFactor(dir, s = SELASAR, w = WINDOW_CENTER) {
  if (!dir || !(dir.y > 0.02) || !(dir.z < -0.02)) return 0;
  const tWall = (s.zSeberang - w.z) / dir.z;
  if (!s.beratap && w.y + dir.y * tWall > s.tinggiAtap) return 1;
  const tRoof = s.beratap ? (s.tinggiAtap - w.y) / dir.y : Infinity;
  const xEnd = dir.x > 0 ? s.ujungKanan : s.ujungKiri;
  const tEnd = Math.abs(dir.x) > 1e-4 ? (xEnd - w.x) / dir.x : Infinity;
  return smoothstep(-0.3, 0.3, Math.min(tWall, tRoof) - tEnd);
}

function createMotes() {
  const rnd = makeRng(81);
  const pos = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i += 1) {
    pos.set([WINDOW.x - 0.6 + rnd() * 1.2, 0.8 + rnd() * 1.4, -2.9 + rnd() * 1.9], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff1d6, size: 0.012, transparent: true, opacity: 0, depthWrite: false }));
  motes.name = 'debu-jendela';
  return motes;
}

/**
 * @param {{renderer?: THREE.WebGLRenderer|null, scene: THREE.Scene}} opts
 */
export function createSekreLighting({ renderer = null, scene }) {
  const group = new THREE.Group();
  group.name = 'cahaya-sekre';
  const hemi = new THREE.HemisphereLight(0xdfe8f5, 0x6b4a3a, 0.2);
  const tl = TL_POS.map((p) => {
    const l = new THREE.PointLight(0xf2f6ff, 0, 0, 2);
    l.position.set(p.x, p.y - 0.15, p.z);
    return l;
  });
  const windowSpot = new THREE.SpotLight(0xffffff, 0, 0, Math.PI / 3, 0.85, 2);
  windowSpot.position.set(WINDOW_CENTER.x, 1.95, -3.5);
  windowSpot.target.position.set(-0.6, 0, 0.6);
  const doorSpot = new THREE.SpotLight(0xffffff, 0, 0, Math.PI / 3.2, 0.9, 2);
  doorSpot.position.set((DOOR.x0 + DOOR.x1) / 2, 2.0, -3.6);
  doorSpot.target.position.set(1.0, 0, 0);
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 0.5, far: 30 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 2;
  sun.shadow.blurSamples = 8;
  sun.shadow.autoUpdate = false;
  sun.target.position.set(WINDOW_CENTER.x, 0, -1.0);
  const laptopGlow = new THREE.PointLight(0x9cc4ff, 0, 3, 2);
  laptopGlow.position.set(1.5, 1.05, 1.2);
  const motes = createMotes();
  group.add(hemi, ...tl, windowSpot, windowSpot.target, doorSpot, doorSpot.target, sun, sun.target, laptopGlow, motes);

  let envRT = null;
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    envRT = pmrem.fromScene(roomEnv, 0.04);
    roomEnv.dispose();
    pmrem.dispose();
    scene.environment = envRT.texture;
  }

  let override = null; // null = ikut jadwal otomatis; true/false = ditimpa saklar
  let lastAuto = null;
  let flicker = 0;
  let on = false;
  let t = 0;
  const dir = new THREE.Vector3();
  const tint = new THREE.Color();

  return {
    group,
    get tlOn() { return on; },
    /** Saklar: balik keadaan TL sekarang; berlaku sampai batas otomatis berikutnya (17:30 / 06:00). */
    toggleSwitch() {
      override = !on;
      on = override;
      if (on) flicker = FLICKER_S;
      return on;
    },
    /**
     * @param {number} dt
     * @param {{hour:number, preset:object, azimuthOffsetDeg?:number, roomYaw?:number, rain?:number,
     *   laptopActive?:boolean, tlMaterial?:THREE.Material, screenMaterial?:THREE.Material, setExposure?:(v:number)=>void}} s
     */
    update(dt, s) {
      const d = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      t += d;
      const auto = tlAutoOn(s.hour);
      if (auto !== lastAuto) {
        if (lastAuto !== null) {
          override = null;
          if (auto) flicker = FLICKER_S;
        }
        lastAuto = auto;
      }
      on = override ?? auto;
      flicker = Math.max(0, flicker - d);
      const level = on ? (flicker > 0 && Math.sin(flicker * 47) < 0.3 ? 0.08 : 1) : 0;
      for (const l of tl) l.intensity = TL_INTENSITY * level;
      if (s.tlMaterial) s.tlMaterial.emissiveIntensity = 0.15 + 2.6 * level;

      const p = s.preset;
      const day = smoothstep(-4, 12, sunFromHour(s.hour).elevationDeg);
      const rain = clamp01(s.rain ?? 0);
      const wet = 1 - 0.55 * rain;
      hemi.intensity = (0.05 + 0.4 * p.hemiIntensity * day) * wet + 0.05 * level;
      hemi.color.setHex(p.hemiSky);
      tint.setHex(p.sunColor).lerp(WHITE, 0.55);
      windowSpot.color.copy(tint);
      doorSpot.color.copy(tint);
      windowSpot.intensity = WINDOW_SPOT * day * wet;
      doorSpot.intensity = DOOR_SPOT * day * wet;

      sunLocalDirection(s.hour, { azimuthOffsetDeg: s.azimuthOffsetDeg ?? 0, roomYaw: s.roomYaw ?? 0 }, dir);
      const beam = windowSunFactor(dir) * day * (1 - clamp01(rain * 2));
      sun.intensity = p.sunIntensity * 0.9 * beam;
      sun.color.setHex(p.sunColor);
      sun.position.copy(sun.target.position).addScaledVector(dir, 12);
      sun.shadow.autoUpdate = beam > 0.01;

      motes.material.opacity = (0.15 + 0.5 * beam) * day * wet;
      motes.position.y = 0.04 * Math.sin(t * 0.3);
      const laptop = Boolean(s.laptopActive);
      laptopGlow.intensity = laptop ? (level > 0.5 ? 0.25 : 0.9) : 0;
      if (s.screenMaterial) s.screenMaterial.emissiveIntensity = laptop ? 1.4 : 0;
      if (scene.background?.isColor) scene.background.setHex(p.fogColor).multiplyScalar(0.6 + 0.4 * wet);
      scene.environmentIntensity = 0.08 + 0.25 * day * wet + 0.12 * level;
      s.setExposure?.(0.92 + 0.08 * day * (1 - level));
    },
    /** Lepas sumber daya di luar pohon scene: peta bayangan & env map. */
    dispose() {
      sun.shadow.dispose();
      if (envRT && scene.environment === envRT.texture) scene.environment = null;
      envRT?.dispose();
    },
  };
}
