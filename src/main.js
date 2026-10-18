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
import { createCollider, createDynamicCompositeCollider, createDistrictCollider, localized } from './core/Collider.js';
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
import { STORY_NPCS } from './story/chapters.js';
import { resolvePoint, localizePoint } from './story/points.js';
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
import { disposeTree } from './engine/disposeTree.js';
import { createScheduler } from './engine/scheduler.js';
import { stadionRegion, STADION_ID } from './regions/stadion/index.js';
import { session, setupMenu } from './app/session.js';
import { handleKeys } from './app/keymap.js';
import { setupShop, updatePrompt } from './app/shop.js';
import { exposeDevTools, parsePlacementParam, parseFlagParam } from './app/devtools.js';
import { createDisposerStack } from './app/lifecycle.js';
import { applyPlacement } from './app/mountRegion.js';
import { createRegionManager } from './app/regionManager.js';
import { createTerrainService } from './app/terrainService.js';
import { mountDistrict } from './app/districtMount.js';
import { unriDistrict } from './districts/unri/index.js';
import { createLocalContext, pointToWorld } from './app/regionContext.js';
import { withPlacement } from './regions/Region.js';
import { createCity } from './city/index.js';
import { STREAM } from './city/ChunkStreamer.js';
import { createAttribution } from './ui/Attribution.js';
import { travelDestinations, createFastTravel } from './app/fastTravel.js';
import { FastTravelMenu, createTravelScreen } from './ui/FastTravelMenu.js';

const MODELS_TIMEOUT_MS = 8000;

function showFatal(msg) {
  const panel = document.querySelector('#overlay .panel');
  panel.replaceChildren(Object.assign(document.createElement('p'), { textContent: msg }));
}

