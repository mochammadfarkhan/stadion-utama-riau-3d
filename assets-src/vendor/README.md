# Aset pihak ketiga (mentah, tidak di-commit)

Folder di bawah `assets-src/vendor/` di-gitignore (besar). Unduh ulang dari sumber di bawah bila perlu.

| Folder | Sumber | Versi | Lisensi | Diunduh |
|---|---|---|---|---|
| `human-base-meshes/` | Blender Studio, [Asset Bundles](https://www.blender.org/download/demo-files/) → `https://mirror.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip` (50,6 MB) | 1.4.1 | CC0 1.0 | 2026-10-22 |

## Catatan Human Base Meshes
- `GEO-body_male_stylized` dan `GEO-body_female_stylized`: 12.502 verteks / 25.000 segitiga, **topologi identik**
  (urutan poligon sama) → bisa di-morph pria↔wanita lewat shape key. Tinggi 1,80 m / 1,62 m, A-pose, tanpa rig.
- `Head - Generic Topology`: 632 segitiga (sebelum subsurf), shape key `Toon_MALE`, `Toon_FEMALE`, `Toon_Anime_Kid`, dll.
- Butuh Blender ≥ 4.2.
