# Spec desain: Kawasan Kampus UNRI Bina Widya (distrik, terrain, kit gedung, sekre)

Tanggal: 2026-10-17 · Branch: `feat/unri-kampus` · Status: disetujui per bagian oleh user (brainstorming 2026-10-17)

Dokumen terkait:
- Riset fakta: `docs/research/kampus-unri-bina-widya.md` (sumber + tingkat keyakinan per fakta)
- Katalog aset: `docs/superpowers/specs/2026-10-17-unri-asset-catalog.md`
- Spec kota sebelumnya: `docs/superpowers/specs/2026-10-16-pekanbaru-city-slice-design.md`
- Plan per tonggak: `docs/superpowers/plans/2026-10-17-unri-m0-*.md` … `unri-m7-*.md`

Konvensi koordinat (sama dengan kode sekarang): dunia ENU, origin `WORLD_ORIGIN {lat 0.4835954, lon 101.3895277}`
(`src/config/constants.js:41`), +X = timur, **+Z = selatan** (−Z = utara), meter. Semua koordinat "dunia" di
dokumen ini memakai konvensi itu.

---

## 1. Tujuan dan kriteria selesai

Membangun kawasan Kampus Universitas Riau Bina Widya (±2,44 km², poligon OSM `way/938374562`) yang **autentik**:
setiap gedung berasal dari footprint OSM dan punya bentuk arketipe yang sesuai fungsinya, terrain mengikuti
elevasi nyata, dan zona yang paling penting bagi user — **Sekretariat Lembaga Mahasiswa** (`way/327530276`,
dunia ±(−219, 1107), di selatan Stadion Mini UNRI) — dibuat handmade dengan **interior sekre yang bisa
dimasuki** dan hidup.

Kriteria selesai keseluruhan (diverifikasi di M7):
1. Pemain bisa bersepeda dari stadion ke kampus tanpa jahitan visual: tile kota datar → distrik berelevasi
   menyambung tanpa tebing/retakan; menanjak terasa berat, menurun meluncur.
2. Seluruh gedung OSM di dalam poligon kampus tampil sebagai gedung kit (bukan ekstrusi polos); gedung yang
   punya foto rujukan memakai override yang sesuai foto.
3. Zona Lembaga (M4) dan zona Rektorat (M6) handmade sesuai rujukan riset; hero building Masjid Arfa'unnas,
   Gerbang SM Amin, dan GGM tampil.
4. Pintu sekre di sebelah sekre BEM: tekan **E** → fade → interior sekre; di dalam berjalan kaki, NPC
   beraktivitas sesuai jam game, ≥ 10 barang interaktif, 4 preset kamera foto; keluar → kembali di depan
   pintu, sepeda di tempat semula.
5. Budget §9 terpenuhi di titik ukur §9.2 (E2E GPU).
6. Fakta vs inferensi tercatat per gedung/aset (`sumber`, `keyakinan`) dan tampil di dokumen; tidak ada
   detail fiktif yang disajikan sebagai fakta.
7. Atribusi data: OSM (ODbL) + SRTM (domain publik, disebut sebagai sumber) di HUD/README/ATTRIBUTION.

## 2. Keputusan user (2026-10-17) dan alasannya

| Topik | Keputusan | Catatan |
|---|---|---|
| Pendekatan | **B. Hibrida berlapis**: hero handmade + kit parametrik + tile kota | A (semua handmade) melampaui budget; C (tile v2) berisiko "kaleng" |
| Rujukan sekre | **Pola umum ormawa Indonesia** dulu; data terpisah agar detail asli bisa diganti | `src/interiors/sekre/data.js` |
| Gedung sekre | **Sekretariat Lembaga Mahasiswa** `way/327530276` | footprint 16,8 × 15,7 m |
| Isi scene sekre | Suasana hidup (NPC) + barang interaktif + mode foto | cutscene tidak diminta |
| Masuk interior | **Pintu-portal** (fade ke scene interior terpisah) | jalan kaki hanya di interior |
| Terrain | **DEM nyata, kampus dulu**, sistem siap diperluas ke kota | tepi distrik menyatu ke y = 0 |
| Skala relief | **Asli 1:1, dirapikan** (relief lokal nyata ±3–6 m) + detail mikro berbasis aturan | tanpa eksagerasi |
| Kit gedung | **Hibrida**: parametrik di kode + ornamen hero dari Blender | |
| Urutan | M0 → M7 (zona sekre sebelum zona Rektorat) | |
| Proses | Plan sangat rinci per tonggak; eksekusi per tonggak oleh satu implementer, satu review di akhir tonggak, tes hanya logika murni/berisiko | memori `lightweight-process-hobby` |

## 3. Arsitektur

```
Tile kota (src/city, sudah ada) ─ datar y=0, di luar distrik
  │  citybake: klip poligon landuse/air terhadap batas distrik + eksklusi gedung per id/centroid
Distrik UNRI (src/districts/unri, BARU) ─ lapisan antara region dan tile
  ├─ terrain: heightfield chunk 500 m (grid 4 m), mesh LOD0/LOD1 + skirt
  ├─ ground: pita/poligon ter-drape (jalan, trotoar, parkir, plaza) + bobot vertex rumput/tanah + air
  ├─ gedung kit: ±200 gedung OSM → arketipe K01–K12 (src/world/kit), di-stream per klaster
  ├─ hero building: modul handmade tunggal (masjid, gerbang SM Amin, GGM) dipasang lewat tabel override
  └─ vegetasi & props distrik: pohon peneduh, motor parkir, PJU kampus (instanced, per sel)
Region hero (kontrak region yang ada + perluasan M0)
  ├─ unri-lembaga  : Sekretariat Lembaga Mahasiswa, Stadion Mini, Student Center, Rusunawa, FH Panam
  └─ unri-rektorat : Rektorat + bundaran, Danau Buatan, Perpustakaan lama, poros taman
Scene interior (src/interiors, BARU) ─ THREE.Scene terpisah lewat pintu-portal
  └─ sekre (pertama); kontrak defineInterior reusable
```

### 3.1 Lapisan kode dan aturan ESLint (tambahan)

