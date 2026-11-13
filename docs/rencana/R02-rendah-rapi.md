# R02 — Preset Rendah tampak sengaja bergaya (G1, G3, G2)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Ini kartu visual: tiap tugas diakhiri bidikan
> `node tools/shots/kritik.mjs --out renders/kritik/<nama> --hanya jalan` yang **kamu buka dan bandingkan sendiri** dengan
> `docs/screenshots/kritik/dasar/` (bidikan dasar 2026-11-14, preset Rendah, gaya kartun).

**Tujuan:** tiga cacat yang membuat Rendah tampak "kurang": benda melayang tanpa bayangan, stadion tenggelam kabut, tepi bergerigi.
**Pilar:** P-1 (sampul yang dikenali). **Keputusan D3:** arah seni dikunci di Rendah. **Tonggak:** T1. **Branch:** `fix/rendah-rapi`.
**Prasyarat:** R00.

## Angka dasar (terukur 2026-11-14, `renders/kritik/dasar/ringkasan.json`)

Preset `rendah` → `pixelRatio 0.75`, `shadowQuality 'mati'`, gaya `kartun`. Kabut di titik awal sore: `scene.fog.near = 112`, `far = 560` (nilai negatif di `far`
= penanda hamburan, lihat `encodeFogFar`). Draw call titik awal 466–488.

---

## Tugas 1: Bayangan kontak yang selama ini tidak pernah terlihat (G1) — **cacat satu baris**

**Akar (terbukti, bukan dugaan):** `src/engine/contactShadows.js:17–31` `blobTexture()` menggambar gradien **hitam** beralpha di kanvas, lalu tekstur itu dipakai sebagai
`alphaMap`. Three.js membaca `alphaMap` dari **kanal hijau**, bukan dari alpha. Piksel tengah kanvas terukur `[0, 0, 0, 255]` → hijau 0 → seluruh cakram transparan.
Mesh-nya sendiri sehat: `visible true`, `count 30`, tinggi tepat (`heightAt + 0.06`). Uji coba mengganti tekstur dengan gradien putih→hitam langsung memunculkan bayangan
(bukti: `docs/screenshots/kritik/dasar/bayangan-kontak-sesudah.jpg`).

**Berkas:** `src/engine/contactShadows.js`; tes baru `tests/contactShadows.test.js`.

**Antarmuka murni baru (supaya bisa dites tanpa kanvas):**
```js
/** Stop gradien alphaMap bayangan kontak: [posisi 0..1, kecerahan 0..255]. Kanal hijau = alpha. */
export const BLOB_STOPS = Object.freeze([[0, 255], [0.55, 140], [1, 0]]);
```

- [ ] **Langkah 1: tes gagal dulu.**
  ```js
  import { describe, it, expect } from 'vitest';
  import { BLOB_STOPS } from '../src/engine/contactShadows.js';

  describe('bayangan kontak', () => {
    it('alphaMap dibaca dari kanal hijau: pusat harus terang, tepi gelap', () => {
      expect(BLOB_STOPS[0]).toEqual([0, 255]);
      expect(BLOB_STOPS.at(-1)).toEqual([1, 0]);
      for (let i = 1; i < BLOB_STOPS.length; i += 1) expect(BLOB_STOPS[i][1]).toBeLessThan(BLOB_STOPS[i - 1][1]);
    });
  });
  ```
- [ ] **Langkah 2: implementasi.** Di `blobTexture()`: isi kanvas hitam dulu (`g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);`), lalu
  `for (const [t, v] of BLOB_STOPS) grad.addColorStop(t, \`rgb(${v},${v},${v})\`);`. Sisanya tidak berubah.
- [ ] **Langkah 3: bidik.** `--out renders/kritik/r02-t1`. Di `sekre-luar.jpg` dan `awal-sore.jpg` ada cakram gelap lembut di bawah sepeda dan di bawah tiap orang.
  `ringkasan.json`: `calls` tidak naik (mesh sudah digambar sejak dulu, hanya transparan).
- [ ] **Langkah 4: setel kekuatan bila perlu.** `src/config/lowpoly.js:79` `CONTACT_SHADOW = { max: 192, opacity: 0.38, playerRadius: 1.0, y: 0.06 }`.
  Bila bayangan terlalu samar di rumput siang → `opacity: 0.45`; terlalu hitam di beton → `0.32`. Satu kali setel, lalu bidik ulang.
- [ ] **Langkah 5: commit** `fix(grafis): bayangan kontak terlihat (alphaMap dibaca dari kanal hijau)`.

## Tugas 2: Pohon dan tiang kawasan stadion ikut berbayangan (G1 lanjutan)

**Keadaan:** sumber bayangan kontak yang terdaftar hanya: humanoid ≤ 30 m (`src/main.js:255`), pohon region Lembaga (`src/regions/unri-lembaga/index.js:160`, radius 32 m),
tiang PJU distrik UNRI (`src/districts/unri/groundLayer.js:170–178`, radius 40 m). Kawasan stadion (pohon lanskap, tiang PJU plaza, bangku) belum.

