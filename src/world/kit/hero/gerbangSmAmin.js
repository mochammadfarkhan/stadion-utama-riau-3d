// src/world/kit/hero/gerbangSmAmin.js
/**
 * Hero H06 Gerbang SM Amin ("gerbang utama", timur) di Jl. Muchtar Lutfi. Fakta [T]: nama & status gerbang
 * utama, jam operasional s.d. 20.00 (Bahana Mahasiswa; cakaplah 2022), spanduk kuning pemberitahuan di
 * gerbang, satpam berjaga di pos. Posisi: cache OSM tanpa node gate → fallback batas poligon kampus
 * way 938374562 × Jl. Muchtar Lutfi (jalur ganda z 691,33 & 700,79), 6 m ke dalam kampus, tegak lurus jalan
 * (plan M6 Task 17; diganti bila Overpass menemukan node). Desain gapura [INFERENSI]: tanpa foto → dua
 * pilar + balok papan nama polos (TANPA ornamen Melayu karena tidak terkonfirmasi), daun pagar besi terbuka,
 * pos satpam, spanduk kuning N08. Lokal: +X sepanjang garis gerbang (≈ selatan), −Z = muka luar (timur).
 */
import * as THREE from 'three';
import { hasDocument } from '../../siteutil/textCanvas.js';
import { createHeroFrame, heroMaterial, heroGeometry, heroBaseY, local, named, PLINTH } from './heroFrame.js';
import { reliefTextParts } from './reliefText.js';

export const GERBANG_SITE = Object.freeze({ id: 's-gerbang-sm-amin', x: 385.27, z: 695.39, yaw: -1.5581 });

export const GERBANG = Object.freeze({
  pilar: Object.freeze({ x: 11.5, w: 2.0, d: 2.0, h: 8.0, alas: 0.8 }),
  balok: Object.freeze({ y0: 7.0, y1: 8.6, d: 1.4, span: 25.0 }),
  pos: Object.freeze({ x0: -16, x1: -13, z0: 1.5, z1: 4.5, h: 2.6 }),
  daun: Object.freeze({ x: 10.2, z0: 1.2, z1: 6.2, h: 1.8 }),
  spanduk: Object.freeze({ x0: -15.6, x1: -12.6, y0: 1.4, y1: 2.2, z: -1.2, baris: Object.freeze(['PEMBERITAHUAN', 'GERBANG DITUTUP PUKUL 20.00 WIB']) }),
  warna: Object.freeze({ pilar: 0xe6e0d0, alas: 0x4a4a4f, balok: 0x2f3338, besi: 0x3b4044, pos: 0xf0ebe0, atap: 0x8c8f93, kaca: 0x22303c, bambu: 0x9c7a4a, lampu: 0xfff1d0, kuning: 0xf5d000 }),
});
const W = GERBANG.warna;

/** Spanduk kuning N08 dua baris (teks [INFERENSI] dari jam operasional [T]). Node → kuning polos. */
function spandukMaterial() {
  return heroMaterial('gerbang:spanduk', () => {
    let map = null;
    if (hasDocument()) {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 272;
      const g = c.getContext('2d');
      if (g) {
        g.fillStyle = '#f5d000';
        g.fillRect(0, 0, 1024, 272);
        g.fillStyle = '#111111';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = 'bold 84px sans-serif';
        g.fillText(GERBANG.spanduk.baris[0], 512, 82, 980);
        g.font = 'bold 64px sans-serif';
        g.fillText(GERBANG.spanduk.baris[1], 512, 190, 980);
        map = new THREE.CanvasTexture(c);
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 4;
      }
    }
    return named(new THREE.MeshLambertMaterial({ color: map ? 0xffffff : W.kuning, map, side: THREE.DoubleSide }), 'gerbang:spanduk');
  });
}

