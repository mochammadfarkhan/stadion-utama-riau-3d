/**
 * Region hero "unri-lembaga" (spec §8.1, tonggak M4): Sekretariat Lembaga Mahasiswa (H01, handmade) + teras,
 * gedung UKM blok biru (H09, GLB; sekre pemain ERC) + kompleks lapangan + gubuk panahan + vegetasi sekitar,
 * Stadion Mini UNRI (H02), Student Center (H03, K03 hero), detail Rusunawa & FH Panam, parkiran motor.
 * build() cepat: data murni + permukaan basah (sinkron, agar registerWet saat mount melihatnya); rakitan berat
 * lewat ctx.schedule (satu yield per langkah) ke `lateRoot`; `ready` resolve setelah antrean habis (atau
 * {cancelled:true} bila region dilepas lebih dulu). Gedung H01–H03 milik region (HERO_BUILDERS kosong).
 */
import * as THREE from 'three';
import { defineRegion, validateBuild } from '../Region.js';
import { withScope } from '../../engine/ResourceScope.js';
import { disposeTree } from '../../engine/disposeTree.js';
import { freezeStatic } from '../../engine/freezeStatic.js';
import { toWorld } from '../../geo/regionTransform.js';
import { LEMBAGA_PLACEMENT, UNRI_LEMBAGA_ID, SEKRE_FRAME } from './placement.js';
import { LEMBAGA_MASK, LEMBAGA_ACTIVATION } from './mask.js';
import { LEMBAGA_PADS } from './pads.js';
import { LEMBAGA_LAYOUT } from './layout.js';
import { lembagaColliders } from './collider.js';
import { PORTAL_DOORS } from './portalDoors.js';
import { lembagaMaterials } from './materials.js';
import { createSekretariatBuilder, createSekreSurfaces } from './sekretariat.js';
import { createTerraceBuilder } from './terrace.js';
import { createStadionMiniBuilder, createStadionMiniSurfaces } from './stadionMini.js';
import { createStudentCenterBuilder } from './studentCenter.js';
import { createRusunDetailBuilder } from './rusun.js';
import { createFhDetailBuilder } from './fhMangkrak.js';
import { createParkingBuilder, upgradeSekreMotors } from './parking.js';
import { createUkmHeroBuilder, upgradeUkmAssets } from './sekretariatUkm.js';
import { createKompleksBuilder } from './kompleks.js';
import { createYardPropsBuilder } from './yardProps.js';
import { createUkmVegetationBuilder, ukmPlantPoints, fallbackTreeCells } from './ukmVegetation.js';
import { createUkmRoadsideBuilder, ukmLampHeads } from './ukmRoadside.js';
import { treeInstances, upgradeUkmTrees } from './ukmTrees.js';
import { registerContactSource } from '../../engine/contactShadows.js';

import { createHeroLodSystem } from '../heroLod.js';

const CONTACT_RADIUS = 32; // m: pohon sekitar pemain yang diberi contact shadow
import { UKM_FRAME } from './sekreUkm.data.js';
import { buildLembagaProxy } from './proxy.js';
import { LEMBAGA_POVS } from './povs.js';

export { UNRI_LEMBAGA_ID, LEMBAGA_PLACEMENT };
export const LEMBAGA_GROUP_NAME = `region:${UNRI_LEMBAGA_ID}`;

/** Tinggi tanah region-lokal & dunia (datar bila terrain tidak ada, mis. tes). */
function heightFns(ctx) {
  const local = typeof ctx.heightAtLocal === 'function' ? (x, z) => ctx.heightAtLocal(x, z) : () => 0;
  const world = typeof ctx.terrain?.heightAt === 'function'
    ? (x, z) => ctx.terrain.heightAt(x, z)
    : (x, z) => local(x - LEMBAGA_PLACEMENT.x, z - LEMBAGA_PLACEMENT.z);
  return { local, world };
}

/**
 * Jalankan builder bertahap lewat ctx.schedule (generator; satu yield per langkah) atau sinkron bila tidak
 * ada scheduler. Resolve dengan hasil finish(), atau null bila dibatalkan.
 */
function runSteps(ctx, scope, builder, isCancelled) {
  return new Promise((resolve, reject) => {
    function* task() {
      try {
        for (const step of builder.steps) {
          if (isCancelled()) {
            resolve(null);
            return;
          }
          withScope(scope, step);
          yield;
        }
        resolve(isCancelled() ? null : withScope(scope, () => builder.finish()));
      } catch (err) {
        reject(err);
      }
    }
    if (typeof ctx.schedule === 'function') ctx.schedule(task);
    else for (const _ of task()) { /* sinkron */ }
  });
}

