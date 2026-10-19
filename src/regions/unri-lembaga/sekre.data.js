/**
 * Isi deret Sekretariat Lembaga Mahasiswa (way 327530276): 8 ruang, 2 baris × 4. Indeks 0–3 = baris U (NNE,
 * menghadap jogging track) dari barat, 4–7 = baris S. BEM & DPM tetap; 6 ormawa di bawah = DEFAULT GENERIK
 * [INFERENSI] — ganti nama/warna sesuai ormawa asli (spec §13 butir 2). Ruang `pemain: true` = pintu portal
 * interior 'sekre' dan wajib bersebelahan dengan BEM (spec §8.1; "sekre gw dekat BEM").
 * Warna = hex (latar & teks papan nama N06, cat pintu).
 */
export const SEKRE_SUMBER = Object.freeze({
  denah: '[INFERENSI] 2 × 4 ruang dari footprint OSM 16,77 × 15,57 m',
  bem: '[INFERENSI] lokasi sekretariat BEM UNRI tidak ditemukan di sumber (riset §3, GAP); diasumsikan di deret ini',
  ormawa: '[INFERENSI] nama default generik, bukan data UNRI',
});

export const ROOM_COUNT = 8;
export const ROOMS_PER_ROW = 4;
export const BEM_ROOM_INDEX = 0;
export const DPM_ROOM_INDEX = 4;
export const PLAYER_ROOM_INDEX = 1;
const MAX_NAME = 32;

export const BEM = Object.freeze({ nama: 'BEM UNIVERSITAS RIAU', sub: 'BADAN EKSEKUTIF MAHASISWA', latar: 0x0d3b66, teks: 0xffffff, pintu: 0x2f5f9e });
export const DPM = Object.freeze({ nama: 'DPM', sub: 'DEWAN PERWAKILAN MAHASISWA UNIVERSITAS RIAU', latar: 0x7a1f24, teks: 0xffffff, pintu: 0x7d3a2e });

export const SEKRE_ORMAWA = Object.freeze([
  Object.freeze({ nama: 'UKM SENI', sub: 'SEKRETARIAT', latar: 0x2b2b2b, teks: 0xf2c200, pintu: 0x6b4a2f, pemain: true }),
  Object.freeze({ nama: 'UKM OLAHRAGA', sub: 'SEKRETARIAT', latar: 0x1f6f43, teks: 0xffffff, pintu: 0x2e6e4e }),
  Object.freeze({ nama: 'UKM KEROHANIAN', sub: 'SEKRETARIAT', latar: 0x0f5132, teks: 0xffffff, pintu: 0x8a6a3a }),
  Object.freeze({ nama: 'UKM PERS MAHASISWA', sub: 'SEKRETARIAT', latar: 0xf4f1ea, teks: 0x1b1b1b, pintu: 0x4b5563 }),
  Object.freeze({ nama: 'UKM PECINTA ALAM', sub: 'SEKRETARIAT', latar: 0x3f5a2a, teks: 0xffe9a8, pintu: 0x5d4a2a }),
  Object.freeze({ nama: 'UKM KEWIRAUSAHAAN', sub: 'SEKRETARIAT', latar: 0xb45309, teks: 0xffffff, pintu: 0x9a5b2c }),
]);

/**
 * 8 ruang terurut indeks. BEM/DPM di indeksnya; ormawa `pemain` di `player`; sisanya mengisi slot kosong
 * berurutan. Slot yang tidak terisi = null (dilaporkan validateSekreRooms).
 */
export function sekreRooms({ ormawa = SEKRE_ORMAWA, bem = BEM_ROOM_INDEX, dpm = DPM_ROOM_INDEX, player = PLAYER_ROOM_INDEX } = {}) {
  const slots = new Array(ROOM_COUNT).fill(null);
  slots[bem] = { ...BEM, peran: 'bem' };
  slots[dpm] = { ...DPM, peran: 'dpm' };
  const pemain = ormawa.find((o) => o.pemain);
  if (pemain && slots[player] === null) slots[player] = { ...pemain, peran: 'ormawa' };
  const rest = ormawa.filter((o) => o !== pemain);
  let k = 0;
  for (let i = 0; i < ROOM_COUNT; i += 1) {
    if (slots[i] === null && k < rest.length) {
      slots[i] = { ...rest[k], peran: 'ormawa' };
      k += 1;
    }
  }
  return Object.freeze(slots.map((s, index) => (s ? Object.freeze({
    ...s, index, row: index < ROOMS_PER_ROW ? 'U' : 'S', col: index % ROOMS_PER_ROW, pemain: Boolean(s.pemain),
  }) : null)));
}

const isColor = (v) => Number.isInteger(v) && v >= 0 && v <= 0xffffff;

/** Daftar galat (kosong = valid). */
export function validateSekreRooms(rooms) {
  const errs = [];
  if (!Array.isArray(rooms) || rooms.length !== ROOM_COUNT) return [`harus ${ROOM_COUNT} ruang`];
  rooms.forEach((r, i) => {
    if (!r) {
      errs.push(`ruang ${i} kosong (tambah ormawa di SEKRE_ORMAWA)`);
      return;
    }
    if (typeof r.nama !== 'string' || r.nama.trim() === '' || r.nama.length > MAX_NAME) errs.push(`ruang ${i}: nama 1–${MAX_NAME} huruf`);
    else if (r.nama !== r.nama.toUpperCase()) errs.push(`ruang ${i}: nama harus kapital`);
    if (![r.latar, r.teks, r.pintu].every(isColor)) errs.push(`ruang ${i}: warna latar/teks/pintu harus hex 0..0xffffff`);
  });
  const filled = rooms.filter(Boolean);
  const pemain = filled.filter((r) => r.pemain);
  if (pemain.length !== 1) errs.push(`harus tepat satu ruang pemain (ada ${pemain.length})`);
  const bem = filled.filter((r) => r.peran === 'bem');
  if (bem.length !== 1 || filled.filter((r) => r.peran === 'dpm').length !== 1) errs.push('harus tepat satu BEM dan satu DPM');
  if (pemain.length === 1 && bem.length === 1) {
    const [p] = pemain;
    const [b] = bem;
    if (p.row !== b.row || Math.abs(p.col - b.col) !== 1) errs.push(`ruang pemain (indeks ${p.index}) harus bersebelahan dengan BEM (indeks ${b.index}) di baris yang sama`);
  }
  return errs;
}
