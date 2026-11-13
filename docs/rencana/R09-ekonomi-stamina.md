# R09 — Uang yang berarti: saldo awal, stamina, perlengkapan (S2, S3)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Semua logika baru **murni** di `src/sim/` (tanpa `three`, tanpa DOM) dan bertes; `app/` dan `ui/` hanya menyambungkan.
> Prasyarat keras: **R20 Tugas 2** (kebun tidak lagi mencetak Rp 120.000 per tidur) dan **R19 Tugas 1** (dompet tersimpan). Tanpa keduanya kartu ini sia-sia.

**Tujuan:** dalam 20 menit pertama pemain pernah kekurangan uang, dan uang punya tujuan (makanan memulihkan tenaga; perlengkapan mengubah rasa sepeda).
**Pilar:** P-3 (selalu ada yang dikerjakan). **Tonggak:** T2. **Branch:** `feat/ekonomi`.

## Fakta kode (dicek 2026-11-14)

- `src/config/constants.js:149` `VENDOR.startBalance: 50000`; `src/sim/vendorSim.js:80` `createWallet(balance = VENDOR.startBalance)`; `buy(wallet, kind, itemId)`, `consumeItem(wallet, itemId)`,
  `debit(wallet, amount) → { ok, wallet, error? }`, `credit(wallet, amount) → wallet`.
- `VENDOR_CATALOG` (`vendorSim.js:7–24`): minuman `es-teh 5000, es-jeruk 7000, air-mineral 4000, kopi 8000`; buah `buah-potong 10000, jeruk 15000, rujak 12000`; kantin `nasi-kotak 15000, gorengan 5000`.
- Jajanan yang dibeli masuk `wallet.items` (disimpan di save cerita) dan **hanya** berguna untuk misi antar. Barang kebun hidup di tas terpisah (`src/sim/inventory.js`). Dua inventori ini **tidak disatukan di kartu ini**.
- Hadiah cerita stadion total Rp 64.000; bab kampus Rp 25.000 + hadiah langkah; `src/story/funds.js` memberi uang saku bila saldo kurang untuk langkah beli/antar.
- Sprint: `src/entities/Bicycle.js` `readCommand` → `sprint` (Shift); `stepBike(..., { cfg })`; `Bicycle` menyimpan `#cfg` dari opsi konstruktor `cfg` (default `BIKE`).
- Jurnal: `src/ui/StoryJournal.js` (`show(view)`), data dari `StoryDirector.#journalView()`.
- Tombol bebas: **X** belum dipakai (cek `grep -rn "KeyX" src` harus kosong sebelum memakainya).

---

## Tugas 1: Saldo awal Rp 15.000

- [ ] `constants.js`: `startBalance: 15000`. Simpanan lama tidak terpengaruh (saldo ada di save).
- [ ] Jalankan `node node_modules/vitest/vitest.mjs run tests/vendorSim.test.js tests/storyDirector.test.js tests/storyStorage.test.js tests/storyFunds.test.js`;
  tes yang menegaskan angka 50000 **lewat `createWallet()` tanpa argumen** diubah ke `VENDOR.startBalance` (impor konstanta, jangan angka mati).
- [ ] Hitung jalur bab 1–2 dengan saldo baru: mulai 15.000 → bab 1 +5.000 → beli es teh −5.000 → antar +3.000 +8.000. Tidak pernah negatif; uang saku pengaman tidak perlu terpicu. Tulis hitungan ini di laporan.
- [ ] Commit `feat(ekonomi): saldo awal 15.000`.

## Tugas 2: Stamina (murni)

**Berkas:** baru `src/sim/stamina.js`, `tests/stamina.test.js`.

```js
export const STAMINA = Object.freeze({ max: 100, sprintDrain: 12, regen: 7, regenDelay: 1.2, recoverTo: 20 });
/** @returns {{value:number, max:number, idle:number, exhausted:boolean}} */
export function createStamina(max = STAMINA.max)
/** Satu langkah. sprinting = pemain MEMINTA sprint dan sedang bergerak. Mengembalikan state baru. */
export function stepStamina(s, { sprinting, dt }, cfg = STAMINA)
/** Boleh sprint? false selama `exhausted` (habis sampai pulih ke cfg.recoverTo). */
export function canSprint(s)
export function restoreStamina(s, amount)        // dibatasi max; menghapus `exhausted` bila value ≥ recoverTo
export function withMax(s, max)                  // untuk perlengkapan botol minum
```
Aturan: sprint → `value -= sprintDrain·dt`, `idle = 0`; menyentuh 0 → `exhausted = true`. Tidak sprint → `idle += dt`; bila `idle ≥ regenDelay` → `value += regen·dt` (≤ max);
`exhausted` jadi `false` saat `value ≥ recoverTo`. Penuh 100 → habis dalam 8,3 detik sprint; pulih penuh ±15 detik.

