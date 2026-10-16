/**
 * Transform region handmade: koordinat region-lokal ↔ frame dunia (ENU, +X timur, −Z utara).
 * placement {x, z, yaw}: yaw = rotasi pada sumbu +Y (sama dengan Object3D.rotation.y).
 */
function assertPlacement(p) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(p.yaw)) {
    throw new TypeError('placement {x, z, yaw} harus angka hingga');
  }
}

/** Lokal → dunia. */
export function toWorld(p, lx, lz) {
  assertPlacement(p);
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  return { x: p.x + c * lx + s * lz, z: p.z - s * lx + c * lz };
}

/** Dunia → lokal (kebalikan toWorld). */
export function toLocal(p, x, z) {
  assertPlacement(p);
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  const dx = x - p.x;
  const dz = z - p.z;
  return { x: c * dx - s * dz, z: s * dx + c * dz };
}

/**
 * Frame region: placement beku + konversi titik & yaw. yaw entitas memakai konvensi maju = (sin, cos)
 * sehingga yaw dunia = yaw lokal + placement.yaw. `identity` = placement {0, 0, 0} (jalur cepat).
 * @param {{x:number, z:number, yaw:number}} placement
 */
export function createRegionFrame(placement) {
  assertPlacement(placement);
  const p = Object.freeze({ x: placement.x, z: placement.z, yaw: placement.yaw });
  return Object.freeze({
    placement: p,
    identity: p.x === 0 && p.z === 0 && p.yaw === 0,
    toWorld: (x, z) => toWorld(p, x, z),
    toLocal: (x, z) => toLocal(p, x, z),
    yawToWorld: (yaw) => yaw + p.yaw,
    yawToLocal: (yaw) => yaw - p.yaw,
  });
}

export const IDENTITY_FRAME = createRegionFrame({ x: 0, z: 0, yaw: 0 });
