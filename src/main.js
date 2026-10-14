import * as THREE from 'three';
import { App, hasWebGL } from './core/App.js';
import { Input } from './core/Input.js';
import { CameraRig } from './core/CameraRig.js';
import { createCollider } from './core/Collider.js';
import { createPovSource } from './core/povSource.js';
import { EXIT_KEY, POVS } from './core/cameraPresets.js';
import { createAudioBus } from './core/AudioBus.js';
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

const START_POS = { x: 0, z: -275, yaw: 0 }; // plaza utara, menghadap stadion
const HOURS = 24;

function showFatal(msg) {
  const panel = document.querySelector('#overlay .panel');
  panel.replaceChildren(Object.assign(document.createElement('p'), { textContent: msg }));
}

function main() {
  if (!hasWebGL()) return showFatal('Browser ini tidak mendukung WebGL. Coba Chrome/Edge terbaru.');

  const app = new App(document.getElementById('app'));
  const input = new Input();
  const hud = new HUD(document.getElementById('hud'));
  const rig = new CameraRig(app.camera, app.renderer.domElement);
  const audioBus = createAudioBus();
  const store = createSettingsStore({ storage: safeLocalStorage() });

  const lighting = createLighting(app.scene, app.renderer);
  app.scene.add(lighting);
  app.addUpdatable({ update: (dt, ctx) => lighting.userData.update?.(dt, ctx.time, ctx.focus) });

  const world = buildWorld();
  app.scene.add(world.group);
  const blenderModels = createModelGroup();
  app.scene.add(blenderModels);
  loadBlenderModels(blenderModels, world.group, hud);
  app.addUpdatable({ update: (dt, ctx) => { updateWind(dt); world.update(dt, ctx.time, ctx.focus); } }); // angin global tiap frame

  const wallet = createWallet();
  const ents = buildEntities({ start: START_POS, world, wallet });
  app.scene.add(ents.group);
  ents.bike.setCollider(createCollider(START_POS));
  rig.attachSource(createPovSource(ents));
  ents.bike.setAudioBus(audioBus);
  for (const e of ents.updatables) app.addUpdatable(e);

  // Siklus waktu & cuaca: dibuat setelah dunia + entitas ada (mencari material emissive & permukaan basah).
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app);
  const weather = createWeather(app.scene, app, lighting, { audioBus });
  app.addUpdatable({ update: (dt, ctx) => time.update(dt, ctx, ents.bike.state) });
  app.addUpdatable(weather); // setelah TimeOfDay: mengalikan nilai pencahayaan frame ini

  hud.setWallet(wallet);
  hud.setCameraMode(rig.mode);
  const shop = setupShop(hud, ents);

  const bikePos = new THREE.Vector3();
  app.addUpdatable({
    update(dt, ctx) {
      handleKeys(input, { rig, hud, ents, shop, time, store });
      rig.update(ents.bike.state, dt, ctx.time);
      hud.setCameraView(rig.mode, rig.povLabel, rig.freezesBike);
      // POV beku: sepeda berhenti seketika (bukan meluncur karena momentum)
      if (rig.freezesBike && ents.bike.state.v !== 0) ents.bike.state = { ...ents.bike.state, v: 0 };
      hud.setSpeed(ents.bike.speedKmh);
      hud.setTime(formatHour(time.hour), time.presetName, weather.weatherName);
      hud.setScore(ents.match.score);
      hud.tickFps(dt);
      updatePrompt(hud, ents);
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
  if (import.meta.env.DEV) exposeDevTools({ app, ents, rig, time, weather, store, audioBus });
}

/** Dialog beli: pedagang bisa berjalan menjauh saat dialog terbuka; kunci id pedagang saat dibuka. */
function setupShop(hud, ents) {
  const shop = { vendorId: null };
  hud.onBuy = (itemId) => {
    if (!shop.vendorId) return;
    const res = ents.vendors.tryBuy(itemId, shop.vendorId);
    hud.setWallet(ents.vendors.wallet);
    hud.toast(res.ok ? `Beli ${res.item.name} ✔` : res.error, res.ok);
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
function exposeDevTools({ app, ents, rig, time, weather, store, audioBus }) {
  window.__sim = {
    app, ents, rig, time, weather, store, audioBus,
    teleport(x, z, yaw = 0) {
      ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
      ents.bike.setCollider(createCollider({ x, z }));
    },
    stats: () => ({ ...app.renderer.info.render, fps: document.getElementById('hud-fps').textContent }),
  };
}

/** Hotkey lama menulis ke store (binding menerapkan ke scene). */
function handleKeys(input, { rig, hud, ents, shop, time, store }) {
  const toggle = (key) => store.set(key, !store.get(key));
  handleCameraKeys(input, { rig, hud, store });
  if (input.consumePress('KeyM')) toggle('performance.minimap');
  if (input.consumePress('KeyO')) toggle('graphics.ao'); // matikan AO bila FPS rendah
  handleTimeWeatherKeys(input, hud, time, store);
  if (input.consumePress('KeyE') || input.consumePress('Escape')) handleShopKey(rig, hud, ents, shop);
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

function updatePrompt(hud, ents) {
  if (hud.shopOpen) return hud.setPrompt(null);
  const pv = ents.vendors.promptVendor; // satu sumber kebenaran jarak interaksi (VendorGroup)
  hud.setPrompt(pv ? `Tekan E — ${pv.name}` : null);
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

main();
