// src/world/kit/hero/ggm.js
/**
 * Hero H07 Gedung Auditorium Grand Gasing Millenium (GGM) UNRI (OSM way 314450943, tapak lingkaran
 * Ø ±81,7 m, levels 4-7, roof=tin). Fakta [T]: bentuk terinspirasi gasing; dibangun 2008; 2013 atap sudah
 * terpasang, sisanya tiang & pondasi, tempat duduk undakan semen kasar, ilalang, coretan, jalan masuk batu
 * & tanah merah; julukan "gedung mangkrak". Kondisi 2026 [TIDAK DIKETAHUI] → ditampilkan sesuai 2013/2015.
 * [INFERENSI]: profil atap gasing, jumlah/posisi kolom, jumlah undakan & celah panggung (selatan), warna
 * seng, isi coretan (goresan abstrak + kata netral), sisa kolom bertulangan.
 */
import * as THREE from 'three';
import { hasDocument } from '../../siteutil/textCanvas.js';
import { createRng } from '../../util/random.js';
import { surfaceMaps } from '../../textures/surfaces.js';
import { createHeroFrame, heroMaterial, heroGeometry, heroBaseY, groundDisc, groundGrid, groundStamp, local, named, PLINTH } from './heroFrame.js';

export const GGM_SITE = Object.freeze({ id: 'w314450943', x: 133.13, z: 407.41, yaw: 0 });

export const GGM = Object.freeze({
  atap: Object.freeze({
    eave: 16.6,
    profil: Object.freeze([[41.6, 16.6], [41.6, 17.1], [37.5, 18.7], [31.0, 20.6], [23.5, 22.3], [16.0, 23.6], [9.0, 24.5], [3.2, 25.0], [1.4, 25.2]]),
  }),
  kolomLuar: Object.freeze({ n: 24, r: 39.6, rad: 0.5 }),
  kolomDalam: Object.freeze({ n: 16, r: 34.6, rad: 0.4 }),
  tribun: Object.freeze({ rIn: 14, step: 1.6, rise: 0.45, undak: 12, celah: Math.PI / 3 }),
  tanah: 47,
  jalan: Object.freeze({ x0: -3, x1: 3, z0: 40, z1: 60 }),
  ilalang: 420,
  puing: Object.freeze([0.3, 1.1, 2.0, 3.6, 4.4, 5.3]),
  warna: Object.freeze({ semen: 0xa8a49b, seng: 0x8b9298, tanah: 0x9c4f2e, kerikil: 0x8d8577, karat: 0x7a4a2e }),
});
const WR = GGM.warna;

