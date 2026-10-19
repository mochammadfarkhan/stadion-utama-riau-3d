import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from 'three';
import { POV_BY_ID, POV_BY_KEY, POVS, povPose, createPose } from '../src/core/cameraPresets.js';
import { PovDirector } from '../src/core/PovDirector.js';
import { createPovSource } from '../src/core/povSource.js';
import { createRegionFrame, IDENTITY_FRAME } from '../src/geo/regionTransform.js';

const pose = (over = {}) => ({ px: 1, py: 2, pz: 3, tx: 4, ty: 5, tz: 6, ...over });
const bike = { x: 0, z: 0, yaw: 0 };

describe('POV region (M0)', () => {
  it('Digit8 = POV region: cycle, tidak mengendalikan sepeda; POV 1–7 tidak berubah', () => {
    expect(POV_BY_KEY.Digit8.id).toBe('region');
    expect(POV_BY_ID.region).toMatchObject({ kind: 'region', cycle: true, controlsBike: false });
    expect(POVS.slice(0, 7).map((p) => p.id)).toEqual(['udara', 'tribun', 'bola', 'pelari', 'pedagang', 'orbit', 'atas']);
  });

  it('povPose region: pose dunia dari sumber apa adanya (tanpa transform frame stadion)', () => {
    const src = {
      bike, frame: createRegionFrame({ x: 500, z: 0, yaw: 1 }),
      regionPov: () => ({ id: 'r:a', label: 'A', pose: ({ time }) => pose({ tz: 6 + time }) }),
    };
    const out = createPose();
    expect(povPose(POV_BY_ID.region, src, 0, 1, out)).toBe(true);
    expect(out).toEqual({ px: 1, py: 2, pz: 3, tx: 4, ty: 5, tz: 7, fov: POV_BY_ID.region.fov });
    expect(povPose(POV_BY_ID.region, { ...src, regionPov: () => ({ pose: () => pose({ fov: 30 }) }) }, 0, 0, out)).toBe(true);
    expect(out.fov).toBe(30);
  });

  it('povPose region: tanpa POV region atau pose tidak sah → false', () => {
    const out = createPose();
    expect(povPose(POV_BY_ID.region, { bike }, 0, 0, out)).toBe(false);
    expect(povPose(POV_BY_ID.region, { bike, regionPov: () => null }, 0, 0, out)).toBe(false);
    expect(povPose(POV_BY_ID.region, { bike, regionPov: () => ({ pose: () => null }) }, 0, 0, out)).toBe(false);
    expect(povPose(POV_BY_ID.region, { bike, regionPov: () => ({ pose: () => pose({ py: Number.NaN }) }) }, 0, 0, out)).toBe(false);
  });

  it('povSource: POV dari region aktif (urut pemasangan), indeks melingkar, frame region diteruskan', () => {
    const frame = createRegionFrame({ x: 100, z: 0, yaw: 0 });
    const regions = {
      active: () => [
        { def: { id: 'stadion', povs: [] }, frame: IDENTITY_FRAME },
        { def: { id: 'uji', povs: [{ id: 'a', label: 'A', pose: (f) => pose({ px: f.toWorld(0, 0).x }) }, { id: 'b', label: 'B', pose: () => pose() }] }, frame },
      ],
    };
    const ents = { bike: { state: { x: 0, z: 0, yaw: 0 } } };
    const src = createPovSource(ents, IDENTITY_FRAME, { regions });
    expect(src.regionPovCount()).toBe(2);
    const a = src.regionPov(2); // melingkar ke indeks 0
    expect([a.id, a.label]).toEqual(['uji:a', 'A']);
    expect(a.pose({ time: 0, bike: src.bike }).px).toBe(100);
    expect(src.regionPov(1).label).toBe('B');
    const lone = createPovSource(ents);
    expect(lone.regionPovCount()).toBe(0);
    expect(lone.regionPov(0)).toBeNull();
  });

  it('PovDirector: label POV region = label POV subjek; pindah subjek mengganti label', () => {
    const d = new PovDirector(new PerspectiveCamera(60, 16 / 9, 0.3, 2500));
    expect(d.label).toBeNull();
    const list = [{ label: 'A', pose: () => pose() }, { label: 'B', pose: () => pose({ px: 50 }) }];
    const src = { bike, regionPov: (i) => list[i % 2] };
    expect(d.enter(POV_BY_ID.region, src, 0)).toBe(true);
    expect(d.label).toBe('A');
    d.setSubject(1);
    expect(d.label).toBe('B');
    d.exit({ instant: true });
    expect(d.label).toBeNull();
  });
});
