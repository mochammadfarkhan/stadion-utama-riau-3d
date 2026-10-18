/**
 * Suara sekre (spec §8.2; prosedural via AudioBus — tanpa berkas berlisensi): dengung kipas (S14 menyala),
 * gumaman obrolan (sebanding NPC yang rapat/ngobrol), hujan di atap seng (weather.intensity), genjrengan gitar
 * Karplus-Strong (NPC bergitar memainkan progresi C–G–Am–F; E pada gitar = satu genjreng), klik saklar/kipas.
 * Semua lewat kanal 'ambience' (volume "Suasana" di pengaturan). Tanpa Web Audio semuanya no-op.
 * dispose() menghentikan semua loop.
 */
export const SEKRE_CHORDS = Object.freeze({
  C: Object.freeze([130.81, 164.81, 196.0, 261.63, 329.63]),
  G: Object.freeze([98.0, 123.47, 146.83, 196.0, 246.94, 392.0]),
  Am: Object.freeze([110.0, 164.81, 220.0, 261.63, 329.63]),
  F: Object.freeze([87.31, 130.81, 174.61, 220.0, 261.63, 349.23]),
});
const PROGRESSION = Object.freeze(['C', 'G', 'Am', 'F']);
const LEVEL = Object.freeze({ fan: 0.07, rain: 0.22, murmur: 0.06, strumNpc: 0.12, click: 0.05 });
const BEAT_S = 0.55;
const STRUM_GAP_S = 0.014;

/** @param {{audioBus?: object|null}} opts */
export function createSekreAudio({ audioBus = null } = {}) {
  const bus = audioBus;
  const fan = bus?.startFanHum?.() ?? null;
  const rain = bus?.startRainOnTin?.() ?? null;
  const murmur = bus?.startMurmur?.() ?? null;
  let strumT = 0;
  let beat = 0;

  /** Genjreng satu akor (turun/naik), senar berjarak 14 ms, volume senar sedikit bervariasi (deterministik). */
  const strum = (name, { gain = 0.45, down = true } = {}) => {
    const notes = SEKRE_CHORDS[name] ?? SEKRE_CHORDS.C;
    (down ? notes : [...notes].reverse()).forEach((hz, i) => {
      bus?.pluck?.(hz, { gain: gain * (0.85 + 0.15 * (((i * 7) % 5) / 4)), at: i * STRUM_GAP_S });
    });
  };

  return {
    strum,
    click() { bus?.pluck?.(2400, { gain: LEVEL.click, seconds: 0.06 }); },
    /** @param {number} dt @param {{fanOn:boolean, rain:number, talkers:number, gitar:boolean}} s */
    update(dt, s) {
      fan?.setLevel(s.fanOn ? LEVEL.fan : 0);
      rain?.setLevel(LEVEL.rain * Math.min(1, Math.max(0, s.rain ?? 0)));
      murmur?.setLevel(LEVEL.murmur * Math.min(1, (s.talkers ?? 0) / 4));
      if (!s.gitar) {
        strumT = 0;
        return;
      }
      strumT -= Number.isFinite(dt) ? dt : 0;
      if (strumT > 0) return;
      strumT = BEAT_S;
      strum(PROGRESSION[Math.floor(beat / 4) % PROGRESSION.length], { gain: LEVEL.strumNpc, down: beat % 2 === 0 });
      beat += 1;
    },
    dispose() {
      for (const l of [fan, rain, murmur]) l?.stop?.();
    },
  };
}
