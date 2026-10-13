import { describe, it, expect } from 'vitest';
import { SURFACE_Y, STADIUM } from '../src/config/constants.js';
import { createGround } from '../src/world/Ground.js';
import { createTrack } from '../src/world/stadium/Track.js';
import { createPitch } from '../src/world/stadium/Pitch.js';

const MIN_GAP = 0.009; // ≥ ~1 cm antar lapisan yang bertumpuk

/** y minimum & maksimum geometri mesh bernama (dalam koordinat dunia group). */
function yRange(group, name) {
  const mesh = group.getObjectByName(name);
  expect(mesh, `mesh ${name}`).toBeTruthy();
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  g.computeBoundingBox();
  return { min: g.boundingBox.min.y, max: g.boundingBox.max.y };
}

describe('lapisan permukaan stadion (anti z-fighting)', () => {
  it('pasangan yang bertumpuk punya selisih ketinggian ≥ 1 cm', () => {
    const pairs = [['dzone', 'pitch'], ['apron', 'drain'], ['tartan', 'trackLine'], ['pitch', 'pitchLine']];
    for (const [low, high] of pairs) expect(SURFACE_Y[high] - SURFACE_Y[low]).toBeGreaterThan(MIN_GAP);
  });

  it('semua lapisan stadion berada di atas tanah kawasan (y = 0)', () => {
    for (const [k, v] of Object.entries(SURFACE_Y)) if (k !== 'groundHoleInset') expect(v).toBeGreaterThan(0);
  });

  it('geometri lintasan & lapangan memakai ketinggian dari SURFACE_Y', () => {
    const track = createTrack();
    const pitch = createPitch();
    expect(yRange(track, 'tartan').min).toBeCloseTo(SURFACE_Y.tartan, 4);
    expect(yRange(pitch, 'dzone').min).toBeCloseTo(SURFACE_Y.dzone, 4);
  });

  it('tanah kawasan berlubang di bawah stadion (tak ada vertex di dalam elips kaki tribun)', () => {
    const ground = createGround();
    const mesh = ground.getObjectByName('rumput');
    const pos = mesh.geometry.attributes.position;
    const a = STADIUM.innerSemiX - SURFACE_Y.groundHoleInset - 0.01;
    const b = STADIUM.innerSemiZ - SURFACE_Y.groundHoleInset - 0.01;
    let inside = 0;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      if ((x / a) ** 2 + (z / b) ** 2 < 1) inside += 1;
    }
    expect(inside).toBe(0);
  });
});
