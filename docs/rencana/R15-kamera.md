# R15 — Kamera yang ikut merasakan kecepatan (Putaran 2: F15–F19)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Matematika kamera murni ada di `src/core/cameraMath.js` (tes `tests/cameraMath.test.js`);
> `src/core/CameraRig.js` hanya memakainya. Tambah fungsi murni dulu, baru sambungkan.

**Tujuan:** kamera orang ketiga tidak membanting saat belok, memberi rasa kecepatan, dan orang pertama ikut miring.
**Pilar:** P-2. **Tonggak:** T1. **Branch:** `feat/kamera-rasa`. **Prasyarat:** R13 (belok sudah wajar).

## Fakta kode (dicek 2026-11-14)

- `src/core/CameraRig.js:302` `const yaw = bike.yaw + this.yawOffset;` — arah kamera **dikunci** ke arah sepeda; hanya posisi yang dihaluskan
  (`:364` `cam.lerp(this._desired, 1 - Math.exp(-this.followSmoothing * dt))`, `FOLLOW_SMOOTHING = 6`).
- `cameraMath.js:15–26` `THIRD`: `radius ≈ 6.592`, `lookHeight 1.3`, `snapDistance 25`, `lookIdleDelay 1.2`, `lookReturnRate 1.5`.
- `src/core/cameraAngled.js:74` `stepYaw(yaw, target, dt, cfg)` (murni; `cfg.yawSettleSec`) sudah dipakai mode 3/4.
- FOV hanya ditulis oleh `CameraRig.#applyBaseFov` (`:198–204`), `PovDirector`, `InteriorCameraRig`, dan `bindCamera`. Tidak ada FOV kecepatan, pandangan ke depan, atau guncangan.
- `CameraRig.js:11` `FIRST_PERSON_EYE = (0, 1.55, 0.15)`; orang pertama tidak membaca `state.lean` maupun pitch lereng (`Bicycle.#pitch` privat).
- `CameraRig.js:304–307`: jarak traktor (`distanceScale 1.4`, disetel `main.js:426`) dikalikan **setelah** uji dinding → kamera bisa masuk dinding.
- Setelan kamera (`src/settings/schema.js:95–105`): `sensitivity` (mouse) dipakai juga untuk sentuh dan gamepad; tidak ada balik-Y.

---

## Tugas 1: Arah kamera menyusul, tidak dikunci (F15)

**Berkas:** `src/core/cameraMath.js`, `src/core/CameraRig.js`; tes `tests/cameraMath.test.js`, `tests/cameraRigPlayer.test.js`.

- [ ] `THIRD.yawSettleSec: 0.35` (waktu menyusul 63%). Fungsi murni baru:
  `export function followYaw(current, target, dt, settleSec) → number` = `current + wrapAngle(target - current) * (1 - Math.exp(-dt / settleSec))`.
- [ ] Tes: `followYaw(0, 1, 0.35, 0.35)` ≈ `1 - 1/e` (0,632); melewati ±π tidak memutar jauh (`followYaw(3.1, -3.1, 1, 0.01)` ≈ −3,1, bukan lewat 0).
- [ ] `CameraRig`: field `this._followYaw` (awal = `bike.yaw`). Di `#poseThird` pakai `this._followYaw + this.yawOffset`. Perbarui tiap `update` dengan `followYaw`.
  Saat `_snap` (teleport/keluar POV) → `_followYaw = bike.yaw` seketika. Saat sepeda diam (`|v| < 0.3`) arah kamera tidak dipaksa menyusul (pemain bisa melihat sekeliling).
  `rig.update(bike, dt, time)` menerima `bike.v` dari `ents.bike.state` (sudah dikirim utuh di `main.js:427`).
- [ ] Tes rig: setelah `bike.yaw` melompat 1 rad, satu `update(1/60)` menggeser arah kamera < 0,1 rad; setelah 2 detik selisihnya < 0,01.
- [ ] Commit `feat(kamera): arah kamera menyusul belokan`.

## Tugas 2: Rasa kecepatan (F16)

**Fungsi murni baru (`cameraMath.js`):**
- `export function speedFov(baseFov, v, { from = 4, gain = 1.0, max = 10 } = {}) → number` = `baseFov + Math.min(max, gain * Math.max(0, Math.abs(v) - from))` (derajat).
  9 m/s → +5°, 13 m/s → +9°.
- `export function lookAhead(v, { perSpeed = 0.18, max = 2.2 } = {}) → number` (meter di depan sepeda yang jadi titik pandang) = `Math.min(max, perSpeed * Math.max(0, v))`.

