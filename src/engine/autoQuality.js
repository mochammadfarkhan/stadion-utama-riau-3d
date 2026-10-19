/**
 * Auto-turun kualitas efek layar (murni, tanpa three). Level 0 = semua efek sesuai pengaturan, 1 = tilt-shift mati,
 * 2 = tilt-shift + bloom mati. Turun satu level bila FPS (EMA) < lowFps selama lowSecs; naik satu level bila > highFps
 * selama highSecs (histeresis). Tiap kali turun, syarat naik berikutnya digandakan (maks maxHighSecs) agar efek yang
 * mahal tidak berkedip hidup-mati.
 */
import { AUTO_QUALITY } from '../config/lowpoly.js';

/** Keadaan awal. */
export function createAutoQuality(cfg = AUTO_QUALITY) {
  return Object.freeze({ level: 0, fps: 60, lowT: 0, highT: 0, highNeed: cfg.highSecs });
}

/**
 * Satu langkah (immutable). dt = selang frame nyata (detik); dt tak valid atau > 0.5 s (tab tersembunyi) diabaikan.
 * @returns {{level:number,fps:number,lowT:number,highT:number,highNeed:number}}
 */
export function stepAutoQuality(state, dt, cfg = AUTO_QUALITY) {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.5) return state;
  const alpha = 1 - Math.exp(-dt / cfg.smoothing);
  const fps = state.fps + (1 / dt - state.fps) * alpha;
  const lowT = fps < cfg.lowFps ? state.lowT + dt : 0;
  const highT = fps > cfg.highFps ? state.highT + dt : 0;
  if (lowT >= cfg.lowSecs && state.level < cfg.maxLevel) {
    return Object.freeze({ level: state.level + 1, fps, lowT: 0, highT: 0, highNeed: Math.min(cfg.maxHighSecs, state.highNeed * 2) });
  }
  if (highT >= state.highNeed && state.level > 0) {
    return Object.freeze({ level: state.level - 1, fps, lowT: 0, highT: 0, highNeed: state.highNeed });
  }
  return Object.freeze({ ...state, fps, lowT: lowT >= cfg.lowSecs ? 0 : lowT, highT });
}

/** Efek yang boleh menyala pada level ini (dan diminta pengguna). */
export function effectsAtLevel(level, wanted) {
  return { tiltShift: Boolean(wanted.tiltShift) && level < 1, bloom: Boolean(wanted.bloom) && level < 2 };
}
