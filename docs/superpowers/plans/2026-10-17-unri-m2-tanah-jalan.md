# M2 Tanah & Jalan Kampus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (satu implementer, satu review di akhir tonggak — memori `lightweight-process-hobby`). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kawasan kampus UNRI mendapat tanah & jalan yang autentik di atas terrain M1: jalan, trotoar, parkir, plaza, lapangan ter-drape (pecah ≤ 2 m, UV dunia, `polygonOffset`), air (Danau Buatan, Waduk UNRI) dan parit, warna permukaan rumput/tanah merah/tanah basah per sampel grid 4 m, vegetasi kampus (V01–V03, V06, V07) dan props (P03 PJU kampus, P04 bangku, P05 tong sampah) per sel/chunk, collider distrik (air + lereng > 35%), serta citybake yang mengklip kota terhadap batas distrik sehingga tidak ada z-fighting atau celah di batas distrik.

**Architecture:** Dua pemanggang offline + satu lapisan runtime. (1) `tools/citybake` diubah: landuse/air kota = selisih eksak terhadap `UNRI_BOUNDARY` (`polygon-clipping`), gedung dibuang per `excludeIds`/centroid, jalan dipotong eksak di tepi (`src/geo/lineClip.js`), `parseLevels("4-7") → 4`, area bake baru `unri` (16 tile di luar area stadion) memberi cache OSM seluruh kampus. (2) `tools/campusbake ground` (baru): OSM `data-src/osm/unri.json` + heightfield M1 → `public/districts/unri/ground/<ix>_<iz>.json` (jalan/trotoar dengan tumpang di batas, area, muka air, parit, vegetasi, props, bobot permukaan). (3) Runtime `src/districts/unri/groundLayer.js` menempel ke hook chunk terrain M1: mewarnai mesh terrain dari bobot, membangun mesh ter-drape per LOD lewat `scheduler` (≤ 4 ms/frame), vegetasi instanced per sel 200 m, PJU/bangku/tong per chunk, registry basah & malam, data collider. Aturan jahitan: terrain digambar paling awal (`renderOrder −5`) sehingga lapisan datar kota (y 0,02–0,10, `depthWrite:false`) di luar distrik tetap tampil, sedangkan di dalam distrik lapisan kota sudah diklip habis.

**Tech Stack:** Node ≥ 20 (ESM), Vitest 5.0.4, three 0.186.1 (`ShapeUtils`, `BufferGeometry`, `InstancedMesh`, `mergeGeometries`), `polygon-clipping` 0.15.7 (MIT, devDependency — hanya `tools/`), Playwright (global, sama dengan `tests/e2e/smoke.e2e.mjs`) untuk screenshot & ukur GPU.

---

## Prasyarat (wajib benar sebelum Task 1)

- M0 dan M1 **selesai** di branch `feat/unri-kampus` (indeks: baris status M0/M1 "selesai"). M2 memakai persis: `createScheduler` (`schedule(task, {owner}) -> {cancel}`, `pending(owner)`, `whenIdle(owner)`), `HeightField` (`heightAt`, `normalAt`, `add`), `decodeChunk(arrayBuffer, header)`, `sampleChunk(chunk, x, z)`, konstanta `src/geo/terrain/format.js` (`CHUNK_SIZE=500`, `STEP=4`, `N=126`, `UNIT=0.01`, `BIAS=-5000`), `defineDistrict`, `unriDistrict`, `UNRI_BOUNDARY`, `mountDistrict`, `src/districts/terrainChunks.js`, `buildTerrainChunkMesh`, CLI `npm run bake:campus -- terrain|ground|buildings|all [--offline]`, `public/districts/unri/manifest.json` + `terrain/<key>.bin`.
- Cache `data-src/osm/stadion.json` ada (dipakai citybake). Task 6 butuh **internet sekali** (Overpass + Overture untuk area baru `unri`, beberapa menit); semua bake sesudahnya `--offline`.
- Playwright terpasang global (seperti E2E), GPU d3d11 tersedia untuk Task 22.
- Pohon kerja bersih kecuali `.claude/launch.json` dan dokumen plan.

## Fakta data (dihitung dari `data-src/osm/stadion.json`, OSM 2026-10-16T08:53:21Z, saat menulis plan ini)

Poligon kampus `way/938374562` (110 node) di frame dunia: x −1.622,3…444,4, z −459,1…2.129,3, luas 2.435.156 m². Cakupan cache: semua way yang **memotong** bbox area stadion (x, z ∈ [−1.560, 1.560]) ikut lengkap, tetapi **tidak ada satu pun way yang seluruhnya di selatan z 1.560** → jalur ±570 m di sisi selatan kampus (Gerbang Soebrantas z ≈ 2.121, Health Sciences Center z ≈ 1.588) belum lengkap. Inilah alasan area citybake baru `unri` (Task 4/6). Hitungan di bawah = elemen dengan ≥ 1 simpul di dalam poligon kampus (fitur besar seperti EcoEduPark hanya sebagian di dalam):

| Kelas | Jumlah way | Catatan (panjang di dalam poligon / luas) |
|---|---|---|
| `highway=tertiary` | 34 | 7,05 km; `oneway=yes` 41 way (semua kelas) = jalur ganda Jl. Binawidya & Muchtar Lutfi |
| `highway=tertiary_link` | 10 | 0,52 km |
| `highway=service` | 124 | 15,07 km; 2 `service=parking_aisle`; 1 `junction=roundabout` (putaran Rektorat) |
| `highway=residential` | 4 | 0,87 km |
| `highway=footway` | 5 | 1,36 km; 3 `surface=concrete`; 1 `bridge=yes` (`w783152923`, titian Danau Buatan) |
| `highway=path` / `track` | 3 / 2 | 1,37 km / 0,30 km (track "Jalan Selaras", `motor_vehicle=no`) |
| `sidewalk`, `width`, `lanes` pada jalan internal | 0 | trotoar sisi jalan **tidak** dipetakan → M2 tidak mengarang trotoar |
| `highway=pedestrian`+`area=yes` / `place=square` (plaza) | 0 | jalur plaza tetap didukung, kosong saat ini |
| `amenity=parking` | 15 | 13 parkir kampus 325–4.693 m² (FISIP `w327534463` `surface=paving_stones`), 1 parkir stadion 22.809 m² (di dalam mask stadion) |
| `leisure=pitch` | 5 | + 1 `leisure=stadium` (Stadion Mini `w327364388`, tidak di-pave) |
| `natural=water` | 4 | Waduk UNRI `w327366050` 11.244 m², Danau Buatan `w373856980` 3.288 m², Waduk `w1313268660` 1.025 m², Waduk `w1313268661` 2.196 m² (2 bertag `water=reservoir`) |
| `waterway=ditch` / `waterway=yes` | 5 / 1 | 2 ditch + `waterway=yes` = `tunnel=culvert` (gorong-gorong, tidak di permukaan) |
| `natural=wood` | 7 | TAHUNRI 169.193 m², Arboretum 110.726 m², `w1452901218` 99.330 m², Hutan Campuran 14.521 m², dll. |
| `landuse=orchard` | 5 | `w1504824364` `trees=oil_palms` 41.404 m²; `w485848240` "Kebun Sawit" 97.141 m² |
| `landuse=farmland` | 15 | 12 petak 442 m²; `w466257556` `genus=Elaeis` (sawit) |
| `leisure=park` / `garden` | 3 / 1 | EcoEduPark, RTH Masjid Arfa'unnas, `w1452905699` |
| `landuse=grass`, `natural=grassland`, `natural=wetland` | 1 / 1 / 1 | wetland = `swamp` di sisi GGM |
| `landuse=construction` / `brownfield` / `greenfield` | 2 / 1 / 1 | |
| `building` (centroid di dalam) | 208 | 11 bercentroid x < −1.500 atau z > 1.500 |
| `building:levels` rentang | 2 | Rektorat `w282225347` & GGM `w314450943` = `"4-7"` (keduanya di dalam distrik). Cache `pusat.json`: 0 rentang → tile pusat harus byte-identik setelah bake ulang |

Tile kota yang beririsan distrik (perkiraan dengan poligon kampus − mask stadion + 40 m): stadion `-1_-1, -1_0, -1_1, -1_2, -2_-1, -2_0, -2_1, -2_2, -3_-1, -3_0, -3_1, -3_2, 0_0, 0_1`; area `unri` `-2_3, -2_4, -3_3, -3_4, -4_0, -4_1, -4_2`. Fakta `tests/osmFacts.test.js` lama (Jl. Naga Sakti z −475…−440, danau `(−192, −290)` & `(119, −384)`, tidak ada air di `(−60, −480)`) **tidak** berada di dalam distrik → tetap lulus.

**Prototipe saat menulis plan** (kode plan ini dijalankan di salinan sementara repo dengan stub M1: `UNRI_BOUNDARY` = poligon kampus mentah, heightfield sintetis ±2 m): seluruh tes plan + 979 tes lama lulus, lint bersih. citybake area stadion dengan klip distrik (OSM saja): fitur 1.942 → 1.546, 33 tile 0,76 MB, 1,9 s, 0 bangunan/titik jalan kota di dalam distrik, fakta Naga Sakti tetap. Bake ground dari `stadion.json` untuk 30 chunk (ix −4…0, iz −1…4): 25 s, 1,91 MB (chunk terbesar 78 KB), jalan 23,9 km, trotoar 1,34 km, jalan tanah 1,68 km, parit 12,3 km, parkir 14, lapangan 5, vegetasi ±5.600 instans, PJU 464, bangku 30, tong 15; 11 ujung jalan kota di batas semuanya tertutup pita distrik; bobot permukaan konsisten dengan batas. Smoke Node `groundLayer` (scheduler palsu): tanah keras 5 mesh + air + parit, vegetasi per sel, PJU 2 mesh, registry basah/malam, collider, pulih penuh saat lepas. Angka final berbeda karena cache `unri.json` lebih lengkap dan terrain M1 nyata.

## Format `ground/<ix>_<iz>.json` v1 (kontrak indeks + ekstensi aditif M2)

```json
{
  "v": 1,
  "key": "-2_1",
  "roads": [{ "cls": "tertiary", "w": 70, "pts": [1203, 4410, 1820, 4402] }],
  "walks": [{ "w": 20, "pts": [3000, 500, 3000, 3500] }],
  "areas": [
    { "kind": "parking", "rings": [[2500, 2500, 3000, 2500, 3000, 3000, 2500, 3000]] },
    { "kind": "water", "rings": [[400, 400, 800, 400, 800, 800, 400, 800]], "level": -0.4 }
  ],
  "ditches": [{ "w": 10, "pts": [0, 1920, 4000, 1920] }],
  "veg": [{ "sp": "mahoni", "pts": [3400, 600, 3561, 612] }],
  "props": { "lamps": [105, 2060, 180], "benches": [974, 650, 90], "bins": [974, 664] },
  "weights": { "n": 126, "grass": "<base64 n·n byte>", "soil": "<base64>", "wet": "<base64>" }
}
```

- Semua koordinat = **bilangan bulat satuan 0,1 m relatif sudut barat-laut chunk** `(ix·500, iz·500)`: `x_dunia = ix·500 + v·0,1`. `w` (lebar) juga 0,1 m. Nilai bisa negatif/≥ 5.000 untuk `roads`/`walks`/`ditches` (dipotong ke persegi chunk + margin 16 m agar pita bisa diklip eksak di runtime); `areas`, `veg`, `props` dipotong tepat ke persegi chunk (`[min, max)` untuk titik).
- `roads[].cls` = nilai `highway`; `walks` = footway/pedestrian/steps/cycleway; jalan `path`/`track` tidak di-drape (menjadi bobot `soil`).
- `areas[].kind` ∈ `parking|plaza|pitch|water`; ring = `[luar, ...lubang]` array datar terbuka. **Ekstensi M2:** `level` (m, 2 desimal) wajib untuk `water`.
- **Ekstensi M2 (aditif, `v` tetap 1):** `ditches` (parit OSM + parit tepi jalan utama [INFERENSI]), `veg` (`sp` ∈ `mahoni|angsana|saga|sawit|semak` = V01|V02|V03|V06|V07), `props` (`lamps`/`benches` = `[x, z, yawDerajat]…` dengan yaw = arah hadap ke jalan/trotoar, konvensi `atan2(dx, dz)`; `bins` = `[x, z]…`).
- `weights`: `n = 126` sampel per sisi, sampel `(i, j)` di `(ix·500 + 4i, iz·500 + 4j)`, baris-mayor `j` lalu `i` (sama dengan heightfield). Per sampel `grass + soil + wet = 255`, kecuali sampel di luar distrik = `0, 0, 0` (runtime memakai warna tanah kota).
- Urutan entri deterministik (id OSM, lalu potongan); bake ulang dari cache yang sama → byte identik.

## Deviasi dari indeks (alasan)

1. **Format ground** diperluas aditif (`areas[].level`, `ditches`, `veg`, `props`) — vegetasi, PJU, dan muka air membutuhkan data hasil bake (poligon hutan/kebun, jarak terhadap jalan, tinggi tepi danau) yang tidak tersedia di runtime. Indeks diperbarui di Task 23.
2. **File baru di luar daftar indeks** (boleh, dalam tonggak sendiri): `src/geo/lineClip.js`; `tools/campusbake/ground/{constants,sources,spatial,context,waterLevel,ditches,vegetation,props,index}.js`; `src/districts/unri/{groundData,surfaceTint,groundMaterials,streetProps,groundLayer}.js`; `src/world/props/unri/tongSampahKampus.js` (P05); `src/app/districtRegistries.js`; `tools/shots/unriM2.mjs`.
3. **File M0/M1 yang diubah** (tidak tercantum di "Ubah" M2 indeks): `src/districts/terrainChunks.js` (hook `onChunkMesh`/`onChunkRelease`), `src/app/districtMount.js` (opsi `time`/`weather` → `ctx.registries`; `ctx.scheduler`), `src/districts/unri/index.js` (memang berkembang per tonggak), `src/main.js` (meneruskan `time`, `weather` ke `mountDistrict`), `tools/campusbake/index.js` (cabang CLI `ground`). Juga `src/world/Weather.wet.js` (bendera `userData.wetSurface`), `src/world/Landscape.trees.js` (ekspor `VEGETATION_CELL`), `tools/citybake/cli.js` (teks pemakaian), `tests/citybake/{golden,cli,config}.test.js`.
4. `drapePolyline`/`drapePolygon` menerima opsi tambahan `clipRect` (opsional); tanda tangan indeks tetap. Parameter `field` boleh HeightField M1 **atau** permukaan "aman-mesh" `createChunkSurface(chunk, {stride})` (dibuat di `drape.js`).
5. Area citybake **baru** `unri` (bukan memperluas `stadion`) dengan `skipAreas: ['stadion']` → satu tile = satu area di manifest; cache OSM `unri.json` meliputi seluruh poligon kampus.
6. P03 `pju-kampus`: kepala lampu di 8,6 m (= `LAMP_POST.height − armDrop`, tinggi `LAMP_HEIGHT` TimeOfDay) alih-alih ±7 m katalog (berlabel INF) agar PointLight/halo malam tepat di kepala lampu.
7. Aturan jahitan: M2 menyetel `renderOrder = −5` pada mesh terrain chunk (lewat hook) — tidak mengubah kode M1.

## Struktur file

| File | Tanggung jawab |
|---|---|
| `src/geo/lineClip.js` | `splitPolylineByRing`, `insideWithOverlap`, `slicePolyline`, `polylineLength` (murni) |
| `tools/citybake/mask.js` | + `osmShortId`, `applyDistricts` (polygon-clipping + potong eksak) |
| `tools/citybake/config.js` | + `AREAS.unri` (`skipAreas`), `DISTRICTS`, `areaTiles`/`areaFetchBBox` sadar `skipAreas` |
| `tools/citybake/height.js` | `parseLevels` menerima rentang → minimum |
| `tools/citybake/pipeline.js` | `resolveDistricts`, `prepareFeatures({…, districts})`, `runBake({…, districts})` |
| `tools/citybake/cli.js` | teks pemakaian memuat `unri` |
| `tools/campusbake/ground/constants.js` | konstanta format, kelas jalan, parit, bobot, vegetasi, props |
| `tools/campusbake/ground/sources.js` | muat cache OSM `unri.json`, proyeksi, plaza, heightfield dari `terrain/*.bin` |
| `tools/campusbake/ground/extract.js` | fitur → jalan/trotoar/jalan tanah/air garis/area/landcover/gedung (klip distrik) |
| `tools/campusbake/ground/spatial.js` | indeks grid garis & poligon, `samplesAlong` |
| `tools/campusbake/ground/context.js` | kueri gabungan (di dalam distrik, jarak jalan, area, gedung, lereng) |
| `tools/campusbake/ground/waterLevel.js` | muka air & deteksi "dipahat" |
| `tools/campusbake/ground/ditches.js` | parit tepi jalan utama + penyederhanaan |
| `tools/campusbake/ground/surfaces.js` | bobot grass/soil/wet per sampel 4 m, encode base64 |
| `tools/campusbake/ground/vegetation.js` | penempatan V01–V03, V06, V07 |
| `tools/campusbake/ground/props.js` | penempatan P03/P04/P05 |
| `tools/campusbake/ground/writeGround.js` | `assembleChunk` (klip + kuantisasi), `writeGround` (berkas + `manifest.ground`) |
| `tools/campusbake/ground/index.js` | `bakeGroundChunks` (murni), `bakeGround` (I/O), `groundReport` |
| `tools/campusbake/index.js` | cabang CLI `ground` memanggil `bakeGround` |
| `src/world/terrain/drape.js` | `DRAPE`, `nodeIndices`, `createChunkSurface`, `drapePolyline`, `drapePolygon` |
| `src/districts/unri/groundData.js` | `parseGroundChunk` + `GroundDataError` (validasi) |
| `src/districts/unri/surfaceTint.js` | warna vertex terrain dari bobot (murni) |
| `src/districts/unri/groundMaterials.js` | material distrik (surfaceMaps, polygonOffset, nama registry) |
| `src/districts/unri/ground.js` | mesh keras ter-drape per chunk/LOD, marka, `tintTerrainRoot`, `mergedMesh` |
| `src/districts/unri/water.js` | bidang air & pita parit |
| `src/districts/unri/vegetation.js` | instans vegetasi (murni) + `InstancedMesh` per sel 200 m |
| `src/districts/unri/lamps.js` | P03 per chunk + posisi kepala lampu untuk registry malam |
| `src/districts/unri/streetProps.js` | P04 bangku + P05 tong sampah per chunk |
| `src/districts/unri/collider.js` | collider distrik (air, lereng > 35 %, rintangan lingkaran) |
| `src/districts/unri/groundLayer.js` | orkestrasi streaming tanah (hook terrain, scheduler, registry, visibilitas) |
| `src/world/props/unri/pjuKampus.js` | P03 prosedural |
| `src/world/props/unri/tongSampahKampus.js` | P05 prosedural |
| `src/app/districtRegistries.js` | registry basah/malam untuk konten distrik yang datang belakangan |
| `src/app/districtMount.js`, `src/districts/terrainChunks.js`, `src/districts/unri/index.js`, `src/main.js` | perkabelan (lihat deviasi 3) |
| `src/world/Weather.wet.js`, `src/world/Landscape.trees.js` | bendera basah, ekspor `VEGETATION_CELL` |
| `tools/shots/unriM2.mjs` | screenshot + ukur draw call/segitiga distrik (Playwright GPU) |
| `public/tiles/**`, `public/districts/unri/{manifest.json,ground/*.json}` | hasil bake (di-commit) |
| `tests/geo/lineClip.test.js`, `tests/citybake/{maskDistrict,goldenDistrict}.test.js`, `tests/campusbake/ground*.test.js`, `tests/drape.test.js`, `tests/districts/unri*.test.js`, `tests/districtRegistries.test.js`, `tests/wetSurfaceFlag.test.js`, `tests/osmFacts.test.js` | tes |

Tes hanya untuk logika murni/berisiko (spec §11): klip garis/poligon, citybake + golden, bake ground + golden, drape, validasi data, warna permukaan, instans vegetasi, kepala lampu, collider, registry. Kode visual: smoke + screenshot (Task 22).

---

### Task 0: Verifikasi kontrak M0/M1 & dependensi

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Pastikan M0/M1 lengkap dan hijau**

Run:
```bash
git status --short
git log --oneline -5
node -e "import('./src/geo/terrain/format.js').then((m) => console.log(m.CHUNK_SIZE, m.STEP, m.N, m.UNIT, m.BIAS))"
node -e "const m = require('./public/districts/unri/manifest.json'); console.log(m.format, m.version, Object.keys(m.terrain), m.terrain.chunks.length, JSON.stringify(m.ground))"
node node_modules/vitest/vitest.mjs run
```
Expected: `500 4 126 0.01 -5000`; manifest `unri-district 1`, `terrain.chunks` berisi ±20–30 kunci, `ground` = `{"chunks":[]}` (atau tidak ada); semua tes PASS.

- [ ] **Step 2: Catat API M1 yang dipakai M2**

Run:
```bash
grep -n "^export" src/geo/terrain/heightfield.js src/districts/District.js src/districts/terrainChunks.js src/world/terrain/TerrainMesh.js src/app/districtMount.js src/districts/unri/index.js src/districts/unri/boundary.js
grep -n "lod\|stride\|125\|% 4" src/world/terrain/TerrainMesh.js
grep -n "build(\|ctx\.\|scheduler\|schedule\|registries\|createScope" src/app/districtMount.js
grep -n "group.add\|remove\|dispose\|buildTerrainChunkMesh" src/districts/terrainChunks.js
grep -n "ground" tools/campusbake/index.js
grep -rn "parit\|ditch\|DITCH" tools/campusbake/terrain/
grep -n "JSON.stringify" tools/campusbake/terrain/writeChunks.js tools/campusbake/index.js
```
Cocokkan dengan tabel berikut. Kolom kanan = tindakan bila berbeda (lakukan di task yang disebut, bukan menebak di tempat lain):

| Butir | Diharapkan | Bila berbeda |
|---|---|---|
| `decodeChunk(arrayBuffer, header)`; header `{key, ix, iz, origin:{x,z}, size, step, n, unit, bias}`; berkas `.bin` = `Uint16` LE `n·n` tanpa header | spec §4.1 | ubah `chunkHeader()` (Task 7) |
| `sampleChunk(chunk, x, z)` bilinear, tepat di simpul | spec §4.1 | — (wajib) |
| Mesh LOD1 memakai simpul indeks `0, 4, 8, …, 124, 125` | grep TerrainMesh | ubah `nodeIndices()` (Task 14) agar sama persis |
| `terrainChunks` punya satu tempat mesh chunk dipasang (load/swap) dan satu tempat mesh dilepas (unload) | grep | lokasi hook (Task 21) |
| `mountDistrict` meneruskan `ctx.scope` (ResourceScope distrik), `ctx.terrain`, dan scheduler | grep | tambah `scheduler` ke ctx (Task 20) |
| `manifest.json` ditulis `JSON.stringify(m, null, 2) + '\n'` | grep | `writeGround` memakai format yang sama dengan M1 (Task 12) |
| Konstanta parit M1 = lebar 1,0 m, garis tengah di `w/2 + 3,0` m dari sumbu jalan, kelas `tertiary(_link)` | grep `terrain/water.js` | samakan `DITCH` (Task 9) |
| Mesh chunk dilepas M1 dengan `disposeTree` yang menghormati `scope.owns` (material bersama tidak di-dispose) | grep | `groundLayer` sudah memulihkan material asli sebelum lepas (Task 21) |
| `tanahKota` (y −0,05) tidak menutupi lembah terrain (cek screenshot M1 di danau) | `docs/screenshots/unri/m1-*.jpg` | **berhenti**: kembalikan ke M1 (di luar lingkup M2) |

- [ ] **Step 3: Pasang `polygon-clipping`**

Run:
```bash
npm i -D polygon-clipping@0.15.7
node -e "import('polygon-clipping').then((m) => console.log(typeof m.default.difference, typeof m.default.intersection))"
```
Expected: `function function`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
```
```bash
git commit -m "chore: dependensi polygon-clipping untuk klip distrik (citybake & campusbake)"
```

---

### Task 1: `src/geo/lineClip.js` — potong polyline eksak terhadap ring

**Files:**
- Create: `src/geo/lineClip.js`
- Test: `tests/geo/lineClip.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import { splitPolylineByRing, insideWithOverlap, slicePolyline, polylineLength } from '../../src/geo/lineClip.js';

const SQ = [[-50, -50], [50, -50], [50, 50], [-50, 50]];
const close = (a, b) => {
  expect(a).toHaveLength(b.length);
  a.forEach((p, i) => {
    expect(p[0]).toBeCloseTo(b[i][0], 9);
    expect(p[1]).toBeCloseTo(b[i][1], 9);
  });
};

describe('splitPolylineByRing', () => {
  it('garis menembus: titik potong tepat di tepi ring', () => {
    const { inside, outside } = splitPolylineByRing([[-100, 0], [100, 0]], SQ);
    expect(inside).toHaveLength(1);
    close(inside[0], [[-50, 0], [50, 0]]);
    expect(outside).toHaveLength(2);
    close(outside[0], [[-100, 0], [-50, 0]]);
    close(outside[1], [[50, 0], [100, 0]]);
  });

  it('belokan di dalam ring mempertahankan simpul', () => {
    const { inside } = splitPolylineByRing([[-100, 0], [0, 0], [0, 100]], SQ);
    close(inside[0], [[-50, 0], [0, 0], [0, 50]]);
  });

  it('seluruhnya di dalam / di luar', () => {
    expect(splitPolylineByRing([[-10, 0], [10, 0]], SQ).outside).toEqual([]);
    const out = splitPolylineByRing([[-100, 80], [100, 80]], SQ);
    expect(out.inside).toEqual([]);
    close(out.outside[0], [[-100, 80], [100, 80]]);
  });

  it('panjang potongan dalam + luar = panjang asli', () => {
    const line = [[-120, -30], [-20, 10], [30, 90], [70, -70]];
    const { inside, outside } = splitPolylineByRing(line, SQ);
    const sum = [...inside, ...outside].reduce((s, l) => s + polylineLength(l), 0);
    expect(sum).toBeCloseTo(polylineLength(line), 9);
  });
});

describe('insideWithOverlap', () => {
  it('ujung yang memotong tepi diperpanjang menyusuri polyline asli', () => {
    const parts = insideWithOverlap([[-100, 0], [100, 0]], SQ, 5);
    expect(parts).toHaveLength(1);
    close(parts[0], [[-55, 0], [55, 0]]);
  });

  it('perpanjangan berhenti di ujung polyline asli', () => {
    close(insideWithOverlap([[-52, 0], [0, 0]], SQ, 5)[0], [[-52, 0], [0, 0]]);
  });

  it('dua potongan dalam yang berdekatan digabung bila perpanjangannya bertumpuk', () => {
    const notch = [[-50, -50], [50, -50], [50, 50], [2, 50], [2, -10], [-2, -10], [-2, 50], [-50, 50]];
    expect(splitPolylineByRing([[-100, 0], [100, 0]], notch).inside).toHaveLength(2);
    const parts = insideWithOverlap([[-100, 0], [100, 0]], notch, 5);
    expect(parts).toHaveLength(1);
    close(parts[0], [[-55, 0], [55, 0]]);
  });

  it('tanpa bagian dalam → []', () => {
    expect(insideWithOverlap([[-100, 80], [100, 80]], SQ, 5)).toEqual([]);
  });
});

