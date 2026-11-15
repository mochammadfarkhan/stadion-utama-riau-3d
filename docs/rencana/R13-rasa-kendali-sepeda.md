# R13 — Rasa kendali sepeda (Putaran 2: F1–F5, F10, F23)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Semua perubahan di sini murni (`src/sim/bikePhysics.js`,
> `src/config/constants.js`) kecuali Tugas 4 yang menyentuh `src/entities/Bicycle.js`. Kerjakan berurutan; tiap tugas = 1 commit.

**Tujuan:** sepeda enak dikendarai tanpa tujuan: belok tidak "kedutan" di kecepatan tinggi, meluncur saat kayuhan dilepas,
menyenggol dinding tidak menghentikan sepeda.
**Pilar:** P-2 (bergerak itu enak). **Tonggak:** T1. **Branch:** `feat/rasa-kendali`.
**Prasyarat:** tidak ada. **Uji akhir wajib oleh manusia:** bersepeda 3 menit di kampus (lihat "Selesai bila").

## Fakta kode yang dipakai (dicek 2026-11-14)

- `src/config/constants.js:90–114` `BIKE`: `maxSpeed 9`, `sprintSpeed 13`, `accel 3.5`, `brake 7`, `drag 0.6`, `turnRate 1.6`
  (**tidak dibaca siapa pun**), `leanMax 0.35`, `wheelBase 1.05`, `steerMax 0.6`, `steerRate 4`, `steerSpeedFactor 0.08`,
  `pedalRatio 0.45`, `kSlope 0.55`, `glidePerGrade 100`, `overspeedDecel 2.5`.
- `src/config/kebun.js:68–73` `TRACTOR = {...BIKE, maxSpeed 4.2, sprintSpeed 6, accel 1.8, drag 0.9, leanMax 0, wheelBase 1.7, ...}`:
  setiap kunci baru di `BIKE` otomatis ikut ke traktor kecuali ditimpa.
- `src/sim/bikePhysics.js`: `updateSpeed` (baris 40–57), `updateSteer` (59–64), `stepBike` (79–104). Tes: `tests/bikePhysics.test.js`
  (`DT = 1/60`, pembantu `run(state, input, detik)` dan `runG(state, input, detik, grade)`, `moving(v)`, `PEDAL`, `COAST`).
- `src/entities/Bicycle.js:29` `COLLISION_DAMPING = 0.5`; `#resolveCollision(s)` (baris 255–262) mengalikan `v` dengan 0,5 **tiap frame**
  selama collider menggeser posisi, tanpa memutar arah hadap. `update()` (baris 233–243) memanggilnya dengan state hasil langkah.
- `src/core/Collider.js:139–152` `createCollider` hanya menggeser sepanjang sumbu X atau Z dunia.

Kenapa ini masalah (hitungan dari konstanta):
- Di 9 m/s: sudut setang 0,6 / (1 + 0,08·9) = 0,349 rad → radius belok 1,05 / tan(0,349) = **2,9 m**, percepatan samping 28 m/s²
  (±2,9 g). Sepeda berputar di tempat; lean mentok di `leanMax`.
- Lepas W di 9 m/s: perlambatan 0,6·9 = 5,4 m/s², berhenti dalam ±15 m. Tidak ada rasa meluncur.
- Lepas Shift di 13 m/s: laju dipotong ke 9 m/s dalam **satu frame**.

---

## Tugas 1: Batas belok dari percepatan samping (F1)

**Berkas:** `src/config/constants.js`, `src/sim/bikePhysics.js`, `tests/bikePhysics.test.js`.

**Antarmuka baru:** `export function steerLimit(v: number, cfg = BIKE): number` (rad, ≥ 0) di `bikePhysics.js`.
Nilai = yang terkecil dari batas lama `cfg.steerMax / (1 + cfg.steerSpeedFactor * |v|)` dan batas percepatan samping
`Math.atan(cfg.wheelBase * cfg.latAccelMax / Math.max(v * v, 1e-3))`. Bila `cfg.latAccelMax` tidak ada → batas lama saja.

