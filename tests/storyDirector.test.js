import { describe, it, expect } from 'vitest';
import { StoryDirector } from '../src/core/StoryDirector.js';
import { TUGU, CHAPTERS } from '../src/story/chapters.js';
import { STORY_KEY } from '../src/story/storage.js';

function makeDeps({ balance = 50000, items = [], save = null } = {}) {
  const store = new Map(save ? [[STORY_KEY, JSON.stringify(save)]] : []);
  const log = { toasts: [], credits: [], renders: 0, targets: [] };
  const vendors = {
    wallet: { balance, items },
    credit(n) { this.wallet = { ...this.wallet, balance: this.wallet.balance + n }; log.credits.push(n); },
    consume(id) { this.wallet = { ...this.wallet, items: this.wallet.items.filter((i) => i.id !== id) }; },
    nearestSelling: () => ({ x: 5, z: 5 }),
  };
  return {
    log,
    deps: {
      storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
      vendors,
      onToast: (t, ok) => log.toasts.push([t, ok]),
      onWalletChange: () => {},
      storyHud: { render: () => { log.renders += 1; } },
      journal: { open: false, show() { this.open = true; }, hide() { this.open = false; } },
      markers: { setTarget: (p) => log.targets.push(p), update: () => {} },
    },
  };
}

const positive = (log) => log.credits.filter((n) => n > 0);
const ctx = (x, z, extra = {}) => ({ time: 0, bikePos: { x, z }, hour: 12, raining: false, ...extra });
const started = (opts) => {
  const m = makeDeps(opts);
  const d = new StoryDirector(m.deps);
  d.start();
  return { d, ...m };
};

describe('StoryDirector: alur dasar', () => {
  it('mulai di chapter 0 dengan dialog terbuka; E/klik melanjutkan; posisi di tugu menyelesaikan chapter', () => {
    const { d } = started();
    expect(d.state.chapter).toBe(0);
    expect(d.state.dialog).not.toBeNull();
    d.advanceDialog();
    d.advanceDialog();
    expect(d.state.dialog).toBeNull();
    d.update(0.016, ctx(TUGU.x, TUGU.z));
    expect(d.state.chapter).toBe(1);
  });

  it('selagi dialog terbuka, mencapai tujuan tidak menyelesaikan langkah', () => {
    const { d } = started();
    d.update(0.016, ctx(TUGU.x, TUGU.z));
    expect(d.state.chapter).toBe(0);
  });

  it('memuat progres tersimpan', () => {
    const { d } = started({ save: { version: 1, chapter: 2, step: 0, badges: ['Tamu Bertuah'], eggs: [], bestLap: null, rupiah: 100, finished: false } });
    expect(d.state.chapter).toBe(2);
    expect(d.vendors.wallet.balance).toBe(50000 + 100); // hadiah tersimpan dikreditkan ke dompet sesi
  });

  it('save rusak diabaikan (mulai dari awal)', () => {
    const m = makeDeps();
    m.deps.storage.setItem(STORY_KEY, '{bukan json');
    const d = new StoryDirector(m.deps);
    expect(() => d.start()).not.toThrow();
    expect(d.state.chapter).toBe(0);
  });
});

describe('StoryDirector: timer chapter', () => {
  const atLaps = () => started({ save: { version: 1, chapter: 3, step: 0, badges: [], eggs: [], bestLap: null, rupiah: 0, finished: false } });

  it('jalan saat bermain, berhenti saat paused (toko/POV) dan saat jurnal terbuka', () => {
    const { d } = atLaps();
    d.advanceDialog(); // pastikan tidak ada dialog; hydrate tidak membuka dialog
    const t0 = d.state.timeLeft;
    expect(t0).toBe(300);
    d.update(1, ctx(0, 0));
    expect(d.state.timeLeft).toBeCloseTo(299, 6);
    d.update(1, ctx(0, 0, { paused: true }));
    expect(d.state.timeLeft).toBeCloseTo(299, 6);
    d.journal.open = true;
    d.update(1, ctx(0, 0));
    expect(d.state.timeLeft).toBeCloseTo(299, 6);
    d.journal.open = false;
    d.update(1, ctx(0, 0));
    expect(d.state.timeLeft).toBeCloseTo(298, 6);
  });

  it('waktu habis mengulang langkah dan mereset tracker putaran', () => {
    const { d } = atLaps();
    d.update(0.1, ctx(0, 0)); // tracker putaran dibuat
    d.lap = { marker: 'lama' };
    d.dispatch({ type: 'tick', dt: 400 });
    expect(d.state.timeLeft).toBe(300);
    expect(d.lap).toBeNull();
  });
});

describe('StoryDirector: pengaman uang (soft-lock)', () => {
  const atBuy = (balance) => started({ balance, save: { version: 1, chapter: 1, step: 0, badges: [], eggs: [], bestLap: null, rupiah: 0, finished: false } });

  it('saldo kurang untuk item misi: diberi uang saku tepat selisihnya, sekali per langkah', () => {
    const { d, log } = atBuy(1000);
    d.update(1.1, ctx(0, 0));
    expect(positive(log)).toEqual([4000]); // Es Teh 5.000 − saldo 1.000
    expect(d.vendors.wallet.balance).toBe(5000);
    d.vendors.wallet = { ...d.vendors.wallet, balance: 0 }; // pemain membelanjakan lagi untuk hal lain
    d.update(1.1, ctx(0, 0));
    expect(positive(log)).toEqual([4000]); // tidak diulang pada langkah yang sama
  });

  it('saldo cukup: tidak ada uang saku', () => {
    const { d, log } = atBuy(50000);
    d.update(1.1, ctx(0, 0));
    expect(positive(log)).toEqual([]);
  });
});

describe('StoryDirector: penanda tujuan', () => {
  it('langkah beli menunjuk ke pedagang terdekat; langkah goto ke target', () => {
    const buy = started({ save: { version: 1, chapter: 1, step: 0, badges: [], eggs: [], bestLap: null, rupiah: 0, finished: false } });
    expect(buy.d.goalPoint()).toEqual({ x: 5, z: 5 });
    const goto = started();
    goto.d.advanceDialog();
    goto.d.advanceDialog();
    expect(goto.d.goalPoint()).toEqual(CHAPTERS[0].steps[0].objective.target);
  });

  it('selama dialog terbuka tidak ada penanda', () => {
    expect(started().d.goalPoint()).toBeNull();
  });
});

describe('StoryDirector: jurnal dan pointer lock', () => {
  it('membuka jurnal melepas pointer lock; menutup memintanya lagi', () => {
    const calls = [];
    const m = makeDeps();
    const d = new StoryDirector({ ...m.deps, pointerLock: { release: () => calls.push('release'), request: () => calls.push('request') } });
    d.start();
    d.toggleJournal();
    expect(d.journal.open).toBe(true);
    d.toggleJournal();
    expect(d.journal.open).toBe(false);
    expect(calls).toEqual(['release', 'request']);
  });
});
