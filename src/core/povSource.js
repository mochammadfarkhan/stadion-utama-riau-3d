import { pointOnLane } from '../sim/trackPath.js';

/**
 * Adapter entitas → sumber posisi untuk POV (lihat cameraPresets.povPose).
 * Mengembalikan objek yang dipakai ulang (tanpa alokasi per panggilan selain hasil sim).
 * @param {{bike:{state:object}, match?:{ball?:{pos:{x:number,z:number}}},
 *   runners?:{runners:object[]}, vendors?:{vendors:object[]}}} ents
 */
export function createPovSource(ents) {
  const ballOut = { x: 0, z: 0 };
  const runnerOut = { x: 0, z: 0, yaw: 0 };
  const vendorOut = { x: 0, z: 0, yaw: 0 };
  const wrap = (i, n) => ((i % n) + n) % n;

  return {
    get bike() { return ents.bike.state; },

    ball() {
      const pos = ents.match?.ball?.pos;
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return null;
      ballOut.x = pos.x;
      ballOut.z = pos.z;
      return ballOut;
    },

    runnerCount() { return ents.runners?.runners.length ?? 0; },
    runner(i) {
      const list = ents.runners?.runners ?? [];
      if (list.length === 0) return null;
      const r = list[wrap(i, list.length)];
      const p = pointOnLane(r.lane, r.dist);
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.z)) return null;
      runnerOut.x = p.x;
      runnerOut.z = p.z;
      runnerOut.yaw = p.yaw ?? 0;
      return runnerOut;
    },

    vendorCount() { return ents.vendors?.vendors.length ?? 0; },
    vendor(i) {
      const list = ents.vendors?.vendors ?? [];
      if (list.length === 0) return null;
      const v = list[wrap(i, list.length)];
      if (!Number.isFinite(v?.position?.x) || !Number.isFinite(v?.position?.z)) return null;
      vendorOut.x = v.position.x;
      vendorOut.z = v.position.z;
      vendorOut.yaw = v.yaw ?? 0;
      return vendorOut;
    },
  };
}
