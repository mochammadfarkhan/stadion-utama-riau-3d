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
  gateCount: 8,
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
});
