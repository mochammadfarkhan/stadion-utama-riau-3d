/**
 * Kerumunan: (a) penonton tribun sebagai InstancedMesh (torso kapsul + kepala)
 * pada posisi kursi `seatSamples` {x,y,z,yaw}; (b) warga plaza (Humanoid penuh)
 * lewat Crowd.plaza.js. Goyangan penonton diperbarui bergilir per irisan
 * instance agar budget CPU rendah.
 */
import * as THREE from 'three';
import { createPlazaActivities } from './Crowd.plaza.js';
import { SKIN_TONES, SHIRT_COLORS } from './Humanoid.outfits.js';
import { makeRng, pick, clamp, groundOf } from './util.js';
import { CROWD_FAR } from '../config/lowpoly.js';

const SEATED = Object.freeze({
  torsoR: 0.17, torsoH: 0.3, torsoY: 0.42,   // pusat torso relatif permukaan kursi
  headR: 0.115, headY: 0.82,
  animatedRatio: 0.35,                        // porsi penonton yang bergoyang
  swayAmp: 0.035, swayFreq: 1.7,
});
const SLICES = 8;        // instance dibagi 8 irisan; satu irisan diperbarui per frame
const MAX_DT = 0.05;

/** Penonton instanced di tribun. */
class Spectators {
  group = new THREE.Group();
  #torso;
  #head;
  #seats;
  #animated;       // Uint8Array flag per instance
  #slice = 0;
  #m = new THREE.Matrix4();
  #q = new THREE.Quaternion();
  #p = new THREE.Vector3();
  #s = new THREE.Vector3(1, 1, 1);

  constructor(seatSamples, rng) {
    const n = seatSamples.length;
    this.#seats = seatSamples;
    this.#animated = new Uint8Array(n);
    const torsoGeo = new THREE.CapsuleGeometry(SEATED.torsoR, SEATED.torsoH, 1, 5);
    const headGeo = new THREE.SphereGeometry(SEATED.headR, 5, 4);
    this.#torso = new THREE.InstancedMesh(torsoGeo, new THREE.MeshLambertMaterial(), n);
    this.#head = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial(), n);
    this.#torso.castShadow = this.#head.castShadow = false;
    this.#torso.frustumCulled = this.#head.frustumCulled = true;
    const color = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.#animated[i] = rng() < SEATED.animatedRatio ? 1 : 0;
      this.#torso.setColorAt(i, color.setHex(pick(rng, SHIRT_COLORS)));
      this.#head.setColorAt(i, color.setHex(pick(rng, SKIN_TONES)));
      this.#writeInstance(i, 0);
    }
    this.#torso.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.#head.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.#torso.instanceMatrix.needsUpdate = this.#head.instanceMatrix.needsUpdate = true;
    if (this.#torso.instanceColor) this.#torso.instanceColor.needsUpdate = true;
    if (this.#head.instanceColor) this.#head.instanceColor.needsUpdate = true;
    this.#torso.computeBoundingSphere();
    this.#head.computeBoundingSphere();
    this.group.add(this.#torso, this.#head);
    this.group.name = 'spectators';
  }

  /** Tulis matriks torso & kepala untuk instance i pada waktu t. */
  #writeInstance(i, t) {
    const s = this.#seats[i];
    const sway = this.#animated[i] ? Math.sin(t * SEATED.swayFreq + i * 0.7) : 0;
    const yaw = (s.yaw ?? 0) + sway * 0.15;
    const bob = Math.abs(sway) * SEATED.swayAmp;
    this.#q.setFromAxisAngle(this.#p.set(0, 1, 0), yaw);
    this.#p.set(s.x, (s.y ?? 0) + SEATED.torsoY + bob, s.z);
    this.#m.compose(this.#p, this.#q, this.#s);
    this.#torso.setMatrixAt(i, this.#m);
    this.#p.set(s.x, (s.y ?? 0) + SEATED.headY + bob, s.z);
    this.#m.compose(this.#p, this.#q, this.#s);
    this.#head.setMatrixAt(i, this.#m);
  }

  update(time) {
    const n = this.#seats.length;
    if (n === 0) return;
    const slice = this.#slice;
    this.#slice = (slice + 1) % SLICES;
    for (let i = slice; i < n; i += SLICES) if (this.#animated[i]) this.#writeInstance(i, time);
    this.#torso.instanceMatrix.needsUpdate = true;
    this.#head.instanceMatrix.needsUpdate = true;
  }

  get count() { return this.#seats.length; }

  /** Sembunyikan/tampilkan penonton (jauh dari stadion: ±500 ribu segitiga tak terlihat). */
  setHidden(hidden) { this.group.visible = !hidden; }
  get hidden() { return !this.group.visible; }

  /** Jumlah instance yang dirender proporsional density 0..1 (kursi diisi dari indeks awal). */
  setDensity(density) {
    const d = clamp(Number(density) || 0, 0, 1);
    const n = Math.round(this.#seats.length * d);
    this.#torso.count = n;
    this.#head.count = n;
  }
}

export class Crowd {
  /** @type {THREE.Group} */
  group = new THREE.Group();
  #spectators = null;
  #plaza = null;

  /**
   * @param {{seatSamples?:Array<{x:number,y:number,z:number,yaw:number}>,
   *   plazaCenter?:{x:number,z:number}, plazaSpots?:object, count?:number,
   *   seed?:number, tribuneSectors?:unknown}} opts
   *   `tribuneSectors` diterima untuk kompatibilitas; penempatan memakai seatSamples.
   */
  constructor(opts = {}) {
    const { seatSamples = [], plazaCenter = null, plazaSpots = {}, count = 30, seed = 41 } = opts;
    const rng = makeRng(seed);
    this.group.name = 'crowd';
    const seats = seatSamples.filter((s) => Number.isFinite(s?.x) && Number.isFinite(s?.z));
    if (seats.length > 0) {
      this.#spectators = new Spectators(seats, rng);
      this.group.add(this.#spectators.group);
    }
    if (plazaCenter) {
      this.#plaza = createPlazaActivities({ center: plazaCenter, spots: plazaSpots, count, rng });
      this.group.add(this.#plaza.group);
    }
  }

  /** @param {number} dt @param {{time:number}} ctx */
  update(dt, ctx = {}) {
    const step = clamp(dt, 0, MAX_DT);
    const time = ctx.time ?? 0;
    if (this.#spectators && ctx.focus) {
      const d = Math.hypot(ctx.focus.x, ctx.focus.z);
      if (Number.isFinite(d)) this.#spectators.setHidden(this.#spectators.hidden ? d > CROWD_FAR.showAt : d > CROWD_FAR.hideAt);
    }
    if (!this.#spectators?.hidden) this.#spectators?.update(time);
    this.#plaza?.update(step, time, groundOf(ctx));
  }

  /** Kepadatan penonton tribun 0..1 (settings graphics.crowdDensity). */
  setDensity(density) { this.#spectators?.setDensity(density); }

  get spectatorCount() { return this.#spectators?.count ?? 0; }
  get humanoidCount() { return this.#plaza?.humanoidCount ?? 0; }
}
