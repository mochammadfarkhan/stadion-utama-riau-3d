# Desain: Simulator 3D Stadion Utama Riau

Tanggal: 2026-10-13 · Status: dieksekusi langsung sesuai instruksi user ("plan dulu lalu eksekusi tanpa berhenti"); asumsi dicatat di bagian 8.

## 1. Tujuan
Simulator web interaktif (Three.js) kawasan Stadion Utama Riau, Pekanbaru, di mana pengguna **bersepeda** keliling luar dan dalam stadion, bertemu **pedagang minuman & buah** (bisa membeli), menonton **pemain sepak bola NPC** bertanding, dan **pelari di tiap lane** lintasan atletik. Lingkungan harus terasa realistis: eksterior (rib putih miring, louvre coklat-emas, atap Kalzip bergelombang, selembayung, plaza, parkir, danau, tugu Lancang Kuning) dan interior (tribun 2 tier kursi warna-warni, lapangan 105×68, lintasan 8 lane merah bata, floodlight di lingkar atap, videotron, patung serindit) lengkap dengan furnitur kecil (bangku, tempat sampah, tiang lampu, tiang bendera, pagar, pos jaga, dll).

## 2. Lingkup
Masuk: semua di atas, berjalan di browser desktop (Chrome/Edge) ~60 fps di GPU menengah, tanpa aset eksternal (semua geometri prosedural), unit test untuk logika murni, deploy GitHub Pages.
Tidak masuk: multiplayer, audio selain bel sintetis, kontrol sentuh, siklus siang-malam, physics engine.

## 3. Arsitektur
Satu halaman Vite, ES modules, tanpa framework. Skala 1 unit = 1 m, origin = titik tengah lapangan, sumbu panjang lapangan = Z, Y ke atas. Jl. Naga Sakti dan plaza utama di sisi **utara** (−Z). Tribun VIP di **barat** (−X).

```
src/
  main.js                 bootstrap: App + world + entities + HUD
  core/App.js             renderer, scene, kamera, Timer, loop, resize
  core/Input.js           keyboard snapshot
  core/CameraRig.js       third-person follow / first-person pointer-lock (tombol V)
  config/constants.js     semua dimensi & warna (sumber kebenaran tunggal)
  sim/                    LOGIKA MURNI, tanpa THREE.Mesh, unit-tested
    ellipse.js            tabel panjang busur elips untuk penempatan merata
    trackPath.js          path oval 400 m per lane (CurvePath), panjang, titik, tangent
    bikePhysics.js        stepBike(state, input, dt) → state baru (immutable)
    runnerSim.js          stepRunner(runner, dt) — kecepatan variatif, jarak wrap
    footballAI.js         stepMatch — FSM CHASE/KICK/RETURN + bola gravitasi/pantul, gol reset
    vendorSim.js          FSM pedagang IDLE/WANDER + transaksi (wallet, inventori)
  world/                  builder geometri; export createX(opts) → THREE.Group
    Lighting.js           Sky + matahari + hemisphere + fog + PMREM env
    Ground.js             tanah, jalan lingkar, Jl. Naga Sakti, plaza paving, parkir
    Landscape.js          danau, pepohonan, baseball, helipad, amphitheater, sungai+jembatan
    stadium/Shell.js      rib miring, atap oval Kalzip (normal map bergelombang), listplank
    stadium/Facade.js     louvre instanced, selembayung X, papan nama, gate
    stadium/Tribune.js    tribun beton 2 tier + kursi InstancedMesh per sektor + railing + tangga
    stadium/Pitch.js      rumput strip, marka FIFA, gawang, bendera corner, bench, A-board
    stadium/Track.js      lintasan 8 lane, garis, kerb
    stadium/Fixtures.js   floodlight lingkar atap, speaker, videotron, patung serindit, tunnel
    props/*.js            Bench, TrashBin, LampPost, Flagpole, Fence, GuardPost, Planter,
                          Signage, Monument (Lancang Kuning + kolam), Gapura, Vehicles, Cart
  entities/               objek bergerak: class dengan .group dan .update(dt, ctx)
    Humanoid.js           manusia low-poly prosedural + animasi lari/jalan/idle/tendang
    Bicycle.js            mesh sepeda + binding ke bikePhysics + bel sintetis
    Runner.js             pelari di lane (trackPath + runnerSim)
    Footballer.js         2 tim × 5 + bola (footballAI)
    Vendor.js             pedagang minuman/buah dengan gerobak, label, interaksi E
    Crowd.js              penonton instanced di tribun, warga jalan/senam di plaza
  ui/HUD.js, hud.css      speed, uang, inventori, prompt interaksi, minimap, overlay start
tests/*.test.js           vitest untuk sim/*
```

Aliran per frame: Input → stepBike → CameraRig → entities.update(dt, ctx{bikePos, time}) → render utama → minimap → CSS2D labels.

Kontrak antarmodul:
- `world/*`: `export function createX(opts = {}) : THREE.Group`; opsional `group.userData.update = (dt, t) => {}`.
- `entities/*`: `export class X { constructor(opts); group: THREE.Group; update(dt, ctx) }`.
- `sim/*`: fungsi murni, plain object in/out, tidak memutasi input.
- Semua angka dari `config/constants.js`.

## 4. Fitur utama
1. **Sepeda**: W/S kayuh/rem, A/D belok, Shift sprint, Space bel; lean saat belok; roda & pedal berputar; collider elips sederhana (tidak menembus tribun) dan bisa masuk stadion lewat gate utara/barat lalu keliling lintasan.
2. **Pedagang**: 3 gerobak minuman (es teh, es jeruk, air mineral) & 3 gerobak buah potong di plaza utara dan jalan lingkar; label CSS2D; jarak <3 m muncul prompt "Tekan E"; dialog pilih item; uang awal Rp 50.000; inventori di HUD; pedagang berjalan pelan antar waypoint.
3. **Pemain bola**: 10 pemain (2 tim) + bola; FSM kejar–tendang/oper–kembali; bola memantul, gol reset ke tengah; animasi lari/tendang.
4. **Pelari**: satu per lane (8) kecepatan 2,5–5 m/s, berlawanan arah jarum jam, pakaian beragam; plus pelari/pejalan di jalan lingkar luar.
5. **Lingkungan**: checklist docs/research/stadion-utama-riau.md §6.
6. **HUD**: kecepatan, uang, inventori, prompt, minimap, mode kamera, FPS.

## 5. Performa
InstancedMesh untuk kursi, louvre, penonton, pohon, tiang; Lambert untuk massa besar; satu bayangan directional 4096 dengan frustum ±220 m; pixelRatio ≤ 1.5; fog; frustum culling per sektor.

## 6. Error handling
WebGL tidak tersedia → overlay pesan. Pointer lock ditolak → tetap third-person. dt dibatasi ≤ 0,05 s; guard NaN di sim.

## 7. Testing
Vitest untuk sim/*: panjang lane, batas kecepatan & immutability sepeda, transisi FSM & bola, transaksi wallet tidak negatif, wrap jarak pelari. Smoke test browser via dev server + screenshot.

## 8. Asumsi
- Waktu sore cerah tropis (~16.30); kondisi stadion terawat pasca-revitalisasi 2026 dengan jejak autentik (sebagian kursi pudar, tugu putih, pohon muda berajir).
- Rupiah, UI bahasa Indonesia. Karakter prosedural low-poly (nol dependensi jaringan).
- Tulisan lambung tugu kapal: "LANCANG KUNING".
