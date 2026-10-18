// src/world/kit/hero/masjidArfaunnas.js
/**
 * Hero H05 Masjid Arfa'unnas UNRI (OSM way 282230716 "Masjid Ar-Faunas", levels 2, roof=concrete).
 * Rujukan [T]: foto 2023 Commons "Masjid_Arfaunnas_unri.jpg" (CC BY-SA 4.0) — dinding krem/kuning gading,
 * list oker-emas, lengkung ogee berulang di serambi atas & bawah, tangga besar keramik putih langsung ke
 * lt 2, kubah bermozaik ubin putih-ungu/biru pola wajik, mahkota bulan sabit, toa, huruf timbul
 * "MASJID ARFA' UNNAS UNIVERSITAS RIAU", motor parkir di pelataran aspal. Ruang salat 27 × 27 m, 2 lt
 * (arfaunnas.unri.ac.id) [T]; massa bawah mengikuti OSM 37,6 × 30,5 m; tonjolan utara OSM 6,6 × 9 m = tangga.
 * [INFERENSI]: tinggi lantai, jumlah bay, ukuran kubah (katalog N04 Ø10 m), posisi toa & huruf, warna huruf.
 * Hero-lokal: origin = pusat massa di tanah pad, +X ≈ timur, +Z ≈ selatan; fasad tangga = −Z (utara).
 */
import * as THREE from 'three';
import { surfaceMaps } from '../../textures/surfaces.js';
import { hasDocument } from '../../siteutil/textCanvas.js';
import { createHeroFrame, heroMaterial, heroGeometry, heroBaseY, groundGrid, local, named, PLINTH } from './heroFrame.js';
import { reliefTextParts } from './reliefText.js';
import { markPlaceholder } from './ornaments.js';

/** Pusat & arah massa dari ring OSM (rata-rata 4 sudut; yaw = rata-rata kemiringan 4 sisi, −3,47°). */
export const MASJID_SITE = Object.freeze({ id: 'w282230716', x: -1009.83, z: 1374.65, yaw: -0.0605 });

export const MASJID = Object.freeze({
  w: 37.6, d: 30.5, inti: 27, serambi: 2.4,
  plint: 0.45, lt1: 4.2, lt2: 5.4, pelat: 0.35, parapet: 1.0, tebal: 0.35,
  baysUS: 11, baysBT: 9, baysInti: 9,
  tangga: Object.freeze({ x: 0.1, w: 6.6, zUjung: -25.25, bordes: 1.0, anak: 26 }),
  kubah: Object.freeze({ drumR: 5.2, drumH: 2.6, h: 5.9, segmen: 40 }),
  pelataran: Object.freeze({ x0: -18, x1: 18, z0: -42, z1: -26.3 }),
  baris: Object.freeze([-30.5, -37.5]),
  huruf: "MASJID ARFA' UNNAS UNIVERSITAS RIAU",
  warna: Object.freeze({ krem: 0xefe3c2, oker: 0xc8962e, keramik: 0xf4f2ee, gelap: 0x1d1f24, dalam: 0x141418, marka: 0xf2f2ee, toa: 0xc9ccd0, emas: 0xd4a73a, mozaik: 0x6f6aa8 }),
});
const HW = MASJID.w / 2;       // 18,8
const HD = MASJID.d / 2;       // 15,25
const Y1 = MASJID.plint;       // 0,45 lantai bawah
const Y2 = Y1 + MASJID.lt1;    // 4,65 lantai atas
const YR = Y2 + MASJID.lt2;    // 10,05 bawah pelat atap
const YT = YR + MASJID.pelat;  // 10,4 atas pelat atap
/** Alas kubah N04 (atas drum), relatif tanah pad. */
export const DOME_BASE_Y = YT + MASJID.kubah.drumH; // 13,0
/** Profil kubah (r, y) sedikit runcing; tinggi 5,9 m. */
const DOME_PROFILE = Object.freeze([[5.0, 0], [4.95, 0.9], [4.75, 1.8], [4.35, 2.7], [3.7, 3.6], [2.85, 4.4], [1.8, 5.1], [0.8, 5.6], [0.0, 5.9]]);

