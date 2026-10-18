# M6 Zona Rektorat & Hero Building — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (satu implementer, satu review di akhir tonggak — memori `lightweight-process-hobby`). Langkah memakai sintaks checkbox (`- [ ]`) untuk pelacakan.

**Goal:** Membangun region handmade `unri-rektorat` (Gedung Rektorat Universitas Riau sesuai foto drone 2016, bundaran Putaran Jl. Mukhtar Luthfi, Danau Buatan dengan batu pijakan + papan batu lengkung "UNIVERSITAS RIAU", Perpustakaan lama 4 massa 2 lt, poros taman akasia ramping + palem + bangku) dan tiga hero building distrik (Masjid Arfa'unnas, Gerbang SM Amin, Grand Gasing Millenium/GGM) yang autentik terhadap foto rujukan riset, plus aset Blender N01–N04, dalam budget ≤ 250 draw call per region.

**Architecture:** Region baru mengikuti kontrak `defineRegion` + perluasan M0 (`activation`, `proxy`, `povs`, `pads`), placement berbasis footprint OSM Rektorat dengan **yaw 0** sehingga semua data OSM cukup ditranslasi (lokal = dunia − titik acuan). `build(ctx)` cepat; konten berat dirakit bertahap lewat `ctx.schedule` setelah chunk terrain region tersedia, lalu digabung per material (`mergeByMaterial`) agar draw call rendah. Hero building distrik memakai `HERO_BUILDERS` (PartList dunia) lewat override `buildings.data.js`; Rektorat & Perpustakaan menjadi "milik region" (kit distrik tidak menggambar apa pun, proxy region menutup saat jauh). Ornamen GLB distrik (N04 kubah) dimuat lapisan app terpisah yang menyembunyikan placeholder lewat `material.visible`; ornamen GLB region (N01–N03) memakai pola `placeModels` + `replaces` yang sudah ada.

**Tech Stack:** Three.js r186 (BufferGeometry, ExtrudeGeometry, LatheGeometry, InstancedMesh, CanvasTexture), Vitest (Node), Vite, Playwright (GPU d3d11), Blender MCP (`execute_blender_code`) + `assets-src/blender/export_glb.py`, Overpass API (opsional, satu kueri kecil).

---

## Prasyarat

1. Tonggak M0–M5 berstatus **selesai** di `docs/superpowers/plans/2026-10-17-unri-00-index.md` (bagian "Status tonggak"). Plan ini memakai, **persis dengan nama indeks**: `defineRegion` (+`activation/proxy/povs/pads`), `regionManager.register`, `ctx.terrain` / `ctx.heightAtLocal` / `ctx.schedule`, `src/world/terrain/drape.js` (`drapePolyline`, `drapePolygon`), air distrik (`src/districts/unri/water.js`), kit (`planBuilding`, `buildBuilding`, `createKitMaterials`, `HERO_BUILDERS`), `buildings.data.js` (`resolveBuilding`, `validateOverrides`), `src/engine/scheduler.js`.
2. Branch `feat/unri-kampus`, working tree bersih (`git status --short` kosong kecuali berkas yang memang belum dikomit oleh user).
3. Blender terbuka dengan add-on MCP aktif (cek `mcp__blender__get_addon_status`) — untuk Task 20. Bila Blender tidak tersedia, Task 20 dilewati: placeholder prosedural tetap tampil (spec §10), catat di status indeks.
4. Playwright global (`npm i -g playwright` atau `PLAYWRIGHT_PATH`) seperti E2E yang ada — untuk Task 21.
5. Cache OSM `data-src/osm/stadion.json` ada (gitignore; dipakai tes data, dilewati otomatis bila tidak ada).

## Fakta geometri beku (dihitung dari cache OSM 2026-10-16, proyeksi `WORLD_ORIGIN`)

Dunia ENU: +X timur, **+Z selatan**, meter. Lokal region = dunia − `(−985,8; 800,0)`, yaw 0.

| Fitur | OSM | Dunia (pusat/rentang) | Lokal region | Catatan |
|---|---|---|---|---|
| Gedung Rektorat | way 282225347, `levels=4-7`, `roof=concrete` | x −997,5…−959,8; z 767,7…832,2; centroid (−984,0; 800,1) | slab x ±11,7, z −32,3…32,2; tonjolan tengah x 12,1→17,1 (lebar 17,6); tonjolan depan x 17,4→26,0 (8,3 × 8,6) | **fasad depan menghadap timur (+X)**. Tonjolan 8,3 × 8,6 = kanopi merah (cocok katalog N03 8 × 8). Tonjolan tengah digeser 1,3 m agar simetris (< presisi tracing). |
| Jalan depan (drop-off) | way 817449378 service | x −959 | x 26,6–26,8 | lewat tepat di muka kanopi |
| Parkir depan | way 938379747 | x −952,5…−904,5 | x 33,3…81,3, z −32,6…39,9 | pulau tengah (loop way 1455480427) x 43,3…62,2, z −15,4…19,5 → taman + tiang bendera |
| Poros taman | way 1455479596 (loop service) | x −902…−775,5, z 795,8…812,4 | x 83,6…210,3, z −4,2…12,4; sumbu z 4,2 | sejajar sumbu Rektorat (z ≈ 800) |
| Danau Buatan | way 373856980 reservoir, 0,33 ha | x −837,8…−708,5, z 792,6…888,6 | 37 titik; memanjang TL→BD | air digambar distrik (M2) |
| Titian keluaran danau | way 783152923 footway `bridge=yes` | (−718,2; 772,4)–(−704,1; 776,1) | (267,6; −27,6)–(281,7; −23,9) | M2 tidak men-drape → dibangun region (danau.js) |
| Putaran Jl. Mukhtar Luthfi | way 327363975 tertiary oneway | x −733,7…−687, z 795,4…848,3 | x 252…299 | putaran-U di ujung timur danau; "taman tengah" = bulan sabit antara putaran & ujung danau |
| Perpustakaan UNRI | way 282225374 | x −1127…−1070,3, z 722,2…753,4 | 20 titik | 2 blok besar + penghubung → 4 kuadran 2 lt (riset: "empat gedung, dua lantai") |
| Masjid Ar-Faunas | way 282230716, `levels=2`, `roof=concrete` | pusat (−1009,83; 1374,65), yaw −0,0605 | (hero distrik) massa 37,6 × 30,5; tonjolan utara 6,6 × 9 m di x 0,1 = tangga | ruang salat 27 × 27 m (situs masjid) |
| GGM | way 314450943, `levels=4-7`, `roof=tin` | pusat (133,13; 407,41), r 40,85 | (hero distrik) | 16-gon, Ø 81,7 m |
| Gerbang SM Amin | **tidak ada node gate di cache** (cache tanpa node) | fallback: (210,45; 696,09), yaw −1,5581 | (hero distrik, bangunan sintetis) | Jl. Muchtar Lutfi (jalur ganda z 691,33 & 700,79 di x 210) × batas poligon kampus way 938374562 (x ≈ 216,45), 6 m ke dalam kampus; tegak lurus jalan, muka ke timur |

Mask region tidak beririsan dengan stadion (berakhir z +322) maupun `unri-lembaga` (x −360…+120) — dites. Satu-satunya gedung OSM asing di dekat mask (Area Parkir Perpustakaan way 282225395) sengaja dikeluarkan dengan takik mask.

## Struktur file

Buat:

| Path | Tanggung jawab |
|---|---|
| `src/regions/unri-rektorat/placement.js` | `REKTORAT_ID`, `REKTORAT_PLACEMENT` (yaw 0), `REKTORAT_ACTIVATION`, konversi lokal↔dunia (murni) |
| `src/regions/unri-rektorat/site.data.js` | ring/polyline OSM beku (lokal), `ROADS`, `REKTORAT_MASSA`, `PERPUS_MASSA` (murni) |
| `src/regions/unri-rektorat/mask.js` | `REKTORAT_MASK`, `rektoratMaskWorld()` (murni) |
| `src/regions/unri-rektorat/pads.js` | `REKTORAT_PADS` (murni; diimpor campusbake) |
| `src/regions/unri-rektorat/layout.js` | `LAYOUT` (akasia, palem, PJU, bangku, tiang bendera, kanopi, papan batu, batu pijakan, taman), `steppingStones()` (murni) |
| `src/regions/unri-rektorat/collider.js` | `createRektoratColliders()`, `rektoratColliders` (murni) |
| `src/regions/unri-rektorat/materials.js` | material region (cache scope, tanda malam/basah) |
| `src/regions/unri-rektorat/env.js` | `createSiteEnv`, `waitForTerrain`, `TERRAIN_KEYS`, `drapePolygonLocal`, `drapePolylineLocal`, `kerbWall` |
| `src/regions/unri-rektorat/staged.js` | `runStaged` (antrean bertahap, batal), `freezeSubtree` |
| `src/regions/unri-rektorat/rektorat.js` | gedung Rektorat + kanopi (N03) + huruf puncak (N02) + teras/tangga + papan nama + permukaan depan |
| `src/regions/unri-rektorat/perpustakaan.js` | perpustakaan lama (kit K01 × 4 + penghubung + papan) |
| `src/regions/unri-rektorat/porosTaman.js` | akasia/palem/bangku/PJU/tiang bendera + jalan setapak poros |
| `src/regions/unri-rektorat/danau.js` | batu pijakan, papan batu N01, trotoar beton tinggi |
| `src/regions/unri-rektorat/bundaran.js` | taman tengah putaran (drape + kerb) |
| `src/regions/unri-rektorat/proxy.js` | siluet ≤ 8 draw call |
| `src/regions/unri-rektorat/index.js` | `unriRektoratRegion` (defineRegion), build bertahap, POV, nightLights, model GLB |
| `src/world/props/unri/akasiaRamping.js` | V04 (part instancing) |
| `src/world/props/unri/palem.js` | V05 (part instancing) |
| `src/world/kit/hero/heroFrame.js` | bingkai hero (PartList dunia), cache material/geometri, `heroBaseY`, `groundGrid`, `groundDisc` |
| `src/world/kit/hero/reliefText.js` | huruf timbul berlapis (canvas alpha) |
| `src/world/kit/hero/ornaments.js` | registry placeholder ornamen GLB distrik |
| `src/world/kit/hero/masjidArfaunnas.js` | H05 + placeholder N04 + data bay motor (untuk M7) |
| `src/world/kit/hero/gerbangSmAmin.js` | H06 + pos satpam + spanduk kuning N08 |
| `src/world/kit/hero/ggm.js` | H07 mangkrak |
| `src/app/heroOrnaments.js` | lapisan GLB ornamen distrik (N04) |
| `assets-src/blender/unri/n01-papan-batu-unri.blend` … `n04-kubah-mozaik.blend` | sumber Blender |
| `public/models/unri/n01-papan-batu-unri.glb`, `n02-huruf-nama-rektorat.glb`, `n03-kanopi-merah-rektorat.glb`, `n04-kubah-mozaik.glb` | GLB final |
| `tests/unri/rektoratData.test.js`, `rektoratMask.test.js`, `rektoratCollider.test.js`, `rektoratLayout.test.js`, `stagedRunner.test.js`, `rektoratRegion.test.js`, `heroOrnaments.test.js`, `heroBuilders.test.js` | tes |
| `tests/e2e/unri-m6.shots.mjs` | ukur draw call + screenshot |
| `docs/screenshots/unri/m6-*.jpg` | screenshot titik ukur |

Ubah: `src/world/kit/hero/index.js`, `src/districts/unri/buildings.data.js`, `src/main.js`, `tools/campusbake/config.js` (sesuai indeks) + **deviasi kecil**: `tools/campusbake/buildings.js` (menyisipkan bangunan sintetis gerbang; tanpa node/way gerbang di OSM tidak ada jalur lain), `src/app/mountRegion.js` (bila M0 belum mendaftarkan `lateRoot` ke registry basah — Task 15 Step 4, bersyarat), `src/app/districtMount.js` (bila belum meneruskan `isReserved` ke distrik — Task 15 Step 2, bersyarat), `docs/superpowers/plans/2026-10-17-unri-00-index.md` (status M6 + catat deviasi).

---

## Task 0: Verifikasi kontrak M0–M5 (tanpa commit)

**Files:** (baca saja)

- [ ] **Step 1: Cek status tonggak**

Run: `grep -n "^| M[0-5] " docs/superpowers/plans/2026-10-17-unri-00-index.md`
Expected: enam baris M0–M5 berstatus `selesai`. Bila ada yang belum: BERHENTI, M6 tidak boleh dimulai.

- [ ] **Step 2: Cek ekspor yang dipakai plan ini**

Run:
```bash
grep -n "activation\|proxy\|povs\|pads" src/regions/Region.js
grep -n "heightAtLocal\|schedule\|lateRoot\|registerWet" src/app/mountRegion.js
grep -n "export function drapePolyline\|export function drapePolygon" src/world/terrain/drape.js
grep -n "export function planBuilding" src/world/kit/planBuilding.js
grep -n "export function buildBuilding" src/world/kit/buildBuilding.js
grep -n "export function createKitMaterials" src/world/kit/kitMaterials.js
grep -n "HERO_BUILDERS\|'hero:" src/world/kit/hero/index.js
grep -n "^export" src/districts/unri/buildings.data.js
grep -rn "'hero:ggm'" src tools tests
grep -n "proxy\|applyPlacement" src/app/regionManager.js
grep -n "register(\|createTerrainService\|mountDistrict" src/main.js
grep -n "unri-lembaga\|pads" tools/campusbake/config.js
grep -n "cluster" tools/campusbake/buildings.js
grep -n "export function \(createScheduler\)" src/engine/scheduler.js
```
Expected: semua pola ditemukan. Catat di kepala sesi:
- **Nama ekspor tabel override** di `buildings.data.js` (plan ini menyebutnya `BUILDING_OVERRIDES`; bila M3 memakai nama lain, ganti di Task 19 dengan nama M3 — hanya nama, isi sama).
- **Konvensi matriks PartList** di `buildBuilding.js`: plan ini mengasumsikan `part.matrix` = matriks DUNIA (spec §4.2 "koordinat distrik = dunia"). Bila M3 memakai koordinat relatif klaster dengan `ctx.origin {x,z}`, hero builder Task 16–18 sudah menerima `ctx.origin` (dikurangkan di `createHeroFrame`); bila nama field-nya lain, sesuaikan satu baris `origin: ctx.origin ?? null` di ketiga builder.
- **Proxy** di `regionManager.js`: plan M0 memanggil `def.proxy({ scope, placement, terrain })`, lalu `applyPlacement(proxy.group, placement)` (idempoten dengan `group.position.set` di Task 13), `scene.add`, `freezeStatic`, dan melepas scope proxy sendiri. Bila implementasi M0 ternyata menaruh proxy di bawah induk yang SUDAH ber-placement, hapus baris `group.position.set(P.x, 0, P.z)` di `proxy.js`.
- **POV**: plan M0 memanggil `pose(frame, { time, bike })` (tanpa terrain) → pose region ini memakai tinggi 0 + offset mata (9 m / 70 m), cukup karena pad Rektorat ±2 m dari datum.
- **`ctx.schedule`**: menerima fungsi generator (indeks M0). `drapePolygon(rings, field, opts)` menerima ring DUNIA dan `field.heightAt` dunia.

- [ ] **Step 3: Baseline hijau**

Run: `npm test` lalu `npm run lint`
Expected: semua tes lulus, lint 0 galat. Catat jumlah tes (dibandingkan di Task 22).

---

## Task 1: Placement & data situs beku (TDD)

**Files:**
- Create: `src/regions/unri-rektorat/placement.js`
- Create: `src/regions/unri-rektorat/site.data.js`
- Test: `tests/unri/rektoratData.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
// tests/unri/rektoratData.test.js
/**
 * Data situs beku region unri-rektorat dicocokkan ulang dengan cache OSM (data-src/osm/stadion.json,
 * gitignore → dilewati bila tidak ada). Bila OSM berubah, tes gagal dan data beku ditinjau (fakta > gaya).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createProjection } from '../../src/geo/projection.js';
import { WORLD_ORIGIN } from '../../src/config/constants.js';
import { REKTORAT_PLACEMENT, REKTORAT_ACTIVATION, localToWorld, worldToLocal } from '../../src/regions/unri-rektorat/placement.js';
import * as SITE from '../../src/regions/unri-rektorat/site.data.js';

const CACHE = 'data-src/osm/stadion.json';
const HAS_CACHE = existsSync(CACHE);
const ways = HAS_CACHE
  ? new Map(JSON.parse(readFileSync(CACHE, 'utf8')).elements.filter((e) => e.type === 'way').map((e) => [e.id, e]))
  : new Map();
const proj = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });

/** Way OSM → titik lokal region (ring tertutup: titik penutup dibuang). */
function localOf(id) {
  const w = ways.get(id);
  const pts = w.geometry.map((g) => {
    const p = proj.toWorld(g.lat, g.lon);
    return [p.x - REKTORAT_PLACEMENT.x, p.z - REKTORAT_PLACEMENT.z];
  });
  return w.nodes[0] === w.nodes[w.nodes.length - 1] ? pts.slice(0, -1) : pts;
}

const CASES = [
  ['REKTORAT_RING', 'rektorat'], ['PERPUS_RING', 'perpustakaan'], ['DANAU_RING', 'danau'],
  ['PUTARAN', 'putaran'], ['POROS', 'poros'], ['PARKIR', 'parkir'], ['PULAU_PARKIR', 'pulauParkir'],
  ['JALAN_DEPAN', 'jalanDepan'], ['JALAN_UTARA_REKTORAT', 'jalanUtaraRektorat'], ['LOOP_REKTORAT', 'loopRektorat'],
  ['MUCHTAR_UTARA', 'muchtarUtara'], ['MUCHTAR_SELATAN', 'muchtarSelatan'], ['TERTIARY_US', 'tertiaryUS'],
  ['TITIAN', 'titian'],
];

describe.skipIf(!HAS_CACHE)('data situs beku unri-rektorat = cache OSM (±0,11 m)', () => {
  it.each(CASES)('%s cocok dengan way OSM', (name, key) => {
    const osm = localOf(SITE.OSM_IDS[key]);
    const frozen = SITE[name];
    expect(frozen).toHaveLength(osm.length);
    frozen.forEach(([x, z], i) => {
      expect(Math.abs(x - osm[i][0])).toBeLessThan(0.11);
      expect(Math.abs(z - osm[i][1])).toBeLessThan(0.11);
    });
  });
});

describe('placement & massa turunan', () => {
  it('yaw 0: lokal = dunia − titik acuan (seluruh modul region mengandalkan ini)', () => {
    expect(REKTORAT_PLACEMENT).toEqual({ x: -985.8, z: 800.0, yaw: 0 });
    expect(localToWorld(10, -5)).toEqual([-975.8, 795]);
    const [lx, lz] = worldToLocal(-984.0, 800.1);
    expect(lx).toBeCloseTo(1.8, 6);
    expect(lz).toBeCloseTo(0.1, 6);
  });
  it('aktivasi berpusat di poros taman, radius spec §4.3', () => {
    expect(REKTORAT_ACTIVATION).toEqual({ center: { x: -905.8, z: 805.0 }, mountRadius: 700, unmountRadius: 900 });
  });
  it('blok tengah Rektorat simetris terhadap z = 0 dan kanopi di depan blok tengah', () => {
    const { slab, tengah, kanopi } = SITE.REKTORAT_MASSA;
    expect(tengah.z0).toBe(-tengah.z1);
    expect(kanopi.z0).toBe(-kanopi.z1);
    expect(tengah.x0).toBe(slab.x1);
    expect(kanopi.x0).toBeGreaterThan(tengah.x1);
    expect(kanopi.x1 - kanopi.x0).toBeCloseTo(8.6, 6);
  });
  it('kuadran perpustakaan berada di dalam bbox ring OSM', () => {
    const xs = SITE.PERPUS_RING.map((p) => p[0]);
    const zs = SITE.PERPUS_RING.map((p) => p[1]);
    for (const ring of SITE.PERPUS_MASSA.kuadran) {
      for (const [x, z] of ring) {
        expect(x).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-9);
        expect(x).toBeLessThanOrEqual(Math.max(...xs) + 1e-9);
        expect(z).toBeGreaterThanOrEqual(Math.min(...zs) - 1e-9);
        expect(z).toBeLessThanOrEqual(Math.max(...zs) + 1e-9);
      }
    }
    expect(SITE.PERPUS_MASSA.kuadran).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/rektoratData.test.js`
Expected: FAIL — `Failed to resolve import "../../src/regions/unri-rektorat/placement.js"`.

- [ ] **Step 3: Buat `placement.js`**

```js
// src/regions/unri-rektorat/placement.js
/**
 * Placement region "unri-rektorat" (murni; dipakai klien & campusbake). Titik acuan = pusat massa utama
 * Gedung Rektorat (OSM way 282225347; cache data-src/osm/stadion.json diproyeksikan dengan WORLD_ORIGIN):
 * x −985,8, z 800,0. yaw 0 karena gedung praktis sejajar sumbu (tepi utara & selatan OSM dz = 0); seluruh
 * modul region mengandalkan yaw 0 (lokal = dunia − titik acuan) sehingga geometri dunia (drape, kit)
 * cukup ditranslasi.
 */
export const REKTORAT_ID = 'unri-rektorat';

export const REKTORAT_PLACEMENT = Object.freeze({ x: -985.8, z: 800.0, yaw: 0 });

/** Lokal → dunia [x, z] (yaw 0: translasi). */
export const localToWorld = (lx, lz) => [lx + REKTORAT_PLACEMENT.x, lz + REKTORAT_PLACEMENT.z];

/** Dunia → lokal [lx, lz]. */
export const worldToLocal = (x, z) => [x - REKTORAT_PLACEMENT.x, z - REKTORAT_PLACEMENT.z];

/** Aktivasi (spec §4.3): pusat = poros taman (lokal 80, 5) agar Rektorat, danau, dan perpustakaan tercakup. */
export const REKTORAT_ACTIVATION = Object.freeze({
  center: Object.freeze({ x: -905.8, z: 805.0 }),
  mountRadius: 700,
  unmountRadius: 900,
});
```

- [ ] **Step 4: Buat `site.data.js`**

```js
// src/regions/unri-rektorat/site.data.js
/**
 * Geometri OSM beku zona Rektorat, koordinat REGION-LOKAL (lokal = dunia − REKTORAT_PLACEMENT, yaw 0).
 * Sumber: cache Overpass data-src/osm/stadion.json (OSM 2026-10-16), createProjection(WORLD_ORIGIN),
 * dibulatkan 0,1 m; ring tertutup disimpan TERBUKA (titik penutup dibuang). Dicocokkan ulang oleh
 * tests/unri/rektoratData.test.js. Data © OpenStreetMap contributors (ODbL).
 * Lebar jalan = ROAD_CLASSES citybake (tertiary 10 m, service 4,5 m), sama dengan ground distrik (M2).
 */
const ring = (pts) => Object.freeze(pts.map((p) => Object.freeze(p)));

export const OSM_IDS = Object.freeze({
  rektorat: 282225347,
  perpustakaan: 282225374,
  danau: 373856980,
  putaran: 327363975,
  poros: 1455479596,
  parkir: 938379747,
  pulauParkir: 1455480427,
  jalanDepan: 817449378,
  jalanUtaraRektorat: 282242542,
  loopRektorat: 817449379,
  muchtarUtara: 465415521,
  muchtarSelatan: 1177156794,
  tertiaryUS: 282242560,
  titian: 783152923,
});

/** Gedung Rektorat Universitas Riau (`building:levels=4-7`, `roof=concrete`). Muka depan = +X (timur). */
export const REKTORAT_RING = ring([
  [-11.7, -32.3], [11.7, -32.3], [12.1, -7.5], [17.1, -7.3], [17.4, -2.9], [26, -2.9],
  [26, 5.4], [17.2, 5.7], [17, 10.1], [12.1, 10.2], [11.7, 32.2], [-11.7, 32.2],
]);

/** Perpustakaan UNRI (lama), dua blok besar + penghubung + tonjolan masuk barat/timur. */
export const PERPUS_RING = ring([
  [-138.2, -54.2], [-141.2, -54.2], [-141.1, -67.4], [-137.9, -67.4], [-137.9, -74.9], [-116.7, -74.8],
  [-116.7, -67.7], [-111.5, -67.7], [-111.4, -77.8], [-88, -77.6], [-88, -68.1], [-84.5, -68.1],
  [-84.6, -54.8], [-88.2, -54.9], [-88.2, -49], [-111.7, -49.1], [-111.7, -54.5], [-117, -54.5],
  [-117, -46.6], [-138.2, -46.7],
]);

/** Danau Buatan Universitas Riau (water=reservoir, ±0,33 ha). */
export const DANAU_RING = ring([
  [258.1, -7.4], [265.8, -6.1], [269, -5.5], [276.4, -0.1], [277.3, 6.9], [275.4, 14.8], [266.8, 23.1],
  [249.8, 33.9], [220, 47.6], [201.5, 57.4], [192.8, 63.1], [186.1, 66.3], [182.6, 67.6], [181.3, 70.8],
  [172.7, 75.5], [159.2, 83.2], [148, 88.6], [150.3, 81.9], [150.3, 75.2], [149.3, 71.1], [158.6, 60.9],
  [165.6, 52.3], [173.6, 47.6], [180.4, 46.3], [182.9, 43.1], [188.3, 41.8], [192.2, 38], [198, 35.2],
  [207.9, 31.7], [214.6, 27.5], [220, 24.4], [227.1, 23.1], [234.1, 16.7], [242.4, 7.8], [243.4, 3.7],
  [248.2, -1.4], [253.3, -6.5],
]);

/** Putaran Jalan Mukhtar Luthfi / Depan Rektorat (tertiary, oneway). */
export const PUTARAN = ring([
  [252.1, 48.3], [256.4, 44.9], [285.9, 27.4], [292.9, 22.4], [296.1, 18.9], [298.1, 15.2], [298.8, 11.6],
  [298.7, 8.3], [296.7, 2.4], [292.7, -4.6],
]);

/** Loop service poros taman (U terbuka ke barat, menempel jalan tertiary utara–selatan). */
export const POROS = ring([[83.6, 12.3], [210.3, 12.4], [210.3, -4.2], [84.1, -3.9]]);

/** Parkir depan Rektorat (amenity=parking). */
export const PARKIR = ring([[33.3, -32.2], [34, 39.9], [81.3, 39.5], [80.7, -32.6]]);

/** Loop lorong parkir yang mengelilingi pulau tengah (sumbu Rektorat). */
export const PULAU_PARKIR = ring([[41, -17.9], [64.4, -17.6], [64.5, 21.7], [64.4, 21.7], [41.2, 22.2]]);

/** Jalan drop-off depan Rektorat (service). */
export const JALAN_DEPAN = ring([[26.8, -38.5], [26.6, 42.5]]);

/** Jalan service utara Rektorat. */
export const JALAN_UTARA_REKTORAT = ring([[84.6, -39.8], [40.9, -38.7], [26.8, -38.5], [-15, -39], [-22.9, -39], [-59.8, -37.3]]);

/** Jalan service barat & selatan Rektorat. */
export const LOOP_REKTORAT = ring([[-15, -39], [-12.6, 32.4], [-11.5, 36.3], [-9.9, 38.9], [-3.6, 43], [26.6, 42.5], [41.4, 42.6], [85, 42.7]]);

/** Jl. Muchtar Lutfi sisi utara danau (tertiary, oneway ke timur). */
export const MUCHTAR_UTARA = ring([[86.6, -82.5], [148, -59.2], [156, -53.3], [172.3, -46.4], [212.8, -29.4], [227, -24], [245.7, -17], [292.7, -4.6]]);

/** Jl. Muchtar Lutfi sisi selatan danau (tertiary). */
export const MUCHTAR_SELATAN = ring([[252.1, 48.3], [135.2, 117.9]]);

/** Tertiary utara–selatan di kepala poros (way 282242560). */
export const TERTIARY_US = ring([
  [135.2, 117.9], [107.7, 91.3], [97.5, 74], [91.4, 62.9], [86.6, 53.1], [85, 42.7], [83.9, 35.1],
  [83.6, 12.3], [83.6, 11.8], [84.1, -3.9], [84.1, -6.1], [84.6, -39.8], [86.6, -82.5],
]);

/** Titian (jembatan pejalan kaki, footway bridge=yes) di atas gorong-gorong keluaran danau — M2 sengaja tidak men-drape-nya; dibangun region (danau.js). */
export const TITIAN = ring([[281.7, -23.9], [267.6, -27.6]]);

/** Jalan di dalam/sekitar mask beserta lebar total (m) — dipakai tes jarak bebas layout. */
export const ROADS = Object.freeze([
  { id: 'poros', pts: POROS, w: 4.5 },
  { id: 'jalanDepan', pts: JALAN_DEPAN, w: 4.5 },
  { id: 'pulauParkir', pts: PULAU_PARKIR, w: 4.5 },
  { id: 'jalanUtaraRektorat', pts: JALAN_UTARA_REKTORAT, w: 4.5 },
  { id: 'loopRektorat', pts: LOOP_REKTORAT, w: 4.5 },
  { id: 'putaran', pts: PUTARAN, w: 10 },
  { id: 'muchtarUtara', pts: MUCHTAR_UTARA, w: 10 },
  { id: 'muchtarSelatan', pts: MUCHTAR_SELATAN, w: 10 },
  { id: 'tertiaryUS', pts: TERTIARY_US, w: 10 },
].map(Object.freeze));

/**
 * Massa Rektorat (turunan, bukan OSM mentah). slab = massa utama; tengah = blok tengah berkaca biru
 * (OSM x 12,1→17,1, z −7,5…10,2; disimetriskan ke ±8,8, geser 1,3 m < presisi tracing); kanopi =
 * tonjolan depan 8,6 × 8,3 (kanopi merah N03 di atas jalur drop-off).
 */
export const REKTORAT_MASSA = Object.freeze({
  slab: Object.freeze({ x0: -11.7, x1: 11.7, z0: -32.3, z1: 32.2 }),
  tengah: Object.freeze({ x0: 11.7, x1: 17.1, z0: -8.8, z1: 8.8 }),
  kanopi: Object.freeze({ x0: 17.4, x1: 26.0, z0: -4.15, z1: 4.15 }),
});

/**
 * Perpustakaan lama: "empat gedung, masing-masing dua lantai" [S] → blok barat & timur OSM dibelah di
 * tengah (z −60,8 & −63,4) jadi empat kuadran (urutan: barat-laut, barat-daya, timur-laut, timur-daya);
 * penghubung = link tengah + tonjolan masuk barat & timur (persegi panjang lokal).
 */
export const PERPUS_MASSA = Object.freeze({
  kuadran: Object.freeze([
    ring([[-137.9, -74.9], [-116.7, -74.8], [-116.7, -60.8], [-137.9, -60.8]]),
    ring([[-137.9, -60.8], [-117, -60.8], [-117, -46.6], [-138.2, -46.7]]),
    ring([[-111.4, -77.8], [-88, -77.6], [-88, -63.4], [-111.5, -63.4]]),
    ring([[-111.5, -63.4], [-88.2, -63.4], [-88.2, -49], [-111.7, -49.1]]),
  ]),
  penghubung: Object.freeze([
    Object.freeze({ x0: -116.7, x1: -111.5, z0: -67.7, z1: -54.5 }),
    Object.freeze({ x0: -141.2, x1: -137.9, z0: -67.4, z1: -54.2 }),
    Object.freeze({ x0: -88.0, x1: -84.5, z0: -68.1, z1: -54.8 }),
  ]),
});
```

- [ ] **Step 5: Jalankan, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/rektoratData.test.js`
Expected: PASS (18 tes bila cache ada: 14 kasus OSM + 4 lainnya; tanpa cache 4 tes, blok OSM "skipped").

- [ ] **Step 6: Commit**

```bash
git add src/regions/unri-rektorat/placement.js src/regions/unri-rektorat/site.data.js tests/unri/rektoratData.test.js
```
```bash
git commit -m "feat(unri-rektorat): placement yaw 0 dan data situs OSM beku zona Rektorat (dites terhadap cache)"
```

---

## Task 2: Mask & pads (TDD: tidak beririsan region lain)

**Files:**
- Create: `src/regions/unri-rektorat/mask.js`
- Create: `src/regions/unri-rektorat/pads.js`
- Test: `tests/unri/rektoratMask.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
// tests/unri/rektoratMask.test.js
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { pointInPolygon } from '../../src/geo/polygon.js';
import { toWorld } from '../../src/geo/regionTransform.js';
import { createProjection } from '../../src/geo/projection.js';
import { WORLD_ORIGIN } from '../../src/config/constants.js';
import { REKTORAT_MASK, rektoratMaskWorld } from '../../src/regions/unri-rektorat/mask.js';
import { REKTORAT_PADS, rektoratPadsWorld } from '../../src/regions/unri-rektorat/pads.js';
import { REKTORAT_RING, PERPUS_RING, DANAU_RING, PUTARAN, POROS, TITIAN } from '../../src/regions/unri-rektorat/site.data.js';
import { stadionMaskWorld } from '../../src/regions/stadion/mask.js';
import * as lembagaModule from '../../src/regions/unri-lembaga/index.js';

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
/** Dua segmen berpotongan (termasuk menyentuh). */
function segmentsCross(a, b, c, d) {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0) !== (d2 > 0) || d1 === 0 || d2 === 0) && ((d3 > 0) !== (d4 > 0) || d3 === 0 || d4 === 0)
    && Math.min(a[0], b[0]) <= Math.max(c[0], d[0]) && Math.min(c[0], d[0]) <= Math.max(a[0], b[0])
    && Math.min(a[1], b[1]) <= Math.max(c[1], d[1]) && Math.min(c[1], d[1]) <= Math.max(a[1], b[1]);
}
/** Ring beririsan: ada sisi berpotongan atau satu titik di dalam ring lain. */
function ringsOverlap(r1, r2) {
  for (let i = 0; i < r1.length; i += 1) {
    for (let j = 0; j < r2.length; j += 1) {
      if (segmentsCross(r1[i], r1[(i + 1) % r1.length], r2[j], r2[(j + 1) % r2.length])) return true;
    }
  }
  return r1.some(([x, z]) => pointInPolygon(x, z, r2)) || r2.some(([x, z]) => pointInPolygon(x, z, r1));
}
const lembaga = Object.values(lembagaModule).find((v) => v?.id === 'unri-lembaga');
const lembagaWorld = lembaga.mask.map(([x, z]) => { const w = toWorld(lembaga.placement, x, z); return [w.x, w.z]; });

