/**
 * Region manager (spec UNRI §4.4, M0): pemilik tunggal region terpasang; menggantikan variabel
 * `stadion`/`frame`/`remountRegion` di main.js.
 * - Region `activation.persistent` dipasang saat register (Promise handle; galat diteruskan ke pemanggil).
 * - Region streaming dipasang bila jarak fokus ke `activation.center` < mountRadius dan dilepas bila
 *   > unmountRadius (histeresis); maksimal satu mount per MOUNT_INTERVAL_MS dan satu mount berjalan
 *   sekaligus (terdekat lebih dulu). Mount streaming yang gagal dicatat dan dicoba lagi setelah MOUNT_RETRY_MS.
 * - Pelepasan LIFO: yang terakhir dipasang dilepas pertama (update & dispose).
 * - Tiap pasang/lepas: collider komposit (`collider.setRegions`), base layer minimap (bake setelah region
 *   siap; `attachMinimap` membake region aktif saat itu juga), proxy (siluet murah, tampil hanya saat region
 *   tidak terpasang), event 'mount'/'unmount' ({def, region, frame}).
 */
import { mountRegion as defaultMount, applyPlacement } from './mountRegion.js';
import { FLAT_TERRAIN } from './terrainService.js';
import { createRegionFrame } from '../geo/regionTransform.js';
import { regionContains, maskHalfExtent } from '../regions/Region.js';
import { createResourceScope } from '../engine/ResourceScope.js';
import { disposeTree } from '../engine/disposeTree.js';
import { freezeStatic } from '../engine/freezeStatic.js';

export const MOUNT_INTERVAL_MS = 500;
export const MOUNT_RETRY_MS = 10000;
export const PROXY_MAX_MESHES = 8;
export const MINIMAP_BAKE_MARGIN = 20; // m di luar mask pada peta dasar region
const EVENTS = Object.freeze(['mount', 'unmount']);

/** @typedef {{def: object, region: object, frame: object}} ActiveRegion */

const countMeshes = (root) => {
  let n = 0;
  root.traverse((o) => { if (o.isMesh) n += 1; });
  return n;
};

/**
 * @param {{app: {scene: object, bakeMinimap?: (half: number, center: {x:number,z:number}) => object,
 *     addSystem(s: object): object, removeSystem(id: string): boolean},
 *   store?: object|null, time?: object|null, weather?: object|null, terrain?: object,
 *   collider?: {setRegions(list: Array<{region: object, colliders: object}>): void}|null,
 *   minimap?: {setBaseLayer: Function, removeBaseLayer: Function}|null, createScope?: (name: string) => object,
 *   scheduler?: object|null, mount?: Function, now?: () => number,
 *   logger?: {error: (...a: unknown[]) => void, warn?: (...a: unknown[]) => void}}} opts
 *   scheduler/mount/now/logger: tambahan M0 (injeksi untuk tes); kontrak spec §4.4 tidak berubah.
 */
