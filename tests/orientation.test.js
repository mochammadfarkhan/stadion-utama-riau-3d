import { describe, it, expect } from 'vitest';
import { needsRotate, requestLandscape } from '../src/ui/orientation.js';
import { menuModel } from '../src/ui/menuModel.js';

describe('needsRotate', () => {
  it('hanya perangkat sentuh dalam potret yang diminta memutar', () => {
    expect(needsRotate({ isTouch: true, width: 390, height: 844 })).toBe(true);
    expect(needsRotate({ isTouch: true, width: 844, height: 390 })).toBe(false);
    expect(needsRotate({ isTouch: false, width: 600, height: 900 })).toBe(false); // jendela desktop sempit: jangan paksa
  });
  it('persegi atau ukuran tidak valid tidak memicu', () => {
    expect(needsRotate({ isTouch: true, width: 500, height: 500 })).toBe(false);
    expect(needsRotate({ isTouch: true, width: Number.NaN, height: 800 })).toBe(false);
  });
});

describe('requestLandscape', () => {
  const doc = (over = {}) => ({ documentElement: { requestFullscreen: async () => { doc.fs = true; } }, fullscreenElement: null, ...over });
  const scr = (lock) => ({ orientation: { lock } });

  it('masuk layar penuh lalu mengunci landscape', async () => {
    const calls = [];
    const ok = await requestLandscape({ document: doc({ documentElement: { requestFullscreen: async () => calls.push('fs') } }), screen: scr(async (m) => calls.push(`lock:${m}`)) });
    expect(calls).toEqual(['fs', 'lock:landscape']);
    expect(ok).toBe(true);
  });
  it('API tidak ada (iOS Safari): tidak melempar, mengembalikan false', async () => {
    expect(await requestLandscape({ document: { documentElement: {} }, screen: {} })).toBe(false);
    expect(await requestLandscape({})).toBe(false);
  });
  it('penolakan browser ditelan (tidak melempar), hasil false', async () => {
    const env = { document: doc({ documentElement: { requestFullscreen: async () => { throw new Error('ditolak'); } } }), screen: scr(async () => { throw new Error('x'); }) };
    expect(await requestLandscape(env)).toBe(false);
  });
  it('layar penuh sudah aktif: tidak meminta ulang, tetap mengunci', async () => {
    const calls = [];
    const env = { document: { fullscreenElement: {}, documentElement: { requestFullscreen: async () => calls.push('fs') } }, screen: scr(async () => calls.push('lock')) };
    await requestLandscape(env);
    expect(calls).toEqual(['lock']);
  });
});

describe('menuModel', () => {
  it('tanpa progres: tombol utama "Mulai Petualangan", tanpa tombol ulang', () => {
    const m = menuModel({ hasProgress: false, touch: false });
    expect(m.startLabel).toBe('Mulai Petualangan');
    expect(m.showNewGame).toBe(false);
  });
  it('dengan progres: "Lanjutkan" + opsi mulai dari awal', () => {
    const m = menuModel({ hasProgress: true, touch: false });
    expect(m.startLabel).toBe('Lanjutkan');
    expect(m.showNewGame).toBe(true);
  });
  it('sentuh: petunjuk memakai kata "Ketuk" dan menyebut landscape', () => {
    const m = menuModel({ hasProgress: false, touch: true });
    expect(m.hint).toMatch(/Ketuk/);
    expect(m.hint).toMatch(/landscape/i);
    expect(menuModel({ hasProgress: false, touch: false }).hint).toMatch(/Klik/);
  });
});
