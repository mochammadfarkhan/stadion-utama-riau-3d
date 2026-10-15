import * as THREE from 'three';
import { App, hasWebGL } from './core/App.js';
import { Input } from './core/Input.js';
import { CameraRig } from './core/CameraRig.js';
import { createCollider } from './core/Collider.js';
import { createPovSource } from './core/povSource.js';
import { EXIT_KEY, POVS } from './core/cameraPresets.js';
import { createAudioBus } from './core/AudioBus.js';
import { routeEscape } from './core/escapeRoute.js';
import { createLighting } from './world/Lighting.js';
import { createTimeOfDay } from './world/TimeOfDay.js';
import { createWeather } from './world/Weather.js';
import { formatHour, nextPresetAfter, PRESET_HOURS } from './sim/dayCycle.js';
import { buildWorld } from './world/index.js';
import { createModelGroup, placeModels } from './world/assets/models.js';
import { LAYOUT } from './world/layout.js';
import { updateWind } from './world/shaders/windState.js';
import { buildEntities } from './entities/index.js';
import { HUD } from './ui/HUD.js';
import { createWallet } from './sim/vendorSim.js';
import { createSettingsStore } from './settings/store.js';
import { safeLocalStorage } from './settings/safeStorage.js';
import { bindAll } from './ui/bindings/index.js';
import { mountSettingsPanel } from './ui/mountSettingsPanel.js';
import { createLoadingScreen } from './ui/LoadingScreen.js';
import { StoryDirector } from './core/StoryDirector.js';
import { StoryNpcs } from './entities/StoryNpcs.js';
import { createStoryMarkers } from './world/StoryMarkers.js';
import { StoryHUD } from './ui/StoryHUD.js';
import { StoryJournal } from './ui/StoryJournal.js';

const START_POS = { x: 0, z: -275, yaw: 0 }; // plaza utara, menghadap stadion
const HOURS = 24;
const MODELS_TIMEOUT_MS = 8000;

function showFatal(msg) {
  const panel = document.querySelector('#overlay .panel');
  panel.replaceChildren(Object.assign(document.createElement('p'), { textContent: msg }));
}