describe('slicePolyline', () => {
  it('potong menurut jarak; simpul asli di antaranya dipertahankan', () => {
    close(slicePolyline([[0, 0], [10, 0], [10, 10]], 5, 15), [[5, 0], [10, 0], [10, 5]]);
    expect(slicePolyline([[0, 0], [10, 0]], 4, 4)).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/geo/lineClip.test.js`
Expected: FAIL — `Failed to resolve import "../../src/geo/lineClip.js"`.

- [ ] **Step 3: Implementasi**

```js
/**
 * Potong polyline terhadap ring poligon secara EKSAK (titik potong tepat di tepi ring). Murni.
 * Dipakai citybake (bagian jalan kota di luar distrik) dan campusbake ground (bagian di dalam distrik +
 * tumpang `overlap` m agar sambungan dengan jalan kota tertutup). Tiap sub-segmen diklasifikasi memakai
 * titik tengahnya (pointInPolygon), sehingga simpul yang tepat di tepi ring tidak bermasalah.
 */
import { pointInPolygon } from './polygon.js';

const EPS = 1e-9;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Jarak kumulatif tiap simpul dari awal polyline. */
function cumulative(line) {
  const cum = [0];
  for (let i = 1; i < line.length; i += 1) {
    cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  }
  return cum;
}

/** Panjang polyline (m). */
export const polylineLength = (line) => (line.length < 2 ? 0 : cumulative(line)[line.length - 1]);

/** Parameter t ∈ (0, 1) tempat segmen a→b memotong tepi-tepi ring; urut naik, unik. */
function crossings(a, b, ring) {
  const ts = [];
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  for (let i = 0; i < ring.length; i += 1) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const ex = q[0] - p[0];
    const ez = q[1] - p[1];
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < EPS) continue; // sejajar/kolinear: tidak menambah titik potong
    const wx = p[0] - a[0];
    const wz = p[1] - a[1];
    const t = (wx * ez - wz * ex) / den;
    const u = (wx * dz - wz * dx) / den;
    if (t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  return ts.filter((t, i) => i === 0 || t - ts[i - 1] > EPS);
}

/** Titik pada jarak s (memakai cum); tepat sama dengan simpul bila s jatuh di simpul. */
function pointAt(line, cum, s) {
  const last = line.length - 1;
  if (s <= 0) return [line[0][0], line[0][1]];
  if (s >= cum[last]) return [line[last][0], line[last][1]];
  let i = 0;
  while (i < last - 1 && cum[i + 1] < s) i += 1;
  const len = cum[i + 1] - cum[i];
  const t = len > 0 ? (s - cum[i]) / len : 0;
  if (t <= 0) return [line[i][0], line[i][1]];
  if (t >= 1) return [line[i + 1][0], line[i + 1][1]];
  return lerp(line[i], line[i + 1], t);
}

/** Sub-polyline antara jarak s0..s1 (di-clamp); [] bila panjangnya ≈ 0. */
function sliceByCum(line, cum, s0, s1) {
  const total = cum[cum.length - 1];
  const a = Math.max(0, Math.min(total, s0));
  const b = Math.max(0, Math.min(total, s1));
  if (b - a < EPS) return [];
  const pts = [pointAt(line, cum, a)];
  for (let i = 1; i < line.length - 1; i += 1) {
    if (cum[i] > a + EPS && cum[i] < b - EPS) pts.push([line[i][0], line[i][1]]);
  }
  pts.push(pointAt(line, cum, b));
  return pts;
}

/** Sub-polyline menurut jarak sepanjang polyline (meter dari awal). */
export function slicePolyline(line, s0, s1) {
  return line.length < 2 ? [] : sliceByCum(line, cumulative(line), s0, s1);
}

/** Interval jarak [s0, s1] berurutan dengan status di dalam/di luar ring (interval sejenis digabung). */
function intervals(line, ring) {
  const cum = cumulative(line);
  const list = [];
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const len = cum[i + 1] - cum[i];
    if (len < EPS) continue;
    const ts = [0, ...crossings(a, b, ring), 1];
    for (let k = 0; k < ts.length - 1; k += 1) {
      const m = lerp(a, b, (ts[k] + ts[k + 1]) / 2);
      const inside = pointInPolygon(m[0], m[1], ring);
      const s0 = cum[i] + ts[k] * len;
      const s1 = cum[i] + ts[k + 1] * len;
      const last = list[list.length - 1];
      if (last && last.inside === inside) last.s1 = s1;
      else list.push({ s0, s1, inside });
    }
  }
  return { cum, list };
}

/**
 * Bagi polyline menjadi potongan di dalam dan di luar ring.
 * @param {Array<[number, number]>} line @param {Array<[number, number]>} ring ring terbuka
 * @returns {{inside: Array<Array<[number, number]>>, outside: Array<Array<[number, number]>>}}
 */
export function splitPolylineByRing(line, ring) {
  const inside = [];
  const outside = [];
  if (line.length < 2) return { inside, outside };
  const { cum, list } = intervals(line, ring);
  for (const iv of list) {
    const part = sliceByCum(line, cum, iv.s0, iv.s1);
    if (part.length >= 2) (iv.inside ? inside : outside).push(part);
  }
  return { inside, outside };
}

/**
 * Potongan di dalam ring; tiap ujung yang memotong tepi diperpanjang `overlap` m menyusuri polyline asli
 * (berhenti di ujung polyline). Potongan yang perpanjangannya bertumpuk digabung.
 */
export function insideWithOverlap(line, ring, overlap) {
  if (line.length < 2) return [];
  const { cum, list } = intervals(line, ring);
  const total = cum[cum.length - 1];
  const merged = [];
  for (const iv of list.filter((v) => v.inside)) {
    const s0 = Math.max(0, iv.s0 - overlap);
    const s1 = Math.min(total, iv.s1 + overlap);
    const last = merged[merged.length - 1];
    if (last && s0 <= last.s1) last.s1 = Math.max(last.s1, s1);
    else merged.push({ s0, s1 });
  }
  return merged.map((iv) => sliceByCum(line, cum, iv.s0, iv.s1)).filter((p) => p.length >= 2);
}
```

- [ ] **Step 4: Jalankan, pastikan lulus; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/geo/lineClip.test.js
npm run lint
```
Expected: 9 tes PASS; lint 0 galat.

- [ ] **Step 5: Commit**

```bash
git add src/geo/lineClip.js tests/geo/lineClip.test.js
```
```bash
git commit -m "feat(geo): potong polyline eksak terhadap ring + tumpang di batas (lineClip)"
```

---

### Task 2: `parseLevels` menerima rentang `"4-7"` → 4

**Files:**
- Modify: `tools/citybake/height.js`
- Test: `tests/citybake/height.test.js`

- [ ] **Step 1: Tambah tes yang gagal**

Di `tests/citybake/height.test.js`, tambahkan di dalam `describe('parseHeight / parseLevels', …)` setelah `it('format umum', …)`:
```js
  it('rentang "4-7" → nilai minimum (spec §4.7: Rektorat & GGM bertag 4-7)', () => {
    expect(parseLevels('4-7')).toBe(4);
    expect(parseLevels(' 2 - 3 ')).toBe(2);
    expect(parseLevels('7-4')).toBe(4);
    expect(parseLevels('0-3')).toBeNull();
    expect(parseLevels('-1')).toBeNull();
    expect(parseLevels('2;3')).toBe(3);
  });
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/height.test.js`
Expected: FAIL — `expected null to be 4`.

- [ ] **Step 3: Implementasi**

Di `tools/citybake/height.js`, ganti fungsi `parseLevels` beserta komentarnya dengan:
```js
const LEVEL_RANGE = /^\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/;

/**
 * "3", "2.5", "2;3" (ambil maks), rentang "4-7" (ambil MINIMUM, spec §4.7/§6) → jumlah lantai;
 * null bila tidak valid.
 */
export function parseLevels(value) {
  if (value === undefined || value === null) return null;
  const range = String(value).match(LEVEL_RANGE);
  if (range) {
    const lo = Math.min(Number(range[1]), Number(range[2]));
    return lo > 0 ? lo : null;
  }
  const nums = String(value).split(/[;,]/).map((s) => Number(s.trim())).filter((v) => Number.isFinite(v) && v > 0);
  return nums.length ? Math.max(...nums) : null;
}
```

- [ ] **Step 4: Jalankan tes citybake**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake`
Expected: semua PASS (golden tidak berubah: fixture tanpa rentang).

- [ ] **Step 5: Commit**

```bash
git add tools/citybake/height.js tests/citybake/height.test.js
```
```bash
git commit -m "feat(citybake): building:levels rentang \"4-7\" dibaca sebagai minimum"
```

---

### Task 3: `applyDistricts` di `tools/citybake/mask.js`

**Files:**
- Modify: `tools/citybake/mask.js`
- Test: `tests/citybake/maskDistrict.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import { applyDistricts, osmShortId } from '../../tools/citybake/mask.js';
import { polygonArea, signedArea } from '../../src/geo/polygon.js';

const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const D = { id: 'uji', ring: sq(0, 0, 100, 100), excludeIds: new Set(['w7']) };
const bld = (id, cx, cz) => ({ id, source: 'osm', kind: 'building', cls: 'yes', tags: {}, rings: [sq(cx - 5, cz - 5, cx + 5, cz + 5)] });
const area = (id, kind, ring, holes = []) => ({
  id, source: 'osm', kind, cls: kind === 'water' ? 'water' : 'grass', tags: {}, rings: [ring, ...holes],
});
const road = (id, line) => ({ id, source: 'osm', kind: 'road', cls: 'tertiary', tags: {}, line });

describe('osmShortId', () => {
  it('way/relation OSM → w/r; Overture → null', () => {
    expect(osmShortId('osm:way/123')).toBe('w123');
    expect(osmShortId('osm:relation/9#0')).toBe('r9');
    expect(osmShortId('osm:way/5~0')).toBe('w5');
    expect(osmShortId('overture:abc')).toBeNull();
  });
});

describe('applyDistricts', () => {
  it('bangunan: centroid di dalam dibuang; id ∈ excludeIds dibuang walau centroid di luar', () => {
    const ov = { ...bld('overture:x', 20, 20), source: 'overture' };
    const out = applyDistricts([bld('osm:way/1', 50, 50), bld('osm:way/7', 150, 50), bld('osm:way/8', 150, 50), ov], [D]);
    expect(out.map((f) => f.id)).toEqual(['osm:way/8']);
  });

  it('landuse menyilang batas: selisih eksak, dua potongan ~c<k>, orientasi positif', () => {
    const out = applyDistricts([area('osm:way/2', 'landuse', sq(-50, 40, 150, 60))], [D]);
    expect(out.map((f) => f.id)).toEqual(['osm:way/2~c0', 'osm:way/2~c1']);
    expect(out.reduce((s, f) => s + polygonArea(f.rings[0]), 0)).toBeCloseTo(200 * 20 - 100 * 20, 6);
    for (const f of out) expect(signedArea(f.rings[0])).toBeGreaterThan(0);
  });

  it('air seluruhnya di dalam dibuang; fitur yang tak beririsan tetap objek yang sama', () => {
    const far = area('osm:way/4', 'water', sq(300, 300, 320, 320));
    const near = area('osm:way/5', 'water', sq(101, 0, 120, 20));
    const out = applyDistricts([area('osm:way/3', 'water', sq(10, 10, 20, 20)), far, near], [D]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(far);
    expect(out[1]).toBe(near);
  });

  it('lubang dipertahankan pada potongan (satu potongan → id tetap)', () => {
    const f = area('osm:way/6', 'landuse', sq(-100, -100, 50, 200), [sq(-80, -80, -60, -60)]);
    const out = applyDistricts([f], [D]);
    expect(out.map((p) => p.id)).toEqual(['osm:way/6']);
    expect(out[0].rings).toHaveLength(2);
    expect(polygonArea(out[0].rings[0]) - polygonArea(out[0].rings[1])).toBeCloseTo(150 * 300 - 50 * 100 - 400, 6);
  });

  it('jalan: bagian dalam dibuang, potong tepat di tepi; tak bersinggungan → objek sama', () => {
    const out = applyDistricts([road('osm:way/9', [[-50, 50], [150, 50]])], [D]);
    expect(out.map((f) => f.id)).toEqual(['osm:way/9~d0', 'osm:way/9~d1']);
    expect(out[0].line.at(-1)[0]).toBeCloseTo(0, 9);
    expect(out[1].line[0][0]).toBeCloseTo(100, 9);
    const away = road('osm:way/10', [[-50, 200], [150, 200]]);
    expect(applyDistricts([away], [D])[0]).toBe(away);
  });

  it('tanpa distrik → salinan daftar', () => {
    const f = [bld('osm:way/1', 50, 50)];
    const out = applyDistricts(f, []);
    expect(out).toEqual(f);
    expect(out).not.toBe(f);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/maskDistrict.test.js`
Expected: FAIL — `applyDistricts is not a function` / `osmShortId is not a function`.

- [ ] **Step 3: Implementasi**

Di `tools/citybake/mask.js`: ganti blok komentar atas + baris impor menjadi:
```js
/**
 * Buang/klip fitur kota terhadap (1) mask region handmade dan (2) batas distrik berelevasi.
 * Mask region (config.REGION_MASKS, ring DUNIA): poligon dibuang bila centroid ring luarnya di dalam mask;
 * polyline dipotong per segmen (titik tengah di dalam → dibuang), sisa bersambung menjadi `<id>~k`.
 * Distrik (config.DISTRICTS, spec §6): air/landuse = SELISIH eksak terhadap ring distrik (polygon-clipping,
 * potongan `<id>~c<k>`); bangunan dibuang bila id OSM ∈ excludeIds ATAU centroid di dalam distrik (Overture
 * tanpa id OSM); jalan/sungai dipotong eksak di tepi ring (lineClip), bagian dalam dibuang (`<id>~d<k>`).
 */
import polygonClipping from 'polygon-clipping';
import {
  boundsOverlap, cleanRing, pointInPolygon, polygonArea, polygonCentroid, ringBounds,
} from '../../src/geo/polygon.js';
import { splitPolylineByRing } from '../../src/geo/lineClip.js';
```
Lalu tambahkan di akhir berkas:
```js
/** Serpihan hasil klip lebih kecil dari ini (m²) dibuang. */
const MIN_PIECE_AREA = 0.01;
const OSM_ID = /^osm:(way|relation)\/(\d+)/;

/** 'osm:way/123' → 'w123', 'osm:relation/9#0' → 'r9'; selain OSM → null. */
export function osmShortId(id) {
  const m = String(id).match(OSM_ID);
  return m ? `${m[1] === 'way' ? 'w' : 'r'}${m[2]}` : null;
}

/** Poligon dikurangi ring distrik; tanpa irisan → fitur asli (objek sama). */
function differencePolygon(f, ring) {
  if (polygonClipping.intersection(f.rings, [ring]).length === 0) return [f];
  const pieces = polygonClipping.difference(f.rings, [ring])
    .map((poly) => poly.map((r) => cleanRing(r, 1e-9)).filter((r) => r.length >= 3))
    .filter((rings) => rings.length > 0 && polygonArea(rings[0]) > MIN_PIECE_AREA);
  return pieces.map((rings, k) => ({ ...f, id: pieces.length === 1 ? f.id : `${f.id}~c${k}`, rings }));
}

/** Polyline tanpa bagian di dalam ring; tanpa irisan → fitur asli (objek sama). */
function splitLineFeature(f, ring) {
  const { inside, outside } = splitPolylineByRing(f.line, ring);
  if (inside.length === 0) return [f];
  return outside.map((line, k) => ({ ...f, id: `${f.id}~d${k}`, line }));
}

function applyDistrict(features, { ring, excludeIds = new Set() }) {
  const db = ringBounds(ring);
  const out = [];
  for (const f of features) {
    if (f.kind === 'building') {
      const sid = osmShortId(f.id);
      if (sid && excludeIds.has(sid)) continue;
      const c = polygonCentroid(f.rings[0]);
      if (!pointInPolygon(c.x, c.z, ring)) out.push(f);
      continue;
    }
    const fb = ringBounds(f.rings ? f.rings[0] : f.line);
    if (!boundsOverlap(fb, db)) out.push(f);
    else if (f.rings) out.push(...differencePolygon(f, ring));
    else out.push(...splitLineFeature(f, ring));
  }
  return out;
}

/**
 * @param {import('./features.js').Feature[]} features koordinat dunia
 * @param {Array<{id: string, ring: Array<[number, number]>, excludeIds?: Set<string>}>} districts
 * @returns {import('./features.js').Feature[]} daftar baru (input tidak dimutasi)
 */
export function applyDistricts(features, districts) {
  let out = features.slice();
  for (const d of districts) out = applyDistrict(out, d);
  return out;
}
```

- [ ] **Step 4: Jalankan tes**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/citybake/maskDistrict.test.js tests/citybake/maskPartition.test.js
npm run lint
```
Expected: semua PASS; lint 0 galat.

- [ ] **Step 5: Commit**

```bash
git add tools/citybake/mask.js tests/citybake/maskDistrict.test.js
```
```bash
git commit -m "feat(citybake): klip distrik — selisih eksak landuse/air, eksklusi gedung, potong jalan di tepi"
```

---

### Task 4: Konfigurasi citybake — `DISTRICTS`, area `unri`, `skipAreas`

**Files:**
- Modify: `tools/citybake/config.js`, `tools/citybake/cli.js`
- Test: `tests/citybake/config.test.js`, `tests/citybake/cli.test.js`

- [ ] **Step 1: Tambah tes yang gagal**

Di `tests/citybake/config.test.js`: ubah impor config menjadi
```js
import {
  ORIGIN, AREAS, DISTRICTS, ROAD_CLASSES, LANDUSE_COLORS, LANDUSE_ORDER, LAYER_Y, REGION_MASKS, OVERTURE, OVERPASS_ENDPOINTS, USER_AGENT,
  areaRect, areaTiles, areaFetchBBox,
} from '../../tools/citybake/config.js';
import { UNRI_BOUNDARY } from '../../src/districts/unri/boundary.js';
```
lalu tambahkan di dalam `describe('citybake config', …)`:
```js
  it('area unri: 16 tile di luar area stadion, persegi memuat seluruh batas distrik', () => {
    const tiles = areaTiles(AREAS.unri, proj);
    expect(tiles).toHaveLength(16);
    const stadionKeys = new Set(areaTiles(AREAS.stadion, proj).map((t) => t.key));
    expect(tiles.some((t) => stadionKeys.has(t.key))).toBe(false);
    expect(tiles.map((t) => t.key)).toEqual(expect.arrayContaining(['-4_-1', '-4_4', '-3_4', '1_3']));
    const r = areaRect(AREAS.unri, proj);
    for (const [x, z] of UNRI_BOUNDARY) {
      expect(x).toBeGreaterThan(r.minX);
      expect(x).toBeLessThan(r.maxX);
      expect(z).toBeGreaterThan(r.minZ);
      expect(z).toBeLessThan(r.maxZ);
    }
  });

  it('bbox fetch unri memuat Gerbang Soebrantas (lat 0,46441) & tepi barat kampus (lon 101,37495)', () => {
    const b = areaFetchBBox(AREAS.unri, proj);
    expect(b.south).toBeLessThan(0.46434);
    expect(b.west).toBeLessThan(101.37495);
  });

  it('skipAreas tak dikenal → galat jelas', () => {
    expect(() => areaTiles({ ...AREAS.unri, skipAreas: ['bandara'] }, proj)).toThrow(/skipAreas/);
  });

  it('DISTRICTS: unri memakai UNRI_BOUNDARY + berkas buildings.json (M3)', () => {
    expect(DISTRICTS.map((d) => d.id)).toEqual(['unri']);
    expect(DISTRICTS[0].ring).toBe(UNRI_BOUNDARY);
    expect(DISTRICTS[0].buildingsFile).toBe('public/districts/unri/buildings.json');
  });
```
Di `tests/citybake/cli.test.js`, ganti `areaIds: ['stadion', 'pusat']` menjadi `areaIds: ['stadion', 'pusat', 'unri']`.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/config.test.js tests/citybake/cli.test.js`
Expected: FAIL — `AREAS.unri` undefined / `DISTRICTS` tidak diekspor.

- [ ] **Step 3: Implementasi `config.js`**

Tambahkan impor setelah impor `stadionMaskWorld`:
```js
import { UNRI_BOUNDARY } from '../../src/districts/unri/boundary.js';
```
Ganti blok `AREAS` (termasuk komentarnya) dengan:
```js
/**
 * Kawasan bake. center = lat/lon; halfSize = setengah sisi persegi (m) di frame dunia.
 * Tile yang di-bake = semua tile yang beririsan persegi itu (dibulatkan keluar ke grid 500 m), dikurangi
 * tile milik area di `skipAreas` (satu tile = satu area di manifest).
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
  unri: Object.freeze({
    id: 'unri',
    name: 'Kampus UNRI Bina Widya (tepi barat & selatan di luar area stadion)',
    // Pusat bbox poligon kampus OSM way 938374562 (lat 0,46434–0,48775; lon 101,37495–101,39352) ≈ dunia
    // (−589, 835). halfSize 1300 memuat seluruh poligon (x −1622…444, z −459…2129). Cache OSM area ini
    // (data-src/osm/unri.json) juga sumber campusbake ground/buildings (spec §6 butir 5).
    center: Object.freeze({ lat: 0.476045, lon: 101.384235 }),
    halfSize: 1300,
    skipAreas: Object.freeze(['stadion']),
  }),
});
```
Tambahkan setelah `REGION_MASKS`:
```js
/**
 * Distrik berelevasi (spec §6): fitur kota di dalam ring diklip/dibuang saat bake (mask.applyDistricts).
 * excludeIds dibaca dari `buildingsFile` (keluaran M3) bila ada; tanpa berkas → hanya aturan centroid.
 */
export const DISTRICTS = Object.freeze([
  Object.freeze({ id: 'unri', ring: UNRI_BOUNDARY, buildingsFile: 'public/districts/unri/buildings.json' }),
]);
```
Ganti `areaTiles` dan `areaFetchBBox` (termasuk komentarnya) dengan:
```js
/** Tile yang di-bake untuk kawasan (tile milik `skipAreas` dibuang). */
export function areaTiles(area, projection, size = TILE_SIZE, areas = AREAS) {
  const skip = new Set((area.skipAreas ?? []).flatMap((id) => {
    const other = areas[id];
    if (!other) throw new Error(`skipAreas area "${area.id}": area tidak dikenal "${id}"`);
    return tilesInRect(areaRect(other, projection), size).map((t) => t.key);
  }));
  return tilesInRect(areaRect(area, projection), size).filter((t) => !skip.has(t.key));
}

/**
 * Bbox lat/lon untuk fetch: gabungan batas tile kawasan + margin (m) agar fitur yang melintas tepi
 * ikut terambil. @returns {{south: number, west: number, north: number, east: number}}
 */
export function areaFetchBBox(area, projection, margin = 60, size = TILE_SIZE, areas = AREAS) {
  const tiles = areaTiles(area, projection, size, areas);
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

- [ ] **Step 4: Teks pemakaian CLI**

Di `tools/citybake/cli.js`, ganti baris komentar `node tools/citybake --area stadion|pusat|all …` menjadi `node tools/citybake --area stadion|pusat|unri|all …`, dan konstanta:
```js
export const USAGE = 'Pakai: node tools/citybake --area <stadion|pusat|unri|all> [--offline] [--no-overture] '
  + '[--overture-release <id>] [--out <dir>] [--cache <dir>]';
```

- [ ] **Step 5: Jalankan tes**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake`
Expected: semua PASS (pipeline belum memakai `DISTRICTS`, golden tetap identik).

- [ ] **Step 6: Commit**

```bash
git add tools/citybake/config.js tools/citybake/cli.js tests/citybake/config.test.js tests/citybake/cli.test.js
```
```bash
git commit -m "feat(citybake): area bake unri (skipAreas stadion) dan daftar DISTRICTS"
```

---

### Task 5: Pipeline citybake memakai distrik + golden

**Files:**
- Modify: `tools/citybake/pipeline.js`, `tests/citybake/golden.test.js`
- Test: `tests/citybake/goldenDistrict.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/citybake/goldenDistrict.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjection } from '../../src/geo/projection.js';
import { polygonArea } from '../../src/geo/polygon.js';
import { prepareFeatures, resolveDistricts, runBake } from '../../tools/citybake/pipeline.js';

const OSM = JSON.parse(readFileSync(new URL('./fixtures/osm-mini.json', import.meta.url), 'utf8'));
const OVERTURE = JSON.parse(readFileSync(new URL('./fixtures/overture-mini.geojson', import.meta.url), 'utf8'));
const ORIGIN = { lat: 0.4835954, lon: 101.3895277 };
const AREAS = { uji: { id: 'uji', name: 'Area uji', center: ORIGIN, halfSize: 250 } };
// Distrik uji (dunia) x −160…−40, z −245…160: air 3001, bangunan 1003, Overture ov-b di dalam; jalan 2001 (z 20)
// menyilang; bangunan 1004 (−200, −200) di luar tetapi masuk excludeIds.
const DISTRICT = { id: 'uji-distrik', ring: [[-160, -245], [-40, -245], [-40, 160], [-160, 160]], excludeIds: new Set(['w1004']) };
const quietLog = { info: () => {}, warn: () => {}, error: () => {} };
const proj = createProjection({ lat0: ORIGIN.lat, lon0: ORIGIN.lon });

describe('prepareFeatures dengan distrik', () => {
  const base = prepareFeatures({ rawOsm: OSM, overtureFc: OVERTURE, projection: proj, masks: [], districts: [] }).features;
  const { features } = prepareFeatures({ rawOsm: OSM, overtureFc: OVERTURE, projection: proj, masks: [], districts: [DISTRICT] });

  it('bangunan: centroid di dalam (1003, ov-b) & excludeIds (1004) dibuang', () => {
    const ids = features.filter((f) => f.kind === 'building').map((f) => f.id).sort();
    expect(ids).toEqual(['osm:relation/5001#0', 'osm:way/1001', 'osm:way/1002', 'overture:ov-d#0', 'overture:ov-d#1']);
  });

  it('air 3001 hilang; landuse 4001 jadi dua potongan, luas = asli − 120 × 30 m²', () => {
    expect(features.map((f) => f.id)).not.toContain('osm:way/3001');
    const lu = features.filter((f) => f.kind === 'landuse');
    expect(lu.map((f) => f.id)).toEqual(['osm:way/4001~c0', 'osm:way/4001~c1']);
    const before = polygonArea(base.find((f) => f.id === 'osm:way/4001').rings[0]);
    const after = lu.reduce((s, f) => s + polygonArea(f.rings[0]), 0);
    expect(Math.abs(before - after - 120 * 30)).toBeLessThan(5);
  });

  it('jalan 2001 terpotong tepat di x = −160 dan x = −40', () => {
    const parts = features.filter((f) => f.id.startsWith('osm:way/2001'));
    expect(parts.map((f) => f.id)).toEqual(['osm:way/2001~d0', 'osm:way/2001~d1']);
    expect(parts[0].line.at(-1)[0]).toBeCloseTo(-160, 6);
    expect(parts[1].line[0][0]).toBeCloseTo(-40, 6);
  });
});

describe('resolveDistricts', () => {
  it('excludeIds dari buildings.json; berkas tidak ada → Set kosong; excludeIds eksplisit dipakai apa adanya', async () => {
    const files = { 'a.json': JSON.stringify({ v: 1, buildings: [{ id: 'w1' }, { id: 'w2' }] }) };
    const read = async (p) => {
      if (files[p]) return files[p];
      const e = new Error('tidak ada');
      e.code = 'ENOENT';
      throw e;
    };
    const [a, b, c] = await resolveDistricts([
      { id: 'a', ring: [], buildingsFile: 'a.json' }, { id: 'b', ring: [], buildingsFile: 'b.json' }, DISTRICT,
    ], read);
    expect([...a.excludeIds]).toEqual(['w1', 'w2']);
    expect(b.excludeIds.size).toBe(0);
    expect(c).toBe(DISTRICT);
  });

  it('berkas rusak → galat jelas', async () => {
    await expect(resolveDistricts([{ id: 'a', ring: [], buildingsFile: 'x.json' }], async () => '{rusak'))
      .rejects.toThrow(/buildings distrik "a" rusak/);
  });
});

describe('runBake dengan distrik (data.json)', () => {
  let dir;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'citybake-distrik-'));
    await runBake({
      areaIds: ['uji'], outDir: dir, cacheDir: join(dir, 'cache'), areas: AREAS, masks: [], districts: [DISTRICT],
      origin: ORIGIN, release: '2026-09-23.1', log: quietLog, loaders: { osm: async () => OSM, overture: async () => OVERTURE },
    });
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('tile -1_0: jalan utama dua potongan berujung di batas distrik; bangunan 1003 & ov-b hilang', async () => {
    const d = JSON.parse(await readFile(join(dir, '-1_0.data.json'), 'utf8'));
    const primary = d.roads.filter((r) => r.cls === 'primary');
    // Pusat tile -1_0 = (−250, 250); x tile-lokal 0,1 m: −240 → 100, −160 → 900 | −40 → 2100, 0 → 2500.
    expect(primary.map((r) => [r.pts[0], r.pts.at(-2)])).toEqual([[100, 900], [2100, 2500]]);
    expect(d.buildings).toEqual([]);
  });

  it('tile -1_-1: air 3001 & bangunan 1004 hilang', async () => {
    const d = JSON.parse(await readFile(join(dir, '-1_-1.data.json'), 'utf8'));
    expect(d.water).toEqual([]);
    expect(d.buildings).toEqual([]);
  });
});
```
Di `tests/citybake/golden.test.js`, tambahkan `districts: [],` pada **kedua** pemanggilan `runBake` (tepat setelah `masks: MASKS,`). Alasan: default `DISTRICTS` (batas UNRI nyata) beririsan tile fixture `0_0`; golden lama menguji perilaku tanpa distrik.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/citybake/goldenDistrict.test.js`
Expected: FAIL — `resolveDistricts is not a function` / bangunan 1003 masih ada.

- [ ] **Step 3: Implementasi `pipeline.js`**

Ganti seluruh isi `tools/citybake/pipeline.js` dengan:
```js
/**
 * Orkestrasi bake: muat sumber → normalisasi → proyeksi → merge → tinggi → mask region → klip distrik
 * → partisi → bake tile → tulis file + manifest + atribusi. Loader dapat diinjeksi (golden test memakai fixture).
 */
import { Buffer } from 'node:buffer';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createProjection } from '../../src/geo/projection.js';
import { polygonCentroid } from '../../src/geo/polygon.js';
import {
  AREAS, BUDGET, DISTRICTS, ORIGIN, OVERTURE, PATHS, REGION_MASKS, TILE_SIZE, areaFetchBBox, areaRect, areaTiles,
} from './config.js';
import { loadOsm, normalizeOsm } from './fetchOsm.js';
import { loadOverture, normalizeOverture } from './fetchOverture.js';
import { projectFeatures } from './features.js';
import { mergeBuildings } from './merge.js';
import { estimateHeight } from './height.js';
import { createRoadLocator } from './roadLocator.js';
import { applyDistricts, applyMasks } from './mask.js';
import { partitionFeatures } from './partition.js';
import { bakeTile } from './bakeTile.js';
import { writeTileGlb } from './glb.js';
import {
  ATTRIBUTION_FILE, MANIFEST_FILE, assertCompatible, attributionText, createManifest, tileEntry, tileFiles, upsertArea,
} from './manifest.js';
import { summarize } from './report.js';

/**
 * Lengkapi excludeIds tiap distrik: pakai `excludeIds` bila sudah ada; selain itu baca `buildingsFile`
 * ({buildings:[{id:'w123'}]}, keluaran M3). Berkas tidak ada → Set kosong (hanya aturan centroid).
 * @param {Array<{id:string, ring:Array<[number,number]>, excludeIds?:Set<string>, buildingsFile?:string}>} districts
 * @param {(path: string) => Promise<string>} [read]
 */
export async function resolveDistricts(districts, read = (path) => readFile(path, 'utf8')) {
  const out = [];
  for (const d of districts) {
    if (d.excludeIds) {
      out.push(d);
      continue;
    }
    let excludeIds = new Set();
    if (d.buildingsFile) {
      try {
        const json = JSON.parse(await read(d.buildingsFile));
        excludeIds = new Set((json.buildings ?? []).map((b) => b.id));
      } catch (err) {
        if (err.code !== 'ENOENT') {
          throw new Error(`buildings distrik "${d.id}" rusak (${d.buildingsFile}): ${err.message}`, { cause: err });
        }
      }
    }
    out.push({ ...d, excludeIds });
  }
  return out;
}

/**
 * Fitur dunia siap partisi untuk satu area.
 * @returns {{features: object[], osmTimestamp: string|null, mergeStats: object}}
 */
export function prepareFeatures({ rawOsm, overtureFc, projection, masks, districts = [] }) {
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
  const masked = applyMasks([...withHeight, ...others], masks.map((m) => m.ring));
  const features = applyDistricts(masked, districts);
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
 *   release?: string, areas?: object, masks?: Array<{id: string, ring: Array<[number, number]>}>,
 *   districts?: Array<{id: string, ring: Array<[number, number]>, excludeIds?: Set<string>, buildingsFile?: string}>,
 *   origin?: {lat: number, lon: number}, size?: number, log?: Console, loaders?: {osm: Function, overture: Function}}} opts
 * @returns {Promise<{manifest: object, report: {lines: string[], warnings: string[]}, stats: object}>}
 */
export async function runBake({
  areaIds, outDir = PATHS.outDir, cacheDir = PATHS.cacheDir, offline = false, useOverture = true,
  release = OVERTURE.release, areas = AREAS, masks = REGION_MASKS, districts = DISTRICTS, origin = ORIGIN,
  size = TILE_SIZE, log = console, loaders = { osm: loadOsm, overture: loadOverture },
}) {
  const projection = createProjection({ lat0: origin.lat, lon0: origin.lon });
  await mkdir(outDir, { recursive: true });
  const fresh = createManifest({ origin, tileSize: size });
  const existing = await readManifest(outDir);
  if (existing) assertCompatible(existing, fresh);
  let manifest = existing ?? fresh;
  const resolved = await resolveDistricts(districts);
  const stats = {};
  for (const id of areaIds) {
    const area = areas[id];
    if (!area) throw new Error(`area tidak dikenal: "${id}" (pilihan: ${Object.keys(areas).join(', ')})`);
    const bbox = areaFetchBBox(area, projection, 60, size, areas);
    const rawOsm = await loaders.osm(id, bbox, { cacheDir, offline, log });
    const overtureFc = useOverture ? await loaders.overture(id, bbox, { cacheDir, offline, release, log }) : null;
    const prepared = prepareFeatures({ rawOsm, overtureFc, projection, masks, districts: resolved });
    const baked = await bakeAreaTiles(prepared.features, areaTiles(area, projection, size, areas), size);
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

- [ ] **Step 4: Jalankan tes citybake**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/citybake
npm run lint
```
Expected: semua PASS (golden lama tetap identik karena `districts: []`); lint 0 galat.

- [ ] **Step 5: Commit**

```bash
git add tools/citybake/pipeline.js tests/citybake/golden.test.js tests/citybake/goldenDistrict.test.js
```
```bash
git commit -m "feat(citybake): pipeline menerapkan distrik (excludeIds dari buildings.json) + golden distrik"
```

---

### Task 6: Bake ulang tile kota (area `unri` + klip distrik) dan fakta OSM

**Files:**
- Modify: `tests/osmFacts.test.js`
- Modify (hasil bake): `public/tiles/manifest.json`, `public/tiles/ATTRIBUTION.txt`, `public/tiles/*.lod0.glb|*.lod1.glb|*.data.json`

- [ ] **Step 1: Tulis fakta klip yang gagal (sebelum bake ulang)**

Ganti seluruh isi `tests/osmFacts.test.js` dengan:
```js
/**
 * Fakta OSM yang mendasari keputusan konten (dibaca dari tile yang di-commit, OSM 2026-10-16).
 * Bila bake baru mengubah fakta ini, tes gagal dan keputusan terkait harus ditinjau ulang (fakta mengalahkan gaya).
 * - Blok "kawasan stadion": dasar keputusan I4 (Plan C).
 * - Blok "klip distrik UNRI": DIPERBARUI SENGAJA di M2 (2026-10-17) — citybake kini mengklip kota terhadap
 *   UNRI_BOUNDARY (spec §6): gedung kampus, landuse/air, dan jalan di dalam distrik bukan lagi milik tile kota,
 *   melainkan distrik (public/districts/unri). Area bake baru `unri` menambah tile tepi barat/selatan.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { distanceToRing, pointInPolygon, polygonCentroid } from '../src/geo/polygon.js';
import { UNRI_BOUNDARY } from '../src/districts/unri/boundary.js';

const manifest = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
const load = (area) => manifest.tiles.filter((t) => t.area === area)
  .map((t) => JSON.parse(readFileSync(`public/tiles/${t.data.file}`, 'utf8')));
const tiles = load('stadion');
const kampusTiles = [...tiles, ...load('unri')];

/** Array datar tile-lokal (0,1 m) → titik dunia. */
const toPoints = (d, flat) => {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push([d.center[0] + flat[i] * d.unit, d.center[1] + flat[i + 1] * d.unit]);
  return out;
};
const roads = tiles.flatMap((d) => d.roads.map((r) => ({ ...r, pts: toPoints(d, r.pts) })));
const water = tiles.flatMap((d) => d.water.map((w) => toPoints(d, w.rings[0])));
const waterways = tiles.flatMap((d) => d.waterways.map((w) => toPoints(d, w.pts)));

describe('fakta OSM kawasan stadion (dasar keputusan I4)', () => {
  it('Jl. Naga Sakti nyata (primary) berada di z −475…−440 pada |x| ≤ 300 — bukan z −390 seperti versi handmade', () => {
    const pts = roads.filter((r) => r.name === 'Jalan Naga Sakti').flatMap((r) => r.pts).filter(([x]) => Math.abs(x) <= 300);
    expect(pts.length).toBeGreaterThan(4);
    for (const [, z] of pts) {
      expect(z).toBeGreaterThan(-475);
      expect(z).toBeLessThan(-440);
    }
  });

  it('dua danau OSM di utara stadion (way 419836906 ≈ (−192, −290), way 327378220 ≈ (119, −384))', () => {
    const cs = water.map((r) => polygonCentroid(r));
    for (const [x, z] of [[-192, -290], [119, -384]]) {
      expect(cs.some((c) => Math.hypot(c.x - x, c.z - z) < 15)).toBe(true);
    }
  });

  it('tidak ada air di posisi danau handmade (−60, −480)', () => {
    expect(water.some((r) => pointInPolygon(-60, -480, r))).toBe(false);
    expect(water.map((r) => polygonCentroid(r)).some((c) => Math.hypot(c.x + 60, c.z + 480) < 100)).toBe(false);
  });

  it('tidak ada sungai/parit di jalur sungai handmade (x 300…360, z −300…300)', () => {
    const hit = waterways.flatMap((l) => l).some(([x, z]) => x > 300 && x < 360 && z > -300 && z < 300);
    expect(hit).toBe(false);
  });
});

describe('fakta klip distrik UNRI (M2): kota tidak menimpa distrik', () => {
  /** Di dalam distrik dan > 0,25 m dari tepi (toleransi kuantisasi 0,1 m tile). */
  const strictlyInside = ([x, z]) => pointInPolygon(x, z, UNRI_BOUNDARY) && distanceToRing(x, z, UNRI_BOUNDARY) > 0.25;

  it('manifest memuat area unri yang tilenya tidak beririsan dengan area stadion', () => {
    const unri = manifest.areas.find((a) => a.id === 'unri');
    expect(unri).toBeDefined();
    const stadion = new Set(manifest.areas.find((a) => a.id === 'stadion').tiles);
    expect(unri.tiles.length).toBeGreaterThan(0);
    expect(unri.tiles.some((k) => stadion.has(k))).toBe(false);
  });

  it('tidak ada bangunan kota bercentroid di dalam distrik (Rektorat, Masjid Arfa\'unnas, GGM milik distrik)', () => {
    const hits = kampusTiles.flatMap((d) => d.buildings.map((b) => polygonCentroid(toPoints(d, b.ring))))
      .filter((c) => pointInPolygon(c.x, c.z, UNRI_BOUNDARY));
    expect(hits).toEqual([]);
  });

  it('tidak ada titik jalan / air / sungai kota di dalam distrik', () => {
    const pts = kampusTiles.flatMap((d) => [
      ...d.roads.flatMap((r) => toPoints(d, r.pts)),
      ...d.water.flatMap((w) => w.rings.flatMap((r) => toPoints(d, r))),
      ...d.waterways.flatMap((w) => toPoints(d, w.pts)),
    ]);
    expect(pts.filter(strictlyInside)).toEqual([]);
  });
});
```

- [ ] **Step 2: Pastikan blok baru gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/osmFacts.test.js`
Expected: blok "kawasan stadion" PASS (4); blok "klip distrik" FAIL (area `unri` tidak ada, ratusan bangunan & ribuan titik jalan di dalam distrik).

- [ ] **Step 3: Bake area `unri` (online, sekali)**

Run (5–12 menit: Overpass + Overture DuckDB):
```bash
npm run bake -- --area unri
```
Expected (urutan): `[citybake] mengambil OSM "unri" dari Overpass…`, `[citybake] query Overture 2026-09-23.1 untuk "unri" (DuckDB, beberapa menit)…`, `Area unri: N tile, X MB` dengan N ≤ 16 (tile kosong tidak ditulis), daftar tile, `Total manifest: …`, **tanpa** baris `PERINGATAN`. Cache baru: `data-src/osm/unri.json`, `data-src/overture/unri.geojson`. Bila Overture gagal, pesan `Overture gagal … lanjut OSM saja` dapat diterima (atribusi mencatat `tanpa Overture`).

Verifikasi cakupan cache:
```bash
node -e "const o=require('./data-src/osm/unri.json');console.log(o.elements.length, o.elements.some(e=>e.id===938374562), o.osm3s.timestamp_osm_base)"
```
Expected: ribuan elemen, `true`, stempel waktu OSM.

- [ ] **Step 4: Bake ulang semua area offline, dua kali, harus byte-identik**

Run:
```bash
npm run bake -- --area all --offline
sha1sum public/tiles/*.glb public/tiles/*.json public/tiles/ATTRIBUTION.txt > /tmp/tiles-1.sha
npm run bake -- --area all --offline
sha1sum public/tiles/*.glb public/tiles/*.json public/tiles/ATTRIBUTION.txt | diff - /tmp/tiles-1.sha && echo IDENTIK
git status --porcelain public/tiles | grep -cE "public/tiles/1[2-5]_-"
```
Expected: dua bake tanpa `PERINGATAN` (budget tile ≤ 300 KB LOD0+data, total ≤ 20 MB); `IDENTIK`; hitungan berkas pusat yang berubah = `0` (cache pusat tanpa level rentang & jauh dari distrik). Berkas stadion yang berubah hanya tile yang beririsan distrik (lihat "Fakta data").

- [ ] **Step 5: Fakta lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/osmFacts.test.js tests/citybake`
Expected: semua PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/osmFacts.test.js public/tiles
```
```bash
git commit -m "feat(tiles): bake ulang kota dengan klip distrik UNRI + area unri; fakta OSM klip distrik"
```

---

### Task 7: campusbake ground — konstanta & sumber data

**Files:**
- Create: `tools/campusbake/ground/constants.js`, `tools/campusbake/ground/sources.js`
- Test: `tests/campusbake/groundSources.test.js`

- [ ] **Step 1: Konstanta**

`tools/campusbake/ground/constants.js`:
```js
/**
 * Konstanta bake tanah & jalan kampus (M2). Aturan berlabel [INFERENSI] bukan fakta OSM/riset dan dapat
 * diubah tanpa mengubah format. Satuan meter kecuali disebut.
 */
export const GROUND_FORMAT = Object.freeze({ v: 1, unit: 0.1, roadClipMargin: 16 });

export const GROUND_PATHS = Object.freeze({
  osmCache: 'data-src/osm/unri.json', // cache citybake area "unri" (plan M2 Task 6)
  districtDir: 'public/districts/unri',
  groundDir: 'public/districts/unri/ground',
});

/** Peringatan laporan bila total berkas ground melebihi ini (budget data distrik spec §9.1 = 8 MB total). */
export const GROUND_BUDGET_BYTES = 3 * 1024 * 1024;

/** Kelas highway yang digambar sebagai aspal ter-drape (lebar dari ROAD_CLASSES citybake). */
export const VEHICLE_CLASSES = Object.freeze([
  'primary', 'secondary', 'tertiary', 'primary_link', 'secondary_link', 'tertiary_link',
  'unclassified', 'residential', 'living_street', 'service',
]);
/** Kelas pejalan kaki yang digambar sebagai beton ter-drape. */
export const WALK_CLASSES = Object.freeze(['footway', 'pedestrian', 'steps', 'cycleway']);
/** Jalan tanah: tidak di-drape, menjadi bobot "soil" permukaan. */
export const SOIL_PATH_CLASSES = Object.freeze(['path', 'track']);

/**
 * Jalur searah (oneway=yes) kelas besar di kampus = satu sisi jalur ganda 2 lajur (foto drone 2016:
 * "aspal 2 lajur searah"): lebar = lebar kelas × faktor [INFERENSI: 10 m × 0,7 = 7 m].
 */
export const ONEWAY = Object.freeze({ classes: Object.freeze(['primary', 'secondary', 'tertiary']), factor: 0.7 });

/** Tumpang di batas distrik: jalan kendaraan w/2 + roadExtra, trotoar `walk` (menutup ujung jalan kota). */
export const OVERLAP = Object.freeze({ roadExtra: 2, walk: 1 });

/** Muka air (spec §5.2.8): tanah terendah di tepi − drop; "dipahat" bila dasar < muka − carvedMin. */
export const WATER = Object.freeze({ drop: 0.4, carvedMin: 0.3, edgeStep: 2, gridStep: 4 });

/**
 * Parit tepi jalan utama [INFERENSI pola kampus Pekanbaru, spec §5.2.8]: lebar 1,0 m; garis tengah di
 * w/2 + bahu 1,5 + jarak 1,0 + ½ lebar 0,5 = w/2 + 3,0 m dari sumbu jalan. Sama dengan konstanta parit M1
 * (diperiksa di Task 0). `osmWidth` = lebar parit OSM (WATERWAY_WIDTHS.ditch citybake).
 */
export const DITCH = Object.freeze({
  enabled: true, classes: Object.freeze(['tertiary', 'tertiary_link']), width: 1.0, centerOffset: 3.0,
  step: 1, minRun: 4, clearRoad: 1.5, clearWalk: 0.5, clearBuilding: 1, osmWidth: 1.5,
});

/** Bobot permukaan per sampel grid 4 m (spec §5.3). Nilai landcover [INFERENSI visual]. */
export const SURFACE_RULES = Object.freeze({
  landcover: Object.freeze({
    bare: Object.freeze({ soil: 1 }),
    wetland: Object.freeze({ wet: 0.75 }),
    farmland: Object.freeze({ soil: 0.8 }),
    sawit: Object.freeze({ soil: 0.5 }),
    orchard: Object.freeze({ soil: 0.45 }),
    forest: Object.freeze({ soil: 0.35 }),
    park: Object.freeze({}),
    grass: Object.freeze({}),
  }),
  /** Prioritas tumpang-tindih landcover (pertama menang). */
  priority: Object.freeze(['bare', 'wetland', 'farmland', 'sawit', 'orchard', 'forest', 'park', 'grass']),
  shoulder: Object.freeze({ classes: Object.freeze(['tertiary', 'tertiary_link', 'residential', 'service']), width: 1.5, soil: 0.35 }),
  soilPath: Object.freeze({ feather: 1.5 }),
  waterBank: Object.freeze({ width: 6 }),
  ditch: Object.freeze({ width: 2, wet: 0.8 }),
  steep: Object.freeze({ grade: 0.25, soil: 0.4 }),
});

/** Spesies vegetasi (urutan = urutan di ground JSON). Katalog: V01, V02, V03, V06, V07. */
export const VEG_SPECIES = Object.freeze(['mahoni', 'angsana', 'saga', 'sawit', 'semak']);

/**
 * Penempatan vegetasi. Komposisi peneduh dari riset (mahoni dominan, angsana, saga — [T]); jarak tanam &
 * proporsi [INFERENSI]. Sawit: pola segitiga 9 m (standar kebun sawit). Pohon tepi jalan 5 m dari tepi
 * aspal (di luar parit yang 2,5–3,5 m dari tepi).
 */
export const VEG = Object.freeze({
  forest: Object.freeze({ spacing: 16, jitter: 0.35, mix: Object.freeze([['mahoni', 0.5], ['angsana', 0.3], ['saga', 0.2]]) }),
  park: Object.freeze({ spacing: 24, jitter: 0.4, keep: 0.6, mix: Object.freeze([['angsana', 0.45], ['mahoni', 0.35], ['saga', 0.2]]) }),
  grass: Object.freeze({ spacing: 30, jitter: 0.45, keep: 0.25, mix: Object.freeze([['saga', 0.5], ['angsana', 0.5]]) }),
  orchard: Object.freeze({ spacing: 12, jitter: 0.15, mix: Object.freeze([['saga', 1]]) }), // kebun tanpa spesies OSM → pohon buah [INFERENSI]
  sawit: Object.freeze({ spacing: 9 }),
  shrubPark: Object.freeze({ spacing: 12, jitter: 0.45, keep: 0.4, mix: Object.freeze([['semak', 1]]) }),
  shrubParking: Object.freeze({ spacing: 6, offset: 1.2 }),
  street: Object.freeze({
    spacing: 14, offset: 5, classes: Object.freeze(['tertiary', 'tertiary_link', 'residential']),
    mix: Object.freeze([['mahoni', 0.5], ['angsana', 0.3], ['saga', 0.2]]),
  }),
  clear: Object.freeze({ road: 1.5, walk: 1, building: 3, water: 2 }),
  maxGrade: 0.35,
});

/** Props kampus (P03 PJU, P04 bangku, P05 tong sampah). Jarak [INFERENSI]. */
export const PROPS = Object.freeze({
  lamp: Object.freeze({ spacing: Object.freeze({ tertiary: 35, tertiary_link: 35, residential: 40, service: 50 }), offset: 1.0 }),
  bench: Object.freeze({ spacing: 30, offset: 1.6, minWalk: 20 }),
  bin: Object.freeze({ every: 2, along: 1.4 }),
  clear: Object.freeze({ road: 0.8, walk: 0.5, building: 1.5, water: 1 }),
});
```

- [ ] **Step 2: Tulis tes sumber yang gagal**

`tests/campusbake/groundSources.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjection } from '../../src/geo/projection.js';
import { WORLD_ORIGIN } from '../../src/config/constants.js';
import { N } from '../../src/geo/terrain/format.js';
import { chunkHeader, loadOsmSource, loadTerrainField, projectOsm } from '../../tools/campusbake/ground/sources.js';

const proj = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });
const LL = (x, z) => { const p = proj.toLatLon(x, z); return { lat: p.lat, lon: p.lon }; };

describe('chunkHeader', () => {
  it('header chunk dari kunci (spec §4.1)', () => {
    expect(chunkHeader('-2_1')).toEqual({
      key: '-2_1', ix: -2, iz: 1, origin: { x: -1000, z: 500 }, size: 500, step: 4, n: 126, unit: 0.01, bias: -5000,
    });
    expect(() => chunkHeader('x')).toThrow(/tidak valid/);
  });
});

describe('projectOsm', () => {
  it('fitur citybake terproyeksi + plaza dari highway=pedestrian area=yes', () => {
    const raw = {
      osm3s: { timestamp_osm_base: '2026-10-17T00:00:00Z' },
      elements: [
        { type: 'way', id: 1, tags: { highway: 'tertiary' }, geometry: [LL(0, 0), LL(100, 0)] },
        { type: 'way', id: 2, tags: { highway: 'pedestrian', area: 'yes' }, geometry: [LL(0, 0), LL(20, 0), LL(20, 20), LL(0, 20), LL(0, 0)] },
      ],
    };
    const { features, plazas, timestamp } = projectOsm(raw, proj);
    expect(timestamp).toBe('2026-10-17T00:00:00Z');
    expect(features.map((f) => f.id)).toEqual(['osm:way/1']);
    expect(features[0].line[1][0]).toBeCloseTo(100, 3);
    expect(plazas).toHaveLength(1);
    expect(plazas[0].id).toBe('osm:way/2');
    expect(plazas[0].rings[0]).toHaveLength(4);
  });
});

describe('loadOsmSource / loadTerrainField', () => {
  let dir;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'campusbake-src-'));
    await mkdir(join(dir, 'terrain'), { recursive: true });
    const u16 = new Uint16Array(N * N).fill(5100); // y = (5100 − 5000) × 0,01 = 1 m
    await writeFile(join(dir, 'terrain', '0_0.bin'), Buffer.from(u16.buffer));
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({ format: 'unri-district', version: 1, terrain: { chunks: ['0_0'] } }));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('heightfield dari berkas .bin + manifest', async () => {
    const { keys, field } = await loadTerrainField(dir);
    expect(keys).toEqual(['0_0']);
    expect(field.heightAt(250, 250)).toBeCloseTo(1, 6);
  });

  it('cache OSM tidak ada → galat berisi langkah perbaikan', async () => {
    await expect(loadOsmSource(join(dir, 'tidak-ada.json'))).rejects.toThrow(/npm run bake -- --area unri/);
  });

  it('manifest tanpa terrain.chunks → galat jelas', async () => {
    const d2 = await mkdtemp(join(tmpdir(), 'campusbake-src2-'));
    await writeFile(join(d2, 'manifest.json'), JSON.stringify({ terrain: { chunks: [] } }));
    await expect(loadTerrainField(d2)).rejects.toThrow(/terrain.chunks/);
    await rm(d2, { recursive: true, force: true });
  });
});
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/groundSources.test.js`
Expected: FAIL — modul `sources.js` tidak ada.

- [ ] **Step 4: Implementasi `sources.js`**

```js
/**
 * Sumber data bake ground: cache OSM kampus (citybake area "unri") dan heightfield hasil bake terrain M1.
 * I/O di sini saja; sisanya murni.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeOsm } from '../../citybake/fetchOsm.js';
import { projectFeatures } from '../../citybake/features.js';
import { cleanRing } from '../../../src/geo/polygon.js';
import { parseTileKey } from '../../../src/geo/tiles.js';
import { createHeightField, decodeChunk } from '../../../src/geo/terrain/heightfield.js';
import { BIAS, CHUNK_SIZE, N, STEP, UNIT } from '../../../src/geo/terrain/format.js';

/** Muat JSON Overpass mentah dari cache; tanpa cache → galat berisi langkah unduh (spec §10). */
export async function loadOsmSource(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`cache OSM kampus tidak ada: ${path}. Jalankan dulu (online, sekali): npm run bake -- --area unri`, { cause: err });
    }
    throw new Error(`cache OSM kampus rusak (${path}): ${err.message}`, { cause: err });
  }
}

