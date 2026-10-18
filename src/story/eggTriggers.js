/**
 * Pemicu easter egg (murni): menerima konteks per frame dan mengembalikan id egg yang
 * baru terpicu. State kecil (bel, pembelian, lama berdiri saat hujan) dikembalikan baru.
 * Titik jangkar pemicu khusus (satpam, tugu, tengah lapangan) region-lokal stadion; StoryDirector
 * mengirim versi dunianya lewat `ctx.anchors` (M0 multi-region). Tanpa `ctx.anchors` dipakai EGG_ANCHORS.
 */
import { STORY_NPCS, TUGU } from './chapters.js';

const BELL_COUNT = 3;
const BELL_WINDOW = 4;      // detik
const BELL_RANGE = 12;      // m dari satpam
const TEA_COUNT = 5;
const RAIN_DWELL = 5;       // detik berdiri di bawah layar tugu
const TUGU_RANGE = 14;
const CENTER = Object.freeze({ x: 0, z: 0 });
const CENTER_RANGE = 20;
const MIDNIGHT_HALF_WINDOW_H = 0.5; // ±30 menit (jam berjalan 0,25 jam/dtk: ±6 menit hanya ±0,8 dtk)
const CAMPUS_DWELL = 90;                               // detik di kampus saat siang cerah
const BLUE_SKY_HOURS = Object.freeze([10, 14]);
/** GGM way/314450943: pusat footprint lingkaran Ø ±82 m (OSM → dunia) dan cincin jalur mengitari (m). */
export const GGM_RING = Object.freeze({ x: 133.1, z: 407.4, inner: 46, outer: 120 });

const SATPAM = STORY_NPCS.find((n) => n.id === 'satpam');

/** Titik jangkar pemicu khusus (region-lokal stadion; titik ber-region tanpa `region`). */
export const EGG_ANCHORS = Object.freeze({ satpam: SATPAM, tugu: TUGU, center: CENTER });

export function createEggState() {
  return Object.freeze({ bells: Object.freeze([]), purchases: 0, rainTime: 0, campusTime: 0, ggmSweep: 0, ggmLast: null });
}

/** Sudut tersapu mengitari GGM (radian, bertanda); keluar cincin = mulai ulang. */
function stepGgm(state, pos) {
  const dx = pos.x - GGM_RING.x;
  const dz = pos.z - GGM_RING.z;
  const d = Math.hypot(dx, dz);
  if (d < GGM_RING.inner || d > GGM_RING.outer) return { ggmSweep: 0, ggmLast: null };
  const a = Math.atan2(dz, dx);
  if (state.ggmLast == null) return { ggmSweep: 0, ggmLast: a };
  const da = Math.atan2(Math.sin(a - state.ggmLast), Math.cos(a - state.ggmLast));
  return { ggmSweep: (state.ggmSweep ?? 0) + da, ggmLast: a };
}

/**
 * @param {{bells:number[],purchases:number,rainTime:number}} state
 * @param {{time:number,dt:number,pos:{x:number,z:number},hour:number,raining:boolean,bell:boolean,bought:string|null,
 *   inCampus?:boolean, anchors?:{satpam:{x:number,z:number}|null, tugu:{x:number,z:number}|null, center:{x:number,z:number}|null}}} ctx
 *   anchors: titik jangkar di frame yang sama dengan `pos` (null = jangkar tak tersedia, pemicunya mati)
 * @param {readonly object[]} eggs daftar easter egg (`at` di frame yang sama dengan `pos`)
 * @param {readonly string[]} known id yang sudah ditemukan (dilewati)
 * @returns {{state:object, ids:string[]}}
 */
export function stepEggs(state, ctx, eggs, known = []) {
  const { satpam, tugu, center } = ctx.anchors ?? EGG_ANCHORS;
  const near = (p, r) => p != null && Math.hypot(ctx.pos.x - p.x, ctx.pos.z - p.z) <= r;
  const recent = state.bells.filter((t) => ctx.time - t <= BELL_WINDOW);
  const bells = ctx.bell && near(satpam, BELL_RANGE) ? [...recent, ctx.time] : recent;
  const purchases = state.purchases + (ctx.bought === 'es-teh' ? 1 : 0);
  const rainTime = ctx.raining && near(tugu, TUGU_RANGE) ? state.rainTime + ctx.dt : 0;
  const midnight = (ctx.hour >= 24 - MIDNIGHT_HALF_WINDOW_H || ctx.hour <= MIDNIGHT_HALF_WINDOW_H) && near(center, CENTER_RANGE);
  const blue = ctx.inCampus === true && !ctx.raining && ctx.hour >= BLUE_SKY_HOURS[0] && ctx.hour < BLUE_SKY_HOURS[1];
  const campusTime = blue ? (state.campusTime ?? 0) + ctx.dt : 0;
  const ggm = stepGgm(state, ctx.pos);
  const specials = {
    'bell-satpam': bells.length >= BELL_COUNT,
    'midnight-center': midnight,
    'es-teh-5': purchases >= TEA_COUNT,
    'rain-tugu': rainTime >= RAIN_DWELL,
    'biru-langit': campusTime >= CAMPUS_DWELL,
    'ggm-putar': Math.abs(ggm.ggmSweep) >= 2 * Math.PI,
  };
  const ids = eggs
    .filter((e) => !known.includes(e.id) && ((e.at && near(e.at, e.at.radius)) || specials[e.trigger]))
    .map((e) => e.id);
  return { state: { bells, purchases, rainTime, campusTime, ...ggm }, ids };
}
