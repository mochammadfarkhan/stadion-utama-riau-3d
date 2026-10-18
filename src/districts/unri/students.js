/**
 * Mahasiswa NPC kampus (spec UNRI §8.4, katalog C01/C02): kolam humanoid tetap (STUDENT_POOL, dibuat bertahap
 * lewat scheduler) yang dibagikan ke sel 250 m di sekitar fokus. Mahasiswa berjalan bolak-balik di jalur ground
 * (trotoar/selasar `walks` + bahu jalan kampus) atau duduk di bangku diskusi (P04 semen) dengan pose M5
 * `sitChairTyping` (main HP/laptop) / `drinkCup`. Kepadatan mengikuti jam game (studentDensity). Humanoid dari kit
 * `npc` yang disuntik (D1). Kolam tidak pernah dilepas selama distrik hidup → memori GPU stabil (E2E §9.1).
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { createBenches } from '../../world/props/Bench.js';
import {
  pathsFromGround, bucketPaths, cellCenter, studentDensity, targetCount, allocateStudents, createWalker,
  stepWalker, walkerPose, benchSpotsFromPaths, seatsOf, sitterCount, mulberry32, hashString,
} from '../../sim/campusLife.js';

/** Budget: jumlah humanoid mahasiswa maksimum (mitigasi §9.3 langkah 2 boleh menurunkannya). */
export const STUDENT_POOL = 40;
export const ACTIVE_RADIUS = 300;
export const RELEASE_RADIUS = 420;
/** Jarak bangku di bahu jalan kampus (m); trotoar/selasar `walk` memakai BENCH_SPACING. */
export const SHOULDER_BENCH_SPACING = 150;
const THINK_SEC = 0.5;
const SIT_POSES = Object.freeze(['sitChairTyping', 'drinkCup']);

/**
 * @param {{npc:object, terrain:{heightAt(x:number,z:number):number}, scheduler:{schedule:Function}, scope:object,
 *   hour:() => number, camera:{position:object}, groundScale?:number, seed?:number}} opts
 */