describe('mask unri-rektorat', () => {
  it('memuat Rektorat, perpustakaan, danau, putaran, poros, titian', () => {
    for (const ring of [REKTORAT_RING, PERPUS_RING, DANAU_RING, PUTARAN, POROS, TITIAN]) {
      for (const [x, z] of ring) expect(pointInPolygon(x, z, REKTORAT_MASK)).toBe(true);
    }
  });
  it('tidak beririsan dengan mask stadion maupun unri-lembaga (dunia)', () => {
    const mine = rektoratMaskWorld();
    expect(ringsOverlap(mine, stadionMaskWorld())).toBe(false);
    expect(ringsOverlap(mine, lembagaWorld)).toBe(false);
  });
  it('pad: ring ≥ 3 titik hingga, y median; versi dunia untuk campusbake (bentuk lembagaPadsWorld M4)', () => {
    expect(REKTORAT_PADS.map((p) => p.id)).toEqual(['rektorat', 'perpustakaan', 'papan-batu']);
    expect(rektoratPadsWorld()[0]).toEqual({ id: 'unri-rektorat:rektorat', y: 'median', ring: [[-999.8, 764], [-955.8, 764], [-955.8, 836], [-999.8, 836]] });
    for (const pad of REKTORAT_PADS) {
      expect(pad.ring.length).toBeGreaterThanOrEqual(3);
      expect(pad.ring.flat().every(Number.isFinite)).toBe(true);
      expect(pad.y).toBe('median');
    }
  });
});