const lambert = (key, color) => heroMaterial(`gerbang:${key}`, () => named(new THREE.MeshLambertMaterial({ color }), `gerbang:${key}`));
const M = {
  pilar: () => lambert('pilar', W.pilar),
  alas: () => lambert('alas', W.alas),
  pita: () => lambert('pita', 0xb9b3a2),
  balok: () => lambert('balok', W.balok),
  besi: () => lambert('besi', W.besi),
  pos: () => lambert('pos', W.pos),
  atap: () => lambert('atap', W.atap),
  kaca: () => lambert('kaca', W.kaca),
  bambu: () => lambert('bambu', W.bambu),
  lampu: () => heroMaterial('gerbang:lampu', () => {
    const m = named(new THREE.MeshStandardMaterial({ color: W.lampu, emissive: W.lampu, emissiveIntensity: 0 }), 'gerbang:lampu-emisif');
    m.userData.nightEmissive = { on: 2.0, off: 0 };
    return m;
  }),
};

function pilar(f) {
  const { x, w, d, h, alas } = GERBANG.pilar;
  for (const sx of [-1, 1]) {
    const cx = sx * x;
    f.box(M.alas(), [cx - w / 2 - 0.15, cx + w / 2 + 0.15], [0, alas], [-d / 2 - 0.15, d / 2 + 0.15]);
    f.box(M.pilar(), [cx - w / 2, cx + w / 2], [alas, h], [-d / 2, d / 2]);
    // pita horizontal & panel cekung berbingkai (tiga pita, dua panel) memecah bidang polos pilar
    for (const y of [alas + 0.3, 3.4, 5.6]) f.box(M.pita(), [cx - w / 2 - 0.08, cx + w / 2 + 0.08], [y, y + 0.14], [-d / 2 - 0.08, d / 2 + 0.08], { castShadow: false });
    for (const [y0, y1] of [[alas + 0.7, 3.1], [3.8, 5.3]]) {
      f.box(M.alas(), [cx - w / 2 + 0.28, cx + w / 2 - 0.28], [y0, y1], [-d / 2 - 0.03, -d / 2], { castShadow: false });
      f.box(M.alas(), [cx - w / 2 + 0.28, cx + w / 2 - 0.28], [y0, y1], [d / 2, d / 2 + 0.03], { castShadow: false });
    }
    // kepala pilar: kornis menjorok + tutup piramida rendah + lampu bola menyala malam
    f.box(M.pita(), [cx - w / 2 - 0.25, cx + w / 2 + 0.25], [h, h + 0.22], [-d / 2 - 0.25, d / 2 + 0.25]);
    f.box(M.pilar(), [cx - w / 2 - 0.05, cx + w / 2 + 0.05], [h + 0.22, h + 0.55], [-d / 2 - 0.05, d / 2 + 0.05]);
    f.box(M.lampu(), [cx - 0.3, cx + 0.3], [h + 0.55, h + 1.15], [-0.3, 0.3], { castShadow: false });
    f.box(M.pita(), [cx - 0.36, cx + 0.36], [h + 1.15, h + 1.27], [-0.36, 0.36], { castShadow: false });
  }
}

/** Tembok rendah berpagar besi menyambung pilar ke sisi kampus (selatan) — pembatas pejalan kaki, bukan penghalang jalan. */
function temboks(f) {
  const { x, w, d } = GERBANG.pilar;
  const x0 = x + w / 2 + 0.3;
  const x1 = x0 + 9;
  f.box(M.pilar(), [x0, x1], [0, 0.85], [-d / 2 + 0.2, d / 2 - 0.2]);
  f.box(M.pita(), [x0, x1], [0.85, 0.97], [-d / 2 + 0.1, d / 2 - 0.1], { castShadow: false });
  for (let xx = x0 + 0.3; xx <= x1; xx += 0.14 * 6) f.box(M.besi(), [xx - 0.02, xx + 0.02], [0.97, 2.1], [-0.02, 0.02], { castShadow: false });
  f.box(M.besi(), [x0, x1], [2.05, 2.12], [-0.03, 0.03], { castShadow: false });
}

