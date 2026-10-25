/**
 * Hotkey permainan (dipindah dari main.js tanpa perubahan perilaku). Hotkey menulis ke store;
 * binding (ui/bindings) yang menerapkannya ke scene.
 */
import { EXIT_KEY, POVS } from '../core/cameraPresets.js';
import { routeEscape } from '../core/escapeRoute.js';
import { nextPresetAfter, PRESET_HOURS } from '../sim/dayCycle.js';
import { handleShopKey } from './shop.js';
import { ANGLED } from '../core/cameraAngled.js';
import { MODE_LABEL } from '../config/kebun.js';

const HOURS = 24;

/** Hotkey lama menulis ke store (binding menerapkan ke scene). */
export function handleKeys(input, { rig, hud, ents, shop, time, store, story, travelMenu = null, portal = null, dt = 0 }) {
  const toggle = (key) => store.set(key, !store.get(key));
  if (portal?.busy) return; // fade masuk/keluar interior
  if (portal?.inside) { // tombol interior: sistem interior.keys di portal; di sini hanya jam/cuaca/AO
    handleTimeWeatherKeys(input, hud, time, store);
    if (input.consumePress('KeyO')) toggle('graphics.ao');
    return;
  }
  handleCameraKeys(input, { rig, hud, store, dt });
  if (input.consumePress('KeyM')) toggle('performance.minimap');
  if (input.consumePress('KeyO')) toggle('graphics.ao'); // matikan AO bila FPS rendah
  handleTimeWeatherKeys(input, hud, time, store);
  if (input.consumePress('KeyJ')) story.toggleJournal();
  if (input.consumePress('KeyF') && !rig.freezesBike) hud.toast(`Mode: ${MODE_LABEL[ents.bike.cycleMode()]}`, true); // jalan → sepeda → traktor
  if (travelMenu) handleTravelKeys(input, travelMenu); // perjalanan cepat (Stadion / Masjid Raya An-Nur)
  const escTarget = input.consumePress('Escape')
    ? routeEscape({ journalOpen: story.journal.open, shopOpen: hud.shopOpen, travelOpen: Boolean(travelMenu?.open) })
    : null;
  if (escTarget === 'journal') story.toggleJournal();
  if (escTarget === 'travel') travelMenu.hide();
  if (input.consumePress('KeyE')) {
    if (hud.shopOpen || !story.tryInteract(ents.bike.state)) handleShopKey(rig, hud, ents, shop); // cerita di koordinat dunia (M0)
  } else if (escTarget === 'shop') handleShopKey(rig, hud, ents, shop);
}

const TRAVEL_PREV = Object.freeze(['KeyW', 'ArrowUp', 'KeyA', 'ArrowLeft']);
const TRAVEL_NEXT = Object.freeze(['KeyS', 'ArrowDown', 'KeyD', 'ArrowRight']);

/**
 * G / LB gamepad membuka-menutup panel perjalanan cepat. Saat terbuka: arah (WASD/panah, stick/D-pad
 * gamepad) ganti pilihan, Space / A konfirmasi. Esc / B menutup lewat routeEscape.
 */
function handleTravelKeys(input, travelMenu) {
  if (input.consumePress('KeyG')) travelMenu.toggle();
  if (!travelMenu.open) return;
  const pressed = (codes) => codes.reduce((hit, c) => input.consumePress(c) || hit, false);
  if (pressed(TRAVEL_PREV)) travelMenu.focusNext(-1);
  if (pressed(TRAVEL_NEXT)) travelMenu.focusNext(1);
  if (input.consumePress('Space')) travelMenu.confirm();
}

/** V: ganti mode kamera pemain, atau keluar dari POV. Digit1..7 masuk POV, Digit0 keluar. */
function handleCameraKeys(input, { rig, hud, store, dt = 0 }) {
  if (input.consumePress('KeyV')) {
    if (rig.povId) rig.exitPov();
    else store.set('camera.mode', rig.mode === 'third' ? 'first' : 'third');
  }
  if (input.consumePress('KeyC')) { // mode 3/4 dari atas: nyala/mati (kembali ke mode sebelumnya)
    if (rig.povId) rig.exitPov();
    const mode = rig.mode === 'angled' ? (rig.previousMode && rig.previousMode !== 'angled' ? rig.previousMode : 'third') : 'angled';
    store.set('camera.mode', mode);
    hud.toast(mode === 'angled' ? 'Kamera 3/4 dari atas' : 'Kamera 3/4 dimatikan', true);
  }
  if (input.consumePress('CameraCycle')) { // tombol layar / gamepad Y: third → first → angled
    if (rig.povId) rig.exitPov();
    const next = { third: 'first', first: 'angled', angled: 'third' }[rig.mode] ?? 'third';
    store.set('camera.mode', next);
  }
  if (rig.mode === 'angled' && !rig.povId && dt > 0) { // Q / Z memutar yaw kamera 3/4 (E dipakai interaksi)
    const turn = (input.isDown('KeyZ') ? 1 : 0) - (input.isDown('KeyQ') ? 1 : 0);
    if (turn) rig.rotateAngled(turn * ANGLED.yawKeyRate * dt);
  }
  if (input.consumePress('KeyL')) cycleStyle(store, hud);
  for (const code of [EXIT_KEY, ...POVS.map((p) => p.key)]) {
    if (!input.consumePress(code)) continue;
    const msg = rig.handlePovKey(code);
    if (msg) hud.toast(msg, true);
    else if (code !== EXIT_KEY) hud.toast('POV belum tersedia', false);
  }
}

const STYLE_ORDER = Object.freeze(['asli', 'kartun', 'facet']);
const STYLE_TOAST = Object.freeze({ asli: 'Gaya grafis: asli', kartun: 'Gaya grafis: kartun', facet: 'Gaya grafis: facet (low-poly)' });

/** L: siklus gaya grafis asli → kartun → facet → asli. */
function cycleStyle(store, hud) {
  const cur = STYLE_ORDER.indexOf(store.get('graphics.gayaGrafis'));
  const next = STYLE_ORDER[(cur + 1) % STYLE_ORDER.length];
  store.set('graphics.gayaGrafis', next);
  hud.toast(STYLE_TOAST[next], true);
}

/** R hujan, N preset waktu berikutnya, T jalankan/hentikan jam, [ / ] mundur/maju 1 jam. */
function handleTimeWeatherKeys(input, hud, time, store) {
  const setHour = (h) => store.set('sky.hour', ((h % HOURS) + HOURS) % HOURS);
  if (input.consumePress('KeyR')) {
    const on = !store.get('weather.raining');
    store.set('weather.raining', on);
    hud.toast(on ? 'Hujan turun' : 'Hujan reda', true);
  }
  if (input.consumePress('KeyN')) {
    const name = nextPresetAfter(time.hour);
    setHour(PRESET_HOURS[name]);
    hud.toast(`Waktu: ${name}`, true);
  }
  if (input.consumePress('KeyT')) {
    const running = !store.get('sky.advanceTime');
    store.set('sky.advanceTime', running);
    hud.toast(running ? 'Jam berjalan' : 'Jam berhenti', true);
  }
  if (input.consumePress('BracketLeft')) setHour(time.hour - 1);
  if (input.consumePress('BracketRight')) setHour(time.hour + 1);
}
