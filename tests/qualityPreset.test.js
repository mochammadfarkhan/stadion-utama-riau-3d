import { describe, it, expect } from 'vitest';
import { createSettingsStore } from '../src/settings/store.js';
import { setupQuality } from '../src/app/quality.js';
import { QUALITY_PRESETS } from '../src/config/quality.js';

/** App tiruan: renderer tanpa WebGL (nama GPU null → tebakan 'sedang'), satu sistem uji. */
function fakeApp() {
  const app = {
    renderer: { getContext() { throw new Error('tanpa WebGL'); } },
    holdRender: false,
    system: null,
    addSystem(s) { app.system = s; },
    removeSystem() { app.system = null; },
  };
  return app;
}

function setup(initial = null) {
  const store = createSettingsStore({ initial });
  const app = fakeApp();
  const toasts = [];
  const q = setupQuality({ app, store, hud: { toast: (t) => toasts.push(t) } });
  const run = (sec, frameMs) => { for (let t = 0; t < sec; t += frameMs / 1000) app.system.update(frameMs / 1000, { rawDt: frameMs / 1000 }); };
  return { store, app, toasts, q, run };
}

const matches = (store, tier) => Object.entries(QUALITY_PRESETS[tier]).every(([k, v]) => store.get(k) === v);

describe('preset kualitas (app/quality)', () => {
  it('Otomatis menerapkan tier tebakan; ubah manual → Kustom; pilih preset → nilai preset', () => {
    const { store, q } = setup();
    expect(store.get('graphics.preset')).toBe('otomatis');
    expect(q.tier).toBe('sedang');
    expect(matches(store, 'sedang')).toBe(true);
    store.set('graphics.pixelRatio', 1.5);
    expect(store.get('graphics.preset')).toBe('kustom');
    expect(store.get('graphics.pixelRatio')).toBe(1.5); // nilai pemain dipertahankan
    store.set('graphics.preset', 'rendah');
    expect(matches(store, 'rendah')).toBe(true);
    expect(store.get('graphics.preset')).toBe('rendah');
    store.set('graphics.bloom', true); // bukan nilai preset rendah
    expect(store.get('graphics.preset')).toBe('kustom');
  });

  it('Kustom tersimpan tidak ditimpa saat dimuat', () => {
    const { store } = setup({ 'graphics.preset': 'kustom', 'graphics.pixelRatio': 1.8 });
    expect(store.get('graphics.pixelRatio')).toBe(1.8);
  });

  it('uji kinerja: perangkat berat turun tier (maks 2 putaran) dengan toast; perangkat cepat tetap', () => {
    const slow = setup();
    slow.run(9, 50); // 50 ms per frame (20 FPS)
    expect(slow.q.tier).toBe('rendah');
    expect(matches(slow.store, 'rendah')).toBe(true);
    expect(slow.store.get('graphics.preset')).toBe('otomatis');
    expect(slow.toasts).toHaveLength(1);
    const fast = setup();
    fast.run(9, 16);
    fast.run(9, 16);
    expect(fast.q.tier).toBe('sedang');
    expect(fast.toasts).toHaveLength(0);
  });

  it('uji ditahan selama holdRender (layar muat) dan dibatalkan bila pemain memilih preset', () => {
    const { store, app, q, run } = setup();
    app.holdRender = true;
    run(20, 50);
    expect(q.tier).toBe('sedang');
    app.holdRender = false;
    store.set('graphics.preset', 'tinggi');
    run(20, 50);
    expect(store.get('graphics.preset')).toBe('tinggi');
    expect(matches(store, 'tinggi')).toBe(true);
  });
});