- [ ] **Langkah 1: tes gagal dulu.** Tambah impor `steerLimit`, lalu di `describe('stepBike', …)`:
  ```js
  it('steerLimit: kecepatan rendah memakai batas lama, kecepatan tinggi dibatasi percepatan samping', () => {
    expect(steerLimit(2, BIKE)).toBeCloseTo(0.6 / (1 + 0.08 * 2), 9);
    expect(steerLimit(9, BIKE)).toBeCloseTo(Math.atan((1.05 * 9) / 81), 9);
    expect(steerLimit(-9, BIKE)).toBeCloseTo(steerLimit(9, BIKE), 9);
  });
  it('belok penuh di laju puncak: percepatan samping tidak melewati latAccelMax', () => {
    const cruising = run(createBikeState(), { pedal: 1, steer: 0, sprint: false }, 6);
    const s = run(cruising, { pedal: 1, steer: 1, sprint: false }, 2);
    const yawRate = (s.v / BIKE.wheelBase) * Math.tan(s.steer);
    expect(s.v * yawRate).toBeLessThanOrEqual(BIKE.latAccelMax + 0.01);
    expect(s.v * yawRate).toBeGreaterThan(BIKE.latAccelMax * 0.8);
  });
  ```
- [ ] **Langkah 2: jalankan, gagal** (`steerLimit is not a function`): `node node_modules/vitest/vitest.mjs run tests/bikePhysics.test.js`.
- [ ] **Langkah 3: konstanta.** Di `BIKE`: tambah `latAccelMax: 9, // m/s² percepatan samping maksimum saat belok (±0,9 g)`;
  ubah `leanMax: 0.35` → `leanMax: 0.6`; **hapus** baris `turnRate: 1.6` (mati; `grep -rn "turnRate" src` hanya boleh menyisakan
  `WALK.turnRate` di `config/kebun.js` dan pemakainya di `sim/farm.js`).
  Di `src/config/kebun.js` `TRACTOR`: tambah `latAccelMax: 3`.
- [ ] **Langkah 4: implementasi.** Tulis `steerLimit`, lalu di `updateSteer` ganti dua baris pertama dengan
  `const target = input.steer * steerLimit(v, cfg);`.
- [ ] **Langkah 5: tes lulus.** Tes lama "belok kanan: yaw naik dan lean negatif" harus tetap lulus tanpa diubah.
- [ ] **Langkah 6: commit** `feat(sepeda): batas belok dari percepatan samping`.

Hasil yang diharapkan: di 9 m/s radius belok ±9 m (dulu 2,9 m); di bawah ±5 m/s tidak ada perubahan.

## Tugas 2: Meluncur saat kayuhan dilepas (F3)

**Berkas:** `src/config/constants.js`, `src/sim/bikePhysics.js:50`, `tests/bikePhysics.test.js`.

Keputusan angka: `drag: 0.6` → `drag: 0.15` (hambatan udara, sebanding laju) + kunci baru `rollDecel: 0.3` (m/s², hambatan gulir
tetap, supaya sepeda benar-benar berhenti). Dari 9 m/s di jalan datar: berhenti dalam ±11,4 detik setelah ±37 m (dulu ±15 m).
`TRACTOR` menimpa `drag: 0.9` sendiri dan mewarisi `rollDecel`; itu tidak apa-apa.

