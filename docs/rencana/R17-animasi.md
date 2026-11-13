# R17 — Animasi pengendara dan pejalan (Putaran 2: F8–F12, F25, M6)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Berkas animasi **belum punya tes**; tugas pertama membuat jaring pengaman.
> Jangan menyentuh bentuk/proporsi model (itu menunggu rujukan user, D5); yang dikerjakan di sini hanya **gerak**.

**Tujuan:** tangan pengendara memegang setang, lari terlihat lari, perpindahan pose tidak meloncat.
**Pilar:** P-2. **Tonggak:** T1 (tugas 1–3), T4 (tugas 4–5). **Branch:** `feat/animasi-pengendara`. **Prasyarat:** R13 Tugas 6 (pedal diam saat meluncur).

## Fakta kode (dicek 2026-11-14)

- `src/entities/Humanoid.anim.js` (diekspor ulang lewat `Humanoid.js:226`): `animateIdle(h, t)`, `animateWalk(h, t)`, `animateRun(h, t, speed = 4)`,
  `animateCycling(h, pedalAngle, geo = { crankR, bbY, bbZ })`, `animateUseItem(h, phase, style)`, …; privat: `solveLegIK(dy, dz, side, l1, l2)` (baris ±149–156),
  `applyPose(parts)`, `resetPose()` (mengosongkan buffer pose bersama `P` tiap panggilan, baris ±28–31).
- `animateCycling` (baris ±138–140) menyetel lengan **tetap**: `p.shL = -1.05; p.shR = -1.05; p.shLz = 0.15; p.shRz = -0.15; p.elL = -0.35; p.elR = -0.35; p.spine = 0.5; p.head = -0.45;`
  — tidak mengikuti setang, belokan, atau sprint.
- Setang: `src/entities/Bicycle.mesh.js` `BIKE_GEO { bb (0, 0.30, 0.05), saddle (0, 0.88, -0.18), headTop (0, 0.95, 0.42), headBottom (0, 0.76, 0.49), crankR 0.17, handlebarY 0.98 }`;
  pegangan di x ±0,24, y 0,98, z ≈ 0,48 (lokal sepeda), berputar dengan `parts.steer.rotation.y` (`Bicycle.js:283`).
- Ukuran rangka manusia: `src/entities/Humanoid.dim.js` `DIM { hipY 0.66, thigh 0.33, shin 0.31, shoulderY 0.44, shoulderX 0.2, upperArm 0.22, lowerArm 0.20, neckY 0.52 }`.
- `Bicycle.js:244` `this.#walkPhase += step * v / 1.4`; `:300–301` diam bila `|v| < 0.15`, selain itu **selalu** `animateWalk` (lari 4,2 m/s = siklus jalan dipercepat 3×).
- `src/entities/Walker.js` (dalam ruang) `update`: `this._phase += dt * Math.max(0.6, v / 1.35)` lalu `animateRun(h, this._phase, v)`; `animateRun` sendiri mengalikan
  frekuensi dengan laju (`freq = 1.3 + 0.35 * speed`) → irama lari terhitung dua kali (±5,7 langkah/detik di 3,2 m/s).
- `Bicycle.mesh.js:124–125`: garpu berputar pada sumbu tegak, padahal kepala rangka miring ±20°.

---

## Tugas 1: Jaring pengaman (tes pose)

**Berkas:** baru `tests/humanoidAnim.test.js`.

- [ ] Buat humanoid tiruan minimal yang dibutuhkan `applyPose`: baca `Humanoid.anim.js` untuk melihat field `h.parts` apa saja yang ditulis (sendi `hipL/hipR/kneeL/…`),
  lalu buat objek `{ parts: { <nama>: { rotation: { x: 0, y: 0, z: 0 }, position: { y: 0 } } … } }`. Tes dasar:
  - `animateIdle`, `animateWalk`, `animateRun`, `animateCycling` tidak menghasilkan `NaN` di sendi mana pun untuk `t` ∈ {0, 0.37, 10}.
  - `animateWalk(h, t)` dan `animateWalk(h, t + 1)` identik (periodik 1).
- [ ] Commit `test(animasi): jaring pengaman pose`.

## Tugas 2: Lengan ke setang (F11 / M6)

**Antarmuka murni baru (diekspor dari `Humanoid.anim.js`):**
```js
/** IK dua ruas di bidang sagital. dy, dz = selisih bahu → pegangan (m). @returns {{shoulder:number, elbow:number, reach:number}} reach = jarak / (l1 + l2), di-clamp ≤ 1 */
export function solveArmIK(dy, dz, l1, l2)
```
Rumus: `d = clamp(hypot(dy, dz), |l1 − l2| + 1e-4, l1 + l2 − 1e-4)`; sudut siku dalam `= acos((l1² + l2² − d²) / (2 l1 l2))`; `elbow = −(π − sudutSikuDalam)`;
`shoulder = atan2(dz, −dy) − acos((l1² + d² − l2²) / (2 l1 d))`. Konvensi tanda **harus dicocokkan** dengan `solveLegIK` yang sudah ada (baca dulu; lengan mengikuti konvensi kaki).

- [ ] Tes: lengan lurus ke bawah (`dy = −(l1 + l2) + 1e-3, dz = 0`) → `shoulder ≈ 0`, `elbow ≈ 0`; target di depan setinggi bahu → `shoulder ≈ −π/2`;
  target di luar jangkauan → `reach = 1` dan tidak `NaN`.
