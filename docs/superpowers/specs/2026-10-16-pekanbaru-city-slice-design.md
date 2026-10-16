# Desain: Kota Pekanbaru — Vertical Slice (Fondasi Engine + Streaming Tile OSM)

Tanggal: 2026-10-16 · Status: disetujui user (brainstorming 2026-10-16) · Branch target: `feat/pekanbaru-slice`

## 1. Tujuan

Mengubah simulator dari **satu kawasan 1,4 × 1,4 km yang dibangun sekaligus** menjadi engine yang dapat
memuat **kota Pekanbaru** secara bertahap. Visi jangka panjang (dari user: "semuanya") mencakup wisata
virtual, game bercerita, showcase landmark, dan simulasi perkotaan; keempatnya adalah **lapisan di atas
satu fondasi**. Spec ini hanya mencakup fondasi + vertical slice yang membuktikan pipeline end-to-end:

- **Area A — Stadion:** ±3 × 3 km berpusat di Stadion Utama Riau. Stadion yang sudah ada menjadi
  *region handmade* di tengah; sekelilingnya dari data nyata.
- **Area B — Pusat kota:** ±1,5 × 1,5 km berpusat di Masjid Raya An-Nur (mencakup sebagian
  Jl. Sudirman). Terpisah ±8,3 km dari stadion (terukur dari OSM); hasil bake dibulatkan ke grid 500 m sehingga menjadi 2 × 2 km; dicapai lewat **fast travel**.
- Sisa kota dapat ditambahkan nanti **hanya dengan menambah bbox di konfigurasi bake**, tanpa kode baru.

### Kriteria sukses
1. Semua tes lama lulus; tampilan dan perilaku kawasan stadion tidak berubah (paritas draw call ±5%).
2. Region dapat di-`build()` lalu di-`dispose()` 3× berturut-turut dan `renderer.info.memory`
   (geometries, textures) kembali ke baseline.
3. Bersepeda 1,5 km ke segala arah dari stadion: tanpa error konsol, tile muncul sebelum terlihat
   (tertutup kabut), hitch frame p95 < 50 ms saat tile dimuat (diukur Playwright di desktop).
4. Fast travel ke Area B berfungsi; minimap menampilkan jalan/bangunan tile; atribusi data tampil.
5. Budget: tile kota ≤ 150 draw call dan ≈ 300k segitiga terlihat; total data tile slice ≤ 20 MB.
6. Bug dompet (belanja "dikembalikan" saat reload) hilang, save lama dimigrasi (tidak dibuang).

## 2. Keputusan & alasan

| Keputusan | Alasan |
|---|---|
| **Bake offline OSM + Overture → tile GLB** (bukan mesh di klien, bukan Google 3D Tiles) | Paling ringan di HP, data dapat dikurasi, collision & minimap ikut dibake. Google 3D Tiles dilarang cache/offline, ditagih per sesi, tanpa collision, cakupan Pekanbaru tak terverifikasi. |
| **Overture buildings** melengkapi OSM | OSM Pekanbaru (Overpass, 2026-10-16): 16.635 bangunan, hanya 117 punya `height` — cakupan diperkirakan < 10%. Jalan sudah lengkap (35.166 way). Overture (ODbL) menggabungkan OSM + footprint ML dengan prioritas OSM. |
| **Frame dunia = ENU lokal**, origin = centroid poligon OSM "Stadion Utama Riau", **+X = timur, −Z = utara**, Y atas | Konvensi lama (`cameraPresets.js:6`, `App.js:272`) tetap; minimap/kompas tetap "utara di atas". |
| **Region handmade punya `placement {x, z, yaw}`** sendiri | Orientasi stadion nyata belum tentu tepat utara-selatan; region berikutnya (An-Nur) punya orientasi sendiri. Koordinat cerita/collider/layout tetap **region-lokal**, jadi data lama tidak perlu ditulis ulang. |
| **Fakta mengalahkan gaya** (keputusan user 2026-10-15) | Elemen fiktif di luar mask region (danau, lapangan baseball, sungai kecil, helipad, skate park, amfiteater) **dihapus** bila tidak ada di OSM; versi OSM yang menang. |
| Tanah **datar** (y = 0) | Pekanbaru relatif datar; DEM ditunda (backlog). |
| Tile **500 m**, indeks `ix = floor(x/500)`, `iz = floor(z/500)` | Selaras dengan sel culling vegetasi 200 m yang sudah ada; ±25 tile aktif aman untuk HP. |
| Minimap tile **digambar di klien** (Canvas 2D dari data vektor tile) | Tanpa dependensi native di pipeline (`canvas`/`sharp`); murah karena hanya polygon/polyline 2D. |
| Tile hasil bake **di-commit** ke `public/tiles/` | Deploy Pages tetap statis; CI tidak perlu menjalankan bake (butuh jaringan). Ukuran slice ±10–15 MB. R2 dipertimbangkan saat seluruh kota dibake. |

