/**
 * Satpam kampus (katalog C10) di Pos Keamanan OSM way/327534471 (Gerbang Binakrida, Jl. Binawidya UNRI; riset §4
 * "satpam UNRI berjaga di pos" [T]): berdiri di sisi selatan & utara pos menghadap jalan. Posisi berdiri dan
 * seragam (`campusGuardOutfit`) = [INFERENSI]. Tinggi tanah diperbarui tiap detik (chunk terrain bisa tiba belakangan).
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';

export const GUARD_SPOTS = Object.freeze([
  Object.freeze({ id: 'satpam-binakrida-selatan', x: -1074.7, z: 1287.8, yaw: 0 }),
  Object.freeze({ id: 'satpam-binakrida-utara', x: -1074.7, z: 1303.6, yaw: Math.PI }),
]);
const REGROUND_SEC = 1;

export function createGuards({ npc, terrain, scheduler, scope, camera, spots = GUARD_SPOTS }) {
  const group = new THREE.Group();
  group.name = 'satpamKampus';
  const lod = npc.createLod();
  const guards = [];
  let t = 0;
  let reground = 0;
  const task = scheduler.schedule(function* buildGuards() {
    for (let i = 0; i < spots.length; i += 1) {
      const s = spots[i];
      const h = withScope(scope, () => npc.createGuard(0xc10 + i));
      h.group.name = s.id;
      h.group.position.set(s.x, terrain.heightAt(s.x, s.z), s.z);
      h.group.rotation.y = s.yaw;
      group.add(h.group);
      lod.addFrom(h.group);
      guards.push({ h, spot: s, phase: i * 1.7 });
      yield;
    }
  }, { owner: 'unri:satpam' });
  return {
    group,
    get stats() { return { count: guards.length }; },
    update(dt) {
      t += dt;
      reground -= dt;
      const regroundNow = reground <= 0;
      if (regroundNow) reground = REGROUND_SEC;
      for (const g of guards) {
        if (regroundNow) g.h.group.position.y = terrain.heightAt(g.spot.x, g.spot.z);
        npc.idle(g.h, t + g.phase);
      }
      lod.update(camera.position);
    },
    dispose() {
      task.cancel();
      guards.forEach((g) => npc.dispose(g.h));
      group.removeFromParent();
      group.clear();
    },
  };
}
