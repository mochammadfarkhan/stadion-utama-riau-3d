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
