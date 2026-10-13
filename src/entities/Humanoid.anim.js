/**
 * Animasi prosedural Humanoid: murni visual, hanya mengubah rotasi pivot
 * (dan sedikit posisi Y body untuk bob). Tidak mengalokasikan objek per frame.
 *
 * Konvensi sudut (model menghadap +Z):
 *  - anggota badan yang menggantung (lengan, paha): rotation.x NEGATIF = ayun ke depan.
 *  - lutut: rotation.x POSITIF = betis tertekuk ke belakang.
 *  - spine: rotation.x POSITIF = condong ke depan.
 *  - bahu rotation.z: lengan kiri (+X) terangkat ke samping = POSITIF, kanan = NEGATIF.
 */
import { DIM } from './Humanoid.js';
import { clamp } from './util.js';

const TWO_PI = Math.PI * 2;

/**
 * Terapkan satu set sudut ke pivot. Semua kanal selalu ditulis agar pose
 * dari animasi sebelumnya tidak menempel.
 */
function applyPose(parts, p) {
  parts.spine.rotation.x = p.spine ?? 0;
  parts.headPivot.rotation.x = p.head ?? 0;
  parts.shoulderL.rotation.set(p.shL ?? 0, 0, p.shLz ?? 0);
  parts.shoulderR.rotation.set(p.shR ?? 0, 0, p.shRz ?? 0);
  parts.elbowL.rotation.x = p.elL ?? 0;
  parts.elbowR.rotation.x = p.elR ?? 0;
  parts.hipL.rotation.set(p.hipL ?? 0, 0, p.hipLz ?? 0);
  parts.hipR.rotation.set(p.hipR ?? 0, 0, p.hipRz ?? 0);
  parts.kneeL.rotation.x = p.kneeL ?? 0;
  parts.kneeR.rotation.x = p.kneeR ?? 0;
  parts.body.position.y = parts.body.userData.baseY + (p.bob ?? 0);
}

/** Diam: napas pelan, lengan sedikit bergoyang. */
export function animateIdle(h, t) {
  const s = Math.sin(t * 1.6);
  applyPose(h.parts, {
    spine: 0.02 * s,
    shL: 0.05 * s, shR: -0.05 * s, shLz: 0.08, shRz: -0.08,
    elL: -0.15, elR: -0.15,
    bob: 0.005 * s,
  });
}

/** Berjalan santai (~1.4 m/s). */
export function animateWalk(h, t) {
  const ph = t * TWO_PI * 1.0; // satu siklus langkah ganda per detik
  const sw = Math.sin(ph);
  const kneeL = Math.max(0, -Math.sin(ph + 0.6)) * 0.7;
  const kneeR = Math.max(0, Math.sin(ph + 0.6)) * 0.7;
  applyPose(h.parts, {
    spine: 0.04,
    hipL: -0.45 * sw, hipR: 0.45 * sw,
    kneeL, kneeR,
    shL: 0.4 * sw, shR: -0.4 * sw, shLz: 0.06, shRz: -0.06,
    elL: -0.3, elR: -0.3,
    bob: 0.02 * Math.abs(Math.cos(ph)),
  });
}

/**
 * Berlari; frekuensi & amplitudo mengikuti kecepatan (m/s).
 * speed < 1.8 otomatis diturunkan ke pose jalan.
 */
export function animateRun(h, t, speed = 4) {
  if (speed < 1.8) return animateWalk(h, t);
  const k = clamp((speed - 2) / 4, 0, 1);      // 0 = jogging, 1 = sprint
  const freq = 1.3 + 0.35 * speed;              // langkah per detik
  const ph = t * TWO_PI * freq * 0.5;
  const sw = Math.sin(ph);
  const amp = 0.7 + 0.5 * k;
  const kneeL = Math.max(0, -Math.sin(ph + 0.9)) * (1.1 + 0.6 * k);
  const kneeR = Math.max(0, Math.sin(ph + 0.9)) * (1.1 + 0.6 * k);
  applyPose(h.parts, {
    spine: 0.12 + 0.2 * k,
    head: -0.1,
    hipL: -amp * sw + 0.1, hipR: amp * sw + 0.1,
    kneeL, kneeR,
    shL: 0.8 * sw, shR: -0.8 * sw, shLz: 0.12, shRz: -0.12,
    elL: -1.3, elR: -1.3,
    bob: 0.04 * Math.abs(Math.cos(ph)),
  });
}

/**
 * Tendangan kaki kanan; phase 0..1 (0 = ancang-ancang, ~0.55 = kontak, 1 = selesai).
 */
export function animateKick(h, phase) {
  const p = clamp(phase, 0, 1);
  // ayun ke belakang, lalu cepat ke depan, lalu kembali ke netral
  const swing = p < 0.4 ? -p / 0.4 : p < 0.7 ? -1 + ((p - 0.4) / 0.3) * 2 : 1 - (p - 0.7) / 0.3;
  const hipR = -swing * 1.1;                 // negatif = ke depan
  const kneeR = swing < 0 ? -swing * 1.4 : (1 - swing) * 0.6;
  applyPose(h.parts, {
    spine: -0.1 * swing,
    hipL: 0.15, kneeL: 0.2,
    hipR, kneeR,
    shL: 0.6 * swing, shR: -0.6 * swing, shLz: 0.5, shRz: -0.5,
    elL: -0.6, elR: -0.6,
  });
}