## 3. Arsitektur

```
src/
  engine/                     (BARU) lifecycle & komposisi, tanpa impor world/ui
    SystemRunner.js           fase eksplisit input → sim → world → camera → ui; isolasi galat per sistem
    ResourceScope.js          cache material/geometri/tekstur ber-refcount; dispose() melepas semuanya
    disposeTree.js            lepas geometri/material/tekstur sebuah Object3D (hormati ResourceScope)
  geo/                        (BARU) murni, dites
    projection.js             createProjection({lat0, lon0}) → {toWorld(lat,lon), toLatLon(x,z)}
    tiles.js                  tileOf(x,z), tileCenter(ix,iz), tilesInRadius(x,z,r), tileKey
    regionTransform.js        toLocal/toWorld untuk placement {x,z,yaw}
  regions/                    (BARU) data + builder per region handmade
    Region.js                 kontrak & helper (lihat 3.1)
    stadion/                  index.js (build), site.js (dulu SITE), layout.js (dulu world/layout.js), mask.js
  city/                       (BARU) klien streaming
    ChunkStreamer.js          state machine muat/lepas tile (logika murni, terpisah dari I/O)
    TileLoader.js             fetch manifest + GLB (MeshoptDecoder) + data JSON
    TileCollider.js           spatial hash footprint per tile
    tileMinimap.js            gambar layer minimap tile ke Canvas 2D
    cityMaterials.js          material bersama tile (dinding, atap, jalan, air, landuse) + tekstur jendela
  shared/                     minimapMath.js dipindah dari ui/ (perbaikan layering)
tools/citybake/               (BARU) Node offline, tidak ikut bundle
  config.js                   origin, area (bbox), tileSize, kuota
  fetchOsm.js                 Overpass → data-src/osm/*.json (cache)
  fetchOverture.js            DuckDB (@duckdb/node-api) → data-src/overture/*.geojson (cache)
  merge.js                    gabung OSM + Overture (OSM menang bila tumpang tindih)
  height.js                   estimateHeight(feature) — kontribusi domain user
  geometry/*.js               extrude bangunan, pita jalan, poligon air/landuse
  bakeTile.js                 satu tile → glb (LOD0, LOD1) + data.json
  index.js                    CLI: node tools/citybake --area stadion|pusat|all
public/tiles/
  manifest.json               {version, origin, tileSize, tiles:[{key, ix, iz, bytes, lod:[...]}]}
  {ix}_{iz}.lod0.glb | .lod1.glb | .data.json
  ATTRIBUTION.txt
```

Arah dependensi yang ditegakkan (dicek ESLint `no-restricted-imports`):
`engine` ← semua; `geo`, `shared`, `story` murni (tanpa three/DOM kecuali `shared` boleh three);
`sim` tanpa DOM (three masih dipakai `trackPath.js` — utang, belum ditegakkan);
`world`, `city` → `engine`, `geo`, `shared`, `config`; `regions` → itu semua + `world` (region merakit
builder dunia); `ui` → semua kecuali `main`;
`core` **tidak** mengimpor `ui` atau `world/stadium/*`. `main.js` = composition root saja.

### 3.1 Kontrak

```js
// Sistem (dipakai SystemRunner)
{ id: string, phase: 'input'|'sim'|'world'|'camera'|'ui', update(dt, ctx): void, dispose(): void }

// Region handmade
{
  id: 'stadion',
  placement: { x, z, yaw },             // posisi di frame dunia (ENU)
  mask: [[x,z], ...],                   // poligon region-lokal; fitur kota di dalamnya dibuang saat bake
  build(ctx) → Promise<{
    group: THREE.Group,                 // SEMUA objek region (termasuk lampu/hujan/bintang yang dulu ke scene)
    colliders: { isWalkable(lx,lz,clear), isCameraClear(lx,ly,lz) },   // region-lokal
    minimapLayer: (ctx2d, view) => void,
    systems: System[],
    dispose(): void,
  }>
}

// Collider komposit (menggantikan fungsi global Collider.js)
isWalkable(x, z): region yang memuat (x,z) → region.colliders (setelah toLocal); selain itu → TileCollider
```

