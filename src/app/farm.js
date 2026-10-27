/**
 * Mini game kebun dekat sekre ERC (ala Harvest Moon) di atas inventory gaya Minecraft (app/inventory.js). Memuat GLB
 * kebun (traktor pemain, rumah, tanaman), lalu:
 * - 'kebun.trigger' (fase input, didaftarkan SEBELUM keymap agar E dikonsumsi lebih dulu), saat jalan kaki:
 *   di depan petak → E sesuai item di tangan (cangkul → cangkul, benih → tanam, gembor → siram; panen dengan apa saja,
 *   hasil masuk tas); di kotak benih → E beli 1 benih, B ganti jenis; di kotak kiriman → E kirim tumpukan hasil panen
 *   yang dipegang; di depan pintu rumah → E tidur (pagi 06.00, tanaman tersiram mendapat KEBUN.sleepHours jam tumbuh,
 *   isi kotak kiriman dibayar). Naik traktor di atas petak rumput → dibajak otomatis.
 * - 'kebun.grow' (world): tanaman tersiram tumbuh mengikuti jam dunia bila waktu berjalan (tombol T).
 * - 'kebun.fx' (world): pancuran air dari cerat gembor selama fase tuang + semburan tanah saat cangkul kena / tanam / panen.
 * - 'kebun.prompt' (ui, SESUDAH hud). Status kebun disimpan di localStorage (data dicek ulang saat dimuat).
 */
import * as THREE from 'three';
import { KEBUN, CROPS, CROP_ORDER, tileIndexAt, tileCenter, MODE_LABEL } from '../config/kebun.js';
import { ITEMS } from '../config/items.js';
import { createFarm, actOn, planAction, plow, growFarm, farmToJson, farmFromJson } from '../sim/farm.js';
import { loadModel } from '../world/assets/models.js';
import { KEBUN_MODELS, buildTractorModel, createFarmView } from '../world/props/unri/kebun.js';
import { HELD_MODELS, createHeldItemFactory } from '../world/props/unri/heldItems.js';
import { createFarmFx } from '../world/props/unri/kebunFx.js';

const STORAGE_KEY = 'stadion.kebun.v1';
const TILE_COUNT = KEBUN.cols * KEBUN.rows;
const DOOR_RADIUS = 2;
const NEED_LABEL = Object.freeze({ cangkul: 'cangkul', benih: 'benih', gembor: 'gembor' });
/** Animasi pakai item (Bicycle.useItem) per aksi petak. */
const USE_STYLE = Object.freeze({ cangkul: 'cangkul', siram: 'gembor', tanam: 'raih', panen: 'raih' });
const HELD_KEYS = Object.keys(HELD_MODELS);
const POUR = Object.freeze({ from: 0.3, to: 0.85 }); // fase animasi gembor saat air mengalir
const BURST = Object.freeze({ cangkul: 20, tanam: 6, panen: 8 }); // gumpal tanah per aksi
const rp = (n) => `Rp ${n.toLocaleString('id-ID')}`;
const lower = (type) => CROPS[type]?.label.toLowerCase() ?? '';

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

const near = (b, p, r) => Math.hypot(b.x - p.x, b.z - p.z) < r;

/**
 * @param {{app:{scene:object, addSystem:Function, removeSystem:Function}, input:{consumePress(c:string):boolean},
 *   hud:{setPrompt(t:string|null):void, toast(t:string, ok?:boolean):void, setWallet(w:object):void},
 *   ents:{bike:object, vendors:{wallet:object, credit(n:number):void, debit(n:number):boolean}},
 *   inventory:ReturnType<import('./inventory.js').setupInventory>,
 *   terrain:{heightAt(x:number,z:number):number}, time:{hour:number}, store:{set(k:string,v:unknown):void},
 *   isBlocked?:() => boolean, logger?:{error:Function}}} opts
 */
