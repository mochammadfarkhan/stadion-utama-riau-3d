/**
 * Portal interior (spec §4.8, §10): pintu-portal antara dunia luar dan scene interior terpisah (src/interiors).
 * Mesin state: outside → fadingIn → inside → fadingOut → outside.
 * - Masuk: layar memudar ke hitam → interior dibangun di ResourceScope sendiri → App.setView memakai scene &
 *   kamera interior (post-processing & label ikut) → sistem eksterior DIJEDA lewat gerbang App (tidak dilepas,
 *   urutan tetap) kecuali KEEP_INSIDE (jam, cuaca, input, scheduler) → pemain berjalan kaki (Walker +
 *   InteriorCameraRig) → layar terang kembali. AO (GTAO lazy) dinyalakan selama di dalam; suara hujan eksterior
 *   dibisukan (interior memutar hujan di atap seng sendiri).
 * - Build melempar / hasil tidak valid / pemasangan gagal: fade dibatalkan, pemain tetap di luar, toast
 *   "Pintu terkunci", scope interior dilepas.
 * - Keluar: sistem interior dicabut (dispose), view/gerbang/AO/suara dipulihkan, interior dilepas PENUH
 *   (dispose interior → disposeTree scene → scope.dispose). Sepeda TIDAK disentuh (tetap di depan pintu); hanya
 *   bila sepeda > FAR_EXIT_M dari titik keluar (masuk lewat dev/E2E) sepeda dipindah ke exitTo.
 * Pemicu pintu (E di depan pintu + prompt) tetap milik `src/app/portalTrigger.js` (M4), yang memanggil
 * enter(interiorId, { door }). Fade memakai port `fader.fade(0|1)` (`src/ui/FadeOverlay.js`, M4).
 * Penanda kompatibilitas M4: PORTAL_STATES, LOCKED_TOAST; build(ctx) menerima `exit` (pintu interaktif).
 */
import { createResourceScope, withScope } from '../engine/ResourceScope.js';
import { disposeTree } from '../engine/disposeTree.js';
import { validateInteriorBuild, nearestInteractable } from '../interiors/Interior.js';
import { InteriorCameraRig } from '../core/InteriorCameraRig.js';
import { Walker } from '../entities/Walker.js';
import { InfoCard } from '../ui/InfoCard.js';
import { formatHour } from '../sim/dayCycle.js';

export const PORTAL_STATES = Object.freeze({ OUTSIDE: 'outside', FADING_IN: 'fadingIn', INSIDE: 'inside', FADING_OUT: 'fadingOut' });
export const LOCKED_TOAST = 'Pintu terkunci';
export const INTERIOR_AO_RADIUS = 0.45; // m: AO ruang sempit (eksterior memakai RENDER.aoRadius)
export const FAR_EXIT_M = 30;
export const KEEP_INSIDE = Object.freeze(['gamepad', 'keymap', 'timeOfDay', 'weather', 'scheduler', 'input.endFrame']);
export const INTERIOR_EYE_Y = 1.55;
const PRESET_KEYS = Object.freeze(['Digit1', 'Digit2', 'Digit3', 'Digit4']);
const MOVE = Object.freeze({
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
});
const CLOSE_CARD_KEYS = Object.freeze(['KeyE', 'Escape', 'Space']);
const STILL = Object.freeze({ forward: 0, strafe: 0, run: false });

/** Sistem yang tetap jalan saat di dalam interior (gerbang App.setSystemGate). */
export function isSystemActiveInside(id) {
  return typeof id === 'string' && (KEEP_INSIDE.includes(id) || id.startsWith('interior.'));
}

const anyDown = (input, codes) => codes.some((c) => input.isDown(c));

/** Niat gerak jalan kaki dari tombol (sentuh & gamepad menulis ke kode yang sama). */
export function walkIntent(input, yaw) {
  return {
    forward: (anyDown(input, MOVE.forward) ? 1 : 0) - (anyDown(input, MOVE.back) ? 1 : 0),
    strafe: (anyDown(input, MOVE.right) ? 1 : 0) - (anyDown(input, MOVE.left) ? 1 : 0),
    run: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
    yaw,
  };
}

/** Gerak kamera bebas mode foto: W/A/S/D seperti jalan, Q/E turun/naik. */
function photoMove(input) {
  const w = walkIntent(input, 0);
  return { forward: w.forward, strafe: w.strafe, up: (input.isDown('KeyE') ? 1 : 0) - (input.isDown('KeyQ') ? 1 : 0), run: w.run };
}

