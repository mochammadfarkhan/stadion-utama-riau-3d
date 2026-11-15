# R23 — Kehidupan jalan di mode jalan (Putaran 2: F20–F22)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Logika murni di `src/sim/campusLife.js` (tes `tests/campusLife.test.js`) dan
> `src/city/farLife.js` (tes `tests/city/farLife.test.js`). **Anggaran:** tambahan ≤ 6 draw call, semua lewat instancing.

**Tujuan:** dunia bereaksi pada pemain: orang menepi saat dibel, mobil lewat di jalan besar.
**Pilar:** P-3 (selalu ada kehidupan), P-1. **Tonggak:** T2. **Branch:** `feat/kehidupan-jalan`.

## Fakta kode (dicek 2026-11-14)

- Mahasiswa: `src/districts/unri/students.js` (`STUDENT_POOL 40`, `ACTIVE_RADIUS 300`, `RELEASE_RADIUS 420`), gerak dari `src/sim/campusLife.js`:
  `createWalker(path, rng)`, `stepWalker(w, path, dt, rng)` (baris ±234–242, **tidak menerima posisi pemain**), `walkerPose(w, path) → {x, z, yaw}` (±244–250),
  `WALK_SPEED [1.0, 1.5]`, `END_PAUSE [1.5, 6]`, `LATERAL 0.8`. Di ujung jalur: `dir: -w.dir` dan yaw langsung berbalik 180°.
- Bel: `Bicycle#ring()` (`Bicycle.js:217–220`) → `onRing` → `main.js:563` `story.onBell()` → hanya menyetel bendera cerita. Tidak ada NPC yang bereaksi.
- Mahasiswa tidak ada di collider: sepeda menembus mereka.
- Lalu lintas bergerak hanya ada di mode Kota: `src/city/index.js:141–156` membuat `createFarCity` di dalam `setPreview(true)`; `src/city/farLife.js`
  (`createLane(id, cls, pts, minLength)`, `pointAt(lane, s, out)`, `trafficDensity(hour)`, `selectLanes(lanes, x, z, R)`, `carsOnLane(lane)`, `SPEED = [17, 15, 13, 10, 8]`,
  `LIFE.carScale 1.8`, `LIFE.minRadius 450`).
- Kendaraan parkir statis: `src/city/parkedVehicles.js` (1 bus di halte + 3 angkot).

---

## Tugas 1: Mahasiswa menepi dari sepeda dan saat dibel (F21)

**Antarmuka murni baru (`src/sim/campusLife.js`):**
```js
/**
 * Geser menyamping pejalan agar memberi jalan. pose = hasil walkerPose; player = {x, z, vx, vz}.
 * @returns {{ side: number, pause: boolean }} side = geseran menyamping sasaran (m, tanda = sisi menjauh dari pemain), pause = berhenti sejenak
 */
export function yieldToPlayer(pose, player, { radius = 3, bellRadius = 12, sideMax = 1.2, ringing = false } = {})
```
Aturan: jarak `d` pemain→pejalan. Bila `ringing` dan `d < bellRadius` → `side = sideMax` ke sisi menjauh. Bila `d < radius` **dan** pemain mendekat (`dot(v_pemain, pejalan − pemain) > 0`)
→ `side = sideMax * (1 − d / radius)`, `pause = d < 1.2`. Selain itu `{ side: 0, pause: false }`. Sisi menjauh = tanda dari hasil kali silang arah pemain × vektor ke pejalan.

- [ ] Tes: pemain jauh → nol; pemain 2 m di belakang mendekat → `side ≠ 0`, tanda sesuai sisi; pemain menjauh → nol; bel pada 10 m → `side = ±1.2`; `d = 1` → `pause true`.
- [ ] `students.js` `animate(dt)`/`update`: terima `player` dari ctx (posisi dunia sepeda + kecepatan `v·sin(yaw), v·cos(yaw)`), simpan `sideNow` per pejalan yang bergerak
  ke `side` sasaran dengan laju 2 m/s, tambahkan ke posisi tegak lurus arah jalur. `pause` menahan `stepWalker`. Tidak ada alokasi per frame.
- [ ] Bel: `ents.bike.onRing` di `main.js:563` juga menyetel `ringUntil = time + 1.2` yang diteruskan ke distrik sebagai `ringing`. Layanan distrik (`districtServices`, `main.js:263–268`)
  mendapat `player: () => ({ x, z, vx, vz, ringing })` (objek scratch, diisi ulang).
