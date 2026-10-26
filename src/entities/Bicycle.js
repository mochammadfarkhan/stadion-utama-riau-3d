/**
 * Kendaraan pemain: mesh prosedural sepeda + pengendara Humanoid + binding ke sim/bikePhysics. Punya MODE (tombol F):
 * 'sepeda' (bawaan), 'jalan' (sepeda disembunyikan, pemain berdiri & berjalan, sim/farm stepOnFoot), 'traktor'
 * (model GLB dari setTractorModel, sim sepeda dengan konfigurasi TRACTOR). State {x,z,yaw,v} sama untuk semua mode,
 * jadi kamera, cerita, collider, dan perjalanan cepat tetap membaca `ents.bike.state`. Saat jalan kaki, item hotbar
 * tampil di tangan kanan (setHeldItem) dan useItem(style) memutar animasi pakai (pemain diam selama animasi).
 *
 * Kontrol (ctx.input: core/Input.js): W/ArrowUp kayuh, S/ArrowDown rem/mundur,
 * A/ArrowLeft & D/ArrowRight belok, ShiftLeft/Right sprint, Space bel.
 *
 * Konvensi arah: yaw = rotation.y, maju = (sin yaw, 0, cos yaw) (model menghadap +Z).
 * steer > 0 = belok kiri (yaw bertambah). Sim memberi lean negatif saat belok kiri,
 * jadi lean dipakai langsung sebagai rotation.z rangka (condong ke dalam tikungan).
 * Terrain (M1): y grup = heightAt(x, z); pitch grup = −atan(grade) dihaluskan (urutan Euler YXZ:
 * yaw lalu pitch lokal); grade searah hadap masuk ke sim (stepBike opsi grade).
 */
import * as THREE from 'three';
import { BIKE } from '../config/constants.js';
import { createBikeState, stepBike } from '../sim/bikePhysics.js';
import { createHumanoid, animateCycling, animateWalk, animateIdle, animateUseItem, useItemTilt } from './Humanoid.js';
import { stepOnFoot } from '../sim/farm.js';
import { PLAYER_MODES, WALK, TRACTOR } from '../config/kebun.js';
import { BIKE_GEO, createBicycleMesh } from './Bicycle.mesh.js';
import { createBell } from './Bicycle.bell.js';
import { clamp } from './util.js';

const STEER_VISUAL_RAD = BIKE.steerMax ?? 0.6; // batas visual sudut setang (rad)
const RIDER_SEAT_LIFT = 0.03;    // pinggul sedikit di atas sadel
const COLLISION_DAMPING = 0.5;   // laju dikurangi saat collider menggeser posisi
const MAX_DT = 0.05;
const PITCH_SMOOTHING = 8;       // 1/s, pitch rangka mengikuti lereng
const USE_DURATION = Object.freeze({ cangkul: 0.65, gembor: 0.9, raih: 0.55 }); // detik animasi pakai item
const USE_HIT = Object.freeze({ cangkul: 0.62, gembor: 0.45, raih: 0.5 });        // fraksi durasi saat efek terjadi

/** Baca keyboard menjadi perintah sim {pedal, steer, sprint}. */
function readCommand(input) {
  if (!input) return { pedal: 0, steer: 0, sprint: false };
  const down = (c) => input.isDown(c);
  const pedal = (down('KeyW') || down('ArrowUp') ? 1 : 0) - (down('KeyS') || down('ArrowDown') ? 1 : 0);
  const steer = (down('KeyA') || down('ArrowLeft') ? 1 : 0) - (down('KeyD') || down('ArrowRight') ? 1 : 0);
  const sprint = down('ShiftLeft') || down('ShiftRight');
  return { pedal, steer, sprint };
}

function isStateFinite(s) {
  return Number.isFinite(s.x) && Number.isFinite(s.z) && Number.isFinite(s.yaw) && Number.isFinite(s.v);
}