async function main() {
  if (!hasWebGL()) return showFatal('Browser ini tidak mendukung WebGL. Coba Chrome/Edge terbaru.');
  const loading = createLoadingScreen();
  await loading.step(0.05, 'Menyiapkan mesin grafis…');

  const app = new App(document.getElementById('app'));
  const input = new Input();
  const hud = new HUD(document.getElementById('hud'));
  const rig = new CameraRig(app.camera, app.renderer.domElement);
  const audioBus = createAudioBus();
  const store = createSettingsStore({ storage: safeLocalStorage() });
  // Perubahan terakhir tidak boleh hilang saat tab ditutup/disembunyikan (debounce 150 ms).
  window.addEventListener('pagehide', () => store.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); });

  await loading.step(0.12, 'Menyiapkan langit dan pencahayaan…');
  const lighting = createLighting(app.scene, app.renderer);
  app.scene.add(lighting);
  app.addUpdatable({ update: (dt, ctx) => lighting.userData.update?.(dt, ctx.time, ctx.focus) });

  await loading.step(0.2, 'Membangun stadion, tribun, dan lingkungan…');
  const world = buildWorld();
  app.scene.add(world.group);
  const blenderModels = createModelGroup();
  app.scene.add(blenderModels);
  const modelsReady = loadBlenderModels(blenderModels, world.group, hud);
  app.addUpdatable({ update: (dt, ctx) => { updateWind(dt); world.update(dt, ctx.time, ctx.focus); } }); // angin global tiap frame

  await loading.step(0.55, 'Menyiapkan pemain, pelari, pedagang, dan penonton…');
  const wallet = createWallet();
  const ents = buildEntities({ start: START_POS, world, wallet });
  app.scene.add(ents.group);
  ents.bike.setCollider(createCollider(START_POS));
  rig.attachSource(createPovSource(ents));
  ents.bike.setAudioBus(audioBus);
  for (const e of ents.updatables) app.addUpdatable(e);

  await loading.step(0.8, 'Menyiapkan siklus waktu dan cuaca…');
  // Siklus waktu & cuaca: dibuat setelah dunia + entitas ada (mencari material emissive & permukaan basah).
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app);
  const weather = createWeather(app.scene, app, lighting, { audioBus });
  app.addUpdatable({ update: (dt, ctx) => time.update(dt, ctx, ents.bike.state) });
  app.addUpdatable(weather); // setelah TimeOfDay: mengalikan nilai pencahayaan frame ini

  hud.setWallet(wallet);
  hud.setCameraMode(rig.mode);
  const story = setupStory({ app, ents, hud, rig });
  const shop = setupShop(hud, ents, story);

  const bikePos = new THREE.Vector3();
  app.addUpdatable({
    update(dt, ctx) {
      handleKeys(input, { rig, hud, ents, shop, time, store, story });
      story.update(dt, { time: ctx.time, bikePos: ents.bike.state, hour: time.hour, raining: Boolean(store.get('weather.raining')) });
      rig.update(ents.bike.state, dt, ctx.time);
      hud.setCameraView(rig.mode, rig.povLabel, rig.freezesBike);
      // POV beku: sepeda berhenti seketika (bukan meluncur karena momentum)
      if (rig.freezesBike && ents.bike.state.v !== 0) ents.bike.state = { ...ents.bike.state, v: 0 };
      hud.setSpeed(ents.bike.speedKmh);
      hud.setTime(formatHour(time.hour), time.presetName, weather.weatherName);
      hud.setScore(ents.match.score);
      hud.tickFps(dt);
      updatePrompt(hud, ents, story, ents.bike.state);
      input.endFrame();
    },
  });

  // Binding store -> scene (satu sumber kebenaran). Dipasang setelah semua objek ada.
  bindAll(store, {
    app, time, lighting, weather, rig, hud, audioBus, crowd: ents.crowd, vendors: ents.vendors,
  });

  app.start((dt, t) => {
    bikePos.set(ents.bike.state.x, 0, ents.bike.state.z);
    // focus = titik pusat tampilan (sepeda, atau titik pandang saat POV); sepeda beku di POV tanpa kendali
    return { dt, time: t, bikePos, focus: rig.focus, input: hud.shopOpen || rig.freezesBike ? null : input };
  });

  setupPointerLock(app, rig, hud, store);
  await loading.step(0.9, 'Memuat model 3D (tugu, bangku)…');
  // Model 3D opsional (ada cadangan prosedural): jangan tahan tombol Mulai bila unduhan macet.
  await Promise.race([modelsReady, new Promise((resolve) => setTimeout(resolve, MODELS_TIMEOUT_MS))]);
  await loading.step(1, 'Siap!');
  loading.done();
  if (import.meta.env.DEV) exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story });
}

/** Cerita: NPC, penanda tujuan, HUD, jurnal; progres dimuat dari localStorage. */
function setupStory({ app, ents, hud, rig }) {
  const root = document.getElementById('hud');
  const npcs = new StoryNpcs();
  const markers = createStoryMarkers();
  app.scene.add(npcs.group, markers.group);
  let story = null;
  const storyHud = new StoryHUD(root, { onAdvance: () => story.advanceDialog() });
  const journal = new StoryJournal(root, { onReset: () => story.reset(), onClose: () => story.toggleJournal() });
  const pointerLock = { release: () => document.exitPointerLock?.(), request: () => rig.requestLock() };
  story = new StoryDirector({ storage: safeLocalStorage(), vendors: ents.vendors, hud, storyHud, journal, markers, pointerLock });
  ents.bike.onRing = () => story.onBell();
  story.start();
  return story;
}

/** Dialog beli: pedagang bisa berjalan menjauh saat dialog terbuka; kunci id pedagang saat dibuka. */
function setupShop(hud, ents, story) {
  const shop = { vendorId: null };
  hud.onBuy = (itemId) => {
    if (!shop.vendorId) return;
    const res = ents.vendors.tryBuy(itemId, shop.vendorId);
    hud.setWallet(ents.vendors.wallet);
    hud.toast(res.ok ? `Beli ${res.item.name} ✔` : res.error, res.ok);
    if (res.ok) story.onBought(res.item.id);
  };
  return shop;
}

