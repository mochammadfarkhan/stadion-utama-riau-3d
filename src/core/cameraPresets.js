import { STADIUM } from '../config/constants.js';

/**
 * Definisi sudut pandang (POV) dan matematikanya. Murni: tanpa THREE/DOM, tanpa
 * alokasi per panggilan (hasil ditulis ke objek `out`), sehingga mudah diuji di Node.
 * Dunia: pusat lapangan di origin, +Y atas, utara = −Z, barat = −X.
 */

export const POV_KINDS = Object.freeze({ FIXED: 'fixed', FOLLOW: 'follow', ORBIT: 'orbit' });

/**
 * @typedef {{id:string,label:string,key:string,kind:string,fov:number,controlsBike:boolean,
 *   follow?:number,cycle?:boolean,minElev:number,maxElev:number,zoomMin:number,zoomMax:number}} PovDef
 * follow = laju smoothing (1/detik), cycle = tekan lagi tombol yang sama pindah subjek.
 */
export const POVS = Object.freeze([
  { id: 'udara', label: 'Udara', key: 'Digit1', kind: 'fixed', fov: 50, controlsBike: false, minElev: 0.15, maxElev: 1.4, zoomMin: 0.5, zoomMax: 1.6 },
  { id: 'tribun', label: 'Tribun', key: 'Digit2', kind: 'fixed', fov: 62, controlsBike: false, minElev: -0.2, maxElev: 0.9, zoomMin: 0.4, zoomMax: 1.6 },
  { id: 'bola', label: 'Bola', key: 'Digit3', kind: 'follow', fov: 55, controlsBike: false, follow: 3.5, minElev: 0.1, maxElev: 1.2, zoomMin: 0.5, zoomMax: 2.2 },
  { id: 'pelari', label: 'Pelari', key: 'Digit4', kind: 'follow', fov: 68, controlsBike: false, follow: 6, cycle: true, minElev: -0.1, maxElev: 1.0, zoomMin: 0.5, zoomMax: 2.0 },
  { id: 'pedagang', label: 'Pedagang', key: 'Digit5', kind: 'follow', fov: 62, controlsBike: false, follow: 5, cycle: true, minElev: -0.1, maxElev: 1.0, zoomMin: 0.5, zoomMax: 2.0 },
  { id: 'orbit', label: 'Orbit sinematik', key: 'Digit6', kind: 'orbit', fov: 50, controlsBike: false, minElev: 0.15, maxElev: 1.2, zoomMin: 0.6, zoomMax: 1.5 },
  { id: 'atas', label: 'Top-down', key: 'Digit7', kind: 'follow', fov: 45, controlsBike: true, follow: 8, minElev: 1.0, maxElev: 1.5, zoomMin: 0.4, zoomMax: 2.2 },
  // M0 multi-region: POV milik region aktif (Region.povs, pose dunia); tekan lagi = POV region berikutnya.
  { id: 'region', label: 'POV region', key: 'Digit8', kind: 'region', fov: 55, controlsBike: false, cycle: true, minElev: -0.2, maxElev: 1.4, zoomMin: 0.4, zoomMax: 2.0 },
].map(Object.freeze));

export const POV_BY_ID = Object.freeze(Object.fromEntries(POVS.map((p) => [p.id, p])));
export const POV_BY_KEY = Object.freeze(Object.fromEntries(POVS.map((p) => [p.key, p])));
export const EXIT_KEY = 'Digit0';

const AERIAL = Object.freeze({ azimuth: 0.62, elevation: 0.55, radius: 430, target: [0, 8, -10] });
const TRIBUNE = Object.freeze({ row: 12, theta: Math.PI - 0.2, eye: 1.15, target: [14, 1.2, -8] });
const ORBIT = Object.freeze({ radius: 360, height: 140, speed: 0.055, target: [0, 10, 0] });
const BALL = Object.freeze({ offset: [-15, 9, 17], lookY: 0.4 });
const RUNNER = Object.freeze({ back: 4.2, side: 0.9, up: 2.0, ahead: 5, lookY: 1.2 });
const VENDOR = Object.freeze({ ahead: 6.5, side: 1.2, up: 1.7, lookY: 1.2 });
const TOPDOWN = Object.freeze({ height: 70, lean: 8 });

const ROOF_CLEAR_Y = STADIUM.roofHeight + 18;   // tinggi aman di atas atap
const ROUTE_Y = 200;                             // tinggi titik kontrol rute melintasi stadion
const LOW_Y = STADIUM.roofHeight + 20;           // di bawah ini dianggap "di dalam ruang stadion"

