/**
 * Data kawasan region "stadion" (region-lokal, meter; origin = pusat lapangan, −Z = utara). Data murni.
 * Diekspor ulang oleh config/constants.js (impor lama) dan regions/stadion/site.js (Plan C, M1).
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
  tugu: TUGU,
  // --- tambahan lanskap kawasan ---
  // Jl. Naga Sakti handmade (z −390) dihapus Plan C: jalan nyata dari tile OSM (z ≈ −445…−471).
  connectorXs: [0],            // sumbu utara: gapura → jalan lingkar (sumbu pedestrian OSM way 1452277714)
  parkingCar: { x: 0, z: -330, w: 240, d: 50 },
  parkingMoto: { x: 190, z: -330, w: 80, d: 40 },
  joggingTrackOffset: 12,      // jarak jalur jogging dari sumbu jalan lingkar
  joggingTrackWidth: 2.5,
  tanjakMonument: { x: 190, z: 0 },
  gapuraZ: -436,               // ujung utara sumbu pedestrian OSM, ±11 m sebelum jalur Naga Sakti terdekat (z ≈ −447)
});