const isPlazaWay = (el) => el.type === 'way' && el.tags && Array.isArray(el.geometry) && el.geometry.length >= 4
  && ((el.tags.highway === 'pedestrian' && el.tags.area === 'yes') || el.tags.place === 'square');

/**
 * Fitur citybake ter-normalisasi & terproyeksi (dunia) + plaza (way pejalan kaki berbentuk area, yang
 * dibuang normalizeOsm) + stempel waktu OSM.
 */
export function projectOsm(raw, projection) {
  const { features, timestamp } = normalizeOsm(raw);
  const plazas = raw.elements.filter(isPlazaWay).map((el) => ({
    id: `osm:way/${el.id}`,
    rings: [cleanRing(el.geometry.map((p) => {
      const w = projection.toWorld(p.lat, p.lon);
      return [w.x, w.z];
    }), 1e-3)],
  })).filter((p) => p.rings[0].length >= 3);
  return { features: projectFeatures(features, projection), plazas, timestamp };
}

/** Header chunk terrain (spec §4.1) dari kunci "ix_iz". */
export function chunkHeader(key) {
  const t = parseTileKey(key);
  if (!t) throw new Error(`kunci chunk terrain tidak valid: "${key}"`);
  return {
    key, ix: t.ix, iz: t.iz, origin: { x: t.ix * CHUNK_SIZE, z: t.iz * CHUNK_SIZE },
    size: CHUNK_SIZE, step: STEP, n: N, unit: UNIT, bias: BIAS,
  };
}

/** HeightField dari `<districtDir>/manifest.json` + `terrain/<key>.bin` (hasil `bake:campus -- terrain`). */
export async function loadTerrainField(districtDir) {
  const manifest = JSON.parse(await readFile(join(districtDir, 'manifest.json'), 'utf8'));
  const keys = manifest?.terrain?.chunks;
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error(`manifest distrik tanpa terrain.chunks (${districtDir}) — jalankan npm run bake:campus -- terrain dulu`);
  }
  const field = createHeightField();
  for (const key of keys) {
    const buf = await readFile(join(districtDir, 'terrain', `${key}.bin`));
    field.add(decodeChunk(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), chunkHeader(key)));
  }
  return { manifest, keys: [...keys], field };
}
```

- [ ] **Step 5: Jalankan tes; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/campusbake/groundSources.test.js
npm run lint
```
Expected: 5 tes PASS; lint 0 galat.

- [ ] **Step 6: Commit**

```bash
git add tools/campusbake/ground/constants.js tools/campusbake/ground/sources.js tests/campusbake/groundSources.test.js
```
```bash
git commit -m "feat(campusbake): konstanta & sumber data bake ground (cache OSM unri, heightfield M1)"
```

---

### Task 8: Indeks spasial & ekstraksi ground

**Files:**
- Create: `tools/campusbake/ground/spatial.js`, `tools/campusbake/ground/extract.js`
- Create: `tests/campusbake/groundFixture.js`
- Test: `tests/campusbake/groundExtract.test.js`

- [ ] **Step 1: Fixture bersama (dipakai Task 8–12)**

`tests/campusbake/groundFixture.js`:
```js
/**
 * Fixture bake ground (koordinat dunia). Batas distrik uji = persegi 0…400 (di chunk 0_0); jalan tersier
 * z = 200 menembus batas di x = 0 dan x = 400. Heightfield datar 0, kecuali dasar kolam (42…78)² = −1,5 m.
 */
const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const f = (id, kind, cls, geom, tags = {}) => ({ id: `osm:way/${id}`, source: 'osm', kind, cls, tags, ...geom });

export const BOUNDARY = sq(0, 0, 400, 400);

export const FEATURES = [
  f(1, 'road', 'tertiary', { line: [[-50, 200], [450, 200]] }, { highway: 'tertiary' }),
  f(2, 'road', 'footway', { line: [[100, 50], [100, 350]] }, { highway: 'footway' }),
  f(3, 'road', 'service', { line: [[100, 0], [100, 30]] }, { highway: 'service', service: 'parking_aisle' }),
  f(4, 'road', 'footway', { line: [[50, 60], [70, 60]] }, { highway: 'footway', bridge: 'yes' }),
  f(5, 'road', 'path', { line: [[300, 300], [380, 300]] }, { highway: 'path' }),
  f(6, 'landuse', 'parking', { rings: [sq(250, 250, 300, 300)] }, { amenity: 'parking' }),
  f(7, 'water', 'water', { rings: [sq(40, 40, 80, 80)] }, { natural: 'water' }),
  f(8, 'landuse', 'pitch', { rings: [sq(150, 250, 200, 290)] }, { leisure: 'pitch' }),
  f(9, 'landuse', 'pitch', { rings: [sq(210, 320, 240, 360)] }, { leisure: 'stadium' }),
  f(10, 'landuse', 'forest', { rings: [sq(300, 20, 390, 120)] }, { natural: 'wood' }),
  f(11, 'landuse', 'farmland', { rings: [sq(20, 300, 120, 390)] }, { landuse: 'orchard', trees: 'oil_palms' }),
  f(12, 'building', 'yes', { rings: [sq(150, 100, 170, 120)] }, { building: 'yes' }),
  f(13, 'waterway', 'ditch', { line: [[200, 20], [200, 120]] }, { waterway: 'ditch' }),
  f(14, 'landuse', 'park', { rings: [sq(-50, 450, 50, 480)] }, { leisure: 'park' }),
];

export const PLAZAS = [{ id: 'osm:way/15', rings: [sq(320, 220, 360, 240)] }];

export const FIELD = Object.freeze({
  heightAt: (x, z) => (x > 42 && x < 78 && z > 42 && z < 78 ? -1.5 : 0),
  normalAt: (x, z, out = { x: 0, y: 1, z: 0 }) => Object.assign(out, { x: 0, y: 1, z: 0 }),
});
```

- [ ] **Step 2: Tulis tes yang gagal**

`tests/campusbake/groundExtract.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createAreaIndex, createLineIndex, samplesAlong } from '../../tools/campusbake/ground/spatial.js';
import { extractGround, landcoverKind, roadWidth } from '../../tools/campusbake/ground/extract.js';
import { BOUNDARY, FEATURES, PLAZAS } from './groundFixture.js';

describe('spatial', () => {
  it('nearest: jarak ke tepi pita (negatif di atas pita); di luar reach → Infinity', () => {
    const idx = createLineIndex([{ id: 'a', w: 10, line: [[0, 0], [100, 0]] }], { reach: 5 });
    expect(idx.nearest(50, 8).d).toBeCloseTo(3, 9);
    expect(idx.nearest(50, 2).d).toBeCloseTo(-3, 9);
    expect(idx.nearest(50, 30).d).toBe(Infinity);
  });

  it('contains: lubang dihormati, urutan penyisipan = prioritas; edgeDistance', () => {
    const a = { id: 'a', rings: [[[0, 0], [10, 0], [10, 10], [0, 10]], [[4, 4], [6, 4], [6, 6], [4, 6]]] };
    const b = { id: 'b', rings: [[[0, 0], [20, 0], [20, 20], [0, 20]]] };
    const idx = createAreaIndex([a, b], { reach: 5 });
    expect(idx.contains(2, 2).id).toBe('a');
    expect(idx.contains(5, 5).id).toBe('b');
    expect(idx.contains(30, 30)).toBeNull();
    expect(idx.edgeDistance(22, 10, (it) => it.id === 'b')).toBeCloseTo(2, 9);
  });

  it('samplesAlong: spasi & fase melewati simpul', () => {
    const pts = samplesAlong([[0, 0], [10, 0], [10, 10]], 4, 2);
    expect(pts.map((p) => [p.x, p.z])).toEqual([[2, 0], [6, 0], [10, 0], [10, 4], [10, 8]]);
    expect(pts[3]).toMatchObject({ tx: 0, tz: 1 });
  });
});

describe('roadWidth / landcoverKind', () => {
  it('lebar: tabel citybake; searah kelas besar × 0,7; tag width menang', () => {
    expect(roadWidth('tertiary', {})).toBe(10);
    expect(roadWidth('tertiary', { oneway: 'yes' })).toBeCloseTo(7, 9);
    expect(roadWidth('service', { oneway: 'yes' })).toBe(4.5);
    expect(roadWidth('tertiary', { width: '6,5' })).toBe(6.5);
  });

  it('sawit dari trees/genus/nama; kebun; hutan; tak dikenal → null', () => {
    expect(landcoverKind({ cls: 'farmland', tags: { landuse: 'orchard', trees: 'oil_palms' } })).toBe('sawit');
    expect(landcoverKind({ cls: 'farmland', tags: { landuse: 'farmland', genus: 'Elaeis' } })).toBe('sawit');
    expect(landcoverKind({ cls: 'farmland', tags: { landuse: 'orchard', name: 'Kebun Sawit' } })).toBe('sawit');
    expect(landcoverKind({ cls: 'farmland', tags: { landuse: 'orchard' } })).toBe('orchard');
    expect(landcoverKind({ cls: 'forest', tags: { natural: 'wood' } })).toBe('forest');
    expect(landcoverKind({ cls: 'construction', tags: { landuse: 'brownfield' } })).toBe('bare');
    expect(landcoverKind({ cls: 'education', tags: { amenity: 'university' } })).toBeNull();
  });
});

describe('extractGround (fixture)', () => {
  const E = extractGround({ features: FEATURES, plazas: PLAZAS }, BOUNDARY);

  it('jalan kendaraan: bagian dalam + tumpang w/2 + 2 = 7 m; parking_aisle dilewati', () => {
    expect(E.roads).toHaveLength(1);
    expect(E.roads[0]).toMatchObject({ id: 'osm:way/1', cls: 'tertiary', w: 10 });
    expect(E.roads[0].line[0][0]).toBeCloseTo(-7, 9);
    expect(E.roads[0].line.at(-1)[0]).toBeCloseTo(407, 9);
  });

  it('trotoar (jembatan dilewati), jalan tanah, parit OSM', () => {
    expect(E.walks.map((w) => w.id)).toEqual(['osm:way/2']);
    expect(E.walks[0].line).toEqual([[100, 50], [100, 350]]);
    expect(E.soilPaths.map((w) => [w.id, w.cls])).toEqual([['osm:way/5', 'path']]);
    expect(E.waterLines.map((w) => [w.id, w.w])).toEqual([['osm:way/13', 1.5]]);
  });

  it('area: parkir, air, lapangan (bukan stadium), plaza; landcover di dalam distrik saja', () => {
    expect(E.areas.map((a) => [a.id, a.kind])).toEqual([
      ['osm:way/6', 'parking'], ['osm:way/7', 'water'], ['osm:way/8', 'pitch'], ['osm:way/15', 'plaza'],
    ]);
    expect(E.landcover.map((c) => [c.id, c.kind])).toEqual([['osm:way/10', 'forest'], ['osm:way/11', 'sawit']]);
    expect(E.buildings.map((b) => b.id)).toEqual(['osm:way/12']);
  });
});
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/groundExtract.test.js`
Expected: FAIL — modul `spatial.js`/`extract.js` tidak ada.

- [ ] **Step 4: Implementasi `spatial.js`**

```js
/**
 * Indeks grid sederhana untuk kueri jarak/isi saat bake ground (murni, deterministik: urutan kandidat =
 * urutan penyisipan). Jarak hanya akurat sampai `reach` m dari bentuk; di luar itu Infinity.
 */
import { distanceToRing, distanceToSegment, pointInPolygon, ringBounds } from '../../../src/geo/polygon.js';

function createGrid(cell) {
  const cells = new Map();
  const keyOf = (cx, cz) => `${cx},${cz}`;
  return {
    insert(b, item) {
      for (let cz = Math.floor(b.minZ / cell); cz <= Math.floor(b.maxZ / cell); cz += 1) {
        for (let cx = Math.floor(b.minX / cell); cx <= Math.floor(b.maxX / cell); cx += 1) {
          const k = keyOf(cx, cz);
          let list = cells.get(k);
          if (!list) cells.set(k, (list = []));
          list.push(item);
        }
      }
    },
    at: (x, z) => cells.get(keyOf(Math.floor(x / cell), Math.floor(z / cell))) ?? [],
  };
}

const pad = (b, r) => ({ minX: b.minX - r, minZ: b.minZ - r, maxX: b.maxX + r, maxZ: b.maxZ + r });

/**
 * Pita polyline berlebar: items [{line, w, ...}]. nearest(x, z) → {d, item}: d = jarak ke TEPI pita terdekat
 * (negatif = di atas pita), Infinity bila tak ada pita dalam `reach`.
 */
export function createLineIndex(items, { cell = 25, reach = 10 } = {}) {
  const grid = createGrid(cell);
  for (const item of items) {
    for (let i = 0; i < item.line.length - 1; i += 1) {
      const a = item.line[i];
      const b = item.line[i + 1];
      const box = { minX: Math.min(a[0], b[0]), minZ: Math.min(a[1], b[1]), maxX: Math.max(a[0], b[0]), maxZ: Math.max(a[1], b[1]) };
      grid.insert(pad(box, item.w / 2 + reach), { item, a, b });
    }
  }
  return {
    nearest(x, z) {
      let best = { d: Infinity, item: null };
      for (const s of grid.at(x, z)) {
        const d = distanceToSegment(x, z, s.a, s.b) - s.item.w / 2;
        if (d < best.d) best = { d, item: s.item };
      }
      return best;
    },
  };
}

/** Poligon [{rings, ...}] (ring luar + lubang). */
export function createAreaIndex(items, { cell = 50, reach = 10 } = {}) {
  const grid = createGrid(cell);
  for (const item of items) grid.insert(pad(ringBounds(item.rings[0]), reach), item);
  const inside = (item, x, z) => pointInPolygon(x, z, item.rings[0])
    && !item.rings.slice(1).some((h) => pointInPolygon(x, z, h));
  return {
    /** Item pertama (urutan penyisipan) yang memuat titik, atau null. */
    contains(x, z, filter = null) {
      for (const item of grid.at(x, z)) if ((!filter || filter(item)) && inside(item, x, z)) return item;
      return null;
    },
    /** Jarak ke tepi ring luar terdekat (≤ reach), Infinity bila tak ada. */
    edgeDistance(x, z, filter = null) {
      let best = Infinity;
      for (const item of grid.at(x, z)) {
        if (filter && !filter(item)) continue;
        const d = distanceToRing(x, z, item.rings[0]);
        if (d < best) best = d;
      }
      return best;
    },
  };
}

/** Titik tiap `spacing` m sepanjang polyline mulai jarak `phase`: [{x, z, tx, tz, s}] (t = arah satuan segmen). */
export function samplesAlong(line, spacing, phase = 0) {
  const out = [];
  let acc = 0;
  let next = phase;
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len === 0) continue;
    const tx = (b[0] - a[0]) / len;
    const tz = (b[1] - a[1]) / len;
    while (next <= acc + len + 1e-9) {
      const t = next - acc;
      out.push({ x: a[0] + tx * t, z: a[1] + tz * t, tx, tz, s: next });
      next += spacing;
    }
    acc += len;
  }
  return out;
}
```

- [ ] **Step 5: Implementasi `extract.js`**

```js
/**
 * Ekstraksi fitur ground kampus (M2) dari fitur citybake ter-normalisasi & terproyeksi (dunia): jalan kendaraan
 * (tumpang w/2 + 2 m melewati batas distrik), trotoar (tumpang 1 m), jalan tanah, parit OSM, area keras/air
 * (diklip ke distrik), landcover (sawit/kebun/hutan/…), footprint gedung OSM (menjauhkan vegetasi/props).
 * Jembatan (dibuat region hero M6), gorong-gorong, dan parking_aisle (tertutup paving parkir) dilewati.
 */
import polygonClipping from 'polygon-clipping';
import { boundsOverlap, cleanRing, polygonArea, ringBounds } from '../../../src/geo/polygon.js';
import { insideWithOverlap, splitPolylineByRing } from '../../../src/geo/lineClip.js';
import { ROAD_CLASSES } from '../../citybake/config.js';
import { DITCH, ONEWAY, OVERLAP, SOIL_PATH_CLASSES, VEHICLE_CLASSES, WALK_CLASSES } from './constants.js';

/** Serpihan klip lebih kecil dari ini (m²) dibuang. */
const MIN_AREA = 0.5;

/** Lebar jalan (m): tag width bila valid, selain itu tabel citybake; searah pada kelas besar × faktor. */
export function roadWidth(cls, tags = {}) {
  const tagged = Number(String(tags.width ?? '').replace(',', '.'));
  if (Number.isFinite(tagged) && tagged > 0 && tagged < 40) return tagged;
  const base = ROAD_CLASSES[cls]?.width ?? 0;
  return tags.oneway === 'yes' && ONEWAY.classes.includes(cls) ? base * ONEWAY.factor : base;
}

/** Irisan poligon (rings) dengan ring (polygon-clipping) → daftar [luar, ...lubang] terbuka; serpihan dibuang. */
export function clipToRing(rings, ring) {
  return polygonClipping.intersection(rings, [ring])
    .map((poly) => poly.map((r) => cleanRing(r, 1e-9)).filter((r) => r.length >= 3))
    .filter((poly) => poly.length > 0 && polygonArea(poly[0]) >= MIN_AREA);
}

/** Jenis landcover dari fitur landuse citybake (kunci SURFACE_RULES.landcover) atau null. */
export function landcoverKind(f) {
  const t = f.tags ?? {};
  if (t.trees === 'oil_palms' || t.genus === 'Elaeis' || /sawit/i.test(t.name ?? '')) return 'sawit';
  if (t.landuse === 'orchard') return 'orchard';
  if (t.landuse === 'farmland') return 'farmland';
  if (f.cls === 'construction') return 'bare';
  if (f.cls === 'wetland') return 'wetland';
  if (f.cls === 'forest') return 'forest';
  if (f.cls === 'park') return 'park';
  if (f.cls === 'grass' || f.cls === 'scrub') return 'grass';
  return null;
}

function lineFeature(f, boundary, out) {
  const t = f.tags ?? {};
  if (t.tunnel && t.tunnel !== 'no') return;
  if (f.kind === 'waterway') {
    for (const line of splitPolylineByRing(f.line, boundary).inside) out.waterLines.push({ id: f.id, w: DITCH.osmWidth, line });
    return;
  }
  if ((t.bridge && t.bridge !== 'no') || t.service === 'parking_aisle') return;
  const w = roadWidth(f.cls, t);
  if (VEHICLE_CLASSES.includes(f.cls)) {
    for (const line of insideWithOverlap(f.line, boundary, w / 2 + OVERLAP.roadExtra)) out.roads.push({ id: f.id, cls: f.cls, w, line });
  } else if (WALK_CLASSES.includes(f.cls)) {
    for (const line of insideWithOverlap(f.line, boundary, OVERLAP.walk)) out.walks.push({ id: f.id, cls: f.cls, w, line });
  } else if (SOIL_PATH_CLASSES.includes(f.cls)) {
    for (const line of splitPolylineByRing(f.line, boundary).inside) out.soilPaths.push({ id: f.id, cls: f.cls, w, line });
  }
}

function areaFeature(f, boundary, out) {
  const t = f.tags ?? {};
  if (f.kind === 'building') {
    out.buildings.push({ id: f.id, ring: f.rings[0] });
    return;
  }
  let kind = null;
  if (f.kind === 'water') kind = 'water';
  else if (t.amenity === 'parking') kind = 'parking';
  else if (t.leisure === 'pitch') kind = 'pitch';
  if (kind) {
    for (const rings of clipToRing(f.rings, boundary)) out.areas.push({ id: f.id, kind, rings });
    return;
  }
  if (f.kind !== 'landuse') return;
  const lc = landcoverKind(f);
  if (!lc) return;
  for (const rings of clipToRing(f.rings, boundary)) out.landcover.push({ id: f.id, kind: lc, rings });
}

/**
 * @param {{features: import('../../citybake/features.js').Feature[], plazas?: Array<{id:string, rings:Array<Array<[number,number]>>}>}} src
 * @param {Array<[number, number]>} boundary ring distrik (dunia)
 */
export function extractGround({ features, plazas = [] }, boundary) {
  const db = ringBounds(boundary);
  const out = { roads: [], walks: [], soilPaths: [], waterLines: [], areas: [], landcover: [], buildings: [] };
  for (const f of features) {
    const geom = f.rings ? f.rings[0] : f.line;
    if (!geom || !boundsOverlap(ringBounds(geom), db)) continue;
    if (f.line) lineFeature(f, boundary, out);
    else areaFeature(f, boundary, out);
  }
  for (const p of plazas) {
    for (const rings of clipToRing(p.rings, boundary)) out.areas.push({ id: p.id, kind: 'plaza', rings });
  }
  return out;
}
```

- [ ] **Step 6: Jalankan tes; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/campusbake/groundExtract.test.js
npm run lint
```
Expected: 8 tes PASS; lint 0 galat.

- [ ] **Step 7: Commit**

```bash
git add tools/campusbake/ground/spatial.js tools/campusbake/ground/extract.js tests/campusbake/groundFixture.js tests/campusbake/groundExtract.test.js
```
```bash
git commit -m "feat(campusbake): ekstraksi ground (jalan bertumpang, trotoar, area, landcover) + indeks spasial"
```

---

### Task 9: Konteks kueri, muka air, parit

**Files:**
- Create: `tools/campusbake/ground/context.js`, `tools/campusbake/ground/waterLevel.js`, `tools/campusbake/ground/ditches.js`
- Test: `tests/campusbake/groundWaterDitch.test.js`

- [ ] **Step 1: Samakan parit dengan M1**

Bandingkan hasil `grep -rn "parit\|ditch\|DITCH" tools/campusbake/terrain/` (Task 0) dengan `DITCH` di `tools/campusbake/ground/constants.js`. Bila M1 memakai offset/lebar/kelas berbeda, ubah nilai `DITCH.width`, `DITCH.centerOffset`, `DITCH.classes`, `DITCH.enabled` agar **sama** dengan M1 (pita parit harus jatuh di cekungan yang dipahat M1). Catat nilai akhir di pesan commit Task 9.

- [ ] **Step 2: Tulis tes yang gagal**

`tests/campusbake/groundWaterDitch.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { extractGround } from '../../tools/campusbake/ground/extract.js';
import { applyWaterLevels, waterLevel } from '../../tools/campusbake/ground/waterLevel.js';
import { createGroundContext } from '../../tools/campusbake/ground/context.js';
import { ditchRuns, inferredDitches, offsetPolyline, simplifyLine } from '../../tools/campusbake/ground/ditches.js';
import { BOUNDARY, FEATURES, FIELD, PLAZAS } from './groundFixture.js';

const flat = { heightAt: () => 0, normalAt: (x, z, out = {}) => Object.assign(out, { x: 0, y: 1, z: 0 }) };

describe('waterLevel', () => {
  it('muka = tepi terendah − 0,4; dipahat bila dasar < muka − 0,3', () => {
    const ring = [[40, 40], [80, 40], [80, 80], [40, 80]];
    expect(waterLevel([ring], FIELD)).toMatchObject({ level: -0.4, minEdge: 0, minInside: -1.5, carved: true });
    expect(waterLevel([ring], flat)).toMatchObject({ level: -0.4, carved: false });
  });

  it('applyWaterLevels: air dipahat diberi level, yang tidak dipahat dibuang + dilaporkan', () => {
    const E = extractGround({ features: FEATURES, plazas: PLAZAS }, BOUNDARY);
    const a = applyWaterLevels(E, FIELD);
    expect(a.E.areas.find((x) => x.kind === 'water').level).toBe(-0.4);
    expect(a.water).toEqual([{ id: 'osm:way/7', level: -0.4, carved: true }]);
    const b = applyWaterLevels(E, flat);
    expect(b.E.areas.some((x) => x.kind === 'water')).toBe(false);
    expect(b.water[0].carved).toBe(false);
    expect(E.areas.some((x) => x.kind === 'water')).toBe(true); // input tidak dimutasi
  });
});

describe('parit', () => {
  it('offsetPolyline: kiri = (−tz, tx); siku dimiter', () => {
    expect(offsetPolyline([[0, 0], [10, 0]], 2)).toEqual([[0, 2], [10, 2]]);
    const [, corner] = offsetPolyline([[0, 0], [10, 0], [10, 10]], 1);
    expect(corner[0]).toBeCloseTo(9, 9);
    expect(corner[1]).toBeCloseTo(1, 9);
  });

  it('simplifyLine: titik segaris dibuang, belokan dipertahankan', () => {
    expect(simplifyLine([[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]])).toEqual([[0, 0], [3, 0], [3, 1]]);
  });

  it('ditchRuns: potong di titik terlarang, buang potongan < minRun', () => {
    const runs = ditchRuns([[0, 0], [20, 0]], (x) => x < 8 || x > 9, { step: 1, minRun: 4 });
    expect(runs).toEqual([[[0, 0], [7, 0]], [[10, 0], [20, 0]]]);
  });

  it('inferredDitches: dua sisi jalan tersier (z 192 & 208), terputus di trotoar x = 100, di dalam distrik', () => {
    const { E } = applyWaterLevels(extractGround({ features: FEATURES, plazas: PLAZAS }, BOUNDARY), FIELD);
    const ctx = createGroundContext(E, { boundary: BOUNDARY, field: FIELD });
    const ditches = inferredDitches(E.roads, ctx);
    expect(ditches).toHaveLength(4);
    for (const d of ditches) {
      expect(d.w).toBe(1);
      for (const [x, z] of d.line) {
        expect(Math.abs(z - 208) < 1e-9 || Math.abs(z - 192) < 1e-9).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0); // x = 0 tepat di tepi kiri dihitung "di dalam" oleh pointInPolygon
        expect(x).toBeLessThan(400);
        expect(Math.abs(x - 100)).toBeGreaterThan(1.5);
      }
    }
  });
});
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/groundWaterDitch.test.js`
Expected: FAIL — modul belum ada.

- [ ] **Step 4: Implementasi `context.js`**

```js
/**
 * Kueri gabungan untuk aturan bobot, parit, vegetasi, dan props (murni). Semua jarak "Edge" = jarak ke tepi
 * pita/poligon (bukan sumbu), Infinity bila jauh.
 */
import { pointInPolygon } from '../../../src/geo/polygon.js';
import { createAreaIndex, createLineIndex } from './spatial.js';
import { SURFACE_RULES } from './constants.js';

/**
 * @param {{roads:object[], walks:object[], soilPaths:object[], areas:object[], landcover:object[], buildings:object[]}} E
 * @param {{boundary: Array<[number, number]>, field: {normalAt(x:number, z:number, out?:object): {x:number,y:number,z:number}}}} opts
 */
export function createGroundContext(E, { boundary, field }) {
  const roads = createLineIndex(E.roads, { reach: 12 });
  const walks = createLineIndex(E.walks, { reach: 6 });
  const soil = createLineIndex(E.soilPaths, { reach: 6 });
  const areas = createAreaIndex(E.areas, { reach: 8 });
  const buildings = createAreaIndex(E.buildings.map((b) => ({ id: b.id, rings: [b.ring] })), { reach: 6 });
  const rank = (k) => SURFACE_RULES.priority.indexOf(k);
  const cover = createAreaIndex([...E.landcover].sort((a, b) => rank(a.kind) - rank(b.kind)), { reach: 0 });
  const isWater = (a) => a.kind === 'water';
  return Object.freeze({
    inside: (x, z) => pointInPolygon(x, z, boundary),
    roadEdge: (x, z) => roads.nearest(x, z),
    walkEdge: (x, z) => walks.nearest(x, z),
    soilPathEdge: (x, z) => soil.nearest(x, z),
    area: (x, z) => areas.contains(x, z),
    waterEdge: (x, z) => areas.edgeDistance(x, z, isWater),
    building: (x, z) => buildings.contains(x, z),
    buildingEdge: (x, z) => buildings.edgeDistance(x, z),
    cover: (x, z) => cover.contains(x, z),
    grade: (x, z) => {
      const n = field.normalAt(x, z);
      return n.y > 0 ? Math.hypot(n.x, n.z) / n.y : Infinity;
    },
  });
}
```

- [ ] **Step 5: Implementasi `waterLevel.js`**

```js
/**
 * Muka air badan air distrik (spec §5.2.8): tanah terendah sepanjang tepi (sampel tiap 2 m) − 0,4 m, dibulatkan
 * 0,01 m. Air dianggap "dipahat" terrain M1 bila sampel grid 4 m di dalamnya lebih rendah dari muka − 0,3 m;
 * air yang tidak dipahat tidak digambar (bidang air akan tenggelam di bawah tanah) dan dilaporkan.
 */