| Lapisan | Isi | Boleh impor |
|---|---|---|
| `src/geo/terrain/` | heightfield murni (decode, sample, blend, grade) | tidak ada (sama aturan `geo`) |
| `src/world/kit/` | arketipe gedung, atlas fasad, grammar fasad | aturan `world` |
| `src/districts/` | distrik (`defineDistrict`), distrik UNRI | engine, geo, shared, config, world, sim; **tidak** ui/core/app/entities/city/regions |
| `src/regions/unri-*/` | region hero | aturan `regions` |
| `src/interiors/` | definisi interior (`defineInterior`) + sekre | engine, geo, shared, config, world, sim, entities; **tidak** ui/core/app/city/regions/districts |
| `src/app/` | `regionManager`, `districtMount`, `interiorPortal` (komposisi) | bebas kecuali `main.js` |

`eslint.config.js` ditambah blok untuk `src/districts/**` dan `src/interiors/**` (M0/M2/M5).

### 3.2 Alur data offline

```
data-src/osm/*.json (cache Overpass, sudah ada) ─┐
data-src/dem/srtm/*.hgt (cache SRTM 1″, BARU) ───┼─> tools/campusbake (BARU, Node) ─> public/districts/unri/
src/districts/unri/boundary.js (batas distrik) ──┤        manifest.json, terrain/<ix>_<iz>.bin,
src/regions/unri-*/pads.js (pad hero) ───────────┘        ground/<ix>_<iz>.json, buildings.json, ATTRIBUTION.txt
                                                   └─> tools/citybake (diubah): klip + eksklusi distrik
```

## 4. Kontrak antarmuka (mengikat semua plan)

Semua nama di bawah wajib dipakai persis oleh plan M0–M7. Perubahan kontrak = ubah spec ini dulu.

### 4.1 Terrain (`src/geo/terrain/heightfield.js`, murni)

```js
/** Satu chunk heightfield. Sampel baris-mayor, iz (utara→selatan) lalu ix (barat→timur). */
// { key:'ix_iz', ix, iz, origin:{x,z} /* sudut barat-laut chunk, dunia */, size:500, step:4,
//   n:126 /* sampel per sisi, termasuk tepi bersama */, unit:0.01 /* meter per bit */,
//   bias:-5000 /* cm: y_m = (u16 + bias) * unit */, data:Uint16Array(n*n) }
export function decodeChunk(arrayBuffer, header) -> Chunk        // validasi panjang & header; lempar TerrainDataError
export function sampleChunk(chunk, x, z) -> number               // bilinear; x,z dunia di dalam chunk
export function createHeightField() -> HeightField
// HeightField:
//   add(chunk), remove(key), has(key)
//   heightAt(x, z) -> number            // 0 bila tidak ada chunk (aman: tidak jatuh)
//   normalAt(x, z, out?) -> {x,y,z}     // beda hingga 1 m
//   gradeAlong(x, z, yaw) -> number     // dy/ds searah heading (yaw konvensi sepeda sekarang)
//   version -> integer                  // naik tiap add/remove (cache invalidasi)
export class TerrainDataError extends Error {}
```

Layanan global: `src/app/terrainService.js` membuat satu `HeightField` dan menyuntikkannya sebagai
`ctx.terrain` ke sistem, region, distrik, entitas. Di luar distrik `heightAt` = 0 sehingga stadion & tile tidak
berubah perilakunya.

### 4.2 Distrik (`src/districts/District.js`)

```js
export function defineDistrict(spec) -> DistrictDef
// spec: { id, boundary:[[x,z],...] /* dunia, satu ring CCW */, manifestUrl,
//         build(ctx) -> { group, systems:[{id,phase,update(dt,frame)}], colliders:{isWalkable(x,z), isCameraClear(x,z)},
//                         minimapLayer(ctx2d, view), excludeIds:Set<string> /* 'w123' gedung OSM yang dimiliki distrik */,
//                         whenSettled(x,z) -> Promise, dispose() } }
```

- Koordinat distrik = **dunia** (tidak ada placement; distrik berasal dari data geo).
- Distrik memakai `ChunkStreamer` yang sudah ada (`src/city/ChunkStreamer.js`) untuk chunk terrain+ground dan
  klaster gedung (radius muat 1.000 m, lepas 1.300 m, LOD 600 m — sama dengan kota).
- Collider komposit: urutan `regions (hero) → district → tile kota (fallback)`.

### 4.3 Region (perluasan kontrak yang ada, M0)

Field tambahan opsional pada `defineRegion(spec)`:

```js
// activation: { persistent:true } | { center:{x,z} /*dunia*/, mountRadius:700, unmountRadius:900 }
// proxy?(ctx) -> { group, dispose }       // siluet murah saat region tidak terpasang (≤ 8 draw call)
// povs?: [{ id, label, pose(frame, ctx) }] // POV milik region
// pads?: [{ ring:[[lx,lz]...], y:'median'|number }]   // dipakai campusbake untuk meratakan terrain
```

`build(ctx)` menerima tambahan `ctx.terrain` (HeightField) dan `ctx.heightAtLocal(lx, lz)`.
Build region baru wajib **inkremental**: `build` cepat (< 30 ms), pekerjaan berat lewat
`ctx.schedule(taskFn)` (antrean time-sliced ≤ 4 ms/frame, `src/engine/scheduler.js`, BARU), dan `ready`
(Promise) resolve setelah antrean region habis.

Stadion: `activation:{persistent:true}`, tanpa perubahan isi (paritas draw call stadion ±2% dari baseline M0).

### 4.4 Region manager (`src/app/regionManager.js`, M0)

```js
createRegionManager({ app, store, time, weather, terrain, collider, minimap, createScope })
// register(def) ; update(focusWorld) /* tiap frame: mount/unmount dgn histeresis, maks 1 mount per 0,5 s */
// active() -> [{ def, region, frame }] ; frameOf(id) ; regionAt(x,z) -> id|null
// on('mount'|'unmount', fn) ; dispose()
```

Menggantikan variabel tunggal `stadion`/`frame`/`remountRegion` di `main.js` (lihat laporan kode §1). Komposit
collider, minimap (satu base layer per region aktif), dan POV membaca dari manager.

### 4.5 Koordinat cerita ber-region (M0)

