/**
 * Matematika kamera 3/4 dari atas ("angled", murni, dites): perspektif miring mengikuti pemain,
 * posisi diredam halus, yaw mengikuti arah sepeda dengan lag lambat, zoom mengubah jarak DAN pitch
 * (dekat = lebih landai, jauh = lebih curam). Semua konstanta di sini; tanpa angka sihir di CameraRig.
 */
const fin = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const DEG = Math.PI / 180;

export const ANGLED = Object.freeze({
  fov: 42,
  minDistance: 10,
  maxDistance: 45,
  defaultDistance: 24,
  pitchNear: 48 * DEG,      // pada jarak minimum
  pitchFar: 62 * DEG,       // pada jarak maksimum
  lookHeight: 1.0,          // titik pandang di atas tanah di bawah pemain (m)
  positionRate: 5,          // 1/s peredaman posisi
  yawSettleSec: 2.5,        // waktu kira-kira yaw mengejar arah sepeda
  yawIdleDelay: 3,          // detik tanpa input yaw sebelum offset manual kembali ke 0
  yawReturnRate: 0.6,
  zoomPerWheelUnit: 0.0012, // jarak *= exp(deltaY * ini)
  yawKeyRate: 1.6,          // rad/dtk untuk tombol putar
  snapDistance: 80,
  near: 1,
  far: 2500,
});

/** Normalisasi sudut ke (−π, π]. */
export function wrap(a) {
  if (!Number.isFinite(a)) return 0;
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

export function clampDistance(d, cfg = ANGLED) {
  return clamp(Number.isNaN(d) || typeof d !== 'number' ? cfg.defaultDistance : d, cfg.minDistance, cfg.maxDistance);
}

/** Pitch (rad, ke bawah) menurut jarak: interpolasi linear nearpitch → farPitch. */
export function pitchForDistance(distance, cfg = ANGLED) {
  const t = (clampDistance(distance, cfg) - cfg.minDistance) / (cfg.maxDistance - cfg.minDistance);
  return cfg.pitchNear + (cfg.pitchFar - cfg.pitchNear) * t;
}

/** Zoom roda mouse (deltaY > 0 = menjauh), hasil dijepit. */
export function zoomDistance(distance, deltaY, cfg = ANGLED) {
  return clampDistance(clampDistance(distance, cfg) * Math.exp(fin(deltaY) * cfg.zoomPerWheelUnit), cfg);
}

/** Offset kamera dari titik pandang: di belakang arah `yaw` (maju = (sin, cos)), tinggi sesuai pitch. */
export function angledOffset(yaw, distance, cfg = ANGLED) {
  const d = clampDistance(distance, cfg);
  const p = pitchForDistance(d, cfg);
  const h = d * Math.cos(p);
  const y = fin(yaw);
  return { x: -Math.sin(y) * h, y: d * Math.sin(p), z: -Math.cos(y) * h };
}

/** Faktor lerp bebas-frame-rate untuk laju `rate` (1/s). */
export function smoothFactor(dt, rate) {
  return 1 - Math.exp(-Math.max(0, fin(dt)) * Math.max(0, fin(rate)));
}

/** Satu langkah peredaman posisi; mengembalikan {x,y,z} baru (tanpa mutasi). */
export function stepPosition(cur, goal, dt, cfg = ANGLED) {
  const k = smoothFactor(dt, cfg.positionRate);
  return { x: cur.x + (goal.x - cur.x) * k, y: cur.y + (goal.y - cur.y) * k, z: cur.z + (goal.z - cur.z) * k };
}

/** Satu langkah yaw menuju target lewat sudut terpendek; konstanta waktu = yawSettleSec / 3. */
export function stepYaw(yaw, target, dt, cfg = ANGLED) {
  const tau = cfg.yawSettleSec / 3;
  const k = 1 - Math.exp(-Math.max(0, fin(dt)) / tau);
  return wrap(fin(yaw) + wrap(fin(target) - fin(yaw)) * k);
}

/** Offset yaw manual kembali ke 0 setelah idle lewat jeda. */
export function decayYawOffset(offset, dt, idleSec, cfg = ANGLED) {
  if (!(idleSec >= cfg.yawIdleDelay)) return offset;
  return offset * Math.exp(-cfg.yawReturnRate * Math.max(0, fin(dt)));
}

/** Kamera terlalu jauh dari pose ideal (teleport): loncat. */
export function shouldSnapAngled(dx, dy, dz, cfg = ANGLED) {
  const d = Math.hypot(dx, dy, dz);
  return !Number.isFinite(d) || d > cfg.snapDistance;
}
