# R00 — Alat ukur dan bidikan baku (sudah ada)

> Bukan kartu kerja: ini penjelasan alat yang dipakai **semua** kartu untuk membuktikan hasilnya. Alatnya sudah di-commit bersama rencana ini.

## `tools/shots/kritik.mjs`

```bash
node tools/shots/kritik.mjs --out renders/kritik/<nama> [--preset rendah|sedang|tinggi] [--hanya jalan,kota,hp] [--gaya asli|kartun|facet]
```

- Menyalakan Vite sendiri di port 5176 + Chromium headless GPU (lewat `tests/e2e/harness.unri.mjs`). **Jangan** menjalankan dua alat bidikan bersamaan (port bentrok).
  Butuh paket `playwright` (global atau `PLAYWRIGHT_PATH`).
- **Preset dipaksa** (default `rendah`, sesuai keputusan D3) dan POV orbit menu ditutup seketika, jadi hasil bisa dibandingkan antar jalan.
- Keluaran di folder `--out`: satu `.jpg` per titik + `ringkasan.json`:
  `{ preset, setelan, spawn, titik: { <nama>: { calls, triangles, fps } }, ui: { dompetTertutupRail, kartuKiriTertutupMisi, hpDompetTertutupRail, hpMisiTertutupMinimap }, errors }`.
- Titik: `awal-sore`, `awal-malam`, `unri-jalan`, `sekre-luar`, `rektorat` (kelompok `jalan`, 1600×900); `kota-dekat`, `kota-jauh`, `kota-malam` (kelompok `kota`); `hp-awal` (kelompok `hp`, 812×375).
  Koordinat titik ada di konstanta `TITIK_JALAN` di kepala berkas; kartu yang memindah titik mulai (R03) menambah titik `mulai`.
- `renders/` di-`.gitignore`. Bidikan yang jadi bukti PR disalin ke `docs/screenshots/kritik/<kartu>/`.
- Lama jalan: ±3–4 menit untuk ketiga kelompok.

### Cara membaca hasilnya

- `calls` dan `triangles` **bisa dipercaya** (dari `renderer.info.render`, satu frame terakhir).
- `fps` **hanya pembanding kasar**: headless, dipengaruhi beban mesin saat itu (terukur 9–30 untuk adegan yang sama). Keputusan kinerja diambil dari `?perf` di laptop user, bukan dari angka ini.
- `ui.*` = uji tumpang-tindih kotak pembatas dua elemen (`true` = bertumpuk). `null` = salah satu elemen tidak ada/tersembunyi.
- `errors` harus kosong. Galat konsol baru setelah perubahanmu = perubahanmu salah, walau bidikan tampak benar.

## Angka dasar (2026-11-14, sebelum kartu mana pun dikerjakan)

Bukti: `docs/screenshots/kritik/dasar/` (bidikan + `ringkasan.json`).

| Titik | Draw call | Segitiga | Catatan |
|---|---|---|---|
| `awal-sore` | 466–488 | 2,17–2,21 jt | anggaran proyek ≤ 250 |
| `awal-malam` | 483 | 2,16 jt | |
| `unri-jalan` | 460 | 1,15 jt | |
| `sekre-luar` | 504–511 | 1,03 jt | titik mulai baru (R03) |
| `rektorat` | 459 | 1,21 jt | |
| `kota-dekat` | 157 | 0,43 jt | |
| `kota-jauh` | 1.399 | 4,95 jt | target ≤ 600 / ≤ 3 jt (R08) |
| `kota-malam` | 218 | 0,57 jt | |
| `hp-awal` | 472 | 2,17 jt | |

Setelan terpasang saat ukur: preset `rendah` → `pixelRatio 0.75`, `shadowQuality 'mati'`, gaya `kartun`. UI: `dompetTertutupRail true`, `hpDompetTertutupRail true`.
Kabut titik awal sore: near 112 m, far 560 m.

## Alat lain yang sudah ada dan dipakai kartu

| Alat | Guna | Dipakai di |
|---|---|---|
| `tools/shots/npcLineup.mjs --out <dir>` | deretan NPC dari depan/samping | kartu model manusia |
| `tools/shots/stutter.mjs` | frame terpanjang saat streaming | R22 |
| `tools/shots/kualitas.mjs` | preset terpasang + fps per batas FPS | R02 |
| `tools/shots/kebun.mjs` | bidikan kebun | R20 |
| `tools/shots/perfOverlay.mjs` | overlay `?perf` + laporan | R05, R08 |
| `window.__sim` (hanya mode dev) | `teleport(x, z, yaw)`, `stats()`, `store`, `rig`, `ents`, `regions`, `story`, `fastTravel(id)`, `regionIdAt(x, z)` | semua |

Alat yang **dibuat oleh kartu**: `tools/shots/rincianDraw.mjs` (R05 Tugas 0), `tools/shots/waktuMuat.mjs` (R22 Tugas 1).
