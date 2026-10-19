import { describe, it, expect } from 'vitest';
import {
  sekreRooms, validateSekreRooms, SEKRE_ORMAWA, BEM, DPM,
} from '../../src/regions/unri-lembaga/sekre.data.js';

describe('deret Sekretariat Lembaga Mahasiswa (bukan sekre pemain)', () => {
  it('default valid: 8 ruang, BEM indeks 0, DPM indeks 4, tanpa ruang pemain', () => {
    const rooms = sekreRooms();
    expect(validateSekreRooms(rooms)).toEqual([]);
    expect(rooms).toHaveLength(8);
    expect(rooms[0].nama).toBe('BEM UNIVERSITAS RIAU');
    expect(rooms[4].nama).toBe('DPM');
    expect(rooms.some((r) => r.pemain)).toBe(false);
    expect(rooms.map((r) => r.row)).toEqual(['U', 'U', 'U', 'U', 'S', 'S', 'S', 'S']);
    expect(rooms.map((r) => r.col)).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
  });

  it('6 nama dari data ormawa terpakai tepat sekali, semua nama unik dan kapital', () => {
    const rooms = sekreRooms();
    const names = rooms.map((r) => r.nama);
    expect(new Set(names).size).toBe(8);
    for (const o of SEKRE_ORMAWA) expect(names.filter((n) => n === o.nama)).toHaveLength(1);
    for (const n of names) expect(n).toBe(n.toUpperCase());
    expect([BEM.nama, DPM.nama].every((n) => names.includes(n))).toBe(true);
  });

  it('ormawa kurang → ruang kosong dilaporkan', () => {
    expect(validateSekreRooms(sekreRooms({ ormawa: SEKRE_ORMAWA.slice(0, 5) })).join(' ')).toMatch(/kosong/);
  });
});
