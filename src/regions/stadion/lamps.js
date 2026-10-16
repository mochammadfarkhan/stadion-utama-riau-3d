/**
 * PJU yang menyala di region stadion (dipakai TimeOfDay untuk PointLight, kolam cahaya, halo).
 */
// Aturan PJU rusak harus sama dengan world/index.js (plaza i%7==3, jalan lingkar i%9==4).
const PLAZA_BROKEN = (i) => i % 7 === 3;
const RING_BROKEN = (i) => i % 9 === 4;

/** Posisi semua PJU yang berlampu (data murni). */
export function litLampPositions(layout) {
  return [
    ...layout.plazaLamps.filter((_, i) => !PLAZA_BROKEN(i)),
    ...layout.ringRoadLamps.filter((_, i) => !RING_BROKEN(i)),
    ...layout.nagaSaktiLamps,
  ].map((p) => ({ x: p.x, z: p.z }));
}