const defaultIsPhotoUi = () => typeof document !== 'undefined' && Boolean(document.body?.classList.contains('is-photo'));

const DEFAULT_FACTORIES = Object.freeze({
  rig: (camera, dom, opts) => new InteriorCameraRig(camera, dom, opts),
  walker: (opts) => new Walker(opts),
  card: () => new InfoCard(document.body),
});

/** Kotak kamera foto bebas: dalam ruang + 2,6 m ke selasar lewat pintu. */
function photoBounds(size) {
  return { min: [-size.w / 2 + 0.1, 0.2, -size.d / 2 - 2.6], max: [size.w / 2 - 0.1, size.h - 0.15, size.d / 2 - 0.1] };
}

/**
 * @param {{app:object, input:object, hud:object, interiors:Map<string, object>, regionManager?:object|null,
 *   time?:object|null, weather?:object|null, store?:object|null, audioBus?:object|null,
 *   bike?:{state:{x:number,z:number}, teleport(x:number,z:number,yaw:number):void}|null,
 *   isUiBlocking?:() => boolean, isPhotoUi?:() => boolean, beforeEnter?:(def:object) => void,
 *   onInsideChange?:(inside:boolean) => void, onInteracted?:(interiorId:string, itemId:string) => void,
 *   onState?:(state:string) => void, fader?:{fade(to:number):Promise<void>},
 *   createScope?:(name:string) => object, factories?:object, logger?:{error:Function}}} deps
 */