- [ ] `animateCycling(h, pedalAngle, geo, opts = {})` dengan `opts = { steer = 0, sprint = false, gripY, gripZ, gripX = 0.24 }`:
  - Posisi bahu di ruang sepeda = posisi pinggul (sadel) + rotasi punggung (`spine`) × `DIM.shoulderY`. **Baca hierarki `Humanoid.js` untuk memastikan punggung berputar di pinggul**;
    bila tidak, hitung sesuai hierarki yang ada dan tulis asumsi itu di komentar.
  - `dy = gripY − bahuY`, `dz = gripZ − bahuZ`; `solveArmIK` → `p.shL = p.shR = shoulder` (dikurangi rotasi punggung karena lengan anak dari badan), `p.elL = p.elR = elbow`.
  - Belok: pegangan kiri/kanan bergeser `∓ gripX * sin(steer)` di sumbu z → hitung IK **per sisi** dengan `dz ± gripX * Math.sin(steer)`.
  - `p.spine = sprint ? 0.65 : 0.5` (condong saat sprint); `p.head = -(p.spine - 0.05)` supaya kepala tetap tegak.
- [ ] `Bicycle.#riderGeo` / pemanggil `animateCycling` (`Bicycle.js` ±280–300): kirim `{ steer: this.state.steer, sprint: <perintah sprint frame ini>, gripY: BIKE_GEO.handlebarY, gripZ: 0.48 }`.
- [ ] **Cek dengan mata** (wajib, ini visual): `node tools/shots/kritik.mjs --out renders/kritik/r17 --hanya jalan`, buka `sekre-luar.jpg` — tangan pengendara berada di setang
  (bandingkan dengan `renders/kritik/dasar/sekre-luar.jpg`: lengan menggantung ke depan-bawah, tidak sampai setang). Ambil juga satu bidikan samping lewat POV yang ada.
- [ ] Commit `feat(animasi): lengan pengendara memegang setang`.

## Tugas 3: Lari terlihat lari; irama benar (F8, F9)

- [ ] `Bicycle.#applyOtherMode` (mode jalan): `|v| < 0.15` → `animateIdle`; `|v| < 2.0` → `animateWalk(rider, walkPhase)`; selain itu → `animateRun(rider, this.#idleT, Math.abs(v))`
  (`animateRun` menghitung frekuensinya sendiri dari waktu nyata; **jangan** beri fase jarak).
- [ ] `Walker.update`: tambah `this._runT += dt` dan panggil `animateRun(this.humanoid, this._runT, v)`; `_phase` hanya untuk jalan.
- [ ] Tes di `tests/humanoidAnim.test.js`: fungsi murni baru `export function runCadence(speed) → number` (langkah per detik; ambil dari rumus `freq` di `animateRun`)
  → pada 3,2 m/s hasilnya antara 2,4 dan 3,2. Bila rumus lama di luar rentang itu, setel konstanta `freq` (bukan pemanggilnya) sampai masuk.
- [ ] Commit `fix(animasi): lari memakai siklus lari dengan irama wajar`.

## Tugas 4: Perpindahan pose tanpa loncatan (F12)

**Rancangan:** pisahkan "menulis pose" dari "menerapkan pose".
- `poseIdle(t, out)`, `poseWalk(t, out)`, `poseRun(t, speed, out)`, `poseCycling(pedalAngle, geo, opts, out)` — menulis ke objek `out` (bentuk sama dengan buffer `P`).
- `export function blendPose(a, b, k, out)` — interpolasi linier tiap kunci numerik.
- `animateX(h, …)` lama tetap ada sebagai pembungkus (`poseX` → `applyPose`) supaya pemanggil lain (NPC, pedagang, pelari) tidak berubah.
- `Bicycle` dan `Walker` menyimpan `weight` (0 = pose A, 1 = pose B) yang bergerak ke sasaran dengan laju 8/detik, dan dua buffer pose **milik entitas** (dialokasi sekali di konstruktor).

- [ ] Tes: `blendPose(a, b, 0)` = a; `(…, 1)` = b; `(…, 0.5)` = rata-rata; kunci yang hanya ada di satu sisi dianggap 0 di sisi lain.
- [ ] Terapkan di tiga transisi: diam ↔ jalan, jalan ↔ lari, duduk di sepeda ↔ berdiri (ganti mode F). Tanpa alokasi per frame.
- [ ] Commit `feat(animasi): perpindahan pose dihaluskan`.

## Tugas 5: Garpu berputar di sumbu kepala rangka (F25, kosmetik)

- [ ] `Bicycle.mesh.js`: bungkus grup `steer` dalam grup poros yang diputar `x = -Math.atan2(0.07, 0.19)` (kemiringan `headTop → headBottom`), anak-anaknya dikoreksi balik
  supaya posisi diam tidak berubah. `Bicycle.js:283` tetap memutar `rotation.y` grup dalam.
- [ ] Cek dengan bidikan depan-samping saat setang dibelokkan penuh: roda depan tidak "bergeser ke samping". Commit `fix(sepeda): garpu berputar di sumbu kepala rangka`.

---

## Selesai bila

- `tests/humanoidAnim.test.js` lulus; lint bersih; bidikan `r17/sekre-luar.jpg` menunjukkan tangan di setang.
- Uji main 1 menit: bersepeda (tangan ikut belok), turun (F), jalan, lari (Shift): tidak ada pose yang meloncat.
- `M6` di `docs/KRITIK.md` jadi ✅; README rencana diperbarui.

## Tidak dikerjakan

- Bentuk tubuh, wajah, hijab, aksesori (M1, M2, M4, M5): menunggu rujukan user.
- Animasi NPC mahasiswa berbalik arah (F22) → R23.
