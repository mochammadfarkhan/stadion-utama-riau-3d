/**
 * Blocking aktor reels (murni): urutan aksi → keyframe posisi [x,z], arah hadap (yaw), segmen pose, dan selang jalan.
 *   langkah: [{t, jalan:[[x,z],...], kecepatan?}, {t, hadap: yaw | [x,z] titik, durasi?}, {t, pose}]
 * Konvensi yaw = rotation.y Humanoid: arah hadap di bidang XZ = (sin yaw, cos yaw). Saat mulai tiap ruas jalan aktor
 * memutar badan ke arah ruas (maks. BELOK detik); putaran selalu lewat sisi terdekat.
 */
import { keyframes, segmentAt } from './timeline.js';

const TAU = Math.PI * 2;
export const KECEPATAN = 1.1; // m/s, cocok dengan animateWalk (1 siklus langkah per detik)
const BELOK = 0.3;

/** Yaw agar menghadap dari titik a ke titik b ([x,z]). */
export const yawTo = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);

/** Sudut setara `to` yang paling dekat dengan `from` (tanpa berputar > 180°). */
export function nearestAngle(from, to) {
  const d = ((((to - from) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
  return from + d;
}

/**
 * @param {{di:number[], hadap?:number, pose?:string, langkah?:object[]}} def
 * @returns {{pos:(t:number)=>number[], yaw:(t:number)=>number, pose:(t:number)=>string, berjalan:(t:number)=>boolean, selesai:number}}
 */
export function compileBlocking({ di, hadap = 0, pose = 'berdiri', langkah = [] }) {
  let pos = di;
  let yaw = hadap;
  let sibukSampai = 0;
  const posKeys = [{ t: 0, v: di }];
  const yawKeys = [{ t: 0, v: hadap }];
  const poses = [{ t: 0, id: pose }];
  const walks = [];
  for (const s of [...langkah].sort((a, b) => a.t - b.t)) {
    if (s.t < sibukSampai - 1e-6) throw new RangeError(`blocking: aksi ${s.t}s dimulai sebelum aksi sebelumnya selesai (${sibukSampai.toFixed(2)}s)`);
    if (s.pose) poses.push({ t: s.t, id: s.pose });
    if (s.jalan) {
      const v = s.kecepatan ?? KECEPATAN;
      let t = s.t;
      posKeys.push({ t, v: pos, ease: 'linear' });
      yawKeys.push({ t, v: yaw, ease: 'linear' });
      for (const p of s.jalan) {
        const dur = Math.hypot(p[0] - pos[0], p[1] - pos[1]) / v;
        if (dur < 1e-6) continue;
        yaw = nearestAngle(yaw, yawTo(pos, p));
        yawKeys.push({ t: t + Math.min(BELOK, dur / 2), v: yaw, ease: 'inOut' });
        t += dur;
        pos = p;
        posKeys.push({ t, v: pos, ease: 'linear' });
        yawKeys.push({ t, v: yaw, ease: 'linear' });
      }
      walks.push([s.t, t]);
      sibukSampai = t;
    } else if (s.hadap !== undefined) {
      const dur = s.durasi ?? 0.6;
      const goal = nearestAngle(yaw, Array.isArray(s.hadap) ? yawTo(pos, s.hadap) : s.hadap);
      yawKeys.push({ t: s.t, v: yaw, ease: 'linear' }, { t: s.t + dur, v: goal, ease: 'inOut' });
      yaw = goal;
      sibukSampai = s.t + dur;
    }
  }
  return {
    pos: keyframes(posKeys),
    yaw: keyframes(yawKeys),
    pose: (t) => segmentAt(poses, t).id,
    berjalan: (t) => walks.some(([a, b]) => t >= a && t < b),
    selesai: sibukSampai,
  };
}
