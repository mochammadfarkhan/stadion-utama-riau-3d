# R10 — Kurir: pesanan antar yang bisa diulang + hari pertandingan (S4, S6)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Ini **loop inti** game (P-3): 5 menit yang bisa diulang kapan saja.
> Logika murni di `src/sim/orders.js` dan `src/sim/matchDay.js`; penyambung di `src/app/orders.js`.

**Tujuan:** kapan pun pemain berhenti di dekat pedagang, ada pesanan antar berwaktu yang membayar sebanding jarak; tiga hari sekali stadion ramai dan pesanan melonjak.
**Pilar:** P-3, P-1. **Tonggak:** T2. **Branch:** `feat/kurir`. **Prasyarat:** R03 (`goalInfo`, kartu jarak), R09 Tugas 5 (`orderSlots`), R19 Tugas 1 (`saveNow`).

## Fakta kode (dicek 2026-11-14)

- Pedagang: `ents.vendors` (`src/entities/Vendor.js` `VendorGroup`): `.vendors` (tiap pedagang punya `id`, `name`, `kind`, `position {x, z}` region-lokal stadion, `catalog`),
  `.promptVendor` (pedagang terdekat dalam jangkauan E), `.tryBuy`, `.credit(amount)`, `.debit(amount)`, `.wallet`. Pedagang kampus: `UNRI_VENDORS` (`kantin-fkip` di dunia (−790,0; 1140,8)).
  Posisi region-lokal → dunia: `pointToWorld(frame, p)` (`src/app/regionContext.js`), pola di `src/main.js:576`.
- Titik yang **sudah ada** di data dan boleh jadi tujuan antar (tidak ada tempat baru yang dikarang):
  `STORY_NPCS` (`satpam`, `pelatih`, `ketua-bem`, `kak-nisa`; `src/story/chapters.js`, di-resolve dengan `resolvePoint(n, frameOf)` dari `src/story/points.js`),
  `CAMPUS_DESTINATIONS` + tujuan `stadion`/`annur` (`travel.destinations`), `START_POINT` (sekre, R03).
- Penanda tujuan: `StoryDirector.update` memanggil `this.markers.setTarget(this.goalPoint())` tiap frame; minimap menerima `goal: story.goalPoint()` (`main.js:588`).
- Toko: `src/app/shop.js` (`handleShopKey`, `setupShop`), dialog `HUD#openShop(vendor)` (`src/ui/HUD.js:104–113`).
- Pertandingan: `ents.match` (`src/entities/Footballer.js` `FootballMatch`, `get score()`), berjalan terus tanpa jadwal. Kepadatan penonton: setelan `graphics.crowdDensity` → `crowd.setDensity`.
- Hari: penghitung `day` dibuat di R20 Tugas 1 (data kebun). Kartu ini memindahkannya ke modul bersama.

---

## Tugas 1: Pesanan (murni)

**Berkas:** baru `src/sim/orders.js`, `tests/orders.test.js`.

```js
export const ORDERS = Object.freeze({ basePay: 2000, payPerMeter: 4, roundTo: 500, speed: 4.5, slack: 45, tipWithin: 0.6, tipRate: 0.25, minDistance: 120, radius: 7 });
/** Upah (Rp) untuk jarak d meter, dibulatkan ke roundTo. */
export function orderPay(d, cfg = ORDERS)                    // round((basePay + payPerMeter·d) / roundTo)·roundTo
/** Batas waktu (detik) untuk jarak d. */
export function orderDeadline(d, cfg = ORDERS)               // d / speed + slack
/**
 * Buat tawaran dari satu pedagang. drops: [{id, label, x, z}] dunia; vendor: {id, name, x, z, items:[{id, name}]}; rng: () => [0,1).
 * Memilih tujuan berjarak ≥ minDistance (acak berbobot: yang lebih jauh sedikit lebih jarang) dan satu barang acak dari pedagang.
 * @returns {{id, vendorId, itemId, itemName, to:{id,label,x,z}, distance, pay, deadline}|null} null bila tak ada tujuan layak
 */
export function offerFrom(vendor, drops, rng, cfg = ORDERS)
/** State kurir. */
export function createCourier()                              // { active: [], done: 0, earned: 0 }
export function acceptOrder(courier, offer, slots)           // → { ok, courier, error? } error 'Keranjang penuh'
/** Kurangi waktu; pesanan yang habis waktu dibuang dan dicatat. @returns {{courier, expired: order[]}} */
export function tickOrders(courier, dt)
/** Serahkan semua pesanan aktif yang tujuannya dalam radius dari pos. @returns {{courier, delivered: [{order, pay, tip}]}} */
export function deliverAt(courier, pos, cfg = ORDERS)
```
Tip: bila sisa waktu ≥ `(1 − tipWithin) × deadline` saat tiba (tiba dalam 60% waktu) → `tip = round(pay × tipRate / roundTo)·roundTo`.

