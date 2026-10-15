// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '../src/core/CameraRig.js';

const make = () => new CameraRig(new THREE.PerspectiveCamera(60, 1, 0.3, 2500), document.createElement('canvas'));
const bike = (x = 0, z = 0, yaw = 0) => ({ x, z, yaw });
const run = (rig, b, seconds, dt = 1 / 60, each = () => {}) => {
  for (let t = 0; t < seconds; t += dt) { each(); rig.update(b, dt, t); }
};

describe('CameraRig orang ketiga', () => {
  it('REGRESI: melihat ke atas sampai batas tidak membawa kamera di bawah tanah', () => {
    const rig = make();
    rig.pitch = -1.3;
    let minY = Infinity;
    for (let i = 0; i < 120; i += 1) { rig.update(bike(), 1 / 60, i / 60); minY = Math.min(minY, rig.camera.position.y); }
    expect(minY).toBeGreaterThanOrEqual(0.45 - 1e-6);
  });

  it('jarak ke sepeda tetap dekat radius orbit (tidak melar saat pitch berubah)', () => {
    const rig = make();
    for (const pitch of [-0.8, 0, 0.8]) {
      rig.pitch = pitch;
      run(rig, bike(), 2);
      const d = Math.hypot(rig.camera.position.x, rig.camera.position.y - 1.3, rig.camera.position.z);
      expect(d).toBeGreaterThan(6.4);
      expect(d).toBeLessThan(6.7);
    }
  });

  it('dengan rintangan di belakang: kamera tidak pernah menembus dinding', () => {
    const rig = make();
    rig.setObstacleTest((x, z) => z > -3);
    let minZ = Infinity;
    for (let i = 0; i < 120; i += 1) { rig.update(bike(0, 0, 0), 1 / 60, i / 60); minZ = Math.min(minZ, rig.camera.position.z); }
    expect(minZ).toBeGreaterThan(-3);
  });

  it('teleport: kamera meloncat ke dekat sepeda, tidak terbang melintasi peta', () => {
    const rig = make();
    run(rig, bike(0, 0), 1);
    rig.update(bike(500, -200), 1 / 60, 0);
    expect(Math.hypot(rig.camera.position.x - 500, rig.camera.position.z + 200)).toBeLessThan(10);
  });

  it('selama masih menggerakkan pandangan, offset tidak meluruh; setelah diam kembali ke belakang sepeda', () => {
    const rig = make();
    rig.yawOffset = 1;
    run(rig, bike(), 1, 1 / 60, () => rig.lookBy(0, 0)); // input lihat aktif tiap frame
    expect(rig.yawOffset).toBeCloseTo(1, 6);
    run(rig, bike(), 6);
    expect(Math.abs(rig.yawOffset)).toBeLessThan(0.05);
  });

  it('state sepeda rusak (NaN) tidak merusak posisi kamera', () => {
    const rig = make();
    run(rig, bike(5, 5), 1);
    const before = rig.camera.position.clone();
    rig.update({ x: Number.NaN, z: 0, yaw: 0 }, 1 / 60, 0);
    expect(rig.camera.position.equals(before)).toBe(true);
  });

  it('yawOffset dinormalkan ke (-π, π] saat memutar berulang', () => {
    const rig = make();
    for (let i = 0; i < 500; i += 1) rig.lookBy(-200, 0);
    expect(Math.abs(rig.yawOffset)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});

describe('CameraRig orang pertama', () => {
  it('firstPersonView true hanya di mode orang pertama (rider disembunyikan agar kamera tidak di dalam kepala)', () => {
    const rig = make();
    expect(rig.firstPersonView).toBe(false);
    rig.setMode('first');
    expect(rig.firstPersonView).toBe(true);
  });

  it('kamera di ketinggian mata dan mengikuti arah hadap sepeda', () => {
    const rig = make();
    rig.setMode('first');
    rig.update(bike(10, 20, Math.PI / 2), 1 / 60, 0);
    expect(rig.camera.position.y).toBeCloseTo(1.55, 2);
    const dir = rig.camera.getWorldDirection(new THREE.Vector3());
    expect(dir.x).toBeGreaterThan(0.9); // yaw 90° → menghadap +x
  });

  it('pitch ke bawah membuat arah pandang menunduk, ke atas menengadah', () => {
    const rig = make();
    rig.setMode('first');
    rig.pitch = 0.5;
    rig.update(bike(), 1 / 60, 0);
    expect(rig.camera.getWorldDirection(new THREE.Vector3()).y).toBeLessThan(0);
    rig.pitch = -0.5;
    rig.update(bike(), 1 / 60, 0);
    expect(rig.camera.getWorldDirection(new THREE.Vector3()).y).toBeGreaterThan(0);
  });

  it('arah pandang bebas tidak ikut meluruh saat diam (orang pertama)', () => {
    const rig = make();
    rig.setMode('first');
    rig.yawOffset = 0.8;
    run(rig, bike(), 5);
    expect(rig.yawOffset).toBeCloseTo(0.8, 6);
  });
});
