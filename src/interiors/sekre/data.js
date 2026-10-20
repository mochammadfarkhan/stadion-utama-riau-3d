/**
 * Data interior sekre (spec §8.2, katalog aset bagian 6–7): SATU sumber untuk ruang, penempatan aset S01–S30,
 * slot aktivitas NPC, NPC, barang interaktif, dan isi papan.
 *
 * PENTING — isi organisasi (nama, kabinet, pengurus, proker, piagam, poster, catatan rapat, piket) adalah DATA
 * CONTOH [POLA UMUM ormawa Indonesia, riset §3], BUKAN fakta UNRI. Ganti sesuai sekre asli; set
 * DATA_CONTOH = false agar catatan kecil "data contoh" di papan hilang. Fakta yang dipakai: almamater biru
 * langit, julukan "Kampus Biru Langit", Dies Natalis UNRI 1 Oktober (1962 → ke-64 di 2026), Sumpah Pemuda 28 Okt.
 *
 * Koordinat ruang-lokal (m): lantai y = 0; x ∈ [−2,1; 2,1] (kiri → kanan saat masuk dari pintu);
 * z ∈ [−3; 3] (dinding selasar berpintu di z = −3, dinding belakang z = +3).
 * `hadap` = yaw arah hadap, konvensi entitas: maju = (sin hadap, cos hadap); 0 = ke +Z (ke dalam ruang),
 * π = ke selasar, π/2 = ke +X, −π/2 = ke −X. Builder: aset katalog (depan −Z lokal) memakai rotasi
 * y = hadap + π; bidang dinding (normal +Z) dan Humanoid (menghadap +Z) memakai rotasi y = hadap.
 * Dimensi `dim` = katalog L × P × T = { w: x, d: z, h: y } (m), pusat alas di origin.
 */
const PI = Math.PI;
const freeze = Object.freeze;
const at = (x, y, z, hadap = 0, extra = {}) => freeze({ x, y, z, hadap, ...extra });
const aset = (nama, w, d, h, items, extra = {}) => freeze({ nama, dim: freeze({ w, d, h }), items: freeze(items), ...extra });
const rect = (id, x0, x1, z0, z1) => freeze({ id, x0, x1, z0, z1 });

export const DATA_CONTOH = true;
export const SCHEDULE_SEED = 2026;

// ---------- Ruang (spec §8.2: 4,2 × 6,0 × 3,2 m dalam) ----------
export const ROOM = freeze({ w: 4.2, d: 6.0, h: 3.2, wall: 0.15 });
export const WINDOW = freeze({ x: -0.9, w: 1.2, sill: 0.9, h: 1.2, z: -3.0 });
export const WINDOW_CENTER = freeze({ x: WINDOW.x, y: WINDOW.sill + WINDOW.h / 2, z: WINDOW.z });
/** Pintu 0,9 × 2,1 m; daun pintu berengsel di x0, terbuka 85° ke dalam ruang (merapat ke kusen kiri). */
export const DOOR = freeze({ x0: 0.9, x1: 1.8, h: 2.1, z: -3.0, openRad: -1.48 });
/**
 * Selasar di luar ruang ERC (pintu D5 gedung UKM blok biru, sayap utara–selatan; ruang ini sama dengan interior generik 4,2 × 6 m
 * [INFERENSI denah dalam]). Jendela mengintip selasar; panjang & papan nama deret seberang = label ruang lain di gedung.
 */
export const SELASAR = freeze({ zDekat: -3.15, zSeberang: -6.85, ujungKiri: -6.3, ujungKanan: 10.5, tinggiAtap: 3.4, beratap: true });
/** Papan nama ruang tetangga di selasar (label sekreUkm.data.js: D1, D2, D3, D4; tes menjaga kesamaan). */
export const SELASAR_SEBERANG = freeze(['KSR PMI', 'KOPMA UNRI', 'SEKRETARIAT', 'SEKRETARIAT']);
export const SPAWN = freeze({ x: 1.5, z: -2.4, yaw: 0 });
/** yaw dunia sumbu +Z ruang = yaw pintu M4 (menghadap selasar) + offset ini. */
export const ROOM_YAW_OFFSET = PI;
export const TL_POS = freeze([freeze({ x: 0, y: ROOM.h, z: -1.3 }), freeze({ x: 0, y: ROOM.h, z: 1.5 })]);

