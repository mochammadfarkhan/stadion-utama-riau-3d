/**
 * Region handmade "stadion": kawasan Stadion Utama Riau yang sudah ada, dibungkus kontrak Region
 * (regions/Region.js). Model GLB Blender (layout.blenderModels) adalah konten region: dimuat ke
 * scope region dan dilepas bersama region.
 */
import { defineRegion, validateBuild } from '../Region.js';
import { withScope } from '../../engine/ResourceScope.js';
import { disposeTree } from '../../engine/disposeTree.js';
import { buildWorld } from '../../world/index.js';
import { createModelGroup, placeModels } from '../../world/assets/models.js';
import { stadionColliders } from './collider.js';
import { SITE } from './site.js';
import { LAYOUT } from './layout.js';
import { STADION_MASK } from './mask.js';
import { stadionNightLights } from './lamps.js';
import { STADION_PLACEMENT } from './placement.js';

export const STADION_ID = 'stadion';
export { STADION_PLACEMENT };

/** Muat model GLB ke grup `models` di scope region (loadModel memanggil scope.get secara sinkron). */
function loadModels(scope, models, worldGroup, enabled) {
  if (!enabled) return Promise.resolve({ placed: 0, failed: [], replaced: [] });
  return withScope(scope, () => placeModels(models, LAYOUT.blenderModels, { world: worldGroup }));
}

/** ctx: scope (wajib), placement (default STADION_PLACEMENT), loadModels (default true). */
function buildStadion({ scope, placement = STADION_PLACEMENT, loadModels: withModels = true }) {
  if (!scope) throw new TypeError('Region stadion: ctx.scope (ResourceScope) wajib');
  const world = withScope(scope, () => buildWorld({ layout: LAYOUT, site: SITE }));
  const models = createModelGroup();
  world.group.add(models);
  const ready = loadModels(scope, models, world.group, withModels);
  let disposed = false;
  return validateBuild({
    group: world.group,
    colliders: stadionColliders,
    minimapLayer: () => {}, // peta dasar region di-bake App.bakeMinimap dari layer minimap
    systems: [{ id: 'stadion.world', phase: 'world', update: (dt, ctx) => world.update(dt, ctx.time, ctx.focus), dispose() {} }],
    seatSamples: world.seatSamples,
    layout: LAYOUT,
    nightLights: stadionNightLights(LAYOUT, placement),
    lateRoot: models,
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      world.group.removeFromParent();
      disposeTree(world.group, { scope });
      scope.dispose();
    },
  }, STADION_ID);
}

export const stadionRegion = defineRegion({
  id: STADION_ID,
  placement: STADION_PLACEMENT,
  mask: STADION_MASK,
  build: async (ctx) => buildStadion(ctx ?? {}),
});
