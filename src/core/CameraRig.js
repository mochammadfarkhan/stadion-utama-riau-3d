import * as THREE from 'three';
import { PovDirector } from './PovDirector.js';
import { EXIT_KEY, POV_BY_KEY } from './cameraPresets.js';
import {
  THIRD, decayLook, firstPersonDirection, pullInOffset, shouldSnap, sweepOffset, thirdPersonOffset, wrapAngle,
} from './cameraMath.js';

const FIRST_PERSON_EYE = new THREE.Vector3(0, 1.55, 0.15);
const FOLLOW_SMOOTHING = 6;        // default; dapat diubah lewat rig.followSmoothing
const MOUSE_SENSITIVITY = 0.0022;  // rad/piksel pada sensitivity = 1
const CAMERA_MODES = Object.freeze(['third', 'first']);
const PITCH_LIMIT = Math.PI / 2.4;

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
    this._idle = 0;                          // detik sejak input lihat terakhir (kembali ke belakang sepeda setelah jeda)
    this._snap = true;                       // loncat ke pose ideal pada frame berikutnya (awal, ganti mode, teleport)
    this.obstacleTest = null;                // (x, z) => bool bebas; dipakai menarik kamera dari dinding
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
      if (this.locked) this.lookBy(e.movementX, e.movementY);
    }, { signal });
    this.dom.addEventListener('wheel', (e) => this.director.zoomBy(e.deltaY), { signal, passive: true });
  }

  /**
   * Geser arah lihat dalam satuan "piksel mouse": dipakai mouse (pointer lock), drag sentuh,
   * dan stick kanan gamepad. Di POV diteruskan ke PovDirector.
   * @param {number} dx @param {number} dy @param {number} [scale=1] pengali kepekaan (sentuh > mouse)
   */
  lookBy(dx, dy, scale = 1) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const k = MOUSE_SENSITIVITY * this.sensitivity * scale;
    if (this.director.mode === 'pov') {
      this.director.look(dx * k, dy * k);
      return;
    }
    this._idle = 0;
    this.yawOffset = wrapAngle(this.yawOffset - dx * k);
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * k, -PITCH_LIMIT, PITCH_LIMIT);
  }

  /** Pasang uji ruang bebas kamera `(x, z) => boolean` (lihat Collider.isCameraClear); null = tanpa tabrakan. */
  setObstacleTest(fn) { this.obstacleTest = typeof fn === 'function' ? fn : null; }

  /** True saat kamera orang pertama sedang dipakai (bukan POV): rider disembunyikan agar kamera tidak di dalam kepala. */
  get firstPersonView() { return this.mode === 'first' && !this.director.active; }

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
    this._idle = 0;
    this._snap = true;
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
    if (!bike || !Number.isFinite(bike.x) || !Number.isFinite(bike.z) || !Number.isFinite(bike.yaw)) return; // state rusak: pertahankan kamera
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
    const d = firstPersonDirection(bike.yaw + this.yawOffset, this.pitch);
    outTarget.set(outPos.x + d.x, outPos.y + d.y, outPos.z + d.z);
  }

  /** Pose orang ketiga ideal: orbit konstan di sekitar titik pandang, sudah ditarik dari dinding. */
  #poseThird(bike, outPos, outTarget) {
    outTarget.set(bike.x, THIRD.lookHeight, bike.z);
    const yaw = bike.yaw + this.yawOffset;
    // Terhalang dinding: geser sudut orbit ke posisi bebas terdekat; bila semua terhalang, tarik mendekat.
    const safe = (this.obstacleTest && sweepOffset(outTarget, yaw, this.pitch, this.obstacleTest))
      || this.#pullIn(outTarget, thirdPersonOffset(yaw, this.pitch));
    outPos.set(outTarget.x + safe.x, outTarget.y + safe.y, outTarget.z + safe.z);
  }

  #pullIn(target, offset) {
    return this.obstacleTest ? pullInOffset(target, offset, this.obstacleTest) : offset;
  }

  #updateFirst(bike) {
    this.#poseFirst(bike, this.camera.position, this._target);
    this.camera.lookAt(this._target);
    this._snap = false;
  }

  #updateThird(bike, dt) {
    // Kamera kembali ke belakang sepeda hanya setelah input lihat berhenti (tidak melawan mouse/jari/stick).
    this._idle += dt;
    this.yawOffset = decayLook(this.yawOffset, dt, this._idle);
    this.#poseThird(bike, this._desired, this._target);
    const cam = this.camera.position;
    if (this._snap || shouldSnap(cam.x - this._desired.x, cam.y - this._desired.y, cam.z - this._desired.z)) {
      cam.copy(this._desired); // awal / ganti mode / teleport: loncat, jangan terbang menembus bangunan
      this._snap = false;
    } else {
      cam.lerp(this._desired, 1 - Math.exp(-this.followSmoothing * dt));
    }
    // Posisi hasil smoothing bisa menyilang sudut dinding: periksa ulang terhadap titik pandang.
    const offset = this._offset.set(cam.x - this._target.x, cam.y - this._target.y, cam.z - this._target.z);
    const safe = this.#pullIn(this._target, offset);
    cam.set(this._target.x + safe.x, Math.max(THIRD.minHeight, this._target.y + safe.y), this._target.z + safe.z);
    this.camera.lookAt(this._target);
  }
}