export function createInteriorPortal({
  app, input, hud, interiors, regionManager = null, time = null, weather = null, store = null, audioBus = null,
  bike = null, isUiBlocking = () => false, isPhotoUi = defaultIsPhotoUi, beforeEnter = () => {},
  onInsideChange = () => {}, onInteracted = () => {}, onState = () => {}, fader = { fade: async () => {} },
  createScope = createResourceScope, factories = DEFAULT_FACTORIES, logger = console, ctx: extraCtx = {},
}) {
  let state = 'outside';
  let current = null;
  const setState = (next) => { state = next; onState(next); };
  const toast = (text, ok) => hud?.toast?.(text, ok);
  const storeGet = (key, fallback) => {
    const v = store?.get?.(key);
    return v === undefined ? fallback : v;
  };

  /** Pintu-portal region aktif dalam koordinat dunia (dev/E2E; pemicu E ada di portalTrigger M4). */
  function doors() {
    const out = [];
    for (const entry of regionManager?.active?.() ?? []) {
      for (const door of entry.region?.portals ?? []) {
        const world = entry.frame.toWorld(door.pos.lx, door.pos.lz);
        out.push({ ...door, regionId: entry.def.id, world, worldYaw: entry.frame.yawToWorld(door.yaw) });
      }
    }
    return out;
  }

  const buildCtx = (scope, door) => ({
    ...extraCtx,
    scope,
    renderer: app.renderer ?? null,
    audioBus,
    time,
    weather,
    store,
    door,
    fov: Number(storeGet('camera.fov', 70)) || 70,
    setExposure: (v) => app.setBaseExposure?.(v),
    exit: () => exit(), // kontrak M4: interaktif pintu boleh keluar lewat ctx build
  });

  function runUndo(undo) {
    while (undo.length) {
      try {
        undo.pop()();
      } catch (err) {
        logger.error('Interior: pembongkaran gagal (dilanjutkan):', err);
      }
    }
  }

  /** Lepas hasil build (boleh parsial) + pohon scene + scope. */
  function releaseBuild(result, scope) {
    try { result?.dispose?.(); } catch (err) { logger.error('Interior: dispose hasil build gagal:', err); }
    try { if (result?.scene?.isObject3D) disposeTree(result.scene, { scope }); } catch (err) { logger.error('Interior: disposeTree gagal:', err); }
    scope.dispose();
  }

  function mount(def, built, scope, door) {
    const undo = [];
    try {
      const rig = factories.rig(built.camera, app.renderer?.domElement ?? null, {
        ceiling: def.size.h, isCameraClear: built.colliders.isCameraClear ?? null, bounds: photoBounds(def.size),
        baseFov: built.camera.fov, sensitivity: Number(storeGet('camera.sensitivity', 1)) || 1,
      });
      undo.push(() => rig.dispose());
      rig.yaw = def.spawn.yaw;
      // Material/geometri Humanoid pemain masuk scope interior (dilepas bersama scope saat keluar).
      const walker = withScope(scope, () => factories.walker({ spawn: def.spawn, collider: built.colliders }));
      undo.push(() => walker.dispose());
      built.scene.add(walker.group);
      const card = factories.card();
      undo.push(() => card.dispose());
      const c = { def, built, scope, door, rig, walker, card, undo, focus: null, wasPhoto: false, wasBlocked: false };
      const add = (system) => {
        app.addSystem(system);
        undo.push(() => app.removeSystem(system.id));
      };
      for (const system of built.systems) add(system);
      for (const system of portalSystems(c)) add(system);
      app.setSystemGate(isSystemActiveInside);
      undo.push(() => app.setSystemGate(null));
      const prevAo = Boolean(app.aoEnabled);
      if (!prevAo) app.setAO?.(true);
      undo.push(() => app.setAO?.(store ? Boolean(storeGet('graphics.ao', prevAo)) : prevAo));
      app.setView({ scene: built.scene, camera: built.camera, aoRadius: INTERIOR_AO_RADIUS });
      undo.push(() => app.setView(null));
      weather?.setSoundEnabled?.(false);
      undo.push(() => weather?.setSoundEnabled?.(Boolean(storeGet('weather.sound', true))));
      undo.push(() => hud?.setPrompt?.(null));
      return c;
    } catch (err) {
      runUndo(undo);
      throw err;
    }
  }

  function unmount(c) {
    runUndo(c.undo);
    releaseBuild(c.built, c.scope);
  }

  async function enter(id, { door = null } = {}) {
    if (state !== 'outside') return false;
    const def = interiors?.get?.(id);
    if (!def) {
      logger.error(`Interior "${id}" tidak terdaftar`);
      toast(LOCKED_TOAST, false);
      return false;
    }
    beforeEnter(def);
    setState('fadingIn');
    await fader.fade(1);
    const scope = createScope(`interior:${id}`);
    let result = null;
    try {
      result = await def.build(buildCtx(scope, door));
      validateInteriorBuild(result, id);
      current = mount(def, result, scope, door);
    } catch (err) {
      logger.error(`Interior "${id}" gagal dibuka:`, err);
      current = null;
      releaseBuild(result, scope);
      setState('outside');
      await fader.fade(0);
      toast(LOCKED_TOAST, false);
      return false;
    }
    setState('inside');
    onInsideChange(true);
    await fader.fade(0);
    return true;
  }

  function placeBikeAtExit(def) {
    if (!bike) return;
    const frame = regionManager?.frameOf?.(def.exitTo.region);
    if (!frame) return;
    const p = frame.toWorld(def.exitTo.x, def.exitTo.z);
    const s = bike.state;
    if (s && Number.isFinite(s.x) && Math.hypot(s.x - p.x, s.z - p.z) <= FAR_EXIT_M) return; // sepeda tetap
    bike.teleport(p.x, p.z, frame.yawToWorld(def.exitTo.yaw));
  }

  async function exit() {
    if (state !== 'inside' || !current) return false;
    const c = current;
    setState('fadingOut');
    await fader.fade(1);
    current = null;
    unmount(c);
    placeBikeAtExit(c.def);
    onInsideChange(false);
    setState('outside');
    await fader.fade(0);
    return true;
  }

  const interactCtx = (c) => ({
    rig: c.rig,
    walker: c.walker,
    toast: (text, ok = true) => toast(text, ok),
    exit: () => exit().catch((err) => logger.error('Keluar interior gagal:', err)),
    hour: Number.isFinite(time?.hour) ? time.hour : 12,
    raining: Boolean(weather?.isRaining),
  });

  function interact(c, item) {
    let res;
    try {
      res = item.onInteract(interactCtx(c));
    } catch (err) {
      logger.error(`Interaksi "${item.id}" gagal:`, err);
      toast('Belum bisa dipakai sekarang', false);
      return;
    }
    onInteracted(c.def.id, item.id);
    if (res && (res.title || res.text)) c.card.show({ title: res.title ?? item.label, text: res.text ?? '' });
  }

  function selectPreset(c) {
    PRESET_KEYS.forEach((code, i) => {
      if (!input.consumePress(code)) return;
      const preset = c.built.photoPresets[i];
      if (!preset) return;
      c.rig.applyPreset(preset.pose);
      toast(`Foto: ${preset.label}`, true);
    });
  }

  function handleKeys(c) {
    if (state !== 'inside') return;
    const photo = Boolean(isPhotoUi());
    const blocked = Boolean(isUiBlocking());
    const { wasPhoto, wasBlocked } = c;
    c.wasPhoto = photo;
    c.wasBlocked = blocked;
    if (photo !== c.rig.photo) c.rig.setPhoto(photo);
    if (c.card.open) {
      if (CLOSE_CARD_KEYS.some((code) => input.consumePress(code))) c.card.hide();
      return;
    }
    if (photo) {
      selectPreset(c);
      return;
    }
    if (c.rig.busy) {
      const stop = ['KeyE', 'Escape'].some((code) => input.consumePress(code)) || walkIntent(input, 0).forward !== 0;
      if (stop) c.rig.cancelPeek();
      return;
    }
    if (blocked) return;
    if (input.consumePress('KeyV') || input.consumePress('CameraCycle')) toast(c.rig.toggleMode() === 'third' ? 'Kamera: orang ketiga' : 'Kamera: orang pertama', true);
    if (input.consumePress('KeyE') && c.focus) interact(c, c.focus);
    // Esc yang baru menutup mode foto / panel / bantuan TIDAK ikut mengeluarkan pemain dari sekre.
    if (input.consumePress('Escape') && !wasPhoto && !wasBlocked) exit().catch((err) => logger.error('Keluar interior gagal:', err));
  }

  function updateFocus(c) {
    const off = state !== 'inside' || c.card.open || c.rig.photo || c.rig.busy;
    const s = c.walker.state;
    c.focus = off ? null : nearestInteractable(c.built.interactables, { x: s.x, y: INTERIOR_EYE_Y, z: s.z }, c.rig.viewDirection());
    hud?.setPrompt?.(c.focus ? `Tekan E — ${c.focus.prompt}` : null);
  }

  function portalSystems(c) {
    return [
      { id: 'interior.keys', phase: 'input', update: () => handleKeys(c) },
      {
        id: 'interior.walk',
        phase: 'sim',
        update: (dt) => {
          const blocked = state !== 'inside' || c.card.open || c.rig.photo || c.rig.busy || isUiBlocking();
          c.walker.update(dt, blocked ? { ...STILL, yaw: c.rig.yaw } : walkIntent(input, c.rig.yaw));
        },
      },
      { id: 'interior.interact', phase: 'sim', update: () => updateFocus(c) },
      {
        id: 'interior.camera',
        phase: 'camera',
        update: (dt) => {
          c.rig.update(c.walker.state, dt, c.rig.photo && !isUiBlocking() ? photoMove(input) : null);
          c.walker.setVisible(!c.rig.firstPersonView && !(c.rig.mode === 'third' && c.rig.walkerClose));
        },
      },
      {
        id: 'interior.hud',
        phase: 'ui',
        update: (dt, ctx) => {
          if (time) hud?.setTime?.(formatHour(time.hour), time.presetName, weather?.weatherName);
          hud?.tickFps?.(ctx?.rawDt ?? dt);
          hud?.setCameraMode?.(c.rig.mode);
        },
      },
    ];
  }

  return {
    get state() { return state; },
    get inside() { return state === 'inside'; },
    get busy() { return state === 'fadingIn' || state === 'fadingOut'; },
    /** Interior aktif (dev/E2E): { id, def, built, rig, walker, card } atau null. */
    get current() {
      return current && { id: current.def.id, def: current.def, built: current.built, rig: current.rig, walker: current.walker, card: current.card };
    },
    doors,
    /** Dipanggil portalTrigger (M4): enter(interiorId, { door: { ...pintu, worldYaw } }). */
    enter,
    exit,
    /** Router lihat (mouse/sentuh/gamepad) saat di dalam. */
    lookBy(dx, dy, scale = 1) {
      if (state === 'inside' && current) current.rig.lookBy(dx, dy, scale);
    },
    dispose() {
      if (current) {
        const c = current;
        current = null;
        unmount(c);
        onInsideChange(false);
      }
      state = 'outside';
    },
  };
}
