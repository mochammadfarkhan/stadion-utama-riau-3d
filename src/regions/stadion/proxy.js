/**
 * Proxy stadion untuk pratinjau kota (K): SATU mesh vertexColors (±4 rb segitiga), menggantikan cangkang tribun,
 * atap, fasad, dan ribuan instans kursi/penonton selama kamera helikopter. Dimensi dari STADIUM (region-lokal,
 * pusat lapangan di origin); placement diterapkan pemanggil (applyPlacement).
 * Isi: plaza oval, lintasan, rumput + marka FIFA (garis, lingkaran tengah, kotak penalti), fasad putih, mangkuk
 * tribun berundak dengan kursi berjuring warna-warni, atap berundak putih, rusuk busur + selembayung, empat tiang lampu sorot.
 * Warna fasad/rusuk/kursi = sumber yang sama dengan stadion mode jalan (COLORS, DEFAULT_PALETTE); plaza/lintasan/rumput/tribun [INFERENSI, tanpa foto].
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STADIUM, COLORS } from '../../config/constants.js';
import { DEFAULT_PALETTE } from '../../world/stadium/Tribune.seats.js';
import { RIB_PROFILE, SELEMBAYUNG_PROFILE } from '../../world/stadium/profiles.js';
import { frameAt, framePoint } from '../../world/stadium/ovalFrame.js';
import { ellipseShape, ellipsePath, flatShapeGeometry, ellipseRingExtrude } from '../../world/stadium/ovalMath.js';
import { boxAt, paint } from '../../world/props/unri/geom.js';

export const STADION_PROXY_NAME = 'proxy:stadion';
const COLOR = Object.freeze({
  plaza: 0xc9c4b4, lintasan: 0xb35e3d, rumput: 0x5f9a38, rumput2: 0x6aa843, fasad: COLORS.louvre, tribun: 0xb4b0a6, tribunGelap: 0x8f8c84,
  atap: 0xf7f7f4, rib: COLORS.acp, papan: COLORS.navy, garis: 0xf5f5f0, tiang: 0x6b6f76, lampu: 0xfff3c4, pendar: 0xdfffc8,
});
const SEGMENTS = 48;
const PITCH = Object.freeze({ halfW: 34, halfL: 52.5, line: 0.28, penaltyW: 20.16, penaltyD: 16.5, circle: 9.15 }); // FIFA 68 × 105 m
const MAST_HEIGHT = 58;
const SEAT_SECTORS = 10; // juring kursi berselang warna (DEFAULT_PALETTE)
const _Y = new THREE.Vector3(0, 1, 0);

/** Warnai simpul menurut juring sudut (atan2(x, −z), 0 di utara) dengan palet berselang. */
function paintBySector(geometry, palette, sectors) {
  const pos = geometry.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const a = Math.atan2(pos.getX(i), -pos.getZ(i)); // −π..π
    const sector = Math.floor(((a + Math.PI) / (2 * Math.PI)) * sectors) % sectors;
    c.set(palette[sector % palette.length]);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geometry;
}

/** Titik-titik polyline satu rusuk pada fraksi keliling u, dari profil (k, y[, s]). @returns {THREE.Vector3[]} */
export function ribPolyline(u, profile, sign = 1) {
  const f = frameAt(u);
  return profile.map((p) => {
    const v = framePoint(u, p.k, p.y);
    const s = (p.s ?? 0) * sign;
    return v.add(new THREE.Vector3(f.tx * s, 0, f.tz * s));
  });
}

/** Geometri rusuk berbiaya rendah: satu balok per ruas polyline. @returns {THREE.BufferGeometry} tak berindeks, sudah diwarnai */
export function ribGeometry(points, { thick = 1.6, width = 3.6, hex }) {
  const parts = [];
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    dir.subVectors(b, a);
    const len = dir.length();
    if (len < 1e-6) continue;
    q.setFromUnitVectors(_Y, dir.normalize());
    const box = new THREE.BoxGeometry(thick, len + thick * 0.5, width); // sedikit tumpang di sambungan
    box.applyQuaternion(q);
    box.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(box.toNonIndexed());
    box.dispose();
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return paint(merged, hex);
}

