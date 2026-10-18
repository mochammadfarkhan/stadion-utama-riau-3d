import { describe, it, expect } from 'vitest';
import { createEggState, stepEggs, GGM_RING } from '../src/story/eggTriggers.js';
import { EASTER_EGGS } from '../src/story/easterEggs.js';
import { STORY_NPCS, TUGU } from '../src/story/chapters.js';

const satpam = STORY_NPCS.find((n) => n.id === 'satpam');
const base = { time: 0, dt: 0.1, pos: { x: 500, z: 500 }, hour: 12, raining: false, bell: false, bought: null };
const step = (s, ctx, known = []) => stepEggs(s, { ...base, ...ctx }, EASTER_EGGS, known);

describe('eggTriggers', () => {
  it('petunjuk berbasis jarak', () => {
    const jejak = EASTER_EGGS.find((e) => e.id === 'jejak-2');
    const r = step(createEggState(), { pos: { x: jejak.at.x, z: jejak.at.z } });
    expect(r.ids).toContain('jejak-2');
    expect(step(createEggState(), { pos: { x: jejak.at.x, z: jejak.at.z } }, ['jejak-2']).ids).not.toContain('jejak-2');
  });
  it('bel 3x dalam 4 detik dekat satpam', () => {
    let s = createEggState();
    let ids = [];
    [0, 1, 2].forEach((t) => { ({ state: s, ids } = step(s, { time: t, pos: { x: satpam.x, z: satpam.z + 3 }, bell: true })); });
    expect(ids).toContain('bel-satpam');
  });
  it('bel terlalu lambat atau jauh dari satpam tidak memicu', () => {
    let s = createEggState();
    let ids = [];
    [0, 5, 10].forEach((t) => { ({ state: s, ids } = step(s, { time: t, pos: { x: satpam.x, z: satpam.z + 3 }, bell: true })); });
    expect(ids).not.toContain('bel-satpam');
    s = createEggState();
    [0, 1, 2].forEach((t) => { ({ state: s, ids } = step(s, { time: t, bell: true })); });
    expect(ids).not.toContain('bel-satpam');
  });
  it('tengah lapangan tepat tengah malam', () => {
    expect(step(createEggState(), { pos: { x: 3, z: 3 }, hour: 0.02 }).ids).toContain('bola-tengah-malam');
    // jendela ±30 menit (cukup lebar untuk dicapai tanpa mengutak-atik jam)
    expect(step(createEggState(), { pos: { x: 3, z: 3 }, hour: 23.6 }).ids).toContain('bola-tengah-malam');
    expect(step(createEggState(), { pos: { x: 3, z: 3 }, hour: 0.4 }).ids).toContain('bola-tengah-malam');
    expect(step(createEggState(), { pos: { x: 3, z: 3 }, hour: 23.3 }).ids).not.toContain('bola-tengah-malam');
    expect(step(createEggState(), { pos: { x: 3, z: 3 }, hour: 12 }).ids).not.toContain('bola-tengah-malam');
    expect(step(createEggState(), { pos: { x: 90, z: 3 }, hour: 0 }).ids).not.toContain('bola-tengah-malam');
  });
  it('membeli es teh 5x', () => {
    let s = createEggState();
    let ids = [];
    for (let i = 0; i < 5; i += 1) ({ state: s, ids } = step(s, { bought: 'es-teh' }));
    expect(ids).toContain('pelanggan-setia');
  });
  it('berdiri di tugu saat hujan 5 detik; berhenti hujan mengulang hitungan', () => {
    let s = createEggState();
    let ids = [];
    for (let i = 0; i < 52; i += 1) ({ state: s, ids } = step(s, { pos: { x: TUGU.x, z: TUGU.z + 10 }, raining: true }));
    expect(ids).toContain('layar-hujan');
    const reset = step(s, { pos: { x: TUGU.x, z: TUGU.z + 10 }, raining: false });
    expect(reset.state.rainTime).toBe(0);
  });
  it('lambang 1-10-62: berbasis jarak di plang dekat Gerbang Soebrantas', () => {
    const egg = EASTER_EGGS.find((e) => e.id === 'lambang-1-10-62');
    expect(step(createEggState(), { pos: { x: egg.at.x, z: egg.at.z } }).ids).toContain('lambang-1-10-62');
  });
  it('Kampus Biru Langit: 90 detik di kampus saat siang cerah; hujan/keluar kampus mengulang', () => {
    let s = createEggState();
    let ids = [];
    for (let i = 0; i < 8; i += 1) ({ state: s, ids } = step(s, { dt: 10, inCampus: true, hour: 11 }));
    expect(ids).not.toContain('kampus-biru-langit');
    ({ state: s, ids } = step(s, { dt: 10, inCampus: true, hour: 11 }));
    expect(ids).toContain('kampus-biru-langit');
    expect(step(s, { dt: 10, inCampus: true, hour: 11, raining: true }).state.campusTime).toBe(0);
    expect(step(createEggState(), { dt: 100, inCampus: false, hour: 11 }).ids).not.toContain('kampus-biru-langit');
    expect(step(createEggState(), { dt: 100, inCampus: true, hour: 16 }).ids).not.toContain('kampus-biru-langit');
  });
  it('Gasing berputar: satu putaran penuh mengitari GGM di dalam cincin', () => {
    const around = (k, r = 70) => {
      const a = (k / 36) * Math.PI * 2;
      return { pos: { x: GGM_RING.x + Math.cos(a) * r, z: GGM_RING.z + Math.sin(a) * r } };
    };
    let s = createEggState();
    let ids = [];
    for (let k = 0; k <= 37 && !ids.includes('gasing-berputar'); k += 1) ({ state: s, ids } = step(s, around(k)));
    expect(ids).toContain('gasing-berputar');
    let t = createEggState();
    let half = [];
    for (let k = 0; k <= 18; k += 1) ({ state: t, ids: half } = step(t, around(k)));
    expect(half).not.toContain('gasing-berputar');
    expect(step(createEggState(), around(0, 10)).state.ggmLast).toBeNull();
  });
});
