/**
 * P03 PJU kampus per chunk dari props.lamps ground (posisi tiang + yaw ke jalan). lampHeads → posisi kepala
 * lampu (dunia) untuk registerLamps TimeOfDay (kolam cahaya, halo, PointLight terdekat).
 */
import { PJU_KAMPUS, createPjuKampusInstances } from '../../world/props/unri/pjuKampus.js';

/** [{x, z, yaw}] tiang → [{x, z}] kepala lampu (lengan sepanjang armReach ke arah yaw). */
export function lampHeads(lamps, reach = PJU_KAMPUS.armReach) {
  return lamps.map((l) => ({ x: l.x + Math.sin(l.yaw) * reach, z: l.z + Math.cos(l.yaw) * reach }));
}

/** InstancedMesh PJU (2 draw call); y dari permukaan chunk. Panggil di dalam withScope(scopeDistrik). */
export function buildLamps(lamps, heightAt) {
  return createPjuKampusInstances(lamps.map((l) => ({ x: l.x, z: l.z, y: heightAt(l.x, l.z), rotY: l.yaw })));
}
