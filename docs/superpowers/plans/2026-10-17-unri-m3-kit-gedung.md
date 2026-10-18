# M3 Kit Gedung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (atau superpowers:subagent-driven-development) untuk mengeksekusi plan ini task demi task. Langkah memakai checkbox (`- [ ]`). Satu implementer untuk seluruh tonggak, satu review di akhir (indeks "Aturan eksekusi"). TDD hanya untuk logika murni (obb, decompose, planBuilding, resolve/validate, klaster, bake); kode visual = implementasi + tes asap/budget + galeri screenshot.

**Goal:** ±216 gedung OSM di dalam distrik kampus UNRI tampil sebagai gedung kit berarketipe K01–K12 (+ placeholder 7 hero) yang autentik — selasar bertiang, nako, roster tembus, layar perforasi oranye ADB, rangka mangkrak — dirakit time-sliced per klaster 250 m dengan LOD, ≤ 3 mesh per klaster, gagal → K12, collider footprint, dan galeri review visual per arketipe.

**Architecture:** Bake offline (`tools/campusbake/buildings.js`) mengubah cache OSM → `public/districts/unri/buildings.json` (ring dunia 0,1 m, level, tag, klaster, luas, arah jalan dari ground M2). Runtime: `resolveBuilding` (aturan spec §4.7 + tabel override bersumber) → `planBuilding` murni (OBB/PCA → dekomposisi → K12; bay, selasar, bukaan, atap, papan, ornamen, variasi seed) → `appendBuildingSteps` menulis geometri ke **satu sink per klaster** (MeshBuilder per material, UV ke atlas canvas 2048² berisi 73 sel) → mesh `opak` + `potong` + `papan` per klaster. `buildBuilding(plan, mats)` tetap mengembalikan PartList (kontrak §4.6; dipakai galeri, hero, region M4/M6). Klaster dipilih LOD0 ≤ 250 m / LOD1 ≤ 900 m dengan histeresis, dirakit lewat `scheduler` M0 (generator, `yield` per gedung/sisi/lantai), footprint didaftarkan ke collider distrik M2.

**Tech Stack:** Three.js r186 (BufferGeometry non-indexed, MeshStandardMaterial + atlas CanvasTexture + roughnessMap + emissiveMap), canvas 2D prosedural, Vitest 5, Node ≥ 20 (bake), Playwright global (galeri/budget), ESLint flat config repo.

---

## Prasyarat

1. M0, M1, M2 **selesai** (indeks "Status tonggak"). Plan ini memakai persis:
   - M0 `src/engine/scheduler.js`: `createScheduler()` → `{ schedule(task, { owner }) -> { cancel() }, cancelOwner, update, pending, whenIdle }`; `task` = fungsi generator (setiap `yield` titik potong).
   - M1 `src/geo/terrain/heightfield.js` (`HeightField.heightAt`, `has(key)`), `src/districts/unri/index.js` (`unriDistrict`, `build(ctx)`), `src/districts/unri/boundary.js` (`UNRI_BOUNDARY`), `tools/campusbake/index.js` (CLI `npm run bake:campus -- terrain|ground|buildings|all [--offline]`), manifest distrik `buildings:'buildings.json'`.
   - M2 `src/districts/unri/groundData.js` (`parseGroundChunk(json, key)` → `roads/walks` dunia), `src/districts/unri/collider.js` (`createUnriCollider` → `{addChunk, removeChunk, isWalkable, isCameraClear, penetration, gradeAt, stats}`), `ctx.scope`, `ctx.scheduler`, `ctx.registries` (`registerEmissive(root) -> off`), konvensi nama grup ukur berawalan `unri:`.
2. Cache OSM `data-src/osm/stadion.json` ada (diisi `npm run bake -- --area stadion`); bila M2 menambah area `unri`, `data-src/osm/unri.json` ikut dibaca.
3. `npm test` hijau, `npm run lint` 0 galat sebelum mulai. Playwright global (`npm i -g playwright`) untuk galeri & budget.
4. Data riset/analisis yang mendasari plan ini (dihitung 2026-10-17 dari `data-src/osm/stadion.json`, poligon kampus `way/938374562`; rincian di §"Distribusi arketipe").

## Deviasi dari spec/indeks (dicatat ke dokumen di Task 1)

| # | Deviasi | Alasan |
|---|---|---|
| D1 | Aturan default §4.7 butir terakhir "lainnya → K12" diganti: **tanpa padanan & luas < 150 m² → K11; lainnya → K01 [INF blok koridor kampus negeri]**. K12 tetap cadangan geometri (dekomposisi gagal/berlubang/lengkung) dan cadangan galat | Hitungan OSM: aturan spec murni menjadikan **101 dari 216** gedung K12 (kotak ekstrusi) — 95 gedung tanpa nama yang 91 di antaranya persegi rapi. Itu persis risiko "kaleng" spec §15. Dengan D1: K12 = 2 (Gedung C FT setengah bundar, Lab Teknik Elektro berhalaman dalam) |
| D2 | Field aditif: override & hasil `resolveBuilding` punya `variant` (K03 motif `segitiga|vertikal|wajik`, K06 `limas-tumpang|kubah-kecil`, K07 `kantin|parkir`, K10 `rangka|beratap`, K11 `gudang|pos|toilet`) dan `aturan` (alasan); input `planBuilding` menerima `front` ([fx,fz] satuan ke jalan terdekat) dan `holes` | Motif layar ADB berbeda per gedung (foto IC segitiga, IL vertikal, HSC wajik); "Area Parkir …" ber-tag building butuh naungan, bukan kelas; FH Panam beratap seng (OSM `building:roof=tin`) |
| D3 | Klaster memakai pemilih LOD murni sendiri (`desiredLod`), bukan `ChunkStreamer`; radius LOD0 250 / LOD1 900 / lepas 930 (spec §7.4), bukan 600/1000 (§4.2) | Klaster dirakit dari data di memori (tanpa I/O, tanpa req/cancel jaringan); `src/city/` terlarang bagi lapisan distrik (§3.1) |
| D4 | Penggabungan per material di klaster lewat **sink bersama** (semua gedung menulis langsung ke MeshBuilder per material), bukan `mergeByMaterial` atas PartList; hasil ≤ 3 mesh/klaster (target spec 10–14 = batas atas) | `mergeGeometries` 100k+ segitiga (clone + applyMatrix4) tidak bisa dipotong dan > 4 ms (hitch). `buildBuilding` tetap mengembalikan PartList |
| D5 | `buildings.json` menambah `area`, `front`, `holes?`; bake menambah **gedung tersirat** (area `amenity=university` bernama tanpa tag building: Integrated Classroom, Health Sciences Center, Gedung Mangkrak FISIP, dst., 8 buah) dan membuang **gedung ganda** way/relation (Lab Teknik Elektro `w282230766` = `r3747439`) | Tanpa itu IC & HSC (gedung ADB berfoto) dan Gedung Mangkrak FISIP hilang; way+relation ganda = z-fighting |
| D6 | File tambahan di dalam M3 (boleh menurut indeks): `src/world/kit/{planGeom,planRules,kitBuilder,kitShapes,kitAssemble,ornaments,atlasPaint.surfaces,atlasPaint.openings,atlasPaint.misc}.js`, `src/districts/unri/{buildingsFormat,buildingFootprints,buildings}.js`, `src/dev/kitGallery.js`, `kit-gallery.html`, `tests/e2e/{kitGallery.shot,kitBudget.e2e}.mjs`. Diubah di luar daftar "Ubah" M3: `tools/campusbake/index.js` (cabang CLI `buildings`), dokumen spec/indeks | Ukuran file ≤ 450 baris; CLI `buildings` sudah dijanjikan indeks M1 |
| D7 | Variasi [INF] K01 dari hash id: 35 % atap limas (selain pelana), 30 % cat putih (selain krem) | OSM tak punya `roof:shape`/warna (riset §2); variasi menekan pengulangan pada 114 gedung K01 |

## Distribusi arketipe (hasil hitung OSM, 216 gedung di poligon kampus)

Data: 210 gedung ber-tag building (208 way + 1 relation di dalam poligon, minus 1 ganda) + 8 tersirat − 1 lapangan (dibuang) ≈ **216**; 122 bernama; lantai: 48× 1 lt, 27× 2 lt, 3× 3 lt, 2× 4, 1× 5, 1× 7, 135 tanpa tag; luas: 13 < 60 m², 33 < 150, 57 < 400, 72 < 1.000, 34 < 2.500, 8 ≥ 2.500. Rasio luas/OBB ≥ 0,85: 182; 34 butuh dekomposisi → 32 berhasil (13× 2 massa, 15× 3, 4× 4), 2 → K12. 33 klaster 250 m, maks 29 gedung/klaster (`-4_4`, FKIP/FISIP).

| Arketipe | Aturan spec murni | Aturan + D1 (tanpa override) | **Akhir (D1 + override + geometri)** |
|---|---|---|---|
| K01 kuliah-koridor | 49 | 124 | **114** |
| K02 dekanat | 8 | 8 | **6** (2 "Area Parkir … (Dekanat)" → K07) |
| K03 adb-layar | 0 | 0 | **2** (IC segitiga, HSC wajik) |
| K04 lab-bengkel | 29 | 28 | **27** (Lab Teknik Elektro → K12 berlubang) |
| K05 aula | 3 | 3 | **2** (GGM → hero) |
| K06 musala | 6 | 6 | **6** |
| K07 kantin | 3 | 3 | **7** (+4 naungan parkir) |
| K08 pendopo-kayu | 3 | 3 | **2** (Balai Bahasa ber-dinding bata → K01) |
| K09 rusun | 1 | 1 | **1** |
| K10 mangkrak | 1 | 1 | **2** (+FH Panam) |
| K11 utilitas | 13 | 39 | **39** |
| K12 ekstrusi-rapi | 101 | 0 (+2 geometri) | **2** |
| hero (placeholder M3) | — | — | **6**: rektorat, masjid-arfaunnas, ggm, sekretariat-lembaga, student-center, stadion-mini |

Tabel override nyata (17 entri, `buildings.data.js`) dengan sumber & keyakinan ada di Task 6.

## Bentuk BuildingPlan (kontrak §4.6 + aditif)

```js
{
  id, archetype /* 'K..'|'hero:..' asli */, kit /* arketipe geometri efektif: K.. (hero → pengganti, gagal → 'K12') */,
  fallback /* null | alasan */, seed, palette, variant, style: { tint, window, roster, stain, rust },
  groundY /* median tanah */, footY /* min tanah − 0,25 */, baseY /* median + 0,15 */, floors, floorH: [..], height,
  masses: [{ kind:'kotak'|'poligon', obb:{cx,cz,w,d,yaw}, ring, holes?, wall?:{x0,x1,z0,z1}, insets?, corridor:{faces,depth},
             faces:[{ id:'-z'|'+x'|'+z'|'-x'|'e<i>', a:[x,z] /*kiri dari luar*/, b, n:[nx,nz], len, role:'selasar'|'depan'|'belakang'|'sisi', exterior:[[u0,u1]], bays }],
             floors, floorH, baseY, height, roof:{ type, pitch, overhang, parapet } }],
  bays: [{ mass, face, index, u0, u1 }],
  openings: [{ mass, face, floor, u0, u1, y0, y1 /* relatif lantai */, kind, cell, lit, ac, layar?, screenOut?, jemuran? }],
  roof /* = masses[0].roof */, corridor: { side, faces, depth },
  signs: [{ text, style:'panel'|'timbul', mass, face, u, y, out, w, h }],
  ornaments: [{ assetId, transform:{ x, y, z, yaw, sx, sy, sz } /* dunia */ }],
}
```

Konvensi: frame lokal massa X = sisi panjang `w`, Z = sisi pendek `d`, `yaw` = rotasi three.js sumbu +Y. PartList: `{ geometry, material, matrix: null, castShadow, name }` — geometri **koordinat dunia** (`matrix` null; `groupFromParts` menerimanya).

## Struktur file

| File | Tanggung jawab |
|---|---|
| `src/world/kit/archetypes.js` | `ARCHETYPES` beku K01–K12, `PALETTES`, `VARIANTS`, `ROOF_TYPES`, `CORRIDOR_SIDES`, `CONFIDENCE`, `HERO_IDS`, `HERO_STANDIN`, `ROSTER_PATTERNS`, `hashId`, `geometryArchetype` |
| `src/world/kit/obb.js` | OBB (PCA momen luas + sudut sisi hull), `toLocal/toWorld`, `dominantYaw` |
| `src/world/kit/decompose.js` | dekomposisi ≤ 4 persegi panjang (grid sel, snap bertingkat, frame sisi dominan, uji ortogonal) |
| `src/world/kit/planGeom.js` | massa kotak/poligon, sisi luar/dalam antar-massa, bay, peran sisi |
| `src/world/kit/planRules.js` | bukaan per bay per arketipe, papan nama, ornamen |
| `src/world/kit/planBuilding.js` | `planBuilding(input)` murni |
| `src/world/kit/kitBuilder.js` | MeshBuilder (quad/tri/poligon/ubin/kotak/kubah), `createKitSink` (opak/potong/papan) |
| `src/world/kit/kitShapes.js` | primitif di bidang sisi (`wp`, `wallQuad`, `wallTiled`, `floorPolygon`, `subtractIntervals`) |
| `src/world/kit/atlas.js` + `atlasPaint.{surfaces,openings,misc}.js` | `ATLAS_CELLS` (73 sel, px persis), `cellUv`, pelukis canvas tiap sel, canvas kekasaran & emisif |
| `src/world/kit/kitMaterials.js` | `createKitMaterials(scope)` → `{ opak, potong, textures, atlasReady }` |
| `src/world/kit/signs.js` | atlas papan nama per klaster (N05), `appendSigns` |
| `src/world/kit/facade.js`, `openings.js`, `roofs.js`, `ornaments.js` | geometri fasad, bukaan, atap, ornamen |
| `src/world/kit/kitAssemble.js` | `appendBuildingSteps` (generator) / `appendBuilding` |
| `src/world/kit/buildBuilding.js` | `buildBuilding(plan, mats) → PartList`, `appendPlanSteps`, `appendParts`, `fallbackPlan` |
| `src/world/kit/hero/index.js` | `HERO_BUILDERS` placeholder semua id hero |
| `src/districts/unri/buildings.data.js` | `BUILDING_OVERRIDES` (17 entri bersumber) |
| `src/districts/unri/resolveBuilding.js` | `resolveBuilding`, `validateOverrides`, `RULES`, `parseLevelsTag` |
| `src/districts/unri/buildingsFormat.js` | format & validasi `buildings.json`, `clusterKey` |
| `src/districts/unri/buildingFootprints.js` | `footprintsOf` (collider), `drawFootprints` (minimap) |
| `src/districts/unri/buildingClusters.js` | klaster 250 m, LOD, tugas scheduler, sink, collider, emisif |
| `src/districts/unri/buildings.js` | `mountBuildings(ctx)` (dipanggil `index.js` distrik) |
| `tools/campusbake/buildings.js` | bake `buildings.json` |
| `src/dev/kitGallery.js`, `kit-gallery.html`, `tests/e2e/kitGallery.shot.mjs` | galeri review visual |
| `tests/e2e/kitBudget.e2e.mjs` | ukur budget di game |
| Ubah: `src/districts/unri/collider.js`, `src/districts/unri/index.js`, `tools/campusbake/index.js` | integrasi |

---

## Task 0: Verifikasi kontrak M0–M2 (tanpa kode)

**Files:** baca saja.

- [ ] **Step 1: Cabang & tes**

```bash
git status
git switch feat/unri-kampus
node node_modules/vitest/vitest.mjs run
npm run lint
```
Expected: cabang `feat/unri-kampus`, semua tes PASS, lint 0 galat.

- [ ] **Step 2: API yang dipakai ada dengan nama persis**

```bash
grep -n "export function createScheduler\|schedule(task" src/engine/scheduler.js
grep -n "has(key\|heightAt" src/geo/terrain/heightfield.js
grep -n "export const UNRI_BOUNDARY" src/districts/unri/boundary.js
grep -n "export function parseGroundChunk" src/districts/unri/groundData.js
grep -n "export function createUnriCollider\|addChunk,\|removeChunk" src/districts/unri/collider.js
grep -n "registries\|scheduler\|scope\|excludeIds\|createUnriCollider\|manifest" src/districts/unri/index.js
grep -n "'ground'\|case\|ground" tools/campusbake/index.js
grep -n "registerEmissive" src/app/districtRegistries.js
```
Expected: semua baris ada. Catat (komentar di PR/commit Task 15) **nama variabel** di `src/districts/unri/index.js` untuk: manifest terurai (M2 menyebutnya `manifest`), grup distrik (`group`), collider (`collider` dari `createUnriCollider`), daftar sistem, `whenSettled`, `dispose`. Task 15 memakai nama-nama itu.

- [ ] **Step 3: Bila ada nama berbeda**

Jangan ganti kontrak indeks. Sesuaikan HANYA baris pemanggilan di Task 13 (CLI) dan Task 15 (index.js) dengan nama nyata; file baru M3 tidak bergantung pada nama internal M1/M2 selain yang di Prasyarat.

---

## Task 1: Catat deviasi di spec & indeks

**Files:**
- Modify: `docs/superpowers/specs/2026-10-17-unri-kampus-design.md`
- Modify: `docs/superpowers/plans/2026-10-17-unri-00-index.md`

- [ ] **Step 1: Spec §4.7 — ganti kalimat aturan default**

Ganti bagian akhir kalimat aturan (mulai `… → luas < 60 m² → K11 →`) menjadi:

```
… `building=apartments` → K09 → luas < 60 m² → K11 → `/gedung [a-h]\b|kuliah|classroom/i` atau `amenity=university|college`
→ K01 → **tanpa padanan: luas < 150 m² → K11, lainnya → K01 [INFERENSI pola blok koridor kampus negeri; D1 plan M3]**.
K12 tidak lagi hasil aturan nama; K12 = cadangan geometri (dekomposisi gagal, footprint berlubang/lengkung) dan
cadangan galat perakitan (§10). Field aditif: `variant` (lihat `VARIANTS` di `src/world/kit/archetypes.js`) dan
`aturan` (alasan aturan yang cocok).
```

- [ ] **Step 2: Spec §7.1 baris K12 & §7.4**

Baris K12 kolom "Dipakai": `cadangan geometri (dekomposisi gagal, berlubang, lengkung) & cadangan galat`. Di §7.4 butir pertama tambahkan: `Penggabungan per material dilakukan inkremental ke satu sink per klaster (D4 plan M3): opak + potong + papan ≤ 3 mesh/klaster; radius klaster LOD0 250 m, LOD1 900 m, lepas 930 m (pemilih LOD sendiri, bukan ChunkStreamer).`

- [ ] **Step 3: Indeks — daftar file M3**

Di bagian `### M3: Kit gedung` tambahkan baris:

```
Tambahan (D6): `src/world/kit/{planGeom,planRules,kitBuilder,kitShapes,kitAssemble,ornaments,atlasPaint.surfaces,
atlasPaint.openings,atlasPaint.misc}.js`, `src/districts/unri/{buildingsFormat,buildingFootprints,buildings}.js`,
`src/dev/kitGallery.js`, `kit-gallery.html`, `tests/e2e/kitGallery.shot.mjs`, `tests/e2e/kitBudget.e2e.mjs`;
ubah `tools/campusbake/index.js` (cabang `buildings`). buildings.json aditif: `area`, `front`, `holes?`.
PartList = geometri dunia, `matrix: null`. Collider: `createUnriCollider` + `addBuildings(clusterKey, footprints)` /
`removeBuildings(clusterKey)`. Nama grup klaster `unri:gedung:<cx_cz>:lod<n>`.
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-10-17-unri-kampus-design.md docs/superpowers/plans/2026-10-17-unri-00-index.md
```
```bash
git commit -m "docs: catat deviasi kit gedung M3 (aturan K01/K11, sink klaster, gedung tersirat)"
```

---

## Task 2: Katalog arketipe

**Files:**
- Create: `src/world/kit/archetypes.js`

- [ ] **Step 1: Tulis file**

`src/world/kit/archetypes.js`:
```js
/**
 * Katalog arketipe gedung kampus K01–K12 (spec §7.1) + palet + jenis atap + id hero. Data beku,
 * murni (tanpa three). Satuan meter; warna hex sRGB. Setiap ciri bertanda sumber di komentar:
 * [T] fakta riset, [INF] inferensi pola kampus negeri Indonesia 1980–90-an (riset §4 baris "Gedung lama").
 */

const deepFreeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  return Object.freeze(o);
};

/** Id hero handmade (spec §7.1). Builder-nya di src/world/kit/hero/index.js. */
export const HERO_IDS = Object.freeze([
  'hero:rektorat', 'hero:masjid-arfaunnas', 'hero:gerbang-sm-amin', 'hero:ggm',
  'hero:sekretariat-lembaga', 'hero:student-center', 'hero:stadion-mini',
]);

/** Arketipe pengganti geometri placeholder hero (M3) sampai M4/M6 mengganti builder-nya. */
export const HERO_STANDIN = Object.freeze({
  'hero:rektorat': 'K12', 'hero:masjid-arfaunnas': 'K06', 'hero:gerbang-sm-amin': 'K11', 'hero:ggm': 'K12',
  'hero:sekretariat-lembaga': 'K01', 'hero:student-center': 'K03', 'hero:stadion-mini': 'K07',
});

/** Jenis atap (spec §7.2 langkah 5) + dua bentuk khusus musala. */
export const ROOF_TYPES = Object.freeze(['pelana', 'limas', 'datar-parapet', 'pelana-lebar', 'limas-tumpang', 'datar']);

/** Sisi selasar: 'jalan' = sisi panjang paling menghadap jalan terdekat (spec §7.2 langkah 3). */
export const CORRIDOR_SIDES = Object.freeze(['jalan', 'belakang', 'dua', 'keliling', 'tidak']);

export const CONFIDENCE = Object.freeze(['tinggi', 'sedang', 'rendah']);

/**
 * Palet: wall (dinding), trim (list/kusen beton), plinth (plint 0,6 m), column (kolom selasar),
 * roof (penutup atap), fascia (lisplang), accent (pintu/kusen kayu), floor (lantai selasar).
 */
export const PALETTES = deepFreeze({
  'krem-seng': { wall: 0xeadfc4, trim: 0xf5efe2, plinth: 0x8f9396, column: 0xf2ecdf, roof: 0x7f909d, fascia: 0xf4f1ea, accent: 0x6e4b32, floor: 0xcfc6b4 }, // [INF] cat krem, [T] seng
  'putih-seng': { wall: 0xf1efe9, trim: 0xe2e0da, plinth: 0x8d9195, column: 0xfbfaf6, roof: 0x8495a1, fascia: 0xf7f6f2, accent: 0x5f4532, floor: 0xd2cdc2 }, // [INF]
  'krem-genteng': { wall: 0xeadfc4, trim: 0xf5efe2, plinth: 0x8f9396, column: 0xf2ecdf, roof: 0xa65b3c, fascia: 0xf4f1ea, accent: 0x6e4b32, floor: 0xcfc6b4 }, // [T] building:roof=tile
  adb: { wall: 0xf4f4f1, trim: 0xd8d9d7, plinth: 0xb9bcbd, column: 0xffffff, roof: 0xc5c9cc, fascia: 0xe9ebec, accent: 0x2b2b2b, floor: 0xd9d6cf, screen: 0xd8703a }, // [T] foto ADB
  putih: { wall: 0xf3f1ec, trim: 0xdedcd6, plinth: 0x9a9da0, column: 0xfbfaf7, roof: 0x55595e, fascia: 0x4b4f54, accent: 0x50433a, floor: 0xd2cdc2 }, // [T] Rektorat putih, parapet gelap
  kayu: { wall: 0x8b5d3b, trim: 0x6f4a2e, plinth: 0x7d7468, column: 0x6a4329, roof: 0x7f909d, fascia: 0x6f4a2e, accent: 0x5a3a24, floor: 0x9a7350 }, // [T] building:walls=wood
  'beton-mentah': { wall: 0xa9a59c, trim: 0x9e9a91, plinth: 0x8a857c, column: 0xa3a097, roof: 0x7d8790, fascia: 0x8f8b83, accent: 0x5b5148, floor: 0x9b958a }, // [T] mangkrak
  rusun: { wall: 0xece7dc, trim: 0xd9d3c6, plinth: 0x8f9396, column: 0xf4f0e8, roof: 0x5f6469, fascia: 0xd9d3c6, accent: 0x5f4532, floor: 0xc9c2b4 }, // [INF] warna
});

/** Varian yang sah per arketipe (override `variant`). Elemen pertama = default. */
export const VARIANTS = deepFreeze({
  K03: ['segitiga', 'vertikal', 'wajik'],   // [T] motif layar: IC segitiga, IL vertikal, HSC wajik
  K06: ['limas-tumpang', 'kubah-kecil'],
  K07: ['kantin', 'parkir'],                // 'parkir': gudang beratap berkolom tanpa dinding (nama OSM "Area Parkir …")
  K10: ['rangka', 'beratap'],               // 'beratap': atap terpasang, dinding belum selesai (FH Panam [T])
  K11: ['gudang', 'pos', 'toilet'],
});

const K = (o) => o;

/**
 * Parameter default arketipe. floorH = tinggi lantai dasar, upperH = lantai atas, bay = target lebar bay,
 * corridor = selasar {side default, depth}, roof = {type, pitch°, overhang m}, plinth = tinggi pita plint,
 * window = sel atlas jendela utama, roster = roster di atas jendela, acChance = peluang AC luar per bay
 * belakang, doors = pola pintu, ornaments = id ornamen LOD0, signStyle = gaya papan nama.
 */
export const ARCHETYPES = deepFreeze({
  K01: K({ id: 'K01', name: 'kuliah-koridor', levels: 1, maxLevels: 4, floorH: 3.8, upperH: 3.6, bay: 3.6, corridor: { side: 'jalan', depth: 2.4 }, roof: { type: 'pelana', pitch: 25, overhang: 1.0 }, plinth: 0.6, palette: 'krem-seng', window: 'nako', windowAlt: 'jalusi-kayu', roster: true, acChance: 0.12, doors: 'kelas', ornaments: ['talang', 'pipa-turun', 'lampu-selasar'], signStyle: 'timbul' }),
  K02: K({ id: 'K02', name: 'dekanat', levels: 2, maxLevels: 4, floorH: 3.8, upperH: 3.6, bay: 3.6, corridor: { side: 'jalan', depth: 2.4 }, roof: { type: 'limas', pitch: 25, overhang: 1.0 }, plinth: 0.6, palette: 'krem-seng', window: 'nako', windowAlt: 'kaca-biru', roster: true, acChance: 0.35, doors: 'kelas', ornaments: ['teras-kanopi', 'tangga-tengah', 'tiang-bendera', 'pot', 'talang', 'pipa-turun', 'lampu-selasar'], signStyle: 'timbul' }),
  K03: K({ id: 'K03', name: 'adb-layar', levels: 3, maxLevels: 5, floorH: 4.2, upperH: 4.2, bay: 4.2, corridor: { side: 'jalan', depth: 2.8 }, roof: { type: 'pelana-lebar', pitch: 15, overhang: 2.5 }, plinth: 0.45, palette: 'adb', window: 'kaca-biru', windowAlt: 'kaca-biru', roster: false, acChance: 0.25, doors: 'lobi', ornaments: ['layar', 'talang', 'lampu-selasar'], signStyle: 'panel' }),
  K04: K({ id: 'K04', name: 'lab-bengkel', levels: 1, maxLevels: 3, floorH: 5.0, upperH: 4.0, bay: 4.5, corridor: { side: 'tidak', depth: 0 }, roof: { type: 'pelana', pitch: 30, overhang: 0.8 }, plinth: 0.6, palette: 'krem-seng', window: 'jalusi-kayu', windowAlt: 'nako', roster: false, acChance: 0.08, doors: 'gulung', ornaments: ['clerestory', 'exhaust', 'talang', 'pipa-turun'], signStyle: 'timbul' }),
  K05: K({ id: 'K05', name: 'aula', levels: 1, maxLevels: 2, floorH: 7.0, upperH: 4.0, bay: 5.0, corridor: { side: 'tidak', depth: 0 }, roof: { type: 'pelana', pitch: 25, overhang: 1.0 }, plinth: 0.6, palette: 'krem-seng', window: 'nako', windowAlt: 'nako', roster: true, acChance: 0.2, doors: 'ganda', ornaments: ['kanopi-masuk', 'ventilasi-atas', 'talang', 'pipa-turun'], signStyle: 'timbul' }),
  K06: K({ id: 'K06', name: 'musala', levels: 1, maxLevels: 2, floorH: 3.6, upperH: 3.4, bay: 3.0, corridor: { side: 'keliling', depth: 2.0 }, roof: { type: 'limas-tumpang', pitch: 30, overhang: 0.8 }, plinth: 0.45, palette: 'putih-seng', window: 'nako', windowAlt: 'nako', roster: true, acChance: 0, doors: 'ganda', ornaments: ['teras-keramik', 'tempat-wudu', 'rak-sandal'], signStyle: 'timbul' }),
  K07: K({ id: 'K07', name: 'kantin', levels: 1, maxLevels: 1, floorH: 3.4, upperH: 3.4, bay: 3.0, corridor: { side: 'tidak', depth: 0 }, roof: { type: 'pelana', pitch: 15, overhang: 0.8 }, plinth: 0.3, palette: 'krem-seng', window: 'tanpa', windowAlt: 'tanpa', roster: false, acChance: 0, doors: 'terbuka', ornaments: ['etalase', 'meja-bangku', 'spanduk-menu'], signStyle: 'tidak' }),
  K08: K({ id: 'K08', name: 'pendopo-kayu', levels: 1, maxLevels: 1, floorH: 3.4, upperH: 3.4, bay: 3.0, corridor: { side: 'keliling', depth: 1.5 }, roof: { type: 'limas', pitch: 30, overhang: 1.0 }, plinth: 0.5, palette: 'kayu', window: 'jalusi-kayu', windowAlt: 'jalusi-kayu', roster: false, acChance: 0, doors: 'ganda', ornaments: ['panggung', 'tangga-tengah'], signStyle: 'timbul' }),
  K09: K({ id: 'K09', name: 'rusun', levels: 5, maxLevels: 8, floorH: 3.0, upperH: 3.0, bay: 3.6, corridor: { side: 'jalan', depth: 1.8 }, roof: { type: 'datar-parapet', pitch: 0, overhang: 0.3 }, plinth: 0.45, palette: 'rusun', window: 'nako', windowAlt: 'nako', roster: true, acChance: 0.3, doors: 'unit', ornaments: ['balkon-jemuran', 'tangga-ujung', 'tandon'], signStyle: 'tidak' }),
  K10: K({ id: 'K10', name: 'mangkrak', levels: 2, maxLevels: 6, floorH: 3.8, upperH: 3.6, bay: 4.0, corridor: { side: 'tidak', depth: 0 }, roof: { type: 'datar', pitch: 0, overhang: 0 }, plinth: 0, palette: 'beton-mentah', window: 'tanpa', windowAlt: 'tanpa', roster: false, acChance: 0, doors: 'tanpa', ornaments: ['besi-tulangan', 'coretan', 'ilalang', 'bata-sebagian'], signStyle: 'tidak' }),
  K11: K({ id: 'K11', name: 'utilitas', levels: 1, maxLevels: 2, floorH: 3.0, upperH: 3.0, bay: 3.0, corridor: { side: 'tidak', depth: 0 }, roof: { type: 'pelana', pitch: 20, overhang: 0.5 }, plinth: 0.3, palette: 'putih-seng', window: 'nako', windowAlt: 'jalusi-alu', roster: false, acChance: 0.05, doors: 'tunggal', ornaments: ['talang'], signStyle: 'tidak' }),
  K12: K({ id: 'K12', name: 'ekstrusi-rapi', levels: 1, maxLevels: 8, floorH: 3.6, upperH: 3.5, bay: 3.2, corridor: { side: 'tidak', depth: 0 }, roof: { type: 'datar-parapet', pitch: 0, overhang: 0 }, plinth: 0.6, palette: 'krem-seng', window: 'nako', windowAlt: 'jalusi-kayu', roster: true, acChance: 0.1, doors: 'tunggal', ornaments: [], signStyle: 'timbul' }),
});

export const ARCHETYPE_IDS = Object.freeze(Object.keys(ARCHETYPES));

/** Pola roster (lubang angin) di atlas: satu per gedung (seed). */
export const ROSTER_PATTERNS = Object.freeze(['kotak', 'lingkaran', 'silang', 'bunga', 'krawangan']);

/** Hash FNV-1a 32-bit dari id OSM → seed deterministik (spec §7.2 langkah 6). */
export function hashId(id) {
  let h = 0x811c9dc5;
  const s = String(id);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Arketipe yang dipakai planBuilding untuk sebuah id (K.. atau hero:..). */
export function geometryArchetype(id) {
  return ARCHETYPES[id] ?? ARCHETYPES[HERO_STANDIN[id]] ?? ARCHETYPES.K12;
}
```

- [ ] **Step 2: Lint**

Run: `node node_modules/eslint/bin/eslint.js src/world/kit/archetypes.js`
Expected: tanpa keluaran (0 galat).

(Commit bersama Task 3.)

---

## Task 3: OBB (TDD)

**Files:**
- Test: `tests/kit/obb.test.js`
- Create: `src/world/kit/obb.js`

- [ ] **Step 1: Tulis tes**

`tests/kit/obb.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { computeObb, dominantYaw, normalizeYaw, principalAngle, toLocal, toWorld, OBB_RECT_MIN } from '../../src/world/kit/obb.js';

const DEG = Math.PI / 180;

/** Persegi panjang w × d berpusat (cx, cz), sumbu panjang diputar `rot` (radian, arah (cos, sin) di x,z). */
function rotatedRect(cx, cz, w, d, rot) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c]);
}

describe('obb', () => {
  it('persegi panjang sejajar sumbu: w = sisi panjang, d = pendek, yaw 0, rasio 1', () => {
    const o = computeObb([[0, 0], [40, 0], [40, 12], [0, 12]]);
    expect(o.cx).toBeCloseTo(20, 6);
    expect(o.cz).toBeCloseTo(6, 6);
    expect(o.w).toBeCloseTo(40, 6);
    expect(o.d).toBeCloseTo(12, 6);
    expect(Math.abs(o.yaw)).toBeCloseTo(0, 6);
    expect(o.area).toBeCloseTo(480, 6);
    expect(o.rectangularity).toBeCloseTo(1, 6);
  });

  it('persegi panjang diputar 30°: yaw three.js = −30° (X lokal → (cos30, sin30) dunia)', () => {
    const o = computeObb(rotatedRect(-1000, 800, 46.4, 14.7, 30 * DEG));
    expect(o.w).toBeCloseTo(46.4, 5);
    expect(o.d).toBeCloseTo(14.7, 5);
    expect(o.yaw).toBeCloseTo(-30 * DEG, 6);
    const p = toWorld(o, o.w / 2, 0);
    expect(p.x).toBeCloseTo(-1000 + 23.2 * Math.cos(30 * DEG), 4);
    expect(p.z).toBeCloseTo(800 + 23.2 * Math.sin(30 * DEG), 4);
  });

  it('sisi panjang di sumbu Z dunia → diputar 90° agar w ≥ d', () => {
    const o = computeObb([[0, 0], [10, 0], [10, 50], [0, 50]]);
    expect(o.w).toBeCloseTo(50, 6);
    expect(o.d).toBeCloseTo(10, 6);
    expect(Math.abs(o.yaw)).toBeCloseTo(Math.PI / 2, 6);
  });

  it('persegi sempurna diputar 37°: hull edge memperbaiki PCA (luas OBB = luas footprint)', () => {
    const o = computeObb(rotatedRect(5, 5, 20, 20, 37 * DEG));
    expect(o.w * o.d).toBeCloseTo(400, 3);
    expect(o.rectangularity).toBeCloseTo(1, 4);
  });

  it('bentuk L: rasio < 0,85 (memicu dekomposisi)', () => {
    const o = computeObb([[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]]);
    expect(o.rectangularity).toBeLessThan(OBB_RECT_MIN);
    expect(o.rectangularity).toBeCloseTo(500 / 900, 6);
  });

  it('toLocal ∘ toWorld = identitas', () => {
    const o = { cx: 12, cz: -7, yaw: 0.6 };
    const w = toWorld(o, 3.5, -2.25);
    const l = toLocal(o, w.x, w.z);
    expect(l.x).toBeCloseTo(3.5, 9);
    expect(l.z).toBeCloseTo(-2.25, 9);
  });

  it('normalizeYaw ke (−π/2, π/2]', () => {
    expect(normalizeYaw(Math.PI)).toBeCloseTo(0, 9);
    expect(normalizeYaw(-Math.PI / 2)).toBeCloseTo(Math.PI / 2, 9);
    expect(normalizeYaw(2.5)).toBeCloseTo(2.5 - Math.PI, 9);
  });

  it('principalAngle persegi panjang miring 20° ≈ 20°; dominantYaw = −20°', () => {
    const r = rotatedRect(0, 0, 60, 10, 20 * DEG);
    expect(principalAngle(r)).toBeCloseTo(20 * DEG, 6);
    expect(dominantYaw(r)).toBeCloseTo(-20 * DEG, 3);
  });

  it('footprint rusak → RangeError', () => {
    expect(() => computeObb([[0, 0], [1, 0]])).toThrow(RangeError);
    expect(() => computeObb([[0, 0], [0.5, 0], [0.5, 0.5]])).toThrow(RangeError);
    expect(() => computeObb(null)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/kit/obb.test.js`
Expected: FAIL — `Failed to load url ../../src/world/kit/obb.js`.

- [ ] **Step 3: Implementasi**

`src/world/kit/obb.js`:
```js
/**
 * OBB (kotak berorientasi) footprint gedung. Sumbu utama dari momen luas poligon (PCA), lalu
 * disempurnakan dengan sudut setiap sisi hull cembung: kandidat dengan luas OBB terkecil menang
 * (PCA tidak stabil untuk footprint ~persegi). Konvensi frame lokal massa: X lokal = sisi panjang `w`,
 * Z lokal = sisi pendek `d`, `yaw` = rotasi three.js mengitari +Y (X lokal → dunia (cos yaw, −sin yaw)),
 * dinormalkan ke (−π/2, π/2]. Murni (tanpa three).
 */
import { cleanRing, convexHull, polygonArea } from '../../geo/polygon.js';

export const OBB_RECT_MIN = 0.85; // rasio luas footprint/OBB minimum agar dianggap persegi (spec §7.2)
const MIN_AREA = 1; // m²; footprint lebih kecil dari ini dianggap rusak
const EPS = 1e-9;

/** Normalkan sudut ke (−π/2, π/2] (OBB simetris terhadap putaran 180°). */
export function normalizeYaw(yaw) {
  let a = yaw % Math.PI;
  if (a <= -Math.PI / 2) a += Math.PI;
  if (a > Math.PI / 2) a -= Math.PI;
  return a;
}

/** Titik dunia → frame lokal OBB. */
export function toLocal(obb, x, z) {
  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  const dx = x - obb.cx;
  const dz = z - obb.cz;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/** Titik frame lokal OBB → dunia. */
export function toWorld(obb, lx, lz) {
  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  return { x: obb.cx + lx * c + lz * s, z: obb.cz - lx * s + lz * c };
}

/** Sudut sumbu utama (radian; arah (cos θ, sin θ) di bidang x,z) dari momen luas kedua poligon. */
export function principalAngle(ring) {
  let a = 0;
  let sx = 0;
  let sz = 0;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (let i = 0, n = ring.length; i < n; i += 1) {
    const [px, pz] = ring[i];
    const [qx, qz] = ring[(i + 1) % n];
    const cr = px * qz - qx * pz;
    a += cr;
    sx += (px + qx) * cr;
    sz += (pz + qz) * cr;
    sxx += (px * px + px * qx + qx * qx) * cr;
    szz += (pz * pz + pz * qz + qz * qz) * cr;
    sxz += (px * qz + 2 * px * pz + 2 * qx * qz + qx * pz) * cr;
  }
  if (Math.abs(a) < EPS) return 0;
  const cx = sx / (3 * a);
  const cz = sz / (3 * a);
  const cxx = sxx / (6 * a) - cx * cx;
  const czz = szz / (6 * a) - cz * cz;
  const cxz = sxz / (12 * a) - cx * cz;
  return 0.5 * Math.atan2(2 * cxz, cxx - czz);
}

/**
 * Yaw sumbu sisi dominan: histogram arah sisi (modulo 90°, bin 1°, bobot panjang, dihaluskan), lalu rata-rata
 * berbobot sisi dalam ±3° dari puncak. Untuk footprint siku-siku yang sayapnya miring terhadap OBB
 * (denah silang/pinwheel FKIP) frame ini memberi dekomposisi yang benar.
 */
export function dominantYaw(ring) {
  const quarter = Math.PI / 2;
  const bins = new Float64Array(90);
  const edges = [];
  for (let i = 0, n = ring.length; i < n; i += 1) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < EPS) continue;
    const ang = ((Math.atan2(bz - az, bx - ax) % quarter) + quarter) % quarter;
    edges.push({ ang, len });
    bins[Math.min(89, Math.floor((ang / quarter) * 90))] += len;
  }
  let peak = 0;
  let peakW = -1;
  for (let i = 0; i < 90; i += 1) {
    const w = bins[(i + 89) % 90] * 0.5 + bins[i] + bins[(i + 1) % 90] * 0.5;
    if (w > peakW) {
      peakW = w;
      peak = i;
    }
  }
  const center = ((peak + 0.5) / 90) * quarter;
  let sum = 0;
  let wsum = 0;
  for (const e of edges) {
    let delta = e.ang - center;
    if (delta > quarter / 2) delta -= quarter;
    if (delta < -quarter / 2) delta += quarter;
    if (Math.abs(delta) <= (3 * Math.PI) / 180) {
      sum += delta * e.len;
      wsum += e.len;
    }
  }
  const theta = center + (wsum > 0 ? sum / wsum : 0);
  return normalizeYaw(-theta);
}

/** Rentang proyeksi titik pada sumbu θ (u) dan tegak lurusnya (v). */
function extentsAt(points, theta) {
  const ux = Math.cos(theta);
  const uz = Math.sin(theta);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const [x, z] of points) {
    const u = x * ux + z * uz;
    const v = -x * uz + z * ux;
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
    if (v < v0) v0 = v;
    if (v > v1) v1 = v;
  }
  return { theta, u0, u1, v0, v1, area: (u1 - u0) * (v1 - v0) };
}

/**
 * @param {Array<[number, number]>} ring ring dunia (terbuka atau tertutup)
 * @returns {{cx:number, cz:number, w:number, d:number, yaw:number, area:number, rectangularity:number}}
 */
export function computeObb(ring) {
  const clean = cleanRing(ring ?? []);
  const area = clean.length >= 3 ? polygonArea(clean) : 0;
  if (!(area >= MIN_AREA)) throw new RangeError(`computeObb: footprint tidak valid (luas ${area})`);
  const hull = convexHull(clean);
  const candidates = [principalAngle(clean)];
  for (let i = 0; i < hull.length; i += 1) {
    const [ax, az] = hull[i];
    const [bx, bz] = hull[(i + 1) % hull.length];
    if (Math.hypot(bx - ax, bz - az) > EPS) candidates.push(Math.atan2(bz - az, bx - ax));
  }
  let best = extentsAt(hull, candidates[0]);
  for (let i = 1; i < candidates.length; i += 1) {
    const e = extentsAt(hull, candidates[i]);
    if (e.area < best.area * (1 - 1e-6)) best = e;
  }
  let theta = best.theta;
  let w = best.u1 - best.u0;
  let d = best.v1 - best.v0;
  const mu = (best.u0 + best.u1) / 2;
  const mv = (best.v0 + best.v1) / 2;
  const cx = mu * Math.cos(theta) - mv * Math.sin(theta);
  const cz = mu * Math.sin(theta) + mv * Math.cos(theta);
  if (w < d) {
    [w, d] = [d, w];
    theta += Math.PI / 2;
  }
  // arah sumbu X lokal di dunia = (cos θ, sin θ) → yaw three.js = atan2(−sin θ, cos θ) = −θ
  return { cx, cz, w, d, yaw: normalizeYaw(-theta), area, rectangularity: area / (w * d) };
}
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/kit/obb.test.js`
Expected: 9 tes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/kit/archetypes.js src/world/kit/obb.js tests/kit/obb.test.js
```
```bash
git commit -m "feat(kit): katalog arketipe K01-K12 dan OBB footprint (PCA + sisi hull)"
```

---

## Task 4: Dekomposisi footprint (TDD)

**Files:**
- Test: `tests/kit/decompose.test.js`
- Create: `src/world/kit/decompose.js`

Ring uji nyata (Perpustakaan UNRI 20 titik, Gedung C FKIP Ekonomi silang miring, Gedung C FT setengah bundar, GGM lingkaran) diambil dari OSM yang sama dengan bake.

- [ ] **Step 1: Tulis tes**

`tests/kit/decompose.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { computeObb } from '../../src/world/kit/obb.js';
import { decomposeFootprint, orthogonalFraction, snapValues } from '../../src/world/kit/decompose.js';
import { polygonArea } from '../../src/geo/polygon.js';

// Ring nyata dari data-src/osm/stadion.json (dunia, dikuantisasi 0,1 m seperti buildings.json).
const PERPUSTAKAAN = [[-1124, 745.8], [-1127, 745.8], [-1126.9, 732.6], [-1123.7, 732.6], [-1123.7, 725.1], [-1102.5, 725.2], [-1102.5, 732.3], [-1097.3, 732.3], [-1097.2, 722.2], [-1073.8, 722.4], [-1073.8, 731.9], [-1070.3, 731.9], [-1070.4, 745.2], [-1074, 745.1], [-1074, 751], [-1097.5, 750.9], [-1097.5, 745.5], [-1102.8, 745.5], [-1102.8, 753.4], [-1124, 753.3]];
const FKIP_EKONOMI = [[-1047.6, 1100.6], [-1031.5, 1100.3], [-1031.3, 1084.9], [-1014.9, 1085.1], [-1015, 1100.1], [-999.8, 1100.6], [-999.8, 1116.9], [-1016.2, 1116.5], [-1015.8, 1134.2], [-1030.9, 1133.8], [-1030.7, 1116.8], [-1047.6, 1116.9]];
const FT_SETENGAH_BUNDAR = [[-1451.6, 368.9], [-1447.9, 378.2], [-1443.3, 384.5], [-1434.6, 390.8], [-1423.3, 391.2], [-1410.7, 388.8], [-1402.6, 381.3], [-1399.2, 373.8], [-1396, 365.5], [-1378.3, 368.1], [-1381.6, 382], [-1388.3, 396.3], [-1400.8, 406.9], [-1412.4, 411.3], [-1427, 412.9], [-1439.2, 409.5], [-1453.8, 402.1], [-1461.7, 396.1], [-1467.2, 387.9], [-1469, 382.1], [-1470, 373.7]];
const GGM = [[170.9, 422.9], [162, 436.1], [148.8, 444.9], [133.1, 448], [117.5, 444.9], [104.2, 436.1], [95.4, 422.9], [92.3, 407.4], [95.4, 391.9], [104.2, 378.7], [117.5, 369.9], [133.1, 366.8], [148.8, 369.9], [162, 378.7], [170.9, 391.9], [174, 407.4]];

const run = (ring) => decomposeFootprint(ring, computeObb(ring));
const total = (r) => r.masses.reduce((s, m) => s + m.w * m.d, 0);

describe('decompose', () => {
  it('snapValues menggabungkan nilai berdekatan', () => {
    expect(snapValues([0, 0.2, 10, 10.4, 30], 0.6)).toEqual([0.1, 10.2, 30]);
  });

  it('L 30×30 (lengan 10): dua massa, luas tepat 500 m², w ≥ d', () => {
    const r = run([[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]]);
    expect(r.masses).toHaveLength(2);
    expect(total(r)).toBeCloseTo(500, 6);
    expect(r.coverage).toBeCloseTo(1, 6);
    for (const m of r.masses) expect(m.w).toBeGreaterThanOrEqual(m.d);
  });

  it('U: tiga massa; T: dua massa (terbesar dulu)', () => {
    const u = run([[0, 0], [40, 0], [40, 30], [30, 30], [30, 10], [10, 10], [10, 30], [0, 30]]);
    expect(u.masses).toHaveLength(3);
    expect(total(u)).toBeCloseTo(800, 6);
    const t = run([[0, 0], [30, 0], [30, 10], [20, 10], [20, 30], [10, 30], [10, 10], [0, 10]]);
    expect(t.masses).toHaveLength(2);
    expect(t.masses[0].w * t.masses[0].d).toBeCloseTo(300, 6);
  });

  it('L diputar 37°: massa mewarisi yaw frame', () => {
    const c = Math.cos(37 * Math.PI / 180);
    const s = Math.sin(37 * Math.PI / 180);
    const ring = [[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]].map(([x, z]) => [x * c - z * s, x * s + z * c]);
    const r = run(ring);
    expect(r.masses).toHaveLength(2);
    expect(total(r)).toBeCloseTo(500, 3);
    const yaws = r.masses.map((m) => Math.abs(Math.sin(2 * m.yaw)));
    for (const y of yaws) expect(y).toBeCloseTo(Math.abs(Math.sin(2 * (-37 * Math.PI / 180))), 3);
  });

  it('Perpustakaan UNRI (20 titik, tonjolan 3 m): ≤ 4 massa, cakupan ≥ 0,9 (snap bertingkat)', () => {
    const r = run(PERPUSTAKAAN);
    expect(r).not.toBeNull();
    expect(r.masses.length).toBeLessThanOrEqual(4);
    expect(r.coverage).toBeGreaterThanOrEqual(0.9);
  });

  it('Gedung C FKIP Ekonomi (silang miring terhadap OBB): frame sisi dominan → 3 massa, cakupan ≈ 1', () => {
    const r = run(FKIP_EKONOMI);
    expect(r.masses).toHaveLength(3);
    expect(r.coverage).toBeGreaterThan(0.97);
    expect(total(r)).toBeCloseTo(polygonArea(FKIP_EKONOMI), -1);
  });

  it('lengkung (Gedung C FT "setengah bundar", GGM): null → K12 ekstrusi', () => {
    expect(orthogonalFraction(FT_SETENGAH_BUNDAR)).toBeLessThan(0.75);
    expect(run(FT_SETENGAH_BUNDAR)).toBeNull();
    expect(run(GGM)).toBeNull();
  });

  it('ring rusak → null', () => {
    expect(decomposeFootprint([[0, 0], [1, 1]], { cx: 0, cz: 0, yaw: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/kit/decompose.test.js`
Expected: FAIL — modul `decompose.js` belum ada.

- [ ] **Step 3: Implementasi**

`src/world/kit/decompose.js`:
```js
/**
 * Dekomposisi footprint tak persegi menjadi ≤ 4 massa persegi panjang (spec §7.2 langkah 1).
 * Di frame lokal OBB: koordinat x/z unik titik ring (digabung bila < `snap`; dicoba bertingkat
 * `snaps` dari halus ke kasar agar tonjolan kecil 1–3 m tidak menghabiskan jatah massa) membentuk grid; sel yang
 * pusatnya di dalam poligon diisi; lalu persegi panjang sel terbesar diambil berulang (greedy) sampai
 * semua sel tertutup atau batas massa tercapai. Frame dicoba dua: arah sisi dominan (dominantYaw) lalu OBB. Gagal (null) bila cakupan < minCoverage, luas sel
 * > maxOvershoot × luas poligon, < minOrthogonal keliling sejajar sumbu (lengkung, mis. "Gedung Setengah
 * Bundar FT": ekstrusi K12 lebih setia), atau tidak ada massa yang cukup lebar.
 * Murni (tanpa three).
 */
import { cleanRing, pointInPolygon, polygonArea } from '../../geo/polygon.js';
import { dominantYaw, normalizeYaw, toLocal, toWorld } from './obb.js';

export const DECOMPOSE = Object.freeze({
  maxMasses: 4, snaps: Object.freeze([0.6, 1.5, 3.5]), minCoverage: 0.9, maxOvershoot: 1.08, minSide: 2.5,
  minOrthogonal: 0.75, orthoTolDeg: 8,
});

/** Fraksi keliling (0..1) yang sisinya sejajar sumbu frame lokal (± tolDeg). Lengkung/miring → rendah. */
export function orthogonalFraction(local, tolDeg = DECOMPOSE.orthoTolDeg) {
  const tol = Math.sin((tolDeg * Math.PI) / 180);
  let ok = 0;
  let all = 0;
  for (let i = 0, n = local.length; i < n; i += 1) {
    const [ax, az] = local[i];
    const [bx, bz] = local[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-9) continue;
    all += len;
    if (Math.min(Math.abs(bx - ax), Math.abs(bz - az)) / len <= tol) ok += len;
  }
  return all > 0 ? ok / all : 0;
}

/** Nilai unik terurut; nilai berurutan berjarak < snap digabung ke rata-ratanya. */
export function snapValues(values, snap) {
  const sorted = [...values].sort((a, b) => a - b);
  const groups = [];
  for (const v of sorted) {
    const g = groups[groups.length - 1];
    if (g && v - g.last < snap) {
      g.sum += v;
      g.n += 1;
      g.last = v;
    } else groups.push({ sum: v, n: 1, last: v });
  }
  return groups.map((g) => g.sum / g.n);
}

/** Grid sel terisi (Uint8Array baris-mayor j*nx+i) di frame lokal. */
function fillGrid(local, xs, zs) {
  const nx = xs.length - 1;
  const nz = zs.length - 1;
  const filled = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cz = (zs[j] + zs[j + 1]) / 2;
      filled[j * nx + i] = pointInPolygon(cx, cz, local) ? 1 : 0;
    }
  }
  return { nx, nz, filled };
}

/** Persegi panjang sel bebas (terisi & belum tertutup) dengan luas m² terbesar. */
function largestRect(grid, covered, xs, zs) {
  const { nx, nz, filled } = grid;
  const free = (i, j) => filled[j * nx + i] === 1 && covered[j * nx + i] === 0;
  let best = null;
  for (let j0 = 0; j0 < nz; j0 += 1) {
    for (let i0 = 0; i0 < nx; i0 += 1) {
      if (!free(i0, j0)) continue;
      let maxI = nx - 1;
      for (let j1 = j0; j1 < nz; j1 += 1) {
        let i1 = i0;
        while (i1 <= maxI && free(i1, j1)) i1 += 1;
        maxI = i1 - 1;
        if (maxI < i0) break;
        const area = (xs[maxI + 1] - xs[i0]) * (zs[j1 + 1] - zs[j0]);
        if (!best || area > best.area + 1e-9) best = { i0, i1: maxI, j0, j1, area };
      }
    }
  }
  return best;
}

/**
 * @param {Array<[number, number]>} ring ring dunia
 * @param {{cx:number, cz:number, w:number, d:number, yaw:number}} obb OBB ring (computeObb)
 * @param {Partial<typeof DECOMPOSE>} [opts]
 * @returns {{masses: Array<{cx:number, cz:number, w:number, d:number, yaw:number}>, coverage:number}|null}
 */
export function decomposeFootprint(ring, obb, opts = {}) {
  const cfg = { ...DECOMPOSE, ...opts };
  const clean = cleanRing(ring ?? []);
  if (clean.length < 3) return null;
  const dom = { cx: obb.cx, cz: obb.cz, yaw: dominantYaw(clean) };
  const sameAxis = Math.abs(Math.sin(2 * (dom.yaw - obb.yaw))) < Math.sin((2 * Math.PI) / 180);
  const frames = sameAxis ? [obb] : [dom, obb];
  for (const frame of frames) {
    const local = clean.map(([x, z]) => {
      const p = toLocal(frame, x, z);
      return [p.x, p.z];
    });
    if (orthogonalFraction(local, cfg.orthoTolDeg) < cfg.minOrthogonal) continue; // lengkung → K12 ekstrusi
    for (const snap of cfg.snaps) {
      const result = decomposeLocal(local, frame, snap, cfg);
      if (result) return result;
    }
  }
  return null;
}

/** Satu percobaan dekomposisi pada ring lokal dengan toleransi `snap`; null bila gagal. */
function decomposeLocal(local, obb, snap, cfg) {
  const total = polygonArea(local);
  const xs = snapValues(local.map((p) => p[0]), snap);
  const zs = snapValues(local.map((p) => p[1]), snap);
  if (xs.length < 2 || zs.length < 2 || !(total > 0)) return null;
  const grid = fillGrid(local, xs, zs);
  const covered = new Uint8Array(grid.filled.length);
  const rects = [];
  while (rects.length < cfg.maxMasses) {
    const r = largestRect(grid, covered, xs, zs);
    if (!r) break;
    for (let j = r.j0; j <= r.j1; j += 1) for (let i = r.i0; i <= r.i1; i += 1) covered[j * grid.nx + i] = 1;
    rects.push({ x0: xs[r.i0], x1: xs[r.i1 + 1], z0: zs[r.j0], z1: zs[r.j1 + 1], area: r.area });
  }
  const filledArea = rects.reduce((s, r) => s + r.area, 0);
  const kept = rects.filter((r) => Math.min(r.x1 - r.x0, r.z1 - r.z0) >= cfg.minSide);
  const coverage = kept.reduce((s, r) => s + r.area, 0) / total;
  if (kept.length === 0 || coverage < cfg.minCoverage || filledArea > total * cfg.maxOvershoot) return null;
  const masses = kept
    .sort((a, b) => b.area - a.area)
    .map((r) => {
      const c = toWorld(obb, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
      const lw = r.x1 - r.x0;
      const ld = r.z1 - r.z0;
      return lw >= ld
        ? { cx: c.x, cz: c.z, w: lw, d: ld, yaw: obb.yaw }
        : { cx: c.x, cz: c.z, w: ld, d: lw, yaw: normalizeYaw(obb.yaw + Math.PI / 2) };
    });
  return { masses, coverage };
}
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/kit/decompose.test.js`
Expected: 8 tes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/kit/decompose.js tests/kit/decompose.test.js
```
```bash
git commit -m "feat(kit): dekomposisi footprint ke maks 4 massa (snap bertingkat, frame sisi dominan)"
```

---

## Task 5: planBuilding — grammar fasad murni (TDD)

**Files:**
- Test: `tests/kit/planBuilding.test.js`
- Create: `src/world/kit/planGeom.js`, `src/world/kit/planRules.js`, `src/world/kit/planBuilding.js`

Ringkasan grammar (spec §7.2): (1) footprint → OBB → rasio < 0,85 → dekomposisi → gagal/berlubang → massa poligon K12 (fasad dilukis); (2) lantai `floors × floorH` (lantai dasar `floorH`, atas `upperH`), `baseY = median(tanah di sudut + centroid) + 0,15`; (3) sisi selasar = sisi panjang dengan normal paling searah `front` (dari ground M2); dinding mundur sedalam selasar, atau 0,5 m (atap miring; footprint OSM = garis atap); sisi yang bersinggungan massa lain tidak dimundurkan & tidak diberi bay (sampel tiap 0,5 m); bay `n = round(len/bay)`; (4) bukaan per bay per lantai: pola pintu `kelas` (pintu tiap 3 bay = satu ruang kelas ±10,8 m), `ganda`, `tunggal`, `lobi`, `gulung`, `unit`; jendela `nako|jalusi-kayu|kaca-biru` (30 % gedung pakai jendela alternatif), roster di atas jendela & pintu, AC luar (sisi non-selasar), clerestory K04, ventilasi atas K05, layar perforasi K03 lantai ≥ 1, balkon berjemuran K09, lubang/bata/coretan K10; (5) atap per massa; (6) seed `hashId(id)` → warna ±3 %, jenis jendela, pola roster, noda, karat, nyala malam (per arketipe: rusun 60 %, ADB 50 %, kuliah 15 %), tirai 30 %.

- [ ] **Step 1: Tulis tes**

`tests/kit/planBuilding.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { planBuilding, footprintMasses, ROOF_PITCH } from '../../src/world/kit/planBuilding.js';
import { corridorFaces, median, PLAN } from '../../src/world/kit/planGeom.js';
import { doorKind, windowRect, rosterRect } from '../../src/world/kit/planRules.js';
import { hashId } from '../../src/world/kit/archetypes.js';

const RECT = [[0, 0], [46.4, 0], [46.4, 14.7], [0, 14.7]]; // ±"Gedung A FKIP (PPKN)" 46,4 × 14,7 m
const L_SHAPE = [[0, 0], [40, 0], [40, 14], [14, 14], [14, 40], [0, 40]];
const CURVED = Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * Math.PI * 2) * 40, Math.sin((i / 16) * Math.PI * 2) * 40]);
const base = (over = {}) => ({ id: 'w282225412', ring: RECT, levels: 1, archetype: 'K01', overrides: {}, front: [0, 1], groundY: () => 30, ...over });
const face = (plan, id, m = 0) => plan.masses[m].faces.find((f) => f.id === id);

describe('planBuilding — K01 kuliah-koridor', () => {
  const plan = planBuilding(base());

  it('satu massa, 1 lantai 3,8 m, baseY = median tanah + 0,15', () => {
    expect(plan.masses).toHaveLength(1);
    expect(plan.kit).toBe('K01');
    expect(plan.fallback).toBeNull();
    expect(plan.floors).toBe(1);
    expect(plan.floorH).toEqual([3.8]);
    expect(plan.height).toBeCloseTo(3.8, 9);
    expect(plan.baseY).toBeCloseTo(30 + PLAN.plinthLift, 9);
  });

  it('selasar 2,4 m di sisi panjang yang menghadap jalan (+z = selatan)', () => {
    expect(plan.corridor).toEqual({ side: '+z', faces: ['+z'], depth: 2.4 });
    expect(face(plan, '+z').role).toBe('selasar');
  });

  it('dinding mundur: sisi panjang 46,4 − 2×0,5 = 45,4 m → 13 bay; sisi pendek 14,7 − 2,4 − 0,5 = 11,8 m → 3 bay', () => {
    expect(face(plan, '+z').len).toBeCloseTo(45.4, 6);
    expect(face(plan, '-z').bays).toBe(13);
    expect(face(plan, '+z').bays).toBe(13);
    expect(face(plan, '+x').len).toBeCloseTo(11.8, 6);
    expect(face(plan, '+x').bays).toBe(3);
    expect(plan.bays).toHaveLength(13 + 3 + 13 + 3);
  });

  it('pola kelas: pintu di bay 0,3,6,9,12 sisi selasar; jendela + roster di bay lain', () => {
    const ops = plan.openings.filter((o) => o.face === '+z');
    const doors = ops.filter((o) => o.kind === 'pintu');
    expect(doors).toHaveLength(5);
    expect(ops.filter((o) => o.kind === 'jendela')).toHaveLength(8);
    expect(ops.filter((o) => o.kind === 'roster')).toHaveLength(13);
    for (const d of doors) expect(d.y0).toBe(0);
  });

  it('atap pelana 25°, tritisan 1 m; papan nama timbul hanya bila ada teks', () => {
    expect(plan.roof).toEqual({ type: 'pelana', pitch: 25, overhang: 1, parapet: 0 });
    expect(plan.signs).toEqual([]);
    const signed = planBuilding(base({ overrides: { sign: 'GEDUNG A FKIP' } }));
    expect(signed.signs).toHaveLength(1);
    expect(signed.signs[0]).toMatchObject({ text: 'GEDUNG A FKIP', style: 'timbul', face: '+z', h: 0.5 });
  });

  it('deterministik: input sama → plan identik; id lain → seed lain', () => {
    expect(planBuilding(base())).toEqual(plan);
    expect(plan.seed).toBe(hashId('w282225412'));
    expect(planBuilding(base({ id: 'w1' })).seed).not.toBe(plan.seed);
  });

  it('jalan di utara → selasar di −z; lantai dibatasi maxLevels (K01 = 4)', () => {
    expect(planBuilding(base({ front: [0, -1] })).corridor.faces).toEqual(['-z']);
    const tall = planBuilding(base({ levels: 7 }));
    expect(tall.floors).toBe(4);
    expect(tall.floorH).toEqual([3.8, 3.6, 3.6, 3.6]);
  });

  it('baseY = median tanah di sudut + centroid (lereng)', () => {
    const p = planBuilding(base({ groundY: (x) => x * 0.1 }));
    expect(p.baseY).toBeCloseTo(median([0, 4.64, 4.64, 0, 2.32]) + 0.15, 9);
    expect(p.footY).toBeCloseTo(-0.25, 9);
  });
});

describe('planBuilding — dekomposisi & cadangan K12', () => {
  it('L → dua massa; sisi dalam tidak dimundurkan dan tanpa bay di bagian tertutup', () => {
    const p = planBuilding(base({ ring: L_SHAPE, id: 'w-l' }));
    expect(p.masses).toHaveLength(2);
    expect(p.fallback).toBeNull();
    const zeroInset = p.masses.some((m) => Object.values(m.insets).some((v) => v === 0));
    expect(zeroInset).toBe(true);
  });

  it('lengkung → K12 poligon, atap datar-parapet, hanya pintu (fasad dilukis)', () => {
    const p = planBuilding(base({ ring: CURVED, id: 'w-c', archetype: 'K01', levels: 3 }));
    expect(p.kit).toBe('K12');
    expect(p.archetype).toBe('K01');
    expect(p.fallback).toMatch(/dekomposisi gagal/);
    expect(p.masses[0].kind).toBe('poligon');
    expect(p.roof.type).toBe('datar-parapet');
    expect(new Set(p.openings.map((o) => o.kind))).toEqual(new Set(['pintu']));
  });

  it('footprint berlubang → K12', () => {
    expect(footprintMasses(RECT, [[[10, 5], [12, 5], [12, 7], [10, 7]]]).reason).toBe('footprint berlubang');
  });
});

describe('planBuilding — arketipe lain', () => {
  it('K02: ornamen teras berkanopi, tangga, tiang bendera, 2 pot', () => {
    const p = planBuilding(base({ archetype: 'K02', levels: 2, overrides: { sign: 'DEKANAT' } }));
    const ids = p.ornaments.map((o) => o.assetId);
    expect(ids).toEqual(expect.arrayContaining(['teras-kanopi', 'tangga-tengah', 'tiang-bendera']));
    expect(ids.filter((x) => x === 'pot')).toHaveLength(2);
    expect(p.roof.type).toBe('limas');
  });

  it('K03: lantai atas sisi selasar berlayar perforasi di bidang luar (depan kolom), papan panel', () => {
    const p = planBuilding(base({ archetype: 'K03', levels: 3, ring: [[0, 0], [50, 0], [50, 24], [0, 24]], overrides: { variant: 'wajik', sign: 'HEALTH SCIENCES CENTER' } }));
    const layar = p.openings.filter((o) => o.layar);
    expect(layar.length).toBeGreaterThan(0);
    expect(layar.every((o) => o.floor >= 1)).toBe(true);
    expect(layar.filter((o) => o.face === '+z').every((o) => o.screenOut === p.corridor.depth + 0.3)).toBe(true);
    expect(p.signs[0].style).toBe('panel');
    expect(p.variant).toBe('wajik');
    expect(p.roof).toMatchObject({ type: 'pelana-lebar', pitch: ROOF_PITCH['pelana-lebar'], overhang: 2.5 });
  });

  it('K10: tanpa kaca — hanya lubang & isian bata; ilalang di sekeliling', () => {
    const p = planBuilding(base({ archetype: 'K10', levels: 3, overrides: { variant: 'rangka' } }));
    expect(new Set(p.openings.map((o) => o.kind))).toEqual(new Set(['lubang', 'bata']));
    expect(p.ornaments.every((o) => o.assetId === 'ilalang')).toBe(true);
    expect(p.corridor.faces).toEqual([]);
  });

  it('K09: selasar depan (pintu unit) + balkon belakang + 2 tandon', () => {
    const p = planBuilding(base({ archetype: 'K09', levels: 5, ring: [[0, 0], [69, 0], [69, 23], [0, 23]] }));
    expect(p.floors).toBe(5);
    expect(p.openings.some((o) => o.kind === 'balkon')).toBe(true);
    expect(p.ornaments.filter((o) => o.assetId === 'tandon')).toHaveLength(2);
    expect(p.roof.type).toBe('datar-parapet');
  });

  it('hero: arketipe dipertahankan, geometri dari pengganti (student-center → K03)', () => {
    const p = planBuilding(base({ archetype: 'hero:student-center', levels: 3 }));
    expect(p.archetype).toBe('hero:student-center');
    expect(p.kit).toBe('K03');
  });
});

describe('aturan bukaan (murni)', () => {
  it('windowRect: lebar = bay − 2×0,45 (maks 2,4); bay sempit → null', () => {
    expect(windowRect(3.6, 3.8)).toEqual({ w: 2.4, y0: 0.9, y1: 2.6 });
    expect(windowRect(3.0, 3.8).w).toBeCloseTo(2.1, 9);
    expect(windowRect(1.5, 3.8)).toBeNull();
  });

  it('rosterRect butuh ≥ 0,25 m di atas kepala jendela', () => {
    const r = rosterRect(2, 2.6, 3.8);
    expect(r.w).toBe(2);
    expect(r.y0).toBeCloseTo(2.8, 9);
    expect(r.y1).toBeCloseTo(3.35, 9);
    expect(rosterRect(2, 2.6, 3.0)).toBeNull();
  });

  it('doorKind: kelas tiap 3 bay di selasar; ganda di tengah depan lantai dasar', () => {
    const sel = { role: 'selasar' };
    expect([0, 1, 2, 3].map((i) => doorKind('kelas', sel, 0, i, 13))).toEqual(['pintu', null, null, 'pintu']);
    expect(doorKind('ganda', { role: 'depan' }, 0, 2, 5)).toBe('pintu-ganda');
    expect(doorKind('ganda', { role: 'depan' }, 1, 2, 5)).toBeNull();
  });

  it('corridorFaces: keliling/dua/tidak', () => {
    const obb = { yaw: 0 };
    expect(corridorFaces('keliling', obb, null)).toEqual(['-z', '+x', '+z', '-x']);
    expect(corridorFaces('dua', obb, null)).toEqual(['-z', '+z']);
    expect(corridorFaces('tidak', obb, null)).toEqual([]);
    expect(corridorFaces('belakang', obb, [0, 1])).toEqual(['-z']);
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/kit/planBuilding.test.js`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: `planGeom.js`**

`src/world/kit/planGeom.js`:
```js
/**
 * Geometri murni grammar fasad (dipakai planBuilding & planRules): massa kotak/poligon, sisi dinding,
 * sisi luar vs dalam antar-massa, bay, peran sisi. Konvensi sisi: `a` = ujung kiri dilihat dari luar,
 * `b` = kanan, normal luar n = (−Rz, Rx) dengan R = (b − a)/len. Massa kotak berurutan '-z', '+x', '+z',
 * '-x' (frame lokal OBB). Murni (tanpa three).
 */
import { cleanRing, orientRing, pointInPolygon } from '../../geo/polygon.js';
import { computeObb, toWorld } from './obb.js';

export const PLAN = Object.freeze({
  plinthLift: 0.15,        // lantai di atas median tanah (spec §7.2 langkah 2)
  minCorridorDepth: 7,     // massa lebih sempit (sisi pendek) tidak diberi selasar
  minWall: 2,              // sisi kotak dinding minimum setelah dimundurkan
  eaveInset: 0.5,          // dinding mundur dari tepi footprint pada atap miring (footprint OSM = garis atap)
  parapetH: 0.9,
  sample: 0.5,             // langkah sampel sisi luar/dalam (m)
  probe: 0.4,              // jarak uji keluar dari sisi untuk deteksi sisi dalam antar-massa
  minBayFace: 1.2,         // interval luar lebih pendek tidak diberi bay
  litChance: Object.freeze({ K01: 0.15, K02: 0.35, K03: 0.5, K04: 0.2, K05: 0.1, K06: 0.4, K09: 0.6, K11: 0.5, K12: 0.25 }),
  tiraiChance: 0.3,
  signMaxW: 14,
});

export const FACE_IDS = Object.freeze(['-z', '+x', '+z', '-x']);

/** Median (salinan terurut); 0 untuk array kosong. */
export function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/** Tinggi lantai per tingkat: [lantai dasar, atas, atas, …]. */
export function floorHeights(arch, floors) {
  return Array.from({ length: floors }, (_, i) => (i === 0 ? arch.floorH : arch.upperH));
}

/** Sisi dinding dari titik kiri `a` ke kanan `b` (dilihat dari luar). */
export function makeFace(id, a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const rx = (b[0] - a[0]) / len;
  const rz = (b[1] - a[1]) / len;
  return { id, a, b, n: [-rz, rx], len, role: 'sisi', exterior: [[0, len]], bays: 0, dot: 0 };
}

/** Titik pada sisi sejauh u dari a, digeser `out` meter keluar (normal). */
export function facePoint(face, u, out = 0) {
  const t = u / face.len;
  return [
    face.a[0] + (face.b[0] - face.a[0]) * t + face.n[0] * out,
    face.a[1] + (face.b[1] - face.a[1]) * t + face.n[1] * out,
  ];
}

/** Yaw three.js yang membuat +Z lokal objek menghadap normal luar sisi. */
export function faceYaw(face) {
  return Math.atan2(face.n[0], face.n[1]);
}

export const exteriorLength = (face) => face.exterior.reduce((s, [a, b]) => s + (b - a), 0);

/** Interval [u0,u1] sisi yang menghadap luar (tidak tertutup footprint massa lain). */
export function exteriorIntervals(face, others) {
  if (others.length === 0) return [[0, face.len]];
  const n = Math.max(1, Math.round(face.len / PLAN.sample));
  const step = face.len / n;
  const out = [];
  let start = null;
  for (let i = 0; i < n; i += 1) {
    const [px, pz] = facePoint(face, (i + 0.5) * step, PLAN.probe);
    const covered = others.some((ring) => pointInPolygon(px, pz, ring));
    if (!covered && start === null) start = i * step;
    if (covered && start !== null) {
      out.push([start, i * step]);
      start = null;
    }
  }
  if (start !== null) out.push([start, face.len]);
  return out;
}

/** Ring footprint OBB (dunia, positif). */
export function obbRing(obb) {
  const c = [[-obb.w / 2, -obb.d / 2], [obb.w / 2, -obb.d / 2], [obb.w / 2, obb.d / 2], [-obb.w / 2, obb.d / 2]];
  return c.map(([x, z]) => {
    const p = toWorld(obb, x, z);
    return [p.x, p.z];
  });
}

/** Normal luar dunia sisi lokal OBB. */
export function localNormal(id, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const v = { '-z': [0, -1], '+x': [1, 0], '+z': [0, 1], '-x': [-1, 0] }[id];
  return [v[0] * c + v[1] * s, -v[0] * s + v[1] * c];
}

/** Sisi selasar lokal menurut corridorSide & arah ke jalan terdekat `front` ([fx,fz] satuan). */
export function corridorFaces(side, obb, front) {
  if (side === 'tidak') return [];
  if (side === 'keliling') return [...FACE_IDS];
  if (side === 'dua') return ['-z', '+z'];
  const f = front ?? [0, 1];
  const dot = (id) => {
    const n = localNormal(id, obb.yaw);
    return n[0] * f[0] + n[1] * f[1];
  };
  const toward = dot('+z') >= dot('-z') ? '+z' : '-z';
  if (side === 'belakang') return [toward === '+z' ? '-z' : '+z'];
  return [toward];
}

/** Empat sisi kotak dinding dari mundur per sisi (insets). */
function wallBox(obb, insets) {
  const x0 = -obb.w / 2 + insets['-x'];
  const x1 = obb.w / 2 - insets['+x'];
  const z0 = -obb.d / 2 + insets['-z'];
  const z1 = obb.d / 2 - insets['+z'];
  const w = (x, z) => {
    const p = toWorld(obb, x, z);
    return [p.x, p.z];
  };
  const A = w(x0, z0);
  const B = w(x1, z0);
  const C = w(x1, z1);
  const D = w(x0, z1);
  // tepi ring positif p_i → p_{i+1}; ujung kiri dari luar = p_{i+1}
  return { faces: [makeFace('-z', B, A), makeFace('+x', C, B), makeFace('+z', D, C), makeFace('-x', A, D)], wall: { x0, x1, z0, z1 } };
}

/**
 * Massa kotak: footprint OBB, sisi dalam (bersinggungan massa lain) tanpa mundur & tanpa selasar,
 * selasar di sisi luar terpilih, dinding mundur sedalam selasar / tritisan.
 */
export function boxMass(obb, arch, corridorSide, front, others, pitched) {
  const want = obb.d >= PLAN.minCorridorDepth ? corridorFaces(corridorSide, obb, front) : [];
  const zero = { '-z': 0, '+x': 0, '+z': 0, '-x': 0 };
  const probe = wallBox(obb, zero);
  const inner = new Set();
  for (const f of probe.faces) {
    f.exterior = exteriorIntervals(f, others);
    if (exteriorLength(f) < 0.5 * f.len) inner.add(f.id);
  }
  let corridor = want.filter((id) => !inner.has(id) && exteriorLength(probe.faces[FACE_IDS.indexOf(id)]) > 0.9 * obb.w);
  const eave = pitched ? Math.min(PLAN.eaveInset, arch.roof.overhang / 2) : 0;
  const insetFor = (id) => (inner.has(id) ? 0 : corridor.includes(id) ? arch.corridor.depth : eave);
  let insets = Object.fromEntries(FACE_IDS.map((id) => [id, insetFor(id)]));
  let built = wallBox(obb, insets);
  if (built.wall.x1 - built.wall.x0 < PLAN.minWall || built.wall.z1 - built.wall.z0 < PLAN.minWall) {
    corridor = [];
    insets = Object.fromEntries(FACE_IDS.map((id) => [id, insetFor(id)]));
    built = wallBox(obb, insets);
  }
  for (const f of built.faces) f.exterior = exteriorIntervals(f, others);
  return {
    kind: 'kotak', obb, ring: obbRing(obb), wall: built.wall, faces: built.faces, insets,
    corridor: { faces: corridor, depth: corridor.length ? arch.corridor.depth : 0 },
  };
}

/** Massa poligon (K12): sisi = tepi ring (dunia, positif), tanpa selasar. */
export function polygonMass(ring, holes = []) {
  const outer = orientRing(cleanRing(ring), true);
  const inner = holes.map((h) => orientRing(cleanRing(h), false)).filter((h) => h.length >= 3);
  const edges = (r, tag) => r.map((p, i) => makeFace(`${tag}${i}`, r[(i + 1) % r.length], p)).filter((f) => f.len > 0.05);
  const faces = [...edges(outer, 'e'), ...inner.flatMap((h, k) => edges(h, `h${k}-`))];
  return { kind: 'poligon', obb: computeObb(outer), ring: outer, holes: inner, faces, insets: null, corridor: { faces: [], depth: 0 } };
}

/** Bay per interval luar: n = round(len / bay), lebar dibagi rata (spec §7.2 langkah 3). */
export function makeBays(face, bay) {
  const out = [];
  for (const [s, e] of face.exterior) {
    const len = e - s;
    if (len < PLAN.minBayFace) continue;
    const n = Math.max(1, Math.round(len / bay));
    for (let i = 0; i < n; i += 1) out.push({ u0: s + (len * i) / n, u1: s + (len * (i + 1)) / n });
  }
  face.bays = out.length;
  return out;
}

/** Peran sisi: 'selasar' | 'depan' (paling menghadap jalan) | 'belakang' | 'sisi'. */
export function assignRoles(mass, front) {
  const f = front ?? [0, 1];
  let best = null;
  for (const face of mass.faces) {
    face.dot = face.n[0] * f[0] + face.n[1] * f[1];
    if (exteriorLength(face) > 1 && (!best || face.dot > best.dot)) best = face;
  }
  const corr = mass.corridor.faces;
  for (const face of mass.faces) {
    if (corr.includes(face.id)) face.role = 'selasar';
    else if (corr.length === 0 && face === best) face.role = 'depan';
    else if (best && face.dot < -0.7) face.role = 'belakang';
    else face.role = 'sisi';
  }
}

/** Sisi utama massa (papan nama, ornamen depan): selasar/depan yang paling menghadap jalan. */
export function primaryFace(mass) {
  const cands = mass.faces.filter((f) => f.role === 'selasar' || f.role === 'depan');
  const list = cands.length ? cands : mass.faces;
  return list.reduce((best, f) => (f.dot > best.dot ? f : best), list[0]);
}
```

- [ ] **Step 4: `planRules.js`**

`src/world/kit/planRules.js`:
```js
/**
 * Aturan grammar per arketipe (spec §7.1–7.2 langkah 4): bukaan per bay per lantai, papan nama, ornamen.
 * Murni (tanpa three); dipanggil planBuilding dengan rng berurutan (deterministik). Satuan meter.
 * Bukaan: { mass, face, floor, u0, u1, y0, y1, kind, cell, lit, ac, layar? } — y relatif lantai `floor`.
 */
import { PLAN, facePoint, faceYaw, primaryFace } from './planGeom.js';

export const OPENING = Object.freeze({
  sill: 0.9, head: 2.6, minWindow: 0.8, maxWindow: 2.4, jamb: 0.45,
  door: Object.freeze({ w: 1.0, h: 2.2 }), doubleDoor: Object.freeze({ w: 1.8, h: 2.5 }),
  rosterGap: 0.2, rosterMax: 0.55, rosterTopGap: 0.35,
});

/** Lebar & tinggi jendela utama dalam bay. null bila bay terlalu sempit. */
export function windowRect(bayW, floorH) {
  const w = Math.min(OPENING.maxWindow, bayW - 2 * OPENING.jamb);
  if (w < OPENING.minWindow) return null;
  return { w, y0: OPENING.sill, y1: Math.min(OPENING.head, floorH - 0.9) };
}

/** Roster (lubang angin) di atas jendela/pintu bila ruang cukup. */
export function rosterRect(w, headY, floorH) {
  const y0 = headY + OPENING.rosterGap;
  const y1 = Math.min(floorH - OPENING.rosterTopGap, y0 + OPENING.rosterMax);
  return y1 - y0 >= 0.25 ? { w, y0, y1 } : null;
}

const center = (bay, w) => {
  const c = (bay.u0 + bay.u1) / 2;
  return [c - w / 2, c + w / 2];
};

/** Sel atlas jendela menurut tipe + nyala/tirai. */
function windowCell(type, lit, tirai) {
  if (type === 'kaca-biru') return lit ? 'kaca-biru-nyala' : 'kaca-biru';
  if (type === 'jalusi-kayu' || type === 'jalusi-alu') return type;
  if (lit) return 'nako-nyala';
  return tirai ? 'nako-tirai' : 'nako';
}

/** Pintu untuk bay ini menurut pola arketipe; null bila bay berjendela. */
export function doorKind(pattern, face, floor, i, n) {
  const mid = Math.floor(n / 2);
  const front = face.role === 'selasar' || face.role === 'depan';
  switch (pattern) {
    case 'kelas': return front && i % 3 === 0 && (face.role === 'selasar' || floor === 0) ? 'pintu' : null;
    case 'ganda': return front && floor === 0 && i === mid ? 'pintu-ganda' : null;
    case 'tunggal': return face.role === 'depan' && floor === 0 && i === mid ? 'pintu' : null;
    case 'lobi': return front && floor === 0 && (i === mid || (n % 2 === 0 && i === mid - 1)) ? 'pintu-kaca' : null;
    case 'gulung':
      if (floor === 0 && face.role === 'sisi' && i === mid) return 'pintu-gulung';
      return face.role === 'depan' && floor === 0 && i === mid ? 'pintu' : null;
    default: return null;
  }
}

/**
 * Bukaan satu bay. ctx: { arch, variant, style, rng, face, floor, floorH, bay, i, n, mass }.
 * @returns {object[]}
 */
export function bayOpenings(ctx) {
  const { arch, face, floor, floorH, bay, i, n } = ctx;
  const bayW = bay.u1 - bay.u0;
  const base = { mass: ctx.mass, face: face.id, floor };
  const out = [];
  const push = (o) => out.push({ ...base, lit: false, ac: false, ...o });
  if (arch.id === 'K07' || bayW < 1.2) return out;
  if (arch.id === 'K12') { // fasad dilukis: hanya pintu nyata
    const door = doorKind('tunggal', face, floor, i, n);
    if (door) {
      const [u0, u1] = center(bay, OPENING.door.w);
      push({ u0, u1, y0: 0, y1: OPENING.door.h, kind: 'pintu', cell: 'pintu-kayu' });
    }
    return out;
  }
  const special = { K10: mangkrakBay, K09: rusunBay, K03: adbBay }[arch.id];
  if (special) {
    special(ctx, push);
    return out;
  }
  const door = doorKind(arch.doors, face, floor, i, n);
  if (door) {
    const d = door === 'pintu-ganda' ? OPENING.doubleDoor : door === 'pintu-gulung'
      ? { w: Math.min(bayW - 0.6, 3.2), h: Math.min(floorH - 0.8, 3.4) } : OPENING.door;
    const [u0, u1] = center(bay, Math.min(d.w, bayW - 0.3));
    push({ u0, u1, y0: 0, y1: d.h, kind: door, cell: door === 'pintu' ? 'pintu-kayu' : door });
    if (arch.roster && door !== 'pintu-gulung') {
      const r = rosterRect(u1 - u0, d.h, floorH);
      if (r) push({ u0, u1, y0: r.y0, y1: r.y1, kind: 'roster', cell: `roster-${ctx.style.roster}` });
    }
    return out;
  }
  windowBay(ctx, push);
  return out;
}

/** Jendela + roster + AC luar (dinding biasa). */
function windowBay(ctx, push) {
  const { arch, face, floorH, bay, rng, style } = ctx;
  const bayW = bay.u1 - bay.u0;
  if (ctx.variant === 'toilet') {
    const [u0, u1] = center(bay, Math.min(1.2, bayW - 0.6));
    push({ u0, u1, y0: 1.8, y1: 2.4, kind: 'roster', cell: `roster-${style.roster}` });
    return;
  }
  const tall = arch.id === 'K05';
  const win = windowRect(bayW, floorH);
  if (!win) return;
  const w = ctx.variant === 'pos' ? Math.min(bayW - 0.5, 2.6) : win.w;
  const y1 = tall ? Math.min(4.2, floorH - 2.0) : win.y1;
  const y0 = tall ? 1.2 : ctx.variant === 'pos' ? 1.0 : win.y0;
  const lit = rng.chance(PLAN.litChance[arch.id] ?? 0.2);
  const tirai = rng.chance(PLAN.tiraiChance);
  const ac = face.role !== 'selasar' && rng.chance(arch.acChance);
  const [u0, u1] = center(bay, w);
  push({ u0, u1, y0, y1, kind: 'jendela', cell: windowCell(style.window, lit, tirai), lit, ac });
  if (arch.roster) {
    const r = rosterRect(w, y1, floorH);
    if (r) push({ u0, u1, y0: r.y0, y1: r.y1, kind: 'roster', cell: `roster-${style.roster}` });
  }
  if (arch.id === 'K04') {
    const [cu0, cu1] = center(bay, bayW - 0.6);
    push({ u0: cu0, u1: cu1, y0: floorH - 1.25, y1: floorH - 0.45, kind: 'clerestory', cell: 'clerestory' });
  }
  if (arch.id === 'K05') {
    const [vu0, vu1] = center(bay, bayW - 0.6);
    push({ u0: vu0, u1: vu1, y0: floorH - 1.1, y1: floorH - 0.45, kind: 'ventilasi', cell: 'jalusi-alu' });
  }
}

/** K03: lobi kaca di lantai dasar depan; pita kaca biru; lantai atas sisi depan/sisi dibungkus layar. */
function adbBay(ctx, push) {
  const { face, floor, floorH, bay, i, n, rng } = ctx;
  const bayW = bay.u1 - bay.u0;
  const door = doorKind('lobi', face, floor, i, n);
  if (door) {
    const [u0, u1] = center(bay, Math.min(bayW - 0.4, 3.0));
    push({ u0, u1, y0: 0, y1: 2.7, kind: 'pintu-kaca', cell: 'pintu-kaca' });
    return;
  }
  const lit = rng.chance(PLAN.litChance.K03);
  const [u0, u1] = center(bay, bayW - 0.5);
  const layar = floor >= 1 && (face.role === 'selasar' || face.role === 'depan' || (face.role === 'sisi' && i % 2 === 0));
  const screenOut = face.role === 'selasar' ? ctx.corridorDepth + 0.3 : 0.45; // layar di bidang luar (depan kolom)
  push({ u0, u1, y0: 0.9, y1: floorH - 0.8, kind: 'kaca-pita', cell: lit ? 'kaca-biru-nyala' : 'kaca-biru', lit, layar, screenOut, bayU0: bay.u0, bayU1: bay.u1 });
}

/** K09: sisi selasar = pintu unit + jendela kecil; belakang = pintu balkon + balkon berjemuran. */
function rusunBay(ctx, push) {
  const { face, bay, rng, floorH, style } = ctx;
  const bayW = bay.u1 - bay.u0;
  if (bayW < 2.6) return;
  if (face.role === 'selasar') {
    push({ u0: bay.u0 + 0.35, u1: bay.u0 + 1.25, y0: 0, y1: 2.1, kind: 'pintu', cell: 'pintu-kayu' });
    const lit = rng.chance(PLAN.litChance.K09);
    push({ u0: bay.u1 - 1.55, u1: bay.u1 - 0.35, y0: 1.0, y1: 2.1, kind: 'jendela', cell: windowCell('nako', lit, rng.chance(0.5)), lit });
    const r = rosterRect(1.2, 2.1, floorH);
    if (r) push({ u0: bay.u1 - 1.55, u1: bay.u1 - 0.35, y0: r.y0, y1: r.y1, kind: 'roster', cell: `roster-${style.roster}` });
    return;
  }
  if (face.role === 'belakang') {
    const lit = rng.chance(PLAN.litChance.K09);
    push({ u0: bay.u0 + 0.4, u1: bay.u0 + 1.3, y0: 0, y1: 2.1, kind: 'pintu', cell: lit ? 'nako-nyala' : 'pintu-kayu', lit });
    push({ u0: bay.u0 + 0.2, u1: bay.u1 - 0.2, y0: 0, y1: 1.05, kind: 'balkon', cell: 'railing', jemuran: rng.chance(0.65) });
    return;
  }
  const win = windowRect(bayW, floorH);
  if (win) {
    const lit = rng.chance(PLAN.litChance.K09);
    const [u0, u1] = center(bay, Math.min(win.w, 1.2));
    push({ u0, u1, y0: win.y0, y1: win.y1, kind: 'jendela', cell: windowCell('nako', lit, false), lit });
  }
}

/** K10: bay terbuka (rangka) atau diisi bata sebagian; tanpa kaca. */
function mangkrakBay(ctx, push) {
  const { bay, floorH, rng, floor } = ctx;
  const bata = rng.chance(floor === 0 ? 0.45 : 0.2);
  const coret = floor === 0 && rng.chance(0.4);
  push({ u0: bay.u0 + 0.2, u1: bay.u1 - 0.2, y0: 0, y1: floorH - 0.5, kind: bata ? 'bata' : 'lubang', cell: bata ? (coret ? 'beton-coret' : 'bata-merah') : 'gelap' });
}

/** Papan nama (N05): di balok selasar, kanopi K02, atau dinding atas pintu. */
export function planSign(text, arch, mass, floorH0) {
  if (!text || arch.signStyle === 'tidak') return null;
  const face = primaryFace(mass);
  if (!face || face.len < 3) return null;
  const h = arch.signStyle === 'panel' ? 0.9 : 0.5;
  const w = Math.min(PLAN.signMaxW, face.len * 0.7, text.length * h * 0.62 + h);
  const onBeam = face.role === 'selasar';
  const out = arch.id === 'K02' ? mass.corridor.depth + 3.0 + 0.06 : onBeam ? mass.corridor.depth + 0.06 : 0.06;
  const y = onBeam || arch.id === 'K02' ? floorH0 - 0.3 : Math.min(floorH0 - 0.5, 2.9);
  return { text, style: arch.signStyle, mass: 0, face: face.id, u: face.len / 2, y, out, w, h };
}

const T = (x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1) => ({ x, y, z, yaw, sx, sy, sz });

/**
 * Ornamen LOD0 per arketipe (spec §7.1 kolom "Ciri wajib"). transform dunia; y absolut.
 * @returns {Array<{assetId:string, transform:{x:number,y:number,z:number,yaw:number,sx:number,sy:number,sz:number}}>}
 */
export function planOrnaments(arch, variant, mass, baseY, height, rng, ground) {
  const out = [];
  const add = (assetId, t) => out.push({ assetId, transform: t });
  const front = primaryFace(mass);
  const yaw = faceYaw(front);
  const at = (u, outM) => facePoint(front, u, outM);
  const corr = mass.corridor.depth;
  if (arch.id === 'K02') {
    const [x, z] = at(front.len / 2, corr + 1.5);
    add('teras-kanopi', T(x, baseY, z, yaw, Math.min(8, front.len * 0.3), 1, 3));
    const [sx, sz] = at(front.len / 2, corr + 3.4);
    add('tangga-tengah', T(sx, ground, sz, yaw, Math.min(6, front.len * 0.22), baseY - ground + 0.3, 1.2));
    const [fx, fz] = at(front.len / 2 + Math.min(10, front.len * 0.35), corr + 7);
    add('tiang-bendera', T(fx, ground, fz, yaw));
    for (const s of [-1, 1]) {
      const [px, pz] = at(front.len / 2 + s * Math.min(4.6, front.len * 0.16), corr + 3.2);
      add('pot', T(px, ground, pz, yaw));
    }
  }
  if (arch.id === 'K04') {
    for (const f of mass.faces.filter((x) => x.role === 'sisi')) {
      const [x, z] = facePoint(f, f.len / 2 + 1.6, 0.02);
      add('exhaust', T(x, baseY + Math.min(height - 1.6, 3.6), z, faceYaw(f)));
    }
  }
  if (arch.id === 'K05') {
    const [x, z] = at(front.len / 2, 1.2);
    add('kanopi-masuk', T(x, baseY + 2.9, z, yaw, 3.6, 1, 2.4));
  }
  if (arch.id === 'K06') {
    const side = mass.faces[(mass.faces.indexOf(front) + 1) % mass.faces.length]; // sisi samping (tegak lurus depan)
    const [wx, wz] = facePoint(side, side.len / 2, corr + 0.4);
    add('tempat-wudu', T(wx, baseY, wz, faceYaw(side), Math.min(5, side.len * 0.6)));
    const [rx, rz] = at(front.len / 2 + 1.6, corr * 0.5);
    add('rak-sandal', T(rx, baseY, rz, yaw));
  }
  if (arch.id === 'K07' && variant !== 'parkir') {
    const back = mass.faces.find((f) => f.role === 'belakang') ?? mass.faces[(mass.faces.indexOf(front) + 2) % mass.faces.length];
    const [ex, ez] = facePoint(back, back.len / 2, -0.8);
    add('etalase', T(ex, baseY, ez, faceYaw(back) + Math.PI, Math.min(6, back.len * 0.5)));
    const rows = Math.max(1, Math.floor((mass.obb.d - 3) / 2.4));
    for (let r = 0; r < rows; r += 1) {
      const [mx, mz] = at(front.len / 2, -1.6 - r * 2.4);
      add('meja-bangku', T(mx, baseY, mz, yaw, Math.min(6, front.len - 2)));
    }
    const [bx, bz] = at(front.len / 2, 0.05);
    add('spanduk-menu', T(bx, baseY + height - 0.55, bz, yaw, Math.min(4, front.len * 0.5)));
  }
  if (arch.id === 'K09') {
    const { obb } = mass;
    for (const s of [-0.3, 0.3]) add('tandon', T(obb.cx + Math.cos(obb.yaw) * s * obb.w, baseY + height, obb.cz - Math.sin(obb.yaw) * s * obb.w, obb.yaw));
  }
  if (arch.id === 'K10') {
    const n = Math.max(4, Math.round(mass.faces.reduce((s, f) => s + f.len, 0) / 5));
    for (let k = 0; k < n; k += 1) {
      const f = mass.faces[k % mass.faces.length];
      const [x, z] = facePoint(f, rng.next() * f.len, 0.6 + rng.next() * 1.6);
      add('ilalang', T(x, ground, z, rng.next() * Math.PI * 2, 0.8 + rng.next() * 0.8));
    }
  }
  return out;
}
```

- [ ] **Step 5: `planBuilding.js`**

`src/world/kit/planBuilding.js`:
```js
/**
 * planBuilding (spec §4.6, §7.2): input gedung → BuildingPlan murni & deterministik (seed = hash(id)).
 * 1 footprint → OBB (PCA) → rasio < 0,85 → dekomposisi ≤ 4 massa → gagal/berlubang → massa poligon K12;
 * 2 lantai × tinggi lantai, baseY = median tanah di footprint + 0,15; 3 bay per sisi luar, selasar di sisi
 * panjang paling menghadap jalan; 4 bukaan per bay per lantai (planRules); 5 atap per massa; 6 variasi seed
 * (warna ±3%, jenis jendela, roster, noda, karat, nyala/tirai/AC). Tanpa three.
 */
import { createRandom } from '../siteutil/rng.js';
import { ROSTER_PATTERNS, VARIANTS, ARCHETYPES, geometryArchetype, hashId } from './archetypes.js';
import { computeObb, OBB_RECT_MIN } from './obb.js';
import { decomposeFootprint } from './decompose.js';
import { PLAN, assignRoles, boxMass, floorHeights, makeBays, median, obbRing, polygonMass } from './planGeom.js';
import { bayOpenings, planOrnaments, planSign } from './planRules.js';

export const ROOF_PITCH = Object.freeze({ pelana: 25, limas: 25, 'pelana-lebar': 15, 'limas-tumpang': 30, 'datar-parapet': 0, datar: 0 });
const FLAT = new Set(['datar-parapet', 'datar']);

/** Variasi per gedung dari rng (urutan tarikan tetap → deterministik). */
export function buildingStyle(arch, rng) {
  const tint = 1 + (rng.next() * 2 - 1) * 0.03;
  const altWindow = rng.chance(0.3);
  const roster = ROSTER_PATTERNS[Math.floor(rng.next() * ROSTER_PATTERNS.length)];
  const stain = rng.chance(0.35);
  const rust = rng.chance(0.25);
  return { tint, window: altWindow ? arch.windowAlt : arch.window, roster, stain, rust };
}

/** Massa dari footprint: [obb] bila persegi, hasil dekomposisi, atau null (→ K12 poligon). */
export function footprintMasses(ring, holes) {
  if (holes?.length) return { obbs: null, reason: 'footprint berlubang' };
  const obb = computeObb(ring);
  if (obb.rectangularity >= OBB_RECT_MIN) return { obbs: [obb], reason: null };
  const dec = decomposeFootprint(ring, obb);
  return dec ? { obbs: dec.masses, reason: null } : { obbs: null, reason: `dekomposisi gagal (rasio ${obb.rectangularity.toFixed(2)})` };
}

function roofFor(type, arch) {
  const pitch = type === arch.roof.type ? arch.roof.pitch : ROOF_PITCH[type] ?? 0;
  const overhang = FLAT.has(type) ? (type === 'datar' ? 0 : 0.3) : arch.roof.overhang;
  return { type, pitch, overhang, parapet: type === 'datar-parapet' ? PLAN.parapetH : 0 };
}

/** Tanah di footprint: median (lantai) & minimum (kaki plint). */
function groundStats(ring, groundY) {
  const pts = [...ring];
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  pts.push([cx, cz]);
  const ys = pts.map(([x, z]) => {
    const y = groundY(x, z);
    return Number.isFinite(y) ? y : 0;
  });
  return { med: median(ys), min: Math.min(...ys) };
}

function makeMasses(ring, holes, kitArch, resolved, front) {
  const fp = kitArch.id === 'K12' ? { obbs: null, reason: null } : footprintMasses(ring, holes);
  if (!fp.obbs) return { masses: [polygonMass(ring, holes)], reason: fp.reason, kit: ARCHETYPES.K12 };
  const pitched = !FLAT.has(resolved.roof);
  const masses = fp.obbs.map((obb, i) => {
    const others = fp.obbs.filter((_, j) => j !== i).map(obbRing);
    return boxMass(obb, kitArch, resolved.corridorSide, front, others, pitched);
  });
  return { masses, reason: null, kit: kitArch };
}

/**
 * @param {{id:string, ring:Array<[number,number]>, holes?:Array<Array<[number,number]>>, levels?:number|null,
 *   archetype:string, overrides?:{palette?:string, roof?:string, corridorSide?:string, sign?:string|null, variant?:string|null},
 *   seed?:number, groundY?:(x:number, z:number) => number, front?:[number,number]|null}} input
 * @returns {object} BuildingPlan (lihat plan M3 §"Bentuk BuildingPlan")
 */
export function planBuilding(input) {
  const { id, ring, holes = [], archetype, overrides = {}, groundY = () => 0, front = null } = input;
  const seed = input.seed ?? hashId(id);
  const rng = createRandom(seed);
  const arch = geometryArchetype(archetype);
  const resolved = {
    palette: overrides.palette ?? arch.palette,
    roof: overrides.roof ?? arch.roof.type,
    corridorSide: overrides.corridorSide ?? arch.corridor.side,
    sign: overrides.sign ?? null,
    variant: overrides.variant ?? VARIANTS[arch.id]?.[0] ?? null,
  };
  const style = buildingStyle(arch, rng);
  const { masses, reason, kit } = makeMasses(ring, holes, arch, resolved, front);
  const floors = Math.max(1, Math.min(input.levels ?? arch.levels, kit.maxLevels));
  const floorH = floorHeights(kit.id === 'K12' && arch.id !== 'K12' ? arch : kit, floors);
  const height = floorH.reduce((s, h) => s + h, 0);
  const ground = groundStats(masses[0].kind === 'poligon' ? masses[0].ring : ring, groundY);
  const baseY = ground.med + PLAN.plinthLift;
  const roofType = masses[0].kind === 'poligon' ? 'datar-parapet' : resolved.roof;
  const bays = [];
  const openings = [];
  const ruleArch = kit.id === 'K12' ? kit : arch;
  masses.forEach((mass, mi) => {
    Object.assign(mass, { floors, floorH, baseY, height, roof: roofFor(roofType, kit) });
    assignRoles(mass, front);
    for (const face of mass.faces) {
      const list = makeBays(face, kit.bay);
      list.forEach((bay, i) => {
        bays.push({ mass: mi, face: face.id, index: i, u0: bay.u0, u1: bay.u1 });
        for (let f = 0; f < floors; f += 1) {
          openings.push(...bayOpenings({ arch: ruleArch, variant: resolved.variant, style, rng, face, floor: f, floorH: floorH[f], bay, i, n: list.length, mass: mi, corridorDepth: mass.corridor.depth }));
        }
      });
    }
  });
  const sign = planSign(resolved.sign, arch.id === kit.id ? arch : kit, masses[0], floorH[0]);
  return {
    id, archetype, kit: kit.id, fallback: reason, seed, palette: resolved.palette, variant: resolved.variant, style,
    groundY: ground.med, footY: ground.min - 0.25, baseY, floors, floorH, height,
    masses, bays, openings,
    roof: masses[0].roof,
    corridor: { side: masses[0].corridor.faces[0] ?? null, faces: masses[0].corridor.faces, depth: masses[0].corridor.depth },
    signs: sign ? [sign] : [],
    ornaments: planOrnaments(kit, resolved.variant, masses[0], baseY, height, rng, ground.med),
  };
}
```

- [ ] **Step 6: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/kit`
Expected: 37 tes PASS (obb 9, decompose 8, planBuilding 20).

- [ ] **Step 7: Commit**

```bash
git add src/world/kit/planGeom.js src/world/kit/planRules.js src/world/kit/planBuilding.js tests/kit/planBuilding.test.js
```
```bash
git commit -m "feat(kit): planBuilding murni - massa, selasar, bay, bukaan per arketipe, atap, papan, ornamen"
```

---

## Task 6: Tabel override + resolveBuilding (TDD; tabel nyata lulus)

**Files:**
- Test: `tests/districts/resolveBuilding.test.js`
- Create: `src/districts/unri/buildings.data.js`, `src/districts/unri/resolveBuilding.js`

Override nyata (17). Ringkas: hero 6 (Rektorat T, Masjid T, GGM S, Sekretariat S, Student Center S, tribun Stadion Mini R); ADB berfoto 2 (IC T, HSC S); mangkrak 2 (FH T, Gedung Mangkrak FISIP S); Rusunawa T; Perpustakaan S (empat gedung dua lantai); Balai Bahasa (dinding bata 2 lt, bukan pendopo) S; 4 naungan "Area Parkir …" S. Semua berkolom `sumber` + `keyakinan`; bentuk tanpa foto ditandai [INF].

- [ ] **Step 1: Tulis tes**

`tests/districts/resolveBuilding.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveBuilding, validateOverrides, overrideErrors, parseLevelsTag, ruleArchetype, resetResolveWarnings, K01_VARIATION,
} from '../../src/districts/unri/resolveBuilding.js';
import { BUILDING_OVERRIDES } from '../../src/districts/unri/buildings.data.js';
import { ARCHETYPES, HERO_IDS, hashId } from '../../src/world/kit/archetypes.js';
import { HERO_BUILDERS } from '../../src/world/kit/hero/index.js';

const RING = [[0, 0], [40, 0], [40, 12], [0, 12]]; // 480 m²
const osm = (tags, extra = {}) => ({ id: 'w100', ring: RING, levels: null, tags, ...extra });
const arch = (tags, extra) => resolveBuilding(osm(tags, extra), undefined).archetype;
const quiet = { warn: () => {} };

describe('aturan default spec §4.7 (+ D1)', () => {
  it.each([
    ['Gedung Dekanat FISIP', {}, 'K02'],
    ['Laboratorium Kayu', {}, 'K04'],
    ['Lab. Fisika Bumi', {}, 'K04'],
    ['Kantin FKIP', {}, 'K07'],
    ['Musholla FKIP', {}, 'K06'],
    ['Musholah', {}, 'K06'],
    ['Pendopo FISIP', {}, 'K08'],
    ['Gedung Auditorium Sultan Balia FISIP', {}, 'K05'],
    ['Gelanggang Mahasiswa FISIP', {}, 'K05'],
    ['Gedung Mangkrak FISIP UNRI', { amenity: 'university' }, 'K10'],
    ['Gedung B - FISIP', {}, 'K01'],
    ['Gedung Kuliah FMIPA', {}, 'K01'],
    ['Integrated Classroom', {}, 'K01'],
    ['LPPM UNRI', { amenity: 'university' }, 'K01'],
  ])('%s → %s', (name, tags, expected) => {
    expect(arch({ name, building: 'yes', ...tags })).toBe(expected);
  });

  it('urutan: dekanat menang atas lab ("Lab Dekanat") dan atas gedung A–H', () => {
    expect(arch({ name: 'Lab Dekanat' })).toBe('K02');
    expect(arch({ name: 'Gedung A Dekanat' })).toBe('K02');
  });

  it('apartments → K09; luas < 60 → K11; tanpa padanan < 150 → K11; lainnya → K01 [D1]', () => {
    expect(arch({ building: 'apartments' })).toBe('K09');
    expect(resolveBuilding({ id: 'w1', ring: [[0, 0], [7, 0], [7, 5], [0, 5]], tags: { name: 'Gedung A' } }).archetype).toBe('K11');
    expect(resolveBuilding({ id: 'w1', ring: [[0, 0], [12, 0], [12, 10], [0, 10]], tags: {} }).archetype).toBe('K11');
    expect(arch({ building: 'yes' })).toBe('K01');
    expect(resolveBuilding(osm({ building: 'yes' })).keyakinan).toBe('rendah');
  });

  it('lantai: override → building:levels (rentang "4-7" → 4) → default arketipe, dibatasi maxLevels', () => {
    expect(parseLevelsTag('4-7')).toBe(4);
    expect(parseLevelsTag('2')).toBe(2);
    expect(parseLevelsTag('x')).toBeNull();
    expect(resolveBuilding(osm({ name: 'Gedung Dekanat', 'building:levels': '4-7' })).levels).toBe(4);
    expect(resolveBuilding(osm({ name: 'Gedung Dekanat' })).levels).toBe(ARCHETYPES.K02.levels);
    expect(resolveBuilding(osm({ name: 'Gedung C', 'building:levels': '9' })).levels).toBe(ARCHETYPES.K01.maxLevels);
    expect(resolveBuilding(osm({ name: 'Gedung C' }, { levels: 3 })).levels).toBe(3);
  });

  it('tag atap/dinding: roof=concrete → datar-parapet; roof=tile → genteng; walls=wood → kayu', () => {
    expect(resolveBuilding(osm({ name: 'Rumah susun', building: 'apartments', 'building:roof': 'concrete' })).roof).toBe('datar-parapet');
    expect(resolveBuilding(osm({ name: 'Gedung Dekanat FISIP', 'building:roof': 'tile' })).palette).toBe('krem-genteng');
    expect(resolveBuilding(osm({ name: 'Pendopo FISIP', 'building:walls': 'wood' })).palette).toBe('kayu');
  });

  it('variasi K01 [INF] dari hash id: limas & putih sesuai ambang', () => {
    const r = resolveBuilding(osm({ name: 'Gedung C' }, { id: 'w282225411' }));
    const h = hashId('w282225411');
    expect(r.roof).toBe(h % 100 < K01_VARIATION.limas ? 'limas' : 'pelana');
    expect(r.palette).toBe((h >>> 8) % 100 < K01_VARIATION.putih ? 'putih-seng' : 'krem-seng');
  });

  it('varian dari nama: K07 parkir, K11 pos/toilet', () => {
    expect(resolveBuilding(osm({ name: 'Kantin Parkir Belakang' })).variant).toBe('parkir');
    expect(resolveBuilding({ id: 'w2', ring: [[0, 0], [7, 0], [7, 5], [0, 5]], tags: { name: 'Pos Keamanan' } }).variant).toBe('pos');
    expect(resolveBuilding({ id: 'w3', ring: [[0, 0], [7, 0], [7, 5], [0, 5]], tags: { name: 'Toilet' } }).variant).toBe('toilet');
  });

  it('papan nama: nama huruf kapital untuk arketipe bertanda; K07/K09/K10/K11 tanpa papan', () => {
    expect(resolveBuilding(osm({ name: 'Gedung A FKIP (PPKN)' })).sign).toBe('GEDUNG A FKIP (PPKN)');
    expect(resolveBuilding(osm({ name: 'Kantin FT' })).sign).toBeNull();
    expect(resolveBuilding(osm({ building: 'yes' })).sign).toBeNull();
  });
});

describe('override', () => {
  beforeEach(() => resetResolveWarnings());

  it('override menang atas aturan; sign:null mematikan papan', () => {
    const r = resolveBuilding(osm({ name: 'Gedung Rektorat Universitas Riau', 'building:levels': '4-7' }, { id: 'w282225347' }), BUILDING_OVERRIDES.w282225347);
    expect(r).toMatchObject({ archetype: 'hero:rektorat', levels: 5, palette: 'putih', roof: 'datar-parapet', aturan: 'override', keyakinan: 'tinggi' });
    const fh = resolveBuilding(osm({ name: 'Gedung Fakultas Hukum' }, { id: 'w327366046' }), BUILDING_OVERRIDES.w327366046);
    expect(fh).toMatchObject({ archetype: 'K10', variant: 'beratap', levels: 3, sign: null });
  });

  it('override tak valid → aturan default + console.warn SEKALI per id', () => {
    const logger = { warn: vi.fn() };
    const bad = { archetype: 'K99', sumber: 'uji', keyakinan: 'tinggi' };
    const a = resolveBuilding(osm({ name: 'Laboratorium Batu' }), bad, { logger });
    resolveBuilding(osm({ name: 'Laboratorium Batu' }), bad, { logger });
    expect(a.archetype).toBe('K04');
    expect(a.aturan).not.toBe('override');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('validateOverrides', () => {
  it('TABEL NYATA buildings.data.js lulus', () => {
    expect(validateOverrides(BUILDING_OVERRIDES)).toEqual([]);
  });

  it('setiap entri nyata punya sumber & keyakinan', () => {
    for (const [id, ov] of Object.entries(BUILDING_OVERRIDES)) {
      expect(ov.sumber.length, id).toBeGreaterThan(10);
      expect(['tinggi', 'sedang', 'rendah']).toContain(ov.keyakinan);
    }
  });

  it('menangkap galat umum', () => {
    const errs = validateOverrides({
      x1: { archetype: 'K01', sumber: 'uji', keyakinan: 'tinggi' },
      w2: { archetype: 'K99', sumber: 'uji', keyakinan: 'tinggi' },
      w3: { archetype: 'K01', levels: 0, sumber: 'uji', keyakinan: 'tinggi' },
      w4: { archetype: 'K01', palette: 'ungu', sumber: 'uji', keyakinan: 'tinggi' },
      w5: { archetype: 'K01', roof: 'kubah', sumber: 'uji', keyakinan: 'tinggi' },
      w6: { archetype: 'K01', corridorSide: 'atas', sumber: 'uji', keyakinan: 'tinggi' },
      w7: { archetype: 'K01', variant: 'parkir', sumber: 'uji', keyakinan: 'tinggi' },
      w8: { archetype: 'K01', sumber: '', keyakinan: 'tinggi' },
      w9: { archetype: 'K01', sumber: 'uji', keyakinan: 'pasti' },
      w10: { archetype: 'K01', warna: 'merah', sumber: 'uji', keyakinan: 'tinggi' },
      w11: { archetype: 'K01', sign: 'X'.repeat(60), sumber: 'uji', keyakinan: 'tinggi' },
    });
    const ids = errs.map((e) => e.split(':')[0]);
    expect(new Set(ids)).toEqual(new Set(['x1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'w11']));
    expect(overrideErrors('w12', { archetype: 'K07', variant: 'parkir', sumber: 'uji', keyakinan: 'sedang' })).toEqual([]);
    expect(validateOverrides(null)).toEqual(['tabel override harus objek']);
  });

  it('id hero tabel = HERO_IDS dan semua punya builder', () => {
    for (const id of HERO_IDS) expect(typeof HERO_BUILDERS[id]).toBe('function');
    const heroes = Object.values(BUILDING_OVERRIDES).map((o) => o.archetype).filter((a) => a.startsWith('hero:'));
    for (const h of heroes) expect(HERO_IDS).toContain(h);
  });

  it('ruleArchetype tanpa override', () => {
    expect(ruleArchetype(osm({ name: 'Kantin FKIP' }))).toBe('K07');
    expect(resolveBuilding(osm({ name: 'Kantin FKIP' }), undefined, { logger: quiet }).aturan).toMatch(/kantin/);
  });
});
```

Catatan: tes impor `HERO_BUILDERS` (Task 10). Sampai Task 10 selesai, jalankan tes ini dengan filter `-t "aturan|override|validateOverrides menangkap"`; tes lengkap dijalankan ulang di Task 11.

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/resolveBuilding.test.js -t "aturan"`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: `buildings.data.js`**

`src/districts/unri/buildings.data.js`:
```js
/**
 * Tabel override gedung kampus UNRI (spec §4.7). Kunci = id OSM ('w' way, 'r' relation) seperti di
 * public/districts/unri/buildings.json. Hanya gedung yang punya fakta di riset
 * (docs/research/kampus-unri-bina-widya.md) atau yang aturan nama-nya jelas salah sasaran.
 * Setiap entri WAJIB `sumber` + `keyakinan` ('tinggi'|'sedang'|'rendah'); bentuk yang tidak berfoto
 * ditandai [INF] di sumber. Divalidasi `validateOverrides` (tests/districts/resolveBuilding.test.js).
 */
export const BUILDING_OVERRIDES = Object.freeze({
  // ── Hero (handmade M4/M6; M3 memasang placeholder berukuran footprint) ─────────────────────────
  w282225347: Object.freeze({
    archetype: 'hero:rektorat', levels: 5, palette: 'putih', roof: 'datar-parapet', sign: 'REKTORAT UNIVERSITAS RIAU',
    sumber: 'foto drone 2016 Commons Taman_Unri.jpg (putih, ±5 lt, atap datar parapet gelap); OSM way/282225347 levels 4-7; teks papan [INF]',
    keyakinan: 'tinggi',
  }),
  w282230716: Object.freeze({
    archetype: 'hero:masjid-arfaunnas', levels: 2, sign: "MASJID ARFA' UNNAS UNIVERSITAS RIAU",
    sumber: 'foto 2023 Commons Masjid_Arfaunnas_unri.jpg (huruf timbul, 2 lt, krem); arfaunnas.unri.ac.id; OSM way/282230716',
    keyakinan: 'tinggi',
  }),
  w314450943: Object.freeze({
    archetype: 'hero:ggm', levels: 4, sign: null,
    sumber: 'OSM way/314450943 (lingkaran Ø±82 m, levels 4-7); lovinasoenmi 2013 & goriau (mangkrak); kondisi 2026 tidak diketahui',
    keyakinan: 'sedang',
  }),
  w327530276: Object.freeze({
    archetype: 'hero:sekretariat-lembaga', levels: 1, sign: null,
    sumber: 'OSM way/327530276 "Sekretariat Lembaga Mahasiswa" (16,8 × 15,7 m); 1 lt & denah [INF] spec §8.1',
    keyakinan: 'sedang',
  }),
  w1480014538: Object.freeze({
    archetype: 'hero:student-center', levels: 3, sign: 'STUDENT CENTER',
    sumber: 'unri.ac.id gedung ADB: Gedung Serba Guna di Jl. Muchtar Lutfi antara asrama & stadion mini; way id cocok lokasi [S]; teks papan [INF]',
    keyakinan: 'sedang',
  }),
  w282225436: Object.freeze({
    archetype: 'hero:stadion-mini', levels: 2, sign: null,
    sumber: 'OSM way/282225436 "tribun stadion" (25 × 137 m) di Stadion Mini UNRI way/327364388; levels OSM 7 diragukan, bentuk tribun [INF]',
    keyakinan: 'rendah',
  }),
  // ── Gedung ADB berfoto (layar perforasi oranye) — footprint dari area amenity=university bernama ────
  w1313268659: Object.freeze({
    archetype: 'K03', variant: 'segitiga', levels: 4, palette: 'adb', roof: 'pelana-lebar', sign: 'INTEGRATED CLASSROOM',
    sumber: 'unri.ac.id "UNRI mulai fungsikan gedung-gedung bantuan ADB" Gambar-1 (putih, layar oranye motif segitiga, papan hitam huruf putih, 3–4 lt); OSM way/1313268659',
    keyakinan: 'tinggi',
  }),
  w1313268653: Object.freeze({
    archetype: 'K03', variant: 'wajik', levels: 4, palette: 'adb', roof: 'pelana-lebar', sign: 'HEALTH SCIENCES CENTER',
    sumber: 'unri.ac.id gedung ADB Gambar-4 (4 lt putih, kisi diagonal oranye-krem, atap pelana putih tritisan lebar); way id = nama OSM [S]; motif wajik [INF]',
    keyakinan: 'sedang',
  }),
  // ── Mangkrak ─────────────────────────────────────────────────────────────────────────────────
  w327366046: Object.freeze({
    archetype: 'K10', variant: 'beratap', levels: 3, palette: 'beton-mentah', roof: 'pelana', sign: null,
    sumber: 'goriau.com: Gedung FH Panam belum dipakai, 2015 dinding & listrik belum selesai, lahan sengketa HTJ; OSM way/327366046 3 lt, building:roof=tin; bentuk atap & rupa rangka [INF]',
    keyakinan: 'tinggi',
  }),
  w1313268658: Object.freeze({
    archetype: 'K10', variant: 'rangka', levels: 2, sign: null,
    sumber: 'OSM way/1313268658 nama "Gedung Mangkrak FISIP UNRI"; jumlah lantai & rupa [INF]',
    keyakinan: 'sedang',
  }),
  // ── Hunian & perpustakaan ─────────────────────────────────────────────────────────────────────
  w327366048: Object.freeze({
    archetype: 'K09', levels: 5, roof: 'datar-parapet', sign: null,
    sumber: 'OSM way/327366048 apartments 5 lt roof=concrete; unri.ac.id Rusunawa (±96 kamar, putra); Bahana: Wisma Binawidya 5 lt tanpa lift',
    keyakinan: 'tinggi',
  }),
  w282225374: Object.freeze({
    archetype: 'K01', levels: 2, sign: 'PERPUSTAKAAN UNIVERSITAS RIAU',
    sumber: 'lib.unri.ac.id sejarah (ringkasan): empat gedung masing-masing dua lantai, pindah 1992; OSM way/282225374; papan [INF]',
    keyakinan: 'sedang',
  }),
  // ── Aturan nama salah sasaran ──────────────────────────────────────────────────────────────────
  w282225390: Object.freeze({
    archetype: 'K01', levels: 2,
    sumber: 'OSM way/282225390 Balai Bahasa Provinsi Riau: building:walls=brick, 2 lt, office=government (bukan pendopo kayu); bentuk [INF]',
    keyakinan: 'sedang',
  }),
  w282225429: Object.freeze({
    archetype: 'K07', variant: 'parkir', sign: null,
    sumber: 'OSM way/282225429 "Area Parkir Motor FKIP (Gedung F)" amenity=motorcycle_parking; bentuk naungan berkolom [INF]',
    keyakinan: 'sedang',
  }),
  w327698565: Object.freeze({
    archetype: 'K07', variant: 'parkir', sign: null,
    sumber: 'OSM way/327698565 "Area Parkir Motor FKIP (Dekanat)" amenity=motorcycle_parking; bentuk naungan [INF]',
    keyakinan: 'sedang',
  }),
  w282225419: Object.freeze({
    archetype: 'K07', variant: 'parkir', sign: null,
    sumber: 'OSM way/282225419 "Area Parkir Mobil FKIP (Dekanat)" amenity=parking_space; bentuk naungan [INF]',
    keyakinan: 'sedang',
  }),
  w282225395: Object.freeze({
    archetype: 'K07', variant: 'parkir', sign: null,
    sumber: 'OSM way/282225395 "Area Parkir Perpustakaan UNRI" (9,7 × 9,5 m); bentuk naungan [INF]',
    keyakinan: 'sedang',
  }),
});
```

- [ ] **Step 4: `resolveBuilding.js`**

`src/districts/unri/resolveBuilding.js`:
```js
/**
 * Resolusi gedung OSM → parameter kit (spec §4.7 + deviasi D1 plan M3): override tabel menang; selain itu
 * aturan nama/tag berurutan (pertama yang cocok menang). Lantai: override → `building:levels` (rentang
 * "4-7" → minimum) → default arketipe. Override tak valid di runtime → aturan default + console.warn sekali
 * per id. Murni (tanpa three); `logger` dapat disuntik untuk tes.
 */
import { polygonArea } from '../../geo/polygon.js';
import {
  ARCHETYPE_IDS, CONFIDENCE, CORRIDOR_SIDES, HERO_IDS, PALETTES, ROOF_TYPES, VARIANTS, geometryArchetype, hashId,
} from '../../world/kit/archetypes.js';

export const OVERRIDE_KEYS = Object.freeze([
  'archetype', 'levels', 'palette', 'roof', 'corridorSide', 'sign', 'variant', 'sumber', 'keyakinan',
]);
const ID_RE = /^[wr]\d+$/;
const MAX_SIGN = 48;
const UNNAMED_SMALL = 150; // m²: gedung tanpa nama lebih kecil → K11 (D1)
const TINY = 60;           // m²: spec §4.7 → K11

/** Aturan nama/tag spec §4.7 (urut). `test(name, tags, area)`. */
export const RULES = Object.freeze([
  { archetype: 'K02', why: 'nama /dekanat/', test: (n) => /dekanat/i.test(n) },
  { archetype: 'K04', why: 'nama /lab|laborator/', test: (n) => /lab|laborator/i.test(n) },
  { archetype: 'K07', why: 'nama /kantin|food/', test: (n) => /kantin|food/i.test(n) },
  { archetype: 'K06', why: 'nama /musholla/', test: (n) => /mus(h)?oll?a|mushola/i.test(n) },
  { archetype: 'K08', why: 'nama /pendopo|balai bahasa/', test: (n) => /pendopo|balai bahasa/i.test(n) },
  { archetype: 'K05', why: 'nama /auditorium|gelanggang|aula/', test: (n) => /auditorium|gelanggang|aula/i.test(n) },
  { archetype: 'K10', why: 'nama /mangkrak/', test: (n) => /mangkrak/i.test(n) },
  { archetype: 'K09', why: 'building=apartments', test: (n, t) => t.building === 'apartments' },
  { archetype: 'K11', why: 'luas < 60 m²', test: (n, t, a) => a < TINY },
  { archetype: 'K01', why: 'nama gedung kuliah / amenity=university|college', test: (n, t) => /gedung [a-h]\b|kuliah|classroom/i.test(n) || t.amenity === 'university' || t.amenity === 'college' },
  { archetype: 'K11', why: 'D1: tanpa padanan, luas < 150 m²', test: (n, t, a) => a < UNNAMED_SMALL },
  { archetype: 'K01', why: 'D1: tanpa padanan → blok koridor kampus [INF]', test: () => true },
]);

/** "4-7" → 4, "2" → 2, "2;3" → 2; selain itu null. */
export function parseLevelsTag(raw) {
  if (raw === undefined || raw === null) return null;
  const m = String(raw).match(/\d+(\.\d+)?/);
  if (!m) return null;
  const v = Math.floor(Number(m[0]));
  return v >= 1 && v <= 60 ? v : null;
}

/** Daftar galat satu entri override (kosong = valid). */
export function overrideErrors(id, ov) {
  const errs = [];
  const at = (msg) => errs.push(`${id}: ${msg}`);
  if (!ID_RE.test(id)) at('id harus "w<angka>" atau "r<angka>"');
  if (!ov || typeof ov !== 'object' || Array.isArray(ov)) return [...errs, `${id}: entri harus objek`];
  for (const k of Object.keys(ov)) if (!OVERRIDE_KEYS.includes(k)) at(`kunci tak dikenal "${k}"`);
  if (ov.archetype !== undefined && !ARCHETYPE_IDS.includes(ov.archetype) && !HERO_IDS.includes(ov.archetype)) at(`archetype "${ov.archetype}" tidak dikenal`);
  if (ov.levels !== undefined && !(Number.isInteger(ov.levels) && ov.levels >= 1 && ov.levels <= 12)) at('levels harus bilangan bulat 1–12');
  if (ov.palette !== undefined && !Object.hasOwn(PALETTES, ov.palette)) at(`palette "${ov.palette}" tidak dikenal`);
  if (ov.roof !== undefined && !ROOF_TYPES.includes(ov.roof)) at(`roof "${ov.roof}" tidak dikenal`);
  if (ov.corridorSide !== undefined && !CORRIDOR_SIDES.includes(ov.corridorSide)) at(`corridorSide "${ov.corridorSide}" tidak dikenal`);
  if (ov.sign !== undefined && ov.sign !== null && !(typeof ov.sign === 'string' && ov.sign.trim() && ov.sign.length <= MAX_SIGN)) at(`sign harus teks 1–${MAX_SIGN} huruf atau null`);
  if (ov.variant !== undefined) {
    const arch = geometryArchetype(ov.archetype ?? '').id;
    const allowed = VARIANTS[ov.archetype] ?? VARIANTS[arch] ?? [];
    if (!ov.archetype || !allowed.includes(ov.variant)) at(`variant "${ov.variant}" tidak sah untuk archetype ${ov.archetype ?? '(kosong)'}`);
  }
  if (typeof ov.sumber !== 'string' || ov.sumber.trim().length < 3) at('sumber wajib (teks)');
  if (!CONFIDENCE.includes(ov.keyakinan)) at(`keyakinan harus salah satu ${CONFIDENCE.join('/')}`);
  return errs;
}

/** Validasi seluruh tabel override; [] = valid (spec §4.7). */
export function validateOverrides(table) {
  if (!table || typeof table !== 'object') return ['tabel override harus objek'];
  return Object.entries(table).flatMap(([id, ov]) => overrideErrors(id, ov));
}

const warned = new Set();

/** Hanya untuk tes: lupakan peringatan yang sudah dicetak. */
export function resetResolveWarnings() {
  warned.clear();
}

function ruleFor(name, tags, area) {
  return RULES.find((r) => r.test(name, tags, area));
}

/** Variasi [INF] blok kuliah lama: 30% putih (selain krem), 35% atap limas (selain pelana) — dari hash id. */
export const K01_VARIATION = Object.freeze({ putih: 30, limas: 35 });

function defaultPalette(archetype, tags, id) {
  const base = geometryArchetype(archetype).palette;
  if (tags['building:walls'] === 'wood') return 'kayu';
  if (tags['building:roof'] === 'tile' && base === 'krem-seng') return 'krem-genteng';
  if (archetype === 'K01' && (hashId(id) >>> 8) % 100 < K01_VARIATION.putih) return 'putih-seng';
  return base;
}

function defaultRoof(archetype, tags, id) {
  const arch = geometryArchetype(archetype);
  if (tags['building:roof'] === 'concrete' && arch.roof.type !== 'datar') return 'datar-parapet';
  if (archetype === 'K01' && hashId(id) % 100 < K01_VARIATION.limas) return 'limas';
  return arch.roof.type;
}

/** Varian default: dari nama (K07 parkir, K11 pos/toilet), selain itu varian pertama arketipe. */
function defaultVariant(archetype, name) {
  const id = geometryArchetype(archetype).id;
  const list = VARIANTS[id];
  if (!list) return null;
  if (id === 'K07' && /parkir/i.test(name)) return 'parkir';
  if (id === 'K11' && /pos|satpam|keamanan/i.test(name)) return 'pos';
  if (id === 'K11' && /toilet|\bwc\b/i.test(name)) return 'toilet';
  return list[0];
}

function defaultSign(archetype, name) {
  if (!name || geometryArchetype(archetype).signStyle === 'tidak') return null;
  const text = name.trim().toUpperCase();
  return text.length <= MAX_SIGN ? text : `${text.slice(0, MAX_SIGN - 1)}…`;
}

/**
 * @param {{id:string, ring:Array<[number,number]>, levels?:number|null, tags?:Record<string,string>, area?:number}} osm
 * @param {object} [override] entri tabel buildings.data.js
 * @param {{logger?: {warn: (...a: unknown[]) => void}}} [opts]
 * @returns {{archetype:string, levels:number, palette:string, roof:string, corridorSide:string, sign:string|null,
 *   variant:string|null, sumber:string, keyakinan:string, aturan:string}}
 */
export function resolveBuilding(osm, override, { logger = console } = {}) {
  const tags = osm.tags ?? {};
  const name = tags.name ?? '';
  const area = osm.area ?? polygonArea(osm.ring ?? []);
  let ov = override ?? null;
  if (ov) {
    const errs = overrideErrors(osm.id, ov);
    if (errs.length) {
      if (!warned.has(osm.id)) {
        warned.add(osm.id);
        logger.warn(`Override gedung ${osm.id} tidak valid, memakai aturan default:`, errs);
      }
      ov = null;
    }
  }
  const rule = ov?.archetype ? null : ruleFor(name, tags, area);
  const archetype = ov?.archetype ?? rule.archetype;
  const arch = geometryArchetype(archetype);
  const tagged = osm.levels ?? parseLevelsTag(tags['building:levels']);
  const levels = Math.min(ov?.levels ?? tagged ?? arch.levels, arch.maxLevels);
  return {
    archetype,
    levels,
    palette: ov?.palette ?? defaultPalette(archetype, tags, osm.id),
    roof: ov?.roof ?? defaultRoof(archetype, tags, osm.id),
    corridorSide: ov?.corridorSide ?? arch.corridor.side,
    sign: ov && Object.hasOwn(ov, 'sign') ? ov.sign : defaultSign(archetype, name),
    variant: ov?.variant ?? defaultVariant(archetype, name),
    sumber: ov?.sumber ?? `OSM ${osm.id.startsWith('r') ? 'relation' : 'way'}/${osm.id.slice(1)} + aturan (${rule.why})`,
    keyakinan: ov?.keyakinan ?? (name ? 'sedang' : 'rendah'),
    aturan: ov ? 'override' : rule.why,
  };
}

/** Arketipe default untuk tes/laporan: hanya aturan, tanpa override. */
export function ruleArchetype(osm) {
  const tags = osm.tags ?? {};
  return ruleFor(tags.name ?? '', tags, osm.area ?? polygonArea(osm.ring ?? [])).archetype;
}
```

- [ ] **Step 5: Jalankan — lulus (tanpa tes hero)**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/resolveBuilding.test.js -t "aturan|override|menangkap|TABEL|sumber|ruleArchetype"`
Expected: semua tes terpilih PASS (tes "id hero …" menunggu Task 10).

- [ ] **Step 6: Commit**

```bash
git add src/districts/unri/buildings.data.js src/districts/unri/resolveBuilding.js tests/districts/resolveBuilding.test.js
```
```bash
git commit -m "feat(unri): resolveBuilding + validateOverrides dan tabel override gedung bersumber"
```

---

## Task 7: MeshBuilder, sink, primitif sisi

**Files:**
- Create: `src/world/kit/kitBuilder.js`, `src/world/kit/kitShapes.js`

Desain: semua material kit berbagi tata atribut `position/normal/uv/color` non-indexed sehingga satu sink per klaster bisa menampung semua gedung. `tiled()` memotong bidang menjadi ubin seukuran sel atlas (atlas tidak bisa di-repeat): persegi memakai jalur cepat, poligon (tebeng, limas, atap poligon) diklip Sutherland–Hodgman. `mark()/rewind()` membuang geometri parsial gedung yang gagal. `toGeometry({ copy:false, sphere })` memakai view tanpa salin + bounding sphere analitik klaster (menghindari iterasi 300k verteks dalam satu potongan).

- [ ] **Step 1: `kitBuilder.js`**

`src/world/kit/kitBuilder.js`:
```js
/**
 * Penampung geometri kit: satu MeshBuilder per kunci material ('opak' | 'potong' | 'papan'), atribut seragam
 * position(3) normal(3) uv(2) color(3), non-indexed, array tumbuh (kapasitas ×2) agar banyak gedung bisa
 * ditulis bertahap ke SATU sink per klaster (penggabungan per material tanpa clone/merge di akhir).
 * Primitif: quad, tri, poligon cembung, kotak, bidang ber-ubin (grid diklip, UV per sel atlas) dan tutup bola.
 * Warna vertex dalam ruang linear (three ColorManagement).
 */
import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three';

export const SINK_KEYS = Object.freeze(['opak', 'potong', 'papan']);
const START_VERTS = 4096;

/** sRGB hex → [r,g,b] linear, dikalikan k (variasi luminance). */
export function linearColor(hex, k = 1) {
  const c = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [c((hex >> 16) & 255) * k, c((hex >> 8) & 255) * k, c(hex & 255) * k];
}

export const WHITE = Object.freeze([1, 1, 1]);

/** Sub-persegi UV dari rect sel {u0,v0,u1,v1} untuk pecahan s∈[0,1] (horizontal) dan t∈[0,1] (vertikal, bawah→atas). */
export function subUv(rect, s0, t0, s1, t1) {
  const du = rect.u1 - rect.u0;
  const dv = rect.v1 - rect.v0;
  return { u0: rect.u0 + du * s0, v0: rect.v0 + dv * t0, u1: rect.u0 + du * s1, v1: rect.v0 + dv * t1 };
}

export function createMeshBuilder(startVerts = START_VERTS) {
  let cap = Math.max(64, startVerts);
  let count = 0;
  let pos = new Float32Array(cap * 3);
  let nor = new Float32Array(cap * 3);
  let uvs = new Float32Array(cap * 2);
  let col = new Float32Array(cap * 3);
  const grow = (need) => {
    if (count + need <= cap) return;
    while (count + need > cap) cap *= 2;
    const g = (arr, k) => {
      const next = new Float32Array(cap * k);
      next.set(arr.subarray(0, count * k));
      return next;
    };
    pos = g(pos, 3);
    nor = g(nor, 3);
    uvs = g(uvs, 2);
    col = g(col, 3);
  };
  const emit = (x, y, z, nx, ny, nz, u, v, c) => {
    const i3 = count * 3;
    pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;
    nor[i3] = nx; nor[i3 + 1] = ny; nor[i3 + 2] = nz;
    col[i3] = c[0]; col[i3 + 1] = c[1]; col[i3 + 2] = c[2];
    uvs[count * 2] = u; uvs[count * 2 + 1] = v;
    count += 1;
  };
  /** Normal satuan dari (b − a) × (c − a); hasil di _n. */
  const _n = [0, 1, 0];
  const normalOf = (a, b, c) => {
    const ux = b[0] - a[0]; const uy = b[1] - a[1]; const uz = b[2] - a[2];
    const vx = c[0] - a[0]; const vy = c[1] - a[1]; const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    _n[0] = nx / l; _n[1] = ny / l; _n[2] = nz / l;
    return _n;
  };
  /** Ubin persegi [0,W]×[0,H] tanpa klip (jalur cepat dinding/lereng atap/lantai). */
  const rectTiles = (o, U, V, W, H, tw, th, r, color) => {
    const nx = U[1] * V[2] - U[2] * V[1];
    const ny = U[2] * V[0] - U[0] * V[2];
    const nz = U[0] * V[1] - U[1] * V[0];
    const du = r.u1 - r.u0;
    const dv = r.v1 - r.v0;
    const ni = Math.max(1, Math.ceil(W / tw - 1e-6));
    const nj = Math.max(1, Math.ceil(H / th - 1e-6));
    grow(ni * nj * 6);
    for (let j = 0; j < nj; j += 1) {
      const t0 = j * th;
      const t1 = Math.min(H, t0 + th);
      const v0 = r.v0;
      const v1 = r.v0 + dv * ((t1 - t0) / th);
      for (let i = 0; i < ni; i += 1) {
        const s0 = i * tw;
        const s1 = Math.min(W, s0 + tw);
        const u1 = r.u0 + du * ((s1 - s0) / tw);
        const P = (s, t) => [o[0] + U[0] * s + V[0] * t, o[1] + U[1] * s + V[1] * t, o[2] + U[2] * s + V[2] * t];
        const a = P(s0, t0); const b = P(s1, t0); const c = P(s1, t1); const d = P(s0, t1);
        emit(a[0], a[1], a[2], nx, ny, nz, r.u0, v0, color);
        emit(b[0], b[1], b[2], nx, ny, nz, u1, v0, color);
        emit(c[0], c[1], c[2], nx, ny, nz, u1, v1, color);
        emit(a[0], a[1], a[2], nx, ny, nz, r.u0, v0, color);
        emit(c[0], c[1], c[2], nx, ny, nz, u1, v1, color);
        emit(d[0], d[1], d[2], nx, ny, nz, r.u0, v1, color);
      }
    }
  };
  const api = {
    get vertexCount() { return count; },
    get triangles() { return count / 3; },
    /** Segitiga p0,p1,p2 (CCW dilihat dari depan) dengan uv per titik [[u,v]×3]. */
    tri(p0, p1, p2, uv, color = WHITE) {
      grow(3);
      const n = normalOf(p0, p1, p2);
      emit(p0[0], p0[1], p0[2], n[0], n[1], n[2], uv[0][0], uv[0][1], color);
      emit(p1[0], p1[1], p1[2], n[0], n[1], n[2], uv[1][0], uv[1][1], color);
      emit(p2[0], p2[1], p2[2], n[0], n[1], n[2], uv[2][0], uv[2][1], color);
    },
    /** Quad p0 kiri-bawah, p1 kanan-bawah, p2 kanan-atas, p3 kiri-atas (dilihat dari depan); rect UV penuh. */
    quad(p0, p1, p2, p3, r, color = WHITE) {
      grow(6);
      const n = normalOf(p0, p1, p3);
      const [nx, ny, nz] = n;
      emit(p0[0], p0[1], p0[2], nx, ny, nz, r.u0, r.v0, color);
      emit(p1[0], p1[1], p1[2], nx, ny, nz, r.u1, r.v0, color);
      emit(p2[0], p2[1], p2[2], nx, ny, nz, r.u1, r.v1, color);
      emit(p0[0], p0[1], p0[2], nx, ny, nz, r.u0, r.v0, color);
      emit(p2[0], p2[1], p2[2], nx, ny, nz, r.u1, r.v1, color);
      emit(p3[0], p3[1], p3[2], nx, ny, nz, r.u0, r.v1, color);
    },
    /** Poligon cembung (titik 3D CCW dari depan, uv per titik), kipas dari titik 0. */
    polygon(points, uv, color = WHITE) {
      for (let i = 1; i + 1 < points.length; i += 1) api.tri(points[0], points[i], points[i + 1], [uv[0], uv[i], uv[i + 1]], color);
    },
    /**
     * Bidang ber-ubin: origin + s·U + t·V (U,V satuan; normal = U × V), poligon cembung `poly` di (s,t) meter,
     * dipotong grid tileW × tileH; tiap potongan memetakan sel atlas `r` penuh per ubin. Persegi [0,W]×[0,H]
     * memakai jalur cepat tanpa klip.
     */
    tiled(origin, U, V, poly, tileW, tileH, r, color = WHITE) {
      if (isRect(poly)) {
        rectTiles(origin, U, V, poly[2][0], poly[2][1], tileW, tileH, r, color);
        return;
      }
      const s = poly.map((p) => p[0]);
      const t = poly.map((p) => p[1]);
      const i0 = Math.floor(Math.min(...s) / tileW + 1e-6);
      const i1 = Math.ceil(Math.max(...s) / tileW - 1e-6);
      const j0 = Math.floor(Math.min(...t) / tileH + 1e-6);
      const j1 = Math.ceil(Math.max(...t) / tileH - 1e-6);
      for (let j = j0; j < j1; j += 1) {
        for (let i = i0; i < i1; i += 1) {
          const cell = clipRect(poly, i * tileW, j * tileH, (i + 1) * tileW, (j + 1) * tileH);
          if (cell.length < 3) continue;
          const pts = cell.map(([ps, pt]) => [origin[0] + U[0] * ps + V[0] * pt, origin[1] + U[1] * ps + V[1] * pt, origin[2] + U[2] * ps + V[2] * pt]);
          const uv = cell.map(([ps, pt]) => [r.u0 + (r.u1 - r.u0) * (ps / tileW - i), r.v0 + (r.v1 - r.v0) * (pt / tileH - j)]);
          api.polygon(pts, uv, color);
        }
      }
    },
    /** Kotak berpusat (cx, cy, cz) ukuran sx × sy × sz, diputar yaw; tiap sisi memetakan rect penuh. */
    box(cx, cy, cz, sx, sy, sz, yaw, r, color = WHITE, { bottom = false, top = true } = {}) {
      const c = Math.cos(yaw);
      const sn = Math.sin(yaw);
      const P = (x, y, z) => [cx + x * c + z * sn, cy + y, cz - x * sn + z * c];
      const hx = sx / 2;
      const hy = sy / 2;
      const hz = sz / 2;
      api.quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), r, color);
      api.quad(P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), r, color);
      api.quad(P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), r, color);
      api.quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), r, color);
      if (top) api.quad(P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), P(-hx, hy, -hz), r, color);
      if (bottom) api.quad(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz), r, color);
    },
    /** Tutup bola (kubah) di atas pusat (cx, cy, cz): radius, segmen keliling & lintang. */
    dome(cx, cy, cz, radius, segs, rings, r, color = WHITE) {
      const pt = (a, b) => [cx + radius * Math.cos(b) * Math.cos(a), cy + radius * Math.sin(b), cz + radius * Math.cos(b) * Math.sin(a)];
      for (let j = 0; j < rings; j += 1) {
        const b0 = (j / rings) * (Math.PI / 2);
        const b1 = ((j + 1) / rings) * (Math.PI / 2);
        for (let i = 0; i < segs; i += 1) {
          const a0 = (i / segs) * Math.PI * 2;
          const a1 = ((i + 1) / segs) * Math.PI * 2;
          const q = subUv(r, i / segs, j / rings, (i + 1) / segs, (j + 1) / rings);
          api.quad(pt(a1, b0), pt(a0, b0), pt(a0, b1), pt(a1, b1), q, color);
        }
      }
    },
    /** Penanda posisi tulis (untuk membatalkan gedung yang gagal dirakit). */
    mark() { return count; },
    /** Kembalikan posisi tulis ke penanda (membuang verteks sesudahnya). */
    rewind(m) { count = Math.min(count, Math.max(0, m)); },
    /**
     * BufferGeometry; null bila kosong. copy=false memakai view (tanpa salin; buffer cadangan tetap hidup),
     * sphere = {center:[x,y,z], radius} menghindari iterasi computeBoundingSphere (klaster besar).
     */
    toGeometry({ copy = true, sphere = null } = {}) {
      if (count === 0) return null;
      const take = (arr, k) => (copy ? arr.slice(0, count * k) : arr.subarray(0, count * k));
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(take(pos, 3), 3));
      g.setAttribute('normal', new BufferAttribute(take(nor, 3), 3));
      g.setAttribute('uv', new BufferAttribute(take(uvs, 2), 2));
      g.setAttribute('color', new BufferAttribute(take(col, 3), 3));
      if (sphere) g.boundingSphere = new Sphere(new Vector3(...sphere.center), sphere.radius);
      else g.computeBoundingSphere();
      return g;
    },
  };
  return api;
}

/** Poligon (s,t) berbentuk persegi [[0,0],[W,0],[W,H],[0,H]]. */
function isRect(p) {
  return p.length === 4 && p[0][0] === 0 && p[0][1] === 0 && p[1][1] === 0 && p[3][0] === 0 && p[1][0] === p[2][0] && p[2][1] === p[3][1] && p[1][0] > 0 && p[2][1] > 0;
}

/** Sutherland–Hodgman: klip poligon cembung (s,t) ke persegi [s0,s1]×[t0,t1]. */
export function clipRect(poly, s0, t0, s1, t1) {
  const edges = [
    (p) => p[0] >= s0 - 1e-9, (p) => p[0] <= s1 + 1e-9, (p) => p[1] >= t0 - 1e-9, (p) => p[1] <= t1 + 1e-9,
  ];
  const cuts = [
    (a, b) => lerpAt(a, b, 0, s0), (a, b) => lerpAt(a, b, 0, s1), (a, b) => lerpAt(a, b, 1, t0), (a, b) => lerpAt(a, b, 1, t1),
  ];
  let out = poly;
  for (let k = 0; k < 4 && out.length; k += 1) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i += 1) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const inCur = edges[k](cur);
      const inPrev = edges[k](prev);
      if (inCur) {
        if (!inPrev) out.push(cuts[k](prev, cur));
        out.push(cur);
      } else if (inPrev) out.push(cuts[k](prev, cur));
    }
  }
  return out;
}

function lerpAt(a, b, axis, value) {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Satu MeshBuilder per kunci material; toParts → PartList {geometry, material, matrix:null, castShadow, name}.
 * `capacity` = perkiraan verteks awal per kunci (klaster: dari jumlah bay) agar array jarang tumbuh.
 */
export function createKitSink({ capacity = {} } = {}) {
  const builders = Object.fromEntries(SINK_KEYS.map((k) => [k, createMeshBuilder(capacity[k] ?? START_VERTS)]));
  return {
    ...builders,
    get triangles() { return SINK_KEYS.reduce((s, k) => s + builders[k].triangles, 0); },
    mark() { return SINK_KEYS.map((k) => builders[k].mark()); },
    rewind(m) { SINK_KEYS.forEach((k, i) => builders[k].rewind(m[i])); },
    /** @param {{opak:object, potong:object, papan?:object|null}} materials */
    toParts(materials, name = 'gedung', geometryOpts = {}) {
      const parts = [];
      for (const key of SINK_KEYS) {
        const material = materials[key];
        if (!material) continue;
        const geometry = builders[key].toGeometry(geometryOpts);
        if (geometry) parts.push({ geometry, material, matrix: null, castShadow: key !== 'papan', name: `${name}:${key}` });
      }
      return parts;
    },
  };
}
```

- [ ] **Step 2: `kitShapes.js`**

`src/world/kit/kitShapes.js`:
```js
/**
 * Primitif bentuk kit di atas sisi dinding: titik 3D pada sisi, quad & bidang ber-ubin tegak, lantai poligon,
 * pengurangan interval (pemotongan dinding oleh bukaan). Dipakai facade/openings/roofs/ornaments.
 */
import { cellUv } from './atlas.js';
import { facePoint } from './planGeom.js';

/** Titik 3D pada sisi: u sepanjang sisi, y absolut, out keluar dari bidang dinding. */
export function wp(face, u, y, out = 0) {
  const [x, z] = facePoint(face, u, out);
  return [x, y, z];
}

/** Yaw three.js yang membuat +Z lokal kotak menghadap normal luar sisi. */
export const yawOf = (face) => Math.atan2(face.n[0], face.n[1]);

/** Quad tegak di bidang sisi (dilihat dari luar), UV rect `r`. */
export function wallQuad(b, face, u0, u1, y0, y1, out, r, color) {
  b.quad(wp(face, u0, y0, out), wp(face, u1, y0, out), wp(face, u1, y1, out), wp(face, u0, y1, out), r, color);
}

/** Bidang tegak ber-ubin di sisi: s = u − u0, t = y − y0; tiap ubin tileW × tileH memetakan sel penuh. */
export function wallTiled(b, face, u0, u1, y0, y1, out, cell, tileW, tileH, color) {
  const o = wp(face, u0, y0, out);
  const U = [(face.b[0] - face.a[0]) / face.len, 0, (face.b[1] - face.a[1]) / face.len];
  b.tiled(o, U, [0, 1, 0], [[0, 0], [u1 - u0, 0], [u1 - u0, y1 - y0], [0, y1 - y0]], tileW, tileH, cellUv(cell), color);
}

/** Lantai/atap datar poligon (ring dunia [x,z], cembung atau segitiga) menghadap atas pada y. */
export function floorPolygon(b, ring, y, cell, color, tile = 1.6) {
  const x0 = Math.min(...ring.map((p) => p[0]));
  const z1 = Math.max(...ring.map((p) => p[1]));
  let poly = ring.map(([x, z]) => [x - x0, z1 - z]);
  const area = poly.reduce((s, p, i) => s + p[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * p[1], 0);
  if (area < 0) poly = poly.reverse();
  b.tiled([x0, y, z1], [1, 0, 0], [0, 0, -1], poly, tile, tile, cellUv(cell), color);
}

/** Interval [a,b] dikurangi interval lubang → potongan tersisa (> 1 mm). */
export function subtractIntervals(a, b, holes) {
  let parts = [[a, b]];
  for (const [h0, h1] of holes) {
    parts = parts.flatMap(([p0, p1]) => {
      if (h1 <= p0 || h0 >= p1) return [[p0, p1]];
      const out = [];
      if (h0 > p0) out.push([p0, h0]);
      if (h1 < p1) out.push([h1, p1]);
      return out;
    });
  }
  return parts.filter(([p0, p1]) => p1 - p0 > 1e-3);
}
```

- [ ] **Step 3: Lint**

Run: `node node_modules/eslint/bin/eslint.js src/world/kit`
Expected: 0 galat.

(Commit bersama Task 8.)

---

## Task 8: Atlas fasad 2048² + material kit + papan nama

**Files:**
- Create: `src/world/kit/atlas.js`, `src/world/kit/atlasPaint.surfaces.js`, `src/world/kit/atlasPaint.openings.js`, `src/world/kit/atlasPaint.misc.js`, `src/world/kit/kitMaterials.js`, `src/world/kit/signs.js`

### Tata letak atlas (piksel persis; slot dasar 256 px; UV = (x+4)/2048 … , v = 1 − (y+h−4)/2048 … 1 − (y+4)/2048)

| Baris (y) | Sel (x, y, w, h) | Isi | Kekasaran |
|---|---|---|---|
| 0 | `plester` (0,0,256,256), `plester-kusam` (256,0), `beton` (512,0), `beton-mentah` (768,0), `beton-coret` (1024,0), `bata-merah` (1280,0), `keramik-dinding` (1536,0), `kayu-papan` (1792,0) — semua 256² | dinding (tint palet) | 0,92/0,94/0,9/0,95/0,9/0,95/0,35/0,85 |
| 256 | `seng` (0,256), `seng-karat` (256,256), `genteng` (512,256), `atap-beton` (768,256), `keramik-lantai` (1024,256), `rabat` (1280,256), `plafon` (1536,256), `plint` (1792,256) | atap & lantai | 0,5/0,7/0,85/0,95/0,4/0,95/0,9/0,95 |
| 512 | `nako` (0,512), `nako-tirai` (256,512), `nako-nyala`* (512,512), `jalusi-kayu` (768,512), `kaca-biru` (1024,512), `kaca-biru-nyala`* (1280,512), `clerestory` (1536,512,256,128), `kaca-gelap` (1536,640,256,128), `jalusi-alu` (1792,512,128,128), `ac-luar` (1920,512,128,128), `exhaust` (1792,640,128,128), `lampu`* (1920,640,128,128) | jendela | kaca 0,08–0,15 |
| 768 | `pintu-kayu` (0,768,128,256), `pintu-kaca` (128,768,128,256), `pintu-ganda` (256,768), `pintu-gulung` (512,768), `gelap` (768,768,128,128), `besi` (896,768,128,128), `kayu-tiang` (768,896,128,128), `tandon` (896,896,128,128), `lisplang` (1024,768,256,64), `talang` (1024,832,256,64), `papan-kosong` (1024,896,256,64), `spanduk-menu` (1024,960,256,64), `etalase` (1280,768,256,128), `tempat-wudu` (1280,896,256,128), `rak-sandal` (1536,768,256,128), `meja-bangku` (1536,896,256,128), `bendera` (1792,768,128,128), `pot-tanah` (1920,768,128,128), `tangga` (1792,896,256,128) | pintu & benda | — |
| 1024 (alfa, material `potong`) | `roster-kotak` (0,1024,256,64), `roster-lingkaran` (0,1088,256,64), `roster-silang` (0,1152,256,64), `roster-bunga` (0,1216,256,64), `roster-krawangan` (256,1024,256,64), `railing` (256,1088,128,128), `besi-tulangan` (384,1088,128,128), `ilalang-kecil` (256,1216,256,64), `layar-segitiga` (512,1024), `layar-vertikal` (768,1024), `layar-wajik` (1024,1024), `ilalang` (1280,1024), `jemuran` (1536,1024), `tanaman-pot` (1792,1024) | roster 5 pola (strip 8×2 blok 20 cm = ubin 1,6 × 0,4 m), layar perforasi 3 motif (ubin 1,2 m), railing, jemuran almamater biru langit | — |
| 1280–1536 | `lod1-kuliah` (0,1280), `lod1-kuliah-nyala`* (256,1280), `lod1-adb` (512,1280), `lod1-adb-nyala`* (768,1280), `lod1-lab` (1024,1280), `lod1-rusun` (1280,1280), `lod1-rusun-nyala`* (1536,1280), `lod1-mangkrak` (1792,1280), `lod1-polos` (0,1536), `lod1-kantin` (256,1536), `lod1-aula` (512,1536), `lod1-jalusi` (768,1536) | fasad LOD1 & K12 (satu bay dilukis) | 0,7–0,95 |

\* sel menyala: peta emisif 512² (`GLOW_RECTS`) → jendela/lampu menyala malam lewat `userData.nightEmissive = {on:1, off:0}` (registry emisif TimeOfDay). Peta kekasaran 256² (kanal G) membuat kaca mengilap dan plester kusam dalam SATU material. Total 73 sel; baris 1792–2047 cadangan.

- [ ] **Step 1: `atlas.js`**

`src/world/kit/atlas.js`:
```js
/**
 * Atlas fasad prosedural 2048² (spec §7.3): daftar sel & koordinat piksel PERSIS, UV per sel, dan pembuat
 * tiga canvas selaras tata letak: warna (2048², sRGB, alfa untuk sel potong), kekasaran (256², kanal G),
 * emisif (512², jendela/lampu menyala malam). Slot dasar 256 px; sel boleh setengah/seperempat slot.
 * UV mengikuti CanvasTexture flipY: v = 1 − y/2048; tiap sel di-inset 4 px agar mipmap tidak bocor.
 * Sel 'tint' digambar netral terang dan diwarnai warna vertex (palet); sel lain digambar berwarna asli.
 */
import { createRandom } from '../siteutil/rng.js';
import { SURFACE_PAINTERS } from './atlasPaint.surfaces.js';
import { OPENING_PAINTERS } from './atlasPaint.openings.js';
import { MISC_PAINTERS, GLOW_RECTS } from './atlasPaint.misc.js';

export const ATLAS_SIZE = 2048;
export const ROUGH_SIZE = 256;
export const GLOW_SIZE = 512;
const INSET_PX = 4;

/** [id, x, y, w, h, kekasaran 0..1, potong(alfa)?, menyala?] */
const LAYOUT = [
  // Baris 0 (y 0): dinding (tint)
  ['plester', 0, 0, 256, 256, 0.92], ['plester-kusam', 256, 0, 256, 256, 0.94], ['beton', 512, 0, 256, 256, 0.9],
  ['beton-mentah', 768, 0, 256, 256, 0.95], ['beton-coret', 1024, 0, 256, 256, 0.9], ['bata-merah', 1280, 0, 256, 256, 0.95],
  ['keramik-dinding', 1536, 0, 256, 256, 0.35], ['kayu-papan', 1792, 0, 256, 256, 0.85],
  // Baris 1 (y 256): atap & lantai
  ['seng', 0, 256, 256, 256, 0.5], ['seng-karat', 256, 256, 256, 256, 0.7], ['genteng', 512, 256, 256, 256, 0.85],
  ['atap-beton', 768, 256, 256, 256, 0.95], ['keramik-lantai', 1024, 256, 256, 256, 0.4], ['rabat', 1280, 256, 256, 256, 0.95],
  ['plafon', 1536, 256, 256, 256, 0.9], ['plint', 1792, 256, 256, 256, 0.95],
  // Baris 2 (y 512): jendela
  ['nako', 0, 512, 256, 256, 0.15], ['nako-tirai', 256, 512, 256, 256, 0.15], ['nako-nyala', 512, 512, 256, 256, 0.15, false, true],
  ['jalusi-kayu', 768, 512, 256, 256, 0.8], ['kaca-biru', 1024, 512, 256, 256, 0.08], ['kaca-biru-nyala', 1280, 512, 256, 256, 0.08, false, true],
  ['clerestory', 1536, 512, 256, 128, 0.15], ['kaca-gelap', 1536, 640, 256, 128, 0.1],
  ['jalusi-alu', 1792, 512, 128, 128, 0.45], ['ac-luar', 1920, 512, 128, 128, 0.6], ['exhaust', 1792, 640, 128, 128, 0.5],
  ['lampu', 1920, 640, 128, 128, 0.3, false, true],
  // Baris 3 (y 768): pintu & benda kecil
  ['pintu-kayu', 0, 768, 128, 256, 0.75], ['pintu-kaca', 128, 768, 128, 256, 0.15], ['pintu-ganda', 256, 768, 256, 256, 0.7],
  ['pintu-gulung', 512, 768, 256, 256, 0.55], ['gelap', 768, 768, 128, 128, 0.95], ['besi', 896, 768, 128, 128, 0.5],
  ['kayu-tiang', 768, 896, 128, 128, 0.8], ['tandon', 896, 896, 128, 128, 0.6],
  ['lisplang', 1024, 768, 256, 64, 0.85], ['talang', 1024, 832, 256, 64, 0.5], ['papan-kosong', 1024, 896, 256, 64, 0.6],
  ['spanduk-menu', 1024, 960, 256, 64, 0.9], ['etalase', 1280, 768, 256, 128, 0.2], ['tempat-wudu', 1280, 896, 256, 128, 0.4],
  ['rak-sandal', 1536, 768, 256, 128, 0.8], ['meja-bangku', 1536, 896, 256, 128, 0.8],
  ['bendera', 1792, 768, 128, 128, 0.9], ['pot-tanah', 1920, 768, 128, 128, 0.9], ['tangga', 1792, 896, 256, 128, 0.9],
  // Baris 4 (y 1024): sel potong (alfa) — material 'potong'
  ['roster-kotak', 0, 1024, 256, 64, 0.92, true], ['roster-lingkaran', 0, 1088, 256, 64, 0.92, true],
  ['roster-silang', 0, 1152, 256, 64, 0.92, true], ['roster-bunga', 0, 1216, 256, 64, 0.92, true],
  ['roster-krawangan', 256, 1024, 256, 64, 0.92, true], ['railing', 256, 1088, 128, 128, 0.5, true],
  ['besi-tulangan', 384, 1088, 128, 128, 0.7, true], ['ilalang-kecil', 256, 1216, 256, 64, 0.9, true],
  ['layar-segitiga', 512, 1024, 256, 256, 0.55, true], ['layar-vertikal', 768, 1024, 256, 256, 0.55, true],
  ['layar-wajik', 1024, 1024, 256, 256, 0.55, true], ['ilalang', 1280, 1024, 256, 256, 0.9, true],
  ['jemuran', 1536, 1024, 256, 256, 0.9, true], ['tanaman-pot', 1792, 1024, 256, 256, 0.85, true],
  // Baris 5–6 (y 1280, 1536): fasad LOD1 (satu bay dilukis) — tint
  ['lod1-kuliah', 0, 1280, 256, 256, 0.85], ['lod1-kuliah-nyala', 256, 1280, 256, 256, 0.85, false, true],
  ['lod1-adb', 512, 1280, 256, 256, 0.7], ['lod1-adb-nyala', 768, 1280, 256, 256, 0.7, false, true],
  ['lod1-lab', 1024, 1280, 256, 256, 0.85], ['lod1-rusun', 1280, 1280, 256, 256, 0.85],
  ['lod1-rusun-nyala', 1536, 1280, 256, 256, 0.85, false, true], ['lod1-mangkrak', 1792, 1280, 256, 256, 0.95],
  ['lod1-polos', 0, 1536, 256, 256, 0.9], ['lod1-kantin', 256, 1536, 256, 256, 0.9], ['lod1-aula', 512, 1536, 256, 256, 0.9],
  ['lod1-jalusi', 768, 1536, 256, 256, 0.85],
];

/** Sel atlas beku: { x, y, w, h, rough, alpha, glow }. */
export const ATLAS_CELLS = Object.freeze(Object.fromEntries(LAYOUT.map(([id, x, y, w, h, rough, alpha = false, glow = false]) => [
  id, Object.freeze({ x, y, w, h, rough, alpha, glow }),
])));

const UV_CACHE = new Map();
let warnedUnknown = false;

/** UV rect {u0,v0,u1,v1} sel `id` (v bawah→atas). Id tak dikenal → 'plester' + console.warn sekali. */
export function cellUv(id) {
  const hit = UV_CACHE.get(id);
  if (hit) return hit;
  let c = ATLAS_CELLS[id];
  if (!c) {
    if (!warnedUnknown) {
      warnedUnknown = true;
      console.warn(`atlas: sel "${id}" tidak ada, memakai "plester"`);
    }
    c = ATLAS_CELLS.plester;
  }
  const r = Object.freeze({
    u0: (c.x + INSET_PX) / ATLAS_SIZE,
    u1: (c.x + c.w - INSET_PX) / ATLAS_SIZE,
    v0: 1 - (c.y + c.h - INSET_PX) / ATLAS_SIZE,
    v1: 1 - (c.y + INSET_PX) / ATLAS_SIZE,
  });
  UV_CACHE.set(id, r);
  return r;
}

export const PAINTERS = Object.freeze({ ...SURFACE_PAINTERS, ...OPENING_PAINTERS, ...MISC_PAINTERS });

function defaultCanvas(w, h) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Lukis satu sel ke ctx warna (dipotong ke rect sel). */
function paintColorCell(ctx, id, cell, seed) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(cell.x, cell.y, cell.w, cell.h);
  ctx.clip();
  ctx.translate(cell.x, cell.y);
  const painter = PAINTERS[id];
  if (!painter) throw new Error(`atlas: painter sel "${id}" tidak ada`);
  painter(ctx, cell.w, cell.h, createRandom(seed));
  ctx.restore();
}

/** Lukis area menyala sel `id` ke ctx emisif berskala k. */
function paintGlowCell(ctx, id, cell, k) {
  const rects = GLOW_RECTS[id] ?? [[0, 0, 1, 1]];
  for (const [rx, ry, rw, rh] of rects) {
    const x = (cell.x + rx * cell.w) * k;
    const y = (cell.y + ry * cell.h) * k;
    const g = ctx.createLinearGradient(0, y, 0, y + rh * cell.h * k);
    g.addColorStop(0, '#fff1cf');
    g.addColorStop(1, '#ffd58a');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, rw * cell.w * k, rh * cell.h * k);
  }
}

/**
 * Tiga canvas atlas (warna, kekasaran, emisif); null bila tidak ada canvas (Node/tes).
 * @param {{createCanvas?: (w:number, h:number) => HTMLCanvasElement|null}} [opts]
 */
export function createAtlasCanvases({ createCanvas = defaultCanvas } = {}) {
  const color = createCanvas(ATLAS_SIZE, ATLAS_SIZE);
  const rough = createCanvas(ROUGH_SIZE, ROUGH_SIZE);
  const glow = createCanvas(GLOW_SIZE, GLOW_SIZE);
  const cc = color?.getContext('2d');
  const rc = rough?.getContext('2d');
  const gc = glow?.getContext('2d');
  if (!cc || !rc || !gc) return null;
  cc.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  rc.fillStyle = 'rgb(235,235,235)';
  rc.fillRect(0, 0, ROUGH_SIZE, ROUGH_SIZE);
  gc.fillStyle = '#000';
  gc.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  const kr = ROUGH_SIZE / ATLAS_SIZE;
  const kg = GLOW_SIZE / ATLAS_SIZE;
  LAYOUT.forEach(([id], i) => {
    const cell = ATLAS_CELLS[id];
    paintColorCell(cc, id, cell, 1000 + i * 7919);
    const v = Math.round(cell.rough * 255);
    rc.fillStyle = `rgb(${v},${v},${v})`;
    rc.fillRect(cell.x * kr, cell.y * kr, cell.w * kr, cell.h * kr);
    if (cell.glow) paintGlowCell(gc, id, cell, kg);
  });
  return { color, rough, glow };
}
```

- [ ] **Step 2: `atlasPaint.surfaces.js`**

`src/world/kit/atlasPaint.surfaces.js`:
```js
/**
 * Pelukis sel atlas: permukaan dinding, atap, lantai (canvas 2D). Setiap pelukis `(ctx, w, h, rnd)` menggambar
 * di (0,0)–(w,h) yang sudah ditranslasi & diklip ke sel; `rnd` = createRandom(seed sel). Sel bertanda tint
 * digambar netral terang (warna palet dari warna vertex). Skala acuan: 256 px ≈ satu bay 3,6 m.
 */

/** Warna CSS dari rgb/alpha. */
export const rgba = (r, g, b, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

/** Isi rata + variasi halus per blok 8 px (tekstur plester/beton). */
export function mottle(ctx, w, h, rnd, base, amp, block = 8) {
  for (let y = 0; y < h; y += block) {
    for (let x = 0; x < w; x += block) {
      const k = 1 + (rnd.next() * 2 - 1) * amp;
      ctx.fillStyle = rgba(base[0] * k, base[1] * k, base[2] * k);
      ctx.fillRect(x, y, block, block);
    }
  }
}

/** Bercak lembut acak (lingkaran gradasi). */
export function blotches(ctx, w, h, rnd, n, color, alpha, rMin, rMax) {
  for (let i = 0; i < n; i += 1) {
    const x = rnd.next() * w;
    const y = rnd.next() * h;
    const r = rMin + rnd.next() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(...color, alpha));
    g.addColorStop(1, rgba(...color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Bintik kecil (pori/debu). */
export function speckle(ctx, w, h, rnd, n, color, alpha, size = 1.5) {
  ctx.fillStyle = rgba(...color, alpha);
  for (let i = 0; i < n; i += 1) ctx.fillRect(rnd.next() * w, rnd.next() * h, size, size);
}

/** Lelehan air hujan vertikal dari atas (noda kusam di bawah ambang/atap). */
export function streaks(ctx, w, h, rnd, n, color, alpha, maxLen = 0.6) {
  for (let i = 0; i < n; i += 1) {
    const x = rnd.next() * w;
    const y0 = rnd.next() * h * 0.3;
    const len = h * (0.15 + rnd.next() * maxLen);
    const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, rgba(...color, alpha));
    g.addColorStop(1, rgba(...color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x, y0, 1 + rnd.next() * 3, len);
  }
}

/** Garis retak tipis acak berliku. */
export function crack(ctx, x, y, len, rnd, color = [70, 66, 60], alpha = 0.45) {
  ctx.strokeStyle = rgba(...color, alpha);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  let cx = x;
  let cy = y;
  for (let i = 0; i < 8; i += 1) {
    cx += (rnd.next() - 0.5) * len * 0.3;
    cy += len / 8;
    ctx.lineTo(cx, cy);
  }
  ctx.stroke();
}

/** Grid nat (ubin) dengan garis gelap & sorot terang. */
export function grout(ctx, w, h, cw, ch, color, alpha, width = 2, offsetRows = false) {
  ctx.fillStyle = rgba(...color, alpha);
  for (let y = 0; y <= h; y += ch) ctx.fillRect(0, y - width / 2, w, width);
  for (let y = 0, row = 0; y < h; y += ch, row += 1) {
    const off = offsetRows && row % 2 ? cw / 2 : 0;
    for (let x = -off; x <= w; x += cw) ctx.fillRect(x - width / 2, y, width, ch);
  }
}

const PLASTER = [244, 241, 234];

function plester(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, PLASTER, 0.012);
  blotches(ctx, w, h, rnd, 14, [205, 200, 188], 0.08, 20, 60);
  speckle(ctx, w, h, rnd, 500, [150, 145, 135], 0.25, 1);
  const g = ctx.createLinearGradient(0, h * 0.86, 0, h);
  g.addColorStop(0, rgba(120, 110, 95, 0));
  g.addColorStop(1, rgba(120, 110, 95, 0.18));
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
}

function plesterKusam(ctx, w, h, rnd) {
  plester(ctx, w, h, rnd);
  streaks(ctx, w, h, rnd, 22, [95, 92, 84], 0.22);
  blotches(ctx, w, h * 0.25, rnd, 6, [72, 86, 60], 0.18, 10, 30); // lumut di bawah talang
  ctx.save();
  ctx.translate(0, h * 0.78);
  blotches(ctx, w, h * 0.22, rnd, 10, [62, 74, 52], 0.22, 10, 26); // lumut cipratan tanah
  ctx.restore();
  crack(ctx, w * (0.2 + rnd.next() * 0.6), h * 0.1, h * 0.5, rnd);
}

function beton(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [222, 220, 214], 0.02, 4);
  for (let y = 32; y < h; y += 32) {
    ctx.fillStyle = rgba(150, 146, 138, 0.35);
    ctx.fillRect(0, y, w, 1);
    ctx.fillStyle = rgba(255, 255, 255, 0.25);
    ctx.fillRect(0, y + 1, w, 1);
  }
  speckle(ctx, w, h, rnd, 700, [120, 116, 108], 0.35, 1.2);
  blotches(ctx, w, h, rnd, 8, [170, 166, 156], 0.12, 15, 45);
}

function betonMentah(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [190, 186, 177], 0.05, 4);
  blotches(ctx, w, h, rnd, 18, [120, 116, 106], 0.25, 8, 40);
  for (let i = 0; i < 5; i += 1) { // keropos (honeycomb)
    const x = rnd.next() * w;
    const y = rnd.next() * h;
    ctx.fillStyle = rgba(70, 66, 60, 0.55);
    for (let k = 0; k < 40; k += 1) ctx.fillRect(x + (rnd.next() - 0.5) * 22, y + (rnd.next() - 0.5) * 14, 2, 2);
  }
  streaks(ctx, w, h, rnd, 10, [140, 80, 40], 0.3, 0.5); // karat besi
  for (let y = 40; y < h; y += 40) {
    ctx.fillStyle = rgba(110, 106, 98, 0.4);
    ctx.fillRect(0, y, w, 1);
  }
}

function betonCoret(ctx, w, h, rnd) {
  betonMentah(ctx, w, h, rnd);
  const colors = [[220, 40, 50], [30, 30, 30], [40, 90, 200], [240, 200, 30], [255, 255, 255]];
  for (let i = 0; i < 6; i += 1) {
    ctx.strokeStyle = rgba(...rnd.pick(colors), 0.85);
    ctx.lineWidth = 3 + rnd.next() * 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    let x = rnd.next() * w * 0.8 + w * 0.1;
    let y = h * (0.35 + rnd.next() * 0.45);
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k += 1) {
      const nx = x + (rnd.next() - 0.3) * 50;
      const ny = y + (rnd.next() - 0.5) * 40;
      ctx.quadraticCurveTo(x + (rnd.next() - 0.5) * 60, y + (rnd.next() - 0.5) * 60, nx, ny);
      x = nx;
      y = ny;
    }
    ctx.stroke();
  }
}

function bataMerah(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(150, 142, 130);
  ctx.fillRect(0, 0, w, h);
  const bw = 48;
  const bh = 16;
  for (let y = 0, row = 0; y < h; y += bh, row += 1) {
    for (let x = row % 2 ? -bw / 2 : 0; x < w; x += bw) {
      const k = 0.85 + rnd.next() * 0.3;
      ctx.fillStyle = rgba(168 * k, 78 * k, 52 * k);
      ctx.fillRect(x + 2, y + 2, bw - 3, bh - 3);
    }
  }
  speckle(ctx, w, h, rnd, 400, [60, 30, 20], 0.3, 1.5);
}

function keramikDinding(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [246, 246, 243], 0.01, 32);
  grout(ctx, w, h, 32, 32, [170, 172, 170], 0.9, 2);
  ctx.fillStyle = rgba(255, 255, 255, 0.35);
  for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) ctx.fillRect(x + 4, y + 4, 10, 2);
}

function kayuPapan(ctx, w, h, rnd) {
  for (let x = 0; x < w; x += 32) {
    const k = 0.85 + rnd.next() * 0.25;
    ctx.fillStyle = rgba(214 * k, 196 * k, 170 * k);
    ctx.fillRect(x, 0, 32, h);
    ctx.strokeStyle = rgba(120, 95, 70, 0.25);
    for (let g = 0; g < 5; g += 1) {
      ctx.beginPath();
      const gx = x + 4 + rnd.next() * 24;
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 4, h * 0.3, gx - 4, h * 0.6, gx + 2, h);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(60, 45, 30, 0.7);
    ctx.fillRect(x, 0, 2, h);
  }
}

function seng(ctx, w, h, rnd, rust = false) {
  const ribs = 16;
  const rw = w / ribs;
  for (let x = 0; x < w; x += 1) {
    const ph = ((x % rw) / rw) * Math.PI * 2;
    const k = 0.82 + 0.18 * (0.5 + 0.5 * Math.cos(ph));
    ctx.fillStyle = rgba(226 * k, 230 * k, 233 * k);
    ctx.fillRect(x, 0, 1, h);
  }
  ctx.fillStyle = rgba(90, 96, 100, 0.35); // sambungan lembar
  ctx.fillRect(0, Math.round(h * 0.68), w, 2);
  for (let x = rw / 2; x < w; x += rw * 2) { // baris paku
    ctx.fillStyle = rgba(70, 72, 74, 0.6);
    ctx.fillRect(x - 1, h * 0.1, 2, 2);
    ctx.fillRect(x - 1, h * 0.66, 2, 2);
  }
  streaks(ctx, w, h, rnd, 12, [110, 112, 112], 0.14, 0.8);
  if (rust) { // karat halus: rembesan dari baris paku + tepi bawah lembar (bukan bercak acak)
    for (let x = rw / 2; x < w; x += rw * 2) {
      const g = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.1 + h * (0.12 + rnd.next() * 0.2));
      g.addColorStop(0, rgba(150, 82, 38, 0.35));
      g.addColorStop(1, rgba(150, 82, 38, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - 2, h * 0.1, 4, h * 0.32);
    }
    const g = ctx.createLinearGradient(0, h * 0.82, 0, h);
    g.addColorStop(0, rgba(140, 78, 36, 0));
    g.addColorStop(1, rgba(140, 78, 36, 0.3));
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
  }
}

function genteng(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(150, 140, 132);
  ctx.fillRect(0, 0, w, h);
  const tw = 32;
  const th = 32;
  for (let y = 0, row = 0; y < h; y += th, row += 1) {
    for (let x = row % 2 ? -tw / 2 : 0; x < w; x += tw) {
      const k = 0.88 + rnd.next() * 0.2;
      const g = ctx.createLinearGradient(0, y, 0, y + th);
      g.addColorStop(0, rgba(205 * k, 200 * k, 194 * k));
      g.addColorStop(0.8, rgba(238 * k, 234 * k, 228 * k));
      g.addColorStop(1, rgba(150 * k, 144 * k, 138 * k));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + 1, y);
      ctx.lineTo(x + tw - 1, y);
      ctx.lineTo(x + tw - 1, y + th - 6);
      ctx.quadraticCurveTo(x + tw / 2, y + th + 2, x + 1, y + th - 6);
      ctx.fill();
    }
  }
  blotches(ctx, w, h, rnd, 10, [60, 70, 50], 0.18, 10, 30);
}

function atapBeton(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [205, 203, 198], 0.03, 8);
  blotches(ctx, w, h, rnd, 12, [120, 118, 112], 0.2, 20, 70);
  blotches(ctx, w, h, rnd, 5, [70, 80, 60], 0.15, 10, 30);
  speckle(ctx, w, h, rnd, 500, [90, 88, 84], 0.3, 1.2);
}

function keramikLantai(ctx, w, h, rnd) {
  for (let y = 0; y < h; y += 64) {
    for (let x = 0; x < w; x += 64) {
      const k = 0.96 + rnd.next() * 0.06;
      ctx.fillStyle = rgba(236 * k, 228 * k, 210 * k);
      ctx.fillRect(x, y, 64, 64);
    }
  }
  speckle(ctx, w, h, rnd, 300, [170, 160, 140], 0.25, 1.5);
  grout(ctx, w, h, 64, 64, [150, 142, 128], 0.9, 2);
  blotches(ctx, w, h, rnd, 6, [150, 130, 100], 0.12, 20, 50); // bekas sandal/tanah
}

function rabat(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [214, 210, 202], 0.035, 4);
  speckle(ctx, w, h, rnd, 900, [110, 105, 98], 0.35, 1.5);
  for (let i = 0; i < 3; i += 1) crack(ctx, rnd.next() * w, 0, h, rnd, [80, 76, 70], 0.5);
}

function plafon(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [246, 245, 241], 0.01, 16);
  grout(ctx, w, h, 64, 128, [175, 172, 165], 0.8, 2);
  blotches(ctx, w, h, rnd, 3, [170, 140, 90], 0.18, 10, 30); // bekas bocor
}

function plint(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [196, 196, 194], 0.05, 4);
  speckle(ctx, w, h, rnd, 1200, [70, 70, 70], 0.4, 1.5);
  const g = ctx.createLinearGradient(0, h * 0.5, 0, h);
  g.addColorStop(0, rgba(120, 90, 60, 0));
  g.addColorStop(1, rgba(120, 90, 60, 0.4)); // cipratan tanah merah
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
}

export const SURFACE_PAINTERS = Object.freeze({
  plester,
  'plester-kusam': plesterKusam,
  beton,
  'beton-mentah': betonMentah,
  'beton-coret': betonCoret,
  'bata-merah': bataMerah,
  'keramik-dinding': keramikDinding,
  'kayu-papan': kayuPapan,
  seng: (ctx, w, h, rnd) => seng(ctx, w, h, rnd, false),
  'seng-karat': (ctx, w, h, rnd) => seng(ctx, w, h, rnd, true),
  genteng,
  'atap-beton': atapBeton,
  'keramik-lantai': keramikLantai,
  rabat,
  plafon,
  plint,
});
```

- [ ] **Step 3: `atlasPaint.openings.js`**

`src/world/kit/atlasPaint.openings.js`:
```js
/**
 * Pelukis sel atlas: jendela (nako, jalusi, kaca biru), pintu, roster (5 pola), layar perforasi (3 motif),
 * railing, AC, exhaust, lampu TL. Sel potong memakai alfa (lubang = transparan, `destination-out`).
 */
import { blotches, rgba, speckle, streaks } from './atlasPaint.surfaces.js';

const ALU = [201, 205, 209];
const CURTAINS = [[150, 42, 52], [62, 92, 150], [222, 206, 172], [92, 132, 92], [196, 120, 60]];

function frame(ctx, x, y, w, h, t, color) {
  ctx.fillStyle = rgba(...color);
  ctx.fillRect(x, y, w, t);
  ctx.fillRect(x, y + h - t, w, t);
  ctx.fillRect(x, y, t, h);
  ctx.fillRect(x + w - t, y, t, h);
}

function interior(ctx, x, y, w, h, lit) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (lit) {
    g.addColorStop(0, rgba(246, 232, 196));
    g.addColorStop(1, rgba(226, 204, 160));
  } else {
    g.addColorStop(0, rgba(44, 50, 57));
    g.addColorStop(1, rgba(62, 68, 74));
  }
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function curtain(ctx, x, y, w, h, rnd, lit) {
  const c = rnd.pick(CURTAINS);
  const cover = 0.4 + rnd.next() * 0.6;
  const cw = w * cover;
  const left = rnd.chance(0.5) ? x : x + w - cw;
  for (let i = 0; i < cw; i += 6) {
    const k = (lit ? 1.15 : 0.75) * (0.85 + 0.15 * Math.sin(i * 0.9));
    ctx.fillStyle = rgba(c[0] * k, c[1] * k, c[2] * k);
    ctx.fillRect(left + i, y, 6, h);
  }
}

/** Nako: dua daun, 10 bilah kaca miring per daun, bingkai aluminium. */
function nako(ctx, w, h, rnd, { tirai = false, lit = false } = {}) {
  ctx.fillStyle = rgba(...ALU);
  ctx.fillRect(0, 0, w, h);
  const t = Math.round(w * 0.04);
  const leafW = (w - 3 * t) / 2;
  for (let l = 0; l < 2; l += 1) {
    const x = t + l * (leafW + t);
    interior(ctx, x, t, leafW, h - 2 * t, lit);
    if (tirai || lit) curtain(ctx, x, t, leafW, h - 2 * t, rnd, lit);
    const slats = 10;
    const sh = (h - 2 * t) / slats;
    for (let s = 0; s < slats; s += 1) {
      const y = t + s * sh;
      const g = ctx.createLinearGradient(0, y, 0, y + sh);
      g.addColorStop(0, rgba(190, 210, 222, lit ? 0.25 : 0.55));
      g.addColorStop(0.7, rgba(120, 140, 155, lit ? 0.12 : 0.35));
      g.addColorStop(1, rgba(240, 248, 252, 0.7));
      ctx.fillStyle = g;
      ctx.fillRect(x, y + 1, leafW, sh - 1);
      ctx.fillStyle = rgba(150, 156, 160, 0.9); // klip bilah
      ctx.fillRect(x, y + sh - 2, 4, 2);
      ctx.fillRect(x + leafW - 4, y + sh - 2, 4, 2);
    }
  }
  frame(ctx, 0, 0, w, h, t, [176, 181, 186]);
  speckle(ctx, w, h, rnd, 60, [90, 90, 90], 0.2, 1);
}

function jalusiKayu(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(122, 82, 50);
  ctx.fillRect(0, 0, w, h);
  const t = 12;
  const leafW = (w - 3 * t) / 2;
  for (let l = 0; l < 2; l += 1) {
    const x = t + l * (leafW + t);
    for (let y = t; y < h - t; y += 12) {
      ctx.fillStyle = rgba(150, 104, 64);
      ctx.fillRect(x, y, leafW, 8);
      ctx.fillStyle = rgba(70, 46, 28);
      ctx.fillRect(x, y + 8, leafW, 4);
    }
  }
  streaks(ctx, w, h, rnd, 10, [60, 40, 20], 0.2, 0.6);
}

function kacaBiru(ctx, w, h, rnd, lit = false) {
  ctx.fillStyle = rgba(64, 70, 78);
  ctx.fillRect(0, 0, w, h);
  const cols = 2;
  const rows = 3;
  const t = 6;
  const pw = (w - t * (cols + 1)) / cols;
  const ph = (h - t * (rows + 1)) / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = t + c * (pw + t);
      const y = t + r * (ph + t);
      const g = ctx.createLinearGradient(x, y, x + pw, y + ph);
      g.addColorStop(0, rgba(150, 190, 220));
      g.addColorStop(0.55, rgba(70, 110, 150));
      g.addColorStop(1, rgba(110, 150, 185));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, pw, ph);
      if (lit && r > 0) {
        ctx.fillStyle = rgba(250, 226, 170, 0.65);
        ctx.fillRect(x + 4, y + ph * 0.35, pw - 8, ph * 0.6);
      }
      ctx.fillStyle = rgba(255, 255, 255, 0.25);
      ctx.beginPath();
      ctx.moveTo(x + pw * 0.15, y);
      ctx.lineTo(x + pw * 0.35, y);
      ctx.lineTo(x, y + ph * 0.6);
      ctx.lineTo(x, y + ph * 0.3);
      ctx.fill();
    }
  }
  speckle(ctx, w, h, rnd, 40, [255, 255, 255], 0.2, 1);
}

function clerestory(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(...ALU);
  ctx.fillRect(0, 0, w, h);
  const n = 4;
  const t = 6;
  const pw = (w - t * (n + 1)) / n;
  for (let i = 0; i < n; i += 1) {
    const x = t + i * (pw + t);
    interior(ctx, x, t, pw, h - 2 * t, false);
    ctx.fillStyle = rgba(190, 210, 222, 0.45);
    ctx.fillRect(x, t, pw, (h - 2 * t) * 0.45);
  }
  streaks(ctx, w, h, rnd, 6, [80, 80, 80], 0.2);
}

function kacaGelap(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, rgba(60, 74, 86));
  g.addColorStop(1, rgba(30, 38, 46));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  frame(ctx, 0, 0, w, h, 5, [70, 74, 78]);
}

function jalusiAlu(ctx, w, h) {
  ctx.fillStyle = rgba(60, 64, 68);
  ctx.fillRect(0, 0, w, h);
  for (let y = 6; y < h - 6; y += 10) {
    const g = ctx.createLinearGradient(0, y, 0, y + 7);
    g.addColorStop(0, rgba(225, 228, 230));
    g.addColorStop(1, rgba(150, 155, 160));
    ctx.fillStyle = g;
    ctx.fillRect(4, y, w - 8, 7);
  }
  frame(ctx, 0, 0, w, h, 4, [180, 184, 188]);
}

function acLuar(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(236, 234, 226);
  ctx.fillRect(0, 0, w, h);
  const r = h * 0.36;
  const cx = w * 0.38;
  const cy = h * 0.5;
  ctx.fillStyle = rgba(60, 62, 64);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(200, 200, 196);
  ctx.lineWidth = 2;
  for (let k = 1; k <= 4; k += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, (r * k) / 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = rgba(150, 150, 146);
  for (let y = 10; y < h - 10; y += 6) ctx.fillRect(w * 0.76, y, w * 0.18, 3);
  streaks(ctx, w, h, rnd, 6, [120, 110, 90], 0.25);
}

function exhaust(ctx, w, h) {
  ctx.fillStyle = rgba(170, 174, 176);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgba(40, 42, 44);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(150, 154, 156);
  for (let k = 0; k < 6; k += 1) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((k * Math.PI) / 3);
    ctx.fillRect(0, -5, w * 0.36, 10);
    ctx.restore();
  }
}

function lampu(ctx, w, h) {
  ctx.fillStyle = rgba(90, 92, 94);
  ctx.fillRect(0, h * 0.3, w, h * 0.4);
  ctx.fillStyle = rgba(255, 252, 240);
  ctx.fillRect(w * 0.08, h * 0.4, w * 0.84, h * 0.2);
}

function pintuKayu(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(96, 64, 40);
  ctx.fillRect(0, 0, w, h);
  const t = 8;
  ctx.fillStyle = rgba(140, 94, 58);
  ctx.fillRect(t, t, w - 2 * t, h - 2 * t);
  for (let y = t + 6; y < h * 0.22; y += 7) { // krepyak ventilasi
    ctx.fillStyle = rgba(70, 46, 28);
    ctx.fillRect(t + 6, y, w - 2 * t - 12, 3);
  }
  ctx.strokeStyle = rgba(90, 60, 36);
  ctx.lineWidth = 3;
  ctx.strokeRect(t + 10, h * 0.27, w - 2 * t - 20, h * 0.3);
  ctx.strokeRect(t + 10, h * 0.62, w - 2 * t - 20, h * 0.3);
  ctx.fillStyle = rgba(210, 210, 205);
  ctx.fillRect(w - t - 18, h * 0.55, 10, 4);
  streaks(ctx, w, h, rnd, 8, [50, 30, 20], 0.15);
}

function pintuKaca(ctx, w, h) {
  ctx.fillStyle = rgba(...ALU);
  ctx.fillRect(0, 0, w, h);
  for (let l = 0; l < 2; l += 1) {
    const x = 6 + l * (w / 2 - 3);
    interior(ctx, x, 6, w / 2 - 9, h - 18, false);
    ctx.fillStyle = rgba(160, 190, 210, 0.45);
    ctx.fillRect(x, 6, w / 2 - 9, h * 0.4);
    ctx.fillStyle = rgba(220, 222, 224);
    ctx.fillRect(x + (l ? 4 : w / 2 - 17), h * 0.5, 4, 30);
  }
}

function pintuGanda(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(88, 60, 38);
  ctx.fillRect(0, 0, w, h);
  interior(ctx, 8, 8, w - 16, h * 0.16, false); // jendela atas (bovenlicht)
  ctx.fillStyle = rgba(170, 196, 212, 0.5);
  ctx.fillRect(8, 8, w - 16, h * 0.08);
  for (let l = 0; l < 2; l += 1) {
    const x = 8 + l * (w / 2 - 4);
    const lw = w / 2 - 12;
    ctx.fillStyle = rgba(138, 92, 56);
    ctx.fillRect(x, h * 0.2, lw, h * 0.78);
    interior(ctx, x + 10, h * 0.25, lw - 20, h * 0.3, false);
    ctx.fillStyle = rgba(170, 196, 212, 0.4);
    ctx.fillRect(x + 10, h * 0.25, lw - 20, h * 0.12);
    ctx.strokeStyle = rgba(86, 56, 34);
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 10, h * 0.62, lw - 20, h * 0.3);
  }
  ctx.fillStyle = rgba(214, 214, 208);
  ctx.fillRect(w / 2 - 12, h * 0.6, 8, 4);
  ctx.fillRect(w / 2 + 4, h * 0.6, 8, 4);
  speckle(ctx, w, h, rnd, 80, [40, 30, 20], 0.2, 1);
}

function pintuGulung(ctx, w, h, rnd) {
  for (let y = 0; y < h; y += 8) {
    const g = ctx.createLinearGradient(0, y, 0, y + 8);
    g.addColorStop(0, rgba(170, 182, 176));
    g.addColorStop(0.6, rgba(140, 152, 146));
    g.addColorStop(1, rgba(96, 104, 100));
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, 8);
  }
  ctx.fillStyle = rgba(80, 86, 84);
  ctx.fillRect(0, h - 12, w, 12);
  ctx.fillRect(w / 2 - 14, h - 26, 28, 6);
  streaks(ctx, w, h, rnd, 14, [140, 80, 40], 0.3, 0.5);
  blotches(ctx, w, h, rnd, 6, [120, 70, 35], 0.25, 6, 20);
}

/**
 * Strip roster: 8 × 2 blok beton 20 × 20 cm (32 px) per sel 256 × 64 (satu ubin = 1,6 × 0,4 m) dengan lubang
 * `hole(ctx, s)` per blok; tepi lubang digelapkan sebagai kesan kedalaman, lubang dibuat transparan.
 */
function roster(hole) {
  return (ctx, w, h, rnd) => {
    const s = h / 2;
    ctx.fillStyle = rgba(160, 158, 152);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        ctx.fillStyle = rgba(238, 236, 230);
        ctx.fillRect(x + 1.5, y + 1.5, s - 3, s - 3);
      }
    }
    speckle(ctx, w, h, rnd, 300, [130, 126, 118], 0.3, 1);
    const each = (fn) => {
      for (let y = 0; y < h; y += s) {
        for (let x = 0; x < w; x += s) {
          ctx.save();
          ctx.translate(x, y);
          ctx.beginPath();
          hole(ctx, s);
          fn();
          ctx.restore();
        }
      }
    };
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = rgba(150, 146, 138);
    each(() => ctx.stroke());
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    each(() => ctx.fill());
    ctx.restore();
  };
}

const ROSTER_HOLES = {
  kotak: (ctx, s) => {
    const c = (s - 6) / 3;
    for (let j = 0; j < 3; j += 1) for (let i = 0; i < 3; i += 1) ctx.rect(4 + i * c, 4 + j * c, c - 2.5, c - 2.5);
  },
  lingkaran: (ctx, s) => {
    ctx.moveTo(s / 2 + s * 0.33, s / 2);
    ctx.arc(s / 2, s / 2, s * 0.33, 0, Math.PI * 2);
  },
  silang: (ctx, s) => {
    const m = s / 2;
    const a = s * 0.36;
    const g = s * 0.06;
    ctx.moveTo(m, m - g); ctx.lineTo(m - a + g, m - a); ctx.lineTo(m + a - g, m - a); ctx.closePath();
    ctx.moveTo(m + g, m); ctx.lineTo(m + a, m - a + g); ctx.lineTo(m + a, m + a - g); ctx.closePath();
    ctx.moveTo(m, m + g); ctx.lineTo(m + a - g, m + a); ctx.lineTo(m - a + g, m + a); ctx.closePath();
    ctx.moveTo(m - g, m); ctx.lineTo(m - a, m + a - g); ctx.lineTo(m - a, m - a + g); ctx.closePath();
  },
  bunga: (ctx, s) => {
    const m = s / 2;
    const r = s * 0.16;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      ctx.moveTo(m + dx * r * 1.25 + r, m + dy * r * 1.25);
      ctx.arc(m + dx * r * 1.25, m + dy * r * 1.25, r, 0, Math.PI * 2);
    }
  },
  krawangan: (ctx, s) => {
    const rh = (s - 6) / 3;
    for (let j = 0; j < 3; j += 1) {
      const off = j % 2 ? s * 0.25 : 0;
      ctx.rect(Math.max(3, off + 3 - s * 0.25), 3 + j * rh, s * 0.42, rh - 2.5);
      ctx.rect(Math.min(s - 3 - s * 0.42, off + 3 + s * 0.25), 3 + j * rh, s * 0.42, rh - 2.5);
    }
  },
};

/** Layar logam perforasi (dicat netral terang; warna oranye-terakota dari palet `screen`). */
function layar(cut) {
  return (ctx, w, h, rnd) => {
    ctx.fillStyle = rgba(246, 240, 234);
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rnd, 6, [210, 200, 190], 0.15, 20, 60);
    ctx.fillStyle = rgba(150, 140, 130, 0.6);
    ctx.fillRect(0, 0, w, 3);
    ctx.fillRect(0, 0, 3, h);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    cut(ctx, w, h);
    ctx.fill();
    ctx.restore();
  };
}

const LAYAR_CUTS = {
  segitiga: (ctx, w, h) => { // baris segitiga berselang naik/turun (zig-zag) ±23 cm
    const s = 48;
    for (let j = 0; j * s < h; j += 1) {
      for (let i = -1; i * s < w + s; i += 1) {
        const x = i * s + (j % 2 ? s / 2 : 0);
        const y = j * s + 4;
        const up = (i + j) % 2 === 0;
        if (up) { ctx.moveTo(x + 6, y + s - 10); ctx.lineTo(x + s / 2, y + 4); ctx.lineTo(x + s - 6, y + s - 10); }
        else { ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + s - 6, y + 4); ctx.lineTo(x + s / 2, y + s - 10); }
        ctx.closePath();
      }
    }
  },
  vertikal: (ctx, w, h) => { // celah vertikal berselang (Integrated Laboratory)
    for (let x = 12, k = 0; x < w - 10; x += 24, k += 1) {
      const off = k % 2 ? 44 : 10;
      for (let y = off; y < h - 30; y += 96) ctx.rect(x, y, 11, 78);
    }
  },
  wajik: (ctx, w, h) => { // kisi diagonal (HSC): lubang wajik besar, batang ±5 cm
    const s = 64;
    for (let y = -s; y < h + s; y += s / 2) {
      const row = Math.round(y / (s / 2));
      for (let x = -s; x < w + s; x += s) {
        const cx = x + (row % 2 ? s / 2 : 0);
        ctx.moveTo(cx, y + 6); ctx.lineTo(cx + s / 2 - 6, y + s / 2); ctx.lineTo(cx, y + s - 6); ctx.lineTo(cx - s / 2 + 6, y + s / 2);
        ctx.closePath();
      }
    }
  },
};

function railing(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = rgba(64, 74, 70);
  ctx.fillRect(0, 2, w, 10);
  ctx.fillRect(0, h - 22, w, 6);
  for (let x = 4; x < w; x += 16) ctx.fillRect(x, 12, 4, h - 30);
}

export const OPENING_PAINTERS = Object.freeze({
  nako: (ctx, w, h, rnd) => nako(ctx, w, h, rnd),
  'nako-tirai': (ctx, w, h, rnd) => nako(ctx, w, h, rnd, { tirai: true }),
  'nako-nyala': (ctx, w, h, rnd) => nako(ctx, w, h, rnd, { tirai: true, lit: true }),
  'jalusi-kayu': jalusiKayu,
  'kaca-biru': (ctx, w, h, rnd) => kacaBiru(ctx, w, h, rnd, false),
  'kaca-biru-nyala': (ctx, w, h, rnd) => kacaBiru(ctx, w, h, rnd, true),
  clerestory,
  'kaca-gelap': kacaGelap,
  'jalusi-alu': jalusiAlu,
  'ac-luar': acLuar,
  exhaust,
  lampu,
  'pintu-kayu': pintuKayu,
  'pintu-kaca': pintuKaca,
  'pintu-ganda': pintuGanda,
  'pintu-gulung': pintuGulung,
  'roster-kotak': roster(ROSTER_HOLES.kotak),
  'roster-lingkaran': roster(ROSTER_HOLES.lingkaran),
  'roster-silang': roster(ROSTER_HOLES.silang),
  'roster-bunga': roster(ROSTER_HOLES.bunga),
  'roster-krawangan': roster(ROSTER_HOLES.krawangan),
  'layar-segitiga': layar(LAYAR_CUTS.segitiga),
  'layar-vertikal': layar(LAYAR_CUTS.vertikal),
  'layar-wajik': layar(LAYAR_CUTS.wajik),
  railing,
});
```

- [ ] **Step 4: `atlasPaint.misc.js`**

`src/world/kit/atlasPaint.misc.js`:
```js
/**
 * Pelukis sel atlas: benda kecil (tandon, etalase, tempat wudu, rak sandal, bendera, tangga), sel potong
 * alami (besi tulangan, ilalang, jemuran almamater, tanaman pot) dan fasad LOD1 (satu bay dilukis datar).
 * GLOW_RECTS: area menyala per sel (pecahan 0..1 dari sel, koordinat canvas atas→bawah) untuk peta emisif.
 */
import { blotches, mottle, rgba, speckle, streaks } from './atlasPaint.surfaces.js';

const BIRU_LANGIT = [126, 182, 224]; // almamater UNRI "biru langit" [T]

/** Persegi dalam pecahan sel. */
const fr = (ctx, w, h, [x, y, rw, rh], color) => {
  ctx.fillStyle = color;
  ctx.fillRect(x * w, y * h, rw * w, rh * h);
};

function gelap(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(20, 22, 24));
  g.addColorStop(1, rgba(40, 42, 44));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function besi(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [86, 92, 96], 0.05, 4);
  streaks(ctx, w, h, rnd, 6, [140, 80, 40], 0.3);
}

function kayuTiang(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [132, 88, 54], 0.06, 4);
  ctx.strokeStyle = rgba(80, 52, 30, 0.4);
  for (let i = 0; i < 10; i += 1) {
    const x = rnd.next() * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.7, x + 3, h);
    ctx.stroke();
  }
}

function tandon(ctx, w, h) {
  for (let y = 0; y < h; y += 16) {
    const g = ctx.createLinearGradient(0, y, 0, y + 16);
    g.addColorStop(0, rgba(232, 140, 60));
    g.addColorStop(0.5, rgba(214, 118, 44));
    g.addColorStop(1, rgba(170, 90, 30));
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, 16);
  }
}

function lisplang(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [246, 245, 240], 0.01, 8);
  const g = ctx.createLinearGradient(0, h * 0.6, 0, h);
  g.addColorStop(0, rgba(90, 86, 80, 0));
  g.addColorStop(1, rgba(90, 86, 80, 0.35));
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.6, w, h * 0.4);
}

function talang(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(210, 214, 216));
  g.addColorStop(0.5, rgba(150, 156, 160));
  g.addColorStop(1, rgba(110, 114, 118));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function papanKosong(ctx, w, h) {
  ctx.fillStyle = rgba(22, 22, 24);
  ctx.fillRect(0, 0, w, h);
}

/** Spanduk menu kantin: blok warna + baris "teks" semu (tanpa kata — isi menu asli tidak diketahui). */
function spandukMenu(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(246, 206, 60);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgba(200, 40, 40);
  ctx.fillRect(0, 0, w, h * 0.3);
  ctx.fillStyle = rgba(40, 40, 40);
  for (let i = 0; i < 4; i += 1) ctx.fillRect(w * 0.3 + i * w * 0.16, h * 0.42, w * 0.12, h * 0.12);
  for (let i = 0; i < 4; i += 1) ctx.fillRect(w * 0.3 + i * w * 0.16, h * 0.66, w * 0.08 + rnd.next() * w * 0.05, h * 0.1);
  ctx.fillStyle = rgba(255, 255, 255);
  ctx.beginPath();
  ctx.arc(w * 0.14, h * 0.62, h * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

function etalase(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(200, 204, 208);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgba(70, 80, 88);
  ctx.fillRect(6, 6, w - 12, h * 0.62);
  const dishes = [[200, 120, 40], [240, 220, 160], [120, 160, 70], [180, 60, 40], [230, 200, 90]];
  for (let s = 0; s < 2; s += 1) {
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = rgba(...rnd.pick(dishes));
      ctx.beginPath();
      ctx.ellipse(20 + i * (w - 40) / 5, 26 + s * h * 0.28, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = rgba(255, 255, 255, 0.3);
  ctx.fillRect(6, 6, w - 12, 8);
  ctx.fillStyle = rgba(150, 110, 70);
  ctx.fillRect(0, h * 0.68, w, h * 0.32);
}

function tempatWudu(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [210, 226, 232], 0.02, 16);
  ctx.fillStyle = rgba(150, 165, 170, 0.8);
  for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 1, h);
  for (let i = 0; i < 6; i += 1) {
    const x = (i + 0.5) * (w / 6);
    ctx.fillStyle = rgba(200, 204, 208);
    ctx.fillRect(x - 3, h * 0.35, 6, 14);
    ctx.fillRect(x - 3, h * 0.35 + 10, 12, 4);
  }
  ctx.fillStyle = rgba(90, 96, 100);
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
}

function rakSandal(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(110, 78, 50);
  ctx.fillRect(0, 0, w, h);
  const colors = [[30, 30, 30], [40, 80, 160], [200, 60, 60], [230, 200, 60], [90, 90, 90], [240, 240, 240]];
  for (let s = 0; s < 3; s += 1) {
    const y = 6 + s * (h / 3);
    ctx.fillStyle = rgba(150, 110, 70);
    ctx.fillRect(0, y + h / 3 - 10, w, 4);
    for (let x = 6; x < w - 20; x += 22) {
      if (rnd.chance(0.25)) continue;
      ctx.fillStyle = rgba(...rnd.pick(colors));
      ctx.fillRect(x, y + h / 3 - 18, 18, 8);
    }
  }
}

function mejaBangku(ctx, w, h, rnd) {
  for (let y = 0; y < h; y += 16) {
    const k = 0.85 + rnd.next() * 0.25;
    ctx.fillStyle = rgba(170 * k, 120 * k, 76 * k);
    ctx.fillRect(0, y, w, 15);
  }
  speckle(ctx, w, h, rnd, 120, [60, 40, 20], 0.3, 1.5);
}

function bendera(ctx, w, h) {
  ctx.fillStyle = rgba(206, 17, 38);
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = rgba(250, 250, 250);
  ctx.fillRect(0, h / 2, w, h / 2);
}

function potTanah(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [178, 96, 60], 0.06, 4);
  ctx.fillStyle = rgba(150, 78, 48);
  ctx.fillRect(0, 0, w, h * 0.16);
}

function tangga(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [210, 206, 198], 0.03, 4);
  for (let y = 0; y < h; y += 32) {
    ctx.fillStyle = rgba(120, 116, 108, 0.6);
    ctx.fillRect(0, y, w, 3);
  }
}

function besiTulangan(ctx, w, h, rnd) {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 4; i += 1) {
    const x = w * (0.2 + i * 0.2);
    ctx.strokeStyle = rgba(130 + rnd.next() * 30, 70, 36);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + (rnd.next() - 0.5) * 6, h * 0.2);
    ctx.quadraticCurveTo(x + 4, h * 0.05, x + 18 * (rnd.chance(0.5) ? 1 : -1), h * 0.08 + rnd.next() * 10);
    ctx.stroke();
  }
}

/** Rumpun rumput tinggi; `plume` = malai alang-alang putih. */
function grass(ctx, w, h, rnd, blades, plume) {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < blades; i += 1) {
    const x = w * (0.1 + rnd.next() * 0.8);
    const top = h * (0.05 + rnd.next() * 0.45);
    const lean = (rnd.next() - 0.5) * w * 0.4;
    const k = 0.75 + rnd.next() * 0.4;
    ctx.strokeStyle = rgba(110 * k, 150 * k, 60 * k);
    ctx.lineWidth = 2 + rnd.next() * 2;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top);
    ctx.stroke();
    if (plume && rnd.chance(0.35)) {
      ctx.fillStyle = rgba(236, 232, 214, 0.95);
      ctx.beginPath();
      ctx.ellipse(x + lean, top, 3, 10, lean / w, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Jemuran: tali + almamater biru langit, kaus, handuk (pola umum asrama/sekre [INF]). */
function jemuran(ctx, w, h, rnd) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = rgba(60, 60, 60);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.quadraticCurveTo(w / 2, 22, w, 12);
  ctx.stroke();
  const clothes = [BIRU_LANGIT, BIRU_LANGIT, [240, 240, 236], [40, 40, 44], [200, 60, 60], [230, 200, 80], [90, 140, 90]];
  let x = 6;
  while (x < w - 30) {
    const cw = 30 + rnd.next() * 30;
    const ch = 60 + rnd.next() * 90;
    const c = rnd.pick(clothes);
    ctx.fillStyle = rgba(...c);
    ctx.fillRect(x, 16, cw, ch);
    if (c === BIRU_LANGIT) { // lengan jaket
      ctx.fillRect(x - 6, 18, 6, ch * 0.7);
      ctx.fillRect(x + cw, 18, 6, ch * 0.7);
      ctx.fillStyle = rgba(30, 50, 90);
      ctx.fillRect(x + cw / 2 - 1, 18, 2, ch);
    }
    ctx.fillStyle = rgba(0, 0, 0, 0.12);
    ctx.fillRect(x, 16, cw, 6);
    x += cw + 8 + rnd.next() * 10;
  }
}

function tanamanPot(ctx, w, h, rnd) {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 26; i += 1) {
    const a = -Math.PI / 2 + (rnd.next() - 0.5) * 2.4;
    const len = h * (0.3 + rnd.next() * 0.45);
    const k = 0.7 + rnd.next() * 0.4;
    ctx.fillStyle = rgba(60 * k, 120 * k, 50 * k);
    ctx.save();
    ctx.translate(w / 2, h * 0.95);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -len / 2, 8 + rnd.next() * 8, len / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Fasad LOD1: satu bay satu lantai dilukis datar (dinding netral; diwarnai palet) ───────────────
const LOD1 = {
  kuliah: { win: [0.25, 0.3, 0.5, 0.42], roster: [0.25, 0.12, 0.5, 0.12] },
  adb: { screen: [0, 0.04, 1, 0.78] },
  lab: { win: [0.2, 0.36, 0.6, 0.34], clere: [0.1, 0.06, 0.8, 0.12] },
  rusun: { door: [0.08, 0.22, 0.24, 0.62], win: [0.48, 0.32, 0.36, 0.3], rail: [0, 0.6, 1, 0.26] },
  polos: { win: [0.36, 0.34, 0.28, 0.3] },
  aula: { win: [0.3, 0.22, 0.4, 0.36], vent: [0.1, 0.05, 0.8, 0.08] },
  jalusi: { jal: [0.22, 0.3, 0.56, 0.42] },
};

function lod1Base(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [240, 237, 230], 0.015, 16);
  fr(ctx, w, h, [0, 0.88, 1, 0.12], rgba(150, 150, 148)); // plint
  fr(ctx, w, h, [0, 0, 1, 0.03], rgba(200, 196, 188)); // balok lantai
  fr(ctx, w, h, [0, 0, 0.04, 1], rgba(226, 222, 214)); // kolom
}

function lod1Window(ctx, w, h, rect, lit) {
  fr(ctx, w, h, rect, lit ? rgba(240, 220, 170) : rgba(52, 60, 68));
  ctx.fillStyle = rgba(200, 214, 224, lit ? 0.25 : 0.45);
  const [x, y, rw, rh] = rect;
  for (let k = 0; k < 8; k += 1) ctx.fillRect(x * w, (y + (k / 8) * rh) * h, rw * w, 2);
  ctx.fillStyle = rgba(190, 194, 198);
  ctx.fillRect((x + rw / 2) * w - 2, y * h, 4, rh * h);
}

function lod1(kind, lit) {
  const spec = LOD1[kind];
  return (ctx, w, h, rnd) => {
    lod1Base(ctx, w, h, rnd);
    if (spec.roster) fr(ctx, w, h, spec.roster, rgba(150, 146, 138));
    if (spec.win) lod1Window(ctx, w, h, spec.win, lit);
    if (spec.clere) lod1Window(ctx, w, h, spec.clere, false);
    if (spec.vent) fr(ctx, w, h, spec.vent, rgba(120, 124, 128));
    if (spec.jal) {
      fr(ctx, w, h, spec.jal, rgba(122, 82, 50));
      for (let k = 0; k < 10; k += 1) fr(ctx, w, h, [spec.jal[0], spec.jal[1] + (k / 10) * spec.jal[3], spec.jal[2], 0.012], rgba(70, 46, 28));
    }
    if (spec.door) fr(ctx, w, h, spec.door, rgba(120, 82, 52));
    if (spec.rail) {
      for (let k = 0; k < 16; k += 1) fr(ctx, w, h, [k / 16, spec.rail[1], 0.012, spec.rail[3]], rgba(64, 74, 70));
      fr(ctx, w, h, [0, spec.rail[1], 1, 0.02], rgba(64, 74, 70));
    }
    if (spec.screen) {
      fr(ctx, w, h, spec.screen, rgba(196, 96, 47));
      ctx.fillStyle = rgba(120, 60, 30, lit ? 0.35 : 0.6);
      for (let y = 0; y < h * 0.8; y += 10) for (let x = (y / 10) % 2 ? 5 : 0; x < w; x += 10) ctx.fillRect(x, h * 0.04 + y, 4, 4);
    }
  };
}

function lod1Mangkrak(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [176, 172, 164], 0.05, 8);
  fr(ctx, w, h, [0.08, 0.06, 0.84, 0.8], rgba(40, 42, 44));
  blotches(ctx, w, h, rnd, 6, [110, 106, 98], 0.3, 10, 30);
  streaks(ctx, w, h, rnd, 6, [140, 80, 40], 0.3);
}

function lod1Kantin(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [230, 226, 218], 0.02, 16);
  fr(ctx, w, h, [0.06, 0.12, 0.88, 0.88], rgba(70, 64, 58));
  fr(ctx, w, h, [0.06, 0.66, 0.88, 0.08], rgba(150, 110, 70));
}

export const GLOW_RECTS = Object.freeze({
  'nako-nyala': [[0.06, 0.06, 0.88, 0.88]],
  'kaca-biru-nyala': [[0.04, 0.36, 0.92, 0.6]],
  lampu: [[0.08, 0.4, 0.84, 0.2]],
  'lod1-kuliah-nyala': [LOD1.kuliah.win],
  'lod1-adb-nyala': [[0.12, 0.24, 0.76, 0.06], [0.12, 0.5, 0.76, 0.06]],
  'lod1-rusun-nyala': [LOD1.rusun.win],
});

export const MISC_PAINTERS = Object.freeze({
  gelap,
  besi,
  'kayu-tiang': kayuTiang,
  tandon,
  lisplang,
  talang,
  'papan-kosong': papanKosong,
  'spanduk-menu': spandukMenu,
  etalase,
  'tempat-wudu': tempatWudu,
  'rak-sandal': rakSandal,
  'meja-bangku': mejaBangku,
  bendera,
  'pot-tanah': potTanah,
  tangga,
  'besi-tulangan': besiTulangan,
  'ilalang-kecil': (ctx, w, h, rnd) => grass(ctx, w, h, rnd, 26, false),
  ilalang: (ctx, w, h, rnd) => grass(ctx, w, h, rnd, 70, true),
  jemuran,
  'tanaman-pot': tanamanPot,
  'lod1-kuliah': lod1('kuliah', false),
  'lod1-kuliah-nyala': lod1('kuliah', true),
  'lod1-adb': lod1('adb', false),
  'lod1-adb-nyala': lod1('adb', true),
  'lod1-lab': lod1('lab', false),
  'lod1-rusun': lod1('rusun', false),
  'lod1-rusun-nyala': lod1('rusun', true),
  'lod1-mangkrak': lod1Mangkrak,
  'lod1-polos': lod1('polos', false),
  'lod1-kantin': lod1Kantin,
  'lod1-aula': lod1('aula', false),
  'lod1-jalusi': lod1('jalusi', false),
});
```

- [ ] **Step 5: `kitMaterials.js`**

Pakai `scope` eksplisit (bukan `currentScope()`): `withScope` hanya berlaku sinkron, sedangkan klaster dirakit di tugas scheduler lintas frame.

`src/world/kit/kitMaterials.js`:
```js
/**
 * Material kit gedung (spec §4.6): SATU atlas dibagi dua material agar draw call per klaster minimal —
 * 'opak' (dinding, atap, kaca, pintu, lampu; peta warna + kekasaran + emisif malam; warna vertex = palet) dan
 * 'potong' (roster, layar perforasi, railing, ilalang, jemuran; alphaTest, dua sisi, ikut bayangan berpola).
 * Papan nama punya material per klaster (signs.js). Di-cache per ResourceScope (scope EKSPLISIT, bukan
 * currentScope: aman dipanggil dari tugas scheduler). Tanpa canvas (Node/tes) → tekstur 1×1 netral.
 */
import {
  ClampToEdgeWrapping, CanvasTexture, Color, DataTexture, DoubleSide, LinearFilter, LinearMipmapLinearFilter,
  MeshStandardMaterial, NoColorSpace, RGBAFormat, SRGBColorSpace,
} from 'three';
import { createAtlasCanvases } from './atlas.js';

export const KIT_NIGHT = Object.freeze({ on: 1.0, off: 0 });
const GLOW_COLOR = 0xffe2b0;

function finish(tex, srgb, anisotropy) {
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function solid(rgb) {
  return new DataTexture(new Uint8Array([rgb[0], rgb[1], rgb[2], 255]), 1, 1, RGBAFormat);
}

/** Tekstur atlas (canvas di browser, 1×1 netral di Node). */
export function createAtlasTextures({ anisotropy = 8, createCanvas } = {}) {
  const canvases = createAtlasCanvases(createCanvas ? { createCanvas } : {});
  if (!canvases) {
    return {
      ready: false,
      map: finish(solid([235, 232, 226]), true, 1),
      roughnessMap: finish(solid([230, 230, 230]), false, 1),
      emissiveMap: finish(solid([0, 0, 0]), true, 1),
    };
  }
  return {
    ready: true,
    map: finish(new CanvasTexture(canvases.color), true, anisotropy),
    roughnessMap: finish(new CanvasTexture(canvases.rough), false, anisotropy),
    emissiveMap: finish(new CanvasTexture(canvases.glow), true, anisotropy),
  };
}

function buildKitMaterials(opts) {
  const tex = createAtlasTextures(opts);
  const opak = new MeshStandardMaterial({
    map: tex.map, roughnessMap: tex.roughnessMap, emissiveMap: tex.emissiveMap, emissive: new Color(GLOW_COLOR),
    emissiveIntensity: KIT_NIGHT.off, vertexColors: true, roughness: 1, metalness: 0,
  });
  opak.name = 'kit:opak';
  opak.userData.nightEmissive = { ...KIT_NIGHT };
  const potong = new MeshStandardMaterial({
    map: tex.map, roughnessMap: tex.roughnessMap, vertexColors: true, roughness: 1, metalness: 0,
    alphaTest: 0.5, side: DoubleSide,
  });
  potong.name = 'kit:potong';
  return Object.freeze({ opak, potong, textures: tex, atlasReady: tex.ready });
}

function disposeKit(kit) {
  kit.opak.dispose();
  kit.potong.dispose();
  for (const t of Object.values(kit.textures)) if (t?.isTexture) t.dispose();
}

/**
 * Material kit bersama per scope (sekali per scope; refcount scope). Lepas dengan scope.release('kit:materials')
 * atau scope.dispose().
 * @param {{get: Function}} scope ResourceScope
 * @param {{anisotropy?: number, createCanvas?: Function}} [opts]
 * @returns {{opak: MeshStandardMaterial, potong: MeshStandardMaterial, textures: object, atlasReady: boolean}}
 */
export function createKitMaterials(scope, opts = {}) {
  if (!scope || typeof scope.get !== 'function') throw new TypeError('createKitMaterials: scope wajib (ResourceScope)');
  return scope.get('kit:materials', () => buildKitMaterials(opts), { dispose: disposeKit });
}
```

- [ ] **Step 6: `signs.js`**

`src/world/kit/signs.js`:
```js
/**
 * Papan nama gedung (N05, spec §7.1): satu atlas canvas PER KLASTER (1024 × 2^n, dua kolom sel
 * 512 × 64 = rasio 8:1 per papan) → satu material 'papan' per klaster (1 draw call). Gaya 'panel' = panel hitam huruf
 * putih kapital [T gedung ADB]; 'timbul' = huruf gelap tanpa latar (alphaTest) [INF gedung lama]. Tanpa canvas
 * (Node) → null (papan dilewati). Quad ditempel di sisi utama massa 0 pada `out` meter dari bidang dinding.
 */
import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { facePoint } from './planGeom.js';

export const SIGN_ATLAS = Object.freeze({ width: 1024, cellW: 512, cellH: 64, pad: 8 });
const FONT = "'Inter Variable', 'Arial Narrow', Arial, sans-serif";

function defaultCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Ukuran font terbesar yang muat lebar maksimum. */
function fitFont(ctx, text, maxW, maxPx) {
  let px = maxPx;
  ctx.font = `700 ${px}px ${FONT}`;
  while (px > 10 && ctx.measureText(text).width > maxW) {
    px -= 2;
    ctx.font = `700 ${px}px ${FONT}`;
  }
  return px;
}

function drawSign(ctx, sign, x, y) {
  const { cellW, cellH, pad } = SIGN_ATLAS;
  if (sign.style === 'panel') {
    ctx.fillStyle = '#161616';
    ctx.fillRect(x, y, cellW, cellH);
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.clearRect(x, y, cellW, cellH);
  }
  fitFont(ctx, sign.text, cellW - pad * 2, cellH * 0.62);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (sign.style === 'timbul') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(sign.text, x + cellW / 2 - 2, y + cellH / 2 - 2);
    ctx.fillStyle = '#3b352e';
  }
  ctx.fillText(sign.text, x + cellW / 2, y + cellH / 2);
}

/**
 * @param {Array<{text:string, style:'panel'|'timbul'}>} signs
 * @param {{createCanvas?: Function}} [opts]
 * @returns {{material: MeshStandardMaterial, uvOf(i:number): {u0:number,v0:number,u1:number,v1:number}, dispose(): void}|null}
 */
export function createSignAtlas(signs, { createCanvas = defaultCanvas } = {}) {
  if (!signs.length) return null;
  const rows = Math.ceil(signs.length / 2);
  const height = Math.max(SIGN_ATLAS.cellH, 2 ** Math.ceil(Math.log2(rows * SIGN_ATLAS.cellH)));
  const canvas = createCanvas(SIGN_ATLAS.width, height);
  const ctx = canvas?.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, SIGN_ATLAS.width, height);
  signs.forEach((s, i) => drawSign(ctx, s, (i % 2) * SIGN_ATLAS.cellW, Math.floor(i / 2) * SIGN_ATLAS.cellH));
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  const material = new MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.6, metalness: 0 });
  material.name = 'kit:papan';
  return {
    material,
    uvOf(i) {
      const x = (i % 2) * SIGN_ATLAS.cellW;
      const y = Math.floor(i / 2) * SIGN_ATLAS.cellH;
      return { u0: (x + 2) / SIGN_ATLAS.width, u1: (x + SIGN_ATLAS.cellW - 2) / SIGN_ATLAS.width, v0: 1 - (y + SIGN_ATLAS.cellH - 2) / height, v1: 1 - (y + 2) / height };
    },
    dispose() {
      map.dispose();
      material.dispose();
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

/** Kumpulkan papan semua plan (urutan stabil) → [{plan, sign}]. */
export function collectSigns(plans) {
  return plans.flatMap((plan) => plan.signs.map((sign) => ({ plan, sign })));
}

/** Tulis quad papan ke sink.papan memakai UV atlas klaster. */
export function appendSigns(sink, entries, atlas) {
  if (!atlas) return 0;
  entries.forEach(({ plan, sign }, i) => {
    const face = plan.masses[sign.mass].faces.find((f) => f.id === sign.face);
    if (!face) return;
    const yC = plan.baseY + sign.y;
    const p = (u, y) => {
      const [x, z] = facePoint(face, u, sign.out);
      return [x, y, z];
    };
    const h = sign.h;
    const w = Math.min(sign.w, (h * SIGN_ATLAS.cellW) / SIGN_ATLAS.cellH);
    sink.papan.quad(p(sign.u - w / 2, yC - h / 2), p(sign.u + w / 2, yC - h / 2), p(sign.u + w / 2, yC + h / 2), p(sign.u - w / 2, yC + h / 2), atlas.uvOf(i));
  });
  return entries.length;
}
```

- [ ] **Step 7: Lint & commit**

Run: `node node_modules/eslint/bin/eslint.js src/world/kit`
Expected: 0 galat.

```bash
git add src/world/kit/kitBuilder.js src/world/kit/kitShapes.js src/world/kit/atlas.js src/world/kit/atlasPaint.surfaces.js src/world/kit/atlasPaint.openings.js src/world/kit/atlasPaint.misc.js src/world/kit/kitMaterials.js src/world/kit/signs.js
```
```bash
git commit -m "feat(kit): atlas fasad prosedural 2048 (73 sel), sink geometri, material opak/potong, papan nama"
```

---

## Task 9: Fasad, bukaan, atap, ornamen

**Files:**
- Create: `src/world/kit/facade.js`, `src/world/kit/openings.js`, `src/world/kit/roofs.js`, `src/world/kit/ornaments.js`

Isi per elemen (semua ke sink; tiap bay memetakan sel penuh sehingga tekstur menerus):
- Dinding bay dipotong lubang (strip vertikal × interval y), kusen masuk 12 cm, isi mundur 8 cm, ambang menonjol, roster tembus (sel potong) dengan latar `gelap` 30 cm di belakang (tidak tembus pandang ke sisi lain), AC luar, pita plint (kaki `footY` → `baseY + plinth`, terpotong di pintu), pita balok antar-lantai.
- Selasar: lantai keramik/rabat + kaki plint, kolom 0,3 m di tepi footprint pada setiap batas bay, balok + plafon tiap lantai, railing di lantai atas, lampu TL tiap 2 bay (emisif malam).
- K03: layar perforasi per bay (celah 0,35 m memperlihatkan kolom putih) pada bidang luar `corridorDepth + 0,3`.
- K07: kolom keliling, lantai, dinding belakang setengah (keramik); varian `parkir` tiang besi tanpa dinding.
- K10: grid kolom keliling + dalam, plat tiap lantai, isian bata/coretan, besi tulangan di puncak (rangka), ilalang.
- Atap: pelana (tebeng pentagon, bubungan, lisplang ujung miring), limas (perisai), pelana-lebar K03 (lisplang 0,35 m), limas-tumpang musala (dua tingkat + pita jalusi + mustaka), datar-parapet (plat + parapet 0,9 m + coping; poligon ditriangulasi `ShapeUtils`), kubah kecil (drum + kubah + mahkota); plafon tritisan, talang dua sisi panjang, pipa turun di empat sudut.

- [ ] **Step 1: `facade.js`**

`src/world/kit/facade.js`:
```js
/**
 * Fasad (spec §7.2 langkah 4): dinding per bay per lantai yang dipotong bukaan, pita plint, balok lantai,
 * selasar (lantai, kolom, balok, railing, lampu), struktur terbuka K07 dan rangka K10, serta fasad LOD1
 * (satu quad ber-ubin per sisi per lantai dengan sel bay dilukis). Menulis ke sink (kitBuilder).
 */
import { cellUv } from './atlas.js';
import { subUv } from './kitBuilder.js';
import { facePoint } from './planGeom.js';
import { buildOpening } from './openings.js';
import { floorPolygon, subtractIntervals, wallQuad, wallTiled, wp, yawOf } from './kitShapes.js';

export const FACADE = Object.freeze({
  plinthOut: 0.03, bandH: 0.3, bandOut: 0.06, column: 0.3, beamH: 0.35, beamD: 0.25, railH: 1.0,
  slabT: 0.15, lampEvery: 2, lampY: 0.4,
});

/** Dinding satu bay satu lantai dipotong lubang bukaan (strip vertikal × interval y). UV menerus per bay. */
function bayWall(b, face, bay, y0, fh, holes, cell, color) {
  const xs = [...new Set([bay.u0, bay.u1, ...holes.flatMap((h) => [h.u0, h.u1])])].sort((p, q) => p - q);
  const r = cellUv(cell);
  for (let i = 0; i + 1 < xs.length; i += 1) {
    const s0 = xs[i];
    const s1 = xs[i + 1];
    if (s1 - s0 < 1e-3) continue;
    const mid = (s0 + s1) / 2;
    const cut = holes.filter((h) => h.u0 <= mid && h.u1 >= mid).map((h) => [h.y0, h.y1]);
    for (const [t0, t1] of subtractIntervals(0, fh, cut)) {
      const uv = subUv(r, (s0 - bay.u0) / (bay.u1 - bay.u0), t0 / fh, (s1 - bay.u0) / (bay.u1 - bay.u0), t1 / fh);
      wallQuad(b, face, s0, s1, y0 + t0, y0 + t1, 0, uv, color);
    }
  }
}

const opsOf = (plan, mi, face, floor) => plan.openings.filter((o) => o.mass === mi && o.face === face.id && o.floor === floor);

/** Dinding + bukaan semua bay satu sisi luar (LOD0): per lantai per bay, pita lantai, plint. `yield` per lantai. */
export function* faceWallSteps(sink, plan, mass, mi, face, ctx) {
  const wallCell = plan.style.stain ? 'plester-kusam' : 'plester';
  const faceBays = plan.bays.filter((x) => x.mass === mi && x.face === face.id);
  const faceOps = plan.openings.filter((o) => o.mass === mi && o.face === face.id);
  let y = plan.baseY;
  for (let f = 0; f < plan.floors; f += 1) {
    const fh = plan.floorH[f];
    const ops = faceOps.filter((o) => o.floor === f);
    for (const bay of faceBays) {
      const inBay = ops.filter((o) => o.u0 >= bay.u0 - 1e-6 && o.u1 <= bay.u1 + 1e-6);
      const holes = inBay.filter((o) => o.kind !== 'balkon' && o.kind !== 'bata');
      bayWall(sink.opak, face, bay, y, fh, holes, wallCell, ctx.colors.wall);
      for (const op of inBay) buildOpening(sink, plan, face, op, y, ctx);
    }
    if (f + 1 < plan.floors) floorBand(sink.opak, face, y + fh, ctx);
    y += fh;
    yield;
  }
  plinthBand(sink.opak, plan, mass, face, mi, ctx);
}

/** Pita balok lantai di antara lantai (menonjol). */
function floorBand(b, face, y, ctx) {
  for (const [s, e] of face.exterior) {
    wallTiled(b, face, s, e, y - FACADE.bandH / 2, y + FACADE.bandH / 2, FACADE.bandOut, 'beton', 3, 0.6, ctx.colors.trim);
  }
}

/** Plint: dari kaki (footY) sampai baseY + plinth, dipotong pintu lantai dasar. */
function plinthBand(b, plan, mass, face, mi, ctx) {
  const top = plan.baseY + (ctx.arch.plinth ?? 0.45);
  const doors = opsOf(plan, mi, face, 0).filter((o) => o.y0 === 0).map((o) => [o.u0, o.u1]);
  for (const [s, e] of face.exterior) {
    for (const [p0, p1] of subtractIntervals(s, e, doors)) {
      wallTiled(b, face, p0, p1, plan.footY, top, FACADE.plinthOut, 'plint', 2, 1, ctx.colors.plinth);
    }
  }
}

/** Fasad LOD1 satu sisi: per lantai satu bidang ber-ubin selebar bay (sel bay dilukis; sebagian menyala). */
export function faceWallsLod1(sink, plan, face, mi, ctx) {
  const n = Math.max(1, face.bays);
  let y = plan.baseY;
  for (let f = 0; f < plan.floors; f += 1) {
    const fh = plan.floorH[f];
    const lit = ctx.lod1Lit && ((plan.seed >>> ((f * 3 + mi * 5 + face.id.length) % 24)) & 3) === 0;
    const cell = lit ? ctx.lod1LitCell : ctx.lod1Cell;
    for (const [s, e] of face.exterior) {
      const tw = (e - s) / Math.max(1, Math.round((e - s) / (face.len / n)));
      wallTiled(sink.opak, face, s, e, y, y + fh, 0, cell, tw, fh, ctx.colors.wall);
    }
    y += fh;
  }
}

/** K12 satu sisi (spec §7.1 "ekstrusi + parapet + modul jendela beratlas"): fasad dilukis + pita + plint + pintu. */
export function facePainted(sink, plan, mass, mi, face, ctx) {
  faceWallsLod1(sink, plan, face, mi, ctx);
  let y = plan.baseY;
  for (let f = 0; f + 1 < plan.floors; f += 1) {
    y += plan.floorH[f];
    floorBand(sink.opak, face, y, ctx);
  }
  plinthBand(sink.opak, plan, mass, face, mi, ctx);
  for (const op of opsOf(plan, mi, face, 0)) {
    wallQuad(sink.opak, face, op.u0, op.u1, plan.baseY + op.y0, plan.baseY + op.y1, 0.015, cellUv(op.cell), ctx.colors.white);
  }
}

/** Ujung kiri/kanan selasar: mundur sisi tetangga (menutup sudut footprint). */
function corridorSpan(mass, face) {
  const i = mass.faces.indexOf(face);
  const left = mass.faces[(i + 1) % mass.faces.length];
  const right = mass.faces[(i + mass.faces.length - 1) % mass.faces.length];
  return [-(mass.insets?.[left.id] ?? 0), face.len + (mass.insets?.[right.id] ?? 0)];
}

/** Bidang horizontal di zona selasar (u0..u1 × out0..out1) pada ketinggian y; up=true menghadap atas. */
function corridorPlane(b, face, u0, u1, out0, out1, y, cell, tile, color, up = true) {
  const p = (u, o) => wp(face, u, y, o);
  const U = [(face.b[0] - face.a[0]) / face.len, 0, (face.b[1] - face.a[1]) / face.len];
  const N = [face.n[0], 0, face.n[1]];
  if (up) b.tiled(p(u0, out1), U, [-N[0], 0, -N[2]], [[0, 0], [u1 - u0, 0], [u1 - u0, out1 - out0], [0, out1 - out0]], tile, tile, cellUv(cell), color);
  else b.tiled(p(u0, out0), U, N, [[0, 0], [u1 - u0, 0], [u1 - u0, out1 - out0], [0, out1 - out0]], tile, tile, cellUv(cell), color);
}

/** Selasar: lantai/plat, kolom di tepi footprint per batas bay, balok, railing lantai atas, lampu. */
export function buildCorridors(sink, plan, mass, mi, ctx) {
  const depth = mass.corridor.depth;
  if (!depth) return;
  for (const id of mass.corridor.faces) {
    const face = mass.faces.find((f) => f.id === id);
    const [u0, u1] = corridorSpan(mass, face);
    const edge = depth - FACADE.column / 2;
    const bays = plan.bays.filter((x) => x.mass === mi && x.face === id);
    const cols = [...new Set([u0 + FACADE.column / 2, ...bays.map((x) => x.u0), u1 - FACADE.column / 2])].filter((u) => u >= u0 && u <= u1);
    const floorCell = ctx.arch.id === 'K10' || ctx.arch.id === 'K04' ? 'rabat' : 'keramik-lantai';
    corridorPlane(sink.opak, face, u0, u1, 0, depth, plan.baseY, floorCell, 1.6, ctx.colors.floor);
    wallTiled(sink.opak, face, u0, u1, plan.footY, plan.baseY, depth, 'plint', 2, 1, ctx.colors.plinth);
    let y = plan.baseY;
    for (let f = 0; f < plan.floors; f += 1) {
      const fh = plan.floorH[f];
      for (const u of cols) {
        const [x, z] = facePoint(face, u, edge);
        sink.opak.box(x, y + fh / 2, z, FACADE.column, fh, FACADE.column, yawOf(face), cellUv('beton'), ctx.colors.column);
      }
      const top = y + fh;
      wallTiled(sink.opak, face, u0, u1, top - FACADE.beamH, top, depth + 0.01, 'beton', 3.6, FACADE.beamH, ctx.colors.trim);
      corridorPlane(sink.opak, face, u0, u1, 0, depth, top - FACADE.beamH, 'plafon', 2.4, ctx.colors.fascia, false);
      if (f > 0) railings(sink.potong, face, cols, y, edge, ctx);
      lamps(sink.opak, face, bays, top - FACADE.lampY, depth / 2, ctx);
      if (f + 1 < plan.floors) corridorPlane(sink.opak, face, u0, u1, 0, depth, top, floorCell, 1.6, ctx.colors.floor);
      y = top;
    }
  }
}

function railings(b, face, cols, y, edge, ctx) {
  for (let i = 0; i + 1 < cols.length; i += 1) {
    const a = cols[i] + FACADE.column / 2;
    const c = cols[i + 1] - FACADE.column / 2;
    if (c - a > 0.2) wallTiled(b, face, a, c, y, y + FACADE.railH, edge, 'railing', 1.0, FACADE.railH, ctx.colors.white);
  }
}

function lamps(b, face, bays, y, out, ctx) {
  bays.forEach((bay, i) => {
    if (i % FACADE.lampEvery) return;
    const [x, z] = facePoint(face, (bay.u0 + bay.u1) / 2, out);
    b.box(x, y, z, 1.2, 0.06, 0.12, yawOf(face) + Math.PI / 2, cellUv('lampu'), ctx.colors.white);
  });
}

/** K07: kolom keliling di tepi footprint, lantai rabat/keramik, dinding belakang setengah (kantin). */
export function buildOpenStructure(sink, plan, mass, mi, ctx) {
  const parkir = plan.variant === 'parkir';
  const h = plan.height;
  for (const face of mass.faces) {
    const bays = plan.bays.filter((x) => x.mass === mi && x.face === face.id);
    for (const u of [...bays.map((x) => x.u0), face.len - FACADE.column / 2]) {
      const [x, z] = facePoint(face, Math.max(FACADE.column / 2, u), -FACADE.column / 2);
      sink.opak.box(x, plan.baseY + h / 2, z, FACADE.column, h, FACADE.column, 0, cellUv(parkir ? 'besi' : 'beton'), parkir ? ctx.colors.white : ctx.colors.column);
    }
    if (!parkir && face.role === 'belakang') {
      wallTiled(sink.opak, face, 0, face.len, plan.baseY, plan.baseY + 1.1, -0.05, 'keramik-dinding', 1.6, 1.1, ctx.colors.white);
    }
    wallTiled(sink.opak, face, 0, face.len, plan.footY, plan.baseY, 0, 'plint', 2, 1, ctx.colors.plinth);
  }
  const top = mass.faces[0];
  const ring = mass.faces.map((f) => [f.a[0], f.a[1]]);
  floorPolygon(sink.opak, ring, plan.baseY, parkir ? 'rabat' : 'keramik-lantai', ctx.colors.floor);
  if (top && !parkir) wallTiled(sink.opak, top, 0, top.len, plan.baseY + h - 0.45, plan.baseY + h, 0.02, 'lisplang', 3, 0.45, ctx.colors.fascia);
}

/** K10: kolom grid (keliling + dalam) tiap bay, plat tiap lantai, bata sebagian & lubang, besi tulangan di puncak. */
export function buildFrame(sink, plan, mass, mi, ctx) {
  const { obb, wall } = mass;
  const nx = Math.max(1, Math.round((wall.x1 - wall.x0) / ctx.arch.bay));
  const nz = Math.max(1, Math.round((wall.z1 - wall.z0) / ctx.arch.bay));
  const cos = Math.cos(obb.yaw);
  const sin = Math.sin(obb.yaw);
  const W = (lx, lz) => [obb.cx + lx * cos + lz * sin, obb.cz - lx * sin + lz * cos];
  let y = plan.baseY;
  for (let f = 0; f < plan.floors; f += 1) {
    const fh = plan.floorH[f];
    for (let i = 0; i <= nx; i += 1) {
      for (let j = 0; j <= nz; j += 1) {
        const [x, z] = W(wall.x0 + ((wall.x1 - wall.x0) * i) / nx, wall.z0 + ((wall.z1 - wall.z0) * j) / nz);
        sink.opak.box(x, y + fh / 2, z, 0.35, fh, 0.35, obb.yaw, cellUv('beton-mentah'), ctx.colors.column);
        if (f === plan.floors - 1 && plan.variant !== 'beratap') rebar(sink.potong, x, y + fh, z, ctx);
      }
    }
    const slabY = y + fh;
    const [cx, cz] = W((wall.x0 + wall.x1) / 2, (wall.z0 + wall.z1) / 2);
    sink.opak.box(cx, slabY - 0.1, cz, wall.x1 - wall.x0 + 0.4, 0.2, wall.z1 - wall.z0 + 0.4, obb.yaw, cellUv('beton-mentah'), ctx.colors.wall, { bottom: true });
    for (const face of mass.faces) {
      for (const op of opsOf(plan, mi, face, f)) if (op.kind === 'bata') buildOpening(sink, plan, face, op, y, ctx);
    }
    y = slabY;
  }
  const [gx, gz] = W((wall.x0 + wall.x1) / 2, (wall.z0 + wall.z1) / 2);
  sink.opak.box(gx, (plan.footY + plan.baseY) / 2, gz, wall.x1 - wall.x0 + 0.4, plan.baseY - plan.footY, wall.z1 - wall.z0 + 0.4, obb.yaw, cellUv('beton-mentah'), ctx.colors.plinth);
}

function rebar(b, x, y, z, ctx) {
  for (const a of [0, Math.PI / 2]) {
    const c = Math.cos(a) * 0.3;
    const s = Math.sin(a) * 0.3;
    b.quad([x - c, y, z + s], [x + c, y, z - s], [x + c, y + 0.9, z - s], [x - c, y + 0.9, z + s], cellUv('besi-tulangan'), ctx.colors.white);
  }
}
```

- [ ] **Step 2: `openings.js`**

`src/world/kit/openings.js`:
```js
/**
 * Bukaan (spec §7.2 langkah 4): kusen masuk (reveal) 12 cm, isi jendela/pintu mundur dari bidang dinding,
 * ambang, roster tembus (sel potong + latar gelap di belakang), layar perforasi K03 di depan pita kaca,
 * AC luar, balkon berjemuran K09, isian bata K10. Menulis ke sink; y relatif lantai `yFloor`.
 */
import { cellUv, ATLAS_CELLS } from './atlas.js';
import { wp, wallQuad, wallTiled, yawOf } from './kitShapes.js';
import { facePoint } from './planGeom.js';

export const OPENING_GEOM = Object.freeze({
  reveal: 0.12, fillBack: 0.08, rosterBack: 0.06, backing: 0.3, sillH: 0.06, sillOut: 0.06,
  ac: Object.freeze({ w: 0.8, h: 0.55, d: 0.28, below: 0.7 }), rosterTile: Object.freeze({ w: 1.6, h: 0.4 }), balcony: 1.2, screenOut: 0.45, screenTile: 1.2, screenGap: 0.35,
});

/** Reveal (4 sisi dalam lubang) sedalam `depth`, warna dinding. */
function reveal(b, face, op, y0, y1, depth, color) {
  const r = cellUv('plester');
  const L = (u, y) => wp(face, u, y, 0);
  const I = (u, y) => wp(face, u, y, -depth);
  b.quad(L(op.u0, y0), I(op.u0, y0), I(op.u0, y1), L(op.u0, y1), r, color); // kusen kiri (normal +R)
  b.quad(I(op.u1, y0), L(op.u1, y0), L(op.u1, y1), I(op.u1, y1), r, color); // kusen kanan (normal −R)
  b.quad(L(op.u0, y1), I(op.u0, y1), I(op.u1, y1), L(op.u1, y1), r, color); // atas (normal ke bawah)
  b.quad(I(op.u0, y0), L(op.u0, y0), L(op.u1, y0), I(op.u1, y0), r, color); // ambang dalam (normal ke atas)
}

function sill(b, face, op, y0, color) {
  const [x, z] = facePoint(face, (op.u0 + op.u1) / 2, OPENING_GEOM.sillOut / 2);
  b.box(x, y0 - OPENING_GEOM.sillH / 2, z, op.u1 - op.u0 + 0.12, OPENING_GEOM.sillH, OPENING_GEOM.reveal + OPENING_GEOM.sillOut, yawOf(face), cellUv('beton'), color);
}

function acUnit(b, face, op, y0, ctx) {
  const g = OPENING_GEOM.ac;
  const [x, z] = facePoint(face, (op.u0 + op.u1) / 2, g.d / 2 + 0.05);
  b.box(x, y0 - g.below + g.h / 2 - 0.2, z, g.w, g.h, g.d, yawOf(face), cellUv('ac-luar'), ctx.colors.white);
}

function balcony(sink, face, op, y0, ctx) {
  const g = OPENING_GEOM;
  const [x, z] = facePoint(face, (op.u0 + op.u1) / 2, g.balcony / 2);
  const yaw = yawOf(face);
  sink.opak.box(x, y0 - 0.06, z, op.u1 - op.u0, 0.12, g.balcony, yaw, cellUv('beton'), ctx.colors.trim, { bottom: true });
  wallTiled(sink.potong, face, op.u0, op.u1, y0, y0 + op.y1, g.balcony, 'railing', 1.0, op.y1, ctx.colors.white);
  if (op.jemuran) wallTiled(sink.potong, face, op.u0 + 0.1, op.u1 - 0.1, y0 + 0.9, y0 + 2.2, g.balcony - 0.35, 'jemuran', op.u1 - op.u0 - 0.2, 1.3, ctx.colors.white);
}

/**
 * Layar perforasi K03 (lantai atas): panel per bay di antara kolom (celah 0,35 m tiap sisi bay, 0,15 m atas/bawah)
 * pada bidang luar `op.screenOut`; ubin 1,2 m. Celah memperlihatkan kolom putih (ritme fasad foto ADB).
 */
function screen(sink, face, op, yFloor, ctx) {
  const motif = `layar-${ctx.variant ?? 'segitiga'}`;
  const cell = ATLAS_CELLS[motif] ? motif : 'layar-segitiga';
  const g = OPENING_GEOM;
  const u0 = op.bayU0 + g.screenGap;
  const u1 = op.bayU1 - g.screenGap;
  if (u1 - u0 < 0.6) return;
  wallTiled(sink.potong, face, u0, u1, yFloor + 0.15, yFloor + ctx.floorH(op.floor) - 0.15, op.screenOut ?? g.screenOut, cell, g.screenTile, g.screenTile, ctx.colors.screen);
}

/**
 * @param {object} sink kitBuilder sink
 * @param {object} plan BuildingPlan
 * @param {object} face sisi massa
 * @param {object} op bukaan plan
 * @param {number} yFloor y absolut lantai bukaan
 * @param {object} ctx konteks rakit (warna, arketipe)
 */
export function buildOpening(sink, plan, face, op, yFloor, ctx) {
  const y0 = yFloor + op.y0;
  const y1 = yFloor + op.y1;
  const g = OPENING_GEOM;
  switch (op.kind) {
    case 'balkon':
      balcony(sink, face, op, yFloor, ctx);
      return;
    case 'bata':
      wallQuad(sink.opak, face, op.u0, op.u1, y0, y1, -0.02, cellUv(op.cell), ctx.colors.white);
      return;
    case 'lubang':
      return;
    case 'roster':
      reveal(sink.opak, face, op, y0, y1, g.reveal, ctx.colors.wall);
      wallTiled(sink.potong, face, op.u0, op.u1, y0, y1, -g.rosterBack, op.cell, g.rosterTile.w, g.rosterTile.h, ctx.colors.roster);
      wallQuad(sink.opak, face, op.u0, op.u1, y0, y1, -g.backing, cellUv('gelap'), ctx.colors.white);
      return;
    default:
      break;
  }
  reveal(sink.opak, face, op, y0, y1, g.reveal, ctx.colors.wall);
  wallQuad(sink.opak, face, op.u0, op.u1, y0, y1, -g.fillBack, cellUv(op.cell), ctx.colors.white);
  if (op.kind === 'jendela' || op.kind === 'kaca-pita' || op.kind === 'clerestory') sill(sink.opak, face, op, y0, ctx.colors.trim);
  if (op.ac) acUnit(sink.opak, face, op, y0, ctx);
  if (op.layar) screen(sink, face, op, yFloor, ctx);
}
```

- [ ] **Step 3: `roofs.js`**

`src/world/kit/roofs.js`:
```js
/**
 * Atap (spec §7.2 langkah 5): pelana (25°), limas (25°), pelana-lebar K03 (15°, tritisan 2,5 m),
 * limas-tumpang musala (dua tingkat + pita ventilasi), datar-parapet (plat + parapet 0,9 m + coping), datar
 * (K10). Garis atap = footprint + (tritisan − mundur dinding); sisi dalam antar-massa tanpa tritisan.
 * LOD0 menambah lisplang, talang, pipa turun, bubungan, plafon tritisan; LOD1 hanya bidang atap + tebeng.
 */
import { ShapeUtils, Vector2 } from 'three';
import { cellUv } from './atlas.js';
import { floorPolygon, wallTiled, wp } from './kitShapes.js';
import { makeFace } from './planGeom.js';

export const ROOF = Object.freeze({
  corridorEave: 0.4, fascia: 0.22, fasciaWide: 0.35, soffitDrop: 0.1, ridgeCap: 0.35, gutter: 0.12,
  pipe: 0.08, seng: Object.freeze({ w: 2.0, h: 3.0 }), beton: 4, coping: 0.2, ventBand: 0.7, upperPitch: 35,
});

const DEG = Math.PI / 180;

/** Frame atap dari massa kotak: pusat, sumbu lokal x/z dunia, setengah lebar & dalam garis atap. */
export function roofFrame(mass) {
  const { obb, insets, roof } = mass;
  const flat = roof.type === 'datar-parapet' || roof.type === 'datar';
  const ext = (id) => {
    if (flat) return 0;
    if (insets[id] === 0 && mass.faces.find((f) => f.id === id)?.exterior.length === 0) return 0;
    if (mass.corridor.faces.includes(id)) return ROOF.corridorEave;
    return Math.max(0.3, roof.overhang - insets[id]);
  };
  const x0 = -obb.w / 2 - ext('-x');
  const x1 = obb.w / 2 + ext('+x');
  const z0 = -obb.d / 2 - ext('-z');
  const z1 = obb.d / 2 + ext('+z');
  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  const mx = (x0 + x1) / 2;
  const mz = (z0 + z1) / 2;
  return {
    cx: obb.cx + mx * c + mz * s, cz: obb.cz - mx * s + mz * c,
    ax: [c, 0, -s], az: [s, 0, c], hw: (x1 - x0) / 2, hd: (z1 - z0) / 2,
  };
}

/** Frame diputar 90° bila lebih dalam daripada lebar (bubungan selalu di sumbu x frame). */
function longFrame(f) {
  if (f.hw >= f.hd) return f;
  return { ...f, ax: f.az, az: [-f.ax[0], 0, -f.ax[2]], hw: f.hd, hd: f.hw };
}

/** Titik frame lokal (x, y, z) → dunia. */
const P = (f, x, y, z) => [f.cx + f.ax[0] * x + f.az[0] * z, y, f.cz + f.ax[2] * x + f.az[2] * z];
const neg = (v) => [-v[0], -v[1], -v[2]];
const slopeV = (f, dir, pitch) => [-dir * f.az[0] * Math.cos(pitch), Math.sin(pitch), -dir * f.az[2] * Math.cos(pitch)];
const endV = (f, dir, pitch) => [-dir * f.ax[0] * Math.cos(pitch), Math.sin(pitch), -dir * f.ax[2] * Math.cos(pitch)];

/**
 * Bidang atap perisai/pelana dari eave yE: run r (horizontal ke bubungan), `truncate` 0..1 (tumpang), `hip`
 * true = limas (ujung miring), false = pelana (ujung tegak, diisi tebeng). Mengembalikan tinggi puncak.
 */
function slopes(b, f, yE, pitch, hip, truncate, cell, tile, color) {
  const r = f.hd * truncate;
  const S = r / Math.cos(pitch);
  const W = 2 * f.hw;
  const D = 2 * f.hd;
  const rx = hip ? r : 0;
  const quad = (o, U, V, poly) => b.tiled(o, U, V, poly, tile.w, tile.h, cellUv(cell), color);
  quad(P(f, -f.hw, yE, f.hd), f.ax, slopeV(f, 1, pitch), [[0, 0], [W, 0], [W - rx, S], [rx, S]]);
  quad(P(f, f.hw, yE, -f.hd), neg(f.ax), slopeV(f, -1, pitch), [[0, 0], [W, 0], [W - rx, S], [rx, S]]);
  if (hip) {
    const top = D - 2 * r;
    quad(P(f, f.hw, yE, f.hd), neg(f.az), endV(f, 1, pitch), top > 1e-3 ? [[0, 0], [D, 0], [D - r, S], [r, S]] : [[0, 0], [D, 0], [D / 2, S]]);
    quad(P(f, -f.hw, yE, -f.hd), f.az, endV(f, -1, pitch), top > 1e-3 ? [[0, 0], [D, 0], [D - r, S], [r, S]] : [[0, 0], [D, 0], [D / 2, S]]);
  }
  return yE + r * Math.tan(pitch);
}

/** Tebeng (gable) pentagon di ujung dinding untuk atap pelana. */
function gables(b, plan, mass, f, yE, pitch, ctx) {
  const yRoof = (z) => yE + (f.hd - Math.abs(z)) * Math.tan(pitch) - 0.12;
  for (const face of mass.faces) {
    const n = [face.n[0], 0, face.n[1]];
    const along = Math.abs(n[0] * f.ax[0] + n[2] * f.ax[2]);
    if (along < 0.9 || face.exterior.length === 0) continue; // hanya sisi ujung (normal ∥ sumbu bubungan)
    const toLocalZ = (u) => {
      const [x, , z] = wp(face, u, 0);
      return (x - f.cx) * f.az[0] + (z - f.cz) * f.az[2];
    };
    const za = toLocalZ(0);
    const zb = toLocalZ(face.len);
    const um = Math.abs(zb - za) > 1e-6 ? (0 - za) / (zb - za) * face.len : -1;
    const poly = [[0, 0], [face.len, 0], [face.len, yRoof(zb) - yE]];
    if (um > 0.05 && um < face.len - 0.05) poly.push([um, yRoof(0) - yE]);
    poly.push([0, yRoof(za) - yE]);
    const U = [(face.b[0] - face.a[0]) / face.len, 0, (face.b[1] - face.a[1]) / face.len];
    b.tiled(wp(face, 0, yE), U, [0, 1, 0], poly, 3.6, 3.8, cellUv(plan.style.stain ? 'plester-kusam' : 'plester'), ctx.colors.wall);
  }
}

/** Lisplang keliling (eave) + papan miring di ujung pelana. */
function fascia(b, f, yE, yR, hip, ctx) {
  const h = ctx.arch.id === 'K03' ? ROOF.fasciaWide : ROOF.fascia;
  const r = cellUv('lisplang');
  const c = ctx.colors.fascia;
  b.quad(P(f, -f.hw, yE - h, f.hd), P(f, f.hw, yE - h, f.hd), P(f, f.hw, yE + 0.03, f.hd), P(f, -f.hw, yE + 0.03, f.hd), r, c);
  b.quad(P(f, f.hw, yE - h, -f.hd), P(f, -f.hw, yE - h, -f.hd), P(f, -f.hw, yE + 0.03, -f.hd), P(f, f.hw, yE + 0.03, -f.hd), r, c);
  if (hip) {
    b.quad(P(f, f.hw, yE - h, f.hd), P(f, f.hw, yE - h, -f.hd), P(f, f.hw, yE + 0.03, -f.hd), P(f, f.hw, yE + 0.03, f.hd), r, c);
    b.quad(P(f, -f.hw, yE - h, -f.hd), P(f, -f.hw, yE - h, f.hd), P(f, -f.hw, yE + 0.03, f.hd), P(f, -f.hw, yE + 0.03, -f.hd), r, c);
    return;
  }
  for (const sx of [1, -1]) {
    const x = sx * f.hw;
    const zs = sx > 0 ? [f.hd, 0, -f.hd] : [-f.hd, 0, f.hd];
    const ys = [yE, yR, yE];
    for (let i = 0; i < 2; i += 1) {
      b.quad(P(f, x, ys[i] - h, zs[i]), P(f, x, ys[i + 1] - h, zs[i + 1]), P(f, x, ys[i + 1] + 0.03, zs[i + 1]), P(f, x, ys[i] + 0.03, zs[i]), r, c);
    }
  }
}

/** Plafon tritisan: bidang datar menghadap bawah dari garis atap ke dinding (satu quad per sisi garis atap). */
function soffit(b, f, yE, ctx) {
  const r = cellUv('plafon');
  const y = yE - ROOF.soffitDrop;
  b.quad(P(f, f.hw, y, f.hd), P(f, -f.hw, y, f.hd), P(f, -f.hw, y, -f.hd), P(f, f.hw, y, -f.hd), r, ctx.colors.fascia);
}

/** Talang di dua eave panjang + pipa turun di empat sudut dinding. */
function gutters(b, plan, mass, f, yE, ctx) {
  const yaw = Math.atan2(f.az[0], f.az[2]);
  for (const s of [1, -1]) {
    const [x, , z] = P(f, 0, 0, s * (f.hd + ROOF.gutter / 2));
    b.box(x, yE - ROOF.gutter, z, 2 * f.hw, ROOF.gutter, ROOF.gutter, yaw, cellUv('talang'), ctx.colors.white);
  }
  const { obb, wall } = mass;
  const c = Math.cos(obb.yaw);
  const sn = Math.sin(obb.yaw);
  for (const [lx, lz] of [[wall.x0, wall.z0], [wall.x1, wall.z0], [wall.x1, wall.z1], [wall.x0, wall.z1]]) {
    const ox = lx + Math.sign(lx) * 0.1;
    const oz = lz + Math.sign(lz) * 0.1;
    const h = yE - plan.footY;
    b.box(obb.cx + ox * c + oz * sn, plan.footY + h / 2, obb.cz - ox * sn + oz * c, ROOF.pipe, h, ROOF.pipe, obb.yaw, cellUv('talang'), ctx.colors.white);
  }
}

/** Empat sisi (normal keluar) persegi frame — urutan & konvensi sama dengan planGeom.boxMass. */
function rectFaces(f) {
  const w = (x, z) => {
    const p = P(f, x, 0, z);
    return [p[0], p[2]];
  };
  const A = w(-f.hw, -f.hd);
  const B = w(f.hw, -f.hd);
  const C = w(f.hw, f.hd);
  const D = w(-f.hw, f.hd);
  return [makeFace('-z', B, A), makeFace('+x', C, B), makeFace('+z', D, C), makeFace('-x', A, D)];
}

/** Pelana / pelana-lebar / limas / limas-tumpang pada massa kotak. */
function pitchedRoof(sink, plan, mass, ctx, lod) {
  const { roof } = mass;
  const f = longFrame(roofFrame(mass));
  const yE = plan.baseY + plan.height;
  const pitch = roof.pitch * DEG;
  const b = sink.opak;
  const color = ctx.colors.roof;
  const tile = ROOF.seng;
  if (roof.type === 'limas-tumpang') {
    const yMid = slopes(b, f, yE, pitch, true, 0.55, ctx.roofCell, tile, color);
    const inner = { ...f, hw: f.hw - f.hd * 0.55, hd: f.hd * 0.45 };
    for (const face of rectFaces(inner)) wallTiled(b, face, 0, face.len, yMid, yMid + ROOF.ventBand, 0, 'jalusi-alu', 1, ROOF.ventBand, ctx.colors.white);
    const upper = { ...inner, hw: inner.hw + 0.5, hd: inner.hd + 0.5 };
    const yTop = slopes(b, upper, yMid + ROOF.ventBand, ROOF.upperPitch * DEG, true, 1, ctx.roofCell, tile, color);
    if (lod === 0) {
      fascia(b, f, yE, yE, true, ctx);
      soffit(b, f, yE, ctx);
      b.box(upper.cx, yTop + 0.5, upper.cz, 0.18, 1.0, 0.18, 0, cellUv('besi'), ctx.colors.white); // mustaka
    }
    return;
  }
  const hip = roof.type === 'limas';
  const yR = slopes(b, f, yE, pitch, hip, 1, ctx.roofCell, tile, color);
  if (!hip) gables(b, plan, mass, f, yE, pitch, ctx);
  if (lod > 0) return;
  fascia(b, f, yE, yR, hip, ctx);
  soffit(b, f, yE, ctx);
  if (!hip) b.box(f.cx, yR + 0.03, f.cz, 2 * f.hw, 0.08, ROOF.ridgeCap, Math.atan2(f.az[0], f.az[2]), cellUv(ctx.roofCell), ctx.colors.roofDark);
  gutters(b, plan, mass, f, yE, ctx);
}

/** Parapet pada sisi (dalam & luar) + coping. */
function parapetEdge(sink, face, yE, ctx) {
  const H = 0.9;
  for (const [s, e] of face.exterior) {
    wallTiled(sink.opak, face, s, e, yE - 0.3, yE + H, 0, 'plester', 3.6, 1.2, ctx.colors.parapet);
    const inner = { ...face, a: face.b, b: face.a, n: [-face.n[0], -face.n[1]] };
    wallTiled(sink.opak, inner, face.len - e, face.len - s, yE, yE + H, ROOF.coping, 'plester', 3.6, 1.2, ctx.colors.parapet);
    const p = (u, o) => wp(face, u, yE + H, o);
    sink.opak.quad(p(s, 0), p(e, 0), p(e, -ROOF.coping), p(s, -ROOF.coping), cellUv('beton'), ctx.colors.trim);
  }
}

/** Atap datar berparapet: kotak = garis footprint; poligon = ring ditriangulasi (lubang didukung). */
function flatRoof(sink, plan, mass, ctx) {
  const yE = plan.baseY + plan.height;
  if (mass.kind === 'poligon') {
    const contour = mass.ring.map(([x, z]) => new Vector2(x, z));
    const holes = (mass.holes ?? []).map((h) => h.map(([x, z]) => new Vector2(x, z)));
    const all = [...mass.ring, ...(mass.holes ?? []).flat()];
    for (const [i, j, k] of ShapeUtils.triangulateShape(contour, holes)) {
      floorPolygon(sink.opak, [all[i], all[j], all[k]], yE + 0.02, 'atap-beton', ctx.colors.white, ROOF.beton);
    }
    if (mass.roof.type === 'datar-parapet') for (const face of mass.faces) parapetEdge(sink, face, yE, ctx);
    return;
  }
  const f = roofFrame(mass);
  floorPolygon(sink.opak, [P(f, -f.hw, 0, -f.hd), P(f, f.hw, 0, -f.hd), P(f, f.hw, 0, f.hd), P(f, -f.hw, 0, f.hd)].map((p) => [p[0], p[2]]), yE + 0.02, 'atap-beton', ctx.colors.white, ROOF.beton);
  if (mass.roof.type !== 'datar-parapet') return;
  for (const face of rectFaces(f)) {
    const twin = mass.faces.find((mf) => Math.abs(mf.n[0] * face.n[0] + mf.n[1] * face.n[1] - 1) < 1e-3);
    if (twin && twin.exterior.length === 0) continue; // sisi dalam antar-massa
    parapetEdge(sink, face, yE, ctx);
  }
}

/**
 * Drum (16 sisi) + kubah + mahkota di atas atap datar (musala varian 'kubah-kecil', placeholder masjid).
 * @param {object} b MeshBuilder (sink.opak)
 */
export function domeOnRoof(b, cx, cz, y, r, colors) {
  const n = 16;
  const drumH = Math.max(0.8, r * 0.45);
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const p = (a, yy) => [cx + Math.cos(a) * r, yy, cz + Math.sin(a) * r];
    b.quad(p(a1, y), p(a0, y), p(a0, y + drumH), p(a1, y + drumH), cellUv('plester'), colors.wall);
  }
  b.box(cx, y + drumH + 0.06, cz, 2 * r + 0.3, 0.12, 2 * r + 0.3, 0, cellUv('beton'), colors.trim);
  b.dome(cx, y + drumH + 0.12, cz, r, 16, 6, cellUv('seng'), colors.roof);
  b.box(cx, y + drumH + 0.12 + r + 0.5, cz, 0.1, 1.0, 0.1, 0, cellUv('besi'), colors.white);
}

/**
 * @param {object} sink kitBuilder sink
 * @param {object} plan BuildingPlan
 * @param {object} mass massa plan
 * @param {object} ctx konteks rakit
 * @param {0|1} lod
 */
export function buildRoof(sink, plan, mass, ctx, lod = 0) {
  const t = mass.roof.type;
  if (t === 'datar') return;
  if (t === 'datar-parapet' || mass.kind === 'poligon') {
    flatRoof(sink, plan, mass, ctx);
    const main = plan.masses[0] === mass;
    if (main && ctx.arch.id === 'K06' && plan.variant === 'kubah-kecil') {
      domeOnRoof(sink.opak, mass.obb.cx, mass.obb.cz, plan.baseY + plan.height + 0.9, Math.min(mass.obb.w, mass.obb.d) * 0.22, ctx.colors);
    }
    return;
  }
  pitchedRoof(sink, plan, mass, ctx, lod);
}
```

- [ ] **Step 4: `ornaments.js`**

`src/world/kit/ornaments.js`:
```js
/**
 * Ornamen LOD0 per arketipe (plan.ornaments, spec §7.1 "Ciri wajib"): teras berkanopi + tangga + tiang
 * bendera + pot (K02), exhaust (K04), kanopi masuk (K05), tempat wudu + rak sandal (K06), etalase +
 * meja-bangku + spanduk menu (K07), tandon atap (K09), ilalang (K10). transform dunia {x,y,z,yaw,sx,sy,sz};
 * +Z lokal ornamen menghadap keluar gedung. Ornamen tak dikenal dilewati (console.warn sekali per id).
 */
import { cellUv } from './atlas.js';

const warned = new Set();

/** Titik lokal ornamen (x kanan, y atas, z keluar) → dunia. */
function L(t, x, y, z) {
  const c = Math.cos(t.yaw);
  const s = Math.sin(t.yaw);
  return [t.x + x * c + z * s, t.y + y, t.z - x * s + z * c];
}

/** Kotak di ruang lokal ornamen (pusat lokal x,y,z; ukuran sx,sy,sz). */
function lbox(b, t, x, y, z, sx, sy, sz, cell, color, opts) {
  const [px, py, pz] = L(t, x, y, z);
  b.box(px, py, pz, sx, sy, sz, t.yaw, cellUv(cell), color, opts);
}

/** Dua quad bersilang (rumput/tanaman), sel potong. */
function cross(b, t, w, h, cell, color) {
  for (const a of [0, Math.PI / 2]) {
    const tt = { ...t, yaw: t.yaw + a };
    b.quad(L(tt, -w / 2, 0, 0), L(tt, w / 2, 0, 0), L(tt, w / 2, h, 0), L(tt, -w / 2, h, 0), cellUv(cell), color);
  }
}

/** Prisma n-sisi tegak (tandon, tiang bulat). */
function prism(b, t, r, h, sides, cell, color) {
  for (let i = 0; i < sides; i += 1) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const p = (a, y) => L(t, Math.cos(a) * r, y, Math.sin(a) * r);
    b.quad(p(a1, 0), p(a0, 0), p(a0, h), p(a1, h), cellUv(cell), color);
  }
  const top = Array.from({ length: sides }, (_, i) => L(t, Math.cos((-i / sides) * Math.PI * 2) * r, h, Math.sin((-i / sides) * Math.PI * 2) * r));
  b.polygon(top, top.map(() => [cellUv(cell).u0, cellUv(cell).v0]), color);
}

const BUILDERS = {
  'teras-kanopi': (s, t, c) => { // pelat kanopi beton di atas dua kolom depan
    const w = t.sx;
    const d = t.sz;
    lbox(s.opak, t, 0, 3.55, 0, w, 0.22, d, 'beton', c.trim, { bottom: true });
    for (const side of [-1, 1]) lbox(s.opak, t, side * (w / 2 - 0.25), 1.75, d / 2 - 0.25, 0.4, 3.5, 0.4, 'beton', c.column);
  },
  'tangga-tengah': (s, t, c) => {
    const steps = Math.max(1, Math.ceil(t.sy / 0.17));
    const rise = t.sy / steps;
    for (let i = 0; i < steps; i += 1) lbox(s.opak, t, 0, rise * (i + 0.5), -(i * t.sz) / steps / 2, t.sx, rise, t.sz - (i * t.sz) / steps, 'tangga', c.floor);
  },
  'tiang-bendera': (s, t, c) => {
    lbox(s.opak, t, 0, 4, 0, 0.09, 8, 0.09, 'besi', c.white);
    lbox(s.opak, t, 0, 0.15, 0, 0.8, 0.3, 0.8, 'beton', c.trim);
    const f = (x, y) => L(t, x, y, 0);
    s.opak.quad(f(0.05, 6.9), f(1.25, 6.9), f(1.25, 7.7), f(0.05, 7.7), cellUv('bendera'), c.white);
    s.opak.quad(f(1.25, 6.9), f(0.05, 6.9), f(0.05, 7.7), f(1.25, 7.7), cellUv('bendera'), c.white);
  },
  pot: (s, t, c) => {
    lbox(s.opak, t, 0, 0.22, 0, 0.5, 0.44, 0.5, 'pot-tanah', c.white);
    cross(s.potong, { ...t, y: t.y + 0.4 }, 1.0, 1.1, 'tanaman-pot', c.white);
  },
  exhaust: (s, t, c) => lbox(s.opak, t, 0, 0, 0.06, 0.7, 0.7, 0.12, 'exhaust', c.white),
  'kanopi-masuk': (s, t, c) => lbox(s.opak, t, 0, 0, 0, t.sx, 0.18, t.sz, 'beton', c.trim, { bottom: true }),
  'tempat-wudu': (s, t, c) => {
    lbox(s.opak, t, 0, 0.55, 0, t.sx, 1.1, 0.3, 'tempat-wudu', c.white);
    lbox(s.opak, t, 0, 0.05, 0.4, t.sx, 0.1, 0.5, 'keramik-lantai', c.white);
  },
  'rak-sandal': (s, t, c) => lbox(s.opak, t, 0, 0.45, 0, 1.2, 0.9, 0.35, 'rak-sandal', c.white),
  etalase: (s, t, c) => lbox(s.opak, t, 0, 0.5, 0, t.sx, 1.0, 0.6, 'etalase', c.white),
  'meja-bangku': (s, t, c) => {
    lbox(s.opak, t, 0, 0.74, 0, t.sx, 0.05, 0.8, 'meja-bangku', c.white);
    for (const z of [-0.65, 0.65]) lbox(s.opak, t, 0, 0.44, z, t.sx, 0.05, 0.3, 'meja-bangku', c.white);
    for (const x of [-t.sx / 2 + 0.2, t.sx / 2 - 0.2]) lbox(s.opak, t, x, 0.36, 0, 0.08, 0.72, 1.5, 'besi', c.white);
  },
  'spanduk-menu': (s, t, c) => {
    const f = (x, y) => L(t, x, y, 0);
    s.opak.quad(f(-t.sx / 2, -0.4), f(t.sx / 2, -0.4), f(t.sx / 2, 0.4), f(-t.sx / 2, 0.4), cellUv('spanduk-menu'), c.white);
  },
  tandon: (s, t, c) => {
    for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) lbox(s.opak, t, x, 0.5, z, 0.08, 1.0, 0.08, 'besi', c.white);
    prism(s.opak, { ...t, y: t.y + 1.0 }, 0.6, 1.3, 8, 'tandon', c.white);
  },
  ilalang: (s, t, c) => cross(s.potong, t, 1.4 * t.sx, 0.9 * t.sx, 'ilalang', c.white),
};

/** Tambah semua ornamen plan ke sink (LOD0 saja). */
export function buildOrnaments(sink, plan, ctx) {
  for (const o of plan.ornaments) {
    const fn = BUILDERS[o.assetId];
    if (!fn) {
      if (!warned.has(o.assetId)) {
        warned.add(o.assetId);
        console.warn(`kit: ornamen "${o.assetId}" belum punya builder`);
      }
      continue;
    }
    fn(sink, o.transform, ctx.colors);
  }
}

export const ORNAMENT_IDS = Object.freeze(Object.keys(BUILDERS));
```

- [ ] **Step 5: Lint**

Run: `node node_modules/eslint/bin/eslint.js src/world/kit`
Expected: 0 galat. (Commit bersama Task 10.)

---

## Task 10: Perakit, buildBuilding, hero placeholder

**Files:**
- Create: `src/world/kit/kitAssemble.js`, `src/world/kit/buildBuilding.js`, `src/world/kit/hero/index.js`

Kontrak hero: `HERO_BUILDERS['hero:…'] = (plan, kitMaterials, ctx) => PartList` (geometri dunia). Placeholder M3 = geometri arketipe pengganti (`HERO_STANDIN`) berukuran footprint + penanda khas (Rektorat: blok kaca biru menonjol; Masjid: drum + kubah + mahkota; GGM: kerucut; Gerbang: dua pilar + balok; Tribun: 10 undakan). Placeholder punya `.steps(sink, plan, mats, ctx)` (generator) agar klaster dapat memotongnya; M4/M6 boleh mengganti entri dengan fungsi biasa (tanpa `.steps`) — klaster otomatis memakai PartList-nya; fungsi yang mengembalikan `[]` (gedung milik region) = tidak digambar distrik.

- [ ] **Step 1: `kitAssemble.js`**

`src/world/kit/kitAssemble.js`:
```js
/**
 * Perakit kit: BuildingPlan → geometri di sink (kitBuilder). Memilih jalur per arketipe efektif (plan.kit):
 * K07 struktur terbuka, K10 rangka, lainnya dinding + selasar + bukaan; atap per massa; ornamen (LOD0).
 * LOD1 (spec §7.4): massa + atap + fasad atlas (sel bay dilukis), tanpa selasar/ornamen/bukaan nyata.
 */
import { ARCHETYPES, PALETTES } from './archetypes.js';
import { linearColor } from './kitBuilder.js';
import { buildCorridors, buildFrame, buildOpenStructure, faceWallSteps, facePainted, faceWallsLod1 } from './facade.js';
import { buildRoof } from './roofs.js';
import { buildOrnaments } from './ornaments.js';
import { floorPolygon } from './kitShapes.js';

/** Sel fasad LOD1 per arketipe efektif: [sel, sel menyala | null]. */
export const LOD1_CELLS = Object.freeze({
  K01: ['lod1-kuliah', 'lod1-kuliah-nyala'], K02: ['lod1-kuliah', 'lod1-kuliah-nyala'], K03: ['lod1-adb', 'lod1-adb-nyala'],
  K04: ['lod1-lab', null], K05: ['lod1-aula', null], K06: ['lod1-kuliah', 'lod1-kuliah-nyala'], K07: ['lod1-kantin', null],
  K08: ['lod1-jalusi', null], K09: ['lod1-rusun', 'lod1-rusun-nyala'], K10: ['lod1-mangkrak', null], K11: ['lod1-polos', null],
  K12: ['lod1-kuliah', 'lod1-kuliah-nyala'],
});

/** Konteks rakit: warna linear (dengan variasi seed), arketipe efektif, sel atap, sel LOD1. */
export function assembleContext(plan) {
  const arch = ARCHETYPES[plan.kit] ?? ARCHETYPES.K12;
  const pal = PALETTES[plan.palette] ?? PALETTES['krem-seng'];
  const k = plan.style.tint;
  const seng = plan.palette === 'krem-genteng' ? 'genteng' : plan.style.rust || plan.variant === 'beratap' ? 'seng-karat' : 'seng';
  const [lod1Cell, lod1LitCell] = LOD1_CELLS[arch.id];
  return {
    arch,
    variant: plan.variant,
    floorH: (f) => plan.floorH[f],
    roofCell: seng,
    lod1Cell,
    lod1LitCell,
    lod1Lit: Boolean(lod1LitCell),
    colors: {
      wall: linearColor(pal.wall, k), trim: linearColor(pal.trim, k), plinth: linearColor(pal.plinth), column: linearColor(pal.column, k),
      roof: linearColor(pal.roof), roofDark: linearColor(pal.roof, 0.82), fascia: linearColor(pal.fascia), floor: linearColor(pal.floor),
      screen: linearColor(pal.screen ?? 0xc4602f), parapet: linearColor(plan.palette === 'putih' ? pal.fascia : pal.wall, k),
      roster: linearColor(pal.trim), white: [1, 1, 1],
    },
  };
}

/**
 * Langkah perakitan satu gedung ke sink (generator; tiap `yield` = titik potong scheduler ≤ ±2 ms):
 * per sisi dinding, selasar, atap per massa, lalu ornamen.
 * @param {ReturnType<import('./kitBuilder.js').createKitSink>} sink
 * @param {object} plan BuildingPlan
 * @param {{lod?: 0|1}} [opts]
 */
export function* appendBuildingSteps(sink, plan, { lod = 0 } = {}) {
  const ctx = assembleContext(plan);
  const id = ctx.arch.id;
  for (let mi = 0; mi < plan.masses.length; mi += 1) {
    const mass = plan.masses[mi];
    if (id === 'K07') buildOpenStructure(sink, plan, mass, mi, ctx);
    else if (id === 'K10') buildFrame(sink, plan, mass, mi, ctx);
    else {
      for (const face of mass.faces) {
        if (lod > 0) faceWallsLod1(sink, plan, face, mi, ctx);
        else if (id === 'K12') facePainted(sink, plan, mass, mi, face, ctx);
        else yield* faceWallSteps(sink, plan, mass, mi, face, ctx);
        yield;
      }
      if (lod === 0 && id !== 'K12') buildCorridors(sink, plan, mass, mi, ctx);
    }
    yield;
    if (id !== 'K10' || plan.variant === 'beratap') buildRoof(sink, plan, mass, ctx, lod);
    if (id === 'K08' && lod === 0) floorPolygon(sink.opak, mass.ring, plan.baseY + 0.02, 'kayu-papan', ctx.colors.floor, 3);
    yield;
  }
  if (lod === 0) buildOrnaments(sink, plan, ctx);
}

/**
 * Tulis satu gedung ke sink sekaligus (galeri, hero, tes).
 * @returns {number} jumlah segitiga yang ditambahkan
 */
export function appendBuilding(sink, plan, opts = {}) {
  const before = sink.triangles;
  for (const _ of appendBuildingSteps(sink, plan, opts)) { /* jalankan semua langkah */ }
  return sink.triangles - before;
}
```

- [ ] **Step 2: `buildBuilding.js`**

`src/world/kit/buildBuilding.js`:
```js
/**
 * buildBuilding (spec §4.6): BuildingPlan → PartList (pola instanceParts: {geometry, material, matrix,
 * castShadow, name}; geometri koordinat dunia, matrix null). Hero ('hero:*') lewat HERO_BUILDERS. Klaster
 * memakai appendPlan langsung ke sink bersama (penggabungan per material tanpa clone). Gedung yang gagal
 * dirakit jatuh ke K12 (spec §10); bila K12 juga gagal → [] + console.error.
 */
import { createKitSink } from './kitBuilder.js';
import { appendBuilding, appendBuildingSteps } from './kitAssemble.js';
import { HERO_BUILDERS } from './hero/index.js';
import { planBuilding } from './planBuilding.js';

/** Salin geometri PartList ke sink (dipakai hero di dalam klaster). */
export function appendParts(sink, parts, materials) {
  for (const p of parts) {
    const key = p.material === materials.potong ? 'potong' : p.material === materials.opak ? 'opak' : null;
    if (!key) continue;
    const g = p.geometry;
    const pos = g.attributes.position.array;
    const uv = g.attributes.uv.array;
    const col = g.attributes.color.array;
    const b = sink[key];
    for (let i = 0; i < pos.length; i += 9) {
      const v = (k) => [pos[i + k * 3], pos[i + k * 3 + 1], pos[i + k * 3 + 2]];
      const t = (k) => [uv[(i / 3 + k) * 2], uv[(i / 3 + k) * 2 + 1]];
      b.tri(v(0), v(1), v(2), [t(0), t(1), t(2)], [col[i], col[i + 1], col[i + 2]]);
    }
    g.dispose();
  }
}

/** Rencana cadangan K12 dari plan yang gagal dirakit. */
export function fallbackPlan(plan, input) {
  return planBuilding({ ...input, archetype: 'K12', overrides: { palette: plan.palette, sign: plan.signs[0]?.text ?? null } });
}

/** Versi generator appendPlan (klaster): hero ditulis sekaligus, gedung kit per langkah. */
export function* appendPlanSteps(sink, plan, materials, { lod = 0, ctx = {} } = {}) {
  const hero = HERO_BUILDERS[plan.archetype];
  if (hero?.steps) {
    yield* hero.steps(sink, plan, materials, { ...ctx, lod });
    return;
  }
  if (hero) {
    appendParts(sink, hero(plan, materials, { ...ctx, lod }), materials);
    return;
  }
  yield* appendBuildingSteps(sink, plan, { lod });
}

/**
 * Tulis plan ke sink; hero memakai builder hero. Melempar bila perakitan gagal (pemanggil memakai fallbackPlan).
 * @returns {number} segitiga
 */
export function appendPlan(sink, plan, materials, { lod = 0, ctx = {} } = {}) {
  const hero = HERO_BUILDERS[plan.archetype];
  if (!hero) return appendBuilding(sink, plan, { lod });
  const before = sink.triangles;
  appendParts(sink, hero(plan, materials, { ...ctx, lod }), materials);
  return sink.triangles - before;
}

/**
 * @param {object} plan BuildingPlan (planBuilding)
 * @param {{opak: object, potong: object}} kitMaterials createKitMaterials(scope)
 * @param {{lod?: 0|1, input?: object, logger?: {error: Function}}} [opts] input = masukan planBuilding (untuk cadangan K12)
 * @returns {Array<{geometry: import('three').BufferGeometry, material: object, matrix: null, castShadow: boolean, name: string}>}
 */
export function buildBuilding(plan, kitMaterials, { lod = 0, input = null, logger = console } = {}) {
  const sink = createKitSink();
  try {
    appendPlan(sink, plan, kitMaterials, { lod });
  } catch (err) {
    if (!input) throw err;
    logger.error(`kit: gedung ${plan.id} gagal dirakit (${plan.kit}), jatuh ke K12:`, err);
    const fresh = createKitSink();
    try {
      appendBuilding(fresh, fallbackPlan(plan, input), { lod });
    } catch (err2) {
      logger.error(`kit: cadangan K12 ${plan.id} juga gagal:`, err2);
      return [];
    }
    return fresh.toParts(kitMaterials, plan.id);
  }
  return sink.toParts(kitMaterials, plan.id);
}
```

- [ ] **Step 3: `hero/index.js`**

`src/world/kit/hero/index.js`:
```js
/**
 * Builder hero (spec §7.1): `(plan, kitMaterials, ctx) => PartList`. M3 memasang PLACEHOLDER berukuran
 * footprint untuk SEMUA id hero (geometri arketipe pengganti HERO_STANDIN + penanda bentuk khas); M4
 * (sekretariat-lembaga, stadion-mini, student-center) dan M6 (rektorat, masjid, gerbang, ggm) mengganti isi
 * entri di sini tanpa mengubah kunci. ctx = { lod }.
 */
import { HERO_IDS } from '../archetypes.js';
import { cellUv } from '../atlas.js';
import { createKitSink, linearColor } from '../kitBuilder.js';
import { appendBuildingSteps } from '../kitAssemble.js';
import { facePoint, primaryFace } from '../planGeom.js';
import { yawOf } from '../kitShapes.js';
import { domeOnRoof } from '../roofs.js';

const KREM = linearColor(0xeee2c2);
const OKER = linearColor(0xc79a3c);
const MOZAIK = linearColor(0xd9d2f0); // [INF placeholder] mozaik putih-ungu → diganti N04 (M6)
const WHITE = [1, 1, 1];

/**
 * Placeholder umum: rakit plan dengan arketipe pengganti (plan.kit) + tambahan opsional. Fungsi builder
 * memiliki `.steps(sink, plan, mats, ctx)` (generator) agar klaster bisa memotong perakitan per sisi.
 */
function placeholder(extra) {
  function* steps(sink, plan, mats, ctx = {}) {
    yield* appendBuildingSteps(sink, plan, { lod: ctx.lod ?? 0 });
    if (extra && (ctx.lod ?? 0) === 0) extra(sink, plan, ctx);
  }
  const build = (plan, mats, ctx = {}) => {
    const sink = createKitSink();
    for (const _ of steps(sink, plan, mats, ctx)) { /* semua langkah */ }
    return sink.toParts(mats, `${plan.archetype}:${plan.id}`);
  };
  build.steps = steps;
  return build;
}

/** Rektorat: blok tengah menonjol berkaca biru vertikal di sisi depan [T foto 2016]. */
function rektoratFront(sink, plan) {
  const face = primaryFace(plan.masses[0]);
  const w = Math.min(14, face.len * 0.22);
  const y0 = plan.baseY + plan.floorH[0];
  const y1 = plan.baseY + plan.height + 1.2;
  const [x, z] = facePoint(face, face.len / 2, 0.6);
  sink.opak.box(x, (y0 + y1) / 2, z, w, y1 - y0, 1.2, yawOf(face), cellUv('kaca-biru'), WHITE);
}

/** Masjid: drum + kubah mozaik + mahkota di atas massa utama [T foto 2023; bentuk final N04 M6]. */
function masjidDome(sink, plan) {
  const { obb } = plan.masses[0];
  domeOnRoof(sink.opak, obb.cx, obb.cz, plan.baseY + plan.height + 0.9, Math.min(obb.w, obb.d) * 0.2, { wall: KREM, trim: OKER, roof: MOZAIK, white: OKER });
}

/** GGM: atap kerucut di atas silinder poligon [T bentuk gasing; kondisi 2026 R]. */
function ggmCone(sink, plan) {
  const m = plan.masses[0];
  const cx = m.obb.cx;
  const cz = m.obb.cz;
  const y = plan.baseY + plan.height;
  const r = cellUv('seng-karat');
  const color = linearColor(0x8c969e);
  m.ring.forEach((p, i) => {
    const q = m.ring[(i + 1) % m.ring.length];
    sink.opak.tri([q[0], y, q[1]], [p[0], y, p[1]], [cx, y + 9, cz], [[r.u1, r.v0], [r.u0, r.v0], [(r.u0 + r.u1) / 2, r.v1]], color);
  });
}

/** Gerbang: dua pilar + balok di atas jalan, dari OBB massa 0 (posisi final M6). */
function gerbang(plan, mats) {
  const sink = createKitSink();
  const { obb } = plan.masses[0];
  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  const at = (lx) => [obb.cx + lx * c, obb.cz - lx * s];
  const h = 7.5;
  for (const lx of [-obb.w / 2 + 0.8, obb.w / 2 - 0.8]) {
    const [x, z] = at(lx);
    sink.opak.box(x, plan.baseY + h / 2, z, 1.6, h, Math.max(1.6, obb.d), obb.yaw, cellUv('plester'), KREM);
  }
  sink.opak.box(obb.cx, plan.baseY + h - 0.6, obb.cz, obb.w, 1.2, Math.max(1.2, obb.d * 0.8), obb.yaw, cellUv('beton'), OKER);
  return sink.toParts(mats, `${plan.archetype}:${plan.id}`);
}

/** Tribun Stadion Mini: 10 undakan beton naik ke belakang + dinding belakang [INF bentuk]. */
function tribun(plan, mats) {
  const sink = createKitSink();
  const { obb } = plan.masses[0];
  const rows = 10;
  const step = obb.d / rows;
  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  for (let i = 0; i < rows; i += 1) {
    const lz = obb.d / 2 - step * (i + 0.5);
    const h = 0.45 * (i + 1);
    sink.opak.box(obb.cx + lz * s, plan.groundY + h / 2, obb.cz + lz * c, obb.w, h, step, obb.yaw, cellUv('beton'), linearColor(0xd6d2c8));
  }
  return sink.toParts(mats, `${plan.archetype}:${plan.id}`);
}

export const HERO_BUILDERS = Object.freeze({
  'hero:rektorat': placeholder(rektoratFront),
  'hero:masjid-arfaunnas': placeholder(masjidDome),
  'hero:gerbang-sm-amin': gerbang,
  'hero:ggm': placeholder(ggmCone),
  'hero:sekretariat-lembaga': placeholder(),
  'hero:student-center': placeholder(),
  'hero:stadion-mini': tribun,
});

if (HERO_IDS.some((id) => !HERO_BUILDERS[id])) throw new Error('HERO_BUILDERS tidak lengkap');
```

- [ ] **Step 4: Lint & commit**

Run: `node node_modules/eslint/bin/eslint.js src/world/kit`
Expected: 0 galat.

```bash
git add src/world/kit/facade.js src/world/kit/openings.js src/world/kit/roofs.js src/world/kit/ornaments.js src/world/kit/kitAssemble.js src/world/kit/buildBuilding.js src/world/kit/hero/index.js
```
```bash
git commit -m "feat(kit): fasad, bukaan, atap, ornamen, buildBuilding PartList dan placeholder semua hero"
```

---

## Task 11: Tes asap & budget kit (Node)

**Files:**
- Test: `tests/kit/kitBuild.test.js`

Tes ini memastikan setiap spesimen tipikal katalog (aset §1) ≤ batas segitiga LOD0 katalog, atribut seragam (syarat sink), tanpa NaN, LOD1 ≤ 25 % LOD0, tidak ada sel atlas/ornamen tak dikenal, semua hero menghasilkan geometri, galat → K12, dan tata letak atlas valid (di dalam 2048², selaras 64 px, tanpa tumpang tindih, 73 sel, sel potong/menyala benar).

- [ ] **Step 1: Tulis tes**

`tests/kit/kitBuild.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { planBuilding } from '../../src/world/kit/planBuilding.js';
import { buildBuilding, appendPlan } from '../../src/world/kit/buildBuilding.js';
import { createKitSink, clipRect } from '../../src/world/kit/kitBuilder.js';
import { createKitMaterials } from '../../src/world/kit/kitMaterials.js';
import { createResourceScope } from '../../src/engine/ResourceScope.js';
import { ATLAS_CELLS, ATLAS_SIZE, cellUv, PAINTERS } from '../../src/world/kit/atlas.js';
import { ARCHETYPE_IDS, HERO_IDS, VARIANTS } from '../../src/world/kit/archetypes.js';
import { ORNAMENT_IDS } from '../../src/world/kit/ornaments.js';

const rect = (w, d) => [[0, 0], [w, 0], [w, d], [0, d]];
// Spesimen tipikal katalog aset §1 + batas segitiga LOD0 (kolom "Segitiga", batas atas).
const SPECIMENS = [
  ['K01', rect(40, 12), 1, {}, 12000], ['K01', rect(46, 15), 2, {}, 12000], ['K02', rect(35, 14), 2, { sign: 'DEKANAT' }, 15000],
  ['K03', rect(50, 50), 4, { variant: 'segitiga' }, 25000], ['K04', rect(30, 15), 1, {}, 9000], ['K05', rect(30, 20), 1, {}, 8000],
  ['K06', rect(10, 10), 1, {}, 6000], ['K06', rect(10, 10), 1, { variant: 'kubah-kecil', roof: 'datar-parapet' }, 6000],
  ['K07', rect(20, 10), 1, {}, 7000], ['K07', rect(20, 10), 1, { variant: 'parkir' }, 7000], ['K08', rect(12, 12), 1, {}, 5000],
  ['K09', rect(69, 23), 5, {}, 20000], ['K10', rect(40, 14), 3, { variant: 'rangka' }, 15000], ['K10', rect(40, 14), 3, { variant: 'beratap', roof: 'pelana' }, 15000],
  ['K11', rect(8, 8), 1, {}, 2000], ['K12', [[0, 0], [32, 0], [36, 12], [22, 20], [0, 20]], 3, {}, 4000],
];

const mats = createKitMaterials(createResourceScope('uji-kit'));
const plan = ([arch, ring, levels, ov]) => planBuilding({ id: `uji-${arch}`, ring, levels, archetype: arch, overrides: ov, front: [0, 1], groundY: () => 0 });

afterEach(() => vi.restoreAllMocks());

describe('buildBuilding (kit lengkap, Node tanpa canvas)', () => {
  it.each(SPECIMENS.map((s) => [`${s[0]} ${JSON.stringify(s[3])}`, s]))('%s: PartList ≤ batas segitiga katalog, atribut seragam, tanpa NaN', (_, spec) => {
    const parts = buildBuilding(plan(spec), mats);
    const tris = parts.reduce((s, p) => s + p.geometry.attributes.position.count / 3, 0);
    expect(tris).toBeGreaterThan(50);
    expect(tris).toBeLessThanOrEqual(spec[4]);
    for (const p of parts) {
      expect(Object.keys(p.geometry.attributes).sort()).toEqual(['color', 'normal', 'position', 'uv']);
      expect([mats.opak, mats.potong]).toContain(p.material);
      expect(p.matrix).toBeNull();
      for (const v of p.geometry.attributes.position.array) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('LOD1 jauh lebih ringan dari LOD0 (≤ 25%) dan tanpa sel potong (K07/K10 struktur sama; K12 sudah dilukis)', () => {
    for (const spec of SPECIMENS.filter((s) => !['K07', 'K10', 'K12'].includes(s[0]))) {
      const p = plan(spec);
      const t0 = createKitSink();
      const t1 = createKitSink();
      appendPlan(t0, p, mats, { lod: 0 });
      appendPlan(t1, p, mats, { lod: 1 });
      expect(t1.triangles, spec[0]).toBeLessThanOrEqual(Math.max(400, t0.triangles * 0.25));
      expect(t1.potong.triangles, spec[0]).toBe(0);
    }
  });

  it('tidak ada sel atlas tak dikenal (semua arketipe, semua varian, LOD0/1, hero)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const all = [...SPECIMENS];
    for (const [id, list] of Object.entries(VARIANTS)) for (const v of list) all.push([id, rect(30, 14), 2, { variant: v }, Infinity]);
    for (const h of HERO_IDS) all.push([h, rect(40, 24), 2, {}, Infinity]);
    for (const spec of all) for (const lod of [0, 1]) buildBuilding(plan(spec), mats, { lod });
    expect(warn.mock.calls.filter(([m]) => /atlas|ornamen/.test(String(m)))).toEqual([]);
  });

  it('semua id hero punya builder dan menghasilkan geometri', () => {
    for (const h of HERO_IDS) expect(buildBuilding(plan([h, rect(40, 24), 2, {}]), mats).length).toBeGreaterThan(0);
  });

  it('perakitan gagal → K12 (dengan input) atau lempar (tanpa input)', () => {
    const p = plan(SPECIMENS[0]);
    const broken = { ...p, masses: [{ ...p.masses[0], faces: null }] };
    const logger = { error: vi.fn() };
    expect(() => buildBuilding(broken, mats)).toThrow();
    const parts = buildBuilding(broken, mats, { input: { id: 'uji', ring: rect(40, 12), levels: 1, front: [0, 1], groundY: () => 0 }, logger });
    expect(parts.length).toBeGreaterThan(0);
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('atlas', () => {
  const cells = Object.entries(ATLAS_CELLS);

  it('semua sel di dalam 2048², selaras 64 px, tidak tumpang tindih', () => {
    for (const [id, c] of cells) {
      expect(c.x + c.w, id).toBeLessThanOrEqual(ATLAS_SIZE);
      expect(c.y + c.h, id).toBeLessThanOrEqual(ATLAS_SIZE);
      for (const v of [c.x, c.y, c.w, c.h]) expect(v % 64, id).toBe(0);
    }
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < cells.length; j += 1) {
        const [a, A] = cells[i];
        const [b, B] = cells[j];
        const overlap = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
        expect(overlap, `${a} × ${b}`).toBe(false);
      }
    }
  });

  it('setiap sel punya pelukis; jumlah sel & sel potong/menyala', () => {
    for (const [id] of cells) expect(typeof PAINTERS[id], id).toBe('function');
    expect(cells.length).toBe(73);
    expect(cells.filter(([, c]) => c.alpha).map(([id]) => id)).toEqual(expect.arrayContaining(['roster-kotak', 'roster-lingkaran', 'roster-silang', 'roster-bunga', 'roster-krawangan', 'layar-segitiga', 'layar-vertikal', 'layar-wajik', 'railing', 'jemuran', 'ilalang', 'besi-tulangan']));
    expect(cells.filter(([, c]) => c.glow).map(([id]) => id).sort()).toEqual(['kaca-biru-nyala', 'lampu', 'lod1-adb-nyala', 'lod1-kuliah-nyala', 'lod1-rusun-nyala', 'nako-nyala']);
  });

  it('cellUv: flipY (v bawah < v atas), inset 4 px', () => {
    const r = cellUv('plester');
    expect(r.u0).toBeCloseTo(4 / 2048, 9);
    expect(r.u1).toBeCloseTo(252 / 2048, 9);
    expect(r.v1).toBeCloseTo(1 - 4 / 2048, 9);
    expect(r.v0).toBeCloseTo(1 - 252 / 2048, 9);
  });

  it('clipRect: segitiga diklip ke sel', () => {
    const c = clipRect([[0, 0], [4, 0], [0, 4]], 0, 0, 2, 2);
    expect(c.length).toBeGreaterThanOrEqual(4);
  });

  it('ornamen yang direncanakan semua punya builder', () => {
    expect(ORNAMENT_IDS).toEqual(expect.arrayContaining(['teras-kanopi', 'tangga-tengah', 'tiang-bendera', 'pot', 'exhaust', 'kanopi-masuk', 'tempat-wudu', 'rak-sandal', 'etalase', 'meja-bangku', 'spanduk-menu', 'tandon', 'ilalang']));
    expect(ARCHETYPE_IDS).toHaveLength(12);
  });
});
```

- [ ] **Step 2: Jalankan semua tes kit + resolve lengkap**

Run: `node node_modules/vitest/vitest.mjs run tests/kit tests/districts/resolveBuilding.test.js`
Expected: kit 62 PASS (obb 9, decompose 8, planBuilding 20, kitBuild 25), resolveBuilding 28 PASS.

Acuan segitiga LOD0 hasil sandbox (spesimen di atas): K01 1 lt ±2,1k, K01 2 lt ±4,5k, K02 ±3,6k, K03 50×50 4 lt ±20k, K04 ±1,4k, K05 ±1,9k, K06 ±1,3k, K07 ±0,8k, K08 ±0,8k, K09 ±15,4k, K10 ±2,1k, K11 ±0,4k, K12 ±0,7k. Seluruh 216 gedung nyata: LOD0 total ±525k (bila semua LOD0), LOD1 total ±97k.

- [ ] **Step 3: Commit**

```bash
git add tests/kit/kitBuild.test.js
```
```bash
git commit -m "test(kit): asap & budget segitiga per arketipe, validasi tata letak atlas"
```

---

## Task 12: Galeri arketipe (review visual) + screenshot

**Files:**
- Create: `kit-gallery.html`, `src/dev/kitGallery.js`, `tests/e2e/kitGallery.shot.mjs`

Halaman dev (tidak ikut `npm run build`: input build hanya `index.html`). Query: `?kit=all` (satu spesimen per arketipe, grid), `?kit=variasi` (semua varian), `?kit=K01`…`K12`, `?kit=hero`, `&lod=1`, `&malam=1`, `&atlas=1` (atlas di bidang), `&seed=N`, `&cam=atas`. `window.__kitGallery = { ready, stats:{ perSpecimen:[{label,kit,triangles,fallback}], drawCalls, triangles, atlasMs } }`.

- [ ] **Step 1: `kit-gallery.html`**

`kit-gallery.html`:
```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Galeri kit gedung UNRI (dev)</title>
    <style>html, body { margin: 0; height: 100%; overflow: hidden; background: #111; }</style>
  </head>
  <body>
    <script type="module" src="/src/dev/kitGallery.js"></script>
  </body>
</html>
```

- [ ] **Step 2: `src/dev/kitGallery.js`**

`src/dev/kitGallery.js`:
```js
/**
 * Galeri arketipe kit gedung (DEV, tidak ikut build produksi): /kit-gallery.html?kit=all|K01..K12|hero
 * &lod=0|1 &malam=1 &atlas=1 &seed=N &cam=depan|atas. Spesimen footprint sintetis berukuran tipikal katalog
 * aset (§1) berjajar menghadap kamera (+Z), label di atasnya; window.__kitGallery = { ready, stats } untuk
 * skrip screenshot (tests/e2e/kitGallery.shot.mjs → docs/screenshots/unri/m3-*.jpg).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createResourceScope } from '../engine/ResourceScope.js';
import { ARCHETYPE_IDS, VARIANTS } from '../world/kit/archetypes.js';
import { createKitMaterials, KIT_NIGHT } from '../world/kit/kitMaterials.js';
import { createKitSink } from '../world/kit/kitBuilder.js';
import { appendPlanSteps } from '../world/kit/buildBuilding.js';
import { planBuilding } from '../world/kit/planBuilding.js';
import { appendSigns, collectSigns, createSignAtlas } from '../world/kit/signs.js';
import { ATLAS_SIZE } from '../world/kit/atlas.js';

/** Spesimen: [arketipe, lebar(x), dalam(z), lantai, overrides, label]. Ukuran dari katalog aset §1. */
const SPECIMENS = Object.freeze({
  K01: [['K01', 40, 12, 1, {}, 'K01 kuliah-koridor 1 lt'], ['K01', 46, 15, 2, { roof: 'limas', palette: 'putih-seng' }, 'K01 2 lt limas'], ['K01', 30, 10, 1, { palette: 'krem-genteng' }, 'K01 genteng']],
  K02: [['K02', 35, 14, 2, { sign: 'GEDUNG DEKANAT' }, 'K02 dekanat']],
  K03: [['K03', 50, 24, 3, { variant: 'segitiga', sign: 'INTEGRATED CLASSROOM' }, 'K03 segitiga'], ['K03', 40, 20, 4, { variant: 'wajik', sign: 'HEALTH SCIENCES CENTER' }, 'K03 wajik'], ['K03', 34, 18, 3, { variant: 'vertikal', sign: 'INTEGRATED LABORATORY' }, 'K03 vertikal']],
  K04: [['K04', 30, 15, 1, {}, 'K04 lab-bengkel'], ['K04', 40, 12, 2, {}, 'K04 2 lt']],
  K05: [['K05', 30, 20, 1, { sign: 'AUDITORIUM' }, 'K05 aula']],
  K06: [['K06', 12, 12, 1, {}, 'K06 limas-tumpang'], ['K06', 14, 12, 1, { variant: 'kubah-kecil', roof: 'datar-parapet' }, 'K06 kubah-kecil']],
  K07: [['K07', 20, 10, 1, {}, 'K07 kantin'], ['K07', 22, 9, 1, { variant: 'parkir' }, 'K07 parkir']],
  K08: [['K08', 12, 10, 1, {}, 'K08 pendopo-kayu']],
  K09: [['K09', 69, 23, 5, {}, 'K09 rusun']],
  K10: [['K10', 40, 14, 3, { variant: 'rangka' }, 'K10 rangka'], ['K10', 50, 13, 3, { variant: 'beratap', roof: 'pelana' }, 'K10 beratap']],
  K11: [['K11', 6, 5, 1, { variant: 'pos' }, 'K11 pos'], ['K11', 7, 5, 1, { variant: 'toilet' }, 'K11 toilet'], ['K11', 8, 6, 1, {}, 'K11 gudang']],
  K12: [['K12', 0, 0, 3, {}, 'K12 ekstrusi (L tak siku)']],
  hero: [
    ['hero:rektorat', 64, 38, 5, { palette: 'putih', roof: 'datar-parapet', sign: 'REKTORAT UNIVERSITAS RIAU' }, 'hero:rektorat'],
    ['hero:masjid-arfaunnas', 30, 28, 2, { roof: 'datar-parapet' }, 'hero:masjid-arfaunnas'],
    ['hero:ggm', -82, -82, 4, {}, 'hero:ggm (lingkaran)'],
    ['hero:sekretariat-lembaga', 16.8, 15.7, 1, {}, 'hero:sekretariat-lembaga'],
    ['hero:student-center', 53, 51, 3, { variant: 'segitiga' }, 'hero:student-center'],
    ['hero:stadion-mini', 137, 25, 2, {}, 'hero:stadion-mini (tribun)'],
    ['hero:gerbang-sm-amin', 20, 4, 1, {}, 'hero:gerbang-sm-amin'],
  ],
});

const params = new URLSearchParams(window.location.search);
const which = params.get('kit') ?? 'all';
const lod = Number(params.get('lod') ?? 0) === 1 ? 1 : 0;
const night = params.get('malam') === '1';
const seedBase = Number(params.get('seed') ?? 1);

/** Ring persegi w × d berpusat (cx, 0), sisi panjang sejajar X. */
function rectRing(cx, w, d) {
  return [[cx - w / 2, -d / 2], [cx + w / 2, -d / 2], [cx + w / 2, d / 2], [cx - w / 2, d / 2]];
}

/** Lingkaran 16 sisi berdiameter d (GGM). */
function circleRing(cx, d) {
  return Array.from({ length: 16 }, (_, i) => [cx + (Math.cos((i / 16) * Math.PI * 2) * d) / 2, (Math.sin((i / 16) * Math.PI * 2) * d) / 2]);
}

/** Footprint tak beraturan untuk K12: L dengan satu sisi miring 20°. */
function irregularRing(cx) {
  return [[cx - 18, -10], [cx + 14, -10], [cx + 18, 2], [cx + 4, 10], [cx - 18, 10]];
}

function specimenList() {
  if (which === 'all') return ARCHETYPE_IDS.map((id) => SPECIMENS[id][0]);
  if (which === 'variasi') return ARCHETYPE_IDS.flatMap((id) => SPECIMENS[id]);
  return SPECIMENS[which] ?? SPECIMENS.K01;
}

function labelSprite(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,24,30,0.78)';
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#fff';
  g.font = '600 40px Inter, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 48);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(20, 3.75, 1);
  return s;
}

function setupScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? 0x0d1424 : 0xbfe0f7);
  scene.add(new THREE.HemisphereLight(night ? 0x223355 : 0xdfefff, night ? 0x111111 : 0x7a8a5a, night ? 0.25 : 1.1));
  const sun = new THREE.DirectionalLight(night ? 0x8899cc : 0xfff1dc, night ? 0.15 : 2.4);
  sun.position.set(-60, 90, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, far: 600 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x9fbf6a }));
  ground.receiveShadow = true;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 3000);
  return { renderer, scene, camera, sun };
}

/** Tata letak grid: kolom = ceil(sqrt(n * 1,6)); sel selebar spesimen terlebar + 16 m. */
function gridLayout(list) {
  const cols = Math.min(list.length, Math.ceil(Math.sqrt(list.length * 1.6)));
  const cellW = Math.max(...list.map(([, w]) => Math.abs(w) || 36)) + 16;
  const cellD = Math.max(...list.map(([, , d]) => Math.abs(d) || 20)) + 26;
  const rows = Math.ceil(list.length / cols);
  return {
    span: Math.max(cols * cellW, rows * cellD),
    at: (i) => ({ x: ((i % cols) - (cols - 1) / 2) * cellW, z: (Math.floor(i / cols) - (rows - 1) / 2) * cellD }),
  };
}

function buildSpecimens(scene, mats) {
  const list = specimenList();
  const layout = gridLayout(list);
  const sink = createKitSink();
  const plans = [];
  const perSpecimen = [];
  list.forEach(([arch, w, d, levels, ov, label], i) => {
    const { x: cx, z: cz } = layout.at(i);
    const base = arch === 'K12' ? irregularRing(cx) : w < 0 ? circleRing(cx, -w) : rectRing(cx, w, d);
    const ring = base.map(([x, z]) => [x, z + cz]);
    const plan = planBuilding({ id: `galeri-${i}`, ring, levels, archetype: arch, overrides: ov, seed: seedBase * 7919 + i, front: [0, 1], groundY: () => 0 });
    const before = sink.triangles;
    for (const _ of appendPlanSteps(sink, plan, mats, { lod })) { /* semua langkah */ }
    plans.push(plan);
    perSpecimen.push({ label, kit: plan.kit, triangles: sink.triangles - before, fallback: plan.fallback });
    const s = labelSprite(label);
    s.position.set(cx, plan.baseY + plan.height + 9, cz);
    scene.add(s);
  });
  const signs = lod === 0 ? collectSigns(plans) : [];
  const atlas = signs.length ? createSignAtlas(signs.map((e) => e.sign)) : null;
  if (atlas) appendSigns(sink, signs, atlas);
  const root = new THREE.Group();
  for (const p of sink.toParts({ ...mats, papan: atlas?.material ?? null }, 'galeri')) {
    const m = new THREE.Mesh(p.geometry, p.material);
    m.castShadow = p.castShadow;
    m.receiveShadow = true;
    root.add(m);
  }
  scene.add(root);
  return { root, perSpecimen, span: layout.span };
}

function showAtlas(scene, mats, camera, controls) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshBasicMaterial({ map: mats.textures.map, transparent: true }));
  plane.position.set(0, 34, 0);
  scene.add(plane);
  camera.position.set(0, 34, 92);
  controls.target.set(0, 34, 0);
}

function main() {
  const { renderer, scene, camera } = setupScene();
  const scope = createResourceScope('galeri-kit');
  const t0 = performance.now();
  const mats = createKitMaterials(scope, { anisotropy: renderer.capabilities.getMaxAnisotropy() });
  const atlasMs = performance.now() - t0;
  if (night) mats.opak.emissiveIntensity = KIT_NIGHT.on;
  const controls = new OrbitControls(camera, renderer.domElement);
  let stats = { perSpecimen: [] };
  if (params.get('atlas') === '1') showAtlas(scene, mats, camera, controls);
  else {
    const built = buildSpecimens(scene, mats);
    stats = { perSpecimen: built.perSpecimen };
    const dist = Math.max(60, built.span * 0.62);
    const top = params.get('cam') === 'atas';
    camera.position.set(-dist * 0.12, top ? dist * 0.9 : dist * 0.3, top ? dist * 0.4 : dist * 0.78);
    controls.target.set(0, 4, 0);
  }
  controls.update();
  renderer.render(scene, camera);
  stats.drawCalls = renderer.info.render.calls;
  stats.triangles = renderer.info.render.triangles;
  stats.atlasSize = ATLAS_SIZE;
  stats.atlasMs = Math.round(atlasMs);
  stats.variants = VARIANTS;
  window.__kitGallery = { ready: true, stats };
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

main();
```

- [ ] **Step 3: `tests/e2e/kitGallery.shot.mjs`**

`tests/e2e/kitGallery.shot.mjs`:
```js
#!/usr/bin/env node
/**
 * Screenshot galeri kit gedung (review visual M3) — TIDAK ikut `vitest run`.
 *   node tests/e2e/kitGallery.shot.mjs [--gpu d3d11|swiftshader] [--out docs/screenshots/unri]
 * Menjalankan Vite (port 5175) dari root repo, Chromium headless 1600×900 (paket `playwright` global seperti
 * smoke.e2e.mjs), membuka /kit-gallery.html dengan beberapa query, menyimpan JPG, dan mencetak statistik
 * (segitiga per spesimen, draw call) sebagai JSON ke stdout.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5175;
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const SHOTS = Object.freeze([
  ['m3-galeri.jpg', 'kit=all'],
  ['m3-galeri-variasi.jpg', 'kit=variasi&cam=atas'],
  ['m3-galeri-malam.jpg', 'kit=all&malam=1'],
  ['m3-galeri-lod1.jpg', 'kit=all&lod=1'],
  ['m3-atlas.jpg', 'atlas=1'],
  ...['K01', 'K02', 'K03', 'K04', 'K05', 'K06', 'K07', 'K08', 'K09', 'K10', 'K11', 'K12', 'hero'].map((k) => [`m3-${k.toLowerCase()}.jpg`, `kit=${k}`]),
]);

const { values: opts } = parseArgs({ options: { gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string', default: 'docs/screenshots/unri' } } });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch { /* kandidat berikutnya */ }
  }
  throw new Error('Paket playwright tidak ditemukan (npm i -g playwright, atau set PLAYWRIGHT_PATH)');
}

async function main() {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const outDir = join(ROOT, opts.out);
  mkdirSync(outDir, { recursive: true });
  const report = { gpu: opts.gpu, shots: {}, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') report.errors.push(`${m.type()}: ${m.text()}`); });
    for (const [file, query] of SHOTS) {
      await page.goto(`http://localhost:${PORT}/kit-gallery.html?${query}`);
      await page.waitForFunction(() => window.__kitGallery?.ready === true, null, { timeout: 120000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(outDir, file), type: 'jpeg', quality: 88 });
      report.shots[file] = await page.evaluate(() => window.__kitGallery.stats);
      process.stderr.write(`ok ${file}\n`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.errors.length) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  process.exit(1);
});
```

- [ ] **Step 4: Jalankan & lihat**

Run: `node tests/e2e/kitGallery.shot.mjs --gpu d3d11 > galeri-laporan.json`
Expected: stderr `ok m3-galeri.jpg` … `ok m3-hero.jpg` (18 berkas di `docs/screenshots/unri/`), exit 0, `errors: []`. Acuan sandbox: `m3-galeri.jpg` 15 draw call / ±73k segitiga; `atlasMs` 75–155 ms (sekali saat distrik dibangun). Hapus `galeri-laporan.json` setelah dibaca (jangan di-commit).

Buka gambar dan periksa **per arketipe** (ciri wajib spec §7.1). Bila satu butir gagal, perbaiki kode Task 8–10 lalu ulangi langkah ini:

| Gambar | Wajib terlihat |
|---|---|
| `m3-k01.jpg` | selasar bertiang di sisi depan; pintu tiap 3 bay; nako/jalusi + roster tembus di atas jendela; plint abu; talang & pipa turun; atap seng abu kebiruan pelana (dan limas pada spesimen 2); varian genteng merah |
| `m3-k02.jpg` | K01 + teras berkanopi beton di tengah, tangga, papan huruf timbul di lisplang kanopi, tiang bendera merah putih, dua pot tanaman |
| `m3-k03.jpg` | massa putih, lantai dasar kaca biru + lobi kaca, lantai atas panel layar oranye-terakota per bay dengan kolom putih terlihat di sela, tiga motif berbeda, atap pelana lebar abu muda bertritisan 2,5 m, panel hitam huruf putih |
| `m3-k04.jpg` | lantai tinggi 5 m, pintu gulung di sisi pendek, jalusi kayu + clerestory, exhaust di dinding ujung, atap pelana 30° |
| `m3-k05.jpg` | dinding tinggi 7 m, jendela tinggi, pita ventilasi atas, pintu ganda + kanopi masuk |
| `m3-k06.jpg` | teras keramik keliling berkolom, atap limas tumpang dua tingkat + pita jalusi + mustaka; varian kubah; tempat wudu di samping, rak sandal |
| `m3-k07.jpg` | kantin: kolom keliling, etalase, meja-bangku panjang, spanduk menu; parkir: tiang besi + atap seng tanpa dinding |
| `m3-k08.jpg` | tiang & dinding kayu, lantai papan, atap limas |
| `m3-k09.jpg` | 5 lantai, koridor terbuka berrailing di depan + pintu unit + jendela, balkon berjemuran (almamater biru langit) di belakang, 2 tandon oranye di atap datar berparapet |
| `m3-k10.jpg` | rangka beton tanpa kaca, kolom dalam terlihat tembus, isian bata sebagian, coretan, besi tulangan di puncak (rangka), atap seng karat (beratap), ilalang |
| `m3-k11.jpg` | pos (jendela lebar), toilet (roster tinggi), gudang |
| `m3-k12.jpg` | ekstrusi poligon tak siku, fasad modul jendela dilukis per lantai, plint, pita lantai, parapet, pintu nyata |
| `m3-hero.jpg` | placeholder berukuran footprint: rektorat putih 5 lt + blok kaca biru, masjid + kubah, GGM silinder, sekretariat, student center (K03), tribun undakan, gerbang |
| `m3-galeri-malam.jpg` | sebagian jendela menyala hangat (rusun paling banyak), lampu selasar menyala |
| `m3-galeri-lod1.jpg` | siluet & warna tiap arketipe tetap terbaca (fasad dilukis), segitiga ≤ ±13k untuk 12 spesimen |
| `m3-atlas.jpg` | 73 sel terisi, tidak ada sel kosong/hitam di luar `gelap`/`papan-kosong` |

- [ ] **Step 5: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.

```bash
git add kit-gallery.html src/dev/kitGallery.js tests/e2e/kitGallery.shot.mjs docs/screenshots/unri/m3-galeri.jpg docs/screenshots/unri/m3-galeri-variasi.jpg docs/screenshots/unri/m3-galeri-malam.jpg docs/screenshots/unri/m3-galeri-lod1.jpg docs/screenshots/unri/m3-atlas.jpg docs/screenshots/unri/m3-k01.jpg docs/screenshots/unri/m3-k02.jpg docs/screenshots/unri/m3-k03.jpg docs/screenshots/unri/m3-k04.jpg docs/screenshots/unri/m3-k05.jpg docs/screenshots/unri/m3-k06.jpg docs/screenshots/unri/m3-k07.jpg docs/screenshots/unri/m3-k08.jpg docs/screenshots/unri/m3-k09.jpg docs/screenshots/unri/m3-k10.jpg docs/screenshots/unri/m3-k11.jpg docs/screenshots/unri/m3-k12.jpg docs/screenshots/unri/m3-hero.jpg
```
```bash
git commit -m "feat(dev): galeri arketipe kit gedung dan screenshot review visual M3"
```

---

## Task 13: Bake `buildings.json` (TDD + bake nyata)

**Files:**
- Test: `tests/campusbake/buildings.test.js`, fixture `tests/campusbake/fixtures/osm-buildings-mini.json`, `tests/campusbake/fixtures/ground/0_0.json`
- Create: `src/districts/unri/buildingsFormat.js`, `tools/campusbake/buildings.js`
- Modify: `tools/campusbake/index.js`
- Output: `public/districts/unri/buildings.json`

- [ ] **Step 1: Fixture OSM mini** (`tests/campusbake/fixtures/osm-buildings-mini.json`, satu baris; dibuat dari koordinat dunia lewat `createProjection(WORLD_ORIGIN).toLatLon`, 8 desimal): way 1001 "Gedung A FKIP" 40×12 di (0,0); way 1002 "Gedung Dekanat Uji" 30×14 di (100,0) levels "4-7"; way 1003 ganda dari relation; relation 2001 "Lab Uji" 40×40 di (−150,100) berlubang 16×16; way 3001 "Integrated Classroom Uji" (tersirat) 30×20 di (150,150); way 3002 "Lapangan Uji" (dibuang); way 3003 "Kawasan FKIP Uji" 200×200 memuat gedung (dibuang); way 1004 di luar batas (500,0); highway 4001 di z = 30.

`tests/campusbake/fixtures/osm-buildings-mini.json`:
```json
{"version":0.6,"osm3s":{"timestamp_osm_base":"2026-10-16T00:00:00Z"},"elements":[{"type":"way","id":1001,"nodes":[1,2,3,4,1],"geometry":[{"lat":0.48364966,"lon":101.38934803},{"lat":0.48364966,"lon":101.38970737},{"lat":0.48354114,"lon":101.38970737},{"lat":0.48354114,"lon":101.38934803},{"lat":0.48364966,"lon":101.38934803}],"tags":{"building":"yes","name":"Gedung A FKIP","building:levels":"1","amenity":"university"}},{"type":"way","id":1002,"nodes":[6,7,8,9,6],"geometry":[{"lat":0.48365871,"lon":101.3902913},{"lat":0.48365871,"lon":101.3905608},{"lat":0.48353209,"lon":101.3905608},{"lat":0.48353209,"lon":101.3902913},{"lat":0.48365871,"lon":101.3902913}],"tags":{"building":"yes","name":"Gedung Dekanat Uji","building:levels":"4-7","building:roof":"tin"}},{"type":"way","id":1003,"nodes":[11,12,13,14,11],"geometry":[{"lat":0.4828719,"lon":101.38800051},{"lat":0.4828719,"lon":101.38835985},{"lat":0.48251016,"lon":101.38835985},{"lat":0.48251016,"lon":101.38800051},{"lat":0.4828719,"lon":101.38800051}],"tags":{"building":"yes","name":"Lab Uji (ganda)"}},{"type":"relation","id":2001,"tags":{"type":"multipolygon","building":"laboratorium","name":"Lab Uji"},"members":[{"type":"way","ref":9001,"role":"outer","geometry":[{"lat":0.4828719,"lon":101.38800051},{"lat":0.4828719,"lon":101.38835985},{"lat":0.48251016,"lon":101.38835985},{"lat":0.48251016,"lon":101.38800051},{"lat":0.4828719,"lon":101.38800051}]},{"type":"way","ref":9002,"role":"inner","geometry":[{"lat":0.48276338,"lon":101.38810831},{"lat":0.48276338,"lon":101.38825205},{"lat":0.48261868,"lon":101.38825205},{"lat":0.48261868,"lon":101.38810831},{"lat":0.48276338,"lon":101.38810831}]}]},{"type":"way","id":3001,"nodes":[16,17,18,19,16],"geometry":[{"lat":0.48232928,"lon":101.39074047},{"lat":0.48232928,"lon":101.39100997},{"lat":0.48214841,"lon":101.39100997},{"lat":0.48214841,"lon":101.39074047},{"lat":0.48232928,"lon":101.39074047}],"tags":{"amenity":"university","name":"Integrated Classroom Uji"}},{"type":"way","id":3002,"nodes":[21,22,23,24,21],"geometry":[{"lat":0.48513283,"lon":101.38840477},{"lat":0.48513283,"lon":101.38885394},{"lat":0.48477108,"lon":101.38885394},{"lat":0.48477108,"lon":101.38840477},{"lat":0.48513283,"lon":101.38840477}],"tags":{"amenity":"university","name":"Lapangan Uji"}},{"type":"way","id":3003,"nodes":[26,27,28,29,26],"geometry":[{"lat":0.48449977,"lon":101.38862935},{"lat":0.48449977,"lon":101.39042605},{"lat":0.48269103,"lon":101.39042605},{"lat":0.48269103,"lon":101.38862935},{"lat":0.48449977,"lon":101.38862935}],"tags":{"amenity":"university","name":"Kawasan FKIP Uji"}},{"type":"way","id":1004,"nodes":[31,32,33,34,31],"geometry":[{"lat":0.48364062,"lon":101.3939296},{"lat":0.48364062,"lon":101.39410927},{"lat":0.48355018,"lon":101.39410927},{"lat":0.48355018,"lon":101.3939296},{"lat":0.48364062,"lon":101.3939296}],"tags":{"building":"yes","name":"Di luar batas"}},{"type":"way","id":4001,"nodes":[36,37],"geometry":[{"lat":0.48332409,"lon":101.38773101},{"lat":0.48332409,"lon":101.39132439}],"tags":{"highway":"tertiary","name":"Jl. Uji"}}]}
```

- [ ] **Step 2: Fixture ground format M2** (`tests/campusbake/fixtures/ground/0_0.json`; koordinat bulat 0,1 m relatif sudut chunk, lebar desimeter):

`tests/campusbake/fixtures/ground/0_0.json`:
```json
{"v":1,"key":"0_0","roads":[{"cls":"tertiary","w":70,"pts":[-2000,300,2000,300]}],"walks":[],"areas":[],"weights":{"n":2,"grass":"AAAAAA==","soil":"AAAAAA==","wet":"AAAAAA=="}}
```

- [ ] **Step 3: Tulis tes**

`tests/campusbake/buildings.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjection } from '../../src/geo/projection.js';
import {
  bakeBuildingsData, dropDuplicates, levelsOf, nearestRoadFront, roadsFromGround, runBuildingsBake, serializeBuildings, summarize,
} from '../../tools/campusbake/buildings.js';
import { validateBuildingsData } from '../../src/districts/unri/buildingsFormat.js';

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url));
const OSM = JSON.parse(readFileSync(join(FIX, 'osm-buildings-mini.json'), 'utf8'));
const proj = createProjection({ lat0: 0.4835954, lon0: 101.3895277 });
const project = (lat, lon) => proj.toWorld(lat, lon);
const BOUNDARY = [[-300, -300], [300, -300], [300, 300], [-300, 300]];
const ROADS = [{ pts: [[-200, 30], [200, 30]] }];
const quiet = { info: () => {}, warn: () => {} };

describe('campusbake buildings (fixture mini)', () => {
  const data = bakeBuildingsData({ elements: OSM.elements, project, boundary: BOUNDARY, roads: ROADS });

  it('gedung: way, relation berlubang, tersirat; ganda/lapangan/kawasan/luar batas dibuang; urut id', () => {
    expect(data.buildings.map((b) => b.id)).toEqual(['r2001', 'w1001', 'w1002', 'w3001']);
    expect(validateBuildingsData(data)).toEqual([]);
    expect(summarize(data)).toEqual({ buildings: 4, clusters: 2, implied: 1, relations: 1, withoutFront: 1 });
  });

  it('w1001: ring terkuantisasi 0,1 m, level, cluster, luas, front ke jalan di z = 30', () => {
    expect(data.buildings[1]).toEqual({
      id: 'w1001', ring: [[-20, -6], [20, -6], [20, 6], [-20, 6]], levels: 1,
      tags: { name: 'Gedung A FKIP', building: 'yes', amenity: 'university', 'building:levels': '1' },
      cluster: '0_0', area: 480, front: [0, 1],
    });
  });

  it('rentang "4-7" → 4; relation simpan lubang & front ke selatan-utara; tersirat bertag building=implied', () => {
    expect(data.buildings[2].levels).toBe(4);
    expect(data.buildings[0]).toMatchObject({ cluster: '-1_0', area: 1600, front: [0, -1] });
    expect(data.buildings[0].holes).toHaveLength(1);
    expect(data.buildings[3]).toMatchObject({ tags: { building: 'implied', name: 'Integrated Classroom Uji', amenity: 'university' }, front: null, area: 600 });
  });

  it('serialisasi deterministik (bake dua kali → byte identik), satu gedung per baris', () => {
    const again = bakeBuildingsData({ elements: OSM.elements, project, boundary: BOUNDARY, roads: ROADS });
    const a = serializeBuildings(data);
    expect(serializeBuildings(again)).toBe(a);
    expect(a.split('\n')).toHaveLength(data.buildings.length + 3);
    expect(JSON.parse(a)).toEqual(data);
  });

  it('helper murni', () => {
    expect(levelsOf('4-7')).toBe(4);
    expect(levelsOf(undefined)).toBeNull();
    expect(nearestRoadFront(0, 0, ROADS)).toEqual([0, 1]);
    expect(nearestRoadFront(0, 200, ROADS)).toBeNull();
    const d = dropDuplicates([{ id: 'w5', ring: BOUNDARY, holes: [] }, { id: 'r1', ring: BOUNDARY, holes: [[[0, 0], [1, 0], [1, 1]]] }]);
    expect(d.dropped).toEqual(['w5']);
  });

  it('runBuildingsBake: baca cache OSM + ground (M2), tulis buildings.json', async () => {
    const root = await mkdtemp(join(tmpdir(), 'campusbake-gedung-'));
    try {
      await mkdir(join(root, 'data-src', 'osm'), { recursive: true });
      await writeFile(join(root, 'data-src', 'osm', 'stadion.json'), JSON.stringify(OSM));
      await mkdir(join(root, 'public', 'districts', 'unri'), { recursive: true });
      await cp(join(FIX, 'ground'), join(root, 'public', 'districts', 'unri', 'ground'), { recursive: true });
      expect(await roadsFromGround(join(root, 'public', 'districts', 'unri', 'ground'), quiet)).toEqual([{ pts: [[-200, 30], [200, 30]] }]);
      const res = await runBuildingsBake({ root, boundary: BOUNDARY, project, log: quiet });
      const text = await readFile(join(root, 'public', 'districts', 'unri', 'buildings.json'), 'utf8');
      expect(text).toBe(serializeBuildings(data));
      expect(res.bytes).toBe(text.length);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('tanpa cache OSM → galat jelas berisi langkah', async () => {
    const root = await mkdtemp(join(tmpdir(), 'campusbake-kosong-'));
    try {
      await expect(runBuildingsBake({ root, boundary: BOUNDARY, project, log: quiet })).rejects.toThrow(/npm run bake -- --area stadion/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 4: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/buildings.test.js`
Expected: FAIL — modul belum ada.

- [ ] **Step 5: `src/districts/unri/buildingsFormat.js`**

`src/districts/unri/buildingsFormat.js`:
```js
/**
 * Format public/districts/unri/buildings.json (indeks M3): { v:1, buildings:[{ id, ring, levels, tags, cluster,
 * area, front, holes? }] }. Sumber tunggal konstanta format untuk tools/campusbake/buildings.js dan klien
 * distrik (validasi saat muat). Murni (tanpa three).
 */
export const BUILDINGS_FORMAT = Object.freeze({ v: 1, cluster: 250, quant: 0.1, frontMax: 80, maxBuildings: 2000 });

const ID_RE = /^[wr]\d+$/;
const KEY_RE = /^-?\d+_-?\d+$/;

/** Kunci klaster 250 m dari titik dunia, mis. "-5_4". */
export function clusterKey(x, z, size = BUILDINGS_FORMAT.cluster) {
  return `${Math.floor(x / size)}_${Math.floor(z / size)}`;
}

const isRing = (r) => Array.isArray(r) && r.length >= 3 && r.every((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));

/** Galat satu entri gedung (kosong = valid). */
export function buildingErrors(b, i) {
  const at = `buildings[${i}]${b?.id ? ` (${b.id})` : ''}`;
  if (!b || typeof b !== 'object') return [`${at}: bukan objek`];
  const errs = [];
  if (!ID_RE.test(b.id ?? '')) errs.push(`${at}: id harus "w<angka>"/"r<angka>"`);
  if (!isRing(b.ring)) errs.push(`${at}: ring harus ≥ 3 titik [x,z] berhingga`);
  if (b.levels !== null && !(Number.isInteger(b.levels) && b.levels >= 1 && b.levels <= 60)) errs.push(`${at}: levels harus null atau 1–60`);
  if (!b.tags || typeof b.tags !== 'object') errs.push(`${at}: tags wajib objek`);
  if (!KEY_RE.test(b.cluster ?? '')) errs.push(`${at}: cluster harus "cx_cz"`);
  if (!(b.area > 0)) errs.push(`${at}: area harus > 0`);
  if (b.front !== null && !(Array.isArray(b.front) && b.front.length === 2 && b.front.every(Number.isFinite))) errs.push(`${at}: front harus null atau [fx,fz]`);
  if (b.holes !== undefined && !(Array.isArray(b.holes) && b.holes.every(isRing))) errs.push(`${at}: holes harus array ring`);
  return errs;
}

/**
 * Validasi berkas buildings.json; [] = valid. Galat pertama per gedung saja agar laporan ringkas.
 * @returns {string[]}
 */
export function validateBuildingsData(json) {
  if (!json || typeof json !== 'object') return ['buildings.json: bukan objek'];
  if (json.v !== BUILDINGS_FORMAT.v) return [`buildings.json: versi ${json.v} tidak didukung (harus ${BUILDINGS_FORMAT.v})`];
  if (!Array.isArray(json.buildings)) return ['buildings.json: buildings harus array'];
  if (json.buildings.length > BUILDINGS_FORMAT.maxBuildings) return [`buildings.json: > ${BUILDINGS_FORMAT.maxBuildings} gedung`];
  const errs = [];
  const seen = new Set();
  json.buildings.forEach((b, i) => {
    const e = buildingErrors(b, i);
    if (e.length) errs.push(e[0]);
    if (seen.has(b?.id)) errs.push(`buildings[${i}]: id ganda ${b.id}`);
    seen.add(b?.id);
  });
  return errs;
}
```

- [ ] **Step 6: `tools/campusbake/buildings.js`**

`tools/campusbake/buildings.js`:
```js
/**
 * campusbake langkah `buildings`: gedung OSM di dalam batas distrik UNRI → public/districts/unri/buildings.json
 * (format src/districts/unri/buildingsFormat.js). Sumber gedung: way `building=*`, relation multipolygon
 * `building=*` (ring luar terbesar + lubang), dan "gedung tersirat": way tertutup amenity=university|college
 * BERNAMA tanpa tag building/leisure/landuse, luas 150–10.000 m², tidak memuat gedung lain (IC, HSC, Gedung
 * Mangkrak FISIP dipetakan begini di OSM). `front` = vektor satuan centroid → jalan terdekat ≤ 80 m dari
 * ground/<key>.json (M2; cadangan highway OSM). Deterministik: urut id, kuantisasi 0,1 m, satu gedung per baris.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cleanRing, orientRing, pointInPolygon, polygonArea, polygonCentroid } from '../../src/geo/polygon.js';
import { BUILDINGS_FORMAT, clusterKey, validateBuildingsData } from '../../src/districts/unri/buildingsFormat.js';
import { parseGroundChunk } from '../../src/districts/unri/groundData.js';

const TAG_KEEP = Object.freeze(['name', 'building', 'amenity', 'building:levels', 'building:roof', 'building:walls', 'office']);
const IMPLIED = Object.freeze({ minArea: 150, maxArea: 10000 });
const ROAD_CLASSES = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service', 'living_street', 'pedestrian', 'footway', 'path']);
export const BUILDINGS_PATHS = Object.freeze({
  osm: Object.freeze(['data-src/osm/stadion.json', 'data-src/osm/unri.json']), // unri.json opsional (area bake M2)
  ground: 'public/districts/unri/ground', out: 'public/districts/unri/buildings.json',
});

const q1 = (v) => Number((Math.round(v / BUILDINGS_FORMAT.quant) * BUILDINGS_FORMAT.quant).toFixed(1));

/** "4-7" → 4 (rentang → minimum, sama dengan parseLevels M2); tidak valid → null. */
export function levelsOf(raw) {
  const m = raw === undefined ? null : String(raw).match(/\d+/);
  const v = m ? Number(m[0]) : null;
  return v && v >= 1 && v <= 60 ? v : null;
}

function keepTags(tags) {
  const out = {};
  for (const k of TAG_KEEP) if (tags[k] !== undefined) out[k] = String(tags[k]);
  return out;
}

/** Geometri Overpass [{lat,lon}] → ring dunia bersih berorientasi, kuantisasi 0,1 m; null bila < 3 titik. */
function worldRing(geometry, project, positive = true) {
  const ring = cleanRing(geometry.map((p) => {
    const w = project(p.lat, p.lon);
    return [q1(w.x), q1(w.z)];
  }));
  return ring.length >= 3 ? orientRing(ring, positive) : null;
}

/** Kandidat gedung eksplisit (way & relation building=*). */
export function extractCandidates(elements, project) {
  const out = [];
  for (const e of elements) {
    const tags = e.tags ?? {};
    if (!tags.building || tags.building === 'roof') continue;
    if (e.type === 'way' && e.geometry) {
      const ring = worldRing(e.geometry, project);
      if (ring) out.push({ id: `w${e.id}`, ring, holes: [], tags });
    } else if (e.type === 'relation' && Array.isArray(e.members)) {
      const rings = (role) => e.members.filter((m) => m.role === role && m.geometry)
        .map((m) => worldRing(m.geometry, project, role === 'outer')).filter(Boolean);
      const outers = rings('outer').sort((a, b) => polygonArea(b) - polygonArea(a));
      if (outers.length) {
        const holes = rings('inner').filter((h) => pointInPolygon(h[0][0], h[0][1], outers[0]));
        out.push({ id: `r${e.id}`, ring: outers[0], holes, tags });
      }
    }
  }
  return out;
}

/** Gedung tersirat (lihat kepala berkas). */
export function extractImplied(elements, project, buildings) {
  const out = [];
  for (const e of elements) {
    const t = e.tags ?? {};
    if (e.type !== 'way' || !e.geometry || t.building || !t.name) continue;
    if ((t.amenity !== 'university' && t.amenity !== 'college') || t.leisure || t.landuse || t.sport) continue;
    if (/lapangan|parkir|taman/i.test(t.name)) continue;
    if (!e.nodes || e.nodes[0] !== e.nodes[e.nodes.length - 1]) continue;
    const ring = worldRing(e.geometry, project);
    if (!ring) continue;
    const area = polygonArea(ring);
    if (area < IMPLIED.minArea || area > IMPLIED.maxArea) continue;
    const containsOther = buildings.some((b) => {
      const c = polygonCentroid(b.ring);
      return pointInPolygon(c.x, c.z, ring);
    });
    if (!containsOther) out.push({ id: `w${e.id}`, ring, holes: [], tags: { ...t, building: 'implied' } });
  }
  return out;
}

function nearestOnSegment(px, pz, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2)) : 0;
  const x = a[0] + dx * t;
  const z = a[1] + dz * t;
  return { x, z, d: Math.hypot(px - x, pz - z) };
}

/** Vektor satuan centroid → titik jalan terdekat (≤ maxDist), 3 desimal; null bila tidak ada. */
export function nearestRoadFront(cx, cz, roads, maxDist = BUILDINGS_FORMAT.frontMax) {
  let best = null;
  for (const road of roads) {
    for (let i = 0; i + 1 < road.pts.length; i += 1) {
      const n = nearestOnSegment(cx, cz, road.pts[i], road.pts[i + 1]);
      if (n.d <= maxDist && (!best || n.d < best.d)) best = n;
    }
  }
  if (!best || best.d < 1e-6) return null;
  return [Number(((best.x - cx) / best.d).toFixed(3)), Number(((best.z - cz) / best.d).toFixed(3))];
}

/** Jalan + jalur pejalan dari highway OSM (cadangan bila ground/*.json M2 belum ada). */
export function roadsFromOsm(elements, project) {
  return elements
    .filter((e) => e.type === 'way' && e.geometry && ROAD_CLASSES.has(e.tags?.highway))
    .map((e) => ({ pts: e.geometry.map((p) => { const w = project(p.lat, p.lon); return [w.x, w.z]; }) }));
}

/**
 * Jalan + jalur pejalan dari ground/<key>.json M2 lewat parseGroundChunk (koordinat bulat 0,1 m relatif chunk →
 * dunia). Chunk rusak dilewati (log.warn). null bila direktori kosong/tidak ada.
 */
export async function roadsFromGround(dir, log = console) {
  if (!existsSync(dir)) return null;
  const files = (await readdir(dir)).filter((f) => /^-?\d+_-?\d+\.json$/.test(f)).sort();
  if (!files.length) return null;
  const out = [];
  for (const f of files) {
    const key = f.replace(/\.json$/, '');
    try {
      const g = parseGroundChunk(JSON.parse(await readFile(join(dir, f), 'utf8')), key);
      for (const r of [...g.roads, ...g.walks]) if (r.pts.length >= 2) out.push({ pts: r.pts });
    } catch (err) {
      log.warn(`ground ${key} dilewati: ${err.message}`);
    }
  }
  return out;
}

/**
 * Buang gedung ganda (gedung yang sama dipetakan sebagai way DAN relation, mis. Lab Teknik Elektro
 * w282230766 & r3747439): centroid < 3 m dan rasio luas 0,85–1,15 → simpan yang berlubang (halaman dalam),
 * lalu yang id-nya lebih kecil secara leksikal. Mengembalikan daftar baru + id yang dibuang.
 */
export function dropDuplicates(list) {
  const cs = list.map((b) => ({ b, c: polygonCentroid(b.ring), a: polygonArea(b.ring) }));
  const dropped = new Set();
  for (let i = 0; i < cs.length; i += 1) {
    for (let j = i + 1; j < cs.length; j += 1) {
      const p = cs[i];
      const q = cs[j];
      if (dropped.has(p.b.id) || dropped.has(q.b.id)) continue;
      const near = Math.hypot(p.c.x - q.c.x, p.c.z - q.c.z) < 3;
      const ratio = p.a / q.a;
      if (!near || ratio < 0.85 || ratio > 1.15) continue;
      const keepP = p.b.holes.length !== q.b.holes.length ? p.b.holes.length > q.b.holes.length : p.b.id < q.b.id;
      dropped.add(keepP ? q.b.id : p.b.id);
    }
  }
  return { list: list.filter((b) => !dropped.has(b.id)), dropped: [...dropped].sort() };
}

/**
 * @param {{elements: object[], project: (lat:number, lon:number) => {x:number,z:number},
 *   boundary: Array<[number,number]>, roads: Array<{pts: Array<[number,number]>}>}} input
 * @returns {{v:1, buildings: object[]}}
 */
export function bakeBuildingsData({ elements, project, boundary, roads }) {
  const inside = (b) => {
    const c = polygonCentroid(b.ring);
    return pointInPolygon(c.x, c.z, boundary);
  };
  const explicit = dropDuplicates(extractCandidates(elements, project).filter(inside)).list;
  const implied = extractImplied(elements, project, explicit).filter(inside);
  const seen = new Set();
  const buildings = [...explicit, ...implied]
    .filter((b) => (seen.has(b.id) ? false : seen.add(b.id)))
    .map((b) => {
      const c = polygonCentroid(b.ring);
      const entry = {
        id: b.id, ring: b.ring, levels: levelsOf(b.tags['building:levels']), tags: keepTags(b.tags),
        cluster: clusterKey(c.x, c.z), area: Number(polygonArea(b.ring).toFixed(1)), front: nearestRoadFront(c.x, c.z, roads),
      };
      if (b.holes.length) entry.holes = b.holes;
      return entry;
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { v: BUILDINGS_FORMAT.v, buildings };
}

/** Serialisasi stabil: satu gedung per baris (diff git terbaca), diakhiri newline. */
export function serializeBuildings(data) {
  return `{"v":${data.v},"buildings":[\n${data.buildings.map((b) => JSON.stringify(b)).join(',\n')}\n]}\n`;
}

/** Ringkasan untuk laporan bake: jumlah per klaster, tersirat, relation, tanpa front. */
export function summarize(data) {
  const clusters = new Set(data.buildings.map((b) => b.cluster));
  return {
    buildings: data.buildings.length, clusters: clusters.size,
    implied: data.buildings.filter((b) => b.tags.building === 'implied').length,
    relations: data.buildings.filter((b) => b.id.startsWith('r')).length,
    withoutFront: data.buildings.filter((b) => !b.front).length,
  };
}

/** Elemen OSM dari semua cache yang ada (dedupe type/id; urutan berkas tetap). */
export async function loadOsmElements(root, files = BUILDINGS_PATHS.osm) {
  const present = files.map((f) => join(root, f)).filter((f) => existsSync(f));
  if (!present.length) {
    throw new Error(`Cache OSM tidak ada (${files.join(', ')}). Jalankan "npm run bake -- --area stadion" (citybake) dulu untuk mengisi data-src/osm/.`);
  }
  const seen = new Set();
  const out = [];
  for (const f of present) {
    for (const e of JSON.parse(await readFile(f, 'utf8')).elements ?? []) {
      const k = `${e.type}/${e.id}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(e);
      }
    }
  }
  return out;
}

/**
 * Langkah CLI: baca cache OSM + ground, tulis buildings.json. Dipanggil tools/campusbake/index.js.
 * @param {{root: string, boundary: Array<[number,number]>, project: Function, log?: {info: Function, warn: Function}}} opts
 */
export async function runBuildingsBake({ root, boundary, project, log = console }) {
  const elements = await loadOsmElements(root);
  let roads = await roadsFromGround(join(root, BUILDINGS_PATHS.ground), log);
  if (!roads) {
    log.warn('ground/*.json belum ada (jalankan "npm run bake:campus -- ground"); front dari highway OSM.');
    roads = roadsFromOsm(elements, project);
  }
  const data = bakeBuildingsData({ elements, project, boundary, roads });
  const errs = validateBuildingsData(data);
  if (errs.length) throw new Error(`buildings.json hasil bake tidak valid: ${errs.slice(0, 5).join('; ')}`);
  const out = join(root, BUILDINGS_PATHS.out);
  await mkdir(dirname(out), { recursive: true });
  const text = serializeBuildings(data);
  await writeFile(out, text);
  const s = summarize(data);
  log.info(`buildings: ${s.buildings} gedung (${s.implied} tersirat, ${s.relations} relation), ${s.clusters} klaster, ${s.withoutFront} tanpa front, ${text.length} byte`);
  return { data, bytes: text.length, summary: s };
}
```

- [ ] **Step 7: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/buildings.test.js`
Expected: 7 tes PASS.

- [ ] **Step 8: Cabang CLI `buildings` di `tools/campusbake/index.js`**

Di dispatcher langkah (tempat M2 menambah cabang `ground`), tambahkan impor di atas berkas:

```js
import { runBuildingsBake } from './buildings.js';
import { UNRI_BOUNDARY } from '../../src/districts/unri/boundary.js';
import { createProjection } from '../../src/geo/projection.js';
import { WORLD_ORIGIN } from '../../src/config/constants.js';
```

dan cabang (nama variabel root/log mengikuti berkas M1; di sini `root`, `log`):

```js
async function stepBuildings({ root, log }) {
  const proj = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });
  return runBuildingsBake({ root, boundary: UNRI_BOUNDARY, project: (lat, lon) => proj.toWorld(lat, lon), log });
}
```

Panggil `stepBuildings` untuk argumen `buildings`, dan untuk `all` **setelah** `ground` (front membaca `ground/*.json`). `--offline` tidak berpengaruh (langkah ini hanya membaca cache).

- [ ] **Step 9: Bake nyata**

Run: `npm run bake:campus -- buildings --offline`
Expected (log): `buildings: ±216 gedung (8 tersirat, 1 relation), ±33 klaster, ≤ 10 tanpa front, ±55000 byte` — angka bisa bergeser ± beberapa gedung karena `UNRI_BOUNDARY` (poligon kampus dikurangi mask stadion + 40 m, simplifikasi 5 m) berbeda dari poligon mentah yang dipakai analisis. Bila `ground/*.json` belum ada, log memperingatkan dan memakai highway OSM.

- [ ] **Step 10: Verifikasi isi**

```bash
node --input-type=module -e "import { readFileSync } from 'node:fs'; import { validateBuildingsData } from './src/districts/unri/buildingsFormat.js'; import { resolveBuilding } from './src/districts/unri/resolveBuilding.js'; import { BUILDING_OVERRIDES } from './src/districts/unri/buildings.data.js'; const d = JSON.parse(readFileSync('public/districts/unri/buildings.json','utf8')); console.log('galat', validateBuildingsData(d).length); const c = {}; for (const b of d.buildings) { const a = resolveBuilding(b, BUILDING_OVERRIDES[b.id]).archetype; c[a] = (c[a] ?? 0) + 1; } console.log(JSON.stringify(c)); console.log('override hilang', Object.keys(BUILDING_OVERRIDES).filter((id) => !d.buildings.some((b) => b.id === id)));"
```
Expected: `galat 0`; hitungan ≈ tabel "Distribusi arketipe" kolom akhir (sebelum cadangan geometri: K01 ±115, K04 ±28, K11 ±39, …, 6 hero); `override hilang []` (bila ada id hilang karena batas distrik, catat di commit — jangan hapus entri bersumber).

- [ ] **Step 11: Bake ulang tile kota (Serah terima M2 butir 1)**

Run: `npm run bake -- --area all --offline`
Expected: bake sukses; gedung kampus di tile kota dibuang lewat id `buildings.json` (`resolveDistricts`). `node node_modules/vitest/vitest.mjs run tests/osmFacts.test.js` tetap PASS (bila fakta berubah karena eksklusi, perbarui angka dengan sengaja dan sebutkan di pesan commit).

- [ ] **Step 12: Commit**

```bash
git add src/districts/unri/buildingsFormat.js tools/campusbake/buildings.js tools/campusbake/index.js tests/campusbake/buildings.test.js tests/campusbake/fixtures/osm-buildings-mini.json tests/campusbake/fixtures/ground/0_0.json public/districts/unri/buildings.json public/tiles
```
```bash
git commit -m "feat(campusbake): bake buildings.json gedung kampus (tersirat, dedupe, arah jalan dari ground)"
```

---

## Task 14: Footprint, collider gedung, klaster (TDD)

**Files:**
- Test: `tests/districts/buildingClusters.test.js`, `tests/districts/buildingFootprints.test.js`
- Create: `src/districts/unri/buildingFootprints.js`, `src/districts/unri/buildingClusters.js`
- Modify: `src/districts/unri/collider.js` (M2)

- [ ] **Step 1: Tulis tes footprint + collider**

`tests/districts/buildingFootprints.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { drawFootprints, footprintsOf } from '../../src/districts/unri/buildingFootprints.js';
import { validateBuildingsData, clusterKey } from '../../src/districts/unri/buildingsFormat.js';
import { chunkKeysFor, makeTerrainReady } from '../../src/districts/unri/buildings.js';
import { createUnriCollider } from '../../src/districts/unri/collider.js';

const A = { id: 'w1', ring: [[0, 0], [40, 0], [40, 12], [0, 12]] };
const B = { id: 'r2', ring: [[100, 100], [140, 100], [140, 140], [100, 140]], holes: [[[112, 112], [128, 112], [128, 128], [112, 128]]] };

describe('footprint gedung', () => {
  it('footprintsOf → [{ring, holes}]', () => {
    expect(footprintsOf([A, B])).toEqual([{ ring: A.ring, holes: [] }, { ring: B.ring, holes: B.holes }]);
  });
  it('drawFootprints memanggil path per gedung', () => {
    const calls = [];
    const ctx = new Proxy({}, { get: (_, k) => (typeof k === 'string' && ['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke'].includes(k) ? () => calls.push(k) : undefined), set: () => true });
    drawFootprints(ctx, [A], (x) => x, (z) => z);
    expect(calls.filter((c) => c === 'fill')).toHaveLength(1);
    expect(calls.filter((c) => c === 'lineTo')).toHaveLength(3);
  });
});

describe('collider distrik: addBuildings/removeBuildings (M3 atas createUnriCollider M2)', () => {
  const flat = { normalAt: () => ({ x: 0, y: 1, z: 0 }) };
  it('di dalam footprint & dalam jarak bebas 0,4 m tidak walkable; halaman dalam & luar walkable; kamera terhalang', () => {
    const c = createUnriCollider({ terrain: flat });
    c.addBuildings('0_0', footprintsOf([A, B]));
    expect(c.isWalkable(20, 6)).toBe(false);
    expect(c.penetration(20, 6)).toBeCloseTo(6 + 0.4, 6);
    expect(c.isWalkable(20, -0.2)).toBe(false);
    expect(c.isWalkable(20, -1)).toBe(true);
    expect(c.isWalkable(120, 120)).toBe(true);
    expect(c.isCameraClear(20, 6)).toBe(false);
    expect(c.isCameraClear(20, -1)).toBe(true);
    expect(c.stats().buildingClusters).toBe(1);
  });
  it('removeBuildings membuka kembali; addBuildings ulang mengganti; chunk ground tidak terpengaruh', () => {
    const c = createUnriCollider({ terrain: flat });
    c.addChunk('0_0', { circles: [{ x: 60, z: 60, r: 0.2 }] });
    c.addBuildings('0_0', footprintsOf([A]));
    c.addBuildings('0_0', footprintsOf([B]));
    expect(c.isWalkable(20, 6)).toBe(true);
    expect(c.isWalkable(105, 105)).toBe(false);
    expect(c.removeBuildings('0_0')).toBe(true);
    expect(c.isWalkable(105, 105)).toBe(true);
    expect(c.isWalkable(60, 60)).toBe(false);
  });
});

describe('buildingsFormat', () => {
  const ok = { v: 1, buildings: [{ id: 'w1', ring: A.ring, levels: 1, tags: {}, cluster: '0_0', area: 480, front: [0, 1] }] };
  it('valid', () => expect(validateBuildingsData(ok)).toEqual([]));
  it('menangkap versi, id, ring, cluster, ganda', () => {
    expect(validateBuildingsData({ v: 2, buildings: [] })[0]).toMatch(/versi/);
    const bad = { v: 1, buildings: [{ ...ok.buildings[0], id: 'x' }, { ...ok.buildings[0], ring: [[0, 0]] }, { ...ok.buildings[0], cluster: 'a' }, ok.buildings[0], ok.buildings[0]] };
    const errs = validateBuildingsData(bad);
    expect(errs.some((e) => /id harus/.test(e))).toBe(true);
    expect(errs.some((e) => /ring/.test(e))).toBe(true);
    expect(errs.some((e) => /cluster/.test(e))).toBe(true);
    expect(errs.some((e) => /ganda/.test(e))).toBe(true);
  });
  it('clusterKey lantai', () => expect(clusterKey(-1, 251)).toBe('-1_1'));
});

describe('kesiapan terrain', () => {
  it('chunkKeysFor klaster 250 m → chunk 500 m', () => {
    expect(chunkKeysFor({ minX: -1250, minZ: 1000, maxX: -1000, maxZ: 1250 })).toEqual(['-3_2']);
    expect(chunkKeysFor({ minX: 250, minZ: 0, maxX: 750, maxZ: 250 })).toEqual(['0_0', '1_0']);
  });
  it('makeTerrainReady: chunk manifest harus dimuat; chunk di luar manifest diabaikan (y = 0)', () => {
    const loaded = new Set();
    const ready = makeTerrainReady({ has: (k) => loaded.has(k) }, ['-3_2']);
    const b = { minX: -1250, minZ: 1000, maxX: -1000, maxZ: 1250 };
    expect(ready(b)).toBe(false);
    loaded.add('-3_2');
    expect(ready(b)).toBe(true);
    expect(ready({ minX: 5000, minZ: 5000, maxX: 5250, maxZ: 5250 })).toBe(true);
  });
});
```

(Berkas ini mengimpor `src/districts/unri/buildings.js` di tingkat modul, jadi baru bisa dijalankan setelah Task 15 Step 1; di Task 14 yang dijalankan hanya `buildingClusters.test.js`.)

- [ ] **Step 2: Tulis tes klaster**

`tests/districts/buildingClusters.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import {
  CLUSTER, clusterBounds, clusterKeyOf, createBuildingClusters, desiredLod, groupByCluster, planEntry, rectDistance,
} from '../../src/districts/unri/buildingClusters.js';
import { createKitMaterials } from '../../src/world/kit/kitMaterials.js';
import { createResourceScope } from '../../src/engine/ResourceScope.js';
import { appendPlanSteps } from '../../src/world/kit/buildBuilding.js';

/** Scheduler palsu: menyimpan tugas generator; run() menjalankan semua sampai habis. */
function fakeScheduler() {
  const tasks = [];
  return {
    tasks,
    schedule(fn, { owner }) {
      const t = { it: fn(), owner, cancelled: false, done: false, steps: 0 };
      tasks.push(t);
      return { cancel() { t.cancelled = true; } };
    },
    run() {
      for (const t of tasks) {
        while (!t.done && !t.cancelled) {
          t.steps += 1;
          if (t.it.next().done) t.done = true;
        }
      }
      tasks.length = 0;
    },
    /** Jalankan n langkah tugas pertama yang belum selesai (uji pembatalan di tengah). */
    step(n) {
      const t = tasks.find((x) => !x.done && !x.cancelled);
      for (let i = 0; i < n && t && !t.done; i += 1) if (t.it.next().done) t.done = true;
    },
  };
}

const rect = (cx, cz, w = 30, d = 12) => [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];
const b = (id, cx, cz, tags = { name: 'Gedung A' }) => ({ id, ring: rect(cx, cz), levels: 1, tags, cluster: clusterKeyOf(cx, cz), area: 360, front: [0, 1] });
const BUILDINGS = [b('w1', 100, 100), b('w2', 140, 160), b('w3', 400, 100), b('w4', 1600, 100)];
const quiet = { warn: () => {}, error: () => {} };

function setup(over = {}) {
  const scheduler = fakeScheduler();
  const materials = createKitMaterials(createResourceScope('uji'));
  const registries = { registerEmissive: vi.fn(() => vi.fn()) };
  const collider = { addBuildings: vi.fn(), removeBuildings: vi.fn(() => true) };
  const clusters = createBuildingClusters({
    buildings: BUILDINGS, materials, scheduler, groundY: () => 0, registries, collider, logger: quiet, signAtlas: () => null, ...over,
  });
  return { scheduler, clusters, registries, collider, materials };
}

describe('fungsi murni klaster', () => {
  it('kunci & batas klaster 250 m (lantai untuk negatif)', () => {
    expect(clusterKeyOf(100, 100)).toBe('0_0');
    expect(clusterKeyOf(-0.1, 250)).toBe('-1_1');
    expect(clusterBounds('-5_4')).toEqual({ minX: -1250, minZ: 1000, maxX: -1000, maxZ: 1250 });
    expect(rectDistance(0, 0, clusterBounds('1_0'))).toBe(250);
    expect(rectDistance(100, 100, clusterBounds('0_0'))).toBe(0);
  });

  it('groupByCluster urut kunci', () => {
    expect([...groupByCluster(BUILDINGS).keys()]).toEqual(['0_0', '1_0', '6_0']);
  });

  it('desiredLod dengan histeresis 30 m', () => {
    expect(desiredLod(0, null)).toBe(0);
    expect(desiredLod(250, null)).toBe(0);
    expect(desiredLod(260, null)).toBe(1);
    expect(desiredLod(270, 0)).toBe(0); // masih dalam lod0 + h
    expect(desiredLod(281, 0)).toBe(1);
    expect(desiredLod(900, null)).toBe(1);
    expect(desiredLod(910, null)).toBeNull();
    expect(desiredLod(920, 1)).toBe(1); // ≤ lod1 + h
    expect(desiredLod(931, 1)).toBeNull();
    expect(CLUSTER.size).toBe(250);
  });

  it('planEntry: gagal plan → cadangan K12, gagal lagi → null', () => {
    const ok = planEntry(b('w9', 0, 0), {}, () => 0, quiet);
    expect(ok.plan.kit).toBe('K01');
    expect(planEntry({ id: 'w8', ring: [[0, 0], [0.1, 0], [0, 0.1]], tags: {}, levels: null }, {}, () => 0, quiet)).toBeNull();
  });
});

describe('createBuildingClusters', () => {
  it('fokus (100,100): 0_0 (jarak 0) & 1_0 (jarak 150) LOD0, 6_0 (jarak 1400) tidak dirakit', () => {
    const { scheduler, clusters, registries, collider } = setup({ config: { ...CLUSTER, maxJobs: 9 } });
    clusters.update({ x: 100, z: 100 });
    expect(scheduler.tasks.map((t) => t.owner)).toEqual(['unri:gedung:0_0', 'unri:gedung:1_0']);
    scheduler.run();
    const snap = Object.fromEntries(clusters.snapshot().map((s) => [s.key, s.lod]));
    expect(snap).toEqual({ '0_0': 0, '1_0': 0, '6_0': null });
    const s = clusters.stats();
    expect(s.lod0).toBe(2);
    expect(s.meshes).toBeLessThanOrEqual(2 * 3); // ≤ 3 mesh (opak/potong/papan) per klaster
    expect(s.triangles).toBeGreaterThan(0);
    expect(registries.registerEmissive).toHaveBeenCalledTimes(2);
    expect(clusters.group.name).toBe('unri:gedung');
    expect(clusters.group.children.map((g) => g.name).sort()).toEqual(['unri:gedung:0_0:lod0', 'unri:gedung:1_0:lod0']);
    expect(collider.addBuildings).toHaveBeenCalledWith('0_0', [{ ring: BUILDINGS[0].ring, holes: [] }, { ring: BUILDINGS[1].ring, holes: [] }]);
  });

  it('maxJobs = 1: klaster terdekat dulu, satu per satu', () => {
    const { scheduler, clusters } = setup();
    clusters.update({ x: 600, z: 100 });
    expect(scheduler.tasks.map((t) => t.owner)).toEqual(['unri:gedung:1_0']);
    scheduler.run();
    clusters.update({ x: 600, z: 100 });
    expect(scheduler.tasks.map((t) => t.owner)).toEqual(['unri:gedung:0_0']);
  });

  it('tukar LOD: LOD lama tetap tampil sampai LOD baru selesai (tanpa lubang)', () => {
    const { scheduler, clusters } = setup({ config: { ...CLUSTER, maxJobs: 9 } });
    clusters.update({ x: 1100, z: 100 }); // 0_0 jarak 850 → LOD1; 1_0 jarak 600 → LOD1
    scheduler.run();
    expect(clusters.snapshot().find((s) => s.key === '0_0').lod).toBe(1);
    clusters.update({ x: 100, z: 100 });
    expect(clusters.snapshot().find((s) => s.key === '0_0')).toMatchObject({ lod: 1, job: 0 });
    expect(clusters.group.children.map((g) => g.name).sort()).toEqual(['unri:gedung:0_0:lod1', 'unri:gedung:1_0:lod1']);
    scheduler.run();
    expect(clusters.snapshot().find((s) => s.key === '0_0')).toMatchObject({ lod: 0, job: null });
    expect(clusters.group.children.some((g) => g.name === 'unri:gedung:0_0:lod0')).toBe(true);
  });

  it('menjauh > lod1 + h: tugas berjalan dibatalkan, klaster tampil dilepas (geometri dispose)', () => {
    const { scheduler, clusters, collider } = setup();
    clusters.update({ x: 100, z: 100 });
    scheduler.run();
    const geo = clusters.group.children[0].children[0].geometry;
    const spy = vi.spyOn(geo, 'dispose');
    clusters.update({ x: 5000, z: 5000 });
    expect(spy).toHaveBeenCalled();
    expect(collider.removeBuildings).toHaveBeenCalledWith('0_0');
    expect(clusters.group.children).toHaveLength(0);
    clusters.update({ x: 100, z: 100 });
    scheduler.step(1);
    clusters.update({ x: 5000, z: 5000 });
    expect(scheduler.tasks[0].cancelled).toBe(true);
    expect(clusters.stats().jobs).toBe(0);
  });

  it('terrainReady false menunda perakitan', () => {
    let ready = false;
    const { scheduler, clusters } = setup({ terrainReady: () => ready });
    clusters.update({ x: 100, z: 100 });
    expect(scheduler.tasks).toHaveLength(0);
    ready = true;
    clusters.update({ x: 100, z: 100 });
    expect(scheduler.tasks).toHaveLength(1);
  });

  it('setSuppressed: klaster terkait dirakit ulang tanpa gedung itu; settled()', () => {
    const { scheduler, clusters } = setup();
    clusters.update({ x: 100, z: 100 });
    scheduler.run();
    const before = clusters.stats().triangles;
    expect(clusters.settled(100, 100, 10)).toBe(true);
    clusters.setSuppressed(['w1']);
    expect(clusters.settled(100, 100, 10)).toBe(false);
    clusters.update({ x: 100, z: 100 });
    scheduler.run();
    expect(clusters.stats().triangles).toBeLessThan(before);
    expect(clusters.settled(100, 100, 10)).toBe(true);
  });

  it('gedung yang gagal dirakit jatuh ke K12 (geometri parsial dibuang), klaster tetap tampil', () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    function* appendSteps(sink, plan, mats, opts) {
      if (plan.id === 'w1') {
        sink.opak.quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], { u0: 0, v0: 0, u1: 1, v1: 1 }); // sampah parsial
        throw new Error('rusak');
      }
      yield* appendPlanSteps(sink, plan, mats, opts);
    }
    const { scheduler, clusters } = setup({ logger, appendSteps });
    clusters.update({ x: 100, z: 100 });
    scheduler.run();
    expect(clusters.stats().lod0).toBeGreaterThanOrEqual(1);
    expect(logger.error.mock.calls.some(([m]) => /w1: perakitan gagal, jatuh ke K12/.test(m))).toBe(true);
    const pos = clusters.group.children.find((g) => g.name === 'unri:gedung:0_0:lod0').children[0].geometry.attributes.position;
    let hasJunk = false;
    for (let i = 0; i < pos.count; i += 1) if (pos.getX(i) === 0 && pos.getY(i) === 1 && pos.getZ(i) === 0) hasJunk = true;
    expect(hasJunk).toBe(false);
  });

  it('dispose: semua klaster dilepas, group dicabut, tugas dibatalkan', () => {
    const { scheduler, clusters } = setup();
    clusters.update({ x: 100, z: 100 });
    scheduler.run();
    clusters.update({ x: 1300, z: 100 });
    const pending = scheduler.tasks[0];
    clusters.dispose();
    expect(pending.cancelled).toBe(true);
    expect(clusters.group.children).toHaveLength(0);
    expect(clusters.stats()).toMatchObject({ lod0: 0, lod1: 0, jobs: 0 });
  });
});
```

- [ ] **Step 3: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/buildingClusters.test.js`
Expected: FAIL — modul `buildingClusters.js` belum ada.

- [ ] **Step 4: `buildingFootprints.js`**

`src/districts/unri/buildingFootprints.js`:
```js
/**
 * Footprint gedung distrik: data collider per klaster (dikirim ke `createUnriCollider().addBuildings`, M2) dan
 * gambar minimap (warna sama dengan gedung tile kota). Murni kecuali drawFootprints (ctx canvas 2D).
 */

/** Footprint collider [{ring, holes}] dari entri buildings.json (salinan dangkal ring, urutan tetap). */
export function footprintsOf(buildings) {
  return buildings.map((b) => ({ ring: b.ring, holes: b.holes ?? [] }));
}

/**
 * Gambar footprint ke canvas minimap distrik.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{ring:Array<[number,number]>}>} buildings
 * @param {(x:number) => number} tx dunia x → piksel
 * @param {(z:number) => number} tz dunia z → piksel
 */
export function drawFootprints(ctx, buildings, tx, tz, { fill = '#a89f92', stroke = '#8c8377' } = {}) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 0.8;
  for (const b of buildings) {
    ctx.beginPath();
    b.ring.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(tx(x), tz(z)) : ctx.lineTo(tx(x), tz(z))));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
```

- [ ] **Step 5: Collider gedung di `src/districts/unri/collider.js` (Serah terima M2 butir 2)**

Lima suntingan pada `createUnriCollider` (aturan sama dengan `TileCollider`: footprint + jarak bebas `clearance` 0,4 m, kedalaman naik ke dalam; kamera tidak boleh di dalam gedung; `addChunk` tidak diubah):

(a) setelah `const chunks = new Map();`:
```js
  const buildings = new Map(); // M3: kunci klaster → rec footprint gedung
```

(b) tepat sebelum `const gradeAt = (x, z) => {`:
```js
  /** M3: kedalaman di zona gedung (footprint + jarak bebas), naik ke arah dalam — aturan TileCollider kota. */
  const buildingDepth = (x, z) => {
    let depth = 0;
    for (const s of at(x, z)) {
      if (s.kind !== 'building' || !inBox(s, x, z)) continue;
      if (s.holes.some((h) => pointInPolygon(x, z, h))) continue; // halaman dalam
      const d = distanceToRing(x, z, s.outer);
      depth = Math.max(depth, pointInPolygon(x, z, s.outer) ? d + clearance : Math.max(0, clearance - d));
    }
    return depth;
  };
  const insideBuilding = (x, z) => at(x, z).some((s) => s.kind === 'building' && inBox(s, x, z)
    && pointInPolygon(x, z, s.outer) && !s.holes.some((h) => pointInPolygon(x, z, h)));
```

(c) di `penetration`, ganti
```js
    const c = circleDepth(x, z);
    if (c > 0) return c;
```
dengan
```js
    const c = Math.max(circleDepth(x, z), buildingDepth(x, z));
    if (c > 0) return c;
```

(d) ganti seluruh `function removeChunk(key) { … }` dengan:
```js
  function removeFrom(map, key) {
    const rec = map.get(key);
    if (!rec) return false;
    for (const k of rec.cellKeys) {
      const list = cells.get(k).filter((s) => !rec.shapes.has(s));
      if (list.length) cells.set(k, list);
      else cells.delete(k);
    }
    map.delete(key);
    return true;
  }
  const removeChunk = (key) => removeFrom(chunks, key);
  /** M3: lepas footprint gedung satu klaster. */
  const removeBuildings = (key) => removeFrom(buildings, key);

  /** M3: daftarkan footprint gedung satu klaster [{ring, holes?}] (dunia); kunci sama mengganti. */
  function addBuildings(key, footprints = []) {
    removeBuildings(key);
    const rec = { cellKeys: new Set(), shapes: new Set() };
    for (const f of footprints) {
      insert(rec, { kind: 'building', outer: f.ring, holes: f.holes ?? [], bbox: bboxOf(f.ring, clearance) });
    }
    buildings.set(key, rec);
  }
```

(e) pada objek kembali: tambahkan `addBuildings,` dan `removeBuildings,` setelah `removeChunk,`; ganti `isCameraClear` menjadi
```js
    isCameraClear: (x, z) => Number.isFinite(x) && Number.isFinite(z) && !insideBuilding(x, z),
```
dan `stats` menjadi `stats: () => ({ chunks: chunks.size, cells: cells.size, buildingClusters: buildings.size }),`. Perbarui komentar kepala berkas: "M3: footprint gedung per klaster (`addBuildings/removeBuildings`)".

Run: `node node_modules/vitest/vitest.mjs run tests/districts/unriCollider.test.js`
Expected: tes collider M2 tetap PASS (tidak ada perilaku lama yang berubah).

- [ ] **Step 6: `buildingClusters.js`**

`src/districts/unri/buildingClusters.js`:
```js
/**
 * Klaster gedung kampus (spec §7.4): sel 250 m; LOD0 ≤ 250 m (penuh), LOD1 ≤ 900 m (massa + atap + atlas),
 * lebih jauh tidak dirender. Perakitan time-sliced lewat scheduler (M0): satu tugas generator per klaster,
 * `yield` per gedung & per sisi; geometri semua gedung klaster ditulis ke SATU sink (penggabungan per
 * material: opak + potong + papan = ≤ 3 mesh/klaster). Tukar LOD tanpa lubang (lama tampil sampai baru siap).
 * Gedung gagal dirakit → K12 (spec §10). Footprint klaster didaftarkan ke collider distrik (M2
 * `addBuildings/removeBuildings`) selama klaster tampil; emisif malam lewat `registries` distrik (M2).
 * Nama grup berawalan `unri:` agar terhitung skrip ukur M2. Bagian murni diekspor untuk tes.
 */
import { Group, Mesh } from 'three';
import { freezeStatic } from '../../engine/freezeStatic.js';
import { createKitSink } from '../../world/kit/kitBuilder.js';
import { appendPlanSteps, fallbackPlan } from '../../world/kit/buildBuilding.js';
import { appendBuilding } from '../../world/kit/kitAssemble.js';
import { planBuilding } from '../../world/kit/planBuilding.js';
import { appendSigns, collectSigns, createSignAtlas } from '../../world/kit/signs.js';
import { resolveBuilding } from './resolveBuilding.js';
import { footprintsOf } from './buildingFootprints.js';

export const CLUSTER = Object.freeze({
  size: 250, lod0: 250, lod1: 900, hysteresis: 30, maxJobs: 1, maxHeight: 40, owner: 'unri:gedung',
});

/** Kunci klaster "cx_cz" dari titik dunia. */
export function clusterKeyOf(x, z, size = CLUSTER.size) {
  return `${Math.floor(x / size)}_${Math.floor(z / size)}`;
}

/** Batas dunia klaster dari kunci. */
export function clusterBounds(key, size = CLUSTER.size) {
  const [cx, cz] = key.split('_').map(Number);
  return { minX: cx * size, minZ: cz * size, maxX: (cx + 1) * size, maxZ: (cz + 1) * size };
}

/** Jarak titik ke persegi (0 di dalam). */
export function rectDistance(x, z, b) {
  const dx = Math.max(b.minX - x, 0, x - b.maxX);
  const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
  return Math.hypot(dx, dz);
}

/** Kelompokkan gedung per `cluster` (buildings.json) → Map urut kunci. */
export function groupByCluster(buildings) {
  const map = new Map();
  for (const b of buildings) {
    if (!map.has(b.cluster)) map.set(b.cluster, []);
    map.get(b.cluster).push(b);
  }
  return new Map([...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * LOD yang diinginkan pada jarak `dist` bila LOD `current` sedang tampil (null = belum tampil):
 * masuk LOD0 di ≤ lod0, keluar di > lod0 + h; tampil di ≤ lod1, lepas di > lod1 + h.
 * @returns {0|1|null}
 */
export function desiredLod(dist, current, cfg = CLUSTER) {
  if (dist <= (current === 0 ? cfg.lod0 + cfg.hysteresis : cfg.lod0)) return 0;
  return dist <= (current === null ? cfg.lod1 : cfg.lod1 + cfg.hysteresis) ? 1 : null;
}

/** Plan satu gedung dari entri buildings.json (resolve + planBuilding); galat → K12; galat lagi → null. */
export function planEntry(b, overrides, groundY, logger = console) {
  const r = resolveBuilding(b, overrides[b.id], { logger });
  const input = { id: b.id, ring: b.ring, holes: b.holes ?? [], levels: r.levels, archetype: r.archetype, overrides: r, front: b.front ?? null, groundY };
  try {
    return { plan: planBuilding(input), input };
  } catch (err) {
    logger.error(`gedung ${b.id}: planBuilding gagal (${r.archetype}), jatuh ke K12:`, err);
    try {
      return { plan: planBuilding({ ...input, archetype: 'K12' }), input };
    } catch (err2) {
      logger.error(`gedung ${b.id}: K12 juga gagal, dilewati:`, err2);
      return null;
    }
  }
}

/** Perkiraan verteks per kunci material untuk kapasitas awal sink. */
function estimateCapacity(plans, lod) {
  const bays = plans.reduce((s, p) => s + p.bays.length * p.floors, 0);
  return lod === 0 ? { opak: bays * 260 + 4096, potong: bays * 40 + 1024, papan: 256 } : { opak: bays * 30 + 2048, potong: 64, papan: 64 };
}

/**
 * @param {{buildings: object[], overrides?: Record<string, object>, materials: {opak:object, potong:object},
 *   scheduler: {schedule(task: Function, o: {owner: string}): {cancel(): void}}, groundY: (x:number, z:number) => number,
 *   terrainReady?: (bounds: object) => boolean, registries?: {registerEmissive(root: object): () => boolean}|null,
 *   collider?: {addBuildings(key: string, f: object[]): void, removeBuildings(key: string): boolean}|null,
 *   signAtlas?: typeof createSignAtlas, appendSteps?: typeof appendPlanSteps, logger?: Console, config?: typeof CLUSTER}} opts
 *   appendSteps dapat disuntik tes (mis. untuk memaksa galat perakitan).
 */
export function createBuildingClusters({
  buildings, overrides = {}, materials, scheduler, groundY, terrainReady = () => true, registries = null, collider = null,
  signAtlas = createSignAtlas, appendSteps = appendPlanSteps, logger = console, config = CLUSTER,
}) {
  const group = new Group();
  group.name = 'unri:gedung';
  const clusters = [...groupByCluster(buildings)].map(([key, list]) => ({
    key, list, bounds: clusterBounds(key, config.size), dist: Infinity, shown: null, job: null, dirty: false,
  }));
  const plans = new Map(); // id → {plan, input}|null (tidak bergantung LOD)
  let suppressed = new Set();
  let disposed = false;

  const sphereOf = (c) => {
    const half = config.size / 2;
    return { center: [c.bounds.minX + half, 0, c.bounds.minZ + half], radius: Math.hypot(half, half, config.maxHeight) + 60 };
  };

  const release = (shown, c) => {
    if (!shown) return;
    if (c) collider?.removeBuildings(c.key);
    shown.offEmissive?.();
    shown.root.removeFromParent();
    for (const m of shown.root.children) m.geometry.dispose();
    shown.signs?.dispose();
  };

  /** Generator tugas scheduler: rencana → sink → papan → mesh → pasang (menggantikan LOD lama). */
  function* job(c, j) {
    const list = c.list.filter((b) => !suppressed.has(b.id));
    const ready = [];
    for (const b of list) {
      if (!plans.has(b.id)) plans.set(b.id, planEntry(b, overrides, groundY, logger));
      if (plans.get(b.id)) ready.push(plans.get(b.id));
      yield;
      if (j.cancelled) return;
    }
    const sink = createKitSink({ capacity: estimateCapacity(ready.map((e) => e.plan), j.lod) });
    for (const entry of ready) {
      const mark = sink.mark();
      try {
        yield* appendSteps(sink, entry.plan, materials, { lod: j.lod });
      } catch (err) {
        sink.rewind(mark);
        logger.error(`gedung ${entry.plan.id}: perakitan gagal, jatuh ke K12:`, err);
        try {
          appendBuilding(sink, fallbackPlan(entry.plan, entry.input), { lod: j.lod });
        } catch (err2) {
          sink.rewind(mark);
          logger.error(`gedung ${entry.plan.id}: K12 juga gagal, dilewati:`, err2);
        }
      }
      if (j.cancelled) return;
      yield;
    }
    const signs = j.lod === 0 ? collectSigns(ready.map((e) => e.plan)) : [];
    const atlas = signs.length ? signAtlas(signs.map((s) => s.sign)) : null;
    if (atlas) appendSigns(sink, signs, atlas);
    yield;
    if (j.cancelled) {
      atlas?.dispose();
      return;
    }
    const parts = sink.toParts({ ...materials, papan: atlas?.material ?? null }, `gedung:${c.key}`, { copy: false, sphere: sphereOf(c) });
    const root = new Group();
    root.name = `unri:gedung:${c.key}:lod${j.lod}`;
    for (const p of parts) {
      const mesh = new Mesh(p.geometry, p.material);
      mesh.name = p.name;
      mesh.castShadow = p.castShadow && j.lod === 0;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    group.add(root);
    freezeStatic(root);
    const offEmissive = registries ? registries.registerEmissive(root) : null;
    release(c.shown, null);
    collider?.addBuildings(c.key, footprintsOf(list));
    c.shown = { lod: j.lod, root, signs: atlas, offEmissive, triangles: sink.triangles, meshes: parts.length };
    c.job = null;
  }

  const start = (c, lod) => {
    const j = { lod, cancelled: false, handle: null };
    c.job = j;
    c.dirty = false;
    j.handle = scheduler.schedule(function* clusterTask() { yield* job(c, j); }, { owner: `${config.owner}:${c.key}` });
  };

  const cancel = (c) => {
    if (!c.job) return;
    c.job.cancelled = true;
    c.job.handle?.cancel();
    c.job = null;
  };

  return {
    group,
    /** Tiap frame: pilih LOD per klaster, batalkan/lepaskan yang menjauh, mulai tugas terdekat (≤ maxJobs). */
    update(focus) {
      if (disposed || !focus || !Number.isFinite(focus.x) || !Number.isFinite(focus.z)) return;
      const wanted = [];
      for (const c of clusters) {
        c.dist = rectDistance(focus.x, focus.z, c.bounds);
        const want = desiredLod(c.dist, c.shown?.lod ?? c.job?.lod ?? null, config);
        if (want === null) {
          cancel(c);
          release(c.shown, c);
          c.shown = null;
          continue;
        }
        if (c.job && c.job.lod !== want) cancel(c);
        if (!c.job && (c.shown?.lod !== want || c.dirty)) wanted.push({ c, want });
      }
      let running = clusters.filter((c) => c.job).length;
      wanted.sort((a, b) => a.c.dist - b.c.dist || (a.c.key < b.c.key ? -1 : 1));
      for (const { c, want } of wanted) {
        if (running >= config.maxJobs) break;
        if (!terrainReady(c.bounds)) continue;
        start(c, want);
        running += 1;
      }
    },
    /** Gedung yang dimiliki region hero aktif (M4/M6) tidak dirakit distrik; klaster terkait dirakit ulang. */
    setSuppressed(ids) {
      const next = new Set(ids);
      for (const c of clusters) {
        if (c.list.some((b) => next.has(b.id) !== suppressed.has(b.id))) c.dirty = true;
      }
      suppressed = next;
    },
    /** Semua klaster dalam radius r dari (x,z) tampil pada LOD yang diinginkan (tanpa tugas tertunda). */
    settled(x, z, r = config.lod0) {
      return clusters.every((c) => {
        const d = rectDistance(x, z, c.bounds);
        if (d > r) return true;
        const want = desiredLod(d, c.shown?.lod ?? null, config);
        return !c.job && !c.dirty && (c.shown?.lod ?? null) === want;
      });
    },
    stats() {
      const s = { clusters: clusters.length, lod0: 0, lod1: 0, jobs: 0, meshes: 0, triangles: 0 };
      for (const c of clusters) {
        if (c.job) s.jobs += 1;
        if (!c.shown) continue;
        s[c.shown.lod === 0 ? 'lod0' : 'lod1'] += 1;
        s.meshes += c.shown.meshes;
        s.triangles += c.shown.triangles;
      }
      return s;
    },
    /** Status per klaster (debug/E2E). */
    snapshot: () => clusters.map((c) => ({ key: c.key, buildings: c.list.length, lod: c.shown?.lod ?? null, job: c.job?.lod ?? null })),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const c of clusters) {
        cancel(c);
        release(c.shown, c);
        c.shown = null;
      }
      group.removeFromParent();
      plans.clear();
    },
  };
}
```

- [ ] **Step 7: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/buildingClusters.test.js tests/districts/unriCollider.test.js`
Expected: 12 tes klaster PASS + tes collider M2 PASS. (`buildingFootprints.test.js` — footprint, `addBuildings/removeBuildings`, format, kesiapan terrain, 9 tes — dijalankan di Task 15 Step 1.)

- [ ] **Step 8: Commit**

```bash
git add src/districts/unri/buildingFootprints.js src/districts/unri/buildingClusters.js src/districts/unri/collider.js tests/districts/buildingClusters.test.js tests/districts/buildingFootprints.test.js
```
```bash
git commit -m "feat(unri): klaster gedung ber-LOD time-sliced (sink per klaster, cadangan K12) dan collider footprint"
```

---

## Task 15: Pasang gedung di distrik

**Files:**
- Create: `src/districts/unri/buildings.js`
- Modify: `src/districts/unri/index.js`

- [ ] **Step 1: `buildings.js`**

`src/districts/unri/buildings.js`:
```js
/**
 * Gedung distrik UNRI (M3): muat & validasi buildings.json → material kit (scope distrik) → klaster ber-LOD
 * (time-sliced, owner scheduler `unri:gedung:<klaster>`) → sistem `unri.gedung` (fase world). Footprint masuk
 * collider distrik M2 per klaster; emisif malam lewat `ctx.registries` (M2). Galat muat/format → distrik tetap
 * jalan tanpa gedung (console.error + toast sekali bila tersedia). DEV: `globalThis.__unriGedung` untuk ukur.
 */
import { createKitMaterials } from '../../world/kit/kitMaterials.js';
import { BUILDING_OVERRIDES } from './buildings.data.js';
import { createBuildingClusters, CLUSTER } from './buildingClusters.js';
import { drawFootprints } from './buildingFootprints.js';
import { validateBuildingsData } from './buildingsFormat.js';
import { validateOverrides } from './resolveBuilding.js';

const TERRAIN_CHUNK = 500;

/** Kunci chunk terrain 500 m yang beririsan dengan bounds. */
export function chunkKeysFor(b, size = TERRAIN_CHUNK) {
  const out = [];
  for (let ix = Math.floor(b.minX / size); ix <= Math.floor((b.maxX - 1e-6) / size); ix += 1) {
    for (let iz = Math.floor(b.minZ / size); iz <= Math.floor((b.maxZ - 1e-6) / size); iz += 1) out.push(`${ix}_${iz}`);
  }
  return out;
}

/** Klaster siap dirakit bila semua chunk terrain manifest yang menutupinya sudah dimuat (field.has). */
export function makeTerrainReady(field, manifestChunks) {
  const known = new Set(manifestChunks ?? []);
  return (bounds) => chunkKeysFor(bounds).every((k) => !known.has(k) || field.has(k));
}

async function defaultFetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {{url: string, scope: object, terrain: {heightAt(x:number,z:number):number, has(k:string):boolean},
 *   terrainChunks?: string[], scheduler: {schedule: Function}, registries?: object|null,
 *   collider?: {addBuildings: Function, removeBuildings: Function}|null, fetchJson?: (u:string) => Promise<object>,
 *   anisotropy?: number, toast?: (t:string, ok:boolean) => void, logger?: Console, overrides?: object, dev?: boolean}} ctx
 */
export async function mountBuildings(ctx) {
  const logger = ctx.logger ?? console;
  const overrides = ctx.overrides ?? BUILDING_OVERRIDES;
  const overrideErrors = validateOverrides(overrides);
  if (overrideErrors.length) logger.warn('buildings.data.js tidak valid (entri salah memakai aturan default):', overrideErrors);
  let data;
  try {
    data = await (ctx.fetchJson ?? defaultFetchJson)(ctx.url);
    const errs = validateBuildingsData(data);
    if (errs.length) throw new Error(`buildings.json tidak valid: ${errs.slice(0, 5).join('; ')}`);
  } catch (err) {
    logger.error('Gedung kampus gagal dimuat; distrik tanpa gedung:', err);
    ctx.toast?.('Gedung kampus gagal dimuat', false);
    return null;
  }
  const materials = createKitMaterials(ctx.scope, { anisotropy: ctx.anisotropy ?? 8 });
  const clusters = createBuildingClusters({
    buildings: data.buildings, overrides, materials, scheduler: ctx.scheduler,
    groundY: (x, z) => ctx.terrain.heightAt(x, z),
    terrainReady: makeTerrainReady(ctx.terrain, ctx.terrainChunks),
    registries: ctx.registries ?? null, collider: ctx.collider ?? null, logger,
  });
  let suppressed = new Set();
  const system = {
    id: 'unri.gedung',
    phase: 'world',
    update(dt, frame) {
      clusters.update(frame?.focus ?? frame?.bikePos ?? null);
    },
    dispose() {},
  };
  const api = {
    data,
    group: clusters.group,
    system,
    excludeIds: new Set(data.buildings.map((b) => b.id)),
    drawMinimap: (ctx2d, tx, tz) => drawFootprints(ctx2d, data.buildings.filter((b) => !suppressed.has(b.id)), tx, tz),
    /** Gedung yang diambil alih region (opsional; region-owned hero cukup lewat HERO_BUILDERS kosong). */
    setSuppressed(ids) {
      suppressed = new Set(ids);
      clusters.setSuppressed(suppressed);
    },
    settled: (x, z, r = CLUSTER.lod0) => clusters.settled(x, z, r),
    whenSettled(x, z, r = CLUSTER.lod0, timeoutMs = 30000) {
      const t0 = Date.now();
      return new Promise((resolve) => {
        const tick = () => {
          if (clusters.settled(x, z, r)) resolve(true);
          else if (Date.now() - t0 > timeoutMs) resolve(false);
          else setTimeout(tick, 100);
        };
        tick();
      });
    },
    stats: () => clusters.stats(),
    snapshot: () => clusters.snapshot(),
    dispose() {
      clusters.dispose();
      ctx.scope.release('kit:materials');
      if (globalThis.__unriGedung === api) delete globalThis.__unriGedung;
    },
  };
  if (ctx.dev) globalThis.__unriGedung = api;
  return api;
}
```

Run: `node node_modules/vitest/vitest.mjs run tests/districts`
Expected: semua tes distrik PASS, termasuk `buildingFootprints.test.js` (9 tes: footprint, collider gedung, format, kesiapan terrain).

- [ ] **Step 2: Sambungkan ke `unriDistrict` (`src/districts/unri/index.js`)**

1. Impor:
```js
import { mountBuildings } from './buildings.js';
```
2. Di `build(ctx)`, **setelah** `collider` (M2) dibuat dan manifest dimuat:
```js
  const gedung = await mountBuildings({
    url: unriDistrict.manifestUrl.replace(/manifest\.json$/, manifest.buildings ?? 'buildings.json'),
    scope: ctx.scope,
    scheduler: ctx.scheduler,
    registries: ctx.registries,
    collider,
    terrain: ctx.terrain,
    terrainChunks: manifest.terrain?.chunks ?? [],
    anisotropy: ctx.renderer?.capabilities?.getMaxAnisotropy?.() ?? 8,
    toast: ctx.toast,
    dev: import.meta.env?.DEV === true,
  });
  if (gedung) group.add(gedung.group);
```
3. Nilai kembali `build`:
   - `systems`: tambahkan `...(gedung ? [gedung.system] : [])` setelah `ground.system`;
   - `excludeIds: gedung?.excludeIds ?? new Set()` (menggantikan `new Set()` M2);
   - `whenSettled: (x, z) => Promise.all([<whenSettled M1/M2 yang ada>(x, z), gedung ? gedung.whenSettled(x, z) : true]).then(() => undefined)`;
   - `minimapLayer(ctx2d, view)`: bila M1 menyediakan konversi dunia→piksel di `view` (mis. `view.tx/view.tz` atau matriks), panggil `gedung?.drawMinimap(ctx2d, tx, tz)` setelah lapisan lain; bila `minimapLayer` M1 masih kosong, lewati (Serah terima M2 butir 7 — minimap distrik diisi M7);
   - `dispose()`: panggil `gedung?.dispose()` **sebelum** `ground.dispose()`.
4. Jangan ubah `colliders` (tetap `collider` M2 — kini sudah memuat gedung lewat klaster).

- [ ] **Step 3: Tes, lint, build**

Run:
```bash
node node_modules/vitest/vitest.mjs run
npm run lint
npm run build
```
Expected: semua tes PASS; lint 0 galat; build sukses (galeri tidak ikut build).

- [ ] **Step 4: Smoke di dev server**

`preview_start` nama `stadion-dev` (atau Playwright ke `http://localhost:5173`). Konsol:
```js
__sim.teleport(-950, 1060, 0);
await __unriGedung.whenSettled(-950, 1060, 900);
__unriGedung.stats()
```
Expected: `{ clusters: ±33, lod0 ≥ 3, lod1 ≥ 10, jobs: 0, meshes ≤ 3 × (lod0+lod1), triangles ≤ 350000 }`; gedung FKIP/FISIP tampil berarketipe (selasar, roster, atap seng), tidak melayang/tenggelam di lereng (plint menutup), sepeda tidak menembus dinding (coba tabrak), konsol tanpa galat.

- [ ] **Step 5: Commit**

```bash
git add src/districts/unri/buildings.js src/districts/unri/index.js
```
```bash
git commit -m "feat(unri): pasang gedung kit di distrik (klaster, collider, excludeIds, emisif malam)"
```

---

## Task 16: Budget & visual di game

**Files:**
- Create: `tests/e2e/kitBudget.e2e.mjs`
- Output: `docs/screenshots/unri/m3-{jalan-stadion-kampus,sekre-luar,rektorat,masjid,fkip,ft}.jpg`

Batas M3 (spec §9 + Serah terima M2 butir 4): draw call gedung ≤ 70 di titik ukur (sisa budget distrik 180 − 110 M2), mesh ≤ 3 per klaster tampil, segitiga gedung ≤ 350k, hitch p95 < 50 ms (GPU d3d11). Acuan simulasi sandbox (216 gedung, fokus di titik): sekre-luar 3 klaster LOD0 + 17 LOD1 = 23 mesh / ±69k segitiga; rektorat 7 + 23 = 36 mesh / ±266k; masjid 5 + 18 = 28 / ±206k; fkip 8 + 20 = 35 / ±249k; jalan-stadion-kampus 4 + 10 = 17 / ±43k. Draw call nyata = mesh × (1 + pass bayangan untuk mesh `castShadow`).

- [ ] **Step 1: Tulis skrip**

`tests/e2e/kitBudget.e2e.mjs`:
```js
#!/usr/bin/env node
/**
 * Ukur budget kit gedung M3 di dalam game — TIDAK ikut `vitest run`.
 *   node tests/e2e/kitBudget.e2e.mjs [--gpu d3d11|swiftshader] [--out docs/screenshots/unri]
 * Vite (port 5176) + Chromium headless 1280×720 (playwright global, seperti smoke.e2e.mjs). Per titik ukur:
 * teleport, tunggu klaster tenang (`__unriGedung.whenSettled`, hook DEV dari src/districts/unri/buildings.js),
 * hitung draw call gedung = calls(semua) − calls(grup `unri:gedung` disembunyikan) pada frame yang sama,
 * segitiga & mesh dari stats klaster, hitch p95 selama perakitan, lalu screenshot m3-<titik>.jpg.
 * Exit 0 bila: mesh ≤ 3 per klaster tampil, draw call gedung ≤ 70, segitiga gedung ≤ 350k, hitch p95 < 50 ms
 * (hanya d3d11), tanpa galat konsol.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5176;
const LIMITS = Object.freeze({ meshesPerCluster: 3, calls: 70, triangles: 350000, hitchP95Ms: 50 });
const POINTS = Object.freeze([
  ['jalan-stadion-kampus', 0, 500, Math.PI], ['sekre-luar', -219, 1130, 0], ['rektorat', -979, 860, 0],
  ['masjid', -1009, 1383, 0], ['fkip', -900, 1100, 0], ['ft', -1420, 300, 0],
]);
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const { values: opts } = parseArgs({ options: { gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string', default: 'docs/screenshots/unri' } } });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch { /* kandidat berikutnya */ }
  }
  throw new Error('Paket playwright tidak ditemukan (npm i -g playwright, atau set PLAYWRIGHT_PATH)');
}

/** Dievaluasi di halaman: teleport, ukur hitch selama menunggu klaster, lalu draw call gedung. */
async function measureAt([name, x, z, yaw]) {
  const s = window.__sim;
  const g = window.__unriGedung;
  if (!s || !g) return { name, error: '__sim / __unriGedung tidak ada (mode DEV?)' };
  s.store.set('sky.advanceTime', false);
  s.store.set('sky.hour', 12);
  s.teleport(x, z, yaw);
  const deltas = [];
  let last = performance.now();
  let run = true;
  const loop = () => {
    const now = performance.now();
    deltas.push(now - last);
    last = now;
    if (run) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const settled = await g.whenSettled(x, z, 900, 45000);
  await new Promise((r) => setTimeout(r, 1500));
  run = false;
  deltas.sort((a, b) => a - b);
  const p95 = deltas[Math.floor(deltas.length * 0.95)] ?? 0;
  const info = s.app.renderer.info.render;
  s.app.renderFrame();
  const all = info.calls;
  const allTris = info.triangles;
  g.group.visible = false;
  s.app.renderFrame();
  const without = info.calls;
  const withoutTris = info.triangles;
  g.group.visible = true;
  const st = g.stats();
  return {
    name, settled, hitchP95Ms: Math.round(p95), maxFrameMs: Math.round(deltas[deltas.length - 1] ?? 0),
    calls: all - without, trianglesRendered: allTris - withoutTris, totalCalls: all, ...st,
    meshesPerCluster: st.lod0 + st.lod1 ? st.meshes / (st.lod0 + st.lod1) : 0,
  };
}

async function main() {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const outDir = join(ROOT, opts.out);
  mkdirSync(outDir, { recursive: true });
  const report = { gpu: opts.gpu, limits: LIMITS, points: [], errors: [], fail: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForFunction(() => window.__sim?.app && window.__unriGedung, null, { timeout: 240000 });
    for (const p of POINTS) {
      const r = await page.evaluate(measureAt, p);
      await page.screenshot({ path: join(outDir, `m3-${p[0]}.jpg`), type: 'jpeg', quality: 85 });
      report.points.push(r);
      process.stderr.write(`${p[0]}: ${JSON.stringify(r)}\n`);
      if (r.error) report.fail.push(`${p[0]}: ${r.error}`);
      if (r.meshesPerCluster > LIMITS.meshesPerCluster) report.fail.push(`${p[0]}: mesh/klaster ${r.meshesPerCluster}`);
      if (r.calls > LIMITS.calls) report.fail.push(`${p[0]}: draw call gedung ${r.calls}`);
      if (r.triangles > LIMITS.triangles) report.fail.push(`${p[0]}: segitiga gedung ${r.triangles}`);
      if (opts.gpu === 'd3d11' && r.hitchP95Ms >= LIMITS.hitchP95Ms) report.fail.push(`${p[0]}: hitch p95 ${r.hitchP95Ms} ms`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  if (report.errors.length) report.fail.push(`${report.errors.length} galat konsol`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.fail.length ? 1 : 0;
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Jalankan**

Run: `node tests/e2e/kitBudget.e2e.mjs --gpu d3d11 > budget-m3.json`
Expected: exit 0; tiap titik `settled: true`, `meshesPerCluster ≤ 3`, `calls ≤ 70`, `triangles ≤ 350000`, `hitchP95Ms < 50`; 6 screenshot `m3-*.jpg`. Salin ringkasan angka ke pesan commit; hapus `budget-m3.json`.

- [ ] **Step 3: Bila melampaui** (urutan, spec §9.3): (1) turunkan `CLUSTER.lod0` ke 200 m; (2) matikan `castShadow` mesh `potong` LOD0 (`buildingClusters.js`: `mesh.castShadow = p.castShadow && j.lod === 0 && p.material !== materials.potong`); (3) LOD1 tanpa `talang/soffit` sudah default — kurangi `lod1` ke 750 m. Ulangi Step 2.

- [ ] **Step 4: Jalankan ulang skrip ukur M2** (`tools/shots/unriM2.mjs`, Serah terima M2 butir 4) — grup `unri:gedung…` kini ikut terhitung; total distrik ≤ 180 draw call.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/kitBudget.e2e.mjs docs/screenshots/unri/m3-jalan-stadion-kampus.jpg docs/screenshots/unri/m3-sekre-luar.jpg docs/screenshots/unri/m3-rektorat.jpg docs/screenshots/unri/m3-masjid.jpg docs/screenshots/unri/m3-fkip.jpg docs/screenshots/unri/m3-ft.jpg
```
```bash
git commit -m "test(e2e): ukur budget kit gedung M3 di titik ukur + screenshot"
```

---

## Task 17: Gerbang akhir tonggak

**Files:**
- Modify: `docs/superpowers/plans/2026-10-17-unri-00-index.md` (Status tonggak)

- [ ] **Step 1: Semua gerbang**

```bash
npm test
npm run lint
npm run build
npm run e2e -- --gpu d3d11
```
Expected: semua tes PASS; lint 0; build sukses; smoke E2E lama lulus (stadion & kota tidak berubah perilaku; draw call tile kota turun karena gedung kampus dikecualikan).

- [ ] **Step 2: Status indeks**

Baris M3: `| M3 | selesai | <hash> | 216 gedung kit (K01 114 … K12 2, 6 hero placeholder); ≤3 mesh/klaster; budget <angka Task 16>; deviasi D1–D7 |`.

- [ ] **Step 3: Review tonggak** — minta satu review (agen `general-purpose`, sesuai memori user) atas diff `git diff main...HEAD -- src/world/kit src/districts/unri tools/campusbake` + galeri screenshot; perbaiki temuan CRITICAL/HIGH.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-10-17-unri-00-index.md
```
```bash
git commit -m "docs: status tonggak M3 kit gedung selesai"
```

---

## Self-review

- **Cakupan spec:** §4.6 (`ARCHETYPES`, `planBuilding`, `buildBuilding`, `createKitMaterials`) → Task 2/5/8/10; §4.7 (`resolveBuilding`, `validateOverrides`, aturan + lantai rentang) → Task 6 (+D1); §7.1 semua ciri wajib K01–K12 → Task 5/9 + checklist Task 12; hero 7 id → Task 10; §7.2 langkah 1–6 → Task 3–5; §7.3 atlas 2048² dengan seluruh sel yang disebut (nako bilah kaca, jalusi kayu, kaca biru, roster 5 pola, keramik, seng gelombang, layar oranye 3 motif, pintu kayu, pintu gulung, papan kosong) + mipmap & anisotropi → Task 8; §7.4 klaster 250 m, LOD0/LOD1, time-sliced ≤ 4 ms → Task 14 (+D3/D4); §9 budget → Task 11/16; §10 "kit gagal → K12", override tak valid → warn sekali, manifest/berkas gagal → distrik tanpa gedung → Task 6/10/14/15; §11 tes `planBuilding`, `resolveBuilding` + `validateOverrides` (tabel nyata lulus), golden bake → Task 5/6/13; N05 papan nama → Task 8.
- **Placeholder:** tidak ada "TODO/isi nanti"; satu-satunya bagian bersyarat adalah nama variabel internal `index.js`/CLI M1 (Task 0 Step 2 → Task 13/15), karena plan M1 tidak tersedia saat plan ini ditulis.
- **Konsistensi nama:** `planBuilding(input)`, `buildBuilding(plan, kitMaterials)` → PartList, `createKitMaterials(scope)`, `HERO_BUILDERS['hero:…'](plan, mats, ctx)`, `ATLAS_CELLS`, `createSignAtlas/appendSigns/collectSigns`, `resolveBuilding(osm, override)`, `validateOverrides(table)`, `BUILDING_OVERRIDES`, `createBuildingClusters`, `CLUSTER.lod0/lod1` (dipakai M7), `mountBuildings`, `addBuildings/removeBuildings`, nama grup `unri:gedung:*`, owner scheduler `unri:gedung:<cx_cz>`.
- **Validasi:** seluruh kode ditulis & dijalankan di sandbox salinan repo (Node 24, Vitest 5, three r186, ESLint config repo): 118 tes lulus, lint 0 galat; galeri dirender Chromium d3d11 dan diperiksa visual (18 screenshot); `kitBudget.e2e.mjs` dan suntingan `index.js`/CLI belum bisa dijalankan karena M1 belum ada.
- **Risiko tersisa:** K01 = 53 % gedung (variasi seed/hash menekan pengulangan, tetapi review visual Task 12/16 wajib); unggah GPU ±12 MB per klaster LOD0 besar saat pertama tampil (ukur hitch p95 Task 16); atlas 75–155 ms sekali saat distrik dibangun.

## Serah terima ke M4

API setelah M3 (signature persis):

```js
// src/world/kit/archetypes.js
export const ARCHETYPES /* beku K01..K12 */, ARCHETYPE_IDS, PALETTES, VARIANTS, ROOF_TYPES, CORRIDOR_SIDES, CONFIDENCE,
  HERO_IDS, HERO_STANDIN, ROSTER_PATTERNS;
export function hashId(id) -> uint32; export function geometryArchetype(id) -> archetype

// src/world/kit/planBuilding.js
export function planBuilding({ id, ring /*dunia*/, holes?, levels?, archetype, overrides?:{palette,roof,corridorSide,sign,variant},
  seed?, groundY?(x,z), front?:[fx,fz] }) -> BuildingPlan   // bentuk di §"Bentuk BuildingPlan"

// src/world/kit/buildBuilding.js
export function buildBuilding(plan, kitMaterials, { lod = 0, input = null, logger } = {}) -> PartList
//   PartList: [{ geometry (DUNIA, atribut position/normal/uv/color), material, matrix: null, castShadow, name }]
export function* appendPlanSteps(sink, plan, kitMaterials, { lod, ctx }); export function appendParts(sink, parts, mats);
export function fallbackPlan(plan, input) -> BuildingPlan (K12)

// src/world/kit/kitMaterials.js
export function createKitMaterials(scope, { anisotropy = 8 } = {}) -> { opak, potong, textures, atlasReady } // scope.get('kit:materials')
export const KIT_NIGHT /* {on:1, off:0} */

// src/world/kit/kitBuilder.js / kitAssemble.js / atlas.js / signs.js
export function createKitSink({ capacity } = {}) -> { opak, potong, papan, triangles, mark(), rewind(m), toParts(mats, name, geomOpts) }
export function appendBuilding(sink, plan, { lod }) -> triangles; export function* appendBuildingSteps(sink, plan, { lod })
export const ATLAS_CELLS, ATLAS_SIZE /* 2048 */; export function cellUv(id) -> {u0,v0,u1,v1}
export function createSignAtlas(signs, { createCanvas }) -> { material, uvOf(i), dispose() } | null
export function collectSigns(plans); export function appendSigns(sink, entries, atlas)

// src/world/kit/hero/index.js
export const HERO_BUILDERS /* beku; 7 kunci hero */; // (plan, kitMaterials, ctx:{lod}) => PartList; placeholder punya .steps

// src/districts/unri/*
export const BUILDING_OVERRIDES; export function resolveBuilding(osm, override, { logger }) -> { archetype, levels, palette, roof,
  corridorSide, sign, variant, sumber, keyakinan, aturan }; export function validateOverrides(table) -> string[]
export const CLUSTER /* { size:250, lod0:250, lod1:900, hysteresis:30, maxJobs:1, owner:'unri:gedung' } */
export function createBuildingClusters({ buildings, overrides, materials, scheduler, groundY, terrainReady, registries, collider,
  signAtlas, appendSteps, logger, config }) -> { group /*'unri:gedung'*/, update(focus), setSuppressed(ids), settled(x,z,r), stats(), snapshot(), dispose() }
export async function mountBuildings(ctx) -> { data, group, system /*'unri.gedung'*/, excludeIds, drawMinimap(ctx2d,tx,tz),
  setSuppressed(ids), settled, whenSettled(x,z,r?,timeoutMs?), stats, snapshot, dispose } | null
// collider M2 + M3: addBuildings(clusterKey, [{ring, holes}]), removeBuildings(clusterKey)
// public/districts/unri/buildings.json: { v:1, buildings:[{ id, ring, levels, tags, cluster, area, front, holes? }] }
// DEV: globalThis.__unriGedung (stats/whenSettled/group) untuk skrip ukur
```

Catatan untuk M4:
- **Gedung milik region** (H01 `w327530276`, H02 tribun `w282225436`, H03 `w1480014538`): ganti entri `HERO_BUILDERS` dengan fungsi yang mengembalikan `[]` (rencana M4 `regionOwnedHero`) — klaster memanggil `HERO_BUILDERS` untuk LOD0 **dan** LOD1 lewat `appendPlanSteps` (entri tanpa `.steps` → PartList dipakai apa adanya; `[]` = tidak digambar). Footprint tetap terdaftar di collider distrik; collider region (urutan regions → district) menang di dalam mask.
- Override tribun `w282225436` sudah `hero:stadion-mini` (levels 2, keyakinan rendah); M4 boleh memperbarui `sumber/keyakinan` bila punya foto.
- Rusunawa (`w327366048`, K09 5 lt, datar-parapet) dan FH Panam (`w327366046`, K10 `beratap`, 3 lt, atap pelana seng karat) **dirender distrik**; region Lembaga cukup menambah detail di sekitarnya.
- `kitAdapter` M4: `planBuilding({ id, ring /*DUNIA*/, levels, archetype, overrides, seed, groundY })` + `groupFromParts(buildBuilding(plan, mats))` cocok; `createKitMaterials(scope)` di-cache per scope (kunci `kit:materials`) — scope region dan scope distrik masing-masing punya atlas sendiri (±16 MB VRAM per atlas; bila perlu hemat, M4 boleh meminjam material distrik lewat ctx, bukan membuat atlas kedua).
- Placeholder `hero:sekretariat-lembaga` (K01 1 lt) dan `hero:student-center` (K03 3 lt segitiga) bisa dipakai sebagai dasar sebelum versi handmade.
- `VEG.clear.building` (Serah terima M2 butir 5) belum diubah: bila review M3/M4 menemukan pohon menembus selasar/kanopi, tambah tolok ukur itu di `tools/campusbake/ground/constants.js` lalu bake ulang ground.
- `setSuppressed(ids)` tersedia bila region ingin menyembunyikan gedung distrik non-hero di dalam mask (tidak diperlukan untuk H01–H03).
