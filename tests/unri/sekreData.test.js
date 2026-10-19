import { describe, it, expect } from 'vitest';
import {
  sekreRooms, validateSekreRooms, SEKRE_ORMAWA, BEM, DPM, PLAYER_ROOM_INDEX,
} from '../../src/regions/unri-lembaga/sekre.data.js';

describe('deret Sekretariat Lembaga Mahasiswa', () => {
  it('default valid: 8 ruang, BEM indeks 0, DPM indeks 4, pemain indeks 1 di sebelah BEM', () => {
    const rooms = sekreRooms();
    expect(validateSekreRooms(rooms)).toEqual([]);
    expect(rooms).toHaveLength(8);
    expect(rooms[0].nama).toBe('BEM UNIVERSITAS RIAU');
    expect(rooms[4].nama).toBe('DPM');
    expect(PLAYER_ROOM_INDEX).toBe(1);
    expect(rooms[1].pemain).toBe(true);
    expect(rooms.filter((r) => r.pemain)).toHaveLength(1);
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

  it('pemain tidak bersebelahan dengan BEM → galat', () => {
    const errs = validateSekreRooms(sekreRooms({ player: 3 }));
    expect(errs.join(' ')).toMatch(/bersebelahan/);
  });

  it('dua ruang pemain → galat; ormawa kurang → ruang kosong', () => {
    const dua = SEKRE_ORMAWA.map((o, i) => (i === 2 ? { ...o, pemain: true } : o));
    expect(validateSekreRooms(sekreRooms({ ormawa: dua })).join(' ')).toMatch(/pemain/);
    expect(validateSekreRooms(sekreRooms({ ormawa: SEKRE_ORMAWA.slice(0, 5) })).join(' ')).toMatch(/kosong/);
  });
});
