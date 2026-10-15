/**
 * StoryDirector: menjembatani dunia 3D dan mesin cerita murni. Mengirim event
 * (posisi, pembelian, interaksi, putaran, easter egg), menerapkan efek (hadiah,
 * toast, barang diantar, simpan), dan menggambar HUD/jurnal/penanda.
 */
import { CHAPTERS, STORY_NPCS } from '../story/chapters.js';
import { EASTER_EGGS, EGG_IDS } from '../story/easterEggs.js';
import { createEggState, stepEggs } from '../story/eggTriggers.js';
import { loadStory, saveStory } from '../story/storage.js';
import { createStory } from '../sim/story/reducer.js';
import { fundsShortfall } from '../story/funds.js';
import { createLapTracker, stepLap } from '../sim/story/lapTracker.js';
import { pointOnLane, laneLength } from '../sim/trackPath.js';

const NPC_RANGE = 4;
const LAP_LANE = 4;          // lane tengah: radius cek menutup semua lane
const LAP_CHECKPOINTS = 8;
const LAP_RADIUS = 9;
const FUNDS_CHECK_SEC = 1;   // seberapa sering saldo dicek terhadap langkah beli/antar
const SAVE_KEYS = ['version', 'chapter', 'step', 'badges', 'eggs', 'bestLap', 'rupiah', 'finished'];

const LIMITS = Object.freeze({ chapters: CHAPTERS.length, steps: CHAPTERS.map((c) => c.steps.length), eggIds: EGG_IDS });

function lapCheckpoints() {
  const len = laneLength(LAP_LANE);
  return Array.from({ length: LAP_CHECKPOINTS }, (_, i) => {
    const p = pointOnLane(LAP_LANE, (i / LAP_CHECKPOINTS) * len);
    return { x: p.x, z: p.z };
  });
}

export class StoryDirector {
  /**
   * @param {{storage:object, vendors:object, hud:object, storyHud:object, journal:object, markers:object,
   *   pointerLock?:{release:()=>void, request:()=>void}}} deps
   */
  constructor({ storage, vendors, hud, storyHud, journal, markers, pointerLock = null }) {
    this.story = createStory({ chapters: CHAPTERS, eggs: EASTER_EGGS });
    Object.assign(this, { storage, vendors, hud, storyHud, journal, markers, pointerLock });
    this.state = this.story.initial();
    this.eggState = createEggState();
    this.checkpoints = lapCheckpoints();
    this.lap = null;
    this.bell = false;
    this.bought = null;
    this.bikePos = { x: 0, z: 0 };
    this.fundsTimer = 0;
    this.fundedStep = null; // 'chapter:step' yang sudah diberi uang saku (sekali per langkah)
  }

  /** Muat progres tersimpan; hadiah yang sudah dikumpulkan ditambahkan ke dompet sesi ini. */
  start() {
    const save = loadStory(this.storage, LIMITS);
    if (save) {
      this.state = this.story.hydrate(save);
      this.vendors.credit(this.state.rupiah);
      this.hud.setWallet(this.vendors.wallet);
    }
    this.#render();
  }

  onBell() { this.bell = true; }

  onBought(itemId) {
    this.bought = itemId;
    this.dispatch({ type: 'bought', itemId });
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
      case 'toast': this.hud.toast(effect.text, effect.ok); break;
      case 'reward':
        this.vendors.credit(effect.rupiah);
        this.hud.setWallet(this.vendors.wallet);
        this.hud.toast(`${effect.badge ? `Lencana: ${effect.badge} · ` : ''}+Rp ${effect.rupiah.toLocaleString('id-ID')}`, true);
        break;
      case 'consumeItem':
        this.vendors.consume(effect.itemId);
        this.hud.setWallet(this.vendors.wallet);
        break;
      case 'save': saveStory(this.storage, Object.fromEntries(SAVE_KEYS.map((k) => [k, this.state[k]]))); break;
      default: break;
    }
  }

  /**
   * @param {number} dt
   * @param {{time:number, bikePos:{x:number,z:number}, hour:number, raining:boolean, paused?:boolean}} ctx
   *   paused: toko/POV beku, jam misi tidak berjalan (jurnal terbuka juga menjeda)
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
    this.hud.setWallet(this.vendors.wallet);
    this.hud.toast(`Uang saku +Rp ${short.toLocaleString('id-ID')} untuk menyelesaikan misi`, true);
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
    }, EASTER_EGGS, this.state.eggs);
    this.eggState = r.state;
    this.bell = false;
    this.bought = null;
    r.ids.forEach((id) => this.dispatch({ type: 'egg', id }));
  }

  #step() { return CHAPTERS[this.state.chapter].steps[this.state.step]; }

  /** Titik dunia tujuan aktif untuk penanda (null bila tidak ada). */
  goalPoint() {
    if (this.state.finished || this.state.dialog) return null;
    const o = this.#step().objective;
    if (o.type === 'goto') return o.target;
    if (o.type === 'buy') return this.vendors.nearestSelling(o.itemId, this.bikePos);
    if (o.type === 'deliver') {
      const carrying = this.vendors.wallet.items.some((i) => i.id === o.itemId);
      return carrying ? STORY_NPCS.find((n) => n.id === o.npcId) ?? null : this.vendors.nearestSelling(o.itemId, this.bikePos);
    }
    if (o.type === 'laps') return this.checkpoints[this.lap?.next ?? 0];
    if (o.type === 'find') {
      const id = o.ids.find((i) => !this.state.progress.found.includes(i));
      return EASTER_EGGS.find((e) => e.id === id)?.at ?? null;
    }
    return null;
  }

  #nearNpc(pos) {
    return STORY_NPCS.find((n) => Math.hypot(n.x - pos.x, n.z - pos.z) <= NPC_RANGE) ?? null;
  }

  /** Teks prompt E untuk NPC/dialog (null bila tidak ada). */
  promptFor(pos) {
    if (this.state.dialog) return 'Tekan E — lanjut';
    const npc = this.#nearNpc(pos);
    return npc ? `Tekan E — bicara dengan ${npc.name}` : null;
  }

  /** E ditekan: lanjutkan dialog atau bicara dengan NPC. @returns {boolean} true bila ditangani. */
  tryInteract(pos) {
    if (this.state.dialog) { this.dispatch({ type: 'advance' }); return true; }
    const npc = this.#nearNpc(pos);
    if (!npc) return false;
    const carrying = this.vendors.wallet.items.map((i) => i.id);
    const before = this.state;
    this.dispatch({ type: 'interacted', id: npc.id, carrying });
    if (this.state === before) this.hud.toast(`${npc.name}: Halo, semangat ya!`, true);
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
    this.journal.hide();
    this.hud.toast('Cerita dimulai ulang', true);
  }

  #journalView() {
    const s = this.state;
    return {
      rank: this.story.rankOf(s), rupiah: s.rupiah, bestLap: s.bestLap,
      chapters: CHAPTERS.map((c, i) => ({ title: c.title, done: s.finished || i < s.chapter, current: !s.finished && i === s.chapter })),
      badges: s.badges,
      eggs: EASTER_EGGS.map((e) => ({ title: e.title, text: e.text, hint: e.hint, found: s.eggs.includes(e.id) })),
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
      chapterTitle: CHAPTERS[s.chapter].title,
      rank: this.story.rankOf(s),
      goal: s.finished ? '' : this.#goalText(),
      timeLeft: s.timeLeft,
      dialogLine: s.dialog ? s.dialog.lines[s.dialog.index] : null,
      finished: s.finished,
    });
  }
}