Titik cerita menjadi `{ region:'stadion'|'unri-lembaga'|…|'world', x, z }`. Data chapter lama tanpa `region`
dianggap `'stadion'` (kompatibel). `SAVE_VERSION` naik ke 3 dengan migrasi v2 → v3 (tanpa kehilangan progres).

### 4.6 Kit gedung (`src/world/kit/`, M3)

```js
export const ARCHETYPES  // beku: { K01:{...}, …, K12:{...} } — parameter default per arketipe (§7)
export function planBuilding(input) -> BuildingPlan      // murni, dites
// input: { id:'w282225351', ring:[[x,z]...] /*dunia*/, levels, archetype, overrides, seed, groundY(x,z) }
// BuildingPlan: { masses:[{ obb:{cx,cz,w,d,yaw}, floors, floorH, baseY }], bays:[...], roof:{type,overhang,pitch},
//                 corridor:{side, depth}, openings:[...], signs:[...], ornaments:[{assetId, transform}] }
export function buildBuilding(plan, kitMaterials) -> PartList   // parts {geometry, material, matrix} (pola instanceParts)
export function createKitMaterials(scope) -> KitMaterials       // atlas fasad prosedural + material bersama
```

`PartList` digabung per material per klaster (`mergeByMaterial`, `src/world/util/merge.js`).

### 4.7 Tabel override gedung (`src/districts/unri/buildings.data.js`, M3)

```js
// { 'w282225347': { archetype:'hero:rektorat', levels:5, palette:'putih', roof:'datar-parapet',
//                   sign:'REKTORAT UNIVERSITAS RIAU', sumber:'foto Commons Taman_Unri.jpg', keyakinan:'tinggi' }, … }
export function resolveBuilding(osm, override) -> { archetype, levels, palette, roof, corridorSide, sign, sumber, keyakinan }
export function validateOverrides(table) -> string[]   // daftar galat; kosong = valid (dites)
```

Aturan default (urut, pertama yang cocok menang): `hero:*` override → nama `/dekanat/i` → K02 → `/lab|laborator/i`
→ K04 → `/kantin|food/i` → K07 → `/mus(h)?oll?a|mushola/i` → K06 → `/pendopo|balai bahasa/i` → K08 →
`/auditorium|gelanggang|aula/i` → K05 → `/mangkrak/i` → K10 → `building=apartments` → K09 → luas < 60 m² → K11 →
`/gedung [a-h]\b|kuliah|classroom/i` atau `amenity=university|college` → K01 → lainnya K12.
Lantai: override → `building:levels` (rentang "4-7" → nilai **minimum** 4 kecuali override) → default arketipe.

### 4.8 Interior (`src/interiors/Interior.js`, M5)

```js
export function defineInterior(spec) -> InteriorDef
// spec: { id, label, size:{w,d,h}, spawn:{x,z,yaw}, exitTo:{region, x, z, yaw},
//         build(ctx) -> { scene /*THREE.Scene*/, camera, colliders:{isWalkable(x,z)}, interactables:[Interactable],
//                         photoPresets:[{id,label,pose}], systems:[...], dispose() } }
// Interactable: { id, label, pos:{x,y,z}, radius, prompt, onInteract(ctx) -> void|{text, title} }
```

Portal (`src/app/interiorPortal.js`): `enter(interiorId)` / `exit()`; state mesin `outside → fadingIn → inside →
fadingOut → outside`; eksterior dijeda (sistem eksterior tidak di-update, scene eksterior tidak dirender) tapi
tidak dilepas; interior dilepas penuh saat keluar. `App` mendapat `setView({scene, camera})` agar loop render &
post-processing memakai scene aktif.

### 4.9 Jalan kaki (`src/sim/walkPhysics.js` + `src/entities/Walker.js`, M5)

```js
export function createWalkState({x,z,yaw}) ; export function stepWalk(state, input, dt, collider) -> state
// jalan 1,35 m/s, lari 3,2 m/s (Shift), akselerasi 8 m/s², belok mengikuti mouse yaw; collider 2D
```

### 4.10 Pose & jadwal NPC (M5)

`src/entities/Humanoid.poses.js`: `POSES = { sitCrossLegged, sitChairTyping, guitarStrum, lieDown, writeBoard,
standTalk, drinkCup }`, `applyPose(humanoid, poseId, t)` (animasi idle halus per pose).
`src/sim/activitySchedule.js` (murni): `scheduleFor(hourFloat, seed, slots) -> [{npcId, slotId, poseId}]`.

## 5. Terrain (M1, M2)

### 5.1 Sumber
- **Utama: SRTM 1″ (≈30 m), domain publik.** Direkam Februari 2000 → sebelum stadion dan sebagian besar gedung
  kampus baru → kontaminasi atap minimal. Ubin `N00E101.hgt`. Unduh sekali ke `data-src/dem/srtm/`
  (gitignore), dari mirror resmi (USGS EarthExplorer / OpenTopography / AWS `elevation-tiles-prod` skadi).
