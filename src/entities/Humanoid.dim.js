/**
 * Proporsi chibi (gaya Dinkum/Overcooked) dan geometri badan BERSAMA untuk
 * semua Humanoid. Semua geometri dibuat sekali di level modul; per orang hanya
 * dibuat Mesh baru yang menunjuk geometri + material (matFor) yang sama.
 *
 * Satuan meter untuk tinggi dasar 1.7 m; pinggul di y = DIM.hipY, kaki di y = 0.
 * Kepala besar (diameter ±0.6 m ≈ 35% tinggi), torso pendek, kaki pendek.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const BASE_HEIGHT = 1.7;

/** Dimensi pivot untuk tinggi 1.7 m (semua relatif pinggul kecuali hipY). */
export const DIM = Object.freeze({
  // Proporsi avatar (riset: Roblox klasik + referensi tim): torso ≈ tinggi kepala, kaki ≈ 40% tinggi,
  // lengan ≈ 1,3× torso. Bagian kit Blender (chibi_body.py) memakai panjang yang sama.
  hipY: 0.66,
  hipHalfWidth: 0.09,
  thigh: 0.33,
  shin: 0.31,
  torsoR: 0.16,      // setengah lebar torso (kompatibilitas)
  torsoH: 0.38,
  torsoD: 0.2,
  torsoY: 0.28,      // pusat torso relatif pinggul
  shoulderY: 0.44,
  shoulderX: 0.2,
  upperArm: 0.22,
  lowerArm: 0.20,
  neckY: 0.52,       // pivot kepala relatif pinggul
  headR: 0.30,
  headLift: 0.24,    // pusat kepala relatif pivot kepala
});

/** Jari-jari anggota badan membulat (tanpa siku/lutut terlihat). */
export const LIMB = Object.freeze({
  upperArmR: 0.055,
  lowerArmR: 0.05,
  thighR: 0.08,
  shinR: 0.07,
  footR: 0.065,
});

/** Geometri yang dipindahkan sekali saat dibuat (translate dibakar ke vertex). */
function at(geo, x, y, z) {
  return geo.translate(x, y, z);
}

/** Kapsul vertikal dengan ujung atas tepat di pivot (menggantung ke bawah). */
function hanging(r, len, segs = 6) {
  return at(new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 2, segs), 0, -len / 2, 0);
}

/** Sepatu bulat kecil: bola dipipihkan & dipanjangkan ke depan. */
function shoe() {
  const g = new THREE.SphereGeometry(1, 8, 6);
  g.scale(LIMB.footR * 1.1, LIMB.footR * 0.8, LIMB.footR * 1.6);
  return at(g, 0, -DIM.shin + 0.03, 0.03);
}

/** Geometri badan bersama (dibagikan oleh seluruh Humanoid). */
export const GEO = Object.freeze({
  head: at(new THREE.SphereGeometry(DIM.headR, 14, 10), 0, DIM.headLift, 0),
  torso: at(new RoundedBoxGeometry(DIM.torsoR * 2, DIM.torsoH, DIM.torsoD, 3, 0.08), 0, DIM.torsoY, 0),
  vest: at(new RoundedBoxGeometry(DIM.torsoR * 2 + 0.04, DIM.torsoH - 0.04, DIM.torsoD + 0.04, 3, 0.09), 0, DIM.torsoY, 0),
  shorts: at(new RoundedBoxGeometry(0.30, 0.16, 0.22, 3, 0.06), 0, 0.02, 0),
  skirt: at(new THREE.CylinderGeometry(0.15, 0.27, 0.22, 12), 0, -0.04, 0),
  apron: at(new RoundedBoxGeometry(0.26, 0.32, 0.03, 2, 0.012), 0, 0.14, DIM.torsoD / 2 + 0.012),
  badge: at(new RoundedBoxGeometry(0.08, 0.08, 0.02, 2, 0.008), -0.08, DIM.torsoY + 0.04, DIM.torsoD / 2 + 0.01),
  // Ransel di punggung (−Z lokal; model menghadap +Z), ikut skala body.
  backpack: at(new RoundedBoxGeometry(0.28, 0.30, 0.13, 2, 0.05), 0, DIM.torsoY + 0.01, -(DIM.torsoD / 2 + 0.065)),
  upperArm: hanging(LIMB.upperArmR, DIM.upperArm),
  lowerArm: hanging(LIMB.lowerArmR, DIM.lowerArm + LIMB.lowerArmR),
  thigh: hanging(LIMB.thighR, DIM.thigh + LIMB.thighR * 0.5),
  shin: hanging(LIMB.shinR, DIM.shin),
  foot: shoe(),
});

/**
 * Tipe tubuh (skala per bagian di atas proporsi dasar; geometri tetap bersama):
 * w/d = lebar/tebal torso & bawahan (bahu & pinggul ikut melebar), limb = tebal lengan/kaki,
 * head = skala kepala (anak berkepala lebih besar, khas chibi).
 */
export const BODY_BUILDS = Object.freeze({
  slim: Object.freeze({ w: 0.9, d: 0.92, limb: 0.9, head: 0.97 }),
  average: Object.freeze({ w: 1, d: 1, limb: 1, head: 1 }),
  chubby: Object.freeze({ w: 1.22, d: 1.26, limb: 1.2, head: 1.04 }),
  child: Object.freeze({ w: 1, d: 1, limb: 1.05, head: 1.22 }),
});