/** Pose kamera: posisi (p*), titik pandang (t*), FOV. */
export function createPose() {
  return { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, fov: 60 };
}

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
export const clamp01 = (t) => Math.min(1, Math.max(0, t));

/** Durasi transisi menurut jarak antar pose (detik). */
export function transitionDuration(a, b) {
  const d = Math.hypot(b.px - a.px, b.py - a.py, b.pz - a.pz);
  return Math.min(3.2, Math.max(1.2, 1.2 + d / 260));
}

const insideEllipse = (x, z, a, b) => (x / a) ** 2 + (z / b) ** 2 < 1;
const OPEN_A = STADIUM.innerSemiX + STADIUM.roofOpeningPad;
const OPEN_B = STADIUM.innerSemiZ + STADIUM.roofOpeningPad;

/** Titik berada di ruang stadion (di dalam jejak cangkang & di bawah atap). */
export function inStadiumSpace(x, y, z) {
  return y < LOW_Y && insideEllipse(x, z, STADIUM.outerSemiX, STADIUM.outerSemiZ);
}

/** Titik "di dalam mangkuk": ruang stadion, atau kolom bebas di atas bukaan atap. */
export function inBowl(x, y, z) {
  return inStadiumSpace(x, y, z) || insideEllipse(x, z, OPEN_A, OPEN_B);
}

/** Garis lurus A→D melewati ruang stadion pada ketinggian rendah? */
function segmentCrossesShell(a, d) {
  for (let i = 1; i < 16; i += 1) {
    const t = i / 16;
    const y = a.py + (d.py - a.py) * t;
    const x = a.px + (d.px - a.px) * t;
    const z = a.pz + (d.pz - a.pz) * t;
    if (inStadiumSpace(x, y, z)) return true;
  }
  return false;
}

/**
 * Dua titik kontrol Bezier kubik untuk rute A→D.
 * - Satu ujung di dalam mangkuk, satu di luar: naik hampir tegak dari ujung luar sampai
 *   tinggi aman, melintas di atas atap, lalu turun lewat bukaan atap ke ujung dalam.
 * - Keduanya di luar tetapi garis lurus menembus cangkang: naik tegak dari kedua ujung.
 * - Selain itu: lengkung landai dengan sedikit angkat.
 * @param {ReturnType<typeof createPose>} a
 * @param {ReturnType<typeof createPose>} d
 * @param {{x:number,y:number,z:number}} c1 titik kontrol dekat A (ditulis)
 * @param {{x:number,y:number,z:number}} c2 titik kontrol dekat D (ditulis)
 */
function routeControlLocal(a, d, c1, c2) {
  const aIn = inBowl(a.px, a.py, a.pz);
  const dIn = inBowl(d.px, d.py, d.pz);
  if (aIn !== dIn) {
    const aOut = !aIn;
    const o = aOut ? a : d;
    const i = aOut ? d : a;
    const above = { x: o.px, y: Math.max(ROUTE_Y, o.py), z: o.pz };
    const over = { x: i.px * 0.15, y: ROUTE_Y * 0.8, z: i.pz * 0.15 };
    const first = aOut ? above : over;
    const second = aOut ? over : above;
    Object.assign(c1, first);
    Object.assign(c2, second);
    return;
  }
  if (!aIn && segmentCrossesShell(a, d)) {
    const y = ROUTE_Y * 0.9;
    c1.x = a.px; c1.y = Math.max(y, a.py); c1.z = a.pz;
    c2.x = d.px; c2.y = Math.max(y, d.py); c2.z = d.pz;
    return;
  }
  const lift = 4 + Math.hypot(d.px - a.px, d.pz - a.pz) * 0.05;
  c1.x = a.px + (d.px - a.px) / 3; c1.y = a.py + (d.py - a.py) / 3 + lift; c1.z = a.pz + (d.pz - a.pz) / 3;
  c2.x = a.px + ((d.px - a.px) * 2) / 3; c2.y = a.py + ((d.py - a.py) * 2) / 3 + lift; c2.z = a.pz + ((d.pz - a.pz) * 2) / 3;
}

const _routeA = createPose();
const _routeD = createPose();

/** Ubah pose (posisi + titik pandang) region-lokal → dunia, di tempat. */
export function poseToWorld(pose, frame) {
  const p = frame.toWorld(pose.px, pose.pz);
  const t = frame.toWorld(pose.tx, pose.tz);
  pose.px = p.x; pose.pz = p.z; pose.tx = t.x; pose.tz = t.z;
  return pose;
}