const CACHE = 'data-src/osm/stadion.json';
describe.skipIf(!existsSync(CACHE))('mask vs OSM (cache)', () => {
  const els = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')).elements : [];
  const proj = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });
  const worldOf = (id) => els.find((e) => e.id === id).geometry.map((g) => { const p = proj.toWorld(g.lat, g.lon); return [p.x, p.z]; });
  it('seluruh titik mask di dalam poligon kampus way 938374562', () => {
    const campus = worldOf(938374562);
    for (const [x, z] of rektoratMaskWorld()) expect(pointInPolygon(x, z, campus)).toBe(true);
  });
  it('Area Parkir Perpustakaan (way 282225395, gedung OSM asing) di luar mask', () => {
    for (const [x, z] of worldOf(282225395)) expect(pointInPolygon(x, z, rektoratMaskWorld())).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/rektoratMask.test.js`
Expected: FAIL — `Failed to resolve import "../../src/regions/unri-rektorat/mask.js"`.

- [ ] **Step 3: Buat `mask.js`**

```js
// src/regions/unri-rektorat/mask.js
/**
 * Mask region unri-rektorat (region-lokal; satu sumber untuk collider komposit & citybake/campusbake).
 * Poligon 16 titik: Perpustakaan (blok barat-laut, takik di x −94…−24 untuk mengeluarkan "Area Parkir
 * Perpustakaan" way 282225395), Rektorat + parkir depan, poros taman, Danau Buatan + titian keluaran danau
 * (way 783152923), Putaran Jl. Mukhtar Luthfi (+11 m di timur), dan trotoar selatan danau. Tidak beririsan stadion/unri-lembaga (dites).
 */
import { localToWorld } from './placement.js';

export const REKTORAT_MASK = Object.freeze([
  [-149.2, -85], [-94.2, -85], [-80.2, -71.5], [-24.2, -85], [85.8, -88], [225.8, -35], [262, -33], [287, -29],
  [309.8, 0], [309.8, 30], [260.8, 62], [140.8, 105], [85.8, 58], [-44.2, 51], [-44.2, -32], [-149.2, -32],
].map((p) => Object.freeze(p)));

/** Mask dalam koordinat DUNIA [[x, z], ...]. */
export function rektoratMaskWorld(mask = REKTORAT_MASK) {
  return mask.map(([x, z]) => localToWorld(x, z));
}
```

- [ ] **Step 4: Buat `pads.js`**

```js
// src/regions/unri-rektorat/pads.js
/**
 * Pad region (region-lokal) untuk campusbake (spec §4.3, §5.2 butir 7): terrain di dalam ring diratakan
 * ke median, blend 4 m. Murni (tanpa three) agar tools/campusbake dapat mengimpor. Field `id` diabaikan
 * normalisasi Region M0 (hanya ring & y), dipakai laporan bake. rektoratPadsWorld() = bentuk
 * lembagaPadsWorld() M4 untuk REGION_PADS di tools/campusbake/config.js.
 */
import { localToWorld } from './placement.js';

const rect = (x0, z0, x1, z1) => Object.freeze([[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map((p) => Object.freeze(p)));

export const REKTORAT_PADS = Object.freeze([
  Object.freeze({ id: 'rektorat', ring: rect(-14, -36, 30, 36), y: 'median' }),        // Rektorat + kanopi + taman depan s.d. as drop-off
  Object.freeze({ id: 'perpustakaan', ring: rect(-143.2, -79.8, -82.5, -44.6), y: 'median' }),
  Object.freeze({ id: 'papan-batu', ring: rect(282.5, 5.5, 288.5, 14.5), y: 'median' }), // papan batu N01
]);

/** Pad dalam koordinat DUNIA: [{ id:'unri-rektorat:<id>', y, ring:[[x,z]…] }]. */
export function rektoratPadsWorld(pads = REKTORAT_PADS) {
  return pads.map((p) => ({ id: `unri-rektorat:${p.id}`, y: p.y, ring: p.ring.map(([x, z]) => localToWorld(x, z)) }));
}
```

- [ ] **Step 5: Jalankan, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/rektoratMask.test.js`
Expected: PASS (3 tes + 2 tes cache bila ada).

- [ ] **Step 6: Commit**

```bash
git add src/regions/unri-rektorat/mask.js src/regions/unri-rektorat/pads.js tests/unri/rektoratMask.test.js
```
```bash
git commit -m "feat(unri-rektorat): mask region (tidak beririsan stadion/lembaga, di dalam kampus) dan pad terrain"
```

---

## Task 3: Layout region (TDD: batu pijakan di air, jarak bebas jalan/air)

**Files:**
- Create: `src/regions/unri-rektorat/layout.js`
- Test: `tests/unri/rektoratLayout.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
// tests/unri/rektoratLayout.test.js
import { describe, it, expect } from 'vitest';
import { pointInPolygon, distanceToRing } from '../../src/geo/polygon.js';
import { LAYOUT, steppingStones } from '../../src/regions/unri-rektorat/layout.js';
import { DANAU_RING, ROADS, REKTORAT_MASSA, PERPUS_RING, PUTARAN } from '../../src/regions/unri-rektorat/site.data.js';
import { REKTORAT_MASK } from '../../src/regions/unri-rektorat/mask.js';

const inRect = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const PROPS = () => [
  ...LAYOUT.akasia.map((p) => ['akasia', p]), ...LAYOUT.palem.map((p) => ['palem', p]),
  ...LAYOUT.pju.map((p) => ['pju', p]), ...LAYOUT.bangku.map((p) => ['bangku', p]),
  ['tiangBendera', LAYOUT.tiangBendera],
];

describe('layout unri-rektorat', () => {
  it('steppingStones: hanya titik di dalam air ≥ tepiMin, berjarak tetap', () => {
    const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const s = steppingStones(square, [-5, 5], [15, 5], 1, 0.5);
    expect(s.map((p) => p.x)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(s.every((p) => p.z === 5)).toBe(true);
  });
  it('batu pijakan danau: 15–19 batu, semuanya di air ≥ 0,6 m dari tepi, jarak ±1,1 m', () => {
    const st = LAYOUT.batuPijakan;
    expect(st.length).toBeGreaterThanOrEqual(15);
    expect(st.length).toBeLessThanOrEqual(19);
    for (const p of st) {
      expect(pointInPolygon(p.x, p.z, DANAU_RING)).toBe(true);
      expect(distanceToRing(p.x, p.z, DANAU_RING)).toBeGreaterThanOrEqual(0.6);
    }
    for (let i = 1; i < st.length; i += 1) {
      expect(Math.hypot(st[i].x - st[i - 1].x, st[i].z - st[i - 1].z)).toBeCloseTo(1.1, 1);
    }
  });
  it('vegetasi, PJU, bangku, tiang bendera: di dalam mask, di luar air (≥ 1 m), bebas jalan (½ lebar + 0,8 m), di luar gedung', () => {
    for (const [kind, p] of PROPS()) {
      const where = `${kind} (${p.x}, ${p.z})`;
      expect(pointInPolygon(p.x, p.z, REKTORAT_MASK), where).toBe(true);
      expect(pointInPolygon(p.x, p.z, DANAU_RING), where).toBe(false);
      expect(distanceToRing(p.x, p.z, DANAU_RING), where).toBeGreaterThanOrEqual(1);
      for (const road of ROADS) {
        expect(distanceToRing(p.x, p.z, road.pts, false), `${where} vs ${road.id}`).toBeGreaterThanOrEqual(road.w / 2 + 0.8);
      }
      expect(inRect(p.x, p.z, REKTORAT_MASSA.slab), where).toBe(false);
      expect(pointInPolygon(p.x, p.z, PERPUS_RING), where).toBe(false);
    }
  });
  it('jumlah sesuai rancangan: 48 akasia, 19 palem, 16 PJU, 7 bangku', () => {
    expect(LAYOUT.akasia).toHaveLength(48);
    expect(LAYOUT.palem).toHaveLength(19);
    expect(LAYOUT.pju).toHaveLength(16);
    expect(LAYOUT.bangku).toHaveLength(7);
  });
  it('taman bundaran: ≥ 5,8 m dari as putaran & ≥ 1,4 m dari tepi danau (sisi + titik sampel)', () => {
    const g = LAYOUT.tamanBundaran;
    for (let i = 0; i < g.length; i += 1) {
      const a = g[i];
      const b = g[(i + 1) % g.length];
      for (let t = 0; t <= 1.0001; t += 0.1) {
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        expect(distanceToRing(x, z, PUTARAN, false)).toBeGreaterThanOrEqual(5.8);
        expect(pointInPolygon(x, z, DANAU_RING)).toBe(false);
        expect(distanceToRing(x, z, DANAU_RING)).toBeGreaterThanOrEqual(1.4);
      }
    }
  });
  it('papan batu N01 di dalam taman bundaran dan menghadap timur (yaw −π/2)', () => {
    const p = LAYOUT.papanBatu;
    expect(pointInPolygon(p.x, p.z - p.w / 2, LAYOUT.tamanBundaran)).toBe(true);
    expect(pointInPolygon(p.x, p.z + p.w / 2, LAYOUT.tamanBundaran)).toBe(true);
    expect(p.yaw).toBeCloseTo(-Math.PI / 2, 9);
  });
  it('deterministik: dua impor memberi akasia identik (seed tetap)', () => {
    expect(LAYOUT.akasia[0]).toEqual(LAYOUT.akasia[0]);
    expect(Object.isFrozen(LAYOUT.akasia[0])).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/rektoratLayout.test.js`
Expected: FAIL — `Failed to resolve import "../../src/regions/unri-rektorat/layout.js"`.

- [ ] **Step 3: Buat `layout.js`**

```js
// src/regions/unri-rektorat/layout.js
/**
 * Tata letak region unri-rektorat (data murni, region-lokal; +X timur, +Z selatan). Posisi dipilih
 * terhadap geometri OSM beku (site.data.js) dengan jarak bebas jalan/air yang dites
 * (tests/unri/rektoratLayout.test.js). [INFERENSI] dari foto drone 2016 (Commons Taman_Unri.jpg): poros
 * diapit barisan pohon tinggi ramping + palem, rumput luas, jalan setapak beton; batu pijakan beton di
 * danau (arah lintasan = inferensi); posisi PJU, bangku, papan nama = inferensi.
 */
import { pointInPolygon, distanceToRing } from '../../geo/polygon.js';
import { createRng } from '../../world/util/random.js';
import { DANAU_RING } from './site.data.js';

const r2 = (v) => Math.round(v * 100) / 100;
const freezeAll = (list) => Object.freeze(list.map((p) => Object.freeze(p)));
const freezeRing = (pts) => Object.freeze(pts.map((p) => Object.freeze(p)));
const rect = (x0, z0, x1, z1) => freezeRing([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);

/**
 * Batu pijakan di sepanjang segmen from→to tiap `spacing` m; hanya yang di dalam `ring` (air) dan
 * ≥ `minEdge` dari tepi. Murni.
 * @returns {ReadonlyArray<{x:number, z:number}>}
 */
export function steppingStones(ring, from, to, spacing = 1.1, minEdge = 0.6) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const out = [];
  for (let s = 0; s <= len + 1e-9; s += spacing) {
    const x = from[0] + (dx * s) / len;
    const z = from[1] + (dz * s) / len;
    if (pointInPolygon(x, z, ring) && distanceToRing(x, z, ring) >= minEdge) out.push({ x: r2(x), z: r2(z) });
  }
  return freezeAll(out);
}

/** Satu baris pohon dengan sedikit jitter, rotasi, dan skala (deterministik dari rnd). */
function treeRow(rnd, x0, x1, step, z) {
  const out = [];
  for (let x = x0; x <= x1 + 1e-9; x += step) {
    out.push({
      x: r2(x + (rnd() - 0.5) * 0.6),
      z: r2(z + (rnd() - 0.5) * 0.4),
      rotY: r2(rnd() * Math.PI * 2),
      scale: r2(0.88 + rnd() * 0.24),
    });
  }
  return out;
}

const rnd = createRng(1962);

/** V04 akasia ramping: 2 baris di tepi median poros + 2 baris di luar jalan loop (12 per baris). */
const AKASIA = freezeAll([
  ...treeRow(rnd, 92, 202, 10, 0.4),
  ...treeRow(rnd, 92, 202, 10, 8.0),
  ...treeRow(rnd, 92, 202, 10, -9.5),
  ...treeRow(rnd, 92, 202, 10, 17.8),
]);

/** V05 palem: taman depan Rektorat, pulau parkir, poros (berselang-seling), bundaran (mengapit N01). */
const PALEM = freezeAll([
  ...[-30, -22, -14, 14, 22, 30].map((z, i) => ({ x: 18.5, z, rotY: r2(i * 1.3), scale: 1 })),
  { x: 45.5, z: -13, rotY: 0.4, scale: 0.95 },
  { x: 60, z: -13, rotY: 1.7, scale: 1.05 },
  { x: 45.5, z: 17, rotY: 2.9, scale: 1.05 },
  { x: 60, z: 17, rotY: 4.1, scale: 0.95 },
  ...[97, 117, 137, 157, 177, 197].map((x, i) => ({ x, z: i % 2 ? 6.5 : 1.9, rotY: r2(i * 2.1), scale: r2(0.9 + (i % 3) * 0.08) })),
  { x: 287.5, z: 4.5, rotY: 0.8, scale: 1 },
  { x: 286.5, z: 16.0, rotY: 2.2, scale: 1 },
  { x: 272.0, z: 27.5, rotY: 3.6, scale: 0.9 },
]);

/** PJU (lengan menghadap jalan terdekat; rotY konvensi Object3D). Juga sumber nightLights region. */
const PJU = freezeAll([
  ...[-30, -10, 10, 30].map((z) => ({ x: 31.0, z, rotY: Math.PI })),
  ...[97, 127, 157, 187].map((x) => ({ x, z: -0.6, rotY: Math.PI / 2 })),
  ...[112, 142, 172].map((x) => ({ x, z: 8.8, rotY: -Math.PI / 2 })),
  { x: 283.5, z: 2.5, rotY: 0 },
  { x: 279.5, z: 22.0, rotY: 0 },
  ...[[239.3, 47.4], [209.3, 65.2], [179.3, 83.1]].map(([x, z]) => ({ x, z, rotY: -1.033 })),
]);

/** P04 bangku beton taman: tepi jalan setapak poros + tepi trotoar danau. */
const BANGKU = freezeAll([
  ...[107, 147, 187].map((x) => ({ x, z: 2.45, rotY: 0 })),
  ...[127, 167].map((x) => ({ x, z: 5.95, rotY: 0 })),
  { x: 224.2, z: 56.0, rotY: -2.604 },
  { x: 194.2, z: 73.9, rotY: -2.604 },
]);

export const LAYOUT = Object.freeze({
  akasia: AKASIA,
  palem: PALEM,
  pju: PJU,
  bangku: BANGKU,
  /** P06 tiang bendera Merah Putih di tengah pulau taman parkir, pada sumbu Rektorat. */
  tiangBendera: Object.freeze({ x: 52.8, z: 0, tinggi: 12 }),
  /** Tiang kanopi merah N03 (4 sudut tonjolan depan OSM). */
  kanopiTiang: freezeAll([{ x: 17.9, z: -3.7 }, { x: 17.9, z: 3.7 }, { x: 25.6, z: -3.7 }, { x: 25.6, z: 3.7 }]),
  /** Teras lobi 0,9 m + 4 anak tangga (tidak dapat dilalui sepeda). */
  teras: Object.freeze({ x0: 17.1, x1: 22.4, z0: -6.5, z1: 6.5 }),
  /** Papan nama gedung granit hitam di taman depan (N05 gaya; INFERENSI posisi). */
  papanNama: Object.freeze({ x: 21.0, z: -12.0, w: 4.0, h: 0.8 }),
  /** N01 papan batu lengkung "UNIVERSITAS RIAU" di taman bundaran, menghadap timur (lalu lintas datang). */
  papanBatu: Object.freeze({ x: 285.5, z: 10.0, yaw: -Math.PI / 2, w: 6, d: 1.2, h: 1.6 }),
  /** P11 batu pijakan beton menyeberangi danau dari ujung poros ke trotoar selatan. */
  batuPijakan: steppingStones(DANAU_RING, [226, 16], [240, 44.5], 1.1, 0.6),
  /** Taman tengah putaran (bulan sabit antara putaran & ujung timur danau). */
  tamanBundaran: freezeRing([
    [281.0, 0.0], [285.0, 0.5], [289.5, 4.5], [291.0, 10.5], [290.0, 15.5], [286.5, 19.5], [279.0, 24.5],
    [268.0, 31.0], [261.5, 34.5], [259.0, 34.0], [264.5, 29.0], [272.0, 22.5], [278.0, 16.0], [280.0, 7.0],
  ]),
  /** Trotoar beton tinggi sisi danau (foto 2016), as 6 m dari as Jl. Muchtar Lutfi selatan. */
  trotoarDanau: freezeRing([[249.0, 43.1], [160.0, 96.1]]),
  /** Jalan setapak beton di tengah median poros. */
  jalurPoros: freezeRing([[89.5, 4.2], [206, 4.2]]),
  plazaDepan: rect(13.7, -10, 24.2, 10),
  jalurFasad: rect(11.8, -32.2, 13.7, 32.2),
  rumputDepan: Object.freeze([rect(13.7, -32.2, 24.2, -10), rect(13.7, 10, 24.2, 32.2)]),
  pulauParkir: rect(43.3, -15.4, 62.2, 19.5),
});
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/rektoratLayout.test.js`
Expected: PASS (7 tes). Bila tes jarak bebas gagal untuk satu titik, pesan menyebut jenis + koordinat + jalan; geser titik itu ≤ 1 m menjauhi jalan (jangan melonggarkan tes).

- [ ] **Step 5: Commit**

```bash
git add src/regions/unri-rektorat/layout.js tests/unri/rektoratLayout.test.js
```
```bash
git commit -m "feat(unri-rektorat): layout poros taman, PJU, bangku, batu pijakan, taman bundaran (dites jarak bebas)"
```

---

## Task 4: Collider region (TDD)

**Files:**
- Create: `src/regions/unri-rektorat/collider.js`
- Test: `tests/unri/rektoratCollider.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
// tests/unri/rektoratCollider.test.js
import { describe, it, expect } from 'vitest';
import { rektoratColliders, createRektoratColliders } from '../../src/regions/unri-rektorat/collider.js';

const { isWalkable, isCameraClear } = rektoratColliders;

describe('collider unri-rektorat (region-lokal)', () => {
  it.each([
    ['jalan setapak poros', 150, 4.2],
    ['parkir depan', 60, -25],
    ['jalan drop-off', 26.7, 20],
    ['drop-off di bawah kanopi', 24.5, 0],
    ['trotoar selatan danau', 200, 75],
    ['taman bundaran', 288.5, 19],
    ['jalan antara Rektorat & perpustakaan', -60, -38],
  ])('%s dapat dilalui', (_n, x, z) => expect(isWalkable(x, z)).toBe(true));

  it.each([
    ['massa utama Rektorat', 0, 0],
    ['blok tengah', 14, 0],
    ['teras lobi bertangga', 20, 0],
    ['perpustakaan', -100, -60],
    ['Danau Buatan', 230, 30],
    ['tiang kanopi', 25.6, 3.7],
    ['tiang bendera', 52.8, 0],
    ['papan batu N01', 285.5, 10],
    ['NaN', Number.NaN, 0],
  ])('%s tidak dapat dilalui', (_n, x, z) => expect(isWalkable(x, z)).toBe(false));

  it('kamera: tidak menembus gedung, boleh di atas air/teras', () => {
    expect(isCameraClear(0, 0)).toBe(false);
    expect(isCameraClear(-100, -60)).toBe(false);
    expect(isCameraClear(230, 30)).toBe(true);
    expect(isCameraClear(150, 4)).toBe(true);
    expect(isCameraClear(20, 0)).toBe(true);
    expect(isCameraClear(Number.NaN, 0)).toBe(false);
  });

  it('pabrik deterministik: dua instans sepakat', () => {
    const a = createRektoratColliders();
    expect(a.isWalkable(150, 4.2)).toBe(rektoratColliders.isWalkable(150, 4.2));
    expect(a.posts).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/rektoratCollider.test.js`
Expected: FAIL — modul `collider.js` tidak ditemukan.

- [ ] **Step 3: Buat `collider.js`**

```js
// src/regions/unri-rektorat/collider.js
/**
 * Collider region unri-rektorat (region-lokal, murni). Komposit (spec §4.2) memberi region wewenang
 * penuh di dalam mask, jadi semua penghalang di dalam mask ada di sini: massa Rektorat (slab + blok tengah),
 * teras lobi bertangga, perpustakaan (ring OSM), Danau Buatan (air), tiang kanopi, tiang bendera, papan
 * batu N01. Pohon/PJU/bangku tidak menghalangi (sama dengan region stadion).
 */
import { pointInPolygon, distanceToRing } from '../../geo/polygon.js';
import { REKTORAT_MASSA, PERPUS_RING, DANAU_RING } from './site.data.js';
import { LAYOUT } from './layout.js';

export const BIKE_CLEARANCE = 0.6;
const CAMERA_CLEARANCE = 0.8;
const POST_R = 0.25;
const FLAG_R = 0.4;

const inRect = (x, z, r, pad) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;
const solidRing = (x, z, ring, pad) => pointInPolygon(x, z, ring) || distanceToRing(x, z, ring) < pad;

/**
 * @param {{layout?: typeof LAYOUT}} [opts]
 * @returns {{blocks: ReadonlyArray<object>, posts: ReadonlyArray<{x:number,z:number,r:number}>,
 *   isWalkable(lx:number, lz:number):boolean, isCameraClear(lx:number, lz:number):boolean}}
 */
export function createRektoratColliders({ layout = LAYOUT } = {}) {
  const blocks = Object.freeze([REKTORAT_MASSA.slab, REKTORAT_MASSA.tengah]);
  const pb = layout.papanBatu;
  // papan menghadap timur (yaw −π/2): panjang 6 m sejajar sumbu Z lokal
  const papan = Object.freeze({ x0: pb.x - pb.d / 2, x1: pb.x + pb.d / 2, z0: pb.z - pb.w / 2, z1: pb.z + pb.w / 2 });
  const posts = Object.freeze([
    ...layout.kanopiTiang.map((p) => Object.freeze({ x: p.x, z: p.z, r: POST_R })),
    Object.freeze({ x: layout.tiangBendera.x, z: layout.tiangBendera.z, r: FLAG_R }),
  ]);
  const hitsPost = (x, z, pad) => posts.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad);

  function isWalkable(lx, lz) {
    if (!Number.isFinite(lx) || !Number.isFinite(lz)) return false;
    if (blocks.some((b) => inRect(lx, lz, b, BIKE_CLEARANCE))) return false;
    if (inRect(lx, lz, layout.teras, BIKE_CLEARANCE)) return false;
    if (inRect(lx, lz, papan, BIKE_CLEARANCE)) return false;
    if (solidRing(lx, lz, PERPUS_RING, BIKE_CLEARANCE)) return false;
    if (solidRing(lx, lz, DANAU_RING, BIKE_CLEARANCE)) return false;
    return !hitsPost(lx, lz, BIKE_CLEARANCE);
  }

  function isCameraClear(lx, lz) {
    if (!Number.isFinite(lx) || !Number.isFinite(lz)) return false;
    if (blocks.some((b) => inRect(lx, lz, b, CAMERA_CLEARANCE))) return false;
    return !solidRing(lx, lz, PERPUS_RING, CAMERA_CLEARANCE);
  }

  return Object.freeze({ blocks, posts, isWalkable, isCameraClear });
}

export const rektoratColliders = createRektoratColliders();
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/rektoratCollider.test.js`
Expected: PASS (18 tes).

- [ ] **Step 5: Commit**

```bash
git add src/regions/unri-rektorat/collider.js tests/unri/rektoratCollider.test.js
```
```bash
git commit -m "feat(unri-rektorat): collider region (gedung, teras, danau, tiang kanopi/bendera, papan batu)"
```

---
## Task 5: Utilitas hero kit — bingkai, huruf timbul, registry ornamen (TDD registry)

Dibuat lebih dulu karena region Rektorat (huruf puncak N02, papan batu N01) memakai `reliefText` yang sama dengan hero distrik.

**Files:**
- Create: `src/world/kit/hero/heroFrame.js`
- Create: `src/world/kit/hero/reliefText.js`
- Create: `src/world/kit/hero/ornaments.js`
- Test: `tests/unri/heroOrnaments.test.js`

- [ ] **Step 1: Tulis tes registry yang gagal**

```js
// tests/unri/heroOrnaments.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { MeshBasicMaterial } from 'three';
import {
  markPlaceholder, setOrnamentLoaded, isOrnamentLoaded, placeholderCount, resetOrnaments,
} from '../../src/world/kit/hero/ornaments.js';

beforeEach(() => resetOrnaments());

describe('registry placeholder ornamen hero distrik', () => {
  it('placeholder tampil sampai GLB dimuat, disembunyikan saat dimuat, tampil lagi saat dilepas', () => {
    const m = new MeshBasicMaterial();
    markPlaceholder('N04', m);
    expect(m.visible).toBe(true);
    setOrnamentLoaded('N04', true);
    expect(m.visible).toBe(false);
    expect(isOrnamentLoaded('N04')).toBe(true);
    setOrnamentLoaded('N04', false);
    expect(m.visible).toBe(true);
  });
  it('material yang ditandai SETELAH GLB dimuat langsung tersembunyi (klaster dibangun ulang)', () => {
    setOrnamentLoaded('N04', true);
    expect(markPlaceholder('N04', new MeshBasicMaterial()).visible).toBe(false);
  });
  it('idempoten; dispose material melepas registrasinya', () => {
    const m = new MeshBasicMaterial();
    markPlaceholder('N04', m);
    markPlaceholder('N04', m);
    expect(placeholderCount('N04')).toBe(1);
    m.dispose();
    expect(placeholderCount('N04')).toBe(0);
  });
  it('menolak bukan-material', () => {
    expect(() => markPlaceholder('N04', {})).toThrow(/material/);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/heroOrnaments.test.js`
Expected: FAIL — modul `ornaments.js` tidak ditemukan.

- [ ] **Step 3: Buat `ornaments.js`**

```js
// src/world/kit/hero/ornaments.js
/**
 * Registry placeholder ornamen GLB hero DISTRIK (M6). Hero distrik digabung per material per klaster
 * (spec §4.6/§7.4), jadi pola `replaces` (menyembunyikan objek bernama) tidak berlaku. Hero builder
 * menandai material placeholder per assetId (mis. 'N04'); lapisan app (src/app/heroOrnaments.js) memuat
 * GLB final lalu menyembunyikan placeholder lewat material.visible — tetap berlaku walau klaster
 * dibangun ulang (material baru yang ditandai mengikuti status terkini). Tanpa three: hanya objek material.
 */
const placeholders = new Map(); // assetId -> Set<Material>
const loaded = new Set();

/** Tandai `material` sebagai placeholder `assetId`; dikembalikan apa adanya (dipakai inline). */
export function markPlaceholder(assetId, material) {
  if (!material?.isMaterial) throw new TypeError('markPlaceholder: material wajib');
  let set = placeholders.get(assetId);
  if (!set) {
    set = new Set();
    placeholders.set(assetId, set);
  }
  if (set.has(material)) return material;
  set.add(material);
  material.userData.placeholderFor = assetId;
  material.visible = !loaded.has(assetId);
  material.addEventListener('dispose', () => set.delete(material));
  return material;
}

/** GLB `assetId` dimuat (true) / dilepas (false): placeholder disembunyikan / ditampilkan. */
export function setOrnamentLoaded(assetId, isLoaded) {
  if (isLoaded) loaded.add(assetId);
  else loaded.delete(assetId);
  for (const m of placeholders.get(assetId) ?? []) m.visible = !isLoaded;
}

export const isOrnamentLoaded = (assetId) => loaded.has(assetId);
export const placeholderCount = (assetId) => placeholders.get(assetId)?.size ?? 0;

/** Kosongkan registry (tes); placeholder yang tersisa ditampilkan lagi. */
export function resetOrnaments() {
  for (const set of placeholders.values()) for (const m of set) m.visible = true;
  placeholders.clear();
  loaded.clear();
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/heroOrnaments.test.js`
Expected: PASS (4 tes).

- [ ] **Step 5: Buat `heroFrame.js`**

```js
// src/world/kit/hero/heroFrame.js
/**
 * Utilitas hero building (M6): bingkai lokal→dunia yang menghasilkan PartList ({geometry, material,
 * matrix, castShadow, name}; matriks DUNIA, kontrak spec §4.6), cache material/geometri di ResourceScope
 * aktif (kunci 'hero:…': pembangunan ulang klaster memakai ulang sumber daya, scope pemilik yang melepas),
 * dan permukaan tanah yang mengikuti ctx.groundY bila tersedia (cadangan: datar di tanah pad).
 */
import * as THREE from 'three';
import { currentScope } from '../../../engine/ResourceScope.js';

const UP = new THREE.Vector3(0, 1, 0);
const MAP_KEYS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'alphaMap'];
/** Plint kit (spec §7.2 butir 2): baseY = median tanah + 0,15 m. */
export const PLINTH = 0.15;

/** Lepas material beserta teksturnya (default ResourceScope hanya melepas material). */
export function disposeMaterialDeep(mat) {
  for (const key of MAP_KEYS) mat[key]?.dispose?.();
  mat.dispose();
}

/** Material hero ber-cache per kunci (scope aktif; ruang kunci terpisah dari geometri). */
export const heroMaterial = (key, make) => currentScope().get(`hero:mat:${key}`, make, { dispose: disposeMaterialDeep });

/** Geometri hero ber-cache per kunci (scope aktif). */
export const heroGeometry = (key, make) => currentScope().get(`hero:geo:${key}`, make);

/** Beri nama material (dibaca registry malam/basah & alat debug). */
export function named(mat, name) {
  mat.name = name;
  return mat;
}

/** Matrix4 lokal: translasi, rotasi Euler 'YXZ' (Z lebih dulu, lalu X, lalu Y), skala. */
export function local(x = 0, y = 0, z = 0, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    new THREE.Vector3(sx, sy, sz),
  );
}

/** Kotak satuan beralas y = 0 (diskalakan matriks; hanya untuk material TANPA tekstur). */
const unitBox = () => heroGeometry('kotakSatuan', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
/** Silinder satuan (r 1, tinggi 1) beralas y = 0. */
const unitCylinder = (seg) => heroGeometry(`silinderSatuan:${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg).translate(0, 0.5, 0));

/** Tinggi alas hero (dunia, = tanah pad + PLINTH): min baseY massa plan → ctx.groundY → PLINTH. */
export function heroBaseY(plan, ctx, site) {
  const ys = (plan?.masses ?? []).map((m) => m?.baseY).filter(Number.isFinite);
  if (ys.length) return Math.min(...ys);
  if (typeof ctx?.groundY === 'function') return ctx.groundY(site.x, site.z) + PLINTH;
  return PLINTH;
}

/**
 * Bingkai hero: origin dunia (x, y, z) + yaw (konvensi Object3D.rotation.y = regionTransform.toWorld).
 * `origin` ({x, z}) opsional dikurangkan dari translasi bila klaster M3 memakai koordinat relatif.
 */
export function createHeroFrame({ x, z, yaw = 0, y = 0, origin = null }) {
  const base = new THREE.Matrix4().compose(
    new THREE.Vector3(x - (origin?.x ?? 0), y, z - (origin?.z ?? 0)),
    new THREE.Quaternion().setFromAxisAngle(UP, yaw),
    new THREE.Vector3(1, 1, 1),
  );
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const parts = [];
  const add = (geometry, material, matrix = null, { castShadow = true, name = '' } = {}) => {
    parts.push({ geometry, material, matrix: matrix ? base.clone().multiply(matrix) : base.clone(), castShadow, name });
  };
  return {
    parts,
    y,
    add,
    /** Lokal → dunia {x, z} (tanpa pengurangan origin; untuk sampel ctx.groundY). */
    toWorld: (lx, lz) => ({ x: x + c * lx + s * lz, z: z - s * lx + c * lz }),
    /** Kotak [x0,x1]×[y0,y1]×[z0,z1] lokal; `ry` memutar terhadap pusat alas (rentang = ukuran sebelum diputar). */
    box(material, [x0, x1], [y0, y1], [z0, z1], { ry = 0, castShadow = true, name = '' } = {}) {
      add(unitBox(), material, local((x0 + x1) / 2, y0, (z0 + z1) / 2, { ry, sx: x1 - x0, sy: y1 - y0, sz: z1 - z0 }), { castShadow, name });
    },
    /** Silinder tegak beralas y0. */
    cylinder(material, { x: cx = 0, z: cz = 0, y0 = 0, h, r, seg = 12 }, { castShadow = true, name = '' } = {}) {
      add(unitCylinder(seg), material, local(cx, y0, cz, { sx: r, sy: h, sz: r }), { castShadow, name });
    },
  };
}

/** Penanda tinggi tanah di pusat bingkai: kunci cache berubah bila terrain termuat belakangan. */
export function groundStamp(frame, groundY) {
  if (typeof groundY !== 'function') return 'datar';
  const w = frame.toWorld(0, 0);
  return String(Math.round(groundY(w.x, w.z) * 100));
}

/** Letakkan vertex (bidang XZ lokal) di tanah: y = groundY(dunia) − frame.y + lift; UV = meter lokal. */
function settle(geometry, frame, { groundY, lift }) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const w = frame.toWorld(lx, lz);
    pos.setY(i, (typeof groundY === 'function' ? groundY(w.x, w.z) - frame.y : 0) + lift);
    uv?.setXY(i, lx, lz);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Permukaan persegi lokal [x0,x1]×[z0,z1] (grid `step` m) yang mengikuti tanah. */
export function groundGrid(key, frame, { x0, x1, z0, z1, step = 2, lift = 0.05, groundY = null }) {
  return heroGeometry(`tanah:${key}:${groundStamp(frame, groundY)}`, () => {
    const nx = Math.max(1, Math.ceil((x1 - x0) / step));
    const nz = Math.max(1, Math.ceil((z1 - z0) / step));
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    return settle(g, frame, { groundY, lift });
  });
}

/** Cakram lokal berpusat (0, 0) radius r (cincin konsentris) yang mengikuti tanah. */
export function groundDisc(key, frame, { r, seg = 48, rings = 8, lift = 0.04, groundY = null }) {
  return heroGeometry(`tanah:${key}:${groundStamp(frame, groundY)}`, () => settle(new THREE.RingGeometry(0.01, r, seg, rings).rotateX(-Math.PI / 2), frame, { groundY, lift }));
}
```

- [ ] **Step 6: Buat `reliefText.js`**

```js
// src/world/kit/hero/reliefText.js
/**
 * Huruf timbul berlapis: tekstur canvas huruf berlatar transparan (alphaTest) pada 3 bidang berjarak
 * 3 cm — lapis depan berwarna, dua lapis belakang gelap → kesan tebal dari sudut miring tanpa font 3D.
 * Bidang menghadap −Z (konvensi aset katalog); lapis belakang di +Z (ke arah dinding). Node (tanpa
 * document) → bidang warna polos (hanya terjadi di tes). Cache di scope aktif (heroFrame).
 */
import * as THREE from 'three';
import { makeTextTexture } from '../../siteutil/textCanvas.js';
import { heroMaterial, heroGeometry, named } from './heroFrame.js';

const LAYER_GAP = 0.03;

/**
 * Material huruf (cache `teks:<key>`). nightGlow > 0 → emisif hangat menyala malam (TimeOfDay).
 * @param {string} key @param {string} text
 * @param {{color?:string, font?:string, width?:number, height?:number, nightGlow?:number}} [opts]
 */
export function reliefTextMaterial(key, text, { color = '#d9b75a', font = 'bold 150px sans-serif', width = 2048, height = 192, nightGlow = 0 } = {}) {
  return heroMaterial(`teks:${key}`, () => {
    const map = makeTextTexture(text, { bg: 'rgba(0,0,0,0)', fg: color, width, height, font, padding: 16 });
    const mat = new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : color, map, alphaTest: map ? 0.5 : 0, roughness: 0.45, metalness: 0.35,
    });
    if (nightGlow > 0) {
      mat.emissive = new THREE.Color(0xffe2b0);
      mat.emissiveMap = map;
      mat.emissiveIntensity = 0;
      mat.userData.nightEmissive = { on: nightGlow, off: 0 };
    }
    mat.userData.text = text;
    return named(mat, `teks:${key}`);
  });
}

/**
 * PartList huruf timbul di ruang-teks (pusat di origin, menghadap −Z). Pemanggil mengalikan matriksnya.
 * @returns {Array<{geometry:THREE.BufferGeometry, material:THREE.Material, matrix:THREE.Matrix4, castShadow:boolean, name:string}>}
 */
export function reliefTextParts({ key, text, width, height, color = '#d9b75a', shade = '#5c4a22', nightGlow = 0, layers = 3 }) {
  const geometry = heroGeometry(`teksBidang:${width.toFixed(2)}x${height.toFixed(2)}`, () => new THREE.PlaneGeometry(width, height).rotateY(Math.PI));
  const front = reliefTextMaterial(key, text, { color, nightGlow });
  const back = reliefTextMaterial(`${key}:bayang`, text, { color: shade });
  return Array.from({ length: layers }, (_, i) => ({
    geometry,
    material: i === 0 ? front : back,
    matrix: new THREE.Matrix4().makeTranslation(0, 0, i * LAYER_GAP),
    castShadow: false,
    name: `teks:${key}`,
  }));
}
```

- [ ] **Step 7: Lint & commit**

Run: `npm run lint`
Expected: 0 galat.

```bash
git add src/world/kit/hero/heroFrame.js src/world/kit/hero/reliefText.js src/world/kit/hero/ornaments.js tests/unri/heroOrnaments.test.js
```
```bash
git commit -m "feat(kit-hero): bingkai hero PartList dunia, huruf timbul berlapis, registry placeholder ornamen GLB"
```

---

## Task 6: Utilitas region — material, lingkungan situs, antrean bertahap (TDD runStaged)

**Files:**
- Create: `src/regions/unri-rektorat/materials.js`
- Create: `src/regions/unri-rektorat/env.js`
- Create: `src/regions/unri-rektorat/staged.js`
- Test: `tests/unri/stagedRunner.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
// tests/unri/stagedRunner.test.js
import { describe, it, expect } from 'vitest';
import { runStaged } from '../../src/regions/unri-rektorat/staged.js';
import { createResourceScope, currentScope } from '../../src/engine/ResourceScope.js';

/** Scheduler palsu: tick() memajukan setiap tugas satu potongan (satu yield). */
function fakeScheduler() {
  const tasks = [];
  return {
    schedule(task) {
      const h = { it: task(), done: false, cancelled: false, cancel() { h.cancelled = true; } };
      tasks.push(h);
      return h;
    },
    tick() {
      for (const h of tasks) if (!h.cancelled && !h.done) h.done = h.it.next().done;
    },
  };
}

describe('runStaged', () => {
  it('tanpa scheduler: semua langkah berurutan, di scope region', async () => {
    const scope = createResourceScope('uji');
    const log = [];
    const run = runStaged({ scope, steps: [() => log.push(currentScope() === scope), () => log.push('b')] });
    await expect(run.promise).resolves.toBe(true);
    expect(log).toEqual([true, 'b']);
  });
  it('dengan scheduler: satu langkah per potongan; selesai → true', async () => {
    const s = fakeScheduler();
    const log = [];
    const run = runStaged({ scope: createResourceScope('uji'), schedule: s.schedule, steps: [() => log.push(1), () => log.push(2)] });
    expect(log).toEqual([]);
    s.tick();
    expect(log).toEqual([1]);
    s.tick();
    expect(log).toEqual([1, 2]);
    s.tick();
    await expect(run.promise).resolves.toBe(true);
  });
  it('cancel(): resolve false, langkah berikut tidak berjalan', async () => {
    const s = fakeScheduler();
    const log = [];
    const run = runStaged({ scope: createResourceScope('uji'), schedule: s.schedule, steps: [() => log.push(1), () => log.push(2)] });
    s.tick();
    run.cancel();
    s.tick();
    await expect(run.promise).resolves.toBe(false);
    expect(log).toEqual([1]);
  });
  it('langkah melempar → reject dengan galat itu', async () => {
    const run = runStaged({ scope: createResourceScope('uji'), steps: [() => { throw new Error('rusak'); }] });
    await expect(run.promise).rejects.toThrow('rusak');
  });
  it('isCancelled() menjadi true di tengah antrean → false', async () => {
    let stop = false;
    const log = [];
    const run = runStaged({
      scope: createResourceScope('uji'), isCancelled: () => stop,
      steps: [() => { log.push(1); stop = true; }, () => log.push(2)],
    });
    await expect(run.promise).resolves.toBe(false);
    expect(log).toEqual([1]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/stagedRunner.test.js`
Expected: FAIL — modul `staged.js` tidak ditemukan.

- [ ] **Step 3: Buat `staged.js`**

```js
// src/regions/unri-rektorat/staged.js
/**
 * Perakitan region bertahap (spec §4.3): daftar langkah dijalankan sebagai SATU tugas generator di
 * ctx.schedule (scheduler M0, ≤ 4 ms/frame; tiap yield = titik potong), masing-masing di dalam
 * withScope(scope) agar cache material/geometri masuk scope region. Tanpa scheduler (tes/Node) → sinkron.
 */
import { withScope } from '../../engine/ResourceScope.js';

/**
 * @param {{steps: Array<() => void>, scope: object, schedule?: ((task: () => Generator) => {cancel(): void})|null,
 *   isCancelled?: () => boolean}} opts
 * @returns {{promise: Promise<boolean>, cancel(): void}} promise: true selesai, false dibatalkan; reject bila langkah melempar
 */
export function runStaged({ steps, scope, schedule = null, isCancelled = () => false }) {
  let settle = null;
  const promise = new Promise((resolve, reject) => { settle = { resolve, reject }; });
  let finished = false;
  const finish = (fn, value) => {
    if (finished) return;
    finished = true;
    fn(value);
  };
  function* task() {
    for (const step of steps) {
      if (finished) return;
      if (isCancelled()) {
        finish(settle.resolve, false);
        return;
      }
      try {
        withScope(scope, step);
      } catch (err) {
        finish(settle.reject, err);
        return;
      }
      yield;
    }
    finish(settle.resolve, true);
  }
  let handle = null;
  if (typeof schedule === 'function') handle = schedule(task);
  else for (const _ of task()) { /* sinkron: habiskan generator */ }
  return {
    promise,
    cancel() {
      handle?.cancel?.();
      finish(settle.resolve, false);
    },
  };
}

/** Bekukan subpohon yang ditambahkan SETELAH freezeStatic region (matriks lokal tetap; dunia ikut induk). */
export function freezeSubtree(obj) {
  obj.traverse((o) => {
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  });
  obj.updateMatrixWorld(true);
  return obj;
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/stagedRunner.test.js`
Expected: PASS (5 tes).

- [ ] **Step 5: Buat `materials.js`**

```js
// src/regions/unri-rektorat/materials.js
/**
 * Material region unri-rektorat, ber-cache di ResourceScope aktif (kunci 'unri-rektorat:<nama>') dan
 * dilepas bersama teksturnya. Material bercahaya malam memakai userData.nightEmissive {on, off}
 * (TimeOfDay.lights); overlay permukaan (paving, rumput, trotoar) memakai polygonOffset agar menang atas
 * ground distrik tanpa z-fighting. Warna [T] dari foto: dinding putih, kaca biru, parapet gelap, kanopi
 * merah; lainnya [INFERENSI].
 */
import * as THREE from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { surfaceMaps } from '../../world/textures/surfaces.js';
import { hasDocument } from '../../world/siteutil/textCanvas.js';
import { createRng } from '../../world/util/random.js';
import { disposeMaterialDeep } from '../../world/kit/hero/heroFrame.js';

export const WARNA = Object.freeze({
  dinding: 0xf3f1ec, parapet: 0x3d4148, kacaPita: 0x1d3148, kacaBiru: 0x3b78b8, granit: 0x8f8c86,
  tangga: 0xdcd8cf, atap: 0x9c9e9d, merah: 0xb3282d, plafon: 0xf6f2e8, mesin: 0x878a8d, tandon: 0xd9d6cc,
  perpusDinding: 0xe8dfcc, atapSeng: 0x7d8a96, batu: 0x857b70, beton: 0xb9b6ae, lobi: 0x24303c,
  emas: 0xd4a017, malam: 0xffd9a0,
});
/** Lebar bay pita jendela (m) — juga satuan sel peta lampu malam (16 sel per tekstur). */
export const BAY = 1.8;
const OVERLAY = Object.freeze({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

const cached = (key, make) => currentScope().get(`unri-rektorat:${key}`, make, { dispose: disposeMaterialDeep });
const named = (mat, name) => {
  mat.name = `rektorat:${name}`;
  return mat;
};
const lambert = (name, color, extra = {}) => cached(name, () => named(new THREE.MeshLambertMaterial({ color, ...extra }), name));
const standard = (name, opts) => cached(name, () => named(new THREE.MeshStandardMaterial(opts), name));

/** Peta emisif pita jendela: 16 sel menyala acak hangat (malam). Node → null (seragam). */
function litWindowsTexture(seed = 1962) {
  if (!hasDocument()) return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 512, 64);
  const rnd = createRng(seed);
  for (let i = 0; i < 16; i += 1) {
    if (rnd() >= 0.45) continue;
    g.fillStyle = rnd() < 0.5 ? '#ffd9a0' : '#fff2d8';
    g.fillRect(i * 32 + 3, 8, 26, 48);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Emisif hangat yang mati siang (off 0) dan menyala `on` saat lampu malam. */
function nightGlow(mat, on, color = WARNA.malam) {
  mat.emissive = new THREE.Color(color);
  mat.emissiveIntensity = 0;
  mat.userData.nightEmissive = { on, off: 0 };
  return mat;
}

export const MATS = Object.freeze({
  dinding: () => lambert('dinding', WARNA.dinding),
  parapet: () => lambert('parapet', WARNA.parapet),
  tangga: () => lambert('tangga', WARNA.tangga),
  atap: () => lambert('atap', WARNA.atap),
  mesin: () => lambert('mesin', WARNA.mesin),
  tandon: () => lambert('tandon', WARNA.tandon),
  merah: () => lambert('merah', WARNA.merah, { side: THREE.DoubleSide }),
  perpusDinding: () => lambert('perpusDinding', WARNA.perpusDinding),
  atapSeng: () => lambert('atapSeng', WARNA.atapSeng, { side: THREE.DoubleSide }),
  granit: () => standard('granit', { color: WARNA.granit, roughness: 0.35, metalness: 0.05 }),
  emas: () => standard('emas', { color: WARNA.emas, roughness: 0.35, metalness: 0.6 }),
  kacaBiru: () => standard('kacaBiru', { color: WARNA.kacaBiru, roughness: 0.12, metalness: 0.45 }),
  kacaPita: () => cached('kacaPita', () => {
    const m = named(new THREE.MeshStandardMaterial({ color: WARNA.kacaPita, roughness: 0.15, metalness: 0.55 }), 'kacaPita');
    nightGlow(m, 0.85);
    const map = litWindowsTexture();
    if (map) m.emissiveMap = map;
    return m;
  }),
  lobi: () => cached('lobi', () => nightGlow(named(new THREE.MeshStandardMaterial({ color: WARNA.lobi, roughness: 0.2, metalness: 0.3 }), 'lobi'), 0.7)),
  plafon: () => cached('plafon', () => nightGlow(named(new THREE.MeshStandardMaterial({ color: WARNA.plafon, roughness: 0.8, side: THREE.DoubleSide }), 'plafon'), 1.1)),
  beton: () => cached('beton', () => named(new THREE.MeshStandardMaterial({ color: WARNA.beton, roughness: 0.92, ...surfaceMaps('concrete', 2) }), 'beton')),
  betonDS: () => cached('betonDS', () => named(new THREE.MeshStandardMaterial({ color: WARNA.beton, roughness: 0.92, side: THREE.DoubleSide }), 'betonDS')),
  batu: () => cached('batu', () => named(new THREE.MeshStandardMaterial({ color: WARNA.batu, roughness: 0.95, ...surfaceMaps('concrete', 1.5) }), 'batu')),
  paving: () => cached('paving', () => named(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, ...OVERLAY, ...surfaceMaps('paving') }), 'paving')),
  trotoar: () => cached('trotoar', () => named(new THREE.MeshStandardMaterial({ color: WARNA.beton, roughness: 0.9, ...OVERLAY, ...surfaceMaps('concrete', 2) }), 'trotoar')),
  rumput: () => cached('rumput', () => named(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, ...OVERLAY, ...surfaceMaps('grass') }), 'rumput')),
  /** Material bendera (dibuat pemanggil karena butuh shader angin). */
  bendera: (make) => cached('bendera', make),
});
```

- [ ] **Step 6: Buat `env.js`**

```js
// src/regions/unri-rektorat/env.js
/**
 * Lingkungan situs region: medan (ctx.heightAtLocal / ctx.terrain; cadangan datar), menunggu chunk terrain
 * mask termuat sebelum merakit, helper drape lokal (drape.js bekerja di koordinat DUNIA → hasil
 * ditranslasi ke lokal; yaw 0), dan kerbWall (dinding tegak kerb/sisi trotoar di sisi polyline).
 */
import * as THREE from 'three';
import { drapePolygon, drapePolyline } from '../../world/terrain/drape.js';
import { tilesInRect } from '../../geo/tiles.js';
import { ringBounds } from '../../geo/polygon.js';
import { REKTORAT_PLACEMENT as P } from './placement.js';
import { rektoratMaskWorld } from './mask.js';

/** Medan datar (tes / tanpa distrik): kontrak HeightField minimal. */
export const FLAT_FIELD = Object.freeze({
  heightAt: () => 0,
  normalAt: (_x, _z, out = { x: 0, y: 1, z: 0 }) => out,
  gradeAlong: () => 0,
  version: 0,
});

/** Kunci chunk terrain (grid 500 m = TILE_SIZE) yang menutup mask region: ['-3_1', '-2_1']. */
export const TERRAIN_KEYS = Object.freeze(tilesInRect(ringBounds(rektoratMaskWorld())).map((t) => t.key));

/**
 * @param {{terrain?: object, heightAtLocal?: (lx:number, lz:number) => number}} [ctx]
 * @returns {{field: object, hAt(lx:number, lz:number): number}}
 */
export function createSiteEnv(ctx = {}) {
  const field = ctx.terrain ?? FLAT_FIELD;
  const hAt = typeof ctx.heightAtLocal === 'function'
    ? (lx, lz) => ctx.heightAtLocal(lx, lz)
    : (lx, lz) => field.heightAt(lx + P.x, lz + P.z);
  return Object.freeze({ field, hAt });
}

/**
 * Tunggu semua chunk `keys` ada di HeightField (field.has). Field tanpa `has` (datar/tes) → langsung true.
 * Batas waktu → false + satu peringatan (dirakit di atas tinggi yang ada; spec §10: chunk gagal = datar).
 */
export function waitForTerrain(env, { keys = TERRAIN_KEYS, timeoutMs = 15000, intervalMs = 100, logger = console } = {}) {
  const field = env.field;
  if (typeof field.has !== 'function') return Promise.resolve(true);
  const ready = () => keys.every((k) => field.has(k));
  if (ready()) return Promise.resolve(true);
  const t0 = Date.now();
  return new Promise((resolve) => {
    const poll = () => {
      if (ready()) {
        resolve(true);
        return;
      }
      if (Date.now() - t0 >= timeoutMs) {
        logger.warn(`Region unri-rektorat: chunk terrain ${keys.join(', ')} belum termuat setelah ${timeoutMs} ms; dirakit dengan tinggi yang ada`);
        resolve(false);
        return;
      }
      setTimeout(poll, intervalMs);
    };
    setTimeout(poll, intervalMs);
  });
}

const toLocalGeometry = (g) => g.translate(-P.x, 0, -P.z);
const toWorldPts = (pts) => pts.map(([x, z]) => [x + P.x, z + P.z]);

/** drapePolygon (M2) untuk ring lokal → geometri lokal (UV tetap dunia). */
export const drapePolygonLocal = (env, ringLocal, opts) => toLocalGeometry(drapePolygon([toWorldPts(ringLocal)], env.field, opts));

/** drapePolyline (M2) untuk polyline lokal → geometri lokal. */
export const drapePolylineLocal = (env, ptsLocal, width, opts) => toLocalGeometry(drapePolyline(toWorldPts(ptsLocal), width, env.field, opts));

/**
 * Dinding tegak sejajar polyline lokal `pts` pada offset kiri `offset` m (negatif = kanan), dari
 * tanah − 0,05 sampai tanah + height; sampel tiap ≤ `step` m. BufferGeometry ber-index (position/normal/uv).
 */
export function kerbWall(env, pts, offset, height, step = 2) {
  const pos = [];
  const uv = [];
  const idx = [];
  let base = 0;
  let along = 0;
  for (let s = 0; s < pts.length - 1; s += 1) {
    const [ax, az] = pts[s];
    const [bx, bz] = pts[s + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const x = ax + (bx - ax) * t + nx * offset;
      const z = az + (bz - az) * t + nz * offset;
      const y = env.hAt(x, z);
      pos.push(x, y - 0.05, z, x, y + height, z);
      uv.push(along + len * t, 0, along + len * t, height + 0.05);
    }
    for (let i = 0; i < n; i += 1) {
      const k = base + i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
    base += (n + 1) * 2;
    along += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
```

- [ ] **Step 7: Cek kunci terrain + lint**

Run: `node -e "import('./src/regions/unri-rektorat/env.js').then((m) => console.log(m.TERRAIN_KEYS))"`
Expected: `[ '-3_1', '-2_1' ]`

Run: `npm run lint`
Expected: 0 galat.

- [ ] **Step 8: Commit**

```bash
git add src/regions/unri-rektorat/materials.js src/regions/unri-rektorat/env.js src/regions/unri-rektorat/staged.js tests/unri/stagedRunner.test.js
```
```bash
git commit -m "feat(unri-rektorat): material region, lingkungan situs (tunggu terrain, drape lokal, kerb), antrean bertahap"
```

---

## Task 7: Vegetasi V04 akasia ramping & V05 palem

**Files:**
- Create: `src/world/props/unri/akasiaRamping.js`
- Create: `src/world/props/unri/palem.js`

- [ ] **Step 1: Buat `akasiaRamping.js`**

```js
// src/world/props/unri/akasiaRamping.js
/**
 * V04 akasia ramping (poros Rektorat): batang tinggi ramping + tajuk sempit memanjang (3 gumpalan).
 * Visual [T] foto 2016 (pohon tinggi ramping bertajuk sempit); spesies [INFERENSI] (mirip Acacia
 * mangium/eukaliptus). ±17 m, ±310 segitiga. Part untuk instanceParts (skala & rotasi per instance).
 */
import * as THREE from 'three';
import { currentScope } from '../../../engine/ResourceScope.js';
import { mergeAll } from '../../siteutil/rounded.js';

export const AKASIA = Object.freeze({
  trunkH: 9.5, trunkR: 0.22, crownY: 12.0, crownR: 1.9, crownH: 7.5,
  colors: Object.freeze({ batang: 0x8a7f70, tajuk: 0x4d6a33 }),
});

const trunkGeo = () => currentScope().get('V04:batang', () => new THREE.CylinderGeometry(AKASIA.trunkR * 0.6, AKASIA.trunkR, AKASIA.trunkH, 7).translate(0, AKASIA.trunkH / 2, 0));
const crownGeo = () => currentScope().get('V04:tajuk', () => mergeAll([
  new THREE.SphereGeometry(1, 8, 7).scale(AKASIA.crownR, AKASIA.crownH / 2, AKASIA.crownR).translate(0, AKASIA.crownY, 0),
  new THREE.SphereGeometry(1, 7, 6).scale(AKASIA.crownR * 0.75, AKASIA.crownH * 0.28, AKASIA.crownR * 0.75).translate(0.5, AKASIA.crownY + 3.4, -0.3),
  new THREE.SphereGeometry(1, 7, 6).scale(AKASIA.crownR * 0.7, AKASIA.crownH * 0.25, AKASIA.crownR * 0.7).translate(-0.4, AKASIA.crownY - 3.0, 0.4),
]));
const trunkMat = () => currentScope().get('V04:matBatang', () => Object.assign(new THREE.MeshLambertMaterial({ color: AKASIA.colors.batang }), { name: 'V04:batang' }));
const crownMat = () => currentScope().get('V04:matTajuk', () => Object.assign(new THREE.MeshLambertMaterial({ color: AKASIA.colors.tajuk }), { name: 'V04:tajuk' }));

/** Part V04 untuk instanceParts. */
export function akasiaParts() {
  return [
    { geometry: trunkGeo(), material: trunkMat(), castShadow: true, name: 'akasiaBatang' },
    { geometry: crownGeo(), material: crownMat(), castShadow: true, name: 'akasiaTajuk' },
  ];
}
```

- [ ] **Step 2: Buat `palem.js`**

```js
// src/world/props/unri/palem.js
/**
 * V05 palem (taman depan Rektorat & poros) [T foto 2016]: batang ramping 7 m + 11 pelepah melengkung
 * terkulai (bidang meruncing, dua sisi) + bonggol. ±250 segitiga. Part untuk instanceParts.
 */
import * as THREE from 'three';
import { currentScope } from '../../../engine/ResourceScope.js';
import { mergeAll } from '../../siteutil/rounded.js';

export const PALEM = Object.freeze({
  trunkH: 7.0, fronds: 11, frondLen: 3.4, frondW: 0.55,
  colors: Object.freeze({ batang: 0x9b8c74, daun: 0x4e7a32 }),
});

/** Satu pelepah sepanjang +Z: meruncing, naik lalu terkulai. */
function frondGeometry() {
  const L = PALEM.frondLen;
  const g = new THREE.PlaneGeometry(PALEM.frondW, L, 1, 6);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const t = (pos.getY(i) + L / 2) / L; // 0 pangkal … 1 ujung
    pos.setXYZ(i, pos.getX(i) * (1 - 0.7 * t), L * (0.35 * t - 0.55 * t * t), t * L);
  }
  g.computeVertexNormals();
  return g;
}

function crownGeometry() {
  const parts = [];
  for (let k = 0; k < PALEM.fronds; k += 1) {
    const f = frondGeometry();
    f.rotateX(-(0.15 + (k % 3) * 0.12));
    f.rotateY((k / PALEM.fronds) * Math.PI * 2 + (k % 2) * 0.2);
    f.translate(0, PALEM.trunkH, 0);
    parts.push(f);
  }
  parts.push(new THREE.SphereGeometry(0.35, 8, 6).translate(0, PALEM.trunkH, 0));
  return mergeAll(parts);
}

const trunkGeo = () => currentScope().get('V05:batang', () => new THREE.CylinderGeometry(0.16, 0.24, PALEM.trunkH, 8).translate(0, PALEM.trunkH / 2, 0));
const crownGeo = () => currentScope().get('V05:tajuk', crownGeometry);
const trunkMat = () => currentScope().get('V05:matBatang', () => Object.assign(new THREE.MeshLambertMaterial({ color: PALEM.colors.batang }), { name: 'V05:batang' }));
const leafMat = () => currentScope().get('V05:matDaun', () => Object.assign(new THREE.MeshLambertMaterial({ color: PALEM.colors.daun, side: THREE.DoubleSide }), { name: 'V05:daun' }));

/** Part V05 untuk instanceParts. */
export function palemParts() {
  return [
    { geometry: trunkGeo(), material: trunkMat(), castShadow: true, name: 'palemBatang' },
    { geometry: crownGeo(), material: leafMat(), castShadow: true, name: 'palemDaun' },
  ];
}
```

- [ ] **Step 3: Smoke Node (segitiga ≤ budget katalog 1k)**

Run:
```bash
node --input-type=module -e "
import { akasiaParts } from './src/world/props/unri/akasiaRamping.js';
import { palemParts } from './src/world/props/unri/palem.js';
const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
for (const [n, parts] of [['V04', akasiaParts()], ['V05', palemParts()]]) console.log(n, parts.reduce((s, p) => s + tris(p.geometry), 0));
"
```
Expected: `V04 264` dan `V05 244` (batas katalog ≤ 1000).

- [ ] **Step 4: Lint & commit**

Run: `npm run lint` → 0 galat.

```bash
git add src/world/props/unri/akasiaRamping.js src/world/props/unri/palem.js
```
```bash
git commit -m "feat(props-unri): vegetasi V04 akasia ramping dan V05 palem (part instancing)"
```

---
## Task 8: Gedung Rektorat (`rektorat.js`)

**Files:**
- Create: `src/regions/unri-rektorat/rektorat.js`

- [ ] **Step 1: Buat `rektorat.js`**

```js
// src/regions/unri-rektorat/rektorat.js
/**
 * Gedung Rektorat Universitas Riau (OSM way 282225347) — hero region H04. Rujukan [T]: foto drone 2016
 * Commons "Taman_Unri.jpg" (CC BY-SA 4.0): putih, ±5 lantai, simetris; blok tengah menonjol berkaca biru
 * vertikal dengan huruf nama di puncak; sayap kiri/kanan dengan pita sunshade horizontal berulang; atap
 * datar dengan parapet gelap; kanopi beratap merah di depan (bentuk selembayung TIDAK terkonfirmasi →
 * limas merah sederhana di 4 tiang, N03). Palem & tiang bendera ada di porosTaman.js.
 * [INFERENSI]: tinggi lantai (4,2 + 4 × 3,6 m), podium 0,9 m + 4 anak tangga, 5 bilah kaca, teks huruf
 * puncak "UNIVERSITAS RIAU" & warnanya, papan nama granit, ruang mesin & tandon atap, fasad belakang = sayap.
 * Region-lokal; massa diangkat ke tanah pad (env.hAt(0, 0)); permukaan depan di-drape terpisah.
 */
import * as THREE from 'three';
import { MATS, BAY } from './materials.js';
import { REKTORAT_MASSA } from './site.data.js';
import { LAYOUT } from './layout.js';
import { drapePolygonLocal } from './env.js';
import { reliefTextParts } from '../../world/kit/hero/reliefText.js';
import { makeTextMaterial } from '../../world/siteutil/textCanvas.js';

export const LEVEL = Object.freeze({ podium: 0.9, l1: 4.2, atas: 3.6, jumlah: 5, parapet: 1.1, atik: 3.0 });
/** y lantai ke-k (0 = lantai dasar di atas podium) relatif tanah pad. */
export const floorY = (k) => (k === 0 ? LEVEL.podium : LEVEL.podium + LEVEL.l1 + (k - 1) * LEVEL.atas);
/** Atas pelat atap (19,5 m). */
export const ROOF_Y = floorY(LEVEL.jumlah);
const BAND = 0.9;   // spandrel putih di bawah pita jendela
const INSET = 0.25; // pita kaca masuk dari muka fasad
const SHADE = 0.9;  // tonjolan sunshade
const winH = (k) => (k === 0 ? 2.6 : 2.1);
const { slab: S, tengah: T, kanopi: K } = REKTORAT_MASSA;

/** Kotak [x0,x1]×[y0,y1]×[z0,z1] sebagai Mesh di `group`. */
export function addBox(group, mat, [x0, x1], [y0, y1], [z0, z1], { cast = true, name = 'rektorat' } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = cast;
  m.receiveShadow = true;
  m.name = name;
  group.add(m);
  return m;
}

/** Bidang tegak menghadap +X (sx 1) / −X (sx −1) di x; `uOffset` → UV per bay (peta lampu malam). */
function addPlaneX(group, mat, x, sx, [z0, z1], [y0, y1], { name = 'rektorat', uOffset = null } = {}) {
  const len = z1 - z0;
  const g = new THREE.PlaneGeometry(len, y1 - y0);
  if (uOffset !== null) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) uv.setX(i, (uv.getX(i) * len) / BAY / 16 + uOffset);
  }
  const m = new THREE.Mesh(g, mat);
  m.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
  m.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
  m.receiveShadow = true;
  m.name = name;
  group.add(m);
  return m;
}

/** Bidang tegak menghadap +Z (sz 1) / −Z (sz −1) di z. */
function addPlaneZ(group, mat, z, sz, [x0, x1], [y0, y1], name = 'rektorat') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mat);
  m.rotation.y = sz > 0 ? 0 : Math.PI;
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  m.receiveShadow = true;
  m.name = name;
  group.add(m);
  return m;
}

/** Mullion putih tipis tiap bay di pita jendela. */
function mullions(group, xb, sx, [z0, z1], ys) {
  const xs = sx > 0 ? [xb, xb + 0.22] : [xb - 0.22, xb];
  for (let z = z0 + BAY; z < z1 - 0.2; z += BAY) addBox(group, MATS.dinding(), xs, ys, [z - 0.06, z + 0.06], { cast: false, name: 'rektoratMullion' });
}

/** Fasad timur (dua sayap) & barat (penuh): per lantai spandrel, pita kaca masuk 0,25 m, dinding atas, sunshade. */
function wingFacades(group) {
  const sides = [
    { sx: 1, segs: [[S.z0, T.z0], [T.z1, S.z1]] },
    { sx: -1, segs: [[S.z0, S.z1]] },
  ];
  for (let k = 0; k < LEVEL.jumlah; k += 1) {
    const yF = floorY(k);
    const yW0 = yF + BAND;
    const yW1 = yW0 + winH(k);
    const yN = floorY(k + 1);
    for (const { sx, segs } of sides) {
      const xf = sx * S.x1;
      const xb = sx * (S.x1 - INSET);
      const wall = [Math.min(xb, xf), Math.max(xb, xf)];
      const shade = sx > 0 ? [S.x1, S.x1 + SHADE] : [-S.x1 - SHADE, -S.x1];
      for (const zr of segs) {
        addBox(group, MATS.dinding(), wall, [yF, yW0], zr);
        addPlaneX(group, MATS.kacaPita(), xb + sx * 0.01, sx, zr, [yW0, yW1], { name: 'rektoratPita', uOffset: k * 0.37 + (sx > 0 ? 0 : 0.5) });
        addBox(group, MATS.dinding(), wall, [yW1, yN], zr);
        addBox(group, MATS.dinding(), shade, [yW1, yW1 + 0.15], zr, { name: 'rektoratSunshade' });
        mullions(group, xb, sx, zr, [yW0, yW1]);
      }
    }
  }
}

/** Badan slab, plint granit, fasad ujung (jendela tangga + list), atap datar, parapet gelap, mesin & tandon. */
function slabBody(group) {
  addBox(group, MATS.dinding(), [S.x0 + INSET, S.x1 - INSET], [0, ROOF_Y], [S.z0, S.z1]);
  addBox(group, MATS.granit(), [S.x0 - 0.1, S.x1 + 0.1], [0, LEVEL.podium], [S.z0 - 0.1, S.z1 + 0.1]);
  for (const [z, sz] of [[S.z0, -1], [S.z1, 1]]) {
    addPlaneZ(group, MATS.kacaPita(), z + sz * 0.01, sz, [-1.0, 1.0], [floorY(1), ROOF_Y - 0.8], 'rektoratJendelaTangga');
    for (let k = 0; k < LEVEL.jumlah; k += 1) {
      const y = floorY(k) + BAND + winH(k);
      addBox(group, MATS.dinding(), [S.x0, S.x1], [y, y + 0.15], sz < 0 ? [z - 0.2, z] : [z, z + 0.2], { name: 'rektoratList' });
    }
  }
  addBox(group, MATS.atap(), [S.x0 + 0.25, S.x1 - 0.25], [ROOF_Y, ROOF_Y + 0.06], [S.z0 + 0.25, S.z1 - 0.25], { cast: false, name: 'rektoratAtap' });
  const pY = [ROOF_Y, ROOF_Y + LEVEL.parapet];
  addBox(group, MATS.parapet(), [S.x0, S.x0 + 0.25], pY, [S.z0, S.z1]);
  addBox(group, MATS.parapet(), [S.x0, S.x1], pY, [S.z0, S.z0 + 0.25]);
  addBox(group, MATS.parapet(), [S.x0, S.x1], pY, [S.z1 - 0.25, S.z1]);
  addBox(group, MATS.parapet(), [S.x1 - 0.25, S.x1], pY, [S.z0, T.z0]);
  addBox(group, MATS.parapet(), [S.x1 - 0.25, S.x1], pY, [T.z1, S.z1]);
  addBox(group, MATS.mesin(), [-7, -1], [ROOF_Y, ROOF_Y + 3], [-20, -15]);
  addBox(group, MATS.mesin(), [-7, -1], [ROOF_Y, ROOF_Y + 3], [15, 20]);
  for (const z of [-21, 21]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 16), MATS.tandon());
    t.position.set(4, ROOF_Y + 1.1, z);
    t.castShadow = true;
    t.name = 'rektoratTandon';
    group.add(t);
  }
}

/** Blok tengah: 6 sirip putih + 5 bilah kaca biru vertikal (lt 2–5), lobi kaca hangat lt 1, atik puncak. */
function centralBlock(group) {
  const xg = T.x1 - 0.3; // muka kaca, masuk 0,3 m dari muka sirip
  const y0 = floorY(1);
  addBox(group, MATS.dinding(), [T.x0 - 0.3, xg], [0, ROOF_Y], [T.z0, T.z1]);
  addBox(group, MATS.granit(), [T.x0, T.x1 + 0.1], [0, LEVEL.podium], [T.z0 - 0.1, T.z1 + 0.1]);
  const fins = 6;
  const finW = 0.6;
  const pane = (T.z1 - T.z0 - fins * finW) / (fins - 1);
  for (let i = 0; i < fins; i += 1) {
    const zc = T.z0 + finW / 2 + i * (finW + pane);
    addBox(group, MATS.dinding(), [xg, T.x1 + 0.4], [y0 - 0.3, ROOF_Y], [zc - finW / 2, zc + finW / 2], { name: 'rektoratSirip' });
  }
  for (let i = 0; i < fins - 1; i += 1) {
    const z0 = T.z0 + finW + i * (finW + pane);
    addPlaneX(group, MATS.kacaBiru(), xg + 0.01, 1, [z0, z0 + pane], [y0, ROOF_Y - 0.15], { name: 'rektoratKacaBiru' });
    for (let k = 2; k <= LEVEL.jumlah - 1; k += 1) addBox(group, MATS.dinding(), [xg, xg + 0.12], [floorY(k) - 0.08, floorY(k) + 0.08], [z0, z0 + pane], { cast: false, name: 'rektoratTransom' });
  }
  for (const [z, sz] of [[T.z0, -1], [T.z1, 1]]) addPlaneZ(group, MATS.kacaBiru(), z + sz * 0.01, sz, [13.4, 15.4], [y0, ROOF_Y - 0.15], 'rektoratKacaSamping');
  addPlaneX(group, MATS.lobi(), xg + 0.01, 1, [-7.2, 7.2], [LEVEL.podium, y0 - 0.4], { name: 'rektoratLobi' });
  for (const z of [-7.2, -3.6, 0, 3.6, 7.2]) addBox(group, MATS.parapet(), [xg, xg + 0.1], [LEVEL.podium, y0 - 0.4], [z - 0.06, z + 0.06], { cast: false, name: 'rektoratKusen' });
  addBox(group, MATS.dinding(), [xg, T.x1], [y0 - 0.4, y0 - 0.3], [T.z0, T.z1]);
  addBox(group, MATS.dinding(), [T.x0 - 0.3, T.x1 + 0.3], [ROOF_Y, ROOF_Y + LEVEL.atik], [T.z0 - 0.3, T.z1 + 0.3], { name: 'rektoratAtik' });
  addBox(group, MATS.parapet(), [T.x0 - 0.35, T.x1 + 0.35], [ROOF_Y + LEVEL.atik, ROOF_Y + LEVEL.atik + 0.2], [T.z0 - 0.35, T.z1 + 0.35]);
}

/** Teras lobi granit 0,9 m + 4 anak tangga 0,18 × 0,35 m ke drop-off. */
function terasTangga(group) {
  const t = LAYOUT.teras;
  const xTop = t.x1 - 4 * 0.35;
  addBox(group, MATS.granit(), [t.x0, xTop], [0, LEVEL.podium], [t.z0, t.z1], { name: 'rektoratTeras' });
  for (let i = 0; i < 4; i += 1) {
    addBox(group, MATS.tangga(), [xTop + i * 0.35, xTop + (i + 1) * 0.35], [0, LEVEL.podium - (i + 1) * 0.18], [t.z0, t.z1], { name: 'rektoratTangga' });
  }
}

/** Papan nama granit hitam (N05 gaya) di taman depan, menghadap timur. */
function papanNama() {
  const p = LAYOUT.papanNama;
  const g = new THREE.Group();
  g.name = 'rektoratPapanNama';
  g.position.set(p.x, 0, p.z);
  addBox(g, MATS.granit(), [-0.3, 0.3], [0, 0.6], [-p.w / 2 - 0.2, p.w / 2 + 0.2]);
  addBox(g, MATS.parapet(), [-0.08, 0.08], [0.6, 0.6 + p.h], [-p.w / 2, p.w / 2]);
  const text = new THREE.Mesh(
    new THREE.PlaneGeometry(p.w - 0.3, p.h - 0.25),
    makeTextMaterial('REKTORAT UNIVERSITAS RIAU', { bg: '#1c1f24', fg: '#f2f2f2', width: 1024, height: 192, font: 'bold 110px sans-serif', padding: 32 }),
  );
  text.rotation.y = Math.PI / 2;
  text.position.set(0.09, 0.6 + p.h / 2, 0);
  text.name = 'rektoratPapanNamaTeks';
  g.add(text);
  return g;
}

/** N02 placeholder: huruf timbul "UNIVERSITAS RIAU" 17 × 1,5 m di muka atik, menghadap timur, menyala malam. */
function hurufPuncak() {
  const g = new THREE.Group();
  g.name = 'N02';
  for (const p of reliefTextParts({ key: 'rektorat:N02', text: 'UNIVERSITAS RIAU', width: 17.0, height: 1.5, color: '#d9b75a', shade: '#6b5a2a', nightGlow: 1.3 })) {
    const m = new THREE.Mesh(p.geometry, p.material);
    m.applyMatrix4(p.matrix);
    m.name = p.name;
    g.add(m);
  }
  g.rotation.y = -Math.PI / 2; // −Z ruang-teks → +X (timur)
  g.position.set(T.x1 + 0.3 + 0.07, ROOF_Y + LEVEL.atik / 2, 0);
  return g;
}

/** N03 placeholder: kanopi limas merah di 4 tiang putih di atas drop-off (tonjolan depan OSM 8,6 × 8,3). */
function kanopiMerah() {
  const g = new THREE.Group();
  g.name = 'N03';
  const eave = 3.3;
  const fascia = 0.45;
  const xc = (K.x0 + K.x1) / 2;
  const zc = (K.z0 + K.z1) / 2;
  const w = K.x1 - K.x0 + 1.0;
  const d = K.z1 - K.z0 + 1.0;
  const [x0, x1, z0, z1] = [xc - w / 2, xc + w / 2, zc - d / 2, zc + d / 2];
  for (const p of LAYOUT.kanopiTiang) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, eave, 12), MATS.dinding());
    post.position.set(p.x, eave / 2, p.z);
    post.castShadow = true;
    post.name = 'N03tiang';
    g.add(post);
  }
  addBox(g, MATS.dinding(), [x0, x1], [eave, eave + fascia], [z0, z0 + 0.25], { name: 'N03lisplang' });
  addBox(g, MATS.dinding(), [x0, x1], [eave, eave + fascia], [z1 - 0.25, z1], { name: 'N03lisplang' });
  addBox(g, MATS.dinding(), [x0, x0 + 0.25], [eave, eave + fascia], [z0, z1], { name: 'N03lisplang' });
  addBox(g, MATS.dinding(), [x1 - 0.25, x1], [eave, eave + fascia], [z0, z1], { name: 'N03lisplang' });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.5, d - 0.5).rotateX(Math.PI / 2), MATS.plafon());
  ceiling.position.set(xc, eave + 0.02, zc);
  ceiling.name = 'N03plafon';
  g.add(ceiling);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), MATS.merah());
  roof.scale.set(w + 0.6, 1.6, d + 0.6);
  roof.position.set(xc, eave + fascia, zc);
  roof.castShadow = true;
  roof.name = 'N03atap';
  g.add(roof);
  return g;
}

