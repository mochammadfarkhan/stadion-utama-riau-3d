/**
 * Data kawasan region "stadion" (region-lokal, meter; origin = pusat lapangan, −Z = utara).
 * Dulu `STADIUM`/`SITE` di config/constants.js; di sana kini hanya re-export kompatibilitas.
 */
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

/** Danau kawasan (elips air, region-lokal): satu sumber untuk visual (Landscape.water), zona, dan collider. */
const LAKE = Object.freeze({ x: -60, z: -480, semiX: 90, semiZ: 55 });
/** Tugu Lancang Kuning di plaza utara: satu sumber untuk collider, cerita, dekal, model GLB, dan Monument. */
const TUGU = Object.freeze({ x: 0, z: -(STADIUM.outerSemiZ + 45), poolR: 8.0 });

// Lanskap sekitar
export const SITE = Object.freeze({
  groundSize: 1400,
  ringRoadSemiX: 230,
  ringRoadSemiZ: 290,
  ringRoadWidth: 10,
  plazaSemiX: 150,
  plazaSemiZ: 200,
  parkingNorthZ: -330,
  lakeCenter: Object.freeze({ x: LAKE.x, z: LAKE.z }),
  lake: LAKE,
  tugu: TUGU,
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
