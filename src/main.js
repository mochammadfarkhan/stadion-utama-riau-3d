import * as THREE from 'three';
import { App, hasWebGL } from './core/App.js';
import { Input } from './core/Input.js';
import { CameraRig } from './core/CameraRig.js';
import { createCollider } from './core/Collider.js';
import { createLighting } from './world/Lighting.js';
import { createTimeOfDay } from './world/TimeOfDay.js';
import { createWeather } from './world/Weather.js';
import { formatHour } from './sim/dayCycle.js';
import { buildWorld } from './world/index.js';
import { buildEntities } from './entities/index.js';
import { HUD } from './ui/HUD.js';
import { createWallet } from './sim/vendorSim.js';

const START_POS = { x: 0, z: -275, yaw: 0 }; // plaza utara, menghadap stadion

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

  const lighting = createLighting(app.scene, app.renderer);
  app.scene.add(lighting);
  app.addUpdatable({ update: (dt, ctx) => lighting.userData.update?.(dt, ctx.time, ctx.bikePos) });

  const world = buildWorld();
  app.scene.add(world.group);
  app.addUpdatable({ update: (dt, ctx) => world.update(dt, ctx.time) });

  const wallet = createWallet();
  const ents = buildEntities({ start: START_POS, world, wallet });
  app.scene.add(ents.group);
  ents.bike.setCollider(createCollider(START_POS));
  for (const e of ents.updatables) app.addUpdatable(e);

  // Siklus waktu & cuaca: dibuat setelah dunia + entitas ada (mencari material emissive & permukaan basah).
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app);
  const weather = createWeather(app.scene, app, lighting);
  app.addUpdatable({ update: (dt, ctx) => time.update(dt, ctx, ents.bike.state) });
  app.addUpdatable(weather); // setelah TimeOfDay: mengalikan nilai pencahayaan frame ini

  hud.setWallet(wallet);
  hud.setCameraMode(rig.mode);
  // Pedagang bisa berjalan menjauh saat dialog terbuka; kunci id pedagang saat dibuka.
  const shop = { vendorId: null };
  hud.onBuy = (itemId) => {
    if (!shop.vendorId) return;
    const res = ents.vendors.tryBuy(itemId, shop.vendorId);
    hud.setWallet(ents.vendors.wallet);
    hud.toast(res.ok ? `Beli ${res.item.name} ✔` : res.error, res.ok);
  };

  const bikePos = new THREE.Vector3();
  app.addUpdatable({
    update(dt, ctx) {
      handleKeys(input, rig, hud, ents, app, shop, time, weather);
      rig.update(ents.bike.state, dt);
      hud.setSpeed(ents.bike.speedKmh);
      hud.setTime(formatHour(time.hour), time.presetName, weather.weatherName);
      hud.setScore(ents.match.score);
      hud.tickFps(dt);
      updatePrompt(hud, ents, ctx);
      input.endFrame();
    },
  });

  app.start((dt, time) => {
    bikePos.set(ents.bike.state.x, 0, ents.bike.state.z);
    return { dt, time, bikePos, input: hud.shopOpen ? null : input };
  });

  document.getElementById('start').addEventListener('click', () => {
    document.getElementById('overlay').classList.add('hidden');
    rig.requestLock();
  });
  app.renderer.domElement.addEventListener('click', () => {
    if (!hud.shopOpen) rig.requestLock();
  });
  if (import.meta.env.DEV) exposeDevTools(app, ents, rig, time, weather);
}

/** Alat debug hanya di mode dev: teleport, statistik renderer, kontrol waktu & cuaca. */
function exposeDevTools(app, ents, rig, time, weather) {
  window.__sim = {
    app, ents, rig, time, weather,
    teleport(x, z, yaw = 0) {
      ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
      ents.bike.setCollider(createCollider({ x, z }));
    },
    stats: () => ({ ...app.renderer.info.render, fps: document.getElementById('hud-fps').textContent }),
  };
}

function handleKeys(input, rig, hud, ents, app, shop, time, weather) {
  if (input.consumePress('KeyV')) {
    rig.toggleMode();
    hud.setCameraMode(rig.mode);
  }
  if (input.consumePress('KeyM')) app.minimapVisible = !app.minimapVisible;
  if (input.consumePress('KeyO')) app.setAO(!app.aoEnabled); // matikan AO bila FPS rendah
  handleTimeWeatherKeys(input, hud, time, weather);
  if (input.consumePress('KeyE') || input.consumePress('Escape')) {
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
}

/** R hujan, N preset waktu berikutnya, T jalankan/hentikan jam, [ / ] mundur/maju 1 jam. */
function handleTimeWeatherKeys(input, hud, time, weather) {
  if (input.consumePress('KeyR')) hud.toast(weather.toggleRain() ? 'Hujan turun' : 'Hujan reda', true);
  if (input.consumePress('KeyN')) hud.toast(`Waktu: ${time.nextPreset()}`, true);
  if (input.consumePress('KeyT')) hud.toast(time.toggleSpeed() ? 'Jam berjalan' : 'Jam berhenti', true);
  if (input.consumePress('BracketLeft')) time.setHour(time.hour - 1);
  if (input.consumePress('BracketRight')) time.setHour(time.hour + 1);
}

function updatePrompt(hud, ents, ctx) {
  if (hud.shopOpen) return hud.setPrompt(null);
  const pv = ents.vendors.promptVendor; // satu sumber kebenaran jarak interaksi (VendorGroup)
  hud.setPrompt(pv ? `Tekan E — ${pv.name}` : null);
}

/** Bentuk data untuk dialog HUD dari info pedagang. */
function shopInfo(vendor) {
  return { name: vendor.name, items: vendor.catalog };
}

main();
