/**
 * Pasang region handmade ke App dan bongkar lagi (Plan C, I1/I2; perluasan M0 UNRI):
 * build (ResourceScope milik region; ctx + terrain/heightAtLocal/schedule) → placement pada region.group →
 * scene + freezeStatic → registry emissive/basah/lampu → sistem region. unmount() membatalkan antrean
 * scheduler milik region lalu membongkar TERBALIK: sistem dicabut (dispose dipanggil SystemRunner), registry
 * dilepas, lalu region.dispose() (disposeTree + scope). Build yang melempar melepas scope & antreannya;
 * kegagalan setelah build menggulung balik pemasangan. `ready` selesai setelah konten belakangan (GLB) DAN
 * antrean scheduler region habis. Region ber-proxy (hero yang di-stream) disembunyikan sampai `ready` + shader
 * dihangatkan (App.warmup) agar frame pertamanya tidak membeku menunggu kompilasi (rencana performa Fase 2); proxy
 * tetap tampil sampai `shown` selesai. Batas SHOW_TIMEOUT_MS: region selalu tampil walau konten belakangan macet.
 */
import { createResourceScope } from '../engine/ResourceScope.js';
import { runTaskNow } from '../engine/scheduler.js';
import { freezeStatic } from '../world/util/freezeStatic.js';
import { toWorld } from '../geo/regionTransform.js';
import { FLAT_TERRAIN } from './terrainService.js';

const SHOW_TIMEOUT_MS = 20000;

/** Terapkan placement {x, z, yaw} ke grup region (rotasi sumbu +Y = regionTransform.toWorld). */
export function applyPlacement(group, placement) {
  group.position.set(placement.x, 0, placement.z);
  group.rotation.set(0, placement.yaw, 0);
  group.updateMatrix();
  return group;
}

/** Antrean task region: scheduler bersama (time-sliced) atau langsung (tanpa scheduler: tes/alat). */
function regionQueue(scheduler, owner) {
  if (!scheduler) {
    return {
      schedule: (task) => { runTaskNow(task); return { cancel() {} }; },
      cancel() {},
      idle: () => Promise.resolve(),
    };
  }
  return {
    schedule: (task) => scheduler.schedule(task, { owner }),
    cancel: () => scheduler.cancelOwner(owner),
    idle: () => scheduler.whenIdle(owner),
  };
}

/**
 * @param {{scene: import('three').Scene, renderer?: object, camera?: object, timer?: object,
 *   addSystem(s: object): object, removeSystem(id: string): boolean}} app
 * @param {{id: string, placement: {x:number,z:number,yaw:number}, build(ctx: object): Promise<object>}} def
 * @param {{store?: object|null, time?: {registerEmissive(root: object): () => boolean,
 *   registerLamps?(opts: object): () => boolean}|null, weather?: {registerWet(root: object): () => boolean}|null,
 *   terrain?: {heightAt(x: number, z: number): number}, scheduler?: {schedule: Function, cancelOwner: Function, whenIdle: Function}|null,
 *   createScope?: (name: string) => object, logger?: {error: (...args: unknown[]) => void}}} [opts]
 * @returns {Promise<{def: object, region: object, ready: Promise<unknown>, shown: Promise<void>, mounted: boolean, unmount(): void}>}
 */
export async function mountRegion(app, def, {
  store = null, time = null, weather = null, terrain = FLAT_TERRAIN, scheduler = null, createScope = createResourceScope, logger = console,
} = {}) {
  const scope = createScope(`region:${def.id}`);
  const queue = regionQueue(scheduler, `region:${def.id}`);
  const hideUntilWarm = typeof def.proxy === 'function' && typeof app.warmup === 'function'; // ada proxy yang menutupi
  const heightAtLocal = (lx, lz) => {
    const w = toWorld(def.placement, lx, lz);
    return terrain.heightAt(w.x, w.z);
  };
  let region;
  try {
    region = await def.build({
      scene: app.scene, renderer: app.renderer, camera: app.camera, scope, store, clock: app.timer, placement: def.placement,
      terrain, heightAtLocal, schedule: queue.schedule,
    });
  } catch (err) {
    queue.cancel(); // task yang sempat dijadwalkan build tidak boleh menyentuh region gagal
    scope.dispose(); // build gagal: scope tidak boleh bocor
    throw err;
  }
  const undo = []; // LIFO
  const unwind = () => {
    while (undo.length) {
      const fn = undo.pop();
      try {
        fn();
      } catch (err) {
        logger.error(`Region "${def.id}": pembongkaran gagal (dilanjutkan):`, err);
      }
    }
  };
  try {
    undo.push(() => region.dispose());
    applyPlacement(region.group, def.placement);
    if (hideUntilWarm) region.group.visible = false;
    app.scene.add(region.group);
    freezeStatic(region.group);
    if (time) undo.push(time.registerEmissive(region.group));
    if (time?.registerLamps && region.nightLights) undo.push(time.registerLamps({ ...region.nightLights, lensRoot: region.group }));
    if (weather) undo.push(weather.registerWet(region.group));
    for (const system of region.systems) {
      app.addSystem(system);
      undo.push(() => app.removeSystem(system.id));
    }
  } catch (err) {
    queue.cancel();
    unwind();
    throw err;
  }
  let mounted = true;
  let showTimer = null;
  // Konten yang datang belakangan (model GLB) baru terdaftar setelah siap, dan hanya bila masih terpasang.
  // ready juga menunggu antrean scheduler region (build inkremental) habis.
  const ready = Promise.resolve(region.ready).then(async (result) => {
    await queue.idle();
    if (mounted && time && region.lateRoot) undo.push(time.registerEmissive(region.lateRoot));
    if (mounted && weather && region.lateRoot && region.lateRootWet === true) undo.push(weather.registerWet(region.lateRoot));
    return result;
  });
  // Tampilkan setelah siap + shader hangat (atau habis waktu); urutan: ready → warmup → visible.
  const shown = !hideUntilWarm ? Promise.resolve() : Promise.race([
    ready.catch(() => null).then(() => (mounted ? app.warmup(region.group) : null)).catch((err) => {
      logger.error(`Region "${def.id}": pemanasan shader gagal (tetap ditampilkan):`, err);
    }),
    new Promise((resolve) => { showTimer = setTimeout(resolve, SHOW_TIMEOUT_MS); }),
  ]).then(() => {
    clearTimeout(showTimer);
    if (mounted) region.group.visible = true;
  });
  return {
    def,
    region,
    ready,
    /** Selesai saat region tampil (setelah shader hangat); manager menyembunyikan proxy sesudahnya. */
    shown,
    get mounted() { return mounted; },
    unmount() {
      if (!mounted) return;
      mounted = false;
      clearTimeout(showTimer);
      queue.cancel();
      unwind();
    },
  };
}
