/**
 * StoryDirector: menjembatani dunia 3D dan mesin cerita murni. Mengirim event
 * (posisi, pembelian, interaksi, putaran, easter egg), menerapkan efek (hadiah,
 * toast, barang diantar, simpan), dan menggambar HUD/jurnal/penanda.
 * M0 multi-region: bekerja di koordinat DUNIA. Titik data cerita adalah titik ber-region
 * (story/points.js; tanpa `region` = 'stadion') yang di-resolve sekali lewat `frameOf(regionId)`
 * (story/storyWorld.js). Pedagang tetap entitas region stadion (koordinat lokal) dan dikonversi di batas.
 */
import { CHAPTERS, STORY_NPCS } from '../story/chapters.js';
import { EASTER_EGGS, EGG_IDS } from '../story/easterEggs.js';
import { createEggState, stepEggs, EGG_ANCHORS } from '../story/eggTriggers.js';
import { loadStory, saveStory, SAVE_VERSION } from '../story/storage.js';
import { resolvePoint } from '../story/points.js';
import { resolveAnchors, resolveChapters, resolveEggs, resolveNpcs } from '../story/storyWorld.js';
import { createStory } from '../sim/story/reducer.js';
import { fundsShortfall } from '../story/funds.js';
import { createLapTracker, stepLap } from '../sim/story/lapTracker.js';
import { pointOnLane, laneLength } from '../sim/trackPath.js';
import { VENDOR_CATALOG, createWallet } from '../sim/vendorSim.js';
import { VENDOR } from '../config/constants.js';
import { IDENTITY_FRAME } from '../geo/regionTransform.js';

const NPC_RANGE = 4;
const LAP_LANE = 4;          // lane tengah: radius cek menutup semua lane
const LAP_CHECKPOINTS = 8;
const LAP_RADIUS = 9;
const FUNDS_CHECK_SEC = 1;   // seberapa sering saldo dicek terhadap langkah beli/antar
const PROGRESS_KEYS = ['chapter', 'step', 'badges', 'eggs', 'bestLap', 'rupiah', 'finished'];
const ITEM_IDS = Object.values(VENDOR_CATALOG).flat().map((i) => i.id);
const STADION_REGION = 'stadion'; // pemilik pedagang & lintasan atletik (entitas region-lokal)

const LIMITS = Object.freeze({
  chapters: CHAPTERS.length, steps: CHAPTERS.map((c) => c.steps.length), eggIds: EGG_IDS,
  startBalance: VENDOR.startBalance, itemIds: ITEM_IDS,
});

/** Checkpoint lintasan (lokal stadion) → dunia; cadangan = koordinat lokal bila stadion tak terdaftar. */
function lapCheckpoints(frameOf) {
  const len = laneLength(LAP_LANE);
  return Array.from({ length: LAP_CHECKPOINTS }, (_, i) => {
    const p = pointOnLane(LAP_LANE, (i / LAP_CHECKPOINTS) * len);
    return resolvePoint({ region: STADION_REGION, x: p.x, z: p.z }, frameOf) ?? { x: p.x, z: p.z };
  });
}

export class StoryDirector {
  /**
   * HUD tidak diimpor/dipegang langsung: efek toast & dompet dikirim lewat callback (core tidak bergantung ui).
   * @param {{storage:object, vendors:object, storyHud:object, journal:object, markers:object,
   *   onToast?:(text:string, ok:boolean)=>void, onWalletChange?:(wallet:object)=>void,
   *   pointerLock?:{release:()=>void, request:()=>void},
   *   frameOf?:(regionId:string)=>object|null, placeOf?:()=>({region:string,x:number,z:number,yaw:number}|null)}} deps
   *   frameOf: frame region (regionManager.frameOf); default identitas untuk semua region (tes/perilaku lama).
   *   placeOf: tempat pemain sekarang sebagai titik ber-region; ikut disimpan di save v3.
   */
  constructor({
    storage, vendors, storyHud, journal, markers, onToast = () => {}, onWalletChange = () => {}, pointerLock = null,
    frameOf = () => IDENTITY_FRAME, placeOf = () => null,
  }) {
    this.chapters = resolveChapters(CHAPTERS, frameOf);
    this.npcs = resolveNpcs(STORY_NPCS, frameOf);
    this.eggs = resolveEggs(EASTER_EGGS, frameOf);
    this.anchors = resolveAnchors(EGG_ANCHORS, frameOf);
    this.story = createStory({ chapters: this.chapters, eggs: this.eggs });
    Object.assign(this, { storage, vendors, storyHud, journal, markers, onToast, onWalletChange, pointerLock, frameOf, placeOf });
    this.state = this.story.initial();
    this.eggState = createEggState();
    this.checkpoints = lapCheckpoints(frameOf);
    this.lap = null;
    this.bell = false;
    this.bought = null;
    this.bikePos = { x: 0, z: 0 };
    this.fundsTimer = 0;
    this.fundedStep = null; // 'chapter:step' yang sudah diberi uang saku (sekali per langkah)
    this.savedPlace = null; // tempat terakhir dari save v3 (M0: tidak dipakai untuk spawn, paritas stadion)
  }