/**
 * Pose bersepeda. Kaki memakai IK 2-tulang (bidang Y-Z) agar telapak selalu
 * menempel pedal. Semua jarak dalam satuan model (tinggi 1.7 m).
 * @param {{parts:object}} h
 * @param {number} pedalAngle rad; 0 = pedal kiri di bawah
 * @param {{crankR?:number, bbY?:number, bbZ?:number}} [geo]
 *   posisi bottom bracket RELATIF terhadap pivot pinggul (satuan model).
 */
export function animateCycling(h, pedalAngle, geo = {}) {
  const crankR = geo.crankR ?? 0.17;
  const bbY = geo.bbY ?? -0.58;   // bottom bracket 0.58 m di bawah pinggul
  const bbZ = geo.bbZ ?? 0.28;    // dan 0.28 m di depan pinggul
  const legL = solveLegIK(bbY - crankR * Math.cos(pedalAngle), bbZ - crankR * Math.sin(pedalAngle));
  const legR = solveLegIK(bbY + crankR * Math.cos(pedalAngle), bbZ + crankR * Math.sin(pedalAngle));
  applyPose(h.parts, {
    spine: 0.5, head: -0.45,
    shL: -1.05, shR: -1.05, shLz: 0.15, shRz: -0.15,
    elL: -0.35, elR: -0.35,
    hipL: legL.hip, kneeL: legL.knee,
    hipR: legR.hip, kneeR: legR.knee,
  });
}

/** IK 2-tulang: target (dy, dz) relatif pinggul → {hip, knee} (rad). */
function solveLegIK(dy, dz) {
  const l1 = DIM.thigh, l2 = DIM.shin;
  const d = clamp(Math.hypot(dy, dz), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const toTarget = Math.atan2(dz, -dy);                                   // sudut dari arah lurus ke bawah
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const b = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  return { hip: -(toTarget + a), knee: Math.PI - b };
}

/** Pedagang menunggu: satu tangan mengipas / melambai, badan sedikit goyang. */
export function animateSellIdle(h, t) {
  const fan = Math.sin(t * 5.0);
  const sway = Math.sin(t * 0.9);
  applyPose(h.parts, {
    spine: 0.03 * sway,
    shL: 0.05 * sway, shLz: 0.1,
    shR: -1.4, shRz: -0.35 - 0.15 * fan,
    elL: -0.2, elR: -1.0 + 0.2 * fan,
    hipLz: 0.05, hipRz: -0.05,
    bob: 0.004 * sway,
  });
}

/**
 * Senam sinkron (jumping-jack + angkat tangan). Gunakan t yang sama untuk
 * seluruh barisan agar gerakan serempak; `phaseOffset` untuk instruktur.
 */
export function animateExercise(h, t, phaseOffset = 0) {
  const ph = t * TWO_PI * 0.6 + phaseOffset;
  const u = (Math.sin(ph) + 1) / 2;                  // 0..1
  const armsUp = u * 2.9;                            // dari samping bawah ke atas kepala
  const legsOut = u * 0.35;
  const hop = Math.max(0, Math.sin(ph * 2)) * 0.05;
  applyPose(h.parts, {
    spine: 0.02,
    shLz: armsUp, shRz: -armsUp,
    elL: -0.1, elR: -0.1,
    hipLz: legsOut, hipRz: -legsOut,
    kneeL: 0.1, kneeR: 0.1,
    bob: hop,
  });
}

/** Pose skater: lutut ditekuk, badan condong, lengan ke samping untuk keseimbangan. */
export function animateSkate(h, t) {
  const push = Math.max(0, Math.sin(t * 2.2));
  applyPose(h.parts, {
    spine: 0.25,
    hipL: -0.5, kneeL: 0.9,
    hipR: -0.5 + push * 0.9, kneeR: 0.9 - push * 0.6,
    shLz: 0.7, shRz: -0.7, shL: 0.2, shR: -0.2,
    elL: -0.4, elR: -0.4,
    bob: -0.08,
  });
}

/**
 * Ayunan raket badminton; phase 0..1 (0.5 = kontak). side = 'L' | 'R'.
 */
export function animateSwing(h, phase, side = 'R') {
  const p = clamp(phase, 0, 1);
  const raise = Math.sin(p * Math.PI);
  const arm = -0.6 - 2.2 * raise;
  const pose = {
    spine: 0.1, hipL: -0.2, hipR: -0.2, kneeL: 0.4, kneeR: 0.4,
    shL: -0.4, shR: -0.4, shLz: 0.3, shRz: -0.3, elL: -0.8, elR: -0.8,
    bob: -0.03,
  };
  if (side === 'R') { pose.shR = arm; pose.elR = -0.3; } else { pose.shL = arm; pose.elL = -0.3; }
  applyPose(h.parts, pose);
}
