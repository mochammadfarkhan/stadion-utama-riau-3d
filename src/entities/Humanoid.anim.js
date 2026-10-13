/**
 * Animasi prosedural Humanoid chibi: murni visual, hanya mengubah rotasi pivot,
 * posisi Y body/kepala (bob) dan skala body (squash-and-stretch ±3%).
 * Tidak mengalokasikan objek per frame: semua fungsi menulis ke buffer pose
 * modul `P` lalu memanggil applyPose().
 *
 * Konvensi sudut (model menghadap +Z):
 *  - anggota badan yang menggantung (lengan, paha): rotation.x NEGATIF = ayun ke depan.
 *  - lutut: rotation.x POSITIF = betis tertekuk ke belakang.
 *  - spine: rotation.x POSITIF = condong ke depan.
 *  - bahu rotation.z: lengan kiri (+X) terangkat ke samping = POSITIF, kanan = NEGATIF.
 */
import { DIM } from './Humanoid.dim.js';
import { clamp } from './util.js';

const TWO_PI = Math.PI * 2;
const SQUASH_MAX = 0.03;   // ±3% skala vertikal
const HEAD_BOB_MAX = 0.012;

/** Buffer pose bersama; setiap kanal selalu di-reset agar pose lama tidak menempel. */
const P = {
  spine: 0, head: 0, shL: 0, shR: 0, shLz: 0, shRz: 0, elL: 0, elR: 0,
  hipL: 0, hipR: 0, hipLz: 0, hipRz: 0, kneeL: 0, kneeR: 0,
  bob: 0, headBob: 0, squash: 0,
};
const KEYS = Object.keys(P);

function resetPose() {
  for (let i = 0; i < KEYS.length; i += 1) P[KEYS[i]] = 0;
  return P;
}

/** Terapkan buffer pose ke pivot. */
function applyPose(parts) {
  parts.spine.rotation.x = P.spine;
  parts.headPivot.rotation.x = P.head;
  parts.shoulderL.rotation.set(P.shL, 0, P.shLz);
  parts.shoulderR.rotation.set(P.shR, 0, P.shRz);
  parts.elbowL.rotation.x = P.elL;
  parts.elbowR.rotation.x = P.elR;
  parts.hipL.rotation.set(P.hipL, 0, P.hipLz);
  parts.hipR.rotation.set(P.hipR, 0, P.hipRz);
  parts.kneeL.rotation.x = P.kneeL;
  parts.kneeR.rotation.x = P.kneeR;
  parts.body.position.y = parts.body.userData.baseY + P.bob;
  parts.headPivot.position.y = (parts.headPivot.userData.baseY ?? DIM.neckY) + clamp(P.headBob, -HEAD_BOB_MAX, HEAD_BOB_MAX);
  const base = parts.body.userData.baseScale ?? 1;
  const sq = clamp(P.squash, -SQUASH_MAX, SQUASH_MAX);
  parts.body.scale.set(base * (1 - sq * 0.5), base * (1 + sq), base * (1 - sq * 0.5));
}

/** Diam: napas pelan, lengan sedikit bergoyang. */
export function animateIdle(h, t) {
  const s = Math.sin(t * 1.6);
  const p = resetPose();
  p.spine = 0.02 * s;
  p.shL = 0.05 * s; p.shR = -0.05 * s; p.shLz = 0.08; p.shRz = -0.08;
  p.elL = -0.15; p.elR = -0.15;
  p.bob = 0.005 * s; p.squash = 0.008 * s; p.headBob = 0.004 * s;
  applyPose(h.parts);
}

