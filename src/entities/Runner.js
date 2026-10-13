/**
 * Pelari di lintasan atletik (satu per lane) dan pejalan/pelari di jalan
 * lingkar luar (elips lokal, tidak memakai sim/ellipse).
 *
 * RunnerGroup memakai sim/runnerSim (createRunner/stepRunner) + sim/trackPath
 * (pointOnLane) sehingga state tetap murni & immutable; kelas ini hanya
 * menyalin state ke transform mesh.
 */
import * as THREE from 'three';
import { TRACK } from '../config/constants.js';
import { createRunner, stepRunner } from '../sim/runnerSim.js';
import { pointOnLane, laneLength } from '../sim/trackPath.js';
import { createHumanoid, animateRun, animateWalk } from './Humanoid.js';
import { randomRunnerOutfit, randomCasualOutfit } from './Humanoid.outfits.js';
import { makeRng, range, isFiniteXZ, yawFromDir, clamp } from './util.js';

const SPEED_MIN = 2.5;
const SPEED_MAX = 5.0;
const MAX_DT = 0.05;

/** Baca jarak & kecepatan dari state runner dengan toleransi nama field. */
function readRunner(r) {
  return {
    dist: r.dist ?? r.distance ?? r.s ?? 0,
    speed: r.speed ?? r.v ?? 0,
    lane: r.lane ?? 1,
  };
}

export class RunnerGroup {
  /** @type {THREE.Group} */
  group = new THREE.Group();
  #runners = [];   // { sim, h, speed }

  /**
   * @param {{count?:number, seed?:number, lanes?:number[]}} opts
   */
  constructor(opts = {}) {
    const { count = TRACK.laneCount, seed = 11, lanes } = opts;
    const rng = makeRng(seed);
    const laneList = lanes ?? Array.from({ length: count }, (_, i) => (i % TRACK.laneCount) + 1);
    this.group.name = 'runners';
    laneList.forEach((lane, i) => this.#spawn(lane, i, rng));
  }

  #spawn(lane, i, rng) {
    const speed = range(rng, SPEED_MIN, SPEED_MAX);
    const len = safeLaneLength(lane);
    const sim = createRunner({ id: `runner-${i}`, lane, speed, dist: rng() * len });
    const outfit = randomRunnerOutfit(rng, { forceHat: i === 2 || i === 6, forceHijab: i === 4 });
    const h = createHumanoid(outfit);
    h.group.name = `runner-${i}`;
    this.group.add(h.group);
    this.#runners.push({ sim, h, speed });
    this.#place(this.#runners[this.#runners.length - 1], 0);
  }

  /** Salin posisi/yaw dari path lane ke mesh. */
  #place(r, time) {
    const { dist, speed, lane } = readRunner(r.sim);
    const p = pointOnLane(lane, dist);
    if (!isFiniteXZ(p)) return;
    r.h.group.position.set(p.x, 0, p.z);
    r.h.group.rotation.y = p.yaw ?? 0;
    animateRun(r.h, time + r.speed, speed || r.speed);
  }

  /** @param {number} dt @param {{time:number}} ctx */
  update(dt, ctx = {}) {
    const step = clamp(dt, 0, MAX_DT);
    const time = ctx.time ?? 0;
    this.#runners = this.#runners.map((r) => ({ ...r, sim: stepRunner(r.sim, step) }));
    for (const r of this.#runners) this.#place(r, time);
  }

  get runners() { return this.#runners.map((r) => r.sim); }
}

function safeLaneLength(lane) {
  try {
    const l = laneLength(lane);
    return Number.isFinite(l) && l > 0 ? l : 400;
  } catch {
    return 400;
  }
}

/**
 * Pejalan/pelari di jalan lingkar luar: parametrisasi elips lokal
 * x = semiX cos θ, z = semiZ sin θ. Sebagian berjalan, sebagian berlari,
 * arah bergantian; offset lateral acak agar tidak berbaris.
 */
export class LoopWalkers {
  /** @type {THREE.Group} */
  group = new THREE.Group();
  #walkers = [];
  #semiX;
  #semiZ;
  #yOffset;

  /**
   * @param {{count?:number, semiX:number, semiZ:number, speedRange?:[number,number],
   *   yOffset?:number, seed?:number, lateralSpread?:number}} opts
   */
  constructor(opts) {
    const {
      count = 12, semiX, semiZ, speedRange = [1.2, 4.5], yOffset = 0, seed = 23, lateralSpread = 3,
    } = opts;
    this.#semiX = semiX;
    this.#semiZ = semiZ;
    this.#yOffset = yOffset;
    this.group.name = 'loop-walkers';
    const rng = makeRng(seed);
    for (let i = 0; i < count; i++) {
      const speed = range(rng, speedRange[0], speedRange[1]);
      const h = createHumanoid(speed > 2.2 ? randomRunnerOutfit(rng) : randomCasualOutfit(rng));
      this.group.add(h.group);
      this.#walkers.push({
        h, speed, dir: rng() < 0.6 ? 1 : -1, theta: rng() * Math.PI * 2,
        lateral: range(rng, -lateralSpread, lateralSpread), phase: rng() * 10,
      });
    }
    for (const w of this.#walkers) this.#place(w, 0);
  }

  /** Posisi pada elips dengan offset lateral (sepanjang normal keluar). */
  #place(w, time) {
    const a = this.#semiX, b = this.#semiZ;
    const c = Math.cos(w.theta), s = Math.sin(w.theta);
    const tx = -a * s * w.dir, tz = b * c * w.dir;        // tangent sesuai arah
    const nx = b * c, nz = a * s;                           // normal keluar (belum dinormalisasi)
    const nl = Math.hypot(nx, nz) || 1;
    w.h.group.position.set(a * c + (nx / nl) * w.lateral, this.#yOffset, b * s + (nz / nl) * w.lateral);
    w.h.group.rotation.y = yawFromDir(tx, tz);
    if (w.speed > 2.2) animateRun(w.h, time + w.phase, w.speed);
    else animateWalk(w.h, time + w.phase);
  }

  /** @param {number} dt @param {{time:number}} ctx */
  update(dt, ctx = {}) {
    const step = clamp(dt, 0, MAX_DT);
    const time = ctx.time ?? 0;
    const a = this.#semiX, b = this.#semiZ;
    this.#walkers = this.#walkers.map((w) => {
      // dθ = v·dt / |dP/dθ|, |dP/dθ| = sqrt((a sinθ)² + (b cosθ)²)
      const dsdθ = Math.hypot(a * Math.sin(w.theta), b * Math.cos(w.theta)) || 1;
      return { ...w, theta: w.theta + (w.dir * w.speed * step) / dsdθ };
    });
    for (const w of this.#walkers) this.#place(w, time);
  }
}
