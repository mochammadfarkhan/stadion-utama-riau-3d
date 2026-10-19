/**
 * Geometri jalan/parit/tiang sekitar sekre UKM (three): pita jalan ter-drape dengan UV (melintang 0–1, memanjang = jarak
 * / panjang pelat), parit beton U terbuka (profil diekstrusi sepanjang polyline) dengan tutup pelat, tiang listrik beton,
 * dan kabel menjuntai antartiang. Semua murni fungsi parameter → BufferGeometry baru (tanpa mutasi masukan).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { polylineOffset } from './generators.js';

/** Titik sepanjang polyline tiap ≤ `step` m termasuk semua simpul asal (kumulatif s ikut). */
export function resample(pts, step) {
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  const marks = new Set(cum);
  for (let s = step; s < total; s += step) marks.add(Math.round(s * 1e6) / 1e6);
  const at = (s) => {
    let i = 0;
    while (i < cum.length - 2 && cum[i + 1] < s) i += 1;
    const t = (s - cum[i]) / ((cum[i + 1] - cum[i]) || 1);
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
  };
  return [...marks].sort((a, b) => a - b).map((s) => ({ s, p: at(s) }));
}

/**
 * Pita ter-drape `cols` kolom melintang. UV: u = 0..1 melintang (kiri→kanan menurut polylineOffset), v = vStart + s·vScale.
 * Segitiga dipaksa menghadap +Y.
 * @param {Array<[number, number]>} pts polyline region-lokal
 */
export function ribbonGeometry(pts, { width, heightAt, lift = 0.05, step = 2, cols = 2, vScale = 1 / 5, vStart = 0 }) {
  const samples = resample(pts, step);
  const line = samples.map((s) => s.p);
  const lanes = Array.from({ length: cols + 1 }, (_, c) => polylineOffset(line, -width / 2 + (width * c) / cols));
  const pos = [];
  const uv = [];
  samples.forEach((smp, i) => {
    for (let c = 0; c <= cols; c += 1) {
      const [x, z] = lanes[c][i];
      pos.push(x, heightAt(x, z) + lift, z);
      uv.push(c / cols, vStart + smp.s * vScale);
    }
  });
  const idx = [];
  const row = cols + 1;
  for (let i = 0; i < samples.length - 1; i += 1) {
    for (let c = 0; c < cols; c += 1) {
      const a = i * row + c;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (g.getAttribute('normal').getY(0) < 0) { // winding terbalik → balik semua segitiga
    const flipped = idx.slice();
    for (let k = 0; k < flipped.length; k += 3) [flipped[k + 1], flipped[k + 2]] = [flipped[k + 2], flipped[k + 1]];
    g.setIndex(flipped);
    g.computeVertexNormals();
  }
  g.computeBoundingSphere();
  return g;
}

/** Profil parit U (lateral, naik) dari spesifikasi {width, depth, wall}; dasar parit di bawah tanah `buried`. */
export function ditchProfile({ width, depth, wall }, buried = 0.06) {
  const hw = width / 2;
  const top = depth - buried;
  const floor = wall - buried + 0.02;
  return [[-hw, -buried], [-hw, top], [-hw + wall, top], [-hw + wall, floor], [hw - wall, floor], [hw - wall, top], [hw, top], [hw, -buried]];
}

/**
 * Parit beton U terbuka: profil diekstrusi sepanjang `line` (region-lokal), per bagian normal mendatar (flat shading),
 * tinggi dasar = tanah di sumbu. `caps` = stasiun tutup pelat {x, z, tx, tz}. UV = meter (tekstur beton 2 m).
 */
export function ditchGeometry(line, spec, heightAt, caps = [], step = 1.5) {
  const samples = resample(line, step);
  const centers = samples.map((s) => s.p);
  const prof = ditchProfile(spec);
  const lanes = prof.map(([lat]) => polylineOffset(centers, lat));
  const pos = [];
  const uv = [];
  const quad = (i, k) => {
    const j = (k + 1) % prof.length;
    const pts = [[i, k], [i + 1, k], [i + 1, j], [i, j]].map(([ii, kk]) => {
      const [x, z] = lanes[kk][ii];
      return [x, heightAt(centers[ii][0], centers[ii][1]) + prof[kk][1], z];
    });
    const s0 = samples[i].s;
    const s1 = samples[i + 1].s;
    const arc = (kk) => prof.slice(0, kk + 1).reduce((acc, p, n, arr) => (n ? acc + Math.hypot(p[0] - arr[n - 1][0], p[1] - arr[n - 1][1]) : 0), 0);
    const uvs = [[s0, arc(k)], [s1, arc(k)], [s1, arc(j)], [s0, arc(j)]];
    for (const t of [0, 1, 2, 0, 2, 3]) {
      pos.push(...pts[t]);
      uv.push(uvs[t][0] / 2, uvs[t][1] / 2);
    }
  };
  for (let i = 0; i < samples.length - 1; i += 1) for (let k = 0; k < prof.length - 1; k += 1) quad(i, k);
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  body.computeVertexNormals();
  const top = spec.depth - 0.06;
  const slabs = caps.map((c) => {
    const g = new THREE.BoxGeometry(spec.width + 0.14, 0.07, spec.capLength ?? 1);
    g.rotateY(Math.atan2(c.tx, c.tz));
    g.translate(c.x, heightAt(c.x, c.z) + top + 0.035, c.z);
    return g;
  });
  const parts = [body, ...slabs.map((g) => g.toNonIndexed())].map((g) => {
    const out = g.clone();
    if (!out.getAttribute('uv')) out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(out.getAttribute('position').count * 2), 2));
    return out;
  });
  const merged = mergeGeometries(parts, false);
  merged.computeBoundingSphere();
  return merged;
}