/** Rusuk busur keliling + selembayung (dua rusuk menyilang) di ujung utara (u = 0) dan selatan (u = 0,5). */
function ribs() {
  const n = STADIUM.ribCount;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const u = i / n;
    if (i === 0 || i === n / 2) {
      for (const sign of [1, -1]) out.push(ribGeometry(ribPolyline(u, SELEMBAYUNG_PROFILE, sign), { width: 3.6 * 0.85, hex: COLOR.rib }));
    } else {
      out.push(ribGeometry(ribPolyline(u, RIB_PROFILE), { hex: COLOR.rib }));
    }
  }
  return out;
}

/** Cincin elips datar (bidang XZ) dari semi-sumbu dalam (a, b) selebar w, pada ketinggian y. */
function flatRing(a, b, w, y, hex) {
  const g = flatShapeGeometry(ellipseShape(a + w, b + w), [ellipsePath(a, b)], SEGMENTS);
  return paint(g.translate(0, y, 0), hex);
}

/** Cincin lingkaran tipis (marka lingkaran tengah). */
function circleLine(r, y, hex) {
  const g = flatShapeGeometry(ellipseShape(r + PITCH.line, r + PITCH.line), [ellipsePath(r, r)], 32);
  return paint(g.translate(0, y, 0), hex);
}

/** Garis marka (balok pipih) dari (x1,z1) ke (x2,z2), sejajar sumbu. */
function markLine(x1, z1, x2, z2, y, hex) {
  const w = Math.abs(x2 - x1) + PITCH.line;
  const d = Math.abs(z2 - z1) + PITCH.line;
  return paint(boxAt(w, 0.06, d, (x1 + x2) / 2, y, (z1 + z2) / 2), hex);
}

/** Marka lapangan: garis tepi, tengah, lingkaran tengah, dua kotak penalti. Lapangan memanjang di sumbu Z. */
function pitchMarkings(y) {
  const { halfW: w, halfL: l, penaltyW: pw, penaltyD: pd } = PITCH;
  const c = COLOR.garis;
  const out = [
    markLine(-w, -l, w, -l, y, c), markLine(-w, l, w, l, y, c),
    markLine(-w, -l, -w, l, y, c), markLine(w, -l, w, l, y, c),
    markLine(-w, 0, w, 0, y, c), circleLine(PITCH.circle, y + 0.03, c),
  ];
  for (const s of [-1, 1]) { // kotak penalti di kedua ujung
    const z0 = s * l;
    const z1 = s * (l - pd);
    out.push(markLine(-pw, z1, pw, z1, y, c), markLine(-pw, z0, -pw, z1, y, c), markLine(pw, z0, pw, z1, y, c));
  }
  return out;
}

/** Tribun berundak: dua cincin bertingkat + jalur kursi berjuring warna-warni di bibir dalam. */
function bowl() {
  const { innerSemiX: ix, innerSemiZ: iz, outerSemiX: ox, outerSemiZ: oz, facadeHeight: fh } = STADIUM;
  const w = Math.min(ox - ix, oz - iz) * 0.5;
  const lower = paint(ellipseRingExtrude(ix, iz, w, fh * 0.42, 0, SEGMENTS), COLOR.tribun);
  const upper = paint(ellipseRingExtrude(ix + w, iz + w, ox - ix - w, fh * 0.78, 0, SEGMENTS), COLOR.tribunGelap);
  const seat = paintBySector(ellipseRingExtrude(ix, iz, w * 0.8, fh * 0.42 + 0.35, 0, SEGMENTS), DEFAULT_PALETTE, SEAT_SECTORS);
  const seatUp = paintBySector(ellipseRingExtrude(ix + w, iz + w, (ox - ix - w) * 0.7, fh * 0.78 + 0.35, 0, SEGMENTS), DEFAULT_PALETTE, SEAT_SECTORS);
  return [upper, lower, seatUp, seat];
}

/** Empat tiang lampu sorot di sudut elips luar: tiang (digabung ke mesh utama) dan kepala lampu (mesh terpisah, menyala malam). */
function floodlights() {
  const { outerSemiX: ox, outerSemiZ: oz } = STADIUM;
  const masts = [];
  const heads = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * ox * 0.78;
      const z = sz * oz * 0.78;
      masts.push(paint(boxAt(2.2, MAST_HEIGHT, 2.2, x, 0, z), COLOR.tiang));
      heads.push(boxAt(11, 5, 2.4, x, MAST_HEIGHT, z));
    }
  }
  return { masts, heads };
}

/**
 * @param {{terrain?: {heightAt(x:number, z:number):number}, heightAtLocal?: (lx:number, lz:number)=>number}} [ctx]
 * @returns {{group: THREE.Group, setNight(n: number): void, dispose(): void}}
 */
