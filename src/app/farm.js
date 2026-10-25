/**
 * Mini game kebun dekat sekre ERC (ala Harvest Moon). Memuat GLB kebun (traktor pemain, rumah, tanaman), lalu:
 * - 'kebun.trigger' (fase input, didaftarkan SEBELUM keymap agar E dikonsumsi lebih dulu): jalan kaki di depan petak
 *   → E = cangkul/tanam/siram/panen; B = ganti benih yang dipegang (cabai/jagung/terong); di depan pintu rumah →
 *   E = tidur (pagi 06.00, tanaman tersiram mendapat KEBUN.sleepHours jam tumbuh); naik traktor di atas petak rumput →
 *   dibajak otomatis.
 * - 'kebun.grow' (world): tanaman tersiram tumbuh mengikuti jam dunia bila waktu berjalan (tombol T).
 * - 'kebun.prompt' (ui, SESUDAH hud): "Tekan E — …". Status kebun disimpan di localStorage (data dicek ulang saat dimuat).
 */
import { KEBUN, CROPS, CROP_ORDER, tileIndexAt, MODE_LABEL } from '../config/kebun.js';
import { createFarm, actOn, plow, growFarm, nextAction, farmToJson, farmFromJson } from '../sim/farm.js';
import { loadModel } from '../world/assets/models.js';
import { KEBUN_MODELS, buildTractorModel, createFarmView } from '../world/props/unri/kebun.js';

const STORAGE_KEY = 'stadion.kebun.v1';
const TILE_COUNT = KEBUN.cols * KEBUN.rows;
const DOOR_RADIUS = 2;
const rp = (n) => `Rp ${n.toLocaleString('id-ID')}`;
/** Teks prompt aksi petak; null = tidak ada aksi (tanaman tersiram, menunggu tumbuh). */
function actionLabel(action, tile, seed) {
  const kind = CROPS[tile?.crop?.type];
  switch (action) {
    case 'cangkul': return 'Cangkul tanah';
    case 'tanam': return `Tanam ${CROPS[seed].label.toLowerCase()} (${rp(CROPS[seed].seed)}) · B ganti benih`;
    case 'siram': return `Siram ${kind?.label.toLowerCase() ?? 'tanaman'}`;
    case 'panen': return `Panen ${kind?.label.toLowerCase() ?? ''} (${rp(kind?.price ?? 0)})`;
    default: return null;
  }
}

function loadFarm() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? farmFromJson(text, TILE_COUNT, CROP_ORDER) : createFarm(TILE_COUNT);
  } catch {
    return createFarm(TILE_COUNT);
  }
}

function saveFarm(farm) {
  try { localStorage.setItem(STORAGE_KEY, farmToJson(farm, CROP_ORDER)); } catch { /* penyimpanan diblokir: tetap main tanpa simpan */ }
}

/** Titik di depan tangga rumah (dunia). */
function doorPoint() {
  const h = KEBUN.house;
  const out = h.d / 2 + h.porch + 1.2;
  return { x: h.x + Math.sin(h.yaw) * out, z: h.z + Math.cos(h.yaw) * out };
}

/**
 * @param {{app:{scene:object, addSystem:Function, removeSystem:Function}, input:{consumePress(c:string):boolean},
 *   hud:{setPrompt(t:string|null):void, toast(t:string, ok?:boolean):void, setWallet(w:object):void},
 *   ents:{bike:object, vendors:{wallet:object, credit(n:number):void, debit(n:number):boolean}},
 *   terrain:{heightAt(x:number,z:number):number}, time:{hour:number}, store:{set(k:string,v:unknown):void},
 *   isBlocked?:() => boolean, logger?:{error:Function}}} opts
 */
