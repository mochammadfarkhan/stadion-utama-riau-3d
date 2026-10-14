import { describe, it, expect } from 'vitest';
import { VENDOR_CATALOG, createVendor, stepVendor, createWallet, buy } from '../src/sim/vendorSim.js';
import { deepFreeze, hasNaN } from './helpers.js';

describe('VENDOR_CATALOG', () => {
  it('berisi minuman dan buah dengan harga sesuai', () => {
    const price = (kind, id) => VENDOR_CATALOG[kind].find((i) => i.id === id).price;
    expect(price('minuman', 'es-teh')).toBe(5000);
    expect(price('minuman', 'es-jeruk')).toBe(7000);
    expect(price('minuman', 'air-mineral')).toBe(4000);
    expect(price('minuman', 'kopi')).toBe(8000);
    expect(price('buah', 'buah-potong')).toBe(10000);
    expect(price('buah', 'jeruk')).toBe(15000);
    expect(price('buah', 'rujak')).toBe(12000);
    VENDOR_CATALOG.minuman.concat(VENDOR_CATALOG.buah).forEach((i) => {
      expect(typeof i.name).toBe('string');
      expect(i.price).toBeGreaterThan(0);
    });
  });
});

describe('createVendor / stepVendor', () => {
  const wps = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }];
  it('mulai di waypoint pertama, state WALK, target waypoint berikutnya', () => {
    const v = createVendor({ id: 'v1', kind: 'minuman', waypoints: wps });
    expect(v.pos).toEqual({ x: 0, z: 0 });
    expect(v.state).toBe('WALK');
    expect(v.target).toEqual({ x: 10, z: 0 });
    expect(v.speed).toBe(0.8);
    expect(v.dwell).toBe(6);
    expect(typeof v.yaw).toBe('number');
  });
  it('berjalan ke target dengan kecepatan speed dan yaw menghadap target', () => {
    const v = createVendor({ id: 'v1', kind: 'minuman', waypoints: wps, speed: 2 });
    const n = stepVendor(v, 1);
    expect(n.pos.x).toBeCloseTo(2, 6);
    expect(n.pos.z).toBeCloseTo(0, 6);
    expect(n.yaw).toBeCloseTo(Math.atan2(1, 0), 6);
  });
  it('sampai target → DWELL selama dwell detik lalu WALK ke waypoint berikutnya', () => {
    let v = createVendor({ id: 'v1', kind: 'buah', waypoints: wps, speed: 5, dwell: 2 });
    v = stepVendor(v, 3); // 15 m > 10 m → sampai
    expect(v.state).toBe('DWELL');
    expect(v.pos).toEqual({ x: 10, z: 0 });
    v = stepVendor(v, 1);
    expect(v.state).toBe('DWELL');
    v = stepVendor(v, 1.5);
    expect(v.state).toBe('WALK');
    expect(v.target).toEqual({ x: 10, z: 10 });
  });
  it('siklus kembali ke waypoint pertama', () => {
    let v = createVendor({ id: 'v1', kind: 'buah', waypoints: wps, speed: 100, dwell: 0.1 });
    for (let i = 0; i < 20; i += 1) v = stepVendor(v, 0.2);
    expect(wps.some((w) => w.x === v.target.x && w.z === v.target.z)).toBe(true);
    expect(hasNaN(v)).toBe(false);
  });
  it('waypoint tunggal / kosong tetap aman', () => {
    const single = stepVendor(createVendor({ id: 's', kind: 'minuman', waypoints: [{ x: 3, z: 4 }] }), 1);
    expect(single.pos).toEqual({ x: 3, z: 4 });
    expect(hasNaN(single)).toBe(false);
    const none = stepVendor(createVendor({ id: 'n', kind: 'minuman', waypoints: [] }), 1);
    expect(hasNaN(none)).toBe(false);
  });
  it('immutability & dt tidak valid', () => {
    const frozenWps = deepFreeze(wps.map((w) => ({ ...w })));
    const v = deepFreeze(createVendor({ id: 'v1', kind: 'minuman', waypoints: frozenWps }));
    const n = stepVendor(v, 0.5);
    expect(n).not.toBe(v);
    expect(v.pos).toEqual({ x: 0, z: 0 });
    expect(hasNaN(stepVendor(v, NaN))).toBe(false);
    expect(stepVendor(v, 0).pos).toEqual({ x: 0, z: 0 });
  });
});

describe('wallet', () => {
  it('createWallet default 50000 tanpa item', () => {
    expect(createWallet()).toEqual({ balance: 50000, items: [] });
    expect(createWallet(1000).balance).toBe(1000);
  });
  it('beli sukses mengurangi saldo dan menambah item', () => {
    const w = deepFreeze(createWallet());
    const r = buy(w, 'minuman', 'es-teh');
    expect(r.ok).toBe(true);
    expect(r.wallet.balance).toBe(45000);
    expect(r.wallet.items).toHaveLength(1);
    expect(r.item).toMatchObject({ id: 'es-teh', price: 5000, kind: 'minuman' });
    expect(w.balance).toBe(50000);
    expect(w.items).toHaveLength(0);
  });
  it('saldo tidak cukup → ok false, saldo tetap, tidak negatif', () => {
    const r = buy(createWallet(3000), 'buah', 'jeruk');
    expect(r.ok).toBe(false);
    expect(r.wallet.balance).toBe(3000);
    expect(typeof r.error).toBe('string');
  });
  it('item / kind tidak ada → error', () => {
    expect(buy(createWallet(), 'minuman', 'durian').ok).toBe(false);
    expect(buy(createWallet(), 'sayur', 'es-teh').ok).toBe(false);
    expect(buy(createWallet(), 'minuman', 'durian').wallet.balance).toBe(50000);
  });
  it('saldo tepat pas boleh dibeli dan tidak pernah negatif', () => {
    const r = buy(createWallet(5000), 'minuman', 'es-teh');
    expect(r.ok).toBe(true);
    expect(r.wallet.balance).toBe(0);
    expect(buy(r.wallet, 'minuman', 'air-mineral').wallet.balance).toBe(0);
  });
  it('wallet tidak valid → aman', () => {
    const r = buy(null, 'minuman', 'es-teh');
    expect(r.ok).toBe(false);
    expect(r.wallet.balance).toBe(0);
  });
});

describe('consumeItem & credit', () => {
  it('mengeluarkan satu item dan tidak memutasi dompet', async () => {
    const { createWallet, buy, consumeItem, credit } = await import('../src/sim/vendorSim.js');
    const w = buy(buy(createWallet(50000), 'minuman', 'es-teh').wallet, 'minuman', 'es-teh').wallet;
    const r = consumeItem(w, 'es-teh');
    expect(r.ok).toBe(true);
    expect(r.wallet.items).toHaveLength(1);
    expect(w.items).toHaveLength(2);
    expect(consumeItem(createWallet(0), 'es-teh').ok).toBe(false);
    expect(credit(w, 500).balance).toBe(w.balance + 500);
    expect(credit(w, -5).balance).toBe(w.balance);
  });
});
