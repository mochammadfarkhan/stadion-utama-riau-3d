// src/regions/unri-rektorat/materials.js
/**
 * Material region unri-rektorat, ber-cache di ResourceScope aktif (kunci 'unri-rektorat:<nama>') dan
 * dilepas bersama teksturnya. Material bercahaya malam memakai userData.nightEmissive {on, off}
 * (TimeOfDay.lights); overlay permukaan (paving, rumput, trotoar) memakai polygonOffset agar menang atas
 * ground distrik tanpa z-fighting. Warna [T]: dinding putih, kaca biru, parapet gelap (foto 2016); kanopi
 * pintu masuk biru, tiang bulat biru-abu, selembayung emas, kerb kuning-hitam, tiang lampu taman hitam
 * (Street View Jan 2025, docs/research §8b); lainnya [INFERENSI].
 */
import * as THREE from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { surfaceMaps } from '../../world/textures/surfaces.js';
import { hasDocument } from '../../world/siteutil/textCanvas.js';
import { createRng } from '../../world/util/random.js';
import { disposeMaterialDeep } from '../../world/kit/hero/heroFrame.js';

export const WARNA = Object.freeze({
  dinding: 0xf3f1ec, parapet: 0x3d4148, kacaPita: 0x1d3148, kacaBiru: 0x3b78b8, granit: 0x8f8c86,
  tangga: 0xdcd8cf, atap: 0x9c9e9d, biru: 0x2b5ea7, biruTiang: 0xa9bdd6, plafon: 0xf6f2e8, mesin: 0x878a8d, tandon: 0xd9d6cc,
  perpusDinding: 0xe8dfcc, atapSeng: 0x7d8a96, batu: 0x857b70, beton: 0xb9b6ae, lobi: 0x24303c,
  emas: 0xd4a017, emasGelap: 0x6b4a14, malam: 0xffd9a0,
  kerbKuning: 0xe0b81a, kerbHitam: 0x1e2024, tiangLampu: 0x1b1d20, lentera: 0xf1e3b8, semak: 0x3f7a3c, bunga: 0xc2476b,
});
/** Lebar bay pita jendela (m) — juga satuan sel peta lampu malam (16 sel per tekstur). */
export const BAY = 1.8;
const OVERLAY = Object.freeze({ polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }); // di atas lapisan ground distrik (paving −2, jalan setapak −3)

const cached = (key, make) => currentScope().get(`unri-rektorat:${key}`, make, { dispose: disposeMaterialDeep });
const named = (mat, name) => {
  mat.name = `rektorat:${name}`;
  return mat;
};
const lambert = (name, color, extra = {}) => cached(name, () => named(new THREE.MeshLambertMaterial({ color, ...extra }), name));
const standard = (name, opts) => cached(name, () => named(new THREE.MeshStandardMaterial(opts), name));

/** Peta emisif pita jendela: 16 sel menyala acak hangat (malam). Node → null (seragam). */
function litWindowsTexture(seed = 1962) {
  if (!hasDocument()) return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 512, 64);
  const rnd = createRng(seed);
  for (let i = 0; i < 16; i += 1) {
    if (rnd() >= 0.45) continue;
    g.fillStyle = rnd() < 0.5 ? '#ffd9a0' : '#fff2d8';
    g.fillRect(i * 32 + 3, 8, 26, 48);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Emisif hangat yang mati siang (off 0) dan menyala `on` saat lampu malam. */
function nightGlow(mat, on, color = WARNA.malam) {
  mat.emissive = new THREE.Color(color);
  mat.emissiveIntensity = 0;
  mat.userData.nightEmissive = { on, off: 0 };
  return mat;
}

export const MATS = Object.freeze({
  dinding: () => lambert('dinding', WARNA.dinding),
  parapet: () => lambert('parapet', WARNA.parapet),
  tangga: () => lambert('tangga', WARNA.tangga),
  atap: () => lambert('atap', WARNA.atap),
  mesin: () => lambert('mesin', WARNA.mesin),
  tandon: () => lambert('tandon', WARNA.tandon),
  biru: () => lambert('biru', WARNA.biru, { side: THREE.DoubleSide }),
  biruTiang: () => lambert('biruTiang', WARNA.biruTiang),
  kerbKuning: () => lambert('kerbKuning', WARNA.kerbKuning),
  kerbHitam: () => lambert('kerbHitam', WARNA.kerbHitam),
  tiangLampu: () => lambert('tiangLampu', WARNA.tiangLampu),
  semak: () => lambert('semak', WARNA.semak),
  bunga: () => lambert('bunga', WARNA.bunga),
  emasGelap: () => lambert('emasGelap', WARNA.emasGelap, { side: THREE.DoubleSide }),
  lentera: () => cached('lentera', () => nightGlow(named(new THREE.MeshStandardMaterial({ color: WARNA.lentera, roughness: 0.5 }), 'lentera'), 1.4)),
  perpusDinding: () => lambert('perpusDinding', WARNA.perpusDinding),
  atapSeng: () => lambert('atapSeng', WARNA.atapSeng, { side: THREE.DoubleSide }),
  granit: () => standard('granit', { color: WARNA.granit, roughness: 0.35, metalness: 0.05 }),
  emas: () => standard('emas', { color: WARNA.emas, roughness: 0.35, metalness: 0.6, side: THREE.DoubleSide }),
  kacaBiru: () => standard('kacaBiru', { color: WARNA.kacaBiru, roughness: 0.12, metalness: 0.45 }),
  kacaPita: () => cached('kacaPita', () => {
    const m = named(new THREE.MeshStandardMaterial({ color: WARNA.kacaPita, roughness: 0.15, metalness: 0.55 }), 'kacaPita');
    nightGlow(m, 0.85);
    const map = litWindowsTexture();
    if (map) m.emissiveMap = map;
    return m;
  }),
  lobi: () => cached('lobi', () => nightGlow(named(new THREE.MeshStandardMaterial({ color: WARNA.lobi, roughness: 0.2, metalness: 0.3 }), 'lobi'), 0.7)),
  plafon: () => cached('plafon', () => nightGlow(named(new THREE.MeshStandardMaterial({ color: WARNA.plafon, roughness: 0.8, side: THREE.DoubleSide }), 'plafon'), 1.1)),
  beton: () => cached('beton', () => named(new THREE.MeshStandardMaterial({ color: WARNA.beton, roughness: 0.92, ...surfaceMaps('concrete', 2) }), 'beton')),
  betonDS: () => cached('betonDS', () => named(new THREE.MeshStandardMaterial({ color: WARNA.beton, roughness: 0.92, side: THREE.DoubleSide }), 'betonDS')),
  batu: () => cached('batu', () => named(new THREE.MeshStandardMaterial({ color: WARNA.batu, roughness: 0.95, ...surfaceMaps('concrete', 1.5) }), 'batu')),
  paving: () => cached('paving', () => named(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, ...OVERLAY, ...surfaceMaps('paving') }), 'paving')),
  trotoar: () => cached('trotoar', () => named(new THREE.MeshStandardMaterial({ color: WARNA.beton, roughness: 0.9, ...OVERLAY, ...surfaceMaps('concrete', 2) }), 'trotoar')),
  rumput: () => cached('rumput', () => named(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, ...OVERLAY, ...surfaceMaps('grass') }), 'rumput')),
  /** Material bendera (dibuat pemanggil karena butuh shader angin). */
  bendera: (make) => cached('bendera', make),
});
