import { describe, it, expect } from 'vitest';
import { fundsShortfall, priceOf } from '../src/story/funds.js';

const wallet = (balance, items = []) => ({ balance, items: items.map((id) => ({ id })) });

describe('priceOf', () => {
  it('harga dari katalog; item tak dikenal -> null', () => {
    expect(priceOf('es-teh')).toBe(5000);
    expect(priceOf('rujak')).toBe(12000);
    expect(priceOf('tidak-ada')).toBeNull();
  });
});

describe('fundsShortfall', () => {
  const buyTea = { type: 'buy', itemId: 'es-teh' };
  const deliverTea = { type: 'deliver', npcId: 'satpam', itemId: 'es-teh' };

  it('0 bila saldo cukup', () => {
    expect(fundsShortfall(buyTea, wallet(5000))).toBe(0);
    expect(fundsShortfall(buyTea, wallet(50000))).toBe(0);
  });
  it('selisih harga bila saldo kurang (langkah beli)', () => {
    expect(fundsShortfall(buyTea, wallet(1000))).toBe(4000);
    expect(fundsShortfall({ type: 'buy', itemId: 'rujak' }, wallet(0))).toBe(12000);
  });
  it('langkah antar: tanpa barang dan tanpa uang -> kekurangan; sudah bawa barang -> 0', () => {
    expect(fundsShortfall(deliverTea, wallet(0))).toBe(5000);
    expect(fundsShortfall(deliverTea, wallet(0, ['es-teh']))).toBe(0);
  });
  it('objective lain atau data rusak -> 0 (tanpa melempar)', () => {
    expect(fundsShortfall({ type: 'laps', count: 3 }, wallet(0))).toBe(0);
    expect(fundsShortfall(null, wallet(0))).toBe(0);
    expect(fundsShortfall(buyTea, null)).toBe(0);
    expect(fundsShortfall({ type: 'buy', itemId: 'x' }, wallet(0))).toBe(0);
    expect(fundsShortfall(buyTea, { balance: Number.NaN, items: [] })).toBe(5000);
  });
});
