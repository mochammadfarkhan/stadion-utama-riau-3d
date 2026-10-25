import { describe, it, expect } from 'vitest';
import { createFarm, actOn, plow, growFarm, nextAction, farmToJson, farmFromJson, stepOnFoot } from '../src/sim/farm.js';
import { KEBUN, CROPS, CROP_ORDER, tileIndexAt, tileCenter, houseRing, WALK } from '../src/config/kebun.js';

const opts = (seed, balance = 100000) => ({ balance, seed, crops: CROPS });
const sleep = (f) => growFarm(f, KEBUN.sleepHours, CROPS);

/** Tanam `seed` di petak 0 lalu siram + tidur sampai bisa dipanen; kembalikan {farm, nights}. */
function growToHarvest(f0, seed) {
  let f = actOn(actOn(f0, 0, opts(seed)).farm, 0, opts(seed)).farm; // cangkul/tanam (atau tanam bila sudah tercangkul)
  if (nextAction(f.tiles[0]) === 'tanam') f = actOn(f, 0, opts(seed)).farm;
  let nights = 0;
  while (nextAction(f.tiles[0]) !== 'panen' && nights < 20) {
    if (nextAction(f.tiles[0]) === 'siram') f = actOn(f, 0, opts(seed)).farm;
    f = sleep(f);
    nights += 1;
  }
  return { farm: f, nights };
}

describe('farm: siklus cangkul → tanam → siram → tumbuh → panen', () => {
  it('urutan aksi E, uang, dan petak lain tidak tersentuh', () => {
    let f = createFarm(4);
    const seq = [];
    let money = 0;
    const act = () => {
      const r = actOn(f, 1, opts('cabai'));
      seq.push(r.action);
      money += r.earn - r.cost;
      f = r.farm;
    };
    act(); act(); act(); // cangkul, tanam, siram
    expect(nextAction(f.tiles[1])).toBe('tunggu');
    f = growFarm(f, 3, CROPS); // tahap 2, kering lagi
    expect(f.tiles[1].crop).toMatchObject({ type: 'cabai', stage: 2 });
    act(); f = growFarm(f, 1.5, CROPS); f = growFarm(f, 1.5, CROPS); // siram, tumbuh ke 3
    expect(nextAction(f.tiles[1])).toBe('panen');
    act();
    expect(seq).toEqual(['cangkul', 'tanam', 'siram', 'siram', 'panen']);
    expect(money).toBe(CROPS.cabai.price - CROPS.cabai.seed);
    expect(f.tiles[1]).toMatchObject({ tilled: true, crop: null });
    expect(f.tiles[0]).toMatchObject({ tilled: false, crop: null });
  });

  it('tanpa siram tidak tumbuh; uang kurang / jenis asing menolak tanam; immutable', () => {
    const f0 = plow(createFarm(1), 0);
    expect(actOn(f0, 0, opts('cabai', 500)).error).toBeTruthy();
    expect(actOn(f0, 0, opts('kentang')).error).toBeTruthy();
    const f1 = actOn(f0, 0, opts('cabai')).farm;
    expect(growFarm(f1, 10, CROPS)).toBe(f1);
    expect(f0.tiles[0].crop).toBeNull();
    expect(() => { f1.tiles[0].tilled = false; }).toThrow();
  });
});

describe('farm: jenis tanaman berbeda', () => {
  it('cabai & terong siap dalam 2 malam, jagung 4 malam (8 jam/tahap > 6 jam tidur)', () => {
    expect(growToHarvest(createFarm(1), 'cabai').nights).toBe(2);
    expect(growToHarvest(createFarm(1), 'terong').nights).toBe(2);
    expect(growToHarvest(createFarm(1), 'jagung').nights).toBe(4);
  });

  it('terong tumbuh lagi ke tahap 2 setelah dipanen; jagung harus tanam ulang', () => {
    const t = actOn(growToHarvest(createFarm(1), 'terong').farm, 0, opts('terong'));
    expect(t.earn).toBe(CROPS.terong.price);
    expect(t.farm.tiles[0].crop).toMatchObject({ type: 'terong', stage: 2 });
    const j = actOn(growToHarvest(createFarm(1), 'jagung').farm, 0, opts('jagung'));
    expect(j.earn).toBe(CROPS.jagung.price);
    expect(nextAction(j.farm.tiles[0])).toBe('tanam');
  });

  it('jam tidur berlebih tidak melompati tahap', () => {
    let f = actOn(plow(createFarm(1), 0), 0, opts('terong')).farm;
    f = actOn(f, 0, opts('terong')).farm;
    expect(growFarm(f, 100, CROPS).tiles[0].crop.stage).toBe(2);
  });
});

describe('farm: simpanan JSON', () => {
  it('pulang-pergi menjaga jenis; data rusak → kebun baru; simpanan lama 4 kolom = cabai', () => {
    let f = actOn(plow(createFarm(3), 2), 2, opts('jagung')).farm;
    f = actOn(f, 2, opts('jagung')).farm;
    const back = farmFromJson(farmToJson(f, CROP_ORDER), 3, CROP_ORDER);
    expect(back.tiles[2]).toMatchObject({ tilled: true, watered: true, crop: { type: 'jagung', stage: 1 } });
    expect(farmFromJson('{bukan json', 3, CROP_ORDER).tiles).toHaveLength(3);
    expect(farmFromJson('[[1,1,9,0]]', 1, CROP_ORDER).tiles[0].crop).toBeNull();
    expect(farmFromJson('[[1,0,2,0]]', 1, CROP_ORDER).tiles[0].crop).toMatchObject({ type: 'cabai', stage: 2 });
    expect(farmFromJson('[[1,0,2,0,99]]', 1, CROP_ORDER).tiles[0].crop.type).toBe('cabai');
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

  it('setiap jenis di CROP_ORDER punya data', () => {
    for (const t of CROP_ORDER) expect(CROPS[t]).toMatchObject({ seed: expect.any(Number), price: expect.any(Number), growHours: expect.any(Number) });
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
