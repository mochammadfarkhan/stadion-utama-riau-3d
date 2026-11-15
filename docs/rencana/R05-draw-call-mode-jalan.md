# R05 — Draw call mode jalan kembali ke anggaran (M3 + temuan baru)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Anggaran proyek (`AGENTS.md`): **draw call region ≤ 250**. Terukur 2026-11-14 di preset Rendah:
> titik awal stadion **466–488**, depan sekre **504–511**, jalan kampus 460, rektorat 459. Ini hampir dua kali anggaran, di mesin sasaran yang paling lemah.

**Tujuan:** ≤ 300 draw call di depan sekre dan di titik awal stadion (langkah pertama; ≤ 250 setelah kartu lanjutan), tanpa perubahan yang terlihat.
**Pilar:** P-2 (lancar di laptop user). **Tonggak:** T1. **Branch:** `perf/draw-call-jalan`.

## Rincian terukur (`scene.traverseVisible`, belum dipotong frustum; jumlah mesh per kelompok)

| Titik | Kelompok | Mesh | Catatan |
|---|---|---|---|
| Awal stadion | `jangkarRegion/entitasRegion` | **167** | pelari 8, pejalan, pemain bola 10, pedagang, penonton 20 — humanoid detail penuh = ±15 mesh/orang dalam 60 m |
| keduanya | `entities/bicycle` | **57** (68 mesh) | rangka sepeda dari puluhan `CylinderGeometry`/`TorusGeometry`/`BoxGeometry` terpisah + pengendara + barang pegang kebun |
| Depan sekre | `region:unri-lembaga/lembaga:konten` | **188** | isi region hero Lembaga |
| Depan sekre | `distrik:unri/kehidupanKampus` | 63 | mahasiswa, motor, satpam |
| Depan sekre | `distrik:unri/unri:tanah-root` | 58 | chunk tanah + detail |
| keduanya | `world/modelBlender` | 29 | model GLB stadion |
| keduanya | `kota/kendaraanMangkal` | 24 | 1 bus + 3 angkot = 24 mesh |
| Depan sekre | `world/*` (stadion) | ±180 | **stadion masih terhitung terlihat dari 1,3 km** (fasad 24, tribun 24, lanskap 23, lapangan 16, lintasan 14, …) |

Alat ukur: skrip sementara yang menghitung mesh per kelompok induk tingkat dua. **Tugas 0 menjadikannya alat tetap.**

## Fakta kode

- `src/entities/Humanoid.lod.js`: `LOD_NEAR = 60`, `LOD_FAR = 320`, `lodLevelFor(dist2, near, far)`, `createHumanoidLod({ near, far })`; mahasiswa kampus sudah memakai 30 / 220 m.
  Tes `tests/humanoidLod.test.js` memakai konstanta (bukan angka), jadi mengubah nilai tidak mematahkan tes.
- `src/entities/index.js`: `createHumanoidLod()` tanpa argumen untuk semua entitas stadion.
- `src/entities/Bicycle.mesh.js` `createBicycleMesh({ frameColor, withBasket }) → { group, parts: { frame, steer, wheelF, wheelR, crankL, crankR, saddleMount } }`.
  Bagian yang **bergerak**: `steer` (garpu + setang + roda depan), `wheelF`, `wheelR`, `crankL`, `crankR`. Sisanya (`frame`) diam relatif satu sama lain.
- `src/regions/stadion/farDetail.js`: `FAR_DETAIL { hideAt, showAt }`, `applyFarHidden(roots, hidden)` mematikan **layer 0** (bukan `visible`) untuk detail stadion saat fokus jauh
  (tes `tests/stadionFarDetail.test.js`). `ARSITEKTUR.md` menyebut "detail > 650 m dimatikan".
- `src/engine/freezeStatic.js` (`freezeStatic(group)`) dan pola `mergeGeometries` + warna per vertex dipakai di banyak tempat (mis. `regions/stadion/proxy.js`, `interiors/sekre/index.js` `mergeStatic(root)`).

---

## Tugas 0: Alat rincian draw call

**Berkas:** baru `tools/shots/rincianDraw.mjs`.

- [ ] Pola `tools/shots/kritik.mjs` (preset dipaksa Rendah, `rig.exitPov({ instant: true })`, `settleAt`). Untuk tiap titik (`awal`, `sekre`, `unri-jalan`, `rektorat`) cetak:
  `renderer.info.render.calls`, lalu tabel 25 kelompok teratas `jumlah mesh · induk/anak` dengan dua hitungan: **semua yang `visible`** dan **yang lolos layer 0**
  (`o.layers.test(camera.layers)`), supaya detail yang dimatikan lewat layer tidak ikut terhitung. Opsi `--json <berkas>`.
- [ ] Jalankan; simpan keluaran ke `docs/rencana/data/rincian-draw-dasar.json`. Commit `chore(alat): rincian draw call per kelompok`.

## Tugas 1: LOD humanoid lebih dekat (M3)

- [ ] `src/entities/Humanoid.lod.js`: `LOD_NEAR = 60` → `28`. (Di atas 28 m humanoid = 1 mesh gabungan berpose statis; dari jarak itu di 0,75× resolusi beda pose tidak terbaca.)
- [ ] Pemain dan NPC cerita yang sedang diajak bicara tidak terpengaruh (jaraknya < 28 m).
- [ ] Ukur titik awal: harapan `entitasRegion` turun dari 167 ke < 60. **Bidik** `awal-sore.jpg` dan perbesar orang di plaza: tidak ada yang "membeku aneh" pada jarak 30–60 m.
  Bila pelari di lintasan tampak meluncur kaku, beri pelari ambang sendiri 40 m lewat `createHumanoidLod({ near: 40 })` terpisah untuk `runners`.