import { pointInPolygon, ringBounds } from '../../../src/geo/polygon.js';
import { WATER } from './constants.js';

export function waterLevel(rings, field, opts = WATER) {
  const outer = rings[0];
  let minEdge = Infinity;
  for (let i = 0; i < outer.length; i += 1) {
    const a = outer[i];
    const b = outer[(i + 1) % outer.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / opts.edgeStep));
    for (let k = 0; k < n; k += 1) {
      const t = k / n;
      minEdge = Math.min(minEdge, field.heightAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
    }
  }
  const level = Math.round((minEdge - opts.drop) * 100) / 100;
  const bb = ringBounds(outer);
  const g = opts.gridStep;
  let minInside = Infinity;
  for (let z = Math.ceil(bb.minZ / g) * g; z <= bb.maxZ; z += g) {
    for (let x = Math.ceil(bb.minX / g) * g; x <= bb.maxX; x += g) {
      if (pointInPolygon(x, z, outer) && !rings.slice(1).some((h) => pointInPolygon(x, z, h))) {
        minInside = Math.min(minInside, field.heightAt(x, z));
      }
    }
  }
  return { level, minEdge, minInside, carved: minInside < level - opts.carvedMin };
}

/** Salinan E dengan area air diberi `level`; air yang tidak dipahat dibuang. `water` = laporan per area. */
export function applyWaterLevels(E, field, opts = WATER) {
  const water = [];
  const areas = E.areas.flatMap((a) => {
    if (a.kind !== 'water') return [a];
    const r = waterLevel(a.rings, field, opts);
    water.push({ id: a.id, level: r.level, carved: r.carved });
    return r.carved ? [{ ...a, level: r.level }] : [];
  });
  return { E: { ...E, areas }, water };
}
```

- [ ] **Step 6: Implementasi `ditches.js`**

```js
/**
 * Parit tepi jalan utama [INFERENSI, spec §5.2.8]: garis sejajar sumbu jalan pada w/2 + centerOffset di kedua
 * sisi, dipotong di tempat yang tidak mungkin ada parit terbuka (luar distrik, area keras/air, gedung, dekat
 * jalan lain = gorong-gorong, dekat trotoar = titian). Hasil disederhanakan (Douglas–Peucker 5 cm).
 */
import { distanceToSegment } from '../../../src/geo/polygon.js';
import { polylineLength } from '../../../src/geo/lineClip.js';
import { samplesAlong } from './spatial.js';
import { DITCH } from './constants.js';

const unit = (x, z) => {
  const l = Math.hypot(x, z);
  return l > 0 ? [x / l, z / l] : [0, 0];
};

/** Polyline sejajar pada jarak d ke kiri (normal (−tz, tx)); simpul dalam memakai garis bagi + miter (≤ 2×). */
export function offsetPolyline(line, d) {
  const n = line.length;
  return line.map((p, i) => {
    const d1 = i > 0 ? unit(p[0] - line[i - 1][0], p[1] - line[i - 1][1]) : null;
    const d2 = i < n - 1 ? unit(line[i + 1][0] - p[0], line[i + 1][1] - p[1]) : null;
    let t = d1 && d2 ? unit(d1[0] + d2[0], d1[1] + d2[1]) : (d1 ?? d2);
    if (t[0] === 0 && t[1] === 0) t = d2 ?? d1;
    const k = d1 && d2 ? 1 / Math.max(t[0] * d2[0] + t[1] * d2[1], 0.5) : 1;
    return [p[0] - t[1] * d * k, p[1] + t[0] * d * k];
  });
}

/** Douglas–Peucker (toleransi m), ujung selalu dipertahankan. */
export function simplifyLine(pts, tol = 0.05) {
  if (pts.length <= 2) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1;
    let bestD = tol;
    for (let i = a + 1; i < b; i += 1) {
      const d = distanceToSegment(pts[i][0], pts[i][1], pts[a], pts[b]);
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i] === 1);
}

/** Bagi polyline (sampel tiap `step` m) menjadi potongan yang `ok`; potongan < minRun dibuang. */
export function ditchRuns(line, ok, { step = DITCH.step, minRun = DITCH.minRun } = {}) {
  const runs = [];
  let cur = [];
  const flush = () => {
    if (cur.length >= 2 && polylineLength(cur) >= minRun) runs.push(simplifyLine(cur));
    cur = [];
  };
  for (const p of samplesAlong(line, step, 0)) {
    if (ok(p.x, p.z)) cur.push([p.x, p.z]);
    else flush();
  }
  flush();
  return runs;
}

/** Parit kedua sisi jalan kelas DITCH.classes → [{id, w, line}]. */
export function inferredDitches(roads, ctx, cfg = DITCH) {
  if (!cfg.enabled) return [];
  const ok = (x, z) => ctx.inside(x, z) && ctx.area(x, z) === null && ctx.building(x, z) === null
    && ctx.buildingEdge(x, z) > cfg.clearBuilding && ctx.roadEdge(x, z).d > cfg.clearRoad
    && ctx.walkEdge(x, z).d > cfg.clearWalk;
  const out = [];
  for (const r of roads) {
    if (!cfg.classes.includes(r.cls)) continue;
    for (const side of [1, -1]) {
      const line = offsetPolyline(r.line, side * (r.w / 2 + cfg.centerOffset));
      for (const run of ditchRuns(line, ok, cfg)) out.push({ id: `${r.id}:parit${side > 0 ? 'Kiri' : 'Kanan'}`, w: cfg.width, line: run });
    }
  }
  return out;
}
```

- [ ] **Step 7: Jalankan tes; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/campusbake/groundWaterDitch.test.js
npm run lint
```
Expected: 6 tes PASS; lint 0 galat.

- [ ] **Step 8: Commit**

```bash
git add tools/campusbake/ground/context.js tools/campusbake/ground/waterLevel.js tools/campusbake/ground/ditches.js tests/campusbake/groundWaterDitch.test.js
```
```bash
git commit -m "feat(campusbake): muka air (deteksi pahatan) dan parit tepi jalan utama (lebar 1,0 m, offset w/2+3,0 m)"
```

---

### Task 10: Bobot permukaan grass/soil/wet per sampel 4 m

**Files:**
- Create: `tools/campusbake/ground/surfaces.js`
- Test: `tests/campusbake/groundSurfaces.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/campusbake/groundSurfaces.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { extractGround } from '../../tools/campusbake/ground/extract.js';
import { applyWaterLevels } from '../../tools/campusbake/ground/waterLevel.js';
import { createGroundContext } from '../../tools/campusbake/ground/context.js';
import { inferredDitches } from '../../tools/campusbake/ground/ditches.js';
import { createLineIndex } from '../../tools/campusbake/ground/spatial.js';
import { encodeWeights, surfaceWeights, toBytes } from '../../tools/campusbake/ground/surfaces.js';
import { BOUNDARY, FEATURES, FIELD, PLAZAS } from './groundFixture.js';

const { E } = applyWaterLevels(extractGround({ features: FEATURES, plazas: PLAZAS }, BOUNDARY), FIELD);
const ctx = createGroundContext(E, { boundary: BOUNDARY, field: FIELD });
const ditchIndex = createLineIndex([...inferredDitches(E.roads, ctx), ...E.waterLines], { reach: 3 });
const W = surfaceWeights('0_0', ctx, ditchIndex);
/** [grass, soil, wet] sampel di titik dunia (x, z) kelipatan 4 m. */
const at = (x, z) => {
  const k = (z / 4) * W.n + x / 4;
  return [W.grass[k], W.soil[k], W.wet[k]];
};

describe('toBytes', () => {
  it('jumlah 255; semua nol tetap nol (di luar distrik)', () => {
    expect(toBytes({ g: 0.65, s: 0.35, w: 0 })).toEqual([166, 89, 0]);
    expect(toBytes({ g: 0, s: 0, w: 0 })).toEqual([0, 0, 0]);
    expect(toBytes({ g: 0, s: 0.5, w: 0.5 })).toEqual([0, 128, 127]);
  });
});

describe('surfaceWeights (fixture, chunk 0_0)', () => {
  it('ukuran grid n = 126', () => {
    expect(W.n).toBe(126);
    expect(W.grass).toHaveLength(126 * 126);
  });

  it('hutan: rumput 0,65 + serasah tanah 0,35', () => expect(at(340, 60)).toEqual([166, 89, 0]));
  it('di dalam kolam: basah penuh', () => expect(at(60, 60)).toEqual([0, 0, 255]));
  it('tepi kolam 4 m: basah 1 − 4/6', () => expect(at(84, 60)).toEqual([170, 0, 85]));
  it('jalan tanah (path): tanah penuh', () => expect(at(340, 300)).toEqual([0, 255, 0]));
  it('parit tepi jalan (z 208): basah 0,8', () => expect(at(60, 208)).toEqual([51, 0, 204]));
  it('rumput biasa', () => expect(at(200, 380)).toEqual([255, 0, 0]));
  it('di luar distrik: nol', () => expect(at(452, 200)).toEqual([0, 0, 0]));

  it('encodeWeights: base64 bolak-balik', () => {
    const enc = encodeWeights(W);
    expect(enc.n).toBe(126);
    expect(new Uint8Array(Buffer.from(enc.soil, 'base64'))).toEqual(W.soil);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/groundSurfaces.test.js`
Expected: FAIL — modul `surfaces.js` tidak ada.

- [ ] **Step 3: Implementasi**

```js
/**
 * Bobot permukaan terrain (spec §5.3): per sampel grid 4 m (sama dengan heightfield) tiga kanal byte
 * grass/soil/wet (jumlah 255). Aturan (maks per kanal): landcover (SURFACE_RULES.landcover), bahu jalan tanah
 * merah, jalan tanah (path/track), tepi air basah, parit basah, lereng curam tanah. Di luar distrik = 0,0,0.
 */
import { Buffer } from 'node:buffer';
import { CHUNK_SIZE, N, STEP } from '../../../src/geo/terrain/format.js';
import { parseTileKey } from '../../../src/geo/tiles.js';
import { SURFACE_RULES } from './constants.js';

/** Bobot satu titik {g, s, w} (jumlah 1; semua 0 di luar distrik). */
export function sampleSurface(x, z, ctx, ditchIndex, rules = SURFACE_RULES) {
  if (!ctx.inside(x, z)) return { g: 0, s: 0, w: 0 };
  let s = 0;
  let w = 0;
  const cover = ctx.cover(x, z);
  if (cover) {
    s = rules.landcover[cover.kind]?.soil ?? 0;
    w = rules.landcover[cover.kind]?.wet ?? 0;
  }
  if (ctx.area(x, z)?.kind === 'water') {
    w = 1;
  } else {
    const we = ctx.waterEdge(x, z);
    if (we < rules.waterBank.width) w = Math.max(w, 1 - we / rules.waterBank.width);
  }
  const road = ctx.roadEdge(x, z);
  if (road.item && rules.shoulder.classes.includes(road.item.cls) && road.d >= 0 && road.d <= rules.shoulder.width) {
    s = Math.max(s, rules.shoulder.soil);
  }
  const path = ctx.soilPathEdge(x, z).d;
  if (path <= rules.soilPath.feather) s = Math.max(s, path <= 0 ? 1 : 1 - path / rules.soilPath.feather);
  const dd = ditchIndex.nearest(x, z).d;
  if (dd <= rules.ditch.width) w = Math.max(w, rules.ditch.wet * (1 - Math.max(0, dd) / rules.ditch.width));
  if (ctx.grade(x, z) > rules.steep.grade) s = Math.max(s, rules.steep.soil);
  const total = s + w;
  if (total > 1) {
    s /= total;
    w /= total;
  }
  return { g: Math.max(0, 1 - s - w), s, w };
}

/** {g, s, w} → [grass, soil, wet] byte berjumlah 255 (atau 0,0,0). */
export function toBytes({ g, s, w }) {
  if (g + s + w === 0) return [0, 0, 0];
  const sb = Math.round(255 * s);
  const wb = Math.min(255 - sb, Math.round(255 * w));
  return [255 - sb - wb, sb, wb];
}

/** Grid bobot chunk `key`: sampel (i, j) di (ix·size + i·step, iz·size + j·step), baris-mayor j lalu i. */
export function surfaceWeights(key, ctx, ditchIndex, { n = N, step = STEP, size = CHUNK_SIZE } = {}) {
  const t = parseTileKey(key);
  const ox = t.ix * size;
  const oz = t.iz * size;
  const grass = new Uint8Array(n * n);
  const soil = new Uint8Array(n * n);
  const wet = new Uint8Array(n * n);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const [gb, sb, wb] = toBytes(sampleSurface(ox + i * step, oz + j * step, ctx, ditchIndex));
      const k = j * n + i;
      grass[k] = gb;
      soil[k] = sb;
      wet[k] = wb;
    }
  }
  return { n, grass, soil, wet };
}

const b64 = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');

/** Bentuk JSON `weights` (spec/indeks): {n, grass, soil, wet} base64. */
export function encodeWeights(w) {
  return { n: w.n, grass: b64(w.grass), soil: b64(w.soil), wet: b64(w.wet) };
}
```

- [ ] **Step 4: Jalankan tes; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/campusbake/groundSurfaces.test.js
npm run lint
```
Expected: 10 tes PASS; lint 0 galat.

- [ ] **Step 5: Commit**

```bash
git add tools/campusbake/ground/surfaces.js tests/campusbake/groundSurfaces.test.js
```
```bash
git commit -m "feat(campusbake): bobot permukaan rumput/tanah merah/tanah basah per sampel grid 4 m"
```

---

### Task 11: Penempatan vegetasi & props (bake)

**Files:**
- Create: `tools/campusbake/ground/vegetation.js`, `tools/campusbake/ground/props.js`
- Test: `tests/campusbake/groundPlacement.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/campusbake/groundPlacement.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { pointInPolygon } from '../../src/geo/polygon.js';
import { extractGround } from '../../tools/campusbake/ground/extract.js';
import { applyWaterLevels } from '../../tools/campusbake/ground/waterLevel.js';
import { createGroundContext } from '../../tools/campusbake/ground/context.js';
import { pickSpecies, placeVegetation } from '../../tools/campusbake/ground/vegetation.js';
import { placeProps } from '../../tools/campusbake/ground/props.js';
import { BOUNDARY, FEATURES, FIELD, PLAZAS } from './groundFixture.js';

const { E } = applyWaterLevels(extractGround({ features: FEATURES, plazas: PLAZAS }, BOUNDARY), FIELD);
const ctx = createGroundContext(E, { boundary: BOUNDARY, field: FIELD });
const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const inSq = (p, r) => pointInPolygon(p.x, p.z, r);

describe('pickSpecies', () => {
  it('campuran berbobot', () => {
    const mix = [['mahoni', 0.5], ['angsana', 0.3], ['saga', 0.2]];
    expect(pickSpecies(mix, 0.1)).toBe('mahoni');
    expect(pickSpecies(mix, 0.6)).toBe('angsana');
    expect(pickSpecies(mix, 0.95)).toBe('saga');
  });
});

