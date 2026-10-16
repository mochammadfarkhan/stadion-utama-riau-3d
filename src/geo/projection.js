/**
 * Proyeksi geodetik WGS84 ↔ frame dunia ENU lokal (East-North-Up) pada bidang singgung di origin.
 * Konvensi dunia: +X = timur, −Z = utara, Y atas, satuan meter. Tanah datar: komponen "up" diabaikan,
 * sehingga toLatLon(x, z) mengembalikan titik di permukaan ellipsoid (h = 0) yang proyeksinya (x, z).
 * Murni (tanpa three/DOM).
 */

const A = 6378137; // sumbu semi-mayor WGS84 (m)
const F = 1 / 298.257223563; // pepatan WGS84
const E2 = F * (2 - F); // eksentrisitas kuadrat
const DEG = Math.PI / 180;
const INVERSE_ITERATIONS = 6;

/** Jari-jari kelengkungan vertikal utama N(φ). */
const primeVertical = (sinLat) => A / Math.sqrt(1 - E2 * sinLat * sinLat);

/** Jari-jari kelengkungan meridian M(φ). */
const meridian = (sinLat) => (A * (1 - E2)) / Math.pow(1 - E2 * sinLat * sinLat, 1.5);

/** Geodetik (derajat, h = 0) → ECEF (m). */
function toEcef(latDeg, lonDeg) {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const n = primeVertical(sinLat);
  return { X: n * cosLat * Math.cos(lon), Y: n * cosLat * Math.sin(lon), Z: n * (1 - E2) * sinLat };
}

/**
 * @param {{lat0: number, lon0: number}} origin derajat desimal
 * @returns {{ origin: {lat0: number, lon0: number},
 *   toWorld: (lat: number, lon: number) => {x: number, z: number},
 *   toLatLon: (x: number, z: number) => {lat: number, lon: number} }}
 */
export function createProjection({ lat0, lon0 }) {
  if (!Number.isFinite(lat0) || !Number.isFinite(lon0) || Math.abs(lat0) > 89) {
    throw new RangeError(`origin proyeksi tidak valid: lat0=${lat0}, lon0=${lon0}`);
  }
  const o = toEcef(lat0, lon0);
  const sLat = Math.sin(lat0 * DEG);
  const cLat = Math.cos(lat0 * DEG);
  const sLon = Math.sin(lon0 * DEG);
  const cLon = Math.cos(lon0 * DEG);

  /** Komponen east/north (m) dari titik geodetik. */
  function eastNorth(lat, lon) {
    const p = toEcef(lat, lon);
    const dx = p.X - o.X;
    const dy = p.Y - o.Y;
    const dz = p.Z - o.Z;
    return { e: -sLon * dx + cLon * dy, n: -sLat * cLon * dx - sLat * sLon * dy + cLat * dz };
  }

  function toWorld(lat, lon) {
    const { e, n } = eastNorth(lat, lon);
    return { x: e, z: -n };
  }

  /** Invers iteratif (Newton dengan Jacobian diagonal M, N·cosφ); konvergen < 1 mm dalam 6 langkah. */
  function toLatLon(x, z) {
    const e = x;
    const n = -z;
    let lat = lat0 + n / meridian(sLat) / DEG;
    let lon = lon0 + e / (primeVertical(sLat) * cLat) / DEG;
    for (let i = 0; i < INVERSE_ITERATIONS; i += 1) {
      const cur = eastNorth(lat, lon);
      const s = Math.sin(lat * DEG);
      lat += (n - cur.n) / meridian(s) / DEG;
      lon += (e - cur.e) / (primeVertical(s) * Math.cos(lat * DEG)) / DEG;
    }
    return { lat, lon };
  }

  return Object.freeze({ origin: Object.freeze({ lat0, lon0 }), toWorld, toLatLon });
}