- **Cadangan: Copernicus GLO-30** (atribusi wajib "© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH
  2014-2018 provided under COPERNICUS by the European Union and ESA"). Tidak dipakai default karena membaca atap
  (72 m di stadion).
- Riset elevasi (SRTM): Rektorat 32 m, stadion 33 m, gerbang Soebrantas 30 m, gerbang SM Amin 28 m, Danau Buatan
  34 m; grid 8×8 kampus 19–38 m, rata-rata 32 m.

### 5.2 Pipeline `tools/campusbake terrain`
1. Baca `.hgt` (big-endian int16, 3601²), potong bbox distrik + margin 150 m.
2. Proyeksikan ke ENU (pakai `src/geo/projection.js`), resample **bikubik** ke grid 4 m.
3. Buang noise: median 5×5 lalu Gaussian σ = 20 m (5 sampel).
4. Datum: `y = h − h_ref`, `h_ref` = median elevasi sepanjang batas distrik.
5. **Blend ke nol**: bobot `w = smoothstep(0, 120, jarakKeTepi)` terhadap batas distrik **dan** terhadap
   mask stadion + 60 m; `y *= w`.
6. **Pengondisian jalan** (setiap `highway` di distrik): profil memanjang disampel tiap 4 m, dihaluskan
   (Gaussian 3 sampel) dan dibatasi tanjakan ≤ 6% (iterasi maju-mundur); penampang rata selebar
   `lebarJalan + 2×1,5 m`, blend linier 6 m di luar itu.
7. **Pad gedung**: footprint (dan pad region hero) diratakan ke median tanah di dalam footprint; blend 4 m.
   Plint 0,15 m ditambahkan oleh kit, bukan di terrain.
8. **Air**: Danau Buatan (`way/373856980`) & Waduk UNRI (`way/327366050`): muka air = tanah terendah di tepi −
   0,4 m; dasar −1,5 m dari muka air; tanggul lereng 1:3. Parit tepi jalan utama: lebar 1,0 m, dalam 0,6 m,
   offset 1 m dari bahu — **[INFERENSI pola kampus Pekanbaru]**, dapat dimatikan via konstanta.
9. Tulis chunk 500 m selaras `TILE_SIZE` (`src/geo/tiles.js:6`): `Uint16` LE, header di `manifest.json`.
   Hanya chunk yang beririsan dengan distrik + margin.
10. Laporan bake: min/max/mean y, tanjakan maks per jalan, jumlah chunk, ukuran byte.

Determinisme: bake ulang dari cache menghasilkan byte identik (golden test).

### 5.3 Runtime
- Mesh terrain per chunk: LOD0 grid 4 m (126² verts), LOD1 16 m, skirt 2 m ke bawah di tepi chunk.
- Normal dihitung dari heightfield (bukan dari mesh) agar mulus antar chunk.
- Material: `MeshStandardMaterial` + bobot vertex (rumput / tanah merah / tanah basah) dari `ground/*.json`;
  tekstur `surfaceMaps('grass')` (`src/world/textures/surfaces.js:208`).
- Permukaan keras (jalan, trotoar, parkir, plaza) = mesh **ter-drape**: polyline/poligon dipecah tiap ≤ 2 m,
  y = `heightAt + 0,03` (jalan) / `+0,05` (trotoar), `polygonOffset`, UV dunia, `surfaceMaps('asphalt'|'paving'|
  'concrete')`. Marka jalan sebagai decal.
- Air: bidang datar di muka air dengan material air yang ada + registry basah.

### 5.4 Dampak ke sistem yang ada (M1)
Daftar lengkap di laporan kode §2. Prinsip: semua posisi y = `terrain.heightAt(x,z) + offset`.
- `sim/bikePhysics.js`: input `grade`; percepatan tambahan `−g·grade·kSlope` (`kSlope` = 0,55, dituning agar
  tanjakan 6% di kecepatan jelajah terasa berat tapi bisa didaki tanpa sprint).
- `entities/Bicycle.js`: `position.y = heightAt`, pitch rangka = `atan(grade)` dihaluskan; roda mengikuti.
- `core/CameraRig.js`, `core/cameraMath.js`: focus/target/minHeight relatif terhadap `heightAt` di bawah
  kamera dan di bawah fokus; uji `isClear` tetap 2D.
- `core/cameraPresets.js`/`PovDirector`: y pose relatif `heightAt(target)`.
- Entitas (`Runner, Footballer, Vendor, Crowd.plaza, StoryNpcs, StoryMarkers`): y dari `heightAt`.
- `world/Lighting.js:149` frustum bayangan mengikuti y fokus; `TimeOfDay.lights` PJU/lampu sepeda relatif tanah;
  `Weather.wet`/`Weather.rain` genangan & cipratan relatif tanah.
- Collider: aturan tambahan "lereng > 35% tidak walkable" (tanggul danau) di collider distrik.

## 6. Tanah, jalan, dan citybake (M2)

- `tools/campusbake ground`: dari cache OSM — jalan (`highway`, lebar per kelas mengikuti citybake), trotoar
  (`footway`, `path`), parkir (`amenity=parking`), plaza/pedestrian, lapangan (`leisure=pitch`), air, landuse
  (wood, farmland sawit `landuse=farmland` / `crop=oil_palm` bila ada, grass) → `ground/<ix>_<iz>.json`
  (polyline/poligon terkuantisasi 0,1 m + bobot vertex permukaan per sampel grid).
- **citybake diubah**:
  1. Klip poligon landuse/air terhadap batas distrik memakai pustaka `polygon-clipping` (npm, MIT, battle-tested)
     — mengatasi bahaya mask berbasis centroid (laporan kode §3 temuan 4).
  2. Gedung: dibuang bila `id ∈ excludeIds` distrik **atau** centroid di dalam distrik (Overture tanpa id OSM).
  3. Jalan: dipotong per segmen (perilaku mask yang ada).
  4. `parseLevels` menerima rentang `"4-7"` (→ minimum).
  5. Area bake `stadion` diperluas atau area `unri` ditambah agar gedung x < −1500 / z > 1500 ikut terdata
     (FE, BEM FMIPA, Health Sciences Center).
  6. `tests/osmFacts.test.js` diperbarui sengaja (fakta snapshot berubah karena klip) — dicatat di plan M2.
- Batas distrik (`src/districts/unri/boundary.js`): poligon kampus OSM `way/938374562` **dikurangi** mask stadion
  + 40 m dan dirapikan (simplifikasi 5 m). Ring tunggal (poligon OSM kampus sudah tidak memuat titik origin).

## 7. Kit gedung (M3)

### 7.1 Katalog arketipe

| ID | Arketipe | Dipakai | Parameter default | Ciri wajib |
|---|---|---|---|---|
| K01 | `kuliah-koridor` | Gedung A–H fakultas | 1–2 lt, lantai 3,8/3,6 m, bay 3,6 m, selasar 2,4 m | selasar bertiang sisi panjang, jendela nako/jalusi, roster lubang angin di atas jendela, atap pelana/limas seng abu kebiruan, plint abu 0,6 m, talang & pipa turun |
| K02 | `dekanat` | Dekanat | 2 lt | K01 + teras depan berkanopi beton, tangga tengah, papan nama huruf timbul, tiang bendera, pot tanaman |
| K03 | `adb-layar` | IC, Integrated Lab, HSC, Student Center | 3–4 lt, lantai 4,2 m | massa putih/abu muda, layar perforasi oranye-terakota (motif `segitiga`/`vertikal`/`wajik`), atap pelana lebar abu muda tritisan 2,5 m, panel nama hitam huruf putih kapital, selasar kolom putih |
| K04 | `lab-bengkel` | Lab teknik/MIPA/Faperta | 1–2 lt, tinggi lantai 5 m | bentang lebar, atap pelana seng tinggi, pintu gulung, jendela atas (clerestory), exhaust |
| K05 | `aula` | Auditorium Sultan Balia, gelanggang | 1 lt tinggi 7 m | atap tinggi, pintu ganda, kanopi masuk, ventilasi atas |
| K06 | `musala` | Musholla Rektorat/FEB | 1 lt | atap limas tumpang 2 atau kubah kecil, teras keramik, tempat wudu, rak sandal |
| K07 | `kantin` | Kantin FKIP/FT/Puskom | 1 lt | sisi terbuka berkolom, etalase, meja-bangku panjang, atap seng, spanduk menu |
| K08 | `pendopo-kayu` | Pendopo FISIP, Balai Bahasa | 1 lt | tiang/dinding kayu, atap limas, lantai panggung rendah |
| K09 | `rusun` | Rusunawa / Wisma Binawidya | 5 lt | blok koridor, balkon berjemuran, tangga terbuka di ujung, tandon air atap |
| K10 | `mangkrak` | FH Panam, Gedung Mangkrak FISIP | sesuai OSM | rangka beton tanpa finishing, besi tulangan menjuntai, coretan, ilalang, tanpa kaca |
| K11 | `utilitas` | pos satpam, toilet, gudang, TK, luas < 60 m² | 1 lt | atap pelana/datar, pintu & jendela kecil |
| K12 | `ekstrusi-rapi` | footprint tak beraturan | sesuai OSM | ekstrusi + parapet + modul jendela beratlas (cadangan terakhir, tetap bertekstur) |

Hero (handmade, satu kali pakai, dipasang via override `archetype:'hero:<id>'`):
`hero:rektorat`, `hero:masjid-arfaunnas`, `hero:gerbang-sm-amin`, `hero:ggm`, `hero:sekretariat-lembaga`,
`hero:student-center`, `hero:stadion-mini`, `hero:perpustakaan-lama` (M6, katalog H08; milik region `unri-rektorat`).

### 7.2 Grammar fasad
1. Footprint → OBB (PCA) → bila rasio luas footprint/OBB < 0,85 → dekomposisi persegi panjang (maks 4 massa)
   → bila gagal → K12.
2. Lantai: `floors × floorH`; `baseY = median(heightAt)` di footprint + plint 0,15 m.
3. Bay: `round(panjangSisi / bayTarget)`; sisa dibagi rata. Sisi selasar = sisi panjang yang paling menghadap
   jalan terdekat (dari data ground).
4. Modul per bay per lantai: kolom, jendela (tipe per arketipe), roster, AC luar (probabilitas per seed),
   pintu di bay tengah/ujung.
5. Atap: `pelana` (pitch 25°), `limas` (25°), `datar-parapet`, `pelana-lebar` (K03, 15°), overhang 0,8–2,5 m,
   lisplang.
6. Seed `hash(id)` → variasi warna kecil (±3% luminance), letak AC, tirai, kerusakan ringan.

### 7.3 Atlas fasad prosedural
Canvas 2048² dibuat sekali per scope, berisi sel: kaca nako (bilah kaca + bingkai aluminium), jalusi kayu, kaca
biru reflektif, roster (5 pola), keramik dinding, seng gelombang, layar perforasi oranye (3 motif), pintu kayu,
pintu gulung, papan nama kosong. UV mengacu atlas; mipmaps; `anisotropy` maksimal.

### 7.4 Render & streaming
- Klaster = sel 250 m. Per klaster: gabung per material → target 10–14 draw call LOD0.
- LOD0 ≤ 250 m (penuh), LOD1 ≤ 900 m (massa + atap + atlas, tanpa ornamen/selasar), di luar: tidak dirender
  (kabut).
- Perakitan time-sliced ≤ 4 ms/frame lewat `src/engine/scheduler.js`.

## 8. Zona hero dan interior

### 8.1 Region `unri-lembaga` (M4)
Mask kira-kira dunia x −360…+120, z +540…+1.280 (final dari jalan OSM di plan M4; tidak beririsan dengan mask
stadion yang berakhir di z +322). Isi:
- **Sekretariat Lembaga Mahasiswa** (`hero:sekretariat-lembaga`): massa 16,8 × 15,7 m, 1 lantai (OSM tanpa
  levels → **[INFERENSI]** 1 lt), denah **[INFERENSI]** 2 baris × 4 ruang 4,2 × 6 m + selasar tengah 3,7 m
  terbuka di kedua ujung. 8 pintu dengan papan nama di atas: `BEM UNIVERSITAS RIAU`, `DPM`, dan 6 nama dari
  `src/regions/unri-lembaga/sekre.data.js` (default UKM generik, dapat diganti). **Sekre pemain** = ruang
  bersebelahan dengan BEM (dikonfigurasi, default indeks 1). Teras: rak sepatu, sandal menumpuk, papan
  pengumuman, stiker, jemuran almamater biru langit, galon kosong, motor parkir rapat, spanduk ormawa di pagar.
- **Stadion Mini UNRI** (`hero:stadion-mini`, `way/327364388`, kapasitas 5.000): lapangan sepak bola
  (`way/327366049`), jogging track (`way/327363974`); bentuk tribun **[INFERENSI]** sampai ada foto.
- **Student Center (ADB)** (`hero:student-center`, kandidat `way/1480014538`, 53 × 51 m): K03 versi hero.
- **Rusunawa** (`way/327366048`, 69 × 23 m, 5 lt): K09 + detail hero.
- **Gedung FH Panam** (`way/327366046`, 71 × 27 m, 3 lt): K10 mangkrak + ilalang.
- Jalan Muchtar Lutfi dan living street `way/653003414`; parkir `way/938379741`.
- Pintu sekre pemain = trigger portal (`interiorId:'sekre'`).

### 8.2 Interior `sekre` (M5)
- Ruang 4,2 × 6,0 × 3,2 m (dalam). Pintu di sisi selasar, jendela nako ke selasar; dinding plester putih
  kusam dengan bekas selotip; lantai keramik krem 40×40; karpet ambal merah marun motif 3 × 4 m; plafon gipsum
  + 2 lampu TL (emissive + PointLight/RectAreaLight); stopkontak sambungan dengan kabel.
- Isi (semua dari `src/interiors/sekre/data.js`; ID aset mengacu katalog aset):
  papan struktur kabinet (canvas: bagan + kotak "foto" + nama dari data), papan proker/timeline, whiteboard
  coretan rapat, kalender, jadwal piket, piagam & piala, poster acara lama, bendera organisasi + bendera UNRI +
  Merah Putih (tiang meja), lemari arsip besi dengan map ordner berlabel tahun, kardus properti acara, spanduk
  tergulung, dispenser galon, kipas berdiri, printer tua, meja lipat panjang + laptop + gelas kopi, gitar,
  tas & sepatu di depan pintu, stiker di lemari, tikar/bantal.
- **NPC**: 3–6 Humanoid (seed per slot) dengan almamater biru langit atau kaus; slot aktivitas: `rapat-1..4`
  (sitCrossLegged di karpet), `laptop` (sitChairTyping), `gitar` (guitarStrum), `rebahan` (lieDown),
  `whiteboard` (writeBoard), `ngobrol-1..2` (standTalk), `minum` (drinkCup).
- **Jadwal** (`activitySchedule`): 08–12 rapat (4–5 NPC), 12–14 sepi (1–2, makan), 14–18 santai + gitar (3–4),
  18–23 begadang proker (laptop + whiteboard + rapat, 4–6), 23–05 sebagian tidur (rebahan) (2–3), 05–08 kosong
  atau 1 NPC tidur. Jam dari clock game yang sama dengan eksterior.
- **Interaksi (E)**: papan struktur, papan proker, piagam/piala, rak arsip (easter egg "LPJ yang belum
  selesai"), gitar (genjrengan Karplus-Strong), dispenser (animasi isi gelas), kipas (toggle: suara + kertas
  berkibar), saklar lampu (toggle TL), jendela (kamera melihat selasar), whiteboard (baca catatan rapat), pintu
  (keluar). ≥ 10 interaksi.
- **Audio** (prosedural via `AudioBus`, tanpa berkas berlisensi): dengung kipas, gitar, gumaman obrolan,
  **hujan di atap seng** saat cuaca hujan, azan sayup magrib (opsional, volume rendah) **[INFERENSI suasana]**.
- **Cahaya**: sinar jendela mengikuti azimut/elevasi matahari game; TL menyala otomatis 17:30–06:00 kecuali
  dimatikan saklar; GTAO lazy yang sudah ada aktif di interior.
- **Mode foto**: 4 preset (`lesehan`, `pintu`, `pojok`, `atas`) + kamera bebas pada tombol P.
- **Kamera & gerak**: orang pertama default (mata 1,55 m), V → orang ketiga lengan 1,6 m dengan uji
  langit-langit; W/A/S/D, Shift lari, mouse lihat, E interaksi, Esc/pintu keluar.

### 8.3 Region `unri-rektorat` + hero building (M6)
- **Rektorat** (`way/282225347`, ±38 × 65 m): putih, ±5 lt simetris, blok tengah menonjol kaca biru vertikal
  + huruf nama di puncak, sayap dengan pita sunshade horizontal berulang, atap datar parapet gelap, kanopi merah
  di depan (**bentuk selembayung tidak terkonfirmasi → kanopi limas merah sederhana**), palem, tiang bendera,
  bundaran "Putaran Jalan Mukhtar Luthfi" (`way/327363975`).
- **Danau Buatan** (`way/373856980`, 0,33 ha): batu pijakan beton, papan batu lengkung "UNIVERSITAS RIAU".
- **Perpustakaan lama** (`way/282225374`): empat massa 2 lt (**[S]** dari ringkasan situs perpustakaan).
- Poros taman: barisan pohon ramping bertajuk sempit (**[INFERENSI spesies: akasia]**) + palem + rumput.
- Hero building di distrik (bukan region): **Masjid Arfa'unnas** (`way/282230716`, 27 × 27 m, 2 lt, krem + list
  oker, lengkung ogee, tangga keramik putih ke lt 2, kubah mozaik wajik putih-ungu, bulan sabit, huruf timbul),
  **Gerbang SM Amin** (posisi dari OSM/foto di plan M6), **GGM** (`way/314450943`, lingkaran Ø ±82 m, kondisi
  mangkrak: atap terpasang, tiang & undakan semen kasar, ilalang, tanah merah, coretan — kondisi 2026
  **[TIDAK DIKETAHUI]**).