- [ ] Commit `perf(orang): detail penuh humanoid hanya dalam 28 m`.

## Tugas 2: Sepeda pemain dari 57 menjadi ≤ 14 draw call

**Rancangan:** gabungkan semua mesh **diam** di tiap grup bergerak menjadi satu mesh per material.

- [ ] Fungsi baru di `Bicycle.mesh.js`: `mergeByMaterial(group) → void` — kumpulkan anak `Mesh` langsung/tak langsung di `group` **yang tidak berada di bawah grup bergerak lain**,
  kelompokkan per `material.uuid`, terapkan matriks lokal relatif `group`, `mergeGeometries`, ganti dengan satu mesh per material, buang geometri lama.
  Terapkan pada: `parts.frame` (tanpa `steer`, roda, engkol), `parts.steer` (tanpa `wheelF`), `parts.wheelF`, `parts.wheelR`, `parts.crankL`, `parts.crankR`.
  Geometri campuran berindeks/tak berindeks: samakan dengan `toNonIndexed()` (pola di `proxy.js`).
- [ ] Tes baru `tests/bicycleMesh.test.js`: setelah `createBicycleMesh({})`, jumlah `Mesh` di `group` ≤ 14; `parts.steer`, `parts.wheelF`, `parts.wheelR`, `parts.crankL`, `parts.crankR` masih ada dan masih `Object3D`
  yang bisa diputar; kotak pembatas (`Box3().setFromObject(group)`) sama dengan sebelum digabung (toleransi 1 mm) — hitung kotak "sebelum" di tes dengan opsi `createBicycleMesh({ merge: false })`.
- [ ] Pengendara (humanoid pemain) tetap detail penuh. Barang pegang kebun (`EX_kebun…`) hanya ada saat dipegang; biarkan.
- [ ] Bidik `sekre-luar.jpg`: sepeda identik dengan dasar. Commit `perf(sepeda): gabung bagian diam rangka sepeda`.

## Tugas 3: Stadion benar-benar tidak digambar dari kampus

- [ ] Dengan alat Tugas 0 di titik `sekre` (1,3 km dari stadion): lihat kolom "lolos layer 0" untuk kelompok `world/*`. **Bila angkanya sudah ±0**, stadion memang tidak digambar
  (yang terhitung 180 hanya `visible`): tulis itu di laporan dan lewati tugas ini.
- [ ] Bila masih digambar: baca `src/regions/stadion/farDetail.js` dan pemanggilnya untuk melihat akar mana yang dijaga (`roots`). Tambahkan kelompok yang belum terjaga
  (kandidat dari tabel: `stadium-facade`, `tribune`, `landscape`, `pitch`, `track`, `signage`, `fixtures`, `terowongan`, `gapura`, `tiangPJU`) ke daftar itu, **kecuali** cangkang luar
  (`stadium-shell`) yang jadi siluet dari jauh. Jarak sembunyi tetap `FAR_DETAIL.hideAt`.
- [ ] Ukur ulang titik `sekre`. Commit `perf(stadion): detail stadion tidak digambar dari kampus`.

## Tugas 4: Kendaraan mangkal 24 → 4 draw call

- [ ] `src/city/parkedVehicles.js` `mountParkedVehicles`: setelah model GLB dimuat dan ditempatkan, gabungkan tiap kendaraan menjadi satu mesh per material
  (pola `mergeStatic(root)` di `src/interiors/sekre/index.js`; bila fungsi itu cukup umum, pindahkan ke `src/engine/` dan pakai bersama — `city/` tidak boleh mengimpor `interiors/`).
  Collider kendaraan (`vehicleCircles`) tidak berubah.
- [ ] Ukur; commit `perf(kota): kendaraan mangkal digabung per material`.

## Tugas 5: Isi region Lembaga (188) — ukur dulu, baru putuskan

- [ ] Jalankan alat Tugas 0 dengan kedalaman satu tingkat lagi **di dalam** `lembaga:konten` (opsi `--dalam region:unri-lembaga/lembaga:konten`) dan tulis 15 kelompok teratas ke laporan.
- [ ] Untuk tiap kelompok > 10 mesh yang **statis** dan **tidak butuh interaksi per-objek**: gabung per material (pola Tugas 4). Kelompok yang berulang (kursi, pot, motor) → `InstancedMesh`.
  Jangan menyentuh pintu-portal, NPC cerita, dan objek yang dipakai `heroLod`.
- [ ] Target titik `sekre`: ≤ 300 total. Bila setelah tugas 1–5 masih > 300, tulis rincian sisa di laporan; itu jadi bahan kartu lanjutan (jangan memaksakan penggabungan yang berisiko).
- [ ] Commit per kelompok yang digabung.

## Angka (isi saat mengerjakan)

| Titik | Dasar | T1 | T2 | T3 | T4 | T5 | Target |
|---|---|---|---|---|---|---|---|
| awal stadion | 466–488 | | | | | | ≤ 300 |
| depan sekre | 504–511 | | | | | | ≤ 300 |
| jalan kampus | 460 | | | | | | ≤ 300 |
| rektorat | 459 | | | | | | ≤ 300 |

## Selesai bila

- Target tabel tercapai atau sisa dijelaskan dengan angka; tes `tests/humanoidLod.test.js tests/bicycleMesh.test.js tests/parkedVehicles.test.js` lulus; lint bersih.
- Bidikan `awal-sore.jpg`, `sekre-luar.jpg` sesudah tidak bisa dibedakan dari dasar dengan mata.
- `docs/ARSITEKTUR.md` bagian Anggaran: ganti "terukur 134–197 per titik di GPU kuat" dengan angka baru + tanggal + preset; `docs/KRITIK.md` (M3 + temuan G9 baru), README rencana diperbarui.
