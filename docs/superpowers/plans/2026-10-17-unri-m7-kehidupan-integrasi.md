# M7 Kehidupan Kampus & Integrasi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (atau superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghidupkan Kawasan Kampus UNRI Bina Widya dan menutup seluruh proyek kampus sesuai spec
`docs/superpowers/specs/2026-10-17-unri-kampus-design.md` §1, §8.4, §9, §10, §11, §12 (M7): mahasiswa NPC
berjadwal di trotoar/selasar dan bangku, motor parkir instanced (A01–A04) dengan kepadatan per jam (parkir IC
penuh siang), satpam di pos gerbang, objective cerita baru `interact`, chapter 6 "Kampus Biru Langit" (4 misi),
easter egg kampus (lambang 1-10-62, Kampus Biru Langit, GGM), fast travel 2 tujuan kampus, atribusi SRTM + OSM,
README, perluasan E2E (titik ukur §9.2, rute sepeda stadion → sekre, siklus interior & region 3×, fast travel,
laporan budget §9.1), screenshot final, status katalog & indeks, lalu PR (dengan izin user).

**Architecture:** Logika murni di `src/sim/` (kepadatan per jam, jalur dari data ground, alokasi kolam NPC per sel
250 m, langkah pejalan, slot parkir motor) dites Vitest. Distrik (`src/districts/unri/`) merakit
`life.js` = mahasiswa + satpam + parkir motor + props kampus; humanoid dibuat lewat **kit entitas yang disuntik**
(`ctx.services.npc` dari `src/entities/Student.js`) karena lapisan `districts` tidak boleh mengimpor `entities`
(spec §3.1). Data jalur/parkir dibaca `groundFeed.js` dari `public/districts/unri/ground/<key>.json` (format M2).
Cerita tetap data-driven: objective `interact` (`<region|interior>:<id>`) di `sim/story/objectives.js`, chapter 6
di `src/story/chapters.unri.js` digabung ke `CHAPTERS`; event `interact` dikirim StoryDirector (NPC ber-`zone`) dan
oleh hook interior (`src/app/interiorStoryHook.js`) yang membungkus `onInteract` interactable sekre M5.

**Tech Stack:** Three.js 0.186 (`BatchedMesh`, `InstancedMesh`, GLTFLoader), JavaScript ESM + JSDoc, Vite 8,
Vitest 5, ESLint 10 flat config, Blender (MCP `execute_blender_code` + `assets-src/blender/export_glb.py`),
Playwright global (E2E GPU `--gpu d3d11`).

---

## Konvensi eksekusi

- Satu implementer untuk seluruh M7, satu review di akhir tonggak (memori `lightweight-process-hobby`). TDD hanya
  untuk logika murni/berisiko (Task 1, 2, 3 bagian LOD/outfit, 5 `groundFeed`, 7 `parkingAreas`, 9, 10 katalog,
  11 data, 12, 13, 14, 15, 16, 18 `stadionDetail`); kode visual = implementasi + cek cepat
  `tests/e2e/harness.unri.mjs` (Playwright GPU) + screenshot.
- Tes satu berkas: `node node_modules/vitest/vitest.mjs run <path>` (jangan `npx`). Seluruh suite: `npm test`.
- Lint: `npm run lint` (0 galat; warning baru tidak boleh). Build: `npm run build`. E2E: `npm run e2e -- --gpu d3d11`.
- Commit: `git add <berkas…>` lalu **perintah terpisah** `git commit -m "<pesan>"` (hook `block-no-verify`
  memblokir perintah gabungan). Conventional commit, bahasa Indonesia. Jangan `git add -A`.
- Bahasa kode, komentar, teks UI: Indonesia. Nama berkas/fungsi persis seperti di plan ini dan indeks.
- Nomor baris tidak dipakai; rujukan memakai nama fungsi/potongan teks. Berkas M0–M6 belum ada saat plan ditulis,
  sehingga **Task 0 memverifikasi setiap antarmuka** yang dipakai M7. Bila nama nyata berbeda dari plan:
  pakai nama nyata seminimal mungkin, catat penyimpangan (berkas, rencana, kenyataan, tindakan) di laporan akhir.
  Jangan mengubah kontrak indeks kecuali yang disebut di "Keputusan desain" (D1).
- Dev server visual: `preview_start` nama `stadion-dev`, atau Playwright GPU (panel Browser bawaan sering
  tersembunyi → rAF berhenti). `window.__sim` hanya di DEV.
- **Titik berhenti untuk user** (WAJIB berhenti dan bertanya): Task 0 Step 6 (antarmuka M0–M6 hilang total),
  Task 18 Step 6 (mitigasi §9.3 langkah 4 diperlukan), Task 21 Step 2 (izin push & PR).

## Prasyarat

- Branch `feat/unri-kampus`; M0–M6 berstatus **selesai** di tabel "Status tonggak" indeks
  (`docs/superpowers/plans/2026-10-17-unri-00-index.md`). Bila ada yang belum, BERHENTI (M7 bergantung pada
  semuanya).
- Data distrik hasil bake tersedia: `public/districts/unri/manifest.json`, `terrain/*.bin`, `ground/*.json`,
  `buildings.json` (M1–M3).
- Region `unri-lembaga` (M4), interior `sekre` + `interiorPortal` (M5), region `unri-rektorat` + hero GGM/masjid
  (M6) terpasang di `src/main.js`.
- Blender dengan add-on MCP terhubung (cek `get_addon_status`). Tanpa Blender: placeholder prosedural tetap dipakai
  (Task 6 & 8 punya jalur cadangan) dan status katalog tetap `placeholder`.
- Playwright global (`%APPDATA%\npm\node_modules\playwright` atau `PLAYWRIGHT_PATH`), GPU NVIDIA (d3d11).
- Overpass API (jaringan) untuk verifikasi node halte (Task 8 Step 1); tanpa jaringan dipakai koordinat riset.

## Keputusan desain M7 (dan penyimpangan dari teks indeks/spec)

| # | Keputusan | Alasan |
|---|---|---|
| D1 | `mountDistrict(app, def, opts)` mendapat opsi tambahan **`services`** yang diteruskan sebagai `ctx.services` ke `def.build`: `{ npc, camera, hour(), excludeAt(x,z) }`. Indeks diperbarui di Task 20. | `src/districts/` tidak boleh mengimpor `entities/` (spec §3.1), padahal mahasiswa/satpam = `Humanoid`. Kit humanoid dibuat app (`src/entities/Student.js`) lalu disuntik. Opsi baru bersifat opsional (tanpa `services` → distrik tanpa NPC). |
| D2 | Titik cerita chapter 6 memakai `{ region:'world', x, z }` (koordinat dunia dari OSM, dihitung saat plan ditulis). Konsistensi terhadap data M4 (`PORTAL_DOORS`), M5 (id interactable), M6/M3 (`buildings.json`) dikunci `tests/storyUnri.test.js`. | Lapisan `story` tidak boleh mengimpor `regions` (ESLint), dan `frameOf` region yang belum terpasang bisa `null`; `'world'` selalu dapat di-resolve (spec §4.5 menyebut `'world'`). |
| D3 | Data jalur & parkir dibaca `src/districts/unri/groundFeed.js` langsung dari `ground/<key>.json` (kunci dari `manifest.ground.chunks`), bukan dari internal `ground.js` M2. | Tidak bergantung pada API internal M2 yang tidak dikunci indeks; berkas yang sama sudah ada di cache HTTP browser. |
| D4 | Misi `deliver` nasi kotak memakai pedagang baru jenis `kantin` (katalog `nasi-kotak`) yang mangkal di depan Kantin FKIP `way/282225371`; gerobak stadion dipakai ulang sebagai etalase (aset P12). | `deliver` (objective lama, tidak diubah) mensyaratkan item di dompet, dan item dompet hanya berasal dari pedagang. PKL di kampus = GAP riset → disajikan sebagai etalase kantin, bukan PKL. |
| D5 | NPC cerita kampus punya field `zone` (`'unri-lembaga'`); bicara dengan NPC ber-`zone` juga mengirim event `{type:'interact', target:'<zone>:<id>'}`. Objective `interact` boleh membawa `at` (titik penanda, opsional). | Spec §8.4 format target `<region\|interior>:<id>`; penanda HUD butuh titik. |
| D6 | Halte TMP (P02): kedua node OSM `4559431711`, `4559433677` (lat 0,4641/0,4644; lon 101,3730/101,3742 → dunia ≈ (−1840, 2156) dan (−1706, 2123)) berada **di luar** batas distrik (barat & selatan bbox poligon kampus). Model P02 tetap dibuat; penempatan memakai `halteSpotsInDistrict()` yang hasilnya `[]`; dicatat di ATTRIBUTION/katalog/README. | Instruksi: pasang bila di dalam jangkauan, selain itu catat di luar distrik. |
| D7 | Lambang N10 dipasang sebagai plang di jalur hijau Jl. Binawidya UNRI, ±45 m di dalam Gerbang Soebrantas (dunia (−1074, 2078)) **[INFERENSI penempatan]**. | Tidak ada sumber posisi papan lambang; lokasi ini di luar mask region hero (tidak bertabrakan dengan isi M4/M6) dan dekat gerbang 24 jam. |
| D8 | Motor parkir tanpa collider; render `BatchedMesh` per material per area parkir. | 1 draw call per material per area; ratusan collider tidak sepadan. |
| D9 | Save **tidak** naik versi (tetap `SAVE_VERSION = 3` dari M0). Fungsi murni `reopenForNewChapters(save, chapterCount)` membuka chapter 6 untuk save yang sudah "tamat" di chapter 5 lama. | Struktur save tidak berubah; hanya jumlah chapter. |
| D10 | Mahasiswa berjalan di `walks` ground (trotoar/selasar/footway OSM) **dan** kedua bahu jalan kampus (`roads` kelas tertiary/service/residential/living_street/unclassified, offset lebar/2 + 0,9 m). Celana pendek diganti panjang **[POLA UMUM kampus negeri]**. | OSM kampus hanya punya ±9 footway; tanpa bahu jalan kampus terlalu sepi. |
| D11 | Titik ukur `masjid` di E2E digeser ke (−1009, 1405) (spec: (−1009, 1383) berada di dalam footprint masjid `way/282230716`). | Kamera di dalam dinding tidak mewakili pemain. |

## Data fakta yang dipakai (dunia ENU, +X timur, +Z selatan; proyeksi `createProjection(WORLD_ORIGIN)`)

| Item | Nilai dunia | Sumber | Keyakinan |
|---|---|---|---|
| Sekretariat Lembaga Mahasiswa `way/327530276` | sudut (−224.8,1089.1) (−209.0,1094.6) (−214.1,1109.3) (−230.0,1103.8); pusat (−219.5, 1099.2); sumbu panjang u = (0.944, 0.329) | OSM cache `data-src/osm/stadion.json` | T (footprint) |
| Ujung selasar timur + 2,5 m | (−209.2, 1102.8) | pusat + 10,9·u (denah M4 [INF]: selasar sepanjang sumbu panjang) | INF |
| Ujung selasar barat + 2,5 m | (−229.8, 1095.6) | pusat − 10,9·u | INF |
| Kantin FKIP `way/282225371` | x −807.5…−772.3, z 1142.8…1157.5; pedagang di (−790.0, 1140.8) menghadap utara | OSM | T (ada), INF (sisi depan) |
| Danau Buatan `way/373856980` | ring 38 titik (lihat Task 11 tes); penanda keliling (−698.0,806.0) (−758.6,859.8) (−846.4,894.3) (−785.4,820.2), 10–14 m dari tepi air | OSM + dihitung | T |
| Pos Keamanan `way/327534471` | x −1080.0…−1069.3, z 1289.8…1301.6; satpam (−1074.7,1287.8) & (−1074.7,1303.6) | OSM | T (pos), INF (posisi berdiri) |
| GGM `way/314450943` | pusat (133.1, 407.4), jari-jari 40,7 m | OSM | T |
| Integrated Classroom `way/1313268659` | centroid (−1091.0, 906.0); parkir terdekat `way/938379748` (−969, 970), 138 m | OSM | T (gedung), INF (parkir = parkir IC) |
| Rute sepeda E2E stadion → sekre | (0,120)→(−2,272)→(−2,408)→(0,645)→(0,689)→(−156,706)→(−150,801)→(−139,959)→(−138,998)→(−146,1029)→(−164,1054)→(−196,1077)→(−220,1082) = 1.145 m | Jl. Stadion Utama `way/327366060`, Jl. Muchtar Lutfi `way/535177996`, jogging track Stadion Mini `way/327363974` | T |
| Lambang N10 | plang (−1074.0, 2078.0), menghadap selatan; Jl. Binawidya UNRI `way/38870017` di x ≈ −1082 | OSM + D7 | INF (penempatan) |
| Halte TMP | node 4559431711 (0.4641, 101.3730), 4559433677 (0.4644, 101.3742) → (−1839.8, 2155.7), (−1706.2, 2122.5): di luar poligon kampus | riset §4, OSM | T |

## Struktur file

**Baru**

| Berkas | Task | Tanggung jawab |
|---|---|---|
| `src/sim/campusLife.js` | 1 | Murni: `studentDensity`, `motorFill`, `pathsFromGround`, `chopPath`, `bucketPaths`, `pointAt`, `targetCount`, `allocateStudents`, `createWalker`, `stepWalker`, `walkerPose`, `benchSpotsFromPaths`, `seatsOf`, `sitterCount`, `mulberry32`, `cellCenter`. |
| `src/sim/parkingSlots.js` | 2 | Murni: `parkingSlots(ring)`, `visibleOrder`, `assignVariants`, `seedOf`, `MOTOR_SLOT`, `VARIANT_WEIGHTS`. |
| `src/entities/Student.js` | 3 | `createStudentKit()` → `{ createStudent, createGuard, createLod, walk, idle, pose, dispose }` (kit yang disuntik ke distrik). |
| `src/districts/unri/groundFeed.js` | 5 | Muat/lepas `ground/<key>.json` di sekitar fokus untuk kehidupan kampus. |
| `src/districts/unri/students.js` | 5 | Mahasiswa NPC: kolam tetap, sel 250 m, jalan & duduk di bangku diskusi. |
| `src/districts/unri/guards.js` | 5 | Satpam C10 di Pos Keamanan. |
| `src/districts/unri/life.js` | 5, 7, 8 | `createCampusLife(...)`: komposisi students + guards + motorParking + campusProps + groundFeed; satu sistem. |
| `src/world/props/unri/motorVariants.js` | 6 | `MOTOR_VARIANTS` A01–A04 (path GLB, dimensi), warna bodi, `motorPlaceholderSources`. |
| `assets-src/blender/unri/m7_common.py`, `m7_motor.py`, `m7_halte.py`, `m7_lambang.py` | 6, 8 | Skrip bpy (dijalankan lewat Blender MCP) + `.blend` hasil. |
| `public/models/unri/a01-motor-bebek.glb`, `a02-motor-matic.glb`, `a03-motor-sport.glb`, `a04-motor-tua.glb`, `p02-halte-tmp.glb`, `n10-lambang-unri.glb` | 6, 8 | Aset final (Blender). |
| `src/districts/unri/motorParking.js` | 7 | Parkir motor `BatchedMesh` per area, kepadatan per jam, dedupe antar chunk. |
| `src/world/props/unri/lambangUnri.js` | 8 | Placeholder N10 (tekstur canvas) + plang tiang. |
| `src/world/props/unri/halteTmp.js` | 8 | Placeholder P02. |
| `src/districts/unri/campusProps.js` | 8 | Plang lambang N10 (GLB/placeholder), `halteSpotsInDistrict`. |
| `src/story/chapters.unri.js` | 11 | Chapter 6 "Kampus Biru Langit", `UNRI_STORY_NPCS`, `UNRI_VENDORS`, titik kampus. |
| `src/app/interiorStoryHook.js` | 12 | `withInteractHook(def, onInteracted)` membungkus interactable interior. |
| `src/app/stadionDetail.js` | 18 (kondisional) | Mitigasi §9.3 langkah 3: `setDetail('far')` stadion. |
| `public/districts/unri/ATTRIBUTION.txt` | 16 | Atribusi OSM (ODbL) + SRTM (domain publik) + catatan halte. |
| `tests/e2e/harness.unri.mjs` | 5 | Harness Playwright GPU: `openSim`, `settleAt`, skenario cek cepat per task. |
| `tests/e2e/shots.unri.mjs` | 19 | Screenshot final M7 (Playwright GPU, memakai harness). |
| `tests/campusLife.test.js`, `tests/parkingSlots.test.js`, `tests/groundFeed.test.js`, `tests/motorParking.test.js`, `tests/studentOutfit.test.js`, `tests/storyUnri.test.js`, `tests/storyReopen.test.js`, `tests/interiorStoryHook.test.js`, `tests/stadionDetail.test.js` (kondisional) | 1–18 | Tes logika murni/berisiko. |
| `docs/screenshots/unri/m7-*.jpg` | 19 | Galeri final. |

**Diubah**

| Berkas | Task | Perubahan |
|---|---|---|
| `src/entities/Humanoid.dim.js`, `Humanoid.js` | 3 | `GEO.backpack`, opsi `backpack` (ransel, ikut mesh LOD). |
| `src/entities/Humanoid.outfits.js` | 3 | `ALMAMATER_COLOR`, `randomStudentOutfit`, `campusGuardOutfit`. |
| `src/entities/Humanoid.lod.js` | 3 | Ambang LOD kustom `createHumanoidLod({ near, far })`, `lodLevelFor(d2, near, far)`. |
| `src/app/districtMount.js` | 4 | Opsi `services` → `ctx.services` (D1). |
| `src/districts/unri/index.js` | 5 | Memasang `createCampusLife` (group, sistem, dispose, `life` pada hasil build). |
| `src/main.js` | 4, 11, 12, 14, 15, 18 (kondisional) | `services` distrik, `extraVendors`, hook interior, `inCampus`, fast travel kampus, devtools. |
| `src/sim/story/objectives.js` | 9 | Objective `interact`. |
| `src/sim/vendorSim.js`, `src/entities/Vendor.js`, `src/entities/index.js` | 10 | Katalog `kantin`, `yaw` pedagang, `extraVendors`. |
| `src/story/chapters.js` | 11 | `CHAPTERS` + chapter 6, `STORY_NPCS` + NPC kampus. |
| `src/entities/StoryNpcs.js` | 11 | `look:'almamater'`. |
| `src/core/StoryDirector.js` | 12, 13, 14 | `onInteract`, NPC ber-`zone`, penanda `interact`, `inCampus`, buka chapter baru. |
| `src/story/storage.js` | 13 | `reopenForNewChapters`. |
| `src/story/easterEggs.js`, `src/story/eggTriggers.js` | 14 | 3 easter egg kampus + pemicu `biru-langit`, `ggm-putar`. |
| `src/app/fastTravel.js` | 15 | `CAMPUS_DESTINATIONS`, `travelDestinations({campus})`, `waitForRegion`, opsi `settle`. |
| `src/ui/Attribution.js` | 16 | Teks + SRTM. |
| `src/app/devtools.js` | 4 | `regions`, `district`, `portal`, `terrain`, `scheduler`, `colliders`, `regionIdAt`. |
| `tests/e2e/smoke.e2e.mjs` | 17 | Titik ukur §9.2, rute kampus, siklus interior/region 3×, fast travel kampus, `LIMITS` §9.1, laporan budget. |
| `README.md` | 16, 19 | Atribusi SRTM, bagian kampus, kontrol interior, galeri. |
| `docs/superpowers/specs/2026-10-17-unri-asset-catalog.md` | 20 | Bagian status aset. |
| `docs/superpowers/plans/2026-10-17-unri-00-index.md` | 20 | Status M7 + catatan kontrak D1. |
| Tes lama: `tests/storyObjectives.test.js`, `tests/storyReducer.test.js`, `tests/storyData.test.js`, `tests/storyEggTriggers.test.js`, `tests/storyDirector.test.js`, `tests/fastTravel.test.js`, `tests/attribution.test.js`, `tests/humanoidLod.test.js`, `tests/vendorSim.test.js` | 3–16 | Diperluas. |

---

## Task 0: Persiapan & verifikasi antarmuka M0–M6 (tanpa commit)

**Files:** tidak ada perubahan.

- [ ] **Step 1: Baseline hijau**

Run: `git status --short` lalu `npm test` lalu `npm run lint` lalu `npm run build`
Expected: working tree bersih (kecuali berkas tak terlacak milik user), semua tes lulus (catat jumlah berkas/tes
sebagai baseline laporan), lint 0 galat, build sukses.

- [ ] **Step 2: Verifikasi kontrak cerita & save (M0)**

Run:
```bash
grep -n "export function normalizePoint\|export function resolvePoint" src/story/points.js
grep -n "SAVE_VERSION = 3\|export function migrateV2" src/story/storage.js
grep -n "resolvePoint\|normalizePoint\|frameOf" src/core/StoryDirector.js src/entities/StoryNpcs.js src/story/eggTriggers.js
```
Expected: 2 baris di `points.js`; 2 baris di `storage.js`; StoryDirector/StoryNpcs memakai `resolvePoint` untuk
titik ber-`region` (M0). Catat nama field frame resolver di StoryDirector (mis. `this.frameOf`) — Task 12/13 hanya
menambah method, tidak mengubah jalur resolve.

- [ ] **Step 3: Verifikasi distrik, terrain, scheduler (M0–M3)**

Run:
```bash
grep -n "export async function mountDistrict\|export function mountDistrict" src/app/districtMount.js
grep -n "def.build(\|build({" src/app/districtMount.js
grep -n "export const unriDistrict\|manifestUrl\|systems\|dispose" src/districts/unri/index.js
grep -n "export const UNRI_BOUNDARY" src/districts/unri/boundary.js
grep -n "schedule(\|whenIdle\|cancelOwner" src/engine/scheduler.js
node -e "const m=require('./public/districts/unri/manifest.json');console.log(Object.keys(m), (m.ground&&m.ground.chunks||[]).length)"
```
Expected: `mountDistrict` ada; objek ctx yang diteruskan ke `def.build` memuat `scope`, `terrain`, `scheduler`
(catat nama persisnya; Task 4/5 memakainya sebagai `ctx.scope`, `ctx.terrain`, `ctx.scheduler`); `unriDistrict`
memakai `manifestUrl`; `UNRI_BOUNDARY` ada; manifest punya `ground.chunks` (> 0).

- [ ] **Step 4: Verifikasi format & satuan ground (M2)**

Run:
```bash
node -e "const m=require('./public/districts/unri/manifest.json');const k=m.ground.chunks[0];const g=require('./public/districts/unri/ground/'+k+'.json');console.log(k,Object.keys(g));const w=(g.walks||[])[0];console.log('walk',JSON.stringify(w&&{w:w.w,pts:w.pts.slice(0,3)}));const r=(g.roads||[])[0];console.log('road',JSON.stringify(r&&{cls:r.cls,w:r.w,pts:r.pts.slice(0,3)}));const a=(g.areas||[]).find(a=>a.kind==='parking');console.log('parking',JSON.stringify(a&&{kind:a.kind,ring0:a.rings[0].slice(0,3)}))"
```
Expected: kunci `v, key, roads, walks, areas, weights`; titik berupa pasangan `[x, z]` dalam **meter dunia**
(nilai sekelas −1100…+600 dan +300…+2200, desimal ≤ 1 digit). Bila nilai 10× lebih besar (desimeter bulat), set
`GROUND_SCALE = 0.1` di `src/districts/unri/life.js` (Task 5 Step 6); bila datar `[x0,z0,x1,z1,…]`,
`toPoints` (Task 1) sudah menanganinya. Lebar jalan `w` dianggap meter.

- [ ] **Step 5: Verifikasi region, portal, interior, pose (M4–M6)**

Run:
```bash
grep -n "PORTAL_DOORS" src/regions/unri-lembaga/portalDoors.js
grep -rn "id: 'unri-lembaga'\|id: 'unri-rektorat'" src/regions/unri-lembaga/index.js src/regions/unri-rektorat/index.js
grep -n "export function createInteriorPortal\|enter(\|exit(\|state" src/app/interiorPortal.js
grep -rn "'kipas" src/interiors/sekre/
grep -n "export const POSES\|sitChairTyping\|drinkCup\|export function applyPose" src/entities/Humanoid.poses.js
grep -n "LOD0\|lod0\|RADIUS" src/districts/unri/buildingClusters.js
grep -rn "ATTRIBUTION" tools/campusbake src/districts | head
ls public/models/unri/
grep -n "unri\|dev" src/app/fastTravel.js
grep -n "mountDistrict\|createInteriorPortal\|sekre\|register(\|buildEntities\|story.update\|travelDestinations\|createFastTravel\|exposeDevTools\|createRegionManager" src/main.js
grep -n "window.__sim" -A14 src/app/devtools.js
```
Expected dan catatan:
- `PORTAL_DOORS` ada dengan entri `id:'sekre-pemain'`, `pos:{lx,lz}` (kontrak indeks M4).
- Region `unri-lembaga` & `unri-rektorat` terdaftar; catat nama ekspor definisinya (dipakai `main.js` Task 4).
- Portal punya `enter(id)`, `exit()`, dan properti status (`state`) bernilai `'outside'|'fadingIn'|'inside'|'fadingOut'`.
- Interactable kipas ber-id `'kipas'`. Bila id lain (mis. `'kipas-berdiri'`), pakai id itu di
  `SEKRE_KIPAS_ID` (Task 11) — tes `tests/storyUnri.test.js` menguncinya.
- `POSES` memuat `sitChairTyping` dan `drinkCup`; `applyPose(humanoid, poseId, t)` ada.
- Catat nama konstanta radius LOD0 kit (untuk mitigasi Task 18 langkah 1).
- Bila `tools/campusbake` sudah menulis `ATTRIBUTION.txt`, Task 16 mengubah generator itu (bukan berkas hasil).
- Catat GLB yang sudah ada di `public/models/unri/` (M4 mungkin sudah membuat motor A01/A02 — Task 6 Step 1).
- Catat tujuan perjalanan cepat sementara M4 (dihapus di Task 15).
- Catat baris `main.js` tempat distrik dipasang, portal dibuat, entitas dibuat, `story.update` dipanggil, perjalanan
  cepat dibuat, devtools diekspos.
- Catat field `window.__sim` yang sudah ada (mis. `regions`, `district`, `portal`, `terrain`, `scheduler`).

- [ ] **Step 6: Titik berhenti**

Bila salah satu dari: `points.js`, `regionManager`, `mountDistrict`, `PORTAL_DOORS`, `interiorPortal`,
`Humanoid.poses.js`, `public/districts/unri/manifest.json` **tidak ada**, BERHENTI dan laporkan ke user (tonggak
sebelumnya belum selesai). Perbedaan nama kecil: lanjut, catat sebagai penyimpangan.

- [ ] **Step 7: Blender**

Panggil MCP `get_addon_status` lalu `get_scene_info`.
Expected: Blender versi ≥ 4.x terhubung. Bila gagal: catat "Blender tidak tersedia", lanjutkan; Task 6/8 memakai
jalur cadangan (placeholder) dan status katalog aset tetap `placeholder`.

---

## Task 1: Logika murni kehidupan kampus (`src/sim/campusLife.js`, TDD)

**Files:**
- Create: `src/sim/campusLife.js`
- Test: `tests/campusLife.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

Buat `tests/campusLife.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  studentDensity, motorFill, toPoints, pathsFromGround, measurePath, pointAt, chopPath, bucketPaths, cellCenter,
  targetCount, allocateStudents, createWalker, stepWalker, walkerPose, benchSpotsFromPaths, seatsOf, sitterCount,
  mulberry32, hashString, CELL_SIZE,
} from '../src/sim/campusLife.js';

describe('studentDensity (spec §8.4: 07–17 ramai, 17–21 sedang, malam sepi)', () => {
  it('nilai pita dan transisi 0,5 jam', () => {
    expect(studentDensity(12)).toBe(1);
    expect(studentDensity(19)).toBe(0.45);
    expect(studentDensity(23)).toBe(0.05);
    expect(studentDensity(2)).toBe(0.05);
    expect(studentDensity(6)).toBe(0.25);
    expect(studentDensity(7)).toBe(0.25);
    expect(studentDensity(7.25)).toBeCloseTo(0.625, 6);
    expect(studentDensity(17.25)).toBeCloseTo(0.725, 6);
    expect(studentDensity(21.25)).toBeCloseTo(0.25, 6);
  });
  it('jam dibungkus 24 jam; tak hingga = malam', () => {
    expect(studentDensity(24)).toBe(0.05);
    expect(studentDensity(-1)).toBe(0.05);
    expect(studentDensity(36)).toBe(1);
    expect(studentDensity(Number.NaN)).toBe(0.05);
  });
  it('ramai > sedang > sepi', () => {
    expect(studentDensity(10)).toBeGreaterThan(studentDensity(19));
    expect(studentDensity(19)).toBeGreaterThan(studentDensity(23));
  });
});

describe('motorFill', () => {
  it('parkir IC penuh siang; area lain lebih longgar; malam sepi', () => {
    expect(motorFill(12, 'ic')).toBeCloseTo(0.97, 6);
    expect(motorFill(12, 'kampus')).toBeCloseTo(0.65, 6);
    expect(motorFill(2, 'ic')).toBeCloseTo(0.1625, 6);
    expect(motorFill(2, 'kampus')).toBeCloseTo(0.08, 6);
    expect(motorFill(12, 'tidak-dikenal')).toBeCloseTo(motorFill(12, 'kampus'), 6);
  });
});

describe('jalur dari data ground M2', () => {
  const ground = {
    walks: [{ w: 2, pts: [[0, 0], [0, 40]] }, { w: 2, pts: [[5, 5], [5, 9]] }],
    roads: [
      { cls: 'service', w: 4, pts: [[100, 0], [100, 60]] },
      { cls: 'primary', w: 12, pts: [[200, 0], [200, 80]] },
    ],
  };
  it('walks + kedua bahu jalan kampus (offset lebar/2 + 0,9 m); jalan utama & jalur < 8 m dibuang', () => {
    const paths = pathsFromGround(ground);
    expect(paths.filter((p) => p.kind === 'walk').map((p) => p.length)).toEqual([40]);
    const bahu = paths.filter((p) => p.kind === 'bahu');
    expect(bahu.map((p) => p.length)).toEqual([60, 60]);
    expect(bahu.map((p) => p.pts[0][0]).sort((a, b) => a - b)).toEqual([97.1, 102.9]);
  });
  it('titik datar dan skala desimeter', () => {
    expect(toPoints([0, 0, 0, 40])).toEqual([[0, 0], [0, 40]]);
    expect(toPoints([[0, 0], [0, 400]], 0.1)).toEqual([[0, 0], [0, 40]]);
    expect(toPoints([[0, Number.NaN], [1, 1]])).toEqual([[1, 1]]);
    expect(pathsFromGround(null)).toEqual([]);
  });
  it('pointAt: posisi & yaw (maju = (sin, cos)), dijepit di ujung', () => {
    const p = measurePath([[0, 0], [0, 10], [10, 10]], 'walk');
    expect(pointAt(p, 5)).toEqual({ x: 0, z: 5, yaw: 0 });
    const q = pointAt(p, 15);
    expect(q.x).toBeCloseTo(5, 9);
    expect(q.z).toBeCloseTo(10, 9);
    expect(q.yaw).toBeCloseTo(Math.PI / 2, 9);
    expect(pointAt(p, 99).x).toBeCloseTo(10, 9);
  });
  it('chopPath memotong jalur panjang menjadi potongan bersambung ≤ maxLen', () => {
    const p = measurePath([[0, 0], [0, 300]], 'walk');
    const pieces = chopPath(p, 120);
    expect(pieces).toHaveLength(3);
    pieces.forEach((q) => expect(q.length).toBeCloseTo(100, 6));
    expect(pieces[1].pts[0]).toEqual(pieces[0].pts[pieces[0].pts.length - 1]);
  });
  it('bucketPaths per sel 250 m menurut titik tengah potongan', () => {
    const p = measurePath([[0, 0], [0, 600]], 'walk');
    const cells = bucketPaths([p]);
    expect([...cells.keys()].sort()).toEqual(['0_0', '0_1', '0_2']);
    expect(cells.get('0_0')).toHaveLength(2);
    expect(cells.get('0_1')).toHaveLength(2);
    expect(cells.get('0_2')).toHaveLength(1);
    expect(cellCenter('0_1')).toEqual({ x: CELL_SIZE / 2, z: CELL_SIZE * 1.5 });
    expect(cellCenter('-1_2')).toEqual({ x: -CELL_SIZE / 2, z: CELL_SIZE * 2.5 });
  });
});

describe('kepadatan per sel & kolam', () => {
  it('targetCount: kapasitas sel × kepadatan', () => {
    expect(targetCount(600, 1)).toBe(10);
    expect(targetCount(600, 0.45)).toBe(5);
    expect(targetCount(600, 0.05)).toBe(1);
    expect(targetCount(56, 1)).toBe(2);
    expect(targetCount(0, 1)).toBe(0);
    expect(targetCount(100, 0)).toBe(0);
  });
  it('allocateStudents: sel terdekat dulu sampai kolam habis', () => {
    const plan = allocateStudents([
      { key: 'a', want: 6, dist: 100 }, { key: 'b', want: 6, dist: 50 }, { key: 'c', want: 6, dist: 300 },
    ], 10);
    expect(Object.fromEntries(plan)).toEqual({ b: 6, a: 4, c: 0 });
  });
});

describe('pejalan', () => {
  const path = measurePath([[0, 0], [0, 10]], 'walk');
  it('maju, berhenti di ujung lalu berbalik; input tidak dimutasi', () => {
    const w0 = Object.freeze({ s: 9, dir: 1, speed: 1.35, lateral: 0, pause: 0, phase: 0, mode: 'walk' });
    const w1 = stepWalker(w0, path, 1, () => 0);
    expect(w1).toMatchObject({ s: 10, dir: -1, pause: 1.5 });
    const w2 = stepWalker(w1, path, 1, () => 0);
    expect(w2).toMatchObject({ s: 10, pause: 0.5 });
    const w3 = stepWalker(stepWalker(w2, path, 1, () => 0), path, 1, () => 0);
    expect(w3.s).toBeCloseTo(8.65, 9);
    expect(w0.s).toBe(9);
    expect(stepWalker(w0, path, 0, () => 0)).toBe(w0);
    expect(stepWalker(w0, path, Number.NaN, () => 0)).toBe(w0);
  });
  it('createWalker deterministik dari rng; pose = titik jalur + offset lateral, yaw searah gerak', () => {
    expect(createWalker(path, mulberry32(7))).toEqual(createWalker(path, mulberry32(7)));
    expect(walkerPose({ s: 5, dir: 1, lateral: 0.5 }, path)).toEqual({ x: 0.5, z: 5, yaw: 0 });
    expect(walkerPose({ s: 5, dir: -1, lateral: 0 }, path).yaw).toBeCloseTo(Math.PI, 9);
  });
});

describe('bangku diskusi', () => {
  it('tiap 85 m di sisi jalur walk (bukan bahu), dua kursi menghadap jalur', () => {
    const walk = measurePath([[0, 0], [0, 200]], 'walk');
    const bahu = measurePath([[50, 0], [50, 200]], 'bahu');
    const spots = benchSpotsFromPaths([walk, bahu]);
    expect(spots).toHaveLength(2);
    expect(spots[0].z).toBeCloseTo(42.5, 9);
    expect(spots[1].z).toBeCloseTo(127.5, 9);
    expect(spots[0].x).toBeCloseTo(2.4, 9);
    expect(spots[0].rotY).toBeCloseTo(-Math.PI / 2, 9);
    const seats = seatsOf(spots.slice(0, 1));
    expect(seats).toHaveLength(2);
    expect(seats[0].z).toBeCloseTo(42.05, 9);
    expect(seats[1].z).toBeCloseTo(42.95, 9);
    seats.forEach((s) => {
      expect(s.x).toBeCloseTo(2.4, 9);
      expect(s.yaw).toBeCloseTo(-Math.PI / 2, 9);
    });
  });
  it('sitterCount ±25% dibatasi jumlah kursi', () => {
    expect(sitterCount(10, 4)).toBe(3);
    expect(sitterCount(10, 2)).toBe(2);
    expect(sitterCount(10, 0)).toBe(0);
  });
});

