# R19 — Simpan/muat yang bisa dipercaya (Putaran 2)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Nomor baris di bawah dari pembacaan 2026-11-14; **cari nama simbolnya**
> dengan grep sebelum mengubah. Tiap tugas = 1 commit.

**Tujuan:** menutup game lalu membukanya lagi tidak pernah menghilangkan uang, posisi, atau kendaraan; "Mulai dari awal" benar-benar dari awal.
**Pilar:** P-4 (sekre adalah rumah: pulang, tutup, besok lanjut). **Tonggak:** T1 (tugas 1–3), T2 (tugas 4–6). **Branch:** `fix/simpan-muat`.
**Prasyarat:** tidak ada. R03 (mulai dari sekre) memakai Tugas 2.

## Peta kunci penyimpanan (semua `localStorage`)

| Kunci | Pemilik | Isi | Kapan ditulis |
|---|---|---|---|
| `sur3d.story.v1` (`STORY_KEY`, `src/story/storage.js:9`) | `StoryDirector.#persist()` | save v3 `{version:3, chapter, step, badges, eggs, bestLap, rupiah, finished, wallet:{balance, items}, place:{region,x,z,yaw}\|null}` | hanya saat peristiwa cerita (beli item misi, hadiah, ganti langkah, reset) |
| `sur3d.story.v1.bak` | `storage.js` | teks save yang rusak/versi tak dikenal | saat muat gagal |
| `sur3d.settings.v1` | `src/settings/store.js:3` | hanya setelan yang beda dari default | debounce 150 ms + `pagehide`/`visibilitychange` |
| `sur3d.quality.v1` | `src/app/quality.js:12` | `{tier, gpu, benched, p95}` | setelah deteksi/uji |
| `stadion.kebun.v1` | `src/app/farm.js:22` | 40 baris `[tilled, watered, stage, growth, typeIdx]` | tiap perubahan petak |
| `stadion.inventory.v1` | `src/app/inventory.js:13` | `{slots:[[id,n]\|0]×36, box:{id:n}}` | tiap perubahan tas |
| `sur3d.ui.folders`, `sur3d.ui.tab` | panel pengaturan | lipatan/tab terakhir | saat diubah |

## Cacat yang diperbaiki (akar di kode)

| # | Yang dialami pemain | Akar |
|---|---|---|
| A | Beli benih → muat ulang → uang kembali tapi benih tetap ada (benih gratis). Tidur → kotak kiriman dibayar → muat ulang → uangnya hilang, kotaknya sudah kosong. | `src/app/farm.js` `buySeed` dan `sleep` memanggil `ents.vendors.debit/credit` lalu `walletChanged()` yang **hanya** `hud.setWallet`; dompet baru tertulis saat `StoryDirector.#persist()` berikutnya. `inventory.payBox()` langsung `save()`. |
| B | Tiap muat ulang kembali ke titik awal, di atas sepeda. | `src/core/StoryDirector.js:75,84` `savedPlace` diisi dari save tetapi **tidak dibaca siapa pun**; `src/main.js:227–228` selalu memakai `region.layout.spawn`. `place` juga basi (hanya ditulis saat peristiwa cerita). Mode kendaraan (`Bicycle.#mode`) tidak disimpan. |
| C | "Mulai dari awal" tanpa konfirmasi, dan kebun + tas tidak ikut kosong. | `src/app/session.js:31` `newGame: () => { story.reset(); begin(); }`; tidak ada yang menghapus `stadion.kebun.v1` / `stadion.inventory.v1`. |
| D | Pemain yang baru berkebun (cerita belum maju) melihat "Mulai Petualangan" tanpa tombol mulai ulang. | `src/ui/menuModel.js:4–6` `hasStoryProgress` hanya melihat state cerita. |
| E | Data kebun/tas rusak diganti diam-diam; mengubah ukuran kebun menghapus semua petak. | `farm.js:34–41` dan `inventory.js:20–26` jatuh ke nilai awal tanpa cadangan; `sim/farm.js:116` `rows.length !== count → createFarm(count)`. |

---