**Berkas:** `src/regions/stadion/index.js` (dan pembangun lanskap yang dipanggilnya).

- [ ] **Langkah 1: temukan datanya.** `grep -n "plazaLamps\|ringRoadLamps\|benches" src/regions/stadion/*.js src/world/index.js` → posisi tiang ada di `LAYOUT.plazaLamps` dan
  `LAYOUT.ringRoadLamps` (`src/regions/stadion/layout.js:35–36`, region-lokal `{x, z}`). Untuk pohon: `grep -rn "createTrees\|treePositions\|pohon" src/world/landscape* src/world/index.js`
  dan catat nama larik posisinya. **Bila posisi pohon tidak tersedia sebagai larik** (mis. dibuat acak di dalam pembangun), kerjakan tiang saja dan laporkan.
- [ ] **Langkah 2: daftarkan** di tempat region stadion dipasang (pola persis `groundLayer.js:170–178`), dengan konversi region-lokal → dunia memakai `frame.toWorld` /
  `toWorld(placement, x, z)` yang dipakai region itu, radius 40 m, jari-jari cakram tiang `0.5`, pohon `1.6`. Simpan fungsi pelepas yang dikembalikan `registerContactSource`
  dan panggil saat region dibongkar (`dispose`).
- [ ] **Langkah 3: batas.** `CONTACT_SHADOW.max = 192`; bila di plaza ramai jumlahnya mentok (cek `__sim` → `scene.getObjectByName('contactShadows').count`), naikkan `max` ke 256.
- [ ] **Langkah 4: bidik + commit** `feat(grafis): bayangan kontak untuk tiang dan pohon kawasan stadion`.

## Tugas 3: Benda di depan mata tidak lagi tenggelam kabut (G3)

**Akar (dihitung):** `src/world/TimeOfDay.js:130–134` — `fogScale = fogDistance / 1100`; `fogRange(p.fogNear * fogScale, p.fogFar * fogScale, fogLimit)`.
Rendah menyetel `sky.fogDistance = 700` → `fogScale 0.636` → near sore 220 × 0,636 = **140 m**; lalu gaya kartun mengalikan lagi 0,8 (`ATMOSPHERE.fogScale`,
`src/config/lowpoly.js:38`, diterapkan `src/engine/styleManager.js` di `update`) → **112 m** (cocok dengan ukuran). Stadion berjarak 275 m dari titik awal:
(275 − 112) / (560 − 112) = **36% warna kabut**. Yang seharusnya ikut preset hanya jarak **jauh**; jarak dekat tidak perlu ikut menyusut.

**Berkas:** `src/world/TimeOfDay.js`, `tests/fogRange.test.js`.

**Antarmuka murni baru (di `TimeOfDay.js`, di bawah `fogRange`):**
```js
/**
 * Jarak kabut untuk preset: far = min(far × scale, limit); near TIDAK ikut menyusut di bawah `nearFloor`
 * (benda hero di depan pemain tetap jenuh), kecuali far sendiri sudah pendek (near ≤ far / 2).
 */
export function fogForPreset(near, far, scale, limit = Infinity, nearFloor = 300) {
  const f = Math.min(far * scale, limit);
  return { near: Math.max(near * (f / far), Math.min(nearFloor, f * 0.5)), far: f };
}
```

- [ ] **Langkah 1: tes gagal dulu** (tambah impor `fogForPreset`):
  ```js
  describe('fogForPreset (jarak dekat tidak ikut menyusut)', () => {
    it('Rendah sore: far 700, near ditahan di 300', () => {
      const r = fogForPreset(220, 1100, 700 / 1100, 1000);
      expect(r.far).toBeCloseTo(700, 6);
      expect(r.near).toBeCloseTo(300, 6);
    });
    it('malam Rendah: far pendek → near = setengah far', () => {
      const r = fogForPreset(120, 700, 700 / 1100, 1000);
      expect(r.far).toBeCloseTo(445.45, 1);
      expect(r.near).toBeCloseTo(222.73, 1);
    });
    it('skala 1 dengan batas muat: far = batas', () => {
      expect(fogForPreset(220, 1100, 1, 1000).far).toBe(1000);
    });
  });
  ```
- [ ] **Langkah 2: implementasi + pakai.** Di `applyPreset` ganti dua baris `fogScale`/`fogRange` dengan
  `const fog = fogForPreset(p.fogNear, p.fogFar, over.fogDistance / FOG_DEFAULT, fogLimit);`. **Jangan hapus `fogRange`** (masih diekspor dan dites).
