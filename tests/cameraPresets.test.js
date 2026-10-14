import { describe, it, expect } from 'vitest';
import { STADIUM } from '../src/config/constants.js';
import {
  POVS, POV_BY_ID, POV_BY_KEY, applyOrbit, bezier3, copyPose, createPose, easeInOutCubic,
  inStadiumSpace, povPose, routeControl, smoothPose, transitionDuration, tribuneSeat,
} from '../src/core/cameraPresets.js';

const OPEN_A = STADIUM.innerSemiX + STADIUM.roofOpeningPad;
const OPEN_B = STADIUM.innerSemiZ + STADIUM.roofOpeningPad;
const inEllipse = (x, z, a, b) => (x / a) ** 2 + (z / b) ** 2 < 1;
/** Titik di atas/di bawah cincin atap: di dalam jejak cangkang tetapi di luar bukaan atap. */
const inRoofRing = (x, z) => inEllipse(x, z, STADIUM.outerSemiX, STADIUM.outerSemiZ) && !inEllipse(x, z, OPEN_A, OPEN_B);

const src = {
  bike: { x: 0, z: -190, yaw: 0 },
  ball: () => ({ x: 4, z: -6 }),
  runner: (i) => (i < 8 ? { x: 36.8, z: 10, yaw: -Math.PI / 2 } : null),
  vendor: (i) => (i < 6 ? { x: -20, z: -188, yaw: 1 } : null),
};

function poseOf(id, time = 0, subject = 0) {
  const p = createPose();
  expect(povPose(POV_BY_ID[id], src, subject, time, p)).toBe(true);
  return p;
}

const playerThird = () => ({ px: 0, py: 3.7, pz: -196, tx: 0, ty: 1.3, tz: -190, fov: 60 });

describe('definisi POV', () => {
  it('id & tombol unik; hanya Top-down yang mengendalikan sepeda', () => {
    expect(new Set(POVS.map((p) => p.id)).size).toBe(POVS.length);
    expect(new Set(POVS.map((p) => p.key)).size).toBe(POVS.length);
    expect(POVS.filter((p) => p.controlsBike).map((p) => p.id)).toEqual(['atas']);
    expect(POV_BY_KEY.Digit1.id).toBe('udara');
  });
  it('definisi beku (immutable)', () => {
    expect(Object.isFrozen(POVS)).toBe(true);
    expect(Object.isFrozen(POVS[0])).toBe(true);
  });
});

describe('pose POV', () => {
  it('Udara: di atas atap dan di luar jejak cangkang, memandang ke pusat stadion', () => {
    const p = poseOf('udara');
    expect(p.py).toBeGreaterThan(STADIUM.roofHeight + 60);
    expect(inEllipse(p.px, p.pz, STADIUM.outerSemiX, STADIUM.outerSemiZ)).toBe(false);
    expect(inEllipse(p.tx, p.tz, STADIUM.innerSemiX, STADIUM.innerSemiZ)).toBe(true);
  });
  it('Tribun: di kursi tribun bawah (di dalam ruang stadion, tinggi mata wajar)', () => {
    const p = poseOf('tribun');
    expect(inStadiumSpace(p.px, p.py, p.pz)).toBe(true);
    expect(p.py).toBeGreaterThan(3);
    expect(p.py).toBeLessThan(15);
    expect(p.px).toBeLessThan(0); // sisi barat (VIP)
  });
  it('tribuneSeat memakai konstanta tribun', () => {
    const out = { x: 0, y: 0, z: 0 };
    tribuneSeat(0, Math.PI, 0, out);
    expect(out.x).toBeCloseTo(-(STADIUM.innerSemiX + 0.45), 5);
    expect(out.y).toBeCloseTo(STADIUM.rowRise, 5);
  });
  it('Bola mengikuti bola; Pelari di belakang pelari; Pedagang menghadap pedagang', () => {
    const b = poseOf('bola');
    expect([b.tx, b.tz]).toEqual([4, -6]);
    const r = poseOf('pelari');
    const dir = [Math.sin(-Math.PI / 2), Math.cos(-Math.PI / 2)];
    const toCam = [r.px - 36.8, r.pz - 10];
    expect(toCam[0] * dir[0] + toCam[1] * dir[1]).toBeLessThan(0); // kamera di belakang arah lari
    const v = poseOf('pedagang');
    expect([v.tx, v.tz]).toEqual([-20, -188]);
    expect(Math.hypot(v.px - v.tx, v.pz - v.tz)).toBeGreaterThan(3);
  });
  it('Top-down tepat di atas sepeda; Orbit berputar seiring waktu', () => {
    const t = poseOf('atas');
    expect(t.px).toBe(src.bike.x);
    expect(t.py).toBeGreaterThan(40);
    const o0 = poseOf('orbit', 0);
    const o1 = poseOf('orbit', 10);
    expect(Math.hypot(o1.px - o0.px, o1.pz - o0.pz)).toBeGreaterThan(10);
    expect(o1.py).toBe(o0.py);
  });
  it('subjek tidak tersedia → povPose false dan pose tidak diubah', () => {
    const p = createPose();
    p.px = 123;
    expect(povPose(POV_BY_ID.pelari, src, 99, 0, p)).toBe(false);
    expect(p.px).toBe(123);
  });
});

