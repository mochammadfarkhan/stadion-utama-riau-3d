import * as THREE from 'three';

/**
 * Tekstur prosedural berbasis DataTexture (aman di Node, tanpa canvas).
 */
export const TEX_SIZE = 128;

function makeDataTexture(size, fill) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const [r, g, b] = fill(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Hash 2D deterministik (0..1) untuk noise sederhana. */
export function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Value noise 2D bilinear (0..1). */
export function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Tekstur rumput bernoise (variasi hijau). */
export function grassTexture(baseHex, repeat = 60) {
  const base = new THREE.Color(baseHex);
  const tex = makeDataTexture(TEX_SIZE, (x, y) => {
    const n = valueNoise(x / 9, y / 9) * 0.6 + valueNoise(x / 3, y / 3) * 0.4;
    const k = 0.75 + n * 0.5;
    return [base.r * 255 * k, base.g * 255 * k, base.b * 255 * k * 0.9];
  });
  tex.repeat.set(repeat, repeat);
  return tex;
}

/** Tekstur paving grid beton dengan beberapa patch gelap/hilang. */
export function pavingTexture(baseHex, repeat = 40) {
  const base = new THREE.Color(baseHex);
  const cell = 16;
  const tex = makeDataTexture(TEX_SIZE, (x, y) => {
    const grout = x % cell === 0 || y % cell === 0;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    if (hash2(cx * 7, cy * 13) > 0.93) return [70, 58, 44]; // paving hilang → tanah
    const tone = grout ? 0.72 : 0.9 + hash2(cx, cy) * 0.15;
    return [base.r * 255 * tone, base.g * 255 * tone, base.b * 255 * tone];
  });
  tex.repeat.set(repeat, repeat);
  return tex;
}

/** Tekstur aspal bernoise halus. */
export function asphaltTexture(baseHex, repeat = 30) {
  const base = new THREE.Color(baseHex);
  const tex = makeDataTexture(TEX_SIZE, (x, y) => {
    const k = 0.85 + valueNoise(x / 2.5, y / 2.5) * 0.3;
    return [base.r * 255 * k, base.g * 255 * k, base.b * 255 * k];
  });
  tex.repeat.set(repeat, repeat);
  return tex;
}

/** Tekstur riak air (noise lembut) untuk animasi offset. */
export function rippleTexture(repeat = 6) {
  const tex = makeDataTexture(TEX_SIZE, (x, y) => {
    const v = 200 + valueNoise(x / 12, y / 12) * 55;
    return [v * 0.85, v * 0.95, v];
  });
  tex.repeat.set(repeat, repeat);
  return tex;
}
