/**
 * Pose NPC interior (spec §4.10, katalog C03–C09): duduk bersila (lesehan), duduk mengetik di kursi,
 * genjreng gitar (bersila), rebahan, menulis di papan, ngobrol berdiri, minum. Murni visual: hanya menulis
 * rotasi/posisi pivot Humanoid (konvensi sudut = Humanoid.anim.js: lengan/paha rotation.x NEGATIF = ke depan,
 * lutut POSITIF = menekuk, spine POSITIF = condong, kepala POSITIF = menunduk, bahu kiri .z POSITIF = terangkat
 * ke samping). Pinggul memakai urutan Euler 'XZY' agar putaran y = puntir sepanjang paha (perlu untuk kaki
 * bersila); dengan y = 0 hasilnya identik dengan 'XYZ' sehingga animasi lama tetap benar.
 * Tiap pose: `base` (sudut statis) + `idle(t, c)` (gerak kecil berulang: napas, menoleh, mengetik, genjreng).
 * Nilai awal dihitung dari geometri DIM (paha 0,36 m, betis 0,34 m); toleransi penyetelan visual ±0,3 rad.
 */
import { DIM, LIMB } from './Humanoid.dim.js';

const TAU = Math.PI * 2;
const CHAIR_SEAT = 0.45; // tinggi dudukan kursi lipat (m)
const CHANNELS = Object.freeze([
  'bodyRx', 'spine', 'head', 'headYaw', 'shL', 'shLz', 'shR', 'shRz', 'elL', 'elR',
  'hipL', 'hipLy', 'hipLz', 'hipR', 'hipRy', 'hipRz', 'kneeL', 'kneeR', 'bob', 'squash',
]);
const C = Object.fromEntries(CHANNELS.map((k) => [k, 0]));

/** Kaki bersila: paha ke depan-luar, puntir paha agar betis melipat menyilang di depan (kanan sedikit di atas). */
const CROSS_LEGS = Object.freeze({
  hipL: -1.35, hipLy: 1.18, hipLz: 0.7, kneeL: 2.62,
  hipR: -1.25, hipRy: -1.18, hipRz: -0.7, kneeR: 2.62,
});

const breathe = (t, c, k = 1) => {
  const s = Math.sin(t * 1.5);
  c.spine += 0.015 * s * k;
  c.squash += 0.006 * s * k;
  c.bob += 0.003 * s * k;
};
/** 0..1..0 berbentuk sinus selama `len` detik di awal setiap `period` detik. */
const pulse = (t, period, len) => {
  const u = ((t % period) + period) % period;
  return u > len ? 0 : Math.sin((u / len) * Math.PI);
};

const pose = (seat, base, idle) => Object.freeze({ seat, base: Object.freeze(base), idle });

