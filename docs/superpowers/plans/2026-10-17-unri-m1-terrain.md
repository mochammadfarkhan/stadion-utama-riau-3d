# M1 Terrain — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (satu implementer, satu review di akhir tonggak — memori `lightweight-process-hobby`). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kawasan kampus UNRI mendapat terrain berelevasi nyata (SRTM 1″, dirapikan 1:1) yang menyambung mulus ke kota datar dan stadion: alat bake `npm run bake:campus -- boundary|terrain` menghasilkan batas distrik beku (`UNRI_BOUNDARY`) dan chunk heightfield 500 m (`public/districts/unri/terrain/*.bin`), runtime memuat chunk lewat streaming ke `HeightField` global (`terrainService`), menggambar mesh LOD0/LOD1 + skirt, dan seluruh sistem yang punya y (sepeda + grade fisika, kamera, POV, entitas, penanda, lampu, cuaca) mengikuti tanah — stadion tetap identik (heightAt = 0 tepat di luar distrik).

**Architecture:** Tiga lapis. (1) `tools/campusbake` (Node, murni + I/O tipis): SRTM `.hgt` → grid dunia 4 m bikubik → median 5×5 → Gaussian σ 20 m → datum (median tepi) → blend smoothstep 120 m ke batas & mask stadion + 60 m → pengondisian jalan (profil ≤ 6 %, inti Lipschitz) → pad gedung → danau → kuantisasi Uint16 LE per chunk; batas distrik = poligon kampus OSM − buffer(mask stadion, 40 m) via `polygon-clipping` (hanya tools), disimpan sebagai data beku. (2) `src/geo/terrain` (murni): format, `decodeChunk`, `sampleChunk`, `createHeightField`, raster sel. (3) Runtime: `defineDistrict` + `unriDistrict` (terrain saja), `terrainChunks` (ChunkStreamer diinjeksi, scheduler M0, lubang tanah dasar kota per sel), `TerrainMesh`, `mountDistrict` (scene, sistem, collider berantai region → distrik → tile, lubang `tanahKota`, minimap), lalu perkabelan y di sistem yang ada.

**Tech Stack:** Node ≥ 20 (ESM, `node:zlib` gunzip, `node:crypto` sha256), Vitest 5.0.4, three 0.186.1, `polygon-clipping` 0.15.7 (MIT, devDependency, hanya `tools/`), SRTM GL1 1″ ubin N00E101 (domain publik) dari AWS Open Data Terrain Tiles, Playwright global (alat `tests/e2e/shot.mjs` M0) untuk screenshot GPU.

---

## Hasil riset & verifikasi (2026-10-17/18, saat menulis plan)

| Hal | Temuan | Cara verifikasi |
|---|---|---|
| Sumber SRTM tanpa login | `https://s3.amazonaws.com/elevation-tiles-prod/skadi/N00/N00E101.hgt.gz` → **HTTP 200**, `Content-Length: 8376941`, `ETag "16e6f55bbca4ce2caf1671381a458c26"`, `Last-Modified 2016-04-26`. Header gzip memuat nama `N00E101.hgt`; ISIZE (4 byte terakhir, range request) = **25.934.402 = 3601² × 2** → 1″. USGS EarthExplorer & OpenTopography butuh akun/API key → tidak dipakai. | `curl -I` + `curl -r 0-31` + `curl -r 8376937-8376940` |
| Isi ubin | sha256 `.hgt` (didekompresi) = `9dbcbb8021efcb2a472fae201ab9a3c8a323e61c69f0d8ca6b1eea134998d314` (dipin di `config.js`); 0 void; min −57, maks 514 m. Bilinear di titik riset: Rektorat 32,5 m, stadion 33,1, Gerbang Soebrantas 29,8, Danau Buatan 34,3, SM Amin 28,0, FISIP 40,3 — cocok dengan tabel riset §5 (opentopodata). | Unduhan ke direktori sementara di luar repo (bukan ke repo) |
| Batas distrik nyata | Poligon kampus OSM `way/938374562` **membungkus sisi selatan & timur stadion** (5 verteks kampus di dalam mask, 12 verteks mask di dalam kampus) → pengurangan mask + 40 m wajib. Hasil: **1 potongan**, 70 titik setelah Douglas–Peucker 5 m, luas 2.398.439 m² (kampus 2.435.156 m²), 0 m² dibuang. Titik ukur `sekre-luar` (−219, 1.130) berada ±3 m di LUAR batas (tepi selatan kampus melintas z ≈ 1.127 di x −219) → y = 0 di sana; gedung sekre (z 1.089–1.109) di dalam. | Prototipe kode plan ini pada cache Overpass `unri-kampus` (2026-10-17T13:19:51Z) |
| Bake terrain nyata | 21 chunk (`-3_-1 … -2_4`), 651,2 KB, 8–11 s, h_ref 32,49 m; y di distrik −7,58…+9,07 m, rerata 0,79 m; 194 jalan, 0 di atas 7 % setelah pad/air (maks 6,94 % footway, toleransi bilinear grid 4 m); Danau Buatan muka −1,86 m dasar −3,36 m; Waduk UNRI muka −4,69 m dasar −6,19 m. Dua kali bake → hash semua berkas identik. Paritas: 109.722 titik di mask stadion + 60 m → |y| maks **0** tepat. | Prototipe |
| Runtime di browser (d3d11) | Distrik termuat, `whenSettled` true di 5 titik; segitiga distrik ±130k–237k (≤ 600k budget); tanpa galat konsol dari kode baru. | Prototipe salinan repo + Playwright |
| Prototipe kode | Semua berkas & tes di plan ini dijalankan di salinan sementara repo (stub scheduler setara M0): **977 tes lulus** (seluruh tes lama + baru), `eslint` 0 galat. | — |
| Algoritma jalan | Versi naif "jalan terdekat menang" menghasilkan 28 jalan > 7 % (tangga di simpang/jalan sejajar). Versi plan (profil 1D + inti Lipschitz 8-tetangga via Dijkstra selubung atas/bawah + inti dikunci terhadap pad) → 0. | Prototipe, diukur ulang pada grid akhir |

## Prasyarat

- M0 **selesai** (indeks: baris M0 "selesai") dengan API persis bagian "Serah terima ke M1" plan M0: `createScheduler` (`schedule(task, {owner})`, `cancelOwner`, `pending(owner)`, `whenIdle`), `FLAT_TERRAIN`/`createTerrainService` (stub), `createRegionManager`, `mountRegion` ctx `terrain`/`heightAtLocal`, `createDynamicCompositeCollider` (`setRegions`, `setFallback`), `Minimap2D.setBaseLayer/removeBaseLayer`, `tests/e2e/shot.mjs`, `window.__sim.terrain`. Di `main.js` M0: variabel `regions`, `scheduler`, `terrain`, `colliders` dari `createRegionLayer`, `frame = regions.frameOf(STADION_ID)`, penanda misi di `app.scene` (koordinat dunia).
- **Internet sekali** di Task 8: Overpass (cache `data-src/osm/unri-kampus.json`, ±1 MB, ±35 s) dan SRTM (8,4 MB gzip → `data-src/dem/srtm/N00E101.hgt` 25,9 MB). `data-src/` sudah di-.gitignore (baris `data-src/`) — tidak ada data mentah masuk repo.
- Playwright global + GPU d3d11 (seperti E2E M0) untuk Task 22.
- Pohon kerja bersih kecuali `.claude/launch.json` dan dokumen plan.

## Konvensi eksekusi (dari indeks, mengikat)

- Tes satu berkas: `node node_modules/vitest/vitest.mjs run <path>`; semua: `node node_modules/vitest/vitest.mjs run`. Lint `npm run lint`, build `npm run build`, E2E `npm run e2e -- --gpu d3d11`.
- Commit: `git add <file…>` lalu **perintah terpisah** `git commit -m "<pesan>"` (hook `block-no-verify`). Conventional commit, bahasa Indonesia.
- TDD (tes gagal → implementasi → lulus) hanya untuk logika murni/berisiko spec §11; kode visual: implementasi + smoke + screenshot.
- Saat menyalin kode dari plan: berkas **baru** ditulis utuh; berkas **lama** diubah dengan pasangan "Cari → Ganti" persis (teks "Cari" unik di berkas; bila M0 sudah mengubah baris sekitarnya, cari teks yang sama — semua jangkar dipilih di luar baris yang diubah M0, kecuali yang ditandai).

## Deviasi dari indeks (dengan alasan)

1. **Berkas di luar peta M1 indeks yang diubah:** `src/core/Collider.js` (fungsi baru `createDistrictCollider`; M0 menyediakan `setFallback`, urutan region → distrik → tile disusun sebagai fallback berantai), `src/city/index.js` + `src/city/groundHole.js` baru (**lubang `tanahKota`**: tanah dasar kota y −0,05 menulis depth sehingga terrain di bawah −0,05 — cekungan, danau — tidak akan pernah tampak; lubang per sel 4 m tepat di sel yang meshnya tampil), `src/entities/util.js` (`flatGround`, `groundOf`), `src/entities/Crowd.js` (meneruskan tanah ke plaza), `src/world/Weather.js` (meneruskan `ctx.heightAt`/`ctx.terrain`), `src/app/devtools.js` (`__sim.district`), `src/config/constants.js` (konstanta tanjakan di `BIKE`).
2. **`polygon-clipping` dipasang di M1** (indeks: M2) karena batas distrik M1 membutuhkannya. Task 0 Step 3 M2 (`npm i -D polygon-clipping@0.15.7`) menjadi no-op.
3. **`.gitignore` tidak diubah**: `data-src/` sudah diabaikan seluruhnya (cache DEM ikut).
4. **Distrik tidak mengimpor `city/`** (spec §3.1): `ChunkStreamer` & `fetchJson` disuntikkan `mountDistrict` (`ctx.createStreamer`, `ctx.fetchJson`).
5. **`stepBike(state, input, dt, { grade, cfg })`**: parameter ke-4 lama `cfg` dipindah ke dalam objek opsi (satu-satunya pemanggil, `Bicycle.js`, ikut diubah). Selain `−g·grade·kSlope` (kSlope 0,55, spec §5.4) ditambah: laju puncak turun saat menanjak (`climbLoss` 3 → 6 % = 82 %), laju luncur saat menurun tanpa kayuh (`glidePerGrade` 100 → 6 % ≈ 6,5 m/s), tertahan diam di lereng < 8 %. Alasan: dengan drag lama 0,6·v dan akselerasi 3,5 m/s², suku gravitasi saja (0,32 m/s² di 6 %) tidak terasa sama sekali (spec §1 butir 1 "menanjak terasa berat, menurun meluncur"). Paritas datar: grade 0 → perilaku identik (dites).
6. **Berkas tambahan di dalam tonggak:** `src/geo/terrain/cellMask.js`, `tools/campusbake/{cli,osm,boundary,manifest}.js`, `tools/campusbake/terrain/{grid,bakeTerrain}.js`; tes baru di `tests/geo/terrain/`, `tests/campusbake/`, `tests/districts/`, `tests/world/`.
7. **Kontrak tambahan (aditif):** `manifest.terrain` + `hRef` & `water:[{id,name,level,bed}]` (muka air untuk mesh air M2); hasil build distrik + `groundHole` & `stats()`; `terrainChunks` + hook `onChunkMesh/onChunkRelease` (diminta M2, disediakan sekarang); `povPose(..., heightAt)`; `StoryMarkers({ground})`; `StoryNpcs.placeOnGround`; `TimeOfDay.registerLamps` lampu boleh punya `y`.

## Batasan sementara M1 (diketahui, diselesaikan M2/M3 — jangan diperbaiki di M1)

- **Lapisan datar tile kota di dalam distrik** (landuse "education" poligon kampus, jalan, air) digambar sesudah terrain (renderOrder −3/−2/−1 vs terrain −3,5): tampak di atas terrain bila tanah < +0,02 m, tertutup bila tanah lebih tinggi. Akibatnya **jalan kota di kampus sebagian besar tertutup rumput terrain** dan petak landuse muncul di cekungan/dekat tepi. M2 mengklip lapisan kota terhadap batas dan men-drape jalan kampus. Collider tidak berubah (sepeda tetap bisa melintas).
- **Gedung tile kota di kampus** tetap berdasar y = 0: terbenam bila tanah > 0, mengambang bila < 0 (±0–3 m umumnya). M2 membuangnya dari tile, M3 menggantinya dengan gedung kit.
- Air: hanya lapisan air kota datar (y 0,06) di atas dasar danau yang digali; bidang air di muka air = M2.

## Struktur file

| File | Tanggung jawab |
|---|---|
| `src/geo/terrain/format.js` | Konstanta format (`CHUNK_SIZE=500`, `STEP=4`, `N=126`, `UNIT=0.01`, `BIAS=-5000`, `FORMAT`, `VERSION`, `TERRAIN_HEADER`, `ZERO_U16`) |
| `src/geo/terrain/heightfield.js` | `TerrainDataError`, `validateTerrainHeader`, `decodeChunk`, `sampleAt`, `sampleChunk`, `createHeightField` |
| `src/geo/terrain/cellMask.js` | `rasterizeRing` (sel di dalam ring, aturan = `pointInPolygon`) |
| `tools/campusbake/config.js` | SRTM (URL, sha256), kawasan OSM, `BOUNDARY`, `TERRAIN`, `ROAD_WIDTHS`, `REGION_PADS`, `BUDGET`, `PATHS` |
| `tools/campusbake/dem/readHgt.js`, `dem/fetchSrtm.js`, `dem/resample.js`, `dem/filters.js` | baca .hgt, unduh+cache+verifikasi, bikubik Keys, median & Gaussian |
| `tools/campusbake/terrain/{grid,datum,blend,roads,pads,water,writeChunks,bakeTerrain}.js` | tahap pipeline terrain (murni) |
| `tools/campusbake/{osm,boundary,report,manifest,cli,index}.js` | fitur OSM kampus, batas distrik, laporan, manifest/atribusi, CLI |
| `src/districts/District.js` | `defineDistrict`, `validateDistrictBuild`, `districtContains` |
| `src/districts/terrainChunks.js` | `fetchArrayBuffer`, `chunkCellGrid`, `createTerrainChunks` (+ hook M2) |
| `src/districts/unri/boundary.js` | **dihasilkan** `npm run bake:campus -- boundary` (`UNRI_BOUNDARY`, `UNRI_BOUNDARY_META`) |
| `src/districts/unri/index.js` | `unriDistrict`, `validateDistrictManifest`, `UNRI_DIR`, `SETTLE` |
| `src/world/terrain/TerrainMesh.js` | `TERRAIN_MESH`, `lodIndices`, `buildTerrainChunkMeshSteps`, `buildTerrainChunkMesh`, `createTerrainMaterial` |
| `src/app/terrainService.js` | `FLAT_TERRAIN`, `createTerrainService` (HeightField nyata) |
| `src/app/districtMount.js` | `mountDistrict`, `minimapView`, `createHoleTexture` |
| `src/city/groundHole.js`, `src/city/index.js` | lubang tanah dasar kota (`setGroundHole`) |
| `src/core/Collider.js` | `createDistrictCollider` |
| `src/sim/bikePhysics.js`, `src/config/constants.js` | grade di fisika sepeda |
| `src/entities/Bicycle.js`, `src/core/{cameraMath,CameraRig,cameraPresets,PovDirector}.js`, `src/app/regionContext.js` | sepeda, kamera, POV, ctx lokal mengikuti tanah |
| `src/entities/{util,Runner,Footballer,Vendor,Crowd,Crowd.plaza,StoryNpcs}.js`, `src/world/StoryMarkers.js` | entitas & penanda di atas tanah |
| `src/world/{Lighting,TimeOfDay.lights,Weather,Weather.rain,Weather.wet}.js` | bayangan, lampu, cuaca relatif tanah |
| `src/main.js`, `src/app/devtools.js` | perkabelan |
| `package.json`, `package-lock.json`, `eslint.config.js`, `vite.config.js` | script `bake:campus`, dependensi, lapisan `districts`, cakupan |
| `public/districts/unri/{manifest.json,ATTRIBUTION.txt,terrain/*.bin}` | hasil bake (di-commit, ±0,65 MB) |
| `docs/screenshots/unri/m1-*.jpg`, `docs/superpowers/plans/2026-10-17-unri-00-index.md` | screenshot & status |

---

### Task 0: Verifikasi awal (tanpa commit)

- [ ] **Step 1: M0 lengkap dan hijau**

Run:
```bash
git status --short
git log --oneline -5
grep -n "^export" src/engine/scheduler.js src/app/terrainService.js src/app/regionManager.js
grep -n "createDynamicCompositeCollider\|setFallback\|TRAPPED_EPS" src/core/Collider.js
grep -n "setBaseLayer\|removeBaseLayer" src/ui/Minimap2D.js
grep -n "createRegionLayer\|colliders.setFallback\|createStoryMarkers\|bikePos.set\|exposeDevTools" src/main.js
ls tests/e2e/shot.mjs
node node_modules/vitest/vitest.mjs run
```
Expected: ekspor `createScheduler`, `FLAT_TERRAIN`, `createTerrainService`, `createRegionManager` ada; `createDynamicCompositeCollider`, `setFallback`, `const TRAPPED_EPS = 1e-6;` ada di Collider; `setBaseLayer`/`removeBaseLayer` ada; `main.js` memuat `createRegionLayer`, satu baris `colliders.setFallback(city ? city.collider : localized(stadionDef, region.colliders));`, `const markers = createStoryMarkers();`, `bikePos.set(ents.bike.state.x, 0, ents.bike.state.z);`; semua tes PASS. Bila ada yang berbeda: BERHENTI dan laporkan (M1 bergantung pada nama persis ini).

- [ ] **Step 2: Catat baseline paritas & memori sebelum M1**

Run:
```bash
npm run e2e -- --gpu d3d11 --out docs/screenshots/unri/m1-baseline-e2e.json
```
Expected: exit 0, `fails: []`. Catat `checks.parity.callsMean`, `checks.parity.callsMeanRegionOnly`, `checks.memory.baseline` (dibandingkan di Task 22). Berkas JSON ikut di-commit di Task 22.

---

### Task 1: Tooling — script `bake:campus`, `polygon-clipping`, lapisan ESLint `districts`, cakupan

**Files:**
- Modify: `package.json`, `package-lock.json`, `eslint.config.js`, `vite.config.js`

- [ ] **Step 1: Dependensi**

Run:
```bash
npm i -D polygon-clipping@0.15.7
node -e "import('polygon-clipping').then((m) => console.log(typeof m.default.union, typeof m.default.difference))"
```
Expected: `function function`.

- [ ] **Step 2: Script** — di blok `scripts` `package.json`, sesudah baris `"bake": "node tools/citybake",` sisipkan:
```json
    "bake:campus": "node tools/campusbake",
```

- [ ] **Step 3: ESLint** — ganti seluruh isi `eslint.config.js` (M0 tidak mengubahnya) dengan:

```js
import js from '@eslint/js';
import globals from 'globals';

/**
 * Arah dependensi antarlapisan (spec Pekanbaru §3), dicocokkan ke string impor dengan regex.
 * Hanya aturan yang lulus setelah Plan C; utang yang belum ditegakkan: sim masih boleh three
 * (sim/trackPath.js), regions boleh world (builder handmade), app = composition (bebas kecuali main.js).
 */
const layers = (dirs) => ({
  regex: `(^|/)(${dirs.join('|')})/`,
  message: `Lapisan ini tidak boleh mengimpor ${dirs.join('/, ')}/ (lihat spec §3).`,
});
const MAIN = { regex: '(^|/)main\\.js$', message: 'main.js adalah composition root; jangan diimpor.' };
const THREE_PKG = { regex: '^three($|/)', message: 'Modul murni tidak boleh bergantung pada three.' };
const STADIUM_GEOMETRY = { regex: '(^|/)world/stadium/', message: 'core tidak boleh mengimpor geometri stadion (lewat region).' };
const restrict = (...patterns) => ({ 'no-restricted-imports': ['error', { patterns }] });
const ALL = ['world', 'ui', 'regions', 'districts', 'city', 'core', 'entities', 'story', 'sim', 'engine', 'app'];
const except = (...keep) => ALL.filter((d) => !keep.includes(d));

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
  { files: ['src/config/**/*.js'], rules: restrict(THREE_PKG, layers(ALL), MAIN) },
  { files: ['src/engine/**/*.js'], rules: restrict(layers(except('engine')), MAIN) },
  { files: ['src/geo/**/*.js'], rules: restrict(THREE_PKG, layers(ALL), MAIN) },
  { files: ['src/shared/**/*.js'], rules: restrict(layers(ALL), MAIN) },
  { files: ['src/story/**/*.js'], rules: restrict(THREE_PKG, layers(except('sim')), MAIN) },
  { files: ['src/sim/**/*.js'], rules: restrict(layers(except('sim', 'engine')), MAIN) },
  { files: ['src/world/**/*.js'], rules: restrict(layers(['ui', 'core', 'entities', 'regions', 'districts', 'city', 'app']), MAIN) },
  { files: ['src/city/**/*.js'], rules: restrict(layers(['world', 'ui', 'regions', 'districts', 'core', 'entities', 'story', 'sim', 'app']), MAIN) },
  { files: ['src/regions/**/*.js'], rules: restrict(layers(['ui', 'core', 'entities', 'districts', 'city', 'app']), MAIN) },
  // Distrik (spec §3.1): boleh engine, geo, shared, config, world, sim; ChunkStreamer/fetch city diinjeksi app/districtMount.
  { files: ['src/districts/**/*.js'], rules: restrict(layers(['ui', 'core', 'app', 'entities', 'city', 'regions', 'story']), MAIN) },
  { files: ['src/core/**/*.js'], rules: restrict(layers(['ui', 'app', 'districts']), STADIUM_GEOMETRY, MAIN) },
  { files: ['src/ui/**/*.js'], rules: restrict(layers(['app']), MAIN) },
  { files: ['src/app/**/*.js'], rules: restrict(MAIN) },
];
```

- [ ] **Step 4: Cakupan** — di `vite.config.js` pada array `coverage.include`, ganti baris
```js
        'src/engine/**', 'src/geo/**', 'src/shared/**', 'src/regions/Region.js', 'src/regions/stadion/mask.js',
```
menjadi:
```js
        'src/engine/**', 'src/geo/**', 'src/shared/**', 'src/regions/Region.js', 'src/regions/stadion/mask.js',
        'src/districts/District.js', 'src/districts/terrainChunks.js',
```

- [ ] **Step 5: Verifikasi & commit**

Run:
```bash
npm run lint
node node_modules/vitest/vitest.mjs run
```
Expected: lint 0 galat; semua tes PASS.

```bash
git add package.json package-lock.json eslint.config.js vite.config.js
```
```bash
git commit -m "chore: script bake:campus, polygon-clipping (tools), lapisan ESLint districts"
```

---

### Task 2: `src/geo/terrain/format.js` + `heightfield.js` (TDD)

**Files:**
- Create: `src/geo/terrain/format.js`, `src/geo/terrain/heightfield.js`
- Test: `tests/geo/terrain/heightfield.test.js`

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect } from 'vitest';
import {
  decodeChunk, sampleChunk, createHeightField, TerrainDataError, validateTerrainHeader,
} from '../../../src/geo/terrain/heightfield.js';
import { TERRAIN_HEADER, N, STEP, BIAS, UNIT } from '../../../src/geo/terrain/format.js';

/** Buffer chunk Uint16 LE dari fungsi tinggi (r, c) → meter (dibulatkan ke 1 cm). */
function chunkBuffer(fn) {
  const buf = new ArrayBuffer(N * N * 2);
  const view = new DataView(buf);
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) view.setUint16((r * N + c) * 2, Math.round(fn(r, c) / UNIT) - BIAS, true);
  }
  return buf;
}
const header = (key) => ({ ...TERRAIN_HEADER, key });

describe('format terrain', () => {
  it('N = 500/4 + 1 dan y = (u16 + bias)·unit', () => {
    expect(N).toBe(126);
    expect(STEP).toBe(4);
    expect((5000 + BIAS) * UNIT).toBe(0);
    expect((6234 + BIAS) * UNIT).toBeCloseTo(12.34, 10);
  });
});

describe('decodeChunk', () => {
  it('membaca Uint16 little-endian, origin = sudut barat-laut chunk', () => {
    const chunk = decodeChunk(chunkBuffer((r, c) => r * 0.01 + c * 0.1), header('-2_3'));
    expect(chunk).toMatchObject({ key: '-2_3', ix: -2, iz: 3, origin: { x: -1000, z: 1500 }, n: 126, step: 4 });
    expect(chunk.data[0]).toBe(5000);
    expect(chunk.data[1]).toBe(5010); // c = 1 → 0,10 m
    expect(chunk.data[N]).toBe(5001); // r = 1 → 0,01 m
  });

  it('panjang salah, kunci salah, header salah → TerrainDataError', () => {
    expect(() => decodeChunk(new ArrayBuffer(10), header('0_0'))).toThrow(TerrainDataError);
    expect(() => decodeChunk(chunkBuffer(() => 0), header('x_y'))).toThrow(/kunci chunk/);
    expect(() => decodeChunk(chunkBuffer(() => 0), { ...header('0_0'), n: 125 })).toThrow(/n 125/);
    expect(() => decodeChunk(chunkBuffer(() => 0), { ...header('0_0'), format: 'lain' })).toThrow(/format/);
    expect(() => decodeChunk(new Uint8Array(N * N * 2), header('0_0'))).toThrow(/ArrayBuffer/);
  });

  it('validateTerrainHeader menolak size ≠ 500', () => {
    expect(() => validateTerrainHeader({ ...TERRAIN_HEADER, size: 250 })).toThrow(/size 250/);
    expect(validateTerrainHeader(TERRAIN_HEADER)).toEqual({ size: 500, step: 4, n: 126, unit: 0.01, bias: -5000 });
  });
});

describe('sampleChunk (bilinear)', () => {
  // y = 0,02·x_lokal + 0,01·z_lokal (bidang miring; bilinear harus tepat)
  const chunk = decodeChunk(chunkBuffer((r, c) => 0.02 * c * STEP + 0.01 * r * STEP), header('0_0'));
  it('tepat di sampel dan di antara sampel', () => {
    expect(sampleChunk(chunk, 0, 0)).toBeCloseTo(0, 6);
    expect(sampleChunk(chunk, 8, 4)).toBeCloseTo(0.2, 6);
    expect(sampleChunk(chunk, 10, 6)).toBeCloseTo(0.26, 6);
    expect(sampleChunk(chunk, 500, 500)).toBeCloseTo(15, 6);
  });
  it('di luar persegi di-clamp ke tepi', () => {
    expect(sampleChunk(chunk, -20, 0)).toBeCloseTo(0, 6);
    expect(sampleChunk(chunk, 520, 0)).toBeCloseTo(10, 6);
  });
});

describe('createHeightField', () => {
  const flat = (v) => chunkBuffer(() => v);
  it('0 di luar chunk, version naik tiap add/remove', () => {
    const f = createHeightField();
    expect(f.heightAt(123, 456)).toBe(0);
    expect(f.version).toBe(0);
    f.add(decodeChunk(flat(3), header('0_0')));
    expect(f.version).toBe(1);
    expect(f.heightAt(250, 250)).toBeCloseTo(3, 6);
    expect(f.heightAt(-1, 250)).toBe(0); // chunk -1_0 tidak ada
    expect(f.remove('0_0')).toBe(true);
    expect(f.remove('0_0')).toBe(false);
    expect(f.version).toBe(2);
    expect(f.heightAt(250, 250)).toBe(0);
    expect(f.heightAt(Number.NaN, 0)).toBe(0);
  });

  it('tepi bersama dua chunk kontinu (x = 500 milik chunk 1_0)', () => {
    const f = createHeightField();
    // chunk 0_0: y = 0,01·x_lokal; chunk 1_0: y = 5 + 0,01·x_lokal → di x = 500 keduanya 5
    f.add(decodeChunk(chunkBuffer((r, c) => 0.01 * c * STEP), header('0_0')));
    f.add(decodeChunk(chunkBuffer((r, c) => 5 + 0.01 * c * STEP), header('1_0')));
    expect(f.heightAt(499.999, 10)).toBeCloseTo(5, 4);
    expect(f.heightAt(500, 10)).toBeCloseTo(5, 6);
    expect(f.heightAt(504, 10)).toBeCloseTo(5.04, 6);
  });

  it('normalAt bidang miring 10% ke timur: (−0,0995, 0,995, 0)', () => {
    const f = createHeightField();
    f.add(decodeChunk(chunkBuffer((r, c) => 0.1 * c * STEP), header('0_0')));
    const n = f.normalAt(200, 200);
    expect(n.x).toBeCloseTo(-0.1 / Math.hypot(0.1, 1), 4);
    expect(n.y).toBeCloseTo(1 / Math.hypot(0.1, 1), 4);
    expect(n.z).toBeCloseTo(0, 6);
    const out = { x: 0, y: 0, z: 0 };
    expect(f.normalAt(200, 200, out)).toBe(out);
  });

  it('gradeAlong: yaw π/2 (timur) = +0,1; yaw −π/2 = −0,1; yaw 0 (selatan) = 0', () => {
    const f = createHeightField();
    f.add(decodeChunk(chunkBuffer((r, c) => 0.1 * c * STEP), header('0_0')));
    expect(f.gradeAlong(200, 200, Math.PI / 2)).toBeCloseTo(0.1, 6);
    expect(f.gradeAlong(200, 200, -Math.PI / 2)).toBeCloseTo(-0.1, 6);
    expect(f.gradeAlong(200, 200, 0)).toBeCloseTo(0, 6);
    expect(f.gradeAlong(200, 200, Number.NaN)).toBe(0);
  });

  it('add menolak objek bukan chunk', () => {
    expect(() => createHeightField().add({})).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/geo/terrain/heightfield.test.js`
Expected: FAIL (`Failed to load url ../../../src/geo/terrain/heightfield.js`).

- [ ] **Step 3: Implementasi** — `src/geo/terrain/format.js`:

```js
/**
 * Konstanta format chunk terrain distrik ("unri-terrain" v1, spec §4.1). Sumber tunggal untuk
 * tools/campusbake (penulis) dan klien (decodeChunk). Murni.
 *
 * Satu chunk = persegi CHUNK_SIZE m selaras grid tile kota (src/geo/tiles.js), sampel tiap STEP m,
 * N = CHUNK_SIZE / STEP + 1 sampel per sisi (tepi dipakai bersama chunk tetangga).
 * Nilai disimpan Uint16 little-endian: y_m = (u16 + BIAS) * UNIT → rentang −50 m … +605,35 m, presisi 1 cm.
 */
export const CHUNK_SIZE = 500;
export const STEP = 4;
export const N = 126;
export const UNIT = 0.01;
export const BIAS = -5000;
export const FORMAT = 'unri-terrain';
export const VERSION = 1;

/** Header chunk default (dipakai manifest distrik dan tes). */
export const TERRAIN_HEADER = Object.freeze({
  format: FORMAT, version: VERSION, size: CHUNK_SIZE, step: STEP, n: N, unit: UNIT, bias: BIAS,
});

/** u16 untuk y = 0 tepat (−BIAS). Chunk yang semua sampelnya bernilai ini tidak ditulis. */
export const ZERO_U16 = -BIAS;
```

`src/geo/terrain/heightfield.js`:

```js
/**
 * Heightfield terrain distrik (spec §4.1): dekode chunk biner, sampel bilinear, dan kumpulan chunk
 * aktif (`createHeightField`). Di luar chunk mana pun tinggi = 0 sehingga stadion & tile kota datar
 * tidak berubah perilakunya. Murni (tanpa three/DOM).
 */
import { tileKey, parseTileKey } from '../tiles.js';
import { CHUNK_SIZE, FORMAT, VERSION } from './format.js';

/** Data chunk rusak/tidak sesuai header: tidak dicoba ulang (chunk dianggap datar, spec §10). */
export class TerrainDataError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'TerrainDataError';
  }
}

const finite = Number.isFinite;

/** Validasi header terrain manifest; mengembalikan salinan beku. @throws {TerrainDataError} */
export function validateTerrainHeader(h) {
  if (!h || typeof h !== 'object') throw new TerrainDataError('header terrain bukan objek');
  if (h.format !== undefined && h.format !== FORMAT) throw new TerrainDataError(`format "${h.format}" bukan ${FORMAT}`);
  if (h.version !== undefined && h.version !== VERSION) throw new TerrainDataError(`versi terrain ${h.version} tidak didukung`);
  const { size, step, n, unit, bias } = h;
  if (size !== CHUNK_SIZE) throw new TerrainDataError(`size ${size} ≠ ${CHUNK_SIZE}`);
  if (!(step > 0) || !Number.isInteger(n) || n !== size / step + 1) throw new TerrainDataError(`n ${n} ≠ size/step + 1`);
  if (!(unit > 0) || !finite(bias)) throw new TerrainDataError('unit/bias tidak valid');
  return Object.freeze({ size, step, n, unit, bias });
}

/**
 * Dekode satu chunk Uint16 LE.
 * @param {ArrayBuffer} arrayBuffer isi `terrain/<key>.bin`
 * @param {{key:string, size:number, step:number, n:number, unit:number, bias:number}} header
 * @returns {{key:string, ix:number, iz:number, origin:{x:number,z:number}, size:number, step:number, n:number,
 *   unit:number, bias:number, data:Uint16Array}}
 * @throws {TerrainDataError}
 */
export function decodeChunk(arrayBuffer, header) {
  const h = validateTerrainHeader(header);
  const id = parseTileKey(header.key);
  if (!id) throw new TerrainDataError(`kunci chunk tidak valid: ${JSON.stringify(header.key)}`);
  if (!(arrayBuffer instanceof ArrayBuffer)) throw new TerrainDataError(`chunk ${header.key}: bukan ArrayBuffer`);
  const expected = h.n * h.n * 2;
  if (arrayBuffer.byteLength !== expected) {
    throw new TerrainDataError(`chunk ${header.key}: ${arrayBuffer.byteLength} byte ≠ ${expected}`);
  }
  const view = new DataView(arrayBuffer);
  const data = new Uint16Array(h.n * h.n);
  for (let i = 0; i < data.length; i += 1) data[i] = view.getUint16(i * 2, true);
  return Object.freeze({
    key: tileKey(id.ix, id.iz), ix: id.ix, iz: id.iz,
    origin: Object.freeze({ x: id.ix * h.size, z: id.iz * h.size }),
    ...h, data,
  });
}

/** Tinggi (m) sampel baris r, kolom c (tanpa pemeriksaan batas). */
export const sampleAt = (chunk, r, c) => (chunk.data[r * chunk.n + c] + chunk.bias) * chunk.unit;

/**
 * Bilinear pada chunk; (x, z) dunia di-clamp ke persegi chunk.
 * @returns {number} meter
 */
export function sampleChunk(chunk, x, z) {
  const last = chunk.n - 1;
  const fx = Math.min(last, Math.max(0, (x - chunk.origin.x) / chunk.step));
  const fz = Math.min(last, Math.max(0, (z - chunk.origin.z) / chunk.step));
  const c0 = Math.min(last - 1, Math.floor(fx));
  const r0 = Math.min(last - 1, Math.floor(fz));
  const tx = fx - c0;
  const tz = fz - r0;
  const a = sampleAt(chunk, r0, c0);
  const b = sampleAt(chunk, r0, c0 + 1);
  const c = sampleAt(chunk, r0 + 1, c0);
  const d = sampleAt(chunk, r0 + 1, c0 + 1);
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

const NORMAL_DELTA = 1; // m (spec: beda hingga 1 m)

/**
 * Kumpulan chunk aktif. heightAt = 0 di luar chunk; version naik tiap add/remove (cache invalidasi).
 * @returns {{add(chunk:object):void, remove(key:string):boolean, has(key:string):boolean, keys():string[],
 *   heightAt(x:number, z:number):number, normalAt(x:number, z:number, out?:object):{x:number,y:number,z:number},
 *   gradeAlong(x:number, z:number, yaw:number):number, readonly version:number, readonly size:number}}
 */
export function createHeightField() {
  const chunks = new Map();
  let version = 0;

  const heightAt = (x, z) => {
    if (!finite(x) || !finite(z)) return 0;
    const chunk = chunks.get(tileKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)));
    return chunk ? sampleChunk(chunk, x, z) : 0;
  };

  return {
    add(chunk) {
      if (!chunk?.data || typeof chunk.key !== 'string') throw new TypeError('HeightField.add: chunk tidak valid');
      chunks.set(chunk.key, chunk);
      version += 1;
    },
    remove(key) {
      const had = chunks.delete(key);
      if (had) version += 1;
      return had;
    },
    has: (key) => chunks.has(key),
    keys: () => [...chunks.keys()],
    heightAt,
    normalAt(x, z, out = { x: 0, y: 1, z: 0 }) {
      const d = NORMAL_DELTA;
      const sx = (heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d);
      const sz = (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d);
      const len = Math.hypot(sx, 1, sz);
      out.x = -sx / len;
      out.y = 1 / len;
      out.z = -sz / len;
      return out;
    },
    gradeAlong(x, z, yaw) {
      if (!finite(yaw)) return 0;
      const d = NORMAL_DELTA;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      return (heightAt(x + fx * d, z + fz * d) - heightAt(x - fx * d, z - fz * d)) / (2 * d);
    },
    get version() { return version; },
    get size() { return chunks.size; },
  };
}
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/geo/terrain/heightfield.test.js`
Expected: PASS — `Tests  11 passed (11)`.

- [ ] **Step 5: Commit**

```bash
git add src/geo/terrain/format.js src/geo/terrain/heightfield.js tests/geo/terrain/heightfield.test.js
```
```bash
git commit -m "feat(geo): format chunk terrain v1 dan HeightField (decode, bilinear, normal, grade, version)"
```

---

### Task 3: `src/geo/terrain/cellMask.js` (TDD)

Raster sel 4 m di dalam batas — dipakai mesh terrain (sel yang digambar) dan lubang tanah dasar kota (sel yang sama persis), sehingga tepi keduanya berimpit.

**Files:**
- Create: `src/geo/terrain/cellMask.js`
- Test: `tests/geo/terrain/cellMask.test.js`

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect } from 'vitest';
import { rasterizeRing } from '../../../src/geo/terrain/cellMask.js';
import { pointInPolygon } from '../../../src/geo/polygon.js';

describe('rasterizeRing', () => {
  it('persegi 10 × 8 m pada grid 4 m: sel berpusat di dalam saja', () => {
    // ring x 1..11, z 2..10; pusat sel x = 2, 6, 10, 14; z = 2, 6, 10 → kolom 0..2, baris: z=2 tepat di tepi
    const ring = [[1, 2], [11, 2], [11, 10], [1, 10]];
    const m = rasterizeRing(ring, { minX: 0, minZ: 0, cell: 4, cols: 4, rows: 3 });
    expect([...m]).toEqual([
      1, 1, 1, 0, // z = 2 (pusat tepat di tepi bawah 2: zi > zc salah untuk 2 → ikut aturan genap-ganjil)
      1, 1, 1, 0, // z = 6
      0, 0, 0, 0, // z = 10 (tepat di tepi atas: tidak masuk)
    ]);
  });

  it('cocok dengan pointInPolygon untuk poligon cekung (bentuk L) di 400 sel', () => {
    const ring = [[0, 0], [60, 0], [60, 20], [20, 20], [20, 70], [0, 70]];
    const grid = { minX: -6, minZ: -6, cell: 4, cols: 20, rows: 20 };
    const m = rasterizeRing(ring, grid);
    for (let r = 0; r < grid.rows; r += 1) {
      for (let c = 0; c < grid.cols; c += 1) {
        const x = grid.minX + (c + 0.5) * grid.cell;
        const z = grid.minZ + (r + 0.5) * grid.cell;
        expect(m[r * grid.cols + c]).toBe(pointInPolygon(x, z, ring) ? 1 : 0);
      }
    }
  });

  it('ring < 3 titik → semua 0; grid tak valid → RangeError', () => {
    expect([...rasterizeRing([[0, 0], [1, 1]], { minX: 0, minZ: 0, cell: 1, cols: 2, rows: 1 })]).toEqual([0, 0]);
    expect(() => rasterizeRing([], { minX: 0, minZ: 0, cell: 0, cols: 1, rows: 1 })).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/geo/terrain/cellMask.test.js`
Expected: FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi**

```js
/**
 * Raster sel grid dari ring poligon (scanline genap-ganjil pada pusat sel; sama dengan pointInPolygon).
 * Dipakai mesh terrain (sel mana yang digambar) dan lubang tanah dasar kota (sel yang sama persis),
 * sehingga tepi terrain dan tepi lubang selalu berimpit. Murni.
 */

/**
 * @param {Array<[number, number]>} ring ring dunia terbuka
 * @param {{minX:number, minZ:number, cell:number, cols:number, rows:number}} grid sel (r, c) berpusat di
 *   (minX + (c + 0,5)·cell, minZ + (r + 0,5)·cell)
 * @returns {Uint8Array} rows × cols, 1 = pusat sel di dalam ring
 */
export function rasterizeRing(ring, { minX, minZ, cell, cols, rows }) {
  if (!(cell > 0) || !Number.isInteger(cols) || !Number.isInteger(rows) || cols < 0 || rows < 0) {
    throw new RangeError('rasterizeRing: grid tidak valid');
  }
  const out = new Uint8Array(cols * rows);
  const n = ring.length;
  if (n < 3) return out;
  const xs = [];
  for (let r = 0; r < rows; r += 1) {
    const zc = minZ + (r + 0.5) * cell;
    xs.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if ((zi > zc) !== (zj > zc)) xs.push(((xj - xi) * (zc - zi)) / (zj - zi) + xi);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      // pusat sel xc masuk bila xs[k] <= xc < xs[k+1] (sama persis dengan aturan pointInPolygon: x < potongan)
      const c0 = Math.max(0, Math.ceil((xs[k] - minX) / cell - 0.5));
      const c1 = Math.min(cols - 1, Math.ceil((xs[k + 1] - minX) / cell - 0.5) - 1);
      if (c1 >= c0) out.fill(1, r * cols + c0, r * cols + c1 + 1);
    }
  }
  return out;
}
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/geo/terrain/cellMask.test.js`
Expected: PASS — `Tests  3 passed (3)`.

- [ ] **Step 5: Commit**

```bash
git add src/geo/terrain/cellMask.js tests/geo/terrain/cellMask.test.js
```
```bash
git commit -m "feat(geo): raster sel ring (scanline, aturan sama dengan pointInPolygon)"
```

---

### Task 4: DEM — `readHgt`, `fetchSrtm`, `resample` bikubik, filter median/Gaussian (TDD)

**Files:**
- Create: `tools/campusbake/dem/readHgt.js`, `tools/campusbake/dem/fetchSrtm.js`, `tools/campusbake/dem/resample.js`, `tools/campusbake/dem/filters.js`
- Test: `tests/campusbake/dem.test.js`

Catatan angka: posisi stadion pada ubin 3601 = baris (1 − 0,4835954)·3600 = 1859,0566, kolom 0,3895277·3600 = 1402,2997. Kernel Keys a = −0,5 mereproduksi polinom derajat ≤ 2 tepat. σ = 5 sampel → radius 15 → kernel 31 bobot. `fetchSrtm` memakai `USER_AGENT` citybake.

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readHgt, parseHgtName, hgtPosition, HGT_VOID } from '../../tools/campusbake/dem/readHgt.js';
import { loadSrtm, sha256, srtmCachePath } from '../../tools/campusbake/dem/fetchSrtm.js';
import { cubicWeight, bicubicAt, resampleToGrid } from '../../tools/campusbake/dem/resample.js';
import { median2d, gaussian2d, gaussianKernel } from '../../tools/campusbake/dem/filters.js';
import { createProjection } from '../../src/geo/projection.js';

/** .hgt sintetis size × size, nilai = fn(baris, kolom), big-endian. */
function hgtBytes(size, fn) {
  const bytes = new Uint8Array(size * size * 2);
  const view = new DataView(bytes.buffer);
  for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) view.setInt16((r * size + c) * 2, fn(r, c), false);
  return bytes;
}

describe('readHgt', () => {
  it('nama ubin → sudut barat-daya', () => {
    expect(parseHgtName('N00E101')).toEqual({ lat0: 0, lon0: 101 });
    expect(parseHgtName('S01W060')).toEqual({ lat0: -1, lon0: -60 });
    expect(() => parseHgtName('X00E101')).toThrow(/tidak valid/);
  });

  it('1201² big-endian: sampel (0,0) = barat-laut, nilai negatif & void terbaca', () => {
    const dem = readHgt(hgtBytes(1201, (r, c) => (r === 0 && c === 1 ? -12 : r === 5 && c === 5 ? HGT_VOID : r * 2 + c)), 'N00E101');
    expect(dem.size).toBe(1201);
    expect(dem.data[1]).toBe(-12);
    expect(dem.data[1201 * 3 + 4]).toBe(10);
    expect(dem.data[1201 * 5 + 5]).toBe(HGT_VOID);
  });

  it('ukuran salah ditolak', () => {
    expect(() => readHgt(new Uint8Array(100), 'N00E101')).toThrow(/3601² atau 1201²/);
  });

  it('posisi pecahan: stadion (0,4835954; 101,3895277) di ubin 3601 = baris 1859,06, kolom 1402,30', () => {
    const p = hgtPosition({ lat0: 0, lon0: 101, size: 3601 }, 0.4835954, 101.3895277);
    expect(p.row).toBeCloseTo(1859.0566, 3);
    expect(p.col).toBeCloseTo(1402.2997, 3);
  });
});

describe('resample bikubik (Keys a = −0,5)', () => {
  it('bobot kernel: w(0) = 1, w(1) = w(2) = 0, jumlah 4 bobot = 1', () => {
    expect(cubicWeight(0)).toBe(1);
    expect(cubicWeight(1)).toBe(0);
    expect(cubicWeight(2)).toBe(0);
    const t = 0.37;
    expect(cubicWeight(1 + t) + cubicWeight(t) + cubicWeight(1 - t) + cubicWeight(2 - t)).toBeCloseTo(1, 12);
  });

  it('mereproduksi polinom derajat 2 tepat di posisi pecahan (jauh dari tepi)', () => {
    const f = (r, c) => 0.5 * r * r - 2 * r * c + 3 * c + 7;
    const dem = { size: 20, data: Float64Array.from({ length: 400 }, (_, i) => f(Math.floor(i / 20), i % 20)) };
    expect(bicubicAt(dem, 7.25, 9.6)).toBeCloseTo(f(7.25, 9.6), 9);
    expect(bicubicAt(dem, 10, 10)).toBeCloseTo(f(10, 10), 12);
  });

  it('void di jendela 4×4 → galat jelas', () => {
    const dem = { size: 8, data: new Int16Array(64).fill(5) };
    dem.data[3 * 8 + 3] = HGT_VOID;
    expect(() => bicubicAt(dem, 3.5, 3.5)).toThrow(/void SRTM/);
  });

  it('resampleToGrid: DEM linier lat/lon → grid dunia mengikuti proyeksi', () => {
    // ubin 1201 sintetis: h = kolom (naik ke timur 1 m per 3″) → di grid dunia h naik ±1 m per 92,6 m ke timur
    const dem = { ...readHgt(hgtBytes(1201, (r, c) => c), 'N00E101') };
    const proj = createProjection({ lat0: 0.4835954, lon0: 101.3895277 });
    const grid = { minX: 0, minZ: 0, step: 4, cols: 3, rows: 2 };
    const h = resampleToGrid(dem, grid, proj);
    const base = hgtPosition(dem, 0.4835954, 101.3895277).col;
    expect(h[0]).toBeCloseTo(base, 3);
    const perMeter = 1200 / (111319.49 * Math.cos(0.4835954 * Math.PI / 180));
    expect(h[2] - h[0]).toBeCloseTo(8 * perMeter, 3);
  });
});

describe('filter grid', () => {
  it('median 5×5 menghapus paku tunggal, mempertahankan bidang', () => {
    const cols = 9;
    const rows = 9;
    const src = Float64Array.from({ length: 81 }, (_, i) => (i === 40 ? 100 : 3));
    const out = median2d(src, cols, rows, 5);
    expect(out[40]).toBe(3);
    expect(() => median2d(src, cols, rows, 4)).toThrow(RangeError);
  });

  it('kernel Gaussian σ 5: radius 15, ternormalisasi, simetris', () => {
    const k = gaussianKernel(5);
    expect(k.length).toBe(31);
    expect(k.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
    expect(k[0]).toBeCloseTo(k[30], 15);
  });

  it('Gaussian mempertahankan konstanta & bidang miring (jauh dari tepi), meratakan undak', () => {
    const cols = 61;
    const rows = 61;
    const plane = Float64Array.from({ length: cols * rows }, (_, i) => 0.25 * (i % cols) + 2);
    const g = gaussian2d(plane, cols, rows, 5);
    expect(g[30 * cols + 30]).toBeCloseTo(plane[30 * cols + 30], 9);
    const step = Float64Array.from({ length: cols * rows }, (_, i) => (i % cols < 30 ? 0 : 10));
    const s = gaussian2d(step, cols, rows, 5);
    expect(s[30 * cols + 29]).toBeGreaterThan(3);
    expect(s[30 * cols + 29]).toBeLessThan(5);
  });
});

describe('loadSrtm (cache, unduh, offline)', () => {
  const raw = hgtBytes(1201, () => 7);
  const srtm = { tile: 'N00E101', url: 'https://contoh.invalid/N00E101.hgt.gz', sha256: sha256(raw) };

  it('unduh gzip → dekompresi → verifikasi sha256 → cache; kedua kali dari cache', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'srtm-'));
    const gz = gzipSync(raw);
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength) }));
    const a = await loadSrtm(srtm, { cacheDir: dir, fetchImpl, log: { info() {}, warn() {} } });
    expect(a.byteLength).toBe(raw.byteLength);
    expect(sha256(await readFile(srtmCachePath(dir, 'N00E101')))).toBe(sha256(raw)); // toEqual 2,9 MB terlalu lambat
    await loadSrtm(srtm, { cacheDir: dir, fetchImpl, offline: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await rm(dir, { recursive: true, force: true });
  });

  it('offline tanpa cache → galat berisi URL & langkah unduh', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'srtm-'));
    await expect(loadSrtm(srtm, { cacheDir: dir, offline: true })).rejects.toThrow(/--offline.*curl -L -o .*https:\/\/contoh\.invalid/);
    await rm(dir, { recursive: true, force: true });
  });

  it('sha256 cache tidak cocok → galat; 404 tidak dicoba ulang', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'srtm-'));
    await mkdir(join(dir, 'dem', 'srtm'), { recursive: true });
    await writeFile(srtmCachePath(dir, 'N00E101'), new Uint8Array(8));
    await expect(loadSrtm(srtm, { cacheDir: dir })).rejects.toThrow(/sha256 tidak cocok/);
    await rm(dir, { recursive: true, force: true });
    const dir2 = await mkdtemp(join(tmpdir(), 'srtm-'));
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404 }));
    await expect(loadSrtm(srtm, { cacheDir: dir2, fetchImpl, sleep: async () => {}, log: { info() {}, warn() {} } })).rejects.toThrow(/HTTP 404/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await rm(dir2, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/dem.test.js`
Expected: FAIL (modul `tools/campusbake/dem/*` tidak ada).

- [ ] **Step 3: Implementasi** — `tools/campusbake/dem/readHgt.js`:

```js
/**
 * Pembaca SRTM .hgt: int16 big-endian, size × size sampel baris-mayor dari UTARA ke selatan, barat ke
 * timur; sampel (0, 0) = sudut barat-laut (lat0 + 1, lon0). Nilai −32768 = void. Murni.
 */
export const HGT_VOID = -32768;

/** "N00E101" → {lat0: 0, lon0: 101}; "S01W060" → {lat0: −1, lon0: −60}. */
export function parseHgtName(name) {
  const m = String(name).match(/^([NS])(\d{2})([EW])(\d{3})$/);
  if (!m) throw new Error(`nama ubin SRTM tidak valid: ${JSON.stringify(name)}`);
  const lat0 = Number(m[2]) * (m[1] === 'S' ? -1 : 1);
  const lon0 = Number(m[4]) * (m[3] === 'W' ? -1 : 1);
  return { lat0, lon0 };
}

/**
 * @param {Uint8Array} bytes isi .hgt (sudah didekompresi)
 * @param {string} name nama ubin, mis. "N00E101"
 * @returns {{name:string, lat0:number, lon0:number, size:number, data:Int16Array}}
 */
export function readHgt(bytes, name) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('readHgt: bytes harus Uint8Array/Buffer');
  const samples = bytes.byteLength / 2;
  const size = Math.round(Math.sqrt(samples));
  if (!Number.isInteger(samples) || size * size !== samples || (size !== 3601 && size !== 1201)) {
    throw new Error(`ukuran .hgt ${bytes.byteLength} byte bukan 3601² atau 1201² sampel int16`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const data = new Int16Array(samples);
  for (let i = 0; i < samples; i += 1) data[i] = view.getInt16(i * 2, false);
  return { name, ...parseHgtName(name), size, data };
}

/**
 * Posisi pecahan (baris, kolom) lat/lon pada ubin; baris 0 = utara.
 * @returns {{row:number, col:number}}
 */
export function hgtPosition(dem, lat, lon) {
  const k = dem.size - 1;
  return { row: (dem.lat0 + 1 - lat) * k, col: (lon - dem.lon0) * k };
}
```

`tools/campusbake/dem/fetchSrtm.js`:

```js
/**
 * Unduh & cache ubin SRTM: `data-src/dem/srtm/<tile>.hgt` (didekompresi). Cache dipakai bila ada dan
 * sha256-nya cocok; mode offline tanpa cache → galat berisi URL & langkah unduh manual (spec §10).
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { USER_AGENT } from '../../citybake/config.js';

const REQUEST_TIMEOUT_MS = 120000;
const RETRIES = 2;
const BACKOFF_MS = [2000, 6000];

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Path cache ubin. */
export const srtmCachePath = (cacheDir, tile) => join(cacheDir, 'dem', 'srtm', `${tile}.hgt`);

/** Pesan langkah unduh manual (dipakai saat offline/gagal). */
export function manualSteps(srtm, cacheDir) {
  const path = srtmCachePath(cacheDir, srtm.tile);
  return `Unduh manual: curl -L -o ${path}.gz ${srtm.url} && gzip -d ${path}.gz (hasil ${path}, sha256 ${srtm.sha256}).`;
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET dengan retry (galat jaringan & 5xx/429); 4xx lain langsung gagal. @returns {Promise<Uint8Array>} */
async function download(url, { fetchImpl, sleep, log }) {
  let last = null;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      last = new Error(`HTTP ${res.status}`);
      if (res.status < 500 && res.status !== 429) break;
    } catch (err) {
      last = err;
    }
    if (attempt < RETRIES) {
      log.warn(`[campusbake] unduh SRTM gagal (${last.message}) — coba lagi`);
      await sleep(BACKOFF_MS[attempt]);
    }
  }
  throw new Error(`unduh ${url} gagal: ${last?.message}`);
}

/**
 * Muat ubin SRTM (.hgt mentah, sudah didekompresi) dari cache atau unduh.
 * @param {{tile:string, url:string, sha256:string}} srtm
 * @param {{cacheDir:string, offline?:boolean, fetchImpl?:typeof fetch, sleep?:(ms:number)=>Promise<void>, log?:Console}} opts
 * @returns {Promise<Uint8Array>}
 */
export async function loadSrtm(srtm, { cacheDir, offline = false, fetchImpl = globalThis.fetch, sleep = defaultSleep, log = console }) {
  const path = srtmCachePath(cacheDir, srtm.tile);
  try {
    const cached = new Uint8Array(await readFile(path));
    if (sha256(cached) !== srtm.sha256) throw new Error(`cache SRTM ${path} sha256 tidak cocok (hapus lalu unduh ulang)`);
    return cached;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (offline) throw new Error(`mode --offline tetapi cache SRTM tidak ada: ${path}. ${manualSteps(srtm, cacheDir)}`);
  log.info(`[campusbake] mengunduh SRTM ${srtm.tile} dari ${srtm.url}…`);
  let raw;
  try {
    raw = new Uint8Array(gunzipSync(await download(srtm.url, { fetchImpl, sleep, log })));
  } catch (err) {
    throw new Error(`${err.message}. ${manualSteps(srtm, cacheDir)}`, { cause: err });
  }
  if (sha256(raw) !== srtm.sha256) {
    throw new Error(`SRTM ${srtm.tile} terunduh tetapi sha256 ${sha256(raw)} ≠ ${srtm.sha256} (mirror berubah?)`);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, raw);
  return raw;
}
```

`tools/campusbake/dem/resample.js`:

```js
/**
 * Resample DEM (lat/lon) → grid dunia 4 m dengan konvolusi kubik Keys (a = −0,5): reproduksi tepat
 * polinom derajat ≤ 2, kontinu C1. Indeks di luar ubin di-clamp ke tepi. Murni.
 */
import { hgtPosition, HGT_VOID } from './readHgt.js';

const A = -0.5;

/** Bobot kernel kubik Keys untuk jarak t (|t| < 2). */
export function cubicWeight(t) {
  const x = Math.abs(t);
  if (x <= 1) return ((A + 2) * x - (A + 3)) * x * x + 1;
  if (x < 2) return ((A * x - 5 * A) * x + 8 * A) * x - 4 * A;
  return 0;
}

/**
 * Nilai bikubik pada posisi pecahan (row, col) dari array baris-mayor `size × size`.
 * @param {{size:number, data:ArrayLike<number>}} dem
 */
export function bicubicAt(dem, row, col) {
  const last = dem.size - 1;
  const r0 = Math.floor(row);
  const c0 = Math.floor(col);
  const wr = [cubicWeight(row - (r0 - 1)), cubicWeight(row - r0), cubicWeight(row - (r0 + 1)), cubicWeight(row - (r0 + 2))];
  const wc = [cubicWeight(col - (c0 - 1)), cubicWeight(col - c0), cubicWeight(col - (c0 + 1)), cubicWeight(col - (c0 + 2))];
  let sum = 0;
  for (let i = 0; i < 4; i += 1) {
    const r = Math.min(last, Math.max(0, r0 - 1 + i));
    let line = 0;
    for (let j = 0; j < 4; j += 1) {
      const c = Math.min(last, Math.max(0, c0 - 1 + j));
      const v = dem.data[r * dem.size + c];
      if (v === HGT_VOID) throw new Error(`void SRTM di baris ${r}, kolom ${c}`);
      line += wc[j] * v;
    }
    sum += wr[i] * line;
  }
  return sum;
}

/**
 * Tinggi DEM (m) di setiap simpul grid dunia.
 * @param {{lat0:number, lon0:number, size:number, data:Int16Array}} dem
 * @param {{minX:number, minZ:number, step:number, cols:number, rows:number}} grid simpul (r, c) di
 *   (minX + c·step, minZ + r·step)
 * @param {{toLatLon(x:number, z:number):{lat:number, lon:number}}} projection
 * @returns {Float64Array} rows × cols
 */
export function resampleToGrid(dem, grid, projection) {
  const out = new Float64Array(grid.cols * grid.rows);
  for (let r = 0; r < grid.rows; r += 1) {
    const z = grid.minZ + r * grid.step;
    for (let c = 0; c < grid.cols; c += 1) {
      const { lat, lon } = projection.toLatLon(grid.minX + c * grid.step, z);
      const p = hgtPosition(dem, lat, lon);
      out[r * grid.cols + c] = bicubicAt(dem, p.row, p.col);
    }
  }
  return out;
}
```

`tools/campusbake/dem/filters.js`:

```js
/**
 * Filter grid 2D (baris-mayor, cols × rows): median k×k dan Gaussian terpisah. Tepi di-clamp
 * (sampel di luar grid = sampel tepi terdekat). Mengembalikan array baru. Murni.
 */

/** Median jendela size×size (size ganjil). */
export function median2d(src, cols, rows, size = 5) {
  if (size % 2 !== 1) throw new RangeError('median2d: size harus ganjil');
  const h = (size - 1) / 2;
  const out = new Float64Array(src.length);
  const win = new Float64Array(size * size);
  const mid = (size * size - 1) / 2;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let k = 0;
      for (let dr = -h; dr <= h; dr += 1) {
        const rr = Math.min(rows - 1, Math.max(0, r + dr)) * cols;
        for (let dc = -h; dc <= h; dc += 1) {
          // sisip berurutan (insertion sort) — jendela kecil, deterministik
          const v = src[rr + Math.min(cols - 1, Math.max(0, c + dc))];
          let i = k;
          while (i > 0 && win[i - 1] > v) { win[i] = win[i - 1]; i -= 1; }
          win[i] = v;
          k += 1;
        }
      }
      out[r * cols + c] = win[mid];
    }
  }
  return out;
}

/** Kernel Gaussian ternormalisasi, radius ceil(3σ). */
export function gaussianKernel(sigma) {
  if (!(sigma > 0)) throw new RangeError('gaussianKernel: sigma harus > 0');
  const radius = Math.ceil(3 * sigma);
  const k = new Float64Array(2 * radius + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i += 1) {
    k[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma));
    sum += k[i + radius];
  }
  for (let i = 0; i < k.length; i += 1) k[i] /= sum;
  return k;
}

/** Gaussian terpisah (horizontal lalu vertikal), σ dalam satuan sampel. */
export function gaussian2d(src, cols, rows, sigma) {
  const k = gaussianKernel(sigma);
  const radius = (k.length - 1) / 2;
  const tmp = new Float64Array(src.length);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let s = 0;
      for (let i = -radius; i <= radius; i += 1) s += k[i + radius] * src[r * cols + Math.min(cols - 1, Math.max(0, c + i))];
      tmp[r * cols + c] = s;
    }
  }
  const out = new Float64Array(src.length);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let s = 0;
      for (let i = -radius; i <= radius; i += 1) s += k[i + radius] * tmp[Math.min(rows - 1, Math.max(0, r + i)) * cols + c];
      out[r * cols + c] = s;
    }
  }
  return out;
}
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/dem.test.js`
Expected: PASS — `Tests  14 passed (14)`.

- [ ] **Step 5: Commit**

```bash
git add tools/campusbake/dem tests/campusbake/dem.test.js
```
```bash
git commit -m "feat(campusbake): baca SRTM .hgt, unduh+cache terverifikasi sha256, resample bikubik, median & Gaussian"
```

---

### Task 5: Tahap terrain — grid, datum, blend, jalan, pad, danau, kuantisasi (TDD)

**Files:**
- Create: `tools/campusbake/terrain/grid.js`, `datum.js`, `blend.js`, `roads.js`, `pads.js`, `water.js`, `writeChunks.js`
- Test: `tests/campusbake/terrainStages.test.js`

Angka konkret di tes: smoothstep(0,120,60) = 0,5; titik 60 m dari tepi → w 0,5; titik 60 m dari mask → 0, 120 m → 0,5; undak 2 m dibatasi 6 %: maju 0,24 m/4 m dari i = 10, mundur 2 − 0,24·(10 − i) → rerata i = 9: 0,88, i = 10: 1,12; parit 0,6 m tepat di sumbu parit (`core + offset + width/2` = lebar/2 + 3,0 m dari sumbu jalan); pad 3×3 simpul x = 12, 16, 20 pada y = x/10 → median 1,6, simpul 2 m di luar tepi → separuh jalan ke tanah asal; danau: tepi terendah 1,2 → muka 0,8, dasar −0,7; kuantisasi 12,345 m → 6235.

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect } from 'vitest';
import { gridForRing, sampleGrid, nodesInside, densifyRing, median } from '../../tools/campusbake/terrain/grid.js';
import { boundaryReference, applyDatum } from '../../tools/campusbake/terrain/datum.js';
import { smoothstep, blendWeightAt, blendWeights, applyBlend } from '../../tools/campusbake/terrain/blend.js';
import {
  resamplePolyline, smooth3, limitGrade, maxGradeOf, ditchDepth, lipschitzOnMask, conditionRoads,
} from '../../tools/campusbake/terrain/roads.js';
import { applyPads } from '../../tools/campusbake/terrain/pads.js';
import { applyWater, lakeFloor } from '../../tools/campusbake/terrain/water.js';
import { quantize, encodeChunk, encodeChunks } from '../../tools/campusbake/terrain/writeChunks.js';
import { decodeChunk } from '../../src/geo/terrain/heightfield.js';
import { TERRAIN_HEADER } from '../../src/geo/terrain/format.js';

/** Grid kecil uji: simpul tiap 4 m, minX/minZ 0. */
const smallGrid = (cols, rows) => ({ minX: 0, minZ: 0, step: 4, cols, rows });
const fill = (g, fn) => Float64Array.from({ length: g.cols * g.rows }, (_, i) => fn(g.minX + (i % g.cols) * g.step, g.minZ + Math.floor(i / g.cols) * g.step));
const ones = (g) => new Float32Array(g.cols * g.rows).fill(1);

describe('grid', () => {
  it('gridForRing membulatkan keluar ke chunk 500 m (+ margin)', () => {
    const g = gridForRing([[-1622, -459], [444, -459], [444, 2129], [-1622, 2129]], 150);
    expect(g).toMatchObject({ minX: -2000, minZ: -1000, ix0: -4, iz0: -2, chunksX: 6, chunksZ: 7, cols: 751, rows: 876 });
  });
  it('sampleGrid bilinear & clamp; nodesInside; densify; median', () => {
    const g = smallGrid(3, 3);
    const d = fill(g, (x, z) => x + 2 * z);
    expect(sampleGrid(g, d, 2, 2)).toBeCloseTo(6, 12);
    expect(sampleGrid(g, d, -10, 100)).toBeCloseTo(16, 12);
    expect([...nodesInside(g, [[1, 1], [9, 1], [9, 9], [1, 9]])]).toEqual([0, 0, 0, 0, 1, 1, 0, 1, 1]);
    expect(densifyRing([[0, 0], [10, 0], [10, 10]], 4)).toHaveLength(3 + 3 + 4);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
});

describe('datum (median sepanjang batas)', () => {
  it('h_ref = median tinggi tepi; y = h − h_ref', () => {
    const g = smallGrid(26, 26); // 0..100 m
    const h = fill(g, (x) => 30 + x / 100); // 30 di barat, 31 di timur
    const ring = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const ref = boundaryReference(g, h, ring, 4);
    expect(ref).toBeCloseTo(30.5, 6);
    expect(applyDatum(h, ref)[0]).toBeCloseTo(-0.5, 9);
  });
});

describe('blend ke nol di tepi (smoothstep 120 m) dan mask + 60 m', () => {
  const boundary = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
  const mask = [[400, 400], [600, 400], [600, 600], [400, 600]];
  const opts = { boundary, mask, distance: 120, maskMargin: 60 };
  it('smoothstep: 0 → 0, 60 → 0,5, 120 → 1', () => {
    expect(smoothstep(0, 120, 0)).toBe(0);
    expect(smoothstep(0, 120, 60)).toBe(0.5);
    expect(smoothstep(0, 120, 200)).toBe(1);
  });
  it('w = 0 di luar batas & tepat di tepi; 0,5 di 60 m dari tepi; 0 di mask dan sampai 60 m darinya', () => {
    expect(blendWeightAt(-5, 500, opts)).toBe(0);
    expect(blendWeightAt(1e-9, 500, { ...opts, mask: null })).toBeCloseTo(0, 6);
    expect(blendWeightAt(60, 150, opts)).toBeCloseTo(0.5, 9);
    expect(blendWeightAt(200, 200, opts)).toBe(1);
    expect(blendWeightAt(500, 500, opts)).toBe(0);
    expect(blendWeightAt(500, 340, opts)).toBe(0); // 60 m dari mask
    expect(blendWeightAt(500, 280, opts)).toBeCloseTo(0.5, 9); // 120 m dari mask → smoothstep(0,120,60)
  });
  it('grid: semua simpul di luar batas tepat 0 setelah applyBlend', () => {
    const g = { minX: -100, minZ: -100, step: 20, cols: 61, rows: 61 };
    const w = blendWeights(g, opts);
    const y = applyBlend(new Float64Array(w.length).fill(5), w);
    for (let i = 0; i < y.length; i += 1) {
      const x = g.minX + (i % g.cols) * g.step;
      const z = g.minZ + Math.floor(i / g.cols) * g.step;
      if (x <= 0 || z <= 0 || x >= 1000 || z >= 1000) expect(y[i]).toBe(0);
    }
    expect(y[30 * 61 + 15]).toBeGreaterThan(0); // (200, 500)
  });
});

describe('pengondisian jalan', () => {
  it('resamplePolyline tiap ≤ 4 m; smooth3 [¼ ½ ¼] dengan ujung tetap', () => {
    const { pts, s } = resamplePolyline([[0, 0], [10, 0]], 4);
    expect(pts).toHaveLength(4);
    expect(s[3]).toBeCloseTo(10, 12);
    expect([...smooth3([0, 4, 0, 4])]).toEqual([0, 2, 2, 4]);
  });

  it('limitGrade: profil undak 0 → 2 m dalam 4 m dibatasi ≤ 6% (rerata maju+mundur)', () => {
    const s = Array.from({ length: 21 }, (_, i) => i * 4);
    const v = s.map((d) => (d < 40 ? 0 : 2));
    const out = limitGrade(v, s, 0.06);
    expect(maxGradeOf(v, s)).toBeCloseTo(0.5, 9);
    expect(maxGradeOf(out, s)).toBeLessThanOrEqual(0.06 + 1e-12);
    // maju: 0,24 m per 4 m mulai i = 10; mundur: 2 − 0,24·(10 − i) sebelum undak → rerata simetris
    expect(out[0]).toBe(0);
    expect(out[9]).toBeCloseTo(0.88, 12);
    expect(out[10]).toBeCloseTo(1.12, 12);
    expect(out[20]).toBe(2);
  });

  it('ditchDepth: 0,6 m di sumbu parit, 0 jauh darinya; dimatikan → 0', () => {
    const ditch = { enabled: true, width: 1, depth: 0.6, offset: 1 };
    expect(ditchDepth(5 + 1 + 0.5, 5, ditch, 4)).toBeCloseTo(0.6, 12);
    expect(ditchDepth(20, 5, ditch, 4)).toBe(0);
    expect(ditchDepth(6.5, 5, { ...ditch, enabled: false }, 4)).toBe(0);
  });

  it('lipschitzOnMask: undak 1 m antar simpul bertetangga → ≤ g per meter, konstanta tetap', () => {
    const g = smallGrid(10, 1);
    const mask = new Uint8Array(10).fill(1);
    const v = Float64Array.from({ length: 10 }, (_, i) => (i < 5 ? 0 : 1));
    const out = lipschitzOnMask(g, mask, v, 0.06);
    for (let i = 1; i < 10; i += 1) expect(Math.abs(out[i] - out[i - 1])).toBeLessThanOrEqual(0.06 * 4 + 1e-12);
    expect([...lipschitzOnMask(g, mask, new Float64Array(10).fill(2), 0.06)]).toEqual(new Array(10).fill(2));
    const partial = new Uint8Array(10);
    expect(lipschitzOnMask(g, partial, v, 0.06)).toEqual(v);
  });

  it('conditionRoads: bukit 3 m di jalan lurus → inti ≤ 6% (+toleransi bilinear), simpul w = 0 tidak disentuh', () => {
    const g = smallGrid(101, 21); // 400 × 80 m
    const data = fill(g, (x) => 3 * Math.exp(-(((x - 200) / 25) ** 2)));
    const w = ones(g);
    for (let r = 0; r < g.rows; r += 1) w[r * g.cols] = 0; // kolom x = 0 di luar distrik
    const road = { id: 'w1', cls: 'tertiary', width: 10, line: [[0, 40], [400, 40]] };
    const res = conditionRoads(g, data, w, [road], { spacing: 4, maxGrade: 0.06, shoulder: 1.5, blend: 6, ditch: null });
    const { pts, s } = resamplePolyline(road.line, 4);
    const profile = pts.map(([x, z]) => sampleGrid(g, res.data, x, z));
    expect(maxGradeOf(profile.slice(1), s.slice(1))).toBeLessThanOrEqual(0.06 + 0.005);
    expect(res.stats[0].gradeBefore).toBeGreaterThan(0.1);
    expect(res.stats[0].gradeAfter).toBeLessThanOrEqual(0.06 + 1e-12);
    expect(res.data[10 * g.cols]).toBe(data[10 * g.cols]); // w = 0
    expect(res.core[10 * g.cols + 50]).toBe(1); // (200, 40) inti jalan
    expect(res.data[0]).toBe(data[0]); // (0, 0) jauh dari jalan
  });

  it('simpang dua jalan beda profil tanpa tangga (Lipschitz inti)', () => {
    const g = smallGrid(51, 51); // 200 × 200 m
    const data = fill(g, (x, z) => 0.2 * Math.max(0, x - 100) + 0.05 * z);
    const roads = [
      { id: 'a', cls: 'service', width: 4.5, line: [[0, 100], [200, 100]] },
      { id: 'b', cls: 'service', width: 4.5, line: [[100, 0], [100, 200]] },
    ];
    const res = conditionRoads(g, data, ones(g), roads, { spacing: 4, maxGrade: 0.06, shoulder: 1.5, blend: 6, ditch: null });
    for (const road of roads) {
      const { pts, s } = resamplePolyline(road.line, 4);
      const prof = pts.map(([x, z]) => sampleGrid(g, res.data, x, z));
      expect(maxGradeOf(prof, s)).toBeLessThanOrEqual(0.07);
    }
  });
});

describe('pad gedung', () => {
  it('footprint rata ke median, blend 4 m; simpul terkunci (inti jalan) tidak diubah', () => {
    const g = smallGrid(11, 11); // 40 × 40 m
    const data = fill(g, (x) => x / 10); // 0..4 m
    const ring = [[10, 10], [22, 10], [22, 22], [10, 22]];
    const locked = new Uint8Array(121);
    locked[5 * 11 + 7] = 1; // (28, 20): 6 m di luar → di luar blend juga, tidak berpengaruh
    locked[3 * 11 + 3] = 1; // (12, 12) di dalam pad tetapi terkunci
    const res = applyPads(g, data, ones(g), [{ id: 'w9', ring, y: 'median' }], { blend: 4 }, locked);
    // simpul dalam: x = 12, 16, 20 (× 3 baris) → median 1,6
    expect(res.stats).toEqual([{ id: 'w9', target: 1.6, nodes: 9 }]);
    expect(res.data[4 * 11 + 4]).toBeCloseTo(1.6, 12); // (16, 16)
    expect(res.data[3 * 11 + 3]).toBe(data[3 * 11 + 3]); // terkunci
    expect(res.data[4 * 11 + 6]).toBeCloseTo(1.6 + (2.4 - 1.6) * 0.5, 12); // (24,16): 2 m dari tepi → separuh
    expect(res.data[4 * 11 + 8]).toBe(data[4 * 11 + 8]); // (32,16) di luar blend
  });
  it('pad dengan y angka tetap', () => {
    const g = smallGrid(11, 11);
    const res = applyPads(g, fill(g, () => 0), ones(g), [{ id: 'p', ring: [[10, 10], [22, 10], [22, 22], [10, 22]], y: 0.75 }], { blend: 4 });
    expect(res.data[4 * 11 + 4]).toBe(0.75);
  });
});

describe('danau', () => {
  it('lakeFloor: tepi = tanah tepi terendah, lereng 1:3, dasar = muka − 1,5', () => {
    const o = { shoreDrop: 0.4, depth: 1.5, bankRun: 3 };
    expect(lakeFloor(0, 2, o)).toBe(2);
    expect(lakeFloor(3, 2, o)).toBe(1);
    expect(lakeFloor(100, 2, o)).toBeCloseTo(0.1, 12); // 2 − 0,4 − 1,5
  });
  it('applyWater: muka air = min tepi − 0,4; hanya menggali; tingkat dilaporkan', () => {
    const g = smallGrid(26, 26);
    const data = fill(g, (x) => 1 + x / 100); // tepi barat x = 20 → 1,2 terendah
    const lake = { id: 'w1', name: 'Uji', ring: [[20, 20], [80, 20], [80, 80], [20, 80]] };
    const res = applyWater(g, data, ones(g), [lake], { shoreDrop: 0.4, depth: 1.5, bankRun: 3 });
    expect(res.levels).toEqual([{ id: 'w1', name: 'Uji', level: 0.8, bed: -0.7 }]);
    expect(res.data[12 * 26 + 12]).toBeCloseTo(-0.7, 9); // tengah (48, 48): dasar
    expect(res.data[0]).toBe(data[0]);
    for (let i = 0; i < data.length; i += 1) expect(res.data[i]).toBeLessThanOrEqual(data[i]);
  });
});

describe('kuantisasi & chunk', () => {
  it('quantize: 0 → 5000, 12,345 → 6235, −50 → 0, di-clamp', () => {
    expect(quantize(0)).toBe(5000);
    expect(quantize(12.345)).toBe(6235);
    expect(quantize(-50)).toBe(0);
    expect(quantize(-80)).toBe(0);
    expect(quantize(700)).toBe(65535);
  });
  it('encodeChunk ↔ decodeChunk pulang-pergi (tepi bersama), chunk nol dilewati', () => {
    const grid = { minX: -500, minZ: 0, step: 4, cols: 251, rows: 126, ix0: -1, iz0: 0, chunksX: 2, chunksZ: 1 };
    const data = fill(grid, (x, z) => (x <= 0 ? 0 : 0.01 * x + 0.02 * z)); // kolom bersama x = 0 bernilai 0
    const chunks = encodeChunks(grid, data);
    expect(chunks.map((c) => c.key)).toEqual(['0_0']); // -1_0 semua nol
    const c = decodeChunk(new Uint8Array(chunks[0].buffer).buffer.slice(0), { ...TERRAIN_HEADER, key: '0_0' });
    expect((c.data[0] - 5000) * 0.01).toBeCloseTo(0, 9);
    expect((c.data[125 * 126 + 125] - 5000) * 0.01).toBeCloseTo(5 + 10, 9);
    expect(encodeChunk(grid, data, -1, 0).empty).toBe(true);
    expect(() => encodeChunk(grid, data, 1, 0)).toThrow(/di luar grid/);
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/terrainStages.test.js`
Expected: FAIL (modul `tools/campusbake/terrain/*` tidak ada).

- [ ] **Step 3: Implementasi** — `tools/campusbake/terrain/grid.js`:

```js
/**
 * Grid simpul terrain bake: simpul (r, c) di (minX + c·step, minZ + r·step), data Float64Array baris-mayor
 * (r = utara→selatan). Grid selalu selaras chunk 500 m sehingga chunk = jendela 126 × 126 simpul. Murni.
 */
import { CHUNK_SIZE, STEP } from '../../../src/geo/terrain/format.js';
import { rasterizeRing } from '../../../src/geo/terrain/cellMask.js';
import { ringBounds } from '../../../src/geo/polygon.js';

/**
 * Grid yang menutup bbox ring + margin, dibulatkan keluar ke kelipatan chunk.
 * @returns {{minX:number, minZ:number, step:number, cols:number, rows:number, ix0:number, iz0:number,
 *   chunksX:number, chunksZ:number}}
 */
export function gridForRing(ring, margin, step = STEP, chunk = CHUNK_SIZE) {
  const b = ringBounds(ring);
  const ix0 = Math.floor((b.minX - margin) / chunk);
  const iz0 = Math.floor((b.minZ - margin) / chunk);
  const ix1 = Math.ceil((b.maxX + margin) / chunk);
  const iz1 = Math.ceil((b.maxZ + margin) / chunk);
  const per = chunk / step;
  return {
    minX: ix0 * chunk, minZ: iz0 * chunk, step,
    cols: (ix1 - ix0) * per + 1, rows: (iz1 - iz0) * per + 1,
    ix0, iz0, chunksX: ix1 - ix0, chunksZ: iz1 - iz0,
  };
}

/** Bilinear pada data grid (x, z dunia; di-clamp ke grid). */
export function sampleGrid(grid, data, x, z) {
  const fx = Math.min(grid.cols - 1, Math.max(0, (x - grid.minX) / grid.step));
  const fz = Math.min(grid.rows - 1, Math.max(0, (z - grid.minZ) / grid.step));
  const c0 = Math.min(grid.cols - 2, Math.floor(fx));
  const r0 = Math.min(grid.rows - 2, Math.floor(fz));
  const tx = fx - c0;
  const tz = fz - r0;
  const i = r0 * grid.cols + c0;
  const top = data[i] * (1 - tx) + data[i + 1] * tx;
  const bottom = data[i + grid.cols] * (1 - tx) + data[i + grid.cols + 1] * tx;
  return top * (1 - tz) + bottom * tz;
}

/** Simpul di dalam ring (aturan pointInPolygon pada posisi simpul). @returns {Uint8Array} */
export function nodesInside(grid, ring) {
  return rasterizeRing(ring, {
    minX: grid.minX - grid.step / 2, minZ: grid.minZ - grid.step / 2, cell: grid.step, cols: grid.cols, rows: grid.rows,
  });
}

/** Titik sepanjang ring tertutup tiap ≤ spacing m (termasuk semua verteks). */
export function densifyRing(ring, spacing) {
  const out = [];
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing));
    for (let k = 0; k < steps; k += 1) out.push([a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps]);
  }
  return out;
}

/** Median (array disalin & diurutkan; panjang genap → rerata dua tengah). NaN bila kosong. */
export function median(values) {
  if (values.length === 0) return Number.NaN;
  const s = Float64Array.from(values).sort();
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Rentang indeks simpul yang menutup bbox {minX..maxX, minZ..maxZ} (di-clamp). */
export function nodeRange(grid, b) {
  return {
    c0: Math.max(0, Math.floor((b.minX - grid.minX) / grid.step)),
    c1: Math.min(grid.cols - 1, Math.ceil((b.maxX - grid.minX) / grid.step)),
    r0: Math.max(0, Math.floor((b.minZ - grid.minZ) / grid.step)),
    r1: Math.min(grid.rows - 1, Math.ceil((b.maxZ - grid.minZ) / grid.step)),
  };
}
```

`tools/campusbake/terrain/datum.js`:

```js
/**
 * Datum terrain (spec §5.2 langkah 4): h_ref = median elevasi sepanjang batas distrik (sampel tiap
 * `spacing` m, bilinear pada grid), y = h − h_ref. Murni.
 */
import { densifyRing, median, sampleGrid } from './grid.js';

/** @returns {number} h_ref (m) */
export function boundaryReference(grid, heights, ring, spacing) {
  const values = densifyRing(ring, spacing).map(([x, z]) => sampleGrid(grid, heights, x, z));
  const ref = median(values);
  if (!Number.isFinite(ref)) throw new Error('datum: batas distrik kosong');
  return ref;
}

/** y = h − ref (array baru). */
export function applyDatum(heights, ref) {
  const out = new Float64Array(heights.length);
  for (let i = 0; i < heights.length; i += 1) out[i] = heights[i] - ref;
  return out;
}
```

`tools/campusbake/terrain/blend.js`:

```js
/**
 * Blend ke nol (spec §5.2 langkah 5): w = smoothstep(0, D, jarak ke tepi batas) × bobot mask stadion,
 * bobot mask = 0 di dalam mask dan sampai `maskMargin` m di luarnya, lalu smoothstep(0, D, d − maskMargin).
 * Di luar batas w = 0 tepat (tile kota & stadion tetap y = 0). Murni.
 */
import { distanceToRing, pointInPolygon } from '../../../src/geo/polygon.js';
import { nodesInside } from './grid.js';

/** smoothstep Hermite klasik; e1 > e0. */
export function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Bobot satu titik (dipakai tes & laporan). */
export function blendWeightAt(x, z, { boundary, mask, distance, maskMargin }) {
  if (!pointInPolygon(x, z, boundary)) return 0;
  const wb = smoothstep(0, distance, distanceToRing(x, z, boundary));
  if (!mask || mask.length < 3) return wb;
  if (pointInPolygon(x, z, mask)) return 0;
  return wb * smoothstep(0, distance, distanceToRing(x, z, mask) - maskMargin);
}

/**
 * Bobot w per simpul grid.
 * @param {{minX:number,minZ:number,step:number,cols:number,rows:number}} grid
 * @param {{boundary:Array<[number,number]>, mask?:Array<[number,number]>|null, distance:number, maskMargin:number}} opts
 * @returns {Float32Array}
 */
export function blendWeights(grid, { boundary, mask = null, distance, maskMargin }) {
  const inside = nodesInside(grid, boundary);
  const w = new Float32Array(grid.cols * grid.rows);
  for (let r = 0; r < grid.rows; r += 1) {
    const z = grid.minZ + r * grid.step;
    for (let c = 0; c < grid.cols; c += 1) {
      const i = r * grid.cols + c;
      if (!inside[i]) continue;
      const x = grid.minX + c * grid.step;
      w[i] = blendWeightAt(x, z, { boundary, mask, distance, maskMargin });
    }
  }
  return w;
}

/** y × w (array baru); w = 0 → 0 tepat. */
export function applyBlend(heights, w) {
  const out = new Float64Array(heights.length);
  for (let i = 0; i < heights.length; i += 1) out[i] = w[i] > 0 ? heights[i] * w[i] : 0;
  return out;
}
```

`tools/campusbake/terrain/roads.js`:

```js
/**
 * Pengondisian jalan (spec §5.2 langkah 6), tiga tahap:
 * 1. Profil memanjang tiap jalan (sampel tiap `spacing` m dari tanah asal) dihaluskan Gaussian 3 sampel
 *    lalu dibatasi tanjakan ≤ maxGrade (rerata lintasan maju & mundur; keduanya memenuhi batas sehingga
 *    reratanya juga).
 * 2. Tiap simpul grid dalam jangkauan mengambil jalan TERDEKAT (target = profil di titik proyeksi).
 * 3. Simpul inti (≤ lebar/2 + bahu) dibuat Lipschitz-g pada graf 8-tetangga simpul inti: selubung bawah
 *    U = min_j(v_j + g·d_ij) dan atas L = max_j(v_j − g·d_ij) (Dijkstra multi-sumber), hasil (U + L)/2 juga
 *    Lipschitz-g. Ini menghapus "tangga" di simpang/jalan sejajar yang profilnya berbeda.
 * Zona blend (`blend` m di luar inti) berbaur linier ke tanah asal; parit opsional di tepi jalan utama.
 * Hanya simpul dengan w > 0 (di dalam distrik) yang diubah. Murni.
 */
import { nodeRange, sampleGrid } from './grid.js';

/** Polyline → titik tiap ≤ spacing m + jarak kumulatif s. */
export function resamplePolyline(line, spacing) {
  const pts = [[line[0][0], line[0][1]]];
  const s = [0];
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len === 0) continue;
    const steps = Math.max(1, Math.ceil(len / spacing));
    for (let k = 1; k <= steps; k += 1) {
      pts.push([a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps]);
      s.push(s[s.length - 1] + len / steps);
    }
  }
  return { pts, s };
}

/** Gaussian 3 sampel [¼, ½, ¼]; ujung tetap. */
export function smooth3(values) {
  const out = Float64Array.from(values);
  for (let i = 1; i < values.length - 1; i += 1) out[i] = 0.25 * values[i - 1] + 0.5 * values[i] + 0.25 * values[i + 1];
  return out;
}

/** Batasi |Δy| ≤ g·Δs: rerata lintasan maju dan lintasan mundur (simetris, tetap memenuhi batas). */
export function limitGrade(values, s, maxGrade) {
  const n = values.length;
  const fwd = Float64Array.from(values);
  for (let i = 1; i < n; i += 1) {
    const d = maxGrade * (s[i] - s[i - 1]);
    fwd[i] = Math.min(fwd[i - 1] + d, Math.max(fwd[i - 1] - d, fwd[i]));
  }
  const bwd = Float64Array.from(values);
  for (let i = n - 2; i >= 0; i -= 1) {
    const d = maxGrade * (s[i + 1] - s[i]);
    bwd[i] = Math.min(bwd[i + 1] + d, Math.max(bwd[i + 1] - d, bwd[i]));
  }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) out[i] = (fwd[i] + bwd[i]) / 2;
  return out;
}

/** Tanjakan maksimum |Δy/Δs| sebuah profil. */
export function maxGradeOf(values, s) {
  let g = 0;
  for (let i = 1; i < values.length; i += 1) {
    const ds = s[i] - s[i - 1];
    if (ds > 0) g = Math.max(g, Math.abs(values[i] - values[i - 1]) / ds);
  }
  return g;
}

/** Kedalaman parit (m, positif) pada jarak d dari sumbu; profil cos² selebar parit + 1 sampel grid tiap sisi. */
export function ditchDepth(d, core, ditch, step) {
  if (!ditch?.enabled) return 0;
  const center = core + ditch.offset + ditch.width / 2;
  const half = ditch.width / 2 + step;
  const u = Math.abs(d - center) / half;
  return u >= 1 ? 0 : ditch.depth * Math.cos((Math.PI / 2) * u) ** 2;
}

/** Profil terkondisi satu jalan. */
export function roadProfile(grid, data, road, { spacing, maxGrade }) {
  const { pts, s } = resamplePolyline(road.line, spacing);
  const raw = pts.map(([x, z]) => sampleGrid(grid, data, x, z));
  const values = limitGrade(smooth3(raw), s, maxGrade);
  return { pts, s, values, gradeBefore: maxGradeOf(raw, s), gradeAfter: maxGradeOf(values, s) };
}

/** Min-heap biner (kunci, indeks) untuk Dijkstra. */
function createHeap() {
  const keys = [];
  const ids = [];
  const swap = (a, b) => {
    [keys[a], keys[b]] = [keys[b], keys[a]];
    [ids[a], ids[b]] = [ids[b], ids[a]];
  };
  return {
    get size() { return keys.length; },
    push(k, id) {
      keys.push(k);
      ids.push(id);
      let i = keys.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (keys[p] < keys[i] || (keys[p] === keys[i] && ids[p] <= ids[i])) break;
        swap(i, p);
        i = p;
      }
    },
    pop() {
      const top = [keys[0], ids[0]];
      const lastK = keys.pop();
      const lastI = ids.pop();
      if (keys.length > 0) {
        keys[0] = lastK;
        ids[0] = lastI;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          const less = (a, b) => keys[a] < keys[b] || (keys[a] === keys[b] && ids[a] < ids[b]);
          if (l < keys.length && less(l, m)) m = l;
          if (r < keys.length && less(r, m)) m = r;
          if (m === i) break;
          swap(i, m);
          i = m;
        }
      }
      return top;
    },
  };
}

const NEIGHBORS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

/** Selubung bawah Lipschitz: out_i = min_j(v_j + g·d_ij) di graf 8-tetangga simpul ber-mask. */
function lowerEnvelope(grid, mask, values, g) {
  const out = Float64Array.from(values);
  const heap = createHeap();
  for (let i = 0; i < mask.length; i += 1) if (mask[i]) heap.push(out[i], i);
  const done = new Uint8Array(mask.length);
  while (heap.size > 0) {
    const [k, i] = heap.pop();
    if (done[i] || k > out[i]) continue;
    done[i] = 1;
    const r = Math.floor(i / grid.cols);
    const c = i - r * grid.cols;
    for (const [dr, dc] of NEIGHBORS) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= grid.rows || cc < 0 || cc >= grid.cols) continue;
      const j = rr * grid.cols + cc;
      if (!mask[j] || done[j]) continue;
      const cand = k + g * grid.step * Math.hypot(dr, dc);
      if (cand < out[j]) {
        out[j] = cand;
        heap.push(cand, j);
      }
    }
  }
  return out;
}

/**
 * Nilai Lipschitz-g (per meter) pada simpul ber-mask: (U + L)/2. Simpul tanpa mask tidak disentuh.
 * @param {Uint8Array} mask
 * @param {Float64Array} values
 * @returns {Float64Array}
 */
export function lipschitzOnMask(grid, mask, values, g) {
  const upper = lowerEnvelope(grid, mask, values, g);
  const neg = values.map((v) => -v);
  const lowerNeg = lowerEnvelope(grid, mask, neg, g);
  const out = Float64Array.from(values);
  for (let i = 0; i < mask.length; i += 1) if (mask[i]) out[i] = (upper[i] - lowerNeg[i]) / 2;
  return out;
}

/** Urutan deterministik jalan (id). */
export const roadOrder = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * @param {{minX:number,minZ:number,step:number,cols:number,rows:number}} grid
 * @param {Float64Array} data tinggi (sudah datum + blend)
 * @param {Float32Array} w bobot blend (0 = di luar distrik)
 * @param {Array<{id:string, cls:string, width:number, line:Array<[number,number]>}>} roads
 * @param {{spacing:number, maxGrade:number, shoulder:number, blend:number, ditch?:{enabled:boolean,
 *   width:number, depth:number, offset:number, classes:string[]}|null}} opts
 * @returns {{data: Float64Array, core: Uint8Array, stats: Array<{id:string, cls:string, gradeBefore:number, gradeAfter:number}>}}
 *   core = simpul inti jalan (dikunci untuk pad/air sesudahnya)
 */
export function conditionRoads(grid, data, w, roads, opts) {
  const { spacing, maxGrade, shoulder, blend, ditch = null } = opts;
  const n = grid.cols * grid.rows;
  const bestD = new Float64Array(n).fill(Infinity);
  const bestT = new Float64Array(n);
  const bestCore = new Float64Array(n);
  const bestDitch = new Uint8Array(n);
  const anchor = new Int32Array(n).fill(-1);
  const stats = [];
  for (const road of [...roads].sort(roadOrder)) {
    if (road.line.length < 2) continue;
    const prof = roadProfile(grid, data, road, { spacing, maxGrade });
    stats.push({ id: road.id, cls: road.cls, gradeBefore: prof.gradeBefore, gradeAfter: prof.gradeAfter });
    const core = road.width / 2 + shoulder;
    const reach = core + blend;
    const hasDitch = ditch?.enabled && ditch.classes.includes(road.cls) ? 1 : 0;
    for (let k = 0; k < prof.pts.length - 1; k += 1) {
      const a = prof.pts[k];
      const b = prof.pts[k + 1];
      const range = nodeRange(grid, {
        minX: Math.min(a[0], b[0]) - reach, maxX: Math.max(a[0], b[0]) + reach,
        minZ: Math.min(a[1], b[1]) - reach, maxZ: Math.max(a[1], b[1]) + reach,
      });
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len2 = dx * dx + dz * dz;
      for (let r = range.r0; r <= range.r1; r += 1) {
        const z = grid.minZ + r * grid.step;
        for (let c = range.c0; c <= range.c1; c += 1) {
          const i = r * grid.cols + c;
          if (!(w[i] > 0)) continue;
          const x = grid.minX + c * grid.step;
          const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / len2)) : 0;
          const px = a[0] + dx * t;
          const pz = a[1] + dz * t;
          const d = Math.hypot(x - px, z - pz);
          if (d > reach || d >= bestD[i]) continue;
          bestD[i] = d;
          bestT[i] = prof.values[k] + (prof.values[k + 1] - prof.values[k]) * t;
          bestCore[i] = core;
          bestDitch[i] = hasDitch;
          const ac = Math.round((px - grid.minX) / grid.step);
          const ar = Math.round((pz - grid.minZ) / grid.step);
          anchor[i] = ar >= 0 && ar < grid.rows && ac >= 0 && ac < grid.cols ? ar * grid.cols + ac : -1;
        }
      }
    }
  }
  const isCore = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) if (bestD[i] <= bestCore[i]) isCore[i] = 1;
  const coreVals = lipschitzOnMask(grid, isCore, bestT, maxGrade);
  const out = Float64Array.from(data);
  for (let i = 0; i < n; i += 1) {
    if (bestD[i] === Infinity) continue;
    if (isCore[i]) {
      out[i] = coreVals[i];
      continue;
    }
    const j = anchor[i];
    const target = bestT[i] + (j >= 0 && isCore[j] ? coreVals[j] - bestT[j] : 0);
    const rel = Math.min(1, (bestD[i] - bestCore[i]) / blend);
    out[i] = target + (data[i] - target) * rel - (bestDitch[i] ? ditchDepth(bestD[i], bestCore[i], ditch, grid.step) : 0);
  }
  return { data: out, core: isCore, stats };
}
```

`tools/campusbake/terrain/pads.js`:

```js
/**
 * Pad gedung & region hero (spec §5.2 langkah 7): footprint diratakan ke median tanah di dalamnya
 * (atau angka tetap `y`), blend linier `blend` m di luar footprint. Pad diproses urut id (yang belakangan
 * menimpa). Hanya simpul dengan w > 0 yang diubah; simpul `locked` (inti jalan) tidak diubah agar tanjakan
 * jalan tetap ≤ batas. Murni.
 */
import { distanceToRing, pointInPolygon, polygonCentroid, ringBounds } from '../../../src/geo/polygon.js';
import { median, nodeRange, sampleGrid } from './grid.js';

/**
 * @param {Array<{id:string, ring:Array<[number,number]>, y?:'median'|number}>} pads
 * @returns {{data: Float64Array, stats: Array<{id:string, target:number, nodes:number}>}}
 */
export function applyPads(grid, data, w, pads, { blend }, locked = null) {
  const out = Float64Array.from(data);
  const stats = [];
  for (const pad of [...pads].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const b = ringBounds(pad.ring);
    const range = nodeRange(grid, { minX: b.minX - blend, maxX: b.maxX + blend, minZ: b.minZ - blend, maxZ: b.maxZ + blend });
    const insideVals = [];
    const touched = [];
    for (let r = range.r0; r <= range.r1; r += 1) {
      const z = grid.minZ + r * grid.step;
      for (let c = range.c0; c <= range.c1; c += 1) {
        const i = r * grid.cols + c;
        if (!(w[i] > 0)) continue;
        const x = grid.minX + c * grid.step;
        const inside = pointInPolygon(x, z, pad.ring);
        const d = inside ? 0 : distanceToRing(x, z, pad.ring);
        if (d > blend) continue;
        if (inside) insideVals.push(out[i]);
        touched.push([i, d]);
      }
    }
    if (touched.length === 0) continue;
    let target = pad.y;
    if (typeof target !== 'number') {
      const cen = polygonCentroid(pad.ring);
      target = insideVals.length ? median(insideVals) : sampleGrid(grid, out, cen.x, cen.z);
    }
    for (const [i, d] of touched) if (!locked?.[i]) out[i] = target + (out[i] - target) * (d / blend);
    stats.push({ id: pad.id, target, nodes: insideVals.length });
  }
  return { data: out, stats };
}
```

`tools/campusbake/terrain/water.js`:

```js
/**
 * Danau/waduk (spec §5.2 langkah 8): muka air = tanah terendah di tepi − shoreDrop; dasar = muka air −
 * depth; tanggul lereng 1 : bankRun dari titik tepi terendah ke bawah. Terrain hanya digali (tidak
 * ditimbun). Muka air dilaporkan ke manifest untuk mesh air M2. Murni.
 */
import { distanceToRing, pointInPolygon, ringBounds } from '../../../src/geo/polygon.js';
import { densifyRing, nodeRange, sampleGrid } from './grid.js';

/** Profil dasar di jarak d (m) ke dalam dari tepi. */
export function lakeFloor(d, shore, { shoreDrop, depth, bankRun }) {
  const bed = shore - shoreDrop - depth;
  return Math.max(bed, shore - d / bankRun);
}

/**
 * @param {Array<{id:string, name?:string, ring:Array<[number,number]>}>} lakes
 * @returns {{data: Float64Array, levels: Array<{id:string, name:string|null, level:number, bed:number}>}}
 */
export function applyWater(grid, data, w, lakes, opts) {
  const out = Float64Array.from(data);
  const levels = [];
  for (const lake of lakes) {
    const shore = Math.min(...densifyRing(lake.ring, grid.step / 2).map(([x, z]) => sampleGrid(grid, out, x, z)));
    const level = shore - opts.shoreDrop;
    const bed = level - opts.depth;
    const range = nodeRange(grid, ringBounds(lake.ring));
    for (let r = range.r0; r <= range.r1; r += 1) {
      const z = grid.minZ + r * grid.step;
      for (let c = range.c0; c <= range.c1; c += 1) {
        const i = r * grid.cols + c;
        const x = grid.minX + c * grid.step;
        if (!(w[i] > 0) || !pointInPolygon(x, z, lake.ring)) continue;
        out[i] = Math.min(out[i], lakeFloor(distanceToRing(x, z, lake.ring), shore, opts));
      }
    }
    levels.push({ id: lake.id, name: lake.name ?? null, level: Math.round(level * 100) / 100, bed: Math.round(bed * 100) / 100 });
  }
  return { data: out, levels };
}
```

`tools/campusbake/terrain/writeChunks.js`:

```js
/**
 * Kuantisasi & potong grid ke chunk "unri-terrain" v1 (Uint16 LE, spec §4.1). Chunk yang semua
 * sampelnya y = 0 tidak ditulis (heightAt = 0 tanpa chunk). Murni (I/O di cli.js).
 */
import { Buffer } from 'node:buffer';
import { BIAS, N, UNIT, ZERO_U16 } from '../../../src/geo/terrain/format.js';
import { tileKey } from '../../../src/geo/tiles.js';

/** Meter → u16 (dibulatkan ke 1 cm, di-clamp ke rentang format). */
export function quantize(y) {
  const u = Math.round(y / UNIT) - BIAS;
  return Math.min(65535, Math.max(0, u));
}

/**
 * Chunk (ix, iz) dari grid selaras chunk.
 * @returns {{key:string, ix:number, iz:number, buffer:Buffer, empty:boolean}}
 */
export function encodeChunk(grid, data, ix, iz) {
  const per = N - 1;
  const c0 = (ix - grid.ix0) * per;
  const r0 = (iz - grid.iz0) * per;
  if (c0 < 0 || r0 < 0 || c0 + per >= grid.cols || r0 + per >= grid.rows) throw new RangeError(`chunk ${ix}_${iz} di luar grid`);
  const buffer = Buffer.alloc(N * N * 2);
  let empty = true;
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      const u = quantize(data[(r0 + r) * grid.cols + c0 + c]);
      if (u !== ZERO_U16) empty = false;
      buffer.writeUInt16LE(u, (r * N + c) * 2);
    }
  }
  return { key: tileKey(ix, iz), ix, iz, buffer, empty };
}

/** Semua chunk tak kosong grid, urut iz lalu ix. */
export function encodeChunks(grid, data) {
  const out = [];
  for (let iz = grid.iz0; iz < grid.iz0 + grid.chunksZ; iz += 1) {
    for (let ix = grid.ix0; ix < grid.ix0 + grid.chunksX; ix += 1) {
      const chunk = encodeChunk(grid, data, ix, iz);
      if (!chunk.empty) out.push(chunk);
    }
  }
  return out;
}
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/terrainStages.test.js`
Expected: PASS — `Tests  18 passed (18)`.

- [ ] **Step 5: Commit**

```bash
git add tools/campusbake/terrain tests/campusbake/terrainStages.test.js
```
```bash
git commit -m "feat(campusbake): tahap terrain murni — datum, blend tepi, jalan ≤ 6% (inti Lipschitz), pad, danau, chunk Uint16"
```

---

### Task 6: Konfigurasi, fitur OSM kampus, batas distrik (TDD untuk `boundary.js`)

**Files:**
- Create: `tools/campusbake/config.js`, `tools/campusbake/osm.js`, `tools/campusbake/boundary.js`
- Test: `tests/campusbake/boundary.test.js`

Algoritma batas (spec §6 bullet terakhir), deterministik:
1. `bufferRing(mask, 40)` = `polygon-clipping.union` dari mask + **kapsul cembung** per sisi (`convexHull` dua 16-gon di kedua ujung). 16-gon **mengelilingi** lingkaran (jari-jari d / cos(π/16)) sehingga jarak buffer ≥ 40 m ke segala arah, sudut digeser setengah langkah, koordinat dibulatkan 1 µm. (Versi "persegi panjang + lingkaran terpisah" memicu galat `Unable to find segment … in SweepLine tree` polygon-clipping karena titik hampir berimpit — terbukti di prototipe.)
2. `difference(kampus, buffer)` → MultiPolygon; ambil poligon dengan ring luar terluas (lubang & potongan lain dibuang, dilaporkan `droppedArea`; data nyata: 1 potongan).
3. Douglas–Peucker tertutup 5 m (jangkar: verteks paling barat & verteks terjauh darinya).
4. Orientasi luas bertanda positif (`orientRing(…, true)`), bulat 0,01 m, mulai dari verteks paling barat.
5. Ditulis sebagai modul data beku `src/districts/unri/boundary.js` — runtime tanpa pustaka clipping.

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import polygonClipping from 'polygon-clipping';
import {
  bufferRing, simplifyLine, simplifyRing, computeBoundary, boundaryModuleSource,
} from '../../tools/campusbake/boundary.js';
import { polygonArea, signedArea, pointInPolygon } from '../../src/geo/polygon.js';

const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const multiArea = (mp) => mp.reduce((s, poly) => s + polygonArea(poly[0].slice(0, -1)) - poly.slice(1).reduce((h, r) => h + polygonArea(r.slice(0, -1)), 0), 0);

describe('bufferRing (jumlah Minkowski, 16-gon yang mengelilingi lingkaran)', () => {
  it('persegi 10 m + 5 m: 100 + 4·10·5 + luas 16-gon keliling r 5 (16·25·tan(π/16) = 79,56) = 379,56 m²', () => {
    const area = multiArea(bufferRing(sq(0, 0, 10, 10), 5, 16));
    expect(area).toBeCloseTo(100 + 200 + 16 * 25 * Math.tan(Math.PI / 16), 3);
  });
  it('hasil bertipe MultiPolygon polygon-clipping (ring tertutup)', () => {
    const mp = bufferRing(sq(0, 0, 10, 10), 1);
    expect(mp).toHaveLength(1);
    const outer = mp[0][0];
    expect(outer[0]).toEqual(outer[outer.length - 1]);
    expect(typeof polygonClipping.union).toBe('function');
  });
});

describe('Douglas–Peucker', () => {
  it('garis: titik kolinear & simpangan < toleransi dibuang, ujung dipertahankan', () => {
    expect(simplifyLine([[0, 0], [5, 0.5], [10, 0]], 1)).toEqual([[0, 0], [10, 0]]);
    expect(simplifyLine([[0, 0], [5, 3], [10, 0]], 1)).toEqual([[0, 0], [5, 3], [10, 0]]);
  });
  it('ring: persegi bertitik tengah di tiap sisi → 4 sudut', () => {
    const ring = [[0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50]];
    const out = simplifyRing(ring, 5);
    expect(out).toHaveLength(4);
    expect(polygonArea(out)).toBe(10000);
  });
});

describe('computeBoundary', () => {
  it('kampus 1 km² dikurangi pojok mask ±100 m (+40 m): satu potongan, luas ≈ 1e6 − 19.273 (+DP 5 m)', () => {
    const r = computeBoundary({ campusRing: sq(0, 0, 1000, 1000), maskRing: sq(-100, -100, 100, 100), maskMargin: 40, tolerance: 5 });
    expect(r.pieces).toBe(1);
    expect(r.droppedArea).toBe(0);
    expect(signedArea(r.ring)).toBeGreaterThan(0);
    // buffer ∩ kuadran: 140² − (40² − ¼·16·40²·tan(π/16)) = 19.273; Douglas–Peucker 5 m memangkas sudut bulat (±50 m²)
    expect(r.area).toBeGreaterThan(1e6 - 19400);
    expect(r.area).toBeLessThan(1e6 - 19100);
    expect(pointInPolygon(120, 120, r.ring)).toBe(false); // 28 m dari pojok mask → di dalam buffer
    expect(pointInPolygon(130, 130, r.ring)).toBe(true); // 42 m dari pojok mask → di luar buffer
    expect(pointInPolygon(500, 500, r.ring)).toBe(true);
    expect(r.ring[0][0]).toBe(Math.min(...r.ring.map((p) => p[0]))); // mulai dari verteks paling barat
    expect(r.ring.flat().every((v) => Math.round(v * 100) / 100 === v)).toBe(true);
  });

  it('mask membelah kampus → potongan terluas dipakai, sisanya dilaporkan', () => {
    const r = computeBoundary({ campusRing: sq(0, 0, 1000, 200), maskRing: sq(300, -50, 320, 250), maskMargin: 40, tolerance: 5 });
    expect(r.pieces).toBe(2);
    expect(r.area).toBeCloseTo(640 * 200, -2); // x 360..1000
    expect(r.droppedArea).toBeCloseTo(260 * 200, -2); // x 0..260
  });

  it('mask menutup seluruh kampus → galat', () => {
    expect(() => computeBoundary({ campusRing: sq(0, 0, 10, 10), maskRing: sq(-50, -50, 60, 60), maskMargin: 40, tolerance: 5 })).toThrow(/kosong/);
  });
});

describe('boundaryModuleSource', () => {
  it('modul hasil dapat diimpor & bernilai sama (data beku)', async () => {
    const ring = [[0, 0], [10.5, 0], [10.5, 20.25], [0, 20.25]];
    const src = boundaryModuleSource({ ring, area: 212.625 }, { osmTimestamp: '2026-10-17T13:19:51Z', wayId: 938374562, maskMargin: 40, tolerance: 5 });
    expect(src).toContain('DIHASILKAN oleh');
    const dir = await mkdtemp(join(tmpdir(), 'batas-'));
    const file = join(dir, 'boundary.mjs');
    await writeFile(file, src);
    const mod = await import(pathToFileURL(file).href);
    expect(mod.UNRI_BOUNDARY).toEqual(ring);
    expect(Object.isFrozen(mod.UNRI_BOUNDARY)).toBe(true);
    expect(mod.UNRI_BOUNDARY_META).toEqual({ wayId: 938374562, osmTimestamp: '2026-10-17T13:19:51Z', maskMargin: 40, tolerance: 5, area: 213 });
    await rm(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/boundary.test.js`
Expected: FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi** — `tools/campusbake/config.js`:

```js
/**
 * Konfigurasi campusbake (Node, offline): sumber DEM, kawasan OSM kampus, parameter terrain (spec §5.2).
 * Semua angka bake ada di sini agar mudah ditinjau; mengubahnya mengubah keluaran (golden test).
 */
import { WORLD_ORIGIN } from '../../src/config/constants.js';
import { stadionMaskWorld } from '../../src/regions/stadion/mask.js';
import { ROAD_CLASSES } from '../citybake/config.js';

export const ORIGIN = WORLD_ORIGIN;

/** Direktori keluaran distrik (di-commit) dan cache data mentah (di-.gitignore lewat `data-src/`). */
export const PATHS = Object.freeze({
  outDir: 'public/districts/unri',
  cacheDir: 'data-src',
  boundaryModule: 'src/districts/unri/boundary.js',
});

/**
 * SRTM GL1 (1″, NASA/USGS, domain publik) ubin N00E101, mirror AWS Open Data "Terrain Tiles"
 * (elevation-tiles-prod, format skadi = .hgt.gz). Diverifikasi 2026-10-17: HTTP 200 tanpa login,
 * Content-Length 8.376.941, ETag "16e6f55bbca4ce2caf1671381a458c26", ISIZE gzip 25.934.402 = 3601² × 2.
 * sha256 dipin agar bake ulang memakai data yang sama (spec §15 "rilis dipin").
 */
export const SRTM = Object.freeze({
  tile: 'N00E101',
  lat0: 0,
  lon0: 101,
  size: 3601,
  url: 'https://s3.amazonaws.com/elevation-tiles-prod/skadi/N00/N00E101.hgt.gz',
  sha256: '9dbcbb8021efcb2a472fae201ab9a3c8a323e61c69f0d8ca6b1eea134998d314',
  attribution: 'SRTM GL1 1″ (NASA/USGS, domain publik) via AWS Open Data Terrain Tiles (skadi)',
});

/**
 * Kawasan OSM kampus (cache `data-src/osm/unri-kampus.json`, query Overpass yang sama dengan citybake).
 * Bbox = bbox poligon way 938374562 (lat 0,46434–0,48775; lon 101,37495–101,39352) + ±0,002° (±220 m).
 */
export const CAMPUS_OSM = Object.freeze({
  areaId: 'unri-kampus',
  wayId: 938374562,
  bbox: Object.freeze({ south: 0.4623, west: 101.3727, north: 0.4898, east: 101.3957 }),
});

/** Mask stadion dunia (sumber tunggal: src/regions/stadion/mask.js). */
export const STADION_MASK_WORLD = stadionMaskWorld();

/** Batas distrik (spec §6 bullet terakhir): way kampus − (mask stadion + 40 m), disederhanakan 5 m. */
export const BOUNDARY = Object.freeze({ maskMargin: 40, simplify: 5, circleSegments: 16 });

/** Parameter terrain (spec §5.2). Satuan meter kecuali disebut lain. */
export const TERRAIN = Object.freeze({
  margin: 150,              // bbox distrik + margin → chunk yang dibuat
  median: 5,                // median 5×5 sampel
  gaussSigma: 5,            // σ = 20 m = 5 sampel grid 4 m
  datumSpacing: 4,          // sampel datum sepanjang batas
  blendDistance: 120,       // smoothstep(0, 120, jarakKeTepi)
  maskBlendMargin: 60,      // mask stadion + 60 m tetap y = 0
  road: Object.freeze({
    spacing: 4, maxGrade: 0.06, shoulder: 1.5, blend: 6,
    skip: Object.freeze(['steps']),
  }),
  ditch: Object.freeze({    // [INFERENSI pola kampus Pekanbaru]: parit tepi jalan utama
    enabled: true, width: 1.0, depth: 0.6, offset: 1.0,
    classes: Object.freeze(['primary', 'secondary', 'tertiary', 'tertiary_link']),
  }),
  pad: Object.freeze({ blend: 4 }),
  water: Object.freeze({
    shoreDrop: 0.4, depth: 1.5, bankRun: 3,
    lakes: Object.freeze([
      Object.freeze({ id: 'w373856980', name: 'Danau Buatan Universitas Riau' }),
      Object.freeze({ id: 'w327366050', name: 'Waduk UNRI' }),
    ]),
  }),
});

/** Lebar total jalan per kelas OSM (m) — mengikuti citybake (spec §6). */
export const ROAD_WIDTHS = Object.freeze(Object.fromEntries(Object.entries(ROAD_CLASSES).map(([k, v]) => [k, v.width])));

/**
 * Pad region hero (dunia): `{ id, ring:[[x,z]...], y:'median'|number }`. Kosong di M1; M4/M6 menambah
 * pad region `unri-lembaga`/`unri-rektorat` (ring lokal region diubah ke dunia lewat placement region).
 */
export const REGION_PADS = Object.freeze([]);

/** Batas laporan (peringatan, tidak menggagalkan bake). Spec §9.1: data distrik ≤ 8 MB total. */
export const BUDGET = Object.freeze({ terrainBytes: 3 * 1024 * 1024 });
```

`tools/campusbake/osm.js`:

```js
/**
 * Fitur OSM kampus untuk bake: ring kampus, jalan, gedung, danau — dari cache Overpass
 * `data-src/osm/<areaId>.json` (loader & normalisasi citybake), koordinat dunia. Murni kecuali loadCampusOsm.
 */
import { createProjection } from '../../src/geo/projection.js';
import { pointInPolygon, polygonCentroid } from '../../src/geo/polygon.js';
import { loadOsm, normalizeOsm } from '../citybake/fetchOsm.js';
import { projectFeatures } from '../citybake/features.js';

/** 'osm:way/123' → 'w123'; 'osm:relation/9#0' → 'r9#0' (id gedung kontrak M3). */
export function shortId(id) {
  const m = String(id).match(/^osm:(way|relation)\/(\d+)(#\d+)?$/);
  return m ? `${m[1] === 'way' ? 'w' : 'r'}${m[2]}${m[3] ?? ''}` : String(id);
}

/** Muat JSON Overpass mentah kampus (cache/online). */
export function loadCampusOsm(campus, { cacheDir, offline, log }) {
  return loadOsm(campus.areaId, campus.bbox, { cacheDir, offline, log });
}

/**
 * @param {object} raw JSON Overpass mentah
 * @param {{lat:number, lon:number}} origin
 * @returns {{timestamp:string|null, features:object[]}} fitur dunia
 */
export function campusFeatures(raw, origin) {
  const projection = createProjection({ lat0: origin.lat, lon0: origin.lon });
  const osm = normalizeOsm(raw);
  return { timestamp: osm.timestamp, features: projectFeatures(osm.features, projection) };
}

/** Ring dunia way kampus. @throws bila tidak ada di cache */
export function campusRing(features, wayId) {
  const f = features.find((g) => g.id === `osm:way/${wayId}` && g.rings);
  if (!f) throw new Error(`way ${wayId} (poligon kampus) tidak ada di cache OSM`);
  return f.rings[0];
}

const touches = (line, ring) => line.some(([x, z]) => pointInPolygon(x, z, ring));

/** Jalan (polyline) yang punya titik di dalam batas; lebar dari `widths`, kelas di `skip` dibuang. */
export function campusRoads(features, boundary, widths, skip = []) {
  return features
    .filter((f) => f.kind === 'road' && widths[f.cls] && !skip.includes(f.cls) && touches(f.line, boundary))
    .map((f) => ({ id: shortId(f.id), cls: f.cls, width: widths[f.cls], line: f.line }));
}

/** Gedung OSM dengan centroid di dalam batas → pad. */
export function campusBuildingPads(features, boundary) {
  return features
    .filter((f) => f.kind === 'building' && f.source === 'osm')
    .filter((f) => {
      const c = polygonCentroid(f.rings[0]);
      return pointInPolygon(c.x, c.z, boundary);
    })
    .map((f) => ({ id: shortId(f.id), ring: f.rings[0], y: 'median' }));
}

/** Danau dari daftar konfigurasi (id pendek 'w…'); yang tidak ditemukan dilaporkan. */
export function campusLakes(features, lakes) {
  const found = [];
  const missing = [];
  for (const lake of lakes) {
    const f = features.find((g) => shortId(g.id) === lake.id && g.kind === 'water' && g.rings);
    if (f) found.push({ id: lake.id, name: lake.name, ring: f.rings[0] });
    else missing.push(lake.id);
  }
  return { lakes: found, missing };
}
```

`tools/campusbake/boundary.js`:

```js
/**
 * Batas distrik UNRI (spec §6 bullet terakhir): poligon kampus OSM way 938374562 DIKURANGI mask stadion
 * yang di-buffer `maskMargin` m, lalu disederhanakan (Douglas–Peucker `tolerance` m) menjadi SATU ring.
 *
 * Algoritma (deterministik):
 * 1. buffer(mask, d) = gabungan (polygon-clipping `union`) dari mask + kapsul cembung tiap sisi = hull dua
 *    n-gon (`segments`) yang mengelilingi lingkaran jari-jari d di kedua ujung (jumlah Minkowski mask ⊕ cakram,
 *    didekati dari luar: jarak buffer ≥ d di semua arah).
 * 2. selisih = `difference(kampus, buffer)` → MultiPolygon. Diambil poligon dengan ring luar TERLUAS;
 *    lubang dan potongan lain dibuang (dilaporkan sebagai `droppedArea`) — spec menuntut ring tunggal.
 * 3. Douglas–Peucker tertutup: titik jangkar = verteks dengan x terkecil (seri: z terkecil) dan verteks
 *    terjauh darinya; kedua rantai disederhanakan terpisah.
 * 4. Orientasi luas bertanda positif (orientRing true), koordinat dibulatkan 0,01 m, mulai dari verteks
 *    x terkecil.
 * polygon-clipping hanya dipakai di tools (Node); runtime memakai hasil beku di src/districts/unri/boundary.js.
 */
import polygonClipping from 'polygon-clipping';
import { cleanRing, convexHull, orientRing, polygonArea } from '../../src/geo/polygon.js';

const close = (ring) => [...ring.map((p) => [p[0], p[1]]), [ring[0][0], ring[0][1]]];
const open = (ring) => cleanRing(ring, 1e-9);

/**
 * Titik n-gon yang MENGELILINGI lingkaran berjari-jari d di (x, z) (jari-jari d / cos(π/n): setiap sisi
 * menyinggung lingkaran, jadi buffer ≥ d di semua arah). Sudut digeser setengah langkah: sisi sejajar sumbu.
 */
function circlePoints(x, z, d, segments) {
  const out = [];
  const r = d / Math.cos(Math.PI / segments);
  for (let i = 0; i < segments; i += 1) {
    const t = ((i + 0.5) / segments) * Math.PI * 2;
    out.push([snap(x + r * Math.cos(t)), snap(z + r * Math.sin(t))]);
  }
  return out;
}

/** Bulatkan ke 1 µm: titik lingkaran bersama dua kapsul jadi identik persis (polygon-clipping peka titik hampir-sama). */
const snap = (v) => Math.round(v * 1e6) / 1e6;

/**
 * Buffer luar ring sejauh d (m): gabungan ring + "kapsul" cembung tiap sisi (hull dua lingkaran ujung).
 * Kapsul cembung tidak punya titik dalam yang hampir berimpit — union polygon-clipping stabil.
 * @returns {Array} MultiPolygon polygon-clipping
 */
export function bufferRing(ring, d, segments = 16) {
  const r = open(ring).map(([x, z]) => [snap(x), snap(z)]);
  const parts = [[close(r)]];
  for (let i = 0; i < r.length; i += 1) {
    const a = r[i];
    const b = r[(i + 1) % r.length];
    const hull = convexHull([...circlePoints(a[0], a[1], d, segments), ...circlePoints(b[0], b[1], d, segments)]);
    parts.push([close(hull)]);
  }
  return polygonClipping.union(...parts);
}

function perpendicular(p, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dx * (a[1] - p[1]) - (a[0] - p[0]) * dz) / len;
}

/** Douglas–Peucker polyline terbuka (ujung dipertahankan). */
export function simplifyLine(pts, tol) {
  if (pts.length <= 2) return pts.map((p) => [p[0], p[1]]);
  let best = -1;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const d = perpendicular(pts[i], pts[0], pts[pts.length - 1]);
    if (d > best) { best = d; idx = i; }
  }
  if (best <= tol) return [[pts[0][0], pts[0][1]], [pts[pts.length - 1][0], pts[pts.length - 1][1]]];
  const left = simplifyLine(pts.slice(0, idx + 1), tol);
  const right = simplifyLine(pts.slice(idx), tol);
  return [...left.slice(0, -1), ...right];
}

/** Douglas–Peucker ring tertutup (ring terbuka masuk & keluar). */
export function simplifyRing(ring, tol) {
  const r = open(ring);
  if (r.length <= 4) return r;
  let a = 0;
  r.forEach((p, i) => { if (p[0] < r[a][0] || (p[0] === r[a][0] && p[1] < r[a][1])) a = i; });
  let b = a;
  let far = -1;
  r.forEach((p, i) => {
    const d = Math.hypot(p[0] - r[a][0], p[1] - r[a][1]);
    if (d > far) { far = d; b = i; }
  });
  const rot = [...r.slice(a), ...r.slice(0, a)];
  const k = (b - a + r.length) % r.length;
  const first = simplifyLine(rot.slice(0, k + 1), tol);
  const second = simplifyLine([...rot.slice(k), rot[0]], tol);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

const round2 = (v) => Math.round(v * 100) / 100;

/** Mulai dari verteks x terkecil (seri: z terkecil) agar keluaran stabil. */
function startAtWest(ring) {
  let a = 0;
  ring.forEach((p, i) => { if (p[0] < ring[a][0] || (p[0] === ring[a][0] && p[1] < ring[a][1])) a = i; });
  return [...ring.slice(a), ...ring.slice(0, a)];
}

/**
 * @param {{campusRing:Array<[number,number]>, maskRing:Array<[number,number]>, maskMargin:number,
 *   tolerance:number, segments?:number}} opts koordinat dunia
 * @returns {{ring:Array<[number,number]>, area:number, campusArea:number, pieces:number, droppedArea:number}}
 */
export function computeBoundary({ campusRing, maskRing, maskMargin, tolerance, segments = 16 }) {
  const campus = [[close(open(campusRing))]];
  const diff = polygonClipping.difference(campus, bufferRing(maskRing, maskMargin, segments));
  if (diff.length === 0) throw new Error('batas distrik kosong setelah dikurangi mask stadion');
  const areaOf = (poly) => polygonArea(open(poly[0])) - poly.slice(1).reduce((s, h) => s + polygonArea(open(h)), 0);
  const sorted = [...diff].sort((p, q) => polygonArea(open(q[0])) - polygonArea(open(p[0])));
  const main = sorted[0];
  const totalArea = diff.reduce((s, p) => s + areaOf(p), 0);
  const simplified = simplifyRing(open(main[0]), tolerance);
  const ring = startAtWest(orientRing(simplified, true).map(([x, z]) => [round2(x), round2(z)]));
  const area = polygonArea(ring);
  return {
    ring, area, campusArea: polygonArea(open(campusRing)), pieces: diff.length, droppedArea: Math.max(0, totalArea - areaOf(main)),
  };
}

/**
 * Sumber modul `src/districts/unri/boundary.js` (data beku; runtime tanpa pustaka clipping).
 * @param {{ring:Array<[number,number]>, area:number}} result
 * @param {{osmTimestamp:string|null, wayId:number, maskMargin:number, tolerance:number}} meta
 */
export function boundaryModuleSource(result, meta) {
  const rows = [];
  for (let i = 0; i < result.ring.length; i += 4) {
    rows.push(`  ${result.ring.slice(i, i + 4).map(([x, z]) => `[${x}, ${z}]`).join(', ')},`);
  }
  return [
    '/**',
    ' * Batas distrik UNRI (dunia, +X timur, +Z selatan, meter). DIHASILKAN oleh',
    ' * `npm run bake:campus -- boundary` (tools/campusbake/boundary.js) — jangan disunting tangan.',
    ` * Sumber: OSM way ${meta.wayId} (© kontributor OpenStreetMap, ODbL), data ${meta.osmTimestamp ?? 'waktu tidak diketahui'};`,
    ` * dikurangi mask stadion + ${meta.maskMargin} m, Douglas–Peucker ${meta.tolerance} m, ring tunggal luas bertanda positif.`,
    ' */',
    'const RING = [',
    ...rows,
    '];',
    '',
    `/** Ring terbuka ${result.ring.length} titik, luas ${Math.round(result.area)} m². */`,
    'export const UNRI_BOUNDARY = Object.freeze(RING.map((p) => Object.freeze(p)));',
    '',
    'export const UNRI_BOUNDARY_META = Object.freeze({',
    `  wayId: ${meta.wayId},`,
    `  osmTimestamp: ${JSON.stringify(meta.osmTimestamp ?? null)},`,
    `  maskMargin: ${meta.maskMargin},`,
    `  tolerance: ${meta.tolerance},`,
    `  area: ${Math.round(result.area)},`,
    '});',
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/boundary.test.js`
Expected: PASS — `Tests  8 passed (8)`.

- [ ] **Step 5: Commit**

```bash
git add tools/campusbake/config.js tools/campusbake/osm.js tools/campusbake/boundary.js tests/campusbake/boundary.test.js
```
```bash
git commit -m "feat(campusbake): konfigurasi (SRTM dipin sha256), fitur OSM kampus, batas distrik kampus − mask stadion + 40 m"
```

---

### Task 7: Pipeline terrain, laporan, manifest, CLI + golden test

**Files:**
- Create: `tools/campusbake/terrain/bakeTerrain.js`, `tools/campusbake/report.js`, `tools/campusbake/manifest.js`, `tools/campusbake/cli.js`, `tools/campusbake/index.js`
- Test: `tests/campusbake/golden.test.js`

Golden memakai DEM sintetis 1201² (bilangan bulat meter seperti SRTM), batas uji 600 × 600 m, OSM sintetis (tertiary, service, gedung, danau `w373856980`), `--offline`, `now: () => 0`, lalu bake **dua kali** ke dua direktori → hash sha256 semua berkas harus identik.

- [ ] **Step 1: Tulis golden test**

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTerrain, parseCli, main } from '../../tools/campusbake/cli.js';
import { SRTM, TERRAIN, ORIGIN } from '../../tools/campusbake/config.js';
import { createProjection } from '../../src/geo/projection.js';
import { decodeChunk, createHeightField } from '../../src/geo/terrain/heightfield.js';
import { pointInPolygon } from '../../src/geo/polygon.js';

/** DEM sintetis 1201² (3″): bukit & lembah bilangan bulat meter (seperti SRTM). */
function demBytes() {
  const size = 1201;
  const bytes = new Uint8Array(size * size * 2);
  const view = new DataView(bytes.buffer);
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) view.setInt16((r * size + c) * 2, Math.round(30 + 4 * Math.sin(c / 9) + 3 * Math.cos(r / 13)), false);
  }
  return bytes;
}

const proj = createProjection({ lat0: ORIGIN.lat, lon0: ORIGIN.lon });
const geom = (pts) => pts.map(([x, z]) => {
  const p = proj.toLatLon(x, z);
  return { lat: p.lat, lon: p.lon };
});
const closed = (pts) => [...pts, pts[0]];
/** Batas uji 600 × 600 m di area kampus (dunia). */
const BOUNDARY = [[-900, 600], [-300, 600], [-300, 1200], [-900, 1200]];
const OSM = {
  osm3s: { timestamp_osm_base: '2026-10-17T00:00:00Z' },
  elements: [
    { type: 'way', id: 11, tags: { highway: 'tertiary', name: 'Jalan Uji' }, geometry: geom([[-950, 900], [-600, 880], [-250, 920]]) },
    { type: 'way', id: 12, tags: { highway: 'service' }, geometry: geom([[-600, 880], [-610, 700]]) },
    { type: 'way', id: 13, tags: { building: 'university', name: 'Gedung Uji' }, geometry: geom(closed([[-500, 1000], [-460, 1000], [-460, 1030], [-500, 1030]])) },
    { type: 'way', id: 373856980, tags: { natural: 'water', water: 'reservoir' }, geometry: geom(closed([[-800, 700], [-720, 700], [-720, 780], [-800, 780]])) },
  ],
};
const quiet = { info() {}, warn() {}, error() {} };
const opts = (outDir) => ({
  outDir, cacheDir: join(outDir, 'cache'), offline: true, log: quiet, boundary: BOUNDARY, mask: null, srtm: SRTM,
  loaders: { dem: async () => demBytes(), osm: async () => OSM }, now: () => 0,
});

async function hashes(dir) {
  const out = {};
  for (const sub of ['', 'terrain']) {
    for (const f of (await readdir(join(dir, sub), { withFileTypes: true })).filter((e) => e.isFile())) {
      out[join(sub, f.name)] = createHash('sha256').update(await readFile(join(dir, sub, f.name))).digest('hex');
    }
  }
  return out;
}

let dirA;
let dirB;
let first;

beforeAll(async () => {
  dirA = await mkdtemp(join(tmpdir(), 'campus-a-'));
  dirB = await mkdtemp(join(tmpdir(), 'campus-b-'));
  first = await runTerrain(opts(dirA));
  await runTerrain(opts(dirB));
}, 120000);

afterAll(async () => {
  await rm(dirA, { recursive: true, force: true });
  await rm(dirB, { recursive: true, force: true });
});

describe('golden campusbake terrain (DEM & OSM sintetis, --offline)', () => {
  it('dua kali bake → byte identik (hash semua file)', async () => {
    const a = await hashes(dirA);
    expect(Object.keys(a).sort()).toEqual(['ATTRIBUTION.txt', 'manifest.json', ...first.manifest.terrain.chunks.map((k) => join('terrain', `${k}.bin`))].sort());
    expect(await hashes(dirB)).toEqual(a);
  });

  it('manifest: format distrik, header terrain, chunk urut iz lalu ix, muka air danau', () => {
    const t = first.manifest.terrain;
    expect(first.manifest).toMatchObject({ format: 'unri-district', version: 1, ground: { chunks: [] }, buildings: 'buildings.json', attribution: 'ATTRIBUTION.txt' });
    expect(t).toMatchObject({ format: 'unri-terrain', version: 1, size: 500, step: 4, n: 126, unit: 0.01, bias: -5000 });
    expect(t.chunks).toEqual(['-2_1', '-1_1', '-2_2', '-1_2']);
    expect(t.water).toHaveLength(1);
    expect(t.water[0].id).toBe('w373856980');
    expect(t.water[0].bed).toBeCloseTo(t.water[0].level - TERRAIN.water.depth, 6);
  });

  it('heightfield hasil: 0 tepat di luar batas, bervariasi di dalam, tanjakan jalan ≤ 7% (laporan)', async () => {
    const field = createHeightField();
    for (const key of first.manifest.terrain.chunks) {
      const b = await readFile(join(dirA, 'terrain', `${key}.bin`));
      field.add(decodeChunk(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), { ...first.manifest.terrain, key }));
    }
    let outside = 0;
    let inside = 0;
    for (let x = -1000; x <= -200; x += 10) {
      for (let z = 500; z <= 1300; z += 10) {
        if (!pointInPolygon(x, z, BOUNDARY)) {
          expect(field.heightAt(x, z)).toBe(0);
          outside += 1;
        } else if (Math.abs(field.heightAt(x, z)) > 0.05) inside += 1;
      }
    }
    expect(outside).toBeGreaterThan(1000);
    expect(inside).toBeGreaterThan(500);
    expect(first.report.summary.steep).toBe(0);
    expect(first.report.summary.roads).toBe(2);
  });

  it('ATTRIBUTION menyebut SRTM & OSM', async () => {
    const text = await readFile(join(dirA, 'ATTRIBUTION.txt'), 'utf8');
    expect(text).toContain('SRTM');
    expect(text).toContain('© OpenStreetMap contributors');
  });
});

describe('CLI campusbake', () => {
  it('parseCli: perintah & opsi', () => {
    expect(parseCli(['terrain', '--offline'])).toEqual({ command: 'terrain', offline: true, outDir: 'public/districts/unri', cacheDir: 'data-src' });
    expect(() => parseCli([])).toThrow(/perintah tidak dikenal/);
    expect(() => parseCli(['peta'])).toThrow(/perintah tidak dikenal/);
  });
  it('ground/buildings belum tersedia → exit 2; argumen salah → exit 2', async () => {
    const errors = [];
    const log = { info() {}, warn() {}, error: (m) => errors.push(m) };
    expect(await main(['ground'], log)).toBe(2);
    expect(await main(['--offline'], log)).toBe(2);
    expect(errors[0]).toMatch(/M2\/M3/);
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake/golden.test.js`
Expected: FAIL (`tools/campusbake/cli.js` tidak ada).

- [ ] **Step 3: Implementasi** — `tools/campusbake/terrain/bakeTerrain.js`:

```js
/**
 * Pipeline terrain (spec §5.2): DEM → grid 4 m (bikubik) → median 5×5 → Gaussian σ 20 m → datum →
 * blend ke nol → jalan → pad → air → kuantisasi chunk. Murni: DEM, fitur, batas, mask masuk sebagai data.
 */
import { createProjection } from '../../../src/geo/projection.js';
import { TERRAIN_HEADER } from '../../../src/geo/terrain/format.js';
import { resampleToGrid } from '../dem/resample.js';
import { gaussian2d, median2d } from '../dem/filters.js';
import { applyDatum, boundaryReference } from './datum.js';
import { applyBlend, blendWeights } from './blend.js';
import { conditionRoads } from './roads.js';
import { applyPads } from './pads.js';
import { applyWater } from './water.js';
import { encodeChunks } from './writeChunks.js';
import { gridForRing } from './grid.js';

/**
 * @param {{dem:{lat0:number,lon0:number,size:number,data:Int16Array}, origin:{lat:number,lon:number},
 *   boundary:Array<[number,number]>, mask:Array<[number,number]>|null, roads:object[], pads:object[],
 *   lakes:object[], terrain:object, now?:() => number}} input
 * @returns {{grid:object, data:Float64Array, weights:Float32Array, chunks:Array<{key:string,ix:number,iz:number,buffer:Buffer}>,
 *   header:object, stats:object}}
 */
export function bakeTerrain({ dem, origin, boundary, mask, roads, pads, lakes, terrain, now = () => Date.now() }) {
  const t0 = now();
  const projection = createProjection({ lat0: origin.lat, lon0: origin.lon });
  const grid = gridForRing(boundary, terrain.margin);
  const raw = resampleToGrid(dem, grid, projection);
  const smooth = gaussian2d(median2d(raw, grid.cols, grid.rows, terrain.median), grid.cols, grid.rows, terrain.gaussSigma);
  const hRef = boundaryReference(grid, smooth, boundary, terrain.datumSpacing);
  const weights = blendWeights(grid, { boundary, mask, distance: terrain.blendDistance, maskMargin: terrain.maskBlendMargin });
  const blended = applyBlend(applyDatum(smooth, hRef), weights);
  const road = conditionRoads(grid, blended, weights, roads, {
    ...terrain.road, ditch: { ...terrain.ditch, classes: terrain.ditch.classes },
  });
  const padded = applyPads(grid, road.data, weights, pads, terrain.pad, road.core);
  const water = applyWater(grid, padded.data, weights, lakes, terrain.water);
  const data = water.data;
  for (let i = 0; i < data.length; i += 1) if (!(weights[i] > 0)) data[i] = 0; // di luar distrik: 0 tepat
  const chunks = encodeChunks(grid, data);
  return {
    grid, data, weights, chunks,
    header: { ...TERRAIN_HEADER, chunks: chunks.map((c) => c.key), hRef: Math.round(hRef * 100) / 100, water: water.levels },
    stats: { hRef, roads: road.stats, pads: padded.stats, water: water.levels, ms: now() - t0 },
  };
}
```

`tools/campusbake/report.js`:

```js
/**
 * Laporan bake terrain (spec §5.2 langkah 10): min/max/rerata y di dalam distrik, h_ref, tanjakan maks
 * per jalan (diukur ulang pada grid akhir), jumlah chunk, ukuran byte. Peringatan tidak menggagalkan bake.
 */
import { resamplePolyline, maxGradeOf } from './terrain/roads.js';
import { sampleGrid } from './terrain/grid.js';

const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
/** Toleransi ukur ulang: grid 4 m + bilinear menambah ±1% di tikungan/simpang. */
export const GRADE_TOLERANCE = 0.01;

/**
 * @param {{grid:object, data:Float64Array, weights:Float32Array, chunks:Array<{key:string, buffer:{byteLength:number}}>, stats:object}} baked
 * @param {Array<{id:string, cls:string, line:Array<[number,number]>}>} roads
 * @param {{maxGrade:number, budgetBytes:number}} limits
 * @returns {{lines:string[], warnings:string[], summary:object}}
 */
export function terrainReport(baked, roads, { maxGrade, budgetBytes }) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < baked.data.length; i += 1) {
    if (!(baked.weights[i] > 0)) continue;
    const y = baked.data[i];
    min = Math.min(min, y);
    max = Math.max(max, y);
    sum += y;
    count += 1;
  }
  const grades = roads.map((r) => {
    const { pts, s } = resamplePolyline(r.line, baked.grid.step);
    const inside = pts.map(([x, z]) => sampleGrid(baked.grid, baked.weights, x, z) > 0);
    const values = pts.map(([x, z]) => sampleGrid(baked.grid, baked.data, x, z));
    return { id: r.id, cls: r.cls, grade: inside.some(Boolean) ? maxGradeOf(values, s) : 0 };
  }).sort((a, b) => b.grade - a.grade || (a.id < b.id ? -1 : 1));
  const bytes = baked.chunks.reduce((s, c) => s + c.buffer.byteLength, 0);
  const steep = grades.filter((g) => g.grade > maxGrade + GRADE_TOLERANCE);
  const summary = {
    min: count ? min : 0, max: count ? max : 0, mean: count ? sum / count : 0, hRef: baked.stats.hRef,
    chunks: baked.chunks.length, bytes, roads: grades.length, steep: steep.length, ms: baked.stats.ms,
  };
  const lines = [
    `Terrain: ${summary.chunks} chunk, ${kb(bytes)}, h_ref ${summary.hRef.toFixed(2)} m, ${(summary.ms / 1000).toFixed(1)} s`,
    `  y di distrik: min ${summary.min.toFixed(2)} m, maks ${summary.max.toFixed(2)} m, rerata ${summary.mean.toFixed(2)} m`,
    `  Jalan: ${grades.length}, tanjakan > ${((maxGrade + GRADE_TOLERANCE) * 100).toFixed(0)}%: ${steep.length}`,
    ...grades.slice(0, 8).map((g) => `    ${g.id.padEnd(12)} ${g.cls.padEnd(14)} ${(g.grade * 100).toFixed(2)}%`),
    ...baked.stats.water.map((w) => `  Air ${w.id} (${w.name ?? '-'}): muka ${w.level} m, dasar ${w.bed} m`),
  ];
  const warnings = [];
  if (bytes > budgetBytes) warnings.push(`terrain ${kb(bytes)} > anggaran ${kb(budgetBytes)}`);
  for (const g of steep.slice(0, 10)) warnings.push(`jalan ${g.id} (${g.cls}) tanjakan ${(g.grade * 100).toFixed(1)}% setelah pad/air`);
  return { lines, warnings, summary };
}
```

`tools/campusbake/manifest.js`:

```js
/**
 * manifest.json & ATTRIBUTION.txt distrik UNRI (index M1: `{ format:'unri-district', version:1,
 * terrain:{…format.js…, chunks:[key…]}, ground:{chunks:[…]}, buildings:'buildings.json',
 * attribution:'ATTRIBUTION.txt' }`). Murni; I/O di cli.js. Bagian lain (ground/buildings) milik M2/M3 dan
 * dipertahankan saat terrain di-bake ulang.
 */
export const MANIFEST_FILE = 'manifest.json';
export const ATTRIBUTION_FILE = 'ATTRIBUTION.txt';
export const DISTRICT_FORMAT = 'unri-district';
export const DISTRICT_VERSION = 1;

/** Manifest kosong. */
export function emptyManifest() {
  return {
    format: DISTRICT_FORMAT, version: DISTRICT_VERSION, terrain: null, ground: { chunks: [] },
    buildings: 'buildings.json', attribution: ATTRIBUTION_FILE,
  };
}

/** Ganti bagian terrain (objek baru); manifest lama berformat lain → galat jelas. */
export function withTerrain(existing, terrain) {
  const base = existing ?? emptyManifest();
  if (base.format !== DISTRICT_FORMAT || base.version !== DISTRICT_VERSION) {
    throw new Error(`manifest distrik lama berformat ${base.format}/${base.version} — hapus ${MANIFEST_FILE} lalu bake ulang`);
  }
  return { ...base, terrain };
}

/** Isi ATTRIBUTION.txt. */
export function attributionText({ srtm, osmTimestamp }) {
  return [
    'Data distrik Kampus UNRI Bina Widya di direktori ini adalah karya turunan dari:',
    '',
    `  ${srtm.attribution}`,
    `    ${srtm.url}`,
    '    Shuttle Radar Topography Mission (Februari 2000) — domain publik, disebut sebagai sumber.',
    '  © OpenStreetMap contributors — https://www.openstreetmap.org/copyright',
    `    (batas kampus, jalan, gedung, danau; data ${osmTimestamp ?? 'waktu tidak diketahui'})`,
    '',
    'Lisensi data OSM: Open Database License (ODbL) 1.0 — https://opendatacommons.org/licenses/odbl/1-0/',
    'File terrain/*.bin dibentuk dengan geometri OSM (pengondisian jalan, pad gedung, danau) sehingga tunduk',
    'pada ODbL; kode proyek tetap berlisensi MIT.',
    '',
    'Dihasilkan oleh tools/campusbake (npm run bake:campus -- terrain).',
    '',
  ].join('\n');
}
```

`tools/campusbake/cli.js`:

```js
/**
 * CLI campusbake:
 *   npm run bake:campus -- boundary [--offline]          → tulis src/districts/unri/boundary.js
 *   npm run bake:campus -- terrain|all [--offline]        → public/districts/unri/{manifest.json, terrain/*.bin, ATTRIBUTION.txt}
 *   npm run bake:campus -- ground|buildings              → dibuat di M2/M3 (sekarang: galat jelas, exit 2)
 * Opsi: --out <dir> (default public/districts/unri), --cache <dir> (default data-src).
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import {
  BOUNDARY, BUDGET, CAMPUS_OSM, ORIGIN, PATHS, REGION_PADS, ROAD_WIDTHS, SRTM, STADION_MASK_WORLD, TERRAIN,
} from './config.js';
import { loadSrtm } from './dem/fetchSrtm.js';
import { readHgt } from './dem/readHgt.js';
import {
  campusBuildingPads, campusFeatures, campusLakes, campusRing, campusRoads, loadCampusOsm,
} from './osm.js';
import { boundaryModuleSource, computeBoundary } from './boundary.js';
import { bakeTerrain } from './terrain/bakeTerrain.js';
import { terrainReport } from './report.js';
import { ATTRIBUTION_FILE, MANIFEST_FILE, attributionText, withTerrain } from './manifest.js';

export const COMMANDS = Object.freeze(['boundary', 'terrain', 'ground', 'buildings', 'all']);
export const USAGE = `Pakai: npm run bake:campus -- <${COMMANDS.join('|')}> [--offline] [--out <dir>] [--cache <dir>]`;

/** @returns {{command:string, offline:boolean, outDir:string, cacheDir:string}} */
export function parseCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      offline: { type: 'boolean', default: false },
      out: { type: 'string', default: PATHS.outDir },
      cache: { type: 'string', default: PATHS.cacheDir },
    },
    strict: true,
  });
  const [command] = positionals;
  if (!command || positionals.length !== 1 || !COMMANDS.includes(command)) {
    throw new Error(`perintah tidak dikenal: ${JSON.stringify(positionals.join(' '))}. ${USAGE}`);
  }
  return { command, offline: values.offline, outDir: values.out, cacheDir: values.cache };
}

const defaultLoaders = {
  dem: (opts) => loadSrtm(SRTM, opts),
  osm: (opts) => loadCampusOsm(CAMPUS_OSM, opts),
};

/** Batas distrik dari OSM (perintah `boundary`). @returns {Promise<{source:string, result:object}>} */
export async function runBoundary({ cacheDir, offline, log = console, loaders = defaultLoaders, mask = STADION_MASK_WORLD }) {
  const { timestamp, features } = campusFeatures(await loaders.osm({ cacheDir, offline, log }), ORIGIN);
  const result = computeBoundary({
    campusRing: campusRing(features, CAMPUS_OSM.wayId), maskRing: mask,
    maskMargin: BOUNDARY.maskMargin, tolerance: BOUNDARY.simplify, segments: BOUNDARY.circleSegments,
  });
  const source = boundaryModuleSource(result, {
    osmTimestamp: timestamp, wayId: CAMPUS_OSM.wayId, maskMargin: BOUNDARY.maskMargin, tolerance: BOUNDARY.simplify,
  });
  return { source, result };
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`${path} rusak: ${err.message}`, { cause: err });
  }
}

/** Batas distrik default: modul hasil `boundary` (impor dinamis agar `boundary` tetap jalan sebelum file ada). */
async function defaultBoundary() {
  const url = pathToFileURL(resolve(PATHS.boundaryModule)).href;
  try {
    return (await import(url)).UNRI_BOUNDARY;
  } catch (err) {
    throw new Error(`${PATHS.boundaryModule} belum ada — jalankan dulu: npm run bake:campus -- boundary`, { cause: err });
  }
}

/**
 * Bake terrain → tulis chunk, manifest (bagian terrain), atribusi. Chunk lama yang tidak lagi dibuat dihapus.
 * @returns {Promise<{manifest:object, report:{lines:string[], warnings:string[], summary:object}}>}
 */
export async function runTerrain({
  outDir, cacheDir, offline, log = console, loaders = defaultLoaders, boundary = null, mask = STADION_MASK_WORLD,
  terrain = TERRAIN, regionPads = REGION_PADS, srtm = SRTM, now = () => Date.now(),
}) {
  const ring = boundary ?? await defaultBoundary();
  const dem = readHgt(await loaders.dem({ cacheDir, offline, log }), srtm.tile);
  const { timestamp, features } = campusFeatures(await loaders.osm({ cacheDir, offline, log }), ORIGIN);
  const roads = campusRoads(features, ring, ROAD_WIDTHS, terrain.road.skip);
  const pads = [...campusBuildingPads(features, ring), ...regionPads];
  const { lakes, missing } = campusLakes(features, terrain.water.lakes);
  const baked = bakeTerrain({ dem, origin: ORIGIN, boundary: ring, mask, roads, pads, lakes, terrain, now });
  const dir = join(outDir, 'terrain');
  await mkdir(dir, { recursive: true });
  const fresh = new Set(baked.chunks.map((c) => `${c.key}.bin`));
  for (const old of await readdir(dir)) if (old.endsWith('.bin') && !fresh.has(old)) await rm(join(dir, old));
  for (const c of baked.chunks) await writeFile(join(dir, `${c.key}.bin`), c.buffer);
  const manifest = withTerrain(await readJson(join(outDir, MANIFEST_FILE)), baked.header);
  await writeFile(join(outDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(outDir, ATTRIBUTION_FILE), attributionText({ srtm, osmTimestamp: timestamp }));
  const report = terrainReport(baked, roads, { maxGrade: terrain.road.maxGrade, budgetBytes: BUDGET.terrainBytes });
  for (const id of missing) report.warnings.push(`danau ${id} tidak ada di cache OSM (dilewati)`);
  return { manifest, report };
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
  if (opts.command === 'ground' || opts.command === 'buildings') {
    log.error(`perintah "${opts.command}" belum tersedia (dibuat di M2/M3). ${USAGE}`);
    return 2;
  }
  try {
    if (opts.command === 'boundary') {
      const { source, result } = await runBoundary({ ...opts, log });
      await writeFile(PATHS.boundaryModule, source);
      log.info(`Batas distrik: ${result.ring.length} titik, ${Math.round(result.area)} m² (kampus ${Math.round(result.campusArea)} m², `
        + `${result.pieces} potongan, dibuang ${Math.round(result.droppedArea)} m²) → ${PATHS.boundaryModule}`);
      return 0;
    }
    const { report } = await runTerrain({ ...opts, log });
    for (const line of report.lines) log.info(line);
    for (const w of report.warnings) log.warn(`PERINGATAN: ${w}`);
    if (opts.command === 'all') log.info('Catatan: ground (M2) dan buildings (M3) belum tersedia; hanya terrain yang di-bake.');
    return 0;
  } catch (err) {
    log.error(`[campusbake] gagal: ${err.message}`);
    return 1;
  }
}
```

`tools/campusbake/index.js`:

```js
#!/usr/bin/env node
/** Entry CLI: `npm run bake:campus -- <boundary|terrain|ground|buildings|all> [--offline]` (lihat cli.js). */
import process from 'node:process';
import { main } from './cli.js';

process.exitCode = await main(process.argv.slice(2));
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake`
Expected: PASS — 4 berkas, `Tests  46 passed (46)` (dem 14, terrainStages 18, boundary 8, golden 6).

- [ ] **Step 5: Lint & commit**

Run: `npm run lint` → 0 galat.

```bash
git add tools/campusbake/terrain/bakeTerrain.js tools/campusbake/report.js tools/campusbake/manifest.js tools/campusbake/cli.js tools/campusbake/index.js tests/campusbake/golden.test.js
```
```bash
git commit -m "feat(campusbake): pipeline terrain + laporan + manifest distrik + CLI bake:campus, golden byte-identik"
```

---

### Task 8: Bake nyata — batas distrik, terrain, determinisme, paritas stadion

**Files:**
- Create (hasil): `src/districts/unri/boundary.js`, `public/districts/unri/manifest.json`, `public/districts/unri/ATTRIBUTION.txt`, `public/districts/unri/terrain/*.bin`
- Test: `tests/campusbake/terrainData.test.js`

- [ ] **Step 1: Batas distrik (online sekali: Overpass)**

Run:
```bash
npm run bake:campus -- boundary
```
Expected (angka bisa sedikit berbeda bila OSM berubah): `[citybake] mengambil OSM "unri-kampus" dari Overpass…` lalu `Batas distrik: 70 titik, 2398439 m² (kampus 2435156 m², 1 potongan, dibuang 0 m²) → src/districts/unri/boundary.js`. Syarat lulus: **1 potongan**, luas 2,30–2,50 juta m², 20–150 titik. Bila Overpass gagal 5×: ulangi beberapa menit kemudian (cache baru ditulis setelah sukses). Ulangi `npm run bake:campus -- boundary --offline` → berkas identik (`git diff --stat` kosong setelah run kedua).

- [ ] **Step 2: Terrain (online sekali: SRTM)**

Run:
```bash
npm run bake:campus -- terrain
```
Expected: `[campusbake] mengunduh SRTM N00E101 dari https://s3.amazonaws.com/elevation-tiles-prod/skadi/N00/N00E101.hgt.gz…`, lalu laporan seperti:
```
Terrain: 21 chunk, 651.2 KB, h_ref 32.49 m, 9.0 s
  y di distrik: min -7.58 m, maks 9.07 m, rerata 0.79 m
  Jalan: 194, tanjakan > 7%: 0
```
Syarat lulus: 15–40 chunk, ≤ 3 MB, `tanjakan > 7%: 0` (beberapa PERINGATAN boleh muncul bila OSM terbaru menambah jalan — catat di laporan task, jangan ubah parameter). Bila unduhan gagal: ikuti langkah manual yang dicetak (curl + gzip -d ke `data-src/dem/srtm/N00E101.hgt`), lalu `npm run bake:campus -- terrain --offline`.

- [ ] **Step 3: Determinisme (golden data nyata)**

Run:
```bash
sha256sum public/districts/unri/manifest.json public/districts/unri/terrain/*.bin > /tmp/m1-hash-1.txt
npm run bake:campus -- terrain --offline
sha256sum public/districts/unri/manifest.json public/districts/unri/terrain/*.bin > /tmp/m1-hash-2.txt
diff /tmp/m1-hash-1.txt /tmp/m1-hash-2.txt && echo IDENTIK
```
Expected: `IDENTIK`.

- [ ] **Step 4: Tes data hasil bake (paritas stadion)**

Tulis `tests/campusbake/terrainData.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { decodeChunk, createHeightField } from '../../src/geo/terrain/heightfield.js';
import { validateDistrictManifest } from '../../src/districts/unri/index.js';
import { stadionMaskWorld } from '../../src/regions/stadion/mask.js';
import { distanceToRing, pointInPolygon } from '../../src/geo/polygon.js';
import { UNRI_BOUNDARY } from '../../src/districts/unri/boundary.js';

/** Data terrain HASIL BAKE yang di-commit (public/districts/unri): paritas stadion & batas wajar. */
const DIR = new URL('../../public/districts/unri/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', DIR), 'utf8'));
const header = validateDistrictManifest(manifest);
const field = createHeightField();
let bytes = 0;
for (const key of header.chunks) {
  const b = readFileSync(new URL(`terrain/${key}.bin`, DIR));
  bytes += b.byteLength;
  field.add(decodeChunk(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), { ...header, key }));
}

describe('data terrain UNRI (bake nyata)', () => {
  it('manifest valid; 15–40 chunk; ≤ 3 MB; berkas = n²·2 byte', () => {
    expect(header.chunks.length).toBeGreaterThanOrEqual(15);
    expect(header.chunks.length).toBeLessThanOrEqual(40);
    expect(bytes).toBe(header.chunks.length * 126 * 126 * 2);
    expect(bytes).toBeLessThanOrEqual(3 * 1024 * 1024);
    expect(statSync(new URL('ATTRIBUTION.txt', DIR)).size).toBeGreaterThan(100);
  });

  it('PARITAS STADION: heightAt = 0 tepat di mask stadion + 60 m (grid 4 m)', () => {
    const mask = stadionMaskWorld();
    let n = 0;
    for (let x = -330; x <= 330; x += 4) {
      for (let z = -510; z <= 400; z += 4) {
        if (!pointInPolygon(x, z, mask) && distanceToRing(x, z, mask) > 60) continue;
        expect(field.heightAt(x, z)).toBe(0);
        n += 1;
      }
    }
    expect(n).toBeGreaterThan(20000);
  });

  it('0 tepat di luar batas distrik; relief di dalam wajar (−12…+15 m)', () => {
    let inside = 0;
    for (let x = -1700; x <= 500; x += 20) {
      for (let z = -500; z <= 2200; z += 20) {
        const y = field.heightAt(x, z);
        if (!pointInPolygon(x, z, UNRI_BOUNDARY)) {
          expect(y).toBe(0);
        } else {
          expect(y).toBeGreaterThan(-12);
          expect(y).toBeLessThan(15);
          inside += 1;
        }
      }
    }
    expect(inside).toBeGreaterThan(5000);
  });

  it('muka air Danau Buatan & Waduk tercatat (untuk mesh air M2)', () => {
    expect(header.water.map((w) => w.id).sort()).toEqual(['w327366050', 'w373856980']);
    for (const w of header.water) expect(w.bed).toBeLessThan(w.level);
  });
});
```

Catatan: tes ini mengimpor `src/districts/unri/index.js` (`validateDistrictManifest`) yang dibuat di Task 13 — tulis berkasnya sekarang, jalankan setelah Task 13. Sampai saat itu jalankan hanya pemeriksaan cepat:
```bash
node -e "const m=require('./public/districts/unri/manifest.json');console.log(m.format,m.version,m.terrain.n,m.terrain.chunks.length,JSON.stringify(m.terrain.water.map(w=>w.id)))"
```
Expected: `unri-district 1 126 21 ["w373856980","w327366050"]` (jumlah chunk 15–40).

- [ ] **Step 5: Commit hasil bake**

```bash
git add src/districts/unri/boundary.js public/districts/unri tests/campusbake/terrainData.test.js
```
```bash
git commit -m "feat(data): batas distrik UNRI (OSM 938374562 − mask stadion + 40 m) dan terrain SRTM 21 chunk"
```

---

### Task 9: `terrainService` nyata

**Files:**
- Modify: `src/app/terrainService.js` (ganti seluruh isi stub M0; ekspor sama)
- Test: `tests/terrainServiceReal.test.js`

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect } from 'vitest';
import { createTerrainService, FLAT_TERRAIN } from '../src/app/terrainService.js';
import { decodeChunk } from '../src/geo/terrain/heightfield.js';
import { TERRAIN_HEADER, N, BIAS, UNIT } from '../src/geo/terrain/format.js';

const chunk = (key, y) => {
  const buf = new ArrayBuffer(N * N * 2);
  const v = new DataView(buf);
  for (let i = 0; i < N * N; i += 1) v.setUint16(i * 2, Math.round(y / UNIT) - BIAS, true);
  return decodeChunk(buf, { ...TERRAIN_HEADER, key });
};

describe('terrainService nyata (M1)', () => {
  it('kosong = datar (paritas stub M0)', () => {
    const t = createTerrainService();
    expect(t.heightAt(0, 0)).toBe(0);
    expect(t.gradeAlong(0, 0, 1)).toBe(0);
    expect(t.normalAt(0, 0)).toEqual({ x: -0, y: 1, z: -0 });
    expect(t.version).toBe(0);
  });
  it('heightAt/version mengikuti HeightField field yang sama', () => {
    const t = createTerrainService();
    t.field.add(chunk('-1_2', 2.5));
    expect(t.heightAt(-250, 1250)).toBeCloseTo(2.5, 6);
    expect(t.version).toBe(1);
    t.field.remove('-1_2');
    expect(t.heightAt(-250, 1250)).toBe(0);
    expect(t.version).toBe(2);
  });
  it('FLAT_TERRAIN beku: normalAt menulis ke out', () => {
    const out = { x: 9, y: 9, z: 9 };
    expect(FLAT_TERRAIN.normalAt(1, 2, out)).toBe(out);
    expect(out).toEqual({ x: 0, y: 1, z: 0 });
    expect(Object.isFrozen(FLAT_TERRAIN)).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/terrainServiceReal.test.js`
Expected: FAIL pada tes kedua (stub M0: `field` bukan HeightField, `field.add` tidak ada atau heightAt tetap 0).

- [ ] **Step 3: Implementasi** — ganti seluruh isi `src/app/terrainService.js`:

```js
/**
 * Layanan terrain global (spec §4.1): satu HeightField yang disuntikkan sebagai `ctx.terrain` ke sistem,
 * region, distrik, entitas. M0 membuat stub datar; M1 mengisi dengan HeightField nyata tanpa mengubah
 * ekspor. Di luar chunk distrik heightAt = 0 sehingga stadion & tile kota tidak berubah perilakunya.
 */
import { createHeightField } from '../geo/terrain/heightfield.js';

/** Terrain datar (default ctx region/tes): heightAt 0, normal +Y, grade 0. */
export const FLAT_TERRAIN = Object.freeze({
  heightAt: () => 0,
  normalAt: (x, z, out = { x: 0, y: 1, z: 0 }) => {
    out.x = 0;
    out.y = 1;
    out.z = 0;
    return out;
  },
  gradeAlong: () => 0,
  version: 0,
});

/**
 * @param {{field?: ReturnType<typeof createHeightField>}} [opts]
 * @returns {{field: ReturnType<typeof createHeightField>, heightAt(x:number, z:number):number,
 *   normalAt(x:number, z:number, out?:object):{x:number,y:number,z:number}, gradeAlong(x:number, z:number, yaw:number):number,
 *   readonly version:number}}
 */
export function createTerrainService({ field = createHeightField() } = {}) {
  return Object.freeze({
    field,
    heightAt: (x, z) => field.heightAt(x, z),
    normalAt: (x, z, out) => field.normalAt(x, z, out),
    gradeAlong: (x, z, yaw) => field.gradeAlong(x, z, yaw),
    get version() { return field.version; },
  });
}
```

- [ ] **Step 4: Jalankan — lulus (termasuk tes stub M0)**

Run: `node node_modules/vitest/vitest.mjs run tests/terrainServiceReal.test.js tests/mountRegion.test.js`
Expected: PASS semua. Tes M0 untuk stub (`tests/terrainService.test.js` bila ada) juga dijalankan: `node node_modules/vitest/vitest.mjs run tests/terrainService.test.js` → PASS (layanan kosong = datar). Bila tes M0 memeriksa `field === FLAT_TERRAIN` atau sejenis: ubah asersi itu menjadi "`field.heightAt(…) === 0` dan `typeof field.add === 'function'`" dan catat sebagai asersi lama yang sengaja diubah.

- [ ] **Step 5: Commit**

```bash
git add src/app/terrainService.js tests/terrainServiceReal.test.js
```
```bash
git commit -m "feat(app): terrainService memakai HeightField nyata (ekspor tetap)"
```

---

### Task 10: `TerrainMesh` — LOD0/LOD1, skirt, normal dari heightfield (TDD)

**Files:**
- Create: `src/world/terrain/TerrainMesh.js`
- Test: `tests/world/terrainMesh.test.js`

Angka: LOD0 126² + 4·125·2 simpul skirt, 125²·2 + 4·125·2 segitiga; LOD1 simpul 0,4,…,124,125 → 33² + 4·32·2, 32²·2 + 4·32·2; generator LOD0 memberi 8 titik potong (7 tiap 16 baris + 1 sebelum skirt). renderOrder −3,5: sesudah tanah dasar kota (−4), sebelum landuse/air/jalan kota (−3/−2/−1) sehingga lapisan datar kota di luar distrik tetap di atas terrain y = 0; polygonOffset terrain (1, 1) memenangkan lapisan kota saat sejajar.

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildTerrainChunkMesh, buildTerrainChunkMeshSteps, lodIndices, createTerrainMaterial, TERRAIN_MESH,
} from '../../src/world/terrain/TerrainMesh.js';
import { decodeChunk, createHeightField } from '../../src/geo/terrain/heightfield.js';
import { TERRAIN_HEADER, N, BIAS, UNIT } from '../../src/geo/terrain/format.js';

function chunkOf(key, fn) {
  const buf = new ArrayBuffer(N * N * 2);
  const view = new DataView(buf);
  for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) view.setUint16((r * N + c) * 2, Math.round(fn(r, c) / UNIT) - BIAS, true);
  return decodeChunk(buf, { ...TERRAIN_HEADER, key });
}
const materials = { terrain: new THREE.MeshBasicMaterial() };
const triangles = (mesh) => mesh.geometry.index.count / 3;
const vertices = (mesh) => mesh.geometry.attributes.position.count;

describe('lodIndices', () => {
  it('LOD0 = 126 simpul, LOD1 = 0,4,…,124,125 (33 simpul)', () => {
    expect(lodIndices(126, 0)).toHaveLength(126);
    const l1 = lodIndices(126, 1);
    expect(l1).toHaveLength(33);
    expect(l1.slice(0, 3)).toEqual([0, 4, 8]);
    expect(l1.slice(-2)).toEqual([124, 125]);
  });
});

describe('buildTerrainChunkMesh', () => {
  const flat = chunkOf('-1_2', () => 1.5);

  it('LOD0 penuh: 126² simpul + 1.000 skirt, 31.250 + 1.000 segitiga, di origin chunk', () => {
    const mesh = buildTerrainChunkMesh(flat, null, { lod: 0, materials });
    expect(vertices(mesh)).toBe(126 * 126 + 4 * 125 * 2);
    expect(triangles(mesh)).toBe(125 * 125 * 2 + 4 * 125 * 2);
    expect(mesh.position.toArray()).toEqual([-500, 0, 1000]);
    expect(mesh.renderOrder).toBe(TERRAIN_MESH.renderOrder);
    expect(mesh.name).toBe('terrain:-1_2:lod0');
    expect(mesh.geometry.index.array).toBeInstanceOf(Uint16Array);
  });

  it('LOD1: 33² simpul + 256 skirt, 2.048 + 256 segitiga', () => {
    const mesh = buildTerrainChunkMesh(flat, null, { lod: 1, materials });
    expect(vertices(mesh)).toBe(33 * 33 + 4 * 32 * 2);
    expect(triangles(mesh)).toBe(32 * 32 * 2 + 4 * 32 * 2);
  });

  it('y simpul = data chunk; skirt 2 m di bawah tepi; UV = meter dunia', () => {
    const slope = chunkOf('0_0', (r, c) => 0.05 * c * 4);
    const mesh = buildTerrainChunkMesh(slope, null, { lod: 0, materials });
    const p = mesh.geometry.attributes.position;
    expect(p.getY(10)).toBeCloseTo(2, 2); // c = 10 → x 40 m → 2 m
    expect(p.getY(126 * 126)).toBeCloseTo(p.getY(0) - 2, 5); // simpul skirt pertama = salinan simpul 0 − 2 m
    const uv = mesh.geometry.attributes.uv;
    expect([uv.getX(127), uv.getY(127)]).toEqual([4, 4]);
  });

  it('normal bidang miring 5% ke timur = (−0,0499, 0,9988, 0)', () => {
    const slope = chunkOf('0_0', (r, c) => 0.05 * c * 4);
    const n = buildTerrainChunkMesh(slope, null, { lod: 0, materials }).geometry.attributes.normal;
    const k = 60 * 126 + 60;
    expect(n.getX(k)).toBeCloseTo(-0.05 / Math.hypot(0.05, 1), 3);
    expect(n.getY(k)).toBeCloseTo(1 / Math.hypot(0.05, 1), 3);
    expect(n.getZ(k)).toBeCloseTo(0, 6);
  });

  it('normal tepi timur memakai chunk tetangga dari HeightField bila termuat', () => {
    const field = createHeightField();
    const a = chunkOf('0_0', () => 0);
    field.add(a);
    field.add(chunkOf('1_0', (r, c) => 0.1 * c * 4)); // tetangga timur naik 10%
    const n = buildTerrainChunkMesh(a, field, { lod: 0, materials }).geometry.attributes.normal;
    const edge = 60 * 126 + 125; // simpul tepi timur
    expect(n.getX(edge)).toBeLessThan(-0.04); // (H(c+1) − H(c−1)) / 8 = 0,4/8 = 0,05 → miring
    const noField = buildTerrainChunkMesh(a, null, { lod: 0, materials }).geometry.attributes.normal;
    expect(noField.getX(edge)).toBeCloseTo(0, 6);
  });

  it('cellInside membatasi sel: kolom < 10 saja → 2.500 + 290 segitiga', () => {
    const mesh = buildTerrainChunkMesh(flat, null, { lod: 0, materials, cellInside: (r, c) => c < 10 });
    // skirt: utara 10 + selatan 10 + barat 125 segmen (timur tidak) = 145 × 2
    expect(triangles(mesh)).toBe(125 * 10 * 2 + 145 * 2);
  });

  it('tanpa sel di dalam → null; generator memberi titik potong (8 untuk LOD0)', () => {
    expect(buildTerrainChunkMesh(flat, null, { lod: 0, materials, cellInside: () => false })).toBeNull();
    const it = buildTerrainChunkMeshSteps(flat, null, { lod: 0, materials });
    let yields = 0;
    for (let r = it.next(); !r.done; r = it.next()) yields += 1;
    expect(yields).toBe(8);
  });

  it('createTerrainMaterial: rumput bertekstur dengan polygonOffset', () => {
    const mat = createTerrainMaterial();
    expect(mat.name).toBe('terrain');
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBe(1);
    expect(mat.map).toBeTruthy();
    mat.dispose();
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/world/terrainMesh.test.js`
Expected: FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi**

```js
/**
 * Mesh terrain per chunk (spec §5.3): LOD0 grid 4 m (126² simpul), LOD1 16 m, skirt 2 m ke bawah di tepi
 * chunk, normal dari heightfield (beda pusat pada data penuh; tetangga lewat HeightField bila termuat)
 * agar mulus antar chunk. Hanya sel yang `cellInside` (sel di dalam batas distrik) yang digambar — sel
 * yang sama dengan lubang tanah dasar kota. UV = meter dunia (repeat tekstur dari surfaceMaps).
 * `buildTerrainChunkMeshSteps` = generator (tiap `yield` titik potong scheduler); `buildTerrainChunkMesh`
 * menjalankannya sampai selesai.
 */
import * as THREE from 'three';
import { sampleAt } from '../../geo/terrain/heightfield.js';
import { tileKey } from '../../geo/tiles.js';
import { surfaceMaterial } from '../Ground.materials.js';

export const TERRAIN_MESH = Object.freeze({
  lod1Stride: 4,        // LOD1 = setiap simpul ke-4 (16 m)
  skirt: 2,             // m ke bawah di tepi chunk
  rowsPerSlice: 16,     // baris simpul per potongan scheduler
  renderOrder: -3.5,    // setelah tanah dasar kota (−4), sebelum landuse/air/jalan kota (−3/−2/−1)
  color: 0xd9e4b8,      // pengali warna tekstur rumput (sedikit lebih kering dari rumput stadion)
});

/** Indeks simpul per LOD: LOD0 0..n−1; LOD1 0, 4, …, 124, 125. */
export function lodIndices(n, lod) {
  const stride = lod === 0 ? 1 : TERRAIN_MESH.lod1Stride;
  const out = [];
  for (let i = 0; i < n - 1; i += stride) out.push(i);
  out.push(n - 1);
  return out;
}

/** Tinggi simpul (r, c) chunk; di luar chunk → HeightField bila chunk tetangga termuat, selain itu clamp. */
function heightSampler(chunk, field) {
  const last = chunk.n - 1;
  return (r, c) => {
    if (r >= 0 && r <= last && c >= 0 && c <= last) return sampleAt(chunk, r, c);
    const x = chunk.origin.x + c * chunk.step;
    const z = chunk.origin.z + r * chunk.step;
    if (field?.has(tileKey(Math.floor(x / chunk.size), Math.floor(z / chunk.size)))) return field.heightAt(x, z);
    return sampleAt(chunk, Math.min(last, Math.max(0, r)), Math.min(last, Math.max(0, c)));
  };
}

/** Sel LOD (i, j) digambar bila salah satu sel LOD0 di dalamnya ada di dalam batas. */
function lodCellInside(idx, i, j, cellInside) {
  for (let r = idx[i]; r < idx[i + 1]; r += 1) {
    for (let c = idx[j]; c < idx[j + 1]; c += 1) if (cellInside(r, c)) return true;
  }
  return false;
}

/**
 * @param {{key:string, origin:{x:number,z:number}, n:number, step:number, size:number, data:Uint16Array}} chunk
 * @param {{has(key:string):boolean, heightAt(x:number,z:number):number}|null} field
 * @param {{lod:0|1, materials:{terrain:THREE.Material}, cellInside?:(r:number, c:number) => boolean}} opts
 * @returns {Generator<void, THREE.Mesh|null>} null bila tidak ada sel yang digambar
 */
export function* buildTerrainChunkMeshSteps(chunk, field, { lod, materials, cellInside = () => true }) {
  const idx = lodIndices(chunk.n, lod);
  const m = idx.length;
  const H = heightSampler(chunk, field);
  const step = chunk.step;
  const pos = [];
  const nor = [];
  const uv = [];
  for (let i = 0; i < m; i += 1) {
    const r = idx[i];
    for (let j = 0; j < m; j += 1) {
      const c = idx[j];
      pos.push(c * step, H(r, c), r * step);
      const sx = (H(r, c + 1) - H(r, c - 1)) / (2 * step);
      const sz = (H(r + 1, c) - H(r - 1, c)) / (2 * step);
      const len = Math.hypot(sx, 1, sz);
      nor.push(-sx / len, 1 / len, -sz / len);
      uv.push(chunk.origin.x + c * step, chunk.origin.z + r * step);
    }
    if ((i + 1) % TERRAIN_MESH.rowsPerSlice === 0) yield;
  }
  const inside = new Uint8Array((m - 1) * (m - 1));
  const index = [];
  for (let i = 0; i < m - 1; i += 1) {
    for (let j = 0; j < m - 1; j += 1) {
      if (!lodCellInside(idx, i, j, cellInside)) continue;
      inside[i * (m - 1) + j] = 1;
      const a = i * m + j;
      const b = a + 1;
      const c = a + m;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  if (index.length === 0) return null;
  yield;
  addSkirts({ m, inside, pos, nor, uv, index });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, materials.terrain);
  mesh.name = `terrain:${chunk.key}:lod${lod}`;
  mesh.position.set(chunk.origin.x, 0, chunk.origin.z);
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false; // statis (pola freezeStatic): matriks dunia dihitung sekali saat dipasang
  mesh.renderOrder = TERRAIN_MESH.renderOrder;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.lod = lod;
  return mesh;
}

/** Jalankan generator sampai selesai (tes, fallback datar). */
export function buildTerrainChunkMesh(chunk, field, opts) {
  const it = buildTerrainChunkMeshSteps(chunk, field, opts);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}

/**
 * Skirt vertikal `TERRAIN_MESH.skirt` m di tepi chunk, hanya di sisi sel yang digambar.
 * Simpul bawah = salinan simpul tepi (normal & UV sama) diturunkan; urutan segitiga menghadap ke luar.
 */
function addSkirts({ m, inside, pos, nor, uv, index }) {
  const drop = (v) => {
    const k = pos.length / 3;
    pos.push(pos[v * 3], pos[v * 3 + 1] - TERRAIN_MESH.skirt, pos[v * 3 + 2]);
    nor.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
    uv.push(uv[v * 2], uv[v * 2 + 1]);
    return k;
  };
  const cell = (i, j) => inside[i * (m - 1) + j] === 1;
  // [A, B] = dua simpul tepi berurutan; outward=true → segitiga (A, B, A') menghadap ke luar.
  const strip = (A, B, outwardAB) => {
    const a2 = drop(A);
    const b2 = drop(B);
    if (outwardAB) index.push(A, B, a2, B, b2, a2);
    else index.push(A, a2, B, B, a2, b2);
  };
  for (let j = 0; j < m - 1; j += 1) {
    if (cell(0, j)) strip(j, j + 1, true); // utara (−z)
    if (cell(m - 2, j)) strip((m - 1) * m + j, (m - 1) * m + j + 1, false); // selatan (+z)
  }
  for (let i = 0; i < m - 1; i += 1) {
    if (cell(i, 0)) strip(i * m, (i + 1) * m, false); // barat (−x)
    if (cell(i, m - 2)) strip(i * m + m - 1, (i + 1) * m + m - 1, true); // timur (+x)
  }
}

/** Material terrain bersama (rumput bertekstur, polygonOffset agar lapisan datar kota menang saat sejajar). */
export function createTerrainMaterial() {
  const mat = surfaceMaterial('grass', { color: TERRAIN_MESH.color });
  mat.name = 'terrain';
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  return mat;
}
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/world/terrainMesh.test.js`
Expected: PASS — `Tests  9 passed (9)`.

- [ ] **Step 5: Commit**

```bash
git add src/world/terrain/TerrainMesh.js tests/world/terrainMesh.test.js
```
```bash
git commit -m "feat(world): mesh terrain per chunk LOD0/LOD1 + skirt, normal dari heightfield, sel di dalam batas saja"
```

---

### Task 11: Kontrak distrik `District.js` (TDD)

**Files:**
- Create: `src/districts/District.js`
- Test: `tests/districts/district.test.js`

Orientasi `boundary`: spec menulis "satu ring CCW"; di kode = **luas bertanda positif** pada bidang (x, z) (`orientRing(ring, true)`, CCW secara matematis; tampak searah jarum jam dari atas dengan utara di atas karena +Z = selatan — lihat komentar `src/geo/polygon.js`). `defineDistrict` menormalkan orientasi, tidak menolak.

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect } from 'vitest';
import { defineDistrict, validateDistrictBuild, districtContains } from '../../src/districts/District.js';
import { signedArea } from '../../src/geo/polygon.js';

const SQUARE_CW = [[0, 0], [0, 100], [100, 100], [100, 0]]; // luas bertanda negatif
const spec = (patch = {}) => ({ id: 'uji', boundary: SQUARE_CW, manifestUrl: 'districts/uji/manifest.json', build: async () => ({}), ...patch });

describe('defineDistrict', () => {
  it('membekukan definisi, boundary dibalik ke luas bertanda positif, bounds dihitung', () => {
    const d = defineDistrict(spec());
    expect(Object.isFrozen(d)).toBe(true);
    expect(signedArea(d.boundary)).toBeGreaterThan(0);
    expect(d.bounds).toEqual({ minX: 0, minZ: 0, maxX: 100, maxZ: 100 });
    expect(Object.isFrozen(d.boundary[0])).toBe(true);
  });

  it('menolak id, boundary, manifestUrl, build yang salah', () => {
    expect(() => defineDistrict(spec({ id: 'Uji Besar' }))).toThrow(/id/);
    expect(() => defineDistrict(spec({ boundary: [[0, 0], [1, 1]] }))).toThrow(/boundary/);
    expect(() => defineDistrict(spec({ boundary: [[0, 0], [1, 0], [2, 0]] }))).toThrow(/luas/);
    expect(() => defineDistrict(spec({ boundary: [[0, 0], [Number.NaN, 0], [1, 1]] }))).toThrow(/boundary/);
    expect(() => defineDistrict(spec({ manifestUrl: '' }))).toThrow(/manifestUrl/);
    expect(() => defineDistrict(spec({ build: null }))).toThrow(/build/);
  });
});

describe('validateDistrictBuild', () => {
  const ok = {
    group: { isObject3D: true }, systems: [], colliders: { isWalkable: () => true, isCameraClear: () => true },
    minimapLayer: () => {}, excludeIds: new Set(), whenSettled: async () => true, dispose: () => {},
  };
  it('lulus untuk hasil lengkap (field tambahan boleh)', () => {
    const r = { ...ok, groundHole: null };
    expect(validateDistrictBuild(r, 'uji')).toBe(r);
  });
  it('menyebut semua field yang hilang', () => {
    expect(() => validateDistrictBuild({ ...ok, excludeIds: [], whenSettled: null }, 'uji')).toThrow('(excludeIds, whenSettled)');
    expect(() => validateDistrictBuild(null, 'uji')).toThrow(/group, systems, colliders, minimapLayer, excludeIds, whenSettled, dispose/);
  });
});

describe('districtContains', () => {
  const d = defineDistrict(spec({ boundary: [[0, 0], [100, 0], [100, 100], [50, 50], [0, 100]] }));
  it('di dalam, di luar bbox, dan di cekungan', () => {
    expect(districtContains(d, 10, 10)).toBe(true);
    expect(districtContains(d, 150, 10)).toBe(false);
    expect(districtContains(d, 50, 90)).toBe(false); // takik segitiga
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/district.test.js`
Expected: FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi**

```js
/**
 * Kontrak distrik (spec §4.2): lapisan antara region handmade dan tile kota, berkoordinat DUNIA (tanpa
 * placement). `defineDistrict` memvalidasi & membekukan definisi; `validateDistrictBuild` memeriksa hasil
 * build. Murni (tanpa three); objek three hanya dicek lewat flag `isObject3D`.
 */
import { cleanRing, orientRing, pointInPolygon, polygonArea, ringBounds } from '../geo/polygon.js';

const finite = Number.isFinite;

/**
 * @typedef {{id:string, phase:'input'|'sim'|'world'|'camera'|'ui', update(dt:number, ctx:object):void, dispose?():void}} System
 * @typedef {{isWalkable(x:number, z:number):boolean, isCameraClear(x:number, z:number):boolean,
 *   penetration?(x:number, z:number):number}} DistrictColliders koordinat dunia
 * @typedef {{group:object, systems:System[], colliders:DistrictColliders,
 *   minimapLayer(ctx2d:CanvasRenderingContext2D, view:{toCanvas(x:number, z:number):[number, number], scale:number}):void,
 *   excludeIds:Set<string>, whenSettled(x:number, z:number):Promise<boolean>, dispose():void,
 *   groundHole?:{minX:number, minZ:number, cell:number, cols:number, rows:number, data:Uint8Array}}} DistrictBuild
 */

/**
 * @param {{id:string, boundary:Array<[number,number]>, manifestUrl:string, build(ctx:object):Promise<DistrictBuild>}} spec
 * @returns {Readonly<{id:string, boundary:ReadonlyArray<readonly [number, number]>, bounds:object, manifestUrl:string,
 *   build(ctx:object):Promise<DistrictBuild>}>} boundary dibersihkan & berorientasi luas bertanda positif
 */
export function defineDistrict(spec) {
  if (!spec || typeof spec.id !== 'string' || !/^[a-z0-9-]+$/.test(spec.id)) {
    throw new TypeError('Distrik: id wajib string huruf kecil/angka/strip');
  }
  const ok = Array.isArray(spec.boundary) && spec.boundary.every((p) => Array.isArray(p) && finite(p[0]) && finite(p[1]));
  const ring = ok ? cleanRing(spec.boundary) : [];
  if (ring.length < 3 || polygonArea(ring) < 1) throw new TypeError(`Distrik "${spec.id}": boundary minimal 3 titik dengan luas > 0`);
  if (typeof spec.manifestUrl !== 'string' || spec.manifestUrl === '') throw new TypeError(`Distrik "${spec.id}": manifestUrl wajib`);
  if (typeof spec.build !== 'function') throw new TypeError(`Distrik "${spec.id}": build(ctx) wajib`);
  const boundary = Object.freeze(orientRing(ring, true).map((p) => Object.freeze(p)));
  return Object.freeze({ ...spec, boundary, bounds: Object.freeze(ringBounds(boundary)) });
}

/** Hasil build lengkap? Mengembalikan apa adanya (boleh berisi field tambahan). @throws {TypeError} */
export function validateDistrictBuild(result, id) {
  const missing = [];
  if (!result?.group?.isObject3D) missing.push('group');
  if (!Array.isArray(result?.systems)) missing.push('systems');
  if (typeof result?.colliders?.isWalkable !== 'function' || typeof result?.colliders?.isCameraClear !== 'function') missing.push('colliders');
  if (typeof result?.minimapLayer !== 'function') missing.push('minimapLayer');
  if (!(result?.excludeIds instanceof Set)) missing.push('excludeIds');
  if (typeof result?.whenSettled !== 'function') missing.push('whenSettled');
  if (typeof result?.dispose !== 'function') missing.push('dispose');
  if (missing.length) throw new TypeError(`Distrik "${id}": hasil build tidak lengkap (${missing.join(', ')})`);
  return result;
}

/** Titik dunia (x, z) di dalam batas distrik (bbox dulu, lalu genap-ganjil). */
export function districtContains(def, x, z) {
  const b = def.bounds;
  if (!(x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ)) return false;
  return pointInPolygon(x, z, def.boundary);
}
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/district.test.js`
Expected: PASS — `Tests  5 passed (5)`.

- [ ] **Step 5: Commit**

```bash
git add src/districts/District.js tests/districts/district.test.js
```
```bash
git commit -m "feat(districts): kontrak defineDistrict + validateDistrictBuild + districtContains"
```

---

### Task 12: Streaming chunk terrain `terrainChunks.js` (TDD)

**Files:**
- Create: `src/districts/terrainChunks.js`
- Test: `tests/districts/terrainChunks.test.js`

Perilaku yang dites: field terisi **sebelum** mesh (fisika segera), mesh terpasang setelah scheduler, lubang tanah terisi sel chunk yang tampil; data rusak tidak dicoba ulang → `onFail` sekali, heightAt 0, mesh datar menutup lubang; galat jaringan dicoba ulang 2×; menjauh → mesh/field/lubang dilepas; hook M2 `onChunkMesh` (muat & tukar LOD) dan `onChunkRelease` (unload) dengan galat hook tidak memutus streaming; `dispose` membatalkan rakitan tertunda. Tes memakai `createChunkStreamer` asli (tes boleh mengimpor `city/`) dan scheduler palsu (API sama dengan M0).

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createTerrainChunks, chunkCellGrid } from '../../src/districts/terrainChunks.js';
import { createChunkStreamer } from '../../src/city/ChunkStreamer.js';
import { createHeightField } from '../../src/geo/terrain/heightfield.js';
import { TERRAIN_HEADER, N, BIAS, UNIT } from '../../src/geo/terrain/format.js';

const KEYS = ['0_0', '1_0'];
const header = { ...TERRAIN_HEADER, chunks: KEYS };

function binOf(y) {
  const buf = new ArrayBuffer(N * N * 2);
  const view = new DataView(buf);
  for (let i = 0; i < N * N; i += 1) view.setUint16(i * 2, Math.round(y / UNIT) - BIAS, true);
  return buf;
}

/** Scheduler palsu: antrean dijalankan penuh oleh runAll(); tugas generator diiterasi sampai selesai. */
function fakeScheduler() {
  const q = [];
  return {
    schedule(task, { owner }) {
      const e = { task, owner, cancelled: false };
      q.push(e);
      return { cancel() { e.cancelled = true; } };
    },
    cancelOwner(o) { for (const e of q) if (e.owner === o) e.cancelled = true; },
    pending(o) { return q.filter((e) => !e.cancelled && (o === undefined || e.owner === o)).length; },
    runAll() {
      while (q.length) {
        const e = q.shift();
        if (e.cancelled) continue;
        const it = e.task();
        if (it && typeof it.next === 'function') for (let s = it.next(); !s.done; s = it.next());
      }
    },
  };
}

const flush = async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0)); };

function setup({ fetchImpl, onFail = vi.fn(), onChunkMesh = vi.fn(), onChunkRelease = vi.fn() } = {}) {
  const field = createHeightField();
  const parent = new THREE.Group();
  const scheduler = fakeScheduler();
  const cellGrid = chunkCellGrid(KEYS);
  const cellMask = new Uint8Array(cellGrid.cols * cellGrid.rows).fill(1);
  const hole = new Uint8Array(cellMask.length);
  const onHoleChange = vi.fn();
  const chunks = createTerrainChunks({
    header, baseUrl: '/d/', field, parent, materials: { terrain: new THREE.MeshBasicMaterial() },
    cellGrid, cellMask, hole, onHoleChange, scheduler, owner: 'district:uji',
    createStreamer: (o) => createChunkStreamer({ ...o, config: { loadRadius: 600, unloadRadius: 800, lod0Radius: 50, lodHysteresis: 10, maxParallel: 2 } }),
    fetchArrayBuffer: fetchImpl ?? (async () => binOf(2)), sleep: async () => {}, onFail, logger: { error() {} },
    onChunkMesh, onChunkRelease,
  });
  return { field, parent, scheduler, chunks, hole, onHoleChange, onFail, cellGrid, onChunkMesh, onChunkRelease };
}

describe('chunkCellGrid', () => {
  it('persegi chunk -1_0 … 1_2 → 375 × 375 sel mulai (−500, 0)', () => {
    expect(chunkCellGrid(['-1_0', '1_2', '0_1'])).toMatchObject({ minX: -500, minZ: 0, cols: 375, rows: 375, ix0: -1, iz0: 0, per: 125 });
  });
});

describe('createTerrainChunks', () => {
  it('muat: field terisi sebelum mesh; mesh terpasang setelah scheduler; lubang terisi', async () => {
    const s = setup();
    s.chunks.update({ x: 10, z: 10 });
    await flush();
    expect(s.field.heightAt(10, 10)).toBeCloseTo(2, 6);
    expect(s.parent.children).toHaveLength(0);
    expect(s.chunks.settled(10, 10, 50)).toBe(false);
    s.scheduler.runAll();
    expect(s.parent.children.map((m) => m.name).sort()).toEqual(['terrain:0_0:lod0', 'terrain:1_0:lod1']);
    expect(s.hole[0]).toBe(1);
    expect(s.hole[124]).toBe(1);
    expect(s.onHoleChange).toHaveBeenCalled();
    expect(s.chunks.settled(10, 10, 50)).toBe(true);
  });

  it('data rusak: tanpa retry, onFail sekali, heightAt 0, mesh datar tetap menutup lubang', async () => {
    const fetchImpl = vi.fn(async (url) => (url.endsWith('0_0.bin') ? new ArrayBuffer(8) : binOf(1)));
    const s = setup({ fetchImpl });
    s.chunks.update({ x: 10, z: 10 });
    await flush();
    s.scheduler.runAll();
    expect(fetchImpl.mock.calls.filter(([u]) => u === '/d/terrain/0_0.bin')).toHaveLength(1);
    expect(s.onFail).toHaveBeenCalledTimes(1);
    expect(s.field.heightAt(10, 10)).toBe(0);
    expect(s.parent.children.some((m) => m.name === 'terrain:0_0:lod1')).toBe(true);
    expect(s.hole[0]).toBe(1);
  });

  it('galat jaringan dicoba ulang 2× lalu berhasil', async () => {
    let calls = 0;
    const s = setup({ fetchImpl: async () => { calls += 1; if (calls <= 2) throw new Error('offline'); return binOf(3); } });
    s.chunks.update({ x: 10, z: 10 });
    await flush();
    expect(s.onFail).not.toHaveBeenCalled();
    expect(s.field.heightAt(10, 10)).toBeCloseTo(3, 6);
  });

  it('fokus menjauh > unloadRadius: mesh, field, dan lubang dilepas', async () => {
    const s = setup();
    s.chunks.update({ x: 10, z: 10 });
    await flush();
    s.scheduler.runAll();
    s.chunks.update({ x: 5000, z: 5000 });
    expect(s.parent.children).toHaveLength(0);
    expect(s.field.size).toBe(0);
    expect(s.hole.every((v) => v === 0)).toBe(true);
  });

  it('hook onChunkMesh (muat & tukar LOD) dan onChunkRelease (unload); galat hook tidak memutus', async () => {
    const s = setup({ onChunkMesh: vi.fn(() => { throw new Error('hook rusak'); }) });
    s.chunks.update({ x: 10, z: 10 });
    await flush();
    s.scheduler.runAll();
    expect(s.onChunkMesh).toHaveBeenCalledTimes(2);
    const [key, info] = s.onChunkMesh.mock.calls.find(([k]) => k === '0_0');
    expect(key).toBe('0_0');
    expect(info.lod).toBe(0);
    expect(info.chunk.key).toBe('0_0');
    expect(s.parent.children).toContain(info.mesh);
    s.chunks.update({ x: 5000, z: 5000 });
    expect(s.onChunkRelease.mock.calls.map(([k]) => k).sort()).toEqual(['0_0', '1_0']);
  });

  it('dispose membatalkan rakitan tertunda dan melepas semua', async () => {
    const s = setup();
    s.chunks.update({ x: 10, z: 10 });
    await flush();
    s.chunks.dispose();
    s.scheduler.runAll();
    expect(s.parent.children).toHaveLength(0);
    expect(s.field.size).toBe(0);
    expect(s.scheduler.pending('district:uji')).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/terrainChunks.test.js`
Expected: FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi**

```js
/**
 * Streaming chunk terrain distrik: aksi ChunkStreamer (diinjeksi — distrik tidak boleh mengimpor city/)
 * → unduh `terrain/<key>.bin` (retry + backoff; data rusak tidak dicoba ulang) → decodeChunk →
 * `field.add` SEGERA (fisika sepeda) → mesh LOD dirakit time-sliced lewat scheduler → dipasang bila
 * permintaan masih berlaku. Lubang tanah dasar kota (`hole`) diisi tepat untuk sel chunk yang meshnya
 * tampil. Chunk gagal: heightAt = 0 di area itu (tidak ditambahkan ke field), mesh datar dipasang agar
 * lubang tetap tertutup, `onFail` (toast sekali di pemanggil). Spec §4.2, §5.3, §10.
 */
import { decodeChunk, TerrainDataError } from '../geo/terrain/heightfield.js';
import { CHUNK_SIZE, N, ZERO_U16 } from '../geo/terrain/format.js';
import { parseTileKey } from '../geo/tiles.js';
import { buildTerrainChunkMesh, buildTerrainChunkMeshSteps } from '../world/terrain/TerrainMesh.js';

export const TERRAIN_FETCH = Object.freeze({ retries: 2, backoffMs: Object.freeze([500, 1500]) });

/** fetch biner dengan galat HTTP eksplisit. */
export async function fetchArrayBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

/**
 * Grid sel (4 m) yang menutup persegi semua chunk; sel (r, c) chunk (ix, iz) = baris (iz − iz0)·125 + r.
 * @param {string[]} keys
 * @returns {{minX:number, minZ:number, cell:number, cols:number, rows:number, ix0:number, iz0:number, per:number}}
 */
export function chunkCellGrid(keys, step = 4) {
  const ids = keys.map((k) => parseTileKey(k)).filter(Boolean);
  if (ids.length === 0) return { minX: 0, minZ: 0, cell: step, cols: 0, rows: 0, ix0: 0, iz0: 0, per: CHUNK_SIZE / step };
  const ix0 = Math.min(...ids.map((t) => t.ix));
  const iz0 = Math.min(...ids.map((t) => t.iz));
  const ix1 = Math.max(...ids.map((t) => t.ix));
  const iz1 = Math.max(...ids.map((t) => t.iz));
  const per = CHUNK_SIZE / step;
  return { minX: ix0 * CHUNK_SIZE, minZ: iz0 * CHUNK_SIZE, cell: step, cols: (ix1 - ix0 + 1) * per, rows: (iz1 - iz0 + 1) * per, ix0, iz0, per };
}

/** Chunk datar (y = 0) untuk fallback visual chunk yang gagal. */
function flatChunk(key, header) {
  const id = parseTileKey(key);
  const data = new Uint16Array(N * N).fill(ZERO_U16);
  return {
    key, ix: id.ix, iz: id.iz, origin: { x: id.ix * CHUNK_SIZE, z: id.iz * CHUNK_SIZE },
    size: header.size, step: header.step, n: header.n, unit: header.unit, bias: header.bias, data,
  };
}

/**
 * @param {{header:{size:number, step:number, n:number, unit:number, bias:number, chunks:string[]},
 *   baseUrl:string, field:object, parent:{add(o:object):void, remove(o:object):void},
 *   materials:{terrain:object}, cellGrid:ReturnType<typeof chunkCellGrid>, cellMask:Uint8Array,
 *   hole?:Uint8Array|null, onHoleChange?:() => void,
 *   scheduler:{schedule(task:Function, opts:{owner:string}):{cancel():void}, cancelOwner(owner:string):void, pending(owner?:string):number},
 *   owner:string, createStreamer:(opts:{tiles:Array<{key:string, ix:number, iz:number}>}) => object,
 *   fetchArrayBuffer?:(url:string) => Promise<ArrayBuffer>, retries?:number, backoffMs?:readonly number[],
 *   sleep?:(ms:number) => Promise<void>, onFail?:(key:string, err:unknown) => void, logger?:{error:(...a:unknown[]) => void},
 *   onChunkMesh?:(key:string, info:{mesh:object|null, lod:0|1, chunk:object}) => void, onChunkRelease?:(key:string) => void}} opts
 *   onChunkMesh: setelah mesh chunk NYATA (bukan fallback datar) dipasang — muat pertama & tiap tukar LOD;
 *   onChunkRelease: sebelum mesh chunk dilepas karena aksi `unload` (bukan tukar LOD). Galat hook dicatat, tidak memutus streaming.
 */
export function createTerrainChunks({
  header, baseUrl, field, parent, materials, cellGrid, cellMask, hole = null, onHoleChange = () => {},
  scheduler, owner, createStreamer, fetchArrayBuffer: getBuffer = fetchArrayBuffer,
  retries = TERRAIN_FETCH.retries, backoffMs = TERRAIN_FETCH.backoffMs,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onFail = () => {}, logger = console,
  onChunkMesh = () => {}, onChunkRelease = () => {},
}) {
  const streamer = createStreamer({ tiles: header.chunks.map((key) => ({ key, ...parseTileKey(key) })) });
  const decoded = new Map(); // key → chunk
  const shown = new Map();   // key → {mesh|null, lod, flat}
  let disposed = false;

  const cellRect = (key) => {
    const id = parseTileKey(key);
    return { r0: (id.iz - cellGrid.iz0) * cellGrid.per, c0: (id.ix - cellGrid.ix0) * cellGrid.per };
  };
  const insideFor = (key) => {
    const { r0, c0 } = cellRect(key);
    return (r, c) => cellMask[(r0 + r) * cellGrid.cols + c0 + c] === 1;
  };
  const setHole = (key, on) => {
    if (!hole) return;
    const { r0, c0 } = cellRect(key);
    for (let r = 0; r < cellGrid.per; r += 1) {
      const row = (r0 + r) * cellGrid.cols + c0;
      for (let c = 0; c < cellGrid.per; c += 1) hole[row + c] = on ? cellMask[row + c] : 0;
    }
    onHoleChange();
  };

  const disposeMesh = (mesh) => mesh?.geometry.dispose(); // material bersama milik distrik
  const detach = (key) => {
    const e = shown.get(key);
    if (!e) return;
    shown.delete(key);
    if (e.mesh) {
      parent.remove(e.mesh);
      disposeMesh(e.mesh);
    }
    setHole(key, false);
  };
  const attach = (key, mesh, lod, flat = false) => {
    detach(key);
    if (mesh) parent.add(mesh);
    shown.set(key, { mesh, lod, flat });
    setHole(key, true);
  };
  const dropData = (key) => {
    decoded.delete(key);
    field.remove(key);
  };

  const fetchDecode = async (key) => {
    const url = `${baseUrl}terrain/${key}.bin`;
    for (let attempt = 0; ; attempt += 1) {
      try {
        return decodeChunk(await getBuffer(url), { ...header, key });
      } catch (err) {
        if (err instanceof TerrainDataError || attempt >= retries) throw err;
        await sleep(backoffMs[Math.min(attempt, backoffMs.length - 1)]);
      }
    }
  };

  const hook = (name, fn) => {
    try {
      fn();
    } catch (err) {
      logger.error(`Hook ${name} chunk gagal (dilanjutkan):`, err);
    }
  };

  const finish = (key, lod, req, mesh) => {
    if (disposed || !streamer.loaded(key, lod, req)) {
      disposeMesh(mesh);
      if (!disposed && streamer.status(key) === 'idle') dropData(key);
      return;
    }
    attach(key, mesh, lod);
    hook('onChunkMesh', () => onChunkMesh(key, { mesh, lod, chunk: decoded.get(key) }));
  };

  const scheduleBuild = (key, chunk, lod, req) => {
    scheduler.schedule(function* buildChunk() {
      if (disposed) return;
      const mesh = yield* buildTerrainChunkMeshSteps(chunk, field, { lod, materials, cellInside: insideFor(key) });
      finish(key, lod, req, mesh);
    }, { owner });
  };

  const fail = (action, err) => {
    if (disposed || !streamer.failed(action.key, action.req)) return;
    logger.error(`Chunk terrain ${action.key} gagal dimuat:`, err);
    onFail(action.key, err);
    if (streamer.status(action.key) === 'failed') {
      attach(action.key, buildTerrainChunkMesh(flatChunk(action.key, header), null, { lod: 1, materials, cellInside: insideFor(action.key) }), 1, true);
    }
  };

  async function load(action) {
    let chunk;
    try {
      chunk = decoded.get(action.key) ?? await fetchDecode(action.key);
    } catch (err) {
      fail(action, err);
      return;
    }
    if (disposed || streamer.status(action.key) !== 'loading') return; // dilepas selama unduh
    decoded.set(action.key, chunk);
    if (!field.has(action.key)) field.add(chunk);
    scheduleBuild(action.key, chunk, action.lod, action.req);
  }

  const execute = (action) => {
    switch (action.type) {
      case 'load':
        load(action).catch((err) => logger.error(`Aksi terrain ${action.key} gagal:`, err));
        break;
      case 'swap': {
        const chunk = decoded.get(action.key);
        if (chunk) scheduleBuild(action.key, chunk, action.lod, action.req);
        else streamer.failed(action.key, action.req);
        break;
      }
      case 'unload':
        if (shown.get(action.key) && !shown.get(action.key).flat) hook('onChunkRelease', () => onChunkRelease(action.key));
        detach(action.key);
        dropData(action.key);
        break;
      default: // 'cancel': hasil basi dibuang saat streamer.loaded() = false
    }
  };

  return {
    /** Satu langkah streaming untuk fokus dunia {x, z}. */
    update(focus) {
      if (disposed || !focus) return;
      for (const action of streamer.update(focus)) execute(action);
      for (const [key, e] of [...shown]) if (e.flat && streamer.status(key) !== 'failed') detach(key); // fallback dilepas
    },
    /** Semua chunk dalam radius r tampil/gagal dan tidak ada rakitan mesh tertunda. */
    settled(x, z, r) {
      return streamer.settled(x, z, r) && scheduler.pending(owner) === 0;
    },
    stats() {
      let triangles = 0;
      for (const e of shown.values()) if (e.mesh) triangles += e.mesh.geometry.index.count / 3;
      return { shown: shown.size, decoded: decoded.size, triangles, ...streamer.stats() };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scheduler.cancelOwner(owner);
      for (const key of [...shown.keys()]) detach(key);
      for (const key of [...decoded.keys()]) dropData(key);
    },
  };
}
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/terrainChunks.test.js`
Expected: PASS — `Tests  7 passed (7)`.

- [ ] **Step 5: Commit**

```bash
git add src/districts/terrainChunks.js tests/districts/terrainChunks.test.js
```
```bash
git commit -m "feat(districts): streaming chunk terrain (retry, fallback datar, lubang tanah per sel, hook onChunkMesh/onChunkRelease)"
```

---

### Task 13: Distrik `unriDistrict` (TDD)

**Files:**
- Create: `src/districts/unri/index.js`
- Test: `tests/districts/unri.test.js`

ctx `build` (disediakan `mountDistrict`, Task 16): `{ scene, scope, terrain, scheduler, owner, baseUrl, fetchJson, fetchArrayBuffer, createStreamer, onTerrainFail, groundHoleChanged, logger }` (+ `setTimer/clearTimer` opsional untuk tes). Collider M1 terbuka (`isWalkable`/`isCameraClear` true) — penghalang tile kota tetap berlaku karena rantai (Task 14); M2 mengganti dengan collider air/lereng.

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { unriDistrict, validateDistrictManifest, SETTLE } from '../../src/districts/unri/index.js';
import { UNRI_BOUNDARY } from '../../src/districts/unri/boundary.js';
import { validateDistrictBuild, districtContains } from '../../src/districts/District.js';
import { createChunkStreamer } from '../../src/city/ChunkStreamer.js';
import { createResourceScope } from '../../src/engine/ResourceScope.js';
import { createTerrainService } from '../../src/app/terrainService.js';
import { TERRAIN_HEADER, N, BIAS, UNIT } from '../../src/geo/terrain/format.js';
import { polygonArea, signedArea } from '../../src/geo/polygon.js';

const manifest = (chunks = ['-1_2']) => ({
  format: 'unri-district', version: 1, terrain: { ...TERRAIN_HEADER, chunks },
  ground: { chunks: [] }, buildings: 'buildings.json', attribution: 'ATTRIBUTION.txt',
});

describe('UNRI_BOUNDARY (hasil bake:campus -- boundary)', () => {
  it('ring tunggal ±2,4 km², luas bertanda positif, stadion di luar, sekre & rektorat di dalam', () => {
    expect(UNRI_BOUNDARY.length).toBeGreaterThanOrEqual(20);
    expect(signedArea(UNRI_BOUNDARY)).toBeGreaterThan(0);
    expect(polygonArea(UNRI_BOUNDARY)).toBeGreaterThan(2.3e6);
    expect(polygonArea(UNRI_BOUNDARY)).toBeLessThan(2.5e6);
    expect(districtContains(unriDistrict, 0, 0)).toBe(false);
    expect(districtContains(unriDistrict, -219, 1107)).toBe(true);
    expect(districtContains(unriDistrict, -979, 860)).toBe(true);
  });
});

describe('validateDistrictManifest', () => {
  it('menerima manifest valid (beku)', () => {
    const h = validateDistrictManifest(manifest(['-1_2', '0_2']));
    expect(h.chunks).toEqual(['-1_2', '0_2']);
    expect(Object.isFrozen(h.chunks)).toBe(true);
  });
  it('menolak format, kunci, dan duplikat', () => {
    expect(() => validateDistrictManifest({ ...manifest(), format: 'lain' })).toThrow(/bukan unri-district/);
    expect(() => validateDistrictManifest(manifest(['a_b']))).toThrow(/ix_iz/);
    expect(() => validateDistrictManifest(manifest(['01_2']))).toThrow(/ix_iz/);
    expect(() => validateDistrictManifest(manifest(['0_0', '0_0']))).toThrow(/ganda/);
    expect(() => validateDistrictManifest({ ...manifest(), terrain: { ...TERRAIN_HEADER, n: 3, chunks: [] } })).toThrow(/n 3/);
  });
});

describe('unriDistrict.build', () => {
  function chunkBin(y) {
    const buf = new ArrayBuffer(N * N * 2);
    const v = new DataView(buf);
    for (let i = 0; i < N * N; i += 1) v.setUint16(i * 2, Math.round(y / UNIT) - BIAS, true);
    return buf;
  }
  const queue = [];
  const scheduler = {
    schedule(task, { owner }) { const e = { task, owner, off: false }; queue.push(e); return { cancel() { e.off = true; } }; },
    cancelOwner(o) { for (const e of queue) if (e.owner === o) e.off = true; },
    pending(o) { return queue.filter((e) => !e.off && e.owner === o).length; },
    run() { while (queue.length) { const e = queue.shift(); if (!e.off) { const it = e.task(); for (let s = it.next(); !s.done; s = it.next()); } } },
  };

  it('hasil build lengkap; chunk sekre termuat → heightAt nyata, whenSettled true, dispose bersih', async () => {
    const terrain = createTerrainService();
    const holeChanged = vi.fn();
    const result = await unriDistrict.build({
      scope: createResourceScope('uji'), terrain, scheduler, owner: 'district:unri', baseUrl: '/',
      fetchJson: async (url) => { expect(url).toBe('/districts/unri/manifest.json'); return manifest(); },
      fetchArrayBuffer: async (url) => { expect(url).toBe('/districts/unri/terrain/-1_2.bin'); return chunkBin(1.25); },
      createStreamer: (o) => createChunkStreamer(o), onTerrainFail: vi.fn(), groundHoleChanged: holeChanged, logger: { error() {} },
      setTimer: () => 0, clearTimer: () => {},
    });
    validateDistrictBuild(result, 'unri');
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(result.groundHole).toMatchObject({ minX: -500, minZ: 1000, cell: 4, cols: 125, rows: 125 });
    const settled = result.whenSettled(-219, 1107);
    result.systems[0].update(1 / 60, { focus: { x: -219, z: 1107 } });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(terrain.heightAt(-219, 1107)).toBeCloseTo(1.25, 6);
    scheduler.run();
    result.systems[0].update(1 / 60, { focus: { x: -219, z: 1107 } });
    await expect(settled).resolves.toBe(true);
    expect(result.group.children).toHaveLength(1);
    expect(holeChanged).toHaveBeenCalled();
    expect(result.groundHole.data.some((v) => v === 1)).toBe(true);
    expect(SETTLE.radius).toBe(600);
    const late = result.whenSettled(0, 0);
    result.dispose();
    await expect(late).resolves.toBe(false);
    expect(terrain.heightAt(-219, 1107)).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districts/unri.test.js`
Expected: FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi**

```js
/**
 * Distrik Kampus UNRI Bina Widya (spec §3, §4.2). M1: terrain saja (chunk heightfield + mesh LOD +
 * lubang tanah dasar kota); M2 menambah tanah & jalan, M3 gedung kit, M7 kehidupan. Koordinat dunia.
 */
import * as THREE from 'three';
import { defineDistrict } from '../District.js';
import { UNRI_BOUNDARY } from './boundary.js';
import { TerrainDataError, validateTerrainHeader } from '../../geo/terrain/heightfield.js';
import { rasterizeRing } from '../../geo/terrain/cellMask.js';
import { parseTileKey } from '../../geo/tiles.js';
import { chunkCellGrid, createTerrainChunks } from '../terrainChunks.js';
import { createTerrainMaterial } from '../../world/terrain/TerrainMesh.js';

export const UNRI_DIR = 'districts/unri/';
export const DISTRICT_FORMAT = 'unri-district';
export const SETTLE = Object.freeze({ radius: 600, timeoutMs: 20000 });

/** Distrik M1 belum punya penghalang: semua bebas (collider komposit tetap memeriksa tile kota sesudahnya). */
const OPEN = Object.freeze({ isWalkable: () => true, isCameraClear: () => true, penetration: () => 0 });

/**
 * Validasi manifest distrik; mengembalikan header terrain beku.
 * @throws {TerrainDataError}
 */
export function validateDistrictManifest(m) {
  if (!m || typeof m !== 'object') throw new TerrainDataError('manifest distrik bukan objek');
  if (m.format !== DISTRICT_FORMAT || m.version !== 1) throw new TerrainDataError(`manifest ${m.format}/${m.version} bukan ${DISTRICT_FORMAT}/1`);
  const t = m.terrain;
  validateTerrainHeader(t);
  if (!Array.isArray(t.chunks) || !t.chunks.every((k) => parseTileKey(k) && `${parseTileKey(k).ix}_${parseTileKey(k).iz}` === k)) {
    throw new TerrainDataError('terrain.chunks harus daftar kunci "ix_iz"');
  }
  if (new Set(t.chunks).size !== t.chunks.length) throw new TerrainDataError('terrain.chunks berisi kunci ganda');
  return Object.freeze({ ...t, chunks: Object.freeze([...t.chunks]) });
}

/** Isi batas kampus di minimap (hijau pucat + garis tepi). */
function drawBoundary(ctx2d, view) {
  ctx2d.save();
  ctx2d.beginPath();
  UNRI_BOUNDARY.forEach(([x, z], i) => {
    const [px, py] = view.toCanvas(x, z);
    if (i === 0) ctx2d.moveTo(px, py);
    else ctx2d.lineTo(px, py);
  });
  ctx2d.closePath();
  ctx2d.fillStyle = 'rgba(132, 176, 96, 0.35)';
  ctx2d.fill();
  ctx2d.strokeStyle = 'rgba(58, 92, 48, 0.85)';
  ctx2d.lineWidth = 2;
  ctx2d.stroke();
  ctx2d.restore();
}

/** Lepas material terrain beserta petanya (ResourceScope hanya melepas material). */
const disposeMaterial = (mat) => {
  for (const key of ['map', 'normalMap', 'roughnessMap']) mat[key]?.dispose();
  mat.dispose();
};

/**
 * ctx (dari app/districtMount.js): { scope, terrain, scheduler, owner, baseUrl, fetchJson, fetchArrayBuffer,
 *   createStreamer, onTerrainFail, groundHoleChanged, logger, setTimer?, clearTimer? }
 */
async function buildUnri(ctx) {
  const manifest = await ctx.fetchJson(`${ctx.baseUrl}${UNRI_DIR}manifest.json`); // mentah: M2 membaca manifest.ground
  const header = validateDistrictManifest(manifest);
  const group = new THREE.Group();
  group.name = 'distrik:unri';
  const material = ctx.scope.get('terrain:material', createTerrainMaterial, { dispose: disposeMaterial });
  const cellGrid = chunkCellGrid(header.chunks, header.step);
  const cellMask = rasterizeRing(UNRI_BOUNDARY, cellGrid);
  const hole = new Uint8Array(cellMask.length);
  const chunks = createTerrainChunks({
    header, baseUrl: `${ctx.baseUrl}${UNRI_DIR}`, field: ctx.terrain.field, parent: group, materials: { terrain: material },
    cellGrid, cellMask, hole, onHoleChange: ctx.groundHoleChanged, scheduler: ctx.scheduler, owner: ctx.owner,
    createStreamer: ctx.createStreamer, fetchArrayBuffer: ctx.fetchArrayBuffer, onFail: ctx.onTerrainFail, logger: ctx.logger,
  });
  const setTimer = ctx.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = ctx.clearTimer ?? ((h) => clearTimeout(h));
  const waiters = new Set();
  let disposed = false;
  const settle = (w, value) => {
    if (!waiters.delete(w)) return;
    clearTimer(w.timer);
    w.resolve(value);
  };
  const system = {
    id: 'district.unri.terrain',
    phase: 'world',
    update(dt, frame) {
      chunks.update(frame.focus ?? frame.bikePos);
      for (const w of waiters) if (chunks.settled(w.x, w.z, SETTLE.radius)) settle(w, true);
    },
  };
  return {
    group,
    systems: [system],
    colliders: OPEN,
    minimapLayer: drawBoundary,
    excludeIds: new Set(),
    groundHole: { ...cellGrid, data: hole },
    stats: () => chunks.stats(),
    /** Selesai bila chunk terrain dalam SETTLE.radius dari (x, z) tampil/gagal; false bila habis waktu/dilepas. */
    whenSettled(x, z, timeoutMs = SETTLE.timeoutMs) {
      if (disposed) return Promise.resolve(false);
      return new Promise((resolve) => {
        const w = { x, z, resolve, timer: null };
        waiters.add(w);
        w.timer = setTimer(() => { if (waiters.delete(w)) resolve(false); }, timeoutMs);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const w of [...waiters]) settle(w, false);
      chunks.dispose();
      group.removeFromParent();
    },
  };
}

export const unriDistrict = defineDistrict({
  id: 'unri',
  boundary: UNRI_BOUNDARY,
  manifestUrl: `${UNRI_DIR}manifest.json`,
  build: buildUnri,
});
```

- [ ] **Step 4: Jalankan — lulus (termasuk data nyata Task 8)**

Run: `node node_modules/vitest/vitest.mjs run tests/districts tests/campusbake/terrainData.test.js`
Expected: PASS — `tests/districts/unri.test.js` 4 tes, `terrainData` 4 tes (paritas stadion: `heightAt === 0` di > 20.000 titik mask + 60 m).

- [ ] **Step 5: Commit**

```bash
git add src/districts/unri/index.js tests/districts/unri.test.js
```
```bash
git commit -m "feat(districts): distrik UNRI (terrain): validasi manifest, chunk streaming, lubang tanah, whenSettled"
```

---

### Task 14: Collider distrik berantai `createDistrictCollider` (TDD)

**Files:**
- Modify: `src/core/Collider.js`
- Test: `tests/districtCollider.test.js`

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect } from 'vitest';
import { createCompositeCollider, createDistrictCollider } from '../src/core/Collider.js';
import { defineRegion } from '../src/regions/Region.js';

const square = (x0, z0, s) => [[x0, z0], [x0 + s, z0], [x0 + s, z0 + s], [x0, z0 + s]];
const bounds = (x0, z0, s) => ({ minX: x0, minZ: z0, maxX: x0 + s, maxZ: z0 + s });

describe('collider distrik berantai (region → distrik → tile)', () => {
  const tile = {
    isWalkable: (x) => x < 150, // "gedung kota" di x ≥ 150
    isCameraClear: () => true,
    penetration: (x) => (x >= 150 ? x - 150 : 0),
  };
  const district = {
    isWalkable: (x, z) => !(x > 100 && x < 120 && z > 100 && z < 120), // "danau" distrik
    isCameraClear: () => true,
    penetration: (x, z) => (x > 100 && x < 120 && z > 100 && z < 120 ? 5 : 0),
  };

  it('di dalam distrik: rantai (distrik DAN tile); di luar: tile saja; pencabut idempoten', () => {
    const dc = createDistrictCollider({ fallback: tile });
    const off = dc.addDistrict({ id: 'uji', boundary: square(0, 0, 200), bounds: bounds(0, 0, 200), colliders: district });
    expect(dc.isWalkable(50, 50)).toBe(true);
    expect(dc.isWalkable(110, 110)).toBe(false);
    expect(dc.isWalkable(160, 50)).toBe(false);
    expect(dc.penetration(110, 110)).toBe(5);
    expect(dc.penetration(170, 50)).toBe(20);
    expect(dc.isWalkable(300, 300)).toBe(false);
    expect(dc.isWalkable(Number.NaN, 0)).toBe(false);
    expect(dc.penetration(Number.NaN, 0)).toBe(Infinity);
    off();
    off();
    expect(dc.isWalkable(110, 110)).toBe(true);
  });

  it('sebagai fallback komposit: region menang di dalam mask region', () => {
    const region = defineRegion({ id: 'r', placement: { x: 110, z: 110, yaw: 0 }, mask: square(-5, -5, 10), build: async () => ({}) });
    const dc = createDistrictCollider({ fallback: tile });
    dc.addDistrict({ id: 'uji', boundary: square(0, 0, 200), bounds: bounds(0, 0, 200), colliders: district });
    const comp = createCompositeCollider({ regions: [{ region, colliders: { isWalkable: () => true, isCameraClear: () => true } }], fallback: dc });
    expect(comp.isWalkable(110, 110)).toBe(true);
    expect(comp.isWalkable(118, 118)).toBe(false);
  });

  it('id sama menggantikan; setFallback; colliders tak lengkap ditolak', () => {
    const dc = createDistrictCollider();
    dc.addDistrict({ id: 'uji', boundary: square(0, 0, 200), bounds: bounds(0, 0, 200), colliders: district });
    dc.addDistrict({ id: 'uji', boundary: square(0, 0, 200), bounds: bounds(0, 0, 200), colliders: { isWalkable: () => true, isCameraClear: () => true } });
    expect(dc.isWalkable(110, 110)).toBe(true);
    dc.setFallback(tile);
    expect(dc.isWalkable(160, 50)).toBe(false);
    expect(() => dc.addDistrict({ id: 'x', boundary: [], bounds: bounds(0, 0, 1), colliders: {} })).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districtCollider.test.js`
Expected: FAIL (`createDistrictCollider is not a function`).

- [ ] **Step 3: Implementasi** — di `src/core/Collider.js`:

1. Cari:

```js
const TRAPPED_EPS = 1e-6;
```

   Ganti dengan:

```js
/**
 * Collider distrik berantai (M1, spec §4.2 "regions → district → tile kota"): dipasang sebagai FALLBACK
 * komposit dinamis M0 (`colliders.setFallback(createDistrictCollider({ fallback: tile }))`), sehingga region
 * tetap didahulukan. Di dalam batas distrik hasilnya RANTAI: walkable/clear bila distrik DAN fallback
 * setuju, penetration = maksimum keduanya — distrik menambah penghalang (air, lereng, gedung kit) tanpa
 * menghapus penghalang tile kota yang masih ada. Di luar semua distrik = fallback apa adanya.
 * @param {{fallback?: {isWalkable(x:number,z:number):boolean, isCameraClear(x:number,z:number):boolean,
 *   penetration?(x:number,z:number):number}}} [opts]
 * @returns {{isWalkable(x:number,z:number):boolean, isCameraClear(x:number,z:number):boolean, penetration(x:number,z:number):number,
 *   addDistrict(d:{id:string, boundary:Array<[number,number]>, bounds:{minX:number,minZ:number,maxX:number,maxZ:number},
 *     colliders:object}):() => void, setFallback(c:object):void}}
 */
export function createDistrictCollider({ fallback = OPEN } = {}) {
  let base = fallback;
  let districts = [];
  const districtAt = (x, z) => districts.find((d) => x >= d.bounds.minX && x <= d.bounds.maxX && z >= d.bounds.minZ
    && z <= d.bounds.maxZ && pointInPolygon(x, z, d.boundary)) ?? null;
  const route = (x, z, query, combine, invalid) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return invalid;
    const d = districtAt(x, z);
    return d ? combine(() => query(d.colliders, x, z), () => query(base, x, z)) : query(base, x, z);
  };
  const both = (a, b) => a() && b();
  const deepest = (a, b) => Math.max(a(), b());
  return Object.freeze({
    isWalkable: (x, z) => route(x, z, (c, px, pz) => c.isWalkable(px, pz), both, false),
    isCameraClear: (x, z) => route(x, z, (c, px, pz) => c.isCameraClear(px, pz), both, false),
    penetration: (x, z) => route(x, z, depthOf, deepest, Infinity),
    /** Daftarkan collider distrik (dunia); mengembalikan pencabut (idempoten). Id sama menggantikan yang lama. */
    addDistrict({ id, boundary, bounds, colliders }) {
      if (typeof colliders?.isWalkable !== 'function' || typeof colliders?.isCameraClear !== 'function') {
        throw new TypeError(`addDistrict "${id}": colliders tidak lengkap`);
      }
      const entry = Object.freeze({ id, boundary, bounds, colliders });
      districts = [...districts.filter((d) => d.id !== id), entry];
      return () => { districts = districts.filter((d) => d !== entry); };
    },
    /** Ganti collider tile kota (fallback). */
    setFallback(c) { base = c ?? OPEN; },
  });
}

const TRAPPED_EPS = 1e-6;
```

(`OPEN`, `depthOf`, `pointInPolygon` sudah ada di modul ini.)

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/districtCollider.test.js tests/compositeCollider.test.js tests/collider.test.js`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add src/core/Collider.js tests/districtCollider.test.js
```
```bash
git commit -m "feat(core): collider distrik berantai (region → distrik → tile kota) sebagai fallback komposit"
```

---

### Task 15: Lubang tanah dasar kota (`groundHole`) (TDD)

**Files:**
- Create: `src/city/groundHole.js`
- Modify: `src/city/index.js`
- Test: `tests/city/groundHole.test.js`

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyGroundHole, patchShaderSource } from '../../src/city/groundHole.js';

describe('patchShaderSource', () => {
  it('menyisipkan varying, uniform, dan uji discard pada chunk Lambert', () => {
    const lib = THREE.ShaderLib.lambert;
    const out = patchShaderSource({ vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader });
    expect(out.vertexShader).toContain('varying vec2 vHoleXZ;');
    expect(out.vertexShader).toContain('vHoleXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    expect(out.fragmentShader).toContain('uniform sampler2D uHoleMap;');
    expect(out.fragmentShader).toContain('discard;');
    // urutan: uji lubang sesudah clipping_planes_fragment (di dalam main)
    expect(out.fragmentShader.indexOf('discard;')).toBeGreaterThan(out.fragmentShader.indexOf('#include <clipping_planes_fragment>'));
  });
});

describe('applyGroundHole', () => {
  it('memasang onBeforeCompile + kunci program; set/clear mengubah uniform', () => {
    const mat = new THREE.MeshLambertMaterial();
    const hole = applyGroundHole(mat);
    expect(mat.customProgramCacheKey()).toBe('kota-ground-hole-v1');
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader };
    mat.onBeforeCompile(shader);
    expect(shader.uniforms.uHoleOn.value).toBe(0);
    const texture = new THREE.DataTexture(new Uint8Array(4), 2, 2, THREE.RedFormat);
    hole.set({ texture, rect: { minX: -2000, minZ: -500, maxX: 500, maxZ: 2500 } });
    expect(hole.active).toBe(true);
    expect(shader.uniforms.uHoleMap.value).toBe(texture);
    expect(shader.uniforms.uHoleRect.value.toArray()).toEqual([-2000, -500, 500, 2500]);
    hole.set(null);
    expect(hole.active).toBe(false);
    expect(shader.uniforms.uHoleMap.value).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/city/groundHole.test.js`
Expected: FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi** — `src/city/groundHole.js`:

```js
/**
 * Lubang pada tanah dasar kota (y −0,05, menulis depth) di sel yang ditutup terrain distrik: tanpa
 * lubang, terrain di bawah y −0,05 (cekungan, danau) tertutup tanah dasar. Fragmen dibuang bila tekstur
 * R8 sel (NearestFilter, 1 = lubang) bernilai 1 di posisi dunia fragmen. Satu lubang aktif (distrik UNRI);
 * tanpa lubang shader identik perilaku lama (uniform uHoleOn = 0).
 */
import * as THREE from 'three';

const VERTEX_DECL = 'varying vec2 vHoleXZ;';
const FRAGMENT_DECL = 'varying vec2 vHoleXZ;\nuniform sampler2D uHoleMap;\nuniform vec4 uHoleRect;\nuniform float uHoleOn;';
const FRAGMENT_TEST = [
  'if (uHoleOn > 0.5) {',
  '  vec2 holeUv = (vHoleXZ - uHoleRect.xy) / (uHoleRect.zw - uHoleRect.xy);',
  '  if (all(greaterThanEqual(holeUv, vec2(0.0))) && all(lessThan(holeUv, vec2(1.0))) && texture2D(uHoleMap, holeUv).r > 0.5) discard;',
  '}',
].join('\n');

/** Sisipkan deklarasi & uji lubang ke sumber shader (murni; dites tanpa WebGL). */
export function patchShaderSource(shader) {
  return {
    vertexShader: shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_DECL}`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHoleXZ = (modelMatrix * vec4(transformed, 1.0)).xz;'),
    fragmentShader: shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_DECL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${FRAGMENT_TEST}`),
  };
}

/**
 * Pasang dukungan lubang pada material tanah dasar (sekali).
 * @param {THREE.Material} material
 * @returns {{set(hole:{texture:THREE.Texture, rect:{minX:number,minZ:number,maxX:number,maxZ:number}}|null):void, readonly active:boolean}}
 */
export function applyGroundHole(material) {
  const uniforms = {
    uHoleMap: { value: null },
    uHoleRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uHoleOn: { value: 0 },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const patched = patchShaderSource(shader);
    shader.vertexShader = patched.vertexShader;
    shader.fragmentShader = patched.fragmentShader;
  };
  material.customProgramCacheKey = () => 'kota-ground-hole-v1';
  material.needsUpdate = true;
  return {
    set(hole) {
      if (!hole) {
        uniforms.uHoleOn.value = 0;
        uniforms.uHoleMap.value = null;
        return;
      }
      const { minX, minZ, maxX, maxZ } = hole.rect;
      uniforms.uHoleRect.value.set(minX, minZ, maxX, maxZ);
      uniforms.uHoleMap.value = hole.texture;
      uniforms.uHoleOn.value = 1;
    },
    get active() { return uniforms.uHoleOn.value === 1; },
  };
}
```

`src/city/index.js`:

1. Cari:

```js
import { mountParkedVehicles } from './parkedVehicles.js';
```

   Ganti dengan:

```js
import { mountParkedVehicles } from './parkedVehicles.js';
import { applyGroundHole } from './groundHole.js';
```

2. Cari:

```js
  const materials = createCityMaterials();
  const ground = createCityGround(materials.ground);
```

   Ganti dengan:

```js
  const materials = createCityMaterials();
  const groundHole = applyGroundHole(materials.ground); // lubang untuk terrain distrik (M1)
  const ground = createCityGround(materials.ground);
```

3. Cari:

```js
    stats: () => ({ ...streamer.stats(), ...loader.stats() }),
```

   Ganti dengan:

```js
    stats: () => ({ ...streamer.stats(), ...loader.stats() }),
    /**
     * Lubang tanah dasar kota di sel yang ditutup terrain distrik (null = tanpa lubang).
     * @param {{texture: THREE.Texture, rect: {minX:number, minZ:number, maxX:number, maxZ:number}}|null} hole
     */
    setGroundHole: (hole) => groundHole.set(hole),
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/city`
Expected: PASS semua (tes kota lama tidak berubah: tanpa lubang `uHoleOn = 0`).

- [ ] **Step 5: Commit**

```bash
git add src/city/groundHole.js src/city/index.js tests/city/groundHole.test.js
```
```bash
git commit -m "feat(city): lubang tanah dasar kota per sel untuk terrain distrik (setGroundHole)"
```

---

### Task 16: `mountDistrict` (TDD)

**Files:**
- Create: `src/app/districtMount.js`
- Test: `tests/districtMount.test.js`

Tanda tangan indeks `mountDistrict(app, def, { terrain, collider, minimap, scheduler, createScope })` dipertahankan; opsi tambahan opsional: `city`, `weather`, `baseUrl`, `toast`, `logger`, `createStreamer`, `fetchJson`, `fetchArrayBuffer`, `createCanvas`. Hasil `{ def, district, mounted, whenSettled, dispose }` (superset `{ district, dispose }`). Pembongkaran LIFO: minimap → lubang → collider → sistem → registry basah → group → `district.dispose()` → `scope.dispose()`.

- [ ] **Step 1: Tulis tes**

```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { mountDistrict, minimapView } from '../src/app/districtMount.js';
import { defineDistrict } from '../src/districts/District.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';
import { createTerrainService } from '../src/app/terrainService.js';

const BOUNDARY = [[0, 0], [400, 0], [400, 300], [0, 300]];

function fakeApp() {
  const systems = new Map();
  return {
    scene: new THREE.Scene(),
    systems,
    addSystem(s) { systems.set(s.id, s); return s; },
    removeSystem(id) { return systems.delete(id); },
  };
}
const scheduler = () => ({ schedule: vi.fn(() => ({ cancel() {} })), cancelOwner: vi.fn(), pending: () => 0 });

function districtWith(buildResult) {
  return defineDistrict({ id: 'uji', boundary: BOUNDARY, manifestUrl: 'd/m.json', build: vi.fn(async () => buildResult) });
}

const goodBuild = (log) => ({
  group: new THREE.Group(),
  systems: [{ id: 'district.uji.a', phase: 'world', update() {} }],
  colliders: { isWalkable: () => true, isCameraClear: () => true },
  minimapLayer: vi.fn(),
  excludeIds: new Set(),
  whenSettled: async () => true,
  groundHole: { minX: 0, minZ: 0, cell: 4, cols: 100, rows: 75, data: new Uint8Array(7500) },
  dispose: () => log.push('district.dispose'),
});

describe('minimapView', () => {
  it('persegi memuat bbox + 20 m, utara di atas', () => {
    const v = minimapView({ minX: 0, minZ: 0, maxX: 400, maxZ: 300 }, 1000);
    expect(v.center).toEqual({ x: 200, z: 150 });
    expect(v.half).toBe(220);
    expect(v.toCanvas(-20, -70)).toEqual([0, 0]);
    const [px, py] = v.toCanvas(420, 370);
    expect(px).toBeCloseTo(1000, 9);
    expect(py).toBeCloseTo(1000, 9);
  });
});

describe('mountDistrict', () => {
  it('memasang group, sistem, collider, lubang, minimap; dispose membongkar terbalik', async () => {
    const log = [];
    const app = fakeApp();
    const collider = { addDistrict: vi.fn(() => () => log.push('collider.off')) };
    const city = { setGroundHole: vi.fn((h) => log.push(h ? 'hole.on' : 'hole.off')) };
    const minimap = { setBaseLayer: vi.fn(), removeBaseLayer: vi.fn(() => log.push('minimap.off')) };
    const ctx2d = {};
    const def = districtWith(goodBuild(log));
    const sched = scheduler();
    const m = await mountDistrict(app, def, {
      terrain: createTerrainService(), scheduler: sched, collider, city, minimap,
      createCanvas: (w, h) => ({ width: w, height: h, getContext: () => ctx2d }),
    });
    expect(m.mounted).toBe(true);
    expect(app.scene.children).toContain(m.district.group);
    expect(app.systems.has('district.uji.a')).toBe(true);
    expect(collider.addDistrict).toHaveBeenCalledWith(expect.objectContaining({ id: 'uji', bounds: def.bounds }));
    const hole = city.setGroundHole.mock.calls[0][0];
    expect(hole.rect).toEqual({ minX: 0, minZ: 0, maxX: 400, maxZ: 300 });
    expect(hole.texture.image.width).toBe(100);
    expect(minimap.setBaseLayer).toHaveBeenCalledWith('district:uji', expect.anything(), expect.objectContaining({ yaw: 0 }));
    expect(def.build.mock.calls[0][0]).toMatchObject({ owner: 'district:uji', baseUrl: '/' });
    m.dispose();
    m.dispose();
    expect(log).toEqual(['hole.on', 'minimap.off', 'hole.off', 'collider.off', 'district.dispose']);
    expect(app.systems.size).toBe(0);
    expect(app.scene.children).toHaveLength(0);
    expect(sched.cancelOwner).toHaveBeenCalledWith('district:uji');
  });

  it('build gagal → null, toast, scope dilepas', async () => {
    const toast = vi.fn();
    const scopes = [];
    const def = defineDistrict({ id: 'uji', boundary: BOUNDARY, manifestUrl: 'd/m.json', build: async () => { throw new Error('manifest 404'); } });
    const m = await mountDistrict(fakeApp(), def, {
      terrain: createTerrainService(), scheduler: scheduler(), toast, logger: { error() {} },
      createScope: (n) => { const s = createResourceScope(n); scopes.push(s); return s; },
    });
    expect(m).toBeNull();
    expect(toast).toHaveBeenCalledWith('Kawasan kampus gagal dimuat — peta kota tetap tersedia', false);
    expect(() => scopes[0].get('x', () => 1)).toThrow(/sudah di-dispose/);
  });

  it('onTerrainFail memberi toast sekali saja', async () => {
    const toast = vi.fn();
    let ctxSeen = null;
    const def = defineDistrict({
      id: 'uji', boundary: BOUNDARY, manifestUrl: 'd/m.json',
      build: async (ctx) => { ctxSeen = ctx; return goodBuild([]); },
    });
    await mountDistrict(fakeApp(), def, { terrain: createTerrainService(), scheduler: scheduler(), toast });
    ctxSeen.onTerrainFail();
    ctxSeen.onTerrainFail();
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/districtMount.test.js`
Expected: FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi**

```js
/**
 * Pasang distrik (spec §4.2) ke App dan bongkar lagi: build (ResourceScope milik distrik) → scene →
 * registry basah → sistem → collider komposit (region → distrik → tile) → lubang tanah dasar kota →
 * lapisan minimap. dispose() membongkar TERBALIK. Build gagal (manifest/terrain tak valid) → null +
 * toast: permainan berlanjut tanpa distrik (spec §10). Distrik memakai ChunkStreamer & fetch milik
 * city/ lewat injeksi (lapisan districts/ tidak boleh mengimpor city/).
 */
import * as THREE from 'three';
import { createResourceScope } from '../engine/ResourceScope.js';
import { validateDistrictBuild } from '../districts/District.js';
import { createChunkStreamer } from '../city/ChunkStreamer.js';
import { fetchJson as defaultFetchJson } from '../city/TileLoader.js';
import { fetchArrayBuffer as defaultFetchArrayBuffer } from '../districts/terrainChunks.js';

export const DISTRICT_MINIMAP_PX = 1024;
const MINIMAP_MARGIN = 20; // m di luar bbox batas

/** Persegi minimap (utara di atas) yang memuat bbox batas; toCanvas memetakan dunia → piksel. */
export function minimapView(bounds, size = DISTRICT_MINIMAP_PX, margin = MINIMAP_MARGIN) {
  const center = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
  const half = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + margin;
  const scale = size / (2 * half);
  return {
    center, half, size, scale,
    toCanvas: (x, z) => [(x - (center.x - half)) * scale, (z - (center.z - half)) * scale],
  };
}

/** Tekstur R8 sel lubang (data dibagi dengan distrik: needsUpdate saat berubah). */
export function createHoleTexture(hole) {
  const tex = new THREE.DataTexture(hole.data, hole.cols, hole.rows, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.unpackAlignment = 1; // lebar 625 bukan kelipatan 4
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

const defaultCanvas = (w, h) => {
  if (typeof document === 'undefined') return null;
  return Object.assign(document.createElement('canvas'), { width: w, height: h });
};

/**
 * @param {{scene: THREE.Scene, addSystem(s:object):object, removeSystem(id:string):boolean}} app
 * @param {ReturnType<typeof import('../districts/District.js').defineDistrict>} def
 * @param {{terrain:{field:object, heightAt:Function}, scheduler:{schedule:Function, cancelOwner(owner:string):void, pending(owner?:string):number},
 *   collider?:{addDistrict(d:object):() => void}|null, minimap?:{setBaseLayer(id:string, canvas:object, o:object):void,
 *   removeBaseLayer(id:string):void}|null, city?:{setGroundHole(h:object|null):void}|null,
 *   weather?:{registerWet(root:object):() => boolean}|null, createScope?:(name:string) => object, baseUrl?:string,
 *   toast?:(text:string, ok:boolean) => void, logger?:{error:(...a:unknown[]) => void},
 *   createStreamer?:(o:object) => object, fetchJson?:(url:string) => Promise<unknown>,
 *   fetchArrayBuffer?:(url:string) => Promise<ArrayBuffer>, createCanvas?:(w:number, h:number) => object|null}} opts
 * @returns {Promise<{def:object, district:object, readonly mounted:boolean, whenSettled(x:number, z:number):Promise<boolean>,
 *   dispose():void}|null>}
 */
export async function mountDistrict(app, def, {
  terrain, scheduler, collider = null, minimap = null, city = null, weather = null, createScope = createResourceScope,
  baseUrl = '/', toast = () => {}, logger = console, createStreamer = (o) => createChunkStreamer(o),
  fetchJson = defaultFetchJson, fetchArrayBuffer = defaultFetchArrayBuffer, createCanvas = defaultCanvas,
} = {}) {
  const owner = `district:${def.id}`;
  const scope = createScope(owner);
  let holeTexture = null;
  let warned = false;
  let district;
  try {
    district = validateDistrictBuild(await def.build({
      scene: app.scene, scope, terrain, scheduler, owner, baseUrl, fetchJson, fetchArrayBuffer, createStreamer, logger,
      onTerrainFail: () => {
        if (warned) return;
        warned = true;
        toast('Sebagian terrain kampus gagal dimuat — area itu datar', false);
      },
      groundHoleChanged: () => { if (holeTexture) holeTexture.needsUpdate = true; },
    }), def.id);
  } catch (err) {
    scheduler.cancelOwner(owner);
    scope.dispose();
    logger.error(`Distrik "${def.id}" gagal dipasang; lanjut tanpa distrik:`, err);
    toast('Kawasan kampus gagal dimuat — peta kota tetap tersedia', false);
    return null;
  }
  const undo = []; // LIFO
  const unwind = () => {
    while (undo.length) {
      const fn = undo.pop();
      try {
        fn();
      } catch (err) {
        logger.error(`Distrik "${def.id}": pembongkaran gagal (dilanjutkan):`, err);
      }
    }
  };
  try {
    undo.push(() => district.dispose());
    app.scene.add(district.group);
    undo.push(() => district.group.removeFromParent());
    if (weather) undo.push(weather.registerWet(district.group));
    for (const system of district.systems) {
      app.addSystem(system);
      undo.push(() => app.removeSystem(system.id));
    }
    if (collider) undo.push(collider.addDistrict({ id: def.id, boundary: def.boundary, bounds: def.bounds, colliders: district.colliders }));
    if (city && district.groundHole) {
      const h = district.groundHole;
      holeTexture = createHoleTexture(h);
      city.setGroundHole({ texture: holeTexture, rect: { minX: h.minX, minZ: h.minZ, maxX: h.minX + h.cols * h.cell, maxZ: h.minZ + h.rows * h.cell } });
      undo.push(() => {
        city.setGroundHole(null);
        holeTexture.dispose();
        holeTexture = null;
      });
    }
    const view = minimapView(def.bounds);
    const canvas = minimap ? createCanvas(view.size, view.size) : null;
    const ctx2d = canvas?.getContext?.('2d');
    if (ctx2d) {
      district.minimapLayer(ctx2d, view);
      const id = `district:${def.id}`;
      minimap.setBaseLayer(id, canvas, { center: view.center, half: view.half, yaw: 0 });
      undo.push(() => minimap.removeBaseLayer(id));
    }
  } catch (err) {
    unwind();
    scheduler.cancelOwner(owner);
    scope.dispose();
    logger.error(`Distrik "${def.id}": pemasangan gagal, digulung balik:`, err);
    toast('Kawasan kampus gagal dimuat — peta kota tetap tersedia', false);
    return null;
  }
  let mounted = true;
  return {
    def,
    district,
    get mounted() { return mounted; },
    whenSettled: (x, z) => (mounted ? district.whenSettled(x, z) : Promise.resolve(false)),
    dispose() {
      if (!mounted) return;
      mounted = false;
      scheduler.cancelOwner(owner);
      unwind();
      scope.dispose();
    },
  };
}
```

- [ ] **Step 4: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/districtMount.test.js`
Expected: PASS — `Tests  4 passed (4)`.

- [ ] **Step 5: Commit**

```bash
git add src/app/districtMount.js tests/districtMount.test.js
```
```bash
git commit -m "feat(app): mountDistrict — scene, sistem, collider berantai, lubang tanah kota, minimap, bongkar LIFO"
```

---

### Task 17: Fisika sepeda dengan grade (TDD)

**Files:**
- Modify: `src/config/constants.js` (blok `BIKE`), `src/sim/bikePhysics.js` (seluruh berkas)
- Test: `tests/bikePhysics.test.js` (tambah blok di akhir berkas)

Angka (dt 1/60): tanjakan 6 % → laju puncak 9 × (1 − 0,06 × 3) = 7,38 m/s (tercapai < 5 s tanpa sprint); masuk tanjakan pada 9 m/s → 8,75 m/s setelah 0,1 s (melambat 2,5 m/s², bukan dipotong); turunan 6 % tanpa kayuh → luncur 6 + g·0,06·0,55/0,6 ≈ 6,54 m/s; diam di 6 % tertahan, di 12 % menggelinding mundur (≥ −1,5 m/s); datar: identik dengan perilaku lama (termasuk lepas sprint dipotong seketika).

- [ ] **Step 1: Tulis tes** — tambahkan di akhir `tests/bikePhysics.test.js`:

```js
describe('stepBike dengan grade (tanjakan, M1)', () => {
  const PEDAL = { pedal: 1, steer: 0, sprint: false };
  const COAST = { pedal: 0, steer: 0, sprint: false };
  const runG = (state, input, seconds, grade) => {
    let s = state;
    for (let i = 0; i < seconds * 60; i += 1) s = stepBike(s, input, DT, { grade });
    return s;
  };
  const moving = (v) => ({ ...createBikeState(), v });

  it('konstanta tanjakan: kSlope 0,55', () => {
    expect(BIKE.kSlope).toBe(0.55);
  });

  it('paritas jalan datar: grade 0 = tanpa opsi; lepas sprint di datar tetap dipotong seketika ke maxSpeed', () => {
    expect(runG(createBikeState(), PEDAL, 4, 0)).toEqual(run(createBikeState(), PEDAL, 4));
    expect(stepBike(moving(13), PEDAL, DT).v).toBe(BIKE.maxSpeed);
  });

  it('tanjakan 6%: laju puncak 9 × (1 − 0,06 × 3) = 7,38 m/s, tercapai < 5 s tanpa sprint', () => {
    expect(runG(createBikeState(), PEDAL, 30, 0.06).v).toBeCloseTo(7.38, 2);
    expect(runG(createBikeState(), PEDAL, 5, 0.06).v).toBeGreaterThan(7);
  });

  it('masuk tanjakan pada 9 m/s: melambat halus 2,5 m/s² (bukan langsung dipotong)', () => {
    expect(runG(moving(9), PEDAL, 0.1, 0.06).v).toBeCloseTo(8.75, 2);
    expect(runG(moving(9), PEDAL, 3, 0.06).v).toBeCloseTo(7.38, 2);
  });

  it('turunan 6% tanpa kayuh: meluncur stabil ±6,54 m/s (datar: berhenti)', () => {
    expect(runG(moving(9), COAST, 20, -0.06).v).toBeCloseTo(6.54, 1);
    expect(runG(moving(9), COAST, 20, 0).v).toBeLessThan(0.01);
  });

  it('meluncur menanjak melambat lebih cepat daripada datar', () => {
    expect(runG(moving(5), COAST, 2, 0.06).v).toBeLessThan(runG(moving(5), COAST, 2, 0).v);
  });

  it('diam tanpa kayuh: tertahan di 6% (< holdGrade 8%), menggelinding mundur di 12%', () => {
    expect(runG(createBikeState(), COAST, 5, 0.06).v).toBe(0);
    const rolled = runG(createBikeState(), COAST, 5, 0.12).v;
    expect(rolled).toBeLessThan(-0.5);
    expect(rolled).toBeGreaterThanOrEqual(-BIKE.reverseSpeed);
  });

  it('grade NaN = datar; grade di-clamp ±30%', () => {
    expect(runG(createBikeState(), PEDAL, 1, Number.NaN)).toEqual(runG(createBikeState(), PEDAL, 1, 0));
    expect(runG(createBikeState(), PEDAL, 1, 5)).toEqual(runG(createBikeState(), PEDAL, 1, 0.3));
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/bikePhysics.test.js`
Expected: FAIL (`BIKE.kSlope` undefined; laju menanjak tetap 9).

- [ ] **Step 3: Konstanta** — di `src/config/constants.js`, cari:
```js
  leanSmoothing: 8,    // smoothing lean (1/s)
});
```
ganti dengan:
```js
  leanSmoothing: 8,    // smoothing lean (1/s)
  // Tanjakan (M1, spec §5.4): a = −g·grade·kSlope; batas laju turun saat menanjak, luncuran saat menurun.
  kSlope: 0.55,        // pengali gravitasi sepanjang lereng (dituning: 6% di laju jelajah berat tapi terdaki)
  maxGrade: 0.3,       // grade masukan di-clamp ±30%
  climbLoss: 3,        // laju puncak × (1 − grade·climbLoss) saat menanjak (6% → 82%)
  glidePerGrade: 100,  // laju luncur (m/s) per satuan grade turunan tanpa kayuh (6% → 6 m/s)
  holdGrade: 0.08,     // sepeda diam tanpa kayuh tidak menggelinding di lereng < 8%
  overspeedDecel: 2.5, // m/s² perlambatan halus bila laju > batas (mis. masuk tanjakan)
});
```

- [ ] **Step 4: Fisika** — ganti seluruh isi `src/sim/bikePhysics.js`:

```js
/**
 * Model kinematik sepeda (bicycle model), murni & immutable.
 * yaw 0 menghadap +Z; arah maju = (sin yaw, cos yaw).
 * yawRate = v / wheelBase · tan(steer).
 * Tanjakan (M1): opsi `grade` (dy/ds searah hadap, + = menanjak) menambah percepatan −g·grade·kSlope,
 * menurunkan laju puncak saat menanjak, dan memberi laju luncur saat menurun tanpa kayuh. Di lereng
 * < holdGrade sepeda yang diam tanpa kayuh tetap diam.
 */
import { BIKE } from '../config/constants.js';

const MAX_DT = 0.05;
const GRAVITY = 9.81;
const STOP_EPS = 0.05;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

/** State awal sepeda. */
export function createBikeState({ x = 0, z = 0, yaw = 0 } = {}) {
  return { x: num(x), z: num(z), yaw: num(yaw), v: 0, steer: 0, lean: 0, wheelSpin: 0, pedalAngle: 0 };
}

/** Normalisasi input: pedal/steer di [-1,1], NaN → 0. */
function sanitizeInput(input) {
  const i = input || {};
  return {
    pedal: clamp(num(i.pedal), -1, 1),
    steer: clamp(num(i.steer), -1, 1),
    sprint: Boolean(i.sprint),
  };
}

/** Laju puncak: berkurang saat menanjak (grade > 0). */
export function topSpeed(cfg, sprint, grade) {
  const top = sprint ? cfg.sprintSpeed : cfg.maxSpeed;
  return top * (1 - Math.min(0.5, Math.max(0, grade) * (cfg.climbLoss ?? 0)));
}

/** Kecepatan baru: kayuh / rem / mundur / drag / lereng, lalu dibatasi. */
function updateSpeed(v, input, dt, cfg, grade) {
  const top = topSpeed(cfg, input.sprint, grade);
  const glide = Math.min(top, Math.max(0, -grade) * (cfg.glidePerGrade ?? 0));
  let next = v;
  if (input.pedal > 0) {
    next += cfg.accel * input.pedal * dt;
  } else if (input.pedal < 0) {
    // rem bila masih maju, mundur pelan bila sudah berhenti
    next = v > STOP_EPS ? v - cfg.brake * -input.pedal * dt : v + cfg.reverseAccel * input.pedal * dt;
  }
  if (input.pedal <= 0) next -= cfg.drag * (next > 0 ? Math.max(0, next - glide) : next) * dt; // drag saat meluncur/rem
  const holding = Math.abs(v) < STOP_EPS && input.pedal === 0 && Math.abs(grade) < (cfg.holdGrade ?? 0);
  if (!holding) next -= GRAVITY * grade * (cfg.kSlope ?? 0) * dt;
  if (input.pedal >= 0 && v > STOP_EPS && next < 0) next = 0; // rem/drag tidak membalik arah
  // Di atas batas: datar → dipotong seketika (perilaku lama, mis. lepas sprint); menanjak → melambat halus.
  if (next > top) next = grade > 0 ? Math.max(top, Math.min(next, v) - (cfg.overspeedDecel ?? Infinity) * dt) : top;
  return Math.max(-cfg.reverseSpeed, next);
}

/** Sudut setang di-smooth dan dikurangi pada kecepatan tinggi. */
function updateSteer(steer, input, v, dt, cfg) {
  const speedFactor = 1 / (1 + cfg.steerSpeedFactor * Math.abs(v));
  const target = input.steer * cfg.steerMax * speedFactor;
  return steer + (target - steer) * Math.min(1, cfg.steerRate * dt);
}

/** Lean = −atan(v·yawRate/g), dibatasi leanMax, dengan smoothing. */
function updateLean(lean, v, yawRate, dt, cfg) {
  const target = clamp(-Math.atan((v * yawRate) / GRAVITY), -cfg.leanMax, cfg.leanMax);
  return lean + (target - lean) * Math.min(1, cfg.leanSmoothing * dt);
}

/**
 * Satu langkah simulasi. Mengembalikan state baru, tidak mengubah input.
 * @param {object} state
 * @param {{pedal?:number,steer?:number,sprint?:boolean}} input
 * @param {number} dt detik (di-clamp ≤ 0.05; NaN/≤0 → state disalin)
 * @param {{grade?:number, cfg?:typeof BIKE}} [opts] grade = dy/ds searah hadap (NaN → 0, di-clamp ±cfg.maxGrade)
 */
export function stepBike(state, input, dt, { grade = 0, cfg = BIKE } = {}) {
  const s = { ...createBikeState(), ...state };
  const step = num(dt);
  if (step <= 0) return s;
  const h = Math.min(step, MAX_DT);
  const inp = sanitizeInput(input);
  const limit = cfg.maxGrade ?? 0;
  const g = clamp(num(grade), -limit, limit);

  const v = updateSpeed(s.v, inp, h, cfg, g);
  const steer = updateSteer(s.steer, inp, v, h, cfg);
  const yawRate = (v / cfg.wheelBase) * Math.tan(steer);
  const yaw = s.yaw + yawRate * h;
  const spin = (v / cfg.wheelRadius) * h;

  return {
    x: s.x + v * Math.sin(yaw) * h,
    z: s.z + v * Math.cos(yaw) * h,
    yaw,
    v,
    steer,
    lean: updateLean(s.lean, v, yawRate, h, cfg),
    wheelSpin: s.wheelSpin + spin,
    pedalAngle: s.pedalAngle + Math.max(0, spin) * cfg.pedalRatio,
  };
}
```

- [ ] **Step 5: Jalankan — lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/bikePhysics.test.js`
Expected: PASS — `Tests  21 passed (21)` (13 lama + 8 baru).

- [ ] **Step 6: Commit**

```bash
git add src/config/constants.js src/sim/bikePhysics.js tests/bikePhysics.test.js
```
```bash
git commit -m "feat(sim): fisika sepeda dengan grade (kSlope 0,55, laju puncak menanjak, luncur menurun, tertahan < 8%)"
```

---

### Task 18: Sepeda, kamera, POV, ctx region-lokal mengikuti tanah (TDD)

**Files:**
- Modify: `src/entities/Bicycle.js`, `src/core/cameraMath.js`, `src/core/CameraRig.js`, `src/core/cameraPresets.js`, `src/core/PovDirector.js`, `src/app/regionContext.js`
- Test: `tests/terrainFollow.test.js`

- [ ] **Step 1: Tulis tes**

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '../src/core/CameraRig.js';
import { cameraFloor, THIRD } from '../src/core/cameraMath.js';
import { POV_BY_ID, createPose, liftPose, povPose } from '../src/core/cameraPresets.js';
import { createLocalContext, localHeightAt } from '../src/app/regionContext.js';
import { createRegionFrame, IDENTITY_FRAME } from '../src/geo/regionTransform.js';
import { Bicycle } from '../src/entities/Bicycle.js';

/** Terrain uji: bidang miring 10% ke timur, y = 0,1·x. */
const SLOPE = Object.freeze({
  heightAt: (x) => 0.1 * x,
  gradeAlong: (x, z, yaw) => 0.1 * Math.sin(yaw),
  normalAt: () => ({ x: 0, y: 1, z: 0 }),
  version: 1,
});

describe('cameraFloor', () => {
  it('tanah + minHeight; tak hingga → perilaku datar', () => {
    expect(cameraFloor(0)).toBeCloseTo(THIRD.minHeight, 12);
    expect(cameraFloor(2.5)).toBeCloseTo(2.95, 12);
    expect(cameraFloor(Number.NaN)).toBeCloseTo(0.45, 12);
  });
});

describe('povPose relatif tanah', () => {
  it('liftPose menaikkan posisi & titik pandang; 0/NaN tidak mengubah', () => {
    const p = { ...createPose(), py: 5, ty: 1 };
    liftPose(p, 2);
    expect([p.py, p.ty]).toEqual([7, 3]);
    liftPose(p, Number.NaN);
    liftPose(p, 0);
    expect([p.py, p.ty]).toEqual([7, 3]);
  });

  it('POV top-down di atas sepeda pada tanah 10 m naik 10 m; tanpa heightAt = perilaku lama', () => {
    const src = { bike: { x: 100, z: 0, yaw: 0 } };
    const a = createPose();
    const b = createPose();
    expect(povPose(POV_BY_ID.atas, src, 0, 0, a)).toBe(true);
    expect(povPose(POV_BY_ID.atas, src, 0, 0, b, SLOPE.heightAt)).toBe(true);
    expect(b.py - a.py).toBeCloseTo(10, 9);
    expect(b.ty - a.ty).toBeCloseTo(10, 9);
  });
});

describe('localHeightAt & createLocalContext', () => {
  const frame = createRegionFrame({ x: 100, z: -50, yaw: 0.3 });
  it('fungsi lokal = fungsi dunia di titik dunia yang sama; identitas = fungsi sama', () => {
    const local = localHeightAt(frame, SLOPE.heightAt);
    const w = frame.toWorld(5, -7);
    expect(local(5, -7)).toBeCloseTo(SLOPE.heightAt(w.x, w.z), 12);
    expect(localHeightAt(IDENTITY_FRAME, SLOPE.heightAt)).toBe(SLOPE.heightAt);
    expect(localHeightAt(frame, undefined)).toBeUndefined();
  });
  it('ctx lokal membawa heightAt lokal (dibungkus sekali)', () => {
    const toLocal = createLocalContext(frame);
    const a = toLocal({ heightAt: SLOPE.heightAt, bikePos: { x: 0, y: 0, z: 0 } });
    const b = toLocal({ heightAt: SLOPE.heightAt, bikePos: { x: 0, y: 0, z: 0 } });
    expect(a.heightAt).toBe(b.heightAt);
    const w = frame.toWorld(1, 2);
    expect(a.heightAt(1, 2)).toBeCloseTo(0.1 * w.x, 12);
  });
});

describe('CameraRig mengikuti tanah', () => {
  const make = () => new CameraRig(new THREE.PerspectiveCamera(60, 1, 0.3, 2500), document.createElement('canvas'));
  it('fokus.y = tanah; kamera orang ketiga ≥ tanah di bawah kamera + 0,45; orang pertama mata 1,55 m di atas tanah', () => {
    const rig = make();
    rig.setTerrain(SLOPE);
    const bike = { x: 50, z: 0, yaw: -Math.PI / 2 }; // menghadap barat (turun); kamera di timur (lebih tinggi)
    rig.pitch = -1.3; // lihat ke atas: kamera serendah mungkin
    for (let i = 0; i < 120; i += 1) rig.update(bike, 1 / 60, i / 60);
    expect(rig.focus.y).toBeCloseTo(5, 9);
    const cam = rig.camera.position;
    expect(cam.y).toBeGreaterThanOrEqual(0.1 * cam.x + 0.45 - 1e-6);
    rig.setMode('first');
    rig.update(bike, 1 / 60, 3);
    expect(rig.camera.position.y).toBeCloseTo(0.1 * rig.camera.position.x + 1.55, 1);
  });
  it('setTerrain(null) = datar (paritas)', () => {
    const rig = make();
    rig.setTerrain(null);
    rig.update({ x: 50, z: 0, yaw: 0 }, 1 / 60, 0);
    expect(rig.focus.y).toBe(0);
  });
});

describe('Bicycle mengikuti tanah', () => {
  it('y grup = heightAt, pitch menuju −atan(grade), grade masuk sim (menanjak lebih lambat)', () => {
    const climb = new Bicycle({ x: 0, z: 0, yaw: Math.PI / 2 }); // menghadap timur: menanjak 10%
    climb.setTerrain(SLOPE);
    const flat = new Bicycle({ x: 0, z: 0, yaw: Math.PI / 2 });
    const input = { isDown: (c) => c === 'KeyW', consumePress: () => false };
    for (let i = 0; i < 120; i += 1) {
      climb.update(1 / 60, { input });
      flat.update(1 / 60, { input });
    }
    expect(climb.group.position.y).toBeCloseTo(0.1 * climb.state.x, 6);
    expect(climb.position.y).toBeCloseTo(climb.groundY, 12);
    expect(climb.group.rotation.x).toBeCloseTo(-Math.atan(0.1), 2);
    expect(climb.state.v).toBeLessThan(flat.state.v);
    expect(flat.group.position.y).toBe(0);
    climb.dispose();
    flat.dispose();
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/terrainFollow.test.js`
Expected: FAIL (`cameraFloor`/`liftPose`/`localHeightAt` tidak diekspor; `setTerrain` bukan fungsi).

- [ ] **Step 3: `src/entities/Bicycle.js`**

1. Cari:

```js
 * steer > 0 = belok kiri (yaw bertambah). Sim memberi lean negatif saat belok kiri,
 * jadi lean dipakai langsung sebagai rotation.z rangka (condong ke dalam tikungan).
 */
```

   Ganti dengan:

```js
 * steer > 0 = belok kiri (yaw bertambah). Sim memberi lean negatif saat belok kiri,
 * jadi lean dipakai langsung sebagai rotation.z rangka (condong ke dalam tikungan).
 * Terrain (M1): y grup = heightAt(x, z); pitch grup = −atan(grade) dihaluskan (urutan Euler YXZ:
 * yaw lalu pitch lokal); grade searah hadap masuk ke sim (stepBike opsi grade).
 */
```

2. Cari:

```js
const COLLISION_DAMPING = 0.5;   // laju dikurangi saat collider menggeser posisi
const MAX_DT = 0.05;
```

   Ganti dengan:

```js
const COLLISION_DAMPING = 0.5;   // laju dikurangi saat collider menggeser posisi
const MAX_DT = 0.05;
const PITCH_SMOOTHING = 8;       // 1/s, pitch rangka mengikuti lereng
```

3. Cari:

```js
  #collider = null;
  #cfg;
  #posVec = new THREE.Vector3();
```

   Ganti dengan:

```js
  #collider = null;
  #cfg;
  #posVec = new THREE.Vector3();
  #terrain = null;
  #groundY = 0;
  #pitch = 0;
```

4. Cari:

```js
    this.group = mesh.group;
    this.group.name = 'bicycle';
```

   Ganti dengan:

```js
    this.group = mesh.group;
    this.group.name = 'bicycle';
    this.group.rotation.order = 'YXZ'; // yaw dulu, lalu pitch lereng di sumbu X lokal
```

5. Cari:

```js
  /** Tampilkan/sembunyikan pengendara (disembunyikan di kamera orang pertama: kamera berada di kepalanya). */
```

   Ganti dengan:

```js
  /**
   * Pasang layanan terrain ({heightAt, gradeAlong}); null = datar. Tinggi tanah langsung diperbarui
   * (teleport/perjalanan cepat tidak menunggu frame berikutnya).
   */
  setTerrain(terrain) {
    this.#terrain = terrain && typeof terrain.heightAt === 'function' ? terrain : null;
    this.#groundY = this.#terrain ? this.#terrain.heightAt(this.state.x, this.state.z) : 0;
    this.#applyVisual();
  }

  /** Tinggi tanah di bawah sepeda (m). */
  get groundY() { return this.#groundY; }

  /** Tampilkan/sembunyikan pengendara (disembunyikan di kamera orang pertama: kamera berada di kepalanya). */
```

6. Cari:

```js
  get position() { return this.#posVec.set(this.state.x, 0, this.state.z); }
```

   Ganti dengan:

```js
  get position() { return this.#posVec.set(this.state.x, this.#groundY, this.state.z); }
```

7. Cari:

```js
    const next = stepBike(this.state, cmd, step, this.#cfg);
    this.state = isStateFinite(next) ? this.#resolveCollision(next) : this.state;
    this.#applyVisual();
```

   Ganti dengan:

```js
    const t = this.#terrain;
    const grade = t ? t.gradeAlong(this.state.x, this.state.z, this.state.yaw) : 0;
    const next = stepBike(this.state, cmd, step, { grade, cfg: this.#cfg });
    this.state = isStateFinite(next) ? this.#resolveCollision(next) : this.state;
    this.#updateGround(step);
    this.#applyVisual();
```

8. Cari:

```js
  /** Salin state ke transform mesh & pose pengendara. */
```

   Ganti dengan:

```js
  /** Tinggi tanah & pitch rangka (−atan(grade), dihaluskan) dari terrain di posisi baru. */
  #updateGround(dt) {
    const t = this.#terrain;
    if (!t) return;
    const s = this.state;
    this.#groundY = t.heightAt(s.x, s.z);
    const target = -Math.atan(t.gradeAlong(s.x, s.z, s.yaw));
    this.#pitch += (target - this.#pitch) * Math.min(1, PITCH_SMOOTHING * dt);
  }

  /** Salin state ke transform mesh & pose pengendara. */
```

9. Cari:

```js
    this.group.position.set(s.x, 0, s.z);
    this.group.rotation.y = s.yaw;
```

   Ganti dengan:

```js
    this.group.position.set(s.x, this.#groundY, s.z);
    this.group.rotation.y = s.yaw;
    this.group.rotation.x = this.#pitch;
```

- [ ] **Step 4: `src/core/cameraMath.js`**

1. Cari:

```js
/** Vektor arah pandang orang pertama (satuan). pitch positif = melihat ke bawah. */
```

   Ganti dengan:

```js
/**
 * Lantai kamera (M1): tinggi minimum kamera = tanah di bawah KAMERA + minHeight. groundY tak hingga → 0
 * (perilaku lama tanah datar).
 */
export function cameraFloor(groundY, cfg = THIRD) {
  return fin(groundY) + cfg.minHeight;
}

/** Vektor arah pandang orang pertama (satuan). pitch positif = melihat ke bawah. */
```

2. Cari:

```js
const MIN_HEIGHT = 0.45;       // kamera tidak boleh lebih rendah dari ini (tanah = 0)
```

   Ganti dengan:

```js
const MIN_HEIGHT = 0.45;       // kamera tidak boleh lebih rendah dari ini di atas tanah (lihat cameraFloor)
```

- [ ] **Step 5: `src/core/CameraRig.js`** (jangkar di luar baris 137–157 yang diubah M0)

1. Cari:

```js
  THIRD, decayLook, firstPersonDirection, pullInOffset, shouldSnap, sweepOffset, thirdPersonOffset, wrapAngle,
} from './cameraMath.js';
```

   Ganti dengan:

```js
  THIRD, cameraFloor, decayLook, firstPersonDirection, pullInOffset, shouldSnap, sweepOffset, thirdPersonOffset, wrapAngle,
} from './cameraMath.js';
```

2. Cari:

```js
const PITCH_LIMIT = Math.PI / 2.4;
```

   Ganti dengan:

```js
const PITCH_LIMIT = Math.PI / 2.4;
const FLAT = () => 0;
```

3. Cari:

```js
    this.director = new PovDirector(camera);
```

   Ganti dengan:

```js
    this.director = new PovDirector(camera);
    this._heightAt = FLAT;                   // tanah (M1): fokus/target/lantai kamera relatif heightAt
```

4. Cari:

```js
  /** Pasang uji ruang bebas kamera `(x, z) => boolean` (lihat Collider.isCameraClear); null = tanpa tabrakan. */
```

   Ganti dengan:

```js
  /** Pasang layanan terrain ({heightAt}); null = datar. Diteruskan ke PovDirector (pose POV relatif tanah). */
  setTerrain(terrain) {
    this._heightAt = typeof terrain?.heightAt === 'function' ? terrain.heightAt : FLAT;
    this.director.setHeightAt(this._heightAt === FLAT ? null : this._heightAt);
  }

  /** Pasang uji ruang bebas kamera `(x, z) => boolean` (lihat Collider.isCameraClear); null = tanpa tabrakan. */
```

5. Cari:

```js
    this._bike = bike;
    this.focus.set(bike.x, 0, bike.z);
    if (this.director.active && this._source) {
      const handled = this.director.update(dt, time, this._source, this._playerPose);
      if (this.director.active) this.focus.set(this.director.focus.x, 0, this.director.focus.z);
```

   Ganti dengan:

```js
    this._bike = bike;
    this.focus.set(bike.x, this._heightAt(bike.x, bike.z), bike.z);
    if (this.director.active && this._source) {
      const handled = this.director.update(dt, time, this._source, this._playerPose);
      const f = this.director.focus;
      if (this.director.active) this.focus.set(f.x, this._heightAt(f.x, f.z), f.z);
```

6. Cari:

```js
    outPos.set(bike.x + eye.x, eye.y, bike.z + eye.z);
```

   Ganti dengan:

```js
    outPos.set(bike.x + eye.x, this._heightAt(bike.x, bike.z) + eye.y, bike.z + eye.z);
```

7. Cari:

```js
    outTarget.set(bike.x, THIRD.lookHeight, bike.z);
```

   Ganti dengan:

```js
    outTarget.set(bike.x, this._heightAt(bike.x, bike.z) + THIRD.lookHeight, bike.z);
```

8. Cari:

```js
    cam.set(this._target.x + safe.x, Math.max(THIRD.minHeight, this._target.y + safe.y), this._target.z + safe.z);
```

   Ganti dengan:

```js
    const cx = this._target.x + safe.x;
    const cz = this._target.z + safe.z;
    cam.set(cx, Math.max(cameraFloor(this._heightAt(cx, cz)), this._target.y + safe.y), cz); // lantai = tanah di bawah kamera
```

- [ ] **Step 6: `src/core/cameraPresets.js`** (M0 menambah case `'region'` di `switch`; sisipan M1 di akhir fungsi, sesudah `poseToWorld`)

1. Cari:

```js
 * @param {ReturnType<typeof createPose>} out
 * @returns {boolean} false bila subjek tidak tersedia (pose tidak diubah)
 */
export function povPose(def, src, subject, time, out) {
```

   Ganti dengan:

```js
 * @param {ReturnType<typeof createPose>} out
 * @param {((x:number, z:number) => number)|null} [heightAt] tanah dunia (M1): posisi & titik pandang dinaikkan
 *   setinggi tanah di titik pandang (dunia); null/tanpa = datar (perilaku lama)
 * @returns {boolean} false bila subjek tidak tersedia (pose tidak diubah)
 */
export function povPose(def, src, subject, time, out, heightAt = null) {
```

2. Cari:

```js
  if (def.kind !== 'follow' && src.frame && !src.frame.identity) poseToWorld(out, src.frame); // pose tetap region-lokal
  out.fov = def.fov;
  return true;
```

   Ganti dengan:

```js
  if (def.kind !== 'follow' && src.frame && !src.frame.identity) poseToWorld(out, src.frame); // pose tetap region-lokal
  if (heightAt && def.kind !== 'region') liftPose(out, heightAt(out.tx, out.tz)); // POV region (M0): pose dunia sudah relatif tanah
  out.fov = def.fov;
  return true;
```

3. Cari:

```js
/**
 * Terapkan orbit pengguna (yaw, pitch, zoom) mengelilingi titik pandang: posisi
```

   Ganti dengan:

```js
/** Naikkan pose (posisi & titik pandang) setinggi `ground` m; tak hingga/0 → tidak diubah. */
export function liftPose(pose, ground) {
  if (!Number.isFinite(ground) || ground === 0) return pose;
  pose.py += ground;
  pose.ty += ground;
  return pose;
}

/**
 * Terapkan orbit pengguna (yaw, pitch, zoom) mengelilingi titik pandang: posisi
```

POV region (M0, `kind: 'region'`) tidak diangkat: pose region sudah dunia dan bertanggung jawab atas tanahnya sendiri (region memakai `ctx.heightAtLocal`, M4/M6).

- [ ] **Step 7: `src/core/PovDirector.js`** (M0 mengubah baris 40/45/52)

Di constructor, sesudah baris `this._src = null; // sumber POV terakhir (label subjek POV region)` (sisipan M0; sebelum `}` penutup constructor), sisipkan:
```js
    this._heightAt = null;  // (x, z) → tinggi tanah dunia; null = datar
```
Sesudah `}` penutup constructor, sisipkan metode:
```js

  /** Pose POV relatif tanah di titik pandang (M1); null = datar (perilaku lama). */
  setHeightAt(fn) { this._heightAt = typeof fn === 'function' ? fn : null; }
```
Ganti:
```js
    if (!povPose(def, src, subject, 0, this._raw)) return false;
```
menjadi:
```js
    if (!povPose(def, src, subject, 0, this._raw, this._heightAt)) return false;
```
Ganti:
```js
    if (povPose(def, src, this.subject, time, this._raw)) {
```
menjadi:
```js
    if (povPose(def, src, this.subject, time, this._raw, this._heightAt)) {
```
(Bila M0 mengganti nama variabel di dua panggilan itu, cukup tambahkan argumen keenam `this._heightAt` pada kedua panggilan `povPose(...)`; `grep -n "povPose(" src/core/PovDirector.js` harus menampilkan tepat 2 baris berargumen `this._heightAt`.)

- [ ] **Step 8: `src/app/regionContext.js`** (M0 mungkin menghapus `pointToLocal` dari pemakai, fungsi tetap ada)

1. Cari:

```js
/**
 * Konteks frame untuk sistem region-lokal (entitas, cerita): ctx dunia → ctx dengan bikePos/focus
 * dalam koordinat region. Hasil di-cache per objek ctx (satu konversi per frame untuk semua
 * entitas). Frame identitas mengembalikan ctx apa adanya (paritas bit-exact).
 */
```

   Ganti dengan:

```js
/**
 * Konteks frame untuk sistem region-lokal (entitas, cerita): ctx dunia → ctx dengan bikePos/focus
 * dalam koordinat region dan `heightAt(lx, lz)` (M1) yang menerima koordinat region. Hasil di-cache per
 * objek ctx (satu konversi per frame untuk semua entitas). Frame identitas mengembalikan ctx apa adanya
 * (paritas bit-exact; heightAt dunia = lokal).
 */
```

2. Cari:

```js
/** @param {{identity:boolean, toLocal(x:number, z:number):{x:number,z:number}}} frame */
export function createLocalContext(frame) {
  if (frame.identity) return (ctx) => ctx;
  let lastIn = null;
  let lastOut = null;
  return (ctx) => {
    if (ctx === lastIn) return lastOut;
    lastIn = ctx;
    lastOut = { ...ctx, bikePos: localPoint(frame, ctx.bikePos), focus: localPoint(frame, ctx.focus) };
    return lastOut;
  };
}
```

   Ganti dengan:

```js
/**
 * Fungsi tinggi tanah berkoordinat region-lokal dari fungsi dunia; frame identitas → fungsi yang sama.
 * @param {{identity:boolean, toWorld(x:number, z:number):{x:number,z:number}}} frame
 * @param {((x:number, z:number) => number)|undefined} heightAt dunia
 */
export function localHeightAt(frame, heightAt) {
  if (typeof heightAt !== 'function' || frame.identity) return heightAt;
  return (lx, lz) => {
    const w = frame.toWorld(lx, lz);
    return heightAt(w.x, w.z);
  };
}

/** @param {{identity:boolean, toLocal(x:number, z:number):{x:number,z:number}, toWorld(x:number, z:number):{x:number,z:number}}} frame */
export function createLocalContext(frame) {
  if (frame.identity) return (ctx) => ctx;
  let lastIn = null;
  let lastOut = null;
  let worldHeight;
  let localHeight;
  return (ctx) => {
    if (ctx === lastIn) return lastOut;
    lastIn = ctx;
    if (ctx.heightAt !== worldHeight) { // fungsi dunia jarang berganti: bungkus sekali
      worldHeight = ctx.heightAt;
      localHeight = localHeightAt(frame, worldHeight);
    }
    lastOut = { ...ctx, bikePos: localPoint(frame, ctx.bikePos), focus: localPoint(frame, ctx.focus), heightAt: localHeight };
    return lastOut;
  };
}
```

- [ ] **Step 9: Jalankan — lulus**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/terrainFollow.test.js tests/cameraMath.test.js tests/cameraPresets.test.js tests/povDirector.test.js tests/cameraRigLook.test.js tests/cameraRigPlayer.test.js tests/regionContext.test.js tests/cameraClear.test.js tests/regionPov.test.js
```
Expected: PASS semua — `terrainFollow` 8 tes; tes kamera/POV lama tidak berubah (tanpa terrain = datar, paritas bit-exact: `0 + 1.3 === 1.3`).

- [ ] **Step 10: Commit**

```bash
git add src/entities/Bicycle.js src/core/cameraMath.js src/core/CameraRig.js src/core/cameraPresets.js src/core/PovDirector.js src/app/regionContext.js tests/terrainFollow.test.js
```
```bash
git commit -m "feat: sepeda (y, pitch, grade), kamera (fokus/target/lantai), POV, dan ctx region-lokal mengikuti tanah"
```

---

### Task 19: Entitas & penanda di atas tanah

**Files:**
- Modify: `src/entities/util.js`, `src/entities/Runner.js`, `src/entities/Footballer.js`, `src/entities/Vendor.js`, `src/entities/Crowd.js`, `src/entities/Crowd.plaza.js`, `src/entities/StoryNpcs.js`, `src/world/StoryMarkers.js`
- Test: `tests/entitiesGround.test.js`

Entitas region menerima ctx region-lokal (`toLocalCtx`, Task 18) dengan `heightAt(lx, lz)`; tanpa `heightAt` → `flatGround` (paritas). Tribun (penonton duduk) tidak diubah: kursi berada di struktur stadion, bukan di tanah.

- [ ] **Step 1: Tulis tes**

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildEntities } from '../src/entities/index.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';
import { StoryNpcs } from '../src/entities/StoryNpcs.js';
import { createStoryMarkers } from '../src/world/StoryMarkers.js';
import { flatGround, groundOf } from '../src/entities/util.js';

describe('entitas region berdiri di atas ctx.heightAt (M1)', () => {
  it('groundOf: fungsi ctx atau datar', () => {
    const f = () => 1;
    expect(groundOf({ heightAt: f })).toBe(f);
    expect(groundOf({})).toBe(flatGround);
    expect(groundOf(undefined)(5, 5)).toBe(0);
  });

  it('pelari, pemain bola, pedagang: y = heightAt; tanpa heightAt tetap 0 (paritas)', { timeout: 60000 }, async () => {
    const region = await stadionRegion.build({ scope: createResourceScope('uji-tanah'), loadModels: false });
    const ents = buildEntities({ start: { x: 0, z: -300, yaw: 0 }, world: region, wallet: undefined });
    const ys = (ctx) => {
      for (const e of ents.updatables) if (e !== ents.bike) e.update(1 / 60, ctx);
      const out = [];
      ents.regionGroup.traverse((o) => {
        if (/^(runner|vendor|player)-/.test(o.name ?? '')) out.push(o.position.y);
      });
      return out;
    };
    const flat = ys({ time: 1, bikePos: { x: 0, y: 0, z: 0 } });
    expect(flat.length).toBeGreaterThan(5);
    expect(flat.every((y) => y === 0)).toBe(true);
    const raised = ys({ time: 2, heightAt: () => 2, bikePos: { x: 0, y: 2, z: 0 } });
    expect(raised.every((y) => y === 2)).toBe(true);
    ents.bike.dispose();
    region.dispose();
  });

  it('NPC cerita & penanda misi mengikuti tanah', () => {
    const npcs = new StoryNpcs();
    npcs.placeOnGround(() => 3);
    expect(npcs.group.children.every((c) => c.position.y === 3)).toBe(true);
    const markers = createStoryMarkers({ ground: (x, z) => x + z });
    markers.setTarget({ x: 1, z: 2 });
    expect(markers.group.position.y).toBe(3);
    markers.update(0);
    expect(markers.group.position.y).toBe(3);
    markers.setTarget(null);
    expect(markers.group.visible).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan — gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/entitiesGround.test.js`
Expected: FAIL (`flatGround`/`groundOf` tidak diekspor).

- [ ] **Step 3: `src/entities/util.js`**

1. Cari:

```js
export function clamp(v, lo, hi) {
```

   Ganti dengan:

```js
/** Tanah datar (default sebelum/ tanpa terrain). */
export const flatGround = () => 0;

/** Fungsi tinggi tanah dari ctx frame (region-lokal untuk entitas region, lihat app/regionContext.js). */
export const groundOf = (ctx) => (typeof ctx?.heightAt === 'function' ? ctx.heightAt : flatGround);

export function clamp(v, lo, hi) {
```

- [ ] **Step 4: `src/entities/Runner.js`**

1. Cari:

```js
import { makeRng, range, isFiniteXZ, yawFromDir, clamp } from './util.js';
```

   Ganti dengan:

```js
import { makeRng, range, isFiniteXZ, yawFromDir, clamp, flatGround, groundOf } from './util.js';
```

2. Cari:

```js
    this.#place(this.#runners[this.#runners.length - 1], 0);
  }

  /** Salin posisi/yaw dari path lane ke mesh. */
  #place(r, time) {
    const { dist, speed, lane } = readRunner(r.sim);
    const p = pointOnLane(lane, dist);
    if (!isFiniteXZ(p)) return;
    r.h.group.position.set(p.x, 0, p.z);
```

   Ganti dengan:

```js
    this.#place(this.#runners[this.#runners.length - 1], 0, flatGround);
  }

  /** Salin posisi/yaw dari path lane ke mesh; y = tanah (ctx.heightAt, region-lokal). */
  #place(r, time, ground) {
    const { dist, speed, lane } = readRunner(r.sim);
    const p = pointOnLane(lane, dist);
    if (!isFiniteXZ(p)) return;
    r.h.group.position.set(p.x, ground(p.x, p.z), p.z);
```

3. Cari:

```js
    this.#runners = this.#runners.map((r) => ({ ...r, sim: stepRunner(r.sim, step) }));
    for (const r of this.#runners) this.#place(r, time);
```

   Ganti dengan:

```js
    const ground = groundOf(ctx);
    this.#runners = this.#runners.map((r) => ({ ...r, sim: stepRunner(r.sim, step) }));
    for (const r of this.#runners) this.#place(r, time, ground);
```

4. Cari:

```js
    for (const w of this.#walkers) this.#place(w, 0);
  }

  /** Posisi pada elips dengan offset lateral (sepanjang normal keluar). */
  #place(w, time) {
```

   Ganti dengan:

```js
    for (const w of this.#walkers) this.#place(w, 0, flatGround);
  }

  /** Posisi pada elips dengan offset lateral (sepanjang normal keluar); y = tanah + yOffset. */
  #place(w, time, ground) {
```

5. Cari:

```js
    w.h.group.position.set(a * c + (nx / nl) * w.lateral, this.#yOffset, b * s + (nz / nl) * w.lateral);
```

   Ganti dengan:

```js
    const x = a * c + (nx / nl) * w.lateral;
    const z = b * s + (nz / nl) * w.lateral;
    w.h.group.position.set(x, ground(x, z) + this.#yOffset, z);
```

6. Cari:

```js
      return { ...w, theta: w.theta + (w.dir * w.speed * step) / dsdθ };
    });
    for (const w of this.#walkers) this.#place(w, time);
```

   Ganti dengan:

```js
      return { ...w, theta: w.theta + (w.dir * w.speed * step) / dsdθ };
    });
    const ground = groundOf(ctx);
    for (const w of this.#walkers) this.#place(w, time, ground);
```

- [ ] **Step 5: `src/entities/Footballer.js`**

1. Cari:

```js
import { makeRng, isFiniteXZ, clamp } from './util.js';
```

   Ganti dengan:

```js
import { makeRng, isFiniteXZ, clamp, flatGround, groundOf } from './util.js';
```

2. Cari:

```js
    this.#applyVisual(0, 0);
  }
```

   Ganti dengan:

```js
    this.#applyVisual(0, 0, flatGround);
  }
```

3. Cari:

```js
    if (isFiniteXZ(next.ball?.pos)) this.match = next;
    this.#applyVisual(ctx.time ?? 0, step);
  }

  #applyVisual(time, dt) {
    for (const p of this.match.players) this.#applyPlayer(p, time);
    const b = this.match.ball;
    // sim: pos.y = pusat bola (= radius saat di tanah)
    this.#ball.position.set(b.pos.x, Number.isFinite(b.pos.y) ? b.pos.y : this.#ballRadius, b.pos.z);
```

   Ganti dengan:

```js
    if (isFiniteXZ(next.ball?.pos)) this.match = next;
    this.#applyVisual(ctx.time ?? 0, step, groundOf(ctx));
  }

  #applyVisual(time, dt, ground) {
    for (const p of this.match.players) this.#applyPlayer(p, time, ground);
    const b = this.match.ball;
    // sim: pos.y = pusat bola di atas tanah (= radius saat di tanah)
    const lift = ground(b.pos.x, b.pos.z);
    this.#ball.position.set(b.pos.x, lift + (Number.isFinite(b.pos.y) ? b.pos.y : this.#ballRadius), b.pos.z);
```

4. Cari:

```js
  #applyPlayer(p, time) {
    const entry = this.#players.get(p.id);
    if (!entry || !isFiniteXZ(p.pos)) return;
    const { h, phase } = entry;
    h.group.position.set(p.pos.x, 0, p.pos.z);
```

   Ganti dengan:

```js
  #applyPlayer(p, time, ground) {
    const entry = this.#players.get(p.id);
    if (!entry || !isFiniteXZ(p.pos)) return;
    const { h, phase } = entry;
    h.group.position.set(p.pos.x, ground(p.pos.x, p.pos.z), p.pos.z);
```

- [ ] **Step 6: `src/entities/Vendor.js`**

1. Cari:

```js
    this.#place(entry, 0);
    this.#attachAsync(entry, kind, name);
```

   Ganti dengan:

```js
    this.#place(entry, 0, flatGround);
    this.#attachAsync(entry, kind, name);
```

2. Cari:

```js
  #place(entry, time) {
    const { sim, h, root } = entry;
    if (!isFiniteXZ(sim.pos)) return;
    root.position.set(sim.pos.x, 0, sim.pos.z);
```

   Ganti dengan:

```js
  #place(entry, time, ground) {
    const { sim, h, root } = entry;
    if (!isFiniteXZ(sim.pos)) return;
    root.position.set(sim.pos.x, ground(sim.pos.x, sim.pos.z), sim.pos.z);
```

3. Cari:

```js
    for (const e of this.#vendors) this.#place(e, time);
```

   Ganti dengan:

```js
    const ground = groundOf(ctx);
    for (const e of this.#vendors) this.#place(e, time, ground);
```

4. Cari:

```js
import { makeRng, isFiniteXZ, lerpAngle, clamp, HAS_DOM } from './util.js';
```

   Ganti dengan:

```js
import { makeRng, isFiniteXZ, lerpAngle, clamp, HAS_DOM, flatGround, groundOf } from './util.js';
```

- [ ] **Step 7: `src/entities/Crowd.js` dan `src/entities/Crowd.plaza.js`**

`Crowd.js`:

1. Cari:

```js
    this.#plaza?.update(step, time);
```

   Ganti dengan:

```js
    this.#plaza?.update(step, time, groundOf(ctx));
```

2. Cari:

```js
import { makeRng, pick, clamp } from './util.js';
```

   Ganti dengan:

```js
import { makeRng, pick, clamp, groundOf } from './util.js';
```

`Crowd.plaza.js`:

1. Cari:

```js
import { matFor, range, yawFromDir, lerpAngle, clamp } from './util.js';
```

   Ganti dengan:

```js
import { matFor, range, yawFromDir, lerpAngle, clamp, flatGround } from './util.js';
```

2. Cari:

```js
  return { group: g, update: (time) => people.forEach((p) => animateExercise(p.h, time, p.offset)) };
```

   Ganti dengan:

```js
  const update = (time, ground) => {
    g.position.y = ground(spot.x, spot.z);
    people.forEach((p) => animateExercise(p.h, time, p.offset));
  };
  return { group: g, update };
```

3. Cari:

```js
  const update = (dt, time) => {
    state.t += dt;
```

   Ganti dengan:

```js
  const update = (dt, time, ground) => {
    g.position.y = ground(spot.x, spot.z);
    state.t += dt;
```

4. Cari:

```js
  const update = (dt, time) => {
    for (const s of skaters) {
      s.theta += (s.dir * SKATE.speed * dt) / SKATE.radius;
      const c = Math.cos(s.theta), sn = Math.sin(s.theta);
      s.h.group.position.set(s.cx + SKATE.radius * c, 0.09, s.cz + SKATE.radius * sn);
```

   Ganti dengan:

```js
  const update = (dt, time, ground) => {
    for (const s of skaters) {
      s.theta += (s.dir * SKATE.speed * dt) / SKATE.radius;
      const c = Math.cos(s.theta), sn = Math.sin(s.theta);
      const x = s.cx + SKATE.radius * c;
      const z = s.cz + SKATE.radius * sn;
      s.h.group.position.set(x, ground(x, z) + 0.09, z);
```

5. Cari:

```js
  const update = (dt, time) => {
    for (const w of walkers) stepWalker(w, dt, time, center, rng);
  };
```

   Ganti dengan:

```js
  const update = (dt, time, ground) => {
    for (const w of walkers) stepWalker(w, dt, time, center, rng, ground);
  };
```

6. Cari:

```js
function stepWalker(w, dt, time, center, rng) {
  const p = w.h.group.position;
```

   Ganti dengan:

```js
function stepWalker(w, dt, time, center, rng, ground) {
  const p = w.h.group.position;
  p.y = ground(p.x, p.z);
```

7. Cari:

```js
 * @returns {{group:THREE.Group, update:(dt:number, time:number) => void, humanoidCount:number}}
```

   Ganti dengan:

```js
 * @returns {{group:THREE.Group, update:(dt:number, time:number, ground?:(x:number, z:number) => number) => void, humanoidCount:number}}
```

8. Cari:

```js
  const update = (dt, time) => {
    acts[0].update(time);
    acts[1].update(dt, time);
    acts[2].update(dt, time);
    acts[3].update(dt, time);
  };
```

   Ganti dengan:

```js
  const update = (dt, time, ground = flatGround) => {
    acts[0].update(time, ground);
    acts[1].update(dt, time, ground);
    acts[2].update(dt, time, ground);
    acts[3].update(dt, time, ground);
  };
```

- [ ] **Step 8: `src/entities/StoryNpcs.js` dan `src/world/StoryMarkers.js`**

`StoryNpcs.js`:

1. Cari:

```js
export class StoryNpcs {
  group = new THREE.Group();
  #labels = []; // { npc, label } (label dibuat sinkron di browser)
```

   Ganti dengan:

```js
export class StoryNpcs {
  group = new THREE.Group();
  #labels = []; // { npc, label } (label dibuat sinkron di browser)
  #bodies = []; // { npc, group }
```

2. Cari:

```js
      h.group.rotation.y = npc.yaw;
      this.group.add(h.group);
```

   Ganti dengan:

```js
      h.group.rotation.y = npc.yaw;
      this.group.add(h.group);
      this.#bodies.push({ npc, group: h.group });
```

3. Cari:

```js
  update() {}
```

   Ganti dengan:

```js
  /** Berdiri di atas tanah: ground(lx, lz) region-lokal (ctx.heightAt); dipanggil tiap frame (2 NPC, murah). */
  placeOnGround(ground) {
    if (typeof ground !== 'function') return;
    for (const { npc, group } of this.#bodies) group.position.y = ground(npc.x, npc.z);
  }

  update() {}
```

`StoryMarkers.js`:

1. Cari:

```js
export function createStoryMarkers() {
```

   Ganti dengan:

```js
/** @param {{ground?: (x:number, z:number) => number}} [opts] tinggi tanah di koordinat induk penanda (M1) */
export function createStoryMarkers({ ground = () => 0 } = {}) {
```

2. Cari:

```js
  group.add(beam, ring, disc);
```

   Ganti dengan:

```js
  group.add(beam, ring, disc);
  let target = null;
```

3. Cari:

```js
    setTarget(point) {
      group.visible = Boolean(point);
      if (point) group.position.set(point.x, 0, point.z);
    },
    update(time) {
      ring.scale.setScalar(1 + 0.15 * Math.sin(time * PULSE_SPEED));
    },
```

   Ganti dengan:

```js
    setTarget(point) {
      group.visible = Boolean(point);
      target = point ? { x: point.x, z: point.z } : null;
      if (point) group.position.set(point.x, ground(point.x, point.z), point.z);
    },
    update(time) {
      ring.scale.setScalar(1 + 0.15 * Math.sin(time * PULSE_SPEED));
      if (target) group.position.y = ground(target.x, target.z); // chunk terrain bisa termuat belakangan
    },
```

- [ ] **Step 9: Jalankan — lulus**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/entitiesGround.test.js tests/npcLabels.test.js tests/humanoidLod.test.js tests/vendorSim.test.js tests/storyDirector.test.js
npm run lint
```
Expected: PASS semua (`entitiesGround` 3 tes, ±10 s karena membangun stadion); lint 0.

- [ ] **Step 10: Commit**

```bash
git add src/entities/util.js src/entities/Runner.js src/entities/Footballer.js src/entities/Vendor.js src/entities/Crowd.js src/entities/Crowd.plaza.js src/entities/StoryNpcs.js src/world/StoryMarkers.js tests/entitiesGround.test.js
```
```bash
git commit -m "feat(entities): pelari, pemain bola, pedagang, warga plaza, NPC cerita, dan penanda misi berdiri di atas tanah"
```

---

### Task 20: Bayangan, lampu, cuaca relatif tanah

**Files:**
- Modify: `src/world/Lighting.js`, `src/world/TimeOfDay.lights.js`, `src/world/Weather.rain.js`, `src/world/Weather.wet.js`, `src/world/Weather.js`

Wiring visual (tanpa tes unit baru; diverifikasi suite + smoke Task 22). Semua default = perilaku lama (y 0) bila `heightAt`/`y` tidak ada.

- [ ] **Step 1: `src/world/Lighting.js`** (frustum bayangan mengikuti y fokus = tanah)

1. Cari:

```js
    _lightSpace.set(focus.x, 0, focus.z).applyQuaternion(fromLight);
```

   Ganti dengan:

```js
    _lightSpace.set(focus.x, Number.isFinite(focus.y) ? focus.y : 0, focus.z).applyQuaternion(fromLight); // frustum ikut tanah
```

- [ ] **Step 2: `src/world/TimeOfDay.lights.js`** (lampu region boleh punya `y` kaki tiang; lampu depan sepeda relatif `bikePos.y`)

1. Cari:

```js
  lamps.forEach((l, i) => mesh.setMatrixAt(i, m.makeTranslation(l.x, POOL_Y, l.z)));
```

   Ganti dengan:

```js
  lamps.forEach((l, i) => mesh.setMatrixAt(i, m.makeTranslation(l.x, (l.y ?? 0) + POOL_Y, l.z)));
```

2. Cari:

```js
  const list = lamps.map((l) => ({ x: l.x, z: l.z }));
```

   Ganti dengan:

```js
  const list = lamps.map((l) => ({ x: l.x, z: l.z, y: Number.isFinite(l.y) ? l.y : 0 })); // y = tanah di kaki tiang (M1)
```

3. Cari:

```js
  const halos = createNightHalos(parent, list.map((l) => ({ x: l.x, y: LAMP_HEIGHT, z: l.z })), lensRoot ?? parent);
```

   Ganti dengan:

```js
  const halos = createNightHalos(parent, list.map((l) => ({ x: l.x, y: l.y + LAMP_HEIGHT, z: l.z })), lensRoot ?? parent);
```

4. Cari:

```js
      if (hit) light.position.set(lamps[idx].x, LAMP_HEIGHT, lamps[idx].z);
```

   Ganti dengan:

```js
      if (hit) light.position.set(lamps[idx].x, lamps[idx].y + LAMP_HEIGHT, lamps[idx].z);
```

5. Cari:

```js
    headlight.position.set(pos.x + _fwd.x * 0.6, HEADLIGHT_HEIGHT, pos.z + _fwd.z * 0.6);
    headlight.target.position.set(pos.x + _fwd.x * HEADLIGHT_REACH, 0, pos.z + _fwd.z * HEADLIGHT_REACH);
```

   Ganti dengan:

```js
    const ground = Number.isFinite(pos.y) ? pos.y : 0; // bikePos.y = tanah di bawah sepeda (M1)
    headlight.position.set(pos.x + _fwd.x * 0.6, ground + HEADLIGHT_HEIGHT, pos.z + _fwd.z * 0.6);
    headlight.target.position.set(pos.x + _fwd.x * HEADLIGHT_REACH, ground, pos.z + _fwd.z * HEADLIGHT_REACH);
```

6. Cari:

```js
 *   registerLamps(opts?: {lamps?: {x:number,z:number}[], lensRoot?: THREE.Object3D|null,
```

   Ganti dengan:

```js
 *   registerLamps(opts?: {lamps?: {x:number,z:number,y?:number}[], lensRoot?: THREE.Object3D|null,
```

- [ ] **Step 3: `src/world/Weather.rain.js`** (cipratan di atas tanah)

1. Cari:

```js
/** Perbarui umur, skala (membesar), dan posisi cipratan; bagian di luar intensitas disembunyikan. */
function updateSplashes(sp, dt, intensity, center, brightness = 1) {
```

   Ganti dengan:

```js
const FLAT = () => 0;

/** Perbarui umur, skala (membesar), dan posisi cipratan; bagian di luar intensitas disembunyikan. */
function updateSplashes(sp, dt, intensity, center, brightness = 1, heightAt = FLAT) {
```

2. Cari:

```js
    _p.set(sp.xs[i], SPLASH_Y, sp.zs[i]);
```

   Ganti dengan:

```js
    _p.set(sp.xs[i], heightAt(sp.xs[i], sp.zs[i]) + SPLASH_Y, sp.zs[i]); // cipratan di atas tanah (M1)
```

3. Cari:

```js
 * @returns {{ update(dt, intensity, camera, bikePos, brightness?): void, setWind(scale): void, group: THREE.Group }}
```

   Ganti dengan:

```js
 * @returns {{ update(dt, intensity, camera, bikePos, brightness?, heightAt?): void, setWind(scale): void, group: THREE.Group }}
```

4. Cari:

```js
    update(dt, intensity, camera, bikePos, brightness = 1) {
```

   Ganti dengan:

```js
    update(dt, intensity, camera, bikePos, brightness = 1, heightAt = FLAT) {
```

5. Cari:

```js
      updateSplashes(splashes, dt, intensity, bikePos, brightness);
```

   Ganti dengan:

```js
      updateSplashes(splashes, dt, intensity, bikePos, brightness, heightAt);
```

- [ ] **Step 4: `src/world/Weather.wet.js`** (genangan ikut tanah saat `terrain.version` berubah)

1. Cari:

```js
  for (const s of puddleSpots(WEATHER.puddleCount)) {
    const mesh = new THREE.Mesh(geo, mat);
```

   Ganti dengan:

```js
  const spots = puddleSpots(WEATHER.puddleCount);
  for (const s of spots) {
    const mesh = new THREE.Mesh(geo, mat);
```

2. Cari:

```js
  group.visible = false;
  return { group, mat };
}
```

   Ganti dengan:

```js
  group.visible = false;
  return { group, mat, spots };
}

/**
 * Letakkan genangan di atas tanah (M1): y mesh = PUDDLE_Y + heightAt(titik dunia genangan).
 * @param {{x:number, z:number, yaw:number}|null} placement
 */
function placePuddles(puddles, placement, heightAt) {
  const c = placement ? Math.cos(placement.yaw) : 1;
  const s = placement ? Math.sin(placement.yaw) : 0;
  puddles.group.children.forEach((mesh, i) => {
    const p = puddles.spots[i];
    const wx = placement ? placement.x + c * p.x + s * p.z : p.x; // = regionTransform.toWorld
    const wz = placement ? placement.z - s * p.x + c * p.z : p.z;
    mesh.position.y = PUDDLE_Y + heightAt(wx, wz);
  });
}
```

3. Cari:

```js
 * @returns {{ update(dt, intensity): void, register(root): () => boolean, unregister(root): boolean,
```

   Ganti dengan:

```js
 * @returns {{ update(dt, intensity, ground?: {heightAt(x:number,z:number):number, version:number}|null): void,
 *   register(root): () => boolean, unregister(root): boolean,
```

4. Cari:

```js
  parent.add(puddles.group);
  let last = -1;
```

   Ganti dengan:

```js
  parent.add(puddles.group);
  let last = -1;
  let groundVersion = -1;
```

5. Cari:

```js
    update(dt, intensity) {
      const on = intensity > 0.001;
```

   Ganti dengan:

```js
    update(dt, intensity, ground = null) {
      if (ground && ground.version !== groundVersion) { // chunk terrain berubah: genangan ikut tanah
        groundVersion = ground.version;
        placePuddles(puddles, placement, ground.heightAt);
      }
      const on = intensity > 0.001;
```

- [ ] **Step 5: `src/world/Weather.js`**

1. Cari:

```js
      rain.update(dt, intensity, app.camera, ctx.focus ?? ctx.bikePos, brightness);
      wet.update(dt, intensity * params.wetness);
```

   Ganti dengan:

```js
      rain.update(dt, intensity, app.camera, ctx.focus ?? ctx.bikePos, brightness, ctx.heightAt);
      wet.update(dt, intensity * params.wetness, ctx.terrain ?? null);
```

- [ ] **Step 6: Suite + lint**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/nightLamps.test.js tests/nightHalos.test.js tests/nightRegistry.test.js tests/surfaceLayers.test.js tests/fogRange.test.js
npm run lint
```
Expected: PASS; lint 0.

- [ ] **Step 7: Commit**

```bash
git add src/world/Lighting.js src/world/TimeOfDay.lights.js src/world/Weather.rain.js src/world/Weather.wet.js src/world/Weather.js
```
```bash
git commit -m "feat(world): frustum bayangan, PJU/lampu sepeda, cipratan & genangan relatif tanah"
```

---

### Task 21: Perkabelan `main.js` + devtools

**Files:**
- Modify: `src/main.js` (versi M0), `src/app/devtools.js` (versi M0)

- [ ] **Step 1: Impor** — di `src/main.js` ganti:
```js
import { createCollider, createDynamicCompositeCollider, localized } from './core/Collider.js';
```
menjadi:
```js
import { createCollider, createDynamicCompositeCollider, createDistrictCollider, localized } from './core/Collider.js';
```
dan sesudah baris `import { createTerrainService } from './app/terrainService.js';` sisipkan:
```js
import { mountDistrict } from './app/districtMount.js';
import { unriDistrict } from './districts/unri/index.js';
```

- [ ] **Step 2: Kamera ikut tanah** — sesudah baris
```js
  const { regions, scheduler, terrain, colliders } = createRegionLayer({ app, store, time, weather, lifecycle });
```
sisipkan:
```js
  rig.setTerrain(terrain); // fokus/target/lantai kamera & pose POV relatif tanah (M1)
```

- [ ] **Step 3: Collider berantai** — ganti:
```js
  colliders.setFallback(city ? city.collider : localized(stadionDef, region.colliders));
```
menjadi:
```js
  // Urutan spec §4.2: region (komposit dinamis M0) → distrik (rantai M1) → tile kota.
  const districtColliders = createDistrictCollider({ fallback: city ? city.collider : localized(stadionDef, region.colliders) });
  colliders.setFallback(districtColliders);
```

- [ ] **Step 4: Sepeda ikut tanah** — sesudah baris
```js
  ents.bike.setCollider(createCollider(start, colliders.isWalkable, colliders.penetration));
```
sisipkan:
```js
  ents.bike.setTerrain(terrain); // y, pitch, grade fisika (M1)
```

- [ ] **Step 5: Cerita** — ganti pemanggilan:
```js
  const story = setupStory({ app, ents, hud, rig, anchor, toLocalCtx, regions, lifecycle });
```
menjadi:
```js
  const story = setupStory({ app, ents, hud, rig, anchor, toLocalCtx, regions, lifecycle, terrain });
```
Di fungsi `setupStory`, ganti tanda tangan:
```js
function setupStory({ app, ents, hud, rig, anchor, toLocalCtx, regions, lifecycle }) {
```
menjadi:
```js
function setupStory({ app, ents, hud, rig, anchor, toLocalCtx, regions, lifecycle, terrain }) {
```
ganti:
```js
  const markers = createStoryMarkers();
```
menjadi:
```js
  const markers = createStoryMarkers({ ground: terrain.heightAt }); // penanda di koordinat dunia (M0), di atas tanah (M1)
```
dan di sistem `storyNpcLabels` ganti:
```js
      const local = toLocalCtx(ctx);
      npcs.refreshLabels(local.focus ?? local.bikePos, ents.vendors.labelsEnabled);
```
menjadi:
```js
      const local = toLocalCtx(ctx);
      npcs.placeOnGround(local.heightAt); // NPC region-lokal stadion (heightAt lokal dari ctx frame)
      npcs.refreshLabels(local.focus ?? local.bikePos, ents.vendors.labelsEnabled);
```

- [ ] **Step 6: Pasang distrik** — sesudah baris
```js
  if (city) minimap.setTileLayer(city.minimap);
```
sisipkan:
```js
  // Distrik kampus UNRI (M1: terrain). Gagal → null + toast; permainan berlanjut tanpa distrik (spec §10).
  const unri = await mountDistrict(app, unriDistrict, {
    terrain, scheduler, collider: districtColliders, minimap, city, weather, baseUrl: import.meta.env.BASE_URL,
    toast: (t, ok) => hud.toast(t, ok),
  });
  if (unri) lifecycle.add(() => unri.dispose()); // LIFO: dilepas sebelum kota, time, weather
```

- [ ] **Step 7: ctx frame** — ganti:
```js
  app.start((dt, t, rawDt) => {
    bikePos.set(ents.bike.state.x, 0, ents.bike.state.z);
    // focus = titik pusat tampilan (sepeda, atau titik pandang saat POV); sepeda beku di POV tanpa kendali
    return { dt, rawDt, time: t, bikePos, focus: rig.focus, input: hud.shopOpen || rig.freezesBike || travel.blocksInput ? null : input };
  });
```
menjadi:
```js
  app.start((dt, t, rawDt) => {
    bikePos.set(ents.bike.state.x, ents.bike.groundY, ents.bike.state.z);
    // focus = titik pusat tampilan (sepeda, atau titik pandang saat POV); sepeda beku di POV tanpa kendali.
    // heightAt/terrain (M1): tanah dunia untuk entitas, lampu, cuaca (ctx region-lokal membungkus heightAt).
    return {
      dt, rawDt, time: t, bikePos, focus: rig.focus, heightAt: terrain.heightAt, terrain,
      input: hud.shopOpen || rig.freezesBike || travel.blocksInput ? null : input,
    };
  });
```

- [ ] **Step 8: Devtools** — di pemanggilan `exposeDevTools({...})` `main.js`, tambahkan `district: unri,` sesudah `terrain,`. Di `src/app/devtools.js` ganti:
```js
  regions = null, scheduler = null, terrain = null, teardown,
}) {
  window.__sim = {
    app, ents, rig, time, weather, store, audioBus, story, city, remountRegion, fastTravel, regions, scheduler, terrain,
```
menjadi:
```js
  regions = null, scheduler = null, terrain = null, district = null, teardown,
}) {
  window.__sim = {
    app, ents, rig, time, weather, store, audioBus, story, city, remountRegion, fastTravel, regions, scheduler, terrain, district,
```

- [ ] **Step 9: Suite, lint, build**

Run:
```bash
node node_modules/vitest/vitest.mjs run
npm run lint
npm run build
```
Expected: semua PASS; lint 0; `✓ built in …`. Periksa `dist/districts/unri/terrain/` berisi berkas `.bin` (Vite menyalin `public/`): `ls dist/districts/unri/terrain | wc -l` = jumlah chunk manifest.

- [ ] **Step 10: Commit**

```bash
git add src/main.js src/app/devtools.js
```
```bash
git commit -m "feat: pasang distrik UNRI (terrain) di main — terrain ke sepeda/kamera/cerita, collider berantai, ctx heightAt"
```

---

### Task 22: Smoke visual, paritas stadion, rute stadion → kampus, screenshot

**Files:** keluaran `docs/screenshots/unri/m1-*.jpg`, `docs/screenshots/unri/m1-baseline-e2e.json`, `docs/screenshots/unri/m1-akhir-e2e.json`.

- [ ] **Step 1: E2E paritas & memori**

Run:
```bash
npm run e2e -- --gpu d3d11 --out docs/screenshots/unri/m1-akhir-e2e.json
```
Expected: exit 0, `fails: []`. Bandingkan dengan `m1-baseline-e2e.json` (Task 0): `checks.parity.callsMean` dan `callsMeanRegionOnly` ±2 % (titik (0, −275) berada di luar distrik: stadion identik; chunk terrain yang terlihat dari sana menambah ≤ 6 draw call — bila selisih `callsMean` > 2 % tetapi `callsMeanRegionOnly` dalam ±2 %, catat angka "terrain terlihat" = selisih; bukan kegagalan paritas stadion), `checks.memory.cycles` sama dengan `baseline`.

- [ ] **Step 2: Rute stadion → kampus (Browser pane atau Playwright)**

Jalankan dev server (`preview_start` nama `stadion-dev`), klik **Mulai Petualangan**, lalu evaluasi di konsol halaman:
```js
await (async () => {
  const s = window.__sim;
  const route = [[0, -275], [0, 330], [-60, 500], [-150, 800], [-219, 1100]];
  const ok = await s.district.whenSettled(-60, 500);
  let maxStep = 0; let prev = null; let n = 0;
  for (let i = 0; i < route.length - 1; i += 1) {
    const [ax, az] = route[i]; const [bx, bz] = route[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d <= len; d += 2) {
      const x = ax + ((bx - ax) * d) / len; const z = az + ((bz - az) * d) / len;
      s.teleport(x, z, Math.atan2(bx - ax, bz - az));
      await new Promise((r) => requestAnimationFrame(() => r()));
      const y = s.ents.bike.groundY;
      if (!Number.isFinite(y)) throw new Error(`y tak hingga di ${x},${z}`);
      if (prev !== null) maxStep = Math.max(maxStep, Math.abs(y - prev) / 2);
      prev = y; n += 1;
    }
  }
  return { settled: ok, samples: n, maxGradeAlongRoute: +maxStep.toFixed(3), sekreY: +s.terrain.heightAt(-219, 1099).toFixed(2), stadionY: s.terrain.heightAt(0, 0) };
})();
```
Expected: `settled: true`, `samples` ±680, `maxGradeAlongRoute` < 0,15 (rute garis lurus memotong medan, bukan jalan), `stadionY: 0`, tanpa galat konsol. Lalu kayuh manual (W) dari plaza utara stadion ke selatan ±1 km melewati batas kampus: tidak ada tebing/retakan di batas, sepeda naik-turun mengikuti tanah, kamera tidak menembus tanah, tanjakan terasa (laju turun ke ±26 km/j), turunan meluncur.

- [ ] **Step 3: Screenshot titik ukur**

Run:
```bash
node tests/e2e/shot.mjs --out docs/screenshots/unri/m1-stadion-pusat.jpg --at 0,-275,0 --hour 10 --gpu d3d11 --stats
node tests/e2e/shot.mjs --out docs/screenshots/unri/m1-jalan-stadion-kampus.jpg --at -60,500,3.1416 --hour 10 --gpu d3d11 --wait 6000 --stats
node tests/e2e/shot.mjs --out docs/screenshots/unri/m1-sekre-luar.jpg --at -219,1130,3.1416 --hour 10 --gpu d3d11 --wait 6000 --stats
node tests/e2e/shot.mjs --out docs/screenshots/unri/m1-danau.jpg --at -700,838,-1.5708 --hour 10 --gpu d3d11 --wait 6000 --stats
node tests/e2e/shot.mjs --out docs/screenshots/unri/m1-rektorat.jpg --at -979,860,0 --hour 10 --gpu d3d11 --wait 6000 --stats
node tests/e2e/shot.mjs --out docs/screenshots/unri/m1-atas-danau.jpg --at -760,838,0 --hour 10 --gpu d3d11 --wait 6000 --pov Digit7
```
Expected: semua exit 0 (tanpa galat konsol). Kriteria visual:
- `m1-stadion-pusat.jpg` identik dengan `m0-stadion-pusat.jpg` (komposisi, warna, minimap); `callsMean` ±2 %.
- `m1-danau.jpg`: rumput bertekstur di sekitar sepeda, cekungan danau terlihat (dasar lebih rendah, lapisan air kota datar di atasnya), tepian naik ±1,5 m; **tidak ada** bidang tanah dasar kota menutupi cekungan (lubang `tanahKota` bekerja).
- `m1-atas-danau.jpg`: rumput terrain menyatu; batas distrik tidak berupa dinding/celah; minimap menampilkan isi batas kampus hijau pucat.
- `m1-jalan-stadion-kampus.jpg`, `m1-rektorat.jpg`: kamera di atas tanah, sepeda menapak; jalan kota di dalam kampus boleh tertutup rumput (batasan sementara M1).
- `--stats`: segitiga distrik ≤ 600k (prototipe: 130k–237k), draw call total ≤ 1.000.

- [ ] **Step 4: Commit**

```bash
git add docs/screenshots/unri/m1-*.jpg docs/screenshots/unri/m1-baseline-e2e.json docs/screenshots/unri/m1-akhir-e2e.json
```
```bash
git commit -m "docs: screenshot titik ukur M1 (terrain kampus) dan laporan paritas E2E"
```

---

### Task 23: Verifikasi akhir tonggak M1 + status indeks

**Files:**
- Modify: `docs/superpowers/plans/2026-10-17-unri-00-index.md` (baris `| M1 | belum | — | |`)

- [ ] **Step 1: Verifikasi penuh**

Run:
```bash
node node_modules/vitest/vitest.mjs run
npm run lint
npm run build
npm run bake:campus -- terrain --offline
git status --short public/districts/unri
```
Expected: semua tes PASS (tes lama + ±120 tes baru); lint 0; build sukses; bake offline tidak mengubah berkas (status kosong = deterministik).

- [ ] **Step 2: Status indeks** — ganti baris:
```
| M1 | belum | — | |
```
menjadi (isi hash commit terakhir dari `git log -1 --format=%h`):
```
| M1 | selesai | <hash> | terrain SRTM 21 chunk ±0,65 MB; jalan kota di kampus tertutup terrain sampai M2 |
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-10-17-unri-00-index.md
```
```bash
git commit -m "docs: status tonggak M1 terrain selesai"
```

---

## Self-review

### Cakupan spec → task

| Spec | Task |
|---|---|
| §4.1 heightfield (`decodeChunk`, `sampleChunk`, `createHeightField` add/remove/has/heightAt/normalAt/gradeAlong/version, `TerrainDataError`) | 2 |
| §4.1 `terrainService` + `ctx.terrain` | 9, 21 (M0 sudah menyuntik ke region) |
| §4.2 `defineDistrict`, collider komposit region → distrik → tile, ChunkStreamer (load 1000 / unload 1300 / LOD 600) | 11–14, 16 |
| §5.1 SRTM 1″ N00E101 mirror resmi, cache `data-src/dem/srtm/` | 4, 6, 8 |
| §5.2 langkah 1–10 (bbox + 150 m, bikubik 4 m, median 5×5, Gaussian σ 20 m, datum median tepi, smoothstep 120 m batas & mask + 60 m, jalan ≤ 6 % + penampang lebar/2 + 1,5 m + blend 6 m, pad median + blend 4 m, danau −0,4/−1,5/1:3, parit 1,0 × 0,6 m offset 1 m, chunk Uint16 LE selaras tile, laporan) | 4–8 |
| §5.2 determinisme (golden byte identik) | 7 (sintetis), 8 Step 3 (nyata), 23 |
| §5.3 mesh LOD0 4 m / LOD1 16 m + skirt 2 m, normal dari heightfield, `surfaceMaps('grass')` | 10 |
| §5.4 bikePhysics grade (kSlope 0,55), Bicycle y + pitch, CameraRig/cameraMath, cameraPresets/PovDirector, entitas, StoryMarkers, Lighting, TimeOfDay.lights, Weather.wet/rain | 17–20 |
| §5.4 collider "lereng > 35 %" | **M2** (indeks: `src/districts/unri/collider.js` M2) — M1 collider distrik terbuka |
| §6 batas distrik (kampus − mask + 40 m, simplifikasi 5 m, ring tunggal) | 6, 8 |
| §10 chunk gagal → datar + toast sekali; manifest gagal → tanpa distrik + toast; bake tanpa sumber → galat + URL + langkah | 12, 16, 4 |
| §11 tes: heightfield (decode, bilinear, tepi chunk, 0 di luar, version), blend tepi = 0, jalan ≤ 6 %, pad rata, bikePhysics grade; golden campusbake | 2, 5, 7, 17 |
| §1 butir 7 atribusi SRTM | 7 (`ATTRIBUTION.txt` distrik); HUD/README = M7 |

### Scan placeholder
Dicari "TBD", "TODO", "mirip Task", "tambahkan handling": tidak ada. `<hash>` di Task 23 Step 2 = nilai diisi saat eksekusi (bukan kode). Semua fungsi yang dirujuk didefinisikan di plan ini atau sudah ada di repo/M0 (dibaca langsung): `createChunkStreamer`/`STREAM`, `fetchJson` (city), `surfaceMaterial` (`src/world/Ground.materials.js`), `tileKey`/`parseTileKey`/`tileOf` (geo/tiles), `cleanRing`/`orientRing`/`convexHull`/`ringBounds`/`distanceToRing`/`pointInPolygon`/`polygonCentroid`/`polygonArea`/`signedArea` (geo/polygon), `createProjection`, `stadionMaskWorld`, `loadOsm`/`normalizeOsm`/`projectFeatures`/`ROAD_CLASSES`/`USER_AGENT` (citybake), `createResourceScope`, `validateDistrictBuild`, `createDynamicCompositeCollider`/`setFallback`, `createScheduler` (M0).

### Konsistensi nama (indeks/spec ↔ plan)
`src/geo/terrain/heightfield.js`, `format.js` (konstanta persis), `defineDistrict`, `unriDistrict`, `UNRI_BOUNDARY`, `src/districts/terrainChunks.js`, `buildTerrainChunkMesh(chunk, field, { lod, materials })`, `mountDistrict(app, def, { terrain, collider, minimap, scheduler, createScope })`, CLI `npm run bake:campus -- terrain|ground|buildings|all [--offline]` (+ `boundary`), daftar berkas `tools/campusbake/{index,config,report}.js`, `dem/{readHgt,fetchSrtm,resample,filters}.js`, `terrain/{datum,blend,roads,pads,water,writeChunks}.js`, keluaran `public/districts/unri/manifest.json` (`format:'unri-district'`, `version:1`, `terrain:{…, chunks}`, `ground:{chunks:[]}`, `buildings:'buildings.json'`, `attribution:'ATTRIBUTION.txt'`) dan `terrain/<ix>_<iz>.bin`, `stepBike(state, input, dt, { grade })`. Ekspor `terrainService` sama dengan M0.

### Deviasi
Lihat bagian "Deviasi dari indeks" (7 butir). Asersi tes lama yang mungkin diubah: hanya tes stub `terrainService` M0 bila memeriksa identitas `FLAT_TERRAIN` (Task 9 Step 4).

### Risiko
- **Kode M0 belum ada saat plan ditulis**: jangkar "Cari" di berkas yang disentuh M0 (`main.js`, `PovDirector.js`, `cameraPresets.js`, `CameraRig.js`, `devtools.js`, `Collider.js`) diambil dari plan M0 final; Task 0 memverifikasi baris kunci. Bila jangkar tidak ditemukan: sisipkan perubahan setara di fungsi yang sama dan catat.
- **Overpass/SRTM tidak tersedia** saat Task 8: cache + langkah manual tercetak; tanpa internet tonggak tertunda di Task 8 (Task 9+ bisa dikerjakan dengan data dari mesin lain).
- **Tampilan transisi** (jalan kota tertutup terrain, landuse kota belang di cekungan, gedung kota terbenam/mengambang) sampai M2/M3 — sengaja, didokumentasikan.
- **Hitch rakit mesh**: LOD0 ±8–15 ms dipecah 16 baris per potongan scheduler (≤ 4 ms/frame); unggah tekstur lubang 625 × 750 B (±0,47 MB) tiap chunk tampil/lepas — jarang, di bawah 1 ms di GPU d3d11 prototipe.
- **Data DSM**: FISIP/HSC +7…+9 m (kanopi/gedung 2000) — tetap 1:1 sesuai keputusan user (spec §13 butir 9); pad gedung meratakan footprint.
- Ubin skadi AWS bisa berubah/hilang: sha256 dipin; mirror alternatif = OpenTopography (API key) / USGS EarthExplorer (akun) — unduh manual lalu letakkan di cache.

---

## Serah terima ke M2

API tersedia setelah M1 (signature persis):

```js
// src/geo/terrain/format.js
export const CHUNK_SIZE /* 500 */, STEP /* 4 */, N /* 126 */, UNIT /* 0.01 */, BIAS /* -5000 */, FORMAT /* 'unri-terrain' */,
  VERSION /* 1 */, TERRAIN_HEADER /* {format,version,size,step,n,unit,bias} */, ZERO_U16 /* 5000 */;
// src/geo/terrain/heightfield.js
export class TerrainDataError extends Error {}
export function validateTerrainHeader(h) -> { size, step, n, unit, bias }
export function decodeChunk(arrayBuffer, header /* {key, size, step, n, unit, bias, …} */)
  -> { key, ix, iz, origin:{x,z} /* barat-laut */, size, step, n, unit, bias, data:Uint16Array }   // beku
export const sampleAt = (chunk, r, c) -> number
export function sampleChunk(chunk, x, z) -> number   // bilinear, di-clamp, tepat di simpul
export function createHeightField() -> { add(chunk), remove(key) -> boolean, has(key), keys() -> string[],
  heightAt(x, z) /* 0 tanpa chunk */, normalAt(x, z, out?) /* beda 1 m */, gradeAlong(x, z, yaw), get version, get size }
// src/geo/terrain/cellMask.js
export function rasterizeRing(ring, { minX, minZ, cell, cols, rows }) -> Uint8Array   // pusat sel, aturan pointInPolygon

// src/app/terrainService.js
export const FLAT_TERRAIN; export function createTerrainService({ field } = {})
  -> { field /* HeightField */, heightAt, normalAt, gradeAlong, get version }

// src/districts/District.js
export function defineDistrict({ id, boundary, manifestUrl, build }) -> beku + bounds; boundary luas bertanda positif
export function validateDistrictBuild(result, id) -> result   // group, systems, colliders, minimapLayer, excludeIds, whenSettled, dispose
export function districtContains(def, x, z) -> boolean
// src/districts/terrainChunks.js
export const TERRAIN_FETCH; export async function fetchArrayBuffer(url) -> ArrayBuffer
export function chunkCellGrid(keys, step = 4) -> { minX, minZ, cell, cols, rows, ix0, iz0, per /* 125 */ }
export function createTerrainChunks({ header, baseUrl, field, parent, materials:{terrain}, cellGrid, cellMask, hole?, onHoleChange?,
  scheduler, owner, createStreamer, fetchArrayBuffer?, retries?, backoffMs?, sleep?, onFail?, logger?,
  onChunkMesh?(key, { mesh, lod, chunk }), onChunkRelease?(key) })
  -> { update(focus), settled(x, z, r), stats(), dispose() }
//   onChunkMesh: setelah mesh chunk NYATA dipasang (muat & tiap tukar LOD); mesh = THREE.Mesh (bisa null bila
//   chunk tanpa sel di dalam batas); fallback datar (chunk gagal) TIDAK memanggil hook.
//   onChunkRelease: sebelum mesh dilepas karena `unload` (bukan tukar LOD, bukan dispose).
//   Mesh dilepas dengan geometry.dispose() saja — material bersama milik scope distrik tidak di-dispose.
// src/districts/unri/boundary.js
export const UNRI_BOUNDARY /* ring beku [[x,z]…] */, UNRI_BOUNDARY_META /* {wayId, osmTimestamp, maskMargin, tolerance, area} */;
// src/districts/unri/index.js
export const UNRI_DIR /* 'districts/unri/' */, DISTRICT_FORMAT, SETTLE /* {radius:600, timeoutMs:20000} */;
export function validateDistrictManifest(m) -> header terrain beku (+ hRef, water)
export const unriDistrict;   // manifestUrl 'districts/unri/manifest.json' RELATIF ke baseUrl (ctx.baseUrl)
//   build(ctx) -> { group /* 'distrik:unri' */, systems:[{id:'district.unri.terrain', phase:'world'}], colliders /* terbuka */,
//     minimapLayer, excludeIds:new Set(), groundHole:{minX,minZ,cell,cols,rows,data}, stats(), whenSettled(x,z,timeoutMs?), dispose() }
//   Di dalam build: `manifest` = JSON mentah (M2 membaca `manifest.ground?.chunks`), `header` = terrain tervalidasi,
//   factory terrain = `createTerrainChunks({ … })` (opsi hook ditambahkan di objek ini), grup distrik = `group`.
// src/world/terrain/TerrainMesh.js
export const TERRAIN_MESH /* {lod1Stride:4, skirt:2, rowsPerSlice:16, renderOrder:-3.5, color} */;
export function lodIndices(n, lod) -> number[]   // LOD1: 0,4,…,124,125
export function* buildTerrainChunkMeshSteps(chunk, field, { lod, materials, cellInside? }) -> THREE.Mesh|null
export function buildTerrainChunkMesh(chunk, field, opts) -> THREE.Mesh|null
export function createTerrainMaterial() -> MeshStandardMaterial ('terrain', grass, polygonOffset 1/1)
// src/app/districtMount.js
export const DISTRICT_MINIMAP_PX /* 1024 */; export function minimapView(bounds, size?, margin?); export function createHoleTexture(hole)
export async function mountDistrict(app, def, { terrain, scheduler, collider?, minimap?, city?, weather?, createScope?, baseUrl?,
  toast?, logger?, createStreamer?, fetchJson?, fetchArrayBuffer?, createCanvas? })
  -> { def, district, get mounted, whenSettled(x, z), dispose() } | null
//   ctx build: { scene, scope, terrain, scheduler, owner:'district:<id>', baseUrl, fetchJson, fetchArrayBuffer, createStreamer,
//     onTerrainFail, groundHoleChanged, logger }   — scheduler SUDAH diteruskan; weather.registerWet(group) sudah dipasang
//   (M2 menambah opsi `time` + ctx.registries).
// src/core/Collider.js
export function createDistrictCollider({ fallback } = {})
  -> { isWalkable, isCameraClear, penetration, addDistrict({id, boundary, bounds, colliders}) -> off, setFallback(c) }
// src/city: city.setGroundHole({ texture, rect:{minX,minZ,maxX,maxZ} } | null)
// src/sim/bikePhysics.js
export function stepBike(state, input, dt, { grade = 0, cfg = BIKE } = {}); export function topSpeed(cfg, sprint, grade)
// Bicycle: setTerrain(terrain), get groundY.  CameraRig: setTerrain(terrain).  PovDirector: setHeightAt(fn).
// cameraMath: cameraFloor(groundY, cfg?).  cameraPresets: liftPose(pose, ground), povPose(def, src, subject, time, out, heightAt?).
// regionContext: localHeightAt(frame, heightAt); createLocalContext → ctx lokal + heightAt(lx, lz).
// entities/util: flatGround, groundOf(ctx).  StoryNpcs.placeOnGround(ground).  createStoryMarkers({ ground }).
// TimeOfDay.registerLamps({ lamps:[{x, z, y?}] }) — y = tanah di kaki tiang (M2 P03 PJU kampus memakainya).
// Frame ctx (main): { …, bikePos /* y = tanah */, heightAt /* dunia */, terrain /* layanan */ }.
// tools/campusbake: config.TERRAIN (ditch: enabled, width 1.0, depth 0.6, offset 1.0 → sumbu parit di lebar/2 + 3,0 m dari
//   sumbu jalan; classes primary/secondary/tertiary/tertiary_link), cli.runTerrain/runBoundary/main, COMMANDS,
//   manifest.withTerrain (bagian ground/buildings dipertahankan; ditulis JSON.stringify(m, null, 2) + '\n'),
//   cache OSM kampus `data-src/osm/unri-kampus.json` (id area BERBEDA dari area citybake `unri` M2 — tidak bentrok).
```

Catatan untuk M2:
- `tanahKota` (y −0,05) sudah berlubang per sel di bawah setiap mesh terrain yang tampil → lembah/danau terlihat (cek `m1-danau.jpg`). Baris tabel Task 0 M2 "`tanahKota` menutupi lembah" = lulus.
- M2 menyetel `renderOrder −5` pada mesh terrain lewat hook: aman bersama lubang (urutan terrain sebelum tanah dasar tidak lagi penting di sel berlubang).
- `polygon-clipping` 0.15.7 sudah devDependency (Task 0 Step 3 M2 = no-op).
- Muka air danau ada di `manifest.terrain.water` (`level`, `bed`) — M2 boleh memakai langsung atau menghitung ulang dari heightfield.
- Collider distrik M1 terbuka; M2 mengganti `colliders` di hasil build — rantai `createDistrictCollider` tetap menegakkan penghalang tile kota sampai gedung kota dibuang dari tile.
