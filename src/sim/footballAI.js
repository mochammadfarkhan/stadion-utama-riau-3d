/**
 * AI sepak bola mini: FSM pemain CHASE / KICK / RETURN + bola.
 * Tim 'a' home di z<0 menyerang gawang z>0; tim 'b' sebaliknya.
 * Semua fungsi murni; stepMatch mengembalikan match baru (deep copy pos/vel).
 */
import { PITCH, FOOTBALL } from '../config/constants.js';
import { createBall, stepBall, kickBall } from './ballPhysics.js';

const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
const dist2D = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
const goalDir = (team) => (team === 'a' ? 1 : -1);
const goalCenter = (team) => ({ x: 0, z: goalDir(team) * (PITCH.length / 2) });

/** Sebaran x merata untuk k pemain dalam satu baris. */
function spreadX(k) {
  const span = PITCH.width * FOOTBALL.formationSpread;
  return Array.from({ length: k }, (_, i) => (k === 1 ? 0 : -span / 2 + (span * i) / (k - 1)));
}

/** Formasi tim 'a' (z<0): kiper, baris bek, baris penyerang. Tim 'b' dicerminkan. */
function formation(team, size) {
  const n = Math.max(1, Math.floor(size));
  const half = PITCH.length / 2;
  const defenders = Math.floor((n - 1) / 2);
  const attackers = n - 1 - defenders;
  const rows = [
    { count: 1, z: -half + FOOTBALL.formationDepth },
    { count: defenders, z: -half + FOOTBALL.defenderDepth },
    { count: attackers, z: -FOOTBALL.attackerDepth },
  ];
  const mirror = goalDir(team) === 1 ? 1 : -1;
  return rows.flatMap((row) => spreadX(row.count).map((x) => ({ x: x * mirror, z: row.z * mirror })));
}

function createPlayer(id, team, home) {
  return {
    id, team, pos: { ...home }, vel: { x: 0, z: 0 }, state: 'RETURN', home: { ...home },
    facing: team === 'a' ? 0 : Math.PI, kickTimer: 0,
  };
}

/** Pertandingan baru: 2 tim × teamSize pemain, bola di tengah. */
export function createMatch({ teamSize = 5 } = {}) {
  const size = Math.max(1, Math.floor(num(teamSize, 5)));
  const players = ['a', 'b'].flatMap((team) =>
    formation(team, size).map((home, i) => createPlayer(`${team}${i + 1}`, team, home)));
  return { players, ball: createBall(), score: { a: 0, b: 0 }, t: 0 };
}

/** Indeks pemain terdekat ke bola per tim. */
function nearestByTeam(players, ball) {
  return players.reduce((acc, p, i) => {
    const d = dist2D(p.pos, ball.pos);
    const best = acc[p.team];
    return best && best.d <= d ? acc : { ...acc, [p.team]: { i, d } };
  }, {});
}

/** Target posisi: CHASE → bola, RETURN → home digeser sedikit ke arah bola. */
function targetFor(p, state, ball) {
  if (state === 'CHASE') return { x: ball.pos.x, z: ball.pos.z };
  const k = FOOTBALL.returnShift;
  return { x: p.home.x + (ball.pos.x - p.home.x) * k, z: p.home.z + (ball.pos.z - p.home.z) * k };
}

/** Seek + arrive: kecepatan baru menuju target, dibatasi akselerasi. */
function seekArrive(p, target, dt) {
  const dx = target.x - p.pos.x;
  const dz = target.z - p.pos.z;
  const d = Math.hypot(dx, dz);
  const speed = d < FOOTBALL.arriveRadius ? (FOOTBALL.playerSpeed * d) / FOOTBALL.arriveRadius : FOOTBALL.playerSpeed;
  const want = d > 1e-9 ? { x: (dx / d) * speed, z: (dz / d) * speed } : { x: 0, z: 0 };
  const sx = want.x - p.vel.x;
  const sz = want.z - p.vel.z;
  const sLen = Math.hypot(sx, sz);
  const maxStep = FOOTBALL.playerAccel * dt;
  const k = sLen > maxStep ? maxStep / sLen : 1;
  return { x: p.vel.x + sx * k, z: p.vel.z + sz * k };
}

const clampToPitch = (pos) => ({
  x: Math.max(-PITCH.width / 2 - FOOTBALL.playerMargin, Math.min(PITCH.width / 2 + FOOTBALL.playerMargin, pos.x)),
  z: Math.max(-PITCH.length / 2 - FOOTBALL.playerMargin, Math.min(PITCH.length / 2 + FOOTBALL.playerMargin, pos.z)),
});

