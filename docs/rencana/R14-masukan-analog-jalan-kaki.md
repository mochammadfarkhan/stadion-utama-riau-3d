# R14 — Masukan analog dan jalan kaki yang wajar (Putaran 2: F6, F7, F13, F24)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Kerjakan setelah R13 (memakai `stepBike` yang sudah disetel).

**Tujuan:** gamepad dan joystick layar bisa belok setengah dan mengayuh pelan; jalan kaki di luar mengikuti arah kamera seperti di dalam ruangan.
**Pilar:** P-2. **Tonggak:** T1. **Branch:** `feat/masukan-analog`.

## Fakta kode (dicek 2026-11-14)

- `src/core/Input.js`: hanya tombol. `isDown(code)`, `consumePress(code)`, `setVirtual(code, down, source)`, `press(code)`, `endFrame()`. Tidak ada sumbu.
- `src/core/gamepad.js:41–47` mengubah stik jadi tombol (`KeyW: ly < 0`, …); `DEADZONE = 0.25` per sumbu (zona mati persegi); `applyDeadzone(v, dz)`.
- `src/ui/touchMath.js:19–35` `joystickKeys(dx, dy, radius) → {KeyW, KeyS, KeyA, KeyD}` (boolean); `DEADZONE = 0.28`, `AXIS_ON = 0.38`.
- `src/entities/Bicycle.js:36–43` `readCommand(input)` menghasilkan `pedal`/`steer` ∈ {−1, 0, 1}. `stepBike` **sudah** menerima nilai pecahan.
- Jalan kaki luar ruang = mode `'jalan'` di `Bicycle` → `stepOnFoot(state, cmd, dt, WALK)` (`src/sim/farm.js:138–145`), kendali **tank** (A/D memutar badan),
  `WALK = { walk: 1.6, run: 4.2, back: 1.0, accel: 8, turnRate: 2.6 }` (`src/config/kebun.js:65`).
- Jalan kaki dalam ruang = `stepWalk(state, { forward, strafe, run, yaw }, dt, collider)` (`src/sim/walkPhysics.js:52`), relatif kamera, dengan konstanta lain yang
  **juga bernama `WALK`** (`walkSpeed 1.35, runSpeed 3.2`).
- Ganti kendaraan: `Bicycle#setMode` (`Bicycle.js:104–111`) menyetel `v: 0` seketika; `keymap.js:28` tombol F.
- `Bicycle.js:30` `MAX_DT = 0.05`: di bawah 20 fps permainan berjalan lambat (laptop user: Rendah 27–30 fps, jadi dekat batas).

---

## Tugas 1: Sumbu analog di `Input`

**Berkas:** `src/core/Input.js`, `tests/inputVirtual.test.js`.

**Antarmuka baru:**
- `Input#setAxis(name: 'moveX'|'moveY', value: number, source: string): void` — nilai di-clamp ke [−1, 1]; `0` menghapus sumber itu.
- `Input#axis(name): number` — nilai dengan magnitudo terbesar di antara semua sumber (0 bila tidak ada).
- `dispose()` dan pendengar `blur` mengosongkan sumbu juga.
- Konvensi: `moveY` positif = maju, `moveX` positif = **kanan**.

- [ ] Tes: dua sumber (`'pad'` 0,4 dan `'touch'` −0,9) → `axis` = −0,9; set `'touch'` ke 0 → 0,4; `dispose()` → 0; nilai 3 → 1.
- [ ] Implementasi, commit `feat(input): sumbu analog`.

## Tugas 2: Gamepad dan joystick layar menulis sumbu

**Berkas:** `src/core/gamepad.js`, `src/ui/touchMath.js`, `src/ui/TouchControls.js`; tes `tests/gamepad.test.js`, `tests/touchMath.test.js`.

**Antarmuka baru:**
- `export function radialDeadzone(x, y, dz = 0.2) → { x, y }` di `gamepad.js`: magnitudo < dz → `{0,0}`; selain itu diskalakan ulang supaya tepi zona mati = 0 dan tepi luar = 1 (arah dipertahankan).
- `export function touchAxes(dx, dy, radius) → { x, y }` di `touchMath.js`: `clampToRadius` lalu dibagi `radius`, lalu `radialDeadzone(…, 0.18)`; `y` positif = jempol ke **atas** (dy negatif).

- [ ] Tes `radialDeadzone`: `(0.1, 0.1)` → `{0,0}`; `(1, 0)` → `{1, 0}`; `(0.6, 0)` dengan dz 0,2 → `x = 0.5`. Tes `touchAxes(0, -70, 70)` → `{ x: 0, y: 1 }`.
- [ ] `createGamepadPoller`: tiap `update`, `input.setAxis('moveX', a.x, 'pad')`, `input.setAxis('moveY', -a.y, 'pad')` dari stik kiri; **tetap** menulis tombol virtual
  seperti sekarang (menu perjalanan dan mode Kota membaca WASD sebagai tombol).
- [ ] `TouchControls`: saat joystick bergerak, `input.setAxis(..., 'touch')`; saat dilepas, setel 0. Tombol virtual tetap ditulis.
- [ ] Commit `feat(input): gamepad dan joystick layar analog`.

## Tugas 3: Sepeda membaca sumbu

**Berkas:** `src/entities/Bicycle.js` (`readCommand`); tes baru `tests/bicycleCommand.test.js` (ekspor `readCommand` agar bisa dites).

- [ ] Aturan: bila `|axis('moveY')| > 0` pakai nilainya untuk `pedal`, selain itu tombol; sama untuk `steer` dengan **`steer = -axis('moveX')`**
  (di kode ini `steer` positif = kiri: `KeyA → +1`, lihat `Bicycle.js:40`). Hasil di-clamp [−1, 1].
