/**
 * Campuran suara suasana (murni): tingkat tiap lapisan 0..1 dari keadaan dunia. Dipakai app/ambience.js.
 * nearRoad / nearWater tahap pertama 0 (belum ada sumber data yang dipakai); lapisan lalu lintas & sungai baru
 * terdengar setelah keduanya dihitung dari data tile kota.
 */
const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

/** Burung: pagi (5–9) dan sore (16–18) ramai, siang separuh, malam diam. */
function birdLevel(hour) {
  const h = ((Number(hour) % 24) + 24) % 24;
  if (h >= 19 || h < 5) return 0;
  if (h < 9 || (h >= 16 && h < 19)) return 0.5;
  return 0.25;
}

/** @returns {{birds:number, wind:number, crowd:number, traffic:number, river:number}} */
export function ambienceMix({ zone, hour, raining, crowd = 0, nearRoad = 0, nearWater = 0 }) {
  const h = ((Number(hour) % 24) + 24) % 24;
  const birds = raining ? 0 : birdLevel(h) * (zone === 'kampus' ? 1.2 : 1);
  const night = h >= 22 || h < 5;
  return {
    birds: clamp01(birds),
    wind: raining ? 0.3 : 0.15,
    crowd: zone === 'stadion' ? clamp01(crowd) * 0.4 : 0,
    traffic: clamp01(nearRoad) * 0.35 * (night ? 0.5 : 1),
    river: clamp01(nearWater) * 0.3,
  };
}

/** Suara sepeda (murni): ban sebanding laju, rantai freewheel saat meluncur. */
export function bikeSoundLevels({ speed, pedalling, mode }) {
  const v = Math.abs(Number.isFinite(speed) ? speed : 0);
  return {
    tyre: mode === 'jalan' ? 0 : Math.min(1, Math.max(0, v / 9)) * 0.1,
    chain: mode === 'sepeda' && !pedalling && v > 1 ? 0.06 : 0,
  };
}