describe('orbit pengguna', () => {
  it('yaw memutar posisi tanpa mengubah jarak; zoom menskalakan jarak', () => {
    const p = poseOf('udara');
    const dist = Math.hypot(p.px - p.tx, p.py - p.ty, p.pz - p.tz);
    const q = copyPose(createPose(), p);
    applyOrbit(q, POV_BY_ID.udara, 1.0, 0, 1);
    expect(Math.hypot(q.px - q.tx, q.py - q.ty, q.pz - q.tz)).toBeCloseTo(dist, 4);
    expect(q.px).not.toBeCloseTo(p.px, 1);
    const z = copyPose(createPose(), p);
    applyOrbit(z, POV_BY_ID.udara, 0, 0, 0.5);
    expect(Math.hypot(z.px - z.tx, z.py - z.ty, z.pz - z.tz)).toBeCloseTo(dist * 0.5, 4);
  });
  it('elevasi dibatasi per POV', () => {
    const q = poseOf('udara');
    applyOrbit(q, POV_BY_ID.udara, 0, 5, 1);
    const flat = Math.hypot(q.px - q.tx, q.pz - q.tz);
    expect(Math.atan2(q.py - q.ty, flat)).toBeLessThanOrEqual(POV_BY_ID.udara.maxElev + 1e-6);
  });
});

describe('transisi', () => {
  it('easing: ujung tepat, monotonik', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    let prev = 0;
    for (let i = 1; i <= 100; i += 1) {
      const v = easeInOutCubic(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it('durasi dibatasi 1,2–3,2 detik', () => {
    const a = createPose();
    const b = copyPose(createPose(), a);
    expect(transitionDuration(a, b)).toBeCloseTo(1.2, 5);
    b.px = 5000;
    expect(transitionDuration(a, b)).toBe(3.2);
  });
  it('smoothing menuju target tanpa overshoot', () => {
    const a = createPose();
    const b = copyPose(createPose(), a);
    b.px = 100;
    smoothPose(a, b, 5, 0.1);
    expect(a.px).toBeGreaterThan(0);
    expect(a.px).toBeLessThan(100);
  });

  const waypoints = () => ({
    plaza: playerThird(),
    udara: poseOf('udara'),
    tribun: poseOf('tribun'),
    orbit: poseOf('orbit', 0),
    bola: poseOf('bola'),
    pelari: poseOf('pelari'),
    pedagang: poseOf('pedagang'),
    atas: poseOf('atas'),
  });

  it('rute antar semua pasangan POV tidak menembus cincin atap (kecuali ujung tujuan)', () => {
    const pts = waypoints();
    const c1 = { x: 0, y: 0, z: 0 };
    const c2 = { x: 0, y: 0, z: 0 };
    const out = { x: 0, y: 0, z: 0 };
    const clearY = STADIUM.roofHeight + 3;
    for (const [an, a] of Object.entries(pts)) {
      for (const [dn, d] of Object.entries(pts)) {
        if (an === dn) continue;
        routeControl(a, d, c1, c2);
        for (let i = 0; i <= 200; i += 1) {
          const t = i / 200;
          bezier3(a, c1, c2, d, t, out);
          // Ujung rute boleh di bawah atap bila memang di sana (mis. kursi tribun di bawah tepi atap)
          const nearEnds = Math.hypot(out.x - a.px, out.y - a.py, out.z - a.pz) < 12
            || Math.hypot(out.x - d.px, out.y - d.py, out.z - d.pz) < 12;
          if (!nearEnds && inRoofRing(out.x, out.z)) {
            expect(out.y, `${an} → ${dn} pada t=${t}`).toBeGreaterThan(clearY);
          }
        }
      }
    }
  });

  it('ujung rute tepat di pose asal dan tujuan', () => {
    const a = poseOf('udara');
    const d = poseOf('tribun');
    const c1 = { x: 0, y: 0, z: 0 };
    const c2 = { x: 0, y: 0, z: 0 };
    const out = { x: 0, y: 0, z: 0 };
    routeControl(a, d, c1, c2);
    bezier3(a, c1, c2, d, 0, out);
    expect([out.x, out.y, out.z]).toEqual([a.px, a.py, a.pz]);
    bezier3(a, c1, c2, d, 1, out);
    expect([out.x, out.y, out.z]).toEqual([d.px, d.py, d.pz]);
  });
});
