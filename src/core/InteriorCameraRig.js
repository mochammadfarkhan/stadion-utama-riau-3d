/**
 * Kamera interior (spec §8.2): orang pertama default (mata 1,55 m), V → orang ketiga (lengan 1,6 m) dengan uji
 * langit-langit (offset diskalakan agar kamera tetap di bawah plafon − margin) dan uji dinding (pullInOffset
 * terhadap isCameraClear). Mode foto: kamera bebas (W/A/S/D maju-geser mengikuti arah pandang, Q/E turun-naik,
 * Shift cepat) dibatasi kotak `bounds`, preset {position, target, fov}. Intip: kamera ke pose tertentu (jendela)
 * selama beberapa detik lalu kembali. Mouse (pointer lock pada `dom`), stick kanan gamepad, dan geser sentuh
 * memanggil lookBy (dirutekan composition root). Konvensi yaw = CameraRig/sepeda.
 */
import * as THREE from 'three';
import { firstPersonDirection, pullInOffset, thirdPersonOffset, wrapAngle } from './cameraMath.js';

const MOUSE_SENSITIVITY = 0.0022;
const PITCH_LIMIT = Math.PI / 2.3;

export const INTERIOR_CAM = Object.freeze({
  eye: 1.55, eyeForward: 0.1, lookHeight: 1.45, ceilingMargin: 0.12, minHeight: 0.3, minScale: 0.15,
  followSmoothing: 10, photoSpeed: 1.2, photoRunSpeed: 3, peekBlend: 4,
});
/** Orbit orang ketiga di ruang sempit (format THIRD di cameraMath). */
export const INTERIOR_THIRD = Object.freeze({
  radius: 1.6, lookHeight: INTERIOR_CAM.lookHeight, minHeight: INTERIOR_CAM.minHeight,
  baseElevation: 0.25, minElevation: -0.6, maxElevation: 1.15,
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Skala seragam offset kamera agar `target.y + offset.y ≤ ceilingY − margin`. Offset yang tidak naik melewati
 * batas dikembalikan apa adanya (scale 1). Murni.
 */
export function fitUnderCeiling(target, offset, ceilingY, margin = INTERIOR_CAM.ceilingMargin) {
  const limit = ceilingY - margin - target.y;
  if (!(offset.y > limit)) return { x: offset.x, y: offset.y, z: offset.z, scale: 1 };
  const s = limit <= 0 ? 0 : limit / offset.y;
  return { x: offset.x * s, y: offset.y * s, z: offset.z * s, scale: s };
}

export class InteriorCameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera kamera interior
   * @param {HTMLElement|null} dom elemen pointer lock (kanvas renderer)
   * @param {{ceiling?:number, isCameraClear?:((x:number,z:number)=>boolean)|null,
   *   bounds?:{min:number[],max:number[]}|null, baseFov?:number, sensitivity?:number}} [opts]
   */
  constructor(camera, dom, { ceiling = 3.2, isCameraClear = null, bounds = null, baseFov = camera.fov, sensitivity = 1 } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.ceiling = ceiling;
    this.isCameraClear = typeof isCameraClear === 'function' ? isCameraClear : null;
    this.bounds = bounds ?? { min: [-Infinity, 0.2, -Infinity], max: [Infinity, ceiling - 0.15, Infinity] };
    this.baseFov = baseFov;
    this.sensitivity = sensitivity;
    this.mode = 'first';
    this.yaw = 0;
    this.pitch = 0;
    this.photo = false;
    this.peekState = null;
    this._snap = true;
    this._target = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._photoPos = new THREE.Vector3();
    this._peekLook = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._abort = new AbortController();
    if (dom && typeof document !== 'undefined') {
      document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === dom) this.lookBy(e.movementX, e.movementY);
      }, { signal: this._abort.signal });
    }
  }

  /** Geser arah pandang (satuan piksel mouse); `scale` > 1 untuk sentuh. */
  lookBy(dx, dy, scale = 1) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const k = MOUSE_SENSITIVITY * this.sensitivity * scale;
    this.yaw = wrapAngle(this.yaw - dx * k);
    this.pitch = clamp(this.pitch + dy * k, -PITCH_LIMIT, PITCH_LIMIT);
  }

  toggleMode() {
    this.mode = this.mode === 'first' ? 'third' : 'first';
    this._snap = true;
    return this.mode;
  }

  /** Orang pertama sedang dipakai (bukan foto/intip): avatar disembunyikan. */
  get firstPersonView() { return this.mode === 'first' && !this.photo && !this.peekState; }

  /** Sedang mengintip (input jalan diabaikan). */
  get busy() { return Boolean(this.peekState); }

  /** Arah pandang satuan dari yaw/pitch (dipakai pemilih barang interaktif). */
  viewDirection() { return firstPersonDirection(this.yaw, this.pitch); }

  #setFov(fov) {
    if (this.camera.fov === fov) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /** Masuk/keluar mode foto (kamera bebas mulai dari posisi kamera sekarang). */
  setPhoto(on) {
    const next = Boolean(on);
    if (next === this.photo) return;
    this.photo = next;
    this.peekState = null;
    if (next) {
      this._photoPos.copy(this.camera.position);
    } else {
      this.#setFov(this.baseFov);
      this._snap = true;
    }
  }

  /** @param {{position:number[], target:number[], fov?:number}} pose */
  applyPreset(pose) {
    const [px, py, pz] = pose.position;
    const [tx, ty, tz] = pose.target;
    this._photoPos.set(px, py, pz);
    this.#clampPhoto();
    const dx = tx - px;
    const dy = ty - py;
    const dz = tz - pz;
    const len = Math.hypot(dx, dy, dz) || 1;
    this.yaw = Math.atan2(dx, dz);
    this.pitch = clamp(-Math.asin(clamp(dy / len, -1, 1)), -PITCH_LIMIT, PITCH_LIMIT);
    if (Number.isFinite(pose.fov)) this.#setFov(pose.fov);
  }

  /** Kamera ke pose selama `seconds` detik (intip jendela), lalu kembali sendiri. */
  peek(pose, seconds = 4) {
    const d = firstPersonDirection(this.yaw, this.pitch);
    this._peekLook.copy(this.camera.position).add(this._tmp.set(d.x, d.y, d.z));
    this.peekState = { pose, remaining: Math.max(0.5, seconds) };
  }

  cancelPeek() {
    if (!this.peekState) return;
    this.peekState = null;
    this._snap = true;
    this.#setFov(this.baseFov);
  }

  /**
   * @param {{x:number, z:number}} walker posisi pemain
   * @param {number} dt
   * @param {{forward:number, strafe:number, up:number, run:boolean}|null} [move] gerak kamera bebas (mode foto)
   */
  update(walker, dt, move = null) {
    if (!walker || !Number.isFinite(walker.x) || !Number.isFinite(walker.z)) return;
    const d = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0;
    if (this.photo) this.#updatePhoto(d, move);
    else if (this.peekState) this.#updatePeek(d);
    else if (this.mode === 'first') this.#updateFirst(walker);
    else this.#updateThird(walker, d);
  }

  #updateFirst(w) {
    const cam = this.camera.position;
    cam.set(w.x + Math.sin(this.yaw) * INTERIOR_CAM.eyeForward, INTERIOR_CAM.eye, w.z + Math.cos(this.yaw) * INTERIOR_CAM.eyeForward);
    const dir = firstPersonDirection(this.yaw, this.pitch);
    this._target.set(cam.x + dir.x, cam.y + dir.y, cam.z + dir.z);
    this.camera.lookAt(this._target);
    this._snap = false;
  }

  #safeOffset(target, offset) {
    const under = fitUnderCeiling(target, offset, this.ceiling);
    return this.isCameraClear ? pullInOffset(target, under, this.isCameraClear, INTERIOR_CAM.minScale) : under;
  }

  #updateThird(w, dt) {
    const target = this._target.set(w.x, INTERIOR_THIRD.lookHeight, w.z);
    const off = this.#safeOffset(target, thirdPersonOffset(this.yaw, this.pitch, INTERIOR_THIRD));
    this._desired.set(target.x + off.x, Math.max(INTERIOR_CAM.minHeight, target.y + off.y), target.z + off.z);
    const cam = this.camera.position;
    if (this._snap) {
      cam.copy(this._desired);
      this._snap = false;
    } else {
      cam.lerp(this._desired, 1 - Math.exp(-INTERIOR_CAM.followSmoothing * dt));
    }
    // posisi hasil smoothing bisa menyilang sudut dinding/plafon: periksa ulang terhadap titik pandang
    const again = this.#safeOffset(target, { x: cam.x - target.x, y: cam.y - target.y, z: cam.z - target.z });
    cam.set(target.x + again.x, Math.max(INTERIOR_CAM.minHeight, target.y + again.y), target.z + again.z);
    this.camera.lookAt(target);
  }

  #clampPhoto() {
    const { min, max } = this.bounds;
    const p = this._photoPos;
    p.set(clamp(p.x, min[0], max[0]), clamp(p.y, min[1], max[1]), clamp(p.z, min[2], max[2]));
  }

  #updatePhoto(dt, move) {
    const dir = firstPersonDirection(this.yaw, this.pitch);
    if (move) {
      const s = (move.run ? INTERIOR_CAM.photoRunSpeed : INTERIOR_CAM.photoSpeed) * dt;
      const f = clamp(Number(move.forward) || 0, -1, 1);
      const r = clamp(Number(move.strafe) || 0, -1, 1);
      const u = clamp(Number(move.up) || 0, -1, 1);
      this._photoPos.x += (dir.x * f - Math.cos(this.yaw) * r) * s;
      this._photoPos.y += (dir.y * f + u) * s;
      this._photoPos.z += (dir.z * f + Math.sin(this.yaw) * r) * s;
      this.#clampPhoto();
    }
    this.camera.position.copy(this._photoPos);
    this._target.set(this._photoPos.x + dir.x, this._photoPos.y + dir.y, this._photoPos.z + dir.z);
    this.camera.lookAt(this._target);
  }

  #updatePeek(dt) {
    const p = this.peekState;
    p.remaining -= dt;
    const k = 1 - Math.exp(-INTERIOR_CAM.peekBlend * dt);
    const [px, py, pz] = p.pose.position;
    const [tx, ty, tz] = p.pose.target;
    this.camera.position.lerp(this._tmp.set(px, py, pz), k);
    this._peekLook.lerp(this._tmp.set(tx, ty, tz), k);
    this.camera.lookAt(this._peekLook);
    if (Number.isFinite(p.pose.fov)) this.#setFov(p.pose.fov);
    if (p.remaining <= 0) this.cancelPeek();
  }

  dispose() { this._abort.abort(); }
}
