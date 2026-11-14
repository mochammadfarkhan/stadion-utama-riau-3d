// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MainMenu, CONFIRM_MS } from '../src/ui/MainMenu.js';
import { hasAnyProgress } from '../src/ui/menuModel.js';
import { createRotatePrompt } from '../src/ui/orientation.js';

function dom() {
  document.body.innerHTML = `<div id="overlay"><div class="panel"><button id="start" disabled>Memuat aset…</button>
    <button id="menu-new" class="hidden" disabled></button><button id="menu-settings" disabled></button><p id="menu-hint"></p></div></div>`;
}

describe('MainMenu', () => {
  beforeEach(dom);

  it('ready() mengaktifkan tombol dan memberi label sesuai progres', () => {
    const m = new MainMenu();
    m.ready({ hasProgress: true, touch: false });
    expect(document.getElementById('start').disabled).toBe(false);
    expect(document.getElementById('start').textContent).toBe('Lanjutkan');
    expect(document.getElementById('menu-new').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('menu-hint').textContent).toMatch(/Klik/);
  });

  it('tanpa progres: tombol "Mulai dari awal" tetap tersembunyi', () => {
    const m = new MainMenu();
    m.ready({ hasProgress: false, touch: true });
    expect(document.getElementById('start').textContent).toBe('Mulai Petualangan');
    expect(document.getElementById('menu-new').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('menu-hint').textContent).toMatch(/Ketuk/);
  });

  it('klik tombol memanggil handler masing-masing', () => {
    const m = new MainMenu();
    const calls = [];
    m.on({ start: () => calls.push('start'), newGame: () => calls.push('baru'), settings: () => calls.push('set') });
    m.ready({ hasProgress: true, touch: false });
    document.getElementById('start').click();
    document.getElementById('menu-new').click();
    document.getElementById('menu-new').click(); // konfirmasi
    document.getElementById('menu-settings').click();
    expect(calls).toEqual(['start', 'baru', 'set']);
  });

  it('hide() menutup overlay; away() menyingkirkan menu tanpa menutup overlay', () => {
    const m = new MainMenu();
    m.away(true);
    expect(document.getElementById('overlay').classList.contains('menu-away')).toBe(true);
    m.away(false);
    expect(document.getElementById('overlay').classList.contains('menu-away')).toBe(false);
    m.hide();
    expect(document.getElementById('overlay').classList.contains('hidden')).toBe(true);
  });
});

describe('createRotatePrompt', () => {
  const win = (w, h) => { const t = new EventTarget(); t.innerWidth = w; t.innerHeight = h; return t; };

  it('muncul di potret sentuh, hilang di landscape saat resize/orientationchange; dispose membersihkan', () => {
    document.body.replaceChildren();
    const w = win(390, 844);
    const p = createRotatePrompt(document.body, { isTouch: true, win: w });
    expect(p.el.classList.contains('hidden')).toBe(false);
    w.innerWidth = 844; w.innerHeight = 390;
    w.dispatchEvent(new Event('orientationchange'));
    expect(p.el.classList.contains('hidden')).toBe(true);
    p.dispose();
    expect(document.body.contains(p.el)).toBe(false);
  });

  it('bukan perangkat sentuh: tidak pernah muncul', () => {
    document.body.replaceChildren();
    const p = createRotatePrompt(document.body, { isTouch: false, win: win(500, 900) });
    expect(p.el.classList.contains('hidden')).toBe(true);
  });
});

describe('Mulai dari awal: konfirmasi dua klik', () => {
  beforeEach(dom);

  it('klik pertama hanya mengubah teks; klik kedua menjalankan; tanpa klik kedua teks kembali', () => {
    vi.useFakeTimers();
    try {
      const m = new MainMenu();
      let n = 0;
      m.on({ newGame: () => { n += 1; } });
      m.ready({ hasProgress: true, touch: false });
      const btn = document.getElementById('menu-new');
      btn.textContent = 'Mulai dari awal';
      btn.click();
      expect(n).toBe(0);
      expect(btn.textContent).toMatch(/Yakin/);
      vi.advanceTimersByTime(CONFIRM_MS + 1);
      expect(btn.textContent).toBe('Mulai dari awal');
      btn.click();
      btn.click();
      expect(n).toBe(1);
      expect(btn.textContent).toBe('Mulai dari awal');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('hasAnyProgress', () => {
  const storage = (keys) => ({ getItem: (k) => (keys.includes(k) ? '{}' : null) });
  it('cerita maju, atau kebun/tas pernah tersimpan', () => {
    expect(hasAnyProgress({ storyState: { chapter: 1, step: 0 }, storage: storage([]) })).toBe(true);
    expect(hasAnyProgress({ storyState: { chapter: 0, step: 0 }, storage: storage(['stadion.kebun.v1']) })).toBe(true);
    expect(hasAnyProgress({ storyState: { chapter: 0, step: 0 }, storage: storage([]) })).toBe(false);
    expect(hasAnyProgress({ storyState: null, storage: null })).toBe(false);
  });
});