function balok(f) {
  const b = GERBANG.balok;
  f.box(M.balok(), [-b.span / 2, b.span / 2], [b.y0, b.y1], [-b.d / 2, b.d / 2]);
  const parts = reliefTextParts({ key: 'gerbang:nama', text: 'UNIVERSITAS RIAU', width: 16, height: 1.0, color: '#f2f2f2', shade: '#8a8a8a', nightGlow: 1.0 });
  const yc = (b.y0 + b.y1) / 2;
  for (const p of parts) {
    f.add(p.geometry, p.material, local(0, yc, -b.d / 2 - 0.07).multiply(p.matrix), { castShadow: false });
    f.add(p.geometry, p.material, local(0, yc, b.d / 2 + 0.07, { ry: Math.PI }).multiply(p.matrix), { castShadow: false });
  }
}

/** Daun pagar besi terbuka (dilipat sejajar jalan di sisi kampus, di balik pilar). */
function daunPagar(f) {
  const dn = GERBANG.daun;
  for (const sx of [-1, 1]) {
    const x = sx * dn.x;
    f.box(M.besi(), [x - 0.04, x + 0.04], [0.15, 0.25], [dn.z0, dn.z1]);
    f.box(M.besi(), [x - 0.04, x + 0.04], [dn.h - 0.1, dn.h], [dn.z0, dn.z1]);
    for (let z = dn.z0; z <= dn.z1 + 1e-6; z += 0.15) f.box(M.besi(), [x - 0.02, x + 0.02], [0.15, dn.h], [z - 0.02, z + 0.02], { castShadow: false });
  }
}

/** Pos satpam (P01/K11) di sisi kampus utara jalan; jendela menghadap jalan, pintu ke kampus. */
function posSatpam(f) {
  const p = GERBANG.pos;
  const cx = (p.x0 + p.x1) / 2;
  const cz = (p.z0 + p.z1) / 2;
  f.box(M.pos(), [p.x0, p.x1], [0, p.h], [p.z0, p.z1]);
  f.box(M.atap(), [p.x0 - 0.5, p.x1 + 0.5], [p.h, p.h + 0.2], [p.z0 - 0.5, p.z1 + 0.5]);
  f.box(M.kaca(), [p.x1, p.x1 + 0.02], [1.0, 2.1], [p.z0 + 0.4, p.z1 - 0.4], { castShadow: false });
  f.box(M.kaca(), [cx - 0.45, cx + 0.45], [0, 2.1], [p.z1, p.z1 + 0.02], { castShadow: false });
  f.box(M.lampu(), [p.x1 - 0.6, p.x1 - 0.2], [p.h - 0.2, p.h - 0.1], [cz - 0.2, cz + 0.2], { castShadow: false });
}

/** Spanduk kuning N08 diikat antara pilar utara dan tiang bambu, menghadap kedatangan (timur). */
function spanduk(f) {
  const s = GERBANG.spanduk;
  const geo = heroGeometry('gerbang:spandukBidang', () => new THREE.PlaneGeometry(s.x1 - s.x0, s.y1 - s.y0).rotateY(Math.PI));
  f.add(geo, spandukMaterial(), local((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, s.z), { castShadow: false, name: 'N08' });
  f.cylinder(M.bambu(), { x: s.x0 - 0.15, z: s.z, y0: 0, h: 2.6, r: 0.05, seg: 8 });
}

/** HERO_BUILDERS['hero:gerbang-sm-amin'] — PartList dunia (spec §4.6). */
export function buildGerbangSmAmin(plan, _mats, ctx = {}) {
  const f = createHeroFrame({ ...GERBANG_SITE, y: heroBaseY(plan, ctx, GERBANG_SITE) - PLINTH, origin: ctx?.origin ?? null });
  pilar(f);
  temboks(f);
  balok(f);
  daunPagar(f);
  posSatpam(f);
  spanduk(f);
  return f.parts;
}
