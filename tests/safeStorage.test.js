import { describe, it, expect } from 'vitest';
import { safeLocalStorage } from '../src/settings/safeStorage.js';

const storage = (overrides = {}) => {
  const data = new Map([['k', 'v']]);
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k), ...overrides };
};

describe('safeLocalStorage', () => {
  it('null bila localStorage tidak ada atau getter melempar', () => {
    expect(safeLocalStorage(null)).toBeNull();
    expect(safeLocalStorage({ get localStorage() { throw new Error('denied'); } })).toBeNull();
  });
  it('kuota penuh (setItem melempar) tetap mengembalikan storage agar data lama terbaca', () => {
    const ls = storage({ setItem: () => { throw new Error('QuotaExceededError'); } });
    expect(safeLocalStorage({ localStorage: ls })).toBe(ls);
  });
  it('akses baca ditolak -> null', () => {
    const ls = storage({ getItem: () => { throw new Error('denied'); } });
    expect(safeLocalStorage({ localStorage: ls })).toBeNull();
  });
});