### 8.4 Kehidupan kampus dan integrasi (M7)
- Mahasiswa NPC pejalan kaki (Humanoid + LOD yang ada): almamater biru langit (±30%) / kasual, ransel; jalur dari
  trotoar & selasar (data ground); kepadatan per jam (07–17 ramai, 17–21 sedang, malam sepi). Duduk di bangku.
- Motor parkir instanced: kepadatan per area parkir (parkir IC penuh siang hari); 4 varian model.
- Vegetasi distrik: mahoni, angsana, saga (peneduh jalan), akasia ramping (poros Rektorat), palem, sawit
  (kebun 4,2 ha), semak; sel instans 200 m (`VEGETATION_CELL`).
- Fast travel: `Kampus UNRI — Sekretariat Lembaga` dan `Kampus UNRI — Rektorat`.
- Cerita: chapter 6 "Kampus Biru Langit" (3–4 misi): antar nasi kotak konsumsi rapat dari Kantin ke sekre
  (`deliver`), minta tanda tangan Ketua BEM di depan sekre BEM (`interact` pada NPC), satu putaran Danau Buatan
  (`goto` berantai), masuk sekre dan nyalakan kipas (`interact` pada barang interior). Objective baru `interact`
  (`{type:'interact', target:'<region|interior>:<interactableId>'}`) ditambahkan ke `sim/story/objectives.js` di M7;
  tipe lama tidak berubah. Easter egg: lambang Lancang Kuning
  1-10-62, "Kampus Biru Langit", GGM.