`ctx` berisi `{ scene, renderer, camera, scope: ResourceScope, store, clock }`. TimeOfDay/Weather
menjadi sistem global yang **mendaftar** material emissive/basah lewat registry (`registerEmissive`,
`registerWet`) alih-alih `scene.traverse` saat konstruksi — sehingga GLB dan tile yang datang belakangan
ikut tercakup dan dapat di-unregister saat dispose.

## 4. Fase

### Fase 0 — Fondasi engine (tanpa perubahan visual)
1. `SystemRunner` menggantikan updatable raksasa (`main.js:118-134`) dan `App.#safeUpdate`; satu sistem
   galat tidak mematikan sistem lain.
2. `ResourceScope` + `disposeTree`; cache modul (`materials.js:17`, `entities/util.js:7`,
   `Humanoid.hair.js:80`, `Humanoid.face.js:63`, `Ground.materials.js:60`, `Humanoid.lod.js:18`,
   `models.js:10`) dan material yang dibuat saat impor (`Landscape.baseball.js:16`, `Ground.roads.js:19`)
   dipindah ke scope.
3. `SITE`/`STADIUM`/`LAYOUT` diinjeksikan: `buildWorld()` → `regions/stadion.build(ctx)`. Tahap ini boleh
   bertahap: builder menerima `site` sebagai parameter dengan default impor lama, lalu impor default dihapus.
4. TimeOfDay/Weather/lampu/hujan menempel ke grup milik pemiliknya, bukan `scene`; registry emissive/basah.
5. `dispose()` di App (null-kan `setAnimationLoop`, lepas listener resize), Input, Weather (tutup
   AudioContext), entitas; panggil `dispose` yang selama ini dibuang (`main.js:137,148,240`).
6. Perbaikan layering: `minimapMath` → `shared/`; geometri stadion untuk collider lewat region, bukan
   `core/Collider.js` mengimpor `world/stadium/*`; StoryDirector berbicara ke HUD lewat callback/efek.
7. `main.js` dipecah: `main.js` (composition), `keymap.js`, `shop.js`, `session.js`, `devtools.js`.
8. **Bug dompet:** save `v2` menyimpan `wallet {balance, items}`; migrasi `v1 → v2` memberi
   `balance = startBalance + rupiah` sekali (saldo awal tidak hilang), lalu tidak ada lagi credit-ulang saat load (`StoryDirector.js:56`).
9. Duplikasi kebenaran: posisi tugu (5 file) dan aturan lampu rusak (`index.js:127`,
   `TimeOfDay.lights.js:32`) dipusatkan di data region; collider danau mengikuti bentuk visual (atau
   hilang bila danau dihapus di Fase 3).

### Fase 1 — Geo + citybake (offline)
1. `geo/projection.js` (ENU, presisi < 1 cm dalam 20 km), `geo/tiles.js`, `geo/regionTransform.js`.
2. Fetch & cache OSM (Overpass) dan Overture (DuckDB, bbox) ke `data-src/` (di-`.gitignore`).
3. Merge, potong per tile, buang fitur di dalam `mask` region (setelah transform placement).
4. Geometri: bangunan extrude (dinding + atap datar; atap pelana untuk footprint kecil < 150 m²
   bila sederhana), jalan sebagai pita sesuai `highway` (lebar per kelas), air, landuse (warna per kelas).
   Semua di-re-center ke pusat tile; digabung per material; variasi lewat vertex color.
5. LOD1: bangunan sebagai kotak tanpa atap pelana, jalan kecil dibuang.
6. `data.json` per tile: footprint bangunan & air (presisi 0,1 m, tile-lokal), polyline jalan + kelas,
   nama jalan utama (label minimap).
7. Kompres dengan glTF-Transform + meshoptimizer; tulis `manifest.json` + `ATTRIBUTION.txt`.
8. `height.js`: `estimateHeight(feature)` — urutan: `height` → `building:levels × 3,2 m` → heuristik
   (kelas `building`, luas, kelas jalan terdekat). **Aturan heuristik ditulis user** (pengetahuan lokal:
   ruko 2–3 lantai di arteri, rumah 1 lantai di gang, gedung tinggi di Sudirman).

### Fase 2 — Streaming klien
1. `ChunkStreamer` (murni): input `focus(x,z)` + manifest → daftar aksi `load/unload/swapLod`;
   muat r ≤ 1.000 m, lepas r > 1.300 m (histeresis), LOD1 untuk 600–1.000 m, maks 2 muat paralel,
   prioritas jarak terdekat, batal bila keluar radius sebelum selesai.
