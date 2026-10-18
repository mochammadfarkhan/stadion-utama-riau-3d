/**
 * Collider ruang interior 2D (murni): dinding persegi panjang berpusat di origin, perabot = persegi panjang
 * sejajar sumbu (diperluas radius pemain), NPC = lingkaran dinamis. Kamera: dinding dengan margin kecil +
 * perabot tinggi saja (meja/karpet tidak menghalangi kamera).
 */
const inRect = (x, z, r, pad) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

/**
 * @param {{halfW:number, halfD:number, radius?:number, cameraMargin?:number,
 *   solids?:Array<{x0:number,x1:number,z0:number,z1:number}>, tallSolids?:Array<{x0:number,x1:number,z0:number,z1:number}>,
 *   blockers?:() => Array<{x:number,z:number,r:number}>}} opts
 * @returns {{isWalkable(x:number,z:number):boolean, isCameraClear(x:number,z:number):boolean}}
 */
export function createRoomCollider({
  halfW, halfD, radius = 0.25, cameraMargin = 0.08, solids = [], tallSolids = [], blockers = () => [],
}) {
  const isWalkable = (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (Math.abs(x) > halfW - radius || Math.abs(z) > halfD - radius) return false;
    if (solids.some((s) => inRect(x, z, s, radius))) return false;
    return !(blockers() ?? []).some((b) => Math.hypot(x - b.x, z - b.z) < b.r + radius);
  };
  const isCameraClear = (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (Math.abs(x) > halfW - cameraMargin || Math.abs(z) > halfD - cameraMargin) return false;
    return !tallSolids.some((s) => inRect(x, z, s, 0));
  };
  return { isWalkable, isCameraClear };
}
