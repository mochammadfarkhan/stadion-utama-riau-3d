/**
 * Kit humanoid kampus yang disuntik ke distrik UNRI (keputusan D1: lapisan districts tidak boleh mengimpor
 * entities): mahasiswa (C01 almamater ±30% / C02 kasual, ransel), satpam (C10), LOD humanoid yang ada dengan
 * ambang lebih pendek (hemat draw call), animasi jalan/diam, dan pose M5 (`Humanoid.poses.js`).
 */
import { createHumanoid, animateWalk, animateIdle } from './Humanoid.js';
import { applyPose, clearPose } from './Humanoid.poses.js';
import { createHumanoidLod } from './Humanoid.lod.js';
import { randomStudentOutfit, campusGuardOutfit } from './Humanoid.outfits.js';
import { makeRng } from './util.js';

/** Ambang LOD mahasiswa/satpam (m): detail penuh ≤ near, mesh gabungan ≤ far, di luar disembunyikan. */
export const STUDENT_LOD = Object.freeze({ near: 30, far: 220 });

/**
 * @param {{almamaterChance?: number}} [opts]
 * @returns {Readonly<{createStudent(seed:number):object, createGuard(seed:number):object, createLod():object,
 *   walk(h:object, t:number):void, idle(h:object, t:number):void, pose(h:object, poseId:string, t:number):void,
 *   clearPose(h:object):void, dispose(h:object):void}>}
 */
export function createStudentKit({ almamaterChance = 0.3 } = {}) {
  return Object.freeze({
    createStudent: (seed) => createHumanoid(randomStudentOutfit(makeRng(seed), { almamaterChance })),
    createGuard: (seed) => createHumanoid(campusGuardOutfit(makeRng(seed))),
    createLod: () => createHumanoidLod(STUDENT_LOD),
    walk: (h, t) => animateWalk(h, t),
    idle: (h, t) => animateIdle(h, t),
    pose: (h, poseId, t) => applyPose(h, poseId, t),
    clearPose: (h) => clearPose(h),
    /** Lepas geometri unik humanoid (mesh LOD gabungan); geometri badan & material bersama tidak disentuh. */
    dispose: (h) => h.group.userData.humanoidLod?.mesh.geometry.dispose(),
  });
}