/**
 * Massa Rektorat. raw = statis (digabung per material oleh index.js); placeholders = N02 & N03 (tidak
 * digabung agar GLB final dapat menyembunyikannya lewat `replaces`).
 * @returns {{raw: THREE.Group, placeholders: THREE.Group}}
 */
export function buildRektorat(env) {
  const y0 = env.hAt(0, 0);
  const raw = new THREE.Group();
  raw.name = 'rektorat';
  raw.position.y = y0;
  slabBody(raw);
  wingFacades(raw);
  centralBlock(raw);
  terasTangga(raw);
  raw.add(papanNama());
  const placeholders = new THREE.Group();
  placeholders.name = 'rektoratPlaceholder';
  placeholders.position.y = y0;
  placeholders.add(hurufPuncak(), kanopiMerah());
  return { raw, placeholders };
}

/** Permukaan depan (drape, tinggi dunia): paving entrance & jalur fasad, rumput taman depan & pulau parkir. */
export function buildRektoratGround(env) {
  const g = new THREE.Group();
  g.name = 'rektoratPermukaan';
  const add = (geo, mat, name) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.receiveShadow = true;
    g.add(m);
  };
  add(drapePolygonLocal(env, LAYOUT.plazaDepan, { lift: 0.06, maxEdge: 2 }), MATS.paving(), 'plazaPaving');
  add(drapePolygonLocal(env, LAYOUT.jalurFasad, { lift: 0.06, maxEdge: 2 }), MATS.paving(), 'plazaPaving');
  for (const r of LAYOUT.rumputDepan) add(drapePolygonLocal(env, r, { lift: 0.04, maxEdge: 2 }), MATS.rumput(), 'rumput');
  add(drapePolygonLocal(env, LAYOUT.pulauParkir, { lift: 0.08, maxEdge: 2 }), MATS.rumput(), 'rumput');
  return g;
}
```

- [ ] **Step 2: Smoke Node (struktur & bounding sesuai footprint)**

Run:
```bash
node --input-type=module -e "
import * as THREE from 'three';
import { withScope, createResourceScope } from './src/engine/ResourceScope.js';
import { buildRektorat, ROOF_Y } from './src/regions/unri-rektorat/rektorat.js';
const env = { field: { heightAt: () => 0 }, hAt: () => 2 };
const r = withScope(createResourceScope('uji'), () => buildRektorat(env));
const b = new THREE.Box3().setFromObject(r.raw);
console.log('ROOF_Y', ROOF_Y, 'x', b.min.x.toFixed(1), b.max.x.toFixed(1), 'y', b.min.y.toFixed(1), b.max.y.toFixed(1), 'z', b.min.z.toFixed(1), b.max.z.toFixed(1));
console.log('placeholder', r.placeholders.children.map((c) => c.name).join(','));
"
```
Expected: `ROOF_Y 19.5 x -12.6 22.4 y 2.0 24.7 z -32.5 32.4` (x −12,6 = sunshade barat; x 22,4 = ujung anak tangga & papan nama ≤ 21,3; y 24,7 = 2 + atik 22,5 + coping 0,2) lalu `placeholder N02,N03`. Selisih ±0,3 boleh; massa jauh di luar rentang ini = salah tanda/sumbu.

- [ ] **Step 3: Lint & commit**

Run: `npm run lint` → 0 galat.

```bash
git add src/regions/unri-rektorat/rektorat.js
```
```bash
git commit -m "feat(unri-rektorat): gedung Rektorat (sayap pita sunshade, blok tengah kaca biru, atik + huruf N02, kanopi merah N03, teras)"
```

---

## Task 9: Perpustakaan lama (`perpustakaan.js`)

**Files:**
- Create: `src/regions/unri-rektorat/perpustakaan.js`

- [ ] **Step 1: Buat `perpustakaan.js`**

```js
// src/regions/unri-rektorat/perpustakaan.js
/**
 * Perpustakaan UNRI lama (OSM way 282225374) — H08: "empat gedung, masing-masing dua lantai" [S, ringkasan
 * lib.unri.ac.id]. Empat kuadran dirakit kit K01 (planBuilding/buildBuilding, M3; atap limas seng
 * [INFERENSI]) + penghubung/tonjolan masuk 2 lt beratap datar + papan nama hitam huruf putih (N05 gaya)
 * di tonjolan timur. Kit gagal → kotak + limas cadangan (spec §10) dengan peringatan.
 */
import * as THREE from 'three';
import { planBuilding } from '../../world/kit/planBuilding.js';
import { buildBuilding } from '../../world/kit/buildBuilding.js';
import { createKitMaterials } from '../../world/kit/kitMaterials.js';
import { makeTextMaterial } from '../../world/siteutil/textCanvas.js';
import { PERPUS_MASSA } from './site.data.js';
import { MATS } from './materials.js';
import { REKTORAT_PLACEMENT as P } from './placement.js';
import { addBox } from './rektorat.js';

export const PERPUS = Object.freeze({ levels: 2, tinggi: 7.6, osmId: 282225374, teks: 'PERPUSTAKAAN UNIVERSITAS RIAU' });
/** Matriks dunia → lokal region (yaw 0). */
const TO_LOCAL = new THREE.Matrix4().makeTranslation(-P.x, 0, -P.z);

const boundsOf = (ring) => {
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  return [[Math.min(...xs), Math.max(...xs)], [Math.min(...zs), Math.max(...zs)]];
};

function kitMass(group, ringLocal, i, env, kitMats) {
  const ring = ringLocal.map(([x, z]) => [x + P.x, z + P.z]);
  const plan = planBuilding({
    id: `w${PERPUS.osmId}-${i}`, ring, levels: PERPUS.levels, archetype: 'K01',
    overrides: { roof: 'limas' }, seed: PERPUS.osmId + i, groundY: (x, z) => env.field.heightAt(x, z),
  });
  for (const part of buildBuilding(plan, kitMats)) {
    const m = new THREE.Mesh(part.geometry, part.material);
    m.applyMatrix4(TO_LOCAL.clone().multiply(part.matrix ?? new THREE.Matrix4()));
    m.castShadow = part.castShadow ?? true;
    m.receiveShadow = true;
    m.name = 'perpusKit';
    group.add(m);
  }
}

function fallbackMass(group, ringLocal, y0) {
  const [[x0, x1], [z0, z1]] = boundsOf(ringLocal);
  addBox(group, MATS.perpusDinding(), [x0, x1], [y0, y0 + PERPUS.tinggi], [z0, z1], { name: 'perpusCadangan' });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), MATS.atapSeng());
  roof.scale.set(x1 - x0 + 1.6, 3.0, z1 - z0 + 1.6);
  roof.position.set((x0 + x1) / 2, y0 + PERPUS.tinggi, (z0 + z1) / 2);
  roof.castShadow = true;
  roof.name = 'perpusAtapCadangan';
  group.add(roof);
}

/** @returns {THREE.Group} raw statis (digabung oleh index.js) */
export function buildPerpustakaan(env, scope, { logger = console } = {}) {
  const raw = new THREE.Group();
  raw.name = 'perpustakaanLama';
  const y0 = env.hAt(-113, -62);
  let kitMats = null;
  try {
    kitMats = createKitMaterials(scope);
  } catch (err) {
    logger.warn('Perpustakaan: material kit gagal dibuat, massa cadangan dipakai:', err);
  }
  PERPUS_MASSA.kuadran.forEach((ringLocal, i) => {
    try {
      if (!kitMats) throw new Error('kit tidak tersedia');
      kitMass(raw, ringLocal, i, env, kitMats);
    } catch (err) {
      logger.warn(`Perpustakaan massa ${i}: kit gagal → kotak cadangan:`, err);
      fallbackMass(raw, ringLocal, y0);
    }
  });
  for (const r of PERPUS_MASSA.penghubung) {
    addBox(raw, MATS.perpusDinding(), [r.x0, r.x1], [y0, y0 + PERPUS.tinggi], [r.z0, r.z1], { name: 'perpusPenghubung' });
    addBox(raw, MATS.parapet(), [r.x0, r.x1], [y0 + PERPUS.tinggi, y0 + PERPUS.tinggi + 0.5], [r.z0, r.z1], { name: 'perpusParapet' });
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 0.9),
    makeTextMaterial(PERPUS.teks, { bg: '#121417', fg: '#ffffff', width: 1536, height: 224, font: 'bold 120px sans-serif', padding: 36 }),
  );
  sign.rotation.y = Math.PI / 2;
  sign.position.set(-84.5 + 0.03, y0 + 5.2, -61.45);
  sign.name = 'perpusPapanNama';
  raw.add(sign);
  return raw;
}
```

- [ ] **Step 2: Smoke Node (kit M3 berjalan tanpa peringatan cadangan)**

Run:
```bash
node --input-type=module -e "
import * as THREE from 'three';
import { withScope, createResourceScope } from './src/engine/ResourceScope.js';
import { buildPerpustakaan } from './src/regions/unri-rektorat/perpustakaan.js';
const scope = createResourceScope('uji');
const env = { field: { heightAt: () => 1 }, hAt: () => 1 };
const warns = [];
const g = withScope(scope, () => buildPerpustakaan(env, scope, { logger: { warn: (...a) => warns.push(a.join(' ')) } }));
const b = new THREE.Box3().setFromObject(g);
console.log('meshes', g.children.length, 'peringatan', warns.length, 'x', b.min.x.toFixed(1), b.max.x.toFixed(1), 'z', b.min.z.toFixed(1), b.max.z.toFixed(1));
"
```
Expected: `peringatan 0`, x kira-kira −144…−82, z −81…−44 (tritisan kit ≤ 2,5 m boleh). Bila `peringatan` > 0, cetak `warns` — input `planBuilding` tidak cocok dengan M3: sesuaikan nama field mengikuti `src/world/kit/planBuilding.js` (kontrak spec §4.6), jangan membungkam peringatan.

- [ ] **Step 3: Lint & commit**

Run: `npm run lint` → 0 galat.

```bash
git add src/regions/unri-rektorat/perpustakaan.js
```
```bash
git commit -m "feat(unri-rektorat): perpustakaan lama 4 massa 2 lt lewat kit K01 + penghubung + papan nama"
```

---

## Task 10: Poros taman (`porosTaman.js`)

**Files:**
- Create: `src/regions/unri-rektorat/porosTaman.js`

- [ ] **Step 1: Buat `porosTaman.js`**

```js
// src/regions/unri-rektorat/porosTaman.js
/**
 * Poros taman menuju Rektorat: V04 akasia ramping (4 baris) + V05 palem, P04 bangku beton, PJU, P06 tiang
 * bendera Merah Putih di pulau taman parkir (sumbu Rektorat), jalan setapak beton di tengah median.
 * Foto 2016 [T]: barisan pohon ramping + palem mengapit poros, rumput luas, jalan setapak beton;
 * spesies, jumlah, posisi bangku/PJU [INFERENSI].
 */
import * as THREE from 'three';
import { instanceParts } from '../../world/siteutil/instanceParts.js';
import { createBenches } from '../../world/props/Bench.js';
import { createLampPosts } from '../../world/props/LampPost.js';
import { buildStripedFlagGeometry, FLAG_INDONESIA } from '../../world/props/Flagpole.js';
import { applyWind } from '../../world/shaders/wind.js';
import { akasiaParts } from '../../world/props/unri/akasiaRamping.js';
import { palemParts } from '../../world/props/unri/palem.js';
import { LAYOUT } from './layout.js';
import { MATS } from './materials.js';
import { drapePolylineLocal } from './env.js';

/** Angin bendera: sama dengan Flagpole.js (x = 0 menempel tiang → diam). */
const FLAG_WIND = Object.freeze({ weightMode: 'localX', xMin: 0, xMax: 2.4, amplitude: 0.25, flutter: 0.08 });
const withY = (env, list) => list.map((p) => ({ ...p, y: env.hAt(p.x, p.z) }));

function tiangBendera(env) {
  const t = LAYOUT.tiangBendera;
  const g = new THREE.Group();
  g.name = 'tiangBenderaRektorat';
  g.position.set(t.x, env.hAt(t.x, t.z), t.z);
  const alas = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.4), MATS.granit());
  alas.position.y = 0.225;
  alas.castShadow = true;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, t.tinggi, 10), MATS.dinding());
  pole.position.y = 0.45 + t.tinggi / 2;
  pole.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), MATS.emas());
  knob.position.y = 0.45 + t.tinggi + 0.12;
  const flagMat = MATS.bendera(() => {
    const m = applyWind(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), FLAG_WIND);
    m.name = 'rektorat:bendera';
    return m;
  });
  const flag = new THREE.Mesh(buildStripedFlagGeometry(FLAG_INDONESIA), flagMat);
  flag.position.y = 0.45 + t.tinggi - 0.3;
  flag.rotation.y = 0.6;
  flag.castShadow = true;
  flag.name = 'benderaMerahPutih';
  g.add(alas, pole, knob, flag);
  return g;
}

/** @returns {{raw: THREE.Group, instanced: THREE.Group}} raw digabung per material; instanced dipasang apa adanya */
export function buildPorosTaman(env) {
  const raw = new THREE.Group();
  raw.name = 'porosTamanStatis';
  const walk = new THREE.Mesh(drapePolylineLocal(env, LAYOUT.jalurPoros, 2.4, { lift: 0.06, segment: 2 }), MATS.paving());
  walk.name = 'plazaPaving';
  walk.receiveShadow = true;
  raw.add(walk);
  const inst = new THREE.Group();
  inst.name = 'porosTaman';
  inst.add(instanceParts(akasiaParts(), withY(env, LAYOUT.akasia), 'akasiaRamping'));
  inst.add(instanceParts(palemParts(), withY(env, LAYOUT.palem), 'palem'));
  inst.add(createBenches(withY(env, LAYOUT.bangku)));
  inst.add(createLampPosts(withY(env, LAYOUT.pju)));
  inst.add(tiangBendera(env));
  return { raw, instanced: inst };
}
```

- [ ] **Step 2: Lint & commit**

Run: `npm run lint` → 0 galat.

```bash
git add src/regions/unri-rektorat/porosTaman.js
```
```bash
git commit -m "feat(unri-rektorat): poros taman (akasia ramping, palem, bangku, PJU, tiang bendera, jalan setapak)"
```

---

## Task 11: Danau Buatan (`danau.js`)

**Files:**
- Create: `src/regions/unri-rektorat/danau.js`

- [ ] **Step 1: Buat `danau.js`**

```js
// src/regions/unri-rektorat/danau.js
/**
 * Danau Buatan Universitas Riau (OSM way 373856980). Air digambar distrik (src/districts/unri/water.js, M2);
 * region menambah P11 batu pijakan beton menyeberangi danau [T foto 2016; lintasan INFERENSI], trotoar
 * beton tinggi sisi danau [T foto 2016], dan N01 papan batu lengkung "UNIVERSITAS RIAU" [T] (placeholder
 * prosedural; GLB final menggantikan lewat replaces 'N01'), serta titian beton di atas gorong-gorong keluaran
 * danau (OSM way 783152923 footway bridge=yes; M2 sengaja tidak men-drape-nya) [T posisi; bentuk INFERENSI].
 */
import * as THREE from 'three';
import { createRng } from '../../world/util/random.js';
import { reliefTextMaterial } from '../../world/kit/hero/reliefText.js';
import { DANAU_RING, TITIAN } from './site.data.js';
import { LAYOUT } from './layout.js';
import { MATS } from './materials.js';
import { drapePolylineLocal, kerbWall } from './env.js';
import { addBox } from './rektorat.js';

export const DANAU = Object.freeze({
  batu: 0.8,        // sisi batu pijakan (m)
  timbul: 0.12,     // puncak batu di atas muka air
  offsetMuka: 0.4,  // muka air = tanah terendah di tepi − 0,4 m (spec §5.2 butir 8; = tools/campusbake/ground/waterLevel.js M2); kenop setel bila beda
  trotoar: Object.freeze({ lebar: 2.0, tinggi: 0.25 }),
  papan: Object.freeze({ R: 7, tebal: 0.5, huruf: 'UNIVERSITAS RIAU' }),
});

/** Muka air (y): tanah terendah di titik tepi ring − offsetMuka. */
export function waterLevel(env, ring = DANAU_RING) {
  return Math.min(...ring.map(([x, z]) => env.hAt(x, z))) - DANAU.offsetMuka;
}

function batuPijakan(group, env) {
  const top = waterLevel(env) + DANAU.timbul;
  const rnd = createRng(373856980);
  for (const s of LAYOUT.batuPijakan) {
    const bottom = Math.min(env.hAt(s.x, s.z) - 0.2, top - 0.3);
    const m = new THREE.Mesh(new THREE.BoxGeometry(DANAU.batu, top - bottom, DANAU.batu), MATS.beton());
    m.position.set(s.x, (top + bottom) / 2, s.z);
    m.rotation.y = (rnd() - 0.5) * 0.5;
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'batuPijakan';
    group.add(m);
  }
}

function trotoarDanau(group, env) {
  const { lebar, tinggi } = DANAU.trotoar;
  const pts = LAYOUT.trotoarDanau;
  const top = new THREE.Mesh(drapePolylineLocal(env, pts, lebar, { lift: tinggi, segment: 2 }), MATS.trotoar());
  top.name = 'trotoar';
  top.receiveShadow = true;
  group.add(top);
  for (const off of [lebar / 2, -lebar / 2]) {
    const wall = new THREE.Mesh(kerbWall(env, pts, off, tinggi), MATS.betonDS());
    wall.name = 'kerb';
    wall.receiveShadow = true;
    group.add(wall);
  }
}

/**
 * Denah papan (lokal papan: X sepanjang papan, −Z = depan) di bidang bentuk XY; y bentuk = −z denah karena
 * ExtrudeGeometry diputar rotateX(−π/2). Busur cekung ke depan (pusat (0, −R)), tebal ke belakang.
 */
function papanShape(w, R, t) {
  const half = Math.asin(w / 2 / R);
  const n = 24;
  const shape = new THREE.Shape();
  for (let i = 0; i <= n; i += 1) {
    const a = -half + (2 * half * i) / n;
    const x = R * Math.sin(a);
    const y = R - R * Math.cos(a);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = n; i >= 0; i -= 1) {
    const a = -half + (2 * half * i) / n;
    shape.lineTo((R + t) * Math.sin(a), R - (R + t) * Math.cos(a));
  }
  shape.closePath();
  return shape;
}

/** N01 placeholder: papan batu lengkung + alas beton + huruf kuningan melengkung. */
function papanBatu(env) {
  const p = LAYOUT.papanBatu;
  const { R, tebal, huruf } = DANAU.papan;
  const g = new THREE.Group();
  g.name = 'N01';
  g.position.set(p.x, env.hAt(p.x, p.z), p.z);
  g.rotation.y = p.yaw;
  const alas = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.4, 0.2, 1.4), MATS.beton());
  alas.position.set(0, 0.1, -0.05);
  alas.receiveShadow = true;
  alas.name = 'N01alas';
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(papanShape(p.w, R, tebal), { depth: p.h - 0.2, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2),
    MATS.batu(),
  );
  body.position.y = 0.2;
  body.castShadow = true;
  body.receiveShadow = true;
  body.name = 'N01batu';
  const strip = new THREE.PlaneGeometry(4.9, 0.42, 32, 1).rotateY(Math.PI);
  const pos = strip.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const a = pos.getX(i) / R;
    pos.setX(i, R * Math.sin(a));
    pos.setZ(i, -R + R * Math.cos(a) - 0.03);
  }
  strip.computeVertexNormals();
  const letters = new THREE.Mesh(strip, reliefTextMaterial('unri-rektorat:N01', huruf, { color: '#c9a24a' }));
  letters.position.y = 1.05;
  letters.name = 'N01huruf';
  g.add(alas, body, letters);
  return g;
}

/** Titian: lantai beton 2 m sepanjang way OSM + sandaran & tiang besi + kepala jembatan di kedua ujung. */
function titian(group, env) {
  const [[ax, az], [bx, bz]] = TITIAN;
  const len = Math.hypot(bx - ax, bz - az);
  const top = Math.max(env.hAt(ax, az), env.hAt(bx, bz)) + 0.35;
  const g = new THREE.Group();
  g.name = 'titianDanau';
  g.position.set((ax + bx) / 2, 0, (az + bz) / 2);
  g.rotation.y = Math.atan2(bx - ax, bz - az); // sumbu panjang titian = +Z lokal
  addBox(g, MATS.beton(), [-1.0, 1.0], [top - 0.3, top], [-len / 2 - 0.5, len / 2 + 0.5], { name: 'titianLantai' });
  for (const sx of [-1, 1]) {
    addBox(g, MATS.parapet(), [sx * 0.95 - 0.04, sx * 0.95 + 0.04], [top + 0.95, top + 1.0], [-len / 2, len / 2], { cast: false, name: 'titianSandaran' });
    for (let z = -len / 2; z <= len / 2 + 1e-6; z += 1.5) {
      addBox(g, MATS.parapet(), [sx * 0.95 - 0.03, sx * 0.95 + 0.03], [top, top + 0.95], [z - 0.03, z + 0.03], { cast: false, name: 'titianTiang' });
    }
  }
  for (const z of [-len / 2, len / 2]) addBox(g, MATS.beton(), [-1.1, 1.1], [top - 2.0, top - 0.3], [z - 0.3, z + 0.3], { name: 'titianKepala' });
  group.add(g);
}

/** @returns {{raw: THREE.Group, placeholders: THREE.Group}} */
export function buildDanau(env) {
  const raw = new THREE.Group();
  raw.name = 'danauRektorat';
  batuPijakan(raw, env);
  trotoarDanau(raw, env);
  titian(raw, env);
  const placeholders = new THREE.Group();
  placeholders.name = 'danauPlaceholder';
  placeholders.add(papanBatu(env));
  return { raw, placeholders };
}
```

- [ ] **Step 2: Smoke Node (jumlah batu = layout; papan menghadap timur)**

Run:
```bash
node --input-type=module -e "
import * as THREE from 'three';
import { withScope, createResourceScope } from './src/engine/ResourceScope.js';
import { buildDanau, waterLevel } from './src/regions/unri-rektorat/danau.js';
import { LAYOUT } from './src/regions/unri-rektorat/layout.js';
const field = { heightAt: () => 0 };
const env = { field, hAt: (x, z) => (Math.hypot(x - 230, z - 30) < 20 ? -1.5 : 0) };
const d = withScope(createResourceScope('uji'), () => buildDanau(env));
const stones = d.raw.children.filter((c) => c.name === 'batuPijakan');
const n01 = d.placeholders.getObjectByName('N01');
n01.updateMatrixWorld(true);
const front = new THREE.Vector3(0, 0, -1).transformDirection(n01.matrixWorld);
console.log('muka', waterLevel(env).toFixed(2), 'batu', stones.length, '=', LAYOUT.batuPijakan.length, 'depan', front.x.toFixed(2), front.z.toFixed(2));
"
```
Expected: `muka -1.90 batu 17 = 17 depan 1.00 0.00` (tanda nol boleh `-0.00`; jumlah batu = layout; depan papan = +X/timur). `drapePolyline` M2 dipanggil dengan field datar — bila M2 mensyaratkan metode lain dari field (mis. `normalAt`), tambahkan ke `field` di perintah ini saja.

- [ ] **Step 3: Lint & commit**

Run: `npm run lint` → 0 galat.

```bash
git add src/regions/unri-rektorat/danau.js
```
```bash
git commit -m "feat(unri-rektorat): danau (batu pijakan beton, trotoar tinggi, papan batu lengkung N01 placeholder)"
```

---

## Task 12: Taman bundaran (`bundaran.js`)

**Files:**
- Create: `src/regions/unri-rektorat/bundaran.js`

- [ ] **Step 1: Buat `bundaran.js`**

```js
// src/regions/unri-rektorat/bundaran.js
/**
 * Taman tengah Putaran Jl. Mukhtar Luthfi / Depan Rektorat (OSM way 327363975): putaran-U mengelilingi
 * ujung timur danau; daratan di dalamnya = bulan sabit berumput dengan kerb beton rendah [T geometri OSM;
 * isi taman INFERENSI: rumput, palem pengapit papan batu N01, PJU — palem & PJU dari LAYOUT/porosTaman].
 */
