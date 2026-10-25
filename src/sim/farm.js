/**
 * Logika kebun ala Harvest Moon (MURNI, immutable): petak rumput → dicangkul (atau dibajak traktor) → ditanam benih
 * jenis tertentu → disiram → tumbuh satu tahap per `growHours` jenisnya selama tersiram (lalu kering lagi) → tahap 3
 * dipanen (jenis `regrow` kembali ke tahap 2). Tabel jenis (`crops`: type → {growHours, regrow}) diberikan pemanggil
 * (config/kebun.js CROPS). Aksi E: `planAction` mencocokkan item di tangan (cangkul / benih / gembor) dengan petak, lalu
 * `actOn` mengubah petak; uang & tas diurus pemanggil. Simpanan localStorage memakai `farmToJson`/`farmFromJson`.
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

const crop = (type, stage, growth = 0) => Object.freeze({ type, stage, growth });

/**
 * Cocokkan item di tangan dengan aksi petak. Panen boleh dengan item apa pun (tangan kosong juga); cangkul butuh
 * alat cangkul, tanam butuh benih (jenis dari benih), siram butuh gembor.
 * @param {object|undefined} tile
 * @param {{kind?:string, tool?:string, crop?:string}|null} held definisi item di tangan (null = kosong)
 * @returns {{action:string|null, seed?:string, need?:'cangkul'|'benih'|'gembor'}} action null + need = item kurang
 */
export function planAction(tile, held) {
  const next = nextAction(tile);
  switch (next) {
    case 'panen': return { action: 'panen' };
    case 'cangkul': return held?.tool === 'cangkul' ? { action: 'cangkul' } : { action: null, need: 'cangkul' };
    case 'tanam': return held?.kind === 'seed' ? { action: 'tanam', seed: held.crop } : { action: null, need: 'benih' };
    case 'siram': return held?.tool === 'gembor' ? { action: 'siram' } : { action: null, need: 'gembor' };
    default: return { action: null };
  }
}

/**
 * Lakukan aksi petak i sesuai `nextAction` (pemanggil sudah memastikan item di tangan cocok lewat planAction).
 * @param {{tiles:ReadonlyArray<object>}} farm
 * @param {number} i
 * @param {{seed?:string, crops:Record<string, {growHours:number, regrow?:boolean}>}} opts seed = jenis yang ditanam
 * @returns {{farm:object, action:string|null, type:string|null, harvest:string|null, error?:string}}
 *   harvest = jenis hasil panen (masuk tas pemanggil)
 */
export function actOn(farm, i, { seed, crops }) {
  const tile = farm.tiles[i];
  const action = nextAction(tile);
  const none = { farm, action, type: tile?.crop?.type ?? null, harvest: null };
  switch (action) {
    case 'cangkul': return { ...none, farm: withTile(farm, i, { tilled: true }) };
    case 'tanam':
      if (!crops[seed]) return { ...none, error: 'Jenis benih tidak dikenal' };
      return { ...none, type: seed, farm: withTile(farm, i, { crop: crop(seed, 1), watered: false }) };
    case 'siram': return { ...none, farm: withTile(farm, i, { watered: true }) };
    case 'panen': {
      const next = crops[tile.crop.type]?.regrow ? crop(tile.crop.type, 2) : null;
      return { ...none, harvest: tile.crop.type, farm: withTile(farm, i, { crop: next, watered: false }) };
    }
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
 * Majukan waktu `hours` jam dunia: tanaman tersiram bertambah growth; mencapai `growHours` jenisnya → naik SATU tahap
 * (sisa jam dibuang) lalu kering. Kembalikan farm yang sama bila tidak ada perubahan (hemat render ulang).
 */
export function growFarm(farm, hours, crops) {
  if (!(hours > 0)) return farm;
  let changed = false;
  const tiles = farm.tiles.map((t) => {
    if (!t.crop || !t.watered || t.crop.stage >= MAX_STAGE) return t;
    changed = true;
    const growth = t.crop.growth + hours;
    if (growth < (crops[t.crop.type]?.growHours ?? Infinity)) return Object.freeze({ ...t, crop: crop(t.crop.type, t.crop.stage, growth) });
    return Object.freeze({ ...t, watered: false, crop: crop(t.crop.type, t.crop.stage + 1) });
  });
  return changed ? Object.freeze({ ...farm, tiles: Object.freeze(tiles) }) : farm;
}

/** @param {ReadonlyArray<string>} order urutan jenis (indeks disimpan) */
export function farmToJson(farm, order) {
  return JSON.stringify(farm.tiles.map((t) => [
    t.tilled ? 1 : 0, t.watered ? 1 : 0, t.crop ? t.crop.stage : 0, t.crop ? t.crop.growth : 0, t.crop ? Math.max(0, order.indexOf(t.crop.type)) : 0,
  ]));
}

/**
 * Pulihkan dari JSON (tidak percaya data: salah bentuk/ukuran → kebun baru; indeks jenis tak dikenal → order[0]).
 * Simpanan lama 4 kolom (sebelum ada jenis) dibaca sebagai order[0].
 */
export function farmFromJson(text, count, order) {
  try {
    const rows = JSON.parse(text);
    if (!Array.isArray(rows) || rows.length !== count) return createFarm(count);
    const tiles = rows.map((r) => {
      const [tilled, watered, stage, growth, typeIdx] = Array.isArray(r) ? r : [];
      const st = Number.isInteger(stage) && stage >= 1 && stage <= MAX_STAGE ? stage : 0;
      const g = Number.isFinite(growth) && growth >= 0 ? growth : 0;
      const type = order[Number.isInteger(typeIdx) ? typeIdx : 0] ?? order[0];
      return Object.freeze({ tilled: tilled === 1 || st > 0, watered: watered === 1 && st > 0, crop: st ? crop(type, st, g) : null });
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
