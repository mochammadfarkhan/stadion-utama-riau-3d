# R25 — Kendaraan lain: motor sebagai tujuan besar; traktor yang benar (D1 "naik apa saja")

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Keputusan lama (2026-10-26): kendaraan **ganti bebas** dengan F. Keputusan arah (2026-11-13): dunia terbuka bebas.
> Kartu ini menambah **satu** kendaraan (motor) dengan cara yang sama seperti traktor, dan memperbaiki traktor. Mobil belum.

**Tujuan:** ada pembelian besar yang layak ditabung (motor), dan tiap kendaraan terasa berbeda.
**Pilar:** P-2, P-3. **Tonggak:** setelah T2 ("beyond", dibuka bila R09 dan R10 lulus uji main). **Branch:** `feat/motor`.
**Prasyarat:** R13 (fisika), R14 (ganti kendaraan), R09 Tugas 5 (perlengkapan), R18 Tugas 3 (suara kendaraan).

## Fakta kode (dicek 2026-11-14)

- Mode pemain: `src/config/kebun.js:61` `PLAYER_MODES = ['jalan', 'sepeda', 'traktor']`, `MODE_LABEL`, `TRACTOR = { ...BIKE, maxSpeed 4.2, sprintSpeed 6, accel 1.8, brake 5, drag 0.9, wheelRadius 0.62,
  leanMax 0, wheelBase 1.7, steerMax 0.6, steerRate 3, steerSpeedFactor 0.05, reverseSpeed 2, pedalRatio 0, kSlope 0.3, climbLoss 1 }`.
- `src/entities/Bicycle.js`: `setTractorModel(model: { group, seat, spin(angle) })`, `setMode(mode)`, `cycleMode()`; `stepBike(..., { cfg: mode === 'traktor' ? TRACTOR : this.#cfg })`;
  `#parts.frame.visible = mode === 'sepeda'`; traktor baru tersedia setelah modelnya dimuat (`src/app/farm.js:101`).
- Model motor **statis** sudah ada: `src/world/props/Vehicles.js` `createMotorcycle(opts)` (dipakai parkiran). Pose duduk di motor belum ada (`animateCycling` hanya untuk sepeda).
- Collider pemain = satu titik (`createCollider(start, isWalkable, penetration)`); `TILE_COLLIDER.clearance 0.6` (`src/city/TileCollider.js:15`).
- Kamera: `rig.distanceScale = mode === 'traktor' ? 1.4 : 1` (`src/main.js:426`).

---

## Tugas 1: Konfigurasi kendaraan di satu tempat

- [ ] Baru `src/config/vehicles.js` (murni): pindahkan `PLAYER_MODES`, `MODE_LABEL`, `TRACTOR` dari `kebun.js` (ekspor ulang dari `kebun.js` supaya impor lama tetap jalan) dan tambah:
  ```js
  export const MOTOR = Object.freeze({ ...BIKE, maxSpeed: 16, sprintSpeed: 22, accel: 6.5, brake: 9, drag: 0.1, rollDecel: 0.5, wheelRadius: 0.3, leanMax: 0.65,
    wheelBase: 1.3, steerMax: 0.5, steerRate: 3.2, steerSpeedFactor: 0.06, latAccelMax: 8, reverseSpeed: 0, reverseAccel: 0, pedalRatio: 0, kSlope: 0.25, climbLoss: 0.6 });
  export const VEHICLES = Object.freeze({
    jalan:   { label: 'Jalan kaki', cfg: null,    camera: 1,    footprint: null,                usesStamina: true,  owned: true },
    sepeda:  { label: 'Sepeda',     cfg: BIKE,    camera: 1,    footprint: null,                usesStamina: true,  owned: true },
    traktor: { label: 'Traktor',    cfg: TRACTOR, camera: 1.4,  footprint: { halfLen: 1.4, halfWid: 0.9 }, usesStamina: false, owned: true },
    motor:   { label: 'Motor',      cfg: MOTOR,   camera: 1.15, footprint: { halfLen: 0.9, halfWid: 0.35 }, usesStamina: false, owned: false },
  });
  ```
  `footprint` traktor **harus diukur** dari model (`Box3().setFromObject(model.group)` sekali di konsol dev) dan angkanya dikoreksi di sini; nilai di atas hanya awal.
- [ ] Tes data (`tests/vehicles.test.js`): tiap kendaraan ber-`cfg` punya semua kunci yang dipakai `stepBike` (`maxSpeed, sprintSpeed, accel, brake, drag, wheelRadius, wheelBase, steerMax, steerRate, steerSpeedFactor, reverseSpeed, reverseAccel, pedalRatio, leanMax, leanSmoothing`).
- [ ] `Bicycle.js` dan `main.js:426` membaca dari `VEHICLES` (bukan `if 'traktor'`). Commit `refactor(kendaraan): satu tabel kendaraan`.

## Tugas 2: Collider badan kendaraan (traktor tidak menembus dinding)

**Murni baru (`src/core/Collider.js`):**
`export function footprintWalkable(isWalkable, x, z, yaw, halfLen, halfWid) → boolean` — uji pusat + 4 sudut (maju = `(sin yaw, cos yaw)`).