- [ ] **Langkah 1: ubah tes yang sengaja berubah + tambah tes baru.**
  - Tes "turunan 6% tanpa kayuh…": harapan pertama menjadi `expect(runG(moving(9), COAST, 40, -0.06).v).toBeCloseTo(6.16, 1);`
    (rumus titik seimbang: 6 + (9,81·0,06·0,55 − 0,3) / 0,15 = 6,158; **durasi dinaikkan 20 → 40 detik** karena dengan drag kecil konvergensinya lebih lambat),
    dan ubah judulnya jadi `±6,16 m/s`. Harapan kedua (datar: berhenti dalam 20 s, `< 0.01`) **tetap**.
  - Tambah:
    ```js
    it('meluncur di datar: dari 9 m/s masih di atas 4,5 m/s setelah 3 detik, berhenti total sebelum 13 detik', () => {
      expect(runG(moving(9), COAST, 3, 0).v).toBeGreaterThan(4.5);
      expect(runG(moving(9), COAST, 13, 0).v).toBeLessThan(0.001);
    });
    ```
    (Hitungan: v(t) = 11·e^(−0,15 t) − 2 → 5,01 m/s pada t = 3 s; nol pada t = 11,4 s.)
- [ ] **Langkah 2: jalankan, gagal** (nilai lama: ±1,5 m/s setelah 3 detik).
- [ ] **Langkah 3: implementasi.** Konstanta di `BIKE`: `drag: 0.15`, tambah `rollDecel: 0.3`. Di `updateSpeed`, ganti baris
  `if (input.pedal <= 0) next -= cfg.drag * …` dengan:
  ```js
  if (input.pedal <= 0) {
    next -= cfg.drag * (next > 0 ? Math.max(0, next - glide) : next) * dt; // hambatan udara (sebanding laju)
    if (next > glide) next = Math.max(glide, next - (cfg.rollDecel ?? 0) * dt); // hambatan gulir (tetap): benar-benar berhenti
  }
  ```
- [ ] **Langkah 4: tes lulus semua.** Bila tes lain di berkas ini gagal, **jangan ubah konstanta**: hitung ulang harapan tes itu dari rumus
  di atas dan catat di laporan.
- [ ] **Langkah 5: commit** `feat(sepeda): meluncur lebih jauh saat kayuhan dilepas`.

## Tugas 3: Lepas sprint melambat halus (F4)

**Berkas:** `src/sim/bikePhysics.js:55`, `tests/bikePhysics.test.js:111–114`.

- [ ] **Langkah 1: ubah tes.** Di tes "paritas jalan datar…", ganti baris kedua menjadi
  `expect(stepBike(moving(13), PEDAL, DT).v).toBeCloseTo(13 - BIKE.overspeedDecel * DT, 9);` dan ubah judul tes: buang kata
  "tetap dipotong seketika", ganti "lepas sprint di datar melambat 2,5 m/s²". Tambah:
  ```js
  it('lepas sprint: dari 13 m/s turun ke maxSpeed dalam ±1,6 detik, tidak pernah di bawahnya', () => {
    expect(runG(moving(13), PEDAL, 1, 0).v).toBeCloseTo(10.5, 1);
    expect(runG(moving(13), PEDAL, 3, 0).v).toBeCloseTo(BIKE.maxSpeed, 6);
  });
  ```
- [ ] **Langkah 2: implementasi.** Ganti baris `if (next > top) next = grade > 0 ? … : top;` dengan
  `if (next > top) next = Math.max(top, Math.min(next, v) - (cfg.overspeedDecel ?? Infinity) * dt);` dan perbarui komentar di atasnya.
- [ ] **Langkah 3: tes lulus; commit** `feat(sepeda): lepas sprint melambat halus`.

## Tugas 4: Menyenggol dinding = bergeser, bukan berhenti (F2)

**Berkas:** `src/sim/bikePhysics.js`, `src/entities/Bicycle.js`, `tests/bikePhysics.test.js`.

