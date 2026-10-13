/**
 * Demo mandiri TimeOfDayControl: store nyata + tombol "Jalankan" yang memajukan jam
 * lewat store.set tiap 100 ms untuk menguji repaint dari luar (subscribe).
 */
import { createSettingsStore } from '../settings/store.js';
import { TimeOfDayControl } from './controls/TimeOfDay.js';

const KEY = 'sky.hour';
const TICK_MS = 100;
const STEP_HOURS = 0.1;
const HOURS = 24;

const store = createSettingsStore();
const container = { body: document.getElementById('box') };
const control = new TimeOfDayControl(container, { store, key: KEY });

const log = document.getElementById('log');
let timer = null;

store.bind(KEY, (v) => {
  log.textContent = `store ${KEY} = ${v.toFixed(2)}`;
});

document.getElementById('run').addEventListener('click', () => {
  if (timer) return;
  timer = setInterval(() => {
    const next = (store.get(KEY) + STEP_HOURS) % HOURS;
    store.set(KEY, next);
  }, TICK_MS);
});

document.getElementById('stop').addEventListener('click', () => {
  clearInterval(timer);
  timer = null;
});

// Dipakai verifikasi browser: window.__store.set('sky.hour', 12)
window.__store = store;
window.__control = control;
