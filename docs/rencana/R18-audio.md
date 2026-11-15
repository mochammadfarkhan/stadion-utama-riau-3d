# R18 — Suara dunia (Putaran 2)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Semua suara di proyek ini **disintesis** (tidak ada berkas audio);
> pertahankan itu. Generator suara = fungsi murni di `src/core/audioSynth.js` yang mengisi `Float32Array`, dites tanpa `AudioContext`.

**Tujuan:** dunia tidak lagi sunyi: tiap kawasan punya suasana, sepeda punya suara, aksi punya umpan balik; suara berhenti saat tab disembunyikan.
**Pilar:** P-1 (tempat yang dikenali: suara tempat), P-2. **Tonggak:** T1 (tugas 1–3), T2 (tugas 4–6). **Branch:** `feat/suara-dunia`.

## Keadaan sekarang (lengkap)

Yang berbunyi di seluruh game: (1) bel sepeda (`src/entities/Bicycle.bell.js`), (2) desis hujan luar (`src/world/Weather.js:25–86`),
(3–4) dengung kota + angin **hanya di mode Kota K** (`src/app/cityPreview.js:107–126`), (5–9) kipas, hujan di seng, gumam, gitar, klik saklar
**hanya di dalam sekre** (`src/interiors/sekre/audio.js`). Di mode jalan, di luar hujan dan bel: **sunyi total**.

API yang sudah ada (`src/core/AudioBus.js`): `createAudioBus({master, target})` → `ensure()`, `resume()`, `setMaster(v)`, `setChannel(name, v)`,
`play(key, make, {channel, gain, at})`, `loop(key, make, {channel, level})` → `{setLevel(v, rampSeconds), stop()}`, `pluck(freq, opts)`,
`startFanHum/startRainOnTin/startMurmur/startCityHum/startWind(opts)`. Kanal: `bell`, `ambience` (`src/ui/bindings/bindAudio.js:5`).
Pembantu murni (`audioSynth.js`): `mulberry(seed)`, `normalizePeak(data, peak)`, `makeLoopable(data, fade)`, `LOOP_FADE_S = 0.12`,
`cityHumBuffer(sampleRate, {seconds, seed})`, `windBuffer(...)`. Tes: `tests/audioCity.test.js` (pola yang ditiru).

---

## Tugas 1: Suara berhenti saat tab disembunyikan

**Berkas:** `src/core/AudioBus.js`, `src/main.js:158`, tes `tests/bindings.test.js` (blok AudioBus) atau berkas baru `tests/audioBus.test.js`.

- [ ] `AudioBus#suspend(): void` — bila konteks ada dan `state === 'running'` → `ctx.suspend()`. Perbaiki juga `resume()` (`AudioBus.js:43`):
  syarat keluar dini menjadi `!ctx || ctx.state === 'running' || ctx.state === 'closed' || resuming` (iOS melaporkan `'interrupted'`).
- [ ] Tambah `'touchend'` dan `'click'` ke pendengar gestur (`AudioBus.js:168–169`), dan lepas di `dispose()`.
- [ ] `main.js`: di pendengar `visibilitychange` yang sudah ada: `document.hidden ? audioBus.suspend() : audioBus.resume()`.
- [ ] Tes dengan konteks tiruan `{ state: 'running', suspend: vi.fn(), resume: vi.fn(() => Promise.resolve()) }` yang disuntik lewat opsi pabrik konteks
  (tambahkan opsi `createContext` pada `createAudioBus` bila belum ada jalan menyuntik). Commit `fix(audio): suara berhenti saat tab disembunyikan`.

## Tugas 2: Desis hujan tanpa klik tiap 2 detik

**Akar:** `Weather.js:39–50` membuat buffer 2 detik dari `Math.random()` lalu `loop = true` tanpa menyamarkan sambungan.

- [ ] `audioSynth.js`: `export function rainHissBuffer(sampleRate, { seconds = 6, seed = 41 } = {}) → Float32Array` — derau cokelat (integrator bocor yang sama:
  `last = (last + 0.04 * white) / 1.04; out[i] = last * 3.5`) dari `mulberry(seed)`, lalu `makeLoopable(out, Math.round(sampleRate * LOOP_FADE_S))` dan `normalizePeak(out, 0.9)`.