async function main() {
  if (!hasWebGL()) return showFatal('Browser ini tidak mendukung WebGL. Coba Chrome/Edge terbaru.');
  const loading = createLoadingScreen();
  await loading.step(0.05, 'Menyiapkan mesin grafis…');

  // Pembongkaran berurutan terbalik (LIFO); dipakai __sim.teardown() di mode dev.
  const lifecycle = createDisposerStack();
  const listeners = new AbortController();
  const app = new App(document.getElementById('app'));
  lifecycle.add(() => app.dispose());
  lifecycle.add(() => listeners.abort());
  const input = new Input();
  lifecycle.add(() => input.dispose());
  const hud = new HUD(document.getElementById('hud'));
  const rig = new CameraRig(app.camera, app.renderer.domElement);
  lifecycle.add(() => rig.dispose());
  // Kontrol sentuh + gamepad menulis ke Input yang sama dengan keyboard.
  const touchUi = new TouchControls(document.body, { input, rig, surface: app.renderer.domElement });
  lifecycle.add(() => touchUi.dispose());
  const gamepad = createGamepadPoller(input, { lookBy: (dx, dy) => rig.lookBy(dx, dy) });
  app.addSystem({ id: 'gamepad', phase: 'input', update: (dt) => gamepad.update(dt) });
  window.addEventListener('gamepadconnected', () => hud.toast('Gamepad terhubung', true), { signal: listeners.signal });
  const audioBus = createAudioBus();
  lifecycle.add(() => audioBus.dispose());
  const storage = safeLocalStorage();
  const firstRun = storage?.getItem(STORAGE_KEY) == null;
  const store = createSettingsStore({ storage });
  const touch = isTouchPrimary();
  if (touch && firstRun) store.set('performance.minimap', false); // layar kecil: minimap menutupi tombol layar
  // Perubahan terakhir tidak boleh hilang saat tab ditutup/disembunyikan (debounce 150 ms).
  window.addEventListener('pagehide', () => store.flush(), { signal: listeners.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); }, { signal: listeners.signal });

  await loading.step(0.12, 'Menyiapkan langit, pencahayaan, waktu, dan cuaca…');
  const lighting = createLighting(app.scene, app.renderer);
  app.scene.add(lighting);
  app.addSystem({ id: 'lighting', phase: 'world', update: (dt, ctx) => lighting.userData.update?.(dt, ctx.time, ctx.focus, ctx.shadowFrame) });
  // Mode dev: ?placement=x,z,yaw memindahkan region (uji I1); produksi selalu memakai placement region.
  const devPlacement = import.meta.env.DEV ? parsePlacementParam(window.location.search) : null;
  const stadionDef = devPlacement ? withPlacement(stadionRegion, devPlacement) : stadionRegion;
  // Siklus waktu & cuaca dibuat sebelum region: region mendaftar ke registry emissive/basah/lampu saat dipasang.
  // Sistemnya tetap didaftarkan sesudah entitas (urutan fase world tidak berubah).
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app);
  app.scene.add(time.group);
  lifecycle.add(() => time.dispose());
  const weather = createWeather(app.scene, app, lighting, { audioBus, puddlePlacement: stadionDef.placement });
  app.scene.add(weather.group);
  lifecycle.add(() => weather.dispose());

  await loading.step(0.2, 'Membangun stadion, tribun, dan lingkungan…');
  app.addSystem({ id: 'wind', phase: 'world', update: (dt) => updateWind(dt) }); // angin global tiap frame
  const { regions, scheduler, terrain, colliders } = createRegionLayer({ app, store, time, weather, lifecycle });
  rig.setTerrain(terrain); // fokus/target/lantai kamera & pose POV relatif tanah (M1)
  const stadion = await regions.register(stadionDef); // persistent: dipasang sekarang (urutan muat seperti sebelum M0)
  const frame = regions.frameOf(STADION_ID); // frame region stadion: entitas, cerita NPC, kamera, minimap
  const toLocalCtx = createLocalContext(frame);
  if (import.meta.env.DEV && parseFlagParam(window.location.search, 'dummyRegion')) {
    const { createDummyRegion } = await import('./app/dummyRegion.js');
    regions.register(createDummyRegion()); // uji streaming M0: pusat (0, 1100), pasang < 700 m, lepas > 900 m
  }
  /** Uji siklus hidup (dev/E2E): lepas lalu pasang ulang region stadion; kembalikan Promise model siap. */
  const remountRegion = () => regions.remount(STADION_ID);
  const region = stadion.region;

  await loading.step(0.4, 'Menyiapkan peta kota (OpenStreetMap)…');
  // Kota: tile OSM di-stream di sekitar fokus. Manifest gagal → null: mode hanya-region (perilaku lama) + toast.
  const city = await createCity({ app, baseUrl: import.meta.env.BASE_URL, weather, time, toast: (t, ok) => hud.toast(t, ok) });
  if (city) {
    lifecycle.add(() => city.dispose());
    time.setFogLimit(STREAM.loadRadius); // batas muat tertutup kabut
    lifecycle.add(createAttribution(document.body).dispose);
  }
  // Di dalam mask region aktif → collider region (lokal); di luar → TileCollider kota (tanpa kota: tanah stadion
  // menutup dunia). Komposit meneruskan `penetration`: sepeda terjebak hanya boleh keluar, tidak menembus.
  // Urutan spec §4.2: region (komposit dinamis M0) → distrik (rantai M1) → tile kota.
  const districtColliders = createDistrictCollider({ fallback: city ? city.collider : localized(stadionDef, region.colliders) });
  colliders.setFallback(districtColliders);
  rig.setObstacleTest(colliders.isCameraClear);
  const modelsReady = stadion.ready
    .then(({ failed, cancelled }) => { // region dibongkar sebelum selesai: tidak ada yang dilaporkan
      if (!cancelled && stadion.mounted && failed.length) hud.toast(`${failed.length} model 3D gagal dimuat`, false);
    })
    .catch((err) => console.error('Model 3D region gagal diproses:', err));

  await loading.step(0.55, 'Menyiapkan pemain, pelari, pedagang, dan penonton…');
  const wallet = createWallet();
  // Jangkar region: entitas & objek cerita region-lokal ditempel di bawah grup ber-placement.
  const anchor = applyPlacement(new THREE.Group(), frame.placement);
  anchor.name = 'jangkarRegion';
  app.scene.add(anchor);
  lifecycle.add(() => anchor.removeFromParent());
  const spawn = region.layout.spawn; // region-lokal: plaza utara, menghadap stadion
  const start = { ...frame.toWorld(spawn.x, spawn.z), yaw: frame.yawToWorld(spawn.yaw) };
  const ents = buildEntities({ start, world: region, wallet, camera: app.camera });
  app.scene.add(ents.group);
  anchor.add(ents.regionGroup);
  lifecycle.add(() => {
    ents.bike.dispose();
    for (const g of [ents.group, ents.regionGroup]) { g.removeFromParent(); disposeTree(g); }
  });
  ents.bike.setCollider(createCollider(start, colliders.isWalkable, colliders.penetration));
  ents.bike.setTerrain(terrain); // y, pitch, grade fisika (M1)
  rig.attachSource(createPovSource(ents, frame, { regions }));
  regions.on('unmount', () => { if (rig.povId === 'region') rig.exitPov(); }); // POV region yang dilepas tidak boleh membeku
  ents.bike.setAudioBus(audioBus);
  // Sepeda di frame dunia; entitas region menerima ctx region-lokal (bikePos/focus dikonversi sekali per frame).
  ents.updatables.forEach((e, i) => app.addSystem({
    id: `entities.${i}`, phase: 'sim', update: (dt, ctx) => e.update(dt, e === ents.bike ? ctx : toLocalCtx(ctx)),
  }));

  await loading.step(0.8, 'Menyiapkan siklus waktu dan cuaca…');
  time.registerEmissive(ents.group);
  time.registerEmissive(ents.regionGroup);
  app.addSystem({ id: 'timeOfDay', phase: 'world', update: (dt, ctx) => time.update(dt, ctx, ents.bike.state) });
  app.addSystem({ id: 'weather', phase: 'world', update: (dt, ctx) => weather.update(dt, ctx) }); // setelah TimeOfDay: mengalikan nilai pencahayaan frame ini

  hud.setWallet(wallet);
  hud.setCameraMode(rig.mode);
  const story = setupStory({ app, ents, hud, rig, anchor, toLocalCtx, regions, lifecycle, terrain });
  const shop = setupShop(hud, ents, story);
  const minimap = setupMinimap(app, ents, story, frame, regions);
  if (city) minimap.setTileLayer(city.minimap);
  // Distrik kampus UNRI (M1: terrain). Gagal → null + toast; permainan berlanjut tanpa distrik (spec §10).
  const unri = await mountDistrict(app, unriDistrict, {
    terrain, scheduler, collider: districtColliders, minimap, city, weather, baseUrl: import.meta.env.BASE_URL,
    toast: (t, ok) => hud.toast(t, ok),
  });
  if (unri) lifecycle.add(() => unri.dispose()); // LIFO: dilepas sebelum kota, time, weather
  const travel = setupFastTravel({ lifecycle, hud, rig, ents, colliders, city, frame, spawn: region.layout.spawn, touch });
  addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story, travel });

  // Binding store -> scene (satu sumber kebenaran). Dipasang setelah semua objek ada.
  lifecycle.add(bindAll(store, {
    app, time, lighting, weather, rig, hud, audioBus, crowd: ents.crowd, vendors: ents.vendors,
  }));

  const bikePos = new THREE.Vector3();
  app.start((dt, t, rawDt) => {
    bikePos.set(ents.bike.state.x, ents.bike.groundY, ents.bike.state.z);
    // focus = titik pusat tampilan (sepeda, atau titik pandang saat POV); sepeda beku di POV tanpa kendali.
    // heightAt/terrain (M1): tanah dunia untuk entitas, lampu, cuaca (ctx region-lokal membungkus heightAt).
    return {
      dt, rawDt, time: t, bikePos, focus: rig.focus, heightAt: terrain.heightAt, terrain,
      input: hud.shopOpen || rig.freezesBike || travel.blocksInput ? null : input,
    };
  });
  // LIFO: loop berhenti lebih dulu, sebelum sistem kehilangan sumber dayanya (App.dispose mengulanginya, idempoten).
  lifecycle.add(() => app.renderer.setAnimationLoop(null));

  const menu = new MainMenu();
  const rotatePrompt = createRotatePrompt(document.body, { isTouch: touch });
  lifecycle.add(() => rotatePrompt.dispose());
  setupMenu({ app, rig, hud, store, touchUi, touch, menu, story })
    .then((mounted) => lifecycle.add(() => mounted.dispose()))
    .catch((err) => console.error('Panel pengaturan gagal dipasang:', err));
  await loading.step(0.9, 'Memuat model 3D (tugu, bangku)…');
  // Model 3D opsional (ada cadangan prosedural): jangan tahan tombol Mulai bila unduhan macet.
  await Promise.race([modelsReady, new Promise((resolve) => setTimeout(resolve, MODELS_TIMEOUT_MS))]);
  await loading.step(0.97, 'Menggambar peta…');
  // Base layer minimap per region aktif dibake sekarang (galat bake ditangani manager: latar polos);
  // region yang dipasang kemudian dibake setelah siap.
  regions.attachMinimap(minimap);
  await loading.step(1, 'Siap!');
  loading.done();
  // Latar menu: kamera orbit sinematik mengelilingi stadion (sepeda dibekukan, cerita dijeda) sampai pemain menekan Mulai.
  rig.handlePovKey(POVS.find((p) => p.id === 'orbit').key);
  menu.ready({ hasProgress: hasStoryProgress(story.state), touch });
  if (import.meta.env.DEV) {
    exposeDevTools({
      app, ents, rig, time, weather, store, audioBus, story, colliders, city, remountRegion, regions, scheduler, terrain, district: unri,
      fastTravel: (id) => travel.go(id), teardown: () => lifecycle.disposeAll(),
    });
  }
}