## Tugas 1: `StoryDirector.saveNow()` + dompet tersimpan setelah transaksi kebun (A)

**Berkas:** `src/core/StoryDirector.js`, `src/app/farm.js`, `src/main.js` (pemanggilan `setupFarm`, ±baris 290), `tests/storyDirector.test.js`.

**Antarmuka baru:** `StoryDirector#saveNow(): void` — memanggil `#persist()` (dompet + tempat saat ini). `setupFarm({..., onWalletChanged})`
— parameter opsional `onWalletChanged: () => void`, dipanggil setiap kali kebun mengubah saldo.

- [ ] **Langkah 1: tes gagal dulu** (di `describe('StoryDirector: alur dasar', …)`, pembantu `started()` sudah ada):
  ```js
  it('saveNow menulis saldo terkini ke penyimpanan', () => {
    const { d, deps, store } = started();
    deps.vendors.credit(1234);
    d.saveNow();
    expect(JSON.parse(store.get(STORY_KEY)).wallet.balance).toBe(51234);
  });
  ```
  (`started()` mengembalikan `{ d, log, store, deps }`; saldo awal pembantu = 50000.)
- [ ] **Langkah 2: implementasi** `saveNow() { this.#persist(); }` di `StoryDirector`.
- [ ] **Langkah 3: sambungkan.** Di `src/app/farm.js`: tambah parameter `onWalletChanged = () => {}` di `setupFarm`, dan di fungsi `walletChanged()`
  panggil `onWalletChanged()` setelah `hud.setWallet(...)`. Di `src/main.js`: `setupFarm({ ..., onWalletChanged: () => story.saveNow() })`.
- [ ] **Langkah 4: cek manual.** `npm run dev` → beli 1 benih di kotak benih → muat ulang halaman → saldo tetap berkurang.
- [ ] **Langkah 5: commit** `fix(simpan): dompet tersimpan setelah transaksi kebun`.

## Tugas 2: Posisi dan kendaraan dipulihkan saat muat (B)

**Berkas:** `src/story/storage.js` (`sanitizePlace`), `src/core/StoryDirector.js`, `src/main.js`, `tests/storyStorage.test.js`, `tests/storyDirector.test.js`.

**Keputusan:**
- `place` mendapat field opsional `mode: 'jalan'|'sepeda'|'traktor'` (default `'sepeda'`; nilai lain → `'sepeda'`). `SAVE_VERSION` **tetap 3** (field tambahan, save lama tetap sah).
- Simpan berkala: tiap **10 detik** bila sepeda berpindah > 5 m sejak simpan terakhir, dan saat `pagehide` / `visibilitychange` (tersembunyi).
- Saat muat: bila `story.savedPlace` bisa di-resolve ke koordinat dunia → teleport ke sana **setelah** region yang menaunginya terpasang;
  bila tidak → titik awal bawaan. Pemain yang tersimpan di dalam interior dipulihkan **di depan pintu** (posisi sepeda memang di luar).

**Antarmuka:**
- `sanitizePlace(raw) → {region, x, z, yaw, mode}|null` (tambah `mode`).
- `StoryDirector` menerima opsi baru `modeOf: () => string` dan menulis `place: { ...placeOf(), mode: modeOf() }`.
- Di `main.js`: fungsi `restorePlace({ story, regions, ents, colliders, frameOf })` yang mengembalikan `{x, z, yaw}|null` (dunia) memakai
  `resolvePoint(place, frameOf)` dari `src/story/points.js` (sudah diimpor di `main.js`).

- [ ] **Langkah 1: tes `sanitizePlace`** di `tests/storyStorage.test.js`:
  ```js
  it('sanitizePlace: mode tak dikenal menjadi sepeda; mode sah dipertahankan', () => {
    expect(sanitizePlace({ region: 'stadion', x: 1, z: 2, yaw: 0, mode: 'jalan' }).mode).toBe('jalan');
    expect(sanitizePlace({ region: 'stadion', x: 1, z: 2, yaw: 0, mode: 'roket' }).mode).toBe('sepeda');
    expect(sanitizePlace({ region: 'stadion', x: 1, z: 2, yaw: 0 }).mode).toBe('sepeda');
  });
  ```
