# R20 — Kebun yang jujur dan terbaca (Putaran 2)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Logika kebun murni ada di `src/sim/farm.js` (tes `tests/farm.test.js`);
> perekat di `src/app/farm.js` (tanpa tes). Kebun adalah **sampingan** (keputusan arah): perbaiki cacat dan keterbacaan, jangan menambah mekanik baru.

**Tujuan:** kebun tidak bisa dieksploitasi dalam hitungan detik, tiap petak bisa dibaca, tiap aksi terasa.
**Pilar:** P-3. **Tonggak:** T2. **Branch:** `fix/kebun`. **Prasyarat:** R19 Tugas 1 (dompet tersimpan). Tugas 4 memakai R18 Tugas 5 bila sudah ada.

## Fakta kode (dicek 2026-11-14; cari simbol dengan grep)

- `src/config/kebun.js`: `KEBUN` (origin `{-168, 968}`, 8 × 5 petak @ 2 m, rumah `{-162, 988}`, `seedBox {-157.2, 984.4}`, `shipBox {-157.2, 991.6}`, `boxRadius 1.6`,
  `visibleRadius 260`, `reach 1.6`, `sleepHours 6`). `CROPS`: `terong {seed 800, price 3000, growHours 2, regrow true}`, `cabai {1000, 6000, 3, false}`,
  `jagung {1500, 12000, 8, false}`. `MAX_STAGE = 3` (`sim/farm.js`).
- `src/app/farm.js:140–147` `sleep()`: `store.set('sky.hour', 6)`, `growFarm(farm, KEBUN.sleepHours, CROPS)`, bayar kotak kiriman. **Tanpa syarat jam**:
  `farm.js:194` hanya memeriksa jarak ke pintu dan mode jalan kaki.
- `farm.js:247`: `if (dh > 0 && dh < 6) commit(growFarm(farm, dh, CROPS));` — pertumbuhan mengikuti selisih `sky.hour`. Jam berjalan **mati secara default**
  (`schema.js:23` `advanceTime: false`), jadi tanaman tidak tumbuh kecuali pemain tidur atau menekan `]` (+1 jam, `keymap.js:119–120`, tiap tekan = tumbuh).
- `sim/farm.js:28`: petak bertanaman yang sudah disiram mengembalikan `'tunggu'` → `planAction` → `{ action: null }` → **tidak ada prompt sama sekali**.
- `farm.js:175–177`: hanya panen yang memberi toast; cangkul/tanam/siram tanpa teks dan tanpa suara.
- `farm.js:215`: `if (!view) return;` — bila model kebun gagal dimuat, kebun mati sepanjang sesi.

## Hitungan keseimbangan (kenapa ini cacat)

40 petak terong setelah tumbuh: 3.000 × 40 = **Rp 120.000 per tidur**, dan tidur bisa ditekan berulang. Seluruh hadiah cerita stadion = Rp 64.000;
saldo awal Rp 50.000; jajanan Rp 4.000–15.000. Satu menit di kebun menghapus seluruh ekonomi game.

---

## Tugas 1: Tidur hanya malam, sekali per malam

**Berkas:** `src/sim/farm.js`, `src/app/farm.js`, `tests/farm.test.js`.

**Antarmuka murni baru:** `export function canSleep(hour: number, lastSleepDay: number|null, day: number) → { ok: boolean, reason: string|null }`
- `ok` bila `hour >= 18 || hour < 4` **dan** `lastSleepDay !== day`.
- `reason`: `'Belum mengantuk. Tidur bisa mulai pukul 18.00.'` bila jamnya salah; `'Sudah tidur malam ini.'` bila sudah.

"Hari" = bilangan bulat yang naik tiap kali jam melewati 06.00 karena tidur atau karena waktu berjalan. Simpan `day` dan `lastSleepDay` di data kebun yang tersimpan
(`farmToJson`/`farmFromJson`: bungkus menjadi `{ rows, day, lastSleepDay }`; **format lama (array polos) tetap bisa dimuat** sebagai `day 0, lastSleepDay null`).

- [ ] Tes: `canSleep(20, null, 0)` ok; `canSleep(12, null, 0)` tidak ok + alasan jam; `canSleep(2, 0, 0)` tidak ok + alasan sudah tidur; `canSleep(19, 0, 1)` ok.
  Tes muat format lama dan format baru.
- [ ] Implementasi + pakai di `sleep()`: bila tidak ok → `hud.toast(reason, false)` dan keluar. Bila ok: jam = 6, `day += 1`, `lastSleepDay = day - 1`… (sederhananya: catat `lastSleepDay = day` **sebelum** menaikkan `day`).
- [ ] Prompt pintu rumah kebun ikut berubah: bila tidak bisa tidur, teksnya `Rumah kebun · tidur mulai 18.00`.
- [ ] Commit `fix(kebun): tidur hanya malam, sekali per malam`.

## Tugas 2: Tanaman tumbuh per malam, bukan per jam layar

**Keputusan desain:** pertumbuhan dipisah dari `sky.hour`. Tanaman maju **saat tidur saja**: tiap tidur menambah `nights` sesuai tabel di bawah.
Ini menghapus tiga celah sekaligus (tekan `]`, jam berjalan cepat, masuk-keluar sekre) dan membuat kebun bisa dipahami: "siram, tidur, lihat besok".

