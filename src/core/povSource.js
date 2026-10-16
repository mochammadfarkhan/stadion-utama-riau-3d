import { pointOnLane } from '../sim/trackPath.js';
import { IDENTITY_FRAME } from '../geo/regionTransform.js';

/**
 * Adapter entitas → sumber posisi untuk POV (lihat cameraPresets.povPose).
 * Entitas region (bola, pelari, pedagang) hidup di koordinat region-lokal; adapter mengubahnya ke
 * frame dunia lewat `frame` (createRegionFrame). Sepeda sudah di koordinat dunia.
 * Mengembalikan objek yang dipakai ulang (tanpa alokasi per panggilan selain hasil sim).
 * @param {{bike:{state:object}, match?:{ball?:{pos:{x:number,z:number}}},
 *   runners?:{runners:object[]}, vendors?:{vendors:object[]}}} ents
 * @param {{identity:boolean, toWorld(x:number,z:number):{x:number,z:number}, yawToWorld(y:number):number}} [frame]
 */
export function createPovSource(ents, frame = IDENTITY_FRAME) {
  const ballOut = { x: 0, z: 0 };
  const runnerOut = { x: 0, z: 0, yaw: 0 };
  const vendorOut = { x: 0, z: 0, yaw: 0 };
  const wrap = (i, n) => ((i % n) + n) % n;
  const place = (out, x, z, yaw) => {
    if (frame.identity) {
      out.x = x;
      out.z = z;
      if (yaw !== undefined) out.yaw = yaw;
      return out;
    }
    const w = frame.toWorld(x, z);
    out.x = w.x;
    out.z = w.z;
    if (yaw !== undefined) out.yaw = frame.yawToWorld(yaw);
    return out;
  };

  return {
    frame,
    get bike() { return ents.bike.state; },

    ball() {
      const pos = ents.match?.ball?.pos;
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return null;
      return place(ballOut, pos.x, pos.z);
    },

    runnerCount() { return ents.runners?.runners.length ?? 0; },
    runner(i) {
      const list = ents.runners?.runners ?? [];
      if (list.length === 0) return null;
      const r = list[wrap(i, list.length)];
      const p = pointOnLane(r.lane, r.dist);
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.z)) return null;
      return place(runnerOut, p.x, p.z, p.yaw ?? 0);
    },

    vendorCount() { return ents.vendors?.vendors.length ?? 0; },
    vendor(i) {
      const list = ents.vendors?.vendors ?? [];
      if (list.length === 0) return null;
      const v = list[wrap(i, list.length)];
      if (!Number.isFinite(v?.position?.x) || !Number.isFinite(v?.position?.z)) return null;
      return place(vendorOut, v.position.x, v.position.z, v.yaw ?? 0);
    },
  };
}
