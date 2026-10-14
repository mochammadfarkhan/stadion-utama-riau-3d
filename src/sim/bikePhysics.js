/**
 * Model kinematik sepeda (bicycle model), murni & immutable.
 * yaw 0 menghadap +Z; arah maju = (sin yaw, cos yaw).
 * yawRate = v / wheelBase · tan(steer).
 */
import { BIKE } from '../config/constants.js';

const MAX_DT = 0.05;
const GRAVITY = 9.81;
const STOP_EPS = 0.05;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

/** State awal sepeda. */
export function createBikeState({ x = 0, z = 0, yaw = 0 } = {}) {
  return { x: num(x), z: num(z), yaw: num(yaw), v: 0, steer: 0, lean: 0, wheelSpin: 0, pedalAngle: 0 };
}

/** Normalisasi input: pedal/steer di [-1,1], NaN → 0. */
function sanitizeInput(input) {
  const i = input || {};
  return {
    pedal: clamp(num(i.pedal), -1, 1),
    steer: clamp(num(i.steer), -1, 1),
    sprint: Boolean(i.sprint),
  };
}

/** Kecepatan baru: kayuh / rem / mundur / drag, lalu dibatasi. */
function updateSpeed(v, input, dt, cfg) {
  const top = input.sprint ? cfg.sprintSpeed : cfg.maxSpeed;
  let next = v;
  if (input.pedal > 0) {
    next += cfg.accel * input.pedal * dt;
  } else if (input.pedal < 0) {
    // rem bila masih maju, mundur pelan bila sudah berhenti
    next = v > STOP_EPS ? v - cfg.brake * -input.pedal * dt : v + cfg.reverseAccel * input.pedal * dt;
  }
  if (input.pedal <= 0) next -= cfg.drag * next * dt; // drag saat meluncur/rem
  if (input.pedal >= 0 && v > STOP_EPS && next < 0) next = 0; // rem/drag tidak membalik arah
  return clamp(next, -cfg.reverseSpeed, top);
}

/** Sudut setang di-smooth dan dikurangi pada kecepatan tinggi. */
function updateSteer(steer, input, v, dt, cfg) {
  const speedFactor = 1 / (1 + cfg.steerSpeedFactor * Math.abs(v));
  const target = input.steer * cfg.steerMax * speedFactor;
  return steer + (target - steer) * Math.min(1, cfg.steerRate * dt);
}

/** Lean = −atan(v·yawRate/g), dibatasi leanMax, dengan smoothing. */
function updateLean(lean, v, yawRate, dt, cfg) {
  const target = clamp(-Math.atan((v * yawRate) / GRAVITY), -cfg.leanMax, cfg.leanMax);
  return lean + (target - lean) * Math.min(1, cfg.leanSmoothing * dt);
}

/**
 * Satu langkah simulasi. Mengembalikan state baru, tidak mengubah input.
 * @param {object} state
 * @param {{pedal?:number,steer?:number,sprint?:boolean}} input
 * @param {number} dt detik (di-clamp ≤ 0.05; NaN/≤0 → state disalin)
 */
export function stepBike(state, input, dt, cfg = BIKE) {
  const s = { ...createBikeState(), ...state };
  const step = num(dt);
  if (step <= 0) return s;
  const h = Math.min(step, MAX_DT);
  const inp = sanitizeInput(input);

  const v = updateSpeed(s.v, inp, h, cfg);
  const steer = updateSteer(s.steer, inp, v, h, cfg);
  const yawRate = (v / cfg.wheelBase) * Math.tan(steer);
  const yaw = s.yaw + yawRate * h;
  const spin = (v / cfg.wheelRadius) * h;

  return {
    x: s.x + v * Math.sin(yaw) * h,
    z: s.z + v * Math.cos(yaw) * h,
    yaw,
    v,
    steer,
    lean: updateLean(s.lean, v, yawRate, h, cfg),
    wheelSpin: s.wheelSpin + spin,
    pedalAngle: s.pedalAngle + Math.max(0, spin) * cfg.pedalRatio,
  };
}
