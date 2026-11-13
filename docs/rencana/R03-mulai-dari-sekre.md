# R03 — Mulai dari sekre ERC; tujuan punya jarak dan arah (S1, U6, G4)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Ini kartu yang mengubah menit pertama permainan; kerjakan berurutan dan
> jalankan permainan dari awal (simpanan dihapus) setelah tiap tugas.

**Tujuan:** permainan baru dimulai di depan pintu sekre ERC (keputusan D1: sekre pusat dunia), bukan menghadap 275 m rumput kosong; pemain selalu tahu
ke mana dan berapa jauh tujuannya.
**Pilar:** P-4 (sekre adalah rumah), P-2. **Tonggak:** T1. **Branch:** `feat/mulai-dari-sekre`.
**Prasyarat:** R01 (HUD), R02 Tugas 1 (bayangan kontak). Berbagi fungsi `goTo` dengan R19 Tugas 2 (siapa pun yang lebih dulu, membuatnya).

## Fakta kode (dicek 2026-11-14)

- Titik awal sekarang: `src/regions/stadion/layout.js:83` `spawn: { x: 0, z: -275, yaw: 0 }` → dunia ≈ (0, −275), menghadap stadion; dipakai `src/main.js:227–229`
  (membuat sepeda), `:236` (collider), `:281` → `travelDestinations` (tujuan perjalanan cepat `'stadion'`; **ini tetap**).
- Sekre ERC: pintu D5 muka dunia (−93,65; 1005,52); pemicu pintu + `exitTo` (−94,65; 1005,52), radius pemicu 1,6 m (`src/regions/unri-lembaga/portalDoors.js:11–12`);
  tujuan perjalanan cepat **sudah ada**: `{ id: 'unri-sekre-ukm', x: -96.65, z: 1005.5, yaw: Math.PI / 2 }` (`src/app/fastTravel.js:16`), 3 m di depan pintu, di luar radius pemicu.
  Kak Nisa (tokoh fiksi) berdiri di (−97,0; 1002,0) (`src/story/chapters.unri.js`).
- Region Lembaga (pemilik pintu dan collider gedung) **streaming**: pusat (−152, 853), pasang ≤ 700 m; dari titik awal lama jaraknya ±866 m → belum terpasang saat boot.
- `createFastTravel(...).go(id)` (`fastTravel.js:150–170`): layar perjalanan → pindahkan sepeda → tunggu tile kota + `settle` (distrik + region hero + prekompilasi shader) →
  `findSpawnNear` → tutup layar. Ini mesin yang tepat untuk memulai di sekre tanpa menulis ulang boot.
- Menu: `src/app/session.js` `begin()` (`session.started = true; rig.exitPov(); menu.hide(); …`); `newGame: () => { story.reset(); begin(); }`.
  Latar menu = POV orbit stadion (`main.js:356`). **Dipertahankan**: stadion tetap ikon sampul.
- Bab pertama: `src/story/chapters.js` bab `selamat-datang`, langkah `ke-tugu` (`objective: { type: 'goto', target: TUGU, radius: 16 }`), dialog
  `'Selamat datang di Stadion Utama Riau!'`.
- Kartu misi: `src/ui/StoryHUD.js` `render(v)`; `StoryDirector.update(dt, ctx)` (`src/core/StoryDirector.js:152–163`) tahu `this.bikePos` dan `goalPoint()` (titik dunia).
- Minimap sudah menjepit penanda tujuan ke tepi (`src/ui/Minimap2D.js:148–150` `clampToEdge`), tetapi di layar sentuh minimap mati pada kunjungan pertama (`main.js:155`).
- Bidikan dasar: `docs/screenshots/kritik/dasar/awal-sore.jpg` (rumput kosong) vs `sekre-luar.jpg` (pintu sekre, papan "SEKRETARIAT", Kak Nisa, pepohonan).

---

## Tugas 1: `goTo(point)` di perjalanan cepat

**Berkas:** `src/app/fastTravel.js`, `tests/fastTravel.test.js`.