function buildLembaga(ctx) {
  const { scope } = ctx;
  if (!scope) throw new TypeError(`Region ${UNRI_LEMBAGA_ID}: ctx.scope (ResourceScope) wajib`);
  const h = heightFns(ctx);
  const group = new THREE.Group();
  group.name = LEMBAGA_GROUP_NAME;
  const content = new THREE.Group();
  content.name = 'lembaga:konten';
  let disposed = false;
  let signalDisposed = () => {};
  const disposedSignal = new Promise((resolve) => { signalDisposed = resolve; });
  const isCancelled = () => disposed;
  const sekreY = h.local(SEKRE_FRAME.x, SEKRE_FRAME.z);
  const ukmY = h.local(UKM_FRAME.x, UKM_FRAME.z);
  const { mats, atlas } = withScope(scope, () => lembagaMaterials());
  withScope(scope, () => group.add(createSekreSurfaces({ baseY: sekreY, mats }), createStadionMiniSurfaces({ heightAt: h.local })));
  group.add(content);

  const makers = [
    () => createSekretariatBuilder({ baseY: sekreY, mats, atlas }),
    () => createTerraceBuilder({ heightAt: h.local, mats, atlas }),
    () => createParkingBuilder({ heightAt: h.local }),
    () => createYardPropsBuilder({ heightAt: h.local }),
    () => createUkmHeroBuilder({ baseY: ukmY, mats }),
    () => createKompleksBuilder({ heightAt: h.local }),
    () => createUkmVegetationBuilder({ heightAt: h.local }),
    () => createUkmRoadsideBuilder({ heightAt: h.local }),
    () => createStadionMiniBuilder({ heightAt: h.local, mats, atlas }),
    () => createStudentCenterBuilder({ heightAt: h.local, heightAtWorld: h.world, mats, atlas, scope }),
    () => createRusunDetailBuilder({ heightAt: h.local, mats, atlas }),
    () => createFhDetailBuilder({ heightAt: h.local, mats, atlas }),
  ];
  // PJU area sekre UKM: kepala lampu (dunia) dengan tinggi tanah di kakinya (kolam cahaya/halo menempel tanah)
  const ukmLampsWorld = ukmLampHeads(h.local).map((p) => {
    const w = toWorld(LEMBAGA_PLACEMENT, p.x, p.z);
    return { x: w.x, z: w.z, y: h.world(w.x, w.z) };
  });
  let unregisterBlobs = null;
  const treeLod = { layer: null }; // diisi upgradeUkmTrees; sistem LOD memperbarui per frame
  const work = makers.reduce((prev, make) => prev.then(async (placed) => {
    if (disposed) return placed;
    const obj = await runSteps(ctx, scope, withScope(scope, make), isCancelled);
    if (!obj || disposed) return placed;
    content.add(obj);
    freezeStatic(content);
    return placed + 1;
  }), Promise.resolve(0));

  const ready = Promise.race([
    work.then(async (placed) => {
      if (disposed) return { placed, failed: [], replaced: [], cancelled: true };
      group.userData.lembagaReady = true;
      const points = ukmPlantPoints();
      const [glb, ukm, trees] = await Promise.all([
        upgradeSekreMotors({ root: content, scope, heightAt: h.local, isCancelled }),
        upgradeUkmAssets({ root: content, scope, heightAt: h.local, isCancelled }),
        upgradeUkmTrees({
          root: content, scope, controller: treeLod, isCancelled,
          instances: treeInstances(points, h.local), fallback: () => fallbackTreeCells(points, h.local),
        }),
      ]);
      return {
        placed, failed: [...glb.failed, ...ukm.failed, ...trees.failed], replaced: [...glb.replaced, ...ukm.replaced, ...trees.replaced], cancelled: disposed,
      };
    }),
    disposedSignal.then(() => ({ placed: 0, failed: [], replaced: [], cancelled: true })),
  ]);

  return validateBuild({
    group,
    colliders: lembagaColliders,
    minimapLayer: () => {}, // peta dasar region di-bake dari layer minimap (atap, rumput, lintasan)
    systems: [createHeroLodSystem({ id: UNRI_LEMBAGA_ID, root: content }), {
      id: 'unri-lembaga.pohon-lod', phase: 'world',
      update: (dt, ctx) => {
        const f = ctx.focus ?? ctx.bikePos;
        if (f && treeLod.layer) treeLod.layer.update(f.x - LEMBAGA_PLACEMENT.x, f.z - LEMBAGA_PLACEMENT.z);
        if (treeLod.layer && !unregisterBlobs) { // contact shadow pohon (gaya kartun/facet): daftar sekali saat lapisan siap
          unregisterBlobs = registerContactSource((emit, focus) => treeLod.layer?.blobs(
            focus.x - LEMBAGA_PLACEMENT.x, focus.z - LEMBAGA_PLACEMENT.z, CONTACT_RADIUS,
            (x, z, r) => emit(x + LEMBAGA_PLACEMENT.x, z + LEMBAGA_PLACEMENT.z, r),
          ));
        }
      },
    }],
    layout: LEMBAGA_LAYOUT,
    portals: PORTAL_DOORS,
    nightLights: {
      lamps: [...LEMBAGA_LAYOUT.pju.map((p) => toWorld(LEMBAGA_PLACEMENT, p.x, p.z)), ...ukmLampsWorld],
      floods: [],
    },
    lateRoot: content,
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      unregisterBlobs?.();
      signalDisposed();
      group.removeFromParent();
      disposeTree(group, { scope });
      scope.dispose();
    },
  }, UNRI_LEMBAGA_ID);
}

export const unriLembagaRegion = defineRegion({
  id: UNRI_LEMBAGA_ID,
  placement: LEMBAGA_PLACEMENT,
  mask: LEMBAGA_MASK,
  activation: LEMBAGA_ACTIVATION,
  pads: LEMBAGA_PADS,
  povs: LEMBAGA_POVS,
  proxy: (ctx) => buildLembagaProxy(ctx ?? {}),
  build: async (ctx) => buildLembaga(ctx ?? {}),
});