2. `TileLoader` mengeksekusi aksi (GLTFLoader + MeshoptDecoder dari `three/examples`), memasang grup
   tile di `tileCenter`, mendaftarkan material ke registry, `freezeStatic` per tile, dispose saat lepas.
3. `TileCollider`: spatial hash sel 25 m per tile; dipakai collider komposit.
4. Minimap: `Minimap2D` menyusun layer region (bake lama) + layer tile (`tileMinimap.js`, di-cache per tile).
5. Kabut/far plane disetel agar batas muat tak terlihat; shadow tetap lokal ±200 m.
6. Atribusi: teks kecil tetap di HUD "© OpenStreetMap contributors · Overture Maps Foundation" + tautan
   ke openstreetmap.org/copyright; `ATTRIBUTION.txt`; README.

### Fase 3 — Integrasi slice
1. Stadion ditempatkan di frame ENU: `placement` dihitung dari poligon OSM stadion (centroid + yaw sumbu
   panjang); `mask` = poligon kompleks stadion (fallback: elips jalan lingkar + parkir).
2. Elemen fiktif di luar mask dihapus; prop yang bergantung pada jalan prosedural Naga Sakti
   (angkot/bus) dipindah ke rute dari polyline OSM atau dinonaktifkan bila tak selaras.
3. Tanah: tanah persegi 1.400 m (`Ground.js:21`) diganti tanah per tile (landuse) + tanah region di dalam mask.
4. Fast travel: daftar titik (Stadion, Masjid Raya An-Nur) di menu/peta; teleport → streamer memuat
   sebelum layar muat ditutup.
5. Smoke test Playwright (`tests/e2e/`): load, tanpa error konsol, draw call < budget, siklus
   build/dispose region 3× kembali ke baseline memori, rute sepeda skrip 1,5 km tanpa hitch > budget.

## 5. Penanganan galat

- Tile gagal dimuat: dicoba ulang 2× (backoff), lalu ditandai gagal; area tetap dapat dilalui (collider
  kosong), toast sekali "Sebagian peta gagal dimuat". Tidak memblokir loop.
- Manifest gagal: mode "hanya region" (perilaku hari ini) + toast.
- Data JSON tile divalidasi bentuknya (versi, array angka hingga) sebelum dipakai; tile tak valid dilewati.
- Sistem yang melempar galat 3× berturut-turut dinonaktifkan **sendiri**, dicatat ke konsol dengan id sistem.
- Save rusak/versi tak dikenal: dicadangkan ke kunci `*.bak` lalu mulai baru (bukan dibuang diam-diam).

## 6. Pengujian

- TDD untuk modul murni: `projection`, `tiles`, `regionTransform`, `ChunkStreamer`, `TileCollider`
  (titik-dalam-poligon, hash), `estimateHeight`, mask poligon, migrasi save v1→v2, `SystemRunner`
  (isolasi galat, urutan fase), `ResourceScope` (refcount, dispose).
- Golden test citybake: fixture OSM/Overture mini (beberapa bangunan, jalan, air) → jumlah segitiga,
  bbox, isi `data.json` stabil.
- E2E Playwright seperti Fase 3 butir 5. CI menjalankan unit + golden; E2E dijalankan lokal dulu,
  masuk CI bila stabil.
- Ambang coverage yang ada (90/85) berlaku untuk modul murni baru.

## 7. Di luar scope (backlog)

Simulasi lalu lintas & banjir; NPC/kendaraan per distrik; tinggi bangunan dari Google Open Buildings 2.5D;
DEM/terrain; jembatan bertingkat (Jembatan Siak IV sebagai region handmade nanti); landmark handmade
Area B; vegetasi dari landuse; i18n; `webglcontextlost`; rebinding tombol; hosting R2; bake seluruh kota.

## 8. Risiko

| Risiko | Mitigasi |
|---|---|
| Akses Overture/DuckDB ke S3 gagal atau lambat | Cache di `data-src/`; fallback hanya OSM (kota lebih jarang, tetap jalan). |
| Orientasi/posisi stadion handmade tak selaras dengan OSM | `placement.yaw` + mask dari poligon OSM; cek visual di Fase 3. |
| Refactor Fase 0 memecah perilaku | Tanpa perubahan visual; paritas draw call; tes lama wajib lulus tiap commit. |
| Hitch saat parse GLB di HP | Tile kecil (≤ 300 KB), maks 2 muat paralel, LOD1 dulu; Worker parsing bila terukur perlu. |
| Kewajiban lisensi ODbL | Atribusi tampil + `ATTRIBUTION.txt`; tile berisi data turunan dinyatakan ODbL di file itu. |
