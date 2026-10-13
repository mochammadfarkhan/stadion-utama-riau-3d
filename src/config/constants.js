/**
 * Konstanta dimensi dunia (satuan: meter, sumbu Y ke atas).
 * Pusat stadion = origin (0,0,0). Sumbu panjang lapangan sejajar sumbu Z.
 */

// Lapangan sepak bola (standar FIFA 105 x 68)
export const PITCH = Object.freeze({
  length: 105,
  width: 68,
  goalWidth: 7.32,
  goalHeight: 2.44,
  goalDepth: 2.0,
  penaltyBoxLength: 16.5,
  penaltyBoxWidth: 40.32,
  goalBoxLength: 5.5,
  goalBoxWidth: 18.32,
  centerCircleRadius: 9.15,
  penaltySpot: 11,
  lineWidth: 0.12,
});

// Lintasan atletik 400 m standar World Athletics
export const TRACK = Object.freeze({
  laneCount: 8,
  laneWidth: 1.22,
  straightLength: 84.39,
  innerRadius: 36.5, // radius garis ukur lane 1 (0.3 m dari kerb)
  kerbOffset: 0.3,
  color: 0xe07a5f, // tartan salmon (pastel hangat)
  lineColor: 0xffffff,
});

// Tribun & cangkang stadion
export const STADIUM = Object.freeze({
  // Elips dasar tribun (semi-axis), sedikit lebih besar dari lintasan
  innerSemiX: 60,   // lebar (sumbu X)
  innerSemiZ: 100,  // panjang (sumbu Z)
  outerSemiX: 118,
  outerSemiZ: 160,
  tierCount: 2,
  lowerRows: 22,
  upperRows: 26,
  rowDepth: 0.8,
  rowRise: 0.42,
  seatWidth: 0.5,
  seatColors: [0xf2b705, 0x1f7a3a, 0xd62828], // kuning, hijau, merah
  roofHeight: 42,
  facadeHeight: 30,
  louvreLevels: 5,
  louvreRows: 6,           // baris bilah per band louvre
  louvreTilt: Math.PI / 6, // kemiringan bilah 30°
  gateCount: 12,
  gateHeight: 5,
  mainGateHeight: 6.5,
  ribCount: 20,
  ribLean: 0.22,           // offset rib keluar (fraksi span luar→dalam) di puncak fasad
  roofOpeningPad: 8,       // bukaan atap dalam = innerSemi + pad
  concourseHeight: 7,      // tinggi dinding concourse lantai dasar
});

// Lanskap sekitar
export const SITE = Object.freeze({
  groundSize: 1400,
  ringRoadSemiX: 230,
  ringRoadSemiZ: 290,
  ringRoadWidth: 10,
  plazaSemiX: 150,
  plazaSemiZ: 200,
  parkingNorthZ: -330,
  lakeCenter: { x: -60, z: -480 },
  baseballCenter: { x: -300, z: 260 },
  // --- tambahan lanskap kawasan ---
  nagaSaktiZ: -390,            // parkingNorthZ - 60; Jl. Naga Sakti sejajar sumbu X
  nagaSaktiLanes: 3,
  laneWidth: 3.5,
  connectorXs: [0, 140],       // jalan penghubung Naga Sakti -> jalan lingkar
  parkingCar: { x: 0, z: -330, w: 240, d: 50 },
  parkingMoto: { x: 190, z: -330, w: 80, d: 40 },
  joggingTrackOffset: 12,      // jarak jalur jogging dari sumbu jalan lingkar
  joggingTrackWidth: 2.5,
  helipadCenter: { x: 400, z: -100, r: 14 },
  amphitheaterCenter: { x: -150, z: 330 },
  riverX: 330,                 // sungai kecil memanjang sumbu Z di timur
  riverWidth: 6,
  bridgeZ: -100,
  skateCenter: { x: 260, z: 120 },
  tanjakMonument: { x: 190, z: 0 },
  gapuraZ: -372,
});

// Layer render (THREE.Layers): 0 = kamera utama, 1 = objek besar yang ikut tampil di minimap
export const RENDER_LAYERS = Object.freeze({ main: 0, minimap: 1 });

