# Pratinjau kamera (tombol K)

## Tujuan
Pandangan helikopter isometrik atas kota; isi berat diganti bentuk dasar.

## Status (2026-11-13)
✅ POV `kota`, kontrol, label landmark (klik terbang), HUD bersih, bayangan dinamis, kabut dinamis, resolusi penuh.
⬜ Ukur di GPU asli; ⬜ tombol "pusatkan ke pemain"; ⬜ mini-kompas arah putar.

## Cara kerja
- `core/cameraPresets.js`: `CITY` (fov 20°, elevasi 35,26°, azimut 45°, radius 1300, panLimit 26 km (seluruh peta kota dari mana pun pemain berada)), POV `kota` (kunci `KeyK`, zoom 0,25–14).
- `core/PovDirector.js`: pan (`panBy`/`panDrag`), `flyTo(x,z,zoom)`, near/far dihitung oleh `cityPreview`.
- `core/CameraRig.js`: seret mouse = geser; `moveCity` (WASD/panah = geser, Q/Z = putar); roda = zoom.
- `app/cityPreview.js` (sistem `cityPreview`, fase camera, mengikuti `rig.povId`): saat aktif → `regions.setHold(true)`, stadion → proxy, entitas disembunyikan,
  `city.setPreview(true)` (semua tile + kota jauh), pixel ratio ≤ 1,5 & adaptif mati, kabut = max(9000, 14×jarak), bayangan 200–700 m, near = 0,04×jarak, far = 3,2×jarak.
- `ui/CityLabels.js` + `ui/cityPreview.css`: label HTML terproyeksi; `body.is-city-preview` menyembunyikan kartu cerita/dompet/skor/minimap.
- Awan (`lighting.userData.clouds`) disembunyikan: kubah 4,4 km mengikuti kamera dan menutupi bumi di luar radius 2,2 km (kerudung putih).
- **Gaya maket** (setelan `camera.kotaMaket`, default ON): jam 16:45, bloom, tilt-shift kuat; **suara ambient** (`camera.kotaSuara`, default ON): dengung kota + angin menurut ketinggian.
- Keluar: semua dipulihkan (kabut, pixel ratio, bayangan, near/far, awan).

## Cara mengganti model
Landmark/label: daftar dari `travelDestinations` (`app/fastTravel.js`) → tambah entri di sana (label muncul otomatis); lokasi stadion = pusat lapangan.

## Batas
Pan ≤ 26 km dari pemain (batas `CITY.panLimit`); label sekunder hanya bila jarak kamera < 2,6 km.

## Log
- 2026-11-13: temuan — "putih" di kota jauh = kubah awan, bukan kabut/bayangan (diuji: kabut 400 km & bayangan mati tak mengubah apa pun).
- 2026-11-12/13: dibuat; PR #24 → main.