/** Tombol mulai + klik kanvas mengunci pointer; panel pengaturan dipasang bila modulnya ada. */
function setupPointerLock(app, rig, hud, store) {
  document.getElementById('start').addEventListener('click', () => {
    document.getElementById('overlay').classList.add('hidden');
    rig.requestLock();
  });
  mountSettingsPanel({ store, app, rig, hud }).then(({ panel }) => {
    if (panel) return; // panel memasang handler klik kanvas sendiri (cek isPointerOverUI)
    app.renderer.domElement.addEventListener('click', () => {
      if (!hud.shopOpen) rig.requestLock();
    });
  });
}

/** Alat debug hanya di mode dev: teleport, statistik renderer, store settings. */
function exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story }) {
  window.__sim = {
    app, ents, rig, time, weather, store, audioBus, story,
    teleport(x, z, yaw = 0) {
      ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
      ents.bike.setCollider(createCollider({ x, z }));
    },
    stats: () => ({ ...app.renderer.info.render, fps: document.getElementById('hud-fps').textContent }),
  };
}

/** Hotkey lama menulis ke store (binding menerapkan ke scene). */
function handleKeys(input, { rig, hud, ents, shop, time, store, story }) {
  const toggle = (key) => store.set(key, !store.get(key));
  handleCameraKeys(input, { rig, hud, store });
  if (input.consumePress('KeyM')) toggle('performance.minimap');
  if (input.consumePress('KeyO')) toggle('graphics.ao'); // matikan AO bila FPS rendah
  handleTimeWeatherKeys(input, hud, time, store);
  if (input.consumePress('KeyJ')) story.toggleJournal();
  const escTarget = input.consumePress('Escape')
    ? routeEscape({ journalOpen: story.journal.open, shopOpen: hud.shopOpen })
    : null;
  if (escTarget === 'journal') story.toggleJournal();
  if (input.consumePress('KeyE')) {
    if (hud.shopOpen || !story.tryInteract(ents.bike.state)) handleShopKey(rig, hud, ents, shop);
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

function handleShopKey(rig, hud, ents, shop) {
  if (rig.freezesBike) return; // sepeda dibekukan di POV: tidak ada transaksi
  if (hud.shopOpen) {
    hud.closeShop();
    shop.vendorId = null;
    rig.requestLock();
  } else if (ents.vendors.promptVendor) {
    shop.vendorId = ents.vendors.promptVendor.id;
    hud.openShop(shopInfo(ents.vendors.promptVendor));
    document.exitPointerLock?.();
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

function updatePrompt(hud, ents, story, bikePos) {
  if (hud.shopOpen) return hud.setPrompt(null);
  const pv = ents.vendors.promptVendor; // satu sumber kebenaran jarak interaksi (VendorGroup)
  hud.setPrompt(story.promptFor(bikePos) ?? (pv ? `Tekan E — ${pv.name}` : null));
}

/** Bentuk data untuk dialog HUD dari info pedagang. */
function shopInfo(vendor) {
  return { name: vendor.name, items: vendor.catalog };
}

/**
 * Muat model GLB hasil Blender (LAYOUT.blenderModels) tanpa menahan start aplikasi.
 * Model yang gagal dimuat hanya dilewati; dunia prosedural tetap lengkap.
 */
async function loadBlenderModels(group, worldGroup, hud) {
  const { failed } = await placeModels(group, LAYOUT.blenderModels ?? [], { world: worldGroup });
  if (failed.length) hud.toast(`${failed.length} model 3D gagal dimuat`, false);
}

main().catch((err) => {
  console.error(err);
  document.getElementById('loading-fill')?.classList.add('failed');
  const label = document.getElementById('loading-label');
  if (label) label.textContent = 'Gagal memuat. Muat ulang halaman.';
});