**Antarmuka baru:** `createFastTravel(...)` mengembalikan juga
`goTo({ x, z, yaw = 0, label }): Promise<TravelStatus>` — sama persis dengan `go(id)` tetapi tujuan = titik bebas; teks layar `` `Menuju ${label}…` ``.
`go(id)` diubah menjadi pembungkus tipis: cari tujuan → `goTo(d)`.

- [ ] Tes (tiru pola tes `go` yang ada di berkas itu): `goTo({ x: 10, z: 20, yaw: 1, label: 'Uji' })` → layar menampilkan `Menuju Uji…`, sepeda berakhir di titik walkable terdekat, hasil `'ok'`;
  panggilan kedua saat masih sibuk → `'busy'`. Semua tes `go` lama tetap lulus.
- [ ] Implementasi; `setupFastTravel` di `main.js` meneruskan `goTo` (`goTo: (p) => travel.goTo(p)`).
- [ ] Commit `feat(perjalanan): goTo titik bebas`.

## Tugas 2: Permainan baru dimulai di depan sekre

**Berkas:** baru `src/config/startPoint.js`, `src/app/session.js`, `src/main.js`, tes `tests/singleSource.test.js` (atau `tests/fastTravel.test.js`).

- [ ] `src/config/startPoint.js` (murni):
  ```js
  /** Titik mulai permainan baru (dunia): 3 m di depan pintu D5 sekre ERC, menghadap timur ke pintu. Harus sama dengan tujuan perjalanan cepat 'unri-sekre-ukm'. */
  export const START_POINT = Object.freeze({ x: -96.65, z: 1005.5, yaw: Math.PI / 2, label: 'sekre ERC' });
  ```
  `src/app/fastTravel.js:16`: tujuan `'unri-sekre-ukm'` memakai `START_POINT.x/z/yaw` (satu sumber). Tes: `CAMPUS_DESTINATIONS.find((d) => d.id === 'unri-sekre-ukm')` punya x, z, yaw yang sama dengan `START_POINT`.
- [ ] `setupMenu({ ..., travel })` (`session.js`): `begin` menjadi `async`. Urutan untuk **permainan baru / belum ada simpanan tempat**:
  `menu.hide()` → `await travel.goTo(START_POINT)` → `session.started = true` → kunci pointer / tombol layar seperti sekarang.
  (`goTo` sudah menutup POV orbit secara instan dan menunggu region Lembaga terpasang.) Untuk **Lanjutkan**: bila R19 Tugas 2 sudah ada, pakai `restore()`; bila belum, `goTo(START_POINT)` juga.
  Bila distrik UNRI gagal dimuat (`unri === null` di `main.js`): lewati `goTo`, mulai di titik lama (perilaku sekarang) — `main.js` mengirim `travel: unri ? travel : null`.
- [ ] Sepeda **tetap dibuat** di titik stadion saat boot (jangan ubah `main.js:227–236`): itu yang membuat latar menu dan pemuatan awal tetap bekerja.
- [ ] Layar perjalanan saat mulai memakai teks `Menuju sekre ERC…`. Tidak ada HUD yang berkedip di belakangnya (R01 sudah menyembunyikan HUD sampai `menu.hide()`;
  pindahkan pelepasan kelas `is-menu` ke **setelah** `goTo` selesai: `MainMenu.hide()` dipanggil sesudahnya, dan overlay menu disingkirkan dulu dengan `menu.away(true)`).
- [ ] **Cek:** hapus simpanan (`localStorage.clear()` di konsol), muat ulang, Mulai → muncul di depan pintu sekre menghadap pintu, sepeda di bawah pemain,
  prompt "Masuk sekre ERC" **tidak** langsung muncul (di luar radius 1,6 m). `tools/shots/kritik.mjs` tidak terpengaruh (ia membaca posisi sepeda setelah `openSim`,
  yang tidak menekan Mulai): ubah `TITIK_JALAN` di alat itu — tambahkan titik `{ nama: 'mulai', x: -96.65, z: 1005.5, yaw: Math.PI / 2, hour: 16.5 }` sebagai titik sampul baru.
