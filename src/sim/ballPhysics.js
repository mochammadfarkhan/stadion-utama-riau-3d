/**
 * Fisika bola sepak: gravitasi, pantul tanah, gesek gulir, pantul batas pitch,
 * deteksi gol. Murni & immutable. Tim 'a' menyerang gawang z>0, tim 'b' gawang z<0.
 */
import { PITCH, FOOTBALL } from '../config/constants.js';

const sign = (v) => (v < 0 ? -1 : 1);
const MAX_STEP = 0.25; // detik: batas langkah (aplikasi sudah membatasi 0,05; ini pengaman bagi pemanggil lain)

/** Bola diam di titik tengah. */
export function createBall() {
  return { pos: { x: 0, y: FOOTBALL.ballRadius, z: 0 }, vel: { x: 0, y: 0, z: 0 } };
}

/** Gravitasi + drag udara, integrasi posisi. */
function integrate(ball, dt) {
  const air = Math.max(0, 1 - FOOTBALL.airDrag * dt);
  const vel = { x: ball.vel.x * air, y: ball.vel.y - FOOTBALL.gravity * dt, z: ball.vel.z * air };
  const pos = { x: ball.pos.x + vel.x * dt, y: ball.pos.y + vel.y * dt, z: ball.pos.z + vel.z * dt };
  return { pos, vel };
}

/** Pantul tanah (restitusi) dan gesek gulir saat menyentuh tanah. */
function groundContact(ball, dt) {
  const r = FOOTBALL.ballRadius;
  if (ball.pos.y > r) return ball;
  const bounce = ball.vel.y < 0 ? -ball.vel.y * FOOTBALL.restitution : ball.vel.y;
  const vy = Math.abs(bounce) < FOOTBALL.restVelocity ? 0 : bounce;
  const roll = Math.max(0, 1 - FOOTBALL.rollFriction * dt);
  return { pos: { ...ball.pos, y: r }, vel: { x: ball.vel.x * roll, y: vy, z: ball.vel.z * roll } };
}

/** Pantul dari garis samping (±width/2). */
function sideWalls(ball) {
  const limit = PITCH.width / 2 - FOOTBALL.ballRadius;
  if (Math.abs(ball.pos.x) <= limit) return ball;
  const s = sign(ball.pos.x);
  return {
    pos: { ...ball.pos, x: s * limit },
    vel: { ...ball.vel, x: -Math.abs(ball.vel.x) * s * FOOTBALL.wallRestitution },
  };
}

/** Apakah posisi melewati garis gawang di dalam mulut gawang. */
function isInGoal(pos) {
  return Math.abs(pos.x) < PITCH.goalWidth / 2 && pos.y < PITCH.goalHeight;
}

/**
 * Garis gawang (±length/2): gol bila masuk mulut gawang, selain itu memantul.
 * @returns {{ball, scorer:null|'a'|'b'}}
 */
function endLines(ball) {
  const limit = PITCH.length / 2 - FOOTBALL.ballRadius;
  if (Math.abs(ball.pos.z) <= limit) return { ball, scorer: null };
  const s = sign(ball.pos.z);
  if (isInGoal(ball.pos)) return { ball, scorer: s > 0 ? 'a' : 'b' };
  return {
    scorer: null,
    ball: {
      pos: { ...ball.pos, z: s * limit },
      vel: { ...ball.vel, z: -Math.abs(ball.vel.z) * s * FOOTBALL.wallRestitution },
    },
  };
}

/**
 * Satu langkah fisika bola.
 * @returns {{ball, scorer:null|'a'|'b'}} scorer terisi bila terjadi gol
 */
export function stepBall(ball, dt) {
  const h = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), MAX_STEP) : 0; // dt rusak/negatif tidak boleh merusak state
  if (h === 0) return { ball, scorer: null };
  const moved = sideWalls(groundContact(integrate(ball, h), h));
  return endLines(moved);
}

/** Terapkan tendangan: kecepatan baru ke arah (dx,dz) dengan sedikit angkat. */
export function kickBall(ball, dx, dz, speed) {
  const d = Math.hypot(dx, dz);
  if (d < 1e-9) return { pos: { ...ball.pos }, vel: { ...ball.vel } };
  return {
    pos: { ...ball.pos },
    vel: { x: (dx / d) * speed, y: speed * FOOTBALL.kickLift, z: (dz / d) * speed },
  };
}