/** Gerakkan satu pemain sesuai state; KICK menahan posisi. */
function movePlayer(p, state, ball, dt) {
  const vel = state === 'KICK' ? { x: 0, z: 0 } : seekArrive(p, targetFor(p, state, ball), dt);
  const pos = clampToPitch({ x: p.pos.x + vel.x * dt, z: p.pos.z + vel.z * dt });
  const facing = Math.hypot(vel.x, vel.z) > 0.1 ? Math.atan2(vel.x, vel.z) : p.facing;
  return { ...p, pos, vel, state, facing, kickTimer: Math.max(0, p.kickTimer - dt), home: { ...p.home } };
}

/** Separation posisi: dorong pasangan yang lebih dekat dari radius. */
function separate(players) {
  const r = FOOTBALL.separationRadius;
  const shift = players.map(() => ({ x: 0, z: 0 }));
  players.forEach((a, i) => players.slice(i + 1).forEach((b, k) => {
    const j = i + 1 + k;
    const d = dist2D(a.pos, b.pos);
    if (d >= r) return;
    const dx = d > 1e-6 ? (b.pos.x - a.pos.x) / d : Math.cos(i + j);
    const dz = d > 1e-6 ? (b.pos.z - a.pos.z) / d : Math.sin(i + j);
    const push = (r - d) / 2;
    shift[i] = { x: shift[i].x - dx * push, z: shift[i].z - dz * push };
    shift[j] = { x: shift[j].x + dx * push, z: shift[j].z + dz * push };
  }));
  return players.map((p, i) => ({ ...p, pos: { x: p.pos.x + shift[i].x, z: p.pos.z + shift[i].z } }));
}

/** Rekan setim terdekat yang lebih maju ke arah gawang lawan. */
function passTarget(kicker, players) {
  const dir = goalDir(kicker.team);
  return players
    .filter((q) => q.team === kicker.team && q.id !== kicker.id && (q.pos.z - kicker.pos.z) * dir > 0)
    .reduce((best, q) => (!best || dist2D(q.pos, kicker.pos) < dist2D(best.pos, kicker.pos) ? q : best), null);
}

/** Tentukan arah & kecepatan tendangan: tembak bila dekat gawang, selain itu oper. */
function kickVector(kicker, players, ball) {
  const goal = goalCenter(kicker.team);
  const mate = dist2D(ball.pos, goal) < FOOTBALL.shootRange ? null : passTarget(kicker, players);
  const aim = mate ? mate.pos : goal;
  return { dx: aim.x - ball.pos.x, dz: aim.z - ball.pos.z, speed: mate ? FOOTBALL.passSpeed : FOOTBALL.shootSpeed };
}

/** Status FSM untuk pemain i. */
function decideState(p, i, nearest, ball) {
  if (nearest[p.team].i !== i) return 'RETURN';
  if (p.kickTimer > 0) return 'KICK';
  return nearest[p.team].d < FOOTBALL.kickRange ? 'KICK' : 'CHASE';
}

/** Pemain pertama yang boleh menendang pada langkah ini (kickTimer habis & dekat bola). */
function findKicker(players, nearest, ball) {
  return players.find((p, i) => nearest[p.team].i === i && p.kickTimer <= 0 && nearest[p.team].d < FOOTBALL.kickRange);
}

/** Reset setelah gol: bola ke tengah, pemain ke home. */
function resetAfterGoal(match, players, scorer) {
  const reset = players.map((p) => ({
    ...p, pos: { ...p.home }, vel: { x: 0, z: 0 }, state: 'RETURN', kickTimer: 0, home: { ...p.home },
  }));
  return { players: reset, ball: createBall(), score: { ...match.score, [scorer]: match.score[scorer] + 1 } };
}

/** Salinan dangkal match dengan pos/vel baru (dipakai saat dt tidak valid). */
function copyMatch(match) {
  return {
    ...match,
    players: match.players.map((p) => ({ ...p, pos: { ...p.pos }, vel: { ...p.vel } })),
    ball: { pos: { ...match.ball.pos }, vel: { ...match.ball.vel } },
  };
}

/** Bola setelah tendangan (bila ada penendang). */
function applyKick(kicker, players, ball) {
  if (!kicker) return ball;
  const { dx, dz, speed } = kickVector(kicker, players, ball);
  return kickBall(ball, dx, dz, speed);
}

/** Satu langkah pertandingan. dt NaN/≤0 → salinan match. */
export function stepMatch(match, dt) {
  const h = num(dt);
  if (h <= 0) return copyMatch(match);
  const nearest = nearestByTeam(match.players, match.ball);
  const kicker = findKicker(match.players, nearest, match.ball);
  const moved = separate(match.players.map((p, i) => {
    const state = decideState(p, i, nearest, match.ball);
    const next = movePlayer(p, state, match.ball, h);
    return kicker && kicker.id === p.id ? { ...next, kickTimer: FOOTBALL.kickAnimTime } : next;
  }));
  const { ball, scorer } = stepBall(applyKick(kicker, match.players, match.ball), h);
  const t = match.t + h;
  if (scorer) return { ...match, ...resetAfterGoal(match, moved, scorer), t };
  return { ...match, players: moved, ball, score: { ...match.score }, t };
}