export function createStudents({ npc, terrain, scheduler, scope, hour, camera, groundScale = 1, seed = 0x5a1d }) {
  const group = new THREE.Group();
  group.name = 'mahasiswa';
  const lod = npc.createLod();
  const pool = [];             // { h, used }
  const chunks = new Map();    // chunkKey -> { cells: Map(cellKey -> {paths, spots}), benches: Group }
  const active = new Map();    // cellKey -> { seats, members }
  const stepRng = mulberry32(seed ^ 0x51ed);
  let think = 0;
  let clock = 0;

  const poolTask = scheduler.schedule(function* buildPool() {
    for (let i = 0; i < STUDENT_POOL; i += 1) {
      const h = withScope(scope, () => npc.createStudent(seed + i * 7919));
      h.group.name = `mahasiswa-${i}`;
      h.group.visible = false;
      group.add(h.group);
      lod.addFrom(h.group);
      pool.push({ h, used: false });
      yield;
    }
  }, { owner: 'unri:mahasiswa' });

  const cellData = (key) => {
    const paths = [];
    const spots = [];
    for (const c of chunks.values()) {
      const d = c.cells.get(key);
      if (d) { paths.push(...d.paths); spots.push(...d.spots); }
    }
    return { paths, spots };
  };

  const free = (m) => {
    if (m.seatIndex != null) npc.clearPose?.(m.slot.h); // pose duduk memutar badan/pinggul: kembalikan ke netral sebelum dipakai jalan
    m.slot.used = false;
    m.slot.h.group.visible = false;
  };

  const release = (key) => {
    const cell = active.get(key);
    if (!cell) return;
    cell.members.forEach(free);
    active.delete(key);
  };

  function seatMember(slot, cell, index, rng) {
    const s = cell.seats[index];
    slot.h.group.position.set(s.x, terrain.heightAt(s.x, s.z), s.z);
    slot.h.group.rotation.y = s.yaw;
    return { slot, seatIndex: index, pose: SIT_POSES[rng() < 0.5 ? 0 : 1], phase: rng() * 10 };
  }

  function walkMember(slot, paths, rng) {
    const path = paths[Math.floor(rng() * paths.length) % paths.length];
    return { slot, seatIndex: null, path, w: createWalker(path, rng) };
  }

  function resize(key, n) {
    const { paths, spots } = cellData(key);
    if (!paths.length) { release(key); return; }
    const cell = active.get(key) ?? { seats: seatsOf(spots), members: [] };
    while (cell.members.length > n) free(cell.members.pop());
    const rng = mulberry32(hashString(key) ^ Math.imul(cell.members.length + 1, 2654435761));
    const sitTarget = sitterCount(n, cell.seats.length);
    while (cell.members.length < n) {
      const slot = pool.find((p) => !p.used);
      if (!slot) break;
      slot.used = true;
      const taken = new Set(cell.members.filter((m) => m.seatIndex != null).map((m) => m.seatIndex));
      const freeSeat = cell.seats.findIndex((_, i) => !taken.has(i));
      const member = taken.size < sitTarget && freeSeat >= 0 ? seatMember(slot, cell, freeSeat, rng) : walkMember(slot, paths, rng);
      slot.h.group.visible = true;
      cell.members.push(member);
    }
    if (cell.members.length) active.set(key, cell);
    else active.delete(key);
  }

  function rethink(focus) {
    const density = studentDensity(hour());
    const keys = new Set();
    for (const c of chunks.values()) for (const k of c.cells.keys()) keys.add(k);
    for (const key of [...active.keys()]) {
      const c = cellCenter(key);
      if (!keys.has(key) || Math.hypot(c.x - focus.x, c.z - focus.z) > RELEASE_RADIUS) release(key);
    }
    const requests = [];
    for (const key of keys) {
      const c = cellCenter(key);
      const dist = Math.hypot(c.x - focus.x, c.z - focus.z);
      if (dist > ACTIVE_RADIUS && !active.has(key)) continue;
      const length = cellData(key).paths.reduce((s, p) => s + p.length, 0);
      requests.push({ key, dist, want: targetCount(length, density) });
    }
    const plan = [...allocateStudents(requests, pool.length)];
    const current = (key) => active.get(key)?.members.length ?? 0;
    // Kecilkan dulu agar anggota yang dilepas bisa dipakai sel yang tumbuh.
    for (const [key, n] of plan.filter(([k, v]) => current(k) > v)) resize(key, n);
    for (const [key, n] of plan.filter(([k, v]) => current(k) <= v)) resize(key, n);
  }

  function animate(dt) {
    for (const cell of active.values()) {
      for (const m of cell.members) {
        const h = m.slot.h;
        if (m.seatIndex != null) {
          npc.pose(h, m.pose, clock + m.phase);
          continue;
        }
        m.w = stepWalker(m.w, m.path, dt, stepRng);
        const p = walkerPose(m.w, m.path);
        h.group.position.set(p.x, terrain.heightAt(p.x, p.z), p.z);
        h.group.rotation.y = p.yaw;
        if (m.w.pause > 0) npc.idle(h, clock + m.w.phase);
        else npc.walk(h, clock * (m.w.speed / 1.35) + m.w.phase);
      }
    }
  }

  return {
    group,
    get stats() {
      let members = 0;
      let sitting = 0;
      for (const c of active.values()) {
        members += c.members.length;
        sitting += c.members.filter((m) => m.seatIndex != null).length;
      }
      return { pool: pool.length, active: members, sitting, cells: active.size, chunks: chunks.size };
    },
    /** Posisi dunia mahasiswa aktif (dev/E2E): [{ x, z, sitting }]. */
    get positions() {
      const out = [];
      for (const c of active.values()) {
        for (const m of c.members) out.push({ x: m.slot.h.group.position.x, z: m.slot.h.group.position.z, sitting: m.seatIndex != null });
      }
      return out;
    },
    /** Data ground chunk M2 tersedia (dipanggil life.js di dalam scope distrik). */
    addGroundChunk(key, data) {
      if (chunks.has(key)) this.removeGroundChunk(key);
      const buckets = bucketPaths(pathsFromGround(data, { scale: groundScale }));
      const cells = new Map([...buckets].map(([cellKey, paths]) => [cellKey, { paths, spots: benchSpotsFromPaths(paths, { shoulderSpacing: SHOULDER_BENCH_SPACING }) }]));
      const spots = [...cells.values()].flatMap((c) => c.spots);
      const benches = createBenches(spots.map((s) => ({ x: s.x, z: s.z, y: terrain.heightAt(s.x, s.z), rotY: s.rotY, type: 'semen' })));
      benches.name = `bangkuDiskusi:${key}`;
      group.add(benches);
      chunks.set(key, { cells, benches });
    },
    removeGroundChunk(key) {
      const c = chunks.get(key);
      if (!c) return;
      for (const cellKey of c.cells.keys()) release(cellKey);
      c.benches.removeFromParent();
      c.benches.traverse((o) => {
        if (!o.isInstancedMesh) return;
        o.geometry.dispose(); // geometri gabungan unik per createBenches; material milik scope
        o.dispose();
      });
      chunks.delete(key);
    },
    /** @param {number} dt @param {{x:number, z:number}|null} focus titik dunia */
    update(dt, focus) {
      clock += dt;
      think -= dt;
      if (focus && think <= 0) {
        think = THINK_SEC;
        rethink(focus);
      }
      animate(dt);
      lod.update(camera.position);
    },
    dispose() {
      poolTask.cancel();
      for (const key of [...chunks.keys()]) this.removeGroundChunk(key);
      pool.forEach((p) => npc.dispose(p.h));
      group.removeFromParent();
      group.clear();
    },
  };
}
