# R11 — Alasan menjelajah: paspor kota, "Ke sini" dari peta, kemajuan terlihat (S5, S7, S8)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Aturan fakta: paspor hanya menampilkan **nama dari data** + jenis tempat + sumber. Tidak ada "fakta menarik" yang dikarang.

**Tujuan:** dunia yang luas punya alasan untuk didatangi (cap paspor), mode Kota jadi layar perjalanan, dan jurnal menunjukkan apa berikutnya.
**Pilar:** P-1, P-3. **Tonggak:** T3. **Branch:** `feat/paspor-kota`. **Prasyarat:** R07 (`public/far/landmarks.json`), R03 Tugas 1 (`travel.goTo`), R19 (`SAVE_KEYS`, `resetGame`).

## Fakta kode

- `public/far/landmarks.json` (R07): `{ sumber, dibuat, butir: [{ nama, x, z, h, kelas, luas, skor }] }`, urut skor menurun. Dimuat `createFarCity` hanya saat mode Kota pertama kali aktif.
- Easter egg yang sudah ada: `src/story/easterEggs.js` (`EASTER_EGGS`, `EGG_IDS`), keadaannya di save cerita; pola pemicu jarak di `StoryDirector.#updateEggs`.
- Jurnal: `src/ui/StoryJournal.js`, data `StoryDirector.#journalView()` → `{ rank, rupiah, bestLap, chapters: [{ title, done, current }], badges, eggs }`. Gelar tiap bab: `chapters[i].rank`; `story.rankOf(state)`.
- Label Kota: `src/ui/CityLabels.js` `onSelect(l)` → `rig.director.flyTo(l.x, l.z, LABEL_ZOOM)` (`src/app/cityPreview.js:53–55`). Keluar mode Kota: `rig.exitPov()`.
- Nama kelas (indeks `FAR_CLASS`, R06): 1 niaga, 2 industri, 3 publik, 4 hunian, 5 ibadah, 6 pendidikan, 7 kesehatan, 8 olahraga, 9 gedung besar.

---

## Tugas 1: Paspor (murni)

**Berkas:** baru `src/story/passport.js`, `tests/passport.test.js`.

```js
export const PASSPORT = Object.freeze({ count: 40, radius: 70, reward: 1000 });
/** Pilih tempat paspor dari butir landmark: `count` teratas menurut skor, id stabil = `${x}_${z}`. */
export function passportPlaces(butir, cfg = PASSPORT)              // → [{ id, nama, x, z, kelas }]
export function createPassport()                                   // → { stamps: {} }   (id → nomor hari saat dicap)
/** Tempat belum dicap yang berada dalam radius dari pos (terdekat dulu) atau null. */
export function stampable(passport, places, pos, cfg = PASSPORT)
export function stamp(passport, id, day)                           // → paspor baru; mencap dua kali tidak mengubah hari pertama
export function passportProgress(passport, places)                 // → { done, total }
export function passportToJson(p) / passportFromJson(text)         // rusak → createPassport()
export const KELAS_LABEL = Object.freeze(['Tempat', 'Niaga', 'Industri', 'Layanan publik', 'Hunian', 'Rumah ibadah', 'Pendidikan', 'Kesehatan', 'Olahraga', 'Gedung besar']);
```
- [ ] **Tes dulu:** `passportPlaces` memotong ke 40 dan id deterministik; `stampable` mengembalikan yang terdekat dalam 70 m dan `null` di luar; yang sudah dicap dilewati;
  `stamp` idempoten; `passportProgress` benar; JSON rusak aman.
- [ ] Commit `feat(cerita): paspor kota (murni)`.

## Tugas 2: Paspor terpasang

**Berkas:** baru `src/app/passport.js`; `src/main.js`, `src/ui/StoryJournal.js`, `src/core/StoryDirector.js`, `src/config/saveKeys.js`.

- [ ] `setupPassport({ app, ents, hud, story, baseUrl, storage, rig, calendar }) → { places, passport, dispose() }`: saat boot `fetch(\`${baseUrl}far/landmarks.json\`)` (gagal → paspor mati, tanpa galat ke pemain).
  Sistem `{ id: 'passport', phase: 'sim' }` memeriksa **tiap 0,5 detik** (bukan tiap frame), hanya saat `session.started`, bukan POV beku, bukan di interior:
  `stampable(...)` → `stamp` → simpan (kunci `sur3d.passport.v1`, masuk `SAVE_KEYS` + `resetGame`) → `ents.vendors.credit(PASSPORT.reward)` → `story.saveNow()` →
  toast `'Cap paspor: <nama> (<KELAS_LABEL>) · 7/40'`.