/** Ubah pose dunia → region-lokal, di tempat. */
export function poseToLocal(pose, frame) {
  const p = frame.toLocal(pose.px, pose.pz);
  const t = frame.toLocal(pose.tx, pose.tz);
  pose.px = p.x; pose.pz = p.z; pose.tx = t.x; pose.tz = t.z;
  return pose;
}

/**
 * Titik kontrol rute A→D (lihat routeControlLocal). Pose a/d dalam koordinat dunia; `frame` = frame
 * region stadion (geometri cangkang region-lokal). Tanpa frame / frame identitas = perilaku lama.
 */
export function routeControl(a, d, c1, c2, frame = null) {
  if (!frame || frame.identity) {
    routeControlLocal(a, d, c1, c2);
    return;
  }
  routeControlLocal(poseToLocal(copyPose(_routeA, a), frame), poseToLocal(copyPose(_routeD, d), frame), c1, c2);
  const w1 = frame.toWorld(c1.x, c1.z);
  const w2 = frame.toWorld(c2.x, c2.z);
  c1.x = w1.x; c1.z = w1.z;
  c2.x = w2.x; c2.z = w2.z;
}

/** Bezier kubik B(t) dari a, c1, c2, d (komponen x/y/z). */
export function bezier3(a, c1, c2, d, t, out) {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  out.x = w0 * a.px + w1 * c1.x + w2 * c2.x + w3 * d.px;
  out.y = w0 * a.py + w1 * c1.y + w2 * c2.y + w3 * d.py;
  out.z = w0 * a.pz + w1 * c1.z + w2 * c2.z + w3 * d.pz;
  return out;
}

/** Tinggi kursi tribun bawah baris `row` dan posisi pada elips kaki tribun. */
export function tribuneSeat(row, theta, eye, out) {
  const offset = row * STADIUM.rowDepth + 0.45;
  out.x = (STADIUM.innerSemiX + offset) * Math.cos(theta);
  out.z = (STADIUM.innerSemiZ + offset) * Math.sin(theta);
  out.y = (row + 1) * STADIUM.rowRise + eye;
  return out;
}

const _seat = { x: 0, y: 0, z: 0 };

function setTarget(out, t) { out.tx = t[0]; out.ty = t[1]; out.tz = t[2]; }

function poseAerial(out) {
  const { azimuth, elevation, radius, target } = AERIAL;
  const ce = Math.cos(elevation);
  out.px = target[0] + radius * Math.sin(azimuth) * ce;
  out.py = target[1] + radius * Math.sin(elevation);
  out.pz = target[2] + radius * Math.cos(azimuth) * ce;
  setTarget(out, target);
}

function poseTribune(out) {
  tribuneSeat(TRIBUNE.row, TRIBUNE.theta, TRIBUNE.eye, _seat);
  out.px = _seat.x; out.py = _seat.y; out.pz = _seat.z;
  setTarget(out, TRIBUNE.target);
}

function poseOrbit(out, time) {
  const a = time * ORBIT.speed;
  out.px = ORBIT.target[0] + ORBIT.radius * Math.sin(a);
  out.py = ORBIT.height;
  out.pz = ORBIT.target[2] + ORBIT.radius * Math.cos(a);
  setTarget(out, ORBIT.target);
}

function poseBall(out, ball) {
  out.px = ball.x + BALL.offset[0]; out.py = BALL.offset[1]; out.pz = ball.z + BALL.offset[2];
  out.tx = ball.x; out.ty = BALL.lookY; out.tz = ball.z;
}

/** Pose di belakang/samping subjek yang bergerak dengan arah `yaw` (maju = (sin, cos)). */
function poseBehind(out, s, c) {
  const fx = Math.sin(s.yaw);
  const fz = Math.cos(s.yaw);
  out.px = s.x - fx * c.back + fz * c.side;
  out.pz = s.z - fz * c.back - fx * c.side;
  out.py = c.up;
  out.tx = s.x + fx * c.ahead; out.ty = c.lookY; out.tz = s.z + fz * c.ahead;
}

/** Pose di depan pedagang, menghadap ke pedagang. */
function poseFront(out, s) {
  const fx = Math.sin(s.yaw);
  const fz = Math.cos(s.yaw);
  out.px = s.x + fx * VENDOR.ahead + fz * VENDOR.side;
  out.pz = s.z + fz * VENDOR.ahead - fx * VENDOR.side;
  out.py = VENDOR.up;
  out.tx = s.x; out.ty = VENDOR.lookY; out.tz = s.z;
}

