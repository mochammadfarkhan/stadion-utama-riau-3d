/**
 * Matematika minimap 2D (murni). Peta dasar = tampak atas seluruh area (utara = atas):
 * +x ke kanan, +z ke bawah, piksel (0,0) di sudut barat-laut.
 */
const fin = (v) => (Number.isFinite(v) ? v : 0);

/**
 * Persegi sumber (piksel peta dasar) untuk jendela ±halfExtent meter di sekitar fokus.
 * `center` = pusat dunia peta dasar (posisi kamera bake; default origin).
 */
export function sourceRect(focus, halfExtent, worldHalf, basePx, center = null) {
  const k = basePx / (2 * worldHalf);
  return {
    sx: (fin(focus?.x) - fin(center?.x) + worldHalf - halfExtent) * k,
    sy: (fin(focus?.z) - fin(center?.z) + worldHalf - halfExtent) * k,
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

/** Persegi dunia {minX, minZ, maxX, maxZ} → persegi tampilan (piksel) dengan fokus di tengah. */
export function worldRectToView(b, focus, halfExtent, viewSize) {
  const k = viewSize / (2 * halfExtent);
  return {
    x: viewSize / 2 + (b.minX - fin(focus?.x)) * k,
    y: viewSize / 2 + (b.minZ - fin(focus?.z)) * k,
    w: (b.maxX - b.minX) * k,
    h: (b.maxZ - b.minZ) * k,
  };
}

/**
 * Bulatkan persegi tampilan ke piksel utuh per TEPI (bukan per lebar) agar tile yang bersebelahan berbagi
 * tepi yang sama persis: tidak ada celah/garis tipis di sambungan saat drawImage.
 * @param {{x:number, y:number, w:number, h:number}} r
 */
export function snapRect(r) {
  const x = Math.round(r.x);
  const y = Math.round(r.y);
  return { x, y, w: Math.round(r.x + r.w) - x, h: Math.round(r.y + r.h) - y };
}

/**
 * Base layer region beririsan dengan jendela ±halfExtent di sekitar fokus? Layer berpusat `center`
 * (dunia) bersisi 2×half; layer diputar (yaw ≠ 0) memakai jangkauan diagonal (konservatif).
 * @param {{center:{x:number,z:number}, half:number, yaw:number}} layer
 */
export function layerInView(layer, focus, halfExtent) {
  const reach = (layer.yaw ? layer.half * Math.SQRT2 : layer.half) + halfExtent;
  return Math.abs(fin(focus?.x) - layer.center.x) < reach && Math.abs(fin(focus?.z) - layer.center.z) < reach;
}

/**
 * Matriks kanvas [a, b, c, d, e, f] (CanvasRenderingContext2D.setTransform) yang memetakan koordinat
 * lokal layer (lx, lz) — kanvas layer digambar di (−half, −half, 2·half, 2·half) — ke piksel tampilan
 * dengan fokus di tengah. Rotasi mengikuti regionTransform.toWorld (yaw sumbu +Y, utara = −z di atas).
 * @param {{center:{x:number,z:number}, half:number, yaw:number}} layer
 * @returns {[number, number, number, number, number, number]}
 */
export function layerTransform(layer, focus, halfExtent, viewPx) {
  const k = viewPx / (2 * halfExtent);
  const c = Math.cos(layer.yaw);
  const s = Math.sin(layer.yaw);
  return [
    k * c, -k * s, k * s, k * c,
    viewPx / 2 + (layer.center.x - fin(focus?.x)) * k,
    viewPx / 2 + (layer.center.z - fin(focus?.z)) * k,
  ];
}