/** Tiang listrik beton ramping (origin = dasar): batang meruncing, palang silang (sumbu X lokal), 3 isolator. */
export function utilityPoleGeometry({ height }) {
  const pole = new THREE.CylinderGeometry(0.09, 0.16, height, 8).translate(0, height / 2, 0);
  const arm = new THREE.BoxGeometry(1.5, 0.09, 0.09).translate(0, height - 0.45, 0);
  const brace = new THREE.BoxGeometry(0.9, 0.07, 0.07).translate(0, height - 1.3, 0);
  const ins = [-0.6, 0, 0.6].map((x) => new THREE.CylinderGeometry(0.035, 0.05, 0.16, 6).translate(x, height - 0.32, 0));
  return mergeGeometries([pole, arm, brace, ...ins].map((g) => g.toNonIndexed().deleteAttribute('uv')), false);
}

/** Kabel menjuntai antartiang (LineSegments): 3 penghantar, juntai `sag` m di tengah. */
export function wireGeometry(poles, height, heightAt, { sag = 0.55, segments = 8, lateral = [-0.6, 0, 0.6] } = {}) {
  const pos = [];
  for (let i = 0; i < poles.length - 1; i += 1) {
    const a = poles[i];
    const b = poles[i + 1];
    const ax = [Math.cos(a.rotY), -Math.sin(a.rotY)];
    const bx = [Math.cos(b.rotY), -Math.sin(b.rotY)];
    for (const lat of lateral) {
      const p = (t) => {
        const x = a.x + ax[0] * lat + (b.x + bx[0] * lat - a.x - ax[0] * lat) * t;
        const z = a.z + ax[1] * lat + (b.z + bx[1] * lat - a.z - ax[1] * lat) * t;
        const y = (heightAt(a.x, a.z) + height - 0.28) * (1 - t) + (heightAt(b.x, b.z) + height - 0.28) * t - sag * 4 * t * (1 - t);
        return [x, y, z];
      };
      for (let k = 0; k < segments; k += 1) pos.push(...p(k / segments), ...p((k + 1) / segments));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeBoundingSphere();
  return g;
}
