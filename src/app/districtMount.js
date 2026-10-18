/**
 * Pasang distrik (spec §4.2) ke App dan bongkar lagi: build (ResourceScope milik distrik) → scene →
 * registry basah → sistem → collider komposit (region → distrik → tile) → lubang tanah dasar kota →
 * lapisan minimap. dispose() membongkar TERBALIK. Build gagal (manifest/terrain tak valid) → null +
 * toast: permainan berlanjut tanpa distrik (spec §10). Distrik memakai ChunkStreamer & fetch milik
 * city/ lewat injeksi (lapisan districts/ tidak boleh mengimpor city/).
 */
import * as THREE from 'three';
import { createResourceScope } from '../engine/ResourceScope.js';
import { validateDistrictBuild } from '../districts/District.js';
import { createChunkStreamer } from '../city/ChunkStreamer.js';
import { fetchJson as defaultFetchJson } from '../city/TileLoader.js';
import { fetchArrayBuffer as defaultFetchArrayBuffer } from '../districts/terrainChunks.js';
import { createDistrictRegistries } from './districtRegistries.js';

export const DISTRICT_MINIMAP_PX = 1024;
const MINIMAP_MARGIN = 20; // m di luar bbox batas

/** Persegi minimap (utara di atas) yang memuat bbox batas; toCanvas memetakan dunia → piksel. */
export function minimapView(bounds, size = DISTRICT_MINIMAP_PX, margin = MINIMAP_MARGIN) {
  const center = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
  const half = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + margin;
  const scale = size / (2 * half);
  return {
    center, half, size, scale,
    toCanvas: (x, z) => [(x - (center.x - half)) * scale, (z - (center.z - half)) * scale],
  };
}

/** Tekstur R8 sel lubang (data dibagi dengan distrik: needsUpdate saat berubah). */
export function createHoleTexture(hole) {
  const tex = new THREE.DataTexture(hole.data, hole.cols, hole.rows, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.unpackAlignment = 1; // lebar 625 bukan kelipatan 4
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

const defaultCanvas = (w, h) => {
  if (typeof document === 'undefined') return null;
  return Object.assign(document.createElement('canvas'), { width: w, height: h });
};

/**
 * @param {{scene: THREE.Scene, addSystem(s:object):object, removeSystem(id:string):boolean}} app
 * @param {ReturnType<typeof import('../districts/District.js').defineDistrict>} def
 * @param {{terrain:{field:object, heightAt:Function}, scheduler:{schedule:Function, cancelOwner(owner:string):void, pending(owner?:string):number},
 *   collider?:{addDistrict(d:object):() => void}|null, minimap?:{setBaseLayer(id:string, canvas:object, o:object):void,
 *   removeBaseLayer(id:string):void}|null, city?:{setGroundHole(h:object|null):void}|null,
 *   weather?:{registerWet(root:object):() => boolean}|null, time?:{registerEmissive, registerLamps}|null,
 *   isReserved?:(x:number, z:number) => boolean, createScope?:(name:string) => object, baseUrl?:string,
 *   toast?:(text:string, ok:boolean) => void, logger?:{error:(...a:unknown[]) => void},
 *   createStreamer?:(o:object) => object, fetchJson?:(url:string) => Promise<unknown>,
 *   fetchArrayBuffer?:(url:string) => Promise<ArrayBuffer>, createCanvas?:(w:number, h:number) => object|null}} opts
 * @returns {Promise<{def:object, district:object, readonly mounted:boolean, whenSettled(x:number, z:number):Promise<boolean>,
 *   dispose():void}|null>}
 */
export async function mountDistrict(app, def, {
  terrain, scheduler, collider = null, minimap = null, city = null, weather = null, time = null,
  isReserved = () => false, createScope = createResourceScope,
  baseUrl = '/', toast = () => {}, logger = console, createStreamer = (o) => createChunkStreamer(o),
  fetchJson = defaultFetchJson, fetchArrayBuffer = defaultFetchArrayBuffer, createCanvas = defaultCanvas,
} = {}) {
  const owner = `district:${def.id}`;
  const scope = createScope(owner);
  let holeTexture = null;
  let warned = false;
  let district;
  const registries = createDistrictRegistries({ time, weather, logger });
  try {
    district = validateDistrictBuild(await def.build({
      scene: app.scene, scope, terrain, scheduler, owner, baseUrl, fetchJson, fetchArrayBuffer, createStreamer, logger,
      registries, isReserved, toast,
      onTerrainFail: () => {
        if (warned) return;
        warned = true;
        toast('Sebagian terrain kampus gagal dimuat — area itu datar', false);
      },
      groundHoleChanged: () => { if (holeTexture) holeTexture.needsUpdate = true; },
    }), def.id);
  } catch (err) {
    scheduler.cancelOwner(owner);
    registries.dispose();
    scope.dispose();
    logger.error(`Distrik "${def.id}" gagal dipasang; lanjut tanpa distrik:`, err);
    toast('Kawasan kampus gagal dimuat — peta kota tetap tersedia', false);
    return null;
  }
  const undo = []; // LIFO
  const unwind = () => {
    while (undo.length) {
      const fn = undo.pop();
      try {
        fn();
      } catch (err) {
        logger.error(`Distrik "${def.id}": pembongkaran gagal (dilanjutkan):`, err);
      }
    }
  };
  try {
    undo.push(() => registries.dispose()); // LIFO: dicabut sesudah district.dispose()
    undo.push(() => district.dispose());
    app.scene.add(district.group);
    undo.push(() => district.group.removeFromParent());
    if (weather) undo.push(weather.registerWet(district.group));
    for (const system of district.systems) {
      app.addSystem(system);
      undo.push(() => app.removeSystem(system.id));
    }
    if (collider) undo.push(collider.addDistrict({ id: def.id, boundary: def.boundary, bounds: def.bounds, colliders: district.colliders }));
    if (city && district.groundHole) {
      const h = district.groundHole;
      holeTexture = createHoleTexture(h);
      city.setGroundHole({ texture: holeTexture, rect: { minX: h.minX, minZ: h.minZ, maxX: h.minX + h.cols * h.cell, maxZ: h.minZ + h.rows * h.cell } });
      undo.push(() => {
        city.setGroundHole(null);
        holeTexture.dispose();
        holeTexture = null;
      });
    }
    const view = minimapView(def.bounds);
    const canvas = minimap ? createCanvas(view.size, view.size) : null;
    const ctx2d = canvas?.getContext?.('2d');
    if (ctx2d) {
      district.minimapLayer(ctx2d, view);
      const id = `district:${def.id}`;
      minimap.setBaseLayer(id, canvas, { center: view.center, half: view.half, yaw: 0 });
      undo.push(() => minimap.removeBaseLayer(id));
    }
  } catch (err) {
    unwind();
    scheduler.cancelOwner(owner);
    scope.dispose();
    logger.error(`Distrik "${def.id}": pemasangan gagal, digulung balik:`, err);
    toast('Kawasan kampus gagal dimuat — peta kota tetap tersedia', false);
    return null;
  }
  let mounted = true;
  return {
    def,
    district,
    get mounted() { return mounted; },
    whenSettled: (x, z) => (mounted ? district.whenSettled(x, z) : Promise.resolve(false)),
    dispose() {
      if (!mounted) return;
      mounted = false;
      scheduler.cancelOwner(owner);
      unwind();
      scope.dispose();
    },
  };
}