export const POSES = Object.freeze({
  /** C03 lesehan rapat: bersila, tangan di lutut, sesekali menoleh & menggerakkan tangan saat bicara. */
  sitCrossLegged: pose('floor', {
    ...CROSS_LEGS, spine: 0.12, head: 0.06, shL: -0.55, shLz: 0.14, shR: -0.55, shRz: -0.14, elL: -0.9, elR: -0.9,
  }, (t, c) => {
    breathe(t, c);
    c.headYaw = 0.35 * Math.sin(t * 0.37) * pulse(t, 9, 4.5);
    c.head += 0.05 * Math.sin(t * 0.8);
    c.shR -= 0.35 * pulse(t, 5.5, 1.2);
    c.elR -= 0.3 * pulse(t, 5.5, 1.2);
  }),
  /** C04 laptop: duduk di kursi lipat, paha datar, lengan ke papan ketik, mengetik bergantian, sesekali bersandar. */
  sitChairTyping: pose('chair', {
    spine: 0.16, head: 0.22, shL: -0.85, shLz: 0.12, shR: -0.85, shRz: -0.12, elL: -1.0, elR: -1.0,
    hipL: -1.5, hipLz: 0.06, hipR: -1.5, hipRz: -0.06, kneeL: 1.45, kneeR: 1.45,
  }, (t, c) => {
    breathe(t, c, 0.6);
    const typing = pulse(t, 6, 4.2) > 0 ? 1 : 0;
    c.elL += 0.06 * Math.sin(t * 19) * typing;
    c.elR += 0.06 * Math.sin(t * 17 + 1.3) * typing;
    c.head += 0.05 * Math.sin(t * 0.5);
    c.spine -= 0.12 * pulse(t, 13, 2.5);
  }),
  /** C05 gitar: bersila, tangan kiri ke leher gitar (kiri badan), kanan menggenjreng ±2,2 Hz, kepala mengangguk. */
  guitarStrum: pose('floor', {
    ...CROSS_LEGS, spine: 0.08, head: 0.22, headYaw: 0.15,
    shL: -1.1, shLz: 0.55, elL: -0.65, shR: -0.45, shRz: -0.2, elR: -1.55,
  }, (t, c) => {
    const beat = Math.sin(t * TAU * 2.2);
    c.elR += 0.14 * beat;
    c.shR += 0.05 * beat;
    c.spine += 0.03 * Math.sin(t * TAU * 0.55);
    c.head += 0.05 * Math.sin(t * TAU * 1.1);
    breathe(t, c, 0.5);
  }),
  /** C06 rebahan: telentang (badan −90°), kepala terangkat bantal, tangan kanan di bawah kepala, lutut kiri naik. */
  lieDown: pose('lie', {
    bodyRx: -Math.PI / 2, head: 0.5, shR: -2.7, shRz: -0.25, elR: -1.9, shL: 0.05, shLz: 0.12, elL: -0.2,
    hipL: -0.7, kneeL: 1.3, hipR: -0.05, kneeR: 0.08,
  }, (t, c) => {
    const s = Math.sin(t * 0.9);
    c.squash += 0.01 * s;
    c.spine += 0.01 * s;
    c.hipL += 0.05 * Math.sin(t * 0.21);
    c.kneeL -= 0.05 * Math.sin(t * 0.21);
  }),
  /** C07 papan tulis: lengan kanan terangkat menulis (goresan 9 Hz); jeda: tangan turun & menoleh ke teman. */
  writeBoard: pose('stand', {
    spine: 0.03, head: -0.12, shR: -1.95, shRz: -0.22, elR: -0.7, shL: -0.45, shLz: 0.1, elL: -1.4, hipLz: 0.04, hipRz: -0.03,
  }, (t, c) => {
    const write = pulse(t, 7, 5);
    c.shRz += 0.16 * Math.sin(t * 0.8) * write;
    c.elR += 0.12 * Math.sin(t * 9) * write;
    c.shR += 0.5 * (1 - write);
    c.elR -= 0.3 * (1 - write);
    c.headYaw = -0.4 * (1 - write);
    breathe(t, c, 0.5);
  }),
  /** C08 ngobrol: tangan kanan bergestur, kiri di saku, mengangguk & menoleh, berat badan bergeser. */
  standTalk: pose('stand', {
    spine: 0.02, shL: 0.1, shLz: 0.14, elL: -0.5, shR: -0.4, shRz: -0.1, elR: -1.0, hipLz: 0.05, hipRz: -0.02,
  }, (t, c) => {
    c.shR += 0.25 * Math.sin(t * 1.7);
    c.elR += 0.3 * Math.sin(t * 2.3 + 0.7);
    c.head += 0.06 * Math.sin(t * 2.1);
    c.headYaw = 0.25 * Math.sin(t * 0.4);
    c.hipLz += 0.03 * Math.sin(t * 0.3);
    breathe(t, c);
  }),
  /** C09 minum: gelas di depan dada; tiap 7 detik menyesap (lengan naik, kepala mendongak) selama 1,6 detik. */
  drinkCup: pose('stand', {
    spine: 0.02, shR: -0.6, shRz: -0.12, elR: -1.6, shL: 0.05, shLz: 0.1, elL: -0.25,
  }, (t, c) => {
    const sip = pulse(t, 7, 1.6);
    c.shR -= 0.5 * sip;
    c.elR -= 0.6 * sip;
    c.head -= 0.28 * sip;
    breathe(t, c);
  }),
});

export const POSE_IDS = Object.freeze(Object.keys(POSES));