export class Bicycle {
  /** @type {THREE.Group} */
  group;
  /** State fisika terakhir (immutable; objek baru tiap frame). */
  state;
  #parts;
  #rider;
  #riderGeo;
  #bell = createBell();
  #collider = null;
  #cfg;
  #posVec = new THREE.Vector3();
  #terrain = null;
  #groundY = 0;
  #pitch = 0;
  #mode = 'sepeda';
  #tractor = null; // {group, seat:THREE.Vector3, spin(angle)}
  #held = null; // {object, carry, work, shoulder} item di tangan kanan (hanya tampil saat jalan kaki)
  #use = null;  // {style, t, dur, onHit} animasi pakai item yang sedang berjalan; onHit dipanggil saat "kena"
  #walkPhase = 0; // detik-langkah (animateWalk: 1 siklus/detik pada ±1,4 m/s)
  #idleT = 0;

  /**
   * @param {{x?:number, z?:number, yaw?:number, frameColor?:number, withBasket?:boolean,
   *   rider?:object, cfg?:object}} opts
   */
  constructor(opts = {}) {
    const { x = 0, z = 0, yaw = 0, frameColor, withBasket = true, rider = {}, cfg = BIKE } = opts;
    this.#cfg = cfg;
    this.state = createBikeState({ x, z, yaw });
    const mesh = createBicycleMesh({ frameColor, withBasket });
    this.group = mesh.group;
    this.group.name = 'bicycle';
    this.group.rotation.order = 'YXZ'; // yaw dulu, lalu pitch lereng di sumbu X lokal
    this.#parts = mesh.parts;
    this.#rider = this.#mountRider(rider);
    this.#riderGeo = {
      crankR: BIKE_GEO.crankR,
      bbY: BIKE_GEO.bb.y - (BIKE_GEO.saddle.y + RIDER_SEAT_LIFT),
      bbZ: BIKE_GEO.bb.z - BIKE_GEO.saddle.z,
    };
    this.#applyVisual();
  }

  get mode() { return this.#mode; }

  /** Model traktor (GLB): {group, seat:Vector3 (titik duduk lokal), spin(angle)}. Dipasang tersembunyi. */
  setTractorModel(model) {
    if (this.#tractor) this.group.remove(this.#tractor.group);
    this.#tractor = model ?? null;
    if (model) this.group.add(model.group);
    this.#applyMode();
  }

  /** Ganti mode (berhenti dulu). Traktor hanya bila modelnya sudah dimuat. Kembalikan mode aktif. */
  setMode(mode) {
    if (!PLAYER_MODES.includes(mode) || (mode === 'traktor' && !this.#tractor)) return this.#mode;
    this.#mode = mode;
    this.state = { ...this.state, v: 0, steer: 0, lean: 0 };
    this.#applyMode();
    this.#applyVisual();
    return mode;
  }

  /** Mode berikutnya dalam urutan PLAYER_MODES (lewati traktor bila belum dimuat). */
  cycleMode() {
    const order = PLAYER_MODES.filter((m) => m !== 'traktor' || this.#tractor);
    return this.setMode(order[(order.indexOf(this.#mode) + 1) % order.length]);
  }

  /** Pasang item di tangan kanan (null = tangan kosong). Objek dipakai ulang; yang lama dilepas dari tangan. */
  setHeldItem(item) {
    if (this.#held?.object === item?.object) return;
    this.#held?.object.removeFromParent();
    this.#held = item ?? null;
    if (item) {
      this.#rider.parts.handR.add(item.object);
      item.object.rotation.set(item.carry, 0, 0);
      item.object.visible = this.#mode === 'jalan';
    }
  }

  /** Sedang memutar animasi pakai item (aksi berikutnya ditahan). */
  get busy() { return this.#use !== null; }

  /**
   * Putar animasi pakai item: 'cangkul' | 'gembor' | 'raih'. Hanya saat jalan kaki; pemain diam selama animasi.
   * onHit dipanggil sekali saat ayunan kena (USE_HIT), atau langsung bila animasi tidak bisa diputar / dibatalkan.
   */
  useItem(style, onHit = null) {
    if (this.#mode !== 'jalan' || this.#use) {
      onHit?.();
      return false;
    }
    this.#use = { style, t: 0, dur: USE_DURATION[style] ?? 0.5, onHit };
    this.state = { ...this.state, v: 0 };
    return true;
  }

  /** Jalankan efek aksi yang tertunda (sekali). */
  #fireHit() {
    const fn = this.#use?.onHit;
    if (this.#use) this.#use.onHit = null;
    fn?.();
  }

  /** Pindahkan pengendara ke sadel / tanah / kursi traktor sesuai mode; tampilkan mesh yang sesuai. */
  #applyMode() {
    const r = this.#rider;
    if (!r) return;
    const hip = r.parts.body.userData.baseY;
    this.#parts.frame.visible = this.#mode === 'sepeda';
    if (this.#held) this.#held.object.visible = this.#mode === 'jalan';
    if (this.#mode !== 'jalan' && this.#use) { // ganti kendaraan di tengah ayunan: efek tetap terjadi
      this.#fireHit();
      this.#use = null;
    }
    if (this.#tractor) this.#tractor.group.visible = this.#mode === 'traktor';
    if (this.#mode === 'sepeda') {
      this.#parts.saddleMount.add(r.group);
      r.group.position.set(0, RIDER_SEAT_LIFT - hip, 0);
    } else if (this.#mode === 'traktor') {
      this.#tractor.group.add(r.group);
      r.group.position.set(this.#tractor.seat.x, this.#tractor.seat.y + RIDER_SEAT_LIFT - hip, this.#tractor.seat.z);
    } else {
      this.group.add(r.group);
      r.group.position.set(0, 0, 0);
    }
  }

  /** Pasang Humanoid di sadel (pinggul tepat di atas sadel). */
  #mountRider(riderOpts) {
    const rider = createHumanoid({
      skin: 0xc68642, shirt: 0x1abc9c, pants: 0x2b2b44, hair: 0x1a1210,
      height: 1.7, hat: 0xffffff, ...riderOpts,
    });
    rider.group.position.set(0, RIDER_SEAT_LIFT - rider.parts.body.userData.baseY, 0); // tinggi pinggul per avatar
    this.#parts.saddleMount.add(rider.group);
    return rider;
  }

  /**
   * Pasang fungsi collider `(x, z) → {x, z}` yang mengembalikan posisi valid.
   * Dipanggil setelah tiap langkah fisika.
   */
  setCollider(fn) { this.#collider = typeof fn === 'function' ? fn : null; }

  /**
   * Pasang layanan terrain ({heightAt, gradeAlong}); null = datar. Tinggi tanah langsung diperbarui
   * (teleport/perjalanan cepat tidak menunggu frame berikutnya).
   */
  setTerrain(terrain) {
    this.#terrain = terrain && typeof terrain.heightAt === 'function' ? terrain : null;
    this.#groundY = this.#terrain ? this.#terrain.heightAt(this.state.x, this.state.z) : 0;
    this.#applyVisual();
  }

  /** Tinggi tanah di bawah sepeda (m). */
  get groundY() { return this.#groundY; }

  /** Tampilkan/sembunyikan pengendara (disembunyikan di kamera orang pertama: kamera berada di kepalanya). */
  setRiderVisible(visible) { this.#rider.group.visible = Boolean(visible); }

  /** Bunyikan bel (Space). */
  ring() {
    this.onRing?.();
    return this.#bell.ring();
  }

  /** Arahkan bel ke AudioBus bersama (kanal 'bell'); null = konteks sendiri. */
  setAudioBus(bus) { this.#bell.setAudioBus(bus); }

  get position() { return this.#posVec.set(this.state.x, this.#groundY, this.state.z); }
  get yaw() { return this.state.yaw; }
  get speedKmh() { return Math.abs(this.state.v) * 3.6; }

  /**
   * @param {number} dt detik
   * @param {{bikePos?:THREE.Vector3, time:number, input?:import('../core/Input.js').Input}} ctx
   */
  update(dt, ctx = {}) {
    const step = clamp(dt, 0, MAX_DT);
    const cmd = this.#use ? { pedal: 0, steer: 0, sprint: false } : readCommand(ctx.input); // diam saat pakai item
    if (ctx.input?.consumePress?.('Space')) this.ring();
    const t = this.#terrain;
    const grade = t ? t.gradeAlong(this.state.x, this.state.z, this.state.yaw) : 0;
    const next = this.#mode === 'jalan'
      ? stepOnFoot(this.state, cmd, step, WALK)
      : stepBike(this.state, cmd, step, { grade, cfg: this.#mode === 'traktor' ? TRACTOR : this.#cfg });
    this.state = isStateFinite(next) ? this.#resolveCollision(next) : this.state;
    this.#updateGround(step);
    this.#walkPhase += step * (this.state.v ?? 0) / 1.4;
    this.#idleT += step;
    if (this.#use) {
      const u = this.#use;
      u.t += step;
      if (u.t >= u.dur * (USE_HIT[u.style] ?? 0.5)) this.#fireHit();
      if (u.t >= u.dur) this.#use = null;
    }
    this.#applyVisual();
  }

  /** Terapkan collider eksternal; bila posisi digeser, redam laju. */
  #resolveCollision(s) {
    if (!this.#collider) return s;
    const c = this.#collider(s.x, s.z);
    if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.z)) return s;
    if (c.x === s.x && c.z === s.z) return s;
    return { ...s, x: c.x, z: c.z, v: s.v * COLLISION_DAMPING };
  }

  /** Tinggi tanah & pitch rangka (−atan(grade), dihaluskan) dari terrain di posisi baru. */
  #updateGround(dt) {
    const t = this.#terrain;
    if (!t) return;
    const s = this.state;
    this.#groundY = t.heightAt(s.x, s.z);
    const target = this.#mode === 'jalan' ? 0 : -Math.atan(t.gradeAlong(s.x, s.z, s.yaw)); // pejalan tetap tegak
    this.#pitch += (target - this.#pitch) * Math.min(1, PITCH_SMOOTHING * dt);
  }

  /** Salin state ke transform mesh & pose pengendara. */
  #applyVisual() {
    const s = this.state;
    const p = this.#parts;
    this.group.position.set(s.x, this.#groundY, s.z);
    this.group.rotation.y = s.yaw;
    this.group.rotation.x = this.#pitch;
    if (this.#mode !== 'sepeda') return this.#applyOtherMode(s);
    p.frame.rotation.z = s.lean ?? 0;           // sim: lean negatif saat belok kiri (+X)
    p.steer.rotation.y = clamp(s.steer ?? 0, -STEER_VISUAL_RAD, STEER_VISUAL_RAD); // steer sudah radian
    p.wheelF.rotation.x = s.wheelSpin ?? 0;
    p.wheelR.rotation.x = s.wheelSpin ?? 0;
    p.crankL.rotation.x = s.pedalAngle ?? 0;
    p.crankR.rotation.x = (s.pedalAngle ?? 0) + Math.PI;
    animateCycling(this.#rider, s.pedalAngle ?? 0, this.#riderGeo);
  }

  /** Pose jalan/diam atau duduk di traktor + putaran roda traktor. */
  #applyOtherMode(s) {
    if (this.#mode === 'traktor') {
      this.#tractor?.spin(s.wheelSpin ?? 0);
      animateCycling(this.#rider, 0, this.#riderGeo);
      return;
    }
    const use = this.#use;
    if (use) animateUseItem(this.#rider, use.t / use.dur, use.style);
    else if (Math.abs(s.v ?? 0) < 0.15) animateIdle(this.#rider, this.#idleT);
    else animateWalk(this.#rider, this.#walkPhase);
    const held = this.#held;
    if (!held) return;
    if (held.shoulder && !use) { // dipanggul: lengan kanan ditekuk ke pundak, menimpa ayunan lengan jalan/diam
      this.#rider.parts.shoulderR.rotation.set(-0.25, 0, -0.12);
      this.#rider.parts.elbowR.rotation.x = -1.9;
    }
    const ph = use ? use.t / use.dur : 0;
    const k = !use ? 0 : ph < 0.15 ? ph / 0.15 : ph > 0.85 ? (1 - ph) / 0.15 : 1; // bawa → posisi kerja → bawa
    held.object.rotation.x = held.carry + (held.work - held.carry) * k + (use ? useItemTilt(ph, use.style) : 0);
  }

  dispose() { this.#bell.dispose(); }
}
