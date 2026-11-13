# Proxy stadion (pratinjau)

## Tujuan
Menggantikan stadion asli (ribuan instans kursi/penonton) di pratinjau: SATU mesh vertexColors ±4 rb segitiga.

## Status (2026-11-13)
✅ plaza oval, lintasan, rumput + marka FIFA (garis, lingkaran, kotak penalti), fasad putih, tribun berundak + jalur kursi biru, atap putih, 4 tiang lampu sorot.
⬜ Cocokkan warna/bentuk dengan foto asli `[INFERENSI]`; ⬜ lampu sorot menyala malam.

## Cara kerja
`src/regions/stadion/proxy.js::buildStadionProxy()` — dimensi dari `STADIUM` (`config/stadionSite.js`, region-lokal, pusat lapangan = origin). Dipasang & dilepas oleh `app/cityPreview.js`
(grup stadion asli `visible=false` selama aktif). Placement = `STADION_PLACEMENT`.

## Cara mengganti model
1. Ganti isi `buildStadionProxy` (kembalikan `{ group, dispose }`) — boleh GLB Blender (muat sinkron/siapkan di scope) asalkan ≤ 8 draw call & ≤ 10 rb segitiga.
2. Warna: objek `COLOR` di berkas yang sama. Skala/posisi: sudah relatif pusat lapangan, tanpa placement manual.
Lihat [ganti-model](../ganti-model/README.md).

## Log
- 2026-11-13: v2 (atap putih, kursi biru, marka FIFA, lampu).
