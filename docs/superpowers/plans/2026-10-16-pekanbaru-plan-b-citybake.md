# Plan B — Geo + Citybake (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun modul geo murni (`src/geo/`) dan alat bake offline `tools/citybake` yang mengubah data OSM (Overpass) + Overture buildings (DuckDB) menjadi tile 500 m (`public/tiles/*.glb` LOD0/LOD1 + `*.data.json` + `manifest.json` + `ATTRIBUTION.txt`) untuk kawasan Stadion dan pusat kota (Masjid Raya An-Nur), lengkap dengan tes unit dan golden test.

**Architecture:** Pipeline Node murni bertahap: fetch & cache (`data-src/`, di-.gitignore) → normalisasi ke model `Feature` ([lon, lat]) → proyeksi ENU lokal ke meter dunia (+X timur, −Z utara) → merge OSM-menang → estimasi tinggi → buang fitur di dalam mask region → partisi per tile (bangunan per centroid, area/jalan dipotong) → geometri per material dengan vertex color → GLB terkompresi meshopt via glTF-Transform. Setiap tahap adalah fungsi murni yang dites terpisah; I/O hanya di loader (`fetchOsm.js`, `fetchOverture.js`) dan `pipeline.js`. Format keluaran didefinisikan pasti di bagian "Format tile v1" sebagai kontrak untuk Plan C (klien streaming).

**Tech Stack:** Node ≥ 20 (ESM), Vitest 5.0.4, three 0.186.1 (hanya `ShapeUtils`/`Vector2` untuk triangulasi di Node), `@gltf-transform/core|extensions|functions` 4.5.1, `meshoptimizer` 1.3.0, `@duckdb/node-api` 1.5.6-r.1 (DuckDB 1.5, ekstensi `spatial` + `httpfs`), Overture Maps rilis `2026-09-23.1`, Overpass API publik.

---

## Hasil riset & versi (diverifikasi 2026-10-16)

| Hal | Temuan | Cara verifikasi |
|---|---|---|
| Rilis Overture | `2026-09-23.1` (field `latest` di `https://stac.overturemaps.org/catalog.json`). Path: `s3://overturemaps-us-west-2/release/2026-09-23.1/theme=buildings/type=building/*` | Diambil langsung dari STAC catalog |
| Query Overture | `read_parquet(..., hive_partitioning=1)` + predikat `bbox.xmin/xmax/ymin/ymax`, `ST_AsGeoJSON(geometry)`, `sources[1].dataset`. Bbox 0,007° × 0,007° di stadion → 31 bangunan (21 Google Open Buildings, 5 Microsoft ML, 5 OSM) dalam **5 menit 22 detik** (waktu didominasi pemindaian metadata partisi global) | Kode `fetchOverture.js` di rencana ini dijalankan nyata terhadap S3 |
| `@duckdb/node-api` | 1.5.6-r.1: `DuckDBInstance.create(':memory:')` → `instance.connect()` → `connection.run(sql)` / `connection.runAndReadAll(sql)` → `reader.getRowObjectsJson()`; biner native per platform ±37 MB (win32-x64) | npm registry + uji nyata |
| glTF-Transform | 4.5.1: `meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 14 })` (membungkus `reorder` + `quantize` + `EXT_meshopt_compression`); `NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder', 'meshopt.decoder'})`. Output byte-identik antar-run. Jangan pakai `dedup()` — ia menggabungkan mesh identik sehingga nama mesh hilang | Prototipe di Node + parse balik dengan `GLTFLoader` three 0.186.1 + `MeshoptDecoder` |
| meshoptimizer | 1.3.0: `import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'`, tunggu `.ready` | Prototipe |
| Overpass | Endpoint `https://overpass-api.de/api/interpreter` (utama) dan `https://overpass.private.coffee/api/interpreter` (cadangan). Saat sibuk server membalas HTTP 500/502/504 **atau HTTP 200 berisi HTML / `remark: runtime error`** — keduanya harus dicoba ulang. Etika: User-Agent beridentitas, satu permintaan per waktu, backoff eksponensial, cache hasil | Diamati langsung 2026-10-16 (502, 500, dan 200+HTML) |
| Volume OSM area stadion (bbox ±1,5 km) | 683 bangunan, 948 jalan, 33 air, 74 landuse/leisure | `out count` Overpass |
| Stadion Utama Riau | Way **327365495** (`leisure=stadium`, 53 titik). Centroid luas: **lat 0,4835954, lon 101,3895277**. Ekstensi 222 × 296 m, sumbu panjang ±2° dari utara-selatan | `way(327365495); out geom;` + perhitungan centroid |
| Masjid Raya An-Nur | Node **13792599822** "Masjid Raya An-Nur" (lat 0,5265934, lon 101,4508552); poligon kompleks way **1204061673** "Kompleks Masjid Raya An-Nur Provinsi Riau"; bangunan relation 17228553. Posisi di frame dunia ≈ **(x 6.827, z −4.754) → 8,3 km** dari stadion | Overpass + Nominatim |
| Tinggi per lantai | Spec menetapkan 3,2 m. Rumah tinggal Indonesia lazimnya 3,0–3,5 m lantai-ke-lantai; ruko lantai dasar 3,5–4,5 m. **Belum diverifikasi terhadap standar resmi** (SNI tidak menetapkan angka tunggal) — dipakai sebagai konstanta `LEVEL_HEIGHT` yang mudah diubah | Asumsi domain |
| Bake nyata (prototipe rencana ini, kode identik dengan rencana) | **Stadion:** 36 tile, 3,50 MB, 96.381 segitiga LOD0 total, 6 menit 40 detik online. **Pusat:** 16 tile, 3,82 MB, 112.583 segitiga LOD0 total, 9 menit 56 detik online (termasuk 4× retry Overpass 502/500). **Total 52 tile, 7,32 MB**; tile terberat LOD0 + data = 212,6 KB (12_-10, 9.482 segitiga). Bake ulang offline kedua area 2,3 detik dan **byte-identik** (hash semua file sama) | Pipeline dijalankan nyata + diperiksa visual di penampil Task 20 |

## Struktur file

Semua file baru; tidak ada file di luar daftar ini yang disentuh (Plan A mengerjakan `src/engine`, `src/regions`, `src/shared`, dll. secara paralel).

| File | Tanggung jawab |
|---|---|
| `src/geo/projection.js` | `createProjection({lat0, lon0})` → `toWorld(lat, lon)` / `toLatLon(x, z)`; ENU pada ellipsoid WGS84, invers iteratif |
| `src/geo/tiles.js` | `TILE_SIZE`, `tileKey`, `parseTileKey`, `tileOf`, `tileCenter`, `tileBounds`, `tilesInRect`, `tilesInRadius` |
| `src/geo/polygon.js` | `cleanRing`, `signedArea`, `polygonArea`, `orientRing`, `polygonCentroid`, `pointInPolygon`, `ringBounds`, `boundsOverlap`, `clipPolygonToRect`, `clipPolylineToRect` (dipakai bake dan nanti TileCollider) |
| `tools/citybake/config.js` | Origin, area (`stadion`, `pusat`), endpoint, rilis Overture, kelas jalan, warna landuse/bangunan, lapisan y, anggaran, mask region |
| `tools/citybake/features.js` | Typedef `Feature`, `projectFeature(s)` [lon, lat] → [x, z] |
| `tools/citybake/fetchOsm.js` | Query Overpass, fetch + retry/backoff, cache `data-src/osm/<area>.json`, normalisasi (`classify`, `joinSegments`, `normalizeOsm`) |
| `tools/citybake/fetchOverture.js` | SQL DuckDB bbox, koneksi DuckDB (impor dinamis), cache `data-src/overture/<area>.geojson`, `normalizeOverture`, fallback OSM-saja |
| `tools/citybake/merge.js` | `mergeBuildings` (OSM menang) |
| `tools/citybake/random.js` | Hash FNV-1a + mulberry32 (variasi deterministik) |
| `tools/citybake/roadLocator.js` | Kelas jalan terdekat (grid 50 m) untuk konteks tinggi |
| `tools/citybake/height.js` | `estimateHeight`/`explainHeight`, tabel `HEURISTIC_RULES` (titik kontribusi user) |
| `tools/citybake/geometry/meshBuilder.js` | Akumulator mesh + `addFace` (orientasi otomatis) + `addUpTriangle` |
| `tools/citybake/geometry/colors.js` | sRGB hex → linear, `shade` |
| `tools/citybake/geometry/areas.js` | Poligon datar berlubang → segitiga +Y (`THREE.ShapeUtils.triangulateShape`) |
| `tools/citybake/geometry/buildings.js` | Extrude dinding + atap datar / pelana, `rectangleFrame` |
| `tools/citybake/geometry/roads.js` | Pita polyline dengan miter terbatas |
| `tools/citybake/mask.js` | Buang fitur di dalam mask (ring dunia) |
| `tools/citybake/partition.js` | Bagi fitur ke tile (bangunan per centroid, area/garis dipotong) |
| `tools/citybake/glb.js` | Tulis GLB meshopt (`writeTileGlb`), ringkasan GLB (`readGlbSummary`), `MESH_NAMES` |
| `tools/citybake/bakeTile.js` | Satu tile → mesh LOD0/LOD1 + `data.json` |
| `tools/citybake/manifest.js` | Skema manifest, `upsertArea`, `validateManifest`, `attributionText` |
| `tools/citybake/report.js` | Laporan ringkas + peringatan anggaran |
| `tools/citybake/pipeline.js` | Orkestrasi `runBake` (loader dapat diinjeksi) |
| `tools/citybake/cli.js` | `parseCli`, `main` |
| `tools/citybake/index.js` | Entry `node tools/citybake` |
| `tools/citybake/viewer.html`, `viewer.js` | Penampil tile lokal (verifikasi visual via `npm run dev`; tidak ikut build) |
| `tests/geo/*.test.js` | Tes `projection`, `tiles`, `polygon` |
| `tests/citybake/*.test.js`, `meshTestUtils.js`, `fixtures/*` | Tes unit citybake, helper geometri, fixture OSM/Overture mini, golden test |
| `public/tiles/**` | Hasil bake (di-commit) |
| `package.json`, `package-lock.json` | devDependencies + script `bake` |
| `.gitignore` | `data-src/` |
| `eslint.config.js` | Globals Node untuk `tools/**` |

**Tidak dibuat di Plan B:** `src/geo/regionTransform.js` beserta tesnya — **dibuat di Plan A Task 6**. Plan B tidak membutuhkannya karena placement region stadion di Fase 1 adalah `{x: 0, z: 0, yaw: 0}`, sehingga ring mask region-lokal = ring dunia. Plan A juga memiliki `src/shared/polygon.js`, `tests/polygon.test.js`, `tests/regionTransform.test.js`, `tests/region.test.js`; karena itu semua tes Plan B berada di `tests/geo/` dan `tests/citybake/`. Duplikasi `pointInPolygon` (±10 baris) antara `src/geo/polygon.js` dan `src/shared/polygon.js` disengaja dan digabung setelah kedua plan di-merge.

**Catatan `vite.config.js`:** tidak diubah. `tools/` tidak diimpor oleh `src/` sehingga tidak masuk bundle, dan `coverage.include` yang eksplisit tidak memuat `tools/**`. Menambahkan `'src/geo/**'` ke `coverage.include` (spec §6) ditunda ke integrasi agar tidak berbenturan dengan perubahan Plan A pada baris yang sama.

## Format tile v1 (kontrak untuk Plan C)

### Frame & satuan
- Frame dunia: ENU lokal pada bidang singgung WGS84 di origin `{lat: 0.4835954, lon: 101.3895277}` (centroid OSM way 327365495). **+X = timur, −Z = utara, +Y = atas**, meter. Tanah datar (y = 0).
- Tile `(ix, iz)`: `x ∈ [ix·500, (ix+1)·500)`, `z ∈ [iz·500, (iz+1)·500)`. Kunci `"{ix}_{iz}"` (mis. `"-1_-3"`). Pusat tile `((ix+0,5)·500, (iz+0,5)·500)` adalah origin koordinat **tile-lokal**.
- Tile tanpa segitiga di LOD0 tidak ditulis dan tidak tercantum di manifest; klien memperlakukannya sebagai tile kosong yang sudah dimuat.

### Nama file (semua di `public/tiles/`)
- `manifest.json`, `ATTRIBUTION.txt`
- `{key}.lod0.glb`, `{key}.lod1.glb`, `{key}.data.json` — mis. `-1_-3.lod0.glb`

### `manifest.json`
```json
{
  "version": 1,
  "format": "citybake-tiles",
  "origin": { "lat": 0.4835954, "lon": 101.3895277 },
  "frame": "ENU lokal; +X timur, -Z utara, +Y atas; meter",
  "tileSize": 500,
  "unit": 0.1,
  "areas": [
    {
      "id": "pusat",
      "name": "Pusat kota — Masjid Raya An-Nur",
      "bounds": { "minX": 6076.658362128706, "minZ": -5504.50681441363, "maxX": 7576.658362128706, "maxZ": -4004.5068144136303 },
      "osmTimestamp": "2026-10-16T03:28:50Z",
      "overtureRelease": "2026-09-23.1",
      "tiles": ["12_-12", "13_-12", "…"]
    },
    {
      "id": "stadion",
      "name": "Kawasan Stadion Utama Riau",
      "bounds": { "minX": -1500, "minZ": -1500, "maxX": 1500, "maxZ": 1500 },
      "osmTimestamp": "2026-10-16T03:14:15Z",
      "overtureRelease": "2026-09-23.1",
      "tiles": ["-3_-3", "-2_-3", "…"]
    }
  ],
  "tiles": [
    {
      "key": "12_-12", "ix": 12, "iz": -12, "area": "pusat", "bytes": 248135,
      "lod": [
        { "level": 0, "file": "12_-12.lod0.glb", "bytes": 126936, "triangles": 7097 },
        { "level": 1, "file": "12_-12.lod1.glb", "bytes": 85528, "triangles": 4885 }
      ],
      "data": { "file": "12_-12.data.json", "bytes": 35671 }
    }
  ]
}
```
Aturan: `version` = 1 (naik bila kontrak berubah); `areas` urut `id`; `tiles` urut `iz` lalu `ix` (karena itu tile pusat, iz −12…−9, muncul lebih dulu); `bytes` tile = `lod[0].bytes + lod[1].bytes + data.bytes`; `lod` selalu 2 entri (indeks = level); `bounds` = persegi kawasan sebelum dibulatkan ke grid (meter dunia, tidak dibulatkan); `overtureRelease` = `null` bila area di-bake tanpa Overture. Tidak ada stempel waktu bake (keluaran deterministik). Contoh angka di atas berasal dari bake nyata prototipe dan dapat berbeda setelah bake final (data OSM berubah).

**Catatan operasional:** nama file tile dapat diawali `-` (mis. `-1_-3.lod0.glb`). Di shell gunakan `--` atau `./` (mis. `sha1sum -- *`, `rm ./-1_-3.*`) agar tidak dibaca sebagai opsi; `git` tidak terpengaruh.

### Isi GLB (`{key}.lod{n}.glb`)
- Satu scene bernama `tile_{key}_lod{n}` (default scene). Anak langsung scene = node datar tanpa hierarki, **berurutan**: `landuse`, `water`, `roads`, `buildings_walls`, `buildings_roofs`. Node yang kosong tidak ditulis.
- Tiap node: mesh dengan nama sama, tepat 1 primitive `TRIANGLES` berindeks, material dengan nama sama (placeholder putih, roughness 1, metallic 0). **Klien mengganti material berdasarkan nama** (`cityMaterials.js` Plan C) dengan `vertexColors: true`.
- Atribut: `POSITION` (int16 ternormalisasi, `KHR_mesh_quantization`), `NORMAL` (int8 ternormalisasi), `COLOR_0` (VEC3, unsigned ternormalisasi, ruang warna **linear**). Tidak ada UV.
- `extensionsRequired`: `EXT_meshopt_compression`, `KHR_mesh_quantization`. Klien: `new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)` dari `three/examples/jsm/libs/meshopt_decoder.module.js`.
- Kuantisasi menaruh **translation + scale pada node**; klien **tidak boleh** mereset transform node (cukup `group.position.set(center.x, 0, center.z)` pada root tile). Galat posisi ≤ ±3 cm (14 bit per bbox mesh).
- Koordinat tile-lokal (meter, relatif pusat tile), +X timur, −Z utara, Y atas.
- Lapisan datar (y): `landuse` = 0,02 + indeks prioritas kelas × 0,002 (≤ 0,05; urutan `LANDUSE_ORDER`), `water` = 0,06, `roads` = 0,08 (minor) / 0,10 (mayor). Segitiga dalam mesh `landuse` dan `roads` sudah urut prioritas (bawah dulu).
- **Aturan render untuk klien:** `landuse`, `water`, `roads` digambar dengan `depthWrite: false` dan `renderOrder` −3, −2, −1 (sebelum semua objek lain). Dengan begitu urutan segitiga menentukan visibilitas tanpa z-fighting di kejauhan, dan tanah/objek region handmade yang digambar sesudahnya otomatis menutupi landuse kota yang menjorok ke dalam mask. `buildings_*` digambar normal.
- Bangunan: dinding vertikal normal-flat menghadap keluar, vertex dasar digelapkan ×0,82 (AO murah); atap datar normal +Y; atap pelana (LOD0, footprint ~persegi panjang < 150 m², kemiringan 30°) — segitiga ujung pelana ada di mesh `buildings_walls`. Bangunan **tidak dipotong**: masuk tile yang memuat centroid-nya dan boleh menjorok melewati tepi tile.
- LOD1: tanpa atap pelana, lubang courtyard dibuang (kotak dari ring luar), bangunan < 40 m² dibuang, jalan minor (`living_street`, `service`, `pedestrian`, `track`, `cycleway`, `footway`, `path`, `steps`) dibuang. Air dan landuse sama dengan LOD0.

### `{key}.data.json`
```json
{
  "v": 1,
  "key": "0_-1",
  "ix": 0,
  "iz": -1,
  "center": [250, -250],
  "unit": 0.1,
  "buildings": [{ "h": 64, "ring": [-1600, -1550, -1400, -1550, -1400, -1450, -1600, -1450] }],
  "water": [{ "rings": [[1250, 1250, 1750, 1250, 1750, 1750], [1400, 1400, 1450, 1400, 1450, 1450]] }],
  "waterways": [{ "cls": "stream", "w": 40, "pts": [1500, -1500, 2000, -1500] }],
  "roads": [
    { "cls": "primary", "w": 140, "pts": [-2500, -2300, -100, -2300], "name": "Jalan Uji Raya" },
    { "cls": "footway", "w": 20, "pts": [-1900, -2500, -1900, -1500] }
  ]
}
```
- Semua angka geometri = **bilangan bulat dalam satuan 0,1 m, tile-lokal**: `x_dunia = center[0] + v·0,1`, `z_dunia = center[1] + v·0,1`. `h` (tinggi bangunan) dan `w` (lebar jalan/sungai) juga dalam 0,1 m.
- `buildings[].ring`: array datar `[x0, z0, x1, z1, …]` ring luar terbuka (titik terakhir ≠ pertama), selalu berorientasi positif (`signedArea > 0`), tidak dipotong tile (lihat aturan bangunan). Lubang tidak disertakan (collider memakai ring luar).
- `water[].rings`: `[luar, ...lubang]` array datar, sudah dipotong ke batas tile.
- `waterways[]` dan `roads[]`: polyline array datar, sudah dipotong ke batas tile (satu jalan dapat menjadi beberapa entri). `cls` = nilai tag OSM (`highway` / `waterway`). `name` hanya untuk kelas berlabel (`motorway`, `trunk`, `primary`, `secondary`, `tertiary`) yang punya tag `name`.
- Urutan entri: menurut id fitur (deterministik). Validasi minimal di klien (spec §5): `v === 1`, semua angka bilangan bulat, ring panjang genap ≥ 6, polyline panjang genap ≥ 4.

### `ATTRIBUTION.txt`
Ditulis ulang setiap bake dari `attributionText(manifest)`: menyebut © OpenStreetMap contributors (tautan copyright), Overture Maps Foundation beserta sumber gabungannya, lisensi ODbL 1.0 untuk `*.glb`/`*.data.json`, dan daftar area (id, waktu OSM, rilis Overture, jumlah tile).

---

## Konvensi pengerjaan

- Jalankan tes satu file: `node node_modules/vitest/vitest.mjs run <file>`; semua tes: `node node_modules/vitest/vitest.mjs run`.
- Lint: `npm run lint`.
- Commit selalu satu perintah: `git add <file...> && git commit -m "..."` (format conventional commits, bahasa Indonesia seperti riwayat repo).
- Jangan menyentuh file di luar "Struktur file".

---

### Task 1: Dependensi & konfigurasi tooling

**Files:**
- Modify: `package.json` (devDependencies, script `bake`)
- Modify: `package-lock.json` (otomatis oleh npm)
- Modify: `.gitignore`
- Modify: `eslint.config.js`

- [ ] **Step 1: Pasang dependensi bake**

Run:
```bash
npm i -D @gltf-transform/core@^4.5.1 @gltf-transform/extensions@^4.5.1 @gltf-transform/functions@^4.5.1 meshoptimizer@^1.3.0 @duckdb/node-api@1.5.6-r.1
```
Expected: selesai tanpa galat; `package.json` memuat kelima paket di `devDependencies`.

- [ ] **Step 2: Tambah script `bake` di `package.json`**

Ubah blok `scripts` menjadi:
```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "coverage": "vitest run --coverage",
    "bake": "node tools/citybake"
  },
```

- [ ] **Step 3: Abaikan cache data mentah**

Tambahkan di akhir `.gitignore`:
```gitignore

# Cache data mentah citybake (OSM/Overture; dapat diunduh ulang)
data-src/
```

- [ ] **Step 4: Globals Node untuk `tools/**` di ESLint**

Ganti isi `eslint.config.js` menjadi:
```js
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.playwright-mcp/**', 'assets-src/**', 'data-src/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['tests/**', 'vite.config.js', 'eslint.config.js'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  // Alat offline (Node). Globals digabung dengan browser dari blok dasar (viewer.js memakai keduanya).
  { files: ['tools/**'], languageOptions: { globals: { ...globals.node } } },
];
```
(Bila Plan A sudah menambah blok `no-restricted-imports` di file ini, pertahankan blok itu dan cukup sisipkan baris `tools/**` serta `'data-src/**'` di `ignores`.)

- [ ] **Step 5: Verifikasi**

Run:
```bash
node -e "Promise.all([import('@gltf-transform/core'), import('meshoptimizer'), import('@duckdb/node-api')]).then(([g, m, d]) => console.log(typeof g.Document, typeof m.MeshoptEncoder.encodeGltfBuffer, typeof d.DuckDBInstance))"
npm run lint
node node_modules/vitest/vitest.mjs run
```
Expected: `function function function`; lint tanpa error; semua tes lama PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore eslint.config.js && git commit -m "chore: dependensi & konfigurasi citybake (glTF-Transform, meshoptimizer, DuckDB)"
```

---

### Task 2: `src/geo/projection.js` — ENU lokal WGS84

**Files:**
- Create: `src/geo/projection.js`
- Test: `tests/geo/projection.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import { createProjection } from '../../src/geo/projection.js';

const STADION = { lat0: 0.4835954, lon0: 101.3895277 };

