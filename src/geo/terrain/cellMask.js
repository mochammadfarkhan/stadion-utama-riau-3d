/**
 * Raster sel grid dari ring poligon (scanline genap-ganjil pada pusat sel; sama dengan pointInPolygon).
 * Dipakai mesh terrain (sel mana yang digambar) dan lubang tanah dasar kota (sel yang sama persis),
 * sehingga tepi terrain dan tepi lubang selalu berimpit. Murni.
 */

/**
 * @param {Array<[number, number]>} ring ring dunia terbuka
 * @param {{minX:number, minZ:number, cell:number, cols:number, rows:number}} grid sel (r, c) berpusat di
 *   (minX + (c + 0,5)·cell, minZ + (r + 0,5)·cell)
 * @returns {Uint8Array} rows × cols, 1 = pusat sel di dalam ring
 */
export function rasterizeRing(ring, { minX, minZ, cell, cols, rows }) {
  if (!(cell > 0) || !Number.isInteger(cols) || !Number.isInteger(rows) || cols < 0 || rows < 0) {
    throw new RangeError('rasterizeRing: grid tidak valid');
  }
  const out = new Uint8Array(cols * rows);
  const n = ring.length;
  if (n < 3) return out;
  const xs = [];
  for (let r = 0; r < rows; r += 1) {
    const zc = minZ + (r + 0.5) * cell;
    xs.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if ((zi > zc) !== (zj > zc)) xs.push(((xj - xi) * (zc - zi)) / (zj - zi) + xi);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      // pusat sel xc masuk bila xs[k] <= xc < xs[k+1] (sama persis dengan aturan pointInPolygon: x < potongan)
      const c0 = Math.max(0, Math.ceil((xs[k] - minX) / cell - 0.5));
      const c1 = Math.min(cols - 1, Math.ceil((xs[k + 1] - minX) / cell - 0.5) - 1);
      if (c1 >= c0) out.fill(1, r * cols + c0, r * cols + c1 + 1);
    }
  }
  return out;
}
