import { describe, it, expect } from 'vitest';
import { StoryDirector } from '../src/core/StoryDirector.js';
import { TUGU, CHAPTERS, STORY_NPCS } from '../src/story/chapters.js';
import { createRegionFrame } from '../src/geo/regionTransform.js';
import { STORY_KEY, STORY_BACKUP_KEY } from '../src/story/storage.js';

function makeDeps({ balance = 50000, items = [], save = null, store = null } = {}) {
  const map = store ?? new Map(save ? [[STORY_KEY, JSON.stringify(save)]] : []);
  const log = { toasts: [], credits: [], renders: 0, targets: [] };
  const vendors = {
    wallet: { balance, items },
    credit(n) { this.wallet = { ...this.wallet, balance: this.wallet.balance + n }; log.credits.push(n); },
    consume(id) { this.wallet = { ...this.wallet, items: this.wallet.items.filter((i) => i.id !== id) }; },
    setWallet(w) { this.wallet = { balance: w.balance, items: [...w.items] }; },
    nearestSelling: () => ({ x: 5, z: 5 }),
  };
  return {
    log,
    store: map,
    deps: {
      storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) },
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
  const atBuy = (balance) => started({ save: { version: 2, chapter: 1, step: 0, badges: [], eggs: [], bestLap: null, rupiah: 0, finished: false, wallet: { balance, items: [] } } });

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

describe('StoryDirector: dompet tersimpan (save v2)', () => {
  const TEH = { id: 'es-teh', name: 'Es Teh', kind: 'minuman', price: 5000 };
  const v2 = (wallet, extra = {}) => ({ version: 2, chapter: 1, step: 0, badges: [], eggs: [], bestLap: null, rupiah: 5000, finished: false, wallet, ...extra });
  const savedIn = (m) => JSON.parse(m.deps.storage.getItem(STORY_KEY));

  it('memuat dompet dari save tanpa mengkredit ulang hadiah', () => {
    const { d, log } = started({ save: v2({ balance: 1200, items: [TEH] }) });
    expect(d.vendors.wallet.balance).toBe(1200);
    expect(d.vendors.wallet.items.map((i) => i.id)).toEqual(['es-teh']);
    expect(log.credits).toEqual([]);
  });

  it('belanja tersimpan: reload tidak mengembalikan uang', () => {
    const m = makeDeps();
    const d = new StoryDirector(m.deps);
    d.start();
    d.vendors.wallet = { balance: 45000, items: [TEH] }; // hasil tryBuy di VendorGroup
    d.onBought('es-teh');
    expect(savedIn(m)).toMatchObject({ version: 3, wallet: { balance: 45000 } });
    const reload = makeDeps({ store: m.store });
    const d2 = new StoryDirector(reload.deps);
    d2.start();
    expect(d2.vendors.wallet.balance).toBe(45000);
    expect(reload.log.credits).toEqual([]);
  });

  it('uang saku (soft-lock) ikut tersimpan', () => {
    const m = makeDeps({ save: v2({ balance: 1000, items: [] }, { rupiah: 0 }) });
    const d = new StoryDirector(m.deps);
    d.start();
    d.update(1.1, ctx(0, 0));
    expect(savedIn(m).wallet.balance).toBe(5000);
  });

  it('mulai dari awal: dompet kembali ke saldo awal dan tersimpan', () => {
    const m = makeDeps({ save: v2({ balance: 1234, items: [] }) });
    const d = new StoryDirector(m.deps);
    d.start();
    d.reset();
    expect(d.vendors.wallet).toEqual({ balance: 50000, items: [] });
    expect(savedIn(m)).toMatchObject({ version: 3, chapter: 0, wallet: { balance: 50000, items: [] } });
  });

  it('mulai dari awal: uang saku langkah yang sama bisa diberikan lagi', () => {
    const { d, log } = started({ save: v2({ balance: 1000, items: [] }, { rupiah: 0 }) });
    d.update(1.1, ctx(0, 0));
    expect(positive(log)).toEqual([4000]); // langkah 1:0 (beli Es Teh 5.000)
    d.reset();
    d.advanceDialog();
    d.advanceDialog();
    d.update(0.016, ctx(TUGU.x, TUGU.z)); // selesaikan chapter 0 → kembali ke langkah 1:0
    while (d.state.dialog) d.advanceDialog();
    expect([d.state.chapter, d.state.step]).toEqual([1, 0]);
    const before = log.credits.length; // hadiah chapter 0 ikut tercatat di credits
    d.vendors.wallet = { ...d.vendors.wallet, balance: 100 };
    d.update(1.1, ctx(0, 0));
    expect(log.credits.slice(before)).toEqual([4900]);
    expect(d.vendors.wallet.balance).toBe(5000);
  });

  it('save rusak dicadangkan ke kunci .bak lalu mulai baru', () => {
    const m = makeDeps();
    m.deps.storage.setItem(STORY_KEY, '{bukan json');
    const d = new StoryDirector(m.deps);
    d.start();
    expect(m.deps.storage.getItem(STORY_BACKUP_KEY)).toBe('{bukan json');
    expect(d.state.chapter).toBe(0);
  });
});

describe('StoryDirector: koordinat dunia multi-region (M0)', () => {
  const stadion = createRegionFrame({ x: 1000, z: -200, yaw: 0.5 });
  const frameOf = (id) => (id === 'stadion' ? stadion : null);
  const startedIn = (opts, extra = {}) => {
    const m = makeDeps(opts);
    const d = new StoryDirector({ ...m.deps, frameOf, ...extra });
    d.start();
    return { d, ...m };
  };

  it('tujuan goto di-resolve ke dunia: posisi dunia tugu menyelesaikan chapter 0, posisi lokal tidak', () => {
    const { d } = startedIn();
    d.advanceDialog();
    d.advanceDialog();
    const w = stadion.toWorld(TUGU.x, TUGU.z);
    expect(d.goalPoint()).toEqual(w);
    d.update(0.016, ctx(TUGU.x, TUGU.z));
    expect(d.state.chapter).toBe(0);
    d.update(0.016, ctx(w.x, w.z));
    expect(d.state.chapter).toBe(1);
  });

  it('pedagang dicari dari posisi lokal stadion; penanda di titik dunia', () => {
    const { d } = startedIn({ save: { version: 1, chapter: 1, step: 0, badges: [], eggs: [], bestLap: null, rupiah: 0, finished: false } });
    const asked = [];
    d.vendors.nearestSelling = (_itemId, from) => { asked.push({ ...from }); return { x: 5, z: 5 }; };
    const at = stadion.toWorld(0, 10);
    d.update(0.016, ctx(at.x, at.z));
    const goal = d.goalPoint();
    const want = stadion.toWorld(5, 5);
    expect(goal.x).toBeCloseTo(want.x, 9);
    expect(goal.z).toBeCloseTo(want.z, 9);
    expect(asked.at(-1).x).toBeCloseTo(0, 9);
    expect(asked.at(-1).z).toBeCloseTo(10, 9);
  });

  it('NPC cerita ditemukan di posisi dunianya', () => {
    const { d } = startedIn();
    d.advanceDialog();
    d.advanceDialog();
    const satpam = STORY_NPCS.find((n) => n.id === 'satpam');
    const w = stadion.toWorld(satpam.x, satpam.z);
    expect(d.promptFor({ x: satpam.x, z: satpam.z })).toBeNull();
    expect(d.promptFor(w)).toMatch(/Pak Satpam/);
  });

  it('save v3 menyimpan tempat dari placeOf; tempat tersimpan dibaca sebagai savedPlace', () => {
    const place = { region: 'stadion', x: 1, z: 2, yaw: 0.5 };
    const m = makeDeps();
    const d = new StoryDirector({ ...m.deps, frameOf, placeOf: () => place });
    d.start();
    expect(d.savedPlace).toBeNull();
    d.vendors.wallet = { balance: 45000, items: [] };
    d.onBought('es-teh');
    expect(JSON.parse(m.store.get(STORY_KEY))).toMatchObject({ version: 3, place });
    const reload = makeDeps({ store: m.store });
    const d2 = new StoryDirector({ ...reload.deps, frameOf });
    d2.start();
    expect(d2.savedPlace).toEqual(place);
  });
});
