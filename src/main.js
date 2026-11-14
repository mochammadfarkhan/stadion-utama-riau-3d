import * as THREE from 'three';
import { App, hasWebGL } from './core/App.js';
import { Input } from './core/Input.js';
import { createGamepadPoller } from './core/gamepad.js';
import { TouchControls } from './ui/TouchControls.js';
import { isTouchPrimary } from './ui/touchMath.js';
import './ui/touch.css';
import './ui/cityPreview.css';
import './ui/perkamen.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { CameraRig } from './core/CameraRig.js';
import { createCollider, createDistrictCollider, localized } from './core/Collider.js';
import { createPovSource } from './core/povSource.js';
import { POVS } from './core/cameraPresets.js';
import { createAudioBus } from './core/AudioBus.js';
import { createLighting } from './world/Lighting.js';
import { createTimeOfDay } from './world/TimeOfDay.js';
import { createWeather } from './world/Weather.js';
import { MainMenu } from './ui/MainMenu.js';
import { hasStoryProgress } from './ui/menuModel.js';
import { createRotatePrompt } from './ui/orientation.js';
import { updateWind } from './world/shaders/windState.js';
import { buildEntities } from './entities/index.js';
import { HUMANOID_KIT_PATHS, addHumanoidKit, setAvatarStyle } from './entities/Humanoid.kit.js';
import { loadModel } from './world/assets/models.js';
import { HUD } from './ui/HUD.js';
import { createWallet } from './sim/vendorSim.js';
import { createSettingsStore, STORAGE_KEY } from './settings/store.js';
import { safeLocalStorage } from './settings/safeStorage.js';
import { bindAll } from './ui/bindings/index.js';
import { createLoadingScreen } from './ui/LoadingScreen.js';
import { disposeTree } from './engine/disposeTree.js';
import { stadionRegion, STADION_ID } from './regions/stadion/index.js';
import { session, setupMenu } from './app/session.js';
import { setupShop } from './app/shop.js';
import { exposeDevTools, parsePlacementParam, parseFlagParam } from './app/devtools.js';
import { preloadProcTextures, releaseBaked } from './world/textures/procBake.js';
import { createDisposerStack } from './app/lifecycle.js';
import { setPbrRenderer } from './world/textures/pbr.js';
import { applyPlacement } from './app/mountRegion.js';
import { createCityPreview } from './app/cityPreview.js';
import { mountDistrict } from './app/districtMount.js';
import { unriDistrict } from './districts/unri/index.js';
import { createStudentKit } from './entities/Student.js';
import { UNRI_VENDORS } from './story/chapters.unri.js';
import { createLocalContext } from './app/regionContext.js';
import { withPlacement, regionContains } from './regions/Region.js';
import { unriLembagaRegion } from './regions/unri-lembaga/index.js';
import { unriRektoratRegion } from './regions/unri-rektorat/index.js';
import { createHeroOrnamentLayer } from './app/heroOrnaments.js';
import { setupFarm } from './app/farm.js';
import { setupInventory } from './app/inventory.js';
import { setupQuality } from './app/quality.js';
import { createCity } from './city/index.js';
import { createStyleManager } from './engine/styleManager.js';
import { registerContactSource } from './engine/contactShadows.js';
import { updateWaterToon } from './world/shaders/waterToon.js';
import { STREAM } from './city/ChunkStreamer.js';
import { createAttribution } from './ui/Attribution.js';
import { HERO_REGIONS, regionIdAt } from './app/heroRegions.js';
import { createRegionLayer } from './app/regionLayer.js';
import { addFrameSystems } from './app/frameSystems.js';
import { setupFastTravel } from './app/fastTravelSetup.js';
import { setupPortal } from './app/portalSetup.js';
import { setupStory } from './app/storySetup.js';
import { setupMinimap } from './app/minimapSetup.js';

