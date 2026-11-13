# R24 — Sekre sebagai rumah: masuk cepat, tidur dan simpan, papan pesanan (P-4)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Nama UKM pemain = **ERC**, ruang **D5** (jangan mengarang nama lain). Isi papan struktur/proker asli menunggu data user;
> kartu ini hanya menambah **fungsi**, bukan isi.

**Tujuan:** pemain pulang ke sekre atas kemauan sendiri karena di sana ia menyimpan, tidur, membeli perlengkapan, dan melihat hasilnya.
**Pilar:** P-4. **Tonggak:** T2 (tugas 1–3), T4 (tugas 4–5). **Branch:** `feat/sekre-rumah`.
**Prasyarat:** R19 (`saveNow`, kalender dari R10/R20), R09 Tugas 5 (perlengkapan), R10 Tugas 4 (kalender).

## Fakta kode (dicek 2026-11-14)

- Portal: `src/app/interiorPortal.js` `createInteriorPortal({...}) → { state, inside, busy, current, doors(), enter(id, { door }), exit(), lookBy, dispose }`.
  Tiap masuk: `createScope` → `def.build(...)` → `mount`; tiap keluar: `unmount` → `releaseBuild` (**interior dibangun ulang penuh tiap masuk**, baris ±197–204, ±236).
  `KEEP_INSIDE = ['gamepad', 'keymap', 'timeOfDay', 'weather', 'scheduler', 'input.endFrame']` + sistem berawalan `interior.`; `FAR_EXIT_M = 30`; `INTERIOR_EYE_Y = 1.55`.
- Interior sekre: `src/interiors/sekre/index.js` `createSekreInterior({ exitTo })`, `SEKRE_ID = 'sekre'`; data `src/interiors/sekre/data.js`: ruang 6 × 6 × 4 m, `SPAWN`, 7 GLB (`GLB_ASET`),
  `INTERAKSI` 12 benda: `papan-struktur, papan-proker, piagam, lemari-arsip, gitar, dispenser, kipas, saklar, jendela, whiteboard, pintu, kalender`.
  Perilaku: `src/interiors/sekre/interactables.js` `createSekreInteractables({ furniture, lighting, audio }) → { items, update() }` (6 kartu info; gitar/dispenser/kipas/saklar = toast + toggle; jendela = intip; pintu = keluar).
- Sambungan cerita: `onInteracted(interiorId, itemId) → story.onInteract(\`${interiorId}:${itemId}\`)` (`src/main.js:502`).
- Aturan lapisan: `interiors/` **tidak boleh** mengimpor `regions/`, `app/`, `ui/`; data dari luar diteruskan lewat `ctx` build (`ctx: { ormawa: SEKRE_PEMAIN }`, `main.js:500`).
- Tes: `tests/unri/interiorPortal.test.js`, `tests/interiorSekre.test.js`, `tests/interior.test.js`.

---

## Tugas 1: Interior tidak dibangun ulang tiap masuk

**Rancangan:** bangun sekali, simpan; keluar hanya melepas tampilan dan menjeda sistem interior. Dibuang sungguhan saat `portal.dispose()` atau bila pemain menjauh > 400 m dari pintu
(memori tekstur dikembalikan).

- [ ] Di `createInteriorPortal`: peta `cache: Map<id, { result, scope, door }>`. `enter`: bila ada di cache → `mount` ulang tanpa `def.build`. `exit`: `unmount` **tanpa** `releaseBuild`.
  Fungsi baru `evict(id)` memanggil `releaseBuild`; sistem kecil di portal (tiap 2 detik) meng-`evict` interior yang pintunya > 400 m dari sepeda; `dispose()` meng-`evict` semua.
- [ ] Keadaan benda (kipas, lampu) kini **bertahan** antar kunjungan dalam satu sesi (efek samping yang diinginkan).
- [ ] Tes di `tests/unri/interiorPortal.test.js` (pakai `def.build` tiruan yang menghitung panggilan): masuk–keluar–masuk → `build` dipanggil **1 kali**; `evict` lalu masuk → 2 kali; `dispose` melepas semua.
- [ ] Ukur waktu layar hitam masuk kedua kali (stopwatch kasar di konsol: `performance.now()` sebelum/sesudah `portal.enter`) dan tulis di laporan.
- [ ] Commit `perf(interior): interior di-cache antar kunjungan`.

## Tugas 2: Tidur dan simpan di sekre

**Keputusan:** sekre menjadi tempat tidur/simpan utama; rumah kebun tetap bisa dipakai tidur (aturan `canSleep` yang sama, R20).