- [ ] **Langkah 2: implementasi `sanitizePlace` + `modeOf`** (default `modeOf = () => 'sepeda'`). Perbarui tes save v3 yang membandingkan `place`
  secara persis (`tests/storyDirector.test.js` "save v3 menyimpan tempat dari placeOf…") dengan menambah `mode: 'sepeda'`.
- [ ] **Langkah 3: simpan berkala.** Di `main.js` dalam `setupStory` (atau sistem baru `id: 'autosave', phase: 'ui'`): akumulasi `dt`; tiap ≥ 10 s,
  bila `Math.hypot(b.x - last.x, b.z - last.z) > 5` → `story.saveNow()` dan catat `last`. Tambah `story.saveNow()` di listener `pagehide` dan
  `visibilitychange` yang sudah ada (`main.js:157–158`). Sistem ini tidak boleh berjalan sebelum `session.started`.
- [ ] **Langkah 4: pulihkan saat mulai.** Di `src/app/session.js` `begin()`: terima fungsi `restore` lewat argumen `setupMenu({..., restore})` dan panggil
  `restore()` **sebelum** `rig.exitPov()` hanya bila tombol yang ditekan = Lanjutkan (bukan `newGame`). `restore` di `main.js`:
  1. `const w = resolvePoint(story.savedPlace, frameOf)`; bila `null` → selesai.
  2. `await travel.goTo({ x: w.x, z: w.z, yaw: w.yaw, label: 'tempat terakhir' })` — metode `goTo({ x, z, yaw, label })` di `createFastTravel` (`src/app/fastTravel.js`)
     **didefinisikan di R03 Tugas 1** (jalur yang sama dengan `go(id)`: layar perjalanan, tunggu streaming, `findSpawnNear`, tetapi menerima titik bebas).
     Bila R03 belum masuk, kerjakan R03 Tugas 1 dulu (tugas itu berdiri sendiri).
  3. `ents.bike.setMode(story.savedPlace.mode)` (traktor yang modelnya belum termuat otomatis ditolak oleh `setMode`; biarkan).
- [ ] **Langkah 5: cek manual.** Bersepeda ke Rektorat, ganti ke jalan kaki (F), tunggu 12 detik, muat ulang, tekan Lanjutkan → muncul di Rektorat, berjalan kaki.
- [ ] **Langkah 6: commit** `feat(simpan): posisi dan kendaraan dipulihkan saat muat`.

## Tugas 3: "Mulai dari awal" yang jujur (C, D)

**Berkas:** `src/app/farm.js`, `src/app/inventory.js`, `src/app/session.js`, `src/ui/MainMenu.js`, `src/ui/menuModel.js`, `src/main.js`, tes `tests/mainMenu.test.js`.

**Antarmuka baru:**
- `setupFarm(...)` mengembalikan juga `reset(): void` (semua petak kembali rumput; tersimpan).
- `setupInventory(...)` mengembalikan juga `reset(): void` (isi `STARTER_KIT` dari `src/config/items.js`, kotak kiriman kosong; tersimpan).
- `hasAnyProgress({ storyState, storage }) → boolean` di `src/ui/menuModel.js`: `hasStoryProgress(storyState)` **atau** ada kunci
  `stadion.kebun.v1` / `stadion.inventory.v1` di `storage`.
- Tombol `#menu-new`: klik pertama mengubah teks menjadi `Yakin? Semua kemajuan dihapus` selama 4 detik; klik kedua dalam 4 detik menjalankan `newGame`.
  (Pola dua-klik yang sama sudah ada di `src/ui/StoryJournal.js:47–55`; tiru itu.)

- [ ] **Langkah 1: tes** `hasAnyProgress` (murni) dan konfirmasi dua-klik (`tests/mainMenu.test.js`, pakai `vi.useFakeTimers()`):
  klik sekali → handler `newGame` belum dipanggil dan teks tombol berubah; klik kedua → dipanggil sekali; menunggu 4 detik tanpa klik kedua → teks kembali.
