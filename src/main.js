import * as THREE from 'three';
import { App, hasWebGL } from './core/App.js';
import { Input } from './core/Input.js';
import { CameraRig } from './core/CameraRig.js';
import { createCollider } from './core/Collider.js';
import { createLighting } from './world/Lighting.js';
import { buildWorld } from './world/index.js';
import { buildEntities } from './entities/index.js';
import { HUD } from './ui/HUD.js';
import { createWallet } from './sim/vendorSim.js';

const START_POS = { x: 0, z: -275, yaw: 0 }; // plaza utara, menghadap stadion
const INTERACT_DIST = 3.5;

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

  let wallet = createWallet();
  const ents = buildEntities({ start: START_POS, world, wallet });
  app.scene.add(ents.group);
  ents.bike.setCollider(createCollider(START_POS));
  for (const e of ents.updatables) app.addUpdatable(e);

  hud.setWallet(wallet);
  hud.setCameraMode(rig.mode);
  // Pedagang bisa berjalan menjauh saat dialog terbuka; kunci id pedagang saat dibuka.
  const shop = { vendorId: null };
  hud.onBuy = (itemId) => {
    if (!shop.vendorId) return;
    const res = ents.vendors.tryBuy(itemId, shop.vendorId);
    wallet = res.wallet;
    hud.setWallet(wallet);
    hud.toast(res.ok ? `Beli ${res.item.name} ✔` : res.error, res.ok);
  };

  const bikePos = new THREE.Vector3();
  app.addUpdatable({
    update(dt, ctx) {
      handleKeys(input, rig, hud, ents, app, shop);
      rig.update(ents.bike.state, dt);
      hud.setSpeed(ents.bike.speedKmh);
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
    ents.bike.resumeAudio?.();
  });
  app.renderer.domElement.addEventListener('click', () => {
    if (!hud.shopOpen) rig.requestLock();
  });
  if (import.meta.env.DEV) exposeDevTools(app, ents, rig);
}

/** Alat debug hanya di mode dev: teleport & statistik renderer. */
function exposeDevTools(app, ents, rig) {
  window.__sim = {
    app, ents, rig,
    teleport(x, z, yaw = 0) {
      ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
      ents.bike.setCollider(createCollider({ x, z }));
    },
    stats: () => ({ ...app.renderer.info.render, fps: document.getElementById('hud-fps').textContent }),
  };
}

function handleKeys(input, rig, hud, ents, app, shop) {
  if (input.consumePress('KeyV')) {
    rig.toggleMode();
    hud.setCameraMode(rig.mode);
  }
  if (input.consumePress('KeyM')) app.minimapVisible = !app.minimapVisible;
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

function updatePrompt(hud, ents, ctx) {
  if (hud.shopOpen) return hud.setPrompt(null);
  const near = ents.vendors.nearest(ctx.bikePos);
  const show = near && near.dist < INTERACT_DIST;
  hud.setPrompt(show ? `Tekan E — ${near.vendor.name}` : null);
}

/** Bentuk data untuk dialog HUD dari info pedagang. */
function shopInfo(vendor) {
  return { name: vendor.name, items: vendor.catalog };
}

main();
