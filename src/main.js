import * as THREE from 'three';
import { App, hasWebGL } from './core/App.js';
import { Input } from './core/Input.js';
import { createGamepadPoller } from './core/gamepad.js';
import { TouchControls } from './ui/TouchControls.js';
import { isTouchPrimary } from './ui/touchMath.js';
import './ui/touch.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { CameraRig } from './core/CameraRig.js';
import { createCollider, createCompositeCollider, localized } from './core/Collider.js';
import { createPovSource } from './core/povSource.js';
import { POVS } from './core/cameraPresets.js';
import { createAudioBus } from './core/AudioBus.js';
import { createLighting } from './world/Lighting.js';
import { createTimeOfDay } from './world/TimeOfDay.js';
import { createWeather } from './world/Weather.js';
import { formatHour } from './sim/dayCycle.js';
import { Minimap2D } from './ui/Minimap2D.js';
import { MainMenu } from './ui/MainMenu.js';
import { hasStoryProgress } from './ui/menuModel.js';
import { createRotatePrompt } from './ui/orientation.js';
import { SITE } from './config/constants.js';
import { STORY_NPCS } from './story/chapters.js';
import { freezeStatic } from './world/util/freezeStatic.js';
import { createModelGroup, placeModels } from './world/assets/models.js';
import { updateWind } from './world/shaders/windState.js';
import { buildEntities } from './entities/index.js';
import { HUD } from './ui/HUD.js';
import { createWallet } from './sim/vendorSim.js';
import { createSettingsStore, STORAGE_KEY } from './settings/store.js';
import { safeLocalStorage } from './settings/safeStorage.js';
import { bindAll } from './ui/bindings/index.js';
import { createLoadingScreen } from './ui/LoadingScreen.js';
import { StoryDirector } from './core/StoryDirector.js';
import { StoryNpcs } from './entities/StoryNpcs.js';
import { createStoryMarkers } from './world/StoryMarkers.js';
import { StoryHUD } from './ui/StoryHUD.js';
import { StoryJournal } from './ui/StoryJournal.js';
import { createResourceScope } from './engine/ResourceScope.js';
import { stadionRegion } from './regions/stadion/index.js';
import { session, setupMenu } from './app/session.js';
import { handleKeys } from './app/keymap.js';
import { setupShop, updatePrompt } from './app/shop.js';
import { exposeDevTools } from './app/devtools.js';

