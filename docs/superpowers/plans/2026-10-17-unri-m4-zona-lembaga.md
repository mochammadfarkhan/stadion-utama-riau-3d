# M4 Zona Lembaga — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (satu implementer untuk seluruh tonggak, satu review di akhir tonggak; lihat "Aturan eksekusi" di `docs/superpowers/plans/2026-10-17-unri-00-index.md`). Langkah memakai checkbox (`- [ ]`) untuk dilacak.

**Goal:** Region hero `unri-lembaga` (spec §8.1) tampil lengkap dan autentik: gedung **Sekretariat Lembaga Mahasiswa** (`way/327530276`) handmade sangat detail dengan 8 pintu ber-papan nama (BEM UNIVERSITAS RIAU, DPM, 6 ormawa dari `sekre.data.js`; sekre pemain di sebelah BEM), teras yang hidup, Stadion Mini UNRI, Student Center (K03 hero), detail hero Rusunawa (K09) dan FH Panam (K10 + ilalang), parkiran motor padat, proxy murah, pintu-portal ke interior stub (kontrak spec §4.8 penuh), perjalanan cepat dev, budget ≤ 250 draw call, dan screenshot siang/malam/hujan.

**Architecture:** Region memakai kontrak `defineRegion` yang diperluas M0 (`activation`, `proxy`, `povs`, `pads`). Placement region = pusat Sekretariat dengan **yaw 0** (koordinat region-lokal = dunia − origin; utara = −Z seperti stadion); setiap bangunan hero punya *sub-frame* `{x, z, yaw}` sendiri yang diturunkan dari footprint OSM saat modul dimuat (data mentah = lat/lon OSM beku). Gedung hero H01/H02/H03 **dimiliki region** (distrik merender PartList kosong untuknya lewat `HERO_BUILDERS` → tidak ada gambar ganda); Rusunawa dan FH tetap dirender distrik (K09/K10) dan region hanya menambah lapisan detail di sekitarnya. `build()` cepat (< 30 ms: data murni + permukaan basah); rakitan berat lewat `ctx.schedule` (generator, satu `yield` per langkah) ke grup `lateRoot`, `ready` resolve saat antrean habis. Portal interior: `src/app/interiorPortal.js` (mesin state berport, dites) + port tampilan `appView.js` (memakai `App.setView` M5 bila ada; di M4 menukar pass adegan composer tanpa mengubah App) + overlay fade.

**Tech Stack:** Three.js r186 (ESM, Vite 8), Vitest 5 (environment `node`), Playwright global (E2E GPU d3d11), Blender via MCP (`mcp__blender__execute_blender_code`) + `assets-src/blender/export_glb.py`.

---

## Prasyarat

1. **M0–M3 selesai** dan hijau (`npm test`, `npm run lint`, `npm run build`). Plan ini memakai, persis dengan nama di indeks:
   - M0: `defineRegion` dengan field `activation/proxy/povs/pads`; `mountRegion` memberi `ctx.terrain`, `ctx.heightAtLocal(lx, lz)`, `ctx.schedule(task)` (fungsi biasa atau generator; tiap `yield` = titik potong; owner `region:<id>`); di `main.js` M0 manager bernama **`regions`** (`const { regions, scheduler, terrain, colliders } = createRegionLayer(...)`; `regions.register(def)` → Promise, `regions.active()`, `regions.frameOf(id)`); `proxy(ctx:{scope, placement, terrain})`; `povs[].pose(frame, ctx:{time, bike})`; collider komposit dinamis `createDynamicCompositeCollider`.
   - M2: `createUnriGroundLayer({ isReserved })` menerima `ctx.isReserved` distrik — **M4 wajib menyediakan predikat ini** lewat `mountDistrict` (Task 21) agar vegetasi/PJU/bangku/rintangan distrik tidak muncul di dalam mask region.
   - M1: `src/districts/unri/boundary.js` (`UNRI_BOUNDARY`, ring dunia), `tools/campusbake` (`npm run bake:campus -- terrain --offline`), `src/app/terrainService.js`.
   - M2: tanah/jalan/parkir/lapangan distrik sudah di-drape (region **tidak** menggambar aspal/parkir/rumput dasar; region menambah lapisan di atasnya).
   - M3: `src/world/kit/{archetypes.js, planBuilding.js, buildBuilding.js, kitMaterials.js, hero/index.js}`, `src/districts/unri/buildings.data.js`.
2. Branch `feat/unri-kampus`, working tree bersih kecuali `docs/superpowers/plans/*`.
3. Blender (opsional) terhubung lewat MCP untuk Task 25. Tanpa Blender: placeholder prosedural motor tetap final sementara (`MOTOR_GLB_READY = false` di `motor.js`; region tidak meminta GLB).

> Semua kontrak M0–M3 yang **detail signature-nya tidak tertulis di indeks** (bentuk `pose()` POV, nama ekspor pad di `campusbake/config.js`, field override K03, cara klaster memanggil hero) diverifikasi di **Task 0** dan setiap penyesuaian dibatasi ke satu file adaptor yang disebut di sana. Jangan menyebar penyesuaian ke file lain.

---

## Fakta geometri beku (dihitung 2026-10-17 dari `data-src/osm/stadion.json`, proyeksi `src/geo/projection.js`, origin `WORLD_ORIGIN`)

Konvensi: dunia ENU, +X timur, **+Z selatan**. Region-lokal = dunia − origin (yaw region 0).

| Fitur | OSM | Dunia (m) | Region-lokal (m) | Ukuran / sumbu |
|---|---|---|---|---|
| **Origin region** = pusat Sekretariat | way 327530276 | (−219,47; 1.099,21) | (0; 0) | — |
| Sekretariat Lembaga Mahasiswa | way 327530276 | sudut A(−224,824; 1.089,124) B(−208,973; 1.094,598) C(−214,116; 1.109,293) D(−229,967; 1.103,819) | sudut lokal-gedung (±7,78; ±8,39) | AB = CD = **16,770 m** (sumbu panjang), BC = DA = **15,569 m**; yaw sumbu panjang **1,238317 rad (70,95°)**: +Z lokal-gedung → dunia (0,94523; 0,32624) = arah ESE; +X lokal-gedung → (0,32624; −0,94523) = NNE. Jajaran genjang ≤ 0,07 m |
| Stadion Mini UNRI | way 327364388, `capacity:persons=5000` | 54 titik, bbox x −293,3…−170,2, z 851,9…1.053,6 | x −73,8…+49,3, z −247,3…−45,6 | ±124 × 202 m |
| Lapangan sepak bola | way 327366049 | pusat (−232,80; 953,96) | (−13,33; −145,25) | 76,45 × 111,77 m, yaw −0,00661 (sumbu panjang U–S) |
| Tribun stadion | way 282225436, `building:levels=7`, `capacity 500` | batang utama x −312,6…−293,2, z 884,9…1.021,5; tonjolan VIP x −318,45…−312,6, z 926,2…978,3 | batang x −93,1…−73,7, z −214,3…−77,7; frame tribun pusat (−83,31; −146,01), yaw −0,00057 | panjang 136,54, dalam 19,11 (rerata; muka barat miring 0,5 m; muka timur menghadap lapangan), VIP x lokal-tribun −15,67…−9,55 (6,11 m) × z −26,98…25,07 (52,05 m) |
| Student Center (kandidat) | way 1480014538 | x −95,94…−42,65, z 826,51…877,46 | x 123,53…176,82, z −272,70…−221,75 | 53,2 (X) × 50,9 (Z), sumbu sejajar dunia |
| Rusunawa | way 327366048, 5 lt | x 28,5…97,4, z 815,4…838,3 | x 248,0…316,9, z −283,8…−260,9 | 68,6 × 22,2 (dirender distrik, K09) |
| Gedung FH Panam | way 327366046, 3 lt, bentuk U (halaman terbuka ke utara) | x −102,8…−31,8, z 583,4…610,6 | x 116,7…187,7, z −515,8…−488,7 | 71 × 27 (dirender distrik, K10) |
| Parkir dekat stadion mini | way 938379741 | 8 titik, x −365,5…−314,3, z 969,1…1.039,2 | x −146,1…−94,8, z −130,1…−60,0 | ±2.520 m² |
| Parkir rusunawa | way 938379740 | x 17,3…103,2, z 789,9…815,5 | x 236,8…322,7, z −309,3…−283,7 | ±2.170 m² |
| Jogging track (service) | way 327363974, 421734205 | melingkari stadion mini; melintas ±(−220; 1.082) | (−0,5; −17,2) = **±16 m utara-timur laut** muka utara sekretariat | jalan distrik |
| Living street | way 653003414 | ujung barat (−225,02; 1.135,61) | (−5,6; 36,4) | **di luar** poligon kampus |
| Jl. Muchtar Lutfi (lajur ganda) | way 38870021, 535177996 | z ±694…733 di x −410…+390 | z −405…−366 | jalan distrik |
| Batas kampus selatan | way 938374562 | segmen (−123,67; 1.111,13)→(−242,8; 1.131,6) | di x lokal 0: z ≈ +28,4 | 18 m selatan muka selatan sekretariat |

Gedung OSM di dalam mask region (dicek titik-dalam-poligon): **hanya** 282225436, 327366046, 327366048, 327530276, 1480014538.

Turunan desain (bukan OSM, **[INFERENSI]**):
- Denah sekretariat: 2 baris × 4 ruang, panjang ruang 16,770/4 = **4,1925 m**, dalam ruang (15,569 − 3,7)/2 = **5,9345 m**, selasar **3,7 m** (|x| ≤ 1,85) terbuka di kedua ujung (muka 15,57 m, menghadap WNW dan ESE). Baris **U** (+X lokal-gedung, NNE, menghadap jogging track) indeks 0–3 dari barat; baris **S** indeks 4–7.
- **BEM = indeks 0** (U, ujung barat), **sekre pemain = indeks 1** (U, di sebelah timur BEM), **DPM = indeks 4** (S, berhadapan dengan BEM).
- Pintu pemain: panjang ruang 4,19243 m; pusat pintu lokal-gedung (1,85; −3,24243); titik portal 1 m ke dalam selasar = lokal-gedung (0,85; −3,24243) = **region-lokal (−2,7875; −1,8632)** = **dunia (−222,257; 1.097,347)**; yaw hadap-keluar pintu **−0,33248 rad** (= −π/2 + 1,238317).
- Aktivasi region: pusat dunia **(−152; 853)**, `mountRadius 700`, `unmountRadius 900` (titik mask terjauh 383 m dari pusat; spawn stadion (0; −275) berjarak 1.135 m → region tidak terpasang saat mulai).

Mask region (dunia, beku, CCW luas bertanda +192.178 m²): `[-415,690] [-112,690] [-112,568] [-20,568] [-20,690] [110,690] [110,860.3] [-47.5,896.2] [-43.3,950.1] [-69.3,958.5] [-67.6,1020.9] [-122.5,1026.6] [-114.4,1090.3] [-132.6,1093] [-130.5,1106.2] [-243.8,1125.7] [-324.1,1137.7] [-415,1131.3]` — utara di z 690 (Jl. Muchtar Lutfi masuk mask), taji FH x −112…−20 sampai z 568, timur x 110 (parkir rusunawa ≤ 103), sisi selatan/tenggara = batas kampus OSM di-*inset* 6 m (jadi di dalam `UNRI_BOUNDARY` yang disederhanakan 5 m), barat x −415 (jogging track ≥ −407,5). Mask stadion berakhir di z +322 → tidak beririsan.

---

## Keputusan desain & deviasi dari indeks/spec

| # | Keputusan | Alasan |
|---|---|---|
| D1 | Placement region `{x:−219.47, z:1099.21, yaw:0}`; sub-frame per bangunan | lokal = dunia − origin (mudah dicek, cocok PartList kit yang berkoordinat dunia); sekretariat tetap lurus di sub-frame-nya |
| D2 | H01/H02/H03 **dimiliki region**: `HERO_BUILDERS` untuk ketiganya mengembalikan `[]` (`regionOwnedHero`) dan override `w282225436` (tribun, levels=7) diarahkan ke `hero:stadion-mini` | tanpa ini distrik menggambar ulang gedung yang sama (z-fighting) dan tribun tampil sebagai balok 7 lantai. **Deviasi**: menyentuh `src/districts/unri/buildings.data.js` (tidak tercantum di "Ubah" M4) |
| D3 | Rusunawa & FH: cangkang tetap K09/K10 milik distrik; `rusun.js`/`fhMangkrak.js` hanya menambah detail (papan nama, pos satpam, jemuran halaman, pagar seng, plang, gundukan material, ilalang) | menghindari dua cangkang di footprint yang sama |
| D4 | `App.js` TIDAK diubah di M4: port `appViewPort(app)` memakai `app.setView` bila ada (M5), bila belum menukar scene/kamera pass adegan composer & OutlinePass lewat `app.post` | stub wajib memenuhi "scene eksterior tidak dirender" (§4.8) tanpa merebut pekerjaan M5 (`App.setView` + `setSystemGate`) |
| D5 | Model Blender A01/A02 dibuat di M4 (indeks: M7) | diminta brief M4; M7 tinggal A03/A04 |
| D6 | Motor GLB di-*instance* (bukan clone per motor): mesh GLB → `InstancedMesh` per material | ±200 motor × clone = ratusan draw call |
| D7 | Tidak menambah `PointLight` region; lampu selasar = material emisif + kolam cahaya aditif emisif; PJU (3 titik) lewat `nightLights` | PointLight baru memicu kompilasi ulang semua shader saat region dipasang |
| D8 | Lintasan lari stadion mini 6 lajur tanah merah, tribun beton 16 undakan + atap seng di bagian VIP, **tanpa** lampu sorot | bentuk tapak oval 124 × 202 m menyiratkan lintasan; foto tidak ada → **[INFERENSI]**; lampu sorot tidak terkonfirmasi → tidak dipasang |
| D9 | NPC teras ditunda ke M7 (`students.js`) | pose duduk baru ada di M5 |

---

## Struktur file

Buat:
- `src/regions/unri-lembaga/footprints.js` — lat/lon OSM beku.
- `src/regions/unri-lembaga/placement.js` — origin, sub-frame, footprint lokal, tribun.
- `src/regions/unri-lembaga/mask.js` — mask dunia/lokal, aktivasi.
- `src/regions/unri-lembaga/pads.js` — pad campusbake.
- `src/regions/unri-lembaga/sekre.data.js` — 8 ruang (BEM, DPM, 6 ormawa) + validator.
- `src/regions/unri-lembaga/layout.js` — denah sekretariat, titik props, baris motor (murni).
- `src/regions/unri-lembaga/portalDoors.js` — `PORTAL_DOORS`, `sekreExitTo`.
- `src/regions/unri-lembaga/collider.js` — collider region-lokal.
- `src/regions/unri-lembaga/sekretariat.walls.js` — segmentasi dinding (murni) + kotak dinding.
- `src/regions/unri-lembaga/sekretariat.textures.js` — kanvas keramik/plafon/roster.
- `src/regions/unri-lembaga/sekretariat.atlas.js` — isi atlas (papan nama, stiker, pengumuman, spanduk, nama gedung).
- `src/regions/unri-lembaga/sekretariat.parts.js` — pintu, jendela nako, roster, lampu (kanonik menghadap +Z).
- `src/regions/unri-lembaga/sekretariat.roof.js` — atap pelana seng, talang, lisplang, plafon.
- `src/regions/unri-lembaga/staged.js` — rakitan bertahap (langkah scheduler + gabung per material).
- `src/regions/unri-lembaga/materials.js` — material & atlas region (satu set per scope).
- `src/regions/unri-lembaga/sekretariat.js` — H01: spesifikasi dinding, permukaan basah, rakitan bertahap.
- `src/regions/unri-lembaga/terrace.js` — props teras.
- `src/regions/unri-lembaga/stadionMini.js` — H02.
- `src/regions/unri-lembaga/kitAdapter.js` — satu-satunya pemakai API kit M3.
- `src/regions/unri-lembaga/studentCenter.js` — H03.
- `src/regions/unri-lembaga/rusun.js`, `fhMangkrak.js`, `parking.js`, `proxy.js`, `povs.js`, `index.js`.
- `src/world/props/unri/{geom.js, atlas.js, papanNamaSekre.js, spanduk.js, papanPengumuman.js, rakSepatu.js, sandal.js, galon.js, jemuran.js, motor.js, ilalang.js}`.
- `src/world/kit/hero/regionOwned.js`.
- `src/ui/FadeOverlay.js`, `src/app/appView.js`, `src/app/interiorPortal.js` (stub), `src/app/portalTrigger.js`.
- `assets-src/blender/unri/motor.py` (+ `motor.blend` hasil simpan), `public/models/unri/motor-bebek.glb`, `public/models/unri/motor-matic.glb`.
- Tes: `tests/unri/lembagaGeometry.test.js`, `sekreData.test.js`, `lembagaLayout.test.js`, `lembagaCollider.test.js`, `atlasPack.test.js`, `propsCatalog.test.js`, `sekreWalls.test.js`, `sekretariatBudget.test.js`, `lembagaRegion.test.js`, `appView.test.js`, `interiorPortal.test.js`.
- `tests/e2e/lembaga.e2e.mjs` — ukur draw call + screenshot.

Ubah:
- `src/world/kit/hero/index.js` (H01–H03 → milik region), `src/districts/unri/buildings.data.js` (D2), `src/main.js`, `src/app/fastTravel.js`, `tools/campusbake/config.js` (pad), `public/districts/unri/terrain/*.bin` (bake ulang), tes golden campusbake (hash baru), `tests/fastTravel.test.js`, `docs/superpowers/plans/2026-10-17-unri-00-index.md` (status M4).

---

## Task 0: Verifikasi antarmuka M0–M3 (tanpa kode produksi)

**Files:** tidak ada yang diubah kecuali bagian "Catatan eksekusi" di akhir plan ini.

- [ ] **Langkah 1: Pastikan basis hijau**

```bash
git status --short
node node_modules/vitest/vitest.mjs run
npm run lint
```
Diharapkan: hanya file `docs/superpowers/plans/*` (bila ada) yang belum di-commit; semua tes lulus; lint 0 galat.

- [ ] **Langkah 2: Catat signature yang dipakai plan ini**

```bash
grep -n "activation\|proxy\|povs\|pads" src/regions/Region.js
grep -n "heightAtLocal\|schedule\|terrain" src/app/mountRegion.js
grep -n "export function createRegionManager\|register(\|proxy\|applyPlacement\|lateRoot\|nightLights" src/app/regionManager.js
grep -n "pose" src/core/povSource.js src/core/PovDirector.js | head -20
grep -n "export" src/districts/unri/boundary.js
grep -n "PADS\|pads" tools/campusbake/config.js tools/campusbake/terrain/pads.js
grep -rln "golden" tests/ | grep -i campus
grep -n "export" src/world/kit/planBuilding.js src/world/kit/buildBuilding.js src/world/kit/kitMaterials.js src/world/kit/archetypes.js src/world/kit/hero/index.js
grep -n "hero:sekretariat-lembaga\|hero:stadion-mini\|hero:student-center\|w327530276\|w1480014538\|w282225436\|w327364388" src/world/kit/hero/index.js src/districts/unri/buildings.data.js
grep -n "HERO_BUILDERS\|hero:" src/districts/unri/buildingClusters.js src/world/kit/buildBuilding.js
grep -n "createRegionLayer\|regions\.register(\|mountDistrict(\|addFrameSystems\|exposeDevTools\|createDynamicCompositeCollider" src/main.js
grep -n "isReserved" src/app/districtMount.js src/districts/unri/index.js
```

Isi tabel ini di "Catatan eksekusi" (akhir file plan) sebelum lanjut:

| Asumsi plan | Diharapkan | Bila berbeda, ubah HANYA |
|---|---|---|
| A1 `defineRegion` menerima `activation/proxy/povs/pads`; pad = `{ring, y}`, field tambahan (`id`) diterima | ya | `pads.js` (buang `id` bila validator ketat) |
| A2 `ctx.schedule(fnGenerator)`, `ctx.heightAtLocal(lx,lz)`, `ctx.terrain.heightAt(x,z)` | ya | `index.js` fungsi `runSteps` / `heightFns` |
| A3 manager memanggil `proxy(ctx)` dan memakai `region.lateRoot`, `region.ready`, `region.nightLights` | ya | `index.js` |
| A4 POV region: `pose(frame, ctx)` → `{px,py,pz,tx,ty,tz,fov}` dunia | ya | `povs.js` |
| A5 `UNRI_BOUNDARY` = ring dunia `[[x,z],…]` | ya | `tests/unri/lembagaGeometry.test.js` |
| A6 nama ekspor pad region di `tools/campusbake/config.js` (mis. `REGION_PADS`) + nama file tes golden | dicatat | Task 3 |
| A7 `planBuilding(input)`, `buildBuilding(plan, mats)` → PartList `{geometry, material, matrix?, castShadow?, name?}`, `createKitMaterials(scope)`, `ARCHETYPES.K03` | ya | `kitAdapter.js` |
| A8 klaster distrik memanggil `HERO_BUILDERS[archetype]` untuk LOD0 **dan** LOD1 | ya | Task 20 langkah 4 (pengecualian `isRegionOwned` di klaster) |
| A9 `src/main.js` (M0): manager = `regions`, collider = `colliders`, fungsi `addFrameSystems`, `setupFastTravel`; pemanggilan `mountDistrict(` (M1) menerima objek opsi | ya | Task 21/24 |
| A10 `mountDistrict(app, def, opts)` (M1) meneruskan `opts.isReserved` ke `ctx.isReserved` distrik (dipakai M2) | dicatat | Task 21 langkah 3b |

- [ ] **Langkah 3: Commit catatan**

```bash
git add docs/superpowers/plans/2026-10-17-unri-m4-zona-lembaga.md
```
```bash
git commit -m "docs(m4): catatan verifikasi antarmuka M0–M3 sebelum zona Lembaga"
```

---

## Task 1: Footprint OSM beku + placement & sub-frame (TDD)

**Files:**
- Create: `src/regions/unri-lembaga/footprints.js`, `src/regions/unri-lembaga/placement.js`
- Test: `tests/unri/lembagaGeometry.test.js`

- [ ] **Langkah 1: Tulis tes yang gagal**

`tests/unri/lembagaGeometry.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  LEMBAGA_PLACEMENT, FOOTPRINTS, FOOTPRINTS_WORLD, SEKRE_FRAME, SEKRE_SIZE, PITCH_FRAME, TRIBUN, toRegion, fromSekre,
} from '../../src/regions/unri-lembaga/placement.js';
import { toLocal } from '../../src/geo/regionTransform.js';

describe('placement zona Lembaga dari footprint OSM', () => {
  it('origin = pusat Sekretariat (way 327530276), yaw region 0', () => {
    expect(LEMBAGA_PLACEMENT).toEqual({ x: -219.47, z: 1099.21, yaw: 0 });
    const [a, b, c, d] = FOOTPRINTS_WORLD.sekretariat;
    expect((a[0] + b[0] + c[0] + d[0]) / 4).toBeCloseTo(-219.47, 1);
    expect((a[1] + b[1] + c[1] + d[1]) / 4).toBeCloseTo(1099.21, 1);
  });

  it('sekretariat 16,77 × 15,57 m, sumbu panjang yaw 1,2383 rad', () => {
    expect(SEKRE_SIZE.length).toBeCloseTo(16.77, 2);
    expect(SEKRE_SIZE.width).toBeCloseTo(15.57, 2);
    expect(SEKRE_FRAME.yaw).toBeCloseTo(1.23832, 4);
    expect(Math.hypot(SEKRE_FRAME.x, SEKRE_FRAME.z)).toBeLessThan(0.01);
    for (const [x, z] of FOOTPRINTS.sekretariat) {
      const l = toLocal(SEKRE_FRAME, x, z);
      expect(Math.abs(Math.abs(l.x) - SEKRE_SIZE.width / 2)).toBeLessThan(0.08);
      expect(Math.abs(Math.abs(l.z) - SEKRE_SIZE.length / 2)).toBeLessThan(0.08);
    }
  });

  it('fromSekre: +Z lokal-gedung mengarah ESE, +X ke NNE', () => {
    const e = fromSekre(0, 10);
    expect(e.x).toBeCloseTo(9.4523, 3);
    expect(e.z).toBeCloseTo(3.2624, 3);
    const n = fromSekre(10, 0);
    expect(n.x).toBeCloseTo(3.2638, 3);
    expect(n.z).toBeCloseTo(-9.4538, 3);
  });

  it('lapangan: pusat region-lokal (−13,33; −145,25), sumbu panjang U–S', () => {
    expect(PITCH_FRAME.x).toBeCloseTo(-13.33, 1);
    expect(PITCH_FRAME.z).toBeCloseTo(-145.25, 1);
    expect(Math.abs(PITCH_FRAME.yaw)).toBeLessThan(0.01);
  });

  it('tribun: panjang 136,5 m, dalam 19,1 m, VIP 6,1 × 52 m menempel di muka barat', () => {
    expect(TRIBUN.length).toBeCloseTo(136.54, 1);
    expect(TRIBUN.depth).toBeCloseTo(19.11, 1);
    expect(TRIBUN.vip.x1).toBeCloseTo(-TRIBUN.depth / 2, 6);
    expect(TRIBUN.vip.x1 - TRIBUN.vip.x0).toBeCloseTo(6.11, 1);
    expect(TRIBUN.vip.z1 - TRIBUN.vip.z0).toBeCloseTo(52.05, 0);
  });

  it('toRegion = dunia − origin', () => {
    expect(toRegion(-219.47, 1099.21)).toEqual([0, 0]);
    expect(toRegion(-232.80, 953.96)[1]).toBeCloseTo(-145.25, 2);
  });
});
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/lembagaGeometry.test.js`
Expected: FAIL — `Failed to resolve import "../../src/regions/unri-lembaga/placement.js"`.

- [ ] **Langkah 3: Buat `footprints.js`**

```js
/**
 * Footprint OSM zona Lembaga (cache data-src/osm/stadion.json, timestamp OSM 2026-10-16), ring [lat, lon]
 * terbuka, urutan simpul asli OSM. Diproyeksikan ke dunia di placement.js (sumber tunggal klien & campusbake).
 * Data © kontributor OpenStreetMap, lisensi ODbL 1.0 (lihat public/districts/unri/ATTRIBUTION.txt).
 */
const ring = (pts) => Object.freeze(pts.map((p) => Object.freeze(p)));

export const OSM_WAY_IDS = Object.freeze({
  sekretariat: 327530276, stadionMini: 327364388, lapangan: 327366049, tribun: 282225436,
  studentCenter: 1480014538, rusunawa: 327366048, fhPanam: 327366046, parkirStadionMini: 938379741, parkirRusunawa: 938379740,
});

export const OSM_LATLON = Object.freeze({
  /** "Sekretariat Lembaga Mahasiswa", building=yes (tanpa levels). Urutan A,B,C,D: AB & DC = sisi panjang. */
  sekretariat: ring([[0.4737457, 101.387508], [0.4736962, 101.3876504], [0.4735633, 101.3876042], [0.4736128, 101.3874618]]),
  /** "Stadion Mini UNRI", leisure=stadium, capacity:persons=5000. */
  stadionMini: ring([
    [0.4743575, 101.3868932], [0.4755923, 101.3868939], [0.4756492, 101.3869164], [0.4756889, 101.3869455],
    [0.4757215, 101.386975], [0.4757503, 101.3870048], [0.4758159, 101.3870824], [0.4758362, 101.3871217],
    [0.4758536, 101.3871648], [0.4758653, 101.3872011], [0.4758829, 101.387272], [0.4758898, 101.3873248],
    [0.4758912, 101.3873933], [0.4758891, 101.3874652], [0.4758809, 101.3875186], [0.4758639, 101.3875691],
    [0.4758421, 101.3876147], [0.4758092, 101.387652], [0.4757714, 101.3876989], [0.4757203, 101.3877558],
    [0.4756699, 101.3878081], [0.4756244, 101.3878459], [0.4755575, 101.3878769], [0.47551, 101.3878962],
    [0.4753978, 101.3879331], [0.4752989, 101.3879622], [0.4751962, 101.3879854], [0.4751207, 101.387999],
    [0.475041, 101.3879992], [0.4749596, 101.3879982], [0.4748516, 101.3879931], [0.4747858, 101.3879903],
    [0.4747228, 101.3879835], [0.4746611, 101.3879712], [0.4745791, 101.3879471], [0.4744802, 101.3879161],
    [0.4743776, 101.3878774], [0.4743258, 101.3878481], [0.4742861, 101.3878181], [0.4742425, 101.3877832],
    [0.4742117, 101.3877537], [0.4741778, 101.3877101], [0.4741429, 101.3876529], [0.4741129, 101.3876074],
    [0.4740906, 101.3875318], [0.4740751, 101.3874572], [0.4740674, 101.3873855], [0.4740674, 101.3873003],
    [0.4740895, 101.3872167], [0.474105, 101.3871634], [0.4741476, 101.3870937], [0.4741873, 101.3870481],
    [0.4742368, 101.3869949], [0.4742959, 101.3869474],
  ]),
  /** leisure=pitch, sport=soccer. */
  lapangan: ring([[0.4754756, 101.3870963], [0.4754712, 101.3877829], [0.4744606, 101.3877765], [0.474465, 101.3870898]]),
  /** "tribun stadion", building=yes, levels=7, capacity 500. Indeks 3-4-5-6 = batang utama, 0-1-2-7 = tonjolan VIP barat. */
  tribun: ring([
    [0.4747484, 101.3866669], [0.475219, 101.3866671], [0.475219, 101.3867193], [0.4755925, 101.3867195],
    [0.4755923, 101.3868939], [0.4743575, 101.3868932], [0.4743576, 101.3867243], [0.4747483, 101.3867245],
  ]),
  /** building=yes tanpa nama; kandidat Gedung Serba Guna / Student Center ADB ([S], riset §2). */
  studentCenter: ring([[0.4756607, 101.3886658], [0.4761207, 101.3886666], [0.4761199, 101.3891446], [0.4756599, 101.3891438]]),
  /** "Rumah susun mahasiswa UNRI", building=apartments, levels=5. */
  rusunawa: ring([[0.4762209, 101.389786], [0.4762141, 101.3904025], [0.4760137, 101.3904003], [0.476017, 101.3901027], [0.4760205, 101.3897838]]),
  /** "Gedung Fakultas Hukum Universitas Riau", levels=3, roof tin; bentuk U. */
  fhPanam: ring([
    [0.4783074, 101.3886045], [0.4780737, 101.3886065], [0.4780792, 101.3892423], [0.4783192, 101.3892402],
    [0.478318, 101.3891045], [0.4781884, 101.3891056], [0.4781851, 101.388725], [0.4783084, 101.3887239],
  ]),
  /** amenity=parking, barat laut sekretariat (sisi barat stadion mini). */
  parkirStadionMini: ring([
    [0.4747965, 101.3862441], [0.4748314, 101.3866304], [0.4746973, 101.3866438], [0.4746973, 101.3867041],
    [0.4743285, 101.3867041], [0.4741971, 101.386515], [0.4744251, 101.3863541], [0.474653, 101.3862602],
  ]),
  /** amenity=parking, utara Rusunawa. */
  parkirRusunawa: ring([[0.4764514, 101.3896911], [0.4764212, 101.3904549], [0.47622, 101.3904469], [0.4762503, 101.3896831]]),
});
```

- [ ] **Langkah 4: Buat `placement.js`**

```js
/**
 * Placement region "unri-lembaga" dan sub-frame bangunan hero (murni). Origin region = pusat Sekretariat
 * Lembaga Mahasiswa, yaw 0: koordinat region-lokal = dunia − origin (utara = −Z). Bangunan hero punya
 * sub-frame {x, z, yaw} region-lokal sendiri yang diturunkan dari footprint OSM saat modul dimuat.
 */
import { WORLD_ORIGIN } from '../../config/constants.js';
import { createProjection } from '../../geo/projection.js';
import { placementFromFootprint } from '../../geo/placement.js';
import { toLocal, toWorld } from '../../geo/regionTransform.js';
import { OSM_LATLON } from './footprints.js';

const projection = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });
const project = (ring) => Object.freeze(ring.map(([lat, lon]) => {
  const w = projection.toWorld(lat, lon);
  return Object.freeze([w.x, w.z]);
}));

/** Footprint OSM dalam koordinat DUNIA. */
export const FOOTPRINTS_WORLD = Object.freeze(Object.fromEntries(
  Object.entries(OSM_LATLON).map(([key, ring]) => [key, project(ring)]),
));

/** Placement region (beku, dibulatkan 1 cm; tes memastikan = pusat footprint sekretariat). */
export const LEMBAGA_PLACEMENT = Object.freeze({ x: -219.47, z: 1099.21, yaw: 0 });

/** Dunia → region-lokal [lx, lz]. */
export function toRegion(x, z) {
  const l = toLocal(LEMBAGA_PLACEMENT, x, z);
  return [Number(l.x.toFixed(6)) + 0, Number(l.z.toFixed(6)) + 0];
}

/** Region-lokal → dunia {x, z}. */
export const regionToWorld = (lx, lz) => toWorld(LEMBAGA_PLACEMENT, lx, lz);

const ringToRegion = (ring) => Object.freeze(ring.map(([x, z]) => Object.freeze(toRegion(x, z))));

/** Footprint OSM dalam koordinat REGION-LOKAL. */
export const FOOTPRINTS = Object.freeze(Object.fromEntries(
  Object.entries(FOOTPRINTS_WORLD).map(([key, ring]) => [key, ringToRegion(ring)]),
));

/**
 * Sub-frame sekretariat: sumbu panjang = rerata tepi AB & DC (+Z lokal-gedung), pusat = rerata 4 sudut.
 * @param {ReadonlyArray<readonly [number, number]>} ring region-lokal, urutan A,B,C,D OSM
 */
export function sekretariatFrame(ring = FOOTPRINTS.sekretariat) {
  const [a, b, c, d] = ring;
  const dx = (b[0] - a[0] + c[0] - d[0]) / 2;
  const dz = (b[1] - a[1] + c[1] - d[1]) / 2;
  const width = (Math.hypot(c[0] - b[0], c[1] - b[1]) + Math.hypot(a[0] - d[0], a[1] - d[1])) / 2;
  return {
    frame: Object.freeze({ x: (a[0] + b[0] + c[0] + d[0]) / 4, z: (a[1] + b[1] + c[1] + d[1]) / 4, yaw: Math.atan2(dx, dz) }),
    size: Object.freeze({ length: Math.hypot(dx, dz), width }),
  };
}

const sek = sekretariatFrame();
/** Sub-frame sekretariat (region-lokal): +Z lokal-gedung = sumbu panjang (ESE), +X = NNE. */
export const SEKRE_FRAME = sek.frame;
/** Ukuran footprint OSM: length = sisi panjang (Z lokal-gedung), width = sisi pendek (X lokal-gedung). */
export const SEKRE_SIZE = sek.size;

/** Lokal-gedung sekretariat → region-lokal {x, z}. */
export const fromSekre = (bx, bz) => toWorld(SEKRE_FRAME, bx, bz);
/** Region-lokal → lokal-gedung sekretariat {x, z}. */
export const toSekre = (lx, lz) => toLocal(SEKRE_FRAME, lx, lz);

/** Sub-frame lapangan stadion mini (sumbu panjang = +Z, ±U–S). */
export const PITCH_FRAME = Object.freeze(placementFromFootprint(FOOTPRINTS.lapangan));

/** Jarak bertanda titik p dari garis a→b. */
const sideDistance = (p, a, b) => {
  const ux = b[0] - a[0];
  const uz = b[1] - a[1];
  const len = Math.hypot(ux, uz);
  return ((p[0] - a[0]) * uz - (p[1] - a[1]) * ux) / len;
};

/**
 * Tribun stadion mini (way 282225436): frame di tengah batang utama, +Z sepanjang muka timur (utara→selatan),
 * +X ke timur (lapangan). Muka barat batang OSM miring 0,5 m → dirata-rata menjadi x = −depth/2.
 * VIP = tonjolan barat (indeks 0,1 = muka barat VIP; menempel di x = −depth/2). Ukuran dalam frame tribun.
 * @param {ReadonlyArray<readonly [number, number]>} ring region-lokal
 */
export function deriveTribun(ring = FOOTPRINTS.tribun) {
  const [v0, v1, v2, v3, v4, v5, v6, v7] = ring;
  const depth = (Math.abs(sideDistance(v3, v4, v5)) + Math.abs(sideDistance(v6, v4, v5))) / 2;
  const cx = (v3[0] + v4[0] + v5[0] + v6[0]) / 4;
  const cz = (v3[1] + v4[1] + v5[1] + v6[1]) / 4;
  const frame = Object.freeze({ x: cx, z: cz, yaw: Math.atan2(v5[0] - v4[0], v5[1] - v4[1]) });
  const loc = (p) => toLocal(frame, p[0], p[1]);
  const west = [v0, v1].map(loc);
  const ends = [v0, v1, v2, v7].map(loc);
  return Object.freeze({
    frame,
    length: Math.hypot(v5[0] - v4[0], v5[1] - v4[1]),
    depth,
    vip: Object.freeze({
      x0: (west[0].x + west[1].x) / 2, x1: -depth / 2,
      z0: Math.min(...ends.map((p) => p.z)), z1: Math.max(...ends.map((p) => p.z)),
    }),
  });
}

export const TRIBUN = deriveTribun();
```

- [ ] **Langkah 5: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/lembagaGeometry.test.js`
Expected: PASS (6 tes).

- [ ] **Langkah 6: Commit**

```bash
git add src/regions/unri-lembaga/footprints.js src/regions/unri-lembaga/placement.js tests/unri/lembagaGeometry.test.js
```
```bash
git commit -m "feat(lembaga): footprint OSM beku, placement region & sub-frame sekretariat/lapangan/tribun"
```

---

## Task 2: Mask, aktivasi, dan pad region (TDD)

**Files:**
- Create: `src/regions/unri-lembaga/mask.js`, `src/regions/unri-lembaga/pads.js`
- Test: `tests/unri/lembagaGeometry.test.js` (tambah blok)

- [ ] **Langkah 1: Tambah tes yang gagal**

Tambahkan impor ini ke blok impor teratas `tests/unri/lembagaGeometry.test.js`:
```js
import { LEMBAGA_MASK, LEMBAGA_MASK_WORLD, LEMBAGA_ACTIVATION } from '../../src/regions/unri-lembaga/mask.js';
import { LEMBAGA_PADS, lembagaPadsWorld } from '../../src/regions/unri-lembaga/pads.js';
import { stadionMaskWorld } from '../../src/regions/stadion/mask.js';
import { UNRI_BOUNDARY } from '../../src/districts/unri/boundary.js';
import { pointInPolygon, signedArea, ringBounds } from '../../src/geo/polygon.js';
```
lalu lampirkan ke akhir file:
```js
/** Titik sampel tiap `step` m di sepanjang tepi ring tertutup. */
function edgeSamples(ring, step = 2) {
  const out = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k += 1) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  });
  return out;
}

function segmentsCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

describe('mask & aktivasi region Lembaga', () => {
  it('ring positif 18 titik, lokal = dunia − origin', () => {
    expect(LEMBAGA_MASK_WORLD).toHaveLength(18);
    expect(signedArea(LEMBAGA_MASK_WORLD)).toBeGreaterThan(190000);
    expect(LEMBAGA_MASK[0][0]).toBeCloseTo(-415 + 219.47, 6);
    expect(LEMBAGA_MASK[0][1]).toBeCloseTo(690 - 1099.21, 6);
  });

  it('memuat seluruh simpul 5 gedung OSM zona ini dan kedua parkir', () => {
    for (const key of ['sekretariat', 'stadionMini', 'tribun', 'studentCenter', 'rusunawa', 'fhPanam', 'parkirStadionMini', 'parkirRusunawa']) {
      for (const [x, z] of FOOTPRINTS[key]) expect(pointInPolygon(x, z, LEMBAGA_MASK), `${key} (${x},${z})`).toBe(true);
    }
  });

  it('tidak beririsan dengan mask stadion (tanpa titik di dalam, tanpa tepi bersilang)', () => {
    const stadion = stadionMaskWorld();
    for (const [x, z] of LEMBAGA_MASK_WORLD) expect(pointInPolygon(x, z, stadion)).toBe(false);
    for (const [x, z] of stadion) expect(pointInPolygon(x, z, LEMBAGA_MASK_WORLD)).toBe(false);
    LEMBAGA_MASK_WORLD.forEach((a, i) => {
      const b = LEMBAGA_MASK_WORLD[(i + 1) % LEMBAGA_MASK_WORLD.length];
      stadion.forEach((c, j) => expect(segmentsCross(a, b, c, stadion[(j + 1) % stadion.length])).toBe(false));
    });
  });

  it('seluruh tepi mask di dalam batas distrik UNRI', () => {
    for (const [x, z] of edgeSamples(LEMBAGA_MASK_WORLD)) expect(pointInPolygon(x, z, UNRI_BOUNDARY), `(${x},${z})`).toBe(true);
  });

  it('aktivasi: mask jauh di dalam radius pasang, histeresis 200 m, spawn stadion di luar', () => {
    const { center, mountRadius, unmountRadius } = LEMBAGA_ACTIVATION;
    const far = Math.max(...LEMBAGA_MASK_WORLD.map(([x, z]) => Math.hypot(x - center.x, z - center.z)));
    expect(far + 300).toBeLessThan(mountRadius);
    expect(unmountRadius - mountRadius).toBe(200);
    expect(Math.hypot(0 - center.x, -275 - center.z)).toBeGreaterThan(unmountRadius);
  });
});

describe('pad terrain region Lembaga', () => {
  it('tiga pad (sekretariat, stadion-mini, student-center) median, di dalam mask', () => {
    expect(LEMBAGA_PADS.map((p) => p.id)).toEqual(['sekretariat', 'stadion-mini', 'student-center']);
    for (const pad of LEMBAGA_PADS) {
      expect(pad.y).toBe('median');
      for (const [x, z] of pad.ring) expect(pointInPolygon(x, z, LEMBAGA_MASK)).toBe(true);
    }
  });

  it('pad memuat footprint gedungnya dan tidak saling tumpang', () => {
    const byId = Object.fromEntries(LEMBAGA_PADS.map((p) => [p.id, p.ring]));
    const contains = (ring, pts) => pts.every(([x, z]) => pointInPolygon(x, z, ring));
    expect(contains(byId.sekretariat, FOOTPRINTS.sekretariat)).toBe(true);
    expect(contains(byId['stadion-mini'], FOOTPRINTS.lapangan)).toBe(true);
    expect(contains(byId['stadion-mini'], FOOTPRINTS.tribun)).toBe(true);
    expect(contains(byId['student-center'], FOOTPRINTS.studentCenter)).toBe(true);
    const bs = LEMBAGA_PADS.map((p) => ringBounds(p.ring));
    for (let i = 0; i < bs.length; i += 1) {
      for (let j = i + 1; j < bs.length; j += 1) {
        const o = bs[i].minX < bs[j].maxX && bs[i].maxX > bs[j].minX && bs[i].minZ < bs[j].maxZ && bs[i].maxZ > bs[j].minZ;
        expect(o, `${LEMBAGA_PADS[i].id} × ${LEMBAGA_PADS[j].id}`).toBe(false);
      }
    }
  });

  it('lembagaPadsWorld = pad lokal + origin', () => {
    const w = lembagaPadsWorld();
    expect(w[0].ring[0][0]).toBeCloseTo(LEMBAGA_PADS[0].ring[0][0] - 219.47, 6);
    expect(w[0].ring[0][1]).toBeCloseTo(LEMBAGA_PADS[0].ring[0][1] + 1099.21, 6);
  });
});
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/lembagaGeometry.test.js`
Expected: FAIL — `Failed to resolve import "../../src/regions/unri-lembaga/mask.js"`.

- [ ] **Langkah 3: Buat `mask.js`**

```js
/**
 * Mask region "unri-lembaga" (beku, koordinat DUNIA) — SATU sumber untuk collider komposit, regionManager,
 * dan tes. Batas: utara z 690 (Jl. Muchtar Lutfi lajur ganda z 694–733 ikut di dalam), taji FH x −112…−20
 * sampai z 568, timur x 110 (parkir rusunawa ≤ 103), selatan/tenggara = batas kampus OSM way 938374562
 * di-inset 6 m (di dalam UNRI_BOUNDARY yang disederhanakan 5 m), barat x −415 (jogging track ≥ −407,5).
 * Tidak beririsan dengan mask stadion (berakhir di z +322).
 */
import { toRegion } from './placement.js';

const freeze = (pts) => Object.freeze(pts.map((p) => Object.freeze(p)));

export const LEMBAGA_MASK_WORLD = freeze([
  [-415, 690], [-112, 690], [-112, 568], [-20, 568], [-20, 690], [110, 690], [110, 860.3],
  [-47.5, 896.2], [-43.3, 950.1], [-69.3, 958.5], [-67.6, 1020.9], [-122.5, 1026.6], [-114.4, 1090.3],
  [-132.6, 1093], [-130.5, 1106.2], [-243.8, 1125.7], [-324.1, 1137.7], [-415, 1131.3],
]);

/** Mask region-lokal (dipakai defineRegion). */
export const LEMBAGA_MASK = freeze(LEMBAGA_MASK_WORLD.map(([x, z]) => toRegion(x, z)));

/** Salinan dunia (untuk alat bake/diagnostik). */
export function lembagaMaskWorld() {
  return LEMBAGA_MASK_WORLD.map(([x, z]) => [x, z]);
}

/**
 * Aktivasi streaming region (spec §4.3): pusat dunia = pusat bbox mask; titik mask terjauh 383 m.
 * Spawn stadion (0, −275) berjarak 1.135 m → tidak terpasang saat mulai.
 */
export const LEMBAGA_ACTIVATION = Object.freeze({ center: Object.freeze({ x: -152, z: 853 }), mountRadius: 700, unmountRadius: 900 });
```

- [ ] **Langkah 4: Buat `pads.js`**

```js
/**
 * Pad terrain hero (spec §4.3 `pads`, §5.2 langkah 7): campusbake meratakan terrain di dalam ring ke
 * median tanah (blend 4 m). Ring region-lokal; `lembagaPadsWorld()` untuk tools/campusbake/config.js.
 */
import { convexHull, ringBounds } from '../../geo/polygon.js';
import { toWorld } from '../../geo/regionTransform.js';
import { FOOTPRINTS, LEMBAGA_PLACEMENT, fromSekre, SEKRE_SIZE } from './placement.js';

/** Margin pad sekretariat dari dinding (m): sisi panjang 5 (motor parkir + pagar), ujung selasar 6 (teras). */
export const SEKRE_PAD_MARGIN = Object.freeze({ x: 5, z: 6 });
const SC_PAD_MARGIN = 6;

const freeze = (pts) => Object.freeze(pts.map(([x, z]) => Object.freeze([x, z])));

function sekretariatPad() {
  const hx = SEKRE_SIZE.width / 2 + SEKRE_PAD_MARGIN.x;
  const hz = SEKRE_SIZE.length / 2 + SEKRE_PAD_MARGIN.z;
  return freeze([[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([bx, bz]) => {
    const p = fromSekre(bx, bz);
    return [p.x, p.z];
  }));
}

function rectAround(ring, m) {
  const b = ringBounds(ring);
  return freeze([[b.minX - m, b.minZ - m], [b.maxX + m, b.minZ - m], [b.maxX + m, b.maxZ + m], [b.minX - m, b.maxZ + m]]);
}

export const LEMBAGA_PADS = Object.freeze([
  Object.freeze({ id: 'sekretariat', ring: sekretariatPad(), y: 'median' }),
  Object.freeze({ id: 'stadion-mini', ring: freeze(convexHull([...FOOTPRINTS.stadionMini, ...FOOTPRINTS.tribun])), y: 'median' }),
  Object.freeze({ id: 'student-center', ring: rectAround(FOOTPRINTS.studentCenter, SC_PAD_MARGIN), y: 'median' }),
]);

/** Pad dalam koordinat DUNIA (dipakai tools/campusbake/config.js). */
export function lembagaPadsWorld(placement = LEMBAGA_PLACEMENT, pads = LEMBAGA_PADS) {
  return pads.map((p) => ({
    id: `unri-lembaga:${p.id}`,
    y: p.y,
    ring: p.ring.map(([x, z]) => {
      const w = toWorld(placement, x, z);
      return [w.x, w.z];
    }),
  }));
}
```
Catatan: bila Task 0/A1 menemukan validator pad menolak field `id`, hapus `id` dari ketiga objek dan ubah tes pertama blok pad menjadi `expect(LEMBAGA_PADS).toHaveLength(3)`.

- [ ] **Langkah 5: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/lembagaGeometry.test.js`
Expected: PASS (14 tes).

- [ ] **Langkah 6: Commit**

```bash
git add src/regions/unri-lembaga/mask.js src/regions/unri-lembaga/pads.js tests/unri/lembagaGeometry.test.js
```
```bash
git commit -m "feat(lembaga): mask region dari jalan & batas kampus, aktivasi streaming, pad terrain hero"
```

---

## Task 3: Pad region ke campusbake + bake ulang terrain

**Files:**
- Modify: `tools/campusbake/config.js`
- Modify (hasil bake): `public/districts/unri/terrain/*.bin`, `public/districts/unri/manifest.json` (bila berubah)
- Modify: tes golden campusbake (nama dari catatan A6)

- [ ] **Langkah 1: Sambungkan pad**

Di `tools/campusbake/config.js` tambahkan impor di blok impor teratas:
```js
import { lembagaPadsWorld } from '../../src/regions/unri-lembaga/pads.js';
```
dan ganti definisi pad region yang dibuat M1 (nama dari catatan A6; contoh `REGION_PADS`) menjadi:
```js
/** Pad hero region (spec §3.2): ring DUNIA {id, ring, y:'median'|number}. M6 menambah pad unri-rektorat. */
export const REGION_PADS = Object.freeze([...lembagaPadsWorld()]);
```
Bila M1 belum punya ekspor pad region sama sekali, buat konstanta di atas lalu di `tools/campusbake/index.js` gabungkan `REGION_PADS` ke daftar ring yang diteruskan ke langkah pad (`terrain/pads.js`) tepat sebelum pemanggilannya: `const pads = [...footprintPads, ...REGION_PADS];` (nama variabel footprint mengikuti kode M1).

- [ ] **Langkah 2: Bake ulang terrain dari cache**

Run: `npm run bake:campus -- terrain --offline`
Expected: laporan bake memuat 3 pad `unri-lembaga:*`, jumlah chunk sama seperti sebelumnya, tanpa galat. Cek perubahan:
```bash
git status --short public/districts/unri
```
Expected: beberapa `terrain/<ix>_<iz>.bin` yang memuat x −400…+0, z 800…1150 (dunia) berubah.

- [ ] **Langkah 3: Perbarui golden**

Run: `node node_modules/vitest/vitest.mjs run tests/campusbake`
Expected: tes golden FAIL karena hash berubah (disengaja: pad baru). Perbarui hash/snapshot di file golden (catatan A6) dengan nilai baru yang dicetak tes, tambahkan komentar `// M4: pad unri-lembaga (sekretariat, stadion-mini, student-center)`. Jalankan ulang → PASS. Jalankan bake sekali lagi lalu `git status --short public/districts/unri` → tidak ada perubahan tambahan (determinisme).

- [ ] **Langkah 4: Commit**

```bash
git add tools/campusbake/config.js tools/campusbake/index.js public/districts/unri tests/campusbake
```
```bash
git commit -m "feat(campusbake): pad terrain region unri-lembaga + bake ulang chunk terkait"
```

---

## Task 4: Data deret sekre (BEM, DPM, 6 ormawa) + validator (TDD)

**Files:**
- Create: `src/regions/unri-lembaga/sekre.data.js`
- Test: `tests/unri/sekreData.test.js`

- [ ] **Langkah 1: Tulis tes yang gagal**

`tests/unri/sekreData.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  sekreRooms, validateSekreRooms, SEKRE_ORMAWA, BEM, DPM, PLAYER_ROOM_INDEX,
} from '../../src/regions/unri-lembaga/sekre.data.js';

describe('deret Sekretariat Lembaga Mahasiswa', () => {
  it('default valid: 8 ruang, BEM indeks 0, DPM indeks 4, pemain indeks 1 di sebelah BEM', () => {
    const rooms = sekreRooms();
    expect(validateSekreRooms(rooms)).toEqual([]);
    expect(rooms).toHaveLength(8);
    expect(rooms[0].nama).toBe('BEM UNIVERSITAS RIAU');
    expect(rooms[4].nama).toBe('DPM');
    expect(PLAYER_ROOM_INDEX).toBe(1);
    expect(rooms[1].pemain).toBe(true);
    expect(rooms.filter((r) => r.pemain)).toHaveLength(1);
    expect(rooms.map((r) => r.row)).toEqual(['U', 'U', 'U', 'U', 'S', 'S', 'S', 'S']);
    expect(rooms.map((r) => r.col)).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
  });

  it('6 nama dari data ormawa terpakai tepat sekali, semua nama unik dan kapital', () => {
    const rooms = sekreRooms();
    const names = rooms.map((r) => r.nama);
    expect(new Set(names).size).toBe(8);
    for (const o of SEKRE_ORMAWA) expect(names.filter((n) => n === o.nama)).toHaveLength(1);
    for (const n of names) expect(n).toBe(n.toUpperCase());
    expect([BEM.nama, DPM.nama].every((n) => names.includes(n))).toBe(true);
  });

  it('pemain tidak bersebelahan dengan BEM → galat', () => {
    const errs = validateSekreRooms(sekreRooms({ player: 3 }));
    expect(errs.join(' ')).toMatch(/bersebelahan/);
  });

  it('dua ruang pemain → galat; ormawa kurang → ruang kosong', () => {
    const dua = SEKRE_ORMAWA.map((o, i) => (i === 2 ? { ...o, pemain: true } : o));
    expect(validateSekreRooms(sekreRooms({ ormawa: dua })).join(' ')).toMatch(/pemain/);
    expect(validateSekreRooms(sekreRooms({ ormawa: SEKRE_ORMAWA.slice(0, 5) })).join(' ')).toMatch(/kosong/);
  });
});
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/sekreData.test.js`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Langkah 3: Buat `sekre.data.js`**

```js
/**
 * Isi deret Sekretariat Lembaga Mahasiswa (way 327530276): 8 ruang, 2 baris × 4. Indeks 0–3 = baris U (NNE,
 * menghadap jogging track) dari barat, 4–7 = baris S. BEM & DPM tetap; 6 ormawa di bawah = DEFAULT GENERIK
 * [INFERENSI] — ganti nama/warna sesuai ormawa asli (spec §13 butir 2). Ruang `pemain: true` = pintu portal
 * interior 'sekre' dan wajib bersebelahan dengan BEM (spec §8.1; "sekre gw dekat BEM").
 * Warna = hex (latar & teks papan nama N06, cat pintu).
 */
export const SEKRE_SUMBER = Object.freeze({
  denah: '[INFERENSI] 2 × 4 ruang dari footprint OSM 16,77 × 15,57 m',
  bem: '[INFERENSI] lokasi sekretariat BEM UNRI tidak ditemukan di sumber (riset §3, GAP); diasumsikan di deret ini',
  ormawa: '[INFERENSI] nama default generik, bukan data UNRI',
});

export const ROOM_COUNT = 8;
export const ROOMS_PER_ROW = 4;
export const BEM_ROOM_INDEX = 0;
export const DPM_ROOM_INDEX = 4;
export const PLAYER_ROOM_INDEX = 1;
const MAX_NAME = 32;

export const BEM = Object.freeze({ nama: 'BEM UNIVERSITAS RIAU', sub: 'BADAN EKSEKUTIF MAHASISWA', latar: 0x0d3b66, teks: 0xffffff, pintu: 0x2f5f9e });
export const DPM = Object.freeze({ nama: 'DPM', sub: 'DEWAN PERWAKILAN MAHASISWA UNIVERSITAS RIAU', latar: 0x7a1f24, teks: 0xffffff, pintu: 0x7d3a2e });

export const SEKRE_ORMAWA = Object.freeze([
  Object.freeze({ nama: 'UKM SENI', sub: 'SEKRETARIAT', latar: 0x2b2b2b, teks: 0xf2c200, pintu: 0x6b4a2f, pemain: true }),
  Object.freeze({ nama: 'UKM OLAHRAGA', sub: 'SEKRETARIAT', latar: 0x1f6f43, teks: 0xffffff, pintu: 0x2e6e4e }),
  Object.freeze({ nama: 'UKM KEROHANIAN', sub: 'SEKRETARIAT', latar: 0x0f5132, teks: 0xffffff, pintu: 0x8a6a3a }),
  Object.freeze({ nama: 'UKM PERS MAHASISWA', sub: 'SEKRETARIAT', latar: 0xf4f1ea, teks: 0x1b1b1b, pintu: 0x4b5563 }),
  Object.freeze({ nama: 'UKM PECINTA ALAM', sub: 'SEKRETARIAT', latar: 0x3f5a2a, teks: 0xffe9a8, pintu: 0x5d4a2a }),
  Object.freeze({ nama: 'UKM KEWIRAUSAHAAN', sub: 'SEKRETARIAT', latar: 0xb45309, teks: 0xffffff, pintu: 0x9a5b2c }),
]);

/**
 * 8 ruang terurut indeks. BEM/DPM di indeksnya; ormawa `pemain` di `player`; sisanya mengisi slot kosong
 * berurutan. Slot yang tidak terisi = null (dilaporkan validateSekreRooms).
 */
export function sekreRooms({ ormawa = SEKRE_ORMAWA, bem = BEM_ROOM_INDEX, dpm = DPM_ROOM_INDEX, player = PLAYER_ROOM_INDEX } = {}) {
  const slots = new Array(ROOM_COUNT).fill(null);
  slots[bem] = { ...BEM, peran: 'bem' };
  slots[dpm] = { ...DPM, peran: 'dpm' };
  const pemain = ormawa.find((o) => o.pemain);
  if (pemain && slots[player] === null) slots[player] = { ...pemain, peran: 'ormawa' };
  const rest = ormawa.filter((o) => o !== pemain);
  let k = 0;
  for (let i = 0; i < ROOM_COUNT; i += 1) {
    if (slots[i] === null && k < rest.length) {
      slots[i] = { ...rest[k], peran: 'ormawa' };
      k += 1;
    }
  }
  return Object.freeze(slots.map((s, index) => (s ? Object.freeze({
    ...s, index, row: index < ROOMS_PER_ROW ? 'U' : 'S', col: index % ROOMS_PER_ROW, pemain: Boolean(s.pemain),
  }) : null)));
}

const isColor = (v) => Number.isInteger(v) && v >= 0 && v <= 0xffffff;

/** Daftar galat (kosong = valid). */
export function validateSekreRooms(rooms) {
  const errs = [];
  if (!Array.isArray(rooms) || rooms.length !== ROOM_COUNT) return [`harus ${ROOM_COUNT} ruang`];
  rooms.forEach((r, i) => {
    if (!r) {
      errs.push(`ruang ${i} kosong (tambah ormawa di SEKRE_ORMAWA)`);
      return;
    }
    if (typeof r.nama !== 'string' || r.nama.trim() === '' || r.nama.length > MAX_NAME) errs.push(`ruang ${i}: nama 1–${MAX_NAME} huruf`);
    else if (r.nama !== r.nama.toUpperCase()) errs.push(`ruang ${i}: nama harus kapital`);
    if (![r.latar, r.teks, r.pintu].every(isColor)) errs.push(`ruang ${i}: warna latar/teks/pintu harus hex 0..0xffffff`);
  });
  const filled = rooms.filter(Boolean);
  const pemain = filled.filter((r) => r.pemain);
  if (pemain.length !== 1) errs.push(`harus tepat satu ruang pemain (ada ${pemain.length})`);
  const bem = filled.filter((r) => r.peran === 'bem');
  if (bem.length !== 1 || filled.filter((r) => r.peran === 'dpm').length !== 1) errs.push('harus tepat satu BEM dan satu DPM');
  if (pemain.length === 1 && bem.length === 1) {
    const [p] = pemain;
    const [b] = bem;
    if (p.row !== b.row || Math.abs(p.col - b.col) !== 1) errs.push(`ruang pemain (indeks ${p.index}) harus bersebelahan dengan BEM (indeks ${b.index}) di baris yang sama`);
  }
  return errs;
}
```

- [ ] **Langkah 4: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/sekreData.test.js`
Expected: PASS (4 tes).

- [ ] **Langkah 5: Commit**

```bash
git add src/regions/unri-lembaga/sekre.data.js tests/unri/sekreData.test.js
```
```bash
git commit -m "feat(lembaga): data deret sekre (BEM, DPM, 6 ormawa generik) + validator sekre pemain di sebelah BEM"
```

---

## Task 5: Layout murni zona Lembaga — denah sekretariat, titik props, baris motor (TDD)

**Files:**
- Modify: `src/regions/unri-lembaga/placement.js` (tambah `UNRI_LEMBAGA_ID`)
- Create: `src/regions/unri-lembaga/layout.js`
- Test: `tests/unri/lembagaLayout.test.js`

- [ ] **Langkah 1: Tambah id region di `placement.js`** (di bawah blok impor)

```js
/** Id region (satu sumber; index.js, portalDoors.js, cerita). */
export const UNRI_LEMBAGA_ID = 'unri-lembaga';
```

- [ ] **Langkah 2: Tulis tes yang gagal**

`tests/unri/lembagaLayout.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  SEKRE_DIM, roomInfo, layoutMotorRows, sekreTerasLayout, LEMBAGA_LAYOUT, faceToward,
} from '../../src/regions/unri-lembaga/layout.js';
import { FOOTPRINTS, toSekre } from '../../src/regions/unri-lembaga/placement.js';
import { LEMBAGA_PADS } from '../../src/regions/unri-lembaga/pads.js';
import { LEMBAGA_MASK } from '../../src/regions/unri-lembaga/mask.js';
import { pointInPolygon, distanceToRing } from '../../src/geo/polygon.js';

const minPairDistance = (pts) => {
  let best = Infinity;
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) best = Math.min(best, Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z));
  }
  return best;
};

describe('denah sekretariat', () => {
  it('ruang 4,192 × 5,935 m, selasar 3,7 m, pintu & jendela di dalam ruangnya', () => {
    expect(SEKRE_DIM.roomLen).toBeCloseTo(4.1924, 3);
    expect(SEKRE_DIM.hx - SEKRE_DIM.corridorHalf).toBeCloseTo(5.935, 2);
    for (let i = 0; i < 8; i += 1) {
      const r = roomInfo(i);
      expect(r.doorZ - SEKRE_DIM.door.w / 2).toBeGreaterThan(r.z0);
      expect(r.winZ + SEKRE_DIM.winCorr.w / 2).toBeLessThan(r.z1);
      expect(r.doorZ + SEKRE_DIM.door.w / 2).toBeLessThan(r.winZ - SEKRE_DIM.winCorr.w / 2);
    }
    expect(roomInfo(0).side).toBe(1);
    expect(roomInfo(4).side).toBe(-1);
    expect(roomInfo(1).doorZ).toBeCloseTo(-3.2424, 3);
  });

  it('faceToward: muka −Z prop menghadap arah yang diminta', () => {
    const f = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
    for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [x, z] = f(faceToward(fx, fz));
      expect(x).toBeCloseTo(fx, 9);
      expect(z).toBeCloseTo(fz, 9);
    }
  });
});

describe('layoutMotorRows', () => {
  const ring = FOOTPRINTS.parkirStadionMini;
  const a = layoutMotorRows(ring, { seed: 41, fill: 0.35 });

  it('motor di dalam lot ≥ 1 m dari tepi, tidak saling tumpang, jumlah wajar', () => {
    expect(a.motors.length).toBeGreaterThan(150);
    expect(a.motors.length).toBeLessThan(400);
    for (const m of a.motors) {
      expect(pointInPolygon(m.x, m.z, ring)).toBe(true);
      expect(distanceToRing(m.x, m.z, ring)).toBeGreaterThan(1.0);
    }
    expect(minPairDistance(a.motors)).toBeGreaterThan(0.79);
  });

  it('deterministik per seed; fill mengatur kepadatan', () => {
    expect(layoutMotorRows(ring, { seed: 41, fill: 0.35 })).toEqual(a);
    const full = layoutMotorRows(ring, { seed: 41, fill: 1 });
    const ratio = a.motors.length / full.motors.length;
    expect(ratio).toBeGreaterThan(0.25);
    expect(ratio).toBeLessThan(0.45);
    expect(full.rows.length).toBe(a.rows.length);
  });

  it('baris (kapsul collider) menutupi semua motor', () => {
    for (const m of a.motors) {
      const covered = a.rows.some((r) => {
        const dx = r.b[0] - r.a[0];
        const dz = r.b[1] - r.a[1];
        const t = Math.max(0, Math.min(1, ((m.x - r.a[0]) * dx + (m.z - r.a[1]) * dz) / (dx * dx + dz * dz || 1)));
        return Math.hypot(m.x - (r.a[0] + dx * t), m.z - (r.a[1] + dz * t)) <= r.r + 1e-6;
      });
      expect(covered).toBe(true);
    }
  });
});

describe('layout teras & zona', () => {
  const t = sekreTerasLayout();

  it('motor sekre di luar gedung, di dalam pad, mulut selasar bebas', () => {
    const pad = LEMBAGA_PADS.find((p) => p.id === 'sekretariat').ring;
    expect(t.motors.length).toBeGreaterThan(14);
    for (const m of t.motors) {
      expect(pointInPolygon(m.x, m.z, FOOTPRINTS.sekretariat)).toBe(false);
      expect(pointInPolygon(m.x, m.z, pad)).toBe(true);
      const b = toSekre(m.x, m.z);
      if (Math.abs(b.z) > SEKRE_DIM.hz) expect(Math.abs(b.x)).toBeGreaterThan(SEKRE_DIM.corridorHalf + 0.5);
    }
  });

  it('props selasar menyisakan lajur tengah ≥ 2,3 m', () => {
    for (const p of [...t.racks, ...t.sandals, ...t.galons]) {
      expect(Math.abs(toSekre(p.x, p.z).x)).toBeGreaterThan(1.15);
    }
  });

  it('semua titik props zona di dalam mask region', () => {
    const pts = [
      ...t.motors, ...t.racks, ...t.sandals, ...t.galons, ...t.trashBins, t.board, t.jemuran, ...t.spanduk, ...t.fencePosts,
      ...LEMBAGA_LAYOUT.pju, ...LEMBAGA_LAYOUT.rusun.jemuran, LEMBAGA_LAYOUT.rusun.sign, LEMBAGA_LAYOUT.rusun.guardPost,
      LEMBAGA_LAYOUT.fh.plang, ...LEMBAGA_LAYOUT.fh.mounds,
      ...LEMBAGA_LAYOUT.lots.stadionMini.motors, ...LEMBAGA_LAYOUT.lots.rusunawa.motors,
    ];
    for (const p of pts) expect(pointInPolygon(p.x, p.z, LEMBAGA_MASK), JSON.stringify(p)).toBe(true);
  });

  it('spawn dev: depan mulut selasar barat, menghadap sumbu gedung', () => {
    const s = LEMBAGA_LAYOUT.spawnDev;
    expect(s.x).toBeCloseTo(-232.12, 1);
    expect(s.z).toBeCloseTo(1094.84, 1);
    expect(s.yaw).toBeCloseTo(1.2383, 3);
  });
});
```

- [ ] **Langkah 3: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/lembagaLayout.test.js`
Expected: FAIL — `layout.js` tidak ditemukan.

- [ ] **Langkah 4: Buat `layout.js`**

```js
/**
 * Tata letak zona Lembaga (MURNI, tanpa three): denah sekretariat (lokal-gedung), titik props teras, baris
 * motor parkir, PJU, detail Rusunawa/FH. Semua titik keluaran region-lokal {x, z, rotY} kecuali disebut.
 * Konvensi prop (katalog aset): muka depan menghadap −Z lokal prop; rotY = rotasi sumbu +Y (Object3D).
 * [INFERENSI] seluruh tata letak props (pola umum sekre ormawa Indonesia, riset §3).
 */
import { placementFromFootprint } from '../../geo/placement.js';
import { toLocal, toWorld } from '../../geo/regionTransform.js';
import { pointInPolygon, distanceToRing } from '../../geo/polygon.js';
import { createRandom } from '../../world/siteutil/rng.js';
import {
  SEKRE_SIZE, SEKRE_FRAME, fromSekre, FOOTPRINTS, toRegion, regionToWorld,
} from './placement.js';
import { sekreRooms } from './sekre.data.js';

/** Dimensi sekretariat (lokal-gedung, m). v = tinggi dari tanah pad. */
export const SEKRE_DIM = Object.freeze({
  hx: SEKRE_SIZE.width / 2,
  hz: SEKRE_SIZE.length / 2,
  roomLen: SEKRE_SIZE.length / 4,
  corridorHalf: 1.85,
  wallT: 0.15,
  wallTop: 3.75,
  floorY: 0.15,
  selasarY: 0.04,
  plint: 0.6,
  plafonY: 3.3,
  teras: 1.4,
  door: Object.freeze({ w: 0.9, v0: 0.15, v1: 2.25, off: 0.95 }),
  winCorr: Object.freeze({ w: 1.2, v0: 1.1, v1: 2.25, off: 2.75 }),
  winOut: Object.freeze({ w: 1.2, v0: 1.1, v1: 2.25 }),
  winEndX: 4.8,
  roster: Object.freeze({ v0: 2.45, v1: 2.75 }),
  signY: 2.55,
  roof: Object.freeze({ pitch: (20 * Math.PI) / 180, eave: 0.8, gable: 0.6 }),
});

/** rotY agar muka −Z prop menghadap arah (fx, fz). */
export const faceToward = (fx, fz) => Math.atan2(-fx, -fz);

/**
 * Info satu ruang (lokal-gedung). side +1 = baris U (+X), −1 = baris S. outYaw = yaw (konvensi entitas:
 * maju = (sin, cos)) orang yang keluar dari pintu ke selasar.
 */
export function roomInfo(index, dim = SEKRE_DIM) {
  const side = index < 4 ? 1 : -1;
  const col = index % 4;
  const z0 = -dim.hz + col * dim.roomLen;
  return Object.freeze({
    index, side, col, z0, z1: z0 + dim.roomLen,
    doorZ: z0 + dim.door.off,
    winZ: z0 + dim.winCorr.off,
    wallX: side * dim.corridorHalf,
    outYaw: side > 0 ? -Math.PI / 2 : Math.PI / 2,
  });
}

/** Titik lokal-gedung → region-lokal dengan rotY lokal-gedung ditambah yaw gedung. */
const placeSekre = (bx, bz, rotY = 0, extra = {}) => {
  const p = fromSekre(bx, bz);
  return Object.freeze({ x: p.x, z: p.z, rotY: rotY + SEKRE_FRAME.yaw, ...extra });
};

/**
 * Baris motor punggung-ke-punggung di lot poligon (region-lokal). Sumbu baris = sumbu panjang lot
 * (placementFromFootprint) kecuali `axisYaw`. Kandidat diterima bila kedua ujung & sisi motor ≥ `margin`
 * dari tepi lot; `fill` = peluang slot terisi (seed). rows = kapsul collider {a, b, r} per deret menerus.
 * @param {ReadonlyArray<readonly [number, number]>} ring
 */
export function layoutMotorRows(ring, {
  seed = 1, fill = 0.7, pitch = 0.82, length = 1.9, aisle = 3.0, margin = 1.2, axisYaw = null, kindRatio = 0.55,
} = {}) {
  const p = placementFromFootprint(ring);
  const frame = { x: p.x, z: p.z, yaw: axisYaw ?? p.yaw };
  const loc = ring.map(([x, z]) => {
    const l = toLocal(frame, x, z);
    return [l.x, l.z];
  });
  const xs = loc.map((q) => q[0]);
  const zs = loc.map((q) => q[1]);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const ok = (x, z) => pointInPolygon(x, z, loc) && distanceToRing(x, z, loc) >= margin;
  const rnd = createRandom(seed);
  const motors = [];
  const rows = [];
  const toRegionPt = (x, z) => {
    const w = toWorld(frame, x, z);
    return [w.x, w.z];
  };
  const closeRun = (cx, run) => rows.push(Object.freeze({ a: toRegionPt(cx, run.z0), b: toRegionPt(cx, run.z1), r: length / 2 + 0.2 }));
  for (let px = minX + margin + length; px + length + margin <= maxX; px += 2 * length + aisle) {
    for (const side of [-1, 1]) {
      const cx = px + side * (length / 2);
      const noseYaw = faceToward(side, 0) + Math.PI; // hidung menjauhi garis punggung (model menghadap −Z)
      let run = null;
      for (let z = minZ + margin; z <= maxZ - margin + 1e-9; z += pitch) {
        const fits = ok(cx - length / 2, z) && ok(cx + length / 2, z) && ok(cx, z - 0.35) && ok(cx, z + 0.35);
        if (!fits) {
          if (run) closeRun(cx, run);
          run = null;
          continue;
        }
        run = run ? { ...run, z1: z } : { z0: z, z1: z };
        const take = rnd.chance(fill);
        const kind = rnd.chance(kindRatio) ? 'matic' : 'bebek';
        const jitter = rnd.range(-0.12, 0.12);
        if (!take) continue;
        const [x, wz] = toRegionPt(cx, z);
        motors.push(Object.freeze({ x, z: wz, rotY: noseYaw + frame.yaw + jitter, kind }));
      }
      if (run) closeRun(cx, run);
    }
  }
  return { motors, rows };
}

const SEKRE_MOTOR_FILL = 0.85;

/**
 * Teras sekretariat [INFERENSI pola umum]: rak sepatu di bawah jendela selasar, sandal menumpuk di depan
 * pintu, galon kosong di sela pintu–rak, papan pengumuman di mulut barat, jemuran almamater di halaman
 * selatan, pagar besi + 3 spanduk ormawa menghadap jogging track (utara), motor parkir rapat di sisi utara
 * dan kedua mulut selasar, tong sampah, lampu selasar.
 */
export function sekreTerasLayout(rooms = sekreRooms(), { seed = 2026, dim = SEKRE_DIM } = {}) {
  const rnd = createRandom(seed);
  const info = rooms.map((r) => roomInfo(r.index, dim));
  const racks = info.filter((r) => r.index !== 3 && r.index !== 6)
    .map((r) => placeSekre(r.side * (dim.corridorHalf - 0.175 - 0.03), r.winZ, faceToward(-r.side, 0), { room: r.index }));
  const sandals = info.flatMap((r) => {
    const base = placeSekre(r.side * (dim.corridorHalf - 0.42), r.doorZ + rnd.range(-0.12, 0.12), faceToward(-r.side, 0) + rnd.range(-0.4, 0.4), { room: r.index });
    const extra = [0, 1, 4].includes(r.index)
      ? [placeSekre(r.side * (dim.corridorHalf - 0.62), r.doorZ + 0.35, rnd.range(-Math.PI, Math.PI), { room: r.index })]
      : [];
    return [base, ...extra];
  });
  const galons = [
    ...info.filter((r) => [0, 1, 5].includes(r.index)).flatMap((r) => [1.6, 1.92].map((dz) => placeSekre(r.side * (dim.corridorHalf - 0.2), r.z0 + dz, rnd.range(0, Math.PI)))),
    ...[-3.6, -3.3, -3.0, -3.45].map((bx, k) => placeSekre(bx, dim.hz + 0.6 + (k === 3 ? 0.28 : 0), rnd.range(0, Math.PI))),
  ];
  const fenceX = dim.hx + 4.6;
  const fenceZ = dim.hz + 2;
  const gate = 1.6;
  const fenceSegments = [[-fenceZ, -gate], [gate, fenceZ]].map(([z0, z1]) => {
    const a = fromSekre(fenceX, z0);
    const b = fromSekre(fenceX, z1);
    return Object.freeze({ a: [a.x, a.z], b: [b.x, b.z], r: 0.25 });
  });
  const fencePosts = [];
  for (const [z0, z1] of [[-fenceZ, -gate], [gate, fenceZ]]) {
    const n = Math.ceil((z1 - z0) / 2.4);
    for (let k = 0; k <= n; k += 1) fencePosts.push(placeSekre(fenceX, z0 + ((z1 - z0) * k) / n));
  }
  const motors = [];
  const pushMotor = (bx, bz, noseX, noseZ) => {
    if (!rnd.chance(SEKRE_MOTOR_FILL)) return;
    const kind = rnd.chance(0.55) ? 'matic' : 'bebek';
    motors.push(placeSekre(bx, bz, faceToward(noseX, noseZ) + rnd.range(-0.08, 0.08), { kind }));
  };
  for (let bz = -dim.hz + 0.8; bz <= dim.hz - 0.8; bz += 0.85) {
    if (Math.abs(bz) > 1.2) pushMotor(dim.hx + 1.45, bz, -1, 0);
  }
  for (let bx = 2.6; bx <= 7.0 + 1e-9; bx += 0.88) {
    pushMotor(-bx, -(dim.hz + 2.55), 0, 1);
    pushMotor(bx, dim.hz + 2.55, 0, -1);
  }
  const lamps = [-1.5, -0.5, 0.5, 1.5].map((k) => Object.freeze({ bx: 0, bz: k * dim.roomLen, y: dim.plafonY }));
  const mouthLamps = [-1, 1].map((s) => Object.freeze({ bx: 0, bz: s * (dim.hz + 0.1), y: 3.15 })); // lampu dinding di muka balok ambang mulut selasar
  return Object.freeze({
    racks, sandals, galons, motors, lamps, mouthLamps, fenceSegments, fencePosts,
    fence: Object.freeze({ x: fenceX, z0: -fenceZ, z1: fenceZ, gate }),
    board: placeSekre(2.9, -(dim.hz + 0.9), faceToward(0, -1)),
    jemuran: placeSekre(-(dim.hx + 2.4), 4.0, Math.PI / 2),
    spanduk: [-7.6, -3.5, 4.2].map((bz, k) => placeSekre(fenceX + 0.05, bz, faceToward(1, 0), { cell: `spanduk:${k}` })),
    trashBins: [placeSekre(-2.6, -(dim.hz + 1.0), 0, { kind: 'hijau' }), placeSekre(2.6, dim.hz + 1.0, 0, { kind: 'biru' })],
    pju: [placeSekre(fenceX + 1.2, -9.5), placeSekre(fenceX + 1.2, 9.5)],
  });
}

/** Titik dunia → objek region-lokal. */
const atWorld = (x, z, rotY = 0, extra = {}) => {
  const [lx, lz] = toRegion(x, z);
  return Object.freeze({ x: lx, z: lz, rotY, ...extra });
};

const teras = sekreTerasLayout();
const spawn = fromSekre(0, -(SEKRE_DIM.hz + 5));
const spawnWorld = regionToWorld(spawn.x, spawn.z);

/** Tata letak seluruh zona (region-lokal kecuali `spawnDev` = DUNIA). */
export const LEMBAGA_LAYOUT = Object.freeze({
  rooms: sekreRooms(),
  teras,
  lots: Object.freeze({
    stadionMini: layoutMotorRows(FOOTPRINTS.parkirStadionMini, { seed: 41, fill: 0.35 }), // ±270 motor siang
    rusunawa: layoutMotorRows(FOOTPRINTS.parkirRusunawa, { seed: 43, fill: 0.3 }), // ±150 motor
  }),
  /** PJU 9 m (LampPost) yang menyala: 2 di pagar sekretariat, 1 di parkir stadion mini, 1 di parkir rusunawa. */
  pju: Object.freeze([...teras.pju, atWorld(-318.5, 966.0), atWorld(60, 787.0)]),
  rusun: Object.freeze({
    sign: atWorld(15.0, 812.5, faceToward(-1, 0)),
    guardPost: atWorld(14.0, 799.0, -Math.PI / 2),
    jemuran: Object.freeze([40, 52, 64, 76].map((x) => atWorld(x, 846, 0))),
    trashBins: Object.freeze([atWorld(24, 816, 0, { kind: 'hijau' }), atWorld(27, 816, 0, { kind: 'biru' })]),
  }),
  fh: Object.freeze({
    fences: Object.freeze([
      [[-106, 616.5], [-90, 616.5]], [[-84, 616.5], [-60, 616.5]], [[-107, 614], [-107, 592]], [[-107, 586], [-107, 578]],
    ].map(([a, b]) => Object.freeze({ a: toRegion(a[0], a[1]), b: toRegion(b[0], b[1]), r: 0.3 }))),
    plang: atWorld(-86.5, 619.5, faceToward(0, 1)),
    mounds: Object.freeze([atWorld(-70, 622, 0, { r: 1.6 }), atWorld(-63, 625, 0, { r: 1.2 }), atWorld(-27, 600, 0, { r: 2.0 })]),
  }),
  /** Titik muncul perjalanan cepat dev (DUNIA): 5 m di depan mulut selasar barat, menghadap ESE. */
  spawnDev: Object.freeze({ x: spawnWorld.x, z: spawnWorld.z, yaw: SEKRE_FRAME.yaw }),
});
```

- [ ] **Langkah 5: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/lembagaLayout.test.js`
Expected: PASS (9 tes).

- [ ] **Langkah 6: Commit**

```bash
git add src/regions/unri-lembaga/placement.js src/regions/unri-lembaga/layout.js tests/unri/lembagaLayout.test.js
```
```bash
git commit -m "feat(lembaga): layout murni denah sekretariat, props teras, baris motor parkir, detail rusunawa/FH"
```

---

## Task 6: Pintu portal sekre pemain (TDD)

**Files:**
- Create: `src/regions/unri-lembaga/portalDoors.js`
- Test: `tests/unri/lembagaLayout.test.js` (tambah blok)

- [ ] **Langkah 1: Tambah tes yang gagal** (impor di atas + blok di akhir `tests/unri/lembagaLayout.test.js`)

```js
import { PORTAL_DOORS, sekreExitTo } from '../../src/regions/unri-lembaga/portalDoors.js';
import { fromSekre } from '../../src/regions/unri-lembaga/placement.js';
```
```js
describe('PORTAL_DOORS (kontrak indeks M4)', () => {
  it('satu pintu sekre-pemain → interior sekre, radius 1,6, prompt', () => {
    expect(PORTAL_DOORS).toHaveLength(1);
    const [d] = PORTAL_DOORS;
    expect(d).toMatchObject({ id: 'sekre-pemain', interiorId: 'sekre', radius: 1.6, prompt: 'Masuk sekre' });
    expect(d.pos.lx).toBeCloseTo(-2.7875, 3);
    expect(d.pos.lz).toBeCloseTo(-1.8632, 3);
    expect(d.yaw).toBeCloseTo(-0.33248, 4);
  });

  it('1 m ke dalam selasar di depan pintu ruang 1, tepat satu ruang dari pintu BEM', () => {
    const [d] = PORTAL_DOORS;
    const b = toSekre(d.pos.lx, d.pos.lz);
    expect(b.x).toBeCloseTo(0.85, 6);
    const bem = roomInfo(0);
    const bemFront = fromSekre(0.85, bem.doorZ);
    expect(Math.hypot(d.pos.lx - bemFront.x, d.pos.lz - bemFront.z)).toBeCloseTo(SEKRE_DIM.roomLen, 6);
  });

  it('sekreExitTo = depan pintu, yaw keluar, region unri-lembaga', () => {
    expect(sekreExitTo()).toEqual({ region: 'unri-lembaga', x: PORTAL_DOORS[0].pos.lx, z: PORTAL_DOORS[0].pos.lz, yaw: PORTAL_DOORS[0].yaw });
  });
});
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/lembagaLayout.test.js`
Expected: FAIL — `portalDoors.js` tidak ditemukan.

- [ ] **Langkah 3: Buat `portalDoors.js`**

```js
/**
 * Pintu-portal region Lembaga (kontrak indeks M4): titik pemicu region-lokal {lx, lz} 1 m di depan pintu
 * (di dalam selasar), yaw = arah hadap orang yang KELUAR dari pintu (konvensi entitas: maju = (sin, cos)).
 * Region mengembalikan daftar ini sebagai field `portals`; src/app/interiorPortal.js + portalTrigger.js
 * membacanya. Interior 'sekre' = stub kotak abu di M4, penuh di M5.
 */
import { fromSekre, SEKRE_FRAME, UNRI_LEMBAGA_ID } from './placement.js';
import { roomInfo, SEKRE_DIM } from './layout.js';
import { PLAYER_ROOM_INDEX } from './sekre.data.js';

/** Jarak titik pemicu dari muka pintu ke arah selasar (m). */
export const PORTAL_STEP_IN = 1.0;
export const PORTAL_RADIUS = 1.6;

function sekreDoor(id, interiorId, roomIndex, prompt) {
  const r = roomInfo(roomIndex);
  const p = fromSekre(r.side * (SEKRE_DIM.corridorHalf - PORTAL_STEP_IN), r.doorZ);
  return Object.freeze({
    id, interiorId, roomIndex, prompt, radius: PORTAL_RADIUS,
    pos: Object.freeze({ lx: p.x, lz: p.z }),
    yaw: r.outYaw + SEKRE_FRAME.yaw,
  });
}

export const PORTAL_DOORS = Object.freeze([sekreDoor('sekre-pemain', 'sekre', PLAYER_ROOM_INDEX, 'Masuk sekre')]);

/** `exitTo` interior sekre (spec §4.8): depan pintu, region-lokal, yaw keluar. */
export function sekreExitTo(door = PORTAL_DOORS[0]) {
  return Object.freeze({ region: UNRI_LEMBAGA_ID, x: door.pos.lx, z: door.pos.lz, yaw: door.yaw });
}
```

- [ ] **Langkah 4: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/lembagaLayout.test.js`
Expected: PASS (12 tes).

- [ ] **Langkah 5: Commit**

```bash
git add src/regions/unri-lembaga/portalDoors.js tests/unri/lembagaLayout.test.js
```
```bash
git commit -m "feat(lembaga): PORTAL_DOORS pintu sekre pemain di sebelah BEM + exitTo interior"
```

---

## Task 7: Collider region Lembaga (TDD)

**Files:**
- Create: `src/regions/unri-lembaga/collider.js`
- Test: `tests/unri/lembagaCollider.test.js`

- [ ] **Langkah 1: Tulis tes yang gagal**

`tests/unri/lembagaCollider.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { lembagaColliders } from '../../src/regions/unri-lembaga/collider.js';
import { fromSekre, FOOTPRINTS, toRegion } from '../../src/regions/unri-lembaga/placement.js';
import { SEKRE_DIM, LEMBAGA_LAYOUT } from '../../src/regions/unri-lembaga/layout.js';
import { PORTAL_DOORS } from '../../src/regions/unri-lembaga/portalDoors.js';
import { polygonCentroid } from '../../src/geo/polygon.js';

const c = lembagaColliders;
const S = (bx, bz) => {
  const p = fromSekre(bx, bz);
  return [p.x, p.z];
};

describe('collider region Lembaga', () => {
  it('ruang sekretariat padat, selasar & titik portal bebas (sepeda & kamera)', () => {
    expect(c.isWalkable(...S(4.8, -2))).toBe(false);
    expect(c.isWalkable(...S(-4.8, 6))).toBe(false);
    expect(c.isCameraClear(...S(4.8, -2))).toBe(false);
    for (const bz of [-8, -3, 0, 3, 8]) {
      expect(c.isWalkable(...S(0, bz))).toBe(true);
      expect(c.isCameraClear(...S(0, bz))).toBe(true);
    }
    const d = PORTAL_DOORS[0];
    expect(c.isWalkable(d.pos.lx, d.pos.lz)).toBe(true);
    expect(c.isWalkable(...S(1.6, -3))).toBe(false); // menempel dinding selasar (pad 0,55)
  });

  it('gedung lain padat: tribun, student center, rusunawa, FH', () => {
    for (const key of ['tribun', 'studentCenter', 'rusunawa']) {
      const p = polygonCentroid(FOOTPRINTS[key]);
      expect(c.isWalkable(p.x, p.z), key).toBe(false);
      expect(c.isCameraClear(p.x, p.z), key).toBe(false);
    }
    expect(c.isWalkable(...toRegion(-95, 590))).toBe(false); // sayap barat FH
    expect(c.isWalkable(...toRegion(-68, 590))).toBe(true); // halaman U FH (terbuka ke utara)
  });

  it('lapangan, lintasan, jalan, dan halaman depan bebas', () => {
    expect(c.isWalkable(...toRegion(-232.8, 954))).toBe(true);
    expect(c.isWalkable(...toRegion(-190, 954))).toBe(true);
    expect(c.isWalkable(...toRegion(-100, 700))).toBe(true);
    expect(c.isWalkable(...S(0, -(SEKRE_DIM.hz + 5)))).toBe(true); // spawn dev
  });

  it('baris motor & pagar menghalangi sepeda, bukan kamera', () => {
    const m = LEMBAGA_LAYOUT.lots.stadionMini.motors[10];
    expect(c.isWalkable(m.x, m.z)).toBe(false);
    expect(c.isCameraClear(m.x, m.z)).toBe(true);
    const f = LEMBAGA_LAYOUT.teras.fenceSegments[0];
    const mid = [(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2];
    expect(c.isWalkable(...mid)).toBe(false);
    expect(c.isWalkable(...S(LEMBAGA_LAYOUT.teras.fence.x, 0))).toBe(true); // gerbang pagar
  });

  it('penetration: 0 di tempat bebas, > 0 di dalam gedung, Infinity utk koordinat tak hingga', () => {
    expect(c.penetration(...S(0, 0))).toBe(0);
    expect(c.penetration(...S(4.8, -2))).toBeGreaterThan(0.5);
    expect(c.penetration(Number.NaN, 0)).toBe(Infinity);
    expect(c.isWalkable(Number.NaN, 0)).toBe(false);
  });
});
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/lembagaCollider.test.js`
Expected: FAIL — `collider.js` tidak ditemukan.

- [ ] **Langkah 3: Buat `collider.js`**

```js
/**
 * Collider region "unri-lembaga" (region-lokal). Di dalam mask region collider komposit memakai collider
 * ini, bukan collider distrik, jadi SEMUA penghalang zona harus ada di sini: gedung (tribun, Student Center,
 * Rusunawa, FH — dua terakhir dirender distrik), blok ruang sekretariat (selasar bebas), baris motor parkir,
 * pagar, tiang PJU, pos satpam, jemuran, gundukan material. Kamera hanya terhalang gedung (benda rendah tidak).
 */
import { pointInPolygon, distanceToRing, distanceToSegment } from '../../geo/polygon.js';
import { FOOTPRINTS, toSekre } from './placement.js';
import { SEKRE_DIM, LEMBAGA_LAYOUT } from './layout.js';

const BIKE_PAD = 0.55;     // jarak bebas sepeda dari dinding (m)
const CAMERA_PAD = 0.3;
const SEGMENT_PAD = 0.3;
const SOLID_BUILDINGS = Object.freeze(['tribun', 'studentCenter', 'rusunawa', 'fhPanam']);

/** Kedalaman masuk ke ring + pad (0 = di luar zona terhalang). */
function ringDepth(x, z, ring, pad) {
  const d = distanceToRing(x, z, ring);
  if (pointInPolygon(x, z, ring)) return d + pad;
  return d < pad ? pad - d : 0;
}

/** Kedalaman masuk ke blok ruang sekretariat (dua baris; selasar |bx| < corridorHalf bebas). */
function sekreDepth(lx, lz, pad, dim = SEKRE_DIM) {
  const b = toSekre(lx, lz);
  const ax = Math.abs(b.x);
  const inside = ax > dim.corridorHalf - pad && ax < dim.hx + pad && Math.abs(b.z) < dim.hz + pad;
  if (!inside) return 0;
  return Math.min(ax - (dim.corridorHalf - pad), dim.hx + pad - ax, dim.hz + pad - Math.abs(b.z));
}

const segDepth = (x, z, s) => Math.max(0, s.r + SEGMENT_PAD - distanceToSegment(x, z, s.a, s.b));
const circleDepth = (x, z, c) => Math.max(0, c.r - Math.hypot(x - c.x, z - c.z));

/** Bentuk penghalang default dari footprint & layout zona. */
export function defaultShapes(layout = LEMBAGA_LAYOUT) {
  const rows = [...layout.lots.stadionMini.rows, ...layout.lots.rusunawa.rows];
  const sekreMotors = layout.teras.motors.map((m) => ({ x: m.x, z: m.z, r: 1.0 }));
  return {
    rings: SOLID_BUILDINGS.map((k) => FOOTPRINTS[k]),
    segments: [...rows, ...layout.teras.fenceSegments, ...layout.fh.fences],
    circles: [
      ...sekreMotors,
      ...layout.pju.map((p) => ({ x: p.x, z: p.z, r: 0.45 })),
      { x: layout.teras.board.x, z: layout.teras.board.z, r: 0.85 },
      { x: layout.teras.jemuran.x, z: layout.teras.jemuran.z, r: 1.1 },
      { x: layout.rusun.guardPost.x, z: layout.rusun.guardPost.z, r: 1.7 },
      ...layout.rusun.jemuran.map((p) => ({ x: p.x, z: p.z, r: 1.1 })),
      ...layout.fh.mounds.map((m) => ({ x: m.x, z: m.z, r: m.r })),
    ],
  };
}

/**
 * @param {{rings: Array<ReadonlyArray<readonly [number, number]>>, segments: Array<{a:number[], b:number[], r:number}>,
 *   circles: Array<{x:number, z:number, r:number}>}} [shapes]
 */
export function createLembagaColliders(shapes = defaultShapes()) {
  const { rings, segments, circles } = shapes;
  const depthAt = (x, z) => {
    let best = sekreDepth(x, z, BIKE_PAD);
    for (const r of rings) best = Math.max(best, ringDepth(x, z, r, BIKE_PAD));
    for (const s of segments) best = Math.max(best, segDepth(x, z, s));
    for (const c of circles) best = Math.max(best, circleDepth(x, z, c));
    return best;
  };
  const finite = (x, z) => Number.isFinite(x) && Number.isFinite(z);
  return Object.freeze({
    isWalkable: (x, z) => finite(x, z) && depthAt(x, z) === 0,
    isCameraClear: (x, z) => finite(x, z) && sekreDepth(x, z, CAMERA_PAD) === 0
      && rings.every((r) => ringDepth(x, z, r, CAMERA_PAD) === 0),
    penetration: (x, z) => (finite(x, z) ? depthAt(x, z) : Infinity),
  });
}

export const lembagaColliders = createLembagaColliders();
```

- [ ] **Langkah 4: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/lembagaCollider.test.js`
Expected: PASS (5 tes).

- [ ] **Langkah 5: Commit**

```bash
git add src/regions/unri-lembaga/collider.js tests/unri/lembagaCollider.test.js
```
```bash
git commit -m "feat(lembaga): collider region (blok ruang sekre, selasar bebas, gedung, baris motor, pagar, tiang)"
```

---

## Task 8: Props kampus I — helper geometri, atlas kanvas (TDD packing), papan nama sekre N06, spanduk N07, papan pengumuman N09

**Files:**
- Create: `src/world/props/unri/geom.js`, `src/world/props/unri/atlas.js`, `src/world/props/unri/papanNamaSekre.js`, `src/world/props/unri/spanduk.js`, `src/world/props/unri/papanPengumuman.js`
- Test: `tests/unri/atlasPack.test.js`

Konvensi semua props kampus (katalog aset): ukuran L × P × T = X × Z × Y meter, pusat alas di (0,0,0), **muka depan menghadap −Z**.

- [ ] **Langkah 1: Tulis tes packing yang gagal**

`tests/unri/atlasPack.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { packShelves, rectToUv, createCanvasAtlas } from '../../src/world/props/unri/atlas.js';

const cells = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: `sign:${i}`, w: 384, h: 96 })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `spanduk:${i}`, w: 768, h: 192 })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `stiker:${i}`, w: 96, h: 96 })),
];

describe('packShelves', () => {
  it('semua sel di dalam atlas, tidak tumpang, berjarak pad', () => {
    const r = packShelves(cells, { width: 1024, height: 2048, pad: 4 });
    const list = [...r.values()];
    expect(list).toHaveLength(cells.length);
    for (const a of list) {
      expect(a.x).toBeGreaterThanOrEqual(4);
      expect(a.y).toBeGreaterThanOrEqual(4);
      expect(a.x + a.w).toBeLessThanOrEqual(1020);
      expect(a.y + a.h).toBeLessThanOrEqual(2044);
    }
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const overlap = a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 4 && b.y < a.y + a.h + 4;
        expect(overlap).toBe(false);
      }
    }
  });

  it('melempar saat penuh / id ganda / sel lebih lebar dari atlas', () => {
    expect(() => packShelves(cells, { width: 1024, height: 256 })).toThrow(/penuh/);
    expect(() => packShelves([{ id: 'a', w: 10, h: 10 }, { id: 'a', w: 10, h: 10 }], { width: 64, height: 64 })).toThrow(/ganda/);
    expect(() => packShelves([{ id: 'b', w: 100, h: 10 }], { width: 64, height: 64 })).toThrow(/lebar/);
  });

  it('rectToUv: v terbalik (flipY kanvas), di dalam 0..1', () => {
    const uv = rectToUv({ x: 0, y: 0, w: 512, h: 256 }, 1024, 1024);
    expect(uv).toEqual({ u0: 0, u1: 0.5, v0: 0.75, v1: 1 });
  });

  it('createCanvasAtlas tanpa document: tekstur null, sel tetap terpetakan', () => {
    const atlas = createCanvasAtlas({ width: 1024, height: 2048, cells: cells.map((c) => ({ ...c, draw: () => {} })) });
    expect(atlas.texture).toBeNull();
    expect(atlas.cell('sign:3').u1).toBeGreaterThan(atlas.cell('sign:3').u0);
    expect(() => atlas.cell('tidak-ada')).toThrow();
  });
});
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/atlasPack.test.js`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Langkah 3: Buat `src/world/props/unri/geom.js`**

```js
/**
 * Helper geometri props kampus UNRI. Semua geometri terindeks dengan position/normal/uv agar bisa digabung
 * mergeByMaterial; `paint` menambah atribut warna (material vertexColors) sehingga banyak benda berwarna
 * berbeda tetap satu draw call.
 */
import * as THREE from 'three';

/** Balok w×h×d, alas di y0, pusat (x, z). */
export function boxAt(w, h, d, x = 0, y0 = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y0 + h / 2, z);
}

/** Atribut warna per-vertex seragam. */
export function paint(geometry, hex) {
  const c = new THREE.Color(hex);
  const n = geometry.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geometry;
}

/** Quad dari 4 sudut [x,y,z] berlawanan jarum jam dilihat dari sisi depan, UV per sudut. */
export function quad(corners, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/** Petakan UV 0..1 geometri ke sel atlas {u0,u1,v0,v1}. */
export function uvToCell(geometry, cell) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, cell.u0 + uv.getX(i) * (cell.u1 - cell.u0), cell.v0 + uv.getY(i) * (cell.v1 - cell.v0));
  }
  uv.needsUpdate = true;
  return geometry;
}

/** Plane w×h menghadap −Z (muka depan prop), pusat (x, y, z), opsional UV sel atlas. */
export function facePlane(w, h, { x = 0, y = 0, z = 0, cell = null } = {}) {
  const g = new THREE.PlaneGeometry(w, h);
  if (cell) uvToCell(g, cell);
  return g.rotateY(Math.PI).translate(x, y, z);
}

/** Mesh bernama dengan flag bayangan. */
export function meshOf(geometry, material, name = '', { cast = false } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}
```

- [ ] **Langkah 4: Buat `src/world/props/unri/atlas.js`**

```js
/**
 * Atlas kanvas: banyak gambar kecil (papan nama, stiker, kertas pengumuman, spanduk) dalam SATU tekstur agar
 * semua decal berbagi satu material = satu draw call. packShelves murni (dites); gambar hanya bila ada document.
 */
import * as THREE from 'three';
import { hasDocument } from '../canvasText.js';

/**
 * Kemas sel ke rak (shelf packing), sel tertinggi dulu. Koordinat piksel kanvas (y ke bawah).
 * @param {Array<{id:string, w:number, h:number}>} cells
 * @returns {Map<string, {x:number, y:number, w:number, h:number}>}
 */
export function packShelves(cells, { width, height, pad = 2 }) {
  const order = [...cells].sort((a, b) => b.h - a.h || b.w - a.w);
  const out = new Map();
  let x = pad;
  let y = pad;
  let shelfH = 0;
  for (const c of order) {
    if (!(c.w > 0 && c.h > 0)) throw new RangeError(`atlas: sel "${c.id}" berukuran tidak valid`);
    if (out.has(c.id)) throw new RangeError(`atlas: id ganda "${c.id}"`);
    if (c.w + 2 * pad > width) throw new RangeError(`atlas: sel "${c.id}" lebih lebar dari atlas`);
    if (x + c.w + pad > width) {
      x = pad;
      y += shelfH + pad;
      shelfH = 0;
    }
    if (y + c.h + pad > height) throw new RangeError(`atlas: penuh di sel "${c.id}"`);
    out.set(c.id, { x, y, w: c.w, h: c.h });
    x += c.w + pad;
    shelfH = Math.max(shelfH, c.h);
  }
  return out;
}

/** Persegi piksel → UV (CanvasTexture flipY: v = 1 di tepi atas kanvas). */
export function rectToUv(r, width, height) {
  return { u0: r.x / width, u1: (r.x + r.w) / width, v0: 1 - (r.y + r.h) / height, v1: 1 - r.y / height };
}

/** Kecilkan huruf sampai teks muat `maxW` piksel; kembalikan ukuran px akhir. */
export function fitFont(ctx, text, maxW, px, weight = 'bold') {
  let size = Math.round(px);
  ctx.font = `${weight} ${size}px sans-serif`;
  while (size > 6 && ctx.measureText(text).width > maxW) {
    size -= 1;
    ctx.font = `${weight} ${size}px sans-serif`;
  }
  return size;
}

/**
 * @param {{width?:number, height?:number, pad?:number,
 *   cells: Array<{id:string, w:number, h:number, draw(ctx: CanvasRenderingContext2D, w:number, h:number):void}>}} opts
 * @returns {{texture: THREE.CanvasTexture|null, width:number, height:number, cell(id:string): {u0:number,u1:number,v0:number,v1:number}, has(id:string): boolean}}
 */
export function createCanvasAtlas({ width = 1024, height = 1024, pad = 4, cells }) {
  const rects = packShelves(cells, { width, height, pad });
  const uvs = new Map([...rects].map(([id, r]) => [id, Object.freeze(rectToUv(r, width, height))]));
  let texture = null;
  if (hasDocument()) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      for (const c of cells) {
        const r = rects.get(c.id);
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.beginPath();
        ctx.rect(0, 0, r.w, r.h);
        ctx.clip();
        c.draw(ctx, r.w, r.h);
        ctx.restore();
      }
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
    }
  }
  return {
    texture,
    width,
    height,
    has: (id) => uvs.has(id),
    cell(id) {
      const uv = uvs.get(id);
      if (!uv) throw new RangeError(`atlas: sel "${id}" tidak ada`);
      return uv;
    },
  };
}
```

- [ ] **Langkah 5: Jalankan tes packing, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/atlasPack.test.js`
Expected: PASS (4 tes).

- [ ] **Langkah 6: Buat `papanNamaSekre.js` (N06, 1,6 × 0,05 × 0,4)**

```js
/**
 * N06 papan nama sekre di atas pintu [INFERENSI pola umum]: papan 1,6 × 0,4 m tebal 5 cm, muka kanvas
 * (sel atlas) menghadap −Z, asal = pusat papan. Logo = lingkaran kuning generik (bukan lambang resmi).
 */
import * as THREE from 'three';
import { boxAt, facePlane, meshOf } from './geom.js';
import { fitFont } from './atlas.js';
import { toCss } from '../canvasText.js';

export const PAPAN_NAMA_SEKRE = Object.freeze({ w: 1.6, h: 0.4, d: 0.05, px: Object.freeze({ w: 384, h: 96 }) });

/** Gambar papan: latar, bingkai tipis, logo bulat, nama tebal, keterangan kecil. */
export function drawPapanNama(ctx, w, h, { nama, sub = '', latar = 0x0d3b66, teks = 0xffffff }) {
  ctx.fillStyle = toCss(latar);
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = toCss(teks);
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = Math.max(2, h * 0.04);
  ctx.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(h * 0.5, h / 2, h * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = '#f2c200';
  ctx.fill();
  ctx.fillStyle = toCss(teks);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const left = h * 0.95;
  const tw = w - left - h * 0.2;
  const mid = left + tw / 2;
  fitFont(ctx, nama, tw, h * (sub ? 0.36 : 0.5), 'bold');
  ctx.fillText(nama, mid, sub ? h * 0.4 : h / 2);
  if (sub) {
    fitFont(ctx, sub, tw, h * 0.17, 'normal');
    ctx.fillText(sub, mid, h * 0.74);
  }
}

/**
 * @param {{cell: {u0:number,u1:number,v0:number,v1:number}, faceMaterial: THREE.Material, frameMaterial: THREE.Material}} opts
 */
export function createPapanNamaSekre({ cell, faceMaterial, frameMaterial }) {
  const { w, h, d } = PAPAN_NAMA_SEKRE;
  const g = new THREE.Group();
  g.name = 'N06-papan-nama-sekre';
  g.add(meshOf(boxAt(w, h, d - 0.005, 0, -h / 2, 0.0025), frameMaterial, 'papanNamaBingkai'));
  g.add(meshOf(facePlane(w - 0.03, h - 0.03, { z: -d / 2 + 0.001, cell }), faceMaterial, 'papanNamaMuka'));
  return g;
}
```

- [ ] **Langkah 7: Buat `spanduk.js` (N07, 4 × 0,02 × 1)**

```js
/**
 * N07 spanduk ormawa diikat di pagar [INFERENSI pola umum]: bidang 4 × 1 m (kanvas sel atlas, dua sisi)
 * + 4 mata ayam/tali di sudut. Muka −Z, asal = pusat spanduk.
 */
import * as THREE from 'three';
import { boxAt, facePlane, meshOf } from './geom.js';
import { fitFont } from './atlas.js';
import { toCss } from '../canvasText.js';

export const SPANDUK = Object.freeze({ w: 4, h: 1, d: 0.02, px: Object.freeze({ w: 768, h: 192 }) });

/** Gambar spanduk: latar, pita aksen atas-bawah, judul besar, subjudul. */
export function drawSpanduk(ctx, w, h, { judul, sub = '', latar = 0xf2c200, teks = 0x0d3b66, aksen = 0xc8102e }) {
  ctx.fillStyle = toCss(latar);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = toCss(aksen);
  ctx.fillRect(0, 0, w, h * 0.09);
  ctx.fillRect(0, h * 0.91, w, h * 0.09);
  ctx.fillStyle = toCss(teks);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFont(ctx, judul, w * 0.92, h * 0.4, 'bold');
  ctx.fillText(judul, w / 2, sub ? h * 0.42 : h / 2);
  if (sub) {
    fitFont(ctx, sub, w * 0.9, h * 0.17, 'bold');
    ctx.fillText(sub, w / 2, h * 0.73);
  }
}

/** @param {{cell: object, material: THREE.Material, tieMaterial: THREE.Material}} opts material muka: DoubleSide */
export function createSpanduk({ cell, material, tieMaterial }) {
  const { w, h, d } = SPANDUK;
  const g = new THREE.Group();
  g.name = 'N07-spanduk';
  g.add(meshOf(facePlane(w, h, { cell }), material, 'spandukMuka'));
  for (const [sx, sy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    g.add(meshOf(boxAt(0.03, 0.03, d, sx * (w / 2 - 0.015), sy * (h / 2 - 0.015) - 0.015, 0), tieMaterial, 'spandukTali'));
  }
  return g;
}
```

- [ ] **Langkah 8: Buat `papanPengumuman.js` (N09, 1,5 × 0,1 × 1,8)**

```js
/**
 * N09 papan pengumuman berdiri [INFERENSI]: dua kaki kayu, papan gabus 1,5 × 0,95 m, atap tipis. Muka (sel
 * atlas berisi kertas tertempel) menghadap −Z. Asal = tengah alas.
 */
import * as THREE from 'three';
import { boxAt, facePlane, meshOf } from './geom.js';
import { fitFont } from './atlas.js';

export const PAPAN_PENGUMUMAN = Object.freeze({ w: 1.5, d: 0.1, h: 1.8, boardY0: 0.8, boardH: 0.95, px: Object.freeze({ w: 320, h: 208 }) });

const PAPER_COLORS = ['#ffffff', '#fff7c2', '#ffd6e0', '#d9f0ff', '#e6ffd9', '#ffffff'];

/** Gabus + kertas bertumpuk berjudul (isi baris = coretan abu). */
export function drawPapanPengumuman(ctx, w, h, { notices }) {
  ctx.fillStyle = '#b8895a';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i += 1) {
    ctx.fillStyle = i % 2 ? 'rgba(90,60,30,0.12)' : 'rgba(255,240,210,0.10)';
    ctx.fillRect((i * 37) % w, (i * 53) % h, 2, 2);
  }
  notices.forEach((n, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const pw = w * 0.29;
    const ph = h * 0.42;
    const x = w * 0.03 + col * w * 0.325 + (i % 2) * 4;
    const y = h * 0.05 + row * h * 0.48 + (i % 3) * 3;
    ctx.save();
    ctx.translate(x + pw / 2, y + ph / 2);
    ctx.rotate(((i % 3) - 1) * 0.04);
    ctx.fillStyle = PAPER_COLORS[i % PAPER_COLORS.length];
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    ctx.fillStyle = '#c8102e';
    ctx.beginPath();
    ctx.arc(0, -ph / 2 + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    ctx.textAlign = 'center';
    fitFont(ctx, n, pw * 0.9, ph * 0.16, 'bold');
    ctx.fillText(n, 0, -ph / 2 + ph * 0.24);
    ctx.fillStyle = 'rgba(40,40,40,0.55)';
    for (let k = 0; k < 4; k += 1) ctx.fillRect(-pw * 0.4, -ph / 2 + ph * (0.42 + k * 0.13), pw * (0.8 - (k % 2) * 0.2), 2);
    ctx.restore();
  });
}

/** @param {{cell: object, faceMaterial: THREE.Material, woodMaterial: THREE.Material}} opts */
export function createPapanPengumuman({ cell, faceMaterial, woodMaterial }) {
  const { w, h, boardY0, boardH } = PAPAN_PENGUMUMAN;
  const g = new THREE.Group();
  g.name = 'N09-papan-pengumuman';
  for (const sx of [-1, 1]) g.add(meshOf(boxAt(0.06, h, 0.06, sx * (w / 2 - 0.03), 0, 0.02), woodMaterial, 'papanKaki', { cast: true }));
  g.add(meshOf(boxAt(w, boardH, 0.04, 0, boardY0, 0.02), woodMaterial, 'papanGabus', { cast: true }));
  g.add(meshOf(boxAt(w, 0.04, 0.1, 0, h - 0.04, 0), woodMaterial, 'papanAtap'));
  g.add(meshOf(facePlane(w - 0.08, boardH - 0.08, { y: boardY0 + boardH / 2, z: -0.002, cell }), faceMaterial, 'papanKertas'));
  return g;
}
```

- [ ] **Langkah 9: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.
```bash
git add src/world/props/unri/geom.js src/world/props/unri/atlas.js src/world/props/unri/papanNamaSekre.js src/world/props/unri/spanduk.js src/world/props/unri/papanPengumuman.js tests/unri/atlasPack.test.js
```
```bash
git commit -m "feat(props): atlas kanvas + papan nama sekre (N06), spanduk ormawa (N07), papan pengumuman (N09)"
```

---

## Task 9: Props kampus II — rak sepatu P07, sandal tumpuk P08, galon P10, jemuran almamater P09

**Files:**
- Create: `src/world/props/unri/rakSepatu.js`, `sandal.js`, `galon.js`, `jemuran.js`

- [ ] **Langkah 1: `rakSepatu.js` (P07, 1,2 × 0,35 × 0,9, instanced)**

```js
/**
 * P07 rak sepatu teras [INFERENSI pola umum]: rak kayu 3 susun terbuka ke −Z berisi sepatu warna-warni.
 * Instanced (2 draw call untuk semua rak). positions: [{x, y?, z, rotY?}].
 */
import * as THREE from 'three';
import { instanceParts } from '../../siteutil/instanceParts.js';
import { createRandom } from '../../siteutil/rng.js';
import { mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';
import { boxAt, paint } from './geom.js';

export const RAK_SEPATU = Object.freeze({ w: 1.2, d: 0.35, h: 0.9 });
const SHELVES = Object.freeze([0.06, 0.36, 0.66]);
const SHOE_COLORS = Object.freeze([0x1b1b1b, 0xf5f5f5, 0x6d4c41, 0x1565c0, 0x9e9e9e, 0xc62828, 0x2e7d32, 0x37474f]);

function rakGeometry() {
  const { w, d, h } = RAK_SEPATU;
  return mergeAll([
    boxAt(0.02, h, d, -(w / 2 - 0.01), 0, 0),
    boxAt(0.02, h, d, w / 2 - 0.01, 0, 0),
    ...SHELVES.map((y) => boxAt(w - 0.04, 0.02, d - 0.02, 0, y, 0.01)),
    boxAt(w, 0.02, d, 0, h - 0.02, 0),
    boxAt(w - 0.04, 0.06, 0.01, 0, 0.8, d / 2 - 0.005),
  ]);
}

function sepatuGeometry() {
  const rnd = createRandom(907);
  const pairs = [4, 3, 3];
  const geos = [];
  SHELVES.forEach((y, s) => {
    const n = pairs[s];
    for (let k = 0; k < n; k += 1) {
      const cx = -0.45 + (k * 0.9) / Math.max(1, n - 1) + rnd.range(-0.03, 0.03);
      const color = rnd.pick(SHOE_COLORS);
      for (const off of [-0.055, 0.055]) geos.push(paint(boxAt(0.09, 0.07, 0.25, cx + off, y + 0.02, -0.02), color));
    }
  });
  return mergeAll(geos);
}

const geoRak = () => currentScope().get('unri:rakSepatu:geo', rakGeometry);
const geoSepatu = () => currentScope().get('unri:rakSepatu:sepatu', sepatuGeometry);
const matRak = () => currentScope().get('unri:rakSepatu:mat', () => new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.85 }));
const matSepatu = () => currentScope().get('unri:rakSepatu:matSepatu', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));

export function createRakSepatu(positions = []) {
  return instanceParts([
    { geometry: geoRak(), material: matRak(), castShadow: true, name: 'P07-rak' },
    { geometry: geoSepatu(), material: matSepatu(), name: 'P07-sepatu' },
  ], positions, 'P07-rak-sepatu');
}
```

- [ ] **Langkah 2: `sandal.js` (P08, 0,8 × 0,5 × 0,05, instanced)**

```js
/**
 * P08 sandal menumpuk di depan pintu sekre [INFERENSI pola umum: alas kaki dilepas sebelum masuk]:
 * 6 pasang sandal jepit/selop warna-warni, sebagian menumpuk. Satu geometri berwarna (vertexColors),
 * satu draw call untuk semua tumpukan. Bbox 0,8 × 0,5 × ≤ 0,05.
 */
import * as THREE from 'three';
import { instanceParts } from '../../siteutil/instanceParts.js';
import { mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';
import { boxAt, paint } from './geom.js';

export const SANDAL_TUMPUK = Object.freeze({ w: 0.8, d: 0.5, h: 0.05 });
const SOLE = Object.freeze({ w: 0.1, h: 0.015, l: 0.25 });
/**
 * Pasangan [x, z, yaw, tingkat, warna]: dua pasang terluar sejajar sumbu menentukan bbox 0,8 × 0,5;
 * empat pasang di dalam (jangkauan ≤ 0,166 m dari pusatnya) diputar dan sebagian menumpuk.
 */
const PAIRS = Object.freeze([
  [-0.29, -0.125, 0, 0, 0x1e88e5], [0.29, 0.125, 0, 0, 0x212121], [-0.05, 0.06, 0.5, 0, 0x43a047],
  [0.1, -0.06, -0.7, 0, 0xe53935], [-0.15, 0, 1.6, 1, 0xfdd835], [0.2, 0.05, 2.6, 1, 0x8d6e63],
]);

function sandalGeometry() {
  const geos = [];
  PAIRS.forEach(([cx, cz, yaw, level, color]) => {
    for (const off of [-0.06, 0.06]) {
      const sole = boxAt(SOLE.w, SOLE.h, SOLE.l, 0, 0, 0);
      const strap = boxAt(0.08, 0.008, 0.02, 0, SOLE.h, -0.06);
      const g = mergeAll([sole, strap]).rotateY(yaw).translate(cx + Math.cos(yaw) * off, level * 0.017, cz - Math.sin(yaw) * off);
      geos.push(paint(g, color));
    }
  });
  return mergeAll(geos);
}

const geo = () => currentScope().get('unri:sandal:geo', sandalGeometry);
const mat = () => currentScope().get('unri:sandal:mat', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));

export function createSandalTumpuk(positions = []) {
  return instanceParts([{ geometry: geo(), material: mat(), name: 'P08-sandal' }], positions, 'P08-sandal-tumpuk');
}
```
Catatan: `mergeAll` membuang geometri sumber; `paint` harus dipanggil pada hasil merge sole+strap (sudah demikian) agar atribut seragam.

- [ ] **Langkah 3: `galon.js` (P10, Ø 0,27 × 0,5, instanced)**

```js
/**
 * P10 galon air kosong (19 L) menumpuk di teras sekre [INFERENSI pola umum]: badan, bahu, leher;
 * plastik biru tembus. Instanced.
 */
import * as THREE from 'three';
import { instanceParts } from '../../siteutil/instanceParts.js';
import { mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';

export const GALON = Object.freeze({ r: 0.135, h: 0.5 });

function galonGeometry() {
  const seg = 14;
  return mergeAll([
    new THREE.CylinderGeometry(0.128, 0.128, 0.02, seg).translate(0, 0.01, 0),
    new THREE.CylinderGeometry(GALON.r, GALON.r, 0.38, seg).translate(0, 0.21, 0),
    new THREE.CylinderGeometry(0.06, GALON.r, 0.06, seg).translate(0, 0.43, 0),
    new THREE.CylinderGeometry(0.03, 0.035, 0.04, 10).translate(0, 0.48, 0),
  ]);
}

const geo = () => currentScope().get('unri:galon:geo', galonGeometry);
const mat = () => currentScope().get('unri:galon:mat', () => new THREE.MeshStandardMaterial({
  color: 0x6fb7e9, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.78, depthWrite: false,
}));

export function createGalon(positions = []) {
  return instanceParts([{ geometry: geo(), material: mat(), name: 'P10-galon' }], positions, 'P10-galon-kosong');
}
```

- [ ] **Langkah 4: `jemuran.js` (P09, 2 × 0,1 × 1,8)**

```js
/**
 * P09 jemuran almamater: dua tiang besi + tali, tiga jas almamater biru langit ("Kampus Biru Langit", [T];
 * nada warna persis [INF]) dengan bordir lambang kuning kecil di dada kiri. Asal = tengah alas, tali sejajar X.
 */
import * as THREE from 'three';
import { mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';
import { boxAt, paint, meshOf } from './geom.js';

export const JEMURAN = Object.freeze({ w: 2, d: 0.1, h: 1.8 });
export const ALMAMATER_BIRU_LANGIT = 0x7ec8ee;
const LAMBANG_KUNING = 0xf2c200;
const JACKET_X = Object.freeze([-0.62, 0, 0.62]);

function jacketsGeometry() {
  return mergeAll(JACKET_X.flatMap((x) => [
    paint(boxAt(0.46, 0.62, 0.07, x, 1.06, 0), ALMAMATER_BIRU_LANGIT),
    paint(boxAt(0.1, 0.5, 0.045, x - 0.28, 1.16, 0), ALMAMATER_BIRU_LANGIT),
    paint(boxAt(0.1, 0.5, 0.045, x + 0.28, 1.16, 0), ALMAMATER_BIRU_LANGIT),
    paint(boxAt(0.2, 0.05, 0.1, x, 1.66, 0), 0x5fa9d4), // kerah = tebal maksimum 0,1 m
    paint(boxAt(0.07, 0.08, 0.004, x - 0.12, 1.48, -0.037), LAMBANG_KUNING),
    paint(boxAt(0.02, 0.05, 0.02, x, 1.7, 0), 0x444444),
  ]));
}

const framGeo = () => currentScope().get('unri:jemuran:rangka', () => mergeAll([
  boxAt(0.04, JEMURAN.h, 0.04, -(JEMURAN.w / 2 - 0.02), 0, 0),
  boxAt(0.04, JEMURAN.h, 0.04, JEMURAN.w / 2 - 0.02, 0, 0),
  boxAt(JEMURAN.w - 0.04, 0.012, 0.012, 0, 1.74, 0),
]));
const jacketGeo = () => currentScope().get('unri:jemuran:jas', jacketsGeometry);
const matFrame = () => currentScope().get('unri:jemuran:matRangka', () => new THREE.MeshStandardMaterial({ color: 0x7d858a, roughness: 0.6, metalness: 0.4 }));
const matJas = () => currentScope().get('unri:jemuran:matJas', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));

export function createJemuran() {
  const g = new THREE.Group();
  g.name = 'P09-jemuran-almamater';
  g.add(meshOf(framGeo(), matFrame(), 'jemuranRangka', { cast: true }));
  g.add(meshOf(jacketGeo(), matJas(), 'jemuranJas', { cast: true }));
  return g;
}
```

- [ ] **Langkah 5: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.
```bash
git add src/world/props/unri/rakSepatu.js src/world/props/unri/sandal.js src/world/props/unri/galon.js src/world/props/unri/jemuran.js
```
```bash
git commit -m "feat(props): rak sepatu (P07), sandal tumpuk (P08), galon (P10), jemuran almamater biru langit (P09)"
```

---

## Task 10: Props kampus III — motor A01/A02 (placeholder + GLB instanced), ilalang V08 (scatter TDD), tes dimensi katalog

**Files:**
- Create: `src/world/props/unri/motor.js`, `src/world/props/unri/ilalang.js`
- Test: `tests/unri/propsCatalog.test.js`

- [ ] **Langkah 1: Tulis tes yang gagal**

`tests/unri/propsCatalog.test.js`:
```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createResourceScope, withScope } from '../../src/engine/ResourceScope.js';
import { createRakSepatu, RAK_SEPATU } from '../../src/world/props/unri/rakSepatu.js';
import { createSandalTumpuk, SANDAL_TUMPUK } from '../../src/world/props/unri/sandal.js';
import { createGalon, GALON } from '../../src/world/props/unri/galon.js';
import { createJemuran, JEMURAN } from '../../src/world/props/unri/jemuran.js';
import { createPapanNamaSekre, PAPAN_NAMA_SEKRE } from '../../src/world/props/unri/papanNamaSekre.js';
import { createSpanduk, SPANDUK } from '../../src/world/props/unri/spanduk.js';
import { createPapanPengumuman, PAPAN_PENGUMUMAN } from '../../src/world/props/unri/papanPengumuman.js';
import { createMotorPlaceholders, MOTOR } from '../../src/world/props/unri/motor.js';
import { createIlalang, ILALANG, scatterIlalang } from '../../src/world/props/unri/ilalang.js';
import { pointInPolygon, distanceToRing } from '../../src/geo/polygon.js';

const CELL = { u0: 0, u1: 1, v0: 0, v1: 1 };
const M = new THREE.MeshBasicMaterial();
const ORIGIN = [{ x: 0, z: 0 }];

/** Ukuran bbox [X, Y(tinggi), Z] dan alas y min. */
function dims(obj) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  const s = b.getSize(new THREE.Vector3());
  return { x: s.x, y: s.y, z: s.z, minY: b.min.y };
}

describe('props kampus berukuran persis katalog (L × P × T = X × Z × Y)', () => {
  const scope = createResourceScope('uji');
  const at = (fn) => withScope(scope, fn);
  const cases = [
    ['P07 rak sepatu', () => createRakSepatu(ORIGIN), [RAK_SEPATU.w, RAK_SEPATU.d, RAK_SEPATU.h], 0.01],
    ['P08 sandal tumpuk', () => createSandalTumpuk(ORIGIN), [SANDAL_TUMPUK.w, SANDAL_TUMPUK.d, SANDAL_TUMPUK.h], 0.02],
    ['P10 galon', () => createGalon(ORIGIN), [GALON.r * 2, GALON.r * 2, GALON.h], 0.01],
    ['P09 jemuran', () => createJemuran(), [JEMURAN.w, JEMURAN.d, JEMURAN.h], 0.01],
    ['N06 papan nama', () => createPapanNamaSekre({ cell: CELL, faceMaterial: M, frameMaterial: M }), [PAPAN_NAMA_SEKRE.w, PAPAN_NAMA_SEKRE.d, PAPAN_NAMA_SEKRE.h], 0.01],
    ['N07 spanduk', () => createSpanduk({ cell: CELL, material: M, tieMaterial: M }), [SPANDUK.w, SPANDUK.d, SPANDUK.h], 0.01],
    ['N09 papan pengumuman', () => createPapanPengumuman({ cell: CELL, faceMaterial: M, woodMaterial: M }), [PAPAN_PENGUMUMAN.w, PAPAN_PENGUMUMAN.d, PAPAN_PENGUMUMAN.h], 0.01],
    ['A01 motor bebek', () => createMotorPlaceholders('bebek', ORIGIN), [MOTOR.bebek.w, MOTOR.bebek.l, MOTOR.bebek.h], 0.01],
    ['A02 motor matic', () => createMotorPlaceholders('matic', ORIGIN), [MOTOR.matic.w, MOTOR.matic.l, MOTOR.matic.h], 0.01],
  ];
  for (const [name, make, [x, z, y], tol] of cases) {
    it(name, () => {
      const d = dims(at(make));
      expect(Math.abs(d.x - x), `${name} X ${d.x}`).toBeLessThanOrEqual(tol);
      expect(Math.abs(d.z - z), `${name} Z ${d.z}`).toBeLessThanOrEqual(tol);
      expect(Math.abs(d.y - y), `${name} Y ${d.y}`).toBeLessThanOrEqual(tol);
    });
  }

  it('V08 ilalang setinggi 0,8 m', () => {
    const d = dims(at(() => createIlalang(ORIGIN)));
    expect(d.y).toBeCloseTo(ILALANG.h, 1);
    expect(d.x).toBeLessThanOrEqual(ILALANG.r * 2 + 0.1);
  });

  it('motor: hidung (lampu) di −Z, roda menyentuh tanah', () => {
    const g = at(() => createMotorPlaceholders('bebek', ORIGIN));
    const lamp = g.children.find((m) => m.name.includes('lampu'));
    lamp.geometry.computeBoundingBox();
    expect(lamp.geometry.boundingBox.max.z).toBeLessThan(0);
    expect(dims(g).minY).toBeCloseTo(0, 6);
  });
});

describe('scatterIlalang', () => {
  const ring = [[0, 0], [20, 0], [20, 10], [12, 10], [12, 4], [8, 4], [8, 10], [0, 10]]; // bentuk U
  const pts = scatterIlalang(ring, { count: 400, band: 6, seed: 3 });

  it('tepat count titik, di luar gedung, di dalam pita', () => {
    expect(pts).toHaveLength(400);
    for (const p of pts) {
      expect(pointInPolygon(p.x, p.z, ring)).toBe(false);
      expect(distanceToRing(p.x, p.z, ring)).toBeLessThanOrEqual(6 + 1e-9);
      expect(distanceToRing(p.x, p.z, ring)).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('halaman dalam U ikut ditumbuhi; deterministik', () => {
    expect(pts.some((p) => p.x > 8 && p.x < 12 && p.z > 4 && p.z < 10)).toBe(true);
    expect(scatterIlalang(ring, { count: 400, band: 6, seed: 3 })).toEqual(pts);
  });
});
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/propsCatalog.test.js`
Expected: FAIL — `motor.js` / `ilalang.js` tidak ditemukan.

- [ ] **Langkah 3: Buat `motor.js`**

```js
/**
 * A01 motor bebek & A02 motor matic (parkir padat kampus [T]). Placeholder prosedural berukuran persis
 * katalog (muka/hidung −Z, pusat alas di origin) di-instance; GLB Blender (public/models/unri/*.glb) bila
 * tersedia juga di-instance: setiap mesh GLB → InstancedMesh per material (bukan clone per motor).
 * Warna bodi per instance (material bernama 'unri:bodi' berwarna putih → instanceColor yang mewarnai).
 */
import * as THREE from 'three';
import { instanceParts, colorizeInstances } from '../../siteutil/instanceParts.js';
import { createRandom } from '../../siteutil/rng.js';
import { mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';
import { loadModel } from '../../assets/models.js';
import { boxAt } from './geom.js';

export const MOTOR = Object.freeze({
  bebek: Object.freeze({ id: 'A01', nama: 'motor-bebek', w: 0.7, l: 1.9, h: 1.05, wheelR: 0.29, glb: 'models/unri/motor-bebek.glb' }),
  matic: Object.freeze({ id: 'A02', nama: 'motor-matic', w: 0.7, l: 1.85, h: 1.1, wheelR: 0.25, glb: 'models/unri/motor-matic.glb' }),
});
export const MOTOR_COLORS = Object.freeze([0xc62828, 0x1565c0, 0x212121, 0xeeeeee, 0x6d6d6d, 0x2e7d32, 0xf9a825, 0x8e24aa, 0x37474f, 0xd84315]);

const named = (mat, name) => {
  mat.name = name;
  return mat;
};
const mats = () => currentScope().get('unri:motor:mats', () => ({
  bodi: named(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.1 }), 'unri:bodi'),
  hitam: named(new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.8 }), 'unri:hitam'),
  krom: named(new THREE.MeshStandardMaterial({ color: 0xb0b6ba, roughness: 0.3, metalness: 0.8 }), 'unri:krom'),
  lampu: named(new THREE.MeshStandardMaterial({ color: 0xf4f1e6, roughness: 0.2 }), 'unri:lampu'),
}));

/** Roda (ban + velg) sumbu X di z, jari-jari r. */
const wheel = (r, z) => ({
  ban: new THREE.CylinderGeometry(r, r, 0.09, 12).rotateZ(Math.PI / 2).translate(0, r, z),
  velg: new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.1, 8).rotateZ(Math.PI / 2).translate(0, r, z),
});

function bebekGeometries(s) {
  const wb = s.l / 2 - s.wheelR;
  const [f, b] = [wheel(s.wheelR, -wb), wheel(s.wheelR, wb)];
  return {
    bodi: mergeAll([
      boxAt(0.46, 0.42, 0.06, 0, 0.36, -0.36), // tameng kaki
      boxAt(0.22, 0.12, 0.5, 0, 0.36, -0.08), // lorong tengah (bebek: rangka terbuka)
      boxAt(0.3, 0.26, 0.7, 0, 0.55, 0.3), // bodi belakang
      boxAt(0.28, 0.16, 0.24, 0, 0.82, -0.52), // kepala/batok lampu
      boxAt(0.12, 0.04, 0.4, 0, s.wheelR * 2 + 0.02, -wb), // spakbor depan
      boxAt(0.14, 0.04, 0.32, 0, s.wheelR * 2 + 0.03, wb + 0.04), // spakbor belakang
    ]),
    hitam: mergeAll([
      f.ban, b.ban,
      boxAt(0.28, 0.08, 0.64, 0, 0.81, 0.3), // jok
      boxAt(0.7, 0.03, 0.03, 0, 0.97, -0.5), // stang
      boxAt(0.02, 0.07, 0.02, -0.24, 0.98, -0.5), // tangkai spion kiri
      boxAt(0.02, 0.07, 0.02, 0.24, 0.98, -0.5), // tangkai spion kanan
      boxAt(0.04, 0.5, 0.04, 0.07, s.wheelR, -wb + 0.05), // garpu
      boxAt(0.04, 0.5, 0.04, -0.07, s.wheelR, -wb + 0.05),
      boxAt(0.24, 0.22, 0.3, 0, 0.18, 0.02), // mesin
    ]),
    krom: mergeAll([
      f.velg, b.velg,
      new THREE.CylinderGeometry(0.04, 0.04, 0.6, 10).rotateX(Math.PI / 2).translate(0.17, 0.24, 0.3), // knalpot
    ]),
    lampu: boxAt(0.14, 0.07, 0.03, 0, 0.86, -0.655),
  };
}

function maticGeometries(s) {
  const wb = s.l / 2 - s.wheelR;
  const [f, b] = [wheel(s.wheelR, -wb), wheel(s.wheelR, wb)];
  return {
    bodi: mergeAll([
      boxAt(0.44, 0.5, 0.08, 0, 0.3, -0.42), // apron depan
      boxAt(0.3, 0.06, 0.45, 0, 0.26, -0.05), // dek kaki
      boxAt(0.32, 0.36, 0.78, 0, 0.42, 0.33), // bodi belakang besar
      boxAt(0.3, 0.2, 0.26, 0, 0.84, -0.5), // batok depan
      boxAt(0.12, 0.04, 0.34, 0, s.wheelR * 2 + 0.02, -wb), // spakbor depan
    ]),
    hitam: mergeAll([
      f.ban, b.ban,
      boxAt(0.3, 0.08, 0.66, 0, 0.78, 0.3), // jok
      boxAt(0.7, 0.03, 0.03, 0, 1.02, -0.48), // stang
      boxAt(0.02, 0.08, 0.02, -0.25, 1.02, -0.48), // tangkai spion
      boxAt(0.02, 0.08, 0.02, 0.25, 1.02, -0.48),
      boxAt(0.1, 0.18, 0.6, -0.17, 0.12, 0.35), // CVT kiri
    ]),
    krom: mergeAll([
      f.velg, b.velg,
      new THREE.CylinderGeometry(0.035, 0.035, 0.45, 10).rotateX(Math.PI / 2).translate(0.17, 0.26, 0.45), // knalpot
    ]),
    lampu: boxAt(0.16, 0.07, 0.03, 0, 0.9, -0.645),
  };
}

const placeholderGeos = (kind) => currentScope().get(`unri:motor:${kind}:geo`, () => {
  const s = MOTOR[kind];
  return kind === 'matic' ? maticGeometries(s) : bebekGeometries(s);
});

function colorBodies(group, seed) {
  const rnd = createRandom(seed);
  group.traverse((o) => {
    if (o.isInstancedMesh && /bodi/.test(o.material?.name ?? '')) colorizeInstances(o, MOTOR_COLORS, rnd);
  });
  return group;
}

/**
 * Motor parkir placeholder (instanced; frustum culling per sel `cellSize` m bila > 0; `castShadow` false untuk lot
 * jauh yang padat — hemat pass bayangan).
 * @param {'bebek'|'matic'} kind
 * @param {Array<{x:number, y?:number, z:number, rotY?:number}>} positions
 */
export function createMotorPlaceholders(kind, positions = [], { seed = 19, cellSize = 0, castShadow = true } = {}) {
  const g = placeholderGeos(kind);
  const m = mats();
  const parts = [
    { geometry: g.bodi, material: m.bodi, castShadow, name: `${MOTOR[kind].id}-bodi` },
    { geometry: g.hitam, material: m.hitam, castShadow, name: `${MOTOR[kind].id}-hitam` },
    { geometry: g.krom, material: m.krom, name: `${MOTOR[kind].id}-krom` },
    { geometry: g.lampu, material: m.lampu, name: `${MOTOR[kind].id}-lampu` },
  ];
  const group = instanceParts(parts, positions, `${MOTOR[kind].id}-${MOTOR[kind].nama}`, { cellSize });
  return colorBodies(group, seed);
}

/**
 * Motor dari GLB Blender, di-instance. Panggil DI DALAM withScope(scope) (loadModel memakai currentScope()
 * secara sinkron). null bila GLB gagal/dibatalkan (pemanggil mempertahankan placeholder).
 */
export function loadMotorInstances(kind, positions, { seed = 19, cellSize = 0, isCancelled = () => false, logger = console } = {}) {
  const spec = MOTOR[kind];
  return loadModel(spec.glb).then((source) => {
    if (isCancelled()) return null;
    source.updateMatrixWorld(true);
    const parts = [];
    source.traverse((o) => {
      if (!o.isMesh) return;
      parts.push({ geometry: o.geometry.clone().applyMatrix4(o.matrixWorld), material: o.material, castShadow: true, name: o.material.name });
    });
    if (!parts.length) return null;
    return colorBodies(instanceParts(parts, positions, `${spec.id}-${spec.nama}-glb`, { cellSize }), seed);
  }, (err) => {
    logger.warn(`Model ${spec.id} (${spec.glb}) gagal dimuat, placeholder dipakai:`, err?.message ?? err);
    return null;
  });
}
```

- [ ] **Langkah 4: Buat `ilalang.js`**

```js
/**
 * V08 ilalang (Imperata cylindrica) di gedung mangkrak [T: FH Panam/GGM terbengkalai]: rumpun 6 bilah
 * setinggi 0,8 m dengan malai putih di ujung, warna per-vertex hijau→jerami, goyang angin (applyWind).
 * Instanced (1 draw call). scatterIlalang murni (dites).
 */
import * as THREE from 'three';
import { instanceParts } from '../../siteutil/instanceParts.js';
import { createRandom } from '../../siteutil/rng.js';
import { currentScope } from '../../../engine/ResourceScope.js';
import { applyWind } from '../../shaders/wind.js';
import { pointInPolygon, distanceToRing, ringBounds } from '../../../geo/polygon.js';

export const ILALANG = Object.freeze({ h: 0.8, r: 0.25 });
const BLADES = 6;
const BASE = new THREE.Color(0x4f6b2a);
const TIP = new THREE.Color(0xd9cf9a);
const PLUME = new THREE.Color(0xf1eee2);

function tuftGeometry() {
  const rnd = createRandom(808);
  const pos = [];
  const col = [];
  const uv = [];
  const idx = [];
  for (let b = 0; b < BLADES; b += 1) {
    const a = (b / BLADES) * Math.PI * 2 + rnd.range(-0.3, 0.3);
    const r0 = rnd.range(0.02, 0.12);
    const lean = rnd.range(0.12, ILALANG.r - 0.02);
    const h = ILALANG.h * rnd.range(0.82, 1);
    const [cx, cz] = [Math.cos(a) * r0, Math.sin(a) * r0];
    const [tx, tz] = [Math.cos(a) * lean, Math.sin(a) * lean];
    const [px, pz] = [-Math.sin(a) * 0.022, Math.cos(a) * 0.022];
    const base = pos.length / 3;
    pos.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, tx, h, tz);
    for (const c of [BASE, BASE, b % 2 ? PLUME : TIP]) col.push(c.r, c.g, c.b);
    uv.push(0, 0, 1, 0, 0.5, 1);
    idx.push(base, base + 1, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const geo = () => currentScope().get('unri:ilalang:geo', tuftGeometry);
const mat = () => currentScope().get('unri:ilalang:mat', () => applyWind(
  new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  { weightMode: 'height', heightMin: 0, heightMax: ILALANG.h, amplitude: 0.35, flutter: 0.15 },
));

export function createIlalang(positions = []) {
  return instanceParts([{ geometry: geo(), material: mat(), name: 'V08-ilalang' }], positions, 'V08-ilalang', { cellSize: 30 });
}

/**
 * Sebar rumpun di luar footprint, ≤ `band` m dari tepinya (termasuk halaman dalam bentuk U), lebih rapat
 * dekat dinding. Deterministik per seed.
 * @param {ReadonlyArray<readonly [number, number]>} ring
 * @returns {Array<{x:number, z:number, rotY:number, scale:number}>}
 */
export function scatterIlalang(ring, { count = 1200, band = 8, seed = 11, minGap = 0.3, maxTries = 200000 } = {}) {
  const rnd = createRandom(seed);
  const b = ringBounds(ring);
  const out = [];
  for (let t = 0; t < maxTries && out.length < count; t += 1) {
    const x = rnd.range(b.minX - band, b.maxX + band);
    const z = rnd.range(b.minZ - band, b.maxZ + band);
    if (pointInPolygon(x, z, ring)) continue;
    const d = distanceToRing(x, z, ring);
    if (d < minGap || d > band) continue;
    if (!rnd.chance(1 - (0.65 * d) / band)) continue;
    out.push({ x, z, rotY: rnd.range(0, Math.PI * 2), scale: rnd.range(0.75, 1.2) });
  }
  return out;
}
```

- [ ] **Langkah 5: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/propsCatalog.test.js`
Expected: PASS (13 tes).

- [ ] **Langkah 6: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.
```bash
git add src/world/props/unri/motor.js src/world/props/unri/ilalang.js tests/unri/propsCatalog.test.js
```
```bash
git commit -m "feat(props): motor bebek/matic A01/A02 (placeholder + GLB instanced), ilalang V08, tes dimensi katalog"
```

---

## Task 11: Segmentasi dinding sekretariat (TDD)

**Files:**
- Create: `src/regions/unri-lembaga/sekretariat.walls.js`
- Test: `tests/unri/sekreWalls.test.js`

- [ ] **Langkah 1: Tulis tes yang gagal**

`tests/unri/sekreWalls.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { wallSegments, clipOpenings, wallBoxes } from '../../src/regions/unri-lembaga/sekretariat.walls.js';

const area = (r) => (r.u1 - r.u0) * (r.v1 - r.v0);
const overlap = (a, b) => Math.max(0, Math.min(a.u1, b.u1) - Math.max(a.u0, b.u0)) * Math.max(0, Math.min(a.v1, b.v1) - Math.max(a.v0, b.v0));

describe('wallSegments', () => {
  const door = { u0: 0.5, u1: 1.4, v0: 0.15, v1: 2.25 };
  const win = { u0: 2.15, u1: 3.35, v0: 1.1, v1: 2.25 };
  const roster = { u0: 2.15, u1: 3.35, v0: 2.45, v1: 2.75 };
  const segs = wallSegments(4.1924, 3.75, [roster, door, win]);

  it('luas dinding = luas penuh − luas bukaan (bukaan bertumpuk vertikal didukung)', () => {
    const total = segs.reduce((s, r) => s + area(r), 0);
    expect(total).toBeCloseTo(4.1924 * 3.75 - area(door) - area(win) - area(roster), 9);
  });

  it('segmen tidak saling tumpang dan tidak menutup bukaan', () => {
    for (let i = 0; i < segs.length; i += 1) {
      for (let j = i + 1; j < segs.length; j += 1) expect(overlap(segs[i], segs[j])).toBeCloseTo(0, 12);
      for (const o of [door, win, roster]) expect(overlap(segs[i], o)).toBeCloseTo(0, 12);
    }
  });

  it('tanpa bukaan = satu segmen penuh; bukaan di tepi tidak membuat segmen nol', () => {
    expect(wallSegments(5, 3)).toEqual([{ u0: 0, u1: 5, v0: 0, v1: 3 }]);
    const edge = wallSegments(5, 3, [{ u0: 0, u1: 1, v0: 0, v1: 3 }]);
    expect(edge).toEqual([{ u0: 1, u1: 5, v0: 0, v1: 3 }]);
  });

  it('melempar untuk bukaan bertumpuk atau di luar dinding', () => {
    expect(() => wallSegments(5, 3, [{ u0: 1, u1: 2, v0: 0, v1: 1 }, { u0: 1.5, u1: 2.5, v0: 0, v1: 1 }])).toThrow(/bertumpuk/);
    expect(() => wallSegments(5, 3, [{ u0: 1, u1: 2, v0: 0.5, v1: 1.5 }, { u0: 1, u1: 2, v0: 1, v1: 2 }])).toThrow(/bertumpuk/);
    expect(() => wallSegments(5, 3, [{ u0: 4, u1: 6, v0: 0, v1: 1 }])).toThrow(/luar/);
  });
});

describe('clipOpenings & wallBoxes', () => {
  it('pita plint 0,6 m: pintu terpotong, jendela hilang', () => {
    const c = clipOpenings([{ u0: 0.5, u1: 1.4, v0: 0.15, v1: 2.25 }, { u0: 2, u1: 3, v0: 1.1, v1: 2.25 }], 0.6);
    expect(c).toEqual([{ u0: 0.5, u1: 1.4, v0: 0.15, v1: 0.6 }]);
  });

  it('balok sumbu z: tebal di X, panjang di Z, posisi dari `from`', () => {
    const [g] = wallBoxes([{ u0: 1, u1: 3, v0: 0.5, v1: 2.5 }], { axis: 'z', at: 7.71, from: -8.38, thickness: 0.15 });
    g.computeBoundingBox();
    const b = g.boundingBox;
    expect(b.max.x - b.min.x).toBeCloseTo(0.15, 6);
    expect(b.max.z - b.min.z).toBeCloseTo(2, 6);
    expect((b.max.z + b.min.z) / 2).toBeCloseTo(-8.38 + 2, 6);
    expect(b.min.y).toBeCloseTo(0.5, 6);
  });
});
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/sekreWalls.test.js`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Langkah 3: Buat `sekretariat.walls.js`**

```js
/**
 * Dinding berbukaan (pintu, jendela nako, roster). wallSegments (MURNI): persegi panjang padat (u sepanjang
 * dinding, v tinggi dari tanah) = dinding dikurangi bukaan. Bukaan ber-u sama (jendela + roster di atasnya)
 * diperlakukan sebagai satu kolom bertumpuk vertikal. wallBoxes: segmen → balok lokal-gedung.
 */
import { boxAt } from '../../world/props/unri/geom.js';

const EPS = 1e-6;

/**
 * @param {number} length @param {number} height
 * @param {Array<{u0:number,u1:number,v0:number,v1:number}>} openings
 * @returns {Array<{u0:number,u1:number,v0:number,v1:number}>}
 */
export function wallSegments(length, height, openings = []) {
  if (!(length > 0 && height > 0)) throw new RangeError('dinding: panjang & tinggi harus > 0');
  const cols = new Map();
  openings.forEach((o, i) => {
    const okU = o.u0 >= -EPS && o.u1 <= length + EPS && o.u1 - o.u0 > EPS;
    const okV = o.v0 >= -EPS && o.v1 <= height + EPS && o.v1 - o.v0 > EPS;
    if (!okU || !okV) throw new RangeError(`bukaan ${i} di luar dinding`);
    const key = `${o.u0.toFixed(6)}|${o.u1.toFixed(6)}`;
    if (!cols.has(key)) cols.set(key, []);
    cols.get(key).push(o);
  });
  const columns = [...cols.values()]
    .map((list) => ({ u0: list[0].u0, u1: list[0].u1, spans: [...list].sort((a, b) => a.v0 - b.v0) }))
    .sort((a, b) => a.u0 - b.u0);
  columns.forEach((c, i) => {
    if (i > 0 && c.u0 < columns[i - 1].u1 - EPS) throw new RangeError('bukaan bertumpuk (kolom)');
    c.spans.forEach((s, k) => {
      if (k > 0 && s.v0 < c.spans[k - 1].v1 - EPS) throw new RangeError('bukaan bertumpuk (vertikal)');
    });
  });
  const out = [];
  const push = (u0, u1, v0, v1) => {
    if (u1 - u0 > EPS && v1 - v0 > EPS) out.push({ u0, u1, v0, v1 });
  };
  let u = 0;
  for (const c of columns) {
    push(u, c.u0, 0, height);
    let v = 0;
    for (const s of c.spans) {
      push(c.u0, c.u1, v, s.v0);
      v = s.v1;
    }
    push(c.u0, c.u1, v, height);
    u = c.u1;
  }
  push(u, length, 0, height);
  return out;
}

/** Bukaan yang memotong pita setinggi `h` (mis. plint 0,6 m), dipotong di h. */
export function clipOpenings(openings, h) {
  return openings.filter((o) => o.v0 < h).map((o) => ({ u0: o.u0, u1: o.u1, v0: o.v0, v1: Math.min(o.v1, h) }));
}

/**
 * Segmen → balok lokal-gedung. axis 'z': dinding sejajar Z berpusat di x = at; axis 'x': sejajar X di z = at.
 * u diukur dari `from` (koordinat sepanjang sumbu dinding).
 */
export function wallBoxes(segments, { axis, at, from, thickness, y0 = 0 }) {
  return segments.map((s) => {
    const len = s.u1 - s.u0;
    const h = s.v1 - s.v0;
    const mid = from + (s.u0 + s.u1) / 2;
    return axis === 'z' ? boxAt(thickness, h, len, at, y0 + s.v0, mid) : boxAt(len, h, thickness, mid, y0 + s.v0, at);
  });
}
```

- [ ] **Langkah 4: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/sekreWalls.test.js`
Expected: PASS (6 tes).

- [ ] **Langkah 5: Commit**

```bash
git add src/regions/unri-lembaga/sekretariat.walls.js tests/unri/sekreWalls.test.js
```
```bash
git commit -m "feat(lembaga): segmentasi dinding berbukaan (pintu/jendela/roster bertumpuk) untuk sekretariat"
```

---

## Task 12: Tekstur kanvas, atlas isi sekre, dan material region

**Files:**
- Create: `src/regions/unri-lembaga/sekretariat.textures.js`, `src/regions/unri-lembaga/sekretariat.atlas.js`, `src/regions/unri-lembaga/materials.js`

- [ ] **Langkah 1: `sekretariat.textures.js`**

```js
/**
 * Tekstur kanvas sekretariat (null tanpa document → material warna polos): keramik selasar 40 × 40 cm krem
 * dengan nat, plafon triplek bercat dengan nat 1,2 m dan noda bocor samar, roster beton motif bunga
 * (alpha berlubang), gradasi kolam cahaya. UV geometri bersatuan meter (keramik/plafon) atau blok (roster).
 */
import * as THREE from 'three';
import { hasDocument } from '../../world/props/canvasText.js';
import { createRandom } from '../../world/siteutil/rng.js';
import { currentScope } from '../../engine/ResourceScope.js';

export const KERAMIK_M = 1.6; // satu tekstur = 4 × 4 keramik 40 cm
export const PLAFON_M = 1.2;
export const ROSTER_M = 0.2;

function canvasTexture(size, draw, { repeatM = null, wrap = false, srgb = true } = {}) {
  if (!hasDocument()) return null;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeatM || wrap) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  if (repeatM) t.repeat.set(1 / repeatM, 1 / repeatM);
  return t;
}

function drawKeramik(ctx, s) {
  const rnd = createRandom(4040);
  const n = 4;
  const cell = s / n;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const k = 0.96 + rnd.range(0, 0.06);
      ctx.fillStyle = `rgb(${Math.round(232 * k)},${Math.round(223 * k)},${Math.round(203 * k)})`;
      ctx.fillRect(i * cell, j * cell, cell, cell);
      if (rnd.chance(0.12)) {
        ctx.strokeStyle = 'rgba(120,110,95,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(i * cell + rnd.range(4, cell - 4), j * cell + 3);
        ctx.lineTo(i * cell + rnd.range(4, cell - 4), j * cell + cell - 3);
        ctx.stroke();
      }
    }
  }
  ctx.fillStyle = '#b9b0a0';
  for (let k = 0; k <= n; k += 1) {
    ctx.fillRect(k * cell - 1.5, 0, 3, s);
    ctx.fillRect(0, k * cell - 1.5, s, 3);
  }
}

function drawPlafon(ctx, s) {
  ctx.fillStyle = '#f1ede4';
  ctx.fillRect(0, 0, s, s);
  const rnd = createRandom(5151);
  for (let i = 0; i < 300; i += 1) {
    ctx.fillStyle = `rgba(150,140,120,${rnd.range(0.02, 0.05)})`;
    ctx.fillRect(rnd.range(0, s), rnd.range(0, s), 3, 3);
  }
  const g = ctx.createRadialGradient(s * 0.7, s * 0.3, 2, s * 0.7, s * 0.3, s * 0.18);
  g.addColorStop(0, 'rgba(160,120,70,0.10)');
  g.addColorStop(1, 'rgba(160,120,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#d3ccbf';
  ctx.fillRect(0, 0, s, 3);
  ctx.fillRect(0, 0, 3, s);
}

function drawRoster(ctx, s) {
  ctx.fillStyle = '#d8d1c2';
  ctx.fillRect(0, 0, s, s);
  ctx.globalCompositeOperation = 'destination-out';
  const r = s * 0.19;
  for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(s / 2, s / 2 - r);
  ctx.lineTo(s / 2 + r, s / 2);
  ctx.lineTo(s / 2, s / 2 + r);
  ctx.lineTo(s / 2 - r, s / 2);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(90,85,75,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, s - 2, s - 2);
}

function drawPool(ctx, s) {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#666666');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

export const keramikTexture = () => currentScope().get('lembaga:tex:keramik', () => canvasTexture(256, drawKeramik, { repeatM: KERAMIK_M }));
export const plafonTexture = () => currentScope().get('lembaga:tex:plafon', () => canvasTexture(256, drawPlafon, { repeatM: PLAFON_M }));
export const rosterTexture = () => currentScope().get('lembaga:tex:roster', () => canvasTexture(128, drawRoster, { wrap: true }));
export const poolTexture = () => currentScope().get('lembaga:tex:kolam', () => canvasTexture(64, drawPool, { srgb: false }));
```

- [ ] **Langkah 2: `sekretariat.atlas.js`**

```js
/**
 * Isi atlas zona Lembaga (1024 × 2048): 8 papan nama sekre (dari sekre.data.js), 12 stiker, papan
 * pengumuman, 3 spanduk ormawa, nama gedung (stadion mini, student center, rusunawa) dan plang FH.
 * Semua teks generik [INFERENSI] kecuali nama BEM/DPM & nama gedung OSM; tagline "UNGGUL DAN BERMARTABAT"
 * = tagline Milad 60 UNRI ([S], riset §6).
 */
import { createCanvasAtlas, fitFont } from '../../world/props/unri/atlas.js';
import { drawPapanNama, PAPAN_NAMA_SEKRE } from '../../world/props/unri/papanNamaSekre.js';
import { drawSpanduk, SPANDUK } from '../../world/props/unri/spanduk.js';
import { drawPapanPengumuman, PAPAN_PENGUMUMAN } from '../../world/props/unri/papanPengumuman.js';
import { toCss } from '../../world/props/canvasText.js';

export const STICKERS = Object.freeze([
  { teks: 'HIDUP MAHASISWA!', bentuk: 'bulat', latar: 0xc8102e, warna: 0xffffff },
  { teks: 'UNRI', bentuk: 'bulat', latar: 0x7ec8ee, warna: 0x0d3b66 },
  { teks: 'KAMPUS BIRU LANGIT', bentuk: 'kotak', latar: 0x7ec8ee, warna: 0xffffff },
  { teks: 'SALAM LESTARI', bentuk: 'bulat', latar: 0x2e7d32, warna: 0xffffff },
  { teks: 'PERS', bentuk: 'kotak', latar: 0x1b1b1b, warna: 0xf2c200 },
  { teks: 'SENI', bentuk: 'bulat', latar: 0x6a1b9a, warna: 0xffffff },
  { teks: 'DONOR DARAH', bentuk: 'kotak', latar: 0xe53935, warna: 0xffffff },
  { teks: 'BERSIH ITU SEHAT', bentuk: 'kotak', latar: 0x00897b, warna: 0xffffff },
  { teks: 'OPREC', bentuk: 'bulat', latar: 0xf9a825, warna: 0x1b1b1b },
  { teks: 'RAPAT TIAP KAMIS', bentuk: 'kotak', latar: 0xffffff, warna: 0xc8102e },
  { teks: 'LANCANG KUNING', bentuk: 'bulat', latar: 0xf2c200, warna: 0x1f7a3a },
  { teks: 'DILARANG MEROKOK', bentuk: 'bulat', latar: 0xffffff, warna: 0xc8102e },
].map(Object.freeze));

export const NOTICES = Object.freeze(['OPEN RECRUITMENT', 'RAPAT PLENO', 'JADWAL PIKET', 'LOMBA DEBAT', 'PENGUMUMAN', 'KEHILANGAN']);

export const SPANDUK_TEKS = Object.freeze([
  { judul: 'OPEN RECRUITMENT ANGGOTA BARU', sub: 'DAFTAR DI SEKRETARIAT — KAMPUS BIRU LANGIT', latar: 0xf2c200, teks: 0x0d3b66, aksen: 0xc8102e },
  { judul: 'MUSYAWARAH BESAR ORMAWA', sub: 'SEKRETARIAT LEMBAGA MAHASISWA UNIVERSITAS RIAU', latar: 0x0d3b66, teks: 0xffffff, aksen: 0xf2c200 },
  { judul: 'SELAMAT DATANG MAHASISWA BARU', sub: 'UNIVERSITAS RIAU — UNGGUL DAN BERMARTABAT', latar: 0x1f7a3a, teks: 0xffffff, aksen: 0xf2c200 },
].map(Object.freeze));

export const NAMA_GEDUNG = Object.freeze({
  'nama:stadion': { judul: 'STADION MINI UNIVERSITAS RIAU', latar: 0x123a6b, teks: 0xffffff, w: 960, h: 72 },
  'nama:sc': { judul: 'STUDENT CENTER', sub: 'UNIVERSITAS RIAU', latar: 0x111111, teks: 0xffffff, w: 512, h: 128 },
  'nama:rusun': { judul: 'RUSUNAWA MAHASISWA', sub: 'UNIVERSITAS RIAU', latar: 0xe9e4d8, teks: 0x0d3b66, w: 512, h: 128 },
  'plang:fh': { judul: 'DILARANG MASUK', sub: 'AREA PROYEK', latar: 0xffffff, teks: 0xc8102e, w: 256, h: 128 },
});

function drawSticker(ctx, w, h, s) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = toCss(s.latar);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  if (s.bentuk === 'bulat') {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(w * 0.04, h * 0.22, w * 0.92, h * 0.56);
    ctx.strokeRect(w * 0.04, h * 0.22, w * 0.92, h * 0.56);
  }
  ctx.fillStyle = toCss(s.warna);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = s.teks.split(' ');
  const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [s.teks];
  lines.forEach((line, i) => {
    fitFont(ctx, line, w * 0.8, h * 0.2, 'bold');
    ctx.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * h * 0.2);
  });
}

function drawNama(ctx, w, h, { judul, sub = '', latar, teks }) {
  ctx.fillStyle = toCss(latar);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = toCss(teks);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFont(ctx, judul, w * 0.92, h * (sub ? 0.42 : 0.62), 'bold');
  ctx.fillText(judul, w / 2, sub ? h * 0.4 : h / 2);
  if (sub) {
    fitFont(ctx, sub, w * 0.8, h * 0.2, 'bold');
    ctx.fillText(sub, w / 2, h * 0.76);
  }
}

/** Atlas zona (satu tekstur untuk semua decal kanvas region). */
export function createLembagaAtlas(rooms) {
  const cells = [
    ...rooms.map((r) => ({ id: `sign:${r.index}`, w: PAPAN_NAMA_SEKRE.px.w, h: PAPAN_NAMA_SEKRE.px.h, draw: (ctx, w, h) => drawPapanNama(ctx, w, h, r) })),
    ...STICKERS.map((s, k) => ({ id: `stiker:${k}`, w: 96, h: 96, draw: (ctx, w, h) => drawSticker(ctx, w, h, s) })),
    { id: 'papan:pengumuman', w: PAPAN_PENGUMUMAN.px.w, h: PAPAN_PENGUMUMAN.px.h, draw: (ctx, w, h) => drawPapanPengumuman(ctx, w, h, { notices: NOTICES }) },
    ...SPANDUK_TEKS.map((t, k) => ({ id: `spanduk:${k}`, w: SPANDUK.px.w, h: SPANDUK.px.h, draw: (ctx, w, h) => drawSpanduk(ctx, w, h, t) })),
    ...Object.entries(NAMA_GEDUNG).map(([id, n]) => ({ id, w: n.w, h: n.h, draw: (ctx, w, h) => drawNama(ctx, w, h, n) })),
  ];
  return createCanvasAtlas({ width: 1024, height: 2048, pad: 4, cells });
}
```

- [ ] **Langkah 3: `materials.js`**

```js
/**
 * Material bersama region Lembaga: satu set per ResourceScope region (dilepas bersama region). Nama material
 * memudahkan diagnosis draw call; `userData.nightEmissive` dibaca registry malam (TimeOfDay.lights) untuk
 * lampu selasar dan kolam cahaya aditif (tanpa PointLight tambahan).
 */
import * as THREE from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { surfaceMaps } from '../../world/textures/surfaces.js';
import { surfaceMaterial } from '../../world/Ground.materials.js';
import { createLembagaAtlas } from './sekretariat.atlas.js';
import { keramikTexture, plafonTexture, rosterTexture, poolTexture } from './sekretariat.textures.js';
import { LEMBAGA_LAYOUT } from './layout.js';

const std = (name, params) => {
  const m = new THREE.MeshStandardMaterial(params);
  m.name = name;
  m.userData.baseRoughness = params.roughness ?? 1;
  return m;
};
const withMap = (map, params) => (map ? { ...params, map } : params);

function createMaterials(atlas) {
  const tex = { keramik: keramikTexture(), plafon: plafonTexture(), roster: rosterTexture(), pool: poolTexture() };
  const lampu = std('lampuSelasar', { color: 0xfff6e0, emissive: 0xffe2a8, emissiveIntensity: 0.05, roughness: 0.4 });
  lampu.userData.nightEmissive = { on: 2.6, off: 0.05 };
  const kolam = std('kolamCahaya', {
    color: 0x000000, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 1, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, ...(tex.pool ? { emissiveMap: tex.pool } : {}),
  });
  kolam.userData.nightEmissive = { on: 1.1, off: 0 };
  const rabat = surfaceMaterial('concrete', { color: 0xc9c4b8 });
  rabat.name = 'rabatBeton';
  return {
    dinding: std('dindingKrem', { color: 0xe8dcc0, roughness: 0.92, ...surfaceMaps('concrete', 2) }),
    plint: std('plintAbu', { color: 0x8d8c86, roughness: 0.95 }),
    putih: std('putihKusam', { color: 0xf3efe6, roughness: 0.85 }),
    pintu: std('pintuCat', { vertexColors: true, roughness: 0.65 }),
    kusen: std('kusenKayu', { color: 0x6a4a30, roughness: 0.8 }),
    alu: std('aluminium', { color: 0xa9b1b6, roughness: 0.45, metalness: 0.35 }),
    kaca: std('kacaNako', { color: 0xa7c4cf, roughness: 0.08, transparent: true, opacity: 0.42, depthWrite: false }),
    gelap: std('ruangGelap', { color: 0x1f1c18, roughness: 1 }),
    roster: std('rosterBeton', withMap(tex.roster, { color: 0xd9d2c3, roughness: 0.95, side: THREE.DoubleSide, alphaTest: 0.5 })),
    seng: std('sengAtap', { color: 0x8e9aa6, roughness: 0.5, metalness: 0.35, side: THREE.DoubleSide, ...surfaceMaps('metalSeam', 0.4) }),
    talang: std('talangPvc', { color: 0xcfd3d4, roughness: 0.6 }),
    plafon: std('plafonSelasar', withMap(tex.plafon, { color: 0xf1ede4, roughness: 0.95 })),
    keramik: std('keramikSelasar', withMap(tex.keramik, { color: 0xffffff, roughness: 0.35 })),
    rabat,
    lampu,
    kolam,
    atlas: std('atlasDecal', withMap(atlas.texture, { color: 0xffffff, roughness: 0.8, alphaTest: 0.5 })),
    spanduk: std('spandukKain', withMap(atlas.texture, { color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide })),
    kayu: std('kayuPapan', { color: 0x8a5a36, roughness: 0.85 }),
    besi: std('besiPagar', { color: 0x2f5d3a, roughness: 0.6, metalness: 0.3 }),
    tali: std('taliHitam', { color: 0x3a3a3a, roughness: 1 }),
    beton: std('betonTribun', { color: 0xbdb8ad, roughness: 0.95, ...surfaceMaps('concrete', 2) }),
    baja: std('bajaCat', { color: 0x5b6670, roughness: 0.55, metalness: 0.5 }),
    seng2: std('sengBerkarat', { color: 0x9c7a5b, roughness: 0.75, metalness: 0.25, side: THREE.DoubleSide, ...surfaceMaps('metalSeam', 0.4) }),
    tanah: std('tanahUrug', { color: 0x9b6b47, roughness: 1 }),
    vcolor: std('vertexWarna', { vertexColors: true, roughness: 0.9 }),
  };
}

/** Material + atlas region (cache per scope aktif). */
export function lembagaMaterials(rooms = LEMBAGA_LAYOUT.rooms) {
  const atlas = currentScope().get('lembaga:atlas', () => createLembagaAtlas(rooms));
  const mats = currentScope().get('lembaga:materials', () => createMaterials(atlas));
  return { mats, atlas };
}
```

- [ ] **Langkah 4: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.
```bash
git add src/regions/unri-lembaga/sekretariat.textures.js src/regions/unri-lembaga/sekretariat.atlas.js src/regions/unri-lembaga/materials.js
```
```bash
git commit -m "feat(lembaga): tekstur keramik/plafon/roster, atlas papan nama & stiker & spanduk, material region"
```

---

## Task 13: Bagian sekretariat — pintu, jendela nako, roster, lampu, atap seng pelana, plafon, gable

**Files:**
- Create: `src/regions/unri-lembaga/sekretariat.parts.js`, `src/regions/unri-lembaga/sekretariat.roof.js`

- [ ] **Langkah 1: `sekretariat.parts.js`**

```js
/**
 * Bagian kanonik sekretariat (MUKA DEPAN −Z, sumbu dinding di z = 0, alas y = 0), ditempatkan dengan
 * placeGeos({x, y, z, rotY}). Keluaran = daftar geometri per material (digabung mergeByMaterial).
 * [INFERENSI pola kampus negeri 1980–2000-an, riset §4]: jendela nako aluminium 2 kolom bilah kaca,
 * pintu panel kayu bercat, roster beton di atas jendela, lampu bohlam di plafon selasar.
 */
import * as THREE from 'three';
import { boxAt, paint, facePlane } from '../../world/props/unri/geom.js';
import { ROSTER_M } from './sekretariat.textures.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);

/** Terapkan transform {x, y, z, rotY} ke setiap geometri (dimutasi) dan kembalikan daftar yang sama. */
export function placeGeos(geos, { x = 0, y = 0, z = 0, rotY = 0 }) {
  _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_up, rotY), _s);
  for (const g of geos) g.applyMatrix4(_m);
  return geos;
}

/** Jendela nako: bingkai aluminium, 2 kolom bilah kaca miring (atas ke luar), latar ruang gelap di dalam. */
export function nakoWindow(w = 1.2, h = 1.15, { tilt = 0.3, darkDepth = 0.12 } = {}) {
  const frame = [
    boxAt(w, 0.04, 0.06, 0, 0, 0), boxAt(w, 0.04, 0.06, 0, h - 0.04, 0),
    boxAt(0.04, h, 0.06, -(w / 2 - 0.02), 0, 0), boxAt(0.04, h, 0.06, w / 2 - 0.02, 0, 0),
    boxAt(0.03, h, 0.05, 0, 0, 0),
  ];
  const slatW = w / 2 - 0.06;
  const n = Math.floor((h - 0.08) / 0.13);
  const glass = [];
  for (const cx of [-w / 4, w / 4]) {
    for (let k = 0; k < n; k += 1) glass.push(new THREE.BoxGeometry(slatW, 0.12, 0.005).rotateX(-tilt).translate(cx, 0.105 + k * 0.13, 0));
  }
  return { frame, glass, dark: [boxAt(w - 0.06, h - 0.06, 0.01, 0, 0.03, darkDepth)] };
}

/** Ambang jendela luar (putih) sedikit menonjol. */
export const windowSill = (w = 1.2) => [boxAt(w + 0.1, 0.04, 0.08, 0, -0.04, -0.06)];

/**
 * Pintu panel kayu bercat (warna per ormawa, vertexColors) + kusen + gagang + stiker.
 * stickers: [{cell, x, y, size}] koordinat muka daun pintu.
 */
export function panelDoor({ w = 0.9, h = 2.1, color, stickers = [], depth = 0.17 }) {
  const shade = new THREE.Color(color).multiplyScalar(0.8).getHex();
  return {
    leaf: [
      paint(boxAt(w - 0.1, h - 0.06, 0.04, 0, 0.01, 0.02), color),
      paint(boxAt(0.6, 0.72, 0.012, 0, 0.28, 0.004), shade),
      paint(boxAt(0.6, 0.72, 0.012, 0, 1.12, 0.004), shade),
    ],
    kusen: [boxAt(0.05, h, depth, -(w / 2 - 0.025), 0, 0), boxAt(0.05, h, depth, w / 2 - 0.025, 0, 0), boxAt(w, 0.05, depth, 0, h - 0.05, 0)],
    handle: [boxAt(0.12, 0.025, 0.03, w / 2 - 0.17, 1.0, -0.015), boxAt(0.05, 0.1, 0.01, w / 2 - 0.13, 0.96, -0.005)],
    decals: stickers.map(({ cell, x, y, size }) => facePlane(size, size, { x, y, z: -0.008, cell })),
  };
}

/** Bidang roster (blok 20 cm, UV dalam satuan blok), muka −Z, alas y = 0. */
export function rosterPlane(w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, (uv.getX(i) * w) / ROSTER_M, (uv.getY(i) * h) / ROSTER_M);
  return g.rotateY(Math.PI).translate(0, h / 2, 0);
}

/** Lampu bohlam plafon: dudukan (putih) + bohlam emisif, digantung di bawah y. */
export function ceilingLamp(bx, y, bz) {
  return {
    putih: [new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12).translate(bx, y - 0.015, bz)],
    lampu: [new THREE.SphereGeometry(0.055, 10, 8).translate(bx, y - 0.08, bz)],
  };
}

/** Lampu dinding di balok ambang mulut selasar: siku + bohlam. sz = ±1 (ujung). */
export function lintelLamp(bz, y, sz) {
  return {
    putih: [boxAt(0.06, 0.06, 0.14, 0, y + 0.02, bz - sz * 0.05)],
    lampu: [new THREE.SphereGeometry(0.06, 10, 8).translate(0, y - 0.03, bz)],
  };
}

/** Kolam cahaya lantai (aditif emisif) di bawah lampu. */
export const floorPool = (bx, y, bz, size) => new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2).translate(bx, y, bz);
```

- [ ] **Langkah 2: `sekretariat.roof.js`**

```js
/**
 * Atap pelana seng gelombang (bubungan sejajar Z lokal-gedung, kemiringan 20°, tritisan 0,8 m sisi panjang,
 * 0,6 m ujung pelana), talang + pipa turun di 4 sudut, lisplang putih, plafon selasar bergaris panel,
 * dinding gable segitiga dengan lubang roster ventilasi di atas mulut selasar. [INFERENSI: OSM tag
 * building:roof=tin umum di kampus; bentuk pelana = pola gedung kuliah lama, riset §2 & spec §7.1 K01]
 */
import * as THREE from 'three';
import { boxAt, quad } from '../../world/props/unri/geom.js';
import { rosterPlane } from './sekretariat.parts.js';

/** Elevasi atap (lokal-gedung, dari tanah pad). */
export function roofLevels(dim) {
  const tan = Math.tan(dim.roof.pitch);
  const E = dim.hx + dim.roof.eave;
  const L = dim.hz + dim.roof.gable;
  const ridgeY = dim.wallTop + 0.1 + dim.hx * tan;
  return { tan, E, L, ridgeY, eaveY: ridgeY - E * tan, slope: E / Math.cos(dim.roof.pitch) };
}

export function roofGeometries(dim) {
  const { E, L, ridgeY, eaveY, slope: S, tan } = roofLevels(dim);
  const seng = [
    quad([[0, ridgeY, -L], [0, ridgeY, L], [E, eaveY, L], [E, eaveY, -L]], [[-L, 0], [L, 0], [L, S], [-L, S]]),
    quad([[0, ridgeY, L], [0, ridgeY, -L], [-E, eaveY, -L], [-E, eaveY, L]], [[L, 0], [-L, 0], [-L, S], [L, S]]),
    boxAt(0.36, 0.05, 2 * L, 0, ridgeY - 0.02, 0),
  ];
  const talang = [];
  const putih = [];
  for (const sx of [-1, 1]) {
    talang.push(boxAt(0.12, 0.1, 2 * L, sx * (E + 0.03), eaveY - 0.12, 0));
    putih.push(boxAt(0.025, 0.2, 2 * L, sx * (E - 0.01), eaveY - 0.17, 0));
    for (const sz of [-1, 1]) {
      const px = sx * (dim.hx + 0.07);
      const pz = sz * (dim.hz - 0.3);
      const h = eaveY - 0.32;
      talang.push(new THREE.CylinderGeometry(0.045, 0.045, h, 8).translate(px, 0.12 + h / 2, pz));
      talang.push(boxAt(E + 0.03 - dim.hx - 0.07 + 0.06, 0.06, 0.06, sx * ((dim.hx + 0.07 + E + 0.03) / 2), eaveY - 0.2, pz));
      talang.push(boxAt(0.06, 0.06, 0.2, px, 0.06, pz + sz * 0.08));
      const rake = new THREE.BoxGeometry(S, 0.2, 0.025).rotateZ(-sx * dim.roof.pitch);
      putih.push(rake.translate(sx * (E / 2), (ridgeY + eaveY) / 2 - 0.09, sz * (L + 0.0125)));
    }
  }
  const c = dim.corridorHalf;
  const y = dim.plafonY;
  const plafon = [quad([[-c, y, -dim.hz], [c, y, -dim.hz], [c, y, dim.hz], [-c, y, dim.hz]], [[-c, -dim.hz], [c, -dim.hz], [c, dim.hz], [-c, dim.hz]])];
  return { seng, talang, putih, plafon, tan };
}

/** Dinding gable (segitiga di atas wallTop) dengan lubang ventilasi berisi roster. */
export function gableGeometries(dim) {
  const { tan } = roofLevels(dim);
  const apex = dim.hx * tan + 0.04;
  const vent = { w: 1.6, y0: 0.65, h: 0.5 };
  const shape = new THREE.Shape();
  shape.moveTo(-dim.hx, 0);
  shape.lineTo(dim.hx, 0);
  shape.lineTo(0, apex);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-vent.w / 2, vent.y0);
  hole.lineTo(-vent.w / 2, vent.y0 + vent.h);
  hole.lineTo(vent.w / 2, vent.y0 + vent.h);
  hole.lineTo(vent.w / 2, vent.y0);
  hole.closePath();
  shape.holes.push(hole);
  const walls = [];
  const vents = [];
  for (const sz of [-1, 1]) {
    const g = new THREE.ShapeGeometry(shape);
    if (sz < 0) g.rotateY(Math.PI);
    walls.push(g.translate(0, dim.wallTop, sz * dim.hz));
    const r = rosterPlane(vent.w, vent.h);
    if (sz > 0) r.rotateY(Math.PI);
    vents.push(r.translate(0, dim.wallTop + vent.y0, sz * (dim.hz - dim.wallT / 2)));
  }
  return { walls, vents };
}
```

- [ ] **Langkah 3: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.
```bash
git add src/regions/unri-lembaga/sekretariat.parts.js src/regions/unri-lembaga/sekretariat.roof.js
```
```bash
git commit -m "feat(lembaga): bagian sekretariat (pintu panel, nako, roster, lampu) + atap pelana seng, talang, gable"
```

---

## Task 14: H01 Sekretariat Lembaga Mahasiswa (rakitan bertahap) + teras + tes budget

**Files:**
- Create: `src/regions/unri-lembaga/staged.js`, `src/regions/unri-lembaga/sekretariat.js`, `src/regions/unri-lembaga/terrace.js`
- Test: `tests/unri/sekretariatBudget.test.js`

- [ ] **Langkah 1: Tulis tes budget yang gagal**

`tests/unri/sekretariatBudget.test.js`:
```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createResourceScope, withScope } from '../../src/engine/ResourceScope.js';
import { createSekretariatBuilder, createSekreSurfaces } from '../../src/regions/unri-lembaga/sekretariat.js';
import { createTerraceBuilder } from '../../src/regions/unri-lembaga/terrace.js';
import { lembagaMaterials } from '../../src/regions/unri-lembaga/materials.js';
import { SEKRE_DIM } from '../../src/regions/unri-lembaga/layout.js';
import { roofLevels } from '../../src/regions/unri-lembaga/sekretariat.roof.js';
import { toSekre } from '../../src/regions/unri-lembaga/placement.js';

function runStaged(b) {
  for (const s of b.steps) s();
  return b.finish();
}

function stats(root) {
  let draws = 0;
  let tris = 0;
  const mats = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    draws += 1;
    mats.add(o.material);
    const g = o.geometry;
    const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    tris += n * (o.isInstancedMesh ? o.count : 1);
  });
  return { draws, tris, mats: mats.size };
}

describe('H01 sekretariat: rakitan & budget', () => {
  const scope = createResourceScope('uji-lembaga');
  const flat = () => 12.5;
  const { building, surfaces, terrace } = withScope(scope, () => {
    const { mats, atlas } = lembagaMaterials();
    return {
      building: runStaged(createSekretariatBuilder({ baseY: 12.5, mats, atlas })),
      surfaces: createSekreSurfaces({ baseY: 12.5, mats }),
      terrace: runStaged(createTerraceBuilder({ heightAt: flat, mats, atlas })),
    };
  });

  it('gedung ≤ 20 draw call, ≤ 25k segitiga (katalog H01)', () => {
    const s = stats(building);
    expect(s.draws).toBeLessThanOrEqual(20);
    expect(s.tris).toBeLessThanOrEqual(25000);
  });

  it('teras ≤ 22 draw call', () => {
    expect(stats(terrace).draws).toBeLessThanOrEqual(22);
  });

  it('ukuran di sumbu gedung = footprint + tritisan/talang, bubungan ±6,7 m di atas pad', () => {
    building.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let [maxBx, maxBz, minY, maxY] = [0, 0, Infinity, -Infinity];
    building.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.material.name === 'kolamCahaya') return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const l = toSekre(v.x, v.z);
        maxBx = Math.max(maxBx, Math.abs(l.x));
        maxBz = Math.max(maxBz, Math.abs(l.z));
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
      }
    });
    const { ridgeY } = roofLevels(SEKRE_DIM);
    expect(maxY - 12.5).toBeCloseTo(ridgeY + 0.03, 1);
    expect(minY).toBeGreaterThanOrEqual(12.5 - 1e-6);
    expect(maxBx).toBeGreaterThan(SEKRE_DIM.hx + 0.8);
    expect(maxBx).toBeLessThan(SEKRE_DIM.hx + 0.95);
    expect(maxBz).toBeGreaterThan(SEKRE_DIM.hz + 0.6);
    expect(maxBz).toBeLessThan(SEKRE_DIM.hz + 0.7);
  });

  it('permukaan basah bernama untuk registry hujan', () => {
    const names = [];
    surfaces.traverse((o) => { if (o.isMesh) names.push(o.name); });
    expect(names).toEqual(expect.arrayContaining(['plazaPaving', 'trotoar']));
  });

  it('material lampu & kolam bertanda nightEmissive', () => {
    const tagged = new Set();
    building.traverse((o) => { if (o.material?.userData?.nightEmissive) tagged.add(o.material.name); });
    expect([...tagged].sort()).toEqual(['kolamCahaya', 'lampuSelasar']);
  });
});
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/sekretariatBudget.test.js`
Expected: FAIL — `sekretariat.js` tidak ditemukan.

- [ ] **Langkah 3: `staged.js`**

```js
/**
 * Rakitan bertahap untuk scheduler (spec §4.3): tiap langkah menambah objek ke grup mentah; finish()
 * menggabung per material (mergeByMaterial) sekali di akhir. Transform opsional = sub-frame bangunan.
 */
import * as THREE from 'three';
import { mergeByMaterial } from '../../world/util/merge.js';

/**
 * @param {string} name
 * @param {Array<() => (THREE.Object3D|THREE.Object3D[]|null|void)>} stepFns
 * @param {{x:number, y?:number, z:number, yaw?:number}|null} [frame]
 * @returns {{steps: Array<() => void>, finish(): THREE.Group}}
 */
export function staged(name, stepFns, frame = null) {
  const raw = new THREE.Group();
  raw.name = name;
  if (frame) {
    raw.position.set(frame.x, frame.y ?? 0, frame.z);
    raw.rotation.y = frame.yaw ?? 0;
  }
  return {
    steps: stepFns.map((fn) => () => {
      const out = fn();
      for (const o of [out].flat()) if (o) raw.add(o);
    }),
    finish() {
      const merged = mergeByMaterial(raw);
      merged.name = name;
      return merged;
    },
  };
}

/** Group berisi satu Mesh per (material → daftar geometri) yang diberikan. */
export function meshesByMaterial(name, entries, { cast = false, minimap = false, layer = 1 } = {}) {
  const g = new THREE.Group();
  g.name = name;
  for (const [material, geos] of entries) {
    for (const geo of geos) {
      const m = new THREE.Mesh(geo, material);
      m.name = `${name}:${material.name}`;
      m.castShadow = cast;
      m.receiveShadow = true;
      if (minimap) m.layers.enable(layer);
      g.add(m);
    }
  }
  return g;
}
```

- [ ] **Langkah 4: `sekretariat.js`**

```js
/**
 * H01 hero:sekretariat-lembaga — Sekretariat Lembaga Mahasiswa (way 327530276), handmade (spec §8.1).
 * Fakta: footprint OSM 16,77 × 15,57 m, satu gedung (T). Inferensi: 1 lantai, 2 baris × 4 ruang, selasar
 * tengah 3,7 m terbuka di kedua ujung, dinding plester krem dengan plint abu, pilaster & balok ring putih,
 * jendela nako + roster, pintu panel bercat warna ormawa, papan nama di atas pintu, stiker, atap pelana seng
 * dengan talang, plafon selasar, lampu bohlam selasar + lampu dinding di mulut selasar, keramik krem.
 * Koordinat lokal-gedung (SEKRE_FRAME): +Z = sumbu panjang (ESE), +X = baris U (NNE).
 */
import * as THREE from 'three';
import { RENDER_LAYERS } from '../../config/constants.js';
import { mergeAll } from '../../world/siteutil/rounded.js';
import { quad } from '../../world/props/unri/geom.js';
import { createPapanNamaSekre } from '../../world/props/unri/papanNamaSekre.js';
import { SEKRE_FRAME } from './placement.js';
import { SEKRE_DIM, roomInfo, faceToward, LEMBAGA_LAYOUT } from './layout.js';
import { wallSegments, clipOpenings, wallBoxes } from './sekretariat.walls.js';
import {
  placeGeos, nakoWindow, windowSill, panelDoor, rosterPlane, ceilingLamp, lintelLamp, floorPool,
} from './sekretariat.parts.js';
import { roofGeometries, gableGeometries } from './sekretariat.roof.js';
import { STICKERS } from './sekretariat.atlas.js';
import { staged, meshesByMaterial } from './staged.js';

const bucket = () => new Map();
const add = (map, mat, geos) => map.set(mat, [...(map.get(mat) ?? []), ...geos]);

const winAndRoster = (uc, win, dim) => [
  { u0: uc - win.w / 2, u1: uc + win.w / 2, v0: win.v0, v1: win.v1, kind: 'jendela' },
  { u0: uc - win.w / 2, u1: uc + win.w / 2, v0: dim.roster.v0, v1: dim.roster.v1, kind: 'roster' },
];

/**
 * Spesifikasi 8 dinding (lokal-gedung). out = normal muka yang terlihat; faceAt = koordinat muka itu.
 * Ruang: baris U (side +1) indeks 0–3, baris S (side −1) indeks 4–7.
 */
export function wallSpecs(dim = SEKRE_DIM) {
  const t = dim.wallT;
  const centers = [0, 1, 2, 3].map((c) => -dim.hz + (c + 0.5) * dim.roomLen);
  const specs = [];
  for (const side of [1, -1]) {
    specs.push({
      id: `luar${side}`, axis: 'z', at: side * (dim.hx - t / 2), from: -dim.hz, length: 2 * dim.hz, faceAt: side * dim.hx, out: [side, 0],
      openings: centers.flatMap((zc) => winAndRoster(zc + dim.hz, dim.winOut, dim)),
    });
    specs.push({
      id: `selasar${side}`, axis: 'z', at: side * (dim.corridorHalf + t / 2), from: -dim.hz, length: 2 * dim.hz, faceAt: side * dim.corridorHalf, out: [-side, 0],
      openings: [0, 1, 2, 3].flatMap((c) => {
        const r = roomInfo(side > 0 ? c : c + 4, dim);
        const door = { u0: r.doorZ + dim.hz - dim.door.w / 2, u1: r.doorZ + dim.hz + dim.door.w / 2, v0: dim.door.v0, v1: dim.door.v1, kind: 'pintu', room: r.index };
        return [door, ...winAndRoster(r.winZ + dim.hz, dim.winCorr, dim)];
      }),
    });
    for (const sz of [1, -1]) {
      const from = side > 0 ? dim.corridorHalf + t : -(dim.hx - t);
      specs.push({
        id: `ujung${side}${sz}`, axis: 'x', at: sz * (dim.hz - t / 2), from, length: dim.hx - dim.corridorHalf - 2 * t, faceAt: sz * dim.hz, out: [0, sz],
        openings: winAndRoster(side * dim.winEndX - from, dim.winOut, dim),
      });
    }
  }
  return specs;
}

/** Titik tengah bukaan (lokal-gedung) + rotY muka depan bagian kanonik. */
function openingPose(spec, o) {
  const uc = spec.from + (o.u0 + o.u1) / 2;
  const [x, z] = spec.axis === 'z' ? [spec.at, uc] : [uc, spec.at];
  return { x, y: o.v0, z, rotY: faceToward(spec.out[0], spec.out[1]) };
}

function wallsStep(mats, dim) {
  const m = bucket();
  const t = dim.wallT;
  for (const s of wallSpecs(dim)) {
    add(m, mats.dinding, wallBoxes(wallSegments(s.length, dim.wallTop, s.openings), { axis: s.axis, at: s.at, from: s.from, thickness: t }));
    const bandAt = s.faceAt + (s.axis === 'z' ? s.out[0] : s.out[1]) * 0.01;
    const band = wallSegments(s.length, dim.plint, clipOpenings(s.openings, dim.plint));
    add(m, mats.plint, wallBoxes(band, { axis: s.axis, at: bandAt, from: s.from, thickness: 0.02 }));
  }
  const putih = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      putih.push(new THREE.BoxGeometry(0.3, dim.wallTop, 0.3).translate(sx * (dim.hx - 0.1), dim.wallTop / 2, sz * (dim.hz - 0.1)));
      putih.push(new THREE.BoxGeometry(0.3, dim.wallTop, 0.3).translate(sx * (dim.corridorHalf + 0.1), dim.wallTop / 2, sz * (dim.hz - 0.1)));
      putih.push(new THREE.BoxGeometry(2 * dim.hx + 0.06, 0.35, 0.03).translate(0, 3.575, sz * (dim.hz + 0.015)));
    }
    for (let k = 1; k <= 3; k += 1) putih.push(new THREE.BoxGeometry(0.05, dim.wallTop, 0.25).translate(sx * (dim.hx + 0.025), dim.wallTop / 2, -dim.hz + k * dim.roomLen));
    putih.push(new THREE.BoxGeometry(0.03, 0.35, 2 * dim.hz).translate(sx * (dim.hx + 0.015), 3.575, 0));
  }
  add(m, mats.putih, putih);
  const lintel = [-1, 1].map((sz) => new THREE.BoxGeometry(2 * dim.corridorHalf, dim.wallTop - dim.plafonY, t).translate(0, (dim.wallTop + dim.plafonY) / 2, sz * (dim.hz - t / 2)));
  const gable = gableGeometries(dim);
  add(m, mats.dinding, [...lintel, ...gable.walls]);
  add(m, mats.roster, gable.vents);
  return meshesByMaterial('H01-dinding', [...m], { cast: true });
}

function stickersFor(index) {
  const a = (index * 5) % STICKERS.length;
  const b = (index * 5 + 7) % STICKERS.length;
  return [
    { id: `stiker:${a}`, x: -0.18, y: 1.45, size: 0.16 },
    { id: `stiker:${b}`, x: 0.12, y: 1.62, size: 0.12 },
    ...(index % 2 === 0 ? [{ id: `stiker:${(a + 3) % STICKERS.length}`, x: 0.02, y: 0.95, size: 0.14 }] : []),
  ];
}

function openingsStep(mats, atlas, rooms, dim) {
  const m = bucket();
  const signs = [];
  for (const spec of wallSpecs(dim)) {
    for (const o of spec.openings) {
      const pose = openingPose(spec, o);
      const w = o.u1 - o.u0;
      const h = o.v1 - o.v0;
      if (o.kind === 'jendela') {
        const win = nakoWindow(w, h);
        add(m, mats.alu, placeGeos(win.frame, pose));
        add(m, mats.kaca, placeGeos(win.glass, pose));
        add(m, mats.gelap, placeGeos(win.dark, pose));
        if (!spec.id.startsWith('selasar')) add(m, mats.putih, placeGeos(windowSill(w), pose));
      } else if (o.kind === 'roster') {
        add(m, mats.roster, placeGeos([rosterPlane(w, h)], pose));
      } else if (o.kind === 'pintu') {
        const room = rooms[o.room];
        const door = panelDoor({
          w, h, color: room.pintu,
          stickers: stickersFor(room.index).map((s) => ({ ...s, cell: atlas.cell(s.id) })),
        });
        add(m, mats.pintu, placeGeos(door.leaf, pose));
        add(m, mats.kusen, placeGeos(door.kusen, pose));
        add(m, mats.alu, placeGeos(door.handle, pose));
        add(m, mats.atlas, placeGeos(door.decals, pose));
        const sign = createPapanNamaSekre({ cell: atlas.cell(`sign:${room.index}`), faceMaterial: mats.atlas, frameMaterial: mats.kusen });
        sign.position.set(spec.faceAt + spec.out[0] * 0.03, dim.signY, pose.z);
        sign.rotation.y = pose.rotY;
        signs.push(sign);
      }
    }
  }
  const g = meshesByMaterial('H01-bukaan', [...m]);
  g.add(...signs);
  return g;
}

function roofStep(mats, dim) {
  const r = roofGeometries(dim);
  const roof = meshesByMaterial('H01-atap', [[mats.seng, r.seng]], { cast: true, minimap: true, layer: RENDER_LAYERS.minimap });
  const rest = meshesByMaterial('H01-atap-detail', [[mats.talang, r.talang], [mats.putih, r.putih], [mats.plafon, r.plafon]]);
  return [roof, rest];
}

function lampsStep(mats, dim, teras) {
  const putih = [];
  const lampu = [];
  const pools = [];
  for (const l of teras.lamps) {
    const f = ceilingLamp(l.bx, l.y, l.bz);
    putih.push(...f.putih);
    lampu.push(...f.lampu);
    pools.push(floorPool(l.bx, dim.selasarY + 0.012, l.bz, 3.2));
  }
  for (const l of teras.mouthLamps) {
    const f = lintelLamp(l.bz, l.y, Math.sign(l.bz));
    putih.push(...f.putih);
    lampu.push(...f.lampu);
    pools.push(floorPool(0, dim.selasarY + 0.014, Math.sign(l.bz) * (dim.hz + 0.7), 2.4)); // di atas keramik teras
  }
  return meshesByMaterial('H01-lampu', [[mats.putih, putih], [mats.lampu, lampu], [mats.kolam, pools]]);
}

/**
 * Rakitan bertahap H01 (4 langkah + finish). baseY = tinggi pad (heightAtLocal di pusat gedung).
 * @param {{baseY:number, mats:object, atlas:object, rooms?:object[], dim?:object, teras?:object}} opts
 */
export function createSekretariatBuilder({ baseY, mats, atlas, rooms = LEMBAGA_LAYOUT.rooms, dim = SEKRE_DIM, teras = LEMBAGA_LAYOUT.teras }) {
  return staged('H01-sekretariat-lembaga', [
    () => wallsStep(mats, dim),
    () => openingsStep(mats, atlas, rooms, dim),
    () => roofStep(mats, dim),
    () => lampsStep(mats, dim, teras),
  ], { x: SEKRE_FRAME.x, y: baseY, z: SEKRE_FRAME.z, yaw: SEKRE_FRAME.yaw });
}

/** Quad lantai menghadap +Y, UV meter. */
const floor = (x0, x1, z0, z1, y) => quad([[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]]);

/**
 * Permukaan basah sinkron (dibangun di build(), sebelum registerWet saat mount): keramik selasar + teras
 * ujung ('plazaPaving'), rabat beton keliling sisi panjang ('trotoar').
 */
export function createSekreSurfaces({ baseY, mats, dim = SEKRE_DIM }) {
  const g = new THREE.Group();
  g.name = 'H01-permukaan';
  g.position.set(SEKRE_FRAME.x, baseY, SEKRE_FRAME.z);
  g.rotation.y = SEKRE_FRAME.yaw;
  const c = dim.corridorHalf;
  const ex = dim.hx + 0.3;
  const tz = dim.hz + dim.teras;
  const y = dim.selasarY;
  const keramik = mergeAll([floor(-c, c, -dim.hz, dim.hz, y), floor(-ex, ex, dim.hz, tz, y), floor(-ex, ex, -tz, -dim.hz, y)]);
  const rabat = mergeAll([floor(dim.hx, dim.hx + 0.6, -dim.hz, dim.hz, 0.03), floor(-dim.hx - 0.6, -dim.hx, -dim.hz, dim.hz, 0.03)]);
  const k = new THREE.Mesh(keramik, mats.keramik);
  k.name = 'plazaPaving';
  k.receiveShadow = true;
  const r = new THREE.Mesh(rabat, mats.rabat);
  r.name = 'trotoar';
  r.receiveShadow = true;
  g.add(k, r);
  return g;
}
```

- [ ] **Langkah 5: `terrace.js`**

```js
/**
 * Teras & halaman Sekretariat [INFERENSI pola umum sekre ormawa, riset §3]: rak sepatu, sandal menumpuk,
 * galon kosong, papan pengumuman, jemuran almamater biru langit, pagar besi + 3 spanduk ormawa menghadap
 * jogging track, tong sampah, PJU zona (4 tiang, juga lampu malam region). Posisi dari LEMBAGA_LAYOUT.
 */
import * as THREE from 'three';
import { createRakSepatu } from '../../world/props/unri/rakSepatu.js';
import { createSandalTumpuk } from '../../world/props/unri/sandal.js';
import { createGalon } from '../../world/props/unri/galon.js';
import { createJemuran } from '../../world/props/unri/jemuran.js';
import { createPapanPengumuman } from '../../world/props/unri/papanPengumuman.js';
import { createSpanduk } from '../../world/props/unri/spanduk.js';
import { createTrashBins } from '../../world/props/TrashBin.js';
import { createLampPosts } from '../../world/props/LampPost.js';
import { SEKRE_DIM, LEMBAGA_LAYOUT } from './layout.js';
import { staged, meshesByMaterial } from './staged.js';

const FENCE_H = 1.2;
const BAR_STEP = 0.15;

const placed = (obj, p, y) => {
  obj.position.set(p.x, y, p.z);
  obj.rotation.y = p.rotY ?? 0;
  return obj;
};

/** Pagar besi: rel atas/bawah + jeruji tiap 15 cm + tiang (region-lokal). */
function fenceGeometries(t, heightAt) {
  const geos = [];
  for (const s of t.fenceSegments) {
    const [ax, az] = s.a;
    const [bx, bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    const y = heightAt((ax + bx) / 2, (az + bz) / 2);
    for (const ry of [0.25, FENCE_H - 0.1]) {
      geos.push(new THREE.BoxGeometry(0.04, 0.04, len).rotateY(yaw).translate((ax + bx) / 2, y + ry, (az + bz) / 2));
    }
    const n = Math.floor(len / BAR_STEP);
    for (let k = 1; k < n; k += 1) {
      const f = k / n;
      geos.push(new THREE.BoxGeometry(0.02, FENCE_H - 0.2, 0.02).translate(ax + (bx - ax) * f, y + 0.1 + (FENCE_H - 0.2) / 2, az + (bz - az) * f));
    }
  }
  for (const p of t.fencePosts) geos.push(new THREE.BoxGeometry(0.06, FENCE_H + 0.1, 0.06).translate(p.x, heightAt(p.x, p.z) + (FENCE_H + 0.1) / 2, p.z));
  return geos;
}

/** @param {{heightAt:(lx:number, lz:number)=>number, mats:object, atlas:object, layout?:object}} opts */
export function createTerraceBuilder({ heightAt, mats, atlas, layout = LEMBAGA_LAYOUT }) {
  const t = layout.teras;
  const floorY = (p) => heightAt(p.x, p.z) + SEKRE_DIM.selasarY + 0.004;
  const at = (p, y) => ({ x: p.x, y, z: p.z, rotY: p.rotY ?? 0 });
  return staged('H01-teras', [
    () => [
      createRakSepatu(t.racks.map((p) => at(p, floorY(p)))),
      createSandalTumpuk(t.sandals.map((p) => at(p, floorY(p)))),
      createGalon(t.galons.map((p) => at(p, floorY(p)))),
    ],
    () => [
      placed(createPapanPengumuman({ cell: atlas.cell('papan:pengumuman'), faceMaterial: mats.atlas, woodMaterial: mats.kayu }), t.board, floorY(t.board)),
      placed(createJemuran(), t.jemuran, heightAt(t.jemuran.x, t.jemuran.z)),
      meshesByMaterial('H01-pagar', [[mats.besi, fenceGeometries(t, heightAt)]], { cast: true }),
      ...t.spanduk.map((p) => placed(createSpanduk({ cell: atlas.cell(p.cell), material: mats.spanduk, tieMaterial: mats.tali }), p, heightAt(p.x, p.z) + 0.72)),
    ],
    () => [
      createTrashBins(t.trashBins.map((p) => ({ ...at(p, floorY(p)), kind: p.kind }))),
      createLampPosts(layout.pju.map((p) => at(p, heightAt(p.x, p.z)))),
    ],
  ]);
}
```

- [ ] **Langkah 6: Jalankan tes budget, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/sekretariatBudget.test.js`
Expected: PASS (5 tes). Bila draw call gedung > 20, periksa material yang tidak tergabung (`stats` per nama material) — biasanya geometri tanpa `uv`/indeks berbeda (ShapeGeometry vs Box): keduanya terindeks dengan atribut sama, jadi seharusnya satu bucket per material.

- [ ] **Langkah 7: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.
```bash
git add src/regions/unri-lembaga/staged.js src/regions/unri-lembaga/sekretariat.js src/regions/unri-lembaga/terrace.js tests/unri/sekretariatBudget.test.js
```
```bash
git commit -m "feat(lembaga): H01 sekretariat handmade (8 ruang, selasar, nako, roster, atap seng, lampu) + teras hidup"
```

---

## Task 15: H02 Stadion Mini UNRI — lapangan, lintasan, tribun beratap

**Files:**
- Create: `src/regions/unri-lembaga/stadionMini.js`

- [ ] **Langkah 1: Buat `stadionMini.js`**

```js
/**
 * H02 hero:stadion-mini — Stadion Mini UNRI (way 327364388, kapasitas 5.000 [T]). Fakta: tapak oval
 * ±124 × 202 m, lapangan sepak bola way 327366049 (76,45 × 111,77 m), tribun barat way 282225436 (136,5 ×
 * 19,1 m + tonjolan VIP). [INFERENSI, tanpa foto]: lintasan 6 lajur tanah merah (bentuk tapak oval), tribun
 * beton 16 undakan menghadap timur dengan atap seng di bagian VIP + tiang baja, papan nama di lisplang atap,
 * rumput lapangan kampus dengan bagian aus di mulut gawang & lingkaran tengah. Tanpa lampu sorot.
 * Marka/gawang/bendera = modul FIFA standar stadion (world/stadium/Pitch.markings.js, 105 × 68 m).
 */
import * as THREE from 'three';
import { RENDER_LAYERS } from '../../config/constants.js';
import { stadiumShape, stadiumPath, flatShapeGeometry, mergeFlat, createCanvasTexture } from '../../world/stadium/ovalMath.js';
import { createMarkings, createGoals, createCornerFlags } from '../../world/stadium/Pitch.markings.js';
import { surfaceMaps } from '../../world/textures/surfaces.js';
import { currentScope } from '../../engine/ResourceScope.js';
import { boxAt, paint, facePlane, quad } from '../../world/props/unri/geom.js';
import { PITCH_FRAME, TRIBUN } from './placement.js';
import { faceToward } from './layout.js';
import { staged, meshesByMaterial } from './staged.js';

export const TRACK_MINI = Object.freeze({ halfStraight: 50, kerb: 39, lanes: 6, laneW: 1.22, margin: 0.5 });
const OUTER = TRACK_MINI.kerb + TRACK_MINI.lanes * TRACK_MINI.laneW;
const GRASS_Y = 0.08;
const TRACK_Y = 0.07;
const MARK_Y = 0.07;
const TIER = Object.freeze({ rows: 16, tread: 0.8, rise: 0.4, podium: 1.0, walk: 1.0 });
const ROOF = Object.freeze({ back: 11.0, front: 10.2, frontX: 6.0, overZ: 1.0 });
const COLUMN_Z = Object.freeze([-25, -12.5, 0, 12.5, 25]);

/** Kanvas rumput satu lembar untuk seluruh infield (78 × 178 m): strip potong + aus tanah. */
function drawLapangan(ctx, w, h) {
  const stripes = 14;
  for (let i = 0; i < stripes; i += 1) {
    ctx.fillStyle = i % 2 ? '#6f9a3d' : '#78a443';
    ctx.fillRect(0, (i * h) / stripes, w, h / stripes + 1);
  }
  const worn = [[0.5, 0.5, 0.06], [0.5, 0.2, 0.05], [0.5, 0.8, 0.05], [0.5, 0.215, 0.025], [0.5, 0.785, 0.025]];
  for (const [u, v, r] of worn) {
    const g = ctx.createRadialGradient(u * w, v * h, 0, u * w, v * h, r * w * 2);
    g.addColorStop(0, 'rgba(160,120,80,0.75)');
    g.addColorStop(1, 'rgba(160,120,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  for (let i = 0; i < 1500; i += 1) {
    ctx.fillStyle = i % 3 ? 'rgba(40,70,20,0.10)' : 'rgba(200,190,120,0.10)';
    ctx.fillRect((i * 97) % w, (i * 61) % h, 2, 2);
  }
}

const mats = () => currentScope().get('lembaga:stadionMini:mats', () => {
  const grassTex = createCanvasTexture(256, 512, drawLapangan);
  if (grassTex) {
    const sx = 2 * TRACK_MINI.kerb;
    const sz = 2 * (TRACK_MINI.halfStraight + TRACK_MINI.kerb);
    grassTex.repeat.set(1 / sx, 1 / sz);
    grassTex.offset.set(0.5, 0.5);
  }
  const named = (m, n) => {
    m.name = n;
    m.userData.baseRoughness = m.roughness;
    return m;
  };
  return {
    rumput: named(new THREE.MeshStandardMaterial({ color: grassTex ? 0xffffff : 0x74a040, roughness: 0.95, ...(grassTex ? { map: grassTex } : {}) }), 'rumputStadionMini'),
    lintasan: named(new THREE.MeshStandardMaterial({ color: 0xa65a3c, roughness: 1, ...surfaceMaps('concrete', 1.2) }), 'lintasanTanahMerah'),
    garis: named(new THREE.MeshBasicMaterial({ color: 0xf2efe8, transparent: true, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -1 }), 'garisLajur'),
  };
});

/**
 * Permukaan basah SINKRON (registerWet saat mount): rumput infield ('rumput') & lintasan ('joggingTrack').
 * @param {{heightAt:(lx:number, lz:number)=>number}} opts
 */
export function createStadionMiniSurfaces({ heightAt }) {
  const m = mats();
  const y = heightAt(PITCH_FRAME.x, PITCH_FRAME.z);
  const g = new THREE.Group();
  g.name = 'H02-permukaan';
  g.position.set(PITCH_FRAME.x, y, PITCH_FRAME.z);
  g.rotation.y = PITCH_FRAME.yaw;
  const grass = new THREE.Mesh(flatShapeGeometry(stadiumShape(TRACK_MINI.halfStraight, TRACK_MINI.kerb), [], 48).translate(0, GRASS_Y, 0), m.rumput);
  grass.name = 'rumput';
  const track = new THREE.Mesh(flatShapeGeometry(
    stadiumShape(TRACK_MINI.halfStraight, OUTER + TRACK_MINI.margin),
    [stadiumPath(TRACK_MINI.halfStraight, TRACK_MINI.kerb)], 48,
  ).translate(0, TRACK_Y, 0), m.lintasan);
  track.name = 'joggingTrack';
  for (const s of [grass, track]) {
    s.receiveShadow = true;
    s.layers.enable(RENDER_LAYERS.minimap);
  }
  g.add(grass, track);
  return g;
}

function laneLines() {
  const geos = [];
  for (let k = 0; k <= TRACK_MINI.lanes; k += 1) {
    const r = TRACK_MINI.kerb + k * TRACK_MINI.laneW;
    geos.push(flatShapeGeometry(stadiumShape(TRACK_MINI.halfStraight, r + 0.03), [stadiumPath(TRACK_MINI.halfStraight, r - 0.03)], 48).translate(0, TRACK_Y + 0.01, 0));
  }
  return mergeFlat(geos);
}

/** Profil undakan tribun (x lokal-tribun, y): muka timur di +depth/2, 16 baris naik ke barat. */
function tierShape(D) {
  const s = new THREE.Shape();
  s.moveTo(-D, 0);
  s.lineTo(D, 0);
  s.lineTo(D, 0.15);
  s.lineTo(D - TIER.walk, 0.15);
  s.lineTo(D - TIER.walk, TIER.podium);
  for (let k = 0; k < TIER.rows; k += 1) {
    const x = D - TIER.walk - (k + 1) * TIER.tread;
    const y = TIER.podium + k * TIER.rise;
    s.lineTo(x, y);
    if (k < TIER.rows - 1) s.lineTo(x, y + TIER.rise);
  }
  s.lineTo(-D, TIER.podium + (TIER.rows - 1) * TIER.rise);
  s.closePath();
  return s;
}

function tribunGeometries() {
  const D = TRIBUN.depth / 2;
  const L = TRIBUN.length;
  const topY = TIER.podium + (TIER.rows - 1) * TIER.rise;
  const v = TRIBUN.vip;
  const beton = [
    new THREE.ExtrudeGeometry(tierShape(D), { depth: L, bevelEnabled: false }).translate(0, 0, -L / 2),
  ];
  const beton2 = [boxAt(0.2, 1.1, L, -D + 0.1, topY, 0), boxAt(0.25, 1.05, L, D - TIER.walk - 0.12, 0, 0)];
  const cat = [];
  for (let k = 0; k < TIER.rows; k += 1) {
    const x = D - TIER.walk - k * TIER.tread - 0.04;
    cat.push(paint(boxAt(0.06, 0.012, L, x, TIER.podium + k * TIER.rise, 0), k % 4 === 0 ? 0x2f6db5 : 0xe0b13a));
  }
  const baja = [boxAt(0.05, 0.05, L, D - TIER.walk + 0.05, TIER.podium + 1.0, 0)];
  for (let z = -L / 2 + 1.5; z <= L / 2 - 1.5; z += 3) baja.push(boxAt(0.05, 1.0, 0.05, D - TIER.walk + 0.05, TIER.podium, z));
  const roofBack = v.x0 - 0.5;
  for (const z of COLUMN_Z) {
    baja.push(boxAt(0.25, ROOF.back - 0.2, 0.25, v.x0 + 0.3, 0, z));
    const frontBase = TIER.podium + Math.max(0, Math.floor((D - TIER.walk - ROOF.frontX + 1.4) / TIER.tread)) * TIER.rise;
    baja.push(boxAt(0.25, ROOF.front - frontBase - 0.2, 0.25, ROOF.frontX - 1.4, frontBase, z));
    const len = Math.hypot(ROOF.frontX - roofBack, ROOF.back - ROOF.front);
    const ang = Math.atan2(ROOF.back - ROOF.front, ROOF.frontX - roofBack);
    baja.push(new THREE.BoxGeometry(len, 0.35, 0.2).rotateZ(-ang).translate((ROOF.frontX + roofBack) / 2, (ROOF.back + ROOF.front) / 2 - 0.25, z));
  }
  const z0 = v.z0 - ROOF.overZ;
  const z1 = v.z1 + ROOF.overZ;
  const slope = Math.hypot(ROOF.frontX - roofBack, ROOF.back - ROOF.front);
  const seng = [quad(
    [[roofBack, ROOF.back, z1], [ROOF.frontX, ROOF.front, z1], [ROOF.frontX, ROOF.front, z0], [roofBack, ROOF.back, z0]],
    [[z1, 0], [z1, slope], [z0, slope], [z0, 0]],
  )];
  const dinding = [boxAt(v.x1 - v.x0, topY, v.z1 - v.z0, (v.x0 + v.x1) / 2, 0, (v.z0 + v.z1) / 2)];
  const gelap = [];
  for (let z = v.z0 + 3; z <= v.z1 - 3; z += 4) {
    for (const y0 of [1.2, 4.4]) gelap.push(boxAt(0.02, 1.2, 1.6, v.x0 - 0.01, y0, z));
  }
  for (const z of [v.z0 + 8, (v.z0 + v.z1) / 2, v.z1 - 8]) gelap.push(boxAt(0.02, 2.4, 1.4, v.x0 - 0.012, 0, z));
  for (let z = -L / 2 + 2; z <= L / 2 - 2; z += 4) {
    if (z > v.z0 - 1 && z < v.z1 + 1) continue;
    gelap.push(boxAt(0.02, 0.6, 0.6, -D - 0.01, 5.2, z));
  }
  return { beton, beton2, cat, baja, seng, dinding, gelap, sign: { x: ROOF.frontX + 0.06, y: ROOF.front - 0.85, z: (v.z0 + v.z1) / 2 } };
}

/**
 * @param {{heightAt:(lx:number, lz:number)=>number, mats:object, atlas:object}} opts mats = lembagaMaterials().mats
 */
export function createStadionMiniBuilder({ heightAt, mats: lm, atlas }) {
  const pitchY = heightAt(PITCH_FRAME.x, PITCH_FRAME.z);
  const tribY = heightAt(TRIBUN.frame.x, TRIBUN.frame.z);
  const pitchGroup = (obj) => {
    obj.position.set(PITCH_FRAME.x, pitchY + MARK_Y, PITCH_FRAME.z);
    obj.rotation.y = PITCH_FRAME.yaw;
    return obj;
  };
  return staged('H02-stadion-mini', [
    () => [
      pitchGroup(createMarkings()), pitchGroup(createGoals()), pitchGroup(createCornerFlags()),
      (() => {
        const lines = new THREE.Mesh(laneLines(), mats().garis);
        lines.name = 'garisLajur';
        lines.position.set(PITCH_FRAME.x, pitchY, PITCH_FRAME.z);
        lines.rotation.y = PITCH_FRAME.yaw;
        return lines;
      })(),
    ],
    () => {
      const t = tribunGeometries();
      const g = meshesByMaterial('H02-tribun', [[lm.beton, [...t.beton, ...t.beton2]], [lm.dinding, t.dinding]], { cast: true });
      const roof = meshesByMaterial('H02-atap', [[lm.seng, t.seng]], { cast: true, minimap: true, layer: RENDER_LAYERS.minimap });
      const detail = meshesByMaterial('H02-detail', [[lm.vcolor, t.cat], [lm.baja, t.baja], [lm.gelap, t.gelap]]);
      const sign = new THREE.Mesh(facePlane(16, 1.2, { cell: atlas.cell('nama:stadion') }), lm.atlas);
      sign.name = 'H02-nama';
      sign.position.set(t.sign.x, t.sign.y, t.sign.z);
      sign.rotation.y = faceToward(1, 0);
      const back = new THREE.Mesh(boxAt(0.1, 1.4, 16.4, t.sign.x - 0.07, t.sign.y - 0.7, t.sign.z), lm.baja);
      const wrap = new THREE.Group();
      wrap.position.set(TRIBUN.frame.x, tribY, TRIBUN.frame.z);
      wrap.rotation.y = TRIBUN.frame.yaw;
      wrap.add(g, roof, detail, sign, back);
      return wrap;
    },
  ]);
}
```

- [ ] **Langkah 2: Lint**

Run: `npm run lint`
Expected: 0 galat. (Verifikasi visual di Task 26.)

- [ ] **Langkah 3: Commit**

```bash
git add src/regions/unri-lembaga/stadionMini.js
```
```bash
git commit -m "feat(lembaga): H02 stadion mini (lapangan aus, lintasan tanah merah 6 lajur, tribun beton beratap VIP) [INFERENSI]"
```

---

## Task 16: Adaptor kit M3 + H03 Student Center (K03 hero)

**Files:**
- Create: `src/regions/unri-lembaga/kitAdapter.js`, `src/regions/unri-lembaga/studentCenter.js`

- [ ] **Langkah 1: `kitAdapter.js`** (SATU-SATUNYA file region yang memanggil API kit M3; sesuaikan di sini bila catatan Task 0/A7 berbeda)

```js
/**
 * Adaptor kit gedung M3 (spec §4.6) untuk region Lembaga: planBuilding (koordinat DUNIA) → buildBuilding →
 * PartList → Group region-lokal (digeser −origin; yaw region 0). Material kit dibuat sekali per scope region.
 */
import { planBuilding } from '../../world/kit/planBuilding.js';
import { buildBuilding } from '../../world/kit/buildBuilding.js';
import { createKitMaterials } from '../../world/kit/kitMaterials.js';
import { groupFromParts } from '../../world/siteutil/instanceParts.js';
import { LEMBAGA_PLACEMENT } from './placement.js';

/** Seed stabil dari id OSM ('w1480014538' → bilangan 32-bit). */
export function seedFromId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {{id:string, ringWorld:Array<[number,number]>, levels:number, archetype:string, overrides?:object,
 *   groundYWorld:(x:number, z:number)=>number, scope:object}} opts
 * @returns {{group: import('three').Group, plan: object}}
 */
export function buildKitBuildingLocal({ id, ringWorld, levels, archetype, overrides = {}, groundYWorld, scope }) {
  const mats = scope.get('lembaga:kitMaterials', () => createKitMaterials(scope));
  const plan = planBuilding({ id, ring: ringWorld.map(([x, z]) => [x, z]), levels, archetype, overrides, seed: seedFromId(id), groundY: groundYWorld });
  const group = groupFromParts(buildBuilding(plan, mats), `kit:${id}`);
  group.position.set(-LEMBAGA_PLACEMENT.x, 0, -LEMBAGA_PLACEMENT.z);
  return { group, plan };
}
```

- [ ] **Langkah 2: `studentCenter.js`**

```js
/**
 * H03 hero:student-center — Gedung Serba Guna / Student Center ADB. Fakta: fungsi & lokasi "di Jl. Muchtar
 * Lutfi antara asrama mahasiswa dan stadion mini" [T]; way 1480014538 (53,2 × 50,9 m) = kandidat [S].
 * Rupa = K03 adb-layar (foto gedung ADB lain [T]): massa putih/abu muda, layar perforasi oranye-terakota,
 * atap pelana lebar; 3 lt @ 4,2 m [INFERENSI dari catalog H03 16 m]. Tambahan hero: kanopi beton di muka
 * utara (menghadap jalan servis & Jl. Muchtar Lutfi), undakan, panel nama hitam huruf putih kapital berdiri.
 */
import * as THREE from 'three';
import { ringBounds } from '../../geo/polygon.js';
import { boxAt, facePlane } from '../../world/props/unri/geom.js';
import { FOOTPRINTS, FOOTPRINTS_WORLD } from './placement.js';
import { buildKitBuildingLocal } from './kitAdapter.js';
import { staged, meshesByMaterial } from './staged.js';

export const SC_SPEC = Object.freeze({
  id: 'w1480014538', levels: 3, archetype: 'K03',
  overrides: Object.freeze({ palette: 'putih', roof: 'pelana-lebar', motif: 'segitiga', sign: 'STUDENT CENTER' }),
});
const CANOPY = Object.freeze({ w: 10, d: 4.5, y: 4.2, t: 0.3 });

/**
 * @param {{heightAt:(lx:number,lz:number)=>number, heightAtWorld:(x:number,z:number)=>number, mats:object, atlas:object, scope:object}} opts
 */
export function createStudentCenterBuilder({ heightAt, heightAtWorld, mats, atlas, scope }) {
  const b = ringBounds(FOOTPRINTS.studentCenter);
  const cx = (b.minX + b.maxX) / 2;
  const front = b.minZ;
  const y = heightAt(cx, front);
  return staged('H03-student-center', [
    () => buildKitBuildingLocal({
      id: SC_SPEC.id, ringWorld: FOOTPRINTS_WORLD.studentCenter, levels: SC_SPEC.levels, archetype: SC_SPEC.archetype,
      overrides: SC_SPEC.overrides, groundYWorld: heightAtWorld, scope,
    }).group,
    () => {
      const putih = [
        boxAt(CANOPY.w, CANOPY.t, CANOPY.d, cx, y + CANOPY.y, front - CANOPY.d / 2),
        boxAt(0.4, CANOPY.y, 0.4, cx - CANOPY.w / 2 + 0.4, y, front - CANOPY.d + 0.3),
        boxAt(0.4, CANOPY.y, 0.4, cx + CANOPY.w / 2 - 0.4, y, front - CANOPY.d + 0.3),
        ...[0, 1, 2].map((k) => boxAt(CANOPY.w - k * 0.6, 0.15, 0.45, cx, y + k * 0.15, front - 0.25 - (2 - k) * 0.45)),
      ];
      const hitam = [boxAt(4.4, 1.5, 0.3, cx + 9, y, front - 6.5)];
      const g = meshesByMaterial('H03-hero', [[mats.putih, putih], [mats.gelap, hitam]], { cast: true });
      const sign = new THREE.Mesh(facePlane(4.2, 1.05, { x: cx + 9, y: y + 0.85, z: front - 6.5 - 0.151, cell: atlas.cell('nama:sc') }), mats.atlas);
      sign.name = 'H03-nama';
      g.add(sign);
      return g;
    },
  ]);
}
```

- [ ] **Langkah 3: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.
```bash
git add src/regions/unri-lembaga/kitAdapter.js src/regions/unri-lembaga/studentCenter.js
```
```bash
git commit -m "feat(lembaga): adaptor kit M3 + H03 student center (K03 hero, kanopi utara, panel nama)"
```

---

## Task 17: Detail hero Rusunawa (K09) & FH Panam mangkrak (K10 + ilalang)

**Files:**
- Create: `src/regions/unri-lembaga/rusun.js`, `src/regions/unri-lembaga/fhMangkrak.js`

- [ ] **Langkah 1: `rusun.js`**

```js
/**
 * Rusunawa mahasiswa (way 327366048, 5 lt [T]) — cangkang K09 dirender DISTRIK (balkon berjemuran, tangga
 * ujung, tandon atap). Region menambah detail hero [INFERENSI]: papan nama beton di pintu masuk lot parkir
 * (dari jalan servis barat), pos satpam P01 (satpam kampus [T]), 4 jemuran almamater di halaman belakang,
 * tong sampah. Motor parkir lot utara di parking.js.
 */
import * as THREE from 'three';
import { createGuardPost } from '../../world/props/GuardPost.js';
import { createJemuran } from '../../world/props/unri/jemuran.js';
import { createTrashBins } from '../../world/props/TrashBin.js';
import { boxAt, facePlane } from '../../world/props/unri/geom.js';
import { LEMBAGA_LAYOUT } from './layout.js';
import { staged, meshesByMaterial } from './staged.js';

const place = (obj, p, y) => {
  obj.position.set(p.x, y, p.z);
  obj.rotation.y = p.rotY ?? 0;
  return obj;
};

function signBoard(mats, atlas) {
  const g = meshesByMaterial('rusun-papan', [[mats.putih, [
    boxAt(0.2, 1.4, 0.2, -1.5, 0, 0), boxAt(0.2, 1.4, 0.2, 1.5, 0, 0), boxAt(3.4, 1.0, 0.2, 0, 1.0, 0),
  ]]], { cast: true });
  g.add(new THREE.Mesh(facePlane(3.1, 0.78, { y: 1.5, z: -0.101, cell: atlas.cell('nama:rusun') }), mats.atlas));
  return g;
}

/** @param {{heightAt:(lx:number,lz:number)=>number, mats:object, atlas:object, layout?:object}} opts */
export function createRusunDetailBuilder({ heightAt, mats, atlas, layout = LEMBAGA_LAYOUT }) {
  const r = layout.rusun;
  const h = (p) => heightAt(p.x, p.z);
  return staged('rusunawa-detail', [
    () => [
      place(signBoard(mats, atlas), r.sign, h(r.sign)),
      place(createGuardPost({ width: 2.5, depth: 2.5, wallHeight: 2.2 }), r.guardPost, h(r.guardPost)),
    ],
    () => [
      ...r.jemuran.map((p) => place(createJemuran(), p, h(p))),
      createTrashBins(r.trashBins.map((p) => ({ x: p.x, y: h(p), z: p.z, rotY: 0, kind: p.kind }))),
    ],
  ]);
}
```

- [ ] **Langkah 2: `fhMangkrak.js`**

```js
/**
 * Gedung FH Panam (way 327366046, 3 lt, bentuk U) — "belum dipakai; 2015 dinding & listrik belum selesai;
 * lahan sengketa HTJ" [T, riset §2]. Cangkang K10 mangkrak dirender DISTRIK (rangka beton, besi menjuntai,
 * coretan, tanpa kaca). Region menambah: ilalang rapat V08 (pita 9 m + halaman U), pagar seng proyek
 * berkarat 4 ruas, plang "DILARANG MASUK — AREA PROYEK" [INFERENSI], gundukan tanah urug & besi tulangan.
 */
import * as THREE from 'three';
import { createIlalang, scatterIlalang } from '../../world/props/unri/ilalang.js';
import { boxAt, facePlane } from '../../world/props/unri/geom.js';
import { createRandom } from '../../world/siteutil/rng.js';
import { FOOTPRINTS } from './placement.js';
import { LEMBAGA_LAYOUT } from './layout.js';
import { staged, meshesByMaterial } from './staged.js';

export const ILALANG_FH = Object.freeze({ count: 1600, band: 9, seed: 23 });
const PANEL = Object.freeze({ w: 2.4, h: 2.0 });

function sengPanels(fences, heightAt) {
  const rnd = createRandom(616);
  const seng = [];
  const kayu = [];
  for (const f of fences) {
    const [ax, az] = f.a;
    const [bx, bz] = f.b;
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / PANEL.w));
    for (let k = 0; k < n; k += 1) {
      if (rnd.chance(0.12)) continue; // panel hilang/roboh
      const t = (k + 0.5) / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const y = heightAt(x, z);
      const tilt = rnd.range(-0.06, 0.06);
      seng.push(new THREE.BoxGeometry(0.02, PANEL.h, len / n - 0.03).rotateX(tilt).rotateY(yaw).translate(x, y + PANEL.h / 2 + 0.05, z));
      kayu.push(new THREE.BoxGeometry(0.08, PANEL.h + 0.3, 0.08).translate(ax + (bx - ax) * (k / n), y + (PANEL.h + 0.3) / 2, az + (bz - az) * (k / n)));
    }
  }
  return { seng, kayu };
}

/** @param {{heightAt:(lx:number,lz:number)=>number, mats:object, atlas:object, layout?:object}} opts */
export function createFhDetailBuilder({ heightAt, mats, atlas, layout = LEMBAGA_LAYOUT }) {
  const fh = layout.fh;
  return staged('fh-panam-detail', [
    () => createIlalang(scatterIlalang(FOOTPRINTS.fhPanam, ILALANG_FH).map((p) => ({ ...p, y: heightAt(p.x, p.z) }))),
    () => {
      const { seng, kayu } = sengPanels(fh.fences, heightAt);
      const mounds = fh.mounds.map((m) => new THREE.ConeGeometry(m.r, m.r * 0.55, 10).translate(m.x, heightAt(m.x, m.z) + m.r * 0.275, m.z));
      const rebar = [];
      for (let k = 0; k < 9; k += 1) {
        const m = fh.mounds[0];
        rebar.push(new THREE.BoxGeometry(0.03, 0.03, 6).rotateY(0.6 + k * 0.02).translate(m.x + 2.5, heightAt(m.x, m.z) + 0.05 + (k % 3) * 0.03, m.z + 1.5 + k * 0.05));
      }
      const p = fh.plang;
      const plangBoard = [boxAt(0.1, 2.2, 0.1, 0, 0, 0.05), boxAt(1.4, 0.7, 0.04, 0, 1.4, 0)];
      const g = meshesByMaterial('fh-detail', [[mats.seng2, seng], [mats.kayu, kayu], [mats.tanah, mounds], [mats.baja, rebar]], { cast: true });
      const plang = meshesByMaterial('fh-plang', [[mats.putih, plangBoard]]);
      plang.add(new THREE.Mesh(facePlane(1.3, 0.62, { y: 1.75, z: -0.021, cell: atlas.cell('plang:fh') }), mats.atlas));
      plang.position.set(p.x, heightAt(p.x, p.z), p.z);
      plang.rotation.y = p.rotY;
      return [g, plang];
    },
  ]);
}
```

- [ ] **Langkah 3: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.
```bash
git add src/regions/unri-lembaga/rusun.js src/regions/unri-lembaga/fhMangkrak.js
```
```bash
git commit -m "feat(lembaga): detail hero rusunawa (papan, pos satpam, jemuran) & FH mangkrak (ilalang, pagar seng, plang)"
```

---

## Task 18: Parkiran motor padat (lot + deret sekretariat) dengan peningkatan GLB

**Files:**
- Modify: `src/regions/unri-lembaga/staged.js` (opsi `merge`)
- Create: `src/regions/unri-lembaga/parking.js`
- Modify: `src/world/props/unri/motor.js` (flag `MOTOR_GLB_READY`)

- [ ] **Langkah 1: Opsi tanpa merge di `staged.js`** — ganti tanda tangan & `finish`:

```js
export function staged(name, stepFns, frame = null, { merge = true } = {}) {
```
dan isi `finish()`:
```js
    finish() {
      if (!merge) return raw;
      const merged = mergeByMaterial(raw);
      merged.name = name;
      return merged;
    },
```

- [ ] **Langkah 2: Flag GLB di `motor.js`** (tambahkan di bawah `MOTOR_COLORS`)

```js
/**
 * true setelah Task 25 (Blender) mengekspor public/models/unri/motor-{bebek,matic}.glb. Selama false region
 * tidak meminta GLB (hindari HTTP 404 di konsol/E2E); placeholder prosedural = versi final sementara.
 */
export const MOTOR_GLB_READY = false;
```

- [ ] **Langkah 3: `parking.js`**

```js
/**
 * Motor parkir padat [T: "parkir motor sangat padat", riset §4]: lot stadion mini (way 938379741, ±270 siang),
 * lot rusunawa (way 938379740, ±150), deret rapat di sisi utara & mulut selasar sekretariat (±20). Motor lot =
 * placeholder low-poly instanced tanpa bayangan (8 draw call untuk semua lot); motor sekretariat (dilihat dari dekat)
 * ditingkatkan ke GLB A01/A02 bila MOTOR_GLB_READY. Grup tidak digabung (InstancedMesh).
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { createMotorPlaceholders, loadMotorInstances, MOTOR_GLB_READY } from '../../world/props/unri/motor.js';
import { LEMBAGA_LAYOUT } from './layout.js';
import { staged } from './staged.js';

export const SEKRE_MOTOR_GROUP = 'lembaga-motor-sekre';
const KINDS = Object.freeze(['bebek', 'matic']);

/** Kelompokkan motor per jenis, y dari tanah. */
export function motorsByKind(list, heightAt) {
  const out = { bebek: [], matic: [] };
  for (const m of list) out[m.kind === 'matic' ? 'matic' : 'bebek'].push({ x: m.x, y: heightAt(m.x, m.z), z: m.z, rotY: m.rotY });
  return out;
}

function kindGroup(name, byKind, opts) {
  const g = new THREE.Group();
  g.name = name;
  for (const kind of KINDS) {
    const sub = createMotorPlaceholders(kind, byKind[kind], { ...opts, seed: opts.seed + (kind === 'matic' ? 7 : 0) });
    sub.name = `${name}:${kind}`;
    g.add(sub);
  }
  return g;
}

/** @param {{heightAt:(lx:number,lz:number)=>number, layout?:object}} opts */
export function createParkingBuilder({ heightAt, layout = LEMBAGA_LAYOUT }) {
  return staged('lembaga-parkir', [
    () => kindGroup('lembaga-motor-lot', motorsByKind([...layout.lots.stadionMini.motors, ...layout.lots.rusunawa.motors], heightAt), { seed: 31, cellSize: 0, castShadow: false }),
    () => kindGroup(SEKRE_MOTOR_GROUP, motorsByKind(layout.teras.motors, heightAt), { seed: 53, cellSize: 0 }),
  ], null, { merge: false });
}

/**
 * Ganti placeholder motor sekretariat dengan GLB instanced (bila siap). Placeholder disembunyikan hanya
 * bila GLB jenis itu berhasil. Panggil setelah parkir terpasang di `root`.
 * @returns {Promise<{failed:string[], replaced:string[]}>}
 */
export async function upgradeSekreMotors({ root, scope, heightAt, layout = LEMBAGA_LAYOUT, isCancelled = () => false, ready = MOTOR_GLB_READY }) {
  const result = { failed: [], replaced: [] };
  const holder = root.getObjectByName(SEKRE_MOTOR_GROUP);
  if (!ready || !holder) return result;
  const byKind = motorsByKind(layout.teras.motors, heightAt);
  await Promise.all(KINDS.map(async (kind) => {
    if (!byKind[kind].length) return;
    const glb = await withScope(scope, () => loadMotorInstances(kind, byKind[kind], { seed: 53 + (kind === 'matic' ? 7 : 0), isCancelled }));
    if (isCancelled()) return;
    const placeholder = holder.getObjectByName(`${SEKRE_MOTOR_GROUP}:${kind}`);
    if (!glb) {
      result.failed.push(kind);
      return;
    }
    holder.add(glb);
    if (placeholder) placeholder.visible = false;
    result.replaced.push(kind);
  }));
  return result;
}
```

- [ ] **Langkah 4: Lint & tes yang ada**

Run: `npm run lint` lalu `node node_modules/vitest/vitest.mjs run tests/unri`
Expected: 0 galat; semua tes `tests/unri` PASS.

- [ ] **Langkah 5: Commit**

```bash
git add src/regions/unri-lembaga/staged.js src/regions/unri-lembaga/parking.js src/world/props/unri/motor.js
```
```bash
git commit -m "feat(lembaga): parkiran motor padat (lot stadion mini, rusunawa, deret sekretariat) + peningkatan GLB"
```

---

## Task 19: Proxy region (≤ 8 draw call) + POV region

**Files:**
- Create: `src/regions/unri-lembaga/proxy.js`, `src/regions/unri-lembaga/povs.js`

- [ ] **Langkah 1: `proxy.js`**

```js
/**
 * Proxy region (spec §4.3): siluet murah saat region tidak terpasang — SATU mesh vertexColors (1 draw call):
 * massa + atap sekretariat, tribun + atap VIP, Student Center, rumput & lintasan stadion mini. Rusunawa/FH
 * tidak perlu (dirender distrik). Placement diterapkan di sini (idempoten bila manager juga menerapkannya).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ringBounds } from '../../geo/polygon.js';
import { stadiumShape, stadiumPath, flatShapeGeometry } from '../../world/stadium/ovalMath.js';
import { boxAt, paint } from '../../world/props/unri/geom.js';
import { LEMBAGA_PLACEMENT, SEKRE_FRAME, SEKRE_SIZE, PITCH_FRAME, TRIBUN, FOOTPRINTS } from './placement.js';
import { TRACK_MINI } from './stadionMini.js';

export const PROXY_NAME = 'proxy:unri-lembaga';
const COLOR = Object.freeze({ dinding: 0xe8dcc0, seng: 0x8e9aa6, beton: 0xbdb8ad, putih: 0xeeeeea, rumput: 0x74a040, lintasan: 0xa65a3c });

const framed = (geo, f, y) => geo.rotateY(f.yaw).translate(f.x, y, f.z);

/**
 * @param {{terrain?:{heightAt(x:number, z:number):number}, heightAtLocal?:(lx:number, lz:number)=>number}} [ctx]
 *   M0 memberi proxy ctx {scope, placement, terrain}; tinggi dari terrain dunia (yaw region 0 → dunia = lokal + origin).
 */
export function buildLembagaProxy(ctx = {}) {
  const h = typeof ctx.heightAtLocal === 'function'
    ? (x, z) => ctx.heightAtLocal(x, z)
    : (x, z) => (typeof ctx.terrain?.heightAt === 'function' ? ctx.terrain.heightAt(x + LEMBAGA_PLACEMENT.x, z + LEMBAGA_PLACEMENT.z) : 0);
  const ys = h(SEKRE_FRAME.x, SEKRE_FRAME.z);
  const yp = h(PITCH_FRAME.x, PITCH_FRAME.z);
  const yt = h(TRIBUN.frame.x, TRIBUN.frame.z);
  const sc = ringBounds(FOOTPRINTS.studentCenter);
  const ysc = h((sc.minX + sc.maxX) / 2, (sc.minZ + sc.maxZ) / 2);
  const outer = TRACK_MINI.kerb + TRACK_MINI.lanes * TRACK_MINI.laneW;
  const geos = [
    framed(paint(boxAt(SEKRE_SIZE.width, 3.75, SEKRE_SIZE.length), COLOR.dinding), SEKRE_FRAME, ys),
    framed(paint(boxAt(SEKRE_SIZE.width + 1.6, 1.4, SEKRE_SIZE.length + 1.2, 0, 3.75), COLOR.seng), SEKRE_FRAME, ys),
    framed(paint(boxAt(TRIBUN.depth, 7.0, TRIBUN.length), COLOR.beton), TRIBUN.frame, yt),
    framed(paint(boxAt(22, 0.4, 54, -5, 10.4, (TRIBUN.vip.z0 + TRIBUN.vip.z1) / 2), COLOR.seng), TRIBUN.frame, yt),
    paint(boxAt(sc.maxX - sc.minX, 13, sc.maxZ - sc.minZ, (sc.minX + sc.maxX) / 2, ysc, (sc.minZ + sc.maxZ) / 2), COLOR.putih),
    paint(boxAt(sc.maxX - sc.minX + 5, 0.6, sc.maxZ - sc.minZ + 5, (sc.minX + sc.maxX) / 2, ysc + 13, (sc.minZ + sc.maxZ) / 2), COLOR.seng),
    framed(paint(flatShapeGeometry(stadiumShape(TRACK_MINI.halfStraight, TRACK_MINI.kerb), [], 24), COLOR.rumput), PITCH_FRAME, yp + 0.08),
    framed(paint(flatShapeGeometry(stadiumShape(TRACK_MINI.halfStraight, outer), [stadiumPath(TRACK_MINI.halfStraight, TRACK_MINI.kerb)], 24), COLOR.lintasan), PITCH_FRAME, yp + 0.07),
  ];
  const geometry = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.name = 'proxyLembaga';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = PROXY_NAME;
  const group = new THREE.Group();
  group.name = PROXY_NAME;
  group.position.set(LEMBAGA_PLACEMENT.x, 0, LEMBAGA_PLACEMENT.z);
  group.rotation.y = LEMBAGA_PLACEMENT.yaw;
  group.add(mesh);
  let disposed = false;
  return {
    group,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
```

- [ ] **Langkah 2: `povs.js`**

```js
/**
 * POV milik region Lembaga (spec §4.3 `povs`): pose dunia {px,py,pz,tx,ty,tz,fov}. M0 memanggil pose(frame, ctx:{time,
 * bike}); y = tinggi di atas tanah 0 kecuali ctx.terrain diberikan (penyesuaian y ke tanah oleh PovDirector, M1).
 * `frame` = frame region (toWorld region-lokal → dunia).
 */
import { fromSekre, PITCH_FRAME, TRIBUN } from './placement.js';
import { SEKRE_DIM } from './layout.js';
import { toWorld } from '../../geo/regionTransform.js';

function pose(frame, ctx, eye, eyeH, target, targetH, fov) {
  const e = frame.toWorld(eye.x, eye.z);
  const t = frame.toWorld(target.x, target.z);
  const ground = (x, z) => (typeof ctx?.terrain?.heightAt === 'function' ? ctx.terrain.heightAt(x, z) : 0);
  return { px: e.x, py: ground(e.x, e.z) + eyeH, pz: e.z, tx: t.x, ty: ground(t.x, t.z) + targetH, tz: t.z, fov };
}

export const LEMBAGA_POVS = Object.freeze([
  Object.freeze({
    id: 'lembaga-selasar', label: 'Selasar Sekretariat',
    pose: (frame, ctx) => pose(frame, ctx, fromSekre(0.3, -(SEKRE_DIM.hz + 3.5)), 1.6, fromSekre(0, SEKRE_DIM.hz), 1.4, 62),
  }),
  Object.freeze({
    id: 'lembaga-udara', label: 'Udara Zona Lembaga',
    pose: (frame, ctx) => pose(frame, ctx, fromSekre(70, -40), 55, { x: -30, z: -90 }, 0, 50),
  }),
  Object.freeze({
    id: 'lembaga-tribun', label: 'Tribun Stadion Mini',
    pose: (frame, ctx) => pose(frame, ctx, toWorld(TRIBUN.frame, -2, 0), 8.7, { x: PITCH_FRAME.x, z: PITCH_FRAME.z }, 0.5, 60),
  }),
]);
```

- [ ] **Langkah 3: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.
```bash
git add src/regions/unri-lembaga/proxy.js src/regions/unri-lembaga/povs.js
```
```bash
git commit -m "feat(lembaga): proxy region 1 draw call + POV selasar/udara/tribun"
```

---

## Task 20: Definisi region, hero milik region, override tribun, tes region (TDD)

**Files:**
- Create: `src/regions/unri-lembaga/index.js`, `src/world/kit/hero/regionOwned.js`
- Modify: `src/world/kit/hero/index.js`, `src/districts/unri/buildings.data.js`
- Test: `tests/unri/lembagaRegion.test.js`

- [ ] **Langkah 1: Tulis tes yang gagal**

`tests/unri/lembagaRegion.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createResourceScope } from '../../src/engine/ResourceScope.js';
import { createRegionFrame } from '../../src/geo/regionTransform.js';

vi.mock('../../src/regions/unri-lembaga/kitAdapter.js', () => ({
  buildKitBuildingLocal: () => ({ group: new THREE.Group(), plan: null }),
  seedFromId: () => 1,
}));

const { unriLembagaRegion, LEMBAGA_GROUP_NAME } = await import('../../src/regions/unri-lembaga/index.js');
const { PORTAL_DOORS } = await import('../../src/regions/unri-lembaga/portalDoors.js');
const { HERO_BUILDERS } = await import('../../src/world/kit/hero/index.js');
const { isRegionOwned } = await import('../../src/world/kit/hero/regionOwned.js');

describe('region unri-lembaga', () => {
  it('definisi lengkap: aktivasi, pad, povs, proxy', () => {
    const r = unriLembagaRegion;
    expect(r.id).toBe('unri-lembaga');
    expect(r.placement).toEqual({ x: -219.47, z: 1099.21, yaw: 0 });
    expect(r.activation).toMatchObject({ mountRadius: 700, unmountRadius: 900 }); // M0 menormalkan (+ persistent:false)
    expect(r.pads).toHaveLength(3);
    expect(r.povs.map((p) => p.id)).toEqual(['lembaga-selasar', 'lembaga-udara', 'lembaga-tribun']);
    expect(typeof r.proxy).toBe('function');
  });

  it('build sinkron (tanpa scheduler): kontrak terpenuhi, portal, lampu malam, ready lalu dispose', async () => {
    const scope = createResourceScope('uji-region');
    const region = await unriLembagaRegion.build({ scope, heightAtLocal: () => 4 });
    expect(region.group.name).toBe(LEMBAGA_GROUP_NAME);
    expect(region.portals).toBe(PORTAL_DOORS);
    expect(region.nightLights.lamps).toHaveLength(4);
    expect(region.nightLights.floods).toEqual([]);
    expect(region.colliders.isWalkable(PORTAL_DOORS[0].pos.lx, PORTAL_DOORS[0].pos.lz)).toBe(true);
    const names = [];
    region.group.traverse((o) => { if (o.isMesh) names.push(o.name); });
    expect(names).toEqual(expect.arrayContaining(['plazaPaving', 'trotoar', 'rumput', 'joggingTrack']));
    const res = await region.ready;
    expect(res).toMatchObject({ placed: 7, cancelled: false });
    expect(region.lateRoot.children).toHaveLength(7);
    expect(region.group.userData.lembagaReady).toBe(true);
    region.dispose();
    region.dispose();
    expect(scope.disposed).toBe(true);
  });

  it('dispose sebelum antrean habis: ready selesai dengan cancelled', async () => {
    const queue = [];
    const scope = createResourceScope('uji-batal');
    const region = await unriLembagaRegion.build({ scope, heightAtLocal: () => 0, schedule: (task) => { queue.push(task); return { cancel() {} }; } });
    region.dispose();
    await expect(region.ready).resolves.toMatchObject({ cancelled: true });
  });

  it('proxy: satu mesh, berplacement, dispose bersih', () => {
    const p = unriLembagaRegion.proxy({ terrain: { heightAt: () => 2 } });
    let meshes = 0;
    p.group.traverse((o) => { if (o.isMesh) meshes += 1; });
    expect(meshes).toBeLessThanOrEqual(8);
    expect(p.group.position.x).toBeCloseTo(-219.47, 6);
    p.dispose();
    expect(p.group.parent).toBeNull();
  });

  it('pose POV hingga & dekat zona', () => {
    const frame = createRegionFrame(unriLembagaRegion.placement);
    for (const pov of unriLembagaRegion.povs) {
      const q = pov.pose(frame, {});
      for (const v of Object.values(q)) expect(Number.isFinite(v)).toBe(true);
      expect(Math.hypot(q.px + 219.47, q.pz - 1099.21)).toBeLessThan(300);
    }
  });

  it('hero H01–H03 milik region: distrik menerima PartList kosong', () => {
    for (const id of ['hero:sekretariat-lembaga', 'hero:stadion-mini', 'hero:student-center']) {
      expect(isRegionOwned(HERO_BUILDERS[id]), id).toBe(true);
      expect(HERO_BUILDERS[id]({}, {}, {})).toEqual([]);
    }
  });
});
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/lembagaRegion.test.js`
Expected: FAIL — `index.js` / `regionOwned.js` tidak ditemukan.

- [ ] **Langkah 3: `src/world/kit/hero/regionOwned.js`**

```js
/**
 * Hero yang dirender penuh oleh REGION (bukan distrik): builder mengembalikan PartList kosong sehingga klaster
 * distrik tidak menggambar gedung itu (tidak ada gambar ganda / z-fighting). Saat region tidak terpasang,
 * proxy region yang menampilkan siluetnya.
 */
export function regionOwnedHero(regionId) {
  const builder = () => [];
  builder.regionOwned = regionId;
  return builder;
}

export const isRegionOwned = (builder) => typeof builder?.regionOwned === 'string';
```

- [ ] **Langkah 4: Ubah `src/world/kit/hero/index.js`**

Tambahkan impor `import { regionOwnedHero } from './regionOwned.js';` lalu ganti TIGA entri placeholder M3 berikut (nilai lama apa pun) menjadi:
```js
  'hero:sekretariat-lembaga': regionOwnedHero('unri-lembaga'),
  'hero:stadion-mini': regionOwnedHero('unri-lembaga'),
  'hero:student-center': regionOwnedHero('unri-lembaga'),
```
Bila catatan Task 0/A8 menunjukkan klaster LOD1 TIDAK lewat `HERO_BUILDERS` (mis. membuat massa langsung dari `plan.masses`), tambahkan pengecualian di `src/districts/unri/buildingClusters.js` tepat sebelum gedung dimasukkan ke klaster:
```js
import { HERO_BUILDERS } from '../../world/kit/hero/index.js';
import { isRegionOwned } from '../../world/kit/hero/regionOwned.js';
// … di dalam perulangan gedung, setelah `archetype` diketahui:
if (isRegionOwned(HERO_BUILDERS[archetype])) continue; // dirender region (proxy saat jauh)
```

- [ ] **Langkah 5: Override tribun & cek override hero di `src/districts/unri/buildings.data.js`**

Pastikan tabel memuat ketiga entri berikut (tambah yang belum ada; jangan ubah entri lain):
```js
  w327530276: { archetype: 'hero:sekretariat-lembaga', levels: 1, sign: 'SEKRETARIAT LEMBAGA MAHASISWA', sumber: 'OSM way/327530276; denah [INFERENSI]', keyakinan: 'tinggi' },
  w1480014538: { archetype: 'hero:student-center', levels: 3, sign: 'STUDENT CENTER', sumber: 'unri.ac.id (lokasi teks); way id [S]', keyakinan: 'sedang' },
  w282225436: { archetype: 'hero:stadion-mini', levels: 2, sumber: 'OSM way/282225436 "tribun stadion" levels=7 (tribun, bukan 7 lantai); bentuk [INFERENSI]', keyakinan: 'rendah' },
```
(Bentuk kunci mengikuti tabel M3 — bila M3 memakai kunci string `'w327530276'`, pakai bentuk itu.)

Run: `node node_modules/vitest/vitest.mjs run tests/districts` (atau berkas tes `validateOverrides` M3 sesuai catatan Task 0)
Expected: PASS — `validateOverrides(tabel nyata)` tetap `[]`.

- [ ] **Langkah 6: `src/regions/unri-lembaga/index.js`**

```js
/**
 * Region hero "unri-lembaga" (spec §8.1, tonggak M4): Sekretariat Lembaga Mahasiswa (H01, handmade) + teras,
 * Stadion Mini UNRI (H02), Student Center (H03, K03 hero), detail Rusunawa & FH Panam, parkiran motor.
 * build() cepat: data murni + permukaan basah (sinkron, agar registerWet saat mount melihatnya); rakitan berat
 * lewat ctx.schedule (satu yield per langkah) ke `lateRoot`; `ready` resolve setelah antrean habis (atau
 * {cancelled:true} bila region dilepas lebih dulu). Gedung H01–H03 milik region (HERO_BUILDERS kosong).
 */
import * as THREE from 'three';
import { defineRegion, validateBuild } from '../Region.js';
import { withScope } from '../../engine/ResourceScope.js';
import { disposeTree } from '../../engine/disposeTree.js';
import { freezeStatic } from '../../engine/freezeStatic.js';
import { toWorld } from '../../geo/regionTransform.js';
import { LEMBAGA_PLACEMENT, UNRI_LEMBAGA_ID, SEKRE_FRAME } from './placement.js';
import { LEMBAGA_MASK, LEMBAGA_ACTIVATION } from './mask.js';
import { LEMBAGA_PADS } from './pads.js';
import { LEMBAGA_LAYOUT } from './layout.js';
import { lembagaColliders } from './collider.js';
import { PORTAL_DOORS } from './portalDoors.js';
import { lembagaMaterials } from './materials.js';
import { createSekretariatBuilder, createSekreSurfaces } from './sekretariat.js';
import { createTerraceBuilder } from './terrace.js';
import { createStadionMiniBuilder, createStadionMiniSurfaces } from './stadionMini.js';
import { createStudentCenterBuilder } from './studentCenter.js';
import { createRusunDetailBuilder } from './rusun.js';
import { createFhDetailBuilder } from './fhMangkrak.js';
import { createParkingBuilder, upgradeSekreMotors } from './parking.js';
import { buildLembagaProxy } from './proxy.js';
import { LEMBAGA_POVS } from './povs.js';

export { UNRI_LEMBAGA_ID, LEMBAGA_PLACEMENT };
export const LEMBAGA_GROUP_NAME = `region:${UNRI_LEMBAGA_ID}`;

/** Tinggi tanah region-lokal & dunia (datar bila terrain tidak ada, mis. tes). */
function heightFns(ctx) {
  const local = typeof ctx.heightAtLocal === 'function' ? (x, z) => ctx.heightAtLocal(x, z) : () => 0;
  const world = typeof ctx.terrain?.heightAt === 'function'
    ? (x, z) => ctx.terrain.heightAt(x, z)
    : (x, z) => local(x - LEMBAGA_PLACEMENT.x, z - LEMBAGA_PLACEMENT.z);
  return { local, world };
}

/**
 * Jalankan builder bertahap lewat ctx.schedule (generator; satu yield per langkah) atau sinkron bila tidak
 * ada scheduler. Resolve dengan hasil finish(), atau null bila dibatalkan.
 */
function runSteps(ctx, scope, builder, isCancelled) {
  return new Promise((resolve, reject) => {
    function* task() {
      try {
        for (const step of builder.steps) {
          if (isCancelled()) {
            resolve(null);
            return;
          }
          withScope(scope, step);
          yield;
        }
        resolve(isCancelled() ? null : withScope(scope, () => builder.finish()));
      } catch (err) {
        reject(err);
      }
    }
    if (typeof ctx.schedule === 'function') ctx.schedule(task);
    else for (const _ of task()) { /* sinkron */ }
  });
}

function buildLembaga(ctx) {
  const { scope } = ctx;
  if (!scope) throw new TypeError(`Region ${UNRI_LEMBAGA_ID}: ctx.scope (ResourceScope) wajib`);
  const h = heightFns(ctx);
  const group = new THREE.Group();
  group.name = LEMBAGA_GROUP_NAME;
  const content = new THREE.Group();
  content.name = 'lembaga:konten';
  let disposed = false;
  let signalDisposed = () => {};
  const disposedSignal = new Promise((resolve) => { signalDisposed = resolve; });
  const isCancelled = () => disposed;
  const sekreY = h.local(SEKRE_FRAME.x, SEKRE_FRAME.z);
  const { mats, atlas } = withScope(scope, () => lembagaMaterials());
  withScope(scope, () => group.add(createSekreSurfaces({ baseY: sekreY, mats }), createStadionMiniSurfaces({ heightAt: h.local })));
  group.add(content);

  const makers = [
    () => createSekretariatBuilder({ baseY: sekreY, mats, atlas }),
    () => createTerraceBuilder({ heightAt: h.local, mats, atlas }),
    () => createParkingBuilder({ heightAt: h.local }),
    () => createStadionMiniBuilder({ heightAt: h.local, mats, atlas }),
    () => createStudentCenterBuilder({ heightAt: h.local, heightAtWorld: h.world, mats, atlas, scope }),
    () => createRusunDetailBuilder({ heightAt: h.local, mats, atlas }),
    () => createFhDetailBuilder({ heightAt: h.local, mats, atlas }),
  ];
  const work = makers.reduce((prev, make) => prev.then(async (placed) => {
    if (disposed) return placed;
    const obj = await runSteps(ctx, scope, withScope(scope, make), isCancelled);
    if (!obj || disposed) return placed;
    content.add(obj);
    freezeStatic(content);
    return placed + 1;
  }), Promise.resolve(0));

  const ready = Promise.race([
    work.then(async (placed) => {
      if (disposed) return { placed, failed: [], replaced: [], cancelled: true };
      group.userData.lembagaReady = true;
      const glb = await upgradeSekreMotors({ root: content, scope, heightAt: h.local, isCancelled });
      return { placed, failed: glb.failed, replaced: glb.replaced, cancelled: disposed };
    }),
    disposedSignal.then(() => ({ placed: 0, failed: [], replaced: [], cancelled: true })),
  ]);

  return validateBuild({
    group,
    colliders: lembagaColliders,
    minimapLayer: () => {}, // peta dasar region di-bake dari layer minimap (atap, rumput, lintasan)
    systems: [],
    layout: LEMBAGA_LAYOUT,
    portals: PORTAL_DOORS,
    nightLights: { lamps: LEMBAGA_LAYOUT.pju.map((p) => toWorld(LEMBAGA_PLACEMENT, p.x, p.z)), floods: [] },
    lateRoot: content,
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      signalDisposed();
      group.removeFromParent();
      disposeTree(group, { scope });
      scope.dispose();
    },
  }, UNRI_LEMBAGA_ID);
}

export const unriLembagaRegion = defineRegion({
  id: UNRI_LEMBAGA_ID,
  placement: LEMBAGA_PLACEMENT,
  mask: LEMBAGA_MASK,
  activation: LEMBAGA_ACTIVATION,
  pads: LEMBAGA_PADS,
  povs: LEMBAGA_POVS,
  proxy: (ctx) => buildLembagaProxy(ctx ?? {}),
  build: async (ctx) => buildLembaga(ctx ?? {}),
});
```

- [ ] **Langkah 7: Jalankan tes region, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri`
Expected: PASS semua (≥ 70 tes). Bila `placed` < 7, cetak `region.lateRoot.children.map((c) => c.name)` untuk melihat builder yang gagal (galat build muncul sebagai rejection `region.ready`).

- [ ] **Langkah 8: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.
```bash
git add src/regions/unri-lembaga/index.js src/world/kit/hero/regionOwned.js src/world/kit/hero/index.js src/districts/unri/buildings.data.js tests/unri/lembagaRegion.test.js
```
Bila langkah 4 menyentuh klaster, tambahkan juga `src/districts/unri/buildingClusters.js`.
```bash
git commit -m "feat(lembaga): definisi region unri-lembaga (build bertahap, proxy, POV, portal) + hero H01–H03 milik region"
```

---

## Task 21: Daftarkan region di `main.js` + perjalanan cepat dev ke Sekretariat

**Files:**
- Modify: `src/app/fastTravel.js`, `tests/fastTravel.test.js`, `src/main.js`

- [ ] **Langkah 1: Tes yang gagal untuk tujuan tambahan** (lampirkan ke blok `describe('tujuan perjalanan cepat'` di `tests/fastTravel.test.js`)

```js
  it('tujuan tambahan (mis. dev Kampus UNRI) ditambahkan di akhir, nilai disalin', () => {
    const extra = [{ id: 'unri-lembaga', label: 'Kampus UNRI — Sekretariat Lembaga (dev)', x: -232.12, z: 1094.84, yaw: 1.2383 }];
    const list = travelDestinations({ manifest: null, frame: IDENTITY_FRAME, spawn: LAYOUT.spawn, extra });
    expect(list.map((d) => d.id)).toEqual(['stadion', 'unri-lembaga']);
    expect(list[1]).toEqual(extra[0]);
    expect(list[1]).not.toBe(extra[0]);
  });
```

Run: `node node_modules/vitest/vitest.mjs run tests/fastTravel.test.js`
Expected: FAIL — `unri-lembaga` tidak ada di daftar.

- [ ] **Langkah 2: Ubah `travelDestinations` di `src/app/fastTravel.js`**

Ganti tanda tangan dan `return out;`:
```js
export function travelDestinations({ manifest = null, frame, spawn, extra = [] }) {
```
```js
  return [...out, ...extra.map((d) => ({ id: d.id, label: d.label, x: d.x, z: d.z, yaw: d.yaw }))];
```
dan tambahkan pada JSDoc: `` `extra`: tujuan tambahan (frame dunia), mis. tujuan dev Kampus UNRI (M4) — M7 menjadikannya permanen. ``

Run: `node node_modules/vitest/vitest.mjs run tests/fastTravel.test.js`
Expected: PASS.

- [ ] **Langkah 3: Daftarkan region & tujuan dev di `src/main.js`**

Tambahkan impor (blok impor region):
```js
import { unriLembagaRegion } from './regions/unri-lembaga/index.js';
import { LEMBAGA_LAYOUT } from './regions/unri-lembaga/layout.js';
```
Tepat setelah `const stadion = await regions.register(stadionDef);` (M0):
```js
  // M4: zona Lembaga (streaming: pasang ≤ 700 m, lepas > 900 m; proxy saat jauh)
  regions.register(unriLembagaRegion).catch((err) => console.error('Region unri-lembaga gagal didaftarkan:', err));
```
Tambahkan juga konstanta modul (di bawah impor) — daftar region hero yang memesan tanah distrik; M6 menambahkan region Rektorat ke array ini:
```js
/** Region hero di dalam distrik UNRI: distrik tidak menaruh vegetasi/props/rintangan di dalam mask-nya (M2 isReserved). */
const HERO_REGIONS = Object.freeze([unriLembagaRegion]);
```
dan tambahkan `regionContains` ke impor `./regions/Region.js` yang sudah ada (mis. `import { withPlacement, maskHalfExtent, regionContains } from './regions/Region.js';`).

- [ ] **Langkah 3b: Predikat `isReserved` ke distrik (serah terima M2 butir 6)**

Pada pemanggilan `mountDistrict(app, unriDistrict, { … })` (M1) di `src/main.js`, tambahkan opsi:
```js
    isReserved: (x, z) => HERO_REGIONS.some((r) => regionContains(r, x, z)), // dunia → di dalam mask region hero?
```
Bila catatan A10 menunjukkan `src/app/districtMount.js` belum meneruskannya, ubah tanda tangan menjadi `export async function mountDistrict(app, def, { terrain, collider, minimap, scheduler, createScope, isReserved = () => false } = {})` dan sertakan `isReserved` di objek ctx yang diteruskan ke `def.build(...)` (di samping `terrain`, `scope`, `scheduler`). Bake tidak perlu diulang (penyaringan di runtime). Cek dev server: tidak ada pohon/PJU distrik di plaza Student Center dan halaman sekretariat.
Tambahkan konstanta modul (di bawah `MINIMAP_BAKE_MARGIN`):
```js
/** Tujuan perjalanan cepat sementara (DEV) ke depan mulut selasar barat Sekretariat Lembaga; M7 permanen. */
const DEV_TRAVEL = import.meta.env.DEV
  ? [{ id: 'unri-lembaga', label: 'Kampus UNRI — Sekretariat Lembaga (dev)', ...LEMBAGA_LAYOUT.spawnDev }]
  : [];
```
dan di `setupFastTravel` ubah pemanggilan:
```js
    destinations: travelDestinations({ manifest: city?.manifest ?? null, frame, spawn, extra: DEV_TRAVEL }), bike: ents.bike, colliders, city, screen,
```

- [ ] **Langkah 4: Uji asap di dev server**

Jalankan `preview_start` nama `stadion-dev` (atau `npm run dev`), buka `http://localhost:5173`, mulai permainan, tekan **G**, pilih "Kampus UNRI — Sekretariat Lembaga (dev)". Di konsol DevTools:
```js
window.__sim.app.scene.getObjectByName('region:unri-lembaga')?.userData.lembagaReady
```
Expected: dalam ≤ 15 s bernilai `true`; konsol tanpa galat merah; sepeda muncul di depan mulut selasar barat menghadap selasar.

- [ ] **Langkah 5: Commit**

```bash
git add src/app/fastTravel.js tests/fastTravel.test.js src/main.js src/app/districtMount.js
```
```bash
git commit -m "feat(main): daftarkan region unri-lembaga, isReserved distrik, perjalanan cepat dev ke Sekretariat Lembaga"
```

---

## Task 22: Port tampilan interior (tanpa mengubah App) + overlay fade (TDD kecil)

**Files:**
- Create: `src/app/appView.js`, `src/ui/FadeOverlay.js`
- Test: `tests/unri/appView.test.js`

`App.setView` milik M5 (indeks). M4 tidak mengubah `src/core/App.js`: port `view` memakai `app.setView` bila sudah ada, dan bila belum menukar scene/kamera pass adegan composer + kamera OutlinePass secara langsung (properti publik `app.post`), serta menyembunyikan label CSS2D eksterior. Hasil: scene eksterior tidak digambar saat di dalam (kontrak §4.8), M5 otomatis memakai `App.setView` miliknya tanpa menyentuh portal.

- [ ] **Langkah 1: Tulis tes yang gagal**

`tests/unri/appView.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { appViewPort } from '../../src/app/appView.js';

function fakeApp(extra = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 2, 0.3, 2500);
  const scenePass = { scene, camera };
  return {
    scene, camera, scenePass,
    post: { composer: { passes: [scenePass, {}] }, outlinePass: { camera }, gtaoPass: null },
    labelRenderer: { domElement: { style: { visibility: '' } } },
    ...extra,
  };
}

describe('appViewPort', () => {
  it('tanpa App.setView: pass adegan & outline memakai scene/kamera interior lalu pulih', () => {
    const app = fakeApp();
    const view = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(70, 1, 0.05, 50) };
    const port = appViewPort(app);
    port.setView(view);
    expect(app.scenePass.scene).toBe(view.scene);
    expect(app.scenePass.camera).toBe(view.camera);
    expect(app.post.outlinePass.camera).toBe(view.camera);
    expect(view.camera.aspect).toBe(2);
    expect(app.labelRenderer.domElement.style.visibility).toBe('hidden');
    port.setView(null);
    expect(app.scenePass.scene).toBe(app.scene);
    expect(app.scenePass.camera).toBe(app.camera);
    expect(app.post.outlinePass.camera).toBe(app.camera);
    expect(app.labelRenderer.domElement.style.visibility).toBe('');
  });

  it('dengan App.setView (M5): diteruskan apa adanya', () => {
    const setView = vi.fn();
    const app = fakeApp({ setView });
    const view = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() };
    appViewPort(app).setView(view);
    expect(setView).toHaveBeenCalledWith(view);
    expect(app.scenePass.scene).toBe(app.scene);
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/unri/appView.test.js`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Langkah 2: Buat `src/app/appView.js`**

```js
/**
 * Port `view` portal interior (spec §4.8). Memakai App.setView bila ada (M5). Bila belum (M4): menukar
 * scene/kamera pass adegan composer + kamera OutlinePass (+ GTAO bila aktif) langsung lewat `app.post`, dan
 * menyembunyikan label CSS2D eksterior. App.render tetap memperbarui matriks scene eksterior (murah) tetapi
 * scene eksterior tidak digambar. Kamera interior menyalin aspek kamera utama saat masuk.
 * @param {{scene:object, camera:object, post:{composer:{passes:object[]}, outlinePass:{camera:object}, gtaoPass?:object|null},
 *   labelRenderer?:{domElement:{style:object}}, setView?:Function}} app
 */
export function appViewPort(app) {
  const main = { scene: app.scene, camera: app.camera };
  return {
    setView(view = null) {
      if (typeof app.setView === 'function') {
        app.setView(view);
        return;
      }
      const scene = view?.scene ?? main.scene;
      const camera = view?.camera ?? main.camera;
      if (view && camera.isPerspectiveCamera && main.camera.isPerspectiveCamera) {
        camera.aspect = main.camera.aspect;
        camera.updateProjectionMatrix();
      }
      const [scenePass] = app.post.composer.passes;
      scenePass.scene = scene;
      scenePass.camera = camera;
      app.post.outlinePass.camera = camera;
      if (app.post.gtaoPass) {
        app.post.gtaoPass.scene = scene;
        app.post.gtaoPass.camera = camera;
      }
      if (app.labelRenderer?.domElement) app.labelRenderer.domElement.style.visibility = view ? 'hidden' : '';
    },
  };
}
```

Run: `node node_modules/vitest/vitest.mjs run tests/unri/appView.test.js`
Expected: PASS (2 tes).

- [ ] **Langkah 3: `src/ui/FadeOverlay.js`**

```js
/**
 * Overlay hitam layar penuh untuk transisi pintu-portal (CSS opacity). fade(1) = gelap, fade(0) = terang.
 * Promise resolve setelah durasi transisi (timer, tidak bergantung `transitionend`); panggilan baru
 * menyelesaikan janji sebelumnya lebih dulu.
 */
export function createFadeOverlay(root = document.body, { ms = 350 } = {}) {
  const el = document.createElement('div');
  el.className = 'fade-overlay';
  el.style.cssText = `position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity ${ms}ms ease;z-index:1000;`;
  root.appendChild(el);
  let timer = null;
  let pending = null;
  const settle = () => {
    clearTimeout(timer);
    pending?.();
    pending = null;
  };
  return {
    fade(to) {
      settle();
      el.style.opacity = String(to);
      el.style.pointerEvents = to > 0 ? 'auto' : 'none';
      return new Promise((resolve) => {
        pending = resolve;
        timer = setTimeout(settle, ms);
      });
    },
    dispose() {
      settle();
      el.remove();
    },
  };
}
```

- [ ] **Langkah 4: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.
```bash
git add src/app/appView.js src/ui/FadeOverlay.js tests/unri/appView.test.js
```
```bash
git commit -m "feat(app): port tampilan interior (pakai App.setView bila ada) + overlay fade"
```

---

## Task 23: `interiorPortal` stub dengan mesin state penuh (TDD)

**Files:**
- Create: `src/app/interiorPortal.js`
- Test: `tests/unri/interiorPortal.test.js`

- [ ] **Langkah 1: Tulis tes yang gagal**

`tests/unri/interiorPortal.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createInteriorPortal, createStubInterior, appStage, PORTAL_STATES, LOCKED_TOAST } from '../../src/app/interiorPortal.js';
import { createResourceScope } from '../../src/engine/ResourceScope.js';
import { createSystemRunner } from '../../src/engine/SystemRunner.js';

const EXIT_TO = Object.freeze({ region: 'unri-lembaga', x: -2.79, z: -1.86, yaw: -0.33 });

function setup({ build } = {}) {
  const scopes = [];
  const restore = vi.fn();
  const view = { setView: vi.fn() };
  const stage = { swap: vi.fn(() => restore) };
  const fader = { fade: vi.fn(() => Promise.resolve()) };
  const pressed = new Set();
  const input = { consumePress: (c) => pressed.delete(c), endFrame: vi.fn() };
  const toast = vi.fn();
  const exited = vi.fn();
  const prompt = vi.fn();
  const stub = createStubInterior({ id: 'sekre', label: 'Sekretariat UKM SENI', exitTo: EXIT_TO });
  const def = build ? { ...stub, build } : stub;
  const portal = createInteriorPortal({
    interiors: { sekre: def }, view, stage, fader, input, prompt, onToast: toast, onExited: exited,
    createScope: (n) => {
      const s = createResourceScope(n);
      scopes.push(s);
      return s;
    },
    logger: { error: () => {}, warn: () => {} },
  });
  return { portal, view, stage, restore, fader, pressed, input, toast, exited, prompt, scopes };
}

describe('interiorPortal (spec §4.8)', () => {
  it('outside → fadingIn → inside: view & runner ditukar, prompt keluar', async () => {
    const t = setup();
    expect(t.portal.state).toBe(PORTAL_STATES.OUTSIDE);
    const p = t.portal.enter('sekre');
    expect(t.portal.state).toBe(PORTAL_STATES.FADING_IN);
    await expect(p).resolves.toBe(true);
    expect(t.portal.state).toBe(PORTAL_STATES.INSIDE);
    expect(t.portal.activeId).toBe('sekre');
    expect(t.stage.swap).toHaveBeenCalledTimes(1);
    const v = t.view.setView.mock.calls[0][0];
    expect(v.scene).toBeInstanceOf(THREE.Scene);
    expect(v.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(t.fader.fade.mock.calls.map((c) => c[0])).toEqual([1, 0]);
    expect(t.prompt).toHaveBeenLastCalledWith('Tekan E — Keluar');
  });

  it('enter saat bukan outside / id tak dikenal → false tanpa build kedua', async () => {
    const t = setup();
    const first = t.portal.enter('sekre');
    await expect(t.portal.enter('sekre')).resolves.toBe(false);
    await first;
    await expect(t.portal.enter('sekre')).resolves.toBe(false);
    expect(t.stage.swap).toHaveBeenCalledTimes(1);
    const u = setup();
    await expect(u.portal.enter('kantin')).resolves.toBe(false);
    expect(u.portal.state).toBe(PORTAL_STATES.OUTSIDE);
  });

  it('inside → fadingOut → outside: interior dilepas penuh, view & runner pulih, exitTo dilaporkan', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    const p = t.portal.exit();
    expect(t.portal.state).toBe(PORTAL_STATES.FADING_OUT);
    await expect(p).resolves.toBe(true);
    expect(t.portal.state).toBe(PORTAL_STATES.OUTSIDE);
    expect(t.restore).toHaveBeenCalledTimes(1);
    expect(t.view.setView).toHaveBeenLastCalledWith(null);
    expect(t.scopes[0].disposed).toBe(true);
    expect(t.exited).toHaveBeenCalledWith(EXIT_TO);
    expect(t.prompt).toHaveBeenLastCalledWith(null);
    await expect(t.portal.exit()).resolves.toBe(false);
  });

  it('build melempar: fade dibatalkan, tetap di luar, toast "Pintu terkunci", scope dilepas', async () => {
    const t = setup({ build: () => { throw new Error('rusak'); } });
    await expect(t.portal.enter('sekre')).resolves.toBe(false);
    expect(t.portal.state).toBe(PORTAL_STATES.OUTSIDE);
    expect(t.toast).toHaveBeenCalledWith(LOCKED_TOAST, false);
    expect(t.scopes[0].disposed).toBe(true);
    expect(t.view.setView).not.toHaveBeenCalled();
    expect(t.stage.swap).not.toHaveBeenCalled();
    expect(t.fader.fade.mock.calls.map((c) => c[0])).toEqual([1, 0]);
  });

  it('tombol E di dalam memicu keluar lewat sistem runner interior; endFrame dipanggil', async () => {
    const t = setup();
    let runner = null;
    t.stage.swap.mockImplementation((r) => {
      runner = r;
      return t.restore;
    });
    await t.portal.enter('sekre');
    t.pressed.add('KeyE');
    runner.update(0.016, {});
    expect(t.portal.state).toBe(PORTAL_STATES.FADING_OUT);
    expect(t.input.endFrame).toHaveBeenCalled();
    await vi.waitFor(() => expect(t.portal.state).toBe(PORTAL_STATES.OUTSIDE));
  });

  it('dispose di dalam: pemulihan segera, enter berikutnya ditolak', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    t.portal.dispose();
    expect(t.restore).toHaveBeenCalledTimes(1);
    expect(t.view.setView).toHaveBeenLastCalledWith(null);
    expect(t.scopes[0].disposed).toBe(true);
    await expect(t.portal.enter('sekre')).resolves.toBe(false);
  });
});

describe('appStage', () => {
  it('menukar runner App dan mengalihkan addSystem ke runner eksterior selama di dalam', () => {
    const exterior = createSystemRunner();
    const app = {
      systems: exterior,
      addSystem(s) { return this.systems.add(s); },
      removeSystem(id) { return this.systems.remove(id); },
    };
    const interior = createSystemRunner();
    const restore = appStage(app).swap(interior);
    expect(app.systems).toBe(interior);
    app.addSystem({ id: 'region.baru', phase: 'world', update: () => {} });
    expect(exterior.remove('region.baru', { dispose: false })).toBe(true);
    restore();
    expect(app.systems).toBe(exterior);
    expect(Object.hasOwn(app, 'addSystem')).toBe(false);
  });
});
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/interiorPortal.test.js`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Langkah 3: Buat `src/app/interiorPortal.js`**

```js
/**
 * Pintu-portal interior (spec §4.8) — STUB M4 dengan kontrak penuh; M5 mengganti interior stub dengan
 * src/interiors/sekre (defineInterior) tanpa mengubah mesin state ini.
 * enter(interiorId) / exit(); state outside → fadingIn → inside → fadingOut → outside.
 * Di dalam: runner sistem App ditukar dengan runner interior (sistem eksterior TIDAK di-update; objek &
 * scene eksterior tetap ada), port view (appView.js) menampilkan scene interior (scene eksterior tidak dirender).
 * Keluar: interior dilepas penuh (runner, build.dispose, scope), view & runner dipulihkan, onExited(exitTo).
 * Build interior melempar → fade dibatalkan, tetap di luar, toast "Pintu terkunci", scope dilepas (spec §10).
 * Port: view {setView}, stage {swap(runner) → restore}, fader {fade(0|1) → Promise}, input {consumePress, endFrame},
 * prompt(text|null).
 */
import * as THREE from 'three';
import { createResourceScope, withScope } from '../engine/ResourceScope.js';
import { createSystemRunner } from '../engine/SystemRunner.js';
import { disposeTree } from '../engine/disposeTree.js';
import { createTextTexture } from '../world/props/canvasText.js';

export const PORTAL_STATES = Object.freeze({ OUTSIDE: 'outside', FADING_IN: 'fadingIn', INSIDE: 'inside', FADING_OUT: 'fadingOut' });
export const EXIT_KEYS = Object.freeze(['KeyE', 'Escape']);
export const LOCKED_TOAST = 'Pintu terkunci';
export const EXIT_PROMPT = 'Tekan E — Keluar';

/**
 * @param {{interiors: Record<string, {id:string, exitTo:object, build(ctx:object): object|Promise<object>}>,
 *   view: {setView(v: {scene:object, camera:object}|null): void}, stage: {swap(runner:object): () => void},
 *   fader: {fade(to:number): Promise<void>}, input?: {consumePress(code:string): boolean, endFrame(): void}|null,
 *   prompt?: (text:string|null) => void, onToast?: (text:string, ok:boolean) => void, onEntered?: (def:object) => void,
 *   onExited?: (exitTo:object) => void, createScope?: (name:string) => object, createRunner?: (opts:object) => object,
 *   logger?: {error: Function, warn: Function}, ctx?: object}} opts
 */
export function createInteriorPortal({
  interiors, view, stage, fader, input = null, prompt = () => {}, onToast = () => {}, onEntered = () => {}, onExited = () => {},
  createScope = createResourceScope, createRunner = createSystemRunner, logger = console, ctx = {},
}) {
  let state = PORTAL_STATES.OUTSIDE;
  let active = null;
  let disposed = false;

  const attempt = (label, fn) => {
    try {
      fn();
    } catch (err) {
      logger.error(`Portal: ${label} gagal:`, err);
    }
  };

  const release = () => {
    if (!active) return;
    const a = active;
    active = null;
    attempt('pemulihan runner', () => a.restore());
    attempt('pemulihan view', () => view.setView(null));
    attempt('dispose runner interior', () => a.runner.dispose());
    attempt('dispose interior', () => a.build.dispose?.());
    a.scope.dispose();
    prompt(null);
  };

  async function exit() {
    if (state !== PORTAL_STATES.INSIDE || !active) return false;
    state = PORTAL_STATES.FADING_OUT;
    const { exitTo } = active.def;
    await fader.fade(1);
    release();
    onExited(exitTo);
    await fader.fade(0);
    state = PORTAL_STATES.OUTSIDE;
    return true;
  }

  const handleKeys = () => {
    if (state !== PORTAL_STATES.INSIDE || !input) return;
    if (EXIT_KEYS.some((code) => input.consumePress(code))) {
      exit().catch((err) => logger.error('Portal: keluar gagal:', err));
    }
  };

  async function enter(interiorId) {
    if (disposed || state !== PORTAL_STATES.OUTSIDE) return false;
    const def = interiors?.[interiorId];
    if (!def || typeof def.build !== 'function') {
      logger.warn(`Portal: interior "${interiorId}" tidak dikenal`);
      return false;
    }
    state = PORTAL_STATES.FADING_IN;
    await fader.fade(1);
    const scope = createScope(`interior:${interiorId}`);
    let build;
    try {
      build = await withScope(scope, () => def.build({ ...ctx, scope, exit }));
      if (!build?.scene || !build?.camera) throw new TypeError(`interior "${interiorId}": build tanpa scene/camera`);
    } catch (err) {
      logger.error(`Portal: interior "${interiorId}" gagal dibangun:`, err);
      scope.dispose();
      onToast(LOCKED_TOAST, false);
      await fader.fade(0);
      state = PORTAL_STATES.OUTSIDE;
      return false;
    }
    if (disposed) {
      attempt('dispose interior', () => build.dispose?.());
      scope.dispose();
      return false;
    }
    const runner = createRunner({ logger });
    for (const s of build.systems ?? []) runner.add(s);
    runner.add({ id: 'portal.keys', phase: 'input', update: handleKeys });
    runner.add({ id: 'portal.endFrame', phase: 'ui', update: () => input?.endFrame() });
    const restore = stage.swap(runner);
    view.setView({ scene: build.scene, camera: build.camera });
    active = { id: interiorId, def, build, scope, runner, restore };
    prompt(EXIT_PROMPT);
    onEntered(def);
    await fader.fade(0);
    if (active?.id === interiorId) state = PORTAL_STATES.INSIDE;
    return state === PORTAL_STATES.INSIDE;
  }

  return {
    get state() { return state; },
    get activeId() { return active?.id ?? null; },
    enter,
    exit,
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
      state = PORTAL_STATES.OUTSIDE;
    },
  };
}

/**
 * Port `stage` untuk App: tukar `app.systems` dengan runner interior; selama di dalam addSystem/removeSystem
 * (mis. region dipasang/dilepas manager) tetap masuk ke runner eksterior. restore() memulihkan semuanya.
 */
export function appStage(app) {
  return {
    swap(runner) {
      const exterior = app.systems;
      app.systems = runner;
      app.addSystem = (s) => exterior.add(s);
      app.removeSystem = (id, opts) => exterior.remove(id, opts);
      return () => {
        app.systems = exterior;
        delete app.addSystem;
        delete app.removeSystem;
      };
    },
  };
}

/**
 * Interior STUB (M4): ruang 4,2 × 6 × 3,2 m abu-abu, pintu cokelat, papan teks "menyusul (M5)", lampu TL.
 * Bentuk = kontrak defineInterior spec §4.8 (id, label, size, spawn, exitTo, build → {scene, camera, colliders,
 * interactables, photoPresets, systems, dispose}).
 */
export function createStubInterior({ id, label, exitTo, size = { w: 4.2, d: 6, h: 3.2 } }) {
  return Object.freeze({
    id, label, exitTo, size: Object.freeze({ ...size }),
    spawn: Object.freeze({ x: 0, z: size.d / 2 - 0.8, yaw: Math.PI }),
    build() {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x202020);
      const room = new THREE.Mesh(
        new THREE.BoxGeometry(size.w, size.h, size.d).translate(0, size.h / 2, 0),
        new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.95, side: THREE.BackSide }),
      );
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.1).translate(-1.2, 1.05, -size.d / 2 + 0.01), new THREE.MeshStandardMaterial({ color: 0x6b4a2f }));
      const tex = createTextTexture({ text: `${label}\nInterior menyusul (M5)\nTekan E untuk keluar`, width: 1024, height: 384, bg: 0xf1ede4, fg: 0x1b1b1b });
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 0.68).translate(0.8, 1.6, -size.d / 2 + 0.02),
        new THREE.MeshStandardMaterial(tex ? { map: tex } : { color: 0xf1ede4 }),
      );
      const tl = new THREE.PointLight(0xfff1dc, 30, 12, 2);
      tl.position.set(0, size.h - 0.2, 0);
      scene.add(room, door, board, tl, new THREE.AmbientLight(0xffffff, 0.6));
      const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 50);
      camera.position.set(0, 1.55, size.d / 2 - 0.8);
      camera.lookAt(0, 1.5, -size.d / 2);
      return {
        scene,
        camera,
        colliders: { isWalkable: (x, z) => Math.abs(x) < size.w / 2 - 0.3 && Math.abs(z) < size.d / 2 - 0.3 },
        interactables: [{ id: 'pintu', label: 'Pintu', pos: { x: -1.2, y: 1.0, z: -size.d / 2 + 0.3 }, radius: 1.2, prompt: 'Keluar', onInteract: () => ({ text: 'Keluar' }) }],
        photoPresets: [],
        systems: [],
        dispose() {
          disposeTree(scene);
        },
      };
    },
  });
}
```

- [ ] **Langkah 4: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/interiorPortal.test.js`
Expected: PASS (7 tes).

- [ ] **Langkah 5: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.
```bash
git add src/app/interiorPortal.js tests/unri/interiorPortal.test.js
```
```bash
git commit -m "feat(app): interiorPortal stub (mesin state §4.8 penuh, interior kotak abu, runner & view ditukar)"
```

---

## Task 24: Pemicu pintu di eksterior + pemasangan portal di `main.js`

**Files:**
- Create: `src/app/portalTrigger.js`
- Modify: `src/main.js`, `tests/unri/interiorPortal.test.js` (tes `nearestPortal`)

- [ ] **Langkah 1: Tes yang gagal** (impor di blok atas `tests/unri/interiorPortal.test.js`, blok di akhir)

```js
import { nearestPortal } from '../../src/app/portalTrigger.js';
import { PORTAL_DOORS } from '../../src/regions/unri-lembaga/portalDoors.js';
import { LEMBAGA_PLACEMENT } from '../../src/regions/unri-lembaga/placement.js';
```
```js
describe('nearestPortal', () => {
  const active = [{ def: { id: 'unri-lembaga', placement: LEMBAGA_PLACEMENT }, region: { portals: PORTAL_DOORS } }];
  const door = PORTAL_DOORS[0];
  const wx = LEMBAGA_PLACEMENT.x + door.pos.lx;
  const wz = LEMBAGA_PLACEMENT.z + door.pos.lz;

  it('dalam radius → pintu & region; di luar radius → null', () => {
    expect(nearestPortal(active, wx + 1.0, wz)).toMatchObject({ regionId: 'unri-lembaga', door });
    expect(nearestPortal(active, wx + 2.0, wz)).toBeNull();
  });

  it('region tanpa portals diabaikan', () => {
    expect(nearestPortal([{ def: { id: 'stadion', placement: { x: 0, z: 0, yaw: 0 } }, region: {} }], 0, 0)).toBeNull();
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/unri/interiorPortal.test.js`
Expected: FAIL — `portalTrigger.js` tidak ditemukan.

- [ ] **Langkah 2: Buat `src/app/portalTrigger.js`**

```js
/**
 * Pemicu pintu-portal di eksterior. Sistem 'portal.trigger' (fase input, didaftarkan SEBELUM keymap agar E
 * dikonsumsi lebih dulu saat di depan pintu) mencari pintu terdekat dari field `portals` region aktif;
 * 'portal.prompt' (fase ui, didaftarkan SESUDAH hud) menampilkan "Tekan E — <prompt>" tanpa tertimpa.
 */
import { toLocal } from '../geo/regionTransform.js';

/**
 * Pintu terdekat dalam radiusnya. MURNI.
 * @param {Array<{def:{id:string, placement:object}, region:{portals?:Array<object>}}>} active
 * @returns {{door:object, regionId:string, distance:number}|null}
 */
export function nearestPortal(active, x, z) {
  let best = null;
  for (const { def, region } of active) {
    const doors = region?.portals ?? [];
    if (!doors.length) continue;
    const l = toLocal(def.placement, x, z);
    for (const door of doors) {
      const d = Math.hypot(l.x - door.pos.lx, l.z - door.pos.lz);
      if (d <= door.radius && (!best || d < best.distance)) best = { door, regionId: def.id, distance: d };
    }
  }
  return best;
}

/**
 * @param {{app:{addSystem:Function, removeSystem:Function}, portal:{state:string, enter(id:string):Promise<boolean>},
 *   input:{consumePress(code:string):boolean}, hud:{setPrompt(t:string|null):void}, getActive:() => Array<object>,
 *   getBike:() => {x:number, z:number}, isBlocked?:() => boolean, logger?:{error:Function}}} opts
 */
export function createPortalTrigger({ app, portal, input, hud, getActive, getBike, isBlocked = () => false, logger = console }) {
  let near = null;
  app.addSystem({
    id: 'portal.trigger',
    phase: 'input',
    update: () => {
      near = null;
      if (portal.state !== 'outside' || isBlocked()) return;
      const b = getBike();
      near = nearestPortal(getActive(), b.x, b.z);
      if (near && input.consumePress('KeyE')) portal.enter(near.door.interiorId).catch((err) => logger.error('Portal gagal dibuka:', err));
    },
  });
  return {
    /** Panggil SETELAH sistem 'hud' terdaftar. */
    installPrompt() {
      app.addSystem({ id: 'portal.prompt', phase: 'ui', update: () => { if (near && portal.state === 'outside') hud.setPrompt(`Tekan E — ${near.door.prompt}`); } });
    },
    dispose() {
      app.removeSystem('portal.trigger');
      app.removeSystem('portal.prompt');
    },
  };
}
```

Run: `node node_modules/vitest/vitest.mjs run tests/unri/interiorPortal.test.js`
Expected: PASS (9 tes).

- [ ] **Langkah 3: Pasang di `src/main.js`**

Impor (`createCollider` sudah diimpor main.js — jangan diduplikasi):
```js
import { createInteriorPortal, createStubInterior, appStage } from './app/interiorPortal.js';
import { appViewPort } from './app/appView.js';
import { createPortalTrigger } from './app/portalTrigger.js';
import { createFadeOverlay } from './ui/FadeOverlay.js';
import { sekreExitTo } from './regions/unri-lembaga/portalDoors.js';
import { PLAYER_ROOM_INDEX } from './regions/unri-lembaga/sekre.data.js';
```
Fungsi baru di bawah `setupFastTravel` (`regions`, `colliders` = variabel M0 di `main()`):
```js
/**
 * Pintu-portal interior (M4 stub): pintu sekre pemain → interior kotak abu; keluar → sepeda di tempat semula
 * (dipindah ke depan pintu hanya bila > 3 m darinya). Interior sekre penuh di M5.
 */
function setupPortal({ app, input, hud, rig, ents, regions, colliders, lifecycle }) {
  const fader = createFadeOverlay(document.body);
  lifecycle.add(() => fader.dispose());
  const ormawa = LEMBAGA_LAYOUT.rooms[PLAYER_ROOM_INDEX];
  const placeBike = (exitTo) => {
    const frame = regions.frameOf(exitTo.region);
    const b = ents.bike.state;
    if (!frame) {
      ents.bike.state = { ...b, v: 0 };
      return;
    }
    const w = frame.toWorld(exitTo.x, exitTo.z);
    if (Math.hypot(b.x - w.x, b.z - w.z) <= 3) {
      ents.bike.state = { ...b, v: 0 };
      return;
    }
    ents.bike.state = { ...b, x: w.x, z: w.z, yaw: frame.yawToWorld(exitTo.yaw), v: 0 };
    ents.bike.setCollider(createCollider({ x: w.x, z: w.z }, colliders.isWalkable, colliders.penetration));
  };
  const portal = createInteriorPortal({
    interiors: { sekre: createStubInterior({ id: 'sekre', label: `Sekretariat ${ormawa.nama}`, exitTo: sekreExitTo() }) },
    view: appViewPort(app), stage: appStage(app), fader, input,
    prompt: (text) => hud.setPrompt(text),
    onToast: (text, ok) => hud.toast(text, ok),
    onEntered: () => {
      ents.bike.state = { ...ents.bike.state, v: 0 };
      document.exitPointerLock?.();
    },
    onExited: placeBike,
  });
  lifecycle.add(() => portal.dispose());
  const trigger = createPortalTrigger({
    app, portal, input, hud,
    getActive: () => regions.active(),
    getBike: () => ents.bike.state,
    isBlocked: () => hud.shopOpen || rig.freezesBike,
  });
  lifecycle.add(() => trigger.dispose());
  return { portal, trigger };
}
```
Di `main()`: panggil `const portalKit = setupPortal({ app, input, hud, rig, ents, regions, colliders, lifecycle });` **sebelum** `addFrameSystems(...)` (agar 'portal.trigger' terdaftar sebelum 'keymap'), lalu **setelah** `addFrameSystems(...)` panggil `portalKit.trigger.installPrompt();`. Di blok `if (import.meta.env.DEV) { … }` tambahkan setelah `exposeDevTools(...)`:
```js
    window.__sim.portal = portalKit.portal; // E2E: siklus masuk/keluar interior
```

- [ ] **Langkah 4: Uji asap**

Dev server → perjalanan cepat dev ke Sekretariat → kayuh masuk mulut selasar barat, berhenti di depan pintu kedua baris utara (papan "UKM SENI", tepat di sebelah "BEM UNIVERSITAS RIAU"). Expected: prompt "Tekan E — Masuk sekre"; E → layar gelap → ruang abu bertuliskan "Sekretariat UKM SENI / Interior menyusul (M5)"; E atau Esc → kembali di depan pintu, sepeda tetap di tempat; konsol bersih. Ulangi 3×.

- [ ] **Langkah 5: Lint, tes, commit**

Run: `node node_modules/vitest/vitest.mjs run` lalu `npm run lint`
Expected: semua PASS, 0 galat lint.
```bash
git add src/app/portalTrigger.js src/main.js tests/unri/interiorPortal.test.js
```
```bash
git commit -m "feat(app): pemicu pintu-portal sekre pemain (E) + pemasangan portal stub di main"
```

---

## Task 25: Model Blender A01 motor bebek & A02 motor matic → GLB (opsional bila Blender tersedia)

**Files:**
- Create: `assets-src/blender/unri/motor.py`, `assets-src/blender/unri/motor.blend` (hasil simpan), `public/models/unri/motor-bebek.glb`, `public/models/unri/motor-matic.glb`
- Modify: `src/world/props/unri/motor.js` (`MOTOR_GLB_READY = true`)

- [ ] **Langkah 1: Cek Blender**

Panggil `mcp__blender__get_addon_status` lalu `mcp__blender__get_scene_info`. Bila MCP tidak terhubung: **lewati Task 25** (placeholder prosedural tetap final sementara; `MOTOR_GLB_READY` tetap `false`), catat di "Catatan eksekusi", lanjut Task 26.
Lalu jalankan via `mcp__blender__execute_blender_code`:
```python
import bpy
print(bpy.app.version_string, bpy.data.filepath, bpy.data.is_dirty)
```
Bila `is_dirty` bernilai True → **berhenti dan tanya user** apakah file Blender yang terbuka boleh ditutup (jangan membuang pekerjaan user). Bila bersih, lanjut.

- [ ] **Langkah 2: Buat `assets-src/blender/unri/motor.py`**

```python
"""
A01 motor-bebek & A02 motor-matic (katalog aset UNRI, docs/superpowers/specs/2026-10-17-unri-asset-catalog.md §4).
Dibangun dari primitif + bevel, lalu diekspor dengan assets-src/blender/export_glb.py (gabung per material).
Skala meter, Z ke atas di Blender (glTF Y-up saat ekspor), HIDUNG di +Y Blender (= -Z three.js), origin di
tengah alas. Material: unri:bodi (putih, diwarnai per instance di three.js), unri:hitam, unri:krom, unri:lampu.
Target <= 2.000 segitiga per motor. Ukuran: A01 0,7 x 1,9 x 1,05 m; A02 0,7 x 1,85 x 1,1 m.
"""
import math

import bpy


def material(name, rgb, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def materials():
    return {
        "bodi": material("unri:bodi", (0.9, 0.9, 0.9), 0.1, 0.45),
        "hitam": material("unri:hitam", (0.03, 0.03, 0.03), 0.0, 0.8),
        "krom": material("unri:krom", (0.7, 0.72, 0.74), 0.8, 0.3),
        "lampu": material("unri:lampu", (0.95, 0.94, 0.9), 0.0, 0.2),
    }


def collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    return col


def _own(col, obj, mat, bevel=0.0):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    return obj


def box(col, mat, size, loc, bevel=0.0, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _own(col, obj, mat, bevel)


def cyl(col, mat, r, depth, loc, axis="X", verts=12, rot=None):
    base = {"X": (0.0, math.pi / 2, 0.0), "Y": (math.pi / 2, 0.0, 0.0), "Z": (0.0, 0.0, 0.0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot or base)
    return _own(col, bpy.context.active_object, mat)


def wheel(col, m, radius, y):
    bpy.ops.mesh.primitive_torus_add(major_segments=16, minor_segments=6, major_radius=radius - 0.055,
                                     minor_radius=0.055, location=(0, y, radius), rotation=(0, math.pi / 2, 0))
    _own(col, bpy.context.active_object, m["hitam"])
    cyl(col, m["krom"], radius * 0.6, 0.05, (0, y, radius), "X", 12)
    cyl(col, m["hitam"], 0.035, 0.12, (0, y, radius), "X", 8)


def fork(col, m, radius, y_axle, y_head, z_head):
    dy = y_head - y_axle
    dz = z_head - radius
    tilt = math.atan2(-dy, dz)
    length = math.hypot(dy, dz)
    for x in (-0.07, 0.07):
        cyl(col, m["krom"], 0.02, length, (x, (y_axle + y_head) / 2, (radius + z_head) / 2), rot=(tilt, 0.0, 0.0), verts=8)


def handlebar(col, m, y, z, mirror_top):
    cyl(col, m["hitam"], 0.015, 0.6, (0, y, z), "X", 8)
    for x in (-0.3, 0.3):
        cyl(col, m["hitam"], 0.02, 0.1, (x, y, z), "X", 8)
        sx = 0.24 if x > 0 else -0.24
        cyl(col, m["hitam"], 0.008, mirror_top - 0.05 - z, (sx, y, (z + mirror_top - 0.05) / 2), "Z", 6)
        box(col, m["krom"], (0.08, 0.02, 0.05), (sx, y, mirror_top - 0.025), 0.005)


def build_motor_bebek():
    """A01: bebek (rangka terbuka di tengah, tameng kaki, roda 17 inci)."""
    m = materials()
    col = collection("UNRI_A01_MotorBebek")
    r = 0.29
    for y in (0.66, -0.66):
        wheel(col, m, r, y)
    fork(col, m, r, 0.66, 0.48, 0.86)
    box(col, m["bodi"], (0.46, 0.06, 0.44), (0, 0.36, 0.58), 0.02, (-0.25, 0, 0))
    box(col, m["bodi"], (0.2, 0.5, 0.12), (0, 0.1, 0.42), 0.02)
    box(col, m["bodi"], (0.3, 0.72, 0.26), (0, -0.3, 0.68), 0.04)
    box(col, m["bodi"], (0.28, 0.24, 0.16), (0, 0.52, 0.9), 0.03)
    box(col, m["bodi"], (0.12, 0.42, 0.03), (0, 0.66, 0.6), 0.01)
    box(col, m["bodi"], (0.15, 0.34, 0.03), (0, -0.6, 0.62), 0.01)
    cyl(col, m["lampu"], 0.06, 0.03, (0, 0.645, 0.9), "Y", 12)
    box(col, m["lampu"], (0.12, 0.03, 0.05), (0, -0.67, 0.72), 0.005)
    box(col, m["hitam"], (0.27, 0.64, 0.08), (0, -0.3, 0.85), 0.03)
    box(col, m["hitam"], (0.24, 0.3, 0.22), (0, 0.02, 0.2), 0.02)
    cyl(col, m["krom"], 0.04, 0.6, (0.17, -0.3, 0.24), "Y", 10)
    handlebar(col, m, 0.46, 0.99, 1.045)
    return col


def build_motor_matic():
    """A02: matic (dek kaki rata, bodi belakang besar, roda 14 inci)."""
    m = materials()
    col = collection("UNRI_A02_MotorMatic")
    r = 0.25
    for y in (0.675, -0.675):
        wheel(col, m, r, y)
    fork(col, m, r, 0.675, 0.5, 0.9)
    box(col, m["bodi"], (0.44, 0.08, 0.5), (0, 0.42, 0.55), 0.04, (-0.2, 0, 0))
    box(col, m["bodi"], (0.3, 0.45, 0.06), (0, 0.05, 0.29), 0.02)
    box(col, m["bodi"], (0.32, 0.78, 0.36), (0, -0.33, 0.6), 0.06)
    box(col, m["bodi"], (0.3, 0.26, 0.2), (0, 0.5, 0.94), 0.04)
    box(col, m["bodi"], (0.12, 0.34, 0.03), (0, 0.675, 0.52), 0.01)
    box(col, m["lampu"], (0.16, 0.03, 0.07), (0, 0.645, 0.92), 0.01)
    box(col, m["lampu"], (0.14, 0.03, 0.05), (0, -0.72, 0.66), 0.005)
    box(col, m["hitam"], (0.29, 0.66, 0.08), (0, -0.3, 0.82), 0.03)
    box(col, m["hitam"], (0.1, 0.6, 0.18), (-0.17, -0.35, 0.21), 0.02)
    cyl(col, m["krom"], 0.035, 0.45, (0.17, -0.45, 0.26), "Y", 10)
    handlebar(col, m, 0.48, 1.03, 1.1)
    return col
```

- [ ] **Langkah 3: Bangun & periksa di Blender**

Via `mcp__blender__execute_blender_code` (memuat modul dengan `runpy.run_path`, mengembalikan namespace modul):
```python
import runpy
import bpy
from mathutils import Vector
bpy.ops.wm.read_homefile(use_empty=True)
ROOT = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
motor = runpy.run_path(ROOT + r"\assets-src\blender\unri\motor.py")
for col in (motor["build_motor_bebek"](), motor["build_motor_matic"]()):
    pts = [o.matrix_world @ Vector(c) for o in col.objects for c in o.bound_box]
    span = [round(max(p[i] for p in pts) - min(p[i] for p in pts), 3) for i in range(3)]
    print(col.name, span, round(min(p.z for p in pts), 3))
```
Expected (± 0,02): `UNRI_A01_MotorBebek [0.7, 1.9, 1.045] 0.0` dan `UNRI_A02_MotorMatic [0.7, 1.85, 1.1] 0.0` (urutan X, Y = panjang, Z = tinggi).
Lalu `mcp__blender__look` (max_size kecil) — periksa siluet: lampu depan di +Y, roda menapak, stang & spion simetris, bodi bebek terbuka di tengah vs matic berdek rata. Perbaiki proporsi di `motor.py` bila janggal lalu ulangi langkah ini.

- [ ] **Langkah 4: Ekspor GLB & simpan .blend**

```python
import runpy
import bpy
ROOT = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
exporter = runpy.run_path(ROOT + r"\assets-src\blender\export_glb.py")
print(exporter["export_collection"]("UNRI_A01_MotorBebek", ROOT + r"\public\models\unri\motor-bebek.glb"))
print(exporter["export_collection"]("UNRI_A02_MotorMatic", ROOT + r"\public\models\unri\motor-matic.glb"))
bpy.ops.wm.save_as_mainfile(filepath=ROOT + r"\assets-src\blender\unri\motor.blend")
```
Expected: dua tuple `(4, <segitiga ≤ 2000>, <KB ≤ 150>)` (4 mesh = 4 material). Bila segitiga > 2000: ulangi dengan argumen `ratios={"unri:hitam": 0.6}`.

- [ ] **Langkah 5: Verifikasi GLB dari Node**

```bash
node -e "import('@gltf-transform/core').then(async ({NodeIO,getBounds})=>{for (const f of ['motor-bebek','motor-matic']){const d=await new NodeIO().read('public/models/unri/'+f+'.glb');const b=getBounds(d.getRoot().listScenes()[0]);const s=b.max.map((v,i)=>+(v-b.min[i]).toFixed(3));const mats=d.getRoot().listMaterials().map(m=>m.getName());console.log(f,s,b.min[1].toFixed(3),mats.join(','));}})"
```
Expected: `motor-bebek [0.7, 1.045, 1.9] 0.000 unri:bodi,unri:hitam,unri:krom,unri:lampu` dan `motor-matic [0.7, 1.1, 1.85] 0.000 …` (urutan [X, Y, Z]; Y = tinggi). Cek hidung di −Z:
```bash
node -e "import('@gltf-transform/core').then(async ({NodeIO})=>{const d=await new NodeIO().read('public/models/unri/motor-bebek.glb');const n=d.getRoot().listNodes().find(n=>n.getMesh()?.listPrimitives()[0].getMaterial()?.getName()==='unri:lampu');const p=n.getMesh().listPrimitives()[0].getAttribute('POSITION');let minZ=1e9;for(let i=0;i<p.getCount();i++)minZ=Math.min(minZ,p.getElement(i,[])[2]);console.log('lampu minZ',minZ.toFixed(3));})"
```
Expected: `lampu minZ` ≈ `-0.66` (negatif = depan di −Z).

- [ ] **Langkah 6: Aktifkan GLB**

Di `src/world/props/unri/motor.js` ubah `export const MOTOR_GLB_READY = false;` → `true`. Dev server → perjalanan cepat dev → motor di depan sekretariat tampil versi GLB (`window.__sim.app.scene.getObjectByName('A01-motor-bebek-glb')` tidak null), tanpa 404 di tab Network.

- [ ] **Langkah 7: Commit**

```bash
git add assets-src/blender/unri/motor.py assets-src/blender/unri/motor.blend public/models/unri/motor-bebek.glb public/models/unri/motor-matic.glb src/world/props/unri/motor.js
```
```bash
git commit -m "feat(aset): model Blender motor bebek A01 & matic A02 (GLB instanced, ≤2k segitiga)"
```

---

## Task 26: Ukur budget draw call + screenshot siang/malam/hujan (Playwright GPU)

**Files:**
- Create: `tests/e2e/lembaga.e2e.mjs`
- Create (keluaran): `docs/screenshots/unri/m4-siang.jpg`, `m4-malam.jpg`, `m4-hujan.jpg`, `m4-selasar.jpg`, `m4-stadion-mini.jpg`, `m4-interior-stub.jpg`

- [ ] **Langkah 1: Buat `tests/e2e/lembaga.e2e.mjs`**

```js
#!/usr/bin/env node
/**
 * E2E zona Lembaga (M4) — TIDAK ikut `vitest run`.
 *   node tests/e2e/lembaga.e2e.mjs [--gpu d3d11|swiftshader] [--out laporan.json]
 * Vite (port 5175) + Chromium headless 1280×720 (paket playwright global / PLAYWRIGHT_PATH), lalu:
 *   1. perjalanan cepat dev ke Sekretariat, tunggu region `unri-lembaga` siap;
 *   2. draw call region = calls(semua) − calls(grup region disembunyikan), frame yang sama (≤ 250, spec §9.1);
 *   3. screenshot siang, malam, hujan, selasar, stadion mini → docs/screenshots/unri/m4-*.jpg;
 *   4. masuk/keluar interior stub 3× → renderer.info.memory kembali ke baseline; screenshot interior.
 * Exit code 0 = lulus; laporan JSON ke stdout.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5175;
const SHOTS = join(ROOT, 'docs', 'screenshots', 'unri');
const LIMITS = Object.freeze({ regionCalls: 250 });
/** Titik kamera (dunia): depan mulut selasar barat, di dalam selasar dekat pintu BEM, sisi timur stadion mini. */
const SPOTS = Object.freeze({
  mulut: { x: -232.12, z: 1094.84, yaw: 1.2383 },
  selasar: { x: -226.56, z: 1096.76, yaw: 1.2383 },
  stadion: { x: -150, z: 950, yaw: -Math.PI / 2 },
});
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});

const { values: opts } = parseArgs({ options: { gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string' } } });

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
  mkdirSync(SHOTS, { recursive: true });
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const report = { gpu: opts.gpu, checks: {}, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('response', (res) => { if (res.status() >= 400) report.errors.push(`HTTP ${res.status()} ${res.url()}`); });
    const shot = (name) => page.screenshot({ path: join(SHOTS, `m4-${name}.jpg`), type: 'jpeg', quality: 85 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && window.__sim.fastTravel && window.__sim.portal, null, { timeout: 240000 });
    report.checks.travel = await page.evaluate(PAGE.travel);
    await page.waitForFunction(() => window.__sim.app.scene.getObjectByName('region:unri-lembaga')?.userData.lembagaReady === true, null, { timeout: 120000 });
    await page.evaluate(PAGE.view, { spot: SPOTS.mulut, hour: 12, rain: false });
    report.checks.budget = await page.evaluate(PAGE.budget);
    await shot('siang');
    await page.evaluate(PAGE.view, { spot: SPOTS.mulut, hour: 20, rain: false });
    await shot('malam');
    await page.evaluate(PAGE.view, { spot: SPOTS.mulut, hour: 16, rain: true });
    await shot('hujan');
    await page.evaluate(PAGE.view, { spot: SPOTS.selasar, hour: 12, rain: false });
    await shot('selasar');
    await page.evaluate(PAGE.view, { spot: SPOTS.stadion, hour: 9, rain: false });
    await shot('stadion-mini');
    report.checks.portal = await page.evaluate(PAGE.portalCycle);
    await page.evaluate(() => window.__sim.portal.enter('sekre'));
    await page.waitForFunction(() => window.__sim.portal.state === 'inside', null, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 800));
    await shot('interior-stub');
    await page.evaluate(() => window.__sim.portal.exit());
  } finally {
    await browser.close();
    await server.close();
  }
  const fails = [];
  if (report.errors.length) fails.push(`galat konsol: ${report.errors.length}`);
  if (!(report.checks.budget?.regionCalls <= LIMITS.regionCalls)) fails.push(`draw call region ${report.checks.budget?.regionCalls} > ${LIMITS.regionCalls}`);
  const p = report.checks.portal;
  if (!p || !p.cycles.every((c) => c.state === 'outside' && c.geometries === p.baseline.geometries && c.textures === p.baseline.textures)) fails.push(`siklus portal/memori: ${JSON.stringify(p)}`);
  report.fails = fails;
  console.log(JSON.stringify(report, null, 2));
  if (opts.out) writeFileSync(opts.out, `${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = fails.length ? 1 : 0;
}

/** Fungsi yang dievaluasi di halaman (window.__sim dari src/app/devtools.js + main.js). */
const PAGE = {
  async travel() {
    const s = window.__sim;
    s.rig.exitPov();
    s.store.set('sky.advanceTime', false);
    s.store.set('camera.mode', 'third');
    const status = await s.fastTravel('unri-lembaga');
    return { status, bike: { x: s.ents.bike.state.x, z: s.ents.bike.state.z } };
  },
  async view({ spot, hour, rain }) {
    const s = window.__sim;
    s.store.set('sky.hour', hour);
    s.store.set('weather.raining', rain);
    s.teleport(spot.x, spot.z, spot.yaw);
    await new Promise((r) => setTimeout(r, rain ? 5000 : 3500));
    s.app.renderFrame();
  },
  budget() {
    const s = window.__sim;
    const region = s.app.scene.getObjectByName('region:unri-lembaga');
    const info = s.app.renderer.info.render;
    s.app.renderFrame();
    const all = info.calls;
    const tris = info.triangles;
    region.visible = false;
    s.app.renderFrame();
    const without = info.calls;
    const trisWithout = info.triangles;
    region.visible = true;
    s.app.renderFrame();
    return { regionCalls: all - without, totalCalls: all, regionTriangles: tris - trisWithout };
  },
  async portalCycle() {
    const s = window.__sim;
    const wait = (state) => new Promise((resolve, reject) => {
      const t0 = performance.now();
      const tick = () => {
        if (s.portal.state === state) return resolve();
        if (performance.now() - t0 > 15000) return reject(new Error(`portal tidak mencapai ${state}`));
        return setTimeout(tick, 50);
      };
      tick();
    });
    const frames = async (n) => {
      for (let i = 0; i < n; i += 1) await new Promise((r) => requestAnimationFrame(() => r()));
    };
    const once = async () => {
      await s.portal.enter('sekre');
      await wait('inside');
      await frames(10);
      await s.portal.exit();
      await wait('outside');
      await frames(10);
      const m = s.app.renderer.info.memory;
      return { state: s.portal.state, geometries: m.geometries, textures: m.textures };
    };
    await once(); // pemanasan: unggahan GPU pertama
    const baseline = { ...s.app.renderer.info.memory };
    const cycles = [];
    for (let i = 0; i < 3; i += 1) cycles.push(await once());
    return { baseline, cycles };
  },
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Langkah 2: Jalankan**

Run: `node tests/e2e/lembaga.e2e.mjs --gpu d3d11 --out lembaga-e2e.json`
Expected: exit code 0; JSON berisi `checks.budget.regionCalls` ≤ 250 (perkiraan dari hitungan objek Node ±105 objek + ±30 pemilik bayangan + kit SC ±15 ⇒ ±150–190), `fails: []`, dan 6 file `docs/screenshots/unri/m4-*.jpg`.
Bila `regionCalls` > 250, mitigasi berurutan (spec §9.3): (1) `cellSize` ilalang 30 → 60 di `ilalang.js`; (2) `castShadow` false untuk props teras kecil (rak, galon) dan detail rusunawa; (3) satukan material `lampu`+`putih` dudukan lampu.
Hapus `lembaga-e2e.json` (jangan di-commit).

- [ ] **Langkah 3: Periksa screenshot secara visual** (buka keenam JPG). Daftar periksa:
  - siang: atap seng pelana dengan talang, deret papan nama di atas pintu, motor parkir rapat di sisi utara dan mulut selasar, pagar + 3 spanduk menghadap jalan;
  - malam: bohlam selasar menyala + kolam cahaya di keramik, PJU menyala, tidak ada objek hitam pekat tak terduga;
  - hujan: hujan tampil, keramik/rumput/lintasan lebih gelap (registry basah);
  - selasar: papan "BEM UNIVERSITAS RIAU" bersebelahan dengan pintu sekre pemain ("UKM SENI"), stiker di pintu, rak sepatu & sandal, plafon bergaris;
  - stadion mini: rumput aus, lintasan tanah merah 6 lajur, tribun barat beratap di bagian tengah dengan papan nama;
  - interior-stub: ruang abu bertuliskan "Sekretariat UKM SENI".
  Perbaiki yang janggal (posisi/arah), ulangi langkah 2.

- [ ] **Langkah 4: Commit**

```bash
git add tests/e2e/lembaga.e2e.mjs docs/screenshots/unri/m4-siang.jpg docs/screenshots/unri/m4-malam.jpg docs/screenshots/unri/m4-hujan.jpg docs/screenshots/unri/m4-selasar.jpg docs/screenshots/unri/m4-stadion-mini.jpg docs/screenshots/unri/m4-interior-stub.jpg
```
```bash
git commit -m "test(e2e): ukur draw call zona Lembaga ≤250 + siklus portal 3× + screenshot M4"
```

---

## Task 27: Verifikasi akhir tonggak + status indeks

**Files:**
- Modify: `docs/superpowers/plans/2026-10-17-unri-00-index.md` (baris status M4)

- [ ] **Langkah 1: Gerbang tonggak**

```bash
node node_modules/vitest/vitest.mjs run
npm run lint
npm run build
npm run e2e -- --gpu d3d11
node tests/e2e/lembaga.e2e.mjs --gpu d3d11
```
Expected: semua tes PASS; lint 0 galat; build sukses; smoke E2E lama `fails: []` (paritas stadion tidak berubah: region baru tidak terpasang di spawn stadion); E2E lembaga `fails: []`.

- [ ] **Langkah 2: Perbarui status di indeks**

Ganti baris M4 tabel "Status tonggak" di `docs/superpowers/plans/2026-10-17-unri-00-index.md` (isi hash dari `git log -1 --format=%h` dan angka draw call dari E2E):
```markdown
| M4 | selesai | <hash> | region unri-lembaga: H01 sekretariat handmade, H02 stadion mini, H03 SC, detail rusunawa/FH, parkir motor, proxy, portal stub; draw call region <angka> (≤250); deviasi D2 buildings.data.js, D5 GLB A01/A02 |
```

- [ ] **Langkah 3: Commit**

```bash
git add docs/superpowers/plans/2026-10-17-unri-00-index.md docs/superpowers/plans/2026-10-17-unri-m4-zona-lembaga.md
```
```bash
git commit -m "docs(unri): status M4 zona Lembaga selesai"
```

---

## Self-review

**Cakupan brief/spec → task**

| Butir | Task |
|---|---|
| placement & mask tidak beririsan mask stadion + tes | 1, 2 |
| pads → campusbake + bake ulang terrain | 2, 3 |
| collider + tes | 7 |
| layout | 5 |
| H01: 2 × 4 ruang ±4,2 × 6 m (OSM: 4,19 × 5,93), selasar 3,7 m terbuka di kedua ujung | 5, 11, 14 |
| 8 pintu + papan nama kanvas (BEM UNIVERSITAS RIAU, DPM, 6 dari `sekre.data.js`), sekre pemain di sebelah BEM | 4, 6, 8, 12, 14 |
| jendela nako, roster, atap seng pelana + talang, plafon selasar, lampu selasar malam, keramik selasar | 12, 13, 14 |
| teras: rak sepatu, sandal, papan pengumuman, stiker, jemuran almamater biru langit, galon, motor parkir rapat, spanduk ormawa di pagar, tempat sampah | 8, 9, 10, 14, 18 |
| H02 stadion mini (lapangan, lintasan, tribun [INFERENSI], lampu: tidak dipasang karena tidak terkonfirmasi) | 15 |
| H03 Student Center (K03 hero) | 16 |
| Rusunawa K09 hero detail; FH K10 + ilalang | 17 |
| parkiran | 18 |
| proxy ≤ 8 draw call | 19 (1 draw call) |
| props placeholder ukuran persis katalog + tes | 8–10 |
| GLB A01/A02 via Blender MCP + fallback prosedural | 10, 18, 25 |
| `PORTAL_DOORS` + stub `interiorPortal` (kontrak §4.8 penuh) + tes mesin state & port tampilan | 6, 22, 23, 24 |
| fast travel dev | 21 |
| `isReserved` distrik untuk mask region (serah terima M2 #6) | 21 |
| budget ≤ 250 draw call + cara ukur | 14 (tes per gedung di Node), 26 (E2E GPU) |
| screenshot siang/malam/hujan | 26 |

**Pemindaian placeholder:** tidak ada "TBD/TODO/kerjakan nanti"; setiap langkah kode berisi kode lengkap. Bagian yang bergantung pada detail M0–M3 yang belum tertulis dibatasi ke Task 0 (verifikasi) dan satu file adaptor per kontrak (`kitAdapter.js`, `pads.js`, `povs.js`, `index.js#runSteps/heightFns`).

**Verifikasi saat menulis plan:** kode Task 1–20 dan 23–24 dijalankan di salinan kerja sementara (`src/` repo + file plan, kit M3 di-mock, `UNRI_BOUNDARY` diganti poligon kampus OSM mentah): 80 tes lulus, ESLint konfigurasi repo 0 masalah; hitungan Node: H01 17 objek gambar / 9,7k segitiga, teras 18 / 11,9k, parkir 16 / 151k, stadion mini 17 / 6,4k, rusunawa 11 / 4,2k, FH 16 / 10,3k (tanpa kit SC).

**Konsistensi nama:** `UNRI_LEMBAGA_ID`, `LEMBAGA_PLACEMENT`, `LEMBAGA_MASK(_WORLD)`, `LEMBAGA_ACTIVATION`, `LEMBAGA_PADS`, `lembagaPadsWorld`, `SEKRE_FRAME`, `SEKRE_DIM`, `LEMBAGA_LAYOUT`, `PORTAL_DOORS` (bentuk persis indeks `{id, interiorId, pos:{lx,lz}, yaw, radius:1.6, prompt}` + `roomIndex`), `sekreExitTo`, `unriLembagaRegion`, `createInteriorPortal`/`createStubInterior`/`appStage`/`PORTAL_STATES`, `appViewPort`, `nearestPortal`/`createPortalTrigger`. Nama file mengikuti indeks M4; file tambahan (footprints, staged, materials, sekretariat.*, kitAdapter, povs, regionOwned, FadeOverlay, appView, portalTrigger, atlas, geom) = file baru di dalam tonggak sendiri (diizinkan indeks).

**Fakta vs inferensi:** footprint, nama, kapasitas, lantai OSM, lokasi SC (teks resmi), satpam, parkir padat, almamater biru langit, tagline "Unggul dan Bermartabat" = fakta bersumber; denah, warna, atap, lintasan, tribun, isi teras, nama 6 ormawa, teks spanduk/plang = **[INFERENSI]** tertulis di JSDoc modul & `SEKRE_SUMBER`.

**Risiko**
1. Antarmuka M0–M3 berbeda dari asumsi → Task 0 + file adaptor tunggal.
2. Vegetasi distrik dari poligon OSM lama (`natural=wood` way 1452901217 menutupi tapak SC) — diatasi predikat `isReserved` (Task 21 langkah 3b, serah terima M2 butir 6); bila `mountDistrict` M1 belum meneruskan opsi, langkah 3b menambahkannya.
3. Jogging track (jalan distrik) ±3 m di luar pad sekretariat: transisi pad–pengondisian jalan bisa membuat undakan kecil; periksa di screenshot, kecilkan `SEKRE_PAD_MARGIN.x` bila perlu (lalu bake ulang Task 3).
4. Ketinggian lampu malam `registerLamps` memakai tinggi PJU 9 m relatif tanah (M1) — PJU zona memakai `LampPost` 9 m agar cocok.
5. Teks kanvas bergantung font sans-serif sistem; aman di Chromium/Windows.
6. Segitiga parkir ±150k saat semua lot terlihat; mitigasi: turunkan `fill` lot atau ganti placeholder lot ke LOD lebih sederhana.
7. `appStage` menimpa `app.addSystem/removeSystem` sementara (properti instance) — `App.dispose` saat di dalam aman karena portal dilepas lebih dulu (LIFO).

---

## Serah terima ke M5

- **Portal siap**: `src/app/interiorPortal.js` memiliki mesin state lengkap + port; M5 cukup mengganti `createStubInterior(...)` di `setupPortal` (main.js) dengan interior `sekre` dari `src/interiors/sekre/index.js` (bentuk `defineInterior` spec §4.8). `def.build(ctx)` menerima `{ ...ctx, scope, exit }` — `exit` untuk interaktif pintu (S30).
- **`App.setView` tetap milik M5 (D4)**: `src/app/appView.js` otomatis memakai `app.setView` begitu M5 menambahkannya; jalur cadangan (tukar pass composer) boleh dihapus M5.
- **Runner ditukar** (`appStage`, stub M4): seluruh sistem eksterior dijeda (termasuk jam & cuaca). M5 menggantinya dengan gerbang sistem (`App.setSystemGate` + whitelist `KEEP_INSIDE`, plan M5) agar jam/cuaca tetap jalan; `appStage` boleh dihapus. Sistem `portal.keys` (E/Esc keluar) & `portal.endFrame` ditambahkan portal.
- **Nama ormawa pemain**: `sekreRooms()[PLAYER_ROOM_INDEX]` di `src/regions/unri-lembaga/sekre.data.js` (nama, warna). `src/interiors/**` tidak boleh mengimpor `regions/` → teruskan lewat `createInteriorPortal({ ctx: { ormawa } })` di main.js (parameter `ctx` sudah tersedia).
- **Nama deret (sinkronkan `SELASAR_SEBERANG` plan M5)**: baris U dari barat = BEM UNIVERSITAS RIAU (0), **UKM SENI = sekre pemain** (1), UKM OLAHRAGA (2), UKM KEROHANIAN (3); baris S (seberang selasar) dari barat = **DPM, UKM PERS MAHASISWA, UKM PECINTA ALAM, UKM KEWIRAUSAHAAN** (4–7). Pusat ruang pemain 6,29 m dari mulut barat & 10,48 m dari mulut timur (cocok asumsi M5 6,3/10,5); `door.yaw` = arah hadap keluar (normal daun pintu ke selasar), konvensi entitas (sin, cos) — cocok `ROOM_YAW_OFFSET = π` M5.
- **exitTo**: `sekreExitTo()` = region-lokal `{region:'unri-lembaga', x:−2.7875, z:−1.8632, yaw:−0.33248}`; keluar → sepeda tetap di tempat bila ≤ 3 m dari pintu.
- **Interior dari luar**: jendela nako selasar memperlihatkan latar `ruangGelap`; M5 boleh mengganti latar ruang pemain dengan tekstur tangkapan interior.
- **Ukur**: `tests/e2e/lembaga.e2e.mjs` sudah memiliki siklus portal 3× + baseline memori; M5 menambah ukuran `interior-sekre` (≤ 150 draw call) ke skrip yang sama, M7 memindahkannya ke smoke E2E.
- **GLB**: bila Task 25 dilewati, `MOTOR_GLB_READY` masih `false` — M7 (A03/A04) memakai pipeline Blender yang sama (`assets-src/blender/unri/motor.py`).

---

## Catatan eksekusi

(Diisi implementer.)

| Asumsi | Hasil verifikasi Task 0 | Penyesuaian (file) |
|---|---|---|
| A1 | | |
| A2 | | |
| A3 | | |
| A4 | | |
| A5 | | |
| A6 | | |
| A7 | | |
| A8 | | |
| A9 | | |
| A10 | | |
