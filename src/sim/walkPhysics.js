/**
 * Fisika jalan kaki interior (spec §4.9), murni & immutable: state baru tiap langkah.
 * Jalan 1,35 m/s, lari 3,2 m/s (Shift), akselerasi/deselerasi maks 8 m/s² (vektor), arah hadap = yaw kamera
 * (mouse). Tabrakan 2D lewat collider.isWalkable(x, z): sub-langkah ≤ 5 cm agar dinding tipis tidak tertembus;
 * bila terhalang, gerak digeser sepanjang sumbu yang masih bebas. Bila posisi awal sudah di dalam penghalang
 * (spawn/NPC baru duduk), gerak tidak dicek agar pemain bisa keluar.
 * Konvensi yaw = sepeda/Humanoid: maju = (sin yaw, cos yaw), kanan = (−cos yaw, sin yaw).
 */
export const WALK = Object.freeze({ walkSpeed: 1.35, runSpeed: 3.2, accel: 8, maxStep: 0.05, maxDt: 0.1 });

const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function wrapAngle(a) {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

/** @returns {Readonly<{x:number,z:number,yaw:number,vx:number,vz:number}>} */
export function createWalkState({ x = 0, z = 0, yaw = 0 } = {}) {
  return Object.freeze({ x: fin(x), z: fin(z), yaw: wrapAngle(fin(yaw)), vx: 0, vz: 0 });
}

/** Laju mendatar (m/s). */
export function walkSpeedOf(state) {
  return Math.hypot(fin(state?.vx), fin(state?.vz));
}

/**
 * Kecepatan target dari masukan (forward/strafe −1..1, run) pada yaw; diagonal dinormalkan,
 * masukan analog < 1 menghasilkan kecepatan proporsional.
 */
export function desiredVelocity(input, yaw) {
  const f = clamp(fin(input?.forward), -1, 1);
  const s = clamp(fin(input?.strafe), -1, 1);
  const len = Math.hypot(f, s);
  if (len < 1e-6) return { x: 0, z: 0 };
  const k = (input.run ? WALK.runSpeed : WALK.walkSpeed) / Math.max(1, len);
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  return { x: (f * fx - s * fz) * k, z: (f * fz + s * fx) * k };
}

/**
 * @param {{x:number,z:number,yaw:number,vx:number,vz:number}} state
 * @param {{forward?:number, strafe?:number, run?:boolean, yaw?:number}} input
 * @param {number} dt detik (dibatasi 0..WALK.maxDt)
 * @param {{isWalkable(x:number, z:number):boolean}|null} collider
 */
export function stepWalk(state, input, dt, collider = null) {
  if (![state?.x, state?.z, state?.vx, state?.vz].every(Number.isFinite)) return createWalkState(state ?? {});
  const d = clamp(fin(dt), 0, WALK.maxDt);
  const yaw = wrapAngle(Number.isFinite(input?.yaw) ? input.yaw : fin(state.yaw));
  const want = desiredVelocity(input, yaw);
  const dvx = want.x - state.vx;
  const dvz = want.z - state.vz;
  const dv = Math.hypot(dvx, dvz);
  const maxDv = WALK.accel * d;
  const k = dv > maxDv ? maxDv / dv : 1;
  let vx = state.vx + dvx * k;
  let vz = state.vz + dvz * k;
  const stuck = Boolean(collider) && !collider.isWalkable(state.x, state.z);
  const free = (px, pz) => !collider || stuck || collider.isWalkable(px, pz);
  const steps = Math.max(1, Math.ceil((Math.hypot(vx, vz) * d) / WALK.maxStep));
  const h = d / steps;
  let { x, z } = state;
  for (let i = 0; i < steps; i += 1) {
    const nx = x + vx * h;
    const nz = z + vz * h;
    if (free(nx, nz)) {
      x = nx;
      z = nz;
    } else if (vx !== 0 && free(nx, z)) {
      x = nx;
      vz = 0;
    } else if (vz !== 0 && free(x, nz)) {
      z = nz;
      vx = 0;
    } else {
      vx = 0;
      vz = 0;
      break;
    }
  }
  return Object.freeze({ x, z, yaw, vx, vz });
}