describe('placeVegetation (fixture)', () => {
  const veg = placeVegetation(E, ctx);

  it('deterministik', () => expect(placeVegetation(E, ctx)).toEqual(veg));

  it('tidak ada pohon di luar distrik, di atas jalan/trotoar, di area keras/air, atau di gedung', () => {
    for (const p of veg) {
      expect(ctx.inside(p.x, p.z)).toBe(true);
      expect(ctx.area(p.x, p.z)).toBeNull();
      expect(ctx.building(p.x, p.z)).toBeNull();
      expect(ctx.roadEdge(p.x, p.z).d).toBeGreaterThanOrEqual(0.8);
      expect(ctx.walkEdge(p.x, p.z).d).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('hutan: peneduh mahoni/angsana/saga di dalam poligon hutan', () => {
    const forest = veg.filter((p) => inSq(p, sq(300, 20, 390, 120)));
    expect(forest.length).toBeGreaterThan(20);
    expect(forest.length).toBeLessThan(50);
    for (const p of forest) expect(['mahoni', 'angsana', 'saga']).toContain(p.sp);
  });

  it('kebun sawit: pola segitiga 9 m, hanya sawit', () => {
    const sawit = veg.filter((p) => p.sp === 'sawit');
    expect(sawit.length).toBeGreaterThan(100);
    expect(sawit.length).toBeLessThan(140);
    for (const p of sawit) expect(inSq(p, sq(20, 300, 120, 390))).toBe(true);
  });

  it('pohon tepi jalan 5 m dari tepi aspal (z 190 / 210); semak keliling parkir', () => {
    const street = veg.filter((p) => Math.abs(Math.abs(p.z - 200) - 10) < 1e-6);
    expect(street.length).toBeGreaterThan(40);
    const shrubs = veg.filter((p) => p.sp === 'semak');
    expect(shrubs.length).toBeGreaterThan(20);
  });
});

describe('placeProps (fixture)', () => {
  const props = placeProps(E, ctx);

  it('PJU tiap 35 m di sisi kiri jalan tersier, menghadap jalan (yaw 180°)', () => {
    expect(props.lamps).toHaveLength(12);
    expect(props.lamps[0].x).toBeCloseTo(10.5, 9);
    expect(props.lamps[0].z).toBeCloseTo(206, 9);
    expect(props.lamps[0].yaw).toBe(180);
  });

  it('bangku tiap 30 m bergantian sisi trotoar, menghadap trotoar; tong tiap 2 bangku', () => {
    expect(props.benches).toHaveLength(10);
    expect(props.benches[0].x).toBeCloseTo(97.4, 9);
    expect(props.benches[0].z).toBeCloseTo(65, 9);
    expect(props.benches[0].yaw).toBe(90);
    expect(props.benches[1].x).toBeCloseTo(102.6, 9);
    expect(props.benches[1].yaw).toBe(270);
    expect(props.bins).toHaveLength(5);
    expect(props.bins[0].z).toBeCloseTo(66.4, 9);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/groundPlacement.test.js`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Implementasi `vegetation.js`**

```js
/**
 * Penempatan vegetasi kampus (bake, deterministik): kisi global ber-jitter per jenis landcover (hutan, taman,
 * rumput, kebun), kebun sawit pola segitiga, pohon peneduh tepi jalan, semak keliling parkir. Satu titik kisi
 * hanya dipakai landcover berprioritas tertinggi di titik itu (ctx.cover) sehingga poligon bertumpuk tidak
 * menggandakan pohon. Spesies: V01 mahoni, V02 angsana, V03 saga, V06 sawit, V07 semak.
 */
import { orientRing, pointInPolygon, ringBounds } from '../../../src/geo/polygon.js';
import { hashString, mulberry32 } from '../../citybake/random.js';
import { samplesAlong } from './spatial.js';
import { VEG } from './constants.js';

const rngOf = (salt) => mulberry32(hashString(salt));
const insideRings = (rings, x, z) => pointInPolygon(x, z, rings[0]) && !rings.slice(1).some((h) => pointInPolygon(x, z, h));

/** Spesies dari campuran berbobot [['mahoni', 0.5], …] dan u ∈ [0, 1). */
export function pickSpecies(mix, u) {
  const total = mix.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [sp, w] of mix) {
    acc += w / total;
    if (u < acc) return sp;
  }
  return mix[mix.length - 1][0];
}

/** Titik tidak boleh ditanami: luar distrik, area keras/air, dekat jalan/trotoar/jalan tanah/gedung/air, curam. */
export function vegetationBlocked(ctx, x, z, clear = VEG.clear) {
  return !ctx.inside(x, z) || ctx.area(x, z) !== null || ctx.roadEdge(x, z).d < clear.road
    || ctx.walkEdge(x, z).d < clear.walk || ctx.soilPathEdge(x, z).d < clear.walk
    || ctx.building(x, z) !== null || ctx.buildingEdge(x, z) < clear.building
    || ctx.waterEdge(x, z) < clear.water || ctx.grade(x, z) > VEG.maxGrade;
}

function latticeFill(name, rule, polys, ctx, seen, out) {
  const sp = rule.spacing;
  for (const poly of polys) {
    const b = ringBounds(poly.rings[0]);
    for (let j = Math.floor(b.minZ / sp) - 1; j <= Math.ceil(b.maxZ / sp); j += 1) {
      for (let i = Math.floor(b.minX / sp) - 1; i <= Math.ceil(b.maxX / sp); i += 1) {
        const id = `${name}:${i}:${j}`;
        if (seen.has(id)) continue;
        const r = rngOf(id);
        const x = (i + 0.5 + (r() - 0.5) * 2 * rule.jitter) * sp;
        const z = (j + 0.5 + (r() - 0.5) * 2 * rule.jitter) * sp;
        const keepRoll = r();
        const speciesRoll = r();
        if (!insideRings(poly.rings, x, z)) continue;
        seen.add(id);
        if (rule.keep !== undefined && keepRoll >= rule.keep) continue;
        if (ctx.cover(x, z)?.kind !== poly.kind || vegetationBlocked(ctx, x, z)) continue;
        out.push({ sp: pickSpecies(rule.mix, speciesRoll), x, z });
      }
    }
  }
}

function sawitFill(polys, ctx, seen, out) {
  const dx = VEG.sawit.spacing;
  const dz = (dx * Math.sqrt(3)) / 2;
  for (const poly of polys) {
    const b = ringBounds(poly.rings[0]);
    for (let j = Math.floor(b.minZ / dz); j <= Math.ceil(b.maxZ / dz); j += 1) {
      const shift = (((j % 2) + 2) % 2) * (dx / 2);
      for (let i = Math.floor((b.minX - shift) / dx); i <= Math.ceil((b.maxX - shift) / dx); i += 1) {
        const id = `sawit:${i}:${j}`;
        if (seen.has(id)) continue;
        const x = i * dx + shift;
        const z = j * dz;
        if (!insideRings(poly.rings, x, z)) continue;
        seen.add(id);
        if (ctx.cover(x, z)?.kind !== 'sawit' || vegetationBlocked(ctx, x, z)) continue;
        out.push({ sp: 'sawit', x, z });
      }
    }
  }
}

function streetTrees(roads, ctx, out) {
  const rule = VEG.street;
  for (const r of roads) {
    if (!rule.classes.includes(r.cls)) continue;
    for (const side of [1, -1]) {
      const rnd = rngOf(`jalan:${r.id}:${side}:${r.line[0][0].toFixed(2)}:${r.line[0][1].toFixed(2)}`);
      const d = r.w / 2 + rule.offset;
      for (const p of samplesAlong(r.line, rule.spacing, rnd() * rule.spacing)) {
        const x = p.x - p.tz * d * side;
        const z = p.z + p.tx * d * side;
        const roll = rnd();
        const cover = ctx.cover(x, z)?.kind;
        if ((cover && cover !== 'park' && cover !== 'grass') || vegetationBlocked(ctx, x, z)) continue;
        out.push({ sp: pickSpecies(rule.mix, roll), x, z });
      }
    }
  }
}

function parkingShrubs(areas, ctx, out) {
  const rule = VEG.shrubParking;
  const clear = { ...VEG.clear, road: 0.8, walk: 0.5 };
  for (const a of areas) {
    if (a.kind !== 'parking') continue;
    const ring = orientRing(a.rings[0], true);
    for (const p of samplesAlong([...ring, ring[0]], rule.spacing, rule.spacing / 2)) {
      // Ring positif: normal luar = (dz, −dx) (src/geo/polygon.js).
      const x = p.x + p.tz * rule.offset;
      const z = p.z - p.tx * rule.offset;
      if (!vegetationBlocked(ctx, x, z, clear)) out.push({ sp: 'semak', x, z });
    }
  }
}

/** @returns {Array<{sp: string, x: number, z: number}>} titik vegetasi dunia (urutan deterministik) */
export function placeVegetation(E, ctx) {
  const out = [];
  const seen = new Set();
  const byKind = (k) => E.landcover.filter((c) => c.kind === k);
  latticeFill('forest', VEG.forest, byKind('forest'), ctx, seen, out);
  sawitFill(byKind('sawit'), ctx, seen, out);
  latticeFill('orchard', VEG.orchard, byKind('orchard'), ctx, seen, out);
  latticeFill('park', VEG.park, byKind('park'), ctx, seen, out);
  latticeFill('grass', VEG.grass, byKind('grass'), ctx, seen, out);
  latticeFill('shrubPark', VEG.shrubPark, byKind('park'), ctx, seen, out);
  streetTrees(E.roads, ctx, out);
  parkingShrubs(E.areas, ctx, out);
  return out;
}
```

- [ ] **Step 4: Implementasi `props.js`**

```js
/**
 * Penempatan props kampus (bake, deterministik): P03 PJU di sisi kiri jalan per kelas (PROPS.lamp.spacing),
 * P04 bangku bergantian sisi trotoar, P05 tong sampah di samping tiap 2 bangku. yaw (derajat bulat, konvensi
 * atan2(dx, dz)) = arah hadap ke jalan/trotoar (lengan PJU, muka bangku).
 */
import { polylineLength } from '../../../src/geo/lineClip.js';
import { samplesAlong } from './spatial.js';
import { PROPS } from './constants.js';

const deg = (rad) => ((Math.round((rad * 180) / Math.PI) % 360) + 360) % 360;

function blocked(ctx, x, z, clear = PROPS.clear) {
  return !ctx.inside(x, z) || ctx.area(x, z) !== null || ctx.building(x, z) !== null
    || ctx.buildingEdge(x, z) < clear.building || ctx.roadEdge(x, z).d < clear.road
    || ctx.waterEdge(x, z) < clear.water;
}

/** @returns {{lamps: Array<{x,z,yaw}>, benches: Array<{x,z,yaw}>, bins: Array<{x,z}>}} */
export function placeProps(E, ctx) {
  const lamps = [];
  const benches = [];
  const bins = [];
  for (const r of E.roads) {
    const spacing = PROPS.lamp.spacing[r.cls];
    if (!spacing) continue;
    const d = r.w / 2 + PROPS.lamp.offset;
    for (const p of samplesAlong(r.line, spacing, spacing / 2)) {
      const nx = -p.tz;
      const nz = p.tx;
      const x = p.x + nx * d;
      const z = p.z + nz * d;
      if (blocked(ctx, x, z) || ctx.walkEdge(x, z).d < PROPS.clear.walk) continue;
      lamps.push({ x, z, yaw: deg(Math.atan2(-nx, -nz)) });
    }
  }
  for (const w of E.walks) {
    if (polylineLength(w.line) < PROPS.bench.minWalk) continue;
    samplesAlong(w.line, PROPS.bench.spacing, PROPS.bench.spacing / 2).forEach((p, k) => {
      const side = k % 2 === 0 ? 1 : -1;
      const nx = -p.tz * side;
      const nz = p.tx * side;
      const d = w.w / 2 + PROPS.bench.offset;
      const x = p.x + nx * d;
      const z = p.z + nz * d;
      if (blocked(ctx, x, z) || ctx.walkEdge(x, z).d < PROPS.bench.offset - 0.1) return;
      benches.push({ x, z, yaw: deg(Math.atan2(-nx, -nz)) });
      if ((benches.length - 1) % PROPS.bin.every !== 0) return;
      const bx = x + p.tx * PROPS.bin.along;
      const bz = z + p.tz * PROPS.bin.along;
      if (!blocked(ctx, bx, bz)) bins.push({ x: bx, z: bz });
    });
  }
  return { lamps, benches, bins };
}
```

- [ ] **Step 5: Jalankan tes; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/campusbake/groundPlacement.test.js
npm run lint
```
Expected: 8 tes PASS; lint 0 galat.

- [ ] **Step 6: Commit**

```bash
git add tools/campusbake/ground/vegetation.js tools/campusbake/ground/props.js tests/campusbake/groundPlacement.test.js
```
```bash
git commit -m "feat(campusbake): penempatan vegetasi kampus (V01–V03, V06, V07) dan PJU/bangku/tong (P03–P05)"
```

---

### Task 12: Perakitan chunk, penulisan, CLI `ground`, golden

**Files:**
- Create: `tools/campusbake/ground/writeGround.js`, `tools/campusbake/ground/index.js`
- Modify: `tools/campusbake/index.js`
- Test: `tests/campusbake/groundBake.test.js`

- [ ] **Step 1: Tulis tes golden yang gagal**

`tests/campusbake/groundBake.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Buffer } from 'node:buffer';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bakeGroundChunks, groundReport } from '../../tools/campusbake/ground/index.js';
import { quantizeLine, quantizeRing, writeGround } from '../../tools/campusbake/ground/writeGround.js';
import { BOUNDARY, FEATURES, FIELD, PLAZAS } from './groundFixture.js';

const run = () => bakeGroundChunks({ features: FEATURES, plazas: PLAZAS, boundary: BOUNDARY, field: FIELD, keys: ['-1_0', '0_0'] });
const result = run();
const chunk = (key) => JSON.parse(result.chunks.find((c) => c.key === key).json);
const bytes = (b64) => new Uint8Array(Buffer.from(b64, 'base64'));

describe('kuantisasi', () => {
  it('0,1 m relatif origin; duplikat berurutan & penutup ring dibuang', () => {
    expect(quantizeLine([[1.04, 2], [1.0, 2.01], [3, 4]], [0, 0])).toEqual([10, 20, 30, 40]);
    expect(quantizeRing([[0, 0], [1, 0], [1, 1], [0, 0]], [0, 0])).toEqual([0, 0, 10, 0, 10, 10]);
  });
});

describe('bakeGroundChunks (golden fixture)', () => {
  it('deterministik: dua kali bake → string identik', () => {
    expect(run().chunks).toEqual(result.chunks);
  });

  it('kunci & urutan field sesuai format v1', () => {
    expect(Object.keys(chunk('0_0'))).toEqual(['v', 'key', 'roads', 'walks', 'areas', 'ditches', 'veg', 'props', 'weights']);
    expect(chunk('0_0')).toMatchObject({ v: 1, key: '0_0' });
  });

  it('jalan bertumpang 7 m di batas, dipotong ke chunk + margin 16 m', () => {
    expect(chunk('0_0').roads).toEqual([{ cls: 'tertiary', w: 100, pts: [-70, 2000, 4070, 2000] }]);
    expect(chunk('-1_0').roads).toEqual([{ cls: 'tertiary', w: 100, pts: [4930, 2000, 5160, 2000] }]);
    expect(chunk('0_0').walks).toEqual([{ w: 20, pts: [1000, 500, 1000, 3500] }]);
  });

  it('area: parkir, air (level), lapangan, plaza', () => {
    const a = chunk('0_0').areas;
    expect(a.map((x) => x.kind)).toEqual(['parking', 'water', 'pitch', 'plaza']);
    expect(a[0].rings).toEqual([[2500, 2500, 3000, 2500, 3000, 3000, 2500, 3000]]);
    expect(a[1].level).toBe(-0.4);
    expect(chunk('-1_0').areas).toEqual([]);
  });

  it('props & vegetasi hanya di chunk pemiliknya', () => {
    const p = chunk('0_0').props;
    expect(p.lamps.slice(0, 3)).toEqual([105, 2060, 180]);
    expect(p.lamps).toHaveLength(36);
    expect(p.benches.slice(0, 3)).toEqual([974, 650, 90]);
    expect(p.bins.slice(0, 2)).toEqual([974, 664]);
    expect(chunk('0_0').veg.map((v) => v.sp)).toEqual(['mahoni', 'angsana', 'saga', 'sawit', 'semak']);
    expect(chunk('-1_0').veg).toEqual([]);
    expect(chunk('-1_0').props).toEqual({ lamps: [], benches: [], bins: [] });
  });

  it('bobot chunk di luar distrik = nol (kecuali kolom i = 125, x = 0 tepat di tepi); laporan memuat air & PJU', () => {
    const w = chunk('-1_0').weights;
    expect(w.n).toBe(126);
    for (const k of ['grass', 'soil', 'wet']) expect(bytes(w[k]).every((v, i) => i % 126 === 125 || v === 0)).toBe(true);
    const lines = groundReport({ stats: result.stats, bytes: 1000, files: 2, timestamp: 'uji', ms: 1 });
    expect(lines.join('\n')).toMatch(/air osm:way\/7: muka -0\.40 m dipahat/);
    expect(lines.join('\n')).toMatch(/PJU 12, bangku 10, tong 5/);
  });
});

describe('writeGround', () => {
  let dir;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'campusbake-ground-'));
    await mkdir(join(dir, 'ground'), { recursive: true });
    await writeFile(join(dir, 'ground', '9_9.json'), '{}');
    await writeFile(join(dir, 'manifest.json'), `${JSON.stringify({
      format: 'unri-district', version: 1, terrain: { chunks: ['-1_0', '0_0'] }, ground: { chunks: [] }, buildings: 'buildings.json',
    }, null, 2)}\n`);
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('menulis berkas per chunk, menghapus berkas basi, memperbarui manifest.ground (urutan kunci tetap)', async () => {
    const out = await writeGround({ dir: join(dir, 'ground'), manifestPath: join(dir, 'manifest.json'), chunks: result.chunks });
    expect(out.files).toBe(2);
    expect((await readdir(join(dir, 'ground'))).sort()).toEqual(['-1_0.json', '0_0.json']);
    const m = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
    expect(Object.keys(m)).toEqual(['format', 'version', 'terrain', 'ground', 'buildings']);
    expect(m.ground).toEqual({ chunks: ['-1_0', '0_0'] });
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/groundBake.test.js`
Expected: FAIL — modul `index.js`/`writeGround.js` tidak ada.

- [ ] **Step 3: Implementasi `writeGround.js`**

```js
/**
 * Perakitan ground/<key>.json (format v1, lihat plan M2) dan penulisan berkas + manifest.ground.
 * Koordinat: bilangan bulat 0,1 m relatif sudut barat-laut chunk. Jalan/trotoar/parit dipotong ke chunk +
 * margin (diklip eksak di runtime); area dipotong tepat ke chunk; titik (veg/props) milik chunk [min, max).
 */
import { Buffer } from 'node:buffer';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clipPolylineToRect, polygonArea } from '../../../src/geo/polygon.js';
import { parseTileKey, tileBounds } from '../../../src/geo/tiles.js';
import { CHUNK_SIZE } from '../../../src/geo/terrain/format.js';
import { clipToRing } from './extract.js';
import { GROUND_FORMAT, VEG_SPECIES } from './constants.js';

const q = (v, o) => Math.round((v - o) / GROUND_FORMAT.unit);

/** Polyline dunia → array datar bulat relatif origin [ox, oz]; titik berurutan yang sama dibuang. */
export function quantizeLine(line, origin) {
  const out = [];
  for (const [x, z] of line) {
    const qx = q(x, origin[0]);
    const qz = q(z, origin[1]);
    if (out.length >= 2 && out[out.length - 2] === qx && out[out.length - 1] === qz) continue;
    out.push(qx, qz);
  }
  return out;
}

/** Ring dunia → array datar bulat terbuka (titik penutup yang sama dengan awal dibuang). */
export function quantizeRing(ring, origin) {
  const out = quantizeLine(ring, origin);
  while (out.length >= 4 && out[0] === out[out.length - 2] && out[1] === out[out.length - 1]) out.splice(-2, 2);
  return out;
}

const flatArea = (flat) => {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  return polygonArea(pts);
};

/**
 * Objek ground satu chunk.
 * @param {string} key
 * @param {{roads:object[], walks:object[], areas:object[], ditches:object[], veg:object[],
 *   props:{lamps:object[], benches:object[], bins:object[]}, weights:{n:number, grass:string, soil:string, wet:string}}} L
 */
export function assembleChunk(key, L) {
  const t = parseTileKey(key);
  const rect = tileBounds(t.ix, t.iz, CHUNK_SIZE);
  const origin = [rect.minX, rect.minZ];
  const m = GROUND_FORMAT.roadClipMargin;
  const wide = { minX: rect.minX - m, minZ: rect.minZ - m, maxX: rect.maxX + m, maxZ: rect.maxZ + m };
  const width = (v) => Math.round(v / GROUND_FORMAT.unit);
  const lines = (list, head) => list
    .flatMap((r) => clipPolylineToRect(r.line, wide).map((line) => ({ ...head(r), w: width(r.w), pts: quantizeLine(line, origin) })))
    .filter((r) => r.pts.length >= 4);
  const rectRing = [[rect.minX, rect.minZ], [rect.maxX, rect.minZ], [rect.maxX, rect.maxZ], [rect.minX, rect.maxZ]];
  const areas = L.areas.flatMap((a) => clipToRing(a.rings, rectRing).map((rings) => {
    const qr = rings.map((r) => quantizeRing(r, origin)).filter((r) => r.length >= 6);
    if (qr.length === 0 || flatArea(qr[0]) < 1) return null;
    return a.kind === 'water' ? { kind: a.kind, rings: qr, level: a.level } : { kind: a.kind, rings: qr };
  }).filter(Boolean));
  const inRect = (p) => p.x >= rect.minX && p.x < rect.maxX && p.z >= rect.minZ && p.z < rect.maxZ;
  const flat = (list, withYaw) => list.filter(inRect)
    .flatMap((p) => (withYaw ? [q(p.x, origin[0]), q(p.z, origin[1]), p.yaw] : [q(p.x, origin[0]), q(p.z, origin[1])]));
  return {
    v: GROUND_FORMAT.v,
    key,
    roads: lines(L.roads, (r) => ({ cls: r.cls })),
    walks: lines(L.walks, () => ({})),
    areas,
    ditches: lines(L.ditches, () => ({})),
    veg: VEG_SPECIES.map((sp) => ({ sp, pts: flat(L.veg.filter((v) => v.sp === sp), false) })).filter((v) => v.pts.length > 0),
    props: { lamps: flat(L.props.lamps, true), benches: flat(L.props.benches, true), bins: flat(L.props.bins, false) },
    weights: L.weights,
  };
}

/**
 * Tulis ground/<key>.json (direktori dikosongkan dulu: berkas basi hilang) dan set manifest.ground.chunks.
 * Format manifest mengikuti M1: JSON 2 spasi + newline; urutan kunci lain dipertahankan.
 */
export async function writeGround({ dir, manifestPath, chunks }) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  let bytes = 0;
  for (const c of chunks) {
    await writeFile(join(dir, `${c.key}.json`), c.json);
    bytes += Buffer.byteLength(c.json);
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const next = { ...manifest, ground: { chunks: chunks.map((c) => c.key) } };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
  return { bytes, files: chunks.length };
}
```

- [ ] **Step 4: Implementasi `ground/index.js`**

```js
/**
 * campusbake ground (M2): OSM kampus + heightfield M1 → public/districts/unri/ground/<key>.json.
 * bakeGroundChunks murni (golden test); bakeGround = I/O + laporan.
 */
import { join } from 'node:path';
import { createProjection } from '../../../src/geo/projection.js';
import { polylineLength } from '../../../src/geo/lineClip.js';
import { WORLD_ORIGIN } from '../../../src/config/constants.js';
import { UNRI_BOUNDARY } from '../../../src/districts/unri/boundary.js';
import { extractGround } from './extract.js';
import { applyWaterLevels } from './waterLevel.js';
import { createGroundContext } from './context.js';
import { inferredDitches } from './ditches.js';
import { createLineIndex } from './spatial.js';
import { placeVegetation } from './vegetation.js';
import { placeProps } from './props.js';
import { encodeWeights, surfaceWeights } from './surfaces.js';
import { assembleChunk, writeGround } from './writeGround.js';
import { loadOsmSource, loadTerrainField, projectOsm } from './sources.js';
import { GROUND_BUDGET_BYTES, GROUND_PATHS } from './constants.js';

const km = (list) => Math.round(list.reduce((s, r) => s + polylineLength(r.line), 0)) / 1000;
const countBy = (list, key) => {
  const out = {};
  for (const v of list) out[v[key]] = (out[v[key]] ?? 0) + 1;
  return out;
};

/**
 * @param {{features: object[], plazas?: object[], boundary: Array<[number,number]>,
 *   field: {heightAt: Function, normalAt: Function}, keys: string[]}} input
 * @returns {{chunks: Array<{key: string, json: string}>, stats: object}}
 */
export function bakeGroundChunks({ features, plazas = [], boundary, field, keys }) {
  const { E, water } = applyWaterLevels(extractGround({ features, plazas }, boundary), field);
  const ctx = createGroundContext(E, { boundary, field });
  const ditches = [...inferredDitches(E.roads, ctx), ...E.waterLines];
  const ditchIndex = createLineIndex(ditches, { reach: 3 });
  const veg = placeVegetation(E, ctx);
  const props = placeProps(E, ctx);
  const chunks = keys.map((key) => {
    const weights = encodeWeights(surfaceWeights(key, ctx, ditchIndex));
    const obj = assembleChunk(key, { roads: E.roads, walks: E.walks, areas: E.areas, ditches, veg, props, weights });
    return { key, json: JSON.stringify(obj) };
  });
  const stats = {
    roadsKm: km(E.roads), walksKm: km(E.walks), soilPathsKm: km(E.soilPaths), ditchesKm: km(ditches),
    areas: countBy(E.areas, 'kind'), water, veg: countBy(veg, 'sp'),
    props: { lamps: props.lamps.length, benches: props.benches.length, bins: props.bins.length },
  };
  return { chunks, stats };
}

/** Baris laporan bake ground (+ PERINGATAN bila melewati budget). */
export function groundReport({ stats, bytes, files, timestamp, ms }) {
  const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
  const list = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ') || '—';
  const lines = [
    `[campusbake ground] OSM ${timestamp ?? '?'} · ${files} chunk · ${kb(bytes)} · ${ms} ms`,
    `  jalan ${stats.roadsKm} km · trotoar ${stats.walksKm} km · jalan tanah ${stats.soilPathsKm} km · parit ${stats.ditchesKm} km`,
    `  area: ${list(stats.areas)}`,
    ...stats.water.map((w) => `  air ${w.id}: muka ${w.level.toFixed(2)} m ${w.carved ? 'dipahat' : 'TIDAK dipahat → dilewati'}`),
    `  vegetasi: ${list(stats.veg)}`,
    `  props: PJU ${stats.props.lamps}, bangku ${stats.props.benches}, tong ${stats.props.bins}`,
  ];
  if (bytes > GROUND_BUDGET_BYTES) lines.push(`PERINGATAN: ground ${kb(bytes)} > ${kb(GROUND_BUDGET_BYTES)}`);
  return lines;
}

/** Bake ground dari cache (selalu offline: hanya membaca data-src & hasil bake terrain). */
export async function bakeGround({ log = console, paths = GROUND_PATHS, boundary = UNRI_BOUNDARY } = {}) {
  const t0 = Date.now();
  const raw = await loadOsmSource(paths.osmCache);
  const projection = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });
  const { features, plazas, timestamp } = projectOsm(raw, projection);
  const { keys, field } = await loadTerrainField(paths.districtDir);
  const { chunks, stats } = bakeGroundChunks({ features, plazas, boundary, field, keys });
  const { bytes, files } = await writeGround({ dir: paths.groundDir, manifestPath: join(paths.districtDir, 'manifest.json'), chunks });
  for (const line of groundReport({ stats, bytes, files, timestamp, ms: Date.now() - t0 })) log.info(line);
  return { stats, bytes, files };
}
```

- [ ] **Step 5: Jalankan tes; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/campusbake/groundBake.test.js
npm run lint
```
Expected: 8 tes PASS; lint 0 galat.

- [ ] **Step 6: Sambungkan ke CLI campusbake (M1)**

Di `tools/campusbake/index.js` tambahkan impor:
```js
import { bakeGround } from './ground/index.js';
```
Pada dispatcher perintah (tempat M1 menangani `terrain|ground|buildings|all`): cabang `ground` memanggil `await bakeGround({ log })` (menggantikan pesan "belum diimplementasi" bila ada), dan cabang `all` memanggil `await bakeGround({ log })` **setelah** terrain dan **sebelum** buildings. Nama variabel logger mengikuti M1 (`log`/`console`). Galat dari `bakeGround` diteruskan ke penanganan galat CLI M1 (exit code ≠ 0).

Run: `npm run bake:campus -- ground --offline`
Expected: laporan diawali `[campusbake ground] OSM …` dan exit code 0 (butuh `data-src/osm/unri.json` dari Task 6 dan terrain M1). Hasilnya diperiksa, diulang untuk determinisme, dan di-commit di Task 13 — jangan commit `public/` di task ini.

- [ ] **Step 7: Commit**

```bash
git add tools/campusbake/ground/writeGround.js tools/campusbake/ground/index.js tools/campusbake/index.js tests/campusbake/groundBake.test.js
```
```bash
git commit -m "feat(campusbake): bake ground per chunk (format v1 + ekstensi), manifest.ground, CLI ground, golden"
```

---

### Task 13: Bake ground nyata (offline), determinisme, fakta

**Files:**
- Modify (hasil bake): `public/districts/unri/manifest.json`, `public/districts/unri/ground/*.json`
- (Bila perlu) `public/districts/unri/terrain/*.bin`

- [ ] **Step 1: Pastikan terrain memakai OSM lengkap**

Run: `grep -n "osm/" tools/campusbake/config.js tools/campusbake/terrain/*.js`
Bila M1 memilih cache `data-src/osm/unri.json` saat ada (atau sudah memakainya), jalankan dulu `npm run bake:campus -- terrain --offline` agar jalan sisi selatan (z > 1.560) ikut dikondisikan; berkas `.bin` yang berubah ikut di-commit di Step 4. Bila M1 hanya membaca `stadion.json`, jangan ubah M1 — catat di laporan review ("jalan z > 1.560 belum dikondisikan terrain") dan lanjut.

- [ ] **Step 2: Bake ground dua kali, harus byte-identik**

Run:
```bash
npm run bake:campus -- ground --offline
sha1sum public/districts/unri/ground/*.json public/districts/unri/manifest.json > /tmp/ground-1.sha
npm run bake:campus -- ground --offline
sha1sum public/districts/unri/ground/*.json public/districts/unri/manifest.json | diff - /tmp/ground-1.sha && echo IDENTIK
du -ch public/districts/unri | tail -1
```
Expected laporan (angka nyata akan sedikit berbeda karena cache `unri.json` lebih lengkap dari angka "Fakta data"):
- `[campusbake ground] OSM 2026-… · N chunk` dengan N = jumlah `terrain.chunks`; ukuran ≤ 3 MB (tanpa `PERINGATAN`).
- `jalan` ±22–30 km (tersier 7 + service 15 + residential/link + sisi selatan), `trotoar` ±1–2 km, `jalan tanah` ±1,5–2,5 km, `parit` > 0 km.
- `area: parking 13–16, pitch 4–6, water 2–4, plaza 0`.
- Baris `air w327366050` (Waduk UNRI) dan `air w373856980` (Danau Buatan) **dipahat**; dua "Waduk" kecil boleh "TIDAK dipahat → dilewati" (spec §5.2.8 hanya memahat dua badan air utama).
- `vegetasi:` mahoni/angsana/saga ribuan, sawit ratusan, semak ratusan; `props: PJU` 300–700, bangku > 10, tong > 5.
- `IDENTIK`; total `public/districts/unri` ≤ 8 MB.

- [ ] **Step 3: Validasi berkas dengan parser runtime (setelah Task 15 berkas ini divalidasi lagi oleh tes)**

Run:
```bash
node -e "const m=require('./public/districts/unri/manifest.json');const fs=require('fs');let n=0;for(const k of m.ground.chunks){const j=JSON.parse(fs.readFileSync('public/districts/unri/ground/'+k+'.json','utf8'));if(j.v!==1||j.key!==k||j.weights.n!==126)throw new Error(k);n++;}console.log('ok',n, m.ground.chunks.length===m.terrain.chunks.length)"
```
Expected: `ok N true`.

- [ ] **Step 4: Commit**

```bash
git add public/districts/unri/manifest.json public/districts/unri/ground public/districts/unri/terrain
```
```bash
git commit -m "feat(districts): bake ground kampus UNRI (jalan, area, air, parit, vegetasi, props, bobot permukaan)"
```

---

### Task 14: `src/world/terrain/drape.js` — permukaan aman-mesh & drape

**Files:**
- Create: `src/world/terrain/drape.js`
- Test: `tests/drape.test.js`

- [ ] **Step 1: Samakan simpul LOD dengan M1**

Dari hasil grep Task 0 (`src/world/terrain/TerrainMesh.js`), pastikan LOD1 memakai indeks sampel `0, 4, 8, …, 124, 125`. Bila M1 memakai aturan lain (mis. tanpa 125, atau stride berbeda), sesuaikan **hanya** fungsi `nodeIndices` di Step 3 dan ekspektasi tes `nodeIndices` di Step 2 agar persis sama dengan M1 (konstanta `GROUND_LAYER.lod1Stride` di Task 21 = stride LOD1 M1).

- [ ] **Step 2: Tulis tes yang gagal**

`tests/drape.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createChunkSurface, drapePolygon, drapePolyline, nodeIndices, DRAPE } from '../src/world/terrain/drape.js';

const plane = (a = 0, b = 0, c = 0) => ({
  heightAt: (x, z) => a * x + b * z + c,
  normalAt: (x, z, out = {}) => {
    const l = Math.hypot(a, 1, b);
    return Object.assign(out, { x: -a / l, y: 1 / l, z: -b / l });
  },
});
function tris(g) {
  const p = g.getAttribute('position');
  const ix = g.index.array;
  const out = [];
  for (let i = 0; i < ix.length; i += 3) out.push([0, 1, 2].map((k) => [p.getX(ix[i + k]), p.getY(ix[i + k]), p.getZ(ix[i + k])]));
  return out;
}
const areaXZ = (t) => Math.abs((t[1][0] - t[0][0]) * (t[2][2] - t[0][2]) - (t[2][0] - t[0][0]) * (t[1][2] - t[0][2])) / 2;
const upY = (t) => (t[1][2] - t[0][2]) * (t[2][0] - t[0][0]) - (t[1][0] - t[0][0]) * (t[2][2] - t[0][2]);
const edges = (t) => [[0, 1], [1, 2], [2, 0]].map(([i, j]) => Math.hypot(t[i][0] - t[j][0], t[i][2] - t[j][2]));
const sum = (list, f) => list.reduce((s, t) => s + f(t), 0);
const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

describe('nodeIndices', () => {
  it('LOD0 = semua sampel; LOD1 = kelipatan 4 + tepi 125', () => {
    expect(nodeIndices(126, 1)).toHaveLength(126);
    const l1 = nodeIndices(126, 4);
    expect(l1.slice(0, 3)).toEqual([0, 4, 8]);
    expect(l1.slice(-2)).toEqual([124, 125]);
    expect(l1).toHaveLength(33);
  });
});

describe('createChunkSurface', () => {
  const chunk = { origin: { x: 500, z: -500 }, step: 4, n: 126 };

  it('bidang miring: tinggi & normal persis', () => {
    const s = createChunkSurface(chunk, { sample: (c, x, z) => 0.1 * x - 0.05 * z + 2 });
    expect(s.heightAt(612.3, -401.7)).toBeCloseTo(0.1 * 612.3 + 0.05 * 401.7 + 2, 9);
    const n = s.normalAt(700, -300);
    const l = Math.hypot(0.1, 1, 0.05);
    expect(n.x).toBeCloseTo(-0.1 / l, 9);
    expect(n.y).toBeCloseTo(1 / l, 9);
    expect(n.z).toBeCloseTo(0.05 / l, 9);
  });

  it('aman-mesh: ≥ kedua kemungkinan triangulasi sel (papan catur)', () => {
    const s = createChunkSurface(chunk, { sample: (c, x, z) => (((x - 500) / 4 + (z + 500) / 4) % 2 === 0 ? 0 : 1) });
    expect(s.heightAt(502, -498)).toBe(1); // pusat sel: diagonal 10–01 memberi 1, diagonal 00–11 memberi 0
    expect(s.heightAt(500, -500)).toBe(0); // tepat di simpul
  });

  it('stride 4 hanya membaca simpul LOD1 (kelipatan 16 m dari origin)', () => {
    const seen = new Set();
    const s = createChunkSurface(chunk, {
      stride: 4,
      sample: (c, x, z) => {
        seen.add(`${x - 500},${z + 500}`);
        return 0;
      },
    });
    s.heightAt(520, -480);
    expect([...seen].sort()).toEqual(['16,16', '16,32', '32,16', '32,32']);
  });

  it('di luar chunk di-clamp ke tepi', () => {
    const s = createChunkSurface(chunk, { sample: (c, x) => x });
    expect(s.heightAt(400, -300)).toBe(500);
    expect(s.heightAt(2000, -300)).toBe(1000);
  });
});

describe('drapePolyline', () => {
  it('pita lurus datar: luas = panjang × lebar, y = lift, UV dunia, menghadap atas, sisi ≤ 2 m', () => {
    const g = drapePolyline([[0, 0], [100, 0]], 10, plane(), { lift: 0.03 });
    const t = tris(g);
    expect(sum(t, areaXZ)).toBeCloseTo(1000, 2);
    for (const tri of t) {
      expect(upY(tri)).toBeGreaterThan(0);
      for (const v of tri) expect(v[1]).toBeCloseTo(0.03, 6);
      const e = edges(tri);
      expect(e.filter((x) => x <= DRAPE.segment + 1e-5).length).toBeGreaterThanOrEqual(2);
      for (const x of e) expect(x).toBeLessThanOrEqual(DRAPE.segment * Math.SQRT2 + 1e-5);
    }
    const uv = g.getAttribute('uv');
    const pos = g.getAttribute('position');
    for (let i = 0; i < uv.count; i += 1) {
      expect(uv.getX(i)).toBeCloseTo(pos.getX(i), 6);
      expect(uv.getY(i)).toBeCloseTo(pos.getZ(i), 6);
    }
  });

  it('lereng 6 %: y = 0,06·x + lift di setiap simpul', () => {
    const pos = drapePolyline([[0, 0], [30, 17]], 6, plane(0.06), { lift: 0.05 }).getAttribute('position');
    for (let i = 0; i < pos.count; i += 1) expect(pos.getY(i)).toBeCloseTo(0.06 * pos.getX(i) + 0.05, 5);
  });

  it('clipRect: hanya bagian di dalam persegi chunk', () => {
    const t = tris(drapePolyline([[-50, 0], [50, 0]], 10, plane(), { clipRect: { minX: 0, minZ: -250, maxX: 500, maxZ: 250 } }));
    expect(sum(t, areaXZ)).toBeCloseTo(500, 2);
    for (const tri of t) for (const v of tri) expect(v[0]).toBeGreaterThanOrEqual(-1e-6);
  });

  it('bundaran tertutup: simpul berhingga, sudut luar dimiter', () => {
    const g = drapePolyline([[0, 0], [40, 0], [40, 40], [0, 40], [0, 0]], 4, plane());
    g.computeBoundingBox();
    expect(g.boundingBox.min.x).toBeCloseTo(-2, 5);
    expect(g.boundingBox.max.z).toBeCloseTo(42, 5);
    expect([...g.getAttribute('position').array].every(Number.isFinite)).toBe(true);
  });

  it('masukan tak valid → geometri kosong', () => {
    expect(drapePolyline([[0, 0]], 4, plane()).getAttribute('position')).toBeUndefined();
    expect(drapePolyline([[0, 0], [10, 0]], 0, plane()).getAttribute('position')).toBeUndefined();
  });
});

describe('drapePolygon', () => {
  it('persegi 10×10 tak sejajar kisi: luas 100, semua tepi ≤ maxEdge, y = lift, menghadap atas', () => {
    const t = tris(drapePolygon([sq(3.3, 7.1, 13.3, 17.1)], plane(), { lift: 0.04 }));
    expect(sum(t, areaXZ)).toBeCloseTo(100, 2);
    for (const tri of t) {
      expect(upY(tri)).toBeGreaterThan(0);
      for (const e of edges(tri)) expect(e).toBeLessThanOrEqual(DRAPE.maxEdge + 1e-5);
      for (const v of tri) expect(v[1]).toBeCloseTo(0.04, 6);
    }
  });

  it('lubang dihormati: luas 100 − 16', () => {
    const t = tris(drapePolygon([sq(3.3, 7.1, 13.3, 17.1), sq(5, 9, 9, 13)], plane()));
    expect(sum(t, areaXZ)).toBeCloseTo(84, 2);
  });

  it('lereng: y mengikuti bidang', () => {
    const pos = drapePolygon([sq(0, 0, 8, 8)], plane(0.1, -0.2, 1), { lift: 0 }).getAttribute('position');
    for (let i = 0; i < pos.count; i += 1) expect(pos.getY(i)).toBeCloseTo(0.1 * pos.getX(i) - 0.2 * pos.getZ(i) + 1, 5);
  });

  it('clipRect memotong ke persegi chunk', () => {
    const t = tris(drapePolygon([sq(-5, 0, 5, 10)], plane(), { clipRect: { minX: 0, minZ: 0, maxX: 500, maxZ: 500 } }));
    expect(sum(t, areaXZ)).toBeCloseTo(50, 2);
  });
});
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/drape.test.js`
Expected: FAIL — modul `drape.js` tidak ada.

- [ ] **Step 4: Implementasi**

`src/world/terrain/drape.js`:
```js
/**
 * Mesh ter-drape (spec §5.3): pita polyline & poligon mengikuti permukaan terrain. Dipecah ≤ 2 m (memanjang:
 * titik pecah di garis kisi GLOBAL berjarak segment/√2 sehingga chunk tetangga memecah segmen yang sama di titik
 * yang sama; melintang: kolom ≤ segment; poligon: sel kisi maxEdge/√2), y = tinggi permukaan + lift, UV =
 * koordinat dunia (m) agar surfaceMaps (repeat = 1/TILE_M) konsisten, normal dari permukaan.
 * `field` = {heightAt(x,z), normalAt?(x,z,out)}: HeightField M1 atau createChunkSurface (aman-mesh).
 * Material pemakai wajib polygonOffset (groundMaterials distrik). `clipRect` memotong hasil tepat ke persegi
 * chunk → pita/poligon dari chunk bertetangga bersambung tanpa tumpang atau celah.
 */
import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';
import { clipPolygonToRect, ringBounds } from '../../geo/polygon.js';
import { sampleChunk } from '../../geo/terrain/heightfield.js';

export const DRAPE = Object.freeze({
  segment: 2,
  maxEdge: 2,
  miterLimit: 2.5,
  /** Lift di atas permukaan (m): spec §5.3 jalan 0,03, trotoar 0,05; lapisan lain di antaranya. */
  lift: Object.freeze({ pitch: 0.02, ditch: 0.02, road: 0.03, marking: 0.035, paving: 0.04, walk: 0.05 }),
});

const KEY_SCALE = 1e4;
const near = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
const unit = (x, z) => {
  const l = Math.hypot(x, z);
  return l > 0 ? [x / l, z / l] : null;
};

/** Penumpuk geometri: simpul dibagi per posisi, segitiga dipaksa menghadap +Y. */
function createBuilder(field, lift) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const keys = new Map();
  const tmp = { x: 0, y: 1, z: 0 };
  const vertex = (x, z) => {
    const k = `${Math.round(x * KEY_SCALE)},${Math.round(z * KEY_SCALE)}`;
    const hit = keys.get(k);
    if (hit !== undefined) return hit;
    const n = field.normalAt ? field.normalAt(x, z, tmp) : tmp;
    pos.push(x, field.heightAt(x, z) + lift, z);
    nor.push(n.x, n.y, n.z);
    uv.push(x, z);
    const i = pos.length / 3 - 1;
    keys.set(k, i);
    return i;
  };
  const tri = (a, b, c) => {
    const ax = pos[a * 3];
    const az = pos[a * 3 + 2];
    const up = (pos[b * 3 + 2] - az) * (pos[c * 3] - ax) - (pos[b * 3] - ax) * (pos[c * 3 + 2] - az);
    if (Math.abs(up) < 1e-12) return;
    if (up > 0) idx.push(a, b, c);
    else idx.push(a, c, b);
  };
  /** Kipas segitiga untuk poligon cembung [[x, z]…]. */
  const fan = (poly) => {
    const v = poly.map(([x, z]) => vertex(x, z));
    for (let k = 1; k < v.length - 1; k += 1) tri(v[0], v[k], v[k + 1]);
  };
  const build = () => {
    const g = new BufferGeometry();
    if (idx.length === 0) return g;
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  };
  return { fan, build };
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    if (out.length === 0 || !near(out[out.length - 1], p)) out.push([p[0], p[1]]);
  }
  return out;
}

/** Sisipkan titik di setiap perpotongan segmen dengan garis kisi global x = k·cell dan z = k·cell. */
function latticeSplit(line, cell) {
  const out = [line[0]];
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const ts = [];
    for (const ax of [0, 1]) {
      const d = b[ax] - a[ax];
      if (d === 0) continue;
      const lo = Math.min(a[ax], b[ax]);
      const hi = Math.max(a[ax], b[ax]);
      for (let k = Math.floor(lo / cell) + 1; k * cell < hi; k += 1) ts.push((k * cell - a[ax]) / d);
    }
    ts.sort((p, q) => p - q);
    let last = 0;
    for (const t of ts) {
      if (t - last > 1e-9 && 1 - t > 1e-9) {
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        last = t;
      }
    }
    out.push(b);
  }
  return dedupe(out);
}

/** Penampang tiap simpul: cols+1 titik dari kiri ke kanan; simpul dalam memakai garis bagi + miter. */
function sections(line, closed, half, cols) {
  const n = line.length;
  return line.map((p, i) => {
    const prev = i > 0 ? line[i - 1] : (closed ? line[n - 2] : null);
    const next = i < n - 1 ? line[i + 1] : (closed ? line[1] : null);
    const d1 = prev ? unit(p[0] - prev[0], p[1] - prev[1]) : null;
    const d2 = next ? unit(next[0] - p[0], next[1] - p[1]) : null;
    const t = (d1 && d2 ? unit(d1[0] + d2[0], d1[1] + d2[1]) : null) ?? d2 ?? d1;
    const ref = d2 ?? d1;
    const k = 1 / Math.max(t[0] * ref[0] + t[1] * ref[1], 1 / DRAPE.miterLimit);
    const nx = -t[1] * k;
    const nz = t[0] * k;
    const out = [];
    for (let c = 0; c <= cols; c += 1) {
      const s = -half + (2 * half * c) / cols;
      out.push([p[0] + nx * s, p[1] + nz * s]);
    }
    return out;
  });
}

const outsideRect = (b, r) => b.maxX <= r.minX || b.minX >= r.maxX || b.maxZ <= r.minZ || b.minZ >= r.maxZ;
const insideRect = (b, r) => b.minX >= r.minX && b.maxX <= r.maxX && b.minZ >= r.minZ && b.maxZ <= r.maxZ;

/**
 * Pita polyline ter-drape.
 * @param {Array<[number, number]>} pts polyline dunia (tertutup bila titik akhir = awal)
 * @param {number} width lebar (m)
 * @param {{heightAt(x:number,z:number):number, normalAt?(x:number,z:number,out?:object):{x:number,y:number,z:number}}} field
 * @param {{lift?: number, segment?: number, clipRect?: {minX:number,minZ:number,maxX:number,maxZ:number}|null}} [opts]
 * @returns {BufferGeometry} position/normal/uv berindeks; kosong (tanpa atribut) bila masukan tak valid
 */
export function drapePolyline(pts, width, field, { lift = DRAPE.lift.road, segment = DRAPE.segment, clipRect = null } = {}) {
  const b = createBuilder(field, lift);
  const base = Array.isArray(pts) ? dedupe(pts) : [];
  if (!(width > 0) || base.length < 2) return b.build();
  const line = latticeSplit(base, segment / Math.SQRT2);
  const closed = line.length > 3 && near(line[0], line[line.length - 1]);
  const cols = Math.max(1, Math.ceil(width / segment));
  const secs = sections(line, closed, width / 2, cols);
  for (let i = 0; i < secs.length - 1; i += 1) {
    for (let c = 0; c < cols; c += 1) {
      const quad = [secs[i][c], secs[i][c + 1], secs[i + 1][c + 1], secs[i + 1][c]];
      if (!clipRect) {
        b.fan(quad);
        continue;
      }
      const qb = ringBounds(quad);
      if (outsideRect(qb, clipRect)) continue;
      const piece = insideRect(qb, clipRect) ? quad : clipPolygonToRect(quad, clipRect);
      if (piece.length >= 3) b.fan(piece);
    }
  }
  return b.build();
}

/**
 * Poligon ter-drape (dengan lubang): triangulasi earcut lalu tiap segitiga dipotong per sel kisi global
 * maxEdge/√2 (semua tepi ≤ maxEdge), tinggi per simpul dari `field`.
 * @param {Array<Array<[number, number]>>} rings [luar, ...lubang] dunia, terbuka
 */
export function drapePolygon(rings, field, { lift = DRAPE.lift.paving, maxEdge = DRAPE.maxEdge, clipRect = null } = {}) {
  const b = createBuilder(field, lift);
  const valid = (Array.isArray(rings) ? rings : []).map((r) => dedupe(r ?? [])).filter((r) => r.length >= 3);
  if (valid.length === 0) return b.build();
  const contour = valid[0].map(([x, z]) => new Vector2(x, z));
  const holes = valid.slice(1).map((h) => h.map(([x, z]) => new Vector2(x, z)));
  const faces = ShapeUtils.triangulateShape(contour, holes);
  // triangulateShape dapat membuang titik ujung duplikat di tempat: indeks mengacu array setelah dipanggil.
  const verts = [...contour, ...holes.flat()].map((v) => [v.x, v.y]);
  const cell = maxEdge / Math.SQRT2;
  for (const [i0, i1, i2] of faces) {
    const tri = [verts[i0], verts[i1], verts[i2]];
    const tb = ringBounds(tri);
    for (let j = Math.floor(tb.minZ / cell); j * cell < tb.maxZ; j += 1) {
      for (let i = Math.floor(tb.minX / cell); i * cell < tb.maxX; i += 1) {
        let rect = { minX: i * cell, minZ: j * cell, maxX: (i + 1) * cell, maxZ: (j + 1) * cell };
        if (clipRect) {
          rect = {
            minX: Math.max(rect.minX, clipRect.minX), minZ: Math.max(rect.minZ, clipRect.minZ),
            maxX: Math.min(rect.maxX, clipRect.maxX), maxZ: Math.min(rect.maxZ, clipRect.maxZ),
          };
          if (rect.minX >= rect.maxX || rect.minZ >= rect.maxZ) continue;
        }
        const piece = clipPolygonToRect(tri, rect);
        if (piece.length >= 3) b.fan(piece);
      }
    }
  }
  return b.build();
}

/** Indeks simpul LOD sepanjang satu sisi chunk: 0, stride, 2·stride, …, dan n−1 (tepi bersama). = TerrainMesh M1. */
export function nodeIndices(n, stride) {
  const out = [];
  for (let i = 0; i < n - 1; i += stride) out.push(i);
  out.push(n - 1);
  return out;
}

/**
 * Permukaan "aman-mesh" satu chunk terrain untuk LOD dengan `stride` (1 = LOD0, 4 = LOD1): tinggi di (x, z) =
 * MAKSIMUM dua kemungkinan triangulasi sel simpul LOD, sehingga mesh ter-drape tidak pernah di bawah mesh
 * terrain apa pun arah diagonal M1 (selisih ≤ |puntiran sel|/2, ≈ 0 di jalan yang dikondisikan). Hanya chunk
 * ini yang dibaca (titik di luar di-clamp) → tidak bergantung chunk tetangga sudah dimuat. Normal = beda hingga.
 * @param {{origin:{x:number,z:number}, step:number, n:number}} chunk Chunk M1 (spec §4.1)
 * @param {{stride?: number, sample?: (chunk: object, x: number, z: number) => number}} [opts]
 */
export function createChunkSurface(chunk, { stride = 1, sample = sampleChunk } = {}) {
  const { origin, step, n } = chunk;
  const nodes = nodeIndices(n, stride).map((i) => i * step);
  const size = (n - 1) * step;
  const locate = (v) => {
    const l = Math.min(Math.max(v, 0), size);
    let lo = 0;
    let hi = nodes.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (nodes[mid] <= l) lo = mid;
      else hi = mid;
    }
    return { a: nodes[lo], b: nodes[hi], t: (l - nodes[lo]) / (nodes[hi] - nodes[lo]) };
  };
  const h = (lx, lz) => sample(chunk, origin.x + lx, origin.z + lz);
  const heightAt = (x, z) => {
    const X = locate(x - origin.x);
    const Z = locate(z - origin.z);
    const h00 = h(X.a, Z.a);
    const h10 = h(X.b, Z.a);
    const h01 = h(X.a, Z.b);
    const h11 = h(X.b, Z.b);
    const u = X.t;
    const v = Z.t;
    const diagA = u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + v * (h01 - h00) + u * (h11 - h01);
    const diagB = u + v <= 1 ? h00 + u * (h10 - h00) + v * (h01 - h00) : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
    return Math.max(diagA, diagB);
  };
  const D = 0.5;
  const normalAt = (x, z, out = { x: 0, y: 1, z: 0 }) => {
    const dx = (heightAt(x + D, z) - heightAt(x - D, z)) / (2 * D);
    const dz = (heightAt(x, z + D) - heightAt(x, z - D)) / (2 * D);
    const len = Math.hypot(dx, 1, dz);
    out.x = -dx / len;
    out.y = 1 / len;
    out.z = -dz / len;
    return out;
  };
  return Object.freeze({ heightAt, normalAt, origin, size, stride });
}
```

- [ ] **Step 5: Jalankan tes; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/drape.test.js
npm run lint
```
Expected: 14 tes PASS; lint 0 galat.

- [ ] **Step 6: Commit**

```bash
git add src/world/terrain/drape.js tests/drape.test.js
```
```bash
git commit -m "feat(world): drape pita & poligon (pecah ≤ 2 m, UV dunia, klip chunk) + permukaan aman-mesh"
```

---

### Task 15: Data ground runtime & warna permukaan

**Files:**
- Create: `src/districts/unri/groundData.js`, `src/districts/unri/surfaceTint.js`
- Test: `tests/districts/unriGroundData.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/districts/unriGroundData.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { Color } from 'three';
import { CITY_GROUND_COLOR } from '../../src/city/cityMaterials.js';
import { COLORS } from '../../src/config/constants.js';
import { GroundDataError, parseGroundChunk } from '../../src/districts/unri/groundData.js';
import { SURFACE_COLORS, sampleColor, surfaceColors, surfaceTints } from '../../src/districts/unri/surfaceTint.js';

const b64 = (arr) => Buffer.from(Uint8Array.from(arr)).toString('base64');
const base = () => ({
  v: 1,
  key: '-2_1',
  roads: [{ cls: 'tertiary', w: 70, pts: [0, 0, 100, 0] }],
  walks: [{ w: 20, pts: [0, 10, 0, 50] }],
  areas: [{ kind: 'water', rings: [[0, 0, 40, 0, 40, 40]], level: -0.4 }],
  ditches: [{ w: 10, pts: [5, 5, 50, 5] }],
  veg: [{ sp: 'mahoni', pts: [10, 20, 30, 40] }],
  props: { lamps: [10, 20, 180], benches: [], bins: [7, 8] },
  weights: { n: 4, grass: b64(new Array(16).fill(255)), soil: b64(new Array(16).fill(0)), wet: b64(new Array(16).fill(0)) },
});
const closePt = (p, q) => {
  expect(p[0]).toBeCloseTo(q[0], 9);
  expect(p[1]).toBeCloseTo(q[1], 9);
};

describe('parseGroundChunk', () => {
  it('0,1 m relatif sudut barat-laut chunk → dunia; yaw derajat → radian; bobot terdekode', () => {
    const d = parseGroundChunk(base(), '-2_1');
    expect(d.origin).toEqual({ x: -1000, z: 500 });
    expect(d.roads[0].cls).toBe('tertiary');
    expect(d.roads[0].w).toBeCloseTo(7, 12);
    closePt(d.roads[0].pts[1], [-990, 500]);
    expect(d.walks[0].w).toBeCloseTo(2, 12);
    expect(d.areas[0]).toMatchObject({ kind: 'water', level: -0.4 });
    closePt(d.areas[0].rings[0][1], [-996, 500]);
    expect(d.veg.map((v) => v.sp)).toEqual(['mahoni', 'mahoni']);
    closePt([d.veg[1].x, d.veg[1].z], [-997, 504]);
    expect(d.props.lamps[0].yaw).toBeCloseTo(Math.PI, 12);
    closePt([d.props.bins[0].x, d.props.bins[0].z], [-999.3, 500.8]);
    expect(d.ditches[0].w).toBeCloseTo(1, 12);
    expect(d.weights.n).toBe(4);
    expect(d.weights.grass[15]).toBe(255);
  });

  it.each([
    ['v salah', (j) => { j.v = 2; }, /v harus 1/],
    ['key salah', (j) => { j.key = '0_0'; }, /tidak cocok/],
    ['pts ganjil', (j) => { j.roads[0].pts = [0, 0, 1]; }, /roads\.pts/],
    ['bukan bulat', (j) => { j.walks[0].pts = [0, 0.5, 1, 1]; }, /walks\.pts/],
    ['kind asing', (j) => { j.areas[0].kind = 'kolam'; }, /tidak dikenal/],
    ['air tanpa level', (j) => { delete j.areas[0].level; }, /tanpa level/],
    ['spesies asing', (j) => { j.veg[0].sp = 'jati'; }, /tidak dikenal/],
    ['lamps bukan kelipatan 3', (j) => { j.props.lamps = [1, 2]; }, /kelipatan 3/],
    ['bobot salah panjang', (j) => { j.weights.soil = b64([1, 2]); }, /panjang/],
  ])('%s → GroundDataError', (_, mutate, re) => {
    const j = base();
    mutate(j);
    expect(() => parseGroundChunk(j, '-2_1')).toThrow(GroundDataError);
    expect(() => parseGroundChunk(j, '-2_1')).toThrow(re);
  });

  it('field ekstensi (ditches/veg/props) boleh tidak ada', () => {
    const j = base();
    delete j.ditches;
    delete j.veg;
    delete j.props;
    const d = parseGroundChunk(j, '-2_1');
    expect(d.ditches).toEqual([]);
    expect(d.veg).toEqual([]);
    expect(d.props).toEqual({ lamps: [], benches: [], bins: [] });
  });
});

describe('surfaceTint', () => {
  const tints = surfaceTints();

  it('tint rumput = 1; tint tanah × warna dasar rumput = warna tanah (linear)', () => {
    expect(tints.grass).toEqual([1, 1, 1]);
    expect(tints.soil[0] * new Color(COLORS.grass).r).toBeCloseTo(new Color(SURFACE_COLORS.soil).r, 9);
  });

  it('warna di luar distrik = CITY_GROUND_COLOR (satu nada dengan tanah kota)', () => {
    expect(SURFACE_COLORS.kota).toBe(CITY_GROUND_COLOR);
  });

  it('sampleColor: campuran berbobot; semua nol → tint kota', () => {
    expect(sampleColor(0, 0, 0, tints)).toEqual(tints.kota);
    expect(sampleColor(128, 127, 0, tints)[1]).toBeCloseTo((128 + 127 * tints.soil[1]) / 255, 9);
  });

  it('surfaceColors: bilinear antar sampel grid 4 m; di luar grid di-clamp', () => {
    const w = { n: 2, grass: Uint8Array.from([255, 0, 255, 0]), soil: Uint8Array.from([0, 255, 0, 255]), wet: new Uint8Array(4) };
    const c = surfaceColors(Float32Array.from([0, 0, 2, 0, 4, 4, -10, 0]), w, { x: 0, z: 0 }, tints);
    expect([c[0], c[1], c[2]]).toEqual([1, 1, 1]);
    expect(c[3]).toBeCloseTo((1 + tints.soil[0]) / 2, 6);
    expect(c[6]).toBeCloseTo(tints.soil[0], 6);
    expect(c[9]).toBeCloseTo(1, 6);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/unriGroundData.test.js`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Implementasi `groundData.js`**

```js
/**
 * Parser + validator ground/<key>.json (format v1 + ekstensi M2, lihat plan M2). Koordinat bulat 0,1 m relatif
 * sudut barat-laut chunk → dunia (m); yaw derajat → radian; bobot base64 → Uint8Array. Galat → GroundDataError
 * (pemanggil melewati chunk itu, spec §10). Murni (tanpa three).
 */
import { parseTileKey } from '../../geo/tiles.js';

export class GroundDataError extends Error {}

export const GROUND_UNIT = 0.1;
export const GROUND_SPECIES = Object.freeze(['mahoni', 'angsana', 'saga', 'sawit', 'semak']);
export const GROUND_AREA_KINDS = Object.freeze(['parking', 'plaza', 'pitch', 'water']);

const fail = (key, msg) => {
  throw new GroundDataError(`ground ${key}: ${msg}`);
};
const isInts = (a) => Array.isArray(a) && a.every(Number.isInteger);

function points(flat, origin, key, what, min) {
  if (!isInts(flat) || flat.length % 2 !== 0 || flat.length < min) fail(key, `${what} bukan array bilangan bulat genap ≥ ${min}`);
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push([origin.x + flat[i] * GROUND_UNIT, origin.z + flat[i + 1] * GROUND_UNIT]);
  return out;
}

function decodeBytes(b64, n, key, name) {
  if (typeof b64 !== 'string') fail(key, `weights.${name} bukan base64`);
  let bin = '';
  try {
    bin = atob(b64);
  } catch {
    fail(key, `weights.${name} base64 rusak`);
  }
  if (bin.length !== n * n) fail(key, `weights.${name} panjang ${bin.length} ≠ ${n * n}`);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * @param {unknown} json isi berkas
 * @param {string} key kunci chunk yang diminta ("ix_iz")
 * @returns {{key:string, origin:{x:number,z:number}, roads:Array<{cls:string,w:number,pts:Array<[number,number]>}>,
 *   walks:Array<{w:number,pts:Array<[number,number]>}>, areas:Array<{kind:string,rings:Array<Array<[number,number]>>,level?:number}>,
 *   ditches:Array<{w:number,pts:Array<[number,number]>}>, veg:Array<{sp:string,x:number,z:number}>,
 *   props:{lamps:Array<{x,z,yaw}>, benches:Array<{x,z,yaw}>, bins:Array<{x,z}>},
 *   weights:{n:number, grass:Uint8Array, soil:Uint8Array, wet:Uint8Array}}}
 */
export function parseGroundChunk(json, key, { size = 500 } = {}) {
  if (!json || json.v !== 1) fail(key, 'v harus 1');
  if (json.key !== key) fail(key, `key berkas "${json.key}" tidak cocok`);
  const t = parseTileKey(key);
  if (!t) fail(key, 'kunci tidak valid');
  const origin = { x: t.ix * size, z: t.iz * size };
  const list = (v, what) => {
    if (!Array.isArray(v)) fail(key, `${what} harus array`);
    return v;
  };
  const width = (w, what) => {
    if (!Number.isInteger(w) || w <= 0) fail(key, `${what}.w tidak valid`);
    return w * GROUND_UNIT;
  };
  const roads = list(json.roads, 'roads').map((r) => ({ cls: String(r.cls), w: width(r.w, 'roads'), pts: points(r.pts, origin, key, 'roads.pts', 4) }));
  const walks = list(json.walks, 'walks').map((r) => ({ w: width(r.w, 'walks'), pts: points(r.pts, origin, key, 'walks.pts', 4) }));
  const areas = list(json.areas, 'areas').map((a) => {
    if (!GROUND_AREA_KINDS.includes(a.kind)) fail(key, `areas.kind "${a.kind}" tidak dikenal`);
    const rings = list(a.rings, 'areas.rings').map((r) => points(r, origin, key, 'areas.rings', 6));
    if (rings.length === 0) fail(key, 'areas.rings kosong');
    if (a.kind !== 'water') return { kind: a.kind, rings };
    if (!Number.isFinite(a.level)) fail(key, 'area air tanpa level');
    return { kind: a.kind, rings, level: a.level };
  });
  const ditches = list(json.ditches ?? [], 'ditches').map((r) => ({ w: width(r.w, 'ditches'), pts: points(r.pts, origin, key, 'ditches.pts', 4) }));
  const veg = list(json.veg ?? [], 'veg').flatMap((v) => {
    if (!GROUND_SPECIES.includes(v.sp)) fail(key, `veg.sp "${v.sp}" tidak dikenal`);
    return points(v.pts, origin, key, 'veg.pts', 2).map(([x, z]) => ({ sp: v.sp, x, z }));
  });
  const props = json.props ?? {};
  const triples = (flat = [], what) => {
    if (!isInts(flat) || flat.length % 3 !== 0) fail(key, `props.${what} harus bilangan bulat kelipatan 3`);
    const out = [];
    for (let i = 0; i < flat.length; i += 3) {
      out.push({ x: origin.x + flat[i] * GROUND_UNIT, z: origin.z + flat[i + 1] * GROUND_UNIT, yaw: (flat[i + 2] * Math.PI) / 180 });
    }
    return out;
  };
  const bins = points(props.bins ?? [], origin, key, 'props.bins', 0).map(([x, z]) => ({ x, z }));
  const w = json.weights;
  if (!w || !Number.isInteger(w.n) || w.n < 2) fail(key, 'weights.n tidak valid');
  return {
    key, origin, roads, walks, areas, ditches, veg,
    props: { lamps: triples(props.lamps, 'lamps'), benches: triples(props.benches, 'benches'), bins },
    weights: { n: w.n, grass: decodeBytes(w.grass, w.n, key, 'grass'), soil: decodeBytes(w.soil, w.n, key, 'soil'), wet: decodeBytes(w.wet, w.n, key, 'wet') },
  };
}
```

- [ ] **Step 4: Implementasi `surfaceTint.js`**

```js
/**
 * Warna vertex terrain distrik dari bobot permukaan (spec §5.3). Material terrain memakai tekstur rumput
 * (surfaceMaps('grass'), basis COLORS.grass) × warna vertex; tint = warna sasaran / warna basis (linear) sehingga
 * rumput tampil apa adanya, tanah merah laterit dan tanah basah tampil sesuai sasaran. Sampel berbobot nol (di
 * luar distrik) memakai warna tanah kota (CITY_GROUND_COLOR) agar tidak ada belang di tepi chunk terrain.
 * Murni kecuali konversi warna (three Color).
 */
import { Color } from 'three';
import { COLORS } from '../../config/constants.js';

/** Warna sasaran sRGB. soil/wet [INFERENSI visual tanah laterit Pekanbaru]; kota = CITY_GROUND_COLOR (src/city). */
export const SURFACE_COLORS = Object.freeze({ soil: 0xa8613f, wet: 0x6b6446, kota: 0xb9b59a });

/** Pengali warna vertex (linear) per kanal. */
export function surfaceTints(base = COLORS.grass, colors = SURFACE_COLORS) {
  const b = new Color(base);
  const ratio = (hex) => {
    const c = new Color(hex);
    return [c.r / b.r, c.g / b.g, c.b / b.b];
  };
  return Object.freeze({ grass: [1, 1, 1], soil: ratio(colors.soil), wet: ratio(colors.wet), kota: ratio(colors.kota) });
}

/** Warna (linear) satu sampel bobot byte; semua nol → tint kota. */
export function sampleColor(g, s, w, tints, out = [0, 0, 0]) {
  const t = g + s + w;
  for (let k = 0; k < 3; k += 1) {
    out[k] = t === 0 ? tints.kota[k] : (g * tints.grass[k] + s * tints.soil[k] + w * tints.wet[k]) / t;
  }
  return out;
}

/**
 * Warna vertex untuk titik dunia xz (Float32Array [x0, z0, x1, z1, …]): interpolasi bilinear warna sampel grid
 * bobot (sampel (i, j) di origin + (i·step, j·step), baris-mayor j lalu i); di luar grid di-clamp.
 * @returns {Float32Array} rgb per titik
 */
export function surfaceColors(xz, weights, origin, tints, step = 4) {
  const { n } = weights;
  const cache = new Float32Array(n * n * 3);
  const tmp = [0, 0, 0];
  for (let i = 0; i < n * n; i += 1) {
    sampleColor(weights.grass[i], weights.soil[i], weights.wet[i], tints, tmp);
    cache[i * 3] = tmp[0];
    cache[i * 3 + 1] = tmp[1];
    cache[i * 3 + 2] = tmp[2];
  }
  const count = xz.length / 2;
  const out = new Float32Array(count * 3);
  for (let v = 0; v < count; v += 1) {
    const fx = Math.min(Math.max((xz[2 * v] - origin.x) / step, 0), n - 1);
    const fz = Math.min(Math.max((xz[2 * v + 1] - origin.z) / step, 0), n - 1);
    const i0 = Math.min(Math.floor(fx), n - 2);
    const j0 = Math.min(Math.floor(fz), n - 2);
    const u = fx - i0;
    const t = fz - j0;
    for (let k = 0; k < 3; k += 1) {
      const c00 = cache[(j0 * n + i0) * 3 + k];
      const c10 = cache[(j0 * n + i0 + 1) * 3 + k];
      const c01 = cache[((j0 + 1) * n + i0) * 3 + k];
      const c11 = cache[((j0 + 1) * n + i0 + 1) * 3 + k];
      out[v * 3 + k] = (c00 * (1 - u) + c10 * u) * (1 - t) + (c01 * (1 - u) + c11 * u) * t;
    }
  }
  return out;
}
```

- [ ] **Step 5: Jalankan tes; validasi berkas bake nyata; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/districts/unriGroundData.test.js
node --input-type=module -e "import { readFileSync } from 'node:fs'; import { parseGroundChunk } from './src/districts/unri/groundData.js'; const m = JSON.parse(readFileSync('public/districts/unri/manifest.json', 'utf8')); for (const k of m.ground.chunks) parseGroundChunk(JSON.parse(readFileSync('public/districts/unri/ground/' + k + '.json', 'utf8')), k); console.log('valid', m.ground.chunks.length);"
npm run lint
```
Expected: 15 tes PASS; `valid N` (semua berkas Task 13 lolos parser runtime); lint 0 galat.

- [ ] **Step 6: Commit**

```bash
git add src/districts/unri/groundData.js src/districts/unri/surfaceTint.js tests/districts/unriGroundData.test.js
```
```bash
git commit -m "feat(districts): parser data ground UNRI + warna vertex permukaan (rumput/tanah merah/basah/kota)"
```

---

### Task 16: Material distrik, permukaan keras, air & parit (runtime)

**Files:**
- Create: `src/districts/unri/groundMaterials.js`, `src/districts/unri/ground.js`, `src/districts/unri/water.js`
- Test: `tests/districts/unriGroundMeshes.test.js`

- [ ] **Step 1: Tulis tes (logika kecil yang berisiko: marka, gabung mesh, bidang air, pewarnaan terrain)**

`tests/districts/unriGroundMeshes.test.js`:
```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { dashIntervals, mergedMesh, tintTerrainRoot } from '../../src/districts/unri/ground.js';
import { waterPlaneGeometry } from '../../src/districts/unri/water.js';
import { surfaceTints } from '../../src/districts/unri/surfaceTint.js';
import { drapePolyline } from '../../src/world/terrain/drape.js';

const flat = { heightAt: () => 0, normalAt: (x, z, out = {}) => Object.assign(out, { x: 0, y: 1, z: 0 }) };

describe('ground runtime', () => {
  it('dashIntervals: 3 m garis / 5 m celah mulai 2,5 m', () => {
    expect(dashIntervals(20)).toEqual([[2.5, 5.5], [10.5, 13.5]]);
    expect(dashIntervals(4)).toEqual([]);
  });

  it('mergedMesh: gabung per material, buang geometri kosong, tandai milik chunk; semua kosong → null', () => {
    const mat = new THREE.MeshBasicMaterial();
    const a = drapePolyline([[0, 0], [10, 0]], 2, flat);
    const b = drapePolyline([[0, 5], [10, 5]], 2, flat);
    const count = a.index.count + b.index.count;
    const mesh = mergedMesh([a, drapePolyline([[0, 0]], 2, flat), b], mat, 'aspal+0_0');
    expect(mesh.name).toBe('aspal+0_0');
    expect(mesh.geometry.index.count).toBe(count);
    expect(mesh.userData.ownsGeometry).toBe(true);
    expect(mergedMesh([drapePolyline([[0, 0]], 2, flat)], mat, 'x')).toBeNull();
  });

  it('waterPlaneGeometry: datar di muka air, menghadap atas, lubang dihormati', () => {
    const g = waterPlaneGeometry([[[0, 0], [10, 0], [10, 10], [0, 10]], [[4, 4], [6, 4], [6, 6], [4, 6]]], -0.4);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i += 1) expect(p.getY(i)).toBeCloseTo(-0.4, 6);
    let area = 0;
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) {
      const [a, b, c] = [ix[i], ix[i + 1], ix[i + 2]];
      const up = (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a)) - (p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a));
      expect(up).toBeGreaterThan(0);
      area += up / 2;
    }
    expect(area).toBeCloseTo(96, 4);
  });

  it('tintTerrainRoot: warna vertex dari posisi dunia, material diganti, ditandai permukaan basah', () => {
    const geo = new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    mesh.position.set(2, 0, 2);
    const root = new THREE.Group();
    root.add(mesh);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true });
    const tints = surfaceTints();
    const weights = { n: 2, grass: Uint8Array.from([255, 0, 255, 0]), soil: Uint8Array.from([0, 255, 0, 255]), wet: new Uint8Array(4) };
    tintTerrainRoot(root, weights, { x: 0, z: 0 }, mat, tints);
    expect(mesh.material).toBe(mat);
    expect(mesh.userData.wetSurface).toBe(true);
    const col = geo.getAttribute('color');
    const pos = geo.getAttribute('position');
    for (let i = 0; i < col.count; i += 1) {
      const worldX = pos.getX(i) + 2;
      expect(col.getX(i)).toBeCloseTo(worldX === 0 ? 1 : tints.soil[0], 5);
    }
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/unriGroundMeshes.test.js`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Implementasi `groundMaterials.js`**

```js
/**
 * Material tanah distrik UNRI (satu set per ResourceScope distrik). Permukaan bertekstur surfaceMaps
 * (UV dunia bersatuan meter) dengan polygonOffset berjenjang (lapisan lebih atas = offset lebih besar) di atas
 * lift drape (DRAPE.lift) → tidak ada z-fighting antar lapisan maupun dengan terrain. Nama material untuk debug;
 * registry basah memilih berdasarkan NAMA MESH (ground.js), malam berdasarkan userData.nightEmissive.
 */