- [ ] Commit `feat(mulai): permainan baru dimulai di depan sekre ERC`.

## Tugas 3: Bab pembuka berangkat dari sekre

**Berkas:** `src/story/chapters.js` (bab `selamat-datang`), `tests/storyData.test.js` bila ada tes teks.

Id langkah **tidak diubah** (`ke-tugu`) supaya simpanan lama tetap sah. Yang diubah hanya teks:

- [ ] `text`: `'Kayuh dari sekre ke Tugu Lancang Kuning di depan Stadion Utama Riau'`.
- [ ] `say` (teks usulan; tokoh Kak Nisa fiksi dan sudah ada di bab kampus):
  1. `'Kak Nisa: "Sore ini kita kumpul di stadion. Kamu duluan ya, naik sepeda."'`
  2. `'Stadion ada di utara kampus. Ikuti penanda kuning dan angka jarak di kartu misi.'`
  3. `'Sampai di sana, cari Tugu Lancang Kuning di plaza depan.'`
- [ ] `outro` bab itu tetap. Jalankan `node node_modules/vitest/vitest.mjs run tests/storyData.test.js tests/storyDirector.test.js tests/storyUnri.test.js`.
- [ ] **Catatan fakta:** "stadion di utara kampus" benar menurut koordinat (−Z = utara; stadion z ≈ −275…0, sekre z ≈ 1005). Jangan menambah klaim lain (nama jalan, jarak dalam teks).
- [ ] Commit `feat(cerita): bab pembuka berangkat dari sekre`.

## Tugas 4: Jarak dan arah ke tujuan di kartu misi (U6)

**Berkas:** baru `src/story/goalInfo.js` (murni), `src/core/StoryDirector.js`, `src/ui/StoryHUD.js`, `src/ui/hud.css`; tes baru `tests/goalInfo.test.js`.

**Antarmuka murni:**
```js
/** Teks jarak: < 1000 m dibulatkan ke 10 m ("240 m"); ≥ 1000 m satu desimal dengan koma ("1,3 km"). null → ''. */
export function formatDistance(meters)
/** Sudut tujuan relatif arah hadap (rad, −π..π; 0 = lurus di depan, positif = di kiri). Konvensi maju = (sin yaw, cos yaw). */
export function relativeBearing(from, to, yaw)
```

- [ ] Tes:
  ```js
  expect(formatDistance(4)).toBe('0 m');
  expect(formatDistance(244)).toBe('240 m');
  expect(formatDistance(995)).toBe('1,0 km');   // 995 → dibulatkan 1000 → tampil km
  expect(formatDistance(1284)).toBe('1,3 km');
  expect(formatDistance(null)).toBe('');
  expect(relativeBearing({ x: 0, z: 0 }, { x: 0, z: 10 }, 0)).toBeCloseTo(0, 9);            // lurus di depan
  expect(relativeBearing({ x: 0, z: 0 }, { x: 10, z: 0 }, 0)).toBeCloseTo(Math.PI / 2, 9);  // +X saat menghadap +Z
  expect(Math.abs(relativeBearing({ x: 0, z: 0 }, { x: 0, z: -10 }, 0))).toBeCloseTo(Math.PI, 9);
  ```
  (Tentukan kiri/kanan dengan menguji di permainan: bila panah menunjuk arah terbalik, balik tanda di CSS, **bukan** di fungsi; tes di atas mengunci definisi fungsinya.)
- [ ] `StoryHUD`: elemen baru `this.where = el('div', { className: 'story-where hidden' })` berisi `<span class="story-arrow">▲</span><span class="story-dist"></span>`, diletakkan setelah `this.goal`.
  Metode baru `setGoalInfo(info: { distance: number, bearing: number } | null)`: `null` → sembunyikan; selain itu tulis `formatDistance(distance)` dan
  `style.transform = \`rotate(${(-bearing).toFixed(2)}rad)\`` pada panah. Menulis ke DOM hanya bila teks jarak berubah atau sudut berubah > 0,05 rad.