/**
 * Sudut lengan pengganti untuk avatar manekin (lengan realistis ±1,6× lebih panjang dari chibi): sudut `base` chibi
 * melempar tangan jauh ke depan ("lengan zombie"), jadi lengan atas lebih turun & siku lebih menekuk agar tangan tiba
 * di lutut / papan ketik / gitar / dada. Hanya kanal yang tertulis di sini yang diganti; gerak idle tetap sama.
 */
export const MANEKIN_ARMS = Object.freeze({
  sitCrossLegged: Object.freeze({ shL: -0.22, shR: -0.22, elL: -0.75, elR: -0.75 }),
  sitChairTyping: Object.freeze({ shL: -0.3, shR: -0.3, elL: -1.3, elR: -1.3 }),
  guitarStrum: Object.freeze({ shL: -0.6, shLz: 0.35, elL: -1.0, shR: -0.15, elR: -1.55 }),
  standTalk: Object.freeze({ shR: -0.2, elR: -1.15 }),
  drinkCup: Object.freeze({ shR: -0.2, elR: -1.95 }),
});

/** Tinggi pivot pinggul (m) per jenis duduk; skala tinggi badan memengaruhi tebal paha/torso. */
function seatY(p, seat) {
  const s = p.body.userData.baseScale ?? 1;
  const thighR = p.body.userData.thighR ?? LIMB.thighR; // manekin: tebal paha dari rig
  if (seat === 'floor') return 0.03 + thighR * s;
  if (seat === 'chair') return CHAIR_SEAT + thighR * s;
  if (seat === 'lie') return 0.2 * s;
  return p.body.userData.baseY ?? DIM.hipY * s;
}

function write(p, seat) {
  p.body.position.y = seatY(p, seat) + C.bob;
  p.body.rotation.set(C.bodyRx, 0, 0);
  const base = p.body.userData.baseScale ?? 1;
  const sq = Math.max(-0.03, Math.min(0.03, C.squash));
  p.body.scale.set(base * (1 - sq * 0.5), base * (1 + sq), base * (1 - sq * 0.5));
  p.spine.rotation.set(C.spine, 0, 0);
  p.headPivot.rotation.set(C.head, C.headYaw, 0);
  p.shoulderL.rotation.set(C.shL, 0, C.shLz);
  p.shoulderR.rotation.set(C.shR, 0, C.shRz);
  p.elbowL.rotation.set(C.elL, 0, 0);
  p.elbowR.rotation.set(C.elR, 0, 0);
  p.hipL.rotation.order = 'XZY';
  p.hipR.rotation.order = 'XZY';
  p.hipL.rotation.set(C.hipL, C.hipLy, C.hipLz);
  p.hipR.rotation.set(C.hipR, C.hipRy, C.hipRz);
  p.kneeL.rotation.set(C.kneeL, 0, 0);
  p.kneeR.rotation.set(C.kneeR, 0, 0);
}

/**
 * Terapkan pose + idle pada waktu t (detik; NaN → 0). Tidak mengalokasikan objek per panggilan.
 * @param {{parts: Record<string, THREE.Object3D>}} humanoid
 * @param {string} poseId salah satu POSE_IDS
 * @param {number} [t]
 */
export function applyPose(humanoid, poseId, t = 0) {
  const def = POSES[poseId];
  if (!def) throw new Error(`Humanoid.poses: pose "${poseId}" tidak dikenal`);
  for (const k of CHANNELS) C[k] = 0;
  Object.assign(C, def.base);
  if (humanoid.parts.body.userData.gender) Object.assign(C, MANEKIN_ARMS[poseId]); // avatar manekin
  def.idle(Number.isFinite(t) ? t : 0, C);
  write(humanoid.parts, def.seat);
}

/** Kembalikan kanal yang tidak disentuh Humanoid.anim (rotasi badan, toleh kepala, puntir pinggul) ke netral. */
export function clearPose(humanoid) {
  const p = humanoid.parts;
  p.body.rotation.set(0, 0, 0);
  p.body.position.y = p.body.userData.baseY ?? DIM.hipY;
  p.headPivot.rotation.set(0, 0, 0);
  for (const hip of [p.hipL, p.hipR]) {
    hip.rotation.order = 'XYZ';
    hip.rotation.set(0, 0, 0);
  }
}