describe('rng & hash', () => {
  it('mulberry32 deterministik di [0,1); hashString stabil', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    xs.forEach((x) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); });
    expect(hashString('0_4')).toBe(hashString('0_4'));
    expect(hashString('0_4')).not.toBe(hashString('4_0'));
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/campusLife.test.js`
Expected: FAIL (modul `../src/sim/campusLife.js` tidak ditemukan).

- [ ] **Step 3: Implementasi**

Buat `src/sim/campusLife.js`:

```js
/**
 * Logika murni kehidupan kampus UNRI (spec §8.4): kepadatan mahasiswa per jam game, jalur jalan kaki dari data
 * ground distrik (format M2: `walks` = trotoar/selasar/footway, `roads` = badan jalan), pembagian kolam NPC per
 * sel 250 m, langkah pejalan bolak-balik di polyline, titik bangku diskusi, dan tingkat isi parkir motor.
 * Tanpa three/DOM; fungsi tidak memutasi masukan.
 */

export const CELL_SIZE = 250;

/**
 * Pita kepadatan (jam mulai, inklusif). Spec §8.4: 07–17 ramai, 17–21 sedang, malam sepi.
 * 05–07 pagi awal = [INFERENSI].
 */
export const DENSITY_BANDS = Object.freeze([
  Object.freeze({ from: 0, level: 0.05 }),
  Object.freeze({ from: 5, level: 0.25 }),
  Object.freeze({ from: 7, level: 1 }),
  Object.freeze({ from: 17, level: 0.45 }),
  Object.freeze({ from: 21, level: 0.05 }),
]);
/** Lama transisi linier setelah awal pita (jam) agar NPC tidak muncul/hilang serentak. */
export const DENSITY_RAMP_H = 0.5;

const wrapHour = (h) => ((h % 24) + 24) % 24;

/** Tingkat kepadatan 0..1 untuk jam game; nilai tak hingga dianggap malam. */
export function studentDensity(hour) {
  if (!Number.isFinite(hour)) return DENSITY_BANDS[0].level;
  const h = wrapHour(hour);
  let i = 0;
  for (let k = 0; k < DENSITY_BANDS.length; k += 1) if (h >= DENSITY_BANDS[k].from) i = k;
  const band = DENSITY_BANDS[i];
  const prev = DENSITY_BANDS[(i + DENSITY_BANDS.length - 1) % DENSITY_BANDS.length];
  const t = (h - band.from) / DENSITY_RAMP_H;
  return t >= 1 ? band.level : prev.level + (band.level - prev.level) * t;
}

/**
 * Isi parkir motor per jenis area: `ic` = parkir Integrated Classroom (padat siang hari, riset §4 [S]);
 * `kampus` = area parkir lain [INFERENSI].
 */
export const MOTOR_FILL = Object.freeze({
  ic: Object.freeze({ base: 0.12, gain: 0.85, max: 0.97 }),
  kampus: Object.freeze({ base: 0.05, gain: 0.6, max: 0.8 }),
});

/** Fraksi slot parkir yang terisi (0..1) pada jam game untuk jenis area. */
export function motorFill(hour, kind = 'kampus') {
  const f = MOTOR_FILL[kind] ?? MOTOR_FILL.kampus;
  return Math.min(f.max, f.base + f.gain * studentDensity(hour));
}

/** Kelas jalan kampus yang punya bahu untuk pejalan (jalan utama tepi kampus tidak). */
export const SHOULDER_CLASSES = Object.freeze([
  'tertiary', 'tertiary_link', 'unclassified', 'residential', 'service', 'living_street',
]);
/** Jarak jalur pejalan dari tepi badan jalan (m) [INFERENSI]. */
export const SHOULDER_GAP = 0.9;

/** Titik polyline [[x, z], …] dari data ground (bersarang atau datar), dikali `scale`; titik tak hingga dibuang. */
export function toPoints(pts, scale = 1) {
  if (!Array.isArray(pts)) return [];
  if (pts.length && Array.isArray(pts[0])) {
    return pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [p[0] * scale, p[1] * scale]);
  }
  const out = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    if (Number.isFinite(pts[i]) && Number.isFinite(pts[i + 1])) out.push([pts[i] * scale, pts[i + 1] * scale]);
  }
  return out;
}

/** Polyline tergeser tegak lurus sejauh `d` ke arah normal (−dz, dx); titik dengan arah merosot dilewati. */
export function offsetPolyline(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    out.push([Number((pts[i][0] - (dz / len) * d).toFixed(6)), Number((pts[i][1] + (dx / len) * d).toFixed(6))]);
  }
  return out;
}

/** Jalur terukur {pts, cum, length, kind}; null bila < 2 titik atau lebih pendek dari minLength. */
export function measurePath(pts, kind, minLength = 8) {
  if (!Array.isArray(pts) || pts.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const length = cum[cum.length - 1];
  return length >= minLength ? Object.freeze({ pts, cum, length, kind }) : null;
}

/**
 * Jalur pejalan dari satu chunk ground M2: semua `walks` (trotoar, selasar, footway) + kedua bahu jalan kampus
 * (kelas SHOULDER_CLASSES; offset lebar/2 + SHOULDER_GAP). Lebar `w` dalam meter; `scale` hanya untuk titik.
 */
export function pathsFromGround(ground, { scale = 1 } = {}) {
  const walks = (ground?.walks ?? []).map((w) => measurePath(toPoints(w.pts, scale), 'walk'));
  const shoulders = (ground?.roads ?? [])
    .filter((r) => SHOULDER_CLASSES.includes(r.cls) && Number.isFinite(r.w))
    .flatMap((r) => {
      const pts = toPoints(r.pts, scale);
      const d = r.w / 2 + SHOULDER_GAP;
      return [measurePath(offsetPolyline(pts, d), 'bahu'), measurePath(offsetPolyline(pts, -d), 'bahu')];
    });
  return [...walks, ...shoulders].filter(Boolean);
}

/** Titik pada jarak s sepanjang jalur (dijepit) + yaw arah jalur (konvensi maju = (sin, cos)). */
export function pointAt(path, s) {
  const { pts, cum, length } = path;
  const t = Math.min(Math.max(s, 0), length);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < t) i += 1;
  const a = pts[i - 1];
  const b = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const k = (t - cum[i - 1]) / seg;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  return { x: a[0] + dx * k, z: a[1] + dz * k, yaw: Math.atan2(dx, dz) };
}

/** Potong jalur menjadi n potongan sama panjang (≤ maxLen) yang bersambung. */
export function chopPath(path, maxLen = 120) {
  if (path.length <= maxLen) return [path];
  const n = Math.ceil(path.length / maxLen);
  const step = path.length / n;
  const out = [];
  for (let k = 0; k < n; k += 1) {
    const s0 = k * step;
    const s1 = (k + 1) * step;
    const a = pointAt(path, s0);
    const b = pointAt(path, s1);
    const inner = path.pts.filter((_, i) => path.cum[i] > s0 && path.cum[i] < s1);
    const piece = measurePath([[a.x, a.z], ...inner, [b.x, b.z]], path.kind, 0);
    if (piece) out.push(piece);
  }
  return out;
}

export const cellKeyOf = (x, z, size = CELL_SIZE) => `${Math.floor(x / size)}_${Math.floor(z / size)}`;

/** Pusat sel dari kunci "cx_cz". */
export function cellCenter(key, size = CELL_SIZE) {
  const [cx, cz] = key.split('_').map(Number);
  return { x: (cx + 0.5) * size, z: (cz + 0.5) * size };
}

/** Potongan jalur (≤ maxLen) dikelompokkan per sel menurut titik tengahnya. @returns {Map<string, object[]>} */
export function bucketPaths(paths, { size = CELL_SIZE, maxLen = 120 } = {}) {
  const out = new Map();
  for (const piece of paths.flatMap((p) => chopPath(p, maxLen))) {
    const mid = pointAt(piece, piece.length / 2);
    const key = cellKeyOf(mid.x, mid.z, size);
    out.set(key, [...(out.get(key) ?? []), piece]);
  }
  return out;
}

/** Panjang jalur (m) per mahasiswa saat ramai [INFERENSI kepadatan visual]; batas per sel (budget). */
export const STUDENT_SPACING = 28;
export const MAX_PER_CELL = 10;

/** Jumlah mahasiswa sebuah sel: min(panjang/spacing, max) × kepadatan, dibulatkan. */
export function targetCount(pathLength, density, { spacing = STUDENT_SPACING, max = MAX_PER_CELL } = {}) {
  if (!(pathLength > 0) || !(density > 0)) return 0;
  return Math.round(Math.min(pathLength / spacing, max) * density);
}

/**
 * Bagi kolam NPC ke sel: sel terdekat dulu (seri: kunci), tiap sel maks `want`. @returns {Map<string, number>}
 * @param {Array<{key:string, want:number, dist:number}>} requests
 */
export function allocateStudents(requests, poolSize) {
  const sorted = [...requests].sort((a, b) => a.dist - b.dist || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  let left = Math.max(0, Math.floor(poolSize));
  const out = new Map();
  for (const r of sorted) {
    const n = Math.min(left, Math.max(0, Math.floor(r.want)));
    out.set(r.key, n);
    left -= n;
  }
  return out;
}

export const WALK_SPEED = Object.freeze([1.0, 1.5]);
export const END_PAUSE = Object.freeze([1.5, 6]);
export const LATERAL = 0.8;

/** RNG deterministik mulberry32 (sim tidak boleh mengimpor entities/util). */
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

/** Hash FNV-1a 32 bit untuk benih per kunci sel. */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pejalan baru di posisi acak jalur. */
export function createWalker(path, rng) {
  return Object.freeze({
    s: rng() * path.length,
    dir: rng() < 0.5 ? 1 : -1,
    speed: WALK_SPEED[0] + (WALK_SPEED[1] - WALK_SPEED[0]) * rng(),
    lateral: (rng() * 2 - 1) * LATERAL,
    pause: 0,
    phase: rng() * 10,
    mode: 'walk',
  });
}

/** Satu langkah: maju sepanjang jalur; di ujung berhenti sebentar lalu berbalik. dt tak valid → objek yang sama. */
export function stepWalker(w, path, dt, rng) {
  if (w.mode !== 'walk' || !(dt > 0)) return w;
  if (w.pause > 0) return { ...w, pause: Math.max(0, w.pause - dt) };
  const s = w.s + w.dir * w.speed * dt;
  if (s >= 0 && s <= path.length) return { ...w, s };
  const pause = END_PAUSE[0] + (END_PAUSE[1] - END_PAUSE[0]) * rng();
  return { ...w, s: Math.min(Math.max(s, 0), path.length), dir: -w.dir, pause };
}

/** Pose dunia pejalan: titik jalur + offset lateral ke kanan arah jalur (cos, −sin); yaw searah gerak. */
export function walkerPose(w, path) {
  const p = pointAt(path, w.s);
  const nx = Math.cos(p.yaw);
  const nz = -Math.sin(p.yaw);
  // `+ 0` menormalkan -0 agar hasil deterministik untuk perbandingan.
  return { x: p.x + nx * w.lateral + 0, z: p.z + nz * w.lateral + 0, yaw: w.dir > 0 ? p.yaw : p.yaw + Math.PI };
}

export const BENCH_SPACING = 85;
export const BENCH_OFFSET = 2.4;
export const SEAT_OFFSET = 0.45;

/**
 * Bangku diskusi (P04, "bangku diskusi di bawah pohon" riset §4 [T]) di sisi kanan jalur `walk` tiap
 * BENCH_SPACING m; panjang bangku sejajar jalur. @returns {Array<{x,z,rotY,pathYaw}>}
 */
export function benchSpotsFromPaths(paths, { spacing = BENCH_SPACING, offset = BENCH_OFFSET } = {}) {
  const out = [];
  for (const p of paths) {
    if (p.kind !== 'walk') continue;
    for (let s = spacing / 2; s < p.length; s += spacing) {
      const q = pointAt(p, s);
      out.push(Object.freeze({
        x: q.x + Math.cos(q.yaw) * offset,
        z: q.z - Math.sin(q.yaw) * offset,
        rotY: q.yaw - Math.PI / 2,
        pathYaw: q.yaw,
      }));
    }
  }
  return out;
}

/** Dua kursi per bangku (±SEAT_OFFSET sepanjang bangku), menghadap jalur. */
export function seatsOf(spots) {
  return spots.flatMap((b) => [-1, 1].map((k) => Object.freeze({
    x: b.x + Math.sin(b.pathYaw) * SEAT_OFFSET * k,
    z: b.z + Math.cos(b.pathYaw) * SEAT_OFFSET * k,
    yaw: b.pathYaw - Math.PI / 2,
  })));
}

export const SIT_SHARE = 0.25;

/** Jumlah mahasiswa yang duduk di sel: ±25% dari total, dibatasi kursi tersedia. */
export function sitterCount(total, seats) {
  return Math.min(seats, Math.round(total * SIT_SHARE));
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/campusLife.test.js`
Expected: PASS (semua `describe` hijau).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: 0 galat, tanpa warning baru di `src/sim/campusLife.js`.

- [ ] **Step 6: Commit**

```bash
git add src/sim/campusLife.js tests/campusLife.test.js
```
```bash
git commit -m "feat(sim): logika murni kehidupan kampus (kepadatan per jam, jalur ground, kolam per sel, pejalan, bangku, isi parkir)"
```

---

## Task 2: Slot parkir motor (`src/sim/parkingSlots.js`, TDD)

**Files:**
- Create: `src/sim/parkingSlots.js`
- Test: `tests/parkingSlots.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

Buat `tests/parkingSlots.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parkingSlots, visibleOrder, assignVariants, seedOf, MOTOR_SLOT, VARIANT_WEIGHTS } from '../src/sim/parkingSlots.js';
import { pointInPolygon } from '../src/geo/polygon.js';

const rect = [[0, 0], [20, 0], [20, 10], [0, 10]];
const rotate = (ring, a) => ring.map(([x, z]) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)]);

/** Sudut jejak motor (lebar 2·halfW, panjang 2·halfL) di slot; moncong = −Z lokal. */
function corners(s) {
  const f = { x: -Math.sin(s.rotY), z: -Math.cos(s.rotY) };
  const r = { x: f.z, z: -f.x };
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [
    s.x + r.x * MOTOR_SLOT.halfW * a + f.x * MOTOR_SLOT.halfL * b,
    s.z + r.z * MOTOR_SLOT.halfW * a + f.z * MOTOR_SLOT.halfL * b,
  ]);
}

describe('parkingSlots', () => {
  it('persegi 20 × 10 m: 3 baris × 22 motor, semua jejak di dalam poligon', () => {
    const slots = parkingSlots(rect);
    expect(slots).toHaveLength(66);
    slots.forEach((s) => corners(s).forEach(([x, z]) => expect(pointInPolygon(x, z, rect)).toBe(true)));
  });
  it('baris pertama pasangan menghadap −v, baris kedua +v (moncong ke lorong)', () => {
    const slots = parkingSlots(rect);
    const rows = [...new Set(slots.map((s) => s.z))].sort((a, b) => a - b);
    expect(rows).toEqual([1.58, 3.63, 7.03]);
    expect(slots.find((s) => s.z === 1.58).rotY).toBe(0);
    expect(Math.abs(slots.find((s) => s.z === 3.63).rotY)).toBeCloseTo(Math.PI, 3);
    expect(slots.find((s) => s.z === 7.03).rotY).toBe(0);
  });
  it('poligon diputar 30°: jumlah sama, tetap di dalam', () => {
    const ring = rotate(rect, Math.PI / 6);
    const slots = parkingSlots(ring);
    expect(slots).toHaveLength(66);
    slots.forEach((s) => corners(s).forEach(([x, z]) => expect(pointInPolygon(x, z, ring)).toBe(true)));
  });
  it('kasus tepi: ring tidak valid/terlalu kecil → []; area besar dibatasi maxSlots; deterministik', () => {
    expect(parkingSlots([[0, 0], [1, 0]])).toEqual([]);
    expect(parkingSlots(null)).toEqual([]);
    expect(parkingSlots([[0, 0], [1, 0], [1, 1], [0, 1]])).toEqual([]);
    expect(parkingSlots([[0, 0], [200, 0], [200, 200], [0, 200]])).toHaveLength(MOTOR_SLOT.maxSlots);
    expect(parkingSlots(rect)).toEqual(parkingSlots(rect));
  });
});

describe('urutan tampil, varian, benih', () => {
  it('visibleOrder: permutasi deterministik; benih lain urutan lain', () => {
    const a = visibleOrder(50, 1);
    expect([...a].sort((x, y) => x - y)).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(visibleOrder(50, 1)).toEqual(a);
    expect(visibleOrder(50, 2)).not.toEqual(a);
    expect(visibleOrder(0, 1)).toEqual([]);
  });
  it('assignVariants mengikuti bobot ±0,03 untuk 4000 slot', () => {
    const v = assignVariants(4000, 7);
    for (const [id, w] of VARIANT_WEIGHTS) expect(Math.abs(v.filter((x) => x === id).length / 4000 - w)).toBeLessThan(0.03);
    expect(assignVariants(10, 7)).toEqual(assignVariants(10, 7));
  });
  it('seedOf stabil dan tak bertanda', () => {
    expect(seedOf(-969.2, 970.4)).toBe(seedOf(-969.2, 970.4));
    expect(seedOf(-969.2, 970.4)).toBeGreaterThanOrEqual(0);
    expect(seedOf(1, 2)).not.toBe(seedOf(2, 1));
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/parkingSlots.test.js`
Expected: FAIL (modul `../src/sim/parkingSlots.js` tidak ditemukan).

- [ ] **Step 3: Implementasi**

Buat `src/sim/parkingSlots.js`:

```js
/**
 * Slot parkir motor (murni): baris rapat di dalam poligon parkir (ring dunia dari data ground M2), sumbu baris
 * sejajar sisi terpanjang poligon, pasangan baris saling membelakangi dengan lorong di antara pasangan.
 * Model motor menghadap −Z lokal (aturan katalog aset): rotY dipilih agar moncong menghadap lorong.
 * Parkir padat = riset §4 [S]; ukuran celah [INFERENSI].
 */
import { pointInPolygon } from '../geo/polygon.js';
import { mulberry32 } from './campusLife.js';

export const MOTOR_SLOT = Object.freeze({
  pitch: 0.85,    // jarak antar-motor sebaris (lebar 0,7 + celah 0,15)
  pairGap: 2.05,  // jarak sumbu dua baris saling membelakangi
  aisle: 3.4,     // jarak sumbu baris ke pasangan berikutnya (lorong ±1,4 m)
  margin: 0.6,    // jarak dari tepi poligon
  halfW: 0.37,
  halfL: 0.98,
  maxSlots: 600,  // budget per area
});

/** Bobot varian A01–A04 [INFERENSI: matic & bebek dominan di parkiran kampus]. */
export const VARIANT_WEIGHTS = Object.freeze([
  Object.freeze(['A01', 0.38]),
  Object.freeze(['A02', 0.42]),
  Object.freeze(['A03', 0.12]),
  Object.freeze(['A04', 0.08]),
]);

const round = (v, d) => Number(v.toFixed(d)) + 0;

function longestEdgeAxis(ring) {
  let best = null;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len > 1e-6 && (!best || len > best.len)) best = { x: dx / len, z: dz / len, len };
  }
  return best;
}

function footprintInside(ring, x, z, u, v, o) {
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) {
      const cx = x + u.x * o.halfW * su + v.x * o.halfL * sv;
      const cz = z + u.z * o.halfW * su + v.z * o.halfL * sv;
      if (!pointInPolygon(cx, cz, ring)) return false;
    }
  }
  return true;
}

/**
 * @param {Array<[number, number]>} ring poligon parkir (dunia)
 * @param {Partial<typeof MOTOR_SLOT>} [opts]
 * @returns {Array<{x:number, z:number, rotY:number}>}
 */
export function parkingSlots(ring, opts = {}) {
  const o = { ...MOTOR_SLOT, ...opts };
  if (!Array.isArray(ring) || ring.length < 3) return [];
  const u = longestEdgeAxis(ring);
  if (!u) return [];
  const v = { x: -u.z, z: u.x };
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;
  for (const [x, z] of ring) {
    const a = x * u.x + z * u.z;
    const b = x * v.x + z * v.z;
    minA = Math.min(minA, a);
    maxA = Math.max(maxA, a);
    minB = Math.min(minB, b);
    maxB = Math.max(maxB, b);
  }
  const slots = [];
  let b = minB + o.margin + o.halfL;
  let row = 0;
  while (b <= maxB - o.margin - o.halfL + 1e-9) {
    const face = row % 2 === 0 ? -1 : 1;
    const rotY = round(Math.atan2(-v.x * face, -v.z * face), 4);
    for (let a = minA + o.margin + o.halfW; a <= maxA - o.margin - o.halfW + 1e-9; a += o.pitch) {
      const x = a * u.x + b * v.x;
      const z = a * u.z + b * v.z;
      if (!footprintInside(ring, x, z, u, v, o)) continue;
      slots.push(Object.freeze({ x: round(x, 2), z: round(z, 2), rotY }));
      if (slots.length >= o.maxSlots) return slots;
    }
    b += row % 2 === 0 ? o.pairGap : o.aisle;
    row += 1;
  }
  return slots;
}

/** Permutasi deterministik 0..n−1 (Fisher–Yates): k slot pertama = yang terisi bila isi = k/n. */
export function visibleOrder(n, seed) {
  const order = Array.from({ length: Math.max(0, n) }, (_, i) => i);
  const rng = mulberry32(seed);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Id varian per slot menurut bobot (deterministik). */
export function assignVariants(n, seed, weights = VARIANT_WEIGHTS) {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  const rng = mulberry32(seed ^ 0xa5a5a5a5);
  return Array.from({ length: Math.max(0, n) }, () => {
    let r = rng() * total;
    for (const [id, w] of weights) {
      r -= w;
      if (r < 0) return id;
    }
    return weights[weights.length - 1][0];
  });
}

/** Benih tak bertanda dari titik (pusat area parkir, presisi 0,1 m). */
export function seedOf(x, z) {
  return (Math.imul(Math.round(x * 10), 73856093) ^ Math.imul(Math.round(z * 10), 19349663)) >>> 0;
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/parkingSlots.test.js`
Expected: PASS.

- [ ] **Step 5: Lint & commit**

Run: `npm run lint` → 0 galat.
```bash
git add src/sim/parkingSlots.js tests/parkingSlots.test.js
```
```bash
git commit -m "feat(sim): slot parkir motor rapat di poligon parkir (baris berpasangan, varian berbobot, urutan isi deterministik)"
```

---

## Task 3: Humanoid kampus — ransel, outfit mahasiswa & satpam, ambang LOD, kit `Student.js`

**Files:**
- Modify: `src/entities/Humanoid.dim.js`, `src/entities/Humanoid.js`, `src/entities/Humanoid.outfits.js`,
  `src/entities/Humanoid.lod.js`
- Create: `src/entities/Student.js`
- Test: `tests/studentOutfit.test.js` (baru), `tests/humanoidLod.test.js` (tambah)

- [ ] **Step 1: Tulis tes yang gagal**

Buat `tests/studentOutfit.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createHumanoid } from '../src/entities/Humanoid.js';
import {
  randomStudentOutfit, campusGuardOutfit, ALMAMATER_COLOR, ALMAMATER_BADGE, GUARD_UNIFORM,
} from '../src/entities/Humanoid.outfits.js';
import { makeRng } from '../src/entities/util.js';
import { createStudentKit, STUDENT_LOD } from '../src/entities/Student.js';

describe('randomStudentOutfit (katalog C01/C02)', () => {
  const rng = makeRng(1);
  const outfits = Array.from({ length: 3000 }, () => randomStudentOutfit(rng));
  it('±30% berjas almamater biru langit berlengan panjang + lencana', () => {
    const alma = outfits.filter((o) => o.shirt === ALMAMATER_COLOR);
    expect(alma.length / outfits.length).toBeGreaterThan(0.26);
    expect(alma.length / outfits.length).toBeLessThan(0.34);
    alma.forEach((o) => { expect(o.longSleeve).toBe(true); expect(o.badge).toBe(ALMAMATER_BADGE); });
  });
  it('tanpa celana pendek, topi, rompi, atau caping; ±70% beransel', () => {
    outfits.forEach((o) => {
      expect(o.bottom).not.toBe('shorts');
      expect(o.hat).toBeNull();
      expect(o.vest).toBeNull();
      expect(o.hair).not.toBe('caping');
    });
    const pack = outfits.filter((o) => o.backpack != null).length / outfits.length;
    expect(pack).toBeGreaterThan(0.65);
    expect(pack).toBeLessThan(0.75);
  });
  it('almamaterChance 1 → selalu almamater', () => {
    expect(randomStudentOutfit(makeRng(3), { almamaterChance: 1 }).shirt).toBe(ALMAMATER_COLOR);
  });
});

describe('ransel ikut mesh LOD gabungan', () => {
  it('opsi backpack menambah part dan vertex mesh LOD', () => {
    const base = { shirt: 0xff0000, hair: 'buzz', hairColor: 0x222222 };
    const plain = createHumanoid(base);
    const bag = createHumanoid({ ...base, backpack: 0x222222 });
    expect(plain.parts.backpack).toBeUndefined();
    expect(bag.parts.backpack.isMesh).toBe(true);
    const count = (h) => h.group.userData.humanoidLod.mesh.geometry.attributes.position.count;
    expect(count(bag)).toBeGreaterThan(count(plain));
  });
});

describe('satpam & kit', () => {
  it('seragam satpam kampus', () => {
    const o = campusGuardOutfit(makeRng(2));
    expect(o).toMatchObject({ shirt: GUARD_UNIFORM.shirt, pants: GUARD_UNIFORM.pants, hat: GUARD_UNIFORM.hat, bottom: 'pants' });
  });
  it('kit deterministik per benih; LOD ambang mahasiswa', () => {
    const kit = createStudentKit();
    const a = kit.createStudent(11);
    const b = kit.createStudent(11);
    expect(a.parts.torso.material.color.getHex()).toBe(b.parts.torso.material.color.getHex());
    expect(a.group.userData.humanoidLod).toBeDefined();
    expect(STUDENT_LOD).toEqual({ near: 30, far: 220 });
    const lod = kit.createLod();
    expect(lod.addFrom(a.group)).toBe(1);
    kit.dispose(a);
  });
});
```

Tambahkan ke `tests/humanoidLod.test.js` di dalam `describe('lodLevelFor', …)`:

```js
  it('ambang kustom (mahasiswa kampus: 30 / 220 m)', () => {
    expect(lodLevelFor(30 * 30, 30, 220)).toBe(0);
    expect(lodLevelFor(31 * 31, 30, 220)).toBe(1);
    expect(lodLevelFor(221 * 221, 30, 220)).toBe(2);
  });
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/studentOutfit.test.js tests/humanoidLod.test.js`
Expected: FAIL (`randomStudentOutfit` tidak diekspor, `Student.js` tidak ada, `lodLevelFor(31*31, 30, 220)` masih
memakai ambang 60/320 → 0).

- [ ] **Step 3: Geometri ransel (`src/entities/Humanoid.dim.js`)**

Di objek `GEO`, sesudah entri `badge`, tambahkan:

```js
  // Ransel di punggung (−Z lokal; model menghadap +Z), ikut skala body.
  backpack: at(new RoundedBoxGeometry(0.28, 0.30, 0.13, 2, 0.05), 0, DIM.torsoY + 0.01, -(DIM.torsoD / 2 + 0.065)),
```

- [ ] **Step 4: Opsi `backpack` (`src/entities/Humanoid.js`)**

1. Di JSDoc `createHumanoid`, tambahkan `backpack?:number|null` ke daftar opsi.
2. Di objek default `o`, tambahkan `backpack: null,` sesudah `badge: null,`.
3. Di `buildSpine`, sesudah baris `badge`, tambahkan:

```js
  if (o.backpack != null) { parts.backpack = mesh(GEO.backpack, o.backpack); spine.add(parts.backpack); }
```

(Mesh LOD dibuat sesudah `buildSpine` di `createHumanoid`, jadi ransel ikut digabung.)

- [ ] **Step 5: Outfit mahasiswa & satpam (`src/entities/Humanoid.outfits.js`)**

Tambahkan di akhir berkas:

```js
/** Jas almamater UNRI "biru langit" (riset §6 [T] warna; nilai hex [INFERENSI]). */
export const ALMAMATER_COLOR = 0x7cc4ec;
/** Lencana kuning emas di dada (lambang UNRI kuning emas [T]; bentuk [INFERENSI]). */
export const ALMAMATER_BADGE = 0xf2c200;
export const BACKPACK_COLORS = Object.freeze([0x222222, 0x1f3a5f, 0x5d4037, 0x2e7d32, 0x8e24aa, 0x37474f]);
/** Seragam satpam kampus [INFERENSI pola umum Perpol 4/2020: atasan krem, bawahan coklat tua, pet coklat]. */
export const GUARD_UNIFORM = Object.freeze({ shirt: 0xd9c8a0, pants: 0x4e3b2a, hat: 0x3e2f22, badge: 0xc9a227 });

/**
 * Mahasiswa (katalog C01/C02): basis kasual; ±30% berjas almamater biru langit (lengan panjang + lencana), ±70%
 * beransel; tanpa topi/rompi/caping; celana pendek diganti celana panjang [POLA UMUM kampus negeri].
 */
export function randomStudentOutfit(rng, { almamaterChance = 0.3, backpackChance = 0.7 } = {}) {
  const base = randomCasualOutfit(rng);
  const almamater = rng() < almamaterChance;
  const backpack = rng() < backpackChance ? pick(rng, BACKPACK_COLORS) : null;
  const caping = base.hair === 'caping';
  const shorts = base.bottom === 'shorts';
  return {
    ...base,
    hair: caping ? pick(rng, HAIR_STYLES) : base.hair,
    hairColor: caping ? pick(rng, HAIR_COLORS) : base.hairColor,
    hat: null,
    vest: null,
    shirt: almamater ? ALMAMATER_COLOR : base.shirt,
    longSleeve: almamater,
    badge: almamater ? ALMAMATER_BADGE : null,
    bottom: shorts ? 'pants' : base.bottom,
    pants: shorts ? pick(rng, PANTS_COLORS) : base.pants,
    backpack,
    rng,
  };
}

/** Satpam kampus (katalog C10): seragam GUARD_UNIFORM, pet, rambut cepak. */
export function campusGuardOutfit(rng) {
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: GUARD_UNIFORM.shirt,
    pants: GUARD_UNIFORM.pants,
    hair: 'buzz',
    hairColor: 0x222222,
    hijab: null,
    hat: GUARD_UNIFORM.hat,
    badge: GUARD_UNIFORM.badge,
    bottom: 'pants',
    longSleeve: false,
    shoes: 0x111111,
    height: range(rng, 1.62, 1.8),
    rng,
  };
}
```

- [ ] **Step 6: Ambang LOD kustom (`src/entities/Humanoid.lod.js`)**

1. Hapus konstanta `NEAR2` dan `FAR2`.
2. Ganti `lodLevelFor` dengan:

```js
/** Level LOD dari jarak kuadrat ke kamera. NaN dianggap terdekat agar humanoid tidak hilang karena data rusak. */
export function lodLevelFor(dist2, near = LOD_NEAR, far = LOD_FAR) {
  if (!(dist2 > near * near)) return 0;
  return dist2 <= far * far ? 1 : 2;
}
```

3. Ubah tanda tangan menjadi `export function createHumanoidLod({ near = LOD_NEAR, far = LOD_FAR } = {})`, tambahkan
   JSDoc `@param {{near?:number, far?:number}} [opts] ambang opsional (default 60/320 m)`, dan di `update(camPos)`
   ganti pemanggilannya menjadi `const level = lodLevelFor(dx * dx + dy * dy + dz * dz, near, far);`.

- [ ] **Step 7: Kit `src/entities/Student.js`**

```js
/**
 * Kit humanoid kampus yang disuntik ke distrik UNRI (keputusan D1: lapisan districts tidak boleh mengimpor
 * entities): mahasiswa (C01 almamater ±30% / C02 kasual, ransel), satpam (C10), LOD humanoid yang ada dengan
 * ambang lebih pendek (hemat draw call), animasi jalan/diam, dan pose M5 (`Humanoid.poses.js`).
 */
import { createHumanoid, animateWalk, animateIdle } from './Humanoid.js';
import { applyPose } from './Humanoid.poses.js';
import { createHumanoidLod } from './Humanoid.lod.js';
import { randomStudentOutfit, campusGuardOutfit } from './Humanoid.outfits.js';
import { makeRng } from './util.js';

/** Ambang LOD mahasiswa/satpam (m): detail penuh ≤ near, mesh gabungan ≤ far, di luar disembunyikan. */
export const STUDENT_LOD = Object.freeze({ near: 30, far: 220 });

/**
 * @param {{almamaterChance?: number}} [opts]
 * @returns {Readonly<{createStudent(seed:number):object, createGuard(seed:number):object, createLod():object,
 *   walk(h:object, t:number):void, idle(h:object, t:number):void, pose(h:object, poseId:string, t:number):void,
 *   dispose(h:object):void}>}
 */
export function createStudentKit({ almamaterChance = 0.3 } = {}) {
  return Object.freeze({
    createStudent: (seed) => createHumanoid(randomStudentOutfit(makeRng(seed), { almamaterChance })),
    createGuard: (seed) => createHumanoid(campusGuardOutfit(makeRng(seed))),
    createLod: () => createHumanoidLod(STUDENT_LOD),
    walk: (h, t) => animateWalk(h, t),
    idle: (h, t) => animateIdle(h, t),
    pose: (h, poseId, t) => applyPose(h, poseId, t),
    /** Lepas geometri unik humanoid (mesh LOD gabungan); geometri badan & material bersama tidak disentuh. */
    dispose: (h) => h.group.userData.humanoidLod?.mesh.geometry.dispose(),
  });
}
```

Bila Task 0 Step 5 mencatat tanda tangan `applyPose` berbeda (mis. `applyPose(parts, poseId, t)`), sesuaikan baris
`pose` saja dan catat.

- [ ] **Step 8: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/studentOutfit.test.js tests/humanoidLod.test.js`
Expected: PASS. Lalu `npm test` → seluruh suite hijau.

- [ ] **Step 9: Lint & commit**

Run: `npm run lint` → 0 galat.
```bash
git add src/entities/Humanoid.dim.js src/entities/Humanoid.js src/entities/Humanoid.outfits.js src/entities/Humanoid.lod.js src/entities/Student.js tests/studentOutfit.test.js tests/humanoidLod.test.js
```
```bash
git commit -m "feat(entities): mahasiswa beralmamater biru langit dan beransel, seragam satpam kampus, ambang LOD kustom, kit humanoid kampus"
```

---

## Task 4: Layanan distrik (`services`) + paparan devtools kampus

**Files:**
- Modify: `src/app/districtMount.js`, `src/app/devtools.js`, `src/main.js`

- [ ] **Step 1: `mountDistrict` meneruskan `services` (D1)**

Di `src/app/districtMount.js` (bentuk M1: `mountDistrict(app, def, { terrain, collider, minimap, scheduler,
createScope, … })`):
1. Tambahkan `services = {}` ke destrukturisasi opsi (sesudah `scheduler`) dan ke JSDoc:
   `services?: {npc?:object, camera?:object, hour?:() => number, excludeAt?:(x:number, z:number) => boolean}` dengan
   kalimat "layanan composition root, diteruskan apa adanya ke `ctx.services` (lapisan districts tidak boleh
   mengimpor entities/regions)".
2. Pada objek ctx yang diteruskan ke `def.build({ … })`, tambahkan properti `services: Object.freeze({ ...services })`.

Tidak ada perubahan perilaku lain (tanpa `services` → objek kosong beku).

- [ ] **Step 2: Field devtools kampus (`src/app/devtools.js`)**

Tambahkan parameter dan field `window.__sim` berikut (gabungkan dengan yang mungkin sudah ditambahkan M0–M6; jangan
menggandakan; bila M0–M6 mengubah tubuh `teleport`, pertahankan versi mereka):

```js
export function exposeDevTools({
  app, ents, rig, time, weather, store, audioBus, story, colliders, city = null, remountRegion = null, fastTravel = null, teardown,
  regions = null, district = null, portal = null, terrain = null, scheduler = null, regionIdAt = () => null,
}) {
  window.__sim = {
    app, ents, rig, time, weather, store, audioBus, story, city, remountRegion, fastTravel,
    regions, district, portal, terrain, scheduler, colliders, regionIdAt,
    teleport(x, z, yaw = 0) {
      ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
      ents.bike.setCollider(createCollider({ x, z }, colliders.isWalkable, colliders.penetration));
    },
    stats: () => ({ ...app.renderer.info.render, fps: document.getElementById('hud-fps').textContent }),
    /** Bongkar seluruh aplikasi (uji siklus hidup); muat ulang halaman untuk memulai lagi. */
    teardown,
  };
}
```

- [ ] **Step 3: Komposisi di `src/main.js`**

1. Impor:

```js
import { createStudentKit } from './entities/Student.js';
import { regionContains } from './regions/Region.js';
```

2. Tepat sebelum pemanggilan `mountDistrict(app, unriDistrict, { … })` (catatan Task 0 Step 5), tambahkan (ganti
   `unriLembagaRegion` / `unriRektoratRegion` dengan nama ekspor definisi region yang dicatat di Task 0):

```js
  // Region hero kampus punya isi sendiri (mis. motor rapat di teras sekre M4): distrik tidak menaruh instans di dalam
  // mask-nya. regionIdAt juga dipakai devtools/E2E untuk mengetahui region yang menaungi sebuah titik dunia.
  const heroRegions = [unriLembagaRegion, unriRektoratRegion];
  const regionIdAt = (x, z) => heroRegions.find((def) => regionContains(def, x, z))?.id ?? null;
  const districtServices = Object.freeze({
    npc: createStudentKit(),
    camera: app.camera,
    hour: () => time.hour,
    excludeAt: (x, z) => regionIdAt(x, z) !== null,
  });
```

3. Tambahkan `services: districtServices` ke objek opsi `mountDistrict(app, unriDistrict, { … })`.
4. Pada pemanggilan `exposeDevTools({ … })` tambahkan (nama variabel sesuai `main.js` hasil M0–M6):
   `regions: <regionManager>, district: <hasil mountDistrict>.district, portal: <interiorPortal>,
   terrain: <terrainService/heightfield>, scheduler: <scheduler>, regionIdAt`.

- [ ] **Step 4: Verifikasi**

Run: `npm test` lalu `npm run lint` lalu `npm run build`
Expected: semua hijau (belum ada perilaku baru; `ctx.services` belum dipakai distrik).

- [ ] **Step 5: Commit**

```bash
git add src/app/districtMount.js src/app/devtools.js src/main.js
```
```bash
git commit -m "feat(app): layanan composition root untuk distrik (kit humanoid, kamera, jam, eksklusi region hero) dan devtools kampus"
```

---

## Task 5: Mahasiswa NPC, satpam, umpan ground, `life.js` (+ harness cek cepat)

**Files:**
- Create: `src/districts/unri/groundFeed.js`, `src/districts/unri/students.js`, `src/districts/unri/guards.js`,
  `src/districts/unri/life.js`, `tests/groundFeed.test.js`, `tests/e2e/harness.unri.mjs`
- Modify: `src/districts/unri/index.js`

- [ ] **Step 1: Tes `groundFeed` (gagal dulu)**

Buat `tests/groundFeed.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createGroundFeed } from '../src/districts/unri/groundFeed.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup({ fail = [] } = {}) {
  const log = { fetched: [], added: [], removed: [], warns: 0 };
  const feed = createGroundFeed({
    baseUrl: '/districts/unri/',
    chunkKeys: ['0_0', '1_0', '-1_0', '0_1', '9_9'],
    fetchJson: (url) => {
      log.fetched.push(url);
      const key = url.match(/ground\/(.+)\.json$/)[1];
      return fail.includes(key) ? Promise.reject(new Error('HTTP 500')) : Promise.resolve({ key });
    },
    onAdd: (key, data) => log.added.push([key, data.key]),
    onRemove: (key) => log.removed.push(key),
    logger: { warn: () => { log.warns += 1; } },
  });
  return { feed, log };
}