/** Berjalan santai (~1.4 m/s). */
export function animateWalk(h, t) {
  const ph = t * TWO_PI * 1.0; // satu siklus langkah ganda per detik
  const sw = Math.sin(ph);
  const p = resetPose();
  p.spine = 0.04;
  p.hipL = -0.45 * sw; p.hipR = 0.45 * sw;
  p.kneeL = Math.max(0, -Math.sin(ph + 0.6)) * 0.7;
  p.kneeR = Math.max(0, Math.sin(ph + 0.6)) * 0.7;
  p.shL = 0.4 * sw; p.shR = -0.4 * sw; p.shLz = 0.06; p.shRz = -0.06;
  p.elL = -0.3; p.elR = -0.3;
  p.bob = 0.02 * Math.abs(Math.cos(ph));
  p.squash = 0.02 * Math.cos(ph * 2);        // memanjang saat melayang, memipih saat injak
  p.headBob = 0.006 * Math.cos(ph * 2);
  applyPose(h.parts);
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
  const p = resetPose();
  p.spine = 0.12 + 0.2 * k; p.head = -0.1;
  p.hipL = -amp * sw + 0.1; p.hipR = amp * sw + 0.1;
  p.kneeL = Math.max(0, -Math.sin(ph + 0.9)) * (1.1 + 0.6 * k);
  p.kneeR = Math.max(0, Math.sin(ph + 0.9)) * (1.1 + 0.6 * k);
  p.shL = 0.8 * sw; p.shR = -0.8 * sw; p.shLz = 0.12; p.shRz = -0.12;
  p.elL = -1.3; p.elR = -1.3;
  p.bob = 0.04 * Math.abs(Math.cos(ph));
  p.squash = SQUASH_MAX * Math.cos(ph * 2);
  p.headBob = 0.01 * Math.cos(ph * 2);
  applyPose(h.parts);
}

/**
 * Tendangan kaki kanan; phase 0..1 (0 = ancang-ancang, ~0.55 = kontak, 1 = selesai).
 * Ada lompatan kecil di sekitar kontak.
 */
export function animateKick(h, phase) {
  const ph = clamp(phase, 0, 1);
  // ayun ke belakang, lalu cepat ke depan, lalu kembali ke netral
  const swing = ph < 0.4 ? -ph / 0.4 : ph < 0.7 ? -1 + ((ph - 0.4) / 0.3) * 2 : 1 - (ph - 0.7) / 0.3;
  const hop = ph > 0.4 && ph < 0.8 ? Math.sin(((ph - 0.4) / 0.4) * Math.PI) : 0;
  const p = resetPose();
  p.spine = -0.1 * swing;
  p.hipL = 0.15 - hop * 0.3; p.kneeL = 0.2 + hop * 0.4;
  p.hipR = -swing * 1.1;                      // negatif = ke depan
  p.kneeR = swing < 0 ? -swing * 1.4 : (1 - swing) * 0.6;
  p.shL = 0.6 * swing; p.shR = -0.6 * swing; p.shLz = 0.5; p.shRz = -0.5;
  p.elL = -0.6; p.elR = -0.6;
  p.bob = hop * 0.07; p.squash = hop * SQUASH_MAX;
  applyPose(h.parts);
}

/**
 * Pose bersepeda. Kaki memakai IK 2-tulang (bidang Y-Z) agar telapak selalu
 * mengarah ke pedal; bila pedal di luar jangkauan kaki pendek, kaki diluruskan
 * ke arah pedal (clamp). Semua jarak dalam satuan model (tinggi 1.7 m).
 * @param {{parts:object}} h
 * @param {number} pedalAngle rad; 0 = pedal kiri di bawah
 * @param {{crankR?:number, bbY?:number, bbZ?:number}} [geo]
 *   posisi bottom bracket RELATIF terhadap pivot pinggul (satuan model).
 */
