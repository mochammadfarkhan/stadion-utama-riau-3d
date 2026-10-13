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
  color: 0xb5413a, // merah bata tartan
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

export const COLORS = Object.freeze({
  grass: 0x2f8f3a,
  grassStripe: 0x3aa346,
  concrete: 0xb8b4aa,
  asphalt: 0x3c3c3c,
  louvre: 0x8a5a2b,
  roofWhite: 0xeef0f2,
  sky: 0x9fc9ea,
  water: 0x3b7ea1,
  acp: 0xf1ede4,          // rib putih-krem (ACP)
  roofSilver: 0xe6e8ea,
  louvreGold: 0xb8862d,
  gold: 0xd4af37,
  steel: 0x6b6f75,
  concreteDark: 0x8d8a82,
  terracotta: 0x9c4a2a,
  glass: 0x9fd0e8,
  ironDark: 0x2b2b2b,
  navy: 0x1b2a4a,
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
