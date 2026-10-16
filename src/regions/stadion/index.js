/**
 * Region handmade "stadion": kawasan Stadion Utama Riau yang sudah ada, dibungkus kontrak Region
 * (regions/Region.js). Fase 0: placement identitas {0,0,0} — koordinat lama = koordinat dunia.
 */
import { defineRegion, validateBuild } from '../Region.js';
import { withScope } from '../../engine/ResourceScope.js';
import { disposeTree } from '../../engine/disposeTree.js';
import { buildWorld } from '../../world/index.js';
import { stadionColliders } from './collider.js';
import { SITE } from './site.js';
import { LAYOUT } from './layout.js';
import { STADION_MASK } from './mask.js';
import { litLampPositions } from './lamps.js';

export const STADION_ID = 'stadion';

/** Fase 0 hanya memakai ctx.scope (ResourceScope milik region). */
function buildStadion({ scope }) {
  if (!scope) throw new TypeError('Region stadion: ctx.scope (ResourceScope) wajib');
  const world = withScope(scope, () => buildWorld({ layout: LAYOUT, site: SITE }));
  let disposed = false;
  return validateBuild({
    group: world.group,
    colliders: stadionColliders,
    minimapLayer: () => {}, // Fase 0: peta dasar masih di-bake App.bakeMinimap dari layer minimap (Fase 2: layer region)
    systems: [{ id: 'stadion.world', phase: 'world', update: (dt, ctx) => world.update(dt, ctx.time, ctx.focus), dispose() {} }],
    seatSamples: world.seatSamples,
    layout: LAYOUT,
    lamps: litLampPositions(LAYOUT),
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
  placement: { x: 0, z: 0, yaw: 0 },
  mask: STADION_MASK,
  build: async (ctx) => buildStadion(ctx ?? {}),
});