/** Ornamen GLB distrik milik hero ini (dimuat src/app/heroOrnaments.js). */
export const MASJID_ORNAMENTS = Object.freeze([
  Object.freeze({ assetId: 'N04', hero: 'hero:masjid-arfaunnas', path: 'models/unri/n04-kubah-mozaik.glb', x: MASJID_SITE.x, z: MASJID_SITE.z, rotY: MASJID_SITE.yaw, yAboveGround: DOME_BASE_Y }),
]);

/** Tekstur mozaik wajik putih–ungu–biru dengan nat abu (sel 2×2, diulang 20 × 5 di kubah). Node → null. */
function mosaicTexture() {
  if (!hasDocument()) return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#f3f3f6';
  g.fillRect(0, 0, 256, 256);
  const diamond = (cx, cy, r, fill) => {
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r, cy);
    g.lineTo(cx, cy + r);
    g.lineTo(cx - r, cy);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  for (const [cx, cy] of [[0, 0], [256, 0], [0, 256], [256, 256], [128, 128]]) diamond(cx, cy, 60, '#3f62a8');
  for (const [cx, cy] of [[64, 64], [192, 192]]) diamond(cx, cy, 60, '#5a4c9c');
  g.strokeStyle = 'rgba(120,120,135,0.6)';
  g.lineWidth = 3;
  for (let i = -256; i <= 512; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 256, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(i, 256);
    g.lineTo(i + 256, 0);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(20, 5);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const W = MASJID.warna;
const M = {
  krem: () => heroMaterial('masjid:krem', () => named(new THREE.MeshLambertMaterial({ color: W.krem }), 'masjid:krem')),
  oker: () => heroMaterial('masjid:oker', () => named(new THREE.MeshStandardMaterial({ color: W.oker, roughness: 0.5, metalness: 0.25 }), 'masjid:oker')),
  keramik: () => heroMaterial('masjid:keramik', () => named(new THREE.MeshStandardMaterial({ color: W.keramik, roughness: 0.22, metalness: 0.02 }), 'masjid:keramik')),
  gelap: () => heroMaterial('masjid:gelap', () => named(new THREE.MeshLambertMaterial({ color: W.gelap }), 'masjid:gelap')),
  dalam: () => heroMaterial('masjid:dalam', () => named(new THREE.MeshLambertMaterial({ color: W.dalam, side: THREE.BackSide }), 'masjid:dalam')),
  aspal: () => heroMaterial('masjid:aspal', () => named(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, ...surfaceMaps('asphalt') }), 'masjid:aspal')),
  marka: () => heroMaterial('masjid:marka', () => named(new THREE.MeshLambertMaterial({ color: W.marka }), 'masjid:marka')),
  toa: () => heroMaterial('masjid:toa', () => named(new THREE.MeshLambertMaterial({ color: W.toa, side: THREE.DoubleSide }), 'masjid:toa')),
  kubah: () => markPlaceholder('N04', heroMaterial('masjid:kubah-mozaik', () => {
    const map = mosaicTexture();
    return named(new THREE.MeshStandardMaterial({ color: map ? 0xffffff : W.mozaik, map, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide }), 'masjid:kubah-mozaik');
  })),
  mahkota: () => markPlaceholder('N04', heroMaterial('masjid:mahkota', () => named(new THREE.MeshStandardMaterial({ color: W.emas, roughness: 0.3, metalness: 0.8 }), 'masjid:mahkota'))),
};

const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
};

/** Setengah kanan lengkung ogee (runcing berbentuk S): pangkal (w/2, hs) → puncak (0, ha). */
export function ogeeHalf(w, hs, ha, n = 10) {
  const r = ha - hs;
  const p0 = [w / 2, hs];
  const p1 = [w / 2, hs + 0.62 * r];
  const p2 = [w * 0.04, ha - 0.42 * r];
  const p3 = [0, ha];
  return Array.from({ length: n + 1 }, (_, i) => bez(p0, p1, p2, p3, i / n));
}

/** Kontur bukaan ogee: kiri-pangkal → puncak → kanan-pangkal. */
function ogeeArc(w, hs, ha) {
  const right = ogeeHalf(w, hs, ha);
  return [...right.map(([x, y]) => [-x, y]), ...right.slice(0, -1).reverse()];
}