- [ ] **Langkah 3: bidik.** `--out renders/kritik/r02-t3`. Di `awal-sore.jpg` warna tribun dan tulisan stadion lebih jenuh daripada dasar; cakrawala tetap berkabut
  (batas muat tile kota tidak terlihat). Periksa juga `awal-malam.jpg` dan `rektorat.jpg`: tidak ada garis potong geometri di kejauhan.
  Ukur dari konsol dev: `__sim.app.scene.fog.near` di titik awal sore ≈ 240 (300 × 0,8).
- [ ] **Langkah 4: commit** `fix(grafis): jarak dekat kabut tidak ikut menyusut di preset rendah`.

## Tugas 4: Penghalus tepi untuk rasio render ≤ 1 (G2)

**Akar:** `src/core/App.js:687–689` renderer `antialias: false`; penghalusan hanya dari supersampling. Di Rendah (`pixelRatio 0.75`, lantai adaptif 0,6 di
`src/core/adaptiveResolution.js`) **tidak ada penghalusan sama sekali**. Rantai pass (`createComposer`, `App.js:706–728`): Render → Outline → Vignette → TiltShift → Bloom →
Grading → `OutputPass`. Three 0.186 menyediakan `three/addons/postprocessing/FXAAPass.js` (ada di `node_modules/three/examples/jsm/postprocessing/`).

**Berkas:** `src/core/App.js`, `src/settings/schema.js` (grup grafik, dekat `outline` baris 72), `src/ui/bindings/bindGraphics.js`, `tests/bindings.test.js`.

**Antarmuka baru:** `App#setFxaa(enabled: boolean): boolean`. Setelan `graphics.fxaa: toggle('Penghalus tepi (FXAA)', true)`.
Aturan aktif: `fxaaPass.enabled = fxaaWanted && this.pixelRatio <= 1` (di atas 1 supersampling sudah cukup; hemat satu lintasan).

- [ ] **Langkah 1: baca `FXAAPass.js`** di `node_modules` untuk melihat cara menyetel resolusinya (`setSize` otomatis lewat `composer.setSize` atau uniform manual). Ikuti API-nya; jangan menebak.
- [ ] **Langkah 2: pasang.** Di `createComposer`: setelah `composer.addPass(new OutputPass());` tambahkan `const fxaaPass = new FXAAPass(); fxaaPass.enabled = false; composer.addPass(fxaaPass);`
  dan kembalikan `fxaaPass`. (FXAA bekerja pada warna akhir sRGB, jadi **sesudah** `OutputPass`.) `EffectComposer` otomatis menulis pass aktif terakhir ke layar.
- [ ] **Langkah 3: `setFxaa` + aturan aktif.** Simpan `this.fxaaWanted`. Panggil pembaruan `enabled` di `setFxaa` **dan** di akhir `#applyPixelRatio(r)` (rasio adaptif berubah-ubah).
- [ ] **Langkah 4: binding.** `bindGraphics.js`: `on('graphics.fxaa', (v) => app.setFxaa?.(v));`. Tes di `tests/bindings.test.js` meniru tes `graphics.outline` yang ada.
  **Tidak** dimasukkan ke `QUALITY_PRESETS` (berlaku di semua preset; aturan rasio yang memutuskan).
- [ ] **Langkah 5: bidik + ukur.** `--out renders/kritik/r02-t4`. Perbesar tulisan "STADION UTAMA RIAU" di `awal-sore.jpg`: tepi huruf tidak lagi bertangga.
  Bandingkan `fps` di `ringkasan.json` dengan `--gaya kartun` sebelum/sesudah (fps headless hanya pembanding kasar).
- [ ] **Langkah 6: keputusan dari angka di laptop user.** Minta user (atau jalankan sendiri bila di laptop itu) membuka `?perf` di titik awal dengan FXAA hidup dan mati.
  **Bila fps turun > 2 di preset Rendah:** ubah default setelan jadi `false` dan sebagai gantinya naikkan lantai resolusi adaptif `ADAPTIVE_MIN_RATIO` dari 0,6 ke 0,7
  (cari konstanta itu di `App.js`). Tulis angka dan keputusan di laporan PR.
- [ ] **Langkah 7: commit** `feat(grafis): FXAA saat rasio render ≤ 1`.

---

## Selesai bila

- `npm run lint` bersih; `node node_modules/vitest/vitest.mjs run tests/contactShadows.test.js tests/fogRange.test.js tests/bindings.test.js` lulus.
- Tiga bidikan `awal-sore.jpg`, `sekre-luar.jpg`, `unri-jalan.jpg` (sesudah) ditaruh di `docs/screenshots/kritik/r02/` dan disandingkan dengan dasar di deskripsi PR.
- `calls` di semua titik tidak naik lebih dari 1 dibanding dasar.
- G1, G2, G3 jadi ✅ di `docs/KRITIK.md`; README rencana diperbarui.

## Tidak dikerjakan

- Bayangan matahari sungguhan di Rendah (`shadowQuality 'mati'` tetap). Bayangan kontak adalah gantinya.
- Variasi warna rumput (G4) → R03 menyelesaikan akarnya dengan memindah titik mulai.