describe('createProjection', () => {
  it('origin dipetakan ke (0, 0)', () => {
    const p = createProjection(STADION);
    const w = p.toWorld(STADION.lat0, STADION.lon0);
    expect(w.x).toBeCloseTo(0, 9);
    expect(w.z).toBeCloseTo(0, 9);
  });

  it('arah: utara → z negatif, timur → x positif', () => {
    const p = createProjection(STADION);
    const north = p.toWorld(STADION.lat0 + 0.01, STADION.lon0);
    const east = p.toWorld(STADION.lat0, STADION.lon0 + 0.01);
    expect(north.z).toBeLessThan(-1000);
    expect(Math.abs(north.x)).toBeLessThan(0.01);
    expect(east.x).toBeGreaterThan(1000);
    expect(Math.abs(east.z)).toBeLessThan(1);
  });

  it('1° lintang di ekuator ≈ 110,574 km (toleransi 50 m: tali busur vs busur)', () => {
    const p = createProjection({ lat0: 0, lon0: 0 });
    expect(Math.abs(p.toWorld(1, 0).z + 110574)).toBeLessThan(50);
  });

  it('0,001° bujur di ekuator ≈ 111,32 m', () => {
    const p = createProjection({ lat0: 0, lon0: 0 });
    expect(p.toWorld(0, 0.001).x).toBeCloseTo(111.32, 1);
  });

  it('round-trip < 1 cm untuk titik dalam radius 20 km', () => {
    const p = createProjection(STADION);
    const pts = [[20000, 0], [-20000, 0], [0, 20000], [0, -20000], [14142, -14142], [-9000, 17000], [6827, -4754]];
    for (const [x, z] of pts) {
      const ll = p.toLatLon(x, z);
      const back = p.toWorld(ll.lat, ll.lon);
      expect(Math.hypot(back.x - x, back.z - z)).toBeLessThan(0.01);
    }
  });

  it('jarak Stadion → Masjid Raya An-Nur ≈ 8,3 km (timur-laut)', () => {
    const p = createProjection(STADION);
    const w = p.toWorld(0.5265934, 101.4508552);
    expect(w.x).toBeGreaterThan(6700);
    expect(w.x).toBeLessThan(6950);
    expect(w.z).toBeLessThan(-4650);
    expect(w.z).toBeGreaterThan(-4850);
  });

  it('origin tak valid → RangeError', () => {
    expect(() => createProjection({ lat0: NaN, lon0: 0 })).toThrow(RangeError);
    expect(() => createProjection({ lat0: 90, lon0: 0 })).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/geo/projection.test.js`
Expected: FAIL — `Cannot find module '../../src/geo/projection.js'`.

- [ ] **Step 3: Implementasi**

```js
/**
 * Proyeksi geodetik WGS84 ↔ frame dunia ENU lokal (East-North-Up) pada bidang singgung di origin.
 * Konvensi dunia: +X = timur, −Z = utara, Y atas, satuan meter. Tanah datar: komponen "up" diabaikan,
 * sehingga toLatLon(x, z) mengembalikan titik di permukaan ellipsoid (h = 0) yang proyeksinya (x, z).
 * Murni (tanpa three/DOM).
 */

const A = 6378137; // sumbu semi-mayor WGS84 (m)
const F = 1 / 298.257223563; // pepatan WGS84
const E2 = F * (2 - F); // eksentrisitas kuadrat
const DEG = Math.PI / 180;
const INVERSE_ITERATIONS = 6;

/** Jari-jari kelengkungan vertikal utama N(φ). */
const primeVertical = (sinLat) => A / Math.sqrt(1 - E2 * sinLat * sinLat);

/** Jari-jari kelengkungan meridian M(φ). */
const meridian = (sinLat) => (A * (1 - E2)) / Math.pow(1 - E2 * sinLat * sinLat, 1.5);

/** Geodetik (derajat, h = 0) → ECEF (m). */
function toEcef(latDeg, lonDeg) {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const n = primeVertical(sinLat);
  return { X: n * cosLat * Math.cos(lon), Y: n * cosLat * Math.sin(lon), Z: n * (1 - E2) * sinLat };
}

/**
 * @param {{lat0: number, lon0: number}} origin derajat desimal
 * @returns {{ origin: {lat0: number, lon0: number},
 *   toWorld: (lat: number, lon: number) => {x: number, z: number},
 *   toLatLon: (x: number, z: number) => {lat: number, lon: number} }}
 */
export function createProjection({ lat0, lon0 }) {
  if (!Number.isFinite(lat0) || !Number.isFinite(lon0) || Math.abs(lat0) > 89) {
    throw new RangeError(`origin proyeksi tidak valid: lat0=${lat0}, lon0=${lon0}`);
  }
  const o = toEcef(lat0, lon0);
  const sLat = Math.sin(lat0 * DEG);
  const cLat = Math.cos(lat0 * DEG);
  const sLon = Math.sin(lon0 * DEG);
  const cLon = Math.cos(lon0 * DEG);

  /** Komponen east/north (m) dari titik geodetik. */
  function eastNorth(lat, lon) {
    const p = toEcef(lat, lon);
    const dx = p.X - o.X;
    const dy = p.Y - o.Y;
    const dz = p.Z - o.Z;
    return { e: -sLon * dx + cLon * dy, n: -sLat * cLon * dx - sLat * sLon * dy + cLat * dz };
  }

  function toWorld(lat, lon) {
    const { e, n } = eastNorth(lat, lon);
    return { x: e, z: -n };
  }

  /** Invers iteratif (Newton dengan Jacobian diagonal M, N·cosφ); konvergen < 1 mm dalam 6 langkah. */
  function toLatLon(x, z) {
    const e = x;
    const n = -z;
    let lat = lat0 + n / meridian(sLat) / DEG;
    let lon = lon0 + e / (primeVertical(sLat) * cLat) / DEG;
    for (let i = 0; i < INVERSE_ITERATIONS; i += 1) {
      const cur = eastNorth(lat, lon);
      const s = Math.sin(lat * DEG);
      lat += (n - cur.n) / meridian(s) / DEG;
      lon += (e - cur.e) / (primeVertical(s) * Math.cos(lat * DEG)) / DEG;
    }
    return { lat, lon };
  }

  return Object.freeze({ origin: Object.freeze({ lat0, lon0 }), toWorld, toLatLon });
}
```

- [ ] **Step 4: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/geo/projection.test.js`
Expected: PASS — `Tests  7 passed (7)`.

- [ ] **Step 5: Commit**

```bash
git add src/geo/projection.js tests/geo/projection.test.js && git commit -m "feat: proyeksi ENU lokal WGS84 (geo/projection)"
```

---

### Task 3: `src/geo/tiles.js` — grid tile 500 m

**Files:**
- Create: `src/geo/tiles.js`
- Test: `tests/geo/tiles.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import {
  TILE_SIZE, tileKey, parseTileKey, tileOf, tileCenter, tileBounds, tilesInRect, tilesInRadius,
} from '../../src/geo/tiles.js';

describe('tiles', () => {
  it('TILE_SIZE = 500', () => {
    expect(TILE_SIZE).toBe(500);
  });

  it('tileOf memakai floor (negatif ikut turun)', () => {
    expect(tileOf(0, 0)).toEqual({ ix: 0, iz: 0 });
    expect(tileOf(499.9, 500)).toEqual({ ix: 0, iz: 1 });
    expect(tileOf(-0.1, -500)).toEqual({ ix: -1, iz: -1 });
    expect(tileOf(-500.1, 1250)).toEqual({ ix: -2, iz: 2 });
  });

  it('tileCenter & tileBounds', () => {
    expect(tileCenter(0, 0)).toEqual({ x: 250, z: 250 });
    expect(tileCenter(-1, -2)).toEqual({ x: -250, z: -750 });
    expect(tileBounds(-1, 0)).toEqual({ minX: -500, minZ: 0, maxX: 0, maxZ: 500 });
  });

  it('tileKey ↔ parseTileKey', () => {
    expect(tileKey(-1, 3)).toBe('-1_3');
    expect(parseTileKey('-1_3')).toEqual({ ix: -1, iz: 3 });
    expect(parseTileKey('a_b')).toBeNull();
  });

  it('tilesInRect: maks eksklusif pada garis grid', () => {
    const t = tilesInRect({ minX: -1500, minZ: -1500, maxX: 1500, maxZ: 1500 });
    expect(t).toHaveLength(36);
    expect(t[0]).toEqual({ ix: -3, iz: -3, key: '-3_-3' });
    expect(t[35]).toEqual({ ix: 2, iz: 2, key: '2_2' });
    expect(tilesInRect({ minX: 10, minZ: 10, maxX: 20, maxZ: 20 })).toEqual([{ ix: 0, iz: 0, key: '0_0' }]);
  });

  it('tilesInRadius: urut jarak ke pusat tile, hanya yang beririsan lingkaran', () => {
    const t = tilesInRadius(250, 250, 300);
    expect(t[0]).toMatchObject({ key: '0_0', dist: 0 });
    expect(t.map((v) => v.key).slice(1, 5).sort()).toEqual(['-1_0', '0_-1', '0_1', '1_0']);
    expect(t.map((v) => v.key)).not.toContain('1_1'); // sudut terdekat berjarak √2·250 ≈ 354 > 300
    for (let i = 1; i < t.length; i += 1) expect(t[i].dist).toBeGreaterThanOrEqual(t[i - 1].dist);
  });

  it('tilesInRadius: radius 1000 m dari origin memuat 16 tile terdekat lebih dulu', () => {
    const t = tilesInRadius(0, 0, 1000);
    expect(t.slice(0, 4).map((v) => v.key).sort()).toEqual(['-1_-1', '-1_0', '0_-1', '0_0']);
    expect(t.every((v) => v.dist <= 1000 + 250 * Math.SQRT2)).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/geo/tiles.test.js`
Expected: FAIL — `Cannot find module '../../src/geo/tiles.js'`.

- [ ] **Step 3: Implementasi**

```js
/**
 * Grid tile kota di frame dunia ENU. Tile (ix, iz) menutup x ∈ [ix·S, (ix+1)·S), z ∈ [iz·S, (iz+1)·S),
 * S = TILE_SIZE. Kunci tile "ix_iz" (mis. "-1_-3") juga dipakai sebagai nama file. Murni.
 */

export const TILE_SIZE = 500;

/** Kunci tile, mis. tileKey(-1, 2) → "-1_2". */
export const tileKey = (ix, iz) => `${ix}_${iz}`;

/** Kebalikan tileKey; null bila format salah. */
export function parseTileKey(key) {
  const m = String(key).match(/^(-?\d+)_(-?\d+)$/);
  return m ? { ix: Number(m[1]), iz: Number(m[2]) } : null;
}

/** Indeks tile yang memuat titik dunia (x, z). */
export function tileOf(x, z, size = TILE_SIZE) {
  return { ix: Math.floor(x / size), iz: Math.floor(z / size) };
}

/** Pusat tile di frame dunia; asal koordinat tile-lokal. */
export function tileCenter(ix, iz, size = TILE_SIZE) {
  return { x: (ix + 0.5) * size, z: (iz + 0.5) * size };
}

/** Batas tile di frame dunia. */
export function tileBounds(ix, iz, size = TILE_SIZE) {
  return { minX: ix * size, minZ: iz * size, maxX: (ix + 1) * size, maxZ: (iz + 1) * size };
}

/**
 * Tile yang beririsan dengan persegi [minX, maxX) × [minZ, maxZ) (maks eksklusif: persegi yang
 * tepat berhenti di garis grid tidak menyeret tile tetangga). Urut iz lalu ix.
 * @returns {Array<{ix: number, iz: number, key: string}>}
 */
export function tilesInRect({ minX, minZ, maxX, maxZ }, size = TILE_SIZE) {
  const ix0 = Math.floor(minX / size);
  const iz0 = Math.floor(minZ / size);
  const ix1 = Math.ceil(maxX / size) - 1;
  const iz1 = Math.ceil(maxZ / size) - 1;
  const out = [];
  for (let iz = iz0; iz <= iz1; iz += 1) {
    for (let ix = ix0; ix <= ix1; ix += 1) out.push({ ix, iz, key: tileKey(ix, iz) });
  }
  return out;
}

/**
 * Tile yang persegi-nya beririsan dengan lingkaran (x, z, r), diurutkan menurut jarak titik ke pusat
 * tile (naik), seri dipecah dengan kunci agar deterministik.
 * @returns {Array<{ix: number, iz: number, key: string, dist: number}>}
 */
export function tilesInRadius(x, z, r, size = TILE_SIZE) {
  const out = [];
  for (const t of tilesInRect({ minX: x - r, minZ: z - r, maxX: x + r, maxZ: z + r }, size)) {
    const b = tileBounds(t.ix, t.iz, size);
    const nx = Math.min(Math.max(x, b.minX), b.maxX);
    const nz = Math.min(Math.max(z, b.minZ), b.maxZ);
    if (Math.hypot(nx - x, nz - z) > r) continue;
    const c = tileCenter(t.ix, t.iz, size);
    out.push({ ...t, dist: Math.hypot(c.x - x, c.z - z) });
  }
  return out.sort((a, b) => a.dist - b.dist || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
```

- [ ] **Step 4: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/geo/tiles.test.js`
Expected: PASS — `Tests  7 passed (7)`.

- [ ] **Step 5: Commit**

```bash
git add src/geo/tiles.js tests/geo/tiles.test.js && git commit -m "feat: grid tile 500 m (geo/tiles)"
```

---

### Task 4: `src/geo/polygon.js` — geometri poligon 2D

**Files:**
- Create: `src/geo/polygon.js`
- Test: `tests/geo/polygon.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import {
  cleanRing, signedArea, polygonArea, orientRing, polygonCentroid, pointInPolygon, ringBounds,
  boundsOverlap, clipPolygonToRect, clipPolylineToRect,
} from '../../src/geo/polygon.js';

const SQUARE = [[0, 0], [10, 0], [10, 10], [0, 10]];
const L_SHAPE = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
const RECT10 = { minX: 0, minZ: 0, maxX: 10, maxZ: 10 };

describe('polygon', () => {
  it('cleanRing membuang titik penutup & duplikat berurutan', () => {
    expect(cleanRing([[0, 0], [1, 0], [1, 0], [1, 1], [0, 0]])).toEqual([[0, 0], [1, 0], [1, 1]]);
  });

  it('signedArea / polygonArea / orientRing', () => {
    expect(signedArea(SQUARE)).toBe(100);
    expect(signedArea([...SQUARE].reverse())).toBe(-100);
    expect(polygonArea([...SQUARE].reverse())).toBe(100);
    expect(signedArea(orientRing([...SQUARE].reverse(), true))).toBe(100);
    expect(signedArea(orientRing(SQUARE, false))).toBe(-100);
    expect(polygonArea(L_SHAPE)).toBe(300);
  });

  it('polygonCentroid: persegi, bentuk L, degenerate', () => {
    expect(polygonCentroid(SQUARE)).toEqual({ x: 5, z: 5 });
    const c = polygonCentroid(L_SHAPE);
    expect(c.x).toBeCloseTo(25 / 3, 9);
    expect(c.z).toBeCloseTo(25 / 3, 9);
    expect(polygonCentroid([[0, 0], [2, 0], [4, 0]])).toEqual({ x: 2, z: 0 });
  });

  it('pointInPolygon', () => {
    expect(pointInPolygon(5, 5, SQUARE)).toBe(true);
    expect(pointInPolygon(15, 5, SQUARE)).toBe(false);
    expect(pointInPolygon(15, 15, L_SHAPE)).toBe(false);
    expect(pointInPolygon(5, 15, L_SHAPE)).toBe(true);
  });

  it('ringBounds & boundsOverlap', () => {
    expect(ringBounds(L_SHAPE)).toEqual({ minX: 0, minZ: 0, maxX: 20, maxZ: 20 });
    expect(boundsOverlap(RECT10, { minX: 10, minZ: 10, maxX: 20, maxZ: 20 })).toBe(true);
    expect(boundsOverlap(RECT10, { minX: 10.1, minZ: 0, maxX: 20, maxZ: 10 })).toBe(false);
  });

  it('clipPolygonToRect: potong separuh, di luar → [], di dalam → utuh', () => {
    const half = clipPolygonToRect(SQUARE, { minX: 5, minZ: -100, maxX: 100, maxZ: 100 });
    expect(polygonArea(half)).toBeCloseTo(50, 9);
    expect(ringBounds(half)).toEqual({ minX: 5, minZ: 0, maxX: 10, maxZ: 10 });
    expect(clipPolygonToRect(SQUARE, { minX: 20, minZ: 20, maxX: 30, maxZ: 30 })).toEqual([]);
    expect(polygonArea(clipPolygonToRect(L_SHAPE, { minX: -1, minZ: -1, maxX: 30, maxZ: 30 }))).toBe(300);
    expect(polygonArea(clipPolygonToRect(L_SHAPE, RECT10))).toBe(100);
  });

  it('clipPolylineToRect: masuk-keluar memecah polyline', () => {
    const line = [[-10, 5], [5, 5], [5, 20], [8, 20], [8, 5], [20, 5]];
    const parts = clipPolylineToRect(line, RECT10);
    expect(parts).toEqual([
      [[0, 5], [5, 5], [5, 10]],
      [[8, 10], [8, 5], [10, 5]],
    ]);
    expect(clipPolylineToRect([[20, 20], [30, 30]], RECT10)).toEqual([]);
    expect(clipPolylineToRect([[1, 1], [2, 2], [3, 1]], RECT10)).toEqual([[[1, 1], [2, 2], [3, 1]]]);
    // titik sudut tepat di tepi persegi: segmen luar yang hanya menyentuh tepi tidak menambah titik ganda
    expect(clipPolylineToRect([[-10, 5], [0, 5], [5, 5]], RECT10)).toEqual([[[0, 5], [5, 5]]]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/geo/polygon.test.js`
Expected: FAIL — `Cannot find module '../../src/geo/polygon.js'`.

- [ ] **Step 3: Implementasi**

```js
/**
 * Geometri poligon 2D pada bidang (x, z). Ring = Array<[x, z]> TERBUKA (titik terakhir ≠ titik pertama).
 * signedArea > 0 berarti urutan (x, z) "positif" (searah jarum jam bila dilihat dari atas dengan
 * utara di atas, karena +Z = selatan). Untuk ring positif, normal luar sisi (dx, dz) = (dz, −dx).
 * Murni (tanpa three/DOM); dipakai citybake dan nanti TileCollider.
 */

/** Buang titik penutup duplikat dan titik berurutan yang berimpit (< eps). */
export function cleanRing(ring, eps = 1e-6) {
  const out = [];
  for (const p of ring) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > eps || Math.abs(q[1] - p[1]) > eps) out.push([p[0], p[1]]);
  }
  while (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) > eps || Math.abs(a[1] - b[1]) > eps) break;
    out.pop();
  }
  return out;
}

/** Luas bertanda (shoelace). */
export function signedArea(ring) {
  let s = 0;
  for (let i = 0, n = ring.length; i < n; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/** Luas absolut (m²). */
export const polygonArea = (ring) => Math.abs(signedArea(ring));

/** Salinan ring dengan tanda luas sesuai `positive`. */
export function orientRing(ring, positive = true) {
  const copy = ring.map((p) => [p[0], p[1]]);
  return (signedArea(copy) > 0) === positive ? copy : copy.reverse();
}

/** Centroid luas; fallback rata-rata titik bila luas ≈ 0. */
export function polygonCentroid(ring) {
  const a = signedArea(ring);
  if (Math.abs(a) < 1e-9) {
    const n = ring.length || 1;
    return { x: ring.reduce((s, p) => s + p[0], 0) / n, z: ring.reduce((s, p) => s + p[1], 0) / n };
  }
  let cx = 0;
  let cz = 0;
  for (let i = 0, n = ring.length; i < n; i += 1) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    const c = p[0] * q[1] - q[0] * p[1];
    cx += (p[0] + q[0]) * c;
    cz += (p[1] + q[1]) * c;
  }
  return { x: cx / (6 * a), z: cz / (6 * a) };
}

/** Titik di dalam poligon (aturan genap-ganjil; titik tepat di tepi tidak dijamin). */
export function pointInPolygon(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Bounding box ring/polyline. */
export function ringBounds(ring) {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of ring) {
    if (x < minX) minX = x;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minZ, maxX, maxZ };
}

/** Dua bounding box beririsan (tepi bersentuhan dihitung beririsan). */
export const boundsOverlap = (a, b) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;

function lerpAtX(a, b, x) {
  const t = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + (b[1] - a[1]) * t];
}

function lerpAtZ(a, b, z) {
  const t = (z - a[1]) / (b[1] - a[1]);
  return [a[0] + (b[0] - a[0]) * t, z];
}

const CLIP_EDGES = [
  { inside: (p, r) => p[0] >= r.minX, cut: (a, b, r) => lerpAtX(a, b, r.minX) },
  { inside: (p, r) => p[0] <= r.maxX, cut: (a, b, r) => lerpAtX(a, b, r.maxX) },
  { inside: (p, r) => p[1] >= r.minZ, cut: (a, b, r) => lerpAtZ(a, b, r.minZ) },
  { inside: (p, r) => p[1] <= r.maxZ, cut: (a, b, r) => lerpAtZ(a, b, r.maxZ) },
];

/** Satu lintasan Sutherland–Hodgman terhadap satu sisi persegi. */
function clipAgainstEdge(input, edge, rect) {
  const out = [];
  for (let i = 0; i < input.length; i += 1) {
    const cur = input[i];
    const prev = input[(i + input.length - 1) % input.length];
    const curIn = edge.inside(cur, rect);
    const prevIn = edge.inside(prev, rect);
    if (curIn && !prevIn) out.push(edge.cut(prev, cur, rect));
    if (curIn) out.push(cur);
    if (!curIn && prevIn) out.push(edge.cut(prev, cur, rect));
  }
  return out;
}

/**
 * Potong poligon ke persegi {minX, minZ, maxX, maxZ} (Sutherland–Hodgman). Hasil ring terbuka;
 * [] bila tersisa < 3 titik atau luas ≈ 0. Poligon cekung dapat menghasilkan sisi berimpit di tepi
 * persegi — wajar untuk area datar (air/landuse).
 */
export function clipPolygonToRect(ring, rect) {
  let out = ring;
  for (const edge of CLIP_EDGES) {
    if (out.length === 0) break;
    out = clipAgainstEdge(out, edge, rect);
  }
  const cleaned = cleanRing(out);
  return cleaned.length >= 3 && polygonArea(cleaned) > 1e-6 ? cleaned : [];
}

/** Liang–Barsky: potong segmen a→b ke persegi; null bila di luar. Elemen ke-3: segmen keluar persegi. */
function clipSegment(a, b, r) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const checks = [[-dx, a[0] - r.minX], [dx, r.maxX - a[0]], [-dz, a[1] - r.minZ], [dz, r.maxZ - a[1]]];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      t0 = Math.max(t0, t);
    } else {
      if (t < t0) return null;
      t1 = Math.min(t1, t);
    }
  }
  return [[a[0] + dx * t0, a[1] + dz * t0], [a[0] + dx * t1, a[1] + dz * t1], t1 < 1];
}

const samePoint = (a, b) => Math.abs(a[0] - b[0]) <= 1e-9 && Math.abs(a[1] - b[1]) <= 1e-9;

/**
 * Potong polyline ke persegi. Mengembalikan array polyline (masing-masing ≥ 2 titik); satu polyline
 * dapat terpecah bila keluar-masuk persegi.
 */
export function clipPolylineToRect(line, rect) {
  const parts = [];
  let cur = null;
  for (let i = 0; i < line.length - 1; i += 1) {
    const seg = clipSegment(line[i], line[i + 1], rect);
    if (!seg) {
      cur = null;
      continue;
    }
    const [p, q, exits] = seg;
    if (samePoint(p, q)) {
      // segmen hanya menyentuh tepi persegi di satu titik
      if (exits) cur = null;
      continue;
    }
    if (!cur || !samePoint(cur[cur.length - 1], p)) {
      cur = [p];
      parts.push(cur);
    }
    cur.push(q);
    if (exits) cur = null;
  }
  return parts.filter((l) => l.length >= 2 && !samePoint(l[0], l[l.length - 1]));
}
```

- [ ] **Step 4: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/geo/polygon.test.js`
Expected: PASS — `Tests  7 passed (7)`.

- [ ] **Step 5: Commit**

```bash
git add src/geo/polygon.js tests/geo/polygon.test.js && git commit -m "feat: utilitas poligon 2D + clipping persegi (geo/polygon)"
```

---

### Task 5: `tools/citybake/config.js`

`SITE` diimpor dari `src/config/constants.js` (berkas itu tanpa impor lain, aman dipakai di Node). Bila Plan A memindahkan `SITE` (mis. ke `src/regions/stadion/site.js`), ubah satu baris impor di `config.js`.

**Files:**
- Create: `tools/citybake/config.js`
- Test: `tests/citybake/config.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import { createProjection } from '../../src/geo/projection.js';
import { pointInPolygon, signedArea } from '../../src/geo/polygon.js';
import {
  ORIGIN, AREAS, ROAD_CLASSES, LANDUSE_COLORS, LANDUSE_ORDER, LAYER_Y, REGION_MASKS, OVERTURE, OVERPASS_ENDPOINTS, USER_AGENT,
  areaRect, areaTiles, areaFetchBBox, ellipseRing,
} from '../../tools/citybake/config.js';

const proj = createProjection({ lat0: ORIGIN.lat, lon0: ORIGIN.lon });

describe('citybake config', () => {
  it('area stadion: persegi ±1500 m di origin → 36 tile (-3..2)', () => {
    const r = areaRect(AREAS.stadion, proj);
    expect(r.minX).toBeCloseTo(-1500, 6);
    expect(r.maxZ).toBeCloseTo(1500, 6);
    const tiles = areaTiles(AREAS.stadion, proj);
    expect(tiles).toHaveLength(36);
    expect(tiles[0].key).toBe('-3_-3');
  });

  it('area pusat: ±8,3 km timur-laut, 16 tile', () => {
    const tiles = areaTiles(AREAS.pusat, proj);
    expect(tiles).toHaveLength(16);
    expect(tiles.map((t) => t.key)).toContain('13_-10');
  });

  it('bbox fetch memuat pusat kawasan dan berorientasi benar', () => {
    for (const area of Object.values(AREAS)) {
      const b = areaFetchBBox(area, proj);
      expect(b.south).toBeLessThan(area.center.lat);
      expect(b.north).toBeGreaterThan(area.center.lat);
      expect(b.west).toBeLessThan(area.center.lon);
      expect(b.east).toBeGreaterThan(area.center.lon);
    }
  });

  it('kelas jalan: lebar positif & warna hex', () => {
    for (const [cls, v] of Object.entries(ROAD_CLASSES)) {
      expect(v.width, cls).toBeGreaterThan(0);
      expect(v.color).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const c of Object.values(LANDUSE_COLORS)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('prioritas landuse: permukiman paling bawah, parkir paling atas; lapisan datar berurutan', () => {
    expect(LANDUSE_ORDER[0]).toBe('residential');
    expect(LANDUSE_ORDER[LANDUSE_ORDER.length - 1]).toBe('parking');
    const topLanduse = LAYER_Y.landuse + (LANDUSE_ORDER.length - 1) * LAYER_Y.landuseStep;
    expect(topLanduse).toBeLessThan(LAYER_Y.water);
    expect(LAYER_Y.water).toBeLessThan(LAYER_Y.roadMinor);
    expect(LAYER_Y.roadMinor).toBeLessThan(LAYER_Y.roadMajor);
  });

  it('mask stadion: elips positif memuat stadion, tidak memuat Jl. Naga Sakti utara jauh', () => {
    const m = REGION_MASKS.find((v) => v.id === 'stadion');
    expect(signedArea(m.ring)).toBeGreaterThan(0);
    expect(pointInPolygon(0, 0, m.ring)).toBe(true);
    expect(pointInPolygon(0, -340, m.ring)).toBe(true);
    expect(pointInPolygon(0, -400, m.ring)).toBe(false);
    expect(pointInPolygon(300, 0, m.ring)).toBe(false);
  });

  it('ellipseRing: jumlah segmen & sumbu', () => {
    const r = ellipseRing(10, 20, 4);
    expect(r).toHaveLength(4);
    expect(r[0][0]).toBeCloseTo(10, 9);
    expect(r[1][1]).toBeCloseTo(20, 9);
  });

  it('sumber data terkonfigurasi', () => {
    expect(OVERTURE.release).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(OVERPASS_ENDPOINTS.length).toBeGreaterThan(0);
    expect(USER_AGENT).toMatch(/citybake/);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/config.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/config.js'`.

- [ ] **Step 3: Implementasi**

```js
/**
 * Konfigurasi citybake (Node, offline). Menambah kawasan kota baru = menambah entri AREAS saja.
 * Koordinat diverifikasi lewat Overpass/Nominatim 2026-10-16 (lihat komentar per entri).
 */
import { SITE } from '../../src/config/constants.js';
import { tileBounds, tilesInRect, TILE_SIZE } from '../../src/geo/tiles.js';

export { TILE_SIZE };

/** Versi format tile (manifest.version & data.json v). Naikkan bila kontrak berubah. */
export const FORMAT_VERSION = 1;

/**
 * Origin frame dunia = centroid luas poligon OSM way 327365495 "Stadion Utama Riau"
 * (leisure=stadium, 53 titik), dihitung dari `out geom` Overpass 2026-10-16.
 */
export const ORIGIN = Object.freeze({ lat: 0.4835954, lon: 101.3895277 });

/**
 * Kawasan bake. center = lat/lon; halfSize = setengah sisi persegi (m) di frame dunia.
 * Tile yang di-bake = semua tile yang beririsan persegi itu (dibulatkan keluar ke grid 500 m).
 */
export const AREAS = Object.freeze({
  stadion: Object.freeze({
    id: 'stadion',
    name: 'Kawasan Stadion Utama Riau',
    center: ORIGIN,
    halfSize: 1500,
  }),
  pusat: Object.freeze({
    id: 'pusat',
    name: 'Pusat kota — Masjid Raya An-Nur',
    // OSM node 13792599822 "Masjid Raya An-Nur" (amenity=place_of_worship); poligon kompleks:
    // way 1204061673 "Kompleks Masjid Raya An-Nur Provinsi Riau". ±8,3 km timur-laut stadion.
    center: Object.freeze({ lat: 0.5265934, lon: 101.4508552 }),
    halfSize: 750,
  }),
});

/** Endpoint Overpass publik (dicoba berurutan saat retry). */
export const OVERPASS_ENDPOINTS = Object.freeze([
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]);

/** User-Agent wajib mengidentifikasi aplikasi (kebijakan penggunaan Overpass & OSMF). */
export const USER_AGENT = 'stadion-utama-riau-3d-citybake/0.1 (+https://github.com/mochammadfarkhan/stadion-utama-riau-3d)';

/** Overture Maps: rilis dipin agar hasil bake dapat diulang. Rilis terbaru di STAC catalog. */
export const OVERTURE = Object.freeze({
  release: '2026-09-23.1',
  s3Base: 's3://overturemaps-us-west-2/release',
  s3Region: 'us-west-2',
  stacCatalog: 'https://stac.overturemaps.org/catalog.json',
});

/** Direktori cache data mentah (di-.gitignore) dan keluaran tile (di-commit). */
export const PATHS = Object.freeze({ cacheDir: 'data-src', outDir: 'public/tiles' });

/** Tinggi per lantai (m) untuk building:levels dan heuristik. */
export const LEVEL_HEIGHT = 3.2;

/** Atap pelana hanya untuk footprint ~persegi panjang dengan luas < nilai ini (m²). */
export const GABLE_MAX_AREA = 150;

/** LOD1: bangunan lebih kecil dari ini (m²) dibuang. */
export const LOD1_MIN_BUILDING_AREA = 40;

/**
 * Ketinggian lapisan datar (m). Landuse: landuse + indeks prioritas kelas × landuseStep (maks ±0,05).
 * Offset kecil ini hanya membantu penampil biasa; klien sebaiknya menggambar lapisan datar dengan
 * depthWrite=false dan renderOrder landuse < water < roads (urutan segitiga = urutan gambar).
 */
export const LAYER_Y = Object.freeze({ landuse: 0.02, landuseStep: 0.002, water: 0.06, roadMinor: 0.08, roadMajor: 0.1 });

/**
 * Kelas jalan OSM `highway` → lebar total (m), warna, minor (dibuang di LOD1), label (nama di data.json).
 * Kelas yang tidak terdaftar (construction, proposed, platform, ...) diabaikan.
 */
export const ROAD_CLASSES = Object.freeze({
  motorway: { width: 22, color: '#3b3e44', minor: false, label: true },
  trunk: { width: 18, color: '#3b3e44', minor: false, label: true },
  primary: { width: 14, color: '#404349', minor: false, label: true },
  secondary: { width: 12, color: '#44474d', minor: false, label: true },
  tertiary: { width: 10, color: '#484b51', minor: false, label: true },
  motorway_link: { width: 8, color: '#3b3e44', minor: false, label: false },
  trunk_link: { width: 8, color: '#3b3e44', minor: false, label: false },
  primary_link: { width: 7, color: '#404349', minor: false, label: false },
  secondary_link: { width: 7, color: '#44474d', minor: false, label: false },
  tertiary_link: { width: 6, color: '#484b51', minor: false, label: false },
  unclassified: { width: 7, color: '#4c4f55', minor: false, label: false },
  residential: { width: 6, color: '#505359', minor: false, label: false },
  living_street: { width: 5, color: '#55585e', minor: true, label: false },
  service: { width: 4.5, color: '#55585e', minor: true, label: false },
  pedestrian: { width: 4, color: '#9a948a', minor: true, label: false },
  track: { width: 3.5, color: '#8a7a62', minor: true, label: false },
  cycleway: { width: 2, color: '#7a5a52', minor: true, label: false },
  footway: { width: 2, color: '#a8a296', minor: true, label: false },
  path: { width: 1.8, color: '#a39a86', minor: true, label: false },
  steps: { width: 2, color: '#a8a296', minor: true, label: false },
});

/** Sungai/kanal sebagai garis → pita air dengan lebar (m). */
export const WATERWAY_WIDTHS = Object.freeze({ river: 25, canal: 10, stream: 4, drain: 2.5, ditch: 1.5 });

/** Warna air (sRGB). */
export const WATER_COLOR = '#3f6f8f';

/**
 * Kelas landuse → warna (sRGB). URUTAN KUNCI = PRIORITAS GAMBAR (bawah → atas): kelas luas (permukiman)
 * di bawah, kelas kecil/spesifik (taman, lapangan, parkir) di atas. Kunci = `cls` hasil
 * normalisasi (lihat fetchOsm.landuseClassOf).
 */
export const LANDUSE_COLORS = Object.freeze({
  residential: '#c9c2b3',
  commercial: '#d4b8b0',
  retail: '#d9b3a8',
  industrial: '#bdb3c2',
  education: '#d8cfa0',
  religious: '#cfc4a8',
  construction: '#b9a888',
  farmland: '#b8c47a',
  cemetery: '#9fb08a',
  forest: '#4f7a3a',
  scrub: '#7d9a55',
  wetland: '#7a9a7a',
  grass: '#8fb36a',
  park: '#7fae5a',
  pitch: '#6fa84f',
  parking: '#a9a9a9',
});

/** Prioritas gambar landuse (indeks kecil digambar lebih dulu/lebih rendah). */
export const LANDUSE_ORDER = Object.freeze(Object.keys(LANDUSE_COLORS));

/** Palet bangunan (sRGB); dipilih deterministik dari hash id. */
export const BUILDING_COLORS = Object.freeze({
  walls: Object.freeze(['#e8e2d6', '#ddd5c5', '#f0ece4', '#d8cbb5', '#c9c4bb', '#e6d7c3', '#bfc7cc', '#efe6d2']),
  roofFlat: Object.freeze(['#9a9a96', '#8c8a85', '#a8a49c', '#7f8286']),
  roofGable: Object.freeze(['#a5452f', '#8e3b2a', '#b5573a', '#6d5f57']),
});

/** Batas ukuran (laporan memberi peringatan, tidak menggagalkan bake). */
export const BUDGET = Object.freeze({ tileBytes: 300 * 1024, totalBytes: 20 * 1024 * 1024 });

/** Jumlah titik poligon pendekatan elips mask. */
const MASK_SEGMENTS = 64;

/** Margin (m) di luar jalan lingkar stadion yang ikut dibuang (lebar jalan + bahu + parkir tepi). */
export const STADION_MASK_MARGIN = 60;

/** Poligon elips region-lokal [[x, z], ...] (ring positif). */
export function ellipseRing(semiX, semiZ, segments = MASK_SEGMENTS) {
  const ring = [];
  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    ring.push([Math.cos(t) * semiX, Math.sin(t) * semiZ]);
  }
  return ring;
}

/**
 * Mask region handmade dalam koordinat DUNIA ({id, ring}). Fase 1: elips jalan lingkar SITE + margin;
 * placement stadion {x: 0, z: 0, yaw: 0} sehingga ring region-lokal dipakai langsung sebagai ring dunia.
 * Fase 3 mengganti dengan poligon OSM kompleks stadion yang ditransformasi lewat regionTransform
 * (dibuat di Plan A Task 6).
 */
export const REGION_MASKS = Object.freeze([
  Object.freeze({
    id: 'stadion',
    ring: ellipseRing(SITE.ringRoadSemiX + STADION_MASK_MARGIN, SITE.ringRoadSemiZ + STADION_MASK_MARGIN),
  }),
]);

/** Persegi dunia kawasan (sebelum dibulatkan ke grid). */
export function areaRect(area, projection) {
  const c = projection.toWorld(area.center.lat, area.center.lon);
  return { minX: c.x - area.halfSize, minZ: c.z - area.halfSize, maxX: c.x + area.halfSize, maxZ: c.z + area.halfSize };
}

/** Tile yang di-bake untuk kawasan. */
export const areaTiles = (area, projection, size = TILE_SIZE) => tilesInRect(areaRect(area, projection), size);

/**
 * Bbox lat/lon untuk fetch: gabungan batas tile kawasan + margin (m) agar fitur yang melintas tepi
 * ikut terambil. @returns {{south: number, west: number, north: number, east: number}}
 */
export function areaFetchBBox(area, projection, margin = 60, size = TILE_SIZE) {
  const tiles = areaTiles(area, projection, size);
  const b = tiles.map((t) => tileBounds(t.ix, t.iz, size));
  const minX = Math.min(...b.map((v) => v.minX)) - margin;
  const maxX = Math.max(...b.map((v) => v.maxX)) + margin;
  const minZ = Math.min(...b.map((v) => v.minZ)) - margin;
  const maxZ = Math.max(...b.map((v) => v.maxZ)) + margin;
  const sw = projection.toLatLon(minX, maxZ); // z besar = selatan
  const ne = projection.toLatLon(maxX, minZ);
  const se = projection.toLatLon(maxX, maxZ);
  const nw = projection.toLatLon(minX, minZ);
  return {
    south: Math.min(sw.lat, se.lat),
    west: Math.min(sw.lon, nw.lon),
    north: Math.max(ne.lat, nw.lat),
    east: Math.max(ne.lon, se.lon),
  };
}
```

- [ ] **Step 4: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/config.test.js`
Expected: PASS — `Tests  8 passed (8)`.

- [ ] **Step 5: Commit**

```bash
git add tools/citybake/config.js tests/citybake/config.test.js && git commit -m "feat(citybake): konfigurasi origin, area, kelas jalan, warna, mask"
```

---

### Task 6: Model fitur + `fetchOsm.js` (Overpass, cache, normalisasi)

Fixture `osm-mini.json` adalah bentuk sintetis berformat respons Overpass (`out geom`) di sekitar origin; dipakai juga oleh golden test (Task 19). Isinya: 4 bangunan way (salah satunya akan terkena mask uji), 1 bangunan multipolygon (dua way luar + satu lubang), jalan `primary` bernama, `footway`, `highway=construction` (diabaikan), air, sungai garis, landuse, dan satu node (diabaikan).

**Files:**
- Create: `tools/citybake/features.js`
- Create: `tools/citybake/fetchOsm.js`
- Create: `tests/citybake/fixtures/osm-mini.json`
- Test: `tests/citybake/fetchOsm.test.js`

- [ ] **Step 1: Buat fixture OSM mini**

`tests/citybake/fixtures/osm-mini.json`:
```json
{
  "version": 0.6,
  "generator": "fixture",
  "osm3s": {"timestamp_osm_base":"2026-10-16T00:00:00Z","copyright":"fixture — bentuk sintetis untuk tes"},
  "elements": [
    {"type":"node","id":1,"lat":0.4836,"lon":101.3895,"tags":{"highway":"street_lamp"}},
    {"type":"way","id":1001,"tags":{"building":"yes","building:levels":"3"},"geometry":[{"lat":0.4827362,"lon":101.3903362},{"lat":0.4827362,"lon":101.3905159},{"lat":0.4826458,"lon":101.3905159},{"lat":0.4826458,"lon":101.3903362},{"lat":0.4827362,"lon":101.3903362}]},
    {"type":"way","id":1002,"tags":{"building":"house"},"geometry":[{"lat":0.4830799,"lon":101.3908393},{"lat":0.4830799,"lon":101.3909112},{"lat":0.4830256,"lon":101.3909112},{"lat":0.4830256,"lon":101.3908393},{"lat":0.4830799,"lon":101.3908393}]},
    {"type":"way","id":1003,"tags":{"building":"yes"},"geometry":[{"lat":0.4825644,"lon":101.3885755},{"lat":0.4825644,"lon":101.3886833},{"lat":0.4824559,"lon":101.3886833},{"lat":0.4824559,"lon":101.3885755},{"lat":0.4825644,"lon":101.3885755}]},
    {"type":"way","id":1004,"tags":{"building":"yes"},"geometry":[{"lat":0.4854494,"lon":101.3876861},{"lat":0.4854494,"lon":101.3877759},{"lat":0.4853589,"lon":101.3877759},{"lat":0.4853589,"lon":101.3876861},{"lat":0.4854494,"lon":101.3876861}]},
    {"type":"way","id":2001,"tags":{"highway":"primary","name":"Jalan Uji Raya"},"geometry":[{"lat":0.4834145,"lon":101.3873717},{"lat":0.4834145,"lon":101.3895277},{"lat":0.4834145,"lon":101.3916837}]},
    {"type":"way","id":2002,"tags":{"highway":"footway"},"geometry":[{"lat":0.4844998,"lon":101.3900667},{"lat":0.482691,"lon":101.3900667}]},
    {"type":"way","id":2003,"tags":{"highway":"construction"},"geometry":[{"lat":0.4835954,"lon":101.3895277},{"lat":0.483505,"lon":101.3896175}]},
    {"type":"way","id":3001,"tags":{"natural":"water"},"geometry":[{"lat":0.484952,"lon":101.3881802},{"lat":0.484952,"lon":101.3890785},{"lat":0.4840476,"lon":101.3890785},{"lat":0.4840476,"lon":101.3881802},{"lat":0.484952,"lon":101.3881802}]},
    {"type":"way","id":3002,"tags":{"waterway":"stream","name":"Sungai Uji"},"geometry":[{"lat":0.4854041,"lon":101.390426},{"lat":0.484952,"lon":101.3913244}]},
    {"type":"way","id":4001,"tags":{"landuse":"grass"},"geometry":[{"lat":0.4857659,"lon":101.3873717},{"lat":0.4857659,"lon":101.3916837},{"lat":0.4854946,"lon":101.3916837},{"lat":0.4854946,"lon":101.3873717},{"lat":0.4857659,"lon":101.3873717}]},
    {"type":"relation","id":5001,"tags":{"type":"multipolygon","building":"commercial","height":"9"},"members":[{"type":"way","ref":9001,"role":"outer","geometry":[{"lat":0.4844546,"lon":101.3907405},{"lat":0.4844546,"lon":101.39101},{"lat":0.4841832,"lon":101.39101}]},{"type":"way","ref":9002,"role":"outer","geometry":[{"lat":0.4841832,"lon":101.39101},{"lat":0.4841832,"lon":101.3907405},{"lat":0.4844546,"lon":101.3907405}]},{"type":"way","ref":9003,"role":"inner","geometry":[{"lat":0.4843641,"lon":101.3908303},{"lat":0.4843641,"lon":101.3909201},{"lat":0.4842737,"lon":101.3909201},{"lat":0.4842737,"lon":101.3908303},{"lat":0.4843641,"lon":101.3908303}]}]}
  ]
}
```

- [ ] **Step 2: Tulis tes yang gagal**

```js
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildOverpassQuery, classify, landuseClassOf, joinSegments, normalizeOsm, fetchOverpass, loadOsm, osmCachePath,
} from '../../tools/citybake/fetchOsm.js';

const RAW = JSON.parse(readFileSync(new URL('./fixtures/osm-mini.json', import.meta.url), 'utf8'));
const BBOX = { south: 0.47, west: 101.37, north: 0.49, east: 101.4 };
const quietLog = { info: () => {}, warn: () => {} };

/** Respons fetch tiruan. */
const response = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  text: async () => body,
});

