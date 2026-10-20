/**
 * Aktivitas warga di plaza: barisan senam sinkron, badminton 2 orang,
 * 2 skater, dan pejalan kaki yang berkeliling. Semua Humanoid penuh
 * (bukan instanced), jumlah dibatasi oleh Crowd.js.
 */
import * as THREE from 'three';
import {
  createHumanoid, animateExercise, animateWalk, animateIdle, animateSkate, animateSwing,
} from './Humanoid.js';
import { randomCasualOutfit, randomRunnerOutfit } from './Humanoid.outfits.js';
import { NPC_MIX, outfitFromMix } from './npcTypes.js';
import { matFor, range, yawFromDir, lerpAngle, clamp, flatGround } from './util.js';

const EXERCISE = { rows: 3, cols: 4, spacing: 1.6 };
const BADMINTON = { gap: 6, flightTime: 1.1, peak: 2.6, swingTime: 0.45 };
const SKATE = { radius: 6, speed: 3.5 };
const WALK = { radius: 40, speedMin: 1.1, speedMax: 1.7, yawSmooth: 5 };

// ---------- Senam ----------

/** Barisan rows×cols menghadap instruktur. */
function createExerciseGroup(spot, rng) {
  const g = new THREE.Group();
  g.position.set(spot.x, 0, spot.z);
  g.rotation.y = spot.yaw ?? 0;
  const people = [];
  for (let r = 0; r < EXERCISE.rows; r++) {
    for (let c = 0; c < EXERCISE.cols; c++) {
      const h = createHumanoid(randomCasualOutfit(rng));
      h.group.position.set((c - (EXERCISE.cols - 1) / 2) * EXERCISE.spacing, 0, -r * EXERCISE.spacing);
      g.add(h.group);
      people.push({ h, offset: 0 });
    }
  }
  const instructor = createHumanoid({ ...randomRunnerOutfit(rng), hat: 0xd32f2f });
  instructor.group.position.set(0, 0, 2.2);
  instructor.group.rotation.y = Math.PI; // menghadap barisan
  g.add(instructor.group);
  people.push({ h: instructor, offset: 0.3 });
  const update = (time, ground) => {
    g.position.y = ground(spot.x, spot.z);
    people.forEach((p) => animateExercise(p.h, time, p.offset));
  };
  return { group: g, update };
}

// ---------- Badminton ----------

function createRacket() {
  const r = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), matFor(0x333333));
  handle.position.y = -0.1;
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 4, 14), matFor(0xeeeeee));
  head.position.y = -0.37;
  r.add(handle, head);
  return r;
}

/** Dua pemain berhadapan sepanjang sumbu Z lokal; kok terbang bolak-balik. */
function createBadminton(spot, rng) {
  const g = new THREE.Group();
  g.position.set(spot.x, 0, spot.z);
  g.rotation.y = spot.yaw ?? 0;
  const players = [-1, 1].map((side) => {
    const h = createHumanoid(randomRunnerOutfit(rng));
    h.group.position.set(0, 0, side * BADMINTON.gap / 2);
    h.group.rotation.y = side > 0 ? Math.PI : 0;
    h.parts.handR.add(createRacket());
    g.add(h.group);
    return { h, side, swing: 1 };
  });
  const shuttle = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 6), matFor(0xffffff));
  g.add(shuttle);
  const state = { t: 0, from: 0 };
  const update = (dt, time, ground) => {
    g.position.y = ground(spot.x, spot.z);
    state.t += dt;
    if (state.t >= BADMINTON.flightTime) { state.t -= BADMINTON.flightTime; state.from = 1 - state.from; players[state.from].swing = 0; }
    const u = state.t / BADMINTON.flightTime;
    const zA = players[state.from].side * BADMINTON.gap / 2, zB = -zA;
    shuttle.position.set(0.2 * Math.sin(time), 1.4 + BADMINTON.peak * 4 * u * (1 - u), zA + (zB - zA) * u);
    shuttle.rotation.x = (u < 0.5 ? -0.6 : 0.6) * players[state.from].side;
    players.forEach((p) => {
      p.swing = Math.min(1, p.swing + dt / BADMINTON.swingTime);
      if (p.swing < 1) animateSwing(p.h, p.swing, 'R');
      else animateIdle(p.h, time + p.side);
    });
  };
  return { group: g, update };
}

// ---------- Skater ----------

function createSkateboard() {
  const b = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.8), matFor(0x6d4c41));
  deck.position.y = 0.07;
  b.add(deck);
  const wheelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(wheelGeo, matFor(0xffc107));
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * 0.09, 0.03, sz * 0.28);
    b.add(w);
  }
  return b;
}

