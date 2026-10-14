import * as THREE from 'three';
import {
  applyOrbit, bezier3, clamp01, copyPose, createPose, easeInOutCubic, povPose,
  routeControl, smoothPose, transitionDuration,
} from './cameraPresets.js';

const LOOK_AHEAD = 25;      // jarak titik pandang turunan dari arah kamera saat transisi dimulai (m)
const ORBIT_PITCH_LIMIT = 1.2;
const WHEEL_ZOOM_RATE = 0.001;

/**
 * PovDirector menggerakkan SATU kamera yang sama (kamera utama) ke sudut pandang
 * tertentu: transisi berkurva yang tidak menembus atap, subjek bergerak diikuti dengan
 * smoothing, orbit/zoom dari mouse, lalu kembali ke pose pemain. Tidak menyentuh DOM,
 * sehingga bisa diuji di Node. State mode: 'idle' | 'pov' | 'leaving'.
 */
export class PovDirector {
  /** @param {THREE.PerspectiveCamera} camera */
  constructor(camera) {
    this.camera = camera;
    this.baseFov = camera.fov;
    this.mode = 'idle';
    this.def = null;
    this.subject = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.zoom = 1;
    this.focus = { x: 0, y: 0, z: 0 };
    this._from = createPose();
    this._dest = createPose();
    this._raw = createPose();
    this._smooth = createPose();
    this._c1 = { x: 0, y: 0, z: 0 };
    this._c2 = { x: 0, y: 0, z: 0 };
    this._point = { x: 0, y: 0, z: 0 };
    this._dir = new THREE.Vector3();
    this._t = 1;
    this._duration = 1.5;
    this._pending = false;
    this._hasSmooth = false;
  }

  get active() { return this.mode !== 'idle'; }
  get povId() { return this.mode === 'pov' ? this.def.id : null; }
  get label() { return this.mode === 'pov' ? this.def.label : null; }
  /** Sepeda dibekukan hanya selama POV aktif yang tidak mengendalikan sepeda. */
  get freezesBike() { return this.mode === 'pov' && !this.def.controlsBike; }

  /** Masuk ke POV; false bila subjek (pelari/pedagang/bola) belum tersedia. */
  enter(def, src, subject = 0) {
    if (!povPose(def, src, subject, 0, this._raw)) return false;
    this.#captureFrom();
    this.def = def;
    this.subject = subject;
    this.mode = 'pov';
    this.yaw = 0;
    this.pitch = 0;
    this.zoom = 1;
    this._hasSmooth = false;
    this.#restart();
    return true;
  }

  /** Pindah subjek POV yang sama (pelari/pedagang berikutnya) dengan transisi halus. */
  setSubject(subject) {
    if (this.mode !== 'pov') return;
    this.subject = subject;
    this.#captureFrom();
    this.#restart();
  }

  /** Kembali ke pose pemain lewat transisi. */
  exit() {
    if (this.mode !== 'pov') return;
    this.#captureFrom();
    this.mode = 'leaving';
    this.#restart();
  }

  setBaseFov(fov) { this.baseFov = fov; }

  /** Orbit dari gerakan mouse (radian). */
  look(dYaw, dPitch) {
    if (this.mode !== 'pov') return;
    this.yaw -= dYaw;
    this.pitch = Math.min(ORBIT_PITCH_LIMIT, Math.max(-ORBIT_PITCH_LIMIT, this.pitch + dPitch));
  }

  /** Zoom dari roda mouse (deltaY piksel); dibatasi per POV. */
  zoomBy(deltaY) {
    if (this.mode !== 'pov') return;
    const z = this.zoom * (1 + deltaY * WHEEL_ZOOM_RATE);
    this.zoom = Math.min(this.def.zoomMax, Math.max(this.def.zoomMin, z));
  }

  #restart() {
    this._t = 0;
    this._pending = true;
  }

  #captureFrom() {
    const c = this.camera;
    c.getWorldDirection(this._dir);
    const f = this._from;
    f.px = c.position.x; f.py = c.position.y; f.pz = c.position.z;
    f.tx = f.px + this._dir.x * LOOK_AHEAD;
    f.ty = f.py + this._dir.y * LOOK_AHEAD;
    f.tz = f.pz + this._dir.z * LOOK_AHEAD;
    f.fov = c.fov;
  }

  /** Pose tujuan frame ini: pose pemain saat 'leaving', pose POV (+smoothing, +orbit) saat 'pov'. */
  #computeDest(dt, time, src, playerPose) {
    const d = this._dest;
    if (this.mode === 'leaving') {
      playerPose(d);
      d.fov = this.baseFov;
      return;
    }
    const def = this.def;
    if (povPose(def, src, this.subject, time, this._raw)) {
      if (def.kind === 'follow' && this._hasSmooth) smoothPose(this._smooth, this._raw, def.follow, dt);
      else copyPose(this._smooth, this._raw);
      this._hasSmooth = true;
    }
    copyPose(d, this._smooth);
    applyOrbit(d, def, this.yaw, this.pitch, this.zoom);
    d.fov = def.fov;
  }

  #apply(px, py, pz, tx, ty, tz, fov) {
    const c = this.camera;
    c.position.set(px, py, pz);
    c.lookAt(tx, ty, tz);
    if (Math.abs(c.fov - fov) > 1e-3) {
      c.fov = fov;
      c.updateProjectionMatrix();
    }
  }

  /**
   * @param {number} dt detik
   * @param {number} time detik sejak mulai (untuk POV orbit)
   * @param {object} src sumber posisi entitas (lihat povPose)
   * @param {(out:object)=>void} playerPose menulis pose pemain ideal (tanpa smoothing)
   * @returns {boolean} true bila kamera dikendalikan director frame ini
   */
  update(dt, time, src, playerPose) {
    if (this.mode === 'idle') return false;
    this.#computeDest(dt, time, src, playerPose);
    const d = this._dest;
    const f = this._from;
    this.focus.x = d.tx; this.focus.y = 0; this.focus.z = d.tz;
    if (this._t >= 1) {
      this.#apply(d.px, d.py, d.pz, d.tx, d.ty, d.tz, d.fov);
      return true;
    }
    if (this._pending) {
      this._duration = transitionDuration(f, d);
      this._pending = false;
    }
    this._t = clamp01(this._t + dt / this._duration);
    const e = easeInOutCubic(this._t);
    routeControl(f, d, this._c1, this._c2);
    const p = bezier3(f, this._c1, this._c2, d, e, this._point);
    this.#apply(
      p.x, p.y, p.z,
      f.tx + (d.tx - f.tx) * e, f.ty + (d.ty - f.ty) * e, f.tz + (d.tz - f.tz) * e,
      f.fov + (d.fov - f.fov) * e,
    );
    if (this._t >= 1 && this.mode === 'leaving') {
      this.#apply(d.px, d.py, d.pz, d.tx, d.ty, d.tz, d.fov);
      this.mode = 'idle';
      this.def = null;
    }
    return true;
  }
}