describe('buildOverpassQuery', () => {
  it('memuat bbox (S,W,N,E), semua kelas fitur, dan out geom', () => {
    const q = buildOverpassQuery(BBOX);
    expect(q).toContain('(0.4700000,101.3700000,0.4900000,101.4000000)');
    for (const k of ['"building"', '"highway"', '"waterway"', '"natural"="water"', '"landuse"', 'leisure']) expect(q).toContain(k);
    expect(q.trim().endsWith('out geom;')).toBe(true);
  });
});

describe('classify', () => {
  it('prioritas & kondisi tertutup', () => {
    expect(classify({ building: 'yes' }, true)).toEqual({ kind: 'building', cls: 'yes' });
    expect(classify({ building: 'yes' }, false)).toBeNull();
    expect(classify({ building: 'no', landuse: 'grass' }, true)).toEqual({ kind: 'landuse', cls: 'grass' });
    expect(classify({ highway: 'residential', junction: 'roundabout' }, true)).toEqual({ kind: 'road', cls: 'residential' });
    expect(classify({ highway: 'pedestrian', area: 'yes' }, true)).toBeNull();
    expect(classify({ highway: 'construction' }, false)).toBeNull();
    expect(classify({ natural: 'water' }, true)).toEqual({ kind: 'water', cls: 'water' });
    expect(classify({ waterway: 'river' }, false)).toEqual({ kind: 'waterway', cls: 'river' });
    expect(classify({ waterway: 'dam' }, false)).toBeNull();
  });

  it('landuseClassOf memetakan landuse/leisure/natural/amenity', () => {
    expect(landuseClassOf({ landuse: 'meadow' })).toBe('grass');
    expect(landuseClassOf({ leisure: 'stadium' })).toBe('pitch');
    expect(landuseClassOf({ natural: 'wood' })).toBe('forest');
    expect(landuseClassOf({ amenity: 'parking' })).toBe('parking');
    expect(landuseClassOf({ landuse: 'military' })).toBeNull();
  });
});

describe('joinSegments', () => {
  it('menyambung potongan (termasuk yang terbalik) menjadi ring tertutup', () => {
    const rings = joinSegments([[[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]]]);
    expect(rings).toEqual([[[0, 0], [1, 0], [1, 1], [0, 1]]]);
  });
  it('potongan yang tidak menutup dibuang', () => {
    expect(joinSegments([[[0, 0], [1, 0]], [[5, 5], [6, 6]]])).toEqual([]);
  });
});

describe('normalizeOsm (fixture)', () => {
  const { timestamp, features } = normalizeOsm(RAW);
  const byId = Object.fromEntries(features.map((f) => [f.id, f]));

  it('timestamp & jumlah fitur (node, highway=construction diabaikan)', () => {
    expect(timestamp).toBe('2026-10-16T00:00:00Z');
    expect(features.map((f) => f.id)).toEqual([
      'osm:relation/5001#0', 'osm:way/1001', 'osm:way/1002', 'osm:way/1003', 'osm:way/1004',
      'osm:way/2001', 'osm:way/2002', 'osm:way/3001', 'osm:way/3002', 'osm:way/4001',
    ]);
  });

  it('bangunan: ring terbuka [lon, lat] 4 titik', () => {
    const b = byId['osm:way/1001'];
    expect(b).toMatchObject({ source: 'osm', kind: 'building', cls: 'yes' });
    expect(b.rings).toHaveLength(1);
    expect(b.rings[0]).toHaveLength(4);
    expect(b.rings[0][0][0]).toBeGreaterThan(101);
    expect(b.rings[0][0][1]).toBeLessThan(1);
  });

  it('jalan & waterway sebagai line; air & landuse sebagai rings', () => {
    expect(byId['osm:way/2001']).toMatchObject({ kind: 'road', cls: 'primary' });
    expect(byId['osm:way/2001'].line).toHaveLength(3);
    expect(byId['osm:way/3002']).toMatchObject({ kind: 'waterway', cls: 'stream' });
    expect(byId['osm:way/3001']).toMatchObject({ kind: 'water', cls: 'water' });
    expect(byId['osm:way/4001']).toMatchObject({ kind: 'landuse', cls: 'grass' });
  });

  it('multipolygon: dua way luar digabung + satu lubang', () => {
    const m = byId['osm:relation/5001#0'];
    expect(m).toMatchObject({ kind: 'building', cls: 'commercial' });
    expect(m.rings).toHaveLength(2);
    expect(m.rings[0]).toHaveLength(4);
    expect(m.rings[1]).toHaveLength(4);
  });

  it('input tak valid → TypeError', () => {
    expect(() => normalizeOsm({})).toThrow(TypeError);
  });
});

describe('fetchOverpass', () => {
  it('retry pada 429 lalu sukses; User-Agent dikirim; endpoint bergiliran', async () => {
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push({ url, ua: init.headers['User-Agent'] });
      return calls.length === 1 ? response(429, 'busy', { 'retry-after': '1' }) : response(200, '{"elements":[]}');
    });
    const sleep = vi.fn(async () => {});
    const json = await fetchOverpass('q', { endpoints: ['https://a/api', 'https://b/api'], fetchImpl, sleep, log: quietLog });
    expect(json).toEqual({ elements: [] });
    expect(calls.map((c) => c.url)).toEqual(['https://a/api', 'https://b/api']);
    expect(calls[0].ua).toMatch(/citybake/);
    expect(sleep).toHaveBeenCalledWith(15000);
  });

  it('balasan 200 berisi HTML / remark runtime error dianggap sibuk', async () => {
    const bodies = ['<html>busy</html>', '{"elements":[],"remark":"runtime error: Query timed out"}', '{"elements":[1]}'];
    const fetchImpl = vi.fn(async () => response(200, bodies.shift()));
    const json = await fetchOverpass('q', { endpoints: ['https://a/api'], fetchImpl, sleep: async () => {}, log: quietLog });
    expect(json).toEqual({ elements: [1] });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('HTTP 400 tidak dicoba ulang; 5xx dicoba ulang sampai habis → galat', async () => {
    await expect(fetchOverpass('q', { fetchImpl: async () => response(400, 'bad'), sleep: async () => {}, log: quietLog }))
      .rejects.toThrow(/HTTP 400/);
    await expect(fetchOverpass('q', { fetchImpl: async () => response(500, ''), sleep: async () => {}, retries: 1, log: quietLog }))
      .rejects.toThrow(/gagal setelah 2 percobaan/);
  });
});

describe('loadOsm', () => {
  it('fetch sekali lalu memakai cache; offline tanpa cache → galat', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'citybake-osm-'));
    try {
      const fetchImpl = vi.fn(async () => response(200, JSON.stringify(RAW)));
      const opts = { cacheDir: dir, fetchOptions: { fetchImpl, sleep: async () => {} }, log: quietLog };
      const a = await loadOsm('uji', BBOX, opts);
      const b = await loadOsm('uji', BBOX, opts);
      expect(a.elements).toHaveLength(RAW.elements.length);
      expect(b).toEqual(a);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(JSON.parse(await readFile(osmCachePath(dir, 'uji'), 'utf8')).elements).toHaveLength(RAW.elements.length);
      await expect(loadOsm('lain', BBOX, { cacheDir: dir, offline: true, log: quietLog })).rejects.toThrow(/--offline/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/fetchOsm.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/fetchOsm.js'`.

- [ ] **Step 4: Implementasi model fitur**

`tools/citybake/features.js`:
```js
/**
 * Model fitur ternormalisasi citybake.
 *
 * @typedef {'building'|'road'|'water'|'waterway'|'landuse'} FeatureKind
 * @typedef {{
 *   id: string,                       // 'osm:way/123', 'osm:relation/9', 'overture:<gers-id>[#k]'
 *   source: 'osm'|'overture',
 *   kind: FeatureKind,
 *   cls: string,                      // building: nilai building; road: highway; water: 'water';
 *                                     // waterway: river|canal|...; landuse: kunci LANDUSE_COLORS
 *   tags: Record<string, string>,
 *   rings?: Array<Array<[number, number]>>,  // poligon: [luar, ...lubang], ring terbuka
 *   line?: Array<[number, number]>,          // polyline
 * }} Feature
 *
 * Koordinat: [lon, lat] (urutan GeoJSON) setelah normalisasi; [x, z] meter dunia setelah projectFeature.
 */
import { cleanRing } from '../../src/geo/polygon.js';

/** Proyeksikan satu fitur [lon, lat] → [x, z] dunia. Mengembalikan objek baru. */
export function projectFeature(feature, projection) {
  const pt = ([lon, lat]) => {
    const w = projection.toWorld(lat, lon);
    return [w.x, w.z];
  };
  const out = { ...feature };
  if (feature.rings) out.rings = feature.rings.map((r) => cleanRing(r.map(pt), 1e-3)).filter((r) => r.length >= 3);
  if (feature.line) out.line = feature.line.map(pt);
  return out;
}

/** Proyeksikan daftar fitur; fitur poligon yang ring luarnya hilang dibuang. */
export function projectFeatures(features, projection) {
  return features
    .map((f) => projectFeature(f, projection))
    .filter((f) => (f.rings ? f.rings.length > 0 : true) && (f.line ? f.line.length >= 2 : true));
}
```

- [ ] **Step 5: Implementasi `fetchOsm.js`**

```js
/**
 * OSM via Overpass API: query per bbox, cache ke data-src/osm/<area>.json, normalisasi ke Feature.
 * Etika: User-Agent mengidentifikasi aplikasi, satu permintaan pada satu waktu, backoff saat 429/5xx,
 * hasil di-cache sehingga bake ulang tidak membebani server.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { cleanRing, pointInPolygon } from '../../src/geo/polygon.js';
import { OVERPASS_ENDPOINTS, USER_AGENT, ROAD_CLASSES, WATERWAY_WIDTHS, LANDUSE_COLORS } from './config.js';

const BASE_BACKOFF_MS = 15000;
const DEFAULT_RETRIES = 4;

/** Query Overpass QL untuk bbox {south, west, north, east}; `out geom` menyertakan koordinat. */
export function buildOverpassQuery({ south, west, north, east }) {
  const b = [south, west, north, east].map((v) => v.toFixed(7)).join(',');
  return [
    '[out:json][timeout:180];',
    '(',
    `  way["building"](${b});`,
    `  relation["building"]["type"="multipolygon"](${b});`,
    `  way["highway"](${b});`,
    `  way["waterway"](${b});`,
    `  way["natural"="water"](${b});`,
    `  relation["natural"="water"](${b});`,
    `  way["landuse"](${b});`,
    `  relation["landuse"]["type"="multipolygon"](${b});`,
    `  way["leisure"~"^(park|pitch|stadium|sports_centre|playground|garden)$"](${b});`,
    `  way["natural"~"^(wood|scrub|grassland|wetland)$"](${b});`,
    `  way["amenity"~"^(parking|school|university|grave_yard)$"](${b});`,
    ');',
    'out geom;',
  ].join('\n');
}

/** Kelas landuse dari tag (kunci LANDUSE_COLORS) atau null. */
export function landuseClassOf(tags) {
  const lu = tags.landuse;
  const map = {
    residential: 'residential', commercial: 'commercial', retail: 'retail', industrial: 'industrial',
    education: 'education', religious: 'religious', cemetery: 'cemetery', grass: 'grass',
    meadow: 'grass', village_green: 'grass', recreation_ground: 'park', forest: 'forest',
    farmland: 'farmland', orchard: 'farmland', plantation: 'farmland', construction: 'construction',
    brownfield: 'construction', greenfield: 'grass',
  };
  if (lu && map[lu]) return map[lu];
  const leisure = { park: 'park', garden: 'park', playground: 'park', pitch: 'pitch', stadium: 'pitch', sports_centre: 'pitch' };
  if (tags.leisure && leisure[tags.leisure]) return leisure[tags.leisure];
  const natural = { wood: 'forest', scrub: 'scrub', grassland: 'grass', wetland: 'wetland' };
  if (tags.natural && natural[tags.natural]) return natural[tags.natural];
  const amenity = { parking: 'parking', school: 'education', university: 'education', grave_yard: 'cemetery' };
  if (tags.amenity && amenity[tags.amenity]) return amenity[tags.amenity];
  return null;
}

const isWater = (tags) =>
  tags.natural === 'water' || tags.waterway === 'riverbank' || tags.landuse === 'reservoir' || tags.landuse === 'basin';

/**
 * Tentukan {kind, cls} untuk tag; `closed` = way tertutup / multipolygon. null = abaikan.
 * Urutan prioritas: building → highway → air → waterway → landuse.
 */
export function classify(tags, closed) {
  if (tags.building && tags.building !== 'no' && closed) return { kind: 'building', cls: tags.building };
  if (tags.highway) {
    if (tags.area === 'yes' || !ROAD_CLASSES[tags.highway]) return null;
    return { kind: 'road', cls: tags.highway };
  }
  if (closed && isWater(tags)) return { kind: 'water', cls: 'water' };
  if (tags.waterway && WATERWAY_WIDTHS[tags.waterway] && !closed) return { kind: 'waterway', cls: tags.waterway };
  if (closed) {
    const lu = landuseClassOf(tags);
    if (lu && LANDUSE_COLORS[lu]) return { kind: 'landuse', cls: lu };
  }
  return null;
}

const toLonLat = (geometry) => geometry.map((p) => [p.lon, p.lat]);
const sameLL = (a, b) => a[0] === b[0] && a[1] === b[1];

/**
 * Sambung potongan way (anggota multipolygon) menjadi ring tertutup. Potongan yang tidak menutup
 * dibuang. @param {Array<Array<[number, number]>>} segments
 */
export function joinSegments(segments) {
  const pool = segments.filter((s) => s.length >= 2).map((s) => s.slice());
  const rings = [];
  while (pool.length > 0) {
    let cur = pool.shift();
    let extended = true;
    while (!sameLL(cur[0], cur[cur.length - 1]) && extended) {
      extended = false;
      const end = cur[cur.length - 1];
      for (let i = 0; i < pool.length; i += 1) {
        const s = pool[i];
        if (sameLL(s[0], end)) cur = cur.concat(s.slice(1));
        else if (sameLL(s[s.length - 1], end)) cur = cur.concat(s.slice(0, -1).reverse());
        else continue;
        pool.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (sameLL(cur[0], cur[cur.length - 1])) {
      const ring = cleanRing(cur, 0);
      if (ring.length >= 3) rings.push(ring);
    }
  }
  return rings;
}

function normalizeWay(el) {
  if (!el.tags || !Array.isArray(el.geometry) || el.geometry.length < 2) return null;
  const pts = toLonLat(el.geometry);
  const closed = pts.length >= 4 && sameLL(pts[0], pts[pts.length - 1]);
  const c = classify(el.tags, closed);
  if (!c) return null;
  const base = { id: `osm:way/${el.id}`, source: 'osm', kind: c.kind, cls: c.cls, tags: el.tags };
  if (c.kind === 'road' || c.kind === 'waterway') return { ...base, line: pts };
  const ring = cleanRing(pts, 0);
  return ring.length >= 3 ? { ...base, rings: [ring] } : null;
}

function normalizeRelation(el) {
  if (!el.tags || el.tags.type !== 'multipolygon' || !Array.isArray(el.members)) return [];
  const c = classify(el.tags, true);
  if (!c || c.kind === 'road' || c.kind === 'waterway') return [];
  const geomOf = (role) =>
    el.members.filter((m) => m.type === 'way' && m.role === role && Array.isArray(m.geometry)).map((m) => toLonLat(m.geometry));
  const outers = joinSegments(geomOf('outer'));
  const inners = joinSegments(geomOf('inner'));
  // Lubang ditempelkan ke ring luar pertama yang memuat titik pertamanya.
  return outers.map((outer, k) => {
    const holes = inners.filter((h) => pointInPolygon(h[0][0], h[0][1], outer));
    return { id: `osm:relation/${el.id}#${k}`, source: 'osm', kind: c.kind, cls: c.cls, tags: el.tags, rings: [outer, ...holes] };
  });
}

/**
 * Normalisasi respons Overpass JSON. Fitur diurutkan menurut id agar keluaran deterministik.
 * @returns {{ timestamp: string|null, features: import('./features.js').Feature[] }}
 */
export function normalizeOsm(raw) {
  if (!raw || !Array.isArray(raw.elements)) throw new TypeError('respons Overpass tidak valid: tidak ada "elements"');
  const features = [];
  for (const el of raw.elements) {
    if (el.type === 'way') {
      const f = normalizeWay(el);
      if (f) features.push(f);
    } else if (el.type === 'relation') {
      features.push(...normalizeRelation(el));
    }
  }
  features.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { timestamp: raw.osm3s?.timestamp_osm_base ?? null, features };
}