- [ ] Tes (pola `tests/audioCity.test.js`): panjang = `sampleRate * seconds`; deterministik (dua panggilan sama persis); puncak ≤ 0,9;
  sambungan halus: `Math.abs(out[0] - out[out.length - 1]) < 0.05`.
- [ ] `AudioBus`: `startRainHiss(opts)` (pola `startWind`). `Weather.js`: `createRainAudio` memakai `audioBus.startRainHiss({ channel: 'ambience', level: 0 })`
  dan `handle.setLevel(AUDIO_GAIN * level, 0.5)`; filter lowpass 1400 Hz dipindah ke dalam generator (rata-rata bergerak sederhana) atau dibuang.
- [ ] Commit `fix(audio): desis hujan tanpa sambungan`.

## Tugas 3: Suara sepeda

**Berkas:** `src/core/audioSynth.js`, `src/core/AudioBus.js`, baru `src/app/bikeSound.js`, `src/main.js`; tes `tests/audioCity.test.js` (generator) + `tests/bikeSound.test.js` (kurva tingkat).

**Antarmuka:**
- `tyreRollBuffer(sampleRate, { seconds = 4, seed = 31 })` — derau band sempit (ban di aspal). `chainTickBuffer(sampleRate, { seconds = 1, seed = 33 })` — 8 klik pendek merata (rantai/freewheel).
- `AudioBus.startTyreRoll(opts)`, `startChainTick(opts)`.
- Murni: `export function bikeSoundLevels({ speed, pedalling, mode }) → { tyre: number, chain: number }`:
  `tyre = mode === 'jalan' ? 0 : clamp(speed / 9, 0, 1) * 0.10`; `chain = mode === 'sepeda' && !pedalling && speed > 1 ? 0.06 : 0` (bunyi freewheel saat meluncur).
- `createBikeSound({ audioBus, bike, getInput }) → { update(dt), dispose() }`: memanggil `setLevel` paling sering tiap 0,1 detik.

- [ ] Tes `bikeSoundLevels`: diam → `{0,0}`; 9 m/s mengayuh → `{tyre: 0.10, chain: 0}`; 6 m/s meluncur → `chain 0.06`; mode jalan → `{0,0}`.
- [ ] Sambungkan di `main.js` sebagai sistem `{ id: 'bikeSound', phase: 'ui' }`; kanal `ambience`. `ents.bike.mode` dan `ents.bike.state.v` sudah tersedia.
- [ ] Commit `feat(audio): suara ban dan rantai sepeda`.

## Tugas 4: Suasana per kawasan

**Berkas:** `src/core/audioSynth.js`, `src/core/AudioBus.js`, baru `src/sim/ambienceMix.js` (murni) + `src/app/ambience.js`, `src/main.js`; tes `tests/ambienceMix.test.js`.

**Generator baru (masing-masing dites seperti Tugas 2):** `birdsBuffer(sr, {seconds = 10, seed = 17})` (kicau: sapuan sinus pendek acak),
`crowdRoarBuffer(sr, {seconds = 8, seed = 19})` (derau merah muda termodulasi lambat), `trafficBuffer(sr, {seconds = 10, seed = 23})` (dengung rendah + desis lewat),
`riverBuffer(sr, {seconds = 8, seed = 29})` (derau putih lowpass bergelombang).

**Campuran (murni):**
```js
/** Tingkat tiap lapisan (0..1) dari keadaan dunia. Tidak ada efek samping. */
export function ambienceMix({ zone, hour, raining, crowd = 0, nearRoad = 0, nearWater = 0 })
  // → { birds, wind, crowd, traffic, river }
```
Aturan yang diputuskan:
- `birds`: 0,5 pada jam 5–9 dan 16–18, 0,25 siang, 0 malam (19–5); × 0 bila hujan; × 1,2 di `zone === 'kampus'`.
- `wind`: 0,15 dasar; 0,3 saat hujan.
- `crowd`: `crowd` (kepadatan penonton 0..1 dari `store.get('graphics.crowdDensity')`) × 0,4, hanya di `zone === 'stadion'`.
- `traffic`: `nearRoad` (0..1) × 0,35; × 0,5 pada jam 22–5.
- `river`: `nearWater` (0..1) × 0,3.

