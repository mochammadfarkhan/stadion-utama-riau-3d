import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from 'three';
import { STADIUM } from '../src/config/constants.js';
import { PovDirector } from '../src/core/PovDirector.js';
import { POV_BY_ID, povPose, createPose } from '../src/core/cameraPresets.js';

const OPEN_A = STADIUM.innerSemiX + STADIUM.roofOpeningPad;
const OPEN_B = STADIUM.innerSemiZ + STADIUM.roofOpeningPad;
const inEllipse = (x, z, a, b) => (x / a) ** 2 + (z / b) ** 2 < 1;

const src = {
  bike: { x: 0, z: -190, yaw: 0 },
  ball: () => ({ x: 4, z: -6 }),
  runner: (i) => (i < 8 ? { x: 36.8, z: 10 + i, yaw: -Math.PI / 2 } : null),
  vendor: () => ({ x: -20, z: -188, yaw: 1 }),
};
const playerPose = (out) => {
  Object.assign(out, { px: 0, py: 3.7, pz: -196, tx: 0, ty: 1.3, tz: -190 });
};

function makeCamera() {
  const cam = new PerspectiveCamera(60, 16 / 9, 0.3, 2500);
  cam.position.set(0, 3.7, -196);
  cam.lookAt(0, 1.3, -190);
  return cam;
}

/** Jalankan director dengan dt tetap; kembalikan jejak posisi kamera tiap frame. */
function run(director, seconds, dt = 1 / 60, t0 = 0) {
  const trail = [];
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i += 1) {
    director.update(dt, t0 + i * dt, src, playerPose);
    trail.push(director.camera.position.clone());
  }
  return trail;
}

describe('PovDirector', () => {
  it('masuk POV Udara: mencapai pose tujuan dan mempertahankannya; sepeda beku', () => {
    const cam = makeCamera();
    const d = new PovDirector(cam);
    expect(d.enter(POV_BY_ID.udara, src)).toBe(true);
    expect(d.freezesBike).toBe(true);
    run(d, 4);
    const want = createPose();
    povPose(POV_BY_ID.udara, src, 0, 0, want);
    expect(cam.position.x).toBeCloseTo(want.px, 1);
    expect(cam.position.y).toBeCloseTo(want.py, 1);
    expect(cam.fov).toBeCloseTo(POV_BY_ID.udara.fov, 3);
    expect(d.povId).toBe('udara');
  });

  it('Top-down: sepeda TIDAK beku dan kamera mengikuti sepeda', () => {
    const cam = makeCamera();
    const d = new PovDirector(cam);
    d.enter(POV_BY_ID.atas, src);
    expect(d.freezesBike).toBe(false);
    run(d, 3);
    const bike = { ...src.bike };
    expect(cam.position.x).toBeCloseTo(bike.x, 0);
    src.bike = { x: 30, z: -150, yaw: 0 };
    run(d, 3, 1 / 60, 3);
    expect(cam.position.x).toBeCloseTo(30, 0);
    src.bike = bike;
  });

  it('keluar: kembali ke pose pemain, FOV dipulihkan, lalu idle (update false)', () => {
    const cam = makeCamera();
    const d = new PovDirector(cam);
    d.setBaseFov(60);
    d.enter(POV_BY_ID.tribun, src);
    run(d, 4);
    expect(cam.fov).toBeCloseTo(POV_BY_ID.tribun.fov, 3);
    d.exit();
    expect(d.freezesBike).toBe(false);
    run(d, 5, 1 / 60, 4);
    expect(d.active).toBe(false);
    expect(cam.position.z).toBeCloseTo(-196, 1);
    expect(cam.fov).toBeCloseTo(60, 3);
    expect(d.update(1 / 60, 9, src, playerPose)).toBe(false);
  });

  it('transisi mulus: tidak ada lompatan posisi antar frame', () => {
    const cam = makeCamera();
    const d = new PovDirector(cam);
    d.enter(POV_BY_ID.udara, src);
    const trail = run(d, 5);
    let max = 0;
    for (let i = 1; i < trail.length; i += 1) max = Math.max(max, trail[i].distanceTo(trail[i - 1]));
    expect(max).toBeLessThan(16);
  });

  it('plaza → Tribun: kamera melewati atas atap dan masuk lewat bukaan, tidak menembus cincin atap', () => {
    const cam = makeCamera();
    const d = new PovDirector(cam);
    d.enter(POV_BY_ID.tribun, src);
    const trail = run(d, 5);
    const clearY = STADIUM.roofHeight + 3;
    const end = trail[trail.length - 1];
    trail.forEach((p, i) => {
      const ring = inEllipse(p.x, p.z, STADIUM.outerSemiX, STADIUM.outerSemiZ) && !inEllipse(p.x, p.z, OPEN_A, OPEN_B);
      const nearSeat = p.distanceTo(end) < 12; // kursi tribun sendiri berada di bawah tepi atap
      if (ring && !nearSeat) expect(p.y, `frame ${i}`).toBeGreaterThan(clearY);
    });
  });

  it('Pelari: ikut bergerak; setSubject pindah ke pelari berikutnya dengan transisi', () => {
    const cam = makeCamera();
    const d = new PovDirector(cam);
    expect(d.enter(POV_BY_ID.pelari, src, 0)).toBe(true);
    run(d, 4);
    const z0 = cam.position.z;
    d.setSubject(3);
    run(d, 4, 1 / 60, 4);
    expect(cam.position.z).toBeGreaterThan(z0 + 1);
  });

  it('subjek tidak tersedia → enter false dan tetap idle', () => {
    const d = new PovDirector(makeCamera());
    const none = { ...src, runner: () => null };
    expect(d.enter(POV_BY_ID.pelari, none, 0)).toBe(false);
    expect(d.active).toBe(false);
  });

  it('orbit mouse & zoom dibatasi dan hanya aktif saat POV', () => {
    const cam = makeCamera();
    const d = new PovDirector(cam);
    d.look(1, 1);
    d.zoomBy(500);
    expect([d.yaw, d.pitch, d.zoom]).toEqual([0, 0, 1]);
    d.enter(POV_BY_ID.udara, src);
    run(d, 4);
    d.zoomBy(-100000);
    expect(d.zoom).toBe(POV_BY_ID.udara.zoomMin);
    d.zoomBy(100000);
    expect(d.zoom).toBe(POV_BY_ID.udara.zoomMax);
    d.look(0, 100);
    expect(d.pitch).toBeLessThanOrEqual(1.2);
    const before = cam.position.clone();
    d.look(0.5, 0);
    run(d, 0.2, 1 / 60, 4);
    expect(cam.position.distanceTo(before)).toBeGreaterThan(1);
  });

  it('fokus mengikuti titik pandang POV', () => {
    const d = new PovDirector(makeCamera());
    d.enter(POV_BY_ID.bola, src);
    run(d, 3);
    expect(d.focus.x).toBeCloseTo(4, 0);
    expect(d.focus.z).toBeCloseTo(-6, 0);
  });

  it('tanpa NaN walau dt 0', () => {
    const cam = makeCamera();
    const d = new PovDirector(cam);
    d.enter(POV_BY_ID.orbit, src);
    for (let i = 0; i < 5; i += 1) d.update(0, i, src, playerPose);
    expect(Number.isFinite(cam.position.x + cam.position.y + cam.position.z)).toBe(true);
  });
});