/** 429 dan semua 5xx dicoba ulang (Overpass publik sering 500/502/504 saat sibuk). */
const isRetryableStatus = (status) => status === 429 || status >= 500;

/** Galat HTTP non-retryable (4xx selain 429). */
class FatalHttpError extends Error {}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Overpass kadang membalas 200 dengan HTML/remark "runtime error" saat sibuk → perlu retry. */
async function parseOverpassResponse(res) {
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { retry: true, reason: `bukan JSON (${text.slice(0, 80).replace(/\s+/g, ' ')})` };
  }
  if (typeof json.remark === 'string' && /runtime error|timeout|out of memory/i.test(json.remark)) {
    return { retry: true, reason: `remark: ${json.remark.slice(0, 120)}` };
  }
  return { json };
}

/**
 * POST query ke Overpass dengan retry + backoff eksponensial (menghormati Retry-After), bergiliran
 * antar endpoint. @returns {Promise<object>} JSON mentah Overpass
 */
export async function fetchOverpass(query, {
  endpoints = OVERPASS_ENDPOINTS, fetchImpl = globalThis.fetch, sleep = defaultSleep,
  retries = DEFAULT_RETRIES, log = console,
} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const url = endpoints[attempt % endpoints.length];
    let waitMs = BASE_BACKOFF_MS * 2 ** attempt;
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ data: query }).toString(),
      });
      if (res.ok) {
        const parsed = await parseOverpassResponse(res);
        if (parsed.json) return parsed.json;
        lastError = new Error(`Overpass ${url}: ${parsed.reason}`);
      } else if (isRetryableStatus(res.status)) {
        const ra = Number(res.headers?.get?.('retry-after'));
        if (Number.isFinite(ra) && ra > 0) waitMs = Math.max(waitMs, ra * 1000);
        lastError = new Error(`Overpass ${url}: HTTP ${res.status}`);
      } else {
        throw new FatalHttpError(`Overpass ${url}: HTTP ${res.status} (tidak dicoba ulang)`);
      }
    } catch (err) {
      if (err instanceof FatalHttpError) throw err;
      lastError = err;
    }
    if (attempt < retries) {
      log.warn(`[citybake] ${lastError.message} — coba lagi dalam ${Math.round(waitMs / 1000)} s`);
      await sleep(waitMs);
    }
  }
  throw new Error(`Overpass gagal setelah ${retries + 1} percobaan: ${lastError?.message}`);
}

/** Path cache OSM untuk kawasan. */
export const osmCachePath = (cacheDir, areaId) => join(cacheDir, 'osm', `${areaId}.json`);

/**
 * Muat OSM mentah untuk kawasan: dari cache bila ada, selain itu fetch (kecuali offline) lalu simpan.
 * @returns {Promise<object>} JSON mentah Overpass
 */
export async function loadOsm(areaId, bbox, { cacheDir, offline = false, fetchOptions = {}, log = console } = {}) {
  const path = osmCachePath(cacheDir, areaId);
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw new Error(`cache OSM rusak (${path}): ${err.message}`, { cause: err });
  }
  if (offline) throw new Error(`mode --offline tetapi cache OSM tidak ada: ${path}`);
  log.info(`[citybake] mengambil OSM "${areaId}" dari Overpass…`);
  const raw = await fetchOverpass(buildOverpassQuery(bbox), { log, ...fetchOptions });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(raw));
  return raw;
}
```

- [ ] **Step 6: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/fetchOsm.test.js`
Expected: PASS — `Tests  14 passed (14)`.

- [ ] **Step 7: Commit**

```bash
git add tools/citybake/features.js tools/citybake/fetchOsm.js tests/citybake/fixtures/osm-mini.json tests/citybake/fetchOsm.test.js && git commit -m "feat(citybake): fetch & normalisasi OSM via Overpass (cache, retry, User-Agent)"
```

---

### Task 7: `fetchOverture.js` (DuckDB bbox, cache, fallback)

Fixture `overture-mini.geojson` berbentuk keluaran `rowsToGeoJSON` (properti kolom SQL apa adanya): `ov-a` bertumpuk dengan bangunan OSM 1001 (akan dibuang merge), `ov-b` rumah Google dengan `height`, `ov-c` bersumber OpenStreetMap (dibuang), `ov-d` MultiPolygon dua bagian dengan `num_floors`.

**Files:**
- Create: `tools/citybake/fetchOverture.js`
- Create: `tests/citybake/fixtures/overture-mini.geojson`
- Test: `tests/citybake/fetchOverture.test.js`

- [ ] **Step 1: Buat fixture Overture mini**

`tests/citybake/fixtures/overture-mini.geojson`:
```json
{
  "type": "FeatureCollection",
  "features": [
    {"type":"Feature","properties":{"id":"ov-a","src":"Microsoft ML Buildings","subtype":null,"class":null,"height":null,"num_floors":null,"name":null},"geometry":{"type":"Polygon","coordinates":[[[101.3903811,0.4827272],[101.390471,0.4827272],[101.390471,0.4826549],[101.3903811,0.4826549],[101.3903811,0.4827272]]]}},
    {"type":"Feature","properties":{"id":"ov-b","src":"Google Open Buildings","subtype":"residential","class":"house","height":7.5,"num_floors":null,"name":null},"geometry":{"type":"Polygon","coordinates":[[[101.3881398,0.4822705],[101.3882206,0.4822705],[101.3882206,0.4822072],[101.3881398,0.4822072],[101.3881398,0.4822705]]]}},
    {"type":"Feature","properties":{"id":"ov-c","src":"OpenStreetMap","subtype":null,"class":null,"height":null,"num_floors":null,"name":null},"geometry":{"type":"Polygon","coordinates":[[[101.3894828,0.4818319],[101.3895726,0.4818319],[101.3895726,0.4817414],[101.3894828,0.4817414],[101.3894828,0.4818319]]]}},
    {"type":"Feature","properties":{"id":"ov-d","src":"Microsoft ML Buildings","subtype":"commercial","class":null,"height":null,"num_floors":2,"name":"Ruko Uji"},"geometry":{"type":"MultiPolygon","coordinates":[[[[101.3912974,0.4818138],[101.3913513,0.4818138],[101.3913513,0.4817595],[101.3912974,0.4817595],[101.3912974,0.4818138]]],[[[101.3914771,0.4818138],[101.391531,0.4818138],[101.391531,0.4817595],[101.3914771,0.4817595],[101.3914771,0.4818138]]]]}}
  ]
}
```

- [ ] **Step 2: Tulis tes yang gagal (tanpa jaringan; koneksi DuckDB tiruan)**

```js
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildOvertureSql, rowsToGeoJSON, normalizeOverture, loadOverture, overtureCachePath,
} from '../../tools/citybake/fetchOverture.js';

const FC = JSON.parse(readFileSync(new URL('./fixtures/overture-mini.geojson', import.meta.url), 'utf8'));
const BBOX = { south: 0.47, west: 101.37, north: 0.49, east: 101.4 };
const quietLog = { info: () => {}, warn: vi.fn() };

describe('buildOvertureSql', () => {
  it('path rilis S3, predikat bbox irisan, kolom yang dibutuhkan', () => {
    const sql = buildOvertureSql(BBOX, '2026-09-23.1');
    expect(sql).toContain("s3://overturemaps-us-west-2/release/2026-09-23.1/theme=buildings/type=building/*");
    expect(sql).toContain('bbox.xmin <= 101.4000000 AND bbox.xmax >= 101.3700000');
    expect(sql).toContain('bbox.ymin <= 0.4900000 AND bbox.ymax >= 0.4700000');
    for (const col of ['height', 'num_floors', 'subtype', 'class', 'ST_AsGeoJSON(geometry)', 'sources[1].dataset']) {
      expect(sql).toContain(col);
    }
  });
});

describe('rowsToGeoJSON', () => {
  it('mengurai kolom geojson string; baris rusak dilewati', () => {
    const fc = rowsToGeoJSON([
      { id: 'a', height: 5, geojson: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}' },
      { id: 'b', geojson: '{rusak' },
      { id: 'c', geojson: null },
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties).toEqual({ id: 'a', height: 5 });
    expect(fc.features[0].geometry.type).toBe('Polygon');
  });
});

describe('normalizeOverture (fixture)', () => {
  const feats = normalizeOverture(FC);

  it('MultiPolygon dipecah, id berawalan overture:, urut', () => {
    expect(feats.map((f) => f.id)).toEqual(['overture:ov-a', 'overture:ov-b', 'overture:ov-c', 'overture:ov-d#0', 'overture:ov-d#1']);
  });

  it('properti → tag gaya OSM', () => {
    const b = feats.find((f) => f.id === 'overture:ov-b');
    expect(b).toMatchObject({ source: 'overture', kind: 'building', cls: 'house' });
    expect(b.tags).toMatchObject({ building: 'house', height: '7.5', 'overture:subtype': 'residential', 'overture:dataset': 'Google Open Buildings' });
    const d = feats.find((f) => f.id === 'overture:ov-d#1');
    expect(d.tags).toMatchObject({ building: 'yes', 'building:levels': '2', name: 'Ruko Uji' });
    expect(d.rings[0]).toHaveLength(4);
  });

  it('input tak valid → TypeError', () => {
    expect(() => normalizeOverture(null)).toThrow(TypeError);
  });
});

describe('loadOverture', () => {
  it('query via koneksi tiruan → cache; panggilan kedua dari cache', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'citybake-ov-'));
    try {
      const rows = [{ id: 'x', src: 'Microsoft ML Buildings', geojson: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}' }];
      const connection = { runAndReadAll: vi.fn(async () => ({ getRowObjectsJson: () => rows })), closeSync: vi.fn() };
      const connect = vi.fn(async () => connection);
      const a = await loadOverture('uji', BBOX, { cacheDir: dir, connect, log: quietLog });
      const b = await loadOverture('uji', BBOX, { cacheDir: dir, connect, log: quietLog });
      expect(a.features).toHaveLength(1);
      expect(b).toEqual(a);
      expect(connect).toHaveBeenCalledTimes(1);
      expect(JSON.parse(await readFile(overtureCachePath(dir, 'uji'), 'utf8')).features).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('DuckDB gagal → null + peringatan (fallback OSM saja)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'citybake-ov-'));
    try {
      const warn = vi.fn();
      const fc = await loadOverture('uji', BBOX, {
        cacheDir: dir, connect: async () => { throw new Error('S3 timeout'); }, log: { info: () => {}, warn },
      });
      expect(fc).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Overture gagal \(S3 timeout\)/));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('offline tanpa cache → null + peringatan, tanpa koneksi', async () => {
    const connect = vi.fn();
    const warn = vi.fn();
    const fc = await loadOverture('tidak-ada', BBOX, { cacheDir: tmpdir(), offline: true, connect, log: { info: () => {}, warn } });
    expect(fc).toBeNull();
    expect(connect).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/fetchOverture.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/fetchOverture.js'`.

- [ ] **Step 4: Implementasi**

```js
/**
 * Overture Maps buildings via DuckDB (@duckdb/node-api) langsung dari GeoParquet di S3 publik
 * (tanpa kredensial). Hasil di-cache ke data-src/overture/<area>.geojson. Bila DuckDB/S3 gagal,
 * pemanggil melanjutkan dengan OSM saja (loadOverture mengembalikan null + peringatan).
 * Catatan kinerja: query bbox kecil pun memindai metadata semua partisi global (±4–5 menit, 2026-10-16).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { cleanRing } from '../../src/geo/polygon.js';
import { OVERTURE } from './config.js';

const SETUP_SQL = Object.freeze(['INSTALL spatial', 'LOAD spatial', 'INSTALL httpfs', 'LOAD httpfs']);

/** SQL bbox Overture; predikat pada kolom struct `bbox` memanfaatkan statistik row-group Parquet. */
export function buildOvertureSql({ south, west, north, east }, release = OVERTURE.release) {
  const n = (v) => Number(v).toFixed(7);
  return [
    'SELECT id, names.primary AS name, sources[1].dataset AS src, subtype, class, height, num_floors,',
    '       ST_AsGeoJSON(geometry) AS geojson',
    `FROM read_parquet('${OVERTURE.s3Base}/${release}/theme=buildings/type=building/*', hive_partitioning=1)`,
    `WHERE bbox.xmin <= ${n(east)} AND bbox.xmax >= ${n(west)}`,
    `  AND bbox.ymin <= ${n(north)} AND bbox.ymax >= ${n(south)}`,
    'ORDER BY id',
  ].join('\n');
}

/** Koneksi DuckDB default (impor dinamis agar tes & mode tanpa Overture tidak memuat biner native). */
export async function connectDuckDb() {
  const { DuckDBInstance } = await import('@duckdb/node-api');
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  for (const sql of SETUP_SQL) await connection.run(sql);
  await connection.run(`SET s3_region='${OVERTURE.s3Region}'`);
  return connection;
}

/** Baris hasil query → GeoJSON FeatureCollection (properti apa adanya; geometri dari ST_AsGeoJSON). */
export function rowsToGeoJSON(rows) {
  const features = [];
  for (const row of rows) {
    let geometry;
    try {
      geometry = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
    } catch {
      continue;
    }
    if (!geometry) continue;
    const { geojson: _g, ...props } = row;
    features.push({ type: 'Feature', properties: props, geometry });
  }
  return { type: 'FeatureCollection', features };
}

const toNumber = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/** Tag gaya OSM dari properti Overture (agar height.js membaca satu skema). */
function overtureTags(props) {
  const tags = { building: props.class || 'yes' };
  const h = toNumber(props.height);
  const floors = toNumber(props.num_floors);
  if (Number.isFinite(h) && h > 0) tags.height = String(h);
  if (Number.isFinite(floors) && floors > 0) tags['building:levels'] = String(floors);
  if (props.subtype) tags['overture:subtype'] = String(props.subtype);
  if (props.src) tags['overture:dataset'] = String(props.src);
  if (props.name) tags.name = String(props.name);
  return tags;
}

/** Polygon/MultiPolygon GeoJSON → daftar `rings` ([luar, ...lubang], [lon, lat], terbuka). */
function polygonsOf(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polys
    .map((poly) => poly.map((ring) => cleanRing(ring.map(([lon, lat]) => [lon, lat]), 0)).filter((r) => r.length >= 3))
    .filter((rings) => rings.length > 0);
}

/**
 * Normalisasi FeatureCollection Overture → Feature bangunan. MultiPolygon dipecah: id `<id>#k`.
 * @returns {import('./features.js').Feature[]}
 */
export function normalizeOverture(fc) {
  if (!fc || !Array.isArray(fc.features)) throw new TypeError('GeoJSON Overture tidak valid: tidak ada "features"');
  const out = [];
  for (const f of fc.features) {
    const props = f.properties || {};
    if (!props.id || !f.geometry) continue;
    const parts = polygonsOf(f.geometry);
    parts.forEach((rings, k) => {
      const id = parts.length > 1 ? `overture:${props.id}#${k}` : `overture:${props.id}`;
      out.push({ id, source: 'overture', kind: 'building', cls: props.class || 'yes', tags: overtureTags(props), rings });
    });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Path cache Overture untuk kawasan. */
export const overtureCachePath = (cacheDir, areaId) => join(cacheDir, 'overture', `${areaId}.geojson`);

/**
 * Muat Overture untuk kawasan: cache → (bila tidak offline) DuckDB → simpan cache.
 * Gagal di mana pun → peringatan + null (bake lanjut dengan OSM saja).
 * @returns {Promise<object|null>} FeatureCollection atau null
 */
export async function loadOverture(areaId, bbox, {
  cacheDir, offline = false, release = OVERTURE.release, connect = connectDuckDb, log = console,
} = {}) {
  const path = overtureCachePath(cacheDir, areaId);
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      log.warn(`[citybake] cache Overture rusak (${path}): ${err.message} — lanjut tanpa Overture`);
      return null;
    }
  }
  if (offline) {
    log.warn(`[citybake] --offline dan cache Overture "${areaId}" tidak ada — lanjut OSM saja`);
    return null;
  }
  try {
    log.info(`[citybake] query Overture ${release} untuk "${areaId}" (DuckDB, beberapa menit)…`);
    const connection = await connect();
    const reader = await connection.runAndReadAll(buildOvertureSql(bbox, release));
    const fc = rowsToGeoJSON(reader.getRowObjectsJson());
    connection.closeSync?.();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(fc));
    return fc;
  } catch (err) {
    log.warn(`[citybake] Overture gagal (${err.message}) — lanjut OSM saja`);
    return null;
  }
}
```

- [ ] **Step 5: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/fetchOverture.test.js`
Expected: PASS — `Tests  8 passed (8)`.

- [ ] **Step 6: Commit**

```bash
git add tools/citybake/fetchOverture.js tests/citybake/fixtures/overture-mini.geojson tests/citybake/fetchOverture.test.js && git commit -m "feat(citybake): bangunan Overture via DuckDB (bbox, cache, fallback OSM)"
```

---

### Task 8: `merge.js` — OSM menang bila tumpang tindih

**Files:**
- Create: `tools/citybake/merge.js`
- Test: `tests/citybake/merge.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import { mergeBuildings } from '../../tools/citybake/merge.js';

const sq = (cx, cz, s) => [[cx - s / 2, cz - s / 2], [cx + s / 2, cz - s / 2], [cx + s / 2, cz + s / 2], [cx - s / 2, cz + s / 2]];
const osm = (id, ring) => ({ id: `osm:way/${id}`, source: 'osm', kind: 'building', cls: 'yes', tags: { building: 'yes' }, rings: [ring] });
const ov = (id, ring, dataset = 'Microsoft ML Buildings') => ({
  id: `overture:${id}`, source: 'overture', kind: 'building', cls: 'yes', tags: { building: 'yes', 'overture:dataset': dataset }, rings: [ring],
});

describe('mergeBuildings', () => {
  it('Overture yang centroid-nya di dalam OSM dibuang; yang terpisah dipertahankan', () => {
    const r = mergeBuildings([osm(1, sq(0, 0, 20))], [ov('a', sq(2, 2, 8)), ov('b', sq(100, 100, 8))]);
    expect(r.buildings.map((b) => b.id)).toEqual(['osm:way/1', 'overture:b']);
    expect(r.stats).toEqual({ osm: 1, overtureKept: 1, droppedOsmSource: 0, droppedOverlap: 1 });
  });

  it('Overture besar yang menutupi centroid OSM kecil juga dibuang', () => {
    const r = mergeBuildings([osm(1, sq(5, 5, 4))], [ov('big', sq(0, 0, 40))]);
    expect(r.buildings.map((b) => b.id)).toEqual(['osm:way/1']);
  });

  it('Overture bersumber OpenStreetMap selalu dibuang', () => {
    const r = mergeBuildings([], [ov('o', sq(0, 0, 10), 'OpenStreetMap')]);
    expect(r.buildings).toEqual([]);
    expect(r.stats.droppedOsmSource).toBe(1);
  });

  it('bersebelahan (bbox bersentuhan, tidak tumpang tindih) tetap dipertahankan', () => {
    const r = mergeBuildings([osm(1, sq(0, 0, 10))], [ov('n', sq(10, 0, 10))]);
    expect(r.buildings).toHaveLength(2);
  });

  it('tidak memutasi input', () => {
    const o = [osm(1, sq(0, 0, 10))];
    const v = [ov('a', sq(0, 0, 4))];
    mergeBuildings(o, v);
    expect(o).toHaveLength(1);
    expect(v).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/merge.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/merge.js'`.

- [ ] **Step 3: Implementasi**

```js
/**
 * Gabung bangunan OSM + Overture (koordinat dunia [x, z]). OSM menang bila tumpang tindih:
 * bangunan Overture dibuang bila (a) sumbernya OpenStreetMap (sudah ada versi Overpass yang lebih
 * segar), (b) centroid-nya di dalam poligon OSM, atau (c) centroid sebuah bangunan OSM di dalam
 * poligon Overture (Overture besar menutupi OSM kecil). Uji bbox dulu agar murah.
 */
import { boundsOverlap, pointInPolygon, polygonCentroid, ringBounds } from '../../src/geo/polygon.js';

const OSM_DATASET = 'OpenStreetMap';

/** Ringkasan geometri ring luar untuk uji tumpang tindih. */
function footprintInfo(feature) {
  const outer = feature.rings[0];
  return { outer, bounds: ringBounds(outer), c: polygonCentroid(outer) };
}

/** True bila dua footprint dianggap bangunan yang sama. */
function overlaps(a, b) {
  if (!boundsOverlap(a.bounds, b.bounds)) return false;
  return pointInPolygon(a.c.x, a.c.z, b.outer) || pointInPolygon(b.c.x, b.c.z, a.outer);
}

/**
 * @param {import('./features.js').Feature[]} osmBuildings
 * @param {import('./features.js').Feature[]} overtureBuildings
 * @returns {{ buildings: import('./features.js').Feature[],
 *   stats: { osm: number, overtureKept: number, droppedOsmSource: number, droppedOverlap: number } }}
 */
export function mergeBuildings(osmBuildings, overtureBuildings) {
  const osmInfo = osmBuildings.map(footprintInfo);
  const kept = [];
  let droppedOsmSource = 0;
  let droppedOverlap = 0;
  for (const ov of overtureBuildings) {
    if (ov.tags?.['overture:dataset'] === OSM_DATASET) {
      droppedOsmSource += 1;
      continue;
    }
    const info = footprintInfo(ov);
    if (osmInfo.some((o) => overlaps(o, info))) {
      droppedOverlap += 1;
      continue;
    }
    kept.push(ov);
  }
  return {
    buildings: [...osmBuildings, ...kept],
    stats: { osm: osmBuildings.length, overtureKept: kept.length, droppedOsmSource, droppedOverlap },
  };
}
```

- [ ] **Step 4: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/merge.test.js`
Expected: PASS — `Tests  5 passed (5)`.

- [ ] **Step 5: Commit**

```bash
git add tools/citybake/merge.js tests/citybake/merge.test.js && git commit -m "feat(citybake): gabung bangunan OSM + Overture (OSM menang)"
```

---

### Task 9: `height.js` baseline (+ `random.js`, `roadLocator.js`)

Implementasi baseline lengkap; aturan lokal Pekanbaru diperhalus user di Task 10. Tes di blok "kontrak" **wajib** tetap lulus apa pun perubahan aturan.

**Files:**
- Create: `tools/citybake/random.js`
- Create: `tools/citybake/roadLocator.js`
- Create: `tools/citybake/height.js`
- Test: `tests/citybake/height.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import {
  estimateHeight, explainHeight, parseHeight, parseLevels, HEURISTIC_RULES, MIN_HEIGHT, MAX_HEIGHT,
} from '../../tools/citybake/height.js';
import { hashString, mulberry32, seededUnit, pickBySeed } from '../../tools/citybake/random.js';
import { createRoadLocator } from '../../tools/citybake/roadLocator.js';

const sq = (s) => [[0, 0], [s, 0], [s, s], [0, s]];
const bld = (id, tags = {}, area = 100) => ({ id, cls: tags.building ?? 'yes', tags: { building: 'yes', ...tags }, rings: [sq(Math.sqrt(area))] });
const ids = (n) => Array.from({ length: n }, (_, i) => `osm:way/${i + 1}`);

describe('random', () => {
  it('hashString & mulberry32 deterministik', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const u = seededUnit('x', 's');
    expect(u).toBeGreaterThanOrEqual(0);
    expect(u).toBeLessThan(1);
    expect(['p', 'q', 'r']).toContain(pickBySeed(['p', 'q', 'r'], 'id'));
  });
});

describe('parseHeight / parseLevels', () => {
  it('format umum', () => {
    expect(parseHeight('12')).toBe(12);
    expect(parseHeight('12 m')).toBe(12);
    expect(parseHeight('12,5')).toBe(12.5);
    expect(parseHeight("40'")).toBeNull();
    expect(parseHeight('tinggi')).toBeNull();
    expect(parseLevels('3')).toBe(3);
    expect(parseLevels('2;4')).toBe(4);
    expect(parseLevels('x')).toBeNull();
  });
});

describe('estimateHeight — kontrak (WAJIB dipertahankan saat aturan diubah)', () => {
  it('tag height menang atas building:levels', () => {
    expect(explainHeight(bld('a', { height: '12 m', 'building:levels': '10' }))).toEqual({ height: 12, source: 'height', rule: null });
  });

  it('building:levels × 3,2 m', () => {
    expect(explainHeight(bld('a', { 'building:levels': '3' }))).toEqual({ height: 9.6, source: 'levels', rule: null });
  });

  it('dibatasi [2,5; 300] m', () => {
    expect(estimateHeight(bld('a', { height: '0.5' }))).toBe(MIN_HEIGHT);
    expect(estimateHeight(bld('a', { height: '1000' }))).toBe(MAX_HEIGHT);
  });

  it('heuristik deterministik untuk id yang sama', () => {
    for (const id of ids(20)) expect(estimateHeight(bld(id, {}, 180))).toBe(estimateHeight(bld(id, {}, 180)));
  });

  it('semua hasil heuristik dalam batas & kelipatan 0,1 m', () => {
    for (const cls of ['yes', 'house', 'retail', 'industrial', 'apartments', 'mosque', 'roof', 'school']) {
      for (const area of [30, 120, 400, 1500, 5000]) {
        const h = estimateHeight(bld(`osm:way/${cls}${area}`, { building: cls }, area));
        expect(h).toBeGreaterThanOrEqual(MIN_HEIGHT);
        expect(h).toBeLessThanOrEqual(MAX_HEIGHT);
        expect(Math.round(h * 10)).toBeCloseTo(h * 10, 6);
      }
    }
  });

  it('aturan terakhir menangkap semua (fallback)', () => {
    expect(HEURISTIC_RULES[HEURISTIC_RULES.length - 1].match({})).toBe(true);
  });
});

describe('estimateHeight — baseline heuristik', () => {
  it('rumah kecil (< 150 m²) = 1 lantai', () => {
    expect(explainHeight(bld('h', { building: 'house' }, 48))).toEqual({ height: 3.2, source: 'heuristic', rule: 'rumah' });
  });

  it('building=yes kecil 1 lantai; besar (> 1000 m²) 7–9 m', () => {
    expect(estimateHeight(bld('y', {}, 60))).toBe(3.2);
    for (const id of ids(30)) {
      const h = estimateHeight(bld(id, {}, 2000));
      expect(h).toBeGreaterThanOrEqual(7);
      expect(h).toBeLessThanOrEqual(9);
    }
  });

  it('building=yes 80–250 m² bervariasi 1–2 lantai', () => {
    const hs = new Set(ids(60).map((id) => estimateHeight(bld(id, {}, 150))));
    expect([...hs].sort()).toEqual([3.2, 6.4]);
  });

  it('ruko/komersial: 3–4 lantai di arteri, 2–3 lantai di jalan biasa', () => {
    for (const id of ids(30)) {
      const arteri = estimateHeight(bld(id, { building: 'retail' }, 120), { nearestRoadClass: 'primary' });
      const biasa = estimateHeight(bld(id, { building: 'retail' }, 120), { nearestRoadClass: 'residential' });
      expect([9.6, 12.8]).toContain(arteri);
      expect([6.4, 9.6]).toContain(biasa);
    }
  });

  it('industri besar 8–10 m; apartemen 800 m² 6–10 lantai', () => {
    for (const id of ids(20)) {
      const ind = estimateHeight(bld(id, { building: 'industrial' }, 1500));
      expect(ind).toBeGreaterThanOrEqual(8);
      expect(ind).toBeLessThanOrEqual(10);
      const apt = estimateHeight(bld(id, { building: 'apartments' }, 800));
      expect(apt).toBeGreaterThanOrEqual(6 * 3.2 - 1e-9);
      expect(apt).toBeLessThanOrEqual(10 * 3.2 + 1e-9);
    }
  });

  it('subtype Overture dipakai bila class kosong', () => {
    const f = { id: 'overture:x', cls: 'yes', tags: { building: 'yes', 'overture:subtype': 'industrial' }, rings: [sq(40)] };
    expect(explainHeight(f).rule).toBe('industri/gudang');
  });
});