- [ ] **Tes dulu** (rng tetap `() => 0.5`):
  `orderPay(0) = 2000`; `orderPay(1000) = 6000`; `orderPay(1130) = 6500`; `orderDeadline(900) = 245`;
  `offerFrom` dengan satu tujuan pada jarak 50 m → `null`; dengan tujuan 800 m → tawaran dengan `pay 5000` (2000 + 3200 = 5200, dibulatkan ke 500) dan `deadline ≈ 222,8`;
  `acceptOrder` dengan `slots 1` dan satu aktif → `'Keranjang penuh'`; `tickOrders` melewati batas → `expired` berisi 1, `active` kosong;
  `deliverAt` pada jarak 5 m dalam 30% waktu → `tip = 1500` untuk `pay 6000`; pada 90% waktu → `tip 0`; di luar radius → tidak ada yang diserahkan.
- [ ] Commit `feat(sim): pesanan antar`.

## Tugas 2: Kurir terpasang di permainan

**Berkas:** baru `src/app/orders.js`, `src/ui/OrderCard.js`, `src/ui/hud.css`; ubah `src/app/shop.js`, `src/ui/HUD.js` (dialog toko), `src/core/StoryDirector.js`, `src/main.js`.

**Antarmuka:** `setupOrders({ app, ents, hud, story, frame, frameOf, travel, upgrades, rng = Math.random }) → { courier, offerFor(vendorId), accept(offer), goalPoint(), dispose() }`

- [ ] **Daftar tujuan** dibangun sekali: NPC cerita (label = nama NPC), tujuan perjalanan cepat (label = `shortLabel`), sekre (`'Sekre ERC'`). Tiap titik dunia.
- [ ] **Tawaran:** tiap pedagang punya satu tawaran aktif; dibuat ulang 30 detik setelah diambil/kedaluwarsa. `HUD#openShop(vendor)` mendapat argumen kedua `offer|null` dan menampilkan tombol di bawah daftar barang:
  `Antar <itemName> ke <label> · Rp <pay> · <mm:ss>` (kelas `shop-order`); klik → `accept(offer)` → toko ditutup → toast `'Pesanan diterima'`. Barang pesanan **tidak** masuk dompet (dititipkan pedagang).
- [ ] **Selama aktif:** sistem `{ id: 'orders', phase: 'sim' }`: `tickOrders` (dijeda saat `hud.shopOpen`, POV beku, perjalanan cepat, interior — sama dengan syarat `paused` cerita di `main.js:419`,
  ditambah `|| !document.hasFocus()`), lalu `deliverAt(posisi sepeda)`. Tiap penyerahan: `ents.vendors.credit(pay + tip)`, `hud.setWallet`, toast `'Pesanan sampai! +Rp 6.000'` (+ `' · tip Rp 1.500'`), `story.saveNow()`.
  Kedaluwarsa: toast galat `'Pesanan untuk <label> hangus'`. **Perjalanan cepat membatalkan pesanan aktif** (toast peringatan sebelum pergi: tambahkan konfirmasi sederhana di `FastTravelMenu`
  bila `courier.active.length > 0`: teks tombol tujuan berubah `… (pesanan hangus)`).
- [ ] **Kartu pesanan** `OrderCard`: di bawah kartu misi, satu baris per pesanan: `<itemName> → <label> · <jarak> · <mm:ss>`; jarak memakai `formatDistance` (R03). Sisa waktu < 20% → kelas `is-urgent`.
- [ ] **Penanda:** `StoryDirector` menerima opsi `sideGoal: () => point|null`; di `update`: `this.markers.setTarget(this.sideGoal?.() ?? this.goalPoint())`.
  Minimap (`main.js:588`): `goal: orders.goalPoint() ?? story.goalPoint()`. `orders.goalPoint()` = tujuan pesanan aktif dengan sisa waktu paling sedikit.
- [ ] Pesanan **tidak disimpan** (hilang saat muat ulang; kurir = kegiatan sesi). Statistik `done`/`earned` disimpan di kunci `sur3d.courier.v1` (tambahkan ke `SAVE_KEYS` + `resetGame`).
- [ ] Uji main: ambil pesanan di gerobak stadion ke Pak Satpam, antar, lihat bayaran; ambil pesanan jauh (ke sekre) dan biarkan hangus.
- [ ] Commit `feat(kurir): pesanan antar dari pedagang`.

## Tugas 3: Hasil kebun laku di pedagang

- [ ] Memakai `CROPS[x].vendorKind` dan `vendorBonus` (R20 Tugas 5). Di dialog toko pedagang yang `kind`-nya cocok dan pemain membawa hasil panen di tas: tombol
  `Jual <n> <Label> · Rp <total>` (`total = round(n × price × vendorBonus)`). Penyambung: `inventory.remove(id, n)` + `ents.vendors.credit(total)` + `story.saveNow()`.
  Murni untuk dites: `export function vendorSaleValue(cropId, n, crops) → number` di `src/sim/farm.js`.
