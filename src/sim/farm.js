/**
 * Logika kebun ala Harvest Moon (MURNI, immutable): petak rumput → dicangkul (atau dibajak traktor) → ditanam benih
 * → disiram → tumbuh satu tahap per `growHours` jam dunia selama tersiram (lalu kering lagi) → tahap 3 dipanen.
 * Aksi E kontekstual memakai `actOn`; serialisasi untuk localStorage memakai `farmToJson`/`farmFromJson`.
 */

export const MAX_STAGE = 3;

const emptyTile = () => Object.freeze({ tilled: false, watered: false, crop: null });

/** @param {number} count jumlah petak */
export function createFarm(count) {
  return Object.freeze({ tiles: Object.freeze(Array.from({ length: count }, emptyTile)) });
}

function withTile(farm, i, patch) {
  const tiles = farm.tiles.slice();
  tiles[i] = Object.freeze({ ...tiles[i], ...patch });
  return Object.freeze({ ...farm, tiles: Object.freeze(tiles) });
}

/** Aksi berikutnya untuk petak (untuk prompt), tanpa mengubah apa pun. */
export function nextAction(tile) {
  if (!tile) return null;
  if (tile.crop?.stage >= MAX_STAGE) return 'panen';
  if (tile.crop) return tile.watered ? 'tunggu' : 'siram';
  return tile.tilled ? 'tanam' : 'cangkul';
}

/**
 * Lakukan aksi kontekstual di petak i.
 * @param {{tiles:ReadonlyArray<object>}} farm
 * @param {number} i
 * @param {{balance?:number, seedPrice?:number, price?:number}} [opts]
 * @returns {{farm:object, action:string|null, cost:number, earn:number, error?:string}}
 */
export function actOn(farm, i, { balance = Infinity, seedPrice = 0, price = 0 } = {}) {
  const tile = farm.tiles[i];
  const action = nextAction(tile);
  const none = { farm, action, cost: 0, earn: 0 };
  switch (action) {
    case 'cangkul': return { ...none, farm: withTile(farm, i, { tilled: true }) };
    case 'tanam':
      if (balance < seedPrice) return { ...none, error: 'Uang tidak cukup untuk benih' };
      return { ...none, cost: seedPrice, farm: withTile(farm, i, { crop: Object.freeze({ stage: 1, growth: 0 }), watered: false }) };
    case 'siram': return { ...none, farm: withTile(farm, i, { watered: true }) };
    case 'panen': return { ...none, earn: price, farm: withTile(farm, i, { crop: null, watered: false }) };
    default: return none;
  }
}

/** Bajak traktor: petak rumput kosong jadi tercangkul (petak bertanaman tidak diubah). */
export function plow(farm, i) {
  const t = farm.tiles[i];
  if (!t || t.tilled || t.crop) return farm;
  return withTile(farm, i, { tilled: true });
}

/**
 * Majukan waktu `hours` jam dunia: tanaman tersiram bertambah growth; tiap `growHours` naik satu tahap lalu kering.
 * Kembalikan farm yang sama bila tidak ada perubahan (hemat render ulang).
 */
export function growFarm(farm, hours, growHours) {
  if (!(hours > 0)) return farm;
  let changed = false;
  const tiles = farm.tiles.map((t) => {
    if (!t.crop || !t.watered || t.crop.stage >= MAX_STAGE) return t;
    changed = true;
    const growth = t.crop.growth + hours;
    if (growth < growHours) return Object.freeze({ ...t, crop: Object.freeze({ ...t.crop, growth }) });
    return Object.freeze({ ...t, watered: false, crop: Object.freeze({ stage: t.crop.stage + 1, growth: 0 }) });
  });
  return changed ? Object.freeze({ ...farm, tiles: Object.freeze(tiles) }) : farm;
}

export function farmToJson(farm) {
  return JSON.stringify(farm.tiles.map((t) => [t.tilled ? 1 : 0, t.watered ? 1 : 0, t.crop ? t.crop.stage : 0, t.crop ? t.crop.growth : 0]));
}

/** Pulihkan dari JSON (tidak percaya data: salah bentuk/ukuran → kebun baru). */
export function farmFromJson(text, count) {
  try {
    const rows = JSON.parse(text);
    if (!Array.isArray(rows) || rows.length !== count) return createFarm(count);
    const tiles = rows.map((r) => {
      const [tilled, watered, stage, growth] = Array.isArray(r) ? r : [];
      const st = Number.isInteger(stage) && stage >= 1 && stage <= MAX_STAGE ? stage : 0;
      const g = Number.isFinite(growth) && growth >= 0 ? growth : 0;
      return Object.freeze({ tilled: tilled === 1 || st > 0, watered: watered === 1 && st > 0, crop: st ? Object.freeze({ stage: st, growth: g }) : null });
    });
    return Object.freeze({ tiles: Object.freeze(tiles) });
  } catch {
    return createFarm(count);
  }
}

/**
 * Langkah jalan kaki (MURNI): A/D memutar badan di tempat, W/S maju/mundur, Shift lari; laju menuju target dengan accel.
 * State kompatibel dengan state sepeda ({x,z,yaw,v,...}); field lain disalin.
 * @param {{x:number,z:number,yaw:number,v:number}} s
 * @param {{pedal:number, steer:number, sprint:boolean}} cmd
 * @param {number} dt
 * @param {{walk:number, run:number, back:number, accel:number, turnRate:number}} cfg
 */
export function stepOnFoot(s, cmd, dt, cfg) {
  if (!(dt > 0)) return s;
  const target = cmd.pedal > 0 ? (cmd.sprint ? cfg.run : cfg.walk) * cmd.pedal : cmd.pedal < 0 ? -cfg.back : 0;
  const dv = target - s.v;
  const v = s.v + Math.sign(dv) * Math.min(Math.abs(dv), cfg.accel * dt);
  const yaw = s.yaw + cmd.steer * cfg.turnRate * dt;
  return { ...s, yaw, v, steer: 0, lean: 0, x: s.x + v * Math.sin(yaw) * dt, z: s.z + v * Math.cos(yaw) * dt };
}