// ---------- Organisasi (DATA CONTOH) ----------
export const ORGANISASI = freeze({
  singkatan: 'ERC', nama: 'Engineering Robotics Club', kabinet: 'Kabinet Harmoni Bertuah', periode: '2026/2027',
  motto: 'Bergerak · Berkarya · Bermakna', warna: '#c99a00', warna2: '#6fbfe8',
});
const p = (jabatan, nama) => freeze({ jabatan, nama });
const divisi = (nama, koor, anggota) => freeze({ nama, koor, anggota: freeze(anggota) });
export const STRUKTUR = freeze({
  inti: freeze([p('Ketua', 'Farkhan'), p('Wakil Ketua', 'Abbiyu')]),
  sekben: freeze([p('Bendahara', 'Mutia')]),
  divisi: freeze([
    divisi('Anggota', null, ['Mala', 'Juan', 'Naomi', 'Fazlie', 'Okta']),
    divisi('Anggota', null, ['Hafizh', 'Rio', 'Musliadi', 'Fitri', 'Dwi']),
    divisi('Anggota', null, ['Nisa', 'Ummi', 'Yuli', 'Ara']),
  ]),
});
const proker = (nama, bulan, status, catatan = '') => freeze({ nama, bulan, status, catatan });
export const BULAN_PROKER = freeze(['Sep', 'Okt', 'Nov', 'Des', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu']);
export const PROKER = freeze([
  proker('Open Recruitment', 'Sep', 'selesai'),
  proker('Latihan Dasar Organisasi', 'Okt', 'selesai'),
  proker('Dies Natalis Organisasi', 'Nov', 'berjalan', 'H-14!!'),
  proker('Bakti Sosial', 'Des', 'rencana'),
  proker('Pentas Akhir Tahun', 'Jan', 'rencana'),
  proker('Studi Banding', 'Mar', 'rencana'),
  proker('Musyawarah Besar', 'Agu', 'rencana'),
]);
export const CATATAN_RAPAT = freeze({
  judul: 'RAPAT PERSIAPAN DIES NATALIS',
  tanggal: 'Kamis, 15/10',
  poin: freeze([
    'Konsumsi: nasi kotak 60 (cek Kantin FKIP)',
    'Sound system → pinjam atau sewa?',
    'Proposal ke dekanat paling lambat Jumat',
    'Poster + IG: Kominfo',
    'LPJ kegiatan lalu BELUM selesai!!',
  ]),
  tabel: freeze({ kolom: freeze(['Konsumsi', 'Dana', 'Publikasi']), isi: freeze(['Mutia', 'Mala', 'Juan']) }),
  tenggat: 'DL PROPOSAL: JUMAT!!',
  sudut: 'JANGAN DIHAPUS!!',
  semangat: 'semangat!!',
});
/** 1 Okt 2026 = Kamis; Senin = 0 → hariMulai 3. Tanda: fakta (Dies Natalis UNRI ke-64, Sumpah Pemuda) + contoh. */
export const KALENDER = freeze({
  bulan: 'OKTOBER 2026', hariMulai: 3, jumlahHari: 31, libur: freeze([]),
  tanda: freeze({ 1: 'Dies Natalis UNRI ke-64', 15: 'Rapat dies (contoh)', 28: 'Sumpah Pemuda' }), coretan: 'proposal!!',
});
const piket = (hari, nama, centang = false) => freeze({ hari, nama: freeze(nama), centang });
export const PIKET = freeze([
  piket('Senin', ['Mutia', 'Mala'], true), piket('Selasa', ['Juan', 'Naomi'], true), piket('Rabu', ['Fazlie', 'Okta']),
  piket('Kamis', ['Hafizh', 'Rio']), piket('Jumat', ['Musliadi', 'Fitri']),
]);
const piagam = (judul, isi, tahun) => freeze({ judul, kepada: ORGANISASI.nama, isi, tahun });
export const PIAGAM = freeze([
  piagam('PIAGAM PENGHARGAAN', 'Juara II Lomba Kreativitas Mahasiswa tingkat universitas', 2025),
  piagam('SERTIFIKAT', 'Peserta terbaik Latihan Kepemimpinan Mahasiswa', 2024),
  piagam('PIAGAM', 'Partisipasi Bakti Sosial Ramadan', 2025),
  piagam('PENGHARGAAN', 'Pengisi acara penyambutan mahasiswa baru', 2026),
]);
const poster = (judul, sub, tanggal, tempat, warna, warna2) => freeze({ judul, sub, tanggal, tempat, warna, warna2 });
export const POSTER = freeze([
  poster('OPEN RECRUITMENT', 'Anggota baru 2026 — ayo bergabung!', '1–20 Sept 2026', 'Sekretariat Lembaga', '#d9661f', '#8c3a10'),
  poster('MALAM KEAKRABAN', 'Angkatan 2026', '7 Nov 2026', 'Stadion Mini UNRI', '#264653', '#2a9d8f'),
  poster('DIES NATALIS', 'Organisasi kita — syukuran & pentas', '21 Nov 2026', 'Student Center', '#6fbfe8', '#1d4e89'),
  poster('SEMINAR', 'Kepemimpinan Mahasiswa di Era Digital', '12 Des 2026', 'Aula fakultas', '#2a9d8f', '#1b4332'),
]);
const ordner = (label, warna) => freeze({ label, warna });
export const ORDNER = freeze([
  ordner('2019', '#1e3a8a'), ordner('2020', '#b91c1c'), ordner('2021', '#ca8a04'), ordner('2022', '#15803d'),
  ordner('2023', '#1e3a8a'), ordner('2024', '#b91c1c'), ordner('2025', '#ca8a04'), ordner('2026', '#15803d'),
  ordner('PROPOSAL', '#334155'), ordner('SURAT MASUK', '#7c2d12'), ordner('SURAT KELUAR', '#1e3a8a'), ordner('INVENTARIS', '#111827'),
]);
export const STIKER = freeze(['KAMPUS BIRU LANGIT', 'NO SMOKING', 'LEPAS ALAS KAKI', 'JAGA KEBERSIHAN', ORGANISASI.singkatan, 'SALAM MAHASISWA']);
export const TEKS = freeze({
  lemari: 'Map ordner 2019–2026 berjajar, labelnya ditulis spidol.\n'
    + 'Di ujung rak terselip satu map tanpa label. Isinya: "LPJ KEGIATAN — BELUM SELESAI".\n'
    + 'Tenggatnya sudah lewat tiga periode kepengurusan. Tidak ada yang ingat siapa penanggung jawabnya.',
  piala: 'Tiga piala berdiri di atas lemari arsip — satu sudah kehilangan tutupnya.',
  contoh: '(Data contoh — ubah di src/interiors/sekre/data.js)',
});

// ---------- Penempatan aset katalog S01–S30 ----------
export const ASET = freeze({
  S01: aset('papan-struktur-kabinet', 1.8, 0.03, 1.2, [at(-0.6, 1.75, 2.985, PI)]),
  S02: aset('papan-proker', 1.5, 0.03, 1.0, [at(-2.085, 1.65, 0.9, PI / 2)]),
  S03: aset('whiteboard', 1.2, 0.05, 0.9, [at(2.075, 1.45, -1.2, -PI / 2)]),
  S04: aset('kalender-dinding', 0.4, 0.01, 0.6, [at(-2.094, 1.6, -1.6, PI / 2)]),
  S05: aset('jadwal-piket', 0.3, 0.01, 0.42, [at(-2.094, 1.45, -0.95, PI / 2)]),
  S06: aset('piagam-bingkai', 0.4, 0.02, 0.3, [0.27, 0.69, 1.11, 1.53].map((z) => at(-2.09, 2.45, z, PI / 2))),
  S07: aset('piala', 0.15, 0.15, 0.45, [
    at(1.25, 1.8, 2.8, PI, { skala: 0.85 }), at(1.5, 1.8, 2.82, PI, { skala: 1.15 }), at(1.75, 1.8, 2.8, PI - 0.3, { skala: 1 }),
  ]),
  S08: aset('bendera-meja', 0.3, 0.3, 0.6, [at(1.85, 0.75, 0.52, -PI / 2)], { bendera: freeze(['organisasi', 'unri', 'merah-putih']) }),
  S09: aset('lemari-arsip-besi', 0.9, 0.45, 1.8, [at(1.5, 0, 2.775, PI)]),
  S10: aset('map-ordner', 0.08, 0.3, 0.32, []),
  S11: aset('kardus-properti', 0.5, 0.4, 0.35, [at(-1.82, 0, -2.1, 0.1), at(-1.8, 0.35, -2.08, -0.15), at(-1.85, 0, 2.76, 0.05)]),
  S12: aset('spanduk-tergulung', 0.1, 0.1, 2, [at(-1.97, 0, -2.85, PI / 2, { miring: 0.12 }), at(-1.86, 0, -2.9, PI / 2, { miring: 0.08 })]),
  S13: aset('dispenser-galon', 0.32, 0.32, 1.25, [at(0.35, 0, -2.82, 0)]),
  S14: aset('kipas-berdiri', 0.45, 0.45, 1.3, [at(-1.8, 0, -1.0, 0.69)]),
  S15: aset('printer-tua', 0.45, 0.4, 0.25, [at(1.78, 0.75, 1.9, -PI / 2)]),
  S16: aset('meja-lipat-panjang', 1.8, 0.6, 0.75, [at(1.75, 0, 1.2, -PI / 2)]),
  S17: aset('laptop', 0.34, 0.24, 0.23, [at(1.72, 0.75, 1.2, -PI / 2), at(1.78, 0.75, 0.82, -PI / 2 + 0.35)]),
  S18: aset('gelas-kopi', 0.08, 0.08, 0.1, [
    at(1.55, 0.75, 1.5, 0, { isi: 'kopi' }), at(1.62, 0.75, 0.95, 0, { isi: 'plastik' }), at(-0.1, 0.012, 0.75, 0, { isi: 'kopi' }),
  ]),
  S19: aset('gitar-akustik', 0.38, 0.1, 1.0, [at(-1.8, 0, 1.95, PI / 2, { miring: 0.2 })]),
  S20: aset('tas-ransel', 0.3, 0.2, 0.45, [
    at(1.95, 0, -1.85, -PI / 2, { warna: '#1f2a44' }), at(1.93, 0, -1.6, -PI / 2 + 0.2, { warna: '#2b2b2b' }),
    at(0.95, 0.012, 2.55, 2.5, { warna: '#7a1f2b' }),
  ]),
  S21: aset('sepatu-pasang', 0.3, 0.12, 0.1, [
    at(1.55, 0, -2.85, 0.2, { warna: '#212121' }), at(1.8, 0, -2.83, -0.3, { warna: '#1565c0' }),
    at(2.0, 0, -2.62, 1.4, { warna: '#6d4c41' }), at(1.28, 0, -2.9, 0.05, { warna: '#e0e0e0' }),
  ]),
  S22: aset('karpet-ambal-marun', 3, 4, 0.01, [at(-0.4, 0, 0.7, 0)]),
  S23: aset('bantal-tikar', 0.5, 0.35, 0.1, [
    at(0.62, 0.012, 2.35, PI / 2, { warna: '#f4a261' }), at(-1.6, 0.012, 1.85, 0.4, { warna: '#2a9d8f' }),
    at(0.7, 0.012, -0.55, -0.3, { warna: '#e9c46a' }),
  ]),
  S24: aset('lampu-tl-plafon', 1.2, 0.1, 0.08, TL_POS.map((t) => at(t.x, t.y, t.z, 0))),
  S25: aset('stopkontak-sambungan', 0.3, 0.06, 0.04, [at(1.42, 0, 0.92, 0.3)], { stopDinding: freeze({ x: 2.095, y: 0.35, z: 0.25 }) }),
  S26: aset('poster-acara', 0.42, 0.01, 0.6, [
    at(0.68, 1.7, 2.992, PI, { poster: 0 }), at(2.093, 1.75, -2.35, -PI / 2, { poster: 1 }),
    at(0.45, 2.3, -2.993, 0, { poster: 2 }), at(-2.093, 1.75, 2.45, PI / 2, { poster: 3 }),
  ]),
  S27: aset('saklar-lampu', 0.08, 0.02, 0.12, [at(0.75, 1.35, -2.99, 0)]),
  S28: aset('stiker', 0.1, 0.002, 0.1, [
    at(1.3, 1.25, 2.548, PI, { stiker: 0 }), at(1.72, 0.55, 2.548, PI, { stiker: 3 }), at(0.35, 0.6, -2.655, 0, { stiker: 5 }),
  ]),
  S29: aset('jendela-nako-interior', 1.2, 0.1, 1.2, [at(WINDOW.x, WINDOW.sill, WINDOW.z, 0)]),
  S30: aset('pintu-sekre', 0.9, 0.05, 2.1, [at(DOOR.x0, 0, DOOR.z, 0, { buka: DOOR.openRad })]),
});

/** Barang tambahan tanpa ID katalog (dicatat di katalog oleh M7). */
export const EKSTRA = freeze({
  kursiLipat: at(1.12, 0, 1.2, PI / 2),
  kertas: freeze([at(1.6, 0.752, 1.62, 0.3), at(1.5, 0.752, 0.95, -0.2), at(-0.7, 0.014, 0.4, 0.8)]),
});

/** Model GLB final per ID aset (path relatif public/). Diisi di Task 22 setelah ekspor Blender berhasil. */
export const GLB_ASET = freeze({
  S07: 'models/unri/s07-piala.glb',
  S13: 'models/unri/s13-dispenser-galon.glb',
  S14: 'models/unri/s14-kipas-berdiri.glb',
  S15: 'models/unri/s15-printer-tua.glb',
  S17: 'models/unri/s17-laptop.glb',
  S19: 'models/unri/s19-gitar-akustik.glb',
  S20: 'models/unri/s20-tas-ransel.glb',
});

/** Gitar dipegang NPC: transform relatif pivot spine (lihat Humanoid.poses guitarStrum). */
export const GUITAR_HOLD = freeze({ pos: freeze([-0.23, 0.08, 0.2]), rot: freeze([0, PI, 1.22]) });

/** 12 map ordner (S10) di dua rak kaca lemari S09 (lemari menghadap −Z); koordinat ruang. */
export function ordnerSlots() {
  const L = ASET.S09.items[0];
  const out = [];
  [0.97, 1.36].forEach((y, row) => {
    for (let i = 0; i < 6; i += 1) {
      const k = row * 6 + i;
      out.push(freeze({ x: L.x - 0.3 + i * 0.12, y, z: L.z - 0.035, label: ORDNER[k].label, warna: ORDNER[k].warna, miring: k === 11 ? 0.12 : 0 }));
    }
  });
  return freeze(out);
}

// ---------- Tabrakan (persegi panjang ruang-lokal, sebelum diperluas radius pemain) ----------
export const SOLIDS = freeze([
  rect('meja', 1.45, 2.1, 0.3, 2.1),
  rect('lemari', 1.05, 1.95, 2.55, 3.0),
  rect('dispenser', 0.17, 0.53, -3.0, -2.64),
  rect('kipas', -2.0, -1.6, -1.2, -0.8),
  rect('kardus-depan', -2.1, -1.55, -2.35, -1.85),
  rect('kardus-belakang', -2.1, -1.58, 2.54, 3.0),
  rect('spanduk', -2.1, -1.78, -3.0, -2.6),
  rect('kursi', 0.9, 1.35, 0.98, 1.42),
  rect('daun-pintu', 0.86, 1.05, -3.0, -2.08),
  rect('tas', 1.75, 2.1, -2.05, -1.45),
  rect('sofa', -2.1, -1.2, -0.6, 1.6),
]);
/** Perabot tinggi yang menghalangi kamera orang ketiga. */
export const TALL_SOLIDS = freeze([SOLIDS[1]]);

// ---------- NPC (3–6 hadir menurut jadwal) & slot aktivitas ----------
const npc = (id, nama, outfit, seed, hijab, rambut) => freeze({ id, nama, outfit, seed, hijab, rambut });
export const NPCS = freeze([
  npc('npc-1', 'Farkhan', 'almamater', 101, null, 'buzz'),
  npc('npc-2', 'Abbiyu', 'kaus', 202, null, 'helmet'),
  npc('npc-3', 'Mutia', 'almamater', 303, 0x2c3e50, null),
  npc('npc-4', 'Mala', 'kaus', 404, 0x8e44ad, null),
  npc('npc-5', 'Juan', 'kaus', 505, null, 'afro'),
  npc('npc-6', 'Naomi', 'kaus', 606, 0x16a085, null),
  npc('npc-7', 'Fazlie', 'almamater', 707, null, 'buzz'),
  npc('npc-8', 'Okta', 'kaus', 808, null, 'helmet'),
  npc('npc-9', 'Hafizh', 'kaus', 909, null, 'afro'),
  npc('npc-10', 'Rio', 'kaus', 1010, null, 'buzz'),
  npc('npc-11', 'Musliadi', 'almamater', 1111, null, 'helmet'),
  npc('npc-12', 'Fitri', 'kaus', 1212, 0x8e44ad, null),
  npc('npc-13', 'Dwi', 'kaus', 1313, null, 'buzz'),
  npc('npc-14', 'Nisa', 'almamater', 1414, 0x16a085, null),
  npc('npc-15', 'Ummi', 'kaus', 1515, 0x2c3e50, null),
  npc('npc-16', 'Yuli', 'kaus', 1616, 0x8e44ad, null),
  npc('npc-17', 'Ara', 'kaus', 1717, 0x16a085, null),
]);
/**
 * Jam hadir + kebiasaan tiap anggota (jam game; `suka` = slot yang paling sering mereka ambil). [INFERENSI] semua
 * kebiasaan di sini karangan awal untuk variasi, bukan fakta anggota asli. Penampilan (hijab/rambut) di NPCS juga
 * placeholder, silakan ubah. datang === pulang berarti selalu hadir.
 */
const profil = (datang, pulang, suka) => freeze({ datang, pulang, suka: freeze(suka) });
export const NPC_PROFIL = freeze({
  'npc-1': profil(8, 23, ['whiteboard', 'rapat-1', 'laptop']), // Farkhan: datang pagi, rapat dan papan tulis
  'npc-2': profil(9, 21, ['rapat-2', 'whiteboard']),
  'npc-3': profil(8, 17, ['laptop', 'rapat-3']), // Mutia: kerja siang, catatan keuangan
  'npc-4': profil(10, 18, ['ngobrol-1', 'minum']),
  'npc-5': profil(22, 6, ['rebahan', 'laptop']), // Juan: begadang
  'npc-6': profil(9, 16, ['rapat-4', 'minum']),
  'npc-7': profil(13, 23, ['laptop', 'rapat-3']),
  'npc-8': profil(19, 5, ['laptop', 'rebahan']), // Okta: kerja malam
  'npc-9': profil(14, 24, ['gitar', 'ngobrol-2']), // Hafizh: sore sampai malam, genjreng gitar
  'npc-10': profil(15, 22, ['ngobrol-1', 'ngobrol-2']),
  'npc-11': profil(11, 19, ['minum', 'rapat-1']),
  'npc-12': profil(8, 15, ['rapat-1', 'rapat-2']),
  'npc-13': profil(16, 2, ['laptop', 'gitar']),
  'npc-14': profil(9, 14, ['whiteboard', 'minum']),
  'npc-15': profil(12, 20, ['rapat-3', 'ngobrol-1']),
  'npc-16': profil(7, 13, ['rebahan', 'rapat-4']), // Yuli: pagi sampai siang
  'npc-17': profil(17, 23, ['ngobrol-2', 'gitar']),
});
const slot = (id, x, z, yaw, poseId, block) => freeze({ id, x, z, yaw, poseId, block });
/** yaw = hadap NPC; `block` = radius penghalang bagi pemain (rebahan memanjang ±0,8 m). */
export const SLOTS = freeze([
  slot('rapat-1', -0.4, -0.25, 0, 'sitCrossLegged', 0.35),
  slot('rapat-2', 0.5, 0.7, -PI / 2, 'sitCrossLegged', 0.35),
  slot('rapat-3', -0.4, 1.65, PI, 'sitCrossLegged', 0.35),
  slot('rapat-4', -0.85, 0.7, PI / 2, 'sitCrossLegged', 0.35),
  slot('laptop', 1.12, 1.2, PI / 2, 'sitChairTyping', 0.4),
  slot('gitar', -1.35, 2.2, 2.58, 'guitarStrum', 0.4),
  slot('rebahan', -0.1, 2.35, -PI / 2, 'lieDown', 0.85),
  slot('whiteboard', 1.55, -1.2, PI / 2, 'writeBoard', 0.3),
  slot('ngobrol-1', 0.15, -1.85, PI / 2, 'standTalk', 0.3),
  slot('ngobrol-2', 0.95, -1.85, -PI / 2, 'standTalk', 0.3),
  slot('minum', 0.35, -2.2, 0, 'drinkCup', 0.3),
]);
/** Slot yang menyumbang gumaman obrolan. */
export const TALK_SLOTS = freeze(['rapat-1', 'rapat-2', 'rapat-3', 'rapat-4', 'whiteboard', 'ngobrol-1', 'ngobrol-2']);

// ---------- Barang interaktif (spec §8.2: ≥ 10) ----------
const item = (id, label, [x, y, z], radius, prompt) => freeze({ id, label, pos: freeze({ x, y, z }), radius, prompt });
export const INTERAKSI = freeze([
  item('papan-struktur', 'Papan struktur kabinet', [-0.6, 1.75, 2.95], 2.0, 'Lihat struktur pengurus'),
  item('papan-proker', 'Papan program kerja', [-2.05, 1.65, 0.9], 1.8, 'Baca program kerja'),
  item('piagam', 'Piagam & piala', [-2.05, 2.45, 0.9], 1.9, 'Lihat piagam & piala'),
  item('lemari-arsip', 'Lemari arsip', [1.5, 1.1, 2.5], 1.5, 'Buka lemari arsip'),
  item('gitar', 'Gitar akustik', [-1.8, 0.55, 1.95], 1.4, 'Genjreng gitar'),
  item('dispenser', 'Dispenser galon', [0.35, 0.95, -2.7], 1.3, 'Isi segelas air'),
  item('kipas', 'Kipas berdiri', [-1.8, 1.05, -1.0], 1.4, 'Nyalakan / matikan kipas'),
  item('saklar', 'Saklar lampu', [0.75, 1.35, -2.98], 1.1, 'Nyalakan / matikan lampu'),
  item('jendela', 'Jendela nako', [-0.9, 1.5, -2.98], 1.4, 'Intip selasar'),
  item('whiteboard', 'Papan tulis', [2.05, 1.45, -1.2], 1.6, 'Baca catatan rapat'),
  item('pintu', 'Pintu sekre', [1.35, 1.1, -2.98], 1.2, 'Keluar sekre'),
  item('kalender', 'Kalender', [-2.05, 1.6, -1.6], 1.3, 'Lihat kalender'),
]);