import { MeshLambertMaterial, MeshStandardMaterial } from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { COLORS } from '../../config/constants.js';
import { GROUND_COLORS, surfaceMaterial } from '../../world/Ground.materials.js';

/**
 * Pengali warna. asphalt: tekstur aspal (basis COLORS.asphalt) × 0xb3b0a9 ≈ jalan tersier kota #484b51 (linear:
 * 0,065/0,147 ≈ 0,44) agar sambungan kota–distrik tidak berganti nada. pitch: rumput lapangan sedikit lebih
 * terang. water: WATER_COLOR citybake (#3f6f8f). ditch: air parit keruh [INFERENSI].
 */
export const UNRI_GROUND_COLORS = Object.freeze({
  asphalt: 0xb3b0a9, marking: 0xf4f1e8, pitch: 0xdcefc4, water: 0x3f6f8f, ditch: 0x4b5a4a,
});

const offset = (m, f) => {
  m.polygonOffset = true;
  m.polygonOffsetFactor = f;
  m.polygonOffsetUnits = f * 2;
  return m;
};

function createSet() {
  const terrain = surfaceMaterial('grass', { color: 0xffffff });
  terrain.vertexColors = true;
  terrain.name = 'unri:tanahTerrain';
  const marking = offset(new MeshLambertMaterial({ color: UNRI_GROUND_COLORS.marking }), -2);
  marking.name = 'unri:marka';
  const water = new MeshStandardMaterial({ color: UNRI_GROUND_COLORS.water, roughness: 0.35, metalness: 0 });
  water.name = 'unri:air';
  const ditch = offset(new MeshStandardMaterial({ color: UNRI_GROUND_COLORS.ditch, roughness: 0.25, metalness: 0 }), -1);
  ditch.name = 'unri:parit';
  return {
    terrain,
    asphalt: offset(surfaceMaterial('asphalt', { color: UNRI_GROUND_COLORS.asphalt }), -1),
    marking,
    paving: offset(surfaceMaterial('paving', { color: COLORS.concrete }), -2),
    walk: offset(surfaceMaterial('concrete', { color: GROUND_COLORS.sidewalk }), -3),
    pitch: offset(surfaceMaterial('grass', { color: UNRI_GROUND_COLORS.pitch }), -1),
    water,
    ditch,
  };
}

function disposeSet(set) {
  for (const m of Object.values(set)) {
    for (const k of ['map', 'normalMap', 'roughnessMap']) m[k]?.dispose();
    m.dispose();
  }
}

/** Panggil di dalam withScope(scopeDistrik, …). */
export function createUnriGroundMaterials() {
  return currentScope().get('unri:groundMaterials', createSet, { dispose: disposeSet });
}
```

- [ ] **Step 4: Implementasi `ground.js`**

```js
/**
 * Permukaan keras distrik per chunk & LOD (spec §5.3): aspal (+ marka putus-putus tengah jalan utama), trotoar
 * beton, paving parkir/plaza, rumput lapangan — ter-drape pada permukaan aman-mesh chunk, dipotong tepat ke
 * persegi chunk, digabung SATU mesh per material (≤ 5 draw call/chunk). Nama mesh `<dasar>+<key>` dengan dasar
 * `aspal`, `trotoar`, `plazaPaving`, `rumput` = nama registry basah Weather.wet (dipotong di '+').
 * LOD1 (> 600 m): tanpa marka/trotoar, lift + LOD1_EXTRA_LIFT. Juga tintTerrainRoot (warna vertex terrain).
 */
import { Float32BufferAttribute, Group, Mesh, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DRAPE, drapePolygon, drapePolyline } from '../../world/terrain/drape.js';
import { polylineLength, slicePolyline } from '../../geo/lineClip.js';
import { surfaceColors } from './surfaceTint.js';

export const MARKED_CLASSES = Object.freeze(['primary', 'secondary', 'tertiary', 'primary_link', 'secondary_link', 'tertiary_link']);
/** Marka putus-putus putih tengah jalur (foto drone 2016) [INFERENSI ukuran: garis 3 m, celah 5 m, lebar 12 cm]. */
export const DASH = Object.freeze({ length: 3, gap: 5, width: 0.12, minRoadWidth: 6 });
/** Tambahan lift LOD1: presisi depth ±0,13 m di 800 m (near 0,3 / far 2.500, depth 24-bit). */
export const LOD1_EXTRA_LIFT = 0.2;

/** Interval [s0, s1] marka sepanjang polyline sepanjang `length` m (mulai gap/2). */
export function dashIntervals(length, dash = DASH) {
  const out = [];
  for (let s = dash.gap / 2; s + dash.length <= length; s += dash.length + dash.gap) out.push([s, s + dash.length]);
  return out;
}

/** Gabung geometri tak-kosong menjadi satu Mesh bernama (sumber dilepas); null bila semuanya kosong. */
export function mergedMesh(list, material, name) {
  const geos = list.filter((g) => (g.getAttribute('position')?.count ?? 0) > 0);
  for (const g of list) if (!geos.includes(g)) g.dispose();
  if (geos.length === 0) return null;
  const geometry = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
  if (geos.length > 1) for (const g of geos) g.dispose();
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.ownsGeometry = true;
  return mesh;
}

/**
 * Generator (titik potong scheduler tiap jalan/area) → Group permukaan keras chunk.
 * @param {ReturnType<import('./groundData.js').parseGroundChunk>} data
 * @param {{heightAt: Function, normalAt: Function}} surface createChunkSurface untuk LOD ini
 * @param {{lod: number, materials: object, rect: {minX:number,minZ:number,maxX:number,maxZ:number}, key: string}} opts
 */
export function* buildGroundMeshes(data, surface, { lod, materials, rect, key }) {
  const extra = lod === 0 ? 0 : LOD1_EXTRA_LIFT;
  const opts = (lift) => ({ lift: lift + extra, clipRect: rect });
  const geos = { aspal: [], marka: [], trotoar: [], plazaPaving: [], rumput: [] };
  for (const r of data.roads) {
    geos.aspal.push(drapePolyline(r.pts, r.w, surface, opts(DRAPE.lift.road)));
    if (lod === 0 && MARKED_CLASSES.includes(r.cls) && r.w >= DASH.minRoadWidth) {
      for (const [s0, s1] of dashIntervals(polylineLength(r.pts))) {
        geos.marka.push(drapePolyline(slicePolyline(r.pts, s0, s1), DASH.width, surface, opts(DRAPE.lift.marking)));
      }
    }
    yield;
  }
  if (lod === 0) {
    for (const w of data.walks) geos.trotoar.push(drapePolyline(w.pts, w.w, surface, opts(DRAPE.lift.walk)));
    yield;
  }
  for (const a of data.areas) {
    if (a.kind === 'water') continue;
    const pitch = a.kind === 'pitch';
    (pitch ? geos.rumput : geos.plazaPaving).push(drapePolygon(a.rings, surface, opts(pitch ? DRAPE.lift.pitch : DRAPE.lift.paving)));
    yield;
  }
  const mats = { aspal: materials.asphalt, marka: materials.marking, trotoar: materials.walk, plazaPaving: materials.paving, rumput: materials.pitch };
  const out = new Group();
  out.name = `unri:keras:${key}`;
  for (const [name, list] of Object.entries(geos)) {
    const mesh = mergedMesh(list, mats[name], `${name}+${key}`);
    if (mesh) out.add(mesh);
  }
  return out;
}

const _v = new Vector3();

/**
 * Warnai semua mesh di bawah `root` (mesh terrain chunk M1) dari bobot permukaan: atribut `color` per simpul
 * (posisi dunia → bilinear grid bobot), material diganti `material` (vertexColors), ditandai permukaan basah.
 */
export function tintTerrainRoot(root, weights, origin, material, tints) {
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute('position');
    const xz = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i += 1) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      xz[2 * i] = _v.x;
      xz[2 * i + 1] = _v.z;
    }
    o.geometry.setAttribute('color', new Float32BufferAttribute(surfaceColors(xz, weights, origin, tints), 3));
    o.material = material;
    o.userData.wetSurface = true;
  });
}
```

- [ ] **Step 5: Implementasi `water.js`**

```js
/**
 * Air distrik per chunk (spec §5.3, §5.2.8): bidang datar di muka air (`level` hasil bake) untuk Danau Buatan &
 * Waduk UNRI yang dipahat terrain M1 (tepi bidang tersembunyi di bawah tanggul), dan pita parit gelap ter-drape
 * (lebar 1 m) di dasar cekungan parit (LOD0 saja). Mesh `air+<key>` (tidak ikut registry basah), `parit+<key>`.
 */
import { BufferGeometry, Float32BufferAttribute, Group, ShapeUtils, Vector2 } from 'three';
import { DRAPE, drapePolyline } from '../../world/terrain/drape.js';
import { mergedMesh } from './ground.js';

