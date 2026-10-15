/**
 * Pemicu easter egg (murni): menerima konteks per frame dan mengembalikan id egg yang
 * baru terpicu. State kecil (bel, pembelian, lama berdiri saat hujan) dikembalikan baru.
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

const SATPAM = STORY_NPCS.find((n) => n.id === 'satpam');

export function createEggState() {
  return Object.freeze({ bells: Object.freeze([]), purchases: 0, rainTime: 0 });
}

/**
 * @param {{bells:number[],purchases:number,rainTime:number}} state
 * @param {{time:number,dt:number,pos:{x:number,z:number},hour:number,raining:boolean,bell:boolean,bought:string|null}} ctx
 * @param {readonly object[]} eggs daftar easter egg
 * @param {readonly string[]} known id yang sudah ditemukan (dilewati)
 * @returns {{state:object, ids:string[]}}
 */
export function stepEggs(state, ctx, eggs, known = []) {
  const near = (p, r) => Math.hypot(ctx.pos.x - p.x, ctx.pos.z - p.z) <= r;
  const recent = state.bells.filter((t) => ctx.time - t <= BELL_WINDOW);
  const bells = ctx.bell && near(SATPAM, BELL_RANGE) ? [...recent, ctx.time] : recent;
  const purchases = state.purchases + (ctx.bought === 'es-teh' ? 1 : 0);
  const rainTime = ctx.raining && near(TUGU, TUGU_RANGE) ? state.rainTime + ctx.dt : 0;
  const midnight = (ctx.hour >= 24 - MIDNIGHT_HALF_WINDOW_H || ctx.hour <= MIDNIGHT_HALF_WINDOW_H) && near(CENTER, CENTER_RANGE);
  const specials = {
    'bell-satpam': bells.length >= BELL_COUNT,
    'midnight-center': midnight,
    'es-teh-5': purchases >= TEA_COUNT,
    'rain-tugu': rainTime >= RAIN_DWELL,
  };
  const ids = eggs
    .filter((e) => !known.includes(e.id) && ((e.at && near(e.at, e.at.radius)) || specials[e.trigger]))
    .map((e) => e.id);
  return { state: { bells, purchases, rainTime }, ids };
}