**Antarmuka baru (murni, di `bikePhysics.js`):**
```js
/**
 * Respons geser saat collider memindahkan posisi. intended = langkah yang diminta, actual = langkah yang diizinkan.
 * Laju berkurang sebanding bagian langkah yang hilang, arah hadap berputar pelan ke arah geser.
 * @returns {{v:number, yaw:number}}
 */
export function slideResponse(v, yaw, intended, actual, dt, { alignRate = 6, friction = 6 } = {}) {
  const i2 = intended.dx * intended.dx + intended.dz * intended.dz;
  const lx = intended.dx - actual.dx;
  const lz = intended.dz - actual.dz;
  if (!(i2 > 1e-12) || !(lx * lx + lz * lz > 1e-12)) return { v, yaw }; // tidak bergerak, atau langkah tidak dipotong
  const kept = clamp((actual.dx * intended.dx + actual.dz * intended.dz) / i2, 0, 1);
  const nextV = v * (1 - (1 - kept) * Math.min(1, friction * dt));
  if (!(actual.dx * actual.dx + actual.dz * actual.dz > 1e-12)) return { v: nextV, yaw };
  const dir = v >= 0 ? 1 : -1;
  const want = Math.atan2(actual.dx * dir, actual.dz * dir);
  const diff = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
  const turn = clamp(diff, -alignRate * dt, alignRate * dt);
  return { v: nextV, yaw: yaw + turn };
}
```
(Badan fungsi ditulis lengkap karena tanda tangan + tes tidak menentukan algoritmenya. `clamp` sudah ada di berkas itu.)

- [ ] **Langkah 1: tes gagal dulu** (`describe('slideResponse', …)`, impor `slideResponse`):
  ```js
  const D = 1 / 60;
  it('langkah tidak dipotong: tidak ada perubahan', () => {
    expect(slideResponse(8, 0.3, { dx: 1, dz: 2 }, { dx: 1, dz: 2 }, D)).toEqual({ v: 8, yaw: 0.3 });
  });
  it('geser 45° sepanjang dinding: kehilangan 5% per frame, arah hadap memutar 0,1 rad ke arah geser', () => {
    const r = slideResponse(8, Math.PI / 4, { dx: 1, dz: 1 }, { dx: 1, dz: 0 }, D);
    expect(r.v).toBeCloseTo(8 * (1 - 0.5 * 0.1), 9);
    expect(r.yaw).toBeCloseTo(Math.PI / 4 + 0.1, 9);
  });
  it('mentok tegak lurus: laju turun 10% per frame, arah hadap tetap', () => {
    const r = slideResponse(8, 0, { dx: 0, dz: 1 }, { dx: 0, dz: 0 }, D);
    expect(r.v).toBeCloseTo(7.2, 9);
    expect(r.yaw).toBe(0);
  });
  it('setelah sejajar dinding, laju tidak berkurang lagi', () => {
    expect(slideResponse(6, Math.PI / 2, { dx: 1, dz: 0 }, { dx: 1, dz: 0 }, D).v).toBe(6);
  });
  ```
- [ ] **Langkah 2: jalankan, gagal; tulis fungsi; tes lulus.**
- [ ] **Langkah 3: pakai di `Bicycle.js`.** Hapus konstanta `COLLISION_DAMPING`. Ubah `#resolveCollision(s)` menjadi `#resolveCollision(s, prev, dt)`:
  bagian awal sama (tanpa collider / posisi tidak berubah → kembalikan `s`), lalu
  ```js
  const r = slideResponse(s.v, s.yaw, { dx: s.x - prev.x, dz: s.z - prev.z }, { dx: c.x - prev.x, dz: c.z - prev.z }, dt);
  return { ...s, x: c.x, z: c.z, v: r.v, yaw: r.yaw };
  ```
  Di `update()`: simpan `const prev = this.state;` sebelum langkah, dan panggil `this.#resolveCollision(next, prev, step)`.
  Mode `'jalan'` memakai jalur yang sama (itu yang diinginkan: pejalan juga bergeser).
- [ ] **Langkah 4: cek.** `npm run lint`; `node node_modules/vitest/vitest.mjs run tests/bikePhysics.test.js tests/terrainFollow.test.js tests/collider.test.js`.
- [ ] **Langkah 5: commit** `feat(sepeda): menyenggol dinding bergeser, tidak berhenti mendadak`.