function poseTopDown(out, bike) {
  out.px = bike.x; out.py = TOPDOWN.height; out.pz = bike.z + TOPDOWN.lean;
  out.tx = bike.x; out.ty = 0; out.tz = bike.z;
}

/**
 * Pose mentah (tanpa smoothing & offset pengguna) untuk satu POV.
 * @param {PovDef} def
 * @param {{bike:{x:number,z:number,yaw:number}, ball?:()=>{x:number,z:number},
 *   runner?:(i:number)=>({x:number,z:number,yaw:number}|null),
 *   vendor?:(i:number)=>({x:number,z:number,yaw:number}|null), frame?:object,
 *   regionPov?:(i:number)=>({id:string, label:string, pose(ctx:{time:number, bike:object}):object|null}|null)}} src
 *   frame: frame region stadion (createRegionFrame); POV tetap (udara/tribun/orbit) dihitung lokal lalu diubah ke dunia
 * @param {number} subject indeks subjek (pelari/pedagang)
 * @param {number} time detik sejak mulai
 * @param {ReturnType<typeof createPose>} out
 * @returns {boolean} false bila subjek tidak tersedia (pose tidak diubah)
 */
export function povPose(def, src, subject, time, out) {
  switch (def.id) {
    case 'udara': poseAerial(out); break;
    case 'tribun': poseTribune(out); break;
    case 'orbit': poseOrbit(out, time); break;
    case 'atas': poseTopDown(out, src.bike); break;
    case 'bola': {
      const ball = src.ball?.();
      if (!ball) return false;
      poseBall(out, ball);
      break;
    }
    case 'pelari': {
      const r = src.runner?.(subject);
      if (!r) return false;
      poseBehind(out, r, RUNNER);
      break;
    }
    case 'pedagang': {
      const v = src.vendor?.(subject);
      if (!v) return false;
      poseFront(out, v);
      break;
    }
    case 'region': { // pose region sudah di frame DUNIA: tanpa poseToWorld stadion
      const p = src.regionPov?.(subject)?.pose({ time, bike: src.bike });
      if (!p || ![p.px, p.py, p.pz, p.tx, p.ty, p.tz].every(Number.isFinite)) return false;
      out.px = p.px; out.py = p.py; out.pz = p.pz;
      out.tx = p.tx; out.ty = p.ty; out.tz = p.tz;
      out.fov = Number.isFinite(p.fov) ? p.fov : def.fov;
      return true;
    }
    default: return false;
  }
  if (def.kind !== 'follow' && src.frame && !src.frame.identity) poseToWorld(out, src.frame); // pose tetap region-lokal
  out.fov = def.fov;
  return true;
}

/**
 * Terapkan orbit pengguna (yaw, pitch, zoom) mengelilingi titik pandang: posisi
 * diputar & dijauhkan/didekatkan dari target. Elevasi dibatasi per POV.
 */
export function applyOrbit(pose, def, yaw, pitch, zoom) {
  const dx = pose.px - pose.tx;
  const dy = pose.py - pose.ty;
  const dz = pose.pz - pose.tz;
  const flat = Math.hypot(dx, dz);
  const radius = Math.max(0.5, Math.hypot(flat, dy)) * zoom;
  const elev = Math.min(def.maxElev, Math.max(def.minElev, Math.atan2(dy, flat) + pitch));
  const az = Math.atan2(dx, dz) + yaw;
  pose.px = pose.tx + radius * Math.cos(elev) * Math.sin(az);
  pose.py = pose.ty + radius * Math.sin(elev);
  pose.pz = pose.tz + radius * Math.cos(elev) * Math.cos(az);
}

/** Salin pose. */
export function copyPose(to, from) {
  to.px = from.px; to.py = from.py; to.pz = from.pz;
  to.tx = from.tx; to.ty = from.ty; to.tz = from.tz; to.fov = from.fov;
  return to;
}

/** Interpolasi eksponensial pose → target dengan laju `rate` (1/detik). */
export function smoothPose(pose, target, rate, dt) {
  const k = 1 - Math.exp(-rate * dt);
  pose.px += (target.px - pose.px) * k; pose.py += (target.py - pose.py) * k; pose.pz += (target.pz - pose.pz) * k;
  pose.tx += (target.tx - pose.tx) * k; pose.ty += (target.ty - pose.ty) * k; pose.tz += (target.tz - pose.tz) * k;
  pose.fov = target.fov;
  return pose;
}

export { ROOF_CLEAR_Y };
