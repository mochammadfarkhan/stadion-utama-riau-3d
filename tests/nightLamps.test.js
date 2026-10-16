import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNightLights } from '../src/world/TimeOfDay.lights.js';
import { floodSpotsLocal, litLampPositions, stadionNightLights } from '../src/regions/stadion/lamps.js';
import { LAYOUT } from '../src/regions/stadion/layout.js';
import { toWorld } from '../src/geo/regionTransform.js';

const FLOOD = { x: 10, y: 40, z: -20, tx: -2, ty: 0, tz: 5 };

describe('TimeOfDay.lights: registerLamps (M3)', () => {
  it('set lampu menempel ke grup pemilik; pencabut melepas kolam & sorot (idempoten)', () => {
    const parent = new THREE.Group();
    const night = createNightLights(parent);
    expect(parent.getObjectByName('lampuSepeda')).toBeTruthy();
    expect(parent.getObjectByName('kolamCahayaPJU')).toBeUndefined();
    const off = night.registerLamps({ lamps: [{ x: 1, z: 2 }, { x: 3, z: 4 }], floods: [FLOOD] });
    expect(night.lampCount).toBe(2);
    const pools = parent.getObjectByName('kolamCahayaPJU');
    expect(pools.count).toBe(2);
    const spot = parent.getObjectByName('floodlightSorot-0');
    expect(spot.position.toArray()).toEqual([10, 40, -20]);
    expect(spot.target.position.toArray()).toEqual([-2, 0, 5]);
    expect(off()).toBe(true);
    expect(off()).toBe(false);
    expect(night.lampCount).toBe(0);
    expect(parent.getObjectByName('kolamCahayaPJU')).toBeUndefined();
    expect(parent.getObjectByName('floodlightSorot-0')).toBeUndefined();
  });

  it('PointLight memilih PJU terdekat dari gabungan semua set; set yang dicabut tidak dipilih lagi', () => {
    const parent = new THREE.Group();
    const night = createNightLights(parent);
    night.registerLamps({ lamps: [{ x: 500, z: 500 }] });
    const offNear = night.registerLamps({ lamps: [{ x: 5, z: 0 }] });
    night.setLampsOn(true);
    night.update(0.1, { x: 0, z: 0 }, 0);
    const active = () => parent.children.filter((o) => o.isPointLight && o.userData.active).map((o) => o.position.x);
    expect(active()).toEqual([5]);
    offNear();
    night.update(0.1, { x: 0, z: 0 }, 0);
    expect(active()).toEqual([]);
  });

  it('dispose melepas semua set dan registrasi emissive', () => {
    const parent = new THREE.Group();
    const night = createNightLights(parent);
    night.registerLamps({ lamps: [{ x: 0, z: 0 }], floods: [FLOOD] });
    night.dispose();
    expect(night.lampCount).toBe(0);
    expect(parent.getObjectByName('floodlightSorot-0')).toBeUndefined();
  });
});

describe('region stadion: data lampu malam dalam koordinat dunia', () => {
  it('placement identitas = posisi lokal; empat sorot di sudut atap', () => {
    const { lamps, floods } = stadionNightLights(LAYOUT, { x: 0, z: 0, yaw: 0 });
    expect(lamps).toEqual(litLampPositions(LAYOUT));
    expect(floods).toEqual(floodSpotsLocal());
    expect(floods).toHaveLength(4);
  });

  it('placement non-identitas memindahkan PJU dan sorot (posisi + bidik) ke frame dunia', () => {
    const p = { x: 100, z: -50, yaw: 0.3 };
    const { lamps, floods } = stadionNightLights(LAYOUT, p);
    const local = litLampPositions(LAYOUT);
    const w = toWorld(p, local[0].x, local[0].z);
    expect(lamps[0].x).toBeCloseTo(w.x, 9);
    expect(lamps[0].z).toBeCloseTo(w.z, 9);
    const f = floodSpotsLocal()[0];
    const fw = toWorld(p, f.x, f.z);
    const tw = toWorld(p, f.tx, f.tz);
    expect([floods[0].x, floods[0].y, floods[0].z]).toEqual([fw.x, f.y, fw.z]);
    expect([floods[0].tx, floods[0].tz]).toEqual([tw.x, tw.z]);
  });
});