/** Coretan: goresan bezier acak + beberapa kata netral, latar transparan. Node → null (tanpa coretan). */
function grafitiTexture(seed) {
  if (!hasDocument()) return null;
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) return null;
  const rnd = createRng(seed);
  const warna = ['#d6336c', '#1c7ed6', '#f08c00', '#2b8a3e', '#212529', '#e03131', '#7048e8'];
  g.lineCap = 'round';
  for (let i = 0; i < 46; i += 1) {
    g.strokeStyle = warna[Math.floor(rnd() * warna.length)];
    g.lineWidth = 5 + rnd() * 14;
    const x = rnd() * 2048;
    const y = 40 + rnd() * 170;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + 40 + rnd() * 80, y - 60 + rnd() * 120, x + 80 + rnd() * 90, y - 60 + rnd() * 120, x + 120 + rnd() * 120, y - 30 + rnd() * 60);
    g.stroke();
  }
  g.font = 'bold 96px sans-serif';
  g.textBaseline = 'middle';
  ['UNRI', 'GGM', '62', 'ANGKATAN'].forEach((teks, i) => {
    g.save();
    g.fillStyle = warna[(i * 3) % warna.length];
    g.translate(150 + i * 480 + rnd() * 120, 128);
    g.rotate(-0.12 + rnd() * 0.24);
    g.fillText(teks, 0, 0);
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Tekstur seng gelombang berkarat: pita vertikal terang-gelap (gelombang radial di lathe), noda karat & jejak air
 * hujan cokelat, sambungan lembar tiap 1/4 tinggi. Dipetakan u = keliling (diulang 96×), v = profil. Node → null.
 */
function sengTexture(seed) {
  if (!hasDocument()) return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) return null;
  const rnd = createRng(seed);
  for (let x = 0; x < 256; x += 1) {
    const wave = 0.5 + 0.5 * Math.sin((x / 256) * Math.PI * 8);
    const v = Math.round(118 + wave * 52);
    g.fillStyle = `rgb(${v},${v + 5},${v + 9})`;
    g.fillRect(x, 0, 1, 256);
  }
  for (let i = 0; i < 70; i += 1) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const len = 20 + rnd() * 120;
    const grad = g.createLinearGradient(x, y, x, y + len);
    const a = 0.12 + rnd() * 0.25;
    grad.addColorStop(0, `rgba(122,72,38,${a})`);
    grad.addColorStop(1, 'rgba(122,72,38,0)');
    g.fillStyle = grad;
    g.fillRect(x, y, 3 + rnd() * 14, len);
  }
  g.strokeStyle = 'rgba(40,44,48,0.5)';
  g.lineWidth = 2;
  for (const y of [0, 64, 128, 192]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const M = {
  semen: () => heroMaterial('ggm:semen', () => named(new THREE.MeshStandardMaterial({ color: WR.semen, roughness: 0.97, side: THREE.DoubleSide, ...surfaceMaps('concrete', 3) }), 'ggm:semen-kasar')),
  seng: () => heroMaterial('ggm:seng', () => {
    const map = sengTexture(314450943);
    return named(new THREE.MeshStandardMaterial({ color: map ? 0xffffff : WR.seng, map, roughness: 0.62, metalness: 0.4, side: THREE.DoubleSide }), 'ggm:seng');
  }),
  tanah: () => heroMaterial('ggm:tanah', () => named(new THREE.MeshStandardMaterial({ color: WR.tanah, roughness: 0.97, ...surfaceMaps('concrete', 5) }), 'ggm:tanah-merah')),
  kerikil: () => heroMaterial('ggm:kerikil', () => named(new THREE.MeshStandardMaterial({ color: 0xb09c78, roughness: 0.98, ...surfaceMaps('concrete', 1.4) }), 'ggm:jalan-batu')),
  karat: () => heroMaterial('ggm:karat', () => named(new THREE.MeshLambertMaterial({ color: WR.karat }), 'ggm:besi-karat')),
  ilalang: () => heroMaterial('ggm:ilalang', () => named(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 'ggm:ilalang')),
  grafiti: () => heroMaterial('ggm:grafiti', () => {
    const map = grafitiTexture(314450943);
    return named(new THREE.MeshLambertMaterial({ color: 0xffffff, map, alphaTest: map ? 0.5 : 0, side: THREE.DoubleSide }), 'ggm:grafiti');
  }),
};

/** Profil undakan (r, y): dari tepi panggung naik 12 anak ke dinding belakang lalu turun ke tanah. */
function tribunProfile() {
  const { rIn, step, rise, undak } = GGM.tribun;
  const pts = [[rIn, 0]];
  for (let k = 0; k < undak; k += 1) pts.push([rIn + step * k, rise * (k + 1)], [rIn + step * (k + 1), rise * (k + 1)]);
  pts.push([rIn + step * undak, 0]);
  return pts;
}

/** Atap gasing seng (lathe), plafon bawah, pasak puncak, balok cincin. */
function atap(f) {
  const prof = GGM.atap.profil.map(([r, y]) => new THREE.Vector2(r, y));
  f.add(heroGeometry('ggm:atap', () => new THREE.LatheGeometry(prof, 64)), M.seng());
  f.add(heroGeometry('ggm:plafon', () => new THREE.CircleGeometry(41.6, 64).rotateX(Math.PI / 2)), M.seng(), local(0, GGM.atap.eave - 0.01, 0), { castShadow: false });
  f.add(heroGeometry('ggm:pasak', () => new THREE.CylinderGeometry(0.25, 1.4, 2.4, 16).translate(0, 1.2, 0)), M.seng(), local(0, 25.2, 0));
  f.add(heroGeometry('ggm:balokCincin', () => new THREE.CylinderGeometry(41.0, 41.0, 0.7, 64, 1, true)), M.semen(), local(0, GGM.atap.eave - 0.35, 0));
}

/** Dua cincin kolom semen kasar. */
function kolom(f) {
  for (const [def, top] of [[GGM.kolomLuar, GGM.atap.eave - 0.7], [GGM.kolomDalam, GGM.atap.eave]]) {
    const geo = heroGeometry(`ggm:kolom:${def.rad}:${top}`, () => new THREE.CylinderGeometry(def.rad, def.rad, top, 12).translate(0, top / 2, 0));
    for (let i = 0; i < def.n; i += 1) {
      const a = ((i + 0.5) / def.n) * Math.PI * 2;
      f.add(geo, M.semen(), local(Math.sin(a) * def.r, 0, Math.cos(a) * def.r));
    }
  }
}

/** Tribun undakan 300° (celah 60° ke selatan untuk panggung/akses), tutup ujung, panggung, coretan. */
function tribun(f, detail = true) {
  const { celah, rIn } = GGM.tribun;
  const prof = tribunProfile().map(([r, y]) => new THREE.Vector2(r, y));
  f.add(heroGeometry('ggm:tribun', () => new THREE.LatheGeometry(prof, 50, celah / 2, Math.PI * 2 - celah)), M.semen());
  const cap = heroGeometry('ggm:tutupTribun', () => new THREE.ShapeGeometry(new THREE.Shape(prof)));
  for (const phi of [celah / 2, Math.PI * 2 - celah / 2]) f.add(cap, M.semen(), local(0, 0, 0, { ry: phi - Math.PI / 2 }));
  f.add(heroGeometry('ggm:panggung', () => new THREE.CylinderGeometry(rIn, rIn, 0.3, 48).translate(0, 0.15, 0)), M.semen());
  const graf = detail ? M.grafiti() : null;
  if (graf?.map) {
    const strip = heroGeometry('ggm:grafitiPita', () => new THREE.CylinderGeometry(33.3, 33.3, 2.3, 50, 1, true, celah / 2, Math.PI * 2 - celah).translate(0, 1.45, 0));
    f.add(strip, graf, null, { castShadow: false });
  }
}

/** Sisa kolom tanpa finishing dengan besi tulangan berkarat di luar atap. */
function puing(f) {
  const rnd = createRng(2008);
  const rebar = heroGeometry('ggm:besi', () => new THREE.CylinderGeometry(0.016, 0.016, 1.2, 5).translate(0, 0.6, 0));
  for (const a of GGM.puing) {
    const x = Math.sin(a) * 45;
    const z = Math.cos(a) * 45;
    const h = 1.2 + rnd() * 1.6;
    f.box(M.semen(), [x - 0.3, x + 0.3], [0, h], [z - 0.3, z + 0.3], { ry: a });
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
      f.add(rebar, M.karat(), local(x + dx, h, z + dz, { rx: (rnd() - 0.5) * 0.5, rz: (rnd() - 0.5) * 0.5 }), { castShadow: false });
    }
  }
}

/** Rumpun ilalang (5 bilah segitiga per rumpun, warna kuning-hijau acak). */
function ilalangGeometry(rnd, points) {
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  for (const [x, y, z] of points) {
    for (let b = 0; b < 5; b += 1) {
      const a = rnd() * Math.PI * 2;
      const h = 0.5 + rnd() * 0.6;
      const lean = 0.15 + rnd() * 0.35;
      const w = 0.05;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      pos.push(x - dz * w, y, z + dx * w, x + dz * w, y, z - dx * w, x + dx * lean, y + h, z + dz * lean);
      c.setHSL(0.16 + rnd() * 0.08, 0.35 + rnd() * 0.2, 0.32 + rnd() * 0.18);
      for (let k = 0; k < 3; k += 1) col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Titik rumpun: 55% di luar atap (r 41,8–48), 30% di antara tribun & kolom, 15% di panggung. */
function ilalangPoints(rnd, n) {
  const pts = [];
  for (const [r0, r1, share] of [[41.8, 48, 0.55], [33.6, 39.0, 0.3], [2, 13, 0.15]]) {
    const count = Math.round(n * share);
    for (let i = 0; i < count; i += 1) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0));
      pts.push([Math.sin(a) * r, Math.cos(a) * r]);
    }
  }
  return pts;
}

function ilalang(f, groundY) {
  const geo = heroGeometry(`ggm:ilalang:${groundStamp(f, groundY)}`, () => {
    const rnd = createRng(314450943);
    const pts = ilalangPoints(rnd, GGM.ilalang).map(([x, z]) => {
      if (Math.hypot(x, z) < GGM.tribun.rIn) return [x, 0.3, z];
      const w = f.toWorld(x, z);
      return [x, groundY ? groundY(w.x, w.z) - f.y : 0, z];
    });
    return ilalangGeometry(rnd, pts);
  });
  f.add(geo, M.ilalang(), null, { castShadow: false, name: 'ilalang' });
}

/** Tanah merah (cakram r 47) + jalan masuk batu ke selatan. */
function tanah(f, groundY) {
  f.add(groundDisc('ggm:tanahMerah', f, { r: GGM.tanah, seg: 48, rings: 8, lift: 0.04, groundY }), M.tanah(), null, { castShadow: false, name: 'tanahMerah' });
  f.add(groundGrid('ggm:jalanBatu', f, { ...GGM.jalan, step: 2, lift: 0.07, groundY }), M.kerikil(), null, { castShadow: false, name: 'jalanBatu' });
}

/**
 * HERO_BUILDERS['hero:ggm'] — PartList dunia (spec §4.6). LOD 1 (250–900 m, tanpa bayangan): hanya siluet —
 * atap seng, kolom & undakan semen (2 material) agar draw call klaster jauh tetap kecil.
 */
export function buildGgm(plan, _mats, ctx = {}) {
  const groundY = typeof ctx?.groundY === 'function' ? ctx.groundY : null;
  const f = createHeroFrame({ ...GGM_SITE, y: heroBaseY(plan, ctx, GGM_SITE) - PLINTH, origin: ctx?.origin ?? null });
  const far = ctx?.lod === 1;
  if (!far) tanah(f, groundY);
  tribun(f, !far);
  kolom(f);
  atap(f);
  if (!far) {
    puing(f);
    ilalang(f, groundY);
  }
  return f.parts;
}