- Atribusi: tambah SRTM di `ATTRIBUTION.txt` distrik, HUD atribusi, README.

## 9. Performa

### 9.1 Budget

| Metrik | Batas | Catatan |
|---|---|---|
| Draw call distrik (terrain + ground + klaster gedung + vegetasi) | ≤ 180 | di titik ukur |
| Draw call region hero aktif | ≤ 250 per region | |
| Draw call total | ≤ 1.000 (target 850) | stadion persistent ±458 ikut terhitung bila terlihat |
| Segitiga terlihat distrik | ≤ 600k | |
| Data distrik (`public/districts/unri`) | ≤ 8 MB | terrain + ground + buildings.json |
| Model GLB baru total | ≤ 6 MB | meshopt bila `gltfpack` tersedia, jika tidak Draco/quantize via export |
| Interior sekre | ≤ 150 draw call, ≤ 150k segitiga | |
| Hitch p95 (GPU d3d11) | < 50 ms | termasuk saat mount region & klaster |
| Siklus masuk/keluar interior 3× | `renderer.info.memory` kembali ke baseline | |
| Siklus mount/unmount region hero 3× | kembali ke baseline | |

### 9.2 Titik ukur E2E
`stadion-pusat`, `jalan-stadion-kampus` (z +500), `sekre-luar` (−219, 1.130), `interior-sekre`,
`rektorat` (−979, 860), `masjid` (−1.009, 1.405).

