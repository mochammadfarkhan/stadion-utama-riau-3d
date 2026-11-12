# Aturan kerja (Simulator Stadion Utama Riau + Kampus UNRI)

Proyek hobi: **cepat dan sederhana mengalahkan lengkap**. Bahasa: Indonesia.

## Workflow (6 langkah)
1. **Kerjakan langsung sendiri.** Tanpa subagent/agen untuk eksekusi, tanpa dokumen plan. Cukup 1–3 baris niat, lalu mulai. Bila perkiraan > 30 menit, bilang di awal.
2. **Baca seperlunya:** `grep` dulu, buka hanya berkas terkait.
3. **Cek cepat:** `npm run lint` + tes berkas terkait (`node node_modules/vitest/vitest.mjs run <path>`). Suite penuh + `npm run build` hanya sebelum push.
4. **Lihat hasilnya** bila visual: 1–2 bidikan yang dibaca sendiri; lewati bila bukan visual.
5. **Git:** branch per fitur dari `main` terbaru, commit kecil (`git add <file>` lalu `git commit -m "…"` sebagai perintah terpisah, hook memblokir gabungan), bila hijau push + PR ke `main`; merge oleh user.
6. **Lapor ≤ 8 baris:** apa yang berubah, cara mencoba, yang belum yakin (jujur, termasuk yang belum diuji).

## Aturan
- Fitur baru **langsung aktif** (default), kecuali diminta opt-in; mode lama tetap bisa dipilih.
- Tes hanya untuk logika berisiko (matematika, data, collider, bake). Tidak ada tes visual/layout.
- Fakta mengalahkan gaya: tandai `[INFERENSI]` bila bukan dari sumber; jangan mengarang nama (UKM user = **ERC**, ruang D5).
- Anggaran: draw call region ≤ 250, tekstur GPU ≤ 70 MB, konten berulang lewat generator + instancing.

## Teknis singkat
- **Peta arsitektur: `docs/ARSITEKTUR.md`** — baca dulu sebelum menjelajah; perbarui (termasuk log keputusan) bila menambah lapisan/sistem/region.
- Koordinat dunia: +X timur, +Z selatan (meter). Lapisan ESLint tidak boleh saling impor lintas (lihat `eslint.config.js`).
- Blender: `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --python-expr "import runpy;print(runpy.run_path(r'<skrip>')['build']())"` (atau Blender MCP); skrip di `assets-src/blender/`.
- Bidikan: `tools/shots/*` (Playwright GPU, `--wait 9000` untuk malam). Port dev 5173.
- Jangan hapus worktree dengan `--force` bila `node_modules` berupa junction.