import * as THREE from 'three';
import { LAYOUT } from './layout.js';
import { MATS } from './materials.js';
import { drapePolygonLocal, kerbWall } from './env.js';

/** @returns {THREE.Group} raw statis (digabung oleh index.js) */
export function buildBundaran(env) {
  const g = new THREE.Group();
  g.name = 'bundaranPutaran';
  const ring = LAYOUT.tamanBundaran;
  const lawn = new THREE.Mesh(drapePolygonLocal(env, ring, { lift: 0.05, maxEdge: 2 }), MATS.rumput());
  lawn.name = 'rumput';
  lawn.receiveShadow = true;
  const kerb = new THREE.Mesh(kerbWall(env, [...ring, ring[0]], 0, 0.15, 1.5), MATS.betonDS());
  kerb.name = 'kerb';
  kerb.receiveShadow = true;
  g.add(lawn, kerb);
  return g;
}
```

- [ ] **Step 2: Lint & commit**

Run: `npm run lint` → 0 galat.

```bash
git add src/regions/unri-rektorat/bundaran.js
```
```bash
git commit -m "feat(unri-rektorat): taman tengah putaran Jl. Mukhtar Luthfi (drape rumput + kerb)"
```

---

## Task 13: Proxy region ≤ 8 draw call (`proxy.js`)

**Files:**
- Create: `src/regions/unri-rektorat/proxy.js`

- [ ] **Step 1: Buat `proxy.js`**

```js
// src/regions/unri-rektorat/proxy.js
/**
 * Proxy region unri-rektorat (spec §4.3): siluet murah saat region TIDAK terpasang, 7 draw call (≤ 8):
 * putih (massa Rektorat + perpustakaan), pita jendela gelap, parapet gelap, kaca biru blok tengah, atap
 * perpustakaan, kanopi merah, tajuk akasia. y dari terrain saat proxy dibangun (chunk jauh belum termuat
 * → 0; selisih ±2 m tak terlihat di > 700 m).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createResourceScope, withScope } from '../../engine/ResourceScope.js';
import { disposeTree } from '../../engine/disposeTree.js';
import { REKTORAT_MASSA, PERPUS_MASSA } from './site.data.js';
import { LAYOUT } from './layout.js';
import { REKTORAT_PLACEMENT as P, REKTORAT_ID } from './placement.js';
import { createSiteEnv } from './env.js';
import { ROOF_Y, LEVEL, floorY } from './rektorat.js';

export const PROXY_MAX_DRAWS = 8;

const boxGeo = ([x0, x1], [y0, y1], [z0, z1]) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const pyramidGeo = (cx, cz, w, d, y, h) => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0).scale(w, h, d).translate(cx, y, cz);
const boundsOf = (ring) => {
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  return [[Math.min(...xs), Math.max(...xs)], [Math.min(...zs), Math.max(...zs)]];
};

function merged(geos, color, name) {
  const g = mergeGeometries(geos, false);
  geos.forEach((x) => x.dispose());
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
  mesh.name = name;
  return mesh;
}

function buildProxyGroup(env) {
  const { slab: S, tengah: T, kanopi: K } = REKTORAT_MASSA;
  const y0 = env.hAt(0, 0);
  const yp = env.hAt(-113, -62);
  const putih = [
    boxGeo([S.x0, S.x1], [y0, y0 + ROOF_Y], [S.z0, S.z1]),
    boxGeo([T.x0 - 0.3, T.x1], [y0, y0 + ROOF_Y + LEVEL.atik], [T.z0, T.z1]),
    ...PERPUS_MASSA.kuadran.map((r) => { const [xr, zr] = boundsOf(r); return boxGeo(xr, [yp, yp + 7.6], zr); }),
    ...PERPUS_MASSA.penghubung.map((r) => boxGeo([r.x0, r.x1], [yp, yp + 7.6], [r.z0, r.z1])),
  ];
  const pita = Array.from({ length: LEVEL.jumlah }, (_, k) => {
    const y = y0 + floorY(k) + 0.9;
    return boxGeo([S.x0 - 0.05, S.x1 + 0.05], [y, y + (k === 0 ? 2.6 : 2.1)], [S.z0 - 0.05, S.z1 + 0.05]);
  });
  const parapet = [boxGeo([S.x0 - 0.05, S.x1 + 0.05], [y0 + ROOF_Y, y0 + ROOF_Y + LEVEL.parapet], [S.z0 - 0.05, S.z1 + 0.05])];
  const kaca = [boxGeo([T.x1, T.x1 + 0.2], [y0 + floorY(1), y0 + ROOF_Y], [T.z0 + 0.6, T.z1 - 0.6])];
  const atapPerpus = PERPUS_MASSA.kuadran.map((r) => {
    const [[x0, x1], [z0, z1]] = boundsOf(r);
    return pyramidGeo((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 1.6, z1 - z0 + 1.6, yp + 7.6, 3.0);
  });
  const kanopi = [pyramidGeo((K.x0 + K.x1) / 2, 0, K.x1 - K.x0 + 1.6, K.z1 - K.z0 + 1.6, y0 + 3.75, 1.6)];
  const pohon = LAYOUT.akasia.map((p) => new THREE.ConeGeometry(2.0 * p.scale, 9 * p.scale, 6).translate(p.x, env.hAt(p.x, p.z) + 13 * p.scale, p.z));
  const group = new THREE.Group();
  group.name = `proxy:${REKTORAT_ID}`;
  group.add(
    merged(putih, 0xf1efe9, 'proxyPutih'),
    merged(pita, 0x26364a, 'proxyPita'),
    merged(parapet, 0x3d4148, 'proxyParapet'),
    merged(kaca, 0x3b78b8, 'proxyKacaBiru'),
    merged(atapPerpus, 0x7d8a96, 'proxyAtapPerpus'),
    merged(kanopi, 0xb3282d, 'proxyKanopi'),
    merged(pohon, 0x4d6a33, 'proxyPohon'),
  );
  return group;
}

/**
 * @param {{scope?: object, terrain?: object, heightAtLocal?: Function}} [ctx]
 * @returns {{group: THREE.Group, dispose(): void}}
 */
export function createRektoratProxy(ctx = {}) {
  const ownScope = !ctx.scope;
  const scope = ctx.scope ?? createResourceScope(`proxy:${REKTORAT_ID}`);
  const env = createSiteEnv(ctx);
  const group = withScope(scope, () => buildProxyGroup(env));
  group.position.set(P.x, 0, P.z); // idempoten dengan applyPlacement manager (yaw 0)
  return {
    group,
    dispose() {
      group.removeFromParent();
      disposeTree(group, { scope });
      if (ownScope) scope.dispose();
    },
  };
}
```

- [ ] **Step 2: Lint & commit**

Run: `npm run lint` → 0 galat.

```bash
git add src/regions/unri-rektorat/proxy.js
```
```bash
git commit -m "feat(unri-rektorat): proxy siluet 7 draw call saat region tidak terpasang"
```

---

## Task 14: Definisi region + perakitan bertahap (`index.js`) dan tes build

**Files:**
- Create: `src/regions/unri-rektorat/index.js`
- Test: `tests/unri/rektoratRegion.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
// tests/unri/rektoratRegion.test.js
import { describe, it, expect, vi } from 'vitest';
import { unriRektoratRegion, REKTORAT_DRAW_BUDGET, rektoratNightLights } from '../../src/regions/unri-rektorat/index.js';
import { PROXY_MAX_DRAWS } from '../../src/regions/unri-rektorat/proxy.js';
import { createResourceScope } from '../../src/engine/ResourceScope.js';
import { createRegionFrame } from '../../src/geo/regionTransform.js';
import { regionContains } from '../../src/regions/Region.js';

const flat = Object.freeze({ heightAt: () => 0, version: 0 });
const countDraws = (root) => {
  let n = 0;
  root.traverse((o) => { if (o.isMesh && o.visible) n += 1; });
  return n;
};

describe('region unri-rektorat', () => {
  it('definisi: aktivasi, pad, POV, proxy; mask memuat Rektorat & danau', () => {
    const r = unriRektoratRegion;
    expect(r.id).toBe('unri-rektorat');
    expect(r.activation.mountRadius).toBe(700);
    expect(r.pads).toHaveLength(3);
    expect(r.povs.map((p) => p.id)).toEqual(['rektorat-poros', 'danau-udara']);
    expect(typeof r.proxy).toBe('function');
    expect(regionContains(r, -984.0, 800.1)).toBe(true);
    expect(regionContains(r, -769.7, 837.4)).toBe(true);
    expect(regionContains(r, 0, 0)).toBe(false);
  });

  it('build tanpa scheduler: ready, kontrak lengkap, ≤ 250 objek gambar, placeholder N01–N03, dispose bersih', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scope = createResourceScope('uji:unri-rektorat');
    const region = await unriRektoratRegion.build({ scope, terrain: flat, loadModels: false });
    await region.ready;
    expect(region.group.userData.ready).toBe(true);
    const draws = countDraws(region.group);
    expect(draws).toBeGreaterThan(20);
    expect(draws).toBeLessThanOrEqual(REKTORAT_DRAW_BUDGET);
    for (const id of ['N01', 'N02', 'N03']) expect(region.group.getObjectByName(id), id).toBeTruthy();
    expect(region.nightLights.lamps).toHaveLength(16);
    expect(region.colliders.isWalkable(150, 4.2)).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    region.dispose();
    expect(scope.disposed).toBe(true);
    expect(region.group.parent).toBe(null);
    warn.mockRestore();
  });

  it('dispose sebelum perakitan selesai: ready selesai sebagai dibatalkan, tidak melempar', async () => {
    const scope = createResourceScope('uji:batal');
    const region = await unriRektoratRegion.build({ scope, terrain: flat, loadModels: false });
    region.dispose();
    await expect(region.ready).resolves.toMatchObject({ cancelled: true });
  });

  it('proxy ≤ 8 draw call, dispose melepas scope sendiri', () => {
    const p = unriRektoratRegion.proxy({ terrain: flat });
    expect(countDraws(p.group)).toBeLessThanOrEqual(PROXY_MAX_DRAWS);
    expect(p.group.position.x).toBeCloseTo(-985.8, 6);
    p.dispose();
  });

  it('POV: pose dunia berangka hingga', () => {
    const frame = createRegionFrame(unriRektoratRegion.placement);
    for (const pov of unriRektoratRegion.povs) {
      const out = pov.pose(frame, { terrain: flat });
      for (const k of ['px', 'py', 'pz', 'tx', 'ty', 'tz', 'fov']) expect(Number.isFinite(out[k]), `${pov.id}.${k}`).toBe(true);
    }
  });

  it('lampu malam dunia = PJU layout + placement', () => {
    const { lamps } = rektoratNightLights();
    expect(lamps[0].x).toBeCloseTo(31.0 - 985.8, 9);
    expect(lamps[0].z).toBeCloseTo(-30 + 800, 9);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/rektoratRegion.test.js`
Expected: FAIL — modul `index.js` tidak ditemukan.

- [ ] **Step 3: Buat `index.js`**

```js
// src/regions/unri-rektorat/index.js
/**
 * Region handmade "unri-rektorat" (M6, spec §8.3): Gedung Rektorat (H04) + kanopi merah (N03) + huruf
 * puncak (N02), taman depan & tiang bendera, poros taman (akasia ramping + palem + bangku + PJU), Danau
 * Buatan (air dari distrik; batu pijakan, papan batu N01, trotoar tinggi), taman Putaran Jl. Mukhtar
 * Luthfi, Perpustakaan lama (4 massa 2 lt). build() cepat (< 30 ms): perakitan bertahap lewat ctx.schedule
 * setelah chunk terrain mask termuat; konten statis digabung per material (budget ≤ 250 draw call).
 * `ready` selesai setelah antrean + model GLB N01–N03 (gagal → placeholder prosedural tetap, spec §10).
 */
import * as THREE from 'three';
import { defineRegion, validateBuild } from '../Region.js';
import { disposeTree } from '../../engine/disposeTree.js';
import { withScope } from '../../engine/ResourceScope.js';
import { createModelGroup, placeModels } from '../../world/assets/models.js';
import { mergeByMaterial } from '../../world/util/merge.js';
import { REKTORAT_ID, REKTORAT_PLACEMENT, REKTORAT_ACTIVATION } from './placement.js';
import { REKTORAT_MASK } from './mask.js';
import { REKTORAT_PADS } from './pads.js';
import { LAYOUT } from './layout.js';
import { rektoratColliders } from './collider.js';
import { createSiteEnv, waitForTerrain } from './env.js';
import { runStaged, freezeSubtree } from './staged.js';
import { buildRektorat, buildRektoratGround, ROOF_Y, LEVEL } from './rektorat.js';
import { buildPerpustakaan } from './perpustakaan.js';
import { buildPorosTaman } from './porosTaman.js';
import { buildDanau } from './danau.js';
import { buildBundaran } from './bundaran.js';
import { createRektoratProxy } from './proxy.js';

export { REKTORAT_ID, REKTORAT_PLACEMENT };
/** Budget draw call region hero aktif (spec §9.1). */
export const REKTORAT_DRAW_BUDGET = 250;
const EMPTY_RESULT = Object.freeze({ placed: 0, failed: [], replaced: [] });

/** Model GLB final (Blender) N01–N03, region-lokal; `replaces` = nama grup placeholder prosedural. */
export function rektoratModelItems(env) {
  const pb = LAYOUT.papanBatu;
  const y0 = env.hAt(0, 0);
  return [
    { path: 'models/unri/n02-huruf-nama-rektorat.glb', x: 17.55, y: y0 + ROOF_Y + LEVEL.atik / 2 - 0.75, z: 0, rotY: -Math.PI / 2, replaces: 'N02' },
    { path: 'models/unri/n03-kanopi-merah-rektorat.glb', x: 21.7, y: y0, z: 0, rotY: 0, replaces: 'N03' },
    { path: 'models/unri/n01-papan-batu-unri.glb', x: pb.x, y: env.hAt(pb.x, pb.z), z: pb.z, rotY: pb.yaw, replaces: 'N01' },
  ];
}

/** Lampu malam (DUNIA) untuk TimeOfDay.registerLamps: semua PJU region. */
export function rektoratNightLights(layout = LAYOUT) {
  return {
    lamps: layout.pju.map((p) => ({ x: p.x + REKTORAT_PLACEMENT.x, z: p.z + REKTORAT_PLACEMENT.z })),
    floods: [],
  };
}

/** Material GLB bernama "…emisif" menyala malam lewat registry TimeOfDay (tidak bercahaya siang). */
function tagNightMaterials(root) {
  root.traverse((o) => {
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m?.isMaterial || !/emisif/i.test(m.name ?? '') || !m.emissive) continue;
      if (m.emissive.getHex() === 0) m.emissive.setHex(0xffe2b0);
      m.emissiveIntensity = 0;
      m.userData.nightEmissive = { on: 1.3, off: 0 };
    }
  });
}

/** Gabung konten statis per material; geometri sumber yang tak terpakai lagi & tak dimiliki scope dilepas. */
function mergeRaw(raw, scope) {
  const merged = mergeByMaterial(raw);
  merged.name = 'rektoratStatis';
  const live = new Set();
  merged.traverse((o) => { if (o.geometry) live.add(o.geometry); });
  raw.traverse((o) => {
    const g = o.geometry;
    if (g?.isBufferGeometry && !live.has(g) && !scope.owns(g)) g.dispose();
  });
  raw.clear();
  return merged;
}

const POV_DEFS = Object.freeze([
  Object.freeze({ id: 'rektorat-poros', label: 'Rektorat dari poros taman', eye: [125, 9, 4.2], target: [12, 11, 0], fov: 50 }),
  Object.freeze({ id: 'danau-udara', label: 'Danau Buatan (udara)', eye: [330, 70, -70], target: [215, 0, 40], fov: 55 }),
]);

function poseOf(def, frame, ctx, out) {
  const e = frame.toWorld(def.eye[0], def.eye[2]);
  const t = frame.toWorld(def.target[0], def.target[2]);
  const h = (p) => ctx?.terrain?.heightAt?.(p.x, p.z) ?? 0;
  return Object.assign(out, { px: e.x, py: h(e) + def.eye[1], pz: e.z, tx: t.x, ty: h(t) + def.target[1], tz: t.z, fov: def.fov });
}

/** POV milik region (spec §4.3): pose(frame, ctx, out?) → {px,py,pz,tx,ty,tz,fov} dunia. */
export const REKTORAT_POVS = Object.freeze(POV_DEFS.map((d) => Object.freeze({
  id: d.id, label: d.label, pose: (frame, ctx, out = {}) => poseOf(d, frame, ctx, out),
})));

function buildRektoratRegion(ctx) {
  const { scope } = ctx;
  if (!scope) throw new TypeError('Region unri-rektorat: ctx.scope (ResourceScope) wajib');
  const env = createSiteEnv(ctx);
  const root = new THREE.Group();
  root.name = `region:${REKTORAT_ID}`;
  root.userData.ready = false;
  const content = new THREE.Group();
  content.name = 'rektoratKonten';
  root.add(content);
  const models = createModelGroup();
  content.add(models);
  const raw = new THREE.Group(); // tidak dipasang ke scene: digabung per material di langkah terakhir
  raw.name = 'rektoratMentah';
  const attach = (obj) => {
    content.add(obj);
    freezeSubtree(obj);
  };
  const steps = [
    () => raw.add(buildRektoratGround(env)),
    () => { const r = buildRektorat(env); raw.add(r.raw); attach(r.placeholders); },
    () => raw.add(buildPerpustakaan(env, scope)),
    () => { const p = buildPorosTaman(env); raw.add(p.raw); attach(p.instanced); },
    () => { const d = buildDanau(env); raw.add(d.raw); attach(d.placeholders); },
    () => raw.add(buildBundaran(env)),
    () => attach(mergeRaw(raw, scope)),
  ];
  let disposed = false;
  let run = null;
  const isCancelled = () => disposed;
  const ready = waitForTerrain(env)
    .then(() => {
      if (disposed) return false;
      run = runStaged({ steps, scope, schedule: ctx.schedule ?? null, isCancelled });
      return run.promise;
    })
    .then((ok) => {
      if (!ok || disposed || ctx.loadModels === false) return { ...EMPTY_RESULT, cancelled: !ok || disposed };
      return withScope(scope, () => placeModels(models, rektoratModelItems(env), { world: content, isCancelled }))
        .then((res) => {
          tagNightMaterials(models);
          return res;
        });
    })
    .catch((err) => {
      console.error('Region unri-rektorat: perakitan gagal, konten parsial dipertahankan:', err);
      return { ...EMPTY_RESULT, failed: [{ path: 'region:unri-rektorat', error: String(err?.message ?? err) }], cancelled: false };
    })
    .then((res) => {
      if (!disposed) root.userData.ready = true;
      return res;
    });

  return validateBuild({
    group: root,
    colliders: rektoratColliders,
    minimapLayer: () => {}, // peta dasar region di-bake per region oleh M0 (Minimap2D.setBaseLayer)
    systems: [],
    nightLights: rektoratNightLights(),
    lateRoot: content,
    lateRootWet: true, // overlay paving/rumput/trotoar datang bertahap → registry basah setelah ready (Task 15)
    layout: LAYOUT,
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      run?.cancel();
      root.removeFromParent();
      disposeTree(raw, { scope });
      disposeTree(root, { scope });
      scope.dispose();
    },
  }, REKTORAT_ID);
}

export const unriRektoratRegion = defineRegion({
  id: 'unri-rektorat', // = REKTORAT_ID; literal agar grep plan M7 (Task 0 Step 5) menemukannya
  placement: REKTORAT_PLACEMENT,
  mask: REKTORAT_MASK,
  activation: REKTORAT_ACTIVATION,
  pads: REKTORAT_PADS,
  povs: REKTORAT_POVS,
  proxy: (ctx) => createRektoratProxy(ctx ?? {}),
  build: async (ctx) => buildRektoratRegion(ctx ?? {}),
});
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/rektoratRegion.test.js`
Expected: PASS (6 tes). Bila tes kedua gagal di `warn` dengan pesan "Perpustakaan …", kembali ke Task 9 Step 2. Bila `draws` > 250: cetak nama mesh per material (`region.group.traverse`) — mesh mentah tidak boleh ikut terpasang (langkah `mergeRaw` harus menghasilkan `rektoratStatis`).

- [ ] **Step 5: Seluruh tes unri + lint**

Run: `node node_modules/vitest/vitest.mjs run tests/unri` lalu `npm run lint`
Expected: semua PASS, lint 0 galat.

- [ ] **Step 6: Commit**

```bash
git add src/regions/unri-rektorat/index.js tests/unri/rektoratRegion.test.js
```
```bash
git commit -m "feat(unri-rektorat): definisi region (aktivasi, pad, POV, proxy), perakitan bertahap + gabung per material, model N01-N03"
```

---
## Task 15: Pasang region — main.js (register + isReserved distrik), pad campusbake, registry basah, bake terrain

**Files:**
- Modify: `src/main.js`
- Modify: `tools/campusbake/config.js`
- Modify (bersyarat): `src/app/districtMount.js`, `src/app/mountRegion.js`
- Regenerate: `public/districts/unri/terrain/*.bin`, `public/districts/unri/manifest.json`

- [ ] **Step 1: Daftarkan region di `src/main.js`**

Tambahkan impor di blok impor region (dekat impor region `unri-lembaga` dari M4):
```js
import { unriRektoratRegion } from './regions/unri-rektorat/index.js';
```
Lalu tepat SETELAH baris `regionManager.register(<region unri-lembaga>);` (tambahan M4) tambahkan:
```js
regionManager.register(unriRektoratRegion);
```
Run: `grep -n "register(" src/main.js`
Expected: tiga baris register (stadion, unri-lembaga, unri-rektorat), berurutan.

- [ ] **Step 2: Distrik tidak menaruh vegetasi/PJU/bangku di dalam mask region hero (`isReserved`, Serah terima M2 butir 6)**

Run: `grep -n "isReserved" src/main.js src/app/districtMount.js`
- Bila `main.js` sudah meneruskan `isReserved` yang dibangun dari daftar region hero (mis. `heroRegions.some(...)`): pastikan `unriRektoratRegion` ada di daftar itu, lalu lanjut ke Step 3.
- Bila belum ada sama sekali: di `src/main.js` tambahkan impor `import { regionContains } from './regions/Region.js';` (bila belum), lalu tepat sebelum pemanggilan `mountDistrict(app, unriDistrict, { … })` tambahkan (ganti `unriLembagaRegion` dengan nama ekspor definisi region M4 yang dicatat di Task 0):
```js
  // Region hero kampus punya isi sendiri: distrik tidak menaruh vegetasi/PJU/bangku/rintangan di dalam mask-nya (M2).
  const heroRegions = [unriLembagaRegion, unriRektoratRegion];
  const isReserved = (x, z) => heroRegions.some((def) => regionContains(def, x, z));
```
  dan tambahkan `isReserved,` ke objek opsi `mountDistrict(app, unriDistrict, { … })`. Bila `src/app/districtMount.js` belum meneruskan opsi itu ke `def.build(ctx)`, tambahkan pada objek ctx build di sana: `isReserved: opts.isReserved ?? (() => false),` (nama variabel opsi mengikuti M1).

Run: `grep -n "isReserved" src/main.js src/app/districtMount.js`
Expected: definisi `heroRegions`/`isReserved` di main.js, opsi di pemanggilan `mountDistrict`, dan penerusan ke ctx di districtMount.js. (M7 memakai nama `heroRegions` yang sama — M7 cukup memakai ulang konstanta ini.)

- [ ] **Step 3: Pad region di `tools/campusbake/config.js`**

Run: `grep -n "REGION_PADS\|lembagaPadsWorld" tools/campusbake/config.js`
Expected (hasil M4): `export const REGION_PADS = Object.freeze([...lembagaPadsWorld()]);`. Tambahkan impor murni (TANPA index.js agar campusbake tidak memuat three):
```js
import { rektoratPadsWorld } from '../../src/regions/unri-rektorat/pads.js';
```
dan ubah definisinya menjadi:
```js
/** Pad hero region (spec §3.2): ring DUNIA {id, ring, y:'median'|number} — unri-lembaga (M4) + unri-rektorat (M6). */
export const REGION_PADS = Object.freeze([...lembagaPadsWorld(), ...rektoratPadsWorld()]);
```
(Bila M4 memakai nama konstanta lain, pakai nama itu; isinya tetap gabungan dua daftar di atas.)

- [ ] **Step 4 (bersyarat): registry basah untuk konten region yang datang bertahap**

Run: `grep -n "lateRoot" src/app/mountRegion.js`
Plan M0 hanya mendaftarkan emisif `lateRoot` setelah `ready`. Bila belum ada pemanggilan `weather.registerWet(region.lateRoot)`, di dalam blok `const ready = Promise.resolve(region.ready).then(async (result) => {` tambahkan tepat setelah baris registrasi emisif `lateRoot`:
```js
    if (mounted && weather && region.lateRoot && region.lateRootWet === true) undo.push(weather.registerWet(region.lateRoot));
```
(Bendera `lateRootWet` membuat region stadion — lateRoot-nya hanya GLB — dan region M4 tidak berubah perilaku; paritas M0 aman.)

Run: `node node_modules/vitest/vitest.mjs run tests/mountRegion.test.js`
Expected: PASS (tes lama tidak terpengaruh).

- [ ] **Step 5: Bake terrain dengan pad baru**

Run: `npm run bake:campus -- terrain --offline`
Expected: laporan bake tanpa galat dan memuat 3 pad `unri-rektorat:*` (rektorat, perpustakaan, papan-batu) selain 3 pad `unri-lembaga:*`; `git status --short public/districts/unri/` menampilkan `terrain/-3_1.bin` dan/atau `terrain/-2_1.bin` sebagai modified.

Bila tes golden campusbake (nama dicatat M4 Task 0/A6) gagal hanya karena pad baru: perbarui golden memakai prosedur di kepala tes itu, lalu sebut di pesan commit.

- [ ] **Step 6: Smoke di dev server**

Run: `preview_start` nama `stadion-dev` (atau `npm run dev`), buka `http://localhost:5173`, mulai permainan, lalu di konsol:
```js
__sim.teleport(-900, 803, -Math.PI / 2);
await new Promise((r) => setTimeout(r, 15000));
const g = __sim.app.scene.getObjectByName('region:unri-rektorat');
[Boolean(g), g?.userData.ready, g?.getObjectByName('rektoratStatis')?.children.length]
```
Expected: `[true, true, <angka 20–80>]`, tanpa galat merah di konsol; gedung putih bersayap pita gelap dengan blok tengah kaca biru di barat, kanopi merah di depannya, poros berpohon di timur, dan TIDAK ada pohon distrik (mahoni/angsana) di median poros atau di taman putaran.

- [ ] **Step 7: Tes penuh, lint, commit**

Run: `npm test` lalu `npm run lint`
Expected: PASS semua, 0 galat.

```bash
git add src/main.js src/app/districtMount.js tools/campusbake/config.js src/app/mountRegion.js public/districts/unri
```
```bash
git commit -m "feat(unri-rektorat): daftarkan region, reservasi mask region hero untuk distrik, pad terrain campusbake, registry basah konten bertahap; bake terrain"
```
(File bersyarat yang tidak berubah aman ikut `git add`.)

---

## Task 16: Hero H05 Masjid Arfa'unnas (`masjidArfaunnas.js`)

**Files:**
- Create: `src/world/kit/hero/masjidArfaunnas.js`

- [ ] **Step 1: Buat `masjidArfaunnas.js`**

```js
// src/world/kit/hero/masjidArfaunnas.js
/**
 * Hero H05 Masjid Arfa'unnas UNRI (OSM way 282230716 "Masjid Ar-Faunas", levels 2, roof=concrete).
 * Rujukan [T]: foto 2023 Commons "Masjid_Arfaunnas_unri.jpg" (CC BY-SA 4.0) — dinding krem/kuning gading,
 * list oker-emas, lengkung ogee berulang di serambi atas & bawah, tangga besar keramik putih langsung ke
 * lt 2, kubah bermozaik ubin putih-ungu/biru pola wajik, mahkota bulan sabit, toa, huruf timbul
 * "MASJID ARFA' UNNAS UNIVERSITAS RIAU", motor parkir di pelataran aspal. Ruang salat 27 × 27 m, 2 lt
 * (arfaunnas.unri.ac.id) [T]; massa bawah mengikuti OSM 37,6 × 30,5 m; tonjolan utara OSM 6,6 × 9 m = tangga.
 * [INFERENSI]: tinggi lantai, jumlah bay, ukuran kubah (katalog N04 Ø10 m), posisi toa & huruf, warna huruf.
 * Hero-lokal: origin = pusat massa di tanah pad, +X ≈ timur, +Z ≈ selatan; fasad tangga = −Z (utara).
 */
import * as THREE from 'three';
import { surfaceMaps } from '../../textures/surfaces.js';
import { hasDocument } from '../../siteutil/textCanvas.js';
import { createHeroFrame, heroMaterial, heroGeometry, heroBaseY, groundGrid, local, named, PLINTH } from './heroFrame.js';
import { reliefTextParts } from './reliefText.js';
import { markPlaceholder } from './ornaments.js';

/** Pusat & arah massa dari ring OSM (rata-rata 4 sudut; yaw = rata-rata kemiringan 4 sisi, −3,47°). */
export const MASJID_SITE = Object.freeze({ id: 'w282230716', x: -1009.83, z: 1374.65, yaw: -0.0605 });

export const MASJID = Object.freeze({
  w: 37.6, d: 30.5, inti: 27, serambi: 2.4,
  plint: 0.45, lt1: 4.2, lt2: 5.4, pelat: 0.35, parapet: 1.0, tebal: 0.35,
  baysUS: 11, baysBT: 9, baysInti: 9,
  tangga: Object.freeze({ x: 0.1, w: 6.6, zUjung: -25.25, bordes: 1.0, anak: 26 }),
  kubah: Object.freeze({ drumR: 5.2, drumH: 2.6, h: 5.9, segmen: 40 }),
  pelataran: Object.freeze({ x0: -18, x1: 18, z0: -42, z1: -26.3 }),
  baris: Object.freeze([-30.5, -37.5]),
  huruf: "MASJID ARFA' UNNAS UNIVERSITAS RIAU",
  warna: Object.freeze({ krem: 0xefe3c2, oker: 0xc8962e, keramik: 0xf4f2ee, gelap: 0x1d1f24, dalam: 0x141418, marka: 0xf2f2ee, toa: 0xc9ccd0, emas: 0xd4a73a, mozaik: 0x6f6aa8 }),
});
const HW = MASJID.w / 2;       // 18,8
const HD = MASJID.d / 2;       // 15,25
const Y1 = MASJID.plint;       // 0,45 lantai bawah
const Y2 = Y1 + MASJID.lt1;    // 4,65 lantai atas
const YR = Y2 + MASJID.lt2;    // 10,05 bawah pelat atap
const YT = YR + MASJID.pelat;  // 10,4 atas pelat atap
/** Alas kubah N04 (atas drum), relatif tanah pad. */
export const DOME_BASE_Y = YT + MASJID.kubah.drumH; // 13,0
/** Profil kubah (r, y) sedikit runcing; tinggi 5,9 m. */
const DOME_PROFILE = Object.freeze([[5.0, 0], [4.95, 0.9], [4.75, 1.8], [4.35, 2.7], [3.7, 3.6], [2.85, 4.4], [1.8, 5.1], [0.8, 5.6], [0.0, 5.9]]);

/** Ornamen GLB distrik milik hero ini (dimuat src/app/heroOrnaments.js). */
export const MASJID_ORNAMENTS = Object.freeze([
  Object.freeze({ assetId: 'N04', hero: 'hero:masjid-arfaunnas', path: 'models/unri/n04-kubah-mozaik.glb', x: MASJID_SITE.x, z: MASJID_SITE.z, rotY: MASJID_SITE.yaw, yAboveGround: DOME_BASE_Y }),
]);

/** Tekstur mozaik wajik putih–ungu–biru dengan nat abu (sel 2×2, diulang 20 × 5 di kubah). Node → null. */
function mosaicTexture() {
  if (!hasDocument()) return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#f3f3f6';
  g.fillRect(0, 0, 256, 256);
  const diamond = (cx, cy, r, fill) => {
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r, cy);
    g.lineTo(cx, cy + r);
    g.lineTo(cx - r, cy);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  for (const [cx, cy] of [[0, 0], [256, 0], [0, 256], [256, 256], [128, 128]]) diamond(cx, cy, 60, '#3f62a8');
  for (const [cx, cy] of [[64, 64], [192, 192]]) diamond(cx, cy, 60, '#5a4c9c');
  g.strokeStyle = 'rgba(120,120,135,0.6)';
  g.lineWidth = 3;
  for (let i = -256; i <= 512; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 256, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(i, 256);
    g.lineTo(i + 256, 0);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(20, 5);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const W = MASJID.warna;
const M = {
  krem: () => heroMaterial('masjid:krem', () => named(new THREE.MeshLambertMaterial({ color: W.krem }), 'masjid:krem')),
  oker: () => heroMaterial('masjid:oker', () => named(new THREE.MeshStandardMaterial({ color: W.oker, roughness: 0.5, metalness: 0.25 }), 'masjid:oker')),
  keramik: () => heroMaterial('masjid:keramik', () => named(new THREE.MeshStandardMaterial({ color: W.keramik, roughness: 0.22, metalness: 0.02 }), 'masjid:keramik')),
  gelap: () => heroMaterial('masjid:gelap', () => named(new THREE.MeshLambertMaterial({ color: W.gelap }), 'masjid:gelap')),
  dalam: () => heroMaterial('masjid:dalam', () => named(new THREE.MeshLambertMaterial({ color: W.dalam, side: THREE.BackSide }), 'masjid:dalam')),
  aspal: () => heroMaterial('masjid:aspal', () => named(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, ...surfaceMaps('asphalt') }), 'masjid:aspal')),
  marka: () => heroMaterial('masjid:marka', () => named(new THREE.MeshLambertMaterial({ color: W.marka }), 'masjid:marka')),
  toa: () => heroMaterial('masjid:toa', () => named(new THREE.MeshLambertMaterial({ color: W.toa, side: THREE.DoubleSide }), 'masjid:toa')),
  kubah: () => markPlaceholder('N04', heroMaterial('masjid:kubah-mozaik', () => {
    const map = mosaicTexture();
    return named(new THREE.MeshStandardMaterial({ color: map ? 0xffffff : W.mozaik, map, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide }), 'masjid:kubah-mozaik');
  })),
  mahkota: () => markPlaceholder('N04', heroMaterial('masjid:mahkota', () => named(new THREE.MeshStandardMaterial({ color: W.emas, roughness: 0.3, metalness: 0.8 }), 'masjid:mahkota'))),
};

const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
};

/** Setengah kanan lengkung ogee (runcing berbentuk S): pangkal (w/2, hs) → puncak (0, ha). */
export function ogeeHalf(w, hs, ha, n = 10) {
  const r = ha - hs;
  const p0 = [w / 2, hs];
  const p1 = [w / 2, hs + 0.62 * r];
  const p2 = [w * 0.04, ha - 0.42 * r];
  const p3 = [0, ha];
  return Array.from({ length: n + 1 }, (_, i) => bez(p0, p1, p2, p3, i / n));
}

/** Kontur bukaan ogee: kiri-pangkal → puncak → kanan-pangkal. */
function ogeeArc(w, hs, ha) {
  const right = ogeeHalf(w, hs, ha);
  return [...right.map(([x, y]) => [-x, y]), ...right.slice(0, -1).reverse()];
}

/** Panel pier serambi (lebar bay bw, tinggi h) dengan bukaan ogee terbuka ke lantai; ekstrusi +Z sedalam `tebal`. */
function arcadeGeometry(bw, h, w, hs, ha) {
  return heroGeometry(`masjid:arkade:${bw.toFixed(3)}:${h}:${w.toFixed(3)}:${hs}:${ha}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-bw / 2, 0);
    s.lineTo(-w / 2, 0);
    for (const [x, y] of ogeeArc(w, hs, ha)) s.lineTo(x, y);
    s.lineTo(w / 2, 0);
    s.lineTo(bw / 2, 0);
    s.lineTo(bw / 2, h);
    s.lineTo(-bw / 2, h);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: MASJID.tebal, bevelEnabled: false, curveSegments: 1 });
  });
}