export function setupFarm({ app, input, hud, ents, terrain, time, store, isBlocked = () => false, logger = console }) {
  let farm = loadFarm();
  let view = null;
  let disposed = false;
  let near = null; // {kind:'petak', index, action} | {kind:'tidur'} | {kind:'turun'}
  let lastHour = time.hour;
  let seed = CROP_ORDER[0]; // benih yang dipegang (tombol B)
  const door = doorPoint();
  const plantTypes = Object.keys(KEBUN_MODELS.tanaman);

  Promise.all([
    loadModel(KEBUN_MODELS.traktor), loadModel(KEBUN_MODELS.rumah), loadModel(KEBUN_MODELS.tunas),
    ...plantTypes.flatMap((t) => KEBUN_MODELS.tanaman[t].map((p) => loadModel(p))),
  ])
    .then(([traktor, rumah, tunas, ...stages]) => {
      if (disposed) return;
      ents.bike.setTractorModel(buildTractorModel(traktor));
      const plantSources = Object.fromEntries(plantTypes.map((t, i) => [t, stages.slice(i * 2, i * 2 + 2)]));
      view = createFarmView({ houseSource: rumah, sproutSource: tunas, plantSources, heightAt: (x, z) => terrain.heightAt(x, z) });
      view.relayout(farm);
      app.scene.add(view.group);
    })
    .catch((err) => {
      logger.error('Kebun: model gagal dimuat', err);
      hud.toast('Model kebun/traktor gagal dimuat', false);
    });

  const commit = (next) => {
    if (next === farm) return;
    farm = next;
    view?.update(farm);
    saveFarm(farm);
  };

  function act(target) {
    if (target.kind === 'turun') {
      hud.toast(`Mode: ${MODE_LABEL[ents.bike.setMode('jalan')]}`, true);
      return;
    }
    if (target.kind === 'tidur') {
      store.set('sky.hour', 6);
      lastHour = 6;
      commit(growFarm(farm, KEBUN.sleepHours, CROPS));
      hud.toast('Selamat pagi! Tanaman yang disiram tumbuh.', true);
      return;
    }
    const r = actOn(farm, target.index, { balance: ents.vendors.wallet.balance, seed, crops: CROPS });
    if (r.error) {
      hud.toast(r.error, false);
      return;
    }
    if (r.cost && !ents.vendors.debit(r.cost)) {
      hud.toast('Uang tidak cukup untuk benih', false);
      return;
    }
    if (r.earn) ents.vendors.credit(r.earn);
    if (r.cost || r.earn) hud.setWallet(ents.vendors.wallet);
    if (r.earn) hud.toast(`Panen ${CROPS[r.type]?.label.toLowerCase() ?? ''}! +${rp(r.earn)}${CROPS[r.type]?.regrow ? ' (tumbuh lagi)' : ''}`, true);
    commit(r.farm);
  }

  /** Sasaran aksi di posisi pemain saat ini (null = tidak ada). */
  function findTarget(b, mode) {
    if (Math.hypot(b.x - door.x, b.z - door.z) < DOOR_RADIUS) return mode === 'jalan' ? { kind: 'tidur' } : { kind: 'turun' };
    const under = tileIndexAt(b.x, b.z);
    if (mode === 'traktor') {
      if (under >= 0 && Math.abs(b.v) > 0.2) commit(plow(farm, under));
      return null;
    }
    if (mode !== 'jalan') return under >= 0 ? { kind: 'turun' } : null;
    const i = tileIndexAt(b.x + Math.sin(b.yaw) * KEBUN.reach, b.z + Math.cos(b.yaw) * KEBUN.reach);
    if (i < 0) return null;
    const action = nextAction(farm.tiles[i]);
    return actionLabel(action, farm.tiles[i], seed) ? { kind: 'petak', index: i, action } : null;
  }

  app.addSystem({
    id: 'kebun.trigger',
    phase: 'input',
    update: () => {
      near = null;
      if (!view) return;
      const b = ents.bike.state;
      view.group.visible = Math.hypot(b.x - view.center.x, b.z - view.center.z) < KEBUN.visibleRadius;
      if (!view.group.visible) return;
      view.relayout(farm); // terrain ter-stream belakangan: tata ulang tinggi bila tanah di pusat lahan berubah
      if (isBlocked()) return;
      if (input.consumePress('KeyB')) {
        seed = CROP_ORDER[(CROP_ORDER.indexOf(seed) + 1) % CROP_ORDER.length];
        const c = CROPS[seed];
        hud.toast(`Benih: ${c.label} (${rp(c.seed)} → panen ${rp(c.price)}${c.regrow ? ', tumbuh lagi' : ''})`, true);
      }
      near = findTarget(b, ents.bike.mode);
      if (near && input.consumePress('KeyE')) act(near);
    },
  });
  app.addSystem({
    id: 'kebun.grow',
    phase: 'world',
    update: () => {
      const h = time.hour;
      const dh = (h - lastHour + 24) % 24;
      lastHour = h;
      if (dh > 0 && dh < 6) commit(growFarm(farm, dh, CROPS)); // lompatan besar (atur jam manual) diabaikan
    },
  });

  const promptOf = (t) => {
    if (t.kind === 'tidur') return 'Tekan E — Tidur sampai pagi';
    if (t.kind === 'turun') return 'Tekan E — Turun & jalan kaki (F ganti kendaraan)';
    return `Tekan E — ${actionLabel(t.action, farm.tiles[t.index], seed)}`;
  };
  return {
    get farm() { return farm; },
    get seed() { return seed; },
    /** Panggil SETELAH sistem 'hud' terdaftar. */
    installPrompt() {
      app.addSystem({ id: 'kebun.prompt', phase: 'ui', update: () => { if (near) hud.setPrompt(promptOf(near)); } });
    },
    dispose() {
      disposed = true;
      app.removeSystem('kebun.trigger');
      app.removeSystem('kebun.grow');
      app.removeSystem('kebun.prompt');
      view?.dispose();
    },
  };
}