describe('createRoadLocator', () => {
  const locate = createRoadLocator([
    { cls: 'primary', line: [[0, 0], [200, 0]] },
    { cls: 'residential', line: [[0, 30], [200, 30]] },
  ]);
  it('kelas jalan terdekat dalam maxDist', () => {
    expect(locate(50, 5)).toBe('primary');
    expect(locate(50, 25)).toBe('residential');
    expect(locate(50, 200)).toBeNull();
    expect(locate(250, 0, 60)).toBe('primary');
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/height.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/height.js'`.

- [ ] **Step 3: Implementasi `random.js`**

```js
/**
 * Acak deterministik untuk bake: hasil sama untuk id yang sama di setiap mesin/jalankan.
 */

/** FNV-1a 32-bit dari string → uint32. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** PRNG mulberry32 → fungsi () => [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Satu bilangan [0, 1) dari id + salt. */
export const seededUnit = (id, salt = '') => mulberry32(hashString(`${id}|${salt}`))();

/** Pilih elemen array secara deterministik dari id + salt. */
export const pickBySeed = (items, id, salt = '') => items[Math.floor(seededUnit(id, salt) * items.length) % items.length];
```

- [ ] **Step 4: Implementasi `roadLocator.js`**

```js
/**
 * Pencari kelas jalan terdekat (grid seragam) — konteks heuristik tinggi bangunan.
 * Input jalan dalam koordinat dunia ({cls, line: [[x, z], ...]}).
 */

const CELL = 50;

function distToSegment(px, pz, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2)) : 0;
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

const cellKey = (cx, cz) => `${cx},${cz}`;

/**
 * @param {Array<{cls: string, line: Array<[number, number]>}>} roads
 * @returns {(x: number, z: number, maxDist?: number) => string|null} kelas jalan terdekat ≤ maxDist
 */
export function createRoadLocator(roads) {
  const grid = new Map();
  for (const road of roads) {
    for (let i = 0; i < road.line.length - 1; i += 1) {
      const a = road.line[i];
      const b = road.line[i + 1];
      const seg = { cls: road.cls, a, b };
      const cx0 = Math.floor(Math.min(a[0], b[0]) / CELL);
      const cx1 = Math.floor(Math.max(a[0], b[0]) / CELL);
      const cz0 = Math.floor(Math.min(a[1], b[1]) / CELL);
      const cz1 = Math.floor(Math.max(a[1], b[1]) / CELL);
      for (let cx = cx0; cx <= cx1; cx += 1) {
        for (let cz = cz0; cz <= cz1; cz += 1) {
          const k = cellKey(cx, cz);
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(seg);
        }
      }
    }
  }
  return (x, z, maxDist = 40) => {
    const r = Math.ceil(maxDist / CELL);
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let best = null;
    let bestD = maxDist;
    for (let i = cx - r; i <= cx + r; i += 1) {
      for (let j = cz - r; j <= cz + r; j += 1) {
        for (const s of grid.get(cellKey(i, j)) ?? []) {
          const d = distToSegment(x, z, s.a, s.b);
          if (d <= bestD) {
            bestD = d;
            best = s.cls;
          }
        }
      }
    }
    return best;
  };
}
```

- [ ] **Step 5: Implementasi `height.js`**

```js
/**
 * Estimasi tinggi bangunan (m). Urutan: tag `height` → `building:levels` × LEVEL_HEIGHT → heuristik
 * (tabel HEURISTIC_RULES, aturan pertama yang cocok menang). Deterministik: variasi diambil dari
 * hash id bangunan.
 *
 * TITIK KONTRIBUSI USER: HEURISTIC_RULES adalah baseline umum; pengetahuan lokal Pekanbaru
 * (ruko 2–3 lantai di arteri, rumah 1 lantai di gang, gedung tinggi di Sudirman) ditambahkan user
 * di tabel ini (lihat Task 10 rencana Plan B).
 */
import { polygonArea } from '../../src/geo/polygon.js';
import { LEVEL_HEIGHT } from './config.js';
import { seededUnit } from './random.js';

export const MIN_HEIGHT = 2.5;
export const MAX_HEIGHT = 300;

/** Kelas jalan arteri (konteks ruko/komersial). */
export const ARTERIAL_CLASSES = Object.freeze(new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link',
]));

const clamp = (v) => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, v));
const round1 = (v) => Math.round(v * 10) / 10;

/** "12", "12 m", "12m", "12,5" → angka (m); satuan kaki/format lain → null. */
export function parseHeight(value) {
  if (value === undefined || value === null) return null;
  const m = String(value).match(/^\s*(\d+(?:[.,]\d+)?)\s*(m|meter|meters)?\s*$/i);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** "3", "2.5", "2;3" (ambil maks) → jumlah lantai; null bila tidak valid. */
export function parseLevels(value) {
  if (value === undefined || value === null) return null;
  const nums = String(value).split(/[;,]/).map((s) => Number(s.trim())).filter((v) => Number.isFinite(v) && v > 0);
  return nums.length ? Math.max(...nums) : null;
}

const inSet = (list) => {
  const s = new Set(list);
  return (v) => s.has(v);
};

const isSmallStructure = inSet(['roof', 'carport', 'shed', 'garage', 'garages', 'kiosk', 'hut', 'toilets', 'gazebo', 'cabin']);
const isIndustrial = inSet(['industrial', 'warehouse', 'factory', 'manufacture', 'hangar', 'storage_tank']);
const isReligious = inSet(['mosque', 'church', 'temple', 'religious', 'chapel', 'cathedral', 'shrine']);
const isHighrise = inSet(['apartments', 'office', 'hotel', 'dormitory']);
const isEducationCivic = inSet(['school', 'university', 'college', 'kindergarten', 'government', 'public', 'civic', 'train_station']);
const isCommercial = inSet(['retail', 'commercial', 'shop', 'supermarket', 'mall', 'kios']);
const isHouse = inSet(['house', 'detached', 'semidetached_house', 'terrace', 'bungalow', 'residential']);
const isStadium = inSet(['stadium', 'grandstand']);

/**
 * Aturan heuristik berurutan. `pick(info)` → { floors: [min, max] } (bilangan bulat, × LEVEL_HEIGHT)
 * atau { height: [min, max] } (meter, kontinu). info = { id, cls, subtype, area, nearestRoadClass }.
 */
export const HEURISTIC_RULES = Object.freeze([
  { name: 'struktur kecil', match: (i) => isSmallStructure(i.cls), pick: () => ({ height: [2.6, 3.4] }) },
  { name: 'stadion/tribun', match: (i) => isStadium(i.cls), pick: () => ({ height: [12, 18] }) },
  {
    name: 'industri/gudang',
    match: (i) => isIndustrial(i.cls) || i.subtype === 'industrial',
    pick: (i) => ({ height: i.area > 1000 ? [8, 10] : [5.5, 7] }),
  },
  { name: 'ibadah', match: (i) => isReligious(i.cls) || i.subtype === 'religious', pick: () => ({ height: [8, 12] }) },
  { name: 'rumah sakit', match: (i) => i.cls === 'hospital' || i.subtype === 'medical', pick: () => ({ floors: [3, 5] }) },
  {
    name: 'apartemen/kantor/hotel',
    match: (i) => isHighrise(i.cls),
    pick: (i) => ({ floors: i.area < 500 ? [4, 6] : i.area < 2000 ? [6, 10] : [8, 15] }),
  },
  {
    name: 'pendidikan/pemerintahan',
    match: (i) => isEducationCivic(i.cls) || i.subtype === 'education' || i.subtype === 'civic',
    pick: () => ({ floors: [2, 3] }),
  },
  {
    name: 'ruko/komersial',
    match: (i) => isCommercial(i.cls) || i.subtype === 'commercial',
    pick: (i) => ({ floors: ARTERIAL_CLASSES.has(i.nearestRoadClass) ? [3, 4] : [2, 3] }),
  },
  {
    name: 'rumah',
    match: (i) => isHouse(i.cls) || i.subtype === 'residential',
    pick: (i) => ({ floors: i.area < 150 ? [1, 1] : [1, 2] }),
  },
  {
    name: 'umum (building=yes)',
    match: () => true,
    pick: (i) => {
      if (i.area < 80) return { floors: [1, 1] };
      if (i.area < 250) return { floors: [1, 2] };
      if (i.area < 1000) return { floors: [2, 3] };
      return { height: [7, 9] };
    },
  },
]);

/** Terapkan rentang aturan dengan nilai acak deterministik r ∈ [0, 1). */
function applyRange(spec, r) {
  if (spec.floors) {
    const [lo, hi] = spec.floors;
    return (lo + Math.min(hi - lo, Math.floor(r * (hi - lo + 1)))) * LEVEL_HEIGHT;
  }
  const [lo, hi] = spec.height;
  return lo + r * (hi - lo);
}

/**
 * Tinggi + asal estimasi (untuk debugging/laporan).
 * @param {{id: string, cls?: string, tags?: Record<string,string>, rings?: Array<Array<[number,number]>>}} feature
 * @param {{area?: number, nearestRoadClass?: string|null, rules?: typeof HEURISTIC_RULES}} [ctx]
 * @returns {{height: number, source: 'height'|'levels'|'heuristic', rule: string|null}}
 */
export function explainHeight(feature, ctx = {}) {
  const tags = feature.tags ?? {};
  const h = parseHeight(tags.height);
  if (h !== null) return { height: round1(clamp(h)), source: 'height', rule: null };
  const levels = parseLevels(tags['building:levels']);
  if (levels !== null) return { height: round1(clamp(levels * LEVEL_HEIGHT)), source: 'levels', rule: null };
  const info = {
    id: feature.id,
    cls: feature.cls ?? tags.building ?? 'yes',
    subtype: tags['overture:subtype'] ?? null,
    area: ctx.area ?? (feature.rings ? polygonArea(feature.rings[0]) : 0),
    nearestRoadClass: ctx.nearestRoadClass ?? null,
  };
  const rules = ctx.rules ?? HEURISTIC_RULES;
  const rule = rules.find((r) => r.match(info)) ?? rules[rules.length - 1];
  const height = applyRange(rule.pick(info), seededUnit(feature.id, 'height'));
  return { height: round1(clamp(height)), source: 'heuristic', rule: rule.name };
}

/** Tinggi bangunan (m, dibulatkan 0,1). */
export const estimateHeight = (feature, ctx = {}) => explainHeight(feature, ctx).height;
```

- [ ] **Step 6: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/height.test.js`
Expected: PASS — `Tests  15 passed (15)`.

- [ ] **Step 7: Commit**

```bash
git add tools/citybake/random.js tools/citybake/roadLocator.js tools/citybake/height.js tests/citybake/height.test.js && git commit -m "feat(citybake): estimasi tinggi bangunan baseline (height → levels → heuristik)"
```

---

### Task 10: TITIK KONTRIBUSI USER — memperhalus aturan heuristik lokal Pekanbaru

> Task ini dikerjakan **user** (pengetahuan lokal), bukan agen. Agen yang mengeksekusi rencana ini cukup memastikan Task 9 selesai, lalu **melewati** Task 10 dan melanjutkan ke Task 11; pipeline tetap berjalan dengan baseline. Setelah user mengubah aturan, jalankan ulang `npm run bake -- --area all --offline` (Task 21 Step 6) agar tile memakai aturan baru.

Yang boleh diubah user: isi dan urutan `HEURISTIC_RULES` di `tools/citybake/height.js` (aturan pertama yang cocok menang; aturan terakhir harus tetap menangkap semua), serta `ARTERIAL_CLASSES`. Konteks yang tersedia untuk tiap bangunan: `info = { id, cls, subtype, area, nearestRoadClass }` (`nearestRoadClass` = kelas jalan OSM terdekat ≤ 40 m atau `null`).

Yang **wajib dipertahankan**: seluruh blok `describe('estimateHeight — kontrak …')` di `tests/citybake/height.test.js`. Tes di blok "baseline heuristik" boleh diubah/diganti bila aturan lokal sengaja berbeda — ubah tes dulu (merah), lalu aturan (hijau).

**Files:**
- Modify: `tools/citybake/height.js` (`HEURISTIC_RULES`)
- Test: `tests/citybake/heightLocal.test.js`

- [ ] **Step 1: Tulis tes aturan lokal (contoh yang dapat diubah user)**

`tests/citybake/heightLocal.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { estimateHeight, explainHeight } from '../../tools/citybake/height.js';

const sq = (s) => [[0, 0], [s, 0], [s, s], [0, s]];
const bld = (id, cls, area) => ({ id, cls, tags: { building: cls }, rings: [sq(Math.sqrt(area))] });
const ids = (n) => Array.from({ length: n }, (_, i) => `osm:way/${9000 + i}`);

describe('aturan lokal Pekanbaru (milik user)', () => {
  it('rumah di gang (jalan residential/service) tetap 1 lantai', () => {
    for (const id of ids(20)) {
      expect(estimateHeight(bld(id, 'house', 90), { nearestRoadClass: 'service' })).toBe(3.2);
    }
  });

  it('pusat perbelanjaan besar di arteri (retail > 3000 m²) 4–6 lantai', () => {
    for (const id of ids(20)) {
      const r = explainHeight(bld(id, 'retail', 5000), { nearestRoadClass: 'primary' });
      expect(r.rule).toBe('mal di arteri (lokal)');
      expect(r.height).toBeGreaterThanOrEqual(4 * 3.2);
      expect(r.height).toBeLessThanOrEqual(6 * 3.2);
    }
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/heightLocal.test.js`
Expected: FAIL pada tes kedua — `expected 'ruko/komersial' to be 'mal di arteri (lokal)'`.

- [ ] **Step 3: Tambah aturan lokal di `HEURISTIC_RULES`**

Sisipkan entri berikut di `tools/citybake/height.js` **tepat sebelum** entri `name: 'ruko/komersial'`:
```js
  {
    name: 'mal di arteri (lokal)',
    match: (i) => (isCommercial(i.cls) || i.subtype === 'commercial') && i.area > 3000 && ARTERIAL_CLASSES.has(i.nearestRoadClass),
    pick: () => ({ floors: [4, 6] }),
  },
```
Aturan lokal lain yang disarankan untuk dipertimbangkan user (tulis tesnya dulu dengan pola yang sama): gedung perkantoran/hotel tinggi di koridor Jl. Jend. Sudirman (butuh konteks nama jalan — tambahkan `nearestRoadName` ke `createRoadLocator` bila diperlukan), ruko deret 3 lantai di Jl. HR Soebrantas/Panam, gudang di kawasan industri.

- [ ] **Step 4: Jalankan semua tes tinggi, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/height.test.js tests/citybake/heightLocal.test.js`
Expected: PASS — `Tests  17 passed (17)`.

- [ ] **Step 5: Commit**

```bash
git add tools/citybake/height.js tests/citybake/heightLocal.test.js && git commit -m "feat(citybake): aturan tinggi lokal Pekanbaru (kontribusi user)"
```

---

### Task 11: Geometri dasar — `meshBuilder`, `colors`, `areas`

**Files:**
- Create: `tools/citybake/geometry/meshBuilder.js`
- Create: `tools/citybake/geometry/colors.js`
- Create: `tools/citybake/geometry/areas.js`
- Create: `tests/citybake/meshTestUtils.js` (helper, bukan file tes)
- Test: `tests/citybake/geometryAreas.test.js`

- [ ] **Step 1: Buat helper tes geometri**

`tests/citybake/meshTestUtils.js`:
```js
/** Helper tes geometri citybake (bukan file tes). */

export const WHITE = [1, 1, 1];
export const rect = (cx, cz, w, d) => [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];

/** Normal geometris (CCW) tiap segitiga + titik tengahnya. */
export function faces(arrays) {
  const { positions: p, indices: ix } = arrays;
  const out = [];
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t], ix[t + 1], ix[t + 2]].map((i) => [p[3 * i], p[3 * i + 1], p[3 * i + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    out.push({ n, mid: [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3], a: ix[t] });
  }
  return out;
}

export function bbox(arrays) {
  const p = arrays.positions;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k += 1) {
    min[k] = Math.min(min[k], p[i + k]);
    max[k] = Math.max(max[k], p[i + k]);
  }
  return { min, max };
}
```

- [ ] **Step 2: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import { createMeshBuilder, addFace } from '../../tools/citybake/geometry/meshBuilder.js';
import { hexToLinear, shade } from '../../tools/citybake/geometry/colors.js';
import { addFlatPolygon } from '../../tools/citybake/geometry/areas.js';
import { WHITE, rect, faces, bbox } from './meshTestUtils.js';

describe('colors', () => {
  it('hexToLinear: sRGB → linear', () => {
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToLinear('#000000')).toEqual([0, 0, 0]);
    expect(hexToLinear('#808080')[0]).toBeCloseTo(0.2159, 3);
    expect(() => hexToLinear('merah')).toThrow(TypeError);
    expect(shade([0.5, 1, 0.2], 1.5)).toEqual([0.75, 1, 0.30000000000000004]);
  });
});

describe('meshBuilder', () => {
  it('addFace membalik urutan agar normal searah expected', () => {
    const b = createMeshBuilder();
    addFace(b, [[0, 0, 0], [1, 0, 0], [1, 0, 1]], WHITE, [0, -1, 0]);
    const a = b.toArrays();
    expect(faces(a)[0].n[1]).toBeLessThan(0);
    expect(Array.from(a.normals.slice(0, 3))).toEqual([0, -1, 0]);
    expect(createMeshBuilder().toArrays()).toBeNull();
  });
});

describe('addFlatPolygon', () => {
  it('persegi → 2 segitiga menghadap +Y pada y yang diminta', () => {
    const b = createMeshBuilder();
    expect(addFlatPolygon(b, [rect(0, 0, 10, 10)], 0.04, WHITE)).toBe(2);
    const a = b.toArrays();
    for (const f of faces(a)) expect(f.n[1]).toBeGreaterThan(0);
    expect(bbox(a)).toEqual({ min: [-5, 0.03999999910593033, -5], max: [5, 0.03999999910593033, 5] });
  });

  it('poligon dengan lubang: 8 segitiga, orientasi ring input tidak berpengaruh', () => {
    const b = createMeshBuilder();
    expect(addFlatPolygon(b, [[...rect(0, 0, 10, 10)].reverse(), rect(0, 0, 4, 4)], 0, WHITE)).toBe(8);
    for (const f of faces(b.toArrays())) expect(f.n[1]).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/geometryAreas.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/geometry/meshBuilder.js'`.

- [ ] **Step 4: Implementasi `meshBuilder.js`**

```js
/**
 * Akumulator mesh sederhana (POSITION/NORMAL/COLOR_0 + indeks) dan helper muka berorientasi otomatis.
 * Builder sengaja mutable tetapi lokal: dibuat, diisi, lalu dibekukan lewat toArrays() dalam satu fungsi.
 */

/** @typedef {[number, number, number]} Vec3 */

export function createMeshBuilder() {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  return {
    /** Tambah vertex; kembalikan indeksnya. */
    addVertex(x, y, z, nx, ny, nz, rgb) {
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      colors.push(rgb[0], rgb[1], rgb[2]);
      return positions.length / 3 - 1;
    },
    addTriangle(a, b, c) {
      indices.push(a, b, c);
    },
    get vertexCount() {
      return positions.length / 3;
    },
    get triangleCount() {
      return indices.length / 3;
    },
    /** Salinan bertipe; null bila kosong. */
    toArrays() {
      if (indices.length === 0) return null;
      return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        colors: new Float32Array(colors),
        indices: new Uint32Array(indices),
      };
    },
  };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 1, 0];
}

/**
 * Tambah muka datar (segitiga atau quad planar) dengan normal flat. Urutan titik dibalik bila
 * normal geometris berlawanan dengan `expected`, sehingga muka depan (CCW) selalu menghadap keluar.
 * @param {ReturnType<typeof createMeshBuilder>} builder
 * @param {Vec3[]} pts 3 atau 4 titik
 * @param {Vec3|Vec3[]} rgb satu warna atau warna per titik (sejajar `pts`)
 * @param {Vec3} expected arah kira-kira normal luar
 */
export function addFace(builder, pts, rgb, expected) {
  const cols = Array.isArray(rgb[0]) ? rgb : pts.map(() => rgb);
  let n = normalize(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  let order = pts.map((_, i) => i);
  if (dot(n, expected) < 0) {
    order = order.reverse();
    n = [-n[0], -n[1], -n[2]];
  }
  const idx = order.map((i) => builder.addVertex(pts[i][0], pts[i][1], pts[i][2], n[0], n[1], n[2], cols[i]));
  builder.addTriangle(idx[0], idx[1], idx[2]);
  if (idx.length === 4) builder.addTriangle(idx[0], idx[2], idx[3]);
}

/**
 * Tambah segitiga horizontal (normal +Y) dari indeks vertex yang sudah ada; urutan disesuaikan agar
 * menghadap atas. `xz` = koordinat [x, z] per indeks.
 */
export function addUpTriangle(builder, a, b, c, xz) {
  const [ax, az] = xz(a);
  const [bx, bz] = xz(b);
  const [cx, cz] = xz(c);
  const upY = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
  if (upY >= 0) builder.addTriangle(a, b, c);
  else builder.addTriangle(a, c, b);
}
```

- [ ] **Step 5: Implementasi `colors.js`**

```js
/**
 * Warna vertex. glTF COLOR_0 berada di ruang LINEAR, jadi palet sRGB (#rrggbb) dikonversi di sini.
 */

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** '#rrggbb' (sRGB) → [r, g, b] linear 0..1. */
export function hexToLinear(hex) {
  const m = String(hex).match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) throw new TypeError(`warna tidak valid: ${hex}`);
  return [1, 2, 3].map((i) => srgbToLinear(parseInt(m[i], 16) / 255));
}

/** Kalikan warna linear dengan faktor (gelap < 1 < terang), dibatasi 0..1. */
export const shade = (rgb, factor) => rgb.map((c) => Math.min(1, Math.max(0, c * factor)));
```

- [ ] **Step 6: Implementasi `areas.js`**

```js
/**
 * Poligon datar (air, landuse, atap datar) → segitiga menghadap +Y. Triangulasi memakai
 * THREE.ShapeUtils.triangulateShape (earcut; three sudah dependensi proyek dan dapat diimpor di Node).
 */
import { ShapeUtils, Vector2 } from 'three';
import { addUpTriangle } from './meshBuilder.js';

/**
 * Tambah poligon (dengan lubang) pada ketinggian y.
 * @param {ReturnType<import('./meshBuilder.js').createMeshBuilder>} builder
 * @param {Array<Array<[number, number]>>} rings [luar, ...lubang] (tile-lokal, terbuka)
 * @param {number} y
 * @param {[number, number, number]} rgb warna linear
 * @returns {number} jumlah segitiga yang ditambahkan
 */
export function addFlatPolygon(builder, rings, y, rgb) {
  const [outer, ...holes] = rings;
  if (!outer || outer.length < 3) return 0;
  const contour = outer.map(([x, z]) => new Vector2(x, z));
  const holeVecs = holes.filter((h) => h.length >= 3).map((h) => h.map(([x, z]) => new Vector2(x, z)));
  const faces = ShapeUtils.triangulateShape(contour, holeVecs);
  // triangulateShape dapat membuang titik ujung duplikat secara in-place: pakai array setelah dipanggil.
  const verts = [...contour, ...holeVecs.flat()];
  const base = builder.vertexCount;
  for (const v of verts) builder.addVertex(v.x, y, v.y, 0, 1, 0, rgb);
  const xz = (i) => [verts[i - base].x, verts[i - base].y];
  for (const [a, b, c] of faces) addUpTriangle(builder, base + a, base + b, base + c, xz);
  return faces.length;
}
```

- [ ] **Step 7: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/geometryAreas.test.js`
Expected: PASS — `Tests  4 passed (4)`.

- [ ] **Step 8: Commit**

```bash
git add tools/citybake/geometry/meshBuilder.js tools/citybake/geometry/colors.js tools/citybake/geometry/areas.js tests/citybake/meshTestUtils.js tests/citybake/geometryAreas.test.js && git commit -m "feat(citybake): mesh builder, warna linear, poligon datar"
```

---

### Task 12: Geometri bangunan — extrude, atap datar & pelana

**Files:**
- Create: `tools/citybake/geometry/buildings.js`
- Test: `tests/citybake/geometryBuildings.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import { createMeshBuilder } from '../../tools/citybake/geometry/meshBuilder.js';
import { addBuilding, rectangleFrame } from '../../tools/citybake/geometry/buildings.js';
import { WHITE, rect, faces, bbox } from './meshTestUtils.js';

describe('rectangleFrame', () => {
  it('persegi panjang → sisi pertama adalah sisi panjang', () => {
    const f = rectangleFrame(rect(0, 0, 6, 10));
    expect(f).toHaveLength(4);
    expect(Math.hypot(f[1][0] - f[0][0], f[1][1] - f[0][1])).toBeCloseTo(10, 9);
  });
  it('titik segaris dibuang; bentuk L & jajar genjang → null', () => {
    expect(rectangleFrame([[0, 0], [5, 0], [10, 0], [10, 6], [0, 6]])).toHaveLength(4);
    expect(rectangleFrame([[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]])).toBeNull();
    expect(rectangleFrame([[0, 0], [10, 0], [14, 6], [4, 6]])).toBeNull();
  });
});

describe('addBuilding', () => {
  const build = (opts) => {
    const walls = createMeshBuilder();
    const roofs = createMeshBuilder();
    const kind = addBuilding({ walls, roofs }, { wallRgb: WHITE, roofRgb: [0.5, 0.2, 0.1], ...opts });
    return { kind, walls, roofs };
  };

  it('atap datar: 4 dinding (8 segitiga) + atap 2 segitiga; bbox = footprint × tinggi', () => {
    const { kind, walls, roofs } = build({ rings: [rect(0, 0, 20, 10)], height: 9.6 });
    expect(kind).toBe('flat');
    expect(walls.triangleCount).toBe(8);
    expect(roofs.triangleCount).toBe(2);
    const bw = bbox(walls.toArrays());
    expect(bw.min).toEqual([-10, 0, -5]);
    expect(bw.max[1]).toBeCloseTo(9.6, 5);
  });

  it('normal dinding menghadap keluar (menjauhi pusat footprint), atap ke atas', () => {
    const { walls, roofs } = build({ rings: [[...rect(0, 0, 20, 10)].reverse()], height: 6 });
    for (const f of faces(walls.toArrays())) {
      expect(f.n[0] * f.mid[0] + f.n[2] * f.mid[2]).toBeGreaterThan(0);
      expect(Math.abs(f.n[1])).toBeLessThan(1e-6);
    }
    for (const f of faces(roofs.toArrays())) expect(f.n[1]).toBeGreaterThan(0);
  });

  it('atap pelana: dinding 8 + 2 segitiga ujung, atap 4 segitiga; bubungan di sumbu panjang', () => {
    const { kind, walls, roofs } = build({ rings: [rect(0, 0, 8, 6)], height: 3.2, gable: true });
    expect(kind).toBe('gable');
    expect(walls.triangleCount).toBe(10);
    expect(roofs.triangleCount).toBe(4);
    const br = bbox(roofs.toArrays());
    expect(br.max[1]).toBeCloseTo(3.2 + 3 * Math.tan(Math.PI / 6), 4);
    for (const f of faces(roofs.toArrays())) expect(f.n[1]).toBeGreaterThan(0);
    for (const f of faces(walls.toArrays())) expect(f.n[0] * f.mid[0] + f.n[2] * f.mid[2]).toBeGreaterThan(0);
  });

  it('gable diminta tetapi bentuk L → atap datar', () => {
    const { kind } = build({ rings: [[[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]]], height: 3, gable: true });
    expect(kind).toBe('flat');
  });

  it('lubang (courtyard): dinding dalam menghadap ke lubang', () => {
    const { walls, roofs } = build({ rings: [rect(0, 0, 30, 30), rect(0, 0, 10, 10)], height: 9 });
    expect(walls.triangleCount).toBe(16);
    expect(roofs.triangleCount).toBe(8);
    const inner = faces(walls.toArrays()).filter((f) => Math.max(Math.abs(f.mid[0]), Math.abs(f.mid[2])) < 6);
    expect(inner).toHaveLength(8);
    for (const f of inner) expect(f.n[0] * f.mid[0] + f.n[2] * f.mid[2]).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/geometryBuildings.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/geometry/buildings.js'`.

- [ ] **Step 3: Implementasi**

```js
/**
 * Bangunan extrude: dinding vertikal (normal luar, dasar sedikit lebih gelap sebagai AO murah) +
 * atap datar, atau atap pelana untuk footprint ~persegi panjang kecil. Koordinat tile-lokal.
 */
import { cleanRing, orientRing } from '../../../src/geo/polygon.js';
import { addFace } from './meshBuilder.js';
import { addFlatPolygon } from './areas.js';
import { shade } from './colors.js';

const GABLE_PITCH = Math.tan((30 * Math.PI) / 180);
const RIGHT_ANGLE_TOLERANCE = 0.2; // |cos sudut sudut| maksimum (≈ 90° ± 11,5°)
const COLLINEAR_EPS = 1e-3;
const BASE_SHADE = 0.82;

/** Buang titik yang segaris dengan tetangganya. */
function dropCollinear(ring) {
  const out = ring.filter((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length];
    const b = ring[(i + 1) % ring.length];
    const crossV = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
    return Math.abs(crossV) > COLLINEAR_EPS * Math.hypot(b[0] - a[0], b[1] - a[1]);
  });
  return out.length >= 3 ? out : ring;
}

/**
 * Bila ring ~persegi panjang, kembalikan 4 sudut (ring positif) diputar agar sisi p0→p1 adalah sisi
 * panjang; selain itu null.
 * @returns {Array<[number, number]>|null}
 */
export function rectangleFrame(ring) {
  const r = orientRing(dropCollinear(cleanRing(ring)), true);
  if (r.length !== 4) return null;
  for (let i = 0; i < 4; i += 1) {
    const a = r[(i + 3) % 4];
    const p = r[i];
    const b = r[(i + 1) % 4];
    const u = [a[0] - p[0], a[1] - p[1]];
    const v = [b[0] - p[0], b[1] - p[1]];
    const cos = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v));
    if (!(Math.abs(cos) <= RIGHT_ANGLE_TOLERANCE)) return null;
  }
  const len = (i) => Math.hypot(r[(i + 1) % 4][0] - r[i][0], r[(i + 1) % 4][1] - r[i][1]);
  return len(0) >= len(1) ? r : [r[1], r[2], r[3], r[0]];
}

/** Dinding untuk satu ring (sudah berorientasi: luar positif, lubang negatif). */
function addWalls(walls, ring, height, rgb) {
  const bottom = shade(rgb, BASE_SHADE);
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    if (Math.hypot(dx, dz) < 1e-6) continue;
    addFace(
      walls,
      [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], height, b[1]], [a[0], height, a[1]]],
      [bottom, bottom, rgb, rgb],
      [dz, 0, -dx],
    );
  }
}

/** Atap pelana pada frame persegi panjang (p0→p1 sisi panjang); ujung segitiga masuk ke dinding. */
function addGable(walls, roofs, frame, eave, wallRgb, roofRgb) {
  const [p0, p1, p2, p3] = frame;
  const shortLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const ridgeY = eave + (shortLen / 2) * GABLE_PITCH;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const rA = mid(p3, p0);
  const rB = mid(p1, p2);
  const v3 = (p, y) => [p[0], y, p[1]];
  const outward = (a, b) => [b[1] - a[1], 0, -(b[0] - a[0])];
  const slopeDir = (a, b) => {
    const o = outward(a, b);
    return [o[0], Math.hypot(o[0], o[2]), o[2]];
  };
  addFace(roofs, [v3(p0, eave), v3(p1, eave), v3(rB, ridgeY), v3(rA, ridgeY)], roofRgb, slopeDir(p0, p1));
  addFace(roofs, [v3(p2, eave), v3(p3, eave), v3(rA, ridgeY), v3(rB, ridgeY)], roofRgb, slopeDir(p2, p3));
  addFace(walls, [v3(p1, eave), v3(p2, eave), v3(rB, ridgeY)], wallRgb, outward(p1, p2));
  addFace(walls, [v3(p3, eave), v3(p0, eave), v3(rA, ridgeY)], wallRgb, outward(p3, p0));
}

/**
 * Tambah satu bangunan.
 * @param {{walls: object, roofs: object}} builders
 * @param {{rings: Array<Array<[number, number]>>, height: number, wallRgb: number[], roofRgb: number[],
 *   gableRoofRgb?: number[], gable?: boolean}} b  gable=true hanya dihormati bila footprint persegi
 *   panjang tanpa lubang; gableRoofRgb (default roofRgb) dipakai untuk atap pelana
 * @returns {'gable'|'flat'}
 */
export function addBuilding({ walls, roofs }, { rings, height, wallRgb, roofRgb, gableRoofRgb = roofRgb, gable = false }) {
  const outer = orientRing(cleanRing(rings[0]), true);
  const holes = rings.slice(1).map((h) => orientRing(cleanRing(h), false)).filter((h) => h.length >= 3);
  const frame = gable && holes.length === 0 ? rectangleFrame(outer) : null;
  if (frame) {
    addWalls(walls, frame, height, wallRgb);
    addGable(walls, roofs, frame, height, wallRgb, gableRoofRgb);
    return 'gable';
  }
  addWalls(walls, outer, height, wallRgb);
  for (const h of holes) addWalls(walls, h, height, wallRgb);
  addFlatPolygon(roofs, [outer, ...holes], height, roofRgb);
  return 'flat';
}
```

- [ ] **Step 4: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/geometryBuildings.test.js`
Expected: PASS — `Tests  7 passed (7)`.

- [ ] **Step 5: Commit**

```bash
git add tools/citybake/geometry/buildings.js tests/citybake/geometryBuildings.test.js && git commit -m "feat(citybake): geometri bangunan (dinding, atap datar, atap pelana)"
```

---

### Task 13: Geometri jalan — pita dengan miter terbatas

**Files:**
- Create: `tools/citybake/geometry/roads.js`
- Test: `tests/citybake/geometryRoads.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import { createMeshBuilder } from '../../tools/citybake/geometry/meshBuilder.js';
import { addRibbon } from '../../tools/citybake/geometry/roads.js';
import { WHITE, faces, bbox } from './meshTestUtils.js';

describe('addRibbon', () => {
  it('garis lurus 2 titik → 2 segitiga selebar width, menghadap atas', () => {
    const b = createMeshBuilder();
    expect(addRibbon(b, [[0, 0], [100, 0]], 14, 0.08, WHITE)).toBe(2);
    const a = b.toArrays();
    const bb = bbox(a);
    expect(bb.min[0]).toBe(0);
    expect(bb.max[0]).toBe(100);
    expect(bb.max[2] - bb.min[2]).toBeCloseTo(14, 6);
    for (const f of faces(a)) expect(f.n[1]).toBeGreaterThan(0);
  });

  it('tikungan 90°: miter = half·√2; titik duplikat diabaikan', () => {
    const b = createMeshBuilder();
    expect(addRibbon(b, [[0, 0], [10, 0], [10, 0], [10, 10]], 2, 0, WHITE)).toBe(4);
    const p = b.toArrays().positions;
    const corner = [[p[6], p[8]], [p[9], p[11]]];
    for (const [x, z] of corner) expect(Math.hypot(x - 10, z)).toBeCloseTo(Math.SQRT2, 6);
  });

  it('tikungan sangat tajam: miter dibatasi 2 × setengah lebar', () => {
    const b = createMeshBuilder();
    addRibbon(b, [[0, 0], [10, 0], [0, 0.5]], 2, 0, WHITE);
    const p = b.toArrays().positions;
    expect(Math.hypot(p[6] - 10, p[8])).toBeLessThanOrEqual(2 + 1e-5);
    for (const f of faces(b.toArrays())) expect(f.n[1]).toBeGreaterThanOrEqual(0);
  });

  it('kurang dari 2 titik unik → 0 segitiga', () => {
    expect(addRibbon(createMeshBuilder(), [[1, 1], [1, 1]], 4, 0, WHITE)).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/geometryRoads.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/geometry/roads.js'`.

- [ ] **Step 3: Implementasi**

```js
/**
 * Pita (ribbon) datar dari polyline: jalan dan sungai garis. Sambungan miter dengan batas panjang
 * (MITER_LIMIT × setengah lebar) agar tikungan tajam tidak meruncing jauh. Koordinat tile-lokal.
 */
import { addUpTriangle } from './meshBuilder.js';

export const MITER_LIMIT = 2;

/** Buang titik berurutan yang berimpit. */
function dedupe(line) {
  return line.filter((p, i) => i === 0 || Math.hypot(p[0] - line[i - 1][0], p[1] - line[i - 1][1]) > 1e-6);
}

/** Normal kiri satuan dari segmen a→b. */
function leftNormal(a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l = Math.hypot(dx, dz);
  return [-dz / l, dx / l];
}

/** Offset (arah × panjang) di titik i. */
function offsetAt(line, i, half) {
  const n1 = i > 0 ? leftNormal(line[i - 1], line[i]) : null;
  const n2 = i < line.length - 1 ? leftNormal(line[i], line[i + 1]) : null;
  if (!n1 || !n2) {
    const n = n1 ?? n2;
    return [n[0] * half, n[1] * half];
  }
  const sx = n1[0] + n2[0];
  const sz = n1[1] + n2[1];
  const sl = Math.hypot(sx, sz);
  if (sl < 1e-6) return [n1[0] * half, n1[1] * half]; // balik arah 180°
  const m = [sx / sl, sz / sl];
  const cos = m[0] * n1[0] + m[1] * n1[1];
  const len = Math.min(half / Math.max(cos, 1e-6), half * MITER_LIMIT);
  return [m[0] * len, m[1] * len];
}

/**
 * Tambah pita selebar `width` pada ketinggian y.
 * @returns {number} jumlah segitiga yang ditambahkan
 */
export function addRibbon(builder, line, width, y, rgb) {
  const pts = dedupe(line);
  if (pts.length < 2) return 0;
  const half = width / 2;
  const base = builder.vertexCount;
  const xz = [];
  for (let i = 0; i < pts.length; i += 1) {
    const [ox, oz] = offsetAt(pts, i, half);
    const l = [pts[i][0] + ox, pts[i][1] + oz];
    const r = [pts[i][0] - ox, pts[i][1] - oz];
    builder.addVertex(l[0], y, l[1], 0, 1, 0, rgb);
    builder.addVertex(r[0], y, r[1], 0, 1, 0, rgb);
    xz.push(l, r);
  }
  const at = (idx) => xz[idx - base];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const l0 = base + 2 * i;
    const r0 = l0 + 1;
    const l1 = l0 + 2;
    const r1 = l0 + 3;
    addUpTriangle(builder, l0, r0, r1, at);
    addUpTriangle(builder, l0, r1, l1, at);
  }
  return 2 * (pts.length - 1);
}
```

- [ ] **Step 4: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/geometryRoads.test.js`
Expected: PASS — `Tests  4 passed (4)`.

- [ ] **Step 5: Commit**

```bash
git add tools/citybake/geometry/roads.js tests/citybake/geometryRoads.test.js && git commit -m "feat(citybake): pita jalan/sungai dengan sambungan miter terbatas"
```

---

### Task 14: Mask region & partisi tile

**Files:**
- Create: `tools/citybake/mask.js`
- Create: `tools/citybake/partition.js`
- Test: `tests/citybake/maskPartition.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import { applyMasks, splitLineOutside } from '../../tools/citybake/mask.js';
import { partitionFeatures } from '../../tools/citybake/partition.js';
import { polygonArea } from '../../src/geo/polygon.js';

const sq = (cx, cz, s) => [[cx - s / 2, cz - s / 2], [cx + s / 2, cz - s / 2], [cx + s / 2, cz + s / 2], [cx - s / 2, cz + s / 2]];
const building = (id, cx, cz, s = 10) => ({ id, source: 'osm', kind: 'building', cls: 'yes', tags: {}, rings: [sq(cx, cz, s)] });
const road = (id, line) => ({ id, source: 'osm', kind: 'road', cls: 'primary', tags: {}, line });
const area = (id, kind, ring) => ({ id, source: 'osm', kind, cls: kind === 'water' ? 'water' : 'grass', tags: {}, rings: [ring] });

describe('applyMasks', () => {
  const mask = [sq(0, 0, 100)];

  it('bangunan/area dibuang bila centroid di dalam mask', () => {
    const out = applyMasks([building('in', 10, 10), building('out', 200, 0), area('w', 'water', sq(0, 0, 20))], mask);
    expect(out.map((f) => f.id)).toEqual(['out']);
  });

  it('jalan menembus mask dipecah dua; jalan di luar utuh (objek sama)', () => {
    const through = road('r', [[-200, 0], [-100, 0], [-25, 0], [25, 0], [100, 0], [200, 0]]);
    const outside = road('o', [[-200, 300], [200, 300]]);
    const out = applyMasks([through, outside], mask);
    expect(out.map((f) => f.id)).toEqual(['r~0', 'r~1', 'o']);
    expect(out[0].line).toEqual([[-200, 0], [-100, 0], [-25, 0]]);
    expect(out[1].line).toEqual([[25, 0], [100, 0], [200, 0]]);
    expect(out[2]).toBe(outside);
  });

  it('tanpa mask → salinan daftar', () => {
    const f = [building('a', 0, 0)];
    expect(applyMasks(f, [])).toEqual(f);
  });

  it('splitLineOutside: seluruhnya di dalam → []', () => {
    expect(splitLineOutside([[0, 0], [10, 0]], mask)).toEqual([]);
  });
});

describe('partitionFeatures', () => {
  const tiles = [{ ix: -1, iz: 0 }, { ix: 0, iz: 0 }];

  it('bangunan ke tile centroid (tidak dipotong); di luar daftar tile diabaikan', () => {
    const b = partitionFeatures([building('a', 498, 100, 10), building('far', 5000, 100)], tiles);
    expect(b.get('0_0').buildings.map((f) => f.id)).toEqual(['a']);
    expect(b.get('0_0').buildings[0].rings[0]).toEqual(sq(498, 100, 10));
    expect(b.get('-1_0').buildings).toEqual([]);
  });

  it('jalan melintas batas tile dipotong di x = 0', () => {
    const b = partitionFeatures([road('r', [[-100, 50], [100, 50]])], tiles);
    expect(b.get('-1_0').roads[0].line).toEqual([[-100, 50], [0, 50]]);
    expect(b.get('0_0').roads[0].line).toEqual([[0, 50], [100, 50]]);
  });

  it('landuse dipotong per tile, luas terbagi', () => {
    const b = partitionFeatures([area('g', 'landuse', [[-100, 0], [100, 0], [100, 50], [-100, 50]])], tiles);
    expect(polygonArea(b.get('-1_0').landuse[0].rings[0])).toBeCloseTo(5000, 6);
    expect(polygonArea(b.get('0_0').landuse[0].rings[0])).toBeCloseTo(5000, 6);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/maskPartition.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/mask.js'`.

- [ ] **Step 3: Implementasi `mask.js`**

```js
/**
 * Buang fitur kota di dalam mask region handmade. Mask berupa ring dalam koordinat DUNIA.
 * Fase 1: placement stadion {x: 0, z: 0, yaw: 0}, jadi ring region-lokal = ring dunia. Saat placement
 * tidak nol (Fase 3), ubah ring dengan regionTransform milik Plan A (dibuat di Plan A Task 6) sebelum
 * memanggil applyMasks.
 *
 * Poligon (bangunan/air/landuse) dibuang bila centroid ring luarnya di dalam mask; polyline dipotong:
 * segmen yang titik tengahnya di dalam mask dibuang, sisa yang bersambung menjadi fitur baru (`<id>~k`).
 */
import { pointInPolygon, polygonCentroid } from '../../src/geo/polygon.js';

const insideAny = (x, z, rings) => rings.some((r) => pointInPolygon(x, z, r));

/** Pecah polyline menjadi bagian di luar semua mask. */
export function splitLineOutside(line, rings) {
  const parts = [];
  let cur = null;
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    if (insideAny((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, rings)) {
      cur = null;
      continue;
    }
    if (!cur) {
      cur = [a];
      parts.push(cur);
    }
    cur.push(b);
  }
  return parts;
}

/**
 * @param {import('./features.js').Feature[]} features koordinat dunia
 * @param {Array<Array<[number, number]>>} rings ring mask dunia
 * @returns {import('./features.js').Feature[]} fitur baru (input tidak dimutasi)
 */
export function applyMasks(features, rings) {
  if (rings.length === 0) return features.slice();
  const out = [];
  for (const f of features) {
    if (f.rings) {
      const c = polygonCentroid(f.rings[0]);
      if (!insideAny(c.x, c.z, rings)) out.push(f);
      continue;
    }
    const parts = splitLineOutside(f.line, rings);
    if (parts.length === 1 && parts[0].length === f.line.length) out.push(f);
    else parts.forEach((line, k) => out.push({ ...f, id: `${f.id}~${k}`, line }));
  }
  return out;
}
```

- [ ] **Step 4: Implementasi `partition.js`**

```js
/**
 * Bagi fitur dunia ke tile. Bangunan TIDAK dipotong: seluruh bangunan masuk tile yang memuat
 * centroid-nya (dinding palsu di tepi tile dihindari; bangunan boleh sedikit menjorok ke tetangga).
 * Air/landuse dipotong ke batas tile (Sutherland–Hodgman); jalan/sungai garis dipotong (Liang–Barsky).
 */
import {
  boundsOverlap, clipPolygonToRect, clipPolylineToRect, polygonCentroid, ringBounds,
} from '../../src/geo/polygon.js';
import { tileBounds, tileOf, tileKey, TILE_SIZE } from '../../src/geo/tiles.js';

/** @typedef {{ix: number, iz: number, key: string, buildings: object[], roads: object[], water: object[],
 *   waterways: object[], landuse: object[]}} TileBucket */

const LAYER_OF = { building: 'buildings', road: 'roads', water: 'water', waterway: 'waterways', landuse: 'landuse' };

function clipPolygonFeature(f, rect) {
  const outer = clipPolygonToRect(f.rings[0], rect);
  if (outer.length === 0) return null;
  const holes = f.rings.slice(1).map((h) => clipPolygonToRect(h, rect)).filter((h) => h.length >= 3);
  return { ...f, rings: [outer, ...holes] };
}

/**
 * @param {import('./features.js').Feature[]} features koordinat dunia, sudah di-merge & di-mask
 * @param {Array<{ix: number, iz: number}>} tiles tile yang di-bake
 * @returns {Map<string, TileBucket>}
 */
export function partitionFeatures(features, tiles, size = TILE_SIZE) {
  const buckets = new Map();
  for (const t of tiles) {
    const key = tileKey(t.ix, t.iz);
    buckets.set(key, { ix: t.ix, iz: t.iz, key, buildings: [], roads: [], water: [], waterways: [], landuse: [] });
  }
  const rects = [...buckets.values()].map((b) => ({ b, rect: tileBounds(b.ix, b.iz, size) }));
  for (const f of features) {
    const layer = LAYER_OF[f.kind];
    if (!layer) continue;
    if (f.kind === 'building') {
      const c = polygonCentroid(f.rings[0]);
      const t = tileOf(c.x, c.z, size);
      buckets.get(tileKey(t.ix, t.iz))?.buildings.push(f);
      continue;
    }
    const fb = ringBounds(f.rings ? f.rings[0] : f.line);
    for (const { b, rect } of rects) {
      if (!boundsOverlap(fb, rect)) continue;
      if (f.rings) {
        const clipped = clipPolygonFeature(f, rect);
        if (clipped) b[layer].push(clipped);
      } else {
        for (const line of clipPolylineToRect(f.line, rect)) b[layer].push({ ...f, line });
      }
    }
  }
  return buckets;
}
```

- [ ] **Step 5: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/maskPartition.test.js`
Expected: PASS — `Tests  7 passed (7)`.

- [ ] **Step 6: Commit**

```bash
git add tools/citybake/mask.js tools/citybake/partition.js tests/citybake/maskPartition.test.js && git commit -m "feat(citybake): mask region dan partisi fitur per tile"
```

---

### Task 15: `glb.js` — GLB terkompresi meshopt

**Files:**
- Create: `tools/citybake/glb.js`
- Test: `tests/citybake/glb.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { MESH_NAMES, writeTileGlb, readGlbSummary } from '../../tools/citybake/glb.js';
import { createMeshBuilder } from '../../tools/citybake/geometry/meshBuilder.js';
import { addFlatPolygon } from '../../tools/citybake/geometry/areas.js';
import { addBuilding } from '../../tools/citybake/geometry/buildings.js';
import { WHITE, rect } from './meshTestUtils.js';

function sampleMeshes() {
  const walls = createMeshBuilder();
  const roofs = createMeshBuilder();
  const water = createMeshBuilder();
  addBuilding({ walls, roofs }, { rings: [rect(100, -100, 20, 10)], height: 9.6, wallRgb: WHITE, roofRgb: [0.3, 0.3, 0.3] });
  addFlatPolygon(water, [rect(-150, 150, 80, 60)], 0.04, [0.05, 0.15, 0.25]);
  return { buildings_walls: walls.toArrays(), buildings_roofs: roofs.toArrays(), water: water.toArrays(), roads: null, landuse: null };
}

describe('writeTileGlb / readGlbSummary', () => {
  it('nama node/mesh/material, urutan MESH_NAMES, node kosong dilewati', async () => {
    const s = await readGlbSummary(await writeTileGlb(sampleMeshes(), 'tile_0_-1_lod0'));
    expect(s.scene).toBe('tile_0_-1_lod0');
    expect(s.nodes.map((n) => n.name)).toEqual(['water', 'buildings_walls', 'buildings_roofs']);
    for (const n of s.nodes) {
      expect(n.mesh).toBe(n.name);
      expect(n.material).toBe(n.name);
      expect(n.attributes).toEqual(['COLOR_0', 'NORMAL', 'POSITION']);
    }
    expect(s.nodes.map((n) => n.triangles)).toEqual([2, 8, 2]);
    expect(MESH_NAMES).toEqual(['landuse', 'water', 'roads', 'buildings_walls', 'buildings_roofs']);
  });

  it('memakai EXT_meshopt_compression + KHR_mesh_quantization (wajib)', async () => {
    const s = await readGlbSummary(await writeTileGlb(sampleMeshes(), 't'));
    expect(s.extensionsRequired).toEqual(['EXT_meshopt_compression', 'KHR_mesh_quantization']);
  });

  it('deterministik: byte identik untuk input identik', async () => {
    const h = async () => createHash('sha1').update(await writeTileGlb(sampleMeshes(), 't')).digest('hex');
    expect(await h()).toBe(await h());
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/glb.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/glb.js'`.

- [ ] **Step 3: Implementasi**

```js
/**
 * Tulis/baca GLB tile dengan glTF-Transform + EXT_meshopt_compression (meshoptimizer).
 * Kontrak node/mesh/material: lihat "Format tile v1" di rencana Plan B. Keluaran deterministik
 * (byte identik untuk input identik pada versi dependensi yang sama).
 */
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

/** Urutan node = urutan gambar bawah → atas. Node kosong tidak ditulis. */
export const MESH_NAMES = Object.freeze(['landuse', 'water', 'roads', 'buildings_walls', 'buildings_roofs']);

/** Bit kuantisasi posisi (14 bit atas rentang ±300 m ≈ 4 cm). */
const QUANTIZE_POSITION_BITS = 14;

let ioPromise = null;

/** NodeIO dengan encoder/decoder meshopt siap (dibuat sekali). */
async function getIO() {
  ioPromise ??= Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]).then(() =>
    new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder }));
  return ioPromise;
}

function addMesh(doc, buffer, scene, name, arrays) {
  const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const material = doc.createMaterial(name).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(0);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', arrays.positions))
    .setAttribute('NORMAL', accessor('VEC3', arrays.normals))
    .setAttribute('COLOR_0', accessor('VEC3', arrays.colors))
    .setIndices(accessor('SCALAR', arrays.indices))
    .setMaterial(material);
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
}

/**
 * @param {Record<string, {positions: Float32Array, normals: Float32Array, colors: Float32Array,
 *   indices: Uint32Array}|null>} meshes per nama di MESH_NAMES
 * @param {string} sceneName mis. "tile_0_-1_lod0"
 * @returns {Promise<Uint8Array>}
 */
export async function writeTileGlb(meshes, sceneName) {
  const io = await getIO();
  const doc = new Document();
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const buffer = doc.createBuffer();
  const scene = doc.createScene(sceneName);
  doc.getRoot().setDefaultScene(scene);
  for (const name of MESH_NAMES) {
    if (meshes[name]) addMesh(doc, buffer, scene, name, meshes[name]);
  }
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: QUANTIZE_POSITION_BITS }));
  return io.writeBinary(doc);
}

/**
 * Ringkasan GLB (dipakai tes & verifikasi): nama scene, node berurutan, segitiga, atribut, ekstensi.
 * @returns {Promise<{scene: string, nodes: Array<{name: string, mesh: string, material: string,
 *   triangles: number, attributes: string[]}>, extensionsUsed: string[], extensionsRequired: string[]}>}
 */
export async function readGlbSummary(bytes) {
  const io = await getIO();
  const doc = await io.readBinary(bytes);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const nodes = scene.listChildren().map((node) => {
    const prim = node.getMesh().listPrimitives()[0];
    return {
      name: node.getName(),
      mesh: node.getMesh().getName(),
      material: prim.getMaterial()?.getName() ?? '',
      triangles: prim.getIndices().getCount() / 3,
      attributes: prim.listSemantics().slice().sort(),
    };
  });
  return {
    scene: scene.getName(),
    nodes,
    extensionsUsed: root.listExtensionsUsed().map((e) => e.extensionName).sort(),
    extensionsRequired: root.listExtensionsRequired().map((e) => e.extensionName).sort(),
  };
}
```

- [ ] **Step 4: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/glb.test.js`
Expected: PASS — `Tests  3 passed (3)`.

- [ ] **Step 5: Commit**

```bash
git add tools/citybake/glb.js tests/citybake/glb.test.js && git commit -m "feat(citybake): tulis GLB tile dengan EXT_meshopt_compression"
```

---

### Task 16: `bakeTile.js` — LOD0, LOD1, data.json

**Files:**
- Create: `tools/citybake/bakeTile.js`
- Test: `tests/citybake/bakeTile.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import { bakeTile } from '../../tools/citybake/bakeTile.js';
import { rect } from './meshTestUtils.js';

const feature = (id, kind, cls, geom, extra = {}) => ({ id, source: 'osm', kind, cls, tags: {}, ...geom, ...extra });

/** Tile 0_0 (x, z ∈ [0, 500), pusat (250, 250)) dalam koordinat dunia. */
const TILE = {
  ix: 0,
  iz: 0,
  key: '0_0',
  buildings: [
    feature('b1', 'building', 'yes', { rings: [rect(100, 100, 20, 10)] }, { height: 9.6 }), // 200 m² → datar
    feature('b2', 'building', 'house', { rings: [rect(150, 60, 8, 6)] }, { height: 3.2 }), // 48 m² → pelana
    feature('b3', 'building', 'shed', { rings: [rect(300, 300, 5, 5)] }, { height: 3 }), // 25 m² → hilang di LOD1
  ],
  roads: [
    feature('r1', 'road', 'primary', { line: [[0, 20], [240, 20]] }, { tags: { name: 'Jalan Uji Raya' } }),
    feature('r2', 'road', 'footway', { line: [[60, 0], [60, 100]] }, { tags: { name: 'Gang Uji' } }),
  ],
  water: [feature('w1', 'water', 'water', { rings: [rect(400, 400, 50, 50)] })],
  waterways: [feature('s1', 'waterway', 'stream', { line: [[400, 100], [450, 100]] })],
  landuse: [feature('l1', 'landuse', 'grass', { rings: [rect(250, 480, 500, 40)] })],
};

describe('bakeTile', () => {
  const out = bakeTile(TILE);
  const tri = (lod, name) => (out.lods[lod].meshes[name] ? out.lods[lod].meshes[name].indices.length / 3 : 0);

  it('LOD0: jumlah segitiga per mesh', () => {
    expect(tri(0, 'buildings_walls')).toBe(8 + 10 + 10);
    expect(tri(0, 'buildings_roofs')).toBe(2 + 4 + 4);
    expect(tri(0, 'roads')).toBe(4);
    expect(tri(0, 'water')).toBe(4);
    expect(tri(0, 'landuse')).toBe(2);
    expect(out.lods[0].triangles).toBe(48);
    expect(out.empty).toBe(false);
  });

  it('LOD1: kotak tanpa pelana, bangunan < 40 m² & jalan minor dibuang', () => {
    expect(tri(1, 'buildings_walls')).toBe(16);
    expect(tri(1, 'buildings_roofs')).toBe(4);
    expect(tri(1, 'roads')).toBe(2);
    expect(out.lods[1].triangles).toBe(28);
  });

  it('koordinat tile-lokal: semua posisi dalam ±260 m dari pusat tile', () => {
    for (const lod of out.lods) for (const m of Object.values(lod.meshes)) {
      if (!m) continue;
      for (let i = 0; i < m.positions.length; i += 3) {
        expect(Math.abs(m.positions[i])).toBeLessThanOrEqual(260);
        expect(Math.abs(m.positions[i + 2])).toBeLessThanOrEqual(260);
      }
    }
  });

  it('data.json v1: satuan 0,1 m tile-lokal, nama hanya untuk jalan berlabel', () => {
    const d = out.data;
    expect(d).toMatchObject({ v: 1, key: '0_0', ix: 0, iz: 0, center: [250, 250], unit: 0.1 });
    expect(d.buildings).toHaveLength(3);
    expect(d.buildings[0]).toEqual({ h: 96, ring: [-1600, -1550, -1400, -1550, -1400, -1450, -1600, -1450] });
    expect(d.roads).toEqual([
      { cls: 'primary', w: 140, pts: [-2500, -2300, -100, -2300], name: 'Jalan Uji Raya' },
      { cls: 'footway', w: 20, pts: [-1900, -2500, -1900, -1500] },
    ]);
    expect(d.water).toEqual([{ rings: [[1250, 1250, 1750, 1250, 1750, 1750, 1250, 1750]] }]);
    expect(d.waterways).toEqual([{ cls: 'stream', w: 40, pts: [1500, -1500, 2000, -1500] }]);
    for (const b of d.buildings) for (const v of b.ring) expect(Number.isInteger(v)).toBe(true);
    // ring bangunan selalu positif (signedArea > 0) walau sumber berorientasi terbalik
    const flipped = bakeTile({ ...TILE, buildings: [{ ...TILE.buildings[0], rings: [[...TILE.buildings[0].rings[0]].reverse()] }] });
    expect(flipped.data.buildings[0].ring).toEqual(d.buildings[0].ring);
  });

  it('landuse tumpang tindih: kelas prioritas rendah digambar dulu & lebih rendah', () => {
    const t = bakeTile({
      ix: 0, iz: 0, key: '0_0', buildings: [], roads: [], water: [], waterways: [],
      landuse: [
        feature('a-park', 'landuse', 'park', { rings: [rect(250, 250, 50, 50)] }),
        feature('z-res', 'landuse', 'residential', { rings: [rect(250, 250, 400, 400)] }),
      ],
    });
    const m = t.lods[0].meshes.landuse;
    const yOfTri = (k) => m.positions[3 * m.indices[3 * k] + 1];
    expect(yOfTri(0)).toBeCloseTo(0.02, 5); // residential (indeks prioritas 0) dulu
    expect(yOfTri(3)).toBeCloseTo(0.02 + 13 * 0.002, 5); // park (indeks 13) terakhir & di atas
  });

  it('tile tanpa fitur → empty', () => {
    const e = bakeTile({ ix: 5, iz: 5, key: '5_5', buildings: [], roads: [], water: [], waterways: [], landuse: [] });
    expect(e.empty).toBe(true);
    expect(e.lods[0].meshes.roads).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/bakeTile.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/bakeTile.js'`.

- [ ] **Step 3: Implementasi**

```js
/**
 * Satu tile (fitur dunia hasil partitionFeatures) → mesh LOD0 & LOD1 per material + data.json.
 * Semua koordinat di-re-center ke pusat tile (tile-lokal). Murni; penulisan GLB di glb.js.
 */
import { orientRing, polygonArea } from '../../src/geo/polygon.js';
import { tileCenter, TILE_SIZE } from '../../src/geo/tiles.js';
import { createMeshBuilder } from './geometry/meshBuilder.js';
import { addBuilding } from './geometry/buildings.js';
import { addRibbon } from './geometry/roads.js';
import { addFlatPolygon } from './geometry/areas.js';
import { hexToLinear } from './geometry/colors.js';
import { pickBySeed } from './random.js';
import {
  BUILDING_COLORS, FORMAT_VERSION, GABLE_MAX_AREA, LANDUSE_COLORS, LANDUSE_ORDER, LAYER_Y, LOD1_MIN_BUILDING_AREA,
  ROAD_CLASSES, WATER_COLOR, WATERWAY_WIDTHS,
} from './config.js';

const dm = (v) => Math.round(v * 10);
const PALETTE = {
  walls: BUILDING_COLORS.walls.map(hexToLinear),
  roofFlat: BUILDING_COLORS.roofFlat.map(hexToLinear),
  roofGable: BUILDING_COLORS.roofGable.map(hexToLinear),
};
const WATER_RGB = hexToLinear(WATER_COLOR);
const LANDUSE_RGB = Object.fromEntries(Object.entries(LANDUSE_COLORS).map(([k, v]) => [k, hexToLinear(v)]));
const ROAD_RGB = Object.fromEntries(Object.entries(ROAD_CLASSES).map(([k, v]) => [k, hexToLinear(v.color)]));

/** Geser fitur ke koordinat tile-lokal (objek baru). */
function toLocal(f, cx, cz) {
  const mv = (pts) => pts.map(([x, z]) => [x - cx, z - cz]);
  return { ...f, ...(f.rings ? { rings: f.rings.map(mv) } : {}), ...(f.line ? { line: mv(f.line) } : {}) };
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Landuse menurut prioritas kelas (LANDUSE_ORDER), lalu id. */
const landuseOrder = (a, b) => LANDUSE_ORDER.indexOf(a.cls) - LANDUSE_ORDER.indexOf(b.cls) || byId(a, b);
const landuseY = (cls) => LAYER_Y.landuse + LANDUSE_ORDER.indexOf(cls) * LAYER_Y.landuseStep;

/** Jalan kecil dulu (y lebih rendah), lalu besar, agar urutan stabil. */
const roadOrder = (a, b) => Number(ROAD_CLASSES[a.cls].minor === false) - Number(ROAD_CLASSES[b.cls].minor === false) || byId(a, b);

function addBuildings(builders, buildings, lod) {
  for (const b of buildings) {
    const area = polygonArea(b.rings[0]);
    if (lod === 1 && area < LOD1_MIN_BUILDING_AREA) continue;
    addBuilding(builders, {
      rings: lod === 1 ? [b.rings[0]] : b.rings,
      height: b.height,
      gable: lod === 0 && area < GABLE_MAX_AREA,
      wallRgb: pickBySeed(PALETTE.walls, b.id, 'wall'),
      roofRgb: pickBySeed(PALETTE.roofFlat, b.id, 'roof'),
      gableRoofRgb: pickBySeed(PALETTE.roofGable, b.id, 'roof'),
    });
  }
}

function addRoads(builder, roads, lod) {
  for (const r of [...roads].sort(roadOrder)) {
    const cls = ROAD_CLASSES[r.cls];
    if (lod === 1 && cls.minor) continue;
    addRibbon(builder, r.line, cls.width, cls.minor ? LAYER_Y.roadMinor : LAYER_Y.roadMajor, ROAD_RGB[r.cls]);
  }
}

/** Bangun lima mesh untuk satu LOD. */
function buildLod(local, lod) {
  const b = Object.fromEntries(['landuse', 'water', 'roads', 'walls', 'roofs'].map((k) => [k, createMeshBuilder()]));
  for (const f of [...local.landuse].sort(landuseOrder)) addFlatPolygon(b.landuse, f.rings, landuseY(f.cls), LANDUSE_RGB[f.cls]);
  for (const f of local.water) addFlatPolygon(b.water, f.rings, LAYER_Y.water, WATER_RGB);
  for (const f of local.waterways) addRibbon(b.water, f.line, WATERWAY_WIDTHS[f.cls], LAYER_Y.water, WATER_RGB);
  addRoads(b.roads, local.roads, lod);
  addBuildings({ walls: b.walls, roofs: b.roofs }, local.buildings, lod);
  const meshes = {
    landuse: b.landuse.toArrays(), water: b.water.toArrays(), roads: b.roads.toArrays(),
    buildings_walls: b.walls.toArrays(), buildings_roofs: b.roofs.toArrays(),
  };
  const triangles = Object.values(b).reduce((s, v) => s + v.triangleCount, 0);
  return { meshes, triangles };
}

const flat = (pts) => pts.flatMap(([x, z]) => [dm(x), dm(z)]);

/** data.json v1 (lihat "Format tile v1"). */
function buildData(tile, local, center) {
  return {
    v: FORMAT_VERSION,
    key: tile.key,
    ix: tile.ix,
    iz: tile.iz,
    center: [center.x, center.z],
    unit: 0.1,
    buildings: local.buildings.map((b) => ({ h: dm(b.height), ring: flat(orientRing(b.rings[0], true)) })),
    water: local.water.map((w) => ({ rings: w.rings.map(flat) })),
    waterways: local.waterways.map((w) => ({ cls: w.cls, w: dm(WATERWAY_WIDTHS[w.cls]), pts: flat(w.line) })),
    roads: local.roads.map((r) => {
      const cls = ROAD_CLASSES[r.cls];
      const entry = { cls: r.cls, w: dm(cls.width), pts: flat(r.line) };
      return cls.label && r.tags?.name ? { ...entry, name: r.tags.name } : entry;
    }),
  };
}

/**
 * @param {import('./partition.js').TileBucket} tile bangunan sudah memiliki `height` (m)
 * @returns {{key: string, ix: number, iz: number, empty: boolean,
 *   lods: Array<{meshes: object, triangles: number}>, data: object}}
 */
export function bakeTile(tile, size = TILE_SIZE) {
  const center = tileCenter(tile.ix, tile.iz, size);
  const sorted = (list) => [...list].sort(byId).map((f) => toLocal(f, center.x, center.z));
  const local = {
    buildings: sorted(tile.buildings), roads: sorted(tile.roads), water: sorted(tile.water),
    waterways: sorted(tile.waterways), landuse: sorted(tile.landuse),
  };
  const lods = [buildLod(local, 0), buildLod(local, 1)];
  return { key: tile.key, ix: tile.ix, iz: tile.iz, empty: lods[0].triangles === 0, lods, data: buildData(tile, local, center) };
}
```

- [ ] **Step 4: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/bakeTile.test.js`
Expected: PASS — `Tests  6 passed (6)`.

- [ ] **Step 5: Commit**

```bash
git add tools/citybake/bakeTile.js tests/citybake/bakeTile.test.js && git commit -m "feat(citybake): bake satu tile (LOD0, LOD1, data.json)"
```

---

### Task 17: Manifest, atribusi, laporan

**Files:**
- Create: `tools/citybake/manifest.js`
- Create: `tools/citybake/report.js`
- Test: `tests/citybake/manifest.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import {
  createManifest, assertCompatible, tileEntry, tileFiles, upsertArea, validateManifest, attributionText,
} from '../../tools/citybake/manifest.js';
import { summarize } from '../../tools/citybake/report.js';

const ORIGIN = { lat: 0.4835954, lon: 101.3895277 };
const entry = (key, ix, iz, area, lod0 = 1000) =>
  tileEntry({ key, ix, iz, area, bytes: { lod0, lod1: 400, data: 100 }, triangles: [50, 20] });
const area = (id, tiles) => ({ id, name: `Area ${id}`, bounds: { minX: 0, minZ: 0, maxX: 1, maxZ: 1 }, osmTimestamp: '2026-10-16T00:00:00Z', overtureRelease: null, tiles });

describe('manifest', () => {
  it('createManifest & tileFiles', () => {
    const m = createManifest({ origin: ORIGIN, tileSize: 500 });
    expect(m).toMatchObject({ version: 1, tileSize: 500, unit: 0.1, origin: ORIGIN, areas: [], tiles: [] });
    expect(tileFiles('-1_2')).toEqual({ lod0: '-1_2.lod0.glb', lod1: '-1_2.lod1.glb', data: '-1_2.data.json' });
  });

  it('tileEntry: bytes = jumlah file, lod berurutan', () => {
    expect(entry('0_0', 0, 0, 'a')).toEqual({
      key: '0_0', ix: 0, iz: 0, area: 'a', bytes: 1500,
      lod: [
        { level: 0, file: '0_0.lod0.glb', bytes: 1000, triangles: 50 },
        { level: 1, file: '0_0.lod1.glb', bytes: 400, triangles: 20 },
      ],
      data: { file: '0_0.data.json', bytes: 100 },
    });
  });

  it('upsertArea mengganti tile area yang sama, mempertahankan area lain, urut iz lalu ix', () => {
    let m = createManifest({ origin: ORIGIN, tileSize: 500 });
    m = upsertArea(m, area('a', [entry('1_0', 1, 0, 'a'), entry('0_0', 0, 0, 'a')]));
    m = upsertArea(m, area('b', [entry('9_-9', 9, -9, 'b')]));
    m = upsertArea(m, area('a', [entry('0_0', 0, 0, 'a')]));
    expect(m.tiles.map((t) => t.key)).toEqual(['9_-9', '0_0']);
    expect(m.areas.map((a) => [a.id, a.tiles])).toEqual([['a', ['0_0']], ['b', ['9_-9']]]);
    expect(validateManifest(m)).toEqual([]);
  });

  it('validateManifest menangkap kesalahan', () => {
    const m = createManifest({ origin: ORIGIN, tileSize: 500 });
    const bad = { ...m, tiles: [{ ...entry('0_0', 0, 1, 'a'), bytes: 1 }] };
    expect(validateManifest(bad)).toEqual(['key 0_0 tidak cocok dengan ix/iz', '0_0: bytes 1 ≠ jumlah file 1500']);
  });

  it('assertCompatible menolak origin berbeda', () => {
    const a = createManifest({ origin: ORIGIN, tileSize: 500 });
    expect(() => assertCompatible(a, a)).not.toThrow();
    expect(() => assertCompatible(a, createManifest({ origin: { lat: 0, lon: 0 }, tileSize: 500 }))).toThrow(/hapus public\/tiles/);
  });

  it('attributionText menyebut OSM, Overture, ODbL, dan area', () => {
    const m = upsertArea(createManifest({ origin: ORIGIN, tileSize: 500 }), area('a', [entry('0_0', 0, 0, 'a')]));
    const t = attributionText(m);
    for (const s of ['© OpenStreetMap contributors', 'Overture Maps Foundation', 'ODbL', 'Area a (a)', 'tanpa Overture']) expect(t).toContain(s);
  });
});

describe('summarize', () => {
  it('baris per tile + peringatan anggaran', () => {
    let m = createManifest({ origin: ORIGIN, tileSize: 500 });
    m = upsertArea(m, area('a', [entry('0_0', 0, 0, 'a', 400 * 1024), entry('1_0', 1, 0, 'a')]));
    const r = summarize(m, ['a'], { tileBytes: 300 * 1024, totalBytes: 100 * 1024 });
    expect(r.lines[0]).toMatch(/^Area a: 2 tile/);
    expect(r.lines).toHaveLength(4);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toMatch(/^tile 0_0: LOD0\+data/);
    expect(r.warnings[1]).toMatch(/^total/);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/manifest.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/manifest.js'`.

- [ ] **Step 3: Implementasi `manifest.js`**

```js
/**
 * manifest.json & ATTRIBUTION.txt (kontrak "Format tile v1"). Fungsi murni; I/O ada di pipeline.js.
 */
import { FORMAT_VERSION } from './config.js';

export const MANIFEST_FILE = 'manifest.json';
export const ATTRIBUTION_FILE = 'ATTRIBUTION.txt';

/** Nama file tile. */
export const tileFiles = (key) => ({ lod0: `${key}.lod0.glb`, lod1: `${key}.lod1.glb`, data: `${key}.data.json` });

/** Manifest kosong. */
export function createManifest({ origin, tileSize }) {
  return {
    version: FORMAT_VERSION,
    format: 'citybake-tiles',
    origin: { lat: origin.lat, lon: origin.lon },
    frame: 'ENU lokal; +X timur, -Z utara, +Y atas; meter',
    tileSize,
    unit: 0.1,
    areas: [],
    tiles: [],
  };
}

/** Pastikan manifest lama sejenis sebelum digabung. @throws {Error} */
export function assertCompatible(existing, fresh) {
  const same = existing.version === fresh.version && existing.tileSize === fresh.tileSize
    && existing.origin?.lat === fresh.origin.lat && existing.origin?.lon === fresh.origin.lon;
  if (!same) {
    throw new Error('manifest.json lama berbeda versi/origin/tileSize — hapus public/tiles/ lalu bake ulang semua area');
  }
}

const tileOrder = (a, b) => a.iz - b.iz || a.ix - b.ix;

/**
 * Entri tile manifest.
 * @param {{key: string, ix: number, iz: number, area: string, bytes: {lod0: number, lod1: number, data: number},
 *   triangles: [number, number]}} t
 */
export function tileEntry(t) {
  const f = tileFiles(t.key);
  return {
    key: t.key,
    ix: t.ix,
    iz: t.iz,
    area: t.area,
    bytes: t.bytes.lod0 + t.bytes.lod1 + t.bytes.data,
    lod: [
      { level: 0, file: f.lod0, bytes: t.bytes.lod0, triangles: t.triangles[0] },
      { level: 1, file: f.lod1, bytes: t.bytes.lod1, triangles: t.triangles[1] },
    ],
    data: { file: f.data, bytes: t.bytes.data },
  };
}

/**
 * Ganti (atau tambah) satu area beserta tile-nya; tile area lain dipertahankan. Objek baru.
 * @param {object} manifest
 * @param {{id: string, name: string, bounds: object, osmTimestamp: string|null, overtureRelease: string|null,
 *   tiles: object[]}} area tiles = hasil tileEntry
 */
export function upsertArea(manifest, area) {
  const keys = new Set(area.tiles.map((t) => t.key));
  const otherTiles = manifest.tiles.filter((t) => t.area !== area.id && !keys.has(t.key));
  const areaEntry = {
    id: area.id,
    name: area.name,
    bounds: area.bounds,
    osmTimestamp: area.osmTimestamp,
    overtureRelease: area.overtureRelease,
    tiles: area.tiles.map((t) => t.key),
  };
  return {
    ...manifest,
    areas: [...manifest.areas.filter((a) => a.id !== area.id), areaEntry].sort((a, b) => (a.id < b.id ? -1 : 1)),
    tiles: [...otherTiles, ...area.tiles].sort(tileOrder),
  };
}

/** Validasi bentuk manifest (dipakai golden test dan dapat dipakai klien). @returns {string[]} galat */
export function validateManifest(m) {
  const errors = [];
  if (!m || m.version !== FORMAT_VERSION) errors.push(`version harus ${FORMAT_VERSION}`);
  if (!Number.isFinite(m?.origin?.lat) || !Number.isFinite(m?.origin?.lon)) errors.push('origin lat/lon tidak valid');
  if (!(m?.tileSize > 0)) errors.push('tileSize tidak valid');
  for (const t of m?.tiles ?? []) {
    if (t.key !== `${t.ix}_${t.iz}`) errors.push(`key ${t.key} tidak cocok dengan ix/iz`);
    if (!Array.isArray(t.lod) || t.lod.length !== 2) errors.push(`${t.key}: lod harus 2 entri`);
    const sum = (t.lod ?? []).reduce((s, l) => s + l.bytes, 0) + (t.data?.bytes ?? 0);
    if (sum !== t.bytes) errors.push(`${t.key}: bytes ${t.bytes} ≠ jumlah file ${sum}`);
  }
  return errors;
}

/** Isi ATTRIBUTION.txt. */
export function attributionText(manifest) {
  const areas = manifest.areas.map((a) => {
    const ov = a.overtureRelease ? `Overture ${a.overtureRelease}` : 'tanpa Overture';
    return `- ${a.name} (${a.id}): OSM ${a.osmTimestamp ?? 'waktu tidak diketahui'}; ${ov}; ${a.tiles.length} tile`;
  });
  return [
    'Data tile kota di direktori ini adalah karya turunan (derived database) dari:',
    '',
    '  © OpenStreetMap contributors — https://www.openstreetmap.org/copyright',
    '  Overture Maps Foundation (theme buildings) — https://overturemaps.org',
    '    (menggabungkan OpenStreetMap, Microsoft ML Buildings, Google Open Buildings, Esri Community Maps)',
    '',
    'Lisensi data: Open Database License (ODbL) 1.0 — https://opendatacommons.org/licenses/odbl/1-0/',
    'File *.glb dan *.data.json di sini tunduk pada ODbL; kode proyek tetap berlisensi MIT.',
    '',
    'Area yang di-bake:',
    ...areas,
    '',
    'Dihasilkan oleh tools/citybake (node tools/citybake --area <id>).',
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Implementasi `report.js`**

```js
/**
 * Laporan ringkas hasil bake + peringatan anggaran (tidak menggagalkan bake).
 */
import { BUDGET } from './config.js';

const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
const mb = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`;

/**
 * @param {object} manifest manifest hasil bake
 * @param {string[]} areaIds area yang baru di-bake (ditampilkan per tile)
 * @param {{tileBytes: number, totalBytes: number}} [budget]
 * @returns {{lines: string[], warnings: string[]}}
 */
export function summarize(manifest, areaIds, budget = BUDGET) {
  const lines = [];
  const warnings = [];
  for (const id of areaIds) {
    const tiles = manifest.tiles.filter((t) => t.area === id);
    const bytes = tiles.reduce((s, t) => s + t.bytes, 0);
    lines.push(`Area ${id}: ${tiles.length} tile, ${mb(bytes)}`);
    for (const t of tiles) {
      const near = t.lod[0].bytes + t.data.bytes;
      lines.push(`  ${t.key.padEnd(8)} LOD0 ${kb(t.lod[0].bytes).padStart(10)} ${String(t.lod[0].triangles).padStart(7)} seg | `
        + `LOD1 ${kb(t.lod[1].bytes).padStart(10)} ${String(t.lod[1].triangles).padStart(7)} seg | data ${kb(t.data.bytes)}`);
      if (near > budget.tileBytes) warnings.push(`tile ${t.key}: LOD0+data ${kb(near)} > ${kb(budget.tileBytes)}`);
    }
  }
  const total = manifest.tiles.reduce((s, t) => s + t.bytes, 0);
  lines.push(`Total manifest: ${manifest.tiles.length} tile, ${mb(total)}`);
  if (total > budget.totalBytes) warnings.push(`total ${mb(total)} > ${mb(budget.totalBytes)}`);
  return { lines, warnings };
}
```

- [ ] **Step 5: Jalankan, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/manifest.test.js`
Expected: PASS — `Tests  7 passed (7)`.

- [ ] **Step 6: Commit**

```bash
git add tools/citybake/manifest.js tools/citybake/report.js tests/citybake/manifest.test.js && git commit -m "feat(citybake): manifest.json, ATTRIBUTION.txt, laporan anggaran"
```

---

### Task 18: Pipeline + CLI `node tools/citybake`

**Files:**
- Create: `tools/citybake/pipeline.js`
- Create: `tools/citybake/cli.js`
- Create: `tools/citybake/index.js`
- Test: `tests/citybake/cli.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect, vi } from 'vitest';
import { parseCli, main } from '../../tools/citybake/cli.js';

describe('parseCli', () => {
  it('--area all → semua area; default opsi', () => {
    expect(parseCli(['--area', 'all'])).toEqual({
      areaIds: ['stadion', 'pusat'], offline: false, useOverture: true, release: '2026-09-23.1',
      outDir: 'public/tiles', cacheDir: 'data-src',
    });
  });

  it('opsi lengkap', () => {
    const o = parseCli(['--area', 'pusat', '--offline', '--no-overture', '--overture-release', '2026-10-21.0', '--out', 'tmp/t']);
    expect(o).toMatchObject({ areaIds: ['pusat'], offline: true, useOverture: false, release: '2026-10-21.0', outDir: 'tmp/t' });
  });

  it('galat: tanpa --area, area tak dikenal, opsi tak dikenal', () => {
    expect(() => parseCli([])).toThrow(/--area wajib/);
    expect(() => parseCli(['--area', 'bandara'])).toThrow(/tidak dikenal/);
    expect(() => parseCli(['--area', 'stadion', '--cepat'])).toThrow();
  });
});

describe('main', () => {
  it('argumen salah → exit code 2 dengan pesan pemakaian', async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    expect(await main(['--area', 'bandara'], log)).toBe(2);
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/Pakai: node tools\/citybake/));
  });
});
```

- [ ] **Step 2: Jalankan, pastikan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/cli.test.js`
Expected: FAIL — `Cannot find module '../../tools/citybake/cli.js'`.

- [ ] **Step 3: Implementasi `pipeline.js`**

```js
/**
 * Orkestrasi bake: muat sumber → normalisasi → proyeksi → merge → tinggi → mask → partisi → bake tile
 * → tulis file + manifest + atribusi. Loader dapat diinjeksi (golden test memakai fixture).
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createProjection } from '../../src/geo/projection.js';
import { polygonCentroid } from '../../src/geo/polygon.js';
import {
  AREAS, BUDGET, ORIGIN, OVERTURE, PATHS, REGION_MASKS, TILE_SIZE, areaFetchBBox, areaRect, areaTiles,
} from './config.js';
import { loadOsm, normalizeOsm } from './fetchOsm.js';
import { loadOverture, normalizeOverture } from './fetchOverture.js';
import { projectFeatures } from './features.js';
import { mergeBuildings } from './merge.js';
import { estimateHeight } from './height.js';
import { createRoadLocator } from './roadLocator.js';
import { applyMasks } from './mask.js';
import { partitionFeatures } from './partition.js';
import { bakeTile } from './bakeTile.js';
import { writeTileGlb } from './glb.js';
import {
  ATTRIBUTION_FILE, MANIFEST_FILE, assertCompatible, attributionText, createManifest, tileEntry, tileFiles, upsertArea,
} from './manifest.js';
import { summarize } from './report.js';

/**
 * Fitur dunia siap partisi untuk satu area.
 * @returns {{features: object[], osmTimestamp: string|null, mergeStats: object}}
 */
export function prepareFeatures({ rawOsm, overtureFc, projection, masks }) {
  const osm = normalizeOsm(rawOsm);
  const osmWorld = projectFeatures(osm.features, projection);
  const ovWorld = overtureFc ? projectFeatures(normalizeOverture(overtureFc), projection) : [];
  const { buildings, stats } = mergeBuildings(osmWorld.filter((f) => f.kind === 'building'), ovWorld);
  const others = osmWorld.filter((f) => f.kind !== 'building');
  const locate = createRoadLocator(others.filter((f) => f.kind === 'road'));
  const withHeight = buildings.map((b) => {
    const c = polygonCentroid(b.rings[0]);
    return { ...b, height: estimateHeight(b, { nearestRoadClass: locate(c.x, c.z) }) };
  });
  const features = applyMasks([...withHeight, ...others], masks.map((m) => m.ring));
  return { features, osmTimestamp: osm.timestamp, mergeStats: stats };
}

/** Bake semua tile area → buffer siap tulis (tile kosong dilewati). */
export async function bakeAreaTiles(features, tiles, size) {
  const buckets = partitionFeatures(features, tiles, size);
  const out = [];
  for (const bucket of buckets.values()) {
    const baked = bakeTile(bucket, size);
    if (baked.empty) continue;
    out.push({
      key: baked.key,
      ix: baked.ix,
      iz: baked.iz,
      lod0: await writeTileGlb(baked.lods[0].meshes, `tile_${baked.key}_lod0`),
      lod1: await writeTileGlb(baked.lods[1].meshes, `tile_${baked.key}_lod1`),
      data: Buffer.from(JSON.stringify(baked.data)),
      triangles: [baked.lods[0].triangles, baked.lods[1].triangles],
    });
  }
  return out;
}

async function readManifest(outDir) {
  try {
    return JSON.parse(await readFile(join(outDir, MANIFEST_FILE), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`manifest.json rusak: ${err.message}`, { cause: err });
  }
}

/** Tulis file tile area & hapus file tile lama area itu yang kini kosong. Mengembalikan entri manifest. */
async function writeAreaFiles(outDir, previous, areaId, baked) {
  const entries = [];
  for (const t of baked) {
    const f = tileFiles(t.key);
    await writeFile(join(outDir, f.lod0), t.lod0);
    await writeFile(join(outDir, f.lod1), t.lod1);
    await writeFile(join(outDir, f.data), t.data);
    const bytes = { lod0: t.lod0.byteLength, lod1: t.lod1.byteLength, data: t.data.byteLength };
    entries.push(tileEntry({ key: t.key, ix: t.ix, iz: t.iz, area: areaId, bytes, triangles: t.triangles }));
  }
  const fresh = new Set(entries.map((e) => e.key));
  for (const old of previous.tiles.filter((t) => t.area === areaId && !fresh.has(t.key))) {
    for (const file of Object.values(tileFiles(old.key))) await rm(join(outDir, file), { force: true });
  }
  return entries;
}

/**
 * Jalankan bake untuk daftar area.
 * @param {{areaIds: string[], outDir?: string, cacheDir?: string, offline?: boolean, useOverture?: boolean,
 *   release?: string, areas?: object, masks?: Array<{id: string, ring: Array<[number, number]>}>, origin?: {lat: number, lon: number}, size?: number,
 *   log?: Console, loaders?: {osm: Function, overture: Function}}} opts
 * @returns {Promise<{manifest: object, report: {lines: string[], warnings: string[]}, stats: object}>}
 */
export async function runBake({
  areaIds, outDir = PATHS.outDir, cacheDir = PATHS.cacheDir, offline = false, useOverture = true,
  release = OVERTURE.release, areas = AREAS, masks = REGION_MASKS, origin = ORIGIN, size = TILE_SIZE,
  log = console, loaders = { osm: loadOsm, overture: loadOverture },
}) {
  const projection = createProjection({ lat0: origin.lat, lon0: origin.lon });
  await mkdir(outDir, { recursive: true });
  const fresh = createManifest({ origin, tileSize: size });
  const existing = await readManifest(outDir);
  if (existing) assertCompatible(existing, fresh);
  let manifest = existing ?? fresh;
  const stats = {};
  for (const id of areaIds) {
    const area = areas[id];
    if (!area) throw new Error(`area tidak dikenal: "${id}" (pilihan: ${Object.keys(areas).join(', ')})`);
    const bbox = areaFetchBBox(area, projection, 60, size);
    const rawOsm = await loaders.osm(id, bbox, { cacheDir, offline, log });
    const overtureFc = useOverture ? await loaders.overture(id, bbox, { cacheDir, offline, release, log }) : null;
    const prepared = prepareFeatures({ rawOsm, overtureFc, projection, masks });
    const baked = await bakeAreaTiles(prepared.features, areaTiles(area, projection, size), size);
    const entries = await writeAreaFiles(outDir, manifest, id, baked);
    manifest = upsertArea(manifest, {
      id, name: area.name, bounds: areaRect(area, projection), osmTimestamp: prepared.osmTimestamp,
      overtureRelease: overtureFc ? release : null, tiles: entries,
    });
    stats[id] = { ...prepared.mergeStats, tiles: entries.length };
  }
  await writeFile(join(outDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(outDir, ATTRIBUTION_FILE), attributionText(manifest));
  return { manifest, report: summarize(manifest, areaIds, BUDGET), stats };
}
```

- [ ] **Step 4: Implementasi `cli.js`**

```js
/**
 * Argumen CLI citybake:
 *   node tools/citybake --area stadion|pusat|all [--offline] [--no-overture]
 *                       [--overture-release <id>] [--out <dir>] [--cache <dir>]
 */
import { parseArgs } from 'node:util';
import { AREAS, OVERTURE, PATHS } from './config.js';
import { runBake } from './pipeline.js';

export const USAGE = 'Pakai: node tools/citybake --area <stadion|pusat|all> [--offline] [--no-overture] '
  + '[--overture-release <id>] [--out <dir>] [--cache <dir>]';

/** @returns {{areaIds: string[], offline: boolean, useOverture: boolean, release: string, outDir: string, cacheDir: string}} */
export function parseCli(argv, areas = AREAS) {
  const { values } = parseArgs({
    args: argv,
    options: {
      area: { type: 'string' },
      offline: { type: 'boolean', default: false },
      'no-overture': { type: 'boolean', default: false },
      'overture-release': { type: 'string', default: OVERTURE.release },
      out: { type: 'string', default: PATHS.outDir },
      cache: { type: 'string', default: PATHS.cacheDir },
    },
    strict: true,
  });
  if (!values.area) throw new Error(`--area wajib. ${USAGE}`);
  const areaIds = values.area === 'all' ? Object.keys(areas) : [values.area];
  for (const id of areaIds) if (!areas[id]) throw new Error(`area tidak dikenal: "${id}". ${USAGE}`);
  return {
    areaIds,
    offline: values.offline,
    useOverture: !values['no-overture'],
    release: values['overture-release'],
    outDir: values.out,
    cacheDir: values.cache,
  };
}

/** Titik masuk CLI; mengembalikan exit code. */
export async function main(argv, log = console) {
  let opts;
  try {
    opts = parseCli(argv);
  } catch (err) {
    log.error(err.message);
    return 2;
  }
  try {
    const t0 = Date.now();
    const { report } = await runBake({ ...opts, log });
    for (const line of report.lines) log.info(line);
    for (const w of report.warnings) log.warn(`PERINGATAN: ${w}`);
    log.info(`Selesai dalam ${((Date.now() - t0) / 1000).toFixed(1)} s → ${opts.outDir}`);
    return 0;
  } catch (err) {
    log.error(`[citybake] gagal: ${err.message}`);
    return 1;
  }
}
```

- [ ] **Step 5: Implementasi `index.js`**

```js
#!/usr/bin/env node
/** Entry CLI: `node tools/citybake --area stadion|pusat|all` (lihat cli.js). */
import { main } from './cli.js';

process.exitCode = await main(process.argv.slice(2));
```

- [ ] **Step 6: Jalankan tes, pastikan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/cli.test.js`
Expected: PASS — `Tests  4 passed (4)`.

- [ ] **Step 7: Uji asap CLI tanpa jaringan**

Run:
```bash
node tools/citybake; echo "exit $?"
node tools/citybake --area stadion --offline --cache tmp-cache-kosong --out tmp-out; echo "exit $?"
```
Expected: perintah pertama mencetak `--area wajib. Pakai: node tools/citybake …` dan `exit 2`; kedua mencetak `[citybake] gagal: mode --offline tetapi cache OSM tidak ada: tmp-cache-kosong…` dan `exit 1`. Hapus direktori sisa bila ada: `rm -rf tmp-out tmp-cache-kosong`.

- [ ] **Step 8: Commit**

```bash
git add tools/citybake/pipeline.js tools/citybake/cli.js tools/citybake/index.js tests/citybake/cli.test.js && git commit -m "feat(citybake): pipeline bake dan CLI (node tools/citybake --area …)"
```

---

### Task 19: Golden test citybake

Tes karakterisasi end-to-end memakai fixture Task 6/7 dengan area uji `uji` (persegi ±250 m di origin → 4 tile) dan mask uji persegi 30 m di (−200, −200). Angka segitiga di tile 0_0 dihitung tangan (komentar di tes). Tes ini diharapkan **langsung PASS** karena semua modul sudah ada; bila gagal, perbaiki implementasi — ubah angka hanya bila hitungan tangan terbukti salah.

**Files:**
- Test: `tests/citybake/golden.test.js`

- [ ] **Step 1: Tulis golden test**

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBake } from '../../tools/citybake/pipeline.js';
import { readGlbSummary } from '../../tools/citybake/glb.js';
import { validateManifest } from '../../tools/citybake/manifest.js';

const OSM = JSON.parse(readFileSync(new URL('./fixtures/osm-mini.json', import.meta.url), 'utf8'));
const OVERTURE = JSON.parse(readFileSync(new URL('./fixtures/overture-mini.geojson', import.meta.url), 'utf8'));
const ORIGIN = { lat: 0.4835954, lon: 101.3895277 };
const AREAS = { uji: { id: 'uji', name: 'Area uji', center: ORIGIN, halfSize: 250 } };
// Mask uji (koordinat dunia): persegi 30 m di (-200, -200) → bangunan way 1004 dibuang.
const MASKS = [{ id: 'uji', ring: [[-215, -215], [-185, -215], [-185, -185], [-215, -185]] }];
const quietLog = { info: () => {}, warn: () => {}, error: () => {} };

let dir;
let result;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'citybake-golden-'));
  result = await runBake({
    areaIds: ['uji'], outDir: dir, cacheDir: join(dir, 'cache'), areas: AREAS, masks: MASKS, origin: ORIGIN,
    release: '2026-09-23.1', log: quietLog,
    loaders: { osm: async () => OSM, overture: async () => OVERTURE },
  });
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('golden citybake (fixture mini)', () => {
  it('manifest valid, 4 tile urut iz lalu ix, atribusi area', async () => {
    const m = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
    expect(validateManifest(m)).toEqual([]);
    expect(m.tiles.map((t) => t.key)).toEqual(['-1_-1', '0_-1', '-1_0', '0_0']);
    expect(m.areas).toEqual([{
      id: 'uji', name: 'Area uji', bounds: { minX: -250, minZ: -250, maxX: 250, maxZ: 250 },
      osmTimestamp: '2026-10-16T00:00:00Z', overtureRelease: '2026-09-23.1', tiles: ['-1_-1', '0_-1', '-1_0', '0_0'],
    }]);
    expect(result.stats.uji).toEqual({ osm: 5, overtureKept: 3, droppedOsmSource: 1, droppedOverlap: 1, tiles: 4 });
    const attribution = await readFile(join(dir, 'ATTRIBUTION.txt'), 'utf8');
    expect(attribution).toContain('© OpenStreetMap contributors');
  });

  it('file per tile lengkap dan ukurannya cocok dengan manifest', async () => {
    const files = (await readdir(dir)).filter((f) => f !== 'cache').sort();
    expect(files).toEqual([
      '-1_-1.data.json', '-1_-1.lod0.glb', '-1_-1.lod1.glb', '-1_0.data.json', '-1_0.lod0.glb', '-1_0.lod1.glb',
      '0_-1.data.json', '0_-1.lod0.glb', '0_-1.lod1.glb', '0_0.data.json', '0_0.lod0.glb', '0_0.lod1.glb',
      'ATTRIBUTION.txt', 'manifest.json',
    ]);
    for (const t of result.manifest.tiles) {
      for (const l of t.lod) expect((await readFile(join(dir, l.file))).byteLength).toBe(l.bytes);
      expect((await readFile(join(dir, t.data.file))).byteLength).toBe(t.data.bytes);
    }
  });

  it('jumlah segitiga per tile/LOD stabil', () => {
    const tri = Object.fromEntries(result.manifest.tiles.map((t) => [t.key, t.lod.map((l) => l.triangles)]));
    // -1_-1: air 2 + landuse 2. -1_0: 1003 (144 m²) & ov-b (63 m²) pelana 14+14, primary 2;
    //   LOD1 kotak 10+10 + 2. 0_-1: relasi 5001 berlubang 16+8, footway 2, stream 2, landuse 2;
    //   LOD1 ring luar saja 8+2, tanpa footway. 0_0: lihat tes berikut.
    expect(tri).toEqual({ '-1_-1': [4, 4], '0_-1': [30, 14], '-1_0': [30, 22], '0_0': [56, 22] });
  });

  it('tile 0_0: node GLB & segitiga per mesh (dihitung tangan)', async () => {
    const lod0 = await readGlbSummary(await readFile(join(dir, '0_0.lod0.glb')));
    expect(lod0.scene).toBe('tile_0_0_lod0');
    // 1001 datar (8+2), 1002 pelana (10+4), ov-d#0/#1 pelana (10+4 masing-masing); jalan primary+footway (2+2)
    expect(lod0.nodes.map((n) => [n.name, n.triangles])).toEqual([
      ['roads', 4], ['buildings_walls', 38], ['buildings_roofs', 14],
    ]);
    const lod1 = await readGlbSummary(await readFile(join(dir, '0_0.lod1.glb')));
    // ov-d (36 m²) dibuang, 1002 jadi kotak; footway dibuang
    expect(lod1.nodes.map((n) => [n.name, n.triangles])).toEqual([
      ['roads', 2], ['buildings_walls', 16], ['buildings_roofs', 4],
    ]);
  });

  it('tile -1_-1: mask membuang bangunan 1004; air + landuse terpotong tile', async () => {
    const d = JSON.parse(await readFile(join(dir, '-1_-1.data.json'), 'utf8'));
    expect(d.buildings).toEqual([]);
    expect(d.water).toHaveLength(1);
    const lod0 = await readGlbSummary(await readFile(join(dir, '-1_-1.lod0.glb')));
    expect(lod0.nodes.map((n) => n.name)).toEqual(['landuse', 'water']);
  });

  it('data.json 0_0: tinggi dari building:levels, nama jalan utama, angka bulat 0,1 m', async () => {
    const d = JSON.parse(await readFile(join(dir, '0_0.data.json'), 'utf8'));
    expect(d).toMatchObject({ v: 1, key: '0_0', center: [250, 250], unit: 0.1 });
    expect(d.buildings.map((b) => b.h)).toContain(96);
    expect(d.roads.find((r) => r.cls === 'primary')).toMatchObject({ name: 'Jalan Uji Raya', w: 140 });
    expect(d.roads.find((r) => r.cls === 'footway').name).toBeUndefined();
    const nums = [...d.buildings.flatMap((b) => b.ring), ...d.roads.flatMap((r) => r.pts)];
    expect(nums.every(Number.isInteger)).toBe(true);
  });

  it('bake ulang deterministik: manifest identik', async () => {
    const again = await runBake({
      areaIds: ['uji'], outDir: dir, cacheDir: join(dir, 'cache'), areas: AREAS, masks: MASKS, origin: ORIGIN,
      release: '2026-09-23.1', log: quietLog, loaders: { osm: async () => OSM, overture: async () => OVERTURE },
    });
    expect(again.manifest).toEqual(result.manifest);
  });
});
```

- [ ] **Step 2: Jalankan**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/golden.test.js`
Expected: PASS — `Tests  7 passed (7)`.

- [ ] **Step 3: Jalankan seluruh suite + lint**

Run: `node node_modules/vitest/vitest.mjs run && npm run lint`
Expected: semua tes lama + 120 tes baru PASS (17 file baru); lint tanpa error.

- [ ] **Step 4: Commit**

```bash
git add tests/citybake/golden.test.js && git commit -m "test(citybake): golden test fixture mini end-to-end"
```

---

### Task 20: Penampil tile lokal (verifikasi visual)

Halaman kecil yang dilayani Vite dev server dari root repo (tidak masuk build karena `vite build` hanya memakai `index.html`). Ia juga mendemonstrasikan aturan render kontrak (lapisan datar `depthWrite: false` + `renderOrder`).

**Files:**
- Create: `tools/citybake/viewer.html`
- Create: `tools/citybake/viewer.js`

- [ ] **Step 1: Buat `viewer.html`**

```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>citybake — penampil tile</title>
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; background: #1d2228; font: 13px system-ui, sans-serif; color: #e8e8e8; }
      #hud { position: fixed; top: 8px; left: 8px; max-width: 46ch; padding: 8px 10px; background: #000a; border-radius: 6px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div id="hud">memuat…</div>
    <script type="module" src="./viewer.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Buat `viewer.js`**

```js
/**
 * Penampil tile citybake untuk verifikasi visual lokal (bukan bagian aplikasi; tidak ikut build).
 * Jalankan `npm run dev`, buka /tools/citybake/viewer.html?area=stadion&lod=0
 * (atau ?keys=0_0,-1_0). Sumbu di tengah area: merah = +X (timur), biru = +Z (selatan);
 * kerucut merah di tepi utara area menunjuk −Z (utara).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const params = new URLSearchParams(window.location.search);
const lod = params.get('lod') === '1' ? 1 : 0;
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb8cc);
scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5a4a, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(400, 700, 250);
scene.add(sun);
const tilesGroup = new THREE.Group();
scene.add(tilesGroup);
const axes = new THREE.AxesHelper(150);
scene.add(axes);
const north = new THREE.Mesh(new THREE.ConeGeometry(12, 40, 12), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
north.rotation.x = -Math.PI / 2; // ujung kerucut menunjuk −Z (utara)
scene.add(north);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 30000);
const controls = new OrbitControls(camera, renderer.domElement);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

async function loadTiles() {
  const res = await fetch('/tiles/manifest.json');
  if (!res.ok) throw new Error(`manifest.json: HTTP ${res.status}`);
  const manifest = await res.json();
  const area = manifest.areas.find((a) => a.id === params.get('area'));
  const keys = params.get('keys')?.split(',') ?? area?.tiles ?? manifest.tiles.slice(0, 1).map((t) => t.key);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  // Kontrak Format tile v1: lapisan datar digambar tanpa menulis depth, berurutan landuse → water → roads.
  const FLAT_ORDER = { landuse: -3, water: -2, roads: -1 };
  const solid = new THREE.MeshLambertMaterial({ vertexColors: true });
  const flat = new THREE.MeshLambertMaterial({ vertexColors: true, depthWrite: false });
  let triangles = 0;
  for (const key of keys) {
    const t = manifest.tiles.find((v) => v.key === key);
    if (!t) continue;
    const gltf = await loader.loadAsync(`/tiles/${t.lod[lod].file}`);
    gltf.scene.position.set((t.ix + 0.5) * manifest.tileSize, 0, (t.iz + 0.5) * manifest.tileSize);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const order = FLAT_ORDER[o.name];
      o.material = order === undefined ? solid : flat;
      o.renderOrder = order ?? 0;
      triangles += o.geometry.index.count / 3;
    });
    tilesGroup.add(gltf.scene);
  }
  const box = new THREE.Box3().setFromObject(tilesGroup);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  axes.position.set(center.x, 1, center.z);
  north.position.set(center.x, 2, box.min.z - 40);
  controls.target.copy(center);
  camera.position.set(center.x + size * 0.3, size * 0.45, center.z + size * 0.5);
  hud.textContent = `${keys.length} tile · LOD${lod} · ${triangles.toLocaleString('id-ID')} segitiga. `
    + 'Sumbu merah = timur (+X), biru = selatan (+Z); kerucut merah di tepi utara menunjuk utara.';
}

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

loadTiles().catch((err) => {
  hud.textContent = `Gagal: ${err.message}`;
  console.error(err);
});
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: tanpa error.

- [ ] **Step 4: Commit**

```bash
git add tools/citybake/viewer.html tools/citybake/viewer.js && git commit -m "feat(citybake): penampil tile lokal untuk verifikasi visual"
```

---

### Task 21: Bake nyata kedua area, verifikasi, commit `public/tiles/`

Butuh jaringan. Overpass publik bisa sibuk (HTTP 500/502/504) — pipeline mencoba ulang hingga 5× dengan jeda 15/30/60/120 s; bila tetap gagal, tunggu beberapa menit lalu jalankan ulang (cache yang sudah berhasil tidak diunduh ulang). Query Overture memakan ±5–7 menit per area.

**Files:**
- Create: `public/tiles/manifest.json`, `public/tiles/ATTRIBUTION.txt`, `public/tiles/*.lod0.glb`, `public/tiles/*.lod1.glb`, `public/tiles/*.data.json`

- [ ] **Step 1: Bake area stadion**

Run: `npm run bake -- --area stadion`
Expected: log `mengambil OSM "stadion"…`, `query Overture 2026-09-23.1 untuk "stadion"…`, lalu tabel per tile dan `Area stadion: 36 tile, ±3,5 MB` (prototipe: 36 tile, 3,50 MB). Bila muncul `Overture gagal (…) — lanjut OSM saja`, bake tetap selesai tanpa Overture; jalankan ulang perintah yang sama nanti untuk mencoba Overture lagi.

- [ ] **Step 2: Bake area pusat**

Run: `npm run bake -- --area pusat`
Expected: `Area pusat: 16 tile, ±3,8 MB` (atau kurang bila ada tile kosong) dan `Total manifest: 52 tile, ±7,3 MB` (prototipe: 52 tile, 7,32 MB).

- [ ] **Step 3: Kriteria terima (wajib semua)**

Run:
```bash
node --input-type=module -e "import { readFileSync } from 'node:fs'; import { validateManifest } from './tools/citybake/manifest.js'; const m = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8')); const e = validateManifest(m); const total = m.tiles.reduce((s, t) => s + t.bytes, 0); const worst = Math.max(...m.tiles.map((t) => t.lod[0].bytes + t.data.bytes)); console.log({ errors: e, areas: m.areas.map((a) => a.id + ':' + a.tiles.length + ':' + (a.overtureRelease ?? 'tanpa-overture')), tiles: m.tiles.length, totalMB: (total / 1048576).toFixed(2), worstNearKB: (worst / 1024).toFixed(1) });"
```
Expected:
- `errors: []`
- `areas` memuat `pusat:…:2026-09-23.1` dan `stadion:…:2026-09-23.1` (bila salah satu `tanpa-overture`, ulangi Step 1/2 untuk area itu sampai Overture berhasil, atau catat di PR bahwa area itu OSM-saja)
- `totalMB` ≤ 20 dan `worstNearKB` ≤ 300; laporan bake tidak memuat baris `PERINGATAN:`
- `public/tiles/ATTRIBUTION.txt` menyebut kedua area.

- [ ] **Step 4: Verifikasi visual lokal**

Run: `npm run dev`, lalu buka di browser:
1. `http://localhost:5173/tools/citybake/viewer.html?area=stadion` — periksa: (a) ada "lubang" elips di sekitar origin (mask stadion; sumbu merah/biru berada di tengahnya); (b) jalan bersambung mulus melintasi batas tile (tidak ada celah/geser di garis kelipatan 500 m); (c) tidak ada belang z-fighting pada landuse; (d) rumah kecil beratap pelana merah, bangunan besar beratap datar; (e) orientasi: buka `https://www.openstreetmap.org/#map=16/0.4836/101.3895` berdampingan; putar kamera penampil sampai kerucut merah (di tepi utara area) berada di atas layar — pola jalan raya besar (jalan arteri diagonal di sisi timur stadion) dan letak danau/kanal di utara stadion harus sama dengan peta OSM, tidak tercermin.
2. `http://localhost:5173/tools/citybake/viewer.html?area=stadion&lod=1` — jumlah segitiga di HUD lebih kecil, tanpa atap pelana dan tanpa jalan setapak.
3. `http://localhost:5173/tools/citybake/viewer.html?area=pusat` — kompleks Masjid Raya An-Nur (landuse religius/taman besar) berada dekat tengah area.
4. Konsol browser tanpa galat. Hentikan dev server (Ctrl+C).

- [ ] **Step 5: Commit tile**

```bash
git add public/tiles && git commit -m "feat: tile kota hasil bake (stadion, pusat) — OSM + Overture 2026-09-23.1"
```

- [ ] **Step 6: Bukti determinisme & mode offline**

Run:
```bash
npm run bake -- --area all --offline
git status --porcelain public/tiles
```
Expected: bake selesai dalam hitungan detik dari cache `data-src/`, dan `git status` tidak mencetak apa pun (byte identik). Bila ada perubahan, selidiki sumber non-determinisme sebelum melanjutkan; jangan commit ulang diam-diam.

---

## Self-review

### Cakupan spec Fase 1 → task

| Spec Fase 1 | Task |
|---|---|
| 1. `geo/projection.js` (ENU, < 1 cm dalam 20 km), `geo/tiles.js`, `geo/regionTransform.js` | 2, 3; **regionTransform di Plan A Task 6** (dipakai Fase 3; Fase 1 placement nol) |
| 2. Fetch & cache OSM (Overpass) dan Overture (DuckDB, bbox) ke `data-src/` (.gitignore) | 1 (.gitignore), 6, 7 |
| 3. Merge, potong per tile, buang fitur di dalam mask | 8, 14 |
| 4. Geometri bangunan (datar + pelana < 150 m²), jalan per kelas, air, landuse; re-center tile; gabung per material; vertex color | 11, 12, 13, 16 |
| 5. LOD1 (kotak tanpa pelana, jalan kecil dibuang) | 16 |
| 6. `data.json` (footprint 0,1 m tile-lokal, polyline jalan + kelas, nama jalan utama) | 16 + "Format tile v1" |
| 7. glTF-Transform + meshoptimizer; `manifest.json` + `ATTRIBUTION.txt` | 15, 17, 18 |
| 8. `height.js` (height → levels × 3,2 → heuristik; aturan ditulis user) | 9, 10 |
| Spec §5 penanganan galat (sisi bake: retry Overpass, fallback Overture, cache rusak, manifest tak cocok) | 6, 7, 18 |
| Spec §6 golden test citybake | 19 |
| Spec §8 risiko S3/DuckDB, ODbL | 7 (fallback), 17 (atribusi) |

### Asumsi yang belum terverifikasi
- **Tinggi 3,2 m per lantai** dan rentang heuristik (rumah 1 lantai < 150 m², ruko 2–4 lantai, industri 5,5–10 m) — tebakan domain, menunggu Task 10 (user).
- **Mask stadion sementara** = elips semi-sumbu (230 + 60) × (290 + 60) = 290 × 350 m di origin, yaw 0. Stadion nyata sumbu panjangnya ±2° dari utara-selatan dan ekstensinya 222 × 296 m, jadi elips ini cukup menutup kompleks, tetapi area handmade lama (1,4 × 1,4 km: danau, parkir utara, Jl. Naga Sakti prosedural) **lebih besar** dari mask sehingga di Fase 3 akan bertumpuk dengan tile kota sampai elemen fiktif dihapus.
- Landuse/air yang sebagian masuk mask hanya dibuang bila centroid-nya di dalam mask; sisanya ditutup tanah region di klien berkat aturan `depthWrite: false` (perlu dicek di Plan C).
- Kelengkapan Overture untuk Pekanbaru diasumsikan tinggi (contoh 0,007° persegi: 26 bangunan non-OSM vs 5 OSM). Rilis Overture lama dihapus dari S3 setelah beberapa bulan; bila `2026-09-23.1` hilang, pakai `--overture-release <id>` dari STAC catalog.
- `node tools/citybake` (path direktori) diresolusikan ke `index.js` oleh Node 24 untuk package ESM — diuji di Node 24.14; perilaku sama di Node 20 (resolusi entry CommonJS-style), tetapi belum diuji di Node 20.
- Penggunaan Overpass publik (2 query besar per bake) dianggap dalam batas kebijakan (< 10.000 query & < 1 GB per hari).
- `SITE` tetap diekspor dari `src/config/constants.js` selama Plan A berjalan.

### Risiko utama
- **Overpass publik tidak andal** (2026-10-16: empat kali 502/500 berturut-turut sebelum berhasil). Mitigasi: retry 5× dengan backoff, dua endpoint, cache per area; bila tetap gagal, ulangi nanti.
- **Query Overture lambat** (±5 menit per area walau bbox kecil) dan bergantung pada S3 publik; fallback OSM-saja membuat kota jauh lebih jarang (Overture menyumbang mayoritas footprint). Rilis lama dapat dihapus dari S3.
- **Anggaran klien:** maks 5 node (draw call) per tile → 25 tile aktif ≤ 125 draw call (< 150). Area pusat padat: 16 tile LOD0 = 112.583 segitiga, jadi radius LOD0 600 m + LOD1 sampai 1.000 m (spec Fase 2) masih di bawah ±300k; perlu diukur di Plan C.
- **Bentrok berkas dengan Plan A:** hanya `eslint.config.js` (blok baru di akhir array) dan `package.json` (devDependencies/scripts) yang mungkin disentuh keduanya — konflik merge kecil dan mekanis.

### Ketidaksesuaian spec yang ditemukan
- Spec §1 menyebut Area B "terpisah ±12 km"; data OSM menunjukkan **±8,3 km** (4,75 km utara, 6,83 km timur).
- Spec §1 "±1,5 × 1,5 km" untuk Area B: karena tile dibulatkan keluar ke grid 500 m, area pusat ter-bake menjadi 2 × 2 km (16 tile); area stadion pas 3 × 3 km (36 tile) karena origin jatuh di sudut grid.
- Spec §3 manifest `{version, origin, tileSize, tiles:[{key, ix, iz, bytes, lod:[...]}]}` diperluas (kompatibel) dengan `format`, `frame`, `unit`, `areas`, `data`, dan `area` per tile.