- [ ] **Tes dulu:** sprint 5 detik (langkah 1/60) → `value ≈ 40`; sprint 9 detik → `value = 0`, `exhausted`, `canSprint` false; lalu istirahat 2 detik → `value ≈ 5,6`, masih `exhausted`;
  istirahat total 4,2 detik → `value ≥ 20`, `canSprint` true; `restoreStamina(habis, 45)` → `value 45`, tidak `exhausted`; `dt` NaN/negatif → state tidak berubah.
- [ ] Commit `feat(sim): stamina`.

## Tugas 3: Stamina terpasang di sepeda + bilah HUD

**Berkas:** `src/entities/Bicycle.js`, `src/ui/HUD.js`, `src/ui/hud.css`, `src/main.js`; tes `tests/hud.test.js`.

- [ ] `Bicycle`: field `#stamina = createStamina()`, getter `stamina`. Di `update`: `const wantSprint = cmd.sprint && Math.abs(this.state.v) > 1;`
  `cmd.sprint = wantSprint && canSprint(this.#stamina) && this.#mode !== 'traktor';` lalu setelah langkah fisika `this.#stamina = stepStamina(this.#stamina, { sprinting: cmd.sprint, dt: step });`.
  Metode publik `eat(amount)` → `restoreStamina`, `setStaminaMax(max)` → `withMax`.
- [ ] HUD: bilah tipis di bawah kecepatan: `el('div', { id: 'hud-stamina' }, el('div', { id: 'hud-stamina-fill' }))`; `HUD#setStamina(fraction, exhausted)` menulis `style.width` (dibulatkan ke 2%)
  dan kelas `is-exhausted` (warna merah). Bilah **tersembunyi saat penuh** (hanya muncul ketika < 100%) supaya HUD tetap bersih. Tes: `setStamina(0.5, false)` → lebar `50%`, tampil; `setStamina(1, false)` → tersembunyi.
- [ ] Sistem `hud` di `main.js`: `hud.setStamina(s.value / s.max, s.exhausted)`.
- [ ] Uji main: sprint ±8 detik → sepeda kembali ke laju biasa (dengan pelambatan halus dari R13), bilah merah, pulih setelah berhenti sprint.
- [ ] Commit `feat(sepeda): sprint memakai stamina`.

## Tugas 4: Makan dan minum memulihkan stamina

**Berkas:** `src/sim/vendorSim.js`, `src/app/keymap.js`, `src/core/StoryDirector.js` (pembaca), `src/config/controlsHelp.js` (bila R21 Tugas 6 sudah ada); tes `tests/vendorSim.test.js`.

- [ ] Tiap entri `VENDOR_CATALOG` mendapat `restore`: `air-mineral 20, es-teh 25, es-jeruk 30, kopi 40, gorengan 35, buah-potong 30, jeruk 35, rujak 45, nasi-kotak 80`.
  Tes: semua entri punya `restore` > 0; `nasi-kotak` terbesar.
- [ ] Murni baru: `export function pickEdible(wallet, reservedItemId = null) → item|null` — barang **terakhir dibeli** yang `id !== reservedItemId`; `null` bila tidak ada.
  `reservedItemId` = barang yang diminta langkah cerita aktif (`objective.itemId` untuk `buy`/`deliver`), supaya barang misi tidak termakan. Tes 3 kasus.
- [ ] `StoryDirector#reservedItemId(): string|null` (dari `#step().objective`).
- [ ] `keymap.js`: `if (input.consumePress('KeyX'))` → `const it = pickEdible(ents.vendors.wallet, story.reservedItemId());` bila ada: `ents.vendors.consume(it.id); ents.bike.eat(it.restore); hud.setWallet(...);
  hud.toast(\`${it.name}: tenaga +${it.restore}\`, true); story.saveNow();` bila tidak ada: toast `'Tidak ada makanan. Beli dari pedagang.'` (galat).
- [ ] Petunjuk: saat stamina `exhausted` pertama kali dalam sesi, toast sekali: `'Tenaga habis. Tekan X untuk makan/minum, atau istirahat sebentar.'`.
- [ ] Layar sentuh: tambahkan tombol `['makan', 'Makan', 'KeyX', 'tap']` lewat `TouchControls.setButtonVisible('makan', adaMakanan)` (API dari R16 Tugas 5; bila R16 belum masuk, catat sebagai utang di laporan).
- [ ] Commit `feat(ekonomi): makan dan minum memulihkan tenaga (X)`.

