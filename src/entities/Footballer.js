/**
 * Pertandingan sepak bola NPC: 2 tim Humanoid + bola, digerakkan oleh
 * sim/footballAI (createMatch/stepMatch). Kelas ini hanya menyalin state ke
 * mesh dan memilih animasi (lari / diam / tendang).
 */
import * as THREE from 'three';
import { PITCH, FOOTBALL } from '../config/constants.js';
import { createMatch, stepMatch } from '../sim/footballAI.js';
import { createHumanoid, animateRun, animateIdle, animateKick } from './Humanoid.js';
import { footballKit } from './Humanoid.outfits.js';
import { createBallMesh, rollBall } from './Footballer.ball.js';
import { makeRng, isFiniteXZ, clamp } from './util.js';

const MOVE_EPS = 0.3;          // m/s; di bawah ini dianggap diam
const MAX_DT = 0.05;

/** Kiper = pemain dengan home paling dekat ke garis gawang timnya. */
function isKeeper(p) {
  return Math.abs(p.home.z) > PITCH.length / 2 - FOOTBALL.formationDepth - 1;
}

export class FootballMatch {
  /** @type {THREE.Group} */
  group = new THREE.Group();
  /** State pertandingan terakhir (immutable, dari stepMatch). */
  match;
  #players = new Map();   // id → {h, phase}
  #ball;
  #ballRadius = FOOTBALL.ballRadius;

  /** @param {{teamSize?:number, seed?:number}} opts */
  constructor(opts = {}) {
    const { teamSize = 5, seed = 5 } = opts;
    const rng = makeRng(seed);
    this.match = createMatch({ teamSize });
    this.group.name = 'football-match';
    for (const p of this.match.players) {
      const h = createHumanoid(footballKit(p.team, isKeeper(p), rng));
      h.group.name = `player-${p.id}`;
      this.group.add(h.group);
      this.#players.set(p.id, { h, phase: rng() * 10 });
    }
    this.#ball = createBallMesh(this.#ballRadius);
    this.group.add(this.#ball);
    this.#applyVisual(0, 0);
  }

  get score() { return this.match.score; }
  get ball() { return this.match.ball; }

  /** @param {number} dt @param {{time:number}} ctx */
  update(dt, ctx = {}) {
    const step = clamp(dt, 0, MAX_DT);
    const next = stepMatch(this.match, step);
    if (isFiniteXZ(next.ball?.pos)) this.match = next;
    this.#applyVisual(ctx.time ?? 0, step);
  }

  #applyVisual(time, dt) {
    for (const p of this.match.players) this.#applyPlayer(p, time);
    const b = this.match.ball;
    // sim: pos.y = pusat bola (= radius saat di tanah)
    this.#ball.position.set(b.pos.x, Number.isFinite(b.pos.y) ? b.pos.y : this.#ballRadius, b.pos.z);
    rollBall(this.#ball, b.vel, dt, this.#ballRadius);
  }

  /** Posisi, arah hadap, dan animasi satu pemain. */
  #applyPlayer(p, time) {
    const entry = this.#players.get(p.id);
    if (!entry || !isFiniteXZ(p.pos)) return;
    const { h, phase } = entry;
    h.group.position.set(p.pos.x, 0, p.pos.z);
    h.group.rotation.y = Number.isFinite(p.facing) ? p.facing : 0;
    const speed = Math.hypot(p.vel.x, p.vel.z);
    if (p.kickTimer > 0) {
      animateKick(h, 1 - p.kickTimer / FOOTBALL.kickAnimTime);
    } else if (speed > MOVE_EPS) {
      animateRun(h, time + phase, speed);
    } else {
      animateIdle(h, time + phase);
    }
  }
}
