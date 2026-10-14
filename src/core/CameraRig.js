import * as THREE from 'three';
import { PovDirector } from './PovDirector.js';
import { EXIT_KEY, POV_BY_KEY } from './cameraPresets.js';

const THIRD_PERSON_OFFSET = new THREE.Vector3(0, 2.4, -6.5);
const THIRD_PERSON_LOOK_HEIGHT = 1.3;
const FIRST_PERSON_EYE = new THREE.Vector3(0, 1.55, 0.15);
const FOLLOW_SMOOTHING = 6;        // default; dapat diubah lewat rig.followSmoothing
const MOUSE_SENSITIVITY = 0.0022;  // rad/piksel pada sensitivity = 1
const CAMERA_MODES = Object.freeze(['third', 'first']);
const PITCH_LIMIT = Math.PI / 2.4;
const ORBIT_RETURN_RATE = 1.5;

/**
 * CameraRig: kamera pemain third-person (default) atau first-person, ditambah sudut
 * pandang (POV) lewat PovDirector. Selalu SATU kamera yang sama, sehingga rantai
 * post-processing, label, dan bayangan tidak perlu diganti saat pindah POV.
 * Mouse (pointer lock) mengatur pandangan pemain, atau orbit saat POV aktif.
 */
export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.mode = 'third';
    this.yawOffset = 0;
    this.pitch = 0.12;
    this.locked = false;
    this.sensitivity = 1;                    // pengali MOUSE_SENSITIVITY (settings camera.sensitivity)
    this.followSmoothing = FOLLOW_SMOOTHING; // 1/s (settings camera.followSmoothing)
    this.director = new PovDirector(camera);
    /** Titik fokus tampilan: posisi sepeda (mode pemain) atau titik pandang (POV). */
    this.focus = new THREE.Vector3();
    this._source = null;
    this._bike = null;
    this._target = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._eye = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._playerPose = (out) => this.#writePlayerPose(out);
    this._abort = new AbortController();
    this.#bindPointer();
  }

  #bindPointer() {
    const { signal } = this._abort;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    }, { signal });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const k = MOUSE_SENSITIVITY * this.sensitivity;
      if (this.director.mode === 'pov') {
        this.director.look(e.movementX * k, e.movementY * k);
        return;
      }
      this.yawOffset -= e.movementX * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * k, -PITCH_LIMIT, PITCH_LIMIT);
    }, { signal });
    this.dom.addEventListener('wheel', (e) => this.director.zoomBy(e.deltaY), { signal, passive: true });
  }

  /** Lepas semua listener (dipanggil saat aplikasi dibongkar). */
  dispose() {
    this._abort.abort();
  }

  requestLock() {
    try {
      const p = this.dom.requestPointerLock?.();
      p?.catch?.(() => { this.locked = false; }); // ditolak (mis. iframe): tetap third-person
    } catch {
      this.locked = false;
    }
  }

  toggleMode() {
    this.setMode(this.mode === 'third' ? 'first' : 'third');
    return this.mode;
  }

  /** Set mode kamera pemain ('third' | 'first'); mode tak dikenal diabaikan. */
  setMode(mode) {
    if (!CAMERA_MODES.includes(mode) || mode === this.mode) return;
    this.mode = mode;
    this.yawOffset = 0;
    this.pitch = mode === 'first' ? 0 : 0.12;
  }

  /** FOV dasar (settings camera.fov); dipakai kamera pemain & dipulihkan setelah POV. */
  setBaseFov(fov) {
    this.director.setBaseFov(fov);
    if (this.director.active) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Sumber posisi entitas untuk POV (lihat core/povSource.js). Harus punya `bike`
   * (getter state sepeda) dan fungsi ball/runner/vendor.
   */
  attachSource(source) {
    this._source = source;
  }

  get povId() { return this.director.povId; }
  get povLabel() { return this.director.label; }
  /** True bila kontrol sepeda harus dibekukan (POV aktif yang tidak mengendalikan sepeda). */
  get freezesBike() { return this.director.freezesBike; }

  /**
   * Tangani tombol POV: Digit1..7 masuk POV (tekan lagi: pindah subjek bila POV punya
   * banyak subjek, selain itu keluar), Digit0 keluar. Mengembalikan label untuk toast
   * atau string kosong bila keluar; null bila tombol bukan milik POV.
   */
  handlePovKey(code) {
    if (code === EXIT_KEY) return this.exitPov() ? 'Kembali ke sepeda' : null;
    const def = POV_BY_KEY[code];
    if (!def || !this._source) return null;
    const d = this.director;
    if (d.povId === def.id) {
      if (!def.cycle) return this.exitPov() ? 'Kembali ke sepeda' : null;
      const count = this.#subjectCount(def.id);
      d.setSubject((d.subject + 1) % Math.max(1, count));
      return `${def.label} ${(d.subject % Math.max(1, count)) + 1}/${count}`;
    }
    return d.enter(def, this._source, 0) ? def.label : null;
  }

  #subjectCount(id) {
    const s = this._source;
    if (id === 'pelari') return s.runnerCount?.() ?? 1;
    if (id === 'pedagang') return s.vendorCount?.() ?? 1;
    return 1;
  }

  exitPov() {
    const was = this.director.mode === 'pov';
    this.director.exit();
    return was;
  }

  /**
   * @param {{x:number,z:number,yaw:number}} bike
   * @param {number} dt
   * @param {number} [time] detik sejak mulai (untuk POV orbit)
   */
  update(bike, dt, time = 0) {
    this._bike = bike;
    this.focus.set(bike.x, 0, bike.z);
    if (this.director.active && this._source) {
      const handled = this.director.update(dt, time, this._source, this._playerPose);
      if (this.director.active) this.focus.set(this.director.focus.x, 0, this.director.focus.z);
      if (handled) return;
    }
    if (this.mode === 'first') this.#updateFirst(bike);
    else this.#updateThird(bike, dt);
  }

  /** Pose pemain ideal (tanpa smoothing) untuk transisi kembali dari POV. */
  #writePlayerPose(out) {
    const bike = this._bike;
    if (this.mode === 'first') this.#poseFirst(bike, this._desired, this._target);
    else this.#poseThird(bike, this._desired, this._target);
    out.px = this._desired.x; out.py = this._desired.y; out.pz = this._desired.z;
    out.tx = this._target.x; out.ty = this._target.y; out.tz = this._target.z;
  }

  #poseFirst(bike, outPos, outTarget) {
    const eye = this._eye.copy(FIRST_PERSON_EYE).applyAxisAngle(THREE.Object3D.DEFAULT_UP, bike.yaw);
    outPos.set(bike.x + eye.x, eye.y, bike.z + eye.z);
    const yaw = bike.yaw + this.yawOffset;
    const dir = this._dir.set(Math.sin(yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(yaw) * Math.cos(this.pitch));
    outTarget.copy(outPos).add(dir);
  }

  #poseThird(bike, outPos, outTarget) {
    const yaw = bike.yaw + this.yawOffset;
    const offset = this._offset.copy(THIRD_PERSON_OFFSET);
    offset.y += this.pitch * 4;
    offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    outPos.set(bike.x + offset.x, offset.y, bike.z + offset.z);
    outTarget.set(bike.x, THIRD_PERSON_LOOK_HEIGHT, bike.z);
  }

  #updateFirst(bike) {
    this.#poseFirst(bike, this.camera.position, this._target);
    this.camera.lookAt(this._target);
  }

  #updateThird(bike, dt) {
    // Orbit perlahan kembali ke belakang sepeda bila mouse diam
    this.yawOffset *= Math.exp(-ORBIT_RETURN_RATE * dt);
    this.#poseThird(bike, this._desired, this._target);
    const k = 1 - Math.exp(-this.followSmoothing * dt);
    this.camera.position.lerp(this._desired, k);
    this.camera.lookAt(this._target);
  }
}