- [ ] `StoryDirector.update`: setelah `markers.setTarget(...)`, `const g = this.goalPoint();` lalu
  `this.storyHud.setGoalInfo?.(g ? { distance: Math.hypot(g.x - pos.x, g.z - pos.z), bearing: relativeBearing(pos, g, pos.yaw ?? 0) } : null);`
  (`ctx.bikePos` di `main.js:417` adalah `ents.bike.state`, jadi `pos.yaw` tersedia; tiruan tes memakai `setGoalInfo?.` sehingga tes lama tidak perlu diubah).
- [ ] CSS: `.story-where { margin-top: 6px; font-weight: 700; display: flex; gap: 6px; align-items: center; } .story-arrow { display: inline-block; color: var(--hud-accent); }`.
- [ ] **Cek dengan mata:** mulai baru → kartu misi menulis jarak ±1,2–1,3 km dan panah menunjuk ke arah stadion; berputar 180° → panah ikut berputar; tiba di tugu → baris hilang saat dialog.
- [ ] Commit `feat(cerita): jarak dan arah ke tujuan di kartu misi`.

## Tugas 5: Keluar dari sekre tidak langsung memicu masuk lagi

**Akar:** `src/app/interiorPortal.js` `placeBikeAtExit` hanya memindah sepeda bila jaraknya > `FAR_EXIT_M = 30`; `exitTo` (−94,65; 1005,52) berada **di dalam** radius pemicu 1,6 m,
sehingga setelah keluar prompt "Masuk sekre ERC" langsung muncul dan satu E masuk lagi.

- [ ] `src/regions/unri-lembaga/portalDoors.js`: `sekreExitTo(door)` memakai `doorFront(d, 2.6)` (2,6 m dari muka pintu, di luar radius 1,6 m) — perlu menyimpan data pintu asli
  di `ukmDoor()` atau menghitung ulang dari `UKM_DOORS`. Pemicu (`pos`) **tetap** 1 m. Perbarui `tests/unri/portalDoors.test.js` (harapan `exitTo` berubah: catat nilai baru dari hasil hitung, jangan ditebak).
- [ ] `placeBikeAtExit`: pemain yang berada di dalam radius pemicu saat keluar dipindah ke `exitTo` (bukan hanya yang > 30 m). Tes di `tests/unri/interiorPortal.test.js`.
- [ ] Commit `fix(sekre): keluar pintu tidak langsung memicu masuk lagi`.

---

## Selesai bila

- Lint bersih; tes: `tests/fastTravel.test.js tests/goalInfo.test.js tests/storyDirector.test.js tests/storyData.test.js tests/unri/portalDoors.test.js tests/unri/interiorPortal.test.js`.
- Uji dari nol (simpanan dihapus), catat waktu: tekan Mulai → layar "Menuju sekre ERC…" → kendali di tangan pemain dalam ≤ 6 detik di laptop user.
- Bidikan `mulai.jpg` (preset Rendah) layak jadi gambar README: pintu sekre, sepeda, kartu misi dengan jarak. Simpan ke `docs/screenshots/kritik/r03/`.
- **Uji 10 menit (D6):** setelah R01, R02, R03, R13 masuk, minta satu teman ERC bermain tanpa penjelasan; catat detik pertama ia bergerak, tiap berhenti > 5 detik, dan kalimat pertamanya.
  Hasilnya ditulis di `docs/KRITIK.md` bagian tonggak T1.
- S1, U6, G4 jadi ✅ di `docs/KRITIK.md`; `docs/ARSITEKTUR.md` bagian "Alur boot" ditambah satu kalimat tentang titik mulai; README rencana diperbarui.

## Tidak dikerjakan (kartu lain)

- Mulai **di dalam** ruang sekre (bangun tidur, keluar pintu): butuh `portal.enter()` saat mulai + interior di-cache (R24). Setelah R24, ganti `goTo(START_POINT)` dengan masuk interior.
- Mempercepat boot karena kawasan stadion masih dimuat lebih dulu → R22.
- Latar menu orbit sekre: tidak, stadion tetap ikon sampul (keputusan D4).
