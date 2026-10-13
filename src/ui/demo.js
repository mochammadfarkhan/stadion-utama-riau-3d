/**
 * Halaman demo panel pengaturan tanpa scene 3D — hanya untuk verifikasi visual.
 * Jalankan: npx vite --port 5181 → http://localhost:5181/src/ui/demo.html
 */
import './theme.css';
import './panel.css';
import './controls.css';
import { createSettingsStore } from '../settings/store.js';
import { SettingsPanel, DEFAULT_HELP_ITEMS } from './Panel.js';
import { buildSettingsPanel } from './buildPanel.js';

const WEATHER_PRESETS = Object.freeze({
  Cerah: { 'weather.raining': false, 'sky.cloudCover': 0.2, 'sky.haze': 2 },
  Berawan: { 'weather.raining': false, 'sky.cloudCover': 0.75, 'sky.haze': 4 },
  Gerimis: { 'weather.raining': true, 'weather.intensity': 0.3, 'sky.cloudCover': 0.8 },
  Badai: { 'weather.raining': true, 'weather.intensity': 1, 'weather.wind': 0.9, 'sky.cloudCover': 1 },
});

const store = createSettingsStore({ storage: globalThis.localStorage ?? null });
const stateEl = document.getElementById('demo-state');

const panel = new SettingsPanel({
  store,
  helpItems: [
    ...DEFAULT_HELP_ITEMS,
    { group: 'Sepeda' },
    { keys: ['W', 'S'], text: 'Kayuh / rem' },
    { keys: ['A', 'D'], text: 'Belok kiri / kanan' },
    { keys: ['Space'], text: 'Bel' },
  ],
  hooks: {
    onScreenshot: () => panel.toast('Screenshot (demo) disimpan', 'ok'),
    onPanelToggle: (open) => { if (!open) panel.toast('Panel ditutup — tekan H untuk membuka', 'info'); },
  },
});

let fakeFps = 60;
buildSettingsPanel({
  store,
  panel,
  extras: {
    afterBuild(tabs) {
      tabs.weather.addPresets({ label: 'Preset cuaca', presets: WEATHER_PRESETS, icons: { Cerah: 'sun', Berawan: 'cloud', Gerimis: 'rain', Badai: 'rain' } });
      const live = tabs.performance.addFolder('Langsung', { id: 'performance.live', icon: 'gauge' });
      live.addInfo({ label: 'FPS', get: () => `${Math.round(fakeFps)}` });
      live.addInfo({ label: 'Draw call', get: () => `${120 + Math.round(fakeFps / 3)}` });
      live.addInfo({ label: 'Waktu', get: () => new Date().toLocaleTimeString('id-ID') });
      live.addButton({ label: 'Reset tab Performa', icon: 'reset', onClick: () => tabs.performance.reset() });
    },
  },
});

setInterval(() => { fakeFps = 55 + Math.random() * 10; }, 500);
store.subscribe('*', () => { stateEl.textContent = store.export(); });
stateEl.textContent = store.export();
panel.togglePanel(true);

// ekspos untuk inspeksi manual di console
globalThis.__demo = { store, panel };
