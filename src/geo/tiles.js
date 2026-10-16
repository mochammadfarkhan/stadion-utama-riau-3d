/**
 * Grid tile kota di frame dunia ENU. Tile (ix, iz) menutup x ∈ [ix·S, (ix+1)·S), z ∈ [iz·S, (iz+1)·S),
 * S = TILE_SIZE. Kunci tile "ix_iz" (mis. "-1_-3") juga dipakai sebagai nama file. Murni.
 */

export const TILE_SIZE = 500;

/** Kunci tile, mis. tileKey(-1, 2) → "-1_2". */
export const tileKey = (ix, iz) => `${ix}_${iz}`;

/** Kebalikan tileKey; null bila format salah. */
export function parseTileKey(key) {
  const m = String(key).match(/^(-?\d+)_(-?\d+)$/);
  return m ? { ix: Number(m[1]), iz: Number(m[2]) } : null;
}

/** Indeks tile yang memuat titik dunia (x, z). */
export function tileOf(x, z, size = TILE_SIZE) {
  return { ix: Math.floor(x / size), iz: Math.floor(z / size) };
}

/** Pusat tile di frame dunia; asal koordinat tile-lokal. */
export function tileCenter(ix, iz, size = TILE_SIZE) {
  return { x: (ix + 0.5) * size, z: (iz + 0.5) * size };
}

/** Batas tile di frame dunia. */
export function tileBounds(ix, iz, size = TILE_SIZE) {
  return { minX: ix * size, minZ: iz * size, maxX: (ix + 1) * size, maxZ: (iz + 1) * size };
}

/**
 * Tile yang beririsan dengan persegi [minX, maxX) × [minZ, maxZ) (maks eksklusif: persegi yang
 * tepat berhenti di garis grid tidak menyeret tile tetangga). Urut iz lalu ix.
 * @returns {Array<{ix: number, iz: number, key: string}>}
 */
export function tilesInRect({ minX, minZ, maxX, maxZ }, size = TILE_SIZE) {
  const ix0 = Math.floor(minX / size);
  const iz0 = Math.floor(minZ / size);
  const ix1 = Math.ceil(maxX / size) - 1;
  const iz1 = Math.ceil(maxZ / size) - 1;
  const out = [];
  for (let iz = iz0; iz <= iz1; iz += 1) {
    for (let ix = ix0; ix <= ix1; ix += 1) out.push({ ix, iz, key: tileKey(ix, iz) });
  }
  return out;
}

/**
 * Tile yang persegi-nya beririsan dengan lingkaran (x, z, r), diurutkan menurut jarak titik ke pusat
 * tile (naik), seri dipecah dengan kunci agar deterministik.
 * @returns {Array<{ix: number, iz: number, key: string, dist: number}>}
 */
export function tilesInRadius(x, z, r, size = TILE_SIZE) {
  const out = [];
  for (const t of tilesInRect({ minX: x - r, minZ: z - r, maxX: x + r, maxZ: z + r }, size)) {
    const b = tileBounds(t.ix, t.iz, size);
    const nx = Math.min(Math.max(x, b.minX), b.maxX);
    const nz = Math.min(Math.max(z, b.minZ), b.maxZ);
    if (Math.hypot(nx - x, nz - z) > r) continue;
    const c = tileCenter(t.ix, t.iz, size);
    out.push({ ...t, dist: Math.hypot(c.x - x, c.z - z) });
  }
  return out.sort((a, b) => a.dist - b.dist || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