/** Skater berputar di lingkaran sekitar spot; papan diparent ke group skater. */
function createSkaters(spots, rng) {
  const g = new THREE.Group();
  const skaters = spots.map((spot, i) => {
    const h = createHumanoid({ ...randomRunnerOutfit(rng), hat: 0x111111 });
    h.group.add(createSkateboard());
    g.add(h.group);
    return { h, cx: spot.x, cz: spot.z, theta: rng() * Math.PI * 2, dir: i % 2 ? -1 : 1 };
  });
  const update = (dt, time, ground) => {
    for (const s of skaters) {
      s.theta += (s.dir * SKATE.speed * dt) / SKATE.radius;
      const c = Math.cos(s.theta), sn = Math.sin(s.theta);
      const x = s.cx + SKATE.radius * c;
      const z = s.cz + SKATE.radius * sn;
      s.h.group.position.set(x, ground(x, z) + 0.09, z);
      s.h.group.rotation.y = yawFromDir(-sn * s.dir, c * s.dir);
      animateSkate(s.h, time + s.theta);
    }
  };
  return { group: g, update };
}

// ---------- Pejalan kaki ----------

function randomTarget(center, rng) {
  const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * WALK.radius;
  return { x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r };
}

/** Pejalan berkeliling acak dalam radius plaza; berhenti sejenak di tujuan. */
function createWalkers(center, count, rng) {
  const g = new THREE.Group();
  const walkers = Array.from({ length: count }, () => {
    const h = createHumanoid(outfitFromMix(NPC_MIX.plaza, rng));
    const start = randomTarget(center, rng);
    h.group.position.set(start.x, 0, start.z);
    g.add(h.group);
    return { h, target: randomTarget(center, rng), speed: range(rng, WALK.speedMin, WALK.speedMax), pause: 0, yaw: 0, phase: rng() * 10 };
  });
  const update = (dt, time, ground) => {
    for (const w of walkers) stepWalker(w, dt, time, center, rng, ground);
  };
  return { group: g, update };
}

function stepWalker(w, dt, time, center, rng, ground) {
  const p = w.h.group.position;
  p.y = ground(p.x, p.z);
  if (w.pause > 0) {
    w.pause -= dt;
    animateIdle(w.h, time + w.phase);
    return;
  }
  const dx = w.target.x - p.x, dz = w.target.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.3) {
    w.target = randomTarget(center, rng);
    w.pause = range(rng, 1, 5);
    return;
  }
  const stepLen = Math.min(d, w.speed * dt);
  p.x += (dx / d) * stepLen;
  p.z += (dz / d) * stepLen;
  w.yaw = lerpAngle(w.yaw, yawFromDir(dx, dz), Math.min(1, WALK.yawSmooth * dt));
  w.h.group.rotation.y = w.yaw;
  animateWalk(w.h, time * (w.speed / 1.4) + w.phase);
}

// ---------- Gabungan ----------

/**
 * @param {{center:{x:number,z:number}, spots?:{exercise?:object, badminton?:object,
 *   skaters?:object[]}, count?:number, rng:() => number}} opts
 * @returns {{group:THREE.Group, update:(dt:number, time:number, ground?:(x:number, z:number) => number) => void, humanoidCount:number}}
 */
export function createPlazaActivities({ center, spots = {}, count = 30, rng }) {
  const group = new THREE.Group();
  group.name = 'plaza-activities';
  const ex = spots.exercise ?? { x: center.x - 12, z: center.z, yaw: 0 };
  const bd = spots.badminton ?? { x: center.x + 14, z: center.z + 4, yaw: 0.3 };
  const sk = spots.skaters ?? [{ x: center.x, z: center.z - 20 }, { x: center.x + 25, z: center.z - 12 }];
  const fixed = EXERCISE.rows * EXERCISE.cols + 1 + 2 + sk.length;
  const walkerCount = clamp(count - fixed, 0, 40);
  const acts = [
    createExerciseGroup(ex, rng), createBadminton(bd, rng), createSkaters(sk, rng),
    createWalkers(center, walkerCount, rng),
  ];
  acts.forEach((a) => group.add(a.group));
  const update = (dt, time, ground = flatGround) => {
    acts[0].update(time, ground);
    acts[1].update(dt, time, ground);
    acts[2].update(dt, time, ground);
    acts[3].update(dt, time, ground);
  };
  return { group, update, humanoidCount: fixed + walkerCount };
}