// Palet "cozy stylized": pastel hangat, kontras lembut (gaya Dinkum/Overcooked).
export const COLORS = Object.freeze({
  grass: 0xa8d26b,        // rumput kuning-hijau
  grassStripe: 0xb6dc7a,  // strip rumput sedikit lebih terang
  concrete: 0xe8e0d0,     // beton krem
  asphalt: 0x6b7280,      // aspal abu kebiruan
  louvre: 0xc8956a,       // bilah louvre cokelat hangat lembut
  roofWhite: 0xfbf7ef,    // atap putih hangat
  sky: 0xbfe0f7,          // langit biru muda
  water: 0x7fcfc9,        // air toska lembut
  acp: 0xf7f2e8,          // rib putih-krem (ACP)
  roofSilver: 0xf0efea,
  louvreGold: 0xdcb46e,   // emas lembut
  gold: 0xe6c874,
  steel: 0x8e94a6,
  concreteDark: 0xcdc4b2,
  terracotta: 0xd48c6c,
  glass: 0xc2e4f2,
  ironDark: 0x4b5160,
  navy: 0x3d4c78,
  shadowTint: 0xa9c4ea,   // warna cahaya langit (hemisphere) -> bayangan kebiruan
  fog: 0xd9e8f6,          // kabut sewarna langit
});

// Pengaturan render & post-processing (core/App.js)
export const RENDER = Object.freeze({
  ao: false,              // GTAO (ambient occlusion); runtime: app.setAO(false) / tombol O
  vignette: true,
  pixelRatio: 1.25,       // batas atas devicePixelRatio
  exposure: 0.9,          // tone mapping exposure (AgX, diterapkan sekali di OutputPass)
  aoRadius: 1.5,          // radius AO dalam meter (skala dunia)
  aoBlend: 0.7,           // intensitas blend AO
  aoScale: 0.5,           // resolusi buffer AO relatif terhadap layar (hemat GPU; AO tetap halus)
  vignetteOffset: 0.9,    // VignetteShader: jangkauan dari pusat
  vignetteDarkness: 1.0,  // VignetteShader: 1 = sudut menuju hitam (tipis karena offset < 1)
  outline: true,          // garis tepi tipis screen-space (core/postprocessing/OutlinePass.js)
  outlineColor: 0x1b2a33, // biru-arang gelap (sRGB)
  outlineIntensity: 0.55, // opasitas garis maksimum
  outlineThickness: 1,    // lebar garis dalam piksel CSS (dikali pixelRatio)
  outlineFadeStart: 60,   // mulai memudar (m)
  outlineFadeEnd: 120,    // tidak ada garis lebih jauh dari ini (m)
  outlineThreshold: 0.0025, // ambang turunan-kedua kedalaman relatif (mulai tampak)
  outlineSoftness: 0.01,  // lebar transisi ambang → garis penuh
});

export const BIKE = Object.freeze({
  maxSpeed: 9,       // m/s (~32 km/h)
  sprintSpeed: 13,
  accel: 3.5,
  brake: 7,
  drag: 0.6,
  turnRate: 1.6,     // rad/s pada kecepatan rendah
  wheelRadius: 0.34,
  leanMax: 0.35,
  wheelBase: 1.05,     // jarak sumbu roda (m) untuk model kinematik
  steerMax: 0.6,       // sudut setang maksimum (rad)
  steerRate: 4,        // kecepatan smoothing setang (1/s)
  steerSpeedFactor: 0.08, // pengurangan sudut setang per m/s
  reverseSpeed: 1.5,   // kecepatan mundur maksimum (m/s)
  reverseAccel: 1.5,   // akselerasi mundur (m/s²)
  pedalRatio: 0.45,    // putaran pedal relatif terhadap roda
  leanSmoothing: 8,    // smoothing lean (1/s)
});

// Simulasi sepak bola (sim/footballAI.js)
export const FOOTBALL = Object.freeze({
  ballRadius: 0.11,
  gravity: 9.81,
  restitution: 0.55,   // pantul tanah
  wallRestitution: 0.6,
  rollFriction: 0.5,   // peluruhan kecepatan gulir (1/s)
  airDrag: 0.05,
  restVelocity: 0.4,   // di bawah ini pantulan vertikal dihentikan
  playerSpeed: 6,      // m/s
  playerAccel: 14,     // m/s²
  arriveRadius: 2.5,
  kickRange: 0.9,
  kickAnimTime: 0.4,   // durasi kickTimer (animasi + jeda tendang ulang)
  playerMargin: 3,     // pemain boleh keluar pitch sejauh ini (m)
  formationDepth: 5,   // jarak kiper dari garis gawang
  defenderDepth: 20,   // jarak baris bek dari garis gawang
  attackerDepth: 10,   // jarak baris penyerang dari garis tengah
  formationSpread: 0.6, // rasio lebar pitch untuk sebaran x
  shootSpeed: 16,
  shootRange: 30,
  passSpeed: 11,
  kickLift: 0.2,       // komponen vertikal tendangan (rasio)
  separationRadius: 1,
  separationForce: 4,
  returnShift: 0.2,    // pergeseran home mengikuti bola
});

// Pedagang keliling (sim/vendorSim.js)
export const VENDOR = Object.freeze({
  walkSpeed: 0.8,
  dwellSeconds: 6,
  arriveEpsilon: 0.05,
  startBalance: 50000,
});