/** Panel dinding inti dengan jendela ogee (lubang) dari ambang `sill`. */
function windowPanelGeometry(bw, h, w, sill, hs, ha) {
  return heroGeometry(`masjid:jendela:${bw.toFixed(3)}:${h}:${w}:${sill}:${hs}:${ha}`, () => {
    const s = new THREE.Shape([new THREE.Vector2(-bw / 2, 0), new THREE.Vector2(bw / 2, 0), new THREE.Vector2(bw / 2, h), new THREE.Vector2(-bw / 2, h)]);
    const hole = new THREE.Path();
    hole.moveTo(-w / 2, sill);
    hole.lineTo(w / 2, sill);
    for (const [x, y] of [...ogeeArc(w, hs, ha)].reverse()) hole.lineTo(x, y);
    hole.closePath();
    s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth: MASJID.tebal, bevelEnabled: false, curveSegments: 1 });
  });
}

/** Empat sisi persegi (setengah lebar hw × setengah dalam hd): rotasi panel, rentang, titik muka luar, arah ke dalam. */
function sides(hw, hd) {
  return [
    { ry: 0, span: 2 * hw, at: (s) => [s, -hd], inward: [0, 1] },             // utara
    { ry: Math.PI, span: 2 * hw, at: (s) => [-s, hd], inward: [0, -1] },      // selatan
    { ry: -Math.PI / 2, span: 2 * hd, at: (s) => [hw, s], inward: [-1, 0] },  // timur
    { ry: Math.PI / 2, span: 2 * hd, at: (s) => [-hw, -s], inward: [1, 0] },  // barat
  ];
}

/** Pasang panel berulang di keempat sisi; geometri per sisi dari geoFor(lebarBay). */
function ring4(f, mat, { hw, hd, y, nUS, nBT, geoFor }) {
  sides(hw, hd).forEach((side, i) => {
    const n = i < 2 ? nUS : nBT;
    const bw = side.span / n;
    const geo = geoFor(bw);
    for (let k = 0; k < n; k += 1) {
      const [x, z] = side.at(-side.span / 2 + bw * (k + 0.5));
      f.add(geo, mat, local(x, y, z, { ry: side.ry }));
    }
  });
}

/** Kepala pier oker di ketinggian pangkal lengkung. */
function pierCaps(f, y) {
  sides(HW, HD).forEach((side, i) => {
    const n = i < 2 ? MASJID.baysUS : MASJID.baysBT;
    const bw = side.span / n;
    for (let k = 0; k <= n; k += 1) {
      const [x, z] = side.at(-side.span / 2 + bw * k);
      const cx = x + side.inward[0] * (MASJID.tebal / 2);
      const cz = z + side.inward[1] * (MASJID.tebal / 2);
      f.box(M.oker(), [cx - 0.42, cx + 0.42], [y - 0.16, y], [cz - 0.26, cz + 0.26], { ry: side.ry, castShadow: false });
    }
  });
}

/** List oker keliling setebal 0,14 m, menonjol `out` m dari muka massa. */
function band(f, y0, y1, out) {
  const ow = HW + out;
  const od = HD + out;
  const t = 0.14;
  f.box(M.oker(), [-ow, ow], [y0, y1], [-od, -od + t], { castShadow: false });
  f.box(M.oker(), [-ow, ow], [y0, y1], [od - t, od], { castShadow: false });
  f.box(M.oker(), [-ow, -ow + t], [y0, y1], [-od, od], { castShadow: false });
  f.box(M.oker(), [ow - t, ow], [y0, y1], [-od, od], { castShadow: false });
}

/** Plint & teras keramik, pelat lt 2 keramik, pelat atap, parapet krem bertutup oker, list oker. */
function slabs(f) {
  f.box(M.krem(), [-HW - 0.3, HW + 0.3], [0, Y1 - 0.02], [-HD - 0.3, HD + 0.3]);
  f.box(M.keramik(), [-HW - 0.3, HW + 0.3], [Y1 - 0.02, Y1], [-HD - 0.3, HD + 0.3], { castShadow: false });
  f.box(M.keramik(), [-HW, HW], [Y2 - MASJID.pelat, Y2], [-HD, HD]);
  band(f, Y2 - MASJID.pelat, Y2, 0.12);
  f.box(M.krem(), [-HW - 0.2, HW + 0.2], [YR, YT], [-HD - 0.2, HD + 0.2]);
  band(f, YR, YT, 0.32);
  const ow = HW + 0.2;
  const od = HD + 0.2;
  const t = 0.25;
  const p = [YT, YT + MASJID.parapet];
  f.box(M.krem(), [-ow, ow], p, [-od, -od + t]);
  f.box(M.krem(), [-ow, ow], p, [od - t, od]);
  f.box(M.krem(), [-ow, -ow + t], p, [-od, od]);
  f.box(M.krem(), [ow - t, ow], p, [-od, od]);
  const c = [YT + MASJID.parapet, YT + MASJID.parapet + 0.12];
  f.box(M.oker(), [-ow - 0.05, ow + 0.05], c, [-od - 0.05, -od + t + 0.05], { castShadow: false });
  f.box(M.oker(), [-ow - 0.05, ow + 0.05], c, [od - t - 0.05, od + 0.05], { castShadow: false });
  f.box(M.oker(), [-ow - 0.05, -ow + t + 0.05], c, [-od, od], { castShadow: false });
  f.box(M.oker(), [ow - t - 0.05, ow + 0.05], c, [-od, od], { castShadow: false });
}

/** Serambi bawah & atas: arkade ogee berulang di keempat sisi + kepala pier oker. */
function arcades(f) {
  const hLow = Y2 - MASJID.pelat - Y1; // 3,85
  ring4(f, M.krem(), { hw: HW, hd: HD, y: Y1, nUS: MASJID.baysUS, nBT: MASJID.baysBT, geoFor: (bw) => arcadeGeometry(bw, hLow, bw - 0.7, 2.3, 3.25) });
  ring4(f, M.krem(), { hw: HW, hd: HD, y: Y2, nUS: MASJID.baysUS, nBT: MASJID.baysBT, geoFor: (bw) => arcadeGeometry(bw, MASJID.lt2, bw - 0.7, 3.3, 4.6) });
  pierCaps(f, Y1 + 2.3);
  pierCaps(f, Y2 + 3.3);
}

/** Dinding dalam lt 1 (kantor/aula) di balik serambi + pintu & jendela gelap. */
function lowerCore(f) {
  const hw = HW - MASJID.serambi;
  const hd = HD - MASJID.serambi;
  const y = [Y1, Y2 - MASJID.pelat];
  const t = 0.3;
  f.box(M.krem(), [-hw, hw], y, [-hd, -hd + t]);
  f.box(M.krem(), [-hw, hw], y, [hd - t, hd]);
  f.box(M.krem(), [-hw, -hw + t], y, [-hd, hd]);
  f.box(M.krem(), [hw - t, hw], y, [-hd, hd]);
  const flat = { castShadow: false };
  for (const x of [-11, -5.5, 5.5, 11]) f.box(M.gelap(), [x - 1.1, x + 1.1], [Y1, Y1 + 2.8], [-hd - 0.02, -hd], flat);
  for (const x of [-11, -5.5, 0, 5.5, 11]) f.box(M.gelap(), [x - 0.9, x + 0.9], [Y1 + 1.0, Y1 + 2.6], [hd, hd + 0.02], flat);
  for (const z of [-8, 0, 8]) {
    f.box(M.gelap(), [hw, hw + 0.02], [Y1 + 1.0, Y1 + 2.6], [z - 0.9, z + 0.9], flat);
    f.box(M.gelap(), [-hw - 0.02, -hw], [Y1 + 1.0, Y1 + 2.6], [z - 0.9, z + 0.9], flat);
  }
}

/** Ruang salat 27 × 27 m lt 2: dinding ber-jendela ogee + ruang dalam gelap (terlihat lewat jendela). */
function upperCore(f) {
  const h = MASJID.inti / 2;
  ring4(f, M.krem(), { hw: h, hd: h, y: Y2, nUS: MASJID.baysInti, nBT: MASJID.baysInti, geoFor: (bw) => windowPanelGeometry(bw, MASJID.lt2, 1.3, 1.0, 3.0, 4.2) });
  const inner = heroGeometry('masjid:ruangDalam', () => new THREE.BoxGeometry(MASJID.inti - 0.6, MASJID.lt2 - 0.1, MASJID.inti - 0.6).translate(0, (MASJID.lt2 - 0.1) / 2, 0));
  f.add(inner, M.dalam(), local(0, Y2, 0), { castShadow: false });
}

/** Pipi tangga: bentuk di bidang (u = −z, y), diekstrusi `depth` ke +X lalu diputar ke sumbu tangga. */
function stairSideGeometry(key, pts, depth) {
  return heroGeometry(`masjid:${key}`, () => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([u, y]) => new THREE.Vector2(u, y))), { depth, bevelEnabled: false, curveSegments: 1 }).rotateY(Math.PI / 2));
}

/** Tangga besar keramik putih langsung ke serambi lt 2 (tonjolan utara OSM 6,6 × 9 m + bordes 1 m). */
function tangga(f) {
  const t = MASJID.tangga;
  const x0 = t.x - t.w / 2;
  const x1 = t.x + t.w / 2;
  const zTop = -HD - t.bordes;
  const run = (-t.zUjung + zTop) / t.anak; // (25,25 − 16,25) / 26 = 0,346 m
  const rise = Y2 / t.anak;                // 0,179 m
  f.box(M.keramik(), [x0, x1], [0, Y2], [zTop, -HD]);
  for (let i = 0; i < t.anak - 1; i += 1) {
    const zb = zTop - i * run;
    f.box(M.keramik(), [x0, x1], [0, Y2 - (i + 1) * rise], [zb - run, zb]);
  }
  const u0 = HD;
  const u1 = HD + t.bordes;
  const u2 = -t.zUjung;
  const cheek = stairSideGeometry('pipiTangga', [[u0, 0], [u2, 0], [u2, 0.95], [u1, Y2 + 0.95], [u0, Y2 + 0.95]], 0.25);
  const rail = stairSideGeometry('railTangga', [[u0, Y2 + 0.95], [u1, Y2 + 0.95], [u2, 0.95], [u2, 1.07], [u1, Y2 + 1.07], [u0, Y2 + 1.07]], 0.35);
  for (const sx of [x0 - 0.25, x1]) {
    f.add(cheek, M.krem(), local(sx, 0, 0));
    f.add(rail, M.oker(), local(sx - 0.05, 0, 0), { castShadow: false });
  }
}

/** Mahkota: leher, dua bola, bulan sabit (torus parsial 1,45π, celah menghadap atas). */
function mahkota(f, y) {
  const mat = M.mahkota();
  f.add(heroGeometry('masjid:leher', () => new THREE.CylinderGeometry(0.16, 0.22, 0.9, 10).translate(0, 0.45, 0)), mat, local(0, y - 0.05, 0));
  f.add(heroGeometry('masjid:bola1', () => new THREE.SphereGeometry(0.32, 12, 10)), mat, local(0, y + 1.1, 0));
  f.add(heroGeometry('masjid:bola2', () => new THREE.SphereGeometry(0.24, 12, 10)), mat, local(0, y + 1.55, 0));
  f.add(heroGeometry('masjid:sabit', () => new THREE.TorusGeometry(0.55, 0.08, 8, 28, Math.PI * 1.45).rotateZ(-1.225 * Math.PI)), mat, local(0, y + 2.3, 0));
}

/** Drum + jendela, cincin oker, kubah mozaik (placeholder N04), mahkota bulan sabit. */
function kubah(f) {
  const k = MASJID.kubah;
  f.add(heroGeometry('masjid:drum', () => new THREE.CylinderGeometry(k.drumR, k.drumR, k.drumH, k.segmen).translate(0, k.drumH / 2, 0)), M.krem(), local(0, YT, 0));
  f.add(heroGeometry('masjid:cincinDrum', () => new THREE.CylinderGeometry(k.drumR + 0.12, k.drumR + 0.12, 0.25, k.segmen)), M.oker(), local(0, DOME_BASE_Y - 0.125, 0), { castShadow: false });
  const win = heroGeometry('masjid:jendelaDrum', () => new THREE.PlaneGeometry(0.8, 1.3));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    f.add(win, M.gelap(), local(Math.sin(a) * (k.drumR + 0.01), YT + 1.3, Math.cos(a) * (k.drumR + 0.01), { ry: a }), { castShadow: false });
  }
  const profile = DOME_PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
  f.add(heroGeometry('masjid:kubah', () => new THREE.LatheGeometry(profile, k.segmen)), M.kubah(), local(0, DOME_BASE_Y, 0));
  mahkota(f, DOME_BASE_Y + k.h);
}

/** Toa: tiang pipa di sudut timur laut atap + 4 corong ke empat arah. */
function toa(f) {
  const x = 12.5;
  const z = -11.5;
  f.cylinder(M.toa(), { x, z, y0: YT, h: 4.0, r: 0.06, seg: 8 });
  const horn = heroGeometry('masjid:corong', () => new THREE.CylinderGeometry(0.3, 0.07, 0.6, 12, 1, true).rotateZ(-Math.PI / 2).translate(0.35, 0, 0));
  for (let i = 0; i < 4; i += 1) f.add(horn, M.toa(), local(x, YT + 3.75, z, { ry: (i * Math.PI) / 2 }), { castShadow: false });
}

/** Huruf timbul oker di parapet utara (muka tangga). */
function huruf(f) {
  const parts = reliefTextParts({ key: 'masjid:huruf', text: MASJID.huruf, width: 26, height: 0.72, color: '#c8962e', shade: '#6a4e16' });
  const z = -(HD + 0.2) - 0.07;
  for (const p of parts) f.add(p.geometry, p.material, local(0, YT + MASJID.parapet / 2, z).multiply(p.matrix), { castShadow: false });
}

/** Pelataran aspal di depan tangga + marka bay parkir motor (2 baris × 35 bay; motor diisi M7). */
function pelataran(f, groundY) {
  f.add(groundGrid('masjid:pelataran', f, { ...MASJID.pelataran, step: 2, lift: 0.05, groundY }), M.aspal(), null, { castShadow: false, name: 'aspal' });
  const line = heroGeometry('masjid:garisMarka', () => new THREE.BoxGeometry(0.08, 0.02, 1.9));
  for (const zc of MASJID.baris) {
    for (let k = 0; k <= 35; k += 1) {
      const x = -16 + 0.9 * k;
      const w = f.toWorld(x, zc);
      const y = (groundY ? groundY(w.x, w.z) - f.y : 0) + 0.07;
      f.add(line, M.marka(), local(x, y, zc), { castShadow: false });
    }
  }
}

/** Pusat bay motor di pelataran (DUNIA) + yaw motor (menghadap masjid) — untuk motorParking M7. */
export function masjidMotorBays() {
  const c = Math.cos(MASJID_SITE.yaw);
  const s = Math.sin(MASJID_SITE.yaw);
  const out = [];
  for (const zc of MASJID.baris) {
    for (let k = 0; k < 35; k += 1) {
      const x = -15.55 + 0.9 * k;
      out.push(Object.freeze({ x: MASJID_SITE.x + c * x + s * zc, z: MASJID_SITE.z - s * x + c * zc, yaw: MASJID_SITE.yaw }));
    }
  }
  return Object.freeze(out);
}

/** HERO_BUILDERS['hero:masjid-arfaunnas'] — PartList dunia (spec §4.6). */
export function buildMasjidArfaunnas(plan, _mats, ctx = {}) {
  const groundY = typeof ctx?.groundY === 'function' ? ctx.groundY : null;
  const f = createHeroFrame({ ...MASJID_SITE, y: heroBaseY(plan, ctx, MASJID_SITE) - PLINTH, origin: ctx?.origin ?? null });
  slabs(f);
  arcades(f);
  lowerCore(f);
  upperCore(f);
  tangga(f);
  kubah(f);
  toa(f);
  huruf(f);
  pelataran(f, groundY);
  return f.parts;
}
```

- [ ] **Step 2: Smoke Node (segitiga ≤ 40k, placeholder N04 ditandai)**

Run:
```bash
node --input-type=module -e "
import { withScope, createResourceScope } from './src/engine/ResourceScope.js';
import { buildMasjidArfaunnas, masjidMotorBays } from './src/world/kit/hero/masjidArfaunnas.js';
import { placeholderCount } from './src/world/kit/hero/ornaments.js';
const parts = withScope(createResourceScope('uji'), () => buildMasjidArfaunnas({ masses: [{ baseY: 3.15 }] }, {}, {}));
const tris = parts.reduce((s, p) => s + (p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count) / 3, 0);
console.log('parts', parts.length, 'tris', Math.round(tris), 'N04', placeholderCount('N04'), 'bay', masjidMotorBays().length);
"
```
Expected: `parts 370 tris 17310 N04 2 bay 70` (±5% bila jumlah segmen diubah; batas keras: tris ≤ 40000).

- [ ] **Step 3: Lint & commit**

Run: `npm run lint` → 0 galat.

```bash
git add src/world/kit/hero/masjidArfaunnas.js
```
```bash
git commit -m "feat(kit-hero): Masjid Arfa'unnas (arkade ogee 2 lt, tangga keramik, kubah mozaik N04, bulan sabit, toa, huruf timbul, pelataran motor)"
```

---

## Task 17: Hero H06 Gerbang SM Amin (`gerbangSmAmin.js`) + verifikasi posisi via Overpass

**Files:**
- Create: `src/world/kit/hero/gerbangSmAmin.js`
- (data sementara, gitignore) `data-src/osm/m6-gerbang.overpassql`, `data-src/osm/m6-gerbang.json`

- [ ] **Step 1: Kueri Overpass kecil (node/way gerbang di ujung timur Jl. Muchtar Lutfi)**

Cache `data-src/osm/stadion.json` tidak memuat node (hanya way bergeometri), jadi gerbang dicek langsung. Tulis kueri:
```bash
cat > data-src/osm/m6-gerbang.overpassql <<'EOF'
[out:json][timeout:60];
(
  node["barrier"~"^(gate|lift_gate|swing_gate|sliding_gate)$"](0.4760,101.3905,0.4795,101.3960);
  node["entrance"](0.4760,101.3905,0.4795,101.3960);
  nwr["name"~"[Gg]erbang|SM ?Amin|[Pp]os ([Ss]atpam|[Kk]eamanan|[Jj]aga)"](0.4760,101.3905,0.4795,101.3960);
);
out geom tags;
EOF
```
Run: `curl -s -X POST --data-urlencode "data@data-src/osm/m6-gerbang.overpassql" https://overpass-api.de/api/interpreter -o data-src/osm/m6-gerbang.json`
lalu:
```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { createProjection } from './src/geo/projection.js';
import { WORLD_ORIGIN } from './src/config/constants.js';
const P = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });
const els = JSON.parse(readFileSync('data-src/osm/m6-gerbang.json', 'utf8')).elements;
for (const e of els) {
  const g = e.type === 'node' ? e : (e.geometry?.[0] ?? e.center);
  const w = P.toWorld(g.lat, g.lon);
  console.log(e.type, e.id, JSON.stringify(e.tags ?? {}), 'dunia', w.x.toFixed(2), w.z.toFixed(2));
}
console.log('jumlah', els.length);
"
```
Expected: daftar elemen (bisa kosong: `jumlah 0`). Bbox kueri = dunia x ≈ 150…625, z ≈ 595…985 (ujung timur Jl. Muchtar Lutfi s.d. Jl. SM Amin).

**Aturan keputusan (tulis hasilnya di pesan commit):**
- Ada node `barrier` gerbang berjarak ≤ 15 m dari Jl. Muchtar Lutfi (z ≈ 682–702 pada x 150–580) → pakai x node itu sebagai `GX` di Step 2.
- Tidak ada → **fallback beku plan ini**: `GX = 210.45` (batas poligon kampus way 938374562 × Jl. Muchtar Lutfi, 6 m ke dalam kampus). Lewati Step 2.
- Overpass tidak dapat dihubungi → fallback, catat "Overpass tidak tersedia".

- [ ] **Step 2 (hanya bila node ditemukan): hitung ulang bingkai gerbang dari `GX`**

Run (ganti `GX=…` dengan x node; bila x > 565 pakai 565 — ujung segmen lurus sebelum tikungan Jl. SM Amin):
```bash
GX=210.45 node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { createProjection } from './src/geo/projection.js';
import { WORLD_ORIGIN } from './src/config/constants.js';
const GX = Number(process.env.GX);
const P = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });
const els = JSON.parse(readFileSync('data-src/osm/stadion.json', 'utf8')).elements;
const way = (id) => els.find((e) => e.id === id).geometry.map((g) => { const p = P.toWorld(g.lat, g.lon); return [p.x, p.z]; });
const seg = (pts) => { for (let i = 0; i < pts.length - 1; i += 1) if ((pts[i][0] - GX) * (pts[i + 1][0] - GX) <= 0) return [pts[i], pts[i + 1]]; throw new Error('GX di luar jalan'); };
const zAt = ([a, b]) => a[1] + ((b[1] - a[1]) * (GX - a[0])) / (b[0] - a[0]);
const n = seg([...way(38870021), ...way(653939050)]);
const s = seg([...way(653939051), ...way(535177996)]);
const gz = (zAt(n) + zAt(s)) / 2;
const L = Math.hypot(n[1][0] - n[0][0], n[1][1] - n[0][1]);
const hx = (n[1][0] - n[0][0]) / L;
const hz = (n[1][1] - n[0][1]) / L;
const yaw = Math.atan2(-hx, -hz);
const c = Math.cos(yaw);
const sn = Math.sin(yaw);
const toW = (lx, lz) => [+(GX + c * lx + sn * lz).toFixed(2), +(gz - sn * lx + c * lz).toFixed(2)];
console.log('GERBANG_SITE', JSON.stringify({ x: GX, z: +gz.toFixed(2), yaw: +yaw.toFixed(4) }));
console.log('ring pos', JSON.stringify([[-16, 1.5], [-13, 1.5], [-13, 4.5], [-16, 4.5]].map(([x, z]) => toW(x, z))));
"
```
Expected untuk `GX=210.45` (uji skrip): `GERBANG_SITE {"x":210.45,"z":696.09,"yaw":-1.5581}` dan `ring pos [[208.75,680.11],[208.78,683.11],[205.79,683.14],[205.75,680.14]]` — sama dengan nilai beku. Untuk GX lain: salin keluaran ke `GERBANG_SITE` (Step 3) dan ke `SYNTHETIC_BUILDINGS[0].ring` (Task 19 Step 4), lalu ubah `sumber` override menjadi `OSM node <id>` dan `keyakinan` `'sedang'`.

- [ ] **Step 3: Buat `gerbangSmAmin.js`**

```js
// src/world/kit/hero/gerbangSmAmin.js
/**
 * Hero H06 Gerbang SM Amin ("gerbang utama", timur) di Jl. Muchtar Lutfi. Fakta [T]: nama & status gerbang
 * utama, jam operasional s.d. 20.00 (Bahana Mahasiswa; cakaplah 2022), spanduk kuning pemberitahuan di
 * gerbang, satpam berjaga di pos. Posisi: cache OSM tanpa node gate → fallback batas poligon kampus
 * way 938374562 × Jl. Muchtar Lutfi (jalur ganda z 691,33 & 700,79), 6 m ke dalam kampus, tegak lurus jalan
 * (plan M6 Task 17; diganti bila Overpass menemukan node). Desain gapura [INFERENSI]: tanpa foto → dua
 * pilar + balok papan nama polos (TANPA ornamen Melayu karena tidak terkonfirmasi), daun pagar besi terbuka,
 * pos satpam, spanduk kuning N08. Lokal: +X sepanjang garis gerbang (≈ selatan), −Z = muka luar (timur).
 */
import * as THREE from 'three';
import { hasDocument } from '../../siteutil/textCanvas.js';
import { createHeroFrame, heroMaterial, heroGeometry, heroBaseY, local, named, PLINTH } from './heroFrame.js';
import { reliefTextParts } from './reliefText.js';

export const GERBANG_SITE = Object.freeze({ id: 's-gerbang-sm-amin', x: 210.45, z: 696.09, yaw: -1.5581 });

export const GERBANG = Object.freeze({
  pilar: Object.freeze({ x: 11.5, w: 2.0, d: 2.0, h: 8.0, alas: 0.8 }),
  balok: Object.freeze({ y0: 7.0, y1: 8.6, d: 1.4, span: 25.0 }),
  pos: Object.freeze({ x0: -16, x1: -13, z0: 1.5, z1: 4.5, h: 2.6 }),
  daun: Object.freeze({ x: 10.2, z0: 1.2, z1: 6.2, h: 1.8 }),
  spanduk: Object.freeze({ x0: -15.6, x1: -12.6, y0: 1.4, y1: 2.2, z: -1.2, baris: Object.freeze(['PEMBERITAHUAN', 'GERBANG DITUTUP PUKUL 20.00 WIB']) }),
  warna: Object.freeze({ pilar: 0xe6e0d0, alas: 0x4a4a4f, balok: 0x2f3338, besi: 0x3b4044, pos: 0xf0ebe0, atap: 0x8c8f93, kaca: 0x22303c, bambu: 0x9c7a4a, lampu: 0xfff1d0, kuning: 0xf5d000 }),
});
const W = GERBANG.warna;

/** Spanduk kuning N08 dua baris (teks [INFERENSI] dari jam operasional [T]). Node → kuning polos. */
function spandukMaterial() {
  return heroMaterial('gerbang:spanduk', () => {
    let map = null;
    if (hasDocument()) {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 272;
      const g = c.getContext('2d');
      if (g) {
        g.fillStyle = '#f5d000';
        g.fillRect(0, 0, 1024, 272);
        g.fillStyle = '#111111';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = 'bold 84px sans-serif';
        g.fillText(GERBANG.spanduk.baris[0], 512, 82, 980);
        g.font = 'bold 64px sans-serif';
        g.fillText(GERBANG.spanduk.baris[1], 512, 190, 980);
        map = new THREE.CanvasTexture(c);
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 4;
      }
    }
    return named(new THREE.MeshLambertMaterial({ color: map ? 0xffffff : W.kuning, map, side: THREE.DoubleSide }), 'gerbang:spanduk');
  });
}

const lambert = (key, color) => heroMaterial(`gerbang:${key}`, () => named(new THREE.MeshLambertMaterial({ color }), `gerbang:${key}`));
const M = {
  pilar: () => lambert('pilar', W.pilar),
  alas: () => lambert('alas', W.alas),
  balok: () => lambert('balok', W.balok),
  besi: () => lambert('besi', W.besi),
  pos: () => lambert('pos', W.pos),
  atap: () => lambert('atap', W.atap),
  kaca: () => lambert('kaca', W.kaca),
  bambu: () => lambert('bambu', W.bambu),
  lampu: () => heroMaterial('gerbang:lampu', () => {
    const m = named(new THREE.MeshStandardMaterial({ color: W.lampu, emissive: W.lampu, emissiveIntensity: 0 }), 'gerbang:lampu-emisif');
    m.userData.nightEmissive = { on: 2.0, off: 0 };
    return m;
  }),
};

function pilar(f) {
  const { x, w, d, h, alas } = GERBANG.pilar;
  for (const sx of [-1, 1]) {
    f.box(M.alas(), [sx * x - w / 2 - 0.15, sx * x + w / 2 + 0.15], [0, alas], [-d / 2 - 0.15, d / 2 + 0.15]);
    f.box(M.pilar(), [sx * x - w / 2, sx * x + w / 2], [alas, h], [-d / 2, d / 2]);
    f.box(M.lampu(), [sx * x - 0.25, sx * x + 0.25], [GERBANG.balok.y1, GERBANG.balok.y1 + 0.6], [-0.25, 0.25], { castShadow: false });
  }
}

function balok(f) {
  const b = GERBANG.balok;
  f.box(M.balok(), [-b.span / 2, b.span / 2], [b.y0, b.y1], [-b.d / 2, b.d / 2]);
  const parts = reliefTextParts({ key: 'gerbang:nama', text: 'UNIVERSITAS RIAU', width: 16, height: 1.0, color: '#f2f2f2', shade: '#8a8a8a', nightGlow: 1.0 });
  const yc = (b.y0 + b.y1) / 2;
  for (const p of parts) {
    f.add(p.geometry, p.material, local(0, yc, -b.d / 2 - 0.07).multiply(p.matrix), { castShadow: false });
    f.add(p.geometry, p.material, local(0, yc, b.d / 2 + 0.07, { ry: Math.PI }).multiply(p.matrix), { castShadow: false });
  }
}

/** Daun pagar besi terbuka (dilipat sejajar jalan di sisi kampus, di balik pilar). */
function daunPagar(f) {
  const dn = GERBANG.daun;
  for (const sx of [-1, 1]) {
    const x = sx * dn.x;
    f.box(M.besi(), [x - 0.04, x + 0.04], [0.15, 0.25], [dn.z0, dn.z1]);
    f.box(M.besi(), [x - 0.04, x + 0.04], [dn.h - 0.1, dn.h], [dn.z0, dn.z1]);
    for (let z = dn.z0; z <= dn.z1 + 1e-6; z += 0.15) f.box(M.besi(), [x - 0.02, x + 0.02], [0.15, dn.h], [z - 0.02, z + 0.02], { castShadow: false });
  }
}

/** Pos satpam (P01/K11) di sisi kampus utara jalan; jendela menghadap jalan, pintu ke kampus. */
function posSatpam(f) {
  const p = GERBANG.pos;
  const cx = (p.x0 + p.x1) / 2;
  const cz = (p.z0 + p.z1) / 2;
  f.box(M.pos(), [p.x0, p.x1], [0, p.h], [p.z0, p.z1]);
  f.box(M.atap(), [p.x0 - 0.5, p.x1 + 0.5], [p.h, p.h + 0.2], [p.z0 - 0.5, p.z1 + 0.5]);
  f.box(M.kaca(), [p.x1, p.x1 + 0.02], [1.0, 2.1], [p.z0 + 0.4, p.z1 - 0.4], { castShadow: false });
  f.box(M.kaca(), [cx - 0.45, cx + 0.45], [0, 2.1], [p.z1, p.z1 + 0.02], { castShadow: false });
  f.box(M.lampu(), [p.x1 - 0.6, p.x1 - 0.2], [p.h - 0.2, p.h - 0.1], [cz - 0.2, cz + 0.2], { castShadow: false });
}

/** Spanduk kuning N08 diikat antara pilar utara dan tiang bambu, menghadap kedatangan (timur). */
function spanduk(f) {
  const s = GERBANG.spanduk;
  const geo = heroGeometry('gerbang:spandukBidang', () => new THREE.PlaneGeometry(s.x1 - s.x0, s.y1 - s.y0).rotateY(Math.PI));
  f.add(geo, spandukMaterial(), local((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, s.z), { castShadow: false, name: 'N08' });
  f.cylinder(M.bambu(), { x: s.x0 - 0.15, z: s.z, y0: 0, h: 2.6, r: 0.05, seg: 8 });
}

/** HERO_BUILDERS['hero:gerbang-sm-amin'] — PartList dunia (spec §4.6). */
export function buildGerbangSmAmin(plan, _mats, ctx = {}) {
  const f = createHeroFrame({ ...GERBANG_SITE, y: heroBaseY(plan, ctx, GERBANG_SITE) - PLINTH, origin: ctx?.origin ?? null });
  pilar(f);
  balok(f);
  daunPagar(f);
  posSatpam(f);
  spanduk(f);
  return f.parts;
}
```

- [ ] **Step 4: Lint & commit**

Run: `npm run lint` → 0 galat.

```bash
git add src/world/kit/hero/gerbangSmAmin.js
```
```bash
git commit -m "feat(kit-hero): Gerbang SM Amin (pilar + balok nama, pagar terbuka, pos satpam, spanduk kuning N08); posisi fallback batas kampus"
```
(Bila Step 2 dijalankan, sebut node OSM dalam pesan commit; bila fallback, tambahkan "Overpass: tidak ada node gate".)