/** Panel pier serambi (lebar bay bw, tinggi h) dengan bukaan ogee terbuka ke lantai; ekstrusi +Z sedalam `tebal`. */
function arcadeGeometry(bw, h, w, hs, ha) {
  return heroGeometry(`masjid:arkade:${bw.toFixed(3)}:${h}:${w.toFixed(3)}:${hs}:${ha}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-bw / 2, 0);
    s.lineTo(-w / 2, 0);
    for (const [x, y] of ogeeArc(w, hs, ha)) s.lineTo(x, y);
    s.lineTo(w / 2, 0);
    s.lineTo(bw / 2, 0);
    s.lineTo(bw / 2, h);
    s.lineTo(-bw / 2, h);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: MASJID.tebal, bevelEnabled: false, curveSegments: 1 });
  });
}

/** Panel dinding inti dengan jendela ogee (lubang) dari ambang `sill`. */
function windowPanelGeometry(bw, h, w, sill, hs, ha) {
  return heroGeometry(`masjid:jendela:${bw.toFixed(3)}:${h}:${w}:${sill}:${hs}:${ha}`, () => {
    const s = new THREE.Shape([new THREE.Vector2(-bw / 2, 0), new THREE.Vector2(bw / 2, 0), new THREE.Vector2(bw / 2, h), new THREE.Vector2(-bw / 2, h)]);
    const hole = new THREE.Path();
    hole.moveTo(-w / 2, sill);
    hole.lineTo(w / 2, sill);
    for (const [x, y] of [...ogeeArc(w, hs, ha)].reverse()) hole.lineTo(x, y);
    hole.closePath();
    s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth: MASJID.tebal, bevelEnabled: false, curveSegments: 1 });
  });
}

/** Empat sisi persegi (setengah lebar hw × setengah dalam hd): rotasi panel, rentang, titik muka luar, arah ke dalam. */
function sides(hw, hd) {
  return [
    { ry: 0, span: 2 * hw, at: (s) => [s, -hd], inward: [0, 1] },             // utara
    { ry: Math.PI, span: 2 * hw, at: (s) => [-s, hd], inward: [0, -1] },      // selatan
    { ry: -Math.PI / 2, span: 2 * hd, at: (s) => [hw, s], inward: [-1, 0] },  // timur
    { ry: Math.PI / 2, span: 2 * hd, at: (s) => [-hw, -s], inward: [1, 0] },  // barat
  ];
}

/** Pasang panel berulang di keempat sisi; geometri per sisi dari geoFor(lebarBay). */
function ring4(f, mat, { hw, hd, y, nUS, nBT, geoFor }) {
  sides(hw, hd).forEach((side, i) => {
    const n = i < 2 ? nUS : nBT;
    const bw = side.span / n;
    const geo = geoFor(bw);
    for (let k = 0; k < n; k += 1) {
      const [x, z] = side.at(-side.span / 2 + bw * (k + 0.5));
      f.add(geo, mat, local(x, y, z, { ry: side.ry }));
    }
  });
}

/** Kepala pier oker di ketinggian pangkal lengkung. */
function pierCaps(f, y) {
  sides(HW, HD).forEach((side, i) => {
    const n = i < 2 ? MASJID.baysUS : MASJID.baysBT;
    const bw = side.span / n;
    for (let k = 0; k <= n; k += 1) {
      const [x, z] = side.at(-side.span / 2 + bw * k);
      const cx = x + side.inward[0] * (MASJID.tebal / 2);
      const cz = z + side.inward[1] * (MASJID.tebal / 2);
      f.box(M.oker(), [cx - 0.42, cx + 0.42], [y - 0.16, y], [cz - 0.26, cz + 0.26], { ry: side.ry, castShadow: false });
    }
  });
}

/** List oker keliling setebal 0,14 m, menonjol `out` m dari muka massa. */
function band(f, y0, y1, out) {
  const ow = HW + out;
  const od = HD + out;
  const t = 0.14;
  f.box(M.oker(), [-ow, ow], [y0, y1], [-od, -od + t], { castShadow: false });
  f.box(M.oker(), [-ow, ow], [y0, y1], [od - t, od], { castShadow: false });
  f.box(M.oker(), [-ow, -ow + t], [y0, y1], [-od, od], { castShadow: false });
  f.box(M.oker(), [ow - t, ow], [y0, y1], [-od, od], { castShadow: false });
}

/** Plint & teras keramik, pelat lt 2 keramik, pelat atap, parapet krem bertutup oker, list oker. */
function slabs(f) {
  f.box(M.krem(), [-HW - 0.3, HW + 0.3], [0, Y1 - 0.02], [-HD - 0.3, HD + 0.3]);
  f.box(M.keramik(), [-HW - 0.3, HW + 0.3], [Y1 - 0.02, Y1], [-HD - 0.3, HD + 0.3], { castShadow: false });
  f.box(M.keramik(), [-HW, HW], [Y2 - MASJID.pelat, Y2], [-HD, HD]);
  band(f, Y2 - MASJID.pelat, Y2, 0.12);
  f.box(M.krem(), [-HW - 0.2, HW + 0.2], [YR, YT], [-HD - 0.2, HD + 0.2]);
  band(f, YR, YT, 0.32);
  const ow = HW + 0.2;
  const od = HD + 0.2;
  const t = 0.25;
  const p = [YT, YT + MASJID.parapet];
  f.box(M.krem(), [-ow, ow], p, [-od, -od + t]);
  f.box(M.krem(), [-ow, ow], p, [od - t, od]);
  f.box(M.krem(), [-ow, -ow + t], p, [-od, od]);
  f.box(M.krem(), [ow - t, ow], p, [-od, od]);
  const c = [YT + MASJID.parapet, YT + MASJID.parapet + 0.12];
  f.box(M.oker(), [-ow - 0.05, ow + 0.05], c, [-od - 0.05, -od + t + 0.05], { castShadow: false });
  f.box(M.oker(), [-ow - 0.05, ow + 0.05], c, [od - t - 0.05, od + 0.05], { castShadow: false });
  f.box(M.oker(), [-ow - 0.05, -ow + t + 0.05], c, [-od, od], { castShadow: false });
  f.box(M.oker(), [ow - t - 0.05, ow + 0.05], c, [-od, od], { castShadow: false });
}

/** Serambi bawah & atas: arkade ogee berulang di keempat sisi + kepala pier oker. */
function arcades(f) {
  const hLow = Y2 - MASJID.pelat - Y1; // 3,85
  ring4(f, M.krem(), { hw: HW, hd: HD, y: Y1, nUS: MASJID.baysUS, nBT: MASJID.baysBT, geoFor: (bw) => arcadeGeometry(bw, hLow, bw - 0.7, 2.3, 3.25) });
  ring4(f, M.krem(), { hw: HW, hd: HD, y: Y2, nUS: MASJID.baysUS, nBT: MASJID.baysBT, geoFor: (bw) => arcadeGeometry(bw, MASJID.lt2, bw - 0.7, 3.3, 4.6) });
  pierCaps(f, Y1 + 2.3);
  pierCaps(f, Y2 + 3.3);
}

/** Dinding dalam lt 1 (kantor/aula) di balik serambi + pintu & jendela gelap. */
function lowerCore(f) {
  const hw = HW - MASJID.serambi;
  const hd = HD - MASJID.serambi;
  const y = [Y1, Y2 - MASJID.pelat];
  const t = 0.3;
  f.box(M.krem(), [-hw, hw], y, [-hd, -hd + t]);
  f.box(M.krem(), [-hw, hw], y, [hd - t, hd]);
  f.box(M.krem(), [-hw, -hw + t], y, [-hd, hd]);
  f.box(M.krem(), [hw - t, hw], y, [-hd, hd]);
  const flat = { castShadow: false };
  for (const x of [-11, -5.5, 5.5, 11]) f.box(M.gelap(), [x - 1.1, x + 1.1], [Y1, Y1 + 2.8], [-hd - 0.02, -hd], flat);
  for (const x of [-11, -5.5, 0, 5.5, 11]) f.box(M.gelap(), [x - 0.9, x + 0.9], [Y1 + 1.0, Y1 + 2.6], [hd, hd + 0.02], flat);
  for (const z of [-8, 0, 8]) {
    f.box(M.gelap(), [hw, hw + 0.02], [Y1 + 1.0, Y1 + 2.6], [z - 0.9, z + 0.9], flat);
    f.box(M.gelap(), [-hw - 0.02, -hw], [Y1 + 1.0, Y1 + 2.6], [z - 0.9, z + 0.9], flat);
  }
}

/** Ruang salat 27 × 27 m lt 2: dinding ber-jendela ogee + ruang dalam gelap (terlihat lewat jendela). */
function upperCore(f) {
  const h = MASJID.inti / 2;
  ring4(f, M.krem(), { hw: h, hd: h, y: Y2, nUS: MASJID.baysInti, nBT: MASJID.baysInti, geoFor: (bw) => windowPanelGeometry(bw, MASJID.lt2, 1.3, 1.0, 3.0, 4.2) });
  const inner = heroGeometry('masjid:ruangDalam', () => new THREE.BoxGeometry(MASJID.inti - 0.6, MASJID.lt2 - 0.1, MASJID.inti - 0.6).translate(0, (MASJID.lt2 - 0.1) / 2, 0));
  f.add(inner, M.dalam(), local(0, Y2, 0), { castShadow: false });
}

/** Pipi tangga: bentuk di bidang (u = −z, y), diekstrusi `depth` ke +X lalu diputar ke sumbu tangga. */
function stairSideGeometry(key, pts, depth) {
  return heroGeometry(`masjid:${key}`, () => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([u, y]) => new THREE.Vector2(u, y))), { depth, bevelEnabled: false, curveSegments: 1 }).rotateY(Math.PI / 2));
}

/** Tangga besar keramik putih langsung ke serambi lt 2 (tonjolan utara OSM 6,6 × 9 m + bordes 1 m). */
function tangga(f) {
  const t = MASJID.tangga;
  const x0 = t.x - t.w / 2;
  const x1 = t.x + t.w / 2;
  const zTop = -HD - t.bordes;
  const run = (-t.zUjung + zTop) / t.anak; // (25,25 − 16,25) / 26 = 0,346 m
  const rise = Y2 / t.anak;                // 0,179 m
  f.box(M.keramik(), [x0, x1], [0, Y2], [zTop, -HD]);
  for (let i = 0; i < t.anak - 1; i += 1) {
    const zb = zTop - i * run;
    f.box(M.keramik(), [x0, x1], [0, Y2 - (i + 1) * rise], [zb - run, zb]);
  }
  const u0 = HD;
  const u1 = HD + t.bordes;
  const u2 = -t.zUjung;
  const cheek = stairSideGeometry('pipiTangga', [[u0, 0], [u2, 0], [u2, 0.95], [u1, Y2 + 0.95], [u0, Y2 + 0.95]], 0.25);
  const rail = stairSideGeometry('railTangga', [[u0, Y2 + 0.95], [u1, Y2 + 0.95], [u2, 0.95], [u2, 1.07], [u1, Y2 + 1.07], [u0, Y2 + 1.07]], 0.35);
  for (const sx of [x0 - 0.25, x1]) {
    f.add(cheek, M.krem(), local(sx, 0, 0));
    f.add(rail, M.oker(), local(sx - 0.05, 0, 0), { castShadow: false });
  }
}

/** Mahkota: leher, dua bola, bulan sabit (torus parsial 1,45π, celah menghadap atas). */
function mahkota(f, y) {
  const mat = M.mahkota();
  f.add(heroGeometry('masjid:leher', () => new THREE.CylinderGeometry(0.16, 0.22, 0.9, 10).translate(0, 0.45, 0)), mat, local(0, y - 0.05, 0));
  f.add(heroGeometry('masjid:bola1', () => new THREE.SphereGeometry(0.32, 12, 10)), mat, local(0, y + 1.1, 0));
  f.add(heroGeometry('masjid:bola2', () => new THREE.SphereGeometry(0.24, 12, 10)), mat, local(0, y + 1.55, 0));
  f.add(heroGeometry('masjid:sabit', () => new THREE.TorusGeometry(0.55, 0.08, 8, 28, Math.PI * 1.45).rotateZ(-1.225 * Math.PI)), mat, local(0, y + 2.3, 0));
}

/** Drum + jendela, cincin oker, kubah mozaik (placeholder N04), mahkota bulan sabit. */
function kubah(f) {
  const k = MASJID.kubah;
  f.add(heroGeometry('masjid:drum', () => new THREE.CylinderGeometry(k.drumR, k.drumR, k.drumH, k.segmen).translate(0, k.drumH / 2, 0)), M.krem(), local(0, YT, 0));
  f.add(heroGeometry('masjid:cincinDrum', () => new THREE.CylinderGeometry(k.drumR + 0.12, k.drumR + 0.12, 0.25, k.segmen)), M.oker(), local(0, DOME_BASE_Y - 0.125, 0), { castShadow: false });
  const win = heroGeometry('masjid:jendelaDrum', () => new THREE.PlaneGeometry(0.8, 1.3));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    f.add(win, M.gelap(), local(Math.sin(a) * (k.drumR + 0.01), YT + 1.3, Math.cos(a) * (k.drumR + 0.01), { ry: a }), { castShadow: false });
  }
  const profile = DOME_PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
  f.add(heroGeometry('masjid:kubah', () => new THREE.LatheGeometry(profile, k.segmen)), M.kubah(), local(0, DOME_BASE_Y, 0));
  mahkota(f, DOME_BASE_Y + k.h);
}

/** Toa: tiang pipa di sudut timur laut atap + 4 corong ke empat arah. */
function toa(f) {
  const x = 12.5;
  const z = -11.5;
  f.cylinder(M.toa(), { x, z, y0: YT, h: 4.0, r: 0.06, seg: 8 });
  const horn = heroGeometry('masjid:corong', () => new THREE.CylinderGeometry(0.3, 0.07, 0.6, 12, 1, true).rotateZ(-Math.PI / 2).translate(0.35, 0, 0));
  for (let i = 0; i < 4; i += 1) f.add(horn, M.toa(), local(x, YT + 3.75, z, { ry: (i * Math.PI) / 2 }), { castShadow: false });
}

/** Huruf timbul oker di parapet utara (muka tangga). */
function huruf(f) {
  const parts = reliefTextParts({ key: 'masjid:huruf', text: MASJID.huruf, width: 26, height: 0.72, color: '#c8962e', shade: '#6a4e16' });
  const z = -(HD + 0.2) - 0.07;
  for (const p of parts) f.add(p.geometry, p.material, local(0, YT + MASJID.parapet / 2, z).multiply(p.matrix), { castShadow: false });
}

/** Pelataran aspal di depan tangga + marka bay parkir motor (2 baris × 35 bay; motor diisi M7). */
function pelataran(f, groundY) {
  f.add(groundGrid('masjid:pelataran', f, { ...MASJID.pelataran, step: 2, lift: 0.05, groundY }), M.aspal(), null, { castShadow: false, name: 'aspal' });
  const line = heroGeometry('masjid:garisMarka', () => new THREE.BoxGeometry(0.08, 0.02, 1.9));
  for (const zc of MASJID.baris) {
    for (let k = 0; k <= 35; k += 1) {
      const x = -16 + 0.9 * k;
      const w = f.toWorld(x, zc);
      const y = (groundY ? groundY(w.x, w.z) - f.y : 0) + 0.07;
      f.add(line, M.marka(), local(x, y, zc), { castShadow: false });
    }
  }
}

/** Pusat bay motor di pelataran (DUNIA) + yaw motor (menghadap masjid) — untuk motorParking M7. */
export function masjidMotorBays() {
  const c = Math.cos(MASJID_SITE.yaw);
  const s = Math.sin(MASJID_SITE.yaw);
  const out = [];
  for (const zc of MASJID.baris) {
    for (let k = 0; k < 35; k += 1) {
      const x = -15.55 + 0.9 * k;
      out.push(Object.freeze({ x: MASJID_SITE.x + c * x + s * zc, z: MASJID_SITE.z - s * x + c * zc, yaw: MASJID_SITE.yaw }));
    }
  }
  return Object.freeze(out);
}

/** HERO_BUILDERS['hero:masjid-arfaunnas'] — PartList dunia (spec §4.6). */
export function buildMasjidArfaunnas(plan, _mats, ctx = {}) {
  const groundY = typeof ctx?.groundY === 'function' ? ctx.groundY : null;
  const f = createHeroFrame({ ...MASJID_SITE, y: heroBaseY(plan, ctx, MASJID_SITE) - PLINTH, origin: ctx?.origin ?? null });
  slabs(f);
  arcades(f);
  lowerCore(f);
  upperCore(f);
  tangga(f);
  kubah(f);
  toa(f);
  huruf(f);
  pelataran(f, groundY);
  return f.parts;
}
