import { describe, it, expect } from 'vitest';
import { createFarm, actOn, plow, growFarm, nextAction, farmToJson, farmFromJson, stepOnFoot } from '../src/sim/farm.js';
import { KEBUN, tileIndexAt, tileCenter, houseRing, WALK } from '../src/config/kebun.js';

const opts = { balance: 10000, seedPrice: 1000, price: 6000 };

describe('farm: siklus cangkul → tanam → siram → tumbuh → panen', () => {
  it('urutan aksi E dan uang', () => {
    let f = createFarm(4);
    const seq = [];
    let money = 0;
    const act = () => {
      const r = actOn(f, 1, opts);
      seq.push(r.action);
      money += r.earn - r.cost;
      f = r.farm;
    };
    act(); act(); act(); // cangkul, tanam, siram
    expect(nextAction(f.tiles[1])).toBe('tunggu');
    f = growFarm(f, 3, 3); // tahap 2, kering lagi
    expect(f.tiles[1].crop.stage).toBe(2);
    act(); f = growFarm(f, 1.5, 3); f = growFarm(f, 1.5, 3); // siram, tumbuh ke 3
    expect(nextAction(f.tiles[1])).toBe('panen');
    act();
    expect(seq).toEqual(['cangkul', 'tanam', 'siram', 'siram', 'panen']);
    expect(money).toBe(5000);
    expect(f.tiles[1]).toMatchObject({ tilled: true, crop: null });
    expect(f.tiles[0]).toMatchObject({ tilled: false, crop: null }); // petak lain tidak tersentuh
  });

  it('tanpa siram tidak tumbuh; uang kurang menolak tanam; immutable', () => {
    const f0 = plow(createFarm(1), 0);
    const r = actOn(f0, 0, { ...opts, balance: 500 });
    expect(r.error).toBeTruthy();
    expect(r.farm).toBe(f0);
    const f1 = actOn(f0, 0, opts).farm;
    expect(growFarm(f1, 10, 3)).toBe(f1);
    expect(f0.tiles[0].crop).toBeNull();
    expect(() => { f1.tiles[0].tilled = false; }).toThrow();
  });

  it('JSON pulang-pergi & data rusak → kebun baru', () => {
    let f = actOn(plow(createFarm(3), 2), 2, opts).farm;
    f = actOn(f, 2, opts).farm;
    const back = farmFromJson(farmToJson(f), 3);
    expect(back.tiles[2]).toMatchObject({ tilled: true, watered: true, crop: { stage: 1 } });
    expect(farmFromJson('{bukan json', 3).tiles).toHaveLength(3);
    expect(farmFromJson('[[1,1,9,0]]', 1).tiles[0].crop).toBeNull();
    expect(farmFromJson('[]', 3).tiles).toHaveLength(3);
  });
});

describe('kebun: geometri lahan', () => {
  it('indeks petak dan pusatnya konsisten', () => {
    const c = tileCenter(3, 2);
    expect(tileIndexAt(c.x, c.z)).toBe(2 * KEBUN.cols + 3);
    expect(tileIndexAt(KEBUN.origin.x - 0.1, KEBUN.origin.z)).toBe(-1);
  });

  it('rumah (menghadap timur) tidak menimpa petak dan teras di sisi timur', () => {
    const ring = houseRing();
    const xs = ring.map((p) => p[0]);
    const zs = ring.map((p) => p[1]);
    expect(Math.min(...zs)).toBeGreaterThan(KEBUN.origin.z + KEBUN.rows * KEBUN.tile);
    expect(Math.max(...xs)).toBeCloseTo(KEBUN.house.x + KEBUN.house.d / 2 + KEBUN.house.porch);
  });
});

describe('stepOnFoot', () => {
  it('putar di tempat, maju ke arah hadap, lari dengan Shift', () => {
    let s = { x: 0, z: 0, yaw: 0, v: 0 };
    s = stepOnFoot(s, { pedal: 0, steer: 1, sprint: false }, 0.5, WALK);
    expect(s.yaw).toBeCloseTo(WALK.turnRate * 0.5);
    expect(s.x).toBe(0);
    s = { x: 0, z: 0, yaw: 0, v: 0 };
    for (let i = 0; i < 60; i += 1) s = stepOnFoot(s, { pedal: 1, steer: 0, sprint: true }, 0.05, WALK);
    expect(s.v).toBeCloseTo(WALK.run);
    expect(s.z).toBeGreaterThan(5);
  });
});