export function animateCycling(h, pedalAngle, geo = {}) {
  const crankR = geo.crankR ?? 0.17;
  const bbY = geo.bbY ?? -0.58;   // bottom bracket 0.58 m di bawah pinggul
  const bbZ = geo.bbZ ?? 0.28;    // dan 0.28 m di depan pinggul
  const p = resetPose();
  p.spine = 0.5; p.head = -0.45;
  p.shL = -1.05; p.shR = -1.05; p.shLz = 0.15; p.shRz = -0.15;
  p.elL = -0.35; p.elR = -0.35;
  solveLegIK(bbY - crankR * Math.cos(pedalAngle), bbZ - crankR * Math.sin(pedalAngle), 'L');
  solveLegIK(bbY + crankR * Math.cos(pedalAngle), bbZ + crankR * Math.sin(pedalAngle), 'R');
  applyPose(h.parts);
}

/** IK 2-tulang: target (dy, dz) relatif pinggul → tulis hip/knee sisi `side` ke P. */
function solveLegIK(dy, dz, side) {
  const l1 = DIM.thigh, l2 = DIM.shin;
  const d = clamp(Math.hypot(dy, dz), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const toTarget = Math.atan2(dz, -dy);                                   // sudut dari arah lurus ke bawah
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const b = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  P[`hip${side}`] = -(toTarget + a);
  P[`knee${side}`] = Math.PI - b;
}

/** Pedagang menunggu: satu tangan mengipas / melambai, tangan lain bergoyang, badan goyang. */
export function animateSellIdle(h, t) {
  const fan = Math.sin(t * 5.0);
  const sway = Math.sin(t * 0.9);
  const p = resetPose();
  p.spine = 0.03 * sway;
  p.shL = 0.12 * Math.sin(t * 2.3); p.shLz = 0.1 + 0.05 * sway;
  p.shR = -1.4; p.shRz = -0.35 - 0.15 * fan;
  p.elL = -0.2 + 0.1 * Math.sin(t * 2.3); p.elR = -1.0 + 0.2 * fan;
  p.hipLz = 0.05; p.hipRz = -0.05;
  p.bob = 0.004 * sway; p.squash = 0.006 * sway; p.headBob = 0.004 * Math.sin(t * 2.3);
  applyPose(h.parts);
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
  const p = resetPose();
  p.spine = 0.02;
  p.shLz = armsUp; p.shRz = -armsUp;
  p.elL = -0.1; p.elR = -0.1;
  p.hipLz = legsOut; p.hipRz = -legsOut;
  p.kneeL = 0.1; p.kneeR = 0.1;
  p.bob = hop; p.squash = hop * 0.5; p.headBob = hop * 0.15;
  applyPose(h.parts);
}

/** Pose skater: lutut ditekuk, badan condong, lengan ke samping untuk keseimbangan. */
export function animateSkate(h, t) {
  const push = Math.max(0, Math.sin(t * 2.2));
  const p = resetPose();
  p.spine = 0.25;
  p.hipL = -0.5; p.kneeL = 0.9;
  p.hipR = -0.5 + push * 0.9; p.kneeR = 0.9 - push * 0.6;
  p.shLz = 0.7; p.shRz = -0.7; p.shL = 0.2; p.shR = -0.2;
  p.elL = -0.4; p.elR = -0.4;
  p.bob = -0.08; p.squash = -0.015 + 0.01 * push;
  applyPose(h.parts);
}

/**
 * Ayunan raket badminton; phase 0..1 (0.5 = kontak). side = 'L' | 'R'.
 */
export function animateSwing(h, phase, side = 'R') {
  const ph = clamp(phase, 0, 1);
  const raise = Math.sin(ph * Math.PI);
  const arm = -0.6 - 2.2 * raise;
  const p = resetPose();
  p.spine = 0.1; p.hipL = -0.2; p.hipR = -0.2; p.kneeL = 0.4; p.kneeR = 0.4;
  p.shL = -0.4; p.shR = -0.4; p.shLz = 0.3; p.shRz = -0.3; p.elL = -0.8; p.elR = -0.8;
  p.bob = -0.03; p.squash = 0.01 * raise;
  if (side === 'R') { p.shR = arm; p.elR = -0.3; } else { p.shL = arm; p.elL = -0.3; }
  applyPose(h.parts);
}