/**
 * Lapisan multi-region (M0): terrain (stub datar), scheduler time-sliced, collider komposit dinamis, dan
 * region manager. Sistem `regions` (sim) memasang/melepas region streaming menurut fokus; `scheduler` (ui,
 * akhir frame sebelum render) menjalankan pekerjaan berat region ≤ 4 ms/frame.
 */
function createRegionLayer({ app, store, time, weather, lifecycle }) {
  const terrain = createTerrainService();
  const scheduler = createScheduler();
  const colliders = createDynamicCompositeCollider();
  const regions = createRegionManager({ app, store, time, weather, terrain, collider: colliders, scheduler });
  lifecycle.add(() => regions.dispose()); // LIFO: region dicabut sebelum time/weather di-dispose
  app.addSystem({ id: 'regions', phase: 'sim', update: (dt, ctx) => regions.update(ctx.focus) });
  app.addSystem({ id: 'scheduler', phase: 'ui', update: () => scheduler.update() });
  return { regions, scheduler, terrain, colliders };
}

/**
 * Sistem per frame milik composition root (dulu satu updatable raksasa). Hotkey kini di fase input
 * (efeknya terlihat satu frame lebih awal; tidak ada perbedaan visual), cerita di sim, kamera di camera,
 * HUD dan input.endFrame di ui (endFrame terdaftar terakhir di antara konsumen tombol).
 */
function addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story, travel }) {
  app.addSystem({
    id: 'keymap',
    phase: 'input',
    update: () => { if (session.started) handleKeys(input, { rig, hud, ents, shop, time, store, story, travelMenu: travel.menu }); }, // menu terbuka: tombol game diabaikan
  });
  app.addSystem({
    id: 'story',
    phase: 'sim',
    update: (dt, ctx) => story.update(dt, {
      time: ctx.time, bikePos: ents.bike.state, hour: time.hour, // cerita di koordinat dunia (titik ber-region di-resolve StoryDirector)
      raining: Boolean(store.get('weather.raining')), paused: hud.shopOpen || rig.freezesBike || travel.busy, // timer misi beku selama perjalanan
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
      updatePrompt(hud, ents, story, ents.bike.state); // prompt NPC cerita di koordinat dunia
    },
  });
  app.addSystem({ id: 'input.endFrame', phase: 'ui', update: () => input.endFrame() });
}

/**
 * Perjalanan cepat (G / tombol HUD): Stadion & Masjid Raya An-Nur; teleport menunggu tile tujuan
 * dimuat streamer sebelum layar perjalanan ditutup. Tanpa kota: hanya Stadion.
 */
function setupFastTravel({ lifecycle, hud, rig, ents, colliders, city, frame, spawn, touch }) {
  const screen = createTravelScreen(document.body);
  lifecycle.add(() => screen.dispose());
  const travel = createFastTravel({
    destinations: travelDestinations({ manifest: city?.manifest ?? null, frame, spawn }), bike: ents.bike, colliders, city, screen,
    isCameraClear: colliders.isCameraClear, rig, // POV ditutup dulu (menu & devtools); muncul dengan ruang kamera
  });
  const menu = new FastTravelMenu(document.body, {
    destinations: travel.destinations,
    touch,
    onTravel: (id) => travel.go(id)
      .then((status) => { if (status === 'timeout') hud.toast('Sebagian peta tujuan belum termuat', false); })
      .catch((err) => console.error('Perjalanan cepat gagal:', err)),
  });
  lifecycle.add(() => menu.dispose());
  return {
    menu,
    get busy() { return travel.busy; },
    /** Selama perjalanan atau panel terbuka sepeda tidak dikayuh (pola toko): WASD memilih tujuan. */
    get blocksInput() { return travel.busy || menu.open; },
    go: (id) => travel.go(id),
  };
}

/**
 * Cerita: NPC (region-lokal stadion, di bawah jangkar) dan penanda tujuan (DUNIA: tujuan bisa di region mana
 * pun), HUD, jurnal; progres dimuat dari localStorage (save v3 menyimpan tempat pemain sebagai titik ber-region).
 */
function setupStory({ app, ents, hud, rig, anchor, toLocalCtx, regions, lifecycle, terrain }) {
  const root = document.getElementById('hud');
  const npcs = new StoryNpcs();
  const markers = createStoryMarkers({ ground: terrain.heightAt }); // penanda di koordinat dunia (M0), di atas tanah (M1)
  anchor.add(npcs.group);
  app.scene.add(markers.group); // goalPoint() StoryDirector kini titik dunia
  lifecycle.add(() => markers.group.removeFromParent());
  ents.lod.addFrom(npcs.group);
  app.addSystem({
    id: 'storyNpcLabels',
    phase: 'ui',
    update: (dt, ctx) => {
      const local = toLocalCtx(ctx);
      npcs.placeOnGround(local.heightAt); // NPC region-lokal stadion (heightAt lokal dari ctx frame)
      npcs.refreshLabels(local.focus ?? local.bikePos, ents.vendors.labelsEnabled);
    },
  });
  const frameOf = (id) => regions.frameOf(id);
  let story = null;
  const storyHud = new StoryHUD(root, { onAdvance: () => story.advanceDialog() });
  const journal = new StoryJournal(root, { onReset: () => story.reset(), onClose: () => story.toggleJournal() });
  const pointerLock = { release: () => document.exitPointerLock?.(), request: () => rig.requestLock() };
  story = new StoryDirector({
    storage: safeLocalStorage(), vendors: ents.vendors, storyHud, journal, markers, pointerLock,
    onToast: (text, ok) => hud.toast(text, ok),
    onWalletChange: (wallet) => hud.setWallet(wallet),
    frameOf,
    placeOf: () => {
      const b = ents.bike.state;
      return localizePoint(b, regions.regionAt(b.x, b.z), frameOf);
    },
  });
  ents.bike.onRing = () => story.onBell();
  story.start();
  return story;
}

const PIN_VENDOR = '#ff9f1c';
const PIN_NPC = '#4cc9f0';

/** Minimap 2D (frame dunia): base layer per region dibake regionManager; marker region diubah ke dunia. */
function setupMinimap(app, ents, story, frame, regions) {
  const minimap = new Minimap2D(document.body);
  const frameOf = (id) => regions.frameOf(id);
  const pins = () => [
    ...ents.vendors.vendors.map((v) => pointToWorld(frame, { x: v.position.x, z: v.position.z, color: PIN_VENDOR })),
    ...STORY_NPCS.flatMap((n) => {
      const w = resolvePoint(n, frameOf);
      return w ? [{ x: w.x, z: w.z, color: PIN_NPC }] : [];
    }),
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

main().catch((err) => {
  console.error(err);
  document.getElementById('loading-fill')?.classList.add('failed');
  const label = document.getElementById('loading-label');
  if (label) label.textContent = 'Gagal memuat. Muat ulang halaman.';
});
