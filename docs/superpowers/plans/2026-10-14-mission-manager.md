# Mission Manager & Cerita Wisata Kuliner Riau — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Cerita 5 chapter dengan misi beli/antar makanan, keliling lintasan, dan cari easter egg, tersimpan di browser.

**Architecture:** Logika cerita murni dan immutable (`reduce(state, event) → {state, effects}`) di `src/sim/story/`, cerita sebagai data beku di `src/story/`, adaptor dunia→event di `src/core/StoryDirector.js`, UI di `src/ui/`. Spesifikasi: `docs/superpowers/specs/2026-10-14-mission-manager-design.md`.

**Tech Stack:** Three.js 0.186, vanilla JS ESM, Vitest. TDD untuk semua logika murni. Panel UI memakai DOM API (tanpa innerHTML data dinamis).

> Catatan format: untuk menghemat waktu, tugas UI/dunia (5–9) memuat file, API publik, dan perilaku, bukan kode utuh. Tugas logika murni (1–4) wajib TDD: tulis test dulu.

## Peta file
| File | Tugas |
|---|---|
| `src/sim/story/objectives.js` | `applyObjective(objective, progress, event)` per jenis objective |
| `src/sim/story/reducer.js` | `createStory({chapters, eggs})` → `{initial(), reduce(), rankOf()}` |
| `src/sim/story/lapTracker.js` | `createLapTracker`, `stepLap` checkpoint berurutan |
| `src/story/storage.js` | `sanitizeSave`, `loadStory`, `saveStory` (`sur3d.story.v1`) |
| `src/story/chapters.js` | 5 chapter (data beku) |
| `src/story/easterEggs.js` | Daftar easter egg + petunjuk |
| `src/core/StoryDirector.js` | Dunia → event, efek → dunia/HUD |
| `src/world/StoryMarkers.js` | Tiang cahaya tujuan + NPC + titik minimap |
| `src/entities/StoryNpcs.js` | Satpam dan pelatih (Humanoid yang ada) |
| `src/ui/StoryHUD.js` | Tujuan aktif, hitung mundur, kotak dialog |
| `src/ui/StoryJournal.js` | Jurnal (J): chapter, lencana, easter egg, mulai ulang |
| `tests/story*.test.js` | Test untuk semua logika murni |

## Kontrak data (dipakai semua tugas)
- Event: `{type:'position',x,z}`, `{type:'bought',itemId}`, `{type:'interacted',id,carrying:string[]}`, `{type:'lapDone',seconds}`, `{type:'egg',id}`, `{type:'tick',dt}`, `{type:'advance'}`, `{type:'reset'}`.
- Objective: `{type:'goto',target:{x,z},radius}` · `{type:'buy',itemId}` · `{type:'deliver',npcId,itemId,missingText?}` · `{type:'laps',count}` · `{type:'find',ids:string[]}`.
- Step: `{id, text, objective, say?:string[], timeLimit?:number, reward?:{rupiah}}`. Chapter: `{id,title,rank,steps,outro:string[],reward:{rupiah,badge}}`.
- State: `{version:1, chapter, step, progress:{count,found}, timeLeft, dialog:{lines,index}|null, badges, eggs, bestLap, rupiah, finished}`.
- Efek: `{type:'reward',rupiah,badge?}`, `{type:'toast',text,ok}`, `{type:'consumeItem',itemId}`, `{type:'save'}`.

---
### Task 1: Objectives
**Files:** Create `src/sim/story/objectives.js`; Test `tests/storyObjectives.test.js`
- [ ] Tulis test: goto selesai hanya di dalam radius; buy cocok itemId; deliver tanpa `carrying` memberi toast gagal, dengan `carrying` selesai + efek `consumeItem`; laps menghitung hingga `count`; find mengumpulkan id unik; event tak relevan tidak mengubah apa pun; input tidak dimutasi.
- [ ] `npx vitest run tests/storyObjectives.test.js` → FAIL.
- [ ] Implementasi `applyObjective` mengembalikan `{progress, done, effects}` baru (immutable).
- [ ] Test lulus → commit `feat(story): evaluator objective`.

### Task 2: Reducer cerita
**Files:** Create `src/sim/story/reducer.js`; Test `tests/storyReducer.test.js`
- [ ] Test dengan 2 chapter mini: urutan langkah; dialog `say` memblokir semua event kecuali `advance`; selesai chapter → hadiah + lencana + dialog `outro` + chapter berikutnya; batas waktu habis mengulang langkah dengan toast; `egg` baru memberi hadiah satu kali dan ikut menyelesaikan objective `find`; `lapDone` memperbarui `bestLap` terkecil; chapter terakhir → `finished`; `reset` kembali ke awal; efek `save` pada tiap perubahan progres; `rankOf` mengikuti chapter selesai.
- [ ] FAIL → implementasi `createStory` (helper `enterStep`, `completeStep`) → PASS.
- [ ] Commit `feat(story): reducer cerita`.

