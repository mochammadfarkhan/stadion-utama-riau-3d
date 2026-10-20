/**
 * Collider ruang interior 2D (murni): dinding persegi panjang berpusat di origin, perabot = persegi panjang
 * sejajar sumbu (diperluas radius pemain), NPC = lingkaran dinamis. Kamera: dinding dengan margin kecil +
 * perabot tinggi saja (meja/karpet tidak menghalangi kamera).
 */
const inRect = (x, z, r, pad) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

/**
 * @param {{halfW:number, halfD:number, radius?:number, cameraMargin?:number,
 *   solids?:Array<{x0:number,x1:number,z0:number,z1:number}>, tallSolids?:Array<{x0:number,x1:number,z0:number,z1:number}>,
 *   blockers?:() => Array<{x:number,z:number,r:number}>, zones?:Array<{x0:number,x1:number,z0:number,z1:number}>}} opts
 * @returns {{isWalkable(x:number,z:number):boolean, isCameraClear(x:number,z:number):boolean}}
 */
export function createRoomCollider({
  halfW, halfD, radius = 0.25, cameraMargin = 0.08, solids = [], tallSolids = [], blockers = () => [], zones = null,
}) {
  // zones (opsional): gabungan persegi panjang jalan kaki (ruang bersambung lewat celah pintu); tanpa zones = satu ruang halfW × halfD.
  const area = zones ?? [{ x0: -halfW, x1: halfW, z0: -halfD, z1: halfD }];
  const inArea = (x, z, pad) => area.some((a) => x >= a.x0 + pad && x <= a.x1 - pad && z >= a.z0 + pad && z <= a.z1 - pad);
  const isWalkable = (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (!inArea(x, z, radius)) return false;
    if (solids.some((s) => inRect(x, z, s, radius))) return false;
    return !(blockers() ?? []).some((b) => Math.hypot(x - b.x, z - b.z) < b.r + radius);
  };
  const isCameraClear = (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (!inArea(x, z, cameraMargin)) return false;
    return !tallSolids.some((s) => inRect(x, z, s, 0));
  };
  return { isWalkable, isCameraClear };
}
