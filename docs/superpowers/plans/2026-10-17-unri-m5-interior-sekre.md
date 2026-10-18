# M5 Interior Sekre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Proses ringan (memori user `lightweight-process-hobby`): satu implementer, satu review di akhir tonggak, TDD hanya
> untuk logika murni/berisiko (spec §11). Kode visual: implementasi + smoke di browser + screenshot.

**Goal:** Ruang sekretariat ormawa (sebelah sekre BEM, Zona Lembaga) yang bisa dimasuki lewat pintu-portal (E →
fade → scene interior terpisah), dijelajahi berjalan kaki (orang pertama, V → orang ketiga), hidup (3–6 NPC
beraktivitas sesuai jam game), punya ≥ 10 barang interaktif, cahaya mengikuti jam & cuaca, suara prosedural, dan
mode foto 4 preset + kamera bebas — terasa seperti sekre mahasiswa Indonesia sungguhan, bukan kotak kosong.

**Architecture:** `defineInterior` (kontrak murni, spec §4.8) → `src/interiors/sekre/index.js` membangun
`THREE.Scene` sendiri di `ResourceScope` interior. `src/app/interiorPortal.js` (stub M4 → penuh) menjalankan mesin
state `outside → fadingIn → inside → fadingOut → outside`: `App.setView({scene, camera})` mengganti scene/kamera
yang dirender (RenderPass, GTAO, Outline, label), `App.setSystemGate` menjeda sistem eksterior tanpa mencabutnya
(jam & cuaca tetap jalan), lalu memasang `Walker` + `InteriorCameraRig` + sistem interaksi. Keluar = interior dilepas
penuh (dispose → `disposeTree` → `scope.dispose`) dan sepeda tidak disentuh. NPC memakai Humanoid yang dipanggang
menjadi satu `SkinnedMesh` per orang (1 draw call) dengan pose prosedural (`Humanoid.poses.js`) dan jadwal murni
(`activitySchedule.js`).

**Tech Stack:** Three.js r186 (SkinnedMesh, PMREM + RoomEnvironment, CanvasTexture, GTAOPass lazy yang ada),
Web Audio lewat `AudioBus` (Karplus-Strong + buffer derau prosedural), Vitest (+ jsdom untuk rig kamera),
Playwright GPU (`tests/e2e/interior.e2e.mjs`), Blender lewat Blender MCP + `assets-src/blender/export_glb.py`.

Dokumen acuan: spec `docs/superpowers/specs/2026-10-17-unri-kampus-design.md` §4.8–§4.10, §8.2, §9, §10, §11;
katalog `docs/superpowers/specs/2026-10-17-unri-asset-catalog.md` bagian 6–7; riset
`docs/research/kampus-unri-bina-widya.md` §3, §4, §6; indeks `docs/superpowers/plans/2026-10-17-unri-00-index.md`.

---

## Prasyarat

M0–M4 selesai (lihat tabel status di indeks). M5 memakai API ini **persis** (nama dari "Serah terima ke M1" plan M0
dan "Serah terima ke M5" plan M4):

| Dari | API | Dipakai di |
|---|---|---|
| M0 | `createRegionLayer` di `main.js` → `{ regions, scheduler, terrain, colliders }`; `regions.active() -> [{ def, region, frame }]`, `regions.frameOf(id) -> frame\|null` | portal: daftar pintu, posisi keluar |
| M0 | sistem `'regions'` (sim, dijeda di dalam) dan `'scheduler'` (ui, **tetap jalan** di dalam) | whitelist `KEEP_INSIDE` |
| M0 | `handleKeys(input, { rig, hud, ents, shop, time, store, story, travelMenu })` (tanpa `frame`; cerita koordinat dunia), `addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story, travel })` | Task 10 keymap & main |
| M0 | POV `Digit1`–`Digit8` (Digit8 = POV region); `window.__sim` + `regions, scheduler, terrain` | tombol 1–4 interior hanya di mode foto, eksterior dijeda |
| M4 | `src/regions/unri-lembaga/portalDoors.js` → `PORTAL_DOORS` (+`roomIndex`), `sekreExitTo()`; region mengembalikan `portals`; `door.yaw` = arah hadap orang yang KELUAR pintu (ke selasar), konvensi entitas | portal, `main.js` (exitTo) |
| M4 | `src/app/portalTrigger.js` (`nearestPortal`, `createPortalTrigger` → sistem `portal.trigger`/`portal.prompt`), `src/ui/FadeOverlay.js` (`createFadeOverlay(root,{ms}) → { fade(0\|1), dispose }`), `src/app/appView.js` (`appViewPort`, memakai `App.setView` bila ada) | pemicu pintu & fade dipakai ulang |
| M4 | `src/app/interiorPortal.js` stub (`createInteriorPortal` berport, `createStubInterior`, `appStage`) + `tests/unri/interiorPortal.test.js`; `main.js` `setupPortal(...)` → `portalKit`, `window.__sim.portal = portalKit.portal` | diganti di Task 10, stub dihapus Task 20 |
| M4 | `tests/e2e/lembaga.e2e.mjs` (siklus portal 3×) | harus tetap lulus |
| repo | `App` (`src/core/App.js`), `CameraRig`, `cameraMath`, `Input`, `gamepad`, `TouchControls`, `HUD`, `AudioBus`, `Humanoid*`, `TimeOfDay`, `Weather`, `ResourceScope`, `disposeTree`, `freezeStatic`, `mergeByMaterial`, `instantiateModel` | lihat task |

Konvensi pintu (M4, cocok dengan plan ini): `door.yaw` menghadap ke selasar; ruang interior menghadap ke dalam, jadi
yaw dunia sumbu +Z ruang = `door.worldYaw + ROOM_YAW_OFFSET` dengan `ROOM_YAW_OFFSET = π`
(`src/interiors/sekre/data.js`). Dipakai hanya untuk arah sinar matahari di jendela. Sekre pemain = ruang indeks 1
(papan "UKM SENI", sebelah "BEM UNIVERSITAS RIAU"); pusat ruang 6,29 m dari mulut barat & 10,48 m dari mulut timur
selasar (M4).

Perintah dasar (Windows, dari root repo `C:\Users\mocha\Documents\stadion-utama-riau-3d`):
- Tes cepat: `node node_modules/vitest/vitest.mjs run <path>`; semua: `npm test`
- Lint: `npm run lint`; build: `npm run build`
- Dev server: `preview_start` nama `stadion-dev` (port 5173) atau Playwright ke `http://localhost:5173`
- Commit: `git add <file…>` lalu **perintah terpisah** `git commit -m "<pesan>"` (hook `block-no-verify`).

## Keputusan desain & deviasi dari indeks (dicatat agar reviewer tidak kaget)

1. **File baru di luar daftar indeks** (indeks mengizinkan file baru di tonggaknya sendiri):
   `src/engine/systemGate.js` (gerbang sistem, murni), `src/core/audioSynth.js` (DSP murni yang dipakai AudioBus),
   `src/entities/Humanoid.skinned.js` (Humanoid → 1 SkinnedMesh), `src/interiors/roomCollider.js` (collider ruang
   generik), `src/interiors/sekre/canvas.js` (util canvas & geometri bersama), `src/ui/infoCard.css`,
   `tests/e2e/interior.e2e.mjs` (ukur budget + memori + screenshot interior; `lembaga.e2e.mjs` M4 tetap menguji
   siklus portal dari luar, M7 menyatukan keduanya ke smoke), `assets-src/blender/unri/sekre_assets.py`.
2. **File lama yang diubah di luar daftar indeks M5:** `src/entities/Humanoid.outfits.js` (outfit almamater C01,
   katalog: "outfit baru di Humanoid"), `src/ui/mountSettingsPanel.js` (bantuan F1), `src/app/portalTrigger.js` (M4:
   meneruskan pintu + `worldYaw` ke `enter`), `tests/unri/interiorPortal.test.js` (tes stub M4 diganti tes portal
   penuh; blok `nearestPortal` dipertahankan). `src/app/appView.js` + `tests/unri/appView.test.js` M4 DIHAPUS di Task 10 Step 7 (`git rm`; digantikan `App.setView`, rekonsiliasi 2026-10-18).
3. **`App.setView({ scene, camera, aoRadius? })`**: field `aoRadius` opsional (tambahan, kontrak tetap kompatibel).
   **`App.setSystemGate(fn)`** baru: menjeda sistem tanpa mencabut/mengubah urutan (SystemRunner tidak diubah).
   Menggantikan `appStage` M4 (tukar runner) sesuai serah terima M4.
4. **Sistem yang tetap jalan di dalam** (whitelist `KEEP_INSIDE`): `gamepad`, `keymap`, `timeOfDay`, `weather`,
   `scheduler`, `input.endFrame`, dan semua id berawalan `interior.` (id persis main.js M0). Jam tetap maju (spec:
   "jam dari clock game yang sama"), cuaca tetap bertransisi (hujan di atap seng mengikuti `weather.intensity`), suara
   hujan eksterior dibisukan selama di dalam lalu dipulihkan dari `store('weather.sound')`. `regions`, `portal.*`,
   `hud`, `story`, kamera & entitas eksterior dijeda.
5. **`exitTo`** = `sekreExitTo()` M4 di composition root (`src/interiors` dilarang mengimpor `regions`);
   `src/interiors/sekre/index.js` mengekspor `createSekreInterior({ exitTo })`. Tidak ada angka pintu yang diduplikasi.
6. **NPC = SkinnedMesh rigid** (13 tulang = pivot Humanoid, bobot 1): 1 draw call/NPC (Humanoid biasa ±17). Tanpa
   ini 6 NPC saja ±100 draw call dan budget §9 (≤ 150) jebol.
7. **Ukuran budget interior (spec §9.1)** didefinisikan sebagai **pass scene utama**: `renderer.render(scene,
   camera)` sekali setelah `info.reset()` → `calls ≤ 150`, `triangles ≤ 150.000`. Total semua pass frame (GTAO
   merender normal sekali lagi, bayangan, post) dilaporkan juga dengan target `calls ≤ 150`; segitiga total frame
   hanya dilaporkan (GTAO menggandakannya secara definisi).
8. **Selasar beratap** (`SELASAR.beratap = true`): spec §8.1 "selasar tengah 3,7 m terbuka di kedua ujung". Akibatnya
   sinar matahari langsung lewat jendela hanya muncul saat matahari rendah sejajar sumbu selasar (dihitung
   `windowSunFactor`). Siang biasa tetap terang oleh cahaya langit dari jendela & pintu (SpotLight tanpa bayangan).
9. **Azan magrib (spec §8.2, "opsional")** tidak dibuat di M5 (sintesis vokal sulit terdengar wajar); dicatat di
   serah terima.
10. **Nama file GLB**: `public/models/unri/<id-huruf-kecil>-<nama>.glb` (mis. `s14-kipas-berdiri.glb`), satu
    `.blend` per aset di `assets-src/blender/unri/`. S07 piala: satu model dipakai 3× dengan skala & rotasi berbeda.
11. **Prompt HUD** memakai format repo yang ada: `Tekan E — <prompt>` (sama dengan `portal.prompt` M4).
12. Barang tambahan tanpa ID katalog (perlu agar adegan masuk akal): kursi lipat (pose `sitChairTyping`), kertas
    di meja (berkibar saat kipas), kabel. Dicatat di katalog oleh M7 (status aset).
13. **Validasi plan**: kode logika murni (Task 1–6, 8, 10, 11, 16, 17) dan perakitan interior lengkap (Task 12–19,
    dengan kanvas 2D tiruan di jsdom) sudah dijalankan di salinan repo di luar pohon kerja saat plan ditulis: semua
    tes lulus, lint 0 peringatan, estimasi scene ±50 draw call & ±29k segitiga (placeholder) di jam 10/15/21/02.

## Struktur file

```
src/interiors/Interior.js              BARU  defineInterior, validateInteriorBuild, nearestInteractable (murni)
src/interiors/roomCollider.js          BARU  createRoomCollider (murni)
src/interiors/sekre/data.js            BARU  SATU sumber: ruang, aset S01–S30, slot, NPC, interaksi, teks contoh
src/interiors/sekre/canvas.js          BARU  util canvas & geometri: makeCanvas, canvasTexture, fitFont, atlasPlane, tint…
src/interiors/sekre/room.js            BARU  dinding/lantai/plafon/plint + selasar luar + hujan ujung selasar
src/interiors/sekre/furniture.js       BARU  placeholder S07–S30 berukuran persis, GLB, kipas/dispenser/kertas/gitar
src/interiors/sekre/boards.js          BARU  canvas papan struktur/proker/whiteboard + atlas kecil (S04–S06,S08,S10,S26,S28)
src/interiors/sekre/npcs.js            BARU  3–6 NPC terjadwal (almamater/kaus), properti di tangan
src/interiors/sekre/interactables.js   BARU  12 barang interaktif (handler)
src/interiors/sekre/lighting.js        BARU  TL otomatis + saklar, cahaya jendela/pintu, sinar matahari, env map
src/interiors/sekre/audio.js           BARU  kipas, gitar, gumaman, hujan di atap seng
src/interiors/sekre/photo.js           BARU  4 preset foto + pose intip jendela
src/interiors/sekre/index.js           BARU  createSekreInterior({ exitTo }) → defineInterior
src/sim/walkPhysics.js                 BARU  createWalkState, stepWalk (murni)
src/sim/activitySchedule.js            BARU  PERIODS, periodAt, scheduleFor (murni)
src/engine/systemGate.js               BARU  gateSystem (murni)
src/core/audioSynth.js                 BARU  karplusStrong, fanHumBuffer, rainOnTinBuffer, murmurBuffer (murni)
src/core/InteriorCameraRig.js          BARU  FP 1,55 m / orang ketiga 1,6 m + uji plafon, foto bebas, intip
src/entities/Humanoid.skinned.js       BARU  bakeSkinnedHumanoid
src/entities/Humanoid.poses.js         BARU  POSES (7), applyPose, clearPose
src/entities/Walker.js                 BARU  pemain jalan kaki (Humanoid skinned + walkPhysics)
src/ui/InfoCard.js, src/ui/infoCard.css BARU kartu info (DOM createElement + textContent)
src/app/interiorPortal.js              UBAH  stub M4 → penuh (gerbang sistem, Walker, kamera, interaksi)
src/app/portalTrigger.js               UBAH  (M4) teruskan pintu + worldYaw ke portal.enter
src/app/appView.js (+ tes)             HAPUS (M4) digantikan App.setView (Task 10)
src/core/App.js                        UBAH  setView, setSystemGate, view aktif di render/resize/GTAO/label
src/core/AudioBus.js                   UBAH  pluck, startFanHum, startRainOnTin, startMurmur, play/loop
src/entities/Humanoid.outfits.js       UBAH  ALMAMATER_UNRI, randomAlmamaterOutfit
src/app/keymap.js                      UBAH  portal: tombol eksterior dijeda saat fade/di dalam
src/ui/mountSettingsPanel.js           UBAH  bantuan F1 grup "Sekre (interior)"
src/main.js                            UBAH  setupPortal (M4) → portal M5, router lihat sentuh/gamepad, interior sekre
eslint.config.js                       UBAH  blok src/interiors/**
assets-src/blender/unri/sekre_assets.py, *.blend   BARU  7 aset (S07, S13, S14, S15, S17, S19, S20)
public/models/unri/*.glb               BARU  7 GLB
tests/interior.test.js, tests/systemGate.test.js, tests/walkPhysics.test.js, tests/activitySchedule.test.js,
tests/audioSynth.test.js, tests/audioBusSynth.test.js, tests/humanoidPoses.test.js, tests/interiorCameraRig.test.js,
tests/keymapPortal.test.js, tests/interiorSekre.test.js, tests/sekreLighting.test.js                  BARU
tests/unri/interiorPortal.test.js      UBAH  (M4) tes portal penuh + nearestPortal
tests/e2e/interior.e2e.mjs             BARU
docs/screenshots/unri/m5-siang-rapat.jpg, m5-malam-begadang.jpg, m5-hujan.jpg               BARU
```

Peta koordinat ruang (ruang-lokal, tampak atas, +Z ke bawah gambar; pintu & jendela di dinding selasar z = −3):

```
 z=-3  ┌──spanduk──[ jendela nako x−1,5..−0,3 ]─dispenser─[pintu x0,9..1,8]─┐  ← selasar (3,7 m) → deret seberang
       │kardus  kalender       ngobrol-1   ngobrol-2  minum        sepatu tas │
       │kipas   piket                               whiteboard(dinding x+2,1) │
       │        ┌──────────── karpet 3×4 (pusat −0,4; 0,7) ───────┐           │
       │proker  │      rapat-1                                    │  kursi meja│
       │piagam  │rapat-4      (lesehan)      rapat-2              │  laptop    │
       │        │      rapat-3                                    │   printer  │
       │poster  │ gitar         rebahan (kepala ke +X, bantal)     │           │
 z=+3  └kardus──└─────────────── papan struktur ─────────poster── lemari arsip┘
        x=−2,1                                                          x=+2,1
```

---

## Task 0: Verifikasi API M0–M4 (tanpa commit)

**Files:** baca saja.

- [ ] **Step 1: Pastikan pohon kerja bersih & tes hijau**

Run: `git status --short` lalu `npm test`
Expected: tidak ada perubahan tak ter-commit selain yang memang milik pengguna; semua tes PASS.

- [ ] **Step 2: Cek ekspor M0/M4 yang dipakai**

Run:
```
grep -n "export const PORTAL_DOORS\|export function sekreExitTo" src/regions/unri-lembaga/portalDoors.js
grep -n "portals" src/regions/unri-lembaga/index.js
grep -n "export function nearestPortal\|export function createPortalTrigger" src/app/portalTrigger.js
grep -n "export function createFadeOverlay" src/ui/FadeOverlay.js
grep -n "^export" src/app/interiorPortal.js
grep -n "createRegionLayer\|setupPortal\|portalKit\|addFrameSystems(\|handleKeys(" src/main.js
```
Expected: `PORTAL_DOORS` & `sekreExitTo` ada; build region mengembalikan `portals`; `nearestPortal`,
`createPortalTrigger`, `createFadeOverlay` ada; stub mengekspor `createInteriorPortal`, `createStubInterior`,
`appStage`; main.js memakai `const { regions, scheduler, terrain, colliders } = createRegionLayer(...)`,
`const portalKit = setupPortal(...)` sebelum `addFrameSystems(...)`, dan `handleKeys` tanpa `frame`.
Bila nama di repo berbeda dari plan (M0/M4 dieksekusi dengan penyesuaian), sesuaikan NAMA saja di Task 10/20.

- [ ] **Step 3: Catat id sistem eksterior**

Jalankan dev server, buka konsol: `__sim.app.systems.ids`. Expected: memuat `gamepad`, `keymap`, `timeOfDay`,
`weather`, `regions`, `scheduler`, `portal.trigger`, `portal.prompt`, `input.endFrame`. Bila jam/cuaca/scheduler/
input memakai id lain, sesuaikan `KEEP_INSIDE` di Task 10.

---

## Task 1: Kontrak interior + collider ruang (TDD)

**Files:**
- Create: `src/interiors/Interior.js`, `src/interiors/roomCollider.js`, `tests/interior.test.js`
- Modify: `eslint.config.js`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/interior.test.js`:
```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { defineInterior, validateInteriorBuild, nearestInteractable } from '../src/interiors/Interior.js';
import { createRoomCollider } from '../src/interiors/roomCollider.js';

const spec = (over = {}) => ({
  id: 'uji', label: 'Ruang uji', size: { w: 4, d: 6, h: 3 }, spawn: { x: 1, z: -2, yaw: 0 },
  exitTo: { region: 'unri-lembaga', x: 10, z: 5, yaw: 0 }, build: async () => ({}), ...over,
});
const item = (over = {}) => ({
  id: 'papan', label: 'Papan', pos: { x: 0, y: 1.5, z: 2 }, radius: 2, prompt: 'Lihat', onInteract: () => {}, ...over,
});
const build = (over = {}) => ({
  scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), colliders: { isWalkable: () => true },
  interactables: [item()], photoPresets: [{ id: 'a', label: 'A', pose: { position: [0, 1, 0], target: [0, 1, 1], fov: 60 } }],
  systems: [{ id: 'interior.uji', phase: 'sim', update() {} }], dispose() {}, ...over,
});

describe('defineInterior', () => {
  it('mengembalikan salinan beku dengan field tervalidasi', () => {
    const def = defineInterior(spec());
    expect(Object.isFrozen(def)).toBe(true);
    expect(Object.isFrozen(def.size)).toBe(true);
    expect(def.spawn).toEqual({ x: 1, z: -2, yaw: 0 });
    expect(def.exitTo.region).toBe('unri-lembaga');
  });

  it.each([
    [{ id: '' }, 'id'],
    [{ label: '' }, 'label'],
    [{ size: { w: 4, d: 0, h: 3 } }, 'size'],
    [{ spawn: { x: 1, z: Number.NaN, yaw: 0 } }, 'spawn'],
    [{ spawn: { x: 9, z: 0, yaw: 0 } }, 'spawn di luar ruang'],
    [{ exitTo: { region: '', x: 0, z: 0, yaw: 0 } }, 'exitTo'],
    [{ build: null }, 'build'],
  ])('menolak spec tidak valid %#', (over, msg) => {
    expect(() => defineInterior(spec(over))).toThrow(msg);
  });
});

describe('validateInteriorBuild', () => {
  it('hasil lengkap lolos dan dikembalikan apa adanya', () => {
    const b = build();
    expect(validateInteriorBuild(b, 'uji')).toBe(b);
  });

  it('melaporkan semua bagian yang hilang sekaligus', () => {
    expect(() => validateInteriorBuild({}, 'uji')).toThrow(/scene, camera, colliders\.isWalkable, interactables, photoPresets, systems, dispose/);
  });

  it('id sistem wajib berawalan "interior." dan fase dikenal', () => {
    expect(() => validateInteriorBuild(build({ systems: [{ id: 'npc', phase: 'sim', update() {} }] }), 'uji')).toThrow('systems[0].id');
    expect(() => validateInteriorBuild(build({ systems: [{ id: 'interior.x', phase: 'render', update() {} }] }), 'uji')).toThrow('systems[0].phase');
  });

  it('id barang interaktif unik dan pos/radius/prompt/onInteract valid', () => {
    expect(() => validateInteriorBuild(build({ interactables: [item(), item()] }), 'uji')).toThrow('interactables[1].id');
    expect(() => validateInteriorBuild(build({ interactables: [item({ radius: 0 })] }), 'uji')).toThrow('interactables[0].radius');
    expect(() => validateInteriorBuild(build({ interactables: [item({ pos: { x: 0, y: 1 } })] }), 'uji')).toThrow('interactables[0].pos');
  });

  it('preset foto butuh pose {position, target} 3 angka', () => {
    const bad = [{ id: 'a', label: 'A', pose: { position: [0, 1], target: [0, 1, 1] } }];
    expect(() => validateInteriorBuild(build({ photoPresets: bad }), 'uji')).toThrow('photoPresets[0].pose');
  });
});

describe('nearestInteractable', () => {
  const eye = { x: 0, y: 1.55, z: 0 };
  it('memilih barang yang sedang dilihat dalam radius', () => {
    const a = item({ id: 'a', pos: { x: 0, y: 1.5, z: 1.5 } });
    expect(nearestInteractable([a], eye, { x: 0, y: 0, z: 1 })).toBe(a);
  });
  it('mengabaikan barang di belakang dan di luar radius', () => {
    const behind = item({ id: 'b', pos: { x: 0, y: 1.5, z: -1.5 } });
    const far = item({ id: 'c', pos: { x: 0, y: 1.5, z: 5 }, radius: 2 });
    expect(nearestInteractable([behind, far], eye, { x: 0, y: 0, z: 1 })).toBeNull();
  });
  it('dua barang berdekatan: yang dipilih mengikuti arah pandang (atas vs bawah)', () => {
    const atas = item({ id: 'atas', pos: { x: 0, y: 2.5, z: 1.2 } });
    const bawah = item({ id: 'bawah', pos: { x: 0, y: 0.6, z: 1.2 } });
    expect(nearestInteractable([atas, bawah], eye, { x: 0, y: 0.6, z: 0.8 }).id).toBe('atas');
    expect(nearestInteractable([atas, bawah], eye, { x: 0, y: -0.6, z: 0.8 }).id).toBe('bawah');
  });
  it('barang sangat dekat cukup tidak di belakang; masukan rusak → null', () => {
    const dekat = item({ id: 'd', pos: { x: 0.4, y: 0.3, z: 0.1 } });
    expect(nearestInteractable([dekat], eye, { x: 0, y: 0, z: 1 })).toBe(dekat);
    expect(nearestInteractable(null, eye, { x: 0, y: 0, z: 1 })).toBeNull();
    expect(nearestInteractable([dekat], { x: Number.NaN, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })).toBeNull();
  });
});

describe('createRoomCollider', () => {
  const c = createRoomCollider({
    halfW: 2, halfD: 3, radius: 0.25,
    solids: [{ id: 'meja', x0: 1, x1: 2, z0: 0, z1: 1 }],
    tallSolids: [{ id: 'lemari', x0: -2, x1: -1, z0: 2.5, z1: 3 }],
    blockers: () => [{ x: 0, z: -1, r: 0.3 }],
  });
  it('dinding: radius pemain dihormati', () => {
    expect(c.isWalkable(1.7, 0 - 0.5)).toBe(true);
    expect(c.isWalkable(1.8, -2)).toBe(false);
    expect(c.isWalkable(0, 2.8)).toBe(false);
  });
  it('perabot & NPC menghalangi (diperluas radius)', () => {
    expect(c.isWalkable(0.8, 0.5)).toBe(false);
    expect(c.isWalkable(0.7, 0.5)).toBe(true);
    expect(c.isWalkable(0.4, -1)).toBe(false);
    expect(c.isWalkable(0.6, -1)).toBe(true);
  });
  it('kamera: dinding (margin kecil) & perabot tinggi', () => {
    expect(c.isCameraClear(1.9, 0)).toBe(true);
    expect(c.isCameraClear(1.97, 0)).toBe(false);
    expect(c.isCameraClear(-1.5, 2.7)).toBe(false);
    expect(c.isCameraClear(1.5, 0.5)).toBe(true);
  });
  it('NaN tidak walkable', () => {
    expect(c.isWalkable(Number.NaN, 0)).toBe(false);
    expect(c.isCameraClear(0, Number.NaN)).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/interior.test.js`
Expected: FAIL — `Failed to resolve import "../src/interiors/Interior.js"`.

- [ ] **Step 3: Implementasi `src/interiors/Interior.js`**

```js
/**
 * Kontrak interior (spec §4.8): scene interior terpisah yang dimasuki lewat pintu-portal
 * (src/app/interiorPortal.js). Murni (tanpa three): validasi bentuk data + pemilih barang interaktif.
 * Koordinat interior = ruang-lokal (m): lantai y = 0, pusat ruang (0, 0). Sistem interior wajib ber-id
 * "interior.*" agar gerbang sistem App (portal) tetap menjalankannya saat eksterior dijeda.
 *
 * Kontrak build(ctx) → { scene, camera, colliders:{isWalkable(x,z), isCameraClear?(x,z)},
 *   interactables:[{id,label,pos:{x,y,z},radius,prompt,onInteract(ctx)→void|{title,text}}],
 *   photoPresets:[{id,label,pose:{position:[x,y,z],target:[x,y,z],fov?}}], systems:[...], dispose() }
 * dispose() interior HANYA melepas sumber daya di luar pohon scene (skeleton, env map, peta bayangan,
 * audio, timer); pohon scene dilepas portal (disposeTree + scope.dispose).
 */
const finite = Number.isFinite;
const PHASES = new Set(['input', 'sim', 'world', 'camera', 'ui']);
export const INTERIOR_SYSTEM_PREFIX = 'interior.';

const hasNumbers = (p, keys) => Boolean(p) && keys.every((k) => finite(p[k]));
const isTriple = (a) => Array.isArray(a) && a.length === 3 && a.every(finite);

/**
 * @param {{id:string, label:string, size:{w:number,d:number,h:number}, spawn:{x:number,z:number,yaw:number},
 *   exitTo:{region:string,x:number,z:number,yaw:number}, build:(ctx:object)=>Promise<object>}} spec
 */
export function defineInterior(spec) {
  if (!spec || typeof spec.id !== 'string' || spec.id === '') throw new TypeError('Interior: id wajib string');
  const fail = (msg) => { throw new TypeError(`Interior "${spec.id}": ${msg}`); };
  if (typeof spec.label !== 'string' || spec.label === '') fail('label wajib string');
  const s = spec.size;
  if (!s || ![s.w, s.d, s.h].every((v) => finite(v) && v > 0)) fail('size {w,d,h} harus angka positif');
  const sp = spec.spawn;
  if (!hasNumbers(sp, ['x', 'z', 'yaw'])) fail('spawn {x,z,yaw} harus angka hingga');
  if (Math.abs(sp.x) > s.w / 2 || Math.abs(sp.z) > s.d / 2) fail('spawn di luar ruang');
  const ex = spec.exitTo;
  if (!ex || typeof ex.region !== 'string' || ex.region === '' || !hasNumbers(ex, ['x', 'z', 'yaw'])) {
    fail('exitTo {region,x,z,yaw} wajib');
  }
  if (typeof spec.build !== 'function') fail('build(ctx) wajib');
  return Object.freeze({
    ...spec,
    size: Object.freeze({ w: s.w, d: s.d, h: s.h }),
    spawn: Object.freeze({ x: sp.x, z: sp.z, yaw: sp.yaw }),
    exitTo: Object.freeze({ region: ex.region, x: ex.x, z: ex.z, yaw: ex.yaw }),
  });
}

function checkInteractables(list, errors) {
  if (!Array.isArray(list)) { errors.push('interactables'); return; }
  const seen = new Set();
  list.forEach((it, i) => {
    const tag = `interactables[${i}]`;
    if (typeof it?.id !== 'string' || it.id === '' || seen.has(it.id)) errors.push(`${tag}.id`);
    else seen.add(it.id);
    if (typeof it?.label !== 'string' || it.label === '') errors.push(`${tag}.label`);
    if (!hasNumbers(it?.pos, ['x', 'y', 'z'])) errors.push(`${tag}.pos`);
    if (!(finite(it?.radius) && it.radius > 0)) errors.push(`${tag}.radius`);
    if (typeof it?.prompt !== 'string' || it.prompt === '') errors.push(`${tag}.prompt`);
    if (typeof it?.onInteract !== 'function') errors.push(`${tag}.onInteract`);
  });
}

function checkPresets(list, errors) {
  if (!Array.isArray(list)) { errors.push('photoPresets'); return; }
  list.forEach((p, i) => {
    const tag = `photoPresets[${i}]`;
    if (typeof p?.id !== 'string' || p.id === '' || typeof p?.label !== 'string') errors.push(`${tag}.id`);
    const pose = p?.pose;
    const fovOk = pose?.fov === undefined || (finite(pose.fov) && pose.fov > 1 && pose.fov < 170);
    if (!isTriple(pose?.position) || !isTriple(pose?.target) || !fovOk) errors.push(`${tag}.pose`);
  });
}

function checkSystems(list, errors) {
  if (!Array.isArray(list)) { errors.push('systems'); return; }
  list.forEach((s, i) => {
    const tag = `systems[${i}]`;
    if (typeof s?.id !== 'string' || !s.id.startsWith(INTERIOR_SYSTEM_PREFIX)) errors.push(`${tag}.id`);
    if (!PHASES.has(s?.phase)) errors.push(`${tag}.phase`);
    if (typeof s?.update !== 'function') errors.push(`${tag}.update`);
  });
}

/** Pastikan hasil build memenuhi kontrak; lempar TypeError berisi daftar galat. Mengembalikan hasil apa adanya. */
export function validateInteriorBuild(result, id) {
  const errors = [];
  if (!result?.scene?.isScene) errors.push('scene');
  if (!result?.camera?.isCamera) errors.push('camera');
  if (typeof result?.colliders?.isWalkable !== 'function') errors.push('colliders.isWalkable');
  checkInteractables(result?.interactables, errors);
  checkPresets(result?.photoPresets, errors);
  checkSystems(result?.systems, errors);
  if (typeof result?.dispose !== 'function') errors.push('dispose');
  if (errors.length) throw new TypeError(`Interior "${id}": hasil build tidak valid (${errors.join(', ')})`);
  return result;
}

/**
 * Barang yang sedang "dilihat": jarak mendatar ≤ radius barang, lalu sudut terkecil antara arah pandang dan
 * arah mata→barang (cos ≥ minDot). Barang sangat dekat (≤ closeRange m) cukup tidak berada di belakang.
 * @param {Array<{pos:{x:number,y:number,z:number}, radius:number}>} list
 * @param {{x:number,y:number,z:number}} eye
 * @param {{x:number,y:number,z:number}} dir arah pandang (tidak harus satuan)
 * @returns {object|null}
 */
export function nearestInteractable(list, eye, dir, { minDot = 0.55, closeRange = 0.6 } = {}) {
  if (!Array.isArray(list) || !hasNumbers(eye, ['x', 'y', 'z']) || !hasNumbers(dir, ['x', 'y', 'z'])) return null;
  const dl = Math.hypot(dir.x, dir.y, dir.z);
  if (!(dl > 0)) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const it of list) {
    const p = it?.pos;
    if (!hasNumbers(p, ['x', 'y', 'z'])) continue;
    const dx = p.x - eye.x;
    const dy = p.y - eye.y;
    const dz = p.z - eye.z;
    const flat = Math.hypot(dx, dz);
    if (!(flat <= it.radius)) continue;
    const len = Math.hypot(dx, dy, dz) || 1e-6;
    const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / (len * dl);
    if (dot < (flat <= closeRange ? 0 : minDot)) continue;
    const score = dot - flat * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}
```

- [ ] **Step 4: Implementasi `src/interiors/roomCollider.js`**

```js
/**
 * Collider ruang interior 2D (murni): dinding persegi panjang berpusat di origin, perabot = persegi panjang
 * sejajar sumbu (diperluas radius pemain), NPC = lingkaran dinamis. Kamera: dinding dengan margin kecil +
 * perabot tinggi saja (meja/karpet tidak menghalangi kamera).
 */
const inRect = (x, z, r, pad) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

/**
 * @param {{halfW:number, halfD:number, radius?:number, cameraMargin?:number,
 *   solids?:Array<{x0:number,x1:number,z0:number,z1:number}>, tallSolids?:Array<{x0:number,x1:number,z0:number,z1:number}>,
 *   blockers?:() => Array<{x:number,z:number,r:number}>}} opts
 * @returns {{isWalkable(x:number,z:number):boolean, isCameraClear(x:number,z:number):boolean}}
 */
export function createRoomCollider({
  halfW, halfD, radius = 0.25, cameraMargin = 0.08, solids = [], tallSolids = [], blockers = () => [],
}) {
  const isWalkable = (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (Math.abs(x) > halfW - radius || Math.abs(z) > halfD - radius) return false;
    if (solids.some((s) => inRect(x, z, s, radius))) return false;
    return !(blockers() ?? []).some((b) => Math.hypot(x - b.x, z - b.z) < b.r + radius);
  };
  const isCameraClear = (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (Math.abs(x) > halfW - cameraMargin || Math.abs(z) > halfD - cameraMargin) return false;
    return !tallSolids.some((s) => inRect(x, z, s, 0));
  };
  return { isWalkable, isCameraClear };
}
```

- [ ] **Step 5: Blok ESLint `src/interiors/**`**

Di `eslint.config.js` (versi M1), tambahkan `'interiors'` ke array `ALL` (sesudah `'districts'`) agar config/geo/shared/story/sim/engine juga dilarang mengimpornya, lalu tambahkan baris berikut **sebelum** baris `{ files: ['src/app/**/*.js'], rules: restrict(MAIN) },`:
```js
  // Interior (spec §3.1): boleh engine/geo/shared/config/world/sim/entities; tidak ui/core/app/city/regions/districts.
  { files: ['src/interiors/**/*.js'], rules: restrict(layers(['ui', 'core', 'app', 'city', 'regions', 'districts']), MAIN) },
```

- [ ] **Step 6: Jalankan tes & lint**

Run: `node node_modules/vitest/vitest.mjs run tests/interior.test.js` lalu `npm run lint`
Expected: semua tes PASS; lint 0 galat.

- [ ] **Step 7: Commit**

```
git add src/interiors/Interior.js src/interiors/roomCollider.js tests/interior.test.js eslint.config.js
```
```
git commit -m "feat(interior): kontrak defineInterior + validasi hasil build, pemilih barang interaktif, collider ruang"
```

---

## Task 2: Gerbang sistem + `App.setView` (TDD untuk gerbang)

**Files:**
- Create: `src/engine/systemGate.js`, `tests/systemGate.test.js`
- Modify: `src/core/App.js`

- [ ] **Step 1: Tes gagal `tests/systemGate.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import { gateSystem } from '../src/engine/systemGate.js';
import { createSystemRunner } from '../src/engine/SystemRunner.js';

describe('gateSystem', () => {
  it('update hanya jalan saat gerbang terbuka untuk id-nya; id & fase dipertahankan', () => {
    const update = vi.fn();
    let open = true;
    const g = gateSystem({ id: 'timeOfDay', phase: 'world', update }, (id) => open && id === 'timeOfDay');
    expect(g.id).toBe('timeOfDay');
    expect(g.phase).toBe('world');
    g.update(0.1, { a: 1 });
    open = false;
    g.update(0.1, {});
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(0.1, { a: 1 });
  });

  it('dispose diteruskan; tanpa dispose tidak ada properti dispose', () => {
    const dispose = vi.fn();
    gateSystem({ id: 'a', phase: 'sim', update() {}, dispose }, () => true).dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect('dispose' in gateSystem({ id: 'b', phase: 'sim', update() {} }, () => true)).toBe(false);
  });

  it('sistem tidak valid dikembalikan apa adanya agar SystemRunner tetap menolaknya', () => {
    const runner = createSystemRunner({ logger: { error() {} } });
    expect(() => runner.add(gateSystem({ id: 'x', phase: 'sim' }, () => true))).toThrow('update');
  });

  it('isOpen wajib fungsi', () => {
    expect(() => gateSystem({ id: 'a', phase: 'sim', update() {} }, null)).toThrow(TypeError);
  });

  it('urutan dalam fase tidak berubah walau sebagian dijeda', () => {
    const runner = createSystemRunner();
    const log = [];
    const paused = new Set(['b']);
    for (const id of ['a', 'b', 'c']) runner.add(gateSystem({ id, phase: 'sim', update: () => log.push(id) }, (sid) => !paused.has(sid)));
    runner.update(0, {});
    paused.clear();
    runner.update(0, {});
    expect(log).toEqual(['a', 'c', 'a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Jalankan → FAIL** (`Failed to resolve import "../src/engine/systemGate.js"`)

Run: `node node_modules/vitest/vitest.mjs run tests/systemGate.test.js`

- [ ] **Step 3: Implementasi `src/engine/systemGate.js`**

```js
/**
 * Gerbang sistem (App.setSystemGate): bungkus sistem agar update-nya hanya jalan bila gerbang terbuka untuk
 * id-nya. Dipakai portal interior untuk MENJEDA sistem eksterior tanpa mencabutnya (urutan dalam fase tetap,
 * tidak ada dispose/re-add). Lapisan engine: murni.
 * @param {{id:string, phase:string, update:(dt:number, ctx:object)=>void, dispose?:()=>void}} system
 * @param {(id:string) => boolean} isOpen
 */
export function gateSystem(system, isOpen) {
  if (typeof isOpen !== 'function') throw new TypeError('gateSystem: isOpen harus fungsi');
  if (!system || typeof system.update !== 'function') return system; // biar SystemRunner yang menolak
  const gated = {
    id: system.id,
    phase: system.phase,
    update(dt, ctx) {
      if (isOpen(system.id)) system.update(dt, ctx);
    },
  };
  if (typeof system.dispose === 'function') gated.dispose = () => system.dispose();
  return gated;
}
```

- [ ] **Step 4: Jalankan → PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/systemGate.test.js`

- [ ] **Step 5: Ubah `src/core/App.js`**

5a. Impor (setelah impor `createSystemRunner`):
```js
import { gateSystem } from '../engine/systemGate.js';
```

5b. Field privat (setelah `#aoLoading = false;`):
```js
  #gate = null; // (id) => boolean; null = semua sistem jalan (lihat setSystemGate)
```

5c. Di konstruktor, tepat setelah `this.post = createComposer(...)`:
```js
    /** Scene & kamera yang sedang dirender (setView); default = scene/kamera utama (eksterior). */
    this.view = { scene: this.scene, camera: this.camera, aoRadius: RENDER.aoRadius };
```

5d. Ganti `addSystem` dan `addUpdatable`:
```js
  /** Daftarkan sistem berfase (lihat engine/SystemRunner); dibungkus gerbang (setSystemGate). */
  addSystem(system) {
    this.systems.add(gateSystem(system, (id) => this.#gate === null || this.#gate(id)));
    return system;
  }
```
dan di `addUpdatable`, ganti baris `this.systems.add({ id, phase, update: (dt, ctx) => obj.update(dt, ctx) });` menjadi:
```js
    this.addSystem({ id, phase, update: (dt, ctx) => obj.update(dt, ctx) });
```

5e. Tambahkan metode baru setelah `removeUpdatable`:
```js
  /**
   * Gerbang sistem: `fn(id)` → true = sistem jalan frame ini. null = semua jalan. Dipakai portal interior untuk
   * menjeda sistem eksterior (tidak dilepas, urutan tetap).
   * @param {((id:string) => boolean)|null} fn
   */
  setSystemGate(fn) {
    this.#gate = typeof fn === 'function' ? fn : null;
  }

  /**
   * Ganti scene & kamera yang dirender (loop, RenderPass, GTAO, outline, label CSS2D). null = kembali ke
   * scene/kamera utama. `aoRadius` (m, opsional) dipakai GTAO selama view aktif. Kamera view ikut resize.
   * @param {{scene: THREE.Scene, camera: THREE.Camera, aoRadius?: number}|null} view
   */
  setView(view = null) {
    const next = view
      ? { scene: view.scene, camera: view.camera, aoRadius: Number.isFinite(view.aoRadius) ? view.aoRadius : RENDER.aoRadius }
      : { scene: this.scene, camera: this.camera, aoRadius: RENDER.aoRadius };
    if (!next.scene?.isScene || !next.camera?.isCamera) throw new TypeError('App.setView: butuh {scene, camera}');
    this.view = next;
    this.#bindViewToPasses();
    // Label CSS2D eksterior (pedagang, NPC cerita) tidak boleh tertinggal melayang di atas scene lain.
    this.labelRenderer.domElement.style.display = next.scene === this.scene ? '' : 'none';
    this.resize();
    return next;
  }

  #bindViewToPasses() {
    const { scene, camera, aoRadius } = this.view;
    this.post.scenePass.scene = scene;
    this.post.scenePass.camera = camera;
    this.post.outlinePass.camera = camera;
    const ao = this.post.gtaoPass;
    if (ao) {
      ao.scene = scene;
      ao.camera = camera;
      ao.updateGtaoMaterial({ radius: aoRadius });
    }
  }
```

5f. Di `#loadGtao`, ganti `const pass = createGtaoPass(GTAOPass, this.scene, this.camera);` menjadi
`const pass = createGtaoPass(GTAOPass, this.view.scene, this.view.camera);` dan tambahkan
`this.#bindViewToPasses();` tepat sebelum `this.resize(); // ukuran AO (RENDER.aoScale)`.

5g. Di `resize()`, ganti 2 baris kamera:
```js
    for (const cam of new Set([this.camera, this.view.camera])) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
```

5h. Di `render(ctx)`, ganti `this.scene.updateMatrixWorld();` dan baris `this.labelRenderer.render(...)`:
```js
    const { scene, camera } = this.view;
    scene.updateMatrixWorld();
    this.post.composer.render(); // pass pertama membersihkan buffer; OutputPass menulis ke layar
    this.labelRenderer.render(scene, camera);
```
(hapus baris `this.post.composer.render();` yang lama agar tidak dobel).

5i. `createComposer` mengembalikan `scenePass`:
```js
  return { composer, gtaoPass: null, scenePass, outlinePass, vignettePass }; // gtaoPass dibuat malas (App.setAO)
```
dan perbarui JSDoc `@returns` dengan `scenePass: DepthRenderPass`.

- [ ] **Step 6: Verifikasi tanpa regresi**

Run: `npm test` lalu `npm run lint`
Expected: PASS semua; lint 0 galat. Lalu dev server: stadion tampil seperti biasa, konsol bersih, tombol O
(AO) masih bekerja.

- [ ] **Step 7: Commit**

```
git add src/engine/systemGate.js tests/systemGate.test.js src/core/App.js
```
```
git commit -m "feat(core): App.setView (scene/kamera aktif untuk render, GTAO, outline, label) dan gerbang sistem App.setSystemGate"
```

---

## Task 3: Fisika jalan kaki (TDD)

**Files:**
- Create: `src/sim/walkPhysics.js`, `tests/walkPhysics.test.js`

- [ ] **Step 1: Tes gagal `tests/walkPhysics.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { WALK, createWalkState, stepWalk, walkSpeedOf, desiredVelocity } from '../src/sim/walkPhysics.js';
import { deepFreeze } from './helpers.js';

const run = (state, input, seconds, collider = null, dt = 1 / 60) => {
  let s = state;
  for (let t = 0; t < seconds - 1e-9; t += dt) s = stepWalk(s, input, dt, collider);
  return s;
};
const fwd = (over = {}) => ({ forward: 1, strafe: 0, run: false, yaw: 0, ...over });

describe('createWalkState', () => {
  it('beku, kecepatan 0, NaN → 0, yaw dinormalkan', () => {
    const s = createWalkState({ x: 1, z: Number.NaN, yaw: 3 * Math.PI });
    expect(Object.isFrozen(s)).toBe(true);
    expect(s).toMatchObject({ x: 1, z: 0, vx: 0, vz: 0 });
    expect(Math.abs(s.yaw)).toBeCloseTo(Math.PI, 9);
  });
});

describe('stepWalk', () => {
  it('akselerasi dibatasi 8 m/s²; jalan maks 1,35 m/s', () => {
    const a = stepWalk(createWalkState(), fwd(), 0.05);
    expect(walkSpeedOf(a)).toBeCloseTo(0.4, 6);
    const b = run(createWalkState(), fwd(), 1);
    expect(walkSpeedOf(b)).toBeCloseTo(WALK.walkSpeed, 6);
  });

  it('Shift: lari 3,2 m/s dan tidak lebih', () => {
    const s = run(createWalkState(), fwd({ run: true }), 2);
    expect(walkSpeedOf(s)).toBeCloseTo(WALK.runSpeed, 6);
  });

  it('diagonal dinormalkan (tidak lebih cepat)', () => {
    const s = run(createWalkState(), fwd({ strafe: 1 }), 1);
    expect(walkSpeedOf(s)).toBeCloseTo(WALK.walkSpeed, 6);
  });

  it('arah: yaw 0 → +z; yaw π/2 → +x; geser kanan di yaw 0 → −x', () => {
    expect(run(createWalkState(), fwd(), 1).z).toBeGreaterThan(0.5);
    expect(run(createWalkState(), fwd({ yaw: Math.PI / 2 }), 1).x).toBeGreaterThan(0.5);
    expect(run(createWalkState(), { forward: 0, strafe: 1, yaw: 0 }, 1).x).toBeLessThan(-0.5);
  });

  it('tanpa masukan melambat sampai berhenti (≤ 0,2 s dari kecepatan jalan)', () => {
    const moving = run(createWalkState(), fwd(), 1);
    const stopped = run(moving, { forward: 0, strafe: 0, yaw: 0 }, 0.2);
    expect(walkSpeedOf(stopped)).toBe(0);
  });

  it('dinding: tidak pernah menembus; diagonal ke dinding menggeser sepanjang dinding', () => {
    const wall = { isWalkable: (x) => x < 1 };
    const s = run(createWalkState(), fwd({ yaw: Math.PI / 2, run: true }), 3, wall);
    expect(s.x).toBeLessThan(1);
    const slide = run(createWalkState(), fwd({ yaw: Math.PI / 4 }), 3, wall);
    expect(slide.x).toBeLessThan(1);
    expect(slide.z).toBeGreaterThan(1.5);
  });

  it('dinding tipis 6 cm (> sub-langkah 5 cm) tidak tertembus walau lari dengan dt besar', () => {
    const thin = { isWalkable: (x) => !(x > 0.5 && x < 0.56) };
    const s = run(createWalkState(), fwd({ yaw: Math.PI / 2, run: true }), 2, thin, 0.1);
    expect(s.x).toBeLessThan(0.5);
  });

  it('dt tidak valid tidak menggerakkan; dt besar dibatasi', () => {
    const s0 = createWalkState();
    expect(stepWalk(s0, fwd(), Number.NaN)).toMatchObject({ x: 0, z: 0, vx: 0, vz: 0 });
    expect(stepWalk(s0, fwd(), -1)).toMatchObject({ x: 0, z: 0 });
    const big = stepWalk(s0, fwd(), 5);
    expect(walkSpeedOf(big)).toBeCloseTo(WALK.accel * WALK.maxDt, 6);
  });

  it('terjebak di dalam penghalang: boleh bergerak keluar', () => {
    const solid = { isWalkable: (x, z) => !(Math.abs(x) < 0.3 && Math.abs(z) < 0.3) };
    const s = run(createWalkState(), fwd(), 1, solid);
    expect(s.z).toBeGreaterThan(0.3);
  });

  it('immutabel: state & input beku tidak berubah; yaw tanpa masukan dipertahankan', () => {
    const s0 = deepFreeze(createWalkState({ yaw: 1 }));
    const input = deepFreeze({ forward: 1 });
    const s1 = stepWalk(s0, input, 0.1);
    expect(s1).not.toBe(s0);
    expect(s1.yaw).toBe(1);
  });

  it('state rusak dipulihkan ke state valid', () => {
    const s = stepWalk({ x: Number.NaN, z: 0, yaw: 0, vx: 0, vz: 0 }, fwd(), 0.1);
    expect(Number.isFinite(s.x)).toBe(true);
  });
});

describe('desiredVelocity', () => {
  it('stick analog setengah → setengah kecepatan', () => {
    const v = desiredVelocity({ forward: 0.5, strafe: 0 }, 0);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(WALK.walkSpeed / 2, 9);
  });
});
```

- [ ] **Step 2: Jalankan → FAIL** (import tidak ditemukan)

Run: `node node_modules/vitest/vitest.mjs run tests/walkPhysics.test.js`

- [ ] **Step 3: Implementasi `src/sim/walkPhysics.js`**

```js
/**
 * Fisika jalan kaki interior (spec §4.9), murni & immutable: state baru tiap langkah.
 * Jalan 1,35 m/s, lari 3,2 m/s (Shift), akselerasi/deselerasi maks 8 m/s² (vektor), arah hadap = yaw kamera
 * (mouse). Tabrakan 2D lewat collider.isWalkable(x, z): sub-langkah ≤ 5 cm agar dinding tipis tidak tertembus;
 * bila terhalang, gerak digeser sepanjang sumbu yang masih bebas. Bila posisi awal sudah di dalam penghalang
 * (spawn/NPC baru duduk), gerak tidak dicek agar pemain bisa keluar.
 * Konvensi yaw = sepeda/Humanoid: maju = (sin yaw, cos yaw), kanan = (−cos yaw, sin yaw).
 */
export const WALK = Object.freeze({ walkSpeed: 1.35, runSpeed: 3.2, accel: 8, maxStep: 0.05, maxDt: 0.1 });

const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function wrapAngle(a) {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

/** @returns {Readonly<{x:number,z:number,yaw:number,vx:number,vz:number}>} */
export function createWalkState({ x = 0, z = 0, yaw = 0 } = {}) {
  return Object.freeze({ x: fin(x), z: fin(z), yaw: wrapAngle(fin(yaw)), vx: 0, vz: 0 });
}

/** Laju mendatar (m/s). */
export function walkSpeedOf(state) {
  return Math.hypot(fin(state?.vx), fin(state?.vz));
}

/**
 * Kecepatan target dari masukan (forward/strafe −1..1, run) pada yaw; diagonal dinormalkan,
 * masukan analog < 1 menghasilkan kecepatan proporsional.
 */
export function desiredVelocity(input, yaw) {
  const f = clamp(fin(input?.forward), -1, 1);
  const s = clamp(fin(input?.strafe), -1, 1);
  const len = Math.hypot(f, s);
  if (len < 1e-6) return { x: 0, z: 0 };
  const k = (input.run ? WALK.runSpeed : WALK.walkSpeed) / Math.max(1, len);
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  return { x: (f * fx - s * fz) * k, z: (f * fz + s * fx) * k };
}

/**
 * @param {{x:number,z:number,yaw:number,vx:number,vz:number}} state
 * @param {{forward?:number, strafe?:number, run?:boolean, yaw?:number}} input
 * @param {number} dt detik (dibatasi 0..WALK.maxDt)
 * @param {{isWalkable(x:number, z:number):boolean}|null} collider
 */
export function stepWalk(state, input, dt, collider = null) {
  if (![state?.x, state?.z, state?.vx, state?.vz].every(Number.isFinite)) return createWalkState(state ?? {});
  const d = clamp(fin(dt), 0, WALK.maxDt);
  const yaw = wrapAngle(Number.isFinite(input?.yaw) ? input.yaw : fin(state.yaw));
  const want = desiredVelocity(input, yaw);
  const dvx = want.x - state.vx;
  const dvz = want.z - state.vz;
  const dv = Math.hypot(dvx, dvz);
  const maxDv = WALK.accel * d;
  const k = dv > maxDv ? maxDv / dv : 1;
  let vx = state.vx + dvx * k;
  let vz = state.vz + dvz * k;
  const stuck = Boolean(collider) && !collider.isWalkable(state.x, state.z);
  const free = (px, pz) => !collider || stuck || collider.isWalkable(px, pz);
  const steps = Math.max(1, Math.ceil((Math.hypot(vx, vz) * d) / WALK.maxStep));
  const h = d / steps;
  let { x, z } = state;
  for (let i = 0; i < steps; i += 1) {
    const nx = x + vx * h;
    const nz = z + vz * h;
    if (free(nx, nz)) {
      x = nx;
      z = nz;
    } else if (vx !== 0 && free(nx, z)) {
      x = nx;
      vz = 0;
    } else if (vz !== 0 && free(x, nz)) {
      z = nz;
      vx = 0;
    } else {
      vx = 0;
      vz = 0;
      break;
    }
  }
  return Object.freeze({ x, z, yaw, vx, vz });
}
```

- [ ] **Step 4: Jalankan → PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/walkPhysics.test.js`
Expected: semua PASS. (Bila "tanpa masukan melambat" gagal karena pembulatan, periksa bahwa `k` = 1 saat
`dv ≤ maxDv` sehingga kecepatan tepat 0.)

- [ ] **Step 5: Commit**

```
git add src/sim/walkPhysics.js tests/walkPhysics.test.js
```
```
git commit -m "feat(sim): fisika jalan kaki interior (jalan 1,35 / lari 3,2 m/s, akselerasi 8 m/s², sub-langkah anti tembus dinding)"
```

---

## Task 4: Jadwal aktivitas NPC (TDD, jam-jam batas)

**Files:**
- Create: `src/sim/activitySchedule.js`, `tests/activitySchedule.test.js`

- [ ] **Step 1: Tes gagal `tests/activitySchedule.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { PERIODS, periodAt, scheduleFor, DEFAULT_NPC_IDS } from '../src/sim/activitySchedule.js';

const POSE = {
  'rapat-1': 'sitCrossLegged', 'rapat-2': 'sitCrossLegged', 'rapat-3': 'sitCrossLegged', 'rapat-4': 'sitCrossLegged',
  laptop: 'sitChairTyping', gitar: 'guitarStrum', rebahan: 'lieDown', whiteboard: 'writeBoard',
  'ngobrol-1': 'standTalk', 'ngobrol-2': 'standTalk', minum: 'drinkCup',
};
const SLOTS = Object.entries(POSE).map(([id, poseId]) => ({ id, poseId }));

describe('periodAt (jam batas, spec §8.2)', () => {
  it.each([
    [7.999, 'pagi-kosong'], [8, 'rapat'], [11.999, 'rapat'], [12, 'sepi'], [13.999, 'sepi'], [14, 'santai'],
    [17.999, 'santai'], [18, 'begadang'], [22.999, 'begadang'], [23, 'tidur'], [0, 'tidur'], [4.999, 'tidur'],
    [5, 'pagi-kosong'], [24, 'tidur'], [-1, 'tidur'], [Number.NaN, 'tidur'], [32, 'rapat'],
  ])('jam %s → %s', (h, id) => {
    expect(periodAt(h).id).toBe(id);
  });

  it('24 jam tertutup tanpa celah/tumpang tindih', () => {
    for (let h = 0; h < 24; h += 0.05) {
      const hits = PERIODS.filter((p) => (p.from < p.to ? h >= p.from && h < p.to : h >= p.from || h < p.to));
      expect(hits.length).toBe(1);
    }
  });
});

describe('scheduleFor', () => {
  const counts = (hour) => Array.from({ length: 300 }, (_, seed) => scheduleFor(hour, seed, SLOTS).length);

  it.each([[10, 4, 5], [13, 1, 2], [15, 3, 4], [20, 4, 6], [1, 2, 3], [6, 0, 1]])(
    'jam %s: jumlah NPC dalam [%s, %s] dan kedua ujung muncul',
    (hour, min, max) => {
      const c = counts(hour);
      expect(Math.min(...c)).toBe(min);
      expect(Math.max(...c)).toBe(max);
    },
  );

  it('rapat 4 orang = lesehan saja; 5 orang = + papan tulis', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const r = scheduleFor(9, seed, SLOTS).map((a) => a.slotId);
      if (r.length === 4) expect(r).not.toContain('whiteboard');
      else expect(r).toContain('whiteboard');
    }
  });

  it('begadang selalu memuat laptop dan whiteboard', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const r = scheduleFor(21, seed, SLOTS).map((a) => a.slotId);
      expect(r).toEqual(expect.arrayContaining(['laptop', 'whiteboard']));
    }
  });

  it('npc & slot unik; poseId mengikuti slot; hasil beku', () => {
    for (const hour of [6, 9, 13, 15, 20, 2]) {
      const r = scheduleFor(hour, 7, SLOTS);
      expect(new Set(r.map((a) => a.npcId)).size).toBe(r.length);
      expect(new Set(r.map((a) => a.slotId)).size).toBe(r.length);
      for (const a of r) {
        expect(a.poseId).toBe(POSE[a.slotId]);
        expect(DEFAULT_NPC_IDS).toContain(a.npcId);
        expect(Object.isFrozen(a)).toBe(true);
      }
    }
  });

  it('deterministik & stabil sepanjang satu periode; seed beda bisa beda', () => {
    expect(scheduleFor(8.1, 42, SLOTS)).toEqual(scheduleFor(11.9, 42, SLOTS));
    const differs = [1, 2, 3, 4, 5, 6, 7, 8].some((s) => JSON.stringify(scheduleFor(20, s, SLOTS)) !== JSON.stringify(scheduleFor(20, 0, SLOTS)));
    expect(differs).toBe(true);
  });

  it('slot yang tidak tersedia dilewati; jumlah dibatasi slot & npc yang ada', () => {
    const noGuitar = SLOTS.filter((s) => s.id !== 'gitar');
    for (let seed = 0; seed < 50; seed += 1) {
      expect(scheduleFor(15, seed, noGuitar).map((a) => a.slotId)).not.toContain('gitar');
      expect(scheduleFor(20, seed, SLOTS, ['a', 'b']).length).toBeLessThanOrEqual(2);
    }
    expect(scheduleFor(10, 1, null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan → FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/activitySchedule.test.js`

- [ ] **Step 3: Implementasi `src/sim/activitySchedule.js`**

```js
/**
 * Jadwal aktivitas NPC sekre (spec §4.10, §8.2), murni & deterministik.
 * Periode [from, to) jam game (wrap 24): 05–08 kosong/1 tidur, 08–12 rapat (4–5), 12–14 sepi/makan (1–2),
 * 14–18 santai + gitar (3–4), 18–23 begadang proker (laptop + whiteboard + rapat, 4–6), 23–05 sebagian
 * tidur (2–3). Jumlah & penugasan NPC dari hash(seed, periode) → sama sepanjang periode (tidak berkedip),
 * berbeda antar seed. Slot diisi menurut urutan prioritas periode; slot yang tidak tersedia dilewati.
 */
export const DEFAULT_NPC_IDS = Object.freeze(['npc-1', 'npc-2', 'npc-3', 'npc-4', 'npc-5', 'npc-6']);

const period = (id, from, to, min, max, slots) => Object.freeze({ id, from, to, min, max, slots: Object.freeze(slots) });

export const PERIODS = Object.freeze([
  period('pagi-kosong', 5, 8, 0, 1, ['rebahan']),
  period('rapat', 8, 12, 4, 5, ['rapat-1', 'rapat-2', 'rapat-3', 'rapat-4', 'whiteboard']),
  period('sepi', 12, 14, 1, 2, ['minum', 'rapat-1']),
  period('santai', 14, 18, 3, 4, ['gitar', 'ngobrol-1', 'ngobrol-2', 'rapat-3']),
  period('begadang', 18, 23, 4, 6, ['laptop', 'whiteboard', 'rapat-1', 'rapat-2', 'rapat-3', 'rapat-4']),
  period('tidur', 23, 5, 2, 3, ['rebahan', 'laptop', 'rapat-2']),
]);

const wrapHour = (h) => (Number.isFinite(h) ? ((h % 24) + 24) % 24 : 0);

/** Periode yang memuat jam (wrap 24; NaN → 0). */
export function periodAt(hour) {
  const h = wrapHour(hour);
  return PERIODS.find((p) => (p.from < p.to ? h >= p.from && h < p.to : h >= p.from || h < p.to));
}

function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function mix(a, b) {
  let x = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rnd) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * @param {number} hourFloat jam game desimal
 * @param {number} seed
 * @param {Array<{id:string, poseId:string}>} slots slot aktivitas yang ada di ruangan
 * @param {readonly string[]} [npcIds]
 * @returns {ReadonlyArray<Readonly<{npcId:string, slotId:string, poseId:string}>>}
 */
export function scheduleFor(hourFloat, seed, slots, npcIds = DEFAULT_NPC_IDS) {
  const p = periodAt(hourFloat);
  const byId = new Map((Array.isArray(slots) ? slots : []).map((s) => [s.id, s]));
  const available = p.slots.filter((id) => byId.has(id));
  const rnd = rngFrom(mix(Number.isFinite(seed) ? seed >>> 0 : 0, hashString(p.id)));
  const want = p.min + Math.floor(rnd() * (p.max - p.min + 1));
  const ids = Array.isArray(npcIds) ? npcIds : [];
  const count = Math.min(want, available.length, ids.length);
  const roster = shuffled(ids, rnd);
  return Object.freeze(available.slice(0, count).map((slotId, i) => Object.freeze({
    npcId: roster[i], slotId, poseId: byId.get(slotId).poseId,
  })));
}
```

- [ ] **Step 4: Jalankan → PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/activitySchedule.test.js`
Expected: PASS. (Tes "kedua ujung muncul" memakai 300 seed; peluang ujung tidak muncul untuk rentang 3 nilai
≈ 3·(2/3)^300 ≈ 0.)

- [ ] **Step 5: Commit**

```
git add src/sim/activitySchedule.js tests/activitySchedule.test.js
```
```
git commit -m "feat(sim): jadwal aktivitas NPC sekre per jam game (periode spec §8.2, deterministik per seed)"
```

---

## Task 5: Sintesis audio prosedural + `AudioBus` synth (TDD)

**Files:**
- Create: `src/core/audioSynth.js`, `tests/audioSynth.test.js`, `tests/audioBusSynth.test.js`
- Modify: `src/core/AudioBus.js`

- [ ] **Step 1: Tes gagal `tests/audioSynth.test.js`**

```js
import { describe, it, expect } from 'vitest';
import {
  karplusStrong, makeLoopable, fanHumBuffer, rainOnTinBuffer, murmurBuffer,
} from '../src/core/audioSynth.js';

const SR = 8000;
const rms = (a, from = 0, to = a.length) => {
  let s = 0;
  for (let i = from; i < to; i += 1) s += a[i] * a[i];
  return Math.sqrt(s / Math.max(1, to - from));
};
const bounded = (a) => a.every((v) => Number.isFinite(v) && Math.abs(v) <= 1);

describe('karplusStrong', () => {
  const tone = karplusStrong(196, SR, 1.5, { seed: 3 });
  it('panjang, terbatas, puncak ≈ 0,9', () => {
    expect(tone.length).toBe(Math.round(SR * 1.5));
    expect(bounded(tone)).toBe(true);
    expect(Math.max(...tone.map(Math.abs))).toBeCloseTo(0.9, 2);
  });
  it('meluruh: energi akhir jauh lebih kecil dari awal', () => {
    const n = tone.length;
    expect(rms(tone, n - n / 10, n)).toBeLessThan(rms(tone, 0, n / 10) * 0.5);
  });
  it('nada dasar ≈ frekuensi (autokorelasi, ±3%)', () => {
    const lagWant = SR / 196;
    let best = 0;
    let bestLag = 0;
    for (let lag = 20; lag < 80; lag += 1) {
      let s = 0;
      for (let i = 200; i < 2200; i += 1) s += tone[i] * tone[i + lag];
      if (s > best) { best = s; bestLag = lag; }
    }
    expect(Math.abs(bestLag - lagWant) / lagWant).toBeLessThan(0.03);
  });
  it('deterministik per seed', () => {
    expect(karplusStrong(220, SR, 0.2, { seed: 9 })).toEqual(karplusStrong(220, SR, 0.2, { seed: 9 }));
    expect(karplusStrong(220, SR, 0.2, { seed: 9 })).not.toEqual(karplusStrong(220, SR, 0.2, { seed: 10 }));
  });
});

describe('makeLoopable', () => {
  it('memendekkan sebesar fade dan menyambung ujung ke awal', () => {
    const data = Float32Array.from({ length: 100 }, (_, i) => i / 100);
    const out = makeLoopable(data, 10);
    expect(out.length).toBe(90);
    expect(out[0]).toBeCloseTo(data[90], 9);
    expect(out[89]).toBeCloseTo(data[89], 9);
  });
});

describe.each([
  ['fanHumBuffer', fanHumBuffer, 4],
  ['rainOnTinBuffer', rainOnTinBuffer, 6],
  ['murmurBuffer', murmurBuffer, 8],
])('%s', (_name, fn, seconds) => {
  const buf = fn(SR);
  it('panjang = detik × sampleRate, terbatas, tidak sunyi', () => {
    expect(buf.length).toBe(Math.round(SR * seconds));
    expect(bounded(buf)).toBe(true);
    expect(rms(buf)).toBeGreaterThan(0.01);
  });
  it('sambungan loop tidak meloncat lebih besar dari langkah sinyal itu sendiri', () => {
    let maxStep = 0;
    for (let i = 1; i < buf.length; i += 1) maxStep = Math.max(maxStep, Math.abs(buf[i] - buf[i - 1]));
    expect(Math.abs(buf[0] - buf[buf.length - 1])).toBeLessThanOrEqual(maxStep * 1.5 + 1e-6);
  });
});
```

- [ ] **Step 2: Tes gagal `tests/audioBusSynth.test.js`** (AudioContext tiruan)

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAudioBus } from '../src/core/AudioBus.js';

function fakeAudio() {
  const made = { buffers: 0, sources: [] };
  const param = () => ({ value: 1, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() });
  const node = () => ({ gain: param(), connect(n) { return n; }, disconnect: vi.fn() });
  class Ctx {
    constructor() { this.sampleRate = 8000; this.currentTime = 0; this.state = 'running'; this.destination = node(); }
    createGain() { return node(); }
    createBuffer(ch, len, sr) { made.buffers += 1; const data = new Float32Array(len); return { length: len, sampleRate: sr, getChannelData: () => data }; }
    createBufferSource() {
      const s = { ...node(), buffer: null, loop: false, start: vi.fn(), stop: vi.fn(), onended: null };
      made.sources.push(s);
      return s;
    }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  return { Ctx, made };
}

afterEach(() => { delete globalThis.AudioContext; });

describe('AudioBus synth', () => {
  it('tanpa Web Audio: semua synth no-op aman', () => {
    const bus = createAudioBus({ target: new EventTarget() });
    expect(bus.pluck(220)).toBe(false);
    const h = bus.startFanHum();
    expect(() => { h.setLevel(0.5); h.stop(); }).not.toThrow();
    bus.dispose();
  });

  it('pluck membuat buffer sekali per frekuensi lalu memakai cache', () => {
    const { Ctx, made } = fakeAudio();
    globalThis.AudioContext = Ctx;
    const bus = createAudioBus({ target: new EventTarget() });
    expect(bus.pluck(196, { seconds: 0.2 })).toBe(true);
    expect(bus.pluck(196, { seconds: 0.2 })).toBe(true);
    expect(made.buffers).toBe(1);
    expect(made.sources).toHaveLength(2);
    bus.dispose();
  });

  it('loop: source loop=true, setLevel memakai setTargetAtTime, stop & dispose menghentikan', () => {
    const { Ctx, made } = fakeAudio();
    globalThis.AudioContext = Ctx;
    const bus = createAudioBus({ target: new EventTarget() });
    const rain = bus.startRainOnTin({ level: 0 });
    const src = made.sources.at(-1);
    expect(src.loop).toBe(true);
    expect(src.start).toHaveBeenCalled();
    rain.setLevel(0.3);
    const murmur = bus.startMurmur();
    bus.dispose();
    expect(src.stop).toHaveBeenCalled();
    expect(made.sources.at(-1).stop).toHaveBeenCalled();
    expect(rain.stopped).toBe(true);
    expect(murmur.stopped).toBe(true);
  });
});
```

- [ ] **Step 3: Jalankan keduanya → FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/audioSynth.test.js tests/audioBusSynth.test.js`

- [ ] **Step 4: Implementasi `src/core/audioSynth.js`**

```js
/**
 * Sintesis audio prosedural MURNI (tanpa Web Audio): menghasilkan Float32Array mono yang dimainkan AudioBus.
 * Tanpa berkas audio berlisensi. Semua generator deterministik per seed.
 * - karplusStrong: senar dipetik (gitar), ring buffer derau + rerata dua sampel teredam.
 * - fanHumBuffer: dengung motor 100 Hz (listrik 50 Hz) + desis angin bilah termodulasi.
 * - rainOnTinBuffer: desis hujan + ketukan "tik" logam acak (atap seng).
 * - murmurBuffer: gumaman obrolan teredam dinding (derau ber-formant dengan amplop suku kata).
 * Buffer loop dibuat sedikit lebih panjang lalu ujungnya di-crossfade ke awal (makeLoopable).
 */
const TAU = Math.PI * 2;
const LOOP_FADE_S = 0.12;

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sr8 = (sampleRate) => Math.max(8000, Math.round(sampleRate));

/** Skala agar puncak |x| = peak (sunyi dibiarkan). Memodifikasi & mengembalikan `data`. */
export function normalizePeak(data, peak = 0.9) {
  let max = 0;
  for (let i = 0; i < data.length; i += 1) max = Math.max(max, Math.abs(data[i]));
  if (max > 1e-9) {
    const k = peak / max;
    for (let i = 0; i < data.length; i += 1) data[i] *= k;
  }
  return data;
}

function fadeEdges(data, fadeIn, fadeOut) {
  const n = data.length;
  for (let i = 0; i < Math.min(fadeIn, n); i += 1) data[i] *= i / fadeIn;
  for (let i = 0; i < Math.min(fadeOut, n); i += 1) data[n - 1 - i] *= i / fadeOut;
}

/** Buffer loop mulus: `fade` sampel terakhir di-crossfade ke awal; panjang hasil = len − fade. */
export function makeLoopable(data, fade) {
  const n = data.length - fade;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    if (i < fade) {
      const w = i / fade;
      out[i] = data[i] * w + data[n + i] * (1 - w);
    } else {
      out[i] = data[i];
    }
  }
  return out;
}

/**
 * Senar dipetik (Karplus-Strong).
 * @param {number} freq Hz @param {number} sampleRate @param {number} seconds
 * @param {{decay?:number, brightness?:number, seed?:number}} [opts]
 */
export function karplusStrong(freq, sampleRate, seconds, { decay = 0.996, brightness = 0.5, seed = 1 } = {}) {
  const sr = sr8(sampleRate);
  const f = Math.min(sr / 4, Math.max(20, Number(freq) || 220));
  const total = Math.max(1, Math.round(sr * seconds));
  const n = Math.max(2, Math.round(sr / f));
  const rnd = mulberry(seed);
  const buf = new Float32Array(n);
  const b = Math.min(1, Math.max(0, brightness));
  let prev = 0;
  let mean = 0;
  for (let i = 0; i < n; i += 1) {
    prev += (rnd() * 2 - 1 - prev) * (0.2 + 0.8 * b);
    buf[i] = prev;
    mean += prev / n;
  }
  for (let i = 0; i < n; i += 1) buf[i] -= mean;
  const out = new Float32Array(total);
  let idx = 0;
  for (let i = 0; i < total; i += 1) {
    const cur = buf[idx];
    const next = buf[(idx + 1) % n];
    out[i] = cur;
    buf[idx] = decay * 0.5 * (cur + next);
    idx = (idx + 1) % n;
  }
  fadeEdges(out, Math.round(sr * 0.002), Math.round(sr * 0.05));
  return normalizePeak(out, 0.9);
}

/** Dengung kipas berdiri, loop 4 s. */
export function fanHumBuffer(sampleRate, { seconds = 4, seed = 3 } = {}) {
  const sr = sr8(sampleRate);
  const fade = Math.round(sr * LOOP_FADE_S);
  const total = Math.round(sr * seconds) + fade;
  const rnd = mulberry(seed);
  const out = new Float32Array(total);
  let lp = 0;
  let lp2 = 0;
  for (let i = 0; i < total; i += 1) {
    const t = i / sr;
    const hum = 0.35 * Math.sin(TAU * 100 * t) + 0.12 * Math.sin(TAU * 200 * t) + 0.05 * Math.sin(TAU * 300 * t);
    lp += (rnd() * 2 - 1 - lp) * 0.06;
    lp2 += (lp - lp2) * 0.06;
    const blade = 1 + 0.35 * Math.sin(TAU * 18 * t);
    out[i] = hum * 0.25 + lp2 * 2.2 * blade;
  }
  return normalizePeak(makeLoopable(out, fade), 0.8);
}

/** Hujan di atap seng, loop 6 s: desis + rumble + ketukan logam acak (~density per detik). */
export function rainOnTinBuffer(sampleRate, { seconds = 6, seed = 5, density = 160 } = {}) {
  const sr = sr8(sampleRate);
  const fade = Math.round(sr * LOOP_FADE_S);
  const total = Math.round(sr * seconds) + fade;
  const rnd = mulberry(seed);
  const out = new Float32Array(total);
  const pings = [];
  let lp = 0;
  let low = 0;
  for (let i = 0; i < total; i += 1) {
    const white = rnd() * 2 - 1;
    lp += (white - lp) * 0.35;
    low += (white - low) * 0.01;
    let s = (white - lp) * 0.22 + low * 0.9;
    if (rnd() < density / sr && pings.length < 32) {
      const f = 1800 + rnd() * 2600;
      const tau = 0.003 + rnd() * 0.006;
      pings.push({ phase: 0, step: (TAU * f) / sr, env: 0.2 + rnd() * 0.8, k: Math.exp(-1 / (tau * sr)) });
    }
    for (let p = pings.length - 1; p >= 0; p -= 1) {
      const ping = pings[p];
      s += Math.sin(ping.phase) * ping.env * 0.35;
      ping.phase += ping.step;
      ping.env *= ping.k;
      if (ping.env < 1e-3) pings.splice(p, 1);
    }
    out[i] = s;
  }
  return normalizePeak(makeLoopable(out, fade), 0.8);
}

/** Resonator dua kutub (formant sederhana). */
function resonator(freq, r, sr) {
  const a1 = 2 * r * Math.cos((TAU * freq) / sr);
  const a2 = r * r;
  let y1 = 0;
  let y2 = 0;
  return (x) => {
    const y = x * (1 - r) + a1 * y1 - a2 * y2;
    y2 = y1;
    y1 = y;
    return y;
  };
}

/** Gumaman obrolan beberapa orang di balik dinding, loop 8 s. */
export function murmurBuffer(sampleRate, { seconds = 8, seed = 7, voices = 4 } = {}) {
  const sr = sr8(sampleRate);
  const fade = Math.round(sr * LOOP_FADE_S);
  const total = Math.round(sr * seconds) + fade;
  const rnd = mulberry(seed);
  const out = new Float32Array(total);
  for (let v = 0; v < voices; v += 1) {
    const f1 = resonator(450 + rnd() * 250, 0.985, sr);
    const f2 = resonator(1200 + rnd() * 600, 0.98, sr);
    const rate = 4 + rnd() * 2;
    let talking = rnd() < 0.6;
    let timer = (0.4 + rnd() * 1.6) * sr;
    let syl = rnd();
    let env = 0;
    for (let i = 0; i < total; i += 1) {
      timer -= 1;
      if (timer <= 0) {
        talking = !talking;
        timer = (talking ? 1.2 + rnd() * 2.4 : 0.4 + rnd() * 0.8) * sr;
      }
      syl += rate / sr;
      const target = talking ? Math.abs(Math.sin(Math.PI * syl)) ** 1.5 : 0;
      env += (target - env) * 0.004;
      const x = rnd() * 2 - 1;
      out[i] += (f1(x) + 0.6 * f2(x)) * env;
    }
  }
  let lp = 0;
  for (let i = 0; i < total; i += 1) {
    lp += (out[i] - lp) * 0.15;
    out[i] = lp;
  }
  return normalizePeak(makeLoopable(out, fade), 0.8);
}
```

- [ ] **Step 5: Ubah `src/core/AudioBus.js`**

5a. Tambah impor di atas file:
```js
import { karplusStrong, fanHumBuffer, rainOnTinBuffer, murmurBuffer } from './audioSynth.js';
```

5b. Perbarui typedef `AudioBus` (tambahkan sebelum `dispose(): void`):
```js
 *   pluck(freq, opts?): boolean, startFanHum(opts?): LoopHandle, startRainOnTin(opts?): LoopHandle,
 *   startMurmur(opts?): LoopHandle,
```
dan tambahkan typedef baru di bawahnya:
```js
/** @typedef {{ setLevel(v:number, rampSeconds?:number): void, stop(): void, readonly stopped: boolean }} LoopHandle */
```

5c. Di dalam `createAudioBus`, tepat sebelum `const onGesture = () => resume();`, tambahkan:
```js
  const buffers = new Map(); // kunci -> AudioBuffer (sekali per konteks)
  const loops = new Set();   // handle loop aktif (dihentikan saat dispose)
  const NOOP_LOOP = Object.freeze({ setLevel() {}, stop() {}, stopped: true });

  /** AudioBuffer mono dari generator `make(sampleRate)`; null tanpa Web Audio. */
  const bufferFor = (key, make) => {
    if (!ensure()) return null;
    let b = buffers.get(key);
    if (!b) {
      const data = make(ctx.sampleRate);
      b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.getChannelData(0).set(data);
      buffers.set(key, b);
    }
    return b;
  };

  /** Mainkan buffer sekali ke kanal (default 'ambience'); true bila dijadwalkan. */
  const play = (key, make, { channel: ch = 'ambience', gain = 1, at = 0 } = {}) => {
    const buffer = bufferFor(key, make);
    if (!buffer) return false;
    resume();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = clamp01(gain);
    src.connect(g).connect(channel(ch) ?? masterGain);
    src.onended = () => { src.disconnect(); g.disconnect(); };
    src.start(ctx.currentTime + Math.max(0, Number(at) || 0));
    return true;
  };

  /** Putar buffer berulang dengan gain yang bisa diatur; handle no-op tanpa Web Audio. */
  const loop = (key, make, { channel: ch = 'ambience', level = 0 } = {}) => {
    const buffer = bufferFor(key, make);
    if (!buffer) return NOOP_LOOP;
    resume();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = clamp01(level);
    src.connect(g).connect(channel(ch) ?? masterGain);
    src.start();
    let stopped = false;
    const handle = {
      setLevel(v, rampSeconds = 0.25) {
        if (stopped || !ctx) return;
        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(clamp01(v), now, Math.max(0.01, rampSeconds / 3));
      },
      stop() {
        if (stopped) return;
        stopped = true;
        try { src.stop(); } catch { /* sudah berhenti */ }
        src.disconnect();
        g.disconnect();
        loops.delete(handle);
      },
      get stopped() { return stopped; },
    };
    loops.add(handle);
    return handle;
  };

  /** Senar dipetik (Karplus-Strong); buffer di-cache per frekuensi (0,01 Hz). */
  const pluck = (freq, { gain = 0.5, at = 0, channel: ch = 'ambience', seconds = 2.2 } = {}) => play(
    `pluck:${Math.round(freq * 100)}:${seconds}`,
    (sr) => karplusStrong(freq, sr, seconds, { seed: Math.round(freq) }),
    { channel: ch, gain, at },
  );
  const startFanHum = (opts) => loop('fanHum', (sr) => fanHumBuffer(sr), opts);
  const startRainOnTin = (opts) => loop('rainOnTin', (sr) => rainOnTinBuffer(sr), opts);
  const startMurmur = (opts) => loop('murmur', (sr) => murmurBuffer(sr), opts);
```

5d. Di `dispose`, sebelum `ctx?.close?.()...` tambahkan:
```js
    for (const h of [...loops]) h.stop();
    buffers.clear();
```

5e. Objek kembalian menjadi:
```js
  return {
    ensure, resume, channel, setMaster, setChannel, dispose, play, loop, pluck, startFanHum, startRainOnTin, startMurmur,
    get master() { return masterLevel; },
    get context() { return ctx; },
  };
```

- [ ] **Step 6: Jalankan → PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/audioSynth.test.js tests/audioBusSynth.test.js` lalu `npm test`
Expected: PASS semua (tes lama bel sepeda & cuaca tidak terpengaruh).

- [ ] **Step 7: Commit**

```
git add src/core/audioSynth.js src/core/AudioBus.js tests/audioSynth.test.js tests/audioBusSynth.test.js
```
```
git commit -m "feat(audio): synth prosedural AudioBus (pluck Karplus-Strong, dengung kipas, hujan di atap seng, gumaman obrolan)"
```

---

## Task 6: Humanoid skinned + pose sekre + outfit almamater

**Files:**
- Create: `src/entities/Humanoid.skinned.js`, `src/entities/Humanoid.poses.js`, `tests/humanoidPoses.test.js`
- Modify: `src/entities/Humanoid.outfits.js`

- [ ] **Step 1: Tes `tests/humanoidPoses.test.js`** (logika berisiko: pemanggangan tulang & pose tidak boleh NaN)

```js
import { describe, it, expect } from 'vitest';
import { createHumanoid } from '../src/entities/Humanoid.js';
import { bakeSkinnedHumanoid, SKIN_PIVOTS } from '../src/entities/Humanoid.skinned.js';
import { POSE_IDS, applyPose, clearPose } from '../src/entities/Humanoid.poses.js';
import { randomAlmamaterOutfit, ALMAMATER_UNRI, ALMAMATER_BADGE } from '../src/entities/Humanoid.outfits.js';
import { makeRng } from '../src/entities/util.js';

describe('bakeSkinnedHumanoid', () => {
  it('satu SkinnedMesh, 13 tulang, mesh asli dicabut, LOD dibuang, grup tangan tetap', () => {
    const h = createHumanoid({ hair: 'bob' });
    const skin = bakeSkinnedHumanoid(h);
    const meshes = [];
    h.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
    expect(meshes).toHaveLength(1);
    expect(meshes[0].isSkinnedMesh).toBe(true);
    expect(skin.skeleton.bones).toHaveLength(SKIN_PIVOTS.length);
    expect(h.group.userData.humanoidLod).toBeUndefined();
    expect(h.parts.handR.parent).toBe(h.parts.elbowR);
    skin.dispose();
  });

  it('setiap vertex ikut tepat satu tulang (bobot 1) dan berwarna vertex', () => {
    const h = createHumanoid();
    const { mesh } = bakeSkinnedHumanoid(h);
    const w = mesh.geometry.getAttribute('skinWeight');
    const c = mesh.geometry.getAttribute('color');
    expect(c.count).toBe(w.count);
    for (let i = 0; i < w.count; i += 97) expect(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i)).toBeCloseTo(1, 9);
  });

  it('sync menyalin rotasi pivot ke tulang', () => {
    const h = createHumanoid();
    const skin = bakeSkinnedHumanoid(h);
    h.parts.elbowR.rotation.x = -1.2;
    skin.sync();
    const bone = skin.skeleton.bones[SKIN_PIVOTS.indexOf('elbowR')];
    expect(bone.quaternion.angleTo(h.parts.elbowR.quaternion)).toBeLessThan(1e-6);
  });
});

describe('Humanoid.poses', () => {
  it('tujuh pose sesuai spec §4.10', () => {
    expect(POSE_IDS).toEqual(['sitCrossLegged', 'sitChairTyping', 'guitarStrum', 'lieDown', 'writeBoard', 'standTalk', 'drinkCup']);
  });

  it.each(POSE_IDS)('%s: semua sudut hingga di berbagai t, pinggul di atas lantai', (id) => {
    const h = createHumanoid();
    for (const t of [0, 1.3, 7.7, 100, Number.NaN]) {
      applyPose(h, id, t);
      for (const name of SKIN_PIVOTS) {
        const r = h.parts[name].rotation;
        expect([r.x, r.y, r.z].every(Number.isFinite)).toBe(true);
      }
      expect(h.parts.body.position.y).toBeGreaterThan(0);
    }
  });

  it('duduk lebih rendah dari berdiri; kursi di atas dudukan; rebahan memutar badan −90°', () => {
    const h = createHumanoid();
    applyPose(h, 'standTalk', 0);
    const stand = h.parts.body.position.y;
    applyPose(h, 'sitCrossLegged', 0);
    expect(h.parts.body.position.y).toBeLessThan(stand * 0.3);
    applyPose(h, 'sitChairTyping', 0);
    expect(h.parts.body.position.y).toBeGreaterThan(0.45);
    applyPose(h, 'lieDown', 0);
    expect(h.parts.body.rotation.x).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('idle halus: berubah sedikit antar frame (tidak beku, tidak meloncat)', () => {
    const h = createHumanoid();
    applyPose(h, 'standTalk', 1);
    const a = h.parts.shoulderR.rotation.x;
    applyPose(h, 'standTalk', 1 + 1 / 30);
    const d = Math.abs(h.parts.shoulderR.rotation.x - a);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(0.05);
  });

  it('pose tak dikenal melempar; clearPose mengembalikan badan, kepala, dan urutan Euler pinggul', () => {
    const h = createHumanoid();
    expect(() => applyPose(h, 'salto', 0)).toThrow('salto');
    applyPose(h, 'lieDown', 0);
    clearPose(h);
    expect(h.parts.body.rotation.x).toBe(0);
    expect(h.parts.headPivot.rotation.y).toBe(0);
    expect(h.parts.hipL.rotation.order).toBe('XYZ');
    expect(h.parts.body.position.y).toBeCloseTo(h.parts.body.userData.baseY, 9);
  });
});

describe('randomAlmamaterOutfit (C01)', () => {
  it('jas biru langit lengan panjang + lencana kuning, tanpa topi/caping, bukan celana pendek; deterministik', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const o = randomAlmamaterOutfit(makeRng(seed));
      expect(o.shirt).toBe(ALMAMATER_UNRI);
      expect(o.badge).toBe(ALMAMATER_BADGE);
      expect(o.longSleeve).toBe(true);
      expect(o.hat).toBeNull();
      expect(o.hair).not.toBe('caping');
      expect(o.bottom).not.toBe('shorts');
    }
    const a = randomAlmamaterOutfit(makeRng(5));
    const b = randomAlmamaterOutfit(makeRng(5));
    expect({ ...a, rng: null }).toEqual({ ...b, rng: null });
  });
});
```

- [ ] **Step 2: Jalankan → FAIL** (modul belum ada)

Run: `node node_modules/vitest/vitest.mjs run tests/humanoidPoses.test.js`

- [ ] **Step 3: `src/entities/Humanoid.skinned.js`**

```js
/**
 * Humanoid → satu SkinnedMesh rigid: 1 draw call per orang (interior berisi banyak NPC dekat kamera; Humanoid
 * biasa ±17 mesh). Setiap pivot (body, spine, kepala, bahu, siku, tangan, pinggul, lutut) menjadi satu tulang;
 * setiap vertex ikut tepat satu tulang (bobot 1) sehingga bentuknya sama persis dengan Humanoid biasa.
 * Animasi tetap menulis ke pivot (Humanoid.anim / Humanoid.poses), lalu sync() menyalin transform pivot ke
 * tulang. Mesh asli DICABUT dari pohon (bukan disembunyikan) agar geometri bersama (Humanoid.dim GEO) tidak
 * ikut dilepas disposeTree pemilik scene; grup tangan (handL/handR) tetap ada untuk properti yang dipegang.
 * Warna = atribut vertex (warna material × warna vertex bila ada); material Lambert bersama per ResourceScope.
 * dispose() melepas tekstur tulang skeleton (tidak terjangkau disposeTree).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { currentScope } from '../engine/ResourceScope.js';

export const SKIN_PIVOTS = Object.freeze([
  'body', 'spine', 'headPivot', 'shoulderL', 'elbowL', 'handL', 'shoulderR', 'elbowR', 'handR', 'hipL', 'kneeL', 'hipR', 'kneeR',
]);
const WHITE = new THREE.Color(0xffffff);

const skinnedMaterial = () => currentScope().get('humanoid:skinnedMaterial', () => new THREE.MeshLambertMaterial({
  vertexColors: true, side: THREE.DoubleSide,
}));

/** Salinan non-indexed (posisi, normal, warna, skinIndex/skinWeight satu tulang) dalam ruang grup. */
function bakePiece(mesh, boneIndex) {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', src.getAttribute('position').clone());
  if (src.getAttribute('normal')) geo.setAttribute('normal', src.getAttribute('normal').clone());
  else geo.computeVertexNormals();
  geo.applyMatrix4(mesh.matrixWorld);
  const n = geo.attributes.position.count;
  const base = mesh.material?.color ?? WHITE;
  const vc = src.getAttribute('color');
  const color = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  for (let i = 0; i < n; i += 1) {
    color[i * 3] = base.r * (vc ? vc.getX(i) : 1);
    color[i * 3 + 1] = base.g * (vc ? vc.getY(i) : 1);
    color[i * 3 + 2] = base.b * (vc ? vc.getZ(i) : 1);
    skinIndex[i * 4] = boneIndex;
    skinWeight[i * 4] = 1;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  src.dispose();
  return geo;
}

/**
 * @param {{group: THREE.Group, parts: Record<string, THREE.Object3D>}} humanoid hasil createHumanoid (belum dipose)
 * @returns {{mesh: THREE.SkinnedMesh, skeleton: THREE.Skeleton, sync(): void, dispose(): void}}
 */
export function bakeSkinnedHumanoid(humanoid) {
  const { group, parts } = humanoid;
  const lod = group.userData.humanoidLod;
  if (lod) {
    lod.mesh.removeFromParent();
    lod.mesh.geometry.dispose();
    delete group.userData.humanoidLod;
  }
  group.position.set(0, 0, 0);
  group.rotation.set(0, 0, 0);
  group.scale.set(1, 1, 1);
  group.updateMatrixWorld(true);
  const pivots = SKIN_PIVOTS.map((name) => {
    if (!parts[name]) throw new Error(`bakeSkinnedHumanoid: pivot "${name}" tidak ada`);
    return parts[name];
  });
  const boneOf = new Map(pivots.map((p, i) => [p, i]));
  const bones = pivots.map((p, i) => {
    const b = new THREE.Bone();
    b.name = SKIN_PIVOTS[i];
    b.position.copy(p.position);
    b.quaternion.copy(p.quaternion);
    b.scale.copy(p.scale);
    return b;
  });
  pivots.forEach((p, i) => { if (i > 0) bones[boneOf.get(p.parent)].add(bones[i]); });

  const meshes = [];
  parts.body.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position) meshes.push(o); });
  const pieces = meshes.map((m) => {
    let p = m.parent;
    while (p && !boneOf.has(p)) p = p.parent;
    return bakePiece(m, boneOf.get(p) ?? 0);
  });
  for (const m of meshes) m.removeFromParent();
  const geometry = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  if (!geometry) throw new Error('bakeSkinnedHumanoid: penggabungan geometri gagal');

  const mesh = new THREE.SkinnedMesh(geometry, skinnedMaterial());
  mesh.name = 'humanoidSkinned';
  mesh.castShadow = true;
  mesh.frustumCulled = false; // pose duduk/rebahan keluar dari bounding sphere pose diam
  mesh.add(bones[0]);
  group.add(mesh);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  return {
    mesh,
    skeleton,
    sync() {
      for (let i = 0; i < pivots.length; i += 1) {
        const p = pivots[i];
        const b = bones[i];
        b.position.copy(p.position);
        b.quaternion.copy(p.quaternion);
        b.scale.copy(p.scale);
      }
    },
    dispose() { skeleton.dispose(); },
  };
}
```

- [ ] **Step 4: `src/entities/Humanoid.poses.js`** (rotasi sendi konkret per pose + idle halus)

```js
/**
 * Pose NPC interior (spec §4.10, katalog C03–C09): duduk bersila (lesehan), duduk mengetik di kursi,
 * genjreng gitar (bersila), rebahan, menulis di papan, ngobrol berdiri, minum. Murni visual: hanya menulis
 * rotasi/posisi pivot Humanoid (konvensi sudut = Humanoid.anim.js: lengan/paha rotation.x NEGATIF = ke depan,
 * lutut POSITIF = menekuk, spine POSITIF = condong, kepala POSITIF = menunduk, bahu kiri .z POSITIF = terangkat
 * ke samping). Pinggul memakai urutan Euler 'XZY' agar putaran y = puntir sepanjang paha (perlu untuk kaki
 * bersila); dengan y = 0 hasilnya identik dengan 'XYZ' sehingga animasi lama tetap benar.
 * Tiap pose: `base` (sudut statis) + `idle(t, c)` (gerak kecil berulang: napas, menoleh, mengetik, genjreng).
 * Nilai awal dihitung dari geometri DIM (paha 0,36 m, betis 0,34 m); toleransi penyetelan visual ±0,3 rad.
 */
import { DIM, LIMB } from './Humanoid.dim.js';

const TAU = Math.PI * 2;
const CHAIR_SEAT = 0.45; // tinggi dudukan kursi lipat (m)
const CHANNELS = Object.freeze([
  'bodyRx', 'spine', 'head', 'headYaw', 'shL', 'shLz', 'shR', 'shRz', 'elL', 'elR',
  'hipL', 'hipLy', 'hipLz', 'hipR', 'hipRy', 'hipRz', 'kneeL', 'kneeR', 'bob', 'squash',
]);
const C = Object.fromEntries(CHANNELS.map((k) => [k, 0]));

/** Kaki bersila: paha ke depan-luar, puntir paha agar betis melipat menyilang di depan (kanan sedikit di atas). */
const CROSS_LEGS = Object.freeze({
  hipL: -1.35, hipLy: 1.18, hipLz: 0.7, kneeL: 2.62,
  hipR: -1.25, hipRy: -1.18, hipRz: -0.7, kneeR: 2.62,
});

const breathe = (t, c, k = 1) => {
  const s = Math.sin(t * 1.5);
  c.spine += 0.015 * s * k;
  c.squash += 0.006 * s * k;
  c.bob += 0.003 * s * k;
};
/** 0..1..0 berbentuk sinus selama `len` detik di awal setiap `period` detik. */
const pulse = (t, period, len) => {
  const u = ((t % period) + period) % period;
  return u > len ? 0 : Math.sin((u / len) * Math.PI);
};

const pose = (seat, base, idle) => Object.freeze({ seat, base: Object.freeze(base), idle });

export const POSES = Object.freeze({
  /** C03 lesehan rapat: bersila, tangan di lutut, sesekali menoleh & menggerakkan tangan saat bicara. */
  sitCrossLegged: pose('floor', {
    ...CROSS_LEGS, spine: 0.12, head: 0.06, shL: -0.55, shLz: 0.14, shR: -0.55, shRz: -0.14, elL: -0.9, elR: -0.9,
  }, (t, c) => {
    breathe(t, c);
    c.headYaw = 0.35 * Math.sin(t * 0.37) * pulse(t, 9, 4.5);
    c.head += 0.05 * Math.sin(t * 0.8);
    c.shR -= 0.35 * pulse(t, 5.5, 1.2);
    c.elR -= 0.3 * pulse(t, 5.5, 1.2);
  }),
  /** C04 laptop: duduk di kursi lipat, paha datar, lengan ke papan ketik, mengetik bergantian, sesekali bersandar. */
  sitChairTyping: pose('chair', {
    spine: 0.16, head: 0.22, shL: -0.85, shLz: 0.12, shR: -0.85, shRz: -0.12, elL: -1.0, elR: -1.0,
    hipL: -1.5, hipLz: 0.06, hipR: -1.5, hipRz: -0.06, kneeL: 1.45, kneeR: 1.45,
  }, (t, c) => {
    breathe(t, c, 0.6);
    const typing = pulse(t, 6, 4.2) > 0 ? 1 : 0;
    c.elL += 0.06 * Math.sin(t * 19) * typing;
    c.elR += 0.06 * Math.sin(t * 17 + 1.3) * typing;
    c.head += 0.05 * Math.sin(t * 0.5);
    c.spine -= 0.12 * pulse(t, 13, 2.5);
  }),
  /** C05 gitar: bersila, tangan kiri ke leher gitar (kiri badan), kanan menggenjreng ±2,2 Hz, kepala mengangguk. */
  guitarStrum: pose('floor', {
    ...CROSS_LEGS, spine: 0.08, head: 0.22, headYaw: 0.15,
    shL: -1.1, shLz: 0.55, elL: -0.65, shR: -0.45, shRz: -0.2, elR: -1.55,
  }, (t, c) => {
    const beat = Math.sin(t * TAU * 2.2);
    c.elR += 0.14 * beat;
    c.shR += 0.05 * beat;
    c.spine += 0.03 * Math.sin(t * TAU * 0.55);
    c.head += 0.05 * Math.sin(t * TAU * 1.1);
    breathe(t, c, 0.5);
  }),
  /** C06 rebahan: telentang (badan −90°), kepala terangkat bantal, tangan kanan di bawah kepala, lutut kiri naik. */
  lieDown: pose('lie', {
    bodyRx: -Math.PI / 2, head: 0.5, shR: -2.7, shRz: -0.25, elR: -1.9, shL: 0.05, shLz: 0.12, elL: -0.2,
    hipL: -0.7, kneeL: 1.3, hipR: -0.05, kneeR: 0.08,
  }, (t, c) => {
    const s = Math.sin(t * 0.9);
    c.squash += 0.01 * s;
    c.spine += 0.01 * s;
    c.hipL += 0.05 * Math.sin(t * 0.21);
    c.kneeL -= 0.05 * Math.sin(t * 0.21);
  }),
  /** C07 papan tulis: lengan kanan terangkat menulis (goresan 9 Hz); jeda: tangan turun & menoleh ke teman. */
  writeBoard: pose('stand', {
    spine: 0.03, head: -0.12, shR: -1.95, shRz: -0.22, elR: -0.7, shL: -0.45, shLz: 0.1, elL: -1.4, hipLz: 0.04, hipRz: -0.03,
  }, (t, c) => {
    const write = pulse(t, 7, 5);
    c.shRz += 0.16 * Math.sin(t * 0.8) * write;
    c.elR += 0.12 * Math.sin(t * 9) * write;
    c.shR += 0.5 * (1 - write);
    c.elR -= 0.3 * (1 - write);
    c.headYaw = -0.4 * (1 - write);
    breathe(t, c, 0.5);
  }),
  /** C08 ngobrol: tangan kanan bergestur, kiri di saku, mengangguk & menoleh, berat badan bergeser. */
  standTalk: pose('stand', {
    spine: 0.02, shL: 0.1, shLz: 0.14, elL: -0.5, shR: -0.4, shRz: -0.1, elR: -1.0, hipLz: 0.05, hipRz: -0.02,
  }, (t, c) => {
    c.shR += 0.25 * Math.sin(t * 1.7);
    c.elR += 0.3 * Math.sin(t * 2.3 + 0.7);
    c.head += 0.06 * Math.sin(t * 2.1);
    c.headYaw = 0.25 * Math.sin(t * 0.4);
    c.hipLz += 0.03 * Math.sin(t * 0.3);
    breathe(t, c);
  }),
  /** C09 minum: gelas di depan dada; tiap 7 detik menyesap (lengan naik, kepala mendongak) selama 1,6 detik. */
  drinkCup: pose('stand', {
    spine: 0.02, shR: -0.6, shRz: -0.12, elR: -1.6, shL: 0.05, shLz: 0.1, elL: -0.25,
  }, (t, c) => {
    const sip = pulse(t, 7, 1.6);
    c.shR -= 0.5 * sip;
    c.elR -= 0.6 * sip;
    c.head -= 0.28 * sip;
    breathe(t, c);
  }),
});

export const POSE_IDS = Object.freeze(Object.keys(POSES));

/** Tinggi pivot pinggul (m) per jenis duduk; skala tinggi badan memengaruhi tebal paha/torso. */
function seatY(p, seat) {
  const s = p.body.userData.baseScale ?? 1;
  if (seat === 'floor') return 0.03 + LIMB.thighR * s;
  if (seat === 'chair') return CHAIR_SEAT + LIMB.thighR * s;
  if (seat === 'lie') return 0.2 * s;
  return p.body.userData.baseY ?? DIM.hipY * s;
}

function write(p, seat) {
  p.body.position.y = seatY(p, seat) + C.bob;
  p.body.rotation.set(C.bodyRx, 0, 0);
  const base = p.body.userData.baseScale ?? 1;
  const sq = Math.max(-0.03, Math.min(0.03, C.squash));
  p.body.scale.set(base * (1 - sq * 0.5), base * (1 + sq), base * (1 - sq * 0.5));
  p.spine.rotation.set(C.spine, 0, 0);
  p.headPivot.rotation.set(C.head, C.headYaw, 0);
  p.shoulderL.rotation.set(C.shL, 0, C.shLz);
  p.shoulderR.rotation.set(C.shR, 0, C.shRz);
  p.elbowL.rotation.set(C.elL, 0, 0);
  p.elbowR.rotation.set(C.elR, 0, 0);
  p.hipL.rotation.order = 'XZY';
  p.hipR.rotation.order = 'XZY';
  p.hipL.rotation.set(C.hipL, C.hipLy, C.hipLz);
  p.hipR.rotation.set(C.hipR, C.hipRy, C.hipRz);
  p.kneeL.rotation.set(C.kneeL, 0, 0);
  p.kneeR.rotation.set(C.kneeR, 0, 0);
}

/**
 * Terapkan pose + idle pada waktu t (detik; NaN → 0). Tidak mengalokasikan objek per panggilan.
 * @param {{parts: Record<string, THREE.Object3D>}} humanoid
 * @param {string} poseId salah satu POSE_IDS
 * @param {number} [t]
 */
export function applyPose(humanoid, poseId, t = 0) {
  const def = POSES[poseId];
  if (!def) throw new Error(`Humanoid.poses: pose "${poseId}" tidak dikenal`);
  for (const k of CHANNELS) C[k] = 0;
  Object.assign(C, def.base);
  def.idle(Number.isFinite(t) ? t : 0, C);
  write(humanoid.parts, def.seat);
}

/** Kembalikan kanal yang tidak disentuh Humanoid.anim (rotasi badan, toleh kepala, puntir pinggul) ke netral. */
export function clearPose(humanoid) {
  const p = humanoid.parts;
  p.body.rotation.set(0, 0, 0);
  p.body.position.y = p.body.userData.baseY ?? DIM.hipY;
  p.headPivot.rotation.set(0, 0, 0);
  for (const hip of [p.hipL, p.hipR]) {
    hip.rotation.order = 'XYZ';
    hip.rotation.set(0, 0, 0);
  }
}
```

- [ ] **Step 5: Tambah outfit almamater di `src/entities/Humanoid.outfits.js`**

Tambahkan tepat di bawah fungsi `randomCasualOutfit`:
```js
/**
 * Jas almamater UNRI "biru langit" (riset §6: almamater biru langit [T]; nilai hex = [INFERENSI] warna umum
 * foto). Lencana kuning di dada mewakili lambang Lancang Kuning (bentuk disederhanakan).
 */
export const ALMAMATER_UNRI = 0x6fbfe8;
export const ALMAMATER_BADGE = 0xf2c200;

/** Mahasiswa berjas almamater (katalog C01): jas lengan panjang + lencana, tanpa topi, celana panjang/rok. */
export function randomAlmamaterOutfit(rng) {
  const base = randomCasualOutfit(rng);
  const bottom = base.bottom === 'shorts' ? 'pants' : base.bottom;
  const caping = base.hair === 'caping';
  return {
    ...base,
    shirt: ALMAMATER_UNRI,
    longSleeve: true,
    badge: ALMAMATER_BADGE,
    vest: null,
    hat: null,
    hair: caping ? pick(rng, HAIR_STYLES) : base.hair,
    hairColor: caping ? pick(rng, HAIR_COLORS) : base.hairColor,
    bottom,
    pants: bottom === 'skirt' ? base.pants : pick(rng, PANTS_COLORS),
  };
}
```

- [ ] **Step 6: Jalankan → PASS** lalu semua tes

Run: `node node_modules/vitest/vitest.mjs run tests/humanoidPoses.test.js` lalu `npm test`
Expected: PASS (tes humanoid/LOD lama tidak berubah).

- [ ] **Step 7: Commit**

```
git add src/entities/Humanoid.skinned.js src/entities/Humanoid.poses.js src/entities/Humanoid.outfits.js tests/humanoidPoses.test.js
```
```
git commit -m "feat(entities): Humanoid sebagai satu SkinnedMesh rigid, 7 pose interior (bersila, mengetik, gitar, rebahan, papan, ngobrol, minum), outfit almamater biru langit"
```

---

## Task 7: Walker (pemain berjalan kaki)

**Files:**
- Create: `src/entities/Walker.js`

Kode lem + visual (fisika sudah dites di Task 3); diverifikasi lewat portal di browser (Task 20).

- [ ] **Step 1: Tulis `src/entities/Walker.js`**

```js
/**
 * Pemain berjalan kaki di interior: Humanoid (pakaian sama dengan pengendara sepeda; topi & sepatu dilepas di
 * dalam ruangan — alas kaki ditinggal di rak depan sekre) dipanggang menjadi SkinnedMesh, digerakkan
 * sim/walkPhysics. Arah hadap = yaw kamera interior (intent.yaw). Animasi: diam / jalan / lari menurut laju;
 * fase langkah mengikuti jarak tempuh.
 */
import { createHumanoid, animateIdle, animateWalk, animateRun } from './Humanoid.js';
import { bakeSkinnedHumanoid } from './Humanoid.skinned.js';
import { createWalkState, stepWalk, walkSpeedOf } from '../sim/walkPhysics.js';

export const PLAYER_OUTFIT = Object.freeze({
  skin: 0xc68642, shirt: 0x1abc9c, pants: 0x2b2b44, hair: 'buzz', hairColor: 0x1a1210, hat: null, height: 1.7, shoes: 0xc68642,
});
const IDLE_BELOW = 0.15; // m/s
const RUN_ABOVE = 2.0;   // m/s

export class Walker {
  /**
   * @param {{spawn:{x:number,z:number,yaw:number}, collider:{isWalkable(x:number,z:number):boolean}, outfit?:object}} opts
   */
  constructor({ spawn, collider, outfit = PLAYER_OUTFIT }) {
    this.collider = collider;
    this.state = createWalkState(spawn);
    this.humanoid = createHumanoid(outfit);
    this.skin = bakeSkinnedHumanoid(this.humanoid);
    this.group = this.humanoid.group;
    this.group.name = 'pemain-jalan';
    this._phase = 0;
    this.#place();
  }

  get speed() { return walkSpeedOf(this.state); }

  /** @param {number} dt @param {{forward:number, strafe:number, run:boolean, yaw:number}} intent */
  update(dt, intent) {
    this.state = stepWalk(this.state, intent, dt, this.collider);
    const v = this.speed;
    this._phase += (Number.isFinite(dt) ? dt : 0) * Math.max(0.6, v / 1.35);
    if (v < IDLE_BELOW) animateIdle(this.humanoid, this._phase);
    else if (v < RUN_ABOVE) animateWalk(this.humanoid, this._phase);
    else animateRun(this.humanoid, this._phase, v);
    this.skin.sync();
    this.#place();
  }

  #place() {
    this.group.position.set(this.state.x, 0, this.state.z);
    this.group.rotation.y = this.state.yaw;
  }

  /** Disembunyikan di orang pertama (kamera tidak di dalam kepala). */
  setVisible(visible) { this.group.visible = Boolean(visible); }

  dispose() {
    this.skin.dispose();
    this.group.removeFromParent();
  }
}
```

- [ ] **Step 2: Lint & commit**

Run: `npm run lint` → 0 galat.
```
git add src/entities/Walker.js
```
```
git commit -m "feat(entities): Walker pemain jalan kaki (Humanoid skinned + walkPhysics, animasi diam/jalan/lari)"
```

---

## Task 8: `InteriorCameraRig` (FP 1,55 m, V → orang ketiga 1,6 m + uji plafon, foto bebas, intip) — tes jsdom

**Files:**
- Create: `src/core/InteriorCameraRig.js`, `tests/interiorCameraRig.test.js`

- [ ] **Step 1: Tes gagal `tests/interiorCameraRig.test.js`** (pola `tests/cameraRigPlayer.test.js`)

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { InteriorCameraRig, fitUnderCeiling, INTERIOR_CAM } from '../src/core/InteriorCameraRig.js';

const make = (opts = {}) => new InteriorCameraRig(new THREE.PerspectiveCamera(70, 1, 0.05, 80), document.createElement('canvas'), { ceiling: 3.2, ...opts });
const walker = (x = 0, z = 0) => ({ x, z, yaw: 0 });
const run = (rig, w, seconds, dt = 1 / 60, move = null) => {
  for (let t = 0; t < seconds; t += dt) rig.update(w, dt, move);
};
const dir = (rig) => rig.camera.getWorldDirection(new THREE.Vector3());
const BOUNDS = { min: [-2, 0.2, -5], max: [2, 3.05, 2.9] };

describe('InteriorCameraRig orang pertama', () => {
  it('mata 1,55 m dan menghadap yaw rig', () => {
    const rig = make();
    rig.update(walker(1, 2), 1 / 60);
    expect(rig.camera.position.y).toBeCloseTo(1.55, 6);
    expect(dir(rig).z).toBeGreaterThan(0.99);
    rig.yaw = Math.PI / 2;
    rig.update(walker(), 1 / 60);
    expect(dir(rig).x).toBeGreaterThan(0.99);
    expect(rig.firstPersonView).toBe(true);
  });

  it('mouse: pitch dibatasi, NaN diabaikan, yaw dinormalkan', () => {
    const rig = make();
    rig.lookBy(0, 1e6);
    expect(rig.pitch).toBeLessThan(Math.PI / 2);
    const before = rig.yaw;
    rig.lookBy(Number.NaN, 0);
    expect(rig.yaw).toBe(before);
    for (let i = 0; i < 500; i += 1) rig.lookBy(-200, 0);
    expect(Math.abs(rig.yaw)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});

describe('InteriorCameraRig orang ketiga', () => {
  it('V → lengan 1,6 m dari titik pandang 1,45 m', () => {
    const rig = make();
    expect(rig.toggleMode()).toBe('third');
    run(rig, walker(), 1);
    const d = rig.camera.position.distanceTo(new THREE.Vector3(0, INTERIOR_CAM.lookHeight, 0));
    expect(d).toBeGreaterThan(1.55);
    expect(d).toBeLessThan(1.65);
    expect(rig.firstPersonView).toBe(false);
  });

  it('uji langit-langit: plafon 2,2 m → kamera di bawah plafon − margin walau menengadah maksimum', () => {
    const rig = make({ ceiling: 2.2 });
    rig.toggleMode();
    rig.lookBy(0, 5000);
    run(rig, walker(), 1);
    expect(rig.camera.position.y).toBeLessThanOrEqual(2.2 - INTERIOR_CAM.ceilingMargin + 1e-6);
  });

  it('dinding di belakang: kamera ditarik mendekat, tidak menembus', () => {
    const rig = make({ isCameraClear: (x, z) => z > -0.5 });
    rig.toggleMode();
    run(rig, walker(), 1);
    expect(rig.camera.position.z).toBeGreaterThan(-0.5);
  });
});

describe('fitUnderCeiling', () => {
  it('menskalakan offset seragam agar di bawah plafon; offset menurun tidak diubah', () => {
    const o = fitUnderCeiling({ x: 0, y: 1.45, z: 0 }, { x: 0, y: 1, z: -1 }, 2.2, 0.12);
    expect(1.45 + o.y).toBeCloseTo(2.08, 9);
    expect(o.z).toBeCloseTo(-0.63, 9);
    expect(fitUnderCeiling({ x: 0, y: 1.45, z: 0 }, { x: 0, y: -0.3, z: -1 }, 2.2).scale).toBe(1);
  });
});

describe('mode foto & intip jendela', () => {
  it('preset: posisi & arah preset, FOV preset; keluar memulihkan FOV dasar', () => {
    const rig = make({ bounds: BOUNDS });
    rig.setPhoto(true);
    rig.applyPreset({ position: [1, 0.6, 2.3], target: [-0.5, 0.55, 0.5], fov: 62 });
    rig.update(walker(), 1 / 60);
    expect(rig.camera.position.toArray()).toEqual([1, 0.6, 2.3].map((v) => expect.closeTo(v, 6)));
    expect(dir(rig).dot(new THREE.Vector3(-1.5, -0.05, -1.8).normalize())).toBeGreaterThan(0.999);
    expect(rig.camera.fov).toBe(62);
    rig.setPhoto(false);
    expect(rig.camera.fov).toBe(70);
  });

  it('kamera bebas tidak keluar batas', () => {
    const rig = make({ bounds: BOUNDS });
    rig.setPhoto(true);
    rig.applyPreset({ position: [0, 1.5, 2.5], target: [0, 1.5, 3.5] });
    run(rig, walker(), 3, 1 / 30, { forward: 1, strafe: 0, up: 1, run: true });
    expect(rig.camera.position.z).toBeLessThanOrEqual(2.9 + 1e-9);
    expect(rig.camera.position.y).toBeLessThanOrEqual(3.05 + 1e-9);
  });

  it('intip jendela selesai sendiri setelah durasinya; FOV dasar pulih', () => {
    const rig = make();
    rig.update(walker(), 1 / 60);
    rig.peek({ position: [-0.9, 1.5, -2.86], target: [3.5, 1.15, -5.6], fov: 60 }, 1);
    expect(rig.busy).toBe(true);
    expect(rig.firstPersonView).toBe(false);
    run(rig, walker(), 1.2);
    expect(rig.busy).toBe(false);
    expect(rig.camera.fov).toBe(70);
  });

  it('dispose melepas listener tanpa galat', () => {
    expect(() => make().dispose()).not.toThrow();
  });
});
```

- [ ] **Step 2: Jalankan → FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/interiorCameraRig.test.js`

- [ ] **Step 3: Implementasi `src/core/InteriorCameraRig.js`**

```js
/**
 * Kamera interior (spec §8.2): orang pertama default (mata 1,55 m), V → orang ketiga (lengan 1,6 m) dengan uji
 * langit-langit (offset diskalakan agar kamera tetap di bawah plafon − margin) dan uji dinding (pullInOffset
 * terhadap isCameraClear). Mode foto: kamera bebas (W/A/S/D maju-geser mengikuti arah pandang, Q/E turun-naik,
 * Shift cepat) dibatasi kotak `bounds`, preset {position, target, fov}. Intip: kamera ke pose tertentu (jendela)
 * selama beberapa detik lalu kembali. Mouse (pointer lock pada `dom`), stick kanan gamepad, dan geser sentuh
 * memanggil lookBy (dirutekan composition root). Konvensi yaw = CameraRig/sepeda.
 */
import * as THREE from 'three';
import { firstPersonDirection, pullInOffset, thirdPersonOffset, wrapAngle } from './cameraMath.js';

const MOUSE_SENSITIVITY = 0.0022;
const PITCH_LIMIT = Math.PI / 2.3;

export const INTERIOR_CAM = Object.freeze({
  eye: 1.55, eyeForward: 0.1, lookHeight: 1.45, ceilingMargin: 0.12, minHeight: 0.3, minScale: 0.15,
  followSmoothing: 10, photoSpeed: 1.2, photoRunSpeed: 3, peekBlend: 4,
});
/** Orbit orang ketiga di ruang sempit (format THIRD di cameraMath). */
export const INTERIOR_THIRD = Object.freeze({
  radius: 1.6, lookHeight: INTERIOR_CAM.lookHeight, minHeight: INTERIOR_CAM.minHeight,
  baseElevation: 0.25, minElevation: -0.6, maxElevation: 1.15,
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Skala seragam offset kamera agar `target.y + offset.y ≤ ceilingY − margin`. Offset yang tidak naik melewati
 * batas dikembalikan apa adanya (scale 1). Murni.
 */
export function fitUnderCeiling(target, offset, ceilingY, margin = INTERIOR_CAM.ceilingMargin) {
  const limit = ceilingY - margin - target.y;
  if (!(offset.y > limit)) return { x: offset.x, y: offset.y, z: offset.z, scale: 1 };
  const s = limit <= 0 ? 0 : limit / offset.y;
  return { x: offset.x * s, y: offset.y * s, z: offset.z * s, scale: s };
}

export class InteriorCameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera kamera interior
   * @param {HTMLElement|null} dom elemen pointer lock (kanvas renderer)
   * @param {{ceiling?:number, isCameraClear?:((x:number,z:number)=>boolean)|null,
   *   bounds?:{min:number[],max:number[]}|null, baseFov?:number, sensitivity?:number}} [opts]
   */
  constructor(camera, dom, { ceiling = 3.2, isCameraClear = null, bounds = null, baseFov = camera.fov, sensitivity = 1 } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.ceiling = ceiling;
    this.isCameraClear = typeof isCameraClear === 'function' ? isCameraClear : null;
    this.bounds = bounds ?? { min: [-Infinity, 0.2, -Infinity], max: [Infinity, ceiling - 0.15, Infinity] };
    this.baseFov = baseFov;
    this.sensitivity = sensitivity;
    this.mode = 'first';
    this.yaw = 0;
    this.pitch = 0;
    this.photo = false;
    this.peekState = null;
    this._snap = true;
    this._target = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._photoPos = new THREE.Vector3();
    this._peekLook = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._abort = new AbortController();
    if (dom && typeof document !== 'undefined') {
      document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === dom) this.lookBy(e.movementX, e.movementY);
      }, { signal: this._abort.signal });
    }
  }

  /** Geser arah pandang (satuan piksel mouse); `scale` > 1 untuk sentuh. */
  lookBy(dx, dy, scale = 1) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const k = MOUSE_SENSITIVITY * this.sensitivity * scale;
    this.yaw = wrapAngle(this.yaw - dx * k);
    this.pitch = clamp(this.pitch + dy * k, -PITCH_LIMIT, PITCH_LIMIT);
  }

  toggleMode() {
    this.mode = this.mode === 'first' ? 'third' : 'first';
    this._snap = true;
    return this.mode;
  }

  /** Orang pertama sedang dipakai (bukan foto/intip): avatar disembunyikan. */
  get firstPersonView() { return this.mode === 'first' && !this.photo && !this.peekState; }

  /** Sedang mengintip (input jalan diabaikan). */
  get busy() { return Boolean(this.peekState); }

  /** Arah pandang satuan dari yaw/pitch (dipakai pemilih barang interaktif). */
  viewDirection() { return firstPersonDirection(this.yaw, this.pitch); }

  #setFov(fov) {
    if (this.camera.fov === fov) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /** Masuk/keluar mode foto (kamera bebas mulai dari posisi kamera sekarang). */
  setPhoto(on) {
    const next = Boolean(on);
    if (next === this.photo) return;
    this.photo = next;
    this.peekState = null;
    if (next) {
      this._photoPos.copy(this.camera.position);
    } else {
      this.#setFov(this.baseFov);
      this._snap = true;
    }
  }

  /** @param {{position:number[], target:number[], fov?:number}} pose */
  applyPreset(pose) {
    const [px, py, pz] = pose.position;
    const [tx, ty, tz] = pose.target;
    this._photoPos.set(px, py, pz);
    this.#clampPhoto();
    const dx = tx - px;
    const dy = ty - py;
    const dz = tz - pz;
    const len = Math.hypot(dx, dy, dz) || 1;
    this.yaw = Math.atan2(dx, dz);
    this.pitch = clamp(-Math.asin(clamp(dy / len, -1, 1)), -PITCH_LIMIT, PITCH_LIMIT);
    if (Number.isFinite(pose.fov)) this.#setFov(pose.fov);
  }

  /** Kamera ke pose selama `seconds` detik (intip jendela), lalu kembali sendiri. */
  peek(pose, seconds = 4) {
    const d = firstPersonDirection(this.yaw, this.pitch);
    this._peekLook.copy(this.camera.position).add(this._tmp.set(d.x, d.y, d.z));
    this.peekState = { pose, remaining: Math.max(0.5, seconds) };
  }

  cancelPeek() {
    if (!this.peekState) return;
    this.peekState = null;
    this._snap = true;
    this.#setFov(this.baseFov);
  }

  /**
   * @param {{x:number, z:number}} walker posisi pemain
   * @param {number} dt
   * @param {{forward:number, strafe:number, up:number, run:boolean}|null} [move] gerak kamera bebas (mode foto)
   */
  update(walker, dt, move = null) {
    if (!walker || !Number.isFinite(walker.x) || !Number.isFinite(walker.z)) return;
    const d = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0;
    if (this.photo) this.#updatePhoto(d, move);
    else if (this.peekState) this.#updatePeek(d);
    else if (this.mode === 'first') this.#updateFirst(walker);
    else this.#updateThird(walker, d);
  }

  #updateFirst(w) {
    const cam = this.camera.position;
    cam.set(w.x + Math.sin(this.yaw) * INTERIOR_CAM.eyeForward, INTERIOR_CAM.eye, w.z + Math.cos(this.yaw) * INTERIOR_CAM.eyeForward);
    const dir = firstPersonDirection(this.yaw, this.pitch);
    this._target.set(cam.x + dir.x, cam.y + dir.y, cam.z + dir.z);
    this.camera.lookAt(this._target);
    this._snap = false;
  }

  #safeOffset(target, offset) {
    const under = fitUnderCeiling(target, offset, this.ceiling);
    return this.isCameraClear ? pullInOffset(target, under, this.isCameraClear, INTERIOR_CAM.minScale) : under;
  }

  #updateThird(w, dt) {
    const target = this._target.set(w.x, INTERIOR_THIRD.lookHeight, w.z);
    const off = this.#safeOffset(target, thirdPersonOffset(this.yaw, this.pitch, INTERIOR_THIRD));
    this._desired.set(target.x + off.x, Math.max(INTERIOR_CAM.minHeight, target.y + off.y), target.z + off.z);
    const cam = this.camera.position;
    if (this._snap) {
      cam.copy(this._desired);
      this._snap = false;
    } else {
      cam.lerp(this._desired, 1 - Math.exp(-INTERIOR_CAM.followSmoothing * dt));
    }
    // posisi hasil smoothing bisa menyilang sudut dinding/plafon: periksa ulang terhadap titik pandang
    const again = this.#safeOffset(target, { x: cam.x - target.x, y: cam.y - target.y, z: cam.z - target.z });
    cam.set(target.x + again.x, Math.max(INTERIOR_CAM.minHeight, target.y + again.y), target.z + again.z);
    this.camera.lookAt(target);
  }

  #clampPhoto() {
    const { min, max } = this.bounds;
    const p = this._photoPos;
    p.set(clamp(p.x, min[0], max[0]), clamp(p.y, min[1], max[1]), clamp(p.z, min[2], max[2]));
  }

  #updatePhoto(dt, move) {
    const dir = firstPersonDirection(this.yaw, this.pitch);
    if (move) {
      const s = (move.run ? INTERIOR_CAM.photoRunSpeed : INTERIOR_CAM.photoSpeed) * dt;
      const f = clamp(Number(move.forward) || 0, -1, 1);
      const r = clamp(Number(move.strafe) || 0, -1, 1);
      const u = clamp(Number(move.up) || 0, -1, 1);
      this._photoPos.x += (dir.x * f - Math.cos(this.yaw) * r) * s;
      this._photoPos.y += (dir.y * f + u) * s;
      this._photoPos.z += (dir.z * f + Math.sin(this.yaw) * r) * s;
      this.#clampPhoto();
    }
    this.camera.position.copy(this._photoPos);
    this._target.set(this._photoPos.x + dir.x, this._photoPos.y + dir.y, this._photoPos.z + dir.z);
    this.camera.lookAt(this._target);
  }

  #updatePeek(dt) {
    const p = this.peekState;
    p.remaining -= dt;
    const k = 1 - Math.exp(-INTERIOR_CAM.peekBlend * dt);
    const [px, py, pz] = p.pose.position;
    const [tx, ty, tz] = p.pose.target;
    this.camera.position.lerp(this._tmp.set(px, py, pz), k);
    this._peekLook.lerp(this._tmp.set(tx, ty, tz), k);
    this.camera.lookAt(this._peekLook);
    if (Number.isFinite(p.pose.fov)) this.#setFov(p.pose.fov);
    if (p.remaining <= 0) this.cancelPeek();
  }

  dispose() { this._abort.abort(); }
}
```

- [ ] **Step 4: Jalankan → PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/interiorCameraRig.test.js`
Expected: PASS. (`applyPreset` menghitung yaw/pitch dari arah target dan `#updatePhoto` memakai
`firstPersonDirection` yang sama → arah konsisten.)

- [ ] **Step 5: Commit**

```
git add src/core/InteriorCameraRig.js tests/interiorCameraRig.test.js
```
```
git commit -m "feat(core): InteriorCameraRig (orang pertama 1,55 m, orang ketiga 1,6 m dengan uji plafon & dinding, kamera foto bebas, intip jendela)"
```

---

## Task 9: `InfoCard` (DOM createElement, tanpa innerHTML)

**Files:**
- Create: `src/ui/InfoCard.js`, `src/ui/infoCard.css`

- [ ] **Step 1: `src/ui/InfoCard.js`**

```js
/**
 * Kartu info barang interaktif interior (judul + teks multi-baris). DOM dibangun dengan createElement +
 * textContent — TANPA innerHTML (hook keamanan repo menolaknya; teks berasal dari data yang bisa diubah user).
 * Baris berawalan "• " tampil sebagai butir daftar. Tutup: E / Esc / Spasi (ditangani portal) atau tombol.
 */
import './infoCard.css';

export class InfoCard {
  /** @param {HTMLElement} [root] */
  constructor(root = document.body) {
    this.el = document.createElement('div');
    this.el.id = 'info-card';
    this.el.className = 'hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-live', 'polite');
    this.titleEl = document.createElement('h2');
    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'info-card-body';
    const hint = document.createElement('p');
    hint.className = 'info-card-hint';
    hint.textContent = 'E / Esc untuk menutup';
    this.closeBtn = document.createElement('button');
    this.closeBtn.type = 'button';
    this.closeBtn.className = 'info-card-close';
    this.closeBtn.textContent = 'Tutup';
    this.closeBtn.addEventListener('click', () => this.hide());
    this.el.append(this.titleEl, this.bodyEl, hint, this.closeBtn);
    root.append(this.el);
  }

  get open() { return !this.el.classList.contains('hidden'); }

  /** @param {{title?:string, text?:string}} content */
  show({ title = '', text = '' } = {}) {
    this.titleEl.textContent = String(title);
    const lines = String(text).split('\n');
    this.bodyEl.replaceChildren(...lines.map((line) => {
      const p = document.createElement('p');
      if (line.startsWith('• ')) {
        p.className = 'info-card-item';
        p.textContent = line.slice(2);
      } else {
        p.textContent = line;
      }
      return p;
    }));
    this.el.classList.remove('hidden');
  }

  hide() { this.el.classList.add('hidden'); }

  dispose() { this.el.remove(); }
}
```

- [ ] **Step 2: `src/ui/infoCard.css`**

```css
/* Kartu info interior (InfoCard) + penyesuaian HUD selama di dalam interior (body.is-interior). */
#info-card {
  position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); width: min(520px, 92vw); max-height: 52vh;
  overflow: auto; padding: 16px 20px 12px; border-radius: 14px; background: rgba(10, 18, 28, 0.94);
  color: var(--hud-fg, #f2f2f2); z-index: 12; pointer-events: auto; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  font-size: 14px; line-height: 1.55;
}
#info-card.hidden { display: none; }
#info-card h2 { margin: 0 0 6px; font-size: 17px; color: var(--hud-accent, #f2b705); }
#info-card .info-card-body p { margin: 0 0 4px; }
#info-card .info-card-item { position: relative; padding-left: 14px; }
#info-card .info-card-item::before { content: '•'; position: absolute; left: 2px; color: var(--hud-accent, #f2b705); }
#info-card .info-card-hint { margin: 8px 0 0; font-size: 12px; color: var(--hud-muted, #9aa4ad); }
#info-card .info-card-close {
  margin-top: 8px; padding: 6px 14px; border: 0; border-radius: 8px; background: var(--hud-accent, #f2b705);
  color: #1a1a1a; font: inherit; font-weight: 600; cursor: pointer;
}
body.is-photo #info-card { display: none; }
body.is-interior #hud-speed, body.is-interior #hud-score { display: none; }
```

- [ ] **Step 3: Lint & commit**

Run: `npm run lint` → 0 galat.
```
git add src/ui/InfoCard.js src/ui/infoCard.css
```
```
git commit -m "feat(ui): InfoCard kartu info interior (createElement + textContent, tanpa innerHTML)"
```

---

## Task 10: `interiorPortal` penuh (TDD: mesin state, gagal build, siklus 3×)

**Files:**
- Modify (ganti isi stub M4): `src/app/interiorPortal.js`, `tests/unri/interiorPortal.test.js` (tes stub M4 diganti;
  blok `nearestPortal` dipertahankan)
- Modify: `src/app/portalTrigger.js` (M4: teruskan pintu), `src/app/keymap.js`, `src/main.js` (fungsi `setupPortal`)
- Create: `tests/keymapPortal.test.js`
- Delete: `src/app/appView.js`, `tests/unri/appView.test.js` (M4; digantikan `App.setView`)

Portal M4 menukar runner `app.systems` (`appStage`) sehingga jam & cuaca ikut berhenti; serah terima M4 meminta M5
menggantinya dengan gerbang sistem. API baru memakai App langsung (`setView`, `setSystemGate`, `addSystem`), fade
lewat port `fader.fade()` M4 (`src/ui/FadeOverlay.js`), pemicu pintu tetap `portalTrigger` M4. `createStubInterior`
(M4) dipertahankan di berkas sampai Task 20 agar aplikasi tetap bisa dibangun di setiap commit.

- [ ] **Step 1: Ganti isi `tests/unri/interiorPortal.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createResourceScope } from '../../src/engine/ResourceScope.js';
import { defineInterior } from '../../src/interiors/Interior.js';
import {
  createInteriorPortal, isSystemActiveInside, walkIntent, KEEP_INSIDE, PORTAL_STATES, LOCKED_TOAST,
} from '../../src/app/interiorPortal.js';
import { nearestPortal } from '../../src/app/portalTrigger.js';
import { PORTAL_DOORS } from '../../src/regions/unri-lembaga/portalDoors.js';
import { LEMBAGA_PLACEMENT } from '../../src/regions/unri-lembaga/placement.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
const identity = { toWorld: (x, z) => ({ x, z }), yawToWorld: (y) => y };

function fakeApp() {
  const systems = new Map();
  return {
    systems,
    aoEnabled: false,
    renderer: { domElement: null },
    addSystem: vi.fn((s) => { systems.set(s.id, s); return s; }),
    removeSystem: vi.fn((id) => { systems.get(id)?.dispose?.(); return systems.delete(id); }),
    setView: vi.fn(),
    setSystemGate: vi.fn(),
    setAO: vi.fn(function setAO(on) { this.aoEnabled = Boolean(on); }),
    setBaseExposure: vi.fn(),
  };
}

function fakeInput() {
  const pressed = new Set();
  const down = new Set();
  return {
    pressed, down,
    press: (c) => pressed.add(c),
    isDown: (c) => down.has(c),
    consumePress: (c) => pressed.delete(c),
    endFrame: () => pressed.clear(),
  };
}

const fakeHud = () => ({ toast: vi.fn(), setPrompt: vi.fn(), setTime: vi.fn(), tickFps: vi.fn(), setCameraMode: vi.fn() });

const fakeFactories = () => ({
  rig: vi.fn(() => ({
    mode: 'first', yaw: 0, photo: false, busy: false, firstPersonView: true,
    lookBy: vi.fn(), toggleMode: vi.fn(() => 'third'), setPhoto: vi.fn(function setPhoto(on) { this.photo = on; }),
    applyPreset: vi.fn(), cancelPeek: vi.fn(), viewDirection: () => ({ x: 0, y: 0, z: 1 }), update: vi.fn(), dispose: vi.fn(),
  })),
  walker: vi.fn(() => ({ group: new THREE.Group(), state: { x: 0, z: 0, yaw: 0 }, update: vi.fn(), setVisible: vi.fn(), dispose: vi.fn() })),
  card: vi.fn(() => ({
    open: false, show: vi.fn(function show() { this.open = true; }), hide: vi.fn(function hide() { this.open = false; }), dispose: vi.fn(),
  })),
});

function makeInterior(build) {
  const disposed = vi.fn();
  const sysDispose = vi.fn();
  const items = [{
    id: 'kipas', label: 'Kipas', pos: { x: 0, y: 1, z: 1 }, radius: 2, prompt: 'Nyalakan kipas',
    onInteract: vi.fn(() => ({ title: 'Kipas', text: 'Menyala' })),
  }];
  const def = defineInterior({
    id: 'sekre', label: 'Sekre', size: { w: 4.2, d: 6, h: 3.2 }, spawn: { x: 1.5, z: -2.4, yaw: 0 },
    exitTo: { region: 'unri-lembaga', x: 10, z: 5, yaw: 0 },
    build: build ?? (async () => ({
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), colliders: { isWalkable: () => true },
      interactables: items,
      photoPresets: [{ id: 'atas', label: 'Atas', pose: { position: [0, 3, 0], target: [0, 0, 0.5] } }],
      systems: [{ id: 'interior.sekre.uji', phase: 'sim', update() {}, dispose: sysDispose }],
      dispose: disposed,
    })),
  });
  return { def, disposed, sysDispose, items };
}

function setup({ build } = {}) {
  const app = fakeApp();
  const input = fakeInput();
  const hud = fakeHud();
  const { def, disposed, sysDispose, items } = makeInterior(build);
  const scopes = [];
  const states = [];
  const bike = { state: { x: 10.5, z: 5.2, yaw: 1 }, teleport: vi.fn() };
  const store = { get: vi.fn((k) => ({ 'weather.sound': true, 'graphics.ao': false, 'camera.fov': 70 })[k]) };
  const weather = { setSoundEnabled: vi.fn(), isRaining: false, intensity: 0, weatherName: 'Cerah' };
  const flags = { photo: false, blocking: false };
  const regionManager = {
    active: () => [{
      def: { id: 'unri-lembaga' }, frame: identity,
      region: { portals: [{ id: 'sekre-pemain', interiorId: 'sekre', pos: { lx: 10, lz: 5 }, yaw: 0, radius: 1.6, prompt: 'Masuk sekre' }] },
    }],
    frameOf: () => identity,
  };
  const portal = createInteriorPortal({
    app, input, hud, interiors: new Map([[def.id, def]]), regionManager, store, weather, bike,
    time: { hour: 10, presetName: 'pagi' },
    fader: { fade: vi.fn(async () => {}) },
    createScope: (name) => { const s = createResourceScope(name); scopes.push(s); return s; },
    factories: fakeFactories(),
    onState: (s) => states.push(s),
    isPhotoUi: () => flags.photo,
    isUiBlocking: () => flags.blocking,
    logger: { error: vi.fn() },
  });
  return { app, input, hud, portal, scopes, states, bike, weather, flags, def, disposed, sysDispose, items };
}

describe('aturan sistem di dalam interior', () => {
  it('jam, cuaca, input, scheduler, dan sistem interior.* tetap jalan; sisanya dijeda', () => {
    for (const id of KEEP_INSIDE) expect(isSystemActiveInside(id)).toBe(true);
    expect(isSystemActiveInside('interior.walk')).toBe(true);
    for (const id of ['cameraRig', 'lighting', 'entities.0', 'hud', 'minimap', 'story', 'updatable-3']) {
      expect(isSystemActiveInside(id)).toBe(false);
    }
    expect(isSystemActiveInside(undefined)).toBe(false);
  });

  it('penanda kompatibilitas M4', () => {
    expect(PORTAL_STATES).toEqual({ OUTSIDE: 'outside', FADING_IN: 'fadingIn', INSIDE: 'inside', FADING_OUT: 'fadingOut' });
    expect(LOCKED_TOAST).toBe('Pintu terkunci');
  });

  it('walkIntent: W/S maju-mundur, A/D geser, Shift lari', () => {
    const input = fakeInput();
    for (const c of ['KeyW', 'KeyD', 'ShiftLeft']) input.down.add(c);
    expect(walkIntent(input, 0.5)).toEqual({ forward: 1, strafe: 1, run: true, yaw: 0.5 });
  });
});

describe('createInteriorPortal: mesin state', () => {
  it('mulai di luar; enter → fadingIn → inside; view, gerbang, sistem, AO, suara hujan eksterior', async () => {
    const t = setup();
    expect(t.portal.state).toBe('outside');
    expect(await t.portal.enter('sekre')).toBe(true);
    expect(t.states).toEqual(['fadingIn', 'inside']);
    expect(t.portal.inside).toBe(true);
    expect(t.app.setView.mock.calls.at(-1)[0].scene.isScene).toBe(true);
    expect(t.app.setSystemGate).toHaveBeenLastCalledWith(isSystemActiveInside);
    expect([...t.app.systems.keys()]).toEqual(expect.arrayContaining([
      'interior.sekre.uji', 'interior.keys', 'interior.walk', 'interior.interact', 'interior.camera', 'interior.hud',
    ]));
    expect(t.app.setAO).toHaveBeenCalledWith(true);
    expect(t.weather.setSoundEnabled).toHaveBeenLastCalledWith(false);
  });

  it('exit → fadingOut → outside; semua dilepas & dipulihkan; sepeda dekat pintu tidak dipindah', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    expect(await t.portal.exit()).toBe(true);
    expect(t.states).toEqual(['fadingIn', 'inside', 'fadingOut', 'outside']);
    expect(t.app.systems.size).toBe(0);
    expect(t.sysDispose).toHaveBeenCalledTimes(1);
    expect(t.disposed).toHaveBeenCalledTimes(1);
    expect(t.app.setView).toHaveBeenLastCalledWith(null);
    expect(t.app.setSystemGate).toHaveBeenLastCalledWith(null);
    expect(t.app.setAO).toHaveBeenLastCalledWith(false);
    expect(t.weather.setSoundEnabled).toHaveBeenLastCalledWith(true);
    expect(t.scopes[0].disposed).toBe(true);
    expect(t.bike.teleport).not.toHaveBeenCalled();
  });

  it('sepeda jauh dari pintu (masuk lewat dev/E2E) dipindah ke exitTo', async () => {
    const t = setup();
    t.bike.state = { x: 500, z: -300, yaw: 0 };
    await t.portal.enter('sekre');
    await t.portal.exit();
    expect(t.bike.teleport).toHaveBeenCalledWith(10, 5, 0);
  });

  it('build melempar: tetap di luar, toast "Pintu terkunci", scope dilepas, view & gerbang tidak disentuh', async () => {
    const t = setup({ build: async () => { throw new Error('rusak'); } });
    expect(await t.portal.enter('sekre')).toBe(false);
    expect(t.states).toEqual(['fadingIn', 'outside']);
    expect(t.hud.toast).toHaveBeenCalledWith('Pintu terkunci', false);
    expect(t.scopes[0].disposed).toBe(true);
    expect(t.app.setView).not.toHaveBeenCalled();
    expect(t.app.setSystemGate).not.toHaveBeenCalled();
  });

  it('hasil build tidak valid: hasil & scope dilepas, toast, tidak ada sistem terpasang', async () => {
    const dispose = vi.fn();
    const t = setup({ build: async () => ({ scene: new THREE.Scene(), dispose }) });
    expect(await t.portal.enter('sekre')).toBe(false);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(t.scopes[0].disposed).toBe(true);
    expect(t.hud.toast).toHaveBeenCalledWith('Pintu terkunci', false);
    expect(t.app.systems.size).toBe(0);
  });

  it('enter ganda saat fade & exit di luar ditolak; interior tak dikenal → toast', async () => {
    const t = setup();
    const first = t.portal.enter('sekre');
    expect(await t.portal.enter('sekre')).toBe(false);
    await first;
    await t.portal.exit();
    expect(await t.portal.exit()).toBe(false);
    expect(await t.portal.enter('gudang')).toBe(false);
    expect(t.hud.toast).toHaveBeenCalledWith('Pintu terkunci', false);
  });

  it('siklus masuk/keluar 3×: tiap scope dilepas, tidak ada sistem tersisa, add = remove', async () => {
    const t = setup();
    for (let i = 0; i < 3; i += 1) {
      await t.portal.enter('sekre');
      await t.portal.exit();
    }
    expect(t.scopes).toHaveLength(3);
    expect(t.scopes.every((s) => s.disposed)).toBe(true);
    expect(t.app.systems.size).toBe(0);
    expect(t.app.addSystem.mock.calls.length).toBe(t.app.removeSystem.mock.calls.length);
  });

  it('dispose saat di dalam melepas interior tanpa fade', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    t.portal.dispose();
    expect(t.disposed).toHaveBeenCalledTimes(1);
    expect(t.scopes[0].disposed).toBe(true);
    expect(t.portal.state).toBe('outside');
  });
});

describe('createInteriorPortal: pintu, interaksi, tombol', () => {
  it('doors() membaca portals region aktif dalam koordinat dunia (dev/E2E)', () => {
    const t = setup();
    const [d] = t.portal.doors();
    expect(d).toMatchObject({ id: 'sekre-pemain', interiorId: 'sekre', regionId: 'unri-lembaga', world: { x: 10, z: 5 }, worldYaw: 0 });
  });

  it('enter dengan pintu (portalTrigger M4) meneruskan door ke ctx build', async () => {
    let got = null;
    const t = setup({
      build: async (ctx) => {
        got = ctx;
        return {
          scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), colliders: { isWalkable: () => true },
          interactables: [], photoPresets: [], systems: [], dispose() {},
        };
      },
    });
    expect(await t.portal.enter('sekre', { door: { id: 'sekre-pemain', worldYaw: 0.3 } })).toBe(true);
    expect(got.door.worldYaw).toBe(0.3);
    expect(typeof got.exit).toBe('function');
    expect(got.scope).toBe(t.scopes[0]);
  });

  it('E pada barang yang dilihat: onInteract + kartu; E lagi menutup kartu', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    t.app.systems.get('interior.interact').update(0.016, {});
    expect(t.hud.setPrompt).toHaveBeenLastCalledWith('Tekan E — Nyalakan kipas');
    t.input.press('KeyE');
    t.app.systems.get('interior.keys').update(0.016, {});
    expect(t.items[0].onInteract).toHaveBeenCalledTimes(1);
    const card = t.portal.current.card;
    expect(card.show).toHaveBeenCalledWith({ title: 'Kipas', text: 'Menyala' });
    t.input.press('KeyE');
    t.app.systems.get('interior.keys').update(0.016, {});
    expect(card.open).toBe(false);
  });

  it('Esc keluar, kecuali Esc yang baru menutup mode foto atau panel', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    const keys = t.app.systems.get('interior.keys');
    t.flags.photo = true;
    keys.update(0.016, {});
    t.flags.photo = false;
    t.input.press('Escape');
    keys.update(0.016, {});
    await flush();
    expect(t.portal.inside).toBe(true);
    t.flags.blocking = true;
    keys.update(0.016, {});
    t.flags.blocking = false;
    t.input.press('Escape');
    keys.update(0.016, {});
    await flush();
    expect(t.portal.inside).toBe(true);
    keys.update(0.016, {});
    t.input.press('Escape');
    keys.update(0.016, {});
    await flush();
    await flush();
    expect(t.portal.state).toBe('outside');
  });

  it('V mengganti mode kamera; mode foto: tombol 1–4 memilih preset', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    const keys = t.app.systems.get('interior.keys');
    const rig = t.portal.current.rig;
    t.input.press('KeyV');
    keys.update(0.016, {});
    expect(rig.toggleMode).toHaveBeenCalledTimes(1);
    t.flags.photo = true;
    t.input.press('Digit1');
    keys.update(0.016, {});
    expect(rig.setPhoto).toHaveBeenCalledWith(true);
    expect(rig.applyPreset).toHaveBeenCalledWith({ position: [0, 3, 0], target: [0, 0, 0.5] });
  });

  it('lookBy diteruskan ke rig hanya saat di dalam', async () => {
    const t = setup();
    expect(() => t.portal.lookBy(1, 2)).not.toThrow();
    await t.portal.enter('sekre');
    t.portal.lookBy(3, 4, 1.8);
    expect(t.portal.current.rig.lookBy).toHaveBeenCalledWith(3, 4, 1.8);
  });
});

// Dipertahankan dari tes M4 (pemicu pintu tetap milik portalTrigger) + worldYaw baru (Task 20).
describe('nearestPortal', () => {
  const active = [{ def: { id: 'unri-lembaga', placement: LEMBAGA_PLACEMENT }, region: { portals: PORTAL_DOORS } }];
  const door = PORTAL_DOORS[0];
  const wx = LEMBAGA_PLACEMENT.x + door.pos.lx;
  const wz = LEMBAGA_PLACEMENT.z + door.pos.lz;

  it('dalam radius → pintu, region, dan yaw dunia; di luar radius → null', () => {
    expect(nearestPortal(active, wx + 1.0, wz)).toMatchObject({ regionId: 'unri-lembaga', door, worldYaw: LEMBAGA_PLACEMENT.yaw + door.yaw });
    expect(nearestPortal(active, wx + 2.0, wz)).toBeNull();
  });

  it('region tanpa portals diabaikan', () => {
    expect(nearestPortal([{ def: { id: 'stadion', placement: { x: 0, z: 0, yaw: 0 } }, region: {} }], 0, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan → FAIL** (ekspor baru belum ada di stub)

Run: `node node_modules/vitest/vitest.mjs run tests/unri/interiorPortal.test.js`

- [ ] **Step 3: Ganti seluruh isi `src/app/interiorPortal.js`**

Kode di bawah adalah isi baru seluruh berkas; SETELAHNYA salin fungsi `createStubInterior` dari stub M4 tanpa
perubahan ke akhir berkas dan tambahkan dua impornya di blok impor (`import * as THREE from 'three';`,
`import { createTextTexture } from '../world/props/canvasText.js';`). `appStage`, `EXIT_KEYS`, `EXIT_PROMPT` M4
dihapus (tidak dipakai lagi).

```js
/**
 * Portal interior (spec §4.8, §10): pintu-portal antara dunia luar dan scene interior terpisah (src/interiors).
 * Mesin state: outside → fadingIn → inside → fadingOut → outside.
 * - Masuk: layar memudar ke hitam → interior dibangun di ResourceScope sendiri → App.setView memakai scene &
 *   kamera interior (post-processing & label ikut) → sistem eksterior DIJEDA lewat gerbang App (tidak dilepas,
 *   urutan tetap) kecuali KEEP_INSIDE (jam, cuaca, input, scheduler) → pemain berjalan kaki (Walker +
 *   InteriorCameraRig) → layar terang kembali. AO (GTAO lazy) dinyalakan selama di dalam; suara hujan eksterior
 *   dibisukan (interior memutar hujan di atap seng sendiri).
 * - Build melempar / hasil tidak valid / pemasangan gagal: fade dibatalkan, pemain tetap di luar, toast
 *   "Pintu terkunci", scope interior dilepas.
 * - Keluar: sistem interior dicabut (dispose), view/gerbang/AO/suara dipulihkan, interior dilepas PENUH
 *   (dispose interior → disposeTree scene → scope.dispose). Sepeda TIDAK disentuh (tetap di depan pintu); hanya
 *   bila sepeda > FAR_EXIT_M dari titik keluar (masuk lewat dev/E2E) sepeda dipindah ke exitTo.
 * Pemicu pintu (E di depan pintu + prompt) tetap milik `src/app/portalTrigger.js` (M4), yang memanggil
 * enter(interiorId, { door }). Fade memakai port `fader.fade(0|1)` (`src/ui/FadeOverlay.js`, M4).
 * Penanda kompatibilitas M4: PORTAL_STATES, LOCKED_TOAST; build(ctx) menerima `exit` (pintu interaktif).
 */
import { createResourceScope, withScope } from '../engine/ResourceScope.js';
import { disposeTree } from '../engine/disposeTree.js';
import { validateInteriorBuild, nearestInteractable } from '../interiors/Interior.js';
import { InteriorCameraRig } from '../core/InteriorCameraRig.js';
import { Walker } from '../entities/Walker.js';
import { InfoCard } from '../ui/InfoCard.js';
import { formatHour } from '../sim/dayCycle.js';

export const PORTAL_STATES = Object.freeze({ OUTSIDE: 'outside', FADING_IN: 'fadingIn', INSIDE: 'inside', FADING_OUT: 'fadingOut' });
export const LOCKED_TOAST = 'Pintu terkunci';
export const INTERIOR_AO_RADIUS = 0.45; // m: AO ruang sempit (eksterior memakai RENDER.aoRadius)
export const FAR_EXIT_M = 30;
export const KEEP_INSIDE = Object.freeze(['gamepad', 'keymap', 'timeOfDay', 'weather', 'scheduler', 'input.endFrame']);
export const INTERIOR_EYE_Y = 1.55;
const PRESET_KEYS = Object.freeze(['Digit1', 'Digit2', 'Digit3', 'Digit4']);
const MOVE = Object.freeze({
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
});
const CLOSE_CARD_KEYS = Object.freeze(['KeyE', 'Escape', 'Space']);
const STILL = Object.freeze({ forward: 0, strafe: 0, run: false });

/** Sistem yang tetap jalan saat di dalam interior (gerbang App.setSystemGate). */
export function isSystemActiveInside(id) {
  return typeof id === 'string' && (KEEP_INSIDE.includes(id) || id.startsWith('interior.'));
}

const anyDown = (input, codes) => codes.some((c) => input.isDown(c));

/** Niat gerak jalan kaki dari tombol (sentuh & gamepad menulis ke kode yang sama). */
export function walkIntent(input, yaw) {
  return {
    forward: (anyDown(input, MOVE.forward) ? 1 : 0) - (anyDown(input, MOVE.back) ? 1 : 0),
    strafe: (anyDown(input, MOVE.right) ? 1 : 0) - (anyDown(input, MOVE.left) ? 1 : 0),
    run: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
    yaw,
  };
}

/** Gerak kamera bebas mode foto: W/A/S/D seperti jalan, Q/E turun/naik. */
function photoMove(input) {
  const w = walkIntent(input, 0);
  return { forward: w.forward, strafe: w.strafe, up: (input.isDown('KeyE') ? 1 : 0) - (input.isDown('KeyQ') ? 1 : 0), run: w.run };
}

const defaultIsPhotoUi = () => typeof document !== 'undefined' && Boolean(document.body?.classList.contains('is-photo'));

const DEFAULT_FACTORIES = Object.freeze({
  rig: (camera, dom, opts) => new InteriorCameraRig(camera, dom, opts),
  walker: (opts) => new Walker(opts),
  card: () => new InfoCard(document.body),
});

/** Kotak kamera foto bebas: dalam ruang + 2,6 m ke selasar lewat pintu. */
function photoBounds(size) {
  return { min: [-size.w / 2 + 0.1, 0.2, -size.d / 2 - 2.6], max: [size.w / 2 - 0.1, size.h - 0.15, size.d / 2 - 0.1] };
}

/**
 * @param {{app:object, input:object, hud:object, interiors:Map<string, object>, regionManager?:object|null,
 *   time?:object|null, weather?:object|null, store?:object|null, audioBus?:object|null,
 *   bike?:{state:{x:number,z:number}, teleport(x:number,z:number,yaw:number):void}|null,
 *   isUiBlocking?:() => boolean, isPhotoUi?:() => boolean, beforeEnter?:(def:object) => void,
 *   onInsideChange?:(inside:boolean) => void, onInteracted?:(interiorId:string, itemId:string) => void,
 *   onState?:(state:string) => void, fader?:{fade(to:number):Promise<void>},
 *   createScope?:(name:string) => object, factories?:object, logger?:{error:Function}}} deps
 */
export function createInteriorPortal({
  app, input, hud, interiors, regionManager = null, time = null, weather = null, store = null, audioBus = null,
  bike = null, isUiBlocking = () => false, isPhotoUi = defaultIsPhotoUi, beforeEnter = () => {},
  onInsideChange = () => {}, onInteracted = () => {}, onState = () => {}, fader = { fade: async () => {} },
  createScope = createResourceScope, factories = DEFAULT_FACTORIES, logger = console,
}) {
  let state = 'outside';
  let current = null;
  const setState = (next) => { state = next; onState(next); };
  const toast = (text, ok) => hud?.toast?.(text, ok);
  const storeGet = (key, fallback) => {
    const v = store?.get?.(key);
    return v === undefined ? fallback : v;
  };

  /** Pintu-portal region aktif dalam koordinat dunia (dev/E2E; pemicu E ada di portalTrigger M4). */
  function doors() {
    const out = [];
    for (const entry of regionManager?.active?.() ?? []) {
      for (const door of entry.region?.portals ?? []) {
        const world = entry.frame.toWorld(door.pos.lx, door.pos.lz);
        out.push({ ...door, regionId: entry.def.id, world, worldYaw: entry.frame.yawToWorld(door.yaw) });
      }
    }
    return out;
  }

  const buildCtx = (scope, door) => ({
    scope,
    renderer: app.renderer ?? null,
    audioBus,
    time,
    weather,
    store,
    door,
    fov: Number(storeGet('camera.fov', 70)) || 70,
    setExposure: (v) => app.setBaseExposure?.(v),
    exit: () => exit(), // kontrak M4: interaktif pintu boleh keluar lewat ctx build
  });

  function runUndo(undo) {
    while (undo.length) {
      try {
        undo.pop()();
      } catch (err) {
        logger.error('Interior: pembongkaran gagal (dilanjutkan):', err);
      }
    }
  }

  /** Lepas hasil build (boleh parsial) + pohon scene + scope. */
  function releaseBuild(result, scope) {
    try { result?.dispose?.(); } catch (err) { logger.error('Interior: dispose hasil build gagal:', err); }
    try { if (result?.scene?.isObject3D) disposeTree(result.scene, { scope }); } catch (err) { logger.error('Interior: disposeTree gagal:', err); }
    scope.dispose();
  }

  function mount(def, built, scope, door) {
    const undo = [];
    try {
      const rig = factories.rig(built.camera, app.renderer?.domElement ?? null, {
        ceiling: def.size.h, isCameraClear: built.colliders.isCameraClear ?? null, bounds: photoBounds(def.size),
        baseFov: built.camera.fov, sensitivity: Number(storeGet('camera.sensitivity', 1)) || 1,
      });
      undo.push(() => rig.dispose());
      rig.yaw = def.spawn.yaw;
      // Material/geometri Humanoid pemain masuk scope interior (dilepas bersama scope saat keluar).
      const walker = withScope(scope, () => factories.walker({ spawn: def.spawn, collider: built.colliders }));
      undo.push(() => walker.dispose());
      built.scene.add(walker.group);
      const card = factories.card();
      undo.push(() => card.dispose());
      const c = { def, built, scope, door, rig, walker, card, undo, focus: null, wasPhoto: false, wasBlocked: false };
      const add = (system) => {
        app.addSystem(system);
        undo.push(() => app.removeSystem(system.id));
      };
      for (const system of built.systems) add(system);
      for (const system of portalSystems(c)) add(system);
      app.setSystemGate(isSystemActiveInside);
      undo.push(() => app.setSystemGate(null));
      const prevAo = Boolean(app.aoEnabled);
      if (!prevAo) app.setAO?.(true);
      undo.push(() => app.setAO?.(store ? Boolean(storeGet('graphics.ao', prevAo)) : prevAo));
      app.setView({ scene: built.scene, camera: built.camera, aoRadius: INTERIOR_AO_RADIUS });
      undo.push(() => app.setView(null));
      weather?.setSoundEnabled?.(false);
      undo.push(() => weather?.setSoundEnabled?.(Boolean(storeGet('weather.sound', true))));
      undo.push(() => hud?.setPrompt?.(null));
      return c;
    } catch (err) {
      runUndo(undo);
      throw err;
    }
  }

  function unmount(c) {
    runUndo(c.undo);
    releaseBuild(c.built, c.scope);
  }

  async function enter(id, { door = null } = {}) {
    if (state !== 'outside') return false;
    const def = interiors?.get?.(id);
    if (!def) {
      logger.error(`Interior "${id}" tidak terdaftar`);
      toast(LOCKED_TOAST, false);
      return false;
    }
    beforeEnter(def);
    setState('fadingIn');
    await fader.fade(1);
    const scope = createScope(`interior:${id}`);
    let result = null;
    try {
      result = await def.build(buildCtx(scope, door));
      validateInteriorBuild(result, id);
      current = mount(def, result, scope, door);
    } catch (err) {
      logger.error(`Interior "${id}" gagal dibuka:`, err);
      current = null;
      releaseBuild(result, scope);
      setState('outside');
      await fader.fade(0);
      toast(LOCKED_TOAST, false);
      return false;
    }
    setState('inside');
    onInsideChange(true);
    await fader.fade(0);
    return true;
  }

  function placeBikeAtExit(def) {
    if (!bike) return;
    const frame = regionManager?.frameOf?.(def.exitTo.region);
    if (!frame) return;
    const p = frame.toWorld(def.exitTo.x, def.exitTo.z);
    const s = bike.state;
    if (s && Number.isFinite(s.x) && Math.hypot(s.x - p.x, s.z - p.z) <= FAR_EXIT_M) return; // sepeda tetap
    bike.teleport(p.x, p.z, frame.yawToWorld(def.exitTo.yaw));
  }

  async function exit() {
    if (state !== 'inside' || !current) return false;
    const c = current;
    setState('fadingOut');
    await fader.fade(1);
    current = null;
    unmount(c);
    placeBikeAtExit(c.def);
    onInsideChange(false);
    setState('outside');
    await fader.fade(0);
    return true;
  }

  const interactCtx = (c) => ({
    rig: c.rig,
    walker: c.walker,
    toast: (text, ok = true) => toast(text, ok),
    exit: () => exit().catch((err) => logger.error('Keluar interior gagal:', err)),
    hour: Number.isFinite(time?.hour) ? time.hour : 12,
    raining: Boolean(weather?.isRaining),
  });

  function interact(c, item) {
    let res;
    try {
      res = item.onInteract(interactCtx(c));
    } catch (err) {
      logger.error(`Interaksi "${item.id}" gagal:`, err);
      toast('Belum bisa dipakai sekarang', false);
      return;
    }
    onInteracted(c.def.id, item.id);
    if (res && (res.title || res.text)) c.card.show({ title: res.title ?? item.label, text: res.text ?? '' });
  }

  function selectPreset(c) {
    PRESET_KEYS.forEach((code, i) => {
      if (!input.consumePress(code)) return;
      const preset = c.built.photoPresets[i];
      if (!preset) return;
      c.rig.applyPreset(preset.pose);
      toast(`Foto: ${preset.label}`, true);
    });
  }

  function handleKeys(c) {
    if (state !== 'inside') return;
    const photo = Boolean(isPhotoUi());
    const blocked = Boolean(isUiBlocking());
    const { wasPhoto, wasBlocked } = c;
    c.wasPhoto = photo;
    c.wasBlocked = blocked;
    if (photo !== c.rig.photo) c.rig.setPhoto(photo);
    if (c.card.open) {
      if (CLOSE_CARD_KEYS.some((code) => input.consumePress(code))) c.card.hide();
      return;
    }
    if (photo) {
      selectPreset(c);
      return;
    }
    if (c.rig.busy) {
      const stop = ['KeyE', 'Escape'].some((code) => input.consumePress(code)) || walkIntent(input, 0).forward !== 0;
      if (stop) c.rig.cancelPeek();
      return;
    }
    if (blocked) return;
    if (input.consumePress('KeyV')) toast(c.rig.toggleMode() === 'third' ? 'Kamera: orang ketiga' : 'Kamera: orang pertama', true);
    if (input.consumePress('KeyE') && c.focus) interact(c, c.focus);
    // Esc yang baru menutup mode foto / panel / bantuan TIDAK ikut mengeluarkan pemain dari sekre.
    if (input.consumePress('Escape') && !wasPhoto && !wasBlocked) exit().catch((err) => logger.error('Keluar interior gagal:', err));
  }

  function updateFocus(c) {
    const off = state !== 'inside' || c.card.open || c.rig.photo || c.rig.busy;
    const s = c.walker.state;
    c.focus = off ? null : nearestInteractable(c.built.interactables, { x: s.x, y: INTERIOR_EYE_Y, z: s.z }, c.rig.viewDirection());
    hud?.setPrompt?.(c.focus ? `Tekan E — ${c.focus.prompt}` : null);
  }

  function portalSystems(c) {
    return [
      { id: 'interior.keys', phase: 'input', update: () => handleKeys(c) },
      {
        id: 'interior.walk',
        phase: 'sim',
        update: (dt) => {
          const blocked = state !== 'inside' || c.card.open || c.rig.photo || c.rig.busy || isUiBlocking();
          c.walker.update(dt, blocked ? { ...STILL, yaw: c.rig.yaw } : walkIntent(input, c.rig.yaw));
        },
      },
      { id: 'interior.interact', phase: 'sim', update: () => updateFocus(c) },
      {
        id: 'interior.camera',
        phase: 'camera',
        update: (dt) => {
          c.rig.update(c.walker.state, dt, c.rig.photo && !isUiBlocking() ? photoMove(input) : null);
          c.walker.setVisible(!c.rig.firstPersonView);
        },
      },
      {
        id: 'interior.hud',
        phase: 'ui',
        update: (dt, ctx) => {
          if (time) hud?.setTime?.(formatHour(time.hour), time.presetName, weather?.weatherName);
          hud?.tickFps?.(ctx?.rawDt ?? dt);
          hud?.setCameraMode?.(c.rig.mode);
        },
      },
    ];
  }

  return {
    get state() { return state; },
    get inside() { return state === 'inside'; },
    get busy() { return state === 'fadingIn' || state === 'fadingOut'; },
    /** Interior aktif (dev/E2E): { id, def, built, rig, walker, card } atau null. */
    get current() {
      return current && { id: current.def.id, def: current.def, built: current.built, rig: current.rig, walker: current.walker, card: current.card };
    },
    doors,
    /** Dipanggil portalTrigger (M4): enter(interiorId, { door: { ...pintu, worldYaw } }). */
    enter,
    exit,
    /** Router lihat (mouse/sentuh/gamepad) saat di dalam. */
    lookBy(dx, dy, scale = 1) {
      if (state === 'inside' && current) current.rig.lookBy(dx, dy, scale);
    },
    dispose() {
      if (current) {
        const c = current;
        current = null;
        unmount(c);
        onInsideChange(false);
      }
      state = 'outside';
    },
  };
}
```

- [ ] **Step 4: Jalankan tes portal**

Run: `node node_modules/vitest/vitest.mjs run tests/unri/interiorPortal.test.js`
Expected: semua PASS kecuali `nearestPortal … worldYaw` (diperbaiki Step 5).

- [ ] **Step 5: `src/app/portalTrigger.js` (M4) — teruskan pintu & yaw dunianya ke portal**

Di `nearestPortal`, ganti baris pengisian `best` menjadi:
```js
      if (d <= door.radius && (!best || d < best.distance)) {
        best = { door, regionId: def.id, distance: d, worldYaw: (def.placement?.yaw ?? 0) + door.yaw };
      }
```
dan di `createPortalTrigger`, panggilan masuk menjadi:
```js
      if (near && input.consumePress('KeyE')) {
        portal.enter(near.door.interiorId, { door: { ...near.door, worldYaw: near.worldYaw } })
          .catch((err) => logger.error('Portal gagal dibuka:', err));
      }
```
(`worldYaw` dipakai interior sekre untuk arah sinar matahari di jendela; placement Lembaga ber-yaw 0.)

Run: `node node_modules/vitest/vitest.mjs run tests/unri/interiorPortal.test.js` → PASS semua.

- [ ] **Step 6: Keymap — tombol eksterior dijeda di dalam (+ tes)**

Sistem `keymap` tetap jalan di dalam (whitelist) agar R/N/T/[ ]/O bekerja; tombol eksterior lain diabaikan.
`tests/keymapPortal.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import { Input } from '../src/core/Input.js';
import { handleKeys } from '../src/app/keymap.js';

function setup(portal) {
  const input = new Input(new EventTarget());
  const store = { get: vi.fn(() => false), set: vi.fn() };
  const story = { journal: { open: false }, toggleJournal: vi.fn(), tryInteract: vi.fn(() => true) };
  const deps = {
    rig: { povId: null, mode: 'third', freezesBike: false, handlePovKey: () => null, exitPov: () => false },
    hud: { shopOpen: false, toast: vi.fn() },
    ents: { bike: { state: { x: 5, z: 7 } } },
    shop: {},
    time: { hour: 12 },
    store,
    story,
    portal,
  };
  const frameWith = (...codes) => {
    for (const c of codes) input.press(c);
    handleKeys(input, deps);
    input.endFrame();
  };
  return { frameWith, store, story };
}

describe('keymap + portal interior', () => {
  it('di dalam interior: tombol eksterior (E, J) diabaikan; jam & hujan tetap bisa', () => {
    const t = setup({ inside: true, busy: false });
    t.frameWith('KeyE', 'KeyJ', 'KeyR');
    expect(t.story.tryInteract).not.toHaveBeenCalled();
    expect(t.story.toggleJournal).not.toHaveBeenCalled();
    expect(t.store.set).toHaveBeenCalledWith('weather.raining', true);
  });

  it('selama fade (busy) semua tombol diabaikan', () => {
    const t = setup({ inside: false, busy: true });
    t.frameWith('KeyE', 'KeyR');
    expect(t.story.tryInteract).not.toHaveBeenCalled();
    expect(t.store.set).not.toHaveBeenCalled();
  });

  it('di luar / tanpa portal: perilaku lama (E ke cerita/toko, koordinat dunia M0)', () => {
    for (const portal of [null, { inside: false, busy: false }]) {
      const t = setup(portal);
      t.frameWith('KeyE');
      expect(t.story.tryInteract).toHaveBeenCalledWith({ x: 5, z: 7 });
    }
  });
});
```
Run → FAIL. Lalu di `src/app/keymap.js` (signature M0, tanpa `frame`) ubah signature & awal fungsi `handleKeys`:
```js
export function handleKeys(input, { rig, hud, ents, shop, time, store, story, travelMenu = null, portal = null }) {
  if (portal?.busy) return; // fade masuk/keluar interior
  if (portal?.inside) { // tombol interior: sistem interior.keys di portal; di sini hanya jam/cuaca/AO
    handleTimeWeatherKeys(input, hud, time, store);
    if (input.consumePress('KeyO')) store.set('graphics.ao', !store.get('graphics.ao'));
    return;
  }
```
Run: `node node_modules/vitest/vitest.mjs run tests/keymapPortal.test.js tests/keymapTravel.test.js` → PASS.

- [ ] **Step 7: `src/main.js` — portal M5 menggantikan portal stub M4 (interior masih stub sampai Task 20)**

Nama variabel mengikuti main.js M0/M4: manager region = `regions` (dari `createRegionLayer`), `colliders`,
`portalKit` dari `setupPortal`. Impor `./app/interiorPortal.js` menjadi:
```js
import { createInteriorPortal, createStubInterior } from './app/interiorPortal.js';
```
dan hapus impor `appViewPort` (`./app/appView.js`), lalu hapus berkas M4 itu beserta tesnya: `git rm src/app/appView.js tests/unri/appView.test.js` (App.setView M5 menggantikannya; penghapusan ikut ter-stage untuk commit Step 9). Router lihat —
ganti pembuatan `TouchControls` dan `createGamepadPoller`:
```js
  // Router lihat: kamera sepeda di luar, kamera interior di dalam sekre (target diganti portal.onInsideChange).
  const look = { target: rig, lookBy(dx, dy, scale) { look.target.lookBy(dx, dy, scale); } };
  const touchUi = new TouchControls(document.body, { input, rig: look, surface: app.renderer.domElement });
  lifecycle.add(() => touchUi.dispose());
  const gamepad = createGamepadPoller(input, { lookBy: (dx, dy) => look.lookBy(dx, dy) });
```
Ganti seluruh fungsi `setupPortal` (M4) dengan:
```js
/**
 * Pintu-portal interior: pemicu pintu (portalTrigger M4) → interiorPortal M5 (gerbang sistem: jam/cuaca tetap jalan,
 * jalan kaki, interaksi, mode foto). Keluar: sepeda tetap di tempat (dipindah ke exitTo hanya bila > 30 m, mis. masuk
 * lewat dev/E2E). Router lihat, minimap, dan HUD mengikuti keadaan di dalam/luar.
 */
function setupPortal({
  app, input, hud, rig, ents, regions, colliders, time, weather, store, audioBus, travel, story, minimap, look, panelRef, lifecycle,
}) {
  const fader = createFadeOverlay(document.body);
  lifecycle.add(() => fader.dispose());
  const ormawa = LEMBAGA_LAYOUT.rooms[PLAYER_ROOM_INDEX];
  const interiors = new Map([['sekre', createStubInterior({ id: 'sekre', label: `Sekretariat ${ormawa.nama}`, exitTo: sekreExitTo() })]]);
  const teleport = (x, z, yaw) => {
    ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
    ents.bike.setCollider(createCollider({ x, z }, colliders.isWalkable, colliders.penetration));
  };
  const portal = createInteriorPortal({
    app, input, hud, interiors, regionManager: regions, time, weather, store, audioBus, fader,
    bike: { get state() { return ents.bike.state; }, teleport },
    isUiBlocking: () => Boolean(hud.shopOpen || story.journal.open || travel.menu.open
      || panelRef.current?.isOpen || panelRef.current?.isHelpOpen),
    beforeEnter: () => {
      rig.exitPov({ instant: true });
      ents.bike.state = { ...ents.bike.state, v: 0 }; // sepeda diam di depan pintu
    },
    onInsideChange: (inside) => {
      look.target = inside ? portal : rig;
      document.body.classList.toggle('is-interior', inside);
      minimap.setVisible(!inside && app.minimapVisible);
      if (!inside) rig.yawOffset = 0; // mouse selama di dalam ikut menggeser rig sepeda (listener-nya sendiri)
    },
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
(Pointer lock tidak dilepas saat masuk — berbeda dari stub M4 — agar mouse langsung bisa melihat di dalam.)

Di `main()`: panggilan M4 `const portalKit = setupPortal({ … })` (sebelum `addFrameSystems`) menjadi
```js
  const panelRef = { current: null }; // SettingsPanel (diisi saat panel selesai dipasang)
  const portalKit = setupPortal({
    app, input, hud, rig, ents, regions, colliders, time, weather, store, audioBus, travel, story, minimap, look, panelRef, lifecycle,
  });
```
(`portalKit.trigger.installPrompt()` setelah `addFrameSystems` dan `window.__sim.portal = portalKit.portal` dari M4
tetap.) Teruskan portal ke keymap: tambahkan `portal: portalKit.portal` di argumen `addFrameSystems({ … })`,
parameter `portal` di `addFrameSystems`, dan
```js
    update: () => { if (session.started) handleKeys(input, { rig, hud, ents, shop, time, store, story, travelMenu: travel.menu, portal }); },
```
Konteks frame `app.start(…)`: kondisi `input:` menjadi
```js
input: hud.shopOpen || rig.freezesBike || travel.blocksInput || portalKit.portal.busy || portalKit.portal.inside ? null : input
```
Panel: `setupMenu(…).then((mounted) => lifecycle.add(() => mounted.dispose()))` menjadi
```js
  setupMenu({ app, rig, hud, store, touchUi, touch, menu, story })
    .then((mounted) => {
      panelRef.current = mounted.panel;
      lifecycle.add(() => mounted.dispose());
    })
```

- [ ] **Step 8: Tes, lint, build, asap singkat**

Run: `npm test` lalu `npm run lint` lalu `npm run build` → PASS, 0 galat, build sukses. Dev server: teleport ke
pintu sekre (`__sim.portal.doors()`), E → ruang abu stub; W/A/S/D berjalan, V orang ketiga, jam (`[`/`]`) & R tetap
bekerja, Esc → keluar, sepeda di tempat semula; `node tests/e2e/lembaga.e2e.mjs --gpu d3d11` (M4) lulus.

- [ ] **Step 9: Commit**

```
git add src/app/interiorPortal.js src/app/portalTrigger.js src/app/keymap.js src/main.js tests/unri/interiorPortal.test.js tests/keymapPortal.test.js
```
```
git commit -m "feat(app): interiorPortal penuh (gerbang sistem, jalan kaki + kamera interior, interaksi E, gagal build → Pintu terkunci) menggantikan stub M4"
```

---

## Task 11: `data.js` — satu sumber isi sekre (+ tes konsistensi)

**Files:**
- Create: `src/interiors/sekre/data.js`, `tests/interiorSekre.test.js`

- [ ] **Step 1: Tes gagal `tests/interiorSekre.test.js`**

```js
import { describe, it, expect } from 'vitest';
import * as D from '../src/interiors/sekre/data.js';
import { PERIODS } from '../src/sim/activitySchedule.js';
import { POSE_IDS } from '../src/entities/Humanoid.poses.js';
import { createRoomCollider } from '../src/interiors/roomCollider.js';

const IDS = Array.from({ length: 30 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);
const insideRoom = (p, m = 0.01) => Math.abs(p.x) <= D.ROOM.w / 2 + m && Math.abs(p.z) <= D.ROOM.d / 2 + m && p.y >= 0 && p.y <= D.ROOM.h;
const collider = (withNpc) => createRoomCollider({
  halfW: D.ROOM.w / 2, halfD: D.ROOM.d / 2, solids: D.SOLIDS, tallSolids: D.TALL_SOLIDS,
  blockers: () => (withNpc ? D.SLOTS.map((s) => ({ x: s.x, z: s.z, r: s.block })) : []),
});

describe('data sekre: aset katalog', () => {
  it('S01–S30 lengkap, dimensi positif, penempatan hingga & di dalam ruang', () => {
    expect(Object.keys(D.ASET).sort()).toEqual(IDS);
    for (const id of IDS) {
      const a = D.ASET[id];
      expect([a.dim.w, a.dim.d, a.dim.h].every((v) => v > 0)).toBe(true);
      for (const it of a.items) {
        expect([it.x, it.y, it.z, it.hadap].every(Number.isFinite)).toBe(true);
        expect(insideRoom(it)).toBe(true);
      }
    }
    expect(D.ordnerSlots()).toHaveLength(12);
  });

  it('dimensi placeholder = katalog (L × P × T = x × z × y)', () => {
    expect(D.ASET.S01.dim).toEqual({ w: 1.8, d: 0.03, h: 1.2 });
    expect(D.ASET.S09.dim).toEqual({ w: 0.9, d: 0.45, h: 1.8 });
    expect(D.ASET.S13.dim).toEqual({ w: 0.32, d: 0.32, h: 1.25 });
    expect(D.ASET.S14.dim).toEqual({ w: 0.45, d: 0.45, h: 1.3 });
    expect(D.ASET.S16.dim).toEqual({ w: 1.8, d: 0.6, h: 0.75 });
    expect(D.ASET.S22.dim).toEqual({ w: 3, d: 4, h: 0.01 });
    expect(D.ASET.S30.dim).toEqual({ w: 0.9, d: 0.05, h: 2.1 });
  });

  it('jumlah instans sesuai katalog (×2, ×3, ×4)', () => {
    expect(D.ASET.S06.items).toHaveLength(4);
    expect(D.ASET.S07.items).toHaveLength(3);
    expect(D.ASET.S17.items).toHaveLength(2);
    expect(D.ASET.S20.items).toHaveLength(3);
    expect(D.ASET.S21.items).toHaveLength(4);
    expect(D.ASET.S24.items).toHaveLength(2);
    expect(D.ASET.S26.items).toHaveLength(4);
  });
});

describe('data sekre: NPC & slot', () => {
  it('semua slot yang dipakai jadwal ada; pose dikenal; slot tidak di dalam perabot (laptop duduk di kursi)', () => {
    const ids = new Set(D.SLOTS.map((s) => s.id));
    for (const p of PERIODS) for (const s of p.slots) expect(ids.has(s)).toBe(true);
    for (const s of D.SLOTS) {
      expect(POSE_IDS).toContain(s.poseId);
      const hit = D.SOLIDS.filter((r) => s.x > r.x0 && s.x < r.x1 && s.z > r.z0 && s.z < r.z1).map((r) => r.id);
      expect(hit).toEqual(s.id === 'laptop' ? ['kursi'] : []);
    }
  });

  it('6 NPC unik, ≥ 2 berjas almamater, sisanya kaus', () => {
    expect(D.NPCS).toHaveLength(6);
    expect(new Set(D.NPCS.map((n) => n.id)).size).toBe(6);
    expect(D.NPCS.filter((n) => n.outfit === 'almamater').length).toBeGreaterThanOrEqual(2);
    expect(D.NPCS.every((n) => ['almamater', 'kaus'].includes(n.outfit))).toBe(true);
  });

  it('spawn & jalur pintu → karpet bisa dijalani walau semua slot terisi', () => {
    const c = collider(true);
    expect(c.isWalkable(D.SPAWN.x, D.SPAWN.z)).toBe(true);
    expect(c.isWalkable(1.0, -0.8)).toBe(true);
    expect(collider(false).isWalkable(-0.4, 0.7)).toBe(true);
  });
});

describe('data sekre: interaksi & isi contoh', () => {
  it('≥ 10 barang interaktif, id unik, prompt terisi, ada pintu keluar', () => {
    expect(D.INTERAKSI.length).toBeGreaterThanOrEqual(10);
    expect(new Set(D.INTERAKSI.map((i) => i.id)).size).toBe(D.INTERAKSI.length);
    expect(D.INTERAKSI.every((i) => i.prompt && i.radius > 0)).toBe(true);
    expect(D.INTERAKSI.map((i) => i.id)).toEqual(expect.arrayContaining([
      'papan-struktur', 'papan-proker', 'piagam', 'lemari-arsip', 'gitar', 'dispenser', 'kipas', 'saklar', 'jendela', 'whiteboard', 'pintu',
    ]));
  });

  it('isi organisasi bertanda contoh; papan punya isi', () => {
    expect(typeof D.DATA_CONTOH).toBe('boolean');
    expect(D.STRUKTUR.inti.length).toBeGreaterThanOrEqual(2);
    expect(D.STRUKTUR.divisi.length).toBeGreaterThanOrEqual(4);
    expect(D.PROKER.length).toBeGreaterThanOrEqual(5);
    expect(D.CATATAN_RAPAT.poin.length).toBeGreaterThanOrEqual(4);
    expect(D.PIAGAM).toHaveLength(4);
    expect(D.POSTER).toHaveLength(4);
    expect(D.ORDNER).toHaveLength(12);
  });

  it('kalender Oktober 2026 dimulai Kamis (Senin = 0 → 3)', () => {
    expect(new Date(2026, 9, 1).getDay()).toBe(4);
    expect(D.KALENDER.hariMulai).toBe(3);
  });
});
```

- [ ] **Step 2: Jalankan → FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/interiorSekre.test.js`

- [ ] **Step 3: Tulis `src/interiors/sekre/data.js`**

```js
/**
 * Data interior sekre (spec §8.2, katalog aset bagian 6–7): SATU sumber untuk ruang, penempatan aset S01–S30,
 * slot aktivitas NPC, NPC, barang interaktif, dan isi papan.
 *
 * PENTING — isi organisasi (nama, kabinet, pengurus, proker, piagam, poster, catatan rapat, piket) adalah DATA
 * CONTOH [POLA UMUM ormawa Indonesia, riset §3], BUKAN fakta UNRI. Ganti sesuai sekre asli; set
 * DATA_CONTOH = false agar catatan kecil "data contoh" di papan hilang. Fakta yang dipakai: almamater biru
 * langit, julukan "Kampus Biru Langit", Dies Natalis UNRI 1 Oktober (1962 → ke-64 di 2026), Sumpah Pemuda 28 Okt.
 *
 * Koordinat ruang-lokal (m): lantai y = 0; x ∈ [−2,1; 2,1] (kiri → kanan saat masuk dari pintu);
 * z ∈ [−3; 3] (dinding selasar berpintu di z = −3, dinding belakang z = +3).
 * `hadap` = yaw arah hadap, konvensi entitas: maju = (sin hadap, cos hadap); 0 = ke +Z (ke dalam ruang),
 * π = ke selasar, π/2 = ke +X, −π/2 = ke −X. Builder: aset katalog (depan −Z lokal) memakai rotasi
 * y = hadap + π; bidang dinding (normal +Z) dan Humanoid (menghadap +Z) memakai rotasi y = hadap.
 * Dimensi `dim` = katalog L × P × T = { w: x, d: z, h: y } (m), pusat alas di origin.
 */
const PI = Math.PI;
const freeze = Object.freeze;
const at = (x, y, z, hadap = 0, extra = {}) => freeze({ x, y, z, hadap, ...extra });
const aset = (nama, w, d, h, items, extra = {}) => freeze({ nama, dim: freeze({ w, d, h }), items: freeze(items), ...extra });
const rect = (id, x0, x1, z0, z1) => freeze({ id, x0, x1, z0, z1 });

export const DATA_CONTOH = true;
export const SCHEDULE_SEED = 2026;

// ---------- Ruang (spec §8.2: 4,2 × 6,0 × 3,2 m dalam) ----------
export const ROOM = freeze({ w: 4.2, d: 6.0, h: 3.2, wall: 0.15 });
export const WINDOW = freeze({ x: -0.9, w: 1.2, sill: 0.9, h: 1.2, z: -3.0 });
export const WINDOW_CENTER = freeze({ x: WINDOW.x, y: WINDOW.sill + WINDOW.h / 2, z: WINDOW.z });
/** Pintu 0,9 × 2,1 m; daun pintu berengsel di x0, terbuka 85° ke dalam ruang (merapat ke kusen kiri). */
export const DOOR = freeze({ x0: 0.9, x1: 1.8, h: 2.1, z: -3.0, openRad: -1.48 });
/**
 * Selasar tengah gedung Sekretariat Lembaga (spec §8.1: 2 × 4 ruang 4,2 × 6 m + selasar 3,7 m terbuka di kedua
 * ujung [INFERENSI denah]). Sekre pemain = ruang indeks 1 ("UKM SENI", sebelah BEM) → mulut selasar 6,29 m di
 * barat dan 10,48 m di timur pusat ruang (M4). Ubah bila PLAYER_ROOM_INDEX di sekre.data.js M4 berubah.
 */
export const SELASAR = freeze({ zDekat: -3.15, zSeberang: -6.85, ujungKiri: -6.3, ujungKanan: 10.5, tinggiAtap: 3.4, beratap: true });
/** Papan nama deret seberang selasar dari barat (M4 sekre.data.js indeks 4–7; samakan bila diganti). */
export const SELASAR_SEBERANG = freeze(['DPM', 'UKM PERS MAHASISWA', 'UKM PECINTA ALAM', 'UKM KEWIRAUSAHAAN']);
export const SPAWN = freeze({ x: 1.5, z: -2.4, yaw: 0 });
/** yaw dunia sumbu +Z ruang = yaw pintu M4 (menghadap selasar) + offset ini. */
export const ROOM_YAW_OFFSET = PI;
export const TL_POS = freeze([freeze({ x: 0, y: ROOM.h, z: -1.3 }), freeze({ x: 0, y: ROOM.h, z: 1.5 })]);

// ---------- Organisasi (DATA CONTOH) ----------
export const ORGANISASI = freeze({
  singkatan: 'UKM', nama: 'Unit Kegiatan Mahasiswa', kabinet: 'Kabinet Harmoni Bertuah', periode: '2026/2027',
  motto: 'Bergerak · Berkarya · Bermakna', warna: '#d9661f', warna2: '#6fbfe8',
});
const p = (jabatan, nama) => freeze({ jabatan, nama });
const divisi = (nama, koor, anggota) => freeze({ nama, koor, anggota: freeze(anggota) });
export const STRUKTUR = freeze({
  inti: freeze([p('Ketua Umum', 'Fajar Ramadhan'), p('Wakil Ketua', 'Nurul Aisyah')]),
  sekben: freeze([p('Sekretaris', 'Dimas Pratama'), p('Bendahara', 'Sari Wulandari')]),
  divisi: freeze([
    divisi('Kaderisasi', 'Rizky Saputra', ['Aldi', 'Mega', 'Yoga']),
    divisi('Humas', 'Putri Amelia', ['Bayu', 'Intan', 'Reza']),
    divisi('Minat & Bakat', 'Hendra Gunawan', ['Tiara', 'Fikri', 'Lala']),
    divisi('Dana Usaha', 'Wulan Sari', ['Rahmat', 'Nisa', 'Doni']),
    divisi('Kominfo', 'Arif Hidayat', ['Salsa', 'Ilham', 'Vina']),
  ]),
});
const proker = (nama, bulan, status, catatan = '') => freeze({ nama, bulan, status, catatan });
export const BULAN_PROKER = freeze(['Sep', 'Okt', 'Nov', 'Des', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu']);
export const PROKER = freeze([
  proker('Open Recruitment', 'Sep', 'selesai'),
  proker('Latihan Dasar Organisasi', 'Okt', 'selesai'),
  proker('Dies Natalis Organisasi', 'Nov', 'berjalan', 'H-14!!'),
  proker('Bakti Sosial', 'Des', 'rencana'),
  proker('Pentas Akhir Tahun', 'Jan', 'rencana'),
  proker('Studi Banding', 'Mar', 'rencana'),
  proker('Musyawarah Besar', 'Agu', 'rencana'),
]);
export const CATATAN_RAPAT = freeze({
  judul: 'RAPAT PERSIAPAN DIES NATALIS',
  tanggal: 'Kamis, 15/10',
  poin: freeze([
    'Konsumsi: nasi kotak 60 (cek Kantin FKIP)',
    'Sound system → pinjam atau sewa?',
    'Proposal ke dekanat paling lambat Jumat',
    'Poster + IG: Kominfo',
    'LPJ kegiatan lalu BELUM selesai!!',
  ]),
  tabel: freeze({ kolom: freeze(['Konsumsi', 'Dana', 'Publikasi']), isi: freeze(['Wulan', 'Sari', 'Arif']) }),
  tenggat: 'DL PROPOSAL: JUMAT!!',
  sudut: 'JANGAN DIHAPUS!!',
  semangat: 'semangat!!',
});
/** 1 Okt 2026 = Kamis; Senin = 0 → hariMulai 3. Tanda: fakta (Dies Natalis UNRI ke-64, Sumpah Pemuda) + contoh. */
export const KALENDER = freeze({
  bulan: 'OKTOBER 2026', hariMulai: 3, jumlahHari: 31, libur: freeze([]),
  tanda: freeze({ 1: 'Dies Natalis UNRI ke-64', 15: 'Rapat dies (contoh)', 28: 'Sumpah Pemuda' }), coretan: 'proposal!!',
});
const piket = (hari, nama, centang = false) => freeze({ hari, nama: freeze(nama), centang });
export const PIKET = freeze([
  piket('Senin', ['Fajar', 'Mega'], true), piket('Selasa', ['Nurul', 'Bayu'], true), piket('Rabu', ['Dimas', 'Tiara']),
  piket('Kamis', ['Sari', 'Ilham']), piket('Jumat', ['Rizky', 'Salsa']),
]);
const piagam = (judul, isi, tahun) => freeze({ judul, kepada: ORGANISASI.nama, isi, tahun });
export const PIAGAM = freeze([
  piagam('PIAGAM PENGHARGAAN', 'Juara II Lomba Kreativitas Mahasiswa tingkat universitas', 2025),
  piagam('SERTIFIKAT', 'Peserta terbaik Latihan Kepemimpinan Mahasiswa', 2024),
  piagam('PIAGAM', 'Partisipasi Bakti Sosial Ramadan', 2025),
  piagam('PENGHARGAAN', 'Pengisi acara penyambutan mahasiswa baru', 2026),
]);
const poster = (judul, sub, tanggal, tempat, warna, warna2) => freeze({ judul, sub, tanggal, tempat, warna, warna2 });
export const POSTER = freeze([
  poster('OPEN RECRUITMENT', 'Anggota baru 2026 — ayo bergabung!', '1–20 Sept 2026', 'Sekretariat Lembaga', '#d9661f', '#8c3a10'),
  poster('MALAM KEAKRABAN', 'Angkatan 2026', '7 Nov 2026', 'Stadion Mini UNRI', '#264653', '#2a9d8f'),
  poster('DIES NATALIS', 'Organisasi kita — syukuran & pentas', '21 Nov 2026', 'Student Center', '#6fbfe8', '#1d4e89'),
  poster('SEMINAR', 'Kepemimpinan Mahasiswa di Era Digital', '12 Des 2026', 'Aula fakultas', '#2a9d8f', '#1b4332'),
]);
const ordner = (label, warna) => freeze({ label, warna });
export const ORDNER = freeze([
  ordner('2019', '#1e3a8a'), ordner('2020', '#b91c1c'), ordner('2021', '#ca8a04'), ordner('2022', '#15803d'),
  ordner('2023', '#1e3a8a'), ordner('2024', '#b91c1c'), ordner('2025', '#ca8a04'), ordner('2026', '#15803d'),
  ordner('PROPOSAL', '#334155'), ordner('SURAT MASUK', '#7c2d12'), ordner('SURAT KELUAR', '#1e3a8a'), ordner('INVENTARIS', '#111827'),
]);
export const STIKER = freeze(['KAMPUS BIRU LANGIT', 'NO SMOKING', 'LEPAS ALAS KAKI', 'JAGA KEBERSIHAN', ORGANISASI.singkatan, 'SALAM MAHASISWA']);
export const TEKS = freeze({
  lemari: 'Map ordner 2019–2026 berjajar, labelnya ditulis spidol.\n'
    + 'Di ujung rak terselip satu map tanpa label. Isinya: "LPJ KEGIATAN — BELUM SELESAI".\n'
    + 'Tenggatnya sudah lewat tiga periode kepengurusan. Tidak ada yang ingat siapa penanggung jawabnya.',
  piala: 'Tiga piala berdiri di atas lemari arsip — satu sudah kehilangan tutupnya.',
  contoh: '(Data contoh — ubah di src/interiors/sekre/data.js)',
});

// ---------- Penempatan aset katalog S01–S30 ----------
export const ASET = freeze({
  S01: aset('papan-struktur-kabinet', 1.8, 0.03, 1.2, [at(-0.6, 1.75, 2.985, PI)]),
  S02: aset('papan-proker', 1.5, 0.03, 1.0, [at(-2.085, 1.65, 0.9, PI / 2)]),
  S03: aset('whiteboard', 1.2, 0.05, 0.9, [at(2.075, 1.45, -1.2, -PI / 2)]),
  S04: aset('kalender-dinding', 0.4, 0.01, 0.6, [at(-2.094, 1.6, -1.6, PI / 2)]),
  S05: aset('jadwal-piket', 0.3, 0.01, 0.42, [at(-2.094, 1.45, -0.95, PI / 2)]),
  S06: aset('piagam-bingkai', 0.4, 0.02, 0.3, [0.27, 0.69, 1.11, 1.53].map((z) => at(-2.09, 2.45, z, PI / 2))),
  S07: aset('piala', 0.15, 0.15, 0.45, [
    at(1.25, 1.8, 2.8, PI, { skala: 0.85 }), at(1.5, 1.8, 2.82, PI, { skala: 1.15 }), at(1.75, 1.8, 2.8, PI - 0.3, { skala: 1 }),
  ]),
  S08: aset('bendera-meja', 0.3, 0.3, 0.6, [at(1.85, 0.75, 0.52, -PI / 2)], { bendera: freeze(['organisasi', 'unri', 'merah-putih']) }),
  S09: aset('lemari-arsip-besi', 0.9, 0.45, 1.8, [at(1.5, 0, 2.775, PI)]),
  S10: aset('map-ordner', 0.08, 0.3, 0.32, []),
  S11: aset('kardus-properti', 0.5, 0.4, 0.35, [at(-1.82, 0, -2.1, 0.1), at(-1.8, 0.35, -2.08, -0.15), at(-1.85, 0, 2.76, 0.05)]),
  S12: aset('spanduk-tergulung', 0.1, 0.1, 2, [at(-1.97, 0, -2.85, PI / 2, { miring: 0.12 }), at(-1.86, 0, -2.9, PI / 2, { miring: 0.08 })]),
  S13: aset('dispenser-galon', 0.32, 0.32, 1.25, [at(0.35, 0, -2.82, 0)]),
  S14: aset('kipas-berdiri', 0.45, 0.45, 1.3, [at(-1.8, 0, -1.0, 0.69)]),
  S15: aset('printer-tua', 0.45, 0.4, 0.25, [at(1.78, 0.75, 1.9, -PI / 2)]),
  S16: aset('meja-lipat-panjang', 1.8, 0.6, 0.75, [at(1.75, 0, 1.2, -PI / 2)]),
  S17: aset('laptop', 0.34, 0.24, 0.23, [at(1.72, 0.75, 1.2, -PI / 2), at(1.78, 0.75, 0.82, -PI / 2 + 0.35)]),
  S18: aset('gelas-kopi', 0.08, 0.08, 0.1, [
    at(1.55, 0.75, 1.5, 0, { isi: 'kopi' }), at(1.62, 0.75, 0.95, 0, { isi: 'plastik' }), at(-0.1, 0.012, 0.75, 0, { isi: 'kopi' }),
  ]),
  S19: aset('gitar-akustik', 0.38, 0.1, 1.0, [at(-1.8, 0, 1.95, PI / 2, { miring: 0.2 })]),
  S20: aset('tas-ransel', 0.3, 0.2, 0.45, [
    at(1.95, 0, -1.85, -PI / 2, { warna: '#1f2a44' }), at(1.93, 0, -1.6, -PI / 2 + 0.2, { warna: '#2b2b2b' }),
    at(0.95, 0.012, 2.55, 2.5, { warna: '#7a1f2b' }),
  ]),
  S21: aset('sepatu-pasang', 0.3, 0.12, 0.1, [
    at(1.55, 0, -2.85, 0.2, { warna: '#212121' }), at(1.8, 0, -2.83, -0.3, { warna: '#1565c0' }),
    at(2.0, 0, -2.62, 1.4, { warna: '#6d4c41' }), at(1.28, 0, -2.9, 0.05, { warna: '#e0e0e0' }),
  ]),
  S22: aset('karpet-ambal-marun', 3, 4, 0.01, [at(-0.4, 0, 0.7, 0)]),
  S23: aset('bantal-tikar', 0.5, 0.35, 0.1, [
    at(0.62, 0.012, 2.35, PI / 2, { warna: '#f4a261' }), at(-1.6, 0.012, 1.85, 0.4, { warna: '#2a9d8f' }),
    at(0.7, 0.012, -0.55, -0.3, { warna: '#e9c46a' }),
  ]),
  S24: aset('lampu-tl-plafon', 1.2, 0.1, 0.08, TL_POS.map((t) => at(t.x, t.y, t.z, 0))),
  S25: aset('stopkontak-sambungan', 0.3, 0.06, 0.04, [at(1.42, 0, 0.92, 0.3)], { stopDinding: freeze({ x: 2.095, y: 0.35, z: 0.25 }) }),
  S26: aset('poster-acara', 0.42, 0.01, 0.6, [
    at(0.68, 1.7, 2.992, PI, { poster: 0 }), at(2.093, 1.75, -2.35, -PI / 2, { poster: 1 }),
    at(0.45, 2.3, -2.993, 0, { poster: 2 }), at(-2.093, 1.75, 2.45, PI / 2, { poster: 3 }),
  ]),
  S27: aset('saklar-lampu', 0.08, 0.02, 0.12, [at(0.75, 1.35, -2.99, 0)]),
  S28: aset('stiker', 0.1, 0.002, 0.1, [
    at(1.3, 1.25, 2.548, PI, { stiker: 0 }), at(1.72, 0.55, 2.548, PI, { stiker: 3 }), at(0.35, 0.6, -2.655, 0, { stiker: 5 }),
  ]),
  S29: aset('jendela-nako-interior', 1.2, 0.1, 1.2, [at(WINDOW.x, WINDOW.sill, WINDOW.z, 0)]),
  S30: aset('pintu-sekre', 0.9, 0.05, 2.1, [at(DOOR.x0, 0, DOOR.z, 0, { buka: DOOR.openRad })]),
});

/** Barang tambahan tanpa ID katalog (dicatat di katalog oleh M7). */
export const EKSTRA = freeze({
  kursiLipat: at(1.12, 0, 1.2, PI / 2),
  kertas: freeze([at(1.6, 0.752, 1.62, 0.3), at(1.5, 0.752, 0.95, -0.2), at(-0.7, 0.014, 0.4, 0.8)]),
});

/** Model GLB final per ID aset (path relatif public/). Diisi di Task 22 setelah ekspor Blender berhasil. */
export const GLB_ASET = freeze({});

/** Gitar dipegang NPC: transform relatif pivot spine (lihat Humanoid.poses guitarStrum). */
export const GUITAR_HOLD = freeze({ pos: freeze([-0.23, 0.08, 0.2]), rot: freeze([0, PI, 1.22]) });

/** 12 map ordner (S10) di dua rak kaca lemari S09 (lemari menghadap −Z); koordinat ruang. */
export function ordnerSlots() {
  const L = ASET.S09.items[0];
  const out = [];
  [0.97, 1.36].forEach((y, row) => {
    for (let i = 0; i < 6; i += 1) {
      const k = row * 6 + i;
      out.push(freeze({ x: L.x - 0.3 + i * 0.12, y, z: L.z - 0.035, label: ORDNER[k].label, warna: ORDNER[k].warna, miring: k === 11 ? 0.12 : 0 }));
    }
  });
  return freeze(out);
}

// ---------- Tabrakan (persegi panjang ruang-lokal, sebelum diperluas radius pemain) ----------
export const SOLIDS = freeze([
  rect('meja', 1.45, 2.1, 0.3, 2.1),
  rect('lemari', 1.05, 1.95, 2.55, 3.0),
  rect('dispenser', 0.17, 0.53, -3.0, -2.64),
  rect('kipas', -2.0, -1.6, -1.2, -0.8),
  rect('kardus-depan', -2.1, -1.55, -2.35, -1.85),
  rect('kardus-belakang', -2.1, -1.58, 2.54, 3.0),
  rect('spanduk', -2.1, -1.78, -3.0, -2.6),
  rect('kursi', 0.9, 1.35, 0.98, 1.42),
  rect('daun-pintu', 0.86, 1.05, -3.0, -2.08),
  rect('tas', 1.75, 2.1, -2.05, -1.45),
]);
/** Perabot tinggi yang menghalangi kamera orang ketiga. */
export const TALL_SOLIDS = freeze([SOLIDS[1]]);

// ---------- NPC (3–6 hadir menurut jadwal) & slot aktivitas ----------
const npc = (id, nama, outfit, seed, hijab, rambut) => freeze({ id, nama, outfit, seed, hijab, rambut });
export const NPCS = freeze([
  npc('npc-1', 'Fajar', 'almamater', 101, null, 'buzz'),
  npc('npc-2', 'Nurul', 'almamater', 202, 0x2c3e50, null),
  npc('npc-3', 'Dimas', 'kaus', 303, null, 'helmet'),
  npc('npc-4', 'Sari', 'kaus', 404, 0x8e44ad, null),
  npc('npc-5', 'Rizky', 'almamater', 505, null, 'afro'),
  npc('npc-6', 'Putri', 'kaus', 606, 0x16a085, null),
]);
const slot = (id, x, z, yaw, poseId, block) => freeze({ id, x, z, yaw, poseId, block });
/** yaw = hadap NPC; `block` = radius penghalang bagi pemain (rebahan memanjang ±0,8 m). */
export const SLOTS = freeze([
  slot('rapat-1', -0.4, -0.25, 0, 'sitCrossLegged', 0.35),
  slot('rapat-2', 0.5, 0.7, -PI / 2, 'sitCrossLegged', 0.35),
  slot('rapat-3', -0.4, 1.65, PI, 'sitCrossLegged', 0.35),
  slot('rapat-4', -1.3, 0.7, PI / 2, 'sitCrossLegged', 0.35),
  slot('laptop', 1.12, 1.2, PI / 2, 'sitChairTyping', 0.4),
  slot('gitar', -1.35, 2.2, 2.58, 'guitarStrum', 0.4),
  slot('rebahan', -0.1, 2.35, -PI / 2, 'lieDown', 0.85),
  slot('whiteboard', 1.55, -1.2, PI / 2, 'writeBoard', 0.3),
  slot('ngobrol-1', 0.15, -1.85, PI / 2, 'standTalk', 0.3),
  slot('ngobrol-2', 0.95, -1.85, -PI / 2, 'standTalk', 0.3),
  slot('minum', 0.35, -2.2, 0, 'drinkCup', 0.3),
]);
/** Slot yang menyumbang gumaman obrolan. */
export const TALK_SLOTS = freeze(['rapat-1', 'rapat-2', 'rapat-3', 'rapat-4', 'whiteboard', 'ngobrol-1', 'ngobrol-2']);

// ---------- Barang interaktif (spec §8.2: ≥ 10) ----------
const item = (id, label, [x, y, z], radius, prompt) => freeze({ id, label, pos: freeze({ x, y, z }), radius, prompt });
export const INTERAKSI = freeze([
  item('papan-struktur', 'Papan struktur kabinet', [-0.6, 1.75, 2.95], 2.0, 'Lihat struktur pengurus'),
  item('papan-proker', 'Papan program kerja', [-2.05, 1.65, 0.9], 1.8, 'Baca program kerja'),
  item('piagam', 'Piagam & piala', [-2.05, 2.45, 0.9], 1.9, 'Lihat piagam & piala'),
  item('lemari-arsip', 'Lemari arsip', [1.5, 1.1, 2.5], 1.5, 'Buka lemari arsip'),
  item('gitar', 'Gitar akustik', [-1.8, 0.55, 1.95], 1.4, 'Genjreng gitar'),
  item('dispenser', 'Dispenser galon', [0.35, 0.95, -2.7], 1.3, 'Isi segelas air'),
  item('kipas', 'Kipas berdiri', [-1.8, 1.05, -1.0], 1.4, 'Nyalakan / matikan kipas'),
  item('saklar', 'Saklar lampu', [0.75, 1.35, -2.98], 1.1, 'Nyalakan / matikan lampu'),
  item('jendela', 'Jendela nako', [-0.9, 1.5, -2.98], 1.4, 'Intip selasar'),
  item('whiteboard', 'Papan tulis', [2.05, 1.45, -1.2], 1.6, 'Baca catatan rapat'),
  item('pintu', 'Pintu sekre', [1.35, 1.1, -2.98], 1.2, 'Keluar sekre'),
  item('kalender', 'Kalender', [-2.05, 1.6, -1.6], 1.3, 'Lihat kalender'),
]);
```

- [ ] **Step 4: Jalankan → PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/interiorSekre.test.js`
Expected: PASS. Bila tes "slot tidak di dalam perabot" gagal untuk slot tertentu, geser koordinat slot (bukan
perabot) sejauh minimum agar keluar dari persegi panjang, lalu ulangi.

- [ ] **Step 5: Commit**

```
git add src/interiors/sekre/data.js tests/interiorSekre.test.js
```
```
git commit -m "feat(interior): data sekre (ruang, penempatan S01–S30, slot & NPC, 12 interaksi, isi contoh organisasi yang mudah diganti)"
```

---

## Task 12: Util canvas + ruang (dinding kusam bekas selotip, keramik 40×40, plafon gipsum, selasar luar)

**Files:**
- Create: `src/interiors/sekre/canvas.js`, `src/interiors/sekre/room.js`

Kode visual: tanpa tes unit; diverifikasi di browser pada Task 20.

- [ ] **Step 1: `src/interiors/sekre/canvas.js`**

```js
/**
 * Util bersama interior sekre: kanvas & CanvasTexture, teks pas lebar, bungkus baris, selotip, derau kertas,
 * siluet "foto" pengurus, belah ketupat, bidang ber-UV atlas, dan warna vertex rata (material vertexColors
 * bersama → banyak placeholder tergabung menjadi satu draw call). Tanpa berkas gambar berlisensi.
 */
import * as THREE from 'three';

export const FONT = '"Inter Variable", "Segoe UI", Arial, sans-serif';
export const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
export const ATLAS_SIZE = 1024;

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** CanvasTexture sRGB + anisotropi; `repeat` untuk permukaan berulang (dinding, lantai, plafon). */
export function canvasTexture(canvas, renderer, { repeat = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  return tex;
}

/** Set c.font dengan ukuran terbesar ≤ size yang membuat teks muat maxWidth; kembalikan ukurannya. */
export function fitFont(c, text, maxWidth, { weight = 700, size = 32, family = FONT, min = 8 } = {}) {
  let s = size;
  c.font = `${weight} ${s}px ${family}`;
  while (s > min && c.measureText(String(text)).width > maxWidth) {
    s -= 1;
    c.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/** Pecah teks menjadi baris ≤ maxWidth memakai font c.font saat ini. */
export function wrapLines(c, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && c.measureText(next).width > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Potongan selotip bening kekuningan (miring `rot` rad) berpusat (x, y). */
export function tape(c, x, y, w, h, rot) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.fillStyle = 'rgba(236,226,186,0.78)';
  c.fillRect(-w / 2, -h / 2, w, h);
  c.strokeStyle = 'rgba(160,150,110,0.25)';
  c.strokeRect(-w / 2, -h / 2, w, h);
  c.restore();
}

/** Bintik halus kertas/papan. */
export function paperNoise(c, w, h, rnd, count = 700) {
  for (let i = 0; i < count; i += 1) {
    c.fillStyle = `rgba(${rnd() < 0.5 ? '120,110,90' : '255,255,255'},${0.03 + rnd() * 0.05})`;
    c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

/** Kotak "foto" pengurus: siluet kepala + bahu (bukan foto orang sungguhan). */
export function silhouette(c, x, y, w, h, bg = '#c9d3dc', fg = '#8796a5') {
  c.fillStyle = bg;
  c.fillRect(x, y, w, h);
  c.fillStyle = fg;
  c.beginPath();
  c.arc(x + w / 2, y + h * 0.4, Math.min(w, h) * 0.2, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(x + w / 2, y + h, w * 0.36, h * 0.36, 0, Math.PI, Math.PI * 2);
  c.fill();
}

export function diamond(c, x, y, rx, ry) {
  c.beginPath();
  c.moveTo(x, y - ry);
  c.lineTo(x + rx, y);
  c.lineTo(x, y + ry);
  c.lineTo(x - rx, y);
  c.closePath();
  c.fill();
}

/**
 * PlaneGeometry width × height (normal +Z) dengan UV menunjuk persegi [px, py, pw, ph] (piksel, origin kiri-atas)
 * pada atlas berukuran `size` (CanvasTexture flipY default: v = 1 di baris atas).
 */
export function atlasPlane(width, height, [px, py, pw, ph], size = ATLAS_SIZE) {
  const g = new THREE.PlaneGeometry(width, height);
  const uv = g.attributes.uv;
  const u0 = px / size;
  const u1 = (px + pw) / size;
  const vTop = 1 - py / size;
  const vBottom = 1 - (py + ph) / size;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), vBottom + uv.getY(i) * (vTop - vBottom));
  uv.needsUpdate = true;
  return g;
}

/** Tambahkan atribut warna vertex rata (warna sRGB hex/string → linear) ke geometri; kembalikan geometri. */
export function tint(geometry, color) {
  const col = new THREE.Color(color);
  const n = geometry.attributes.position.count;
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    data[i * 3] = col.r;
    data[i * 3 + 1] = col.g;
    data[i * 3 + 2] = col.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return geometry;
}
```

- [ ] **Step 2: `src/interiors/sekre/room.js`**

```js
/**
 * Ruang sekre (spec §8.2): dinding plester putih kusam dengan bekas selotip, lantai keramik krem 40 × 40 cm + plint
 * keramik, plafon gipsum (panel 1,2 m, sekrup, noda bocor di atlas papan), bukaan jendela nako & pintu di dinding
 * selasar (z = −3), dan latar selasar luar sederhana: lantai semen (basah saat hujan), atap, dinding ruang
 * tetangga, fasad deret seberang (canvas berpapan nama), rak sepatu & sandal di depan pintu, dan hujan yang
 * terlihat di kedua ujung selasar yang terbuka. Semua tekstur dari canvas (tanpa foto berlisensi).
 * Mengembalikan staticGroup (digabung per material oleh index.js) + dynamicGroup (hujan) + update().
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from '../../entities/util.js';
import { ROOM, WINDOW, DOOR, SELASAR, SELASAR_SEBERANG } from './data.js';
import { makeCanvas, canvasTexture, fitFont, diamond, tint, FONT } from './canvas.js';

const PLESTER_M = 2.0; // meter per ulangan tekstur plester
const KERAMIK_M = 0.8; // 2 × 2 ubin 40 cm
const PLAFON_M = 1.2;  // panel gipsum 1,2 m
const PLINT_H = 0.1;
const RAIN_DROPS = 320;
const RAIN_SPEED = 9;  // m/s
const DRY = new THREE.Color('#a29d90');
const WET = new THREE.Color('#6f6a60');

// ---------- Gambar tekstur ----------

export function drawPlester(c, w, h, seed = 11) {
  const rnd = makeRng(seed);
  c.fillStyle = '#e8e3d6';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i += 1) { // belang cat & noda transparan
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 6 + rnd() * 40;
    const tone = rnd() < 0.5 ? '255,252,240' : '196,188,168';
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${tone},${0.05 + rnd() * 0.08})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 6; i += 1) { // rembesan tipis dari bawah
    const x = rnd() * w;
    const len = h * (0.2 + rnd() * 0.5);
    const g = c.createLinearGradient(0, h - len, 0, h);
    g.addColorStop(0, 'rgba(150,140,115,0)');
    g.addColorStop(1, 'rgba(150,140,115,0.10)');
    c.fillStyle = g;
    c.fillRect(x, h - len, 2 + rnd() * 6, len);
  }
  for (let i = 0; i < 14; i += 1) { // bekas selotip (sebagian masih tersisa pitanya), tepi sobek
    const x = rnd() * (w - 60);
    const y = rnd() * (h - 30);
    const tw = 24 + rnd() * 46;
    const th = 9 + rnd() * 9;
    c.save();
    c.translate(x, y);
    c.rotate((rnd() - 0.5) * 0.5);
    const leftover = rnd() < 0.35;
    c.fillStyle = leftover ? 'rgba(226,212,160,0.75)' : 'rgba(250,244,220,0.55)';
    c.beginPath();
    c.moveTo(0, 0);
    for (let k = 0; k <= 6; k += 1) c.lineTo((tw * k) / 6, (k % 2) * 2);
    c.lineTo(tw, th);
    for (let k = 6; k >= 0; k -= 1) c.lineTo((tw * k) / 6, th - (k % 2) * 2);
    c.closePath();
    c.fill();
    if (!leftover) {
      c.strokeStyle = 'rgba(120,110,90,0.12)';
      c.lineWidth = 1;
      c.stroke();
    }
    c.restore();
  }
  for (let i = 0; i < 10; i += 1) { // lubang paku
    c.fillStyle = 'rgba(70,60,50,0.55)';
    c.beginPath();
    c.arc(rnd() * w, rnd() * h, 1.2 + rnd(), 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = 'rgba(90,80,70,0.12)';
  for (let i = 0; i < 8; i += 1) { // goresan
    const x = rnd() * w;
    const y = rnd() * h;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 12);
    c.stroke();
  }
}

export function drawKeramik(c, w, h, seed = 21) {
  const rnd = makeRng(seed);
  const n = 2;
  const tw = w / n;
  const th = h / n;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const v = (rnd() - 0.5) * 10;
      c.fillStyle = `rgb(${232 + v},${216 + v},${184 + v})`;
      c.fillRect(i * tw, j * th, tw, th);
      for (let k = 0; k < 900; k += 1) {
        c.fillStyle = `rgba(${rnd() < 0.5 ? '150,130,100' : '255,250,235'},${0.05 + rnd() * 0.08})`;
        c.fillRect(i * tw + rnd() * tw, j * th + rnd() * th, 1 + rnd() * 2, 1 + rnd() * 2);
      }
      const g = c.createLinearGradient(i * tw, j * th, (i + 1) * tw, (j + 1) * th);
      g.addColorStop(0, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0.04)');
      c.fillStyle = g;
      c.fillRect(i * tw, j * th, tw, th);
    }
  }
  c.strokeStyle = '#b9ad97'; // nat
  c.lineWidth = 3;
  for (let i = 0; i <= n; i += 1) {
    c.beginPath(); c.moveTo(i * tw, 0); c.lineTo(i * tw, h); c.stroke();
    c.beginPath(); c.moveTo(0, i * th); c.lineTo(w, i * th); c.stroke();
  }
}

export function drawPlafon(c, w, h, seed = 31) {
  const rnd = makeRng(seed);
  c.fillStyle = '#f0efe9';
  c.fillRect(0, 0, w, h);
  for (let k = 0; k < 1500; k += 1) {
    c.fillStyle = `rgba(180,175,160,${rnd() * 0.06})`;
    c.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
  c.strokeStyle = 'rgba(160,155,140,0.55)'; // sambungan papan gipsum
  c.lineWidth = 2;
  c.strokeRect(1, 1, w - 2, h - 2);
  c.fillStyle = 'rgba(120,115,100,0.5)'; // kepala sekrup
  for (let i = 1; i < 6; i += 1) {
    for (const y of [8, h - 8]) {
      c.beginPath();
      c.arc((w * i) / 6, y, 1.5, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function rosette(c, x, y, r, a, b) {
  c.fillStyle = a;
  for (let i = 0; i < 4; i += 1) {
    const ang = (i * Math.PI) / 2;
    c.beginPath();
    c.ellipse(x + Math.cos(ang) * r * 0.7, y + Math.sin(ang) * r * 0.7, r * 0.55, r * 0.3, ang, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = b;
  c.beginPath();
  c.arc(x, y, r * 0.35, 0, Math.PI * 2);
  c.fill();
}

/** Karpet ambal merah marun bermotif (S22, 3 × 4 m → kanvas 3:4). */
export function drawKarpet(c, w, h, seed = 41) {
  const rnd = makeRng(seed);
  const MARUN = '#6e1a26';
  const MARUN2 = '#8a2433';
  const EMAS = '#cf9e4a';
  const KREM = '#ecdcb6';
  const NAVY = '#1f2444';
  c.fillStyle = MARUN;
  c.fillRect(0, 0, w, h);
  const band = (inset, width, color) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.strokeRect(inset + width / 2, inset + width / 2, w - 2 * inset - width, h - 2 * inset - width);
  };
  band(0, 46, NAVY);
  band(10, 4, EMAS);
  band(36, 4, EMAS);
  band(46, 10, MARUN2);
  c.fillStyle = EMAS;
  for (let x = 30; x < w - 20; x += 36) { diamond(c, x, 23, 9, 13); diamond(c, x, h - 23, 9, 13); }
  for (let y = 30; y < h - 20; y += 36) { diamond(c, 23, y, 13, 9); diamond(c, w - 23, y, 13, 9); }
  const cx = w / 2;
  const cy = h / 2;
  for (const [r, col] of [[260, NAVY], [230, EMAS], [218, MARUN2], [170, KREM], [158, MARUN], [110, EMAS], [96, NAVY], [52, EMAS], [40, MARUN2]]) {
    c.fillStyle = col;
    diamond(c, cx, cy, r * 0.8, r);
  }
  for (const [x, y] of [[56, 56], [w - 56, 56], [56, h - 56], [w - 56, h - 56]]) {
    c.fillStyle = EMAS; diamond(c, x, y, 70, 90);
    c.fillStyle = MARUN2; diamond(c, x, y, 56, 72);
    c.fillStyle = NAVY; diamond(c, x, y, 26, 34);
  }
  for (let y = 110; y < h - 100; y += 72) {
    for (let x = 100; x < w - 90; x += 72) {
      const ox = x + (Math.round(y / 72) % 2) * 36;
      if (Math.hypot((ox - cx) / 0.8, y - cy) < 290) continue;
      rosette(c, ox, y, 10, EMAS, KREM);
    }
  }
  for (let k = 0; k < 7000; k += 1) { // serat
    c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,230,200'},${rnd() * 0.06})`;
    c.fillRect(rnd() * w, rnd() * h, 1, 2 + rnd() * 3);
  }
  const fade = c.createRadialGradient(cx, cy * 1.1, 40, cx, cy, h * 0.6); // pudar di area paling sering diduduki
  fade.addColorStop(0, 'rgba(255,220,200,0.10)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = fade;
  c.fillRect(0, 0, w, h);
}

/** Fasad deret sekre seberang selasar (latar jendela & pintu). */
export function drawFacade(c, w, h, names, seed = 51) {
  const rnd = makeRng(seed);
  c.fillStyle = '#e3dccb';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#b8ae98';
  c.fillRect(0, h * 0.94, w, h * 0.06);
  const rw = w / names.length;
  names.forEach((name, i) => {
    const x0 = i * rw;
    const doorX = x0 + rw * 0.2;
    const doorW = rw * 0.214;
    const doorTop = h * 0.38;
    c.fillStyle = '#5a3a22';
    c.fillRect(doorX, doorTop, doorW, h * 0.56);
    c.fillStyle = '#3e2816';
    c.fillRect(doorX + doorW * 0.08, doorTop + h * 0.04, doorW * 0.84, h * 0.2);
    c.fillStyle = '#d8c7a0';
    c.beginPath();
    c.arc(doorX + doorW * 0.85, doorTop + h * 0.3, 3, 0, Math.PI * 2);
    c.fill();
    const winX = x0 + rw * 0.55;
    const winW = rw * 0.286;
    const winH = h * 0.35;
    c.fillStyle = '#2c3a44';
    c.fillRect(winX, doorTop, winW, winH);
    c.strokeStyle = '#c9ccd0';
    c.lineWidth = 2;
    for (let k = 0; k <= 8; k += 1) {
      const y = doorTop + (winH * k) / 8;
      c.beginPath(); c.moveTo(winX, y); c.lineTo(winX + winW, y); c.stroke();
    }
    c.strokeRect(winX, doorTop, winW, winH);
    const signW = rw * 0.38;
    const signX = doorX + doorW / 2 - signW / 2;
    const signY = h * 0.24;
    c.fillStyle = i % 2 ? '#1d3557' : '#14213d';
    c.fillRect(signX, signY, signW, h * 0.09);
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    fitFont(c, name, signW * 0.92, { weight: 700, size: Math.round(h * 0.05) });
    c.fillText(name, signX + signW / 2, signY + h * 0.047);
    for (let k = 0; k < 2; k += 1) { // poster/stiker
      c.fillStyle = ['#e07a1f', '#2a9d8f', '#e9c46a', '#e76f51'][Math.floor(rnd() * 4)];
      c.fillRect(x0 + rw * (0.05 + rnd() * 0.08), h * (0.45 + rnd() * 0.15), rw * 0.07, h * 0.14);
    }
  });
  for (let k = 0; k < 120; k += 1) {
    c.fillStyle = `rgba(120,110,90,${rnd() * 0.06})`;
    c.fillRect(rnd() * w, rnd() * h, 10 + rnd() * 30, 4 + rnd() * 20);
  }
  c.textBaseline = 'alphabetic';
  c.font = `600 10px ${FONT}`;
}

// ---------- Geometri ----------

/** Kotak sejajar sumbu dari batas [x0,x1]×[y0,y1]×[z0,z1]. */
function slab(x0, x1, y0, y1, z0, z1) {
  return new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

/** UV dari koordinat dunia (proyeksi menurut normal dominan) agar tekstur menyambung antar potongan. */
function worldUv(geo, size) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (ay >= ax && ay >= az) uv.setXY(i, x / size, z / size);
    else if (ax >= az) uv.setXY(i, z / size, y / size);
    else uv.setXY(i, x / size, y / size);
  }
  uv.needsUpdate = true;
  return geo;
}

function merged(parts) {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

/** Dinding ruang (dengan bukaan jendela & pintu) + dinding tetangga & balok di sisi selasar. */
function wallGeometry() {
  const { w, d, h, wall: t } = ROOM;
  const hw = w / 2;
  const hd = d / 2;
  const top = WINDOW.sill + WINDOW.h;
  const wx0 = WINDOW.x - WINDOW.w / 2;
  const wx1 = WINDOW.x + WINDOW.w / 2;
  const front = (x0, x1, y0, y1) => slab(x0, x1, y0, y1, -hd - t, -hd);
  return merged([
    slab(-hw - t, -hw, 0, h, -hd - t, hd + t),
    slab(hw, hw + t, 0, h, -hd - t, hd + t),
    slab(-hw, hw, 0, h, hd, hd + t),
    front(-hw, wx0, 0, h),
    front(wx0, wx1, 0, WINDOW.sill),
    front(wx0, wx1, top, h),
    front(wx1, DOOR.x0, 0, h),
    front(DOOR.x0, DOOR.x1, DOOR.h, h),
    front(DOOR.x1, hw, 0, h),
    slab(SELASAR.ujungKiri, -hw - t, 0, SELASAR.tinggiAtap, -hd - t, -hd),  // dinding ruang tetangga kiri
    slab(hw + t, SELASAR.ujungKanan, 0, SELASAR.tinggiAtap, -hd - t, -hd),  // tetangga kanan (BEM, dst.)
    slab(-hw - t, hw + t, h, SELASAR.tinggiAtap, -hd - t, -hd),             // balok di atas dinding depan
  ].map((g) => worldUv(g, PLESTER_M)));
}

/** Lantai keramik + plint 10 cm (kecuali ambang pintu). */
function floorGeometry() {
  const { w, d } = ROOM;
  const hw = w / 2;
  const hd = d / 2;
  const e = 0.012;
  const floor = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  return merged([
    floor,
    slab(-hw, -hw + e, 0, PLINT_H, -hd, hd),
    slab(hw - e, hw, 0, PLINT_H, -hd, hd),
    slab(-hw, hw, 0, PLINT_H, hd - e, hd),
    slab(-hw, DOOR.x0, 0, PLINT_H, -hd, -hd + e),
    slab(DOOR.x1, hw, 0, PLINT_H, -hd, -hd + e),
  ].map((g) => worldUv(g, KERAMIK_M)));
}

function ceilingGeometry() {
  return worldUv(new THREE.PlaneGeometry(ROOM.w, ROOM.d).rotateX(Math.PI / 2).translate(0, ROOM.h, 0), PLAFON_M);
}

/** Atap selasar, rak sepatu & sandal di depan pintu (warna vertex). */
function selasarPropGeometry() {
  const { zDekat, zSeberang, ujungKiri, ujungKanan, tinggiAtap } = SELASAR;
  const parts = [];
  if (SELASAR.beratap) parts.push(tint(slab(ujungKiri, ujungKanan, tinggiAtap, tinggiAtap + 0.06, zSeberang, zDekat), '#8b939c'));
  const rx = 2.55;
  const rz = zDekat - 0.2;
  parts.push(tint(slab(rx - 0.6, rx + 0.6, 0, 0.03, rz - 0.17, rz + 0.17), '#6d4c41')); // rak sepatu P07
  parts.push(tint(slab(rx - 0.6, rx + 0.6, 0.42, 0.45, rz - 0.17, rz + 0.17), '#6d4c41'));
  parts.push(tint(slab(rx - 0.6, rx + 0.6, 0.85, 0.88, rz - 0.17, rz + 0.17), '#6d4c41'));
  for (const x of [rx - 0.58, rx + 0.58]) parts.push(tint(slab(x - 0.02, x + 0.02, 0, 0.9, rz - 0.17, rz + 0.17), '#5d4037'));
  const rnd = makeRng(61);
  for (let i = 0; i < 9; i += 1) { // sepatu di rak + sandal menumpuk di lantai (P08)
    const shelf = i < 5 ? 0.03 : 0.45;
    const x = rx - 0.5 + (i % 5) * 0.24;
    parts.push(tint(slab(x - 0.05, x + 0.05, shelf, shelf + 0.08, rz - 0.13, rz + 0.13), ['#212121', '#1565c0', '#e0e0e0', '#6d4c41', '#c62828'][i % 5]));
  }
  for (let i = 0; i < 7; i += 1) {
    const x = 1.1 + rnd() * 0.6;
    const z = zDekat - 0.35 - rnd() * 0.4;
    const g = slab(-0.05, 0.05, 0, 0.02, -0.12, 0.12).rotateY(rnd() * Math.PI).translate(x, i * 0.012, z);
    parts.push(tint(g, ['#1e88e5', '#43a047', '#212121', '#f9a825'][i % 4]));
  }
  return merged(parts);
}

function rainGeometry() {
  const rnd = makeRng(71);
  const pos = new Float32Array(RAIN_DROPS * 6);
  for (let i = 0; i < RAIN_DROPS; i += 1) {
    const left = i % 2 === 0;
    const x = left ? SELASAR.ujungKiri - 0.2 - rnd() * 1.2 : SELASAR.ujungKanan + 0.2 + rnd() * 1.2;
    const z = SELASAR.zSeberang + rnd() * (SELASAR.zDekat - SELASAR.zSeberang);
    const y = rnd() * 3.8;
    pos.set([x, y, z, x, y + 0.35, z], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

/**
 * @param {{renderer?: THREE.WebGLRenderer|null}} opts
 * @returns {{staticGroup: THREE.Group, dynamicGroup: THREE.Group, update(dt:number, s:{rain:number}): void}}
 */
export function buildRoom({ renderer = null } = {}) {
  const tex = (draw, w, h, seed) => {
    const canvas = makeCanvas(w, h);
    draw(canvas.getContext('2d'), w, h, seed);
    return canvasTexture(canvas, renderer, { repeat: true });
  };
  const plester = new THREE.MeshStandardMaterial({ map: tex(drawPlester, 512, 512, 11), roughness: 0.92 });
  const keramik = new THREE.MeshStandardMaterial({ map: tex(drawKeramik, 512, 512, 21), roughness: 0.32, envMapIntensity: 0.6 });
  const plafon = new THREE.MeshStandardMaterial({ map: tex(drawPlafon, 512, 512, 31), roughness: 0.95 });
  const facadeCanvas = makeCanvas(1024, 256);
  drawFacade(facadeCanvas.getContext('2d'), 1024, 256, SELASAR_SEBERANG);
  const facade = new THREE.MeshStandardMaterial({ map: canvasTexture(facadeCanvas, renderer), roughness: 0.9 });
  const selasarFloor = new THREE.MeshStandardMaterial({ color: DRY.clone(), roughness: 0.85 });
  const selasarProp = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const rainMat = new THREE.LineBasicMaterial({ color: 0xbcc8d6, transparent: true, opacity: 0, depthWrite: false });

  const staticGroup = new THREE.Group();
  staticGroup.name = 'sekre-ruang';
  const mesh = (geo, mat, name, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    staticGroup.add(m);
    return m;
  };
  mesh(wallGeometry(), plester, 'dinding');
  mesh(floorGeometry(), keramik, 'lantai', false);
  mesh(ceilingGeometry(), plafon, 'plafon');
  const { zDekat, zSeberang, ujungKiri, ujungKanan, tinggiAtap } = SELASAR;
  mesh(slab(ujungKiri, ujungKanan, -0.1, -0.02, zSeberang, zDekat), selasarFloor, 'selasar-lantai', false);
  const facadeGeo = new THREE.PlaneGeometry(ujungKanan - ujungKiri, tinggiAtap)
    .translate((ujungKiri + ujungKanan) / 2, tinggiAtap / 2, zSeberang);
  mesh(facadeGeo, facade, 'selasar-seberang');
  mesh(selasarPropGeometry(), selasarProp, 'selasar-props');

  const dynamicGroup = new THREE.Group();
  dynamicGroup.name = 'sekre-ruang-dinamis';
  const rain = new THREE.LineSegments(rainGeometry(), rainMat);
  rain.name = 'hujan-ujung-selasar';
  rain.frustumCulled = false;
  rain.visible = false;
  dynamicGroup.add(rain);

  let wet = 0;
  return {
    staticGroup,
    dynamicGroup,
    update(dt, { rain: intensity = 0 } = {}) {
      const d = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      const target = Math.max(0, Math.min(1, intensity));
      wet += (target - wet) * Math.min(1, d * (target > wet ? 0.5 : 0.05)); // basah cepat, kering lambat
      selasarFloor.color.copy(DRY).lerp(WET, wet);
      selasarFloor.roughness = 0.85 - 0.6 * wet;
      rain.visible = target > 0.02;
      rainMat.opacity = 0.55 * target;
      if (!rain.visible) return;
      const pos = rain.geometry.attributes.position;
      for (let i = 0; i < RAIN_DROPS; i += 1) {
        let y = pos.getY(i * 2) - RAIN_SPEED * d;
        if (y < 0) y += 3.8;
        pos.setY(i * 2, y);
        pos.setY(i * 2 + 1, y + 0.35);
      }
      pos.needsUpdate = true;
    },
  };
}
```

- [ ] **Step 3: Lint & commit**

Run: `npm run lint` → 0 galat.
```
git add src/interiors/sekre/canvas.js src/interiors/sekre/room.js
```
```
git commit -m "feat(interior): ruang sekre prosedural (plester kusam bekas selotip, keramik krem 40×40 + plint, plafon gipsum, selasar luar beratap dengan hujan di ujung)"
```

---

## Task 13: `boards.js` — papan canvas dari data (struktur, proker, whiteboard, atlas cetakan kecil)

**Files:**
- Create: `src/interiors/sekre/boards.js`

Kode visual: tanpa tes unit (isi papan berasal dari `data.js` yang sudah dites). Bingkai memakai material
bersama `prop`/`metal` (dibuat `createSekreMaterials` di Task 14) sehingga tergabung dengan perabot; semua
cetakan kecil memakai SATU material atlas → satu draw call.

- [ ] **Step 1: Tulis `src/interiors/sekre/boards.js`**

```js
/**
 * Papan & cetakan dinding sekre (spec §8.2; katalog S01–S06, kain bendera S08, label ordner S10, S26, S28):
 * digambar ke canvas dari data.js — bagan kabinet dengan kotak "foto" & nama, timeline proker di papan gabus,
 * whiteboard coretan rapat (tulisan tangan, bekas hapusan), dan satu atlas 1024² untuk cetakan kecil (kalender,
 * jadwal piket, 4 piagam, 4 poster, 12 label ordner, stiker, kain 3 bendera) → satu draw call;
 * noda bocor plafon memakai tekstur transparan sendiri.
 * Gambar ulang setelah font web siap (redrawWhenFontsReady) agar huruf Inter dipakai, bukan cadangan.
 */
import * as THREE from 'three';
import { makeRng } from '../../entities/util.js';
import {
  ASET, DOOR, ROOM, ORGANISASI, STRUKTUR, PROKER, BULAN_PROKER, CATATAN_RAPAT, KALENDER, PIKET, PIAGAM, POSTER,
  STIKER, DATA_CONTOH, TEKS, ordnerSlots,
} from './data.js';
import {
  makeCanvas, canvasTexture, fitFont, wrapLines, roundRect, tape, paperNoise, silhouette, atlasPlane, tint,
  FONT, HAND, ATLAS_SIZE,
} from './canvas.js';

/** Persegi atlas [x, y, w, h] piksel (origin kiri-atas). */
export const ATLAS = Object.freeze({
  kalender: [0, 0, 256, 384],
  piket: [256, 0, 256, 358],
  piagam: [[512, 0, 320, 240], [512, 240, 320, 240], [512, 480, 320, 240], [512, 720, 320, 240]],
  poster: [[0, 384, 224, 320], [224, 384, 224, 320], [0, 704, 224, 320], [224, 704, 224, 320]],
  ordner: Array.from({ length: 12 }, (_, i) => [448 + (i % 2) * 32, 384 + Math.floor(i / 2) * 64, 32, 64]),
  stiker: Array.from({ length: 6 }, (_, i) => [832 + (i % 2) * 96, Math.floor(i / 2) * 96, 96, 96]),
  stikerPintu: [832, 288, 192, 192],
  benderaOrganisasi: [832, 672, 192, 128],
  benderaUnri: [832, 800, 192, 128],
  benderaMerahPutih: [832, 928, 144, 96],
});

const BIRU_SPIDOL = '#1f4fa0';
const MERAH_SPIDOL = '#c0392b';
const HITAM_SPIDOL = '#222222';

function line(c, x1, y1, x2, y2, color = '#7b7364', width = 2.5) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

function pin(c, x, y, color = '#d32f2f') {
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath(); c.arc(x + 2, y + 3, 7, 0, Math.PI * 2); c.fill();
  c.fillStyle = color;
  c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.beginPath(); c.arc(x - 2, y - 2, 2.5, 0, Math.PI * 2); c.fill();
}

/** Kartu pengurus: kotak "foto" siluet + jabatan + nama. */
function personCard(c, x, y, cw, ch, jabatan, nama, accent) {
  c.fillStyle = 'rgba(0,0,0,0.12)';
  roundRect(c, x + 3, y + 4, cw, ch, 8);
  c.fill();
  c.fillStyle = '#ffffff';
  roundRect(c, x, y, cw, ch, 8);
  c.fill();
  c.fillStyle = accent;
  c.fillRect(x, y, 6, ch);
  silhouette(c, x + 12, y + 8, ch - 16, ch - 16);
  const tx = x + ch;
  const tw = cw - ch - 8;
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = accent;
  fitFont(c, jabatan.toUpperCase(), tw, { weight: 700, size: 13 });
  c.fillText(jabatan.toUpperCase(), tx, y + ch * 0.42);
  c.fillStyle = '#1d1d1d';
  fitFont(c, nama, tw, { weight: 700, size: 18 });
  c.fillText(nama, tx, y + ch * 0.75);
}

/** S01 bagan kabinet (1024 × 683 untuk papan 1,8 × 1,2 m). */
export function drawStruktur(c, w, h) {
  const rnd = makeRng(7);
  c.fillStyle = '#f4efe3';
  c.fillRect(0, 0, w, h);
  paperNoise(c, w, h, rnd, 1200);
  c.fillStyle = ORGANISASI.warna;
  c.fillRect(0, 0, w, 86);
  c.fillStyle = ORGANISASI.warna2;
  c.fillRect(0, 86, w, 6);
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  fitFont(c, 'STRUKTUR KEPENGURUSAN', w - 80, { weight: 800, size: 36 });
  c.fillText('STRUKTUR KEPENGURUSAN', w / 2, 32);
  const sub = `${ORGANISASI.nama} · ${ORGANISASI.kabinet} · ${ORGANISASI.periode}`.toUpperCase();
  fitFont(c, sub, w - 80, { weight: 600, size: 20 });
  c.fillText(sub, w / 2, 66);

  const cw = 230;
  const ch = 70;
  const row = (list, y) => list.map((_, i) => w / 2 + (i - (list.length - 1) / 2) * (cw + 30) - cw / 2).map((x) => ({ x, y }));
  const y1 = 108;
  const y2 = y1 + ch + 36;
  const y3 = y2 + ch + 52;
  const inti = row(STRUKTUR.inti, y1);
  const sekben = row(STRUKTUR.sekben, y2);
  line(c, w / 2, y1 + ch, w / 2, y3 - 22);
  line(c, sekben[0].x + cw / 2, y2 - 16, sekben.at(-1).x + cw / 2, y2 - 16);
  for (const s of sekben) line(c, s.x + cw / 2, y2 - 16, s.x + cw / 2, y2);
  STRUKTUR.inti.forEach((p, i) => personCard(c, inti[i].x, y1, cw, ch, p.jabatan, p.nama, ORGANISASI.warna));
  STRUKTUR.sekben.forEach((p, i) => personCard(c, sekben[i].x, y2, cw, ch, p.jabatan, p.nama, '#3d5a80'));
  const n = STRUKTUR.divisi.length;
  const dw = (w - 40 - (n - 1) * 12) / n;
  line(c, 20 + dw / 2, y3 - 22, w - 20 - dw / 2, y3 - 22);
  STRUKTUR.divisi.forEach((d, i) => {
    const x = 20 + i * (dw + 12);
    line(c, x + dw / 2, y3 - 22, x + dw / 2, y3);
    personCard(c, x, y3, dw, ch, `Koor. ${d.nama}`, d.koor, '#2a9d8f');
    c.fillStyle = '#3b3b3b';
    c.textAlign = 'left';
    d.anggota.forEach((a, k) => {
      fitFont(c, `• ${a}`, dw - 16, { weight: 500, size: 15 });
      c.fillText(`• ${a}`, x + 14, y3 + ch + 24 + k * 21);
    });
  });
  c.fillStyle = '#6b6153';
  c.textAlign = 'center';
  fitFont(c, `“${ORGANISASI.motto}”`, w - 360, { weight: 600, size: 22 });
  c.fillText(`“${ORGANISASI.motto}”`, w / 2 - 80, h - 70);
  tape(c, 26, 18, 70, 22, -0.6);
  tape(c, w - 26, 18, 70, 22, 0.6);
  tape(c, 26, h - 18, 70, 22, 0.6);
  tape(c, w - 26, h - 18, 70, 22, -0.6);
  c.save(); // catatan tempel
  c.translate(w - 160, h - 120);
  c.rotate(0.05);
  c.fillStyle = '#fff59d';
  c.fillRect(0, 0, 124, 84);
  c.fillStyle = BIRU_SPIDOL;
  c.font = `18px ${HAND}`;
  c.textAlign = 'left';
  c.fillText('foto blm', 10, 30);
  c.fillText('dicetak!!', 10, 58);
  c.restore();
  if (DATA_CONTOH) {
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.font = `500 11px ${FONT}`;
    c.textAlign = 'left';
    c.fillText(TEKS.contoh, 14, h - 8);
  }
}

const STATUS = Object.freeze({
  selesai: { warna: '#2e7d32', teks: '✓ selesai' },
  berjalan: { warna: '#ef6c00', teks: '● berjalan' },
  rencana: { warna: '#757575', teks: '○ rencana' },
});

/** S02 timeline proker di papan gabus (1024 × 683 untuk 1,5 × 1,0 m). */
export function drawProker(c, w, h) {
  const rnd = makeRng(9);
  c.fillStyle = '#c49a6c';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i += 1) {
    c.fillStyle = `rgba(${rnd() < 0.5 ? '90,60,30' : '235,200,150'},${0.15 + rnd() * 0.2})`;
    c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  c.fillStyle = '#fffdf6';
  c.fillRect(w / 2 - 260, 22, 520, 76);
  c.fillStyle = ORGANISASI.warna;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  fitFont(c, 'PROGRAM KERJA', 480, { weight: 800, size: 34 });
  c.fillText('PROGRAM KERJA', w / 2, 48);
  c.fillStyle = '#444444';
  const sub = `${ORGANISASI.kabinet} · ${ORGANISASI.periode}`;
  fitFont(c, sub, 480, { weight: 600, size: 16 });
  c.fillText(sub, w / 2, 80);
  pin(c, w / 2, 26);
  const x0 = 60;
  const x1 = w - 60;
  const ty = 360;
  line(c, x0, ty, x1, ty, '#2b2b2b', 5);
  c.fillStyle = '#2b2b2b';
  c.beginPath(); c.moveTo(x1 + 18, ty); c.lineTo(x1, ty - 10); c.lineTo(x1, ty + 10); c.closePath(); c.fill();
  const monthX = (i) => x0 + ((x1 - x0) * (i + 0.5)) / BULAN_PROKER.length;
  BULAN_PROKER.forEach((b, i) => {
    const x = monthX(i);
    line(c, x, ty - 8, x, ty + 8, '#2b2b2b', 3);
    c.fillStyle = '#fffdf6';
    c.fillRect(x - 22, ty + 14, 44, 22);
    c.fillStyle = '#333333';
    c.font = `700 14px ${FONT}`;
    c.fillText(b, x, ty + 25);
  });
  PROKER.forEach((pk, i) => {
    const x = monthX(BULAN_PROKER.indexOf(pk.bulan));
    const up = i % 2 === 0;
    const cw = 150;
    const chh = 104;
    const cx = Math.min(w - cw - 10, Math.max(10, x - cw / 2));
    const cy = up ? 128 : 430;
    line(c, x, ty, x, up ? cy + chh : cy, 'rgba(40,40,40,0.6)', 2);
    const st = STATUS[pk.status] ?? STATUS.rencana;
    c.save();
    c.translate(cx + cw / 2, cy + chh / 2);
    c.rotate((rnd() - 0.5) * 0.06);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(-cw / 2 + 3, -chh / 2 + 4, cw, chh);
    c.fillStyle = '#fffef7';
    c.fillRect(-cw / 2, -chh / 2, cw, chh);
    c.fillStyle = st.warna;
    c.fillRect(-cw / 2, -chh / 2, cw, 8);
    c.fillStyle = '#222222';
    c.textAlign = 'center';
    c.font = `700 16px ${FONT}`;
    wrapLines(c, pk.nama, cw - 16).slice(0, 3).forEach((l, k) => c.fillText(l, 0, -chh / 2 + 30 + k * 19));
    c.fillStyle = st.warna;
    c.font = `700 13px ${FONT}`;
    c.fillText(st.teks, 0, chh / 2 - 14);
    c.restore();
    pin(c, cx + cw / 2, cy + 6, ['#d32f2f', '#1976d2', '#388e3c', '#fbc02d'][i % 4]);
    if (pk.catatan) {
      c.fillStyle = MERAH_SPIDOL;
      c.font = `24px ${HAND}`;
      c.fillText(pk.catatan, cx + cw / 2 + 40, up ? cy + chh + 28 : cy - 14);
    }
  });
  c.textAlign = 'left';
  c.fillStyle = '#fffdf6';
  c.fillRect(20, h - 54, 360, 36);
  let lx = 32;
  for (const st of Object.values(STATUS)) {
    c.fillStyle = st.warna;
    c.font = `700 14px ${FONT}`;
    c.fillText(st.teks, lx, h - 36);
    lx += 112;
  }
  if (DATA_CONTOH) {
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.font = `500 11px ${FONT}`;
    c.textAlign = 'right';
    c.fillText(TEKS.contoh, w - 14, h - 8);
  }
}

/** S03 whiteboard coretan rapat (1024 × 768 untuk 1,2 × 0,9 m). */
export function drawWhiteboard(c, w, h) {
  const rnd = makeRng(13);
  c.fillStyle = '#f7f8f6';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i += 1) { // bekas hapusan
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 60 + rnd() * 140;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(120,130,150,0.07)');
    g.addColorStop(1, 'rgba(120,130,150,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = 'rgba(60,80,120,0.08)'; // tulisan lama yang tidak terhapus sempurna
  c.font = `40px ${HAND}`;
  c.fillText('kas bulan lalu: 350rb', 520, 300);
  c.fillText('rapat evaluasi', 80, 690);
  const R = CATATAN_RAPAT;
  c.fillStyle = BIRU_SPIDOL;
  fitFont(c, R.judul, w - 340, { weight: 400, size: 46, family: HAND });
  c.fillText(R.judul, 40, 72);
  c.strokeStyle = BIRU_SPIDOL;
  c.lineWidth = 3;
  c.beginPath();
  for (let x = 40; x < w - 320; x += 20) c.lineTo(x, 86 + Math.sin(x / 14) * 3);
  c.stroke();
  c.fillStyle = HITAM_SPIDOL;
  c.font = `26px ${HAND}`;
  c.fillText(R.tanggal, 44, 126);
  R.poin.forEach((pt, i) => {
    c.fillStyle = pt.includes('!!') ? MERAH_SPIDOL : HITAM_SPIDOL;
    fitFont(c, `- ${pt}`, w - 120, { weight: 400, size: 30, family: HAND });
    c.fillText(`- ${pt}`, 50, 182 + i * 56);
  });
  const tx = 50;
  const ty = 488;
  const colW = 210;
  const rowH = 52;
  c.strokeStyle = BIRU_SPIDOL;
  c.lineWidth = 3;
  c.strokeRect(tx, ty, colW * R.tabel.kolom.length, rowH * 2);
  for (let k = 1; k < R.tabel.kolom.length; k += 1) line(c, tx + colW * k, ty, tx + colW * k, ty + rowH * 2, BIRU_SPIDOL, 3);
  line(c, tx, ty + rowH, tx + colW * R.tabel.kolom.length, ty + rowH, BIRU_SPIDOL, 3);
  R.tabel.kolom.forEach((k, i) => {
    c.fillStyle = BIRU_SPIDOL;
    c.font = `28px ${HAND}`;
    c.fillText(k, tx + 14 + colW * i, ty + 36);
    c.fillStyle = HITAM_SPIDOL;
    c.fillText(R.tabel.isi[i], tx + 14 + colW * i, ty + rowH + 36);
  });
  c.fillStyle = MERAH_SPIDOL;
  c.font = `34px ${HAND}`;
  c.fillText(R.tenggat, w - 400, 548);
  c.strokeStyle = MERAH_SPIDOL;
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(w - 245, 536, 175, 40, -0.04, 0, Math.PI * 2);
  c.stroke();
  line(c, 640, 310, w - 300, 500, MERAH_SPIDOL, 3); // panah dari poin proposal
  c.beginPath(); c.moveTo(w - 300, 500); c.lineTo(w - 320, 482); c.moveTo(w - 300, 500); c.lineTo(w - 326, 500); c.stroke();
  c.strokeStyle = HITAM_SPIDOL; // orang lidi + semangat
  c.lineWidth = 3;
  const sx = 800;
  const sy = 640;
  c.beginPath(); c.arc(sx, sy - 40, 14, 0, Math.PI * 2); c.stroke();
  line(c, sx, sy - 26, sx, sy + 20, HITAM_SPIDOL, 3);
  line(c, sx, sy - 10, sx - 24, sy - 30, HITAM_SPIDOL, 3);
  line(c, sx, sy - 10, sx + 24, sy - 30, HITAM_SPIDOL, 3);
  line(c, sx, sy + 20, sx - 16, sy + 50, HITAM_SPIDOL, 3);
  line(c, sx, sy + 20, sx + 16, sy + 50, HITAM_SPIDOL, 3);
  c.fillStyle = BIRU_SPIDOL;
  c.font = `30px ${HAND}`;
  c.fillText(R.semangat, sx + 40, sy);
  c.save();
  c.translate(w - 260, 50);
  c.rotate(0.08);
  c.fillStyle = MERAH_SPIDOL;
  c.font = `24px ${HAND}`;
  c.fillText(R.sudut, 0, 0);
  c.restore();
}

// ---------- Atlas cetakan kecil ----------

function drawKalender(c, [x, y, w, h]) {
  const k = KALENDER;
  c.save();
  c.translate(x, y);
  c.fillStyle = '#fbfaf6';
  c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, 0, h * 0.36);
  g.addColorStop(0, '#6fbfe8');
  g.addColorStop(1, '#d7eef8');
  c.fillStyle = g;
  c.fillRect(8, 8, w - 16, h * 0.34);
  c.fillStyle = '#2f5d50';
  c.fillRect(8, h * 0.29, w - 16, h * 0.05);
  c.fillStyle = '#efe6d2';
  c.fillRect(w * 0.3, h * 0.17, w * 0.4, h * 0.12);
  c.fillStyle = '#c0392b';
  c.fillRect(w * 0.26, h * 0.15, w * 0.48, h * 0.03);
  c.fillStyle = '#c0392b';
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  fitFont(c, k.bulan, w - 20, { weight: 800, size: 24 });
  c.fillText(k.bulan, w / 2, h * 0.43);
  const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const gx = 10;
  const gy = h * 0.48;
  const cw = (w - 20) / 7;
  const chh = (h * 0.48) / 6;
  c.font = `700 12px ${FONT}`;
  days.forEach((d, i) => {
    c.fillStyle = i === 6 ? '#c0392b' : '#333333';
    c.fillText(d, gx + cw * i + cw / 2, gy);
  });
  c.font = `600 15px ${FONT}`;
  for (let day = 1; day <= k.jumlahHari; day += 1) {
    const cell = k.hariMulai + day - 1;
    const col = cell % 7;
    const rowI = Math.floor(cell / 7);
    const cx = gx + cw * col + cw / 2;
    const cy = gy + 20 + chh * rowI;
    c.fillStyle = col === 6 || k.libur.includes(day) ? '#c0392b' : '#222222';
    c.fillText(String(day), cx, cy);
    if (k.tanda[day]) {
      c.strokeStyle = 'rgba(200,30,30,0.85)';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(cx, cy - 5, cw * 0.44, chh * 0.42, 0.2, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.fillStyle = BIRU_SPIDOL;
  c.font = `16px ${HAND}`;
  c.textAlign = 'left';
  c.fillText(k.coretan, 12, h - 10);
  c.restore();
}

function drawPiket(c, [x, y, w, h]) {
  c.save();
  c.translate(x, y);
  c.fillStyle = '#fffef8';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#264653';
  c.fillRect(0, 0, w, 40);
  c.fillStyle = '#ffffff';
  c.font = `800 18px ${FONT}`;
  c.textAlign = 'center';
  c.fillText('JADWAL PIKET', w / 2, 27);
  const rowH = (h - 60) / PIKET.length;
  PIKET.forEach((pk, i) => {
    const ry = 50 + i * rowH;
    c.fillStyle = i % 2 ? '#f1ede2' : '#fffef8';
    c.fillRect(6, ry, w - 12, rowH - 2);
    c.textAlign = 'left';
    c.fillStyle = '#264653';
    c.font = `800 14px ${FONT}`;
    c.fillText(pk.hari.toUpperCase(), 14, ry + 20);
    c.fillStyle = '#333333';
    fitFont(c, pk.nama.join(', '), w - 70, { weight: 500, size: 13 });
    c.fillText(pk.nama.join(', '), 14, ry + 40);
    if (pk.centang) {
      c.strokeStyle = '#2a9d8f';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(w - 36, ry + 24); c.lineTo(w - 28, ry + 32); c.lineTo(w - 14, ry + 14); c.stroke();
    }
  });
  c.restore();
}

function drawPiagam(c, [x, y, w, h], pg) {
  c.save();
  c.translate(x, y);
  c.fillStyle = '#fbf6e4';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#b8892f';
  c.lineWidth = 6;
  c.strokeRect(10, 10, w - 20, h - 20);
  c.lineWidth = 1.5;
  c.strokeRect(18, 18, w - 36, h - 36);
  c.textAlign = 'center';
  c.fillStyle = '#7a5a16';
  fitFont(c, pg.judul, w - 60, { weight: 800, size: 22 });
  c.fillText(pg.judul, w / 2, 54);
  c.fillStyle = '#555555';
  c.font = `500 12px ${FONT}`;
  c.fillText('diberikan kepada', w / 2, 78);
  c.fillStyle = '#222222';
  fitFont(c, pg.kepada, w - 60, { weight: 700, size: 17 });
  c.fillText(pg.kepada, w / 2, 102);
  c.font = `500 13px ${FONT}`;
  wrapLines(c, pg.isi, w - 70).slice(0, 3).forEach((l, i) => c.fillText(l, w / 2, 128 + i * 17));
  c.strokeStyle = 'rgba(40,70,160,0.55)';
  c.lineWidth = 3;
  c.beginPath(); c.arc(w * 0.3, h - 50, 22, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#1f2f6f';
  c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(w * 0.58, h - 44); c.bezierCurveTo(w * 0.64, h - 70, w * 0.7, h - 28, w * 0.78, h - 56); c.stroke();
  c.fillStyle = '#444444';
  c.font = `500 11px ${FONT}`;
  c.fillText(String(pg.tahun), w * 0.68, h - 24);
  c.restore();
}

function drawPoster(c, [x, y, w, h], ps, rnd) {
  c.save();
  c.translate(x, y);
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, ps.warna);
  g.addColorStop(1, ps.warna2);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.22;
  c.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i += 1) {
    c.beginPath(); c.arc(rnd() * w, rnd() * h, 10 + rnd() * 40, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.font = `700 11px ${FONT}`;
  c.fillText(ORGANISASI.nama.toUpperCase(), w / 2, 22);
  fitFont(c, ps.judul, w - 24, { weight: 900, size: 34 });
  c.fillText(ps.judul, w / 2, h * 0.36);
  c.font = `600 15px ${FONT}`;
  wrapLines(c, ps.sub, w - 30).slice(0, 3).forEach((l, i) => c.fillText(l, w / 2, h * 0.36 + 30 + i * 19));
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(0, h - 64, w, 64);
  c.fillStyle = '#ffffff';
  c.font = `700 15px ${FONT}`;
  c.fillText(ps.tanggal, w / 2, h - 38);
  c.font = `500 12px ${FONT}`;
  c.fillText(ps.tempat, w / 2, h - 18);
  c.fillStyle = 'rgba(255,250,235,0.22)'; // pudar terkena cahaya
  c.fillRect(0, 0, w, h);
  tape(c, 16, 10, 40, 14, -0.5);
  tape(c, w - 16, 10, 40, 14, 0.5);
  c.restore();
}

function drawOrdnerLabel(c, [x, y, w, h], label) {
  c.save();
  c.translate(x, y);
  c.fillStyle = '#f5f1e6';
  c.fillRect(2, 2, w - 4, h - 4);
  c.strokeStyle = '#999999';
  c.strokeRect(2, 2, w - 4, h - 4);
  c.translate(w / 2, h / 2);
  c.rotate(-Math.PI / 2);
  c.fillStyle = '#1a1a1a';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  fitFont(c, label, h - 8, { weight: 800, size: 14 });
  c.fillText(label, 0, 0);
  c.restore();
}

function drawStiker(c, [x, y, w, h], text, i) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = w * 0.44;
  c.save();
  if (text === 'NO SMOKING') {
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#424242';
    c.fillRect(cx - r * 0.55, cy - 4, r * 1.1, 8);
    c.strokeStyle = '#d32f2f';
    c.lineWidth = 7;
    c.beginPath(); c.arc(cx, cy, r - 4, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(cx - r * 0.65, cy - r * 0.65); c.lineTo(cx + r * 0.65, cy + r * 0.65); c.stroke();
  } else {
    c.fillStyle = ['#6fbfe8', '#ffffff', '#f4a261', '#2a9d8f', ORGANISASI.warna, '#e9c46a'][i % 6];
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = i === 1 ? '#222222' : '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const lines = text.split(' ');
    lines.forEach((l, k) => {
      fitFont(c, l, r * 1.6, { weight: 800, size: 16 });
      c.fillText(l, cx, cy + (k - (lines.length - 1) / 2) * 17);
    });
  }
  c.restore();
}

function drawStikerPintu(c, [x, y, w, h]) {
  c.save();
  c.fillStyle = '#ffffff';
  roundRect(c, x + 6, y + 6, w - 12, h - 12, 12);
  c.fill();
  c.strokeStyle = ORGANISASI.warna;
  c.lineWidth = 5;
  c.stroke();
  c.fillStyle = ORGANISASI.warna;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  fitFont(c, 'HARAP KETUK PINTU', w - 30, { weight: 800, size: 22 });
  c.fillText('HARAP KETUK PINTU', x + w / 2, y + h * 0.36);
  c.fillStyle = '#333333';
  fitFont(c, 'LEPAS ALAS KAKI', w - 30, { weight: 700, size: 18 });
  c.fillText('LEPAS ALAS KAKI', x + w / 2, y + h * 0.6);
  c.font = `14px ${HAND}`;
  c.fillStyle = BIRU_SPIDOL;
  c.fillText('makasih :)', x + w / 2, y + h * 0.8);
  c.restore();
}

function drawNoda(c, [x, y, w, h]) {
  c.save();
  const cx = x + w / 2;
  const cy = y + h / 2;
  for (let k = 0; k < 4; k += 1) { // cincin noda rembesan atap
    const r = (w / 2) * (1 - k * 0.2);
    const g = c.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
    g.addColorStop(0, 'rgba(150,120,70,0)');
    g.addColorStop(0.85, `rgba(150,120,70,${0.18 + k * 0.04})`);
    g.addColorStop(1, 'rgba(150,120,70,0)');
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
  }
  c.restore();
}

/** Lambang disederhanakan: segi lima hijau lumut + perahu layar kuning emas (riset §6), BUKAN reproduksi resmi. */
function drawLambangSederhana(c, cx, cy, r) {
  c.fillStyle = '#4b6b2a';
  c.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  c.strokeStyle = '#e8c547';
  c.lineWidth = r * 0.08;
  c.stroke();
  c.fillStyle = '#e8c547';
  c.beginPath();
  c.moveTo(cx - r * 0.55, cy + r * 0.2);
  c.quadraticCurveTo(cx, cy + r * 0.55, cx + r * 0.55, cy + r * 0.2);
  c.closePath();
  c.fill();
  c.fillRect(cx - r * 0.03, cy - r * 0.5, r * 0.06, r * 0.7);
  c.beginPath();
  c.moveTo(cx + r * 0.03, cy - r * 0.45);
  c.lineTo(cx + r * 0.4, cy + r * 0.1);
  c.lineTo(cx + r * 0.03, cy + r * 0.1);
  c.closePath();
  c.fill();
}

function drawBendera(c) {
  const [ox, oy, ow, oh] = ATLAS.benderaOrganisasi;
  c.fillStyle = ORGANISASI.warna;
  c.fillRect(ox, oy, ow, oh);
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  fitFont(c, ORGANISASI.singkatan, ow - 30, { weight: 900, size: 48 });
  c.fillText(ORGANISASI.singkatan, ox + ow / 2, oy + oh / 2);
  const [ux, uy, uw, uh] = ATLAS.benderaUnri; // warna dasar biru langit = [INFERENSI]
  c.fillStyle = '#6fbfe8';
  c.fillRect(ux, uy, uw, uh);
  drawLambangSederhana(c, ux + uw / 2, uy + uh * 0.42, uh * 0.3);
  c.fillStyle = '#123a5c';
  fitFont(c, 'UNIVERSITAS RIAU', uw - 20, { weight: 800, size: 16 });
  c.fillText('UNIVERSITAS RIAU', ux + uw / 2, uy + uh * 0.86);
  const [mx, my, mw, mh] = ATLAS.benderaMerahPutih;
  c.fillStyle = '#ce1126';
  c.fillRect(mx, my, mw, mh / 2);
  c.fillStyle = '#ffffff';
  c.fillRect(mx, my + mh / 2, mw, mh / 2);
}

/** Atlas 1024² semua cetakan kecil. */
export function drawAtlas(c, w, h) {
  const rnd = makeRng(17);
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, w, h);
  drawKalender(c, ATLAS.kalender);
  drawPiket(c, ATLAS.piket);
  PIAGAM.forEach((pg, i) => drawPiagam(c, ATLAS.piagam[i], pg));
  POSTER.forEach((ps, i) => drawPoster(c, ATLAS.poster[i], ps, rnd));
  ordnerSlots().forEach((o, i) => drawOrdnerLabel(c, ATLAS.ordner[i], o.label));
  STIKER.forEach((s, i) => drawStiker(c, ATLAS.stiker[i], s, i));
  drawStikerPintu(c, ATLAS.stikerPintu);
  drawBendera(c);
}

// ---------- Mesh ----------

/** Bidang dinding: rotasi y = hadap (normal +Z menghadap arah hadap). */
function wallPlane(geo, mat, it, offset = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(it.x + Math.sin(it.hadap) * offset, it.y, it.z + Math.cos(it.hadap) * offset);
  m.rotation.y = it.hadap;
  m.receiveShadow = true;
  return m;
}

/**
 * Bingkai persegi (4 batang) di bidang XY lokal, menghadap `hadap`. Batang = Mesh terpisah dengan material
 * bersama; semuanya tergabung per material oleh mergeStatic (index.js), jadi tidak menambah draw call.
 */
function frameMesh(w, h, depth, bar, color, mat, it) {
  const g = new THREE.Group();
  for (const [bw, bh, x, y] of [[w, bar, 0, h / 2 - bar / 2], [w, bar, 0, -h / 2 + bar / 2], [bar, h, -w / 2 + bar / 2, 0], [bar, h, w / 2 - bar / 2, 0]]) {
    const m = new THREE.Mesh(tint(new THREE.BoxGeometry(bw, bh, depth).translate(x, y, 0), color), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  g.position.set(it.x, it.y, it.z);
  g.rotation.y = it.hadap;
  return g;
}

/**
 * @param {{renderer?: THREE.WebGLRenderer|null, materials: {prop: THREE.Material, metal: THREE.Material}}} opts
 * @returns {{group: THREE.Group, redrawWhenFontsReady(isCancelled: () => boolean): Promise<void>}}
 */
export function buildBoards({ renderer = null, materials }) {
  const group = new THREE.Group();
  group.name = 'sekre-papan';
  const surfaces = [];
  const surface = (w, h, draw) => {
    const canvas = makeCanvas(w, h);
    draw(canvas.getContext('2d'), w, h);
    const tex = canvasTexture(canvas, renderer);
    surfaces.push({ canvas, tex, draw, w, h });
    return tex;
  };
  const board = (map, roughness) => new THREE.MeshStandardMaterial({ map, roughness });
  const strukturMat = board(surface(1024, 683, drawStruktur), 0.85);
  const prokerMat = board(surface(1024, 683, drawProker), 0.95);
  const wbMat = board(surface(1024, 768, drawWhiteboard), 0.35);
  const atlasMat = new THREE.MeshStandardMaterial({
    map: surface(ATLAS_SIZE, ATLAS_SIZE, drawAtlas), roughness: 0.8, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });

  const S01 = ASET.S01.items[0];
  group.add(frameMesh(1.84, 1.24, 0.03, 0.025, '#b0b7bd', materials.metal, S01));
  group.add(wallPlane(new THREE.PlaneGeometry(1.8, 1.2), strukturMat, S01, 0.016));
  const S02 = ASET.S02.items[0];
  group.add(frameMesh(1.54, 1.04, 0.035, 0.03, '#8d6e63', materials.prop, S02));
  group.add(wallPlane(new THREE.PlaneGeometry(1.5, 1.0), prokerMat, S02, 0.016));
  const S03 = ASET.S03.items[0];
  group.add(frameMesh(1.24, 0.94, 0.05, 0.025, '#c9ccd0', materials.metal, S03));
  group.add(wallPlane(new THREE.PlaneGeometry(1.2, 0.9), wbMat, S03, 0.02));
  const tray = new THREE.Group(); // baki spidol + 2 spidol + penghapus
  tray.position.set(S03.x, S03.y - 0.47, S03.z);
  tray.rotation.y = S03.hadap;
  for (const g of [
    tint(new THREE.BoxGeometry(1.0, 0.015, 0.06).translate(0, 0, 0.04), '#c9ccd0'),
    tint(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 8).rotateZ(Math.PI / 2).translate(-0.2, 0.017, 0.05), '#1565c0'),
    tint(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 8).rotateZ(Math.PI / 2).translate(-0.04, 0.017, 0.05), '#c62828'),
    tint(new THREE.BoxGeometry(0.13, 0.03, 0.05).translate(0.25, 0.022, 0.045), '#37474f'),
  ]) tray.add(new THREE.Mesh(g, materials.prop));
  group.add(tray);

  const atlasMesh = (w, h, rect, it, offset = 0) => group.add(wallPlane(atlasPlane(w, h, rect), atlasMat, it, offset));
  atlasMesh(0.4, 0.6, ATLAS.kalender, ASET.S04.items[0]);
  atlasMesh(0.3, 0.42, ATLAS.piket, ASET.S05.items[0]);
  ASET.S06.items.forEach((it, i) => {
    group.add(frameMesh(0.4, 0.3, 0.02, 0.025, '#4e342e', materials.prop, it));
    atlasMesh(0.35, 0.26, ATLAS.piagam[i], it, 0.011);
  });
  ASET.S26.items.forEach((it) => atlasMesh(0.42, 0.6, ATLAS.poster[it.poster], it));
  ASET.S28.items.forEach((it) => atlasMesh(0.1, 0.1, ATLAS.stiker[it.stiker], it));
  ordnerSlots().forEach((o, i) => {
    const label = new THREE.Mesh(atlasPlane(0.05, 0.1, ATLAS.ordner[i]), atlasMat);
    label.position.set(o.x, o.y + 0.2, o.z - 0.152);
    label.rotation.set(0, Math.PI, -o.miring);
    group.add(label);
  });
  const nodaCanvas = makeCanvas(256, 256); // noda bocor di plafon: tekstur transparan sendiri (+1 draw call)
  drawNoda(nodaCanvas.getContext('2d'), [0, 0, 256, 256]);
  const nodaMat = new THREE.MeshStandardMaterial({
    map: canvasTexture(nodaCanvas, renderer), transparent: true, depthWrite: false, roughness: 0.95,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const noda = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), nodaMat);
  noda.position.set(0.9, ROOM.h - 0.004, 2.0);
  noda.rotation.x = Math.PI / 2;
  group.add(noda);
  const hinge = new THREE.Group(); // stiker di sisi dalam daun pintu (mengikuti engsel S30)
  hinge.position.set(DOOR.x0, 0, DOOR.z);
  hinge.rotation.y = DOOR.openRad;
  const doorSticker = new THREE.Mesh(atlasPlane(0.18, 0.18, ATLAS.stikerPintu), atlasMat);
  doorSticker.position.set(0.45, 1.5, 0.05); // di depan panel hias daun pintu (permukaan z 0,046)
  hinge.add(doorSticker);
  group.add(hinge);
  const S08 = ASET.S08.items[0]; // kain 3 bendera meja (tiang dibuat furniture.js)
  const stand = new THREE.Group();
  stand.position.set(S08.x, S08.y, S08.z);
  stand.rotation.y = S08.hadap + Math.PI;
  [ATLAS.benderaOrganisasi, ATLAS.benderaUnri, ATLAS.benderaMerahPutih].forEach((rect, i) => {
    const flag = new THREE.Mesh(atlasPlane(0.18, 0.12, rect), atlasMat);
    flag.position.set(-0.1 + i * 0.1 + 0.09, 0.52, 0);
    flag.rotation.y = Math.PI;
    stand.add(flag);
  });
  group.add(stand);

  return {
    group,
    /** Gambar ulang semua kanvas setelah font web (Inter) & tulisan tangan siap. */
    async redrawWhenFontsReady(isCancelled = () => false) {
      if (typeof document === 'undefined' || !document.fonts?.load) return;
      try {
        await Promise.all([document.fonts.load(`800 32px "Inter Variable"`), document.fonts.load(`400 24px "Segoe Print"`)]);
      } catch {
        return; // font cadangan sudah dipakai saat build
      }
      if (isCancelled()) return;
      for (const s of surfaces) {
        s.draw(s.canvas.getContext('2d'), s.w, s.h);
        s.tex.needsUpdate = true;
      }
    },
  };
}
```

- [ ] **Step 2: Lint & commit**

Run: `npm run lint` → 0 galat (tanpa peringatan baru).
```
git add src/interiors/sekre/boards.js
```
```
git commit -m "feat(interior): papan sekre dari canvas (bagan kabinet, timeline proker, whiteboard coretan rapat, atlas kalender/piket/piagam/poster/label ordner/stiker/bendera)"
```

---

## Task 14: `furniture.js` — placeholder S07–S30 berukuran persis, perabot hidup, jalur GLB

**Files:**
- Create: `src/interiors/sekre/furniture.js`

Aturan placeholder (katalog): ukuran persis kolom Dimensi, origin di tengah alas, depan menghadap −Z lokal
(rotasi y = `hadap + π`), warna = atribut vertex di material bersama (`prop`/`metal`) sehingga semua perabot statis
tergabung menjadi ±2 draw call. Aset yang punya versi GLB (S07, S13, S14, S15, S17, S19, S20) berada di
**container** dinamis bernama `<ID>-<n>` dengan anak placeholder `<ID>-ph`; GLB yang berhasil dimuat ditambahkan ke
container yang sama lalu placeholder disembunyikan (spec §10: GLB gagal → placeholder tetap).

- [ ] **Step 1: Tulis `src/interiors/sekre/furniture.js`**

```js
/**
 * Perabot sekre (katalog S07–S30 + kursi lipat, kertas, kabel). Placeholder prosedural berukuran PERSIS katalog;
 * statis → staticGroup (digabung per material oleh index.js), yang bergerak/diganti GLB → dynamicGroup.
 * Hidup: kipas (S14) berputar + menoleh, kertas di meja berkibar saat kipas menyala, dispenser (S13) mengisi gelas,
 * gitar (S19) berpindah ke tangan NPC, layar laptop (S17) emisif (dikendalikan lighting).
 * GLB final (GLB_ASET di data.js) dimuat ke container; gagal → placeholder tetap tampil.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { instantiateModel } from '../../world/assets/models.js';
import { ASET, EKSTRA, GLB_ASET, GUITAR_HOLD, ordnerSlots } from './data.js';
import { makeCanvas, canvasTexture, tint } from './canvas.js';
import { drawKarpet } from './room.js';

const PI = Math.PI;
const propRy = (hadap) => hadap + PI;
const TMP_M = new THREE.Matrix4();
const TMP_E = new THREE.Euler();
const TMP_V = new THREE.Vector3();
const FAN_POS = new THREE.Vector3(ASET.S14.items[0].x, 1.05, ASET.S14.items[0].z);

/** Material bersama interior (dibuat sekali per build; dilepas lewat disposeTree scene). */
export function createSekreMaterials(renderer = null) {
  const karpetCanvas = makeCanvas(768, 1024);
  drawKarpet(karpetCanvas.getContext('2d'), 768, 1024);
  return {
    prop: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.65 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xd8ecf2, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
    galon: new THREE.MeshStandardMaterial({ color: 0x8cc4ea, roughness: 0.15, transparent: true, opacity: 0.5, depthWrite: false }),
    water: new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.05, transparent: true, opacity: 0.65, depthWrite: false }),
    tl: new THREE.MeshStandardMaterial({ color: 0xf6f8ff, emissive: 0xeef4ff, emissiveIntensity: 0.15, roughness: 0.3 }),
    screen: new THREE.MeshStandardMaterial({ name: 'unri:layar-emisif', color: 0x0b0f14, emissive: 0x9cc4ff, emissiveIntensity: 0, roughness: 0.25 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf7f5ee, roughness: 0.9, side: THREE.DoubleSide }),
    karpet: new THREE.MeshStandardMaterial({ map: canvasTexture(karpetCanvas, renderer), roughness: 1 }),
  };
}

// ---------- Helper geometri berwarna (koordinat lokal aset) ----------

function shaped(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  if (rx || ry || rz) geo.applyMatrix4(TMP_M.makeRotationFromEuler(TMP_E.set(rx, ry, rz)));
  return tint(geo.translate(x, y, z), color);
}
const box = (w, h, d, color, t) => shaped(new THREE.BoxGeometry(w, h, d), color, t);
const rbox = (w, h, d, r, color, t) => shaped(new RoundedBoxGeometry(w, h, d, 2, r), color, t);
const cyl = (rt, rb, h, color, t, seg = 14) => shaped(new THREE.CylinderGeometry(rt, rb, h, seg), color, t);
const torus = (r, tube, color, t) => shaped(new THREE.TorusGeometry(r, tube, 6, 24), color, t);
const ball = (r, color, t) => shaped(new THREE.SphereGeometry(r, 10, 8), color, t);
const tube = (points, r, color) => tint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), 48, r, 6), color);

/**
 * Satu Mesh dari potongan berwarna (atribut identik: posisi, normal, uv, warna). RoundedBoxGeometry tidak
 * ber-indeks sedangkan Box/Cylinder ber-indeks → semua disamakan non-indexed sebelum digabung.
 */
function piece(geos, material, name = '', castShadow = true) {
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const geo = mergeGeometries(flat, false);
  for (const g of new Set([...geos, ...flat])) g.dispose();
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  m.castShadow = castShadow;
  m.receiveShadow = true;
  return m;
}

function placed(obj, it, ry = propRy(it.hadap)) {
  obj.position.set(it.x, it.y, it.z);
  obj.rotation.y = ry;
  return obj;
}

function groupOf(name, ...children) {
  const g = new THREE.Group();
  g.name = name;
  g.add(...children);
  return g;
}

// ---------- Placeholder aset GLB (lokal: origin tengah alas, depan −Z) ----------

/** S07 piala 0,15 × 0,15 × 0,45 */
function buildPiala(m) {
  const GOLD = '#d4a838';
  const gold = piece([
    cyl(0.012, 0.025, 0.1, GOLD, { y: 0.17 }),
    cyl(0.065, 0.03, 0.13, GOLD, { y: 0.285 }),
    torus(0.035, 0.007, GOLD, { x: 0.07, y: 0.29 }),
    torus(0.035, 0.007, GOLD, { x: -0.07, y: 0.29 }),
    cyl(0.068, 0.068, 0.012, GOLD, { y: 0.356 }),
    cyl(0.004, 0.01, 0.06, GOLD, { y: 0.392 }),
    ball(0.022, GOLD, { y: 0.428 }),
  ], m.metal, 'emas');
  const base = piece([
    box(0.15, 0.05, 0.15, '#3a2a1e', { y: 0.025 }),
    box(0.11, 0.07, 0.11, '#e8e2d6', { y: 0.085 }),
    box(0.06, 0.02, 0.003, '#c9b27a', { y: 0.07, z: -0.0565 }),
  ], m.prop, 'alas');
  return groupOf('S07-ph', gold, base);
}

/** S13 dispenser + galon terbalik (0,32 × 0,32 × 1,25); air tinggal seperempat galon. */
function buildDispenser(m) {
  const body = piece([
    box(0.32, 0.9, 0.32, '#eceff1', { y: 0.45 }),
    box(0.26, 0.28, 0.01, '#cfd8dc', { y: 0.62, z: -0.165 }),
    cyl(0.012, 0.012, 0.05, '#d32f2f', { x: -0.05, y: 0.66, z: -0.19, rx: PI / 2 }),
    cyl(0.012, 0.012, 0.05, '#1e88e5', { x: 0.05, y: 0.66, z: -0.19, rx: PI / 2 }),
    box(0.2, 0.02, 0.1, '#90a4ae', { y: 0.5, z: -0.2 }),
    box(0.3, 0.04, 0.3, '#dfe3e6', { y: 0.92 }),
    box(0.03, 0.03, 0.005, '#43a047', { x: 0.1, y: 0.8, z: -0.163 }),
    cyl(0.128, 0.128, 0.07, '#5fa8d3', { y: 1.015 }, 20),
  ], m.prop, 'badan');
  const galon = piece([
    cyl(0.135, 0.05, 0.04, '#ffffff', { y: 0.96 }, 20),
    cyl(0.135, 0.135, 0.27, '#ffffff', { y: 1.115 }, 20),
  ], m.galon, 'galon', false);
  return groupOf('S13-ph', body, galon);
}

/** S14 kipas berdiri (0,45 × 0,45 × 1,3): badan statis + kepala (menoleh) + baling (berputar). */
function buildKipas(m) {
  const base = piece([
    cyl(0.2, 0.22, 0.04, '#e8e8e8', { y: 0.02 }, 24),
    cyl(0.018, 0.018, 0.98, '#cfcfcf', { y: 0.53 }),
    box(0.06, 0.08, 0.05, '#e8e8e8', { y: 0.32, z: -0.03 }),
    box(0.012, 0.012, 0.012, '#2e7d32', { x: -0.015, y: 0.34, z: -0.058 }),
    box(0.012, 0.012, 0.012, '#c62828', { x: 0.015, y: 0.34, z: -0.058 }),
  ], m.prop, 'badan');
  const head = new THREE.Group();
  head.name = 'kepala';
  head.position.y = 1.05;
  const cage = [
    cyl(0.07, 0.08, 0.14, '#e8e8e8', { z: 0.09, rx: PI / 2 }),
    torus(0.21, 0.006, '#d0d0d0', { z: -0.03 }),
    torus(0.21, 0.006, '#d0d0d0', { z: -0.1 }),
    cyl(0.03, 0.03, 0.02, '#4fc3f7', { z: -0.105, rx: PI / 2 }),
  ];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * PI * 2;
    cage.push(box(0.005, 0.21, 0.005, '#d0d0d0', { x: Math.cos(a) * 0.105, y: Math.sin(a) * 0.105, z: -0.1, rz: a - PI / 2 }));
  }
  head.add(piece(cage, m.prop, 'kepala-ph'));
  const bladeGeos = [cyl(0.03, 0.03, 0.03, '#4fc3f7', { rx: PI / 2 })];
  for (let i = 0; i < 3; i += 1) {
    bladeGeos.push(tint(new THREE.BoxGeometry(0.075, 0.17, 0.008).rotateY(0.3).translate(0, 0.1, 0).rotateZ((i * 2 * PI) / 3), '#4fc3f7'));
  }
  const blades = piece(bladeGeos, m.prop, 'baling');
  blades.position.z = -0.065;
  head.add(blades);
  return { group: groupOf('S14-ph', base, head), head, blades };
}

/** S15 printer tua 0,45 × 0,4 × 0,25 */
function buildPrinter(m) {
  return groupOf('S15-ph', piece([
    box(0.45, 0.2, 0.38, '#d6d0c2', { y: 0.1 }),
    box(0.42, 0.03, 0.2, '#c8c1b1', { y: 0.215, z: 0.05 }),
    box(0.3, 0.01, 0.15, '#bdb6a6', { y: 0.2, z: -0.24, rx: -0.3 }),
    box(0.28, 0.002, 0.12, '#ffffff', { y: 0.21, z: -0.24, rx: -0.3 }),
    box(0.1, 0.03, 0.005, '#424242', { x: 0.14, y: 0.15, z: -0.191 }),
    box(0.015, 0.015, 0.004, '#ff9800', { x: 0.17, y: 0.15, z: -0.194 }),
  ], m.prop, 'printer'));
}

/** S17 laptop 0,34 × 0,24 × 0,23 terbuka ±105°; layar = material emisif bersama. */
function buildLaptop(m) {
  const lid = (geo) => geo.translate(0, 0.11, 0).rotateX(0.26).translate(0, 0.018, 0.12);
  const body = piece([
    box(0.34, 0.018, 0.24, '#3a3d42', { y: 0.009 }),
    box(0.3, 0.002, 0.12, '#202225', { y: 0.019, z: 0.03 }),
    box(0.09, 0.001, 0.06, '#4a4d52', { y: 0.019, z: -0.075 }),
    tint(lid(new THREE.BoxGeometry(0.34, 0.22, 0.008)), '#3a3d42'),
  ], m.prop, 'badan');
  const screen = new THREE.Mesh(lid(new THREE.PlaneGeometry(0.3, 0.18).rotateY(PI).translate(0, 0, -0.0045)), m.screen);
  screen.name = 'layar';
  return groupOf('S17-ph', body, screen);
}

/** S19 gitar akustik 0,38 × 0,1 × 1,0 (tegak, depan −Z). */
function buildGitar(m) {
  const BODY = '#c98b4b';
  const NECK = '#4a2e1c';
  const geos = [
    cyl(0.19, 0.19, 0.1, BODY, { y: 0.21, rx: PI / 2 }, 24),
    cyl(0.145, 0.145, 0.1, BODY, { y: 0.45, rx: PI / 2 }, 24),
    cyl(0.055, 0.055, 0.004, '#1b1b1b', { y: 0.4, z: -0.051, rx: PI / 2 }, 18),
    box(0.05, 0.42, 0.03, NECK, { y: 0.77 }),
    box(0.075, 0.13, 0.025, NECK, { y: 0.935 }),
    box(0.1, 0.012, 0.02, '#1b1b1b', { y: 0.12, z: -0.055 }),
  ];
  for (let i = 0; i < 6; i += 1) {
    geos.push(box(0.0015, 0.8, 0.0015, '#d7d7d7', { x: -0.0125 + i * 0.005, y: 0.52, z: -0.04 }));
    geos.push(cyl(0.006, 0.006, 0.03, '#c9b27a', { x: i < 3 ? -0.045 : 0.045, y: 0.9 + (i % 3) * 0.035, rz: PI / 2 }));
  }
  return groupOf('S19-ph', piece(geos, m.prop, 'gitar'));
}

/** S20 tas ransel 0,3 × 0,2 × 0,45 */
function buildTas(m, color) {
  const c = new THREE.Color(color);
  const dark = `#${c.clone().multiplyScalar(0.7).getHexString()}`;
  return groupOf('S20-ph', piece([
    rbox(0.3, 0.42, 0.18, 0.06, color, { y: 0.21 }),
    rbox(0.22, 0.18, 0.06, 0.03, dark, { y: 0.14, z: -0.1 }),
    torus(0.04, 0.008, dark, { y: 0.43 }),
    box(0.04, 0.36, 0.02, dark, { x: -0.08, y: 0.24, z: 0.095 }),
    box(0.04, 0.36, 0.02, dark, { x: 0.08, y: 0.24, z: 0.095 }),
    box(0.2, 0.006, 0.004, '#cfd8dc', { y: 0.22, z: -0.131 }),
  ], m.prop, 'tas'));
}

// ---------- Perabot statis ----------

function buildMeja(m) {
  const top = piece([
    box(1.8, 0.03, 0.6, '#d8cbb0', { y: 0.735 }),
    box(1.8, 0.035, 0.012, '#7a6f5d', { y: 0.72, z: -0.3 }),
    box(1.8, 0.035, 0.012, '#7a6f5d', { y: 0.72, z: 0.3 }),
  ], m.prop, 'meja');
  const legs = [];
  for (const x of [-0.8, 0.8]) {
    for (const z of [-0.24, 0.24]) legs.push(cyl(0.012, 0.012, 0.72, '#9ea7ad', { x, y: 0.36, z, rx: z > 0 ? 0.06 : -0.06 }));
    legs.push(cyl(0.01, 0.01, 0.5, '#9ea7ad', { x, y: 0.12, rx: PI / 2 }));
  }
  legs.push(cyl(0.01, 0.01, 1.6, '#9ea7ad', { y: 0.12, rz: PI / 2 }));
  return groupOf('S16', top, piece(legs, m.metal, 'kaki'));
}

function buildKursi(m) {
  const seat = piece([
    box(0.42, 0.03, 0.4, '#37474f', { y: 0.45 }),
    box(0.42, 0.28, 0.02, '#37474f', { y: 0.76, z: 0.2 }),
  ], m.prop, 'dudukan');
  const legs = [];
  for (const x of [-0.19, 0.19]) {
    legs.push(cyl(0.011, 0.011, 0.45, '#9ea7ad', { x, y: 0.225, z: -0.17 }));
    legs.push(cyl(0.011, 0.011, 0.9, '#9ea7ad', { x, y: 0.45, z: 0.19 }));
  }
  legs.push(cyl(0.009, 0.009, 0.38, '#9ea7ad', { y: 0.2, z: -0.17, rz: PI / 2 }));
  return groupOf('kursi-lipat', seat, piece(legs, m.metal, 'kaki'));
}

function buildGelas(m, isi) {
  const geos = isi === 'plastik'
    ? [
      cyl(0.04, 0.032, 0.1, '#e3f2fd', { y: 0.05 }),
      cyl(0.037, 0.037, 0.003, '#c5e1a5', { y: 0.08 }),
      cyl(0.003, 0.003, 0.16, '#e53935', { x: 0.01, y: 0.12, rz: 0.2 }),
    ]
    : [
      cyl(0.04, 0.033, 0.1, '#f5f5f5', { y: 0.05 }),
      cyl(0.036, 0.036, 0.004, '#4e342e', { y: 0.088 }),
      torus(0.025, 0.006, '#f5f5f5', { x: 0.045, y: 0.05 }),
    ];
  return piece(geos, m.prop, 'S18', false);
}

function buildSepatu(m, color) {
  const geos = [];
  for (const z of [-0.065, 0.065]) {
    geos.push(box(0.3, 0.025, 0.11, '#f5f5f5', { y: 0.0125, z }));
    geos.push(rbox(0.27, 0.07, 0.1, 0.03, color, { x: 0.01, y: 0.06, z }));
  }
  return piece(geos, m.prop, 'S21', false);
}

function buildKarpet(m, it) {
  const g = new THREE.Group();
  g.name = 'S22';
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3, 4).rotateX(-PI / 2).translate(0, 0.006, 0), m.karpet);
  rug.receiveShadow = true;
  g.add(rug, piece([
    box(3, 0.004, 0.05, '#efe3c6', { y: 0.004, z: -2.025 }),
    box(3, 0.004, 0.05, '#efe3c6', { y: 0.004, z: 2.025 }),
  ], m.prop, 'rumbai', false));
  g.position.set(it.x, it.y, it.z);
  return g;
}

function buildLemari(m) {
  const GREY = '#8d969e';
  const shell = piece([
    box(0.9, 1.8, 0.01, GREY, { y: 0.9, z: 0.22 }),
    box(0.01, 1.8, 0.45, GREY, { x: -0.445, y: 0.9 }),
    box(0.01, 1.8, 0.45, GREY, { x: 0.445, y: 0.9 }),
    box(0.9, 0.012, 0.45, GREY, { y: 1.794 }),
    box(0.9, 0.05, 0.45, '#6f777e', { y: 0.025 }),
    box(0.88, 0.02, 0.43, GREY, { y: 0.95 }),
    box(0.88, 0.012, 0.43, GREY, { y: 1.35 }),
    box(0.435, 0.86, 0.012, GREY, { x: -0.2225, y: 0.5, z: -0.219 }),
    box(0.435, 0.86, 0.012, GREY, { x: 0.2225, y: 0.5, z: -0.219 }),
    box(0.015, 0.1, 0.015, '#37474f', { x: -0.03, y: 0.75, z: -0.23 }),
    box(0.015, 0.1, 0.015, '#37474f', { x: 0.03, y: 0.75, z: -0.23 }),
    box(0.02, 0.03, 0.01, '#c9b27a', { y: 0.98, z: -0.228 }),
    ...[-0.2225, 0.2225].flatMap((x) => [
      box(0.02, 0.78, 0.015, GREY, { x: x - 0.2075, y: 1.36, z: -0.22 }),
      box(0.02, 0.78, 0.015, GREY, { x: x + 0.2075, y: 1.36, z: -0.22 }),
      box(0.435, 0.02, 0.015, GREY, { x, y: 0.98, z: -0.22 }),
      box(0.435, 0.02, 0.015, GREY, { x, y: 1.74, z: -0.22 }),
    ]),
  ], m.metal, 'lemari');
  const glass = piece([-0.2225, 0.2225].map((x) => box(0.395, 0.74, 0.004, '#ffffff', { x, y: 1.36, z: -0.219 })), m.glass, 'kaca', false);
  return groupOf('S09', shell, glass);
}

/** S10: 12 map ordner (InstancedMesh, warna per instans) di rak kaca lemari; koordinat ruang. */
function buildOrdner(m) {
  const slots = ordnerSlots();
  const mesh = new THREE.InstancedMesh(tint(new THREE.BoxGeometry(0.08, 0.32, 0.3), '#ffffff'), m.prop, slots.length);
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const color = new THREE.Color();
  slots.forEach((s, i) => {
    q.setFromEuler(TMP_E.set(0, 0, s.miring));
    TMP_M.compose(TMP_V.set(s.x, s.y + 0.16, s.z), q, one);
    mesh.setMatrixAt(i, TMP_M);
    mesh.setColorAt(i, color.set(s.warna));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = 'S10';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildKardus(m) {
  return piece([
    box(0.5, 0.35, 0.4, '#b88a55', { y: 0.175 }),
    box(0.06, 0.352, 0.402, '#d9c79c', { y: 0.175 }),
    box(0.5, 0.008, 0.2, '#a87a48', { y: 0.355, z: -0.1, rx: -0.25 }),
    box(0.2, 0.12, 0.002, '#efe6d0', { y: 0.2, z: -0.201 }),
  ], m.prop, 'S11');
}

function buildSpanduk(m) {
  return piece([
    cyl(0.05, 0.05, 2, '#f2efe6', { y: 1 }),
    cyl(0.052, 0.052, 0.12, '#d9661f', { y: 0.1 }),
    cyl(0.052, 0.052, 0.12, '#d9661f', { y: 1.9 }),
  ], m.prop, 'S12');
}

function buildBenderaStand(m) {
  return groupOf('S08', piece([box(0.3, 0.03, 0.12, '#3e2723', { y: 0.015 })], m.prop, 'alas'), piece(
    [-0.1, 0, 0.1].flatMap((x) => [cyl(0.004, 0.004, 0.55, '#c9b27a', { x, y: 0.305 }), ball(0.01, '#c9b27a', { x, y: 0.585 })]),
    m.metal, 'tiang',
  ));
}

function buildBantal(m, color) {
  return piece([rbox(0.5, 0.1, 0.35, 0.04, color, { y: 0.05 })], m.prop, 'S23', false);
}

function buildStopkontak(m) {
  return piece([
    box(0.3, 0.04, 0.06, '#f5f5f5', { y: 0.02 }),
    ...[-0.1, -0.033, 0.033].map((x) => cyl(0.013, 0.013, 0.004, '#9e9e9e', { x, y: 0.041 })),
    box(0.03, 0.012, 0.02, '#e53935', { x: 0.125, y: 0.046 }),
  ], m.prop, 'S25', false);
}

function buildSaklar(m) {
  return piece([box(0.08, 0.12, 0.012, '#f2f2f2'), box(0.03, 0.05, 0.008, '#e0e0e0', { z: -0.008 })], m.prop, 'S27', false);
}

/** S24: rumah lampu (prop) + tabung TL (material emisif bersama, kedua lampu satu mesh). Koordinat ruang. */
function buildTL(m) {
  const housing = [];
  const tubes = [];
  for (const it of ASET.S24.items) {
    housing.push(box(0.1, 0.05, 1.22, '#f2f2f2', { x: it.x, y: it.y - 0.025, z: it.z }));
    housing.push(box(0.12, 0.01, 1.24, '#e6e6e6', { x: it.x, y: it.y - 0.052, z: it.z }));
    tubes.push(cyl(0.016, 0.016, 1.2, '#ffffff', { x: it.x, y: it.y - 0.075, z: it.z, rx: PI / 2 }));
  }
  return groupOf('S24', piece(housing, m.prop, 'rumah-tl', false), piece(tubes, m.tl, 'tabung-tl', false));
}

/** S25 kabel: dari stopkontak ke stop dinding & ke laptop (koordinat ruang). */
function buildKabel(m) {
  const s = ASET.S25.items[0];
  const w = ASET.S25.stopDinding;
  return groupOf('S25-kabel', piece([
    tube([[s.x, 0.012, s.z], [1.7, 0.012, 0.7], [2.0, 0.012, 0.42], [2.08, 0.05, 0.3], [w.x - 0.01, w.y, w.z]], 0.004, '#1a1a1a'),
    tube([[s.x + 0.05, 0.012, s.z + 0.05], [1.47, 0.02, 1.12], [1.47, 0.5, 1.18], [1.5, 0.76, 1.24], [1.62, 0.77, 1.3]], 0.004, '#1a1a1a'),
    box(0.012, 0.08, 0.08, '#f2f2f2', { x: w.x, y: w.y, z: w.z }),
  ], m.prop, 'kabel', false));
}

/** S29 jendela nako (kusen aluminium, 8 bilah kaca terbuka, teralis luar). Koordinat ruang. */
function buildJendela(m) {
  const it = ASET.S29.items[0];
  const cx = it.x;
  const y0 = it.y;
  const zc = -3.075;
  const AL = '#c9ccd0';
  const frame = [
    box(0.04, 1.2, 0.1, AL, { x: cx - 0.58, y: y0 + 0.6, z: zc }),
    box(0.04, 1.2, 0.1, AL, { x: cx + 0.58, y: y0 + 0.6, z: zc }),
    box(1.2, 0.04, 0.1, AL, { x: cx, y: y0 + 1.18, z: zc }),
    box(1.2, 0.04, 0.1, AL, { x: cx, y: y0 + 0.02, z: zc }),
    box(0.02, 1.12, 0.03, AL, { x: cx - 0.555, y: y0 + 0.6, z: -3.04 }),
    box(0.02, 1.12, 0.03, AL, { x: cx + 0.555, y: y0 + 0.6, z: -3.04 }),
  ];
  for (let k = 0; k < 5; k += 1) frame.push(cyl(0.008, 0.008, 1.2, '#37474f', { x: cx - 0.52 + k * 0.26, y: y0 + 0.6, z: -3.17 }));
  for (const yy of [0.3, 0.9]) frame.push(cyl(0.008, 0.008, 1.16, '#37474f', { x: cx, y: y0 + yy, z: -3.17, rz: PI / 2 }));
  const sill = piece([box(1.3, 0.03, 0.12, '#d9d4c7', { x: cx, y: y0 - 0.015, z: -2.96 })], m.prop, 'ambang');
  const glass = [];
  for (let i = 0; i < 8; i += 1) glass.push(box(1.1, 0.004, 0.155, '#ffffff', { x: cx, y: y0 + 0.075 + i * 0.15, z: -3.05, rx: 0.35 }));
  return groupOf('S29', piece(frame, m.metal, 'kusen'), sill, piece(glass, m.glass, 'bilah-kaca', false));
}

/** S30 pintu kayu + kusen, daun terbuka ke dalam (engsel di DOOR.x0). Koordinat ruang. */
function buildPintu(m) {
  const it = ASET.S30.items[0];
  const WOOD = '#6d4428';
  const kusen = piece([
    box(0.06, 2.16, 0.17, WOOD, { x: 0.87, y: 1.08, z: -3.075 }),
    box(0.06, 2.16, 0.17, WOOD, { x: 1.83, y: 1.08, z: -3.075 }),
    box(1.02, 0.06, 0.17, WOOD, { x: 1.35, y: 2.13, z: -3.075 }),
  ], m.prop, 'kusen');
  const panel = piece([
    box(0.9, 2.08, 0.04, '#7a4b2a', { x: 0.45, y: 1.04, z: 0.02 }),
    ...[0.25, 0.65].flatMap((x) => [0.6, 1.5].flatMap((y) => [
      box(0.3, 0.75, 0.008, '#5e3a20', { x, y, z: 0.042 }),
      box(0.3, 0.75, 0.008, '#5e3a20', { x, y, z: -0.002 }),
    ])),
  ], m.prop, 'daun');
  const handle = piece([
    cyl(0.01, 0.01, 0.12, '#cfd8dc', { x: 0.8, y: 1.0, z: 0.065, rz: PI / 2 }),
    cyl(0.025, 0.025, 0.01, '#cfd8dc', { x: 0.84, y: 1.0, z: 0.046, rx: PI / 2 }),
    cyl(0.01, 0.01, 0.12, '#cfd8dc', { x: 0.8, y: 1.0, z: -0.025, rz: PI / 2 }),
  ], m.metal, 'gagang');
  const hinge = groupOf('daun-pintu', panel, handle);
  hinge.position.set(it.x, 0, it.z);
  hinge.rotation.y = it.buka;
  return groupOf('S30', kusen, hinge);
}

// ---------- Perabot hidup ----------

function buildKertas(m, it, i) {
  const pivot = new THREE.Group();
  pivot.name = `kertas-${i}`;
  pivot.position.set(it.x, it.y, it.z);
  pivot.rotation.y = it.hadap;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.297).rotateX(-PI / 2).translate(0, 0, 0.1485), m.paper);
  sheet.receiveShadow = true;
  pivot.add(sheet);
  return { pivot, dist: Math.hypot(it.x - FAN_POS.x, it.z - FAN_POS.z), phase: i * 1.7 };
}

/**
 * @param {{materials: ReturnType<typeof createSekreMaterials>}} opts
 */
export function buildFurniture({ materials }) {
  const m = materials;
  const staticGroup = new THREE.Group();
  staticGroup.name = 'sekre-perabot';
  const dynamicGroup = new THREE.Group();
  dynamicGroup.name = 'sekre-perabot-dinamis';
  /** id aset → container dinamis (placeholder + GLB). */
  const containers = new Map();
  const addContainer = (id, it, child, k) => {
    const c = new THREE.Group();
    c.name = `${id}-${k}`;
    placed(c, it);
    if (it.skala) c.scale.setScalar(it.skala);
    if (it.miring) c.rotation.set(it.miring, propRy(it.hadap), 0, 'YXZ');
    c.add(child);
    dynamicGroup.add(c);
    containers.set(id, [...(containers.get(id) ?? []), c]);
    return c;
  };

  // statis: posisi dari data.js
  staticGroup.add(placed(buildMeja(m), ASET.S16.items[0]));
  staticGroup.add(placed(buildKursi(m), EKSTRA.kursiLipat));
  staticGroup.add(placed(buildLemari(m), ASET.S09.items[0]));
  staticGroup.add(buildOrdner(m));
  staticGroup.add(placed(buildBenderaStand(m), ASET.S08.items[0]));
  ASET.S11.items.forEach((it) => staticGroup.add(placed(buildKardus(m), it)));
  ASET.S12.items.forEach((it) => {
    const s = placed(buildSpanduk(m), it);
    s.rotation.set(it.miring, propRy(it.hadap), 0, 'YXZ');
    staticGroup.add(s);
  });
  ASET.S18.items.forEach((it) => staticGroup.add(placed(buildGelas(m, it.isi), it)));
  ASET.S21.items.forEach((it) => staticGroup.add(placed(buildSepatu(m, it.warna), it)));
  staticGroup.add(buildKarpet(m, ASET.S22.items[0]));
  ASET.S23.items.forEach((it) => staticGroup.add(placed(buildBantal(m, it.warna), it)));
  staticGroup.add(buildTL(m));
  staticGroup.add(placed(buildStopkontak(m), ASET.S25.items[0]));
  staticGroup.add(buildKabel(m));
  staticGroup.add(placed(buildSaklar(m), ASET.S27.items[0]));
  staticGroup.add(buildJendela(m));
  staticGroup.add(buildPintu(m));

  // dinamis / dapat diganti GLB
  ASET.S07.items.forEach((it, k) => addContainer('S07', it, buildPiala(m), k));
  const dispenser = addContainer('S13', ASET.S13.items[0], buildDispenser(m), 0);
  const kipas = buildKipas(m);
  addContainer('S14', ASET.S14.items[0], kipas.group, 0);
  addContainer('S15', ASET.S15.items[0], buildPrinter(m), 0);
  ASET.S17.items.forEach((it, k) => addContainer('S17', it, buildLaptop(m), k));
  const gitarRest = ASET.S19.items[0];
  const guitar = addContainer('S19', gitarRest, buildGitar(m), 0);
  ASET.S20.items.forEach((it, k) => addContainer('S20', it, buildTas(m, it.warna), k));
  const papers = EKSTRA.kertas.map((it, i) => buildKertas(m, it, i));
  for (const p of papers) dynamicGroup.add(p.pivot);

  // dispenser: gelas + kucuran air + isi (animasi E)
  const pour = { t: -1 };
  const cup = new THREE.Group();
  cup.name = 'gelas-dispenser';
  cup.position.set(0.05, 0.51, -0.2);
  cup.visible = false;
  cup.add(piece([cyl(0.035, 0.03, 0.09, '#f5f5f5', { y: 0.045 })], m.glass, 'gelas', false));
  const fill = new THREE.Mesh(tint(new THREE.CylinderGeometry(0.031, 0.027, 0.085, 12).translate(0, 0.0425, 0), '#ffffff'), m.water);
  fill.scale.y = 0.02;
  const stream = new THREE.Mesh(tint(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6).translate(0, 0.12, 0), '#ffffff'), m.water);
  stream.visible = false;
  cup.add(fill, stream);
  dispenser.add(cup);

  const fan = { on: false, spin: 0, phase: 0, head: kipas.head, blades: kipas.blades };
  let time = 0;

  const restGuitar = () => {
    dynamicGroup.add(guitar);
    guitar.position.set(gitarRest.x, gitarRest.y, gitarRest.z);
    guitar.rotation.set(gitarRest.miring, propRy(gitarRest.hadap), 0, 'YXZ');
  };
  const holdGuitar = (spine) => {
    spine.add(guitar);
    guitar.position.fromArray(GUITAR_HOLD.pos);
    guitar.rotation.set(GUITAR_HOLD.rot[0], GUITAR_HOLD.rot[1], GUITAR_HOLD.rot[2], 'XYZ');
  };

  function bindFanModel(model) {
    let head = null;
    let blades = null;
    model.traverse((o) => {
      if (o.material?.name === 'unri:kipas-kepala') head = o;
      if (o.material?.name === 'unri:kipas-baling') blades = o;
    });
    if (!head || !blades) return;
    blades.geometry.computeBoundingBox();
    const c = blades.geometry.boundingBox.getCenter(new THREE.Vector3());
    blades.geometry.translate(-c.x, -c.y, -c.z);
    blades.position.add(c);
    const pivot = new THREE.Group();
    pivot.name = 'kepala-glb';
    pivot.position.set(0, 1.05, 0);
    model.add(pivot);
    model.updateMatrixWorld(true);
    pivot.attach(head);
    pivot.attach(blades);
    fan.head = pivot;
    fan.blades = blades;
  }

  /** Muat GLB final ke container (harus dipanggil di dalam withScope interior). */
  async function loadModels(isCancelled = () => false) {
    const jobs = [];
    for (const [id, path] of Object.entries(GLB_ASET)) {
      for (const container of containers.get(id) ?? []) {
        jobs.push(instantiateModel(path).then((model) => {
          if (isCancelled()) return;
          container.add(model);
          const ph = container.getObjectByName(`${id}-ph`);
          if (ph) ph.visible = false;
          if (id === 'S14') bindFanModel(model);
          if (id === 'S17') model.traverse((o) => { if (o.material?.name === 'unri:layar-emisif') o.material = m.screen; });
        }));
      }
    }
    const results = await Promise.allSettled(jobs);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length && !isCancelled()) console.warn(`Sekre: ${failed.length} model GLB gagal dimuat, placeholder prosedural dipakai.`, failed[0].reason);
    return { failed: failed.length };
  }

  return {
    staticGroup,
    dynamicGroup,
    containers,
    props: {
      /** Gelas untuk tangan NPC (pose drinkCup). */
      makeCup: () => piece([cyl(0.035, 0.03, 0.09, '#ffffff', { y: -0.045 }), cyl(0.032, 0.032, 0.004, '#5d4037', { y: -0.01 })], m.prop, 'gelas-npc', false),
      /** Spidol untuk tangan NPC (pose writeBoard). */
      makeMarker: () => piece([cyl(0.008, 0.008, 0.12, '#1565c0', { rx: PI / 2 }), cyl(0.009, 0.009, 0.03, '#111111', { z: 0.06, rx: PI / 2 })], m.prop, 'spidol-npc', false),
      holdGuitar,
      restGuitar,
    },
    get fanOn() { return fan.on; },
    toggleFan() {
      fan.on = !fan.on;
      return fan.on;
    },
    /** Mulai animasi isi gelas (≈1,6 s); false bila sedang mengisi. */
    pourWater() {
      if (pour.t >= 0) return false;
      pour.t = 0;
      cup.visible = true;
      fill.scale.y = 0.02;
      return true;
    },
    /** Posisi dunia badan gitar (mengikuti tangan NPC saat dimainkan). */
    guitarWorldPosition(out) {
      guitar.getWorldPosition(TMP_V);
      out.x = TMP_V.x;
      out.y = TMP_V.y + 0.4;
      out.z = TMP_V.z;
      return out;
    },
    update(dt) {
      const d = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
      time += d;
      fan.spin += ((fan.on ? 1 : 0) - fan.spin) * Math.min(1, d * (fan.on ? 0.8 : 0.4));
      if (fan.blades) fan.blades.rotation.z -= fan.spin * 26 * d;
      if (fan.on) fan.phase += d;
      if (fan.head) fan.head.rotation.y = 0.6 * Math.sin(fan.phase * 1.6);
      for (const p of papers) {
        const reach = Math.max(0.15, Math.min(1, 1.2 - p.dist / 4));
        p.pivot.rotation.x = -fan.spin * reach * (0.05 + 0.18 * (0.5 + 0.5 * Math.sin(time * 11 + p.phase)));
      }
      if (pour.t >= 0) {
        pour.t += d;
        stream.visible = pour.t < 1.6;
        fill.scale.y = Math.max(0.02, Math.min(1, pour.t / 1.6)) * 0.85;
        if (pour.t >= 1.6) pour.t = -1;
      }
    },
    loadModels,
    dispose() { restGuitar(); },
  };
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 galat, tanpa peringatan baru.

- [ ] **Step 3: Commit**

```
git add src/interiors/sekre/furniture.js
```
```
git commit -m "feat(interior): perabot sekre S07–S30 placeholder berukuran persis (vertex color tergabung), kipas/dispenser/kertas/gitar hidup, jalur GLB dengan cadangan placeholder"
```

---

## Task 15: `npcs.js` — 3–6 NPC terjadwal (almamater/kaus), properti di tangan

**Files:**
- Create: `src/interiors/sekre/npcs.js`

Kode visual + lem (jadwal & pose sudah dites).

- [ ] **Step 1: Tulis `src/interiors/sekre/npcs.js`**

```js
/**
 * NPC sekre (spec §8.2, katalog C01–C09): 6 mahasiswa dari data.js (almamater biru langit / kaus), 3–6 hadir
 * menurut activitySchedule pada jam game yang sama dengan eksterior. Tiap NPC = Humanoid → SkinnedMesh (1 draw
 * call); di dalam ruangan tanpa topi & tanpa sepatu (alas kaki ditinggal di rak depan, sebagian berkaus kaki),
 * rambut gelap; NPC berhijab memakai lengan panjang & bawahan panjang. Penugasan dihitung ulang hanya saat
 * periode jadwal berganti; pose + idle halus tiap frame (fase berbeda per NPC). Properti: gelas (drinkCup),
 * spidol (writeBoard), gitar (guitarStrum: dipindah dari dinding ke pangkuan).
 */
import * as THREE from 'three';
import { createHumanoid } from '../../entities/Humanoid.js';
import { applyPose } from '../../entities/Humanoid.poses.js';
import { bakeSkinnedHumanoid } from '../../entities/Humanoid.skinned.js';
import { randomAlmamaterOutfit, randomCasualOutfit } from '../../entities/Humanoid.outfits.js';
import { makeRng } from '../../entities/util.js';
import { periodAt, scheduleFor } from '../../sim/activitySchedule.js';
import { NPCS, SLOTS, TALK_SLOTS, SCHEDULE_SEED } from './data.js';

const HAIR_DARK = Object.freeze([0x1c1410, 0x2b1d14, 0x3b2a1e]);
const SOCKS = Object.freeze([null, 0x2b2b2b, 0xf2f2f2]);
const TALK = new Set(TALK_SLOTS);

/** Pakaian NPC (deterministik per seed data). */
export function npcOutfit(def) {
  const rng = makeRng(def.seed);
  const base = def.outfit === 'almamater' ? randomAlmamaterOutfit(rng) : randomCasualOutfit(rng);
  const sock = SOCKS[Math.floor(rng() * SOCKS.length)];
  const hairColor = HAIR_DARK[Math.floor(rng() * HAIR_DARK.length)];
  const berhijab = def.hijab != null;
  return {
    ...base,
    hat: null,
    vest: null,
    hijab: berhijab ? def.hijab : null,
    hair: berhijab ? null : (def.rambut ?? 'buzz'),
    hairColor,
    shoes: sock ?? base.skin,
    ...(berhijab ? { longSleeve: true, bottom: base.bottom === 'shorts' ? 'pants' : base.bottom } : {}),
  };
}

/**
 * @param {{props:{makeCup():THREE.Object3D, makeMarker():THREE.Object3D, holdGuitar(spine:THREE.Object3D):void, restGuitar():void},
 *   seed?:number, slots?:typeof SLOTS, roster?:typeof NPCS}} opts
 */
export function createSekreNpcs({ props, seed = SCHEDULE_SEED, slots = SLOTS, roster = NPCS }) {
  const group = new THREE.Group();
  group.name = 'npc-sekre';
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const npcs = roster.map((def, i) => {
    const humanoid = createHumanoid(npcOutfit(def));
    const skin = bakeSkinnedHumanoid(humanoid);
    humanoid.group.name = def.id;
    humanoid.group.visible = false;
    const cup = props.makeCup();
    cup.position.set(0, -0.02, 0.05);
    cup.visible = false;
    const marker = props.makeMarker();
    marker.position.set(0, -0.02, 0.04);
    marker.visible = false;
    humanoid.parts.handR.add(cup, marker);
    group.add(humanoid.group);
    return { def, humanoid, skin, cup, marker, slot: null, phase: i * 1.37 };
  });
  let periodId = null;
  let t = 0;

  function assign(hour) {
    for (const n of npcs) {
      n.slot = null;
      n.humanoid.group.visible = false;
      n.cup.visible = false;
      n.marker.visible = false;
    }
    let guitarist = null;
    for (const a of scheduleFor(hour, seed, slots, npcs.map((n) => n.def.id))) {
      const n = npcs.find((m) => m.def.id === a.npcId);
      const slot = slotById.get(a.slotId);
      if (!n || !slot) continue;
      n.slot = { ...slot, poseId: a.poseId };
      n.humanoid.group.position.set(slot.x, 0, slot.z);
      n.humanoid.group.rotation.y = slot.yaw;
      n.humanoid.group.visible = true;
      n.cup.visible = a.poseId === 'drinkCup';
      n.marker.visible = a.poseId === 'writeBoard';
      if (a.poseId === 'guitarStrum') guitarist = n;
    }
    if (guitarist) props.holdGuitar(guitarist.humanoid.parts.spine);
    else props.restGuitar();
  }

  return {
    group,
    /** @param {number} dt @param {number} hour jam game */
    update(dt, hour) {
      t += Number.isFinite(dt) ? dt : 0;
      const id = periodAt(hour).id;
      if (id !== periodId) {
        periodId = id;
        assign(hour);
      }
      for (const n of npcs) {
        if (!n.slot) continue;
        applyPose(n.humanoid, n.slot.poseId, t + n.phase);
        n.skin.sync();
      }
    },
    /** Lingkaran penghalang pemain (collider ruang). */
    blockers() {
      return npcs.filter((n) => n.slot).map((n) => ({ x: n.slot.x, z: n.slot.z, r: n.slot.block }));
    },
    /** Jumlah NPC yang sedang rapat/ngobrol (volume gumaman). */
    get talkers() { return npcs.filter((n) => n.slot && TALK.has(n.slot.id)).length; },
    isActive(slotId) { return npcs.some((n) => n.slot?.id === slotId); },
    /** Ringkasan (dev/E2E): siapa di mana. */
    get active() {
      return npcs.filter((n) => n.slot).map((n) => ({ id: n.def.id, nama: n.def.nama, slotId: n.slot.id, poseId: n.slot.poseId }));
    },
    dispose() {
      props.restGuitar();
      for (const n of npcs) n.skin.dispose();
    },
  };
}
```

- [ ] **Step 2: Lint & commit**

Run: `npm run lint` → 0 galat.
```
git add src/interiors/sekre/npcs.js
```
```
git commit -m "feat(interior): NPC sekre terjadwal (almamater/kaus, tanpa alas kaki, pose + idle, gelas/spidol/gitar di tangan)"
```

---

## Task 16: `interactables.js` — 12 barang interaktif (+ tes handler)

**Files:**
- Create: `src/interiors/sekre/interactables.js`, `src/interiors/sekre/photo.js` (dipakai untuk pose intip;
  isi lengkap di sini, preset foto dipakai Task 19)
- Modify: `tests/interiorSekre.test.js`

- [ ] **Step 1: `src/interiors/sekre/photo.js`**

```js
/**
 * Mode foto sekre (spec §8.2): 4 preset kamera (tombol 1–4 saat mode foto P: lesehan, pintu, pojok, atas) +
 * pose intip jendela. Pose ruang-lokal { position:[x,y,z], target:[x,y,z], fov }. Kamera bebas & batasnya
 * diatur InteriorCameraRig; preset "pintu" berdiri di selasar menatap ke dalam lewat kusen.
 */
const pose = (position, target, fov) => Object.freeze({ position: Object.freeze(position), target: Object.freeze(target), fov });
const preset = (id, label, p) => Object.freeze({ id, label, pose: p });

export const SEKRE_PHOTO_PRESETS = Object.freeze([
  preset('lesehan', 'Lesehan', pose([1.1, 0.65, 2.0], [-0.6, 0.5, 0.4], 62)),
  preset('pintu', 'Dari pintu', pose([1.7, 1.6, -3.9], [-0.1, 0.95, 1.5], 68)),
  preset('pojok', 'Pojok ruangan', pose([-1.85, 2.55, 2.75], [0.8, 0.7, -1.2], 78)),
  preset('atas', 'Dari atas', pose([0, 3.0, 0.3], [0, 0, 0.55], 95)),
]);

/** Intip jendela nako: menatap selasar serong ke kanan (ke ujung yang terbuka). */
export const WINDOW_PEEK = pose([-0.9, 1.5, -2.86], [3.5, 1.15, -5.6], 60);
```

- [ ] **Step 2: Tambah tes di `tests/interiorSekre.test.js`**

Ubah baris impor vitest paling atas menjadi `import { describe, it, expect, vi } from 'vitest';`, tambahkan dua impor
ini di bawah impor yang sudah ada:
```js
import { createSekreInteractables, strukturText, prokerText, rapatText } from '../src/interiors/sekre/interactables.js';
import { SEKRE_PHOTO_PRESETS, WINDOW_PEEK } from '../src/interiors/sekre/photo.js';
```
lalu tambahkan blok berikut di akhir file:
```js
describe('interaksi sekre', () => {
  const fakes = () => ({
    furniture: { pourWater: vi.fn(() => true), toggleFan: vi.fn(() => true), guitarWorldPosition: vi.fn((out) => Object.assign(out, { x: 1, y: 2, z: 3 })) },
    lighting: { toggleSwitch: vi.fn(() => false) },
    audio: { strum: vi.fn(), click: vi.fn() },
  });
  const ctx = () => ({ toast: vi.fn(), exit: vi.fn(), rig: { peek: vi.fn() }, hour: 12, raining: false });

  it('12 item berkontrak Interactable, handler sesuai tabel INTERAKSI', () => {
    const { items } = createSekreInteractables(fakes());
    expect(items.map((i) => i.id)).toEqual(D.INTERAKSI.map((i) => i.id));
    expect(items.every((i) => typeof i.onInteract === 'function')).toBe(true);
  });

  it('papan menampilkan teks dari data; aksi memanggil perabot/cahaya/audio/kamera/portal', () => {
    const f = fakes();
    const { items, update } = createSekreInteractables(f);
    const get = (id) => items.find((i) => i.id === id);
    expect(get('papan-struktur').onInteract(ctx()).text).toContain(D.STRUKTUR.inti[0].nama);
    expect(get('lemari-arsip').onInteract(ctx()).text).toContain('LPJ');
    const c = ctx();
    get('kipas').onInteract(c);
    get('saklar').onInteract(c);
    get('dispenser').onInteract(c);
    get('gitar').onInteract(c);
    get('jendela').onInteract(c);
    get('pintu').onInteract(c);
    expect(f.furniture.toggleFan).toHaveBeenCalled();
    expect(f.lighting.toggleSwitch).toHaveBeenCalled();
    expect(f.furniture.pourWater).toHaveBeenCalled();
    expect(f.audio.strum).toHaveBeenCalledWith('C', expect.any(Object));
    expect(c.rig.peek).toHaveBeenCalledWith(WINDOW_PEEK, 5);
    expect(c.exit).toHaveBeenCalledTimes(1);
    update();
    expect(get('gitar').pos).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('teks proker & rapat memuat semua butir', () => {
    for (const p of D.PROKER) expect(prokerText()).toContain(p.nama);
    for (const p of D.CATATAN_RAPAT.poin) expect(rapatText()).toContain(p);
    expect(strukturText()).toContain(D.STRUKTUR.divisi[0].koor);
  });

  it('4 preset foto spec §8.2 dengan pose valid', () => {
    expect(SEKRE_PHOTO_PRESETS.map((p) => p.id)).toEqual(['lesehan', 'pintu', 'pojok', 'atas']);
    for (const p of SEKRE_PHOTO_PRESETS) {
      expect(p.pose.position).toHaveLength(3);
      expect(p.pose.target).toHaveLength(3);
      expect(p.pose.position[1]).toBeLessThan(D.ROOM.h);
    }
  });
});
```

- [ ] **Step 3: Jalankan → FAIL** (`interactables.js` belum ada)

Run: `node node_modules/vitest/vitest.mjs run tests/interiorSekre.test.js`

- [ ] **Step 4: Tulis `src/interiors/sekre/interactables.js`**

```js
/**
 * Barang interaktif sekre (spec §8.2: ≥ 10): handler untuk tabel INTERAKSI di data.js → item berkontrak
 * Interactable (Interior.js). Teks dari data (bisa diganti user). onInteract(ctx) menerima ctx portal:
 * { rig, walker, toast(text, ok), exit(), hour, raining }. Kembalian {title, text} → kartu info; void → aksi.
 * Easter egg: lemari arsip ("LPJ yang belum selesai").
 */
import { INTERAKSI, ORGANISASI, STRUKTUR, PROKER, CATATAN_RAPAT, PIAGAM, KALENDER, TEKS, DATA_CONTOH } from './data.js';
import { WINDOW_PEEK } from './photo.js';

const CHORD_ORDER = Object.freeze(['C', 'G', 'Am', 'F']);
const STATUS_TEKS = Object.freeze({ selesai: '✓ selesai', berjalan: '● berjalan', rencana: '○ rencana' });
const contoh = () => (DATA_CONTOH ? `\n${TEKS.contoh}` : '');

export function strukturText() {
  const lines = [`${ORGANISASI.nama} — periode ${ORGANISASI.periode}`];
  for (const p of [...STRUKTUR.inti, ...STRUKTUR.sekben]) lines.push(`• ${p.jabatan}: ${p.nama}`);
  for (const d of STRUKTUR.divisi) lines.push(`• Divisi ${d.nama}: ${d.koor} (koor.), ${d.anggota.join(', ')}`);
  return lines.join('\n') + contoh();
}

export function prokerText() {
  const lines = PROKER.map((p) => `• ${p.bulan} — ${p.nama} (${STATUS_TEKS[p.status] ?? p.status})${p.catatan ? ` ${p.catatan}` : ''}`);
  return [`${ORGANISASI.kabinet} · ${ORGANISASI.periode}`, ...lines].join('\n') + contoh();
}

export function piagamText() {
  const lines = PIAGAM.map((p) => `• ${p.judul} ${p.tahun}: ${p.isi}`);
  return [...lines, TEKS.piala].join('\n') + contoh();
}

export function rapatText() {
  const R = CATATAN_RAPAT;
  return [
    `${R.judul} (${R.tanggal})`,
    ...R.poin.map((p) => `• ${p}`),
    `Pembagian: ${R.tabel.kolom.map((k, i) => `${k} → ${R.tabel.isi[i]}`).join(', ')}`,
    R.tenggat,
    `Di pojok papan: "${R.sudut}"`,
  ].join('\n') + contoh();
}

export function kalenderText() {
  const tanda = Object.entries(KALENDER.tanda).map(([d, t]) => `• ${d} Oktober: ${t}`);
  return [`Kalender ${KALENDER.bulan.toLowerCase()} — beberapa tanggal dilingkari spidol merah:`, ...tanda, `Coretan di bawah: "${KALENDER.coretan}"`].join('\n');
}

/**
 * @param {{furniture:{pourWater():boolean, toggleFan():boolean, guitarWorldPosition(out:object):object},
 *   lighting:{toggleSwitch():boolean}, audio:{strum(name:string, opts?:object):void, click():void}}} deps
 * @returns {{items: Array<object>, update(): void}}
 */
export function createSekreInteractables({ furniture, lighting, audio }) {
  const gitarPos = { ...INTERAKSI.find((i) => i.id === 'gitar').pos };
  let chord = 0;
  const handlers = {
    'papan-struktur': () => ({ title: `Struktur ${ORGANISASI.kabinet}`, text: strukturText() }),
    'papan-proker': () => ({ title: 'Program kerja', text: prokerText() }),
    piagam: () => ({ title: 'Piagam & piala', text: piagamText() }),
    'lemari-arsip': () => ({ title: 'Lemari arsip', text: TEKS.lemari }),
    gitar: (ctx) => {
      const name = CHORD_ORDER[chord];
      chord = (chord + 1) % CHORD_ORDER.length;
      audio.strum(name, { gain: 0.45 });
      ctx.toast(`Genjreng! (${name})`, true);
    },
    dispenser: (ctx) => {
      if (furniture.pourWater()) ctx.toast('Air galon mengucur ke gelas… galonnya tinggal seperempat.', true);
    },
    kipas: (ctx) => {
      const on = furniture.toggleFan();
      audio.click();
      ctx.toast(on ? 'Kipas menyala — kertas di meja ikut berkibar' : 'Kipas dimatikan', true);
    },
    saklar: (ctx) => {
      const on = lighting.toggleSwitch();
      audio.click();
      ctx.toast(on ? 'Lampu TL dinyalakan' : 'Lampu TL dimatikan', true);
    },
    jendela: (ctx) => {
      ctx.rig.peek(WINDOW_PEEK, 5);
      ctx.toast('Mengintip selasar… (E / Esc / W untuk kembali)', true);
    },
    whiteboard: () => ({ title: 'Catatan rapat di papan tulis', text: rapatText() }),
    pintu: (ctx) => { ctx.exit(); },
    kalender: () => ({ title: 'Kalender', text: kalenderText() }),
  };
  const items = INTERAKSI.map((it) => ({
    id: it.id,
    label: it.label,
    pos: it.id === 'gitar' ? gitarPos : { ...it.pos },
    radius: it.radius,
    prompt: it.prompt,
    onInteract: handlers[it.id],
  }));
  return {
    items,
    /** Posisi gitar mengikuti tangan NPC saat dimainkan (dipanggil tiap frame). */
    update() { furniture.guitarWorldPosition(gitarPos); },
  };
}
```

- [ ] **Step 5: Jalankan → PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/interiorSekre.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add src/interiors/sekre/interactables.js src/interiors/sekre/photo.js tests/interiorSekre.test.js
```
```
git commit -m "feat(interior): 12 barang interaktif sekre (papan, piagam, easter egg LPJ, gitar, dispenser, kipas, saklar, jendela, pintu, kalender) dan preset mode foto"
```

---

## Task 17: `lighting.js` — TL otomatis + saklar, cahaya jendela/pintu, sinar matahari, env map (+ tes fungsi murni)

**Files:**
- Create: `src/interiors/sekre/lighting.js`, `tests/sekreLighting.test.js`

- [ ] **Step 1: Tes gagal `tests/sekreLighting.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { tlAutoOn, windowSunFactor, sunLocalDirection } from '../src/interiors/sekre/lighting.js';
import { SELASAR } from '../src/interiors/sekre/data.js';

describe('tlAutoOn (spec §8.2: 17:30–06:00)', () => {
  it.each([[17.49, false], [17.5, true], [23, true], [0, true], [5.99, true], [6, false], [12, false], [24, true], [Number.NaN, true]])(
    'jam %s → %s', (h, on) => expect(tlAutoOn(h)).toBe(on),
  );
});

describe('windowSunFactor', () => {
  it('matahari di bawah horizon atau di balik dinding ruang → 0', () => {
    expect(windowSunFactor({ x: 0.5, y: -0.1, z: -0.8 })).toBe(0);
    expect(windowSunFactor({ x: 0.5, y: 0.3, z: 0.8 })).toBe(0);
  });
  it('matahari rendah sejajar selasar → lolos lewat ujung terbuka', () => {
    expect(windowSunFactor({ x: 1, y: 0.1, z: -0.05 })).toBe(1);
  });
  it('matahari tinggi → terhalang atap selasar', () => {
    expect(windowSunFactor({ x: 0.2, y: 0.9, z: -0.4 })).toBe(0);
  });
  it('selasar tanpa atap: matahari tinggi melewati atas deret seberang', () => {
    expect(windowSunFactor({ x: 0, y: 0.9, z: -0.4 }, { ...SELASAR, beratap: false })).toBe(1);
  });
});

describe('sunLocalDirection', () => {
  it('ruang diputar 90°: arah dunia +X menjadi lokal −Z', () => {
    const w = sunLocalDirection(9, { roomYaw: 0 });
    const l = sunLocalDirection(9, { roomYaw: Math.PI / 2 });
    expect(l.y).toBeCloseTo(w.y, 9);
    expect(Math.hypot(l.x, l.z)).toBeCloseTo(Math.hypot(w.x, w.z), 9);
    expect(l.z).toBeCloseTo(w.x, 6);   // rotasi Y sebesar −π/2: (x, z) → (−z, x)
    expect(l.x).toBeCloseTo(-w.z, 6);
  });
});
```

- [ ] **Step 2: Jalankan → FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/sekreLighting.test.js`

- [ ] **Step 3: Tulis `src/interiors/sekre/lighting.js`**

```js
/**
 * Cahaya sekre (spec §8.2):
 * - TL 2 tabung (PointLight tanpa bayangan + tabung emisif) menyala otomatis 17:30–06:00; saklar membalik keadaan
 *   sampai batas otomatis berikutnya; kedip starter singkat saat menyala dari saklar/otomatis.
 * - Cahaya langit lewat jendela nako & pintu (SpotLight tanpa bayangan) mengikuti preset jam game, redup saat hujan.
 * - Sinar matahari langsung (DirectionalLight, SATU-SATUNYA penebar bayangan → bayangan bilah nako & teralis di
 *   lantai) mengikuti azimut/elevasi matahari game; hanya muncul bila sinarnya lolos lewat ujung selasar
 *   (windowSunFactor). Debu melayang di cahaya jendela.
 * - Env map RoomEnvironment (PMREM) untuk kilap keramik/kaca; exposure interior lewat setExposure (App).
 * Jumlah lampu & castShadow tetap sepanjang hidup interior (tanpa kompilasi ulang shader); "mati" = intensitas 0,
 * peta bayangan tidak diperbarui saat tidak ada sinar (shadow.autoUpdate = false).
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { sunFromHour } from '../../sim/dayCycle.js';
import { directionFromAngles } from '../../world/Lighting.js';
import { makeRng } from '../../entities/util.js';
import { SELASAR, WINDOW, WINDOW_CENTER, DOOR, TL_POS } from './data.js';

export const TL_ON_FROM = 17.5;
export const TL_ON_UNTIL = 6;
const TL_INTENSITY = 9;
const WINDOW_SPOT = 16;
const DOOR_SPOT = 12;
const FLICKER_S = 0.6;
const MOTES = 80;
const UP = new THREE.Vector3(0, 1, 0);
const WHITE = new THREE.Color(0xffffff);

const wrapHour = (h) => (Number.isFinite(h) ? ((h % 24) + 24) % 24 : 0);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** TL menyala otomatis 17:30–06:00 (spec §8.2). */
export function tlAutoOn(hour) {
  const h = wrapHour(hour);
  return h >= TL_ON_FROM || h < TL_ON_UNTIL;
}

/** Arah ke matahari dalam koordinat ruang (ruang diputar roomYaw terhadap dunia, konvensi yaw entitas). */
export function sunLocalDirection(hour, { azimuthOffsetDeg = 0, roomYaw = 0 } = {}, out = new THREE.Vector3()) {
  const sun = sunFromHour(hour);
  directionFromAngles(sun.elevationDeg, sun.azimuthDeg + azimuthOffsetDeg, out);
  return out.applyAxisAngle(UP, -roomYaw);
}

/**
 * 0..1: sinar dari pusat jendela menuju matahari keluar lewat ujung selasar yang terbuka sebelum menabrak atap
 * selasar atau dinding deret seberang. Selasar tanpa atap: cukup lewat di atas dinding seberang. Murni.
 * @param {{x:number,y:number,z:number}} dir arah ke matahari (ruang-lokal)
 */
export function windowSunFactor(dir, s = SELASAR, w = WINDOW_CENTER) {
  if (!dir || !(dir.y > 0.02) || !(dir.z < -0.02)) return 0;
  const tWall = (s.zSeberang - w.z) / dir.z;
  if (!s.beratap && w.y + dir.y * tWall > s.tinggiAtap) return 1;
  const tRoof = s.beratap ? (s.tinggiAtap - w.y) / dir.y : Infinity;
  const xEnd = dir.x > 0 ? s.ujungKanan : s.ujungKiri;
  const tEnd = Math.abs(dir.x) > 1e-4 ? (xEnd - w.x) / dir.x : Infinity;
  return smoothstep(-0.3, 0.3, Math.min(tWall, tRoof) - tEnd);
}

function createMotes() {
  const rnd = makeRng(81);
  const pos = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i += 1) {
    pos.set([WINDOW.x - 0.6 + rnd() * 1.2, 0.8 + rnd() * 1.4, -2.9 + rnd() * 1.9], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff1d6, size: 0.012, transparent: true, opacity: 0, depthWrite: false }));
  motes.name = 'debu-jendela';
  return motes;
}

/**
 * @param {{renderer?: THREE.WebGLRenderer|null, scene: THREE.Scene}} opts
 */
export function createSekreLighting({ renderer = null, scene }) {
  const group = new THREE.Group();
  group.name = 'cahaya-sekre';
  const hemi = new THREE.HemisphereLight(0xdfe8f5, 0x6b4a3a, 0.2);
  const tl = TL_POS.map((p) => {
    const l = new THREE.PointLight(0xf2f6ff, 0, 0, 2);
    l.position.set(p.x, p.y - 0.15, p.z);
    return l;
  });
  const windowSpot = new THREE.SpotLight(0xffffff, 0, 0, Math.PI / 3, 0.85, 2);
  windowSpot.position.set(WINDOW_CENTER.x, 1.95, -3.5);
  windowSpot.target.position.set(-0.6, 0, 0.6);
  const doorSpot = new THREE.SpotLight(0xffffff, 0, 0, Math.PI / 3.2, 0.9, 2);
  doorSpot.position.set((DOOR.x0 + DOOR.x1) / 2, 2.0, -3.6);
  doorSpot.target.position.set(1.0, 0, 0);
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 0.5, far: 30 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 2;
  sun.shadow.blurSamples = 8;
  sun.shadow.autoUpdate = false;
  sun.target.position.set(WINDOW_CENTER.x, 0, -1.0);
  const laptopGlow = new THREE.PointLight(0x9cc4ff, 0, 3, 2);
  laptopGlow.position.set(1.5, 1.05, 1.2);
  const motes = createMotes();
  group.add(hemi, ...tl, windowSpot, windowSpot.target, doorSpot, doorSpot.target, sun, sun.target, laptopGlow, motes);

  let envRT = null;
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    envRT = pmrem.fromScene(roomEnv, 0.04);
    roomEnv.dispose();
    pmrem.dispose();
    scene.environment = envRT.texture;
  }

  let override = null; // null = ikut jadwal otomatis; true/false = ditimpa saklar
  let lastAuto = null;
  let flicker = 0;
  let on = false;
  let t = 0;
  const dir = new THREE.Vector3();
  const tint = new THREE.Color();

  return {
    group,
    get tlOn() { return on; },
    /** Saklar: balik keadaan TL sekarang; berlaku sampai batas otomatis berikutnya (17:30 / 06:00). */
    toggleSwitch() {
      override = !on;
      on = override;
      if (on) flicker = FLICKER_S;
      return on;
    },
    /**
     * @param {number} dt
     * @param {{hour:number, preset:object, azimuthOffsetDeg?:number, roomYaw?:number, rain?:number,
     *   laptopActive?:boolean, tlMaterial?:THREE.Material, screenMaterial?:THREE.Material, setExposure?:(v:number)=>void}} s
     */
    update(dt, s) {
      const d = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      t += d;
      const auto = tlAutoOn(s.hour);
      if (auto !== lastAuto) {
        if (lastAuto !== null) {
          override = null;
          if (auto) flicker = FLICKER_S;
        }
        lastAuto = auto;
      }
      on = override ?? auto;
      flicker = Math.max(0, flicker - d);
      const level = on ? (flicker > 0 && Math.sin(flicker * 47) < 0.3 ? 0.08 : 1) : 0;
      for (const l of tl) l.intensity = TL_INTENSITY * level;
      if (s.tlMaterial) s.tlMaterial.emissiveIntensity = 0.15 + 2.6 * level;

      const p = s.preset;
      const day = smoothstep(-4, 12, sunFromHour(s.hour).elevationDeg);
      const rain = clamp01(s.rain ?? 0);
      const wet = 1 - 0.55 * rain;
      hemi.intensity = (0.05 + 0.4 * p.hemiIntensity * day) * wet + 0.05 * level;
      hemi.color.setHex(p.hemiSky);
      tint.setHex(p.sunColor).lerp(WHITE, 0.55);
      windowSpot.color.copy(tint);
      doorSpot.color.copy(tint);
      windowSpot.intensity = WINDOW_SPOT * day * wet;
      doorSpot.intensity = DOOR_SPOT * day * wet;

      sunLocalDirection(s.hour, { azimuthOffsetDeg: s.azimuthOffsetDeg ?? 0, roomYaw: s.roomYaw ?? 0 }, dir);
      const beam = windowSunFactor(dir) * day * (1 - clamp01(rain * 2));
      sun.intensity = p.sunIntensity * 0.9 * beam;
      sun.color.setHex(p.sunColor);
      sun.position.copy(sun.target.position).addScaledVector(dir, 12);
      sun.shadow.autoUpdate = beam > 0.01;

      motes.material.opacity = (0.15 + 0.5 * beam) * day * wet;
      motes.position.y = 0.04 * Math.sin(t * 0.3);
      const laptop = Boolean(s.laptopActive);
      laptopGlow.intensity = laptop ? (level > 0.5 ? 0.25 : 0.9) : 0;
      if (s.screenMaterial) s.screenMaterial.emissiveIntensity = laptop ? 1.4 : 0;
      if (scene.background?.isColor) scene.background.setHex(p.fogColor).multiplyScalar(0.6 + 0.4 * wet);
      scene.environmentIntensity = 0.08 + 0.25 * day * wet + 0.12 * level;
      s.setExposure?.(0.92 + 0.08 * day * (1 - level));
    },
    /** Lepas sumber daya di luar pohon scene: peta bayangan & env map. */
    dispose() {
      sun.shadow.dispose();
      if (envRT && scene.environment === envRT.texture) scene.environment = null;
      envRT?.dispose();
    },
  };
}
```

Nilai intensitas (TL 9, jendela 16, pintu 12, eksposur 0,92–1,0) adalah titik awal; penyetelan visual di Task 20
boleh mengubahnya ±50% (catat nilai akhir di komentar konstanta).

- [ ] **Step 4: Jalankan → PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/sekreLighting.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add src/interiors/sekre/lighting.js tests/sekreLighting.test.js
```
```
git commit -m "feat(interior): cahaya sekre (TL otomatis 17:30–06:00 + saklar + kedip starter, cahaya jendela/pintu, sinar matahari lewat ujung selasar, env map ruangan)"
```

---

## Task 18: `audio.js` — kipas, gitar, gumaman, hujan di atap seng

**Files:**
- Create: `src/interiors/sekre/audio.js`

- [ ] **Step 1: Tulis `src/interiors/sekre/audio.js`**

```js
/**
 * Suara sekre (spec §8.2; prosedural via AudioBus — tanpa berkas berlisensi): dengung kipas (S14 menyala),
 * gumaman obrolan (sebanding NPC yang rapat/ngobrol), hujan di atap seng (weather.intensity), genjrengan gitar
 * Karplus-Strong (NPC bergitar memainkan progresi C–G–Am–F; E pada gitar = satu genjreng), klik saklar/kipas.
 * Semua lewat kanal 'ambience' (volume "Suasana" di pengaturan). Tanpa Web Audio semuanya no-op.
 * dispose() menghentikan semua loop.
 */
export const SEKRE_CHORDS = Object.freeze({
  C: Object.freeze([130.81, 164.81, 196.0, 261.63, 329.63]),
  G: Object.freeze([98.0, 123.47, 146.83, 196.0, 246.94, 392.0]),
  Am: Object.freeze([110.0, 164.81, 220.0, 261.63, 329.63]),
  F: Object.freeze([87.31, 130.81, 174.61, 220.0, 261.63, 349.23]),
});
const PROGRESSION = Object.freeze(['C', 'G', 'Am', 'F']);
const LEVEL = Object.freeze({ fan: 0.07, rain: 0.22, murmur: 0.06, strumNpc: 0.12, click: 0.05 });
const BEAT_S = 0.55;
const STRUM_GAP_S = 0.014;

/** @param {{audioBus?: object|null}} opts */
export function createSekreAudio({ audioBus = null } = {}) {
  const bus = audioBus;
  const fan = bus?.startFanHum?.() ?? null;
  const rain = bus?.startRainOnTin?.() ?? null;
  const murmur = bus?.startMurmur?.() ?? null;
  let strumT = 0;
  let beat = 0;

  /** Genjreng satu akor (turun/naik), senar berjarak 14 ms, volume senar sedikit bervariasi (deterministik). */
  const strum = (name, { gain = 0.45, down = true } = {}) => {
    const notes = SEKRE_CHORDS[name] ?? SEKRE_CHORDS.C;
    (down ? notes : [...notes].reverse()).forEach((hz, i) => {
      bus?.pluck?.(hz, { gain: gain * (0.85 + 0.15 * (((i * 7) % 5) / 4)), at: i * STRUM_GAP_S });
    });
  };

  return {
    strum,
    click() { bus?.pluck?.(2400, { gain: LEVEL.click, seconds: 0.06 }); },
    /** @param {number} dt @param {{fanOn:boolean, rain:number, talkers:number, gitar:boolean}} s */
    update(dt, s) {
      fan?.setLevel(s.fanOn ? LEVEL.fan : 0);
      rain?.setLevel(LEVEL.rain * Math.min(1, Math.max(0, s.rain ?? 0)));
      murmur?.setLevel(LEVEL.murmur * Math.min(1, (s.talkers ?? 0) / 4));
      if (!s.gitar) {
        strumT = 0;
        return;
      }
      strumT -= Number.isFinite(dt) ? dt : 0;
      if (strumT > 0) return;
      strumT = BEAT_S;
      strum(PROGRESSION[Math.floor(beat / 4) % PROGRESSION.length], { gain: LEVEL.strumNpc, down: beat % 2 === 0 });
      beat += 1;
    },
    dispose() {
      for (const l of [fan, rain, murmur]) l?.stop?.();
    },
  };
}
```

- [ ] **Step 2: Lint & commit**

Run: `npm run lint` → 0 galat.
```
git add src/interiors/sekre/audio.js
```
```
git commit -m "feat(interior): suara sekre prosedural (dengung kipas, gumaman obrolan, hujan di atap seng, genjrengan gitar C–G–Am–F)"
```

---

## Task 19: `index.js` — rakit interior sekre

**Files:**
- Create: `src/interiors/sekre/index.js`

- [ ] **Step 1: Tulis `src/interiors/sekre/index.js`**

```js
/**
 * Interior sekre (spec §8.2): createSekreInterior({ exitTo }) → InteriorDef (defineInterior, spec §4.8).
 * exitTo dari composition root (sekreExitTo() M4 di main.js) karena src/interiors tidak boleh mengimpor
 * regions. Build: scene sendiri (matrixWorldAutoUpdate false; App.render memperbarui matriks sekali per frame),
 * perabot/papan/ruang statis digabung per material (budget ≤ 150 draw call), NPC terjadwal, cahaya, suara,
 * GLB di belakang layar (placeholder tampil dulu), papan digambar ulang setelah font siap. Semua dibangun di
 * ResourceScope interior (ctx.scope) sehingga material Humanoid/GLB dilepas bersama scope saat keluar.
 */
import * as THREE from 'three';
import { defineInterior } from '../Interior.js';
import { createRoomCollider } from '../roomCollider.js';
import { withScope } from '../../engine/ResourceScope.js';
import { freezeStatic } from '../../engine/freezeStatic.js';
import { mergeByMaterial } from '../../world/util/merge.js';
import { lightingPreset } from '../../sim/dayCycle.js';
import { ROOM, SPAWN, SOLIDS, TALL_SOLIDS, ROOM_YAW_OFFSET } from './data.js';
import { buildRoom } from './room.js';
import { buildFurniture, createSekreMaterials } from './furniture.js';
import { buildBoards } from './boards.js';
import { createSekreNpcs } from './npcs.js';
import { createSekreInteractables } from './interactables.js';
import { createSekreLighting } from './lighting.js';
import { createSekreAudio } from './audio.js';
import { SEKRE_PHOTO_PRESETS } from './photo.js';

export const SEKRE_ID = 'sekre';
const FALLBACK_PRESET = lightingPreset(12);

/** Gabung semua mesh statis per material; geometri sumber yang sudah tergabung dilepas. */
export function mergeStatic(root) {
  const sources = new Set();
  root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.geometry) sources.add(o.geometry); });
  const merged = mergeByMaterial(root);
  const used = new Set();
  merged.traverse((o) => { if (o.geometry) used.add(o.geometry); });
  for (const g of sources) if (!used.has(g)) g.dispose();
  return merged;
}

/** @param {{exitTo:{region:string,x:number,z:number,yaw:number}}} opts */
export function createSekreInterior({ exitTo }) {
  return defineInterior({
    id: SEKRE_ID, label: 'Sekretariat', size: { w: ROOM.w, d: ROOM.d, h: ROOM.h }, spawn: SPAWN, exitTo, build: buildSekre,
  });
}

/**
 * @param {{scope:object, renderer?:THREE.WebGLRenderer|null, audioBus?:object|null, time?:object|null,
 *   weather?:object|null, door?:{worldYaw:number}|null, fov?:number, setExposure?:(v:number)=>void}} ctx
 */
async function buildSekre(ctx) {
  let disposed = false;
  const scene = new THREE.Scene();
  scene.name = 'interior:sekre';
  scene.matrixWorldAutoUpdate = false;
  scene.background = new THREE.Color(0x9fb4c8);
  const camera = new THREE.PerspectiveCamera(Number.isFinite(ctx.fov) ? ctx.fov : 70, 1, 0.05, 80);
  camera.name = 'kamera-sekre';
  const roomYaw = Number.isFinite(ctx.door?.worldYaw) ? ctx.door.worldYaw + ROOM_YAW_OFFSET : 0;

  const { materials, room, furniture, boards, npcs, lighting } = withScope(ctx.scope, () => {
    const mats = createSekreMaterials(ctx.renderer ?? null);
    const furn = buildFurniture({ materials: mats });
    return {
      materials: mats,
      room: buildRoom({ renderer: ctx.renderer ?? null }),
      furniture: furn,
      boards: buildBoards({ renderer: ctx.renderer ?? null, materials: mats }),
      npcs: createSekreNpcs({ props: furn.props }),
      lighting: createSekreLighting({ renderer: ctx.renderer ?? null, scene }),
    };
  });
  const staticRoot = new THREE.Group();
  staticRoot.add(room.staticGroup, furniture.staticGroup, boards.group);
  const merged = mergeStatic(staticRoot);
  merged.name = 'sekre-statis';
  scene.add(merged, room.dynamicGroup, furniture.dynamicGroup, npcs.group, lighting.group);
  freezeStatic(merged);

  const colliders = createRoomCollider({
    halfW: ROOM.w / 2, halfD: ROOM.d / 2, solids: SOLIDS, tallSolids: TALL_SOLIDS, blockers: () => npcs.blockers(),
  });
  const audio = createSekreAudio({ audioBus: ctx.audioBus ?? null });
  const interactables = createSekreInteractables({ furniture, lighting, audio });
  const isCancelled = () => disposed;
  const ready = Promise.allSettled([
    withScope(ctx.scope, () => furniture.loadModels(isCancelled)),
    boards.redrawWhenFontsReady(isCancelled),
  ]);

  const hour = () => (Number.isFinite(ctx.time?.hour) ? ctx.time.hour : 12);
  const rain = () => (Number.isFinite(ctx.weather?.intensity) ? ctx.weather.intensity : 0);
  const systems = [
    { id: 'interior.sekre.npcs', phase: 'sim', update: (dt) => npcs.update(dt, hour()) },
    {
      id: 'interior.sekre.props',
      phase: 'sim',
      update: (dt) => {
        furniture.update(dt);
        interactables.update();
        room.update(dt, { rain: rain() });
      },
    },
    {
      id: 'interior.sekre.lighting',
      phase: 'world',
      update: (dt) => lighting.update(dt, {
        hour: hour(), preset: ctx.time?.preset ?? FALLBACK_PRESET, azimuthOffsetDeg: ctx.time?.overrides?.azimuthOffset ?? 0,
        roomYaw, rain: rain(), laptopActive: npcs.isActive('laptop'), tlMaterial: materials.tl, screenMaterial: materials.screen,
        setExposure: ctx.setExposure,
      }),
    },
    {
      id: 'interior.sekre.audio',
      phase: 'world',
      update: (dt) => audio.update(dt, { fanOn: furniture.fanOn, rain: rain(), talkers: npcs.talkers, gitar: npcs.isActive('gitar') }),
    },
  ];

  return {
    scene,
    camera,
    colliders,
    interactables: interactables.items,
    photoPresets: SEKRE_PHOTO_PRESETS,
    systems,
    ready,
    /** Akses dev/E2E (window.__sim.portal.current.built.debug). */
    debug: { npcs, lighting, furniture },
    /** Sumber daya di luar pohon scene; pohon scene + scope dilepas portal. */
    dispose() {
      disposed = true;
      audio.dispose();
      npcs.dispose();
      lighting.dispose();
      furniture.dispose();
    },
  };
}
```

- [ ] **Step 2: Lint & tes**

Run: `npm run lint` lalu `npm test`
Expected: 0 galat; semua tes PASS.

- [ ] **Step 3: Commit**

```
git add src/interiors/sekre/index.js
```
```
git commit -m "feat(interior): rakit interior sekre (statis digabung per material, NPC, interaksi, cahaya, suara, GLB latar)"
```

---

## Task 20: Pasang interior sekre di portal + bantuan F1 + uji asap penuh

**Files:**
- Modify: `src/main.js` (fungsi `setupPortal`), `src/app/interiorPortal.js` (hapus `createStubInterior`),
  `src/ui/mountSettingsPanel.js`

- [ ] **Step 1: Ganti interior stub dengan sekre di `src/main.js`**

Impor:
```js
import { createSekreInterior, SEKRE_ID } from './interiors/sekre/index.js';
```
Di `setupPortal`, ganti baris `const interiors = new Map([['sekre', createStubInterior(...)]]);` (Task 10) menjadi:
```js
  const interiors = new Map([[SEKRE_ID, createSekreInterior({ exitTo: sekreExitTo() })]]);
```
Hapus `createStubInterior` dari impor `./app/interiorPortal.js`; hapus juga impor/variabel yang hanya dipakai label
stub (`ormawa`, dan `LEMBAGA_LAYOUT`/`PLAYER_ROOM_INDEX` bila ESLint menandainya tidak terpakai).

- [ ] **Step 2: Hapus `createStubInterior` dari `src/app/interiorPortal.js`**

Hapus fungsi `createStubInterior` beserta impor yang hanya dipakainya (`import * as THREE from 'three';`,
`createTextTexture`). Interior stub tidak dipakai lagi (M4 serah terima: "M5 cukup mengganti createStubInterior").

- [ ] **Step 3: Bantuan F1 — `src/ui/mountSettingsPanel.js`**

Tambahkan di akhir array `SIM_HELP_ITEMS` (sebelum `]);`):
```js
  { group: 'Sekre (interior)' },
  { keys: ['E'], text: 'Di depan pintu sekre: masuk · di dalam: pakai barang yang dilihat' },
  { keys: ['W', 'A', 'S', 'D'], text: 'Jalan kaki (A/D geser)' },
  { keys: ['Shift'], text: 'Lari' },
  { keys: ['Mouse'], text: 'Melihat sekeliling' },
  { keys: ['V'], text: 'Orang pertama / orang ketiga' },
  { keys: ['P'], text: 'Mode foto: 1–4 preset (lesehan, pintu, pojok, atas), W/A/S/D + Q/E kamera bebas' },
  { keys: ['Esc'], text: 'Keluar sekre (atau tutup kartu info)' },
```
(Tombol angka 1–4 hanya berlaku di mode foto interior; di luar, Digit1–8 tetap POV — Digit8 = POV region M0.)

- [ ] **Step 4: Tes, lint, build**

Run: `npm test` lalu `npm run lint` lalu `npm run build`
Expected: semua PASS; 0 galat; build sukses.

- [ ] **Step 5: Uji asap penuh di browser (dev server)**

`preview_start` nama `stadion-dev` (atau Playwright GPU ke `http://localhost:5173`). Di konsol:
```js
const d = __sim.portal.doors().find((x) => x.interiorId === 'sekre'); __sim.teleport(d.world.x, d.world.z, d.worldYaw + Math.PI);
```
(region `unri-lembaga` harus sudah terpasang: tunggu beberapa detik setelah teleport, ulangi bila `doors()` kosong.)
Checklist (semua harus benar):
1. Prompt "Tekan E — Masuk sekre" (portalTrigger M4) muncul; E → layar memudar → di dalam sekre, mata 1,55 m
   menghadap ke dalam.
2. Konsol tanpa galat; `__sim.app.systems.ids` memuat `interior.*`; `__sim.portal.state === 'inside'`.
3. W/A/S/D/Shift jalan; tidak menembus dinding/meja/lemari/NPC; mouse melihat; V → orang ketiga (kamera tidak
   menembus plafon/dinding), V lagi → orang pertama.
4. Semua 12 interaksi: papan struktur/proker/piagam/whiteboard/kalender/lemari (kartu info, E/Esc menutup),
   gitar (bunyi + toast), dispenser (gelas terisi), kipas (berputar, menoleh, kertas berkibar, dengung), saklar
   (TL padam/menyala), jendela (kamera mengintip selasar 5 s), pintu (keluar).
5. P → mode foto (UI hilang), 1–4 preset, W/A/S/D/Q/E terbang; P/Esc keluar mode foto TANPA keluar sekre.
6. `__sim.store.set('sky.hour', 21)` → TL menyala (kedip), NPC begadang (laptop + papan + lesehan), layar laptop
   menyala; `__sim.store.set('sky.hour', 10)` → rapat lesehan 4–5 orang; R → hujan: cahaya jendela meredup, suara
   hujan di seng, lantai selasar basah, hujan terlihat di ujung selasar.
7. Esc → keluar; sepeda tetap di posisi semula (bandingkan `__sim.ents.bike.state` sebelum/sesudah), minimap
   kembali, HUD kecepatan muncul; `tests/e2e/lembaga.e2e.mjs` (M4, siklus portal 3×) tetap lulus.
8. Penyetelan visual yang diizinkan (dicatat di pesan commit): intensitas cahaya (Task 17), sudut pose ±0,3 rad
   (Task 6, terutama kaki bersila tidak menembus lantai & tangan kiri di leher gitar), `GUITAR_HOLD`, posisi slot
   NPC ±0,15 m. Ulangi `npm test` setelah penyetelan.

- [ ] **Step 6: Commit**

```
git add src/main.js src/app/interiorPortal.js src/ui/mountSettingsPanel.js
```
```
git commit -m "feat: pintu sekre membuka interior sekre penuh (stub M4 diganti), bantuan F1 interior"
```
Bila Step 5 butuh penyetelan visual, commit terpisah:
```
git add src/interiors/sekre/lighting.js src/entities/Humanoid.poses.js src/interiors/sekre/data.js
```
```
git commit -m "fix(interior): setel cahaya, pose, dan slot NPC sekre setelah uji visual"
```

---

## Task 21: Aset GLB Blender (S07, S13, S14, S15, S17, S19, S20)

**Files:**
- Create: `assets-src/blender/unri/sekre_assets.py`, `assets-src/blender/unri/<id>.blend` ×7,
  `public/models/unri/<id>.glb` ×7
- Modify: `src/interiors/sekre/data.js` (`GLB_ASET`)

Nama file (`<id>`): `s07-piala`, `s13-dispenser-galon`, `s14-kipas-berdiri`, `s15-printer-tua`, `s17-laptop`,
`s19-gitar-akustik`, `s20-tas-ransel`. Konvensi (katalog): meter, origin tengah alas, **depan menghadap +Y Blender**
(= −Z three setelah ekspor Y-up), satu material per objek bernama `unri:<nama>`, ekspor lewat
`assets-src/blender/export_glb.py` (gabung per material). Bila Blender MCP tidak tersedia/terputus, lewati task
ini: placeholder prosedural sudah memenuhi kriteria (spec §10); catat di serah terima.

- [ ] **Step 1: Tulis `assets-src/blender/unri/sekre_assets.py`**

```python
"""
Aset interior sekre (M5) untuk Blender, dijalankan lewat Blender MCP (execute_blender_code):

    import runpy
    ns = runpy.run_path(r"C:\\Users\\mocha\\Documents\\stadion-utama-riau-3d\\assets-src\\blender\\unri\\sekre_assets.py")
    print(ns["build"]("s07-piala"))

Konvensi katalog: meter, origin di tengah alas, DEPAN menghadap +Y Blender (= -Z three.js setelah ekspor Y-up),
satu material per objek bernama "unri:<nama>" (warna di Principled BSDF, node dicari per tipe). build() membuka
file kosong (read_homefile use_empty, add-on tetap aktif) dan MENOLAK bila file yang terbuka punya perubahan belum
disimpan, membangun koleksi, mengekspor GLB lewat export_glb.py, lalu menyimpan .blend.
"""
import math
import os
import runpy

import bpy

REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
EXPORT_PY = os.path.join(REPO, "assets-src", "blender", "export_glb.py")
PI = math.pi


def _socket(bsdf, *names):
    for n in names:
        s = bsdf.inputs.get(n)
        if s is not None:
            return s
    for s in bsdf.inputs:
        if s.identifier in names:
            return s
    return None


def material(name, rgb, rough=0.6, metal=0.0, alpha=1.0, emission=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    _socket(bsdf, "Base Color").default_value = (*rgb, 1.0)
    _socket(bsdf, "Roughness").default_value = rough
    _socket(bsdf, "Metallic").default_value = metal
    if alpha < 1.0:
        _socket(bsdf, "Alpha").default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except (AttributeError, TypeError):
            m.blend_method = "BLEND"
    if emission:
        _socket(bsdf, "Emission Color", "Emission").default_value = (*emission, 1.0)
        _socket(bsdf, "Emission Strength").default_value = 2.0
    return m


def fresh(coll_name):
    if bpy.data.is_dirty:
        raise RuntimeError("File Blender yang terbuka punya perubahan belum disimpan: minta user menyimpan dulu.")
    bpy.ops.wm.read_homefile(use_empty=True)
    coll = bpy.data.collections.new(coll_name)
    bpy.context.scene.collection.children.link(coll)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[coll.name]
    return coll


def _finish(o, name, mat):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def box(name, size, loc, mat, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    return _finish(o, name, mat)


def cyl(name, r, depth, loc, mat, rot=(0, 0, 0), verts=24, r2=None, caps=True):
    fill = "NGON" if caps else "NOTHING"
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot, end_fill_type=fill)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, vertices=verts, location=loc, rotation=rot, end_fill_type=fill)
    return _finish(bpy.context.active_object, name, mat)


def torus(name, major, minor, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=24, minor_segments=8, location=loc, rotation=rot)
    return _finish(bpy.context.active_object, name, mat)


def sphere(name, r, loc, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=16, ring_count=8, location=loc)
    return _finish(bpy.context.active_object, name, mat)


def solidify(o, t):
    mod = o.modifiers.new("Tebal", "SOLIDIFY")
    mod.thickness = t
    return o


# ---------------- aset ----------------

def s07_piala():
    emas = material("unri:emas", (0.83, 0.62, 0.2), rough=0.28, metal=1.0)
    kayu = material("unri:alas-kayu", (0.2, 0.13, 0.09), rough=0.5)
    marmer = material("unri:marmer", (0.9, 0.88, 0.84), rough=0.3)
    box("alas", (0.15, 0.15, 0.05), (0, 0, 0.025), kayu, bevel=0.004)
    box("marmer", (0.11, 0.11, 0.07), (0, 0, 0.085), marmer, bevel=0.003)
    cyl("batang", 0.025, 0.1, (0, 0, 0.17), emas, r2=0.012, verts=20)
    solidify(cyl("cawan", 0.03, 0.13, (0, 0, 0.285), emas, r2=0.065, verts=32, caps=False), 0.004)
    cyl("dasar-cawan", 0.03, 0.004, (0, 0, 0.222), emas, verts=20)
    torus("pegangan-kiri", 0.035, 0.007, (-0.07, 0, 0.29), emas, rot=(PI / 2, 0, 0))
    torus("pegangan-kanan", 0.035, 0.007, (0.07, 0, 0.29), emas, rot=(PI / 2, 0, 0))
    torus("bibir", 0.066, 0.005, (0, 0, 0.35), emas)
    cyl("leher-hiasan", 0.012, 0.05, (0, 0, 0.39), emas, r2=0.004, verts=12)
    sphere("bintang", 0.022, (0, 0, 0.43), emas)
    box("plakat", (0.06, 0.003, 0.02), (0, 0.0565, 0.085), emas)
    return "UNRI_S07_Piala"


def s13_dispenser():
    badan = material("unri:dispenser-badan", (0.92, 0.93, 0.94), rough=0.35)
    detail = material("unri:dispenser-detail", (0.45, 0.5, 0.53), rough=0.5)
    merah = material("unri:kran-merah", (0.8, 0.12, 0.12), rough=0.4)
    biru = material("unri:kran-biru", (0.1, 0.45, 0.85), rough=0.4)
    galon = material("unri:galon-kaca", (0.55, 0.77, 0.92), rough=0.08, alpha=0.5)
    air = material("unri:air", (0.37, 0.66, 0.83), rough=0.05)
    box("badan", (0.32, 0.32, 0.9), (0, 0, 0.45), badan, bevel=0.012)
    box("panel-kran", (0.26, 0.01, 0.28), (0, 0.165, 0.62), detail, bevel=0.003)
    cyl("kran-panas", 0.012, 0.05, (-0.05, 0.19, 0.66), merah, rot=(PI / 2, 0, 0), verts=16)
    cyl("kran-dingin", 0.012, 0.05, (0.05, 0.19, 0.66), biru, rot=(PI / 2, 0, 0), verts=16)
    box("tatakan", (0.2, 0.1, 0.02), (0, 0.2, 0.5), detail, bevel=0.003)
    box("leher", (0.3, 0.3, 0.04), (0, 0, 0.92), detail, bevel=0.005)
    cyl("galon-leher", 0.05, 0.04, (0, 0, 0.96), galon, r2=0.135, verts=32)
    cyl("galon", 0.135, 0.27, (0, 0, 1.115), galon, verts=32)
    cyl("air-sisa", 0.128, 0.07, (0, 0, 1.015), air, verts=32)
    return "UNRI_S13_Dispenser"


def s14_kipas():
    badan = material("unri:kipas-badan", (0.9, 0.9, 0.9), rough=0.4)
    kepala = material("unri:kipas-kepala", (0.82, 0.83, 0.85), rough=0.35, metal=0.3)
    baling = material("unri:kipas-baling", (0.31, 0.76, 0.97), rough=0.2, alpha=0.85)
    cyl("dasar", 0.22, 0.04, (0, 0, 0.02), badan, r2=0.2, verts=40)
    cyl("tiang", 0.018, 0.98, (0, 0, 0.53), badan, verts=16)
    box("tombol", (0.06, 0.05, 0.08), (0, 0.03, 0.32), badan, bevel=0.006)
    cyl("motor", 0.08, 0.14, (0, -0.09, 1.05), kepala, rot=(PI / 2, 0, 0), r2=0.07, verts=24)
    torus("ring-dalam", 0.21, 0.006, (0, 0.03, 1.05), kepala, rot=(PI / 2, 0, 0))
    torus("ring-luar", 0.21, 0.006, (0, 0.1, 1.05), kepala, rot=(PI / 2, 0, 0))
    for i in range(12):
        a = i / 12 * 2 * PI
        box(f"ruji-{i}", (0.005, 0.005, 0.21), (math.cos(a) * 0.105, 0.1, 1.05 + math.sin(a) * 0.105), kepala, rot=(0, a - PI / 2, 0))
        box(f"ruji-tepi-{i}", (0.004, 0.07, 0.004), (math.cos(a) * 0.21, 0.065, 1.05 + math.sin(a) * 0.21), kepala)
    cyl("hub", 0.03, 0.03, (0, 0.065, 1.05), baling, rot=(PI / 2, 0, 0), verts=16)
    for i in range(3):
        a = i * 2 * PI / 3
        b = box(f"bilah-{i}", (0.075, 0.008, 0.17), (math.sin(a) * 0.1, 0.065, 1.05 + math.cos(a) * 0.1), baling, bevel=0.01)
        b.rotation_euler = (0.0, a, 0.0)          # sebar 120° di bidang depan (sumbu Y = arah tiup)
        b.rotation_euler.rotate_axis("Z", 0.3)    # sudut serang bilah
    return "UNRI_S14_Kipas"


def s15_printer():
    badan = material("unri:printer-badan", (0.84, 0.82, 0.77), rough=0.45)
    gelap = material("unri:printer-gelap", (0.2, 0.2, 0.21), rough=0.5)
    kertas = material("unri:kertas", (0.97, 0.97, 0.95), rough=0.8)
    box("badan", (0.45, 0.38, 0.2), (0, 0, 0.1), badan, bevel=0.015)
    box("penutup", (0.42, 0.2, 0.03), (0, -0.05, 0.215), badan, bevel=0.006)
    box("baki-keluar", (0.3, 0.15, 0.01), (0, 0.24, 0.2), gelap, rot=(-0.3, 0, 0))
    box("kertas", (0.28, 0.12, 0.002), (0, 0.24, 0.21), kertas, rot=(-0.3, 0, 0))
    box("panel", (0.1, 0.005, 0.03), (0.14, 0.191, 0.15), gelap)
    return "UNRI_S15_Printer"


def s17_laptop():
    badan = material("unri:laptop-badan", (0.23, 0.24, 0.26), rough=0.35, metal=0.4)
    keyboard = material("unri:keyboard", (0.08, 0.08, 0.09), rough=0.6)
    layar = material("unri:layar-emisif", (0.03, 0.04, 0.05), rough=0.2, emission=(0.6, 0.75, 1.0))
    box("alas", (0.34, 0.24, 0.018), (0, 0, 0.009), badan, bevel=0.004)
    box("keyboard", (0.3, 0.12, 0.002), (0, -0.03, 0.019), keyboard)
    box("touchpad", (0.09, 0.06, 0.001), (0, 0.075, 0.019), keyboard)
    tilt = 0.26                                    # tutup terbuka ±105°, miring ke belakang (−Y)
    cy = -0.12 - math.sin(tilt) * 0.11
    cz = 0.018 + math.cos(tilt) * 0.11
    box("tutup", (0.34, 0.008, 0.22), (0, cy, cz), badan, rot=(-tilt, 0, 0), bevel=0.003)
    box("layar", (0.3, 0.001, 0.18), (0, cy + 0.0045 * math.cos(tilt), cz + 0.0045 * math.sin(tilt)), layar, rot=(-tilt, 0, 0))
    return "UNRI_S17_Laptop"


def s19_gitar():
    kayu = material("unri:gitar-kayu", (0.79, 0.55, 0.29), rough=0.35)
    leher = material("unri:gitar-leher", (0.29, 0.18, 0.11), rough=0.45)
    hitam = material("unri:gitar-hitam", (0.04, 0.04, 0.04), rough=0.5)
    senar = material("unri:senar", (0.85, 0.85, 0.82), rough=0.25, metal=1.0)
    cyl("badan-bawah", 0.19, 0.1, (0, 0, 0.21), kayu, rot=(PI / 2, 0, 0), verts=40)
    cyl("badan-atas", 0.145, 0.1, (0, 0, 0.45), kayu, rot=(PI / 2, 0, 0), verts=36)
    box("pinggang", (0.26, 0.1, 0.12), (0, 0, 0.33), kayu)
    cyl("lubang-suara", 0.055, 0.004, (0, 0.051, 0.4), hitam, rot=(PI / 2, 0, 0), verts=24)
    box("bridge", (0.1, 0.02, 0.012), (0, 0.055, 0.12), hitam)
    box("leher", (0.05, 0.03, 0.42), (0, 0, 0.77), leher)
    box("kepala", (0.075, 0.025, 0.13), (0, 0, 0.935), leher, bevel=0.005)
    for i in range(6):
        x = -0.0125 + i * 0.005
        cyl(f"senar-{i}", 0.0008, 0.8, (x, 0.04, 0.52), senar, verts=6)
        cyl(f"pasak-{i}", 0.006, 0.03, (-0.045 if i < 3 else 0.045, 0, 0.9 + (i % 3) * 0.035), senar, rot=(0, PI / 2, 0), verts=8)
    return "UNRI_S19_Gitar"


def s20_tas():
    kain = material("unri:tas-kain", (0.12, 0.16, 0.27), rough=0.85)
    aksen = material("unri:tas-aksen", (0.85, 0.36, 0.12), rough=0.6)
    box("badan", (0.3, 0.18, 0.42), (0, 0, 0.21), kain, bevel=0.05)
    box("saku", (0.22, 0.06, 0.18), (0, 0.1, 0.14), kain, bevel=0.025)
    box("ritsleting", (0.2, 0.004, 0.006), (0, 0.131, 0.22), aksen)
    torus("pegangan", 0.04, 0.008, (0, 0, 0.43), aksen, rot=(PI / 2, 0, 0))
    box("tali-kiri", (0.04, 0.02, 0.36), (-0.08, -0.095, 0.24), aksen)
    box("tali-kanan", (0.04, 0.02, 0.36), (0.08, -0.095, 0.24), aksen)
    return "UNRI_S20_Tas"


BUILDERS = {
    "s07-piala": s07_piala,
    "s13-dispenser-galon": s13_dispenser,
    "s14-kipas-berdiri": s14_kipas,
    "s15-printer-tua": s15_printer,
    "s17-laptop": s17_laptop,
    "s19-gitar-akustik": s19_gitar,
    "s20-tas-ransel": s20_tas,
}


def build(stem, ratios=None):
    """Bangun aset `stem`, ekspor GLB ke public/models/unri/, simpan .blend; kembalikan ringkasan."""
    coll = fresh(f"UNRI_{stem}")
    coll.name = BUILDERS[stem]()
    exporter = runpy.run_path(EXPORT_PY)
    glb = os.path.join(REPO, "public", "models", "unri", f"{stem}.glb")
    meshes, tris, kb = exporter["export_collection"](coll.name, glb, ratios=ratios or {})
    blend = os.path.join(REPO, "assets-src", "blender", "unri", f"{stem}.blend")
    os.makedirs(os.path.dirname(blend), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    return {"aset": stem, "mesh": meshes, "segitiga": tris, "kb": kb, "glb": glb, "blend": blend}
```

Kepala (`unri:kipas-kepala`) dan baling (`unri:kipas-baling`) kipas wajib material terpisah: runtime mencarinya
per nama material (`furniture.js` `bindFanModel`) dan memutar baling di pusat kotak batasnya; pusat kepala harus di
ketinggian 1,05 m (sama dengan placeholder).

- [ ] **Step 2: Cek Blender lewat MCP**

Panggil `get_addon_status` lalu `get_scene_info`. Expected: Blender terhubung. Lalu `execute_blender_code`:
```python
import bpy; print(bpy.app.version_string, bpy.data.filepath, bpy.data.is_dirty)
```
Bila `is_dirty` True: BERHENTI dan minta user menyimpan file Blender yang terbuka (build() akan menolak).

- [ ] **Step 3: Bangun ketujuh aset (satu panggilan per aset)**

Untuk setiap `stem` di `s07-piala, s13-dispenser-galon, s14-kipas-berdiri, s15-printer-tua, s17-laptop,
s19-gitar-akustik, s20-tas-ransel`, `execute_blender_code`:
```python
import runpy
ns = runpy.run_path(r"C:\Users\mocha\Documents\stadion-utama-riau-3d\assets-src\blender\unri\sekre_assets.py")
print(ns["build"]("s07-piala"))
```
Expected tiap aset: dict dengan `segitiga` ≤ budget katalog (S07 2k, S13 3k, S14 4k, S15 2k, S17 1,5k, S19 4k,
S20 1k) dan `kb` < 300. Lalu `look` (max_size kecil) dari depan: muka depan aset menghadap +Y (kran dispenser,
layar laptop, lubang suara gitar, saku tas, baling kipas). Bila segitiga melebihi budget, ulangi dengan rasio
desimasi untuk material terberat, mis. `print(ns["build"]("s14-kipas-berdiri", {"unri:kipas-kepala": 0.5}))`.

- [ ] **Step 4: Cek berkas**

Run (Bash): `ls -l public/models/unri/ assets-src/blender/unri/`
Expected: 7 `.glb` (total < 1,5 MB) dan 7 `.blend`.

- [ ] **Step 5: Daftarkan GLB di `src/interiors/sekre/data.js`**

Ganti `export const GLB_ASET = freeze({});` menjadi:
```js
export const GLB_ASET = freeze({
  S07: 'models/unri/s07-piala.glb',
  S13: 'models/unri/s13-dispenser-galon.glb',
  S14: 'models/unri/s14-kipas-berdiri.glb',
  S15: 'models/unri/s15-printer-tua.glb',
  S17: 'models/unri/s17-laptop.glb',
  S19: 'models/unri/s19-gitar-akustik.glb',
  S20: 'models/unri/s20-tas-ransel.glb',
});
```
(Hanya cantumkan aset yang GLB-nya benar-benar ada; aset yang gagal dibuat tetap memakai placeholder.)

- [ ] **Step 6: Verifikasi di browser**

Masuk sekre (Task 20 Step 5). Expected: konsol tanpa 404/galat; placeholder tersembunyi untuk 7 aset; kipas GLB
berputar & menoleh saat dinyalakan; layar laptop GLB menyala saat slot laptop aktif (jam 21); gitar GLB berpindah
ke pangkuan NPC jam 15. Semua aset menghadap seperti placeholder (bila terbalik 180°, perbaiki skrip Blender,
bukan kode runtime).

- [ ] **Step 7: Commit**

```
git add assets-src/blender/unri/sekre_assets.py assets-src/blender/unri/*.blend public/models/unri/*.glb src/interiors/sekre/data.js
```
```
git commit -m "feat(aset): GLB Blender interior sekre (piala, dispenser galon, kipas berdiri, printer tua, laptop, gitar, tas ransel)"
```

---

## Task 22: E2E interior — budget §9, siklus memori 3×, screenshot

**Files:**
- Create: `tests/e2e/interior.e2e.mjs`, `docs/screenshots/unri/m5-siang-rapat.jpg`,
  `docs/screenshots/unri/m5-malam-begadang.jpg`, `docs/screenshots/unri/m5-hujan.jpg`

- [ ] **Step 1: Tulis `tests/e2e/interior.e2e.mjs`**

```js
#!/usr/bin/env node
/**
 * E2E interior sekre (M5) — TIDAK ikut `vitest run` (nama bukan *.test.js).
 *   node tests/e2e/interior.e2e.mjs [--gpu d3d11|swiftshader] [--out laporan.json] [--shots]
 * Vite (port 5175) + Chromium headless 1280×720 (paket playwright global / PLAYWRIGHT_PATH), lalu:
 *   1. masuk sekre lewat __sim.portal.enter('sekre') tanpa galat konsol;
 *   2. budget spec §9.1 di 3 skenario (siang rapat, malam begadang, hujan): pass scene utama ≤ 150 draw call dan
 *      ≤ 150.000 segitiga; total semua pass frame ≤ 150 draw call (segitiga total dilaporkan);
 *   3. siklus masuk/keluar 3× → renderer.info.memory (geometri, tekstur) kembali ke baseline (setelah 1 siklus
 *      pemanasan: GTAO lazy dibuat sekali);
 *   4. --shots: docs/screenshots/unri/m5-siang-rapat.jpg, m5-malam-begadang.jpg, m5-hujan.jpg (mode foto).
 * Exit code 0 = lulus. Laporan JSON ke stdout.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5175;
const LIMITS = Object.freeze({ sceneCalls: 150, sceneTriangles: 150000, frameCalls: 150 });
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const SCENARIOS = Object.freeze([
  { id: 'siang-rapat', hour: 10, rain: false, preset: 'lesehan' },
  { id: 'malam-begadang', hour: 21.25, rain: false, preset: 'pojok' },
  { id: 'hujan', hour: 15.5, rain: true, preset: 'lesehan' },
]);

const { values: opts } = parseArgs({
  options: { gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string' }, shots: { type: 'boolean', default: false } },
});

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

/** Fungsi yang dievaluasi di halaman (window.__sim dari devtools.js; `portal` dipasang main.js M4). */
const PAGE = {
  async enter() {
    const s = window.__sim;
    s.rig.exitPov();
    s.store.set('sky.advanceTime', false);
    s.store.set('weather.raining', false);
    const ok = await s.portal.enter('sekre');
    await s.portal.current?.built.ready;
    return { ok, state: s.portal.state };
  },
  async scenario({ hour, rain, preset }) {
    const s = window.__sim;
    const frames = (n) => new Promise((resolve) => {
      let k = 0;
      const step = () => { k += 1; if (k >= n) resolve(); else requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    s.store.set('sky.hour', hour);
    s.store.set('weather.raining', rain);
    await new Promise((r) => setTimeout(r, rain ? 3000 : 600));
    document.body.classList.add('is-photo');
    await frames(3); // sistem interior.keys menyalakan mode foto rig dari kelas body
    const p = s.portal.current.built.photoPresets.find((x) => x.id === preset);
    s.portal.current.rig.applyPreset(p.pose);
    await frames(30);
    const r = s.app.renderer;
    const { scene, camera } = s.app.view;
    r.info.reset();
    scene.updateMatrixWorld();
    r.render(scene, camera); // pass scene utama saja (spec §9.1, keputusan plan M5 #7)
    const scenePass = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    s.app.renderFrame(); // semua pass (bayangan, GTAO, outline, vignette, output)
    const frame = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    const dbg = s.portal.current.built.debug;
    return { scenePass, frame, npcs: dbg.npcs.active, tlOn: dbg.lighting.tlOn };
  },
  endPhoto() {
    document.body.classList.remove('is-photo');
  },
  async memoryCycle() {
    const s = window.__sim;
    const frames = (n) => new Promise((resolve) => {
      let k = 0;
      const step = () => { k += 1; if (k >= n) resolve(); else requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    const warmHumanoids = () => { // pola smoke.e2e: semua level LOD humanoid eksterior diunggah sebelum snapshot
      const saved = [];
      const force = (o, key, value) => { saved.push([o, key, o[key]]); o[key] = value; };
      s.app.scene.traverse((o) => {
        const info = o.userData?.humanoidLod;
        if (!info) return;
        for (const part of [info.body, info.mesh]) {
          force(part, 'visible', true);
          part.traverse((m) => { if (m.isMesh) force(m, 'frustumCulled', false); });
        }
      });
      s.app.renderFrame();
      for (let i = saved.length - 1; i >= 0; i -= 1) saved[i][0][saved[i][1]] = saved[i][2];
    };
    const snap = async () => {
      warmHumanoids();
      await frames(5);
      const m = s.app.renderer.info.memory;
      return { geometries: m.geometries, textures: m.textures };
    };
    const cycle = async () => {
      await s.portal.enter('sekre');
      await s.portal.current.built.ready;
      await frames(30);
      await s.portal.exit();
      await frames(10);
    };
    if (s.portal.inside) await s.portal.exit();
    await frames(10);
    await cycle(); // pemanasan
    const baseline = await snap();
    const cycles = [];
    for (let i = 0; i < 3; i += 1) {
      await cycle();
      cycles.push(await snap());
    }
    return { baseline, cycles };
  },
};

function verdict(r) {
  const f = [];
  if (r.errors.length) f.push(`galat konsol: ${r.errors.length}`);
  if (!r.checks.enter?.ok) f.push('gagal masuk sekre');
  for (const sc of r.checks.scenarios ?? []) {
    if (!(sc.scenePass.calls <= LIMITS.sceneCalls)) f.push(`${sc.id}: draw call scene ${sc.scenePass.calls} > ${LIMITS.sceneCalls}`);
    if (!(sc.scenePass.triangles <= LIMITS.sceneTriangles)) f.push(`${sc.id}: segitiga scene ${sc.scenePass.triangles} > ${LIMITS.sceneTriangles}`);
    if (!(sc.frame.calls <= LIMITS.frameCalls)) f.push(`${sc.id}: draw call frame ${sc.frame.calls} > ${LIMITS.frameCalls}`);
    if (!(sc.npcs.length >= 1)) f.push(`${sc.id}: tidak ada NPC`);
  }
  const m = r.checks.memory;
  const back = (v) => v.geometries === m.baseline.geometries && v.textures === m.baseline.textures;
  if (!m || !m.cycles.every(back)) f.push(`memori tidak kembali ke baseline: ${JSON.stringify(m)}`);
  return f;
}

async function main() {
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
    page.on('console', (msg) => { if (msg.type() === 'error') report.errors.push(msg.text()); });
    page.on('response', (res) => { if (res.status() >= 400) report.errors.push(`HTTP ${res.status()} ${res.url()}`); });
    const step = async (name, fn) => {
      process.stderr.write(`[e2e-interior] ${name}…\n`);
      return fn();
    };
    await step('muat halaman', () => page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 }));
    await step('tunggu __sim.portal', () => page.waitForFunction(() => window.__sim?.portal, null, { timeout: 240000 }));
    report.checks.enter = await step('masuk sekre', () => page.evaluate(PAGE.enter));
    report.checks.scenarios = [];
    for (const sc of SCENARIOS) {
      const res = await step(`skenario ${sc.id}`, () => page.evaluate(PAGE.scenario, sc));
      report.checks.scenarios.push({ id: sc.id, ...res });
      if (opts.shots) {
        const dir = join(ROOT, 'docs', 'screenshots', 'unri');
        mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: join(dir, `m5-${sc.id}.jpg`), type: 'jpeg', quality: 88 });
      }
      await page.evaluate(PAGE.endPhoto);
    }
    report.checks.memory = await step('siklus memori 3×', () => page.evaluate(PAGE.memoryCycle));
  } finally {
    await browser.close();
    await server.close();
  }
  report.fails = verdict(report);
  const json = JSON.stringify(report, null, 2);
  if (opts.out) writeFileSync(opts.out, `${json}\n`);
  console.log(json);
  process.exitCode = report.fails.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Jalankan pengukuran (GPU)**

Run: `node tests/e2e/interior.e2e.mjs --gpu d3d11 --shots --out interior-laporan.json`
Expected: exit 0; `fails: []`; tiap skenario `scenePass.calls` ≤ 150 (perkiraan desain ±40–60) dan
`scenePass.triangles` ≤ 150.000; `frame.calls` ≤ 150; `memory.cycles` sama dengan `baseline`; tiga JPG tercipta
di `docs/screenshots/unri/`. Hapus `interior-laporan.json` setelah angka dicatat (jangan di-commit).

Bila budget terlampaui, mitigasi berurutan: (1) pastikan perabot & papan tergabung (`__sim.portal.current.built
.scene.getObjectByName('sekre-statis').children.length` ≈ 15–25), (2) turunkan segmen silinder placeholder 14 → 10,
(3) desimasi GLB terberat (Task 21 Step 3), (4) matikan `castShadow` perabot kecil. Bila memori tidak kembali: cari
sumber daya di luar pohon scene yang belum dilepas (skeleton, env map, peta bayangan, GLB yang tiba setelah keluar)
di `dispose()` interior/portal.

- [ ] **Step 3: Periksa screenshot**

Buka ketiga JPG (Read tool). Expected: (siang rapat) cahaya siang dari jendela & pintu, 4–5 NPC bersila di karpet
marun, papan terbaca; (malam begadang) TL menyala, laptop menyala, NPC di laptop & papan tulis; (hujan) cahaya
kelabu, suasana redup, lantai selasar basah terlihat lewat jendela. Ulangi Step 2 setelah penyetelan bila perlu.

- [ ] **Step 4: Commit**

```
git add tests/e2e/interior.e2e.mjs docs/screenshots/unri/m5-siang-rapat.jpg docs/screenshots/unri/m5-malam-begadang.jpg docs/screenshots/unri/m5-hujan.jpg
```
```
git commit -m "test(e2e): ukur interior sekre (budget draw call/segitiga 3 skenario, siklus memori 3×) dan screenshot M5"
```

---

## Task 23: Verifikasi akhir tonggak + status indeks

**Files:**
- Modify: `docs/superpowers/plans/2026-10-17-unri-00-index.md` (baris status M5)

- [ ] **Step 1: Semua gerbang**

Run berurutan: `npm test`, `npm run lint`, `npm run build`, `npm run e2e -- --gpu d3d11`,
`node tests/e2e/interior.e2e.mjs --gpu d3d11`
Expected: tes PASS, lint 0 galat, build sukses, smoke lama tetap lulus (portal tidak mengganggu eksterior),
E2E interior `fails: []`.

- [ ] **Step 2: Checklist spec §8.2 (semua harus benar)**

- Ruang 4,2 × 6,0 × 3,2 m; pintu & jendela nako di sisi selasar; plester kusam bekas selotip; keramik krem 40×40;
  karpet marun 3 × 4; plafon gipsum + 2 TL; stopkontak sambungan + kabel.
- S01–S30 semuanya tampil (placeholder atau GLB) — `tests/interiorSekre.test.js` hijau.
- 3–6 NPC sesuai jam (08–12 rapat 4–5, 12–14 sepi 1–2, 14–18 santai + gitar 3–4, 18–23 begadang 4–6, 23–05 tidur
  2–3, 05–08 kosong/1).
- ≥ 10 interaksi (12) termasuk easter egg LPJ; gitar Karplus-Strong; kipas suara + kertas berkibar; saklar TL.
- Audio: dengung kipas, gitar, gumaman, hujan di atap seng; volume mengikuti "Suasana"; berhenti saat keluar.
- Cahaya: TL otomatis 17:30–06:00 + saklar; cahaya/sinar jendela mengikuti jam; GTAO aktif di dalam.
- Mode foto: P + 4 preset + kamera bebas; F1 memuat bagian "Sekre (interior)".
- Kamera: FP 1,55 m, V → orang ketiga 1,6 m tanpa menembus plafon; mouse/gamepad/sentuh.
- Keluar → kembali di depan pintu, sepeda di tempat semula; build gagal → "Pintu terkunci".
- Budget ≤ 150 draw call & ≤ 150k segitiga; siklus 3× memori kembali ke baseline.

- [ ] **Step 3: Perbarui baris M5 di indeks**

Di `docs/superpowers/plans/2026-10-17-unri-00-index.md`, tabel "Status tonggak", ganti baris M5 menjadi (isi hash
dengan keluaran `git log -1 --format=%h`):
```
| M5 | selesai | <hash dari git log -1 --format=%h> | interior sekre: portal + 12 interaksi + 6 NPC terjadwal + mode foto; GLB 7 aset; budget scene ≤150 dc |
```

- [ ] **Step 4: Commit**

```
git add docs/superpowers/plans/2026-10-17-unri-00-index.md
```
```
git commit -m "docs: status M5 interior sekre selesai di indeks plan UNRI"
```

---

## Self-review

**Cakupan spec & instruksi:**
- §4.8 `defineInterior` + validasi (Task 1, tes); `App.setView` termasuk RenderPass/GTAO/outline/label (Task 2);
  portal penuh: mesin state, jeda eksterior, sepeda tetap, gagal build → "Pintu terkunci", siklus 3× (Task 10 tes
  unit; Task 22 memori GPU nyata).
- §4.9 `walkPhysics` (Task 3, tes) + `Walker` (Task 7) + `InteriorCameraRig` FP 1,55 m / orang ketiga 1,6 m dengan
  uji plafon, mouse/gamepad/sentuh lewat router `look` (Task 8 tes jsdom; Task 10).
- §4.10 `Humanoid.poses` 7 pose dengan sudut sendi konkret + idle (Task 6, tes) dan `activitySchedule` dengan jam
  batas (Task 4, tes).
- §8.2 ruang (Task 12), S01–S30 (Task 11 data + tes, Task 13 papan, Task 14 perabot), NPC (Task 15), 12 interaksi
  (Task 16, tes handler), cahaya (Task 17, tes fungsi murni), audio (Task 5 synth + tes, Task 18), mode foto
  (Task 16/19), keymap (Task 10) & F1 (Task 20), GLB Blender 7 aset (Task 21), budget & screenshot (Task 22).
- §10: build interior melempar (Task 10), GLB gagal → placeholder (Task 14 `loadModels`).
- §11: tes `interiorPortal`, `walkPhysics`, `activitySchedule` ada; tes tambahan hanya untuk logika murni/berisiko
  (gerbang sistem, synth, pose/skin, rig kamera, data, keymap, fungsi cahaya).

**Konsistensi nama dengan indeks:** semua file M5 di indeks dibuat dengan nama persis. `AudioBus` mendapat `pluck`,
`startRainOnTin`, `startFanHum`, `startMurmur` (indeks: "pluck Karplus-Strong, rainOnTin, fanHum, murmur"; awalan
`start` karena loop mengembalikan handle). `Interactable`, `photoPresets`, `systems`, `colliders.isWalkable` sesuai
§4.8. `scheduleFor(hourFloat, seed, slots)` sesuai §4.10 (parameter ke-4 `npcIds` opsional).

**Pemindaian placeholder:** tidak ada TBD/TODO/"isi nanti". Koordinat pintu M4 diambil lewat `PORTAL_DOORS` di
composition root (tidak disalin). `GLB_ASET` sengaja kosong sampai Task 21 agar tidak ada 404 sebelum GLB ada.

**Konsistensi tipe/arah:** `hadap` (data) → rotasi `hadap + π` untuk aset katalog (depan −Z), `hadap` untuk bidang
dinding & Humanoid; yaw jalan = `(sin, cos)` sama dengan sepeda; `sekreExitTo()` M4 → `exitTo` region-lokal;
`ROOM_YAW_OFFSET` hanya memengaruhi arah sinar matahari; GLB Blender menghadap +Y (= −Z three).

**Risiko yang diketahui:**
1. Nama/API sudah diselaraskan dengan plan M0 (commit 038b4e2: `regions`, `handleKeys` tanpa `frame`, sistem
   `scheduler`, POV Digit8) dan plan M4 (`setupPortal`/`portalKit`, `portalTrigger`, `FadeOverlay`, `sekreExitTo`,
   `door.yaw` ke selasar). Bila eksekusi M0/M4 menyimpang dari plannya, Task 0 mendeteksinya; penyesuaian hanya nama.
2. `renderer.info` menghitung GTAO (render normal kedua) → budget didefinisikan pada pass scene utama (keputusan #7);
   desain ±40–60 draw call scene sehingga total frame juga di bawah 150.
3. Sudut pose bersila/gitar dihitung analitik dari DIM; mungkin perlu penyetelan visual ±0,3 rad (Task 20 Step 5).
4. Blender MCP bisa tidak tersedia → placeholder tetap memenuhi kriteria; Task 21 boleh ditunda tanpa memblokir.
5. Sinar matahari langsung jarang muncul karena selasar beratap (realistis); cahaya langit jendela tetap ada siang hari.
6. `read_homefile` di Blender menutup file yang terbuka → dijaga dengan cek `is_dirty`.

## Serah terima ke M6/M7

**Untuk M6 (Zona Rektorat):** tidak ada ketergantungan langsung. Bisa dipakai ulang: `Humanoid.skinned` (banyak
orang dekat tanpa membengkakkan draw call), `src/interiors/sekre/canvas.js` (`fitFont`, `wrapLines`, `atlasPlane`,
`tint`) untuk papan/huruf N02, pola skrip Blender `sekre_assets.py` (helper `material/box/cyl/torus`, cek
`is_dirty`, `read_homefile`, `runpy.run_path(export_glb.py)`) untuk N01–N04.

**Untuk M7 (Kehidupan & integrasi):**
- Objective `interact` (spec §8.4): portal memanggil `onInteracted(interiorId, itemId)` setiap interaksi berhasil
  (default no-op). M7 cukup menambahkan opsi `onInteracted` di `setupPortal` (main.js) ke cerita; target
  `'sekre:kipas'` ⇔ `onInteracted('sekre', 'kipas')`. Sistem `story` dijeda selama di dalam (tidak di
  `KEEP_INSIDE`); bila misi butuh timer berjalan di dalam, tambahkan id sistem cerita ke `KEEP_INSIDE`.
- E2E: ikutkan `PAGE.memoryCycle` & budget dari `tests/e2e/interior.e2e.mjs` ke `smoke.e2e.mjs` (titik ukur
  `interior-sekre`, siklus interior 3×, rute stadion → sekre) sesuai indeks M7.
- `randomAlmamaterOutfit` siap untuk `students.js` (±30% almamater); `npcOutfit` contoh aturan dalam ruangan.
- Fast travel "Kampus UNRI — Sekretariat Lembaga": teleport ke `portal.doors()` pintu sekre; `__sim.portal` tersedia.
- Katalog aset: ubah status S07, S13, S14, S15, S17, S19, S20 → `final` (bila GLB Task 21 masuk), S lainnya →
  `final (P)`; catat barang ekstra (kursi lipat, kertas di meja, kabel).
- Ditunda dari M5: azan magrib opsional (§8.2) — butuh sintesis vokal yang layak.
- Isi organisasi di `src/interiors/sekre/data.js` = DATA CONTOH; user mengganti nama/pengurus/proker lalu set
  `DATA_CONTOH = false`. Nama deret seberang (`SELASAR_SEBERANG`) disamakan dengan `sekre.data.js` M4 bila diganti.