---

## Task 18: Hero H07 GGM mangkrak (`ggm.js`)

**Files:**
- Create: `src/world/kit/hero/ggm.js`

- [ ] **Step 1: Buat `ggm.js`**

```js
// src/world/kit/hero/ggm.js
/**
 * Hero H07 Gedung Auditorium Grand Gasing Millenium (GGM) UNRI (OSM way 314450943, tapak lingkaran
 * Ø ±81,7 m, levels 4-7, roof=tin). Fakta [T]: bentuk terinspirasi gasing; dibangun 2008; 2013 atap sudah
 * terpasang, sisanya tiang & pondasi, tempat duduk undakan semen kasar, ilalang, coretan, jalan masuk batu
 * & tanah merah; julukan "gedung mangkrak". Kondisi 2026 [TIDAK DIKETAHUI] → ditampilkan sesuai 2013/2015.
 * [INFERENSI]: profil atap gasing, jumlah/posisi kolom, jumlah undakan & celah panggung (selatan), warna
 * seng, isi coretan (goresan abstrak + kata netral), sisa kolom bertulangan.
 */
import * as THREE from 'three';
import { hasDocument } from '../../siteutil/textCanvas.js';
import { createRng } from '../../util/random.js';
import { surfaceMaps } from '../../textures/surfaces.js';
import { createHeroFrame, heroMaterial, heroGeometry, heroBaseY, groundDisc, groundGrid, groundStamp, local, named, PLINTH } from './heroFrame.js';

export const GGM_SITE = Object.freeze({ id: 'w314450943', x: 133.13, z: 407.41, yaw: 0 });

export const GGM = Object.freeze({
  atap: Object.freeze({
    eave: 16.6,
    profil: Object.freeze([[41.6, 16.6], [41.6, 17.1], [37.5, 18.7], [31.0, 20.6], [23.5, 22.3], [16.0, 23.6], [9.0, 24.5], [3.2, 25.0], [1.4, 25.2]]),
  }),
  kolomLuar: Object.freeze({ n: 24, r: 39.6, rad: 0.5 }),
  kolomDalam: Object.freeze({ n: 16, r: 34.6, rad: 0.4 }),
  tribun: Object.freeze({ rIn: 14, step: 1.6, rise: 0.45, undak: 12, celah: Math.PI / 3 }),
  tanah: 47,
  jalan: Object.freeze({ x0: -3, x1: 3, z0: 40, z1: 60 }),
  ilalang: 420,
  puing: Object.freeze([0.3, 1.1, 2.0, 3.6, 4.4, 5.3]),
  warna: Object.freeze({ semen: 0xa8a49b, seng: 0x8b9298, tanah: 0x9c4f2e, kerikil: 0x8d8577, karat: 0x7a4a2e }),
});
const WR = GGM.warna;

/** Coretan: goresan bezier acak + beberapa kata netral, latar transparan. Node → null (tanpa coretan). */
function grafitiTexture(seed) {
  if (!hasDocument()) return null;
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) return null;
  const rnd = createRng(seed);
  const warna = ['#d6336c', '#1c7ed6', '#f08c00', '#2b8a3e', '#212529', '#e03131', '#7048e8'];
  g.lineCap = 'round';
  for (let i = 0; i < 46; i += 1) {
    g.strokeStyle = warna[Math.floor(rnd() * warna.length)];
    g.lineWidth = 5 + rnd() * 14;
    const x = rnd() * 2048;
    const y = 40 + rnd() * 170;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + 40 + rnd() * 80, y - 60 + rnd() * 120, x + 80 + rnd() * 90, y - 60 + rnd() * 120, x + 120 + rnd() * 120, y - 30 + rnd() * 60);
    g.stroke();
  }
  g.font = 'bold 96px sans-serif';
  g.textBaseline = 'middle';
  ['UNRI', 'GGM', '62', 'ANGKATAN'].forEach((teks, i) => {
    g.save();
    g.fillStyle = warna[(i * 3) % warna.length];
    g.translate(150 + i * 480 + rnd() * 120, 128);
    g.rotate(-0.12 + rnd() * 0.24);
    g.fillText(teks, 0, 0);
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const M = {
  semen: () => heroMaterial('ggm:semen', () => named(new THREE.MeshStandardMaterial({ color: WR.semen, roughness: 0.97, side: THREE.DoubleSide, ...surfaceMaps('concrete', 3) }), 'ggm:semen-kasar')),
  seng: () => heroMaterial('ggm:seng', () => named(new THREE.MeshStandardMaterial({ color: WR.seng, roughness: 0.6, metalness: 0.45, side: THREE.DoubleSide }), 'ggm:seng')),
  tanah: () => heroMaterial('ggm:tanah', () => named(new THREE.MeshLambertMaterial({ color: WR.tanah }), 'ggm:tanah-merah')),
  kerikil: () => heroMaterial('ggm:kerikil', () => named(new THREE.MeshLambertMaterial({ color: WR.kerikil }), 'ggm:jalan-batu')),
  karat: () => heroMaterial('ggm:karat', () => named(new THREE.MeshLambertMaterial({ color: WR.karat }), 'ggm:besi-karat')),
  ilalang: () => heroMaterial('ggm:ilalang', () => named(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 'ggm:ilalang')),
  grafiti: () => heroMaterial('ggm:grafiti', () => {
    const map = grafitiTexture(314450943);
    return named(new THREE.MeshLambertMaterial({ color: 0xffffff, map, alphaTest: map ? 0.5 : 0, side: THREE.DoubleSide }), 'ggm:grafiti');
  }),
};

/** Profil undakan (r, y): dari tepi panggung naik 12 anak ke dinding belakang lalu turun ke tanah. */
function tribunProfile() {
  const { rIn, step, rise, undak } = GGM.tribun;
  const pts = [[rIn, 0]];
  for (let k = 0; k < undak; k += 1) pts.push([rIn + step * k, rise * (k + 1)], [rIn + step * (k + 1), rise * (k + 1)]);
  pts.push([rIn + step * undak, 0]);
  return pts;
}

/** Atap gasing seng (lathe), plafon bawah, pasak puncak, balok cincin. */
function atap(f) {
  const prof = GGM.atap.profil.map(([r, y]) => new THREE.Vector2(r, y));
  f.add(heroGeometry('ggm:atap', () => new THREE.LatheGeometry(prof, 64)), M.seng());
  f.add(heroGeometry('ggm:plafon', () => new THREE.CircleGeometry(41.6, 64).rotateX(Math.PI / 2)), M.seng(), local(0, GGM.atap.eave - 0.01, 0), { castShadow: false });
  f.add(heroGeometry('ggm:pasak', () => new THREE.CylinderGeometry(0.25, 1.4, 2.4, 16).translate(0, 1.2, 0)), M.seng(), local(0, 25.2, 0));
  f.add(heroGeometry('ggm:balokCincin', () => new THREE.CylinderGeometry(41.0, 41.0, 0.7, 64, 1, true)), M.semen(), local(0, GGM.atap.eave - 0.35, 0));
}

/** Dua cincin kolom semen kasar. */
function kolom(f) {
  for (const [def, top] of [[GGM.kolomLuar, GGM.atap.eave - 0.7], [GGM.kolomDalam, GGM.atap.eave]]) {
    const geo = heroGeometry(`ggm:kolom:${def.rad}:${top}`, () => new THREE.CylinderGeometry(def.rad, def.rad, top, 12).translate(0, top / 2, 0));
    for (let i = 0; i < def.n; i += 1) {
      const a = ((i + 0.5) / def.n) * Math.PI * 2;
      f.add(geo, M.semen(), local(Math.sin(a) * def.r, 0, Math.cos(a) * def.r));
    }
  }
}

/** Tribun undakan 300° (celah 60° ke selatan untuk panggung/akses), tutup ujung, panggung, coretan. */
function tribun(f) {
  const { celah, rIn } = GGM.tribun;
  const prof = tribunProfile().map(([r, y]) => new THREE.Vector2(r, y));
  f.add(heroGeometry('ggm:tribun', () => new THREE.LatheGeometry(prof, 50, celah / 2, Math.PI * 2 - celah)), M.semen());
  const cap = heroGeometry('ggm:tutupTribun', () => new THREE.ShapeGeometry(new THREE.Shape(prof)));
  for (const phi of [celah / 2, Math.PI * 2 - celah / 2]) f.add(cap, M.semen(), local(0, 0, 0, { ry: phi - Math.PI / 2 }));
  f.add(heroGeometry('ggm:panggung', () => new THREE.CylinderGeometry(rIn, rIn, 0.3, 48).translate(0, 0.15, 0)), M.semen());
  const graf = M.grafiti();
  if (graf.map) {
    const strip = heroGeometry('ggm:grafitiPita', () => new THREE.CylinderGeometry(33.3, 33.3, 2.3, 50, 1, true, celah / 2, Math.PI * 2 - celah).translate(0, 1.45, 0));
    f.add(strip, graf, null, { castShadow: false });
  }
}

/** Sisa kolom tanpa finishing dengan besi tulangan berkarat di luar atap. */
function puing(f) {
  const rnd = createRng(2008);
  const rebar = heroGeometry('ggm:besi', () => new THREE.CylinderGeometry(0.016, 0.016, 1.2, 5).translate(0, 0.6, 0));
  for (const a of GGM.puing) {
    const x = Math.sin(a) * 45;
    const z = Math.cos(a) * 45;
    const h = 1.2 + rnd() * 1.6;
    f.box(M.semen(), [x - 0.3, x + 0.3], [0, h], [z - 0.3, z + 0.3], { ry: a });
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
      f.add(rebar, M.karat(), local(x + dx, h, z + dz, { rx: (rnd() - 0.5) * 0.5, rz: (rnd() - 0.5) * 0.5 }), { castShadow: false });
    }
  }
}

/** Rumpun ilalang (5 bilah segitiga per rumpun, warna kuning-hijau acak). */
function ilalangGeometry(rnd, points) {
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  for (const [x, y, z] of points) {
    for (let b = 0; b < 5; b += 1) {
      const a = rnd() * Math.PI * 2;
      const h = 0.5 + rnd() * 0.6;
      const lean = 0.15 + rnd() * 0.35;
      const w = 0.05;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      pos.push(x - dz * w, y, z + dx * w, x + dz * w, y, z - dx * w, x + dx * lean, y + h, z + dz * lean);
      c.setHSL(0.16 + rnd() * 0.08, 0.35 + rnd() * 0.2, 0.32 + rnd() * 0.18);
      for (let k = 0; k < 3; k += 1) col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Titik rumpun: 55% di luar atap (r 41,8–48), 30% di antara tribun & kolom, 15% di panggung. */
function ilalangPoints(rnd, n) {
  const pts = [];
  for (const [r0, r1, share] of [[41.8, 48, 0.55], [33.6, 39.0, 0.3], [2, 13, 0.15]]) {
    const count = Math.round(n * share);
    for (let i = 0; i < count; i += 1) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0));
      pts.push([Math.sin(a) * r, Math.cos(a) * r]);
    }
  }
  return pts;
}

function ilalang(f, groundY) {
  const geo = heroGeometry(`ggm:ilalang:${groundStamp(f, groundY)}`, () => {
    const rnd = createRng(314450943);
    const pts = ilalangPoints(rnd, GGM.ilalang).map(([x, z]) => {
      if (Math.hypot(x, z) < GGM.tribun.rIn) return [x, 0.3, z];
      const w = f.toWorld(x, z);
      return [x, groundY ? groundY(w.x, w.z) - f.y : 0, z];
    });
    return ilalangGeometry(rnd, pts);
  });
  f.add(geo, M.ilalang(), null, { castShadow: false, name: 'ilalang' });
}

/** Tanah merah (cakram r 47) + jalan masuk batu ke selatan. */
function tanah(f, groundY) {
  f.add(groundDisc('ggm:tanahMerah', f, { r: GGM.tanah, seg: 48, rings: 8, lift: 0.04, groundY }), M.tanah(), null, { castShadow: false, name: 'tanahMerah' });
  f.add(groundGrid('ggm:jalanBatu', f, { ...GGM.jalan, step: 2, lift: 0.07, groundY }), M.kerikil(), null, { castShadow: false, name: 'jalanBatu' });
}

/** HERO_BUILDERS['hero:ggm'] — PartList dunia (spec §4.6). */
export function buildGgm(plan, _mats, ctx = {}) {
  const groundY = typeof ctx?.groundY === 'function' ? ctx.groundY : null;
  const f = createHeroFrame({ ...GGM_SITE, y: heroBaseY(plan, ctx, GGM_SITE) - PLINTH, origin: ctx?.origin ?? null });
  tanah(f, groundY);
  tribun(f);
  kolom(f);
  atap(f);
  puing(f);
  ilalang(f, groundY);
  return f.parts;
}
```

- [ ] **Step 2: Lint & commit**

Run: `npm run lint` → 0 galat.

```bash
git add src/world/kit/hero/ggm.js
```
```bash
git commit -m "feat(kit-hero): GGM mangkrak (atap gasing seng, kolom & undakan semen kasar, ilalang, tanah merah, coretan)"
```

---

## Task 19: Daftarkan hero + override gedung + bangunan sintetis gerbang (TDD heroBuilders)

**Files:**
- Modify: `src/world/kit/hero/index.js`
- Modify: `src/districts/unri/buildings.data.js`
- Modify: `tools/campusbake/buildings.js` (deviasi; lihat "Struktur file")
- Test: `tests/unri/heroBuilders.test.js`
- Regenerate: `public/districts/unri/buildings.json`

- [ ] **Step 1: Tulis tes yang gagal**

```js
// tests/unri/heroBuilders.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { withScope, createResourceScope } from '../../src/engine/ResourceScope.js';
import { HERO_BUILDERS, HERO_ORNAMENTS } from '../../src/world/kit/hero/index.js';
import { MASJID_SITE } from '../../src/world/kit/hero/masjidArfaunnas.js';
import { GERBANG_SITE, GERBANG } from '../../src/world/kit/hero/gerbangSmAmin.js';
import { GGM_SITE } from '../../src/world/kit/hero/ggm.js';
import { resetOrnaments, placeholderCount } from '../../src/world/kit/hero/ornaments.js';
import * as BUILDINGS from '../../src/districts/unri/buildings.data.js';

const plan = (baseY) => ({ masses: [{ obb: { cx: 0, cz: 0, w: 10, d: 10, yaw: 0 }, floors: 1, floorH: 4, baseY }] });
const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
function bounds(parts) {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  for (const p of parts) {
    p.geometry.computeBoundingBox();
    box.union(tmp.copy(p.geometry.boundingBox).applyMatrix4(p.matrix));
  }
  return box;
}
/** Tabel override M3 = ekspor objek yang memuat kunci Rektorat (nama ekspor M3 tidak dikunci indeks). */
const OVERRIDES = Object.values(BUILDINGS).find((v) => v && typeof v === 'object' && !Array.isArray(v) && 'w282225347' in v);

beforeEach(() => resetOrnaments());

describe('hero building distrik M6', () => {
  it.each([
    ['hero:masjid-arfaunnas', MASJID_SITE, 40000, 48],
    ['hero:gerbang-sm-amin', GERBANG_SITE, 10000, 22],
    ['hero:ggm', GGM_SITE, 35000, 62],
  ])('%s: PartList dunia valid, ≤ budget segitiga, di sekitar tapak', (id, site, budget, radius) => {
    const scope = createResourceScope(`uji:${id}`);
    const parts = withScope(scope, () => HERO_BUILDERS[id](plan(3.15), {}, {}));
    expect(parts.length).toBeGreaterThan(10);
    for (const p of parts) {
      expect(p.geometry.isBufferGeometry).toBe(true);
      expect(p.material.isMaterial).toBe(true);
      expect(p.matrix.elements.every(Number.isFinite)).toBe(true);
    }
    expect(parts.reduce((s, p) => s + tris(p.geometry), 0)).toBeLessThanOrEqual(budget);
    const b = bounds(parts);
    expect(b.min.y).toBeGreaterThan(1.0);
    const c = b.getCenter(new THREE.Vector3());
    expect(Math.hypot(c.x - site.x, c.z - site.z)).toBeLessThan(radius / 2);
    expect(Math.max(b.max.x - b.min.x, b.max.z - b.min.z)).toBeLessThan(radius * 2);
    const again = withScope(scope, () => HERO_BUILDERS[id](plan(3.15), {}, {}));
    expect(again[0].geometry).toBe(parts[0].geometry); // cache scope: bangun ulang klaster tidak menduplikasi geometri
    scope.dispose();
  });

  it('Rektorat & perpustakaan milik region: kit distrik tidak menggambar apa pun', () => {
    expect(HERO_BUILDERS['hero:rektorat'](plan(0), {}, {})).toEqual([]);
    expect(HERO_BUILDERS['hero:perpustakaan-lama'](plan(0), {}, {})).toEqual([]);
    expect(HERO_BUILDERS['hero:rektorat'].regionOwned).toBe('unri-rektorat');
    expect(HERO_BUILDERS['hero:perpustakaan-lama'].regionOwned).toBe('unri-rektorat');
  });

  it('masjid menandai placeholder N04 (kubah + mahkota); HERO_ORNAMENTS menunjuk GLB N04', () => {
    withScope(createResourceScope('uji:n04'), () => HERO_BUILDERS['hero:masjid-arfaunnas'](plan(0), {}, {}));
    expect(placeholderCount('N04')).toBe(2);
    expect(HERO_ORNAMENTS.map((o) => o.assetId)).toEqual(['N04']);
    expect(HERO_ORNAMENTS[0].path).toBe('models/unri/n04-kubah-mozaik.glb');
  });

  it('override M6 valid & bangunan sintetis gerbang konsisten dengan GERBANG_SITE', () => {
    expect(OVERRIDES).toBeTruthy();
    expect(BUILDINGS.validateOverrides(OVERRIDES)).toEqual([]);
    expect(OVERRIDES.w282225347.archetype).toBe('hero:rektorat');
    expect(OVERRIDES.w282225374.archetype).toBe('hero:perpustakaan-lama');
    expect(OVERRIDES.w282230716.archetype).toBe('hero:masjid-arfaunnas');
    expect(OVERRIDES.w314450943.archetype).toBe('hero:ggm');
    expect(OVERRIDES['s-gerbang-sm-amin'].archetype).toBe('hero:gerbang-sm-amin');
    const syn = BUILDINGS.SYNTHETIC_BUILDINGS.find((b) => b.id === 's-gerbang-sm-amin');
    const { x0, x1, z0, z1 } = GERBANG.pos;
    const c = Math.cos(GERBANG_SITE.yaw);
    const s = Math.sin(GERBANG_SITE.yaw);
    const expected = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([lx, lz]) => [GERBANG_SITE.x + c * lx + s * lz, GERBANG_SITE.z - s * lx + c * lz]);
    syn.ring.forEach(([x, z], i) => {
      expect(x).toBeCloseTo(expected[i][0], 1);
      expect(z).toBeCloseTo(expected[i][1], 1);
    });
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/heroBuilders.test.js`
Expected: FAIL — `HERO_ORNAMENTS` tidak diekspor / builder `hero:perpustakaan-lama` tidak ada / `SYNTHETIC_BUILDINGS` tidak ada.

- [ ] **Step 3: Ubah `src/world/kit/hero/index.js`**

Tambahkan di atas berkas (setelah impor yang ada):
```js
import { buildMasjidArfaunnas, MASJID_ORNAMENTS } from './masjidArfaunnas.js';
import { buildGerbangSmAmin } from './gerbangSmAmin.js';
import { buildGgm } from './ggm.js';
```
`regionOwnedHero` sudah diimpor M4 dari `./regionOwned.js` (builder PartList kosong bertanda `builder.regionOwned = regionId`; `isRegionOwned` dipakai klaster distrik bila LOD1 tidak lewat `HERO_BUILDERS`). Bila impor itu belum ada, tambahkan `import { regionOwnedHero } from './regionOwned.js';`.

Di dalam literal `HERO_BUILDERS`, GANTI entri placeholder M3 untuk kunci berikut dan TAMBAHKAN `hero:perpustakaan-lama` (Rektorat & perpustakaan dirender region unri-rektorat; saat region tidak terpasang proxy region yang tampil; footprint tetap di collider distrik):
```js
  'hero:rektorat': regionOwnedHero('unri-rektorat'),
  'hero:perpustakaan-lama': regionOwnedHero('unri-rektorat'),
  'hero:masjid-arfaunnas': buildMasjidArfaunnas,
  'hero:gerbang-sm-amin': buildGerbangSmAmin,
  'hero:ggm': buildGgm,
```
Tambahkan di akhir berkas:
```js
/** Ornamen GLB hero distrik (dimuat src/app/heroOrnaments.js; placeholder via ornaments.js). */
export const HERO_ORNAMENTS = Object.freeze([...MASJID_ORNAMENTS]);
```
Lalu cari daftar id hero lain yang harus memuat id baru:
Run: `grep -rn "'hero:ggm'" src tools`
Untuk SETIAP daftar/konstanta id hero yang ditemukan selain `HERO_BUILDERS` (mis. himpunan id yang diterima `validateOverrides`), tambahkan `'hero:perpustakaan-lama'` di sebelah `'hero:ggm'`.

- [ ] **Step 4: Ubah `src/districts/unri/buildings.data.js`**

(a) Di tabel override (nama ekspor M3 dicatat di Task 0), GANTI-atau-TAMBAH lima entri ini persis:
```js
  'w282225347': {
    archetype: 'hero:rektorat', levels: 5, palette: 'putih', roof: 'datar-parapet', sign: 'REKTORAT UNIVERSITAS RIAU',
    sumber: 'foto drone 2016 Commons Taman_Unri.jpg (CC BY-SA 4.0); OSM building:levels 4-7; dibangun region unri-rektorat (M6)',
    keyakinan: 'tinggi',
  },
  'w282225374': {
    archetype: 'hero:perpustakaan-lama', levels: 2,
    sumber: 'lib.unri.ac.id/sejarah-perpustakaan (ringkasan: empat gedung, masing-masing dua lantai); dibangun region unri-rektorat (M6)',
    keyakinan: 'sedang',
  },
  'w282230716': {
    archetype: 'hero:masjid-arfaunnas', levels: 2, roof: 'datar-parapet', sign: "MASJID ARFA' UNNAS UNIVERSITAS RIAU",
    sumber: 'foto 2023 Commons Masjid_Arfaunnas_unri.jpg (CC BY-SA 4.0); arfaunnas.unri.ac.id (ruang salat 27 × 27 m, 2 lt); OSM levels 2',
    keyakinan: 'tinggi',
  },
  'w314450943': {
    archetype: 'hero:ggm', levels: 4,
    sumber: 'lovinasoenmi 2013 (kondisi mangkrak), unri.ac.id wisuda 2015, mediacenter.riau.go.id; OSM tapak Ø 81,7 m; kondisi 2026 tidak diketahui',
    keyakinan: 'sedang',
  },
  's-gerbang-sm-amin': {
    archetype: 'hero:gerbang-sm-amin', levels: 1, sign: 'UNIVERSITAS RIAU',
    sumber: 'nama, status gerbang utama, jam s.d. 20.00: Bahana Mahasiswa & cakaplah 2022; posisi: fallback batas poligon kampus OSM way 938374562 × Jl. Muchtar Lutfi (plan M6 Task 17); desain: INFERENSI',
    keyakinan: 'rendah',
  },
```
(b) Tambahkan ekspor bangunan sintetis (tanpa way OSM; ring = pos satpam, dunia):
```js
/**
 * Bangunan sintetis (tidak ada di OSM) yang tetap dirakit distrik lewat override hero. Ring = tapak yang
 * menghalangi collider (hanya pos satpam; pilar gerbang tidak menghalangi agar jalan tetap terbuka).
 * Disisipkan ke buildings.json oleh tools/campusbake/buildings.js.
 */
export const SYNTHETIC_BUILDINGS = Object.freeze([
  Object.freeze({
    id: 's-gerbang-sm-amin',
    ring: Object.freeze([[208.75, 680.11], [208.78, 683.11], [205.79, 683.14], [205.75, 680.14]].map((p) => Object.freeze(p))),
    levels: 1,
    tags: Object.freeze({ name: 'Gerbang SM Amin (pos satpam)', building: 'guardhouse', barrier: 'gate' }),
  }),
]);
```
(c) Validasi kunci: baca `validateOverrides` (Run: `grep -n "validateOverrides" -A 30 src/districts/unri/buildings.data.js`). Bila fungsi menolak kunci yang tidak cocok `/^w\d+$/`, ganti pola itu menjadi `/^(w\d+|s-[a-z0-9-]+)$/`, lalu sisipkan sebelum `return` (pakai nama array galat milik fungsi M3; di sini `errors`):
```js
  for (const key of Object.keys(table)) {
    if (key.startsWith('s-') && !SYNTHETIC_BUILDINGS.some((b) => b.id === key)) errors.push(`${key}: bangunan sintetis tidak terdaftar di SYNTHETIC_BUILDINGS`);
  }
```

- [ ] **Step 5: Sisipkan bangunan sintetis di `tools/campusbake/buildings.js`**

Run: `grep -n "cluster" tools/campusbake/buildings.js`
Di tempat entri `{ id, ring, levels, tags, cluster }` dibentuk untuk way OSM: bila pembentukannya inline, ekstrak dulu menjadi fungsi lokal `function toBakeEntry({ id, ring, levels, tags })` yang mengembalikan objek entri yang sama (termasuk perhitungan `cluster` M3) — keluaran untuk gedung OSM tidak berubah. Tambahkan impor:
```js
import { SYNTHETIC_BUILDINGS } from '../../src/districts/unri/buildings.data.js';
```
dan tepat setelah daftar gedung OSM selesai dibentuk (sebelum diurutkan/ditulis), sisipkan (`buildings` = nama array gedung di fungsi M3):
```js
  for (const s of SYNTHETIC_BUILDINGS) {
    if (buildings.some((b) => b.id === s.id)) continue;
    buildings.push(toBakeEntry({ id: s.id, ring: s.ring.map(([x, z]) => [x, z]), levels: s.levels, tags: { ...s.tags } }));
  }
```

- [ ] **Step 6: Bake gedung**

Run: `npm run bake:campus -- buildings --offline`
Run: `node -e "const b=require('./public/districts/unri/buildings.json').buildings; for (const id of ['s-gerbang-sm-amin','w282230716','w314450943','w282225347']) console.log(id, Boolean(b.find((x)=>x.id===id)))"`
Expected: keempatnya `true`.

- [ ] **Step 7: Jalankan tes, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/heroBuilders.test.js`
Expected: PASS (6 tes). Lalu `npm test` (termasuk tes M3 "tabel override nyata lulus validateOverrides" dan golden campusbake — perbarui golden bila gagal hanya karena entri sintetis, sesuai prosedur di kepala tesnya) → semua PASS; `npm run lint` → 0 galat.

- [ ] **Step 8: Commit**

```bash
git add src/world/kit/hero/index.js src/districts/unri/buildings.data.js tools/campusbake/buildings.js tests/unri/heroBuilders.test.js public/districts/unri/buildings.json
```
```bash
git commit -m "feat(unri): override hero Rektorat/Perpustakaan (milik region), Masjid Arfa'unnas, GGM, Gerbang SM Amin (bangunan sintetis); bake gedung"
```

---
## Task 20: Aset Blender N01–N04 + lapisan ornamen GLB distrik

**Files:**
- Create: `assets-src/blender/unri/n01-papan-batu-unri.blend`, `n02-huruf-nama-rektorat.blend`, `n03-kanopi-merah-rektorat.blend`, `n04-kubah-mozaik.blend`
- Create: `public/models/unri/n01-papan-batu-unri.glb`, `n02-huruf-nama-rektorat.glb`, `n03-kanopi-merah-rektorat.glb`, `n04-kubah-mozaik.glb`
- Create: `src/app/heroOrnaments.js`
- Modify: `src/main.js`
- Test: `tests/unri/unriModels.test.js`

Konvensi (katalog aset): meter, origin di tengah alas, **muka depan = +Y Blender** (= −Z three setelah `export_yup`), material `unri:<nama>`, material yang menyala malam berisi `emisif`. Skrip dijalankan lewat `mcp__blender__execute_blender_code`, tiap aset di **scene baru** (file Blender user tidak disentuh); `.blend` ditulis dengan `bpy.data.libraries.write` (hanya datablock aset).

- [ ] **Step 1: Prelude (sekali per sesi Blender)**

Cek dulu `mcp__blender__get_addon_status` (Blender ≥ 3.6). Lalu `execute_blender_code`:
```python
import bpy, bmesh, math, os, mathutils, runpy
REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
export_collection = runpy.run_path(os.path.join(REPO, "assets-src", "blender", "export_glb.py"))["export_collection"]
OUT_GLB = os.path.join(REPO, "public", "models", "unri")
OUT_BLEND = os.path.join(REPO, "assets-src", "blender", "unri")
os.makedirs(OUT_GLB, exist_ok=True)
os.makedirs(OUT_BLEND, exist_ok=True)

def scene_baru(nama):
    sc = bpy.data.scenes.get(nama) or bpy.data.scenes.new(nama)
    bpy.context.window.scene = sc
    col = bpy.data.collections.get(nama) or bpy.data.collections.new(nama)
    if col.name not in [c.name for c in sc.collection.children]:
        sc.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    return sc, col

def bahan(nama, rgb, kasar=0.8, logam=0.0, emisi=None):
    m = bpy.data.materials.get(nama) or bpy.data.materials.new(nama)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = kasar
    bsdf.inputs["Metallic"].default_value = logam
    if emisi is not None:
        sock = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        sock.default_value = (*emisi, 1.0)
        if bsdf.inputs.get("Emission Strength") is not None:
            bsdf.inputs["Emission Strength"].default_value = 1.0
    return m

def objek(nama, bm, mat, col):
    me = bpy.data.meshes.new(nama)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nama, me)
    ob.data.materials.append(mat)
    col.objects.link(ob)
    return ob

def kotak(bm, x0, x1, y0, y1, z0, z1):
    r = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(x1 - x0, y1 - y0, z1 - z0), verts=r["verts"])
    bmesh.ops.translate(bm, vec=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), verts=r["verts"])

def simpan_blend(col, nama):
    ids = {col} | set(col.all_objects) | {o.data for o in col.all_objects}
    for o in col.all_objects:
        for m in o.data.materials:
            if m:
                ids.add(m)
                for n in (m.node_tree.nodes if m.node_tree else []):
                    if n.type == "TEX_IMAGE" and n.image:
                        ids.add(n.image)
    path = os.path.join(OUT_BLEND, nama + ".blend")
    bpy.data.libraries.write(path, ids, compress=True)
    return path

print("prelude siap", bpy.app.version_string)
```
Expected: `prelude siap <versi>`. (`runpy.run_path` menjalankan `export_glb.py` sebagai modul dan mengambil `export_collection`; scene aktif = scene aset saat dipanggil.)

- [ ] **Step 2: N01 papan batu lengkung "UNIVERSITAS RIAU" (6 × 1,2 × 1,6 m)**

```python
sc, col = scene_baru("UNRI_N01")
batu = bahan("unri:batu-alam", (0.36, 0.33, 0.29), 0.95)
alas = bahan("unri:beton-alas", (0.6, 0.59, 0.56), 0.9)
huruf = bahan("unri:huruf-kuningan", (0.78, 0.62, 0.29), 0.35, 0.7)
R, T, H, L, N = 7.0, 0.5, 1.4, 6.0, 40
half = math.asin(L / 2 / R)
bm = bmesh.new()
cols = []
for i in range(N + 1):
    a = -half + 2 * half * i / N
    top = 0.2 + H - 0.12 * abs(math.sin(i * 2.3))          # puncak batu tidak rata
    fx, fy = R * math.sin(a), R - R * math.cos(a)            # muka depan, cekung ke +Y (depan)
    bx, by = (R + T) * math.sin(a), R - (R + T) * math.cos(a)
    cols.append([bm.verts.new((fx, fy, 0.2)), bm.verts.new((fx, fy, top)), bm.verts.new((bx, by, top)), bm.verts.new((bx, by, 0.2))])
for i in range(N):
    a, b = cols[i], cols[i + 1]
    for k in range(4):
        bm.faces.new((a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4]))
bm.faces.new(cols[0][::-1])
bm.faces.new(cols[-1])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
ob = objek("N01_batu", bm, batu, col)
sub = ob.modifiers.new("Halus", "SUBSURF")
sub.subdivision_type = "SIMPLE"
sub.levels = 2
sub.render_levels = 2
tex = bpy.data.textures.get("N01_awan") or bpy.data.textures.new("N01_awan", "CLOUDS")
tex.noise_scale = 0.35
disp = ob.modifiers.new("Kasar", "DISPLACE")
disp.texture = tex
disp.strength = 0.05
bm = bmesh.new()
kotak(bm, -L / 2 - 0.2, L / 2 + 0.2, -0.75, 0.65, 0.0, 0.2)
objek("N01_alas", bm, alas, col)
teks, jarak = "UNIVERSITAS RIAU", 0.33
for i, ch in enumerate(teks):
    if ch == " ":
        continue
    a = (i - (len(teks) - 1) / 2) * jarak / R
    cu = bpy.data.curves.new(f"N01_huruf_{i}", "FONT")
    cu.body = ch
    cu.size = 0.42
    cu.extrude = 0.015
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    o = bpy.data.objects.new(f"N01_huruf_{i}", cu)
    o.data.materials.append(huruf)
    col.objects.link(o)
    o.location = (-R * math.sin(a), R - R * math.cos(a) + 0.03, 0.95)
    o.rotation_euler = (math.pi / 2, 0.0, math.pi - a)   # muka +Y, terbaca kiri→kanan dari depan