- [ ] Jurnal: bagian **"Paspor kota 7/40"**: daftar tempat; yang belum dicap ditulis `???` + jenisnya (`??? · Rumah ibadah`) supaya ada petunjuk tanpa membocorkan nama;
  yang sudah: nama + `hari ke-N`. Di bawahnya satu baris kecil `Sumber nama: <sumber dari landmarks.json>`.
- [ ] Minimap: tempat paspor yang belum dicap dalam 400 m ditampilkan sebagai titik kecil pucat (tambahkan ke `getPins` di `setupMinimap`, warna baru `PIN_PASSPORT = '#e8e0c8'`).
- [ ] Uji main: datangi Rektorat / Masjid Arfa'unnas (bila ada di 40 teratas) → cap muncul sekali; muat ulang → tetap tercap.
- [ ] Commit `feat(cerita): paspor kota terpasang`.

## Tugas 3: "Ke sini" dari mode Kota (S7)

**Berkas:** `src/ui/CityLabels.js`, `src/app/cityPreview.js`, `src/ui/cityPreview.css`, `src/main.js`.

- [ ] Klik label pertama = terbang ke sana (seperti sekarang) **dan** label itu menjadi "terpilih": muncul tombol kecil `Ke sini` di bawahnya (`button.city-go`, `aria-label="Pergi ke <nama>"`).
  Klik `Ke sini` → `onTravel(l)`. Klik label lain memindahkan pilihan; klik kanvas kosong membatalkan.
- [ ] `createCityPreview({ ..., onTravel })`; di `main.js`: `onTravel: async (l) => { rig.exitPov({ instant: true }); await travel.goTo({ x: l.x, z: l.z, yaw: 0, label: l.label ?? l.nama }); }`.
  `goTo` sudah mencari titik yang bisa dilalui terdekat dan menunggu streaming.
- [ ] Batasan yang jujur: tujuan di luar 65 tile terperinci tidak punya jalan/collider rinci. **Sebelum pergi**, cek `city.manifest` apakah titik berada di dalam area tile
  (fungsi kecil `insideDetailedArea(manifest, x, z)` di `src/app/fastTravel.js`, dites); bila di luar → tombol berbunyi `Belum bisa didatangi` (mati) dengan `title` "Kawasan ini baru ada di peta jauh".
- [ ] Menu G (perjalanan cepat) tetap ada dan tidak berubah.
- [ ] Commit `feat(kota): pergi ke tempat langsung dari peta`.

## Tugas 4: Kemajuan terlihat (S8)

- [ ] Murni baru di `src/story/progress.js`: `export function nextGoal(state, chapters) → { rank: string, chapterTitle: string }|null` — gelar bab berikutnya dan judul bab yang harus diselesaikan;
  `null` bila cerita selesai. Tes 3 kasus (awal, tengah, selesai).
- [ ] Jurnal, paling atas: `Gelar: <sekarang>` lalu `Berikutnya: <rank> — selesaikan "<judul bab>"`; di bawahnya ringkasan satu baris:
  `Paspor 7/40 · Pesanan diantar 12 · Rekor putaran 1:42` (bagian yang datanya belum ada dilewati, bukan ditulis 0).
- [ ] Saat bab selesai, toast gelar baru sudah ada; tambahkan satu baris di kartu misi selama 6 detik: `Gelar baru: <rank>`.
- [ ] Commit `feat(cerita): jurnal menunjukkan langkah berikutnya`.

---

## Selesai bila

- Tes `tests/passport.test.js tests/fastTravel.test.js` + tes `progress` lulus; lint bersih.
- Uji: buka K → klik label → `Ke sini` → tiba di sana di mode jalan; cap paspor muncul bila tempat itu masuk daftar.
- `docs/KRITIK.md` (S5, S7, S8), README rencana diperbarui.

## Tidak dikerjakan

- Teks fakta per tempat: hanya bila user memberi sumber (lihat R26 "Menunggu user").
- Kartu pos (foto + bingkai + nama tempat) → daftar "beyond".