// Siklus waktu (sim/dayCycle.js, world/TimeOfDay.js)
export const DAY = Object.freeze({
  startHour: 16.5,         // jam awal (sore, sesuai pencahayaan default)
  timeSpeed: 0.25,         // jam per detik nyata saat tombol T aktif
  sunriseHour: 6.0,
  sunsetHour: 18.3,
  maxElevationDeg: 75,     // puncak matahari (tropis dekat khatulistiwa)
  nightDepthDeg: 40,       // kedalaman matahari di bawah horizon tengah malam
  lampsOnHour: 17.8,       // lampu PJU menyala
  lampsOffHour: 6.2,       // lampu PJU padam
  maxPointLights: 8,       // PointLight nyata di sekitar sepeda (malam)
  pointLightRange: 60,     // jarak maksimum PJU yang dinyalakan (m)
  pointLightInterval: 0.5, // detik antar pemilihan ulang PJU terdekat
  starCount: 1500,
  envRebuildInterval: 1,   // detik minimum antar regenerasi env map
});

// Cuaca (world/Weather.js, world/Weather.rain.js)
export const WEATHER = Object.freeze({
  transitionSeconds: 2,
  dropCount: 4000,
  rainBox: { x: 40, y: 30, z: 40 }, // kotak hujan mengikuti kamera (m)
  fallSpeedMin: 9,
  fallSpeedMax: 12,
  wind: { x: 1.2, z: 0.4 },         // m/s
  streakLength: 0.35,               // panjang goresan tetes (m)
  splashCount: 200,
  splashRadius: 14,                 // radius cipratan di sekitar sepeda (m)
  splashLife: 0.45,                 // detik
  fogScale: 0.6,                    // near/far kabut saat hujan
  lightScale: 0.65,                 // matahari & hemisphere saat hujan
  exposureScale: 0.92,
  cloudCoverage: 0.9,
  cloudDensity: 0.7,
  wetRoughness: 0.25,
  wetEnvIntensity: 1.5,
  wetDarken: 0.8,
  puddleCount: 14,
});

// Rumput bilah instanced mengikuti pemain (world/Grass.js)
export const GRASS = Object.freeze({
  count: 24000,            // pool bilah (3 bilah per rumpun → 8000 instance)
  bladesPerClump: 3,
  cellSize: 8,             // sisi sel grid (m)
  radius: 60,              // jarak maksimum bilah dari fokus (m)
  fadeStart: 40,           // mulai memudar (skala bilah → 0 di radius)
  moveThreshold: 4,        // fokus berpindah > ini → hitung ulang sel keluar/masuk (m)
  clumpsPerCell: 36,       // rumpun per sel 8×8 m (±1 rumpun / 1,8 m²)
  heightMin: 0.25,
  heightMax: 0.45,
  bladeWidth: 0.07,        // lebar pangkal bilah (m)
  clumpSpread: 0.12,       // jarak bilah dari pusat rumpun (m)
  bendMin: 0.05,           // lengkung ujung bilah (m)
  bendMax: 0.14,
  windScale: 0.22,         // pengali windOffset (angin pohon terlalu besar untuk bilah 0,4 m)
  flutter: 0.015,          // getar halus per rumpun (m)
  colorBase: 0x5e8a36,     // pangkal (lebih gelap dari COLORS.grass 0xa8d26b)
  colorTip: 0x9fcb5c,      // ujung (lebih terang, selaras grassStripe)
  tintVariance: 0.12,      // variasi warna per rumpun (±)
  envAmbient: 0.9,         // perkiraan kontribusi env map pada rumput (setara LDR)
  lightPad: 0.08,          // radiansi minimum agar tidak hitam pekat saat malam
});

/**
 * Ketinggian lapisan permukaan datar di dalam stadion (m). Lapisan yang saling
 * bertumpuk WAJIB berbeda ≥ 1 cm agar tidak z-fighting. Tanah kawasan (y=0)
 * dilubangi di bawah stadion (groundHoleInset) sehingga tidak berimpit dengan ini.
 * Urutan bawah → atas: apron/D-zone/tartan → parit → lapangan → garis.
 */
export const SURFACE_Y = Object.freeze({
  groundHoleInset: 0.5,   // lubang tanah = elips kaki tribun dikurangi ini (overlap tertutup apron)
  apron: 0.01,
  dzone: 0.01,            // tidak bertumpuk dengan apron (dipisah tartan)
  tartan: 0.01,           // berbagi tepi dengan apron & D-zone, tidak bertumpuk
  drain: 0.02,            // di atas apron
  pitch: 0.02,            // di atas D-zone
  trackLine: 0.03,
  pitchLine: 0.035,
});