describe('createGroundFeed', () => {
  it('memuat hanya kunci manifest dalam radius, sekali per kunci', async () => {
    const { feed, log } = setup();
    feed.update({ x: 250, z: 250 });
    feed.update({ x: 250, z: 250 });
    await flush();
    expect([...log.fetched].sort()).toEqual([
      '/districts/unri/ground/-1_0.json', '/districts/unri/ground/0_0.json',
      '/districts/unri/ground/0_1.json', '/districts/unri/ground/1_0.json',
    ]);
    expect(log.added.map(([k]) => k).sort()).toEqual(['-1_0', '0_0', '0_1', '1_0']);
    expect(log.added.every(([k, d]) => k === d)).toBe(true);
    expect(feed.keys.sort()).toEqual(['-1_0', '0_0', '0_1', '1_0']);
  });
  it('melepas chunk di luar radius lepas; dispose melepas semua dan mengabaikan update', async () => {
    const { feed, log } = setup();
    feed.update({ x: 250, z: 250 });
    await flush();
    feed.update({ x: 4750, z: 4750 });
    expect([...log.removed].sort()).toEqual(['-1_0', '0_0', '0_1', '1_0']);
    await flush();
    expect(log.added.map(([k]) => k)).toContain('9_9');
    feed.dispose();
    expect(log.removed).toContain('9_9');
    feed.update({ x: 250, z: 250 });
    await flush();
    expect(log.added.filter(([k]) => k === '0_0')).toHaveLength(1);
  });
  it('fetch gagal diperingatkan sekali dan tidak diulang; muatan setelah dispose dibuang', async () => {
    const { feed, log } = setup({ fail: ['0_0'] });
    feed.update({ x: 250, z: 250 });
    await flush();
    feed.update({ x: 250, z: 250 });
    await flush();
    expect(log.fetched.filter((u) => u.endsWith('/0_0.json'))).toHaveLength(1);
    expect(log.warns).toBe(1);
    const late = setup();
    late.feed.update({ x: 250, z: 250 });
    late.feed.dispose();
    await flush();
    expect(late.log.added).toEqual([]);
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/groundFeed.test.js`
Expected: FAIL (modul tidak ditemukan).

- [ ] **Step 2: `src/districts/unri/groundFeed.js`**

```js
/**
 * Umpan data ground distrik untuk kehidupan kampus (keputusan D3): memuat `ground/<key>.json` (kunci dari
 * `manifest.ground.chunks`) di sekitar fokus dan melepasnya saat jauh, terpisah dari mesh tanah M2 sehingga
 * mahasiswa/motor tidak bergantung pada internal ground.js. Berkas yang sama biasanya sudah di cache HTTP.
 * Fetch gagal: diperingatkan sekali per kunci dan tidak diulang (chunk dianggap kosong, spec §10).
 */
import { tilesInRadius } from '../../geo/tiles.js';

export const FEED_LOAD_RADIUS = 650;
export const FEED_DROP_RADIUS = 950;

/** fetch JSON dengan galat jelas untuk status HTTP ≥ 400. */
export function defaultFetchJson(url) {
  return fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status} ${url}`))));
}

/**
 * @param {{baseUrl:string, chunkKeys:string[], fetchJson?:(url:string)=>Promise<object>,
 *   onAdd:(key:string, data:object)=>void, onRemove:(key:string)=>void, logger?:{warn:Function}}} opts
 */
export function createGroundFeed({ baseUrl, chunkKeys, fetchJson = defaultFetchJson, onAdd, onRemove, logger = console }) {
  const known = new Set(chunkKeys);
  const loaded = new Map();
  const pending = new Set();
  const failed = new Set();
  let disposed = false;

  const load = (key) => {
    pending.add(key);
    fetchJson(`${baseUrl}ground/${key}.json`).then((data) => {
      pending.delete(key);
      if (disposed) return;
      loaded.set(key, data);
      onAdd(key, data);
    }, (err) => {
      pending.delete(key);
      failed.add(key);
      logger.warn(`Kehidupan kampus: ground ${key} gagal dimuat (chunk dilewati):`, err);
    });
  };

  return {
    /** @param {{x:number, z:number}} focus titik dunia */
    update(focus) {
      if (disposed || !focus) return;
      for (const t of tilesInRadius(focus.x, focus.z, FEED_LOAD_RADIUS)) {
        if (known.has(t.key) && !loaded.has(t.key) && !pending.has(t.key) && !failed.has(t.key)) load(t.key);
      }
      const keep = new Set(tilesInRadius(focus.x, focus.z, FEED_DROP_RADIUS).map((t) => t.key));
      for (const key of [...loaded.keys()]) {
        if (keep.has(key)) continue;
        loaded.delete(key);
        onRemove(key);
      }
    },
    get keys() { return [...loaded.keys()]; },
    dispose() {
      disposed = true;
      for (const key of [...loaded.keys()]) onRemove(key);
      loaded.clear();
    },
  };
}
```

Run: `node node_modules/vitest/vitest.mjs run tests/groundFeed.test.js`
Expected: PASS.

- [ ] **Step 3: `src/districts/unri/students.js`**

```js
/**
 * Mahasiswa NPC kampus (spec UNRI §8.4, katalog C01/C02): kolam humanoid tetap (STUDENT_POOL, dibuat bertahap
 * lewat scheduler) yang dibagikan ke sel 250 m di sekitar fokus. Mahasiswa berjalan bolak-balik di jalur ground
 * (trotoar/selasar `walks` + bahu jalan kampus) atau duduk di bangku diskusi (P04 semen) dengan pose M5
 * `sitChairTyping` (main HP/laptop) / `drinkCup`. Kepadatan mengikuti jam game (studentDensity). Humanoid dari kit
 * `npc` yang disuntik (D1). Kolam tidak pernah dilepas selama distrik hidup → memori GPU stabil (E2E §9.1).
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { createBenches } from '../../world/props/Bench.js';
import {
  pathsFromGround, bucketPaths, cellCenter, studentDensity, targetCount, allocateStudents, createWalker,
  stepWalker, walkerPose, benchSpotsFromPaths, seatsOf, sitterCount, mulberry32, hashString,
} from '../../sim/campusLife.js';

/** Budget: jumlah humanoid mahasiswa maksimum (mitigasi §9.3 langkah 2 boleh menurunkannya). */
export const STUDENT_POOL = 40;
export const ACTIVE_RADIUS = 300;
export const RELEASE_RADIUS = 420;
const THINK_SEC = 0.5;
const SIT_POSES = Object.freeze(['sitChairTyping', 'drinkCup']);

/**
 * @param {{npc:object, terrain:{heightAt(x:number,z:number):number}, scheduler:{schedule:Function}, scope:object,
 *   hour:() => number, camera:{position:object}, groundScale?:number, seed?:number}} opts
 */
export function createStudents({ npc, terrain, scheduler, scope, hour, camera, groundScale = 1, seed = 0x5a1d }) {
  const group = new THREE.Group();
  group.name = 'mahasiswa';
  const lod = npc.createLod();
  const pool = [];             // { h, used }
  const chunks = new Map();    // chunkKey -> { cells: Map(cellKey -> {paths, spots}), benches: Group }
  const active = new Map();    // cellKey -> { seats, members }
  const stepRng = mulberry32(seed ^ 0x51ed);
  let think = 0;
  let clock = 0;

  const poolTask = scheduler.schedule(function* buildPool() {
    for (let i = 0; i < STUDENT_POOL; i += 1) {
      const h = withScope(scope, () => npc.createStudent(seed + i * 7919));
      h.group.name = `mahasiswa-${i}`;
      h.group.visible = false;
      group.add(h.group);
      lod.addFrom(h.group);
      pool.push({ h, used: false });
      yield;
    }
  }, { owner: 'unri:mahasiswa' });

  const cellData = (key) => {
    const paths = [];
    const spots = [];
    for (const c of chunks.values()) {
      const d = c.cells.get(key);
      if (d) { paths.push(...d.paths); spots.push(...d.spots); }
    }
    return { paths, spots };
  };

  const free = (m) => { m.slot.used = false; m.slot.h.group.visible = false; };

  const release = (key) => {
    const cell = active.get(key);
    if (!cell) return;
    cell.members.forEach(free);
    active.delete(key);
  };

  function seatMember(slot, cell, index, rng) {
    const s = cell.seats[index];
    slot.h.group.position.set(s.x, terrain.heightAt(s.x, s.z), s.z);
    slot.h.group.rotation.y = s.yaw;
    return { slot, seatIndex: index, pose: SIT_POSES[rng() < 0.5 ? 0 : 1], phase: rng() * 10 };
  }

  function walkMember(slot, paths, rng) {
    const path = paths[Math.floor(rng() * paths.length) % paths.length];
    return { slot, seatIndex: null, path, w: createWalker(path, rng) };
  }

  function resize(key, n) {
    const { paths, spots } = cellData(key);
    if (!paths.length) { release(key); return; }
    const cell = active.get(key) ?? { seats: seatsOf(spots), members: [] };
    while (cell.members.length > n) free(cell.members.pop());
    const rng = mulberry32(hashString(key) ^ Math.imul(cell.members.length + 1, 2654435761));
    const sitTarget = sitterCount(n, cell.seats.length);
    while (cell.members.length < n) {
      const slot = pool.find((p) => !p.used);
      if (!slot) break;
      slot.used = true;
      const taken = new Set(cell.members.filter((m) => m.seatIndex != null).map((m) => m.seatIndex));
      const freeSeat = cell.seats.findIndex((_, i) => !taken.has(i));
      const member = taken.size < sitTarget && freeSeat >= 0 ? seatMember(slot, cell, freeSeat, rng) : walkMember(slot, paths, rng);
      slot.h.group.visible = true;
      cell.members.push(member);
    }
    if (cell.members.length) active.set(key, cell);
    else active.delete(key);
  }

  function rethink(focus) {
    const density = studentDensity(hour());
    const keys = new Set();
    for (const c of chunks.values()) for (const k of c.cells.keys()) keys.add(k);
    for (const key of [...active.keys()]) {
      const c = cellCenter(key);
      if (!keys.has(key) || Math.hypot(c.x - focus.x, c.z - focus.z) > RELEASE_RADIUS) release(key);
    }
    const requests = [];
    for (const key of keys) {
      const c = cellCenter(key);
      const dist = Math.hypot(c.x - focus.x, c.z - focus.z);
      if (dist > ACTIVE_RADIUS && !active.has(key)) continue;
      const length = cellData(key).paths.reduce((s, p) => s + p.length, 0);
      requests.push({ key, dist, want: targetCount(length, density) });
    }
    const plan = [...allocateStudents(requests, pool.length)];
    const current = (key) => active.get(key)?.members.length ?? 0;
    // Kecilkan dulu agar anggota yang dilepas bisa dipakai sel yang tumbuh.
    for (const [key, n] of plan.filter(([k, v]) => current(k) > v)) resize(key, n);
    for (const [key, n] of plan.filter(([k, v]) => current(k) <= v)) resize(key, n);
  }

  function animate(dt) {
    for (const cell of active.values()) {
      for (const m of cell.members) {
        const h = m.slot.h;
        if (m.seatIndex != null) {
          npc.pose(h, m.pose, clock + m.phase);
          continue;
        }
        m.w = stepWalker(m.w, m.path, dt, stepRng);
        const p = walkerPose(m.w, m.path);
        h.group.position.set(p.x, terrain.heightAt(p.x, p.z), p.z);
        h.group.rotation.y = p.yaw;
        if (m.w.pause > 0) npc.idle(h, clock + m.w.phase);
        else npc.walk(h, clock * (m.w.speed / 1.35) + m.w.phase);
      }
    }
  }

  return {
    group,
    get stats() {
      let members = 0;
      let sitting = 0;
      for (const c of active.values()) {
        members += c.members.length;
        sitting += c.members.filter((m) => m.seatIndex != null).length;
      }
      return { pool: pool.length, active: members, sitting, cells: active.size, chunks: chunks.size };
    },
    /** Data ground chunk M2 tersedia (dipanggil life.js di dalam scope distrik). */
    addGroundChunk(key, data) {
      if (chunks.has(key)) this.removeGroundChunk(key);
      const buckets = bucketPaths(pathsFromGround(data, { scale: groundScale }));
      const cells = new Map([...buckets].map(([cellKey, paths]) => [cellKey, { paths, spots: benchSpotsFromPaths(paths) }]));
      const spots = [...cells.values()].flatMap((c) => c.spots);
      const benches = createBenches(spots.map((s) => ({ x: s.x, z: s.z, y: terrain.heightAt(s.x, s.z), rotY: s.rotY, type: 'semen' })));
      benches.name = `bangkuDiskusi:${key}`;
      group.add(benches);
      chunks.set(key, { cells, benches });
    },
    removeGroundChunk(key) {
      const c = chunks.get(key);
      if (!c) return;
      for (const cellKey of c.cells.keys()) release(cellKey);
      c.benches.removeFromParent();
      c.benches.traverse((o) => {
        if (!o.isInstancedMesh) return;
        o.geometry.dispose(); // geometri gabungan unik per createBenches; material milik scope
        o.dispose();
      });
      chunks.delete(key);
    },
    /** @param {number} dt @param {{x:number, z:number}|null} focus titik dunia */
    update(dt, focus) {
      clock += dt;
      think -= dt;
      if (focus && think <= 0) {
        think = THINK_SEC;
        rethink(focus);
      }
      animate(dt);
      lod.update(camera.position);
    },
    dispose() {
      poolTask.cancel();
      for (const key of [...chunks.keys()]) this.removeGroundChunk(key);
      pool.forEach((p) => npc.dispose(p.h));
      group.removeFromParent();
      group.clear();
    },
  };
}
```

- [ ] **Step 4: `src/districts/unri/guards.js`**

```js
/**
 * Satpam kampus (katalog C10) di Pos Keamanan OSM way/327534471 (Gerbang Binakrida, Jl. Binawidya UNRI; riset §4
 * "satpam UNRI berjaga di pos" [T]): berdiri di sisi selatan & utara pos menghadap jalan. Posisi berdiri dan
 * seragam (`campusGuardOutfit`) = [INFERENSI]. Tinggi tanah diperbarui tiap detik (chunk terrain bisa tiba belakangan).
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';

export const GUARD_SPOTS = Object.freeze([
  Object.freeze({ id: 'satpam-binakrida-selatan', x: -1074.7, z: 1287.8, yaw: 0 }),
  Object.freeze({ id: 'satpam-binakrida-utara', x: -1074.7, z: 1303.6, yaw: Math.PI }),
]);
const REGROUND_SEC = 1;

export function createGuards({ npc, terrain, scheduler, scope, camera, spots = GUARD_SPOTS }) {
  const group = new THREE.Group();
  group.name = 'satpamKampus';
  const lod = npc.createLod();
  const guards = [];
  let t = 0;
  let reground = 0;
  const task = scheduler.schedule(function* buildGuards() {
    for (let i = 0; i < spots.length; i += 1) {
      const s = spots[i];
      const h = withScope(scope, () => npc.createGuard(0xc10 + i));
      h.group.name = s.id;
      h.group.position.set(s.x, terrain.heightAt(s.x, s.z), s.z);
      h.group.rotation.y = s.yaw;
      group.add(h.group);
      lod.addFrom(h.group);
      guards.push({ h, spot: s, phase: i * 1.7 });
      yield;
    }
  }, { owner: 'unri:satpam' });
  return {
    group,
    get stats() { return { count: guards.length }; },
    update(dt) {
      t += dt;
      reground -= dt;
      const regroundNow = reground <= 0;
      if (regroundNow) reground = REGROUND_SEC;
      for (const g of guards) {
        if (regroundNow) g.h.group.position.y = terrain.heightAt(g.spot.x, g.spot.z);
        npc.idle(g.h, t + g.phase);
      }
      lod.update(camera.position);
    },
    dispose() {
      task.cancel();
      guards.forEach((g) => npc.dispose(g.h));
      group.removeFromParent();
      group.clear();
    },
  };
}
```

- [ ] **Step 5: `src/districts/unri/life.js` (versi Task 5)**

```js
/**
 * Kehidupan kampus (spec UNRI §8.4): komposisi mahasiswa dan satpam di atas umpan data ground (groundFeed),
 * satu sistem fase `sim`. Humanoid lewat `services.npc` (D1); tanpa services distrik tetap jalan tanpa NPC.
 * Data ground diteruskan setelah chunk terrain-nya ada (`terrain.has`) agar tinggi bangku/kursi benar; batas
 * tunggu TERRAIN_WAIT_MS (chunk terrain gagal = datar, spec §10).
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { createGroundFeed, defaultFetchJson } from './groundFeed.js';
import { createStudents } from './students.js';
import { createGuards } from './guards.js';

/** Satuan titik ground (Task 0 Step 4): 1 = meter dunia, 0.1 = desimeter. */
export const GROUND_SCALE = 1;
const TERRAIN_WAIT_MS = 10000;

/**
 * @param {{scope:object, terrain:object, scheduler:object, services?:object, manifestUrl:string,
 *   fetchJson?:(url:string)=>Promise<object>, now?:() => number, logger?:object}} opts
 */
export function createCampusLife({
  scope, terrain, scheduler, services = {}, manifestUrl, fetchJson = defaultFetchJson, now = () => performance.now(), logger = console,
}) {
  const group = new THREE.Group();
  group.name = 'kehidupanKampus';
  const npc = services.npc ?? null;
  const camera = services.camera ?? null;
  const hour = typeof services.hour === 'function' ? services.hour : () => 12;
  const withNpc = Boolean(npc && camera);
  const students = withNpc ? createStudents({ npc, terrain, scheduler, scope, hour, camera, groundScale: GROUND_SCALE }) : null;
  const guards = withNpc ? createGuards({ npc, terrain, scheduler, scope, camera }) : null;
  const parts = [students, guards].filter(Boolean);
  parts.forEach((p) => group.add(p.group));
  const consumers = [students].filter(Boolean);

  const waiting = new Map(); // chunkKey -> { data, since }
  const added = new Set();
  const terrainReady = (key) => typeof terrain.has !== 'function' || terrain.has(key);
  const flushWaiting = () => {
    for (const [key, w] of [...waiting]) {
      if (!terrainReady(key) && now() - w.since < TERRAIN_WAIT_MS) continue;
      waiting.delete(key);
      added.add(key);
      withScope(scope, () => consumers.forEach((c) => c.addGroundChunk(key, w.data)));
    }
  };

  let feed = null;
  let disposed = false;
  const baseUrl = manifestUrl.replace(/[^/]*$/, '');
  fetchJson(manifestUrl)
    .then((manifest) => {
      if (disposed) return;
      feed = createGroundFeed({
        baseUrl, chunkKeys: manifest?.ground?.chunks ?? [], fetchJson, logger,
        onAdd: (key, data) => waiting.set(key, { data, since: now() }),
        onRemove: (key) => {
          waiting.delete(key);
          if (added.delete(key)) consumers.forEach((c) => c.removeGroundChunk(key));
        },
      });
    })
    .catch((err) => logger.error('Kehidupan kampus: manifest distrik gagal dimuat:', err));

  const system = {
    id: 'unri.kehidupan',
    phase: 'sim',
    update(dt, frame) {
      const focus = frame?.focus ?? frame?.bikePos ?? null;
      if (focus) feed?.update(focus);
      flushWaiting();
      students?.update(dt, focus);
      guards?.update(dt);
    },
  };

  return {
    group,
    systems: [system],
    students,
    guards,
    get feed() { return feed; },
    dispose() {
      disposed = true;
      feed?.dispose();
      parts.forEach((p) => p.dispose());
      group.removeFromParent();
    },
  };
}
```

- [ ] **Step 6: Sambungkan ke distrik (`src/districts/unri/index.js`)**

Di dalam `build(ctx)` distrik UNRI (M1–M3):
1. Impor: `import { createCampusLife } from './life.js';`
2. Sesudah grup distrik dibuat dan sebelum `return`, tambahkan (pakai URL manifest yang sama dengan `manifestUrl`
   definisi distrik; bila disimpan sebagai konstanta, mis. `MANIFEST_URL`, pakai konstanta itu):

```js
  // M7: kehidupan kampus (mahasiswa, satpam; Task 7–8 menambah motor & props). Humanoid lewat ctx.services (D1).
  const life = createCampusLife({
    scope: ctx.scope, terrain: ctx.terrain, scheduler: ctx.scheduler, services: ctx.services ?? {}, manifestUrl: MANIFEST_URL,
  });
  group.add(life.group);
```

3. Gabungkan `...life.systems` ke array `systems` yang dikembalikan, panggil `life.dispose()` di awal `dispose()`
   distrik (sebelum scope dilepas), dan tambahkan properti `life` pada objek hasil build (dipakai devtools/E2E sebagai
   `window.__sim.district.life`).
4. Bila Task 0 Step 4 menemukan titik ground berupa desimeter, ubah `GROUND_SCALE` di `life.js` menjadi `0.1`.

- [ ] **Step 7: Harness cek cepat `tests/e2e/harness.unri.mjs`**

```js
#!/usr/bin/env node
/**
 * Harness Playwright GPU kecil untuk kampus UNRI (dev/E2E, TIDAK ikut vitest): menyalakan Vite + Chromium headless,
 * menunggu window.__sim, menyembunyikan menu, `settleAt` (teleport + tunggu kota/distrik/region/scheduler), dan
 * skenario cek cepat per task. Dipakai juga oleh tests/e2e/shots.unri.mjs.
 *   node tests/e2e/harness.unri.mjs <skenario> [--gpu d3d11|swiftshader] [--shot berkas.jpg]
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
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

/** Vite (port) + Chromium headless; kembalikan { page, errors, close() }. */
export async function openSim({ port = 5176, gpu = 'd3d11', width = 1600, height = 900 } = {}) {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[gpu] ?? GPU_ARGS.d3d11 });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (res) => { if (res.status() >= 400) errors.push(`HTTP ${res.status()} ${res.url()}`); });
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__sim?.app && window.__sim.district, null, { timeout: 240000 });
  await page.evaluate(() => {
    document.getElementById('overlay')?.classList.add('hidden');
    const s = window.__sim;
    s.rig.exitPov();
    s.store.set('sky.advanceTime', false);
    s.store.set('weather.raining', false);
    s.store.set('camera.mode', 'third');
  });
  return {
    page,
    errors,
    async close() {
      await browser.close();
      await server.close();
    },
  };
}

/** Teleport + jam game, lalu tunggu tile kota, distrik, region hero yang menaungi titik, dan antrean scheduler. */
export async function settleAt(page, { x, z, yaw = 0, hour = 12, waitMs = 2500 }) {
  return page.evaluate(async (p) => {
    const s = window.__sim;
    s.store.set('sky.hour', p.hour);
    s.teleport(p.x, p.z, p.yaw);
    await new Promise((r) => requestAnimationFrame(r));
    if (s.city) await s.city.whenSettled(p.x, p.z, 1000, 90000);
    if (s.district?.whenSettled) await s.district.whenSettled(p.x, p.z);
    const id = s.regionIdAt?.(p.x, p.z) ?? null;
    for (let t = 0; id && t < 300 && !s.regions.active().some((a) => a.def.id === id); t += 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (s.scheduler?.whenIdle) await s.scheduler.whenIdle();
    await new Promise((r) => setTimeout(r, p.waitMs));
    return { region: id };
  }, { x, z, yaw, hour, waitMs });
}

/** Skenario cek cepat (posisi dunia; yaw konvensi maju = (sin, cos)). */
export const SCENARIOS = Object.freeze({
  mahasiswa: { x: -206, z: 1118, yaw: -2.52, hour: 10, read: () => window.__sim.district.life.students.stats },
  'mahasiswa-malam': { x: -206, z: 1118, yaw: -2.52, hour: 23, read: () => window.__sim.district.life.students.stats },
  satpam: { x: -1074.7, z: 1316, yaw: Math.PI, hour: 9, read: () => window.__sim.district.life.guards.stats },
  motor: { x: -922, z: 992, yaw: -2.06, hour: 11, read: () => window.__sim.district.life.motors.stats },
  'motor-malam': { x: -922, z: 992, yaw: -2.06, hour: 23, read: () => window.__sim.district.life.motors.stats },
  props: {
    x: -1074, z: 2088, yaw: Math.PI, hour: 9.5,
    read: () => ({
      plang: Boolean(window.__sim.app.scene.getObjectByName('plangLambangUnri')),
      halte: window.__sim.district.life.props.halteCount,
    }),
  },
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values, positionals } = parseArgs({
    allowPositionals: true, options: { gpu: { type: 'string', default: 'd3d11' }, shot: { type: 'string' } },
  });
  const name = positionals[0];
  const sc = SCENARIOS[name];
  if (!sc) {
    console.error(`Skenario tidak dikenal. Pilih: ${Object.keys(SCENARIOS).join(', ')}`);
    process.exitCode = 2;
  } else {
    const sim = await openSim({ gpu: values.gpu });
    try {
      await settleAt(sim.page, sc);
      const data = await sim.page.evaluate(sc.read);
      if (values.shot) {
        await sim.page.evaluate(() => document.body.classList.add('is-photo'));
        await sim.page.screenshot({ path: values.shot, type: 'jpeg', quality: 85 });
      }
      console.log(JSON.stringify({ scenario: name, data, errors: sim.errors }, null, 2));
    } finally {
      await sim.close();
    }
  }
}
```

Skenario `motor`, `motor-malam`, `props` baru bermakna setelah Task 7 dan 8.

- [ ] **Step 8: Tes, lint, build**

Run: `npm test` lalu `npm run lint` lalu `npm run build`
Expected: semua hijau.

- [ ] **Step 9: Cek cepat visual & angka**

Run: `node tests/e2e/harness.unri.mjs mahasiswa --shot %TEMP%\m7-mahasiswa.jpg`
Expected: JSON `data.pool` = 40, `data.active` ≥ 8, `data.sitting` ≥ 1, `errors: []`. Buka gambar (Read):
mahasiswa berjalan di trotoar/selasar dekat sekre, sebagian berjas biru langit beransel, sebagian duduk di bangku.

Run: `node tests/e2e/harness.unri.mjs mahasiswa-malam`
Expected: `data.active` ≤ 6 (malam sepi), `errors: []`.

Run: `node tests/e2e/harness.unri.mjs satpam --shot %TEMP%\m7-satpam.jpg`
Expected: `data.count` = 2; gambar: dua satpam berseragam krem-coklat di Pos Keamanan.

Bila `active` = 0: cek `window.__sim.district.life.feed.keys` (chunk ground termuat?) dan `GROUND_SCALE`; bila
mahasiswa melayang/tenggelam: cek `terrain.heightAt` di titik tersebut.

- [ ] **Step 10: Commit**

```bash
git add src/districts/unri/groundFeed.js src/districts/unri/students.js src/districts/unri/guards.js src/districts/unri/life.js src/districts/unri/index.js tests/groundFeed.test.js tests/e2e/harness.unri.mjs
```
```bash
git commit -m "feat(unri): mahasiswa NPC berjadwal di trotoar/selasar dan bangku diskusi, satpam di Pos Keamanan Binakrida"
```

---

## Task 6: Motor A01–A04 di Blender (MCP) + `motorVariants.js`

**Files:**
- Create: `assets-src/blender/unri/m7_common.py`, `assets-src/blender/unri/m7_motor.py`,
  `assets-src/blender/unri/a01-motor-bebek.blend`, `a02-motor-matic.blend`, `a03-motor-sport.blend`,
  `a04-motor-tua.blend`, `public/models/unri/a01-motor-bebek.glb`, `a02-motor-matic.glb`, `a03-motor-sport.glb`,
  `a04-motor-tua.glb`, `src/world/props/unri/motorVariants.js`

Catatan: M7 selalu membuat keempat GLB dengan skrip yang sama agar nama material seragam (syarat `BatchedMesh` per
material). GLB motor M4 untuk teras sekre (bila ada, nama lain) tidak disentuh.

- [ ] **Step 1: `assets-src/blender/unri/m7_common.py`**

```python
"""Utilitas bersama skrip aset M7 untuk Blender (dimuat oleh m7_motor.py, m7_halte.py, m7_lambang.py lewat runpy).

Pemakaian lewat MCP execute_blender_code:
    import runpy
    motor = runpy.run_path(r"C:\\Users\\mocha\\Documents\\stadion-utama-riau-3d\\assets-src\\blender\\unri\\m7_motor.py")
    print(motor["build_all_motors"]())

Setiap aset dibangun di SCENE SEMENTARA (scene user tidak disentuh), diekspor dengan export_glb.export_collection
(gabung per material, Y-up), disimpan ke .blend sendiri lewat bpy.data.libraries.write (berkas yang sedang dibuka
user tidak berubah), lalu scene sementara dihapus.
"""
import os
import runpy

import bmesh
import bpy
from mathutils import Matrix

ROOT = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
BLEND_DIR = os.path.join(ROOT, "assets-src", "blender", "unri")
GLB_DIR = os.path.join(ROOT, "public", "models", "unri")
export_collection = runpy.run_path(os.path.join(ROOT, "assets-src", "blender", "export_glb.py"))["export_collection"]


def begin(name):
    """Scene sementara aktif; kembalikan (scene, scene_sebelumnya)."""
    prev = bpy.context.window.scene
    scene = bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    return scene, prev


def new_collection(scene, name):
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    return col


def _input(node, name):
    return next(i for i in node.inputs if i.identifier == name or i.name == name)


def material(name, rgba, rough=0.6, metal=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    _input(bsdf, "Base Color").default_value = rgba
    _input(bsdf, "Roughness").default_value = rough
    _input(bsdf, "Metallic").default_value = metal
    mat.diffuse_color = rgba
    return mat


def _adopt(obj, col, mat):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def box(col, name, size, loc, mat, rot=(0.0, 0.0, 0.0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 1
    return _adopt(obj, col, mat)


def cylinder(col, name, radius, depth, loc, mat, rot=(0.0, 0.0, 0.0), verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    return _adopt(obj, col, mat)


def ellipsoid(col, name, radii, loc, mat, rot=(0.0, 0.0, 0.0), segments=6, rings=4):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _adopt(obj, col, mat)


def prism(col, name, pts_xz, y0, y1, mat):
    """Prisma dari poligon di bidang XZ Blender, tebal sepanjang Y dari y0 ke y1 (muka depan = +Y)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    back = [bm.verts.new((x, y0, z)) for x, z in pts_xz]
    front = [bm.verts.new((x, y1, z)) for x, z in pts_xz]
    bm.faces.new(back[::-1])
    bm.faces.new(front)
    n = len(pts_xz)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((back[i], back[j], front[j], front[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    col.objects.link(obj)
    me.materials.append(mat)
    return obj


def tilt_collection(col, angle, axis="Y"):
    rot = Matrix.Rotation(angle, 4, axis)
    for obj in col.objects:
        obj.matrix_world = rot @ obj.matrix_world


def discard(scene, prev):
    """Kembali ke scene user lalu hapus scene sementara beserta datanya."""
    bpy.context.window.scene = prev
    for obj in list(scene.objects):
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data is not None and data.users == 0:
            (bpy.data.meshes if isinstance(data, bpy.types.Mesh) else bpy.data.curves).remove(data)
    for col in list(scene.collection.children_recursive):
        bpy.data.collections.remove(col)
    bpy.data.scenes.remove(scene)
    for mat in list(bpy.data.materials):
        if mat.name.startswith("unri:") and mat.users == 0:
            bpy.data.materials.remove(mat)


def discard_named(name):
    """Hapus scene sementara bernama `name` (untuk panggilan MCP terpisah sesudah `look`)."""
    prev = next(s for s in bpy.data.scenes if not s.name.startswith("M7_"))
    discard(bpy.data.scenes[name], prev)


def finish(scene, prev, col_name, blend_name, glb_name, ratios=None):
    """Ekspor GLB + simpan .blend aset (tanpa mengubah berkas user); kembalikan ringkasan."""
    os.makedirs(BLEND_DIR, exist_ok=True)
    meshes, tris, kb = export_collection(col_name, os.path.join(GLB_DIR, glb_name), ratios or {})
    blocks = {scene, *scene.collection.children_recursive, *scene.objects}
    blocks |= {o.data for o in scene.objects if o.data is not None}
    blocks |= {s.material for o in scene.objects for s in o.material_slots if s.material}
    bpy.data.libraries.write(os.path.join(BLEND_DIR, blend_name), blocks, fake_user=True)
    discard(scene, prev)
    return {"glb": glb_name, "meshes": meshes, "tris": tris, "kb": kb}
```

- [ ] **Step 2: `assets-src/blender/unri/m7_motor.py`**

```python
"""Motor parkir kampus A01–A04 (katalog aset §4).

Skala meter, Z ke atas; moncong motor ke +Y Blender (= −Z three.js setelah ekspor Y-up), origin di tengah alas.
Material `unri:cat-bodi` PUTIH: warna per instans diberikan runtime (BatchedMesh.setColorAt). Motor dimiringkan
5° ke kiri (bertumpu standar samping). Bentuk gaya bebek/matic/sport/tua = [INFERENSI] (bukan merek tertentu).
"""
import math
import os
import runpy

globals().update({k: v for k, v in runpy.run_path(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "m7_common.py")).items() if not k.startswith("__")})

MOTOR_SPECS = {
    "A01": dict(slug="a01-motor-bebek", style="bebek", length=1.90, width=0.70, height=1.05, wheel_r=0.29, tyre_w=0.08),
    "A02": dict(slug="a02-motor-matic", style="matic", length=1.85, width=0.70, height=1.10, wheel_r=0.25, tyre_w=0.10),
    "A03": dict(slug="a03-motor-sport", style="sport", length=2.00, width=0.75, height=1.10, wheel_r=0.30, tyre_w=0.12),
    "A04": dict(slug="a04-motor-tua", style="tua", length=1.90, width=0.70, height=1.00, wheel_r=0.29, tyre_w=0.08),
}
RAKE = math.radians(24)
LEAN = math.radians(-5)


def motor_materials():
    return {
        "bodi": material("unri:cat-bodi", (1.0, 1.0, 1.0, 1.0), rough=0.4),
        "hitam": material("unri:plastik-hitam", (0.03, 0.03, 0.035, 1.0), rough=0.7),
        "logam": material("unri:logam", (0.62, 0.63, 0.66, 1.0), rough=0.35, metal=0.8),
        "ban": material("unri:ban", (0.02, 0.02, 0.02, 1.0), rough=0.9),
        "jok": material("unri:jok", (0.05, 0.05, 0.06, 1.0), rough=0.8),
        "lampu": material("unri:kaca-lampu", (0.95, 0.95, 0.85, 1.0), rough=0.1),
        "merah": material("unri:kaca-merah", (0.7, 0.05, 0.05, 1.0), rough=0.2),
    }


def _chassis(col, s, m):
    """Roda, garpu, setang, spion, lampu, mesin, knalpot, standar, spakbor depan (semua gaya)."""
    r, length, width, height = s["wheel_r"], s["length"], s["width"], s["height"]
    yf, yr = length / 2 - r - 0.02, -(length / 2 - r - 0.02)
    for tag, y in (("depan", yf), ("belakang", yr)):
        cylinder(col, f"ban-{tag}", r, s["tyre_w"], (0, y, r), m["ban"], rot=(0, math.pi / 2, 0), verts=20)
        cylinder(col, f"velg-{tag}", r * 0.62, s["tyre_w"] + 0.012, (0, y, r), m["logam"], rot=(0, math.pi / 2, 0), verts=12)
    fork_len = (height - 0.12 - r) / math.cos(RAKE)
    top_y = yf - math.sin(RAKE) * fork_len
    for side in (-1, 1):
        box(col, f"garpu-{side}", (0.04, 0.05, fork_len),
            (side * 0.07, yf - math.sin(RAKE) * fork_len / 2, r + math.cos(RAKE) * fork_len / 2), m["logam"], rot=(RAKE, 0, 0))
    cylinder(col, "setang", 0.016, width * 0.95, (0, top_y, height - 0.08), m["logam"], rot=(0, math.pi / 2, 0), verts=8)
    for side in (-1, 1):
        cylinder(col, f"grip-{side}", 0.02, 0.12, (side * (width * 0.475 - 0.06), top_y, height - 0.08), m["hitam"],
                 rot=(0, math.pi / 2, 0), verts=8)
        cylinder(col, f"tangkai-spion-{side}", 0.008, 0.2, (side * 0.22, top_y - 0.02, height + 0.02), m["logam"], verts=6)
        box(col, f"spion-{side}", (0.09, 0.02, 0.06), (side * 0.25, top_y - 0.02, height + 0.13), m["hitam"])
    box(col, "lampu-depan", (0.16, 0.06, 0.11), (0, top_y + 0.1, height - 0.2), m["lampu"], bevel=0.02)
    box(col, "mesin", (0.24, 0.32, 0.24), (0, 0.0, 0.33), m["logam"], bevel=0.03)
    cylinder(col, "knalpot", 0.04, 0.5, (0.17, yr + 0.12, 0.3), m["logam"], rot=(math.pi / 2, 0, 0), verts=10)
    cylinder(col, "standar", 0.012, 0.32, (-0.14, -0.05, 0.13), m["hitam"], rot=(0, -0.5, 0), verts=6)
    box(col, "spakbor-depan", (0.12, 0.42, 0.04), (0, yf, r + 0.07), m["logam"] if s["style"] == "tua" else m["hitam"])
    return yf, yr


def _body(col, s, m, yf, yr):
    style, length = s["style"], s["length"]
    if style == "bebek":
        box(col, "tameng", (0.34, 0.12, 0.55), (0, yf - 0.3, 0.62), m["bodi"], rot=(0.35, 0, 0), bevel=0.04)
        box(col, "rangka-tengah", (0.12, 0.6, 0.12), (0, 0.05, 0.48), m["bodi"], rot=(-0.35, 0, 0), bevel=0.03)
        box(col, "bodi-belakang", (0.28, 0.72, 0.28), (0, -0.42, 0.66), m["bodi"], bevel=0.06)
        seat = (0.26, 0.62, 0.09, -0.3, 0.84)
    elif style == "matic":
        box(col, "apron", (0.38, 0.16, 0.70), (0, yf - 0.32, 0.6), m["bodi"], rot=(0.25, 0, 0), bevel=0.05)
        box(col, "dek", (0.30, 0.48, 0.06), (0, 0.02, 0.33), m["hitam"])
        box(col, "bodi-belakang", (0.32, 0.86, 0.36), (0, -0.38, 0.6), m["bodi"], bevel=0.08)
        seat = (0.28, 0.66, 0.09, -0.34, 0.83)
    elif style == "sport":
        box(col, "tangki", (0.36, 0.48, 0.24), (0, 0.12, 0.9), m["bodi"], bevel=0.07)
        box(col, "fairing", (0.44, 0.34, 0.42), (0, yf - 0.2, 0.86), m["bodi"], rot=(0.5, 0, 0), bevel=0.05)
        box(col, "buntut", (0.24, 0.52, 0.14), (0, -0.6, 0.88), m["bodi"], rot=(-0.15, 0, 0), bevel=0.03)
        box(col, "perut", (0.30, 0.60, 0.18), (0, 0.05, 0.38), m["hitam"])
        seat = (0.26, 0.5, 0.08, -0.25, 0.9)
    else:  # tua: tangki kecil, tutup samping, spakbor belakang krom, jok panjang datar
        box(col, "tangki", (0.30, 0.42, 0.20), (0, 0.12, 0.84), m["bodi"], bevel=0.06)
        box(col, "tutup-samping", (0.26, 0.30, 0.20), (0, -0.12, 0.62), m["bodi"], bevel=0.03)
        box(col, "spakbor-belakang", (0.14, 0.5, 0.04), (0, yr + 0.05, s["wheel_r"] + 0.08), m["logam"])
        seat = (0.24, 0.72, 0.08, -0.32, 0.86)
    w, ln, h, y, z = seat
    box(col, "jok", (w, ln, h), (0, y, z), m["jok"], bevel=0.03)
    box(col, "lampu-belakang", (0.12, 0.04, 0.05), (0, -length / 2 + 0.12, z - 0.03), m["merah"])


def preview_motor(vid):
    """Bangun motor di scene sementara `M7_<vid>` (tanpa ekspor) untuk `look`; hapus dengan discard_named."""
    s = MOTOR_SPECS[vid]
    scene, prev = begin(f"M7_{vid}")
    col = new_collection(scene, f"UNRI_{vid}")
    m = motor_materials()
    yf, yr = _chassis(col, s, m)
    _body(col, s, m, yf, yr)
    tilt_collection(col, LEAN, "Y")
    return scene, prev, col


def build_motor(vid):
    scene, prev, col = preview_motor(vid)
    slug = MOTOR_SPECS[vid]["slug"]
    return dict(id=vid, **finish(scene, prev, col.name, f"{slug}.blend", f"{slug}.glb"))


def build_all_motors(ids=("A01", "A02", "A03", "A04")):
    return [build_motor(v) for v in ids]
```

- [ ] **Step 3: Jalankan di Blender (MCP `execute_blender_code`)**

```python
import runpy
motor = runpy.run_path(r"C:\Users\mocha\Documents\stadion-utama-riau-3d\assets-src\blender\unri\m7_motor.py")
print(motor["build_all_motors"]())
```
Expected: daftar 4 entri `{'id': 'A0x', 'glb': 'a0x-….glb', 'meshes': 7, 'tris': ≤ 3500, 'kb': ≤ 150}`, tanpa galat
Python. Bila `tris` > 3500 untuk satu varian, ubah `verts=20` ban menjadi `16` lalu ulangi.

- [ ] **Step 4: Tinjau visual (MCP)**

```python
import runpy
motor = runpy.run_path(r"C:\Users\mocha\Documents\stadion-utama-riau-3d\assets-src\blender\unri\m7_motor.py")
motor["preview_motor"]("A02")
```
Panggil MCP `look` (max_size kecil). Expected: skuter matic berdiri di dua roda, moncong ke +Y, miring ±5°. Lalu:

```python
import runpy
runpy.run_path(r"C:\Users\mocha\Documents\stadion-utama-riau-3d\assets-src\blender\unri\m7_common.py")["discard_named"]("M7_A02")
```
Ulangi untuk `"A03"` bila perlu.

- [ ] **Step 5: Verifikasi GLB**

Run:
```bash
node --input-type=module -e "import { NodeIO } from '@gltf-transform/core'; const io = new NodeIO(); for (const f of ['a01-motor-bebek','a02-motor-matic','a03-motor-sport','a04-motor-tua']) { const doc = await io.read('public/models/unri/' + f + '.glb'); let tris = 0; for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3; console.log(f, Math.round(tris), doc.getRoot().listMaterials().map((m) => m.getName()).sort().join(',')); }"
```
Expected: 4 baris, segitiga ≤ 3500, material
`unri:ban,unri:cat-bodi,unri:jok,unri:kaca-lampu,unri:kaca-merah,unri:logam,unri:plastik-hitam`.

- [ ] **Step 6: `src/world/props/unri/motorVariants.js`**

```js
/**
 * Varian motor parkir kampus (katalog A01–A04): dimensi (L × P × T, m), path GLB final (Blender, Task 6 M7) dan
 * placeholder prosedural berukuran sama. Model menghadap −Z lokal, origin di tengah alas (aturan katalog).
 * Material bodi bernama `unri:cat-bodi` berwarna putih: warna per instans dari MOTOR_BODY_COLORS.
 * `path: null` = belum ada GLB (placeholder langsung, tanpa permintaan HTTP yang gagal).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { currentScope } from '../../../engine/ResourceScope.js';

export const MOTOR_VARIANTS = Object.freeze({
  A01: Object.freeze({ id: 'A01', name: 'motor-bebek', path: 'models/unri/a01-motor-bebek.glb', width: 0.7, length: 1.9, height: 1.05, wheelR: 0.29 }),
  A02: Object.freeze({ id: 'A02', name: 'motor-matic', path: 'models/unri/a02-motor-matic.glb', width: 0.7, length: 1.85, height: 1.1, wheelR: 0.25 }),
  A03: Object.freeze({ id: 'A03', name: 'motor-sport', path: 'models/unri/a03-motor-sport.glb', width: 0.75, length: 2.0, height: 1.1, wheelR: 0.3 }),
  A04: Object.freeze({ id: 'A04', name: 'motor-tua', path: 'models/unri/a04-motor-tua.glb', width: 0.7, length: 1.9, height: 1.0, wheelR: 0.29 }),
});

export const MOTOR_BODY_MATERIAL = 'unri:cat-bodi';
/** Warna cat motor umum [INFERENSI]: merah, biru, hitam, putih, abu, oranye, ungu, hijau. */
export const MOTOR_BODY_COLORS = Object.freeze([0xc62828, 0x1565c0, 0x212121, 0xeeeeee, 0x9e9e9e, 0xef6c00, 0x6a1b9a, 0x2e7d32]);

const placeholderMaterials = () => currentScope().get('unri:motor:placeholderMats', () => ({
  [MOTOR_BODY_MATERIAL]: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  'unri:ban': new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
}));

/**
 * Placeholder (katalog: "kotak bodi + 2 silinder roda") sebagai sumber per material.
 * @returns {Array<{name:string, geometry:THREE.BufferGeometry, material:THREE.Material}>}
 */
export function motorPlaceholderSources(variant) {
  const mats = placeholderMaterials();
  const body = new THREE.BoxGeometry(variant.width * 0.5, variant.height * 0.45, variant.length * 0.72);
  body.translate(0, variant.height * 0.55, 0);
  const wheels = [-1, 1].map((s) => {
    const g = new THREE.CylinderGeometry(variant.wheelR, variant.wheelR, 0.09, 12);
    g.rotateZ(Math.PI / 2);
    g.translate(0, variant.wheelR, s * (variant.length / 2 - variant.wheelR));
    return g;
  });
  const tyres = mergeGeometries(wheels, false);
  wheels.forEach((g) => g.dispose());
  return [
    { name: MOTOR_BODY_MATERIAL, geometry: body, material: mats[MOTOR_BODY_MATERIAL] },
    { name: 'unri:ban', geometry: tyres, material: mats['unri:ban'] },
  ];
}
```

**Jalur cadangan (Blender tidak tersedia, Task 0 Step 7):** lewati Step 1–5, buat `motorVariants.js` dengan
`path: null` untuk keempat varian, catat di laporan; status katalog A01–A04 tetap `placeholder`.

- [ ] **Step 7: Lint & commit**

Run: `npm run lint` → 0 galat.
```bash
git add assets-src/blender/unri/m7_common.py assets-src/blender/unri/m7_motor.py assets-src/blender/unri/a01-motor-bebek.blend assets-src/blender/unri/a02-motor-matic.blend assets-src/blender/unri/a03-motor-sport.blend assets-src/blender/unri/a04-motor-tua.blend public/models/unri/a01-motor-bebek.glb public/models/unri/a02-motor-matic.glb public/models/unri/a03-motor-sport.glb public/models/unri/a04-motor-tua.glb src/world/props/unri/motorVariants.js
```
```bash
git commit -m "feat(aset): motor parkir kampus A01–A04 dari Blender (bebek, matic, sport, tua) + varian & placeholder"
```

---

## Task 7: Parkir motor kampus (`motorParking.js`)

**Files:**
- Create: `src/districts/unri/motorParking.js`, `tests/motorParking.test.js`
- Modify: `src/districts/unri/life.js`

- [ ] **Step 1: Tes klasifikasi area & geometri (gagal dulu)**

Buat `tests/motorParking.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parkingAreas, IC_CENTER, normalizeGeometry } from '../src/districts/unri/motorParking.js';

/** Parkir OSM way/938379748 (±138 m dari Integrated Classroom) dan persegi di area FISIP (way/938379744). */
const IC_PARK = [[-1006.7, 984.2], [-931.6, 984.4], [-931.5, 950.0], [-1006.6, 949.8]];
const FISIP_PARK = [[-1230, 1100], [-1195, 1100], [-1195, 1126], [-1230, 1126]];

describe('parkingAreas', () => {
  const ground = {
    areas: [
      { kind: 'parking', rings: [IC_PARK] },
      { kind: 'parking', rings: [FISIP_PARK] },
      { kind: 'plaza', rings: [IC_PARK] },
      { kind: 'parking', rings: [[[0, 0], [1, 0]]] },
    ],
  };
  it('hanya parking dengan ring valid; IC bila centroid ≤ 160 m dari Integrated Classroom', () => {
    const areas = parkingAreas(ground);
    expect(areas.map((a) => a.kind)).toEqual(['ic', 'kampus']);
    expect(Math.hypot(areas[0].center.x - IC_CENTER.x, areas[0].center.z - IC_CENTER.z)).toBeLessThan(160);
  });
  it('kunci dedupe sama untuk ring yang sama dari chunk berbeda', () => {
    expect(parkingAreas(ground)[0].key).toBe(parkingAreas({ areas: [{ kind: 'parking', rings: [IC_PARK] }] })[0].key);
    expect(parkingAreas(null)).toEqual([]);
  });
});

describe('normalizeGeometry', () => {
  it('position + normal berindeks, transform dibakar, atribut lain dibuang', () => {
    const src = new THREE.BoxGeometry(1, 1, 1);
    const g = normalizeGeometry(src, new THREE.Matrix4().makeTranslation(0, 2, 0));
    expect(Object.keys(g.attributes).sort()).toEqual(['normal', 'position']);
    expect(g.index.count).toBe(src.index.count);
    g.computeBoundingBox();
    expect(g.boundingBox.min.y).toBeCloseTo(1.5, 6);
    const flat = normalizeGeometry(src.toNonIndexed());
    expect(flat.index.count).toBe(flat.getAttribute('position').count);
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/motorParking.test.js`
Expected: FAIL (modul tidak ditemukan).

- [ ] **Step 2: `src/districts/unri/motorParking.js`**

```js
/**
 * Motor parkir kampus (spec §8.4, katalog A01–A04): slot rapat di setiap area `amenity=parking` dari data ground M2
 * (kecuali area di dalam mask region hero — region punya isinya sendiri), dirender `BatchedMesh` per material per
 * area (1 draw call/material/area), warna bodi per instans. Isi mengikuti jam game (`motorFill`): parkir IC
 * (centroid ≤ IC_RADIUS dari Integrated Classroom) penuh siang hari. Area yang muncul di beberapa chunk ground
 * dihitung referensinya per kunci area. Tanpa collider (D8). GLB gagal → placeholder (spec §10).
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { loadModel } from '../../world/assets/models.js';
import {
  MOTOR_VARIANTS, MOTOR_BODY_MATERIAL, MOTOR_BODY_COLORS, motorPlaceholderSources,
} from '../../world/props/unri/motorVariants.js';
import { parkingSlots, visibleOrder, assignVariants, seedOf } from '../../sim/parkingSlots.js';
import { motorFill, toPoints } from '../../sim/campusLife.js';
import { polygonCentroid } from '../../geo/polygon.js';

/** Centroid Integrated Classroom way/1313268659 (OSM, dunia) dan radius parkir yang dianggap parkir IC [INFERENSI]. */
export const IC_CENTER = Object.freeze({ x: -1091.0, z: 906.0 });
export const IC_RADIUS = 160;
/** Mitigasi spec §9.3 langkah 2: turunkan (mis. 0.6) bila budget draw call/segitiga terlampaui. */
export const MOTOR_DENSITY_SCALE = 1;
const REFILL_SEC = 2;

/** Salinan geometri untuk BatchedMesh: hanya position + normal, berindeks, transform (opsional) dibakar. */
export function normalizeGeometry(src, matrix = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', src.getAttribute('position').clone());
  const count = g.getAttribute('position').count;
  g.setIndex(src.index ? src.index.clone() : Array.from({ length: count }, (_, i) => i));
  if (src.getAttribute('normal')) g.setAttribute('normal', src.getAttribute('normal').clone());
  else g.computeVertexNormals();
  if (matrix) g.applyMatrix4(matrix);
  return g;
}

/** Area parkir (ring luar) dari satu chunk ground M2, dengan kunci dedupe dan jenis 'ic' | 'kampus'. */
export function parkingAreas(ground, scale = 1) {
  return (ground?.areas ?? [])
    .filter((a) => a.kind === 'parking' && Array.isArray(a.rings) && a.rings.length)
    .map((a) => toPoints(a.rings[0], scale))
    .filter((ring) => ring.length >= 3)
    .map((ring) => {
      const center = polygonCentroid(ring);
      const kind = Math.hypot(center.x - IC_CENTER.x, center.z - IC_CENTER.z) <= IC_RADIUS ? 'ic' : 'kampus';
      return Object.freeze({ key: `${Math.round(center.x)}_${Math.round(center.z)}_${ring.length}`, ring, center, kind });
    });
}

/** Sumber per varian: [{name, geometry (ternormalisasi), material}] dari GLB, atau placeholder bila tidak ada/gagal. */
async function loadVariantSources(scope, logger) {
  const entries = await Promise.all(Object.values(MOTOR_VARIANTS).map(async (v) => {
    if (v.path) {
      try {
        const root = await withScope(scope, () => loadModel(v.path));
        root.updateMatrixWorld(true);
        const parts = [];
        root.traverse((o) => {
          if (o.isMesh && o.material?.name) parts.push({ name: o.material.name, geometry: normalizeGeometry(o.geometry, o.matrixWorld), material: o.material });
        });
        if (parts.length) return [v.id, parts];
        logger.warn(`Motor ${v.id}: GLB tanpa mesh bermaterial, memakai placeholder`);
      } catch (err) {
        logger.warn(`Motor ${v.id}: GLB gagal dimuat, memakai placeholder:`, err);
      }
    }
    const parts = withScope(scope, () => motorPlaceholderSources(v));
    return [v.id, parts.map((p) => ({ ...p, geometry: normalizeGeometry(p.geometry) }))];
  }));
  return new Map(entries);
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

function buildArea(area, sources, terrain) {
  const slots = parkingSlots(area.ring);
  if (!slots.length) return null;
  const seed = seedOf(area.center.x, area.center.z);
  const variants = assignVariants(slots.length, seed);
  const used = new Set(variants);
  const byMaterial = new Map();
  for (const [vid, parts] of sources) {
    for (const part of parts) {
      const entry = byMaterial.get(part.name) ?? { material: part.material, geoms: new Map() };
      entry.geoms.set(vid, part.geometry);
      byMaterial.set(part.name, entry);
    }
  }
  const group = new THREE.Group();
  group.name = `parkirMotor:${area.key}`;
  const meshes = [];
  for (const [name, entry] of byMaterial) {
    const geoms = [...entry.geoms].filter(([vid]) => used.has(vid));
    if (!geoms.length) continue;
    const vertexCount = geoms.reduce((s, [, g]) => s + g.getAttribute('position').count, 0);
    const indexCount = geoms.reduce((s, [, g]) => s + g.index.count, 0);
    const batch = new THREE.BatchedMesh(slots.length, vertexCount, indexCount, entry.material);
    batch.name = `motor:${name}`;
    batch.castShadow = false;
    batch.receiveShadow = true;
    const geomIds = new Map(geoms.map(([vid, g]) => [vid, batch.addGeometry(g)]));
    const ids = slots.map((slot, i) => {
      const gid = geomIds.get(variants[i]);
      if (gid === undefined) return -1;
      const id = batch.addInstance(gid);
      _p.set(slot.x, terrain.heightAt(slot.x, slot.z), slot.z);
      _q.setFromAxisAngle(_up, slot.rotY);
      batch.setMatrixAt(id, _m.compose(_p, _q, _one));
      if (name === MOTOR_BODY_MATERIAL) batch.setColorAt(id, _c.setHex(MOTOR_BODY_COLORS[(seed + i * 7) % MOTOR_BODY_COLORS.length]));
      return id;
    });
    group.add(batch);
    meshes.push({ batch, ids });
  }
  return { group, meshes, order: visibleOrder(slots.length, seed ^ 0x9e3779b9), count: slots.length, shown: -1 };
}

/** Tampilkan k = round(isi × n) slot pertama menurut urutan acak area (isi naik = superset). */
function applyFill(built, fill) {
  const n = Math.round(built.count * Math.min(1, Math.max(0, fill)));
  if (n === built.shown) return;
  built.shown = n;
  const visible = new Uint8Array(built.count);
  for (let k = 0; k < n; k += 1) visible[built.order[k]] = 1;
  for (const { batch, ids } of built.meshes) {
    ids.forEach((id, i) => { if (id >= 0) batch.setVisibleAt(id, visible[i] === 1); });
  }
}

/**
 * @param {{scope:object, terrain:{heightAt(x:number,z:number):number}, scheduler:{schedule:Function},
 *   hour:() => number, excludeAt?:(x:number, z:number) => boolean, groundScale?:number, logger?:object}} opts
 */
export function createMotorParking({ scope, terrain, scheduler, hour, excludeAt = () => false, groundScale = 1, logger = console }) {
  const group = new THREE.Group();
  group.name = 'parkirMotor';
  const areas = new Map(); // areaKey -> { area, chunks:Set, built, task }
  let sources = null;
  let disposed = false;
  let refill = 0;
  const fillFor = (kind) => motorFill(hour(), kind) * MOTOR_DENSITY_SCALE;

  function scheduleBuild(entry) {
    if (!sources || entry.built || entry.task || disposed) return;
    entry.task = scheduler.schedule(() => {
      entry.task = null;
      if (disposed || areas.get(entry.area.key) !== entry) return;
      entry.built = withScope(scope, () => buildArea(entry.area, sources, terrain));
      if (!entry.built) return;
      group.add(entry.built.group);
      applyFill(entry.built, fillFor(entry.area.kind));
    }, { owner: 'unri:motor' });
  }

  function drop(entry) {
    entry.task?.cancel();
    entry.task = null;
    if (!entry.built) return;
    entry.built.group.removeFromParent();
    entry.built.meshes.forEach(({ batch }) => batch.dispose());
    entry.built = null;
  }

  const sourcesReady = loadVariantSources(scope, logger)
    .then((s) => {
      if (disposed) return;
      sources = s;
      for (const entry of areas.values()) scheduleBuild(entry);
    })
    .catch((err) => logger.error('Motor parkir: sumber model gagal disiapkan:', err));

  return {
    group,
    sourcesReady,
    get stats() {
      let built = 0;
      let instances = 0;
      let shown = 0;
      for (const e of areas.values()) {
        if (!e.built) continue;
        built += 1;
        instances += e.built.count;
        shown += Math.max(0, e.built.shown);
      }
      return { areas: areas.size, built, instances, shown, sources: sources ? [...sources.keys()] : [] };
    },
    addGroundChunk(chunkKey, data) {
      for (const area of parkingAreas(data, groundScale)) {
        if (excludeAt(area.center.x, area.center.z)) continue;
        const entry = areas.get(area.key) ?? { area, chunks: new Set(), built: null, task: null };
        entry.chunks.add(chunkKey);
        areas.set(area.key, entry);
        scheduleBuild(entry);
      }
    },
    removeGroundChunk(chunkKey) {
      for (const [key, entry] of [...areas]) {
        if (!entry.chunks.delete(chunkKey) || entry.chunks.size) continue;
        drop(entry);
        areas.delete(key);
      }
    },
    update(dt) {
      refill -= dt;
      if (refill > 0) return;
      refill = REFILL_SEC;
      for (const entry of areas.values()) if (entry.built) applyFill(entry.built, fillFor(entry.area.kind));
    },
    dispose() {
      disposed = true;
      for (const entry of areas.values()) drop(entry);
      areas.clear();
      group.removeFromParent();
    },
  };
}
```

Run: `node node_modules/vitest/vitest.mjs run tests/motorParking.test.js`
Expected: PASS.

- [ ] **Step 3: `life.js` memasang parkir motor**

Di `src/districts/unri/life.js`:
1. Impor: `import { createMotorParking } from './motorParking.js';`
2. Sesudah baris `const guards = …`, tambahkan:

```js
  const excludeAt = typeof services.excludeAt === 'function' ? services.excludeAt : () => false;
  const motors = createMotorParking({ scope, terrain, scheduler, hour, excludeAt, groundScale: GROUND_SCALE, logger });
```

3. Ganti `const parts = [students, guards].filter(Boolean);` dengan `const parts = [students, guards, motors].filter(Boolean);`
   dan `const consumers = [students].filter(Boolean);` dengan `const consumers = [students, motors].filter(Boolean);`.
4. Di `update(dt, frame)` sistem, sesudah `guards?.update(dt);` tambahkan `motors.update(dt);`.
5. Di objek kembalian, tambahkan `motors,` sesudah `guards,`.
6. Perbarui komentar berkas: "komposisi mahasiswa, satpam, dan parkir motor".

- [ ] **Step 4: Tes, lint, build, cek cepat**

Run: `npm test` lalu `npm run lint` lalu `npm run build` → hijau.

Run: `node tests/e2e/harness.unri.mjs motor --shot %TEMP%\m7-motor-siang.jpg`
Expected: `data.sources` = `["A01","A02","A03","A04"]`, `data.built` ≥ 1, `data.shown / data.instances` ≥ 0,6 (area
IC ±0,97), `errors: []`. Gambar: deret motor rapat berwarna-warni di parkir, saling membelakangi, moncong ke lorong.

Run: `node tests/e2e/harness.unri.mjs motor-malam`
Expected: `data.shown` jauh lebih kecil (±15–20% instans).

- [ ] **Step 5: Commit**

```bash
git add src/districts/unri/motorParking.js src/districts/unri/life.js tests/motorParking.test.js
```
```bash
git commit -m "feat(unri): motor parkir instanced per area parkir OSM, kepadatan per jam (parkir IC penuh siang)"
```

---

## Task 8: Halte TMP (P02), lambang UNRI (N10), dan `campusProps.js`

**Files:**
- Create: `assets-src/blender/unri/m7_halte.py`, `assets-src/blender/unri/m7_lambang.py`,
  `assets-src/blender/unri/p02-halte-tmp.blend`, `assets-src/blender/unri/n10-lambang-unri.blend`,
  `public/models/unri/p02-halte-tmp.glb`, `public/models/unri/n10-lambang-unri.glb`,
  `src/world/props/unri/lambangUnri.js`, `src/world/props/unri/halteTmp.js`, `src/districts/unri/campusProps.js`
- Modify: `src/districts/unri/life.js`

- [ ] **Step 1: Verifikasi node halte OSM (Overpass)**

Run:
```bash
curl -s "https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%3Bnode(id%3A4559431711%2C4559433677)%3Bout%3B"
```
Expected: dua node `highway=bus_stop` (nama "Halte TMP" atau serupa) dengan lat ≈ 0,4641 / 0,4644 dan lon ≈
101,3730 / 101,3742. Bila berbeda > 0,0005°, pakai nilai Overpass di `HALTE_TMP_NODES` (Step 6) dan catat. Tanpa
jaringan: pakai nilai riset (sudah tertulis di Step 6).

- [ ] **Step 2: `assets-src/blender/unri/m7_halte.py`**

```python
"""Halte Trans Metro Pekanbaru P02 (katalog §4: 6 × 2 × 3 m).

Sisi terbuka (jalan) di depan = +Y Blender (−Z three.js); bangku & panel kaca di belakang. Halte TMP beratap dan
berbangku ada di OSM [T]; warna & detail = [INFERENSI].
"""
import math
import os
import runpy

globals().update({k: v for k, v in runpy.run_path(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "m7_common.py")).items() if not k.startswith("__")})


def preview_halte():
    scene, prev = begin("M7_P02")
    col = new_collection(scene, "UNRI_P02")
    logam = material("unri:logam-halte", (0.55, 0.58, 0.6, 1.0), rough=0.4, metal=0.7)
    atap = material("unri:atap-halte", (0.18, 0.31, 0.43, 1.0), rough=0.5)
    kaca = material("unri:kaca-halte", (0.6, 0.75, 0.8, 1.0), rough=0.05)
    papan = material("unri:papan-halte", (0.95, 0.95, 0.95, 1.0), rough=0.6)
    huruf = material("unri:huruf-halte", (0.1, 0.25, 0.45, 1.0), rough=0.6)
    for i, (x, y) in enumerate(((-2.8, -0.85), (2.8, -0.85), (-2.8, 0.85), (2.8, 0.85))):
        cylinder(col, f"tiang-{i}", 0.05, 2.6, (x, y, 1.3), logam, verts=10)
    box(col, "atap", (6.4, 2.4, 0.08), (0, 0, 2.72), atap, rot=(-0.06, 0, 0), bevel=0.02)
    box(col, "panel-belakang", (5.6, 0.03, 1.4), (0, -0.88, 1.35), kaca)
    box(col, "dudukan", (4.0, 0.42, 0.06), (0, -0.6, 0.45), logam, bevel=0.01)
    for i, x in enumerate((-1.8, 0.0, 1.8)):
        box(col, f"kaki-bangku-{i}", (0.05, 0.36, 0.42), (x, -0.6, 0.21), logam)
    box(col, "papan-nama", (2.6, 0.06, 0.42), (0, 1.15, 3.0), papan, bevel=0.01)
    bpy.ops.object.text_add(location=(0, 1.19, 2.92), rotation=(math.pi / 2, 0, math.pi))
    txt = bpy.context.active_object
    txt.name = "teks-halte"
    txt.data.body = "HALTE TRANS METRO"
    txt.data.align_x = "CENTER"
    txt.data.size = 0.2
    txt.data.extrude = 0.004
    for c in list(txt.users_collection):
        c.objects.unlink(txt)
    col.objects.link(txt)
    txt.data.materials.append(huruf)
    return scene, prev, col


def build_halte():
    scene, prev, col = preview_halte()
    return finish(scene, prev, col.name, "p02-halte-tmp.blend", "p02-halte-tmp.glb")
```

- [ ] **Step 3: `assets-src/blender/unri/m7_lambang.py`**

```python
"""Lambang UNRI N10 (katalog §3: 1 × 0,05 × 1 m).

Deskripsi resmi (unri.ac.id/lambang [T]): Lancang Kuning dalam segi lima; dasar hijau lumut; kuning emas; pohon
hayat 1 daun kecil + 10 daun besar (tanggal 1, bulan 10); teratai putih 6 daun besar + 2 kecil (tahun 62); perahu &
tiang layar kuning; laut & gelombang. Tata letak gambar = [INFERENSI] (bukan salinan gambar resmi).
Bidang emblem di XZ Blender, tebal sepanjang Y, muka depan +Y (= −Z three.js), origin di tengah alas.
"""
import math
import os
import runpy

globals().update({k: v for k, v in runpy.run_path(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "m7_common.py")).items() if not k.startswith("__")})


def _pentagon(radius, cz):
    return [(radius * math.sin(2 * math.pi * k / 5), cz + radius * math.cos(2 * math.pi * k / 5)) for k in range(5)]


def preview_lambang():
    scene, prev = begin("M7_N10")
    col = new_collection(scene, "UNRI_N10")
    emas = material("unri:lambang-emas", (0.83, 0.63, 0.09, 1.0), rough=0.35, metal=0.6)
    hijau = material("unri:lambang-hijau", (0.31, 0.36, 0.18, 1.0), rough=0.7)
    kuning = material("unri:lambang-kuning", (0.95, 0.76, 0.0, 1.0), rough=0.5)
    putih = material("unri:lambang-putih", (0.96, 0.96, 0.94, 1.0), rough=0.5)
    biru = material("unri:lambang-biru", (0.24, 0.55, 1.0, 1.0), rough=0.5)
    daun = material("unri:lambang-daun", (0.55, 0.76, 0.29, 1.0), rough=0.6)
    cz = 0.5  # pusat segi lima; alas emblem di z = 0
    prism(col, "bingkai", _pentagon(0.5, cz), -0.025, 0.0, emas)
    prism(col, "dasar", _pentagon(0.455, cz), 0.0, 0.008, hijau)
    for i in range(3):
        box(col, f"gelombang-{i}", (0.5 - i * 0.06, 0.006, 0.022), (0, 0.011, cz - 0.3 + i * 0.05), biru)
    prism(col, "lambung", [(-0.24, cz - 0.1), (0.24, cz - 0.1), (0.17, cz - 0.18), (-0.17, cz - 0.18)], 0.008, 0.02, kuning)
    box(col, "tiang-layar", (0.016, 0.012, 0.3), (0, 0.014, cz + 0.05), kuning)
    prism(col, "layar", [(0.012, cz - 0.08), (0.012, cz + 0.18), (0.17, cz - 0.06)], 0.008, 0.018, kuning)
    tx, tz = -0.2, cz + 0.12
    box(col, "batang-pohon", (0.02, 0.01, 0.14), (tx, 0.013, tz - 0.07), emas)
    for i in range(10):  # 10 daun besar = bulan Oktober
        a = -math.pi * 0.9 + i / 9 * math.pi * 0.8
        ellipsoid(col, f"daun-besar-{i}", (0.03, 0.006, 0.012), (tx + math.cos(a) * 0.07, 0.014, tz - math.sin(a) * 0.07),
                  daun, rot=(0, a, 0))
    ellipsoid(col, "daun-kecil", (0.015, 0.006, 0.007), (tx, 0.014, tz + 0.1), daun, rot=(0, math.pi / 2, 0))  # tanggal 1
    lx, lz = 0.2, cz + 0.05
    for i in range(6):  # 6 kelopak besar
        a = -math.pi + i / 5 * math.pi
        ellipsoid(col, f"kelopak-besar-{i}", (0.035, 0.006, 0.014), (lx + math.cos(a) * 0.04, 0.014, lz - math.sin(a) * 0.04),
                  putih, rot=(0, a, 0))
    for s in (-1, 1):  # 2 kelopak kecil → tahun 62
        ellipsoid(col, f"kelopak-kecil-{s}", (0.018, 0.006, 0.008), (lx + s * 0.07, 0.014, lz - 0.05), putih, rot=(0, s * 0.4, 0))
    return scene, prev, col


def build_lambang():
    scene, prev, col = preview_lambang()
    return finish(scene, prev, col.name, "n10-lambang-unri.blend", "n10-lambang-unri.glb")
```

- [ ] **Step 4: Jalankan & tinjau di Blender (MCP)**

```python
import runpy
lambang = runpy.run_path(r"C:\Users\mocha\Documents\stadion-utama-riau-3d\assets-src\blender\unri\m7_lambang.py")
lambang["preview_lambang"]()
```
MCP `look` → segi lima hijau berbingkai emas, perahu kuning berlayar di atas gelombang biru, pohon 10 + 1 daun di
kiri, teratai 6 + 2 kelopak di kanan. Lalu:

```python
import runpy
base = r"C:\Users\mocha\Documents\stadion-utama-riau-3d\assets-src\blender\unri"
runpy.run_path(base + r"\m7_common.py")["discard_named"]("M7_N10")
print(runpy.run_path(base + r"\m7_halte.py")["build_halte"](), runpy.run_path(base + r"\m7_lambang.py")["build_lambang"]())
```
Expected: `{'glb': 'p02-halte-tmp.glb', 'tris': ≤ 3000, …}` dan `{'glb': 'n10-lambang-unri.glb', 'tris': ≤ 2000, …}`.

**Jalur cadangan (tanpa Blender):** lewati Step 2–4; set `HALTE_MODEL_PATH = null` dan `LAMBANG_MODEL_PATH = null`
di Step 5 (placeholder saja, tanpa permintaan HTTP gagal).

- [ ] **Step 5: Placeholder `src/world/props/unri/lambangUnri.js` dan `halteTmp.js`**

`src/world/props/unri/lambangUnri.js`:

```js
/**
 * Plang lambang UNRI (katalog N10): dua tiang + papan + emblem segi lima. Placeholder emblem = bidang 1 × 1 m
 * bertekstur canvas (segi lima hijau lumut berbingkai kuning emas, lancang kuning, pohon hayat 1 daun kecil + 10
 * daun besar, teratai 6 + 2 kelopak; deskripsi resmi unri.ac.id/lambang [T], tata letak gambar [INFERENSI]).
 * Mesh emblem bernama 'N10' agar GLB final menyembunyikannya (pola `replaces`). Muka depan = −Z lokal.
 */
import * as THREE from 'three';
import { currentScope } from '../../../engine/ResourceScope.js';
import { localMatrix } from '../../siteutil/instanceParts.js';

export const LAMBANG_MODEL_PATH = 'models/unri/n10-lambang-unri.glb';
/** Tinggi alas emblem dari tanah (m). */
export const LAMBANG_BOARD_Y = 1.5;
const POLE_H = 2.7;

function drawLambang(ctx, size) {
  const c = size / 2;
  const pent = (r) => {
    ctx.beginPath();
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2;
      const x = c + r * Math.sin(a);
      const y = c - r * Math.cos(a);
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  };
  const leaf = (x, y, rx, ry, a, color) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };
  ctx.clearRect(0, 0, size, size);
  pent(size * 0.47);
  ctx.fillStyle = '#d4a017';
  ctx.fill();
  pent(size * 0.42);
  ctx.fillStyle = '#4f5d2f';
  ctx.fill();
  ctx.strokeStyle = '#3d8bff';
  ctx.lineWidth = size * 0.018;
  for (let i = 0; i < 3; i += 1) {
    const y = c + size * (0.2 + i * 0.05);
    ctx.beginPath();
    for (let x = c - size * 0.25; x <= c + size * 0.25; x += size * 0.02) ctx.lineTo(x, y + Math.sin(x * 0.12) * size * 0.012);
    ctx.stroke();
  }
  ctx.fillStyle = '#f2c200';
  ctx.beginPath();
  ctx.moveTo(c - size * 0.24, c + size * 0.1);
  ctx.lineTo(c + size * 0.24, c + size * 0.1);
  ctx.lineTo(c + size * 0.17, c + size * 0.18);
  ctx.lineTo(c - size * 0.17, c + size * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(c - size * 0.008, c - size * 0.2, size * 0.016, size * 0.3);
  ctx.beginPath();
  ctx.moveTo(c + size * 0.012, c - size * 0.18);
  ctx.lineTo(c + size * 0.17, c + size * 0.06);
  ctx.lineTo(c + size * 0.012, c + size * 0.06);
  ctx.closePath();
  ctx.fill();
  const tx = c - size * 0.2;
  const ty = c - size * 0.08;
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(tx - size * 0.01, ty, size * 0.02, size * 0.14);
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI * 0.9 + (i / 9) * Math.PI * 0.8;
    leaf(tx + Math.cos(a) * size * 0.07, ty + Math.sin(a) * size * 0.07, size * 0.03, size * 0.012, a, '#8bc34a');
  }
  leaf(tx, ty - size * 0.1, size * 0.015, size * 0.007, -Math.PI / 2, '#8bc34a');
  const lx = c + size * 0.2;
  const ly = c - size * 0.05;
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI + (i / 5) * Math.PI;
    leaf(lx + Math.cos(a) * size * 0.04, ly + Math.sin(a) * size * 0.04, size * 0.035, size * 0.014, a, '#ffffff');
  }
  for (const s of [-1, 1]) leaf(lx + s * size * 0.07, ly + size * 0.05, size * 0.018, size * 0.008, s * 0.4, '#ffffff');
}

/** Material emblem: tekstur canvas (browser) atau warna polos (lingkungan tanpa DOM, mis. tes Node). */
function emblemMaterial() {
  return currentScope().get('unri:lambang:emblem', () => {
    if (typeof document === 'undefined') return new THREE.MeshLambertMaterial({ color: 0x4f5d2f });
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    drawLambang(canvas.getContext('2d'), size);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshLambertMaterial({ map, transparent: true, alphaTest: 0.5 });
  });
}

/** Part plang (pola instanceParts): tiang ×2, papan, emblem 'N10'. */
export function lambangPlangParts() {
  const scope = currentScope();
  const metal = scope.get('unri:lambang:tiang', () => new THREE.MeshLambertMaterial({ color: 0x6d7a86 }));
  const board = scope.get('unri:lambang:papan', () => new THREE.MeshLambertMaterial({ color: 0xf5f1e6 }));
  const pole = new THREE.CylinderGeometry(0.05, 0.05, POLE_H, 10);
  return [
    { geometry: pole, material: metal, matrix: localMatrix(-0.55, POLE_H / 2, 0.05), castShadow: true, name: 'tiangKiri' },
    { geometry: pole, material: metal, matrix: localMatrix(0.55, POLE_H / 2, 0.05), castShadow: true, name: 'tiangKanan' },
    { geometry: new THREE.BoxGeometry(1.3, 1.3, 0.06), material: board, matrix: localMatrix(0, LAMBANG_BOARD_Y + 0.5, 0), castShadow: true, name: 'papan' },
    { geometry: new THREE.PlaneGeometry(1, 1), material: emblemMaterial(), matrix: localMatrix(0, LAMBANG_BOARD_Y + 0.5, -0.035, 0, Math.PI, 0), name: 'N10' },
  ];
}
```

`src/world/props/unri/halteTmp.js`:

```js
/**
 * Placeholder halte Trans Metro Pekanbaru (katalog P02: atap di 4 tiang + bangku, 6 × 2 × 3 m). Sisi terbuka = −Z
 * lokal. Dipakai hanya bila node halte OSM berada di dalam distrik (keputusan D6: saat ini tidak).
 */
import * as THREE from 'three';
import { currentScope } from '../../../engine/ResourceScope.js';
import { localMatrix } from '../../siteutil/instanceParts.js';

export const HALTE_MODEL_PATH = 'models/unri/p02-halte-tmp.glb';

export function halteParts() {
  const scope = currentScope();
  const metal = scope.get('unri:halte:logam', () => new THREE.MeshLambertMaterial({ color: 0x8a949c }));
  const roof = scope.get('unri:halte:atap', () => new THREE.MeshLambertMaterial({ color: 0x2f4f6f }));
  const post = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8);
  const posts = [[-2.8, -0.85], [2.8, -0.85], [-2.8, 0.85], [2.8, 0.85]]
    .map(([x, z], i) => ({ geometry: post, material: metal, matrix: localMatrix(x, 1.3, z), name: `tiang-${i}` }));
  return [
    ...posts,
    { geometry: new THREE.BoxGeometry(6.2, 0.08, 2.3), material: roof, matrix: localMatrix(0, 2.72, 0), castShadow: true, name: 'atap' },
    { geometry: new THREE.BoxGeometry(4, 0.06, 0.4), material: metal, matrix: localMatrix(0, 0.45, 0.6), name: 'bangku' },
  ];
}
```

- [ ] **Step 6: `src/districts/unri/campusProps.js`**

```js
/**
 * Props kampus milik distrik (katalog N10, P02): plang lambang UNRI (GLB Blender bila ada, placeholder tekstur
 * canvas) di jalur hijau Jl. Binawidya UNRI ±45 m di dalam Gerbang Soebrantas [INFERENSI penempatan, D7], dan halte
 * Trans Metro Pekanbaru bila node OSM-nya di dalam distrik (D6: kedua node di luar → tidak dipasang).
 * Tinggi tanah diperbarui tiap detik; grup bisa dibekukan freezeStatic → matriks diperbarui manual.
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { placeModels } from '../../world/assets/models.js';
import { groupFromParts } from '../../world/siteutil/instanceParts.js';
import { pointInPolygon } from '../../geo/polygon.js';
import { createProjection } from '../../geo/projection.js';
import { WORLD_ORIGIN } from '../../config/constants.js';
import { lambangPlangParts, LAMBANG_MODEL_PATH, LAMBANG_BOARD_Y } from '../../world/props/unri/lambangUnri.js';
import { halteParts, HALTE_MODEL_PATH } from '../../world/props/unri/halteTmp.js';
import { UNRI_BOUNDARY } from './boundary.js';

/** Plang lambang (dunia); muka emblem menghadap selatan (+Z) ke arah pengendara yang masuk dari gerbang. */
export const LAMBANG_SPOT = Object.freeze({ x: -1074.0, z: 2078.0, rotY: Math.PI });

/** Halte TMP OSM (riset §4 [T]; diverifikasi Overpass Task 8 Step 1). */
export const HALTE_TMP_NODES = Object.freeze([
  Object.freeze({ id: 4559431711, lat: 0.4641, lon: 101.373 }),
  Object.freeze({ id: 4559433677, lat: 0.4644, lon: 101.3742 }),
]);

/** Node halte yang berada di dalam batas distrik (dunia). */
export function halteSpotsInDistrict(
  boundary = UNRI_BOUNDARY, projection = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon }),
) {
  return HALTE_TMP_NODES
    .map((n) => ({ id: n.id, ...projection.toWorld(n.lat, n.lon) }))
    .filter((p) => pointInPolygon(p.x, p.z, boundary));
}

export function createCampusProps({ scope, terrain, logger = console }) {
  const group = new THREE.Group();
  group.name = 'propsKampus';
  const items = [];
  let cancelled = false;
  const isCancelled = () => cancelled;
  const report = (label) => (r) => { if (r.failed.length) logger.warn(`${label}: GLB gagal, placeholder dipakai:`, r.failed); };

  const plang = withScope(scope, () => groupFromParts(lambangPlangParts(), 'plangLambangUnri'));
  plang.position.set(LAMBANG_SPOT.x, terrain.heightAt(LAMBANG_SPOT.x, LAMBANG_SPOT.z), LAMBANG_SPOT.z);
  plang.rotation.y = LAMBANG_SPOT.rotY;
  group.add(plang);
  items.push({ root: plang, x: LAMBANG_SPOT.x, z: LAMBANG_SPOT.z });
  if (LAMBANG_MODEL_PATH) {
    const slot = new THREE.Group();
    slot.position.set(0, LAMBANG_BOARD_Y, -0.07);
    plang.add(slot);
    withScope(scope, () => placeModels(slot, [{ path: LAMBANG_MODEL_PATH, replaces: 'N10' }], { world: plang, isCancelled }))
      .then(report('Lambang UNRI'))
      .catch((err) => logger.error('Lambang UNRI gagal dipasang:', err));
  }

  const halteSpots = halteSpotsInDistrict();
  for (const h of halteSpots) {
    const holder = new THREE.Group();
    holder.name = `halteTmp:${h.id}`;
    holder.position.set(h.x, terrain.heightAt(h.x, h.z), h.z);
    holder.add(withScope(scope, () => groupFromParts(halteParts(), 'P02')));
    group.add(holder);
    items.push({ root: holder, x: h.x, z: h.z });
    if (HALTE_MODEL_PATH) {
      withScope(scope, () => placeModels(holder, [{ path: HALTE_MODEL_PATH, replaces: 'P02' }], { world: holder, isCancelled }))
        .then(report('Halte TMP'))
        .catch((err) => logger.error('Halte TMP gagal dipasang:', err));
    }
  }

  let reground = 0;
  return {
    group,
    halteCount: halteSpots.length,
    update(dt) {
      reground -= dt;
      if (reground > 0) return;
      reground = 1;
      for (const it of items) {
        it.root.position.y = terrain.heightAt(it.x, it.z);
        it.root.updateMatrix();
        it.root.updateMatrixWorld(true);
      }
    },
    dispose() {
      cancelled = true;
      group.removeFromParent();
    },
  };
}
```

- [ ] **Step 7: `life.js` memasang props**

Di `src/districts/unri/life.js`:
1. Impor: `import { createCampusProps } from './campusProps.js';`
2. Sesudah baris `const motors = …`, tambahkan `const props = createCampusProps({ scope, terrain, logger });`
3. Ganti `const parts = [students, guards, motors].filter(Boolean);` dengan
   `const parts = [students, guards, motors, props].filter(Boolean);`
4. Di `update` sistem sesudah `motors.update(dt);` tambahkan `props.update(dt);`; di objek kembalian tambahkan `props,`.
5. Komentar berkas: "komposisi mahasiswa, satpam, parkir motor, dan props kampus (lambang, halte)".

- [ ] **Step 8: Tes, lint, build, cek cepat**

Run: `npm test` lalu `npm run lint` lalu `npm run build` → hijau.

Run: `node tests/e2e/harness.unri.mjs props --shot %TEMP%\m7-lambang.jpg`
Expected: `data.plang` = true, `data.halte` = 0 (D6), `errors: []`. Gambar: plang di jalur hijau dengan emblem segi
lima (GLB) menghadap kamera.

- [ ] **Step 9: Commit**

```bash
git add assets-src/blender/unri/m7_halte.py assets-src/blender/unri/m7_lambang.py assets-src/blender/unri/p02-halte-tmp.blend assets-src/blender/unri/n10-lambang-unri.blend public/models/unri/p02-halte-tmp.glb public/models/unri/n10-lambang-unri.glb src/world/props/unri/lambangUnri.js src/world/props/unri/halteTmp.js src/districts/unri/campusProps.js src/districts/unri/life.js
```
```bash
git commit -m "feat(unri): plang lambang UNRI (Lancang Kuning 1-10-62) dekat Gerbang Soebrantas dan model halte TMP (node OSM di luar distrik)"
```

---

## Task 9: Objective `interact` (TDD, `src/sim/story/objectives.js`)

**Files:**
- Modify: `src/sim/story/objectives.js`
- Test: `tests/storyObjectives.test.js`, `tests/storyReducer.test.js`

- [ ] **Step 1: Tes yang gagal**

Tambahkan ke `tests/storyObjectives.test.js` di dalam `describe('applyObjective', …)`:

```js
  it('interact cocok target persis <region|interior>:<id> (spec §8.4)', () => {
    const o = { type: 'interact', target: 'sekre:kipas', at: { region: 'world', x: 0, z: 0 } };
    expect(applyObjective(o, P0, { type: 'interact', target: 'sekre:gitar' }).done).toBe(false);
    expect(applyObjective(o, P0, { type: 'interacted', id: 'kipas', carrying: [] }).done).toBe(false);
    expect(applyObjective(o, P0, { type: 'position', x: 0, z: 0 }).done).toBe(false);
    expect(applyObjective(o, P0, { type: 'interact', target: 'sekre:kipas' })).toEqual({ progress: P0, done: true, effects: [] });
  });
```

Tambahkan di akhir `tests/storyReducer.test.js`:

```js
describe('createStory: objective interact', () => {
  const ch = Object.freeze([{
    id: 'k', title: 'Kampus', rank: 'Aktivis', outro: ['Selesai.'], reward: { rupiah: 100, badge: 'bk' },
    steps: [
      { id: 'ttd', text: 'Minta tanda tangan', objective: { type: 'interact', target: 'unri-lembaga:ketua-bem' }, reward: { rupiah: 10 } },
      { id: 'kipas', text: 'Nyalakan kipas', objective: { type: 'interact', target: 'sekre:kipas' } },
    ],
  }]);
  const st = createStory({ chapters: ch, eggs: [] });
  it('target salah tidak memajukan; target benar memajukan, memberi hadiah, dan menyimpan', () => {
    const s0 = st.initial();
    expect(st.reduce(s0, { type: 'interact', target: 'sekre:kipas' }).state).toBe(s0);
    const r1 = st.reduce(s0, { type: 'interact', target: 'unri-lembaga:ketua-bem' });
    expect(r1.state.step).toBe(1);
    expect(r1.state.rupiah).toBe(10);
    expect(r1.effects.map((e) => e.type)).toEqual(['reward', 'save']);
    const r2 = st.reduce(r1.state, { type: 'interact', target: 'sekre:kipas' });
    expect(r2.state.finished).toBe(true);
    expect(r2.state.badges).toEqual(['bk']);
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/storyObjectives.test.js tests/storyReducer.test.js`
Expected: FAIL (`interact` jatuh ke `default` → tidak pernah selesai).

- [ ] **Step 2: Implementasi**

Di `src/sim/story/objectives.js`, di dalam `switch (objective.type)` sesudah `case 'find': …`, tambahkan:

```js
    case 'interact': // M7: '<region|interior>:<id>' (NPC ber-zone atau barang interior); `at` hanya untuk penanda
      return event.type === 'interact' && event.target === objective.target ? finish(progress) : pass(progress);
```

dan perbarui komentar berkas: "… memajukannya. Jenis: goto, buy, deliver, laps, find, interact (M7)."

- [ ] **Step 3: Tes lulus, lint, commit**

Run: `node node_modules/vitest/vitest.mjs run tests/storyObjectives.test.js tests/storyReducer.test.js` → PASS.
Run: `npm run lint` → 0 galat.
```bash
git add src/sim/story/objectives.js tests/storyObjectives.test.js tests/storyReducer.test.js
```
```bash
git commit -m "feat(story): objective interact untuk target <region|interior>:<id>"
```

---

## Task 10: Pedagang kantin (katalog `kantin`, yaw pedagang, `extraVendors`)

**Files:**
- Modify: `src/sim/vendorSim.js`, `src/entities/Vendor.js`, `src/entities/index.js`
- Test: `tests/vendorSim.test.js`

- [ ] **Step 1: Tes yang gagal**

Tambahkan ke `tests/vendorSim.test.js`:

```js
describe('kantin kampus (M7, keputusan D4)', () => {
  it('katalog kantin: nasi kotak & gorengan', () => {
    const price = (id) => VENDOR_CATALOG.kantin.find((i) => i.id === id).price;
    expect(price('nasi-kotak')).toBe(15000);
    expect(price('gorengan')).toBe(5000);
  });
  it('pedagang satu waypoint diam (DWELL) dengan yaw awal yang diberikan', () => {
    const v = createVendor({ id: 'k', kind: 'kantin', waypoints: [{ x: -790, z: 1140.8 }], yaw: Math.PI });
    expect(v.state).toBe('DWELL');
    expect(v.yaw).toBe(Math.PI);
    const n = stepVendor(v, 10);
    expect(n.pos).toEqual({ x: -790, z: 1140.8 });
    expect(n.yaw).toBe(Math.PI);
    expect(createVendor({ id: 'x', waypoints: [{ x: 0, z: 0 }] }).yaw).toBe(0);
  });
  it('beli nasi kotak dari pedagang kantin', () => {
    const r = buy(createWallet(20000), 'kantin', 'nasi-kotak');
    expect(r.ok).toBe(true);
    expect(r.wallet.balance).toBe(5000);
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/vendorSim.test.js`
Expected: FAIL (`VENDOR_CATALOG.kantin` undefined, yaw tetap 0).

- [ ] **Step 2: `src/sim/vendorSim.js`**

1. Di `VENDOR_CATALOG` sesudah `buah`, tambahkan:

```js
  // Kantin kampus (M7, Kantin FKIP way/282225371): konsumsi rapat ormawa. Harga [INFERENSI].
  kantin: Object.freeze([
    Object.freeze({ id: 'nasi-kotak', name: 'Nasi Kotak (konsumsi rapat)', price: 15000 }),
    Object.freeze({ id: 'gorengan', name: 'Gorengan (5 biji)', price: 5000 }),
  ]),
```

2. Ubah tanda tangan `createVendor` menjadi
   `export function createVendor({ id, kind = 'minuman', waypoints = [], speed, dwell, yaw } = {})` dan ganti
   `yaw: 0,` di objek kembalian dengan `yaw: num(yaw, 0),`. Komentar fungsi: "yaw awal opsional (pedagang mangkal)".

- [ ] **Step 3: `src/entities/Vendor.js`**

1. `DEFAULT_NAMES`: tambahkan `kantin: ['Kantin FKIP'],`.
2. `loadCart(kind)` → `loadCart(kind, banner)` dan di dalamnya `createCart({ kind, label: banner })` (Cart.js memakai
   `opts.label ?? CART.banner[kind]`; jenis selain `buah` digambar sebagai gerobak minuman = etalase, aset P12).
3. Konstruktor: `const counters = { minuman: 0, buah: 0, kantin: 0 };`
4. `#spawn(spec, rng, counters)`:

```js
  #spawn(spec, rng, counters) {
    const kind = VENDOR_CATALOG[spec.kind] ? spec.kind : 'minuman';
    const names = DEFAULT_NAMES[kind] ?? DEFAULT_NAMES.minuman;
    counters[kind] = counters[kind] ?? 0;
    const name = spec.name ?? names[counters[kind]++ % names.length];
    const sim = createVendor({ id: spec.id, kind, waypoints: spec.waypoints, speed: spec.speed, yaw: spec.yaw });
    const root = new THREE.Group();
    root.name = `vendor-${spec.id}`;
    const h = createHumanoid(randomVendorOutfit(rng, kind));
    const cartSlot = new THREE.Group();
    cartSlot.position.z = CART_OFFSET_Z;
    cartSlot.add(mergeByMaterial(createFallbackCart({ kind })));
    root.add(h.group, cartSlot);
    this.group.add(root);
    const entry = { sim, h, root, cartSlot, name, kind, yaw: sim.yaw ?? 0 };
    this.#vendors.push(entry);
    this.#place(entry, 0);
    this.#attachAsync(entry, kind, name, spec.banner);
  }
```

5. `#attachAsync(entry, kind, name, banner)` dan pemanggilan `loadCart(kind, banner)` di dalamnya.
6. JSDoc konstruktor: `kind:'minuman'|'buah'|'kantin'`, `yaw?:number`, `banner?:string`.

Kode lama yang mutasi `counters` sudah ada (pola sebelumnya); tidak menambah pola baru.

- [ ] **Step 4: `src/entities/index.js`**

Ubah tanda tangan menjadi `export function buildEntities({ start, world, wallet, camera, extraVendors = [] })`, JSDoc
`extraVendors: pedagang tambahan di luar layout region (M7: Kantin FKIP)`, dan pembuatan pedagang menjadi:

```js
  const vendors = new VendorGroup({ vendors: [...layout.vendors, ...extraVendors], wallet });
```

- [ ] **Step 5: Tes, lint, commit**

Run: `npm test` → hijau (termasuk `tests/vendorSim.test.js`).
Run: `npm run lint` → 0 galat.
```bash
git add src/sim/vendorSim.js src/entities/Vendor.js src/entities/index.js tests/vendorSim.test.js
```
```bash
git commit -m "feat(entities): pedagang kantin kampus (nasi kotak), yaw awal pedagang mangkal, pedagang tambahan di luar layout"
```

---

## Task 11: Chapter 6 "Kampus Biru Langit" (data, NPC, pedagang, tes konsistensi)

**Files:**
- Create: `src/story/chapters.unri.js`, `tests/storyUnri.test.js`
- Modify: `src/story/chapters.js`, `src/entities/StoryNpcs.js`, `src/main.js`, `tests/storyData.test.js`

- [ ] **Step 1: `src/story/chapters.unri.js`**

```js
/**
 * Chapter 6 "Kampus Biru Langit" (spec UNRI §8.4): 4 misi di Kampus UNRI Bina Widya —
 * (1) antar nasi kotak konsumsi rapat dari Kantin FKIP ke sekre (`deliver`), (2) minta tanda tangan Ketua BEM di depan
 * sekre BEM (`interact` NPC), (3) satu putaran Danau Buatan (`goto` berantai), (4) masuk sekre dan nyalakan kipas
 * (`interact` barang interior). Titik memakai region 'world' (keputusan D2): koordinat dunia ENU dihitung dari OSM
 * (proyeksi WORLD_ORIGIN) dan dikunci terhadap data M3–M6 oleh tests/storyUnri.test.js.
 * Kak Nisa dan Bang Raka adalah tokoh fiksi permainan, bukan orang nyata.
 */
const freezeDeep = (o) => {
  Object.values(o).forEach((v) => { if (v && typeof v === 'object') freezeDeep(v); });
  return Object.freeze(o);
};
const world = (x, z) => ({ region: 'world', x, z });

/** Id interactable kipas di interior sekre (M5; diverifikasi Task 0 Step 5 dan tests/storyUnri.test.js). */
export const SEKRE_KIPAS_ID = 'kipas';

export const UNRI_POINTS = freezeDeep({
  /** Depan Kantin FKIP way/282225371 (tepi utara z 1142,8): posisi pedagang kantin. */
  kantinFkip: world(-790.0, 1140.8),
  /** Ujung timur selasar Sekretariat Lembaga Mahasiswa way/327530276 + 2,5 m (pusat + 10,9·u, u = sumbu panjang). */
  sekreUjungTimur: world(-209.2, 1102.8),
  /** Pusat Sekretariat Lembaga Mahasiswa (selasar tengah): penanda pintu sekre. */
  sekreTengah: world(-219.5, 1099.2),
  /** Keliling Danau Buatan way/373856980, 10–14 m dari tepi air: timur, selatan, barat, utara. */
  danau: [world(-698.0, 806.0), world(-758.6, 859.8), world(-846.4, 894.3), world(-785.4, 820.2)],
});

/** Menghadap ke ujung selasar (arah −u): atan2(−0,944, −0,329). */
const FACE_SELASAR = -1.91;
const KETUA_BEM = world(-210.7, 1107.0);
const KAK_NISA = world(-207.7, 1098.6);

/** NPC cerita kampus: `zone` = id region logis untuk target interact (D5); `look` = pakaian (StoryNpcs). */
export const UNRI_STORY_NPCS = freezeDeep([
  { id: 'ketua-bem', name: 'Bang Raka (Ketua BEM)', zone: 'unri-lembaga', look: 'almamater', ...KETUA_BEM, yaw: FACE_SELASAR },
  { id: 'kak-nisa', name: 'Kak Nisa (Sekum)', zone: 'unri-lembaga', look: 'almamater', ...KAK_NISA, yaw: FACE_SELASAR },
]);

/**
 * Pedagang kantin (D4). Koordinat frame region stadion (placement stadion ≈ identitas, geser < 2 cm; Plan C Task 18),
 * sama dengan koordinat dunia. Menghadap utara (yaw π) ke jalan servis di depan kantin.
 */
export const UNRI_VENDORS = freezeDeep([
  { id: 'kantin-fkip', kind: 'kantin', name: 'Kantin FKIP', banner: 'NASI KOTAK', waypoints: [{ x: -790.0, z: 1140.8 }], yaw: Math.PI },
]);

const danauStep = (n, where, extra = {}) => ({
  id: `danau-${n}`, mission: 3, text: `Keliling Danau Buatan: penanda ${n}/5 ${where}`,
  objective: { type: 'goto', target: UNRI_POINTS.danau[(n - 1) % 4], radius: 12 }, ...extra,
});

export const CHAPTER_KAMPUS = freezeDeep({
  id: 'kampus-biru-langit',
  title: 'Kampus Biru Langit',
  rank: 'Aktivis Kampus',
  outro: [
    'Kipas berputar, kertas proker berkibar, rapat malam dimulai. Kamu resmi jadi bagian Kampus Biru Langit!',
    'Jelajahi kampus, cari easter egg yang tersisa, dan jangan lupa LPJ, ya!',
  ],
  reward: { rupiah: 25000, badge: 'Anak Biru Langit' },
  steps: [
    {
      id: 'beli-nasi-kotak', mission: 1, text: 'Beli Nasi Kotak di Kantin FKIP (tekan E di dekat etalase)',
      say: [
        'Kak Nisa (chat): "Halo! Kami lagi rapat di sekre lembaga, selatan Stadion Mini UNRI. Konsumsinya belum datang nih."',
        'Kak Nisa (chat): "Tolong beliin nasi kotak di Kantin FKIP ya, nanti diganti uang kas. Aman!"',
      ],
      objective: { type: 'buy', itemId: 'nasi-kotak' },
    },
    {
      id: 'antar-nasi-kotak', mission: 1, text: 'Antar Nasi Kotak ke Kak Nisa di ujung selasar sekre lembaga (tekan E)',
      objective: { type: 'deliver', npcId: 'kak-nisa', itemId: 'nasi-kotak', missingText: 'Nasi kotaknya mana? Beli dulu di Kantin FKIP, ya.' },
      reward: { rupiah: 5000 },
    },
    {
      id: 'ttd-ketua-bem', mission: 2, text: 'Minta tanda tangan proposal ke Bang Raka (Ketua BEM) di depan sekre BEM (tekan E)',
      say: [
        'Kak Nisa: "Makasih banyak! Eh, sekalian ya, proposal kegiatan ini butuh tanda tangan Ketua BEM."',
        'Kak Nisa: "Bang Raka lagi di depan sekre BEM, sebelahan sama sekre kita. Samperin aja."',
      ],
      objective: { type: 'interact', target: 'unri-lembaga:ketua-bem', at: KETUA_BEM },
      reward: { rupiah: 3000 },
    },
    danauStep(1, 'di ujung timur', {
      say: [
        'Bang Raka: "Udah kuteken. Mukamu kusut amat, refreshing dulu sana keliling Danau Buatan depan Rektorat."',
        'Ikuti penanda satu per satu sampai satu putaran penuh.',
      ],
    }),
    danauStep(2, 'di sisi selatan'),
    danauStep(3, 'di ujung barat'),
    danauStep(4, 'di sisi utara'),
    danauStep(5, 'kembali ke ujung timur menutup putaran', { reward: { rupiah: 4000 } }),
    {
      id: 'nyalakan-kipas', mission: 4, text: 'Masuk sekre dan nyalakan kipas angin (tekan E)',
      say: [
        'Kak Nisa (chat): "Rapat lanjut malam ini di sekre. Gerah banget, tolong masuk duluan dan nyalain kipas ya!"',
        'Pintu sekre kita di sebelah sekre BEM. Tekan E di depan pintu untuk masuk, lalu E di dekat kipas.',
      ],
      objective: { type: 'interact', target: `sekre:${SEKRE_KIPAS_ID}`, at: UNRI_POINTS.sekreTengah },
    },
  ],
});
```

- [ ] **Step 2: Gabungkan ke `src/story/chapters.js`**

1. Tambahkan impor di atas: `import { CHAPTER_KAMPUS, UNRI_STORY_NPCS } from './chapters.unri.js';`
2. Ganti `export const STORY_NPCS = freezeDeep([ …dua NPC lama… ]);` menjadi deklarasi
   `const BASE_NPCS = [ …dua NPC lama, isi tidak berubah… ];` lalu
   `export const STORY_NPCS = freezeDeep([...BASE_NPCS, ...UNRI_STORY_NPCS]);`
3. Ganti `export const CHAPTERS = freezeDeep([ …5 chapter lama… ]);` menjadi
   `const BASE_CHAPTERS = [ …5 chapter lama, isi tidak berubah… ];` lalu
   `export const CHAPTERS = freezeDeep([...BASE_CHAPTERS, CHAPTER_KAMPUS]);`
4. Komentar berkas: "6 chapter (5 stadion + chapter 6 kampus dari chapters.unri.js)".

Urutan NPC lama tidak berubah (StoryNpcs memakai indeks untuk benih pakaian).

- [ ] **Step 3: Pakaian almamater NPC kampus (`src/entities/StoryNpcs.js`)**

1. Impor: `import { randomCasualOutfit, randomStudentOutfit } from './Humanoid.outfits.js';`
2. Tambahkan helper di atas kelas:

```js
/** NPC kampus berjas almamater (look 'almamater'); NPC lain berpakaian kasual. */
const outfitFor = (npc, rng) => (npc.look === 'almamater'
  ? randomStudentOutfit(rng, { almamaterChance: 1, backpackChance: 0 })
  : randomCasualOutfit(rng));
```

3. Di konstruktor ganti `createHumanoid(randomCasualOutfit(makeRng(OUTFIT_SEED + i)))` menjadi
   `createHumanoid(outfitFor(npc, makeRng(OUTFIT_SEED + i)))`.

M0 membuat StoryNpcs/StoryDirector me-resolve titik ber-`region` (Task 0 Step 2). NPC kampus memakai
`region: 'world'`; bila resolver M0 belum menangani `'world'`, tambahkan cabang identitas di `resolvePoint`
(`src/story/points.js`, spec §4.5 menyebut `'world'`) beserta satu tes di berkas tes points M0, dan catat.

- [ ] **Step 4: Pedagang kantin dipasang (`src/main.js`)**

Impor `import { UNRI_VENDORS } from './story/chapters.unri.js';` dan tambahkan `extraVendors: UNRI_VENDORS` ke objek
argumen `buildEntities({ … })`.

- [ ] **Step 5: Tes data cerita (`tests/storyData.test.js`)**

Tambahkan di dalam `describe('data cerita', …)`:

```js
  it('interact: target <region|interior>:<id> dan titik penanda valid bila ada', () => {
    steps.filter((s) => s.objective.type === 'interact').forEach((s) => {
      expect(s.objective.target).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/);
      if (s.objective.at) expect([s.objective.at.x, s.objective.at.z].every(Number.isFinite)).toBe(true);
    });
  });
  it('chapter 6 Kampus Biru Langit: 4 misi (deliver, interact NPC, goto berantai, interact interior)', () => {
    const ch = CHAPTERS.find((c) => c.id === 'kampus-biru-langit');
    expect(CHAPTERS.indexOf(ch)).toBe(5);
    expect(new Set(ch.steps.map((s) => s.mission))).toEqual(new Set([1, 2, 3, 4]));
    expect(ch.steps.filter((s) => s.mission === 1).map((s) => s.objective.type)).toEqual(['buy', 'deliver']);
    expect(ch.steps.find((s) => s.mission === 2).objective).toMatchObject({ type: 'interact', target: 'unri-lembaga:ketua-bem' });
    const danau = ch.steps.filter((s) => s.mission === 3);
    expect(danau.length).toBe(5);
    expect(danau.every((s) => s.objective.type === 'goto')).toBe(true);
    expect(danau[4].objective.target).toEqual(danau[0].objective.target);
    expect(ch.steps.find((s) => s.mission === 4).objective.target.startsWith('sekre:')).toBe(true);
  });
  it('NPC target interact ada di STORY_NPCS dengan zone yang sama', () => {
    steps.filter((s) => s.objective.type === 'interact' && !s.objective.target.startsWith('sekre:')).forEach((s) => {
      const [zone, id] = s.objective.target.split(':');
      expect(STORY_NPCS.find((n) => n.id === id)?.zone).toBe(zone);
    });
  });
```

- [ ] **Step 6: Tes konsistensi terhadap data M3–M6 (`tests/storyUnri.test.js`)**

```js
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { pointInPolygon, distanceToRing } from '../src/geo/polygon.js';
import { toWorld } from '../src/geo/regionTransform.js';
import { tileOf } from '../src/geo/tiles.js';
import { regionContains } from '../src/regions/Region.js';
import { UNRI_BOUNDARY } from '../src/districts/unri/boundary.js';
import { GUARD_SPOTS } from '../src/districts/unri/guards.js';
import { LAMBANG_SPOT, halteSpotsInDistrict } from '../src/districts/unri/campusProps.js';
import { GROUND_SCALE } from '../src/districts/unri/life.js';
import { toPoints } from '../src/sim/campusLife.js';
import { PORTAL_DOORS } from '../src/regions/unri-lembaga/portalDoors.js';
import * as lembagaModule from '../src/regions/unri-lembaga/index.js';
import * as rektoratModule from '../src/regions/unri-rektorat/index.js';
import { UNRI_POINTS, UNRI_STORY_NPCS, UNRI_VENDORS, SEKRE_KIPAS_ID } from '../src/story/chapters.unri.js';

const buildings = JSON.parse(readFileSync('public/districts/unri/buildings.json', 'utf8')).buildings;
const ringOf = (id) => buildings.find((b) => b.id === id)?.ring;
const inBuilding = (x, z) => buildings.some((b) => pointInPolygon(x, z, b.ring));
const defOf = (mod, id) => Object.values(mod).find((v) => v && typeof v === 'object' && v.id === id);
const LEMBAGA = defOf(lembagaModule, 'unri-lembaga');
const REKTORAT = defOf(rektoratModule, 'unri-rektorat');
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Danau Buatan Universitas Riau way/373856980 (OSM cache 2026-10-16 → dunia). */
const DANAU = [
  [-727.7, 792.6], [-720, 793.9], [-716.8, 794.5], [-709.4, 799.9], [-708.5, 806.9], [-710.4, 814.8], [-719, 823.1],
  [-736, 833.9], [-765.8, 847.6], [-784.3, 857.4], [-793, 863.1], [-799.7, 866.3], [-803.2, 867.6], [-804.5, 870.8],
  [-813.1, 875.5], [-826.6, 883.2], [-837.8, 888.6], [-835.5, 881.9], [-835.5, 875.2], [-836.5, 871.1], [-827.2, 860.9],
  [-820.2, 852.3], [-812.2, 847.6], [-805.4, 846.3], [-802.9, 843.1], [-797.5, 841.8], [-793.6, 838], [-787.8, 835.2],
  [-777.9, 831.7], [-771.2, 827.5], [-765.8, 824.4], [-758.7, 823.1], [-751.7, 816.7], [-743.4, 807.8], [-742.4, 803.7],
  [-737.6, 798.6], [-732.5, 793.5],
];

describe('chapter 6 & kehidupan kampus vs data M3–M6 (keputusan D2)', () => {
  it('definisi region hero M4/M6 tersedia', () => {
    expect(LEMBAGA?.placement).toBeDefined();
    expect(REKTORAT?.placement).toBeDefined();
  });
  it('ujung selasar timur ≤ 10 m dari pintu sekre pemain M4 (sekre BEM bersebelahan)', () => {
    const door = PORTAL_DOORS.find((d) => d.id === 'sekre-pemain');
    const w = toWorld(LEMBAGA.placement, door.pos.lx, door.pos.lz);
    expect(dist(w, UNRI_POINTS.sekreUjungTimur)).toBeLessThanOrEqual(10);
  });
  it('pusat sekre di dalam footprint Sekretariat Lembaga Mahasiswa', () => {
    expect(pointInPolygon(UNRI_POINTS.sekreTengah.x, UNRI_POINTS.sekreTengah.z, ringOf('w327530276'))).toBe(true);
  });
  it('NPC kampus di luar gedung, ≤ 6 m dari ujung selasar, berjarak ≥ 6 m satu sama lain', () => {
    UNRI_STORY_NPCS.forEach((n) => {
      expect(inBuilding(n.x, n.z)).toBe(false);
      expect(dist(n, UNRI_POINTS.sekreUjungTimur)).toBeLessThanOrEqual(6);
    });
    expect(dist(UNRI_STORY_NPCS[0], UNRI_STORY_NPCS[1])).toBeGreaterThanOrEqual(6);
  });
  it('pedagang kantin di luar gedung, ≤ 6 m dari Kantin FKIP, di dalam distrik', () => {
    const v = UNRI_VENDORS[0].waypoints[0];
    expect(inBuilding(v.x, v.z)).toBe(false);
    expect(distanceToRing(v.x, v.z, ringOf('w282225371'))).toBeLessThanOrEqual(6);
    expect(pointInPolygon(v.x, v.z, UNRI_BOUNDARY)).toBe(true);
  });
  it('penanda Danau Buatan di luar air, 6–30 m dari tepi', () => {
    UNRI_POINTS.danau.forEach((p) => {
      expect(pointInPolygon(p.x, p.z, DANAU)).toBe(false);
      const d = distanceToRing(p.x, p.z, DANAU);
      expect(d).toBeGreaterThanOrEqual(6);
      expect(d).toBeLessThanOrEqual(30);
    });
  });
  it('interactable kipas ada di interior sekre M5', () => {
    const src = ['src/interiors/sekre/interactables.js', 'src/interiors/sekre/data.js']
      .filter((f) => existsSync(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(src).toMatch(new RegExp(`id:\\s*['"]${SEKRE_KIPAS_ID}['"]`));
  });
  it('satpam ≤ 4 m dari Pos Keamanan way/327534471 dan di luar gedung', () => {
    GUARD_SPOTS.forEach((g) => {
      expect(inBuilding(g.x, g.z)).toBe(false);
      expect(distanceToRing(g.x, g.z, ringOf('w327534471'))).toBeLessThanOrEqual(4);
    });
  });
  it('plang lambang di distrik, di luar gedung & region hero, tidak di badan jalan', () => {
    const { x, z } = LAMBANG_SPOT;
    expect(pointInPolygon(x, z, UNRI_BOUNDARY)).toBe(true);
    expect(inBuilding(x, z)).toBe(false);
    expect(regionContains(LEMBAGA, x, z)).toBe(false);
    expect(regionContains(REKTORAT, x, z)).toBe(false);
    const t = tileOf(x, z);
    const ground = JSON.parse(readFileSync(`public/districts/unri/ground/${t.ix}_${t.iz}.json`, 'utf8'));
    for (const r of ground.roads ?? []) {
      expect(distanceToRing(x, z, toPoints(r.pts, GROUND_SCALE), false)).toBeGreaterThan(r.w / 2 + 0.5);
    }
  });
  it('halte TMP OSM berada di luar distrik (keputusan D6)', () => {
    expect(halteSpotsInDistrict()).toEqual([]);
  });
});
```

Penanganan bila gagal (perbaiki DATA, bukan tes):
- "ujung selasar timur ≤ 10 m": denah M4 meletakkan sekre BEM/pemain di ujung barat. Ganti di `chapters.unri.js`:
  `sekreUjungTimur` → `world(-229.8, 1095.6)` (dan ganti nama konstanta menjadi `sekreUjungBarat` di kedua berkas),
  `KETUA_BEM` → `world(-231.3, 1099.8)`, `KAK_NISA` → `world(-228.3, 1091.4)`, `FACE_SELASAR` → `1.23`
  (atan2(0,944, 0,329)). Bila tetap gagal, letakkan NPC 3 m di depan pintu `sekre-pemain` (dunia dari `toWorld`)
  ke arah luar selasar, ±4,5 m menyamping satu sama lain, lalu catat.
- "kipas": ganti `SEKRE_KIPAS_ID` dengan id nyata (Task 0 Step 5).
- "plang lambang … badan jalan": geser `LAMBANG_SPOT.x` ke titik tengah antara dua jalur Jl. Binawidya UNRI di z 2078
  (median), lalu ulangi.
- "halte … di luar distrik" gagal (node di dalam distrik): biarkan `campusProps` memasangnya, ubah tes menjadi
  `toHaveLength(n)` sesuai jumlah node di dalam, dan perbarui D6 di laporan.

- [ ] **Step 7: Tes, lint, build**

Run: `node node_modules/vitest/vitest.mjs run tests/storyData.test.js tests/storyUnri.test.js`
Expected: PASS. Lalu `npm test` → seluruh suite hijau (tes `storyDirector` memakai `CHAPTERS` dinamis).
Run: `npm run lint` lalu `npm run build` → hijau.

- [ ] **Step 8: Commit**

```bash
git add src/story/chapters.unri.js src/story/chapters.js src/entities/StoryNpcs.js src/main.js tests/storyData.test.js tests/storyUnri.test.js
```
```bash
git commit -m "feat(story): chapter 6 Kampus Biru Langit (nasi kotak, tanda tangan Ketua BEM, keliling Danau Buatan, kipas sekre)"
```

---

## Task 12: StoryDirector `interact` + hook interaksi interior

**Files:**
- Create: `src/app/interiorStoryHook.js`, `tests/interiorStoryHook.test.js`
- Modify: `src/core/StoryDirector.js`, `src/main.js`, `tests/storyDirector.test.js`

- [ ] **Step 1: Tes hook (gagal dulu)**

Buat `tests/interiorStoryHook.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { withInteractHook } from '../src/app/interiorStoryHook.js';

const makeDef = (async = false) => {
  const built = { scene: {}, interactables: [{ id: 'kipas', label: 'Kipas', onInteract: () => ({ text: 'wuus' }) }], dispose() {} };
  return Object.freeze({ id: 'sekre', label: 'Sekre', build: () => (async ? Promise.resolve(built) : built) });
};

describe('withInteractHook', () => {
  it('melaporkan <interiorId>:<id> dan meneruskan hasil onInteract asli (build sinkron)', () => {
    const seen = [];
    const def = makeDef();
    const wrapped = withInteractHook(def, (t) => seen.push(t));
    const built = wrapped.build({});
    expect(built.interactables[0].onInteract({})).toEqual({ text: 'wuus' });
    expect(seen).toEqual(['sekre:kipas']);
    expect(wrapped.id).toBe('sekre');
    expect(def.build({}).interactables[0].onInteract({})).toEqual({ text: 'wuus' });
    expect(seen).toEqual(['sekre:kipas']);
  });
  it('build berupa Promise juga dibungkus', async () => {
    const seen = [];
    const built = await withInteractHook(makeDef(true), (t) => seen.push(t)).build({});
    built.interactables[0].onInteract({});
    expect(seen).toEqual(['sekre:kipas']);
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/interiorStoryHook.test.js` → FAIL (modul tidak ada).

- [ ] **Step 2: `src/app/interiorStoryHook.js`**

```js
/**
 * Hook cerita untuk interior (spec UNRI §8.4: objective `interact` pada barang interior): membungkus definisi interior
 * (kontrak §4.8, `build(ctx)` mengembalikan objek polos) sehingga setiap `onInteract` interactable juga melapor
 * `<interiorId>:<interactableId>` ke cerita. Definisi asli tidak diubah; build sinkron atau Promise didukung;
 * hasil `onInteract` asli (void | {text, title}) diteruskan apa adanya.
 * @param {{id:string, build(ctx:object): object|Promise<object>}} def
 * @param {(target:string) => void} onInteracted
 */
export function withInteractHook(def, onInteracted) {
  const wrap = (built) => ({
    ...built,
    interactables: (built.interactables ?? []).map((it) => Object.freeze({
      ...it,
      onInteract(ctx) {
        const result = it.onInteract(ctx);
        onInteracted(`${def.id}:${it.id}`);
        return result;
      },
    })),
  });
  return Object.freeze({
    ...def,
    build(ctx) {
      const built = def.build(ctx);
      return built && typeof built.then === 'function' ? built.then(wrap) : wrap(built);
    },
  });
}
```

Run: `node node_modules/vitest/vitest.mjs run tests/interiorStoryHook.test.js` → PASS.
(Bila Task 0 mencatat `build` interior M5 mengembalikan instans kelas, bukan objek polos, ganti `...built` dengan
`Object.assign(Object.create(Object.getPrototypeOf(built)), built, { interactables })` dan catat.)

- [ ] **Step 3: Tes StoryDirector (gagal dulu)**

Tambahkan ke `tests/storyDirector.test.js` (impor `STORY_NPCS` dari `../src/story/chapters.js` dan `SAVE_VERSION`
dari `../src/story/storage.js` bila belum):

```js
describe('StoryDirector: interact (M7)', () => {
  const spyOn = (d) => {
    const seen = [];
    const orig = d.dispatch.bind(d);
    d.dispatch = (e) => { seen.push(e); orig(e); };
    return seen;
  };
  it('onInteract mengirim event interact; target tanpa ":" diabaikan', () => {
    const { d } = started();
    const seen = spyOn(d);
    d.onInteract('sekre:kipas');
    d.onInteract('kipas');
    d.onInteract(null);
    expect(seen).toEqual([{ type: 'interact', target: 'sekre:kipas' }]);
  });
  it('bicara dengan NPC ber-zone juga mengirim interact <zone>:<id>', () => {
    const { d } = started();
    d.advanceDialog();
    d.advanceDialog();
    const npc = STORY_NPCS.find((n) => n.id === 'ketua-bem');
    const seen = spyOn(d);
    expect(d.tryInteract({ x: npc.x + 1, z: npc.z })).toBe(true);
    expect(seen.map((e) => e.type)).toEqual(['interacted', 'interact']);
    expect(seen[1].target).toBe('unri-lembaga:ketua-bem');
  });
  it('penanda objective interact = titik `at`; langkah ttd selesai saat bicara dengan Ketua BEM', () => {
    const step = CHAPTERS[5].steps.findIndex((s) => s.id === 'ttd-ketua-bem');
    const { d } = started({ save: { version: SAVE_VERSION, chapter: 5, step, badges: [], eggs: [], bestLap: null, rupiah: 0, finished: false, wallet: { balance: 50000, items: [] } } });
    expect(d.goalPoint()).toMatchObject({ x: -210.7, z: 1107 });
    const npc = STORY_NPCS.find((n) => n.id === 'ketua-bem');
    d.tryInteract({ x: npc.x, z: npc.z + 1 });
    expect(d.state.step).toBe(step + 1);
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/storyDirector.test.js` → FAIL (`onInteract` bukan fungsi).
(Bila save v3 M0 mensyaratkan field tambahan, lengkapi objek save di tes ini sesuai `sanitizeSave` M0.)

- [ ] **Step 4: Implementasi di `src/core/StoryDirector.js`**

1. Tambahkan method publik sesudah `onBought(itemId) { … }`:

```js
  /** Barang interior/objek dunia dipakai (hook interior M7): event `interact` '<region|interior>:<id>'. */
  onInteract(target) {
    if (typeof target !== 'string' || !target.includes(':')) return;
    this.dispatch({ type: 'interact', target });
  }
```

2. Di `tryInteract(pos)`, ganti blok sesudah `const before = this.state;` menjadi:

```js
    this.dispatch({ type: 'interacted', id: npc.id, carrying });
    // NPC ber-zone (M7, keputusan D5) juga menjadi target objective `interact` '<zone>:<id>'.
    if (npc.zone && this.state === before) this.dispatch({ type: 'interact', target: `${npc.zone}:${npc.id}` });
    if (this.state === before) this.onToast(`${npc.name}: Halo, semangat ya!`, true);
    return true;
```

3. Di `goalPoint()`, sebelum `return null;` terakhir, tambahkan:

```js
    if (o.type === 'interact') return o.at ?? null;
```

(Bila M0 membungkus nilai kembalian `goalPoint` dengan resolver titik ber-region, letakkan baris ini di dalam
pola yang sama sehingga `o.at` ikut di-resolve.)

- [ ] **Step 5: Hook interior di `src/main.js`**

1. Impor: `import { withInteractHook } from './app/interiorStoryHook.js';`
2. Di tempat definisi interior sekre M5 didaftarkan ke portal (catatan Task 0 Step 5; mis.
   `createInteriorPortal({ …, interiors: { sekre: sekreInterior } })` atau `portal.register(sekreInterior)`), ganti
   `sekreInterior` dengan `withInteractHook(sekreInterior, (target) => story.onInteract(target))`. Closure dibaca saat
   pemain berinteraksi, jadi tetap benar walau `story` dibuat sesudah portal dalam fungsi yang sama.

- [ ] **Step 6: Tes, lint, build, cek manual**

Run: `npm test` lalu `npm run lint` lalu `npm run build` → hijau.

Cek manual (dev server `stadion-dev` atau Playwright): `__sim.fastTravel('unri-sekre')` belum ada (Task 15), jadi
`__sim.teleport(-209, 1104, -1.91)`, tekan E di dekat Bang Raka → toast "Halo, semangat ya!" (bukan langkah aktif);
`__sim.portal.enter('sekre')`, dekati kipas, tekan E → di konsol `__sim.story.state` tidak berubah (bukan langkah
aktif) dan tanpa galat.

- [ ] **Step 7: Commit**

```bash
git add src/app/interiorStoryHook.js src/core/StoryDirector.js src/main.js tests/interiorStoryHook.test.js tests/storyDirector.test.js
```
```bash
git commit -m "feat(story): event interact dari NPC ber-zone dan barang interior sekre, penanda objective interact"
```

---

## Task 13: Buka chapter baru untuk save yang sudah tamat (TDD)

**Files:**
- Modify: `src/story/storage.js`, `src/core/StoryDirector.js`
- Test: `tests/storyReopen.test.js` (baru), `tests/storyDirector.test.js`

- [ ] **Step 1: Tes yang gagal**

Buat `tests/storyReopen.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { reopenForNewChapters } from '../src/story/storage.js';

const base = Object.freeze({
  version: 3, chapter: 4, step: 0, badges: Object.freeze(['Anak Bertuah']), eggs: Object.freeze([]), bestLap: null,
  rupiah: 100, finished: true, wallet: Object.freeze({ balance: 1000, items: Object.freeze([]) }),
});

describe('reopenForNewChapters (M7: chapter 6 ditambahkan)', () => {
  it('save tamat di chapter lama dibuka di chapter berikutnya, langkah 0; progres lain utuh; input tidak dimutasi', () => {
    const r = reopenForNewChapters(base, 6);
    expect(r.reopened).toBe(true);
    expect(r.save).toMatchObject({ chapter: 5, step: 0, finished: false, rupiah: 100, badges: ['Anak Bertuah'] });
    expect(r.save.wallet).toEqual(base.wallet);
    expect(base.chapter).toBe(4);
    expect(base.finished).toBe(true);
  });
  it('tamat di chapter terakhir, belum tamat, atau bukan save: dikembalikan apa adanya', () => {
    const last = { ...base, chapter: 5 };
    expect(reopenForNewChapters(last, 6)).toEqual({ save: last, reopened: false });
    const ongoing = { ...base, finished: false, chapter: 2 };
    expect(reopenForNewChapters(ongoing, 6).save).toBe(ongoing);
    expect(reopenForNewChapters(null, 6)).toEqual({ save: null, reopened: false });
    expect(reopenForNewChapters({ ...base, chapter: 'x' }, 6).reopened).toBe(false);
  });
});
```

Tambahkan ke `tests/storyDirector.test.js`:

```js
describe('StoryDirector: chapter baru untuk save tamat (M7)', () => {
  it('save tamat di chapter 5 lama dibuka di chapter 6, diberi toast, dan disimpan ulang', () => {
    const save = { version: SAVE_VERSION, chapter: 4, step: 0, badges: ['Anak Bertuah'], eggs: [], bestLap: null, rupiah: 0, finished: true, wallet: { balance: 1000, items: [] } };
    const { d, log, store } = started({ save });
    expect(d.state.chapter).toBe(5);
    expect(d.state.finished).toBe(false);
    expect(log.toasts.some(([t]) => t.includes('Kampus Biru Langit'))).toBe(true);
    expect(JSON.parse(store.get(STORY_KEY)).chapter).toBe(5);
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/storyReopen.test.js tests/storyDirector.test.js`
Expected: FAIL (`reopenForNewChapters` tidak diekspor; StoryDirector tetap `finished`).

- [ ] **Step 2: `src/story/storage.js`**

Tambahkan sesudah `sanitizeSave`:

```js
/**
 * Chapter baru ditambahkan setelah pemain tamat (M7: chapter 6 "Kampus Biru Langit", keputusan D9): save yang
 * `finished` di bawah chapter terakhir dibuka di chapter berikutnya, langkah 0. Murni; save lain dikembalikan apa adanya.
 * @param {object|null} save save tersanitasi
 * @param {number} chapterCount jumlah chapter saat ini
 * @returns {{save: object|null, reopened: boolean}}
 */
export function reopenForNewChapters(save, chapterCount) {
  if (!save || save.finished !== true || !Number.isInteger(save.chapter) || save.chapter >= chapterCount - 1) {
    return { save, reopened: false };
  }
  return { save: { ...save, chapter: save.chapter + 1, step: 0, finished: false }, reopened: true };
}
```

- [ ] **Step 3: `src/core/StoryDirector.js` `start()`**

1. Impor `reopenForNewChapters` dari `../story/storage.js` (gabung ke impor yang ada).
2. Di `start()`, ganti pemakaian `save` hasil `loadStory(...)` sehingga melewati `reopenForNewChapters`:

```js
  start() {
    const loaded = loadStory(this.storage, LIMITS);
    if (loaded) {
      const { save, reopened } = reopenForNewChapters(loaded, CHAPTERS.length);
      const { wallet, version: _version, ...progress } = save;
      this.state = this.story.hydrate(progress);
      this.vendors.setWallet(wallet);
      this.onWalletChange(this.vendors.wallet);
      if (reopened) {
        this.#persist();
        this.onToast(`Chapter baru terbuka: ${CHAPTERS[this.state.chapter].title}. Buka jurnal (J) untuk misinya.`, true);
      }
    }
    this.#render();
  }
```

(Bila M0 menambah langkah lain di `start()`, pertahankan; yang ditambahkan M7 hanya `reopenForNewChapters` + blok
`if (reopened)`.)

- [ ] **Step 4: Tes lulus, lint, commit**

Run: `node node_modules/vitest/vitest.mjs run tests/storyReopen.test.js tests/storyDirector.test.js` → PASS.
Run: `npm test` lalu `npm run lint` → hijau.
```bash
git add src/story/storage.js src/core/StoryDirector.js tests/storyReopen.test.js tests/storyDirector.test.js
```
```bash
git commit -m "feat(story): save yang sudah tamat membuka chapter 6 Kampus Biru Langit tanpa kehilangan progres"
```

---

## Task 14: Easter egg kampus (lambang 1-10-62, Kampus Biru Langit, GGM)

**Files:**
- Modify: `src/story/easterEggs.js`, `src/story/eggTriggers.js`, `src/core/StoryDirector.js`, `src/main.js`
- Test: `tests/storyEggTriggers.test.js`, `tests/storyUnri.test.js`

- [ ] **Step 1: Tes yang gagal**

Tambahkan ke `tests/storyEggTriggers.test.js` (impor `GGM_RING` dari `../src/story/eggTriggers.js`):

```js
  it('lambang 1-10-62: berbasis jarak di plang dekat Gerbang Soebrantas', () => {
    const egg = EASTER_EGGS.find((e) => e.id === 'lambang-1-10-62');
    expect(step(createEggState(), { pos: { x: egg.at.x, z: egg.at.z } }).ids).toContain('lambang-1-10-62');
  });
  it('Kampus Biru Langit: 90 detik di kampus saat siang cerah; hujan/keluar kampus mengulang', () => {
    let s = createEggState();
    let ids = [];
    for (let i = 0; i < 8; i += 1) ({ state: s, ids } = step(s, { dt: 10, inCampus: true, hour: 11 }));
    expect(ids).not.toContain('kampus-biru-langit');
    ({ state: s, ids } = step(s, { dt: 10, inCampus: true, hour: 11 }));
    expect(ids).toContain('kampus-biru-langit');
    expect(step(s, { dt: 10, inCampus: true, hour: 11, raining: true }).state.campusTime).toBe(0);
    expect(step(createEggState(), { dt: 100, inCampus: false, hour: 11 }).ids).not.toContain('kampus-biru-langit');
    expect(step(createEggState(), { dt: 100, inCampus: true, hour: 16 }).ids).not.toContain('kampus-biru-langit');
  });
  it('Gasing berputar: satu putaran penuh mengitari GGM di dalam cincin', () => {
    const around = (k, r = 70) => {
      const a = (k / 36) * Math.PI * 2;
      return { pos: { x: GGM_RING.x + Math.cos(a) * r, z: GGM_RING.z + Math.sin(a) * r } };
    };
    let s = createEggState();
    let ids = [];
    for (let k = 0; k <= 37 && !ids.includes('gasing-berputar'); k += 1) ({ state: s, ids } = step(s, around(k)));
    expect(ids).toContain('gasing-berputar');
    let t = createEggState();
    let half = [];
    for (let k = 0; k <= 18; k += 1) ({ state: t, ids: half } = step(t, around(k)));
    expect(half).not.toContain('gasing-berputar');
    expect(step(createEggState(), around(0, 10)).state.ggmLast).toBeNull();
  });
```

Tambahkan ke `tests/storyUnri.test.js` (impor `EASTER_EGGS` dari `../src/story/easterEggs.js`, `GGM_RING` dari
`../src/story/eggTriggers.js`, `polygonCentroid` dari `../src/geo/polygon.js`):

```js
describe('easter egg kampus vs data distrik', () => {
  it('pemicu lambang ≤ 8 m dari plang N10', () => {
    const egg = EASTER_EGGS.find((e) => e.id === 'lambang-1-10-62');
    expect(Math.hypot(egg.at.x - LAMBANG_SPOT.x, egg.at.z - LAMBANG_SPOT.z)).toBeLessThanOrEqual(8);
  });
  it('pusat cincin GGM = centroid footprint GGM way/314450943 (±3 m), cincin di luar dinding', () => {
    const c = polygonCentroid(ringOf('w314450943'));
    expect(Math.hypot(c.x - GGM_RING.x, c.z - GGM_RING.z)).toBeLessThanOrEqual(3);
    expect(GGM_RING.inner).toBeGreaterThan(41);
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/storyEggTriggers.test.js tests/storyUnri.test.js`
Expected: FAIL (egg & `GGM_RING` belum ada).

- [ ] **Step 2: Data egg (`src/story/easterEggs.js`)**

Tambahkan di akhir array `EASTER_EGGS` (sesudah `jejak-3`):

```js
  // Kampus UNRI (M7). Lambang: deskripsi resmi unri.ac.id/lambang [T]; plang = [INFERENSI penempatan] (campusProps.js).
  egg({ id: 'lambang-1-10-62', title: 'Tanggal Lahir di Lambang', text: 'Lambang UNRI: Lancang Kuning dalam segi lima. 1 daun kecil + 10 daun besar = 1 Oktober; teratai 6+2 daun = 62. UNRI lahir 1 Oktober 1962.', hint: 'Plang lambang dekat Gerbang Soebrantas menyimpan tanggal lahir kampus.', at: { region: 'world', x: -1074, z: 2081, radius: 7 }, reward: { rupiah: 3000 } }),
  // Julukan "Kampus Biru Langit" dari warna almamater [T, riset §4/§6].
  egg({ id: 'kampus-biru-langit', title: 'Kampus Biru Langit', text: 'Julukan "Kampus Biru Langit" datang dari warna jas almamater UNRI. Siang cerah begini, langit dan almamater sewarna!', hint: 'Bersepedalah cukup lama di dalam kampus UNRI saat siang cerah (10.00–14.00).', trigger: 'biru-langit', reward: { rupiah: 3000 } }),
  // GGM: bentuk terinspirasi gasing, dibangun mulai 2008, lama terhenti [T, riset §2]; kondisi 2026 tidak disebut.
  egg({ id: 'gasing-berputar', title: 'Gasing Berputar', text: 'Kamu mengitari Gedung Grand Gasing Millenium, yang bentuknya terinspirasi gasing Melayu. Pembangunannya dimulai 2008 dan lama tertunda.', hint: 'Gedung bundar dekat stadion ingin diputar seperti gasing.', trigger: 'ggm-putar', reward: { rupiah: 4000 } }),
```

- [ ] **Step 3: Pemicu (`src/story/eggTriggers.js`)**

1. Tambahkan konstanta sesudah `MIDNIGHT_HALF_WINDOW_H`:

```js
const CAMPUS_DWELL = 90;                               // detik di kampus saat siang cerah
const BLUE_SKY_HOURS = Object.freeze([10, 14]);
/** GGM way/314450943: pusat footprint lingkaran Ø ±82 m (OSM → dunia) dan cincin jalur mengitari (m). */
export const GGM_RING = Object.freeze({ x: 133.1, z: 407.4, inner: 46, outer: 120 });
```

2. Ganti `createEggState`:

```js
export function createEggState() {
  return Object.freeze({ bells: Object.freeze([]), purchases: 0, rainTime: 0, campusTime: 0, ggmSweep: 0, ggmLast: null });
}

/** Sudut tersapu mengitari GGM (radian, bertanda); keluar cincin = mulai ulang. */
function stepGgm(state, pos) {
  const dx = pos.x - GGM_RING.x;
  const dz = pos.z - GGM_RING.z;
  const d = Math.hypot(dx, dz);
  if (d < GGM_RING.inner || d > GGM_RING.outer) return { ggmSweep: 0, ggmLast: null };
  const a = Math.atan2(dz, dx);
  if (state.ggmLast == null) return { ggmSweep: 0, ggmLast: a };
  const da = Math.atan2(Math.sin(a - state.ggmLast), Math.cos(a - state.ggmLast));
  return { ggmSweep: (state.ggmSweep ?? 0) + da, ggmLast: a };
}
```

3. Di `stepEggs`, JSDoc ctx tambahkan `inCampus?:boolean`. Sesudah baris `const midnight = …`, tambahkan:

```js
  const blue = ctx.inCampus === true && !ctx.raining && ctx.hour >= BLUE_SKY_HOURS[0] && ctx.hour < BLUE_SKY_HOURS[1];
  const campusTime = blue ? (state.campusTime ?? 0) + ctx.dt : 0;
  const ggm = stepGgm(state, ctx.pos);
```

   di objek `specials` tambahkan:

```js
    'biru-langit': campusTime >= CAMPUS_DWELL,
    'ggm-putar': Math.abs(ggm.ggmSweep) >= 2 * Math.PI,
```

   dan ganti kembalian menjadi `return { state: { bells, purchases, rainTime, campusTime, ...ggm }, ids };`.

- [ ] **Step 4: `inCampus` ke cerita**

1. `src/core/StoryDirector.js` `#updateEggs(dt, ctx)`: tambahkan `inCampus: Boolean(ctx.inCampus)` ke objek ctx
   `stepEggs`; JSDoc `update(dt, ctx)` tambahkan `inCampus?:boolean` ("bike di dalam batas distrik UNRI").
2. `src/main.js`: impor `import { pointInPolygon } from './geo/polygon.js';` dan
   `import { UNRI_BOUNDARY } from './districts/unri/boundary.js';`; di sistem `story` tambahkan ke ctx
   `story.update(dt, { … })`: `inCampus: pointInPolygon(ents.bike.state.x, ents.bike.state.z, UNRI_BOUNDARY),`
   (koordinat dunia sepeda).

- [ ] **Step 5: Tes lulus, lint, commit**

Run: `node node_modules/vitest/vitest.mjs run tests/storyEggTriggers.test.js tests/storyUnri.test.js tests/storyData.test.js`
Expected: PASS (teks egg ≤ 160 karakter).
Run: `npm test` lalu `npm run lint` lalu `npm run build` → hijau.
```bash
git add src/story/easterEggs.js src/story/eggTriggers.js src/core/StoryDirector.js src/main.js tests/storyEggTriggers.test.js tests/storyUnri.test.js
```
```bash
git commit -m "feat(story): easter egg kampus — lambang 1-10-62, Kampus Biru Langit, gasing berputar di GGM"
```

---

## Task 15: Perjalanan cepat ke kampus (2 tujuan)

**Files:**
- Modify: `src/app/fastTravel.js`, `src/main.js`
- Test: `tests/fastTravel.test.js`

- [ ] **Step 1: Tes yang gagal**

Tambahkan ke `tests/fastTravel.test.js` (impor `waitForRegion`, `createFastTravel` sudah diimpor):

```js
describe('tujuan kampus (M7)', () => {
  it('campus:true menambah Sekretariat Lembaga & Rektorat (dunia, menghadap utara)', () => {
    const d = travelDestinations({ manifest: null, frame: IDENTITY_FRAME, spawn: LAYOUT.spawn, campus: true });
    expect(d.map((v) => v.id)).toEqual(['stadion', 'unri-sekre', 'unri-rektorat']);
    expect(d[1]).toMatchObject({ label: 'Kampus UNRI — Sekretariat Lembaga', x: -219, z: 1130, yaw: Math.PI });
    expect(d[2]).toMatchObject({ label: 'Kampus UNRI — Rektorat', x: -979, z: 860, yaw: Math.PI });
    expect(travelDestinations({ manifest: null, frame: IDENTITY_FRAME, spawn: LAYOUT.spawn }).map((v) => v.id)).toEqual(['stadion']);
  });
  it('settle tambahan (distrik/region) ikut menentukan status', async () => {
    const bike = { state: { x: 0, z: 0, yaw: 0, v: 0 }, setCollider: () => {} };
    const screen = { show: () => {}, hide: () => {} };
    const t = createFastTravel({
      destinations: [{ id: 'a', label: 'A', x: 5, z: 5, yaw: 0 }], bike, colliders: { isWalkable: () => true }, screen, settle: async () => false,
    });
    expect(await t.go('a')).toBe('timeout');
  });
});

describe('waitForRegion', () => {
  const def = { id: 'r', placement: { x: 0, z: 0, yaw: 0 }, mask: [[-10, -10], [10, -10], [10, 10], [-10, 10]] };
  it('titik di luar region hero: langsung true', async () => {
    expect(await waitForRegion({ active: () => [] }, [def], 50, 50)).toBe(true);
  });
  it('menunggu region aktif lalu ready-nya', async () => {
    let polls = 0;
    const regions = { active: () => (polls++ >= 2 ? [{ def: { id: 'r' }, region: { ready: Promise.resolve() } }] : []) };
    expect(await waitForRegion(regions, [def], 0, 0, { sleep: async () => {} })).toBe(true);
    expect(polls).toBe(3);
  });
  it('habis waktu: false', async () => {
    let t = 0;
    const opts = { timeoutMs: 300, pollMs: 100, sleep: async (ms) => { t += ms; }, now: () => t };
    expect(await waitForRegion({ active: () => [] }, [def], 0, 0, opts)).toBe(false);
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/fastTravel.test.js` → FAIL.

- [ ] **Step 2: `src/app/fastTravel.js`**

1. Impor: `import { regionContains } from '../regions/Region.js';`
2. Komentar berkas: "(Fase 3 + M7): Stadion, Masjid Raya An-Nur, Kampus UNRI (Sekretariat Lembaga, Rektorat) …".
3. Hapus tujuan sementara dev M4 (Task 0 Step 5) bila ada.
4. Tambahkan sesudah `ANNUR_AREA_ID`:

```js
/** Tujuan kampus (dunia; spec §8.4, titik ukur §9.2 sekre-luar & rektorat), menghadap gedung (yaw π = utara). */
export const CAMPUS_DESTINATIONS = Object.freeze([
  Object.freeze({ id: 'unri-sekre', label: 'Kampus UNRI — Sekretariat Lembaga', x: -219, z: 1130, yaw: Math.PI }),
  Object.freeze({ id: 'unri-rektorat', label: 'Kampus UNRI — Rektorat', x: -979, z: 860, yaw: Math.PI }),
]);
```

5. `travelDestinations`: tanda tangan `({ manifest = null, frame, spawn, campus = false })`, JSDoc
   `campus: distrik UNRI terpasang`, dan sebelum `return out;` tambahkan
   `if (campus) out.push(...CAMPUS_DESTINATIONS.map((d) => ({ ...d })));`
6. Tambahkan:

```js
/**
 * Tunggu region hero yang menaungi (x, z) terpasang (regionManager.update memasangnya saat fokus mendekat) dan
 * `ready`-nya selesai. true bila tidak ada region hero di titik itu atau sudah siap; false bila habis waktu.
 * Penolakan `ready` diteruskan ke pemanggil (perjalanan cepat mencatatnya).
 * @param {{active(): Array<{def:{id:string}, region?:{ready?:Promise<unknown>}}>}} regions
 * @param {ReadonlyArray<{id:string, placement:object, mask:Array<[number, number]>}>} defs definisi region hero
 */
export async function waitForRegion(regions, defs, x, z, {
  timeoutMs = 20000, pollMs = 100, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => performance.now(),
} = {}) {
  const def = defs.find((d) => regionContains(d, x, z));
  if (!def) return true;
  const t0 = now();
  for (;;) {
    const hit = regions.active().find((a) => a.def.id === def.id);
    if (hit) {
      await Promise.resolve(hit.region?.ready);
      return true;
    }
    if (now() - t0 >= timeoutMs) return false;
    await sleep(pollMs);
  }
}
```

7. `createFastTravel`: tambahkan opsi `settle = null` (JSDoc: "`settle(x, z) → Promise<boolean>`: tunggu tambahan, mis.
   distrik + region hero") dan ganti baris `const settled = …` di `go()` menjadi:

```js
        const cityOk = city ? await city.whenSettled(d.x, d.z, settleRadius) : true;
        const extraOk = settle ? await settle(d.x, d.z) : true;
        const settled = cityOk && extraOk;
```

- [ ] **Step 3: Komposisi (`src/main.js`)**

1. Impor `waitForRegion` dari `./app/fastTravel.js`.
2. Pada `travelDestinations({ … })` tambahkan `campus: Boolean(<hasil mountDistrict UNRI>)`.
3. Pada `createFastTravel({ … })` tambahkan:

```js
    settle: async (x, z) => {
      const [districtOk, regionOk] = await Promise.all([
        <hasil mountDistrict UNRI>?.district.whenSettled?.(x, z) ?? true,
        waitForRegion(regionManager, heroRegions, x, z),
      ]);
      return districtOk !== false && regionOk;
    },
```

   (`heroRegions` dari Task 4; nama variabel distrik/regionManager sesuai `main.js`.) Bila `setupFastTravel` adalah
   fungsi terpisah, teruskan `settle` dan `campus` sebagai argumennya.

- [ ] **Step 4: Tes, lint, build, cek**

Run: `node node_modules/vitest/vitest.mjs run tests/fastTravel.test.js tests/fastTravelMenu.test.js` → PASS.
Run: `npm test` lalu `npm run lint` lalu `npm run build` → hijau.
Cek: dev server → tombol G menampilkan 4 tujuan; pilih "Kampus UNRI — Sekretariat Lembaga" → layar perjalanan
hilang setelah region & distrik siap, sepeda di depan sekre menghadap utara.

- [ ] **Step 5: Commit**

```bash
git add src/app/fastTravel.js src/main.js tests/fastTravel.test.js
```
```bash
git commit -m "feat(app): perjalanan cepat ke Kampus UNRI (Sekretariat Lembaga, Rektorat) menunggu distrik dan region hero"
```

---

## Task 16: Atribusi SRTM + OSM (HUD, `ATTRIBUTION.txt` distrik, README)

**Files:**
- Modify: `src/ui/Attribution.js`, `tests/attribution.test.js`, `README.md`
- Create/Modify: `public/districts/unri/ATTRIBUTION.txt` (atau generatornya di `tools/campusbake` — Task 0 Step 5)

- [ ] **Step 1: Tes HUD (gagal dulu)**

Di `tests/attribution.test.js` ganti harapan teks menjadi:

```js
    expect(el.textContent).toBe('© OpenStreetMap contributors · Overture Maps Foundation · elevasi SRTM (NASA/USGS)');
```

dan judul `it(...)` menjadi `'teks © OpenStreetMap contributors · Overture · SRTM + tautan hak cipta; dispose melepas'`.

Run: `node node_modules/vitest/vitest.mjs run tests/attribution.test.js` → FAIL.

- [ ] **Step 2: `src/ui/Attribution.js`**

```js
/**
 * Atribusi data peta (kewajiban ODbL) + sumber elevasi: teks kecil tetap di pojok HUD dengan tautan hak cipta OSM.
 * SRTM (NASA/USGS, domain publik) disebut sebagai sumber terrain distrik kampus (spec UNRI §1 butir 7, §8.4).
 * Ditampilkan hanya saat tile kota aktif.
 */
export const ATTRIBUTION = Object.freeze({
  href: 'https://www.openstreetmap.org/copyright',
  osm: 'OpenStreetMap',
  rest: ' contributors · Overture Maps Foundation · elevasi SRTM (NASA/USGS)',
});
```

(Fungsi `createAttribution` tidak berubah.)

Run: `node node_modules/vitest/vitest.mjs run tests/attribution.test.js` → PASS.

- [ ] **Step 3: `public/districts/unri/ATTRIBUTION.txt`**

Bila Task 0 Step 5 menemukan generator di `tools/campusbake` (mis. `report.js`/`index.js` menulis berkas ini), ubah
templat generator agar menghasilkan isi di bawah (nilai waktu OSM & daftar chunk dari data bake), jalankan
`npm run bake:campus -- all --offline`, dan pastikan selain `ATTRIBUTION.txt` tidak ada berkas data yang berubah
(`git status --short public/districts/unri`). Bila tidak ada generator, tulis berkas ini langsung:

```text
Data distrik Kampus UNRI Bina Widya (public/districts/unri) adalah karya turunan dari:

  © OpenStreetMap contributors — https://www.openstreetmap.org/copyright
    poligon kampus way/938374562, gedung, jalan, trotoar/selasar, parkir, air, tata guna lahan
    Lisensi: Open Database License (ODbL) 1.0 — https://opendatacommons.org/licenses/odbl/1-0/

  SRTM 1 Arc-Second Global (SRTMGL1, NASA/USGS; perekaman Februari 2000), ubin N00E101
    Domain publik; disebut sebagai sumber elevasi terrain — https://doi.org/10.5067/MEaSUREs/SRTM/SRTMGL1.003

File *.json dan *.bin di direktori ini tunduk pada ODbL untuk bagian yang berasal dari OSM; elevasi SRTM domain
publik. Kode proyek tetap berlisensi MIT.

Catatan: Halte Trans Metro Pekanbaru (OSM node 4559431711 dan 4559433677, Jl. HR Soebrantas, ±600 m barat
Gerbang Soebrantas) berada di luar batas distrik sehingga tidak dipasang (model P02 tersedia di
public/models/unri/p02-halte-tmp.glb).

Dihasilkan oleh tools/campusbake (npm run bake:campus -- all).
```

- [ ] **Step 4: README bagian atribusi**

Di `README.md` bagian `## Data peta & atribusi`, tambahkan paragraf sesudah paragraf yang ada:

```markdown
Kawasan Kampus UNRI Bina Widya (`public/districts/unri/`) di-bake oleh `tools/campusbake` (`npm run bake:campus -- all`)
dari © OpenStreetMap contributors (ODbL 1.0) dan elevasi **SRTM 1 Arc-Second Global (NASA/USGS, domain publik)**; rincian
di `public/districts/unri/ATTRIBUTION.txt`. Atribusi OSM + SRTM juga tampil di pojok kiri bawah layar.
```

dan di bagian `## Lisensi` tambahkan kalimat: "Data distrik kampus (`public/districts/unri/`): ODbL 1.0 untuk bagian
OSM; elevasi SRTM domain publik."

- [ ] **Step 5: Lint & commit**

Run: `npm test` lalu `npm run lint` → hijau.
```bash
git add src/ui/Attribution.js tests/attribution.test.js public/districts/unri/ATTRIBUTION.txt README.md
```
(Bila generator campusbake diubah, tambahkan juga berkas generatornya ke `git add`.)
```bash
git commit -m "docs: atribusi SRTM dan OSM untuk distrik kampus (HUD, ATTRIBUTION.txt, README)"
```

---

## Task 17: Perluasan E2E (`tests/e2e/smoke.e2e.mjs`): titik ukur §9.2, rute kampus, siklus 3×, fast travel, budget §9.1

**Files:**
- Modify: `tests/e2e/smoke.e2e.mjs`

Semua fungsi `PAGE.*` dievaluasi di halaman (diserialisasi Playwright) sehingga tidak boleh merujuk variabel Node;
helper kampus dipasang sekali di `window.__e2eKampus` oleh `PAGE.installKampus`.

- [ ] **Step 1: Kepala berkas, impor, batas, konstanta kampus, opsi**

1. Ganti komentar pembuka (baris `/** Smoke test E2E Plan C …`) menjadi:

```js
/**
 * Smoke test E2E Plan C + Kampus UNRI M7 — TIDAK ikut `vitest run` (nama bukan *.test.js).
 *   node tests/e2e/smoke.e2e.mjs [--gpu swiftshader|d3d11] [--out laporan.json] [--skip-ride] [--skip-campus] [--only-campus]
 * Menjalankan Vite (port 5174) dari root repo, Chromium headless 1280×720 lewat paket `playwright` global
 * (npm i -g playwright; atau PLAYWRIGHT_PATH), lalu memeriksa:
 *   Kota (Plan C): 1. muat tanpa galat konsol; 2. draw call tile ≤ 150; 3. mount/unmount region stadion 3× →
 *   memori GPU kembali ke baseline; 4. rute sepeda 1,5 km ke 3 arah, hitch p95 < 50 ms (hanya --gpu d3d11);
 *   5. perjalanan cepat ke Masjid Raya An-Nur lalu kembali (kendaraan mangkal tetap, tidak terduplikasi).
 *   Kampus (spec UNRI §9, §11): titik ukur §9.2 (draw call/segitiga total, distrik, region hero, interior sekre,
 *   hitch); rute sepeda stadion → sekre ±1,15 km tanpa galat konsol + tanah tanpa jahitan; masuk/keluar sekre 3× dan
 *   mount/unmount region unri-lembaga 3× → memori kembali ke baseline; perjalanan cepat ke 2 tujuan kampus;
 *   ukuran data distrik & GLB kampus; tabel budget §9.1 (stderr + laporan JSON `budget`).
 * Exit code 0 = semua lulus. Kemajuan per tahap ditulis ke stderr, laporan JSON ke stdout.
 */
```

2. Ganti `import { writeFileSync } from 'node:fs';` dengan
   `import { writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';`

3. Ganti `const LIMITS = …` dengan:

```js
const LIMITS = Object.freeze({
  tileCalls: 150, hitchP95Ms: 50, rideSpeed: 25, rideMeters: 1500,
  // spec UNRI §9.1
  districtCalls: 180, regionCalls: 250, totalCalls: 1000, districtTris: 600000,
  interiorCalls: 150, interiorTris: 150000, districtBytes: 8 * 1024 * 1024, glbBytes: 6 * 1024 * 1024,
  // rute kampus: kecepatan sepeda cepat (m/s) dan lompatan tinggi tanah maks per 2 m (jahitan/tebing)
  campusRideSpeed: 12, routeMaxJumpPer2m: 0.2, fastTravelDistance: 60,
});
/** Titik ukur spec UNRI §9.2 (dunia; yaw maju = (sin, cos)). `masjid` digeser keluar footprint (keputusan D11). */
const CAMPUS_POINTS = Object.freeze([
  { id: 'stadion-pusat', x: 0, z: 0, yaw: 0 },
  { id: 'jalan-stadion-kampus', x: -1, z: 500, yaw: 0 },
  { id: 'sekre-luar', x: -219, z: 1130, yaw: Math.PI },
  { id: 'interior-sekre', x: -219, z: 1130, yaw: Math.PI, interior: 'sekre' },
  { id: 'rektorat', x: -979, z: 860, yaw: Math.PI },
  { id: 'masjid', x: -1009, z: 1405, yaw: Math.PI },
]);
/** Rute sepeda stadion → sekre (±1,15 km): Jl. Stadion Utama, Jl. Muchtar Lutfi, jogging track Stadion Mini (OSM). */
const CAMPUS_ROUTE = Object.freeze([
  [0, 120], [-2, 272], [-2, 408], [0, 645], [0, 689], [-156, 706], [-150, 801], [-139, 959], [-138, 998],
  [-146, 1029], [-164, 1054], [-196, 1077], [-220, 1082],
]);
const CAMPUS_TRAVEL = Object.freeze([{ id: 'unri-sekre', x: -219, z: 1130 }, { id: 'unri-rektorat', x: -979, z: 860 }]);
```

4. Ganti blok `parseArgs({ options: { … } })` dengan:

```js
const { values: opts } = parseArgs({
  options: {
    gpu: { type: 'string', default: 'swiftshader' },
    out: { type: 'string' },
    'skip-ride': { type: 'boolean', default: false },
    'skip-campus': { type: 'boolean', default: false },
    'only-campus': { type: 'boolean', default: false },
  },
});
```

- [ ] **Step 2: Alur `main()`**

Di `main()`, ganti baris mulai `report.checks.load = await step('prepare', …)` sampai
`report.checks.fastTravelBack = …` dengan:

```js
    report.checks.load = await step('prepare', () => page.evaluate(PAGE.prepare));
    if (!opts['only-campus']) {
      report.checks.tileCalls = await step('tileCalls', () => page.evaluate(PAGE.tileCalls));
      report.checks.parity = await step('parity', () => page.evaluate(PAGE.parity));
      report.checks.memory = await step('memoryCycle', () => page.evaluate(PAGE.memoryCycle));
      if (!opts['skip-ride']) report.checks.ride = await step('ride', () => page.evaluate(PAGE.ride, LIMITS));
      report.checks.fastTravel = await step('fastTravel', () => page.evaluate(PAGE.fastTravel));
      report.checks.tileCallsAnNur = await step('tileCallsAnNur', () => page.evaluate(PAGE.tileCalls));
      report.checks.fastTravelBack = await step('fastTravelBack', () => page.evaluate(PAGE.fastTravelBack));
    }
    if (!opts['skip-campus']) await runCampus(page, step, report);
```

dan sesudah blok `try { … } finally { … }` (sebelum `const fails = verdict(report);`) tambahkan:

```js
  if (!opts['skip-campus']) {
    report.budget = budgetTable(report);
    printBudget(report.budget, report.gpu);
  }
```

Tambahkan fungsi berikut di bawah `main()`:

```js
/** Tahap kampus (spec UNRI §9.2, §11). */
async function runCampus(page, step, report) {
  report.checks.campusData = campusDataSizes();
  await step('tunggu kampus', () => page.waitForFunction(
    () => window.__sim?.district && window.__sim.regions && window.__sim.portal && window.__sim.regionIdAt, null, { timeout: 240000 },
  ));
  await page.evaluate(PAGE.installKampus);
  report.checks.campusPoints = [];
  for (const p of CAMPUS_POINTS) report.checks.campusPoints.push(await step(`titik ${p.id}`, () => page.evaluate(PAGE.campusPoint, p)));
  if (!opts['skip-ride']) {
    const before = report.errors.length;
    report.checks.campusRide = await step('rute stadion → sekre', () => page.evaluate(PAGE.campusRide, { route: CAMPUS_ROUTE, speed: LIMITS.campusRideSpeed }));
    report.checks.campusRide.consoleErrors = report.errors.length - before;
  }
  report.checks.interiorCycle = await step('siklus interior 3×', () => page.evaluate(PAGE.interiorCycle));
  report.checks.regionCycle = await step('siklus region 3×', () => page.evaluate(PAGE.regionCycle));
  report.checks.fastTravelCampus = await step('perjalanan cepat kampus', () => page.evaluate(PAGE.fastTravelCampus, CAMPUS_TRAVEL));
}

/** Ukuran berkas (byte) rekursif. */
function dirBytes(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .reduce((n, e) => n + (e.isDirectory() ? dirBytes(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
}

/** Data distrik (terrain + ground + buildings.json + manifest) dan total GLB kampus baru (spec §9.1). */
function campusDataSizes() {
  const district = join(ROOT, 'public', 'districts', 'unri');
  const models = join(ROOT, 'public', 'models', 'unri');
  return {
    districtBytes: existsSync(district) ? dirBytes(district) : null,
    glbBytes: existsSync(models)
      ? readdirSync(models).filter((f) => f.endsWith('.glb')).reduce((s, f) => s + statSync(join(models, f)).size, 0)
      : null,
  };
}

/** Tabel budget spec §9.1 dari laporan (nilai maks antar titik ukur). */
function budgetTable(r) {
  const c = r.checks;
  const pts = (c.campusPoints ?? []).filter((p) => !p.interior);
  const inter = (c.campusPoints ?? []).find((p) => p.interior);
  const max = (key) => (pts.length ? Math.max(...pts.map((p) => p[key])) : null);
  const regionMax = pts.length ? Math.max(0, ...pts.flatMap((p) => p.regions.map((g) => g.calls))) : null;
  const hitch = [...(c.campusPoints ?? []).map((p) => p.hitchP95), c.campusRide?.hitchP95].filter(Number.isFinite);
  const rows = [
    { metrik: 'Draw call distrik (terrain+ground+gedung+vegetasi)', batas: LIMITS.districtCalls, nilai: max('districtCalls') },
    { metrik: 'Draw call region hero aktif (maks)', batas: LIMITS.regionCalls, nilai: regionMax },
    { metrik: 'Draw call total', batas: LIMITS.totalCalls, nilai: max('totalCalls') },
    { metrik: 'Segitiga terlihat distrik', batas: LIMITS.districtTris, nilai: max('districtTris') },
    { metrik: 'Data distrik (byte)', batas: LIMITS.districtBytes, nilai: c.campusData?.districtBytes ?? null },
    { metrik: 'GLB kampus total (byte)', batas: LIMITS.glbBytes, nilai: c.campusData?.glbBytes ?? null },
    { metrik: 'Interior sekre draw call', batas: LIMITS.interiorCalls, nilai: inter?.calls ?? null },
    { metrik: 'Interior sekre segitiga', batas: LIMITS.interiorTris, nilai: inter?.tris ?? null },
    { metrik: 'Hitch p95 (ms, maks; hanya d3d11)', batas: LIMITS.hitchP95Ms, nilai: hitch.length ? Math.max(...hitch) : null },
  ];
  return rows.map((row) => ({
    ...row,
    lulus: row.nilai != null && (row.metrik.startsWith('Hitch') ? row.nilai < row.batas : row.nilai <= row.batas),
  }));
}

function printBudget(rows, gpu) {
  process.stderr.write(`[e2e] Budget spec UNRI §9.1 (gpu ${gpu}):\n`);
  for (const r of rows) process.stderr.write(`  ${r.lulus ? 'LULUS' : 'GAGAL'}  ${r.metrik}: ${r.nilai ?? '-'} (batas ${r.batas})\n`);
}
```

- [ ] **Step 3: `verdict` dipisah kota/kampus**

Ganti seluruh fungsi `verdict(r)` dengan:

```js
/** Daftar kegagalan dari laporan. */
function verdict(r) {
  const f = [];
  if (r.errors.length) f.push(`galat konsol: ${r.errors.length}`);
  if (!r.checks.load?.settled) f.push('tile sekitar stadion tidak selesai dimuat');
  if (!opts['only-campus']) f.push(...verdictCity(r));
  if (!opts['skip-campus']) f.push(...verdictCampus(r));
  return f;
}

/** Pemeriksaan kota Plan C (isi lama, tidak berubah). */
function verdictCity(r) {
  const f = [];
  const c = r.checks;
  if (!(c.tileCalls?.calls <= LIMITS.tileCalls)) f.push(`draw call tile ${c.tileCalls?.calls} > ${LIMITS.tileCalls}`);
  if (!(c.tileCallsAnNur?.calls <= LIMITS.tileCalls)) f.push(`draw call tile An-Nur ${c.tileCallsAnNur?.calls} > ${LIMITS.tileCalls}`);
  const m = c.memory;
  const back = (v) => v.geometries === m.baseline.geometries && v.textures === m.baseline.textures;
  if (!m || !m.cycles.every(back)) f.push(`memori tidak kembali ke baseline: ${JSON.stringify(m)}`);
  if (c.ride && r.gpu === 'd3d11' && !(c.ride.hitchP95 < LIMITS.hitchP95Ms)) f.push(`hitch p95 ${c.ride.hitchP95} ms ≥ ${LIMITS.hitchP95Ms}`);
  if (c.ride && c.ride.failedTiles > 0) f.push(`tile gagal saat rute: ${c.ride.failedTiles}`);
  if (!c.fastTravel?.ok || !(c.fastTravel.distance < 250)) f.push(`perjalanan cepat An-Nur gagal: ${JSON.stringify(c.fastTravel)}`);
  const ret = c.fastTravelBack;
  if (!ret?.ok || !(ret.vehicles > 0) || ret.vehicles !== c.fastTravel?.vehiclesBefore) {
    f.push(`kembali ke stadion / kendaraan mangkal: ${JSON.stringify({ ret, before: c.fastTravel?.vehiclesBefore })}`);
  }
  return f;
}

/** Pemeriksaan kampus (spec UNRI §1 butir 1, 4, 5; §9; §11). */
function verdictCampus(r) {
  const f = [];
  const c = r.checks;
  const d = c.campusData;
  if (!(d?.districtBytes <= LIMITS.districtBytes)) f.push(`data distrik ${d?.districtBytes} B > ${LIMITS.districtBytes}`);
  if (!(d?.glbBytes <= LIMITS.glbBytes)) f.push(`GLB kampus ${d?.glbBytes} B > ${LIMITS.glbBytes}`);
  for (const p of c.campusPoints ?? []) {
    if (p.interior) {
      if (!p.entered || !p.exited) f.push(`${p.id}: masuk/keluar sekre gagal`);
      if (!p.bikeKept) f.push(`${p.id}: sepeda berpindah setelah keluar sekre`);
      if (!(p.calls <= LIMITS.interiorCalls)) f.push(`${p.id}: draw call ${p.calls} > ${LIMITS.interiorCalls}`);
      if (!(p.tris <= LIMITS.interiorTris)) f.push(`${p.id}: segitiga ${p.tris} > ${LIMITS.interiorTris}`);
    } else {
      if (!p.mounted) f.push(`${p.id}: region ${p.region} tidak terpasang`);
      if (!(p.totalCalls <= LIMITS.totalCalls)) f.push(`${p.id}: draw call total ${p.totalCalls} > ${LIMITS.totalCalls}`);
      if (!(p.districtCalls <= LIMITS.districtCalls)) f.push(`${p.id}: draw call distrik ${p.districtCalls} > ${LIMITS.districtCalls}`);
      if (!(p.districtTris <= LIMITS.districtTris)) f.push(`${p.id}: segitiga distrik ${p.districtTris} > ${LIMITS.districtTris}`);
      for (const g of p.regions) if (!(g.calls <= LIMITS.regionCalls)) f.push(`${p.id}: draw call region ${g.id} ${g.calls} > ${LIMITS.regionCalls}`);
    }
    if (r.gpu === 'd3d11' && !(p.hitchP95 < LIMITS.hitchP95Ms)) f.push(`${p.id}: hitch p95 ${p.hitchP95} ms ≥ ${LIMITS.hitchP95Ms}`);
  }
  const ride = c.campusRide;
  if (ride) {
    if (ride.consoleErrors > 0) f.push(`rute kampus: ${ride.consoleErrors} galat konsol`);
    if (ride.failedTiles > 0) f.push(`rute kampus: tile gagal ${ride.failedTiles}`);
    if (!(ride.maxGroundJump <= LIMITS.routeMaxJumpPer2m)) f.push(`rute kampus: lompatan tanah ${ride.maxGroundJump} m per 2 m > ${LIMITS.routeMaxJumpPer2m}`);
    if (r.gpu === 'd3d11' && !(ride.hitchP95 < LIMITS.hitchP95Ms)) f.push(`rute kampus: hitch p95 ${ride.hitchP95} ms`);
  }
  const back = (m) => (v) => v.geometries === m.baseline.geometries && v.textures === m.baseline.textures;
  const ic = c.interiorCycle;
  if (!ic || !ic.cycles.every((v) => v.entered && v.exited) || !ic.cycles.every(back(ic))) f.push(`siklus interior 3×: ${JSON.stringify(ic)}`);
  const rc = c.regionCycle;
  if (!rc || !rc.cycles.every((v) => v.unmounted && v.mounted) || !rc.cycles.every(back(rc))) f.push(`siklus region 3×: ${JSON.stringify(rc)}`);
  for (const t of CAMPUS_TRAVEL) {
    const v = c.fastTravelCampus?.[t.id];
    const regionOk = !v?.regionHere || v.mounted.includes(v.regionHere);
    if (!v || v.status !== 'ok' || !(v.distance <= LIMITS.fastTravelDistance) || !v.walkable || !regionOk) f.push(`perjalanan cepat ${t.id}: ${JSON.stringify(v)}`);
  }
  if (c.fastTravelCampus && c.fastTravelCampus.back !== 'ok') f.push(`kembali dari kampus ke stadion: ${c.fastTravelCampus.back}`);
  return f;
}
```

- [ ] **Step 4: Fungsi halaman kampus (`PAGE`)**

1. Di `PAGE.memoryCycle` → `warmHumanoids`, tepat sesudah `if (!info) return;` tambahkan
   `force(o, 'visible', true); // kolam mahasiswa M7 (grup tersembunyi) ikut terunggah ke GPU`.
2. Tambahkan entri berikut ke objek `PAGE` (sebelum `};` penutupnya):

```js
  /** Helper kampus di window.__e2eKampus (fungsi PAGE diserialisasi; tidak berbagi closure Node). */
  installKampus() {
    const s = window.__sim;
    const raf = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (fn, timeoutMs) => {
      const t0 = performance.now();
      while (performance.now() - t0 < timeoutMs) {
        if (fn()) return true;
        await sleep(100);
      }
      return Boolean(fn());
    };
    const k = {
      raf, sleep, until,
      async settle(x, z, yaw) {
        s.teleport(x, z, yaw);
        await raf();
        if (s.city) await s.city.whenSettled(x, z, 1000, 90000);
        if (s.district?.whenSettled) await s.district.whenSettled(x, z);
        const id = s.regionIdAt(x, z);
        const mounted = id ? await until(() => s.regions.active().some((a) => a.def.id === id), 30000) : true;
        const hit = id ? s.regions.active().find((a) => a.def.id === id) : null;
        if (hit) await Promise.resolve(hit.region?.ready);
        if (s.scheduler?.whenIdle) await s.scheduler.whenIdle();
        await sleep(1500);
        return { region: id, mounted };
      },
      draw() {
        s.app.renderFrame();
        const i = s.app.renderer.info.render;
        return { calls: i.calls, tris: i.triangles };
      },
      hidden(objs, fn) {
        const saved = objs.map((o) => [o, o.visible]);
        objs.forEach((o) => { o.visible = false; });
        try {
          return fn();
        } finally {
          saved.forEach(([o, v]) => { o.visible = v; });
        }
      },
      /** Draw call & segitiga: total, distrik inti (tanpa kehidupan kampus), kehidupan kampus, per region hero. */
      measure() {
        const all = k.draw();
        const life = s.district.life?.group;
        const noLife = life ? k.hidden([life], k.draw) : all;
        const noDistrict = k.hidden([s.district.group], k.draw);
        const regions = s.regions.active().filter((a) => a.def.id !== 'stadion').map((a) => {
          const r = k.hidden([a.region.group], k.draw);
          return { id: a.def.id, calls: all.calls - r.calls, tris: all.tris - r.tris };
        });
        return {
          totalCalls: all.calls, totalTris: all.tris,
          districtCalls: noLife.calls - noDistrict.calls, districtTris: noLife.tris - noDistrict.tris,
          lifeCalls: all.calls - noLife.calls, lifeTris: all.tris - noLife.tris, regions,
        };
      },
      async p95(n = 120) {
        const d = [];
        let last = performance.now();
        for (let i = 0; i < n; i += 1) {
          await new Promise((r) => requestAnimationFrame(r));
          const now = performance.now();
          d.push(now - last);
          last = now;
        }
        d.sort((a, b) => a - b);
        return Math.round(d[Math.min(d.length - 1, Math.floor(0.95 * d.length))]);
      },
      warmHumanoids() {
        const saved = [];
        const force = (o, key, value) => { saved.push([o, key, o[key]]); o[key] = value; };
        s.app.scene.traverse((o) => {
          const info = o.userData?.humanoidLod;
          if (!info) return;
          force(o, 'visible', true);
          for (const part of [info.body, info.mesh]) {
            force(part, 'visible', true);
            part.traverse((m) => { if (m.isMesh) force(m, 'frustumCulled', false); });
          }
        });
        s.app.renderFrame();
        for (let i = saved.length - 1; i >= 0; i -= 1) saved[i][0][saved[i][1]] = saved[i][2];
      },
      async snap() {
        k.warmHumanoids();
        for (let i = 0; i < 5; i += 1) await raf();
        const m = s.app.renderer.info.memory;
        return { geometries: m.geometries, textures: m.textures };
      },
      async enterSekre() {
        s.portal.enter('sekre');
        return until(() => s.portal.state === 'inside', 15000);
      },
      async exitSekre() {
        s.portal.exit();
        return until(() => s.portal.state === 'outside', 15000);
      },
    };
    window.__e2eKampus = k;
    return true;
  },
  /** Satu titik ukur §9.2: luar = draw call/segitiga per lapisan + hitch; interior = draw call/segitiga sekre. */
  async campusPoint(p) {
    const s = window.__sim;
    const k = window.__e2eKampus;
    const at = await k.settle(p.x, p.z, p.yaw);
    if (p.interior) {
      const bike = { x: s.ents.bike.state.x, z: s.ents.bike.state.z };
      const entered = await k.enterSekre();
      await k.sleep(1000);
      const m = k.draw();
      const hitchP95 = await k.p95();
      const exited = await k.exitSekre();
      const b = s.ents.bike.state;
      return {
        id: p.id, interior: true, entered, exited, calls: m.calls, tris: m.tris, hitchP95,
        bikeKept: Math.hypot(b.x - bike.x, b.z - bike.z) < 0.5,
      };
    }
    return { id: p.id, ...at, ...k.measure(), hitchP95: await k.p95(), life: s.district.life?.students?.stats ?? null };
  },
  /** Rute sepeda stadion → sekre (posisi diset per frame); tinggi tanah dicatat tiap 2 m selama rute (jahitan). */
  async campusRide({ route, speed }) {
    const s = window.__sim;
    const k = window.__e2eKampus;
    const cum = [0];
    for (let i = 1; i < route.length; i += 1) cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
    const total = cum[cum.length - 1];
    const at = (d) => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i += 1;
      const a = route[i - 1];
      const b = route[i];
      const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    };
    const p0 = at(0);
    await k.settle(p0.x, p0.z, p0.yaw);
    const deltas = [];
    let maxJump = 0;
    let prevY = null;
    let nextMark = 0;
    await new Promise((resolve) => {
      let last = performance.now();
      let dist = 0;
      const tick = (now) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        deltas.push(now - last);
        last = now;
        dist += speed * dt;
        const p = at(Math.min(dist, total));
        s.ents.bike.state = { ...s.ents.bike.state, x: p.x, z: p.z, yaw: p.yaw, v: 0 };
        while (nextMark <= Math.min(dist, total)) {
          const q = at(nextMark);
          const y = s.terrain?.heightAt(q.x, q.z) ?? 0;
          if (prevY !== null) maxJump = Math.max(maxJump, Math.abs(y - prevY));
          prevY = y;
          nextMark += 2;
        }
        if (dist < total) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const sorted = [...deltas].sort((a, b) => a - b);
    return {
      meters: Math.round(total), frames: deltas.length, hitchP95: Math.round(sorted[Math.floor(0.95 * sorted.length)]),
      maxMs: Math.round(sorted[sorted.length - 1]), maxGroundJump: Number(maxJump.toFixed(2)), failedTiles: s.city?.stats().failed ?? 0,
    };
  },
  /** Masuk/keluar sekre 3× setelah satu siklus pemanasan → memori GPU kembali ke baseline (spec §9.1). */
  async interiorCycle() {
    const k = window.__e2eKampus;
    await k.settle(-219, 1130, Math.PI);
    const cycle = async () => {
      const entered = await k.enterSekre();
      await k.sleep(800);
      const exited = await k.exitSekre();
      await k.sleep(500);
      return { entered, exited, ...(await k.snap()) };
    };
    const initial = await k.snap();
    await cycle(); // pemanasan: aset interior pernah dimuat sekali
    const baseline = await k.snap();
    const cycles = [];
    for (let i = 0; i < 3; i += 1) cycles.push(await cycle());
    return { initial, baseline, cycles };
  },
  /** Region unri-lembaga dilepas (fokus jauh) lalu dipasang ulang 3× → memori di titik yang sama kembali ke baseline. */
  async regionCycle() {
    const s = window.__sim;
    const k = window.__e2eKampus;
    const home = [-219, 1130, Math.PI];
    const away = [0, -275, 0];
    const lembagaActive = () => s.regions.active().some((a) => a.def.id === 'unri-lembaga');
    const cycle = async () => {
      await k.settle(...away);
      const unmounted = await k.until(() => !lembagaActive(), 20000);
      await k.settle(...home);
      return { unmounted, mounted: lembagaActive(), ...(await k.snap()) };
    };
    await k.settle(...home);
    await cycle(); // pemanasan: semua jalur muat/lepas (tile, chunk distrik, region) pernah dilalui sekali
    const baseline = await k.snap();
    const cycles = [];
    for (let i = 0; i < 3; i += 1) cycles.push(await cycle());
    return { baseline, cycles };
  },
  /** Perjalanan cepat ke 2 tujuan kampus lalu kembali ke stadion. */
  async fastTravelCampus(targets) {
    const s = window.__sim;
    const out = {};
    for (const t of targets) {
      const t0 = performance.now();
      const status = await s.fastTravel(t.id);
      await new Promise((r) => setTimeout(r, 1500));
      const b = s.ents.bike.state;
      out[t.id] = {
        status, travelMs: Math.round(performance.now() - t0), distance: Math.round(Math.hypot(b.x - t.x, b.z - t.z)),
        walkable: s.colliders.isWalkable(b.x, b.z), regionHere: s.regionIdAt(t.x, t.z), mounted: s.regions.active().map((a) => a.def.id),
      };
    }
    out.back = await s.fastTravel('stadion');
    return out;
  },
```

- [ ] **Step 5: Lint & uji cepat SwiftShader (tanpa GPU)**

Run: `npm run lint` → 0 galat.
Run: `npm run e2e -- --gpu swiftshader --only-campus --skip-ride --out %TEMP%\e2e-m7-sw.json`
Expected: berjalan sampai selesai (SwiftShader lambat; draw call/segitiga/memori/fast travel bermakna, hitch tidak).
Laporan JSON berisi `checks.campusPoints` (6 entri), `interiorCycle`, `regionCycle`, `fastTravelCampus`, `budget`.
Kegagalan di tahap ini = bug fungsional; perbaiki dulu (Task 18 Step 2) sebelum mengukur dengan GPU.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/smoke.e2e.mjs
```
```bash
git commit -m "test(e2e): titik ukur kampus §9.2, rute stadion ke sekre, siklus interior dan region 3x, perjalanan cepat kampus, tabel budget §9.1"
```

---

## Task 18: Jalankan E2E GPU + mitigasi §9.3 berurutan (kondisional)

**Files:**
- Modify (kondisional): konstanta LOD0 di `src/districts/unri/buildingClusters.js`, `src/districts/unri/motorParking.js`,
  `src/districts/unri/students.js`, konstanta kepadatan di `src/districts/unri/vegetation.js`
- Create (kondisional): `src/app/stadionDetail.js`, `tests/stadionDetail.test.js`; Modify (kondisional): `src/main.js`

- [ ] **Step 1: E2E penuh dengan GPU**

Run: `npm run e2e -- --gpu d3d11 --out %TEMP%\e2e-m7.json`
Expected: exit code 0; stderr memuat tabel "Budget spec UNRI §9.1" dengan semua baris `LULUS`; `fails: []`.
Simpan angka tabel budget dan hitch untuk laporan, status indeks (Task 20), dan badan PR (Task 21).

- [ ] **Step 2: Kegagalan fungsional (bukan budget)**

Bila `fails` memuat galat konsol, memori siklus tidak kembali, region tidak terpasang/terlepas, perjalanan cepat
gagal, atau lompatan tanah > 0,2 m: pakai skill superpowers:systematic-debugging, perbaiki di berkas penyebab, tambah
tes bila logika murni, commit `fix(<lingkup>): <ringkasan>`, ulangi Step 1. Ini bukan mitigasi §9.3.

Petunjuk umum: memori interior/region naik → cari sumber daya yang dibuat di luar `withScope(scope, …)` atau tidak
dilepas di `dispose`/`removeGroundChunk` (motor `BatchedMesh.dispose`, bangku `InstancedMesh`); galat HTTP 404 → GLB
yang `path`-nya tidak ada (pakai `null`).

- [ ] **Step 3: Mitigasi langkah 1 — radius LOD0 kit (hanya bila budget draw call/segitiga/hitch GAGAL)**

Di `src/districts/unri/buildingClusters.js`, turunkan konstanta radius LOD0 (nama dari Task 0 Step 5; nilai spec
250 m) menjadi `180`. Ulangi Step 1. Bila lulus:

```bash
git add src/districts/unri/buildingClusters.js
```
```bash
git commit -m "perf(unri): radius LOD0 kit gedung 250 ke 180 m (mitigasi spec §9.3 langkah 1)"
```

- [ ] **Step 4: Mitigasi langkah 2 — kepadatan motor/vegetasi (bila masih GAGAL)**

1. `src/districts/unri/motorParking.js`: `export const MOTOR_DENSITY_SCALE = 0.6;`
2. `src/districts/unri/students.js`: `export const STUDENT_POOL = 28;`
3. `src/districts/unri/vegetation.js`: cari konstanta kepadatan (`grep -n "DENSITY\|density\|PER_CELL" src/districts/unri/vegetation.js`)
   dan kalikan 0,7 (bulatkan bila bilangan bulat).

Ulangi Step 1. Bila lulus:

```bash
git add src/districts/unri/motorParking.js src/districts/unri/students.js src/districts/unri/vegetation.js
```
```bash
git commit -m "perf(unri): kurangi kepadatan motor, mahasiswa, dan vegetasi distrik (mitigasi spec §9.3 langkah 2)"
```

- [ ] **Step 5: Mitigasi langkah 3 — `setDetail('far')` stadion (bila masih GAGAL)**

Buat `tests/stadionDetail.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { stadionDetailLevel, createStadionDetail, STADION_FAR, STADION_NEAR } from '../src/app/stadionDetail.js';

describe('stadionDetailLevel', () => {
  it('far di luar 600 m, kembali near di bawah 560 m (histeresis)', () => {
    expect(stadionDetailLevel('near', { x: 0, z: STADION_FAR - 1 })).toBe('near');
    expect(stadionDetailLevel('near', { x: 0, z: STADION_FAR + 1 })).toBe('far');
    expect(stadionDetailLevel('far', { x: 0, z: STADION_NEAR + 10 })).toBe('far');
    expect(stadionDetailLevel('far', { x: 0, z: STADION_NEAR - 1 })).toBe('near');
  });
});

describe('createStadionDetail', () => {
  it('menyembunyikan penonton & kursi saat jauh dan menerapkan ulang ke grup region baru', () => {
    const crowd = { group: { visible: true } };
    const kursiA = { visible: true };
    const kursiB = { visible: true };
    let root = { getObjectByName: (n) => (n === 'kursi' ? kursiA : null) };
    const d = createStadionDetail({ crowd, regionGroup: () => root });
    d.update({ x: 0, z: 1000 });
    expect(d.level).toBe('far');
    expect(crowd.group.visible).toBe(false);
    expect(kursiA.visible).toBe(false);
    root = { getObjectByName: (n) => (n === 'kursi' ? kursiB : null) };
    d.update({ x: 0, z: 1000 });
    expect(kursiB.visible).toBe(false);
    d.update({ x: 0, z: 0 });
    expect(crowd.group.visible).toBe(true);
    expect(kursiB.visible).toBe(true);
  });
});
```

Buat `src/app/stadionDetail.js`:

```js
/**
 * Mitigasi spec UNRI §9.3 langkah 3: `setDetail('far')` stadion — penonton (crowd) dan kursi tribun (grup 'kursi')
 * disembunyikan saat fokus > STADION_FAR m dari pusat stadion (kembali di bawah STADION_NEAR, histeresis).
 * Dipasang hanya bila langkah 1–2 belum memenuhi budget §9.1.
 */
export const STADION_FAR = 600;
export const STADION_NEAR = 560;

/** Level detail murni dengan histeresis. @returns {'near'|'far'} */
export function stadionDetailLevel(prev, focus, center = { x: 0, z: 0 }) {
  const d = Math.hypot(focus.x - center.x, focus.z - center.z);
  if (prev === 'far') return d < STADION_NEAR ? 'near' : 'far';
  return d > STADION_FAR ? 'far' : 'near';
}

/**
 * @param {{crowd?: {group: {visible: boolean}}|null, regionGroup: () => ({getObjectByName(n: string): object|undefined}|null)}} deps
 */
export function createStadionDetail({ crowd = null, regionGroup }) {
  let level = 'near';
  let appliedTo = null;
  const apply = () => {
    const far = level === 'far';
    if (crowd) crowd.group.visible = !far;
    const root = regionGroup();
    const kursi = root?.getObjectByName('kursi');
    if (kursi) kursi.visible = !far;
    appliedTo = root;
  };
  return {
    get level() { return level; },
    /** @param {{x:number, z:number}|null} focus titik dunia */
    update(focus) {
      if (!focus) return;
      const next = stadionDetailLevel(level, focus);
      if (next !== level) {
        level = next;
        apply();
      } else if (regionGroup() !== appliedTo) {
        apply(); // region stadion dipasang ulang: terapkan ke grup baru
      }
    },
  };
}
```

Di `src/main.js`: impor `createStadionDetail` dan, sesudah entitas dibuat, tambahkan (nama `regionManager` sesuai
main.js; pusat stadion = origin dunia):

```js
  const stadionDetail = createStadionDetail({
    crowd: ents.crowd,
    regionGroup: () => regionManager.active().find((a) => a.def.id === 'stadion')?.region.group ?? null,
  });
  app.addSystem({ id: 'stadionDetail', phase: 'world', update: (dt, ctx) => stadionDetail.update(ctx.focus ?? ctx.bikePos) });
```

Run: `node node_modules/vitest/vitest.mjs run tests/stadionDetail.test.js` → PASS; `npm test`, `npm run lint`,
`npm run build` → hijau; ulangi Step 1. Bila lulus:

```bash
git add src/app/stadionDetail.js tests/stadionDetail.test.js src/main.js
```
```bash
git commit -m "perf(app): detail stadion jauh menyembunyikan penonton dan kursi di luar 600 m (mitigasi spec §9.3 langkah 3)"
```

- [ ] **Step 6: Mitigasi langkah 4 — titik berhenti**

Bila setelah langkah 1–3 budget masih GAGAL, BERHENTI dan laporkan ke user: tabel budget terakhir, titik ukur yang
gagal, dan usulan langkah 4 spec §9.3 (impostor billboard vegetasi jauh) sebagai pekerjaan terpisah. Jangan
membangunnya tanpa persetujuan.

- [ ] **Step 7: Cek manual kriteria §1 butir 1 (rasa tanjakan)**

Dev server (`preview_start` `stadion-dev`, atau Playwright GPU), mulai permainan, perjalanan cepat ke Stadion,
kayuh ke selatan lewat Jl. Stadion Utama ke kampus dengan W. Expected: tidak ada tebing/retakan di batas tile kota ↔
distrik; kecepatan turun terasa di tanjakan dan naik di turunan (fisika M1). Catat pengamatan di laporan.

---

## Task 19: Screenshot final M7 + README bagian kampus

**Files:**
- Create: `tests/e2e/shots.unri.mjs`, `docs/screenshots/unri/m7-*.jpg`
- Modify: `README.md`

- [ ] **Step 1: `tests/e2e/shots.unri.mjs`**

```js
#!/usr/bin/env node
/**
 * Screenshot final M7 (spec UNRI §11 "Visual"; TIDAK ikut vitest): Vite + Chromium GPU lewat harness.unri.mjs,
 * 1600×900, UI disembunyikan (kelas body.is-photo = mode foto), JPEG 85 ke docs/screenshots/unri/.
 *   node tests/e2e/shots.unri.mjs [--gpu d3d11|swiftshader]
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { ROOT, openSim, settleAt } from './harness.unri.mjs';

const OUT = join(ROOT, 'docs', 'screenshots', 'unri');
/** Posisi dunia sepeda + yaw (maju = (sin, cos)); kamera orang ketiga di belakang sepeda. */
const SHOTS = Object.freeze([
  { file: 'm7-mahasiswa-sekre-siang.jpg', x: -206, z: 1118, yaw: -2.52, hour: 10 },
  { file: 'm7-parkir-ic-siang.jpg', x: -922, z: 992, yaw: -2.06, hour: 11 },
  { file: 'm7-jalan-kampus-sore.jpg', x: -60, z: 702, yaw: -Math.PI / 2, hour: 17.5 },
  { file: 'm7-jalan-kampus-malam-sepi.jpg', x: -60, z: 702, yaw: -Math.PI / 2, hour: 22 },
  { file: 'm7-satpam-pos-binakrida.jpg', x: -1074.7, z: 1316, yaw: Math.PI, hour: 9 },
  { file: 'm7-lambang-gerbang-soebrantas.jpg', x: -1074, z: 2088, yaw: Math.PI, hour: 9.5 },
  { file: 'm7-ggm-gasing.jpg', x: 133, z: 480, yaw: Math.PI, hour: 16 },
  { file: 'm7-danau-rektorat.jpg', x: -690, z: 812, yaw: -1.23, hour: 16.5 },
  { file: 'm7-interior-sekre-malam.jpg', x: -219, z: 1130, yaw: Math.PI, hour: 20, interior: 'sekre' },
]);

const { values } = parseArgs({ options: { gpu: { type: 'string', default: 'd3d11' } } });
mkdirSync(OUT, { recursive: true });
const sim = await openSim({ gpu: values.gpu, port: 5175 });
try {
  for (const shot of SHOTS) {
    process.stderr.write(`[shots] ${shot.file}\n`);
    await settleAt(sim.page, { ...shot, waitMs: 3000 });
    await sim.page.evaluate(async (s) => {
      const p = window.__sim.portal;
      if (s.interior) {
        p.enter(s.interior);
        for (let t = 0; t < 150 && p.state !== 'inside'; t += 1) await new Promise((r) => setTimeout(r, 100));
        await new Promise((r) => setTimeout(r, 1500));
      }
      document.body.classList.add('is-photo');
    }, shot);
    await sim.page.screenshot({ path: join(OUT, shot.file), type: 'jpeg', quality: 85 });
    await sim.page.evaluate(async (s) => {
      document.body.classList.remove('is-photo');
      const p = window.__sim.portal;
      if (s.interior) {
        p.exit();
        for (let t = 0; t < 150 && p.state !== 'outside'; t += 1) await new Promise((r) => setTimeout(r, 100));
      }
    }, shot);
  }
  if (sim.errors.length) process.stderr.write(`[shots] galat konsol: ${JSON.stringify(sim.errors)}\n`);
} finally {
  await sim.close();
}
```

- [ ] **Step 2: Ambil & tinjau**

Run: `node tests/e2e/shots.unri.mjs --gpu d3d11`
Expected: 9 berkas `docs/screenshots/unri/m7-*.jpg`, tanpa baris "galat konsol". Buka tiap gambar (Read) dan periksa:
mahasiswa ramai siang / sepi malam, parkir IC penuh, satpam di pos, plang lambang menghadap kamera, GGM bundar,
Danau Buatan dengan Rektorat, interior sekre malam (TL menyala, NPC rapat). Bila komposisi buruk (terhalang pohon
dsb.), ubah `x/z/yaw` entri itu saja dan ulangi.

- [ ] **Step 3: README bagian kampus**

1. Di `## Fitur`, ganti butir **Cerita & misi** menjadi:

```markdown
- **Cerita & misi** "Wisata Kuliner dan Budaya Riau": 6 chapter (antar Es Teh ke Pak Satpam, antar Rujak ke Coach Dedi, 3 putaran lintasan, jejak Air Molek, dan chapter kampus "Kampus Biru Langit") dengan hadiah, lencana, gelar, dan 11 easter egg tersembunyi. Tombol **J** membuka jurnal; progres tersimpan di browser (pemain yang sudah tamat langsung mendapat chapter baru).
```

2. Tambahkan bagian baru sesudah `## Kontrol` (sebelum `## Menjalankan`):

```markdown
## Kampus UNRI Bina Widya
Kawasan Kampus Universitas Riau Bina Widya (poligon OSM `way/938374562`, ±244 ha) di barat daya stadion:
terrain dari elevasi SRTM (relief asli ±3–6 m), ±200 gedung OSM dirakit dari kit arketipe, zona handmade **Lembaga**
(Sekretariat Lembaga Mahasiswa, Stadion Mini, Student Center, Rusunawa, FH Panam) dan **Rektorat** (Rektorat +
bundaran, Danau Buatan, perpustakaan lama), serta Masjid Arfa'unnas, Gerbang SM Amin, dan Gedung Grand Gasing Millenium.

- **Ke sana:** kayuh ke selatan dari stadion lewat Jl. Stadion Utama, atau tekan **G** → "Kampus UNRI — Sekretariat Lembaga" / "Kampus UNRI — Rektorat".
- **Kehidupan kampus:** mahasiswa (±30% berjas almamater biru langit, banyak yang beransel) berjalan di trotoar dan selasar serta duduk di bangku diskusi — ramai 07.00–17.00, sedang 17.00–21.00, sepi malam; motor parkir rapat (parkir dekat Integrated Classroom penuh siang hari); satpam di Pos Keamanan Gerbang Binakrida.
- **Sekretariat:** pintu sekre di sebelah sekre BEM — tekan **E** untuk masuk; di dalam berjalan kaki, NPC beraktivitas sesuai jam game, ≥ 10 barang bisa dipakai, 4 preset kamera foto.
- **Cerita:** chapter 6 "Kampus Biru Langit" (nasi kotak dari Kantin FKIP, tanda tangan Ketua BEM, keliling Danau Buatan, kipas sekre) dan 3 easter egg kampus.
- **Fakta vs inferensi:** setiap fakta bersumber di `docs/research/kampus-unri-bina-widya.md`; status & keyakinan aset di `docs/superpowers/specs/2026-10-17-unri-asset-catalog.md`; sumber & keyakinan per gedung di `src/districts/unri/buildings.data.js`. Detail yang tidak terkonfirmasi (denah sekre, warna gedung lama, penempatan plang lambang, seragam satpam) ditandai [INFERENSI].

### Kontrol di dalam sekre
| Tombol | Aksi |
|---|---|
| W / A / S / D | jalan |
| Shift | lari |
| Mouse | lihat sekeliling |
| E | pakai barang (gitar, kipas, dispenser, saklar, papan, …) / keluar lewat pintu |
| V | orang pertama / orang ketiga |
| P | mode foto: preset lesehan, pintu, pojok, atas + kamera bebas |
| Esc | keluar sekre |

| Mahasiswa di depan sekre (siang) | Parkir Integrated Classroom (siang) |
|---|---|
| ![Mahasiswa](docs/screenshots/unri/m7-mahasiswa-sekre-siang.jpg) | ![Parkir IC](docs/screenshots/unri/m7-parkir-ic-siang.jpg) |
| **Jl. Muchtar Lutfi sore** | **Malam sepi** |
| ![Sore](docs/screenshots/unri/m7-jalan-kampus-sore.jpg) | ![Malam](docs/screenshots/unri/m7-jalan-kampus-malam-sepi.jpg) |
| **Satpam Pos Binakrida** | **Plang lambang dekat Gerbang Soebrantas** |
| ![Satpam](docs/screenshots/unri/m7-satpam-pos-binakrida.jpg) | ![Lambang](docs/screenshots/unri/m7-lambang-gerbang-soebrantas.jpg) |
| **Gedung Grand Gasing Millenium** | **Danau Buatan & Rektorat** |
| ![GGM](docs/screenshots/unri/m7-ggm-gasing.jpg) | ![Danau](docs/screenshots/unri/m7-danau-rektorat.jpg) |
| **Interior sekre (malam)** | |
| ![Sekre](docs/screenshots/unri/m7-interior-sekre-malam.jpg) | |
```

3. Cocokkan tabel kontrol sekre dengan keymap interior M5 (`grep -n "inside\|interior\|photo\|preset" src/app/keymap.js
   src/core/InteriorCameraRig.js`); bila tombol berbeda, tulis tombol nyata.
4. Di `## Struktur`, tambahkan baris yang belum ada:
   `districts/   distrik (defineDistrict) + Kampus UNRI: terrain, tanah, kit gedung, kehidupan kampus`,
   `interiors/   interior (defineInterior) + sekre`, dan `tools/campusbake/ bake offline kampus (DEM SRTM + OSM)`.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/shots.unri.mjs docs/screenshots/unri/m7-mahasiswa-sekre-siang.jpg docs/screenshots/unri/m7-parkir-ic-siang.jpg docs/screenshots/unri/m7-jalan-kampus-sore.jpg docs/screenshots/unri/m7-jalan-kampus-malam-sepi.jpg docs/screenshots/unri/m7-satpam-pos-binakrida.jpg docs/screenshots/unri/m7-lambang-gerbang-soebrantas.jpg docs/screenshots/unri/m7-ggm-gasing.jpg docs/screenshots/unri/m7-danau-rektorat.jpg docs/screenshots/unri/m7-interior-sekre-malam.jpg README.md
```
```bash
git commit -m "docs: README kampus UNRI (kehidupan, sekre, kontrol interior, chapter 6) dan galeri screenshot M7"
```

---

## Task 20: Status katalog aset & indeks, verifikasi akhir, review tonggak

**Files:**
- Modify: `docs/superpowers/specs/2026-10-17-unri-asset-catalog.md`, `docs/superpowers/plans/2026-10-17-unri-00-index.md`

- [ ] **Step 1: Status aset di katalog**

Bila M1–M6 sudah menambah bagian status, perbarui baris aset M7 di sana; bila belum, tambahkan di akhir berkas:

```markdown
## 9. Status aset (diperbarui per tonggak)

| ID | Status | Berkas final | Catatan |
|---|---|---|---|
| A01 | final | `public/models/unri/a01-motor-bebek.glb` | BatchedMesh di parkir distrik; warna bodi per instans [INFERENSI] |
| A02 | final | `public/models/unri/a02-motor-matic.glb` | idem |
| A03 | final | `public/models/unri/a03-motor-sport.glb` | idem |
| A04 | final | `public/models/unri/a04-motor-tua.glb` | idem |
| P02 | final (model), tidak terpasang | `public/models/unri/p02-halte-tmp.glb` | node OSM 4559431711 & 4559433677 di luar batas distrik (D6 plan M7) |
| P12 | final (reuse) | `src/entities/Vendor.js` + `src/world/props/Cart.js` | gerobak stadion sebagai etalase Kantin FKIP; PKL di kampus tetap GAP (tidak disajikan sebagai PKL) |
| N10 | final | `public/models/unri/n10-lambang-unri.glb` | plang di jalur hijau Jl. Binawidya UNRI dekat Gerbang Soebrantas [INFERENSI penempatan]; isi lambang dari deskripsi resmi [T] |
| C01 | final (P) | `src/entities/Humanoid.outfits.js` `randomStudentOutfit` | almamater biru langit ±30% + ransel |
| C02 | final (P) | `randomStudentOutfit` (kasual) | celana panjang/rok [POLA UMUM] |
| C10 | final (P) | `campusGuardOutfit` | seragam krem-coklat [INFERENSI Perpol 4/2020] |
```

Bila Blender tidak tersedia (jalur cadangan), tulis status `placeholder` untuk A01–A04, P02, N10 dengan catatan
"GLB belum dibuat; placeholder prosedural". Di bagian 8, tambahkan kalimat: "Total GLB `public/models/unri` terukur
E2E M7: <nilai `campusData.glbBytes` dari Task 18 Step 1> byte (batas 6 MB)."

- [ ] **Step 2: Status & catatan kontrak di indeks**

Di `docs/superpowers/plans/2026-10-17-unri-00-index.md`:
1. Di bagian `### M7`, tambahkan baris: "Kontrak tambahan (D1 plan M7): `mountDistrict(app, def, { …, services })`
   meneruskan `ctx.services = { npc, camera, hour(), excludeAt(x,z) }` ke `def.build` (opsional; tanpa services distrik
   berjalan tanpa NPC)."
2. Isi baris tabel status `| M7 | selesai | <hash commit terakhir M7> | E2E d3d11 lulus; budget §9.1: distrik <n>/180,
   total <n>/1000, interior <n>/150, hitch p95 <n> ms; mitigasi §9.3: <langkah yang dipakai atau "tidak perlu"> |`
   dengan angka nyata dari Task 18.

- [ ] **Step 3: Verifikasi akhir**

Run: `npm test` → semua lulus (catat jumlah berkas/tes vs baseline Task 0).
Run: `npm run lint` → 0 galat.
Run: `npm run build` → sukses.
Run: `npm run e2e -- --gpu d3d11 --out %TEMP%\e2e-m7-final.json` → exit 0.
Run: `git status --short` → hanya perubahan dokumen langkah ini.

- [ ] **Step 4: Satu review tonggak**

Minta satu review (skill superpowers:requesting-code-review; agen reviewer `general-purpose` sesuai memori user) atas
`git diff <commit awal M7>..HEAD` dengan fokus: lapisan ESLint (districts tanpa entities), pelepasan sumber daya
(scope, BatchedMesh, InstancedMesh), kebenaran data fakta vs inferensi, dan tes. Perbaiki temuan CRITICAL/HIGH
(commit `fix(...)`), ulangi Step 3 bila ada perubahan kode.

- [ ] **Step 5: Commit dokumen**

```bash
git add docs/superpowers/specs/2026-10-17-unri-asset-catalog.md docs/superpowers/plans/2026-10-17-unri-00-index.md
```
```bash
git commit -m "docs: status aset M7 di katalog dan status tonggak M7 di indeks (budget §9.1 terukur)"
```

---

## Task 21: Push branch & buka PR (WAJIB izin user)

**Files:** tidak ada perubahan berkas.

- [ ] **Step 1: Ringkas isi branch**

Run: `git log --oneline main..HEAD` lalu `git status --short`
Expected: commit M0–M7 tercantum; working tree bersih.

- [ ] **Step 2: Minta izin user (titik berhenti)**

Tanyakan ke user di chat: "M7 selesai (tes, lint, build, E2E d3d11 lulus). Boleh saya push `feat/unri-kampus` ke
origin dan membuka PR ke `main`?" — sertakan ringkasan tabel budget §9.1 dan daftar penyimpangan. BERHENTI sampai
user menjawab ya. Bila tidak, akhiri di sini.

- [ ] **Step 3: Push (setelah izin)**

Run: `git push -u origin feat/unri-kampus`
Expected: branch terkirim, upstream terpasang.

- [ ] **Step 4: Buka PR (setelah izin)**

Tulis badan PR ke berkas sementara di luar repo (`%TEMP%\pr-unri.md`) berisi: ringkasan M0–M7 (satu baris per
tonggak dari tabel status indeks), tabel budget §9.1 nyata (Task 18), daftar keputusan D1–D11 plan M7, catatan
fakta vs inferensi, dan rencana uji (`npm test`, `npm run lint`, `npm run build`, `npm run e2e -- --gpu d3d11`,
`node tests/e2e/shots.unri.mjs`). Lalu:

Run: `gh pr create --base main --head feat/unri-kampus --title "feat: Kawasan Kampus UNRI Bina Widya (M0–M7)" --body-file %TEMP%\pr-unri.md`
Expected: URL PR. Laporkan URL ke user.

---

## Self-review

### Kriteria selesai keseluruhan (spec §1) → task

| # | Kriteria | Dipenuhi oleh | Bukti di M7 |
|---|---|---|---|
| 1 | Bersepeda stadion → kampus tanpa jahitan; tanjakan berat, turunan meluncur | M1 (terrain, `bikePhysics` grade), M2 (klip tile) | Task 17 `campusRide` (rute 1,15 km, 0 galat konsol, lompatan tanah ≤ 0,2 m/2 m, hitch p95), Task 18 Step 7 (cek rasa tanjakan manual) |
| 2 | Seluruh gedung OSM tampil sebagai kit; override sesuai foto | M3 (kit, `validateOverrides`), M4/M6 (override hero) | Task 17 titik ukur (draw call/segitiga distrik), Task 19 screenshot |
| 3 | Zona Lembaga & Rektorat handmade; hero Masjid, Gerbang SM Amin, GGM | M4, M6 | Task 17 `campusPoint` memeriksa region terpasang di `sekre-luar`/`rektorat`, titik `masjid`; Task 19 screenshot GGM & danau |
| 4 | Pintu sekre: E → interior; NPC berjadwal, ≥ 10 interaksi, 4 preset foto; keluar → sepeda tetap | M5 | Task 12 (hook interaksi → objective), Task 17 `interior-sekre` (`entered/exited/bikeKept`) + `interiorCycle` 3× memori, Task 11 misi 4 (kipas) |
| 5 | Budget §9 di titik ukur §9.2 (E2E GPU) | M7 | Task 17 (`LIMITS` §9.1, `CAMPUS_POINTS` §9.2, tabel budget), Task 18 (GPU + mitigasi §9.3 berurutan) |
| 6 | Fakta vs inferensi tercatat dan tampil di dokumen | M3 (`buildings.data.js` sumber/keyakinan), katalog | Task 19 README "Fakta vs inferensi", Task 20 status katalog; data M7 diberi komentar [T]/[INFERENSI] (outfit, posisi satpam, plang, bobot motor) |
| 7 | Atribusi OSM (ODbL) + SRTM di HUD/README/ATTRIBUTION | M7 | Task 16 (HUD `Attribution.js` + tes, `public/districts/unri/ATTRIBUTION.txt`, README) |

### Spec §8.4 → task
- Mahasiswa NPC (almamater ±30%, ransel, jalur trotoar/selasar, kepadatan per jam, duduk di bangku, LOD humanoid yang
  ada): Task 1 (logika), 3 (outfit/LOD/kit), 5 (students.js, streaming per sel 250 m, kolam tetap = budget).
- Motor parkir instanced, kepadatan per area, IC penuh siang, 4 varian: Task 2, 6, 7.
- Vegetasi distrik: dikerjakan M2/M6 (indeks); M7 hanya menurunkan kepadatannya bila mitigasi langkah 2 (Task 18).
- Fast travel 2 tujuan kampus: Task 15. Chapter 6 (4 misi persis §8.4) + objective `interact`: Task 9, 11, 12.
- Easter egg lambang 1-10-62, "Kampus Biru Langit", GGM: Task 8 (plang N10), Task 14. Atribusi SRTM: Task 16.
- Tambahan instruksi: halte TMP P02 (Task 8, D6), satpam C10 (Task 5), migrasi/sanitize save (Task 13, D9),
  README & kontrol interior (Task 19), status katalog & indeks (Task 20), PR dengan izin (Task 21).

### Indeks M7 "Buat/Ubah" → task
`students.js` (5), `motorParking.js` (7), `chapters.unri.js` (11), easter egg kampus (14),
`public/districts/unri/ATTRIBUTION.txt` (16), Blender A01–A04 (6), P02 & N10 (8); `objectives.js` (9), `chapters.js`
(11), `easterEggs.js` (14), `fastTravel.js` (15), `Attribution.js` (16), `README.md` (16, 19), `smoke.e2e.mjs` (17),
katalog (20). Berkas tambahan di dalam tonggak (diizinkan indeks): `campusLife.js`, `parkingSlots.js`, `Student.js`,
`groundFeed.js`, `guards.js`, `life.js`, `campusProps.js`, `motorVariants.js`, `lambangUnri.js`, `halteTmp.js`,
`interiorStoryHook.js`, `stadionDetail.js` (kondisional), `harness.unri.mjs`, `shots.unri.mjs`.

### Spec §11 (pengujian) → task
Unit logika murni/berisiko M7: `campusLife` (1), `parkingSlots` (2), outfit/LOD (3), `groundFeed` (5),
`parkingAreas`/`normalizeGeometry` (7), objective `interact` + reducer (9), katalog kantin (10), data & konsistensi
chapter 6 (11), hook interior + StoryDirector (12), reopen save (13), pemicu egg (14), fast travel kampus +
`waitForRegion` (15), atribusi (16), `stadionDetail` (18, kondisional). E2E: Task 17. Visual: Task 19.

### Konsistensi nama & tipe (diperiksa)
- `createStudentKit()` → `{ createStudent, createGuard, createLod, walk, idle, pose, dispose }` dipakai sama di
  `students.js` & `guards.js` (`npc.walk/idle/pose/createLod/dispose`).
- `life.js` mengembalikan `{ group, systems, students, guards, motors, props, feed, dispose }`; harness & E2E membaca
  `district.life.students.stats`, `.guards.stats`, `.motors.stats`, `.props.halteCount`, `.group`.
- Setiap konsumen ground punya `addGroundChunk(key, data)` / `removeGroundChunk(key)` (students, motors).
- Target interact: `'unri-lembaga:ketua-bem'` (NPC `zone` + `id`), `'sekre:kipas'` (`SEKRE_KIPAS_ID`); objective
  `interact` dicocokkan persis oleh `objectives.js`; StoryDirector mengirim format yang sama.
- Titik dunia kampus konsisten antar berkas: sekre-luar (−219, 1130) & rektorat (−979, 860) di
  `CAMPUS_DESTINATIONS`, `CAMPUS_POINTS`, `CAMPUS_TRAVEL`; plang (−1074, 2078) di `LAMBANG_SPOT`, egg `at`
  (−1074, 2081), harness/shots (−1074, 2088); GGM (133.1, 407.4) di `GGM_RING` dan tes centroid.
- Logika murni Task 1–3, 5 (`groundFeed`), 7 (`parkingAreas`), 9–16 telah dijalankan terhadap kode repo saat plan
  ditulis (salinan di luar repo): tes lulus. Bagian yang bergantung M0–M6 dikunci oleh Task 0 dan `tests/storyUnri.test.js`.

### Penyimpangan & risiko
- D1 (opsi `services` pada `mountDistrict`) adalah perluasan kontrak M1 → dicatat di indeks (Task 20 Step 2).
- D2 (`region:'world'`), D3 (`groundFeed`), D4 (pedagang kantin), D6 (halte tidak terpasang), D7 (penempatan plang),
  D11 (titik ukur masjid digeser) — alasan di tabel "Keputusan desain".
- Risiko: nama API M0–M6 berbeda dari indeks (Task 0 menangkap; adaptasi minimal + catat); denah selasar M4 berbeda
  (data cadangan ujung barat di Task 11 Step 6); format/satuan ground M2 (Task 0 Step 4 + `GROUND_SCALE`); Blender tidak
  tersedia (jalur cadangan placeholder `path: null`); budget draw call total bila stadion persistent terlihat dari
  kampus (mitigasi §9.3 Task 18); `freezeStatic` distrik membekukan grup statis (props memperbarui matriks manual,
  NPC/motor ditambahkan sesudah pemasangan sehingga tidak beku).