  /** Muat progres + dompet + tempat tersimpan (save v3; v1/v2 dimigrasi). Tidak ada credit-ulang hadiah. */
  start() {
    const save = loadStory(this.storage, LIMITS);
    if (save) {
      const { wallet, version: _version, place, ...progress } = save;
      this.savedPlace = place;
      this.state = this.story.hydrate(progress);
      this.vendors.setWallet(wallet);
      this.onWalletChange(this.vendors.wallet);
    }
    this.#render();
  }

  onBell() { this.bell = true; }

  onBought(itemId) {
    this.bought = itemId;
    this.dispatch({ type: 'bought', itemId });
    this.#persist(); // dompet berubah karena belanja: simpan agar reload tidak "mengembalikan" uang
  }

  /** Simpan progres + dompet + tempat (save v3). */
  #persist() {
    saveStory(this.storage, {
      version: SAVE_VERSION,
      ...Object.fromEntries(PROGRESS_KEYS.map((k) => [k, this.state[k]])),
      wallet: this.vendors.wallet,
      place: this.placeOf() ?? null,
    });
  }

  dispatch(event) {
    const { state, effects } = this.story.reduce(this.state, event);
    if (state === this.state && !effects.length) return;
    // Waktu habis mengulang langkah (timeLeft naik lagi): tracker putaran lama tidak boleh ikut terhitung.
    if (event.type === 'tick' && state.timeLeft != null && this.state.timeLeft != null && state.timeLeft > this.state.timeLeft) this.lap = null;
    this.state = state;
    effects.forEach((e) => this.#apply(e));
    this.#render();
  }

  #apply(effect) {
    switch (effect.type) {
      case 'toast': this.onToast(effect.text, effect.ok); break;
      case 'reward':
        this.vendors.credit(effect.rupiah);
        this.onWalletChange(this.vendors.wallet);
        this.onToast(`${effect.badge ? `Lencana: ${effect.badge} · ` : ''}+Rp ${effect.rupiah.toLocaleString('id-ID')}`, true);
        break;
      case 'consumeItem':
        this.vendors.consume(effect.itemId);
        this.onWalletChange(this.vendors.wallet);
        break;
      case 'save': this.#persist(); break;
      default: break;
    }
  }

  /**
   * @param {number} dt
   * @param {{time:number, bikePos:{x:number,z:number}, hour:number, raining:boolean, paused?:boolean}} ctx
   *   bikePos: koordinat DUNIA (M0). paused: toko/POV beku, jam misi tidak berjalan (jurnal terbuka juga menjeda)
   */
  update(dt, ctx) {
    const pos = ctx.bikePos;
    this.bikePos = pos;
    this.dispatch({ type: 'position', x: pos.x, z: pos.z });
    const paused = ctx.paused || this.journal.open;
    if (this.state.timeLeft != null && !this.state.dialog && !paused) this.dispatch({ type: 'tick', dt });
    this.#ensureFunds(dt);
    this.#updateLaps(pos, ctx.time);
    this.#updateEggs(dt, ctx);
    this.markers.setTarget(this.goalPoint());
    this.markers.update(ctx.time);
  }

  /** Pengaman soft-lock: beri uang saku bila saldo tak cukup untuk langkah beli/antar saat ini. */
  #ensureFunds(dt) {
    this.fundsTimer -= dt;
    if (this.fundsTimer > 0 || this.state.finished || this.state.dialog) return;
    this.fundsTimer = FUNDS_CHECK_SEC;
    const key = `${this.state.chapter}:${this.state.step}`;
    if (this.fundedStep === key) return;
    const short = fundsShortfall(this.#step().objective, this.vendors.wallet);
    if (short <= 0) return;
    this.fundedStep = key;
    this.vendors.credit(short);
    this.onWalletChange(this.vendors.wallet);
    this.onToast(`Uang saku +Rp ${short.toLocaleString('id-ID')} untuk menyelesaikan misi`, true);
    this.#persist();
  }

  #updateLaps(pos, time) {
    const step = this.#step();
    if (this.state.finished || step.objective.type !== 'laps' || this.state.dialog) { this.lap = null; return; }
    this.lap ??= createLapTracker(this.checkpoints, LAP_RADIUS);
    const r = stepLap(this.lap, pos, time);
    this.lap = r.state;
    if (r.lapSeconds != null) this.dispatch({ type: 'lapDone', seconds: r.lapSeconds });
  }

  #updateEggs(dt, ctx) {
    const r = stepEggs(this.eggState, {
      time: ctx.time, dt, pos: ctx.bikePos, hour: ctx.hour, raining: ctx.raining, bell: this.bell, bought: this.bought,
      anchors: this.anchors,
    }, this.eggs, this.state.eggs);
    this.eggState = r.state;
    this.bell = false;
    this.bought = null;
    r.ids.forEach((id) => this.dispatch({ type: 'egg', id }));
  }

  #step() { return this.chapters[this.state.chapter].steps[this.state.step]; }

  /** Pedagang hidup di koordinat lokal region stadion: cari dari posisi lokal, kembalikan titik dunia. */
  #nearestSelling(itemId) {
    const frame = this.frameOf(STADION_REGION);
    if (!frame || frame.identity) return this.vendors.nearestSelling(itemId, this.bikePos);
    const local = frame.toLocal(this.bikePos.x, this.bikePos.z);
    const best = this.vendors.nearestSelling(itemId, local);
    return best ? frame.toWorld(best.x, best.z) : null;
  }

  /** Titik DUNIA tujuan aktif untuk penanda & minimap (null bila tidak ada). */
  goalPoint() {
    if (this.state.finished || this.state.dialog) return null;
    const o = this.#step().objective;
    if (o.type === 'goto') return o.target;
    if (o.type === 'buy') return this.#nearestSelling(o.itemId);
    if (o.type === 'deliver') {
      const carrying = this.vendors.wallet.items.some((i) => i.id === o.itemId);
      return carrying ? this.npcs.find((n) => n.id === o.npcId) ?? null : this.#nearestSelling(o.itemId);
    }
    if (o.type === 'laps') return this.checkpoints[this.lap?.next ?? 0];
    if (o.type === 'find') {
      const id = o.ids.find((i) => !this.state.progress.found.includes(i));
      return this.eggs.find((e) => e.id === id)?.at ?? null;
    }
    return null;
  }

  #nearNpc(pos) {
    return this.npcs.find((n) => Math.hypot(n.x - pos.x, n.z - pos.z) <= NPC_RANGE) ?? null;
  }

  /** Teks prompt E untuk NPC/dialog (null bila tidak ada). `pos` dunia. */
  promptFor(pos) {
    if (this.state.dialog) return 'Tekan E — lanjut';
    const npc = this.#nearNpc(pos);
    return npc ? `Tekan E — bicara dengan ${npc.name}` : null;
  }

  /** E ditekan: lanjutkan dialog atau bicara dengan NPC (`pos` dunia). @returns {boolean} true bila ditangani. */
  tryInteract(pos) {
    if (this.state.dialog) { this.dispatch({ type: 'advance' }); return true; }
    const npc = this.#nearNpc(pos);
    if (!npc) return false;
    const carrying = this.vendors.wallet.items.map((i) => i.id);
    const before = this.state;
    this.dispatch({ type: 'interacted', id: npc.id, carrying });
    if (this.state === before) this.onToast(`${npc.name}: Halo, semangat ya!`, true);
    return true;
  }

  advanceDialog() { if (this.state.dialog) this.dispatch({ type: 'advance' }); }

  /** Jurnal butuh kursor: lepas pointer lock saat dibuka, kunci lagi saat ditutup. */
  toggleJournal() {
    if (this.journal.open) {
      this.journal.hide();
      this.pointerLock?.request();
      return;
    }
    this.pointerLock?.release();
    this.journal.show(this.#journalView());
  }

  reset() {
    this.dispatch({ type: 'reset' });
    this.eggState = createEggState();
    this.fundedStep = null; // uang saku per langkah boleh diberikan lagi setelah mulai ulang
    this.fundsTimer = 0;
    this.vendors.setWallet(createWallet()); // "Mulai dari awal" = dompet awal juga
    this.onWalletChange(this.vendors.wallet);
    this.#persist();
    this.journal.hide();
    this.onToast('Cerita dimulai ulang', true);
  }

  #journalView() {
    const s = this.state;
    return {
      rank: this.story.rankOf(s), rupiah: s.rupiah, bestLap: s.bestLap,
      chapters: this.chapters.map((c, i) => ({ title: c.title, done: s.finished || i < s.chapter, current: !s.finished && i === s.chapter })),
      badges: s.badges,
      eggs: this.eggs.map((e) => ({ title: e.title, text: e.text, hint: e.hint, found: s.eggs.includes(e.id) })),
    };
  }

  #goalText() {
    const s = this.state;
    const step = this.#step();
    const o = step.objective;
    if (o.type === 'laps') return `${step.text} (${s.progress.count}/${o.count})`;
    if (o.type === 'find') return `${step.text} (${s.progress.found.length}/${o.ids.length})`;
    return step.text;
  }

  #render() {
    const s = this.state;
    this.storyHud.render({
      chapterTitle: this.chapters[s.chapter].title,
      rank: this.story.rankOf(s),
      goal: s.finished ? '' : this.#goalText(),
      timeLeft: s.timeLeft,
      dialogLine: s.dialog ? s.dialog.lines[s.dialog.index] : null,
      finished: s.finished,
    });
  }
}