- [ ] Tes: `speedFov(60, 0) = 60`, `speedFov(60, 9) = 65`, `speedFov(60, 30) = 70`; `lookAhead(0) = 0`, `lookAhead(9) ≈ 1.62`, `lookAhead(50) = 2.2`.
- [ ] `CameraRig` orang ketiga dan orang pertama: FOV sasaran = `speedFov(userFov, v)`, dihaluskan `fov += (target - fov) * (1 - Math.exp(-4 * dt))`, lalu
  `camera.updateProjectionMatrix()` **hanya bila berubah > 0,05°**. Titik pandang orang ketiga digeser `lookAhead(v)` meter searah `bike.yaw`.
  Tidak aktif di mode 3/4 (`angled`) dan POV.
- [ ] Hormati setelan: bila `aksesibilitas.reduceMotion` (R21) aktif → `speedFov` tidak dipakai. Rig menerima `rig.reduceMotion = boolean` dari binding.
- [ ] Commit `feat(kamera): FOV dan titik pandang mengikuti kecepatan`.

## Tugas 3: Orang pertama ikut miring dan menanjak (F17)

- [ ] `Bicycle`: getter publik `get pitch()` (nilai `#pitch`) dan `get eyeHeight()` → `'sepeda' 1.55`, `'jalan' 1.55`, `'traktor'`: `this.#tractor?.seat?.y + 0.75 ?? 1.9`
  (baca `Bicycle.js:176` untuk bentuk `seat`).
- [ ] `CameraRig.#updateFirst`: setelah `lookAt`, `camera.rotation.z = -lean * 0.5`; tinggi mata dari `eyeHeight`. Rig menerima `bike` berisi `lean`, `pitch`, `eyeHeight`
  (tambahkan di objek yang dikirim `main.js:427`: `rig.update({ ...ents.bike.state, pitch: ents.bike.pitch, eyeHeight: ents.bike.eyeHeight }, dt, ctx.time)` —
  **hindari alokasi per frame**: pakai satu objek scratch di closure dan isi ulang field-nya).
- [ ] Tes yang menegaskan tinggi mata 1,55 (`tests/cameraRigPlayer.test.js:79`, `tests/terrainFollow.test.js:69`) tetap lulus untuk sepeda.
- [ ] Commit `feat(kamera): orang pertama ikut miring`.

## Tugas 4: Kamera traktor tidak masuk dinding (F18)

- [ ] `thirdPersonOffset(yaw, pitch, cfg)` sudah menerima `cfg`: kirim `{ ...THIRD, radius: THIRD.radius * this.distanceScale }` (objek dibuat sekali saat
  `distanceScale` berubah, bukan tiap frame) ke `sweepOffset`/`pullInOffset`, dan hapus pengali `k` sesudahnya (`CameraRig.js:306–307`). Lakukan hal yang sama di `#writePlayerPose`.
- [ ] Tes `tests/cameraRigPlayer.test.js`: dengan `distanceScale = 1.4` dan `obstacleTest` yang menolak semua titik di `z < -3`, posisi kamera tidak pernah punya `z < -3`.
- [ ] Commit `fix(kamera): jarak traktor dihitung sebelum uji dinding`.

## Tugas 5: Kepekaan per perangkat + balik sumbu Y (F19)

- [ ] `schema.js` grup kamera: `touchSensitivity: range('Kepekaan sentuh', 1, 0.3, 3, 0.05)`, `padSensitivity: range('Kepekaan gamepad', 1, 0.3, 3, 0.05)`,
  `invertY: toggle('Balik sumbu Y', false)`. `rig.lookBy(dx, dy, scale)` sudah punya `scale`: `TouchControls` mengalikan `LOOK_SCALE` (1,8) dengan setelan sentuh,
  gamepad mengalikan dengan setelan pad; `invertY` membalik `dy` di dalam `lookBy`. Binding di `src/ui/bindings/bindCamera.js`.
- [ ] Kurva stik: `export function stickCurve(v, exp = 1.8) → Math.sign(v) * Math.abs(v) ** exp` di `gamepad.js`, dipakai untuk stik kanan. Tes 3 nilai.
- [ ] Commit `feat(kamera): kepekaan sentuh/gamepad dan balik sumbu Y`.

---

## Selesai bila

- Tes kamera lulus; lint bersih.
- Uji main: belok tajam di laju puncak → cakrawala berputar halus, sepeda sempat terlihat dari samping-belakang; sprint → pandangan melebar terasa tapi tidak memusingkan;
  V (orang pertama) → cakrawala miring saat belok.
- Bila uji main terasa memusingkan: `yawSettleSec` boleh 0,25–0,5 dan `speedFov.max` 6–10 tanpa bertanya; tulis nilai akhirnya di laporan.

## Tidak dikerjakan

- Guncangan kamera saat menabrak: menunggu R13 Tugas 4 diuji main dulu; guncangan tanpa suara tabrakan terasa palsu (lihat R18).