export function createRegionManager({
  app, store = null, time = null, weather = null, terrain = FLAT_TERRAIN, collider = null, minimap = null,
  createScope = createResourceScope, scheduler = null, mount = defaultMount, now = () => performance.now(), logger = console,
} = {}) {
  if (!app?.scene) throw new TypeError('createRegionManager: app.scene wajib');
  const entries = new Map(); // id -> { def, frame, status:'idle'|'mounting'|'mounted', handle, proxy, failedAt }
  let order = [];            // id terpasang, urut pemasangan
  let active = Object.freeze([]);
  let listeners = { mount: [], unmount: [] };
  let inFlight = new Set();
  let lastMountAt = -Infinity;
  let minimapRef = minimap;
  let disposed = false;

  const patch = (id, fields) => {
    const e = entries.get(id);
    if (e) entries.set(id, { ...e, ...fields });
  };
  const recordOf = (e) => Object.freeze({ def: e.def, region: e.handle.region, frame: e.frame });

  const refreshActive = () => {
    active = Object.freeze(order.map((id) => recordOf(entries.get(id))));
    collider?.setRegions(active.map((a) => ({ region: a.def, colliders: a.region.colliders })));
  };

  const emit = (type, record) => {
    for (const fn of listeners[type]) {
      try {
        fn(record);
      } catch (err) {
        logger.error(`RegionManager: listener "${type}" gagal (dilanjutkan):`, err);
      }
    }
  };

  /** Bake peta dasar region (tampak atas area mask + margin) ke base layer minimap. */
  const bake = (id) => {
    const e = entries.get(id);
    if (!minimapRef || !e || typeof app.bakeMinimap !== 'function') return;
    // Minimap hanya pelengkap: GPU yang gagal mengalokasikan target/readPixels tidak boleh menggagalkan game.
    const fail = (err) => logger.error(`Minimap dasar region "${id}" gagal dibuat, minimap memakai latar polos:`, err);
    try {
      const half = Math.ceil(maskHalfExtent(e.def.mask)) + MINIMAP_BAKE_MARGIN;
      const p = e.def.placement;
      const handle = e.handle;
      const place = (image) => {
        if (entries.get(id)?.handle !== handle) return; // region dilepas/dipasang ulang selama bake asinkron
        minimapRef?.setBaseLayer(id, image, { center: { x: p.x, z: p.z }, half, yaw: 0 });
      };
      // Asinkron bila ada (readback tanpa membekukan thread); cadangan sinkron untuk App lama/tes
      if (typeof app.bakeMinimapAsync === 'function') app.bakeMinimapAsync(half, p).then(place, fail);
      else place(app.bakeMinimap(half, p));
    } catch (err) {
      fail(err);
    }
  };

  const buildProxy = (def) => {
    const scope = createScope(`proxy:${def.id}`);
    try {
      const built = def.proxy({ scope, placement: def.placement, terrain });
      if (!built?.group?.isObject3D || typeof built.dispose !== 'function') {
        throw new TypeError(`Region "${def.id}": proxy(ctx) harus mengembalikan { group, dispose }`);
      }
      const meshes = countMeshes(built.group);
      if (meshes > PROXY_MAX_MESHES) logger.warn?.(`Proxy region "${def.id}": ${meshes} mesh > ${PROXY_MAX_MESHES} (budget draw call proxy)`);
      applyPlacement(built.group, def.placement);
      app.scene.add(built.group);
      freezeStatic(built.group);
      return { group: built.group, dispose: built.dispose, scope };
    } catch (err) {
      scope.dispose();
      logger.error(`Proxy region "${def.id}" gagal dibuat (dilewati):`, err);
      return null;
    }
  };

  const disposeProxy = (proxy) => {
    try {
      proxy.dispose();
    } catch (err) {
      logger.error('Proxy region gagal di-dispose (dilanjutkan):', err);
    }
    proxy.group.removeFromParent();
    disposeTree(proxy.group, { scope: proxy.scope });
    proxy.scope.dispose();
  };

  const onMounted = (id, handle) => {
    if (disposed || !entries.has(id)) {
      handle.unmount(); // manager dibongkar selama mount berjalan
      return null;
    }
    patch(id, { status: 'mounted', handle });
    order = [...order, id];
    refreshActive();
    const e = entries.get(id);
    if (e.proxy) { // proxy tetap tampil sampai region tampil (shader hangat), lalu disembunyikan
      Promise.resolve(handle.shown).catch(() => null).then(() => {
        const cur = entries.get(id);
        if (cur?.handle === handle && handle.mounted && cur.proxy) cur.proxy.group.visible = false;
      });
    }
    emit('mount', recordOf(e));
    if (minimapRef) {
      handle.ready.catch(() => null).then(() => {
        if (entries.get(id)?.handle === handle && handle.mounted) bake(id);
      });
    }
    return handle;
  };

  const mountEntry = (id, { rethrow = false } = {}) => {
    const { def } = entries.get(id);
    patch(id, { status: 'mounting' });
    const opts = { store, time, weather, terrain, scheduler, createScope, logger };
    const job = Promise.resolve()
      .then(() => mount(app, def, opts))
      .then((handle) => onMounted(id, handle), (err) => {
        patch(id, { status: 'idle', failedAt: now() });
        if (rethrow) throw err;
        logger.error(`Region "${id}" gagal dipasang (dicoba lagi setelah ${MOUNT_RETRY_MS / 1000} s):`, err);
        return null;
      })
      .finally(() => {
        inFlight = new Set([...inFlight].filter((p) => p !== job));
      });
    inFlight = new Set([...inFlight, job]);
    return job;
  };

  const unmountEntry = (id) => {
    const e = entries.get(id);
    if (e?.status !== 'mounted') return false;
    const record = recordOf(e);
    order = order.filter((x) => x !== id);
    patch(id, { status: 'idle', handle: null });
    refreshActive(); // collider tidak lagi merutekan ke region yang akan dibongkar
    minimapRef?.removeBaseLayer(id);
    emit('unmount', record);
    e.handle.unmount();
    if (e.proxy) e.proxy.group.visible = true;
    return true;
  };

  const flush = () => Promise.allSettled([...inFlight]).then(() => undefined);

  return {
    /**
     * Daftarkan region (hasil defineRegion). Persistent: dipasang sekarang → Promise handle mountRegion.
     * Streaming: proxy dibuat (bila ada), dipasang oleh update() → Promise null.
     */
    register(def) {
      if (disposed) throw new Error('RegionManager sudah di-dispose');
      if (typeof def?.id !== 'string' || !def.activation || typeof def.build !== 'function') {
        throw new TypeError('RegionManager.register: def harus hasil defineRegion (id, activation, build)');
      }
      if (entries.has(def.id)) throw new Error(`RegionManager: region "${def.id}" sudah terdaftar`);
      entries.set(def.id, {
        def, frame: createRegionFrame(def.placement), status: 'idle', handle: null, proxy: null, failedAt: -Infinity,
      });
      if (def.activation.persistent) return mountEntry(def.id, { rethrow: true });
      if (typeof def.proxy === 'function') patch(def.id, { proxy: buildProxy(def) });
      return Promise.resolve(null);
    },

    /** Tiap frame: pasang/lepas region streaming menurut fokus dunia (histeresis, LIFO, laju mount). */
    update(focus) {
      if (disposed || !Number.isFinite(focus?.x) || !Number.isFinite(focus?.z)) return;
      const t = now();
      let far = null;
      let best = null;
      for (const e of entries.values()) {
        const act = e.def.activation;
        if (act.persistent) continue;
        const d = Math.hypot(focus.x - act.center.x, focus.z - act.center.z);
        if (e.status === 'mounted' && d > act.unmountRadius) {
          far = far ?? [];
          far.push(e.def.id);
        } else if (e.status === 'idle' && d < act.mountRadius && t - e.failedAt >= MOUNT_RETRY_MS && (!best || d < best.d)) {
          best = { id: e.def.id, d };
        }
      }
      if (far) {
        const snapshot = order;
        for (let i = snapshot.length - 1; i >= 0; i -= 1) if (far.includes(snapshot[i])) unmountEntry(snapshot[i]); // LIFO
      }
      if (best && inFlight.size === 0 && t - lastMountAt >= MOUNT_INTERVAL_MS) {
        lastMountAt = t;
        mountEntry(best.id);
      }
    },

    /** @returns {ReadonlyArray<ActiveRegion>} region terpasang, urut pemasangan */
    active: () => active,
    /** Frame region terdaftar (terpasang atau tidak); null bila id tak dikenal. */
    frameOf: (id) => entries.get(id)?.frame ?? null,
    /** Id region terpasang yang mask-nya memuat titik dunia (x, z); null bila tidak ada. */
    regionAt(x, z) {
      for (const a of active) if (regionContains(a.def, x, z)) return a.def.id;
      return null;
    },
    /** Handle mountRegion region terpasang (ready, region, mounted); null bila tidak terpasang. */
    handleOf: (id) => entries.get(id)?.handle ?? null,

    /** @param {'mount'|'unmount'} type @returns {() => void} pelepas listener */
    on(type, fn) {
      if (!EVENTS.includes(type)) throw new TypeError(`RegionManager.on: event "${type}" tidak dikenal (mount|unmount)`);
      if (typeof fn !== 'function') throw new TypeError('RegionManager.on: fn harus fungsi');
      listeners = { ...listeners, [type]: [...listeners[type], fn] };
      return () => { listeners = { ...listeners, [type]: listeners[type].filter((f) => f !== fn) }; };
    },

    /** Pasang minimap; base layer region aktif dibake SEKARANG, region berikutnya setelah siap. */
    attachMinimap(m) {
      if (typeof m?.setBaseLayer !== 'function' || typeof m?.removeBaseLayer !== 'function') {
        throw new TypeError('RegionManager.attachMinimap: minimap butuh setBaseLayer/removeBaseLayer');
      }
      minimapRef = m;
      for (const id of order) bake(id);
    },

    /** Dev/E2E: lepas lalu pasang ulang region (tanpa batas laju). @returns {Promise<unknown>} ready region baru */
    async remount(id) {
      if (!entries.has(id)) throw new Error(`RegionManager.remount: region "${id}" tidak terdaftar`);
      await flush();
      unmountEntry(id);
      const handle = await mountEntry(id, { rethrow: true });
      return handle ? handle.ready : null;
    },

    /** Selesai saat semua mount yang sedang berjalan selesai (berhasil atau gagal). */
    flush,

    /** Lepas semua region (LIFO) lalu semua proxy; idempoten. */
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const id of [...order].reverse()) unmountEntry(id);
      for (const e of [...entries.values()].reverse()) if (e.proxy) disposeProxy(e.proxy);
      entries.clear();
      listeners = { mount: [], unmount: [] };
    },
  };
}