print(export_collection("UNRI_N01", os.path.join(OUT_GLB, "n01-papan-batu-unri.glb")))
print(simpan_blend(col, "n01-papan-batu-unri"))
```
Expected: `(3, <segitiga ≤ 6000>, <KB>)` lalu path `.blend`. Verifikasi visual: `mcp__blender__look` (max_size 512) — papan melengkung cekung ke depan, huruf terbaca dari sisi +Y.

- [ ] **Step 3: N02 huruf nama Rektorat (18 × 0,3 × 1,5 m, emisif malam)**

```python
sc, col = scene_baru("UNRI_N02")
mat = bahan("unri:huruf-rektorat-emisif", (0.85, 0.72, 0.35), 0.4, 0.6, emisi=(1.0, 0.88, 0.69))
cu = bpy.data.curves.new("N02_teks", "FONT")
cu.body = "UNIVERSITAS RIAU"
cu.size = 2.0
cu.extrude = 0.15
cu.align_x = "CENTER"
cu.align_y = "BOTTOM_BASELINE"
o = bpy.data.objects.new("N02_teks", cu)
o.data.materials.append(mat)
col.objects.link(o)
o.rotation_euler = (math.pi / 2, 0.0, math.pi)   # muka +Y (= −Z three), terbaca kiri→kanan
bpy.context.view_layer.update()
w, h = o.dimensions.x, o.dimensions.y
o.scale = (18.0 / w, 1.5 / h, 1.0)
bpy.context.view_layer.update()
print("dimensi", tuple(round(v, 3) for v in o.dimensions))
print(export_collection("UNRI_N02", os.path.join(OUT_GLB, "n02-huruf-nama-rektorat.glb")))
print(simpan_blend(col, "n02-huruf-nama-rektorat"))
```
Expected: `dimensi (18.0, 1.5, 0.3)` lalu tuple ekspor dengan segitiga ≤ 4000 (bila lebih, ulangi baris ekspor dengan `ratios={"unri:huruf-rektorat-emisif": 0.6}`).

- [ ] **Step 4: N03 kanopi merah limas (8 × 8 × 5 m)**

```python
sc, col = scene_baru("UNRI_N03")
putih = bahan("unri:kolom-putih", (0.93, 0.92, 0.9), 0.7)
merah = bahan("unri:genteng-merah", (0.6, 0.1, 0.1), 0.65)
plafon = bahan("unri:plafon-emisif", (0.95, 0.93, 0.88), 0.8, emisi=(1.0, 0.92, 0.78))
EAVE, LIS, W, D = 3.3, 0.45, 9.6, 9.3
bm = bmesh.new()
for (x, y) in [(-3.8, -3.7), (-3.8, 3.7), (3.9, -3.7), (3.9, 3.7)]:   # = LAYOUT.kanopiTiang − pusat (21,7; 0)
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.225, radius2=0.225, depth=EAVE)
    bmesh.ops.translate(bm, vec=(x, y, EAVE / 2), verts=r["verts"])
kotak(bm, -W / 2, W / 2, -D / 2, -D / 2 + 0.25, EAVE, EAVE + LIS)
kotak(bm, -W / 2, W / 2, D / 2 - 0.25, D / 2, EAVE, EAVE + LIS)
kotak(bm, -W / 2, -W / 2 + 0.25, -D / 2, D / 2, EAVE, EAVE + LIS)
kotak(bm, W / 2 - 0.25, W / 2, -D / 2, D / 2, EAVE, EAVE + LIS)
objek("N03_rangka", bm, putih, col)
bm = bmesh.new()
pw, pd, z = (W - 0.5) / 2, (D - 0.5) / 2, EAVE + 0.02
vs = [bm.verts.new(p) for p in [(-pw, -pd, z), (-pw, pd, z), (pw, pd, z), (pw, -pd, z)]]
bm.faces.new(vs)   # urutan searah jarum jam dilihat dari atas → normal ke bawah (−Z)
objek("N03_plafon", bm, plafon, col)
bm = bmesh.new()
r = bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=math.sqrt(0.5), radius2=0.0, depth=1.0)
bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=mathutils.Matrix.Rotation(math.pi / 4, 3, "Z"), verts=r["verts"])
bmesh.ops.scale(bm, vec=(W + 0.6, D + 0.6, 1.5), verts=r["verts"])
bmesh.ops.translate(bm, vec=(0, 0, EAVE + LIS + 0.75), verts=r["verts"])
objek("N03_atap", bm, merah, col)
print(export_collection("UNRI_N03", os.path.join(OUT_GLB, "n03-kanopi-merah-rektorat.glb")))
print(simpan_blend(col, "n03-kanopi-merah-rektorat"))
```
Expected: tuple ekspor (segitiga ≤ 3000). `look`: 4 tiang putih, lisplang, limas merah; puncak ±5,0 m.

- [ ] **Step 5: N04 kubah mozaik + mahkota bulan sabit (Ø 10 × 8 m)**

```python
sc, col = scene_baru("UNRI_N04")
img = bpy.data.images.get("N04_mozaik") or bpy.data.images.new("N04_mozaik", 256, 256)
UNGU, PUTIH, BIRU, NAT = (0.36, 0.30, 0.62), (0.95, 0.95, 0.97), (0.25, 0.39, 0.66), (0.55, 0.55, 0.60)
px = []
for j in range(256):
    for i in range(256):
        d = abs((i + 0.5) / 256 - 0.5) + abs((j + 0.5) / 256 - 0.5)   # jarak "wajik" ke pusat sel
        c = NAT if abs(d - 0.5) < 0.025 else (UNGU if d < 0.30 else (PUTIH if d < 0.5 else BIRU))
        px.extend((c[0], c[1], c[2], 1.0))
img.pixels = px
try:
    img.pack()
except RuntimeError:
    pass
mozaik = bahan("unri:kubah-mozaik", (1.0, 1.0, 1.0), 0.35, 0.1)
tn = mozaik.node_tree.nodes.new("ShaderNodeTexImage")
tn.image = img
bsdf = next(n for n in mozaik.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
mozaik.node_tree.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
emas = bahan("unri:mahkota-emas", (0.83, 0.65, 0.23), 0.3, 0.85)
PROF = [(5.0, 0.0), (4.95, 0.9), (4.75, 1.8), (4.35, 2.7), (3.7, 3.6), (2.85, 4.4), (1.8, 5.1), (0.8, 5.6), (0.0, 5.9)]
SEG = 40
bm = bmesh.new()
grid = [[bm.verts.new((r * math.cos(2 * math.pi * s / SEG), r * math.sin(2 * math.pi * s / SEG), z)) for (r, z) in PROF] for s in range(SEG)]
uv = bm.loops.layers.uv.new("UVMap")
for s in range(SEG):
    a, b = grid[s], grid[(s + 1) % SEG]
    for k in range(len(PROF) - 1):
        f = bm.faces.new((a[k], b[k], b[k + 1], a[k + 1]))
        for loop in f.loops:
            col_i = s + (1 if loop.vert in (b[k], b[k + 1]) else 0)
            row = k + (1 if loop.vert in (a[k + 1], b[k + 1]) else 0)
            loop[uv].uv = (col_i / SEG * 20.0, row / (len(PROF) - 1) * 5.0)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
objek("N04_kubah", bm, mozaik, col)
TOP = 5.9
bm = bmesh.new()
r = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.22, radius2=0.16, depth=0.9)
bmesh.ops.translate(bm, vec=(0, 0, TOP + 0.4), verts=r["verts"])
for (rad, z) in [(0.32, TOP + 1.1), (0.24, TOP + 1.55)]:
    r = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=10, radius=rad)
    bmesh.ops.translate(bm, vec=(0, 0, z), verts=r["verts"])
RM, RT, NM, NT, ARC = 0.55, 0.08, 28, 8, math.pi * 1.45
start = math.pi / 2 + (2 * math.pi - ARC) / 2    # celah busur berpusat di atas
rings = []
for i in range(NM + 1):
    t = start + ARC * i / NM
    ring = []
    for j in range(NT):
        p = 2 * math.pi * j / NT
        rr = RM + RT * math.cos(p)
        ring.append(bm.verts.new((rr * math.cos(t), RT * math.sin(p), TOP + 2.3 + rr * math.sin(t))))
    rings.append(ring)
for i in range(NM):
    for j in range(NT):
        bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][(j + 1) % NT], rings[i][(j + 1) % NT]))
bm.faces.new(rings[0][::-1])
bm.faces.new(rings[-1])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
objek("N04_mahkota", bm, emas, col)
print(export_collection("UNRI_N04", os.path.join(OUT_GLB, "n04-kubah-mozaik.glb")))
print(simpan_blend(col, "n04-kubah-mozaik"))
```
Expected: tuple ekspor (segitiga ≤ 8000). `look`: kubah wajik putih–ungu–biru, bulan sabit emas menghadap atas; alas kubah di z = 0.

- [ ] **Step 6: Ukuran berkas**

Run: `ls -la public/models/unri/`
Expected: empat `.glb`, total < 1,5 MB (budget GLB baru seluruh kampus ≤ 6 MB, spec §9.1).

- [ ] **Step 7: Tes keberadaan model**

```js
// tests/unri/unriModels.test.js
import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { rektoratModelItems } from '../../src/regions/unri-rektorat/index.js';
import { HERO_ORNAMENTS } from '../../src/world/kit/hero/index.js';

describe('model GLB M6 (N01–N04) ada di public/ dan berukuran wajar', () => {
  const paths = [...rektoratModelItems({ hAt: () => 0 }).map((m) => m.path), ...HERO_ORNAMENTS.map((o) => o.path)];
  it.each(paths)('%s', (path) => {
    const file = `public/${path}`;
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(1000);
    expect(statSync(file).size).toBeLessThan(1_000_000);
  });
});
```
Run: `node node_modules/vitest/vitest.mjs run tests/unri/unriModels.test.js`
Expected: PASS (4 tes).

- [ ] **Step 8: Buat `src/app/heroOrnaments.js`**

```js
// src/app/heroOrnaments.js
/**
 * Lapisan ornamen GLB hero DISTRIK (M6; N04 kubah mozaik Masjid Arfa'unnas). Hero distrik digabung per
 * material per klaster sehingga pola `replaces` tidak berlaku; GLB dimuat sekali ke scope sendiri,
 * diletakkan di koordinat dunia (y = tanah + yAboveGround, dihitung ulang saat versi terrain berubah),
 * tampil ≤ ORNAMENT_VISIBLE_M dari fokus, dan placeholder prosedural disembunyikan lewat registry material
 * (src/world/kit/hero/ornaments.js). Gagal muat → placeholder tetap tampil (spec §10).
 */
import * as THREE from 'three';
import { createResourceScope, withScope } from '../engine/ResourceScope.js';
import { disposeTree } from '../engine/disposeTree.js';
import { instantiateModel } from '../world/assets/models.js';
import { HERO_ORNAMENTS } from '../world/kit/hero/index.js';
import { setOrnamentLoaded } from '../world/kit/hero/ornaments.js';

export const ORNAMENT_VISIBLE_M = 900;

/**
 * @param {{scene: THREE.Scene, terrain?: {heightAt(x:number, z:number):number, version?:number}|null,
 *   items?: ReadonlyArray<{assetId:string, path:string, x:number, z:number, rotY:number, yAboveGround:number}>,
 *   logger?: {warn: Function}}} opts
 */
export function createHeroOrnamentLayer({ scene, terrain = null, items = HERO_ORNAMENTS, logger = console }) {
  const scope = createResourceScope('heroOrnaments');
  const group = new THREE.Group();
  group.name = 'ornamenHero';
  scene.add(group);
  const placed = [];
  let disposed = false;
  let lastVersion = Number.NaN;
  const groundAt = (x, z) => terrain?.heightAt?.(x, z) ?? 0;
  const place = ({ it, obj }) => obj.position.set(it.x, groundAt(it.x, it.z) + it.yAboveGround, it.z);
  const ready = Promise.allSettled(items.map(async (it) => {
    const obj = await withScope(scope, () => instantiateModel(it.path, { rotY: it.rotY }));
    if (disposed) return;
    obj.name = it.assetId;
    const entry = { it, obj };
    place(entry);
    group.add(obj);
    placed.push(entry);
    setOrnamentLoaded(it.assetId, true);
  })).then((results) => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') logger.warn(`Ornamen ${items[i].assetId} (${items[i].path}) gagal dimuat; placeholder prosedural dipakai:`, r.reason);
    });
    return { placed: placed.length, failed: results.filter((r) => r.status === 'rejected').length };
  });
  return {
    group,
    ready,
    /** Tiap frame: posisi y ikut versi terrain; tampil hanya dalam jarak dari fokus. */
    update(focus) {
      const v = terrain?.version ?? 0;
      if (v !== lastVersion) {
        lastVersion = v;
        placed.forEach(place);
      }
      for (const { it, obj } of placed) obj.visible = !focus || Math.hypot(focus.x - it.x, focus.z - it.z) <= ORNAMENT_VISIBLE_M;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const it of items) setOrnamentLoaded(it.assetId, false);
      group.removeFromParent();
      disposeTree(group, { scope });
      scope.dispose();
    },
  };
}
```

- [ ] **Step 9: Pasang lapisan di `src/main.js`**

Tambahkan impor:
```js
import { createHeroOrnamentLayer } from './app/heroOrnaments.js';
```
Lalu tepat SETELAH distrik UNRI dipasang (baris yang memanggil `mountDistrict(` dari M1), tambahkan — `terrain` = layanan terrain di main.js (plan M0: `const terrain = createTerrainService();`, objek `{ field, heightAt, …, get version }`):
```js
  const heroOrnaments = createHeroOrnamentLayer({ scene: app.scene, terrain });
  lifecycle.add(() => heroOrnaments.dispose());
  app.addSystem({ id: 'heroOrnaments', phase: 'world', update: (dt, ctx) => heroOrnaments.update(ctx.focus ?? ctx.bikePos) });
```
Run: `grep -n "heroOrnaments" src/main.js`
Expected: 4 baris (impor + 3 baris di atas).

- [ ] **Step 10: Uji di dev server**

Di konsol dev (`__sim`):
```js
__sim.teleport(-1022, 1316, 0.2);
await new Promise((r) => setTimeout(r, 15000));
const orn = __sim.app.scene.getObjectByName('ornamenHero');
[orn?.children.map((c) => c.name), orn?.children[0]?.visible, __sim.app.scene.getObjectByName('region:unri-rektorat')?.getObjectByName('N02')?.visible]
```
Expected: `[['N04'], true, false]` (GLB kubah tampil; placeholder huruf N02 tersembunyi karena GLB N02 termuat). Kubah prosedural tidak tampil ganda (material placeholder `visible = false`).

- [ ] **Step 11: Tes, lint, commit**

Run: `npm test` lalu `npm run lint` → PASS, 0 galat.

```bash
git add assets-src/blender/unri public/models/unri src/app/heroOrnaments.js src/main.js tests/unri/unriModels.test.js
```
```bash
git commit -m "feat(aset-unri): Blender N01-N04 (papan batu, huruf Rektorat, kanopi merah, kubah mozaik) + lapisan ornamen GLB distrik"
```

**Cadangan (Blender MCP tidak tersedia):** lewati Step 1–7 dan 10; Step 8–9 tetap dikerjakan (lapisan mencoba memuat GLB yang tidak ada → `warn` sekali, placeholder tetap). `tests/unri/unriModels.test.js` TIDAK dibuat; catat "N01–N04 placeholder" di status indeks dan Serah terima.

---

## Task 21: Ukur budget draw call + screenshot titik ukur M6

**Files:**
- Create: `tests/e2e/unri-m6.shots.mjs`
- Create: `docs/screenshots/unri/m6-rektorat-siang.jpg`, `m6-masjid-sore.jpg`, `m6-danau-malam.jpg`, `m6-ggm.jpg`, `m6-gerbang-sm-amin.jpg`

**Cara ukur (dipakai skrip):** draw call region = `renderer.info.render.calls` satu `renderFrame()` penuh (termasuk pass bayangan) **dikurangi** calls pada frame yang sama dengan grup `region:unri-rektorat` disembunyikan — teknik yang sama dengan `tileCalls` di `tests/e2e/smoke.e2e.mjs`. Batas 250 (spec §9.1). Proxy diukur dari stadion (region tidak terpasang): jumlah mesh terlihat di grup `proxy:unri-rektorat` ≤ 8.

- [ ] **Step 1: Buat `tests/e2e/unri-m6.shots.mjs`**

```js
#!/usr/bin/env node
/**
 * Titik ukur & screenshot tonggak M6 (zona Rektorat + hero building) — TIDAK ikut vitest.
 *   node tests/e2e/unri-m6.shots.mjs [--gpu d3d11|swiftshader] [--out laporan.json]
 * Vite (port 5176) → Chromium headless 1280×720 → per shot: jam & cuaca cerah, kamera orang ketiga,
 * teleport sepeda, tunggu region unri-rektorat siap bila relevan, jeda, lalu JPEG ke docs/screenshots/unri/.
 * Mengukur: draw call region (calls semua − calls dengan grup region disembunyikan, frame sama; ≤ 250),
 * proxy dari stadion (≤ 8 mesh terlihat), ornamen N04 termuat. Exit 1 bila budget dilanggar / galat konsol.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5176;
const OUT_DIR = join(ROOT, 'docs', 'screenshots', 'unri');
const LIMITS = Object.freeze({ regionCalls: 250, proxyMeshes: 8 });
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
/** Pose sepeda DUNIA (yaw konvensi sepeda: maju = (sin, cos)); `region` = tunggu region siap. */
const SHOTS = Object.freeze([
  { file: 'm6-rektorat-siang.jpg', hour: 10.5, x: -900.0, z: 803.0, yaw: -Math.PI / 2, region: true, measure: true },
  { file: 'm6-masjid-sore.jpg', hour: 17.0, x: -1022.0, z: 1316.0, yaw: 0.2, region: true },
  { file: 'm6-danau-malam.jpg', hour: 20.5, x: -723.8, z: 787.3, yaw: -0.6, region: true },
  { file: 'm6-ggm.jpg', hour: 9.0, x: 133.0, z: 338.0, yaw: 0, region: false },
  { file: 'm6-gerbang-sm-amin.jpg', hour: 15.0, x: 240.0, z: 696.0, yaw: -Math.PI / 2, region: false },
]);

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

/** Fungsi yang dievaluasi di halaman (window.__sim dari src/app/devtools.js). */
const PAGE = {
  async pose({ hour, x, z, yaw, region }) {
    const s = window.__sim;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    s.rig.exitPov?.();
    s.store.set('sky.advanceTime', false);
    s.store.set('sky.hour', hour);
    s.store.set('weather.raining', false);
    s.store.set('camera.mode', 'third');
    s.teleport(x, z, yaw);
    const t0 = performance.now();
    while (region && performance.now() - t0 < 60000) {
      if (s.app.scene.getObjectByName('region:unri-rektorat')?.userData?.ready) break;
      await sleep(250);
    }
    await sleep(6000); // klaster distrik, GLB, bayangan
    return { regionReady: Boolean(s.app.scene.getObjectByName('region:unri-rektorat')?.userData?.ready), waitedMs: Math.round(performance.now() - t0) };
  },
  regionCalls() {
    const s = window.__sim;
    const g = s.app.scene.getObjectByName('region:unri-rektorat');
    if (!g) return { ok: false };
    const info = s.app.renderer.info.render;
    s.app.renderFrame();
    const all = info.calls;
    g.visible = false;
    s.app.renderFrame();
    const without = info.calls;
    g.visible = true;
    return { ok: true, calls: all - without, total: all };
  },
  async proxyFromStadion() {
    const s = window.__sim;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    s.teleport(0, -275, 0);
    const t0 = performance.now();
    while (performance.now() - t0 < 60000 && s.app.scene.getObjectByName('region:unri-rektorat')) await sleep(250);
    await sleep(1000);
    const p = s.app.scene.getObjectByName('proxy:unri-rektorat');
    let meshes = 0;
    p?.traverse((o) => { if (o.isMesh && o.visible) meshes += 1; });
    return { unmounted: !s.app.scene.getObjectByName('region:unri-rektorat'), proxy: Boolean(p), meshes };
  },
  ornaments() {
    const g = window.__sim.app.scene.getObjectByName('ornamenHero');
    return { layer: Boolean(g), loaded: g ? g.children.map((c) => c.name) : [] };
  },
};

function verdict(report) {
  const f = [];
  const m = report.measure;
  if (!m?.ok || !(m.calls <= LIMITS.regionCalls)) f.push(`draw call region ${m?.calls} > ${LIMITS.regionCalls}`);
  const p = report.proxy;
  if (!p?.unmounted || !p.proxy || !(p.meshes <= LIMITS.proxyMeshes)) f.push(`proxy: ${JSON.stringify(p)}`);
  if (report.shots.some((s) => s.region && !s.regionReady)) f.push('region tidak siap pada shot bertanda region');
  if (report.errors.length) f.push(`${report.errors.length} galat konsol/HTTP`);
  return f;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const report = { gpu: opts.gpu, shots: [], errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (msg) => { if (msg.type() === 'error') report.errors.push(msg.text()); });
    page.on('response', (res) => { if (res.status() >= 400) report.errors.push(`HTTP ${res.status()} ${res.url()}`); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app, null, { timeout: 240000 });
    for (const shot of SHOTS) {
      process.stderr.write(`[m6] ${shot.file}…\n`);
      const r = await page.evaluate(PAGE.pose, shot);
      if (shot.measure) report.measure = await page.evaluate(PAGE.regionCalls);
      await page.screenshot({ path: join(OUT_DIR, shot.file), type: 'jpeg', quality: 82 });
      report.shots.push({ file: shot.file, region: shot.region, ...r });
    }
    report.ornaments = await page.evaluate(PAGE.ornaments);
    report.proxy = await page.evaluate(PAGE.proxyFromStadion);
  } finally {
    await browser.close();
    await server.close();
  }
  const fails = verdict(report);
  report.pass = fails.length === 0;
  report.failures = fails;
  const json = JSON.stringify(report, null, 2);
  if (opts.out) writeFileSync(opts.out, json);
  process.stdout.write(`${json}\n`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Jalankan (GPU)**

Run: `node tests/e2e/unri-m6.shots.mjs --gpu d3d11`
Expected: JSON dengan `"pass": true`, `measure.calls` ≤ 250 (perkiraan 60–120 termasuk pass bayangan), `proxy.meshes` = 7, `ornaments.loaded` = `["N04"]` (atau `[]` bila Task 20 memakai cadangan), lima JPEG di `docs/screenshots/unri/`.

Bila `measure.calls` > 250, mitigasi berurutan (spec §9.3, versi region ini): (1) set `castShadow = false` pada mesh `kerb`, `rektoratMullion`, `rektoratTransom`, bidang kaca (`addPlaneX/addPlaneZ` sudah tanpa cast) dan pada `createLampPosts`; (2) turunkan akasia ke 2 baris (hapus baris luar `-9.5` & `17.8` di layout.js, perbarui tes jumlah 48 → 24); ukur ulang.

- [ ] **Step 3: Tinjau screenshot terhadap foto rujukan**

Baca kelima JPEG (alat `Read` gambar). Cocokkan dengan riset:
- `m6-rektorat-siang.jpg`: gedung putih ±5 lt simetris, pita gelap horizontal + sunshade di sayap, blok tengah kaca biru vertikal + huruf di puncak, parapet gelap, kanopi merah di depan, palem & tiang bendera, poros berpohon ramping.
- `m6-masjid-sore.jpg`: massa krem 2 lt, arkade ogee berulang atas & bawah, tangga putih besar ke lt 2 di fasad utara, kubah wajik putih–ungu/biru + bulan sabit, huruf di parapet, pelataran aspal bermarka.
- `m6-danau-malam.jpg`: air danau (distrik), batu pijakan timbul ±0,1 m di atas air, PJU menyala + kolam cahaya, jendela Rektorat sebagian menyala. **Bila batu terendam atau melayang** > 0,15 m: bandingkan `waterLevel(env)` (danau.js) dengan `areas[].level` air Danau Buatan di `public/districts/unri/ground/-2_1.json` (hasil `tools/campusbake/ground/waterLevel.js`, M2), setel `DANAU.offsetMuka` agar sama; ulangi shot.
- `m6-ggm.jpg`: atap gasing seng di atas cincin kolom, undakan semen, ilalang, tanah merah, coretan.
- `m6-gerbang-sm-amin.jpg`: dua pilar + balok "UNIVERSITAS RIAU", pos satpam, spanduk kuning.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/unri-m6.shots.mjs docs/screenshots/unri/m6-rektorat-siang.jpg docs/screenshots/unri/m6-masjid-sore.jpg docs/screenshots/unri/m6-danau-malam.jpg docs/screenshots/unri/m6-ggm.jpg docs/screenshots/unri/m6-gerbang-sm-amin.jpg
```
```bash
git commit -m "test(e2e): ukur draw call region unri-rektorat & proxy, screenshot titik ukur M6"
```

---

## Task 22: Penutup tonggak

**Files:**
- Modify: `docs/superpowers/plans/2026-10-17-unri-00-index.md`

- [ ] **Step 1: Verifikasi penuh**

Run berurutan:
```bash
npm test
```
```bash
npm run lint
```
```bash
npm run build
```
```bash
npm run e2e -- --gpu d3d11
```
Expected: semua tes lulus (jumlah = baseline Task 0 + tes M6), lint 0 galat, build sukses, E2E lama `pass` (paritas stadion, siklus memori region, perjalanan cepat tidak terdampak).

- [ ] **Step 2: Perbarui indeks**

Di `docs/superpowers/plans/2026-10-17-unri-00-index.md`:
1. Baris status M6: `| M6 | selesai | <hash commit Task 21> | region unri-rektorat (<calls> draw call, proxy 7), hero masjid/gerbang/GGM, N01–N04 <final|placeholder> |`.
2. Di bagian peta file "M6", tambahkan baris **Deviasi**: `Ubah tambahan: tools/campusbake/buildings.js (bangunan sintetis gerbang), src/app/mountRegion.js (registry basah lateRoot bersyarat, bila belum ada). File baru tambahan: src/regions/unri-rektorat/{site.data.js, materials.js, env.js, staged.js}, src/world/kit/hero/{heroFrame.js, reliefText.js, ornaments.js}, src/world/props/unri/{akasiaRamping.js, palem.js}, src/app/heroOrnaments.js, tests/e2e/unri-m6.shots.mjs. Id hero baru 'hero:perpustakaan-lama' (katalog H08). Ekspor baru: HERO_ORNAMENTS (hero/index.js), SYNTHETIC_BUILDINGS (buildings.data.js).`

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-10-17-unri-00-index.md
```
```bash
git commit -m "docs(unri): status M6 selesai + catatan deviasi peta file"
```

---

## Self-review

**Cakupan spec §8.3 & permintaan tonggak:**
- Rektorat H04: putih ±5 lt simetris (slab + blok tengah disimetriskan), blok tengah menonjol kaca biru vertikal (6 sirip, 5 bilah) + huruf nama di puncak (N02), sayap dengan pita sunshade horizontal berulang (spandrel + pita kaca + sunshade per lantai, kedua fasad panjang), atap datar dengan parapet gelap, lobi kaca hangat, teras granit + 4 anak tangga, kanopi merah limas sederhana N03 (selembayung tidak dipasang), palem, tiang bendera, lampu malam (16 PJU + jendela + lobi + plafon kanopi + huruf) — Task 8, 10, 14. ✔
- Bundaran (drape + taman tengah) Task 12; Danau (air distrik, batu pijakan P11, papan batu N01, trotoar tinggi, titian way 783152923 yang diserahkan M2) Task 11; Perpustakaan lama 4 massa 2 lt Task 9; poros taman (V04 + V05 + bangku) Task 10. ✔
- Region: placement Task 1; mask tidak beririsan + dites Task 2; pads Task 2; collider dites Task 4; layout dites Task 3; proxy ≤ 8 Task 13 (dites Task 14, diukur Task 21). ✔
- Hero kit: Masjid (27 × 27 m 2 lt, krem + list oker, ogee berulang serambi atas-bawah, tangga keramik putih langsung ke lt 2, kubah mozaik wajik tekstur canvas, mahkota bulan sabit, toa, huruf timbul, pelataran motor) Task 16; Gerbang SM Amin + pos satpam + spanduk kuning N08 Task 17; GGM (Ø ±82 m gasing, atap terpasang, tiang & undakan semen kasar, ilalang, tanah merah, coretan) Task 18; override ketiganya + sintetis Task 19. ✔
- Blender N01–N04 (skrip bpy konkret + ekspor + cadangan prosedural) Task 20; budget ≤ 250 + cara ukur + screenshot `m6-*` Task 21. ✔

**Placeholder/ambiguitas:** tiga titik bergantung pada kode M3/M4 yang belum ada saat plan ditulis — nama ekspor tabel override (M3), bentuk entri pad di `tools/campusbake/config.js` (M4), dan tempat entri gedung dibentuk di `tools/campusbake/buildings.js` (M3). Masing-masing punya perintah `grep` persis, aturan adaptasi tunggal (pakai nama/bentuk M3/M4, isi tetap), dan tes yang menangkap kesalahan (`heroBuilders.test.js` menemukan tabel lewat kunci `w282225347`; `rektoratMask.test.js` menemukan region lembaga lewat `id`).

**Konsistensi nama (diselaraskan dengan plan M0, M2, M4, M7 yang sudah ada):** kontrak M0 (`mountRegion` ctx `terrain/heightAtLocal/schedule`, `proxy({scope, placement, terrain})`, `pose(frame, {time, bike})`, pad `{ring, y}`), M2 (`drapePolyline(pts, width, field, {lift, segment})`, `drapePolygon(rings, field, {lift, maxEdge})`, `isReserved`, titian), M4 (`REGION_PADS` + `…PadsWorld()`, `heroRegions`), M7 (`defOf(module, 'unri-rektorat')`, grep `id: 'unri-rektorat'`). `unriRektoratRegion`, `REKTORAT_ID = 'unri-rektorat'`; kunci `HERO_BUILDERS` `hero:rektorat|hero:masjid-arfaunnas|hero:gerbang-sm-amin|hero:ggm` sesuai spec §7.1; `hero:perpustakaan-lama` = katalog H08. Grup placeholder `N01`/`N02`/`N03` = `replaces` di `rektoratModelItems`; `N04` = assetId registry + `HERO_ORNAMENTS`. Grup `region:unri-rektorat`, `proxy:unri-rektorat`, `ornamenHero` dipakai skrip E2E. `floorY/ROOF_Y/LEVEL/addBox` diekspor rektorat.js dan dipakai proxy.js, perpustakaan.js, index.js.

**Fakta vs inferensi:** setiap modul membuka dengan komentar [T]/[S]/[INFERENSI]; override membawa `sumber` + `keyakinan` (gerbang `rendah`, GGM & perpustakaan `sedang`). Teks huruf puncak Rektorat ("UNIVERSITAS RIAU") & warnanya, isi coretan, desain gerbang, spesies akasia, lintasan batu pijakan ditandai inferensi.

**Risiko yang diterima (bukan celah plan):** muka air danau dihitung ulang dari aturan spec (kenop `DANAU.offsetMuka` + cek visual Task 21); pilar gerbang tidak masuk collider (hanya pos satpam); vegetasi distrik M2 mungkin menanam pohon di dalam mask region (Serah terima butir 4).

---

## Serah terima ke M7

1. **Fast travel**: plan M7 memakai "Kampus UNRI — Rektorat" di dunia `(-979, 860)` yaw π — titik itu ±6 m di luar mask (selatan Rektorat), dapat dilalui collider distrik dan region terpasang di sana; cocok. Alternatif yang menghadap fasad depan: dunia `(-885.8, 804.2)` yaw `-Math.PI / 2` (jalan setapak poros).
2. **Cerita chapter 6** (plan M7, titik `region:'world'`): penanda keliling danau M7 (−698,0; 806,0) (−758,6; 859,8) (−846,4; 894,3) (−785,4; 820,2) sudah dicek terhadap `rektoratColliders` (lokal (287,8; 6,0) (227,2; 59,8) (139,4; 94,3) (200,4; 20,2)): semuanya dapat dilalui, di luar air, tidak menabrak papan N01/tiang. Titik cadangan dunia: ujung poros (−780,8; 804,2), taman putaran (−696,8; 819,5), trotoar selatan (−760,8; 857,4). Papan batu N01 dunia (−700,3; 810,0), muka ke timur.
3. **Motor parkir** (`src/districts/unri/motorParking.js`): pelataran Masjid Arfa'unnas — `masjidMotorBays()` (70 bay dunia + yaw) dari `src/world/kit/hero/masjidArfaunnas.js`. Pulau tengah parkir depan Rektorat (lokal x 43,3–62,2, z −15,4…19,5) adalah taman bertiang bendera — jangan diisi motor.
4. **Vegetasi & reservasi mask**: akasia ramping & palem poros SUDAH di region (`LAYOUT.akasia/palem`); prop V04/V05 tersedia di `src/world/props/unri/{akasiaRamping,palem}.js` untuk distrik di luar mask. Task 15 Step 2 membuat `heroRegions` + `isReserved` di `main.js` (Serah terima M2 butir 6) — M7 memakai ulang `heroRegions` untuk `excludeAt` (jangan dideklarasikan ulang). Titian Danau Buatan (way 783152923, Serah terima M2 butir 6) dibangun di `danau.js`.
5. **Easter egg GGM**: pusat panggung dunia `(133.13, 407.41)`, celah tribun menghadap selatan; coretan berisi kata netral.
6. **Katalog aset**: N01–N04 berstatus `final` (atau `placeholder` bila Task 20 memakai cadangan); foto Commons (CC BY-SA 4.0) adalah rujukan, bukan aset — tidak perlu atribusi aset, cukup sumber di dokumen.
7. **Titik ukur §9.2** `rektorat (−979, 860)` berada ±6 m di luar mask (selatan Rektorat, dekat Musholla) — tetap valid sebagai posisi kamera (region terpasang di sana); untuk draw call region pakai pose shot `m6-rektorat-siang` (−900, 803).
8. **Risiko terbuka**: muka air danau vs air distrik (kenop `DANAU.offsetMuka`); posisi gerbang = fallback batas kampus (keyakinan rendah) — bila foto/konfirmasi user menempatkan gerbang di ujung Jl. SM Amin, jalankan ulang Task 17 Step 2 dengan `GX=565` dan perbarui `SYNTHETIC_BUILDINGS`; kondisi GGM 2026 tidak diketahui.