- [ ] Uji main: bersepeda ke arah mahasiswa → mereka menepi; bel dari 10 m → menepi lebih awal. Commit `feat(kampus): mahasiswa menepi dari sepeda dan bel`.

## Tugas 2: Berbalik arah tanpa meloncat 180° (F22)

- [ ] `stepWalker`: saat tiba di ujung, simpan `turnFrom = yaw lama`, `turnT = 0`; selama jeda, `turnT` naik sampai 0,6 detik. `walkerPose` mengembalikan yaw
  hasil interpolasi `turnFrom → yaw baru` (lewat sudut terpendek) selama `turnT < 0.6`.
- [ ] Tes: tepat setelah berbalik `yaw ≈ lama`; setelah 0,3 detik di tengah; setelah 0,6 detik = baru. Commit `fix(kampus): mahasiswa berbalik arah dengan halus`.

## Tugas 3: Mobil lewat di jalan besar (F20)

**Rancangan:** pakai ulang fungsi murni `farLife.js` di sistem baru jarak dekat, dengan mobil skala 1 dan jalur dari data jalan **tile kota yang sudah dimuat**.

**Sebelum menulis kode, jawab dua pertanyaan ini dengan membaca kode (tulis jawabannya di laporan):**
1. Dari mana `farLife` mendapat jalur (`lanes`)? Lihat `src/city/farCity.js` pemanggil `createFarLife`/`createLane` dan berkas data di `public/far/`.
   Apakah data itu bisa dimuat tanpa mengaktifkan mode Kota (tanpa membuat InstancedMesh bangunan)?
2. Berapa besar berkas jalurnya (byte)? Bila > 1 MB, muat hanya saat pemain pertama kali berada dalam 150 m dari jalan kelas 0–2.

**Antarmuka (`src/city/nearTraffic.js`, baru):**
`createNearTraffic({ parent, lanes, heightAt, hour, maxCars = 40, radius = 260 }) → { update(dt, focus, player), dispose(), readonly count }`
- 1 `InstancedMesh` badan mobil (kotak berpelat, ≤ 60 segitiga) + 1 untuk lampu (pakai `carLightsGeometry()` dari `farLife.js`) = **2 draw call**.
- Jalur dipilih `selectLanes(lanes, focus.x, focus.z, radius)`; jumlah mobil per jalur dari `carsOnLane(lane)` × `trafficDensity(hour())`, total ≤ `maxCars`.
- Hanya kelas jalan 0–2 (arteri/kolektor). Tidak ada mobil di jalan kampus.

**Murni baru (`farLife.js`):** `export function carGap(sAhead, sSelf, minGap = 8) → number` (pengali laju 0..1: 1 bila selisih ≥ 2×minGap, 0 bila ≤ minGap, linier di antaranya).
Mobil melambat di belakang pemain yang berada di jalur yang sama (proyeksikan posisi pemain ke jalur; bila jarak tegak lurus < 2,5 m, perlakukan pemain sebagai "mobil di depan").

- [ ] Tes `carGap` (3 titik) dan pemilihan mobil (`maxCars` dihormati; jalur kelas 3–4 diabaikan).
- [ ] Sistem `{ id: 'nearTraffic', phase: 'sim' }`, **mati** saat mode Kota aktif (mobil jauh mengambil alih) dan saat `graphics.preset = 'rendah'` **kecuali** ukuran menunjukkan
  biaya < 1 ms/frame di laptop user — default: aktif di semua preset dengan `maxCars` 16 di Rendah, 40 di Sedang/Tinggi (kunci baru di `QUALITY_PRESETS`: `'world.trafficCars'`).
- [ ] Mobil **tidak** masuk collider pada tahap ini (menembus pemain lebih baik daripada menjebak pemain). Catat sebagai keterbatasan.
- [ ] Ukur: `node tools/shots/kritik.mjs --hanya jalan` → `calls` di `awal-sore` naik ≤ 2. Commit `feat(kota): mobil lewat di jalan besar pada mode jalan`.

---

## Selesai bila

- Tes `tests/campusLife.test.js` dan `tests/city/farLife.test.js` lulus; lint bersih; draw call naik ≤ 2 di titik ukur.
- Uji main: keluar gerbang kampus ke jalan raya → ada mobil lewat dua arah; jam 23 → jauh lebih sepi.

## Tidak dikerjakan

- Mobil yang bisa dikendarai pemain, motor → R25. Tabrakan dengan mobil. Pejalan kaki di luar kampus.
