import * as THREE from 'three';

const THIRD_PERSON_OFFSET = new THREE.Vector3(0, 2.4, -6.5);
const THIRD_PERSON_LOOK_HEIGHT = 1.3;
const FIRST_PERSON_EYE = new THREE.Vector3(0, 1.55, 0.15);
const FOLLOW_SMOOTHING = 6;        // default; dapat diubah lewat rig.followSmoothing
const MOUSE_SENSITIVITY = 0.0022;  // rad/piksel pada sensitivity = 1
const CAMERA_MODES = Object.freeze(['third', 'first']);
const PITCH_LIMIT = Math.PI / 2.4;
const ORBIT_RETURN_RATE = 1.5;

/**
 * CameraRig: kamera third-person (default) atau first-person (tombol V),
 * mouse mengatur orbit/pandangan via Pointer Lock.
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
    this._target = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._eye = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this.#bindPointer();
  }

  #bindPointer() {
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const k = MOUSE_SENSITIVITY * this.sensitivity;
      this.yawOffset -= e.movementX * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * k, -PITCH_LIMIT, PITCH_LIMIT);
    });
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

  /** Set mode kamera ('third' | 'first'); mode tak dikenal diabaikan. */
  setMode(mode) {
    if (!CAMERA_MODES.includes(mode) || mode === this.mode) return;
    this.mode = mode;
    this.yawOffset = 0;
    this.pitch = mode === 'first' ? 0 : 0.12;
  }

  /** @param {{x:number,z:number,yaw:number}} bike  @param {number} dt */
  update(bike, dt) {
    if (this.mode === 'first') this.#updateFirst(bike);
    else this.#updateThird(bike, dt);
  }

  #updateFirst(bike) {
    const eye = this._eye.copy(FIRST_PERSON_EYE).applyAxisAngle(THREE.Object3D.DEFAULT_UP, bike.yaw);
    this.camera.position.set(bike.x + eye.x, eye.y, bike.z + eye.z);
    const yaw = bike.yaw + this.yawOffset;
    const dir = this._dir.set(Math.sin(yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(yaw) * Math.cos(this.pitch));
    this._target.copy(this.camera.position).add(dir);
    this.camera.lookAt(this._target);
  }

  #updateThird(bike, dt) {
    // Orbit perlahan kembali ke belakang sepeda bila mouse diam
    this.yawOffset *= Math.exp(-ORBIT_RETURN_RATE * dt);
    const yaw = bike.yaw + this.yawOffset;
    const offset = this._offset.copy(THIRD_PERSON_OFFSET);
    offset.y += this.pitch * 4;
    offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    this._desired.set(bike.x + offset.x, offset.y, bike.z + offset.z);
    const k = 1 - Math.exp(-this.followSmoothing * dt);
    this.camera.position.lerp(this._desired, k);
    this.camera.lookAt(bike.x, THIRD_PERSON_LOOK_HEIGHT, bike.z);
  }
}
