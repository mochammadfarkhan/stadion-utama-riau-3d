# Potongan (model bongkar pasang)

Detail kecil landmark (AC, pohon, lampu, pot, kanopi, pintu, jendela) **bukan bagian mesh landmark**. Tiap potongan satu
berkas GLB kecil, disusun di game menurut daftar. Mengganti satu berkas mengubah semua pemakainya; landmark tidak dibangun ulang.

| Apa | Di mana |
|---|---|
| Berkas potongan | `public/models/potongan/<nama>.glb` |
| Daftar nama → berkas, dan daftar per landmark | `src/city/parts.data.js` (`PART_FILES`, `PART_RECIPES`) |
| Penyusun di game | `src/city/parts.js` (satu InstancedMesh per jenis per landmark, tampil hanya di LOD0) |
| Skrip potongan bawaan | `assets-src/blender/potongan/potongan.py` |

## Mengganti tampilan satu potongan
1. Ubah fungsinya di `potongan.py` (mis. `p_pohon`), atau buat modelnya di Blender / ambil dari pustaka CC0.
2. Simpan sebagai `public/models/potongan/<nama>.glb` (nama sama). Bila dari skrip:
   `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --python-expr "import runpy;print(runpy.run_path(r'<repo>\assets-src\blender\potongan\potongan.py')['build'](only=['pohon']))"`
3. Muat ulang game. Selesai.

Syarat berkas: **satu mesh**, warna per vertex (tanpa tekstur), alas di y=0 dan titik asal di tengah alas, depan = +Z (di Blender: −Y),
satuan meter. Warna sangat gelap (luminans < 0,05) dianggap kaca: biru di siang hari, menyala di malam hari.

## Menambah / memindah potongan di sebuah landmark
Sunting `PART_RECIPES['<id>'].rules` di `src/city/parts.data.js`:
- `{ part: 'ac', at: [[u, v, y, yaw, skala], ...] }` — satu per satu.
- `{ part: 'pohon', line: { from: [u, v], to: [u, v], y, count, yaw, skala } }` — berjajar rata.

- `{ part: 'jendela', ring: { step, ys: [...], margin, minEdge, offset } }` — berjajar mengikuti keliling jejak, menghadap ke luar, di tiap
  ketinggian `ys` (mis. per lantai). Butuh `ring: [[x, y], ...]` di resep (jejak gedung; cetak `fr.pts(way(...))` dari skrip Blender).

`u` sepanjang sumbu panjang landmark, `v` melintang, `y` tinggi (meter); `yaw` derajat. `frame` landmark diambil dari `min_rect`
jejaknya di skrip Blender (cetak sekali, salin angkanya).

## Menambah jenis potongan baru
1. Tambah berkas GLB + satu baris di `PART_FILES`.
2. Pakai namanya di aturan. Bila dibuat dari skrip, tambah fungsi `p_<nama>` dan daftarkan di `PARTS` (`potongan.py`).

## Batas
- Bentuk besar (massa gedung, lekuk fasad, kubah) tetap dari skrip landmark.
- Gedung biasa di 157 tile tidak memakai sistem ini (sudah dilebur saat bake); atapnya ditambah `src/city/roofs.js`.
- Potongan tidak punya collider.
- Aturan `ring` memakai sisi lurus jejak; pada fasad melengkung potongan mengikuti patahan poligonnya.