const START_POS = { x: 0, z: -275, yaw: 0 }; // plaza utara, menghadap stadion
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
  // Kontrol sentuh + gamepad menulis ke Input yang sama dengan keyboard.
  const touchUi = new TouchControls(document.body, { input, rig, surface: app.renderer.domElement });
  const gamepad = createGamepadPoller(input, { lookBy: (dx, dy) => rig.lookBy(dx, dy) });
  app.addSystem({ id: 'gamepad', phase: 'input', update: (dt) => gamepad.update(dt) });
  window.addEventListener('gamepadconnected', () => hud.toast('Gamepad terhubung', true));
  const audioBus = createAudioBus();
  const storage = safeLocalStorage();
  const firstRun = storage?.getItem(STORAGE_KEY) == null;
  const store = createSettingsStore({ storage });
  const touch = isTouchPrimary();
  if (touch && firstRun) store.set('performance.minimap', false); // layar kecil: minimap menutupi tombol layar
  // Perubahan terakhir tidak boleh hilang saat tab ditutup/disembunyikan (debounce 150 ms).
  window.addEventListener('pagehide', () => store.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); });

  await loading.step(0.12, 'Menyiapkan langit dan pencahayaan…');
  const lighting = createLighting(app.scene, app.renderer);
  app.scene.add(lighting);
  app.addSystem({ id: 'lighting', phase: 'world', update: (dt, ctx) => lighting.userData.update?.(dt, ctx.time, ctx.focus, ctx.shadowFrame) });

  await loading.step(0.2, 'Membangun stadion, tribun, dan lingkungan…');
  const region = await stadionRegion.build({
    scene: app.scene, renderer: app.renderer, camera: app.camera, scope: createResourceScope('region:stadion'), store, clock: app.timer,
  });
  app.scene.add(region.group);
  freezeStatic(region.group); // dunia statis: matriks dihitung sekali, tidak per frame
  const colliders = createCompositeCollider({
    regions: [{ region: stadionRegion, colliders: region.colliders }],
    fallback: localized(stadionRegion, region.colliders), // Fase 0: tanah region (1,4 km) masih menutup seluruh dunia; Fase 2: TileCollider
  });
  rig.setObstacleTest(colliders.isCameraClear);
  const blenderModels = createModelGroup();
  app.scene.add(blenderModels);
  const modelsReady = loadBlenderModels(blenderModels, region, hud);
  app.addSystem({ id: 'wind', phase: 'world', update: (dt) => updateWind(dt) }); // angin global tiap frame
  region.systems.forEach((s) => app.addSystem(s));

  await loading.step(0.55, 'Menyiapkan pemain, pelari, pedagang, dan penonton…');
  const wallet = createWallet();
  const ents = buildEntities({ start: START_POS, world: region, wallet, camera: app.camera });
  app.scene.add(ents.group);
  ents.bike.setCollider(createCollider(START_POS, colliders.isWalkable));
  rig.attachSource(createPovSource(ents));
  ents.bike.setAudioBus(audioBus);
  ents.updatables.forEach((e, i) => app.addSystem({ id: `entities.${i}`, phase: 'sim', update: (dt, ctx) => e.update(dt, ctx) }));

  await loading.step(0.8, 'Menyiapkan siklus waktu dan cuaca…');
  // Siklus waktu & cuaca: objeknya di grup sendiri; material emissive/basah didaftarkan lewat registry.
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app, { lamps: region.lamps, lensRoot: region.group });
  app.scene.add(time.group);
  time.registerEmissive(region.group);
  time.registerEmissive(ents.group);
  modelsReady
    .then(() => time.registerEmissive(blenderModels)) // GLB yang datang belakangan ikut menyala malam hari
    .catch((err) => console.error('Registrasi emissive model 3D gagal:', err));
  const weather = createWeather(app.scene, app, lighting, { audioBus });
  app.scene.add(weather.group);
  weather.registerWet(region.group);
  app.addSystem({ id: 'timeOfDay', phase: 'world', update: (dt, ctx) => time.update(dt, ctx, ents.bike.state) });
  app.addSystem({ id: 'weather', phase: 'world', update: (dt, ctx) => weather.update(dt, ctx) }); // setelah TimeOfDay: mengalikan nilai pencahayaan frame ini

  hud.setWallet(wallet);
  hud.setCameraMode(rig.mode);
  const story = setupStory({ app, ents, hud, rig });
  const shop = setupShop(hud, ents, story);
  const minimap = setupMinimap(app, ents, story);

  addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story });

  const bikePos = new THREE.Vector3();

  // Binding store -> scene (satu sumber kebenaran). Dipasang setelah semua objek ada.
  bindAll(store, {
    app, time, lighting, weather, rig, hud, audioBus, crowd: ents.crowd, vendors: ents.vendors,
  });

  app.start((dt, t, rawDt) => {
    bikePos.set(ents.bike.state.x, 0, ents.bike.state.z);
    // focus = titik pusat tampilan (sepeda, atau titik pandang saat POV); sepeda beku di POV tanpa kendali
    return { dt, rawDt, time: t, bikePos, focus: rig.focus, input: hud.shopOpen || rig.freezesBike ? null : input };
  });

  const menu = new MainMenu();
  createRotatePrompt(document.body, { isTouch: touch });
  setupMenu({ app, rig, hud, store, touchUi, touch, menu, story });
  await loading.step(0.9, 'Memuat model 3D (tugu, bangku)…');
  // Model 3D opsional (ada cadangan prosedural): jangan tahan tombol Mulai bila unduhan macet.
  await Promise.race([modelsReady, new Promise((resolve) => setTimeout(resolve, MODELS_TIMEOUT_MS))]);
  await loading.step(0.97, 'Menggambar peta…');
  try {
    minimap.setBase(app.bakeMinimap(SITE.groundSize / 2), SITE.groundSize / 2);
  } catch (err) {
    // Minimap hanya pelengkap: GPU yang gagal mengalokasikan target/readPixels tidak boleh menggagalkan game.
    console.error('Minimap dasar gagal dibuat, minimap memakai latar polos:', err);
  }
  await loading.step(1, 'Siap!');
  loading.done();
  // Latar menu: kamera orbit sinematik mengelilingi stadion (sepeda dibekukan, cerita dijeda) sampai pemain menekan Mulai.
  rig.handlePovKey(POVS.find((p) => p.id === 'orbit').key);
  menu.ready({ hasProgress: hasStoryProgress(story.state), touch });
  if (import.meta.env.DEV) exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story, colliders });
}

/**
 * Sistem per frame milik composition root (dulu satu updatable raksasa). Hotkey kini di fase input
 * (efeknya terlihat satu frame lebih awal; tidak ada perbedaan visual), cerita di sim, kamera di camera,
 * HUD dan input.endFrame di ui (endFrame terdaftar terakhir di antara konsumen tombol).
 */
function addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story }) {
  app.addSystem({
    id: 'keymap',
    phase: 'input',
    update: () => { if (session.started) handleKeys(input, { rig, hud, ents, shop, time, store, story }); }, // menu terbuka: tombol game diabaikan
  });
  app.addSystem({
    id: 'story',
    phase: 'sim',
    update: (dt, ctx) => story.update(dt, {
      time: ctx.time, bikePos: ents.bike.state, hour: time.hour,
      raining: Boolean(store.get('weather.raining')), paused: hud.shopOpen || rig.freezesBike,
    }),
  });
  app.addSystem({
    id: 'cameraRig',
    phase: 'camera',
    update: (dt, ctx) => {
      rig.update(ents.bike.state, dt, ctx.time);
      ents.bike.setRiderVisible(!rig.firstPersonView);
      // POV beku: sepeda berhenti seketika (bukan meluncur karena momentum)
      if (rig.freezesBike && ents.bike.state.v !== 0) ents.bike.state = { ...ents.bike.state, v: 0 };
    },
  });
  app.addSystem({
    id: 'hud',
    phase: 'ui',
    update: (dt, ctx) => {
      hud.setCameraView(rig.mode, rig.povLabel, rig.freezesBike);
      hud.setSpeed(ents.bike.speedKmh);
      hud.setTime(formatHour(time.hour), time.presetName, weather.weatherName);
      hud.setScore(ents.match.score);
      hud.tickFps(ctx.rawDt ?? dt); // FPS jujur: delta mentah, bukan yang di-clamp
      updatePrompt(hud, ents, story, ents.bike.state);
    },
  });
  app.addSystem({ id: 'input.endFrame', phase: 'ui', update: () => input.endFrame() });
}

/** Cerita: NPC, penanda tujuan, HUD, jurnal; progres dimuat dari localStorage. */
function setupStory({ app, ents, hud, rig }) {
  const root = document.getElementById('hud');
  const npcs = new StoryNpcs();
  const markers = createStoryMarkers();
  app.scene.add(npcs.group, markers.group);
  ents.lod.addFrom(npcs.group);
  app.addSystem({ id: 'storyNpcLabels', phase: 'ui', update: (dt, ctx) => npcs.refreshLabels(ctx.focus ?? ctx.bikePos, ents.vendors.labelsEnabled) });
  let story = null;
  const storyHud = new StoryHUD(root, { onAdvance: () => story.advanceDialog() });
  const journal = new StoryJournal(root, { onReset: () => story.reset(), onClose: () => story.toggleJournal() });
  const pointerLock = { release: () => document.exitPointerLock?.(), request: () => rig.requestLock() };
  story = new StoryDirector({ storage: safeLocalStorage(), vendors: ents.vendors, hud, storyHud, journal, markers, pointerLock });
  ents.bike.onRing = () => story.onBell();
  story.start();
  return story;
}

const PIN_VENDOR = '#ff9f1c';
const PIN_NPC = '#4cc9f0';

/** Minimap 2D: peta dasar di-bake sekali (lihat App.bakeMinimap); marker digambar di canvas kecil. */
function setupMinimap(app, ents, story) {
  const minimap = new Minimap2D(document.body);
  const pins = () => [
    ...ents.vendors.vendors.map((v) => ({ x: v.position.x, z: v.position.z, color: PIN_VENDOR })),
    ...STORY_NPCS.map((n) => ({ x: n.x, z: n.z, color: PIN_NPC })),
  ];
  app.addSystem({
    id: 'minimap',
    phase: 'ui',
    update(dt, ctx) {
      minimap.setVisible(app.minimapVisible);
      const b = ents.bike.state;
      minimap.update(ctx.time, { focus: b, yaw: b.yaw, goal: story.goalPoint(), getPins: pins });
    },
  });
  return minimap;
}

/**
 * Muat model GLB hasil Blender (region.layout.blenderModels) tanpa menahan start aplikasi.
 * Model yang gagal dimuat hanya dilewati; dunia prosedural tetap lengkap.
 */
async function loadBlenderModels(group, region, hud) {
  const { failed } = await placeModels(group, region.layout.blenderModels ?? [], { world: region.group });
  if (failed.length) hud.toast(`${failed.length} model 3D gagal dimuat`, false);
}

main().catch((err) => {
  console.error(err);
  document.getElementById('loading-fill')?.classList.add('failed');
  const label = document.getElementById('loading-label');
  if (label) label.textContent = 'Gagal memuat. Muat ulang halaman.';
});
