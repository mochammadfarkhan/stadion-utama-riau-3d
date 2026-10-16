/**
 * Pasang region handmade ke App dan bongkar lagi (Plan C, I1/I2):
 * build (ResourceScope milik region) → placement pada region.group → scene + freezeStatic →
 * registry emissive/basah/lampu → sistem region. unmount() membongkar TERBALIK: sistem dicabut
 * (dispose dipanggil SystemRunner), registry dilepas, lalu region.dispose() (disposeTree + scope).
 * Build yang melempar melepas scope-nya; kegagalan setelah build menggulung balik pemasangan.
 */
import { createResourceScope } from '../engine/ResourceScope.js';
import { freezeStatic } from '../world/util/freezeStatic.js';

/** Terapkan placement {x, z, yaw} ke grup region (rotasi sumbu +Y = regionTransform.toWorld). */
export function applyPlacement(group, placement) {
  group.position.set(placement.x, 0, placement.z);
  group.rotation.set(0, placement.yaw, 0);
  group.updateMatrix();
  return group;
}

/**
 * @param {{scene: import('three').Scene, renderer?: object, camera?: object, timer?: object,
 *   addSystem(s: object): object, removeSystem(id: string): boolean}} app
 * @param {{id: string, placement: {x:number,z:number,yaw:number}, build(ctx: object): Promise<object>}} def
 * @param {{store?: object|null, time?: {registerEmissive(root: object): () => boolean,
 *   registerLamps?(opts: object): () => boolean}|null, weather?: {registerWet(root: object): () => boolean}|null,
 *   createScope?: (name: string) => object, logger?: {error: (...args: unknown[]) => void}}} [opts]
 * @returns {Promise<{def: object, region: object, ready: Promise<unknown>, mounted: boolean, unmount(): void}>}
 */
export async function mountRegion(app, def, {
  store = null, time = null, weather = null, createScope = createResourceScope, logger = console,
} = {}) {
  const scope = createScope(`region:${def.id}`);
  let region;
  try {
    region = await def.build({
      scene: app.scene, renderer: app.renderer, camera: app.camera, scope, store, clock: app.timer, placement: def.placement,
    });
  } catch (err) {
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
    unwind();
    throw err;
  }
  let mounted = true;
  // Konten yang datang belakangan (model GLB) baru terdaftar setelah siap, dan hanya bila masih terpasang.
  const ready = Promise.resolve(region.ready).then((result) => {
    if (mounted && time && region.lateRoot) undo.push(time.registerEmissive(region.lateRoot));
    return result;
  });
  return {
    def,
    region,
    ready,
    get mounted() { return mounted; },
    unmount() {
      if (!mounted) return;
      mounted = false;
      unwind();
    },
  };
}
