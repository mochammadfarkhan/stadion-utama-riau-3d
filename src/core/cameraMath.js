/**
 * Matematika kamera pemain (murni, dites). Orang ketiga = orbit bola di sekitar titik pandang
 * (sepeda + tinggi pandang): jarak konstan, elevasi dibatasi agar kamera tidak pernah di bawah tanah,
 * dan posisi bisa ditarik mendekat bila terhalang dinding.
 */
const fin = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const BASE_HORIZONTAL = 6.5;   // jarak mendatar di belakang sepeda (sama dengan desain awal)
const BASE_RISE = 1.1;         // tinggi kamera di atas titik pandang (2,4 m − 1,3 m)
const LOOK_HEIGHT = 1.3;
const MIN_HEIGHT = 0.45;       // kamera tidak boleh lebih rendah dari ini (tanah = 0)
const RADIUS = Math.hypot(BASE_HORIZONTAL, BASE_RISE);

export const THIRD = Object.freeze({
  radius: RADIUS,
  lookHeight: LOOK_HEIGHT,
  minHeight: MIN_HEIGHT,
  baseElevation: Math.atan2(BASE_RISE, BASE_HORIZONTAL),
  minElevation: Math.asin((MIN_HEIGHT - LOOK_HEIGHT) / RADIUS),
  maxElevation: 1.15,           // ±66°: tidak tepat di atas kepala
  minScale: 0.22,               // paling dekat saat terhalang: ±1,4 m dari titik pandang
  snapDistance: 25,
  lookIdleDelay: 1.2,           // detik tanpa input lihat sebelum kamera kembali ke belakang sepeda
  lookReturnRate: 1.5,
});

/** Normalisasi sudut ke (−π, π]; non-hingga → 0. */
export function wrapAngle(a) {
  if (!Number.isFinite(a)) return 0;
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

/**
 * Posisi kamera relatif terhadap titik pandang. yaw = arah hadap sepeda + offset mouse;
 * pitch positif (mouse turun) menaikkan kamera. Jarak ke titik pandang selalu THIRD.radius.
 * @returns {{x:number,y:number,z:number}}
 */
export function thirdPersonOffset(yaw, pitch, cfg = THIRD) {
  const e = clamp(cfg.baseElevation + fin(pitch), cfg.minElevation, cfg.maxElevation);
  const y = fin(yaw);
  const horizontal = cfg.radius * Math.cos(e);
  return { x: -Math.sin(y) * horizontal, y: cfg.radius * Math.sin(e), z: -Math.cos(y) * horizontal };
}

/**
 * Tarik kamera mendekat ke titik pandang (skala seragam, jadi elevasi tetap) sampai posisinya
 * "bebas" menurut `isClear(x, z)`. Tidak pernah lebih dekat dari minScale.
 * @returns {{x:number,y:number,z:number,scale:number}}
 */
export function pullInOffset(target, offset, isClear, minScale = THIRD.minScale, iterations = 10) {
  const at = (s) => isClear(target.x + offset.x * s, target.z + offset.z * s);
  const out = (s) => ({ x: offset.x * s, y: offset.y * s, z: offset.z * s, scale: s });
  if (at(1)) return out(1);
  if (!at(minScale)) return out(minScale);
  let lo = minScale;
  let hi = 1;
  for (let i = 0; i < iterations; i += 1) {
    const mid = (lo + hi) / 2;
    if (at(mid)) lo = mid;
    else hi = mid;
  }
  return out(lo);
}

/**
 * Bila posisi kamera default terhalang, cari sudut orbit bebas terdekat (berselang-seling +/−, sampai ±maxDeg)
 * pada radius PENUH, daripada menarik kamera sampai menempel di kepala rider.
 * @returns {{x:number,y:number,z:number,swept:number}|null} null bila semua sudut terhalang
 */
export function sweepOffset(target, yaw, pitch, isClear, { stepDeg = 15, maxDeg = 90 } = {}) {
  const step = (stepDeg * Math.PI) / 180;
  const steps = Math.round(maxDeg / stepDeg);
  for (let i = 0; i <= steps; i += 1) {
    for (const sign of i === 0 ? [1] : [1, -1]) {
      const swept = sign * i * step;
      const o = thirdPersonOffset(fin(yaw) + swept, pitch);
      if (isClear(target.x + o.x, target.z + o.z)) return { ...o, swept };
    }
  }
  return null;
}

/** Offset lihat (yaw) kembali ke 0 hanya setelah `idleSec` melewati jeda; selama masih digerakkan tidak melawan input. */
export function decayLook(value, dt, idleSec, { delay = THIRD.lookIdleDelay, rate = THIRD.lookReturnRate } = {}) {
  if (!(idleSec >= delay)) return value;
  return value * Math.exp(-rate * Math.max(0, fin(dt)));
}

/** Kamera terlalu jauh dari pose ideal (teleport/respawn): loncat langsung, jangan terbang menembus bangunan. */
export function shouldSnap(dx, dy, dz, limit = THIRD.snapDistance) {
  const d = Math.hypot(dx, dy, dz);
  return !Number.isFinite(d) || d > limit;
}

/** Vektor arah pandang orang pertama (satuan). pitch positif = melihat ke bawah. */
export function firstPersonDirection(yaw, pitch) {
  const y = fin(yaw);
  const p = fin(pitch);
  return { x: Math.sin(y) * Math.cos(p), y: -Math.sin(p), z: Math.cos(y) * Math.cos(p) };
}