## Tugas 5: Perlengkapan (tujuan belanja)

**Berkas:** baru `src/config/upgrades.js`, `src/sim/upgrades.js`, `tests/upgrades.test.js`; `src/entities/Bicycle.js`, `src/ui/StoryJournal.js`, `src/core/StoryDirector.js`, `src/main.js`, `src/config/saveKeys.js` (R19).

```js
// src/config/upgrades.js (data murni)
export const UPGRADES = Object.freeze({
  gir:      { label: 'Gir balap',      price: 30000, text: 'Laju puncak dan sprint lebih tinggi', bike: { maxSpeed: 1, sprintSpeed: 1.5 } },
  botol:    { label: 'Botol minum',    price: 20000, text: 'Tenaga maksimum +30',                 staminaMax: 30 },
  keranjang:{ label: 'Keranjang depan',price: 25000, text: 'Bawa 2 pesanan antar sekaligus',      orderSlots: 1 },
});
// src/sim/upgrades.js (murni)
export function createUpgrades()                                   // → { owned: [] }
export function buyUpgrade(state, wallet, id, defs = UPGRADES)     // → { ok, state, wallet, error? }  error: 'Sudah dimiliki' | 'Uang tidak cukup' | 'Tidak dikenal'
export function bikeConfig(base, state, defs = UPGRADES)           // → cfg baru: base + jumlah semua `bike` yang dimiliki (objek beku)
export function staminaMax(baseMax, state, defs = UPGRADES)
export function orderSlots(state, defs = UPGRADES)                 // 1 + jumlah orderSlots
export function upgradesToJson(state) / upgradesFromJson(text)     // id tak dikenal dibuang
```
- [ ] **Tes dulu:** beli `gir` dengan saldo 30.000 → ok, saldo 0, `owned ['gir']`; beli lagi → `'Sudah dimiliki'`; saldo kurang → `'Uang tidak cukup'`, state tidak berubah;
  `bikeConfig(BIKE, { owned: ['gir'] }).maxSpeed === 10` dan `.sprintSpeed === 14.5`; `orderSlots({ owned: ['keranjang'] }) === 2`; muat JSON rusak → `createUpgrades()`.
- [ ] `Bicycle#setConfig(cfg)` (mengganti `#cfg`). `main.js`: muat dari `storage` kunci baru `sur3d.upgrades.v1` (tambahkan ke `SAVE_KEYS` dan ke `resetGame` R19), terapkan `bikeConfig` + `setStaminaMax`.
- [ ] UI: bagian baru **"Perlengkapan"** di jurnal (`StoryJournal.show(view)` menerima `view.upgrades: [{ id, label, text, price, owned, affordable }]` dan `handlers.onBuyUpgrade(id)`):
  tiap baris tombol `Beli · Rp 30.000` (mati bila tidak mampu) atau teks `Dimiliki`. Setelah beli: dompet HUD diperbarui, `story.saveNow()`, toast `'Gir balap terpasang'`.
  Tes jsdom kecil untuk render daftar (berkas tes jurnal baru atau `tests/hud.test.js`).
- [ ] **Catatan desain:** jurnal hanya tempat sementara. Setelah R24, pembelian pindah ke papan perlengkapan di dalam sekre (P-4) dan bagian jurnal menjadi daftar baca-saja.
- [ ] Commit `feat(ekonomi): perlengkapan sepeda yang bisa dibeli`.

---

## Selesai bila

- Tes `tests/stamina.test.js tests/upgrades.test.js tests/vendorSim.test.js tests/hud.test.js` lulus; lint bersih.
- Uji main 20 menit dari nol (bersama R10 bila sudah ada): catat saldo tiap 5 menit di laporan. Lulus bila saldo **pernah < harga barang yang diinginkan** dan pemain membeli ≥ 1 perlengkapan atau ≥ 2 makanan untuk tenaga.
- `docs/KRITIK.md` (S2, S3), `docs/ARSITEKTUR.md` (tabel lapisan: `sim/` + stamina, upgrades), README rencana diperbarui.

## Tidak dikerjakan

- Menyatukan dua inventori (jajanan ↔ tas kebun): butuh migrasi save v4; kartu tersendiri setelah T2 bila masih terasa mengganggu.
- Kostum, lampu sepeda (butuh aset dan anggaran lampu).
- Motor sebagai pembelian besar → R25.