/** Poligon datar (dengan lubang) di y = level, UV dunia, normal +Y, segitiga menghadap atas. */
export function waterPlaneGeometry(rings, level) {
  const [outer, ...holes] = rings;
  const contour = outer.map(([x, z]) => new Vector2(x, z));
  const holeVecs = holes.map((h) => h.map(([x, z]) => new Vector2(x, z)));
  const faces = ShapeUtils.triangulateShape(contour, holeVecs);
  const verts = [...contour, ...holeVecs.flat()];
  const pos = [];
  const nor = [];
  const uv = [];
  for (const v of verts) {
    pos.push(v.x, level, v.y);
    nor.push(0, 1, 0);
    uv.push(v.x, v.y);
  }
  const idx = [];
  for (const [a, b, c] of faces) {
    const up = (verts[b].y - verts[a].y) * (verts[c].x - verts[a].x) - (verts[b].x - verts[a].x) * (verts[c].y - verts[a].y);
    if (up >= 0) idx.push(a, b, c);
    else idx.push(a, c, b);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Generator → Group air + parit chunk. */
export function* buildWaterMeshes(data, surface, { lod, materials, rect, key }) {
  const out = new Group();
  out.name = `unri:air:${key}`;
  const planes = data.areas.filter((a) => a.kind === 'water').map((a) => waterPlaneGeometry(a.rings, a.level));
  const air = mergedMesh(planes, materials.water, `air+${key}`);
  if (air) out.add(air);
  yield;
  if (lod === 0) {
    const ribbons = data.ditches.map((d) => drapePolyline(d.pts, d.w, surface, { lift: DRAPE.lift.ditch, clipRect: rect }));
    const parit = mergedMesh(ribbons, materials.ditch, `parit+${key}`);
    if (parit) out.add(parit);
  }
  return out;
}
```

- [ ] **Step 6: Jalankan tes; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/districts/unriGroundMeshes.test.js
npm run lint
```
Expected: 4 tes PASS; lint 0 galat.

- [ ] **Step 7: Commit**

```bash
git add src/districts/unri/groundMaterials.js src/districts/unri/ground.js src/districts/unri/water.js tests/districts/unriGroundMeshes.test.js
```
```bash
git commit -m "feat(districts): permukaan keras ter-drape, marka, air & parit, pewarnaan terrain distrik UNRI"
```

---

### Task 17: Props kampus — P03 PJU, P04 bangku, P05 tong sampah

**Files:**
- Create: `src/world/props/unri/pjuKampus.js`, `src/world/props/unri/tongSampahKampus.js`, `src/districts/unri/lamps.js`, `src/districts/unri/streetProps.js`
- Test: `tests/districts/unriLamps.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/districts/unriLamps.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { lampHeads } from '../../src/districts/unri/lamps.js';
import { PJU_KAMPUS, pjuKampusParts } from '../../src/world/props/unri/pjuKampus.js';
import { LAMP_POST } from '../../src/world/props/LampPost.js';

describe('P03 PJU kampus', () => {
  it('kepala lampu setinggi LAMP_HEIGHT TimeOfDay (halo/PointLight tepat di kepala)', () => {
    expect(PJU_KAMPUS.headY).toBeCloseTo(LAMP_POST.height - LAMP_POST.armDrop, 9);
  });

  it('posisi kepala = tiang + lengan ke arah yaw (konvensi atan2(dx, dz))', () => {
    const [a, b] = lampHeads([{ x: 10, z: 20, yaw: 0 }, { x: 0, z: 0, yaw: Math.PI / 2 }]);
    expect(a.x).toBeCloseTo(10, 9);
    expect(a.z).toBeCloseTo(20 + PJU_KAMPUS.armReach, 9);
    expect(b.x).toBeCloseTo(PJU_KAMPUS.armReach, 9);
    expect(b.z).toBeCloseTo(0, 9);
  });

  it('dua part (struktur + lampu emisif bertanda malam) → ≤ 2 draw call per chunk', () => {
    const parts = pjuKampusParts();
    expect(parts).toHaveLength(2);
    expect(parts[1].material.userData.nightEmissive).toEqual({ on: 6, off: 0 });
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/unriLamps.test.js`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Implementasi `pjuKampus.js`**

`src/world/props/unri/pjuKampus.js`:
```js
import * as THREE from 'three';
import { groupFromParts, instanceParts, placeObject } from '../../siteutil/instanceParts.js';
import { mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';
import { LAMP_POST } from '../LampPost.js';

/**
 * P03 pju-kampus (katalog aset): tiang galvanis satu lengan + kepala LED pipih (placeholder prosedural, bentuk
 * [INFERENSI]). Kepala lampu di LAMP_POST.height − LAMP_POST.armDrop (8,6 m) = LAMP_HEIGHT TimeOfDay agar
 * PointLight/halo malam tepat di kepala lampu (katalog menulis ±7 m berlabel INF — disesuaikan, plan M2).
 * Lengan mengarah ke +Z lokal: rotY = arah ke jalan. Dua material: struktur abu (Lambert) + muka lampu emisif.
 */
export const PJU_KAMPUS = Object.freeze({
  headY: LAMP_POST.height - LAMP_POST.armDrop,
  armReach: 1.5,
  poleR: 0.075,
  baseR: 0.15,
  head: Object.freeze({ w: 0.3, h: 0.1, d: 0.6 }),
  colors: Object.freeze({ tiang: 0x9aa3a8, lampu: 0xfff1cf }),
});

function structureGeometry() {
  const { headY, armReach, poleR, baseR, head } = PJU_KAMPUS;
  const poleH = headY + 0.25;
  return mergeAll([
    new THREE.CylinderGeometry(poleR * 0.7, poleR, poleH, 8).translate(0, poleH / 2, 0),
    new THREE.CylinderGeometry(baseR, baseR * 1.15, 0.5, 8).translate(0, 0.25, 0),
    new THREE.CylinderGeometry(0.035, 0.035, armReach, 6).rotateX(Math.PI / 2).translate(0, headY + 0.15, armReach / 2),
    new THREE.BoxGeometry(head.w, head.h, head.d).translate(0, headY + 0.07, armReach),
  ]);
}

const structureGeo = () => currentScope().get('pjuKampus:structureGeo', structureGeometry);
const faceGeo = () => currentScope().get('pjuKampus:faceGeo', () => new THREE.PlaneGeometry(PJU_KAMPUS.head.w * 0.85, PJU_KAMPUS.head.d * 0.85)
  .rotateX(Math.PI / 2).translate(0, PJU_KAMPUS.headY + 0.015, PJU_KAMPUS.armReach));
const poleMat = () => currentScope().get('pjuKampus:poleMat', () => new THREE.MeshLambertMaterial({ color: PJU_KAMPUS.colors.tiang }));
const faceMat = () => currentScope().get('pjuKampus:faceMat', () => {
  const m = new THREE.MeshStandardMaterial({
    color: PJU_KAMPUS.colors.lampu, emissive: PJU_KAMPUS.colors.lampu, emissiveIntensity: 0, side: THREE.DoubleSide,
  });
  m.name = 'bohlamPJUKampus';
  // Dibaca registry malam TimeOfDay: emissiveIntensity naik ke `on` saat lampu menyala.
  m.userData.nightEmissive = { on: 6, off: 0 };
  return m;
});

/** Part PJU kampus (pola parts: geometry, material, castShadow, name). Panggil di dalam ResourceScope pemilik. */
export function pjuKampusParts() {
  return [
    { geometry: structureGeo(), material: poleMat(), castShadow: true, name: 'tiangPJUKampus' },
    { geometry: faceGeo(), material: faceMat(), name: 'lampuPJUKampus' },
  ];
}

/** Satu PJU kampus. opts: { x, z, y?, rotY } */
export function createPjuKampus(opts = {}) {
  return placeObject(groupFromParts(pjuKampusParts(), 'pjuKampus'), opts);
}

/** Banyak PJU kampus instanced. positions: [{x, y, z, rotY}] */
export function createPjuKampusInstances(positions) {
  return instanceParts(pjuKampusParts(), positions, 'unri:pju');
}
```

- [ ] **Step 4: Implementasi `tongSampahKampus.js`**

`src/world/props/unri/tongSampahKampus.js`:
```js
import * as THREE from 'three';
import { instanceParts } from '../../siteutil/instanceParts.js';
import { chubbyCylinder, mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';

/**
 * P05 tong-sampah-kampus (katalog aset, 0,5 × 0,5 × 0,9 m): silinder gemuk + tutup. Satu material putih, warna
 * per instans bergantian oranye/hijau (organik/anorganik) [INFERENSI].
 */
export const TONG_SAMPAH_KAMPUS = Object.freeze({ radius: 0.25, height: 0.9, colors: Object.freeze([0xe57c23, 0x3f8f4a]) });

function bodyGeometry() {
  const { radius: r, height: h } = TONG_SAMPAH_KAMPUS;
  const bodyH = h - 0.08;
  return mergeAll([
    chubbyCylinder(r, r * 0.88, bodyH, 12).translate(0, bodyH / 2, 0),
    new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.08, 12).translate(0, h - 0.04, 0),
  ]);
}

const bodyGeo = () => currentScope().get('tongSampahKampus:bodyGeo', bodyGeometry);
const bodyMat = () => currentScope().get('tongSampahKampus:bodyMat', () => new THREE.MeshLambertMaterial({ color: 0xffffff }));

/** positions: [{x, y, z}] → Group 'unri:tongSampah' (satu InstancedMesh). */
export function createTongSampahKampusInstances(positions) {
  const g = instanceParts([{ geometry: bodyGeo(), material: bodyMat(), name: 'tongSampahKampus' }], positions, 'unri:tongSampah');
  const c = new THREE.Color();
  for (const mesh of g.children) {
    for (let i = 0; i < mesh.count; i += 1) mesh.setColorAt(i, c.setHex(TONG_SAMPAH_KAMPUS.colors[i % 2]));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  return g;
}
```

- [ ] **Step 5: Implementasi `lamps.js` & `streetProps.js`**

`src/districts/unri/lamps.js`:
```js
/**
 * P03 PJU kampus per chunk dari props.lamps ground (posisi tiang + yaw ke jalan). lampHeads → posisi kepala
 * lampu (dunia) untuk registerLamps TimeOfDay (kolam cahaya, halo, PointLight terdekat).
 */
import { PJU_KAMPUS, createPjuKampusInstances } from '../../world/props/unri/pjuKampus.js';

/** [{x, z, yaw}] tiang → [{x, z}] kepala lampu (lengan sepanjang armReach ke arah yaw). */
export function lampHeads(lamps, reach = PJU_KAMPUS.armReach) {
  return lamps.map((l) => ({ x: l.x + Math.sin(l.yaw) * reach, z: l.z + Math.cos(l.yaw) * reach }));
}

/** InstancedMesh PJU (2 draw call); y dari permukaan chunk. Panggil di dalam withScope(scopeDistrik). */
export function buildLamps(lamps, heightAt) {
  return createPjuKampusInstances(lamps.map((l) => ({ x: l.x, z: l.z, y: heightAt(l.x, l.z), rotY: l.yaw })));
}
```

`src/districts/unri/streetProps.js`:
```js
/**
 * P04 bangku beton taman (reuse Bench 'semen') dan P05 tong sampah kampus per chunk dari props ground.
 * Panggil di dalam withScope(scopeDistrik) (geometri/material props memakai currentScope).
 */
import { Group } from 'three';
import { createBenches } from '../../world/props/Bench.js';
import { createTongSampahKampusInstances } from '../../world/props/unri/tongSampahKampus.js';

export function buildStreetProps({ benches, bins }, heightAt) {
  const g = new Group();
  g.name = 'unri:props';
  if (benches.length) {
    g.add(createBenches(benches.map((b) => ({ x: b.x, z: b.z, y: heightAt(b.x, b.z), rotY: b.yaw, type: 'semen' }))));
  }
  if (bins.length) g.add(createTongSampahKampusInstances(bins.map((b) => ({ x: b.x, z: b.z, y: heightAt(b.x, b.z) }))));
  return g;
}
```

- [ ] **Step 6: Jalankan tes; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/districts/unriLamps.test.js
npm run lint
```
Expected: 3 tes PASS; lint 0 galat.

- [ ] **Step 7: Commit**

```bash
git add src/world/props/unri/pjuKampus.js src/world/props/unri/tongSampahKampus.js src/districts/unri/lamps.js src/districts/unri/streetProps.js tests/districts/unriLamps.test.js
```
```bash
git commit -m "feat(props): P03 PJU kampus, P05 tong sampah kampus; PJU & bangku/tong per chunk distrik"
```

---

### Task 18: Vegetasi distrik (V01–V03, V06, V07) per sel 200 m

**Files:**
- Modify: `src/world/Landscape.trees.js` (ekspor `VEGETATION_CELL`)
- Create: `src/districts/unri/vegetation.js`
- Test: `tests/districts/unriVegetation.test.js`

- [ ] **Step 1: Ekspor ukuran sel vegetasi**

Di `src/world/Landscape.trees.js`, ganti
```js
const VEGETATION_CELL = 200; // m: ukuran sel culling untuk instansi vegetasi
```
dengan
```js
export const VEGETATION_CELL = 200; // m: ukuran sel culling instansi vegetasi (juga dipakai distrik UNRI)
```

- [ ] **Step 2: Tulis tes yang gagal**

`tests/districts/unriVegetation.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { VEG_SPECIES, buildVegetationCells, hash01, vegetationInstances } from '../../src/districts/unri/vegetation.js';

const h = (x) => 0.01 * x + 2;
const pts = [
  { sp: 'mahoni', x: 10, z: 20 }, { sp: 'semak', x: 30, z: 40 }, { sp: 'sawit', x: 250, z: 50 }, { sp: 'jati', x: 0, z: 0 },
];

describe('vegetationInstances', () => {
  const inst = vegetationInstances(pts, h);

  it('peneduh = batang + tajuk; semak = tajuk saja; sawit = kit sawit; spesies asing diabaikan', () => {
    expect(inst.trunks).toHaveLength(1);
    expect(inst.crowns).toHaveLength(2);
    expect(inst.sawitTrunks).toHaveLength(1);
    expect(inst.sawitCrowns).toHaveLength(1);
  });

  it('akar di permukaan; tajuk di atas batang; skala 0,85–1,3; deterministik dari posisi', () => {
    const t = inst.trunks[0];
    expect(t.y).toBeCloseTo(h(10, 20), 9);
    expect(inst.crowns[0].y).toBeGreaterThan(t.y + t.sy * 0.9);
    const s = t.sx / VEG_SPECIES.mahoni.trunkR;
    expect(s).toBeGreaterThanOrEqual(0.85);
    expect(s).toBeLessThan(1.3);
    expect(vegetationInstances(pts, h)).toEqual(inst);
    expect(hash01(10, 20, 1)).toBe(hash01(10, 20, 1));
    expect(hash01(10, 20, 1)).not.toBe(hash01(10.1, 20, 1));
  });

  it('tinggi total sesuai katalog (mahoni ±10–18 m, sawit ±4–9 m)', () => {
    const c = inst.crowns[0];
    const top = c.y + c.sy - h(10, 20);
    expect(top).toBeGreaterThan(9.5);
    expect(top).toBeLessThan(18.5);
    const sc = inst.sawitCrowns[0];
    expect(sc.y - h(250, 50)).toBeGreaterThan(3.5);
    expect(sc.y - h(250, 50)).toBeLessThan(9.5);
  });
});

describe('buildVegetationCells', () => {
  it('satu grup per sel 200 m (≤ 4 InstancedMesh), pusat sel tercatat; kit tak lengkap → galat jelas', async () => {
    const THREE = await import('three');
    const part = (name) => ({ name, geometry: new THREE.BoxGeometry(), material: new THREE.MeshBasicMaterial() });
    const kit = { trunk: part('b'), crown: part('t'), sawitTrunk: part('sb'), sawitCrown: part('sp') };
    const cells = buildVegetationCells(vegetationInstances(pts, h), kit);
    expect(cells.map((c) => [c.group.name, c.x, c.z])).toEqual([['unri:vegetasi:0_0', 100, 100], ['unri:vegetasi:1_0', 300, 100]]);
    expect(cells[0].group.children.map((m) => [m.name, m.count])).toEqual([['b', 1], ['t', 2]]);
    expect(cells[1].group.children.map((m) => m.name)).toEqual(['sb', 'sp']);
    expect(() => buildVegetationCells(vegetationInstances(pts, h), { trunk: kit.trunk })).toThrow(/tidak lengkap/);
  });
});
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/unriVegetation.test.js`
Expected: FAIL — modul belum ada.

- [ ] **Step 4: Implementasi**

`src/districts/unri/vegetation.js`:
```js
/**
 * Vegetasi distrik UNRI (placeholder prosedural katalog V01 mahoni, V02 angsana, V03 saga, V06 sawit, V07 semak).
 * Draw call minimal: semua peneduh + semak berbagi SATU geometri tajuk (gumpalan bola) dan satu material
 * berangin; bentuk spesies dibedakan skala non-seragam per instans + palet warna instans. Per sel 200 m
 * (VEGETATION_CELL) maksimal 4 InstancedMesh: batang, tajuk, batang sawit, pelepah sawit. Variasi (skala, rotasi,
 * warna, tinggi batang) deterministik dari posisi (hash01).
 */
import {
  BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4,
  MeshLambertMaterial, Quaternion, Vector3,
} from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { blobCluster } from '../../world/siteutil/rounded.js';
import { createRandom } from '../../world/siteutil/rng.js';
import { applyWind, createWindDepthMaterial } from '../../world/shaders/wind.js';
import { VEGETATION_CELL } from '../../world/Landscape.trees.js';

/**
 * Parameter spesies (m). Tinggi total ≈ (batang + 1,6 × tajuk.y) × skala; skala 0,85–1,3. Tinggi katalog:
 * mahoni 12–18, angsana 10–15 (tajuk payung), saga 8–12 (renggang), sawit 6–9, semak ±1.
 */
export const VEG_SPECIES = Object.freeze({
  mahoni: Object.freeze({ trunkH: [6, 8], trunkR: 0.34, crown: [4.2, 3.6, 4.2], palette: Object.freeze([0x4f7d32, 0x5b8a3a, 0x46722d]) }),
  angsana: Object.freeze({ trunkH: [5.5, 7], trunkR: 0.3, crown: [5.6, 2.6, 5.6], palette: Object.freeze([0x6e9e3c, 0x79a845, 0x86b24f]) }),
  saga: Object.freeze({ trunkH: [4.25, 5], trunkR: 0.24, crown: [3.4, 2.9, 3.4], palette: Object.freeze([0x8cb85a, 0x98c266, 0x7fae4f]) }),
  sawit: Object.freeze({ trunkH: [4.5, 7], trunkR: 0.32, crownScale: 1.4, palette: Object.freeze([0x3f8f3a, 0x357f35, 0x4a9a3e]) }),
  semak: Object.freeze({ crown: [1.1, 0.75, 1.1], palette: Object.freeze([0x7cb342, 0x8bc34a, 0x689f38]) }),
});

/** Bilangan [0, 1) deterministik dari posisi (dibulatkan 0,1 m) dan salt bulat. */
export function hash01(x, z, salt) {
  let h = Math.imul(Math.round(x * 10) | 0, 73856093) ^ Math.imul(Math.round(z * 10) | 0, 19349663) ^ Math.imul(salt, 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * Titik vegetasi → instans per kategori {x, y, z, sx, sy, sz, rot, color?}. Murni (tanpa three).
 * @param {Array<{sp: string, x: number, z: number}>} points
 * @param {(x: number, z: number) => number} heightAt
 */
export function vegetationInstances(points, heightAt) {
  const out = { trunks: [], crowns: [], sawitTrunks: [], sawitCrowns: [] };
  for (const p of points) {
    const spec = VEG_SPECIES[p.sp];
    if (!spec) continue;
    const s = 0.85 + 0.45 * hash01(p.x, p.z, 1);
    const rot = hash01(p.x, p.z, 2) * Math.PI * 2;
    const color = spec.palette[Math.floor(hash01(p.x, p.z, 3) * spec.palette.length)];
    const y = heightAt(p.x, p.z);
    if (p.sp === 'semak') {
      const [cx, cy, cz] = spec.crown;
      out.crowns.push({ x: p.x, y: y + cy * 0.55 * s, z: p.z, sx: cx * s, sy: cy * s, sz: cz * s, rot, color });
      continue;
    }
    const th = (spec.trunkH[0] + (spec.trunkH[1] - spec.trunkH[0]) * hash01(p.x, p.z, 4)) * s;
    const trunk = { x: p.x, y, z: p.z, sx: spec.trunkR * s, sy: th, sz: spec.trunkR * s, rot };
    if (p.sp === 'sawit') {
      const k = spec.crownScale * s;
      out.sawitTrunks.push(trunk);
      out.sawitCrowns.push({ x: p.x, y: y + th, z: p.z, sx: k, sy: k, sz: k, rot, color });
      continue;
    }
    const [cx, cy, cz] = spec.crown;
    out.trunks.push(trunk);
    out.crowns.push({ x: p.x, y: y + th + cy * 0.6 * s, z: p.z, sx: cx * s, sy: cy * s, sz: cz * s, rot, color });
  }
  return out;
}

/** Pelepah sawit ringan: 8 pita melengkung (48 segitiga), pangkal di origin. */
function sawitLiteCrown(fronds = 8) {
  const spine = [[0, 0], [0.9, 0.55], [1.9, 0.6], [2.8, 0.15]];
  const half = [0.12, 0.45, 0.4, 0.05];
  const pos = [];
  for (let f = 0; f < fronds; f += 1) {
    const a = (f / fronds) * Math.PI * 2 + (f % 2) * 0.2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const P = (out, up, side) => [c * out - s * side, up, s * out + c * side];
    for (let k = 0; k < spine.length - 1; k += 1) {
      const a0 = P(spine[k][0], spine[k][1], -half[k]);
      const a1 = P(spine[k][0], spine[k][1], half[k]);
      const b0 = P(spine[k + 1][0], spine[k + 1][1], -half[k + 1]);
      const b1 = P(spine[k + 1][0], spine[k + 1][1], half[k + 1]);
      pos.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const CROWN_WIND = Object.freeze({ weightMode: 'height', heightMin: -1, heightMax: 1, weightMin: 0.2, amplitude: 0.7 });
const SAWIT_WIND = Object.freeze({ weightMode: 'height', heightMin: 0, heightMax: 0.7, weightMin: 0.2, amplitude: 0.6 });

function createKit() {
  const trunkMat = new MeshLambertMaterial({ color: 0x7a5a45 });
  const crownMat = applyWind(new MeshLambertMaterial({ color: 0xffffff }), CROWN_WIND);
  const sawitMat = applyWind(new MeshLambertMaterial({ color: 0xffffff, side: DoubleSide }), SAWIT_WIND);
  sawitMat.shadowSide = DoubleSide;
  const sawitDepth = createWindDepthMaterial(SAWIT_WIND);
  sawitDepth.side = DoubleSide;
  const trunkGeo = new CylinderGeometry(0.7, 1, 1, 6, 1, true).translate(0, 0.5, 0);
  return {
    trunk: { name: 'batangPohonKampus', geometry: trunkGeo, material: trunkMat, castShadow: true },
    crown: {
      name: 'tajukPohonKampus',
      geometry: blobCluster({ count: 3, radius: 0.62, spread: 0.42, flat: 0.95, vertical: 0.18 }, createRandom(4107)),
      material: crownMat, castShadow: true, depth: createWindDepthMaterial(CROWN_WIND),
    },
    sawitTrunk: { name: 'batangSawitKampus', geometry: trunkGeo, material: trunkMat, castShadow: true },
    sawitCrown: { name: 'pelepahSawitKampus', geometry: sawitLiteCrown(), material: sawitMat, castShadow: true, depth: sawitDepth },
  };
}

function disposeKit(kit) {
  const seen = new Set();
  for (const part of Object.values(kit)) {
    for (const r of [part.geometry, part.material, part.depth]) {
      if (r && !seen.has(r)) {
        seen.add(r);
        r.dispose();
      }
    }
  }
}

/** Kit vegetasi (geometri + material bersama) per ResourceScope. Panggil di dalam withScope(scopeDistrik). */
export function createVegetationKit() {
  return currentScope().get('unri:vegetationKit', createKit, { dispose: disposeKit });
}

const _m = new Matrix4();
const _p = new Vector3();
const _s = new Vector3();
const _q = new Quaternion();
const _up = new Vector3(0, 1, 0);
const _c = new Color();

function instanced(part, list) {
  const mesh = new InstancedMesh(part.geometry, part.material, list.length);
  list.forEach((it, i) => {
    _q.setFromAxisAngle(_up, it.rot);
    mesh.setMatrixAt(i, _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.sx, it.sy, it.sz)));
    if (it.color !== undefined) mesh.setColorAt(i, _c.setHex(it.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = Boolean(part.castShadow);
  mesh.receiveShadow = true;
  if (part.depth) mesh.customDepthMaterial = part.depth;
  mesh.computeBoundingSphere();
  mesh.name = part.name;
  return mesh;
}

const CATEGORIES = Object.freeze([['trunks', 'trunk'], ['crowns', 'crown'], ['sawitTrunks', 'sawitTrunk'], ['sawitCrowns', 'sawitCrown']]);

/**
 * Instans → sel `cellSize` m: [{group, x, z}] (x, z = pusat sel, untuk visibilitas jarak). Urutan sel deterministik.
 * @throws {Error} bila kit tidak lengkap
 */
export function buildVegetationCells(inst, kit, { cellSize = VEGETATION_CELL } = {}) {
  for (const [, part] of CATEGORIES) {
    if (!kit?.[part]?.geometry || !kit[part].material) throw new Error(`kit vegetasi tidak lengkap: "${part}"`);
  }
  const cells = new Map();
  for (const [cat] of CATEGORIES) {
    for (const it of inst[cat]) {
      const k = `${Math.floor(it.x / cellSize)}_${Math.floor(it.z / cellSize)}`;
      let c = cells.get(k);
      if (!c) cells.set(k, (c = { trunks: [], crowns: [], sawitTrunks: [], sawitCrowns: [] }));
      c[cat].push(it);
    }
  }
  return [...cells.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, c]) => {
    const [cx, cz] = k.split('_').map(Number);
    const group = new Group();
    group.name = `unri:vegetasi:${k}`;
    for (const [cat, part] of CATEGORIES) if (c[cat].length) group.add(instanced(kit[part], c[cat]));
    return { group, x: (cx + 0.5) * cellSize, z: (cz + 0.5) * cellSize };
  });
}
```

- [ ] **Step 5: Jalankan tes; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/districts/unriVegetation.test.js tests/sawit.test.js tests/grassPlacement.test.js
npm run lint
```
Expected: semua PASS (tes vegetasi stadion lama tetap lulus); lint 0 galat.

- [ ] **Step 6: Commit**

```bash
git add src/world/Landscape.trees.js src/districts/unri/vegetation.js tests/districts/unriVegetation.test.js
```
```bash
git commit -m "feat(districts): vegetasi kampus instanced per sel 200 m (mahoni, angsana, saga, sawit, semak)"
```

---

### Task 19: Collider distrik — air + lereng > 35 %

**Files:**
- Create: `src/districts/unri/collider.js`
- Test: `tests/districts/unriCollider.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/districts/unriCollider.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { UNRI_COLLIDER, colliderDataFromGround, createUnriCollider } from '../../src/districts/unri/collider.js';

const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const flat = { normalAt: (x, z, out = {}) => Object.assign(out, { x: 0, y: 1, z: 0 }) };
/** Lereng 40 % di x > 100, 30 % di 50 < x ≤ 100, datar selain itu. */
const steep = {
  normalAt: (x, z, out = {}) => {
    const g = x > 100 ? 0.4 : x > 50 ? 0.3 : 0;
    const l = Math.hypot(g, 1);
    return Object.assign(out, { x: -g / l, y: 1 / l, z: 0 });
  },
};

describe('collider distrik UNRI', () => {
  it('air tidak walkable (kedalaman = jarak ke tepi); titian/jalan di atas air & pulau walkable', () => {
    const c = createUnriCollider({ terrain: flat });
    c.addChunk('0_0', {
      water: [{ rings: [sq(0, 0, 40, 40), sq(15, 15, 25, 25)] }],
      roads: [{ pts: [[-10, 5], [50, 5]], w: 2 }],
      circles: [],
    });
    expect(c.isWalkable(10, 30)).toBe(false);
    expect(c.penetration(10, 30)).toBeCloseTo(Math.hypot(5, 5), 9);
    expect(c.isWalkable(10, 5)).toBe(true);
    expect(c.isWalkable(20, 20)).toBe(true);
    expect(c.isWalkable(60, 30)).toBe(true);
  });

  it('rintangan lingkaran memblok sampai r + clearance', () => {
    const c = createUnriCollider({ terrain: flat });
    c.addChunk('0_0', { circles: [{ x: 0, z: 0, r: 0.2 }] });
    expect(c.isWalkable(0.5, 0)).toBe(false);
    expect(c.penetration(0.5, 0)).toBeCloseTo(0.2 + UNRI_COLLIDER.clearance - 0.5, 9);
    expect(c.isWalkable(0.7, 0)).toBe(true);
  });

  it('lereng > 35 % tidak walkable; 30 % walkable', () => {
    const c = createUnriCollider({ terrain: steep });
    expect(c.gradeAt(120, 0)).toBeCloseTo(0.4, 9);
    expect(c.isWalkable(120, 0)).toBe(false);
    expect(c.penetration(120, 0)).toBe(UNRI_COLLIDER.steepPenetration);
    expect(c.isWalkable(80, 0)).toBe(true);
    expect(c.isWalkable(0, 0)).toBe(true);
  });

  it('removeChunk / chunk belum dimuat = terbuka; addChunk ulang mengganti; NaN tidak walkable; kamera 2D bebas', () => {
    const c = createUnriCollider({ terrain: flat });
    c.addChunk('0_0', { water: [{ rings: [sq(0, 0, 40, 40)] }] });
    expect(c.isWalkable(10, 10)).toBe(false);
    c.addChunk('0_0', { water: [{ rings: [sq(100, 100, 140, 140)] }] });
    expect(c.isWalkable(10, 10)).toBe(true);
    expect(c.isWalkable(110, 110)).toBe(false);
    expect(c.removeChunk('0_0')).toBe(true);
    expect(c.isWalkable(110, 110)).toBe(true);
    expect(c.removeChunk('0_0')).toBe(false);
    expect(c.isWalkable(Number.NaN, 0)).toBe(false);
    expect(c.penetration(Infinity, 0)).toBe(Infinity);
    expect(c.isCameraClear(10, 10)).toBe(true);
    expect(c.stats()).toEqual({ chunks: 0, cells: 0 });
  });

  it('colliderDataFromGround: air, jalan + trotoar, lingkaran PJU/bangku/tong (keep menyaring)', () => {
    const data = {
      areas: [{ kind: 'water', rings: [sq(0, 0, 1, 1)] }, { kind: 'parking', rings: [sq(0, 0, 1, 1)] }],
      roads: [{ pts: [[0, 0], [1, 0]], w: 7 }],
      walks: [{ pts: [[0, 0], [0, 1]], w: 2 }],
      props: { lamps: [{ x: 1, z: 1, yaw: 0 }], benches: [{ x: 5, z: 5, yaw: 0 }], bins: [{ x: 9, z: 9 }] },
    };
    const d = colliderDataFromGround(data, (p) => p.x < 8);
    expect(d.water).toHaveLength(1);
    expect(d.roads).toHaveLength(2);
    expect(d.circles.map((c) => c.r)).toEqual([UNRI_COLLIDER.circle.lamp, UNRI_COLLIDER.circle.bench]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/unriCollider.test.js`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Implementasi**

`src/districts/unri/collider.js`:
```js
/**
 * Collider distrik UNRI (M2, spec §5.4): air tidak walkable kecuali di atas jalan/trotoar (titian, jalan di atas
 * gorong-gorong), lereng > 35 % tidak walkable (tanggul curam), rintangan lingkaran (PJU, bangku, tong).
 * Chunk ground yang belum dimuat = terbuka (sama dengan TileCollider kota). penetration(x, z) = kedalaman di zona
 * terhalang (createCollider memakainya agar sepeda yang terjebak hanya bisa keluar). Kamera: uji 2D tetap bebas
 * (terrain ditangani CameraRig M1). Koordinat dunia; murni (tanpa three). M3 menambah footprint gedung.
 */
import { distanceToRing, distanceToSegment, pointInPolygon } from '../../geo/polygon.js';

export const UNRI_COLLIDER = Object.freeze({
  cellSize: 25,
  maxGrade: 0.35,
  clearance: 0.4,
  steepPenetration: 0.25,
  circle: Object.freeze({ lamp: 0.2, bench: 0.95, bin: 0.3 }),
});

const bboxOf = (pts, pad) => {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of pts) {
    if (x < minX) minX = x;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }
  return { minX: minX - pad, minZ: minZ - pad, maxX: maxX + pad, maxZ: maxZ + pad };
};

/** Data collider satu chunk dari data ground ter-parse (parseGroundChunk); `keep` menyaring props (region hero). */
export function colliderDataFromGround(data, keep = () => true) {
  const C = UNRI_COLLIDER.circle;
  return {
    water: data.areas.filter((a) => a.kind === 'water').map((a) => ({ rings: a.rings })),
    roads: [...data.roads, ...data.walks].map((r) => ({ pts: r.pts, w: r.w })),
    circles: [
      ...data.props.lamps.filter(keep).map((p) => ({ x: p.x, z: p.z, r: C.lamp })),
      ...data.props.benches.filter(keep).map((p) => ({ x: p.x, z: p.z, r: C.bench })),
      ...data.props.bins.filter(keep).map((p) => ({ x: p.x, z: p.z, r: C.bin })),
    ],
  };
}

/**
 * @param {{terrain?: {normalAt(x:number, z:number, out?:object): {x:number,y:number,z:number}}|null,
 *   cellSize?: number, maxGrade?: number, clearance?: number}} [opts]
 */
export function createUnriCollider({
  terrain = null, cellSize = UNRI_COLLIDER.cellSize, maxGrade = UNRI_COLLIDER.maxGrade, clearance = UNRI_COLLIDER.clearance,
} = {}) {
  const cells = new Map();
  const chunks = new Map();
  const keyOf = (cx, cz) => `${cx},${cz}`;
  const n = { x: 0, y: 1, z: 0 };

  const insert = (rec, shape) => {
    const b = shape.bbox;
    for (let cz = Math.floor(b.minZ / cellSize); cz <= Math.floor(b.maxZ / cellSize); cz += 1) {
      for (let cx = Math.floor(b.minX / cellSize); cx <= Math.floor(b.maxX / cellSize); cx += 1) {
        const k = keyOf(cx, cz);
        let list = cells.get(k);
        if (!list) cells.set(k, (list = []));
        list.push(shape);
        rec.cellKeys.add(k);
      }
    }
    rec.shapes.add(shape);
  };
  const at = (x, z) => cells.get(keyOf(Math.floor(x / cellSize), Math.floor(z / cellSize))) ?? [];
  const inBox = (s, x, z) => x >= s.bbox.minX && x <= s.bbox.maxX && z >= s.bbox.minZ && z <= s.bbox.maxZ;

  const onRoad = (x, z) => at(x, z).some((s) => s.kind === 'road' && inBox(s, x, z)
    && s.pts.some((p, i) => i > 0 && distanceToSegment(x, z, s.pts[i - 1], p) <= s.half));
  const waterDepth = (x, z) => {
    let depth = 0;
    for (const s of at(x, z)) {
      if (s.kind !== 'water' || !inBox(s, x, z) || !pointInPolygon(x, z, s.outer)) continue;
      if (s.holes.some((h) => pointInPolygon(x, z, h))) continue;
      depth = Math.max(depth, Math.min(distanceToRing(x, z, s.outer), ...s.holes.map((h) => distanceToRing(x, z, h))));
    }
    return depth;
  };
  const circleDepth = (x, z) => {
    let d = 0;
    for (const s of at(x, z)) if (s.kind === 'circle') d = Math.max(d, s.r + clearance - Math.hypot(x - s.x, z - s.z));
    return d;
  };
  const gradeAt = (x, z) => {
    if (!terrain?.normalAt) return 0;
    const v = terrain.normalAt(x, z, n);
    return v.y > 0 ? Math.hypot(v.x, v.z) / v.y : Infinity;
  };
  const penetration = (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return Infinity;
    const c = circleDepth(x, z);
    if (c > 0) return c;
    const w = waterDepth(x, z);
    if (w > 0 && !onRoad(x, z)) return w;
    return gradeAt(x, z) > maxGrade ? UNRI_COLLIDER.steepPenetration : 0;
  };

  function removeChunk(key) {
    const rec = chunks.get(key);
    if (!rec) return false;
    for (const k of rec.cellKeys) {
      const list = cells.get(k).filter((s) => !rec.shapes.has(s));
      if (list.length) cells.set(k, list);
      else cells.delete(k);
    }
    chunks.delete(key);
    return true;
  }

  function addChunk(key, { water = [], roads = [], circles = [] } = {}) {
    removeChunk(key);
    const rec = { cellKeys: new Set(), shapes: new Set() };
    for (const w of water) {
      const [outer, ...holes] = w.rings;
      insert(rec, { kind: 'water', outer, holes, bbox: bboxOf(outer, 0) });
    }
    for (const r of roads) insert(rec, { kind: 'road', pts: r.pts, half: r.w / 2, bbox: bboxOf(r.pts, r.w / 2) });
    for (const c of circles) {
      insert(rec, { kind: 'circle', x: c.x, z: c.z, r: c.r, bbox: bboxOf([[c.x, c.z]], c.r + clearance) });
    }
    chunks.set(key, rec);
  }

  return Object.freeze({
    addChunk,
    removeChunk,
    isWalkable: (x, z) => penetration(x, z) === 0,
    isCameraClear: (x, z) => Number.isFinite(x) && Number.isFinite(z),
    penetration,
    gradeAt,
    stats: () => ({ chunks: chunks.size, cells: cells.size }),
  });
}
```

- [ ] **Step 4: Jalankan tes; lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/districts/unriCollider.test.js
npm run lint
```
Expected: 5 tes PASS; lint 0 galat.

- [ ] **Step 5: Commit**

```bash
git add src/districts/unri/collider.js tests/districts/unriCollider.test.js
```
```bash
git commit -m "feat(districts): collider UNRI — air (kecuali di atas jalan), lereng > 35 %, rintangan props"
```

---

### Task 20: Registry basah/malam distrik + perkabelan mount

**Files:**
- Create: `src/app/districtRegistries.js`
- Modify: `src/app/districtMount.js`, `src/main.js`, `src/world/Weather.wet.js`
- Test: `tests/districtRegistries.test.js`, `tests/wetSurfaceFlag.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/districtRegistries.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import { createDistrictRegistries } from '../src/app/districtRegistries.js';

const fakeTime = () => {
  const live = new Set();
  return {
    live,
    registerEmissive: vi.fn((root) => { live.add(root); return () => live.delete(root); }),
    registerLamps: vi.fn((opts) => { live.add(opts); return () => live.delete(opts); }),
  };
};
const fakeWeather = () => {
  const live = new Set();
  return { live, registerWet: vi.fn((root) => { live.add(root); return () => live.delete(root); }) };
};

describe('createDistrictRegistries', () => {
  it('meneruskan ke time/weather; pencabut idempoten; dispose mencabut semua', () => {
    const time = fakeTime();
    const weather = fakeWeather();
    const r = createDistrictRegistries({ time, weather });
    const a = {};
    const b = {};
    const lamps = { lamps: [{ x: 1, z: 2 }] };
    const offA = r.registerWet(a);
    r.registerEmissive(b);
    r.registerLamps(lamps);
    expect(weather.live.has(a) && time.live.has(b) && time.live.has(lamps)).toBe(true);
    expect(r.size).toBe(3);
    expect(offA()).toBe(true);
    expect(offA()).toBe(false);
    expect(weather.live.has(a)).toBe(false);
    r.dispose();
    expect(time.live.size).toBe(0);
    expect(r.size).toBe(0);
  });

  it('tanpa time/weather → pencabut no-op', () => {
    const r = createDistrictRegistries();
    expect(r.registerWet({})()).toBe(false);
    expect(r.size).toBe(0);
  });

  it('galat pencabutan dicatat, tidak dilempar', () => {
    const logger = { error: vi.fn() };
    const r = createDistrictRegistries({ weather: { registerWet: () => () => { throw new Error('x'); } }, logger });
    r.registerWet({});
    expect(() => r.dispose()).not.toThrow();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
```

`tests/wetSurfaceFlag.test.js`:
```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createWetSurfaces } from '../src/world/Weather.wet.js';
import { WEATHER } from '../src/config/constants.js';

describe('Weather.wet bendera userData.wetSurface', () => {
  it('mesh bertanda ikut basah walau namanya bukan nama registry; mesh lain tidak', () => {
    const wet = createWetSurfaces(new THREE.Group());
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.name = 'terrain:-2_1';
    mesh.userData.wetSurface = true;
    const plain = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
    plain.name = 'lain';
    const root = new THREE.Group();
    root.add(mesh, plain);
    wet.register(root);
    expect(wet.count).toBe(1);
    wet.update(0, 1);
    expect(mat.color.r).toBeCloseTo(WEATHER.wetDarken, 6);
    expect(mat.roughness).toBeCloseTo(WEATHER.wetRoughness, 6);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districtRegistries.test.js tests/wetSurfaceFlag.test.js`
Expected: FAIL — modul registry tidak ada; `wet.count` 0.

- [ ] **Step 3: Implementasi `districtRegistries.js`**

```js
/**
 * Registry malam/basah untuk distrik yang kontennya datang belakangan (chunk tanah/vegetasi/PJU di-stream).
 * Setiap pendaftaran mengembalikan pencabut idempoten; dispose() mencabut semua yang tersisa (LIFO).
 * time/weather boleh null (pencabut no-op). Galat saat mencabut dicatat, tidak dilempar.
 * @param {{time?: {registerEmissive?(root: object): () => boolean, registerLamps?(opts: object): () => boolean}|null,
 *   weather?: {registerWet?(root: object): () => boolean}|null, logger?: {error: (...a: unknown[]) => void}}} [opts]
 */
export function createDistrictRegistries({ time = null, weather = null, logger = console } = {}) {
  const live = new Set();
  const track = (off) => {
    if (typeof off !== 'function') return () => false;
    let done = false;
    const undo = () => {
      if (done) return false;
      done = true;
      live.delete(undo);
      try {
        off();
      } catch (err) {
        logger.error('Registry distrik: pencabutan gagal (dilanjutkan):', err);
      }
      return true;
    };
    live.add(undo);
    return undo;
  };
  return Object.freeze({
    registerWet: (root) => track(weather?.registerWet?.(root)),
    registerEmissive: (root) => track(time?.registerEmissive?.(root)),
    registerLamps: (opts) => track(time?.registerLamps?.(opts)),
    get size() { return live.size; },
    dispose() {
      for (const undo of [...live].reverse()) undo();
    },
  });
}
```

- [ ] **Step 4: Bendera basah di `Weather.wet.js`**

Ganti fungsi `selectWet` dan komentarnya dengan:
```js
/**
 * Entri registry: material unik dari mesh bernama permukaan basah, ATAU mesh bertanda
 * `userData.wetSurface === true` (terrain distrik yang diwarnai M2); nilai asli disimpan.
 */
function selectWet(mat, o) {
  if (!o.isMesh || !mat.color) return null;
  if (!WET_MESH_NAMES.has(baseName(o.name)) && o.userData?.wetSurface !== true) return null;
  return {
    mat,
    color: mat.color.clone(),
    roughness: typeof mat.roughness === 'number' ? mat.roughness : null,
    envMapIntensity: typeof mat.envMapIntensity === 'number' ? mat.envMapIntensity : null,
  };
}
```

- [ ] **Step 5: `mountDistrict` meneruskan registry & scheduler**

Di `src/app/districtMount.js` (M1):
1. Tambahkan impor: `import { createDistrictRegistries } from './districtRegistries.js';`
2. Tambahkan opsi ke destrukturisasi parameter ketiga `mountDistrict`: `time = null, weather = null` (pertahankan opsi M1 yang ada; bila belum ada `logger`, tambahkan `logger = console`).
3. Sebelum `def.build(...)`: `const registries = createDistrictRegistries({ time, weather, logger });`
4. Pada objek ctx yang diteruskan ke `def.build`, tambahkan `registries` dan — bila M1 belum meneruskannya (lihat tabel Task 0) — `scheduler`.
5. Bila `def.build` melempar: panggil `registries.dispose()` sebelum melepas scope (di blok catch yang sudah ada).
6. Di fungsi `dispose` hasil `mountDistrict`: setelah `district.dispose()` panggil `registries.dispose()`.
7. Perbarui JSDoc opsi: `time?: {registerEmissive, registerLamps}|null, weather?: {registerWet}|null`.

Di `src/main.js`, pada pemanggilan `mountDistrict(app, unriDistrict, { … })` tambahkan `time, weather,` (variabel `time` dan `weather` yang sama dengan yang diteruskan ke `mountRegion`).

- [ ] **Step 6: Jalankan tes terkait**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/districtRegistries.test.js tests/wetSurfaceFlag.test.js tests/nightRegistry.test.js tests/surfaceLayers.test.js
node node_modules/vitest/vitest.mjs run
npm run lint
```
Expected: semua PASS (tes M1 untuk `mountDistrict` tetap lulus: opsi baru opsional); lint 0 galat.

- [ ] **Step 7: Commit**

```bash
git add src/app/districtRegistries.js src/app/districtMount.js src/main.js src/world/Weather.wet.js tests/districtRegistries.test.js tests/wetSurfaceFlag.test.js
```
```bash
git commit -m "feat(app): registry basah/malam distrik (ctx.registries) + bendera wetSurface untuk terrain"
```

---

### Task 21: Lapisan tanah distrik + hook chunk terrain + perkabelan `unriDistrict`

**Files:**
- Create: `src/districts/unri/groundLayer.js`
- Modify: `src/districts/terrainChunks.js`, `src/districts/unri/index.js`

- [ ] **Step 1: Hook chunk di `terrainChunks.js` (M1)**

1. Tambahkan ke destrukturisasi opsi factory terrain chunks: `onChunkMesh = () => {}, onChunkRelease = () => {},` (pertahankan opsi M1; bila belum ada `logger`, tambahkan `logger = console`).
2. Tepat **setelah** mesh chunk (LOD apa pun, termasuk hasil tukar LOD) selesai dibuat dan dipasang ke grup terrain, sisipkan:
```js
    try {
      onChunkMesh(key, { mesh, lod, chunk });
    } catch (err) {
      logger.error(`Hook onChunkMesh chunk ${key} gagal (dilanjutkan):`, err);
    }
```
   (`key`, `mesh`, `lod`, `chunk` = nama variabel M1 untuk kunci chunk, objek mesh/grup mesh chunk, LOD 0/1, dan Chunk hasil `decodeChunk`; ganti nama bila M1 berbeda.)
3. Tepat **sebelum** mesh chunk dilepas karena aksi `unload` (bukan saat tukar LOD), sisipkan:
```js
    try {
      onChunkRelease(key);
    } catch (err) {
      logger.error(`Hook onChunkRelease chunk ${key} gagal (dilanjutkan):`, err);
    }
```
4. Perbarui JSDoc factory: `onChunkMesh?(key: string, info: {mesh: THREE.Object3D, lod: 0|1, chunk: object}): void`, `onChunkRelease?(key: string): void`.

Run: `node node_modules/vitest/vitest.mjs run tests/districts`
Expected: tes M1 terrainChunks tetap PASS (hook default no-op).

- [ ] **Step 2: Implementasi `groundLayer.js`**

```js
/**
 * Lapisan tanah distrik UNRI (M2). Menempel ke hook chunk terrain M1 (src/districts/terrainChunks.js):
 * onChunkMesh(key, {mesh, lod, chunk}) → muat ground/<key>.json → (scheduler, ≤ 4 ms/frame) warnai mesh terrain
 * dari bobot permukaan + renderOrder −5 (aturan jahitan: terrain digambar sebelum lapisan datar kota), bangun
 * permukaan keras + air + parit untuk LOD itu; sekali per chunk saat LOD0: vegetasi (sel 200 m), PJU, bangku, tong
 * + registry malam. Data collider (air, jalan, rintangan) didaftarkan begitu chunk pertama kali dibangun.
 * onChunkRelease(key) → semua dilepas, material terrain asli dipulihkan. Chunk ground gagal → dilewati
 * (peringatan sekali, spec §10). Visibilitas detail (vegetasi/props) per jarak 650 m dari fokus.
 */
import { Group } from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { freezeStatic } from '../../engine/freezeStatic.js';
import { parseTileKey, tileBounds } from '../../geo/tiles.js';
import { createChunkSurface } from '../../world/terrain/drape.js';
import { VEGETATION_CELL } from '../../world/Landscape.trees.js';
import { parseGroundChunk } from './groundData.js';
import { createUnriGroundMaterials } from './groundMaterials.js';
import { surfaceTints } from './surfaceTint.js';
import { buildGroundMeshes, tintTerrainRoot } from './ground.js';
import { buildWaterMeshes } from './water.js';
import { buildVegetationCells, createVegetationKit, vegetationInstances } from './vegetation.js';
import { buildLamps, lampHeads } from './lamps.js';
import { buildStreetProps } from './streetProps.js';
import { colliderDataFromGround } from './collider.js';

export const GROUND_LAYER = Object.freeze({
  owner: 'unri:ground',
  terrainRenderOrder: -5,
  lod1Stride: 4,
  detailRadius: 650,
  visibilityInterval: 0.5,
  chunkSize: 500,
});

const rectDistance = (x, z, b) => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ));

async function defaultFetchJson(url, retries = 2) {
  let last = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      last = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    }
  }
  throw last;
}

/** Lepas objek milik chunk: buffer InstancedMesh dan geometri bertanda ownsGeometry (kit bersama tidak). */
function disposeOwned(root) {
  if (!root) return;
  root.removeFromParent();
  root.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    else if (o.isMesh && o.userData.ownsGeometry) o.geometry.dispose();
  });
}

/**
 * @param {{scope: object,
 *   scheduler: {schedule(task: Function, o: {owner: string}): {cancel(): void}, pending(owner?: string): number, whenIdle(owner?: string): Promise<void>},
 *   registries: {registerWet(root: object): () => boolean, registerEmissive(root: object): () => boolean, registerLamps(opts: object): () => boolean},
 *   collider: {addChunk(key: string, data: object): void, removeChunk(key: string): boolean},
 *   groundKeys: Set<string>, groundUrl: (key: string) => string, fetchJson?: (url: string) => Promise<unknown>,
 *   isReserved?: (x: number, z: number) => boolean, logger?: {warn: (...a: unknown[]) => void}}} opts
 */
export function createUnriGroundLayer({
  scope, scheduler, registries, collider, groundKeys, groundUrl, fetchJson = defaultFetchJson,
  isReserved = () => false, logger = console,
}) {
  const root = new Group();
  root.name = 'unri:tanah-root';
  const materials = withScope(scope, () => createUnriGroundMaterials());
  const vegKit = withScope(scope, () => createVegetationKit());
  const tints = surfaceTints();
  const chunks = new Map();
  const inflight = new Set();
  let disposed = false;
  let warned = false;
  let timer = 0;
  let focus = null;

  const warnOnce = (msg, err) => {
    if (warned) return;
    warned = true;
    logger.warn(msg, err);
  };
  const keep = (p) => !isReserved(p.x, p.z);

  const recOf = (key) => {
    let rec = chunks.get(key);
    if (!rec) {
      const t = parseTileKey(key);
      rec = {
        key, rect: tileBounds(t.ix, t.iz, GROUND_LAYER.chunkSize), data: null, token: 0, task: null,
        terrain: null, terrainOff: null, surface: null, surfaceOff: null, detail: null, vegCells: [], offs: [], collided: false,
      };
      chunks.set(key, rec);
    }
    return rec;
  };

  /** Pulihkan material asli mesh terrain (M1) dan cabut registry basahnya. */
  const restoreTerrain = (rec) => {
    rec.terrainOff?.();
    rec.terrainOff = null;
    if (!rec.terrain) return;
    for (const [mesh, mat] of rec.terrain.originals) {
      mesh.material = mat;
      mesh.userData.wetSurface = false;
    }
    rec.terrain = null;
  };

  const applyVisibility = (rec) => {
    if (!rec.detail || !focus) return;
    const near = rectDistance(focus.x, focus.z, rec.rect) <= GROUND_LAYER.detailRadius;
    rec.detail.visible = near;
    if (!near) return;
    const reach = GROUND_LAYER.detailRadius + VEGETATION_CELL * 0.71;
    for (const c of rec.vegCells) c.group.visible = Math.hypot(c.x - focus.x, c.z - focus.z) <= reach;
  };

  function buildDetail(rec, data, surface) {
    const h = (x, z) => surface.heightAt(x, z);
    const detail = new Group();
    detail.name = `unri:detail:${rec.key}`;
    const cells = buildVegetationCells(vegetationInstances(data.veg.filter(keep), h), vegKit);
    for (const c of cells) detail.add(c.group);
    const lamps = data.props.lamps.filter(keep);
    withScope(scope, () => {
      if (lamps.length) detail.add(buildLamps(lamps, h));
      detail.add(buildStreetProps({ benches: data.props.benches.filter(keep), bins: data.props.bins.filter(keep) }, h));
    });
    freezeStatic(detail);
    root.add(detail);
    rec.detail = detail;
    rec.vegCells = cells;
    rec.offs.push(registries.registerEmissive(detail));
    if (lamps.length) rec.offs.push(registries.registerLamps({ lamps: lampHeads(lamps) }));
    applyVisibility(rec);
  }

  function* buildChunk(rec, data, terrainRoot, lod, chunk) {
    restoreTerrain(rec);
    const originals = new Map();
    terrainRoot.traverse((o) => {
      if (o.isMesh) originals.set(o, o.material);
    });
    tintTerrainRoot(terrainRoot, data.weights, data.origin, materials.terrain, tints);
    terrainRoot.traverse((o) => {
      if (o.isMesh) o.renderOrder = GROUND_LAYER.terrainRenderOrder;
    });
    rec.terrain = { root: terrainRoot, originals };
    rec.terrainOff = registries.registerWet(terrainRoot);
    yield;
    const surface = createChunkSurface(chunk, { stride: lod === 0 ? 1 : GROUND_LAYER.lod1Stride });
    const opts = { lod, materials, rect: rec.rect, key: rec.key };
    const hard = yield* buildGroundMeshes(data, surface, opts);
    const water = yield* buildWaterMeshes(data, surface, opts);
    const group = new Group();
    group.name = `unri:tanah:${rec.key}`;
    group.add(hard, water);
    freezeStatic(group);
    rec.surfaceOff?.();
    disposeOwned(rec.surface);
    root.add(group);
    rec.surface = group;
    rec.surfaceOff = registries.registerWet(group);
    if (!rec.collided) {
      collider.addChunk(rec.key, colliderDataFromGround(data, keep));
      rec.collided = true;
    }
    if (lod === 0 && !rec.detail) {
      yield;
      buildDetail(rec, data, surface);
    }
  }

  function onChunkMesh(key, { mesh, lod, chunk }) {
    if (disposed || !groundKeys.has(key)) return;
    const rec = recOf(key);
    rec.token += 1;
    const token = rec.token;
    rec.task?.cancel();
    rec.task = null;
    if (!rec.data) rec.data = fetchJson(groundUrl(key)).then((json) => parseGroundChunk(json, key));
    const pending = rec.data
      .then((data) => {
        if (disposed || rec.token !== token) return;
        rec.task = scheduler.schedule(function* buildTask() {
          try {
            yield* buildChunk(rec, data, mesh, lod, chunk);
          } catch (err) {
            warnOnce(`Tanah distrik: chunk ${key} gagal dibangun (dilewati)`, err);
          }
        }, { owner: GROUND_LAYER.owner });
      })
      .catch((err) => {
        rec.data = null;
        warnOnce(`Tanah distrik: chunk ${key} dilewati`, err);
      })
      .finally(() => inflight.delete(pending));
    inflight.add(pending);
  }

  function onChunkRelease(key) {
    const rec = chunks.get(key);
    if (!rec) return;
    rec.token += 1;
    rec.task?.cancel();
    restoreTerrain(rec);
    rec.surfaceOff?.();
    for (const off of rec.offs) off();
    disposeOwned(rec.surface);
    disposeOwned(rec.detail);
    if (rec.collided) collider.removeChunk(key);
    chunks.delete(key);
  }

  async function whenIdle() {
    while (inflight.size > 0) await Promise.allSettled([...inflight]);
    await scheduler.whenIdle(GROUND_LAYER.owner);
  }

  const stats = () => {
    let surfaces = 0;
    let details = 0;
    for (const rec of chunks.values()) {
      if (rec.surface) surfaces += 1;
      if (rec.detail) details += 1;
    }
    return { chunks: chunks.size, surfaces, details, loading: inflight.size, pending: scheduler.pending(GROUND_LAYER.owner) };
  };
  root.userData.stats = stats;
  root.userData.whenIdle = whenIdle;

  const system = {
    id: 'unri.ground',
    phase: 'world',
    update(dt, ctx) {
      const f = ctx.focus ?? ctx.bikePos;
      if (!f) return;
      timer -= dt;
      if (timer > 0) return;
      timer = GROUND_LAYER.visibilityInterval;
      focus = { x: f.x, z: f.z };
      for (const rec of chunks.values()) applyVisibility(rec);
    },
    dispose() {},
  };

  return {
    group: root,
    system,
    onChunkMesh,
    onChunkRelease,
    whenIdle,
    stats,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const key of [...chunks.keys()]) onChunkRelease(key);
      root.removeFromParent();
    },
  };
}
```

- [ ] **Step 3: Sambungkan ke `unriDistrict` (`src/districts/unri/index.js`, M1)**

1. Impor:
```js
import { createUnriGroundLayer } from './groundLayer.js';
import { createUnriCollider } from './collider.js';
```
2. Di dalam `build(ctx)`, **setelah** manifest distrik dimuat (variabel M1 berisi objek manifest, di sini disebut `manifest`) dan **sebelum** factory terrain chunks dibuat:
```js
  const collider = createUnriCollider({ terrain: ctx.terrain });
  const ground = createUnriGroundLayer({
    scope: ctx.scope,
    scheduler: ctx.scheduler,
    registries: ctx.registries,
    collider,
    groundKeys: new Set(manifest.ground?.chunks ?? []),
    groundUrl: (key) => unriDistrict.manifestUrl.replace(/manifest\.json$/, `ground/${key}.json`),
    isReserved: ctx.isReserved,
  });
  group.add(ground.group);
```
   (`group` = grup distrik M1 yang dikembalikan `build`.)
3. Pada objek opsi factory terrain chunks M1 tambahkan: `onChunkMesh: ground.onChunkMesh, onChunkRelease: ground.onChunkRelease,`.
4. Pada nilai kembali `build`:
   - `systems`: tambahkan `ground.system` setelah sistem M1;
   - `colliders: collider` (menggantikan collider terbuka M1);
   - `whenSettled: (x, z) => Promise.all([<pemanggilan whenSettled M1>(x, z), ground.whenIdle()]).then(() => undefined)`;
   - `dispose()`: panggil `ground.dispose()` **sebelum** pembongkaran M1 (terrain chunks) agar material terrain asli dipulihkan sebelum mesh dilepas.
5. `excludeIds` tetap `new Set()` di M2 (diisi M3).

- [ ] **Step 4: Tes, lint, build**

Run:
```bash
node node_modules/vitest/vitest.mjs run
npm run lint
npm run build
```
Expected: semua tes PASS; lint 0 galat; build sukses.

- [ ] **Step 5: Smoke cepat di dev server**

Jalankan `preview_start` nama `stadion-dev` (atau `npm run dev`), buka `http://localhost:5173`, di konsol:
```js
__sim.teleport(-700, 760, Math.atan2(-70, 77));
```
Tunggu ±10 s lalu:
```js
const r = __sim.app.scene.getObjectByName('unri:tanah-root'); await r.userData.whenIdle(); r.userData.stats()
```
Expected: `{chunks ≥ 4, surfaces ≥ 4, details ≥ 1, loading: 0, pending: 0}`; tidak ada galat konsol; Danau Buatan berair, jalan beraspal dengan marka, trotoar, pohon, PJU tampak.

- [ ] **Step 6: Commit**

```bash
git add src/districts/unri/groundLayer.js src/districts/terrainChunks.js src/districts/unri/index.js
```
```bash
git commit -m "feat(districts): lapisan tanah UNRI di-stream mengikuti chunk terrain (scheduler, registry, collider)"
```

---

### Task 22: Verifikasi jahitan batas distrik, visual, dan budget

**Files:**
- Create: `tests/districtSeam.test.js`, `tools/shots/unriM2.mjs`
- Create (hasil): `docs/screenshots/unri/m2-*.jpg`

- [ ] **Step 1: Tes data jahitan (celah) — tulis & jalankan**

`tests/districtSeam.test.js`:
```js
/**
 * Jahitan batas distrik UNRI (M2, spec §12 "tidak ada z-fighting/celah di batas distrik"), dibaca dari data yang
 * di-commit (public/tiles + public/districts/unri). Celah = ujung jalan/trotoar kota di tepi distrik yang tidak
 * berlanjut sebagai pita distrik, atau sampel bobot yang tidak konsisten dengan batas. Z-fighting dicegah oleh
 * konstruksi (lapisan kota diklip habis di dalam distrik — tests/osmFacts.test.js; lift + polygonOffset berjenjang;
 * terrain renderOrder −5) dan diperiksa visual di tools/shots/unriM2.mjs.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { distanceToRing, pointInPolygon } from '../src/geo/polygon.js';
import { UNRI_BOUNDARY } from '../src/districts/unri/boundary.js';
import { parseGroundChunk } from '../src/districts/unri/groundData.js';
import { VEHICLE_CLASSES, WALK_CLASSES } from '../tools/campusbake/ground/constants.js';

const tilesManifest = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
const district = JSON.parse(readFileSync('public/districts/unri/manifest.json', 'utf8'));
const ground = district.ground.chunks.map((key) => parseGroundChunk(
  JSON.parse(readFileSync(`public/districts/unri/ground/${key}.json`, 'utf8')), key,
));
const toPoints = (d, flat) => {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push([d.center[0] + flat[i] * d.unit, d.center[1] + flat[i + 1] * d.unit]);
  return out;
};
const cityRoads = tilesManifest.tiles.filter((t) => t.area === 'stadion' || t.area === 'unri')
  .map((t) => JSON.parse(readFileSync(`public/tiles/${t.data.file}`, 'utf8')))
  .flatMap((d) => d.roads.map((r) => ({ cls: r.cls, pts: toPoints(d, r.pts) })));
const SERVED = new Set([...VEHICLE_CLASSES, ...WALK_CLASSES]);
const ribbons = ground.flatMap((g) => [...g.roads, ...g.walks]);
const paved = ground.flatMap((g) => g.areas.filter((a) => a.kind === 'parking' || a.kind === 'plaza'));
/**
 * Ujung jalan kota yang memang BERHENTI di batas (buntu di pagar kampus, tanpa lanjutan di OSM): [x, z, 'way OSM + alasan'].
 * Kosong secara default; isi hanya setelah memeriksa OSM untuk koordinat yang dilaporkan tes di bawah.
 */
const NATURAL_ENDS = [];

describe('jahitan batas distrik UNRI', () => {
  it('setiap chunk terrain punya data tanah', () => {
    expect([...district.ground.chunks].sort()).toEqual([...district.terrain.chunks].sort());
  });

  it('setiap ujung jalan/trotoar kota di tepi distrik berlanjut sebagai pita distrik (≤ 0,3 m dari sumbu) atau paving', () => {
    const ends = cityRoads.filter((r) => SERVED.has(r.cls))
      .flatMap((r) => [r.pts[0], r.pts[r.pts.length - 1]])
      .filter(([x, z]) => distanceToRing(x, z, UNRI_BOUNDARY) <= 0.25)
      .filter(([x, z]) => !NATURAL_ENDS.some(([nx, nz]) => Math.hypot(nx - x, nz - z) < 1));
    expect(ends.length).toBeGreaterThan(0);
    const covered = ([x, z]) => ribbons.some((r) => distanceToRing(x, z, r.pts, false) <= 0.3)
      || paved.some((a) => pointInPolygon(x, z, a.rings[0]));
    expect(ends.filter((p) => !covered(p))).toEqual([]);
  });

  it('bobot permukaan: penuh (255) di dalam distrik, nol di luar (> 0,25 m dari tepi)', () => {
    const bad = [];
    for (const g of ground) {
      const { n, grass, soil, wet } = g.weights;
      for (let j = 0; j < n; j += 1) {
        for (let i = 0; i < n; i += 1) {
          const x = g.origin.x + i * 4;
          const z = g.origin.z + j * 4;
          if (distanceToRing(x, z, UNRI_BOUNDARY) <= 0.25) continue;
          const k = j * n + i;
          const sum = grass[k] + soil[k] + wet[k];
          if (sum !== (pointInPolygon(x, z, UNRI_BOUNDARY) ? 255 : 0)) bad.push([g.key, x, z, sum]);
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/districtSeam.test.js`
Expected: 3 tes PASS. Bila tes kedua gagal: untuk tiap koordinat yang dilaporkan, cek OSM (`data-src/osm/unri.json`) — (a) jalan kota benar-benar buntu di pagar (tidak ada way lanjutan di dalam distrik) → tambahkan `[x, z, 'w<id>: buntu di pagar kampus']` ke `NATURAL_ENDS`; (b) selain itu = bug klip/tumpang (Task 1/3/8) → perbaiki kodenya, bake ulang (Task 6 Step 4, Task 13 Step 2), ulangi.

- [ ] **Step 2: Skrip ukur & screenshot**

`tools/shots/unriM2.mjs`:
```js
/**
 * Verifikasi visual & budget M2 (tanah & jalan kampus UNRI): Vite + Chromium (Playwright, GPU) → screenshot titik
 * ukur ke docs/screenshots/unri/m2-<id>.jpg + draw call/segitiga distrik per titik (= render(semua) −
 * render(objek distrik disembunyikan): terrain bertint, tanah keras, air, vegetasi, props).
 *   node tools/shots/unriM2.mjs [--gpu d3d11|swiftshader] [--out laporan.json]
 * Exit code 1 bila ada galat konsol, titik gagal dimuat, atau budget M2 terlampaui.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5179;
const OUT_DIR = join(ROOT, 'docs', 'screenshots', 'unri');
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
/** Budget M2: distrik total ≤ 180 draw call termasuk klaster gedung M3 (spec §9.1) → M2 ≤ 110 (sisa ≥ 70 untuk M3). */
const LIMITS = Object.freeze({ calls: 110, triangles: 350000 });
/** Titik ukur: spec §9.2 + tiga titik batas distrik. yaw = atan2(dx, dz) arah pandang sepeda. */
const POINTS = Object.freeze([
  { id: 'batas-sm-amin', x: 410, z: 690, yaw: Math.PI / 2, note: 'batas timur: Jl. Muchtar Lutfi → Gerbang SM Amin (kota)' },
  { id: 'batas-soebrantas', x: -1072, z: 2080, yaw: 0, note: 'batas selatan: Jl. Binawidya → Gerbang Soebrantas (kota)' },
  { id: 'batas-stadion', x: 0, z: 430, yaw: Math.PI, note: 'batas utara: jalan kampus → kawasan stadion' },
  { id: 'jalan-stadion-kampus', x: 0, z: 500, yaw: 0, note: 'titik ukur spec §9.2' },
  { id: 'danau', x: -700, z: 760, yaw: Math.atan2(-70, 77), note: 'Danau Buatan: air, tanggul, parit' },
  { id: 'sekre-luar', x: -219, z: 1130, yaw: Math.PI, note: 'titik ukur spec §9.2' },
  { id: 'rektorat', x: -979, z: 860, yaw: Math.PI / 2, note: 'titik ukur spec §9.2' },
  { id: 'masjid', x: -1009, z: 1383, yaw: 0, note: 'titik ukur spec §9.2' },
]);

const { values: opts } = parseArgs({
  options: { gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string' } },
});

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch { /* coba kandidat berikutnya */ }
  }
  throw new Error('Paket playwright tidak ditemukan (npm i -g playwright, atau set PLAYWRIGHT_PATH)');
}

/** Fungsi yang dievaluasi di halaman (window.__sim dari src/app/devtools.js). */
const PAGE = {
  prepare() {
    const s = window.__sim;
    s.rig.exitPov();
    s.store.set('sky.advanceTime', false);
    s.store.set('sky.hour', 12);
    s.store.set('weather.raining', false);
    s.store.set('camera.mode', 'third');
    return true;
  },
  async visit(p) {
    const s = window.__sim;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    s.teleport(p.x, p.z, p.yaw);
    await s.city.whenSettled(p.x, p.z, 600, 60000);
    let root = null;
    for (let t = 0; t < 120 && !(root = s.app.scene.getObjectByName('unri:tanah-root')); t += 1) await sleep(250);
    if (!root) return { ok: false, reason: 'unri:tanah-root tidak ada (distrik tidak terpasang?)' };
    for (let i = 0; i < 3; i += 1) {
      await root.userData.whenIdle();
      await sleep(1000);
    }
    return { ok: true, stats: root.userData.stats() };
  },
  measure() {
    const s = window.__sim;
    const info = s.app.renderer.info.render;
    s.app.renderFrame();
    const all = { calls: info.calls, triangles: info.triangles };
    const hidden = [];
    s.app.scene.traverse((o) => {
      const own = o.name.startsWith('unri:') || (o.isMesh && o.material?.name === 'unri:tanahTerrain');
      if (own && o.visible) hidden.push(o);
    });
    for (const o of hidden) o.visible = false;
    s.app.renderFrame();
    const rest = { calls: info.calls, triangles: info.triangles };
    for (const o of hidden) o.visible = true;
    s.app.renderFrame();
    return { calls: all.calls - rest.calls, triangles: all.triangles - rest.triangles, totalCalls: all.calls };
  },
  async night() {
    const s = window.__sim;
    s.store.set('sky.hour', 20.5);
    s.store.set('weather.raining', true);
    await new Promise((r) => setTimeout(r, 5000));
    return true;
  },
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const report = { gpu: opts.gpu, limits: LIMITS, points: {}, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && window.__sim.city, null, { timeout: 240000 });
    await page.evaluate(PAGE.prepare);
    for (const p of POINTS) {
      const visit = await page.evaluate(PAGE.visit, p);
      const measure = visit.ok ? await page.evaluate(PAGE.measure) : {};
      await page.screenshot({ path: join(OUT_DIR, `m2-${p.id}.jpg`), type: 'jpeg', quality: 85 });
      report.points[p.id] = { note: p.note, ...visit, ...measure };
      process.stderr.write(`[m2] ${p.id}: ${JSON.stringify(report.points[p.id])}\n`);
    }
    await page.evaluate(PAGE.visit, POINTS.find((p) => p.id === 'rektorat'));
    await page.evaluate(PAGE.night);
    await page.screenshot({ path: join(OUT_DIR, 'm2-malam-hujan-rektorat.jpg'), type: 'jpeg', quality: 85 });
  } finally {
    await browser.close();
    await server.close();
  }
  const fails = [];
  if (report.errors.length) fails.push(`galat konsol: ${report.errors.length}`);
  for (const [id, r] of Object.entries(report.points)) {
    if (!r.ok) fails.push(`${id}: ${r.reason}`);
    if (r.calls > LIMITS.calls) fails.push(`${id}: draw call distrik ${r.calls} > ${LIMITS.calls}`);
    if (r.triangles > LIMITS.triangles) fails.push(`${id}: segitiga distrik ${r.triangles} > ${LIMITS.triangles}`);
  }
  report.fails = fails;
  const json = JSON.stringify(report, null, 2);
  if (opts.out) writeFileSync(opts.out, `${json}\n`);
  console.log(json);
  process.exitCode = fails.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

Run:
```bash
npm run lint
node tools/shots/unriM2.mjs --gpu d3d11 --out /tmp/m2-laporan.json
```
Expected: 9 berkas `docs/screenshots/unri/m2-*.jpg` (8 titik + `m2-malam-hujan-rektorat.jpg`); JSON dengan `fails: []`; tiap titik `ok: true`, `calls ≤ 110`, `triangles ≤ 350000` (perkiraan: terrain 6–9 + tanah ≤ 7/chunk × 4–6 chunk + vegetasi 2–4/sel × 8–15 sel + props 4/chunk). Bila budget terlampaui, mitigasi berurutan (spec §9.3, semuanya konstanta): turunkan `GROUND_LAYER.detailRadius` 650 → 500 (Task 21), naikkan `VEG.forest.spacing` 16 → 20 lalu bake ulang ground (Task 13), turunkan `PROPS.lamp.spacing.service` 50 → 70; catat nilai akhir di commit.

- [ ] **Step 3: Tinjau screenshot (kriteria lulus)**

Buka tiap berkas dengan alat baca gambar dan centang:
1. `m2-batas-sm-amin`, `m2-batas-soebrantas`, `m2-batas-stadion`: aspal kota dan aspal distrik bersambung **tanpa celah** tanah/rumput di garis batas (tumpang ≥ w/2 + 2 m); tidak ada pita belang/berkedip (z-fighting) di aspal, trotoar, rumput, paving; landuse kota tidak tampak di dalam distrik; tidak ada tebing/retakan antara tanah kota dan terrain (blend tepi M1 = 0).
2. `m2-danau`: muka air rata di bawah tepi tanggul, tidak ada tanah menembus air atau bidang air melayang; parit tampak sebagai garis gelap sejajar jalan utama, terputus di persimpangan & trotoar.
3. Semua titik siang: rumput/tanah merah/tanah basah bergradasi halus (tidak kotak-kotak tajam); tidak ada pohon di atas jalan, parkir, atau air; PJU di tepi jalan dengan kepala menghadap jalan; bangku menghadap trotoar.
4. `m2-malam-hujan-rektorat`: aspal/trotoar/rumput/terrain lebih gelap-licin (registry basah), muka lampu PJU menyala + kolam cahaya di bawahnya (registry malam).
Bila ada butir gagal: perbaiki, ulangi Step 2–3.

- [ ] **Step 4: E2E lama tetap hijau (paritas stadion)**

Run: `npm run e2e -- --gpu d3d11`
Expected: `fails: []` (draw call tile, paritas stadion, memori region, rute, perjalanan cepat tidak berubah oleh M2).

- [ ] **Step 5: Commit**

```bash
git add tests/districtSeam.test.js tools/shots/unriM2.mjs docs/screenshots/unri
```
```bash
git commit -m "test(districts): jahitan batas distrik UNRI + skrip ukur/screenshot M2 (budget draw call distrik)"
```

---

### Task 23: Penutup tonggak — verifikasi penuh & indeks

**Files:**
- Modify: `docs/superpowers/plans/2026-10-17-unri-00-index.md`

- [ ] **Step 1: Verifikasi penuh**

Run:
```bash
node node_modules/vitest/vitest.mjs run
npm run lint
npm run build
git status --short
```
Expected: semua tes PASS; lint 0 galat; build sukses; hanya berkas indeks yang belum di-commit (plus `.claude/launch.json` milik user).

- [ ] **Step 2: Perbarui indeks**

Di `docs/superpowers/plans/2026-10-17-unri-00-index.md`:
1. Di bagian `### M2: Tanah & jalan kampus`, tambahkan paragraf setelah daftar "Buat":
```markdown
Ekstensi M2 (aditif, `v` tetap 1): `ground/<key>.json` memakai koordinat bulat 0,1 m relatif sudut barat-laut chunk dan
menambah `areas[].level` (air), `ditches`, `veg` (`mahoni|angsana|saga|sawit|semak`), `props` (`lamps`, `benches`, `bins`)
— detail di plan M2 §"Format ground". File tambahan M2: `src/geo/lineClip.js`, `src/world/terrain/drape.js`
(`createChunkSurface`, `nodeIndices`), `src/districts/unri/{groundData,surfaceTint,groundMaterials,streetProps,groundLayer}.js`,
`src/world/props/unri/tongSampahKampus.js`, `src/app/districtRegistries.js` (`ctx.registries`), `tools/campusbake/ground/*`,
`tools/shots/unriM2.mjs`. Hook M1 baru: `terrainChunks({ onChunkMesh(key, {mesh, lod, chunk}), onChunkRelease(key) })`;
`mountDistrict(…, { time, weather })`. citybake: area `unri` (`skipAreas: ['stadion']`), `DISTRICTS` (excludeIds dari
`public/districts/unri/buildings.json`, M3). Terrain chunk `renderOrder = −5` (aturan jahitan).
```
2. Baris status M2 (ganti `<hash>` dengan keluaran `git log -1 --format=%h`):
```markdown
| M2 | selesai | <hash> | tanah ter-drape, air, parit, vegetasi, PJU/bangku/tong; citybake klip distrik + area unri; jahitan diuji (districtSeam) |
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-10-17-unri-00-index.md
```
```bash
git commit -m "docs: status M2 tanah & jalan kampus + ekstensi format ground di indeks"
```

---

## Self-review

**Cakupan permintaan & spec:**

| Butir | Task |
|---|---|
| (a) campusbake ground: extract → surfaces (bobot grass/soil/wet per sampel 4 m) → writeGround, golden | 7–13 (golden fixture Task 12, byte-identik nyata Task 13) |
| (b) `drapePolyline`/`drapePolygon` UV dunia, lift, pecah ≤ 2 m, `polygonOffset`, tes murni | 14 (geometri), 16 (`polygonOffset` di material) |
| (c) ground/water/vegetation/lamps distrik, `surfaceMaps`, registry basah & malam, instans per sel 200 m | 15–18, 20–21 |
| (d) collider distrik: air + lereng > 35 % tidak walkable (tes) | 19 |
| (e) citybake: klip `polygon-clipping`, eksklusi gedung (excludeIds + centroid), `parseLevels` "4-7" → 4, area bake x < −1500 / z > 1500, bake ulang `--offline`, `osmFacts` diperbarui + alasan, budget tile | 1–6 |
| (f) tidak ada z-fighting/celah di batas distrik (kriteria + screenshot `m2-*.jpg`), budget draw call distrik | 22 |
| Spec §5.3: LOD0/LOD1 permukaan, normal dari heightfield, material terrain bobot vertex | 14 (`createChunkSurface` per stride), 16 (`tintTerrainRoot`) |
| Spec §5.2.8: muka air = tepi terendah − 0,4; parit 1,0 m | 9 |
| Spec §6: batas distrik dari M1, jalan dipotong per segmen (eksak) | 1, 3, 8 |
| Spec §10: chunk ground rusak dilewati; tanpa cache → galat berisi langkah unduh | 7 (`loadOsmSource`), 15 (`GroundDataError`), 21 (`warnOnce`) |
| Spec §11: tes hanya logika murni/berisiko; golden; screenshot | semua task TDD hanya untuk klip, parser, bobot, penempatan, drape, collider, registry |

**Pemindaian placeholder:** tidak ada "TBD"/"tambahkan penanganan galat"/"mirip Task N". Langkah yang bergantung pada kode M1 yang belum ada saat plan ditulis (Task 9 Step 1, 12 Step 6, 13 Step 1, 14 Step 1, 20 Step 5, 21 Step 1/3) memberi perintah pemeriksaan pasti (Task 0 Step 2), kode yang disisipkan secara lengkap, dan tindakan bila berbeda — bukan tebakan.

**Konsistensi nama:** `drapePolyline(pts, width, field, { lift, segment, clipRect })`, `drapePolygon(rings, field, { lift, maxEdge, clipRect })` (indeks + opsi `clipRect`); `createChunkSurface(chunk, { stride, sample })`; `parseGroundChunk(json, key)` → `{roads, walks, areas, ditches, veg, props, weights}`; `createUnriGroundLayer` → `{group, system, onChunkMesh, onChunkRelease, whenIdle, stats, dispose}`; `createUnriCollider` → `{addChunk, removeChunk, isWalkable, isCameraClear, penetration, gradeAt, stats}`; `createDistrictRegistries` → `{registerWet, registerEmissive, registerLamps, size, dispose}`; nama mesh basah `aspal|trotoar|plazaPaving|rumput` + `userData.wetSurface`; owner scheduler `'unri:ground'`; grup ukur berawalan `unri:`.

**Risiko yang tersisa:**
- API M1 berbeda dari indeks (nama variabel ctx, simpul LOD1, lokasi hook) → dicakup tabel Task 0 dengan tindakan per butir.
- `tanahKota` kota (y −0,05) di atas lembah terrain adalah tanggung jawab M1; Task 0 menghentikan M2 bila belum beres.
- Pop vegetasi/props di 650 m (tanpa impostor; spec §9.3 butir 4 untuk M7).
- Fase marka putus-putus dapat bergeser di tepi chunk (≤ 1 marka tidak beraturan per jalan per tepi chunk).
- Dua "Waduk" kecil tidak dipahat terrain M1 → tidak diberi air (dilaporkan bake); keputusan memahatnya ada di konfigurasi M1.
- Penyambungan nada aspal kota–distrik memakai pengali warna linear (0xb3b0a9); pencahayaan Lambert (kota) vs Standard (distrik) bisa menyisakan beda nada tipis — tidak dihitung sebagai "celah".

## Serah terima ke M3

1. **excludeIds gedung kota:** setelah M3 menulis `public/districts/unri/buildings.json` (`{v:1, buildings:[{id:'w123',…}]}`), jalankan `npm run bake -- --area all --offline` — `resolveDistricts` otomatis membaca id itu sehingga gedung yang menyilang batas distrik ikut dibuang dari tile kota. Kembalikan `excludeIds` runtime `unriDistrict` = `new Set(buildings.map((b) => b.id))`.
2. **Collider gedung:** tambahkan bentuk `kind:'building'` ke `createUnriCollider` (grid sel 25 m yang sama; aturan blok + jarak bebas seperti `TileCollider`), didaftarkan per klaster lewat API baru `addBuildings(clusterKey, rings)` / `removeBuildings(clusterKey)`; jangan mengubah `addChunk` (data ground).
3. **Sisi selasar (spec §7.2 butir 3):** baca jalan dari `parseGroundChunk(...).roads` (dunia, `w` m) untuk memilih sisi panjang yang menghadap jalan terdekat.
4. **Budget:** M2 menargetkan ≤ 110 draw call & ≤ 350k segitiga distrik di titik ukur (lihat laporan `tools/shots/unriM2.mjs`); M3 mendapat sisa ≥ 70 draw call (klaster 10–14 × LOD0) agar total distrik ≤ 180. Jalankan ulang skrip itu setelah klaster gedung masuk (tambahkan berawalan `unri:` pada nama grup klaster agar terhitung).
5. **Vegetasi vs gedung:** penempatan vegetasi/props sudah menjauhi footprint OSM (3 m / 1,5 m). Gedung kit yang lebih besar dari footprint (selasar, kanopi K02/K03) dapat menabrak pohon — M3 cukup menambah tolok ukur `VEG.clear.building` di `tools/campusbake/ground/constants.js` lalu bake ulang ground, tanpa mengubah format.
6. **Region hero (M4/M6):** `createUnriGroundLayer({ isReserved })` (diteruskan dari `ctx.isReserved` distrik) menyaring vegetasi, PJU, bangku, tong, dan rintangan collider di dalam mask region; M4 menyediakan predikat itu lewat `mountDistrict` (komposisi app, karena distrik tidak boleh mengimpor regions). Titian Danau Buatan (`w783152923`, `bridge=yes`) sengaja tidak di-drape — dibuat region Rektorat (M6, P11).
7. **Minimap:** distrik belum menggambar jalan/air di minimap (`minimapLayer` M1 tidak diubah M2); data siap dari `parseGroundChunk` bila M3/M7 menambahkannya.
8. **Aturan jahitan:** mesh apa pun yang ditambahkan ke tanah distrik harus tetap `renderOrder ≥ 0` dan, bila datar di permukaan, memakai lift ≥ 0,02 m + `polygonOffset` (lihat `DRAPE.lift`, `groundMaterials`); terrain tetap `renderOrder −5`.