- [ ] Commit `feat(kurir): pedagang membeli hasil kebun`.

## Tugas 4: Kalender dan hari pertandingan (S6)

**Berkas:** baru `src/sim/calendar.js`, `src/sim/matchDay.js`, tes `tests/calendar.test.js`, `tests/matchDay.test.js`; ubah `src/app/farm.js` (pakai kalender bersama), `src/main.js`, `src/ui/HUD.js`.

```js
// calendar.js — hari naik tiap jam permainan melewati 06.00 (karena waktu berjalan atau tidur)
export function createCalendar()                            // { day: 0 }
export function advanceCalendar(cal, prevHour, hour, slept = false)   // slept → day + 1; melewati 6 dari bawah (mis. 5,9 → 6,1) → day + 1; lompatan manual > 3 jam diabaikan kecuali slept
// matchDay.js
export const MATCH = Object.freeze({ every: 3, offset: 2, gather: 14, kickoff: 16, end: 18, leave: 19 });
/** @returns {{ isMatchDay:boolean, phase:'sepi'|'jelang'|'main'|'bubar', crowd:number, payBoost:number }} */
export function matchDayState(day, hour, cfg = MATCH)
```
Aturan `matchDayState`: hari pertandingan bila `day % every === offset` (hari ke-2, 5, 8, …). Fase: `jelang` 14–16 (`crowd 0.7`, `payBoost 1.25`), `main` 16–18 (`crowd 1`, `payBoost 1.5`),
`bubar` 18–19 (`crowd 0.5`, `payBoost 1.25`), selain itu `sepi` (`crowd 0.15`, `payBoost 1`). Bukan hari pertandingan → selalu `sepi`.

- [ ] **Tes dulu:** `matchDayState(2, 17).phase === 'main'`; `(2, 15) → 'jelang'`; `(2, 20) → 'sepi'`; `(3, 17) → 'sepi'` dan `isMatchDay false`; `advanceCalendar` empat kasus di komentar.
- [ ] Kalender tersimpan di kunci `sur3d.calendar.v1`; `src/app/farm.js` membaca `day` dari sini (hapus `day` dari data kebun; **simpanan kebun lama yang punya `day` tetap dimuat**: ambil nilai terbesar sekali saat migrasi).
- [ ] Efek di `main.js` (sistem `{ id: 'matchDay', phase: 'sim' }`, evaluasi tiap 1 detik):
  - `ents.crowd.setDensity(store.get('graphics.crowdDensity') × state.crowd)` — **perhatikan** `styleManager` juga memanggil `crowd.setDensity` (lihat `applyEnvironment`); jadikan `matchDay` satu-satunya
    pengali tambahan dengan menyimpan `crowdFactor` di objek bersama yang dibaca `styleManager` (jangan dua sistem saling menimpa).
  - `orderPay` untuk tujuan/asal di kawasan stadion dikali `payBoost` (teruskan `boost` ke `offerFrom` lewat `cfg`).
  - Skor: saat fase berubah ke `main` → skor direset (baca `src/entities/Footballer.js` untuk cara mereset; tambahkan `FootballMatch#resetScore()` bila belum ada) dan toast
    `'Kick-off! PSPS vs Tamu'`; saat `bubar` → toast `'Peluit panjang: PSPS <a> – <b> Tamu'`. Pil skor HUD (R01 Tugas 5) hanya tampil saat fase `main`/`bubar` **dan** di kawasan stadion.
  - Di luar hari pertandingan para pemain bola tetap berlatih (tampil), hanya tanpa skor.
- [ ] HUD jam: tambahkan `· Hari pertandingan` di baris jam pada hari itu (argumen keempat `HUD#setTime`).
- [ ] **Fakta:** "PSPS" sudah ada di game; jangan menambah nama klub lawan, jadwal liga, atau hasil nyata.
- [ ] Commit `feat(dunia): kalender dan hari pertandingan`.

---

## Selesai bila

- Tes `tests/orders.test.js tests/calendar.test.js tests/matchDay.test.js tests/farm.test.js` lulus; lint bersih; draw call tidak naik (`kritik.mjs`).
- **Uji loop 5 menit:** dari sekre → kantin/pedagang → ambil pesanan → antar → uang → ulang. Catat di laporan: waktu satu putaran, bayaran, dan apakah arah selalu jelas.
- Uji hari pertandingan: majukan hari (tidur 2×), datang ke stadion jam 16 → tribun terisi, toast kick-off, tawaran pedagang stadion bertanda lebih mahal.
- `docs/KRITIK.md` (S4, S6), `docs/ARSITEKTUR.md` (loop per frame: sistem `orders`, `matchDay`; log keputusan), README rencana diperbarui.

## Tidak dikerjakan

- Rute kurir harian berbenih tanggal, papan waktu → daftar "beyond" di `docs/KRITIK.md`.
- Pesanan dari NPC acak di jalan, pesanan berantai.