const MODELS_TIMEOUT_MS = 8000;
const START_SETTLE_TIMEOUT_MS = 12000; // batas tunggu streaming area awal sebelum render pertama

/** Tunggu tile kota + distrik di sekitar titik awal termuat (dibatasi waktu: streaming lambat tidak menahan Mulai). */
function settleStartArea({ city, unri, at }) {
  const settled = Promise.all([city?.whenSettled(at.x, at.z), unri?.whenSettled(at.x, at.z)])
    .catch((err) => console.error('Streaming area awal gagal ditunggu:', err));
  return Promise.race([settled, new Promise((resolve) => setTimeout(resolve, START_SETTLE_TIMEOUT_MS))]);
}

function showFatal(msg) {
  const panel = document.querySelector('#overlay .panel');
  panel.replaceChildren(Object.assign(document.createElement('p'), { textContent: msg }));
}

async function main() {
  if (import.meta.env.DEV && parseFlagParam(window.location.search, 'tekstur')) { // galeri tekstur PBR (dev)
    window.location.replace(`${import.meta.env.BASE_URL}tekstur-gallery.html`);
    return;
  }
  if (!hasWebGL()) return showFatal('Browser ini tidak mendukung WebGL. Coba Chrome/Edge terbaru.');
  // `?perf`: laporan kinerja (overlay + Salin laporan); dimulai sekarang agar long task saat muat ikut tercatat.
  const perfProbe = parseFlagParam(window.location.search, 'perf') ? (await import('./app/perfProbe.js')).startPerfProbe() : null;
  const loading = createLoadingScreen();
  await loading.step(0.05, 'Menyiapkan mesin grafis…');
  // Tekstur prosedural hasil bake di-decode paralel sejak awal; ?procbake (skrip bake) memaksa semua prosedural.
  const procTextures = parseFlagParam(window.location.search, 'procbake') ? Promise.resolve(0) : preloadProcTextures(import.meta.env.BASE_URL);
  // Kit karakter (Blender) dimuat paralel: manekin tanpa wajah (default) + chibi (rambut/hijab; ?avatar=chibi = gaya
  // lama). Kit yang gagal dimuat dilewati; Humanoid jatuh ke chibi/prosedural.
  setAvatarStyle(new URLSearchParams(window.location.search).get('avatar'));
  const humanoidKit = Promise.all(HUMANOID_KIT_PATHS.map((path) => loadModel(path)
    .then(addHumanoidKit)
    .catch((err) => console.error(`Kit karakter ${path} gagal dimuat; memakai bentuk cadangan:`, err))));

  // Pembongkaran berurutan terbalik (LIFO); dipakai __sim.teardown() di mode dev.
  const lifecycle = createDisposerStack();
  const listeners = new AbortController();
  const app = new App(document.getElementById('app'));
  setPbrRenderer(app.renderer); // tekstur PBR memakai KTX2 (Basis) bila didukung; ?nokt2 = WebP
  lifecycle.add(() => app.dispose());
  lifecycle.add(() => listeners.abort());
  const input = new Input();
  lifecycle.add(() => input.dispose());
  const hud = new HUD(document.getElementById('hud'));
  const rig = new CameraRig(app.camera, app.renderer.domElement);
  const lodView = { position: rig.lodPoint }; // jarak LOD humanoid/distrik: pemain di mode 3/4, kamera selain itu
  lifecycle.add(() => rig.dispose());
  // Kontrol sentuh + gamepad menulis ke Input yang sama dengan keyboard.
  // Router lihat: kamera sepeda di luar, kamera interior di dalam sekre (target diganti portal.onInsideChange).
  const look = { target: rig, lookBy(dx, dy, scale) { look.target.lookBy(dx, dy, scale); } };
  const touchUi = new TouchControls(document.body, { input, rig: look, surface: app.renderer.domElement });
  lifecycle.add(() => touchUi.dispose());
  const gamepad = createGamepadPoller(input, { lookBy: (dx, dy) => look.lookBy(dx, dy) });
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

  await procTextures; // sebelum lighting/dunia: keduanya memanggil fillCanvas
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
  // M4: zona Lembaga (streaming: pasang ≤ 700 m, lepas > 900 m; proxy saat jauh)
  regions.register(unriLembagaRegion).catch((err) => console.error('Region unri-lembaga gagal didaftarkan:', err));
  // M6: zona Rektorat (Rektorat, danau, perpustakaan lama, poros taman; streaming seperti Lembaga)
  regions.register(unriRektoratRegion).catch((err) => console.error('Region unri-rektorat gagal didaftarkan:', err));
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
  const city = await createCity({
    app, baseUrl: import.meta.env.BASE_URL, weather, time, toast: (t, ok) => hud.toast(t, ok),
    reserved: (x, z) => regionContains(stadionDef, x, z) || HERO_REGIONS.some((r) => regionContains(r, x, z)), // region handmade punya isi sendiri
  });
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
  await humanoidKit;
  const wallet = createWallet();
  // Jangkar region: entitas & objek cerita region-lokal ditempel di bawah grup ber-placement.
  const anchor = applyPlacement(new THREE.Group(), frame.placement);
  anchor.name = 'jangkarRegion';
  app.scene.add(anchor);
  lifecycle.add(() => anchor.removeFromParent());
  const spawn = region.layout.spawn; // region-lokal: plaza utara, menghadap stadion
  const start = { ...frame.toWorld(spawn.x, spawn.z), yaw: frame.yawToWorld(spawn.yaw) };
  const ents = buildEntities({ start, world: region, wallet, camera: lodView, extraVendors: UNRI_VENDORS });
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
  // bayangan kontak untuk semua humanoid ber-LOD (NPC cerita, mahasiswa, satpam, pedagang) dalam 30 m dari fokus
  lifecycle.add(registerContactSource((emit, focus) => ents.lod.forEachNear(focus, 30, (x, z) => emit(x, z, 0.55))));
  const story = setupStory({ app, ents, hud, rig, anchor, toLocalCtx, regions, lifecycle, terrain });
  const shop = setupShop(hud, ents, story);
  const minimap = setupMinimap(app, ents, story, frame, regions);
  if (city) minimap.setTileLayer(city.minimap);
  // Region hero kampus punya isi sendiri (mis. motor rapat di teras sekre M4): distrik tidak menaruh instans di dalam mask-nya.
  const districtServices = Object.freeze({
    npc: createStudentKit(),
    camera: lodView,
    hour: () => time.hour,
    excludeAt: (x, z) => regionIdAt(x, z) !== null,
  });
  // Distrik kampus UNRI (terrain, tanah, gedung, kehidupan). Gagal → null + toast; permainan berlanjut tanpa distrik (spec §10).
  const unri = await mountDistrict(app, unriDistrict, {
    terrain, scheduler, collider: districtColliders, minimap, city, weather, time, baseUrl: import.meta.env.BASE_URL,
    toast: (t, ok) => hud.toast(t, ok),
    isReserved: (x, z) => HERO_REGIONS.some((r) => regionContains(r, x, z)), // dunia → di dalam mask region hero?
    services: districtServices,
  });
  if (unri) lifecycle.add(() => unri.dispose()); // LIFO: dilepas sebelum kota, time, weather
  // M6: ornamen GLB hero distrik (N04 kubah Masjid Arfa'unnas); gagal muat → placeholder prosedural tetap
  const heroOrnaments = createHeroOrnamentLayer({ scene: app.scene, terrain });
  lifecycle.add(() => heroOrnaments.dispose());
  app.addSystem({ id: 'heroOrnaments', phase: 'world', update: (dt, ctx) => heroOrnaments.update(ctx.focus) });
  const travel = setupFastTravel({ app, lifecycle, hud, rig, ents, colliders, city, frame, spawn: region.layout.spawn, touch, unri, regions });
  const panelRef = { current: null }; // SettingsPanel (diisi saat panel selesai dipasang)
  /** Tas pemain (setupInventory): dibaca sistem frame & portal untuk membekukan input saat panel tas terbuka. */
  let inventory = null;
  const isInventoryOpen = () => Boolean(inventory?.open);
  const portalKit = setupPortal({
    app, input, hud, rig, ents, regions, colliders, time, weather, store, audioBus, travel, story, minimap, look, panelRef, lifecycle, isInventoryOpen,
  }); // sebelum addFrameSystems: 'portal.trigger' lebih dulu dari 'keymap'
  inventory = setupInventory({ // tas + hotbar gaya Minecraft; sebelum 'keymap' (I, Esc, 1–9 lebih dulu dari POV)
    app, input, rig, ents, isActive: () => session.started && portalKit.portal.state === 'outside',
  });
  lifecycle.add(() => inventory.dispose());
  const farm = setupFarm({ // kebun dekat sekre ERC; juga sebelum 'keymap' (E kebun lebih dulu dari cerita/toko)
    app, input, hud, ents, inventory, terrain, time, store, onWalletChanged: () => story.saveNow(),
    isBlocked: () => hud.shopOpen || inventory.open || rig.freezesBike || portalKit.portal.state !== 'outside',
  });
  lifecycle.add(() => farm.dispose());
  addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story, travel, portal: portalKit.portal, isInventoryOpen });
  // K: pratinjau kota isometrik; isi berat (stadion, region, penonton) diganti bentuk dasar selama aktif.
  const cityPreview = createCityPreview({
    app, rig, regions, time, store, hud, city, lighting, audioBus, tier: () => quality?.tier ?? null, landmarks: travel.destinations.map((d) => (d.id === 'stadion' ? { ...d, ...frame.toWorld(0, 0) } : d)), stadionId: STADION_ID, stadionPlacement: frame.placement, hide: [ents.group, anchor],
  });
  lifecycle.add(() => cityPreview.dispose());
  portalKit.trigger.installPrompt(); // sesudah sistem 'hud'
  farm.installPrompt();

  // Binding store -> scene (satu sumber kebenaran). Dipasang setelah semua objek ada.
  lifecycle.add(bindAll(store, {
    app, time, lighting, weather, rig, hud, audioBus, crowd: ents.crowd, vendors: ents.vendors,
  }));
  // Preset kualitas (Otomatis: tebak GPU + uji 5 detik) SESUDAH bindAll: preset menulis ke setelan yang binding-nya terpasang.
  const quality = setupQuality({ app, store, hud, touch });
  lifecycle.add(() => quality.dispose());

  // Gaya grafis (L) + penghematan 3/4: SETELAH bindAll (menimpa AO/vignette/kepadatan) dan sistem timeOfDay/weather (atmosfer ditumpuk).
  const styleMgr = createStyleManager({
    store, app, scene: app.scene, lighting, rig, time, crowd: ents.crowd, bike: ents.bike, terrain, streamLoadRadius: STREAM.loadRadius,
    frameHooks: [(dt, st) => updateWaterToon(dt, { ...st, rain: weather.intensity })], // air kartun: waktu, matahari, jam, hujan
  });
  app.addSystem(styleMgr.system);
  lifecycle.add(() => styleMgr.dispose());

  const bikePos = new THREE.Vector3();
  // Render ditahan selama layar muat: sistem (streaming kota/distrik/region) tetap jalan, lalu shader area awal
  // dikompilasi paralel sebelum frame pertama (render pertama yang mengompilasi sinkron membeku belasan detik).
  app.holdRender = true;
  const precompile = () => app.precompile().catch((err) => console.error('Prekompilasi shader gagal:', err));
  const precompiled = precompile(); // mulai paralel sekarang; dunia yang sudah ada tidak menunggu streaming
  app.start((dt, t, rawDt) => {
    bikePos.set(ents.bike.state.x, ents.bike.groundY, ents.bike.state.z);
    // focus = titik pusat tampilan (sepeda, atau titik pandang saat POV); sepeda beku di POV tanpa kendali.
    // heightAt/terrain (M1): tanah dunia untuk entitas, lampu, cuaca (ctx region-lokal membungkus heightAt).
    return {
      dt, rawDt, time: t, bikePos, focus: rig.focus, heightAt: terrain.heightAt, terrain,
      input: hud.shopOpen || inventory?.open || rig.freezesBike || travel.blocksInput || portalKit.portal.busy || portalKit.portal.inside ? null : input,
    };
  });
  // LIFO: loop berhenti lebih dulu, sebelum sistem kehilangan sumber dayanya (App.dispose mengulanginya, idempoten).
  lifecycle.add(() => app.renderer.setAnimationLoop(null));

  const menu = new MainMenu();
  const rotatePrompt = createRotatePrompt(document.body, { isTouch: touch });
  lifecycle.add(() => rotatePrompt.dispose());
  setupMenu({ app, rig, hud, store, touchUi, touch, menu, story })
    .then((mounted) => {
      panelRef.current = mounted.panel;
      lifecycle.add(() => mounted.dispose());
    })
    .catch((err) => console.error('Panel pengaturan gagal dipasang:', err));
  await loading.step(0.9, 'Memuat model 3D (tugu, bangku)…');
  // Model 3D opsional (ada cadangan prosedural): jangan tahan tombol Mulai bila unduhan macet.
  await Promise.race([modelsReady, new Promise((resolve) => setTimeout(resolve, MODELS_TIMEOUT_MS))]);
  await loading.step(0.97, 'Menggambar peta…');
  // Base layer minimap per region aktif dibake sekarang (galat bake ditangani manager: latar polos);
  // region yang dipasang kemudian dibake setelah siap.
  regions.attachMinimap(minimap);
  // Latar menu: kamera orbit sinematik mengelilingi stadion (sepeda dibekukan, cerita dijeda) sampai pemain menekan Mulai.
  // Dipasang sebelum menunggu streaming agar area yang dimuat = area yang tampil di belakang menu.
  rig.handlePovKey(POVS.find((p) => p.id === 'orbit').key);
  await loading.step(0.98, 'Menyiapkan shader…');
  await precompiled;
  await settleStartArea({ city, unri, at: rig.focus });
  await precompile(); // objek hasil streaming; program yang sudah ada diambil dari cache
  app.holdRender = false;
  releaseBaked(); // bitmap tekstur bake tidak dibutuhkan lagi (pemasangan ulang = prosedural)
  await loading.step(1, 'Siap!');
  loading.done();
  menu.ready({ hasProgress: hasStoryProgress(story.state), touch });
  if (perfProbe) {
    perfProbe.attach({
      app, store, quality,
      context: () => ({ pov: rig.povId, zoom: Math.round(rig.director.zoom * 100) / 100, jam: Math.round(time.hour * 100) / 100 }),
      where: () => {
        const { x, z } = ents.bike.state;
        return { x: Math.round(x), z: Math.round(z), region: regionIdAt(x, z) };
      },
    });
    lifecycle.add(() => perfProbe.dispose());
  }
  if (import.meta.env.DEV) {
    exposeDevTools({
      app, ents, rig, time, weather, store, audioBus, story, colliders, city, remountRegion, regions, scheduler, terrain, district: unri,
      fastTravel: (id) => travel.go(id), teardown: () => lifecycle.disposeAll(),
      portal: portalKit.portal, regionIdAt,
    });
  }
}

main().catch((err) => {
  console.error(err);
  document.getElementById('loading-fill')?.classList.add('failed');
  const label = document.getElementById('loading-label');
  if (label) label.textContent = 'Gagal memuat. Muat ulang halaman.';
});
