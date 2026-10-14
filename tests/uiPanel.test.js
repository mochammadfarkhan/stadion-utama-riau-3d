// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSettingsStore } from '../src/settings/store.js';
import { SETTINGS_SCHEMA, listFields } from '../src/settings/schema.js';
import { SettingsPanel, TAB_STORAGE_KEY } from '../src/ui/Panel.js';
import { buildSettingsPanel } from '../src/ui/buildPanel.js';
import { FOLDERS_STORAGE_KEY } from '../src/ui/Container.js';
import { parseSliderInput } from '../src/ui/controls/Slider.js';
import { h, esc, uid, clamp, isTypingTarget, callHook } from '../src/ui/dom.js';
import { icon, ICON_NAMES, ALIASES } from '../src/ui/icons.js';

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    dump: () => Object.fromEntries(map),
  };
}

function setup(seed = {}) {
  const store = createSettingsStore();
  const storage = fakeStorage(seed);
  const panel = new SettingsPanel({ store, parent: document.body, storage, refreshInterval: 0 });
  const { tabs } = buildSettingsPanel({ store, panel });
  return { store, storage, panel, tabs };
}

const press = (key, target = document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

describe('dom util', () => {
  it('h() membuat elemen dengan kelas, teks, dan atribut', () => {
    const el = h('button', 'a b', { type: 'button', text: '<x>', 'data-k': 'v', 'aria-label': 'L', hidden: false });
    expect(el.className).toBe('a b');
    expect(el.textContent).toBe('<x>');
    expect(el.dataset.k).toBe('v');
    expect(el.hasAttribute('hidden')).toBe(false);
  });
  it('esc, uid, clamp, isTypingTarget, callHook', () => {
    expect(esc('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    expect(uid('p')).not.toBe(uid('p'));
    expect(clamp(5, 0, 3)).toBe(3);
    expect(isTypingTarget(h('input'))).toBe(true);
    expect(isTypingTarget(h('div'))).toBe(false);
    expect(callHook(() => { throw new Error('x'); })).toBeUndefined();
    expect(callHook([() => 1, (a) => a + 1], 5)).toBe(6);
  });
  it('icon() mengembalikan SVG untuk semua nama & alias', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(24);
    for (const n of [...ICON_NAMES, ...Object.keys(ALIASES)]) expect(icon(n)).toContain('<svg');
    expect(icon('sun', 'k')).toContain('class="k"');
  });
});

describe('SettingsPanel + buildSettingsPanel', () => {
  let ctx;
  beforeEach(() => { ctx = setup(); });
  afterEach(() => { ctx.panel.dispose(); document.body.replaceChildren(); });

  it('jumlah kontrol = jumlah field skema; satu tab per grup', () => {
    const total = Object.values(ctx.tabs).reduce((n, t) => n + t.allControls().length, 0);
    expect(total).toBe(listFields().length);
    expect(Object.keys(ctx.tabs)).toEqual(Object.keys(SETTINGS_SCHEMA));
    expect(ctx.panel.tablist.querySelectorAll('[role=tab]').length).toBe(Object.keys(SETTINGS_SCHEMA).length);
  });

  it('store.set memperbarui aria-valuenow slider dan status modified', () => {
    const slider = ctx.tabs.camera.allControls().find((c) => c.key === 'camera.fov');
    const el = slider.el.querySelector('[role=slider]');
    expect(el.getAttribute('aria-valuenow')).toBe('60');
    ctx.store.set('camera.fov', 80);
    expect(el.getAttribute('aria-valuenow')).toBe('80');
    expect(el.getAttribute('aria-valuetext')).toBe('80 °');
    expect(slider.el.classList.contains('is-modified')).toBe(true);
    slider.reset();
    expect(ctx.store.get('camera.fov')).toBe(60);
    expect(slider.el.classList.contains('is-modified')).toBe(false);
  });

  it('keyboard slider: panah, Shift, Home/End; keyup memanggil onFinishChange', () => {
    const slider = ctx.tabs.camera.allControls().find((c) => c.key === 'camera.fov');
    let finished = 0;
    slider.onFinishChange = () => { finished += 1; };
    const el = slider.el.querySelector('[role=slider]');
    press('ArrowRight', el);
    expect(ctx.store.get('camera.fov')).toBe(61);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
    expect(ctx.store.get('camera.fov')).toBe(71);
    press('End', el);
    expect(ctx.store.get('camera.fov')).toBe(100);
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', bubbles: true }));
    expect(finished).toBe(1);
  });

  it('klik toggle mengubah store; Space juga', () => {
    const toggle = ctx.tabs.weather.allControls().find((c) => c.key === 'weather.raining');
    expect(toggle.el.getAttribute('aria-checked')).toBe('false');
    toggle.el.click();
    expect(ctx.store.get('weather.raining')).toBe(true);
    expect(toggle.el.getAttribute('aria-checked')).toBe('true');
    press(' ', toggle.el);
    expect(ctx.store.get('weather.raining')).toBe(false);
  });

  it('select segmented: klik opsi & label dari field.labels', () => {
    const sel = ctx.tabs.camera.allControls().find((c) => c.key === 'camera.mode');
    const opts = sel.el.querySelectorAll('[role=radio]');
    expect(opts[1].textContent).toBe('Orang pertama');
    opts[1].click();
    expect(ctx.store.get('camera.mode')).toBe('first');
    expect(opts[1].getAttribute('aria-checked')).toBe('true');
  });

  it('resetAll mengembalikan default semua field', () => {
    ctx.store.set('sky.hour', 3);
    ctx.store.set('graphics.ao', true);
    ctx.panel.resetAll();
    expect(ctx.store.get('sky.hour')).toBe(16.5);
    expect(ctx.store.get('graphics.ao')).toBe(false);
  });

  it('tab terpilih disimpan ke storage; folder state juga', () => {
    ctx.panel.selectTab('camera');
    expect(ctx.storage.dump()[TAB_STORAGE_KEY]).toBe('camera');
    const folder = ctx.tabs.sky.folders[0];
    folder.setOpen(false);
    expect(JSON.parse(ctx.storage.dump()[FOLDERS_STORAGE_KEY])['sky.sun']).toBe(false);
    expect(folder.body.hasAttribute('inert')).toBe(true);
  });

  it('tab & folder tersimpan dipulihkan saat dibangun ulang', () => {
    ctx.panel.dispose();
    ctx = setup({ [TAB_STORAGE_KEY]: 'audio', [FOLDERS_STORAGE_KEY]: JSON.stringify({ 'sky.sun': false }) });
    expect(ctx.panel.activeId).toBe('audio');
    expect(ctx.tabs.sky.folders[0].isOpen).toBe(false);
  });

  it('hotkey H/F1/P/Esc dan abaikan saat mengetik', () => {
    expect(ctx.panel.isOpen).toBe(false);
    press('h');
    expect(ctx.panel.isOpen).toBe(true);
    expect(ctx.panel.panel.hasAttribute('inert')).toBe(false);
    press('F1');
    expect(ctx.panel.isHelpOpen).toBe(true);
    press('Escape');
    expect(ctx.panel.isHelpOpen).toBe(false);
    press('p');
    expect(document.body.classList.contains('is-photo')).toBe(true);
    press('Escape');
    expect(ctx.panel.isPhotoMode).toBe(false);
    const input = h('input');
    document.body.append(input);
    press('h', input);
    expect(ctx.panel.isOpen).toBe(true);
  });

  it('dispose() tidak melempar dan melepas langganan store', () => {
    const slider = ctx.tabs.camera.allControls().find((c) => c.key === 'camera.fov');
    expect(() => ctx.panel.dispose()).not.toThrow();
    expect(() => ctx.panel.dispose()).not.toThrow();
    ctx.store.set('camera.fov', 90);
    expect(slider.el.querySelector('[role=slider]').getAttribute('aria-valuenow')).toBe('60');
  });
});

describe('Info & Presets & parseSliderInput', () => {
  it('Info membaca get() saat refresh; Presets menerapkan nilai dan menandai aktif', () => {
    const { panel, tabs, store } = setup();
    let n = 0;
    const info = tabs.performance.addInfo({ label: 'FPS', get: () => `${++n}` });
    expect(info.valueEl.textContent).toBe('1');
    panel.togglePanel(true);
    panel.selectTab('performance');
    const before = Number(info.valueEl.textContent);
    panel.refresh();
    expect(Number(info.valueEl.textContent)).toBe(before + 1);
    const presets = tabs.weather.addPresets({ presets: { Badai: { 'weather.raining': true, 'weather.wind': 1 } } });
    presets.apply('Badai');
    expect(store.get('weather.wind')).toBe(1);
    expect(presets.activeName()).toBe('Badai');
    expect(presets.chips.get('Badai').classList.contains('is-active')).toBe(true);
    panel.dispose();
  });
  it('parseSliderInput: jam, persen, desimal koma', () => {
    const hour = SETTINGS_SCHEMA.sky.sections.sun.fields.hour;
    const pct = SETTINGS_SCHEMA.weather.sections.rain.fields.wind;
    expect(parseSliderInput('06:30', hour)).toBe(6.5);
    expect(parseSliderInput('45%', pct)).toBe(0.45);
    expect(parseSliderInput('0,5', pct)).toBe(0.5);
    expect(parseSliderInput('abc', pct)).toBeNull();
  });
});
