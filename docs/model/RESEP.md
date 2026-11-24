# Resep model 3D (hemat token)

Tujuan: model bagus dengan putaran sesedikit mungkin. Baca berkas ini saja sebelum membuat/memperbaiki model;
jangan menjelajah ulang folder `assets-src/`.

## 0. Apakah perubahan ini akan terlihat? (cek dulu, audit 2026-11-24)
Audit commit `a36fde7`/`89e56c8`: model sampai ke game, tetapi isinya geseran warna ±6% dan detail 0,3–0,6 m, sehingga tak terbedakan di bidikan.
- **Skala piksel mode Kota:** kamera ±1170 m (zoom 0,9) ≈ 1,9 px per meter. Detail < 2 m ≈ tak terlihat. Yang terlihat: siluet, tinggi, atap, massa besar, warna yang beda ≥ 15–20%.
- **LOD:** detail kecil hanya di LOD0; mulai zoom ±1,1 yang tampil LOD1 (`src/city/landmarks.data.js`, `lod: [1300, 2800]`). Detail penting harus ada juga di LOD1.
- **Landmark hanya tampil di pratinjau Kota (tombol K)** (`src/city/landmarks.js`, `group.visible = false`); saat berjalan/bersepeda tidak tampil.
- **Kotak kota-jauh masih menumpuk** di lokasi landmark di luar tile terperinci (mis. Simpang SKA); `tools/citybake/farbake.mjs` belum menyaring jejak landmark.
- **Warna diratakan runtime:** satu material Lambert warna-vertex + grading sore mode Kota. Beda warna tipis hilang.
- **Wajib:** `node tools/shots/landmarkKota.mjs --id <id> --zoom 0.9,1.6 --hour 16.75` sebelum dan sesudah (folder beda), bandingkan. Tak terbedakan = gagal.
- Bila yang diminta "kota lebih cantik", ungkit terbesar biasanya **cahaya, palet, kabut, AO, bayangan** di kode, lalu **ganti model dengan aset CC0**, baru detail mesh.

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
- Kota (resmi, `docs/kota/ganti-model/README.md`): pohon ≤ 66 segitiga/instans, rumah ≤ 14, landmark ≤ 2 rb (1 material vertex color; **landmark hero LOD0 boleh ≤ 12 rb** sejak 2026-11-24: bentuk nyata lebih penting daripada hemat segitiga, LOD1/LOD2 tetap ringan), draw call tambahan ≤ 1 per jenis.
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