- [ ] `src/interiors/sekre/data.js` `INTERAKSI`: tambah `{ id: 'rebahan', label: 'Rebahan', … }` pada **slot rebahan/karpet yang sudah ada** (`SLOTS` di berkas itu punya pose `lieDown`; pakai posisinya, jangan menambah mebel baru).
- [ ] `interactables.js`: benda `rebahan` memanggil `ctx.onRest?.()` (callback diteruskan lewat ctx build dari `main.js`, pola `ormawa`). Di `main.js`: `onRest` =
  cek `canSleep(time.hour, lastSleepDay, calendar.day)` → bila boleh: layar gelap (`fader.fade(1)`), jam → 06.00, kalender +1 hari, `growFarm(…1 malam…)` lewat `farm.sleepFromOutside()`
  (metode baru di hasil `setupFarm` yang menjalankan bagian tumbuh + bayar kotak dari `sleep()` tanpa syarat posisi), `story.saveNow()`, toast `'Pagi. Permainan disimpan.'`;
  bila tidak boleh: `story.saveNow()` saja + toast `'Permainan disimpan. Tidur bisa mulai pukul 18.00.'`.
- [ ] Prompt benda: `Rebahan (simpan permainan)`.
- [ ] Tes: `tests/interiorSekre.test.js` — benda `rebahan` ada dan memanggil `onRest` sekali per interaksi.
- [ ] Commit `feat(sekre): rebahan untuk tidur dan menyimpan`.

## Tugas 3: Papan pesanan dan perlengkapan di sekre

- [ ] Benda `whiteboard` (sudah ada, sekarang kartu info) menjadi **papan kegiatan**: kartu info yang isinya diberikan `ctx.boardText?.()` dari `main.js`:
  baris-baris `Pesanan diantar: 12 · Pendapatan kurir: Rp 78.000`, `Paspor kota: 7/40`, `Hari ke-5` + `Hari pertandingan berikutnya: lusa` (dari `matchDayState`).
  Bila callback tidak ada → teks lama.
- [ ] Benda `lemari-arsip` menjadi **lemari perlengkapan**: membuka daftar beli yang sama dengan bagian jurnal (R09 Tugas 5) lewat `ctx.onOpenGear?.()` → `story.toggleJournal()` pada bagian Perlengkapan
  (atau panel kecil sendiri bila jurnal tidak bisa dibuka di dalam interior: cek `isUiBlocking` di `main.js:503`). Setelah ini, tombol beli di jurnal **di luar sekre** dimatikan dengan teks `Beli di lemari sekre`.
- [ ] Perlengkapan yang dimiliki **terlihat**: untuk tiap perlengkapan yang dimiliki, tampilkan satu benda kecil di rak (kotak berwarna berlabel, ≤ 12 segitiga, digabung ke mesh statis) —
  data posisi di `data.js` (`EKSTRA` sudah menampung benda tambahan; ikuti polanya).
- [ ] Commit `feat(sekre): papan kegiatan dan lemari perlengkapan`.

## Tugas 4: Permainan dimulai di dalam sekre

- [ ] Setelah Tugas 1: di `begin()` permainan baru (R03 Tugas 2), setelah `travel.goTo(START_POINT)` selesai → `await portal.enter(SEKRE_ID)`; dialog pembuka (R03 Tugas 3) muncul di dalam ruangan;
  langkah pertama bab pembuka tetap `ke-tugu` tetapi `say` baris pertama diganti: `'Kak Nisa: "Eh, sudah bangun? Sore ini kita kumpul di stadion. Sepedamu di depan."'` (teks usulan).
- [ ] Petunjuk keluar: prompt pintu `Keluar (E)` sudah ada; tambahkan penanda tujuan dalam ruang = pintu (kartu misi menulis `Keluar lewat pintu` selama pemain masih di dalam: `StoryHUD.setGoalInfo` menerima `text` pengganti).
- [ ] Uji dari nol: Mulai → bangun di sekre → keluar pintu → sepeda di depan → kartu misi menunjukkan jarak ke tugu.
- [ ] Commit `feat(mulai): permainan baru dimulai di dalam sekre`.

## Tugas 5: Piagam dari gelar (T4)

- [ ] Benda `piagam` (kartu info `piagamText()`): tambahkan daftar gelar/lencana pemain (`state.badges` dari cerita, diteruskan lewat `ctx.badges?.()`), di bawah teks yang ada.
- [ ] Commit `feat(sekre): piagam menampilkan lencana pemain`.

---

## Selesai bila

- Tes interior dan portal lulus; lint bersih; draw call di dalam sekre tidak naik > 2.
- Uji main: satu "hari" penuh — bangun di sekre, antar 2 pesanan, beli gir di lemari, pulang malam, rebahan → pagi, hari +1.
- `docs/KRITIK.md` (pilar P-4), `docs/ARSITEKTUR.md` (interior di-cache; log keputusan), README rencana diperbarui.

## Menunggu user

- Isi asli papan struktur, proker, piagam ERC (Tahap 5 rencana lama): lihat R26.
