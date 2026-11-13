import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from 'three';
import { PovDirector } from '../src/core/PovDirector.js';
import { CITY, POV_BY_ID } from '../src/core/cameraPresets.js';

const src = { bike: { x: 100, z: -50, yaw: 0 } };
const playerPose = (out) => Object.assign(out, { px: 100, py: 3, pz: -56, tx: 100, ty: 1, tz: -50 });

function enterCity() {
  const d = new PovDirector(new PerspectiveCamera(60, 16 / 9, 0.3, 2500));
  d.enter(POV_BY_ID.kota, src, 0);
  for (let i = 0; i < 400; i += 1) d.update(1 / 30, i / 30, src, playerPose); // selesaikan transisi
  return d;
}

describe('pratinjau kota (POV kota)', () => {
  it('kamera isometrik: elevasi 35,26° dan azimut 45° mengarah ke pemain', () => {
    const d = enterCity();
    const c = d.camera.position;
    const flat = Math.hypot(c.x - 100, c.z + 50);
    expect(Math.atan2(c.y, flat)).toBeCloseTo(CITY.elevation, 3);
    expect(Math.atan2(c.x - 100, c.z + 50)).toBeCloseTo(CITY.azimuth, 3);
    expect(d.camera.fov).toBeCloseTo(CITY.fov, 3);
  });

  it('geser maju bergerak ke arah pandang (barat laut) dan dijepit di batas peta', () => {
    const d = enterCity();
    d.panBy(100, 0);
    expect(d.pan.x).toBeCloseTo(-70.71, 1);
    expect(d.pan.z).toBeCloseTo(-70.71, 1);
    d.panBy(1e7, 0);
    expect(Math.hypot(d.pan.x, d.pan.z)).toBeCloseTo(CITY.panLimit, 3);
  });

  it('pan dibuang saat masuk lagi; POV lain mengabaikan panBy', () => {
    const d = enterCity();
    d.panBy(50, 50);
    d.exit({ instant: true });
    d.enter(POV_BY_ID.udara, src, 0);
    d.panBy(50, 50);
    expect(d.pan).toEqual({ x: 0, z: 0 });
  });
});
