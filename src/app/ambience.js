/**
 * Suara dunia luar ruang: suasana per kawasan (burung, angin, penonton, lalu lintas, sungai) dan suara sepeda (ban, rantai).
 * Loop dibuat malas (setelah konteks audio ada) dan levelnya diperbarui berkala, bukan tiap frame.
 * Dijeda (level 0) di mode Kota (pratinjau punya suara sendiri) dan di dalam interior.
 */
import { ambienceMix, bikeSoundLevels } from '../sim/ambienceMix.js';

const MIX_EVERY_S = 0.25;
const BIKE_EVERY_S = 0.1;
const LAYERS = Object.freeze(['birds', 'wind', 'crowd', 'traffic', 'river']);

/**
 * @param {{audioBus: object, getFocus: () => {x:number,z:number}, zoneAt: (x:number, z:number) => string, time: {hour:number},
 *   store: object, bike: object, getInput: () => object|null, isPaused: () => boolean}} deps
 */
export function createWorldSound({ audioBus, getFocus, zoneAt, time, store, bike, getInput, isPaused }) {
  let loops = null;
  let tMix = 0;
  let tBike = 0;
  const start = () => {
    if (loops || !audioBus?.context) return loops;
    loops = {
      birds: audioBus.startBirds?.(), wind: audioBus.startWind?.(), crowd: audioBus.startCrowdRoar?.(),
      traffic: audioBus.startTraffic?.(), river: audioBus.startRiver?.(),
      tyre: audioBus.startTyreRoll?.(), chain: audioBus.startChainTick?.(),
    };
    return loops;
  };
  const silence = () => { if (loops) for (const k of Object.keys(loops)) loops[k]?.setLevel(0, 0.5); };
  return {
    update(dt) {
      tMix += dt;
      tBike += dt;
      if (!start()) return;
      if (isPaused()) {
        if (tMix >= MIX_EVERY_S) { tMix = 0; silence(); }
        return;
      }
      if (tMix >= MIX_EVERY_S) {
        tMix = 0;
        const f = getFocus();
        const mix = ambienceMix({
          zone: zoneAt(f.x, f.z), hour: time.hour, raining: Boolean(store.get('weather.raining')),
          crowd: store.get('graphics.crowdDensity') ?? 0, nearRoad: 0, nearWater: 0, // [tahap 1] jalan & air belum dihitung dari data tile
        });
        for (const k of LAYERS) loops[k]?.setLevel(mix[k], 1.0);
      }
      if (tBike >= BIKE_EVERY_S) {
        tBike = 0;
        const input = getInput();
        const pedalling = Boolean(input?.isDown?.('KeyW') || input?.isDown?.('ArrowUp') || (input?.axis?.('moveY') ?? 0) > 0.05);
        const lv = bikeSoundLevels({ speed: bike.state.v, pedalling, mode: bike.mode });
        loops.tyre?.setLevel(lv.tyre, 0.15);
        loops.chain?.setLevel(lv.chain, 0.15);
      }
    },
    dispose() {
      if (loops) for (const k of Object.keys(loops)) loops[k]?.stop?.();
      loops = null;
    },
  };
}