Catatan (rekonsiliasi plan 2026-10-18): `sekre-luar` berada ±3 m di LUAR batas distrik (tepi selatan kampus melintas
z ≈ 1.127 di x −219) → `heightAt` = 0 di titik itu; gedung sekre (z 1.089–1.109) di dalam distrik (temuan M1). Titik
itu sengaja dipertahankan (juga tujuan perjalanan cepat M7) karena memandang sekre dari jalan di selatan kampus.
`masjid` digeser dari (−1.009, 1.383) — yang berada di dalam footprint masjid `way/282230716` — ke (−1.009, 1.405)
(plan M7 D11).

### 9.3 Mitigasi bila melebihi
Urutan: kurangi LOD0 radius kit → kurangi kepadatan motor/vegetasi → tambah `setDetail('far')` untuk stadion
(sembunyikan crowd/kursi di > 600 m) → impostor billboard untuk vegetasi jauh.

## 10. Penanganan galat

| Kondisi | Perilaku |
|---|---|
| Chunk terrain gagal dimuat/rusak | chunk dianggap datar (`heightAt` = 0 di area itu), toast sekali; ground chunk dilewati |
| Manifest distrik gagal | distrik nonaktif; tile kota tetap (mode tanpa distrik), toast |
| Override gedung tak valid | dev: `validateOverrides` gagal di tes; runtime: kembali ke aturan default + `console.warn` sekali |
| Kit gagal merakit satu gedung | gedung itu jatuh ke K12; klaster tetap |
| Build interior melempar | fade dibatalkan, pemain tetap di luar, toast "Pintu terkunci", scope interior dilepas |
| GLB aset gagal | placeholder prosedural tetap tampil (pola `replaces` yang ada) |
| Bake: sumber tak tersedia | `--offline` memakai cache; tanpa cache → galat jelas berisi URL & langkah unduh |

## 11. Pengujian

Ringan sesuai kesepakatan (tes hanya untuk logika murni/berisiko):
- Unit (Vitest): `heightfield` (decode, bilinear, tepi chunk, 0 di luar, version), blend tepi = 0, pengondisian
  jalan (tanjakan ≤ 6%), pad rata, `planBuilding` (jumlah bay/lantai/OBB/dekomposisi), `resolveBuilding` +
  `validateOverrides` (tabel nyata lulus), `regionManager` (histeresis, LIFO, maks mount/0,5 s),
  `interiorPortal` (mesin state, gagal build), `walkPhysics`, `activitySchedule`, migrasi save v2→v3,
  `bikePhysics` dengan grade.
- Golden: `campusbake` dari cache → byte identik; citybake dengan distrik → fakta yang diharapkan.
- E2E (perluasan `tests/e2e/smoke.e2e.mjs`): rute sepeda stadion → sekre (±1,2 km) tanpa galat konsol; masuk &
  keluar sekre 3×; fast travel ke kampus; angka budget §9 per titik ukur.
- Visual: screenshot per tonggak di titik ukur (Playwright GPU), disimpan ke `docs/screenshots/unri/`.

## 12. Tonggak

| # | Tonggak | Kriteria selesai |
|---|---|---|
| M0 | Fondasi multi-region | `regionManager`, region streaming + proxy, frame/cerita/POV/minimap per region, `scheduler`, save v3; stadion identik (paritas ±2%), semua tes lama lulus |
| M1 | Terrain | `campusbake terrain`, `heightfield`, `terrainService`, mesh terrain, sepeda/kamera/entitas/lampu/cuaca ikut tanah; rute stadion→kampus mulus |
| M2 | Tanah & jalan kampus | ground ter-drape, air, parit; citybake klip + eksklusi; tidak ada z-fighting/celah di batas distrik |
| M3 | Kit gedung | K01–K12, atlas, grammar, tabel override + validator, streaming klaster, ±200 gedung tampil |
| M4 | Zona Lembaga | region `unri-lembaga` lengkap §8.1, pintu portal (stub interior kotak) |
| M5 | Interior sekre | §8.2 lengkap, aset placeholder → final untuk aset prioritas |
| M6 | Zona Rektorat + hero building | §8.3 |
| M7 | Hidup & integrasi | §8.4, budget §9, E2E, README & atribusi, screenshot |

## 13. Asumsi, gap, dan hal yang perlu konfirmasi user

1. Denah dalam Sekretariat Lembaga Mahasiswa (2 × 4 ruang) — **[INFERENSI]** dari ukuran footprint.
2. Isi & nama ormawa di deret sekre — default generik; user dapat mengisi `sekre.data.js`.
3. Lokasi sekretariat BEM UNRI tingkat universitas tidak ditemukan di sumber → diasumsikan di deret ini (sesuai
   ucapan user "sekre gw dekat BEM").
4. Warna cat gedung fakultas lama — **[INFERENSI]** krem/putih; bentuk atap dari tag `roof=tin` + pola.
5. Ornamen Melayu (selembayung) di Rektorat/gerbang — **tidak terkonfirmasi**; tidak dipasang sebagai fakta.
6. `way/1480014538` = Student Center — **[S]** cocok lokasi teks.
7. Kondisi GGM 2026 — tidak diketahui; ditampilkan sesuai foto 2013/2015 (mangkrak).
8. Posisi Gerbang SM Amin, Binakrida, Bangau, FISIP — dari OSM/foto di plan M6.
9. SRTM = permukaan (DSM) 30 m; lekuk < 30 m adalah pahatan berbasis aturan.
10. Luas resmi 345,6 ha vs poligon OSM 244,6 ha — distrik mengikuti OSM.