| Tanaman | `nights` per tahap (ganti `growHours`) | Benih | Jual | Catatan |
|---|---|---|---|---|
| cabai | 1 | 1.000 | 4.000 | 3 malam sampai panen, +3.000 bersih |
| terong | 1, tumbuh ulang 2 malam | 800 | 1.500 | panen berulang; murah tapi tanpa tanam ulang |
| jagung | 2 | 1.500 | 9.000 | 6 malam, +7.500 bersih |

Hasil: 40 petak terbaik (terong) ≈ Rp 30.000 per dua malam = Rp 15.000 per malam, setara satu misi antar. Kebun tetap menguntungkan tetapi tidak menghapus ekonomi.

- [ ] `src/config/kebun.js` `CROPS`: ganti `growHours` dengan `nights` dan `regrowNights` (terong `2`); ubah `price` sesuai tabel.
- [ ] `src/sim/farm.js`: `growFarm(farm, nights, crops)` — parameter kedua kini **malam** (bilangan bulat ≥ 1); tiap petak yang **disiram** menambah `growth += nights`,
  naik tahap tiap `crops[type].nights` (atau `regrowNights` untuk tahap setelah panen ulang); petak yang tidak disiram tidak tumbuh; semua petak kembali kering setelah tidur.
  Baca implementasi lama dulu dan pertahankan bentuk data petak `[tilled, watered, stage, growth, typeIdx]`.
- [ ] `src/app/farm.js`: hapus blok pertumbuhan dari selisih jam (baris ±247 dan variabel `lastHour`); `sleep()` memanggil `growFarm(farm, 1, CROPS)`.
- [ ] Perbarui `tests/farm.test.js`: tes `growFarm` yang memakai jam ditulis ulang memakai malam. Tambah: jagung butuh 2 tidur per tahap; petak kering tidak tumbuh; terong tumbuh ulang 2 malam.
- [ ] Commit `fix(kebun): tanaman tumbuh per malam; harga diseimbangkan`.

## Tugas 3: Tiap petak bisa dibaca

**Antarmuka murni baru (`src/sim/farm.js`):** `export function describeTile(tile, crops) → string|null`
- rumput → `null` · dicangkul kosong → `'Tanah siap tanam'` · bertanaman kering → `'<Label> · tahap s/3 · perlu disiram'` ·
  bertanaman basah → `'<Label> · tahap s/3 · tumbuh saat tidur'` · siap panen → `'<Label> · siap panen'`.

- [ ] Tes kelima kasus. Di `src/app/farm.js` `findTarget`/prompt: bila tidak ada aksi untuk item yang dipegang, tampilkan `describeTile(...)` sebagai prompt informasi (tanpa "Tekan E").
- [ ] Warna tanah: `src/world/props/unri/kebun.js:79` `SOIL_COLOR = { rumput: 0x6f8c45, cangkul: 0x8a5a35, basah: 0x5b3a24 }` — perlebar beda `cangkul` vs `basah`:
  `basah: 0x3f2616`. Tunas tahap 1 semua tanaman memakai model yang sama (`layerKey`, baris 25): biarkan, karena teks prompt kini menyebut jenisnya.
- [ ] Commit `feat(kebun): status petak terbaca lewat prompt`.

## Tugas 4: Tiap aksi terasa

- [ ] Toast pendek untuk tanam (`Menanam <Label>`), siram tidak perlu toast (ada efek tuang). Bila R18 Tugas 5 sudah masuk: `setupFarm({..., audioBus})` dan
  mainkan `thud`/`pop`/`splash` di `applyWork`. Bila belum, lewati bagian suara dan catat di laporan.
- [ ] Model gagal dimuat (`farm.js:110–113`): bangun tampilan cadangan dari kotak (`THREE.BoxGeometry`) per petak supaya logika tetap jalan;
  toast tetap muncul. Jangan biarkan `view` bernilai `null` permanen.
- [ ] Commit `feat(kebun): umpan balik aksi + tampilan cadangan`.

## Tugas 5: Kebun tersambung ke pedagang (S4 bagian kebun)

Dikerjakan di R10 (kurir): pedagang membeli hasil kebun dengan harga lebih baik daripada kotak kiriman. Di sini cukup siapkan data:
- [ ] `src/config/kebun.js` `CROPS[x].vendorKind`: `cabai → 'kantin'`, `terong → 'kantin'`, `jagung → 'buah'` dan `vendorBonus: 1.25` (pengali harga saat dijual langsung).
  Tes data sederhana di `tests/farm.test.js`. Commit.

---

## Selesai bila

- `node node_modules/vitest/vitest.mjs run tests/farm.test.js tests/inventory.test.js` lulus; `npm run lint` bersih.
- Uji main: tanam 3 cabai, siram, coba tidur siang (ditolak dengan alasan), set jam ke 19 lewat panel, tidur, lihat tahap naik 1, coba tidur lagi (ditolak).
  `node tools/shots/kebun.mjs` masih jalan (alat bidik kebun yang sudah ada).
- `docs/KRITIK.md` butir kebun dan `docs/rencana/README.md` diperbarui.