**Sengaja tidak dikerjakan:** mengubah `createCollider` supaya mencoba arah miring. Dinding diagonal masih bisa mentok;
catat di laporan bila terasa saat uji main, itu jadi kartu lanjutan.

## Tugas 5: Akselerasi melandai menjelang laju puncak (F5)

**Berkas:** `src/config/constants.js`, `src/sim/bikePhysics.js:44–45`, `tests/bikePhysics.test.js`.

- [ ] **Langkah 1: tes gagal dulu.**
  ```js
  it('akselerasi melandai: detik pertama menambah laju lebih banyak daripada detik ketiga', () => {
    const P = { pedal: 1, steer: 0, sprint: false };
    const a = run(createBikeState(), P, 1).v;
    const b = run(createBikeState(), P, 2).v;
    const c = run(createBikeState(), P, 3).v;
    expect(a).toBeGreaterThan(4);
    expect(c - b).toBeLessThan(a * 0.5);
  });
  ```
- [ ] **Langkah 2: implementasi.** `BIKE.accel: 3.5` → `5`. Di `updateSpeed`, ganti `next += cfg.accel * input.pedal * dt;` dengan
  `next += cfg.accel * input.pedal * Math.max(0.15, 1 - (Math.max(0, v) / top) ** 2) * dt; // melandai; lantai 0,15 agar tetap mencapai puncak`.
- [ ] **Langkah 3: tes lulus** (termasuk "batas kecepatan…" dan "dt besar di-clamp" yang lama, tanpa diubah). **Commit** `feat(sepeda): akselerasi melandai menjelang laju puncak`.

## Tugas 6: Pedal berhenti berputar saat meluncur (F10)

**Berkas:** `src/sim/bikePhysics.js:102`, `tests/bikePhysics.test.js`.

- [ ] **Langkah 1: tes gagal dulu.**
  ```js
  it('pedal tidak berputar saat meluncur atau mengerem; roda tetap berputar', () => {
    const moving = run(createBikeState(), { pedal: 1, steer: 0, sprint: false }, 3);
    const coast = run(moving, { pedal: 0, steer: 0, sprint: false }, 1);
    expect(coast.pedalAngle).toBe(moving.pedalAngle);
    expect(coast.wheelSpin).toBeGreaterThan(moving.wheelSpin);
  });
  ```
- [ ] **Langkah 2: implementasi.** `pedalAngle: s.pedalAngle + (inp.pedal > 0 ? Math.max(0, spin) * cfg.pedalRatio : 0),`
- [ ] **Langkah 3: tes lulus; commit** `fix(sepeda): pedal diam saat meluncur`.

---

## Selesai bila

- `npm run lint` bersih; `node node_modules/vitest/vitest.mjs run tests/bikePhysics.test.js tests/terrainFollow.test.js tests/farm.test.js` lulus.
- **Uji main oleh manusia** (tidak bisa diganti tes): `npm run dev`, bersepeda dari sekre ke gerbang kampus.
  1. Di laju puncak, tahan A/D: sepeda menikung lebar, tidak berputar di tempat.
  2. Lepas W di laju puncak: sepeda meluncur ±2 lebar jalan sebelum terasa melambat.
  3. Senggol tembok gedung dengan sudut landai: sepeda menyusur tembok dan tetap melaju.
  4. Sprint lalu lepas Shift: tidak ada sentakan.
- Tulis di laporan PR: angka mana yang terasa perlu disetel. Yang boleh disetel tanpa bertanya: `latAccelMax` (7–11),
  `drag` (0,1–0,25), `rollDecel` (0,2–0,5). Sesuaikan harapan tes dengan rumus di tiap tugas.
- Tandai baris R13 di `docs/rencana/README.md` dan butir "Rasa kendali" di `docs/KRITIK.md`.

## Tidak dikerjakan di sini

- Masukan analog gamepad/sentuh (F6) → R14. Kamera (F15–F18) → R15. Animasi pengendara (F8–F12) → R17.
- Jalan kaki luar ruang memakai kendali tank (F7) → R14.
