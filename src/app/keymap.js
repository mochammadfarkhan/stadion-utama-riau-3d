/**
 * Hotkey permainan (dipindah dari main.js tanpa perubahan perilaku). Hotkey menulis ke store;
 * binding (ui/bindings) yang menerapkannya ke scene.
 */
import { EXIT_KEY, POVS } from '../core/cameraPresets.js';
import { routeEscape } from '../core/escapeRoute.js';
import { nextPresetAfter, PRESET_HOURS } from '../sim/dayCycle.js';
import { handleShopKey } from './shop.js';
import { pointToLocal } from './regionContext.js';

const HOURS = 24;

/** Hotkey lama menulis ke store (binding menerapkan ke scene). */
export function handleKeys(input, { rig, hud, ents, shop, time, store, story, frame, travelMenu = null }) {
  const toggle = (key) => store.set(key, !store.get(key));
  handleCameraKeys(input, { rig, hud, store });
  if (input.consumePress('KeyM')) toggle('performance.minimap');
  if (input.consumePress('KeyO')) toggle('graphics.ao'); // matikan AO bila FPS rendah
  handleTimeWeatherKeys(input, hud, time, store);
  if (input.consumePress('KeyJ')) story.toggleJournal();
  if (input.consumePress('KeyG')) travelMenu?.toggle(); // perjalanan cepat (Stadion / Masjid Raya An-Nur)
  const escTarget = input.consumePress('Escape')
    ? routeEscape({ journalOpen: story.journal.open, shopOpen: hud.shopOpen })
    : null;
  if (escTarget === 'journal') story.toggleJournal();
  if (input.consumePress('KeyE')) {
    if (hud.shopOpen || !story.tryInteract(pointToLocal(frame, ents.bike.state))) handleShopKey(rig, hud, ents, shop); // cerita region-lokal
  } else if (escTarget === 'shop') handleShopKey(rig, hud, ents, shop);
}

/** V: ganti mode kamera pemain, atau keluar dari POV. Digit1..7 masuk POV, Digit0 keluar. */
function handleCameraKeys(input, { rig, hud, store }) {
  if (input.consumePress('KeyV')) {
    if (rig.povId) rig.exitPov();
    else store.set('camera.mode', rig.mode === 'third' ? 'first' : 'third');
  }
  for (const code of [EXIT_KEY, ...POVS.map((p) => p.key)]) {
    if (!input.consumePress(code)) continue;
    const msg = rig.handlePovKey(code);
    if (msg) hud.toast(msg, true);
    else if (code !== EXIT_KEY) hud.toast('POV belum tersedia', false);
  }
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
