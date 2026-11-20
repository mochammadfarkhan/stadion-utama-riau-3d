# Resep model 3D (hemat token)

Tujuan: model bagus dengan putaran sesedikit mungkin. Baca berkas ini saja sebelum membuat/memperbaiki model;
jangan menjelajah ulang folder `assets-src/`.

## 1. Pilih sumber (berhenti di pilihan pertama yang cocok)
1. **Model jadi CC0** lewat Blender MCP: `search_assets` → `import_asset` (Poly Haven, Poly Pizza, Sketchfab berlisensi CC0/CC-BY; catat sumber + lisensi).
2. **Base mesh yang sudah ada**: karakter mulai dari `assets-src/blender/karakter/sumber/StylisedBaseMesh_Female.fbx` / `_Male.fbx`, lalu ubah bentuk/warna.
3. **Bangun dari kode** hanya untuk benda geometris (gedung, bangku, tiang, pagar) — pola `assets-src/blender/unri/`, `landmark/`.
- **Jangan pakai `generate_3d`** (keputusan user 2026-11-17: hasilnya tidak terpakai).
- Jangan membangun karakter/organik dari irisan penampang dari nol: lambat dan hasilnya kaku.

## 2. Pembagian kerja
- **Claude (skrip, mekanis):** skala ke meter & taruh di tanah (pakai `world_bounding_box`), decimate ke anggaran,
  warna datar/atlas, rig, ekspor GLB (`assets-src/blender/export_glb.py` → `export_collection`), cek anggaran.
- **User (mata manusia):** rapikan bentuk yang butuh rasa (wajah, lipatan, proporsi) langsung di Blender GUI.
  Bila putaran ke-2 masih jelek karena *bentuk*, minta user merapikan, jangan memutar skrip lagi.

## 3. Putaran: maksimal 3 per model
Tiap putaran: ubah → nilai → putuskan. Bila skor tidak naik dua putaran berturut-turut, **berhenti dan lapor**.
- **Nilai pakai angka dulu.** Karakter: `skor_render.py` (Blender) lalu `python assets-src/blender/karakter/skor_rujukan.py <folder> <pid>`
  → baca IoU siluet & selisih warna saja. Benda lain: jumlah segitiga + ukuran (m) dari `get_scene_info`.
- **Gambar paling akhir, kecil:** satu `look` (max_size kecil) atau satu bidikan `node tools/shots/uji.mjs --q "model=models/…glb"`.
  Jangan mengirim banyak bidikan per putaran.

## 4. Anggaran
- Kota (resmi, `docs/kota/ganti-model/README.md`): pohon ≤ 42 segitiga/instans, rumah ≤ 14, landmark ≤ 2 rb (1 material vertex color), draw call tambahan ≤ 1 per jenis.
- [INFERENSI] Karakter ≤ 5 rb segitiga, properti kecil ≤ 1 rb; tekstur ≤ 512² (karakter boleh atlas 1024²).
- Global tetap: draw call region ≤ 250, tekstur GPU ≤ 70 MB (AGENTS.md). Barang realistis hanya preset Tinggi; Rendah tetap low poly.

## 5. Aturan hemat token
- Jangan `Read` berkas besar: JSON rujukan (`ref-*.json`), `.blend`, GLB, log panjang → cukup `grep`/`head`/ringkasan angka.
- Skrip Blender mencetak ringkasan pendek (segitiga, ukuran, skor), bukan dump objek.
- Satu skrip per model di `assets-src/blender/<kategori>/`, dijalankan dengan perintah di AGENTS.md; jangan menulis ulang skrip dari nol bila sudah ada.
- Lapor ≤ 8 baris: skor sebelum → sesudah, satu gambar, yang belum beres.

## 6. Cek: Blender dulu, game sekali
- Bentuk, ukuran, segitiga, warna → cukup di Blender (`get_scene_info` + satu `look`).
- Tetap **satu** bidikan di game sebelum push (`uji.mjs --q "model=…"`, atau bidikan kota untuk landmark): sumbu Y-atas,
  skala, warna vertex vs pencahayaan/palet game, dan LOD hanya kelihatan di sana.
- Bagian kota yang prosedural (bangunan tile, bangunan jauh, pohon, jalan) **bukan GLB** — tidak bisa dibuka di Blender.
  Memperbaikinya lewat kode/bake (`docs/kota/ganti-model/README.md`), atau ganti dengan GLB Blender seperti landmark hero.

## 7. Definisi selesai
GLB di `public/models/…`, dicek di `/ruang-uji.html`, anggaran lolos, sumber+lisensi tercatat di commit.
