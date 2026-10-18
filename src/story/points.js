/**
 * Titik cerita ber-region (spec UNRI §4.5), murni. Titik = { region, x, z }: x/z region-lokal
 * (region 'world' = koordinat dunia). Data lama tanpa `region` dianggap 'stadion' (kompatibel).
 * `frameOf(regionId)` → frame (geo/regionTransform createRegionFrame) atau null bila region tak dikenal.
 */
export const DEFAULT_REGION = 'stadion';
export const WORLD_REGION = 'world';

/**
 * @param {{region?: string, x: number, z: number}} p
 * @returns {{region: string, x: number, z: number}}
 */
export function normalizePoint(p) {
  if (!p || typeof p !== 'object' || !Number.isFinite(p.x) || !Number.isFinite(p.z)) {
    throw new TypeError('normalizePoint: titik {x, z} harus angka hingga');
  }
  const region = p.region ?? DEFAULT_REGION;
  if (typeof region !== 'string' || region === '') throw new TypeError('normalizePoint: region harus string tidak kosong');
  return { region, x: p.x, z: p.z };
}

/**
 * Titik ber-region → dunia.
 * @param {{region?: string, x: number, z: number}|null|undefined} p
 * @param {(regionId: string) => ({identity: boolean, toWorld(x: number, z: number): {x: number, z: number}}|null)} frameOf
 * @returns {{x: number, z: number}|null} null bila p kosong atau region tak dikenal
 */
export function resolvePoint(p, frameOf) {
  if (p == null) return null;
  const n = normalizePoint(p);
  if (n.region === WORLD_REGION) return { x: n.x, z: n.z };
  const frame = frameOf(n.region);
  if (!frame) return null;
  if (frame.identity) return { x: n.x, z: n.z };
  return frame.toWorld(n.x, n.z);
}

/**
 * Titik dunia (+yaw opsional) → titik ber-region di frame `regionId` (null/'world' = dunia).
 * @param {{x: number, z: number, yaw?: number}} p
 * @param {string|null} regionId
 * @param {(regionId: string) => object|null} frameOf
 * @returns {{region: string, x: number, z: number, yaw: number}|null} null bila titik rusak atau frame tak dikenal
 */
export function localizePoint(p, regionId, frameOf) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return null;
  const yaw = Number.isFinite(p.yaw) ? p.yaw : 0;
  if (!regionId || regionId === WORLD_REGION) return { region: WORLD_REGION, x: p.x, z: p.z, yaw };
  const frame = frameOf(regionId);
  if (!frame) return null;
  const l = frame.toLocal(p.x, p.z);
  return { region: regionId, x: l.x, z: l.z, yaw: frame.yawToLocal(yaw) };
}
