/**
 * PJU yang menyala di region stadion (dipakai TimeOfDay untuk PointLight, kolam cahaya, halo).
 * Status rusak dibaca dari data layout (flag `broken`), bukan aturan salinan.
 */
export function litLampPositions(layout) {
  return [...layout.plazaLamps, ...layout.ringRoadLamps, ...layout.nagaSaktiLamps]
    .filter((p) => !p.broken)
    .map((p) => ({ x: p.x, z: p.z }));
}