`zone` ditentukan di `app/ambience.js`: `'stadion'` bila `regionContains(stadionDef, x, z)`, `'kampus'` bila di dalam `UNRI_BOUNDARY`
(`pointInPolygon`, sudah diimpor di `main.js`), selain itu `'kota'`. `nearRoad`/`nearWater`: **tahap pertama pakai 0** dan catat di laporan;
tahap berikutnya menghitungnya dari data tile (`city.manifest`) — jangan mengarang sumber data.

- [ ] Tes `ambienceMix`: pagi kampus cerah → `birds ≈ 0.6`; malam → `birds = 0`; hujan → `birds = 0, wind = 0.3`; stadion `crowd: 1` → `crowd = 0.4`; luar stadion → `crowd = 0`.
- [ ] `createAmbience({ audioBus, getFocus, zoneAt, time, store }) → { update(dt), dispose() }`: memulai kelima loop dengan level 0 (malas: baru dibuat
  setelah `audioBus.context` ada), memperbarui level tiap 0,25 detik dengan `setLevel(v, 1.0)`. **Dijeda** saat mode Kota aktif (`rig.povId === 'kota'`) karena
  `cityPreview` punya suaranya sendiri, dan saat di dalam interior (`portal.inside`).
- [ ] Commit `feat(audio): suasana per kawasan`.

## Tugas 5: Umpan balik aksi

- [ ] `AudioBus.play` sudah ada. Tambah generator pendek `thudBuffer` (cangkul), `splashBuffer` (siram), `popBuffer` (tanam/panen/beli), `tickBuffer` (klik UI),
  masing-masing ≤ 0,3 detik, deterministik, dites panjang + puncak.
- [ ] Pakai: `src/app/farm.js` `applyWork` (cangkul/tanam/siram/panen — `setupFarm` menerima `audioBus`), `src/app/shop.js` saat beli berhasil,
  `Bicycle#cycleMode` (ganti kendaraan). Kanal baru `sfx` (lihat Tugas 6).
- [ ] Commit `feat(audio): bunyi aksi kebun, beli, ganti kendaraan`.

## Tugas 6: Pengaturan suara lengkap

**Berkas:** `src/settings/schema.js:117–119`, `src/ui/bindings/bindAudio.js`, tes `tests/bindings.test.js:167–179`.

- [ ] Tambah ke `audio.mix.fields`: `muted: toggle('Bisukan semua', false)`, `sfx: range('Efek', 0.8, 0, 1, 0.01, { format: 'percent' })`.
  `AUDIO_CHANNELS` menjadi `{ bell: 'bell', ambience: 'ambience', sfx: 'sfx' }`. `bindAudio`: `setMaster(muted ? 0 : master)` (ikat keduanya).
- [ ] Pindahkan `weather.sound` ("Suara hujan") dari grup Cuaca ke grup Audio **tanpa mengganti kuncinya** (kunci tersimpan milik pemain).
- [ ] Tes: `muted = true` → master 0; `muted = false` → master kembali ke nilai `audio.master`. Commit `feat(audio): bisukan semua + kanal efek`.

---

## Selesai bila

- Tes generator + `ambienceMix` + `bikeSoundLevels` lulus; `npm run lint` bersih.
- Uji dengar oleh manusia (headphone): pagi di kampus ada kicau; bersepeda terdengar ban; lepas kayuh terdengar tik-tik rantai; masuk kawasan stadion ada gumam penonton;
  pindah tab → senyap; kembali → bunyi lagi. Tidak ada klik berulang pada hujan.
- Tidak ada lagu berhak cipta, tidak ada berkas audio baru di `public/`.

## Tidak dikerjakan

- Musik. Butuh keputusan user (gaya, apakah disintesis). Dicatat di README rencana bagian "Menunggu user".
- Langkah kaki (butuh fase animasi dari R17).
