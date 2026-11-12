# Peta arsitektur (titik masuk dokumentasi)

> Baca berkas ini dulu sebelum menjelajah kode. Perbarui bila menambah lapisan, sistem per-frame,
> region/distrik, atau mengubah anggaran. Terakhir diperbarui: 2026-10-27.

## Angka cepat (2026-10-27)

| Hal | Nilai |
|---|---|
| Kode `src/` | ±52.800 baris JS, ±440 berkas; terbesar `world/` (17,3 rb), `regions/` (7,1 rb) |
| Tes | 142 berkas di `tests/` (Vitest, hanya logika berisiko) |
| Aset `public/` | 34 MB (KTX2 + GLB); berkas terbesar ±1,2 MB |
| Bundel build | `three` ±700 KB + kode aplikasi ±300 KB (dist lama, belum diukur ulang) |
| Rencana/spec | `docs/superpowers/plans/` (18), `docs/superpowers/specs/` (6) |

## Lapisan (`src/`) dan siapa boleh mengimpor siapa

Aturan dipaksa oleh `eslint.config.js` (`no-restricted-imports`). Urutan kira-kira dari paling murni ke paling atas:

| Lapisan | Isi | Catatan aturan |
|---|---|---|
| `config/`, `geo/` | konstanta, data, matematika poligon | murni: tanpa `three`, tanpa lapisan lain |
| `shared/` | utilitas kecil lintas lapisan | tanpa lapisan lain |
| `engine/` | `SystemRunner`, scheduler, frameCap, qualityTier, disposeTree | tanpa lapisan lain |
| `sim/` | logika permainan murni (kebun, inventory, partikel, dompet, siklus hari) | hanya `engine` |
| `story/` | data bab/NPC/titik | tanpa `three`, hanya `sim` |
| `world/` | rendering dunia: tanah, rumput, pohon, langit, cuaca, kit gedung, tekstur, shader | tidak boleh ke ui/core/entities/regions/districts/city/app |
| `entities/` | sepeda, humanoid, kendaraan | — |
| `city/` | streaming tile kota (`ChunkStreamer`, `TileLoader`) | hanya bawah `world` |
| `regions/` | region (stadion, unri-lembaga, unri-rektorat) + `heroLod` | tidak ke ui/core/app/districts/city |
| `districts/` | distrik besar (UNRI) + `terrainChunks` | — |
| `interiors/` | interior (sekre ERC D5, tribun) | — |
| `core/` | `App` (renderer, loop), kamera, input, collider, audio, StoryDirector | tidak ke ui/app/districts, tidak ke `world/stadium` |
| `ui/` | HUD, menu, panel, minimap, inventory, sentuh | tidak ke `app` |
| `app/` | perekat fitur: regionManager, mount, farm, shop, quality, session | — |
| `main.js` | **composition root**: merakit semuanya | tidak boleh diimpor siapa pun |

## Alur boot (`src/main.js`)

1. `App` dibuat (renderer, scene, kamera) → cek WebGL.
2. Layar muat (`ui/LoadingScreen`) melangkah: tekstur prosedural → region stadion (persistent) →
   distrik UNRI (`mountDistrict`) → entitas → waktu/cuaca → cerita → HUD/minimap.
3. Tiap modul mendaftar ke loop lewat `app.addSystem({ id, phase, update(dt, ctx) })`.
4. `regionManager.update(focus)` tiap frame memasang/melepas region streaming.

## Loop per frame

`App` menjalankan sistem per **fase** (urutan tetap): `input` → `sim` → `world` → `ui`, lalu render.
Contoh: `gamepad` (input), `entities.N` + `regions` (sim), `timeOfDay` → `weather` → `heroOrnaments`
(world), `scheduler` + HUD/minimap (ui). Batas FPS (`engine/frameCap.js`) memotong frame sebelum semua ini.

Aturan praktis untuk sistem baru:
- Jangan alokasi (`new THREE.Vector3` dll.) di dalam `update`; simpan scratch di closure modul.
- Kerja berat yang tidak perlu tiap frame → `scheduler` (dicicil), bukan di `update`.
- Pasang/lepas harus simetris: semua yang dibuat saat mount punya `dispose` (lihat `engine/disposeTree.js`).

## Dunia: siapa dipasang kapan

| Bagian | Cara aktif | LOD/penghematan |
|---|---|---|
| Stadion (`regions/stadion`) | `activation.persistent` — selalu terpasang | detail > 650 m dimatikan |
| UNRI lembaga / rektorat | streaming jarak (mountRadius/unmountRadius, histeresis, 1 mount/500 ms) | proxy siluet > 900 m; hero LOD1/tengah > 300 m |
| Distrik UNRI (`districts/unri`) | dipasang saat boot | `terrainChunks`, gedung kit 150/900 m |
| Kota (`city/`) | tile streaming (`ChunkStreamer`) | tile di luar radius dilepas |
| Pohon/humanoid/rumput | instancing | LOD per jenis |

## Anggaran (dari AGENTS.md)

- Draw call region ≤ 250 (terukur 134–197 per titik di GPU kuat).
- Tekstur GPU ≤ 70 MB (PBR KTX2 ±16 MB).
- Konten berulang lewat generator + instancing.

## Titik lemah yang diketahui (jujur)

1. **`main.js` terlalu gemuk** — 569 baris, 81 impor. Semua fitur baru menambah baris di sini.
   Arah: pindahkan perakitan per fitur ke `app/<fitur>.js` (pola `setupShop`, `setupInventory` sudah benar).
2. **GPU terintegrasi masih berat** — di laptop user (AMD Radeon terintegrasi) titik kebun: preset Rendah 27 FPS,
   Tinggi 2 FPS. Penyebab spesifik di kebun belum diprofil. Lihat `plans/2026-10-26-performa-open-world.md` Fase 2–4.
3. **Lag sesaat saat streaming** — terukur (Fase 2) penyebab utamanya kompilasi shader, bukan parsing (< 0,7 s);
   sudah ditangani dengan warm-up shader. Web Worker sengaja **belum** dibuat; buka lagi hanya bila `tools/shots/stutter.mjs`
   menunjukkan parsing jadi dominan.
4. **Distrik UNRI dipasang penuh saat boot**, bukan streaming seperti region → waktu muat awal.
5. **Belum ada satu tempat untuk keputusan desain** — tersebar di 18 plan + 6 spec. Pakai log di bawah.

## Log keputusan (tambah 1 baris per keputusan, terbaru di atas)

| Tanggal | Keputusan | Alasan / rujukan |
|---|---|---|
| 2026-10-27 | Dokumen ini jadi titik masuk; plan/spec lama tetap arsip | konteks proyek terlalu besar untuk dibaca ulang tiap sesi |
| 2026-10-26 | Batas FPS default 60 + preset kualitas Otomatis | laptop panas & GPU terintegrasi; `engine/frameCap.js`, `config/quality.js` |
| 2026-10-26 | Inventory gaya Minecraft (hotbar), kendaraan tetap ganti bebas | keputusan user; `sim/inventory.js` |
