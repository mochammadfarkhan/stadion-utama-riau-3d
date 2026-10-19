// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '../src/core/CameraRig.js';
import { cameraFloor, THIRD } from '../src/core/cameraMath.js';
import { POV_BY_ID, createPose, liftPose, povPose } from '../src/core/cameraPresets.js';
import { createLocalContext, localHeightAt } from '../src/app/regionContext.js';
import { createRegionFrame, IDENTITY_FRAME } from '../src/geo/regionTransform.js';
import { Bicycle } from '../src/entities/Bicycle.js';

/** Terrain uji: bidang miring 10% ke timur, y = 0,1·x. */
const SLOPE = Object.freeze({
  heightAt: (x) => 0.1 * x,
  gradeAlong: (x, z, yaw) => 0.1 * Math.sin(yaw),
  normalAt: () => ({ x: 0, y: 1, z: 0 }),
  version: 1,
});

describe('cameraFloor', () => {
  it('tanah + minHeight; tak hingga → perilaku datar', () => {
    expect(cameraFloor(0)).toBeCloseTo(THIRD.minHeight, 12);
    expect(cameraFloor(2.5)).toBeCloseTo(2.95, 12);
    expect(cameraFloor(Number.NaN)).toBeCloseTo(0.45, 12);
  });
});

describe('povPose relatif tanah', () => {
  it('liftPose menaikkan posisi & titik pandang; 0/NaN tidak mengubah', () => {
    const p = { ...createPose(), py: 5, ty: 1 };
    liftPose(p, 2);
    expect([p.py, p.ty]).toEqual([7, 3]);
    liftPose(p, Number.NaN);
    liftPose(p, 0);
    expect([p.py, p.ty]).toEqual([7, 3]);
  });

  it('POV top-down di atas sepeda pada tanah 10 m naik 10 m; tanpa heightAt = perilaku lama', () => {
    const src = { bike: { x: 100, z: 0, yaw: 0 } };
    const a = createPose();
    const b = createPose();
    expect(povPose(POV_BY_ID.atas, src, 0, 0, a)).toBe(true);
    expect(povPose(POV_BY_ID.atas, src, 0, 0, b, SLOPE.heightAt)).toBe(true);
    expect(b.py - a.py).toBeCloseTo(10, 9);
    expect(b.ty - a.ty).toBeCloseTo(10, 9);
  });
});

describe('localHeightAt & createLocalContext', () => {
  const frame = createRegionFrame({ x: 100, z: -50, yaw: 0.3 });
  it('fungsi lokal = fungsi dunia di titik dunia yang sama; identitas = fungsi sama', () => {
    const local = localHeightAt(frame, SLOPE.heightAt);
    const w = frame.toWorld(5, -7);
    expect(local(5, -7)).toBeCloseTo(SLOPE.heightAt(w.x, w.z), 12);
    expect(localHeightAt(IDENTITY_FRAME, SLOPE.heightAt)).toBe(SLOPE.heightAt);
    expect(localHeightAt(frame, undefined)).toBeUndefined();
  });
  it('ctx lokal membawa heightAt lokal (dibungkus sekali)', () => {
    const toLocal = createLocalContext(frame);
    const a = toLocal({ heightAt: SLOPE.heightAt, bikePos: { x: 0, y: 0, z: 0 } });
    const b = toLocal({ heightAt: SLOPE.heightAt, bikePos: { x: 0, y: 0, z: 0 } });
    expect(a.heightAt).toBe(b.heightAt);
    const w = frame.toWorld(1, 2);
    expect(a.heightAt(1, 2)).toBeCloseTo(0.1 * w.x, 12);
  });
});

describe('CameraRig mengikuti tanah', () => {
  const make = () => new CameraRig(new THREE.PerspectiveCamera(60, 1, 0.3, 2500), document.createElement('canvas'));
  it('fokus.y = tanah; kamera orang ketiga ≥ tanah di bawah kamera + 0,45; orang pertama mata 1,55 m di atas tanah', () => {
    const rig = make();
    rig.setTerrain(SLOPE);
    const bike = { x: 50, z: 0, yaw: -Math.PI / 2 }; // menghadap barat (turun); kamera di timur (lebih tinggi)
    rig.pitch = -1.3; // lihat ke atas: kamera serendah mungkin
    for (let i = 0; i < 120; i += 1) rig.update(bike, 1 / 60, i / 60);
    expect(rig.focus.y).toBeCloseTo(5, 9);
    const cam = rig.camera.position;
    expect(cam.y).toBeGreaterThanOrEqual(0.1 * cam.x + 0.45 - 1e-6);
    rig.setMode('first');
    rig.update(bike, 1 / 60, 3);
    expect(rig.camera.position.y).toBeCloseTo(0.1 * rig.camera.position.x + 1.55, 1);
  });
  it('setTerrain(null) = datar (paritas)', () => {
    const rig = make();
    rig.setTerrain(null);
    rig.update({ x: 50, z: 0, yaw: 0 }, 1 / 60, 0);
    expect(rig.focus.y).toBe(0);
  });
});

describe('Bicycle mengikuti tanah', () => {
  it('y grup = heightAt, pitch menuju −atan(grade), grade masuk sim (menanjak lebih lambat)', () => {
    const climb = new Bicycle({ x: 0, z: 0, yaw: Math.PI / 2 }); // menghadap timur: menanjak 10%
    climb.setTerrain(SLOPE);
    const flat = new Bicycle({ x: 0, z: 0, yaw: Math.PI / 2 });
    const input = { isDown: (c) => c === 'KeyW', consumePress: () => false };
    for (let i = 0; i < 120; i += 1) {
      climb.update(1 / 60, { input });
      flat.update(1 / 60, { input });
    }
    expect(climb.group.position.y).toBeCloseTo(0.1 * climb.state.x, 6);
    expect(climb.position.y).toBeCloseTo(climb.groundY, 12);
    expect(climb.group.rotation.x).toBeCloseTo(-Math.atan(0.1), 2);
    expect(climb.state.v).toBeLessThan(flat.state.v);
    expect(flat.group.position.y).toBe(0);
    climb.dispose();
    flat.dispose();
  });
});
