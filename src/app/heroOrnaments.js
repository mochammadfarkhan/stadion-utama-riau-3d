// src/app/heroOrnaments.js
/**
 * Lapisan ornamen GLB hero DISTRIK (M6; N04 kubah mozaik Masjid Arfa'unnas). Hero distrik digabung per
 * material per klaster sehingga pola `replaces` tidak berlaku; GLB dimuat sekali ke scope sendiri,
 * diletakkan di koordinat dunia (y = tanah + yAboveGround, dihitung ulang saat versi terrain berubah),
 * tampil ≤ ORNAMENT_VISIBLE_M dari fokus, dan placeholder prosedural disembunyikan lewat registry material
 * (src/world/kit/hero/ornaments.js). Gagal muat → placeholder tetap tampil (spec §10).
 */
import * as THREE from 'three';
import { createResourceScope, withScope } from '../engine/ResourceScope.js';
import { disposeTree } from '../engine/disposeTree.js';
import { instantiateModel } from '../world/assets/models.js';
import { HERO_ORNAMENTS } from '../world/kit/hero/index.js';
import { setOrnamentLoaded } from '../world/kit/hero/ornaments.js';

export const ORNAMENT_VISIBLE_M = 900;

/**
 * @param {{scene: THREE.Scene, terrain?: {heightAt(x:number, z:number):number, version?:number}|null,
 *   items?: ReadonlyArray<{assetId:string, path:string, x:number, z:number, rotY:number, yAboveGround:number}>,
 *   logger?: {warn: Function}}} opts
 */
export function createHeroOrnamentLayer({ scene, terrain = null, items = HERO_ORNAMENTS, logger = console }) {
  const scope = createResourceScope('heroOrnaments');
  const group = new THREE.Group();
  group.name = 'ornamenHero';
  scene.add(group);
  const placed = [];
  let disposed = false;
  let lastVersion = Number.NaN;
  const groundAt = (x, z) => terrain?.heightAt?.(x, z) ?? 0;
  const place = ({ it, obj }) => obj.position.set(it.x, groundAt(it.x, it.z) + it.yAboveGround, it.z);
  const ready = Promise.allSettled(items.map(async (it) => {
    const obj = await withScope(scope, () => instantiateModel(it.path, { rotY: it.rotY }));
    if (disposed) return;
    obj.name = it.assetId;
    const entry = { it, obj };
    place(entry);
    group.add(obj);
    placed.push(entry);
    setOrnamentLoaded(it.assetId, true);
  })).then((results) => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') logger.warn(`Ornamen ${items[i].assetId} (${items[i].path}) gagal dimuat; placeholder prosedural dipakai:`, r.reason);
    });
    return { placed: placed.length, failed: results.filter((r) => r.status === 'rejected').length };
  });
  return {
    group,
    ready,
    /** Tiap frame: posisi y ikut versi terrain; tampil hanya dalam jarak dari fokus. */
    update(focus) {
      const v = terrain?.version ?? 0;
      if (v !== lastVersion) {
        lastVersion = v;
        placed.forEach(place);
      }
      for (const { it, obj } of placed) obj.visible = !focus || Math.hypot(focus.x - it.x, focus.z - it.z) <= ORNAMENT_VISIBLE_M;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const it of items) setOrnamentLoaded(it.assetId, false);
      group.removeFromParent();
      disposeTree(group, { scope });
      scope.dispose();
    },
  };
}