- [ ] Tes (`tests/collider.test.js`): dinding di `x > 2`; kendaraan di `x = 1.5`, `halfWid = 0.9`, yaw 0 → `false`; di `x = 1.0` → `true`; yaw π/2 dengan `halfLen = 1.4` di `x = 1.0` → `false`.
- [ ] `Bicycle#setMode`: saat ganti kendaraan, `setCollider(createCollider(pos, (x, z) => footprintWalkable(isWalkable, x, z, this.state.yaw, fp.halfLen, fp.halfWid), penetration))` untuk kendaraan ber-`footprint`;
  untuk yang tanpa, collider titik seperti sekarang. `Bicycle` perlu menerima `colliders` mentah (`setColliderSource({ isWalkable, penetration })`), dipasang dari `main.js:236`.
- [ ] Ganti kendaraan ditolak bila jejak kendaraan baru tidak muat di tempat itu (toast `'Tidak cukup ruang di sini'`).
- [ ] Commit `fix(kendaraan): collider mengikuti ukuran kendaraan`.

## Tugas 3: Motor bisa dikendarai

- [ ] Model: pakai `createMotorcycle()` dari `src/world/props/Vehicles.js` sebagai badan (baca fungsinya untuk dimensi, posisi jok, dan roda). Bungkus menjadi
  `{ group, seat: Vector3, spin(angle) }` seperti kontrak traktor (`Bicycle.setTractorModel`); bila roda motor tidak terpisah sebagai objek sendiri, roda tidak berputar (diterima untuk tahap pertama; catat).
  Ubah `setTractorModel` menjadi umum: `setVehicleModel(mode, model)`.
- [ ] Pose pengendara: fungsi baru `animateRiding(h, opts)` di `Humanoid.anim.js` = `poseCycling` tanpa kayuhan: kaki diam di pijakan (`footY`, `footZ` dari model), lengan ke setang lewat `solveArmIK` (R17 Tugas 2),
  punggung `0.35`. Tes `NaN`-bebas di `tests/humanoidAnim.test.js`.
- [ ] Fisika: `stepBike` dengan `MOTOR`. `sprint` (Shift) = gas penuh ke `sprintSpeed`; tanpa stamina. Motor **tidak bisa mundur** (`reverseSpeed 0`): S = rem saja.
- [ ] Suara: `engineBuffer(sampleRate, { seconds = 2, seed = 37 })` (gigi gergaji rendah + derau; loopable) → `AudioBus.startEngine`; tingkat dan **laju putar** (`playbackRate` 0,7–1,6) mengikuti `|v| / maxSpeed`.
  `loop(...)` sekarang hanya punya `setLevel`: tambahkan `setRate(rate)` pada `LoopHandle`. Dites lewat fungsi murni `engineSound(v, cfg) → { level, rate }`.
- [ ] Kamera: `camera: 1.15`; `speedFov` (R15) bekerja sendiri dari laju.
- [ ] Commit `feat(kendaraan): motor bisa dikendarai`.

## Tugas 4: Motor harus dibeli

- [ ] `src/config/upgrades.js`: `motor: { label: 'Motor bekas', price: 150000, text: 'Kendaraan baru: lebih cepat, tanpa tenaga kayuh', unlock: 'motor' }`.
  `src/sim/upgrades.js`: `export function ownedVehicles(state, defs) → string[]` (`['jalan', 'sepeda', 'traktor']` + yang `unlock`-nya dimiliki). Tes.
- [ ] `Bicycle#cycleMode` melewati kendaraan yang belum dimiliki (`setOwnedModes(list)` dari `main.js`). Traktor tetap bebas tetapi **hanya bisa dinaiki dalam 300 m dari kebun**
  (`KEBUN.origin`): di luar itu F melewatinya. (Traktor di tengah kota merusak rasa tempat; ini pembatasan lunak, bukan larangan cerita.)
- [ ] Harga 150.000 = ±25 pesanan antar rata-rata (Rp 6.000). Setelah uji main R10, sesuaikan harga supaya motor terbeli dalam **±90 menit bermain**; tulis dasar hitungannya di laporan.
- [ ] Commit `feat(ekonomi): motor sebagai pembelian besar`.

---

## Selesai bila

- Tes `tests/vehicles.test.js tests/collider.test.js tests/upgrades.test.js tests/humanoidAnim.test.js` lulus; lint bersih; draw call saat naik motor ≤ saat naik sepeda + 6.
- Uji main: beli motor (majukan saldo lewat devtools untuk uji), naik, 16 m/s di jalan raya terasa stabil (radius belok lebar), traktor tidak menembus tembok rumah kebun.
- `docs/KRITIK.md` ("beyond": kendaraan lain), `docs/ARSITEKTUR.md` (log keputusan), README rencana diperbarui.

## Tidak dikerjakan / menunggu

- Mobil: butuh model yang bisa dinaiki, kamera dalam kabin, dan lalu lintas yang bereaksi (R23). Setelah motor diuji.
- Bensin, SIM, tilang: **tidak** (nada game hangat; lihat keputusan "tanpa kekerasan/kejar-kejaran" yang masih menunggu konfirmasi user).