### Task 3: Lap tracker
**Files:** Create `src/sim/story/lapTracker.js`; Test `tests/storyLapTracker.test.js`
- [ ] Test: titik di lingkaran sintetis; putaran penuh berurutan menghasilkan `seconds`; melompati/memutar balik tidak menghitung; pergerakan di luar radius tidak mengubah state.
- [ ] API: `createLapTracker(checkpoints, radius)` → state; `stepLap(state, pos, time)` → `{state, lapSeconds|null}`. Titik 0 = garis start.
- [ ] Commit `feat(story): pelacak putaran lintasan`.

### Task 4: Penyimpanan + data cerita
**Files:** Create `src/story/storage.js`, `src/story/chapters.js`, `src/story/easterEggs.js`; Test `tests/storyStorage.test.js`, `tests/storyData.test.js`
- [ ] Test storage: round-trip; versi salah/JSON rusak → `null`; angka di luar rentang dan id tak dikenal dibuang; storage melempar error → tidak crash.
- [ ] Test data: id unik; setiap `find.ids` ada di easterEggs; setiap `buy/deliver.itemId` ada di `VENDOR_CATALOG`; teks dialog ≤ 3 kalimat/baris; semua beku (`Object.isFrozen`).
- [ ] Chapter: (1) tugu Lancang Kuning, (2) beli `es-teh` → antar `satpam`, (3) beli `rujak` → antar `pelatih`, (4) `laps` 3 dengan `timeLimit`, (5) `find` 3 petunjuk Air Molek.
- [ ] Easter egg: `bel-satpam`, `bangku-keramat`, `bola-tengah-malam`, `pelanggan-setia`, `layar-hujan`, plus 3 petunjuk `jejak-1..3`.
- [ ] Commit `feat(story): penyimpanan dan data cerita`.

### Task 5: StoryDirector + HUD tujuan + dialog
**Files:** Create `src/core/StoryDirector.js`, `src/ui/StoryHUD.js`; Modify `src/main.js`, `src/ui/hud.css`
- [ ] `StoryDirector({story, store, bikeState(), vendors, hud, storyHud})`: tiap frame kirim `position` + `tick`; hubungkan `hud.onBuy` sukses → event `bought`; `E` dekat NPC → `interacted` dengan `carrying` dari dompet; efek `consumeItem` mengurangi item di dompet; efek `reward` menambah saldo; `save` → `saveStory`.
- [ ] `StoryHUD`: judul chapter, teks tujuan, hitung mundur, kotak dialog dengan E/klik untuk lanjut; semua lewat `createElement/textContent`.
- [ ] Verifikasi browser: chapter 1 bisa diselesaikan; dialog memblokir kayuhan? (tidak, hanya event cerita).
- [ ] Commit `feat(story): director dan HUD tujuan`.

### Task 6: NPC dan penanda dunia
**Files:** Create `src/entities/StoryNpcs.js`, `src/world/StoryMarkers.js`; Modify `src/world/layout.js`, `src/main.js`
- [ ] Satpam di `LAYOUT.guardPosts[0]`, pelatih di tepi lintasan; keduanya Humanoid statis dengan label nama.
- [ ] Penanda: satu tiang cahaya aditif di tujuan aktif + ikon titik di minimap; tidak menambah lampu nyata.
- [ ] Prompt `E` "Bicara dengan Pak Satpam" saat dekat; uji jarak dari collider.
- [ ] Commit `feat(story): NPC dan penanda tujuan`.

### Task 7: Chapter 4 (putaran) 
**Files:** Modify `src/core/StoryDirector.js`
- [ ] Checkpoint = 8 titik `pointOnLane(1, s)` rata; radius 6 m; kirim `lapDone` dari `stepLap` hanya saat chapter 4 aktif.
- [ ] Commit `feat(story): misi putaran lintasan`.

### Task 8: Easter egg
**Files:** Modify `src/core/StoryDirector.js`; Create `src/story/eggTriggers.js` (+ test)
- [ ] Pemicu murni dan teruji: bel 3× dalam 4 detik di radius satpam; bangku keramat radius 3 m; tengah lapangan pukul 00:00 ±5 menit; 5× `bought es-teh`; berdiri di tugu saat hujan 5 detik.
- [ ] Hasil memanggil `egg{id}`; bola malam hari memakai mesh tambahan sederhana.
- [ ] Commit `feat(story): easter egg`.

### Task 9: Jurnal, polesan, dokumentasi
**Files:** Create `src/ui/StoryJournal.js`; Modify `README.md`, `src/ui/mountSettingsPanel.js` (bantuan J)
- [ ] Jurnal (J): chapter selesai, lencana, easter egg ("???" sebelum ditemukan), rekor putaran, tombol "Mulai ulang cerita" dengan konfirmasi.
- [ ] README: bagian cerita dan tombol J.
- [ ] Semua test lulus, `vite build` sukses, cek browser semua chapter + reload mempertahankan progres.
- [ ] Commit `feat(story): jurnal dan dokumentasi`.

## Self-review
- Cakupan spec: objective (T1), reducer + waktu + hadiah (T2), lap (T3,T7), penyimpanan + data (T4), UI (T5,T9), NPC/penanda (T6), easter egg (T8).
- Konsistensi nama: `applyObjective`, `createStory`, `stepLap`, `loadStory/saveStory`, event dan efek sesuai bagian Kontrak data.