## 14. Di luar scope

Lalu lintas kendaraan berjalan di kampus; interior selain sekre (kontrak siap, isi belum); RS UNRI & Fakultas
Keperawatan (posisi tak diketahui); kampus Gobah/Pattimura & FK Diponegoro; terrain di luar distrik (sistem siap,
data belum); siang-malam khusus jadwal kuliah per fakultas; multiplayer.

## 15. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Refactor multi-region (M0) merusak stadion | regresi luas | paritas draw call ±2%, harness Plan A, semua tes lama, M0 tanpa fitur kampus |
| Terrain menyentuh banyak sistem (M1) | bug y/kamera | `heightAt` = 0 di luar distrik → stadion tak berubah; tes per sistem; E2E rute |
| Hitch saat mount region/klaster | FPS turun | scheduler time-sliced, maks 1 mount/0,5 s, ukur p95 |
| Kit terlihat repetitif ("kaleng") | gagal tujuan | variasi seed, override per gedung dari foto, ornamen per arketipe, atlas detail, review visual per tonggak |
| Data OSM/DEM berubah | bake beda | cache di `data-src/`, rilis dipin, golden test |
| Budget draw call total | FPS | §9.3 mitigasi berurutan |

## Perubahan setelah plan (rekonsiliasi lintas-plan 2026-10-18)

Kontrak §4 tetap mengikat; daftar di bawah adalah perluasan/ketetapan yang disepakati saat merekonsiliasi plan M0–M7
(rincian & signature lengkap: indeks `docs/superpowers/plans/2026-10-17-unri-00-index.md`, bagian "Rekonsiliasi
lintas-plan" dan "Signature final kumulatif").

1. **§4.1 / §5.4 fisika sepeda:** `stepBike(state, input, dt, { grade = 0, cfg = BIKE } = {})` — parameter ke-4 lama
   `cfg` pindah ke objek opsi (M1; satu-satunya pemanggil `Bicycle.js`). Tidak ada plan lain yang memanggil `stepBike`
   (jalan kaki M5 memakai `stepWalk`).
2. **§4.2 distrik:** `mountDistrict(app, def, opts)` (`src/app/districtMount.js`, M1) dengan opsi kumulatif M1
   (`terrain, scheduler, collider, minimap, city, weather, createScope, baseUrl, toast, logger, createStreamer,
   fetchJson, fetchArrayBuffer, createCanvas`) + M2 (`time`, `isReserved`) + M7 (`services`); ctx build kumulatif +
   `registries` (M2), `isReserved` (M2), `services` (M7). Setiap tonggak MENAMBAH opsi, tidak mengganti.
   Collider berantai: komposit dinamis region (M0) → fallback `createDistrictCollider` (`src/core/Collider.js`, M1,
   `addDistrict`) → tile kota; collider distrik UNRI = `createUnriCollider` (M2, `addChunk/removeChunk`) + M3
   (`addBuildings/removeBuildings` per klaster). Klaster gedung memakai pemilih LOD sendiri (radius 250/900/930 m),
   bukan `ChunkStreamer` (M3 D3); terrain & ground tetap lewat `ChunkStreamer` yang disuntik.
3. **§4.3 region:** field konvensi tambahan `portals` (M4, dibaca portal interior), `nightLights`, `lateRoot`
   (sudah ada), `lateRootWet` opsional (M6). POV region di tombol `Digit8` (M0); tombol 1–4 interior hanya di mode foto
   (M5).
4. **§4.5 save:** `SAVE_VERSION = 3` (M0) menambah field `place` (tempat terakhir ber-region, `savedPlace`). M7 tidak
   menaikkan versi; `reopenForNewChapters(save, chapterCount)` membuka chapter 6 bagi save yang sudah tamat dan tetap
   meneruskan `place`.
5. **§4.6 kit:** `PartList` kit = geometri DUNIA dengan `matrix: null`; part hero bermaterial sendiri (M6) ber-`matrix`
   disimpan di `sink.extra` dan dirender klaster sebagai mesh per material (rekonsiliasi; klaster ber-hero boleh > 3 mesh,
   batas draw call distrik tetap). Id hero baru `hero:perpustakaan-lama`; id gedung sintetis `s-<nama>`
   (`s-gerbang-sm-amin`, M6) diterima `validateOverrides` dan validator `buildings.json`.
6. **§4.7:** aturan default "lainnya K12" diganti M3 D1 (dicatat M3 Task 1 di §4.7 saat eksekusi).
7. **§4.8 interior:** `App.setView({ scene, camera, aoRadius? })` dan `App.setSystemGate(fn)` (M5) menggantikan port
   sementara M4 (`appStage`, `src/app/appView.js` dihapus M5). Portal menerima opsi `onInteracted(interiorId, itemId)`
   (M5) yang dipakai M7 untuk objective `interact` (`'<interior>:<id>'`).
8. **§6 / format ground:** `ground/<key>.json` v1 = koordinat bulat 0,1 m relatif sudut barat-laut chunk + ekstensi
   aditif `areas[].level`, `ditches`, `veg`, `props` (M2). Konsumen runtime (M3, M7) wajib mengurai lewat
   `parseGroundChunk(json, key)` (`src/districts/unri/groundData.js`) → meter dunia.
9. **§9.1 budget distrik:** M2 ≤ 110 draw call + M3 gedung ≤ 70 (termasuk hero distrik M6) = ≤ 180; kehidupan M7
   (mahasiswa, motor, props) diukur terpisah dan masuk total ≤ 1.000.
10. **§9.2:** lihat catatan di §9.2 (`sekre-luar` di luar batas distrik; `masjid` (−1.009, 1.405)).
11. **Aset motor:** A01/A02 dibuat M4 (`a01-motor-bebek.glb`, `a02-motor-matic.glb`, material `unri:bodi|hitam|krom|lampu`);
    M7 hanya menambah A03/A04 dengan nama material yang sama.
