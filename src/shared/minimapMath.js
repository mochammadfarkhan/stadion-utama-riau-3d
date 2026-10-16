/**
 * Matematika minimap 2D (murni). Peta dasar = tampak atas seluruh area (utara = atas):
 * +x ke kanan, +z ke bawah, piksel (0,0) di sudut barat-laut.
 */
const fin = (v) => (Number.isFinite(v) ? v : 0);

/** Persegi sumber (piksel peta dasar) untuk jendela ±halfExtent meter di sekitar fokus. */
export function sourceRect(focus, halfExtent, worldHalf, basePx) {
  const k = basePx / (2 * worldHalf);
  return {
    sx: (fin(focus?.x) + worldHalf - halfExtent) * k,
    sy: (fin(focus?.z) + worldHalf - halfExtent) * k,
    sw: 2 * halfExtent * k,
    sh: 2 * halfExtent * k,
  };
}

/** Titik dunia → koordinat tampilan (piksel, 0..viewSize) dengan fokus di tengah. */
export function projectToView(point, focus, halfExtent, viewSize) {
  const k = viewSize / (2 * halfExtent);
  const x = viewSize / 2 + (fin(point?.x) - fin(focus?.x)) * k;
  const y = viewSize / 2 + (fin(point?.z) - fin(focus?.z)) * k;
  return { x, y, inside: x >= 0 && x <= viewSize && y >= 0 && y <= viewSize };
}

/** Jepit titik ke dalam tampilan (margin dari tepi) sepanjang arah dari pusat; `angle` = arah dari pusat. */
export function clampToEdge(x, y, viewSize, margin) {
  const c = viewSize / 2;
  const dx = x - c;
  const dy = y - c;
  const angle = Math.atan2(dy, dx);
  const lo = margin;
  const hi = viewSize - margin;
  if (x >= lo && x <= hi && y >= lo && y <= hi) return { x, y, angle };
  const half = c - margin;
  const s = half / Math.max(Math.abs(dx), Math.abs(dy), 1e-9);
  return { x: c + dx * s, y: c + dy * s, angle };
}

/** Balik urutan baris piksel RGBA (readRenderTargetPixels mulai dari kiri-bawah). */
export function flipRowsInPlace(pixels, width, height) {
  const stride = width * 4;
  const tmp = new Uint8ClampedArray(stride);
  for (let y = 0; y < Math.floor(height / 2); y += 1) {
    const a = y * stride;
    const b = (height - 1 - y) * stride;
    tmp.set(pixels.subarray(a, a + stride));
    pixels.copyWithin(a, b, b + stride);
    pixels.set(tmp, b);
  }
}
