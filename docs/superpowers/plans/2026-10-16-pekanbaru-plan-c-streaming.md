# Plan C — Streaming Kota + Integrasi Slice (Fase 2–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelesaikan utang serah-terima Plan A (mount/unmount region, placement ujung-ke-ujung, satu mask, konten selaras mask, props ke scope, aturan arah dependensi) lalu membangun klien streaming tile kota (Fase 2: ChunkStreamer, TileLoader, TileCollider, material kota, minimap tile, kabut, atribusi) dan integrasi slice (Fase 3: placement + mask dari OSM, tanah per tile, perjalanan cepat Stadion ↔ Masjid Raya An-Nur, angkot/bus dinonaktifkan, smoke test E2E) sesuai spec `docs/superpowers/specs/2026-10-16-pekanbaru-city-slice-design.md` §3, §3.1, §4 (Fase 2–3), §5, §6.

**Architecture:** Region handmade dipasang lewat `src/app/mountRegion.js` (build di ResourceScope region → placement pada `region.group` → `freezeStatic` → registry emissive/basah/lampu → sistem; `unmount()` terbalik). Frame region (`createRegionFrame`) menjadi satu-satunya jembatan koordinat region-lokal ↔ dunia untuk entitas, cerita, kamera, minimap, dan lampu. Klien kota `src/city/` terdiri dari modul murni (`tileData`, `ChunkStreamer`, `TileCollider`, `tileMinimap`) dan modul I/O tipis (`TileLoader`, `cityMaterials`, `index.js`), dipasang sebagai satu sistem fase `world`; collider komposit merutekan titik di dalam mask ke region dan selebihnya ke `TileCollider`. Mask stadion satu sumber (`src/regions/stadion/mask.js`) dipakai klien dan citybake (`stadionMaskWorld`), placement dihitung dari footprint OSM (`src/geo/placement.js`).

**Tech Stack:** Three.js 0.186 (GLTFLoader + MeshoptDecoder dari `three/addons`), JavaScript ESM (JSDoc), Vite 8, Vitest 5 (environment `node`; jsdom per berkas), ESLint 10 flat config, Node ≥ 20 (citybake offline), Playwright (paket global) untuk E2E.

---

## Konvensi eksekusi

- Tes satu berkas: `node node_modules/vitest/vitest.mjs run <file>` (jangan `npx`). Seluruh suite: `node node_modules/vitest/vitest.mjs run`.
- Lint: `node node_modules/eslint/bin/eslint.js .` (harus 0 error; warning lama boleh tetap, warning baru tidak).
- Build (wajib bila menyentuh `src/main.js`, `src/app/*`, `src/city/*`, `index.html`): `node node_modules/vite/bin/vite.js build`.
- Commit selalu SATU perintah tersendiri: `git add <berkas...> && git commit -m "..."`. Hook memblokir `;`, heredoc, dan `-qm`. `git add` berkas eksplisit (bukan `-A`); berkas yang dipindah/dihapus memakai `git mv` / `git rm` lebih dulu (perintah terpisah).
- Pesan commit: conventional commits, Bahasa Indonesia, seperti riwayat repo.
- Nomor baris `path:line` merujuk isi berkas **sebelum task itu dimulai** (setelah task sebelumnya selesai). Untuk berkas yang dibuat/diubah di task sebelumnya, rujukan memakai nama fungsi/potongan teks. Cocokkan berdasarkan isi bila baris bergeser.
- Bila langkah rencana salah terhadap kode nyata: perbaiki seminimal mungkin dan CATAT penyimpangan di laporan task (berkas, rencana, yang dilakukan, alasan). Jangan menambah fitur di luar rencana. Fakta lebih penting daripada gaya.
- Setiap commit: suite + lint hijau, semua tes lama tetap lulus (kecuali tes yang task itu sendiri ubah dan jelaskan).
- **Titik berhenti untuk user** (executor WAJIB berhenti dan bertanya): Task 6 Step 4 (fakta OSM berbeda dari tabel), Task 21 Step 1 (hook config-protection), dan setiap kali bake melampaui budget (`PERINGATAN:` di keluaran citybake).

## Prasyarat & lingkungan

- Basis: branch kerja Plan C dari `feat/pekanbaru-slice` (saat rencana ditulis, checkout utama berada di `feat/pekanbaru-plan-c` = `f189476`, tree identik dengan `0dc7181`). Suite awal: **82 berkas / 641 tes lulus**.
- **Cache data bake** (`data-src/`, di-.gitignore) TIDAK ada di checkout utama. Cache Plan B ada di `.claude/worktrees/pekanbaru-plan-b-5ad459/data-src/` (OSM stadion `2026-10-16T08:53:21Z`, pusat `2026-10-16T09:00:35Z`, Overture `2026-09-23.1`). Task 0 menyalinnya; bake offline dengan cache itu menghasilkan tile **byte-identik** dengan `public/tiles/` yang di-commit (diverifikasi saat menyusun rencana). Bila cache tidak ada: bake online (`node tools/citybake --area stadion`, butuh jaringan ±14 menit karena Overture/DuckDB) — hasilnya bisa berbeda karena data OSM berubah; laporkan.
- Playwright: paket global (`%APPDATA%\npm\node_modules\playwright`, dipakai sesi Plan A) atau `PLAYWRIGHT_PATH`. Harness E2E memakai Vite di port 5174.
- GPU: Chromium headless dapat memakai GPU nyata dengan `--use-angle=d3d11` (mesin ini: NVIDIA RTX 3050 Laptop). Ukuran hitch hanya bermakna dengan GPU; SwiftShader hanya untuk draw call/memori/galat.
- Baseline paritas Plan A (harness `parity-run.mjs`, Chromium SwiftShader 1280×720): callsMean **±502** (497/503/502), malam+hujan 589/707, memori 425/72.

## Struktur file

**Baru**

| Berkas | Task | Tanggung jawab |
|---|---|---|
| `src/app/mountRegion.js` | 3 | `mountRegion(app, def, {store, time, weather})` → `{region, ready, unmount()}`; `applyPlacement(group, placement)`. |
| `src/app/regionContext.js` | 4 | `createLocalContext(frame)` (ctx dunia → ctx region-lokal, cache per frame), `pointToWorld`, `pointToLocal`. |
| `src/app/fastTravel.js` | 20 | `travelDestinations`, `findWalkableNear`, `createFastTravel` (teleport menunggu streamer). |
| `src/regions/stadion/placement.js` | 5, 18 | `STADION_PLACEMENT` (Task 5: identitas; Task 18: dari footprint OSM), `STADION_FOOTPRINT`. |
| `src/regions/stadion/footprint.js` | 18 | Footprint OSM way 327365495 (52 titik lat/lon, ODbL). |
| `src/geo/placement.js` | 18 | `areaMoments`, `placementFromFootprint` (centroid luas + sumbu panjang). |
| `src/engine/freezeStatic.js` | 14 | Dipindah dari `src/world/util/freezeStatic.js` (dipakai `city/`; re-export lama tetap). |
| `src/city/tileData.js` | 11 | `validateManifest`, `validateTileData`, `decodeTileData` (Format tile v1). |
| `src/city/ChunkStreamer.js` | 12 | State machine murni muat/lepas/tukar LOD/batal; `STREAM`. |
| `src/city/TileCollider.js` | 13 | Spatial hash 25 m: bangunan memblok, air memblok kecuali di atas jalan. |
| `src/city/cityMaterials.js` | 14 | Material bersama per nama mesh, `CITY_LAYERS` (renderOrder −4…0), `applyCityMaterials`. |
| `src/city/TileLoader.js` | 14 | Eksekutor aksi streamer: data.json + GLB (Meshopt), retry 2× backoff, dispose. |
| `src/city/tileMinimap.js` | 15 | `drawTileLayer`, `createTileMinimapCache` (canvas 256 px per tile). |
| `src/city/index.js` | 16 | `createCity` (manifest → streamer/loader/collider/minimap/tanah dasar; sistem `city.stream`). |
| `src/ui/Attribution.js` | 17 | Atribusi "© OpenStreetMap contributors · Overture Maps Foundation". |
| `src/ui/FastTravelMenu.js` | 20 | Panel perjalanan cepat (G / tombol HUD) + layar perjalanan. |
| `src/config/stadionSite.js` | 10 | Data `STADIUM`/`SITE` (dipindah dari `src/regions/stadion/site.js`, M1). |
| `tools/citybake/inspectOsm.js` | 6 | Alat verifikasi fakta OSM (cache + query Overpass). |
| `tests/e2e/smoke.e2e.mjs` | 22 | Smoke test Playwright (tidak ikut `vitest run`). |
| Tes: `tests/nightLamps.test.js`, `mountRegion.test.js`, `regionContext.test.js`, `placement.test.js`, `osmFacts.test.js`, `stadionContent.test.js`, `propsScope.test.js`, `fogRange.test.js`, `attribution.test.js`, `stadionPlacement.test.js`, `regionGround.test.js`, `fastTravel.test.js`, `fastTravelMenu.test.js`, `tests/citybake/inspectOsm.test.js`, `tests/geo/placement.test.js`, `tests/city/{tileData,chunkStreamer,tileCollider,tileLoader,tileMinimap,city}.test.js` | — | Tes modul baru. |

**Diubah (utama)**

| Berkas | Task | Perubahan |
|---|---|---|
| `src/engine/SystemRunner.js` | 1 | `remove()` memanggil `dispose`; sistem tercabut tidak jalan di frame yang sama; `dispose()` LIFO. |
| `src/world/TimeOfDay.lights.js`, `TimeOfDay.js`, `NightHalos.js` | 2, 16 | `registerLamps()` (M3); floodlight dari data region; `setFogLimit`/`fogRange`. |
| `src/regions/stadion/index.js`, `lamps.js`, `mask.js`, `layout.js`, `site.js`, `collider.js` | 2–10, 18–19 | Konten region (GLB, lampu dunia), satu mask + koridor utara, I4, spawn, M1. |
| `src/main.js` | 2–4, 8, 16, 19, 20, 22 | Composition: mountRegion, frame region, kota, perjalanan cepat, hook dev. |
| `src/core/cameraPresets.js`, `PovDirector.js`, `povSource.js`, `Collider.js`, `App.js` | 4, 13, 19 | POV & rute kamera di frame region; collider tidak terkunci; bake minimap berpusat & transparan. |
| `src/entities/index.js` | 4 | `regionGroup` (entitas region-lokal) terpisah dari sepeda (dunia). |
| `src/ui/Minimap2D.js`, `src/shared/minimapMath.js` | 4, 15 | Pusat peta dasar; layer tile. |
| `src/geo/polygon.js` (+ hapus `src/shared/polygon.js`) | 5, 11 | Satu `pointInPolygon` + `convexHull`; `distanceToSegment/Ring`. |
| `tools/citybake/config.js`, `tools/citybake/mask.js` | 5, 18 | Mask dari klien (`stadionMaskWorld`), `ORIGIN = WORLD_ORIGIN`. |
| `src/world/{index,Ground,Ground.roads,Ground.materials,Landscape,Landscape.zones,Landscape.trees,Grass,Grass.placement,Decals.layout,Weather,Weather.wet}.js` | 4, 7, 8, 9, 19 | I4 (hapus elemen fiktif), tanah/vegetasi di dalam mask, genangan ber-placement. |
| `src/world/props/{Bench,Cart,Fence,Gapura,LampPost,Monument,Planter,TrashBin,Vehicles}.js`, `Landscape.trees.js` | 9 | Material/geometri tingkat-modul → `currentScope()`. |
| `src/story/{chapters,easterEggs}.js` | 7 | Telur jejak-2/jejak-3 dipindah ke lokasi nyata. |
| `src/config/constants.js` | 10, 18 | Re-export `./stadionSite.js` (M1); `WORLD_ORIGIN`. |
| `eslint.config.js` | 21 | Aturan arah dependensi (BERHENTI: hook config-protection). |
| `vite.config.js`, `package.json`, `index.html`, `src/ui/hud.css`, `README.md` | 16–22 | Cakupan coverage, skrip `e2e`, petunjuk tombol G, gaya HUD, atribusi. |
| `public/tiles/**` | 5, 8, 18 | Bake ulang offline (mask satu sumber + koridor). |

**Dihapus:** `src/shared/polygon.js`, `tests/polygon.test.js` (Task 5); `src/world/Landscape.water.js`, `src/world/Landscape.baseball.js` (Task 7).

## Keputusan I4 per elemen (fakta OSM → keputusan)

Dasar: cache bake `data-src/osm/stadion.json` (Overpass `2026-10-16T08:53:21Z`, query citybake: building/highway/waterway/water/landuse/leisure terbatas/natural/amenity terbatas) dan query Overpass tambahan untuk tag yang tidak ada di cache (`aeroway`, `barrier`, `man_made`, `historic`, `tourism`, semua `leisure`/`sport`, nama; `2026-10-16T14:15:06Z`). Koordinat dunia ENU (m), region-lokal = dunia (placement ≈ identitas). Mask lama Plan A: hull elips 250×310 + parkir (z utara terjauh −355). Task 6 menyediakan alat untuk mengulang setiap pemeriksaan; perintah per baris di kolom terakhir.

| Elemen handmade | Fakta OSM | Keputusan (Task) | Cara memeriksa |
|---|---|---|---|
| Danau (−60, −480), elips 90×55 | Tidak ada air di sana (posisi itu tepat di/utara Jl. Naga Sakti OSM). Danau nyata: way 419836906 (centroid −192, −290) dan way 327378220 (119, −384), keduanya di luar mask → sudah ikut tile sebagai air. | **Hapus** (visual, collider, zona, `LAKE_RADIUS` Grass, minimap part). Telur jejak-2 dipindah ke antara dua danau nyata (−5, −385). (7) | `node tools/citybake/inspectOsm.js --at=-60,-480 --radius 120`; `tests/osmFacts.test.js` |
| Jl. Naga Sakti handmade z = −390 (3 lajur, PJU, pagar, lapak PKL, billboard, palem, dekal, genangan, angkot/bus) | Jl. Naga Sakti nyata (primary, dua jalur) di z ≈ −445…−471 (way 195075394, 1517885015, 1504822369, …), panjang 4.208 m di tile stadion; di luar mask → sudah dirender tile. | **Hapus** jalan handmade + turunannya; versi OSM menang. Angkot/bus **dinonaktifkan** (lalu lintas OSM = backlog spec §7). (8) | `--at=0,-450 --radius 60`; `osmFacts`: titik jalan bernama "Jalan Naga Sakti" pada \|x\| ≤ 300 di z −475…−440 |
| Gapura z = −372 + pos jaga, rambu, Pak Satpam, jejak-1 | Tidak ada tag gapura/`barrier`/nama di OSM (Overpass). Nyata menurut user. Sumbu pedestrian OSM way 1452277714 (x ≈ −20…10) dari plaza ke Naga Sakti (ujung z = −443, tangga way 1513217586 di (−6, −440)) diapit dua danau. | **Pertahankan**, pindah ke ujung utara sumbu (0, −436); **mask diperluas** dengan koridor sumbu utara (leher x −22…12 di antara danau, melebar x −30…30 untuk z < −412, ujung z = −440 agar Naga Sakti tidak terpotong). (8) | `--at=0,-420 --radius 40`; `--overpass --at=0,-420 --radius 100` (barrier/nama) |
| Venue baseball (−300, 260) | Nyata: way 535214902 `leisure=pitch sport=baseball` "Venue Baseball", centroid (−235, 227), 15.598 m², di luar mask → sudah jadi landuse `pitch` di tile. | **Digantikan versi OSM**: venue handmade dihapus (berkas `Landscape.baseball.js`). Telur jejak-3 dipindah ke Venue Baseball OSM. (7) | `--at=-300,260 --radius 90` |
| Helipad (400, −100) + jalan setapak | Tidak ada di posisi itu (OSM: scrub/parkir). Helipad nyata: way 652285334 `aeroway=helipad` di (−259, −116) — tag `aeroway` TIDAK diambil query bake, jadi tidak ada di tile. | **Hapus** (fiktif di posisinya). Helipad nyata = backlog (tambah `aeroway` ke query bake, butuh jaringan). (7) | `--at=400,-100 --radius 40`; `--overpass --at=-259,-116 --radius 50` |
| Sungai x = 330 + jembatan baja | Tidak ada waterway di x 300…360, z −300…300 (hanya footway/service/parkir); parit nyata (way 857460690) di utara Naga Sakti, ikut tile. | **Hapus** sungai, parit, jembatan. (7) | `--at=330,0 --radius 60`; `osmFacts` |
| Taman/lintasan seluncur (260, 120) | Tidak ada `leisure`/`sport` seluncur (Overpass); area = parkir way 1452901214 & rumput. | **Hapus**; peseluncur pindah ke paving plaza (posisi default `Crowd.plaza`). (7) | `--at=260,120 --radius 40`; `--overpass` |
| Amfiteater (−150, 330) | Tidak ada (Overpass); area = grassland way 1452277703. | **Hapus**. (7) | `--at=-150,330 --radius 40` |
| Billboard x = ±250 (di luar hull lama ±5 m) | — (konten region) | Margin mask 8 → 20 m sehingga ikut mask. (8) | `tests/stadionContent.test.js` |
| Vegetasi/rumput/tanah di luar mask (persegi 1,4 km) | Di luar mask berlaku data kota. | **Dipotong ke mask** (Fase 3); vegetasi dari landuse = backlog spec §7. (19) | `tests/regionGround.test.js` |

Temuan yang **tidak** diputuskan Plan C (dicatat untuk user): parkir utara handmade (x −120…120, z −355…−305) dan plaza berada di atas sebagian danau OSM barat (6 dari 23 titik way 419836906 di dalam mask) dan di atas sumbu pedestrian nyata. Di dalam mask region berwenang (tanah region menutupi air tile; collider region), jadi tidak ada konflik teknis, tetapi secara fakta tata letak utara stadion berbeda. Menyelaraskannya = mendesain ulang region (di luar cakupan).

---

## Task 0: Persiapan & baseline (tanpa commit)

**Files:** tidak ada perubahan berkas yang di-track (`data-src/` di-.gitignore).

- [ ] **Step 1: Pastikan tree bersih dan catat baseline**

```bash
git status --short
```
Expected: kosong.

```bash
node node_modules/vitest/vitest.mjs run
```
Expected: `Test Files  82 passed (82)`, `Tests  641 passed (641)`.

```bash
node node_modules/eslint/bin/eslint.js .
```
Expected: exit 0.

- [ ] **Step 2: Salin cache bake Plan B (offline bake)**

```bash
cp -r .claude/worktrees/pekanbaru-plan-b-5ad459/data-src ./data-src
```
Expected: `data-src/osm/{stadion,pusat}.json` dan `data-src/overture/{stadion,pusat}.geojson` ada. Bila folder sumber tidak ada, lanjutkan tanpa cache dan catat; Task 5/8/18 lalu memakai bake online (lihat Prasyarat).

- [ ] **Step 3: Buktikan cache mereproduksi tile yang di-commit**

```bash
node tools/citybake --area all --offline --out data-src/cek-baseline
```
```bash
diff -rq data-src/cek-baseline public/tiles
```
Expected: tanpa keluaran (byte-identik). Bila berbeda: BERHENTI, laporkan ke user (cache tidak sesuai dengan tile yang di-commit).

- [ ] **Step 4: Ukur paritas baseline di checkout sekarang (opsional bila hasil Plan A dipakai)**

Jalankan harness Plan A (`parity-run.mjs` di folder side-session-notes) terhadap root repo dan simpan JSON-nya; angka acuan: callsMean ±502, malam 589/707, memori 425/72, galat 0.

---

## Task 1: SystemRunner — `remove` memanggil `dispose`, snapshot use-after-remove, `dispose` LIFO

Utang serah-terima Plan A (I2, M2, Task 2/11): `SystemRunner.remove` tidak memanggil `System.dispose`, sistem yang dicabut di tengah frame tetap jalan sekali (snapshot), dan `dispose()` tidak LIFO.

**Files:**
- Modify: `src/engine/SystemRunner.js:1-85` (seluruh berkas)
- Test: `tests/systemRunner.test.js` (tambah di akhir berkas, setelah baris 109)

- [ ] **Step 1: Tulis tes yang gagal** — tambahkan di akhir `tests/systemRunner.test.js`:

```js
describe('SystemRunner: remove, snapshot, dispose LIFO (Plan C)', () => {
  it('remove memanggil dispose sistem sekali; {dispose:false} tidak', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    const seen = [];
    r.add(sys('a', 'sim', () => {}, { dispose: () => seen.push('a') }));
    r.add(sys('b', 'sim', () => {}, { dispose: () => seen.push('b') }));
    expect(r.remove('a')).toBe(true);
    expect(r.remove('a')).toBe(false);
    expect(r.remove('b', { dispose: false })).toBe(true);
    expect(seen).toEqual(['a']);
  });

  it('galat dispose saat remove dicatat dengan id, sistem tetap tercabut', () => {
    const logger = quietLogger();
    const r = createSystemRunner({ logger });
    r.add(sys('rapuh', 'ui', () => {}, { dispose: boom }));
    expect(r.remove('rapuh')).toBe(true);
    expect(r.has('rapuh')).toBe(false);
    expect(logger.calls[0][0]).toContain('"rapuh"');
  });

  it('sistem yang dicabut sistem lain di tengah frame tidak dijalankan lagi pada frame itu', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    const log = [];
    r.add(sys('pencabut', 'sim', () => { log.push('pencabut'); r.remove('korban'); }));
    r.add(sys('korban', 'world', () => log.push('korban')));
    r.update(0.016, {});
    r.update(0.016, {});
    expect(log).toEqual(['pencabut', 'pencabut']);
  });

  it('dispose melepas terbalik dari urutan pendaftaran, lintas fase', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    const order = [];
    const mk = (id, phase) => sys(id, phase, () => {}, { dispose: () => order.push(id) });
    r.add(mk('ui1', 'ui'));
    r.add(mk('in1', 'input'));
    r.add(mk('w1', 'world'));
    r.dispose();
    expect(order).toEqual(['w1', 'in1', 'ui1']);
    r.update(0.016, {});
    expect(r.ids).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/systemRunner.test.js
```
Expected: FAIL — `remove memanggil dispose…` (`expected [] to deeply equal ['a']`), `…tengah frame…` (`'korban'` ikut tercatat), `dispose melepas terbalik…` (urutan `['in1','w1','ui1']`).

- [ ] **Step 3: Implementasi** — ganti seluruh isi `src/engine/SystemRunner.js`:

```js
/**
 * SystemRunner: menjalankan sistem per frame dalam fase eksplisit input → sim → world → camera → ui.
 * Di dalam satu fase, urutan = urutan pendaftaran. Satu sistem yang melempar galat tidak menghentikan
 * sistem lain; setelah MAX_CONSECUTIVE_FAILURES galat beruntun sistem dinonaktifkan dan id-nya dicatat.
 * remove(id) memanggil dispose() sistem (kecuali {dispose:false}); sistem yang dicabut di tengah frame
 * tidak dijalankan lagi pada frame itu. dispose() melepas semua sistem terbalik dari urutan pendaftaran
 * (LIFO). Lapisan engine: tanpa impor three/world/ui.
 */
export const PHASES = Object.freeze(['input', 'sim', 'world', 'camera', 'ui']);
export const MAX_CONSECUTIVE_FAILURES = 3;

const PHASE_INDEX = new Map(PHASES.map((p, i) => [p, i]));

/**
 * @typedef {{id:string, phase:'input'|'sim'|'world'|'camera'|'ui', update(dt:number, ctx:object):void, dispose?():void}} System
 */

function assertSystem(system) {
  if (!system || typeof system.id !== 'string' || system.id === '') throw new TypeError('SystemRunner: sistem butuh id string');
  if (!PHASE_INDEX.has(system.phase)) throw new TypeError(`SystemRunner: fase "${system.phase}" (sistem "${system.id}") tidak dikenal`);
  if (typeof system.update !== 'function') throw new TypeError(`SystemRunner: sistem "${system.id}" butuh update(dt, ctx)`);
}

/**
 * @param {{logger?: {error: (...args: unknown[]) => void}}} [opts]
 */
export function createSystemRunner({ logger = console } = {}) {
  let entries = []; // { system, failures, seq, removed } terurut fase lalu pendaftaran
  const disabled = [];
  let seq = 0;

  const insert = (entry) => {
    const idx = PHASE_INDEX.get(entry.system.phase);
    const at = entries.findIndex((e) => PHASE_INDEX.get(e.system.phase) > idx);
    entries = at < 0 ? [...entries, entry] : [...entries.slice(0, at), entry, ...entries.slice(at)];
  };

  const disposeSystem = (system) => {
    try {
      system.dispose?.();
    } catch (err) {
      logger.error(`Sistem "${system.id}" gagal di-dispose:`, err);
    }
  };

  const fail = (entry, err) => {
    entry.failures += 1;
    const { id } = entry.system;
    if (entry.failures >= MAX_CONSECUTIVE_FAILURES) {
      logger.error(`Sistem "${id}" dinonaktifkan setelah ${entry.failures} galat beruntun:`, err);
      entry.removed = true;
      entries = entries.filter((e) => e !== entry);
      disabled.push(id);
    } else if (entry.failures === 1) {
      logger.error(`Sistem "${id}" galat (dicoba lagi pada frame berikutnya):`, err);
    }
  };

  return {
    /** @param {System} system */
    add(system) {
      assertSystem(system);
      if (entries.some((e) => e.system.id === system.id)) throw new Error(`SystemRunner: id "${system.id}" sudah terdaftar`);
      seq += 1;
      insert({ system, failures: 0, seq, removed: false });
      return system;
    },
    /**
     * Cabut sistem; dispose() sistem dipanggil (galatnya dicatat) kecuali `dispose: false`.
     * @param {string} id
     * @param {{dispose?: boolean}} [opts]
     */
    remove(id, { dispose = true } = {}) {
      const entry = entries.find((e) => e.system.id === id);
      if (!entry) return false;
      entry.removed = true;
      entries = entries.filter((e) => e !== entry);
      if (dispose) disposeSystem(entry.system);
      return true;
    },
    has(id) { return entries.some((e) => e.system.id === id); },
    get ids() { return entries.map((e) => e.system.id); },
    get disabled() { return [...disabled]; },
    update(dt, ctx) {
      for (const entry of entries) { // iterasi atas array saat ini; penghapusan membuat array baru
        if (entry.removed) continue; // dicabut oleh sistem lain di frame ini
        try {
          entry.system.update(dt, ctx);
          entry.failures = 0;
        } catch (err) {
          fail(entry, err);
        }
      }
    },
    /** Lepas semua sistem terbalik dari urutan pendaftaran (LIFO, lintas fase). */
    dispose() {
      const list = [...entries].sort((a, b) => b.seq - a.seq);
      entries = [];
      for (const entry of list) {
        entry.removed = true;
        disposeSystem(entry.system);
      }
    },
  };
}
```

Catatan perilaku: `App.removeSystem(id)` (`src/core/App.js:71-73`) meneruskan ke `systems.remove(id)` sehingga kini memanggil `dispose()` sistem. Pemanggil lama: `main.js:100` (sistem region, `dispose(){}` no-op) dan `App.removeUpdatable` (adaptor tanpa `dispose`) — keduanya aman.

- [ ] **Step 4: Jalankan, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/systemRunner.test.js
```
Expected: PASS (12 tes).

- [ ] **Step 5: Suite + lint**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
Expected: semua lulus, lint exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/engine/SystemRunner.js tests/systemRunner.test.js && git commit -m "fix: SystemRunner.remove memanggil dispose, sistem tercabut tidak jalan di frame yang sama, dispose LIFO"
```

---

## Task 2: TimeOfDay `registerLamps()` (M3) + data lampu malam dari region

Utang M3 dan "pindahkan data stadion dari TimeOfDay": TimeOfDay hanya menerima `lamps/lensRoot` saat konstruksi dan `TimeOfDay.lights.js` mengimpor `STADIUM` untuk sorot floodlight. Sesudah task ini region memberi `nightLights` dalam koordinat DUNIA (prasyarat placement, Task 4) dan TimeOfDay dapat mendaftar/mencabut set lampu kapan saja.

**Files:**
- Modify: `src/world/TimeOfDay.lights.js:1-182` (seluruh berkas; `createFloodSpots` di :95-108 kini dari data, `createNightLights` di :110-182 tanpa opsi konstruksi)
- Modify: `src/world/NightHalos.js:78`, `:81`, `:91-92` (kembalikan `group`)
- Modify: `src/world/TimeOfDay.js:67-76` (JSDoc + signature), `:90`, `:161-165`
- Modify: `src/regions/stadion/lamps.js:1-9` (seluruh berkas)
- Modify: `src/regions/stadion/index.js:13`, `:18`, `:29`, `:42`
- Modify: `src/main.js:129-132`
- Test: `tests/nightLamps.test.js` (baru); `tests/nightRegistry.test.js:17-26`; `tests/lifecycle.test.js:110`; `tests/region.test.js:63`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/nightLamps.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNightLights } from '../src/world/TimeOfDay.lights.js';
import { floodSpotsLocal, litLampPositions, stadionNightLights } from '../src/regions/stadion/lamps.js';
import { LAYOUT } from '../src/regions/stadion/layout.js';
import { toWorld } from '../src/geo/regionTransform.js';

const FLOOD = { x: 10, y: 40, z: -20, tx: -2, ty: 0, tz: 5 };

describe('TimeOfDay.lights: registerLamps (M3)', () => {
  it('set lampu menempel ke grup pemilik; pencabut melepas kolam & sorot (idempoten)', () => {
    const parent = new THREE.Group();
    const night = createNightLights(parent);
    expect(parent.getObjectByName('lampuSepeda')).toBeTruthy();
    expect(parent.getObjectByName('kolamCahayaPJU')).toBeUndefined();
    const off = night.registerLamps({ lamps: [{ x: 1, z: 2 }, { x: 3, z: 4 }], floods: [FLOOD] });
    expect(night.lampCount).toBe(2);
    const pools = parent.getObjectByName('kolamCahayaPJU');
    expect(pools.count).toBe(2);
    const spot = parent.getObjectByName('floodlightSorot-0');
    expect(spot.position.toArray()).toEqual([10, 40, -20]);
    expect(spot.target.position.toArray()).toEqual([-2, 0, 5]);
    expect(off()).toBe(true);
    expect(off()).toBe(false);
    expect(night.lampCount).toBe(0);
    expect(parent.getObjectByName('kolamCahayaPJU')).toBeUndefined();
    expect(parent.getObjectByName('floodlightSorot-0')).toBeUndefined();
  });

  it('PointLight memilih PJU terdekat dari gabungan semua set; set yang dicabut tidak dipilih lagi', () => {
    const parent = new THREE.Group();
    const night = createNightLights(parent);
    night.registerLamps({ lamps: [{ x: 500, z: 500 }] });
    const offNear = night.registerLamps({ lamps: [{ x: 5, z: 0 }] });
    night.setLampsOn(true);
    night.update(0.1, { x: 0, z: 0 }, 0);
    const active = () => parent.children.filter((o) => o.isPointLight && o.userData.active).map((o) => o.position.x);
    expect(active()).toEqual([5]);
    offNear();
    night.update(0.1, { x: 0, z: 0 }, 0);
    expect(active()).toEqual([]);
  });

  it('dispose melepas semua set dan registrasi emissive', () => {
    const parent = new THREE.Group();
    const night = createNightLights(parent);
    night.registerLamps({ lamps: [{ x: 0, z: 0 }], floods: [FLOOD] });
    night.dispose();
    expect(night.lampCount).toBe(0);
    expect(parent.getObjectByName('floodlightSorot-0')).toBeUndefined();
  });
});

describe('region stadion: data lampu malam dalam koordinat dunia', () => {
  it('placement identitas = posisi lokal; empat sorot di sudut atap', () => {
    const { lamps, floods } = stadionNightLights(LAYOUT, { x: 0, z: 0, yaw: 0 });
    expect(lamps).toEqual(litLampPositions(LAYOUT));
    expect(floods).toEqual(floodSpotsLocal());
    expect(floods).toHaveLength(4);
  });

  it('placement non-identitas memindahkan PJU dan sorot (posisi + bidik) ke frame dunia', () => {
    const p = { x: 100, z: -50, yaw: 0.3 };
    const { lamps, floods } = stadionNightLights(LAYOUT, p);
    const local = litLampPositions(LAYOUT);
    const w = toWorld(p, local[0].x, local[0].z);
    expect(lamps[0].x).toBeCloseTo(w.x, 9);
    expect(lamps[0].z).toBeCloseTo(w.z, 9);
    const f = floodSpotsLocal()[0];
    const fw = toWorld(p, f.x, f.z);
    const tw = toWorld(p, f.tx, f.tz);
    expect([floods[0].x, floods[0].y, floods[0].z]).toEqual([fw.x, f.y, fw.z]);
    expect([floods[0].tx, floods[0].tz]).toEqual([tw.x, tw.z]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/nightLamps.test.js
```
Expected: FAIL — `floodSpotsLocal`/`stadionNightLights` bukan ekspor `lamps.js`, `night.registerLamps is not a function`.

- [ ] **Step 3: Implementasi lampu malam** — ganti seluruh isi `src/world/TimeOfDay.lights.js`:

```js
/**
 * Lampu malam: material emissive (bohlam PJU, floodlight, arang gerobak, dll.),
 * maksimal DAY.maxPointLights PointLight nyata di PJU terdekat sepeda, dan
 * satu SpotLight lampu depan sepeda. Data lampu milik region (posisi PJU, sorot
 * floodlight, lensa) didaftarkan lewat registerLamps() dalam koordinat DUNIA dan
 * dicabut saat region dilepas. Intensitas 0 saat siang (objek tetap ada).
 */
import * as THREE from 'three';
import { DAY } from '../config/constants.js';
import { LAMP_POST } from './props/LampPost.js';
import { createNightHalos } from './NightHalos.js';
import { createMaterialRegistry } from '../engine/materialRegistry.js';

const LAMP_COLOR = 0xffe2a8;
const LAMP_POWER = 320;           // candela (PointLight fisik)
const LAMP_DISTANCE = 45;
const LAMP_HEIGHT = LAMP_POST.height - LAMP_POST.armDrop;
const HEADLIGHT_COLOR = 0xfff4d6;
const HEADLIGHT_POWER = 90;       // candela
const HEADLIGHT_ANGLE = 0.55;
const HEADLIGHT_HEIGHT = 0.95;
const HEADLIGHT_REACH = 14;
const FLOOD_COLOR = 0xfff1dc;
const FLOOD_POWER = 40000;        // candela per sorot (jarak ±100 m → ±4 lux di lapangan)
const FLOOD_ANGLE = 0.62;
const FLOOD_DISTANCE = 260;
const POOL_RADIUS = 9;            // kolam cahaya palsu di bawah setiap PJU (m)
const POOL_OPACITY = 0.5;
const POOL_Y = 0.14;
const EMISSIVE_AUTO_BOOST = 1.8;  // material emissive tanpa tag: on = off × boost
const FADE_RATE = 1.5;            // 1/s, transisi intensitas

const _fwd = new THREE.Vector3();

/** Entri registry emissive: material bertanda userData.nightEmissive, atau bercahaya (emissive > 0) → boost otomatis. */
export function selectEmissive(mat) {
  if (!mat.emissive) return null;
  const tagged = mat.userData?.nightEmissive;
  const base = mat.emissiveIntensity;
  const glow = !tagged && base > 0 && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0;
  if (!tagged && !glow) return null;
  const cfg = tagged ?? { on: base * EMISSIVE_AUTO_BOOST, off: base };
  return { mat, on: cfg.on, off: cfg.off };
}

function createPointLights(parent) {
  return Array.from({ length: DAY.maxPointLights }, (_, i) => {
    const light = new THREE.PointLight(LAMP_COLOR, 0, LAMP_DISTANCE, 2);
    light.name = `lampuPJU-${i}`;
    light.position.set(0, -50, 0); // di bawah tanah sampai dipilih
    parent.add(light);
    return light;
  });
}

function createHeadlight(parent) {
  const spot = new THREE.SpotLight(HEADLIGHT_COLOR, 0, HEADLIGHT_REACH * 2.5, HEADLIGHT_ANGLE, 0.6, 2);
  spot.name = 'lampuSepeda';
  parent.add(spot, spot.target);
  return spot;
}

/** Tekstur gradasi radial lembut untuk kolam cahaya. */
function poolTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Kolam cahaya hangat aditif di tanah untuk SEMUA PJU (PointLight nyata hanya segelintir). */
function createLightPools(parent, lamps) {
  const mat = new THREE.MeshBasicMaterial({
    color: LAMP_COLOR, map: poolTexture(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  const geo = new THREE.PlaneGeometry(POOL_RADIUS * 2, POOL_RADIUS * 2).rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, mat, lamps.length);
  const m = new THREE.Matrix4();
  lamps.forEach((l, i) => mesh.setMatrixAt(i, m.makeTranslation(l.x, POOL_Y, l.z)));
  mesh.name = 'kolamCahayaPJU';
  mesh.frustumCulled = false;
  mesh.visible = false;
  parent.add(mesh);
  return mesh;
}

/**
 * Sorot floodlight dari data region (koordinat dunia).
 * @param {THREE.Object3D} parent
 * @param {Array<{x:number,y:number,z:number,tx:number,ty:number,tz:number}>} floods
 */
function createFloodSpots(parent, floods) {
  return floods.map((f, i) => {
    const spot = new THREE.SpotLight(FLOOD_COLOR, 0, FLOOD_DISTANCE, FLOOD_ANGLE, 0.6, 2);
    spot.name = `floodlightSorot-${i}`;
    spot.position.set(f.x, f.y, f.z);
    spot.target.position.set(f.tx, f.ty, f.tz);
    parent.add(spot, spot.target);
    return spot;
  });
}

/** Lepas mesh kolam/halo (geometri, material, peta) dari induknya. */
function releaseObject(obj) {
  if (!obj) return;
  obj.removeFromParent();
  obj.traverse((o) => {
    o.geometry?.dispose();
    o.material?.map?.dispose();
    o.material?.dispose();
  });
  if (obj.isInstancedMesh) obj.dispose();
}

/** Satu set lampu milik satu pendaftar (region): kolam cahaya, halo, sorot floodlight. */
function createLampSet(parent, { lamps = [], lensRoot = null, floods = [] }) {
  const list = lamps.map((l) => ({ x: l.x, z: l.z }));
  const spots = createFloodSpots(parent, floods);
  const pools = list.length ? createLightPools(parent, list) : null;
  const halos = createNightHalos(parent, list.map((l) => ({ x: l.x, y: LAMP_HEIGHT, z: l.z })), lensRoot ?? parent);
  return {
    lamps: list,
    spots,
    pools,
    halos,
    dispose() {
      for (const spot of spots) {
        spot.removeFromParent();
        spot.target.removeFromParent();
        spot.dispose();
      }
      releaseObject(pools);
      releaseObject(halos.group ?? null);
    },
  };
}

/**
 * @param {THREE.Object3D} parent grup pemilik (TimeOfDay.group), bukan scene
 * @returns {{ update(dt, bikePos, bikeYaw?, focus?): void, setLampsOn(on: boolean): void, lampsOn: boolean,
 *   registerLamps(opts?: {lamps?: {x:number,z:number}[], lensRoot?: THREE.Object3D|null,
 *     floods?: Array<{x:number,y:number,z:number,tx:number,ty:number,tz:number}>}): () => boolean,
 *   lampCount: number, registerEmissive(root): () => boolean, unregisterEmissive(root): boolean,
 *   emissiveCount: number, dispose(): void }}
 */
export function createNightLights(parent) {
  const emissives = createMaterialRegistry(selectEmissive, { onRemove: (e) => { e.mat.emissiveIntensity = e.off; } });
  const points = createPointLights(parent);
  const headlight = createHeadlight(parent);
  let sets = [];
  let lamps = [];   // gabungan PJU semua set (dunia)
  let order = [];
  let dist2 = new Float32Array(0);
  let lampsOn = false;
  let level = 0;       // 0..1 intensitas lampu (transisi)
  let pickTimer = 0;

  const rebuildIndex = () => {
    lamps = sets.flatMap((s) => s.lamps);
    order = lamps.map((_, i) => i);
    dist2 = new Float32Array(lamps.length);
    pickTimer = 0; // pilih ulang PJU terdekat pada frame berikutnya
  };

  /** Pilih PJU terdekat (≤ maxPointLights dalam pointLightRange) tiap pointLightInterval. */
  const pickNearest = (pos) => {
    for (let i = 0; i < lamps.length; i += 1) {
      const dx = lamps[i].x - pos.x;
      const dz = lamps[i].z - pos.z;
      dist2[i] = dx * dx + dz * dz;
    }
    order.sort((a, b) => dist2[a] - dist2[b]);
    const maxD2 = DAY.pointLightRange * DAY.pointLightRange;
    points.forEach((light, k) => {
      const idx = order[k];
      const hit = idx !== undefined && dist2[idx] <= maxD2;
      light.userData.active = hit;
      if (hit) light.position.set(lamps[idx].x, LAMP_HEIGHT, lamps[idx].z);
    });
  };

  const updateHeadlight = (pos, yaw) => {
    _fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    headlight.position.set(pos.x + _fwd.x * 0.6, HEADLIGHT_HEIGHT, pos.z + _fwd.z * 0.6);
    headlight.target.position.set(pos.x + _fwd.x * HEADLIGHT_REACH, 0, pos.z + _fwd.z * HEADLIGHT_REACH);
    headlight.intensity = HEADLIGHT_POWER * level;
  };

  const removeSet = (set) => {
    if (!sets.includes(set)) return false;
    sets = sets.filter((s) => s !== set);
    set.dispose();
    rebuildIndex();
    return true;
  };

  return {
    get lampsOn() { return lampsOn; },
    setLampsOn(on) { lampsOn = Boolean(on); },
    /**
     * Daftarkan lampu milik region (koordinat dunia). `lensRoot` = grup tempat mencari lensa
     * floodlight; matriks dunianya harus sudah final. Mengembalikan pencabut (idempoten).
     */
    registerLamps(opts = {}) {
      const set = createLampSet(parent, opts);
      sets = [...sets, set];
      rebuildIndex();
      return () => removeSet(set);
    },
    get lampCount() { return lamps.length; },
    /** Daftarkan material emissive di bawah `root` (region, entitas, GLB yang datang belakangan). */
    registerEmissive: (root) => emissives.register(root),
    unregisterEmissive: (root) => emissives.unregister(root),
    get emissiveCount() { return emissives.size; },
    /** `focus`: pusat pemilihan PJU terdekat (titik pandang POV); lampu depan tetap di sepeda. */
    update(dt, bikePos, bikeYaw = 0, focus = bikePos) {
      const target = lampsOn ? 1 : 0;
      level = THREE.MathUtils.damp(level, target, FADE_RATE * 3, dt);
      if (Math.abs(level - target) < 0.002) level = target;
      for (const e of emissives.entries) e.mat.emissiveIntensity = THREE.MathUtils.lerp(e.off, e.on, level);
      pickTimer -= dt;
      if (pickTimer <= 0) {
        pickTimer = DAY.pointLightInterval;
        pickNearest(focus);
      }
      for (const light of points) light.intensity = light.userData.active ? LAMP_POWER * level : 0;
      for (const set of sets) {
        if (set.pools) {
          set.pools.material.opacity = POOL_OPACITY * level;
          set.pools.visible = level > 0.01;
        }
        set.halos.setLevel(level);
        for (const spot of set.spots) spot.intensity = FLOOD_POWER * level;
      }
      updateHeadlight(bikePos, bikeYaw);
    },
    /** Lepas semua registrasi (nilai emissive siang dipulihkan) dan semua set lampu. */
    dispose() {
      emissives.clear();
      for (const set of sets) set.dispose();
      sets = [];
      rebuildIndex();
    },
  };
}
```

- [ ] **Step 4: `NightHalos` mengembalikan grupnya** (agar set lampu bisa dilepas). Di `src/world/NightHalos.js`:

Ganti JSDoc `@returns` di atas `createNightHalos` (`:78`):
```js
 * @returns {{setLevel(level:number):void}}
```
menjadi:
```js
 * @returns {{group: THREE.Group|null, setLevel(level:number):void}}
```
Ganti `:81`:
```js
  if (typeof document === 'undefined') return { setLevel() {} }; // Node/tes
```
menjadi:
```js
  if (typeof document === 'undefined') return { group: null, setLevel() {} }; // Node/tes
```
Ganti `:91-92`:
```js
  return {
    setLevel(level) {
```
menjadi:
```js
  return {
    group,
    setLevel(level) {
```

- [ ] **Step 5: `TimeOfDay` tanpa opsi lampu konstruksi + `registerLamps`.** Di `src/world/TimeOfDay.js`:

Ganti `:67-76`:
```js
/**
 * @param {THREE.Group} lightingGroup hasil createLighting (userData: sun, hemi, sky, ...)
 * @param {{lamps?: {x:number, z:number}[], lensRoot?: THREE.Object3D|null}} [opts]
 *   lamps: PJU menyala dari region; lensRoot: grup region tempat lensa floodlight
 * @returns {{group: THREE.Group, update(dt, ctx, bikeState?):void, registerEmissive(root):() => boolean,
 *   unregisterEmissive(root):boolean, setHour(h):void, nextPreset():string, toggleSpeed():boolean,
 *   setSpeed(v):void, setAzimuthOffset(deg):void, setCloudCover(v):void, setHaze(v):void, setFogDistance(m):void,
 *   dispose():void, hour:number, presetName:string, speed:number, preset:object, overrides:object}}
 */
export function createTimeOfDay(lightingGroup, scene, renderer, app, { lamps = [], lensRoot = null } = {}) {
```
menjadi:
```js
/**
 * @param {THREE.Group} lightingGroup hasil createLighting (userData: sun, hemi, sky, ...)
 * Lampu milik region (PJU, floodlight, lensa) didaftarkan lewat registerLamps() (koordinat dunia).
 * @returns {{group: THREE.Group, update(dt, ctx, bikeState?):void, registerLamps(opts):() => boolean, registerEmissive(root):() => boolean,
 *   unregisterEmissive(root):boolean, setHour(h):void, nextPreset():string, toggleSpeed():boolean,
 *   setSpeed(v):void, setAzimuthOffset(deg):void, setCloudCover(v):void, setHaze(v):void, setFogDistance(m):void,
 *   dispose():void, hour:number, presetName:string, speed:number, preset:object, overrides:object}}
 */
export function createTimeOfDay(lightingGroup, scene, renderer, app) {
```
Ganti `:90`:
```js
  const night = createNightLights(group, { lamps, lensRoot: lensRoot ?? group });
```
menjadi:
```js
  const night = createNightLights(group);
```
Ganti `:163-164`:
```js
    /** Daftarkan material emissive di bawah root (region/entitas/GLB); kembalikan fungsi unregister. */
    registerEmissive: (root) => night.registerEmissive(root),
```
menjadi:
```js
    /** Daftarkan PJU/floodlight/lensa milik region (koordinat dunia); kembalikan pencabut. */
    registerLamps: (opts) => night.registerLamps(opts),
    /** Daftarkan material emissive di bawah root (region/entitas/GLB); kembalikan fungsi unregister. */
    registerEmissive: (root) => night.registerEmissive(root),
```

- [ ] **Step 6: Data lampu region dalam koordinat dunia** — ganti seluruh isi `src/regions/stadion/lamps.js`:

```js
/**
 * Lampu malam region stadion (dipakai TimeOfDay.registerLamps): PJU yang menyala dan sorot floodlight.
 * Status rusak dibaca dari data layout (flag `broken`), bukan aturan salinan. Posisi region-lokal
 * diubah ke dunia dengan placement region.
 */
import { STADIUM } from './site.js';
import { toWorld } from '../../geo/regionTransform.js';

const FLOOD_INSET = 0.85; // posisi sorot = 85% semi-axis dalam tribun
const FLOOD_DROP = 2;     // m di bawah tinggi atap
const FLOOD_AIM = 0.25;   // titik bidik = 25% ke sisi seberang lapangan

/** PJU menyala, region-lokal. */
export function litLampPositions(layout) {
  return [...layout.plazaLamps, ...layout.ringRoadLamps, ...layout.nagaSaktiLamps]
    .filter((p) => !p.broken)
    .map((p) => ({ x: p.x, z: p.z }));
}

/** Empat sorot floodlight di sudut atap (region-lokal): posisi (x,y,z) dan titik bidik (tx,ty,tz). */
export function floodSpotsLocal(stadium = STADIUM) {
  const x = stadium.innerSemiX * FLOOD_INSET;
  const z = stadium.innerSemiZ * FLOOD_INSET;
  const y = stadium.roofHeight - FLOOD_DROP;
  return [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => ({
    x: sx * x, y, z: sz * z, tx: -sx * x * FLOOD_AIM, ty: 0, tz: -sz * z * FLOOD_AIM,
  }));
}

/**
 * Data TimeOfDay.registerLamps dalam koordinat DUNIA.
 * @param {object} layout LAYOUT region
 * @param {{x:number, z:number, yaw:number}} placement
 * @returns {{lamps: {x:number,z:number}[], floods: Array<{x:number,y:number,z:number,tx:number,ty:number,tz:number}>}}
 */
export function stadionNightLights(layout, placement) {
  const lamps = litLampPositions(layout).map((p) => toWorld(placement, p.x, p.z));
  const floods = floodSpotsLocal().map((f) => {
    const p = toWorld(placement, f.x, f.z);
    const t = toWorld(placement, f.tx, f.tz);
    return { x: p.x, y: f.y, z: p.z, tx: t.x, ty: f.ty, tz: t.z };
  });
  return { lamps, floods };
}
```

- [ ] **Step 7: Region memberi `nightLights`.** Di `src/regions/stadion/index.js`:

Ganti `:13` `import { litLampPositions } from './lamps.js';` menjadi `import { stadionNightLights } from './lamps.js';`.
Sisipkan sebelum `:17` (komentar `/** Fase 0 hanya memakai ctx.scope …`):
```js
export const STADION_PLACEMENT = Object.freeze({ x: 0, z: 0, yaw: 0 });

```
Ganti `:17-18`:
```js
/** Fase 0 hanya memakai ctx.scope (ResourceScope milik region). */
function buildStadion({ scope }) {
```
menjadi:
```js
/** ctx: scope (wajib), placement (default STADION_PLACEMENT; dipakai untuk data lampu dunia). */
function buildStadion({ scope, placement = STADION_PLACEMENT }) {
```
Ganti `:29` `    lamps: litLampPositions(LAYOUT),` menjadi `    nightLights: stadionNightLights(LAYOUT, placement),`.
Ganti `:42` `  placement: { x: 0, z: 0, yaw: 0 },` menjadi `  placement: STADION_PLACEMENT,`.

- [ ] **Step 8: Wiring `main.js`.** Ganti `src/main.js:129-132`:
```js
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app, { lamps: region.lamps, lensRoot: region.group });
  app.scene.add(time.group);
  lifecycle.add(() => time.dispose());
  time.registerEmissive(region.group);
```
menjadi:
```js
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app);
  app.scene.add(time.group);
  lifecycle.add(() => time.dispose());
  // PJU, sorot floodlight, dan lensa milik region (koordinat dunia); LIFO: dicabut sebelum time.dispose.
  lifecycle.add(time.registerLamps({ ...region.nightLights, lensRoot: region.group }));
  time.registerEmissive(region.group);
```

- [ ] **Step 9: Sesuaikan tes lama.**

`tests/nightRegistry.test.js:17-20` — ganti:
```js
  it('objek lampu menempel ke grup pemilik, bukan scene', () => {
    const parent = new THREE.Group();
    createNightLights(parent, { lamps: [{ x: 0, z: 0 }] });
```
menjadi:
```js
  it('objek lampu menempel ke grup pemilik, bukan scene', () => {
    const parent = new THREE.Group();
    const night = createNightLights(parent);
    night.registerLamps({ lamps: [{ x: 0, z: 0 }], floods: [{ x: 0, y: 40, z: 0, tx: 0, ty: 0, tz: 0 }] });
```
`tests/nightRegistry.test.js:26` — ganti `createNightLights(new THREE.Group(), { lamps: [] })` menjadi `createNightLights(new THREE.Group())`.
`tests/lifecycle.test.js:110` — ganti `createTimeOfDay(lighting, scene, {}, fakeApp(), { lamps: [] })` menjadi `createTimeOfDay(lighting, scene, {}, fakeApp())`.
`tests/region.test.js:63` — ganti `expect(built.lamps).toEqual(litLampPositions(LAYOUT));` menjadi `expect(built.nightLights.lamps).toEqual(litLampPositions(LAYOUT));`.

- [ ] **Step 10: Jalankan tes terkait → LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/nightLamps.test.js tests/nightRegistry.test.js tests/lifecycle.test.js tests/nightHalos.test.js tests/region.test.js
```
Expected: PASS.

- [ ] **Step 11: Suite + lint + build**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
Expected: semua lulus. (`grep -n "STADIUM" src/world/TimeOfDay.lights.js` → kosong.)

- [ ] **Step 12: Commit**

```bash
git add src/world/TimeOfDay.lights.js src/world/NightHalos.js src/world/TimeOfDay.js src/regions/stadion/lamps.js src/regions/stadion/index.js src/main.js tests/nightLamps.test.js tests/nightRegistry.test.js tests/lifecycle.test.js tests/region.test.js && git commit -m "refactor: TimeOfDay.registerLamps (lampu, sorot floodlight, lensa dari region dalam koordinat dunia)"
```

---

## Task 3: `mountRegion`/`unmount` + model GLB menjadi konten region

Utang I2 + "build region tidak melepas scope saat throw": unmount di `main.js:99-102` tidak mencabut registry emissive/basah sebelum `disposeTree`, `blenderModels` (`main.js:110-113`, `:134-136`, `:283-286`) berada di luar region & di scope global, dan scope bocor bila `build` melempar. Sesudah task ini satu helper memasang/membongkar region; TimeOfDay/Weather dibuat sebelum region (sistemnya tetap didaftarkan di posisi lama, jadi urutan fase `world` tetap `lighting, wind, stadion.world, timeOfDay, weather`).

**Files:**
- Create: `src/app/mountRegion.js`
- Modify: `src/regions/stadion/index.js` (seluruh berkas)
- Modify: `src/main.js:23-47` (impor), `:90-142`, `:279-286` (hapus `loadBlenderModels`)
- Test: `tests/mountRegion.test.js` (baru); `tests/region.test.js:63`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/mountRegion.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { mountRegion, applyPlacement } from '../src/app/mountRegion.js';
import { defineRegion, validateBuild } from '../src/regions/Region.js';
import { createSystemRunner } from '../src/engine/SystemRunner.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';
import { stadionRegion } from '../src/regions/stadion/index.js';

const square = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
const quiet = { error() {} };

function fakeApp() {
  const runner = createSystemRunner({ logger: quiet });
  return {
    scene: new THREE.Scene(),
    runner,
    addSystem: (s) => runner.add(s),
    removeSystem: (id) => runner.remove(id),
  };
}

/** Registry palsu yang mencatat urutan daftar/cabut ke `log`. */
function fakeRegistries(log) {
  const reg = (name) => (root) => {
    log.push(`+${name}:${root.name}`);
    return () => { log.push(`-${name}:${root.name}`); return true; };
  };
  return {
    time: {
      registerEmissive: reg('emissive'),
      registerLamps: (o) => { log.push(`+lamps:${o.lamps.length}`); return () => { log.push('-lamps'); return true; }; },
    },
    weather: { registerWet: reg('wet') },
  };
}

function testRegion(log, { ready, fail = false } = {}) {
  return defineRegion({
    id: 'uji',
    placement: { x: 100, z: -50, yaw: 0.3 },
    mask: square,
    build: async ({ scope, placement }) => {
      if (fail) throw new Error('build rusak');
      scope.get('mat', () => new THREE.MeshBasicMaterial());
      const group = new THREE.Group();
      group.name = 'region-uji';
      const child = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      child.position.set(10, 0, 0);
      group.add(child);
      const late = new THREE.Group();
      late.name = 'model-uji';
      group.add(late);
      log.push(`build:${placement.x}`);
      return validateBuild({
        group,
        colliders: { isWalkable: () => true, isCameraClear: () => true },
        minimapLayer: () => {},
        systems: [{ id: 'uji.sistem', phase: 'world', update() {}, dispose: () => log.push('sistem.dispose') }],
        nightLights: { lamps: [{ x: 1, z: 1 }], floods: [] },
        lateRoot: late,
        ready,
        dispose: () => { log.push('region.dispose'); group.removeFromParent(); scope.dispose(); },
      }, 'uji');
    },
  });
}

describe('applyPlacement', () => {
  it('titik lokal → dunia sama dengan regionTransform.toWorld', () => {
    const g = new THREE.Group();
    applyPlacement(g, { x: 100, z: -50, yaw: 0.3 });
    g.updateMatrixWorld(true);
    const p = new THREE.Vector3(10, 0, 0).applyMatrix4(g.matrixWorld);
    expect(p.x).toBeCloseTo(100 + Math.cos(0.3) * 10, 9);
    expect(p.z).toBeCloseTo(-50 - Math.sin(0.3) * 10, 9);
  });
});

describe('mountRegion / unmount', () => {
  it('memasang grup bertransformasi, membekukan matriks, mendaftarkan registry & sistem', async () => {
    const log = [];
    const app = fakeApp();
    const { time, weather } = fakeRegistries(log);
    const m = await mountRegion(app, testRegion(log), { time, weather, logger: quiet });
    const g = m.region.group;
    expect(g.parent).toBe(app.scene);
    expect(g.position.toArray()).toEqual([100, 0, -50]);
    expect(g.rotation.y).toBe(0.3);
    expect(g.children[0].matrixAutoUpdate).toBe(false);
    const w = new THREE.Vector3().setFromMatrixPosition(g.children[0].matrixWorld);
    expect(w.x).toBeCloseTo(100 + Math.cos(0.3) * 10, 9);
    expect(app.runner.ids).toEqual(['uji.sistem']);
    expect(log.slice(0, 4)).toEqual(['build:100', '+emissive:region-uji', '+lamps:1', '+wet:region-uji']);
    await m.ready;
    expect(log.at(-1)).toBe('+emissive:model-uji');
  });

  it('unmount terbalik: konten belakangan → sistem (dispose) → registry → region.dispose; idempoten', async () => {
    const log = [];
    const app = fakeApp();
    const { time, weather } = fakeRegistries(log);
    const m = await mountRegion(app, testRegion(log), { time, weather, logger: quiet });
    await m.ready;
    log.length = 0;
    m.unmount();
    m.unmount();
    expect(log).toEqual(['-emissive:model-uji', 'sistem.dispose', '-wet:region-uji', '-lamps', '-emissive:region-uji', 'region.dispose']);
    expect(app.runner.ids).toEqual([]);
    expect(app.scene.children).toHaveLength(0);
    expect(m.mounted).toBe(false);
  });

  it('build yang melempar melepas scope region dan meneruskan galat', async () => {
    const scopes = [];
    const createScope = (name) => { const s = createResourceScope(name); scopes.push(s); return s; };
    await expect(mountRegion(fakeApp(), testRegion([], { fail: true }), { createScope })).rejects.toThrow(/build rusak/);
    expect(scopes).toHaveLength(1);
    expect(scopes[0].disposed).toBe(true);
  });

  it('galat setelah build (id sistem ganda) menggulung balik: region.dispose dipanggil, grup lepas', async () => {
    const log = [];
    const app = fakeApp();
    app.addSystem({ id: 'uji.sistem', phase: 'ui', update() {} });
    await expect(mountRegion(app, testRegion(log), { logger: quiet })).rejects.toThrow(/sudah terdaftar/);
    expect(log).toContain('region.dispose');
    expect(app.scene.children).toHaveLength(0);
  });

  it('unmount sebelum konten belakangan siap: konten itu tidak didaftarkan', async () => {
    const log = [];
    let resolve;
    const ready = new Promise((r) => { resolve = r; });
    const { time } = fakeRegistries(log);
    const m = await mountRegion(fakeApp(), testRegion(log, { ready }), { time, logger: quiet });
    m.unmount();
    resolve({ failed: [] });
    await m.ready;
    expect(log.filter((l) => l.includes('model-uji'))).toEqual([]);
  });

  it('region stadion: mount → unmount 3× kembali ke scene kosong, scope dilepas', async () => {
    for (let i = 0; i < 3; i += 1) {
      const app = fakeApp();
      const scopes = [];
      const createScope = (name) => { const s = createResourceScope(name); scopes.push(s); return s; };
      const m = await mountRegion(app, stadionRegion, { createScope, logger: quiet });
      expect(app.runner.ids).toEqual(['stadion.world']);
      m.unmount();
      expect(app.scene.children).toHaveLength(0);
      expect(app.runner.ids).toEqual([]);
      expect(scopes[0].disposed).toBe(true);
      expect(scopes[0].size).toBe(0);
    }
  }, 60000);
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/mountRegion.test.js
```
Expected: FAIL — `Failed to resolve import "../src/app/mountRegion.js"`.

- [ ] **Step 3: Implementasi helper** — buat `src/app/mountRegion.js`:

```js
/**
 * Pasang region handmade ke App dan bongkar lagi (Plan C, I1/I2):
 * build (ResourceScope milik region) → placement pada region.group → scene + freezeStatic →
 * registry emissive/basah/lampu → sistem region. unmount() membongkar TERBALIK: sistem dicabut
 * (dispose dipanggil SystemRunner), registry dilepas, lalu region.dispose() (disposeTree + scope).
 * Build yang melempar melepas scope-nya; kegagalan setelah build menggulung balik pemasangan.
 */
import { createResourceScope } from '../engine/ResourceScope.js';
import { freezeStatic } from '../world/util/freezeStatic.js';

/** Terapkan placement {x, z, yaw} ke grup region (rotasi sumbu +Y = regionTransform.toWorld). */
export function applyPlacement(group, placement) {
  group.position.set(placement.x, 0, placement.z);
  group.rotation.set(0, placement.yaw, 0);
  group.updateMatrix();
  return group;
}

/**
 * @param {{scene: import('three').Scene, renderer?: object, camera?: object, timer?: object,
 *   addSystem(s: object): object, removeSystem(id: string): boolean}} app
 * @param {{id: string, placement: {x:number,z:number,yaw:number}, build(ctx: object): Promise<object>}} def
 * @param {{store?: object|null, time?: {registerEmissive(root: object): () => boolean,
 *   registerLamps?(opts: object): () => boolean}|null, weather?: {registerWet(root: object): () => boolean}|null,
 *   createScope?: (name: string) => object, logger?: {error: (...args: unknown[]) => void}}} [opts]
 * @returns {Promise<{def: object, region: object, ready: Promise<unknown>, mounted: boolean, unmount(): void}>}
 */
export async function mountRegion(app, def, {
  store = null, time = null, weather = null, createScope = createResourceScope, logger = console,
} = {}) {
  const scope = createScope(`region:${def.id}`);
  let region;
  try {
    region = await def.build({
      scene: app.scene, renderer: app.renderer, camera: app.camera, scope, store, clock: app.timer, placement: def.placement,
    });
  } catch (err) {
    scope.dispose(); // build gagal: scope tidak boleh bocor
    throw err;
  }
  const undo = []; // LIFO
  const unwind = () => {
    while (undo.length) {
      const fn = undo.pop();
      try {
        fn();
      } catch (err) {
        logger.error(`Region "${def.id}": pembongkaran gagal (dilanjutkan):`, err);
      }
    }
  };
  try {
    undo.push(() => region.dispose());
    applyPlacement(region.group, def.placement);
    app.scene.add(region.group);
    freezeStatic(region.group);
    if (time) undo.push(time.registerEmissive(region.group));
    if (time?.registerLamps && region.nightLights) undo.push(time.registerLamps({ ...region.nightLights, lensRoot: region.group }));
    if (weather) undo.push(weather.registerWet(region.group));
    for (const system of region.systems) {
      app.addSystem(system);
      undo.push(() => app.removeSystem(system.id));
    }
  } catch (err) {
    unwind();
    throw err;
  }
  let mounted = true;
  // Konten yang datang belakangan (model GLB) baru terdaftar setelah siap, dan hanya bila masih terpasang.
  const ready = Promise.resolve(region.ready).then((result) => {
    if (mounted && time && region.lateRoot) undo.push(time.registerEmissive(region.lateRoot));
    return result;
  });
  return {
    def,
    region,
    ready,
    get mounted() { return mounted; },
    unmount() {
      if (!mounted) return;
      mounted = false;
      unwind();
    },
  };
}
```

- [ ] **Step 4: Model GLB menjadi konten region** — ganti seluruh isi `src/regions/stadion/index.js`:

```js
/**
 * Region handmade "stadion": kawasan Stadion Utama Riau yang sudah ada, dibungkus kontrak Region
 * (regions/Region.js). Model GLB Blender (layout.blenderModels) adalah konten region: dimuat ke
 * scope region dan dilepas bersama region.
 */
import { defineRegion, validateBuild } from '../Region.js';
import { withScope } from '../../engine/ResourceScope.js';
import { disposeTree } from '../../engine/disposeTree.js';
import { buildWorld } from '../../world/index.js';
import { createModelGroup, placeModels } from '../../world/assets/models.js';
import { stadionColliders } from './collider.js';
import { SITE } from './site.js';
import { LAYOUT } from './layout.js';
import { STADION_MASK } from './mask.js';
import { stadionNightLights } from './lamps.js';

export const STADION_ID = 'stadion';
export const STADION_PLACEMENT = Object.freeze({ x: 0, z: 0, yaw: 0 });

/** Muat model GLB ke grup `models` di scope region (loadModel memanggil scope.get secara sinkron). */
function loadModels(scope, models, worldGroup, enabled) {
  if (!enabled) return Promise.resolve({ placed: 0, failed: [], replaced: [] });
  return withScope(scope, () => placeModels(models, LAYOUT.blenderModels, { world: worldGroup }));
}

/** ctx: scope (wajib), placement (default STADION_PLACEMENT), loadModels (default true). */
function buildStadion({ scope, placement = STADION_PLACEMENT, loadModels: withModels = true }) {
  if (!scope) throw new TypeError('Region stadion: ctx.scope (ResourceScope) wajib');
  const world = withScope(scope, () => buildWorld({ layout: LAYOUT, site: SITE }));
  const models = createModelGroup();
  world.group.add(models);
  const ready = loadModels(scope, models, world.group, withModels);
  let disposed = false;
  return validateBuild({
    group: world.group,
    colliders: stadionColliders,
    minimapLayer: () => {}, // peta dasar region di-bake App.bakeMinimap dari layer minimap
    systems: [{ id: 'stadion.world', phase: 'world', update: (dt, ctx) => world.update(dt, ctx.time, ctx.focus), dispose() {} }],
    seatSamples: world.seatSamples,
    layout: LAYOUT,
    nightLights: stadionNightLights(LAYOUT, placement),
    lateRoot: models,
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      world.group.removeFromParent();
      disposeTree(world.group, { scope });
      scope.dispose();
    },
  }, STADION_ID);
}

export const stadionRegion = defineRegion({
  id: STADION_ID,
  placement: STADION_PLACEMENT,
  mask: STADION_MASK,
  build: async (ctx) => buildStadion(ctx ?? {}),
});
```

- [ ] **Step 5: Wiring `main.js`.**

Impor — hapus `src/main.js:25` (`import { freezeStatic } …`), `:26` (`import { createModelGroup, placeModels } …`), `:40` (`import { createResourceScope } …`); tambahkan setelah `:47`:
```js
import { mountRegion } from './app/mountRegion.js';
```
Ganti `src/main.js:90-115` (dari `await loading.step(0.12, …` sampai `region.systems.forEach((s) => app.addSystem(s));`):
```js
  await loading.step(0.12, 'Menyiapkan langit dan pencahayaan…');
  const lighting = createLighting(app.scene, app.renderer);
  app.scene.add(lighting);
  app.addSystem({ id: 'lighting', phase: 'world', update: (dt, ctx) => lighting.userData.update?.(dt, ctx.time, ctx.focus, ctx.shadowFrame) });

  await loading.step(0.2, 'Membangun stadion, tribun, dan lingkungan…');
  const region = await stadionRegion.build({
    scene: app.scene, renderer: app.renderer, camera: app.camera, scope: createResourceScope('region:stadion'), store, clock: app.timer,
  });
  lifecycle.add(() => {
    region.systems.forEach((s) => app.removeSystem(s.id)); // region.dispose() tidak mencabut sistemnya dari App
    region.dispose();
  });
  app.scene.add(region.group);
  freezeStatic(region.group); // dunia statis: matriks dihitung sekali, tidak per frame
  const colliders = createCompositeCollider({
    regions: [{ region: stadionRegion, colliders: region.colliders }],
    fallback: localized(stadionRegion, region.colliders), // Fase 0: tanah region (1,4 km) masih menutup seluruh dunia; Fase 2: TileCollider
  });
  rig.setObstacleTest(colliders.isCameraClear);
  const blenderModels = createModelGroup();
  app.scene.add(blenderModels);
  lifecycle.add(() => { blenderModels.removeFromParent(); disposeTree(blenderModels); });
  const modelsReady = loadBlenderModels(blenderModels, region, hud);
  app.addSystem({ id: 'wind', phase: 'world', update: (dt) => updateWind(dt) }); // angin global tiap frame
  region.systems.forEach((s) => app.addSystem(s));
```
menjadi:
```js
  await loading.step(0.12, 'Menyiapkan langit, pencahayaan, waktu, dan cuaca…');
  const lighting = createLighting(app.scene, app.renderer);
  app.scene.add(lighting);
  app.addSystem({ id: 'lighting', phase: 'world', update: (dt, ctx) => lighting.userData.update?.(dt, ctx.time, ctx.focus, ctx.shadowFrame) });
  // Siklus waktu & cuaca dibuat sebelum region: region mendaftar ke registry emissive/basah/lampu saat dipasang.
  // Sistemnya tetap didaftarkan sesudah entitas (urutan fase world tidak berubah).
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app);
  app.scene.add(time.group);
  lifecycle.add(() => time.dispose());
  const weather = createWeather(app.scene, app, lighting, { audioBus });
  app.scene.add(weather.group);
  lifecycle.add(() => weather.dispose());

  await loading.step(0.2, 'Membangun stadion, tribun, dan lingkungan…');
  app.addSystem({ id: 'wind', phase: 'world', update: (dt) => updateWind(dt) }); // angin global tiap frame
  const stadion = await mountRegion(app, stadionRegion, { store, time, weather });
  lifecycle.add(() => stadion.unmount()); // LIFO: dicabut sebelum time/weather di-dispose
  const region = stadion.region;
  const colliders = createCompositeCollider({
    regions: [{ region: stadionRegion, colliders: region.colliders }],
    fallback: localized(stadionRegion, region.colliders), // Fase 0: tanah region (1,4 km) masih menutup seluruh dunia; Fase 2: TileCollider
  });
  rig.setObstacleTest(colliders.isCameraClear);
  const modelsReady = stadion.ready
    .then(({ failed }) => { if (failed.length) hud.toast(`${failed.length} model 3D gagal dimuat`, false); })
    .catch((err) => console.error('Model 3D region gagal diproses:', err));
```
Ganti blok waktu/cuaca (isi Task 2 di sekitar `:127-142`, dari `await loading.step(0.8, …` sampai sebelum `app.addSystem({ id: 'timeOfDay', …`):
```js
  await loading.step(0.8, 'Menyiapkan siklus waktu dan cuaca…');
  // Siklus waktu & cuaca: objeknya di grup sendiri; material emissive/basah didaftarkan lewat registry.
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app);
  app.scene.add(time.group);
  lifecycle.add(() => time.dispose());
  // PJU, sorot floodlight, dan lensa milik region (koordinat dunia); LIFO: dicabut sebelum time.dispose.
  lifecycle.add(time.registerLamps({ ...region.nightLights, lensRoot: region.group }));
  time.registerEmissive(region.group);
  time.registerEmissive(ents.group);
  modelsReady
    .then(() => time.registerEmissive(blenderModels)) // GLB yang datang belakangan ikut menyala malam hari
    .catch((err) => console.error('Registrasi emissive model 3D gagal:', err));
  const weather = createWeather(app.scene, app, lighting, { audioBus });
  app.scene.add(weather.group);
  lifecycle.add(() => weather.dispose());
  weather.registerWet(region.group);
```
menjadi:
```js
  await loading.step(0.8, 'Menyiapkan siklus waktu dan cuaca…');
  time.registerEmissive(ents.group);
```
Hapus fungsi `loadBlenderModels` beserta JSDoc-nya (`src/main.js:279-286`).

- [ ] **Step 6: Tes region memeriksa grup model.** `tests/region.test.js` (hasil Task 2) — ganti `expect(built.nightLights.lamps).toEqual(litLampPositions(LAYOUT));` menjadi:
```js
    expect(built.nightLights.lamps).toEqual(litLampPositions(LAYOUT));
    expect(built.lateRoot.parent).toBe(built.group);
```

- [ ] **Step 7: Jalankan tes → LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/mountRegion.test.js tests/region.test.js tests/lifecycle.test.js tests/models.test.js
```
Expected: PASS (mountRegion 7 tes).

- [ ] **Step 8: Suite + lint + build + paritas**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
Paritas (harness Plan A, SwiftShader): expected callsMean dalam ±5% dari 502, malam 589/707, memori 425/72 (saat rencana disusun: 501, 589/707, 425/72), 0 galat, teardown bersih. Daftar sistem harus memuat `…, lighting, wind, stadion.world, timeOfDay, weather, …`.

- [ ] **Step 9: Commit**

```bash
git add src/app/mountRegion.js src/regions/stadion/index.js src/main.js tests/mountRegion.test.js tests/region.test.js && git commit -m "feat: mountRegion/unmount (scope dilepas saat build gagal, bongkar terbalik, registry dicabut sebelum disposeTree) dan model GLB sebagai konten region"
```

---

## Task 4: Placement ujung-ke-ujung (I1)

I1: placement hanya dihormati collider. Sesudah task ini `region.group` ditransformasi sebelum `freezeStatic` (sudah di Task 3 lewat `applyPlacement`), dan semua konsumen koordinat region memakai satu frame: entitas region (di bawah grup jangkar ber-placement, ctx region-lokal), GLB (anak `region.group`), lampu/halo/sorot (`nightLights` dunia, Task 2), cerita (posisi sepeda diubah ke lokal; tujuan/pin minimap diubah ke dunia), POV tetap & rute kamera, `START_POS` (kini region-lokal), bake minimap (berpusat placement), titik genangan. Placement default tetap identitas (Task 18 menghitungnya dari OSM). Mode dev `?placement=x,z,yaw` memindahkan region untuk uji manual/E2E.

**Files:**
- Modify: `src/geo/regionTransform.js` (tambah setelah `:27`)
- Create: `src/app/regionContext.js`
- Modify: `src/regions/Region.js` (tambah setelah `:52`)
- Modify: `src/core/cameraPresets.js:93` (rename), sisip setelah `:117`, `:203`, `:235`
- Modify: `src/core/PovDirector.js:164`
- Modify: `src/core/povSource.js:1-51` (seluruh berkas)
- Modify: `src/entities/index.js:1-40` (seluruh berkas)
- Modify: `src/app/devtools.js:4-6`, `src/app/keymap.js:8`, `:13`, `:25`
- Modify: `src/shared/minimapMath.js:7-16`, `src/ui/Minimap2D.js:24`, `:40-45`, `:66`
- Modify: `src/core/App.js:285-295`
- Modify: `src/world/Weather.js:101`, `:107`; `src/world/Weather.wet.js:116-124`
- Modify: `src/main.js` (impor, `START_POS`, frame, entitas, cerita, minimap, sistem frame)
- Test: `tests/regionTransform.test.js` (tambah), `tests/regionContext.test.js` (baru), `tests/placement.test.js` (baru)

- [ ] **Step 1: Tulis tes yang gagal.**

Tambahkan di akhir `tests/regionTransform.test.js`:
```js
describe('createRegionFrame (Plan C)', () => {
  it('membungkus toWorld/toLocal; yaw dunia = yaw lokal + placement.yaw', async () => {
    const { createRegionFrame, IDENTITY_FRAME } = await import('../src/geo/regionTransform.js');
    const f = createRegionFrame({ x: 100, z: -50, yaw: 0.3 });
    expect(f.identity).toBe(false);
    expect(f.toWorld(10, -25)).toEqual(toWorld(f.placement, 10, -25));
    const l = f.toLocal(f.toWorld(3, 4).x, f.toWorld(3, 4).z);
    expect(l.x).toBeCloseTo(3, 9);
    expect(l.z).toBeCloseTo(4, 9);
    // arah maju lokal (sin y, cos y) dirotasi placement = (sin(y+θ), cos(y+θ))
    const y = 1.1;
    const tip = f.toWorld(Math.sin(y), Math.cos(y));
    const base = f.toWorld(0, 0);
    expect(Math.atan2(tip.x - base.x, tip.z - base.z)).toBeCloseTo(f.yawToWorld(y), 9);
    expect(f.yawToLocal(f.yawToWorld(y))).toBeCloseTo(y, 12);
    expect(IDENTITY_FRAME.identity).toBe(true);
    expect(Object.isFrozen(f.placement)).toBe(true);
    expect(() => createRegionFrame({ x: 0, z: 0 })).toThrow(TypeError);
  });
});
```
Buat `tests/regionContext.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createLocalContext, pointToWorld, pointToLocal } from '../src/app/regionContext.js';
import { createRegionFrame, IDENTITY_FRAME } from '../src/geo/regionTransform.js';

const frame = createRegionFrame({ x: 100, z: -50, yaw: 0.3 });

describe('konteks region-lokal', () => {
  it('frame identitas: ctx dikembalikan apa adanya', () => {
    const ctx = { bikePos: { x: 1, y: 0, z: 2 } };
    expect(createLocalContext(IDENTITY_FRAME)(ctx)).toBe(ctx);
  });

  it('bikePos & focus diubah ke lokal, field lain tetap; cache per objek ctx', () => {
    const local = createLocalContext(frame);
    const w = frame.toWorld(5, -7);
    const ctx = { time: 3, input: 'in', bikePos: { x: w.x, y: 0, z: w.z }, focus: null };
    const a = local(ctx);
    expect(a.bikePos.x).toBeCloseTo(5, 9);
    expect(a.bikePos.z).toBeCloseTo(-7, 9);
    expect(a.focus).toBeNull();
    expect(a.time).toBe(3);
    expect(a.input).toBe('in');
    expect(local(ctx)).toBe(a);
    expect(local({ ...ctx })).not.toBe(a);
  });

  it('pointToWorld/pointToLocal saling berkebalikan; null aman; identitas = objek sama', () => {
    const p = { x: 12, z: -3, color: 'merah' };
    const w = pointToWorld(frame, p);
    expect(w.color).toBe('merah');
    const back = pointToLocal(frame, w);
    expect(back.x).toBeCloseTo(12, 9);
    expect(back.z).toBeCloseTo(-3, 9);
    expect(pointToWorld(frame, null)).toBeNull();
    expect(pointToWorld(IDENTITY_FRAME, p)).toBe(p);
  });
});
```
Buat `tests/placement.test.js` (uji ujung-ke-ujung dengan placement `{x:100, z:-50, yaw:0.3}`):
```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createRegionFrame } from '../src/geo/regionTransform.js';
import { POV_BY_ID, povPose, createPose, routeControl, poseToWorld } from '../src/core/cameraPresets.js';
import { createPovSource } from '../src/core/povSource.js';
import { sourceRect } from '../src/shared/minimapMath.js';
import { withPlacement, regionContains } from '../src/regions/Region.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { SITE } from '../src/regions/stadion/site.js';
import { createSystemRunner } from '../src/engine/SystemRunner.js';
import { mountRegion } from '../src/app/mountRegion.js';
import { parsePlacementParam } from '../src/app/devtools.js';
import { createCompositeCollider } from '../src/core/Collider.js';

const P = { x: 100, z: -50, yaw: 0.3 };
const frame = createRegionFrame(P);
const quiet = { error() {} };

describe('placement non-identitas ujung-ke-ujung (I1)', () => {
  it('POV tetap (udara/tribun/orbit) = pose lokal yang diubah ke dunia; POV ikut tidak diubah', () => {
    const bike = { x: 5, z: 6, yaw: 0 };
    for (const id of ['udara', 'tribun', 'orbit']) {
      const local = createPose();
      const world = createPose();
      povPose(POV_BY_ID[id], { bike }, 0, 12, local);
      povPose(POV_BY_ID[id], { bike, frame }, 0, 12, world);
      const want = poseToWorld({ ...local }, frame);
      for (const k of ['px', 'py', 'pz', 'tx', 'ty', 'tz']) expect(world[k]).toBeCloseTo(want[k], 9);
    }
    const a = createPose();
    const b = createPose();
    povPose(POV_BY_ID.atas, { bike }, 0, 0, a);
    povPose(POV_BY_ID.atas, { bike, frame }, 0, 0, b);
    expect(b).toEqual(a);
  });

  it('rute kamera dihitung di frame region: hasil = rute lokal yang diubah ke dunia', () => {
    const la = { ...createPose(), px: 0, py: 150, pz: -400, tx: 0, ty: 0, tz: 0 };
    const ld = { ...createPose(), px: 10, py: 5, pz: 20, tx: 0, ty: 0, tz: 0 };
    const lc1 = {};
    const lc2 = {};
    routeControl(la, ld, lc1, lc2);
    const wc1 = {};
    const wc2 = {};
    routeControl(poseToWorld({ ...la }, frame), poseToWorld({ ...ld }, frame), wc1, wc2, frame);
    const e1 = frame.toWorld(lc1.x, lc1.z);
    expect(wc1.x).toBeCloseTo(e1.x, 9);
    expect(wc1.z).toBeCloseTo(e1.z, 9);
    expect(wc1.y).toBeCloseTo(lc1.y, 9);
    expect(wc2.y).toBeCloseTo(lc2.y, 9);
  });

  it('sumber POV: bola & pedagang region-lokal → dunia (yaw + placement.yaw)', () => {
    const ents = {
      bike: { state: { x: 0, z: 0, yaw: 0 } },
      match: { ball: { pos: { x: 4, z: -6 } } },
      vendors: { vendors: [{ position: { x: -20, z: -188 }, yaw: 1 }] },
    };
    const src = createPovSource(ents, frame);
    const ball = src.ball();
    const wb = frame.toWorld(4, -6);
    expect([ball.x, ball.z]).toEqual([wb.x, wb.z]);
    const v = src.vendor(0);
    const wv = frame.toWorld(-20, -188);
    expect([v.x, v.z]).toEqual([wv.x, wv.z]);
    expect(v.yaw).toBeCloseTo(1.3, 12);
    expect(src.frame).toBe(frame);
  });

  it('minimap: jendela sumber relatif terhadap pusat bake (placement)', () => {
    const r0 = sourceRect({ x: 0, z: 0 }, 160, 700, 1400);
    const r1 = sourceRect({ x: P.x, z: P.z }, 160, 700, 1400, P);
    expect(r1).toEqual(r0);
  });

  it('region terpasang: grup, lampu malam, model GLB, mask, collider mengikuti placement', async () => {
    const def = withPlacement(stadionRegion, P);
    const runner = createSystemRunner({ logger: quiet });
    const app = { scene: new THREE.Scene(), addSystem: (s) => runner.add(s), removeSystem: (id) => runner.remove(id) };
    const lampsSeen = [];
    const time = {
      registerEmissive: () => () => true,
      registerLamps: (o) => { lampsSeen.push(o); return () => true; },
    };
    const m = await mountRegion(app, def, { time, logger: quiet });
    const g = m.region.group;
    const tugu = new THREE.Vector3(SITE.tugu.x, 0, SITE.tugu.z).applyMatrix4(g.matrixWorld);
    const want = frame.toWorld(SITE.tugu.x, SITE.tugu.z);
    expect(tugu.x).toBeCloseTo(want.x, 6);
    expect(tugu.z).toBeCloseTo(want.z, 6);
    const lamp0 = m.region.nightLights.lamps[0];
    expect(lampsSeen[0].lamps[0]).toEqual(lamp0);
    expect(m.region.lateRoot.parent).toBe(g); // model GLB ikut transform region
    expect(regionContains(def, want.x, want.z)).toBe(true);
    expect(regionContains(def, SITE.tugu.x, SITE.tugu.z - 300)).toBe(false);
    const comp = createCompositeCollider({ regions: [{ region: def, colliders: m.region.colliders }], fallback: { isWalkable: () => true, isCameraClear: () => true } });
    expect(comp.isWalkable(want.x, want.z)).toBe(false); // kolam tugu (dunia) tetap padat
    m.unmount();
  }, 30000);

  it('parsePlacementParam: ?placement=x,z,yaw; selain itu null', () => {
    expect(parsePlacementParam('?placement=100,-50,0.3')).toEqual(P);
    expect(parsePlacementParam('?placement=1,2')).toBeNull();
    expect(parsePlacementParam('?placement=a,b,c')).toBeNull();
    expect(parsePlacementParam('')).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/regionTransform.test.js tests/regionContext.test.js tests/placement.test.js
```
Expected: FAIL — `createRegionFrame is not a function`, `Failed to resolve import "../src/app/regionContext.js"`, `withPlacement`/`poseToWorld`/`parsePlacementParam` tidak diekspor.

- [ ] **Step 3: Frame region** — tambahkan di akhir `src/geo/regionTransform.js`:
```js

/**
 * Frame region: placement beku + konversi titik & yaw. yaw entitas memakai konvensi maju = (sin, cos)
 * sehingga yaw dunia = yaw lokal + placement.yaw. `identity` = placement {0, 0, 0} (jalur cepat).
 * @param {{x:number, z:number, yaw:number}} placement
 */
export function createRegionFrame(placement) {
  assertPlacement(placement);
  const p = Object.freeze({ x: placement.x, z: placement.z, yaw: placement.yaw });
  return Object.freeze({
    placement: p,
    identity: p.x === 0 && p.z === 0 && p.yaw === 0,
    toWorld: (x, z) => toWorld(p, x, z),
    toLocal: (x, z) => toLocal(p, x, z),
    yawToWorld: (yaw) => yaw + p.yaw,
    yawToLocal: (yaw) => yaw - p.yaw,
  });
}

export const IDENTITY_FRAME = createRegionFrame({ x: 0, z: 0, yaw: 0 });
```
Buat `src/app/regionContext.js`:
```js
/**
 * Konteks frame untuk sistem region-lokal (entitas, cerita): ctx dunia → ctx dengan bikePos/focus
 * dalam koordinat region. Hasil di-cache per objek ctx (satu konversi per frame untuk semua
 * entitas). Frame identitas mengembalikan ctx apa adanya (paritas bit-exact).
 */
const localPoint = (frame, p) => {
  if (!p) return p;
  const l = frame.toLocal(p.x, p.z);
  return { x: l.x, y: p.y ?? 0, z: l.z };
};

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

/** Titik region-lokal → dunia ({x, z}); null tetap null. */
export function pointToWorld(frame, p) {
  if (!p) return p ?? null;
  if (frame.identity) return p;
  const w = frame.toWorld(p.x, p.z);
  return { ...p, x: w.x, z: w.z };
}

/** Titik dunia → region-lokal ({x, z}); null tetap null. */
export function pointToLocal(frame, p) {
  if (!p) return p ?? null;
  if (frame.identity) return p;
  const l = frame.toLocal(p.x, p.z);
  return { ...p, x: l.x, z: l.z };
}
```
Tambahkan di akhir `src/regions/Region.js`:
```js

/** Salinan definisi region dengan placement lain (uji placement non-identitas, mode dev). */
export function withPlacement(region, placement) {
  return defineRegion({ ...region, placement });
}
```

- [ ] **Step 4: Kamera.** Di `src/core/cameraPresets.js`:

Ganti `:93` `export function routeControl(a, d, c1, c2) {` menjadi `function routeControlLocal(a, d, c1, c2) {` (JSDoc di atasnya tetap).
Sisipkan setelah penutup fungsi itu (`}` di `:117`, sebelum `/** Bezier kubik B(t)…`):
```js

const _routeA = createPose();
const _routeD = createPose();

/** Ubah pose (posisi + titik pandang) region-lokal → dunia, di tempat. */
export function poseToWorld(pose, frame) {
  const p = frame.toWorld(pose.px, pose.pz);
  const t = frame.toWorld(pose.tx, pose.tz);
  pose.px = p.x; pose.pz = p.z; pose.tx = t.x; pose.tz = t.z;
  return pose;
}

/** Ubah pose dunia → region-lokal, di tempat. */
export function poseToLocal(pose, frame) {
  const p = frame.toLocal(pose.px, pose.pz);
  const t = frame.toLocal(pose.tx, pose.tz);
  pose.px = p.x; pose.pz = p.z; pose.tx = t.x; pose.tz = t.z;
  return pose;
}

/**
 * Titik kontrol rute A→D (lihat routeControlLocal). Pose a/d dalam koordinat dunia; `frame` = frame
 * region stadion (geometri cangkang region-lokal). Tanpa frame / frame identitas = perilaku lama.
 */
export function routeControl(a, d, c1, c2, frame = null) {
  if (!frame || frame.identity) {
    routeControlLocal(a, d, c1, c2);
    return;
  }
  routeControlLocal(poseToLocal(copyPose(_routeA, a), frame), poseToLocal(copyPose(_routeD, d), frame), c1, c2);
  const w1 = frame.toWorld(c1.x, c1.z);
  const w2 = frame.toWorld(c2.x, c2.z);
  c1.x = w1.x; c1.z = w1.z;
  c2.x = w2.x; c2.z = w2.z;
}
```
Ganti `:203`:
```js
 *   vendor?:(i:number)=>({x:number,z:number,yaw:number}|null)}} src
```
menjadi:
```js
 *   vendor?:(i:number)=>({x:number,z:number,yaw:number}|null), frame?:object}} src
 *   frame: frame region stadion (createRegionFrame); POV tetap (udara/tribun/orbit) dihitung lokal lalu diubah ke dunia
```
Ganti `:235` `  out.fov = def.fov;` (di `povPose`) menjadi:
```js
  if (def.kind !== 'follow' && src.frame && !src.frame.identity) poseToWorld(out, src.frame); // pose tetap region-lokal
  out.fov = def.fov;
```
Di `src/core/PovDirector.js:164` ganti `    routeControl(f, d, this._c1, this._c2);` menjadi `    routeControl(f, d, this._c1, this._c2, src?.frame ?? null);`.

Ganti seluruh isi `src/core/povSource.js`:
```js
import { pointOnLane } from '../sim/trackPath.js';
import { IDENTITY_FRAME } from '../geo/regionTransform.js';

/**
 * Adapter entitas → sumber posisi untuk POV (lihat cameraPresets.povPose).
 * Entitas region (bola, pelari, pedagang) hidup di koordinat region-lokal; adapter mengubahnya ke
 * frame dunia lewat `frame` (createRegionFrame). Sepeda sudah di koordinat dunia.
 * Mengembalikan objek yang dipakai ulang (tanpa alokasi per panggilan selain hasil sim).
 * @param {{bike:{state:object}, match?:{ball?:{pos:{x:number,z:number}}},
 *   runners?:{runners:object[]}, vendors?:{vendors:object[]}}} ents
 * @param {{identity:boolean, toWorld(x:number,z:number):{x:number,z:number}, yawToWorld(y:number):number}} [frame]
 */
export function createPovSource(ents, frame = IDENTITY_FRAME) {
  const ballOut = { x: 0, z: 0 };
  const runnerOut = { x: 0, z: 0, yaw: 0 };
  const vendorOut = { x: 0, z: 0, yaw: 0 };
  const wrap = (i, n) => ((i % n) + n) % n;
  const place = (out, x, z, yaw) => {
    if (frame.identity) {
      out.x = x;
      out.z = z;
      if (yaw !== undefined) out.yaw = yaw;
      return out;
    }
    const w = frame.toWorld(x, z);
    out.x = w.x;
    out.z = w.z;
    if (yaw !== undefined) out.yaw = frame.yawToWorld(yaw);
    return out;
  };

  return {
    frame,
    get bike() { return ents.bike.state; },

    ball() {
      const pos = ents.match?.ball?.pos;
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return null;
      return place(ballOut, pos.x, pos.z);
    },

    runnerCount() { return ents.runners?.runners.length ?? 0; },
    runner(i) {
      const list = ents.runners?.runners ?? [];
      if (list.length === 0) return null;
      const r = list[wrap(i, list.length)];
      const p = pointOnLane(r.lane, r.dist);
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.z)) return null;
      return place(runnerOut, p.x, p.z, p.yaw ?? 0);
    },

    vendorCount() { return ents.vendors?.vendors.length ?? 0; },
    vendor(i) {
      const list = ents.vendors?.vendors ?? [];
      if (list.length === 0) return null;
      const v = list[wrap(i, list.length)];
      if (!Number.isFinite(v?.position?.x) || !Number.isFinite(v?.position?.z)) return null;
      return place(vendorOut, v.position.x, v.position.z, v.yaw ?? 0);
    },
  };
}
```

- [ ] **Step 5: Entitas region terpisah dari sepeda** — ganti seluruh isi `src/entities/index.js`:
```js
import * as THREE from 'three';
import { Bicycle } from './Bicycle.js';
import { RunnerGroup, LoopWalkers } from './Runner.js';
import { FootballMatch } from './Footballer.js';
import { VendorGroup } from './Vendor.js';
import { Crowd } from './Crowd.js';
import { createHumanoidLod } from './Humanoid.lod.js';

/**
 * Merakit semua entitas bergerak. Sepeda hidup di koordinat DUNIA (`group`); entitas region
 * (pelari, pemain bola, pedagang, penonton) di koordinat region-lokal (`regionGroup`, dipasang di
 * bawah grup ber-placement oleh composition root).
 * @param {{start:{x:number,z:number,yaw:number}, world:{seatSamples:object[], layout:object}, wallet:object,
 *   camera?:import('three').Camera}} opts  start: posisi DUNIA sepeda; camera: dipakai LOD humanoid
 * @returns {{group: THREE.Group, regionGroup: THREE.Group, bike: Bicycle, runners: RunnerGroup,
 *   walkers: LoopWalkers[], match: FootballMatch, vendors: VendorGroup, crowd: Crowd,
 *   updatables: Array<{update(dt:number, ctx:object):void}>, lod: object}}
 */
export function buildEntities({ start, world, wallet, camera }) {
  const group = new THREE.Group();
  group.name = 'entities';
  const regionGroup = new THREE.Group();
  regionGroup.name = 'entitasRegion';
  const { layout } = world;

  const bike = new Bicycle({ x: start.x, z: start.z, yaw: start.yaw, frameColor: 0x1d4e89 });
  const runners = new RunnerGroup({ count: 8 });
  const walkers = layout.loopWalkers.map((cfg, i) => new LoopWalkers({ ...cfg, seed: 23 + i }));
  const match = new FootballMatch({ teamSize: 5 });
  const vendors = new VendorGroup({ vendors: layout.vendors, wallet });
  const crowd = new Crowd({
    seatSamples: world.seatSamples,
    plazaCenter: layout.plazaCenter,
    plazaSpots: layout.plazaSpots,
    count: 20,
  });

  const updatables = [bike, runners, ...walkers, match, vendors, crowd];
  group.add(bike.group);
  for (const e of updatables) if (e !== bike) regionGroup.add(e.group);

  // LOD humanoid: detail penuh dekat kamera, satu mesh gabungan di jarak menengah, sembunyi di jauh.
  const lod = createHumanoidLod();
  lod.addFrom(group);
  lod.addFrom(regionGroup);
  if (camera) updatables.push({ update: () => lod.update(camera.position) });

  return { group, regionGroup, bike, runners, walkers, match, vendors, crowd, updatables, lod };
}
```

- [ ] **Step 6: Dev, hotkey, minimap, bake, genangan.**

`src/app/devtools.js` — ganti `:4` `import { createCollider } from '../core/Collider.js';` menjadi:
```js
import { createCollider } from '../core/Collider.js';

/**
 * Placement uji dari query string `?placement=x,z,yaw` (meter, meter, radian); null bila tidak ada
 * atau tidak valid. Hanya dipakai mode dev (uji placement non-identitas ujung-ke-ujung).
 */
export function parsePlacementParam(search) {
  const raw = new URLSearchParams(search ?? '').get('placement');
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 3 || !parts.every(Number.isFinite)) return null;
  const [x, z, yaw] = parts;
  return { x, z, yaw };
}
```
`src/app/keymap.js` — setelah `:8` tambahkan `import { pointToLocal } from './regionContext.js';`; ganti `:13` signature menjadi `export function handleKeys(input, { rig, hud, ents, shop, time, store, story, frame }) {`; ganti `:25` menjadi:
```js
    if (hud.shopOpen || !story.tryInteract(pointToLocal(frame, ents.bike.state))) handleShopKey(rig, hud, ents, shop); // cerita region-lokal
```
`src/shared/minimapMath.js:7-16` — ganti:
```js
/** Persegi sumber (piksel peta dasar) untuk jendela ±halfExtent meter di sekitar fokus. */
export function sourceRect(focus, halfExtent, worldHalf, basePx) {
  const k = basePx / (2 * worldHalf);
  return {
    sx: (fin(focus?.x) + worldHalf - halfExtent) * k,
    sy: (fin(focus?.z) + worldHalf - halfExtent) * k,
```
menjadi:
```js
/**
 * Persegi sumber (piksel peta dasar) untuk jendela ±halfExtent meter di sekitar fokus.
 * `center` = pusat dunia peta dasar (posisi kamera bake; default origin).
 */
export function sourceRect(focus, halfExtent, worldHalf, basePx, center = null) {
  const k = basePx / (2 * worldHalf);
  return {
    sx: (fin(focus?.x) - fin(center?.x) + worldHalf - halfExtent) * k,
    sy: (fin(focus?.z) - fin(center?.z) + worldHalf - halfExtent) * k,
```
`src/ui/Minimap2D.js` — setelah `:24` (`this.worldHalf = 700;`) tambahkan `    this.baseCenter = { x: 0, z: 0 };`; ganti `:40-44`:
```js
  /** @param {CanvasImageSource & {width:number}} baseCanvas peta dasar; @param {number} worldHalf setengah sisi dunia (m) */
  setBase(baseCanvas, worldHalf) {
    this.base = baseCanvas;
    this.worldHalf = worldHalf;
```
menjadi:
```js
  /**
   * @param {CanvasImageSource & {width:number}} baseCanvas peta dasar
   * @param {number} worldHalf setengah sisi area bake (m)
   * @param {{x:number, z:number}} [center] pusat area bake di frame dunia (placement region)
   */
  setBase(baseCanvas, worldHalf, center = { x: 0, z: 0 }) {
    this.base = baseCanvas;
    this.worldHalf = worldHalf;
    this.baseCenter = { x: center.x, z: center.z };
```
dan ganti `:66` menjadi `      const r = sourceRect(focus, this.halfExtent, this.worldHalf, this.base.width, this.baseCenter);`.
`src/core/App.js` — ganti `:285` `   * @param {number} worldHalf setengah sisi dunia (m)` menjadi:
```js
   * @param {number} worldHalf setengah sisi area bake (m)
   * @param {{x:number, z:number}} [center] pusat area bake di frame dunia (placement region); utara tetap di atas
```
ganti `:288` `  bakeMinimap(worldHalf) {` menjadi `  bakeMinimap(worldHalf, center = { x: 0, z: 0 }) {`; ganti `:294-295`:
```js
    cam.position.set(0, MINIMAP_BAKE_HEIGHT, 0);
    cam.lookAt(0, 0, 0);
```
menjadi:
```js
    cam.position.set(center.x, MINIMAP_BAKE_HEIGHT, center.z);
    cam.lookAt(center.x, 0, center.z);
```
`src/world/Weather.wet.js:116-124` — ganti:
```js
/**
 * @param {THREE.Object3D} parent grup pemilik (Weather.group)
 * @returns {{ update(dt, intensity): void, register(root): () => boolean, unregister(root): boolean,
 *   dispose(): void, group: THREE.Group, count: number }}
 */
export function createWetSurfaces(parent) {
  const registry = createMaterialRegistry(selectWet, { onRemove: (e) => applyWet(e, 0) });
  const normalMap = createRippleNormalTexture();
  const puddles = createPuddles(normalMap);
```
menjadi:
```js
/**
 * @param {THREE.Object3D} parent grup pemilik (Weather.group)
 * @param {{placement?: {x:number, z:number, yaw:number}|null}} [opts] placement region pemilik titik genangan
 * @returns {{ update(dt, intensity): void, register(root): () => boolean, unregister(root): boolean,
 *   dispose(): void, group: THREE.Group, count: number }}
 */
export function createWetSurfaces(parent, { placement = null } = {}) {
  const registry = createMaterialRegistry(selectWet, { onRemove: (e) => applyWet(e, 0) });
  const normalMap = createRippleNormalTexture();
  const puddles = createPuddles(normalMap);
  if (placement) { // titik genangan region-lokal (plaza, jalan lingkar) → frame dunia
    puddles.group.position.set(placement.x, 0, placement.z);
    puddles.group.rotation.y = placement.yaw;
  }
```
`src/world/Weather.js:101` — tambahkan opsi `puddlePlacement = null` di destructuring `{ audioBus = null, eventTarget = globalThis.window, puddlePlacement = null } = {}`; `:107` → `  const wet = createWetSurfaces(group, { placement: puddlePlacement });`.

- [ ] **Step 7: Wiring `main.js`** (state sesudah Task 3).

Ganti `import { exposeDevTools } from './app/devtools.js';` menjadi `import { exposeDevTools, parsePlacementParam } from './app/devtools.js';` dan `import { mountRegion } from './app/mountRegion.js';` menjadi:
```js
import { mountRegion, applyPlacement } from './app/mountRegion.js';
import { createLocalContext, pointToLocal, pointToWorld } from './app/regionContext.js';
import { createRegionFrame } from './geo/regionTransform.js';
import { withPlacement } from './regions/Region.js';
```
Ganti `const START_POS = { x: 0, z: -275, yaw: 0 }; // plaza utara, menghadap stadion` menjadi `const START_LOCAL = { x: 0, z: -275, yaw: 0 }; // region-lokal: plaza utara, menghadap stadion`.

Sisipkan tepat sebelum `  // Siklus waktu & cuaca dibuat sebelum region:`:
```js
  // Mode dev: ?placement=x,z,yaw memindahkan region (uji I1); produksi selalu memakai placement region.
  const devPlacement = import.meta.env.DEV ? parsePlacementParam(window.location.search) : null;
  const stadionDef = devPlacement ? withPlacement(stadionRegion, devPlacement) : stadionRegion;
  const frame = createRegionFrame(stadionDef.placement);
  const toLocalCtx = createLocalContext(frame);
```
Ganti `const weather = createWeather(app.scene, app, lighting, { audioBus });` menjadi `const weather = createWeather(app.scene, app, lighting, { audioBus, puddlePlacement: frame.placement });`.
Ganti `const stadion = await mountRegion(app, stadionRegion, { store, time, weather });` menjadi `const stadion = await mountRegion(app, stadionDef, { store, time, weather });`, dan pada `createCompositeCollider` ganti `stadionRegion` (dua kali) menjadi `stadionDef`.

Ganti blok entitas (dari `const ents = buildEntities({ start: START_POS, …` sampai `ents.updatables.forEach(…);`):
```js
  const ents = buildEntities({ start: START_POS, world: region, wallet, camera: app.camera });
  app.scene.add(ents.group);
  lifecycle.add(() => { ents.bike.dispose(); ents.group.removeFromParent(); disposeTree(ents.group); });
  ents.bike.setCollider(createCollider(START_POS, colliders.isWalkable));
  rig.attachSource(createPovSource(ents));
  ents.bike.setAudioBus(audioBus);
  ents.updatables.forEach((e, i) => app.addSystem({ id: `entities.${i}`, phase: 'sim', update: (dt, ctx) => e.update(dt, ctx) }));
```
menjadi:
```js
  // Jangkar region: entitas & objek cerita region-lokal ditempel di bawah grup ber-placement.
  const anchor = applyPlacement(new THREE.Group(), frame.placement);
  anchor.name = 'jangkarRegion';
  app.scene.add(anchor);
  lifecycle.add(() => anchor.removeFromParent());
  const start = { ...frame.toWorld(START_LOCAL.x, START_LOCAL.z), yaw: frame.yawToWorld(START_LOCAL.yaw) };
  const ents = buildEntities({ start, world: region, wallet, camera: app.camera });
  app.scene.add(ents.group);
  anchor.add(ents.regionGroup);
  lifecycle.add(() => {
    ents.bike.dispose();
    for (const g of [ents.group, ents.regionGroup]) { g.removeFromParent(); disposeTree(g); }
  });
  ents.bike.setCollider(createCollider(start, colliders.isWalkable));
  rig.attachSource(createPovSource(ents, frame));
  ents.bike.setAudioBus(audioBus);
  // Sepeda di frame dunia; entitas region menerima ctx region-lokal (bikePos/focus dikonversi sekali per frame).
  ents.updatables.forEach((e, i) => app.addSystem({
    id: `entities.${i}`, phase: 'sim', update: (dt, ctx) => e.update(dt, e === ents.bike ? ctx : toLocalCtx(ctx)),
  }));
```
Ganti `  time.registerEmissive(ents.group);` menjadi:
```js
  time.registerEmissive(ents.group);
  time.registerEmissive(ents.regionGroup);
```
Ganti:
```js
  const story = setupStory({ app, ents, hud, rig });
  const shop = setupShop(hud, ents, story);
  const minimap = setupMinimap(app, ents, story);
  addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story });
```
menjadi:
```js
  const story = setupStory({ app, ents, hud, rig, anchor, toLocalCtx });
  const shop = setupShop(hud, ents, story);
  const minimap = setupMinimap(app, ents, story, frame);
  addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story, frame });
```
Ganti `    minimap.setBase(app.bakeMinimap(SITE.groundSize / 2), SITE.groundSize / 2);` menjadi `    minimap.setBase(app.bakeMinimap(SITE.groundSize / 2, frame.placement), SITE.groundSize / 2, frame.placement);`.

Di `addFrameSystems`: signature tambah `frame`; `handleKeys(input, { rig, hud, ents, shop, time, store, story })` → `handleKeys(input, { rig, hud, ents, shop, time, store, story, frame })`; di sistem `story` ganti `bikePos: ents.bike.state, hour: time.hour,` menjadi `bikePos: pointToLocal(frame, ents.bike.state), hour: time.hour, // cerita region-lokal`; ganti `updatePrompt(hud, ents, story, ents.bike.state);` menjadi `updatePrompt(hud, ents, story, pointToLocal(frame, ents.bike.state));`.

Ganti awal `setupStory`:
```js
/** Cerita: NPC, penanda tujuan, HUD, jurnal; progres dimuat dari localStorage. */
function setupStory({ app, ents, hud, rig }) {
```
menjadi:
```js
/** Cerita (region-lokal): NPC, penanda tujuan, HUD, jurnal; progres dimuat dari localStorage. */
function setupStory({ app, ents, hud, rig, anchor, toLocalCtx }) {
```
dan:
```js
  app.scene.add(npcs.group, markers.group);
  ents.lod.addFrom(npcs.group);
  app.addSystem({ id: 'storyNpcLabels', phase: 'ui', update: (dt, ctx) => npcs.refreshLabels(ctx.focus ?? ctx.bikePos, ents.vendors.labelsEnabled) });
```
menjadi:
```js
  anchor.add(npcs.group, markers.group);
  ents.lod.addFrom(npcs.group);
  app.addSystem({
    id: 'storyNpcLabels',
    phase: 'ui',
    update: (dt, ctx) => {
      const local = toLocalCtx(ctx);
      npcs.refreshLabels(local.focus ?? local.bikePos, ents.vendors.labelsEnabled);
    },
  });
```
Ganti awal `setupMinimap`:
```js
/** Minimap 2D: peta dasar di-bake sekali (lihat App.bakeMinimap); marker digambar di canvas kecil. */
function setupMinimap(app, ents, story) {
  const minimap = new Minimap2D(document.body);
  const pins = () => [
    ...ents.vendors.vendors.map((v) => ({ x: v.position.x, z: v.position.z, color: PIN_VENDOR })),
    ...STORY_NPCS.map((n) => ({ x: n.x, z: n.z, color: PIN_NPC })),
  ];
```
menjadi:
```js
/** Minimap 2D (frame dunia): peta dasar di-bake sekali (lihat App.bakeMinimap); marker region diubah ke dunia. */
function setupMinimap(app, ents, story, frame) {
  const minimap = new Minimap2D(document.body);
  const pins = () => [
    ...ents.vendors.vendors.map((v) => pointToWorld(frame, { x: v.position.x, z: v.position.z, color: PIN_VENDOR })),
    ...STORY_NPCS.map((n) => pointToWorld(frame, { x: n.x, z: n.z, color: PIN_NPC })),
  ];
```
dan `goal: story.goalPoint()` → `goal: pointToWorld(frame, story.goalPoint())`.

- [ ] **Step 8: Jalankan tes → LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/regionTransform.test.js tests/regionContext.test.js tests/placement.test.js tests/povDirector.test.js tests/cameraPresets.test.js tests/minimapMath.test.js tests/nightRegistry.test.js
```
Expected: PASS.

- [ ] **Step 9: Suite + lint + build + uji browser**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
Paritas (harness Plan A): callsMean dalam ±5% dari 502 (saat rencana disusun: 505), 0 galat, teardown bersih — frame identitas memakai jalur cepat sehingga perilaku identik. Uji manual dev: `npm run dev`, buka `http://localhost:5173/?placement=100,-50,0.3`: tanpa galat konsol, `__sim.ents.bike.state` awal ≈ `{x: 18.73, z: -312.72, yaw: 0.3}` (= `toWorld(START_LOCAL)`), objek `jangkarRegion` berposisi `[100, 0, -50]`, stadion & penonton bergeser bersama.

- [ ] **Step 10: Commit**

```bash
git add src/geo/regionTransform.js src/app/regionContext.js src/regions/Region.js src/core/cameraPresets.js src/core/PovDirector.js src/core/povSource.js src/entities/index.js src/app/devtools.js src/app/keymap.js src/shared/minimapMath.js src/ui/Minimap2D.js src/core/App.js src/world/Weather.js src/world/Weather.wet.js src/main.js tests/regionTransform.test.js tests/regionContext.test.js tests/placement.test.js && git commit -m "feat: placement region ujung-ke-ujung (frame region untuk entitas, cerita, kamera, minimap, lampu, genangan)"
```

---

## Task 5: Satu mask + satu `pointInPolygon` (I3) dan bake ulang

I3: mask dua sumber (Plan A hull 250×310 + parkir di `src/regions/stadion/mask.js` vs Plan B elips 290×350 di `tools/citybake/config.js:146-173`) dan dua `pointInPolygon` (`src/shared/polygon.js:6-14` vs `src/geo/polygon.js:63-72`). Keputusan: **satu lokasi = `src/geo/polygon.js`** (lapisan geo murni, dipakai citybake + TileCollider; implementasi Plan B diberi validasi input dari Plan A, `convexHull` ikut pindah). Citybake mengimpor mask klien lewat `stadionMaskWorld()` (ring region-lokal × placement). Placement dipindah ke modul murni `src/regions/stadion/placement.js` agar citybake tidak menarik builder dunia.

**Files:**
- Modify: `src/geo/polygon.js:1-6` (doc), `:63-72` (`pointInPolygon`), sisip sebelum `:74` (`convexHull`)
- Delete: `src/shared/polygon.js`, `tests/polygon.test.js`
- Modify: `src/core/Collider.js:7`, `src/regions/Region.js:5`
- Create: `src/regions/stadion/placement.js`
- Modify: `src/regions/stadion/mask.js:1-29` (seluruh berkas), `src/regions/stadion/index.js` (sumber `STADION_PLACEMENT`)
- Modify: `tools/citybake/config.js:5-6`, `:146-173`; `tools/citybake/mask.js:1-6` (doc)
- Test: `tests/geo/polygon.test.js` (tambah), `tests/citybake/config.test.js:1-6`, `:54-68`
- Bake: `public/tiles/` (tile yang terdampak + `manifest.json`)

- [ ] **Step 1: Tulis tes yang gagal.**

Tambahkan di akhir `tests/geo/polygon.test.js` (memindahkan kasus `tests/polygon.test.js`):
```js
describe('polygon: dipindah dari src/shared/polygon.js (satu implementasi)', () => {
  it('pointInPolygon: input tak valid = di luar; poligon cekung', async () => {
    const { pointInPolygon: pip } = await import('../../src/geo/polygon.js');
    expect(pip(Number.NaN, 5, SQUARE)).toBe(false);
    expect(pip(1, 1, [[0, 0], [1, 1]])).toBe(false);
    expect(pip(1, 1, null)).toBe(false);
    expect(pip(5, 15, L_SHAPE)).toBe(true);
  });

  it('convexHull: buang titik dalam, kolinear, tak hingga; luas positif; < 3 titik = salinan', async () => {
    const { convexHull, signedArea: area } = await import('../../src/geo/polygon.js');
    const hull = convexHull([[0, 0], [5, 0], [10, 0], [10, 10], [0, 10], [5, 5], [Number.NaN, 1]]);
    expect(hull).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
    expect(area(hull)).toBeGreaterThan(0);
    const pts = [[1, 2]];
    const one = convexHull(pts);
    expect(one).toEqual([[1, 2]]);
    expect(one[0]).not.toBe(pts[0]);
  });
});
```
Di `tests/citybake/config.test.js`, ganti `:4-6`:
```js
  ORIGIN, AREAS, ROAD_CLASSES, LANDUSE_COLORS, LANDUSE_ORDER, LAYER_Y, REGION_MASKS, OVERTURE, OVERPASS_ENDPOINTS, USER_AGENT,
  areaRect, areaTiles, areaFetchBBox, ellipseRing,
} from '../../tools/citybake/config.js';
```
menjadi:
```js
  ORIGIN, AREAS, ROAD_CLASSES, LANDUSE_COLORS, LANDUSE_ORDER, LAYER_Y, REGION_MASKS, OVERTURE, OVERPASS_ENDPOINTS, USER_AGENT,
  areaRect, areaTiles, areaFetchBBox,
} from '../../tools/citybake/config.js';
import { stadionMaskWorld, STADION_MASK } from '../../src/regions/stadion/mask.js';
import { stadionRegion } from '../../src/regions/stadion/index.js';
import { regionContains } from '../../src/regions/Region.js';
```
dan ganti `:54-68` (tes `mask stadion: elips positif …` dan `ellipseRing: …`) dengan:
```js
  it('mask stadion: ring positif memuat stadion & parkir, tidak memuat Jl. Naga Sakti OSM (z ≈ −447)', () => {
    const m = REGION_MASKS.find((v) => v.id === 'stadion');
    expect(signedArea(m.ring)).toBeGreaterThan(0);
    expect(pointInPolygon(0, 0, m.ring)).toBe(true);
    expect(pointInPolygon(0, -340, m.ring)).toBe(true);
    expect(pointInPolygon(0, -447, m.ring)).toBe(false);
    expect(pointInPolygon(300, 0, m.ring)).toBe(false);
  });

  it('satu sumber mask: ring bake = mask region klien setelah placement; keputusan sama di seluruh grid', () => {
    const m = REGION_MASKS.find((v) => v.id === 'stadion');
    expect(m.ring).toEqual(stadionMaskWorld());
    expect(m.ring).toHaveLength(STADION_MASK.length);
    const mismatch = [];
    for (let x = -700; x <= 700; x += 17) {
      for (let z = -700; z <= 700; z += 17) {
        if (pointInPolygon(x, z, m.ring) !== regionContains(stadionRegion, x, z)) mismatch.push([x, z]);
      }
    }
    expect(mismatch).toEqual([]);
  });

  it('stadionMaskWorld menerapkan placement (rotasi + geser)', () => {
    const ring = stadionMaskWorld({ x: 10, z: 20, yaw: Math.PI / 2 }, [[1, 0], [0, 1], [-1, 0]]);
    expect(ring[0][0]).toBeCloseTo(10, 9);
    expect(ring[0][1]).toBeCloseTo(19, 9);
  });
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/geo/polygon.test.js tests/citybake/config.test.js
```
Expected: FAIL — `pip(1, 1, null)` melempar `TypeError` (versi lama tanpa validasi input); `convexHull` bukan ekspor `geo/polygon.js`; `stadionMaskWorld` bukan ekspor `mask.js`.

- [ ] **Step 3: Satu implementasi poligon.** Di `src/geo/polygon.js`:

Ganti `:5` ` * Murni (tanpa three/DOM); dipakai citybake dan nanti TileCollider.` menjadi:
```js
 * Murni (tanpa three/DOM). SATU-SATUNYA implementasi poligon proyek: dipakai citybake, mask region,
 * collider komposit, dan TileCollider.
```
Ganti `:63-65`:
```js
/** Titik di dalam poligon (aturan genap-ganjil; titik tepat di tepi tidak dijamin). */
export function pointInPolygon(x, z, ring) {
  let inside = false;
```
menjadi:
```js
/**
 * Titik di dalam poligon (aturan genap-ganjil, cekung boleh; titik tepat di tepi tidak dijamin).
 * Input tak valid (ring < 3 titik / bukan array, koordinat tak hingga) = false.
 */
export function pointInPolygon(x, z, ring) {
  if (!Array.isArray(ring) || ring.length < 3 || !Number.isFinite(x) || !Number.isFinite(z)) return false;
  let inside = false;
```
Sisipkan sebelum `/** Bounding box ring/polyline. */` (`:74`):
```js
/** Hull cembung (Andrew monotone chain), luas bertanda positif, tanpa titik kolinear; titik tak hingga dibuang. */
export function convexHull(points) {
  const pts = points
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => [p[0], p[1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out;
  };
  const lower = half(pts);
  const upper = half([...pts].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

```
Hapus duplikat dan perbarui impor:
```bash
git rm src/shared/polygon.js tests/polygon.test.js
```
`src/core/Collider.js:7` dan `src/regions/Region.js:5`: ganti `from '../shared/polygon.js'` menjadi `from '../geo/polygon.js'`.

- [ ] **Step 4: Placement murni + mask satu sumber.**

Buat `src/regions/stadion/placement.js`:
```js
/**
 * Placement region stadion di frame dunia ENU (sumber tunggal untuk klien dan citybake; murni).
 * Origin dunia = centroid poligon OSM stadion, jadi placement ≈ identitas (Task 18 menghitungnya dari OSM).
 */
export const STADION_PLACEMENT = Object.freeze({ x: 0, z: 0, yaw: 0 });
```
Ganti seluruh isi `src/regions/stadion/mask.js`:
```js
/**
 * Mask region stadion (region-lokal): SATU sumber untuk klien (collider komposit, regionContains) dan
 * citybake (fitur kota di dalamnya dibuang saat bake, lewat stadionMaskWorld). Fallback: OSM tidak
 * memiliki poligon kompleks stadion (diperiksa 2026-10-16), jadi mask = hull cembung elips jalan
 * lingkar + jalur jogging (dengan margin) dan blok parkir mobil & motor.
 */
import { SITE } from './site.js';
import { STADION_PLACEMENT } from './placement.js';
import { convexHull } from '../../geo/polygon.js';
import { toWorld } from '../../geo/regionTransform.js';

const MASK_MARGIN = 8;        // m di luar sumbu jalur jogging
const ELLIPSE_SAMPLES = 48;

const ellipsePoints = (semiX, semiZ, n) => Array.from({ length: n }, (_, i) => {
  const t = (i / n) * Math.PI * 2;
  return [semiX * Math.cos(t), semiZ * Math.sin(t)];
});

const rectCorners = ({ x, z, w, d }) => [
  [x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2],
];

/** @returns {ReadonlyArray<readonly [number, number]>} */
export function createStadionMask(site = SITE) {
  const semiX = site.ringRoadSemiX + site.joggingTrackOffset + MASK_MARGIN;
  const semiZ = site.ringRoadSemiZ + site.joggingTrackOffset + MASK_MARGIN;
  const pts = [...ellipsePoints(semiX, semiZ, ELLIPSE_SAMPLES), ...rectCorners(site.parkingCar), ...rectCorners(site.parkingMoto)];
  return Object.freeze(convexHull(pts).map((p) => Object.freeze(p)));
}

export const STADION_MASK = createStadionMask();

/** Mask dalam koordinat DUNIA (dipakai citybake): ring region-lokal ditransformasi placement. */
export function stadionMaskWorld(placement = STADION_PLACEMENT, mask = STADION_MASK) {
  return mask.map(([x, z]) => {
    const w = toWorld(placement, x, z);
    return [w.x, w.z];
  });
}
```
Di `src/regions/stadion/index.js` (hasil Task 3) ganti:
```js
import { stadionNightLights } from './lamps.js';

export const STADION_ID = 'stadion';
export const STADION_PLACEMENT = Object.freeze({ x: 0, z: 0, yaw: 0 });
```
menjadi:
```js
import { stadionNightLights } from './lamps.js';
import { STADION_PLACEMENT } from './placement.js';

export const STADION_ID = 'stadion';
export { STADION_PLACEMENT };
```

- [ ] **Step 5: Citybake memakai mask klien.** Di `tools/citybake/config.js` ganti `:5-6`:
```js
import { SITE } from '../../src/config/constants.js';
import { tileBounds, tilesInRect, TILE_SIZE } from '../../src/geo/tiles.js';
```
menjadi:
```js
import { tileBounds, tilesInRect, TILE_SIZE } from '../../src/geo/tiles.js';
import { stadionMaskWorld } from '../../src/regions/stadion/mask.js';
```
dan ganti `:146-173` (dari `/** Jumlah titik poligon pendekatan elips mask. */` sampai penutup `REGION_MASKS`):
```js
/**
 * Mask region handmade dalam koordinat DUNIA ({id, ring}). Sumber tunggal: mask region klien
 * (src/regions/stadion/mask.js) yang ditransformasi placement region (regionTransform.toWorld).
 */
export const REGION_MASKS = Object.freeze([
  Object.freeze({ id: 'stadion', ring: stadionMaskWorld() }),
]);
```
Di `tools/citybake/mask.js` ganti doc `:2-5`:
```js
 * Buang fitur kota di dalam mask region handmade. Mask berupa ring dalam koordinat DUNIA.
 * Fase 1: placement stadion {x: 0, z: 0, yaw: 0}, jadi ring region-lokal = ring dunia. Saat placement
 * tidak nol (Fase 3), ubah ring dengan regionTransform milik Plan A (dibuat di Plan A Task 6) sebelum
 * memanggil applyMasks.
```
menjadi:
```js
 * Buang fitur kota di dalam mask region handmade. Mask berupa ring dalam koordinat DUNIA
 * (config.REGION_MASKS = mask region klien yang sudah ditransformasi placement).
```

- [ ] **Step 6: Jalankan tes → LULUS; tidak ada lagi duplikat**

```bash
node node_modules/vitest/vitest.mjs run tests/geo tests/citybake tests/region.test.js tests/compositeCollider.test.js
```
Expected: PASS.
```bash
grep -rn "shared/polygon\|export function pointInPolygon" src tools tests
```
Expected: tepat satu baris, `src/geo/polygon.js:…:export function pointInPolygon`.

- [ ] **Step 7: Bake ulang tile terdampak (offline) + cek budget**

```bash
node tools/citybake --area stadion --offline
```
Expected: `Total manifest: 52 tile, 6.73 MB`, tanpa baris `PERINGATAN:` (budget: tile ≤ 300 KB, total ≤ 20 MB). Bila ada `PERINGATAN:` → BERHENTI, laporkan.
```bash
git status --short public/tiles
```
Expected (saat rencana disusun): berubah `-1_-1.*`, `-1_0.*`, `0_-1.*`, `0_0.*`, `manifest.json` (mask Plan A lebih kecil dari elips Plan B di sebagian besar arah). Tanpa cache: `node tools/citybake --area stadion` (online, ±14 menit; data OSM mungkin berubah → laporkan perbedaan jumlah tile/ukuran).

- [ ] **Step 8: Suite + lint**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```

- [ ] **Step 9: Commit**

```bash
git add src/geo/polygon.js src/core/Collider.js src/regions/Region.js src/regions/stadion/placement.js src/regions/stadion/mask.js src/regions/stadion/index.js tools/citybake/config.js tools/citybake/mask.js tests/geo/polygon.test.js tests/citybake/config.test.js public/tiles && git commit -m "refactor: satu mask region (klien = citybake via stadionMaskWorld) dan satu pointInPolygon di geo/polygon; bake ulang tile stadion"
```
(`git rm` di Step 3 sudah men-stage penghapusan `src/shared/polygon.js` dan `tests/polygon.test.js`.)

---

## Task 6: Alat verifikasi fakta OSM untuk keputusan I4

Membuat pemeriksaan I4 dapat diulang: alat CLI untuk cache bake dan query Overpass (tag yang tidak diambil citybake), plus tes fakta dari tile yang di-commit. Keputusan per elemen ada di tabel "Keputusan I4" di atas.

**Files:**
- Create: `tools/citybake/inspectOsm.js`
- Test: `tests/citybake/inspectOsm.test.js` (baru), `tests/osmFacts.test.js` (baru)

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/citybake/inspectOsm.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createProjection } from '../../src/geo/projection.js';
import { featuresNear, summarizeElement, overpassCheckQuery, bboxAround } from '../../tools/citybake/inspectOsm.js';
import { ORIGIN } from '../../tools/citybake/config.js';

const proj = createProjection({ lat0: ORIGIN.lat, lon0: ORIGIN.lon });
const raw = JSON.parse(readFileSync('tests/citybake/fixtures/osm-mini.json', 'utf8'));

describe('inspectOsm (alat verifikasi fakta OSM)', () => {
  it('featuresNear: elemen bertag dalam radius, urut jarak centroid; node tanpa geometri tetap diringkas', () => {
    const near = featuresNear(raw, proj, { x: 0, z: 0, radius: 300 });
    expect(near.length).toBeGreaterThan(0);
    expect(near.map((f) => f.distance)).toEqual([...near.map((f) => f.distance)].sort((a, b) => a - b));
    const road = near.find((f) => f.tags.includes('name=Jalan Uji Raya'));
    expect(road.tags).toContain('highway=primary');
    expect(near.find((f) => f.type === 'node')).toBeTruthy();
    expect(featuresNear(raw, proj, { x: 50000, z: 0, radius: 10 })).toEqual([]);
  });

  it('summarizeElement: centroid luas untuk way tertutup', () => {
    const b = raw.elements.find((e) => e.id === 1001);
    const s = summarizeElement(b, proj);
    expect(s.tags).toContain('building=yes');
    expect(s.bounds.minX).toBeLessThanOrEqual(s.centroid.x);
    expect(s.bounds.maxX).toBeGreaterThanOrEqual(s.centroid.x);
  });

  it('query Overpass memuat tag di luar cache bake dan bbox yang benar', () => {
    const bb = bboxAround(proj, 0, 0, 700);
    expect(bb.south).toBeLessThan(ORIGIN.lat);
    expect(bb.north).toBeGreaterThan(ORIGIN.lat);
    const q = overpassCheckQuery(bb);
    for (const k of ['aeroway', 'barrier', 'man_made', 'historic', 'tourism', 'leisure', 'sport', '[Gg]apura']) expect(q).toContain(k);
    expect(q).toContain(bb.south.toFixed(7));
    expect(q.endsWith('out tags center;')).toBe(true);
  });
});
```
dan `tests/osmFacts.test.js`:
```js
/**
 * Fakta OSM yang mendasari keputusan konten region stadion (Plan C, I4), dibaca dari tile yang
 * di-commit (public/tiles, OSM 2026-10-16). Bila bake baru mengubah fakta ini, tes gagal dan
 * keputusan I4 harus ditinjau ulang (fakta mengalahkan gaya).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pointInPolygon, polygonCentroid } from '../src/geo/polygon.js';

const manifest = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
const tiles = manifest.tiles.filter((t) => t.area === 'stadion')
  .map((t) => JSON.parse(readFileSync(`public/tiles/${t.data.file}`, 'utf8')));

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
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/citybake/inspectOsm.test.js tests/osmFacts.test.js
```
Expected: `inspectOsm.test.js` FAIL (`Failed to resolve import "../../tools/citybake/inspectOsm.js"`); `osmFacts.test.js` sudah LULUS (fakta dari tile Task 5 — tes ini adalah dokumentasi fakta, bukan perilaku baru).

- [ ] **Step 3: Implementasi** — buat `tools/citybake/inspectOsm.js`:
```js
/**
 * Alat verifikasi fakta OSM untuk keputusan konten region (Plan C, I4). Dua mode:
 * 1) Ringkas elemen OSM di sekitar titik DUNIA dari cache bake (data-src/osm/<area>.json, `out geom`):
 *      node tools/citybake/inspectOsm.js --area stadion --at -60,-480 --radius 150
 * 2) Cetak query Overpass untuk tag yang TIDAK diambil citybake (aeroway, barrier, man_made, historic,
 *    tourism, leisure/sport lain, nama), lalu jalankan sendiri dengan curl (butuh jaringan):
 *      node tools/citybake/inspectOsm.js --overpass --at 0,0 --radius 700
 * Fungsi murni diekspor untuk tes; I/O hanya di main().
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { createProjection } from '../../src/geo/projection.js';
import { polygonCentroid } from '../../src/geo/polygon.js';
import { ORIGIN, PATHS } from './config.js';

const SUMMARY_KEYS = Object.freeze([
  'name', 'highway', 'building', 'natural', 'water', 'waterway', 'landuse', 'leisure', 'sport', 'amenity',
  'aeroway', 'barrier', 'man_made', 'historic', 'tourism', 'area',
]);

/** Titik dunia sebuah elemen Overpass (`out geom` way/relation, node, atau `out center`). */
export function elementPoints(el, projection) {
  const ll = el.geometry ?? (el.members ?? []).flatMap((m) => m.geometry ?? []);
  const pts = ll.length ? ll : [el.center ?? (Number.isFinite(el.lat) ? { lat: el.lat, lon: el.lon } : null)].filter(Boolean);
  return pts.map((g) => {
    const w = projection.toWorld(g.lat, g.lon);
    return [w.x, w.z];
  });
}

/** Ringkasan satu elemen: id, tag penting, centroid (luas bila tertutup), batas. */
export function summarizeElement(el, projection) {
  const pts = elementPoints(el, projection);
  const tags = el.tags ?? {};
  const closed = pts.length >= 4 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
  const c = closed ? polygonCentroid(pts.slice(0, -1)) : {
    x: pts.reduce((s, p) => s + p[0], 0) / Math.max(1, pts.length),
    z: pts.reduce((s, p) => s + p[1], 0) / Math.max(1, pts.length),
  };
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return {
    type: el.type,
    id: el.id,
    tags: SUMMARY_KEYS.filter((k) => tags[k] !== undefined).map((k) => `${k}=${tags[k]}`).join(','),
    centroid: { x: Math.round(c.x), z: Math.round(c.z) },
    bounds: pts.length
      ? { minX: Math.round(Math.min(...xs)), maxX: Math.round(Math.max(...xs)), minZ: Math.round(Math.min(...zs)), maxZ: Math.round(Math.max(...zs)) }
      : null,
  };
}

/** Elemen bertag yang punya titik dalam radius (m) dari (x, z), urut jarak centroid. */
export function featuresNear(raw, projection, { x, z, radius }) {
  const out = [];
  for (const el of raw.elements ?? []) {
    if (!el.tags) continue;
    const pts = elementPoints(el, projection);
    if (!pts.some(([px, pz]) => Math.hypot(px - x, pz - z) <= radius)) continue;
    const s = summarizeElement(el, projection);
    out.push({ ...s, distance: Math.round(Math.hypot(s.centroid.x - x, s.centroid.z - z)) });
  }
  return out.sort((a, b) => a.distance - b.distance || a.id - b.id);
}

/** Bbox lat/lon persegi ±radius di sekitar titik dunia. */
export function bboxAround(projection, x, z, radius) {
  const sw = projection.toLatLon(x - radius, z + radius); // z besar = selatan
  const ne = projection.toLatLon(x + radius, z - radius);
  return { south: sw.lat, west: sw.lon, north: ne.lat, east: ne.lon };
}

/** Query Overpass (out tags center) untuk tag yang tidak ada di cache bake. */
export function overpassCheckQuery({ south, west, north, east }) {
  const b = [south, west, north, east].map((v) => v.toFixed(7)).join(',');
  const lines = [
    '  nwr["aeroway"]', '  nwr["barrier"~"^(gate|entrance|lift_gate)$"]', '  nwr["man_made"]', '  nwr["historic"]',
    '  nwr["tourism"]', '  nwr["leisure"]', '  nwr["sport"]', '  nwr["entrance"]',
    '  nwr["name"~"[Gg]apura|[Gg]erbang|[Hh]elipad|[Ss]kate|[Aa]mfi|[Aa]mphi|[Dd]anau|[Ss]ungai|[Tt]ugu|[Ll]ancang"]',
  ].map((l) => `${l}(${b});`);
  return ['[out:json][timeout:60];', '(', ...lines, ');', 'out tags center;'].join('\n');
}

function parseAt(text) {
  const [x, z] = String(text ?? '').split(',').map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('--at harus "x,z" (meter dunia)');
  return { x, z };
}

/** CLI; mengembalikan exit code. */
export async function main(argv, log = console) {
  const { values } = parseArgs({
    args: argv,
    options: {
      area: { type: 'string', default: 'stadion' },
      at: { type: 'string' },
      radius: { type: 'string', default: '150' },
      overpass: { type: 'boolean', default: false },
      cache: { type: 'string', default: PATHS.cacheDir },
    },
    strict: true,
  });
  const projection = createProjection({ lat0: ORIGIN.lat, lon0: ORIGIN.lon });
  const { x, z } = parseAt(values.at);
  const radius = Number(values.radius);
  if (values.overpass) {
    log.info(overpassCheckQuery(bboxAround(projection, x, z, radius)));
    return 0;
  }
  const file = join(values.cache, 'osm', `${values.area}.json`);
  const raw = JSON.parse(await readFile(file, 'utf8'));
  log.info(`# ${file} (OSM ${raw.osm3s?.timestamp_osm_base ?? '?'}) — sekitar (${x}, ${z}) r=${radius} m`);
  for (const f of featuresNear(raw, projection, { x, z, radius })) {
    log.info(`${f.type}/${f.id}\t${f.tags}\tc=(${f.centroid.x},${f.centroid.z})\td=${f.distance}`);
  }
  return 0;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/citybake/inspectOsm.js')) {
  process.exitCode = await main(process.argv.slice(2)).catch((err) => {
    console.error(`[inspectOsm] gagal: ${err.message}`);
    return 1;
  });
}
```

- [ ] **Step 4: Jalankan verifikasi fakta per elemen dan bandingkan dengan tabel I4**

```bash
node tools/citybake/inspectOsm.js --at=-60,-480 --radius 120
```
```bash
node tools/citybake/inspectOsm.js --at=0,-450 --radius 60
```
```bash
node tools/citybake/inspectOsm.js --at=0,-420 --radius 40
```
```bash
node tools/citybake/inspectOsm.js --at=-300,260 --radius 90
```
```bash
node tools/citybake/inspectOsm.js --at=400,-100 --radius 40
```
```bash
node tools/citybake/inspectOsm.js --at=330,0 --radius 60
```
```bash
node tools/citybake/inspectOsm.js --at=260,120 --radius 40
```
```bash
node tools/citybake/inspectOsm.js --at=-150,330 --radius 40
```
Expected (cache 2026-10-16T08:53:21Z): sama dengan kolom "Fakta OSM" tabel I4 (mis. `--at=-60,-480` → tidak ada `natural=water` dalam 120 m kecuali danau way 327378220/419836906 pada jarak > 200 m; `--at=-300,260` → `way/535214902 name=Venue Baseball,leisure=pitch,sport=baseball c=(-235,227)`).

Tag di luar cache (butuh jaringan; lewati bila offline dan catat "belum diverifikasi ulang, memakai hasil 2026-10-16T14:15:06Z"):
```bash
node tools/citybake/inspectOsm.js --overpass --at=0,-150 --radius 700 > data-src/cek-overpass.txt
```
```bash
curl -s -m 90 -A "stadion-utama-riau-3d-citybake/0.1" --data-urlencode data@data-src/cek-overpass.txt https://overpass-api.de/api/interpreter -o data-src/cek-overpass.json
```
Expected: elemen `aeroway=helipad` way 652285334 (≈ −259, −116), `leisure=pitch sport=baseball` way 535214902, `leisure=stadium` way 327365495, `leisure=park` EcoEduPark, `tourism=camp_site`; **tidak ada** barrier/nama gapura, skate, amfiteater. **BERHENTI** dan tanyakan user bila ada fakta yang berbeda (mis. gapura ternyata dipetakan, atau danau baru muncul di (−60, −480)) — keputusan Task 7/8 bergantung pada tabel ini.

- [ ] **Step 5: Tes LULUS + lint**

```bash
node node_modules/vitest/vitest.mjs run tests/citybake/inspectOsm.test.js tests/osmFacts.test.js
```
```bash
node node_modules/eslint/bin/eslint.js .
```

- [ ] **Step 6: Commit**

```bash
git add tools/citybake/inspectOsm.js tests/citybake/inspectOsm.test.js tests/osmFacts.test.js && git commit -m "feat(citybake): alat verifikasi fakta OSM (cache + query Overpass) dan tes fakta dasar keputusan I4"
```

---

## Task 7: I4 (a) — hapus danau, sungai + jembatan, helipad, skate, amfiteater, venue baseball

Keputusan per elemen: tabel "Keputusan I4". Semua elemen ini berada di luar mask dan tidak ada di OSM pada posisinya (danau, sungai, helipad, skate, amfiteater) atau sudah ada versi OSM di tile (baseball, danau nyata). Sebelum TileCollider (Task 13/16) menggantikan fallback collider region, collider danau ikut hilang di sini secara sadar (tes menyatakannya). `Grass.placement.js` `LAKE_RADIUS` dibereskan.

**Files:**
- Modify: `src/regions/stadion/site.js:32-33` (LAKE), `:46-49`, `:59-64`
- Modify: `src/regions/stadion/collider.js:2-3`, `:28-29`, `:39`, `:42`
- Modify: `src/regions/stadion/layout.js:92`
- Modify: `src/world/Landscape.js:1-52` (seluruh berkas)
- Delete: `src/world/Landscape.water.js`, `src/world/Landscape.baseball.js`
- Modify: `src/world/Landscape.zones.js:5-15`, `:42-51`
- Modify: `src/world/Grass.placement.js:15`, `:57-58`, `:64-65`
- Modify: `src/world/Landscape.trees.js:320`, `:338-345`
- Modify: `src/world/Ground.js:4`, `:7`, `:10-15`, `:59-118`, `:131-134`
- Modify: `src/world/Ground.roads.js:4`, `:162-175`; `src/world/Ground.materials.js:17-21`, `:72`, `:77`, `:80`
- Modify: `src/world/index.js:35`, `:61`; `src/world/Weather.wet.js:13`
- Modify: `src/story/easterEggs.js:17-18`, `src/story/chapters.js:86`
- Test: `tests/singleSource.test.js:36-44`, `tests/grassPlacement.test.js:16-19`, `:28-33`, `tests/scopedCaches.test.js:3`, `:10`, `:59-66`

- [ ] **Step 1: Ubah tes lebih dulu (perilaku baru).**

`tests/singleSource.test.js:36-44` — ganti seluruh `describe('kebenaran tunggal: danau', …)` dengan:
```js
describe('fakta mengalahkan gaya: elemen fiktif dihapus (Plan C, I4)', () => {
  it('danau, sungai, helipad, skate, amfiteater, baseball tidak lagi ada di data region', () => {
    for (const k of ['lake', 'lakeCenter', 'riverX', 'riverWidth', 'bridgeZ', 'helipadCenter', 'skateCenter', 'amphitheaterCenter', 'baseballCenter']) {
      expect(SITE[k], k).toBeUndefined();
    }
    expect(ZONES.lake).toBeUndefined();
    expect(isWalkable(-60, -480)).toBe(true); // bekas danau fiktif: daratan (air nyata = TileCollider)
  });
});
```
`tests/grassPlacement.test.js:16-19` — ganti:
```js
  it('danau dan parkir bukan rumput', () => {
    expect(isGrassSpot(SITE.lakeCenter.x, SITE.lakeCenter.z)).toBe(false);
    expect(isGrassSpot(SITE.parkingCar.x, SITE.parkingCar.z)).toBe(false);
```
menjadi:
```js
  it('parkir bukan rumput; bekas danau fiktif (−60, −480) kini rumput biasa', () => {
    expect(isGrassSpot(-60, -480)).toBe(true);
    expect(isGrassSpot(SITE.parkingCar.x, SITE.parkingCar.z)).toBe(false);
```
`tests/grassPlacement.test.js:28-33` — ganti:
```js
  it('fasilitas lain bukan rumput; lapangan terbuka jauh adalah rumput', () => {
    expect(isGrassSpot(SITE.helipadCenter.x, SITE.helipadCenter.z)).toBe(false);
    expect(isGrassSpot(SITE.amphitheaterCenter.x, SITE.amphitheaterCenter.z)).toBe(false);
    expect(isGrassSpot(SITE.skateCenter.x, SITE.skateCenter.z)).toBe(false);
    expect(isGrassSpot(SITE.riverX, 50)).toBe(false);
    expect(isGrassSpot(-500, 100)).toBe(true);
```
menjadi:
```js
  it('bekas fasilitas fiktif (helipad, amfiteater, skate, sungai) kini rumput; lapangan jauh rumput', () => {
    for (const [x, z] of [[400, -100], [-150, 330], [260, 120], [330, 50]]) expect(isGrassSpot(x, z)).toBe(true);
    expect(isGrassSpot(-500, 100)).toBe(true);
```
`tests/scopedCaches.test.js` — hapus `:10` (`import { createBaseballVenue } …`), hapus tes `venue baseball: …` (`:59-66`), dan ganti `:3` menjadi `import { inTwoScopes, geometriesOf } from './helpers.js';` (`materialsOf` tak terpakai lagi).

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/singleSource.test.js tests/grassPlacement.test.js
```
Expected: FAIL — `SITE.lake` masih ada, `isWalkable(-60,-480)` false, `isGrassSpot(400,-100)` false.

- [ ] **Step 3: Data region.** `src/regions/stadion/site.js` — hapus `:32-33` (komentar + `const LAKE = …`); ganti `:46-49`:
```js
  lakeCenter: Object.freeze({ x: LAKE.x, z: LAKE.z }),
  lake: LAKE,
  tugu: TUGU,
  baseballCenter: { x: -300, z: 260 },
```
menjadi:
```js
  tugu: TUGU,
```
hapus `:59-64` (`helipadCenter` … `skateCenter`). `src/regions/stadion/collider.js` — ganti `:2-3` menjadi:
```js
 * Collider region stadion (koordinat region-lokal): mangkuk & cangkang stadion, koridor gate utama,
 * tugu padat, dan batas tanah region. (Danau fiktif dihapus Plan C; air nyata = TileCollider.)
```
hapus `:28-29` (`inLake`), ganti `:39` menjadi `  /** Posisi valid: di dalam mangkuk, di luar cangkang, atau di koridor gate; dalam batas tanah. */`, hapus `:42` (`if (inLake(lx, lz)) return false;`). `src/regions/stadion/layout.js:92` — ganti baris `skaters: [...]` dengan:
```js
    // skaters: default Crowd.plaza (paving plaza); taman seluncur timur fiktif dihapus Plan C
```

- [ ] **Step 4: Lanskap & tanah.** Ganti seluruh isi `src/world/Landscape.js`:
```js
import * as THREE from 'three';
import { createBigTrees, createYoungTrees, createShrubs, createWildGrass } from './Landscape.trees.js';

/**
 * Lanskap kawasan: vegetasi (pohon besar, pohon muda, semak, ilalang). Danau, sungai + jembatan,
 * jalan setapak helipad, dan venue baseball fiktif dihapus Plan C (I4); versi OSM ada di tile kota.
 */
export function createLandscape(opts = {}) {
  const g = new THREE.Group();
  g.name = 'landscape';
  g.add(createBigTrees(opts.seed ?? 11));
  g.add(createYoungTrees((opts.seed ?? 11) + 12));
  g.add(createShrubs((opts.seed ?? 11) + 20));
  g.add(createWildGrass((opts.seed ?? 11) + 30));
  return g;
}
```
```bash
git rm src/world/Landscape.water.js src/world/Landscape.baseball.js
```
`src/world/Landscape.zones.js:5-15` — ganti:
```js
 * Zona terlarang untuk penempatan vegetasi/props agar tidak menimpa jalan,
 * parkir, danau, venue, dll. Semua angka dalam meter.
 */
export const ZONES = Object.freeze({
  lake: { semiX: SITE.lake.semiX, semiZ: SITE.lake.semiZ, margin: 10 },
  baseballRadius: 82,
  helipadMargin: 8,
  amphitheaterRadius: 26,
  skate: { semiX: 32, semiZ: 20 },
  riverMargin: 12,
  roadMargin: 10,
```
menjadi:
```js
 * Zona terlarang untuk penempatan vegetasi/props agar tidak menimpa jalan,
 * parkir, dan tugu. Semua angka dalam meter.
 */
export const ZONES = Object.freeze({
  roadMargin: 10,
```
dan `:42-51` (awal `onFacility`) — ganti:
```js
/** Terkena area bangunan/fasilitas khusus. */
export function onFacility(x, z) {
  const L = SITE.lakeCenter;
  if (insideEllipse(x - L.x, z - L.z, ZONES.lake.semiX + ZONES.lake.margin, ZONES.lake.semiZ + ZONES.lake.margin)) return true;
  if (inCircle(x, z, SITE.baseballCenter.x, SITE.baseballCenter.z, ZONES.baseballRadius)) return true;
  if (inCircle(x, z, SITE.helipadCenter.x, SITE.helipadCenter.z, SITE.helipadCenter.r + ZONES.helipadMargin)) return true;
  if (inCircle(x, z, SITE.amphitheaterCenter.x, SITE.amphitheaterCenter.z, ZONES.amphitheaterRadius)) return true;
  if (insideEllipse(x - SITE.skateCenter.x, z - SITE.skateCenter.z, ZONES.skate.semiX, ZONES.skate.semiZ)) return true;
  if (Math.abs(x - SITE.riverX) < ZONES.riverMargin) return true;
  const pc = SITE.parkingCar;
```
menjadi:
```js
/** Terkena area fasilitas khusus (parkir, tugu tanjak). */
export function onFacility(x, z) {
  const pc = SITE.parkingCar;
```
`src/world/Grass.placement.js` — hapus `:15` (`const LAKE_RADIUS = 60; …`); ganti `:57-58`:
```js
 * Apakah (x, z) titik berumput: di luar stadion, plaza, jalan, parkir, danau,
 * dan fasilitas (Naga Sakti, amphitheater, helipad, baseball, skate, sungai).
```
menjadi:
```js
 * Apakah (x, z) titik berumput: di luar stadion, plaza, jalan, parkir, dan fasilitas.
 * (LAKE_RADIUS lama dihapus bersama danau fiktif, Plan C I4.)
```
hapus `:64-65` (`const L = SITE.lakeCenter;` dan `if (Math.hypot(…) < LAKE_RADIUS) return false;`).
`src/world/Landscape.trees.js:320` → `/** Ilalang: rumpun di beberapa area kawasan, warna kuning-hijau per instance. */`; ganti `:338-346`:
```js
/** Pusat rumpun ilalang default: tepi danau, tepi sungai, sudut kawasan. */
function defaultGrassCenters() {
  const L = SITE.lakeCenter;
  return [
    { x: L.x + 105, z: L.z, r: 24, force: true },
    { x: L.x - 105, z: L.z + 10, r: 24, force: true },
    { x: SITE.riverX + 20, z: 180, r: 26, force: true },
    { x: SITE.riverX + 22, z: -220, r: 22, force: true },
    { x: -420, z: -200, r: 30 },
```
menjadi:
```js
/** Pusat rumpun ilalang default: sudut kawasan (pusat tepi danau/sungai fiktif dihapus Plan C). */
function defaultGrassCenters() {
  return [
    { x: -420, z: -200, r: 30 },
```
`src/world/Ground.js` — `:4` → `import { groundMaterials, GROUND_COLORS, LAYER_Y } from './Ground.materials.js';`; `:7` → `  createParkingLot, createJoggingTrack,`; ganti `:10-15`:
```js
/**
 * Tanah kawasan: rumput, plaza paving oval, jalan, parkir, helipad, amphitheater.
 * Tidak ada apa pun di dalam elips stadion (outerSemiX × outerSemiZ).
 */
const HELIPAD = Object.freeze({ ringInner: 10.5, ringOuter: 11.5, hBar: 6, hWidth: 1.1, hGap: 2.4 });
const AMPHI = Object.freeze({ steps: 6, innerR: 6, stepR: 2.6, stepH: 0.45, stageR: 5.5 });
```
menjadi:
```js
/**
 * Tanah kawasan: rumput, plaza paving oval, jalan, parkir. Helipad, amfiteater, dan lintasan
 * sepatu roda fiktif dihapus Plan C (I4). Tidak ada apa pun di dalam elips stadion.
 */
```
hapus `:59-118` (`/** Helipad: …` sampai akhir `createAmphitheater`, termasuk `halfRingShape`), dan hapus baris `g.add(createSkateTrack());`, `g.add(createHelipad());`, `g.add(createAmphitheater());` di `createGround`.
`src/world/Ground.roads.js` — `:4` → `import { instancePart } from './siteutil/instanceParts.js';`; hapus `:162-175` (`createSkateTrack`).
`src/world/Ground.materials.js` — hapus `:17` (`lineYellow`), `:20-21` (`helipadRing`, `amphitheater`) di `GROUND_COLORS`; hapus `:72` (`asphaltPlain: asphalt,`), `:77` (`lineYellow: …`), `:80` (`amphitheater: …`) di `createGroundMaterials`.
`src/world/index.js` — hapus `:35` (`MINIMAP_LANDSCAPE_PARTS`), ganti `:61` menjadi `  add(createLandscape());`.
`src/world/Weather.wet.js:13` → `  'joggingTrack', 'tartan', 'apron',`.

- [ ] **Step 5: Cerita mengikuti fakta.** `src/story/easterEggs.js:17-18` — ganti dua baris `jejak-2`/`jejak-3` dengan:
```js
  // jejak-2 di sumbu pedestrian antara dua danau OSM (way 419836906 & 327378220); jejak-3 di Venue Baseball OSM (way 535214902).
  egg({ id: 'jejak-2', title: 'Jejak Kedua', text: 'Jejak kedua: riak di antara dua danau utara menyebut nama "Air Molek".', hint: 'Di antara dua danau utara stadion.', at: { x: -5, z: -385, radius: 12 }, reward: { rupiah: 1000 } }),
  egg({ id: 'jejak-3', title: 'Jejak Ketiga', text: 'Jejak ketiga: anak-anak di Venue Baseball bercerita tentang kota Air Molek.', hint: 'Di Venue Baseball sisi barat daya.', at: { x: -235, z: 227, radius: 20 }, reward: { rupiah: 1000 } }),
```
`src/story/chapters.js:86` — ganti teks `'Cari tiga jejak: dekat gapura Jl. Naga Sakti, tepi danau utara, dan taman papan seluncur timur.'` menjadi `'Cari tiga jejak: dekat gapura Jl. Naga Sakti, di antara dua danau utara, dan Venue Baseball barat daya.'`.

- [ ] **Step 6: Jalankan tes → LULUS; tidak ada sisa rujukan**

```bash
node node_modules/vitest/vitest.mjs run tests/singleSource.test.js tests/grassPlacement.test.js tests/scopedCaches.test.js tests/storyEggTriggers.test.js tests/region.test.js
```
Expected: PASS.
```bash
grep -rn "lakeCenter\|SITE.lake\|riverX\|bridgeZ\|helipadCenter\|skateCenter\|amphitheaterCenter\|baseballCenter\|Landscape.water\|Landscape.baseball" src
```
Expected: kosong (di `tests/` hanya `singleSource.test.js` yang sengaja menyebut nama-nama ini sebagai string).

- [ ] **Step 7: Suite + lint + build + paritas**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
Paritas: callsMean turun karena konten dihapus (saat rencana disusun: 487, malam 569/685), 0 galat, teardown bersih. Penurunan ini disengaja (lihat Self-review: kriteria paritas ±5% berlaku sampai Task 4).

- [ ] **Step 8: Commit**

```bash
git add src/regions/stadion/site.js src/regions/stadion/collider.js src/regions/stadion/layout.js src/world/Landscape.js src/world/Landscape.zones.js src/world/Grass.placement.js src/world/Landscape.trees.js src/world/Ground.js src/world/Ground.roads.js src/world/Ground.materials.js src/world/index.js src/world/Weather.wet.js src/story/easterEggs.js src/story/chapters.js tests/singleSource.test.js tests/grassPlacement.test.js tests/scopedCaches.test.js && git commit -m "refactor: hapus elemen fiktif di luar mask (danau, sungai+jembatan, helipad, skate, amfiteater, baseball); versi OSM menang"
```

---

## Task 8: I4 (b) — hapus Jl. Naga Sakti handmade, gapura ke ujung sumbu nyata, mask + koridor utara, angkot/bus dinonaktifkan, bake ulang

Keputusan: tabel "Keputusan I4" (Naga Sakti, gapura, billboard). Jl. Naga Sakti nyata ada di tile (z ≈ −445…−471); semua turunan jalan handmade (marka, trotoar, pagar, PJU, lapak PKL, billboard, palem tepi jalan, dekal noda/manhole/zebra, genangan, angkot/bus GLB) dihapus. Gapura + pos jaga + rambu + Pak Satpam + jejak-1 pindah ke ujung utara sumbu pedestrian (gapura (0, −436)); jalan penghubung x = 0 kini dari gapura ke jalan lingkar; penghubung x = 140 dihapus (menuju danau OSM timur). Mask: margin 8 → 20 m (billboard x = ±250 masuk) + koridor utara. Posisi awal sepeda pindah ke data region (`LAYOUT.spawn`). Penjual `v-jerukbuah` pindah ke sumbu utara. Ini menyelesaikan juga Fase 3 butir 2 untuk angkot/bus: **dinonaktifkan** (model statis di jalan kota bukan konten region; lalu lintas di polyline OSM = backlog spec §7 "NPC/kendaraan per distrik"); berkas `public/models/kendaraan/*.glb` dibiarkan (tidak dimuat).

**Files:**
- Modify: `src/regions/stadion/site.js` (`nagaSaktiZ`…`connectorXs`, `gapuraZ`), `layout.js:30-35`, `:48-53`, `:68-70`, `:80-85`, `:100`, `:107`
- Modify: `src/regions/stadion/lamps.js` (`litLampPositions`), `src/regions/stadion/mask.js` (margin + koridor)
- Modify: `src/world/Ground.roads.js:9`, `:59-66` (`dashesAlongX`), `:77-101` (`createNagaSakti`), `:110`, `:116`; `src/world/Ground.js:6`, `createGround`
- Modify: `src/world/Landscape.zones.js` (`onRoad`), `src/world/Grass.placement.js` (`NAGA_SAKTI_HALF`, `onStraightRoads`, doc), `src/world/Landscape.trees.js` (`ROADSIDE_SPACING`, `roadsideTreeSpots`, `createBigTrees`)
- Modify: `src/world/Decals.layout.js:2-4`, `:19-20`, `:23-24`, `:71-81`, `:156-175`, `:191`, `:196-197`
- Modify: `src/world/index.js:17`, `:26`, `:74`, `:129`, `:134-152`; `src/world/Weather.wet.js` (`puddleSpots`)
- Modify: `src/main.js` (`START_LOCAL` → `region.layout.spawn`)
- Test: `tests/stadionContent.test.js` (baru); `tests/decals.test.js:26`, `:32-33`; `tests/grassPlacement.test.js:21-26`; `tests/layoutModels.test.js:15-19`; `tests/region.test.js:39-40`, `:46`; `tests/singleSource.test.js:31`
- Bake: `public/tiles/`

- [ ] **Step 1: Tulis tes yang gagal.** Buat `tests/stadionContent.test.js`:
```js
/**
 * Konten region stadion selaras dengan mask (Plan C, I4): semua posisi handmade berada di dalam mask
 * region (di luar mask berlaku TileCollider + fitur OSM), dan titik yang harus dilalui pemain walkable.
 */
import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/regions/stadion/layout.js';
import { SITE } from '../src/regions/stadion/site.js';
import { STADION_MASK, withNorthCorridor, NORTH_CORRIDOR } from '../src/regions/stadion/mask.js';
import { stadionColliders } from '../src/regions/stadion/collider.js';
import { STORY_NPCS } from '../src/story/chapters.js';
import { EASTER_EGGS } from '../src/story/easterEggs.js';
import { pointInPolygon, convexHull, signedArea } from '../src/geo/polygon.js';

const inside = (p) => pointInPolygon(p.x, p.z, STADION_MASK);
/** Sudut persegi diinset 0,5 m (sudut parkir = titik hull di tepi mask; titik tepi tidak dijamin pointInPolygon). */
const rectCorners = ({ x, z, w, d }) => {
  const hx = w / 2 - 0.5;
  const hz = d / 2 - 0.5;
  return [{ x: x - hx, z: z - hz }, { x: x + hx, z: z - hz }, { x: x + hx, z: z + hz }, { x: x - hx, z: z + hz }];
};
/** Telur yang sengaja di luar mask (di kota): id → alasan. */
const CITY_EGGS = Object.freeze({ 'jejak-3': 'Venue Baseball OSM (way 535214902)' });

describe('konten region stadion di dalam mask', () => {
  it('semua props & titik aktivitas LAYOUT di dalam mask', () => {
    const groups = {
      benches: LAYOUT.benches, trashBins: LAYOUT.trashBins, planters: LAYOUT.planters,
      plazaLamps: LAYOUT.plazaLamps, ringRoadLamps: LAYOUT.ringRoadLamps, guardPosts: LAYOUT.guardPosts,
      roadSigns: LAYOUT.roadSigns, banners: LAYOUT.banners, billboards: LAYOUT.billboards,
      blenderModels: LAYOUT.blenderModels, vendors: LAYOUT.vendors.flatMap((v) => v.waypoints),
      plaza: [LAYOUT.plazaCenter, LAYOUT.plazaSpots.exercise, LAYOUT.plazaSpots.badminton, LAYOUT.spawn],
    };
    const outside = Object.entries(groups).flatMap(([name, list]) => list.filter((p) => !inside(p)).map((p) => [name, p.x, p.z]));
    expect(outside).toEqual([]);
  });

  it('tugu, tanjak, gapura (±14 m), parkir, dan jalur pejalan keliling di dalam mask', () => {
    const pts = [
      SITE.tugu, SITE.tanjakMonument, { x: -14, z: SITE.gapuraZ }, { x: 14, z: SITE.gapuraZ },
      ...rectCorners(SITE.parkingCar), ...rectCorners(SITE.parkingMoto),
      ...LAYOUT.loopWalkers.flatMap((w) => [{ x: w.semiX, z: 0 }, { x: 0, z: -w.semiZ }, { x: -w.semiX, z: 0 }, { x: 0, z: w.semiZ }]),
    ];
    expect(pts.filter((p) => !inside(p))).toEqual([]);
  });

  it('NPC cerita & telur jarak di dalam mask, kecuali yang sengaja di kota', () => {
    expect(STORY_NPCS.filter((n) => !inside(n)).map((n) => n.id)).toEqual([]);
    const out = EASTER_EGGS.filter((e) => e.at && !inside(e.at)).map((e) => e.id);
    expect(out).toEqual(Object.keys(CITY_EGGS));
  });

  it('titik yang dilalui pemain walkable (collider region): spawn, waypoint pedagang, NPC, telur di mask', () => {
    const pts = [
      LAYOUT.spawn, ...LAYOUT.vendors.flatMap((v) => v.waypoints),
      ...STORY_NPCS.map((n) => ({ x: n.x + 3, z: n.z })),
      ...EASTER_EGGS.filter((e) => e.at && !CITY_EGGS[e.id]).map((e) => e.at),
    ];
    expect(pts.filter((p) => !stadionColliders.isWalkable(p.x, p.z))).toEqual([]);
  });
});

describe('mask: koridor sumbu utara', () => {
  it('disisipkan ke rantai utara hull: poligon tetap berorientasi positif, memuat leher & ujung koridor', () => {
    expect(signedArea(STADION_MASK)).toBeGreaterThan(0);
    const c = NORTH_CORRIDOR;
    expect(pointInPolygon(0, (c.zNeck + c.zTip) / 2, STADION_MASK)).toBe(true);
    expect(pointInPolygon(c.xWest - 1, -390, STADION_MASK)).toBe(false); // danau OSM barat
    expect(pointInPolygon(c.xEast + 1, -390, STADION_MASK)).toBe(false); // danau OSM timur
    expect(pointInPolygon(0, c.zTip - 1, STADION_MASK)).toBe(false);
  });

  it('hull dengan titik di leher: titik itu diganti jalur koridor', () => {
    const hull = convexHull([[-100, -50], [0, -60], [100, -50], [100, 50], [-100, 50]]);
    const out = withNorthCorridor(hull, { xWest: -10, xEast: 10, zNeck: -80, xWideWest: -20, xWideEast: 20, zTip: -100 });
    expect(out.some(([x, z]) => x === 0 && z === -60)).toBe(false);
    expect(pointInPolygon(0, -90, out)).toBe(true);
    expect(pointInPolygon(15, -70, out)).toBe(false);
    expect(() => withNorthCorridor(hull, { ...NORTH_CORRIDOR, xWest: -500 })).toThrow(RangeError);
  });
});
```
Ubah tes lama ke perilaku baru:

`tests/decals.test.js:26` → `    expect(c.oil + c.water).toBe(30); // noda Naga Sakti handmade dihapus (Plan C)`; `:32-33` →
```js
    expect(c.manhole).toBeUndefined();
    expect(c.zebra).toBeUndefined();
```
`tests/grassPlacement.test.js:21-26` — ganti tes `jalan lingkar, Naga Sakti, dan penghubung bukan rumput` dengan:
```js
  it('jalan lingkar dan penghubung sumbu utara (gapura → jalan lingkar) bukan rumput; bekas Naga Sakti handmade rumput', () => {
    expect(isGrassSpot(0, -SITE.ringRoadSemiZ)).toBe(false);
    expect(isGrassSpot(SITE.ringRoadSemiX, 0)).toBe(false);
    expect(isGrassSpot(0, -345)).toBe(false);
    expect(isGrassSpot(0, SITE.gapuraZ + 10)).toBe(false);
    expect(isGrassSpot(-200, -390)).toBe(true);
  });
```
`tests/layoutModels.test.js:15-19` — ganti tes kendaraan dengan:
```js
  it('angkot/bus dinonaktifkan: Jl. Naga Sakti handmade dihapus, lalu lintas jalan OSM = backlog', () => {
    expect(LAYOUT.blenderModels.filter((m) => m.path.includes('kendaraan'))).toEqual([]);
  });
```
`tests/region.test.js:39-40` — ganti dua `for` mask dengan:
```js
    for (const [x, z] of [[0, 0], [0, -180], [0, -330], [190, -330], [240, 0], [250, -60], [0, -385], [0, -436], [-27, -416]]) {
      expect(regionContains(stadionRegion, x, z)).toBe(true);
    }
    // luar: Jl. Naga Sakti OSM (z −447), danau OSM barat (−60, −380) & timur (60, −385), area jauh
    for (const [x, z] of [[0, -447], [0, -500], [600, 0], [-60, -480], [-60, -380], [60, -385]]) {
      expect(regionContains(stadionRegion, x, z)).toBe(false);
    }
```
`tests/region.test.js:46` → `    expect(lit).toHaveLength(LAYOUT.plazaLamps.length - 4 + LAYOUT.ringRoadLamps.length - 5);`
`tests/singleSource.test.js:31` → `    const all = [...LAYOUT.plazaLamps, ...LAYOUT.ringRoadLamps];`

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/stadionContent.test.js tests/region.test.js tests/decals.test.js tests/layoutModels.test.js tests/grassPlacement.test.js
```
Expected: FAIL — `withNorthCorridor`/`NORTH_CORRIDOR` bukan ekspor, `LAYOUT.spawn` undefined, billboard/lapak/kendaraan di luar mask, dekal Naga Sakti masih ada.

- [ ] **Step 3: Data region.** `src/regions/stadion/site.js` — ganti:
```js
  // --- tambahan lanskap kawasan ---
  nagaSaktiZ: -390,            // parkingNorthZ - 60; Jl. Naga Sakti sejajar sumbu X
  nagaSaktiLanes: 3,
  laneWidth: 3.5,
  connectorXs: [0, 140],       // jalan penghubung Naga Sakti -> jalan lingkar
```
menjadi:
```js
  // --- tambahan lanskap kawasan ---
  // Jl. Naga Sakti handmade (z −390) dihapus Plan C: jalan nyata dari tile OSM (z ≈ −445…−471).
  connectorXs: [0],            // sumbu utara: gapura → jalan lingkar (sumbu pedestrian OSM way 1452277714)
```
dan `  gapuraZ: -372,` menjadi `  gapuraZ: -436,               // ujung utara sumbu pedestrian OSM, ±11 m sebelum jalur Naga Sakti terdekat (z ≈ −447)`.

`src/regions/stadion/layout.js` — ganti `:30-35`:
```js
const RING_ROAD_SIDEWALK = { semiX: SITE.ringRoadSemiX + 8, semiZ: SITE.ringRoadSemiZ + 8 };
const NAGA_SAKTI_SIDEWALK_Z = SITE.nagaSaktiZ + 9;
const NAGA_SAKTI_FENCE_Z = SITE.nagaSaktiZ - 9;
const GAPURA_GAP = 14;

const nearGapura = (x) => Math.abs(x) < GAPURA_GAP;
```
menjadi:
```js
const RING_ROAD_SIDEWALK = { semiX: SITE.ringRoadSemiX + 8, semiZ: SITE.ringRoadSemiZ + 8 };
```
ganti `:47-53` (dari `ringRoadLamps: …` sampai penutup `nagaSaktiFence`):
```js
  ringRoadLamps: withBroken(ringPositions(RING_ROAD_SIDEWALK.semiX, RING_ROAD_SIDEWALK.semiZ, 44), BROKEN_RING_LAMP),
  nagaSaktiLamps: linePositions(NAGA_SAKTI_SIDEWALK_Z + 2, -330, 330, 30, { skip: nearGapura }),
  stalls: linePositions(NAGA_SAKTI_SIDEWALK_Z, -300, 300, 24, { rotY: Math.PI, skip: nearGapura }),
  nagaSaktiFence: [
    { from: -340, to: -GAPURA_GAP, z: NAGA_SAKTI_FENCE_Z },
    { from: GAPURA_GAP, to: 340, z: NAGA_SAKTI_FENCE_Z },
  ],
```
menjadi:
```js
  ringRoadLamps: withBroken(ringPositions(RING_ROAD_SIDEWALK.semiX, RING_ROAD_SIDEWALK.semiZ, 44), BROKEN_RING_LAMP),
  // PJU, pagar, dan lapak PKL Jl. Naga Sakti handmade dihapus Plan C bersama jalannya (jalan nyata = tile OSM).
```
hapus dua billboard Naga Sakti (`:69-70`, `RIAU BANGKIT` dan `PON XVIII 2012`); ganti `:80-85` (komentar lalu lintas + 5 baris `kendaraan/*.glb`) dengan:
```js
    // Angkot & bus kota (models/kendaraan/*.glb) dinonaktifkan Plan C: berdiri di Jl. Naga Sakti handmade yang dihapus;
    // lalu lintas di jalan OSM = backlog "NPC/kendaraan per distrik" (spec §7).
```
ganti `:100` (`v-jerukbuah`) dengan:
```js
    { id: 'v-jerukbuah', kind: 'buah', waypoints: [{ x: -12, z: -300 }, { x: -12, z: -400 }] }, // sumbu utara menuju gapura
```
dan sisipkan sebelum `spectatorCount: 9000,` (`:107`):
```js
  spawn: Object.freeze({ x: 0, z: -275, yaw: 0 }), // posisi awal sepeda: plaza utara, menghadap stadion
```
`src/regions/stadion/lamps.js` — di `litLampPositions` ganti `[...layout.plazaLamps, ...layout.ringRoadLamps, ...layout.nagaSaktiLamps]` menjadi `[...layout.plazaLamps, ...layout.ringRoadLamps]`.

`src/regions/stadion/mask.js` — ganti:
```js
const MASK_MARGIN = 8;        // m di luar sumbu jalur jogging
const ELLIPSE_SAMPLES = 48;
```
menjadi:
```js
const MASK_MARGIN = 20;       // m di luar sumbu jalur jogging (memuat billboard x = ±250)
const ELLIPSE_SAMPLES = 48;
/**
 * Koridor sumbu utara (region-lokal): sumbu pedestrian OSM way 1452277714 (x ≈ −20…10) di antara dua
 * danau OSM (tepi: x ≈ −22,5 dan x ≈ 13 pada z −370…−390), melebar di ujung (z < −412, utara danau)
 * untuk gapura, pos jaga, dan rambu. Ujung z = −440 berhenti sebelum jalur Jl. Naga Sakti terdekat
 * (z ≈ −447) agar jalan OSM tidak terpotong mask.
 */
export const NORTH_CORRIDOR = Object.freeze({ xWest: -22, xEast: 12, zNeck: -412, xWideWest: -30, xWideEast: 30, zTip: -440 });
```
dan ganti `createStadionMask`:
```js
/** @returns {ReadonlyArray<readonly [number, number]>} */
export function createStadionMask(site = SITE) {
  const semiX = site.ringRoadSemiX + site.joggingTrackOffset + MASK_MARGIN;
  const semiZ = site.ringRoadSemiZ + site.joggingTrackOffset + MASK_MARGIN;
  const pts = [...ellipsePoints(semiX, semiZ, ELLIPSE_SAMPLES), ...rectCorners(site.parkingCar), ...rectCorners(site.parkingMoto)];
  return Object.freeze(convexHull(pts).map((p) => Object.freeze(p)));
}
```
menjadi:
```js
/**
 * Sisipkan koridor ke rantai utara (z kecil) hull cembung: titik hull di leher koridor diganti
 * jalur koridor. Hull = keluaran convexHull (mulai dari x terkecil, rantai utara x naik).
 */
export function withNorthCorridor(hull, c = NORTH_CORRIDOR) {
  const k = hull.reduce((best, p, i) => (p[0] > hull[best][0] ? i : best), 0);
  const zAt = (x) => {
    for (let i = 0; i < k; i += 1) {
      const a = hull[i];
      const b = hull[i + 1];
      if (a[0] <= x && x <= b[0] && b[0] > a[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    }
    throw new RangeError(`koridor utara: x = ${x} di luar rantai utara hull`);
  };
  const spur = [
    [c.xWest, zAt(c.xWest)], [c.xWest, c.zNeck], [c.xWideWest, c.zNeck], [c.xWideWest, c.zTip],
    [c.xWideEast, c.zTip], [c.xWideEast, c.zNeck], [c.xEast, c.zNeck], [c.xEast, zAt(c.xEast)],
  ];
  const out = [];
  let inserted = false;
  hull.forEach((p, i) => {
    const inNeck = i <= k && p[0] > c.xWest && p[0] < c.xEast;
    if (inNeck) {
      if (!inserted) out.push(...spur);
      inserted = true;
      return;
    }
    out.push(p);
    const next = hull[i + 1];
    if (!inserted && i < k && p[0] <= c.xWest && next[0] >= c.xEast) {
      out.push(...spur);
      inserted = true;
    }
  });
  return out;
}

/** @returns {ReadonlyArray<readonly [number, number]>} */
export function createStadionMask(site = SITE) {
  const semiX = site.ringRoadSemiX + site.joggingTrackOffset + MASK_MARGIN;
  const semiZ = site.ringRoadSemiZ + site.joggingTrackOffset + MASK_MARGIN;
  const pts = [...ellipsePoints(semiX, semiZ, ELLIPSE_SAMPLES), ...rectCorners(site.parkingCar), ...rectCorners(site.parkingMoto)];
  return Object.freeze(withNorthCorridor(convexHull(pts)).map((p) => Object.freeze(p)));
}
```

- [ ] **Step 4: Dunia.**

`src/world/Ground.roads.js` — doc `:9` → ` * Jalan lingkar, jalan penghubung sumbu utara (gapura → jalan lingkar), parkir, jogging track.`; hapus `dashesAlongX` (`:59-66`, komentar + fungsi) dan `createNagaSakti` (`:77-101`, komentar + fungsi); ganti komentar `createConnectorRoads` (`:110`) menjadi `/** Jalan penghubung lurus dari gapura (SITE.gapuraZ) ke jalan lingkar (sejajar Z). */` dan `:116` `    const zFrom = SITE.nagaSaktiZ;` menjadi `    const zFrom = SITE.gapuraZ;`.
`src/world/Ground.js` — impor `  createRingRoad, createNagaSakti, createConnectorRoads,` → `  createRingRoad, createConnectorRoads,`; di `createGround` hapus `  g.add(createNagaSakti());`.
`src/world/Landscape.zones.js` — ganti awal `onRoad`:
```js
/** Terkena pita jalan (Naga Sakti, penghubung, jalan lingkar + jogging). */
export function onRoad(x, z) {
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, ringRoadWidth: w, joggingTrackOffset: off } = SITE;
  if (Math.abs(z - SITE.nagaSaktiZ) < ZONES.roadMargin) return true;
  const onConnector = SITE.connectorXs.some(
    (cx) => Math.abs(x - cx) < ZONES.connectorHalfWidth && z > SITE.nagaSaktiZ && z < 0,
  );
```
menjadi:
```js
/** Terkena pita jalan (penghubung sumbu utara, jalan lingkar + jogging). */
export function onRoad(x, z) {
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, ringRoadWidth: w, joggingTrackOffset: off } = SITE;
  const onConnector = SITE.connectorXs.some(
    (cx) => Math.abs(x - cx) < ZONES.connectorHalfWidth && z > SITE.gapuraZ - ZONES.roadMargin && z < 0,
  );
```
`src/world/Grass.placement.js` — ganti:
```js
const CONNECTOR_HALF = 4 + ROAD_MARGIN; // lebar penghubung 8 m
const NAGA_SAKTI_HALF = (SITE.nagaSaktiLanes * SITE.laneWidth) / 2 + KERB_SIDEWALK + ROAD_MARGIN;
```
menjadi `const CONNECTOR_HALF = 4 + ROAD_MARGIN; // lebar penghubung 8 m`; ganti doc ` * penghubung mengikuti geometri sebenarnya (Naga Sakti → tepi jalan lingkar).` menjadi ` * penghubung mengikuti geometri sebenarnya (gapura → tepi jalan lingkar).`; ganti `onStraightRoads`:
```js
/** Jl. Naga Sakti (+ trotoar) dan jalan penghubung ke jalan lingkar. */
function onStraightRoads(x, z) {
  if (Math.abs(z - SITE.nagaSaktiZ) < NAGA_SAKTI_HALF) return true;
  return SITE.connectorXs.some((cx) => {
    const zEnd = ringRoadZAt(cx) + SITE.ringRoadWidth / 2 + ROAD_MARGIN;
    return Math.abs(x - cx) < CONNECTOR_HALF && z > SITE.nagaSaktiZ && z < zEnd;
  });
}
```
menjadi:
```js
/** Jalan penghubung sumbu utara (gapura → jalan lingkar). */
function onStraightRoads(x, z) {
  return SITE.connectorXs.some((cx) => {
    const zEnd = ringRoadZAt(cx) + SITE.ringRoadWidth / 2 + ROAD_MARGIN;
    return Math.abs(x - cx) < CONNECTOR_HALF && z > SITE.gapuraZ && z < zEnd;
  });
}
```
`src/world/Landscape.trees.js` — hapus `const ROADSIDE_SPACING = 25;`; ganti `roadsideTreeSpots` (komentar + fungsi) dengan:
```js
/** Pohon tepi jalan lingkar luar (deret palem Jl. Naga Sakti handmade dihapus Plan C). */
function roadsideTreeSpots(rnd) {
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, joggingTrackOffset: off } = SITE;
  const ring = distributeOnEllipse(ax + off + 9, az + off + 9, 70)
    .filter((p) => isFreeForBigTree(p.x, p.z))
    .map((p) => ({ x: p.x, z: p.z, rotY: rnd.range(0, 6.28), scale: rnd.range(0.9, 1.1) }));
  return { ring };
}
```
dan di `createBigTrees`: `const spots = [...random[type], ...ringSplit[type], ...(type === 'palem' ? road.naga : [])];` → `const spots = [...random[type], ...ringSplit[type]];`, `g.userData.count = Object.values(random).flat().length + road.ring.length + road.naga.length;` → `g.userData.count = Object.values(random).flat().length + road.ring.length;`.
`src/world/Decals.layout.js` — doc `:2-4` menjadi:
```js
 * Tata letak dekal permukaan (data murni, deterministik): retak paving plaza,
 * noda parkir, bekas ban & panah jalan lingkar, lumut kaki rib & tugu, grafiti
 * dinding concourse, huruf "P". (Noda, manhole, dan zebra Jl. Naga Sakti handmade
 * dihapus Plan C bersama jalannya.)
```
`:19-20` menjadi:
```js
const Y = Object.freeze({ plaza: 0.032, moss: 0.034, road: 0.042, letter: 0.046 });
const COUNTS = Object.freeze({ cracks: 120, parkingStains: 30, tire: 15, arrows: 8 });
```
hapus `:23-24` (`NAGA`, `ZEBRA_WIDTH`), `nagaStains` (`:71-81`), `manholes` dan `zebras` (`:156-175`); di `createDecalLayout` hapus `...nagaStains(rnd),`, `...manholes(),`, `...zebras(),`.
`src/world/index.js` — hapus impor `createFence` (`:17`) dan `createCart, createUmbrellaSet, createFoodStall` (`:26`); hapus `  addNagaSakti(add, layout);` (`:74`) dan `    ...layout.nagaSaktiLamps,` (`:129`); hapus `addNagaSakti` dan `stallFor` (`:134-152`).
`src/world/Weather.wet.js` (`puddleSpots`) — doc menjadi `/** Titik genangan: cincin plaza dan jalan lingkar (deterministik). */`; `const roadN = Math.max(2, Math.round(count * 0.3));` → `const roadN = Math.max(2, count - ringN);`; hapus baris `while (spots.length < count) spots.push({ … SITE.nagaSaktiZ … });`.

- [ ] **Step 5: Posisi awal sepeda dari data region.** `src/main.js` — hapus `const START_LOCAL = { x: 0, z: -275, yaw: 0 }; // region-lokal: plaza utara, menghadap stadion` dan ganti
```js
  const start = { ...frame.toWorld(START_LOCAL.x, START_LOCAL.z), yaw: frame.yawToWorld(START_LOCAL.yaw) };
```
menjadi:
```js
  const spawn = region.layout.spawn; // region-lokal: plaza utara, menghadap stadion
  const start = { ...frame.toWorld(spawn.x, spawn.z), yaw: frame.yawToWorld(spawn.yaw) };
```

- [ ] **Step 6: Tes → LULUS; tidak ada sisa**

```bash
node node_modules/vitest/vitest.mjs run tests/stadionContent.test.js tests/region.test.js tests/decals.test.js tests/layoutModels.test.js tests/grassPlacement.test.js tests/singleSource.test.js tests/citybake/config.test.js
```
Expected: PASS.
```bash
grep -rn "nagaSakti\|laneWidth: 3.5\|createNagaSakti\|stalls\|NAGA\b" src tests
```
Expected: kosong.

- [ ] **Step 7: Bake ulang (mask berubah) + cek Jl. Naga Sakti tidak terpotong**

```bash
node tools/citybake --area stadion --offline
```
Expected: tanpa `PERINGATAN:`; tile berubah hanya di sekitar mask (`-1_-1`, `-1_0`, `0_-1`, `0_0` + `manifest.json`). Lalu:
```bash
node node_modules/vitest/vitest.mjs run tests/osmFacts.test.js
```
Expected: PASS (Jl. Naga Sakti utuh; saat rencana disusun 20 segmen, 4.208 m sebelum dan sesudah; kedua danau tetap ada).

- [ ] **Step 8: Suite + lint + build + paritas**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
Paritas: 0 galat, teardown bersih; callsMean turun lagi (saat rencana disusun: 435, memori 366/67).

- [ ] **Step 9: Commit**

```bash
git add src/regions/stadion/site.js src/regions/stadion/layout.js src/regions/stadion/lamps.js src/regions/stadion/mask.js src/world/Ground.roads.js src/world/Ground.js src/world/Landscape.zones.js src/world/Grass.placement.js src/world/Landscape.trees.js src/world/Decals.layout.js src/world/index.js src/world/Weather.wet.js src/main.js tests/stadionContent.test.js tests/decals.test.js tests/grassPlacement.test.js tests/layoutModels.test.js tests/region.test.js tests/singleSource.test.js public/tiles && git commit -m "refactor: Jl. Naga Sakti handmade dihapus (OSM menang), gapura ke ujung sumbu utara nyata, mask + koridor utara, angkot/bus dinonaktifkan; bake ulang"
```

---

## Task 9: Props & vegetasi ke ResourceScope (utang Plan A Task 4)

Material/geometri tingkat-modul di props (`Bench`, `Cart`, `Fence`, `Gapura`, `LampPost`, `Monument`, `Planter`, `TrashBin`, `Vehicles`) dan `Landscape.trees.js` dibuat saat impor dan dibagi semua pemakai, sehingga `disposeTree` region melepas sumber daya yang juga dipakai gerobak pedagang (scope global). (`Landscape.water.js` sudah dihapus di Task 7.) Pola yang sama dengan Plan A Task 4: deklarasi `const X = new …` menjadi getter `const X = () => currentScope().get('<Berkas>:X', () => …)` dan setiap pemakaian `X` menjadi `X()`.

**Files:**
- Modify: `src/world/props/Bench.js:18-20`, `Cart.js:21-43`, `Fence.js:21-22`, `Gapura.js:21-25`, `LampPost.js:22-32`, `Monument.js:19-25`, `Planter.js:32-38`, `TrashBin.js:33-35`, `Vehicles.js:21-22`, `:37-38`, `src/world/Landscape.trees.js:48-58` (+ semua pemakaiannya)
- Test: `tests/propsScope.test.js` (baru)

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/propsScope.test.js`:
```js
/**
 * Props & vegetasi (Plan C Task 9, utang Plan A Task 4): material/geometri bersama dibuat lewat
 * ResourceScope aktif, bukan saat impor. Pohon/props di scope region tidak lagi berbagi sumber daya
 * dengan gerobak pedagang (scope global), sehingga region.dispose tidak melepas milik entitas.
 */
import { describe, it, expect } from 'vitest';
import { inTwoScopes, materialsOf, geometriesOf } from './helpers.js';
import { createBenches } from '../src/world/props/Bench.js';
import { createCart, createUmbrellaSet, createFoodStall } from '../src/world/props/Cart.js';
import { createFence } from '../src/world/props/Fence.js';
import { createGapura } from '../src/world/props/Gapura.js';
import { createLampPosts } from '../src/world/props/LampPost.js';
import { createLancangKuning, createTanjakMonument } from '../src/world/props/Monument.js';
import { createPlanters } from '../src/world/props/Planter.js';
import { createTrashBins } from '../src/world/props/TrashBin.js';
import { createParkedCars, createTransMetroBus } from '../src/world/props/Vehicles.js';
import { createBigTrees, createYoungTrees, createShrubs, createWildGrass } from '../src/world/Landscape.trees.js';

const P = [{ x: 0, z: 0 }, { x: 5, z: 2 }];
const FACTORIES = {
  bangku: () => createBenches(P),
  gerobak: () => createCart({ kind: 'minuman' }),
  payung: () => createUmbrellaSet(),
  lapak: () => createFoodStall(),
  pagar: () => createFence({ points: [{ x: 0, z: 0 }, { x: 10, z: 0 }] }),
  gapura: () => createGapura({ damaged: true }),
  pju: () => createLampPosts(P),
  tugu: () => createLancangKuning({ x: 0, z: 0 }),
  tanjak: () => createTanjakMonument({ x: 0, z: 0 }),
  potBunga: () => createPlanters(P),
  tongSampah: () => createTrashBins(P),
  mobil: () => createParkedCars(P),
  bus: () => createTransMetroBus(),
  pohonBesar: () => createBigTrees(11),
  pohonMuda: () => createYoungTrees(23),
  semak: () => createShrubs(31),
  ilalang: () => createWildGrass(41),
};

describe('props & vegetasi memakai ResourceScope aktif', () => {
  it.each(Object.keys(FACTORIES))('%s: tidak berbagi material/geometri antar scope; yang dipakai ulang dimiliki scope', (name) => {
    const { a, first, again, other } = inTwoScopes(FACTORIES[name]);
    const matsA = materialsOf(first);
    const matsB = materialsOf(other);
    const geosA = geometriesOf(first);
    const geosB = geometriesOf(other);
    expect([...matsA].filter((m) => matsB.has(m))).toEqual([]);
    expect([...geosA].filter((g) => geosB.has(g))).toEqual([]);
    // sumber daya yang dipakai ulang dalam scope yang sama harus milik scope itu (dilepas scope.dispose)
    const reused = [...materialsOf(again), ...geometriesOf(again)].filter((r) => matsA.has(r) || geosA.has(r));
    for (const r of reused) expect(a.owns(r), `${name}: ${r.type} ${r.name}`).toBe(true);
  });

  it('bohlam PJU tetap bertanda nightEmissive & bernama (dibaca TimeOfDay) setelah dipindah ke scope', () => {
    const { first } = inTwoScopes(() => createLampPosts(P));
    const bulb = [...materialsOf(first)].find((m) => m.name === 'bohlamPJU');
    expect(bulb.userData.nightEmissive).toEqual({ on: 6.0, off: 0 });
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/propsScope.test.js
```
Expected: FAIL untuk setiap factory — material/geometri yang sama muncul di scope `a` dan `b` (`expected [ MeshLambertMaterial… ] to deeply equal []`).

- [ ] **Step 3: Implementasi (codemod sekali jalan, JANGAN di-commit).** Simpan skrip berikut di LUAR repo (mis. `%TEMP%\scopeProps.mjs`) lalu jalankan dari root repo:
```js
// Codemod sekali jalan (Plan C Task 9): sumber daya GPU tingkat-modul → cache ResourceScope aktif.
// Pemakaian (dari root repo): node <path>/scopeProps.mjs   — lalu tinjau `git diff`. Jangan di-commit.
import { readFileSync, writeFileSync } from 'node:fs';

const TARGETS = {
  'src/world/props/Bench.js': ['matSemen', 'matBilah', 'matKaki'],
  'src/world/props/Cart.js': ['woodMat', 'zincMat', 'glassMat', 'wheelMat', 'whiteMat', 'canopyMat', 'thermosMat', 'stallMats'],
  'src/world/props/Fence.js': ['UNIT_UP', 'UNIT_Z'],
  'src/world/props/Gapura.js': ['tileMat', 'beamMat', 'goldMat', 'tanjakMat', 'stainMat'],
  'src/world/props/LampPost.js': ['poleGeo', 'baseGeo', 'armGeo', 'headGeo', 'bulbGeo', 'poleMat', 'headMat', 'bulbMat'],
  'src/world/props/Monument.js': ['whiteMat', 'sailMat', 'pedestalMat', 'poolMat', 'goldMat', 'hornMat', 'nozzleMat'],
  'src/world/props/Planter.js': ['potGeo', 'soilGeo', 'leafGeo', 'flowerGeo', 'potMat', 'soilMat', 'leafMat'],
  'src/world/props/TrashBin.js': ['bodyGeo', 'postGeo', 'postMat'],
  'src/world/props/Vehicles.js': ['glassMat', 'tireMat', 'carWheelGeo', 'busWheelGeo'],
  'src/world/Landscape.trees.js': ['sawitLeafMat', 'sawitDepthMat', 'trunkMat', 'stakeMat', 'leafMat', 'leafDepthMat', 'youngLeafMat', 'shrubMat', 'grassMat'],
};

/** Akhir pernyataan `const NAME = ...;` (titik koma pada kedalaman kurung 0). */
function statementEnd(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i += 1) {
    const ch = src[i];
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
    else if (ch === ';' && depth === 0) return i + 1;
  }
  throw new Error('akhir pernyataan tidak ditemukan');
}

/** Baris setelan berikutnya (`NAME.prop = ...;`, boleh didahului komentar //) atau null. */
function nextSetupLine(rest, name) {
  const m = rest.match(/^\n((?:\/\/[^\n]*\n)*)(\s*)(\w+)\.[^\n]*;/);
  return m && m[3] === name ? m[0] : null;
}

function convert(file, names) {
  let src = readFileSync(file, 'utf8');
  const prefix = file.split('/').pop().replace(/\.js$/, '');
  for (const name of names) {
    const m = src.match(new RegExp(`^const ${name} = `, 'm'));
    if (!m) throw new Error(`${file}: deklarasi ${name} tidak ada`);
    const start = m.index;
    let end = statementEnd(src, start + m[0].length);
    const expr = src.slice(start + m[0].length, end - 1).trim();
    const setup = [];
    for (let line = nextSetupLine(src.slice(end), name); line; line = nextSetupLine(src.slice(end), name)) {
      setup.push(line.slice(1).replace(new RegExp(`\\b${name}\\.`, 'g'), 'v.'));
      end += line.length;
    }
    const key = `${prefix}:${name}`;
    const body = setup.length
      ? `() => {\n  const v = ${expr};\n${setup.map((l) => l.split('\n').map((x) => `  ${x.trim()}`).join('\n')).join('\n')}\n  return v;\n}`
      : `() => ${expr}`;
    const decl = `const ${name} = () => currentScope().get('${key}', ${body});`;
    src = src.slice(0, start) + decl + src.slice(end);
    const declEnd = start + decl.length;
    src = src.slice(0, declEnd) + src.slice(declEnd).replace(new RegExp(`(?<![.\\w])${name}(?![\\w(])`, 'g'), `${name}()`);
  }
  if (!/import \{[^}]*currentScope[^}]*\} from/.test(src)) {
    const depth = file.split('/').length - 2; // src/world/props/X.js → '../../'
    const rel = `${'../'.repeat(depth)}engine/ResourceScope.js`;
    src = src.replace(/(^import [^\n]+\n)(?!import)/m, `$1import { currentScope } from '${rel}';\n`);
  }
  writeFileSync(file, src);
}

for (const [file, names] of Object.entries(TARGETS)) convert(file, names);

// Cart: cache warna Map tingkat-modul → kunci per warna di scope aktif.
{
  const file = 'src/world/props/Cart.js';
  const src = readFileSync(file, 'utf8');
  const before = `const matCache = new Map();

/** Material Lambert di-cache per warna agar banyak lapak berbagi material (bisa digabung). */
function lambert(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}`;
  const after = `/** Material Lambert di-cache per warna (per ResourceScope aktif) agar banyak lapak berbagi material. */
function lambert(color) {
  return currentScope().get(\`Cart:lambert:\${color}\`, () => new THREE.MeshLambertMaterial({ color }));
}`;
  if (!src.includes(before)) throw new Error('Cart matCache tidak ditemukan');
  writeFileSync(file, src.replace(before, after));
}
console.log('selesai');
```
```bash
node "$TEMP/scopeProps.mjs"
```
Expected: `selesai`. Tinjau `git diff src/world/props src/world/Landscape.trees.js`: contoh hasil yang benar untuk `LampPost.js`:
```js
import { currentScope } from '../../engine/ResourceScope.js';
// …
const poleGeo = () => currentScope().get('LampPost:poleGeo', () => poleGeometry());
const baseGeo = () => currentScope().get('LampPost:baseGeo', () => chubbyCylinder(0.26, 0.32, LAMP_POST.baseH, 10).translate(0, LAMP_POST.baseH / 2, 0));
// …
const bulbMat = () => currentScope().get('LampPost:bulbMat', () => {
  const v = new THREE.MeshStandardMaterial({ color: LAMP_POST.colors.bohlam, emissive: LAMP_POST.colors.bohlam, emissiveIntensity: 1.2 });
  v.name = 'bohlamPJU';
  // Dibaca TimeOfDay: emissiveIntensity dinaikkan ke `on` saat lampu malam menyala, `off` saat siang.
  v.userData.nightEmissive = { on: 6.0, off: 0 };
  return v;
});
// …
    { geometry: baseGeo(), material: poleMat(), name: 'pondasi' },
```
dan di `Cart.js` fungsi `lambert(color)` memakai kunci per warna `Cart:lambert:<warna>` di scope aktif (Map `matCache` hilang). Verifikasi tidak ada lagi sumber daya tingkat-modul:
```bash
grep -nE "^const [A-Za-z_]+ = (new (THREE\.)?[A-Z]\w*(Material|Geometry)\(|applyWind\(|createWindDepthMaterial\(|Object\.freeze\(\{$|new Map\(\))" src/world/props/Bench.js src/world/props/Cart.js src/world/props/Fence.js src/world/props/Gapura.js src/world/props/LampPost.js src/world/props/Monument.js src/world/props/Planter.js src/world/props/TrashBin.js src/world/props/Vehicles.js src/world/Landscape.trees.js
```
Expected: satu baris saja, `src/world/Landscape.trees.js:41:const WIND = Object.freeze({` (data parameter angin, bukan sumber daya GPU). Sebelum codemod perintah yang sama menemukan 48 baris.

- [ ] **Step 4: Tes → LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/propsScope.test.js tests/scopedCaches.test.js tests/sawit.test.js tests/nightRegistry.test.js tests/region.test.js tests/lifecycle.test.js
```
Expected: PASS (18 kasus `propsScope`).

- [ ] **Step 5: Suite + lint + build + paritas**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
Paritas: draw call sama dengan Task 8 (± derau), 0 galat; malam: bohlam PJU tetap menyala (`lampsOn true`).

- [ ] **Step 6: Commit**

```bash
git add src/world/props/Bench.js src/world/props/Cart.js src/world/props/Fence.js src/world/props/Gapura.js src/world/props/LampPost.js src/world/props/Monument.js src/world/props/Planter.js src/world/props/TrashBin.js src/world/props/Vehicles.js src/world/Landscape.trees.js tests/propsScope.test.js && git commit -m "refactor: material & geometri props/vegetasi lewat ResourceScope aktif (tidak dibagi lintas scope)"
```

---

## Task 10: M1 — data kawasan stadion di `config/`, re-export arah benar

M1: `src/config/constants.js:33-35` me-re-export dari `regions/` (config → regions, arah terbalik). Data `STADIUM`/`SITE` murni dipindah ke `src/config/stadionSite.js`; `src/regions/stadion/site.js` menjadi re-export (regions → config, arah benar). Semua impor lama tetap berfungsi. (Aturan ESLint untuk `src/config/**` ditambahkan di Task 21.)

**Files:**
- Move: `src/regions/stadion/site.js` → `src/config/stadionSite.js`
- Create: `src/regions/stadion/site.js` (re-export)
- Modify: `src/config/constants.js:33-35`, `src/config/stadionSite.js:1-4` (doc)
- Test: `tests/region.test.js:34-36` (sudah memeriksa identitas objek; tetap)

- [ ] **Step 1: Tes yang menjaga perilaku** — `tests/region.test.js:34-36` (`SITE dari site.js sama dengan re-export lama`) sudah ada dan harus tetap lulus. Tambahkan pemeriksaan arah impor (gagal sebelum perubahan):
```bash
grep -rn "from '\.\./regions" src/config
```
Expected sebelum perubahan: 1 baris (`src/config/constants.js:35`) — ini yang dihapus.

- [ ] **Step 2: Pindahkan data**

```bash
git mv src/regions/stadion/site.js src/config/stadionSite.js
```
Ganti doc `src/config/stadionSite.js:1-4`:
```js
/**
 * Data kawasan region "stadion" (region-lokal, meter; origin = pusat lapangan, −Z = utara).
 * Dulu `STADIUM`/`SITE` di config/constants.js; di sana kini hanya re-export kompatibilitas.
 */
```
menjadi:
```js
/**
 * Data kawasan region "stadion" (region-lokal, meter; origin = pusat lapangan, −Z = utara). Data murni.
 * Diekspor ulang oleh config/constants.js (impor lama) dan regions/stadion/site.js (Plan C, M1).
 */
```
Buat `src/regions/stadion/site.js`:
```js
/**
 * Data kawasan region "stadion" (region-lokal). Sumber data murni ada di config/stadionSite.js agar
 * arah dependensi benar (config tidak mengimpor regions; regions/world boleh mengimpor config).
 */
export { STADIUM, SITE } from '../../config/stadionSite.js';
```
Ganti `src/config/constants.js:33-35`:
```js
// Data kawasan stadion dipindah ke region (regions/stadion/site.js). Re-export ini menjaga impor lama
// tetap jalan (utang Fase 0: hapus setelah semua builder menerima `site` lewat parameter).
export { STADIUM, SITE } from '../regions/stadion/site.js';
```
menjadi:
```js
// Data kawasan stadion (region-lokal) bersumber di config/stadionSite.js; regions/stadion/site.js
// me-re-export. Arah dependensi benar: config tidak mengimpor regions (Plan C, M1).
export { STADIUM, SITE } from './stadionSite.js';
```

- [ ] **Step 3: Verifikasi**

```bash
grep -rn "from '\.\./regions\|from '\.\./\.\./regions" src/config src/world src/core src/ui src/story src/sim src/engine src/geo src/shared
```
Expected: kosong.
```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
Expected: semua lulus (`SITE` dari `regions/stadion/site.js` === `SITE` dari `config/constants.js`).

- [ ] **Step 4: Commit**

```bash
git add src/config/stadionSite.js src/regions/stadion/site.js src/config/constants.js && git commit -m "refactor: data kawasan stadion di config/stadionSite.js, regions me-re-export (arah dependensi config tidak lagi ke regions)"
```

---

## Task 11: Data tile — validasi & dekode (Format tile v1) + jarak ke tepi poligon

Fondasi Fase 2 (spec §5: data JSON tile divalidasi sebelum dipakai; manifest tak valid → mode hanya-region). Kontrak: bagian "Format tile v1" di `docs/superpowers/plans/2026-10-16-pekanbaru-plan-b-citybake.md:72-…`; dicocokkan dengan `public/tiles/manifest.json` nyata (`version 1`, `format citybake-tiles`, `tileSize 500`, `unit 0.1`, 52 tile, `lod` selalu 2 entri) dan `0_-1.data.json` (`v 1`, `center [250,-250]`, `unit 0.1`, array datar bilangan bulat). Juga menambah `distanceToSegment`/`distanceToRing` di `src/geo/polygon.js` (dipakai TileCollider untuk jarak bebas dinding/lebar jalan).

**Files:**
- Create: `src/city/tileData.js`
- Modify: `src/geo/polygon.js` (tambah di akhir berkas)
- Test: `tests/city/tileData.test.js` (baru), `tests/geo/polygon.test.js` (tambah)

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/city/tileData.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateManifest, validateTileData, decodeTileData } from '../../src/city/tileData.js';

const sample = () => ({
  v: 1, key: '0_-1', ix: 0, iz: -1, center: [250, -250], unit: 0.1,
  buildings: [{ h: 64, ring: [-1600, -1550, -1400, -1550, -1400, -1450, -1600, -1450] }],
  water: [{ rings: [[1250, 1250, 1750, 1250, 1750, 1750], [1400, 1400, 1450, 1400, 1450, 1450]] }],
  waterways: [{ cls: 'stream', w: 40, pts: [1500, -1500, 2000, -1500] }],
  roads: [{ cls: 'primary', w: 140, pts: [-2500, -2300, -100, -2300], name: 'Jalan Uji Raya' }, { cls: 'footway', w: 20, pts: [0, 0, 10, 10] }],
});

describe('validateTileData', () => {
  it('contoh kontrak Format tile v1 lolos', () => {
    expect(validateTileData(sample(), '0_-1')).toEqual({ ok: true });
  });

  it.each([
    ['versi', (d) => { d.v = 2; }, /versi/],
    ['kunci berbeda', (d) => { d.key = '1_-1'; }, /kunci|konsisten/],
    ['center salah', (d) => { d.center = [0, 0]; }, /center/],
    ['angka bukan bulat', (d) => { d.buildings[0].ring[0] = 1.5; }, /bangunan/],
    ['ring terlalu pendek', (d) => { d.buildings[0].ring = [0, 0, 1, 1]; }, /bangunan/],
    ['ring ganjil', (d) => { d.water[0].rings[0] = [0, 0, 1, 1, 2]; }, /air/],
    ['polyline pendek', (d) => { d.roads[0].pts = [0, 0]; }, /polyline/],
    ['lebar nol', (d) => { d.waterways[0].w = 0; }, /polyline/],
    ['array hilang', (d) => { delete d.roads; }, /roads/],
  ])('%s → ditolak', (_, mutate, re) => {
    const d = sample();
    mutate(d);
    const r = validateTileData(d, '0_-1');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(re);
  });

  it('bukan objek → ditolak', () => {
    expect(validateTileData(null).ok).toBe(false);
  });

  it('semua data.json hasil bake di public/tiles lolos validasi', () => {
    const m = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
    for (const t of m.tiles) {
      const d = JSON.parse(readFileSync(`public/tiles/${t.data.file}`, 'utf8'));
      expect(validateTileData(d, t.key), t.key).toEqual({ ok: true });
    }
  });
});

describe('decodeTileData', () => {
  it('tile-lokal 0,1 m → dunia (meter); lubang air dipisah; nama jalan opsional', () => {
    const t = decodeTileData(sample());
    expect(t.center).toEqual({ x: 250, z: -250 });
    expect(t.buildings[0].height).toBeCloseTo(6.4, 9);
    expect(t.buildings[0].ring[0]).toEqual([250 - 160, -250 - 155]);
    expect(t.water[0].outer).toHaveLength(3);
    expect(t.water[0].holes).toHaveLength(1);
    expect(t.roads[0]).toMatchObject({ cls: 'primary', name: 'Jalan Uji Raya' });
    expect(t.roads[0].width).toBeCloseTo(14, 9);
    expect(t.roads[1].name).toBeNull();
    expect(t.waterways[0].pts[1]).toEqual([250 + 200, -250 - 150]);
  });
});

describe('validateManifest', () => {
  it('manifest hasil bake lolos; versi/format/ukuran/entri salah ditolak', () => {
    const m = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
    expect(validateManifest(m)).toEqual({ ok: true });
    expect(validateManifest({ ...m, version: 2 }).ok).toBe(false);
    expect(validateManifest({ ...m, format: 'x' }).ok).toBe(false);
    expect(validateManifest({ ...m, tileSize: 250 }).ok).toBe(false);
    expect(validateManifest({ ...m, tiles: [{ ...m.tiles[0], key: '9_9' }] }).error).toMatch(/entri tile/);
    expect(validateManifest(null).ok).toBe(false);
    expect(validateManifest({ ...m, tiles: null }).ok).toBe(false);
  });
});
```
Tambahkan di akhir `tests/geo/polygon.test.js`:
```js
describe('polygon: jarak ke tepi (TileCollider)', () => {
  it('distanceToSegment & distanceToRing (ring tertutup vs polyline terbuka)', async () => {
    const { distanceToSegment, distanceToRing } = await import('../../src/geo/polygon.js');
    expect(distanceToSegment(5, 3, [0, 0], [10, 0])).toBe(3);
    expect(distanceToSegment(-4, 3, [0, 0], [10, 0])).toBe(5);
    expect(distanceToSegment(1, 1, [0, 0], [0, 0])).toBeCloseTo(Math.SQRT2, 12);
    expect(distanceToRing(5, 5, SQUARE)).toBe(5);
    expect(distanceToRing(-1, 5, SQUARE)).toBe(1);
    const L = [[0, 0], [10, 0], [10, 10]];
    expect(distanceToRing(0, 10, L, false)).toBe(10);
    expect(distanceToRing(0, 10, L, true)).toBeCloseTo(Math.SQRT2 * 5, 9);
    expect(distanceToRing(0, 0, [[1, 1]], false)).toBe(Infinity);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/city/tileData.test.js tests/geo/polygon.test.js
```
Expected: FAIL — `Failed to resolve import "../../src/city/tileData.js"`, `distanceToSegment is not a function`.

- [ ] **Step 3: Implementasi.** Tambahkan di akhir `src/geo/polygon.js`:
```js

/** Jarak titik (x, z) ke segmen a→b. */
export function distanceToSegment(x, z, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / len2)) : 0;
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}

/** Jarak titik ke tepi ring (closed = true) atau polyline (closed = false); Infinity bila < 2 titik. */
export function distanceToRing(x, z, ring, closed = true) {
  let best = Infinity;
  const n = ring.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i += 1) {
    const d = distanceToSegment(x, z, ring[i], ring[(i + 1) % n]);
    if (d < best) best = d;
  }
  return best;
}
```
Buat `src/city/tileData.js`:
```js
/**
 * Validasi & dekode data tile citybake ("Format tile v1", Plan B): manifest.json dan {key}.data.json.
 * Data tak valid ditolak sebelum dipakai (spec §5): tile tak valid dilewati, manifest tak valid →
 * mode hanya-region. Murni (tanpa three/DOM).
 */
import { tileCenter, TILE_SIZE } from '../geo/tiles.js';

export const TILE_FORMAT_VERSION = 1;
export const TILE_FORMAT = 'citybake-tiles';
export const TILE_UNIT = 0.1;

const isInt = (v) => Number.isInteger(v);
const isFlat = (a, min) => Array.isArray(a) && a.length >= min && a.length % 2 === 0 && a.every(isInt);

/**
 * @param {unknown} m isi manifest.json
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function validateManifest(m) {
  if (!m || typeof m !== 'object') return { ok: false, error: 'manifest bukan objek' };
  if (m.version !== TILE_FORMAT_VERSION) return { ok: false, error: `versi manifest ${m.version} tidak didukung` };
  if (m.format !== TILE_FORMAT) return { ok: false, error: `format "${m.format}" bukan ${TILE_FORMAT}` };
  if (m.tileSize !== TILE_SIZE) return { ok: false, error: `tileSize ${m.tileSize} ≠ ${TILE_SIZE}` };
  if (m.unit !== TILE_UNIT) return { ok: false, error: `unit ${m.unit} ≠ ${TILE_UNIT}` };
  if (!Array.isArray(m.tiles) || !Array.isArray(m.areas)) return { ok: false, error: 'tiles/areas harus array' };
  for (const t of m.tiles) {
    const lodOk = Array.isArray(t?.lod) && t.lod.length === 2 && t.lod.every((l, i) => l?.level === i && typeof l.file === 'string');
    if (typeof t?.key !== 'string' || !isInt(t.ix) || !isInt(t.iz) || t.key !== `${t.ix}_${t.iz}` || !lodOk || typeof t.data?.file !== 'string') {
      return { ok: false, error: `entri tile tidak valid: ${JSON.stringify(t?.key ?? t)}` };
    }
  }
  return { ok: true };
}

/**
 * @param {unknown} d isi {key}.data.json
 * @param {string} [expectedKey] kunci tile yang diminta
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function validateTileData(d, expectedKey) {
  if (!d || typeof d !== 'object') return { ok: false, error: 'data tile bukan objek' };
  if (d.v !== TILE_FORMAT_VERSION) return { ok: false, error: `versi data tile ${d.v} tidak didukung` };
  if (expectedKey !== undefined && d.key !== expectedKey) return { ok: false, error: `kunci ${d.key} ≠ ${expectedKey}` };
  if (!isInt(d.ix) || !isInt(d.iz) || d.key !== `${d.ix}_${d.iz}`) return { ok: false, error: 'ix/iz/key tidak konsisten' };
  const c = tileCenter(d.ix, d.iz);
  if (!Array.isArray(d.center) || d.center[0] !== c.x || d.center[1] !== c.z) return { ok: false, error: 'center ≠ pusat tile' };
  if (d.unit !== TILE_UNIT) return { ok: false, error: `unit ${d.unit} ≠ ${TILE_UNIT}` };
  for (const k of ['buildings', 'water', 'waterways', 'roads']) if (!Array.isArray(d[k])) return { ok: false, error: `${k} harus array` };
  if (!d.buildings.every((b) => isInt(b?.h) && b.h >= 0 && isFlat(b.ring, 6))) return { ok: false, error: 'bangunan tidak valid' };
  if (!d.water.every((w) => Array.isArray(w?.rings) && w.rings.length >= 1 && w.rings.every((r) => isFlat(r, 6)))) {
    return { ok: false, error: 'air tidak valid' };
  }
  const lineOk = (l) => typeof l?.cls === 'string' && isInt(l.w) && l.w > 0 && isFlat(l.pts, 4);
  if (!d.waterways.every(lineOk) || !d.roads.every(lineOk)) return { ok: false, error: 'polyline tidak valid' };
  return { ok: true };
}

/** Array datar tile-lokal (satuan unit) → ring dunia [[x, z], ...]. */
function toWorldPoints(flat, cx, cz, unit) {
  const out = new Array(flat.length / 2);
  for (let i = 0; i < flat.length; i += 2) out[i / 2] = [cx + flat[i] * unit, cz + flat[i + 1] * unit];
  return out;
}

/**
 * Dekode data tile (sudah tervalidasi) ke koordinat DUNIA (meter).
 * @returns {{key:string, ix:number, iz:number, center:{x:number,z:number},
 *   buildings: Array<{height:number, ring:Array<[number,number]>}>,
 *   water: Array<{outer:Array<[number,number]>, holes:Array<Array<[number,number]>>}>,
 *   waterways: Array<{cls:string, width:number, pts:Array<[number,number]>}>,
 *   roads: Array<{cls:string, width:number, name:string|null, pts:Array<[number,number]>}>}}
 */
export function decodeTileData(d) {
  const [cx, cz] = d.center;
  const u = d.unit;
  const pts = (flat) => toWorldPoints(flat, cx, cz, u);
  return {
    key: d.key,
    ix: d.ix,
    iz: d.iz,
    center: { x: cx, z: cz },
    buildings: d.buildings.map((b) => ({ height: b.h * u, ring: pts(b.ring) })),
    water: d.water.map((w) => ({ outer: pts(w.rings[0]), holes: w.rings.slice(1).map(pts) })),
    waterways: d.waterways.map((l) => ({ cls: l.cls, width: l.w * u, pts: pts(l.pts) })),
    roads: d.roads.map((l) => ({ cls: l.cls, width: l.w * u, name: l.name ?? null, pts: pts(l.pts) })),
  };
}
```

- [ ] **Step 4: Tes → LULUS** (termasuk validasi ke-52 `data.json` hasil bake)

```bash
node node_modules/vitest/vitest.mjs run tests/city/tileData.test.js tests/geo/polygon.test.js
```

- [ ] **Step 5: Lint + commit**

```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
git add src/city/tileData.js src/geo/polygon.js tests/city/tileData.test.js tests/geo/polygon.test.js && git commit -m "feat(city): validasi & dekode manifest/data tile v1; jarak titik ke tepi poligon"
```

---

## Task 12: `ChunkStreamer` — state machine muat/lepas tile (murni)

Spec Fase 2 butir 1: input fokus + manifest → aksi `load/swap/cancel/unload`; muat r ≤ 1.000 m, lepas r > 1.300 m (histeresis), LOD1 untuk 600–1.000 m (histeresis LOD 50 m agar tidak berkedip di batas), maks 2 muat paralel, prioritas jarak terdekat, batal bila keluar radius sebelum selesai. Jarak = jarak fokus ke persegi tile (tile yang dipijak = 0 m → LOD0). Tile tanpa entri manifest (kosong) tidak pernah dimuat (dianggap kosong-termuat, kontrak tile v1).

**Files:**
- Create: `src/city/ChunkStreamer.js`
- Test: `tests/city/chunkStreamer.test.js`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/city/chunkStreamer.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createChunkStreamer, rectDistance, STREAM } from '../../src/city/ChunkStreamer.js';
import { tileKey } from '../../src/geo/tiles.js';

/** Grid tile persegi ix, iz ∈ [from, to]. */
const grid = (from, to) => {
  const out = [];
  for (let iz = from; iz <= to; iz += 1) for (let ix = from; ix <= to; ix += 1) out.push({ key: tileKey(ix, iz), ix, iz });
  return out;
};
/** Selesaikan semua aksi load/swap secara sinkron (loader palsu sukses). */
const settleAll = (s, actions) => actions.filter((a) => a.type === 'load' || a.type === 'swap').forEach((a) => s.loaded(a.key, a.lod, a.req));
/** Ulang update + selesaikan sampai tidak ada aksi baru. */
const pump = (s, focus, max = 100) => {
  for (let i = 0; i < max; i += 1) {
    const a = s.update(focus);
    if (a.length === 0) return;
    settleAll(s, a);
  }
};

describe('rectDistance', () => {
  it('0 di dalam persegi; jarak ke tepi/sudut di luar', () => {
    const b = { minX: 0, minZ: 0, maxX: 500, maxZ: 500 };
    expect(rectDistance(250, 250, b)).toBe(0);
    expect(rectDistance(-100, 250, b)).toBe(100);
    expect(rectDistance(800, 900, b)).toBe(500);
  });
});

describe('ChunkStreamer', () => {
  it('maks 2 muat paralel, terdekat dulu; LOD0 < 600 m, LOD1 600–1000 m', () => {
    const s = createChunkStreamer({ tiles: grid(-3, 2) });
    const first = s.update({ x: 10, z: 10 });
    expect(first).toEqual([{ type: 'load', key: '0_0', lod: 0, req: 1 }, { type: 'load', key: '-1_0', lod: 0, req: 2 }]);
    expect(s.update({ x: 10, z: 10 })).toEqual([]); // slot penuh
    settleAll(s, first);
    pump(s, { x: 10, z: 10 });
    expect(s.stats().loading).toBe(0);
    expect(s.lodOf('0_0')).toBe(0);
    expect(s.lodOf('-2_0')).toBe(0);   // x ∈ [-1000, -500): 510 m → LOD0
    expect(s.lodOf('2_0')).toBe(1);    // x ∈ [1000, 1500): 990 m → LOD1
    expect(s.status('-3_0')).toBe('idle'); // 1010 m: di luar radius muat
  });

  it('semua tile yang persegi-nya ≤ 1000 m dimuat, sisanya tidak', () => {
    const s = createChunkStreamer({ tiles: grid(-4, 3) });
    pump(s, { x: 0, z: 0 });
    for (const key of s.keys('loaded')) {
      const [ix, iz] = key.split('_').map(Number);
      expect(rectDistance(0, 0, { minX: ix * 500, minZ: iz * 500, maxX: (ix + 1) * 500, maxZ: (iz + 1) * 500 })).toBeLessThanOrEqual(1000);
    }
    expect(s.keys('loaded').length).toBe(grid(-4, 3).filter((t) => rectDistance(0, 0, {
      minX: t.ix * 500, minZ: t.iz * 500, maxX: (t.ix + 1) * 500, maxZ: (t.iz + 1) * 500,
    }) <= 1000).length);
  });

  it('histeresis: dilepas hanya setelah > 1300 m; masuk lagi → dimuat ulang', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    pump(s, { x: 250, z: 250 });
    expect(s.status('0_0')).toBe('loaded');
    expect(s.update({ x: 250 + 250 + 1200, z: 250 })).toEqual([]); // 1200 m: masih
    expect(s.update({ x: 250 + 250 + 1301, z: 250 })).toEqual([{ type: 'unload', key: '0_0' }]);
    expect(s.status('0_0')).toBe('idle');
    expect(s.update({ x: 250, z: 250 })[0]).toMatchObject({ type: 'load', key: '0_0', lod: 0 });
  });

  it('tukar LOD saat mendekat/menjauh dengan histeresis 50 m; LOD lama tetap sampai swap selesai', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    pump(s, { x: -800, z: 250 }); // 800 m → LOD1
    expect(s.lodOf('0_0')).toBe(1);
    const swap = s.update({ x: -550, z: 250 }); // 550 m < 600 → LOD0
    expect(swap).toEqual([{ type: 'swap', key: '0_0', lod: 0, req: 2 }]);
    expect(s.status('0_0')).toBe('loaded');
    expect(s.lodOf('0_0')).toBe(1);
    s.loaded('0_0', 0, 2);
    expect(s.update({ x: -640, z: 250 })).toEqual([]); // 640 ≤ 650: tetap LOD0
    expect(s.update({ x: -660, z: 250 })[0]).toMatchObject({ type: 'swap', lod: 1 });
  });

  it('batal bila keluar radius sebelum selesai; hasil basi ditolak', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    const [load] = s.update({ x: -900, z: 250 });
    expect(load.type).toBe('load');
    expect(s.update({ x: -1100, z: 250 })).toEqual([{ type: 'cancel', key: '0_0', req: load.req }]);
    expect(s.loaded('0_0', load.lod, load.req)).toBe(false);
    expect(s.status('0_0')).toBe('idle');
  });

  it('gagal: tile ditandai gagal, tidak dicoba lagi sampai keluar >1300 m; settled menghitung gagal sebagai selesai', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    const [load] = s.update({ x: 250, z: 250 });
    expect(s.settled(250, 250, 600)).toBe(false);
    expect(s.failed('0_0', load.req)).toBe(true);
    expect(s.failed('0_0', load.req)).toBe(false);
    expect(s.status('0_0')).toBe('failed');
    expect(s.update({ x: 250, z: 250 })).toEqual([]);
    expect(s.settled(250, 250, 600)).toBe(true);
    s.update({ x: 5000, z: 250 });
    expect(s.status('0_0')).toBe('idle');
  });

  it('tukar LOD gagal: LOD lama dipertahankan, tidak dicoba ulang', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    pump(s, { x: -800, z: 250 });
    const [swap] = s.update({ x: -500, z: 250 });
    s.failed('0_0', swap.req);
    expect(s.lodOf('0_0')).toBe(1);
    expect(s.update({ x: -500, z: 250 })).toEqual([]);
  });

  it('fokus tak valid → tanpa aksi; konfigurasi radius tak masuk akal ditolak', () => {
    const s = createChunkStreamer({ tiles: grid(0, 0) });
    expect(s.update({ x: Number.NaN, z: 0 })).toEqual([]);
    expect(s.update(null)).toEqual([]);
    expect(() => createChunkStreamer({ tiles: [], config: { ...STREAM, unloadRadius: 900 } })).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/city/chunkStreamer.test.js
```
Expected: FAIL — `Failed to resolve import "../../src/city/ChunkStreamer.js"`.

- [ ] **Step 3: Implementasi** — buat `src/city/ChunkStreamer.js`:
```js
/**
 * ChunkStreamer: state machine muat/lepas tile kota (logika murni, terpisah dari I/O).
 * update(focus) → daftar aksi untuk TileLoader:
 *   {type:'load', key, lod, req}  tile belum tampil → muat LOD `lod`
 *   {type:'swap', key, lod, req}  tile tampil → ganti ke LOD lain (yang lama tetap tampil sampai selesai)
 *   {type:'cancel', key, req}     muatan keluar radius sebelum selesai → hasilnya dibuang
 *   {type:'unload', key}          tile terlalu jauh → lepas
 * Jarak = jarak fokus ke persegi tile. Muat bila ≤ loadRadius, lepas bila > unloadRadius (histeresis),
 * LOD0 di bawah lod0Radius (± lodHysteresis), maks maxParallel muatan bersamaan, prioritas terdekat.
 * Hasil muatan dilaporkan lewat loaded()/failed() dengan `req`; hasil basi (dibatalkan) → false.
 */
import { tileBounds, TILE_SIZE } from '../geo/tiles.js';

export const STREAM = Object.freeze({ loadRadius: 1000, unloadRadius: 1300, lod0Radius: 600, lodHysteresis: 50, maxParallel: 2 });

/** Jarak titik ke persegi tile (0 bila di dalam). */
export function rectDistance(x, z, b) {
  const dx = Math.max(b.minX - x, 0, x - b.maxX);
  const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
  return Math.hypot(dx, dz);
}

/**
 * @param {{tiles: Array<{key:string, ix:number, iz:number}>, tileSize?: number, config?: typeof STREAM}} opts
 */
export function createChunkStreamer({ tiles, tileSize = TILE_SIZE, config = STREAM }) {
  if (!(config.unloadRadius > config.loadRadius)) throw new RangeError('ChunkStreamer: unloadRadius harus > loadRadius');
  const list = tiles.map((t) => ({
    key: t.key, bounds: tileBounds(t.ix, t.iz, tileSize),
    status: 'idle', lod: null, pending: null, noSwap: false, dist: Infinity,
  }));
  const byKey = new Map(list.map((t) => [t.key, t]));
  let seq = 0;

  const inFlight = () => list.reduce((n, t) => n + (t.pending ? 1 : 0), 0);
  const wantLod = (t) => {
    const near = config.lod0Radius;
    if (t.lod === 0) return t.dist <= near + config.lodHysteresis ? 0 : 1;
    return t.dist < near ? 0 : 1;
  };

  const release = (t, out) => {
    if (t.status === 'loaded' || t.status === 'loading') {
      if (t.pending) out.push({ type: 'cancel', key: t.key, req: t.pending.req });
      if (t.status === 'loaded') out.push({ type: 'unload', key: t.key });
    }
    t.status = 'idle';
    t.lod = null;
    t.pending = null;
    t.noSwap = false;
  };

  return {
    /** @param {{x:number, z:number}} focus @returns {Array<object>} aksi berurutan */
    update(focus) {
      const out = [];
      if (!focus || !Number.isFinite(focus.x) || !Number.isFinite(focus.z)) return out;
      for (const t of list) t.dist = rectDistance(focus.x, focus.z, t.bounds);
      for (const t of list) {
        if (t.dist > config.unloadRadius && t.status !== 'idle') release(t, out);
        else if (t.dist > config.loadRadius && t.status === 'loading') {
          out.push({ type: 'cancel', key: t.key, req: t.pending.req });
          t.status = 'idle';
          t.pending = null;
        } else if (t.dist > config.loadRadius && t.pending) { // tukar LOD di luar radius muat: batalkan, tetap tampil
          out.push({ type: 'cancel', key: t.key, req: t.pending.req });
          t.pending = null;
        }
      }
      const candidates = list
        .filter((t) => t.dist <= config.loadRadius && !t.pending
          && (t.status === 'idle' || (t.status === 'loaded' && !t.noSwap && wantLod(t) !== t.lod)))
        .sort((a, b) => a.dist - b.dist || (a.key < b.key ? -1 : 1));
      let slots = config.maxParallel - inFlight();
      for (const t of candidates) {
        if (slots <= 0) break;
        seq += 1;
        const lod = wantLod(t);
        t.pending = { lod, req: seq };
        if (t.status === 'idle') {
          t.status = 'loading';
          out.push({ type: 'load', key: t.key, lod, req: seq });
        } else {
          out.push({ type: 'swap', key: t.key, lod, req: seq });
        }
        slots -= 1;
      }
      return out;
    },
    /** Muatan selesai; false = basi (dibatalkan/diganti) → pemanggil membuang hasilnya. */
    loaded(key, lod, req) {
      const t = byKey.get(key);
      if (!t?.pending || t.pending.req !== req || t.pending.lod !== lod) return false;
      t.status = 'loaded';
      t.lod = lod;
      t.pending = null;
      return true;
    },
    /** Muatan gagal (setelah retry). Tukar LOD gagal: LOD lama tetap, tidak dicoba lagi sampai tile dilepas. */
    failed(key, req) {
      const t = byKey.get(key);
      if (!t?.pending || t.pending.req !== req) return false;
      t.pending = null;
      if (t.status === 'loaded') t.noSwap = true;
      else t.status = 'failed';
      return true;
    },
    status: (key) => byKey.get(key)?.status ?? null,
    lodOf: (key) => byKey.get(key)?.lod ?? null,
    /** Semua tile manifest dalam radius r dari (x, z) sudah tampil atau gagal (tidak ada yang menunggu). */
    settled(x, z, r) {
      return list.every((t) => rectDistance(x, z, t.bounds) > r || t.status === 'loaded' || t.status === 'failed');
    },
    keys(status) { return list.filter((t) => t.status === status).map((t) => t.key); },
    stats() {
      const s = { idle: 0, loading: 0, loaded: 0, failed: 0, inFlight: inFlight() };
      for (const t of list) s[t.status] += 1;
      return s;
    },
  };
}
```

- [ ] **Step 4: Tes → LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/city/chunkStreamer.test.js
```
Expected: PASS (9 tes).

- [ ] **Step 5: Lint + commit**

```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
git add src/city/ChunkStreamer.js tests/city/chunkStreamer.test.js && git commit -m "feat(city): ChunkStreamer (radius muat 1 km, lepas 1,3 km, LOD 600 m, maks 2 paralel, batal)"
```

---

## Task 13: `TileCollider` + collider tidak terkunci saat tile dimuat di bawah sepeda

Spec Fase 2 butir 3 + §3.1 collider komposit: spatial hash sel 25 m dari footprint bangunan + air (`data.json`). Aturan tambahan yang realistis: jalan yang melintasi poligon air = jembatan (dapat dilalui); bangunan memblok dengan jarak bebas 0,6 m (sepeda) / 0,8 m (kamera), selaras `regions/stadion/collider.js`. Tile belum dimuat = terbuka (spec §5). Karena tile bisa selesai dimuat saat sepeda sudah berada di atas footprint, `createCollider` dibebaskan bila posisi terakhirnya sendiri menjadi tidak valid (tanpa ini sepeda terkunci selamanya).

**Files:**
- Create: `src/city/TileCollider.js`
- Modify: `src/core/Collider.js:46-58`
- Test: `tests/city/tileCollider.test.js` (baru), `tests/collider.test.js` (tambah di akhir)

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/city/tileCollider.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createTileCollider } from '../../src/city/TileCollider.js';
import { decodeTileData } from '../../src/city/tileData.js';
import { createCompositeCollider, localized } from '../../src/core/Collider.js';
import { stadionRegion } from '../../src/regions/stadion/index.js';
import { stadionColliders } from '../../src/regions/stadion/collider.js';

const square = (x0, z0, s) => [[x0, z0], [x0 + s, z0], [x0 + s, z0 + s], [x0, z0 + s]];
const tile = (over = {}) => ({ key: '0_0', buildings: [], water: [], waterways: [], roads: [], ...over });

describe('TileCollider', () => {
  it('bangunan memblok di dalam & < 0,6 m dari dinding; terbuka di luar', () => {
    const c = createTileCollider();
    c.addTile('0_0', tile({ buildings: [{ height: 6, ring: square(10, 10, 10) }] }));
    expect(c.isWalkable(15, 15)).toBe(false);
    expect(c.isWalkable(9.6, 15)).toBe(false);
    expect(c.isWalkable(9.3, 15)).toBe(true);
    expect(c.isWalkable(40, 40)).toBe(true);
    expect(c.isCameraClear(9.3, 15)).toBe(false); // jarak bebas kamera 0,8 m
    expect(c.isCameraClear(9, 15)).toBe(true);
  });

  it('bangunan yang melintasi batas sel 25 m tetap terdeteksi di semua sel', () => {
    const c = createTileCollider();
    c.addTile('0_0', tile({ buildings: [{ height: 6, ring: square(20, 20, 40) }] }));
    for (const [x, z] of [[21, 21], [30, 30], [55, 55], [45, 26]]) expect(c.isWalkable(x, z)).toBe(false);
  });

  it('air memblok kecuali lubang dan jalan di atasnya (jembatan)', () => {
    const c = createTileCollider();
    c.addTile('0_0', tile({
      water: [{ outer: square(0, 0, 100), holes: [square(40, 40, 10)] }],
      roads: [{ cls: 'primary', width: 14, name: null, pts: [[-10, 80], [110, 80]] }],
    }));
    expect(c.isWalkable(20, 20)).toBe(false);
    expect(c.isWalkable(45, 45)).toBe(true);  // pulau
    expect(c.isWalkable(50, 85)).toBe(true);  // jembatan (≤ 7 m dari sumbu)
    expect(c.isWalkable(50, 88)).toBe(false);
    expect(c.isCameraClear(20, 20)).toBe(true); // kamera boleh di atas air
  });

  it('removeTile melepas semua bentuk tile itu saja; tile belum dimuat = terbuka', () => {
    const c = createTileCollider();
    c.addTile('0_0', tile({ buildings: [{ height: 6, ring: square(10, 10, 10) }] }));
    c.addTile('1_0', tile({ key: '1_0', buildings: [{ height: 6, ring: square(510, 10, 10) }] }));
    expect(c.tileCount).toBe(2);
    expect(c.removeTile('0_0')).toBe(true);
    expect(c.removeTile('0_0')).toBe(false);
    expect(c.isWalkable(15, 15)).toBe(true);
    expect(c.isWalkable(515, 15)).toBe(false);
    c.removeTile('1_0');
    expect(c.cellCount).toBe(0);
    expect(c.isWalkable(Number.NaN, 0)).toBe(false);
    expect(c.isCameraClear(0, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('data tile nyata: footprint bangunan pertama di tile 12_-10 memblok, pusat jalan utama terbuka', () => {
    const d = JSON.parse(readFileSync('public/tiles/12_-10.data.json', 'utf8'));
    const t = decodeTileData(d);
    const c = createTileCollider();
    c.addTile(t.key, t);
    const ring = t.buildings[0].ring;
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    expect(c.isWalkable(cx, cz)).toBe(false);
    const major = t.roads.find((r) => r.name);
    expect(c.isWalkable(major.pts[0][0], major.pts[0][1])).toBe(true);
  });

  it('collider komposit: di dalam mask → region; di luar → TileCollider', () => {
    const city = createTileCollider();
    city.addTile('1_-1', tile({ key: '1_-1', buildings: [{ height: 6, ring: square(600, -300, 20) }] }));
    const comp = createCompositeCollider({ regions: [{ region: stadionRegion, colliders: stadionColliders }], fallback: city });
    const tugu = stadionColliders.obstacles[0];
    expect(comp.isWalkable(tugu.x, tugu.z)).toBe(false); // region
    expect(comp.isWalkable(610, -290)).toBe(false);       // bangunan kota
    expect(comp.isWalkable(700, -290)).toBe(true);
    expect(localized(stadionRegion, stadionColliders).isWalkable(610, -290)).toBe(true); // dulu: tanah region menutup dunia
  });
});
```
Tambahkan di akhir `tests/collider.test.js`:
```js
describe('collider: tidak terkunci bila tanah di bawah sepeda menjadi terhalang (Plan C)', () => {
  it('posisi terakhir kini tidak walkable (tile baru dimuat) → gerakan berikut dibebaskan', () => {
    let blocked = false;
    const collide = createCollider({ x: 0, z: 0 }, (x) => !(blocked && x < 5));
    expect(collide(1, 0)).toEqual({ x: 1, z: 0 });
    blocked = true; // bangunan muncul di bawah sepeda
    expect(collide(2, 0)).toEqual({ x: 2, z: 0 });
    expect(collide(6, 0)).toEqual({ x: 6, z: 0 });
    expect(collide(4, 0)).toEqual({ x: 6, z: 0 }); // sudah keluar: tabrakan normal lagi
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/city/tileCollider.test.js tests/collider.test.js
```
Expected: FAIL — `Failed to resolve import "../../src/city/TileCollider.js"`; `collide(2, 0)` mengembalikan `{x: 1, z: 0}` (terkunci).

- [ ] **Step 3: Implementasi** — buat `src/city/TileCollider.js`:
```js
/**
 * TileCollider: collider kota dari data tile (koordinat DUNIA). Spatial hash sel 25 m; tiap bentuk
 * didaftarkan ke semua sel yang dilalui bbox-nya (diperlebar jarak bebas), sehingga kueri cukup
 * memeriksa satu sel. Aturan:
 * - bangunan memblok sepeda (di dalam footprint atau < `clearance` dari dinding) dan kamera;
 * - air memblok sepeda kecuali di atas jalan (jembatan = jalan yang melintasi poligon air);
 * - tile yang belum dimuat = terbuka (spec §5: area tetap dapat dilalui).
 * Murni (tanpa three/DOM); memakai pointInPolygon/distanceToRing dari geo/polygon.js.
 */
import { pointInPolygon, distanceToRing } from '../geo/polygon.js';

export const TILE_COLLIDER = Object.freeze({ cellSize: 25, clearance: 0.6, cameraClearance: 0.8 });

const bboxOf = (pts, pad) => {
  let minX = Infinity; let minZ = Infinity; let maxX = -Infinity; let maxZ = -Infinity;
  for (const [x, z] of pts) {
    if (x < minX) minX = x;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }
  return { minX: minX - pad, minZ: minZ - pad, maxX: maxX + pad, maxZ: maxZ + pad };
};

/** @param {{cellSize?:number, clearance?:number, cameraClearance?:number}} [opts] */
export function createTileCollider({ cellSize = TILE_COLLIDER.cellSize, clearance = TILE_COLLIDER.clearance,
  cameraClearance = TILE_COLLIDER.cameraClearance } = {}) {
  const cells = new Map();  // "cx,cz" → shape[]
  const tiles = new Map();  // key → {cellKeys:Set<string>, shapes:shape[]}
  const pad = Math.max(clearance, cameraClearance);
  const cellOf = (v) => Math.floor(v / cellSize);
  const keyOf = (cx, cz) => `${cx},${cz}`;

  const insert = (tileRec, shape) => {
    const b = shape.bbox;
    for (let cz = cellOf(b.minZ); cz <= cellOf(b.maxZ); cz += 1) {
      for (let cx = cellOf(b.minX); cx <= cellOf(b.maxX); cx += 1) {
        const k = keyOf(cx, cz);
        let list = cells.get(k);
        if (!list) cells.set(k, (list = []));
        list.push(shape);
        tileRec.cellKeys.add(k);
      }
    }
    tileRec.shapes.push(shape);
  };

  const shapesAt = (x, z) => cells.get(keyOf(cellOf(x), cellOf(z))) ?? [];
  const inBox = (s, x, z) => x >= s.bbox.minX && x <= s.bbox.maxX && z >= s.bbox.minZ && z <= s.bbox.maxZ;

  const nearBuilding = (x, z, gap) => shapesAt(x, z).some((s) => s.kind === 'building' && inBox(s, x, z)
    && (pointInPolygon(x, z, s.ring) || distanceToRing(x, z, s.ring) < gap));
  const inWater = (x, z) => shapesAt(x, z).some((s) => s.kind === 'water' && inBox(s, x, z)
    && pointInPolygon(x, z, s.outer) && !s.holes.some((h) => pointInPolygon(x, z, h)));
  const onRoad = (x, z) => shapesAt(x, z).some((s) => s.kind === 'road' && inBox(s, x, z)
    && distanceToRing(x, z, s.pts, false) <= s.half);

  return {
    /** Daftarkan tile terdekode (decodeTileData); pendaftaran ulang kunci yang sama mengganti. */
    addTile(key, tile) {
      if (tiles.has(key)) this.removeTile(key);
      const rec = { cellKeys: new Set(), shapes: [] };
      for (const b of tile.buildings) insert(rec, { kind: 'building', ring: b.ring, bbox: bboxOf(b.ring, pad) });
      for (const w of tile.water) insert(rec, { kind: 'water', outer: w.outer, holes: w.holes, bbox: bboxOf(w.outer, 0) });
      for (const r of tile.roads) insert(rec, { kind: 'road', pts: r.pts, half: r.width / 2, bbox: bboxOf(r.pts, r.width / 2) });
      tiles.set(key, rec);
    },
    removeTile(key) {
      const rec = tiles.get(key);
      if (!rec) return false;
      const owned = new Set(rec.shapes);
      for (const k of rec.cellKeys) {
        const rest = (cells.get(k) ?? []).filter((s) => !owned.has(s));
        if (rest.length) cells.set(k, rest);
        else cells.delete(k);
      }
      tiles.delete(key);
      return true;
    },
    has: (key) => tiles.has(key),
    get tileCount() { return tiles.size; },
    get cellCount() { return cells.size; },
    isWalkable(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      if (nearBuilding(x, z, clearance)) return false;
      return !inWater(x, z) || onRoad(x, z);
    },
    isCameraClear(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      return !nearBuilding(x, z, cameraClearance);
    },
  };
}
```
Di `src/core/Collider.js` ganti `:46-48`:
```js
/**
 * Collider stateful: mengembalikan posisi valid terakhir bila posisi baru menabrak.
 * Mencoba meluncur (slide) di sumbu X atau Z agar tidak "lengket".
```
menjadi:
```js
/**
 * Collider stateful: mengembalikan posisi valid terakhir bila posisi baru menabrak.
 * Mencoba meluncur (slide) di sumbu X atau Z agar tidak "lengket". Bila posisi terakhir sendiri
 * menjadi tidak valid (tile kota baru dimuat di bawah sepeda), gerakan dibebaskan agar tidak terkunci.
```
dan sisipkan setelah `:56` (`if (isWalkable(x, z)) return (last = { x, z });`):
```js
    if (!isWalkable(last.x, last.z)) return (last = { x, z }); // terjebak: biarkan keluar
```

- [ ] **Step 4: Tes → LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/city/tileCollider.test.js tests/collider.test.js tests/compositeCollider.test.js
```

- [ ] **Step 5: Suite + lint + commit**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
git add src/city/TileCollider.js src/core/Collider.js tests/city/tileCollider.test.js tests/collider.test.js && git commit -m "feat(city): TileCollider (spatial hash 25 m, bangunan & air, jalan di atas air = jembatan); collider tidak terkunci"
```

---

## Task 14: `cityMaterials` + `TileLoader` (GLTFLoader + MeshoptDecoder, retry, dispose)

Spec Fase 2 butir 2 + tile v1: GLB tile berisi node datar `landuse, water, roads, buildings_walls, buildings_roofs` (placeholder putih); klien mengganti material berdasarkan NAMA dengan `vertexColors: true`; lapisan datar `depthWrite: false` + `renderOrder` −3/−2/−1 (WAJIB, Plan B: kuantisasi 14 bit membuat offset y tak bisa diandalkan); transform node GLB tidak boleh direset (root tile hanya `position.set(center.x, 0, center.z)`); geometri dianggap read-only (accessor bisa dibagi antar-mesh). Pola memuat sama dengan `tools/citybake/viewer.js:46-66`. `freezeStatic` dipindah ke `engine/` karena lapisan `city/` tidak boleh mengimpor `world/` (spec §3; re-export lama dipertahankan). Tekstur jendela (spec §3 `cityMaterials`) TIDAK dibuat: tile v1 tanpa UV (lihat Self-review).

**Files:**
- Create: `src/engine/freezeStatic.js` (isi dari `src/world/util/freezeStatic.js:1-21`)
- Modify: `src/world/util/freezeStatic.js` (jadi re-export)
- Create: `src/city/cityMaterials.js`, `src/city/TileLoader.js`
- Test: `tests/city/tileLoader.test.js`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/city/tileLoader.test.js`:
```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createTileLoader, TileDataError } from '../../src/city/TileLoader.js';
import { createCityMaterials, CITY_LAYERS } from '../../src/city/cityMaterials.js';
import { createChunkStreamer } from '../../src/city/ChunkStreamer.js';
import { createTileCollider } from '../../src/city/TileCollider.js';

const quiet = { error() {} };
const KEY = '0_-1';
const DATA = {
  v: 1, key: KEY, ix: 0, iz: -1, center: [250, -250], unit: 0.1,
  buildings: [{ h: 64, ring: [-100, -100, 100, -100, 100, 100, -100, 100] }], water: [], waterways: [], roads: [],
};
const manifest = {
  tiles: [{ key: KEY, ix: 0, iz: -1, lod: [{ level: 0, file: `${KEY}.lod0.glb` }, { level: 1, file: `${KEY}.lod1.glb` }], data: { file: `${KEY}.data.json` } }],
};

/** Scene GLB palsu: mesh bernama sesuai kontrak + satu nama asing. */
function fakeGltf(names = ['landuse', 'roads', 'buildings_walls', 'asing']) {
  const scene = new THREE.Group();
  for (const n of names) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
    m.name = n;
    scene.add(m);
  }
  return { scene };
}

function setup({ gltf = () => Promise.resolve(fakeGltf()), json = () => Promise.resolve(structuredClone(DATA)), weather = null } = {}) {
  const parent = new THREE.Group();
  const materials = createCityMaterials();
  const collider = createTileCollider();
  const minimap = { added: [], dropped: [], add(k) { this.added.push(k); }, drop(k) { this.dropped.push(k); } };
  const fails = [];
  const calls = { gltf: [], json: [] };
  const loader = createTileLoader({
    manifest, baseUrl: '/base/', parent, materials, collider, minimap, weather,
    loadGltf: (u) => { calls.gltf.push(u); return gltf(u); },
    fetchJson: (u) => { calls.json.push(u); return json(u); },
    sleep: () => Promise.resolve(), onFail: (k, e) => fails.push([k, e]), logger: quiet,
  });
  const streamer = createChunkStreamer({ tiles: manifest.tiles });
  return { parent, materials, collider, minimap, fails, calls, loader, streamer };
}

const run = async (s, focus) => {
  for (const a of s.streamer.update(focus)) await s.loader.execute(a, s.streamer);
};

describe('TileLoader', () => {
  it('muat: grup di pusat tile, material kota per nama + renderOrder, collider & minimap terdaftar', async () => {
    const s = setup();
    await run(s, { x: 250, z: -250 });
    expect(s.calls.json).toEqual(['/base/tiles/0_-1.data.json']);
    expect(s.calls.gltf).toEqual(['/base/tiles/0_-1.lod0.glb']);
    const root = s.parent.children[0];
    expect(root.position.toArray()).toEqual([250, 0, -250]);
    const meshes = {};
    root.traverse((o) => { if (o.isMesh) meshes[o.name] = o; });
    expect(meshes.landuse.material).toBe(s.materials.forMesh('landuse'));
    expect(meshes.landuse.renderOrder).toBe(CITY_LAYERS.landuse.renderOrder);
    expect(meshes.landuse.material.depthWrite).toBe(false);
    expect(meshes.buildings_walls.castShadow).toBe(true);
    expect(meshes.asing.visible).toBe(false);
    expect(root.children[0].matrixAutoUpdate).toBe(false); // freezeStatic
    expect(s.collider.isWalkable(250, -250)).toBe(false);  // bangunan 20 × 20 m di pusat
    expect(s.minimap.added).toEqual([KEY]);
    expect(s.loader.stats()).toMatchObject({ tiles: 1, meshes: 3 });
  });

  it('lepas: geometri dilepas, material bersama tidak; collider & minimap dibersihkan; registry basah dicabut', async () => {
    const wet = [];
    const s = setup({ weather: { registerWet: (r) => { wet.push(`+${r.name}`); return () => { wet.push(`-${r.name}`); return true; }; } } });
    await run(s, { x: 250, z: -250 });
    const geos = [];
    s.parent.traverse((o) => { if (o.isMesh) geos.push(o.geometry); });
    let disposed = 0;
    geos.forEach((g) => g.addEventListener('dispose', () => { disposed += 1; }));
    let matDisposed = false;
    s.materials.forMesh('roads').addEventListener('dispose', () => { matDisposed = true; });
    await run(s, { x: 5000, z: -250 });
    expect(s.parent.children).toHaveLength(0);
    expect(disposed).toBe(geos.length);
    expect(matDisposed).toBe(false);
    expect(s.collider.isWalkable(250, -250)).toBe(true);
    expect(s.minimap.dropped).toEqual([KEY]);
    expect(wet).toEqual(['+tile:0_-1:lod0', '-tile:0_-1:lod0']);
  });

  it('tukar LOD: LOD baru terpasang, LOD lama dilepas; data tidak diunduh ulang', async () => {
    const s = setup();
    await run(s, { x: 250, z: -1100 }); // 850 m → LOD1
    expect(s.loader.lodOf(KEY)).toBe(1);
    await run(s, { x: 250, z: -700 });  // 450 m → LOD0
    expect(s.loader.lodOf(KEY)).toBe(0);
    expect(s.parent.children).toHaveLength(1);
    expect(s.parent.children[0].name).toBe('tile:0_-1:lod0');
    expect(s.calls.json).toHaveLength(1);
  });

  it('galat jaringan dicoba ulang 2× lalu gagal: onFail sekali, streamer menandai gagal', async () => {
    let n = 0;
    const s = setup({ gltf: () => { n += 1; return Promise.reject(new Error('jaringan')); } });
    await run(s, { x: 250, z: -250 });
    expect(n).toBe(3);
    expect(s.fails.map(([k]) => k)).toEqual([KEY]);
    expect(s.streamer.status(KEY)).toBe('failed');
    expect(s.parent.children).toHaveLength(0);
  });

  it('data tak valid tidak dicoba ulang dan tile dilewati', async () => {
    let n = 0;
    const s = setup({ json: () => { n += 1; return Promise.resolve({ ...DATA, v: 9 }); } });
    await run(s, { x: 250, z: -250 });
    expect(n).toBe(1);
    expect(s.fails[0][1]).toBeInstanceOf(TileDataError);
    expect(s.parent.children).toHaveLength(0);
  });

  it('hasil yang datang setelah dibatalkan dibuang (tidak terpasang, geometri dilepas)', async () => {
    let resolve;
    const s = setup({ gltf: () => new Promise((r) => { resolve = r; }) });
    const [load] = s.streamer.update({ x: 250, z: -250 });
    const pending = s.loader.execute(load, s.streamer);
    expect(s.streamer.update({ x: 250, z: -1600 })).toEqual([{ type: 'cancel', key: KEY, req: load.req }]); // 1100 m: batal
    const late = fakeGltf(['roads']);
    let disposed = false;
    late.scene.children[0].geometry.addEventListener('dispose', () => { disposed = true; });
    resolve(late);
    await pending;
    expect(s.parent.children).toHaveLength(0);
    expect(disposed).toBe(true);
  });

  it('GLB nyata dari public/tiles termuat lewat GLTFLoader + MeshoptDecoder (Node)', async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
    await MeshoptDecoder.ready;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const buf = readFileSync('public/tiles/0_-1.lod0.glb');
    const gltf = await new Promise((res, rej) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
    const names = [];
    gltf.scene.traverse((o) => { if (o.isMesh) names.push(o.name); });
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(Object.keys(CITY_LAYERS)).toContain(n);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/city/tileLoader.test.js
```
Expected: FAIL — `Failed to resolve import "../../src/city/TileLoader.js"`.

- [ ] **Step 3: `freezeStatic` ke engine.**

```bash
git mv src/world/util/freezeStatic.js src/engine/freezeStatic.js
```
Di `src/engine/freezeStatic.js` ganti baris JSDoc:
```js
 * `obj.updateMatrix(); obj.matrixWorldNeedsUpdate = true` manual.
```
menjadi:
```js
 * `obj.updateMatrix(); obj.matrixWorldNeedsUpdate = true` manual. Lapisan engine: tanpa impor three
 * (dipindah dari world/util agar city/ dapat memakainya, Plan C).
```
Buat `src/world/util/freezeStatic.js`:
```js
/** Dipindah ke engine/freezeStatic.js (dipakai juga oleh city/); re-export untuk impor lama. */
export { freezeStatic } from '../../engine/freezeStatic.js';
```

- [ ] **Step 4: Material kota** — buat `src/city/cityMaterials.js`:
```js
/**
 * Material bersama tile kota, dipilih berdasarkan NAMA mesh ("Format tile v1"): landuse, water, roads,
 * buildings_walls, buildings_roofs. Warna dari vertex color (COLOR_0, linear). Lapisan datar digambar
 * tanpa menulis depth dengan renderOrder −3/−2/−1 (urutan segitiga menentukan visibilitas; tanah &
 * objek region yang digambar sesudahnya menutupi landuse kota yang menjorok ke mask). Tanah dasar kota
 * (renderOrder −4, y = −0,05) mengisi celah landuse. Tekstur jendela tidak dibuat: tile v1 tanpa UV.
 */
import * as THREE from 'three';

export const CITY_LAYERS = Object.freeze({
  ground: Object.freeze({ renderOrder: -4, flat: true }),
  landuse: Object.freeze({ renderOrder: -3, flat: true }),
  water: Object.freeze({ renderOrder: -2, flat: true }),
  roads: Object.freeze({ renderOrder: -1, flat: true }),
  buildings_walls: Object.freeze({ renderOrder: 0, flat: false }),
  buildings_roofs: Object.freeze({ renderOrder: 0, flat: false }),
});

export const CITY_GROUND_COLOR = 0xb9b59a; // tanah/rumput kering netral di bawah landuse

/** @returns {{forMesh(name:string): THREE.Material|null, layerOf(name:string): object|null, owns(r:object): boolean, ground: THREE.Material, dispose(): void}} */
export function createCityMaterials() {
  const flat = (name, Ctor, extra = {}) => {
    const m = new Ctor({ vertexColors: true, depthWrite: false, ...extra });
    m.name = `kota:${name}`;
    return m;
  };
  const solid = (name) => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    m.name = `kota:${name}`;
    return m;
  };
  const byName = {
    landuse: flat('landuse', THREE.MeshLambertMaterial),
    water: flat('water', THREE.MeshStandardMaterial, { roughness: 0.35, metalness: 0 }),
    roads: flat('roads', THREE.MeshLambertMaterial),
    buildings_walls: solid('buildings_walls'),
    buildings_roofs: solid('buildings_roofs'),
  };
  const ground = new THREE.MeshLambertMaterial({ color: CITY_GROUND_COLOR, depthWrite: true });
  ground.name = 'kota:ground';
  const all = new Set([...Object.values(byName), ground]);
  return {
    forMesh: (name) => byName[name] ?? null,
    layerOf: (name) => CITY_LAYERS[name] ?? null,
    owns: (r) => all.has(r),
    ground,
    dispose() { for (const m of all) m.dispose(); },
  };
}

/**
 * Pasang material & aturan render pada scene GLB tile (di tempat). Mesh dengan nama tak dikenal
 * disembunyikan (kontrak dilanggar) agar placeholder putih tidak tampil.
 * @returns {{meshes: number, triangles: number}}
 */
export function applyCityMaterials(root, materials) {
  let meshes = 0;
  let triangles = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mat = materials.forMesh(o.name);
    const layer = materials.layerOf(o.name);
    if (!mat || !layer) {
      o.visible = false;
      return;
    }
    o.material.dispose?.(); // placeholder bawaan GLB
    o.material = mat;
    o.renderOrder = layer.renderOrder;
    o.castShadow = !layer.flat;
    o.receiveShadow = true;
    meshes += 1;
    triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  });
  return { meshes, triangles };
}
```

- [ ] **Step 5: Loader** — buat `src/city/TileLoader.js`:
```js
/**
 * TileLoader: mengeksekusi aksi ChunkStreamer (I/O). Memuat {key}.data.json (divalidasi) dan
 * {key}.lod{n}.glb (GLTFLoader + MeshoptDecoder), memasang grup tile di pusat tile, mengganti
 * material berdasarkan nama mesh, freezeStatic per tile, mendaftarkan collider/minimap/permukaan
 * basah, dan melepas semuanya saat tile dilepas. Galat jaringan dicoba ulang `retries`× dengan
 * backoff; data tak valid tidak dicoba ulang (tile dilewati, spec §5).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { tileCenter } from '../geo/tiles.js';
import { disposeTree } from '../engine/disposeTree.js';
import { freezeStatic } from '../engine/freezeStatic.js';
import { applyCityMaterials } from './cityMaterials.js';
import { decodeTileData, validateTileData } from './tileData.js';

export const TILE_RETRIES = 2;
export const TILE_BACKOFF_MS = Object.freeze([500, 1500]);

/** Galat yang tidak layak dicoba ulang (data rusak/tak valid). */
export class TileDataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TileDataError';
  }
}

/** GLTFLoader dengan dekoder meshopt (EXT_meshopt_compression + KHR_mesh_quantization). */
export function createGltfLoader() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return (url) => loader.loadAsync(url);
}

/** fetch JSON dengan galat HTTP eksplisit. */
export async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {{manifest: object, baseUrl?: string, parent: THREE.Object3D, materials: ReturnType<import('./cityMaterials.js').createCityMaterials>,
 *   collider: {addTile(key:string, tile:object):void, removeTile(key:string):boolean},
 *   minimap?: {add(key:string, tile:object):void, drop(key:string):void}|null,
 *   weather?: {registerWet(root:THREE.Object3D): () => boolean}|null,
 *   loadGltf?: (url:string) => Promise<{scene: THREE.Object3D}>, fetchJson?: (url:string) => Promise<unknown>,
 *   retries?: number, backoffMs?: readonly number[], sleep?: (ms:number) => Promise<void>,
 *   onFail?: (key:string, err:unknown) => void, logger?: {error: (...a: unknown[]) => void}}} opts
 */
export function createTileLoader({
  manifest, baseUrl = '/', parent, materials, collider, minimap = null, weather = null,
  loadGltf = createGltfLoader(), fetchJson: getJson = fetchJson, retries = TILE_RETRIES, backoffMs = TILE_BACKOFF_MS,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onFail = () => {}, logger = console,
}) {
  const info = new Map(manifest.tiles.map((t) => [t.key, t]));
  const entries = new Map(); // key → {root, lod, offWet, meshes, triangles}
  const decoded = new Map(); // key → data tile terdekode (dipakai ulang saat tukar LOD)
  const url = (file) => `${baseUrl}tiles/${file}`;

  const retry = async (fn) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        if (err instanceof TileDataError || attempt >= retries) throw err;
        await sleep(backoffMs[Math.min(attempt, backoffMs.length - 1)]);
      }
    }
  };

  const loadData = async (t) => {
    if (decoded.has(t.key)) return decoded.get(t.key);
    const json = await retry(() => getJson(url(t.data.file)));
    const check = validateTileData(json, t.key);
    if (!check.ok) throw new TileDataError(`tile ${t.key}: ${check.error}`);
    const tile = decodeTileData(json);
    decoded.set(t.key, tile);
    return tile;
  };

  const buildRoot = async (t, lod) => {
    const gltf = await retry(() => loadGltf(url(t.lod[lod].file)));
    const root = new THREE.Group();
    root.name = `tile:${t.key}:lod${lod}`;
    const c = tileCenter(t.ix, t.iz);
    root.position.set(c.x, 0, c.z); // kontrak: transform node GLB (kuantisasi) tidak boleh direset
    root.add(gltf.scene);
    return { root, ...applyCityMaterials(gltf.scene, materials) };
  };

  const discard = (root) => disposeTree(root, { scope: materials }); // material kota dibagi: hanya geometri

  const attach = (key, built, lod) => {
    parent.add(built.root);
    freezeStatic(built.root);
    const offWet = weather ? weather.registerWet(built.root) : null;
    entries.set(key, { root: built.root, lod, offWet, meshes: built.meshes, triangles: built.triangles });
  };

  const detach = (key) => {
    const e = entries.get(key);
    if (!e) return;
    entries.delete(key);
    e.offWet?.();
    e.root.removeFromParent();
    discard(e.root);
  };

  const fail = (streamer, action, err) => {
    if (streamer.failed(action.key, action.req)) {
      logger.error(`Tile ${action.key} gagal dimuat:`, err);
      onFail(action.key, err);
    }
  };

  async function load(action, streamer) {
    const t = info.get(action.key);
    let tile;
    let built;
    try {
      [tile, built] = await Promise.all([loadData(t), buildRoot(t, action.lod)]);
    } catch (err) {
      fail(streamer, action, err);
      return;
    }
    if (!streamer.loaded(action.key, action.lod, action.req)) {
      discard(built.root); // dibatalkan sementara dimuat
      return;
    }
    attach(action.key, built, action.lod);
    collider.addTile(action.key, tile);
    minimap?.add(action.key, tile);
  }

  async function swap(action, streamer) {
    const t = info.get(action.key);
    let built;
    try {
      built = await buildRoot(t, action.lod);
    } catch (err) {
      fail(streamer, action, err);
      return;
    }
    if (!streamer.loaded(action.key, action.lod, action.req)) {
      discard(built.root);
      return;
    }
    detach(action.key); // LOD lama dilepas setelah yang baru siap (tanpa lubang)
    attach(action.key, built, action.lod);
  }

  function unload(key) {
    detach(key);
    decoded.delete(key);
    collider.removeTile(key);
    minimap?.drop(key);
  }

  return {
    /** Eksekusi satu aksi streamer; muatan berjalan async (hasil dilaporkan ke streamer). */
    execute(action, streamer) {
      if (!info.has(action.key)) return Promise.resolve();
      switch (action.type) {
        case 'load': return load(action, streamer);
        case 'swap': return swap(action, streamer);
        case 'unload': unload(action.key); return Promise.resolve();
        default: return Promise.resolve(); // 'cancel': hasil basi dibuang saat streamer.loaded() = false
      }
    },
    has: (key) => entries.has(key),
    lodOf: (key) => entries.get(key)?.lod ?? null,
    stats() {
      let meshes = 0;
      let triangles = 0;
      for (const e of entries.values()) {
        meshes += e.meshes;
        triangles += e.triangles;
      }
      return { tiles: entries.size, meshes, triangles };
    },
    dispose() { for (const key of [...entries.keys()]) unload(key); },
  };
}
```

- [ ] **Step 6: Tes → LULUS** (termasuk parse GLB nyata `public/tiles/0_-1.lod0.glb` di Node)

```bash
node node_modules/vitest/vitest.mjs run tests/city/tileLoader.test.js tests/freezeStatic.test.js
```
Expected: PASS (7 + tes freezeStatic lama).

- [ ] **Step 7: Suite + lint + commit**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
git add src/engine/freezeStatic.js src/world/util/freezeStatic.js src/city/cityMaterials.js src/city/TileLoader.js tests/city/tileLoader.test.js && git commit -m "feat(city): TileLoader (GLB meshopt + data.json tervalidasi, retry 2× backoff, material per nama mesh, dispose) dan freezeStatic ke engine"
```

---

## Task 15: Minimap tile kota (`tileMinimap.js` + layer di `Minimap2D`)

Spec Fase 2 butir 4: Minimap2D menyusun layer tile (canvas per tile, digambar sekali dari data vektor) di bawah layer region (peta dasar bake). Canvas 256 px per tile 500 m (±2 m/px; 24 tile ≈ 6 MB) — kompromi memori ponsel vs ketajaman.

**Files:**
- Create: `src/city/tileMinimap.js`
- Modify: `src/shared/minimapMath.js` (tambah `worldRectToView` di akhir)
- Modify: `src/ui/Minimap2D.js:1-7` (doc + impor), konstruktor (`tileLayer`), `setTileLayer`, `update` (gambar tile sebelum peta dasar)
- Test: `tests/city/tileMinimap.test.js`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/city/tileMinimap.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { drawTileLayer, createTileMinimapCache, TILE_MINIMAP_STYLE } from '../../src/city/tileMinimap.js';
import { worldRectToView } from '../../src/shared/minimapMath.js';

/** Konteks 2D palsu yang mencatat panggilan. */
function fakeCtx() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...args) => calls.push([k, ...args])),
    set: (t, k, v) => { calls.push([`=${String(k)}`, v]); return true; },
  });
  return { ctx, calls };
}
const tile = {
  ix: 0, iz: -1,
  water: [{ outer: [[0, -500], [100, -500], [100, -400]], holes: [] }],
  waterways: [],
  roads: [{ cls: 'primary', width: 14, pts: [[0, -250], [500, -250]] }, { cls: 'footway', width: 2, pts: [[0, -100], [10, -100]] }],
  buildings: [{ height: 6, ring: [[250, -250], [260, -250], [260, -240]] }],
};

describe('tileMinimap', () => {
  it('drawTileLayer: latar daratan, air (evenodd), jalan minor lalu mayor, bangunan; koordinat tile → piksel', () => {
    const { ctx, calls } = fakeCtx();
    drawTileLayer(ctx, tile, { px: 256, tileSize: 500 });
    expect(calls[0]).toEqual(['=fillStyle', TILE_MINIMAP_STYLE.land]);
    expect(calls[1]).toEqual(['fillRect', 0, 0, 256, 256]);
    expect(calls).toContainEqual(['fill', 'evenodd']);
    const moveTos = calls.filter((c) => c[0] === 'moveTo');
    expect(moveTos[0]).toEqual(['moveTo', 0, 0]); // (0, −500) = sudut barat laut tile 0_-1
    const styles = calls.filter((c) => c[0] === '=strokeStyle').map((c) => c[1]);
    expect(styles.indexOf(TILE_MINIMAP_STYLE.roadMinor)).toBeLessThan(styles.indexOf(TILE_MINIMAP_STYLE.roadMajor));
    const widths = calls.filter((c) => c[0] === '=lineWidth').map((c) => c[1]);
    expect(widths).toContain(14 * 256 / 500);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(0.8);
  });

  it('cache: add/drop, tilesInView hanya tile yang beririsan jendela', () => {
    const created = [];
    const cache = createTileMinimapCache({ createCanvas: (w, h) => { const c = { width: w, height: h, getContext: () => fakeCtx().ctx }; created.push(c); return c; } });
    cache.add('0_-1', tile);
    cache.add('5_5', { ...tile, ix: 5, iz: 5 });
    expect(cache.size).toBe(2);
    const view = cache.tilesInView({ x: 250, z: -250 }, 160);
    expect(view).toHaveLength(1);
    expect(view[0].bounds).toEqual({ minX: 0, minZ: -500, maxX: 500, maxZ: 0 });
    cache.drop('0_-1');
    expect(cache.tilesInView({ x: 250, z: -250 }, 160)).toEqual([]);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('worldRectToView: persegi tile relatif fokus, skala tampilan', () => {
    const r = worldRectToView({ minX: 0, minZ: -500, maxX: 500, maxZ: 0 }, { x: 250, z: -250 }, 250, 200);
    expect(r).toEqual({ x: 0, y: 0, w: 200, h: 200 });
    expect(worldRectToView({ minX: 0, minZ: -500, maxX: 500, maxZ: 0 }, { x: 0, z: -250 }, 250, 200)).toEqual({ x: 100, y: 0, w: 200, h: 200 });
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/city/tileMinimap.test.js
```
Expected: FAIL — modul `tileMinimap.js` tidak ada, `worldRectToView` bukan ekspor.

- [ ] **Step 3: Implementasi.** Tambahkan di akhir `src/shared/minimapMath.js`:
```js

/** Persegi dunia {minX, minZ, maxX, maxZ} → persegi tampilan (piksel) dengan fokus di tengah. */
export function worldRectToView(b, focus, halfExtent, viewSize) {
  const k = viewSize / (2 * halfExtent);
  return {
    x: viewSize / 2 + (b.minX - fin(focus?.x)) * k,
    y: viewSize / 2 + (b.minZ - fin(focus?.z)) * k,
    w: (b.maxX - b.minX) * k,
    h: (b.maxZ - b.minZ) * k,
  };
}
```
Buat `src/city/tileMinimap.js`:
```js
/**
 * Layer minimap tile kota: data vektor tile (air, jalan, bangunan) digambar SEKALI per tile ke canvas
 * kecil (cache per tile), lalu Minimap2D hanya `drawImage` tile yang tampak. Utara = atas (+x kanan,
 * +z bawah), sama dengan peta dasar region.
 */
import { tileBounds, TILE_SIZE } from '../geo/tiles.js';

export const TILE_MINIMAP_PX = 256; // ±2 m/piksel untuk tile 500 m
export const TILE_MINIMAP_STYLE = Object.freeze({
  land: '#c9c2b0',
  water: '#4f86a6',
  waterway: '#4f86a6',
  roadMajor: '#f4f1ea',
  roadMinor: '#e2ddd2',
  building: '#a89f92',
  buildingEdge: '#8c8377',
});
const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
const MIN_LINE_PX = 0.8;

/**
 * Gambar satu tile terdekode (koordinat dunia) ke ctx2d ukuran px × px yang mewakili persegi tile.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ix:number, iz:number, water:object[], waterways:object[], roads:object[], buildings:object[]}} tile
 */
export function drawTileLayer(ctx, tile, { px = TILE_MINIMAP_PX, tileSize = TILE_SIZE, style = TILE_MINIMAP_STYLE } = {}) {
  const b = tileBounds(tile.ix, tile.iz, tileSize);
  const k = px / tileSize;
  const tx = (x) => (x - b.minX) * k;
  const tz = (z) => (z - b.minZ) * k;
  const path = (pts, close) => {
    ctx.beginPath();
    pts.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(tx(x), tz(z)) : ctx.lineTo(tx(x), tz(z))));
    if (close) ctx.closePath();
  };
  ctx.fillStyle = style.land;
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = style.water;
  for (const w of tile.water) {
    path(w.outer, true);
    for (const h of w.holes) {
      h.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(tx(x), tz(z)) : ctx.lineTo(tx(x), tz(z))));
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const stroke = (lines, color) => {
    ctx.strokeStyle = color;
    for (const l of lines) {
      ctx.lineWidth = Math.max(MIN_LINE_PX, l.width * k);
      path(l.pts, false);
      ctx.stroke();
    }
  };
  stroke(tile.waterways, style.waterway);
  stroke(tile.roads.filter((r) => !MAJOR.has(r.cls)), style.roadMinor);
  stroke(tile.roads.filter((r) => MAJOR.has(r.cls)), style.roadMajor);
  ctx.fillStyle = style.building;
  ctx.strokeStyle = style.buildingEdge;
  ctx.lineWidth = MIN_LINE_PX;
  for (const bd of tile.buildings) {
    path(bd.ring, true);
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * Cache canvas per tile untuk Minimap2D.
 * @param {{createCanvas?: (w:number, h:number) => {width:number, height:number, getContext(t:string): object},
 *   px?: number, tileSize?: number}} [opts]
 */
export function createTileMinimapCache({ createCanvas = defaultCanvas, px = TILE_MINIMAP_PX, tileSize = TILE_SIZE } = {}) {
  const tiles = new Map(); // key → {canvas, bounds}
  return {
    add(key, tile) {
      const canvas = createCanvas(px, px);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawTileLayer(ctx, tile, { px, tileSize });
      tiles.set(key, { canvas, bounds: tileBounds(tile.ix, tile.iz, tileSize) });
    },
    drop(key) { tiles.delete(key); },
    clear() { tiles.clear(); },
    get size() { return tiles.size; },
    /** Tile yang beririsan dengan jendela ±halfExtent di sekitar fokus. */
    tilesInView(focus, halfExtent) {
      const out = [];
      for (const t of tiles.values()) {
        const b = t.bounds;
        if (b.maxX < focus.x - halfExtent || b.minX > focus.x + halfExtent) continue;
        if (b.maxZ < focus.z - halfExtent || b.minZ > focus.z + halfExtent) continue;
        out.push(t);
      }
      return out;
    },
  };
}

function defaultCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
```
Di `src/ui/Minimap2D.js` ganti `:1-7`:
```js
/**
 * Minimap 2D: peta dasar (tampak atas) di-bake SEKALI dari scene lewat kamera ortografis
 * (App.bakeMinimap), lalu per frame hanya `drawImage` jendela di sekitar pemain + marker pada
 * canvas 2D kecil. Tanpa render 3D tambahan, tidak terpengaruh siang/malam, dan murah.
 * Utara = atas; sepeda selalu di tengah.
 */
import { clampToEdge, projectToView, sourceRect } from '../shared/minimapMath.js';
```
menjadi:
```js
/**
 * Minimap 2D: dua layer — (1) tile kota (canvas per tile dari city/tileMinimap.js, di bawah) dan
 * (2) peta dasar region (tampak atas) yang di-bake SEKALI dari scene lewat kamera ortografis
 * (App.bakeMinimap). Per frame hanya `drawImage` jendela di sekitar pemain + marker pada canvas 2D
 * kecil. Tanpa render 3D tambahan, tidak terpengaruh siang/malam, dan murah. Utara = atas.
 */
import { clampToEdge, projectToView, sourceRect, worldRectToView } from '../shared/minimapMath.js';
```
Setelah `    this.baseCenter = { x: 0, z: 0 };` (Task 4) tambahkan `    this.tileLayer = null;`. Sisipkan sebelum `  setVisible(visible) {`:
```js
  /** @param {{tilesInView(focus:{x:number,z:number}, halfExtent:number): Array<{canvas: CanvasImageSource, bounds: object}>}|null} layer */
  setTileLayer(layer) {
    this.tileLayer = layer;
    this._last = -Infinity;
  }

```
Di `update`, ganti:
```js
    ctx.fillRect(0, 0, S, S);
    if (this.base) {
```
menjadi:
```js
    ctx.fillRect(0, 0, S, S);
    for (const t of this.tileLayer?.tilesInView(focus, this.halfExtent) ?? []) {
      const r = worldRectToView(t.bounds, focus, this.halfExtent, S);
      ctx.drawImage(t.canvas, r.x, r.y, r.w, r.h);
    }
    if (this.base) {
```

- [ ] **Step 4: Tes → LULUS + lint**

```bash
node node_modules/vitest/vitest.mjs run tests/city/tileMinimap.test.js tests/minimapMath.test.js
```
```bash
node node_modules/eslint/bin/eslint.js .
```

- [ ] **Step 5: Commit**

```bash
git add src/city/tileMinimap.js src/shared/minimapMath.js src/ui/Minimap2D.js tests/city/tileMinimap.test.js && git commit -m "feat(city): layer minimap tile (canvas per tile) di bawah peta dasar region"
```

---

## Task 16: Komposisi kota — `createCity`, kabut/far plane, collider komposit, wiring

Spec Fase 2 butir 2–5, §5: satu sistem `city.stream` (fase `world`, setelah `stadion.world`) memberi fokus (`ctx.focus`, fallback `bikePos`) ke streamer dan mengeksekusi aksi; tanah dasar kota (y −0,05, renderOrder −4, depth ditulis) mengikuti fokus per 50 m agar celah landuse dan area di luar tile tidak menampakkan langit; manifest gagal → `null` + toast (mode hanya-region, perilaku lama). Kabut: `fog.far` dibatasi radius muat (1.000 m) agar batas muat tertutup kabut (konten selalu ada sampai ≥ 1.000 m dari fokus ke segala arah di area ber-tile); far plane kamera tetap 2.500 m (bintang 1.800 m, kubah awan 2.200 m). Shadow tetap lokal ±200 m (`Lighting.js:18`), bangunan tile `castShadow`. Hujan membasahi jalan kota (`'roads'` di `WET_MESH_NAMES`).

**Files:**
- Create: `src/city/index.js`
- Modify: `src/world/TimeOfDay.js` (`fogRange`, `fogLimit`, `applyPreset`, `setFogLimit`)
- Modify: `src/world/Weather.wet.js` (`WET_MESH_NAMES`)
- Modify: `src/main.js` (impor, kota setelah region, fallback collider, layer minimap, devtools)
- Modify: `src/app/devtools.js` (`city`)
- Test: `tests/city/city.test.js`, `tests/fogRange.test.js`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/city/city.test.js`:
```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createCity, groundAnchor } from '../../src/city/index.js';
import { createSystemRunner } from '../../src/engine/SystemRunner.js';

const quiet = { error() {} };
const realManifest = () => JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
const realJson = (url) => {
  const file = url.replace(/^\/tiles\//, 'public/tiles/');
  return Promise.resolve(JSON.parse(readFileSync(file, 'utf8')));
};
const fakeGltf = () => {
  const scene = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  m.name = 'buildings_walls';
  scene.add(m);
  return Promise.resolve({ scene });
};
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) });

function fakeApp() {
  const runner = createSystemRunner({ logger: quiet });
  return { scene: new THREE.Scene(), runner, addSystem: (s) => runner.add(s), removeSystem: (id) => runner.remove(id) };
}

/** Jalankan frame sampai streamer tenang (muatan palsu selesai di microtask). */
async function frames(app, focus, n = 40) {
  for (let i = 0; i < n; i += 1) {
    app.runner.update(0.016, { focus });
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('createCity', () => {
  it('manifest gagal → null + toast (mode hanya-region), tanpa sistem/grup', async () => {
    const app = fakeApp();
    const toasts = [];
    const city = await createCity({ app, fetchJson: () => Promise.reject(new Error('404')), toast: (t, ok) => toasts.push([t, ok]), logger: quiet });
    expect(city).toBeNull();
    expect(toasts).toEqual([['Peta kota gagal dimuat — hanya kawasan stadion', false]]);
    expect(app.runner.ids).toEqual([]);
    expect(app.scene.children).toHaveLength(0);
  });

  it('manifest tak valid juga → null', async () => {
    const city = await createCity({ app: fakeApp(), fetchJson: () => Promise.resolve({ version: 9 }), logger: quiet });
    expect(city).toBeNull();
  });

  it('streaming dari manifest nyata: tile ≤ 1000 m dari stadion termuat, collider aktif, whenSettled selesai; dispose bersih', async () => {
    const app = fakeApp();
    const city = await createCity({
      app, fetchJson: (u) => (u.endsWith('manifest.json') ? Promise.resolve(realManifest()) : realJson(u)),
      loadGltf: fakeGltf, createCanvas: fakeCanvas, logger: quiet,
    });
    expect(app.runner.ids).toEqual(['city.stream']);
    const settled = city.whenSettled(0, -275, 600, 5000);
    await frames(app, { x: 0, z: -275 });
    expect(await settled).toBe(true);
    const s = city.stats();
    expect(s.loading).toBe(0);
    expect(s.loaded).toBeGreaterThan(10);
    expect(s.tiles).toBe(s.loaded);
    expect(city.minimap.size).toBe(s.loaded);
    expect(city.collider.tileCount).toBe(s.loaded);
    expect(city.group.getObjectByName('tanahKota').position.toArray()).toEqual([0, -0.05, -250]); // Math.round(−5,5) = −5
    city.dispose();
    expect(app.runner.ids).toEqual([]);
    expect(app.scene.children).toHaveLength(0);
    expect(city.collider.tileCount).toBe(0);
  });

  it('whenSettled habis waktu → false', async () => {
    let fire;
    const city = await createCity({
      app: fakeApp(), fetchJson: (u) => (u.endsWith('manifest.json') ? Promise.resolve(realManifest()) : realJson(u)),
      loadGltf: fakeGltf, createCanvas: fakeCanvas, logger: quiet, setTimer: (fn) => { fire = fn; },
    });
    const p = city.whenSettled(6800, -4750, 600, 1);
    fire();
    expect(await p).toBe(false);
  });

  it('groundAnchor membulatkan ke grid 50 m', () => {
    expect(groundAnchor({ x: 26, z: -74 })).toEqual({ x: 50, z: -50 });
  });
});
```
dan `tests/fogRange.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { fogRange } from '../src/world/TimeOfDay.js';

describe('fogRange (batas muat kota)', () => {
  it('tanpa batas / di bawah batas: tidak berubah', () => {
    expect(fogRange(220, 1100)).toEqual({ near: 220, far: 1100 });
    expect(fogRange(120, 700, 1000)).toEqual({ near: 120, far: 700 });
  });
  it('di atas batas: far = batas, near diskalakan proporsional', () => {
    const r = fogRange(220, 1100, 1000);
    expect(r.far).toBe(1000);
    expect(r.near).toBeCloseTo(200, 9);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/city/city.test.js tests/fogRange.test.js
```
Expected: FAIL — `src/city/index.js` tidak ada; `fogRange` bukan ekspor `TimeOfDay.js`.

- [ ] **Step 3: Komposisi kota** — buat `src/city/index.js`:
```js
/**
 * Klien kota (Fase 2): manifest → ChunkStreamer (aksi) → TileLoader (I/O) → TileCollider, layer
 * minimap, dan tanah dasar kota yang mengikuti fokus. Satu sistem `city.stream` (fase world).
 * Manifest gagal/tak valid → null + toast: pemanggil tetap mode hanya-region (spec §5).
 */
import * as THREE from 'three';
import { createChunkStreamer, STREAM } from './ChunkStreamer.js';
import { createTileLoader, createGltfLoader, fetchJson as defaultFetchJson } from './TileLoader.js';
import { createTileCollider } from './TileCollider.js';
import { createCityMaterials, CITY_LAYERS } from './cityMaterials.js';
import { createTileMinimapCache } from './tileMinimap.js';
import { validateManifest } from './tileData.js';

/** Tanah dasar kota: persegi besar di bawah landuse (y −0,05), dipindah per 50 m mengikuti fokus. */
export const CITY_GROUND = Object.freeze({ size: 2 * STREAM.unloadRadius + 400, y: -0.05, snap: 50 });
export const SETTLE_TIMEOUT_MS = 20000;

function createCityGround(material) {
  const geo = new THREE.PlaneGeometry(CITY_GROUND.size, CITY_GROUND.size).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'tanahKota';
  mesh.position.y = CITY_GROUND.y;
  mesh.renderOrder = CITY_LAYERS.ground.renderOrder;
  mesh.receiveShadow = true;
  return mesh;
}

/** Posisi tanah dasar (snap grid) untuk fokus; murni. */
export function groundAnchor(focus, snap = CITY_GROUND.snap) {
  return { x: Math.round(focus.x / snap) * snap, z: Math.round(focus.z / snap) * snap };
}

/**
 * @param {{app: {scene: THREE.Scene, addSystem(s:object):object, removeSystem(id:string):boolean},
 *   baseUrl?: string, weather?: object|null, toast?: (text:string, ok:boolean) => void,
 *   fetchJson?: (url:string) => Promise<unknown>, loadGltf?: (url:string) => Promise<{scene: THREE.Object3D}>,
 *   createCanvas?: (w:number, h:number) => object, logger?: {error: (...a: unknown[]) => void}, config?: typeof STREAM,
 *   setTimer?: (fn: () => void, ms: number) => unknown}} opts
 */
export async function createCity({
  app, baseUrl = '/', weather = null, toast = () => {}, fetchJson = defaultFetchJson, loadGltf = null,
  createCanvas = null, logger = console, config = STREAM, setTimer = (fn, ms) => setTimeout(fn, ms),
}) {
  let manifest;
  try {
    manifest = await fetchJson(`${baseUrl}tiles/manifest.json`);
    const check = validateManifest(manifest);
    if (!check.ok) throw new Error(check.error);
  } catch (err) {
    logger.error('Manifest tile kota gagal dimuat; mode hanya-region:', err);
    toast('Peta kota gagal dimuat — hanya kawasan stadion', false);
    return null;
  }
  const group = new THREE.Group();
  group.name = 'kota';
  app.scene.add(group);
  const materials = createCityMaterials();
  const ground = createCityGround(materials.ground);
  group.add(ground);
  const collider = createTileCollider();
  const minimap = createTileMinimapCache(createCanvas ? { createCanvas } : {});
  const streamer = createChunkStreamer({ tiles: manifest.tiles, config });
  let warned = false;
  const loader = createTileLoader({
    manifest, baseUrl, parent: group, materials, collider, minimap, weather, fetchJson, logger,
    loadGltf: loadGltf ?? createGltfLoader(),
    onFail: () => {
      if (warned) return;
      warned = true;
      toast('Sebagian peta gagal dimuat', false);
    },
  });
  const waiters = new Set();
  const system = {
    id: 'city.stream',
    phase: 'world',
    update(dt, ctx) {
      const focus = ctx.focus ?? ctx.bikePos;
      if (!focus) return;
      const a = groundAnchor(focus);
      ground.position.set(a.x, CITY_GROUND.y, a.z);
      for (const action of streamer.update(focus)) {
        loader.execute(action, streamer).catch((err) => logger.error(`Aksi tile ${action.key} gagal:`, err));
      }
      for (const w of waiters) {
        if (!streamer.settled(w.x, w.z, w.r)) continue;
        waiters.delete(w);
        w.resolve(true);
      }
    },
    dispose() {},
  };
  app.addSystem(system);
  return {
    manifest, group, collider, minimap, streamer, loader,
    /** Selesai bila semua tile dalam radius r dari (x, z) tampil/gagal; false bila habis waktu. */
    whenSettled(x, z, r = config.lod0Radius, timeoutMs = SETTLE_TIMEOUT_MS) {
      if (streamer.settled(x, z, r)) return Promise.resolve(true);
      return new Promise((resolve) => {
        const w = { x, z, r, resolve };
        waiters.add(w);
        setTimer(() => { if (waiters.delete(w)) resolve(false); }, timeoutMs);
      });
    },
    stats: () => ({ ...streamer.stats(), ...loader.stats() }),
    dispose() {
      app.removeSystem(system.id);
      for (const w of waiters) w.resolve(false);
      waiters.clear();
      loader.dispose();
      group.removeFromParent();
      ground.geometry.dispose();
      materials.dispose();
    },
  };
}
```

- [ ] **Step 4: Kabut dibatasi radius muat.** Di `src/world/TimeOfDay.js`:

Sisipkan sebelum `/** Kubah bintang sederhana (Points) yang mengikuti kamera; hanya tampak malam. */`:
```js
/**
 * Jarak kabut efektif: far dibatasi `limit` (radius muat tile kota) agar batas muat tidak terlihat;
 * near diskalakan dengan rasio yang sama sehingga gradasi kabut tetap proporsional. Murni.
 */
export function fogRange(near, far, limit = Infinity) {
  if (!(far > limit)) return { near, far };
  const k = limit / far;
  return { near: near * k, far: limit };
}

```
Setelah `  let envTimer = DAY.envRebuildInterval;` tambahkan:
```js
  let fogLimit = Infinity; // radius muat kota (setFogLimit); Infinity = tanpa batas
```
Di `applyPreset` ganti:
```js
    const fogScale = over.fogDistance / FOG_DEFAULT;
    scene.fog.color.setHex(p.fogColor);
    scene.fog.near = p.fogNear * fogScale;
    scene.fog.far = p.fogFar * fogScale;
```
menjadi:
```js
    const fogScale = over.fogDistance / FOG_DEFAULT;
    const fog = fogRange(p.fogNear * fogScale, p.fogFar * fogScale, fogLimit);
    scene.fog.color.setHex(p.fogColor);
    scene.fog.near = fog.near;
    scene.fog.far = fog.far;
```
Setelah `    setFogDistance(m) { … },` tambahkan:
```js
    /** Batas atas fog.far (m), mis. radius muat tile kota; nilai ≤ 0/tak valid = tanpa batas. */
    setFogLimit(m) { fogLimit = Number(m) > 0 ? Number(m) : Infinity; },
    get fogLimit() { return fogLimit; },
```
`src/world/Weather.wet.js` — `  'joggingTrack', 'tartan', 'apron',` menjadi `  'joggingTrack', 'tartan', 'apron', 'roads', // 'roads' = mesh jalan tile kota`.

- [ ] **Step 5: Wiring `main.js`.** Tambahkan impor setelah `import { withPlacement } from './regions/Region.js';`:
```js
import { createCity } from './city/index.js';
import { STREAM } from './city/ChunkStreamer.js';
```
Ganti:
```js
  const region = stadion.region;
  const colliders = createCompositeCollider({
    regions: [{ region: stadionDef, colliders: region.colliders }],
    fallback: localized(stadionDef, region.colliders), // Fase 0: tanah region (1,4 km) masih menutup seluruh dunia; Fase 2: TileCollider
  });
```
menjadi:
```js
  const region = stadion.region;

  await loading.step(0.4, 'Menyiapkan peta kota (OpenStreetMap)…');
  // Kota: tile OSM di-stream di sekitar fokus. Manifest gagal → null: mode hanya-region (perilaku lama) + toast.
  const city = await createCity({ app, baseUrl: import.meta.env.BASE_URL, weather, toast: (t, ok) => hud.toast(t, ok) });
  if (city) {
    lifecycle.add(() => city.dispose());
    time.setFogLimit(STREAM.loadRadius); // batas muat tertutup kabut
  }
  // Di dalam mask → collider region (lokal); di luar → TileCollider kota (tanpa kota: tanah region menutup dunia).
  const colliders = createCompositeCollider({
    regions: [{ region: stadionDef, colliders: region.colliders }],
    fallback: city ? city.collider : localized(stadionDef, region.colliders),
  });
```
Ganti `  const minimap = setupMinimap(app, ents, story, frame);` menjadi:
```js
  const minimap = setupMinimap(app, ents, story, frame);
  if (city) minimap.setTileLayer(city.minimap);
```
Ganti `    exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story, colliders, teardown: () => lifecycle.disposeAll() });` menjadi `    exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story, colliders, city, teardown: () => lifecycle.disposeAll() });`.
`src/app/devtools.js` — tambahkan `city = null` ke parameter `exposeDevTools({ …, colliders, city = null, teardown })` dan `city` ke objek `window.__sim` (`app, ents, rig, time, weather, store, audioBus, story, city,`).

- [ ] **Step 6: Tes → LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/city tests/fogRange.test.js tests/lifecycle.test.js tests/nightRegistry.test.js
```

- [ ] **Step 7: Suite + lint + build + uji browser**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
Uji browser (`npm run dev`, tanpa parameter URL): di konsol `await __sim.city.whenSettled(0, -275, 1000)` → `true`; `__sim.city.stats()` (saat rencana disusun: 22 tile termuat, 97 mesh, ±34.600 segitiga); `__sim.app.scene.fog.far` = 1000; 0 galat konsol. Draw call tile = selisih `renderFrame()` dengan/tanpa `__sim.city.group.visible` (saat rencana disusun: 68 ≤ 150). Uji manifest gagal: ganti sementara nama `public/tiles/manifest.json` (jangan di-commit) → toast "Peta kota gagal dimuat — hanya kawasan stadion", permainan tetap jalan; kembalikan nama berkas.

- [ ] **Step 8: Commit**

```bash
git add src/city/index.js src/world/TimeOfDay.js src/world/Weather.wet.js src/main.js src/app/devtools.js tests/city/city.test.js tests/fogRange.test.js && git commit -m "feat(city): streaming tile kota (sistem city.stream, tanah dasar, collider komposit TileCollider, kabut ≤ radius muat, mode hanya-region bila manifest gagal)"
```

---

## Task 17: Atribusi data peta (HUD + README)

Spec Fase 2 butir 6 (kewajiban ODbL): teks kecil tetap di HUD "© OpenStreetMap contributors · Overture Maps Foundation" + tautan ke openstreetmap.org/copyright; `public/tiles/ATTRIBUTION.txt` sudah ditulis citybake; README.

**Files:**
- Create: `src/ui/Attribution.js`
- Modify: `src/ui/hud.css` (tambah di akhir), `src/main.js` (blok `if (city)`), `README.md:75-101`
- Test: `tests/attribution.test.js`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/attribution.test.js`:
```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createAttribution, ATTRIBUTION } from '../src/ui/Attribution.js';

describe('atribusi data peta', () => {
  it('teks © OpenStreetMap contributors · Overture Maps Foundation + tautan hak cipta; dispose melepas', () => {
    const a = createAttribution(document.body);
    const el = document.getElementById('map-attribution');
    expect(el.textContent).toBe('© OpenStreetMap contributors · Overture Maps Foundation');
    const link = el.querySelector('a');
    expect(link.href).toBe(ATTRIBUTION.href);
    expect(link.rel).toContain('noopener');
    a.dispose();
    expect(document.getElementById('map-attribution')).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/attribution.test.js
```
Expected: FAIL — `Failed to resolve import "../src/ui/Attribution.js"`.

- [ ] **Step 3: Implementasi** — buat `src/ui/Attribution.js`:
```js
/**
 * Atribusi data peta (kewajiban ODbL): teks kecil tetap di pojok HUD dengan tautan hak cipta OSM.
 * Ditampilkan hanya saat tile kota aktif.
 */
export const ATTRIBUTION = Object.freeze({
  href: 'https://www.openstreetmap.org/copyright',
  osm: 'OpenStreetMap',
  rest: ' contributors · Overture Maps Foundation',
});

/** @param {HTMLElement} root @returns {{el: HTMLElement, dispose(): void}} */
export function createAttribution(root, { doc = root.ownerDocument ?? document } = {}) {
  const el = doc.createElement('div');
  el.id = 'map-attribution';
  const link = doc.createElement('a');
  link.href = ATTRIBUTION.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = ATTRIBUTION.osm;
  el.append('© ', link, ATTRIBUTION.rest);
  root.append(el);
  return { el, dispose: () => el.remove() };
}
```
Tambahkan di akhir `src/ui/hud.css`:
```css
/* Atribusi data peta kota (ODbL) — kecil, tetap, tidak menghalangi kontrol. */
#map-attribution {
  position: fixed;
  left: 8px;
  bottom: 6px;
  z-index: 5;
  font: 500 10px/1.3 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: auto;
}
#map-attribution a { color: inherit; }
```
`src/main.js` — tambahkan impor `import { createAttribution } from './ui/Attribution.js';` dan di blok `if (city) { … }` (Task 16) setelah `time.setFogLimit(...)`:
```js
    lifecycle.add(createAttribution(document.body).dispose);
```
`README.md` — di bagian `## Struktur` (`:75-91`) ganti blok kode struktur menjadi:
```
src/
  app/         composition helper: mountRegion, frame region, perjalanan cepat, keymap, devtools
  engine/      SystemRunner, ResourceScope, disposeTree, freezeStatic, registry material
  geo/         proyeksi ENU, grid tile, transform & placement region, poligon (murni)
  regions/     region handmade (stadion: data, layout, mask, collider, footprint OSM)
  city/        klien streaming tile kota: ChunkStreamer, TileLoader, TileCollider, minimap tile
  core/        App (renderer, loop, post-processing, bake minimap), Input, gamepad, CameraRig,
               Collider komposit, StoryDirector, adaptiveResolution, AudioBus
  config/      constants.js + stadionSite.js — dimensi, warna, data kawasan
  sim/         logika murni tanpa THREE.Mesh (unit-tested); sim/story = mesin cerita
  story/       data cerita (chapter, easter egg), pemicu, penyimpanan, pengaman uang
  settings/    skema, store, safeStorage (localStorage)
  world/       builder geometri statis: Ground, Landscape, stadium/*, props/*, langit/cuaca
  entities/    objek bergerak: Bicycle, Runner, Footballer, Vendor, Crowd, Humanoid (+ LOD)
  ui/          HUD, panel pengaturan, TouchControls, Minimap2D, perjalanan cepat, atribusi
tools/citybake/ bake offline OSM + Overture → public/tiles (Node; tidak ikut bundle)
public/tiles/  tile kota hasil bake (GLB meshopt + data.json + manifest + ATTRIBUTION.txt)
public/models/ model Blender (GLB)
assets-src/    sumber .blend + skrip ekspor (export_glb.py)
docs/
  research/    riset fakta stadion & teknis Three.js
  superpowers/ spec desain, rencana implementasi, audit & roadmap perbaikan
```
Sisipkan sebelum `## Lisensi` (`:99`):
```markdown
## Data peta & atribusi
Jalan, bangunan, air, dan tata guna lahan kota berasal dari © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors dan Overture Maps Foundation, di-bake offline oleh `tools/citybake` (`npm run bake -- --area stadion|pusat|all`; cache data mentah di `data-src/`, tidak di-commit). Data turunan di `public/tiles/` (`*.glb`, `*.data.json`) berlisensi **ODbL 1.0**; rincian sumber, waktu data, dan rilis Overture ada di `public/tiles/ATTRIBUTION.txt`. Atribusi juga tampil di pojok kiri bawah layar selama peta kota aktif.

```
dan ganti isi `## Lisensi` menjadi:
```markdown
Kode: MIT, lihat [LICENSE](LICENSE). Data tile kota (`public/tiles/`): ODbL 1.0 (lihat bagian "Data peta & atribusi").
```

- [ ] **Step 4: Tes → LULUS; suite + lint + build**

```bash
node node_modules/vitest/vitest.mjs run tests/attribution.test.js
```
```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/Attribution.js src/ui/hud.css src/main.js README.md tests/attribution.test.js && git commit -m "feat: atribusi data peta (© OpenStreetMap contributors · Overture Maps Foundation) di HUD dan README"
```

---

## Task 18: Fase 3 — placement stadion dari poligon OSM (centroid + yaw sumbu panjang)

Spec Fase 3 butir 1. Footprint OSM way 327365495 (52 titik, ODbL) disimpan sebagai data (tanpa jaringan saat build/tes); placement = centroid luas + arah sumbu panjang dari momen luas kedua (bukan PCA titik — titik busur yang rapat dan tonjolan barat membiaskan PCA titik ke 0,6°). Hasil: `{x: 0,0108, z: −0,0026, yaw: 3,2·10⁻⁵}` (origin dunia = centroid poligon yang sama) — selisih visual tidak terlihat, tetapi seluruh pipa I1 kini berjalan dengan placement non-identitas. Mask = **fallback** (hull + koridor, Task 8): OSM tidak memiliki poligon "kompleks stadion" (diperiksa: yang melingkupi hanya `amenity=university` Universitas Riau dan `leisure=park` EcoEduPark, jauh lebih luas). Origin dunia dijadikan satu konstanta (`WORLD_ORIGIN`) untuk klien dan citybake.

**Files:**
- Modify: `src/config/constants.js` (sisip `WORLD_ORIGIN` sebelum `// Layer render …`)
- Modify: `tools/citybake/config.js:5-6` (impor), `:13-17` (`ORIGIN`)
- Create: `src/geo/placement.js`, `src/regions/stadion/footprint.js`
- Modify: `src/regions/stadion/placement.js` (seluruh berkas)
- Test: `tests/geo/placement.test.js`, `tests/stadionPlacement.test.js` (baru); `tests/region.test.js` (placement & lampu), `tests/compositeCollider.test.js:42-55` (paritas)
- Bake: `public/tiles/` (diharapkan tanpa perubahan)

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/geo/placement.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { placementFromFootprint, areaMoments } from '../../src/geo/placement.js';
import { toWorld } from '../../src/geo/regionTransform.js';

/** Persegi panjang 100 (lokal X) × 300 (lokal Z) di placement p, dalam koordinat dunia. */
const rect = (p) => [[-50, -150], [50, -150], [50, 150], [-50, 150]].map(([x, z]) => {
  const w = toWorld(p, x, z);
  return [w.x, w.z];
});

describe('placementFromFootprint', () => {
  it.each([0, 0.3, -0.7, 1.2])('memulihkan placement persegi panjang (yaw %f)', (yaw) => {
    const p = { x: 120, z: -40, yaw };
    const got = placementFromFootprint(rect(p));
    expect(got.x).toBeCloseTo(120, 9);
    expect(got.z).toBeCloseTo(-40, 9);
    expect(got.yaw).toBeCloseTo(yaw, 9);
  });

  it('sumbu tak berarah: footprint diputar π memberi yaw yang sama', () => {
    expect(placementFromFootprint(rect({ x: 0, z: 0, yaw: 0.4 + Math.PI })).yaw).toBeCloseTo(0.4, 9);
  });

  it('orientasi ring (CW/CCW) tidak berpengaruh; momen luas persegi panjang benar', () => {
    const r = rect({ x: 0, z: 0, yaw: 0 });
    expect(placementFromFootprint([...r].reverse()).yaw).toBeCloseTo(0, 9);
    const m = areaMoments(r);
    expect(m.area).toBeCloseTo(30000, 6);
    expect(m.sxx).toBeCloseTo((300 * 100 ** 3) / 12, 3);
    expect(m.szz).toBeCloseTo((100 * 300 ** 3) / 12, 3);
  });

  it('ring tak valid ditolak', () => {
    expect(() => placementFromFootprint([[0, 0], [1, 1]])).toThrow(RangeError);
    expect(() => placementFromFootprint([[0, 0], [1, 0], [2, 0]])).toThrow(RangeError);
  });
});
```
dan `tests/stadionPlacement.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { STADION_PLACEMENT, STADION_FOOTPRINT } from '../src/regions/stadion/placement.js';
import { STADION_FOOTPRINT_LATLON } from '../src/regions/stadion/footprint.js';
import { WORLD_ORIGIN } from '../src/config/constants.js';
import { ORIGIN } from '../tools/citybake/config.js';
import { polygonArea } from '../src/geo/polygon.js';
import { stadionRegion } from '../src/regions/stadion/index.js';

describe('placement stadion dari footprint OSM (Fase 3)', () => {
  it('origin dunia satu sumber: config klien = citybake = manifest', () => {
    const m = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
    expect(ORIGIN).toBe(WORLD_ORIGIN);
    expect(m.origin).toEqual({ lat: WORLD_ORIGIN.lat, lon: WORLD_ORIGIN.lon });
  });

  it('footprint 52 titik, luas ±52.900 m², ukuran ±222 × 296 m', () => {
    expect(STADION_FOOTPRINT_LATLON).toHaveLength(52);
    expect(polygonArea(STADION_FOOTPRINT)).toBeGreaterThan(52500);
    expect(polygonArea(STADION_FOOTPRINT)).toBeLessThan(53300);
    const xs = STADION_FOOTPRINT.map((p) => p[0]);
    const zs = STADION_FOOTPRINT.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(222, -1);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(296, -1);
  });

  it('placement ≈ identitas (origin = centroid yang sama; sumbu panjang ≈ utara–selatan)', () => {
    expect(Math.abs(STADION_PLACEMENT.x)).toBeLessThan(0.05);
    expect(Math.abs(STADION_PLACEMENT.z)).toBeLessThan(0.05);
    expect(Math.abs(STADION_PLACEMENT.yaw)).toBeLessThan(1e-3);
    expect(stadionRegion.placement).toEqual(STADION_PLACEMENT);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/geo/placement.test.js tests/stadionPlacement.test.js
```
Expected: FAIL — `src/geo/placement.js`, `footprint.js` tidak ada; `WORLD_ORIGIN` bukan ekspor.

- [ ] **Step 3: Origin satu sumber.** Di `src/config/constants.js` sisipkan sebelum `// Layer render (THREE.Layers): 0 = kamera utama, 1 = objek besar yang ikut tampil di minimap`:
```js
/**
 * Origin frame dunia ENU (+X timur, −Z utara): centroid luas poligon OSM way 327365495
 * "Stadion Utama Riau", Overpass 2026-10-16. Sumber tunggal klien & citybake (manifest.origin).
 */
export const WORLD_ORIGIN = Object.freeze({ lat: 0.4835954, lon: 101.3895277 });

```
Di `tools/citybake/config.js` tambahkan impor setelah `import { tileBounds, tilesInRect, TILE_SIZE } from '../../src/geo/tiles.js';`:
```js
import { WORLD_ORIGIN } from '../../src/config/constants.js';
```
dan ganti:
```js
/**
 * Origin frame dunia = centroid luas poligon OSM way 327365495 "Stadion Utama Riau"
 * (leisure=stadium, 53 titik), dihitung dari `out geom` Overpass 2026-10-16.
 */
export const ORIGIN = Object.freeze({ lat: 0.4835954, lon: 101.3895277 });
```
menjadi:
```js
/**
 * Origin frame dunia = centroid luas poligon OSM way 327365495 "Stadion Utama Riau"
 * (leisure=stadium, 53 titik), dihitung dari `out geom` Overpass 2026-10-16. Sumber: src/config/constants.js.
 */
export const ORIGIN = WORLD_ORIGIN;
```

- [ ] **Step 4: Placement dari footprint.** Buat `src/geo/placement.js`:
```js
/**
 * Placement region dari footprint OSM (Plan C, Fase 3): posisi = centroid luas poligon, yaw = arah
 * sumbu panjang (momen inersia luas kedua) dipetakan ke sumbu +Z lokal region. Murni.
 */
import { cleanRing, orientRing, signedArea } from './polygon.js';

/**
 * Centroid & momen luas kedua (terhadap centroid) ring [[x, z], ...]; ring dipositifkan dulu.
 * @returns {{area:number, cx:number, cz:number, sxx:number, szz:number, sxz:number}}
 */
export function areaMoments(ring) {
  const r = orientRing(cleanRing(ring), true);
  const n = r.length;
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < n; i += 1) {
    const [x0, z0] = r[i];
    const [x1, z1] = r[(i + 1) % n];
    const c = x0 * z1 - x1 * z0;
    a += c;
    cx += (x0 + x1) * c;
    cz += (z0 + z1) * c;
  }
  a /= 2;
  cx /= 6 * a;
  cz /= 6 * a;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (let i = 0; i < n; i += 1) {
    const x0 = r[i][0] - cx;
    const z0 = r[i][1] - cz;
    const x1 = r[(i + 1) % n][0] - cx;
    const z1 = r[(i + 1) % n][1] - cz;
    const c = x0 * z1 - x1 * z0;
    sxx += (x0 * x0 + x0 * x1 + x1 * x1) * c;
    szz += (z0 * z0 + z0 * z1 + z1 * z1) * c;
    sxz += (x0 * z1 + 2 * x0 * z0 + 2 * x1 * z1 + x1 * z0) * c;
  }
  return { area: a, cx, cz, sxx: sxx / 12, szz: szz / 12, sxz: sxz / 24 };
}

/**
 * Placement {x, z, yaw} agar sumbu +Z lokal region sejajar sumbu panjang footprint. yaw ∈ (−π/2, π/2]
 * (sumbu tak berarah). Konvensi toWorld: lokal +Z → dunia (sin yaw, cos yaw).
 * @param {Array<[number, number]>} ring footprint dalam koordinat dunia
 */
export function placementFromFootprint(ring) {
  if (!Array.isArray(ring) || ring.length < 3 || Math.abs(signedArea(ring)) < 1e-6) {
    throw new RangeError('placementFromFootprint: ring minimal 3 titik dengan luas > 0');
  }
  const m = areaMoments(ring);
  const ang = 0.5 * Math.atan2(2 * m.sxz, m.sxx - m.szz); // arah variansi terbesar dari +X
  let dx = Math.cos(ang);
  let dz = Math.sin(ang);
  if (dz < 0 || (dz === 0 && dx < 0)) {
    dx = -dx;
    dz = -dz;
  }
  return { x: m.cx, z: m.cz, yaw: Math.atan2(dx, dz) };
}
```
Buat `src/regions/stadion/footprint.js` (koordinat persis dari cache `data-src/osm/stadion.json`, way 327365495, tanpa titik penutup):
```js
/**
 * Footprint stadion dari OpenStreetMap: way 327365495 "Stadion Utama Riau" (leisure=stadium), 52 titik
 * [lat, lon] (ring terbuka), diambil dari Overpass 2026-10-16T08:53:21Z. Dipakai untuk placement region
 * (centroid + sumbu panjang). Data © OpenStreetMap contributors, lisensi ODbL 1.0 (lihat public/tiles/ATTRIBUTION.txt).
 */
export const STADION_FOOTPRINT_LATLON = Object.freeze([
  [0.4842051, 101.3886151], [0.4843232, 101.3886511], [0.4844356, 101.3887021], [0.4845404, 101.3887674],
  [0.4846358, 101.3888458], [0.4847201, 101.3889359], [0.4847919, 101.3890363], [0.4848501, 101.3891453],
  [0.4848935, 101.3892608], [0.4849214, 101.3893811], [0.4849334, 101.3895040], [0.4849293, 101.3896273],
  [0.4849091, 101.3897491], [0.4848732, 101.3898673], [0.4848222, 101.3899797], [0.4847569, 101.3900845],
  [0.4846785, 101.3901799], [0.4845883, 101.3902642], [0.4844879, 101.3903360], [0.4843790, 101.3903941],
  [0.4842634, 101.3904376], [0.4841432, 101.3904655], [0.4832318, 101.3904775], [0.4831084, 101.3904734],
  [0.4829866, 101.3904532], [0.4828685, 101.3904173], [0.4827561, 101.3903662], [0.4826513, 101.3903010],
  [0.4825559, 101.3902226], [0.4824716, 101.3901324], [0.4823997, 101.3900320], [0.4823416, 101.3899231],
  [0.4822982, 101.3898075], [0.4822703, 101.3896872], [0.4822583, 101.3895644], [0.4822624, 101.3894410],
  [0.4822826, 101.3893192], [0.4823185, 101.3892011], [0.4823695, 101.3890887], [0.4824348, 101.3889839],
  [0.4825132, 101.3888885], [0.4826033, 101.3888041], [0.4827038, 101.3887323], [0.4828127, 101.3886742],
  [0.4829282, 101.3886308], [0.4830485, 101.3886028], [0.4831714, 101.3885908], [0.4834530, 101.3885921],
  [0.4834533, 101.3884874], [0.4836880, 101.3884882], [0.4836876, 101.3885932], [0.4840833, 101.3885949],
].map((p) => Object.freeze(p)));
```
Ganti seluruh isi `src/regions/stadion/placement.js`:
```js
/**
 * Placement region stadion di frame dunia ENU (sumber tunggal klien dan citybake; murni), dihitung
 * dari footprint OSM (centroid luas + sumbu panjang, geo/placement.js). Origin dunia = centroid
 * poligon yang sama, jadi hasilnya ≈ identitas (geser < 2 cm, yaw < 0,01°).
 */
import { WORLD_ORIGIN } from '../../config/constants.js';
import { createProjection } from '../../geo/projection.js';
import { placementFromFootprint } from '../../geo/placement.js';
import { STADION_FOOTPRINT_LATLON } from './footprint.js';

const projection = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });

/** Footprint OSM stadion dalam koordinat DUNIA [[x, z], ...]. */
export const STADION_FOOTPRINT = Object.freeze(STADION_FOOTPRINT_LATLON.map(([lat, lon]) => {
  const w = projection.toWorld(lat, lon);
  return Object.freeze([w.x, w.z]);
}));

export const STADION_PLACEMENT = Object.freeze(placementFromFootprint(STADION_FOOTPRINT));
```

- [ ] **Step 5: Sesuaikan tes yang mengasumsikan identitas.**

`tests/region.test.js`: tambahkan impor `import { STADION_PLACEMENT } from '../src/regions/stadion/placement.js';`, ubah impor lampu menjadi `import { litLampPositions, stadionNightLights } from '../src/regions/stadion/lamps.js';`; ganti `    expect(stadionRegion.placement).toEqual({ x: 0, z: 0, yaw: 0 });` menjadi `    expect(stadionRegion.placement).toEqual(STADION_PLACEMENT);`; ganti `    expect(built.nightLights.lamps).toEqual(litLampPositions(LAYOUT));` menjadi:
```js
    expect(built.nightLights).toEqual(stadionNightLights(LAYOUT, STADION_PLACEMENT)); // dunia (placement OSM)
    expect(built.nightLights.lamps).toHaveLength(litLampPositions(LAYOUT).length);
```
`tests/compositeCollider.test.js:42-55` — ganti tes `paritas: komposit stadion (placement identitas) = collider region di seluruh grid dunia` dengan:
```js
  it('paritas: komposit stadion = collider region pada koordinat lokal (placement OSM) di seluruh grid', () => {
    const comp = createCompositeCollider({
      regions: [{ region: stadionRegion, colliders: stadionColliders }],
      fallback: localized(stadionRegion, stadionColliders),
    });
    const loc = localized(stadionRegion, stadionColliders);
    const mismatch = [];
    for (let x = -700; x <= 700; x += 23) {
      for (let z = -700; z <= 700; z += 23) {
        if (comp.isWalkable(x, z) !== loc.isWalkable(x, z)) mismatch.push(['walk', x, z]);
        if (comp.isCameraClear(x, z) !== loc.isCameraClear(x, z)) mismatch.push(['cam', x, z]);
      }
    }
    expect(mismatch).toEqual([]);
  });
```

- [ ] **Step 6: Tes → LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/geo/placement.test.js tests/stadionPlacement.test.js tests/region.test.js tests/compositeCollider.test.js tests/citybake/config.test.js tests/placement.test.js
```

- [ ] **Step 7: Bake ulang (mask dunia bergeser ±1 cm)**

```bash
node tools/citybake --area stadion --offline
```
```bash
git status --short public/tiles
```
Expected (saat rencana disusun): kosong — pergeseran 1 cm tidak mengubah keputusan mask maupun kuantisasi 0,1 m. Bila ada perubahan: pastikan tanpa `PERINGATAN:` lalu ikutkan `public/tiles` dalam commit.

- [ ] **Step 8: Suite + lint + build + paritas**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
Paritas: sama dengan Task 17 (± derau), 0 galat.

- [ ] **Step 9: Commit**

```bash
git add src/config/constants.js tools/citybake/config.js src/geo/placement.js src/regions/stadion/footprint.js src/regions/stadion/placement.js tests/geo/placement.test.js tests/stadionPlacement.test.js tests/region.test.js tests/compositeCollider.test.js && git commit -m "feat: placement stadion dari footprint OSM (centroid luas + sumbu panjang), origin dunia satu sumber"
```

---

## Task 19: Fase 3 — tanah per tile + tanah region di dalam mask

Spec Fase 3 butir 3: tanah persegi 1.400 m (`src/world/Ground.js:19-34`, `createGroundWithHole`) diganti tanah region berbentuk mask; di luar mask tampil landuse tile + tanah dasar kota (Task 16). Vegetasi (pohon besar/muda, semak, ilalang) dan bilah rumput dibatasi ke mask (vegetasi dari landuse = backlog spec §7). Peta dasar minimap region di-bake dengan latar transparan dan area secukupnya (mask + 20 m), sehingga layer tile terlihat di luar mask.

**Files:**
- Modify: `src/world/Ground.js:15-34` (`createGroundWithHole`), `:36-43` (`createGrassPlane`), `createGround`
- Modify: `src/world/index.js` (impor `pointInPolygon`, opsi `mask`, `keep`)
- Modify: `src/world/Landscape.js` (opsi `keep`), `src/world/Landscape.trees.js` (parameter `keep` di 4 pembuat vegetasi), `src/world/Grass.js:115`, `:127`, `:155`, `:185`, `:202-221`
- Modify: `src/regions/stadion/index.js` (`buildWorld({…, mask: STADION_MASK})`), `src/regions/Region.js` (`maskHalfExtent`)
- Modify: `src/core/App.js:23`, `:281-284` (doc), `:311` (latar transparan)
- Modify: `src/main.js` (`bakeHalf`, impor, hapus impor `SITE`)
- Test: `tests/regionGround.test.js`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/regionGround.test.js`:
```js
/**
 * Fase 3: tanah region = mask (bukan persegi 1.400 m); vegetasi & rumput hanya di dalam mask.
 * Di luar mask tanah datang dari tile kota.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createGround } from '../src/world/Ground.js';
import { createGrass } from '../src/world/Grass.js';
import { createBigTrees, createShrubs } from '../src/world/Landscape.trees.js';
import { STADION_MASK } from '../src/regions/stadion/mask.js';
import { pointInPolygon, ringBounds } from '../src/geo/polygon.js';
import { createResourceScope, withScope } from '../src/engine/ResourceScope.js';

const inMask = (x, z) => pointInPolygon(x, z, STADION_MASK);
const scoped = (fn) => withScope(createResourceScope('uji'), fn);

/** Posisi dunia semua instans di bawah root. */
function instancePositions(root) {
  const out = [];
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isInstancedMesh) return;
    for (let i = 0; i < o.count; i += 1) {
      o.getMatrixAt(i, m);
      p.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);
      out.push([p.x, p.z]);
    }
  });
  return out;
}

describe('tanah region berbentuk mask', () => {
  it('bidang rumput mengikuti bbox mask (tidak lagi ±700 m)', () => {
    const ground = scoped(() => createGround({ outline: STADION_MASK }));
    const grass = ground.getObjectByName('rumput');
    grass.geometry.computeBoundingBox();
    const b = grass.geometry.boundingBox;
    const m = ringBounds(STADION_MASK);
    expect(b.min.x).toBeCloseTo(m.minX, 3);
    expect(b.max.x).toBeCloseTo(m.maxX, 3);
    expect(b.min.z).toBeCloseTo(m.minZ, 3);
    expect(b.max.z).toBeCloseTo(m.maxZ, 3);
  });

  it('tanpa outline: persegi lama (kompatibel)', () => {
    const ground = scoped(() => createGround());
    const grass = ground.getObjectByName('rumput');
    grass.geometry.computeBoundingBox();
    expect(grass.geometry.boundingBox.max.x).toBeCloseTo(700, 3);
  });
});

describe('vegetasi & rumput hanya di dalam mask', () => {
  it('pohon besar dan semak dengan keep = mask: semua instans di dalam mask', () => {
    for (const make of [() => createBigTrees(11, inMask), () => createShrubs(31, inMask)]) {
      const pts = instancePositions(scoped(make));
      expect(pts.length).toBeGreaterThan(0);
      expect(pts.filter(([x, z]) => !inMask(x, z))).toEqual([]);
    }
  });

  it('bilah rumput: keep = false → semua skala nol; keep = true → ada bilah', () => {
    const scaleSum = (group) => {
      const mesh = group.children[0];
      const m = new THREE.Matrix4();
      const s = new THREE.Vector3();
      let sum = 0;
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, m);
        sum += s.setFromMatrixScale(m).x;
      }
      return sum;
    };
    const none = scoped(() => createGrass({ count: 6000, keep: () => false }));
    none.userData.update(0.016, 0, new THREE.Vector3(0, 0, -250));
    expect(scaleSum(none)).toBe(0);
    const some = scoped(() => createGrass({ count: 6000 }));
    some.userData.update(0.016, 0, new THREE.Vector3(0, 0, -250));
    expect(scaleSum(some)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/regionGround.test.js
```
Expected: FAIL — bbox rumput masih ±700 m; instans pohon di luar mask; `createGrass({keep})` diabaikan.

- [ ] **Step 3: Tanah berbentuk mask.** Di `src/world/Ground.js` ganti:
```js
/**
 * Bidang tanah persegi dengan lubang elips di bawah stadion agar tidak berimpit
 * (z-fighting) dengan apron, lintasan, dan lapangan. UV ShapeGeometry = meter.
 */
function createGroundWithHole() {
  const half = SITE.groundSize / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half, -half);
  shape.lineTo(half, -half);
  shape.lineTo(half, half);
  shape.lineTo(-half, half);
  shape.closePath();
```
menjadi:
```js
/** Persegi tanah lama ±groundSize/2 (dipakai bila region tidak memberi outline). */
const squareOutline = (half) => [[-half, -half], [half, -half], [half, half], [-half, half]];

/**
 * Bidang tanah berbentuk `outline` (mask region, [[x, z], ...]) dengan lubang elips di bawah stadion
 * agar tidak berimpit (z-fighting) dengan apron, lintasan, dan lapangan. Di luar outline: tanah
 * tile kota (Plan C Fase 3). Titik Shape (x, −z) karena rotateX(−π/2) memetakan y → −z. UV = meter.
 */
function createGroundWithHole(outline) {
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
```
ganti:
```js
/** Tanah rumput besar (UV dalam meter agar tekstur rumput berulang tiap 4 m). */
function createGrassPlane() {
  const m = groundMaterials();
  const mesh = new THREE.Mesh(createGroundWithHole(), m.grass);
```
menjadi:
```js
/** Tanah rumput region (UV dalam meter agar tekstur rumput berulang tiap 4 m). */
function createGrassPlane(outline) {
  const m = groundMaterials();
  const mesh = new THREE.Mesh(createGroundWithHole(outline), m.grass);
```
dan ganti awal `createGround`:
```js
/** Group lengkap tanah & infrastruktur datar kawasan. */
export function createGround(opts = {}) {
  const g = new THREE.Group();
  g.name = 'ground';
  g.add(createGrassPlane());
```
menjadi:
```js
/**
 * Group lengkap tanah & infrastruktur datar kawasan.
 * @param {{outline?: Array<[number, number]>|null, name?: string}} [opts] outline = mask region (default persegi lama)
 */
export function createGround(opts = {}) {
  const g = new THREE.Group();
  g.name = 'ground';
  g.add(createGrassPlane(opts.outline ?? squareOutline(SITE.groundSize / 2)));
```

- [ ] **Step 4: Vegetasi & rumput hanya di dalam mask.**

`src/world/index.js` — tambahkan impor `import { pointInPolygon } from '../geo/polygon.js';` setelah `import * as THREE from 'three';`; ganti dua baris terakhir JSDoc `buildWorld`:
```js
 * di peta kecil. `layout` WAJIB dari region (regions/stadion/layout.js); `site` default = SITE.
 * @param {{layout: object, site?: object}} opts
```
menjadi:
```js
 * di peta kecil. `layout` WAJIB dari region (regions/stadion/layout.js); `site` default = SITE.
 * `mask` (region-lokal): tanah berbentuk mask dan vegetasi/rumput hanya di dalam mask (di luar = kota).
 * @param {{layout: object, site?: object, mask?: Array<[number, number]>|null}} opts
```
ganti:
```js
export function buildWorld({ layout, site = SITE } = {}) {
  if (!layout) throw new TypeError('buildWorld: layout wajib (diberikan region)');
```
menjadi:
```js
export function buildWorld({ layout, site = SITE, mask = null } = {}) {
  if (!layout) throw new TypeError('buildWorld: layout wajib (diberikan region)');
  const keep = mask ? (x, z) => pointInPolygon(x, z, mask) : () => true;
```
`  const ground = createGround();` → `  const ground = createGround({ outline: mask });`; `  add(createLandscape());` dan `  add(createGrass(), { merge: false });` → `  add(createLandscape({ keep }));` dan `  add(createGrass({ keep }), { merge: false });`.

Ganti seluruh fungsi `createLandscape` di `src/world/Landscape.js`:
```js
/**
 * Lanskap kawasan: vegetasi (pohon besar, pohon muda, semak, ilalang). Danau, sungai + jembatan,
 * jalan setapak helipad, dan venue baseball fiktif dihapus Plan C (I4); versi OSM ada di tile kota.
 * @param {{seed?: number, keep?: (x:number, z:number) => boolean}} [opts] keep: titik boleh bervegetasi (mask region)
 */
export function createLandscape(opts = {}) {
  const g = new THREE.Group();
  g.name = 'landscape';
  const seed = opts.seed ?? 11;
  const keep = opts.keep ?? (() => true);
  g.add(createBigTrees(seed, keep));
  g.add(createYoungTrees(seed + 12, keep));
  g.add(createShrubs(seed + 20, keep));
  g.add(createWildGrass(seed + 30, undefined, keep));
  return g;
}
```
`src/world/Landscape.trees.js` (state sesudah Task 9) — tambahkan `const ALL = () => true;` sebelum `/** Posisi acak bebas untuk pohon besar. */`, lalu:
- `function randomTreeSpots(rnd, count) {` → `function randomTreeSpots(rnd, count, keep) {`; `if (isFreeForBigTree(x, z)) spots.push(` → `if (isFreeForBigTree(x, z) && keep(x, z)) spots.push(`;
- `function roadsideTreeSpots(rnd) {` → `function roadsideTreeSpots(rnd, keep) {`; `.filter((p) => isFreeForBigTree(p.x, p.z))` → `.filter((p) => isFreeForBigTree(p.x, p.z) && keep(p.x, p.z))`;
- `export function createBigTrees(seed = 11) {` → `export function createBigTrees(seed = 11, keep = ALL) {`; `const road = roadsideTreeSpots(rnd);` → `const road = roadsideTreeSpots(rnd, keep);`; `randomTreeSpots(rnd, TREE_COUNT_RANDOM)` → `randomTreeSpots(rnd, TREE_COUNT_RANDOM, keep)`;
- `function youngTreeSpots(rnd) {` → `function youngTreeSpots(rnd, keep) {`; `if (isFreeInPlazaBelt(x, z)) spots.push(` → `if (isFreeInPlazaBelt(x, z) && keep(x, z)) spots.push(`; `export function createYoungTrees(seed = 23) {` → `export function createYoungTrees(seed = 23, keep = ALL) {`; `const spots = youngTreeSpots(rnd);` → `const spots = youngTreeSpots(rnd, keep);`;
- `export function createShrubs(seed = 31) {` → `export function createShrubs(seed = 31, keep = ALL) {`; `const ok = isFreeForBigTree(x, z) || isFreeInPlazaBelt(x, z);` → `const ok = (isFreeForBigTree(x, z) || isFreeInPlazaBelt(x, z)) && keep(x, z);`;
- `export function createWildGrass(seed = 41, centers = defaultGrassCenters()) {` → `export function createWildGrass(seed = 41, centers = defaultGrassCenters(), keep = ALL) {`; `if (!isFreeForBigTree(x, z) && !c.force) continue;` → `if ((!isFreeForBigTree(x, z) && !c.force) || !keep(x, z)) continue;`.

`src/world/Grass.js` — `:115` `function fillCell(buffers, block, ix, iz) {` → `function fillCell(buffers, block, ix, iz, keep) {`; `:127` `isGrassSpot(x, z) ? _one : _zero` → `isGrassSpot(x, z) && keep(x, z) ? _one : _zero`; `:155` `function createCellPool(buffers, maxCells) {` → `function createCellPool(buffers, maxCells, keep) {`; `:185` `fillCell(buffers, b, ix, iz);` → `fillCell(buffers, b, ix, iz, keep);`; ganti JSDoc + signature `:202-206`:
```js
 * @param {{count?: number}} opts jumlah bilah dalam pool
 * @returns {THREE.Group} berisi InstancedMesh; userData.update(dt, t, focus)
 */
export function createGrass({ count = GRASS.count } = {}) {
```
menjadi:
```js
 * @param {{count?: number, keep?: (x:number, z:number) => boolean}} opts jumlah bilah dalam pool;
 *   keep = titik boleh berumput (mask region; di luar mask = tanah kota)
 * @returns {THREE.Group} berisi InstancedMesh; userData.update(dt, t, focus)
 */
export function createGrass({ count = GRASS.count, keep = () => true } = {}) {
```
dan `:221` `createCellPool({ matrix: mesh.instanceMatrix, scale, tint }, maxCells)` → `createCellPool({ matrix: mesh.instanceMatrix, scale, tint }, maxCells, keep)`.

`src/regions/stadion/index.js` — `buildWorld({ layout: LAYOUT, site: SITE })` → `buildWorld({ layout: LAYOUT, site: SITE, mask: STADION_MASK })`.

- [ ] **Step 5: Peta dasar minimap region transparan & seluas mask.** `src/regions/Region.js` — sisipkan sebelum `/** Salinan definisi region dengan placement lain …`:
```js
/** Setengah sisi persegi berpusat placement yang memuat seluruh mask (m), mis. untuk bake minimap. */
export function maskHalfExtent(mask) {
  return Math.max(...mask.map(([x, z]) => Math.max(Math.abs(x), Math.abs(z))));
}

```
`src/core/App.js` — hapus `:23` (`const MINIMAP_BG = 0x2f5b32;`); ganti doc `:282-284`:
```js
   * Bake peta dasar minimap SEKALI: tampak atas seluruh dunia dari kamera ortografis, hanya objek
   * di RENDER_LAYERS.minimap, diterangi ambient merata (tanpa IBL, kabut, matahari) lalu disalin
   * ke canvas 2D. Dipakai oleh ui/Minimap2D; tidak ada render 3D minimap per frame.
```
menjadi:
```js
   * Bake peta dasar minimap SEKALI: tampak atas area region dari kamera ortografis, hanya objek
   * di RENDER_LAYERS.minimap, diterangi ambient merata (tanpa IBL, kabut, matahari) lalu disalin
   * ke canvas 2D. Latar TRANSPARAN: di luar tanah region (mask) layer tile kota di bawahnya tampak.
   * Dipakai oleh ui/Minimap2D; tidak ada render 3D minimap per frame.
```
dan `r.setClearColor(MINIMAP_BG, 1);` → `r.setClearColor(0x000000, 0);`.
`src/main.js` — hapus `import { SITE } from './config/constants.js';`; `import { withPlacement } from './regions/Region.js';` → `import { withPlacement, maskHalfExtent } from './regions/Region.js';`; setelah `const MODELS_TIMEOUT_MS = 8000;` tambahkan `const MINIMAP_BAKE_MARGIN = 20; // m di luar mask pada peta dasar region`; ganti
```js
    minimap.setBase(app.bakeMinimap(SITE.groundSize / 2, frame.placement), SITE.groundSize / 2, frame.placement);
```
menjadi:
```js
    const bakeHalf = Math.ceil(maskHalfExtent(stadionDef.mask)) + MINIMAP_BAKE_MARGIN; // area tanah region saja
    minimap.setBase(app.bakeMinimap(bakeHalf, frame.placement), bakeHalf, frame.placement);
```

- [ ] **Step 6: Tes → LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/regionGround.test.js tests/grassPlacement.test.js tests/region.test.js tests/propsScope.test.js tests/stadionContent.test.js
```

- [ ] **Step 7: Suite + lint + build + cek visual**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
Cek visual (dev, kamera udara/atas): tanah rumput region berakhir di tepi mask (hull + koridor utara ke gapura); di luar tampak landuse/jalan/air/bangunan tile; dua danau OSM mengapit koridor; Jl. Naga Sakti dua jalur di ujung koridor; minimap menampilkan tile (air biru, jalan) di luar mask. 0 galat konsol.

- [ ] **Step 8: Commit**

```bash
git add src/world/Ground.js src/world/index.js src/world/Landscape.js src/world/Landscape.trees.js src/world/Grass.js src/regions/stadion/index.js src/regions/Region.js src/core/App.js src/main.js tests/regionGround.test.js && git commit -m "feat: tanah region berbentuk mask (di luar = tanah tile kota), vegetasi & rumput dibatasi mask, minimap region transparan"
```

---

## Task 20: Fase 3 — perjalanan cepat (Stadion ↔ Masjid Raya An-Nur)

Spec Fase 3 butir 4: daftar titik di menu (tombol HUD "Perjalanan cepat (G)" + tombol G); teleport menampilkan layar perjalanan, memindahkan sepeda (fokus streamer ikut pindah), menunggu streamer selesai memuat tile dalam 600 m (LOD0), lalu menaruh sepeda di titik walkable terdekat (titik pusat area An-Nur bisa jatuh di footprint masjid) sebelum layar ditutup. Tujuan An-Nur dari manifest (pusat area `pusat`, = node OSM 13792599822; saat rencana disusun (6826,7; −4754,5), ±8,3 km). Tanpa kota (manifest gagal): hanya Stadion.

**Files:**
- Create: `src/app/fastTravel.js`, `src/ui/FastTravelMenu.js`
- Modify: `src/main.js` (impor, `setupFastTravel`, input beku saat perjalanan, devtools), `src/app/keymap.js` (`KeyG`), `src/app/devtools.js` (`fastTravel`), `src/ui/hud.css`, `index.html:36`
- Test: `tests/fastTravel.test.js`, `tests/fastTravelMenu.test.js`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/fastTravel.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { travelDestinations, findWalkableNear, createFastTravel } from '../src/app/fastTravel.js';
import { createRegionFrame, IDENTITY_FRAME } from '../src/geo/regionTransform.js';
import { LAYOUT } from '../src/regions/stadion/layout.js';

const manifest = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));

describe('tujuan perjalanan cepat', () => {
  it('Stadion = spawn region (dunia); An-Nur = pusat area "pusat" manifest (±8,3 km timur laut)', () => {
    const frame = createRegionFrame({ x: 10, z: 0, yaw: 0 });
    const [stadion, annur] = travelDestinations({ manifest, frame, spawn: LAYOUT.spawn });
    expect(stadion).toMatchObject({ id: 'stadion', x: 10 + LAYOUT.spawn.x, z: LAYOUT.spawn.z });
    expect(annur.id).toBe('annur');
    expect(Math.hypot(annur.x, annur.z)).toBeGreaterThan(8000);
    expect(Math.hypot(annur.x, annur.z)).toBeLessThan(8600);
    expect(annur.x).toBeGreaterThan(0);
    expect(annur.z).toBeLessThan(0); // −Z = utara
  });

  it('tanpa manifest (mode hanya-region): hanya Stadion', () => {
    expect(travelDestinations({ manifest: null, frame: IDENTITY_FRAME, spawn: LAYOUT.spawn }).map((d) => d.id)).toEqual(['stadion']);
  });
});

describe('findWalkableNear', () => {
  it('pusat walkable → pusat; terhalang → titik walkable terdekat pada cincin', () => {
    expect(findWalkableNear(1, 2, () => true)).toEqual({ x: 1, z: 2 });
    const p = findWalkableNear(0, 0, (x, z) => Math.hypot(x, z) > 10);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(10);
    expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(12.0001);
    expect(findWalkableNear(0, 0, () => false, { maxRadius: 8 })).toBeNull();
  });
});

describe('createFastTravel', () => {
  const setup = (settled = true) => {
    const log = [];
    const bike = { state: { x: 0, z: 0, yaw: 0, v: 5 }, setCollider: () => log.push('collider') };
    const screen = { show: (t) => log.push(`show:${t}`), hide: () => log.push('hide') };
    const city = { whenSettled: (x, z, r) => { log.push(`tunggu:${Math.round(x)},${Math.round(z)},${r}`); return Promise.resolve(settled); } };
    const colliders = { isWalkable: (x) => x > 6805 || x < 6000 }; // titik tujuan pas di bangunan
    const destinations = [{ id: 'annur', label: 'Masjid Raya An-Nur', x: 6800, z: -4750, yaw: 0 }];
    return { log, bike, ft: createFastTravel({ destinations, bike, colliders, city, screen }) };
  };

  it('tampilkan layar → pindah sepeda → tunggu tile (600 m) → muncul di titik walkable → tutup layar', async () => {
    const { log, bike, ft } = setup();
    const p = ft.go('annur');
    expect(ft.busy).toBe(true);
    expect(await p).toBe(true);
    expect(log).toEqual(['show:Menuju Masjid Raya An-Nur…', 'collider', 'tunggu:6800,-4750,600', 'collider', 'hide']);
    expect(bike.state.x).toBeGreaterThan(6805);
    expect(bike.state.v).toBe(0);
    expect(ft.busy).toBe(false);
  });

  it('tujuan tak dikenal / sedang berjalan → false; timeout streamer tetap menutup layar', async () => {
    const { log, ft } = setup(false);
    expect(await ft.go('tidak-ada')).toBe(false);
    const a = ft.go('annur');
    expect(await ft.go('annur')).toBe(false);
    expect(await a).toBe(false);
    expect(log.at(-1)).toBe('hide');
  });
});
```
dan `tests/fastTravelMenu.test.js`:
```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { FastTravelMenu, createTravelScreen } from '../src/ui/FastTravelMenu.js';

describe('FastTravelMenu', () => {
  beforeEach(() => { document.body.replaceChildren(); });

  it('tombol HUD membuka panel; memilih tujuan menutup panel dan memanggil onTravel(id)', () => {
    const seen = [];
    const menu = new FastTravelMenu(document.body, {
      destinations: [{ id: 'stadion', label: 'Stadion Utama Riau' }, { id: 'annur', label: 'Masjid Raya An-Nur' }],
      onTravel: (id) => seen.push(id),
    });
    expect(menu.open).toBe(false);
    document.getElementById('hud-travel').click();
    expect(menu.open).toBe(true);
    document.querySelector('#fast-travel button[data-id="annur"]').click();
    expect(seen).toEqual(['annur']);
    expect(menu.open).toBe(false);
    menu.toggle();
    document.querySelector('#fast-travel .travel-close').click();
    expect(menu.open).toBe(false);
    menu.dispose();
    expect(document.getElementById('fast-travel')).toBeNull();
    expect(document.getElementById('hud-travel')).toBeNull();
  });

  it('layar perjalanan: show/hide teks status', () => {
    const s = createTravelScreen(document.body);
    s.show('Menuju Masjid Raya An-Nur…');
    expect(s.visible).toBe(true);
    expect(document.querySelector('#travel-screen .travel-label').textContent).toBe('Menuju Masjid Raya An-Nur…');
    s.hide();
    expect(s.visible).toBe(false);
    s.dispose();
    expect(document.getElementById('travel-screen')).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/fastTravel.test.js tests/fastTravelMenu.test.js
```
Expected: FAIL — modul `src/app/fastTravel.js` dan `src/ui/FastTravelMenu.js` tidak ada.

- [ ] **Step 3: Implementasi** — buat `src/app/fastTravel.js`:
```js
/**
 * Perjalanan cepat (Fase 3): daftar tujuan (Stadion, Masjid Raya An-Nur) dan teleport yang
 * menunggu streamer kota memuat tile tujuan sebelum layar perjalanan ditutup.
 */
import { createCollider } from '../core/Collider.js';
import { STREAM } from '../city/ChunkStreamer.js';

/** Area manifest untuk An-Nur (tools/citybake/config.js AREAS.pusat; pusat area = node OSM masjid). */
export const ANNUR_AREA_ID = 'pusat';

/**
 * Tujuan perjalanan cepat (frame dunia). An-Nur hanya bila manifest memuat area "pusat".
 * @param {{manifest?: {areas?: Array<{id:string, bounds:{minX:number,minZ:number,maxX:number,maxZ:number}}>}|null,
 *   frame: {toWorld(x:number,z:number):{x:number,z:number}, yawToWorld(y:number):number}, spawn: {x:number,z:number,yaw:number}}} opts
 * @returns {Array<{id:string, label:string, x:number, z:number, yaw:number}>}
 */
export function travelDestinations({ manifest = null, frame, spawn }) {
  const s = frame.toWorld(spawn.x, spawn.z);
  const out = [{ id: 'stadion', label: 'Stadion Utama Riau', x: s.x, z: s.z, yaw: frame.yawToWorld(spawn.yaw) }];
  const area = manifest?.areas?.find((a) => a.id === ANNUR_AREA_ID);
  if (area) {
    const b = area.bounds;
    out.push({ id: 'annur', label: 'Masjid Raya An-Nur', x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, yaw: 0 });
  }
  return out;
}

/**
 * Titik walkable terdekat di sekitar (x, z): pusat dulu, lalu cincin 8 arah berjarak `step` m sampai
 * `maxRadius`. null bila tidak ada (mis. tile belum dimuat semua terhalang).
 */
export function findWalkableNear(x, z, isWalkable, { step = 4, maxRadius = 200, directions = 16 } = {}) {
  if (isWalkable(x, z)) return { x, z };
  for (let r = step; r <= maxRadius; r += step) {
    for (let i = 0; i < directions; i += 1) {
      const a = (i / directions) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (isWalkable(px, pz)) return { x: px, z: pz };
    }
  }
  return null;
}

/**
 * @param {{destinations: ReturnType<typeof travelDestinations>, bike: {state: object, setCollider(c: Function): void},
 *   colliders: {isWalkable(x:number, z:number): boolean}, city?: {whenSettled(x:number, z:number, r?:number): Promise<boolean>}|null,
 *   screen: {show(text:string): void, hide(): void}, settleRadius?: number}} opts
 */
export function createFastTravel({ destinations, bike, colliders, city = null, screen, settleRadius = STREAM.lod0Radius }) {
  let busy = false;
  const place = (x, z, yaw) => {
    bike.state = { ...bike.state, x, z, yaw, v: 0 };
    bike.setCollider(createCollider({ x, z }, colliders.isWalkable));
  };
  return {
    destinations,
    get busy() { return busy; },
    /** @returns {Promise<boolean>} true bila tile tujuan selesai dimuat sebelum batas waktu */
    async go(id) {
      const d = destinations.find((v) => v.id === id);
      if (!d || busy) return false;
      busy = true;
      screen.show(`Menuju ${d.label}…`);
      try {
        place(d.x, d.z, d.yaw); // fokus streamer pindah ke tujuan
        const settled = city ? await city.whenSettled(d.x, d.z, settleRadius) : true;
        const spot = findWalkableNear(d.x, d.z, colliders.isWalkable) ?? d;
        place(spot.x, spot.z, d.yaw); // collider tile sudah ada: muncul di titik yang bisa dilalui
        return settled;
      } finally {
        screen.hide();
        busy = false;
      }
    },
  };
}
```
Buat `src/ui/FastTravelMenu.js`:
```js
/**
 * Menu perjalanan cepat (tombol G atau tombol HUD "Perjalanan cepat") dan layar perjalanan yang
 * menutupi dunia selama tile tujuan dimuat. Vanilla DOM, tanpa innerHTML.
 */
const el = (doc, tag, props = {}, ...children) => {
  const node = Object.assign(doc.createElement(tag), props);
  node.append(...children);
  return node;
};

export class FastTravelMenu {
  /**
   * @param {HTMLElement} root
   * @param {{destinations: Array<{id:string, label:string}>, onTravel: (id:string) => void}} opts
   */
  constructor(root, { destinations, onTravel }) {
    const doc = root.ownerDocument ?? document;
    this.list = el(doc, 'div', { className: 'travel-list' }, ...destinations.map((d) => {
      const b = el(doc, 'button', { type: 'button', textContent: d.label });
      b.dataset.id = d.id;
      b.addEventListener('click', () => {
        this.hide();
        onTravel(d.id);
      });
      return b;
    }));
    const close = el(doc, 'button', { type: 'button', className: 'travel-close', textContent: 'Tutup (G)' });
    close.addEventListener('click', () => this.hide());
    this.panel = el(doc, 'div', { id: 'fast-travel', className: 'hidden' }, el(doc, 'h2', {}, 'Perjalanan cepat'), this.list, close);
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Perjalanan cepat');
    this.button = el(doc, 'button', { type: 'button', id: 'hud-travel', textContent: 'Perjalanan cepat (G)' });
    this.button.addEventListener('click', () => this.toggle());
    root.append(this.panel, this.button);
  }

  get open() { return !this.panel.classList.contains('hidden'); }

  toggle() { this.panel.classList.toggle('hidden'); }

  hide() { this.panel.classList.add('hidden'); }

  dispose() {
    this.panel.remove();
    this.button.remove();
  }
}

/** Layar perjalanan: overlay teks selama teleport menunggu streamer. */
export function createTravelScreen(root) {
  const doc = root.ownerDocument ?? document;
  const label = el(doc, 'p', { className: 'travel-label' });
  const box = el(doc, 'div', { id: 'travel-screen', className: 'hidden' }, label);
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  root.append(box);
  return {
    show(text) {
      label.textContent = text;
      box.classList.remove('hidden');
    },
    hide() { box.classList.add('hidden'); },
    get visible() { return !box.classList.contains('hidden'); },
    dispose() { box.remove(); },
  };
}
```
Tambahkan di akhir `src/ui/hud.css`:
```css
/* Perjalanan cepat (tombol G): tombol HUD, panel tujuan, dan layar perjalanan. */
#hud-travel {
  position: fixed; top: 60px; left: 50%; transform: translateX(-50%); z-index: 5;
  padding: 4px 12px; border-radius: 999px; border: 1px solid var(--hud-accent);
  background: rgba(10, 14, 20, 0.6); color: var(--hud-fg); font: 600 12px/1.4 system-ui, sans-serif; cursor: pointer;
}
#fast-travel {
  position: fixed; top: 96px; left: 50%; transform: translateX(-50%); z-index: 7;
  min-width: 260px; padding: 14px 16px; border-radius: 12px; background: rgba(10, 14, 20, 0.92); color: var(--hud-fg);
}
#fast-travel h2 { margin: 0 0 10px; font-size: 16px; }
#fast-travel .travel-list { display: grid; gap: 8px; margin-bottom: 10px; }
#fast-travel button { padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.06); color: inherit; cursor: pointer; }
#fast-travel.hidden, #travel-screen.hidden { display: none; }
#travel-screen {
  position: fixed; inset: 0; z-index: 20; display: grid; place-items: center;
  background: rgba(8, 12, 18, 0.88); color: #fff; font: 600 18px/1.4 system-ui, sans-serif;
}
```

- [ ] **Step 4: Wiring.** `src/main.js` — tambahkan impor:
```js
import { travelDestinations, createFastTravel } from './app/fastTravel.js';
import { FastTravelMenu, createTravelScreen } from './ui/FastTravelMenu.js';
```
ganti:
```js
  const minimap = setupMinimap(app, ents, story, frame);
  if (city) minimap.setTileLayer(city.minimap);
  addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story, frame });
```
menjadi:
```js
  const minimap = setupMinimap(app, ents, story, frame);
  if (city) minimap.setTileLayer(city.minimap);
  const travel = setupFastTravel({ lifecycle, hud, ents, colliders, city, frame, spawn: region.layout.spawn });
  addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story, frame, travelMenu: travel.menu });
```
di `app.start` ganti `input: hud.shopOpen || rig.freezesBike ? null : input` menjadi `input: hud.shopOpen || rig.freezesBike || travel.busy ? null : input`; ganti panggilan `exposeDevTools({ …, colliders, city, teardown: … })` menjadi:
```js
    exposeDevTools({
      app, ents, rig, time, weather, store, audioBus, story, colliders, city, fastTravel: (id) => travel.go(id), teardown: () => lifecycle.disposeAll(),
    });
```
`addFrameSystems` — signature tambah `travelMenu`, dan panggilan `handleKeys(input, { …, story, frame })` → `handleKeys(input, { …, story, frame, travelMenu })`. Sisipkan sebelum `/** Cerita (region-lokal): …` fungsi:
```js
/**
 * Perjalanan cepat (G / tombol HUD): Stadion & Masjid Raya An-Nur; teleport menunggu tile tujuan
 * dimuat streamer sebelum layar perjalanan ditutup. Tanpa kota: hanya Stadion.
 */
function setupFastTravel({ lifecycle, hud, ents, colliders, city, frame, spawn }) {
  const screen = createTravelScreen(document.body);
  lifecycle.add(() => screen.dispose());
  const travel = createFastTravel({
    destinations: travelDestinations({ manifest: city?.manifest ?? null, frame, spawn }), bike: ents.bike, colliders, city, screen,
  });
  const menu = new FastTravelMenu(document.body, {
    destinations: travel.destinations,
    onTravel: (id) => travel.go(id)
      .then((ok) => { if (!ok) hud.toast('Sebagian peta tujuan belum termuat', false); })
      .catch((err) => console.error('Perjalanan cepat gagal:', err)),
  });
  lifecycle.add(() => menu.dispose());
  return { menu, get busy() { return travel.busy; }, go: (id) => travel.go(id) };
}

```
`src/app/keymap.js` — signature `handleKeys(input, { rig, hud, ents, shop, time, store, story, frame, travelMenu = null })`; setelah `  if (input.consumePress('KeyJ')) story.toggleJournal();` tambahkan:
```js
  if (input.consumePress('KeyG')) travelMenu?.toggle(); // perjalanan cepat (Stadion / Masjid Raya An-Nur)
```
`src/app/devtools.js` — tambahkan `fastTravel = null` ke parameter dan `fastTravel` ke `window.__sim`.
`index.html:36` — ganti `<li><b>J</b> jurnal misi &nbsp; <b>M</b> minimap &nbsp; <b>H</b> pengaturan &nbsp; <b>P</b> mode foto</li>` menjadi `<li><b>J</b> jurnal misi &nbsp; <b>M</b> minimap &nbsp; <b>H</b> pengaturan &nbsp; <b>P</b> mode foto &nbsp; <b>G</b> perjalanan cepat</li>`.

- [ ] **Step 5: Tes → LULUS; suite + lint + build**

```bash
node node_modules/vitest/vitest.mjs run tests/fastTravel.test.js tests/fastTravelMenu.test.js
```
```bash
node node_modules/vitest/vitest.mjs run
```
```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
Uji browser: `await __sim.fastTravel('annur')` → `true`; sepeda ±20 m dari pusat area An-Nur di titik walkable; 15 tile area pusat termuat; layar perjalanan tertutup; 0 galat. Tombol G membuka panel; "Stadion Utama Riau" kembali ke plaza utara.

- [ ] **Step 6: Commit**

```bash
git add src/app/fastTravel.js src/ui/FastTravelMenu.js src/ui/hud.css src/main.js src/app/keymap.js src/app/devtools.js index.html tests/fastTravel.test.js tests/fastTravelMenu.test.js && git commit -m "feat: perjalanan cepat Stadion ↔ Masjid Raya An-Nur (teleport menunggu tile tujuan dimuat, muncul di titik walkable)"
```

---

## Task 21: Aturan ESLint arah dependensi (Plan A Task 10 Step 5 + `src/config/**` + `src/city/**`)

Spec §3 ("dicek ESLint `no-restricted-imports`") + M1. Isi dasar = `pending-eslint-step5.md` (Plan A) dengan tambahan: `src/config/**` (murni, tanpa three, tanpa lapisan lain — M1 sudah dibereskan di Task 10), `src/city/**` (→ engine, geo, shared, config, three saja), `src/app/**` (composition; hanya dilarang mengimpor `main.js`), `data-src/**` di-ignore. Divalidasi saat rencana disusun: lint seluruh repo 0 error dengan aturan ini, dan probe `config → regions`, `city → world`, `geo → three` tertangkap.

**Files:**
- Modify: `eslint.config.js:1-15` (seluruh berkas)

- [ ] **Step 1: BERHENTI — minta keputusan user.** Hook PreToolUse `config-protection` (plugin ecc) memblokir edit `eslint.config.js`. Executor TIDAK BOLEH mengakali hook (tidak menulis lewat shell/skrip, tidak mengganti nama berkas, tidak menonaktifkan hook sendiri). Sampaikan ke user, kata demi kata:

> Task 21 butuh perubahan `eslint.config.js`, yang diblokir hook config-protection. Pilih salah satu: (a) nonaktifkan hook config-protection sementara lalu beri tahu saya untuk melanjutkan, atau (b) tempelkan sendiri isi di bawah ke `eslint.config.js` lalu beri tahu saya. Setelah itu saya menjalankan lint, probe, dan commit.

Isi lengkap `eslint.config.js` yang diusulkan:
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
const ALL = ['world', 'ui', 'regions', 'city', 'core', 'entities', 'story', 'sim', 'engine', 'app'];
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
  { files: ['src/world/**/*.js'], rules: restrict(layers(['ui', 'core', 'entities', 'regions', 'city', 'app']), MAIN) },
  { files: ['src/city/**/*.js'], rules: restrict(layers(['world', 'ui', 'regions', 'core', 'entities', 'story', 'sim', 'app']), MAIN) },
  { files: ['src/regions/**/*.js'], rules: restrict(layers(['ui', 'core', 'entities', 'city', 'app']), MAIN) },
  { files: ['src/core/**/*.js'], rules: restrict(layers(['ui', 'app']), STADIUM_GEOMETRY, MAIN) },
  { files: ['src/ui/**/*.js'], rules: restrict(layers(['app']), MAIN) },
  { files: ['src/app/**/*.js'], rules: restrict(MAIN) },
];
```
Tunggu jawaban user. Bila user memilih menunda: tandai task ini BLOCKED di laporan, lanjutkan Task 22 (tidak bergantung pada Task 21).

- [ ] **Step 2: Setelah perubahan diterapkan (oleh executor bila hook dinonaktifkan, atau oleh user) — lint penuh**

```bash
node node_modules/eslint/bin/eslint.js .
```
Expected: exit 0 (0 error).

- [ ] **Step 3: Probe aturan menangkap pelanggaran** (berkas probe sementara, dihapus setelahnya):

```bash
echo "import '../regions/stadion/site.js';" > src/config/zz_probe.js
```
```bash
echo "import '../world/index.js';" > src/city/zz_probe.js
```
```bash
echo "import 'three';" > src/geo/zz_probe.js
```
```bash
node node_modules/eslint/bin/eslint.js src/config/zz_probe.js src/city/zz_probe.js src/geo/zz_probe.js
```
Expected: 3 error `no-restricted-imports` (pesan "Lapisan ini tidak boleh mengimpor …" / "Modul murni tidak boleh bergantung pada three").
```bash
rm src/config/zz_probe.js src/city/zz_probe.js src/geo/zz_probe.js
```

- [ ] **Step 4: Suite + commit**

```bash
node node_modules/vitest/vitest.mjs run
```
```bash
git add eslint.config.js && git commit -m "chore: aturan ESLint arah dependensi antarlapisan (engine, geo, shared, config, story, sim, world, city, regions, core, ui, app)"
```
Bila hook juga menolak `git add eslint.config.js` (tidak diharapkan), minta user melakukan commit ini.

---

## Task 22: Smoke test E2E Playwright (spec Fase 3 butir 5) + hook dev `remountRegion`

Harness mandiri (pola `parity-run.mjs`/`parity-measure-full.cjs` Plan A: Vite port 5174, Chromium headless 1280×720 dpr 1): (1) muat tanpa galat konsol/HTTP ≥ 400; (2) draw call tile ≤ 150 (selisih frame dengan/tanpa grup kota); (3) siklus pasang/lepas region 3× → `renderer.info.memory` kembali ke baseline (baseline sesudah satu siklus pemanasan — lihat komentar di skrip); (4) rute sepeda skrip 1,5 km ke 3 arah (utara, timur, barat daya) pada 25 m/s, hitch p95 < 50 ms (hanya dinilai dengan `--gpu d3d11`; SwiftShader tidak representatif); (5) perjalanan cepat ke An-Nur. Ditambah laporan paritas draw call kawasan stadion (dengan & tanpa tile). Berkas bernama `*.e2e.mjs` sehingga tidak ikut `vitest run` (`vite.config.js` `include: ['tests/**/*.test.js']`).

**Files:**
- Create: `tests/e2e/smoke.e2e.mjs`
- Modify: `src/main.js` (`let stadion`, `remountRegion`, devtools), `src/app/devtools.js` (`remountRegion`), `package.json` (skrip `e2e`)

- [ ] **Step 1: Tulis harness** — buat `tests/e2e/smoke.e2e.mjs`:
```js
#!/usr/bin/env node
/**
 * Smoke test E2E Plan C (spec Fase 3 butir 5) — TIDAK ikut `vitest run` (nama bukan *.test.js).
 *   node tests/e2e/smoke.e2e.mjs [--gpu swiftshader|d3d11] [--out laporan.json] [--skip-ride]
 * Menjalankan Vite (port 5174) dari root repo, Chromium headless 1280×720 lewat paket `playwright`
 * global (npm i -g playwright; atau PLAYWRIGHT_PATH), lalu memeriksa:
 *   1. muat tanpa galat konsol;  2. draw call tile ≤ 150;  3. mount/unmount region 3× → memori GPU
 *   kembali ke baseline;  4. rute sepeda 1,5 km ke 3 arah, hitch p95 < 50 ms (hanya --gpu d3d11);
 *   5. perjalanan cepat ke Masjid Raya An-Nur;  + paritas draw call kawasan stadion (laporan).
 * Exit code 0 = semua lulus.
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5174;
const LIMITS = Object.freeze({ tileCalls: 150, hitchP95Ms: 50, rideSpeed: 25, rideMeters: 1500 });
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});

const { values: opts } = parseArgs({
  options: { gpu: { type: 'string', default: 'swiftshader' }, out: { type: 'string' }, 'skip-ride': { type: 'boolean', default: false } },
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

async function main() {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  // fs.strict=false: worktree dengan node_modules berupa junction ke checkout utama (path di luar root).
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.swiftshader });
  const report = { gpu: opts.gpu, checks: {}, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('response', (res) => { if (res.status() >= 400) report.errors.push(`HTTP ${res.status()} ${res.url()}`); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && window.__sim.city, null, { timeout: 240000 });
    report.checks.load = await page.evaluate(PAGE.prepare);
    report.checks.tileCalls = await page.evaluate(PAGE.tileCalls);
    report.checks.parity = await page.evaluate(PAGE.parity);
    report.checks.memory = await page.evaluate(PAGE.memoryCycle);
    if (!opts['skip-ride']) report.checks.ride = await page.evaluate(PAGE.ride, LIMITS);
    report.checks.fastTravel = await page.evaluate(PAGE.fastTravel);
    report.checks.tileCallsAnNur = await page.evaluate(PAGE.tileCalls);
  } finally {
    await browser.close();
    await server.close();
  }
  const fails = verdict(report);
  report.fails = fails;
  const json = JSON.stringify(report, null, 2);
  if (opts.out) writeFileSync(opts.out, `${json}\n`);
  console.log(json);
  process.exitCode = fails.length ? 1 : 0;
}

/** Daftar kegagalan dari laporan. */
function verdict(r) {
  const f = [];
  const c = r.checks;
  if (r.errors.length) f.push(`galat konsol: ${r.errors.length}`);
  if (!c.load?.settled) f.push('tile sekitar stadion tidak selesai dimuat');
  if (!(c.tileCalls?.calls <= LIMITS.tileCalls)) f.push(`draw call tile ${c.tileCalls?.calls} > ${LIMITS.tileCalls}`);
  if (!(c.tileCallsAnNur?.calls <= LIMITS.tileCalls)) f.push(`draw call tile An-Nur ${c.tileCallsAnNur?.calls} > ${LIMITS.tileCalls}`);
  const m = c.memory;
  const back = (v) => v.geometries === m.baseline.geometries && v.textures === m.baseline.textures;
  if (!m || !m.cycles.every(back)) f.push(`memori tidak kembali ke baseline: ${JSON.stringify(m)}`);
  if (c.ride && r.gpu === 'd3d11' && !(c.ride.hitchP95 < LIMITS.hitchP95Ms)) f.push(`hitch p95 ${c.ride.hitchP95} ms ≥ ${LIMITS.hitchP95Ms}`);
  if (c.ride && c.ride.failedTiles > 0) f.push(`tile gagal saat rute: ${c.ride.failedTiles}`);
  if (!c.fastTravel?.ok || !(c.fastTravel.distance < 250)) f.push(`perjalanan cepat An-Nur gagal: ${JSON.stringify(c.fastTravel)}`);
  return f;
}

/** Fungsi yang dievaluasi di halaman (window.__sim dari src/app/devtools.js). */
const PAGE = {
  async prepare() {
    const s = window.__sim;
    s.rig.exitPov();
    s.store.set('sky.advanceTime', false);
    s.store.set('sky.hour', 12);
    s.store.set('weather.raining', false);
    s.store.set('camera.mode', 'third');
    s.teleport(0, -275, 0);
    const settled = await s.city.whenSettled(0, -275, 1000, 90000);
    await new Promise((r) => setTimeout(r, 2000));
    return { settled, stats: s.city.stats() };
  },
  /** Draw call milik tile = calls(semua) − calls(grup kota disembunyikan), frame yang sama. */
  tileCalls() {
    const s = window.__sim;
    const info = s.app.renderer.info.render;
    s.app.renderFrame();
    const all = info.calls;
    s.city.group.visible = false;
    s.app.renderFrame();
    const without = info.calls;
    s.city.group.visible = true;
    return { calls: all - without, total: all, triangles: s.city.stats().triangles };
  },
  /** Paritas kawasan stadion (snippet harness Plan A): rerata 60 frame, dengan & tanpa tile kota. */
  async parity() {
    const s = window.__sim;
    const sample = async () => {
      const calls = [];
      for (let i = 0; i < 60; i += 1) {
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        calls.push(s.app.renderer.info.render.calls);
      }
      return Math.round(calls.reduce((a, b) => a + b, 0) / calls.length);
    };
    const withCity = await sample();
    s.city.group.visible = false;
    const regionOnly = await sample();
    s.city.group.visible = true;
    return { callsMean: withCity, callsMeanRegionOnly: regionOnly, baselinePlanA: 502 };
  },
  /**
   * Siklus pasang/lepas region. Baseline diambil SETELAH satu siklus pemanasan: pada muat pertama model
   * GLB sudah siap sebelum frame pertama, sedangkan saat dipasang ulang versi prosedural cadangan
   * (tugu, serindit) sempat tergambar (terunggah ke GPU) sebelum GLB tiba — selisih tetap, bukan bocor.
   */
  async memoryCycle() {
    const s = window.__sim;
    const snap = async () => {
      for (let i = 0; i < 5; i += 1) await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      const m = s.app.renderer.info.memory;
      return { geometries: m.geometries, textures: m.textures };
    };
    const initial = await snap();
    await s.remountRegion(); // pemanasan
    const baseline = await snap();
    const cycles = [];
    for (let i = 0; i < 3; i += 1) {
      await s.remountRegion();
      cycles.push(await snap());
    }
    return { initial, baseline, cycles, after: cycles[cycles.length - 1] };
  },
  /** Kendarai sepeda di garis lurus (posisi diset per frame) ke 3 arah; ukur selang frame. */
  async ride({ rideSpeed, rideMeters }) {
    const s = window.__sim;
    const dirs = [[0, -1], [1, 0], [-Math.SQRT1_2, Math.SQRT1_2]];
    const deltas = [];
    for (const [dx, dz] of dirs) {
      s.teleport(0, -275, Math.atan2(dx, dz));
      await s.city.whenSettled(0, -275, 600, 60000);
      await new Promise((resolve) => {
        let last = performance.now();
        let dist = 0;
        const step = (now) => {
          const dt = Math.min(0.1, (now - last) / 1000);
          deltas.push(now - last);
          last = now;
          dist += rideSpeed * dt;
          const st = s.ents.bike.state;
          s.ents.bike.state = { ...st, x: dx * dist, z: -275 + dz * dist, yaw: Math.atan2(dx, dz), v: 0 };
          if (dist < rideMeters) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    }
    const st = s.city.stats();
    return { frames: deltas.length, hitchP95: Math.round(percentile(deltas, 0.95)), maxMs: Math.round(Math.max(...deltas)), failedTiles: st.failed };
    function percentile(arr, p) {
      const v = [...arr].sort((a, b) => a - b);
      return v[Math.min(v.length - 1, Math.floor(p * v.length))];
    }
  },
  async fastTravel() {
    const s = window.__sim;
    const area = s.city.manifest.areas.find((a) => a.id === 'pusat');
    const cx = (area.bounds.minX + area.bounds.maxX) / 2;
    const cz = (area.bounds.minZ + area.bounds.maxZ) / 2;
    const ok = await s.fastTravel('annur');
    await new Promise((r) => setTimeout(r, 1500));
    const b = s.ents.bike.state;
    const loaded = s.city.streamer.keys('loaded');
    return {
      ok, distance: Math.round(Math.hypot(b.x - cx, b.z - cz)), walkable: s.app && window.__sim.city.collider.isWalkable(b.x, b.z),
      pusatTiles: loaded.filter((k) => Number(k.split('_')[0]) >= 12).length, overlayHidden: document.getElementById('travel-screen')?.classList.contains('hidden'),
    };
  },
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```
Tambahkan skrip di `package.json` (`scripts`): `"e2e": "node tests/e2e/smoke.e2e.mjs"`.

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node tests/e2e/smoke.e2e.mjs --skip-ride
```
Expected: exit 1 — `s.remountRegion is not a function` (hook belum ada).

- [ ] **Step 3: Hook dev `remountRegion`.** Di `src/main.js` ganti:
```js
  const stadion = await mountRegion(app, stadionDef, { store, time, weather });
  lifecycle.add(() => stadion.unmount()); // LIFO: dicabut sebelum time/weather di-dispose
```
menjadi:
```js
  let stadion = await mountRegion(app, stadionDef, { store, time, weather });
  lifecycle.add(() => stadion.unmount()); // LIFO: dicabut sebelum time/weather di-dispose
  /** Uji siklus hidup (dev/E2E): lepas lalu pasang ulang region; kembalikan Promise model siap. */
  const remountRegion = async () => {
    stadion.unmount();
    stadion = await mountRegion(app, stadionDef, { store, time, weather });
    return stadion.ready;
  };
```
dan di panggilan `exposeDevTools({ … })` tambahkan `remountRegion,` (setelah `city,`). `src/app/devtools.js` — tambahkan `remountRegion = null` ke parameter dan `remountRegion` ke objek `window.__sim`. (`region`/`colliders`/entitas memegang data murni & collider modul yang sama, jadi aman dipakai ulang setelah remount.)

- [ ] **Step 4: Jalankan → LULUS**

```bash
node tests/e2e/smoke.e2e.mjs --gpu d3d11 --out data-src/e2e-laporan.json
```
Expected: exit 0, `"fails": []`. Angka saat rencana disusun (RTX 3050, d3d11): tile termuat 22, draw call tile 68 (≤ 150), An-Nur 53; memori awal 419/67 → baseline sesudah pemanasan 434/68 → 3 siklus 434/68, 434/68, 434/68; rute 10.796 frame, hitch p95 17 ms, maks 33 ms, 0 tile gagal; perjalanan cepat ok, 20 m dari pusat An-Nur, 15 tile area pusat; paritas callsMean 525 (dengan tile) / 468 (tanpa tile). Tanpa GPU: `node tests/e2e/smoke.e2e.mjs` (SwiftShader; hitch hanya dilaporkan).

- [ ] **Step 5: Lint + build + commit**

```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
```bash
git add tests/e2e/smoke.e2e.mjs src/main.js src/app/devtools.js package.json && git commit -m "test(e2e): smoke Playwright (galat konsol, draw call tile, siklus memori region 3×, rute sepeda 1,5 km, perjalanan cepat An-Nur)"
```

---

## Task 23: Verifikasi akhir (suite, coverage, lint, build, E2E, paritas, budget)

**Files:**
- Modify: `vite.config.js:28` (cakupan coverage modul murni Plan C)

- [ ] **Step 1: Cakupan coverage modul murni baru.** Di `vite.config.js` ganti:
```js
        'src/engine/**', 'src/geo/**', 'src/shared/**', 'src/regions/Region.js', 'src/regions/stadion/mask.js',
```
menjadi:
```js
        'src/engine/**', 'src/geo/**', 'src/shared/**', 'src/regions/Region.js', 'src/regions/stadion/{mask,placement,lamps}.js',
        'src/city/{ChunkStreamer,TileCollider,tileData,tileMinimap}.js', 'src/app/{regionContext,fastTravel}.js',
```

- [ ] **Step 2: Suite + coverage**

```bash
node node_modules/vitest/vitest.mjs run --coverage
```
Expected: semua lulus (saat rencana disusun: 102 berkas / 766 tes); ambang 90/85/90/90 terpenuhi (saat rencana disusun: stmt 97,5 / branch 93,7 / func 97,3 / lines 98,6).

- [ ] **Step 3: Lint + build**

```bash
node node_modules/eslint/bin/eslint.js .
```
```bash
node node_modules/vite/bin/vite.js build
```
Expected: 0 error; build sukses (`dist/tiles/` ikut tersalin).

- [ ] **Step 4: Budget tile (spec §1 kriteria 5)**

```bash
node -e "const m=require('./public/tiles/manifest.json');const t=m.tiles.reduce((a,b)=>a+b.bytes,0);const big=Math.max(...m.tiles.map((x)=>x.lod[0].bytes+x.data.bytes));console.log('total MB',(t/1048576).toFixed(2),'| terberat LOD0+data KB',(big/1024).toFixed(1),'| tile',m.tiles.length)"
```
Expected: total ≤ 20 MB (saat rencana disusun 6,73), terberat ≤ 300 KB (±194), 52 tile.

- [ ] **Step 5: E2E + paritas kawasan stadion**

```bash
node tests/e2e/smoke.e2e.mjs --gpu d3d11 --out data-src/e2e-akhir.json
```
Expected: exit 0. Bandingkan `checks.parity` dengan baseline Plan A (callsMean ±502): `callsMeanRegionOnly` (tanpa tile) lebih rendah karena konten fiktif & vegetasi di luar mask dihapus (saat rencana disusun 468 = −7%); `callsMean` dengan tile (525) = region + ±68 draw call tile. Kriteria spec "paritas ±5%" diperiksa pada checkpoint Task 3–4 (sebelum penghapusan I4); di sini laporkan angka & selisihnya. Jalankan juga harness Plan A (`parity-run.mjs … full`) untuk malam+hujan & teardown: 0 galat, teardown bersih.

- [ ] **Step 6: Riwayat & tree**

```bash
git log --oneline feat/pekanbaru-slice..HEAD
```
Expected: commit Task 1–23 (± Task 21 bila BLOCKED). `git status --short` bersih (kecuali `data-src/`, di-.gitignore).

- [ ] **Step 7: Commit konfigurasi coverage**

```bash
git add vite.config.js && git commit -m "test: cakupan coverage modul murni Plan C (city, app, regions/stadion)"
```

- [ ] **Step 8: Laporan akhir** — tulis ke laporan (bukan berkas repo): angka suite/coverage/lint/build, ringkasan JSON E2E (`data-src/e2e-akhir.json`), paritas vs 502, budget tile, daftar penyimpangan per task, status Task 21.

---

## Catatan: kontribusi user (bukan task agen)

Plan B Task 10 — aturan heuristik tinggi bangunan lokal (`tools/citybake/height.js`, `estimateHeight`: ruko 2–3 lantai di arteri, rumah 1 lantai di gang, gedung tinggi di Sudirman) adalah **kontribusi domain user** dan tidak dikerjakan agen. Setelah user mengubah `height.js`, bake ulang dengan `node tools/citybake --area all --offline` (cache Task 0), periksa `PERINGATAN:` budget, jalankan `node node_modules/vitest/vitest.mjs run tests/citybake tests/osmFacts.test.js tests/city`, lalu commit `public/tiles`. Tidak ada bagian Plan C yang bergantung pada nilai tinggi.

---

## Self-review

### Cakupan spec & utang serah-terima → task

| Butir | Task |
|---|---|
| Fase 2.1 `ChunkStreamer` murni (1.000/1.300 m, LOD1 600–1.000 m, maks 2 paralel, prioritas jarak, batal) | 12 |
| Fase 2.2 `TileLoader` (GLTFLoader + MeshoptDecoder, `tileCenter`, registry basah, `freezeStatic` per tile, dispose, retry 2× backoff, validasi data) | 11, 14, 16 |
| Fase 2.3 `TileCollider` (hash 25 m, bangunan + air) + collider komposit (mask → region, selain itu → tile) | 13, 16 |
| Fase 2.4 Minimap layer region + layer tile (cache per tile) | 15, 19 (latar region transparan) |
| Fase 2.5 Kabut/far plane; shadow lokal ±200 m | 16 |
| Fase 2.6 Atribusi HUD + `ATTRIBUTION.txt` (sudah dari bake) + README | 17 |
| `cityMaterials.js` (material per nama mesh, depthWrite/renderOrder sesuai Plan B) | 14 |
| Fase 3.1 Placement + mask dari OSM (centroid + yaw sumbu panjang; mask fallback) | 18 (placement), 5 + 8 (mask satu sumber + koridor) |
| Fase 3.2 Elemen fiktif dihapus; angkot/bus dari polyline OSM atau dinonaktifkan | 7, 8 (dinonaktifkan) |
| Fase 3.3 Tanah 1.400 m → tanah per tile + tanah region di dalam mask | 16 (tanah dasar kota), 19 |
| Fase 3.4 Fast travel (Stadion, An-Nur), streamer memuat sebelum layar ditutup | 20 |
| Fase 3.5 Smoke test Playwright `tests/e2e/` | 22 |
| §5 Tile gagal → retry 2×, ditandai gagal, area terbuka, toast sekali | 12, 13, 14, 16 |
| §5 Manifest gagal → mode hanya-region + toast | 16 |
| §5 Data JSON divalidasi; tile tak valid dilewati | 11, 14 |
| §6 TDD modul murni (`ChunkStreamer`, `TileCollider`, mask, placement) + coverage | 5, 8, 11–13, 18, 23 |
| §1 Kriteria 2 (build/dispose 3× → memori baseline) | 3 (Node), 22 (browser) |
| §1 Kriteria 3 (sepeda 1,5 km, hitch p95 < 50 ms) | 22 |
| §1 Kriteria 4 (fast travel, minimap tile, atribusi) | 15, 17, 20 |
| §1 Kriteria 5 (≤ 150 draw call tile, ≈ 300k segitiga, ≤ 20 MB) | 22, 23 |
| I1 placement ujung-ke-ujung (group sebelum freezeStatic, entitas, GLB, lampu/halo, cerita, POV, START_POS, bake minimap) | 3, 4 (uji `{100, −50, 0,3}`), 18 |
| I2 mount/unmount (remove → dispose, unregister sebelum disposeTree, blenderModels ke region, scope saat throw, snapshot, LIFO) | 1, 3 |
| I3 satu mask + satu `pointInPolygon`, citybake impor mask klien, bake ulang | 5 (+ 8, 18) |
| I4 konten selaras mask sebelum TileCollider (per elemen, verifikasi OSM) | 6, 7, 8 |
| M1 config → regions terbalik; aturan `src/config/**` | 10, 21 |
| M2 urutan fase & dispose LIFO | 1, 3 (urutan `lighting, wind, stadion.world, timeOfDay, weather` dijaga) |
| M3 `registerLamps()` → unregister | 2 |
| M4 kontrak entitas per region | Sebagian: entitas region dipisah ke `regionGroup` + ctx lokal (4); field build tambahan (`seatSamples`, `layout`, `nightLights`, `lateRoot`, `ready`) tetap konvensi, belum kontrak formal |
| M5 wiring `main.js` tak dites | 22 (E2E menjalankan main nyata: muat, remount, rute, fast travel, teardown lewat harness Plan A) |
| Utang props/GLB ke scope (Plan A Task 4/5) | 3 (GLB), 9 (props/vegetasi) |
| Aturan ESLint arah dependensi (Plan A Task 10 Step 5) | 21 (BERHENTI untuk user) |

### Bukti saat penyusunan (bukan asumsi)
Seluruh kode di rencana ini diterapkan berurutan pada salinan repo sementara (di luar repo; checkout tidak disentuh) — berkas baru persis seperti di rencana, perubahan berkas lama lewat skrip penggantian teks yang setara dengan langkah "ganti … menjadi …" (teks pengganti `main.js` Task 2–3 juga diputar ulang terhadap `main.js` asli) — lalu diverifikasi: suite 102 berkas / 766 tes lulus, lint 0, build sukses, coverage di atas ambang; harness paritas Plan A setelah Task 3/4 = 501/505 (±502), 0 galat, teardown bersih; E2E Task 22 (GPU d3d11) exit 0 dengan angka di Task 22 Step 4; bake offline mereproduksi tile byte-identik sebelum perubahan mask. Fakta OSM per elemen I4 diperiksa dari cache bake dan satu query Overpass (2026-10-16T14:15:06Z).

### Asumsi yang belum terverifikasi
- **Gapura nyata** — tidak dipetakan di OSM; posisinya di ujung sumbu pedestrian (0, −436) adalah inferensi dari geometri OSM (sumbu + tangga way 1513217586), bukan fakta terpetakan. User sebaiknya mengonfirmasi lokasi gerbang sebenarnya.
- **Data OSM berubah** — keputusan I4 mengacu pada snapshot 2026-10-16. Bake online di masa depan dapat mengubah fakta; `tests/osmFacts.test.js` sengaja gagal bila begitu.
- **Hitch di ponsel** — p95 17 ms diukur di GPU desktop (RTX 3050). Belum diukur di HP; spec §8 menyebut Worker parsing "bila terukur perlu".
- **Memori GLB setelah remount** — baseline diambil setelah satu siklus pemanasan karena model prosedural cadangan sempat terunggah sebelum GLB tiba (+15 geometri, +1 tekstur, stabil antarsiklus). Penjelasan ini disimpulkan dari pola angka (sama persis di tiap siklus), belum dibuktikan per objek.
- **Fokus streamer** — memakai `ctx.focus` (titik pandang kamera). Saat POV jauh (mis. orbit) tile dimuat di sekitar target POV, bukan sepeda; diasumsikan benar secara visual.
- **Jembatan** — jalan yang melintasi poligon air dianggap jembatan (walkable). Belum ada data `bridge=yes`; jalan tepi sungai yang menempel garis air bisa ikut "menjembatani" pinggiran air.

### Hal di spec yang tidak realistis (dan bagaimana rencana ini menanganinya)
- **"Tekstur jendela" di `cityMaterials.js`** — tidak mungkin dengan Format tile v1 (GLB tanpa UV, kontrak Plan B). Dilewati; warna dinding dari vertex color. Butuh kontrak tile v2 (UV atau atribut fasad) atau shader triplanar.
- **"Paritas draw call ±5%" setelah Fase 3** — bertentangan dengan keputusan "fakta mengalahkan gaya" (konten fiktif & vegetasi luar mask dihapus → −7% region; tile menambah ±68). Kriteria diterapkan pada checkpoint Task 3–4; Task 23 melaporkan angka akhir dengan penjelasan.
- **"Mask = poligon kompleks stadion" dari OSM** — poligon itu tidak ada di OSM (hanya bowl stadion, kampus UNRI, EcoEduPark). Fallback hull + parkir + koridor utara dipakai permanen sampai ada pemetaan.
- **Hitch p95 < 50 ms di Playwright headless** — hanya bermakna dengan GPU (`--use-angle=d3d11`); di SwiftShader frame > 50 ms dari render itu sendiri. Harness hanya menilai hitch pada mode GPU.
- **Angkot/bus mengikuti polyline OSM** — model statis di jalan kota bukan konten region dan tanpa sistem lalu lintas akan berdiri di tengah jalan; dinonaktifkan (backlog §7).
- **Kawasan sekitar stadion menjadi "polos"** — vegetasi dari landuse ada di backlog spec §7; setelah Task 19 area di luar mask hanya landuse datar + bangunan. Ini konsekuensi yang perlu disadari user.

### Temuan untuk keputusan user (di luar cakupan)
- Parkir & plaza utara handmade menumpuk dengan danau OSM barat dan sumbu pedestrian nyata (lihat catatan di bawah tabel I4).
- Helipad nyata (way 652285334, `aeroway`) dan tag lain di luar query bake (aeroway, barrier) belum dibake; menambahkannya butuh bake online.
- Area An-Nur belum punya region handmade (backlog spec §7 "landmark handmade Area B"); masjid tampil sebagai bangunan OSM terekstrusi dengan tinggi estimasi.
