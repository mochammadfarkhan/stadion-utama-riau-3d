/**
 * Helper matematika oval/elips lokal untuk modul interior stadion.
 * Tidak bergantung pada src/sim/* agar modul interior mandiri.
 * Konvensi: titik elips (x = a·cosθ, z = b·sinθ); shape 2D (x, y) → dunia (x, 0, −y)
 * setelah geometry.rotateX(−π/2).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ARC_SAMPLES = 720;
const TWO_PI = Math.PI * 2;

/** Tabel panjang busur elips untuk penempatan merata sepanjang keliling. */
export function createEllipseArcTable(a, b, samples = ARC_SAMPLES) {
  const lengths = new Float64Array(samples + 1);
  let prevX = a;
  let prevZ = 0;
  let total = 0;
  for (let i = 1; i <= samples; i++) {
    const th = (i / samples) * TWO_PI;
    const x = a * Math.cos(th);
    const z = b * Math.sin(th);
    total += Math.hypot(x - prevX, z - prevZ);
    lengths[i] = total;
    prevX = x;
    prevZ = z;
  }
  return Object.freeze({ a, b, samples, lengths, total });
}

/** Sudut parametrik θ pada jarak busur s (dibungkus ke 0..total). */
export function ellipseAngleAtArc(table, s) {
  const { lengths, samples, total } = table;
  const sw = ((s % total) + total) % total;
  let lo = 0;
  let hi = samples;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] <= sw) lo = mid;
    else hi = mid;
  }
  const seg = lengths[hi] - lengths[lo] || 1;
  return ((lo + (sw - lengths[lo]) / seg) / samples) * TWO_PI;
}

/** Jarak busur dari θ=0 ke θ (interpolasi linear tabel). */
export function ellipseArcAtAngle(table, theta) {
  const { lengths, samples } = table;
  const t = (((theta % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI * samples;
  const i = Math.min(Math.floor(t), samples - 1);
  return lengths[i] + (lengths[i + 1] - lengths[i]) * (t - i);
}

export function ellipsePoint(a, b, theta) {
  return { x: a * Math.cos(theta), z: b * Math.sin(theta) };
}

/** Shape "stadium": dua garis lurus (sejajar y) + dua setengah lingkaran. */
export function stadiumShape(halfStraight, r) {
  return traceStadium(new THREE.Shape(), halfStraight, r);
}

export function stadiumPath(halfStraight, r) {
  return traceStadium(new THREE.Path(), halfStraight, r);
}

function traceStadium(path, h, r) {
  path.moveTo(r, -h);
  path.lineTo(r, h);
  path.absarc(0, h, r, 0, Math.PI, false);
  path.lineTo(-r, -h);
  path.absarc(0, -h, r, Math.PI, TWO_PI, false);
  return path;
}

export function ellipseShape(a, b) {
  const s = new THREE.Shape();
  s.absellipse(0, 0, a, b, 0, TWO_PI, false, 0);
  return s;
}

export function ellipsePath(a, b) {
  const p = new THREE.Path();
  p.absellipse(0, 0, a, b, 0, TWO_PI, false, 0);
  return p;
}

/** ShapeGeometry datar di bidang XZ (y = 0) dengan lubang opsional. */
export function flatShapeGeometry(shape, holes = [], segments = 64) {
  const s = shape.clone();
  s.holes = [...holes];
  const g = new THREE.ShapeGeometry(s, segments);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Cincin elips (a,b)→(a+w,b+w) diekstrusi setinggi h, dasar di y0. */
export function ellipseRingExtrude(a, b, w, h, y0, segments = 96) {
  const s = ellipseShape(a + w, b + w);
  s.holes = [ellipsePath(a, b)];
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h, bevelEnabled: false, curveSegments: segments, steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

/** Satu potongan cincin (busur luar from→to ccw, busur dalam kembali) sebagai Shape. */
function ringArcShape(a, b, w, from, to) {
  const s = new THREE.Shape();
  s.absellipse(0, 0, a + w, b + w, from, to, false, 0);
  s.absellipse(0, 0, a, b, to, from, true, 0);
  s.closePath();
  return s;
}

/**
 * Cincin elips seperti ellipseRingExtrude tetapi dengan celah sudut.
 * `gaps` = [{thetaStart, thetaEnd}] dalam θ ruang dunia (x = a·cosθ, z = b·sinθ);
 * dikonversi ke ruang shape (y_shape = −z ⇒ θ_shape = −θ_dunia).
 */
export function ellipseRingExtrudeGapped(a, b, w, h, y0, gaps, segments = 96) {
  if (!gaps || gaps.length === 0) return ellipseRingExtrude(a, b, w, h, y0, segments);
  const shapeGaps = gaps.map((g) => {
    const start = ((-g.thetaEnd % TWO_PI) + TWO_PI) % TWO_PI;
    return { start, end: start + (g.thetaEnd - g.thetaStart) };
  }).sort((p, q) => p.start - q.start);
  const shapes = shapeGaps.map((g, i) => {
    const last = i === shapeGaps.length - 1;
    const next = shapeGaps[last ? 0 : i + 1];
    return ringArcShape(a, b, w, g.end, last ? next.start + TWO_PI : next.start);
  });
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth: h, bevelEnabled: false, curveSegments: segments, steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

/** Gabungkan geometri (dipaksa non-indexed agar kompatibel) menjadi satu. */
export function mergeFlat(geoms) {
  const list = geoms.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
  if (list.length === 0) return new THREE.BufferGeometry();
  const merged = mergeGeometries(list, false);
  if (!merged) throw new Error('mergeFlat: atribut geometri tidak kompatibel');
  return merged;
}

/** PRNG deterministik (mulberry32) agar hasil bisa diulang. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** CanvasTexture dengan guard: null bila `document` tidak ada (Node/SSR). */
export function createCanvasTexture(width, height, draw) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    draw(ctx, width, height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  } catch {
    return null; // fallback diam: pemanggil memakai material polos
  }
}

/** Tekstur strip/garis sederhana dari DataTexture (aman di Node). */
export function createDataTexture(width, height, pixelFn) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, width, height);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