- [ ] **Langkah 2: implementasi** ketiga antarmuka di atas.
- [ ] **Langkah 3: satu jalur reset.** Di `main.js` buat `const resetGame = () => { story.reset(); farm.reset(); inventory.reset(); };` dan pakai untuk
  `newGame` di `setupMenu` **dan** `onReset` jurnal (`StoryJournal`). Ganti `menu.ready({ hasProgress: hasStoryProgress(story.state), … })` dengan `hasAnyProgress`.
- [ ] **Langkah 4: commit** `fix(simpan): mulai dari awal mengosongkan kebun dan tas, dengan konfirmasi`.

## Tugas 4: Cadangan saat data rusak + ukuran kebun berubah (E)

**Berkas:** baru `src/settings/jsonBackup.js`, `src/app/farm.js`, `src/app/inventory.js`, `src/sim/farm.js`, tes `tests/safeStorage.test.js` (atau berkas baru `tests/jsonBackup.test.js`), `tests/farm.test.js`.

**Antarmuka baru:** `loadJsonWithBackup(storage, key, parse) → T|null` — membaca `storage.getItem(key)`; `null`/kosong → `null`; `parse(text)` melempar
atau mengembalikan `null` → tulis teks asli ke `` `${key}.bak` `` lalu kembalikan `null`. `storage` boleh `null` → `null`.

- [ ] **Langkah 1: tes** (3 kasus: sah, rusak → `.bak` terisi, storage `null`).
- [ ] **Langkah 2: pakai** di `farm.js` dan `inventory.js` menggantikan blok `try { … } catch { … }`; keduanya menerima `storage` lewat parameter
  (`setupFarm({..., storage})`, `setupInventory({..., storage})`), diisi `safeLocalStorage()` dari `main.js` (variabel `storage` sudah ada).
- [ ] **Langkah 3: `farmFromJson`** — bila jumlah baris ≠ `count`: salin baris yang tumpang-tindih (indeks 0…min−1), sisanya petak baru. Tes di `tests/farm.test.js`:
  simpan 40 petak, muat dengan `count = 48` → 40 pertama sama, 8 terakhir kosong.
- [ ] **Langkah 4: commit** `fix(simpan): cadangan data kebun/tas yang rusak`.

## Tugas 5 (kecil): satu daftar kunci

- [ ] Buat `src/config/saveKeys.js`: `export const SAVE_KEYS = Object.freeze({ story: 'sur3d.story.v1', storyBackup: 'sur3d.story.v1.bak', settings: 'sur3d.settings.v1', quality: 'sur3d.quality.v1', farm: 'stadion.kebun.v1', inventory: 'stadion.inventory.v1' });`
  dan ganti literal di lima berkas pemiliknya dengan impor ini. **Nilai kunci tidak boleh berubah** (itu akan menghapus simpanan pemain).
  `config/` murni (tanpa impor lain), jadi aman untuk aturan lapisan. Tes `tests/singleSource.test.js` adalah tempat yang cocok untuk memastikan tidak ada literal ganda.
- [ ] Commit `refactor(simpan): satu daftar kunci penyimpanan`.

---

## Selesai bila

- `npm run lint` bersih; tes: `tests/storyDirector.test.js tests/storyStorage.test.js tests/mainMenu.test.js tests/farm.test.js tests/fastTravel.test.js tests/inventory.test.js` lulus.
- Skenario manual (tulis hasilnya di laporan PR): (1) beli benih → muat ulang → saldo benar; (2) tidur → muat ulang → saldo benar;
  (3) pindah tempat + ganti kendaraan → muat ulang → Lanjutkan → tempat dan kendaraan sama; (4) Mulai dari awal → kebun rumput semua, tas = perlengkapan awal.
- Tandai R19 di `docs/rencana/README.md`.

## Tidak dikerjakan di sini

- Menyatukan dua inventori (jajanan di `wallet.items` vs tas) → R09 (butuh migrasi save v4).
- Uang saku pengaman yang bisa terpicu ulang (`fundedStep` hanya di memori, `StoryDirector.js:166–178`): dampak kecil, dibiarkan.
- Titik simpan/tidur di dalam sekre → R24.