export function setupFarm({ app, input, hud, ents, inventory, terrain, time, store, isBlocked = () => false, logger = console }) {
  let farm = loadFarm();
  let view = null;
  let held = null; // pabrik model item di tangan
  let heldItem = null; // item di tangan saat ini ({object, points}) untuk titik efek
  const fx = createFarmFx({ heightAt: (x, z) => terrain.heightAt(x, z) });
  app.scene.add(fx.group);
  const tmpPos = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  let unsubscribeHeld = () => {};
  let disposed = false;
  let target = null; // {kind:'petak', index, action, seed?} | {kind:'perlu', need} | 'beli' | 'kirim' | 'tidur' | 'turun'
  let lastHour = time.hour;
  let buyType = CROP_ORDER[0]; // jenis benih di kotak benih (tombol B)
  const door = doorPoint();
  const plantTypes = Object.keys(KEBUN_MODELS.tanaman);

  Promise.all([
    loadModel(KEBUN_MODELS.traktor), loadModel(KEBUN_MODELS.rumah), loadModel(KEBUN_MODELS.tunas),
    ...HELD_KEYS.map((key) => loadModel(HELD_MODELS[key])),
    ...plantTypes.flatMap((t) => KEBUN_MODELS.tanaman[t].map((p) => loadModel(p))),
  ])
    .then(async ([traktor, rumah, tunas, ...rest]) => {
      if (disposed) return;
      const heldSources = Object.fromEntries(HELD_KEYS.map((key, i) => [key, rest[i]]));
      const stages = rest.slice(HELD_KEYS.length);
      const plantSources = Object.fromEntries(plantTypes.map((t, i) => [t, stages.slice(i * 2, i * 2 + 2)]));
      const tractor = buildTractorModel(traktor);
      const v = createFarmView({ houseSource: rumah, sproutSource: tunas, plantSources, heightAt: (x, z) => terrain.heightAt(x, z) });
      v.relayout(farm); // warna instans petak dibuat SEBELUM warmup (instanceColor mengubah varian shader)
      // Hangatkan shader SEMUA konten kebun dulu (traktor, item tangan, partikel, rumah/tanaman) agar F/E pertama
      // dan kebun yang muncul tidak membeku menunggu kompilasi (rencana performa Fase 2).
      await Promise.all([v.group, tractor.group, fx.group, ...Object.values(heldSources)].map((root) => app.warmup?.(root)));
      if (disposed) {
        v.dispose();
        return;
      }
      ents.bike.setTractorModel(tractor);
      held = createHeldItemFactory(heldSources);
      unsubscribeHeld = inventory.subscribeHeld((id, def) => {
        heldItem = held.get(id, def);
        ents.bike.setHeldItem(heldItem);
      });
      view = v;
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
  const walletChanged = () => hud.setWallet(ents.vendors.wallet);

  function buySeed() {
    const id = `benih-${buyType}`;
    if (!ents.vendors.debit(ITEMS[id].price)) return hud.toast('Uang tidak cukup untuk benih', false);
    if (inventory.add(id, 1) > 0) {
      ents.vendors.credit(ITEMS[id].price); // tas penuh: uang kembali
      return hud.toast('Tas penuh', false);
    }
    walletChanged();
    return hud.toast(`+1 ${ITEMS[id].label}`, true);
  }

  function ship() {
    const sent = inventory.shipHeld();
    if (!sent) return hud.toast('Pegang hasil panen untuk dikirim', false);
    return hud.toast(`Dikirim ${sent.n} ${lower(sent.id)} · isi kotak ${rp(inventory.boxValue)}, dibayar saat tidur`, true);
  }

  function sleep() {
    store.set('sky.hour', 6);
    lastHour = 6;
    commit(growFarm(farm, KEBUN.sleepHours, CROPS));
    const pay = inventory.payBox();
    if (pay > 0) {
      ents.vendors.credit(pay);
      walletChanged();
    }
    hud.toast(`Selamat pagi! Tanaman yang disiram tumbuh.${pay > 0 ? ` Hasil kiriman +${rp(pay)}` : ''}`, true);
  }

  /** Efek aksi petak saat ayunan kena: dihitung ulang dari keadaan kebun & tas SAAT ITU (bisa berubah selama ayunan). */
  /** Titik efek item di tangan dalam koordinat dunia (null bila item tidak punya titik itu). */
  function heldPoint(name, out) {
    const local = heldItem?.points?.[name];
    if (!local || !heldItem.object.parent) return null;
    heldItem.object.updateWorldMatrix(true, false);
    return heldItem.object.localToWorld(out.fromArray(local));
  }

  /** Semburan tanah di mata cangkul (bila ada) atau di pusat petak. */
  function soilBurst(t, action) {
    const c = tileCenter(t.index % KEBUN.cols, Math.floor(t.index / KEBUN.cols));
    const blade = action === 'cangkul' ? heldPoint('blade', tmpPos) : null;
    const p = blade ?? { x: c.x, z: c.z };
    fx.burst({ x: p.x, y: terrain.heightAt(p.x, p.z), z: p.z }, BURST[action]);
  }

  function applyWork(t) {
    const r = actOn(farm, t.index, { seed: t.seed, crops: CROPS });
    if (r.error) return hud.toast(r.error, false);
    if (r.action !== t.action) return null; // petak berubah (mis. tumbuh) selama ayunan: batalkan diam-diam
    if (r.action === 'tanam' && !inventory.remove(`benih-${t.seed}`, 1)) return hud.toast('Benih habis', false);
    if (r.harvest && inventory.add(r.harvest, 1) > 0) return hud.toast('Tas penuh: kosongkan slot dulu (I)', false);
    commit(r.farm);
    if (BURST[r.action]) soilBurst(t, r.action);
    if (r.harvest) hud.toast(`+1 ${CROPS[r.harvest].label}${CROPS[r.harvest].regrow ? ' (tumbuh lagi)' : ''}`, true);
    return null;
  }

  const workTile = (t) => ents.bike.useItem(USE_STYLE[t.action] ?? 'raih', () => applyWork(t));

  function act(t) {
    if (t === 'turun') return hud.toast(`Mode: ${MODE_LABEL[ents.bike.setMode('jalan')]}`, true);
    if (t === 'tidur') return sleep();
    if (t === 'beli') return buySeed();
    if (t === 'kirim') return ship();
    if (t.kind === 'perlu') return hud.toast(`Pegang ${NEED_LABEL[t.need]} di hotbar (1–9 / roda mouse)`, false);
    return workTile(t);
  }

  /** Sasaran di posisi pemain saat ini (null = tidak ada). */
  function findTarget(b, mode) {
    if (near(b, door, DOOR_RADIUS)) return mode === 'jalan' ? 'tidur' : 'turun';
    const under = tileIndexAt(b.x, b.z);
    if (mode === 'traktor') {
      if (under >= 0 && Math.abs(b.v) > 0.2) commit(plow(farm, under));
      return null;
    }
    if (mode !== 'jalan') return under >= 0 ? 'turun' : null;
    if (near(b, KEBUN.seedBox, KEBUN.boxRadius)) return 'beli';
    if (near(b, KEBUN.shipBox, KEBUN.boxRadius)) return 'kirim';
    const i = tileIndexAt(b.x + Math.sin(b.yaw) * KEBUN.reach, b.z + Math.cos(b.yaw) * KEBUN.reach);
    if (i < 0) return null;
    const plan = planAction(farm.tiles[i], inventory.held);
    if (plan.action) return { kind: 'petak', index: i, action: plan.action, seed: plan.seed };
    return plan.need ? { kind: 'perlu', need: plan.need } : null;
  }

  app.addSystem({
    id: 'kebun.trigger',
    phase: 'input',
    update: () => {
      target = null;
      if (!view) return;
      const b = ents.bike.state;
      view.group.visible = Math.hypot(b.x - view.center.x, b.z - view.center.z) < KEBUN.visibleRadius;
      if (!view.group.visible) return;
      view.relayout(farm); // terrain ter-stream belakangan: tata ulang tinggi bila tanah di pusat lahan berubah
      if (isBlocked()) return;
      target = findTarget(b, ents.bike.mode);
      if (target === 'beli' && input.consumePress('KeyB')) {
        buyType = CROP_ORDER[(CROP_ORDER.indexOf(buyType) + 1) % CROP_ORDER.length];
      }
      if (target && input.consumePress('KeyE') && !ents.bike.busy) act(target); // E tetap dikonsumsi selama animasi
    },
  });
  app.addSystem({
    id: 'kebun.fx',
    phase: 'world',
    update: (dt) => {
      const ph = ents.bike.usePhase;
      if (ents.bike.useStyle === 'gembor' && ph > POUR.from && ph < POUR.to && heldPoint('spout', tmpPos)) {
        tmpDir.fromArray(heldItem.points.spoutDir).transformDirection(heldItem.object.matrixWorld);
        fx.pour(tmpPos, tmpDir, dt);
      }
      fx.update(dt);
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

  function promptOf(t) {
    switch (t) {
      case 'tidur': return `Tekan E — Tidur sampai pagi${inventory.boxValue ? ` (kiriman ${rp(inventory.boxValue)} dibayar)` : ''}`;
      case 'turun': return 'Tekan E — Turun & jalan kaki (F ganti kendaraan)';
      case 'beli': {
        const c = CROPS[buyType];
        return `Tekan E — Beli benih ${lower(buyType)} ${rp(c.seed)} (panen ${rp(c.price)}${c.regrow ? ', tumbuh lagi' : ''}) · B ganti jenis`;
      }
      case 'kirim': {
        const held = inventory.held;
        return held?.kind === 'crop'
          ? `Tekan E — Kirim ${held.label.toLowerCase()} (${rp(held.sell)}/buah)`
          : `Kotak kiriman ${rp(inventory.boxValue)} · pegang hasil panen untuk mengirim`;
      }
      default: break;
    }
    if (t.kind === 'perlu') return `Pegang ${NEED_LABEL[t.need]} (hotbar 1–9 / roda mouse)`;
    const tile = farm.tiles[t.index];
    switch (t.action) {
      case 'cangkul': return 'Tekan E — Cangkul tanah';
      case 'tanam': return `Tekan E — Tanam ${lower(t.seed)}`;
      case 'siram': return `Tekan E — Siram ${lower(tile.crop?.type)}`;
      default: return `Tekan E — Panen ${lower(tile.crop?.type)}`;
    }
  }

  return {
    get farm() { return farm; },
    /** Panggil SETELAH sistem 'hud' terdaftar. */
    installPrompt() {
      app.addSystem({ id: 'kebun.prompt', phase: 'ui', update: () => { if (target) hud.setPrompt(promptOf(target)); } });
    },
    dispose() {
      disposed = true;
      app.removeSystem('kebun.trigger');
      app.removeSystem('kebun.grow');
      app.removeSystem('kebun.prompt');
      unsubscribeHeld();
      ents.bike.setHeldItem(null);
      held?.dispose();
      view?.dispose();
      app.removeSystem('kebun.fx');
      fx.dispose();
    },
  };
}
