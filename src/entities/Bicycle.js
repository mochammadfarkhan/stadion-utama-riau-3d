/**
 * Sepeda pemain: mesh prosedural + pengendara Humanoid + binding ke sim/bikePhysics.
 *
 * Kontrol (ctx.input: core/Input.js): W/ArrowUp kayuh, S/ArrowDown rem/mundur,
 * A/ArrowLeft & D/ArrowRight belok, ShiftLeft/Right sprint, Space bel.
 *
 * Konvensi arah: yaw = rotation.y, maju = (sin yaw, 0, cos yaw) (model menghadap +Z).
 * steer > 0 = belok kiri (yaw bertambah). Sim memberi lean negatif saat belok kiri,
 * jadi lean dipakai langsung sebagai rotation.z rangka (condong ke dalam tikungan).
 */
import * as THREE from 'three';
import { BIKE } from '../config/constants.js';
import { createBikeState, stepBike } from '../sim/bikePhysics.js';
import { createHumanoid, animateCycling, DIM } from './Humanoid.js';
import { BIKE_GEO, createBicycleMesh } from './Bicycle.mesh.js';
import { createBell } from './Bicycle.bell.js';
import { clamp } from './util.js';

const STEER_VISUAL_RAD = BIKE.steerMax ?? 0.6; // batas visual sudut setang (rad)
const RIDER_SEAT_LIFT = 0.03;    // pinggul sedikit di atas sadel
const COLLISION_DAMPING = 0.5;   // laju dikurangi saat collider menggeser posisi
const MAX_DT = 0.05;

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
    this.#parts = mesh.parts;
    this.#rider = this.#mountRider(rider);
    this.#riderGeo = {
      crankR: BIKE_GEO.crankR,
      bbY: BIKE_GEO.bb.y - (BIKE_GEO.saddle.y + RIDER_SEAT_LIFT),
      bbZ: BIKE_GEO.bb.z - BIKE_GEO.saddle.z,
    };
    this.#applyVisual();
  }

  /** Pasang Humanoid di sadel (pinggul tepat di atas sadel). */
  #mountRider(riderOpts) {
    const rider = createHumanoid({
      skin: 0xc68642, shirt: 0x1abc9c, pants: 0x2b2b44, hair: 0x1a1210,
      height: 1.7, hat: 0xffffff, ...riderOpts,
    });
    rider.group.position.set(0, RIDER_SEAT_LIFT - DIM.hipY, 0);
    this.#parts.saddleMount.add(rider.group);
    return rider;
  }

  /**
   * Pasang fungsi collider `(x, z) → {x, z}` yang mengembalikan posisi valid.
   * Dipanggil setelah tiap langkah fisika.
   */
  setCollider(fn) { this.#collider = typeof fn === 'function' ? fn : null; }

  /** Bunyikan bel (Space). */
  ring() { return this.#bell.ring(); }

  /** Arahkan bel ke AudioBus bersama (kanal 'bell'); null = konteks sendiri. */
  setAudioBus(bus) { this.#bell.setAudioBus(bus); }

  get position() { return this.#posVec.set(this.state.x, 0, this.state.z); }
  get yaw() { return this.state.yaw; }
  get speedKmh() { return Math.abs(this.state.v) * 3.6; }

  /**
   * @param {number} dt detik
   * @param {{bikePos?:THREE.Vector3, time:number, input?:import('../core/Input.js').Input}} ctx
   */
  update(dt, ctx = {}) {
    const step = clamp(dt, 0, MAX_DT);
    const cmd = readCommand(ctx.input);
    if (ctx.input?.consumePress?.('Space')) this.ring();
    const next = stepBike(this.state, cmd, step, this.#cfg);
    this.state = isStateFinite(next) ? this.#resolveCollision(next) : this.state;
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

  /** Salin state ke transform mesh & pose pengendara. */
  #applyVisual() {
    const s = this.state;
    const p = this.#parts;
    this.group.position.set(s.x, 0, s.z);
    this.group.rotation.y = s.yaw;
    p.frame.rotation.z = s.lean ?? 0;           // sim: lean negatif saat belok kiri (+X)
    p.steer.rotation.y = clamp(s.steer ?? 0, -STEER_VISUAL_RAD, STEER_VISUAL_RAD); // steer sudah radian
    p.wheelF.rotation.x = s.wheelSpin ?? 0;
    p.wheelR.rotation.x = s.wheelSpin ?? 0;
    p.crankL.rotation.x = s.pedalAngle ?? 0;
    p.crankR.rotation.x = (s.pedalAngle ?? 0) + Math.PI;
    animateCycling(this.#rider, s.pedalAngle ?? 0, this.#riderGeo);
  }

  dispose() { this.#bell.dispose(); }
}