export function buildStadionProxy(ctx = {}) {
  const y0 = typeof ctx.heightAtLocal === 'function' ? ctx.heightAtLocal(0, 0) : 0;
  const { innerSemiX: ix, innerSemiZ: iz, outerSemiX: ox, outerSemiZ: oz, roofHeight: rh, facadeHeight: fh, roofOpeningPad: pad } = STADIUM;
  const { masts, heads } = floodlights();
  const geos = [
    paint(flatShapeGeometry(ellipseShape(ox + 40, oz + 40), [], SEGMENTS).translate(0, 0.05, 0), COLOR.plaza),
    flatRing(ix * 0.82, iz * 0.82, ix * 0.18, 0.18, COLOR.lintasan),
    paint(flatShapeGeometry(ellipseShape(ix * 0.82, iz * 0.82), [], SEGMENTS).translate(0, 0.15, 0), COLOR.rumput),
    paint(boxAt(PITCH.halfW * 2, 0.04, PITCH.halfL * 2, 0, 0.14, 0), COLOR.rumput2), // petak rumput lapangan inti
    ...pitchMarkings(0.19),
    ...bowl(),
    // fasad luar (dinding tegak) + atap putih berundak kasar mengikuti ROOF_PROFILE: cincin luar rendah, cincin punggung tinggi
    paint(ellipseRingExtrude(ox - 2, oz - 2, 2, fh, 0, SEGMENTS), COLOR.fasad),
    paint(ellipseRingExtrude(ix + pad + (ox - ix - pad) / 2, iz + pad + (ox - ix - pad) / 2, (ox - ix - pad) / 2, 1.4, rh - 4 - 1.4, SEGMENTS), COLOR.atap),
    paint(ellipseRingExtrude(ix + pad, iz + pad, (ox - ix - pad) / 2, 1.4, rh - 1.4, SEGMENTS), COLOR.atap),
    ...ribs(),
    // papan nama sisi utara (pelat navy seperti FacadeSigns; tanpa teks: tak terbaca dari udara)
    paint(boxAt(46, 5, 0.6, 0, fh * 0.55, -(oz + 1)), COLOR.papan),
    ...masts,
  ];
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g)); // Extrude = tak berindeks, Shape/Box = berindeks: samakan agar bisa digabung
  const merged = mergeGeometries(flat, false);
  geos.forEach((g) => g.dispose());
  flat.forEach((g) => g.dispose());
  if (!merged) throw new Error('Proxy stadion: penggabungan geometri gagal');
  merged.translate(0, y0, 0);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.name = 'proxyStadion';
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = STADION_PROXY_NAME;
  const group = new THREE.Group();
  group.name = STADION_PROXY_NAME;
  group.add(mesh);
  // kepala lampu sorot: tak berlampu (abu) siang, putih-hangat terang malam (setNight)
  const headGeo = mergeGeometries(heads.map((g) => g.toNonIndexed()), false);
  heads.forEach((g) => g.dispose());
  headGeo.translate(0, y0, 0);
  const headMat = new THREE.MeshBasicMaterial({ color: COLOR.tiang });
  headMat.name = 'proxyStadionLampu';
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.name = `${STADION_PROXY_NAME}:lampu`;
  group.add(headMesh);
  // pendar lapangan malam: elips datar aditif di atas rumput (opacity mengikuti malam), +1 draw call
  const glowGeo = flatShapeGeometry(ellipseShape(ix * 0.82, iz * 0.82), [], SEGMENTS).translate(0, y0 + 0.6, 0);
  const glowMat = new THREE.MeshBasicMaterial({
    color: COLOR.pendar, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  glowMat.name = 'proxyStadionPendar';
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.name = `${STADION_PROXY_NAME}:pendar`;
  glow.visible = false;
  group.add(glow);
  const off = new THREE.Color(COLOR.tiang);
  const on = new THREE.Color(0xfff0b8).multiplyScalar(1.6);
  return {
    group,
    /** n ∈ [0, 1]: kekuatan malam (nightFactor jam permainan). */
    setNight(n) {
      const k = Math.min(1, Math.max(0, n));
      headMat.color.copy(off).lerp(on, k);
      glowMat.opacity = 0.35 * k;
      glow.visible = k > 0.01; // siang: tidak digambar
    },
    dispose() { merged.dispose(); material.dispose(); headGeo.dispose(); headMat.dispose(); glowGeo.dispose(); glowMat.dispose(); },
  };
}