- [ ] Tes dengan `Input` tiruan `{ isDown: () => false, axis: (n) => ({ moveX: 0.5, moveY: 0.3 })[n] }` → `{ pedal: 0.3, steer: -0.5, sprint: false }`;
  tombol W tanpa sumbu → `pedal: 1`.
- [ ] Commit `feat(sepeda): kayuh dan belok analog`.

## Tugas 4: Jalan kaki luar ruang relatif kamera

**Keputusan:** mode `'jalan'` memakai `stepWalk` (`src/sim/walkPhysics.js`) dengan arah maju = arah kamera, sama seperti di dalam ruangan. Kecepatan luar ruang
dipertahankan lebih cepat daripada dalam ruang: jalan 1,6 m/s, lari 4,2 m/s.

**Berkas:** `src/sim/walkPhysics.js`, `src/entities/Bicycle.js`, `src/config/kebun.js`, `src/sim/farm.js`, `src/main.js`; tes `tests/walkPhysics.test.js`, `tests/farm.test.js`.

- [ ] `stepWalk(state, input, dt, collider, cfg = WALK)` — tambah parameter kelima opsional `cfg` (`{ walkSpeed, runSpeed, accel, maxStep, maxDt }`); perilaku lama tidak berubah bila tidak diisi.
  Tes: dengan `cfg.walkSpeed = 1.6` laju akhir 1,6.
- [ ] `src/config/kebun.js`: ganti nama `WALK` → `FOOT` dengan isi `{ walkSpeed: 1.6, runSpeed: 4.2, accel: 8, maxStep: 0.05, maxDt: 0.1 }`.
  Perbarui semua pemakai (`grep -rn "WALK" src tests` — hati-hati: `walkPhysics.js` punya `WALK` sendiri yang **tidak** diubah).
- [ ] `Bicycle.update` saat mode `'jalan'`: `stepWalk(walkState, { forward: cmd.pedal, strafe: -cmd.steer, run: cmd.sprint, yaw: ctx.cameraYaw ?? this.state.yaw }, step, null, FOOT)`.
  State sepeda `{x, z, yaw, v, …}` vs state jalan `{x, z, yaw, vx, vz}`: simpan `vx, vz` di state sepeda saat mode jalan, dan setel `v = Math.hypot(vx, vz)` serta
  `yaw` = arah gerak (`Math.atan2(vx, vz)`) bila `v > 0.2` (badan menghadap arah jalan). Tabrakan tetap lewat `#resolveCollision`.
- [ ] `src/main.js` (pembuatan ctx di `app.start`, ±baris 326–334): tambah `cameraYaw: ents.bike.state.yaw + rig.yawOffset` — **cek** di `src/core/CameraRig.js`
  bagaimana yaw kamera orang ketiga dihitung (`const yaw = bike.yaw + this.yawOffset`, ±baris 302) dan pakai rumus yang sama. Di mode jalan, kamera **tidak boleh** lagi
  ikut `bike.yaw` secara kaku (lingkaran umpan balik): untuk mode jalan pakai yaw kamera yang disimpan rig sendiri. Bila ini butuh perubahan rig yang lebih besar dari 30 baris,
  berhenti dan laporkan; jangan memaksakan.
- [ ] Hapus `stepOnFoot` dari `src/sim/farm.js` beserta tesnya bila tidak ada pemakai lain (`grep -rn "stepOnFoot" src tests`).
- [ ] Uji main: jalan kaki di luar, W maju searah kamera, A/D menyamping, mouse memutar pandangan; masuk sekre → rasanya sama. Commit `feat(jalan): jalan kaki luar ruang relatif kamera`.

## Tugas 5: Ganti kendaraan tidak mengerem mendadak

**Antarmuka murni baru (`src/sim/bikePhysics.js`):** `export function canSwitchMode(v: number, maxV = 1.5): boolean` → `Math.abs(v) <= maxV`.

- [ ] Tes dua kasus. `Bicycle#cycleMode`/`setMode`: bila tidak boleh → kembalikan mode lama tanpa mengubah apa pun; `src/app/keymap.js:28` menampilkan toast
  `'Berhenti dulu untuk ganti kendaraan'` bila mode tidak berubah.
- [ ] Commit `fix(kendaraan): ganti kendaraan hanya saat hampir berhenti`.

## Tugas 6: Fisika tetap benar di fps rendah

- [ ] `Bicycle.update`: ganti `clamp(dt, 0, MAX_DT)` satu langkah dengan **sub-langkah**: `const n = Math.min(4, Math.ceil(dt / 0.033));` lalu ulangi `n` kali dengan `dt / n`
  (tiap sub-langkah: langkah fisika + `#resolveCollision`). Batas total 4 × 0,05 = 0,2 detik per frame. `#updateGround` dan animasi cukup sekali dengan `dt` penuh (di-clamp 0,2).
- [ ] Tes di `tests/terrainFollow.test.js` atau berkas baru: satu `update(0.1)` memindahkan sepeda sejauh ±sama dengan enam `update(1/60)` (toleransi 5%).
- [ ] Commit `fix(sepeda): sub-langkah fisika pada fps rendah`.

---

## Selesai bila

- Tes: `tests/inputVirtual.test.js tests/gamepad.test.js tests/touchMath.test.js tests/touchControls.test.js tests/walkPhysics.test.js tests/bicycleCommand.test.js` lulus; lint bersih.
- Uji main dengan gamepad (bila ada) dan emulasi sentuh: dorong stik setengah → sepeda menikung landai dan melaju pelan.
- README rencana diperbarui.

## Tidak dikerjakan

- Traktor memakai collider titik sehingga badannya menembus dinding (F14): butuh ukuran model traktor yang belum diukur. Kartu lanjutan di R25 (kendaraan).
