/**
 * Tata letak region stadion: posisi props & titik aktivitas (data murni, tanpa THREE, region-lokal).
 * Origin = pusat lapangan; utara = −Z (Jl. Naga Sakti, plaza depan); barat = −X.
 */
import { STADIUM, SITE } from './site.js';

const TWO_PI = Math.PI * 2;

/** Titik merata (parametrik) di elips; yaw menghadap pusat bila faceCenter. */
export function ringPositions(semiX, semiZ, count, { phase = 0, faceCenter = true, skip = () => false } = {}) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const th = phase + (i / count) * TWO_PI;
    const x = semiX * Math.cos(th);
    const z = semiZ * Math.sin(th);
    if (skip(x, z, th)) continue;
    out.push({ x, z, rotY: faceCenter ? Math.atan2(-x, -z) : Math.atan2(x, z) });
  }
  return out;
}

const PLAZA_RING = { semiX: STADIUM.outerSemiX + 22, semiZ: STADIUM.outerSemiZ + 30 };
const RING_ROAD_SIDEWALK = { semiX: SITE.ringRoadSemiX + 8, semiZ: SITE.ringRoadSemiZ + 8 };

// PJU rusak (padam) — satu sumber untuk tiang (world/index.js) dan lampu malam (regions/stadion/lamps.js).
const BROKEN_PLAZA_LAMP = (i) => i % 7 === 3;
const BROKEN_RING_LAMP = (i) => i % 9 === 4;
const withBroken = (list, isBroken) => list.map((p, i) => ({ ...p, broken: isBroken(i) }));

export const LAYOUT = Object.freeze({
  benches: ringPositions(PLAZA_RING.semiX, PLAZA_RING.semiZ, 48, { phase: 0.03 }),
  trashBins: ringPositions(PLAZA_RING.semiX + 1.5, PLAZA_RING.semiZ + 1.5, 32, { phase: 0.08 }),
  planters: ringPositions(PLAZA_RING.semiX - 4, PLAZA_RING.semiZ - 4, 24, { phase: 0.12 }),
  plazaLamps: withBroken(ringPositions(PLAZA_RING.semiX + 6, PLAZA_RING.semiZ + 6, 28, { phase: 0.05 }), BROKEN_PLAZA_LAMP),
  ringRoadLamps: withBroken(ringPositions(RING_ROAD_SIDEWALK.semiX, RING_ROAD_SIDEWALK.semiZ, 44), BROKEN_RING_LAMP),
  // PJU, pagar, dan lapak PKL Jl. Naga Sakti handmade dihapus Plan C bersama jalannya (jalan nyata = tile OSM).
  guardPosts: [
    { x: -16, z: SITE.gapuraZ + 8, rotY: Math.PI / 2 },
    { x: 16, z: SITE.gapuraZ + 8, rotY: -Math.PI / 2 },
  ],
  roadSigns: [
    { x: 22, z: SITE.gapuraZ + 20, rotY: Math.PI, text: 'STADION UTAMA RIAU →', kind: 'direction' },
    { x: -22, z: SITE.gapuraZ + 20, rotY: Math.PI, text: 'DILARANG PARKIR', kind: 'prohibition' },
    { x: 30, z: -245, rotY: Math.PI, text: 'AREA BEBAS ROKOK', kind: 'info' },
    { x: -30, z: -245, rotY: Math.PI, text: 'JAGA KEBERSIHAN', kind: 'info' },
  ],
  banners: [
    { x: -60, z: -236, rotY: Math.PI, text: 'SELAMAT DATANG DI STADION UTAMA RIAU' },
    { x: 60, z: -236, rotY: Math.PI, text: 'AYO PSPS RIAU — ASKAR BERTUAH' },
  ],
  billboards: [
    { x: 250, z: -60, rotY: -Math.PI / 2, text: 'PEKANBARU SMART CITY' },
    { x: -250, z: 60, rotY: Math.PI / 2, text: 'AYO OLAHRAGA' },
  ],
  // Model GLB hasil Blender (public/models/...). Posisi dunia, Y ke atas.
  blenderModels: [
    { path: 'models/uji/bangku-taman.glb', x: 7, z: -186, rotY: Math.PI },
    // Tugu Lancang Kuning (Blender) menggantikan versi prosedural di posisi yang sama
    { path: 'models/monumen/lancang-kuning.glb', x: SITE.tugu.x, z: SITE.tugu.z, replaces: 'tuguLancangKuning' },
    // Patung serindit (Blender) menggantikan versi prosedural di posisi yang sama (lihat Fixtures.props STATUE_POS)
    // Angkot & bus kota pindah ke src/city/parkedVehicles.js (mangkal di lokasi nyata, Plan C Task 18b).
    { path: 'models/monumen/serindit.glb', x: 22, z: -(STADIUM.innerSemiZ - 8), replaces: 'patungSerindit' },
  ],
  plazaCenter: { x: 0, z: -180 },
  plazaSpots: {
    exercise: { x: -45, z: -178, yaw: 0 },
    badminton: { x: 48, z: -180, yaw: Math.PI / 2 },
    // skaters: default Crowd.plaza (paving plaza); taman seluncur timur fiktif dihapus Plan C
  },
  vendors: [
    { id: 'v-teh', kind: 'minuman', waypoints: [{ x: -28, z: -188 }, { x: 28, z: -188 }] },
    { id: 'v-jeruk', kind: 'minuman', waypoints: [{ x: 142, z: -40 }, { x: 142, z: 40 }] },
    { id: 'v-air', kind: 'minuman', waypoints: [{ x: -30, z: 248 }, { x: 30, z: 248 }] },
    { id: 'v-buah', kind: 'buah', waypoints: [{ x: -62, z: -192 }, { x: -62, z: -150 }] },
    { id: 'v-rujak', kind: 'buah', waypoints: [{ x: -142, z: 30 }, { x: -142, z: -30 }] },
    { id: 'v-jerukbuah', kind: 'buah', waypoints: [{ x: -12, z: -300 }, { x: -12, z: -400 }] }, // sumbu utara menuju gapura
  ],
  loopWalkers: [
    { count: 10, semiX: SITE.ringRoadSemiX + 7, semiZ: SITE.ringRoadSemiZ + 7, speedRange: [1.2, 4.5] },
    { count: 7, semiX: SITE.ringRoadSemiX + SITE.joggingTrackOffset, semiZ: SITE.ringRoadSemiZ + SITE.joggingTrackOffset, speedRange: [2.5, 4.8] },
    { count: 6, semiX: PLAZA_RING.semiX - 8, semiZ: PLAZA_RING.semiZ - 8, speedRange: [1.0, 2.0] },
  ],
  spawn: Object.freeze({ x: 0, z: -275, yaw: 0 }), // posisi awal sepeda: plaza utara, menghadap stadion
  spectatorCount: 9000, // ±23% kursi terisi (dulu 3.200 = 8%: tier atas tampak kosong); geometri penonton dihemat
});
