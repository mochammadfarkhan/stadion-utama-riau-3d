import * as THREE from 'three';

/**
 * Helper geometri elips datar (bidang XZ). Konvensi: Shape 2D (x, y) dipetakan
 * ke dunia (x, -y) setelah rotateX(-PI/2); karena elips simetris, aman.
 */
const DEFAULT_SEGMENTS = 128;

/** Shape elips penuh. */
export function ellipseShape(semiX, semiZ) {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, semiX, semiZ, 0, Math.PI * 2, false, 0);
  return shape;
}

/** Path lubang elips (untuk cincin). */
export function ellipseHole(semiX, semiZ) {
  const hole = new THREE.Path();
  hole.absellipse(0, 0, semiX, semiZ, 0, Math.PI * 2, true, 0);
  return hole;
}

/** Geometri cincin elips datar antara (innerX, innerZ) dan (outerX, outerZ). */
export function ellipseRingGeometry(outerX, outerZ, innerX, innerZ, segments = DEFAULT_SEGMENTS) {
  const shape = ellipseShape(outerX, outerZ);
  shape.holes.push(ellipseHole(innerX, innerZ));
  const geo = new THREE.ShapeGeometry(shape, segments);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Geometri cakram elips datar. */
export function ellipseDiscGeometry(semiX, semiZ, segments = DEFAULT_SEGMENTS) {
  const geo = new THREE.ShapeGeometry(ellipseShape(semiX, semiZ), segments);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Titik pada elips untuk sudut t (radian) beserta rotasi Y searah tangen. */
export function ellipsePoint(semiX, semiZ, t) {
  const x = semiX * Math.cos(t);
  const z = semiZ * Math.sin(t);
  const tx = -semiX * Math.sin(t);
  const tz = semiZ * Math.cos(t);
  // objek yang memanjang di sumbu +X lokal diputar agar searah tangen
  const rotY = Math.atan2(-tz, tx);
  return { x, z, rotY };
}

/** Apakah titik (x,z) berada di dalam elips (dikalikan skala). */
export function insideEllipse(x, z, semiX, semiZ, scale = 1) {
  const a = semiX * scale;
  const b = semiZ * scale;
  return (x * x) / (a * a) + (z * z) / (b * b) <= 1;
}

/** Sebar N titik merata sepanjang keliling elips → array {x, z, rotY, t}. */
export function distributeOnEllipse(semiX, semiZ, count, samples = 720) {
  const lens = [0];
  let total = 0;
  let prev = ellipsePoint(semiX, semiZ, 0);
  for (let i = 1; i <= samples; i += 1) {
    const cur = ellipsePoint(semiX, semiZ, (i / samples) * Math.PI * 2);
    total += Math.hypot(cur.x - prev.x, cur.z - prev.z);
    lens.push(total);
    prev = cur;
  }
  const pts = [];
  let j = 0;
  for (let k = 0; k < count; k += 1) {
    const target = (k / count) * total;
    while (j < samples && lens[j + 1] < target) j += 1;
    const t = (j / samples) * Math.PI * 2;
    pts.push({ ...ellipsePoint(semiX, semiZ, t), t });
  }
  return pts;
}
